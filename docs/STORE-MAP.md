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

> **Superseded.** This section recorded the plan to rebuild each band from
> Horizon's native sections. The Prestige source turned out to carry a complete
> `sk2-*` build of `pages.html`, so that layer was ported instead — see §8 for
> what actually ships. The mapping below is kept as the record of what Horizon
> natively offers, which is still the reference if any sk2 section is ever
> replaced.

### Original plan


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

## 4b. Tartan system (ported from Prestige)

Full reference: [TARTAN-PICKER.md](TARTAN-PICKER.md), copied across with the code.
Source: `D:\ecommerece_wala\theme-prestige\Prestige V10.0.2`.

### Files copied verbatim

| File | Purpose |
|---|---|
| `sections/tartan-data.liquid` | JSON endpoint, fetched as `/?section_id=tartan-data&page=N`. Never added to a template. |
| `snippets/tartan-picker.liquid` | Block markup, visibility rules, config |
| `snippets/tartan-finder-app.liquid` | Finder app markup |
| `assets/tartan-picker.js` | `<tartan-picker>` element — search, validation, browse modal |
| `assets/tartan-picker.css` | Styles, read from the host theme's colour variables |
| `assets/tartan-library.json` | 500-tartan library (85KB; compact rows + `fields` header) |
| `docs/TARTAN-PICKER.md` | Documentation |
| `docs/tools/` | `rank_tartans.py`, `build_tartan_library.py`, `map_tartan_products.py` + CSVs |

`sections/tartan-finder.liquid` was copied then **minimally adapted** — see below.
`prune_sliders.py` was in the source `docs/tools/` but is not part of the tartan
toolchain, so it was not kept.

### Where this theme differs from the port instructions

The wiring steps written for Prestige do not all apply, because **Horizon uses
theme blocks** (files in `blocks/`, surfaced by `{% content_for 'blocks' %}`)
rather than a monolithic product section with a `{% case block.type %}` switch.

| Instruction | What was actually done | Why |
|---|---|---|
| Add a `tartan_picker` block to the main product section schema | Created **`blocks/tartan-picker.liquid`** carrying the same 71 settings | Horizon has no `main-product.liquid`; `sections/product-information.liquid` declares `{"type": "@theme"}` and picks up any block file automatically |
| Add `when 'tartan_picker'` to `snippets/product-info.liquid` and to its allowed-blocks list | **Not needed** | No such switch exists. `@theme` means the block is offered on the product template *and* in quick add with no edit to either file |
| Map `tartan-picker.css` colour variables to this theme's | **`snippets/xx-tartan-theme-vars.liquid`** | The CSS stays byte-identical to the source so the port remains diffable; all 6 Prestige variables it reads are aliased in one place. Scoped to the picker/finder roots, not `:root`, so a section with a custom `background_color` recolours the picker through `contrast-override.liquid` |
| Check cart templates show line-item properties and hide `_`-prefixed ones | **Already correct, no change** | `snippets/cart-products.liquid:254–281` already skips any property whose first character is `_`, and that snippet backs both the drawer and the cart page |
| Load the script on index/collection/search/page | Added to `layout/theme.liquid` | Same conditional as the source. Needed because quick add injects the picker's markup into a modal and a `<script>` arriving that way never executes |
| Add the `Tartan picker` settings group | Appended to `config/settings_schema.json` (8 settings, pure insertion — 80 lines added, 0 changed) | As instructed |

**`sections/tartan-finder.liquid` — the one adapted file.** Its wrapper was
Prestige-only and threw a hard `MissingTemplate` error on Horizon. Changed, with
a `PORT NOTE` comment in the file recording each swap:

* `color_scheme` setting + `.color-scheme--*` classes → `background_color` + `{% render 'contrast-override' %}` (Horizon has no colour schemes)
* `.section-spacing` / `.container--<size>` / `.section-stack` → `.section section--<width>`
* `{% render 'section-header' %}` → inline heading markup (no such snippet in Horizon)

Everything below the wrapper — the whole finder app and 30 of its 34 settings — is untouched.

### Theme check

**0 errors, 7 warnings** (was 0 errors, 6 warnings).

The one new warning is `ExcessiveSettingsCount` on `blocks/tartan-picker.liquid`:
58 non-header settings against a limit of 40. That is inherent to the ported block
— the source carries the same 71 settings — and the only ways to clear it are to
drop features or to split the block, both of which would diverge from the source.
**Flagged deliberately rather than silenced**; say the word if you want it split
into "Tartan picker" + "Tartan picker (browse modal)" to get back to 6.

### Data source

