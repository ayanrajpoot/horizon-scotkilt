# SCOTKILT — Store map

Living map of template → sections → settings, plus a running change log.
Update this file with **every** change. See [DESIGN-TOKENS.md](DESIGN-TOKENS.md)
for the palette, type scale and band inventory this maps against.

---

## 0. Baseline (recorded before any edit)

* Theme: **Shopify Horizon**, stock, essentially unconfigured.
* `shopify theme check`: **358 files inspected, 6 offenses across 2 files — 0 errors, 6 warnings.**
  All six are `UnusedDocParam` in `snippets/divider.liquid` and one sibling.
  This is the line not to regress.
* `settings_data.json` palette is stock: background `#ffffff`, foreground `#000000`,
  color1 `#333333`, color2 `#EEF1EA`, color3 `#DFDFDF`. Fonts are all Inter.
  `page_width: narrow`.
* Templates are near-empty — `index.json` is a stock hero + product list;
  `content_for_index` is `[]`.
* Git: initial commit `671e930`, remote `github.com/ayanrajpoot/horizon-scotkilt`.
  The store is **not** yet two-way synced — once it is, `git fetch` before touching
  any `templates/*.json`, `sections/*-group.json` or `config/settings_data.json`,
  and keep the **remote** side on conflict.

---

## 1. Theme primitives (the audit)

Where the theme's own machinery lives. Prefer these over new code.

| Concern | Lives in | Notes |
|---|---|---|
| Global palette | `config/settings_data.json` → `current.color_palette` (5 slots: background, foreground, color1–3) | Rendered by `snippets/color-palette.liquid` |
| Derived colour vars | `snippets/color-palette.liquid` | Emits `--color-background`, `--color-foreground`, `--color-border`, `--palette-lightest`, `--palette-darkest`, all button/input/variant tokens |
| **Per-section recolour** | `snippets/contrast-override.liquid`, called by `snippets/section.liquid` | **This is the lever.** Set a section's `background_color` and it emits a scoped `.color-custom-{id}` rule redefining `--color-background`, `--color-foreground`, `--color-border`, muted/subdued. Everything beneath recolours in one rule. |
| Smart contrast | `contrast-override.liquid` | Picks `--palette-lightest` / `--palette-darkest` when `page_text_color` fails a 4.5 contrast check against the section background |
| Type scale / spacing / radius / z-index / easing | `snippets/theme-styles-variables.liquid` (687 lines) | Fluid `clamp()` presets built from `type_size_h1…h6`; `--layer-*` z-index ladder; `--style-border-radius-*`; `--ease-out-*` |
| Fonts | 4 roles: `type_body_font` (primary), `type_subheading_font` (secondary), `type_heading_font` (tertiary), `type_accent_font`; `snippets/fonts.liquid` | Per-preset assignment via `type_font_h1…h6` = `heading` / `subheading` / `body` / `accent` |
| CSS entry point | `snippets/stylesheets.liquid` → `assets/base.css` (1838 lines) | Only place to add a custom stylesheet |
| Page width | `settings.page_width` → `.page-width-{narrow\|normal\|wide\|content}` on `<body>`, `--page-width` / `--page-margin` in `base.css` | |
| Layout shell | `layout/theme.liquid` | header-group → `#MainContent` → footer-group, then cart drawer, theme drawer, search modal, quick-add modal |

### Reusable snippets — do not reimplement these

`add-to-cart-button` · `buy-buttons-styles` · `variant-main-picker` ·
`variant-swatches` · `swatch` · `quantity-selector` · `pagination-controls` ·
`price` / `format-price` / `unit-price` / `strikethrough-variant` ·
`product-card` / `product-grid` / `card-gallery` · `collection-card` ·
`cart-items-component` / `cart-summary` / `cart-drawer` / `cart-bubble` ·
`list-filter` / `price-filter` / `filter-remove-buttons` / `sorting` ·
`mega-menu-list` / `header-drawer` / `header-actions` / `header-row` ·
`accordion-custom-component` · `search-modal` / `predictive-search-*` ·
`resource-list` / `resource-list-carousel` · `icon` · `media` / `image` / `video` ·
`slideshow` + `slideshow-arrows` / `slideshow-controls`.

### Block library

91 files in `blocks/`. `section.liquid` and most sections accept `@theme`, which
means **any** of them can nest: `group`, `text`, `button`, `image`, `icon`, `video`,
`spacer`, `accordion`, `product-card`, `collection-card`, `featured-collection`,
`email-signup`, `menu`, `social-links`, `swatches`, `variant-picker`, `buy-buttons`,
`quantity`, `price`, `sku`, `product-description`, `product-recommendations`,
`filters`, `comparison-slider`, `jumbo-text`, `marquee`, `custom-liquid`.

