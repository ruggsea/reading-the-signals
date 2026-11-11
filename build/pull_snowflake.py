"""Two server-side aggregations for the talk, on the same Snowflake engine as the Oct-2026 report.

Run from the revelio_ai checkout:
  REVELIO_BASIS=2026 REVELIO_SUFFIX=full2026 REVELIO_ENGINE=snowflake .venv/bin/python <this file> <out_dir>

Writes:
  internship_flows_country_year.csv  country x internship start year x first outcome x employer x two-year step
  junior_stock_by_field.csv          calendar year x field group x AI-talent flag: junior share of employed graduates
Both are checked against the files the report was built from; any mismatch stops the script.
"""
import os
import sys

import pandas as pd

REPO = os.getcwd()
sys.path.insert(0, REPO)
OUT = sys.argv[1]
import career_config as cfg  # noqa: E402

assert cfg.BASIS == "2026"
FIG = os.path.join(REPO, cfg.FIG)

# ---- 1. internships (skipped when the file is already there)
FLOWS = os.path.join(OUT, "internship_flows_country_year.csv")
if not os.path.exists(FLOWS):
    import analyze_junior_flows as jf  # noqa: E402

    con = cfg.duck_connect()
    jf.build_views(con)
    jf.build_pathway_tables(con)
    flows = con.execute(f"""
        SELECT country, yr AS start_year, stage2, company, stage3, COUNT(*) AS n
        FROM ({jf.PATHWAY_ROWS}) GROUP BY ALL ORDER BY ALL""").df()
    con.close()
    flows.columns = [c.lower() for c in flows.columns]
    ref = pd.read_csv(os.path.join(FIG, "internship_outcomes_by_country_year.csv"))
    key = ["country", "start_year", "stage2", "company"]
    a = flows.groupby(key, dropna=False).n.sum().reset_index()
    m = a.merge(ref, on=key, how="outer", suffixes=("", "_ref"))
    assert len(m) == len(ref) and (m.n == m.n_ref).all(), "internship counts differ from the 9 Nov export"
    flows.to_csv(FLOWS, index=False)
    print("internships:", int(flows.n.sum()), "rows", len(flows), "- matches the 9 Nov export")

# ---- 2. junior share of the employed, by field group
import analyze_longitudinal_careers as lc  # noqa: E402

con = cfg.duck_connect()
lc.build_views(con)
stock = con.execute(f"""
    SELECT year(e.d) AS cal_year, u.degree_group AS fgroup,
      CASE WHEN a.USER_ID IS NOT NULL THEN 'AI talent' ELSE 'Other graduates' END AS grp,
      SUM(CASE WHEN e.SENIORITY IN (1,2) THEN 1 ELSE 0 END) AS junior_n,
      COUNT(*) AS n
    FROM exploded e LEFT JOIN (SELECT DISTINCT USER_ID FROM ai) a USING(USER_ID)
    LEFT JOIN ueg u ON u.USER_ID = e.USER_ID
    WHERE year(e.d) BETWEEN 2015 AND {lc.END_YEAR}
    GROUP BY 1,2,3 ORDER BY 1,2,3""").df()
con.close()
stock.columns = [c.lower() for c in stock.columns]
ref = pd.read_csv(os.path.join(FIG, "junior_stock_ai_vs_not.csv")).set_index(["cal_year", "grp"])
chk = stock.groupby(["cal_year", "grp"])[["junior_n", "n"]].sum()
chk["junior_pct"] = 100 * chk.junior_n / chk.n
j = chk.join(ref, rsuffix="_ref")
assert len(j) == len(ref) and (j.n == j.n_ref).all() and (j.junior_pct - j.junior_pct_ref).abs().max() < 1e-6, \
    "stock by field does not add up to junior_stock_ai_vs_not.csv"
stock.to_csv(os.path.join(OUT, "junior_stock_by_field.csv"), index=False)
print("stock person-years:", int(stock.n.sum()), "- adds up to junior_stock_ai_vs_not.csv")
