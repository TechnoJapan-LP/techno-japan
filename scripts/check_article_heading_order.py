#!/usr/bin/env python3
"""記事本文の見出しが2段以上下がらないことを検査する。"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADING = re.compile(r"<h([1-6])\b[^>]*>(.*?)</h\1\s*>", re.I | re.S)
REMOVE = re.compile(r"<(?:script|template)\b[^>]*>.*?</(?:script|template)\s*>", re.I | re.S)


def heading_order(html):
    body = REMOVE.sub("", html)
    return [(int(match.group(1)), re.sub(r"<[^>]*>", "", match.group(2)).strip(), match.group(0))
            for match in HEADING.finditer(body)]


def violations(html):
    headings = heading_order(html)
    return [(headings[index - 1], current) for index, current in enumerate(headings[1:], 1)
            if current[0] - headings[index - 1][0] >= 2]


def check_files():
    files = sorted((ROOT / "LP/articles").glob("*.html")) + sorted((ROOT / "LP/en/articles").glob("*.html"))
    failures = []
    for path in files:
        for previous, current in violations(path.read_text(encoding="utf-8", errors="replace")):
            failures.append((path.relative_to(ROOT), previous, current))
    if failures:
        for path, previous, current in failures:
            print(f"FAIL {path}: h{previous[0]} → h{current[0]} ({previous[1]} → {current[1]})")
        return 1
    print(f"  ✅ 記事見出しの段飛びなし: {len(files)}ページ")
    return 0


def self_test():
    broken = "<main><h1>title</h1><h2>one</h2><h4>broken</h4></main>"
    found = violations(broken)
    assert found and found[0][0][2] == "<h2>one</h2>" and found[0][1][2] == "<h4>broken</h4>"
    print("  ✅ わざと壊した HTML の失敗を確認: h2 → h4")


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        self_test()
    raise SystemExit(check_files())
