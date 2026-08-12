#!/usr/bin/env python3
"""
ハブページの JS 健全性チェック — headless Chrome で実際に描画して検証する。

なぜ必要か:
  2026-07-22 から 10日間、festivals.html の一覧がまったく表示されていなかった。
  data.js の1件に DATE が無く getYearFromDate が undefined.split() で落ち、
  ページ全体の JS が停止していた。生成物の静的検査（check_regressions.py）は
  HTML を見るだけなので、この種の「JS は配信されているが実行時に死ぬ」障害を
  検出できない。実際にブラウザで開いて確かめるしかない。

検査内容:
  1. コンソールに Uncaught 例外が出ていないこと
  2. JS が描画する要素が閾値以上あること
     （静的リンクのフォールバックが残っていても検出できるよう、
       JS だけが生成するクラス名を数える）
  3. コンテナの中身が閾値以上のサイズであること
  4. EN ハブの描画後に日本語が残っていないこと（ja_containers / max_ja_chars）
     EN ハブの静的 HTML はほぼ空で、日本語は data.js から JS が描く。
     生成物を見る静的検査では原理的に捕まえられない領域を担当する。
  5. 描画後に参照される画像が実際に取得できること（JA/EN 全ハブ、許容 0件）
     2026-08-03 に EN ハブの画像が全滅した（相対パスが /en/images/... に
     解決されて 404）。broken_image_refs は生成物 HTML の /images/ 参照しか
     見ず、data.js から JS が埋めるパスは視界に入らない。
     naturalWidth ではなく URL の取得可否を見る（AUDIT §9-35）。
  6. URLパラメータ由来の値で XSS が発火しないこと（許容 0件）
     2026-08-06 に news.html の ?tag= で <img src=x onerror=...> が実行できた。
     静的に「未エスケープの補間」を探しても、その大半はデータ由来で安全なため
     真偽が決まらない。実際に攻撃URLを踏んで発火するかを見る（AUDIT §9-44）。

使い方:
  python3 scripts/check_hub_pages.py              # LP/ をローカル配信して検査
  python3 scripts/check_hub_pages.py --base https://techno-japan.media   # 本番を検査
  python3 scripts/check_hub_pages.py --update     # 実測値で閾値を書き換える
"""

import argparse
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from urllib.parse import urlsplit
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML が必要です: python3 -m pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "LP"
THRESHOLDS = ROOT / ".github" / "regression-thresholds.yml"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
]

# GPU や dbus 周りのノイズを除外して、ページ由来の例外だけを見る
CONSOLE_IGNORE = re.compile(
    r"installwebapp|GPU|gpu_|Fontconfig|dbus|Vulkan|gl_display|DevTools|"
    r"cache_util|voice_transcription|Floss|bluetooth|udev",
    re.I,
)
UNCAUGHT_RE = re.compile(r'CONSOLE:\d+\]\s*"?(Uncaught[^"]*)', re.I)

