#!/usr/bin/env python3
"""日本語トップの正式URLと英語トップのリンク先を静的に確認する。"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"
HREF = re.compile(r'href=["\']([^"\']+)["\']', re.I)
ANCHOR = re.compile(r'<a\b([^>]*)>([\s\S]*?)</a>', re.I)

ja_files = sorted(
    path for path in LP.rglob("*.html")
    if "en" not in path.relative_to(LP).parts
    and (len(path.relative_to(LP).parts) == 1 or path.relative_to(LP).parts[0] in {"festivals", "artists", "venues", "articles", "writers"})
)
en_files = sorted((LP / "en").rglob("*.html"))
ja_bad = []
en_bad = []
ja_links = en_links = 0
for path in ja_files:
    links = HREF.findall(path.read_text(encoding="utf-8", errors="replace"))
    ja_links += sum(link == "/" for link in links)
    if "/index.html" in links:
        ja_bad.append(path.relative_to(ROOT))
for path in en_files:
    html = path.read_text(encoding="utf-8", errors="replace")
    links = HREF.findall(html)
    en_links += sum(link == "/en/index.html" for link in links)
    root_non_language = []
    for attrs, body in ANCHOR.findall(html):
        href = (re.search(r'href=["\']([^"\']+)["\']', attrs, re.I) or [None, ""])[1]
        label = re.sub(r'<[^>]+>', '', body).strip()
        if href == "/" and label != "JA" and "nav-ov-lang" not in attrs:
            root_non_language.append(href)
    if "/index.html" in links or root_non_language:
        en_bad.append(path.relative_to(ROOT))

print(f"  JA pages={len(ja_files)} / formal top links={ja_links} / invalid /index.html pages={len(ja_bad)}")
print(f"  EN pages={len(en_files)} / /en/index.html links={en_links} / invalid top links={len(en_bad)}")
if ja_bad or en_bad:
    for path in ja_bad + en_bad:
        print(f"  ✗ {path}")
    sys.exit(1)
print("  ✅ JA は href=\"/\"、EN は href=\"/en/index.html\" のみ")
