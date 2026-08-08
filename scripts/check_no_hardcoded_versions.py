#!/usr/bin/env python3
"""生成スクリプトに ?v の数字がべた書きされていないかを見る。

■ なぜ必要か

  2026-08-07〜08 のデプロイ失敗6件のうち**3件が同じ原因**だった。

  `build-detail-pages.mjs` が `article-fx.css?v=1` のように版を文字列で
  埋めていたため、article-fx を編集して HTML の ?v を手で上げても、
  **次のビルドで元に戻る。** 直したつもりが直らず、同じ失敗を繰り返した。

  検査（check_asset_versions.py）は毎回正しく落としていた。
  問題は「落ちる場所（HTML の ?v）」と「直すべき場所（生成側の定数）」が
  ずれていて、原因に辿り着けなかったこと。

  **べた書きそのものを禁止する。** 定数にしておけば、
  1箇所直せば全ページに反映され、ビルドで戻ることもない。AUDIT §9-58。

■ 何を見るか

  生成スクリプトの中で、`?v=<数字>` が**文字列リテラルとして**
  href / src に書かれていないか。定数展開（`?v=${...}`）は対象外。

使い方:
  python3 scripts/check_no_hardcoded_versions.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 生成物（HTML）を書き出すスクリプト。ここに版をべた書きすると
# 手で直しても next build で戻る。
GENERATORS = [
    "scripts/build-detail-pages.mjs",
]

# href="/xxx.js?v=3" / src='/xxx.css?v=12' のような固定版。
HARDCODED = re.compile(r"""(?:href|src)=["'][^"']*\.(?:js|css)\?v=\d+""")


def strip_comments(text):
    """コメントを潰す。説明文に例を書けなくなるのを避ける（§9-44 と同じ理由）。"""
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    text = re.sub(r"/\*[\s\S]*?\*/", blank, text)
    text = re.sub(r"(?m)^\s*//.*$", blank, text)
    return text


def main():
    failures = []
    for rel in GENERATORS:
        f = ROOT / rel
        if not f.exists():
            continue
        body = strip_comments(f.read_text(encoding="utf-8"))
        for i, line in enumerate(body.splitlines(), 1):
            for m in HARDCODED.finditer(line):
                failures.append(f"{rel}:{i}  {m.group(0)}")

    if failures:
        print("=" * 60)
        print("生成スクリプトに ?v がべた書きされています:")
        for f in failures:
            print(f"  ✗ {f}")
        print()
        print("  定数にしてください。例:")
        print("    const COMMON_JS_VERSION = 3;")
        print('    `<script src="/common.js?v=${COMMON_JS_VERSION}">`')
        print()
        print("  べた書きのままだと、HTML の ?v を手で上げても")
        print("  次のビルドで戻り、同じデプロイ失敗を繰り返します（AUDIT §9-58）。")
        sys.exit(1)

    print(f"✅ 生成スクリプト {len(GENERATORS)}件に ?v のべた書きはありません")


if __name__ == "__main__":
    main()
