#!/usr/bin/env python3
"""
SPA 詳細ビューと静的詳細ページの出力差分を全エンティティで実測する。

なぜ必要か:
  カードのリンクは href に静的ページを持つが onclick で preventDefault() し、
  location.hash を書き換えて SPA の詳細ビューへ遷移する（festivals.html:1016 他）。
  そのため JS が有効な通常のユーザーは静的詳細ページに到達しない。
  静的ページにだけ実装された内容（FAQ・開催ヒストリー・performer・Instagram 等）は
  クローラーには届くが、人間のユーザーには見えていない。

  2026-08-01 に「SPA と静的の差分は対応不要」と判断したが、その前提は
  「静的ページが正規 URL でクローラーに届く」ことだけを見ており、
  「ユーザーがどちらを見るか」を確認していなかった。詳細は AUDIT §9-20。

何を測るか:
  エンティティごとに、SPA 詳細ビュー（headless Chrome で実描画）と
  静的詳細ページ（生成物をそのまま読む）から同じ特徴量を取り、差分を出す。
  SPA 廃止の前後で同じコマンドを流せば、解消したかを機械的に確認できる。

使い方:
  python3 scripts/audit_spa_vs_static.py                  # 全件
  python3 scripts/audit_spa_vs_static.py --limit 5        # 動作確認
  python3 scripts/audit_spa_vs_static.py --section festival
  → reports/spa-vs-static.md と reports/spa-vs-static.csv を出力
"""

import argparse
import csv
import glob
import http.server
import json
import re
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"
REPORTS = ROOT / "reports"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome", "chromium", "chromium-browser",
]


def find_chrome():
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
        w = subprocess.run(["which", c], capture_output=True, text=True)
        if w.returncode == 0:
            return w.stdout.strip()
    return None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class _Quiet:
    """Chrome は描画完了後に接続を切るので BrokenPipe が大量に出る。実害は無いので黙らせる。"""
    def handle_error(self, request, client_address):
        pass


class Server(_Quiet, threading.Thread):
    """LP/ を配信する。ThreadingHTTPServer でないと Chrome の並行取得で詰まる
    （scripts/check_hub_pages.py と同じ理由）。"""

    def __init__(self, root, port=0):
        super().__init__(daemon=True)
        handler = lambda *a, **k: QuietHandler(*a, directory=str(root), **k)
        http.server.ThreadingHTTPServer.allow_reuse_address = True
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
        self.httpd.daemon_threads = True
        self.port = self.httpd.server_address[1]

    def run(self):
        self.httpd.serve_forever()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def render(chrome, url, budget_ms=6000):
    """--user-data-dir は渡さない（空プロファイルだと macOS で戻ってこない）。

    このため全インスタンスが既定プロファイルを共有する。並列度を上げると
    プロファイルの奪い合いで描画に失敗する個体が出る（--workers 6 で 87件中
    5〜87件が空になった）。既定は逐次(--workers 1)。速度より再現性を取る。
    分離プロファイル（--user-data-dir に First Run を置く / --headless=new）も
    試したが、いずれも 45 秒で戻らずタイムアウトした。
    """
    try:
        p = subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox",
             "--no-first-run", "--disable-extensions", "--disable-dev-shm-usage",
             f"--virtual-time-budget={budget_ms}", "--dump-dom", url],
            capture_output=True, text=True, timeout=120,
        )
    except subprocess.TimeoutExpired:
        return ""
    return p.stdout


# ---------------------------------------------------------------- HTML 抽出

def extract_element(html, element_id):
    """id で指定した要素の中身を返す。

    閉じタグの並びを境界にしない（AGENTS.md / AUDIT §9-16）。開始タグから
    タグ名を取り、同名タグの入れ子を数えて対応する閉じタグを探す。
    `</div>` を最初に見つけた位置で切ると入れ子で途中終了する（実際に踏んだ）。
    """
    m = re.search(r'<(\w+)([^>]*\bid="' + re.escape(element_id) + r'")[^>]*>', html)
    if not m:
        return ""
    tag = m.group(1)
    i = m.end()
    depth = 1
    pat = re.compile(rf'</?{tag}\b', re.I)
    while depth:
        n = pat.search(html, i)
        if not n:
            return html[m.end():]
        depth += -1 if html[n.start():n.start() + 2 + len(tag)].startswith('</') else 1
        i = n.end()
    return html[m.end():i - len(tag) - 3]


