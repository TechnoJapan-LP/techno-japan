#!/usr/bin/env python3
"""記事ページの変更前後を同じ実機相当条件で測る。

対象: JA/EN × 390/1280、dpr 2、Fast 3G相当。
転送量は自サイト・Google画像など外部を含む resource transferSize の合計。
"""
import argparse, base64, http.server, json, os, random, shutil, socket, socketserver, subprocess, tempfile, threading, time, urllib.request
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

class LocalServer:
    def __init__(self, root):
        handler = lambda *a, **kw: QuietHandler(*a, directory=str(root), **kw)
        self.httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    def __enter__(self):
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        return self
    def __exit__(self, *args):
        self.httpd.shutdown(); self.httpd.server_close()

def frame(payload):
    data = payload.encode(); mask = os.urandom(4)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    n = len(data); head = bytes([0x81])
    if n < 126: head += bytes([0x80 | n])
    elif n < 65536: head += bytes([0x80 | 126]) + n.to_bytes(2, 'big')
    else: head += bytes([0x80 | 127]) + n.to_bytes(8, 'big')
    return head + mask + masked

class CDP:
    def __init__(self, url):
        from urllib.parse import urlsplit
        p = urlsplit(url); self.sock = socket.create_connection((p.hostname, p.port))
        key = base64.b64encode(os.urandom(16)).decode()
        req = f"GET {p.path} HTTP/1.1\r\nHost: {p.hostname}:{p.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        self.sock.sendall(req.encode()); buf = b''
        while b'\r\n\r\n' not in buf: buf += self.sock.recv(4096)
        self.sock.settimeout(8); self.seq = 0
    def recv(self):
        first = self.sock.recv(2)
        if not first: raise RuntimeError('CDP socket closed')
        length = first[1] & 127
        if length == 126: length = int.from_bytes(self.sock.recv(2), 'big')
        elif length == 127: length = int.from_bytes(self.sock.recv(8), 'big')
        data = b''
        while len(data) < length: data += self.sock.recv(length - len(data))
        return json.loads(data.decode()) if first[0] & 0x0f == 1 else None
    def call(self, method, params=None):
        self.seq += 1; ident = self.seq
        self.sock.sendall(frame(json.dumps({'id': ident, 'method': method, 'params': params or {}})))
        while True:
            msg = self.recv()
            if msg and msg.get('id') == ident: return msg.get('result', {})
    def eval(self, expression):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': True})
        if result.get('exceptionDetails'): raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')
    def close(self): self.sock.close()

def measure(url, width, screenshot=None):
    profile = tempfile.mkdtemp(prefix='tj-article-weight-')
    port = random.randint(39000, 49000)
    proc = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-service-worker', f'--user-data-dir={profile}', f'--remote-debugging-port={port}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list'))
                tabs = [t for t in tabs if t.get('type') == 'page' and not t.get('url', '').startswith('chrome-extension://')]
                if tabs: break
            except Exception: time.sleep(.1)
        c = CDP(tabs[0]['webSocketDebuggerUrl'])
        c.call('Page.enable'); c.call('Network.enable')
        mobile = width <= 600
        c.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 844, 'deviceScaleFactor': 2, 'mobile': mobile})
        c.call('Emulation.setUserAgentOverride', {'userAgent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1' if mobile else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36'})
        c.call('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 204800, 'uploadThroughput': 75000, 'connectionType': 'cellular3g'})
        c.call('Page.addScriptToEvaluateOnNewDocument', {'source': """
          window.__tjPerf={lcp:0,cls:0};
          new PerformanceObserver(l=>{for(const e of l.getEntries())window.__tjPerf.lcp=Math.max(window.__tjPerf.lcp,e.startTime||0)}).observe({type:'largest-contentful-paint',buffered:true});
          new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__tjPerf.cls+=(e.value||0)}).observe({type:'layout-shift',buffered:true});
        """})
        c.call('Page.navigate', {'url': url}); time.sleep(6)
        sanity = c.eval("({href:location.href,title:document.title,bytes:document.documentElement.outerHTML.length,body:document.body?.innerText?.slice(0,80)||''})")
        if sanity['bytes'] < 1000:
            raise RuntimeError(f"記事ページを読み込めません: {sanity}")
        measure_js = """(()=>{const n=performance.getEntriesByType('navigation')[0];const r=performance.getEntriesByType('resource');return {bytes:r.reduce((s,e)=>s+(e.transferSize||0),0)+(n?.transferSize||0),images:r.filter(e=>/\\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i.test(e.name)).length,lcp:window.__tjPerf?.lcp||0,cls:window.__tjPerf?.cls||0}})()"""
        initial = c.eval(measure_js)
        if screenshot:
            shot = c.call('Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': False}).get('data')
            Path(screenshot).parent.mkdir(parents=True, exist_ok=True)
            Path(screenshot).write_bytes(base64.b64decode(shot))
        c.eval('window.scrollTo(0, document.documentElement.scrollHeight)'); time.sleep(8)
        final = c.eval(measure_js)
        c.close(); return {'initial': initial, 'afterScroll': final}
    finally:
        proc.terminate(); proc.wait(timeout=5); shutil.rmtree(profile, ignore_errors=True)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--root', default='LP'); ap.add_argument('--article', default='transcendence-2025-report.html'); ap.add_argument('--screenshot-dir'); args = ap.parse_args()
    root = Path(args.root).resolve(); rows = []
    with LocalServer(root) as server:
        base = f'http://127.0.0.1:{server.httpd.server_address[1]}'
        for lang in ('ja', 'en'):
            rel = f'articles/{args.article}' if lang == 'ja' else f'en/articles/{args.article}'
            for width in (390, 1280):
                screenshot = None
                if args.screenshot_dir:
                    screenshot = str(Path(args.screenshot_dir) / f"article-{lang}-{width}.png")
                result = measure(f'{base}/{rel}', width, screenshot)
                rows.append({'lang': lang, 'width': width, **result})
    print(json.dumps(rows, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
