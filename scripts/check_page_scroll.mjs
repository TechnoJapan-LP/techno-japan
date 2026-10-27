#!/usr/bin/env node
/*
 * 全ページの実ブラウザスクロールを、PC とタッチ端末相当で確認する。
 * フォーム送信や外部サービスへの POST は行わない。
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.join(process.cwd(), 'LP');
const pages = [
  '/', '/news.html', '/festivals.html', '/artists.html', '/venues.html',
  '/en/index.html', '/en/news.html', '/en/festivals.html', '/en/artists.html', '/en/venues.html',
  '/festivals/circus.html', '/artists/acid-pauli.html', '/venues/liquidroom.html',
  '/articles/japan-festival-2026-october.html', '/writers/masafumi-take.html',
  '/en/festivals/circus.html', '/en/artists/acid-pauli.html', '/en/venues/liquidroom.html',
  '/en/articles/japan-festival-2026-october.html', '/en/writers/masafumi-take.html',
  '/about.html', '/en/about.html', '/submit.html', '/en/submit.html',
  '/writers.html', '/en/writers.html', '/favorites.html', '/en/favorites.html', '/404.html'
];
const viewports = [
  { name: 'PC', width: 1280, height: 900, dpr: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dpr: 3, mobile: true }
];
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};

function chromePath() {
  for (const candidate of [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'
  ].filter(Boolean)) {
    if (candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0) {
      return candidate;
    }
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

function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMessage = event => {
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
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || '評価に失敗しました');
  }
  return result.result?.value;
}

async function waitForPage(ws) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const loaded = await evaluate(ws, 'document.readyState === "complete" && !!document.body');
    if (loaded) {
      await delay(500);
      return;
    }
    await delay(100);
  }
  throw new Error('ページの読み込みが完了しませんでした');
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 2000);
    child.once('close', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      child.once('close', resolve);
    });
  }
}

function removeProfileDir(dir) {
  try {
    fs.rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    console.warn(`⚠️ 一時プロフィールの削除に失敗しました（検査結果には影響しません）: ${error.message}`);
  }
}

const server = http.createServer((request, response) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(request.url, 'http://check.local').pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (requestPath === '/') requestPath = '/index.html';
  const file = path.join(ROOT, requestPath);
  if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

async function checkScroll(ws, base, viewport, page) {
  await cdp(ws, 'Page.navigate', { url: `${base}${page}` });
  await waitForPage(ws);
  const dimensions = await evaluate(ws, `({
    height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    viewport: window.innerHeight
  })`);
  if (!dimensions || dimensions.height <= dimensions.viewport + 20) {
    return { skipped: true, reason: '短いページ' };
  }

  await evaluate(ws, 'scrollTo(0, 0)');
  await delay(80);
  await cdp(ws, 'Input.dispatchMouseEvent', {
    type: 'mouseWheel', x: viewport.width / 2, y: viewport.height / 2, deltaY: 650, deltaX: 0
  });
  await delay(180);
  const wheelY = await evaluate(ws, 'window.scrollY');

  let touchY = null;
  if (viewport.mobile) {
    await evaluate(ws, 'scrollTo(0, 0)');
    await delay(80);
    const x = viewport.width / 2;
    const y = viewport.height * 0.78;
    await cdp(ws, 'Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }]
    });
    for (let i = 1; i <= 8; i += 1) {
      await cdp(ws, 'Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - i * 60 }]
      });
      await delay(16);
    }
    await cdp(ws, 'Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(180);
    touchY = await evaluate(ws, 'window.scrollY');
  }

  return { skipped: false, wheelY, touchY, height: dimensions.height, viewport: dimensions.viewport };
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const chrome = chromePath();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-page-scroll-'));
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
  `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank'
], { stdio: 'ignore' });
let ws;
const failures = [];
let checked = 0;
let skipped = 0;
let failed = 0;

try {
  let target;
  for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
    await delay(100);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      target = targets.find(item => item.type === 'page');
    } catch {
      // DevTools endpoint が開くまで待つ。
    }
  }
  if (!target) throw new Error('Chrome DevTools のページに接続できません');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');

  for (const viewport of viewports) {
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.dpr,
      mobile: viewport.mobile,
    });
    await cdp(ws, 'Emulation.setTouchEmulationEnabled', viewport.mobile
      ? { enabled: true, maxTouchPoints: 5 }
      : { enabled: false });
    for (const page of pages) {
      try {
        const result = await checkScroll(ws, base, viewport, page);
        if (result.skipped) {
          skipped += 1;
          continue;
        }
        checked += 1;
        const pageFailures = [];
        if (result.wheelY <= 0) pageFailures.push(`${viewport.name} ${page}: mouseWheel で scrollY が増えない`);
        if (viewport.mobile && result.touchY <= 0) {
          pageFailures.push(`${viewport.name} ${page}: タッチスワイプで scrollY が増えない`);
        }
        if (pageFailures.length) {
          failed += 1;
          failures.push(...pageFailures);
        }
      } catch (error) {
        failed += 1;
        failures.push(`${viewport.name} ${page}: ${error.message}`);
      }
    }
  }
} finally {
  if (ws) ws.close();
  await stopProcess(browser);
  server.close();
  removeProfileDir(profileDir);
}

if (failures.length) {
  failures.forEach(message => console.error(`❌ ${message}`));
  process.exit(1);
}
console.log(`✅ ページスクロール: ${checked}ページ確認、${failed}ページ失敗、${skipped}ページは短いため対象外（PC / 390pxタッチ）`);