VENUE_MAP_TEST_PATH = "/__venue-map-test.html"
CURSOR_TEST_PATH = "/__cursor-test.html"
VENUE_MAP_TEST_HTML = """<!doctype html><html><body data-map-result="pending" data-fallback-result="pending" data-tile-fallback-result="pending" data-en-fallback-result="pending">
<iframe id="map-live" src="/venues.html"></iframe>
<iframe id="map-fallback" src="/venues.html"></iframe>
<iframe id="map-tile-fallback" src="/venues.html"></iframe>
<iframe id="map-en-fallback" src="/en/venues.html"></iframe>
<script>
const setResult = (name, value, detail = '') => {
  document.body.dataset[name] = value;
  if (detail) document.body.dataset[name + 'Detail'] = detail;
  if (document.body.dataset.mapResult !== 'pending' &&
      document.body.dataset.fallbackResult !== 'pending' &&
      document.body.dataset.tileFallbackResult !== 'pending' &&
      document.body.dataset.enFallbackResult !== 'pending') {
    document.querySelectorAll('iframe').forEach((frame) => frame.remove());
  }
};
/* 入れ物の id を直接指さない。
   以前は東京の 'venue-map-wrap' を決め打ちしていたが、venues.html の地図が
   都市ごとに自動生成される形になり、id が都市名から作られるようになった
   （AUDIT §9-78）。**検査が特定の都市に依存していると、都市を増やすたびに
   検査の方が壊れる。**開いている入れ物をクラスで取る。 */
const openWrap = (doc) =>
  [].slice.call(doc.querySelectorAll('.city-map-wrap'))
    .filter((w) => w.style.display !== 'none')[0]
  || doc.querySelector('.city-map-wrap');
const live = document.getElementById('map-live');
live.addEventListener('load', () => {
  const win = live.contentWindow;
  const doc = live.contentDocument;
  if (!win.L) { setResult('mapResult', 'fail', 'window.L missing'); return; }
  doc.getElementById('area-map-btn').click();
  const deadline = Date.now() + 12000;
  const poll = setInterval(() => {
    const wrap = openWrap(doc);
    const error = doc.getElementById('venue-map-error');
    if (wrap?.dataset.mapStatus === 'ready' && wrap.querySelector('.leaflet-container, .leaflet-pane')) {
      clearInterval(poll); setResult('mapResult', 'pass');
    } else if (error && !error.hidden) {
      clearInterval(poll); setResult('mapResult', 'fail', error.textContent.trim());
    } else if (Date.now() > deadline) {
      clearInterval(poll); setResult('mapResult', 'fail', 'test timeout');
    }
  }, 100);
});
const fallback = document.getElementById('map-fallback');
fallback.addEventListener('load', () => {
  const win = fallback.contentWindow;
  const doc = fallback.contentDocument;
  win.L = undefined;
  doc.getElementById('area-map-btn').click();
  setTimeout(() => {
    const wrap = openWrap(doc);
    const error = doc.getElementById('venue-map-error');
    const ok = error && !error.hidden && wrap?.style.display === 'none' && error.querySelector('a[href="#venues-grid"]');
    setResult('fallbackResult', ok ? 'pass' : 'fail', ok ? '' : 'fallback was not shown');
  }, 300);
});
const tileFallback = document.getElementById('map-tile-fallback');
tileFallback.addEventListener('load', () => {
  const win = tileFallback.contentWindow;
  const doc = tileFallback.contentDocument;
  win.L.tileLayer = () => {
    const layer = win.L.layerGroup();
    const addTo = layer.addTo.bind(layer);
    layer.addTo = (map) => {
      addTo(map);
      setTimeout(() => layer.fire('tileerror'), 0);
      return layer;
    };
    return layer;
  };
  doc.getElementById('area-map-btn').click();
  setTimeout(() => {
    const wrap = openWrap(doc);
    const error = doc.getElementById('venue-map-error');
    const ok = error && !error.hidden && wrap?.dataset.mapStatus === 'failed';
    setResult('tileFallbackResult', ok ? 'pass' : 'fail', ok ? '' : 'tileerror fallback was not shown');
  }, 300);
});
const enFallback = document.getElementById('map-en-fallback');
enFallback.addEventListener('load', () => {
  const win = enFallback.contentWindow;
  const doc = enFallback.contentDocument;
  win.L = undefined;
  doc.getElementById('area-map-btn').click();
  setTimeout(() => {
    const error = doc.getElementById('venue-map-error');
    const ok = error && !error.hidden && error.textContent.trim().startsWith('The map could not be loaded.');
    setResult('enFallbackResult', ok ? 'pass' : 'fail', ok ? '' : 'English fallback was not shown');
  }, 300);
});
</script></body></html>"""

