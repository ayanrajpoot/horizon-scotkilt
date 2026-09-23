# SCOTKILT — Design tokens

Extracted from `pages.html` (the design source of truth). When this document and
the theme disagree, `pages.html` wins; when this document and `pages.html`
disagree, `pages.html` wins and this file is wrong — fix it.

Source: `pages.html` lines 22–42 (`:root`) plus every rule that consumes them.

---

## 1. Colour palette

### 1.1 Raw tokens

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#1c1b19` | Page text. **Primary button background.** Dark section background. Badge `--ink`. Announcement bar bg. |
| `--ink-2` | `#2b2925` | Body copy in dense prose (`.prose`, `.pdp-buy__short`, `.dacc__body`, `.fopt2`) |
| `--ink-3` | `#3d3a35` | **Primary button hover background only** (`.btn--ink:hover`) |
| `--ivory` | `#f3efe7` | Page background. Header/drawer/cart/mega bg. **Text on dark.** **Button background on dark surfaces** (`.btn--ivory`). |
| `--ivory-2` | `#ebe5da` | Alternating band background (`.section--ivory2`), footer bg, icon-chip bg, card media placeholder, `.callout` bg |
| `--ivory-3` | `#e2dbcd` | Progress/meter track only (`.cat-more__bar`, `.rev__bar i`) |
| `--stone` | `#cbc2b1` | Lede text **on dark** sections. Quantity-stepper border. |
| `--stone-2` | `#b3a893` | Dashed empty-state borders, prose link underline, hover border on swatches |
| `--grey` | `#7a7469` | Lede / secondary text **on light** |
| `--grey-2` | `#a59e91` | Tertiary text: struck compare-at price, SKU, input placeholder, filter counts |
| `--red` | `#8c2a2f` | **ACCENT, NOT A BUTTON.** Link hover, active wishlist heart fill, validation errors, "accent" nav links, `badge--red` (= *Trending*) |
| `--green` | `#2f4a3b` | `badge--green` background only (= *New*). One use in the whole mock. |
| `--navy` | `#27354f` | **Declared but never used.** Do not introduce it. |
| `--brass` | `#a88a55` | **ACCENT, NOT A BUTTON.** `:focus-visible` outline, eyebrows, step numerals, `li::before` dashes, star stroke/fill, `.callout` left rule, `badge--brass` (= *Featured*) |
| `--brass-2` | `#c9ab72` | Hero kicker (italic serif), newsletter success message, buckle dot, empty-state icon |

Aliases: `--bg: var(--ivory)`, `--fg: var(--ink)`. These are re-pinned to the same
values under both `prefers-color-scheme: dark` and `[data-theme="dark"]` — **the
storefront is light-only by design**; there is no dark mode to honour.

### 1.2 The button/accent trap

Read this before touching any colour setting.

* **Buttons are ink and ivory.** Never red, never brass.
  * `.btn--ink` — bg `--ink`, text `--ivory`, hover bg `--ink-3`. The primary CTA on light bands.
  * `.btn--ivory` — bg `--ivory`, text `--ink`, hover bg `#fff`. The primary CTA on dark bands.
  * `.btn--line` — transparent, 1px `--ink` border, `--ink` text; hover inverts to ink/ivory. Secondary CTA on light bands.
  * `.btn--ghost` — transparent, 1px `rgba(ivory,.55)` border, `--ivory` text. Secondary CTA on dark bands.
* **Red and brass are accents only.** Red = hover / alert / "Trending". Brass = focus ring, eyebrow, ornament. A red or brass button does not exist anywhere in the mock.

### 1.3 Derived surfaces

Hairlines are **not** a palette colour — they are the foreground at low alpha:

| Use | Value |
|---|---|
| Rule / divider on light | `rgba(28,27,25,.08)` header & drawers · `.10` cards · `.12` trust/steps/accordions · `.14` filters & buy box |
| Rule on dark | `rgba(243,239,231,.18 – .22)` |
| Input border on dark | `rgba(243,239,231,.35)`, focus `--ivory` |
| Image scrim (bottom-up) | `linear-gradient(180deg, rgba(28,27,25,0), rgba(28,27,25,.78–.85))` |
| Hero scrim (left-to-right) | `rgba(28,27,25,.88) → .66 @32% → .22 @62% → .06`, plus a vertical pass |
| Modal backdrop | `rgba(28,27,25,.55)`; drawer backdrop `.45` |

### 1.4 Badges

`.badge` is 10.5px / 700 / `.12em` / uppercase, padding `5px 9px`, radius 2px.
Default = ink text on ivory.

