/* ============================================================
   Karvon — core.js
   Shared data layer, chrome (nav/footer), and UI primitives.
   Loaded on every public page.
   ============================================================ */

const BASE = document.documentElement.dataset.base || './';
const DRAFT_KEY = 'karvon:draft';
const PREVIEW_KEY = 'karvon:preview';

/* ---------- tiny helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const escapeHtml = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const qs = (key) => new URLSearchParams(location.search).get(key);

function fmtDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const fmtKm = (km) => `${Math.round(km).toLocaleString('en-US')} km`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ---------- translation layer ----------
   Every visible string in JS goes through t(). Adding Uzbek,
   Russian or Chinese later means adding a dictionary here and a
   language switch in the nav — no markup changes.               */

const DICT = {
  en: {
    'nav.cities': 'Cities',
    'nav.tours': 'Tours',
    'nav.planner': 'Route planner',
    'nav.contact': 'Contact',
    'cta.plan': 'Plan your route',
    'cta.tours': 'Browse tours',
    'search.placeholder': 'Search cities, places, tours',
    'search.empty': 'Nothing matches that yet.',
    'state.noPlaces': 'No places have been added to this city yet.',
    'state.noTours': 'No tours have been published yet.',
    'error.load': 'The site data could not be loaded.',
    'error.loadHint': 'Check your connection and reload the page.',
  },
};
let LANG = 'en';
const t = (key) => (DICT[LANG] && DICT[LANG][key]) || DICT.en[key] || key;

/* ---------- image fallback ----------
   Missing or broken images render a deterministic girih tile in
   the site palette instead of a browser icon.                    */

const TILE_COLORS = ['#103257', '#17456F', '#1E7C7B', '#0B2340', '#B4801F'];

function tileDataUri(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bg = TILE_COLORS[h % TILE_COLORS.length];
  const fg = TILE_COLORS[(h >> 3) % TILE_COLORS.length];
  const star =
    'M60 8 L73 40 L107 25 L92 57 L120 60 L92 63 L107 95 L73 80 L60 112 L47 80 L13 95 L28 63 L0 60 L28 57 L13 25 L47 40 Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180">
    <rect width="240" height="180" fill="${bg}"/>
    <g fill="${fg}" opacity=".45">
      <g transform="translate(30,20) scale(.55)"><path d="${star}"/></g>
      <g transform="translate(140,20) scale(.55)"><path d="${star}"/></g>
      <g transform="translate(85,80) scale(.55)"><path d="${star}"/></g>
    </g>
    <rect width="240" height="180" fill="none" stroke="rgba(244,239,230,.14)"/>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Build an <img> that degrades to a tile if the source fails. */
function img(src, alt, { seed = '', eager = false, sizes = '' } = {}) {
  const node = el('img', {
    src: src || tileDataUri(seed || alt),
    alt: alt || '',
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
  });
  if (sizes) node.setAttribute('sizes', sizes);
  node.addEventListener(
    'error',
    () => {
      if (node.dataset.fallbackApplied) return;
      node.dataset.fallbackApplied = '1';
      node.src = tileDataUri(seed || alt);
    },
    { once: true }
  );
  return node;
}

/* ---------- data layer ---------- */

const Data = {
  cities: [],
  places: [],
  tours: [],
  settings: {},
  ready: false,
};

async function fetchJson(name) {
  const res = await fetch(`${BASE}data/${name}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${name}.json → HTTP ${res.status}`);
  return res.json();
}

async function loadData() {
  if (Data.ready) return Data;

  // The admin panel can push an unsaved working copy into localStorage
  // and open the site in preview mode to check it before publishing.
  if (sessionStorage.getItem(PREVIEW_KEY) === '1') {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (draft && draft.cities) {
        Object.assign(Data, draft, { ready: true });
        showPreviewBar();
        return Data;
      }
    } catch (_) {
      /* fall through to the published files */
    }
  }

  const [cities, places, tours, settings] = await Promise.all([
    fetchJson('cities'),
    fetchJson('places'),
    fetchJson('tours'),
    fetchJson('settings'),
  ]);
  Object.assign(Data, { cities, places, tours, settings, ready: true });
  return Data;
}