`sections/section.liquid` alone ships **13 presets**: custom section, rich text,
FAQ, video, pull quote, contact form, email signup, icons with text, split showcase,
image with text, multicolumn, image compare, large logo. It is the workhorse — most
mock bands are a configured `section`, not new code.

---

## 2. Section-by-section mapping

Legend — **Native**: configure an existing section, no new files.
**Restyle**: existing section + namespaced CSS.
**New**: needs `sections/xx-*.liquid`.

### 2.1 Global chrome

| Mock band | Theme home | Verdict | Notes |
|---|---|---|---|
| Announcement bar (ink, 34px, tracked uppercase) | `sections/header-announcements.liquid` + `blocks/_announcement.liquid` | **Native** | Set `background_color` = ink; text auto-contrasts to ivory |
| Sticky header, 3-col grid, 72px | `sections/header.liquid` | **Native** | `logo_position: center`, `menu_position: left`, `enable_sticky_header: always`, `section_height: standard`, `background_color_top` = ivory |
| Full-width mega menu | `snippets/mega-menu-list.liquid` | **Native + Admin** | Driven entirely by link-list depth. **Needs the menu built in Admin → Navigation** (see §5) |
| Full-width search overlay | `snippets/search-modal.liquid` + `sections/predictive-search.liquid` | **Restyle** | Theme uses a modal, mock uses a header-anchored drop panel. Restyle the modal rather than rebuild |
| Mobile drawer nav | `snippets/header-drawer.liquid` + `snippets/theme-drawer.liquid` | **Restyle** | Accordion behaviour already matches |
| Cart drawer | `snippets/cart-drawer.liquid` + `sections/cart-drawer-section.liquid` | **Restyle** | `settings.cart_type` is already `drawer` |
| Footer, `1.4fr + 4×1fr` | `sections/footer.liquid` (blocks: group, menu, text, logo, social-links, email-signup) + `sections/footer-utilities.liquid` | **Native** | Brand column = group(logo + text + image strip); 4 menu blocks; utilities row for legal + copyright + social |

### 2.2 Home — `templates/index.json`

| # | Mock band | Theme section | Verdict |
|---|---|---|---|
| 1 | Hero | `sections/hero.liquid` (3 presets) — blocks: text, button, group, spacer | **Native** — background image + overlay + `section_height: full-screen`; stat row = group of text blocks |
| 2 | Trending Tartans rail | `sections/collection-list.liquid` (4 presets, carousel-capable) | **Native** — tartans modelled as collections |
| 3 | Shop by Kilt Type | `sections/collection-list.liquid`, grid, 3-up | **Restyle** — needs 3:4 ratio + bottom scrim + ghost button overlay via `blocks/_collection-card.liquid` styling |
| 4 | Popular Kilts rail | `sections/product-list.liquid` (3 presets, carousel) | **Native** |
| 5 | Shop by Tartan tiles | `sections/collection-list.liquid`, 4-up, square | **Native** — `background_color` = ink |
| 6 | Featured Collection split | `sections/media-with-content.liquid` ×2, or `section` preset *split showcase* | **Restyle** — mock's 620px-min scrimmed panel |
| 7 | Why SCOTKILT trust grid | `section` preset *icons with text* | **Restyle** — mock's version has internal 1px dividers, not cards |
| 8 | Kilt Finder | — | **New** → `sections/xx-kilt-finder.liquid`. Interactive select→result; no native equivalent |
| 9 | Size Guide steps | `section` preset *image with text* + group of text blocks | **Restyle** — numbered steps with top rules |
| 10 | Brand Story | `sections/media-with-content.liquid` | **Restyle** — overlapping inset image needs CSS |
| 11 | Reviews | `section` + `blocks/review.liquid` | **Native** — `blocks/review.liquid` already exists |
| 12 | FAQ | `section` preset *FAQ section* + `blocks/accordion.liquid` | **Native** |
| 13 | SEO copy | `section` preset *rich text*, 1fr/2fr group | **Native** |
| 14 | Newsletter | `section` preset *email signup* | **Native** — `background_color` = ink |

**13 of 14 home bands are native or restyle. One new section.**

### 2.3 Collection — `templates/collection.json`

