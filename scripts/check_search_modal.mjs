#!/usr/bin/env node
/* Search modal smoke guard for the mobile menu path.
 * This is intentionally kept as a preflight check but is not run in restricted
 * environments that cannot bind a local server or launch Chrome.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const pages = [
  '/', '/en/index.html',
  '/about.html', '/submit.html', '/writers.html',
  '/en/about.html', '/en/submit.html', '/en/writers.html',
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
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
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

  for (const page of pages) {
    await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}${page}` });
    await delay(600);
    const open = `(() => { const b=document.querySelector('.nav-hamburger'); if(!b) return {ok:false,reason:'hamburger missing'}; b.click(); const o=document.querySelector('.nav-overlay'),s=o&&o.querySelector(':scope > .nav-search-link'),l=o&&o.querySelector(':scope > .nav-lang'); if(!s) return {ok:false,reason:'search link missing'}; if(!l||s.nextElementSibling!==l) return {ok:false,reason:'search link is not immediately before language toggle'}; s.click(); return {ok:true}; })()`;
    const opened = await cdp(ws, 'Runtime.evaluate', { expression: open, returnByValue: true });
    if (!opened.result?.value?.ok) throw new Error(`${page}: ${opened.result?.value?.reason || 'menu did not open'}`);
    await delay(350);
    const state = await cdp(ws, 'Runtime.evaluate', { expression: `(() => { const modal=document.querySelector('#global-search-modal'),input=document.querySelector('#gs-input'); if(!modal||!input) return {ok:false,reason:'search modal or input missing'}; const r=input.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); const hitOk=hit===input||!!hit?.closest('.gs-input-wrap'); const active=modal.classList.contains('active'); const focused=document.activeElement===input; return {ok:active&&hitOk&&focused,active,hitOk,focused}; })()`, returnByValue: true });
    const value = state.result?.value || {};
    if (!value.ok) throw new Error(`${page}: input hit=${value.hitOk} active=${value.active}`);
    await cdp(ws, 'Input.insertText', { text: 'laby' });
    await delay(250);
    const results = await cdp(ws, 'Runtime.evaluate', { expression: `document.querySelectorAll('.gs-result').length`, returnByValue: true });
    if ((results.result?.value || 0) < 1) throw new Error(`${page}: no search results for laby`);
    console.log(`search_modal: ${page} ok`);
  }
} finally {
  chrome.kill('SIGTERM');
  http.kill('SIGTERM');
}