function showPreviewBar() {
  const bar = el(
    'div',
    {
      style:
        'position:fixed;left:0;right:0;bottom:0;z-index:500;background:#E3A53E;color:#061426;padding:9px 16px;font:700 14px/1.4 Karla,sans-serif;display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap',
    },
    'Preview mode — showing unpublished admin changes.',
    el(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        style: 'border-color:rgba(6,20,38,.4);color:#061426',
        onclick: () => {
          sessionStorage.removeItem(PREVIEW_KEY);
          location.reload();
        },
      },
      'Exit preview'
    )
  );
  const attach = () => document.body.append(bar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
}

/* ---------- lookups ---------- */

const cityById = (id) => Data.cities.find((c) => c.id === id);
const placeById = (id) => Data.places.find((p) => p.id === id);
const tourById = (id) => Data.tours.find((x) => x.id === id);
const placesInCity = (cityId) => Data.places.filter((p) => p.cityId === cityId);
const toursInCity = (cityId) => Data.tours.filter((x) => x.cityId === cityId);

function categoryLabel(id) {
  const list = Data.settings.categories || [];
  const hit = list.find((c) => c.id === id);
  return hit ? hit.label : id ? id[0].toUpperCase() + id.slice(1) : 'Other';
}

const cityHref = (id) => `${BASE}city.html?id=${encodeURIComponent(id)}`;
const tourHref = (id) => `${BASE}tour.html?id=${encodeURIComponent(id)}`;
const placeHref = (place) => `${cityHref(place.cityId)}#place=${encodeURIComponent(place.id)}`;

/* ---------- chrome ---------- */

const NAV_ITEMS = [
  { href: 'cities.html', key: 'nav.cities' },
  { href: 'tours.html', key: 'nav.tours' },
  { href: 'planner.html', key: 'nav.planner' },
  { href: 'contact.html', key: 'nav.contact' },
];

function renderChrome() {
  const s = Data.settings || {};
  const here = location.pathname.split('/').pop() || 'index.html';

  const links = NAV_ITEMS.map((item) =>
    el('a', {
      href: BASE + item.href,
      text: t(item.key),
      'aria-current': item.href === here ? 'page' : null,
    })
  );

  const burger = el(
    'button',
    { class: 'nav__burger', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'nav-sheet', 'aria-label': 'Open menu' },
    el('span')
  );

  const nav = el(
    'header',
    { class: 'nav' },
    el(
      'div',
      { class: 'shell nav__inner' },
      el('a', { class: 'nav__brand', href: BASE + 'index.html' }, s.logoText || 'Karvon', el('span', { text: 'Uzbekistan' })),
      el('nav', { class: 'nav__links', 'aria-label': 'Main' }, links),
      el(
        'div',
        { class: 'nav__actions' },
        el('a', { class: 'btn btn--sm', href: BASE + 'planner.html', text: t('cta.plan') }),
        burger
      )
    )
  );

  const sheet = el(
    'div',
    { class: 'nav__sheet', id: 'nav-sheet' },
    NAV_ITEMS.map((item) => el('a', { href: BASE + item.href, text: t(item.key) })),
    el('a', { class: 'btn btn--block', href: BASE + 'planner.html', text: t('cta.plan') })
  );

  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    burger.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
    sheet.classList.toggle('is-open', !open);
    document.body.style.overflow = open ? '' : 'hidden';
  });

  const mount = $('#site-nav');
  if (mount) mount.replaceWith(nav, sheet);

  // solid background once the hero is behind us
  const onScroll = () => nav.classList.toggle('is-solid', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  renderFooter();
  applySettingsToHead();
}

function applySettingsToHead() {
  const s = Data.settings || {};
  if (s.siteName && !document.title.includes(s.siteName)) {
    document.title = `${document.title} — ${s.siteName}`;
  }
  if (s.favicon) {
    let link = $('link[rel="icon"]');
    if (!link) {
      link = el('link', { rel: 'icon' });
      document.head.append(link);
    }
    link.href = /^https?:|^data:/.test(s.favicon) ? s.favicon : BASE + s.favicon;
  }
}

