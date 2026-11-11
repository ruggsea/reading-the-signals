"""Step 2 of the map update, all on Snowflake: place every degree name that the Sept-2025 layout lacks.

The laptop only sends which hexagon each laid-out name is in (a short hash per name, from map_prepare.py).
Snowflake then embeds every name with its built-in multilingual model, averages the vectors of the laid-out names
per hexagon, and puts each other name in the hexagon whose average it is closest to. A hold-out of laid-out names
(left out of the averages) measures how often that lands a name where the layout has it.

Run from the revelio_ai checkout:  .venv/bin/python <this file> <work_dir> probe|upload|embed|holdout|place|aggregate
Tables (REVELIO_2026.PUBLIC): MAP_LAYOUT_HASH_2026, MAP_KEY_NORM_2026, MAP_NAME_EMB_2026, MAP_HEX_CENT_2026, MAP_FIELD_HEX_2026.
"""
import hashlib
import json
import os
import sys
import time

import numpy as np
import pandas as pd

REPO = os.getcwd()
sys.path.insert(0, os.path.join(REPO, "queries")); sys.path.insert(0, REPO)
os.environ.setdefault("REVELIO_BASIS", "2026")
import career_config as cfg  # noqa: E402
from sf_connect import connect  # noqa: E402
from snowflake.connector.pandas_tools import write_pandas  # noqa: E402

WORK, STEP = sys.argv[1], sys.argv[2]
DB = "REVELIO_2026.PUBLIC"
MODEL, DIM = os.environ.get("MAP_MODEL", "multilingual-e5-large"), 1024
EMB = f"SNOWFLAKE.CORTEX.EMBED_TEXT_{DIM}('{MODEL}', field_norm)"
WH = os.environ.get("MAP_WAREHOUSE", "COMPUTE_LARGE")
HOLD = 16                                    # 1 name in 16 of the layout is left out of the hexagon averages for the test
conn = connect(); cur = conn.cursor()
cur.execute(f"USE WAREHOUSE {WH}"); cur.execute(f"USE SCHEMA {DB}")
run = lambda sql: cur.execute(sql)
h12 = lambda s: hashlib.md5(s.encode("utf-8")).hexdigest()[:12]


def timed(label, sql):
    t0 = time.time(); run(sql); print(f"{label}: {time.time() - t0:.0f} s", flush=True)


if STEP == "probe":
    print("warehouses:", [(r[0], r[3]) for r in run("SHOW WAREHOUSES").fetchall()])
    t0 = time.time()
    r = run(f"""SELECT COUNT(*), MIN(VECTOR_INNER_PRODUCT(e, e)) FROM (
        SELECT {EMB} AS e FROM (SELECT DISTINCT field_norm FROM {DB}.FIELD_VOCAB_2026 WHERE field_norm <> '' LIMIT 20000))""").fetchone()
    dt = time.time() - t0
    print(f"{MODEL}: {r[0]:,} names embedded in {dt:.0f} s = {r[0]/dt:,.0f} names/s; squared length {r[1]:.3f}")
    pairs = [("computer science", "informatique"), ("computer science", "informatik"), ("computer science", "rechtswissenschaft"), ("law", "droit"), ("law", "nursing")]
    for a, b in pairs:
        v = run(f"SELECT VECTOR_COSINE_SIMILARITY(SNOWFLAKE.CORTEX.EMBED_TEXT_{DIM}('{MODEL}', %s), SNOWFLAKE.CORTEX.EMBED_TEXT_{DIM}('{MODEL}', %s))", (a, b)).fetchone()[0]
        print(f"  {a} ~ {b}: {v:.3f}")