| Modifier | Background | Text | Used for |
|---|---|---|---|
| `badge--ink` | `--ink` | `--ivory` | Best Seller, Popular |
| `badge--red` | `--red` | `--ivory` | Trending |
| `badge--brass` | `--brass` | `--ink` | Featured |
| `badge--green` | `--green` | `--ivory` | New |

---

## 2. Typography

### 2.1 Families

```
--serif: 'Cormorant Garamond', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif
--sans:  'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif
```

Loaded from Google Fonts: Cormorant Garamond 500 / 600 / 500-italic; Manrope 400 / 500 / 600 / 700.

* **Serif** — all of `h1`–`h4`, buy-box prices, pull quotes, stat numerals, accordion headers, empty-state headlines, the logo wordmark, and the hero kicker (italic). Weight **500** (600 for the logo), `line-height: 1.05`, `letter-spacing: -.01em`.
* **Sans** — body, navigation, buttons, labels, badges, eyebrows, and — deliberately — **product-card titles**: `.pcard h3` is 18px / 600 sans with `letter-spacing: 0`, overriding the global serif `h3`.

### 2.2 Scale

| Class | Size | Line height |
|---|---|---|
| `.h1` | `clamp(46px, 7.2vw, 104px)` | `.98` |
| `.h2` | `clamp(34px, 4.2vw, 58px)` | 1.05 (inherited) |
| `.h3` | `clamp(24px, 2.4vw, 32px)` | 1.05 |
| `.lede` | `clamp(16px, 1.25vw, 19px)` | 1.55, `max-width: 58ch` |
| body | 16px | 1.6 |
| `.cat-hero h1` | `clamp(40px, 5vw, 72px)` | 1 |
| `.pdp-buy h1` | `clamp(32px, 3.4vw, 50px)` | 1.02 |
| `.prose` | 16.5px | 1.7, `max-width: 70ch` |

Fixed sizes recurring in components: 24px (`.tcard h3`, `.tf h3`, `.step h3`, `.ttile__label h3`), 26px (buy-box price, cart heading), 20px (`.rcat__label h3`), 14–15px (link/list text), 13px (buttons, nav), 12px (eyebrows, meta), 11px (column headings), 10.5px (badges).

### 2.3 Letter-spacing — the design's tell

Uppercase micro-type is spaced wide. Getting this wrong is the fastest way to make
the theme stop looking like the mock.

| Element | Spacing | Weight | Case |
|---|---|---|---|
| `.btn` | `.14em` | 700 | uppercase |
| `.nav__link` | `.16em` | 700 | uppercase |
| `.logo` | `.14em` | 600 | — |
| `.logo small` | `.32em` | 700 | uppercase |
| `.announce` | `.14em` (mobile `.1em`) | 600 | uppercase |
| Column headings (`.footer h4`, `.mega__col h4`, `.toc h2`) | `.2em` | 700 | uppercase |
| `.badge` | `.12em` | 700 | uppercase |
| `.cat-hero__eyebrow` | `.2em` | 700 | uppercase |
| `.pdp-buy__eyebrow` | `.16em` | 700 | uppercase |
| `.facts h2` | `.14em` | 700 | uppercase |
| `.opt__head strong` | `.06em` | 700 | uppercase |
| Headings (serif) | `-.01em` | 500 | none |

### 2.4 Links

`.link` is 14px / 600 / `.02em` with a **full-width underline that retracts on
hover** (`transform: scaleX(1) → scaleX(0)`, origin left → right, `.35s`). Prose
links use a static `--stone-2` bottom border that turns red on hover.

---

## 3. Space, measure, shape

| Token | Value |
|---|---|
| `--container` | `1440px` |
| `--gutter` | `clamp(20px, 4vw, 64px)`; forced to `20px` below 768px |
| `--header-h` | `72px`; `62px` below 1024px |
| `--announce-h` | `34px`; `30px` below 768px |
| `.section` padding | `clamp(56px, 7vw, 104px) 0`; flat `56px` below 768px |
| `.section--tight` | `clamp(40px, 5vw, 72px) 0` |
| Card grid gap | `clamp(14px, 1.6vw, 24px)` |
| Sticky offset | `calc(var(--header-h) + 20–24px)` |

**Radius is effectively zero.** Every rectangular surface is `border-radius: 2px` —
cards, buttons, inputs, badges, modals, media. Circles (`50%`) are used for icon
buttons, rail arrows, swatch variants, social links and accessory icon chips. Pills
(`16–20px`) appear only on filter chips and removable active-filter tags. There is
no medium radius anywhere in the mock.

Shadows are rare and soft:

