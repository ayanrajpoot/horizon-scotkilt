"""
Rank tartans by demand and pick the top 500 for the tartan library.

Usage:
    python docs/tools/rank_tartans.py path/to/verified-tartans inventory_vs_catalog_review.xlsx

Signals (from the spreadsheet):
- orders: "order-Temp-M" sheet, Unique Orders (all colourways of a tartan added together)
- volume: highest search volume found for the tartan in "search volume" (keywords like "<name> tartan"),
          "rough for volume", the inventory sheets and the repo's own seo_search_volume
- stock:  the tartan is in the inventory sheets with fabric available

score = 60% orders + 35% search volume (both on a log scale) + 5% in stock

Writes:
- docs/tools/tartan-top500.csv             used by build_tartan_library.py
- docs/tools/tartan-unmatched-demand.csv   demand names with no pattern in the repo. Add them to
                                           custom-tartans.csv when you have their threadcount.
"""
import collections
import csv
import math
import os
import re
import sys
import tempfile
import unicodedata

import openpyxl

if len(sys.argv) < 3:
    sys.exit(__doc__)

REPO = os.path.join(sys.argv[1], "data")
XLSX = sys.argv[2]
OUT = os.path.dirname(os.path.abspath(__file__))
TOP_N = 500

S = tempfile.mkdtemp()
workbook = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
for sheet in workbook.worksheets:
    with open(os.path.join(S, sheet.title.replace(" ", "_") + ".csv"), "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(sheet.iter_rows(values_only=True))


def sheet_path(name):
    return os.path.join(S, name + ".csv")


STOP = {"tartan", "tartans", "clan", "modern", "ancient", "weathered", "muted", "reproduction", "antique", "vintage", "limited", "the"}


def ascii_(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().replace("​", "")


def key(name):
    s = ascii_(name).lower().replace("&", " and ")
    s = re.sub(r"\bst\.", "st", s)
    s = re.sub(r"[^a-z0-9#]+", " ", s)
    words = [("mac" + w[2:]) if w.startswith("mc") and len(w) > 3 else w for w in s.split()]
    return " ".join(w for w in words if w not in STOP)


def num(v):
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return 0.0


# ---------------- repo ----------------
repo = []
for r in csv.DictReader(open(os.path.join(REPO, "tartans.csv"), encoding="utf-8")):
    repo.append(dict(name=r["name"], slug=r["slug"], origin="main", restricted=False, seo=0))
for r in csv.DictReader(open(os.path.join(REPO, "expansion_candidates.csv"), encoding="utf-8")):
    name = re.split(r"\s+(Clan\s+)?Tartan\s+Tartan Number", r["name"])[0].strip()
    repo.append(dict(name=name, slug=r["slug"], origin="expansion", restricted=r.get("restriction_status") not in ("", "none"), seo=0))
cross = {r["slug"]: r for r in csv.DictReader(open(os.path.join(REPO, "tartans_cross_verified.csv"), encoding="utf-8"))}
for t in repo:
    if t["slug"] in cross:
        t["seo"] = num(cross[t["slug"]].get("seo_search_volume"))


def aliases(name):
    out = {name}
    m = re.match(r"^(\S+) / (\S+)(.*)$", name)  # "Stewart / Stuart Blue" -> "Stewart Blue", "Stuart Blue"
    if m:
        out |= {m.group(1) + m.group(3), m.group(2) + m.group(3)}
    for n in list(out):
        m = re.match(r"^([^,(]+), ([^()]+)(.*)$", n)  # "Skye, Isle of" -> "Isle of Skye"
        if m:
            out.add(m.group(2) + " " + m.group(1) + m.group(3))
    return {key(a) for a in out}


def pref(t):
    """Best repo entry first: unrestricted, not personal, main set, not a numbered/bracketed variant, shortest name."""
    n = t["name"]
    return (t["restricted"], "(personal)" in n.lower(), t["origin"] != "main", "#" in n, "(" in n, len(n))


index = collections.defaultdict(list)
for t in repo:
    for k in aliases(t["name"]):
        index[k].append(t)
for k in index:
    index[k].sort(key=pref)

# Store names that differ from the register name
MANUAL = {
    "royal stewart": "Stuart / Stewart",  # the register "Royal Stuart / Stewart" entry is a small variant sett
    "stewart royal": "Stuart / Stewart",
    "black stewart": "Stuart / Stewart Black",
    "hunting stewart": "Stuart / Stewart Hunting",
    "stewart hunting": "Stuart / Stewart Hunting",
    "dress stewart": "Stuart / Stewart Dress",
    "stewart dress": "Stuart / Stewart Dress",
    "blue stewart": "Stuart / Stewart Blue",
    "grey stewart": "Stuart / Stewart Authentic Grey",
    "us army": "U.S. Army",
    "flora macdonald": "MacDonald (Flora.. )",
    "macleod of lewis": "MacLeod of Lewis (Vestiarium Scoticum)",
    "macleod of harris": "MacLeod of Assynt",
    "fraser": "Fraser of Lovat",
    "barclay hunting": "Barclay",
    "macfarlane": "MacFarlane Red",
    "macfarlane hunting": "MacFarlane Hunting (MacGregor Hastie)",
    "dress gordon": "Gordon Dress",
    "tara murphy": "Murphy / Tara",
    "blue ramsay": "Ramsay Blue Hunting",
    "county donegal irish": "Donegal, County",
    "donegal": "Donegal, County",
    "kerry irish county": "Kerry, County",
    "cavan irish county": "Cavan, County",
    "clare irish county": "Clare, County",
    "thomson": "Thompson / Thomson / MacTavish",
    "thomson blue": "Thomson Dress (Blue)",
    "thomson grey": "Thomson Dress (Grey)",
    "abel": "Abel (2015)",
    "macneil": "MacNeil of Barra",
    "wood": "Wood (Clan/Family)",
    "kincaid": "Kincaid of Kincaid",
    "rourke frew": "Rourke-Frew (Ontario)",
    "menzies hunting green": "Menzies Green",
    "sullivan": "O'Sullivan",
    "stirling bannockburn": "Stirling and Bannockburn",
    "macintyre hunting": "MacIntyre Hunting (VS)",
    "maccormick": "MacCormick (Name)",
    "callaghan irish": "Callaghan",
    "home": "Hume or Home",
    "nicolson hunting": "Nicolson Green Hunting",
    "clergy episcopal": "Episcopal Clergy",
    "erskine": "Erskine (Red)",
    "turnbull": "Turnbull Dress",
    "cornish": "Cornish National",
}
# Plain colours / generic words, not tartans
IGNORE = {"black", "plain black", "decent black", "beige", "camel", "saffron", "grey", "gray", "white", "red", "blue", "green"}
by_name = {t["name"]: t for t in sorted(repo, key=pref, reverse=True)}

# Tartans in custom-tartans.csv (not in the repo): key -> handle
CUSTOM = {}
custom_path = os.path.join(OUT, "custom-tartans.csv")
if os.path.exists(custom_path):
    for r in csv.DictReader(open(custom_path, encoding="utf-8")):
        for alias in [r["name"]] + [a for a in (r.get("aliases") or "").split("|") if a.strip()]:
            CUSTOM[key(alias)] = "CUSTOM:" + r["handle"]


def resolve(k, hint=None):
    if k in IGNORE:
        return None
    if k in CUSTOM:
        return CUSTOM[k]
    if k in MANUAL:
        return by_name[MANUAL[k]]["slug"]
    if k in index:
        return index[k][0]["slug"]
    if hint and key(hint) in index:
        return index[key(hint)][0]["slug"]
    return None


# ---------------- demand ----------------
demand = collections.defaultdict(lambda: dict(names=collections.Counter(), orders=0.0, volume=0.0, stock=0.0))


def add(name, **values):
    k = key(name)
    if not k:
        return None
    d = demand[k]
    d["names"][ascii_(name).replace(" Tartan", "").strip()] += 1
    for field, v in values.items():
        if field == "volume":
            d["volume"] = max(d["volume"], v)
        else:
            d[field] += v
    return d


hints = {}
for r in csv.DictReader(open(sheet_path("order-Temp-M"), encoding="utf-8")):
    d = add(r["Tartan"], orders=num(r["Unique Orders"]))
    if d is not None:
        d["names"][ascii_(r["Tartan"]).replace(" Tartan", "").strip()] += 3  # prefer the name customers ordered
for sheet in ("inventory-M", "inventory"):
    for r in csv.DictReader(open(sheet_path(sheet), encoding="utf-8")):
        d = add(r["tartan_name"], stock=num(r["available"]), volume=num(r["Volume"]))
        if d is not None and r.get("match_type") == "exact" and r.get("catalog_match"):
            hints[key(r["tartan_name"])] = r["catalog_match"]
for r in csv.reader(open(sheet_path("rough_for_volume"), encoding="utf-8")):
    if len(r) > 2 and r[0] and not r[0].startswith("#"):
        add(r[0], volume=num(r[2]))

# Keyword volume: "<name> tartan", "<name> clan tartan", "<name> tartan kilt" ...
GENERIC = STOP | {"plaid", "kilt", "kilts", "fabric", "scarf", "family", "pattern", "colors", "colours", "material", "for", "sale",
                  "meaning", "history", "crest", "and", "by", "the", "yard", "wool", "cloth", "trews", "scottish", "scotland"}
keyword_volume = collections.defaultdict(float)
for r in csv.DictReader(open(sheet_path("search_volume"), encoding="utf-8")):
    keyword = ascii_(r["Keyword"]).lower()
    if "tartan" not in keyword:
        continue
    k = " ".join(w for w in key(keyword.replace("tartan", " ")).split() if w not in GENERIC)
    if k and (k in index or k in MANUAL or k in CUSTOM or k in demand):
        keyword_volume[k] += num(r["Volume"])
for k, v in keyword_volume.items():
    d = demand[k]
    if not d["names"]:
        d["names"][k.title()] += 1
    d["volume"] = max(d["volume"], v)

# SEO volume recorded in the repo itself
for t in repo:
    if t["seo"] and pref(t)[0:2] == (False, False):
        d = demand[key(t["name"])]
        if not d["names"]:
            d["names"][t["name"]] += 1
        d["volume"] = max(d["volume"], t["seo"])

# ---------------- merge by resolved tartan and score ----------------
merged, unmatched = {}, []
for k, d in demand.items():
    slug = resolve(k, hints.get(k))
    if not slug:
        if d["orders"] or d["volume"]:
            unmatched.append((d["orders"], d["volume"], d["names"].most_common(1)[0][0]))
        continue
    m = merged.setdefault(slug, dict(slug=slug, names=collections.Counter(), orders=0.0, volume=0.0, stock=0.0))
    m["names"].update(d["names"])
    m["orders"] += d["orders"]
    m["volume"] = max(m["volume"], d["volume"])
    m["stock"] += d["stock"]

max_orders = max(m["orders"] for m in merged.values())
max_volume = max(m["volume"] for m in merged.values())
for m in merged.values():
    m["score"] = round(100 * (0.6 * math.log1p(m["orders"]) / math.log1p(max_orders)
                              + 0.35 * math.log1p(m["volume"]) / math.log1p(max_volume)
                              + 0.05 * (1 if m["stock"] > 0 else 0)), 2)
    m["display"] = m["names"].most_common(1)[0][0].strip()

top = sorted(merged.values(), key=lambda m: (-m["score"], -m["orders"], -m["volume"]))[:TOP_N]
slug_name = {t["slug"]: t["name"] for t in repo}
with open(os.path.join(OUT, "tartan-top500.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["rank", "display_name", "repo_slug", "repo_name", "score", "orders", "search_volume", "in_stock"])
    for i, m in enumerate(top, 1):
        w.writerow([i, m["display"], m["slug"], slug_name.get(m["slug"], "(custom)"), m["score"],
                    int(m["orders"]), int(m["volume"]), "yes" if m["stock"] > 0 else "no"])
unmatched.sort(reverse=True)
with open(os.path.join(OUT, "tartan-unmatched-demand.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["orders", "search_volume", "name"])
    w.writerows((int(o), int(v), n) for o, v, n in unmatched)

print(f"{len(demand)} demand names, {len(merged)} matched tartans, {len(unmatched)} unmatched")
print(f"Top {len(top)}: {sum(1 for m in top if m['orders'])} with orders, cutoff score {top[-1]['score']}")