SCRIPT_RE = re.compile(r"<script\b.*?</script>", re.S)


def strip_scripts(html):
    return SCRIPT_RE.sub("", html)


def heading_chunk(html, label):
    """<h2>…label… から次の <h2 までを返す。見出しが無ければ空。"""
    m = re.search(r'<h2[^>]*>\s*' + re.escape(label), html)
    if not m:
        return ""
    nxt = re.search(r'<h2\b', html[m.end():])
    return html[m.end(): m.end() + nxt.start()] if nxt else html[m.end():]


def heading_chunk_contains(html, substr):
    """見出しテキストに substr を含む <h2> の章を返す。「Tokyoの他のフェス」の
    ように都市名が前置される見出し用。"""
    for m in re.finditer(r'<h2\b[^>]*>(.{0,60}?)</h2>', html, re.S):
        if substr in re.sub(r'<[^>]+>', '', m.group(1)):
            nxt = re.search(r'<h2\b', html[m.end():])
            return html[m.end(): m.end() + nxt.start()] if nxt else html[m.end():]
    return ""


def count_class(html, cls):
    return len(re.findall(r'class="(?:[^"]*\s)?' + re.escape(cls) + r'(?=[\s"])', html))


# ---------------------------------------------------------------- 特徴量

def festival_features(spa, static):
    """SPA 側と静的側それぞれから同じ意味の特徴量を取る。マークアップは
    別実装なので、側ごとに別のセレクタを使う（同じ数字の意味は揃える）。"""
    st_lineup = heading_chunk(static, "LINE UP")
    # 開催ヒストリーは SPA が editions-timeline / edition-row、静的が
    # editions-table / edition-date と別実装なので、側ごとに別セレクタで数える。
    st_ed = heading_chunk(static, "開催ヒストリー")
    return {
        "lineup": (count_class(spa, "detail-lineup-item"), count_class(st_lineup, "lineup-item")),
        "editions": (count_class(spa, "edition-row"), count_class(st_ed, "edition-date")),
        # 開催ヒストリー内の過去ラインナップ。静的にしか無い（festival-lineups）。
        "past_lineup": (count_class(spa, "edition-artist"),
                        count_class(st_ed, "lineup-item")),
        # FAQ は静的が <dl><dt>、SPA は未実装。
        "faq_qa": (count_class(spa, "faq-item"),
                   len(re.findall(r'<dt\b', heading_chunk(static, "よくある質問")))),
        "summary": (count_class(spa, "festival-summary"), count_class(static, "festival-summary")),
        "instagram": (spa.count("instagram.com"), static.count("instagram.com")),
        "official_link": (len(re.findall(r'class="[^"]*detail-official', spa)),
                          len(re.findall(r'OFFICIAL SITE|OFFICIAL', static))),
        "artist_links": (len(re.findall(r'href="artists\.html#artist/', spa)),
                         len(re.findall(r'href="/?artists/[^"]+\.html"', static))),
        # 「〇〇の他のフェス」回遊ブロック。静的のみ（71/87ページ）。
        "related": (0, count_class(heading_chunk_contains(static, "他のフェス"), "lineup-item")),
    }


def artist_features(spa, static):
    return {
        "appearances": (len(re.findall(r'href="festivals\.html#festival/', spa)),
                        len(re.findall(r'href="/?festivals/[^"]+\.html"',
                                       heading_chunk(static, "出演フェス")))),
        # 本文の有無は専用マーカーで見る。コンテナ全体の文字数で判定すると
        # 名前・リンク等の定型テキストを本文と誤認する（SPA が全件 bio あり扱いになった）。
        "bio": (1 if re.search(r'class="[^"]*artist-detail-bio[^"]*"[^>]*>\s*\S', spa) else 0,
                1 if count_class(static, "lang-body") else 0),
        "instagram": (spa.count("instagram.com"), static.count("instagram.com")),
        "soundcloud": (spa.count("soundcloud.com"), static.count("soundcloud.com")),
        "bandcamp": (spa.count("bandcamp.com"), static.count("bandcamp.com")),
    }


