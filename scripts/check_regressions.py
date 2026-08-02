#!/usr/bin/env python3
"""
生成物の回帰ガード — .github/regression-thresholds.yml の閾値を検査する。

なぜ必要か:
  948a440 で Festival.performer 約130件・LINE UP 10ページ・出演フェス 94ページが
  誰にも気づかれずに本番へデプロイされた。ローカルの diff で検出可能だったが、
  実行されなかった。人手の手順に依存せず機械的に止めるためのガード。

検査方針:
  「ページ数は増えても減らない」という単調性のみを見る。
    min あり → 実測がそれを下回ったら fail
    max あり → 実測がそれを上回ったら fail（broken_image_refs 等、増加が回帰の指標）
  意図的な減少は閾値ファイルを更新してコミットする運用（サイレントな引き下げ防止）。

使い方:
  node scripts/build-detail-pages.mjs   # 先に生成物を作る
  python3 scripts/check_regressions.py  # 検査
  python3 scripts/check_regressions.py --update   # 実測値で min を書き換える（手動運用用）
"""

import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML が必要です: python3 -m pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"
THRESHOLDS = ROOT / ".github" / "regression-thresholds.yml"

# fetch-data.mjs:107 と同一。DATA_SCHEMA §1.1 の slug 規約。
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

