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

/** "2 days" / "2天" — English pluralisation does not apply in Chinese. */
const days = (n) => (LANG === 'zh' ? `${n}天` : plural(n, 'day', 'days'));

/* ---------- translation layer ----------
   Every visible string in JS goes through t(). Adding Uzbek,
   Russian or Chinese later means adding a dictionary here and a
   language switch in the nav — no markup changes.               */

const DICT = {
  en: {
    'nav.about': 'About me',
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
    'photo.by': 'Photo:',
    'contact.title': 'Message me',
    'contact.wechatNote': 'Fastest reply. Scan the code or search the ID.',
    'contact.telegramNote': 'Opens the app.',
    'contact.phoneNote': 'Also on WhatsApp.',
    'contact.tapQr': 'Tap to enlarge',
    'plan.cta': 'Ask me about this route',
    'ui.all': 'All',
    'ui.allCities': 'All cities',
    'ui.anyLength': 'Any length',
    'ui.details': 'Details',
    'ui.stay': 'Stay',
    'ui.places': 'Places',
    'ui.readyTours': 'Fixed tours',
    'ui.timeNeeded': 'Time needed',
    'ui.category': 'Category',
    'ui.city': 'City',
    'ui.reload': 'Reload the page',
    'home.whereEyebrow': 'Where to go',
    'home.whereTitle': 'The cities on the road',
    'home.allCities': 'All cities →',
    'home.plannerEyebrow': 'Route planner',
    'home.plannerTitle': 'Pick the cities. I fix the order.',
    'home.plannerBody': 'Choose any combination and the planner measures every leg, spots the moment your route doubles back on itself, and offers a shorter order — which you are free to ignore.',
    'home.plannerCta': 'Open the planner',
    'home.toursEyebrow': 'Fixed departures',
    'home.toursTitle': 'One city, one to three days',
    'home.allTours': 'All tours →',
    'home.aboutEyebrow': 'Who you will be travelling with',
    'cities.title': 'Every city I cover',
    'city.theCity': 'The city',
    'city.gettingThere': 'Getting there',
    'city.whatToSee': 'What to see',
    'city.onMap': 'On the map',
    'city.toursHere': 'Fixed tours here',
    'city.addToRoute': 'Add this city to a longer route',
    'tours.title': 'Ready tours',
    'tours.intro': 'Each tour stays in one city for one, two or three days. Combine several with the route planner if you want to cover ground.',
    'tour.dayByDay': 'Day by day',
    'tour.itinerary': 'The itinerary',
    'tour.goodToKnow': 'Good to know',
    'tour.book': 'Ask about this tour',
    'tour.bookBody': 'Send me your dates and how many of you there are. I reply the same day.',
    'tour.photos': 'Photographs',
    'tour.photosSub': 'What you will see',
    'planner.eyebrow': 'Route planner',
    'planner.title': 'Build the trip in the right order',
    'planner.intro': 'Tap the cities you want, in the order you have in mind. I measure every leg, flag anywhere the route turns back on itself, and show you a shorter order to compare against.',
    'planner.step1': '1 · Choose your cities',
    'planner.step2': '2 · Set the order',
    'planner.empty': 'Nothing chosen yet. Pick at least two cities to see a route.',
    'planner.placeholderTitle': 'Your journey appears here',
    'planner.placeholderBody': 'Pick two or more cities and I will measure the legs, estimate how long you need, and check the order.',
    'planner.yourJourney': 'Your journey',
    'planner.totalDistance': 'Total distance',
    'planner.timeNeeded': 'Time needed',
    'planner.quality': 'Route quality',
    'planner.copyLink': 'Copy link to this route',
    'planner.startOver': 'Start over',
    'planner.optimise': 'Optimise route',
    'planner.keepMine': 'Keep my order',
    'planner.askTitle': 'Want me to arrange this?',
    'planner.askBody': 'Send me the link to this route and your dates. I will come back with trains, hotels and a plan.',
    'contact.office': 'Where I am',
    'contact.getInTouch': 'Get in touch',
    'quality.excellent': 'Excellent',
    'quality.good': 'Good',
    'quality.workable': 'Workable',
    'quality.detour': 'One detour',
    'quality.backtracking': 'Backtracking',
    'verdict.round.title': 'Round trip, no wasted kilometres.',
    'verdict.round.body': 'You finish where you started, in {city}, having crossed the country once in each direction. That is the shape a round trip should have.',
    'verdict.clean.title': 'One clean run along the corridor.',
    'verdict.clean.body': 'Every leg moves you further along the road. There is no shorter order for these cities.',
    'verdict.sensible.title': 'A sensible order.',
    'verdict.sensible.body': 'Nothing doubles back. A different order would save about {km}, which may not be worth rearranging your trip for.',
    'verdict.detour.title': 'One detour — fine if it is deliberate.',
    'verdict.detour.body': 'Going to {from} before {to} means turning back on yourself once. It costs about {km} against the shortest order. Plenty of people do this for a flight time or a festival date.',
    'verdict.back.title': 'This route contains unnecessary backtracking.',
    'verdict.back.body': 'The road turns back on itself {n} times. Reordering the same cities saves roughly {km} — around {pct}% of the driving.',
    'verdict.shortest': 'Shortest',
    'verdict.retraces': ' · retraces your path',
    'planner.reordered': 'Reordered — {km} shorter.',
    'planner.kept': 'Keeping your order.',
    'planner.copied': 'Link copied.',
    'planner.copyFail': 'Copy the address bar to share this route.',
    'planner.return': 'return',
  },
  zh: {
    'nav.cities': '城市',
    'nav.tours': '固定行程',
    'nav.planner': '路线规划',
    'nav.contact': '联系我',
    'nav.about': '关于我',
    'cta.plan': '规划你的路线',
    'cta.tours': '查看行程',
    'search.placeholder': '搜索城市、景点、行程',
    'search.empty': '没有找到相关内容。',
    'state.noPlaces': '这座城市还没有添加景点。',
    'state.noTours': '还没有发布固定行程。',
    'error.load': '网站数据加载失败。',
    'error.loadHint': '请检查网络后刷新页面。',
    'photo.by': '摄影：',
    'contact.title': '联系我',
    'contact.wechatNote': '回复最快。扫码或搜索微信号。',
    'contact.telegramNote': '将打开 Telegram。',
    'contact.phoneNote': '同号 WhatsApp。',
    'contact.tapQr': '点击放大',
    'plan.cta': '就这条路线咨询我',
    'ui.all': '全部',
    'ui.allCities': '全部城市',
    'ui.anyLength': '不限天数',
    'ui.details': '详情',
    'ui.stay': '建议停留',
    'ui.places': '景点',
    'ui.readyTours': '固定行程',
    'ui.timeNeeded': '建议时长',
    'ui.category': '类别',
    'ui.city': '城市',
    'ui.reload': '刷新页面',
    'home.whereEyebrow': '去哪里',
    'home.whereTitle': '这条路上的城市',
    'home.allCities': '全部城市 →',
    'home.plannerEyebrow': '路线规划',
    'home.plannerTitle': '你选城市，顺序交给我',
    'home.plannerBody': '任意组合都可以。规划器会计算每一段距离，指出路线在哪里折返，并给出更短的顺序——你也完全可以不采纳。',
    'home.plannerCta': '打开规划器',
    'home.toursEyebrow': '固定行程',
    'home.toursTitle': '单城，一至三天',
    'home.allTours': '全部行程 →',
    'home.aboutEyebrow': '陪你走完全程的人',
    'cities.title': '我带客人去的城市',
    'city.theCity': '关于这座城',
    'city.gettingThere': '如何到达',
    'city.whatToSee': '看什么',
    'city.onMap': '地图位置',
    'city.toursHere': '这里的固定行程',
    'city.addToRoute': '把这座城加入更长的路线',
    'tours.title': '固定行程',
    'tours.intro': '每条行程都在单一城市内，为期一至三天。想多跑几座城，可以用路线规划器把它们串起来。',
    'tour.dayByDay': '逐日安排',
    'tour.itinerary': '行程内容',
    'tour.goodToKnow': '注意事项',
    'tour.book': '咨询这条行程',
    'tour.bookBody': '把日期和人数发给我，我当天回复。',
    'tour.photos': '实景照片',
    'tour.photosSub': '你会看到什么',
    'planner.eyebrow': '路线规划',
    'planner.title': '把行程排成正确的顺序',
    'planner.intro': '按你心里的顺序点选城市。我会计算每一段距离，标出路线折返的位置，并给出更短的顺序供你比较。',
    'planner.step1': '1 · 选择城市',
    'planner.step2': '2 · 调整顺序',
    'planner.empty': '还没有选择。至少选两座城市才能生成路线。',
    'planner.placeholderTitle': '你的路线会显示在这里',
    'planner.placeholderBody': '选择两座或以上的城市，我会计算各段距离、估算所需天数，并检查顺序是否合理。',
    'planner.yourJourney': '你的路线',
    'planner.totalDistance': '总里程',
    'planner.timeNeeded': '建议天数',
    'planner.quality': '路线评价',
    'planner.copyLink': '复制此路线链接',
    'planner.startOver': '重新开始',
    'planner.optimise': '优化路线',
    'planner.keepMine': '保持我的顺序',
    'planner.askTitle': '需要我来安排吗？',
    'planner.askBody': '把这条路线的链接和你的日期发给我，我会回复火车、住宿和具体方案。',
    'contact.office': '我在哪里',
    'contact.getInTouch': '联系我',
    'quality.excellent': '很合理',
    'quality.good': '不错',
    'quality.workable': '尚可',
    'quality.detour': '一次绕行',
    'quality.backtracking': '存在折返',
    'verdict.round.title': '环线，没有多余的里程。',
    'verdict.round.body': '你从{city}出发，最后回到{city}，东西方向各穿越一次。环线本该是这个形状。',
    'verdict.clean.title': '沿着丝路走廊一路向前。',
    'verdict.clean.body': '每一段都在把你往前推进。这几座城市没有更短的顺序了。',
    'verdict.sensible.title': '顺序合理。',
    'verdict.sensible.body': '没有折返。换一个顺序大约能省{km}，为此重排行程未必值得。',
    'verdict.detour.title': '有一次绕行——如果是有意为之，没有问题。',
    'verdict.detour.body': '先去{from}再去{to}，意味着要往回走一次，比最短顺序多出约{km}。很多人为了航班时间或某个节庆日期会这样安排。',
    'verdict.back.title': '这条路线存在不必要的折返。',
    'verdict.back.body': '路线折返了{n}次。同样这几座城市，重新排序大约可以省下{km}，约占全程驾车里程的{pct}%。',
    'verdict.shortest': '最短顺序',
    'verdict.retraces': ' · 这一段在往回走',
    'planner.reordered': '已重新排序——缩短了{km}。',
    'planner.kept': '保留你的顺序。',
    'planner.copied': '链接已复制。',
    'planner.copyFail': '请复制地址栏中的链接来分享这条路线。',
    'planner.return': '返回',
  },
};

