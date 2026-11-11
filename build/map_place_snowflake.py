"""Step 2 of the map update: place every degree name that the Sept-2025 layout lacks, on Snowflake compute.

A Python function on Snowflake runs the same sentence-embedding model as the report
(paraphrase-multilingual-MiniLM-L12-v2) and returns, for a degree name, the hexagon whose mean embedding is
closest (hex_centroids.npy from map_prepare.py). Names never leave Snowflake; only the model and the 4,347
hexagon means are uploaded.

Run from the revelio_ai checkout:  .venv/bin/python <this file> <work_dir> setup|test|bench|full|aggregate
Objects (REVELIO_2026.PUBLIC): MAP_PLACE_HEX (function), MAP_LAYOUT_HEX_2026, MAP_FIELD_HEX_2026 (tables).
"""
import glob
import os
import sys
import time
import zipfile

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
STAGE = f"{cfg.ARTIFACT_STAGE}/map_2026"
WH = os.environ.get("MAP_WAREHOUSE", "COMPUTE_LARGE")
conn = connect(); cur = conn.cursor()
cur.execute(f"USE WAREHOUSE {WH}"); cur.execute(f"USE SCHEMA {DB}")

UDF = r'''
import fcntl, os, sys, zipfile
import numpy as np
import pandas as pd
import _snowflake

IMPORTS = sys._xoptions["snowflake_import_directory"]
_state = {}

def _load():
    if "model" not in _state:
        target = "/tmp/minilm"
        with open("/tmp/minilm.lock", "w") as lock:          # several processes share a node: unpack once
            fcntl.flock(lock, fcntl.LOCK_EX)
            if not os.path.exists(os.path.join(target, "done")):
                zipfile.ZipFile(os.path.join(IMPORTS, "minilm.zip")).extractall(target)
                open(os.path.join(target, "done"), "w").close()
            fcntl.flock(lock, fcntl.LOCK_UN)
        import torch
        torch.set_num_threads(1)
        from sentence_transformers import SentenceTransformer
        _state["model"] = SentenceTransformer(target, device="cpu")
        _state["cent"] = np.load(os.path.join(IMPORTS, "hex_centroids.npy"))

def _embed(texts):
    _load()
    texts = ["" if t is None else str(t) for t in texts]
    order = np.argsort([len(t) for t in texts], kind="stable")
    emb = np.zeros((len(texts), 384), dtype=np.float32)
    emb[order] = _state["model"].encode([texts[i] for i in order], batch_size=128, normalize_embeddings=True, show_progress_bar=False)
    return emb

@_snowflake.vectorized(input=pd.DataFrame, max_batch_size=4000)
def place(df):
    return pd.Series((_embed(df[0].tolist()) @ _state["cent"].T).argmax(axis=1).astype("int64"))

@_snowflake.vectorized(input=pd.DataFrame, max_batch_size=1000)
def embed(df):
    return pd.Series([[float(x) for x in row] for row in _embed(df[0].tolist())])
'''


def create_functions():
    imports = f"IMPORTS=('{STAGE}/minilm.zip', '{STAGE}/hex_centroids.npy')"
    common = "LANGUAGE PYTHON RUNTIME_VERSION='3.11' PACKAGES=('sentence-transformers','pytorch','numpy','pandas')"
    cur.execute(f"CREATE OR REPLACE FUNCTION {DB}.MAP_PLACE_HEX(s STRING) RETURNS NUMBER {common} {imports} HANDLER='place' AS $${UDF}$$")
    cur.execute(f"CREATE OR REPLACE FUNCTION {DB}.MAP_EMBED(s STRING) RETURNS ARRAY {common} {imports} HANDLER='embed' AS $${UDF}$$")


