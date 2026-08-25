/* ============================================================
   Karvon — route.js
   Pure route maths. No DOM, no data loading — every function
   takes plain city objects {id, name, latitude, longitude,
   recommendedDays} and returns plain values.
   ============================================================ */

/* Straight-line distance underestimates real driving in Uzbekistan,
   where roads bend around the Kyzylkum. A single correction factor
   keeps the numbers honest without needing a routing API. */
const ROAD_FACTOR = 1.25;
const EARTH_R = 6371;

const toRad = (deg) => (deg * Math.PI) / 180;

function haversine(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/** Approximate road distance in km between two cities. */
function roadDistance(a, b, factor = ROAD_FACTOR) {
  return haversine(a, b) * factor;
}

/** Sum of the legs of an ordered list of cities. */
function pathDistance(order, factor = ROAD_FACTOR) {
  let total = 0;
  for (let i = 0; i < order.length - 1; i++) total += roadDistance(order[i], order[i + 1], factor);
  return total;
}

/* ------------------------------------------------------------
   Backtracking detection

   Uzbekistan's four headline cities sit on a near-straight
   east–west corridor: Tashkent 69.2°E → Samarkand 67.0°E →
   Bukhara 64.4°E → Khiva 60.4°E. So "does this route double
   back?" reduces to: project each city onto the dominant axis
   of the selected set, then count how many times the direction
   of travel flips.

   0 flips  → one clean sweep along the corridor.
   1 flip   → one detour, usually acceptable.
   2+ flips → the traveller is zig-zagging.

   Using the dominant axis rather than raw longitude means the
   test still works if someone picks a north–south set such as
   Khiva → Nukus, or a cluster around Samarkand.
   ------------------------------------------------------------ */

/** Unit vector along the widest spread of the selected cities. */
function dominantAxis(cities) {
  const meanLat = cities.reduce((s, c) => s + c.latitude, 0) / cities.length;
  const kx = Math.cos(toRad(meanLat)) * 111.32; // km per degree of longitude here
  const ky = 110.57; // km per degree of latitude
  const pts = cities.map((c) => ({ x: c.longitude * kx, y: c.latitude * ky }));

  let a = 0;
  let b = 0;
  let best = -1;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2;
      if (d > best) {
        best = d;
        a = i;
        b = j;
      }
    }
  }
  const dx = pts[b].x - pts[a].x;
  const dy = pts[b].y - pts[a].y;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len, kx, ky };
}

/** Signed position of each city along that axis, in km. */
function projections(order) {
  const { ux, uy, kx, ky } = dominantAxis(order);
  return order.map((c) => (c.longitude * kx) * ux + (c.latitude * ky) * uy);
}

/**
 * Find the legs where the traveller reverses direction.
 * Returns an array of leg indices (leg i runs from order[i] to order[i+1]).
 * Reversals shorter than `tolerance` km are ignored so that a small
 * wobble between two nearby cities is not reported as backtracking.
 */
function findBacktracks(order, tolerance = 60) {
  if (order.length < 3) return [];
  const proj = projections(order);
  const deltas = [];
  for (let i = 0; i < proj.length - 1; i++) deltas.push(proj[i + 1] - proj[i]);

  const flips = [];
  let lastSign = 0;
  deltas.forEach((d, i) => {
    if (Math.abs(d) < tolerance) return; // too small to count as a direction
    const sign = Math.sign(d);
    if (lastSign !== 0 && sign !== lastSign) flips.push(i);
    lastSign = sign;
  });
  return flips;
}

/* ------------------------------------------------------------
   Optimisation
   ------------------------------------------------------------ */

function permute(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((item, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    permute(rest).forEach((tail) => out.push([item, ...tail]));
  });
  return out;
}

