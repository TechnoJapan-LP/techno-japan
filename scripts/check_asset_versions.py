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
  2. 現在の ?v 導入後に JS/CSS だけが変更されていないか
     （Publish と生成物が別コミット・別pushでも検出する）
  3. クエリ無しで参照されている JS/CSS が無いか（更新手段が無い状態）

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

# 「現在の ?v 導入後にアセットが変更されていないか」の検査から除外するもの。
#
# 【除外リストであって対象リストではない】2026-08-03 に一度これを対象リストの
# ままにして空にし、検査全体を無効化する事故を起こした（AUDIT §9-36）。
# localize.js を変更したのに ?v=1 を据え置いたまま push され、Service Worker の
# cache-first で旧版が返り続けて、本番の返却訪問者にだけ修正が届かなかった。
# 差分検査のほうは origin/main と比較するため、merge 後は差分ゼロで素通りする。
# **この検査は全アセットに掛ける。除外は理由を書いて明示的に足すこと。**
#
# 【data.js を除外する理由】2026-08-03 に一度対象へ入れて外した。
#
#   data.js は CMS の Publish Now が単独で自動commitするため、?v の更新は
#   構造的に必ず後追いになる。同日に3回、Publish のたびにこの検査が落ちた。
#   運用を厳しくしても消えない、CMS の設計に内在する順序制約である。
#
#   そもそも data.js は ?v で鮮度を管理していない。sw.js は data.js を
#   stale-while-revalidate に置いており、その理由が sw.js のコメントと
#   AUDIT §9-18 に「?v 運用が効かないから」と明記されている。
#   ここで ?v を強制するのは、その決定と正面から矛盾する。
#
#   cache-first に落ちる事故（§9-18 の実害）に対する保険は、
#   scripts/check_sw_routing.mjs の MUST_NOT_BE_CACHE_FIRST が
#   sw.js を実際に実行して守っている。?v は二重の保険で、
#   しかも維持できないほうだった。
#
#   代償: Publish 直後の初回表示だけ古い（SWR なので次の遷移で新しくなる）。
#   経緯は AUDIT §9-30（導入）と §9-32（撤回）。
VERSION_CHECK_EXEMPT = {"data.js"}


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True,
                          cwd=ROOT).stdout


def git_ok(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True,
                          cwd=ROOT).returncode == 0


def latest_commit(path, pickaxe=None):
    args = ["log", "-1", "--format=%H"]
    if pickaxe:
        args.extend(["-G", pickaxe])
    args.extend(["--", path])
    return git(*args).strip()