| Mock band | Theme section | Verdict |
|---|---|---|
| Breadcrumbs | — | **New** → `snippets/xx-breadcrumbs.liquid` (theme has none) |
| `.cat-hero` | `sections/section.liquid` (existing `section` block in template) + `blocks/collection-title`, `_collection-info`, `image` | **Restyle** |
| Sub-collection chips | `sections/collection-links.liquid` (2 presets) | **Native** |
| Filter rail + toolbar + grid | `sections/main-collection.liquid` + `blocks/filters.liquid` + `snippets/list-filter`, `price-filter`, `sorting`, `filter-remove-buttons`, `pagination-controls` | **Restyle** — all behaviour exists, including the mobile filter drawer |
| Related tartans rail | `sections/collection-list.liquid` | **Native** |
| `.cat-content` prose + TOC | `section` preset *rich text* | **Restyle** — sticky TOC is the only new part |
| `.cat-size` strip | `section` preset *multicolumn* | **Native** |
| `.cat-faq` | `section` preset *FAQ section* | **Native** |
| `.cat-related` | `sections/collection-list.liquid` | **Native** |
| `.cat-cta` | `section` preset *custom section* | **Native** |

**Note:** the per-collection editorial (hero copy, prose, FAQ, CTA) differs per
collection in the mock. In Shopify that means either per-collection templates
(`collection.tartan.json`, …) or collection metafields. Decision pending — logged
in §5.

### 2.4 Product — `templates/product.json`

| Mock band | Theme section | Verdict |
|---|---|---|
| Gallery (sticky, thumbs, caption) | `blocks/_product-media-gallery.liquid` + `snippets/product-media-gallery-content` | **Native** — already `thumbnail_position: right`; switch to below + restyle |
| Buy box | `sections/product-information.liquid` + blocks `product-title`, `price`, `variant-picker`, `swatches`, `quantity`, `buy-buttons`, `add-to-cart`, `sku`, `product-inventory`, `product-custom-property` | **Restyle** — every atom exists |
| Details accordions | `blocks/accordion.liquid` + `blocks/product-description.liquid` | **Native** |
| Complete the look | `sections/product-list.liquid` or `blocks/featured-collection.liquid` | **Native** |
| Sibling / related rails | `sections/product-recommendations.liquid` (already in template) + `product-list` | **Native** |
| Reviews summary + list | `blocks/review.liquid` | **Restyle** — distribution bars are new |
| PDP FAQ | `section` preset *FAQ section* | **Native** |
| Sticky buy bar | — | **New** → `sections/xx-buy-bar.liquid`. **`z-index: 90` in the mock sits below the header — in Horizon use `var(--layer-sticky)` (8), under `--layer-header-menu` (12). Do not invent a number.** |

### 2.5 Cart — `templates/cart.json`

Mock has no cart page. Keep `main-cart` as-is and **restyle the drawer**
(`snippets/cart-drawer.liquid`) to match `.cart`. The cart page inherits the same
tokens for free.

### 2.6 Remaining routes

`page.json`, `blog.json`, `article.json`, `search.json`, `404.json`,
`list-collections.json`, `page.contact.json` all map to the mock's generic
`Page()` shell — a heading, an intro, and content. All **native**; they only need
the global recolour plus breadcrumbs.

---

## 3. Recolour plan (through the theme's own system, not per element)

Set once in `config/settings_data.json` → `current`:

```
color_palette.background  #f3efe7   ivory   → --color-background, --palette-lightest
color_palette.foreground  #1c1b19   ink     → --color-foreground, --palette-darkest
color_palette.color1      #8c2a2f   red     accent
color_palette.color2      #a88a55   brass   accent
color_palette.color3      #cbc2b1   stone   borders / hairlines
```

Because ivory is the brightest and ink the darkest palette entry,
`--palette-lightest` resolves to ivory and `--palette-darkest` to ink. A section
with `background_color: #1c1b19` then gets ivory text automatically via
`contrast-override.liquid` — that is `.section--dark`, for free, with no per-element
CSS. This is the whole reason the palette is chosen this way; **do not add a colour
brighter than ivory or darker than ink to the palette**, or the dark bands lose
their text colour.

Buttons (see DESIGN-TOKENS §1.2 — *ink and ivory, never red or brass*):

```
palette_primary_button_background   #1c1b19  ink
palette_primary_button_text         #f3efe7  ivory
palette_primary_button_border       #1c1b19
primary_button_border_width         0
button_border_radius_primary        2

palette_secondary_button_background transparent
palette_secondary_button_text       #1c1b19
palette_secondary_button_border     #1c1b19
secondary_button_border_width       1
button_border_radius_secondary      2
```

Radius everywhere: `pills_border_radius` 20, `inputs_border_radius` 2,
`popover_border_radius` 2, `product_corner_radius` 2, `card_corner_radius` 2,
`variant_swatch_radius` 100, `badge_corner_radius` 2.

