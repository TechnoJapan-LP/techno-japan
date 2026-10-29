#!/usr/bin/env node
/* TOP の THIS WEEK が開催期間の重なりを使い、JA/EN と各幅で同じ結果になることを確認する。 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LP = path.join(ROOT, 'LP');
const hub = fs.readFileSync(path.join(LP, 'data-hub.js'), 'utf8');
const festivalMatch = hub.match(/const FESTIVALS\s*=\s*(\[[\s\S]*?\]);/);
if (!festivalMatch) throw new Error('data-hub.js の FESTIVALS が読めません');
const festivals = JSON.parse(festivalMatch[1]);
const fixedDate = '2026-10-29';
const fixedIso = `${fixedDate}T03:00:00.000Z`;
const range = (value) => {
  const [start, end = start] = String(value || '').split('/');
  return /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) ? { start, end } : null;
};
const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const fixedRange = festivals.map((festival) => ({ ...festival, range: range(festival.date) })).filter((festival) => festival.range);
const expectedFor = (date, filter) => {
  const end = addDays(date, 6);
  const upcoming = fixedRange.filter((festival) => festival.range.end >= date).sort((a, b) => a.range.start.localeCompare(b.range.start));
  return upcoming.filter((festival) => {
    if (filter === 'all') return true;
    if (filter === 'week') return festival.range.start <= end && festival.range.end >= date;
    return String(festival.type || '').toLowerCase() === filter;
  });
};
const emptyDate = (() => {
  for (let offset = 0; offset < 370; offset += 1) {
    const date = addDays('2026-01-01', offset);
    if (expectedFor(date, 'week').length === 0) return date;
  }
  return null;
})();
if (!emptyDate) throw new Error('7日間に該当イベントがない日を見つけられません');

const chromeCandidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => candidate.includes('/')
  ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0);
if (!chrome) throw new Error('Chrome/Chromium が見つかりません');

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://check.local').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname === '/en/' ? 'en/index.html' : pathname.replace(/^\/+/, '');
  const file = path.join(LP, relative);
  if (!file.startsWith(`${LP}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}

let browser;
let ws;
let profileDir;
let cdpId = 0;
const skipTopIntro = `try { if (location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/en/' || location.pathname === '/en/index.html') sessionStorage.setItem('tj-intro', '1'); } catch (e) {}`;
function cdp(method, params = {}) {
  const id = ++cdpId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 20000);
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer); ws.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error))); else resolve(message.result);
    };
    ws.addEventListener('message', onMessage);
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'ブラウザ評価に失敗');
  return result.result?.value;
}
async function waitFor(expression) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return true;
    await delay(100);
  }
  return false;
}
async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await delay(300);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}
async function setFixedDate(iso) {
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const NativeDate = window.__tjNativeDate || Date;
    window.__tjNativeDate = NativeDate;
    const fixed = NativeDate.parse(${JSON.stringify(iso)});
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    }
    FixedDate.parse = NativeDate.parse;
    FixedDate.UTC = NativeDate.UTC;
    window.Date = FixedDate;
  })();` });
}
async function openPage(base, pathname, width) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: width === 390 ? 3 : 1, mobile: width === 390 });
  await cdp('Page.navigate', { url: `${base}${pathname}` });
  if (!await waitFor('document.readyState === "complete" && !!document.querySelector("#top-phase2")')) throw new Error(`${pathname} が読み込めません`);
}
async function inspectFilter(filter) {
  const result = await evaluate(`(() => {
    const button = document.querySelector('.top2-chips .chip[data-filter=${JSON.stringify(filter)}]');
    if (button) button.click();
    const grid = document.querySelector('.top2-festival-grid');
    return {
      links: [...grid.querySelectorAll('a.top2-festival-card')].map((link) => new URL(link.href).pathname),
      count: document.querySelector('.top2-upcoming-count')?.textContent || '',
      empty: grid.textContent.trim(),
    };
  })()`);
  return result;
}

try {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const debugPort = await freePort();
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-top-week-'));
  browser = spawn(chrome, ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-extensions', `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
    await delay(100);
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find((item) => item.type === 'page'); } catch { /* 起動待ち */ }
  }
  if (!target) throw new Error('Chrome DevTools のページに接続できません');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: skipTopIntro });
  await setFixedDate(fixedIso);
  const failures = [];
  for (const [pathname, lang] of [['/', 'ja'], ['/en/', 'en']]) {
    for (const width of [390, 1440]) {
      await openPage(`http://127.0.0.1:${port}`, pathname, width);
      for (const filter of ['week', 'festival', 'rave']) {
        const actual = await inspectFilter(filter);
        const expected = expectedFor(fixedDate, filter);
        const expectedPaths = expected.slice(0, 6).map((festival) => `${lang === 'en' ? '/en' : ''}/festivals/${festival.id}.html`);
        const expectedCount = `${expected.length} events · ${filter === 'week' ? 'this week' : filter}`;
        if (JSON.stringify(actual.links) !== JSON.stringify(expectedPaths)) failures.push(`${pathname} ${width}px ${filter}: links ${JSON.stringify(actual.links)} / expected ${JSON.stringify(expectedPaths)}`);
        if (actual.count !== expectedCount) failures.push(`${pathname} ${width}px ${filter}: count ${actual.count} / expected ${expectedCount}`);
      }
      const all = await inspectFilter('all');
      const allExpected = expectedFor(fixedDate, 'all');
      if (all.count !== `${allExpected.length} events · upcoming`) failures.push(`${pathname} ${width}px all: count ${all.count}`);
    }
  }
  await setFixedDate(`${emptyDate}T03:00:00.000Z`);
  await openPage(`http://127.0.0.1:${port}`, '/', 390);
  const empty = await inspectFilter('week');
  const expectedMessage = '今週開催のイベントはありません。';
  if (empty.empty !== expectedMessage) failures.push(`JA empty ${emptyDate}: ${JSON.stringify(empty.empty)}`);
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`  ✅ TOP THIS WEEK: JA/EN × 390/1440, ${expectedFor(fixedDate, 'week').length}件 / empty date ${emptyDate}`);
} finally {
  if (ws) ws.close();
  await stopProcess(browser);
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true });
}