function renderFooter() {
  const mount = $('#site-footer');
  if (!mount) return;
  const s = Data.settings || {};
  const c = s.contact || {};

  const footer = el(
    'footer',
    { class: 'footer' },
    el(
      'div',
      { class: 'shell' },
      el(
        'div',
        { class: 'footer__grid' },
        el(
          'div',
          {},
          el('h4', { text: s.siteName || 'Karvon' }),
          el('p', { class: 'muted', style: 'max-width:42ch', text: s.companyDescription || '' })
        ),
        el(
          'div',
          {},
          el('h4', { text: 'Explore' }),
          el('ul', {}, NAV_ITEMS.map((i) => el('li', {}, el('a', { href: BASE + i.href, text: t(i.key) }))))
        ),
        el(
          'div',
          {},
          el('h4', { text: 'Reach us' }),
          el(
            'ul',
            {},
            c.telegram && c.telegram.username
              ? el('li', {}, el('a', { href: c.telegram.url || `https://t.me/${c.telegram.username}`, text: `Telegram @${c.telegram.username}` }))
              : null,
            c.wechat && c.wechat.id ? el('li', {}, el('span', { class: 'muted', text: `WeChat ${c.wechat.id}` })) : null,
            c.phone && c.phone.number
              ? el('li', {}, el('a', { href: `tel:${c.phone.number}`, text: c.phone.display || c.phone.number }))
              : null,
            c.email ? el('li', {}, el('a', { href: `mailto:${c.email}`, text: c.email })) : null,
            (s.social || []).map((x) => el('li', {}, el('a', { href: x.url, target: '_blank', rel: 'noopener', text: x.label })))
          )
        )
      ),
      el(
        'div',
        { class: 'footer__base' },
        el('span', { text: s.footerText || '' }),
        el('a', { href: BASE + 'admin/index.html', class: 'muted', text: 'Admin' })
      )
    )
  );
  mount.replaceWith(footer);
}

/* ---------- reveal on scroll ---------- */

function observeReveals(root = document) {
  const targets = $$('.reveal:not(.is-in)', root);
  if (!targets.length) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduced) {
    targets.forEach((n) => n.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        setTimeout(() => entry.target.classList.add('is-in'), Math.min(i * 60, 240));
        io.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
  );
  targets.forEach((n) => io.observe(n));
}

/* ---------- toast ---------- */

let toastTimer;
function toast(message, bad = false) {
  let node = $('.toast');
  if (!node) {
    node = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.toggle('toast--bad', !!bad);
  requestAnimationFrame(() => node.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-on'), 3200);
}

/* ---------- lightbox ---------- */

const Lightbox = {
  images: [],
  index: 0,
  node: null,

  open(images, index = 0, caption = '') {
    this.images = images;
    this.index = index;
    this.caption = caption;
    if (!this.node) this.build();
    this.node.hidden = false;
    document.body.style.overflow = 'hidden';
    this.paint();
    this.node.querySelector('.lightbox__close').focus();
  },

  build() {
    const figure = el('img', { alt: '' });
    const cap = el('div', { class: 'lightbox__cap' });
    this.node = el(
      'div',
      { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Image viewer', hidden: true },
      el('button', { class: 'lightbox__close', type: 'button', 'aria-label': 'Close viewer', onclick: () => this.close() }, '✕'),
      el('button', { class: 'lightbox__nav lightbox__nav--prev', type: 'button', 'aria-label': 'Previous image', onclick: () => this.step(-1) }, '‹'),
      el('button', { class: 'lightbox__nav lightbox__nav--next', type: 'button', 'aria-label': 'Next image', onclick: () => this.step(1) }, '›'),
      figure,
      cap
    );
    this.figure = figure;
    this.cap = cap;
    this.node.addEventListener('click', (e) => {
      if (e.target === this.node) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (this.node.hidden) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowRight') this.step(1);
      if (e.key === 'ArrowLeft') this.step(-1);
    });
    document.body.append(this.node);
  },

  paint() {
    const single = this.images.length < 2;
    this.figure.src = this.images[this.index];
    this.figure.onerror = () => (this.figure.src = tileDataUri(String(this.index)));
    this.cap.textContent = single ? this.caption : `${this.caption} · ${this.index + 1} / ${this.images.length}`.trim();
    this.node.querySelector('.lightbox__nav--prev').hidden = single;
    this.node.querySelector('.lightbox__nav--next').hidden = single;
  },

  step(delta) {
    this.index = (this.index + delta + this.images.length) % this.images.length;
    this.paint();
  },

  close() {
    this.node.hidden = true;
    document.body.style.overflow = '';
  },
};

/* ---------- gallery (1–10 images, swipe + keyboard) ---------- */

function buildGallery(images, label) {
  const list = (images || []).filter(Boolean).slice(0, 10);
  if (!list.length) list.push(tileDataUri(label));

  const track = el(
    'div',
    { class: 'gallery__track', tabindex: '0', role: 'group', 'aria-label': `${label} images` },
    list.map((src, i) =>
      el('div', { class: 'gallery__slide' }, img(src, `${label} — image ${i + 1}`, { seed: label + i, eager: i === 0 }))
    )
  );

  const count = el('div', { class: 'gallery__count data', text: `1 / ${list.length}` });
  const prev = el('button', { class: 'gallery__arrow gallery__arrow--prev', type: 'button', 'aria-label': 'Previous image' }, '‹');
  const next = el('button', { class: 'gallery__arrow gallery__arrow--next', type: 'button', 'aria-label': 'Next image' }, '›');

  const thumbs = el(
    'div',
    { class: 'gallery__thumbs', role: 'tablist', 'aria-label': `${label} thumbnails` },
    list.map((src, i) =>
      el(
        'button',
        {
          class: 'gallery__thumb',
          type: 'button',
          role: 'tab',
          'aria-selected': String(i === 0),
          'aria-label': `Show image ${i + 1}`,
          onclick: () => go(i),
        },
        img(src, '', { seed: label + i })
      )
    )
  );

  const main = el('div', { class: 'gallery__main' }, track, prev, next, count);
  const wrap = el('div', { class: 'gallery' }, main, list.length > 1 ? thumbs : null);

  let index = 0;
  function go(i) {
    index = Math.max(0, Math.min(list.length - 1, i));
    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
    sync();
  }
  function sync() {
    count.textContent = `${index + 1} / ${list.length}`;
    $$('.gallery__thumb', thumbs).forEach((b, i) => b.setAttribute('aria-selected', String(i === index)));
    prev.hidden = list.length < 2;
    next.hidden = list.length < 2;
  }

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) {
      index = i;
      sync();
    }
  }, { passive: true });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });
  track.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG') Lightbox.open(list, index, label);
  });

  sync();
  return wrap;
}