SCRIPT_RE = re.compile(r"<script\b.*?</script>", re.S)
LDJSON_RE = re.compile(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', re.S)


def read(p):
    return p.read_text(encoding="utf-8", errors="replace")


def body_without_scripts(html):
    """<script> を除いた本文。JS非実行クローラーが見る範囲に相当する。"""
    return SCRIPT_RE.sub("", html)


def ld_objects(html):
    out = []
    for block in LDJSON_RE.findall(html):
        try:
            d = json.loads(block)
        except json.JSONDecodeError:
            continue
        out.extend(d if isinstance(d, list) else [d])
    return out


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def has_h2(body, label):
    return re.search(r"<h2[^>]*>\s*" + re.escape(label), body) is not None


def has_class(body, class_name):
    """class 属性を空白区切りのトークンとして厳密に判定する。"""
    return any(class_name in value.split() for value in re.findall(r'class="([^"]*)"', body))


def is_redirect_stub(html):
    """build-detail-pages.mjs の REDIRECTS が出す旧URL維持用スタブか。"""
    return "<title>Redirecting…</title>" in html and 'http-equiv="refresh"' in html


def measure():
    """全メトリクスを実測して dict で返す。"""
    m = {}

    fest = sorted((LP / "festivals").glob("*.html"))
    fest_all = fest + sorted((LP / "en" / "festivals").glob("*.html"))
    artists_ja = sorted((LP / "artists").glob("*.html"))
    artists_all = artists_ja + sorted((LP / "en" / "artists").glob("*.html"))

    perf_pages = perf_total = lineup_pages = subevent_pages = links_to_artists = 0
    for f in fest:
        html = read(f)
        body = body_without_scripts(html)
        if has_h2(body, "LINE UP"):
            lineup_pages += 1
        links_to_artists += len(re.findall(r'href="/?artists/[^"]*"', body))
        performers, subevents = [], []
        for d in ld_objects(html):
            if d.get("@type") == "Festival":
                performers += as_list(d.get("performer"))
                subevents += as_list(d.get("subEvent"))
        if performers:
            perf_pages += 1
            perf_total += len(performers)
        if subevents:
            subevent_pages += 1

    app_pages = links_to_fests = 0
    for f in artists_ja:
        body = body_without_scripts(read(f))
        if has_h2(body, "出演フェス"):
            app_pages += 1
        links_to_fests += len(re.findall(r'href="/?festivals/[^"]*"', body))

    entity_id_pages = sum(
        1 for f in artists_all
        if any(str(d.get("@id", "")).endswith("#artist") for d in ld_objects(read(f)))
    )

    # FAQ と要約文（JA/EN 両方）。
    # ページ数だけだと 1ページの Q&A が減っても検出できないため、
    # 設問の総数も別メトリクスとして持つ。
    faq_ld_pages = faq_section_pages = faq_qa_total = summary_pages = 0
    official_link_pages = social_link_pages = 0
    for f in fest_all:
        html = read(f)
        faqs = [d for d in ld_objects(html) if d.get("@type") == "FAQPage"]
        if faqs:
            faq_ld_pages += 1
            faq_qa_total += sum(len(as_list(d.get("mainEntity"))) for d in faqs)
        body = body_without_scripts(html)
        if re.search(r'class="(?:[^"]*\s)?festival-faq(?=[\s"])', body):
            faq_section_pages += 1
        # 旧デザインは自動要約、V2は編集済みDESCをヒーローへ置く。
        # どちらでも「冒頭に可視の説明がある」ことを同じラチェットで守る。
        if (has_class(body, "festival-summary")
                or has_class(body, "festival-description-inline")):
            summary_pages += 1
        if has_class(body, "festival-official-link"):
            official_link_pages += 1
        if has_class(body, "festival-social-link"):
            social_link_pages += 1

    # 掲載申請ページへの導線。全ページのフッターに張っているので、
    # テンプレート変更で静かに消えると気づけない。
    submit_link_pages = sum(
        1 for f in LP.rglob("*.html")
        if "/app/" not in str(f)
        and re.search(r'href="(?:https://techno-japan\.media)?/(?:en/)?submit\.html"', read(f))
    )
    m["submit_link_pages"] = submit_link_pages

    # EN ハブから JA 詳細への漏れ。機械生成なので置換漏れが起きうる。
    leaks = 0
    for name in ("index", "festivals", "artists", "venues", "news"):
        f = LP / "en" / f"{name}.html"
        if f.exists():
            leaks += len(re.findall(
                r'href="/(?:festivals|artists|venues|articles)/', read(f)))
    m["en_hub_leaks_to_ja"] = leaks

    hub_names = ["index.html", "festivals.html", "artists.html", "venues.html", "news.html", "about.html"]

    # 言語トグル。「存在する」だけでなく「相手言語へ正しくリンクしている」まで見る。
    #
    # 判定に正規表現を使わない理由: nav-lang の中身は JA/EN で非対称で、
    # JA は <a>EN</a></span>、EN は <span>EN</span></span> で終わる。
    # `<span class="nav-lang">(.*?)</span></span>` のような書き方だと JA 側だけ
    # マッチせず「トグルが無い」と誤検出する（実際に一度そう報告してしまった）。
    # 生成側が出す固定文字列をそのまま探すのが確実。
    toggle_ok = 0
    for name in hub_names:
        for d, lang in ((LP, "ja"), (LP / "en", "en")):
            f = d / name
            if not f.exists():
                continue
            html = read(f)
            cur = "JA" if lang == "ja" else "EN"
            other_lang = "EN" if lang == "ja" else "JA"
            other_href = f"/en/{name}" if lang == "ja" else f"/{name}"
            if (f'<span class="nav-lang-cur">{cur}</span>' in html
                    and f'href="{other_href}">{other_lang}</a>' in html):
                toggle_ok += 1
    m["hub_language_toggles"] = toggle_ok

    # hreflang を持つハブ（ディレクトリ直下のみ。詳細ページは元から持っている）
    m["hreflang_hub_pages"] = sum(
        1 for d in (LP, LP / "en") for n in hub_names
        if (d / n).exists() and "hreflang" in read(d / n)
    )

    m["festival_faq_pages"] = faq_ld_pages
    m["festival_faq_section_pages"] = faq_section_pages
    m["festival_faq_qa_total"] = faq_qa_total
    m["festival_summary_pages"] = summary_pages
    m["festival_official_link_pages"] = official_link_pages
    m["festival_social_link_pages"] = social_link_pages

    m["festival_performer_pages"] = perf_pages
    m["festival_performer_total"] = perf_total
    m["lineup_section_pages"] = lineup_pages
    m["artist_appearances_pages"] = app_pages
    m["internal_links_to_artists"] = links_to_artists
    m["internal_links_to_festivals"] = links_to_fests
    m["festival_subevent_pages"] = subevent_pages
    m["artist_entity_id_pages"] = entity_id_pages

    # 参照先が存在しない画像。生成物の全 HTML から /images/ 参照を集めて実体を確認する。
    missing = set()
    for f in LP.rglob("*.html"):
        html = read(f)
        for ref in re.findall(r'(?:src|content|")(?:https://techno-japan\.media)?(/images/[^"\']+)', html):
            if not (LP / ref.lstrip("/")).exists():
                missing.add(ref)
    m["broken_image_refs"] = len(missing)
    m["_broken_image_list"] = sorted(missing)

    # LINEUP のうちアーティスト詳細へリンクされている件数。
    #
    # 当初は逆に「未解決の件数」を上限つきで見ていたが、
    # 「Techno Japan として扱いたいアーティストのみ登録する」方針が決まり、
    # 未登録は欠落ではなく編集判断になった。未解決が増えること自体は正常。
    #
    # 守りたいのは「いま張れているリンクが壊れて減らないこと」。
    # ID の付け替えやアーティスト削除で既存のリンクが切れたら検出する。
    lineups_path = LP / "data" / "lineups.json"
    linked = 0
    if lineups_path.exists():
        doc = json.loads(read(lineups_path))
        rows = doc.get("items", doc) if isinstance(doc, dict) else doc
        linked = sum(
            1 for r in rows
            if isinstance(r, dict) and str(r.get("ARTIST_ID") or "").strip()
        )
    m["lineup_linked_acts"] = linked

    # ID 規約違反。詳細ページのファイル名 = ID なので、そこから判定する。
    # data.js は CMS の Publish Now が生成し fetch-data.mjs の検証を通らないため、
    # ここが実質唯一の自動チェックポイントになる（DATA_SCHEMA §1.1）。
    #
    # ID を是正した場合、旧URL維持のためのリダイレクトスタブが旧ID名のファイルとして
    # 残る（build-detail-pages.mjs の REDIRECTS）。これは意図的な残骸なので除外する。
    # 除外しないと violations が永久に減らず、max を 0 に下げられない。
    bad_ids = sorted(
        f.stem for f in artists_ja
        if not ID_RE.match(f.stem) and not is_redirect_stub(read(f))
    )
    m["artist_id_violations"] = len(bad_ids)
    m["_artist_id_violation_list"] = bad_ids

    return m


def main():
    conf = yaml.safe_load(THRESHOLDS.read_text(encoding="utf-8"))
    metrics = conf["metrics"]
    actual = measure()

    if "--update" in sys.argv:
        raw = THRESHOLDS.read_text(encoding="utf-8")
        for name, spec in metrics.items():
            if spec.get("min") is None or name not in actual:
                continue
            raw = re.sub(
                rf"(^  {re.escape(name)}:\n(?:.*\n)*?    min: )\S+",
                lambda mo: mo.group(1) + str(actual[name]),
                raw, count=1, flags=re.M,
            )
        THRESHOLDS.write_text(raw, encoding="utf-8")
        print(f"更新しました: {THRESHOLDS.relative_to(ROOT)}")
        return 0

    failures, rows = [], []
    for name, spec in metrics.items():
        if name not in actual:
            failures.append(f"{name}: 計測されていない（スクリプトと閾値ファイルが不整合）")
            continue
        got = actual[name]
        lo, hi = spec.get("min"), spec.get("max")
        status = "ok"
        if hi is not None and got > hi:
            status = "FAIL"
            failures.append(f"{name}: {got} > max {hi}（増加は回帰）")
        elif lo is not None and got < lo:
            status = "FAIL"
            failures.append(f"{name}: {got} < min {lo}（{lo - got} 件の減少）")
        rows.append((name, got, lo, hi, spec.get("target"), status))

    w = max(len(r[0]) for r in rows)
    print(f"閾値: {THRESHOLDS.relative_to(ROOT)}  baseline={conf.get('baseline_commit')}\n")
    print(f"{'メトリクス'.ljust(w)}  {'実測':>6} {'min':>6} {'max':>5} {'target':>7}  判定")
    print("-" * (w + 40))
    for name, got, lo, hi, tg, status in rows:
        mark = "✅" if status == "ok" else "❌"
        print(f"{name.ljust(w)}  {got:>6} {str(lo):>6} {str(hi):>5} {str(tg):>7}  {mark}")

    if actual["_broken_image_list"]:
        print("\n参照先が存在しない画像:")
        for p in actual["_broken_image_list"]:
            print(f"  - {p}")
    if actual["_artist_id_violation_list"]:
        print("\nID 規約違反（DATA_SCHEMA §1.1）:")
        for i in actual["_artist_id_violation_list"]:
            print(f"  - {i}")

    if failures:
        print("\n" + "=" * 60)
        print("回帰を検出しました:")
        for f in failures:
            print(f"  ✗ {f}")
        print("""
意図した変更であれば .github/regression-thresholds.yml の該当値を更新し、
note に理由を書いてコミットしてください（サイレントな引き下げを防ぐため）。
実測値で一括更新: python3 scripts/check_regressions.py --update""")
        return 1

    print("\n✅ 回帰なし")
    return 0


if __name__ == "__main__":
    sys.exit(main())
