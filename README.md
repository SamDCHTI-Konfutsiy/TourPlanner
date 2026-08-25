# Karvon — Uzbekistan tourism site

A static tourism site for GitHub Pages. No build step, no framework, no server.
HTML, CSS and vanilla JavaScript, with all content in four JSON files that an
admin panel edits and commits back through the GitHub API.

---

## 1. Deploy it in five minutes

1. Create a repository (public or private — Pages works with both on paid plans;
   public is free).
2. Copy every file in this folder into the repository root and push.
3. In the repository: **Settings → Pages → Source → Deploy from a branch**,
   pick `main` and `/ (root)`, save.
4. Wait about a minute. The site is at
   `https://<your-username>.github.io/<repo>/`.

`.nojekyll` is already included, which stops GitHub from running Jekyll over the
files. Do not remove it.

**Everything uses relative paths**, so the site works both at a domain root and
under a `/repo-name/` subpath without changing a line.

### Testing locally

Opening `index.html` straight from the filesystem will not work — `fetch()`
refuses `file://` URLs. Run any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## 2. Routing, and why there are no clean URLs

GitHub Pages has no server-side rewrite. A URL like `/city/samarkand` would
return 404 on refresh or on a shared link. So the site uses real files with a
query parameter:

```
city.html?id=samarkand
tour.html?id=samarkand-2day
planner.html?cities=tashkent,samarkand,bukhara,khiva&round=1
```

Every one of these survives a refresh, a bookmark and a paste into WeChat. The
route planner keeps its URL in sync as you edit, so a route is shareable by
copying the address bar — there is a button for it.

---

## 3. Admin panel

Open `/admin/` on the deployed site.

| Tab | What it does |
|---|---|
| Dashboard | Counts, plus integrity checks (orphaned places, empty cities, tours with no days) |
| Cities | Add, edit, delete, reorder. Name, region, tagline, description, coordinates, recommended days, travel info, cover image, gallery |
| Places | Same, filtered by city. Category, address, coordinates, visit duration, and **1–10 images** with reordering and per-image delete |
| Tours | One city, one to three days. Day titles, ordered stops picked from that city's places, per-day notes |
| Contact & settings | Site name, hero, WeChat ID/name/QR, Telegram, phone, email, address, road factor |
| Publish | Connect to GitHub and write the four JSON files |

### How editing works

Edits save into your browser's local storage as you type. Nothing reaches the
live site until you press **Publish to GitHub**. Before publishing you can press
**Preview the site**, which opens the real pages running against your unpublished
changes, with an orange bar so you cannot forget you are in preview.

### Setting up publishing

1. On GitHub: **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Repository access: **Only select repositories** → this one.
3. Permissions: **Contents → Read and write**. Nothing else.
4. Copy the token, open the admin **Publish** tab, fill in owner / repository /
   branch, paste the token, press **Connect**.

Publishing commits `data/cities.json`, `data/places.json`, `data/tours.json` and
`data/settings.json`. GitHub Pages rebuilds in about a minute.

If you would rather not use a token at all, **Download JSON** gives you the four
files to commit yourself. Everything else in the admin panel works the same way.

### Image uploads

With GitHub connected, the **Upload file** button in any image editor commits the
file to `assets/images/{cities,places,tours,contact}/` and stores the relative
path. Without a connection, paste an image URL instead — both are supported, and
mixing them is fine.

### Security — read this once

There is no login on `/admin/`, and there cannot be one. GitHub Pages serves
static files; there is no server here that could hold a secret or check a
password. Anything shipped to the browser is readable by anyone.

What the site does instead:

- **No token is ever stored in the repository, in the source, or in
  localStorage.** The admin pastes a token per session; it lives in
  `sessionStorage` and is gone when the tab closes.
- The token is scoped to one repository with `Contents: write` and nothing else,
  so worst case is limited to this site's content.
- A visitor who opens `/admin/` sees the interface but cannot write anything
  without their own token.

If you need a real login, the site has to stop being static. The two usual routes
are a small OAuth proxy (Cloudflare Worker, Netlify Function) or a hosted CMS
such as Decap or Sveltia pointed at the same repository. The JSON structure here
works unchanged with either.

---

## 4. The route algorithm

Lives in `js/route.js`, with no DOM dependencies so it can be tested directly
under Node.

### Distance

