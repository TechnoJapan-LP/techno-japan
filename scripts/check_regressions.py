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
    for f in fest_all:
        html = read(f)
        faqs = [d for d in ld_objects(html) if d.get("@type") == "FAQPage"]
        if faqs:
            faq_ld_pages += 1
            faq_qa_total += sum(len(as_list(d.get("mainEntity"))) for d in faqs)
        body = body_without_scripts(html)
        if re.search(r'class="(?:[^"]*\s)?festival-faq(?=[\s"])', body):
            faq_section_pages += 1
        if re.search(r'class="(?:[^"]*\s)?festival-summary(?=[\s"])', body):
            summary_pages += 1

    m["festival_faq_pages"] = faq_ld_pages
    m["festival_faq_section_pages"] = faq_section_pages
    m["festival_faq_qa_total"] = faq_qa_total
    m["festival_summary_pages"] = summary_pages

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