def venue_features(spa, static):
    return {
        "instagram": (spa.count("instagram.com"), static.count("instagram.com")),
        "desc": (1 if re.search(r'class="[^"]*venue-detail-bio[^"]*"[^>]*>\s*\S', spa) else 0,
                 1 if count_class(static, "lang-body") else 0),
        "festival_links": (len(re.findall(r'href="festivals\.html#festival/', spa)),
                           len(re.findall(r'href="/?festivals/[^"]+\.html"', static))),
        # 「〇〇の他のヴェニュー」回遊ブロック。
        "related": (0, count_class(heading_chunk_contains(static, "他のヴェニュー"), "lineup-item")),
    }


def article_features(spa, static):
    return {
        "body_chars": (len(re.sub(r'<[^>]+>', '', spa).strip()),
                       len(re.sub(r'<[^>]+>', '', heading_chunk(static, "") or static).strip())),
        "tags": (count_class(spa, "detail-tag"), count_class(static, "article-tag")),
    }


SECTIONS = {
    "festival": dict(hub="festivals.html", hash="festival/", container="festival-detail",
                     dir="festivals", key="FESTIVALS", feat=festival_features),
    "artist":   dict(hub="artists.html", hash="artist/", container="artist-detail",
                     dir="artists", key="ARTISTS", feat=artist_features),
    "venue":    dict(hub="venues.html", hash="venue/", container="venue-detail",
                     dir="venues", key="VENUES", feat=venue_features),
    "article":  dict(hub="news.html", hash="article/", container="article-detail",
                     dir="articles", key="ARTICLES", feat=article_features),
}


def load_data():
    """data.js を node で読んで各配列を JSON で受け取る。const 宣言は
    globalThis に載らないので、明示的に集めて出力させる。"""
    js = ('const fs=require("fs"),vm=require("vm");const c={};vm.createContext(c);'
          'vm.runInContext(fs.readFileSync("LP/data.js","utf8")+'
          '";this.__d={FESTIVALS:typeof FESTIVALS!==\'undefined\'?FESTIVALS:[],'
          'ARTISTS:typeof ARTISTS!==\'undefined\'?ARTISTS:[],'
          'VENUES:typeof VENUES!==\'undefined\'?VENUES:[],'
          'ARTICLES:typeof ARTICLES!==\'undefined\'?ARTICLES:[]}",c);'
          'process.stdout.write(JSON.stringify(c.__d));')
    out = subprocess.run(["node", "-e", js], capture_output=True, text=True, cwd=ROOT)
    if out.returncode:
        sys.exit("data.js の読み込みに失敗: " + out.stderr[:400])
    return json.loads(out.stdout)


def is_redirect_stub(html):
    return "<title>Redirecting…</title>" in html and 'http-equiv="refresh"' in html