Great-circle distance via the haversine formula, multiplied by a **road factor**
of `1.25` (editable in settings). Straight-line distance badly understates real
driving in Uzbekistan, where roads bend around the Kyzylkum. Tashkent–Samarkand
comes out at 332 km against a real road distance of roughly 300 km, and
Bukhara–Khiva at 482 km against roughly 450 km — close enough to plan with,
and honestly labelled as approximate.

### Detecting backtracking

Uzbekistan's headline cities sit on a near-straight east–west corridor:
Tashkent 69.2°E → Samarkand 67.0°E → Bukhara 64.4°E → Khiva 60.4°E. So the
question "does this route double back?" becomes a one-dimensional one.

1. Find the **dominant axis** of the selected cities — the line between the two
   furthest apart, in kilometres rather than raw degrees, so latitude and
   longitude are comparable.
2. Project every city onto that axis.
3. Walk the route and count how many times the sign of the movement flips.
   Movements under 60 km are ignored so a small wobble between nearby cities is
   not called a reversal.
4. If the chosen order is already the shortest possible (efficiency ≥ 99%), the
   count is cleared — a shortest route cannot contain an *unnecessary* detour,
   whatever its shape. This is what stops genuinely V-shaped sets such as
   Khiva → Nukus → Bukhara from being flagged.

Using the dominant axis instead of raw longitude means the test still works for
north–south sets and for clusters around a single city.

### The verdict

The headline is driven by the number of reversals, not by the distance ratio:

| Reversals | Verdict | What the traveller sees |
|---|---|---|
| 0, ≥97% efficient | Excellent | "One clean run along the corridor." |
| 0 | Good | Nothing doubles back; a shorter order exists but barely |
| 1 | One detour | Named, costed, and explicitly allowed |
| 2 or more | Backtracking | "This route contains unnecessary backtracking." |

This ordering is deliberate. A single detour on a short trip can look terrible as
a percentage while being a perfectly reasonable choice — Tashkent → Bukhara →
Samarkand is 73% efficient but only turns back once, and people do it for flight
times. A double zig-zag across the country is the real problem even when the
percentage looks softer: Tashkent → Khiva → Samarkand → Bukhara → Tashkent scores
81% but reverses twice, and it is the case this site was built to catch.

Whatever the verdict, **Optimise route** and **Keep my order** sit side by side.
The site never rewrites a route without being asked.

### Round trips

If the last city equals the first, the route is a round trip. The closing leg is
excluded from backtracking analysis — returning to your arrival airport is the
point of a round trip, not a mistake. Optimisation keeps the round-trip shape.

### Finding the shortest order

- **Up to 8 free cities:** every permutation is evaluated. With a pinned start
  that is at most 5,040 orders, which is instant.
- **More than 8:** nearest-neighbour seed followed by 2-opt local improvement,
  respecting any pinned start and end.

### Trip length