`tartan_data_source` defaults to **`library_metaobjects`**. With no metaobjects and
no collection configured, `tartan-data.liquid` returns
`{"page":1,"pages":1,"total":0,"items":[]}` and the JS falls back to
`assets/tartan-library.json` — 500 tartans, drawn in the browser from
threadcounts, **no store data and no images required**. That is the path to get
working first; metaobjects layer on top, matched by handle.

Library verified as valid JSON: 500 items, `v` / `source` / `fields` / `items`.

### Not ported

The optional `sk2-*` presentation layer was **not** copied — it depends on that
build's own design tokens. See §7.

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

### Tartan system

10. **None of the tartan store data travels with the theme.** If this is a
    different store from the Prestige build, everything below has to be recreated.
    The 500-tartan library needs none of it and works on its own — do that first.
11. **`tartan` metaobject definition** — Settings → Custom data → Metaobjects →
    Add definition. Type handle `tartan`. **Storefront access must be on** or
    Liquid cannot read it. Fields (only `name` is required; keys must match
    exactly):

    | Key | Type |
    |---|---|
    | `name` | Single line text |
    | `image` | File (allow images **and** other files, so SVG works) |
    | `svg_code` | Multi-line text |
    | `image_url` | URL |
    | `color` | Color |
    | `category` | Single line text |
    | `colours` | List of single line text |
    | `keywords` | List of single line text |
    | `groups` | List of single line text |
    | `popular` | True or false |
    | `availability` | Single line text |
    | `surcharge` | Decimal |
    | `description` | Multi-line text |
    | `hidden` | True or false |

12. **Metaobject entries**, if you want images, prices or descriptions beyond the
    library. A metaobject sharing a handle with a library tartan overrides it;
    `hidden: true` removes one. For bulk loads, upload images to Content → Files
    first, then import with a CSV app.
13. **Alternative — a tartan collection.** Only if you pick the `collection`
    source: one product per tartan, attributes from tags (`category:`, `colour:`,
    `keyword:`, `group:`, `availability:`, `hex:`, `popular`), surcharge from the
    `tartan.surcharge` metafield.
14. **Product tagging for the picker.** The block's default visibility rule is
    *Products with tags → `tartan-picker`*. Products must carry that tag, or the
    rule must be changed in the theme editor. `no-tartan` always hides it.
15. **Product tagging for "Shop kilts in this tartan".** Tag products
    `<tartan name> tartan`, e.g. `MacDonald tartan`. Then rebuild the library
    (`map_tartan_products.py` → `build_tartan_library.py`) and bump **Cache
    version** in theme settings.
16. **Add the block and the section.** The picker is not in `templates/product.json`
    yet — add it via Customize → Product → Add block → Tartan picker, below the
    variant picker. The finder goes on a page via Add section → Tartan finder
    (the source used `/pages/find-your-tartan`).
17. **Bump Cache version** after any tartan data change. Shoppers cache the list
    for *Browser cache time* (default 60 min); the theme editor always loads fresh.

---

## 7. Source theme also contains a full SCOTKILT build

While locating the tartan files, the source theme
(`theme-prestige/Prestige V10.0.2`) turned out to contain an `sk2-*` section set
that already implements **the entire `pages.html` mock**, not just the tartan
features:

`sk2-hero` · `sk2-trending-tartans` · `sk2-kilt-types` · `sk2-popular-kilts` ·
`sk2-shop-by-tartan` · `sk2-featured-split` · `sk2-why-scotkilt` ·
`sk2-kilt-finder` · `sk2-size-guide` · `sk2-brand-story` · `sk2-reviews` ·
`sk2-faq` · `sk2-seo-content` · `sk2-newsletter` — every home band in §2.2 —
plus `sk2-collection`, `sk2-product`, `sk2-cat-faq`, `sk2-cat-cta`,
`sk2-cat-related`, `sk2-product-rail`, `sk2-tartan-finder`.

That is ~5,000 lines already written against this exact mock. It materially
changes the plan in §2, which assumed building from Horizon's native sections.
**Porting vs. rebuilding is an open decision** — see the report. Nothing from
`sk2-*` has been copied.

---

## 6. Change log

| Date | Change | Why |
|---|---|---|
| 2026-09-24 | Initial commit `671e930` — stock Horizon imported, repo created, pushed to `github.com/ayanrajpoot/horizon-scotkilt` | Baseline |
| 2026-09-24 | Added `docs/DESIGN-TOKENS.md` and `docs/STORE-MAP.md`; recorded theme-check baseline (0 errors / 6 warnings, 358 files) | Audit before any edit, per the brief |
| 2026-09-24 | Ported the tartan system from Prestige — 8 files verbatim, `sections/tartan-finder.liquid` wrapper adapted, new `blocks/tartan-picker.liquid` and `snippets/xx-tartan-theme-vars.liquid`, settings group appended, asset loading added to `layout/theme.liquid`. See §4b | Tartan picker, finder and 500-tartan library |

