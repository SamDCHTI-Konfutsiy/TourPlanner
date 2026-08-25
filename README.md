# 吴敏俊 WuMinjun's Private Tours

A static bilingual (English / 中文) site for a private guide in Uzbekistan.
No framework, no build step, no server. It runs on GitHub Pages for free.

Four cities, fifteen places, six fixed tours, and a route planner that puts a
client's chosen cities in the order the Silk Road already put them.

---

## Before anything else: do you actually need GitHub?

Short answer: **no — not to run the site, and not to edit it.**

GitHub Pages is just free file hosting. It takes your HTML, CSS and JSON files
and serves them at a web address. That part needs no token and no API.

The GitHub *connection* inside the admin panel is a convenience, nothing more.
The honest comparison:

| | Download JSON | Connect GitHub |
|---|---|---|
| Setup | none | one token, five minutes |
| Editing text, reordering | works | works |
| Saving | four files download; you drag them into `data/` on github.com | committed for you in one click |
| Uploading photos from your phone | not possible — you add them to `assets/images/` yourself | works |
| Editing between tours, from your phone | awkward | this is the point of it |

If you sit at a computer once a week to update the site, use **Download JSON**
and skip the token entirely. If you want to swap a photo from your phone while
waiting at Urgench airport, connect GitHub.

Either way, the site your clients see never talks to GitHub. That connection
exists only inside `/admin/`, only while that tab is open.

A third option: skip the admin panel and edit `data/*.json` directly on
github.com in the browser. The files are plain text and the structure is
documented at the end of this file.

---

## Deploy it

1. Create a repository and push every file in this folder to its root.
2. **Settings → Pages → Source → Deploy from a branch**, choose `main` and
   `/ (root)`, save.
3. Wait about a minute. The site is at
   `https://<your-username>.github.io/<repo>/`.

`.nojekyll` is included and must stay — it stops GitHub trying to process the
files as a blog.

Everything uses relative paths, so the site works both at a domain root and
under a `/repo-name/` subpath without changing a line.

### Testing locally

Opening `index.html` from the filesystem will not work — browsers refuse
`fetch()` on `file://` URLs. Run a static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## The photographs — read this before going live

Every photo currently on the site comes from Wikimedia Commons under Creative
Commons licences, with the photographer credited under each gallery. They are
**real photographs of the actual monuments**, correctly matched, and they are
there so the site does not launch empty.

They are not your photographs, and for a private guide that matters. Your
clients are choosing *you*. A photo of you at the Registan with a family from
Chengdu does more work than any Commons image ever will. Replace them as you
go — the admin dashboard tracks how many stock photos are left.

### Download them into the repository first

Do not leave the site pointing at Wikimedia's servers. Run this once, from the
repository root:

```bash
python3 tools/fetch-images.py
```

It downloads every photo into `assets/images/`, rewrites `data/*.json` to point
at the local copies, and keeps the credits. Then commit the new files.

Three reasons this matters: local files load faster because they sit on the
same CDN as the site; a renamed or deleted Commons file can no longer break
your gallery; and Wikimedia asks that people not hotlink their servers for
production traffic.

```bash
python3 tools/fetch-images.py --check     # test the URLs, download nothing
python3 tools/fetch-images.py --dry-run   # show what would happen
```

Anything that fails keeps its remote URL and the site shows a patterned tile in
its place — the page never breaks. Those are the entries to replace with your
own photos first.

**One warning I cannot resolve from here.** I could not test the Wikimedia URLs
while building this, because the environment blocks that domain. The filenames
are real and verified against Commons; the URL pattern (`Special:FilePath`) is
Wikimedia's documented, stable endpoint. But run `--check` before you trust it.

### Credits are not optional

The licences require attribution. The site displays the credit line under every
gallery, and the admin panel has a credit field on every image. If you remove a
credit, remove the photo too.

---

## Languages

The site ships in English and Chinese. A visitor's language is guessed from
their browser and can be changed from the switcher in the header; the choice is
remembered.

Two separate layers:

- **Interface text** — buttons, headings, the planner's verdicts — lives in the
  `DICT` object at the top of `js/core.js`. Both languages are complete.