if STEP == "setup":
    snap = sorted(glob.glob(os.path.expanduser("~/.cache/huggingface/hub/models--sentence-transformers--paraphrase-multilingual-MiniLM-L12-v2/snapshots/*")))[-1]
    keep = lambda p: not any(k in p for k in ("onnx", "openvino", "tf_model", "rust_model", ".h5", ".ot", "README", ".gitattributes"))
    files = [f for f in glob.glob(os.path.join(snap, "**"), recursive=True) if os.path.isfile(f) and keep(f)]
    has_st = any(f.endswith("model.safetensors") for f in files)
    files = [f for f in files if not (has_st and f.endswith("pytorch_model.bin"))]
    zpath = os.path.join(WORK, "minilm.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:
        for f in files:
            z.write(os.path.realpath(f), os.path.relpath(f, snap))
    print("model zip:", [os.path.relpath(f, snap) for f in files], f"{os.path.getsize(zpath)/1e6:.0f} MB")
    for f in (zpath, os.path.join(WORK, "hex_centroids.npy")):
        cur.execute(f"PUT 'file://{f}' '{STAGE}/' AUTO_COMPRESS=FALSE OVERWRITE=TRUE")
    print([(r[0], r[1]) for r in cur.execute(f"LIST '{STAGE}/'").fetchall()])
    lay = pd.read_parquet(os.path.join(WORK, "layout_hex.parquet")).rename(columns={"norm": "FIELD_NORM", "hex": "HEX"})
    cur.execute(f"CREATE OR REPLACE TABLE {DB}.MAP_LAYOUT_HEX_2026 (FIELD_NORM STRING, HEX NUMBER)")
    write_pandas(conn, lay, "MAP_LAYOUT_HEX_2026", database="REVELIO_2026", schema="PUBLIC", quote_identifiers=False)
    print("layout rows:", cur.execute(f"SELECT COUNT(*), COUNT(DISTINCT field_norm) FROM {DB}.MAP_LAYOUT_HEX_2026").fetchone())
    create_functions()
    print("functions created")

elif STEP == "test":      # the function must give the laptop's vectors and hexagons for names embedded in September
    names = pd.read_parquet(os.path.join(WORK, "sample_names.parquet")); E = np.load(os.path.join(WORK, "sample_emb.npy"))
    C = np.load(os.path.join(WORK, "hex_centroids.npy")); local = (E @ C.T).argmax(axis=1)
    cur.execute("CREATE OR REPLACE TEMPORARY TABLE map_probe (I NUMBER, S STRING)")
    write_pandas(conn, pd.DataFrame({"I": range(len(names)), "S": names.norm.values}), "MAP_PROBE", quote_identifiers=False)
    t0 = time.time()
    got = cur.execute(f"SELECT i, {DB}.MAP_PLACE_HEX(s) FROM map_probe ORDER BY i").fetchall()
    print(f"{len(got)} names placed in {time.time()-t0:.0f} s")
    remote = np.array([int(r[1]) for r in got])
    print(f"same hexagon as the laptop: {100*(remote == local).mean():.2f}%")
    vec = cur.execute(f"SELECT i, {DB}.MAP_EMBED(s) FROM map_probe WHERE i < 200 ORDER BY i").fetchall()
    import json
    V = np.array([json.loads(r[1]) if isinstance(r[1], str) else r[1] for r in vec], dtype=np.float32)
    cos = (V * E[:200]).sum(axis=1)
    print(f"cosine between Snowflake and September vectors: min {cos.min():.4f}, median {np.median(cos):.4f}")
    assert (remote == local).mean() > 0.99 and cos.min() > 0.995, "the Snowflake function does not reproduce the laptop embeddings"

elif STEP == "bench":
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 200000
    t0 = time.time()
    r = cur.execute(f"""SELECT COUNT(*), COUNT(DISTINCT h) FROM (
        SELECT {DB}.MAP_PLACE_HEX(field_norm) h FROM (SELECT DISTINCT field_norm FROM {DB}.FIELD_VOCAB_2026 WHERE field_norm IS NOT NULL AND field_norm <> '' LIMIT {n}))""").fetchone()
    dt = time.time() - t0
    print(f"{WH}: {r[0]:,} names in {dt:.0f} s = {r[0]/dt:,.0f} names/s, {r[1]} hexagons used")

elif STEP == "full":
    t0 = time.time()
    cur.execute(f"""CREATE OR REPLACE TABLE {DB}.MAP_FIELD_HEX_2026 AS
        SELECT v.field_norm, COALESCE(l.hex, {DB}.MAP_PLACE_HEX(v.field_norm)) AS hex, (l.hex IS NOT NULL) AS in_layout
        FROM (SELECT DISTINCT field_norm FROM {DB}.FIELD_VOCAB_2026 WHERE field_norm IS NOT NULL AND field_norm <> '') v
        LEFT JOIN {DB}.MAP_LAYOUT_HEX_2026 l ON l.field_norm = v.field_norm""")
    print(f"placed in {time.time()-t0:.0f} s:", cur.execute(f"SELECT in_layout, COUNT(*), COUNT(DISTINCT hex) FROM {DB}.MAP_FIELD_HEX_2026 GROUP BY 1").fetchall())
conn.close()
