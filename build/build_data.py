"""Build data/deck_data.js for the slides from the Oct-2026 report files and the two Snowflake aggregations.

Run: ~/Projects/revelio_ai/.venv/bin/python build/build_data.py [path to revelio_ai]
Every number on the slides comes from here; nothing is typed by hand. Idempotent.
"""
import json
import os
import sys

import pandas as pd

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/Projects/revelio_ai")
FIG = os.path.join(REPO, "figures/longitudinal_careers_2026")
DATA = os.path.join(HERE, "data")
CS = "CS / IT"
EU31 = ["Germany", "France", "Italy", "Spain", "Netherlands", "Poland", "Sweden", "Belgium", "Austria", "Ireland", "Denmark",
        "Finland", "Portugal", "Greece", "Czech Republic", "Romania", "Hungary", "Bulgaria", "Croatia", "Slovakia", "Slovenia",
        "Lithuania", "Latvia", "Estonia", "Luxembourg", "Cyprus", "Malta", "United Kingdom", "Switzerland", "Norway", "Iceland"]
NON_EU27 = {"United Kingdom", "Switzerland", "Norway", "Iceland"}
S2 = ["junior job (level 1-2)", "associate or above (level 3+)", "another internship", "back to study", "no position observed"]
CO = ["same company", "different company", "company unknown"]
S3 = ["reached associate (3+) within 2 years", "still junior after 2 years"]

rep = json.load(open(os.path.join(FIG, "report_data_2026.json"), encoding="utf-8"))
rec = lambda df: json.loads(df.to_json(orient="records"))

# the country list must be the one the report uses
sys.path.insert(0, REPO)
os.environ.setdefault("REVELIO_BASIS", "2026")
import analyze_junior_flows as jf  # noqa: E402
assert sorted(EU31) == sorted(c for c in jf.EUROPE.replace("'", "").split(",") if c), "EU31 list differs from the report"

# ---- slide 1: junior share of the employed, AI talent vs other graduates (report file, unchanged)
junior_ai = pd.read_csv(os.path.join(FIG, "junior_stock_ai_vs_not.csv"))

# ---- slides 1 and 2: the report's like-for-like measure (jobs held 0-5 years after graduation), split by AI talent and field
stock = pd.read_csv(os.path.join(DATA, "junior_first5_by_field_ai.csv"))
ref = pd.read_csv(os.path.join(FIG, "junior_stock_measures.csv"))
ref = ref[ref.measure.str.startswith("age-adjusted")].set_index("cal_year")
chk = stock.groupby("cal_year")[["junior_n", "n"]].sum()
assert (chk.n == ref.n).all() and (100 * chk.junior_n / chk.n - ref.junior_pct).abs().max() < 1e-6, "like-for-like totals differ from the report"


def share(df, keys):
    g = df.groupby(keys)[["junior_n", "n"]].sum().reset_index()
    g["junior_pct"] = 100 * g.junior_n / g.n
    return g[keys + ["junior_pct", "n"]]


def cs_split(df, keys):          # CS against the pooled other 14 fields, from the same rows as the by-field view
    return share(df.assign(grp=df.fgroup.eq(CS).map({True: "CS", False: "non-CS"})), keys + ["grp"])


first5_ai = share(stock, ["cal_year", "grp"])
cl = stock.dropna(subset=["fgroup"])                       # graduates with a classified field
by_field, cs = share(cl, ["cal_year", "fgroup"]), cs_split(cl, ["cal_year"])
unclassified_pct = 100 * stock[stock.fgroup.isna()].n.sum() / stock.n.sum()

# first job after graduation: one file for both views, so the CS line is the same line in each
entry_field = pd.read_csv(os.path.join(FIG, "entry_by_fieldgroup_cohort.csv")).dropna(subset=["fgroup"])
entry_field["junior_n"] = entry_field.junior_pct * entry_field.n / 100
entry_cs = cs_split(entry_field, ["cohort"])
windows = pd.read_csv(os.path.join(FIG, "cohort_observation_windows_2026.csv")).set_index("cohort")
last_window = [int(windows.loc[2025, "min_months_observed"]), int(windows.loc[2025, "max_months_observed"])]

