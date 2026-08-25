/* ============================================================
   Karvon — admin.js
   Everything the admin edits lives in one working copy in
   localStorage. Nothing reaches the live site until Publish.
   ============================================================ */

const Draft = { cities: [], places: [], tours: [], settings: {} };
let dirty = false;
let section = 'dashboard';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'cities', label: 'Cities', count: () => Draft.cities.length },
  { id: 'places', label: 'Places', count: () => Draft.places.length },
  { id: 'tours', label: 'Tours', count: () => Draft.tours.length },
  { id: 'settings', label: 'Contact & settings' },
  { id: 'publish', label: 'Publish' },
];

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';

function uniqueId(base, list) {
  let id = slugify(base);
  let n = 2;
  while (list.some((x) => x.id === id)) id = `${slugify(base)}-${n++}`;
  return id;
}

/* ---------- draft persistence ---------- */

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(Draft));
    dirty = true;
    paintStatus();
  } catch (_) {
    toast('Browser storage is full — publish or download now.', true);
  }
}

async function loadDraft() {
  const stored = localStorage.getItem(DRAFT_KEY);
  if (stored) {
    try {
      Object.assign(Draft, JSON.parse(stored));
      dirty = true;
      return;
    } catch (_) {
      /* corrupt draft — fall back to the published files */
    }
  }
  await loadData();
  Object.assign(Draft, {
    cities: structuredClone(Data.cities),
    places: structuredClone(Data.places),
    tours: structuredClone(Data.tours),
    settings: structuredClone(Data.settings),
  });
  dirty = false;
}

/* Data lookups used by shared helpers from core.js */
function refreshDataMirror() {
  Object.assign(Data, {
    cities: Draft.cities,
    places: Draft.places,
    tours: Draft.tours,
    settings: Draft.settings,
  });
}

/* ---------- small form helpers ---------- */

function field(label, value, onInput, opts = {}) {
  const { type = 'text', hint = '', rows = 0, options = null, min, max, step, placeholder = '' } = opts;

  let control;
  if (options) {
    // A select always yields a string; restore the number when the
    // option values were numbers, or comparisons downstream break.
    const numeric = options.every((o) => typeof o.value === 'number');
    control = el(
      'select',
      { class: 'select', onchange: (e) => onInput(numeric ? Number(e.target.value) : e.target.value) },
      options.map((o) => el('option', { value: o.value, selected: String(o.value) === String(value) }, o.label))
    );
  } else if (rows) {
    control = el('textarea', {
      class: 'textarea',
      rows: String(rows),
      placeholder,
      oninput: (e) => onInput(e.target.value),
    });
    control.value = value == null ? '' : value;
  } else {
    control = el('input', {
      class: 'input',
      type,
      placeholder,
      min,
      max,
      step,
      value: value == null ? '' : value,
      oninput: (e) => onInput(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
    });
  }

  return el('label', { class: 'field' }, el('span', { text: label }), control, hint ? el('span', { class: 'hint', text: hint }) : null);
}

/**
 * A text field with one input per site language. Content is stored as
 * { en: "…", zh: "…" } so the same record serves both audiences; the
 * public site falls back to English when a translation is missing.
 */
function mlField(label, holder, key, opts = {}) {
  const langs = Draft.settings.languages || [{ code: 'en', label: 'English' }];
  if (typeof holder[key] === 'string' || holder[key] == null) {
    holder[key] = { en: holder[key] || '' };
  }

  const inputs = langs.map((lang) => {
    const control = opts.rows
      ? el('textarea', { class: 'textarea', rows: String(opts.rows), placeholder: opts.placeholder || '' })
      : el('input', { class: 'input', type: 'text', placeholder: opts.placeholder || '' });
    control.value = holder[key][lang.code] || '';
    control.addEventListener('input', (e) => {
      holder[key][lang.code] = e.target.value;
      if (opts.onInput) opts.onInput();
      saveDraft();
    });
    return el(
      'div',
      { class: 'ml-field__row' },
      el('span', { class: 'ml-field__tag', text: lang.label }),
      control
    );
  });

  return el(
    'div',
    { class: 'field ml-field' },
    el('span', { class: 'label', text: label }),
    ...inputs,
    opts.hint ? el('span', { class: 'hint', text: opts.hint }) : null
  );
}

function panel(title, hint, ...children) {
  return el('section', { class: 'adm-panel' }, el('h2', { text: title }), hint ? el('p', { class: 'hint', text: hint }) : null, ...children);
}

function confirmDelete(what) {
  return window.confirm(`Delete ${what}? This cannot be undone from here, though the published site keeps it until you publish again.`);
}

/* ---------- image editor (1–10 images, reorder, upload) ---------- */

/** A single cover image is edited with the same widget as a gallery. */
function coverAsList(holder, key) {
  const proxy = holder[key] ? [holder[key]] : [];
  proxy.commit = () => { holder[key] = proxy[0] || ''; };
  return proxy;
}

function imageEditor(list, onChange, folder, max = 10) {
  const wrap = el('div', { class: 'imgs' });

  function paint() {
    const grid = el(
      'div',
      { class: 'imgs__grid' },
      list.map((entry, i) => {
        const creditInput = el('input', {
          class: 'input imgs__credit',
          type: 'text',
          placeholder: 'Photo credit (optional)',
          oninput: (e) => {
            if (typeof list[i] === 'string') list[i] = { src: list[i] };
            list[i].credit = e.target.value;
            onChange(list);
            if (list.commit) list.commit();
            saveDraft();
          },
        });
        creditInput.value = imgCredit(entry);
        return el(
          'div',
          { class: 'imgs__cell' },
          img(entry, `Image ${i + 1}`, { seed: imgSrc(entry) }),
          el('span', { class: 'imgs__num', text: String(i + 1) }),
          el(
            'div',
            { class: 'imgs__bar' },
            el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move left', disabled: i === 0, onclick: () => swap(i, i - 1) }, '←'),
            el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move right', disabled: i === list.length - 1, onclick: () => swap(i, i + 1) }, '→'),
            el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove image', onclick: () => remove(i) }, '✕')
          ),
          creditInput
        );
      })
    );

    const urlInput = el('input', { class: 'input', type: 'url', placeholder: 'Paste an image URL and press Add' });
    const fileInput = el('input', {
      type: 'file',
      accept: 'image/*',
      multiple: true,
      style: 'display:none',
      onchange: (e) => upload(Array.from(e.target.files || [])),
    });

    const adder = el(
      'div',
      { class: 'imgs__add' },
      urlInput,
      el(
        'button',
        {
          class: 'btn btn--sm btn--ghost',
          type: 'button',
          onclick: () => {
            const v = urlInput.value.trim();
            if (!v) return;
            if (list.length >= max) return toast(`That is the limit of ${max} images.`, true);
            list.push({ src: v, credit: '' });
            urlInput.value = '';
            commit();
          },
        },
        'Add URL'
      ),
      el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => fileInput.click() }, 'Upload file'),
      fileInput,
      el('span', { class: 'hint', text: `${list.length} of ${max}` })
    );

    wrap.replaceChildren(list.length ? grid : el('p', { class: 'hint', text: 'No images yet. Add at least one.' }), adder);
  }

  async function upload(files) {
    if (!files.length) return;
    if (!GitHubStore.connected) {
      toast('Connect GitHub on the Publish tab to upload files, or paste a URL.', true);
      return;
    }
    const room = max - list.length;
    if (room <= 0) return toast(`That is the limit of ${max} images.`, true);

    for (const file of files.slice(0, room)) {
      try {
        toast(`Uploading ${file.name}…`);
        const path = await ghUploadImage(file, folder);
        list.push({ src: path, credit: '' });
        commit();
      } catch (err) {
        toast(err.message, true);
        break;
      }
    }
    toast('Images uploaded and committed.');
  }

  function swap(a, b) {
    [list[a], list[b]] = [list[b], list[a]];
    commit();
  }
  function remove(i) {
    list.splice(i, 1);
    commit();
  }
  function commit() {
    if (list.commit) list.commit();
    onChange(list);
    paint();
  }

  paint();
  return wrap;
}