function nearestNeighbour(cities, startIndex, factor) {
  const remaining = cities.slice();
  const route = [remaining.splice(startIndex, 1)[0]];
  while (remaining.length) {
    const last = route[route.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((c, i) => {
      const d = roadDistance(last, c, factor);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    route.push(remaining.splice(bestIdx, 1)[0]);
  }
  return route;
}

function twoOpt(route, { roundTrip, lockStart, lockEnd, factor }) {
  const cost = (r) => pathDistance(roundTrip ? [...r, r[0]] : r, factor);
  let best = route.slice();
  let bestCost = cost(best);
  let improved = true;

  const first = lockStart ? 1 : 0;
  const last = lockEnd ? best.length - 2 : best.length - 1;

  while (improved) {
    improved = false;
    for (let i = first; i < last; i++) {
      for (let j = i + 1; j <= last; j++) {
        const candidate = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const candidateCost = cost(candidate);
        if (candidateCost < bestCost - 0.01) {
          best = candidate;
          bestCost = candidateCost;
          improved = true;
        }
      }
    }
  }
  return best;
}

/**
 * Best order for a set of cities.
 * Options:
 *   startId   — pin the first city (usually the arrival airport)
 *   endId     — pin the last city (usually the departure airport)
 *   roundTrip — the traveller returns to the start city
 * Exhaustive up to 8 cities; nearest-neighbour + 2-opt above that.
 */
function optimiseOrder(cities, { startId = null, endId = null, roundTrip = false, factor = ROAD_FACTOR } = {}) {
  if (cities.length < 3) return cities.slice();

  const start = startId ? cities.find((c) => c.id === startId) : null;
  const end = endId && endId !== startId ? cities.find((c) => c.id === endId) : null;
  const middle = cities.filter((c) => c !== start && c !== end);

  const score = (order) => pathDistance(roundTrip ? [...order, order[0]] : order, factor);

  if (middle.length <= 7) {
    let best = null;
    let bestCost = Infinity;
    for (const perm of permute(middle)) {
      const order = [start, ...perm, end].filter(Boolean);
      const cost = score(order);
      if (cost < bestCost) {
        bestCost = cost;
        best = order;
      }
    }
    return best;
  }

  // Large sets: greedy seed, then local improvement.
  let seed = start ? [start, ...nearestNeighbour(middle, 0, factor)] : nearestNeighbour(middle, 0, factor);
  if (end) seed = [...seed, end];
  return twoOpt(seed, { roundTrip, lockStart: !!start, lockEnd: !!end, factor });
}

/* ------------------------------------------------------------
   Trip length
   ------------------------------------------------------------ */

/** Days on the ground plus days spent moving between cities. */
function estimateDays(order, roundTrip, factor = ROAD_FACTOR) {
  const stops = roundTrip ? order.slice(0, -1) : order;
  const onGround = stops.reduce((sum, c) => sum + (Number(c.recommendedDays) || 1), 0);

  let travel = 0;
  for (let i = 0; i < order.length - 1; i++) {
    const km = roadDistance(order[i], order[i + 1], factor);
    // Short hops are covered by the morning train and cost nothing.
    // The desert crossings do eat a day.
    travel += km < 350 ? 0 : km < 550 ? 0.5 : 1;
  }
  const total = Math.round(onGround + travel);
  return { min: total, max: total + 2, onGround, travel };
}

/* ------------------------------------------------------------
   Verdict
   ------------------------------------------------------------ */

/**
 * The headline verdict is driven by how many times the route reverses
 * direction, not by the distance ratio alone. A single detour on a short
 * trip can look terrible as a percentage while being a perfectly
 * reasonable choice; a double zig-zag across the country is the real
 * problem even when the percentage looks softer.
 */
function verdictFor(backtrackCount, efficiency) {
  if (backtrackCount >= 2) return { key: 'backtracking', tone: 'warn' };
  if (backtrackCount === 1) return { key: 'detour', tone: 'note' };
  if (efficiency >= 0.97) return { key: 'excellent', tone: 'good' };
  if (efficiency >= 0.9) return { key: 'good', tone: 'good' };
  return { key: 'workable', tone: 'note' };
}

/**
 * Full analysis of a chosen order.
 * Returns everything the planner page needs to render, including
 * the optimal alternative so the traveller can compare and decide.
 */
function analyseRoute(order, { factor = ROAD_FACTOR, startId = null, endId = null } = {}) {
  const roundTrip = order.length > 2 && order[0].id === order[order.length - 1].id;
  const openOrder = roundTrip ? order.slice(0, -1) : order;

  const totalDistance = pathDistance(order, factor);

  // Backtracking is judged on the outward journey only; the closing
  // leg of a round trip is the point of a round trip, not an error.
  let backtracks = findBacktracks(openOrder);

  const optimalOpen = optimiseOrder(openOrder, {
    startId: startId || openOrder[0].id,
    endId,
    roundTrip,
    factor,
  });
  const optimalFull = roundTrip ? [...optimalOpen, optimalOpen[0]] : optimalOpen;
  const optimalDistance = pathDistance(optimalFull, factor);

  const efficiency = totalDistance > 0 ? Math.min(1, optimalDistance / totalDistance) : 1;
  const sameAsOptimal = optimalFull.map((c) => c.id).join('>') === order.map((c) => c.id).join('>');

  // A route that is already the shortest possible cannot contain an
  // *unnecessary* doubling-back, whatever the geometry looks like.
  // This clears false positives on genuinely V-shaped city sets.
  if (efficiency >= 0.99) backtracks = [];

  const quality = verdictFor(backtracks.length, efficiency);

  const legs = [];
  for (let i = 0; i < order.length - 1; i++) {
    legs.push({
      from: order[i],
      to: order[i + 1],
      km: roadDistance(order[i], order[i + 1], factor),
      isBacktrack: backtracks.includes(i),
      isReturn: roundTrip && i === order.length - 2,
    });
  }

  const days = estimateDays(order, roundTrip, factor);
  const savedKm = Math.max(0, totalDistance - optimalDistance);

  return {
    order,
    roundTrip,
    legs,
    totalDistance,
    optimalOrder: optimalFull,
    optimalDistance,
    savedKm,
    efficiency,
    sameAsOptimal,
    backtracks,
    quality: quality.key,
    tone: quality.tone,
    days,
  };
}

/* Exports for Node-based tests; harmless in the browser. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ROAD_FACTOR,
    haversine,
    roadDistance,
    pathDistance,
    findBacktracks,
    optimiseOrder,
    estimateDays,
    analyseRoute,
  };
}