def latest_matching_commits(paths, pickaxe):
    """Return each path's latest commit matching pickaxe, with one git walk."""
    output = git("log", "--format=@@%H", "--name-only", "-G", pickaxe,
                 "--", *paths)
    result = {}
    commit = None
    for line in output.splitlines():
        if line.startswith("@@"):
            commit = line[2:]
        elif commit and line in paths and line not in result:
            result[line] = commit
    return result


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

    # ---- (3) クエリ無しの参照 ----
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

    # ---- (1) 指定範囲で変更されたのに ?v が据え置き ----
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
                if asset in VERSION_CHECK_EXEMPT:
                    print(f"  −  {asset}（キャッシュバスティング検査から除外）")
                    continue
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

    # ---- (2) 現在の ?v 導入後にアセットだけが変更されていないか ----
    # push の before..HEAD だけでは、Publish commit と生成物 commit が別pushに
    # 分かれた場合に変更の組み合わせを見失う。各アセットの最終変更と、参照元で
    # 現在のバージョン表記を導入した最終commitを比較し、更新漏れを持続的に検出する。
    print("\n=== 現在の ?v 導入後に変更されたアセット ===")
    stale_history = []
    for asset in sorted(set(refs) - VERSION_CHECK_EXEMPT):
        users = refs.get(asset, {})
        if not users:
            continue
        versions = {v for v in users.values() if v}
        if len(versions) != 1:
            continue
        asset_path = f"LP/{asset}"
        asset_commit = latest_commit(asset_path)
        if not asset_commit:
            continue
        pattern = rf"{re.escape(asset)}\?v={next(iter(versions))}"
        version_commits_by_path = latest_matching_commits(list(users), pattern)
        version_commits = list(version_commits_by_path.values())
        if not version_commits:
            continue
        # 全参照元が現在の版へ更新された後にアセット変更が無ければ安全。
        if all(git_ok("merge-base", "--is-ancestor", asset_commit, c)
               for c in version_commits):
            continue
        # 作業ツリーで同じ参照を更新中なら、上の差分検査が内容を検証する。
        if any(re.search(rf"^\+.*{pattern}", git("diff", "--", path), re.M)
               for path in users):
            continue
        stale_history.append(asset)
        print(f"  ❌ {asset}: アセット最終変更が ?v={next(iter(versions))} 導入後")
        failures.append(
            f"{asset} は現在の ?v={next(iter(versions))} を導入した後に変更されている。"
            "コミットやpushが分かれていても参照元の ?v を上げること"
        )
    if not stale_history:
        print("  ✅ なし")

    # ---- バージョンの不一致（同じアセットに複数のバージョン）----
    #
    # 【混在が正しい場合がある。揃える前に必ず理由を確認すること】
    #
    # detail.css の v=3/4 は意図的な分割で、揃えてはいけない。
    #   1932e50「Redesign all festival detail pages」で detail.css に 259行を
    #   追加したが、全て .festival-design-v2 / .festival-detail-hero 配下の
    #   純粋な追加で、既存ルールの変更・削除は 0 行だった（実測）。
    #   そのためフェス詳細178ページだけ v=4 に上げ、新ルールを使わない
    #   アーティスト・会場・記事の264ページは v=3 に据え置いた。
    #   ここを揃えて v=4 にすると、264ページ分の CSS キャッシュを
    #   何の内容変更も無いまま捨てることになる。
    #
    # この警告は「混在している」という事実を報告するだけで、
    # 「揃えるべき」という指示ではない。判断の材料は
    # 「その版で増えた規則を、据え置き側のページが使うか」。
    # 使わないなら据え置きが正しい。経緯は AUDIT §9-35。
    print("\n=== 同一アセットに複数バージョンが混在していないか ===")
    mixed = {a: sorted({v for v in fs.values() if v})
             for a, fs in refs.items()}
    mixed = {a: v for a, v in mixed.items() if len(v) > 1}
    if mixed:
        for a, v in sorted(mixed.items()):
            print(f"  ⚠️  {a}: v={'/'.join(v)}（意図的な分割かを確認すること）")
            warnings.append(f"{a} が複数バージョンで参照されている（v={'/'.join(v)}）")
    else:
        print("  ✅ なし")

    # ---- 生成側の定数と、HTML べた書きのずれ ----
    #
    # 上の「混在」は意図的な場合があるので警告どまりにしてある。
    # だが **同じアセットの版が2箇所で管理されている** 場合は話が別で、
    # ずれは必ず事故になる。片方を上げたつもりでもう片方に届かない。
    #
    # build-detail-pages.mjs が定数で持っているアセット
    # （COMMON_CSS_VERSION 等）は、その定数が唯一の正解。
    # ハブ等の HTML にべた書きされた同じアセットの版が食い違っていたら止める。
    #
    # 2026-08-14 に2回続けて踏んだ:
    #   common.css  詳細436枚 v5 / ハブ16枚 v6  （§9-85 で発見・統一）
    #   common.js   詳細436枚 v3 / ハブ16枚 v4  （§9-88 で統一）
    # どちらも「HTML を直したが生成側の定数を忘れた」形。
    # detail.css のような定数を持たないアセットは対象外なので、
    # §9-35 の意図的な分割は壊さない。
    print("\n=== 生成側の定数と HTML の版が一致しているか ===")
    build_src = (ROOT / "scripts" / "build-detail-pages.mjs").read_text(encoding="utf-8")
    CONST_ASSETS = {
        "COMMON_CSS_VERSION": "common.css",
        "COMMON_JS_VERSION": "common.js",
        "LANG_TOGGLE_VERSION": "lang-toggle.js",
        "ARTICLE_FX_CSS_VERSION": "article-fx.css",
        "ARTICLE_FX_JS_VERSION": "article-fx.js",
    }
    drift = False
    for const, asset in CONST_ASSETS.items():
        m = re.search(rf"const {const}\s*=\s*(\d+)", build_src)
        if not m:
            continue
        want = m.group(1)
        found = sorted({v for v in refs.get(asset, {}).values() if v})
        if not found:
            continue
        off = [v for v in found if v != want]
        if off:
            print(f"  ❌ {asset}: 生成側 {const}={want} なのに HTML は v={'/'.join(off)}")
            failures.append(
                f"{asset} の版が2箇所でずれている（{const}={want} / HTML v={'/'.join(off)}）。"
                f"生成側の定数を唯一の正解として揃えること"
            )
            drift = True
        else:
            print(f"  ✅ {asset}: 生成側 {const}={want} と HTML が一致")
    if not drift:
        pass

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
