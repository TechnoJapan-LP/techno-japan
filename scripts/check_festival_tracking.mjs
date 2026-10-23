#!/usr/bin/env node
/* フェス詳細ページの行動計測を、gtag有り／無しの実ブラウザで確認する。 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.join(process.cwd(), 'LP');
const pagePath = '/festivals/circus.html';
const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const chromeCandidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => (
  candidate.includes('/')
    ? fs.existsSync(candidate)
    : spawnSync('which', [candidate]).status === 0
));

const fail = (message) => { console.log(`  ❌ ${message}`); };
const pass = (message) => { console.log(`  ✅ ${message}`); };

if (!chrome) {
  console.error('✗ Chrome/Chromium が見つかりません');
  process.exit(1);
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

function cdp(ws, method, params = {}) {
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

async function evaluate(ws, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description
      || result.exceptionDetails.text
      || 'ブラウザ内の評価に失敗しました';
    throw new Error(String(detail).split('\n')[0]);
  }
  return result.result?.value;
}

async function waitFor(ws, expression, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(ws, expression)) return true;
    await delay(100);
  }
  return false;
}

function probeSource(withGtag) {
  return `
    window.__tjCheckCalls = [];
    window.__tjCheckErrors = [];
    window.addEventListener('error', function(event) {
      window.__tjCheckErrors.push(event.message || 'window error');
    });
    window.__tjCheckConsoleError = console.error;
    console.error = function() {
      window.__tjCheckErrors.push(Array.prototype.join.call(arguments, ' '));
      window.__tjCheckConsoleError.apply(console, arguments);
    };
    ${withGtag ? `
      window.dataLayer = [];
      window.gtag = function() {
        var args = Array.prototype.slice.call(arguments);
        window.dataLayer.push(args);
        if (args[0] === 'event') {
          window.__tjCheckCalls.push({ name: args[1], params: args[2] || {} });
        }
      };
      Object.defineProperty(window, 'gtag', {
        writable: false,
        configurable: false,
      });
    ` : ''}
  `;
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  child.kill('SIGTERM');
  await new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 2000);
    child.once('close', finish);
  });

  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
  }
}

const server = http.createServer((req, res) => {
  let filePath;
  try {
    filePath = decodeURIComponent(new URL(req.url, 'http://check.local').pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (filePath === '/') filePath = pagePath;

  const file = path.join(ROOT, filePath);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
  });
  return res.end(fs.readFileSync(file));
});

async function openTarget(debugPort) {
  for (let i = 0; i < 60; i++) {
    await delay(100);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      const target = targets.find((item) => item.type === 'page');
      if (target) return target;
    } catch {
      // ChromeのDevTools HTTP endpointが開くまで待つ。
    }
  }
  throw new Error('Chrome DevTools のページに接続できません');
}

async function runBrowser(base, withGtag) {
  const debugPort = await freePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-festival-tracking-'));
  const browser = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--disable-extensions',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    'about:blank',
  ], { stdio: 'ignore' });
  let ws;

  try {
    const target = await openTarget(debugPort);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    await cdp(ws, 'Page.enable');
    await cdp(ws, 'Runtime.enable');
    await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', {
      source: probeSource(withGtag),
    });
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp(ws, 'Page.navigate', {
      url: `${base}${pagePath}`,
    });

    const loaded = await waitFor(
      ws,
      `document.readyState === 'complete'
        && !!document.querySelector('.festival-detail-page')
        && !!document.querySelector('.festival-program-section[data-tj-section="lineup"]')`,
    );
    if (!loaded) throw new Error('フェス詳細ページが10秒以内に初期化されませんでした');
    await delay(500);

    const navigationGuard = await evaluate(ws, `(() => {
      document.addEventListener('click', (event) => {
        const link = event.target.closest
          && event.target.closest('.festival-official-link, .related-card');
        if (link) event.preventDefault();
      }, true);
      return {
        official: !!document.querySelector('.festival-official-link'),
        related: !!document.querySelector('.related-card'),
      };
    })()`);
    if (!navigationGuard?.official) throw new Error('公式リンクが見つかりません');
    if (!navigationGuard?.related) throw new Error('関連フェスのカードが見つかりません');

    const clickTab = async (selector) => {
      const clicked = await evaluate(ws, `(() => {
        const button = document.querySelector(${JSON.stringify(selector)});
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error(`タブが見つかりません: ${selector}`);
      await delay(350);
    };
    const scrollSection = async (selector) => {
      const scrolled = await evaluate(ws, `(() => {
        const section = document.querySelector(${JSON.stringify(selector)});
        if (!section) return false;
        section.scrollIntoView({ block: 'center', behavior: 'auto' });
        return true;
      })()`);
      if (!scrolled) throw new Error(`セクションが見つかりません: ${selector}`);
      await delay(500);
    };

    await clickTab('#festival-tab-lineup');
    await clickTab('#festival-tab-editions');
    await clickTab('#festival-tab-overview');
    await scrollSection('.festival-faq');
    await scrollSection('.related-festivals');

    const clickedLinks = await evaluate(ws, `(() => {
      const official = document.querySelector('.festival-official-link');
      const related = document.querySelector('.related-card');
      official.click();
      related.click();
      return true;
    })()`);
    if (!clickedLinks) throw new Error('リンク操作に失敗しました');
    await delay(350);

    return await evaluate(ws, `({
      calls: window.__tjCheckCalls || [],
      errors: window.__tjCheckErrors || [],
    })`);
  } finally {
    if (ws) ws.close();
    await stopProcess(browser);
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;

let withGtag;
let withoutGtag;
const failures = [];
try {
  withGtag = await runBrowser(base, true);
  withoutGtag = await runBrowser(base, false);
} catch (error) {
  failures.push(`ブラウザ検査に失敗: ${error.message}`);
} finally {
  server.close();
}

if (!withGtag) failures.push('gtag有りの実ブラウザ結果を取得できない');
if (!withoutGtag) failures.push('gtag無しの実ブラウザ結果を取得できない');

if (withGtag) {
  const sectionCalls = withGtag.calls.filter((call) => call.name === 'festival_section_view');
  const sections = new Set(sectionCalls.map((call) => call.params.section));
  for (const required of ['lineup', 'editions', 'related']) {
    if (!sections.has(required)) failures.push(`セクション到達 ${required} が送られない`);
  }
  if (sectionCalls.some((call) => call.params.festival_id !== 'circus')) {
    failures.push('セクションイベントのfestival_idがcircusではない');
  }
  const counts = new Map();
  for (const call of sectionCalls) {
    counts.set(call.params.section, (counts.get(call.params.section) || 0) + 1);
  }
  for (const [section, count] of counts) {
    if (count > 1) failures.push(`セクション ${section} が${count}回送られる`);
  }
  const events = withGtag.calls.filter((call) => (
    call.name === 'festival_section_view' || call.name === 'festival_link_click'
  ));
  if (events.some((call) => call.params.festival_id !== 'circus')) {
    failures.push('フェス計測イベントにfestival_id: circusが無い');
  }
  if (!withGtag.calls.some((call) => (
    call.name === 'festival_link_click' && call.params.link_kind === 'official'
  ))) {
    failures.push('公式リンクのクリックイベントが無い');
  }
  if (!withGtag.calls.some((call) => (
    call.name === 'festival_link_click' && call.params.link_kind === 'related_festival'
  ))) {
    failures.push('関連フェスのクリックイベントが無い');
  }
  if (withGtag.errors.length) {
    failures.push(`gtag有り環境にコンソールエラー: ${withGtag.errors.join(' / ')}`);
  }
  if (!failures.length) {
    pass(`セクション ${[...sections].sort().join(' / ')}、公式・関連フェスのクリックを確認`);
  }
}

if (withoutGtag && withoutGtag.errors.length) {
  failures.push(`gtag無し環境にコンソールエラー: ${withoutGtag.errors.join(' / ')}`);
} else if (withoutGtag) {
  pass('gtag無し環境でもコンソールエラーなし');
}

if (failures.length) {
  failures.forEach(fail);
  if (withGtag) {
    console.log(`  gtag有りで回収したイベント: ${JSON.stringify(withGtag.calls)}`);
  }
  process.exit(1);
}
console.log('✅ フェス詳細の行動計測を実ブラウザで確認しました');