CURSOR_TEST_HTML = """<!doctype html><html><body data-detail-result="pending" data-hub-result="pending">
<iframe id="cursor-detail" src="/festivals/matricaria.html"></iframe>
<iframe id="cursor-hub" src="/festivals.html"></iframe>
<script>
const runCursorTest = (frame, resultName) => {
  frame.addEventListener('load', () => {
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    setTimeout(() => {
      const dots = doc.querySelectorAll('.cursor-dot');
      const rings = doc.querySelectorAll('.cursor-ring');
      doc.dispatchEvent(new win.MouseEvent('mousemove', {
        bubbles: true, clientX: 123, clientY: 234
      }));
      setTimeout(() => {
        const dotMoved = dots[0]?.style.left === '123px' && dots[0]?.style.top === '234px';
        const ringMoved = !!rings[0]?.style.left && !!rings[0]?.style.top;
        const coarsePointer = win.matchMedia('(hover: none) and (pointer: coarse)').matches;
        const ok = !coarsePointer && dots.length === 1 && rings.length === 1 && dotMoved && ringMoved;
        document.body.dataset[resultName] = ok ? 'pass' : 'fail';
        document.body.dataset[resultName + 'Detail'] =
          `coarse=${coarsePointer},dots=${dots.length},rings=${rings.length},dotMoved=${dotMoved},ringMoved=${ringMoved}`;
        frame.remove();
      }, 150);
    }, 100);
  });
};
runCursorTest(document.getElementById('cursor-detail'), 'detailResult');
runCursorTest(document.getElementById('cursor-hub'), 'hubResult');
</script></body></html>"""


def find_chrome():
    for c in CHROME_CANDIDATES:
        if os.path.sep in c:
            if Path(c).exists():
                return c
        else:
            p = shutil.which(c)
            if p:
                return p
    return None


XSS_TEST_PATH = "/__xss-test.html"

# URL パラメータ由来の値が innerHTML に素通しで入っていないかを、実際に攻撃URLを
# 踏んで確かめる。2026-08-06 に news.html の ?tag= で <img src=x onerror=...> が
# 実行できた（AUDIT §9-44）。同一オリジンに CMS の認証トークンがあるため、
# URL を踏ませるだけでトークンを読める状態だった。
#
# 静的検査（grep で未エスケープの補間を探す）では判定できない。ハブ全体に
# innerHTML への補間が71箇所あり、そのほとんどはデータ由来で安全なため、
# 「未エスケープの補間がある」だけでは真偽が決まらない。実際に発火するかを見る。
XSS_TEST_HTML = """<!doctype html><html><body data-xss-result="pending" data-xss-detail="">
<script>
// 攻撃URLの一覧。ページと、攻撃者が制御できるパラメータの組み合わせ。
const CASES = [
  ['/news.html?tag=', 'news:tag'],
  ['/news.html#tag/', 'news:hash-tag'],
  ['/news.html?category=', 'news:category'],
  ['/festivals.html?genre=', 'festivals:genre'],
  ['/festivals.html?type=', 'festivals:type'],
  ['/artists.html?genre=', 'artists:genre'],
  ['/venues.html?area=', 'venues:area'],
  ['/en/news.html?tag=', 'en-news:tag'],
];
// onerror が動けば親フレームに印を付ける。同一オリジンなので親を触れる。
const PAYLOAD = encodeURIComponent('<img src=x onerror="parent.__XSS_HIT=1">');
(async () => {
  const fired = [];
  for (const [base, label] of CASES) {
    window.__XSS_HIT = 0;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;border:0;position:absolute;left:-9999px';
    frame.src = base + PAYLOAD;
    document.body.appendChild(frame);
    await new Promise(done => {
      let settled = false;
      const fin = () => { if (!settled) { settled = true; done(); } };
      frame.addEventListener('load', fin, { once: true });
      setTimeout(fin, 8000);
    });
    // 描画とタグ反映を待つ
    await new Promise(r => setTimeout(r, 700));
    if (window.__XSS_HIT === 1) fired.push(label);
    frame.remove();
  }
  document.body.dataset.xssDetail = fired.join(' | ');
  document.body.dataset.xssResult = String(fired.length);
})();
</script></body></html>"""