elif STEP == "upload":
    lay = pd.read_parquet(os.path.join(WORK, "layout_hex.parquet"))
    lay = lay[lay.norm.str.len() > 0]
    df = pd.DataFrame({"H": lay.norm.map(h12).values, "HEX": lay.hex.astype("int16").values})
    assert df.H.is_unique, "hash collision inside the layout"
    run(f"CREATE OR REPLACE TABLE {DB}.MAP_LAYOUT_HASH_2026 (H STRING, HEX NUMBER)")
    t0 = time.time()
    write_pandas(conn, df, "MAP_LAYOUT_HASH_2026", database="REVELIO_2026", schema="PUBLIC", quote_identifiers=False, compression="gzip")
    print(f"uploaded {len(df):,} rows in {time.time()-t0:.0f} s:", run(f"SELECT COUNT(*), COUNT(DISTINCT hex) FROM {DB}.MAP_LAYOUT_HASH_2026").fetchone())

elif STEP == "embed":
    # every degree string of the delivery, keyed exactly as build_report_data.field_metrics keys it, with its normalised name
    timed("keys normalised", f"""CREATE OR REPLACE TABLE {DB}.MAP_KEY_NORM_2026 AS
        SELECT raw, {DB}.FIELD_NORMALISE(raw) AS field_norm FROM (
          SELECT DISTINCT LOWER(TRIM(COALESCE(NULLIF(FIELD_RAW, ''), FIELD))) AS raw FROM {DB}.STUDY_EDU) WHERE raw IS NOT NULL""")
    print(run(f"SELECT COUNT(*), COUNT(DISTINCT field_norm) FROM {DB}.MAP_KEY_NORM_2026").fetchone(), flush=True)
    # one row per name: layout hexagon (NULL when the name is not in the layout), hold-out flag, embedding
    timed("names embedded", f"""CREATE OR REPLACE TABLE {DB}.MAP_NAME_EMB_2026 AS
        SELECT v.field_norm, l.hex AS layout_hex, (l.hex IS NOT NULL AND MOD(ABS(HASH(v.field_norm)), {HOLD}) = 0) AS held_out, {EMB.replace('field_norm', 'v.field_norm')} AS emb
        FROM (SELECT DISTINCT field_norm FROM {DB}.MAP_KEY_NORM_2026 WHERE field_norm IS NOT NULL AND field_norm <> '') v
        LEFT JOIN {DB}.MAP_LAYOUT_HASH_2026 l ON l.h = SUBSTR(MD5(v.field_norm), 1, 12)""")
    print("names, in layout, held out:", run(f"SELECT COUNT(*), COUNT(layout_hex), COUNT_IF(held_out) FROM {DB}.MAP_NAME_EMB_2026").fetchone(), flush=True)
    # hexagon averages from the laid-out names that are not held out (element-wise mean, then unit length)
    timed("hexagon averages", f"""CREATE OR REPLACE TABLE {DB}.MAP_HEX_CENT_2026 AS
        WITH el AS (SELECT n.layout_hex AS hex, f.index AS i, AVG(f.value::FLOAT) AS v
                    FROM {DB}.MAP_NAME_EMB_2026 n, LATERAL FLATTEN(input => n.emb::ARRAY) f
                    WHERE n.layout_hex IS NOT NULL AND NOT n.held_out GROUP BY 1, 2),
             nm AS (SELECT hex, SQRT(SUM(v * v)) AS len FROM el GROUP BY 1)
        SELECT el.hex, ARRAY_AGG(el.v / nm.len) WITHIN GROUP (ORDER BY el.i)::VECTOR(FLOAT, {DIM}) AS cent
        FROM el JOIN nm USING (hex) GROUP BY el.hex""")
    print("hexagons with an average:", run(f"SELECT COUNT(*) FROM {DB}.MAP_HEX_CENT_2026").fetchone(), flush=True)

