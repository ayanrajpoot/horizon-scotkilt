"""
Link library tartans to products using product tags from a Shopify product export.

Usage:
    python docs/tools/map_tartan_products.py products_export_1.csv

A product belongs to a tartan when it has the tag "<tartan name> tartan", for example "MacDonald tartan",
"Wallace ancient tartan" or "Walker evening tartan", and that tartan name is also in the product title or handle
(so region tags such as "Argyll tartan" on the Campbell kilt don't link it to the Argyll tartan).
A colourway word (modern, ancient, weathered, muted) in the tag or product handle is kept so the finder can link the
colourway the shopper is looking at.

Writes docs/tools/tartan-products.csv (tartan handle, colourway, product handle, tag). build_tartan_library.py reads it
and stores the products on each tartan. Tags that don't match a library tartan are listed in
docs/tools/tartan-products-unmatched.csv.
"""
import collections
import csv
import json
import os
import re
import sys
import unicodedata

if len(sys.argv) < 2:
    sys.exit(__doc__)

TOOLS = os.path.dirname(os.path.abspath(__file__))
THEME = os.path.abspath(os.path.join(TOOLS, "..", ".."))
COLOURWAYS = {"modern": "modern", "ancient": "ancient", "weathered": "weathered", "muted": "weathered", "reproduction": "weathered"}
STOP = {"tartan", "clan", "the"}


def key(name):
    s = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", " ", s)
    words = [("mac" + w[2:]) if w.startswith("mc") and len(w) > 3 else w for w in s.split()]
    return " ".join(w for w in words if w not in STOP)


# Library names, plus the repo names they were matched from (tartan-top500.csv)
library = json.load(open(os.path.join(THEME, "assets", "tartan-library.json"), encoding="utf-8"))
fields = library["fields"]
by_key = {}
for row in library["items"]:
    item = dict(zip(fields, row))
    by_key.setdefault(key(item["name"]), item["handle"])
top_path = os.path.join(TOOLS, "tartan-top500.csv")
if os.path.exists(top_path):
    handle_of = {key(item[1]): item[0] for item in library["items"]}
    for r in csv.DictReader(open(top_path, encoding="utf-8")):
        handle = handle_of.get(key(r["display_name"]))
        if handle and r["repo_name"] != "(custom)":
            for alias in re.split(r"\s*/\s*| or ", re.sub(r"\(.*?\)", "", r["repo_name"])):
                by_key.setdefault(key(alias), handle)

links, unmatched = [], collections.Counter()
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8-sig")):
    if not r.get("Title") or (r.get("Status") or "active").lower() == "archived":
        continue
    own = f" {key(r['Title'])} {key(r['Handle'])} "
    for tag in (t.strip() for t in (r.get("Tags") or "").split(",")):
        if not re.search(r"\startan$", tag, re.I):
            continue
        words = key(tag[: -len("tartan")]).split()
        colourway = ""
        if words and words[-1] in COLOURWAYS:
            colourway = COLOURWAYS[words.pop()]
        k = " ".join(words)
        if f" {k} " not in own:
            unmatched[tag] += 1
            continue
        handle = by_key.get(k) or by_key.get(f"{k} modern")
        if handle:
            links.append((handle, colourway, r["Handle"], tag))
        else:
            unmatched[tag] += 1

# One colourway per product: the most specific tag wins, then a colourway word in the product handle
best = {}
for handle, colourway, product, tag in links:
    current = best.get((handle, product))
    if not current or (colourway and not current[0]):
        best[(handle, product)] = (colourway, tag)
links = []
for (handle, product), (colourway, tag) in best.items():
    if not colourway:
        colourway = next((COLOURWAYS[w] for w in product.split("-") if w in COLOURWAYS), "")
    links.append((handle, colourway, product, tag))
links = sorted(links)

with open(os.path.join(TOOLS, "tartan-products.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["tartan_handle", "colourway", "product_handle", "tag"])
    w.writerows(links)
with open(os.path.join(TOOLS, "tartan-products-unmatched.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["tag", "products"])
    w.writerows(unmatched.most_common())

tartans = collections.Counter(h for h, *_ in links)
print(f"{len(links)} product links to {len(tartans)} library tartans; {len(unmatched)} tags not in the library")
print("Products per tartan:", dict(collections.Counter(tartans.values())))