IMAGE_TEST_PATH = "/__image-test.html"

# main() が対象ページを埋めてから差し替える（Handler がリクエスト時に読む）。
IMAGE_TEST_HTML = ""


def image_test_html(paths):
    """描画後に実際に参照される画像URLを集め、読み込めないものを数えるページ。

    なぜ naturalWidth を見ないか:
      2026-08-03 に EN ハブの画像が全滅した際、壊れた経路10のうち5は
      background-image（CSS）で、naturalWidth を持たない。naturalWidth だけを
      見る検査だと index.html の4件を素通りさせ、今回の事故の後半を
      そのまま見逃していた。さらに loading="lazy" の画像は headless で
      未読込のまま naturalWidth===0 になり誤検出する。
      「参照されているURLが実際に取得できるか」を直接見るほうが、
      経路の種類に依存せず誤検出も無い。詳細は AUDIT §9-35。

    同一オリジンの /images/ だけを対象にする。外部CDN（Drive 等）は
    ネットワーク事情で落ちるとノイズになるため見ない。
    """
    return IMAGE_TEST_TEMPLATE.replace("__PAGES__", json.dumps(paths))


IMAGE_TEST_TEMPLATE = r"""<!doctype html><html><body data-image-result="pending" data-image-broken="">
<script>
const PAGES = __PAGES__;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const broken = [];
  for (const page of PAGES) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1280px;height:900px;border:0;position:absolute;left:-9999px;top:0';
    frame.src = page;
    document.body.appendChild(frame);
    await new Promise(done => {
      let settled = false;
      const fin = () => { if (!settled) { settled = true; done(); } };
      frame.addEventListener('load', fin, { once: true });
      setTimeout(fin, 15000);
    });
    const doc = frame.contentDocument;
    // カードが描かれる前に読むと画像ゼロで「異常なし」に見えてしまう。
    for (let i = 0; i < 80 && doc; i++) {
      if (doc.querySelector('img[src], [style*="background-image"], [data-bg]')) break;
      await wait(100);
    }
    const urls = new Set();
    if (doc) {
      doc.querySelectorAll('img[src]').forEach(el => { if (el.src) urls.add(el.src); });
      // ハブは background-image をインライン style で埋める。
      doc.querySelectorAll('[style*="background-image"]').forEach(el => {
        const m = /url\((['"]?)([^'"()]+)\1\)/.exec(el.getAttribute('style') || '');
        if (!m) return;
        try { urls.add(new URL(m[2], doc.baseURI).href); } catch (e) {}
      });
      // 遅延読み込みの背景（tjLazyBgAttr）。画面外のものは style に入らないので、
      // data-bg のまま残っている分もここで拾う。これを見ないと、
      // 「遅延させた画像は壊れていても検査に映らない」状態になる（AUDIT §9-32）。
      doc.querySelectorAll('[data-bg]').forEach(el => {
        const v = el.getAttribute('data-bg');
        if (!v) return;
        try { urls.add(new URL(v, doc.baseURI).href); } catch (e) {}
      });
      // 適用済みの背景は style 属性ではなく element.style に入るので別途拾う。
      doc.querySelectorAll('.fest-row-bg, .fest-row-thumb, .artist-mini-img, .venue-mini-img, .artist-card-img')
        .forEach(el => {
          const m = /url\((['"]?)([^'"()]+)\1\)/.exec(el.style.backgroundImage || '');
          if (!m) return;
          try { urls.add(new URL(m[2], doc.baseURI).href); } catch (e) {}
        });
    }
    for (const u of urls) {
      let parsed;
      try { parsed = new URL(u); } catch (e) { continue; }
      if (parsed.origin !== location.origin) continue;
      if (!/\/images\//.test(parsed.pathname)) continue;
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) broken.push(page + ' ' + parsed.pathname + ' ' + res.status);
      } catch (e) { broken.push(page + ' ' + parsed.pathname + ' fetch-failed'); }
    }
    frame.remove();
  }
  document.body.dataset.imageBroken = broken.slice(0, 20).join(' | ');
  document.body.dataset.imageResult = String(broken.length);
})();
</script></body></html>"""


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass  # アクセスログで検査結果が埋もれるのを防ぐ


