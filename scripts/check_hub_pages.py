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

使い方:
  python3 scripts/check_hub_pages.py              # LP/ をローカル配信して検査
  python3 scripts/check_hub_pages.py --base https://techno-japan.media   # 本番を検査
  python3 scripts/check_hub_pages.py --update     # 実測値で閾値を書き換える
"""

import argparse
import http.server
import os
import re
import shutil
import subprocess
import sys
import threading
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
            actual[name] = {"markers": n, "container_bytes": size}

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
            rows.append((name, n, spec["min_markers"], size,
                         spec.get("min_container_bytes", 0), len(uncaught), status))
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
    print(f"{'ページ'.ljust(w)}  {'要素':>6} {'min':>6} {'中身':>9} {'min':>8} {'例外':>5}  判定")
    print("-" * (w + 48))
    for name, n, mn, size, msz, unc, status in rows:
        print(f"{name.ljust(w)}  {n:>6} {mn:>6} {size:>8,}B {msz:>7,}B {unc:>5}  "
              f"{'✅' if status == 'ok' else '❌'}")

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
