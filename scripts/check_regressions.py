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
from urllib.parse import unquote
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

# EN ページに残る日本語を数えるための文字クラス。
# ひらがな・カタカナ・CJK統合漢字・長音記号・々 のみ。
# — や · は英文でも正当に使うので含めない。
JA_RE = re.compile(r"[ぁ-ゟ゠-ヿ㐀-鿿ー々]")
ASCII_RE = re.compile(r"^[\x00-\x7F]*$")

# 静的リンクブロック。START の名前を \1 で受けて対応する END までを取る。
# 名前を照合しない `.*?` は、ブロックが増えたときに別ブロックの END で
# 切れる／跨ぐ余地を残す（§9-16 の「閉じの並びを境界にしない」と同じ理由）。
STATIC_LINKS_RE = re.compile(
    r"<!-- STATIC_LINKS:(\w+):START -->(.*?)<!-- STATIC_LINKS:\1:END -->", re.S
)

# EN ページの JSON-LD で日本語が「正しい値」になるキー。
# alternateName は別名なので、英語ページでも日本語のブランド表記を持つのが正しい
# （en/index.html の "テクノジャパン"）。ここを込みで 0 を目指すと、
# 正しい構造化データを消す方向に圧力がかかる。
JSONLD_JA_ALLOWED_KEYS = {"alternateName"}


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


def ja_chars(s):
    return len(JA_RE.findall(str(s)))


def jsonld_ja_chars(objs):
    """JSON-LD の文字列値に含まれる日本語文字数。

    生ブロックを正規表現で走査せず、パース済みオブジェクトを辿る。
    キーごとに扱いを変える必要がある（JSONLD_JA_ALLOWED_KEYS）ため、
    文字列としての走査では判定できない。
    """
    total = 0

    def walk(node, key=None):
        nonlocal total
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, k)
        elif isinstance(node, list):
            for v in node:
                walk(v, key)   # 配列は親のキーを引き継ぐ
        elif isinstance(node, str) and key not in JSONLD_JA_ALLOWED_KEYS:
            total += ja_chars(node)

    for o in objs:
        walk(o)
    return total


def has_h2(body, label):
    return re.search(r"<h2[^>]*>\s*" + re.escape(label), body) is not None


def has_class(body, class_name):
    """class 属性を空白区切りのトークンとして厳密に判定する。"""
    return any(class_name in value.split() for value in re.findall(r'class="([^"]*)"', body))


def is_redirect_stub(html):
    """build-detail-pages.mjs の REDIRECTS が出す旧URL維持用スタブか。"""
    return "<title>Redirecting…</title>" in html and 'http-equiv="refresh"' in html


def article_page_is_public(path):
    """記事ページが存在し、noindex のリダイレクトスタブではないか。"""
    if not path.exists():
        return False
    return '<meta name="robots" content="noindex">' not in read(path)