class Server(threading.Thread):
    """LP/ を配信する。file:// だと fetch や SW が動かず本番と条件が変わる。

    ThreadingHTTPServer でなければならない。Chrome は HTML/CSS/JS/画像を
    keep-alive で同時に取りに来るため、単一スレッドのサーバでは最初の接続を
    掴んだまま後続を捌けず、描画が完了せずにハングする。
    """

    def __init__(self, root, port=0):
        super().__init__(daemon=True)
        root_dir = str(root)

        class Handler(QuietHandler):
            def __init__(self, *a, **k):
                super().__init__(*a, directory=root_dir, **k)

            def do_GET(self):
                test_pages = {
                    VENUE_MAP_TEST_PATH: VENUE_MAP_TEST_HTML,
                    CURSOR_TEST_PATH: CURSOR_TEST_HTML,
                    XSS_TEST_PATH: XSS_TEST_HTML,
                    IMAGE_TEST_PATH: IMAGE_TEST_HTML,
                }
                test_html = test_pages.get(urlsplit(self.path).path)
                if test_html is not None:
                    payload = test_html.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(payload)))
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                super().do_GET()

        handler = Handler
        http.server.ThreadingHTTPServer.allow_reuse_address = True
        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
        self.httpd.daemon_threads = True
        self.port = self.httpd.server_address[1]

    def run(self):
        self.httpd.serve_forever()

    def stop(self):
        self.httpd.shutdown()
        self.httpd.server_close()


def render(chrome, url, budget_ms):
    """headless Chrome で描画し、(DOM, コンソール出力) を返す。

    --user-data-dir に空のディレクトリを渡してはいけない。フレッシュな
    プロファイルだと Chrome が初回セットアップから戻らず、--dump-dom が
    永久に出力されない（macOS で再現確認済み）。既定プロファイルを使う。
    """
    try:
        proc = subprocess.run(
            [chrome, "--headless", "--disable-gpu", "--no-sandbox",
             "--no-first-run", "--disable-extensions",
             "--disable-dev-shm-usage",   # CI の /dev/shm が小さいとクラッシュする
             f"--virtual-time-budget={budget_ms}",
             "--enable-logging=stderr", "--log-level=0",
             "--dump-dom", url],
            capture_output=True, text=True, timeout=90,
        )
    except subprocess.TimeoutExpired:
        return "", "TIMEOUT: Chrome が 90 秒以内に描画を完了しませんでした"
    return proc.stdout, proc.stderr


def strip_style(html):
    return re.sub(r"<style\b.*?</style>", "", html, flags=re.S)


# EN ハブに残る日本語を数えるための文字クラス。check_regressions.py と同じ。
JA_RE = re.compile(r"[ぁ-ゟ゠-ヿ㐀-鿿ー々]")


def container_inner(body, cid):
    """id=cid の要素の中身。入れ子の同名タグを数えて対応する閉じまで取る。

    measure() 側の container 抽出は最初の </tag> で止めるため入れ子で切れるが、
    あちらは「閾値以上の大きさがあるか」を見るラチェットなので短く出ても害が無い。
    こちらは「日本語が残っていないか」を見るので、切れると見逃しになる。
    """
    om = re.search(rf'<(\w+)[^>]*id="{re.escape(cid)}"[^>]*>', body)
    if not om:
        return None
    tag = om.group(1)
    rest = body[om.end():]
    depth = 1
    for mm in re.finditer(rf"</?{tag}\b", rest):
        depth += 1 if mm.group(0)[1] != "/" else -1
        if depth == 0:
            return rest[:mm.start()]
    return rest


