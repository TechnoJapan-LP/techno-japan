#!/usr/bin/env python3
"""変更した JS/CSS の ?v を自動で上げる。

■ なぜ必要か

  sw.js は JS/CSS を cache-first で持つため、中身を変えても参照側の ?v を
  上げないと、一度訪れたブラウザには**永久に新しいファイルが届かない**
  （AUDIT §9-11）。これを検出する check_asset_versions.py はあるが、
  **検出はデプロイが落ちてから**なので、毎回そこで止まる。

  実際 2026-08-07〜08 のデプロイ失敗6件のうち3件が、
  article-fx.js / article-fx.css の ?v 上げ忘れだった。
  「人が覚えておく」ことを前提にした運用が続かなかった。AUDIT §9-58。

  検出する側は残したまま、**上げる作業を手から外す。**

■ 何をするか

  origin/main（または --base で指定したコミット）から中身が変わった
  LP 配下の .js / .css を探し、それを参照している HTML の ?v を +1 する。

  ・参照されている中で**最大の番号 +1** に全参照を揃える。
    ファイルごとに +1 すると番号が割れる（§9-44 E の detail.css）。
  ・?v を持たない参照は触らない（意図的にクエリ無しの箇所がある）。
  ・data.js は対象外。Publish のたびに変わるうえ sw.js 側で
    stale-while-revalidate なので、上げる必要がない（§9-42）。
  ・生成物（image-dimensions.js / image-derivatives.js）は
    それぞれの生成スクリプトが自分で上げるので、ここでは触らない。

使い方:
  python3 scripts/bump_asset_versions.py            # 変更分を自動で上げる
  python3 scripts/bump_asset_versions.py --dry      # 何を上げるか見るだけ
  python3 scripts/bump_asset_versions.py --base HEAD~1
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"

# 自動で上げない資産。
#   data.js               : Publish のたびに変わる。sw.js は SWR なので不要（§9-42）
#   image-dimensions.js   : build-image-dimensions.mjs が自分で上げる（§9-45）
#   image-derivatives.js  : build-image-derivatives.py が自分で上げる
SKIP = {"data.js", "image-dimensions.js", "image-derivatives.js"}


def changed_assets(base):
    """base から中身が変わった LP 配下の .js / .css を返す。"""
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", base, "--", "LP/"],
            cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        print(f"✗ {base} と比較できません。--base で指定し直してください", file=sys.stderr)
        sys.exit(1)
    names = set()
    for line in out.splitlines():
        p = Path(line)
        if p.suffix in (".js", ".css") and p.name not in SKIP:
            names.add(p.name)
    return sorted(names)


def html_files():
    return sorted(LP.rglob("*.html"))


def bump(asset, dry=False):
    """asset を参照している HTML の ?v を、最大値+1 に揃える。"""
    pattern = re.compile(re.escape(asset) + r"\?v=(\d+)")
    hits = []
    current_max = 0
    for f in html_files():
        text = f.read_text(encoding="utf-8")
        found = pattern.findall(text)
        if not found:
            continue
        hits.append(f)
        current_max = max(current_max, *(int(v) for v in found))
    if not hits:
        return None  # ?v 付きで参照されていない（vendor 等）
    nxt = current_max + 1
    if not dry:
        for f in hits:
            text = f.read_text(encoding="utf-8")
            f.write_text(pattern.sub(f"{asset}?v={nxt}", text), encoding="utf-8")
    return (current_max, nxt, len(hits))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="origin/main",
                    help="比較元（既定: origin/main）")
    ap.add_argument("--dry", action="store_true", help="変更せず、対象だけ表示")
    args = ap.parse_args()

    assets = changed_assets(args.base)
    if not assets:
        print(f"✅ {args.base} から変更された JS/CSS はありません")
        return

    print(f"{args.base} から変更された JS/CSS: {len(assets)}件")
    bumped = 0
    for a in assets:
        r = bump(a, dry=args.dry)
        if r is None:
            print(f"  −  {a}（?v 付きの参照が無いので対象外）")
            continue
        cur, nxt, n = r
        mark = "（--dry のため未適用）" if args.dry else ""
        print(f"  ✅ {a}  ?v={cur} → {nxt}（{n} ファイル）{mark}")
        bumped += 1

    if bumped and not args.dry:
        print("\n上げた分をコミットに含めてください。")
        print("確認: python3 scripts/check_asset_versions.py")


if __name__ == "__main__":
    main()