- **Your content** — city and place descriptions, tour itineraries — is stored
  in the JSON as `{ "en": "…", "zh": "…" }`. Every text field in the admin
  panel shows one input per language, side by side.

A missing Chinese translation falls back to English rather than showing a
blank, so a half-translated new entry still renders correctly.

### Adding Russian

Plenty of visitors to Uzbekistan read Russian. To add it:

1. Add `{ "code": "ru", "label": "Русский" }` to `languages` in
   `data/settings.json`. The switcher and the admin panel pick it up
   immediately — a third input appears on every text field.
2. Copy the `en:` block inside `DICT` in `js/core.js`, rename it `ru:`, and
   translate the values.

Nothing else needs changing.

---

## The route planner

The part of the site that does something a brochure cannot. The client picks
cities; the planner measures the journey and says whether the order makes
sense.

### Distance

Great-circle distance (haversine) multiplied by a **road factor** of 1.25,
editable in settings. Straight-line distance badly understates real driving in
Uzbekistan, where roads bend around the Kyzylkum. Tashkent–Samarkand comes out
at 332 km against a real road distance of roughly 300 km; Bukhara–Khiva at
482 km against roughly 450 km. Close enough to plan with, and labelled as
approximate.

### Detecting backtracking

The four cities sit on a near-straight east–west corridor: Tashkent 69.2°E →
Samarkand 67.0°E → Bukhara 64.4°E → Khiva 60.4°E. So "does this route double
back?" becomes a one-dimensional question.

1. Find the **dominant axis** of the selected cities — the line between the two
   furthest apart, measured in kilometres so latitude and longitude are
   comparable.
2. Project every city onto that axis.
3. Walk the route and count how many times the direction of travel flips.
   Movements under 60 km are ignored, so a wobble between two nearby cities is
   not reported as a reversal.
4. If the chosen order is already the shortest possible, the count is cleared —
   a shortest route cannot contain an *unnecessary* detour, whatever shape it
   makes on a map.

Using the dominant axis rather than raw longitude means the test still works
for north–south sets and for clusters around one city.

### The verdict

Driven by the number of reversals, not by the distance ratio:

| Reversals | Verdict | What the client sees |
|---|---|---|
| 0, ≥97% efficient | Excellent · 很合理 | "One clean run along the corridor." |
| 0 | Good · 不错 | Nothing doubles back; a shorter order exists but barely |
| 1 | One detour · 一次绕行 | Named, costed, and explicitly allowed |
| 2 or more | Backtracking · 存在折返 | "This route contains unnecessary backtracking." |

This ordering is deliberate, and it is the specification you gave me:

- **Tashkent → Samarkand → Bukhara → Khiva** — 1,087 km, 8–10 days, Excellent.
- **Tashkent → Bukhara → Samarkand** — one reversal. 73% efficient, which looks
  bad as a percentage, but people do this for a flight time. Flagged gently,
  not scolded.
- **Tashkent → Khiva → Samarkand → Bukhara → Tashkent** — two reversals.
  81% efficient, which looks *better* as a percentage, yet this is the case
  worth catching: 472 km wasted.

A ratio-based verdict gets those last two backwards. That is why the reversal
count leads.

Whatever the verdict, **Optimise route** and **Keep my order** sit side by
side. The site never rewrites a client's route without being asked.

### Round trips

If the last city equals the first, it is a round trip. The closing leg is
excluded from the analysis — returning to your arrival airport is the point of
a round trip, not an error. Optimisation preserves the round-trip shape.

### Finding the shortest order

Up to 8 free cities, every permutation is evaluated — at most 5,040 orders with
a pinned start, which is instant. Above that, a nearest-neighbour seed followed
by 2-opt local improvement.

### Trip length