Badges: `badge_sale_background_color` = red, `badge_text_transform` = uppercase.

Type: `type_heading_font` → Cormorant Garamond; `type_body_font` /
`type_subheading_font` → Manrope (**availability in Shopify's font picker is
unverified — see §5**). Sizes `h1` 104 → h6 12 per DESIGN-TOKENS §2.2;
`type_line_height_h1` `display-tight`; `type_letter_spacing_*` `heading-tight`
(`-.03em`, nearest to the mock's `-.01em`).

`page_width`: `wide` (1440px container). `card_hover_effect`: `none` (the mock does
its own).

The residue — wide letter-spacing on uppercase micro-type, the retracting `.link`
underline, scrim gradients, edge-bleed mobile rails, the trust-grid dividers —
cannot be expressed as settings and goes in one namespaced stylesheet,
`assets/xx-scotkilt.css`, loaded by appending one line to
`snippets/stylesheets.liquid`.

---

## 4. Namespace and safety rules for this build

* New sections: `sections/xx-*.liquid`. New snippets: `snippets/xx-*.liquid`.
  New CSS: `assets/xx-*.css`.
* **Nothing is deleted.** Before replacing a JSON template, copy it to
  `templates/<name>.old.json` so it stays selectable in the theme editor.
* Restyle before building. Build only when no native section can be configured to match.
* `shopify theme check` must stay at 0 errors / 6 warnings.
* Verify in a browser, not by re-reading the CSS. Asset CSS/JS can lag the store by
  a minute or more after a push — Liquid and JSON land in seconds.

---

## 5. Action needed in Admin

Things that cannot be done in code. Nothing here is faked or silently skipped.

1. **Navigation menus.** The mega menu is entirely link-list driven. Create in
   Admin → Navigation, matching `NAV` in `pages.html` (lines 1181–1209):
   * `main-menu` — Kilts, Tartans, Shop, Guides, About
   * Child lists for Kilts (Kilt styles: Tartan/Utility/Leather/Hybrid/Contemporary/Traditional; Collections: Best Sellers/New Arrivals/All Kilts), Tartans (Discover ×5, By colour ×5), Shop (×4), Guides (×6)
   * Four footer menus: Shop (8), Tartans (4), Help (6), About (4)
2. **Collections.** Six kilt categories (`tartan`, `utility`, `leather`, `hybrid`,
   `contemporary`, `traditional`) plus Best Sellers and New Arrivals. The 8
   "Shop by Tartan" tiles and ~15 tartans also need collections if they are to be
   browsable.
3. **Products and tagging.** Home bands filter on *featured / trending / best
   seller / new*. These need product tags or metafields; the mock's `PRODUCTS`
   array is placeholder data with `rating: null` and `reviewCount: 0`.
4. **Product photography.** The `.kv` / `.swatch` procedural visuals are explicitly
   placeholders ("replaced by real photography the moment `image` is set"). Real
   kilt and tartan images are required — there is no code substitute.
5. **Font availability — open question.** Cormorant Garamond is in Shopify's font
   library. **Manrope may not be.** If the font picker does not offer it, the
   options are (a) nearest Shopify-hosted sans — Jost, Archivo or Work Sans — or
   (b) a Google Fonts `<link>` added to `layout/theme.liquid`, which puts the body
   face outside the theme's own font system. **Needs a decision before the type
   pass.**
6. **Per-collection editorial.** Each category page in the mock has unique hero
   copy, prose, spec table, FAQ and CTA. Choose: per-collection JSON templates
   (more editor-visible, more files) or collection metafields (one template, content
   in Admin). **Needs a decision before the collection pass.**
7. **Reviews provider.** The mock ships explicit "Sample review" placeholders and a
   visible note that no reviews exist. Keep that honesty until a reviews app is
   connected; do not invent reviews or star ratings.
8. **Policy pages.** Privacy, Terms, Shipping, Returns are linked in the footer and
   need real content.
9. **Store not yet linked.** No `.shopify/` directory and no dev store connected, so
   nothing has been verified live yet. A store connection (`shopify theme dev`) is
   required before the "verify in the browser" step of any page.

---

## 6. Change log

| Date | Change | Why |
|---|---|---|
| 2026-09-24 | Initial commit `671e930` — stock Horizon imported, repo created, pushed to `github.com/ayanrajpoot/horizon-scotkilt` | Baseline |
| 2026-09-24 | Added `docs/DESIGN-TOKENS.md` and `docs/STORE-MAP.md`; recorded theme-check baseline (0 errors / 6 warnings, 358 files) | Audit before any edit, per the brief |

*No theme files have been modified yet.*