/* ---------- dashboard ---------- */

function viewDashboard() {
  const totalImages =
    Draft.places.reduce((n, p) => n + (p.images || []).length, 0) +
    Draft.cities.reduce((n, c) => n + (c.gallery || []).length + (c.coverImage ? 1 : 0), 0) +
    Draft.tours.reduce((n, x) => n + (x.coverImage ? 1 : 0), 0);

  const orphans = Draft.places.filter((p) => !Draft.cities.some((c) => c.id === p.cityId));
  const emptyCities = Draft.cities.filter((c) => !Draft.places.some((p) => p.cityId === c.id));

  return el(
    'div',
    {},
    el(
      'div',
      { class: 'adm-stats' },
      el('div', { class: 'adm-stat' }, el('span', { class: 'k', text: 'Cities' }), el('div', { class: 'v', text: String(Draft.cities.length) })),
      el('div', { class: 'adm-stat' }, el('span', { class: 'k', text: 'Places' }), el('div', { class: 'v', text: String(Draft.places.length) })),
      el('div', { class: 'adm-stat' }, el('span', { class: 'k', text: 'Tours' }), el('div', { class: 'v', text: String(Draft.tours.length) })),
      el('div', { class: 'adm-stat' }, el('span', { class: 'k', text: 'Images' }), el('div', { class: 'v', text: String(totalImages) }))
    ),

    panel(
      'What needs attention',
      'Checks that run against your working copy.',
      el(
        'div',
        { style: 'display:grid;gap:10px' },
        orphans.length
          ? el('div', { class: 'adm-note adm-note--bad' }, el('strong', {}, `${orphans.length} place(s) point at a city that no longer exists: `), orphans.map((p) => L(p.name)).join(', '))
          : el('div', { class: 'adm-note adm-note--ok' }, 'Every place belongs to a city that exists.'),
        emptyCities.length
          ? el('div', { class: 'adm-note' }, el('strong', {}, 'Cities with no places yet: '), emptyCities.map((c) => L(c.name)).join(', '))
          : el('div', { class: 'adm-note adm-note--ok' }, 'Every city has at least one place.'),
        Draft.tours.some((x) => !(x.days || []).length)
          ? el('div', { class: 'adm-note' }, 'Some tours have no days yet. They will show an empty itinerary.')
          : null,
        (() => {
          const noPhoto = Draft.places.filter((p) => !(p.images || []).length);
          return noPhoto.length
            ? el('div', { class: 'adm-note' }, el('strong', {}, 'Places with no photograph yet: '), noPhoto.map((p) => L(p.name)).join(', '))
            : el('div', { class: 'adm-note adm-note--ok' }, 'Every place has at least one photograph.');
        })(),
        (() => {
          const stock = Draft.places.filter((p) => (p.images || []).some((i) => imgSrc(i).includes('wikimedia')));
          return stock.length
            ? el('div', { class: 'adm-note' }, el('strong', {}, `${stock.length} place(s) still use stock photography. `),
                'Replacing these with your own photographs is the single biggest improvement you can make to this site.')
            : null;
        })()
      )
    ),

    panel(
      'How this works',
      '',
      el(
        'div',
        { class: 'adm-note' },
        'Your edits are saved in this browser as you type. Nothing changes on the live site until you press ',
        el('strong', {}, 'Publish to GitHub'),
        '. Use ',
        el('strong', {}, 'Preview the site'),
        ' to walk through the real pages with your unpublished changes first.'
      )
    )
  );
}

