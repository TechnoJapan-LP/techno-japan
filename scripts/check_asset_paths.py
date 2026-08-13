#!/usr/bin/env python3
"""参照している CSS / JS が実在するか。相対パスのコピー事故を防ぐ。

■ なぜ必要か（AUDIT §9-82）

  2026-08-14、英語版の ABOUT ページが**素の HTML** で公開されていた。
  文字は黒、背景は白、Instagram のアイコンが 1637px で表示されていた。

  原因は1文字。

      LP/about.html    href="common.css"    ← 相対パス

  ルート直下の `/about.html` から見れば `/common.css` に解決するので、
  日本語版は正常に見える。しかし同じファイルが `/en/about.html` として
  置かれると `/en/common.css` を探し、**404 になって CSS も JS も
  一切効かない。**

  **日本語で見えているから正しい、が通用しない種類の壊れ方だった。**
  しかも 404 はページ自体の HTTP 200 に隠れるため、リンク切れ検査にも
  引っかからなかった。

■ 何を見るか（2つ）

  【検査1】参照先が実在するか
    すべての HTML について、href / src が指す .css / .js を
    そのページの位置から解決し、ファイルが実在するか確かめる。
    en/about.html の `common.css` は /en/common.css に解決して不在 → 検知。

    ルート直下のページが `common.css` と書くのはサイトの既定で、
    /common.css に正しく解決するため問題にしない。

  【検査2】/en/ へ手でコピーされるページの相対パス
    ルート直下のページのうち LP/en/ に同名の複製があるものは、
    相対パスで書いた瞬間にコピー先で壊れる。実在検査は原本側を
    通してしまうので、**原本の側で**禁止する。

    ただし5ハブ（index/festivals/artists/venues/news）は
    build-detail-pages.mjs の enHubFromJa が生成時に絶対パスへ
    書き換えるため対象外。残る about.html / submit.html は
    **手でコピーされたきり再生成されない**ので、ここで止める。
    ABOUT が3日間壊れたまま公開されていたのは、まさにこれが理由。

使い方:
  python3 scripts/check_asset_paths.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"

ASSET = re.compile(r'(?:href|src)="([^"]*\.(?:css|js)(?:\?[^"]*)?)"')

# enHubFromJa が生成時に絶対パスへ書き換えるページ。
# build-detail-pages.mjs の HUBS と揃えること。
GENERATED_HUBS = {
    "index.html", "festivals.html", "artists.html", "venues.html", "news.html",
}


def is_local(url):
    return not re.match(r"^(https?:)?//|^data:|^#", url)


def main():
    missing = []   # 検査1: 解決先が実在しない
    fragile = []   # 検査2: /en/ に複製があるのに相対パス
    checked = 0

    en_twins = {p.name for p in (LP / "en").glob("*.html")} if (LP / "en").is_dir() else set()

    for f in sorted(LP.rglob("*.html")):
        rel = f.relative_to(LP)
        if rel.parts and rel.parts[0] == "vendor":
            continue
        checked += 1
        html = f.read_text(encoding="utf-8", errors="replace")
        at_root = len(rel.parts) == 1

        for m in ASSET.finditer(html):
            url = m.group(1)
            if not is_local(url):
                continue
            path = url.split("?")[0].split("#")[0]
            if not path:
                continue

            # 検査1: そのページの位置から解決して実在するか
            target = (LP / path.lstrip("/")) if path.startswith("/") else (f.parent / path)
            if not target.exists():
                missing.append((str(rel), url, str(target.relative_to(ROOT))))

            # 検査2: /en/ に手でコピーされる原本が相対パスを持っていないか
            if (at_root and rel.name in en_twins
                    and rel.name not in GENERATED_HUBS
                    and not path.startswith("/")):
                fragile.append((str(rel), url))

    bad = False

    if missing:
        bad = True
        print("=" * 64)
        print("参照先の CSS / JS が実在しません（404 になります）:")
        for rel, url, target in missing[:20]:
            print(f'  ✗ {rel}  →  "{url}"  （{target} が無い）')
        if len(missing) > 20:
            print(f"  … ほか {len(missing) - 20}件")
        print()

    if fragile:
        bad = True
        print("=" * 64)
        print("/en/ に複製があるページが、CSS / JS を相対パスで参照しています:")
        for rel, url in fragile[:20]:
            print(f'  ✗ {rel}  →  "{url}"   （en/{rel} 側で /en/{url} を探して 404）')
        if len(fragile) > 20:
            print(f"  … ほか {len(fragile) - 20}件")
        print()
        print("  先頭に / を付けて絶対パスにしてください。")
        print()

    if bad:
        print("  2026-08-14、英語版 ABOUT が CSS も JS も無い素の HTML で")
        print("  公開されていました（AUDIT §9-82）。")
        print("  日本語版は正常に見えるため、日本語だけ見ても気づけません。")
        sys.exit(1)

    print(f"✅ {checked}ページとも CSS / JS の参照先が実在します")
    print(f"   （うち /en/ 複製あり {len(en_twins)}枚は絶対パスであることも確認）")


if __name__ == "__main__":
    main()