/* ---------- modal ---------- */

const Modal = {
  node: null,
  lastFocus: null,

  open(contentNode, label = 'Details') {
    this.lastFocus = document.activeElement;
    if (!this.node) this.build();
    const inner = $('.modal__inner', this.node);
    inner.replaceChildren(contentNode);
    this.node.setAttribute('aria-label', label);
    this.node.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.modal__close', this.node).focus();
  },

  build() {
    this.node = el(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': 'true', hidden: true },
      el('button', { class: 'modal__scrim', type: 'button', 'aria-label': 'Close', onclick: () => this.close() }),
      el(
        'div',
        { class: 'modal__panel' },
        el('button', { class: 'modal__close', type: 'button', 'aria-label': 'Close', onclick: () => this.close() }, '✕'),
        el('div', { class: 'modal__inner' })
      )
    );
    document.addEventListener('keydown', (e) => {
      if (!this.node.hidden && e.key === 'Escape') this.close();
    });
    document.body.append(this.node);
  },

  close() {
    if (!this.node) return;
    this.node.hidden = true;
    document.body.style.overflow = '';
    if (location.hash.startsWith('#place=')) history.replaceState(null, '', location.pathname + location.search);
    if (this.lastFocus) this.lastFocus.focus();
  },
};

/* ---------- global search ---------- */