def count_ja(dom, spec):
    """描画後 DOM の、データ描画コンテナに残る日本語の文字数。

    <main> を使わないのは news.html / index.html が <main> を持たないため。
    「見つからなければ全体」のような既定値を置くと、コンテナ名を間違えたときに
    ナビやフッターまで数えて別の値にすり替わる（実際に一度そう誤報した）。
    見つからないコンテナは失敗として返し、黙って別の意味にしない。
    """
    ids = spec.get("ja_containers")
    if not ids:
        return None, []
    body = re.sub(r"<script\b[^>]*>.*?</script>", "", dom, flags=re.S)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = strip_style(body)
    total, missing = 0, []
    for cid in ids:
        inner = container_inner(body, cid)
        if inner is None:
            missing.append(cid)
            continue
        total += len(JA_RE.findall(re.sub(r"<[^>]+>", " ", inner)))
    return total, missing


def measure(dom, spec):
    """描画後 DOM から、JS が生成した要素数とコンテナサイズを測る。"""
    body = strip_style(dom)

    # class 属性のトークンとして完全一致する分だけ数える。
    # \b だと "artist-card" が "artist-card-image" にもマッチして過大計上になる
    # （- が単語境界のため）。空白か引用符で挟まれていることを要求する。
    marker = re.escape(spec["marker"])
    n = len(re.findall(
        r'class="(?:[^"]*\s)?' + marker + r'(?=[\s"])', body
    ))

    cid = spec.get("container")
    if cid:
        # 開始タグからタグ名を取り、同じタグの閉じまでを取る。
        # </div> 等で止めると入れ子の最初の閉じで切れてしまう（411B 事故）。
        om = re.search(rf'<(\w+)[^>]*id="{re.escape(cid)}"[^>]*>', body)
        if not om:
            return n, 0
        tag = om.group(1)
        rest = body[om.end():]
        cm = re.search(rf"</{tag}>", rest)
        inner = rest[:cm.start()] if cm else rest
    else:
        m = re.search(r"<main[^>]*>(.*?)</main>", body, re.S)
        inner = m.group(1) if m else ""
    return n, len(inner)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", help="検査対象のベースURL。省略時は LP/ をローカル配信")
    ap.add_argument("--update", action="store_true", help="実測値で閾値を書き換える")
    ap.add_argument("--budget", type=int, default=9000, help="描画待ち時間(ms)")
    args = ap.parse_args()

    chrome = find_chrome()
    if not chrome:
        sys.exit("headless Chrome が見つかりません: " + ", ".join(CHROME_CANDIDATES))

    conf = yaml.safe_load(THRESHOLDS.read_text(encoding="utf-8"))
    pages = conf.get("hub_pages")
    if not pages:
        sys.exit("regression-thresholds.yml に hub_pages がありません")

    server = None
    if args.base:
        base = args.base.rstrip("/")
    else:
        # 画像検査ページは対象ページ一覧を埋めてから配信する（Handler が読む）。
        globals()["IMAGE_TEST_HTML"] = image_test_html(["/" + n for n in pages])
        server = Server(LP)
        server.start()
        base = f"http://127.0.0.1:{server.port}"

    print(f"Chrome : {chrome}")
    print(f"対象   : {base}\n")

    failures, rows, actual = [], [], {}
    try:
        for name, spec in pages.items():
            dom, console = render(chrome, f"{base}/{name}", args.budget)
            uncaught = [
                m.group(1).strip()
                for line in console.splitlines() if not CONSOLE_IGNORE.search(line)
                for m in [UNCAUGHT_RE.search(line)] if m
            ]
            n, size = measure(dom, spec)
            ja, ja_missing = count_ja(dom, spec)
            actual[name] = {"markers": n, "container_bytes": size}
            if ja is not None:
                actual[name]["ja_chars"] = ja

            status = "ok"
            if uncaught:
                status = "FAIL"
                failures.append(f"{name}: Uncaught 例外 — {uncaught[0]}")
            if n < spec["min_markers"]:
                status = "FAIL"
                failures.append(
                    f"{name}: .{spec['marker']} が {n} 個（min {spec['min_markers']}）"
                    " — JS が描画に失敗している可能性"
                )
            if size < spec.get("min_container_bytes", 0):
                status = "FAIL"
                failures.append(
                    f"{name}: コンテナが {size}B（min {spec['min_container_bytes']}B）"
                )
            # EN ハブに日本語が残っていないか。静的検査では捕まえられない。
            # EN ハブの静的 HTML はほぼ空で、日本語は data.js から JS が描くため
            # （実測: EN Festivals の描画後に 11,196 字あった）。
            if ja_missing:
                status = "FAIL"
                failures.append(
                    f"{name}: ja_containers が見つからない（{', '.join(ja_missing)}）"
                    " — コンテナ名の変更か描画失敗"
                )
            limit = spec.get("max_ja_chars")
            if limit is not None and ja is not None and ja > limit:
                status = "FAIL"
                failures.append(
                    f"{name}: 描画後に日本語が {ja} 字（max {limit}）"
                    " — 言語分岐の漏れか、英語列が未入力のデータが増えた"
                )
            rows.append((name, n, spec["min_markers"], size,
                         spec.get("min_container_bytes", 0), len(uncaught), status,
                         ja, spec.get("max_ja_chars")))

        if server:
            map_dom, map_console = render(chrome, f"{base}{VENUE_MAP_TEST_PATH}", max(args.budget, 15000))
            map_result = re.search(r'<body[^>]*data-map-result="([^"]+)"', map_dom)
            fallback_result = re.search(r'<body[^>]*data-fallback-result="([^"]+)"', map_dom)
            tile_fallback_result = re.search(r'<body[^>]*data-tile-fallback-result="([^"]+)"', map_dom)
            en_fallback_result = re.search(r'<body[^>]*data-en-fallback-result="([^"]+)"', map_dom)
            map_value = map_result.group(1) if map_result else "missing"
            fallback_value = fallback_result.group(1) if fallback_result else "missing"
            tile_fallback_value = tile_fallback_result.group(1) if tile_fallback_result else "missing"
            en_fallback_value = en_fallback_result.group(1) if en_fallback_result else "missing"
            print(f"Venue map: init={map_value}, fallback={fallback_value}, "
                  f"tileerror={tile_fallback_value}, en_fallback={en_fallback_value}")
            if map_value != "pass":
                detail = re.search(r'data-map-result-detail="([^"]*)"', map_dom)
                failures.append(f"venues.html: Leaflet地図の初期化に失敗 — {detail.group(1) if detail else map_value}")
            if fallback_value != "pass":
                failures.append(f"venues.html: Leaflet失敗時のフォールバックに失敗 — {fallback_value}")
            if tile_fallback_value != "pass":
                failures.append(f"venues.html: タイル失敗時のフォールバックに失敗 — {tile_fallback_value}")
            if en_fallback_value != "pass":
                failures.append(f"en/venues.html: 英語フォールバックに失敗 — {en_fallback_value}")

            cursor_dom, cursor_console = render(chrome, f"{base}{CURSOR_TEST_PATH}", args.budget)
            detail_result = re.search(r'<body[^>]*data-detail-result="([^"]+)"', cursor_dom)
            hub_result = re.search(r'<body[^>]*data-hub-result="([^"]+)"', cursor_dom)
            detail_value = detail_result.group(1) if detail_result else "missing"
            hub_value = hub_result.group(1) if hub_result else "missing"
            print(f"Custom cursor: detail={detail_value}, hub-no-duplicate={hub_value}")
            if detail_value != "pass":
                detail = re.search(r'data-detail-result-detail="([^"]*)"', cursor_dom)
                failures.append(
                    "festivals/matricaria.html: カスタムカーソルの自動生成・移動に失敗 — "
                    + (detail.group(1) if detail else detail_value)
                )
            if hub_value != "pass":
                detail = re.search(r'data-hub-result-detail="([^"]*)"', cursor_dom)
                failures.append(
                    "festivals.html: 既存カーソルDOMとの重複防止・移動に失敗 — "
                    + (detail.group(1) if detail else hub_value)
                )

            # 描画後に参照される画像が実際に取得できるか（JA/EN 全ハブ）。
            # 全ページを iframe で順に開くので他の検査より時間がかかる。
            img_dom, _ = render(chrome, f"{base}{IMAGE_TEST_PATH}", max(args.budget, 90000))
            img_result = re.search(r'<body[^>]*data-image-result="([^"]*)"', img_dom)
            img_value = img_result.group(1) if img_result else "missing"
            print(f"Broken images: {img_value}")
            if img_value in ("missing", "pending", ""):
                # 「検査が終わらなかった」を「異常なし」と読み替えない。
                failures.append(
                    f"画像検査が完了しなかった（{img_value or 'empty'}）"
                    " — 描画待ちのタイムアウトか、検査ページ自体の失敗"
                )
            elif img_value != "0":
                detail = re.search(r'data-image-broken="([^"]*)"', img_dom)
                failures.append(
                    f"読み込めない画像が {img_value} 件: "
                    + (detail.group(1) if detail else "(内訳を取得できず)")
                )

            # URL パラメータ由来の値で XSS が発火しないか。実際に攻撃URLを踏む。
            xss_dom, _ = render(chrome, f"{base}{XSS_TEST_PATH}", max(args.budget, 60000))
            xss_result = re.search(r'<body[^>]*data-xss-result="([^"]*)"', xss_dom)
            xss_value = xss_result.group(1) if xss_result else "missing"
            print(f"XSS (URL params): {xss_value} fired")
            if xss_value in ("missing", "pending", ""):
                failures.append(
                    f"XSS 検査が完了しなかった（{xss_value or 'empty'}）"
                    " — 検査ページ自体の失敗。異常なしと読み替えないこと"
                )
            elif xss_value != "0":
                detail = re.search(r'data-xss-detail="([^"]*)"', xss_dom)
                failures.append(
                    f"URLパラメータ由来の XSS が {xss_value}件 発火: "
                    + (detail.group(1) if detail else "(内訳を取得できず)")
                    + "\n      → 値を innerHTML に入れる前に tjEscapeHtml() を通すこと（AUDIT §9-44）"
                )
    finally:
        if server:
            server.stop()

    if args.update:
        raw = THRESHOLDS.read_text(encoding="utf-8")
        for name, a in actual.items():
            raw = re.sub(rf"(^    {re.escape(name)}:\n(?:.*\n)*?      min_markers: )\d+",
                         lambda mo: mo.group(1) + str(a["markers"]), raw, count=1, flags=re.M)
        THRESHOLDS.write_text(raw, encoding="utf-8")
        print(f"更新しました: {THRESHOLDS.relative_to(ROOT)}")
        return 0

    w = max(len(r[0]) for r in rows)
    print(f"{'ページ'.ljust(w)}  {'要素':>6} {'min':>6} {'中身':>9} {'min':>8} {'例外':>5} "
          f"{'JA':>5} {'max':>5}  判定")
    print("-" * (w + 60))
    for name, n, mn, size, msz, unc, status, ja, ja_max in rows:
        ja_s = "—" if ja is None else str(ja)
        ja_m = "—" if ja_max is None else str(ja_max)
        print(f"{name.ljust(w)}  {n:>6} {mn:>6} {size:>8,}B {msz:>7,}B {unc:>5} "
              f"{ja_s:>5} {ja_m:>5}  {'✅' if status == 'ok' else '❌'}")

    if failures:
        print("\n" + "=" * 60)
        print("ハブページの描画に問題があります:")
        for f in failures:
            print(f"  ✗ {f}")
        print("\n意図した変更なら .github/regression-thresholds.yml の hub_pages を"
              "更新してください（--update で実測値を反映できます）。")
        return 1

    print("\n✅ 全ハブページが正常に描画されています")
    return 0


if __name__ == "__main__":
    sys.exit(main())