/* ---------- cities ---------- */

function viewCities() {
  const list = el('div', { class: 'adm-list' });
  const formBox = el('div', {});

  function paintList() {
    list.replaceChildren(
      ...(Draft.cities.length
        ? Draft.cities.map((city, i) =>
            el(
              'div',
              { class: 'adm-item' },
              img(city.coverImage, '', { seed: city.id }),
              el(
                'div',
                { class: 'adm-item__main' },
                el('strong', { text: L(city.name) || '(untitled)' }),
                el('span', { text: `${city.id} · ${city.recommendedDays || 1}d · ${Draft.places.filter((p) => p.cityId === city.id).length} places` })
              ),
              el(
                'div',
                { class: 'adm-item__btns' },
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { [Draft.cities[i], Draft.cities[i - 1]] = [Draft.cities[i - 1], Draft.cities[i]]; saveDraft(); paintList(); } }, '↑'),
                el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: i === Draft.cities.length - 1, onclick: () => { [Draft.cities[i], Draft.cities[i + 1]] = [Draft.cities[i + 1], Draft.cities[i]]; saveDraft(); paintList(); } }, '↓'),
                el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => openForm(city) }, 'Edit'),
                el(
                  'button',
                  {
                    class: 'btn btn--sm btn--danger',
                    type: 'button',
                    onclick: () => {
                      const attached = Draft.places.filter((p) => p.cityId === city.id).length;
                      if (!confirmDelete(`${L(city.name)}${attached ? ` and leave ${attached} place(s) orphaned` : ''}`)) return;
                      Draft.cities.splice(i, 1);
                      saveDraft();
                      paintList();
                      formBox.replaceChildren();
                    },
                  },
                  'Delete'
                )
              )
            )
          )
        : [el('p', { class: 'hint', text: 'No cities yet. Add the first one.' })])
    );
  }

  function openForm(existing) {
    const isNew = !existing;
    const city = existing || {
      id: '',
      name: '',
      region: '',
      tagline: '',
      description: '',
      coverImage: '',
      gallery: [],
      latitude: 41.3,
      longitude: 69.2,
      recommendedDays: 2,
      travelInfo: '',
    };
    const set = (key) => (v) => {
      city[key] = v;
      if (!isNew) saveDraft();
    };

    formBox.replaceChildren(
      panel(
        isNew ? 'New city' : `Editing ${L(city.name)}`,
        'Coordinates drive the route planner, so they matter more here than anywhere else.',
        el(
          'div',
          { class: 'adm-form' },
          mlField('Name', city, 'name', { placeholder: 'Samarkand' }),
          mlField('Region', city, 'region', { placeholder: 'Samarqand Region' }),
          mlField('Tagline', city, 'tagline', { hint: 'One line, shown on the card over the photo.' }),
          mlField('Description', city, 'description', { rows: 5 }),
          el(
            'div',
            { class: 'adm-row adm-row--3' },
            field('Latitude', city.latitude, set('latitude'), { type: 'number', step: '0.0001' }),
            field('Longitude', city.longitude, set('longitude'), { type: 'number', step: '0.0001' }),
            field('Recommended days', city.recommendedDays, set('recommendedDays'), { type: 'number', min: '1', max: '10' })
          ),
          mlField('Travel information', city, 'travelInfo', { rows: 3, hint: 'How travellers get here and move on.' }),
          el('div', { class: 'field' }, el('span', { class: 'label', text: 'Cover image' }), imageEditor(coverAsList(city, 'coverImage'), () => saveDraft(), 'cities', 1)),
          el('div', { class: 'field' }, el('span', { class: 'label', text: 'Gallery' }), imageEditor(city.gallery || (city.gallery = []), () => saveDraft(), 'cities')),
          el(
            'div',
            { class: 'adm-actions' },
            isNew
              ? el(
                  'button',
                  {
                    class: 'btn',
                    type: 'button',
                    onclick: () => {
                      if (!L(city.name).trim()) return toast('Give the city a name first.', true);
                      city.id = uniqueId(L(city.name), Draft.cities);
                      Draft.cities.push(city);
                      saveDraft();
                      paintList();
                      openForm(city);
                      toast(`${L(city.name)} added.`);
                    },
                  },
                  'Add city'
                )
              : el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => formBox.replaceChildren() }, 'Close'),
            !isNew ? el('span', { class: 'hint', style: 'align-self:center', text: 'Changes save as you type.' }) : null
          )
        )
      )
    );
  }

  paintList();

  return el(
    'div',
    {},
    panel('Cities', 'The route planner uses this list. Order here is the order shown on the site.', list,
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn btn--sm', type: 'button', onclick: () => openForm(null) }, 'Add a city'))),
    formBox
  );
}