# ---- slide 3: internships
fl = pd.read_csv(os.path.join(DATA, "internship_flows_country_year.csv"))
old = pd.read_csv(os.path.join(FIG, "internship_pathway_flows.csv"))
tot = lambda d, col, val: int(d[d[col] == val].n.sum())
for scope, sub in [("all", fl), ("period:2015-19", fl[fl.start_year <= 2019]), ("period:2020-23", fl[fl.start_year >= 2020]),
                   ("country:Germany", fl[fl.country == "Germany"]), ("country:Italy", fl[fl.country == "Italy"]),
                   ("country:United States", fl[fl.country == "United States"])]:
    o = old[old.scope == scope].set_index("target").n
    for t in S2:
        assert tot(sub, "stage2", t) == o[t], (scope, t)
    for t in S3:
        assert tot(sub, "stage3", t) == o[t], (scope, t)
countries = EU31 + ["United States"]
fl["c"] = fl.country.where(fl.country.isin(countries), "Rest of world")
names = countries + ["Rest of world"]
g = fl.assign(company=fl.company.fillna(""), stage3=fl.stage3.fillna("")) \
      .groupby(["c", "start_year", "stage2", "company", "stage3"]).n.sum().reset_index()
ix = lambda lst: {v: i for i, v in enumerate(lst)}
ci, si, oi, ti = ix(names), ix(S2), ix(CO), ix(S3)
flows = [[ci[r.c], int(r.start_year), si[r.stage2], oi.get(r.company, -1), ti.get(r.stage3, -1), int(r.n)] for r in g.itertuples()]
assert sum(f[5] for f in flows) == int(fl.n.sum())

# ---- slide 4: the report's 60,000-point cloud, moved into the coordinates of the hexagon layout
import re  # noqa: E402
import numpy as np  # noqa: E402
html = open(os.path.join(FIG, "report.html"), encoding="utf-8").read()
circ = np.array(re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)"', html), dtype=float)
pdata = json.loads(re.search(r"const UMAP_DATA = (\[.*?\]);\n", html, flags=re.S).group(1))
pgroups = json.loads(re.search(r"const UMAP_GROUPS = (\[.*?\]);", html).group(1))
assert len(circ) == len(pdata) == 60000, (len(circ), len(pdata))
known = {r["f"]: (r["x"], r["y"]) for r in rep["field_map"]["search"]}
idx = [i for i, r in enumerate(pdata) if r["f"] in known]
xy = np.array([known[pdata[i]["f"]] for i in idx])
fit = [np.polyfit(circ[idx, k], xy[:, k], 1) for k in (0, 1)]          # svg -> layout is one scale + shift per axis
res = max(np.abs(np.polyval(fit[k], circ[idx, k]) - xy[:, k]).max() for k in (0, 1))
hexsize = rep["field_map"]["hex_size"]
print(f"point cloud: {len(idx)} anchor names, worst misplacement {res:.4f} layout units (one hexagon = {hexsize:.3f})")
assert len(idx) > 1000 and res < hexsize / 2, "point cloud does not line up with the hexagon layout"
px, py = (np.polyval(fit[k], circ[:, k]) for k in (0, 1))
order = sorted(range(len(pdata)), key=lambda i: pdata[i]["n"])            # common names drawn last, on top
points = dict(groups=pgroups, rows=[[round(float(px[i]), 3), round(float(py[i]), 3), pdata[i]["g"], pdata[i]["n"], pdata[i]["f"]] for i in order])

out = dict(
    points=points,
    meta=dict(rep["meta"], unclassified_pct=round(unclassified_pct, 1), internships=int(fl.n.sum()), last_cohort_months=last_window),
    junior_ai=rec(junior_ai),                    # older measure, kept for the comparison view on slide 1
    first5_ai=rec(first5_ai),
    stock_cs=rec(cs),
    stock_field=rec(by_field),
    entry_cs=rec(entry_cs[["cohort", "grp", "junior_pct", "n"]]),
    entry_field=rec(entry_field[["cohort", "fgroup", "junior_pct", "n"]]),
    flows=dict(countries=names, eu31=EU31, eu27=[c for c in EU31 if c not in NON_EU27], s2=S2, co=CO, s3=S3, rows=flows),
    field_map=rep["field_map"],
)
js = "window.D=" + json.dumps(out, allow_nan=False, separators=(",", ":"), ensure_ascii=False) + ";\n"
tmp = os.path.join(DATA, "deck_data.js.tmp")
open(tmp, "w", encoding="utf-8").write(js)
os.replace(tmp, os.path.join(DATA, "deck_data.js"))
print(f"deck_data.js {len(js)/1e6:.1f} MB; flows rows {len(flows)}; unclassified person-years {unclassified_pct:.1f}%")
print(cs.pivot(index="cal_year", columns="grp", values="junior_pct").round(1).to_string())
