/* ============================================================
   Karvon — site.js
   Renderers for every public page. The page picks itself up from
   <body data-page="…">.
   ============================================================ */

/* ---------- shared fragments ---------- */

function cityCard(city, wide = false) {
  return el(
    'a',
    { class: `city-card${wide ? ' city-card--wide' : ''} reveal`, href: cityHref(city.id) },
    img(city.coverImage, L(city.name), { seed: city.id, sizes: '(max-width: 620px) 100vw, 33vw' }),
    el(
      'div',
      { class: 'city-card__body' },
      el('h3', { text: L(city.name) }),
      el('p', { text: L(city.tagline) || '' }),
      el('span', { class: 'city-card__days' }, `${days(city.recommendedDays || 1)} · ${placesInCity(city.id).length} ${t('ui.places')}`)
    )
  );
}

function tourCard(tour) {
  const city = cityById(tour.cityId);
  return el(
    'a',
    { class: 'card reveal', href: tourHref(tour.id) },
    el('div', { class: 'card__media' }, img(tour.coverImage, L(tour.title), { seed: tour.id })),
    el(
      'div',
      { class: 'card__body' },
      el('h3', { class: 'card__title', text: L(tour.title) }),
      el('p', { class: 'card__text', text: L(tour.description) || '' }),
      el(
        'div',
        { class: 'card__foot' },
        el('span', { text: city ? L(city.name) : '' }),
        el('span', { text: days(tour.duration || 1) })
      )
    )
  );
}

function placeCard(place) {
  return el(
    'button',
    {
      class: 'card reveal',
      type: 'button',
      style: 'text-align:left;cursor:pointer',
      onclick: () => openPlace(place.id),
    },
    el('div', { class: 'card__media' }, img((place.images || [])[0], L(place.name), { seed: place.id })),
    el(
      'div',
      { class: 'card__body' },
      el('h3', { class: 'card__title', text: L(place.name) }),
      el('p', { class: 'card__text', text: L(place.shortDescription) || '' }),
      el(
        'div',
        { class: 'card__foot' },
        el('span', { text: categoryLabel(place.category) }),
        el('span', { text: fmtDuration(place.visitDuration) })
      )
    )
  );
}

function sectionHead(eyebrow, title, aside) {
  return el(
    'div',
    { class: 'section-head reveal' },
    el(
      'div',
      { class: 'section-head-row' },
      el('div', {}, el('p', { class: 'eyebrow', text: eyebrow }), el('h2', { class: 'd2', text: title })),
      aside || null
    )
  );
}

/* ---------- place detail (modal, deep-linkable via #place=id) ---------- */

function openPlace(id) {
  const place = placeById(id);
  if (!place) {
    toast('That place is no longer listed.', true);
    return;
  }
  const city = cityById(place.cityId);
  const mapBox = el('div', { class: 'map' });

  const body = el(
    'div',
    {},
    el('div', { style: 'padding-top:20px' }, buildGallery(place.images, L(place.name))),
    el('p', { class: 'eyebrow', style: 'margin-top:26px', text: `${categoryLabel(place.category)} · ${city ? L(city.name) : ''}` }),
    el('h2', { class: 'd3', text: L(place.name) }),
    el('p', { class: 'lede', style: 'margin-top:12px', text: L(place.shortDescription) || '' }),
    el('div', { style: 'margin-top:18px' }, el('p', { text: L(place.description) || '' })),
    el(
      'div',
      { class: 'stat-row', style: 'margin-top:24px' },
      el('div', { class: 'stat' }, el('span', { class: 'k', text: t('ui.timeNeeded') }), el('div', { class: 'v', text: fmtDuration(place.visitDuration) || '—' })),
      el('div', { class: 'stat' }, el('span', { class: 'k', text: t('ui.category') }), el('div', { class: 'v', style: 'font-size:1.2rem', text: categoryLabel(place.category) })),
      el('div', { class: 'stat' }, el('span', { class: 'k', text: t('ui.city') }), el('div', { class: 'v', style: 'font-size:1.2rem', text: city ? L(city.name) : '—' }))
    ),
    place.address ? el('p', { class: 'muted', style: 'margin-top:18px', text: place.address }) : null,
    el('div', { style: 'margin-top:16px' }, mapBox)
  );

  Modal.open(body, L(place.name));
  history.replaceState(null, '', `${location.pathname}${location.search}#place=${place.id}`);
  drawMap(mapBox, [{ lat: place.latitude, lng: place.longitude, name: L(place.name) }], { zoom: 15 });
}