Days on the ground (each city's `recommendedDays`) plus travel: legs under
350 km add nothing, since the morning train covers them; up to 550 km adds half
a day; longer desert crossings add a full day. Shown as a two-day range,
because no trip is precise to the day.

---

## Admin panel

Open `/admin/` on the deployed site.

| Tab | What it does |
|---|---|
| Dashboard | Counts, plus checks: orphaned places, cities with no places, tours with no days, places with no photograph, places still on stock photography |
| Cities | Add, edit, delete, reorder. Bilingual name, region, tagline, description, travel info; coordinates; recommended days; cover image and gallery |
| Places | Same, filtered by city. Category, address, coordinates, visit duration, and **1–10 images** with reordering, per-image credit, and delete |
| Tours | One city, one to three days. Bilingual day titles and notes, ordered stops picked from that city's places |
| Contact & settings | Your name, hero text, WeChat ID and QR, Telegram, phone, email, road factor |
| Publish | Download JSON, or connect GitHub |

Edits save into your browser as you type. Nothing reaches the live site until
you save. Before saving, **Preview the site** opens the real pages running
against your unpublished changes, with an orange bar so you cannot forget.

### The WeChat QR is the most important field on the site

Your clients will screenshot it. Upload a clean, high-resolution export from
WeChat, not a photo of a screen. It renders at 96px on the contact cards and
opens full-screen when tapped.

### If you do connect GitHub

1. **Settings → Developer settings → Personal access tokens → Fine-grained
   tokens → Generate new token**.
2. Repository access: **Only select repositories** → this one.
3. Permissions: **Contents → Read and write**. Nothing else.
4. In the admin Publish tab: fill in owner / repository / branch, paste the
   token, press Connect.

**Security, stated plainly.** There is no login on `/admin/` and there cannot
be one. GitHub Pages serves static files; there is no server here that could
hold a secret or check a password. What the site does instead: no token is ever
stored in the repository, in the source, or in localStorage. You paste it per
session, it lives in `sessionStorage`, it is gone when the tab closes. Someone
who opens `/admin/` sees the interface but cannot change anything without their
own token, scoped to this one repository.

If you ever need a real login, the site has to stop being static. The usual
routes are a small OAuth proxy (Cloudflare Worker, Netlify Function) or a
hosted CMS such as Decap pointed at the same repository. The JSON structure
here works unchanged with either.

---

## Project structure

```
/
├── index.html            home — hero, cities, planner teaser, about you, contact
├── cities.html           all cities
├── city.html             ?id=…   city detail, places, filters, map
├── tours.html            all fixed tours, filterable
├── tour.html             ?id=…   day-by-day itinerary
├── planner.html          ?cities=…&round=1   the route planner
├── contact.html          WeChat / Telegram / phone
├── .nojekyll             stops GitHub processing the files
├── admin/index.html      the whole admin panel
├── css/
│   ├── main.css          design system + every public page
│   └── admin.css         admin layout, same tokens
├── js/
│   ├── core.js           data loading, both dictionaries, nav/footer, gallery,
│   │                     lightbox, modal, search, maps, error states
│   ├── route.js          pure route maths — no DOM, testable in Node
│   ├── planner.js        the planner page
│   ├── site.js           every other page renderer
│   ├── github.js         GitHub API: read, commit, upload
│   └── admin.js          admin CRUD and saving
├── data/
│   └── cities.json  places.json  tours.json  settings.json
├── tools/
│   └── fetch-images.py   download remote photos into the repository
└── assets/
    ├── images/{cities,places,tours,contact}/
    └── icons/favicon.svg
```

### Why there is no `responsive.css`

Media queries live next to the rules they modify, at the bottom of `main.css`.
A parallel breakpoint file drifts out of sync with the rules it overrides; this
does not.

---

## Data shapes

Any text field may be a plain string or an object keyed by language. Both work;
the admin panel writes objects.

**City**

```json
{
  "id": "samarkand",
  "name": { "en": "Samarkand", "zh": "撒马尔罕" },
  "region": { "en": "Samarqand Region", "zh": "撒马尔罕州" },
  "tagline": { "en": "…", "zh": "…" },
  "description": { "en": "…", "zh": "…" },
  "travelInfo": { "en": "…", "zh": "…" },
  "coverImage": { "src": "assets/images/cities/samarkand-01.jpg", "credit": "…" },
  "gallery": [ { "src": "…", "credit": "…", "page": "…" } ],
  "latitude": 39.6542,
  "longitude": 66.9597,
  "recommendedDays": 2
}
```

**Place** — `images` holds 1 to 10 entries; the first is used on cards.

```json
{
  "id": "registan",
  "cityId": "samarkand",
  "name": { "en": "Registan Square", "zh": "雷吉斯坦广场" },
  "category": "architecture",
  "shortDescription": { "en": "…", "zh": "…" },
  "description": { "en": "…", "zh": "…" },
  "address": "Registan Street, Samarkand",
  "latitude": 39.6547,
  "longitude": 66.9758,
  "visitDuration": 120,
  "images": [ { "src": "…", "credit": "…", "page": "…" } ]
}
```

**Tour** — always one city, one to three days.

```json
{
  "id": "samarkand-2day",
  "title": { "en": "Samarkand in Two Days", "zh": "撒马尔罕两日" },
  "cityId": "samarkand",
  "duration": 2,
  "coverImage": { "src": "…", "credit": "…" },
  "description": { "en": "…", "zh": "…" },
  "notes": { "en": "…", "zh": "…" },
  "days": [
    {
      "title": { "en": "The Timurid centre", "zh": "帖木儿王朝核心区" },
      "placeIds": ["registan", "gur-e-amir"],
      "note": { "en": "…", "zh": "…" }
    }
  ]
}
```

An image may also be a plain URL string. Categories are defined in
`settings.json`, so adding one needs no code change.

---

## Design

The palette comes from Timurid majolica rather than a template: a lapis ground
(`#061426`–`#17456F`), turquoise glaze (`#35B0AE`), saffron for actions
(`#E3A53E`), madder red reserved for backtracking warnings (`#CB5140`), and
ganch-plaster chalk for text (`#F4EFE6`). Dark surfaces because the site is
photograph-led and tilework blue is the subject's own material.

Type is Bricolage Grotesque for display, Karla for body, DM Mono for anything
numeric — distances, durations, coordinates, day counts. The mono face earns
its place: this site is full of measurements. Chinese falls back to the system
UI font, which is the right choice; bundling a Chinese webfont would add
several megabytes.

One motif recurs and nowhere else: an eight-point girih star. It is the bullet
on every section eyebrow, the node on the route ribbon, the map pin, and the
pattern drawn when an image fails to load.

The signature element is the **route ribbon** on the planner — the journey
drawn as a caravan line with star nodes, distances in mono along the connecting
line, and any retraced leg rendered in madder with a mark that visibly doubles
back. Backtracking is something you see, not something you are told.

---

## Robustness

- **Missing or broken images** render a deterministic girih tile generated from
  the item's id — never a broken-image icon.
- **Failed JSON load** shows a readable error state with a reload button.
- **Unknown city or tour id** shows an empty state with a way back.
- **Map failure** falls back to a panel listing the coordinates. Leaflet is
  only fetched when a map is actually on screen.
- **Missing translation** falls back to English rather than blank.
- **Empty states** for cities with no places, tours with no days, filters with
  no matches, searches with no hits.
- **Corrupt admin draft** falls back to the published files.
- **Unsaved changes** trigger the browser's leave warning.

Nothing white-screens.

## Accessibility and performance

Semantic landmarks, a skip link, `alt` on every image, `aria-pressed` on filter
chips, `aria-current` on navigation, arrow-key support in the gallery and
search results, Escape to close the modal and lightbox, visible focus rings,
and `prefers-reduced-motion` honoured. `<html lang>` follows the chosen
language.

All images below the fold are lazy-loaded. No framework, no bundler, no
polyfills. Leaflet is the only third-party dependency and loads on demand.

---

## What to change first

1. Run `tools/fetch-images.py` and commit the local images.
2. Upload your real WeChat QR in **Contact & settings**.
3. Replace the phone number, WeChat ID and Telegram handle — the current ones
   are placeholders.
4. Add a photograph of yourself. `settings.guidePhoto` drives the portrait on
   the home page; without it the hero image is reused, which wastes the best
   selling point on the site.
5. Start swapping stock photos for your own, city by city. The dashboard counts
   how many are left.
