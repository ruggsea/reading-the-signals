"""index.html = build/index.src.html with the interface logo (kept in vendor/interface-logo.html) put in every slide header.

Run from the repo root: python3 build/inline_logo.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "vendor", "interface-logo.html")
if not os.path.exists(LOGO):       # first run: lift the logo out of the existing page
    page = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    open(LOGO, "w", encoding="utf-8").write(re.search(r'<span class="logo".*?</svg></span>', page, flags=re.S).group(0))
logo = open(LOGO, encoding="utf-8").read()
src = open(os.path.join(ROOT, "build", "index.src.html"), encoding="utf-8").read()
assert src.count("<!--LOGO-->") == 5 and logo.count("<svg") == 2
tmp = os.path.join(ROOT, "index.html.tmp")
open(tmp, "w", encoding="utf-8").write(src.replace("<!--LOGO-->", logo))
os.replace(tmp, os.path.join(ROOT, "index.html"))
print("index.html written")
