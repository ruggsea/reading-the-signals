"""Country split for slides 2 and 3, on the same Snowflake engine and the same rows as the existing files.

Country is the country of the job (as the internship chart uses the country of the internship):
  first5   every job held in the graduation year or the five after      -> country of that job
  old      every job started since 2015, all graduates since 2005       -> country of that job
  entry    starting job (6 months before to 24 months after graduating) -> country of the first job begun in that window
The 31 European countries and the US are kept by name; every other country, and jobs with no country, are "Rest of world".

Run from the revelio_ai checkout (session-temporary objects only):
  REVELIO_BASIS=2026 REVELIO_SUFFIX=full2026 REVELIO_ENGINE=snowflake .venv/bin/python <this file> <out_dir>

Each file is written only if its totals over countries equal the file the slides already use.
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
NAMED = [c for c in jf.EUROPE.replace("'", "").split(",") if c] + ["United States"]
IN = ",".join("'" + c + "'" for c in NAMED)
bucket = lambda col: f"CASE WHEN {col} IN ({IN}) THEN {col} ELSE 'Rest of world' END"
lo, hi = jf.YEARS_SINCE_GRAD
low = lambda d: d.rename(columns=str.lower)

# ---- first5 and old: one connection, the views of analyze_junior_flows
con = cfg.duck_connect()
jf.build_views(con)
con.execute(f"CREATE VIEW ai AS SELECT * FROM read_parquet('{cfg.DATA}/ai_flag_{cfg.SUFFIX}.parquet')")
con.execute(f"CREATE VIEW ueg AS SELECT * FROM read_parquet('{cfg.UEG}')")
con.execute("CREATE TABLE aiu AS SELECT DISTINCT USER_ID FROM ai")
con.execute("""CREATE TABLE person AS
    SELECT g.USER_ID, g.grad_date, u.degree_group AS fgroup,
           CASE WHEN a.USER_ID IS NOT NULL THEN 'AI talent' ELSE 'Other graduates' END AS grp
    FROM grad g LEFT JOIN aiu a USING (USER_ID) LEFT JOIN ueg u ON u.USER_ID = g.USER_ID""")
first5 = low(con.execute(f"""
    WITH py AS (
      SELECT s.SENIORITY, {bucket('s.COUNTRY')} AS country, g.fgroup, g.grp, g.grad_date,
             unnest(generate_series(year(s.sd), year(s.ed))) AS yr
      FROM spans s JOIN person g USING (USER_ID))
    SELECT yr AS cal_year, country, fgroup, grp,
           SUM(CASE WHEN SENIORITY IN (1,2) THEN 1 ELSE 0 END) AS junior_n, COUNT(*) AS n
    FROM py
    WHERE yr BETWEEN 2015 AND {jf.END_YEAR} AND yr - year(grad_date) BETWEEN {lo} AND {hi}
    GROUP BY ALL ORDER BY ALL""").df())
old = low(con.execute(f"""
    WITH py AS (
      SELECT s.SENIORITY, {bucket('s.COUNTRY')} AS country,
             CASE WHEN a.USER_ID IS NOT NULL THEN 'AI talent' ELSE 'Other graduates' END AS grp,
             unnest(generate_series(year(s.sd), year(s.ed))) AS yr
      FROM spans s LEFT JOIN aiu a USING (USER_ID) WHERE year(s.sd) >= 2015)
    SELECT yr AS cal_year, country, grp,
           SUM(CASE WHEN SENIORITY IN (1,2) THEN 1 ELSE 0 END) AS junior_n, COUNT(*) AS n
    FROM py WHERE yr BETWEEN 2015 AND {jf.END_YEAR}
    GROUP BY ALL ORDER BY ALL""").df())
con.close()

ref = pd.read_csv(os.path.join(OUT, "junior_first5_by_field_ai.csv"))
key = ["cal_year", "fgroup", "grp"]
a = first5.groupby(key, dropna=False)[["junior_n", "n"]].sum().reset_index()
b = ref.groupby(key, dropna=False)[["junior_n", "n"]].sum().reset_index()
m = a.merge(b, on=key, how="outer", suffixes=("", "_ref"))
assert len(m) == len(b) and (m.n == m.n_ref).all() and (m.junior_n == m.junior_n_ref).all(), "first5 by country does not add up to the slide's file"
first5.to_csv(os.path.join(OUT, "junior_first5_by_country.csv"), index=False)
print("first5 by country:", len(first5), "rows, adds up to junior_first5_by_field_ai.csv", flush=True)

ref = pd.read_csv(os.path.join(FIG, "junior_stock_ai_vs_not.csv")).set_index(["cal_year", "grp"])
t = old.groupby(["cal_year", "grp"])[["junior_n", "n"]].sum()
j = t.join(ref, rsuffix="_ref")
assert len(j) == len(ref) and (j.n == j.n_ref).all() and (100 * j.junior_n / j.n - j.junior_pct).abs().max() < 1e-6, "old measure by country does not add up to the report's file"
old.to_csv(os.path.join(OUT, "junior_old_by_country.csv"), index=False)
print("old measure by country:", len(old), "rows, adds up to junior_stock_ai_vs_not.csv", flush=True)

# ---- entry: the views of analyze_longitudinal_deep
import analyze_longitudinal_deep as ld  # noqa: E402

con = cfg.duck_connect()
ld.build_views(con)
entry = low(con.execute(f"""
    WITH c AS (
      SELECT g.USER_ID, arg_min(p.COUNTRY, (TRY_CAST(p.STARTDATE AS DATE), p.POSITION_ID)) AS country
      FROM fgrp g JOIN pos p ON p.USER_ID = g.USER_ID
      WHERE p.SENIORITY IS NOT NULL
        AND TRY_CAST(p.STARTDATE AS DATE) >= g.grad_date - INTERVAL 6 MONTH
        AND TRY_CAST(p.STARTDATE AS DATE) <= g.grad_date + INTERVAL 24 MONTH
      GROUP BY 1)
    SELECT f.cohort, {bucket('c.country')} AS country, f.fgroup,
           SUM(CASE WHEN f.entry_sen IN (1,2) THEN 1 ELSE 0 END) AS junior_n, COUNT(*) AS n
    FROM first_job f LEFT JOIN c USING (USER_ID)
    WHERE f.entry_sen IS NOT NULL AND f.cohort BETWEEN 2005 AND {ld.LAST}
    GROUP BY ALL ORDER BY ALL""").df())
con.close()
ref = pd.read_csv(os.path.join(FIG, "entry_by_fieldgroup_cohort.csv")).dropna(subset=["fgroup"]).set_index(["cohort", "fgroup"])
t = entry.dropna(subset=["fgroup"]).groupby(["cohort", "fgroup"])[["junior_n", "n"]].sum()
j = t.join(ref, rsuffix="_ref")
assert len(j) == len(ref) and (j.n == j.n_ref).all() and (100 * j.junior_n / j.n - j.junior_pct).abs().max() < 1e-6, "entry by country does not add up to the report's file"
entry.to_csv(os.path.join(OUT, "entry_by_country.csv"), index=False)
print("starting job by country:", len(entry), "rows, adds up to entry_by_fieldgroup_cohort.csv")