const LANG_KEY = 'karvon:lang';
let LANG = 'en';

function detectLang() {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && DICT[saved]) return saved;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

function setLang(code) {
  if (!DICT[code]) return;
  LANG = code;
  localStorage.setItem(LANG_KEY, code);
  document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
  location.reload();
}

const t = (key) => (DICT[LANG] && DICT[LANG][key]) || DICT.en[key] || key;

/** t() with {placeholders} filled in — keeps word order translatable. */
const tf = (key, vars = {}) =>
  t(key).replace(/\{(\w+)\}/g, (_, name) => (vars[name] === undefined ? `{${name}}` : vars[name]));

/**
 * Read a content field that may be a plain string (single language) or an
 * object keyed by language code. Falls back to English, then to whatever
 * translation exists, so a half-translated entry still renders.
 */
function L(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object') return '';
  return value[LANG] || value.en || Object.values(value).find((v) => typeof v === 'string') || '';
}

/* Images are either a URL string or { src, credit, page }. */
const imgSrc = (x) => (typeof x === 'string' ? x : (x && x.src) || '');
const imgCredit = (x) => (x && typeof x === 'object' ? x.credit || '' : '');
const imgPage = (x) => (x && typeof x === 'object' ? x.page || '' : '');

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
function img(source, alt, { seed = '', eager = false, sizes = '' } = {}) {
  const src = imgSrc(source);
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
  return hit ? L(hit.label) : id ? id[0].toUpperCase() + id.slice(1) : 'Other';
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
      el(
        'a',
        { class: 'nav__brand', href: BASE + 'index.html' },
        s.logoText || 'Karvon',
        el('span', { text: L(s.logoSubtext) || 'Uzbekistan' })
      ),
      el('nav', { class: 'nav__links', 'aria-label': 'Main' }, links),
      el(
        'div',
        { class: 'nav__actions' },
        langSwitcher(),
        el('a', { class: 'btn btn--sm', href: BASE + 'planner.html', text: t('cta.plan') }),
        burger
      )
    )
  );

  const sheet = el(
    'div',
    { class: 'nav__sheet', id: 'nav-sheet' },
    NAV_ITEMS.map((item) => el('a', { href: BASE + item.href, text: t(item.key) })),
    el('a', { class: 'btn btn--block', href: BASE + 'planner.html', text: t('cta.plan') }),
    el('div', { style: 'margin-top:18px' }, langSwitcher())
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

function langSwitcher() {
  const options = (Data.settings.languages || [{ code: 'en', label: 'English' }]);
  return el(
    'div',
    { class: 'lang', role: 'group', 'aria-label': 'Language' },
    options.map((opt) =>
      el('button', {
        class: 'lang__btn',
        type: 'button',
        'aria-pressed': String(opt.code === LANG),
        text: opt.label,
        onclick: () => setLang(opt.code),
      })
    )
  );
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
          el('p', { class: 'muted', style: 'max-width:42ch', text: L(s.companyDescription) })
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
        el('span', { text: L(s.footerText) }),
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
  const srcs = list.map(imgSrc).map((u, i) => u || tileDataUri(label + i));

  const track = el(
    'div',
    { class: 'gallery__track', tabindex: '0', role: 'group', 'aria-label': `${label} images` },
    list.map((src, i) =>
      el('div', { class: 'gallery__slide' }, img(src, `${label} — image ${i + 1}`, { seed: label + i, eager: i === 0 }))
    )
  );

  const count = el('div', { class: 'gallery__count data', text: `1 / ${list.length}` });
  const credit = el('p', { class: 'gallery__credit' });
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
  const wrap = el('div', { class: 'gallery' }, main, list.length > 1 ? thumbs : null, credit);

  let index = 0;
  function go(i) {
    index = Math.max(0, Math.min(list.length - 1, i));
    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
    sync();
  }
  function sync() {
    count.textContent = `${index + 1} / ${list.length}`;
    const line = imgCredit(list[index]);
    const page = imgPage(list[index]);
    credit.replaceChildren(
      line
        ? el('span', {}, `${t('photo.by')} `, page ? el('a', { href: page, target: '_blank', rel: 'noopener', text: line }) : line)
        : ''
    );
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
    if (e.target.tagName === 'IMG') Lightbox.open(srcs, index, label);
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
    ...Data.cities.map((c) => ({ kind: t('nav.cities'), name: L(c.name), sub: L(c.tagline), image: c.coverImage, href: cityHref(c.id) })),
    ...Data.places.map((p) => ({
      kind: categoryLabel(p.category),
      name: L(p.name),
      sub: L((cityById(p.cityId) || {}).name),
      image: (p.images || [])[0],
      href: placeHref(p),
    })),
    ...Data.tours.map((x) => ({ kind: t('nav.tours'), name: L(x.title), sub: days(x.duration), image: x.coverImage, href: tourHref(x.id) })),
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
    el('button', { class: 'btn btn--ghost', type: 'button', onclick: () => location.reload() }, t('ui.reload'))
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
  LANG = detectLang();
  document.documentElement.lang = LANG === 'zh' ? 'zh-Hans' : LANG;
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