elif STEP in ("holdout", "place"):
    # two stages: shortlist the TOPK hexagons whose average is closest, then take the hexagon of the single most similar
    # laid-out name inside the shortlist (TOPK=0: nearest average only)
    TOPK = int(os.environ.get("MAP_TOPK", "5"))
    cond = "n.held_out" if STEP == "holdout" else "n.layout_hex IS NULL"
    target = "map_holdout" if STEP == "holdout" else f"{DB}.MAP_PLACED_2026"
    kind = "TEMPORARY TABLE" if STEP == "holdout" else "TABLE"
    if TOPK == 0:
        timed(STEP, f"""CREATE OR REPLACE {kind} {target} AS
            SELECT n.field_norm, n.layout_hex, MAX_BY(c.hex, VECTOR_INNER_PRODUCT(n.emb, c.cent)) AS hex, MAX(VECTOR_INNER_PRODUCT(n.emb, c.cent)) AS sim
            FROM {DB}.MAP_NAME_EMB_2026 n CROSS JOIN {DB}.MAP_HEX_CENT_2026 c WHERE {cond} GROUP BY 1, 2""")
    else:
        timed(f"{STEP}: shortlist of {TOPK} hexagons", f"""CREATE OR REPLACE TEMPORARY TABLE map_cand AS
            SELECT n.field_norm, n.layout_hex, c.hex AS cand
            FROM {DB}.MAP_NAME_EMB_2026 n CROSS JOIN {DB}.MAP_HEX_CENT_2026 c WHERE {cond}
            QUALIFY ROW_NUMBER() OVER (PARTITION BY n.field_norm ORDER BY VECTOR_INNER_PRODUCT(n.emb, c.cent) DESC) <= {TOPK}""")
        timed(f"{STEP}: most similar laid-out name", f"""CREATE OR REPLACE {kind} {target} AS
            SELECT k.field_norm, k.layout_hex, MAX_BY(m.layout_hex, VECTOR_INNER_PRODUCT(n.emb, m.emb)) AS hex, MAX(VECTOR_INNER_PRODUCT(n.emb, m.emb)) AS sim
            FROM map_cand k JOIN {DB}.MAP_NAME_EMB_2026 n ON n.field_norm = k.field_norm
            JOIN {DB}.MAP_NAME_EMB_2026 m ON m.layout_hex = k.cand AND NOT m.held_out
            GROUP BY 1, 2""")
    if STEP == "holdout":
        d = run("SELECT layout_hex, hex, sim FROM map_holdout").fetch_pandas_all(); d.columns = [c.lower() for c in d.columns]
        hexes = json.load(open(os.path.join(REPO, "figures/longitudinal_careers_2026/report_data_2026.json"), encoding="utf-8"))["field_map"]["hexes"]
        q = np.array([h["q"] for h in hexes]); r = np.array([h["r"] for h in hexes]); g = np.array([h["group"] for h in hexes], dtype=object)
        a, b = d.layout_hex.astype(int).values, d.hex.astype(int).values
        dist = np.maximum.reduce([abs(q[a] - q[b]), abs(r[a] - r[b]), abs((q[a] + r[a]) - (q[b] + r[b]))])
        res = {"n": int(len(d)), "same": float((dist == 0).mean()), "within1": float((dist <= 1).mean()), "within2": float((dist <= 2).mean()), "same_colour": float((g[a] == g[b]).mean())}
        print(f"hold-out, {len(d):,} laid-out names left out of the averages: same hexagon {100*res['same']:.1f}% | within 1 {100*res['within1']:.1f}% | within 2 {100*res['within2']:.1f}% | same field colour {100*res['same_colour']:.1f}%")
        json.dump(res, open(os.path.join(WORK, "holdout.json"), "w"))
    else:
        run(f"""CREATE OR REPLACE TABLE {DB}.MAP_FIELD_HEX_2026 AS
            SELECT field_norm, layout_hex AS hex, TRUE AS in_layout FROM {DB}.MAP_NAME_EMB_2026 WHERE layout_hex IS NOT NULL
            UNION ALL SELECT field_norm, hex, FALSE FROM {DB}.MAP_PLACED_2026""")
        print(run(f"SELECT in_layout, COUNT(*), COUNT(DISTINCT hex) FROM {DB}.MAP_FIELD_HEX_2026 GROUP BY 1").fetchall())