/* ---------- home ---------- */

function renderHome() {
  const s = Data.settings;
  const main = $('#main');
  const searchMount = el('div', { style: 'max-width:520px;margin-top:30px' });

  const featured = Data.cities.slice(0, 4);
  const tours = Data.tours.slice(0, 3);

  main.replaceChildren(
    /* hero */
    el(
      'section',
      { class: 'hero' },
      el('div', { class: 'hero__media' }, img(s.heroImage, '', { seed: 'hero', eager: true })),
      el(
        'div',
        { class: 'shell hero__body' },
        el('p', { class: 'eyebrow', text: L(s.siteTagline) || 'Uzbekistan' }),
        el('h1', { class: 'd1', text: L(s.heroTitle) || 'Discover Uzbekistan' }),
        el('p', { class: 'lede', text: L(s.heroSubtitle) || '' }),
        el(
          'div',
          { class: 'hero__cta' },
          el('a', { class: 'btn', href: BASE + 'planner.html', text: t('cta.plan') }),
          el('a', { class: 'btn btn--ghost', href: BASE + 'tours.html', text: t('cta.tours') })
        ),
        el(
          'div',
          { class: 'hero__meta' },
          el('div', {}, el('span', { class: 'k', text: t('nav.cities') }), el('span', { class: 'v', text: String(Data.cities.length) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.places') }), el('span', { class: 'v', text: String(Data.places.length) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.readyTours') }), el('span', { class: 'v', text: String(Data.tours.length) }))
        )
      )
    ),

    /* search + cities */
    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell' },
        sectionHead(t('home.whereEyebrow'), t('home.whereTitle'), el('a', { class: 'textlink', href: BASE + 'cities.html', text: t('home.allCities') })),
        searchMount,
        el('div', { class: 'grid grid--4', style: 'margin-top:34px' }, featured.map((c) => cityCard(c)))
      )
    ),

    /* planner teaser */
    el(
      'section',
      { class: 'section section--band' },
      el(
        'div',
        { class: 'shell split', style: 'display:grid;grid-template-columns:1fr 1fr;gap:clamp(28px,5vw,64px);align-items:center' },
        el(
          'div',
          {},
          el('p', { class: 'eyebrow', text: t('home.plannerEyebrow') }),
          el('h2', { class: 'd2', text: t('home.plannerTitle') }),
          el('p', { class: 'lede', style: 'margin-top:16px', text: t('home.plannerBody') }),
          el('div', { style: 'margin-top:26px' }, el('a', { class: 'btn', href: BASE + 'planner.html', text: t('home.plannerCta') }))
        ),
        el(
          'div',
          { class: 'ribbon reveal', style: 'padding:26px 26px 26px 60px;border:1px solid var(--line);border-radius:8px;background:var(--lapis-800)' },
          ['Tashkent', 'Samarkand', 'Bukhara', 'Khiva'].map((name, i, arr) =>
            el(
              'div',
              { class: `ribbon__stop${i === 0 ? ' ribbon__stop--start' : ''}${i === arr.length - 1 ? ' ribbon__stop--end' : ''}` },
              el('span', { class: 'ribbon__node', 'aria-hidden': 'true' }),
              el('div', { class: 'ribbon__city', text: name }),
              i < arr.length - 1 ? el('span', { class: 'ribbon__leg' }, ['332 km', '273 km', '482 km'][i]) : el('span', { class: 'ribbon__sub', text: 'Fly home from Urgench' })
            )
          )
        )
      )
    ),

    /* tours */
    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell' },
        sectionHead(t('home.toursEyebrow'), t('home.toursTitle'), el('a', { class: 'textlink', href: BASE + 'tours.html', text: t('home.allTours') })),
        tours.length
          ? el('div', { class: 'grid grid--3' }, tours.map(tourCard))
          : emptyState(t('state.noTours'), 'Plan a route instead', BASE + 'planner.html')
      )
    ),

    /* who you are travelling with */
    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell' },
        el(
          'div',
          { class: 'guide reveal' },
          el('div', { class: 'guide__portrait' }, img(s.guidePhoto || s.heroImage, L(s.guideName), { seed: 'guide' })),
          el(
            'div',
            {},
            el('p', { class: 'eyebrow', text: t('home.aboutEyebrow') }),
            el('h2', { class: 'guide__name', text: L(s.guideName) || s.siteName }),
            el('p', { class: 'lede', style: 'margin-top:14px', text: L(s.companyDescription) }),
            el('p', { class: 'muted', style: 'margin-top:12px', text: L(s.aboutBlurb) }),
            el(
              'div',
              { class: 'guide__langs' },
              (s.languages || []).map((lg) => el('span', { class: 'chip chip--static', text: lg.label }))
            )
          )
        )
      )
    ),

    /* contact */
    el(
      'section',
      { class: 'section section--band' },
      el(
        'div',
        { class: 'shell' },
        sectionHead(t('nav.contact'), t('contact.title')),
        contactGrid(),
        el('p', { class: 'muted', style: 'margin-top:22px', text: (s.contact || {}).hours || '' })
      )
    )
  );

  mountSearch(searchMount);
  if (location.hash.startsWith('#place=')) openPlace(decodeURIComponent(location.hash.slice(7)));
}