Days on the ground (each city's `recommendedDays`) plus travel time: legs under
350 km add nothing, since the morning train covers them; legs up to 550 km add
half a day; longer desert crossings add a full day. The result is shown as a
two-day range, because nobody's trip is precise to the day.

---

## 5. Project structure

```
/
├── index.html            home
├── cities.html           all cities
├── city.html             ?id=…   city detail, places, filters, map
├── tours.html            all ready tours, filterable
├── tour.html             ?id=…   day-by-day itinerary
├── planner.html          ?cities=…&round=1   the route planner
├── contact.html          WeChat / Telegram / phone
├── .nojekyll             stops GitHub running Jekyll
├── admin/
│   └── index.html        the whole admin panel
├── css/
│   ├── main.css          design system + every public page
│   └── admin.css         admin layout only, same tokens
├── js/
│   ├── core.js           data loading, nav/footer, gallery, lightbox,
│   │                     modal, search, maps, error states, i18n
│   ├── route.js          pure route maths (no DOM — testable in Node)
│   ├── planner.js        the planner page
│   ├── site.js           every other page renderer
│   ├── github.js         GitHub API: read, commit, upload
│   └── admin.js          admin CRUD and publishing
├── data/
│   ├── cities.json
│   ├── places.json
│   ├── tours.json
│   └── settings.json
└── assets/
    ├── images/{cities,places,tours,contact}/
    └── icons/favicon.svg
```

`css/responsive.css` does not exist on purpose: media queries live next to the
rules they modify at the bottom of `main.css`, which is far easier to keep
consistent than a parallel file.

---

## 6. Data shapes

**City**

```json
{
  "id": "samarkand",
  "name": "Samarkand",
  "region": "Samarqand Region",
  "tagline": "The blue domes that gave the Silk Road its postcard",
  "description": "…",
  "coverImage": "https://… or assets/images/cities/…",
  "gallery": ["…"],
  "latitude": 39.6542,
  "longitude": 66.9597,
  "recommendedDays": 2,
  "travelInfo": "…"
}
```

**Place** — `images` holds 1 to 10 entries; the first is used on cards.

```json
{
  "id": "registan",
  "cityId": "samarkand",
  "name": "Registan Square",
  "category": "architecture",
  "shortDescription": "…",
  "description": "…",
  "address": "Registan Street, Samarkand",
  "latitude": 39.6547,
  "longitude": 66.9758,
  "visitDuration": 120,
  "images": ["…"]
}
```

**Tour** — always one city, one to three days.

```json
{
  "id": "samarkand-2day",
  "title": "Samarkand in Two Days",
  "cityId": "samarkand",
  "duration": 2,
  "coverImage": "…",
  "description": "…",
  "notes": "…",
  "days": [
    { "title": "The Timurid centre", "placeIds": ["registan"], "note": "…" }
  ]
}
```

Categories are defined in `settings.json`, so adding one needs no code change.

---

## 7. Design

The palette comes from Timurid majolica rather than from a template: a lapis
ground (`#061426`–`#17456F`), turquoise glaze (`#35B0AE`), saffron for actions
(`#E3A53E`), madder red reserved for backtracking warnings (`#CB5140`), and
ganch-plaster chalk for text (`#F4EFE6`). Dark surfaces were chosen because the
site is photograph-led and tilework blue is the subject's own material.

Type is Bricolage Grotesque for display, Karla for body, and DM Mono for
anything numeric — distances, durations, coordinates, day counts. The mono face
earns its place: this site is full of measurements.

One motif recurs and nowhere else: an eight-point girih star. It is the bullet on
every section eyebrow, the node on the route ribbon, the map pin, and the
fallback pattern drawn when an image fails to load.

The signature element is the **route ribbon** on the planner — the journey drawn
as a caravan line with star nodes, distances in mono along the connecting line,
and any retraced leg rendered in madder with a mark that visibly doubles back, so
backtracking is something you see rather than something you are told.

---

## 8. Robustness

- **Missing or broken images** render a deterministic girih tile generated from
  the item's id — never a broken-image icon.
- **Failed JSON load** shows a readable error state with a reload button.
- **Unknown city or tour id** shows an empty state with a way back.
- **Map failure** (offline, or the tile server unreachable) falls back to a panel
  listing the coordinates. The rest of the page is unaffected; Leaflet is only
  fetched when a map is actually on screen.
- **Empty states** exist for cities with no places, tours with no days, filters
  with no matches, and searches with no hits.
- **Corrupt admin draft** falls back to the published files rather than failing.
- **Unsaved changes** trigger the browser's leave warning.

Nothing white-screens.

---

## 9. Accessibility and performance

Semantic landmarks, a skip link, `alt` on every image, `aria-pressed` on filter
chips, `aria-current` on navigation, arrow-key support in the gallery and the
search results, Escape to close the modal and the lightbox, visible focus rings
throughout, and `prefers-reduced-motion` honoured.

All images below the fold are lazy-loaded. No framework, no bundler, no
polyfills. Leaflet is the only third-party dependency and loads on demand.

---

## 10. Other languages

Every UI string in JavaScript goes through `t()` against the `DICT` object at the
top of `core.js`. English is the only dictionary today. Adding Uzbek, Russian or
Chinese means adding a dictionary and a language switch — no markup changes.

Content itself (city and place descriptions) is single-language in the current
JSON. If you need translated content, the cleanest change is to make the text
fields objects keyed by language (`{ "en": "…", "ru": "…" }`) and read them
through a small helper, rather than duplicating the files.

---

## 11. Replacing the demo content

The demo uses seeded placeholder photography from `picsum.photos` so that the
site never ships with broken images. **Replace these before going live** — they
are not photographs of Uzbekistan. Either upload real images through the admin
panel, or paste URLs from your own hosting. The WeChat QR in the demo is also a
placeholder.

Written content is a starting point and should be checked against what your
guides actually do.
