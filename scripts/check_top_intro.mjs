#!/usr/bin/env node
/* Browser smoke test for the TOP opening. */
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as wait} from 'node:timers/promises';
import path from 'node:path';

const root = path.resolve(new URL('../LP/', import.meta.url).pathname);
const failures = [];
const chrome = (() => {
  const candidates = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const candidate of candidates) {
    try { execFileSync(candidate, ['--version'], {stdio: 'ignore'}); return candidate; } catch {}
  }
  throw new Error('Chrome/Chromium が見つかりません');
})();

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const http = spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>{const u=(q.url||'/').split('?')[0].replace(/^\\/+/, '')||'index.html';require('fs').createReadStream(require('path').join(${JSON.stringify(root)},u)).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(${port},'127.0.0.1')`], {stdio: 'ignore'});
const browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions', `--remote-debugging-port=${port + 1}`, 'about:blank'], {stdio: 'ignore'});

let id = 0;
async function cdp(ws, method, params = {}) {
  const request = ++id;
  ws.send(JSON.stringify({id: request, method, params}));
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== request) return;
      ws.removeEventListener('message', onMessage);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    };
    ws.addEventListener('message', onMessage);
  });
}
async function evaluate(ws, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description || result.exceptionDetails.text}`);
  return result.result?.value;
}
async function nav(ws, url) {
  await cdp(ws, 'Page.navigate', {url});
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(ws, "document.readyState !== 'loading'")) return;
    await wait(50);
  }
  throw new Error('page load timeout');
}
async function mouseWheel(ws, deltaY) {
  await cdp(ws, 'Input.dispatchMouseEvent', {type: 'mouseWheel', x: 640, y: 400, deltaX: 0, deltaY});
  await wait(100);
}
async function touchDrag(ws) {
  await cdp(ws, 'Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 195, y: 700, id: 1}]});
  await cdp(ws, 'Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 195, y: 100, id: 1}]});
  await cdp(ws, 'Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await wait(100);
}
async function waitForIntroEnd(ws) {
  for (let elapsed = 0; elapsed <= 8000; elapsed += 100) {
    const ended = await evaluate(ws, "!!document.querySelector('#tj-intro') || document.documentElement.classList.contains('tj-intro-playing')");
    if (!ended) return;
    if (elapsed < 8000) await wait(100);
  }
}
function overflowScript() {
  return `(() => { const read = (node) => { const style = getComputedStyle(node); return {overflow: style.overflow, overflowX: style.overflowX, overflowY: style.overflowY}; }; return {html: read(document.documentElement), body: read(document.body)}; })()`;
}
function sameOverflow(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
function clipPathHasZeroWidth(clipPath) {
  const points = clipPath.match(/polygon\((.*)\)/)?.[1].split(',').map((point) => point.trim());
  if (!points || points.length < 2) return false;
  const secondX = Number.parseFloat(points[1].split(/\s+/)[0]);
  return Number.isFinite(secondX) && secondX === 0;
}
function introGeometryScript() {
  return `(() => {
    const intro = document.querySelector('#tj-intro');
    const style = intro && getComputedStyle(intro);
    const rect = intro?.getBoundingClientRect();
    return {loader: !!intro, position: style?.position, zIndex: style?.zIndex,
      rect: rect && {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      viewport: {width: innerWidth, height: innerHeight}};
  })()`;
}
function validIntroGeometry(value) {
  if (!value?.loader || value.position !== 'fixed' || value.zIndex !== '200') return false;
  const tolerance = 1;
  return Math.abs(value.rect.x) <= tolerance && Math.abs(value.rect.y) <= tolerance
    && Math.abs(value.rect.width - value.viewport.width) <= tolerance
    && Math.abs(value.rect.height - value.viewport.height) <= tolerance;
}

try {
  let target;
  for (let attempt = 0; attempt < 50 && !target; attempt += 1) {
    await wait(100);
    try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find((item) => item.type === 'page'); } catch {}
  }
  if (!target) throw new Error('CDP page unavailable');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
  const errors = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) errors.push(message.params.args?.map((arg) => arg.value || arg.description).join(' '));
  });

  await cdp(ws, 'Runtime.evaluate', {expression: "sessionStorage.setItem('tj-intro','1')"});
  await nav(ws, `http://127.0.0.1:${port}/index.html?overflow-baseline=1`);
  const overflowBaseline = await evaluate(ws, overflowScript());
  await cdp(ws, 'Runtime.evaluate', {expression: 'sessionStorage.clear()'});
  await nav(ws, `http://127.0.0.1:${port}/index.html?intro-test=1`);
  await wait(300);
  const first = await evaluate(ws, `(() => {
    const bar = document.querySelector('.tj-intro-bar.b1');
    const root = document.documentElement;
    return {loader: !!document.querySelector('#tj-intro'), playing: root.classList.contains('tj-intro-playing'), overflow: ${overflowScript()}, clip: getComputedStyle(bar).clipPath, skip: Number(getComputedStyle(document.querySelector('.tj-intro-skip')).opacity), scrollY: scrollY};
  })()`);
  const firstGeometry = await evaluate(ws, introGeometryScript());
  await mouseWheel(ws, 800);
  const firstScroll = await evaluate(ws, 'scrollY');
  if (!first.loader || !first.playing || overflowBaseline.html.overflow !== 'visible' || !sameOverflow(first.overflow, overflowBaseline) || !clipPathHasZeroWidth(first.clip) || firstScroll !== 0 || !validIntroGeometry(firstGeometry)) failures.push(`PC t≈0.3s: ${JSON.stringify({first, firstScroll, overflowBaseline, geometry: firstGeometry})}`);

  await wait(1700);
  const mid = await evaluate(ws, `(() => {
    const root = document.documentElement;
    return {nav: Number(getComputedStyle(document.querySelector('body > nav')).opacity), navVisibility: getComputedStyle(document.querySelector('body > nav')).visibility, marquee: Number(getComputedStyle(document.querySelector('.top2-marquee')).opacity), lead: Number(getComputedStyle(document.querySelector('.top2-lead')).opacity), playing: root.classList.contains('tj-intro-playing'), overflow: ${overflowScript()}};
  })()`);
  const midGeometry = await evaluate(ws, introGeometryScript());
  await mouseWheel(ws, 800);
  const midScroll = await evaluate(ws, 'scrollY');
  if ([mid.nav, mid.marquee, mid.lead].some((opacity) => opacity !== 0) || mid.navVisibility !== 'hidden' || !mid.playing || !sameOverflow(mid.overflow, overflowBaseline) || midScroll !== 0 || !validIntroGeometry(midGeometry)) failures.push(`PC t≈2.0s: ${JSON.stringify({mid, midScroll, geometry: midGeometry})}`);
  const desktop = await evaluate(ws, "document.querySelector('.tj-intro-mark')?.getBoundingClientRect().width");
  if (Math.abs(desktop - 168) > 1) failures.push(`PC mark幅: ${desktop}`);

  await waitForIntroEnd(ws);
  await wait(1100);
  const ended = await evaluate(ws, `(() => {
    const root = document.documentElement;
    return {loader: !!document.querySelector('#tj-intro'), playing: root.classList.contains('tj-intro-playing'), overflow: ${overflowScript()}, position: getComputedStyle(root).position, pointerEvents: getComputedStyle(root).pointerEvents, nav: Number(getComputedStyle(document.querySelector('body > nav')).opacity), navVisibility: getComputedStyle(document.querySelector('body > nav')).visibility, marquee: Number(getComputedStyle(document.querySelector('.top2-marquee')).opacity), lead: Number(getComputedStyle(document.querySelector('.top2-lead')).opacity)};
  })()`);
  await mouseWheel(ws, 800);
  const endedScroll = await evaluate(ws, 'scrollY');
  const sticky = await evaluate(ws, `(() => { const lead = document.querySelector('.top2-lead'); const target = lead.getBoundingClientRect().top + scrollY + 300; window.scrollTo({top: target, behavior: 'instant'}); return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { const stickyLead = document.querySelector('.top2-lead-sticky').getBoundingClientRect(); const nav = document.querySelector('body > nav').getBoundingClientRect(); resolve({scrollY, target, leadTop: stickyLead.top, navTop: nav.top, navBottom: nav.bottom}); }))); })()`);
  if (ended.loader || ended.playing || !sameOverflow(ended.overflow, overflowBaseline) || ended.position !== 'static' || ended.pointerEvents !== 'auto' || ended.navVisibility !== 'visible' || [ended.nav, ended.marquee, ended.lead].some((opacity) => opacity < 0.99) || endedScroll <= 0 || Math.abs(sticky.scrollY - sticky.target) > 2 || sticky.navTop !== 0 || Math.abs(sticky.leadTop - sticky.navBottom) > 1) failures.push(`終了t≈6.3s: ${JSON.stringify({ended, endedScroll, sticky})}`);

  await nav(ws, `http://127.0.0.1:${port}/index.html?reload=1`);
  const reload = await evaluate(ws, "({loader:!!document.querySelector('#tj-intro'),className:document.documentElement.className})");
  if (reload.loader || reload.className.includes('tj-intro-playing')) failures.push(`リロード再生: ${JSON.stringify(reload)}`);
  await cdp(ws, 'Runtime.evaluate', {expression: 'sessionStorage.clear()'});
  await nav(ws, `http://127.0.0.1:${port}/index.html?skip=1`);
  await wait(1700);
  await cdp(ws, 'Runtime.evaluate', {expression: "document.querySelector('.tj-intro-skip').click()"});
  await wait(100);
  if (await evaluate(ws, "!!document.querySelector('#tj-intro')")) failures.push('Skip後もローダーが残る');
  await cdp(ws, 'Runtime.evaluate', {expression: 'sessionStorage.clear()'});
  await cdp(ws, 'Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: 'reduce'}]});
  await nav(ws, `http://127.0.0.1:${port}/index.html?reduce=1`);
  const reduced = await evaluate(ws, "({loader:!!document.querySelector('#tj-intro'),imgs:performance.getEntriesByType('resource').filter((entry)=>entry.name.includes('/images/intro/')).map((entry)=>entry.name)})");
  if (reduced.loader || reduced.imgs.length) failures.push(`reduce: ${JSON.stringify(reduced)}`);
  await cdp(ws, 'Emulation.setEmulatedMedia', {features: []});
  await cdp(ws, 'Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 3, mobile: true});
  await cdp(ws, 'Runtime.evaluate', {expression: 'sessionStorage.clear()'});
  await nav(ws, `http://127.0.0.1:${port}/index.html?mobile=1`);
  await wait(300);
  const mobileGeometry = await evaluate(ws, introGeometryScript());
  if (!validIntroGeometry(mobileGeometry)) failures.push(`スマホ t≈0.3s: ${JSON.stringify(mobileGeometry)}`);
  await wait(1700);
  const mobileMidGeometry = await evaluate(ws, introGeometryScript());
  if (!validIntroGeometry(mobileMidGeometry)) failures.push(`スマホ t≈2.0s: ${JSON.stringify(mobileMidGeometry)}`);
  await touchDrag(ws);
  const mobileMidScroll = await evaluate(ws, 'scrollY');
  if (mobileMidScroll !== 0) failures.push(`スマホ t≈2.0s touch: scrollY=${mobileMidScroll}`);
  const mobile = await evaluate(ws, "document.querySelector('.tj-intro-mark')?.getBoundingClientRect().width");
  if (Math.abs(mobile - 120) > 1) failures.push(`モバイルmark幅: ${mobile}`);
  await waitForIntroEnd(ws);
  await wait(1100);
  await touchDrag(ws);
  const mobileTouchScroll = await evaluate(ws, 'scrollY');
  const mobileEnded = await evaluate(ws, `(() => { const lead = document.querySelector('.top2-lead'); const target = lead.getBoundingClientRect().top + scrollY + 300; window.scrollTo({top: target, behavior: 'instant'}); return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => { const stickyLead = document.querySelector('.top2-lead-sticky').getBoundingClientRect(); const nav = document.querySelector('body > nav').getBoundingClientRect(); resolve({scrollY, target, leadTop: stickyLead.top, navTop: nav.top, navBottom: nav.bottom, overflow: ${overflowScript()}}); }))); })()`);
  if (!sameOverflow(mobileEnded.overflow, overflowBaseline) || mobileTouchScroll <= 0 || mobileEnded.scrollY <= mobileEnded.target - 300 || mobileEnded.navTop !== 0 || Math.abs(mobileEnded.leadTop - mobileEnded.navBottom) > 1) failures.push(`スマホ終了後: ${JSON.stringify({mobileEnded, mobileTouchScroll})}`);
  if (errors.length) failures.push(`console error: ${errors.join(' | ')}`);
  console.log(`check_top_intro: ${failures.length ? 'FAIL' : 'PASS'}`);
  if (failures.length) { failures.forEach((failure) => console.error(`✗ ${failure}`)); process.exitCode = 1; } else console.log('初回・時間軸・終了・リロード・Skip・reduce・モバイル・console を確認');
} finally {
  browser.kill('SIGTERM');
  http.kill('SIGTERM');
}