```
--shadow-1: 0 1px 2px rgba(28,27,25,.06), 0 8px 24px -12px rgba(28,27,25,.18)
--shadow-2: 0 2px 6px rgba(28,27,25,.08), 0 24px 48px -20px rgba(28,27,25,.28)
```

`--shadow-2` is used on card hover, the story inset and the toast. The header
scroll shadow, mega menu and search overlay each use their own one-off long-throw
shadow.

---

## 4. Motion

`--ease: cubic-bezier(.22,.61,.36,1)`. Durations: `.2s` icon hover · `.25–.3s`
buttons and nav underline · `.35–.4s` accordions and drawers · `.5s` card image
crossfade · `1.1s` image zoom · `.9s` hero rise · `2.2s` hero settle.

Accordions animate `grid-template-rows: 0fr → 1fr` — no max-height hacks. Section
headers reveal on scroll via `.reveal → .reveal.in` (opacity + 18px rise, `.8s`),
driven by IntersectionObserver with `rootMargin: 0px 0px -8% 0px`. A
`prefers-reduced-motion` block flattens all of it.

---

## 5. Breakpoints

Four widths, max-width based:

| Breakpoint | What changes |
|---|---|
| `> 1200px` | product grid 4-up, accessories 8-up, related categories 5-up |
| `≤ 1200px` | product grid 3-up, accessories 4-up, related 3-up, category grid 2-up, narrower footer and mega menu |
| `≤ 1023px` | **desktop nav → burger + drawer**, header 62px, filters become a left drawer, every 2-col split stacks, sticky rails go static, PDP buy bar moves from top to bottom, trust grid 2-up |
| `≤ 767px` | gutter 20px, section padding flat 56px, product grid 2-up, category/reviews/related become edge-bleed snap rails, rail arrows hidden, quick-add hidden, sizes 4-up, hero apron removed |

Edge-bleed mobile rail pattern:
`margin: 0 calc(var(--gutter) * -1); padding: 4px var(--gutter) 20px; scroll-snap-type: x mandatory`, scrollbar hidden.

---

## 6. Layering

| z-index | Element |
|---|---|
| 2–6 | in-card badges, scrims, card bodies, `.kv` internal layers |
| 90 | PDP sticky buy bar — **below** the header |
| 99 | mega menu, search overlay (children of the header) |
| 100 | `.header` (sticky) |
| 150 | drawer backdrop |
| 160 | mobile nav, cart drawer, filters drawer |
| 170 | modal backdrop |
| 180 | toast |
| 200 | skip link |

`.kv` and `.swatch` set `isolation: isolate`, so anything inside them is trapped in
their stacking context — badges and wish buttons are deliberately *siblings* of the
visual, not children.

---

## 7. Pages and bands in the mock

### 7.1 Home (`/`) — 14 bands, in order

| # | Band | Background | Content |
|---|---|---|---|
| 1 | Hero | ink + full-bleed kilt visual + scrim | serif italic kicker, 2-line `.h1`, lede, 2 CTAs (ivory + ghost), 3 stat items |
| 2 | Trending Tartans | ivory | section head + "View all tartans" + rail arrows; rail of square tartan cards |
| 3 | Shop by Kilt Type | ivory-2 | 3×2 grid of 3:4 category cards — scrim, title, blurb, ghost button; mobile snap rail |
| 4 | Popular Kilts | ivory | section head + link + arrows; rail of 4:5 product cards |
| 5 | Shop by Tartan | **ink** | 4-up grid of square tartan tiles with gradient label bar |
| 6 | Featured Collection | ivory head → full-bleed 2-col | centred title + lede, then two 620px-min split panels (Traditional / Modern), ink-scrimmed, ivory buttons |
| 7 | Why SCOTKILT | ivory | 3×2 bordered trust grid — icon + 24px heading + copy |
| 8 | Kilt Finder | **ink** | 1.1fr/.9fr — 6 selectable option tiles left, sticky result panel right |
| 9 | Size Guide | ivory | 2-col — SVG figure on ivory-2 left, 3 numbered steps + ink button right |
| 10 | Brand Story | **ink** | full-bleed 2-col — tartan swatch with inset kilt card left, 4 paragraphs right (first para serif 22–26px) |
| 11 | Reviews | ivory-2 | 3 bordered quote cards + explicit "these are placeholders" note; mobile snap rail |
| 12 | FAQ | ivory | centred 860px column, 10 accordions, plus-icon that rotates 45° |
| 13 | SEO copy | ivory-2 | 1fr/2fr — sticky heading + swatch aside, 5 `h3` + paragraph blocks |
| 14 | Newsletter | **ink** | 2-col — heading + copy left, inline email form with ivory submit right |