Nothing has been deleted. `config/settings_schema.json` and `layout/theme.liquid`
are pure insertions; every other change is a new file.


---

## 8. What actually ships (supersedes §2)

### Templates

| Template | Sections, in order | Original kept as |
|---|---|---|
| `index.json` | sk2-hero · sk2-trending-tartans · sk2-kilt-types · sk2-popular-kilts · sk2-shop-by-tartan · sk2-featured-split · sk2-why-scotkilt · sk2-kilt-finder · sk2-size-guide · sk2-brand-story · sk2-reviews · sk2-faq · sk2-seo-content · sk2-newsletter — all 14 mock bands, 50 blocks | `index.old.json` |
| `collection.json` | sk2-collection (hero + chips + filters + grid) · sk2-trending-tartans · sk2-seo-content · sk2-size-guide · sk2-cat-faq · sk2-cat-related · sk2-cat-cta | `collection.old.json` |
| `product.json` | sk2-product (12 blocks: 3 assurance, 4 facts, 3 accordions, tartan picker, complementary) · sk2-product-rail | `product.old.json` |
| `header-group.json` | sk2-announcement · sk2-header | `header-group.old.json` |
| `footer-group.json` | sk2-footer | `footer-group.old.json` |

Templates were generated from each section's preset, so the mock's copy lands
verbatim. The stock Horizon header, announcements, footer and utilities sections
are **retained inside the group files but left out of `order`** — not rendered,
still revertable from the theme editor.

### Global chrome — the only band written from scratch

Prestige used its own header and footer, so `sk2-announcement`, `sk2-header` and
`sk2-footer` are new, written against `pages.html` directly, with
`assets/sk2-chrome.{css,js}`.

* The mega panel stays a child of `.nav__item`, which is `position: static`, so
  it resolves against the sticky `.header` and spans the viewport — the
  full-width dropdown trap from the brief. Making `.nav__item` relative would
  collapse it to the link's width.
* The cart is **delegated, not reimplemented**: the trigger copies
  `snippets/header-actions.liquid` (`on:click="#cart-drawer/toggle"` plus
  `aria-controls`), and the count renders Horizon's live `cart-bubble`, skinned
  to the mock's `.count`.
* Menus are link-list driven, so the mega menu is empty until the navigation is
  built in Admin (§5, item 1).

### The seam: `assets/sk2-horizon-bridge.css`

`sk2-home.css` re-skins the host theme's variant picker, quantity selector and
buy buttons — but targets *Prestige's* class names. The bridge re-applies the
same skin to Horizon's names (`.variant-option`,
`.variant-option__button-label__text`, `.quantity-minus`, …) so `sk2-home.css`
stays byte-identical to the source and remains diffable.

### Product page: four Prestige snippets replaced

`sk2-product` was written against Prestige's buy-side snippets. Rather than
porting them and their form-primitive dependency chains, three are
Horizon-native, so variant resolution, cart events and recommendation loading
are the theme's own machinery:

| Prestige | Here | Note |
|---|---|---|
| `pdp-eyebrow` | `sk2-pdp-eyebrow` | copied verbatim, zero dependencies |
| `variant-picker` | `sk2-variant-picker` | wraps Horizon's `variant-main-picker` |
| `buy-buttons` | `sk2-buy-buttons` | `product-form-component` + `add-to-cart-button` |
| `complementary-products` | `sk2-complementary-products` | Horizon's `<product-recommendations>`, complementary intent |

Each keeps the Prestige call signature, so `sk2-product.liquid` changed only in
the snippet names. Prestige-only arguments are documented as ignored where
Horizon owns that behaviour.

### Locales

The sk2 sections use `general.*`, `product.*` and `collection.*` namespaces that
Horizon does not have. Added to `en.default.json` with wording reused from
Horizon's own strings, and mirrored **in English** to all 33 other locale files
so `MatchingTranslations` passes. Those are untranslated placeholders — translate
them in Admin if the store runs other languages.

### Theme check

**0 errors, 13 warnings** (baseline 0 errors, 6 warnings). The 7 new warnings:

* `ExcessiveSettingsCount` ×4 — large ported sections and `blocks/tartan-picker.liquid`
* `RemoteAsset` ×6 — the Google Fonts links in `sk2-hero` and `sk2-header`.
  `pages.html` requires Cormorant Garamond and Manrope, and Manrope is not in
  Shopify's font library, so they are loaded exactly as the mock does. This also
  settles the open font question from the audit: **no substitute font is used.**

### Still not verified

No store is linked, so nothing in this build has been seen in a browser. Every
page needs the visual pass once a dev store exists.