/* ---------- places ---------- */

function viewPlaces() {
  const list = el('div', { class: 'adm-list' });
  const formBox = el('div', {});
  let filter = 'all';

  const filterRow = el(
    'div',
    { class: 'chip-row', style: 'margin-bottom:14px' },
    el('button', { class: 'chip', type: 'button', 'aria-pressed': 'true', onclick: (e) => setFilter('all', e.currentTarget) }, 'All'),
    ...Draft.cities.map((c) =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: (e) => setFilter(c.id, e.currentTarget) }, L(c.name))
    )
  );

  function setFilter(value, button) {
    filter = value;
    $$('.chip', filterRow).forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    paintList();
  }

  function paintList() {
    const shown = filter === 'all' ? Draft.places : Draft.places.filter((p) => p.cityId === filter);
    list.replaceChildren(
      ...(shown.length
        ? shown.map((place) =>
            el(
              'div',
              { class: 'adm-item' },
              img((place.images || [])[0], '', { seed: place.id }),
              el(
                'div',
                { class: 'adm-item__main' },
                el('strong', { text: L(place.name) || '(untitled)' }),
                el('span', { text: `${L((Draft.cities.find((c) => c.id === place.cityId) || {}).name) || '⚠ no city'} · ${categoryLabel(place.category)} · ${(place.images || []).length} images` })
              ),
              el(
                'div',
                { class: 'adm-item__btns' },
                el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => openForm(place) }, 'Edit'),
                el(
                  'button',
                  {
                    class: 'btn btn--sm btn--danger',
                    type: 'button',
                    onclick: () => {
                      if (!confirmDelete(L(place.name))) return;
                      Draft.places.splice(Draft.places.indexOf(place), 1);
                      Draft.tours.forEach((tour) =>
                        (tour.days || []).forEach((d) => {
                          d.placeIds = (d.placeIds || []).filter((id) => id !== place.id);
                        })
                      );
                      saveDraft();
                      paintList();
                      formBox.replaceChildren();
                    },
                  },
                  'Delete'
                )
              )
            )
          )
        : [el('p', { class: 'hint', text: 'No places here yet.' })])
    );
  }

  function openForm(existing) {
    const isNew = !existing;
    const place = existing || {
      id: '',
      cityId: filter !== 'all' ? filter : (Draft.cities[0] || {}).id || '',
      name: '',
      category: 'historical',
      shortDescription: '',
      description: '',
      address: '',
      latitude: 0,
      longitude: 0,
      visitDuration: 60,
      images: [],
    };
    const set = (key) => (v) => {
      place[key] = v;
      if (!isNew) saveDraft();
    };

    formBox.replaceChildren(
      panel(
        isNew ? 'New place' : `Editing ${L(place.name)}`,
        'Between one and ten images. The first one is used on cards.',
        el(
          'div',
          { class: 'adm-form' },
          el(
            'div',
            { class: 'adm-row' },
            field('City', place.cityId, set('cityId'), { options: Draft.cities.map((c) => ({ value: c.id, label: L(c.name) })) }),
            field('Category', place.category, set('category'), {
              options: (Draft.settings.categories || []).map((c) => ({ value: c.id, label: c.label })),
            })
          ),
          mlField('Name', place, 'name', { placeholder: 'Registan Square' }),
          mlField('Short description', place, 'shortDescription', { rows: 2, hint: 'One sentence, shown on the card.' }),
          mlField('Full description', place, 'description', { rows: 6 }),
          field('Address', place.address, set('address')),
          el(
            'div',
            { class: 'adm-row adm-row--3' },
            field('Latitude', place.latitude, set('latitude'), { type: 'number', step: '0.0001' }),
            field('Longitude', place.longitude, set('longitude'), { type: 'number', step: '0.0001' }),
            field('Visit duration (minutes)', place.visitDuration, set('visitDuration'), { type: 'number', min: '5', step: '5' })
          ),
          el('div', { class: 'field' }, el('span', { class: 'label', text: 'Images (1–10)' }), imageEditor(place.images || (place.images = []), () => saveDraft(), 'places')),
          el(
            'div',
            { class: 'adm-actions' },
            isNew
              ? el(
                  'button',
                  {
                    class: 'btn',
                    type: 'button',
                    onclick: () => {
                      if (!L(place.name).trim()) return toast('Give the place a name first.', true);
                      if (!place.cityId) return toast('Add a city before adding places.', true);
                      place.id = uniqueId(L(place.name), Draft.places);
                      Draft.places.push(place);
                      saveDraft();
                      paintList();
                      openForm(place);
                      toast(`${L(place.name)} added.`);
                    },
                  },
                  'Add place'
                )
              : el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => formBox.replaceChildren() }, 'Close'),
            !isNew ? el('span', { class: 'hint', style: 'align-self:center', text: 'Changes save as you type.' }) : null
          )
        )
      )
    );
  }

  paintList();

  return el(
    'div',
    {},
    panel('Places', 'Everything travellers can open from a city page.', filterRow, list,
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn btn--sm', type: 'button', onclick: () => openForm(null) }, 'Add a place'))),
    formBox
  );
}

