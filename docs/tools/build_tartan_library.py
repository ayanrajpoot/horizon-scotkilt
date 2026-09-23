"""
Build assets/tartan-library.json from the verified-tartans repository.

Usage:
    git clone https://github.com/Sajjad581/verified-tartans.git
    python docs/tools/rank_tartans.py path/to/verified-tartans inventory_vs_catalog_review.xlsx   (optional, re-ranks)
    python docs/tools/build_tartan_library.py path/to/verified-tartans          top 500 from tartan-top500.csv
    python docs/tools/build_tartan_library.py path/to/verified-tartans --all    every tartan in the repo

Selection (default): docs/tools/tartan-top500.csv, in rank order. Each tartan uses the store name
(display_name) and a handle made from it. docs/tools/custom-tartans.csv adds tartans that are not in the repo.

Output format (kept compact – one array per tartan):
    {"v": 1, "source": ..., "fields": [...], "items": [[slug, name, threadcount, palette, symmetric, category, colour_families, popular], ...]}

- threadcount: tokens like "B/28 K6 B6" (a "/" marks a pivot of a symmetric sett)
- palette:     "B:345064 K:101010" (colour code : hex)
- symmetric:   1 = mirror the sett at its pivots, 0 = full sett as written
- category:    first register category (Clan, District, Military...) or ""
- colour_families: "Blue|Green" – used by the colour filter
- products:    "product-handle~colourway|..." from docs/tools/tartan-products.csv (map_tartan_products.py);
               used by the Tartan finder's "Shop kilts in this tartan" link. Colourway is empty for modern.
- popular:     1 for the top 50 ranked tartans (or the curated POPULAR list with --all)
"""

import csv
import json
import os
import re
import sys
from collections import Counter

# Well-known tartans flagged as popular (exact names as recorded in the dataset)
POPULAR = {
    "MacDonald", "Stewart", "Stewart Hunting", "Campbell", "Wallace", "Wallace Hunting", "Gordon", "MacLeod",
    "Scott", "Douglas", "Buchanan", "Cameron", "Cameron of Erracht", "Pride of Scotland", "Black Watch (Piper)",
    "Mackenzie", "Fraser Hunting", "Fraser Dress", "Murray of Atholl", "Robertson", "MacGregor of Glenstrae",
    "Lindsay", "Anderson", "Ross", "Kerr", "Hamilton", "Graham of Montrose", "Sinclair", "Armstrong", "Elliot",
    "Menzies", "Munro", "Morrison", "Mackintosh", "MacKay", "Macpherson", "Ogilvie", "Drummond", "Farquharson",
    "Forbes", "Grant", "Gunn", "Keith", "Lamont", "MacArthur", "MacDougall", "MacInnes", "MacIntyre", "MacKinnon",
    "MacLachlan", "MacLaren", "MacMillan", "MacNab", "MacRae", "Malcolm", "Maxwell", "Montgomery", "Napier",
    "Ramsay (Red)", "Rose", "Shaw", "Skene", "Sutherland", "Urquhart", "Barclay", "Johnston / Johnstone",
}

# Register categories kept for the category filter (anything else is left blank)
CATEGORIES = {"Clan", "Family", "Name", "District", "Military", "Royal", "Fashion", "Corporate", "Commemorative", "Other"}

HEX_RE = re.compile(r"([A-Za-z]+)#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b")
TOKEN_RE = re.compile(r"^([A-Za-z]+)(/?)(\d+)$")


def parse_palette(text):
    colours = {}
    for code, hexval in HEX_RE.findall(text or ""):
        if len(hexval) == 3:
            hexval = "".join(ch * 2 for ch in hexval)
        colours.setdefault(code, hexval.upper())
    return colours


def expand_sett(threadcount, symmetric):
    tokens = []
    for raw in (threadcount or "").split():
        match = TOKEN_RE.match(raw)
        if not match:
            return None, None
        tokens.append((match.group(1), int(match.group(3))))
    if not tokens:
        return None, None
    full = tokens + list(reversed(tokens[1:-1])) if symmetric and len(tokens) > 2 else tokens
    return tokens, full


def hex_to_rgb(hexval):
    return tuple(int(hexval[i:i + 2], 16) for i in (0, 2, 4))


def load_palette_families(repo):
    families = {}
    path = os.path.join(repo, "palette", "palette.csv")
    for row in csv.DictReader(open(path, encoding="utf-8")):
        families[row["yarn_hex"].lstrip("#").upper()] = (hex_to_rgb(row["yarn_hex"].lstrip("#")), row["family"])
    mapping_path = os.path.join(repo, "palette", "hex_mapping.csv")
    mapping = {}
    if os.path.exists(mapping_path):
        for row in csv.DictReader(open(mapping_path, encoding="utf-8")):
            mapping[row["source_hex"].lstrip("#").upper()] = row["locked_hex"].lstrip("#").upper()
    return families, mapping


def family_for(hexval, families, mapping):
    hexval = mapping.get(hexval, hexval)
    if hexval in families:
        return families[hexval][1]
    rgb = hex_to_rgb(hexval)
    best = min(families.values(), key=lambda entry: sum((a - b) ** 2 for a, b in zip(entry[0], rgb)))
    return best[1]


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("&", " and ")).strip("-")


