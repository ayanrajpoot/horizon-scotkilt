# Tartan picker

A "Choose your tartan" block for product pages. Shoppers can search, tap a popular swatch, or open a full modal to browse the whole tartan library. Built to handle 700+ tartans (tested with 750).

## Files

| File | Purpose |
|---|---|
| `sections/tartan-data.liquid` | JSON data endpoint, fetched as `/?section_id=tartan-data&page=N`. Never added to a template. |
| `snippets/tartan-picker.liquid` | Block markup, display rules, config |
| `assets/tartan-picker.js` | `<tartan-picker>` element, search, validation, browse modal |
| `assets/tartan-picker.css` | Styles (uses the theme's colour scheme variables) |
| `sections/main-product.liquid` | Added `tartan_picker` block to the schema (nothing removed) |
| `snippets/product-info.liquid` | Added `when 'tartan_picker'`; block allowed in quick buy |
| `layout/theme.liquid` | Loads the script on index, collection, search and page templates, so quick buy works |
| `sections/tartan-finder.liquid` | **Tartan finder** section: the same browser shown directly on a page |
| `config/settings_schema.json` | New **Theme settings → Tartan picker** group |
| `assets/tartan-library.json` | Built-in tartan library: top 500 tartans, drawn in the browser from their threadcount |
| `docs/tools/rank_tartans.py` | Ranks tartans by orders and search volume → `tartan-top500.csv` |
| `docs/tools/build_tartan_library.py` | Builds `assets/tartan-library.json` from the repo + `tartan-top500.csv` + `custom-tartans.csv` |

## 0. Built-in tartan library (top 500)

Default data source: **Verified library + metaobjects**. No images are needed. Each tartan is drawn in the browser from its threadcount, in Modern, Ancient or Weathered colours. Ancient and Weathered are colour approximations.

**Where the 500 come from**
- Patterns: [verified-tartans](https://github.com/Sajjad581/verified-tartans) (register-verified threadcounts)
- Ranking: `inventory_vs_catalog_review.xlsx`
  - `score = 60% orders + 35% search volume + 5% in stock`
  - Orders and search volume are on a log scale
  - Orders come from **order-Temp-M → Unique Orders**, with all colourways of a tartan added together
  - Search volume is the highest found in **search volume** ("<name> tartan" keywords), **rough for volume**, the inventory sheets and the repo's `seo_search_volume`
- The shop names customers used are kept, e.g. "Royal Stewart" rather than the register's "Stuart / Stewart". The handle is made from that name (`royal-stewart`).
- The top 50 are marked popular.

**Files in `docs/tools/`**

| File | What it is |
|---|---|
| `tartan-top500.csv` | The ranked list: rank, store name, repo tartan used, score, orders, search volume, in stock. Rename a tartan by editing `display_name`. |
| `custom-tartans.csv` | Tartans not in the repo, in the same format (threadcount, palette `CODE:HEX`, symmetric). Black Watch is here, made from the Government/Campbell sett. |
| `tartan-unmatched-demand.csv` | Names with orders or searches but no pattern in the repo, e.g. Irish National, US Navy, County Cork, Masonic. Add a row to `custom-tartans.csv` once you have the threadcount from your fabric supplier. |

**Rebuild after changes**
```
git clone https://github.com/Sajjad581/verified-tartans.git
python docs/tools/rank_tartans.py verified-tartans inventory_vs_catalog_review.xlsx
python docs/tools/build_tartan_library.py verified-tartans
```
- Run `rank_tartans.py` only when the spreadsheet changes.
- To include every repo tartan instead, run `build_tartan_library.py verified-tartans --all`.
- Name mappings (store name → register name) live in `MANUAL` in `rank_tartans.py`.
- After rebuilding, change **Cache version** in theme settings.

**Link products to tartans** (for the finder's "Shop kilts in this tartan" button)
```
python docs/tools/map_tartan_products.py products_export_1.csv
python docs/tools/build_tartan_library.py verified-tartans
```
- `map_tartan_products.py` reads a Shopify product export (**Products → Export**).
- **Rule:** a product is linked when it has a `<tartan name> tartan` tag *and* that name is in its title or handle, so region tags like "Argyll tartan" on the Campbell kilt are ignored.
- **Colourway:** ancient, weathered or muted in the tag or product handle sets the colourway.
- **Output:** `docs/tools/tartan-products.csv` (the links) and `tartan-products-unmatched.csv` (tags with no library tartan).
- **Current export:** 332 products linked to 260 of the 500 tartans.
- The builder stores them in the library's `products` field as `product-handle~colourway|...`.
- **Upload safety:** the section's Liquid never contains `{name}`-style placeholders. A single `}` inside `{{ }}` ends the tag early in Shopify and caused the earlier "can't be parsed" upload error.

**Metaobjects on top of the library:** a `tartan` metaobject with the same handle as a library tartan adds or overrides details (image, price, description). Set `hidden` to remove that tartan.

**Cart:** the chosen colourway is saved as the hidden `_Tartan colourway` property. Share links with `?tartan=handle&colourway=ancient`.

## 1. Add your own tartans

Pick the source in **Theme settings → Tartan picker → Tartan data source**.

### Option A – Metaobjects (recommended)

1. Go to **Settings → Custom data → Metaobjects → Add definition**.
2. Name it `Tartan` with type handle `tartan`. If you use a different handle, set it in theme settings.
3. Turn on **Storefront access**. Without it, Liquid can't read the tartans.
4. Add these fields. Only `name` is required; use the exact keys.

| Key | Type | Used for |
|---|---|---|
| `name` | Single line text | Tartan name |
| `image` | File (allow images **and** other files) | Swatch and preview. JPG, PNG, WebP and **SVG** all work. |
| `svg_code` | Multi-line text | Optional: paste SVG code instead of uploading a file |
| `image_url` | URL | Optional: external image |
| `color` | Color | Fallback swatch colour when there's no image |
| `category` | Single line text | Filter, e.g. Clan, District, Military, Fashion, Universal |
| `colours` | List of single line text | Colour filter and preview chips |
| `keywords` | List of single line text | Extra search words: surnames, septs, alternative spellings |
| `groups` | List of single line text | Limit tartans per product (see Tartans offered) |
| `popular` | True or false | ★ badge, popular filter, swatches shown in the block |
| `availability` | Single line text | Filter, e.g. In stock, Custom weave |
| `surcharge` | Decimal | Extra cost shown as "+$20.00" (display only) |
| `description` | Multi-line text | Preview panel |
| `hidden` | True or false | Hide a tartan without deleting it |

For 700+ entries, upload the images in **Content → Files** first. Then bulk-create the entries with a CSV import app such as Matrixify.

### Option B – Collection of products

Create one product per tartan and put them all in one collection, then select that collection in theme settings.

- **Image:** the product's featured image
- **Name:** the product title
- **Description:** the product description
- **Surcharge:** decimal metafield `tartan.surcharge`
- **Everything else comes from tags:**
  - `popular`
  - `category:Clan`
  - `colour:Red` (one tag per colour)
  - `keyword:McDonald`
  - `group:wedding`
  - `availability:In stock`
  - `hex:#1f3a2e`

### After uploading new tartans

Change **Cache version** in theme settings (for example `1` → `2`). Shoppers' browsers cache the list for **Browser cache time** (default 60 minutes). The theme editor always loads fresh data.

## 2. Add the block

It's already in `product.json` and `product.made-to-measure.json`, placed right after the variant picker. To add it to another product template: **Customize → Product → Add block → Tartan picker**.

## Block settings

### Show on
Choose which products show the picker:

| Option | Shows the picker on |
|---|---|
| All products | Every product using the template |
| Products with tags | Comma-separated tags, matching **any** or **all** |
| Product types | Comma-separated product types |
| Vendors | Comma-separated vendors |
| Products in collections | Comma-separated collection handles |
| Selected products | Products picked in the editor (up to 50) |
| Products with a true metafield | A true/false product metafield, e.g. `custom.show_tartan_picker` |

- **Hide on products with tags** always wins over the rules above (default template tag: `no-tartan`).
- In the theme editor the block is always visible, so you can configure it.

**Current setup:**
- `product.json`: products tagged `tartan-picker`
- `product.made-to-measure.json`: all products

### Tartans offered

| Option | Tartans shown |
|---|---|
| All tartans | The full library |
| Tartans in groups | Tartans whose `groups` match the block's list |
| Groups from product tags | A product tagged `tartan-group:wedding` shows tartans in group `wedding` |
| Tartans listed in a product metafield | A metaobject/product list metafield, or comma-separated handles (default `custom.tartans`) |

If a group or metafield list is empty, all tartans are shown.

### Block content
- Label
- Search on/off and placeholder text
- Swatches in the block: popular, first tartans, or none
- Number of swatches (0–30)
- Browse button text and tartan count

### Selection and cart
- **Cart property name:** default `Tartan`, shown in the cart and order
- **Hidden `_Tartan ID` property:** the tartan handle, for fulfilment
- **Required**
  - Blocks Add to cart and the sticky add-to-cart bar
  - Blocks Buy it now too, if that option is on
  - Shows the required message and scrolls to the picker
- **Remember last tartan** in the browser
- **Preselect from URL:** `?tartan=handle`. Link to a product with a tartan already chosen, e.g. from a clan page.

### Pricing
- **No pricing**
- **Show surcharge text only:** "+$20.00" on cards and in the preview. This does **not** change the cart price.

### Browse modal
- Title and default view (grid or list)
- Filter toggles: popular, category, colour, availability
- A–Z jump
- Preview panel
- Surcharge display
- No-results text
- Custom request link text and URL

### Swatch appearance
- Shape: square, rounded or circle
- Block swatch size
- Image fit: fill, fit, or repeat pattern with a tile size (good for small tartan tiles)
- Zoom on the preview image

## How shoppers use it

- **Inline search:** results appear as you type. Arrow keys and Enter work. "McDonald" also finds "MacDonald". Search covers name, keywords, category, colours and availability.
- **Popular swatches:** tap to select.
- **Browse all modal:**
  - Search, All/★ Popular, More filters (category, colour, availability) with counts, and removable active filters
  - Grid/list toggle and A–Z jump
  - Loads more tartans as you scroll
  - Opens scrolled to the current tartan
  - Preview: large image, click to zoom and pan, price, availability, colours, description, Select button
  - Esc goes back from preview, then closes
  - Full screen on phones
- **Selected tartan:** shown in the block with Change and ✕ (remove).
- **For developers:** the element fires `tartan:change` (`event.detail.tartan`, `formId`).

## Safety nets

- If the tartan list is empty or fails to load, the block hides itself and stops requiring a tartan, so products stay purchasable. The theme editor shows a message instead.
- SVG code is shown through an `<img>` data URL, so scripts inside SVGs never run.
- Text from tartan data is escaped before display.

## Tartan finder section (on a page)

The "Find your tartan" page uses the **Tartan finder** section. You can add it to any page, the homepage or a collection with **Add section → Tartan finder**. It uses the same tartan data, search and filters as the product picker, shown in a panel on the page.

**Settings:**
- **Layout:** colour scheme, width, subheading, heading and text
- **Panel:** optional title, search placeholder, height on desktop (px) and mobile (% of screen)
- **Filters:** default grid/list view, popular, category, colour, availability, A–Z jump, surcharge display
- **Tartans:** only show certain groups (comma separated, empty = all)
- **Text:** no-results text, text before tartans are uploaded, custom request link text and URL
- **Swatches:** shape, image fit, pattern tile size, preview zoom
- **Link sharing:** "Update page link when a tartan is opened"

**Blocks: "Shop in this tartan" link (up to 4)**
- Each link shows as a button in the tartan preview.
- On the Find your tartan page only "Shop kilts in this tartan" shows. "Shop accessories in this tartan" and "Order a swatch" are hidden (disabled blocks); turn them back on with the eye icon in the theme editor.
- **Link to → Products tagged with the tartan name** (default, used by "Shop kilts in this tartan"):
  - **Add a product to a tartan:** tag it `<tartan name> tartan`, e.g. `MacDonald tartan` or `Wallace ancient tartan`. The word after the name is set in the block ("Word after the tartan name in the tag").
  - **Linked products** are stored in the tartan library, built from the product export (see "Link products to tartans" above).
  - **Show tagged products as → Product carousel** (default): every product linked to the tartan is shown in a carousel in the preview, just below the colours, with image, title, price and a sold-out badge. The block label ("Shop kilts in this tartan") is its heading.
    - Products matching the colourway the shopper is viewing come first; each card opens the product with its own colourway preselected.
    - "Products in carousel" sets the maximum (2–24, default 12).
    - Product details are loaded from Shopify (`/products/<handle>.js`) when a tartan is opened. Unpublished or deleted products are skipped.
  - **Show tagged products as → Button:**
    - **One product:** the button opens it directly ("Open the product directly when only one matches").
    - **Several products:** the button opens the tag page, e.g. `/collections/all/buchanan-tartan`. Pick a collection in "Search tagged products in" to use that collection instead of all products. The tag page only lists products with that exact tag, so colourway kilts tagged only "Campbell weathered tartan" aren't on the "Campbell tartan" page.
    - **Colourway:** the product matching the colourway the shopper is viewing (e.g. Ancient) is used when there is one.
  - **Hide the button for tartans with no linked products** (on by default). Turn it off to link those tartans to their tag page, e.g. right after tagging new products and before rebuilding the library.
- **Link to → A fixed link:** the tartan is added to the link, e.g. `/collections/kilts?tartan=macdonald`.
- Opening a tartan also saves it as the shopper's last tartan. Any product with **Remember last tartan** on then preselects it, even when the link goes to a collection first.

**Links you can share:**
- `/pages/find-your-tartan?q=macdonald` opens the finder with "macdonald" already searched
- `/pages/find-your-tartan?tartan=macdonald-modern` opens that tartan's preview

## Limits and notes

- **Page size:** "Tartans loaded per request" defaults to 100 (range 50–250). If Shopify rejects a large page size, lower it.
- **Surcharge:** display only. To charge extra, use product variants or a pricing app.
- **Featured product section:** the picker isn't available in the homepage "Featured product" section, only on product templates and in quick buy.