/* ---------- cities index ---------- */

function renderCitiesIndex() {
  const main = $('#main');
  const searchMount = el('div', { style: 'max-width:520px;margin-top:26px' });

  main.replaceChildren(
    el(
      'section',
      { class: 'section', style: 'padding-top:calc(var(--nav-h) + 56px)' },
      el(
        'div',
        { class: 'shell' },
        el('p', { class: 'eyebrow', text: t('nav.cities') }),
        el('h1', { class: 'd2', text: t('cities.title') }),
        el('p', { class: 'lede', style: 'margin-top:14px', text: L(Data.settings.aboutBlurb) }),
        searchMount,
        el(
          'div',
          { class: 'grid grid--3', style: 'margin-top:38px' },
          Data.cities.length ? Data.cities.map((c) => cityCard(c)) : emptyState('No cities have been added yet.')
        )
      )
    )
  );
  mountSearch(searchMount);
}

/* ---------- city page ---------- */

function renderCity() {
  const main = $('#main');
  const city = cityById(qs('id'));

  if (!city) {
    main.replaceChildren(
      el(
        'div',
        { class: 'shell', style: 'padding:calc(var(--nav-h) + 80px) 0 80px' },
        emptyState('That city is not on our list.', 'See all cities', BASE + 'cities.html')
      )
    );
    document.body.dataset.nav = 'solid';
    return;
  }

  document.title = `${L(city.name)} — ${Data.settings.siteName || 'Karvon'}`;
  const places = placesInCity(city.id);
  const cityTours = toursInCity(city.id);
  const mapBox = el('div', { class: 'map map--tall' });
  const placesGrid = el('div', { class: 'grid grid--3', style: 'margin-top:26px' });
  const filterRow = el('div', { class: 'chip-row' });

  /* category filter, built only from categories actually present */
  const present = [...new Set(places.map((p) => p.category))];
  let activeFilter = 'all';

  function paintPlaces() {
    const list = activeFilter === 'all' ? places : places.filter((p) => p.category === activeFilter);
    placesGrid.replaceChildren(
      ...(list.length ? list.map(placeCard) : [emptyState('Nothing in this category yet.')])
    );
    observeReveals(placesGrid);
  }

  filterRow.replaceChildren(
    el(
      'button',
      { class: 'chip', type: 'button', 'aria-pressed': 'true', onclick: (e) => setFilter('all', e.currentTarget) },
      `${t('ui.all')} ${places.length}`
    ),
    ...present.map((cat) =>
      el(
        'button',
        { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => setFilter(cat, e.currentTarget) },
        categoryLabel(cat)
      )
    )
  );

  function setFilter(value, button) {
    activeFilter = value;
    $$('.chip', filterRow).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    paintPlaces();
  }

  main.replaceChildren(
    el(
      'section',
      { class: 'hero hero--short' },
      el('div', { class: 'hero__media' }, img(city.coverImage, L(city.name), { seed: city.id, eager: true })),
      el(
        'div',
        { class: 'shell hero__body' },
        el('p', { class: 'eyebrow', text: L(city.region) || 'Uzbekistan' }),
        el('h1', { class: 'd1', text: L(city.name) }),
        el('p', { class: 'lede', text: L(city.tagline) || '' }),
        el(
          'div',
          { class: 'hero__meta' },
          el('div', {}, el('span', { class: 'k', text: t('ui.stay') }), el('span', { class: 'v', text: days(city.recommendedDays || 1) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.places') }), el('span', { class: 'v', text: String(places.length) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.readyTours') }), el('span', { class: 'v', text: String(cityTours.length) }))
        )
      )
    ),

    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell split', style: 'display:grid;grid-template-columns:1.2fr 1fr;gap:clamp(28px,5vw,56px)' },
        el(
          'div',
          { class: 'reveal' },
          el('p', { class: 'eyebrow', text: t('city.theCity') }),
          el('p', { style: 'font-size:1.08rem', text: L(city.description) || '' }),
          L(city.travelInfo)
            ? el(
                'div',
                { style: 'margin-top:22px;padding:16px 18px;border-left:2px solid var(--saffron);background:rgba(227,165,62,.07)' },
                el('p', { class: 'eyebrow', style: 'margin-bottom:8px', text: t('city.gettingThere') }),
                el('p', { class: 'muted', style: 'font-size:.95rem', text: L(city.travelInfo) })
              )
            : null
        ),
        el(
          'div',
          { class: 'reveal' },
          (city.gallery || []).length
            ? buildGallery(city.gallery, L(city.name))
            : buildGallery([city.coverImage], L(city.name))
        )
      )
    ),

    el(
      'section',
      { class: 'section section--band' },
      el(
        'div',
        { class: 'shell' },
        sectionHead(t('city.whatToSee'), L(city.name), filterRow),
        places.length ? placesGrid : emptyState(t('state.noPlaces'), 'Browse other cities', BASE + 'cities.html')
      )
    ),

    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell' },
        sectionHead(t('city.onMap'), L(city.name)),
        mapBox
      )
    ),

    cityTours.length
      ? el(
          'section',
          { class: 'section section--band' },
          el(
            'div',
            { class: 'shell' },
            sectionHead(t('ui.readyTours'), t('city.toursHere')),
            el('div', { class: 'grid grid--3' }, cityTours.map(tourCard))
          )
        )
      : null,

    el(
      'section',
      { class: 'section section--tight' },
      el(
        'div',
        { class: 'shell', style: 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;justify-content:space-between' },
        el('h2', { class: 'd3', text: t('city.addToRoute') }),
        el('a', { class: 'btn', href: `${BASE}planner.html?cities=${city.id}`, text: t('home.plannerCta') })
      )
    )
  );

  if (places.length) paintPlaces();

  drawMap(
    mapBox,
    [
      { lat: city.latitude, lng: city.longitude, name: L(city.name), note: L(city.tagline) },
      ...places.map((p) => ({ lat: p.latitude, lng: p.longitude, name: L(p.name) })),
    ],
    { zoom: 13 }
  );

  if (location.hash.startsWith('#place=')) openPlace(decodeURIComponent(location.hash.slice(7)));
}

