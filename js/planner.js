/* ============================================================
   Karvon — planner.js
   The route planner page. Route maths lives in route.js.
   ============================================================ */

const Planner = {
  selected: [],   // city ids, in the traveller's chosen order
  roundTrip: false,
  dismissedSuggestion: false,
};

function plannerCities() {
  return Planner.selected.map((id) => cityById(id)).filter(Boolean);
}

function syncUrl() {
  const params = new URLSearchParams();
  if (Planner.selected.length) params.set('cities', Planner.selected.join(','));
  if (Planner.roundTrip) params.set('round', '1');
  const query = params.toString();
  history.replaceState(null, '', query ? `${location.pathname}?${query}` : location.pathname);
}

function readUrl() {
  const raw = qs('cities');
  if (raw) {
    Planner.selected = raw
      .split(',')
      .map((s) => s.trim())
      .filter((id) => cityById(id));
  }
  Planner.roundTrip = qs('round') === '1';
}

/* ---------- rendering ---------- */

function renderPlanner() {
  const main = $('#main');
  readUrl();

  const pickerBox = el('div', { class: 'picker' });
  const chosenBox = el('div', {});
  const resultBox = el('div', {});

  main.replaceChildren(
    el(
      'section',
      { class: 'section', style: 'padding-top:calc(var(--nav-h) + 52px)' },
      el(
        'div',
        { class: 'shell' },
        el('p', { class: 'eyebrow', text: t('planner.eyebrow') }),
        el('h1', { class: 'd2', text: t('planner.title') }),
        el('p', {
          class: 'lede',
          style: 'margin-top:14px',
          text: t('planner.intro'),
        }),

        el(
          'div',
          { class: 'split', style: 'display:grid;grid-template-columns:1fr 1.25fr;gap:clamp(28px,4vw,52px);margin-top:40px;align-items:start' },

          /* left: choose */
          el(
            'div',
            {},
            el('p', { class: 'label', style: 'margin-bottom:12px' }, t('planner.step1')),
            pickerBox,
            el('div', { style: 'margin-top:26px' }, el('p', { class: 'label', style: 'margin-bottom:12px' }, t('planner.step2')), chosenBox)
          ),

          /* right: result */
          el('div', {}, resultBox)
        )
      )
    )
  );

  Planner.pickerBox = pickerBox;
  Planner.chosenBox = chosenBox;
  Planner.resultBox = resultBox;

  paintPicker();
  paintChosen();
  paintResult();
}

function paintPicker() {
  Planner.pickerBox.replaceChildren(
    ...Data.cities.map((city) => {
      const index = Planner.selected.indexOf(city.id);
      const on = index > -1;
      return el(
        'button',
        {
          class: 'picker__item',
          type: 'button',
          'aria-pressed': String(on),
          onclick: () => toggleCity(city.id),
        },
        el('span', { class: 'picker__order', text: on ? String(index + 1) : '+' }),
        img(city.coverImage, '', { seed: city.id }),
        el(
          'span',
          { style: 'flex:1' },
          el('strong', { text: L(city.name) }),
          el('span', { class: 'data', text: `${days(city.recommendedDays || 1)} · ${placesInCity(city.id).length} ${t('ui.places')}` })
        )
      );
    })
  );
}

function toggleCity(id) {
  const at = Planner.selected.indexOf(id);
  if (at > -1) Planner.selected.splice(at, 1);
  else Planner.selected.push(id);
  Planner.dismissedSuggestion = false;
  afterChange();
}

function moveCity(from, to) {
  if (to < 0 || to >= Planner.selected.length) return;
  const [item] = Planner.selected.splice(from, 1);
  Planner.selected.splice(to, 0, item);
  Planner.dismissedSuggestion = false;
  afterChange();
}

function afterChange() {
  syncUrl();
  paintPicker();
  paintChosen();
  paintResult();
}

/* ---------- chosen list, with drag and keyboard reordering ---------- */