/* ---------- tours ---------- */

function viewTours() {
  const list = el('div', { class: 'adm-list' });
  const formBox = el('div', {});

  function paintList() {
    list.replaceChildren(
      ...(Draft.tours.length
        ? Draft.tours.map((tour) =>
            el(
              'div',
              { class: 'adm-item' },
              img(tour.coverImage, '', { seed: tour.id }),
              el(
                'div',
                { class: 'adm-item__main' },
                el('strong', { text: L(tour.title) || '(untitled)' }),
                el('span', { text: `${L((Draft.cities.find((c) => c.id === tour.cityId) || {}).name) || '⚠ no city'} · ${tour.duration || 1}d · ${(tour.days || []).reduce((n, d) => n + (d.placeIds || []).length, 0)} stops` })
              ),
              el(
                'div',
                { class: 'adm-item__btns' },
                el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => openForm(tour) }, 'Edit'),
                el(
                  'button',
                  {
                    class: 'btn btn--sm btn--danger',
                    type: 'button',
                    onclick: () => {
                      if (!confirmDelete(L(tour.title))) return;
                      Draft.tours.splice(Draft.tours.indexOf(tour), 1);
                      saveDraft();
                      paintList();
                      formBox.replaceChildren();
                    },
                  },
                  'Delete'
                )
              )
            )
          )
        : [el('p', { class: 'hint', text: 'No tours yet.' })])
    );
  }

  function openForm(existing) {
    const isNew = !existing;
    const tour = existing || {
      id: '',
      title: '',
      cityId: (Draft.cities[0] || {}).id || '',
      duration: 1,
      coverImage: '',
      description: '',
      notes: '',
      days: [{ title: '', placeIds: [], note: '' }],
    };
    const set = (key) => (v) => {
      tour[key] = v;
      if (!isNew) saveDraft();
      if (key === 'cityId') paintDays();
    };

    const daysBox = el('div', {});

    function paintDays() {
      const cityPlaces = Draft.places.filter((p) => p.cityId === tour.cityId);

      daysBox.replaceChildren(
        ...(tour.days || []).map((day, di) =>
          el(
            'div',
            { class: 'adm-day' },
            el(
              'div',
              { class: 'adm-day__head' },
              el('span', { class: 'data', style: 'color:var(--saffron)', text: `Day ${di + 1}` }),
              el('div', { style: 'flex:1' }, mlField('', day, 'title', { placeholder: 'What this day is about' })),
              el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move day up', disabled: di === 0, onclick: () => { [tour.days[di], tour.days[di - 1]] = [tour.days[di - 1], tour.days[di]]; saveDraft(); paintDays(); } }, '↑'),
              el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move day down', disabled: di === tour.days.length - 1, onclick: () => { [tour.days[di], tour.days[di + 1]] = [tour.days[di + 1], tour.days[di]]; saveDraft(); paintDays(); } }, '↓'),
              el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove day', onclick: () => { tour.days.splice(di, 1); saveDraft(); paintDays(); } }, '✕')
            ),

            /* chosen stops, in order */
            el(
              'div',
              { class: 'order-list', style: 'margin-bottom:10px' },
              (day.placeIds || []).map((pid, pi) => {
                const place = Draft.places.find((p) => p.id === pid);
                return el(
                  'div',
                  { class: 'order-item' },
                  el('span', { class: 'data', style: 'color:var(--glaze)', text: String(pi + 1).padStart(2, '0') }),
                  el('span', { class: 'order-item__name', text: place ? L(place.name) : `⚠ missing (${pid})` }),
                  el(
                    'span',
                    { class: 'order-item__btns' },
                    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: pi === 0, onclick: () => { [day.placeIds[pi], day.placeIds[pi - 1]] = [day.placeIds[pi - 1], day.placeIds[pi]]; saveDraft(); paintDays(); } }, '↑'),
                    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: pi === day.placeIds.length - 1, onclick: () => { [day.placeIds[pi], day.placeIds[pi + 1]] = [day.placeIds[pi + 1], day.placeIds[pi]]; saveDraft(); paintDays(); } }, '↓'),
                    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove stop', onclick: () => { day.placeIds.splice(pi, 1); saveDraft(); paintDays(); } }, '✕')
                  )
                );
              })
            ),

            /* available stops in this city */
            cityPlaces.length
              ? el(
                  'div',
                  { class: 'adm-picks' },
                  cityPlaces
                    .filter((p) => !(day.placeIds || []).includes(p.id))
                    .map((p) =>
                      el(
                        'button',
                        {
                          class: 'chip',
                          type: 'button',
                          onclick: () => {
                            day.placeIds = day.placeIds || [];
                            day.placeIds.push(p.id);
                            saveDraft();
                            paintDays();
                          },
                        },
                        `+ ${L(p.name)}`
                      )
                    )
                )
              : el('p', { class: 'hint', text: 'This city has no places yet — add some first.' }),

            el('div', { style: 'margin-top:10px' }, mlField('Note for this day', day, 'note', { rows: 2 }))
          )
        ),
        el(
          'div',
          { class: 'adm-actions' },
          el(
            'button',
            {
              class: 'btn btn--sm btn--ghost',
              type: 'button',
              onclick: () => {
                if ((tour.days || []).length >= 3) return toast('A city tour runs one to three days.', true);
                tour.days = tour.days || [];
                tour.days.push({ title: '', placeIds: [], note: '' });
                tour.duration = tour.days.length;
                saveDraft();
                paintDays();
              },
            },
            'Add a day'
          ),
          el('span', { class: 'hint', style: 'align-self:center', text: 'One to three days, one city.' })
        )
      );
    }

    formBox.replaceChildren(
      panel(
        isNew ? 'New tour' : `Editing ${L(tour.title)}`,
        'A ready tour stays inside a single city.',
        el(
          'div',
          { class: 'adm-form' },
          mlField('Title', tour, 'title', { placeholder: 'Samarkand in Two Days' }),
          el(
            'div',
            { class: 'adm-row' },
            field('City', tour.cityId, set('cityId'), { options: Draft.cities.map((c) => ({ value: c.id, label: L(c.name) })) }),
            field('Length in days', tour.duration, set('duration'), { options: [1, 2, 3].map((d) => ({ value: d, label: `${d} day${d > 1 ? 's' : ''}` })) })
          ),
          el('div', { class: 'field' }, el('span', { class: 'label', text: 'Cover image' }), imageEditor(coverAsList(tour, 'coverImage'), () => saveDraft(), 'tours', 1)),
          mlField('Description', tour, 'description', { rows: 4 }),
          mlField('Good to know', tour, 'notes', { rows: 3 }),
          el('div', { class: 'field' }, el('span', { class: 'label', text: 'Itinerary' }), daysBox),
          el(
            'div',
            { class: 'adm-actions' },
            isNew
              ? el(
                  'button',
                  {
                    class: 'btn',
                    type: 'button',
                    onclick: () => {
                      if (!L(tour.title).trim()) return toast('Give the tour a title first.', true);
                      tour.id = uniqueId(L(tour.title), Draft.tours);
                      Draft.tours.push(tour);
                      saveDraft();
                      paintList();
                      openForm(tour);
                      toast(`${L(tour.title)} added.`);
                    },
                  },
                  'Add tour'
                )
              : el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => formBox.replaceChildren() }, 'Close'),
            !isNew ? el('span', { class: 'hint', style: 'align-self:center', text: 'Changes save as you type.' }) : null
          )
        )
      )
    );

    paintDays();
  }

  paintList();

  return el(
    'div',
    {},
    panel('Ready tours', 'One to three days, always within one city.', list,
      el('div', { class: 'adm-actions' }, el('button', { class: 'btn btn--sm', type: 'button', onclick: () => openForm(null) }, 'Add a tour'))),
    formBox
  );
}