function mountSearch(container) {
  const input = el('input', {
    class: 'input search__input',
    type: 'search',
    placeholder: t('search.placeholder'),
    'aria-label': t('search.placeholder'),
    autocomplete: 'off',
  });
  const results = el('div', { class: 'search__results', hidden: true, role: 'listbox' });
  const box = el(
    'div',
    { class: 'search' },
    el('span', { class: 'search__icon', 'aria-hidden': 'true' }, '⌕'),
    input,
    results
  );
  container.replaceChildren(box);

  const index = [
    ...Data.cities.map((c) => ({ kind: 'City', name: c.name, sub: c.tagline, image: c.coverImage, href: cityHref(c.id) })),
    ...Data.places.map((p) => ({
      kind: categoryLabel(p.category),
      name: p.name,
      sub: (cityById(p.cityId) || {}).name || '',
      image: (p.images || [])[0],
      href: placeHref(p),
    })),
    ...Data.tours.map((x) => ({ kind: 'Tour', name: x.title, sub: plural(x.duration, 'day', 'days'), image: x.coverImage, href: tourHref(x.id) })),
  ];

  let active = -1;
  let hits = [];

  function paint(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      results.hidden = true;
      return;
    }
    hits = index
      .filter((item) => (item.name + ' ' + (item.sub || '')).toLowerCase().includes(q))
      .slice(0, 8);
    active = -1;

    if (!hits.length) {
      results.replaceChildren(el('div', { class: 'muted', style: 'padding:14px', text: t('search.empty') }));
    } else {
      results.replaceChildren(
        ...hits.map((hit, i) =>
          el(
            'a',
            { class: 'search__hit', href: hit.href, role: 'option', dataset: { i } },
            img(hit.image, '', { seed: hit.name }),
            el('div', {}, el('span', { text: hit.kind }), el('strong', { text: hit.name }))
          )
        )
      );
    }
    results.hidden = false;
  }

  input.addEventListener('input', () => paint(input.value));
  input.addEventListener('keydown', (e) => {
    if (results.hidden || !hits.length) return;
    const items = $$('.search__hit', results);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((n, i) => n.classList.toggle('is-active', i === active));
      items[active].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter' && active > -1) {
      e.preventDefault();
      items[active].click();
    }
    if (e.key === 'Escape') results.hidden = true;
  });
  document.addEventListener('click', (e) => {
    if (!box.contains(e.target)) results.hidden = true;
  });

  return box;
}

/* ---------- error / empty states ---------- */

function errorState(message, hint) {
  return el(
    'div',
    { class: 'state' },
    el('h3', { text: message || t('error.load') }),
    el('p', { text: hint || t('error.loadHint') }),
    el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => location.reload() }, 'Reload the page')
  );
}

function emptyState(message, actionLabel, actionHref) {
  return el(
    'div',
    { class: 'state' },
    el('h3', { text: message }),
    actionLabel ? el('a', { class: 'btn btn--ghost', href: actionHref, text: actionLabel }) : null
  );
}

/* ---------- map (Leaflet, loaded only when needed) ---------- */

let leafletPromise = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = el('link', { rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
    document.head.append(css);
    const script = el('script', { src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Leaflet failed to load'));
    document.head.append(script);
  });
  return leafletPromise;
}

/**
 * Draw a map. Falls back to a readable panel with coordinates when
 * the tile server or the library is unreachable — the page never breaks.
 */
async function drawMap(container, markers, { zoom = 13, line = false } = {}) {
  const points = markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng));
  if (!points.length) {
    container.replaceChildren(el('div', { class: 'map-fallback' }, el('p', { text: 'No coordinates on record for this location.' })));
    return;
  }
  try {
    const L = await loadLeaflet();
    container.replaceChildren();
    const map = L.map(container, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const icon = L.divIcon({ className: '', html: '<div class="map-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    const latlngs = points.map((p) => [p.lat, p.lng]);
    points.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon, title: p.name }).addTo(map);
      if (p.name) marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong>${p.note ? `<br>${escapeHtml(p.note)}` : ''}`);
    });

    if (line && latlngs.length > 1) {
      L.polyline(latlngs, { color: '#35B0AE', weight: 3, dashArray: '7 7' }).addTo(map);
    }
    if (latlngs.length > 1) map.fitBounds(latlngs, { padding: [40, 40] });
    else map.setView(latlngs[0], zoom);

    setTimeout(() => map.invalidateSize(), 120);
  } catch (_) {
    container.replaceChildren(
      el(
        'div',
        { class: 'map-fallback' },
        el('p', {}, 'The map could not load. Coordinates:'),
        el(
          'p',
          { class: 'data', style: 'color:var(--glaze)' },
          points.map((p) => `${p.name}: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`).join(' · ')
        )
      )
    );
  }
}

/* ---------- page bootstrap ---------- */

async function boot(render) {
  const main = $('#main');
  try {
    await loadData();
  } catch (err) {
    console.error(err);
    document.body.dataset.nav = 'solid';
    if (main) main.replaceChildren(el('div', { class: 'shell', style: 'padding:140px 0 80px' }, errorState()));
    return;
  }
  try {
    renderChrome();
    await render();
    observeReveals();
  } catch (err) {
    console.error(err);
    if (main) main.replaceChildren(el('div', { class: 'shell', style: 'padding:140px 0 80px' }, errorState('This page hit an error.', err.message)));
  }
}