elif STEP == "aggregate":
    # the report's per-name metrics (build_report_data.field_metrics), summed per hexagon for names in the layout and for placed names
    rank = "CASE e.DEGREE WHEN 'Doctor' THEN 6 WHEN 'MBA' THEN 5 WHEN 'Master' THEN 5 WHEN 'Bachelor' THEN 4 WHEN 'Professional' THEN 3 ELSE 2 END"
    timed("top degree per graduate", f"""CREATE OR REPLACE TEMPORARY TABLE map_top AS
        SELECT USER_ID, norm, EDU_END, YEAR(EDU_END) AS cohort FROM (
          SELECT e.USER_ID, k.field_norm AS norm, e.EDU_END,
                 ROW_NUMBER() OVER (PARTITION BY e.USER_ID ORDER BY {rank} DESC, e.EDU_END DESC, (k.field_norm IS NULL), e.EDUCATION_NUMBER, k.field_norm) AS rn
          FROM {DB}.STUDY_EDU e LEFT JOIN {DB}.MAP_KEY_NORM_2026 k ON k.raw = LOWER(TRIM(COALESCE(NULLIF(e.FIELD_RAW, ''), e.FIELD)))
          WHERE e.EDU_END BETWEEN DATE '2005-01-01' AND DATE '{cfg.DATA_END}') WHERE rn = 1""")
    timed("first job per graduate", f"""CREATE OR REPLACE TEMPORARY TABLE map_fj AS
        SELECT t.USER_ID, t.norm, t.cohort,
               MIN(IFF(TRY_TO_DATE(TO_VARCHAR(p.STARTDATE)) BETWEEN DATEADD(month, -6, t.EDU_END) AND DATEADD(month, 24, t.EDU_END), p.SENIORITY, NULL)) AS sen
        FROM map_top t LEFT JOIN {DB}.STUDY_POS p ON p.USER_ID = t.USER_ID GROUP BY 1, 2, 3""")
    last_full = cfg.LAST_FULL_COHORT
    d = run(f"""
        SELECT h.hex, h.in_layout, COUNT(*) AS users, COUNT(DISTINCT f.norm) AS names,
               COUNT_IF(f.cohort BETWEEN 2015 AND 2019 AND f.sen IS NOT NULL) AS n_pre,
               COUNT_IF(f.cohort BETWEEN 2015 AND 2019 AND f.sen IN (1, 2)) AS j_pre,
               COUNT_IF(f.cohort BETWEEN 2023 AND {last_full} AND f.sen IS NOT NULL) AS n_post,
               COUNT_IF(f.cohort BETWEEN 2023 AND {last_full} AND f.sen IN (1, 2)) AS j_post,
               COUNT_IF(a.USER_ID IS NOT NULL) AS ai
        FROM map_fj f JOIN {DB}.MAP_FIELD_HEX_2026 h ON h.field_norm = f.norm
        LEFT JOIN (SELECT DISTINCT USER_ID FROM {DB}.STUDY_AI) a ON a.USER_ID = f.USER_ID
        GROUP BY 1, 2 ORDER BY 1, 2""").fetch_pandas_all()
    d.columns = [c.lower() for c in d.columns]
    tot = run("SELECT COUNT(*), COUNT_IF(norm IS NOT NULL AND norm <> '') FROM map_fj").fetchone()
    names = run(f"SELECT COUNT(*), COUNT_IF(in_layout) FROM {DB}.MAP_FIELD_HEX_2026").fetchone()
    d.to_csv(os.path.join(WORK, "hex_metrics_2026.csv"), index=False)
    json.dump({"graduates": int(tot[0]), "graduates_with_name": int(tot[1]), "names": int(names[0]), "names_in_layout": int(names[1]), "model": MODEL},
              open(os.path.join(WORK, "hex_metrics_totals.json"), "w"))
    print("graduates:", tot, "| names:", names, "| graduates on the map:", int(d.users.sum()), "of which through layout names:", int(d[d.in_layout].users.sum()))
conn.close()
