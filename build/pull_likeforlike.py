"""Junior share of employed graduates in their first five years after graduation, by AI-talent flag and field group.

This is the report's like-for-like measure ("age-adjusted (0-5 years after graduation)" in junior_stock_measures.csv,
analyze_junior_flows.junior_stock_measures): every job active in the calendar year, people 0-5 years after graduation.
The report publishes it for all graduates only; this adds the AI-talent and field-group splits on the same rows.

Run from the revelio_ai checkout (session-temporary objects only):
  REVELIO_BASIS=2026 REVELIO_SUFFIX=full2026 REVELIO_ENGINE=snowflake .venv/bin/python <this file> <out_dir>

Writes junior_first5_by_field_ai.csv and stops unless its totals equal the report's series for every year.
"""
import os
import sys

import pandas as pd

REPO = os.getcwd()
sys.path.insert(0, REPO)
OUT = sys.argv[1]
import career_config as cfg  # noqa: E402
import analyze_junior_flows as jf  # noqa: E402

assert cfg.BASIS == "2026"
FIG = os.path.join(REPO, cfg.FIG)
lo, hi = jf.YEARS_SINCE_GRAD

con = cfg.duck_connect()
jf.build_views(con)
con.execute(f"CREATE VIEW ai AS SELECT * FROM read_parquet('{cfg.DATA}/ai_flag_{cfg.SUFFIX}.parquet')")
con.execute(f"CREATE VIEW ueg AS SELECT * FROM read_parquet('{cfg.UEG}')")
con.execute("CREATE TABLE aiu AS SELECT DISTINCT USER_ID FROM ai")
con.execute("""CREATE TABLE person AS
    SELECT g.USER_ID, g.grad_date, u.degree_group AS fgroup,
           CASE WHEN a.USER_ID IS NOT NULL THEN 'AI talent' ELSE 'Other graduates' END AS grp
    FROM grad g LEFT JOIN aiu a USING (USER_ID) LEFT JOIN ueg u ON u.USER_ID = g.USER_ID""")
d = con.execute(f"""
    WITH py AS (
      SELECT s.USER_ID, s.SENIORITY, g.fgroup, g.grp, g.grad_date,
             unnest(generate_series(year(s.sd), year(s.ed))) AS yr
      FROM spans s JOIN person g USING (USER_ID))
    SELECT yr AS cal_year, fgroup, grp,
           SUM(CASE WHEN SENIORITY IN (1,2) THEN 1 ELSE 0 END) AS junior_n, COUNT(*) AS n
    FROM py
    WHERE yr BETWEEN 2015 AND {jf.END_YEAR} AND yr - year(grad_date) BETWEEN {lo} AND {hi}
    GROUP BY ALL ORDER BY ALL""").df()
con.close()
d.columns = [c.lower() for c in d.columns]

ref = pd.read_csv(os.path.join(FIG, "junior_stock_measures.csv"))
ref = ref[ref.measure.str.startswith("age-adjusted")].set_index("cal_year")
tot = d.groupby("cal_year")[["junior_n", "n"]].sum()
tot["junior_pct"] = 100 * tot.junior_n / tot.n
j = tot.join(ref, rsuffix="_ref")
print(j[["n", "n_ref", "junior_pct", "junior_pct_ref"]].to_string())
assert len(j) == len(ref) and (j.n == j.n_ref).all() and (j.junior_pct - j.junior_pct_ref).abs().max() < 1e-6, \
    "totals differ from the report's like-for-like series"
d.to_csv(os.path.join(OUT, "junior_first5_by_field_ai.csv"), index=False)
ai = d.groupby(["cal_year", "grp"])[["junior_n", "n"]].sum()
print((100 * ai.junior_n / ai.n).unstack().round(1).to_string())
