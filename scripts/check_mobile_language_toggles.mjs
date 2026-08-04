#!/usr/bin/env node
/* Mobile language-toggle smoke guard.
 * Opens the hamburger menu at phone widths and checks the rendered toggle,
 * rather than merely looking for its markup in the source.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const widths = [375, 390];
const pages = [
  '/', '/news.html', '/festivals.html', '/artists.html', '/venues.html',
  '/festivals/matricaria.html',
  '/en/index.html', '/en/news.html', '/en/festivals.html', '/en/artists.html',
  '/en/venues.html', '/en/festivals/matricaria.html',
];

function chromePath() {
  for (const p of [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean)) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
  }
  throw new Error('Chrome/Chromium が見つかりません');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}

async function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
  });
}
cdp.nextId = 0;

const port = await freePort();
const http = spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>{const u=(q.url||'/').split('?')[0].replace(/^\\/+/, '')||'index.html'; require('fs').createReadStream(require('path').join(${JSON.stringify(root + '/LP')},u)).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(${port},'127.0.0.1')`], { stdio: 'ignore' });
const chrome = spawn(chromePath(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
  `--remote-debugging-port=${port + 1}`, 'about:blank',
], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await delay(100);
    try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('Chrome DevTools のページに接続できません');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');
  let passed = 0;
  const failures = [];
  for (const width of widths) {
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: true });
    for (const page of pages) {
      await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}${page}` });
      await delay(600);
      const expr = `(() => { const b=document.querySelector('.nav-hamburger'); if(!b) return {ok:false,reason:'hamburger missing'}; b.click(); const e=document.querySelector('.nav-overlay .nav-lang'); if(!e) return {ok:false,reason:'overlay toggle missing'}; const s=getComputedStyle(e),r=e.getBoundingClientRect(),a=e.querySelector('a'),ar=a&&a.getBoundingClientRect(); const ok=s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>=44&&r.height>=44&&!!a&&ar.width>=44&&ar.height>=44; return {ok,reason:ok?'':('style='+s.display+'/'+s.visibility+'/'+s.opacity+' rect='+r.width+'x'+r.height+' link='+(ar&&ar.width)+'x'+(ar&&ar.height)),rect:[r.width,r.height],href:a&&a.getAttribute('href')}; })()`;
      const out = await cdp(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true });
      const value = out.result?.value || { ok: false, reason: 'no result' };
      if (value.ok) passed++; else failures.push(`${width}px ${page}: ${value.reason}`);
    }
  }
  console.log(`mobile_language_toggles: ${passed}/${widths.length * pages.length}`);
  if (failures.length) { for (const f of failures) console.error(`✗ ${f}`); process.exitCode = 1; }
} finally {
  chrome.kill('SIGTERM');
  http.kill('SIGTERM');
}