/* ---------- settings & contact ---------- */

function viewSettings() {
  const s = Draft.settings;
  s.contact = s.contact || {};
  s.contact.wechat = s.contact.wechat || {};
  s.contact.telegram = s.contact.telegram || {};
  s.contact.phone = s.contact.phone || {};

  const set = (obj, key) => (v) => {
    obj[key] = v;
    saveDraft();
  };

  const qrPreview = el('div', {});
  function paintQr() {
    qrPreview.replaceChildren(
      s.contact.wechat.qrImage
        ? el('div', { style: 'margin-top:10px' }, img(s.contact.wechat.qrImage, 'WeChat QR preview', { seed: 'qr' }), )
        : el('p', { class: 'hint', text: 'No QR code yet.' })
    );
    const preview = $('img', qrPreview);
    if (preview) Object.assign(preview.style, { width: '128px', height: '128px', background: '#fff', padding: '6px', borderRadius: '4px' });
  }
  paintQr();

  const qrUpload = el('input', {
    type: 'file',
    accept: 'image/*',
    style: 'display:none',
    onchange: async (e) => {
      const file = (e.target.files || [])[0];
      if (!file) return;
      if (!GitHubStore.connected) return toast('Connect GitHub on the Publish tab to upload, or paste a URL.', true);
      try {
        toast('Uploading the QR code…');
        s.contact.wechat.qrImage = await ghUploadImage(file, 'contact');
        saveDraft();
        paintQr();
        toast('QR code uploaded.');
      } catch (err) {
        toast(err.message, true);
      }
    },
  });

  return el(
    'div',
    {},
    panel(
      'Site',
      'Names, taglines and the image at the top of the home page.',
      el(
        'div',
        { class: 'adm-form' },
        el('div', { class: 'adm-row' }, field('Site name', s.siteName, set(s, 'siteName')), field('Logo text', s.logoText, set(s, 'logoText'))),
        mlField('Logo subtext', s, 'logoSubtext'),
        mlField('Tagline', s, 'siteTagline'),
        el('div', { class: 'field' }, el('span', { class: 'label', text: 'Hero image' }), imageEditor(coverAsList(s, 'heroImage'), () => saveDraft(), 'cities', 1)),
        mlField('Hero title', s, 'heroTitle'),
        mlField('Hero subtitle', s, 'heroSubtitle', { rows: 3 }),
        mlField('About me', s, 'companyDescription', { rows: 3 }),
        mlField('Short intro line', s, 'aboutBlurb', { rows: 2 }),
        mlField('Footer line', s, 'footerText')
      )
    ),

    panel(
      'WeChat',
      'The QR code opens full screen when a visitor taps it.',
      el(
        'div',
        { class: 'adm-form' },
        field('WeChat ID', s.contact.wechat.id, set(s.contact.wechat, 'id')),
        mlField('Display name', s.contact.wechat, 'name'),
        field('QR code image URL', s.contact.wechat.qrImage, (v) => { s.contact.wechat.qrImage = v; saveDraft(); paintQr(); }, { hint: 'Or upload the screenshot below — this is the single most important field on the site for WeChat clients.' }),
        el('div', { class: 'adm-actions' }, el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => qrUpload.click() }, 'Upload QR image'), qrUpload),
        qrPreview
      )
    ),

    panel(
      'Telegram and phone',
      'Phone numbers must be in international format so the tap-to-call link works.',
      el(
        'div',
        { class: 'adm-form' },
        el('div', { class: 'adm-row' }, field('Telegram username', s.contact.telegram.username, set(s.contact.telegram, 'username'), { placeholder: 'karvontravel' }), field('Telegram URL', s.contact.telegram.url, set(s.contact.telegram, 'url'), { placeholder: 'https://t.me/karvontravel' })),
        el('div', { class: 'adm-row' }, field('Phone number', s.contact.phone.number, set(s.contact.phone, 'number'), { placeholder: '+998901234567', hint: 'Digits and a leading +, no spaces.' }), field('Phone as displayed', s.contact.phone.display, set(s.contact.phone, 'display'), { placeholder: '+998 90 123 45 67' })),
        field('Email', s.contact.email, set(s.contact, 'email')),
        mlField('Hours', s.contact, 'hours'),
        mlField('Where you are based', s.contact, 'address')
      )
    ),

    panel(
      'Route planner',
      'Straight-line distance is multiplied by this to approximate real road distance.',
      el('div', { class: 'adm-form' }, field('Road factor', s.roadFactor, set(s, 'roadFactor'), { type: 'number', step: '0.01', min: '1', max: '2', hint: '1.25 matches Uzbek roads reasonably well. Set 1.0 for straight-line distance.' }))
    )
  );
}