Global chrome: announcement bar (ink, 34px) → sticky header (ivory, 72px, 3-column
grid, full-width mega menu and full-width search overlay) → … → footer (ivory-2,
`1.4fr + 4×1fr`, tartan swatch strip, bottom bar with legal links, copyright and
circular social icons).

### 7.2 Collection / category (`#/kilts/*`, `#/tartans/*`) — 10 bands

1. Breadcrumbs
2. `.cat-hero` — 1.15fr/.85fr: eyebrow, h1, lede, fact strip / 4:3 visual with caption (visual reorders above on mobile)
3. `.chips` — sub-collection pills with mini swatches; horizontal scroll on mobile
4. `.cat-layout` — 250px sticky filter rail + grid:
   * filters — collapsible groups, checkbox rows with swatch/dot/count, size button grid; becomes a left drawer ≤1023px behind a "Filters (n)" button
   * toolbar — result count + sort `<select>`
   * removable active-filter pills
   * product grid 3-up (2-up ≤1200px and ≤767px)
   * "load more" progress bar
5. `.cat-rail` — related tartans rail
6. `.cat-content` — 220px sticky TOC + `.prose` (h2/h3, dash bullets, `.callout`, `.spec` table)
7. `.cat-size` — ivory-2 strip, 1fr/3fr, three numbered cards
8. `.cat-faq` — 1fr/2fr accordions
9. `.cat-related` — 5-up related category tiles; mobile snap rail
10. `.cat-cta` — **ink** band, heading + copy + two buttons

### 7.3 Product (`#/product/*`) — 10 bands

1. Breadcrumbs
2. `.pdp-top` — 1.05fr/.95fr
   * `.pdp-gallery` (sticky) — 4:5 main slide, badges, wishlist, prev/next, caption overlay, 4-up labelled thumbnail strip
   * `.pdp-buy` — brass eyebrow links, h1, rating row, serif price + strikethrough + red save flag, tax note, short description, option groups (`.opt`: circular swatch variants, 6-up size grid with error state, length buttons), qty stepper + full-width ink CTA + wishlist square, secondary links, 3-up assurance row, dash "facts" list, SKU
3. `.pdp-details` — 260px sticky side panel + accordion stack (`.dacc`) with prose, spec tables, callouts
4. `.pdp-look` — "Complete the look", 4-up icon cards
5. Sibling rail — same tartan, other styles
6. Related grid — 4-up
7. `.rev` — 320px summary card (48px serif average, stars, distribution bars, write-review button) + review list / honest empty state
8. `.pfaq` — 1fr/2fr accordions
9. Recently viewed rail
10. `.buybar` — sticky mini buy bar; **top-anchored under the header on desktop (`z-index: 90`), bottom-anchored on mobile**

### 7.4 Cart

The mock has **no cart page** — only the right-hand `.cart` drawer: 440px, ivory,
rows of 72px thumb + details + stepper + price, subtotal, ink checkout button, and
an empty state with a `.btn--line` shortcut.

### 7.5 Everything else

`Page()` renders one shared shell for ~30 routes: breadcrumbs, `.page__head`
(h2 + 17px intro), then one of — a product grid, a tartan card grid, the size-guide
figure + steps, a wishlist grid, or a dashed `.page__empty` placeholder. Size guide,
wishlist, account, blog, about, contact, shipping, returns and the editorial guides
all use it.

---

## 8. Component inventory

* `.kv` — procedural kilt visual (pleats / apron / waistband / straps / lighting). **Replaced by real photography the moment an `<img>` is supplied.** Placeholder machinery, not a design requirement.
* `.swatch` — flat tartan fill; likewise a stand-in for a real swatch image.
* `.pcard` — product card: 4:5 media, hover crossfade to a second image, stacked badges top-left, round wish button top-right, quick-add revealed on hover (hidden on mobile), sans title, star row, price with strikethrough.
* `.tcard` — square tartan card: badges, 24px serif title, blurb, `.link`.
* `.ccard` / `.ttile` / `.rcat` — scrimmed tiles at 3:4, 1:1 and 4:5.
* `.rail` + `.rail-btn` — snap-scroll carousel with 46px circular outline arrows.
* `.faq__item` / `.dacc` / `.fgroup` / `.macc` — four accordions sharing one `0fr → 1fr` mechanism.
* `.sec-head` — flex row: title + lede left, tools (link, arrows) right; stacks on mobile.
* `.badge`, `.stars`, `.price`, `.btn`, `.ibtn`, `.chip`, `.qty` — atoms.