def location_language_inversions():
    """LOCATION に日本語、location_ja にASCIIのみが入る反転を検出する。"""
    path = LP / "data" / "festivals.json"
    if not path.exists():
        return []
    doc = json.loads(read(path))
    rows = doc.get("items", doc) if isinstance(doc, dict) else doc
    issues = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        location = str(row.get("LOCATION", row.get("location", "")) or "").strip()
        location_ja = str(row.get("LOCATION_JA", row.get("location_ja", "")) or "").strip()
        # location_ja 空欄はフォールバックとして正常。両欄ASCIIも正常（WOMB等）。
        if location and location_ja and JA_RE.search(location) and ASCII_RE.fullmatch(location_ja):
            issues.append({"id": str(row.get("ID", row.get("id", "")) or "").strip(),
                           "location": location, "location_ja": location_ja})
    return issues


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

    # EN ハブに静的に焼き込まれた日本語。用途ごとに分けて数える。
    #
    # ここで見えるのは静的 HTML の分だけで、EN ハブの日本語の大半は
    # data.js から JS が描く本文（f.desc 等）にある。そちらは実行しないと
    # 見えないので check_hub_pages.py の担当（§9-20 と同じ切り分け）。
    # en_hub_leaks_to_ja は「リンク先の URL」しか見ておらず、
    # 文言の言語は3つとも別のメトリクスで見ることになる。
    jsonld_ja = static_links_ja = 0
    for name in hub_names:
        f = LP / "en" / name
        if not f.exists():
            continue
        html = read(f)
        jsonld_ja += jsonld_ja_chars(ld_objects(html))
        static_links_ja += sum(ja_chars(block) for _, block in STATIC_LINKS_RE.findall(html))
    m["en_hub_jsonld_ja_chars"] = jsonld_ja
    m["en_hub_static_links_ja_chars"] = static_links_ja

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

    # ARTISTS の検索・絞り込みをスクロール中も使える状態に保つ。
    # sticky指定が消えると、長い一覧で検索欄が画面外へ消えるため、JA/ENを別々に検査する。
    artist_filter_sticky_pages = 0
    artist_toolbar_re = re.compile(
        r"\.artists-toolbar\s*\{[^}]*"
        r"position:\s*sticky\s*;[^}]*"
        r"top:\s*0\s*;[^}]*"
        r"z-index:\s*20\s*;",
        re.S,
    )
    for f in (LP / "artists.html", LP / "en" / "artists.html"):
        if f.exists() and artist_toolbar_re.search(read(f)):
            artist_filter_sticky_pages += 1
    m["artist_filter_sticky_pages"] = artist_filter_sticky_pages

    # LINE等のアプリ内ブラウザ向けの共有モバイル表示ガード。
    # Skipリンクがタップ後に残らず、固定ナビが独立レイヤーで描画されることを確認する。
    common_css = read(LP / "common.css")
    mobile_browser_guards = int(
        bool(re.search(r"\.skip-to-content:focus-visible", common_css))
        and bool(re.search(r"\.skip-to-content:focus\s*\{\s*transform:\s*translateY\(-200%\)", common_css))
        and bool(re.search(r"nav\s*\{[^}]*transform:\s*translate3d\(0, 0, 0\)", common_css, re.S))
    )
    m["mobile_in_app_browser_guards"] = mobile_browser_guards

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
    #
    # srcset は "a.webp 480w, b.webp 960w" と1つの属性に複数のURLが入る。
    # 素朴に属性値を1本のパスとして扱うと、幅指定やカンマごと
    # ファイル名の一部と見なして「存在しない」と誤検出する
    # （2026-08-07 に14件の誤検出。AUDIT §9-51）。
    # srcset だけ先に分解してから、通常の参照と同じ検査にかける。
    missing = set()
    for f in LP.rglob("*.html"):
        html = read(f)
        refs = []
        for srcset in re.findall(r'srcset="([^"]+)"', html):
            for candidate in srcset.split(","):
                url = candidate.strip().split()[0] if candidate.strip() else ""
                if url.startswith("/images/"):
                    refs.append(url)
        stripped = re.sub(r'\ssrcset="[^"]*"', " ", html)
        refs += re.findall(r'(?:src|content|")(?:https://techno-japan\.media)?(/images/[^"\']+)', stripped)
        # ?v=2 のようなキャッシュ用の版番号を外してから実体を探す。
        # 付けたまま探すと必ず「存在しない」になる
        # （2026-08-14、ロゴ差し替えで favicon-192.png?v=2 を誤検出した）。
        for ref in refs:
            path = ref.split("?")[0].split("#")[0]
            if not path:
                continue
            if not (LP / path.lstrip("/")).exists():
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
    location_issues = location_language_inversions()
    m["festival_location_language_inversions"] = len(location_issues)
    m["_festival_location_language_inversion_list"] = location_issues

    # 記事の公開整合性。生成側は draft の詳細ページを消すため、
    # sitemap とニュースハブの静的リンクが実在する公開ページだけを指すことを守る。
    missing_article_links = []
    for hub_path in (LP / "news.html", LP / "en" / "news.html"):
        if not hub_path.exists():
            continue
        html = read(hub_path)
        for block_name, block in STATIC_LINKS_RE.findall(html):
            if block_name != "ARTICLES":
                continue
            for href in re.findall(r'href="/(en/)?articles/([^"#]+)\.html"', block):
                prefix, raw_id = href
                rel = Path("en/articles" if prefix else "articles") / f"{unquote(raw_id)}.html"
                if not article_page_is_public(LP / rel):
                    missing_article_links.append(f"{hub_path.relative_to(LP)}: /{rel}")
    m["article_static_links_missing_pages"] = len(missing_article_links)
    m["_article_static_links_missing_list"] = missing_article_links

    # JA と EN の静的リンク一覧が同じ件数か。
    #
    # 生成は同じデータから両方を作るので、**ずれたら生成物のどちらかが古い。**
    # 2026-08-09、generate-meta.yml のコミット対象が
    # 「LP/articles LP/festivals LP/artists LP/venues LP/en」で、
    # LP/festivals は**フォルダ**のため LP/festivals.html に当たらず、
    # EN は LP/en でフォルダごと入るため **EN だけ更新されていた。**
    # 新着記事が JA の news.html の一覧から漏れ、JS を実行しないクローラーには
    # 見えていなかった（§9-64）。
    #
    # 件数で見る。中身は言語で違うが、件数は必ず一致する。
    static_link_gaps = []
    for name in hub_names:
        ja_f, en_f = LP / name, LP / "en" / name
        if not (ja_f.exists() and en_f.exists()):
            continue
        def counts(f):
            return {
                b: len(re.findall(r'href="/', block))
                for b, block in STATIC_LINKS_RE.findall(read(f))
            }
        cj, ce = counts(ja_f), counts(en_f)
        for block in sorted(set(cj) | set(ce)):
            if cj.get(block, 0) != ce.get(block, 0):
                static_link_gaps.append(
                    f"{name} {block}: JA={cj.get(block, 0)} EN={ce.get(block, 0)}"
                )
    m["hub_static_link_ja_en_gaps"] = len(static_link_gaps)
    m["_hub_static_link_ja_en_gap_list"] = static_link_gaps

    missing_sitemap_articles = []
    sitemap = LP / "sitemap.xml"
    if sitemap.exists():
        for loc in re.findall(r"<loc>([^<]+)</loc>", read(sitemap)):
            match = re.fullmatch(r"https://techno-japan\.media/(articles|en/articles)/([^/]+)\.html", unquote(loc))
            if not match:
                continue
            rel = Path(match.group(1)) / f"{match.group(2)}.html"
            if not article_page_is_public(LP / rel):
                missing_sitemap_articles.append(loc)
    m["article_sitemap_missing_pages"] = len(missing_sitemap_articles)
    m["_article_sitemap_missing_list"] = missing_sitemap_articles

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
    if actual["_festival_location_language_inversion_list"]:
        print("\nLOCATION / location_ja の文字種逆転:")
        for item in actual["_festival_location_language_inversion_list"]:
            print(f"  - {item['id']}: LOCATION={item['location']!r} / location_ja={item['location_ja']!r}")
    if actual["_article_static_links_missing_list"]:
        print("\n記事の静的リンク先が存在しません:")
        for item in actual["_article_static_links_missing_list"]:
            print(f"  - {item}")
    if actual["_article_sitemap_missing_list"]:
        print("\nsitemap の記事URLが存在しません:")
        for item in actual["_article_sitemap_missing_list"]:
            print(f"  - {item}")

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