/* ---------- publish ---------- */

function viewPublish() {
  const cfg = GitHubStore.config;
  const statusBox = el('div', {});

  function paintStatusBox() {
    statusBox.replaceChildren(
      GitHubStore.connected
        ? el('div', { class: 'adm-note adm-note--ok' }, el('strong', {}, 'Connected. '), `Publishing to ${cfg.owner}/${cfg.repo} on ${cfg.branch || 'main'}.`)
        : el('div', { class: 'adm-note' }, el('strong', {}, 'Not connected. '), 'Enter a token below to publish or upload images.')
    );
  }
  paintStatusBox();

  const tokenInput = el('input', { class: 'input', type: 'password', placeholder: 'github_pat_…', autocomplete: 'off' });

  return el(
    'div',
    {},
    panel(
      'You do not need GitHub to use this admin panel',
      '',
      el(
        'div',
        { class: 'adm-note adm-note--ok' },
        el('strong', {}, 'Two ways to save. '),
        'Press ',
        el('strong', {}, 'Download JSON'),
        ' and you get four small files to drag into the data/ folder on github.com — no token, no setup, works from any computer. Connecting GitHub below is the shortcut: it commits the same four files for you, and it is the only way to upload photographs straight from your phone. Everything else in this panel works either way.'
      )
    ),

    panel(
      'If you do connect GitHub, read this once',
      '',
      el(
        'div',
        { class: 'adm-note' },
        el('strong', {}, 'This admin panel is not a login. '),
        'GitHub Pages serves static files, so there is no server here that could keep a secret. Anyone can open this page — but without their own GitHub token they cannot change anything. Your token is held in this tab only and is erased when you close it. Never commit a token into the repository, and use a fine-grained token limited to this one repository with ',
        el('strong', {}, 'Contents: read and write'),
        ' and nothing else.'
      )
    ),

    panel(
      'Repository',
      'Where the JSON files and uploaded images are committed.',
      el(
        'div',
        { class: 'adm-form' },
        el(
          'div',
          { class: 'adm-row adm-row--3' },
          field('Owner', cfg.owner, (v) => { cfg.owner = v.trim(); GitHubStore.config = cfg; }, { placeholder: 'your-username' }),
          field('Repository', cfg.repo, (v) => { cfg.repo = v.trim(); GitHubStore.config = cfg; }, { placeholder: 'karvon' }),
          field('Branch', cfg.branch || 'main', (v) => { cfg.branch = v.trim() || 'main'; GitHubStore.config = cfg; })
        ),
        el('label', { class: 'field' }, el('span', { text: 'Fine-grained access token' }), tokenInput, el('span', { class: 'hint', text: 'Session only. Closing this tab forgets it.' })),
        el(
          'div',
          { class: 'adm-actions' },
          el(
            'button',
            {
              class: 'btn',
              type: 'button',
              onclick: async (e) => {
                const button = e.currentTarget;
                if (tokenInput.value.trim()) GitHubStore.token = tokenInput.value.trim();
                tokenInput.value = '';
                button.disabled = true;
                button.textContent = 'Checking…';
                try {
                  const repo = await ghVerify();
                  toast(`Connected to ${repo.full_name}.`);
                } catch (err) {
                  GitHubStore.forget();
                  toast(err.message, true);
                }
                button.disabled = false;
                button.textContent = 'Connect';
                paintStatusBox();
                paintStatus();
              },
            },
            'Connect'
          ),
          el(
            'button',
            {
              class: 'btn btn--ghost',
              type: 'button',
              onclick: () => {
                GitHubStore.forget();
                paintStatusBox();
                paintStatus();
                toast('Token forgotten.');
              },
            },
            'Forget the token'
          )
        ),
        statusBox
      )
    ),

    panel(
      'Save your changes',
      'Either route ends with the same four files in data/. GitHub Pages rebuilds in about a minute.',
      el(
        'div',
        { class: 'adm-actions' },
        el('button', { class: 'btn', type: 'button', onclick: downloadAll }, 'Download JSON'),
        el('button', { class: 'btn btn--ghost', type: 'button', onclick: publishAll }, 'Publish to GitHub'),
        el(
          'button',
          {
            class: 'btn btn--danger',
            type: 'button',
            onclick: async () => {
              if (!window.confirm('Throw away every unpublished change and reload the live content?')) return;
              localStorage.removeItem(DRAFT_KEY);
              location.reload();
            },
          },
          'Discard my changes'
        )
      )
    )
  );
}