/* ---------- tours index ---------- */

function renderToursIndex() {
  const main = $('#main');
  const grid = el('div', { class: 'grid grid--3', style: 'margin-top:30px' });
  const cityRow = el('div', { class: 'chip-row' });
  const durationRow = el('div', { class: 'chip-row', style: 'margin-top:10px' });

  let cityFilter = 'all';
  let durationFilter = 'all';

  function paint() {
    const list = Data.tours.filter(
      (x) =>
        (cityFilter === 'all' || x.cityId === cityFilter) &&
        (durationFilter === 'all' || String(x.duration) === durationFilter)
    );
    grid.replaceChildren(
      ...(list.length ? list.map(tourCard) : [emptyState('No tours match those filters.', 'Clear filters', BASE + 'tours.html')])
    );
    observeReveals(grid);
  }

  const cityIdsWithTours = [...new Set(Data.tours.map((x) => x.cityId))];
  cityRow.replaceChildren(
    el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', onclick: (e) => pick('city', 'all', e.currentTarget) }, t('ui.allCities')),
    ...cityIdsWithTours.map((id) =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => pick('city', id, e.currentTarget) }, (cityById(id) || {}).name || id)
    )
  );
  durationRow.replaceChildren(
    el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', onclick: (e) => pick('duration', 'all', e.currentTarget) }, t('ui.anyLength')),
    ...['1', '2', '3'].map((d) =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => pick('duration', d, e.currentTarget) }, days(Number(d)))
    )
  );

  function pick(kind, value, button) {
    const row = kind === 'city' ? cityRow : durationRow;
    if (kind === 'city') cityFilter = value;
    else durationFilter = value;
    $$('.chip', row).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    paint();
  }

  main.replaceChildren(
    el(
      'section',
      { class: 'section', style: 'padding-top:calc(var(--nav-h) + 56px)' },
      el(
        'div',
        { class: 'shell' },
        el('p', { class: 'eyebrow', text: t('home.toursEyebrow') }),
        el('h1', { class: 'd2', text: t('tours.title') }),
        el('p', { class: 'lede', style: 'margin-top:14px', text: t('tours.intro') }),
        el('div', { style: 'margin-top:26px' }, cityRow, durationRow),
        Data.tours.length ? grid : emptyState(t('state.noTours'), 'Plan a route instead', BASE + 'planner.html')
      )
    )
  );

  if (Data.tours.length) paint();
}

