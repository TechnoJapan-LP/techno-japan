#!/usr/bin/env python3
"""
アセットのキャッシュバスティング検査。

なぜ必要か:
  sw.js は JS/CSS を cache-first で扱い、「ファイル名かクエリでバージョン管理
  している」ことを前提にしている。キャッシュキーはクエリ込みの完全URL なので、
  ?v を据え置いたまま中身だけ変えると、一度取得したブラウザは永久に旧版を使う。

  実際に cms.js は ?v=25 のまま 26回変更され、7月13日以降の CMS 改修が
  既存ブラウザに届いていなかった。本番のファイルは正しく配信されていたため、
  サーバを見ても気づけない。

検査内容:
  1. 変更された JS/CSS を検出し、それを参照する HTML の ?v が
     同じ差分の中で更新されているか
  2. クエリ無しで参照されている JS/CSS が無いか（更新手段が無い状態）

使い方:
  python3 scripts/check_asset_versions.py                 # HEAD と origin/main を比較
  python3 scripts/check_asset_versions.py --base <ref>    # 比較対象を指定
  python3 scripts/check_asset_versions.py --no-diff       # (2) だけ実行
"""

import argparse
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"

# 生成物のテンプレート側。ここを直さないと次のビルドで巻き戻る。
GENERATOR = ROOT / "scripts" / "build-detail-pages.mjs"

REF_RE = re.compile(
    r'(?:src|href)="(/?(?:[a-z0-9.-]+/)*([a-z0-9.-]+\.(?:js|css)))(\?v=(\d+))?"'
)


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True,
                          cwd=ROOT).stdout


def html_files():
    for p in LP.rglob("*.html"):
        if "/app/" in str(p):
            continue
        yield p


def scan():
    """アセット -> {参照しているHTML: バージョン or None}"""
    refs = defaultdict(dict)
    for p in list(html_files()) + [GENERATOR]:
        text = p.read_text(encoding="utf-8", errors="replace")
        for m in REF_RE.finditer(text):
            url, base, _, ver = m.groups()
            if url.startswith("http"):
                continue
            if not (LP / url.lstrip("/")).exists():
                continue          # 外部/存在しない参照は対象外
            refs[base][str(p.relative_to(ROOT))] = ver
    return refs


def external_cms_scripts():
    """CMS に外部オリジンの実行可能スクリプトが再導入されていないか。"""
    cms = (LP / "cms.html").read_text(encoding="utf-8", errors="replace")
    return re.findall(
        r'<script\b[^>]*\bsrc=["\']((?:https?:)?//[^"\']+)["\']', cms,
        flags=re.IGNORECASE,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="origin/main", help="比較対象の ref")
    ap.add_argument("--no-diff", action="store_true", help="差分検査をスキップ")
    args = ap.parse_args()

    refs = scan()
    failures, warnings = [], []

    # CMS は同一オリジンの localStorage に認証トークンを保持する。外部JSは
    # 同じページ権限で実行されるため、CDN依存の再導入を明示的に禁止する。
    print("=== CMS の外部 JavaScript 参照 ===")
    cms_external = external_cms_scripts()
    if cms_external:
        for url in cms_external:
            print(f"  ❌ {url}")
        failures.append(
            f"LP/cms.html に外部 JavaScript が {len(cms_external)}件ある。"
            "CMS の実行スクリプトは同一オリジンから配信すること"
        )
    else:
        print("  ✅ なし")

    # ---- (2) クエリ無しの参照 ----
    print("=== クエリ無しで参照されているアセット ===")
    unversioned = {a: [f for f, v in fs.items() if v is None] for a, fs in refs.items()}
    unversioned = {a: fs for a, fs in unversioned.items() if fs}
    if unversioned:
        for a, fs in sorted(unversioned.items()):
            print(f"  ❌ {a}: {len(fs)}ページ  例) {fs[0]}")
            failures.append(
                f"{a} が {len(fs)}ページでクエリ無しで参照されている"
                "（更新手段が無く、変更しても既存ブラウザに永久に届かない）"
            )
    else:
        print("  ✅ なし")

    # ---- (1) 変更されたのに ?v が据え置き ----
    if not args.no_diff:
        base = args.base
        if not git("rev-parse", "--verify", "--quiet", base).strip():
            print(f"\n⚠️  {base} が解決できないため差分検査をスキップ")
            base = None
        if base:
            # merge-base から「作業ツリー」までを見る。CI では HEAD == 作業ツリーなので
            # base...HEAD と同じだが、ローカルではコミット前の変更も検査できる。
            mb = git("merge-base", base, "HEAD").strip() or base
            changed = [l for l in git("diff", "--name-only", mb).splitlines()
                       if re.search(r"\.(js|css)$", l) and l.startswith("LP/")]
            print(f"\n=== {base} からの変更 JS/CSS: {len(changed)}件 ===")
            for path in changed:
                asset = os.path.basename(path)
                if asset == "sw.js":
                    continue      # SW 自身は VERSION 定数で管理
                users = refs.get(asset)
                if not users:
                    print(f"  −  {asset}（どのHTMLからも参照されていない）")
                    continue
                # 同じ差分の中で ?v が動いたか
                bumped = False
                for f in users:
                    d = git("diff", mb, "--", f)
                    if re.search(rf"^\+.*{re.escape(asset)}\?v=", d, re.M):
                        bumped = True
                        break
                if bumped:
                    vers = sorted({v for v in users.values() if v})
                    print(f"  ✅ {asset}  → ?v={'/'.join(vers)} に更新済み")
                else:
                    vers = sorted({str(v) for v in users.values()})
                    print(f"  ❌ {asset}  → ?v={'/'.join(vers)} のまま（{len(users)}参照）")
                    failures.append(
                        f"{asset} を変更したが ?v が据え置き。"
                        f"参照元（{list(users)[0]} 等 {len(users)}箇所）の ?v を上げること"
                    )

    # ---- バージョンの不一致（同じアセットに複数のバージョン）----
    print("\n=== 同一アセットに複数バージョンが混在していないか ===")
    mixed = {a: sorted({v for v in fs.values() if v})
             for a, fs in refs.items()}
    mixed = {a: v for a, v in mixed.items() if len(v) > 1}
    if mixed:
        for a, v in sorted(mixed.items()):
            print(f"  ⚠️  {a}: v={'/'.join(v)}")
            warnings.append(f"{a} が複数バージョンで参照されている（v={'/'.join(v)}）")
    else:
        print("  ✅ なし")

    if warnings:
        print("\n警告:")
        for w in warnings:
            print(f"  ⚠️  {w}")
    if failures:
        print("\n" + "=" * 60)
        print("キャッシュバスティングに問題があります:")
        for f in failures:
            print(f"  ✗ {f}")
        print("""
JS/CSS を変更したら、参照している HTML の ?v を必ず上げてください。
sw.js は JS/CSS を cache-first で扱うため、?v が同じままだと
一度取得したブラウザには永久に届きません。
詳細は AUDIT_TECHNO_JAPAN.md §9-11。""")
        return 1

    print("\n✅ キャッシュバスティングは正常")
    return 0


if __name__ == "__main__":
    sys.exit(main())