const FILES = () => [
  ['data/cities.json', Draft.cities],
  ['data/places.json', Draft.places],
  ['data/tours.json', Draft.tours],
  ['data/settings.json', Draft.settings],
];

async function publishAll() {
  if (!GitHubStore.connected) {
    toast('Connect to GitHub first.', true);
    go('publish');
    return;
  }
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  try {
    for (const [path, payload] of FILES()) {
      toast(`Publishing ${path}…`);
      await ghPutText(path, JSON.stringify(payload, null, 2) + '\n', `Update ${path} from admin (${stamp})`);
    }
    dirty = false;
    localStorage.removeItem(DRAFT_KEY);
    paintStatus();
    toast('Published. The live site updates in about a minute.');
  } catch (err) {
    toast(err.message, true);
  }
}

function downloadAll() {
  FILES().forEach(([path, payload]) => {
    const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: path.split('/').pop() });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  toast('Four files downloaded. Put them in the data/ folder and commit.');
}

/* ---------- shell ---------- */

const VIEWS = {
  dashboard: viewDashboard,
  cities: viewCities,
  places: viewPlaces,
  tours: viewTours,
  settings: viewSettings,
  publish: viewPublish,
};

function paintNav() {
  $('#adm-nav').replaceChildren(
    ...SECTIONS.map((s) =>
      el(
        'button',
        { type: 'button', 'aria-current': String(s.id === section), onclick: () => go(s.id) },
        el('span', { text: s.label }),
        s.count ? el('span', { class: 'count', text: String(s.count()) }) : null
      )
    )
  );
}

function paintStatus() {
  const cfg = GitHubStore.config;
  const bits = [];
  bits.push(dirty ? 'Unpublished changes saved in this browser.' : 'Everything is published.');
  bits.push(GitHubStore.connected ? `Connected to ${cfg.owner}/${cfg.repo}.` : 'Not connected to GitHub — use Download JSON to save.');
  $('#adm-status').replaceChildren(
    el('span', { class: `dot ${dirty ? 'dot--off' : 'dot--on'}` }),
    document.createTextNode(bits.join(' '))
  );
  paintNav();
}

function go(id) {
  section = id;
  refreshDataMirror();
  paintNav();
  const main = $('#adm-main');
  main.replaceChildren(
    el(
      'div',
      { class: 'adm-head' },
      el(
        'div',
        {},
        el('h1', { class: 'd3', text: (SECTIONS.find((s) => s.id === id) || {}).label || '' }),
        el('p', { text: 'Edits are kept in this browser until you publish.' })
      )
    ),
    VIEWS[id]()
  );
  window.scrollTo({ top: 0 });
}

(async function startAdmin() {
  try {
    await loadDraft();
  } catch (err) {
    $('#adm-main').replaceChildren(
      el('div', { class: 'adm-panel' }, el('div', { class: 'adm-note adm-note--bad' }, `Could not load the current content: ${err.message}`))
    );
    return;
  }
  refreshDataMirror();

  $('#btn-publish').addEventListener('click', publishAll);
  $('#btn-download').addEventListener('click', downloadAll);
  $('#btn-preview').addEventListener('click', () => {
    saveDraft();
    sessionStorage.setItem(PREVIEW_KEY, '1');
    window.open('../index.html', '_blank');
  });

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  paintStatus();
  go('dashboard');
})();