/* ---------- tour detail ---------- */

function renderTour() {
  const main = $('#main');
  const tour = tourById(qs('id'));

  if (!tour) {
    main.replaceChildren(
      el('div', { class: 'shell', style: 'padding:calc(var(--nav-h) + 80px) 0 80px' }, emptyState('That tour is no longer listed.', 'See all tours', BASE + 'tours.html'))
    );
    document.body.dataset.nav = 'solid';
    return;
  }

  document.title = `${L(tour.title)} — ${Data.settings.siteName || 'Karvon'}`;
  const city = cityById(tour.cityId);
  const allPlaceIds = (tour.days || []).flatMap((d) => d.placeIds || []);
  const galleryImages = allPlaceIds.flatMap((id) => ((placeById(id) || {}).images || []).slice(0, 2)).slice(0, 10);
  const mapBox = el('div', { class: 'map' });

  const dayBlocks = (tour.days || []).map((day, i) =>
    el(
      'div',
      { class: 'day reveal' },
      el(
        'div',
        { class: 'day__head' },
        el('span', { class: 'day__num', text: `Day ${i + 1}` }),
        el('span', { class: 'day__title', text: L(day.title) || '' })
      ),
      el(
        'div',
        { class: 'day__list' },
        (day.placeIds || []).map((pid) => {
          const place = placeById(pid);
          if (!place) return null;
          return el(
            'div',
            { class: 'day__item' },
            img((place.images || [])[0], L(place.name), { seed: pid }),
            el(
              'div',
              { style: 'flex:1' },
              el('strong', { text: L(place.name) }),
              el('p', { text: L(place.shortDescription) || '' }),
              el(
                'button',
                { class: 'textlink', type: 'button', style: 'background:none;border:0;padding:0;margin-top:6px;cursor:pointer', onclick: () => openPlace(pid) },
                t('ui.details')
              )
            ),
            el('span', { class: 'data muted', text: fmtDuration(place.visitDuration) })
          );
        })
      ),
      L(day.note) ? el('p', { class: 'day__note', text: L(day.note) }) : null
    )
  );

  main.replaceChildren(
    el(
      'section',
      { class: 'hero hero--short' },
      el('div', { class: 'hero__media' }, img(tour.coverImage, L(tour.title), { seed: tour.id, eager: true })),
      el(
        'div',
        { class: 'shell hero__body' },
        el('p', { class: 'eyebrow', text: city ? `${L(city.name)} · ${t('home.toursEyebrow')}` : t('home.toursEyebrow') }),
        el('h1', { class: 'd1', style: 'font-size:clamp(2.1rem,5vw,3.6rem)', text: L(tour.title) }),
        el('p', { class: 'lede', text: L(tour.description) || '' }),
        el(
          'div',
          { class: 'hero__meta' },
          el('div', {}, el('span', { class: 'k', text: t('ui.timeNeeded') }), el('span', { class: 'v', text: days(tour.duration || 1) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.places') }), el('span', { class: 'v', text: String(allPlaceIds.length) })),
          el('div', {}, el('span', { class: 'k', text: t('ui.city') }), el('span', { class: 'v', text: city ? L(city.name) : '—' }))
        )
      )
    ),

    el(
      'section',
      { class: 'section' },
      el(
        'div',
        { class: 'shell split', style: 'display:grid;grid-template-columns:1.35fr 1fr;gap:clamp(28px,5vw,56px);align-items:start' },
        el('div', {}, sectionHead(t('tour.dayByDay'), t('tour.itinerary')), dayBlocks.length ? dayBlocks : emptyState('This tour has no days yet.')),
        el(
          'div',
          { class: 'reveal' },
          L(tour.notes)
            ? el(
                'div',
                { style: 'padding:18px 20px;border:1px solid var(--line);border-radius:8px;background:var(--lapis-800)' },
                el('p', { class: 'eyebrow', style: 'margin-bottom:10px', text: t('tour.goodToKnow') }),
                el('p', { class: 'muted', style: 'font-size:.95rem', text: L(tour.notes) })
              )
            : null,
          el('div', { style: 'margin-top:16px' }, mapBox),
          el(
            'div',
            { style: 'margin-top:16px;padding:20px;border:1px solid var(--line);border-radius:8px;background:var(--lapis-800)' },
            el('h3', { class: 'd4', text: t('tour.book') }),
            el('p', { class: 'muted', style: 'font-size:.93rem;margin-top:6px', text: t('tour.bookBody') }),
            el('a', { class: 'btn btn--block', style: 'margin-top:14px', href: BASE + 'contact.html', text: t('nav.contact') })
          )
        )
      )
    ),

    galleryImages.length
      ? el(
          'section',
          { class: 'section section--band' },
          el('div', { class: 'shell' }, sectionHead(t('tour.photos'), t('tour.photosSub')), buildGallery(galleryImages, L(tour.title)))
        )
      : null
  );

  drawMap(
    mapBox,
    allPlaceIds
      .map((id) => placeById(id))
      .filter(Boolean)
      .map((p) => ({ lat: p.latitude, lng: p.longitude, name: L(p.name) })),
    { line: true }
  );
}

/* ---------- contact ---------- */

function contactGrid() {
  const c = Data.settings.contact || {};
  const cards = [];

  if (c.telegram && (c.telegram.username || c.telegram.url)) {
    cards.push(
      el(
        'a',
        { class: 'contact-card reveal', href: c.telegram.url || `https://t.me/${c.telegram.username}`, target: '_blank', rel: 'noopener' },
        el('span', { class: 'contact-card__k', text: 'Telegram' }),
        el('span', { class: 'contact-card__v', text: `@${c.telegram.username || ''}` }),
        el('span', { class: 'contact-card__note', text: t('contact.telegramNote') })
      )
    );
  }

  if (c.wechat && (c.wechat.id || c.wechat.qrImage)) {
    const qrNode = c.wechat.qrImage
      ? el(
          'button',
          {
            class: 'qr',
            type: 'button',
            style: 'background:none;border:0;padding:0;cursor:zoom-in',
            'aria-label': 'Enlarge the WeChat QR code',
            onclick: (e) => {
              e.preventDefault();
              Lightbox.open([c.wechat.qrImage], 0, `WeChat · ${c.wechat.id || ''}`);
            },
          },
          img(c.wechat.qrImage, 'WeChat QR code', { seed: 'wechat' }),
          el('span', { class: 'contact-card__note', text: t('contact.tapQr') })
        )
      : null;

    cards.push(
      el(
        'div',
        { class: 'contact-card reveal' },
        el('span', { class: 'contact-card__k', text: 'WeChat' }),
        el('span', { class: 'contact-card__v', text: c.wechat.id || '' }),
        L(c.wechat.name) ? el('span', { class: 'contact-card__note', text: L(c.wechat.name) }) : null,
        qrNode
      )
    );
  }

  if (c.phone && c.phone.number) {
    cards.push(
      el(
        'a',
        { class: 'contact-card reveal', href: `tel:${c.phone.number}` },
        el('span', { class: 'contact-card__k', text: 'Phone' }),
        el('span', { class: 'contact-card__v', text: c.phone.display || c.phone.number }),
        el('span', { class: 'contact-card__note', text: t('contact.phoneNote') })
      )
    );
  }

  if (!cards.length) return emptyState('No contact details have been added yet.');
  return el('div', { class: 'contact-grid' }, cards);
}

function renderContact() {
  const main = $('#main');
  const s = Data.settings;
  const c = s.contact || {};
  const mapBox = el('div', { class: 'map' });

  main.replaceChildren(
    el(
      'section',
      { class: 'section', style: 'padding-top:calc(var(--nav-h) + 56px)' },
      el(
        'div',
        { class: 'shell' },
        el('p', { class: 'eyebrow', text: t('nav.contact') }),
        el('h1', { class: 'd2', text: t('contact.getInTouch') }),
        el('p', { class: 'lede', style: 'margin-top:14px', text: L(s.aboutBlurb) || '' }),
        el('div', { style: 'margin-top:34px' }, contactGrid()),
        el(
          'div',
          { class: 'split',
            style: 'display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,4vw,44px);margin-top:44px;align-items:start' },
          el(
            'div',
            { class: 'reveal' },
            el('p', { class: 'eyebrow', text: t('contact.office') }),
            el('p', { style: 'font-size:1.05rem', text: L(c.address) || '' }),
            L(c.hours) ? el('p', { class: 'muted', text: L(c.hours) }) : null,
            c.email ? el('p', {}, el('a', { class: 'textlink', href: `mailto:${c.email}`, text: c.email })) : null,
            el('p', { class: 'muted', style: 'margin-top:18px;font-size:.95rem', text: L(s.companyDescription) || '' })
          ),
          mapBox
        )
      )
    )
  );

  const office = Data.cities.find((x) => x.id === 'samarkand') || Data.cities[0];
  if (office) drawMap(mapBox, [{ lat: office.latitude, lng: office.longitude, name: s.siteName || 'Office', note: L(c.address) }], { zoom: 13 });
}

/* ---------- dispatch ---------- */

const PAGES = {
  home: renderHome,
  cities: renderCitiesIndex,
  city: renderCity,
  tours: renderToursIndex,
  tour: renderTour,
  contact: renderContact,
  planner: () => renderPlanner(), // defined in planner.js
};

boot(async () => {
  const page = document.body.dataset.page;
  const render = PAGES[page];
  if (render) await render();
});
