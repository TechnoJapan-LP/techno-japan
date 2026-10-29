#!/usr/bin/env node
/* Header safe-area guard for iOS home-screen style viewports. */
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const article = fs.readdirSync(path.join(root, 'LP/articles')).filter(f => f.endsWith('.html')).sort()[0];
const pages = ['/', '/festivals.html', '/artists.html', `/${'articles/' + article}`, '/en/index.html'];
const mobile = { width: 402, height: 874, deviceScaleFactor: 1, mobile: true };

function chromePath() {
  for (const p of [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean)) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
  }
  throw new Error('Chrome/Chromium が見つかりません');
}
function freePort() {
  return new Promise((resolve, reject) => { const s = createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
async function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId; ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => { const onMessage = event => { const msg = JSON.parse(event.data); if (msg.id !== id) return; ws.removeEventListener('message', onMessage); if (msg.error) reject(new Error(JSON.stringify(msg.error))); else resolve(msg.result); }; ws.addEventListener('message', onMessage); });
}
cdp.nextId = 0;
const skipTopIntro = `try { if (location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/en/' || location.pathname === '/en/index.html') sessionStorage.setItem('tj-intro', '1'); } catch (e) {}`;

const port = await freePort();
const http = spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>{const u=(q.url||'/').split('?')[0].replace(/^\\/+/, '')||'index.html'; require('fs').createReadStream(require('path').join(${JSON.stringify(root + '/LP')},u)).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(${port},'127.0.0.1')`], { stdio: 'ignore' });
const chrome = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port + 1}`, 'about:blank'], { stdio: 'ignore' });

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) { await delay(100); try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find(t => t.type === 'page'); } catch {} }
  if (!target) throw new Error('Chrome DevTools のページに接続できません');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  await cdp(ws, 'Page.enable'); await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: skipTopIntro });
  const consoleErrors = [];
  ws.addEventListener('message', event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args?.map(a => a.value || a.description || '').join(' ')); if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails?.text || 'uncaught exception'); });
  for (const mode of [{ name: 'safe', metrics: mobile, insets: { top: 62, bottom: 34, left: 0, right: 0 } }, { name: 'zero', metrics: mobile, insets: { top: 0, bottom: 0, left: 0, right: 0 } }, { name: 'pc', metrics: { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }]) {
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', mode.metrics);
    try { await cdp(ws, 'Emulation.setSafeAreaInsetsOverride', { insets: mode.insets }); } catch (error) { throw new Error(`setSafeAreaInsetsOverride が利用できません: ${error.message}`); }
    for (const page of pages) {
      consoleErrors.length = 0;
      await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}${page}` });
      await delay(700);
      const result = await cdp(ws, 'Runtime.evaluate', { returnByValue: true, expression: `(() => { const r=e=>{const x=e?.getBoundingClientRect();return x?{top:x.top,bottom:x.bottom,height:x.height,left:x.left,right:x.right}:null}; const nav=document.querySelector('body > nav'), logo=document.querySelector('body > nav .logo img'), burger=document.querySelector('.nav-hamburger'), mq=document.querySelector('.top2-marquee'); return {nav:r(nav),logo:r(logo),burger:r(burger),mq:r(mq),scrollY:scrollY}; })()` });
      const v = result.result?.value || {};
      const failures = [];
      if (!v.nav || Math.abs(v.nav.top) > 1 || Math.abs(v.nav.height - (mode.name === 'safe' ? 126 : 64)) > 1) failures.push(`nav=${JSON.stringify(v.nav)}`);
      if (mode.name === 'safe' && (!v.logo || v.logo.top < 61 || !v.burger || v.burger.top < 61 || v.burger.bottom > v.nav.bottom + 1 || Math.abs((v.burger.top + v.burger.height / 2) - (v.logo.top + v.logo.height / 2)) > 4)) failures.push(`controls=${JSON.stringify({logo:v.logo,burger:v.burger})}`);
      if (mode.name === 'zero' && (!v.logo || Math.abs(v.logo.top - 25) > 1 || !v.burger || Math.abs(v.burger.top - 10) > 1)) failures.push(`zero-controls=${JSON.stringify({logo:v.logo,burger:v.burger})}`);
      if (page === '/' && (!v.mq || Math.abs(v.mq.top - v.nav.bottom) > 1)) failures.push(`marquee=${JSON.stringify(v.mq)}`);
      if (failures.length || consoleErrors.length) throw new Error(`${mode.name} ${page}: ${failures.concat(consoleErrors.map(e => `console:${e}`)).join('; ')}`);
      if (page === '/') { await cdp(ws, 'Runtime.evaluate', { expression: 'scrollTo(0,300)' }); await delay(150); const after = await cdp(ws, 'Runtime.evaluate', { returnByValue: true, expression: 'document.querySelector(".top2-marquee")?.getBoundingClientRect().top' }); const expected = mode.name === 'safe' ? 126 : 64; if (Math.abs((after.result?.value ?? NaN) - expected) > 1) throw new Error(`${mode.name} ${page}: marquee after scroll=${after.result?.value}`); }
      console.log(`safe_area_header: ${mode.name} ${page} ok`);
    }
  }
} finally { chrome.kill('SIGTERM'); http.kill('SIGTERM'); }