function paintChosen() {
  const box = Planner.chosenBox;

  if (!Planner.selected.length) {
    box.replaceChildren(
      el('p', { class: 'muted', style: 'font-size:.95rem' }, t('planner.empty'))
    );
    return;
  }

  const list = el('div', { class: 'order-list' });
  let dragIndex = null;

  Planner.selected.forEach((id, i) => {
    const city = cityById(id);
    const row = el(
      'div',
      { class: 'order-item', draggable: 'true', dataset: { index: i } },
      el('span', { class: 'order-item__grip', 'aria-hidden': 'true', text: '⠿' }),
      el('span', { class: 'data', style: 'color:var(--glaze)', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: 'order-item__name', text: L(city.name) }),
      el(
        'span',
        { class: 'order-item__btns' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${L(city.name)} up`, disabled: i === 0, onclick: () => moveCity(i, i - 1) }, '↑'),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Move ${L(city.name)} down`, disabled: i === Planner.selected.length - 1, onclick: () => moveCity(i, i + 1) }, '↓'),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${L(city.name)}`, onclick: () => toggleCity(id) }, '✕')
      )
    );

    row.addEventListener('dragstart', () => {
      dragIndex = i;
      row.classList.add('is-dragging');
    });
    row.addEventListener('dragend', () => {
      dragIndex = null;
      $$('.order-item', list).forEach((n) => n.classList.remove('is-dragging', 'is-over'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.classList.add('is-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('is-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragIndex !== null && dragIndex !== i) moveCity(dragIndex, i);
    });

    list.append(row);
  });

  const roundToggle = el(
    'label',
    { style: 'display:flex;align-items:center;gap:10px;margin-top:16px;cursor:pointer;font-size:.95rem' },
    el('input', {
      type: 'checkbox',
      checked: Planner.roundTrip,
      style: 'width:17px;height:17px;accent-color:#35B0AE',
      onchange: (e) => {
        Planner.roundTrip = e.target.checked;
        Planner.dismissedSuggestion = false;
        afterChange();
      },
    }),
    el('span', {}, 'Return to ', el('strong', { text: L((cityById(Planner.selected[0]) || {}).name) || 'the first city' }), ' at the end')
  );

  box.replaceChildren(
    list,
    Planner.selected.length > 1 ? roundToggle : null,
    el(
      'div',
      { style: 'display:flex;gap:10px;margin-top:16px;flex-wrap:wrap' },
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: shareRoute }, t('planner.copyLink')),
      el(
        'button',
        {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          onclick: () => {
            Planner.selected = [];
            Planner.roundTrip = false;
            afterChange();
          },
        },
        t('planner.startOver')
      )
    )
  );
}

async function shareRoute() {
  const url = location.href;
  try {
    const narrow = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    if (navigator.share && narrow) {
      await navigator.share({ title: 'My Uzbekistan route', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(t('planner.copied'));
  } catch (_) {
    toast(t('planner.copyFail'), true);
  }
}

/* ---------- result ---------- */

function paintResult() {
  const box = Planner.resultBox;
  const chosen = plannerCities();

  if (chosen.length < 2) {
    box.replaceChildren(
      el(
        'div',
        { class: 'state' },
        el('h3', { text: t('planner.placeholderTitle') }),
        el('p', { text: t('planner.placeholderBody') })
      )
    );
    return;
  }

  const order = Planner.roundTrip ? [...chosen, chosen[0]] : chosen;
  const analysis = analyseRoute(order, { factor: Data.settings.roadFactor || 1.25 });
  const mapBox = el('div', { class: 'map' });

  box.replaceChildren(
    el(
      'div',
      { style: 'position:sticky;top:calc(var(--nav-h) + 16px)' },
      el('p', { class: 'eyebrow', text: t('planner.yourJourney') }),
      el(
        'div',
        { class: 'stat-row', style: 'margin-top:14px' },
        el('div', { class: 'stat' }, el('span', { class: 'k', text: t('planner.totalDistance') }), el('div', { class: 'v' }, String(Math.round(analysis.totalDistance).toLocaleString('en-US')), el('small', {}, 'km'))),
        el('div', { class: 'stat' }, el('span', { class: 'k', text: t('planner.timeNeeded') }), el('div', { class: 'v' }, `${analysis.days.min}–${analysis.days.max}`, el('small', {}, LANG === 'zh' ? '天' : 'days'))),
        el('div', { class: 'stat' }, el('span', { class: 'k', text: t('planner.quality') }), el('div', { class: 'v', style: 'font-size:1.15rem', text: t(`quality.${analysis.quality}`) }))
      ),
      el('div', { style: 'margin-top:16px' }, verdictPanel(analysis)),
      el('div', { style: 'margin-top:24px' }, ribbon(analysis)),
      el('div', { style: 'margin-top:20px' }, mapBox),
      el(
        'div',
        { style: 'margin-top:20px;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--lapis-800)' },
        el('h3', { class: 'd4', text: t('planner.askTitle') }),
        el('p', { class: 'muted', style: 'font-size:.93rem;margin-top:6px', text: t('planner.askBody') }),
        el('a', { class: 'btn btn--block', style: 'margin-top:14px', href: BASE + 'contact.html', text: t('nav.contact') })
      )
    )
  );

  drawMap(
    mapBox,
    order.map((c) => ({ lat: c.latitude, lng: c.longitude, name: c.name })),
    { line: true }
  );

  observeReveals(box);
}

function verdictPanel(analysis) {
  const backCount = analysis.backtracks.length;
  const roadFactor = Data.settings.roadFactor || 1.25;

  const km = fmtKm(analysis.savedKm);
  let title;
  let detail;

  if (analysis.roundTrip && backCount === 0) {
    const city = L(cityById(analysis.order[0].id).name);
    title = t('verdict.round.title');
    detail = tf('verdict.round.body', { city });
  } else if (backCount === 0 && analysis.efficiency >= 0.97) {
    title = t('verdict.clean.title');
    detail = t('verdict.clean.body');
  } else if (backCount === 0) {
    title = t('verdict.sensible.title');
    detail = tf('verdict.sensible.body', { km });
  } else if (backCount === 1) {
    const leg = analysis.legs.find((l) => l.isBacktrack);
    title = t('verdict.detour.title');
    detail = tf('verdict.detour.body', { from: L(leg.from.name), to: L(leg.to.name), km });
  } else {
    title = t('verdict.back.title');
    detail = tf('verdict.back.body', {
      n: backCount,
      km,
      pct: Math.round((1 - analysis.efficiency) * 100),
    });
  }

  const suggestion =
    !analysis.sameAsOptimal && !Planner.dismissedSuggestion && analysis.savedKm > 30
      ? el(
          'div',
          { class: 'verdict__actions' },
          el(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              onclick: () => {
                const ids = analysis.optimalOrder.map((c) => c.id);
                Planner.selected = analysis.roundTrip ? ids.slice(0, -1) : ids;
                Planner.dismissedSuggestion = false;
                afterChange();
                toast(tf('planner.reordered', { km: fmtKm(analysis.savedKm) }));
              },
            },
            t('planner.optimise')
          ),
          el(
            'button',
            {
              class: 'btn btn--ghost btn--sm',
              type: 'button',
              onclick: () => {
                Planner.dismissedSuggestion = true;
                paintResult();
                toast(t('planner.kept'));
              },
            },
            t('planner.keepMine')
          )
        )
      : null;

  const preview =
    suggestion && !analysis.sameAsOptimal
      ? el('p', { class: 'data', style: 'margin-top:10px;color:var(--glaze)' }, `${t('verdict.shortest')}: ${analysis.optimalOrder.map((c) => L(c.name)).join(' → ')} · ${fmtKm(analysis.optimalDistance)}`)
      : null;

  const toneClass = { warn: 'verdict--warn', good: 'verdict--good', note: 'verdict--note' }[analysis.tone] || '';

  return el(
    'div',
    { class: `verdict ${toneClass}`, role: analysis.tone === 'warn' ? 'alert' : 'status' },
    el('span', { class: 'verdict__dot', 'aria-hidden': 'true' }),
    el('div', { style: 'flex:1' }, el('h3', { text: title }), el('p', { text: detail }), preview, suggestion)
  );
}

/* The signature element: the journey drawn as a caravan line, with
   retraced legs marked in red so the problem is visible, not just stated. */
function ribbon(analysis) {
  const stops = analysis.order.map((city, i) => {
    const leg = analysis.legs[i];
    const isLast = i === analysis.order.length - 1;
    const top = placesInCity(city.id).slice(0, 3);
    const incoming = i > 0 ? analysis.legs[i - 1] : null;

    return el(
      'div',
      {
        class: [
          'ribbon__stop',
          'reveal',
          i === 0 ? 'ribbon__stop--start' : '',
          isLast ? 'ribbon__stop--end' : '',
          incoming && incoming.isBacktrack ? 'ribbon__stop--back' : '',
        ]
          .filter(Boolean)
          .join(' '),
      },
      el('span', { class: 'ribbon__node', 'aria-hidden': 'true' }),
      el(
        'div',
        { style: 'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap' },
        el('a', { class: 'ribbon__city', href: cityHref(city.id), text: L(city.name) }),
        !isLast || !analysis.roundTrip
          ? el('span', { class: 'data muted', text: days(city.recommendedDays || 1) })
          : el('span', { class: 'data muted', text: t('planner.return') })
      ),
      !(analysis.roundTrip && isLast)
        ? el(
            'div',
            { class: 'ribbon__places' },
            top.map((p) =>
              el('button', { class: 'chip', type: 'button', onclick: () => openPlace(p.id) }, L(p.name))
            )
          )
        : null,
      leg
        ? el(
            'span',
            { class: `ribbon__leg${leg.isBacktrack ? ' ribbon__leg--back' : ''}` },
            leg.isBacktrack ? '↰' : '↓',
            `${fmtKm(leg.km)} → ${L(leg.to.name)}`,
            leg.isBacktrack ? t('verdict.retraces') : ''
          )
        : null
    );
  });

  return el('div', { class: 'ribbon' }, stops);
}
