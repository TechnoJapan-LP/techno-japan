#!/usr/bin/env node
/* Capture and compare deterministic local-page screenshots with Chrome CDP. */
import { createServer } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const LP = path.join(ROOT, 'LP');
const HEIGHT = 6000;
const widths = [{ name: 'mobile', width: 390, dpr: 2, mobile: true }, { name: 'desktop', width: 1280, dpr: 1, mobile: false }];
const pages = [
  '/index.html', '/festivals.html', '/artists.html', '/venues.html', '/news.html', '/about.html', '/writers.html',
  '/festivals/matricaria.html', '/artists/acid-pauli.html', '/venues/bonobo.html',
  '/articles/asia-festival-2026-second.html', '/writers/masafumi-take.html',
  '/en/about.html', '/en/news.html', '/en/festivals.html', '/en/artists.html', '/en/venues.html',
  '/en/festivals/matricaria.html', '/en/articles/asia-festival-2026-second.html',
];

function chromePath() {
  for (const p of [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
  }
  throw new Error('Chrome/Chromium が見つかりません');
}
function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId; ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => { const msg = JSON.parse(event.data); if (msg.id !== id) return; ws.removeEventListener('message', onMessage); if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result); };
    ws.addEventListener('message', onMessage);
  });
}
cdp.nextId = 0;
async function browser() {
  const port = await freePort();
  const server = createHttpServer(async (req, res) => {
    const file = path.join(LP, decodeURIComponent((req.url || '/index.html').split('?')[0].replace(/^\/+/, '') || 'index.html'));
    if (!file.startsWith(LP + path.sep)) { res.statusCode = 403; return res.end(); }
    try {
      const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
      res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch { res.statusCode = 404; res.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const debugPort = await freePort();
  const chrome = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions', '--allow-file-access-from-files', `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) { await delay(100); try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
  if (!target) { chrome.kill('SIGTERM'); server.close(); throw new Error('Chrome DevTools のページに接続できません'); }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  return { ws, chrome, server, base: `http://127.0.0.1:${port}` };
}
const stableStyle = `*,:before,:after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}
body{opacity:1!important}
.reveal,.reveal.visible,.fx-reveal,.fx-reveal.fx-on{opacity:1!important;transform:none!important}
.fx-reveal .fx-frame,.fx-reveal.fx-on .fx-frame{clip-path:inset(0)!important}
.fx-reveal .fx-fig,.fx-gridlines{opacity:1!important}
.article-hero.fx-hero img{transform:none!important}`;
const deterministicScript = `(()=>{
  let seed=0x5eed1234;
  Math.random=()=>{ seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  Date.now=()=>1761091200000;
})()`;

async function settlePage(ws) {
  const expression = `(()=>new Promise(async resolve=>{
    document.head.insertAdjacentHTML('beforeend', '<style data-visual-snapshot>${stableStyle}</style>');
    document.querySelectorAll('.reveal,.fx-reveal').forEach(el=>el.classList.add('visible','fx-on'));
    document.querySelectorAll('[style*="opacity"],[style*="transform"]').forEach(el=>{
      if (el.matches('.reveal,.fx-reveal')) { el.style.opacity='1'; el.style.transform='none'; }
    });
    if(document.fonts?.ready) await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.complete
      ? (img.decode ? img.decode().catch(()=>{}) : Promise.resolve())
      : new Promise(r=>{img.addEventListener('load',r,{once:true});img.addEventListener('error',r,{once:true});})));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    resolve({height:document.documentElement.scrollHeight, images:document.images.length});
  }))())`;
  return (await cdp(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
}
async function capture(outDir) {
  await mkdir(outDir, { recursive: true });
  const b = await browser();
  try {
    await cdp(b.ws, 'Page.enable'); await cdp(b.ws, 'Runtime.enable');
    await cdp(b.ws, 'Page.addScriptToEvaluateOnNewDocument', { source: deterministicScript });
    await cdp(b.ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `try { if (location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/en/' || location.pathname === '/en/index.html') sessionStorage.setItem('tj-intro', '1'); } catch (e) {}` });
    await cdp(b.ws, 'Emulation.setScrollbarsHidden', { hidden: true });
    for (const viewport of widths) for (const page of pages) {
      await cdp(b.ws, 'Emulation.setDeviceMetricsOverride', { width: viewport.width, height: 900, deviceScaleFactor: viewport.dpr, mobile: viewport.mobile });
      await cdp(b.ws, 'Page.navigate', { url: `${b.base}${page}` });
      await cdp(b.ws, 'Runtime.evaluate', { expression: `new Promise(resolve=>{const start=Date.now();(function wait(){if(document.readyState==='complete'||Date.now()-start>=10000)return resolve(document.readyState);setTimeout(wait,50)})()})`, awaitPromise: true });
      await settlePage(b.ws);
      await cdp(b.ws, 'Runtime.evaluate', { expression: `new Promise(async r=>{for(let y=0;y<document.documentElement.scrollHeight;y+=800){scrollTo(0,y);await new Promise(x=>setTimeout(x,30));}scrollTo(0,0);r()})`, awaitPromise: true });
      const metrics = await cdp(b.ws, 'Page.getLayoutMetrics');
      const content = metrics.cssContentSize || metrics.contentSize;
      const height = Math.min(HEIGHT, Math.max(1, Math.ceil(content.height)));
      const shot = await cdp(b.ws, 'Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true, clip: { x: 0, y: 0, width: viewport.width, height, scale: 1 } });
      const name = `${page.replace(/^\//, '').replaceAll('/', '__').replace(/\.html$/, '') || 'index'}__${viewport.name}.png`;
      await writeFile(path.join(outDir, name), Buffer.from(shot.data, 'base64'));
      console.log(`captured ${name}`);
    }
    execFileSync('python3', [path.join(ROOT, 'scripts/visual-compare.py'), 'check', outDir], { stdio: 'inherit' });
  } finally { b.ws.close(); b.chrome.kill('SIGTERM'); b.server.close(); }
}
async function compare(dirA, dirB, outDir) {
  execFileSync('python3', [path.join(ROOT, 'scripts/visual-compare.py'), 'compare', dirA, dirB, ...(outDir ? ['--out', outDir] : [])], { stdio: 'inherit' });
}
const [command, ...args] = process.argv.slice(2);
try { if (command === 'capture' && args[0]) await capture(path.resolve(args[0])); else if (command === 'compare' && args[0] && args[1]) await compare(path.resolve(args[0]), path.resolve(args[1]), args[2] ? path.resolve(args[2]) : undefined); else { console.error('使い方: node scripts/visual-snapshot.mjs capture <dir> | compare <dirA> <dirB> [out]'); process.exitCode = 2; } } catch (error) { console.error(`visual-snapshot: ${error.message}`); process.exitCode = 1; }
