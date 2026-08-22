#!/usr/bin/env python3
"""同一条件で一覧ビジュアル案の転送量・LCP・CLSを測る。"""
import argparse, base64, http.server, json, os, random, shutil, socket, socketserver, subprocess, tempfile, threading, time, urllib.request
from pathlib import Path

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

class LocalServer:
    def __init__(self, root):
        self.root = str(root)
        handler = lambda *a, **kw: QuietHandler(*a, directory=self.root, **kw)
        self.httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
        self.port = self.httpd.server_address[1]
    def __enter__(self):
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True); self.thread.start(); return self
    def __exit__(self, *args): self.httpd.shutdown(); self.httpd.server_close()

def ws_frame(payload):
    data = payload.encode(); mask = os.urandom(4); masked = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
    n = len(data); head = bytes([0x81])
    if n < 126: head += bytes([0x80 | n])
    elif n < 65536: head += bytes([0x80 | 126]) + n.to_bytes(2, 'big')
    else: head += bytes([0x80 | 127]) + n.to_bytes(8, 'big')
    return head + mask + masked

class CDP:
    def __init__(self, url):
        from urllib.parse import urlsplit
        p = urlsplit(url); self.sock = socket.create_connection((p.hostname, p.port));
        key = base64.b64encode(os.urandom(16)).decode()
        req = f"GET {p.path} HTTP/1.1\r\nHost: {p.hostname}:{p.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        self.sock.sendall(req.encode()); buf = b''
        while b'\r\n\r\n' not in buf: buf += self.sock.recv(4096)
        self.sock.settimeout(5); self.seq = 0
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
        self.sock.sendall(ws_frame(json.dumps({'id': ident, 'method': method, 'params': params or {}})))
        while True:
            msg = self.recv()
            if msg and msg.get('id') == ident: return msg.get('result', {})
    def eval(self, expression, await_promise=False):
        result = self.call('Runtime.evaluate', {'expression': expression, 'returnByValue': True, 'awaitPromise': await_promise})
        if result.get('exceptionDetails'):
            raise RuntimeError(result['exceptionDetails'])
        return result.get('result', {}).get('value')
    def close(self): self.sock.close()

def chrome_for(url, screenshot, width=390):
    profile = tempfile.mkdtemp(prefix='tj-list-visual-')
    port = random.randint(39000, 49000)
    proc = subprocess.Popen([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', f'--user-data-dir={profile}', f'--remote-debugging-port={port}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list'))
                tabs = [t for t in tabs if t.get('type') == 'page' and not t.get('url','').startswith('chrome-extension://')]
                if tabs: break
            except Exception: time.sleep(.1)
        c = CDP(tabs[0]['webSocketDebuggerUrl'])
        c.call('Page.enable'); c.call('Network.enable')
        mobile = width <= 600
        c.call('Emulation.setDeviceMetricsOverride', {'width': width, 'height': 844, 'deviceScaleFactor': 2 if mobile else 1, 'mobile': mobile})
        c.call('Emulation.setUserAgentOverride', {'userAgent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1' if mobile else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36'})
        c.call('Network.emulateNetworkConditions', {'offline': False, 'latency': 150, 'downloadThroughput': 204800, 'uploadThroughput': 75000, 'connectionType': 'cellular3g'})
        c.call('Page.addScriptToEvaluateOnNewDocument', {'source': """
          window.__tjPerf={lcp:0,cls:0};
          new PerformanceObserver(l=>{for(const e of l.getEntries())window.__tjPerf.lcp=Math.max(window.__tjPerf.lcp,e.startTime||0)}).observe({type:'largest-contentful-paint',buffered:true});
          new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__tjPerf.cls+=(e.value||0)}).observe({type:'layout-shift',buffered:true});
        """})
        c.call('Page.navigate', {'url': url})
        time.sleep(5)
        c.eval("""(()=>{window.__tjPerf=window.__tjPerf||{lcp:0,cls:0};if(window.__tjPerfInstalled)return;window.__tjPerfInstalled=true;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__tjPerf.lcp=Math.max(window.__tjPerf.lcp,e.startTime||0)}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__tjPerf.cls+=(e.value||0)}).observe({type:'layout-shift',buffered:true})})()""")
        if not c.eval("location.pathname.includes('festivals') || location.pathname.includes('venues')"):
            print('WARN unexpected page:', c.eval("location.href"), c.eval("document.body.innerText.slice(0,120)"), flush=True)
        measure = """(()=>{const nav=performance.getEntriesByType('navigation')[0];const rs=performance.getEntriesByType('resource');return JSON.stringify({bytes:rs.reduce((s,e)=>s+(e.transferSize||0),0)+(nav?.transferSize||0),images:rs.filter(e=>/\\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i.test(e.name)).length,lcp:window.__tjPerf.lcp,cls:window.__tjPerf.cls})})()"""
        initial = json.loads(c.eval(measure))
        c.eval("window.scrollTo(0, document.documentElement.scrollHeight)")
        time.sleep(8)
        final = json.loads(c.eval(measure))
        c.eval("document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,document.querySelector('.festival-row,.venue-card')?.offsetTop||0)")
        if screenshot:
            try:
                c.call('Page.stopLoading')
                shot = c.call('Page.captureScreenshot', {'format':'png','captureBeyondViewport':False}).get('data')
                Path(screenshot).parent.mkdir(parents=True, exist_ok=True); Path(screenshot).write_bytes(base64.b64decode(shot))
            except socket.timeout:
                print(f'WARN screenshot timeout: {screenshot}', flush=True)
        c.close(); return initial, final
    finally:
        proc.terminate(); proc.wait(timeout=5); shutil.rmtree(profile, ignore_errors=True)

def run(root, base, state, shotdir, only_page=None, width=390):
    with LocalServer(root) as srv:
        out=[]
        for page in (only_page,) if only_page else ('festivals.html', 'venues.html'):
            query = '' if state == 'before' else ('?visual=a' if state == 'A' and page == 'festivals.html' else '?visual=b' if state == 'B' and page == 'festivals.html' else '')
            for lang in ('ja', 'en'):
                path = page if lang == 'ja' else f'en/{page}'
                shot = (Path(shotdir) / f'{state.lower()}-{lang}-{page[:-5]}-{width}.png') if shotdir else None
                ini, fin = chrome_for(f'http://127.0.0.1:{srv.port}/{path}{query}', shot, width)
                out.append({'state':state,'page':page[:-5],'lang':lang,'initial':ini,'final':fin})
    return out

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',required=True); ap.add_argument('--state',required=True,choices=['before','A','B']); ap.add_argument('--base',default=''); ap.add_argument('--shots',default=''); ap.add_argument('--page',choices=['festivals.html','venues.html']); ap.add_argument('--width',type=int,default=390); args=ap.parse_args()
    print(json.dumps(run(Path(args.root), args.base, args.state, args.shots, args.page, args.width), ensure_ascii=False))
if __name__ == '__main__': main()
