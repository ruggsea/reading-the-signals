"""Step 1 of the map update: hexagon of every laid-out degree name, and the mean embedding of each hexagon.

The Sept-2025 layout places 642,851 degree names; the hexagon map bins them into the cells stored in
report_data_2026.json. Names outside that list (the long tail, and everything new in the Oct-2026 delivery)
are later placed in the hexagon whose mean embedding is closest (map_place_snowflake.py).

Run from the revelio_ai checkout:  REVELIO_BASIS=2026 .venv/bin/python <this file> <work_dir>
Writes <work_dir>/hex_centroids.npy (float32 [n_hex, 384], rows in the order of the report's hexes),
       <work_dir>/layout_hex.parquet (norm, hex) and prints a hold-out test of nearest-centroid placement.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

REPO = os.getcwd()
sys.path.insert(0, REPO)
os.environ.setdefault("REVELIO_BASIS", "2026")
import career_config as cfg  # noqa: E402
from classify_degrees_embedding_v2 import normalise  # noqa: E402

OUT = sys.argv[1]
OLD = "figures/longitudinal_careers"
HEX_COLS = 90                                   # build_report_data.HEX_COLS
rep = json.load(open(os.path.join(REPO, "figures/longitudinal_careers_2026/report_data_2026.json"), encoding="utf-8"))
FM = rep["field_map"]

proj = np.load(os.path.join(OLD, "umap_projection.npy"))
vocab = pd.read_csv(cfg.ensure_local(os.path.join(OLD, "field_raw_vocabulary.csv")))
vocab["norm"] = vocab.field.map(lambda s: normalise(s, keep_non_latin=False))      # Sept key: the saved layout is aligned to it
uniq = vocab.drop_duplicates("norm")[["norm", "field", "users"]].reset_index(drop=True)
emb = np.load(cfg.ensure_local(os.path.join(OLD, "field_embeddings.npy")), mmap_mode="r")
assert len(uniq) == len(proj) == len(emb), (len(uniq), len(proj), len(emb))
uniq["x"], uniq["y"] = proj[:, 0], proj[:, 1]

# same frame and binning as build_report_data.field_map
lo, hi = np.percentile(uniq[["x", "y"]], [0.5, 99.5], axis=0)
inside = (uniq.x.between(lo[0], hi[0])) & (uniq.y.between(lo[1], hi[1]))
pts = uniq[inside].copy()
size = (hi[0] - lo[0]) / HEX_COLS / np.sqrt(3)
assert abs(size - FM["hex_size"]) < 1e-9 and np.allclose(lo, FM["origin"]), "frame differs from the report's map"
q = (np.sqrt(3) / 3 * (pts.x - lo[0]) - 1 / 3 * (pts.y - lo[1])) / size
r = (2 / 3 * (pts.y - lo[1])) / size
xq, zq = q, r
yq = -xq - zq
rx, ry, rz = np.round(xq), np.round(yq), np.round(zq)
dx, dy, dz = abs(rx - xq), abs(ry - yq), abs(rz - zq)
rx = np.where((dx > dy) & (dx > dz), -ry - rz, rx)
rz = np.where(~((dx > dy) & (dx > dz)) & ~(dy > dz), -rx - ry, rz)
pts["hq"], pts["hr"] = rx.astype(int), rz.astype(int)

hexes = FM["hexes"]
hid = {(h["q"], h["r"]): i for i, h in enumerate(hexes)}
pts["hex"] = [hid.get(k, -1) for k in zip(pts.hq, pts.hr)]
assert (pts.hex >= 0).all() and len(pts) == FM["n_fields"], (int((pts.hex < 0).sum()), len(pts), FM["n_fields"])
cnt = pts.groupby("hex").size()
assert all(cnt[i] == h["fields"] for i, h in enumerate(hexes)), "names per hexagon differ from the report"
print(f"layout reproduced: {len(pts):,} names in {len(hexes):,} hexagons, counts equal to the report")

# mean embedding per hexagon (rows are unit length already; renormalise the mean)
E = np.asarray(emb[pts.index.values], dtype=np.float32)
E /= np.linalg.norm(E, axis=1, keepdims=True)
hx = pts.hex.values
C = np.zeros((len(hexes), E.shape[1]), dtype=np.float32)
np.add.at(C, hx, E)
Cn = C / np.linalg.norm(C, axis=1, keepdims=True)
np.save(os.path.join(OUT, "hex_centroids.npy"), Cn)
pts[["norm", "hex"]].to_parquet(os.path.join(OUT, "layout_hex.parquet"), index=False)
np.save(os.path.join(OUT, "sample_emb.npy"), E[:2000])            # for the parity test of the Snowflake function
pts[["norm", "field", "hex"]].head(2000).to_parquet(os.path.join(OUT, "sample_names.parquet"), index=False)

# ---- hold-out test: place names whose true hexagon is known, with their own vector taken out of the mean
rng = np.random.default_rng(0)
test = rng.choice(len(pts), 40000, replace=False)
n_in = cnt.reindex(range(len(hexes))).values
hq = np.array([h["q"] for h in hexes]); hr = np.array([h["r"] for h in hexes])
grp = np.array([h["group"] for h in hexes], dtype=object)
same = ring1 = ring2 = sgrp = 0
sims_ok, sims_bad = [], []
for i in test:
    v, t = E[i], hx[i]
    S = Cn @ v
    if n_in[t] > 1:                                  # leave-one-out mean for the true hexagon
        c = C[t] - v
        S[t] = float(c @ v / np.linalg.norm(c))
    else:
        S[t] = -1                                    # a hexagon holding only this name cannot be found
    b = int(S.argmax())
    d = max(abs(hq[b] - hq[t]), abs(hr[b] - hr[t]), abs((hq[b] + hr[b]) - (hq[t] + hr[t])))
    same += d == 0; ring1 += d <= 1; ring2 += d <= 2; sgrp += grp[b] == grp[t]
    (sims_ok if d <= 2 else sims_bad).append(float(S[b]))
n = len(test)
print(f"hold-out, {n:,} laid-out names placed by nearest hexagon mean (own vector removed):")
print(f"  same hexagon {100*same/n:.1f}% | within 1 hexagon {100*ring1/n:.1f}% | within 2 {100*ring2/n:.1f}% | same field colour {100*sgrp/n:.1f}%")
print("  similarity to the chosen hexagon, placed within 2:", np.percentile(sims_ok, [1, 5, 25, 50]).round(3), "| placed further away:", np.percentile(sims_bad, [5, 25, 50, 75]).round(3))
w = pts.users.values[test]
ok2 = np.array([0] * n)
print(f"  map is {hq.max()-hq.min()+1} hexagons wide")