POPULAR_TOP_N = 50


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)

    repo = sys.argv[1]
    build_all = "--all" in sys.argv[2:]
    tools_dir = os.path.dirname(os.path.abspath(__file__))
    theme_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_path = os.path.join(theme_root, "assets", "tartan-library.json")

    families, mapping = load_palette_families(repo)

    categories = {}
    for row in csv.DictReader(open(os.path.join(repo, "data", "tartans_cross_verified.csv"), encoding="utf-8")):
        categories[row["slug"]] = row.get("register_category") or ""

    rows = [(row, "main") for row in csv.DictReader(open(os.path.join(repo, "data", "tartans.csv"), encoding="utf-8"))]
    rows += [(row, "expansion") for row in csv.DictReader(open(os.path.join(repo, "data", "expansion_candidates.csv"), encoding="utf-8"))]

    custom_path = os.path.join(tools_dir, "custom-tartans.csv")
    if os.path.exists(custom_path):
        for row in csv.DictReader(open(custom_path, encoding="utf-8")):
            rows.append(({
                "slug": "CUSTOM:" + row["handle"],
                "name": row["name"],
                "threadcount": row["threadcount"],
                "palette": " ".join(code + "#" + hexval for code, hexval in (pair.split(":") for pair in row["palette"].split())),
                "symmetric": "yes" if row["symmetric"].strip() in ("1", "yes") else "no",
                "category": row.get("category", ""),
            }, "custom"))

    selection = {}
    if not build_all:
        selection_path = os.path.join(tools_dir, "tartan-top500.csv")
        for row in csv.DictReader(open(selection_path, encoding="utf-8")):
            selection[row["repo_slug"]] = (int(row["rank"]), row["display_name"])

    items, seen, skipped = [], set(), Counter()

    for row, origin in rows:
        slug = (row.get("slug") or "").strip()
        name = (row.get("name") or "").strip()
        if not build_all and slug not in selection:
            continue
        if not slug or not name or slug in seen:
            skipped["duplicate or missing name"] += 1
            continue

        symmetric = (row.get("symmetric") or "").strip().lower() == "yes"
        palette = parse_palette(row.get("palette"))
        tokens, full = expand_sett(row.get("threadcount"), symmetric)

        if not tokens or not palette:
            skipped["unparseable threadcount or palette"] += 1
            continue
        if any(code not in palette for code, _ in tokens):
            skipped["colour code missing from palette"] += 1
            continue

        total = sum(count for _, count in full)
        expected = row.get("thread_total")
        if expected and expected.strip().isdigit() and int(expected) != total:
            skipped["thread total mismatch"] += 1
            continue
        if total <= 0:
            skipped["empty sett"] += 1
            continue

        used_codes = [code for code, _ in tokens]
        palette_used = {code: palette[code] for code in dict.fromkeys(used_codes)}

        # Colour families weighted by how much of the sett they cover
        weight = Counter()
        for code, count in full:
            weight[family_for(palette[code], families, mapping)] += count
        family_list = [fam for fam, amount in weight.most_common() if amount / total >= 0.08][:4]

        category = row.get("category") if origin in ("expansion", "custom") else categories.get(slug, "")
        category = (category or "").split(";")[0].strip()
        if category not in CATEGORIES:
            category = ""

        threadcount = " ".join(f"{code}{'/' if raw.find('/') > -1 else ''}{count}"
                               for (code, count), raw in zip(tokens, (row.get("threadcount") or "").split()))

        rank = None
        if build_all:
            handle, popular = slug.replace("CUSTOM:", ""), 1 if name in POPULAR else 0
        else:
            rank, name = selection[slug]
            handle, popular = slugify(name), 1 if rank <= POPULAR_TOP_N else 0

        items.append([
            handle,
            name,
            threadcount,
            " ".join(f"{code}:{hexval}" for code, hexval in palette_used.items()),
            1 if symmetric else 0,
            category,
            "|".join(family_list),
            popular,
        ])
        seen.add(slug)

    handles = Counter(item[0] for item in items)
    duplicates = [handle for handle, count in handles.items() if count > 1]
    if duplicates:
        sys.exit("Duplicate handles, rename in tartan-top500.csv: " + ", ".join(duplicates))
    if not build_all:
        missing = sorted(set(selection) - seen)
        if missing:
            print("Selected but not built:", ", ".join(missing))

    products = {}
    products_path = os.path.join(tools_dir, "tartan-products.csv")
    if os.path.exists(products_path):
        for row in csv.DictReader(open(products_path, encoding="utf-8")):
            products.setdefault(row["tartan_handle"], []).append(f"{row['product_handle']}~{row['colourway']}")
    for item in items:
        item.append("|".join(products.get(item[0], [])))

    items.sort(key=lambda item: item[1].lower())

    data = {
        "v": 1,
        "source": "https://github.com/Sajjad581/verified-tartans",
        "fields": ["handle", "name", "threadcount", "palette", "symmetric", "category", "colours", "popular", "products"],
        "items": items,
    }

    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Wrote {len(items)} tartans to {out_path} ({size_kb:.0f} KB)")
    print(f"Popular: {sum(item[7] for item in items)}, with products: {sum(1 for item in items if item[8])}")
    if skipped:
        print("Skipped:", dict(skipped))


if __name__ == "__main__":
    main()