def measure(section, item, chrome, port, cfg):
    eid = item.get("id")
    url = f"http://127.0.0.1:{port}/{cfg['hub']}#{cfg['hash']}{eid}"
    # 空振りは 1 度だけ直列で取り直す。プロファイル競合による取りこぼしと、
    # 本当に描画されない（JS エラー等）ケースを区別するため。
    spa = ""
    for attempt in range(2):
        dom = render(chrome, url, 6000 if attempt == 0 else 9000)
        spa = extract_element(dom, cfg["container"]) if dom else ""
        if spa:
            break

    sp = LP / cfg["dir"] / f"{eid}.html"
    static_raw = sp.read_text(encoding="utf-8", errors="replace") if sp.exists() else ""
    if static_raw and is_redirect_stub(static_raw):
        static_raw = ""
    static = strip_scripts(static_raw)

    feats = cfg["feat"](spa, static)
    # 差分スコア: 静的にあって SPA に無い分の合計（SPA が多い場合は 0 扱いにせず符号を残す）
    missing = sum(max(0, st - sa) for sa, st in feats.values())
    extra = sum(max(0, sa - st) for sa, st in feats.values())
    return {
        "section": section, "id": eid, "name": item.get("name") or item.get("title") or eid,
        "spa_rendered": bool(spa), "static_exists": bool(static),
        "missing_in_spa": missing, "extra_in_spa": extra,
        **{f"{k}_spa": v[0] for k, v in feats.items()},
        **{f"{k}_static": v[1] for k, v in feats.items()},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--section", choices=list(SECTIONS))
    ap.add_argument("--limit", type=int)
    ap.add_argument("--workers", type=int, default=1)  # 既定は逐次（render() の注記参照）
    args = ap.parse_args()

    chrome = find_chrome()
    if not chrome:
        sys.exit("headless Chrome が見つかりません")

    data = load_data()
    srv = Server(LP)
    srv.start()
    rows = []
    try:
        for section, cfg in SECTIONS.items():
            if args.section and section != args.section:
                continue
            items = data.get(cfg["key"], [])
            if args.limit:
                items = items[:args.limit]
            print(f"  {section}: {len(items)}件 を計測中…", flush=True)
            with ThreadPoolExecutor(max_workers=args.workers) as ex:
                rows += list(ex.map(
                    lambda it: measure(section, it, chrome, srv.port, cfg), items))
    finally:
        srv.stop()

    REPORTS.mkdir(exist_ok=True)
    cols = sorted({k for r in rows for k in r})
    head = ["section", "id", "name", "missing_in_spa", "extra_in_spa",
            "spa_rendered", "static_exists"]
    cols = head + [c for c in cols if c not in head]
    with open(REPORTS / "spa-vs-static.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    write_markdown(rows)
    total = sum(r["missing_in_spa"] for r in rows)
    print(f"\n  計測 {len(rows)}件 / SPA に欠けている要素の総数 {total}")
    print(f"  → {(REPORTS/'spa-vs-static.md').relative_to(ROOT)}")
    print(f"  → {(REPORTS/'spa-vs-static.csv').relative_to(ROOT)}")


def write_markdown(rows):
    by_sec = {}
    for r in rows:
        by_sec.setdefault(r["section"], []).append(r)

    L = ["# SPA 詳細ビュー vs 静的詳細ページ 差分実測", "",
         "`scripts/audit_spa_vs_static.py` の出力。SPA 廃止の前後で再実行すると比較できる。", "",
         "カードのリンクは `preventDefault()` で SPA へ遷移するため、**JS 有効の通常ユーザーが",
         "見ているのは SPA 側**。静的側にしか無い項目はユーザーに届いていない。", ""]

    L += ["## サマリ", "", "| セクション | 件数 | SPA に欠けがある | 欠け要素の合計 |", "|---|---|---|---|"]
    for sec, rs in by_sec.items():
        bad = [r for r in rs if r["missing_in_spa"] > 0]
        L.append(f"| {sec} | {len(rs)} | {len(bad)} | {sum(r['missing_in_spa'] for r in rs)} |")

    for sec, rs in by_sec.items():
        # 集計用の簿記列（missing_in_spa / extra_in_spa）は特徴量ではないので除く。
        # 値が空文字の列は他セクションの特徴量が CSV 上で埋まっただけなので無視する。
        BOOK = {"missing_in", "extra_in"}
        feat_keys = sorted({
            k[:-4] for k in rs[0]
            if k.endswith("_spa") and k[:-4] not in BOOK
            and f"{k[:-4]}_static" in rs[0] and rs[0][k] != ""
        })
        L += ["", f"## {sec}", "", "### 項目別の合計（SPA / 静的）", "",
              "| 項目 | SPA 合計 | 静的 合計 | 差 |", "|---|---|---|---|"]
        num = lambda v: v if isinstance(v, int) else 0
        for k in feat_keys:
            a = sum(num(r.get(f"{k}_spa", 0)) for r in rs)
            b = sum(num(r.get(f"{k}_static", 0)) for r in rs)
            L.append(f"| {k} | {a} | {b} | **{b - a:+}** |")

        bad = sorted([r for r in rs if r["missing_in_spa"] > 0],
                     key=lambda r: -r["missing_in_spa"])
        L += ["", f"### 差分が大きい順（上位30 / 該当 {len(bad)}件）", "",
              "| # | id | name | 欠け | 内訳（SPA→静的） |", "|---|---|---|---|---|"]
        for i, r in enumerate(bad[:30], 1):
            det = ", ".join(f"{k} {r[f'{k}_spa']}→{r[f'{k}_static']}"
                            for k in feat_keys
                            if num(r.get(f"{k}_static", 0)) > num(r.get(f"{k}_spa", 0)))
            L.append(f"| {i} | `{r['id']}` | {r['name'][:34]} | {r['missing_in_spa']} | {det} |")

        nr = [r for r in rs if not r["spa_rendered"]]
        if nr:
            L += ["", f"⚠ SPA 詳細ビューが描画されなかった {len(nr)}件: " +
                  ", ".join(f"`{r['id']}`" for r in nr[:20])]

    (REPORTS / "spa-vs-static.md").write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
