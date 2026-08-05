#!/usr/bin/env python3
"""サイト内リンクが実在するファイルを指しているかを見る。

■ なぜ必要か

  2026-08-02 に SPA 詳細ビューを廃止した（AUDIT §9-23）とき、
  詳細を描くコードと一緒に「#festival/<id> を解釈する側」も消えた。
  ところが、そこへ飛ばす側は残っていた:

      LP/index.html      フェス行・アーティスト・会場の全カード
      LP/favorites.html  お気に入りカード
      LP/search.js       検索結果の全項目
      LP/app/app.js      ラインナップのアーティスト名

  リンク先は 200 を返す（festivals.html は実在する）ので、
  リンク切れ検査にも、ハブの描画検査にも、SPA/静的の差分検査にも映らない。
  トップから詳細へ行けない状態が4日間気づかれずに続いた（2026-08-06 監査 / §9-44）。

  「404 にならない壊れ方」があるので、404 を探すだけでは足りない。
  消えた受け手に向けたリンク形式そのものを禁止する。

■ 何を見るか

  1. 廃止済みのリンク形式が残っていないか（#festival/ #artist/ #venue/）
     ハブ側に hash を読むコードが1行も無いことが前提。前提が変わったら
     ここも変えること。
  2. HTML の内部リンク（href / src）が実在するファイルを指しているか
     テンプレートリテラル（${...} を含む）は実行時に決まるので対象外。
     それらは scripts/check_hub_pages.py が実際に描画して見る。

使い方:
  python3 scripts/check_internal_links.py
"""

import re
import sys
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"

# 廃止済みの SPA ハッシュ。受け手はどのハブにも無い。
DEAD_HASH = re.compile(r"""(?:festivals|artists|venues|news)\.html\#(?:festival|artist|venue|article)/""")

# 受け手が存在しないことの確認に使う。ハブが hash を読み始めたらここが立つ。
HUBS = ["festivals.html", "artists.html", "venues.html"]

# 実ファイルを見に行く対象。外部・スキーム付き・テンプレートは除く。
LINK_RE = re.compile(r"""(?:href|src)="(/[^"${}]*)\"""")

# 実体を持たない参照。サーバ設定や外部で解決される。
SKIP_PREFIXES = ("/cdn-cgi/",)


def strip_comments(text):
    """コメントを空白に潰す（行番号を保つため改行は残す）。

    この検査自身の説明文に禁止パターンを書くと、それを自分で検出してしまう。
    「なぜ禁止か」を書けないガードは、次に触る人が理由を知らないまま
    パターンを消しにかかる。コメントを外して本文だけを見る。
    """
    def blank(m):
        return re.sub(r"[^\n]", " ", m.group(0))
    text = re.sub(r"<!--[\s\S]*?-->", blank, text)
    text = re.sub(r"/\*[\s\S]*?\*/", blank, text)
    text = re.sub(r"(?m)^\s*//.*$", blank, text)
    return text


def scan_dead_hash():
    hits = []
    for f in sorted(list(LP.rglob("*.html")) + list(LP.rglob("*.js"))):
        if "/node_modules/" in str(f):
            continue
        body = strip_comments(f.read_text(encoding="utf-8"))
        for i, line in enumerate(body.splitlines(), 1):
            if DEAD_HASH.search(line):
                hits.append(f"{f.relative_to(ROOT)}:{i}  {line.strip()[:100]}")
    return hits


def hubs_read_hash():
    """ハブが hash を解釈しているか。している場合は上の禁止が過剰になる。"""
    for name in HUBS:
        p = LP / name
        if p.exists() and "location.hash" in p.read_text(encoding="utf-8"):
            return name
    return None


def scan_broken_links():
    broken = {}
    for f in sorted(LP.rglob("*.html")):
        text = f.read_text(encoding="utf-8")
        for m in LINK_RE.finditer(text):
            raw = m.group(1).split("#")[0].split("?")[0]
            if not raw or raw.startswith(SKIP_PREFIXES):
                continue
            target = LP / unquote(raw).lstrip("/")
            if raw.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                broken.setdefault(str(f.relative_to(ROOT)), set()).add(raw)
    return broken


def main():
    failures = []

    hub = hubs_read_hash()
    if hub:
        print(f"  ⚠ {hub} が location.hash を読んでいる。"
              "SPA 詳細が復活したなら、この検査の前提（AUDIT §9-23）を見直すこと")

    dead = scan_dead_hash()
    if dead:
        failures.append(
            f"廃止済みの SPA ハッシュリンクが {len(dead)}件 残っている:\n      "
            + "\n      ".join(dead[:15])
            + (f"\n      … ほか {len(dead) - 15}件" if len(dead) > 15 else "")
            + "\n      → /festivals/<id>.html のような静的詳細ページを直接指すこと（AUDIT §9-44）"
        )
    else:
        print("  ✅ 廃止済みの SPA ハッシュリンクは無い")

    broken = scan_broken_links()
    if broken:
        n = sum(len(v) for v in broken.values())
        lines = []
        for f, urls in list(broken.items())[:12]:
            lines.append(f"{f}: " + ", ".join(sorted(urls)[:4]))
        failures.append(
            f"実在しないファイルへのリンクが {n}件（{len(broken)}ファイル）:\n      "
            + "\n      ".join(lines)
            + (f"\n      … ほか {len(broken) - 12}ファイル" if len(broken) > 12 else "")
        )
    else:
        total = len(list(LP.rglob("*.html")))
        print(f"  ✅ {total} ページの内部リンクはすべて実在（テンプレート由来は除く）")

    if failures:
        print("\n" + "=" * 60)
        print("サイト内リンクに問題があります:")
        for f in failures:
            print(f"  ✗ {f}")
        sys.exit(1)
    print("\n✅ サイト内リンクは正常")


if __name__ == "__main__":
    main()
