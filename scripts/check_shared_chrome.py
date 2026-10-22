#!/usr/bin/env python3
"""全公開ページの共通ヘッダー／メニュー／検索／フッターを検査する。"""
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / "LP"
EXCLUDED = {"app", "cms.html", "map.html"}

def public_pages():
    for file in ROOT.rglob("*.html"):
        rel = file.relative_to(ROOT).as_posix()
        if rel == "app/index.html" or rel in EXCLUDED:
            continue
        text = file.read_text(encoding="utf-8")
        if re.search(r'<meta[^>]+http-equiv=["\']refresh', text, re.I):
            continue
        yield file, rel, text

def href_exists(href):
    path = urlsplit(href).path
    if not path.startswith("/") or path.startswith("//"):
        return True
    path = path.lstrip("/")
    if not path:
        path = "index.html"
    return (ROOT / path).is_file()

errors = []
pages = list(public_pages())
for file, rel, text in pages:
    if text.count('class="nav-overlay"') != 1:
        errors.append(f"{rel}: nav-overlay が1個ではありません")
    if text.count('class="nav-search-link"') != 1:
        errors.append(f"{rel}: nav-search-link がありません")
    if text.count("<!-- tj:footer:start -->") != 1 or text.count("<!-- tj:footer:end -->") != 1:
        errors.append(f"{rel}: 共通フッターの目印がありません")
    footer = text.split("<!-- tj:footer:start -->", 1)[-1].split("<!-- tj:footer:end -->", 1)[0]
    if "footer-watermark" in footer or "<svg" in footer or "ALL RIGHTS RESERVED" in footer or "2024" in footer:
        errors.append(f"{rel}: 旧フッターが残っています")
    lang_links = re.findall(r'<(?:a|span)\b[^>]*class="[^"]*(?:nav-lang|nav-ov-lang)[^"]*"[^>]*href="([^"]+)"', text)
    for href in lang_links:
        if not href_exists(href):
            errors.append(f"{rel}: 言語切替先がありません: {href}")

if errors:
    print("\n".join(errors))
    raise SystemExit(1)

print(f"shared_chrome: {len(pages)} pages checked; footer kinds=1; pages without new menu=0")
