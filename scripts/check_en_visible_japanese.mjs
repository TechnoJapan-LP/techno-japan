#!/usr/bin/env node
/*
 * EN の全ページで画面に見える日本語を数え、増えたら失敗させる検査。
 * REDESIGN_SPEC フェーズ8の回帰ガードで、固有名の日本語表記は基準に入れて
 * 許す。データの英訳が入って日本語が減ったときは --update で基準を縮める。
 * 基準ファイルの更新は意図した変更のときだけ行うこと。
 * 速さのために画像・書体を止めている（文字の検査には関係ない）。
 * 背景の無限アニメーションで Chrome の CPU を使い切らないよう、各ページで
 * prefers-reduced-motion を指定してから検査する。
 *
 * ローカルサーバーと CDP の起動・後片付けは check_page_scroll.mjs 等と同じ。
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.join(process.cwd(), 'LP');
const BASELINE_PATH = path.join(process.cwd(), 'scripts/fixtures/en-visible-japanese-baseline.json');
const UPDATE = process.argv.includes('--update');
const CDP_TIMEOUT_MS = 20000;
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
};

function chromePath() {
  for (const candidate of [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
  ].filter(Boolean)) {
    if (candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0) {
      return candidate;
    }
  }
  throw new Error('Chrome/Chromium が見つかりません');
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.removeEventListener('message', onMessage);
      const error = new Error(`CDPタイムアウト: ${method}`);
      error.code = 'CDP_TIMEOUT';
      reject(error);
    }, CDP_TIMEOUT_MS);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      callback(value);
    };
    const onMessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        finish(reject, error);
        return;
      }
      if (message.id !== id) return;
      if (message.error) finish(reject, new Error(JSON.stringify(message.error)));
      else finish(resolve, message.result);
    };
    ws.addEventListener('message', onMessage);
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      finish(reject, error);
    }
  });
}
cdp.nextId = 0;
const skipTopIntro = `try { if (location.pathname === '/' || location.pathname === '/index.html' || location.pathname === '/en/' || location.pathname === '/en/index.html') sessionStorage.setItem('tj-intro', '1'); } catch (e) {}`;

async function evaluate(ws, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'ページ評価に失敗しました');
  }
  return result.result?.value;
}

async function waitForPage(ws) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate(ws, 'document.readyState === "complete" && !!document.body')) {
      await delay(300);
      return;
    }
    await delay(100);
  }
  throw new Error('ページの読み込みが完了しませんでした');
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 2000);
    child.once('close', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once('close', resolve);
    });
  }
}

function removeProfileDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`⚠️ 一時プロフィールの削除に失敗しました: ${error.message}`);
  }
}

function htmlFiles(dir, prefix = '') {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...htmlFiles(path.join(dir, entry.name), relative));
    else if (entry.isFile() && entry.name.endsWith('.html')) result.push(relative);
  }
  return result;
}

function isRedirectPage(relative) {
  const html = fs.readFileSync(path.join(ROOT, relative), 'utf8').slice(0, 4000);
  return /<meta\s+http-equiv=["']refresh["']/i.test(html);
}

const collectScript = `(() => {
  const japanese = /[\\u3040-\\u30ff\\u3400-\\u9fff\\uff66-\\uff9f]/;
  const visible = (element) => {
    if (!element) return false;
    const result = element.checkVisibility
      ? element.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: false })
      : !!element.getClientRects().length;
    return result && !!element.getClientRects().length;
  };
  const location = (element) => {
    if (!element) return 'unknown';
    const name = element.tagName.toLowerCase();
    const id = element.id ? '#' + element.id : '';
    const classes = typeof element.className === 'string'
      ? element.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).map((value) => '.' + value).join('')
      : '';
    return name + id + classes;
  };
  const found = new Map();
  const add = (text, element) => {
    const value = String(text || '').replace(/\\s+/g, ' ').trim();
    if (!value || !japanese.test(value) || !visible(element)) return;
    if (!found.has(value)) found.set(value, { text: value, element: location(element) });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const element = node.parentElement;
    if (!element || element.closest('script,style,noscript,template,.ssr-link-list')) continue;
    add(node.textContent, element);
  }
  document.querySelectorAll('input, textarea').forEach((element) => {
    if (element.placeholder && visible(element)) add(element.placeholder, element);
  });
  document.querySelectorAll('input[type="submit"], input[type="button"]').forEach((element) => {
    if (element.value && visible(element)) add(element.value, element);
  });
  document.querySelectorAll('select').forEach((select) => {
    if (!visible(select)) return;
    select.querySelectorAll('option').forEach((option) => add(option.textContent, select));
  });
  return [...found.values()].sort((a, b) => a.text.localeCompare(b.text, 'ja'));
})()`;

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

const activeBrowsers = new Set();
const activeProfiles = new Set();
let cleanupDone = false;
function cleanupSync() {
  if (cleanupDone) return;
  cleanupDone = true;
  for (const child of activeBrowsers) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
  if (server.listening) server.close();
  for (const profileDir of activeProfiles) removeProfileDir(profileDir);
}
process.on('exit', cleanupSync);
process.on('SIGTERM', () => {
  cleanupSync();
  process.exit(128 + 15);
});
process.on('SIGINT', () => {
  cleanupSync();
  process.exit(128 + 2);
});

async function runWorker(workerPages, base, browser, workerNumber) {
  const debugPort = await freePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-en-visible-japanese-'));
  activeProfiles.add(profileDir);
  const child = spawn(browser, [
    '--headless=new', '--no-sandbox', '--no-first-run', '--disable-extensions',
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank',
  ], { stdio: 'ignore' });
  activeBrowsers.add(child);
  let ws;
  const results = [];
  const failures = [];
  try {
    let target;
    for (let attempt = 0; attempt < 100 && !target; attempt += 1) {
      await delay(100);
      try {
        const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
        target = targets.find((item) => item.type === 'page');
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
    await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: skipTopIntro });
    await cdp(ws, 'Network.enable');
    await cdp(ws, 'Network.setBypassServiceWorker', { bypass: true });
    await cdp(ws, 'Network.setBlockedURLs', {
      urls: [
        '*.webp', '*.png', '*.jpg', '*.jpeg', '*.gif', '*.avif', '*.mp4',
        '*.woff2', '*.woff', '*fonts.googleapis.com*', '*fonts.gstatic.com*',
        '*googletagmanager.com*', '*google-analytics.com*',
        '*basemaps.cartocdn.com*', '*tile.openstreetmap.org*',
      ],
    });
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
    });

    let completed = 0;
    for (const page of workerPages) {
      try {
        await cdp(ws, 'Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        });
        await cdp(ws, 'Page.navigate', { url: `${base}/en/${page}` });
        await waitForPage(ws);
        let y = 0;
        while (true) {
          const dimensions = await evaluate(ws, `({ height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight), viewport: window.innerHeight })`);
          await evaluate(ws, `window.scrollTo(0, ${Math.min(y, Math.max(0, dimensions.height - dimensions.viewport))})`);
          await delay(40);
          if (y >= dimensions.height) break;
          y += 900;
        }
        await evaluate(ws, 'window.scrollTo(0, 0)');
        await delay(100);
        results.push({ page, entries: await evaluate(ws, collectScript) });
      } catch (error) {
        const message = error.code === 'CDP_TIMEOUT' ? `タイムアウト（${error.message}）` : error.message;
        failures.push({ page, error: message });
        console.log(`❌ worker ${workerNumber}: ${page}: ${message}`);
      }
      completed += 1;
      if (completed % 25 === 0) console.log(`worker ${workerNumber}: ${completed}/${workerPages.length}`);
    }
  } finally {
    if (ws) ws.close();
    await stopProcess(child);
    activeBrowsers.delete(child);
    activeProfiles.delete(profileDir);
    removeProfileDir(profileDir);
  }
  return { results, failures };
}

const startedAt = Date.now();
const browser = chromePath();
const allPages = htmlFiles(path.join(ROOT, 'en'))
  .filter((relative) => !isRedirectPage(path.join('en', relative)))
  .sort();
if (!allPages.length) throw new Error('LP/en/**/*.html に検査対象がありません');

let baseline = null;
if (fs.existsSync(BASELINE_PATH)) {
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch (error) {
    throw new Error(`基準ファイルを読めません: ${error.message}`);
  }
} else if (!UPDATE) {
  console.error(`❌ 基準ファイルがありません: ${BASELINE_PATH}`);
  console.error('   基準を生成するには node scripts/check_en_visible_japanese.mjs --update');
  process.exit(1);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const requestedWorkers = Number.parseInt(process.env.TJ_EN_JA_WORKERS || '4', 10);
const workerCount = Number.isFinite(requestedWorkers) && requestedWorkers > 0
  ? Math.min(requestedWorkers, allPages.length)
  : Math.min(4, allPages.length);
const chunks = Array.from({ length: workerCount }, () => []);
allPages.forEach((page, index) => chunks[index % workerCount].push(page));
const currentEntries = {};
const pageFailures = [];
try {
  const settled = await Promise.allSettled(chunks.map((pages, index) => runWorker(pages, base, browser, index + 1)));
  const rejected = settled.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  for (const item of settled) {
    for (const result of item.value.results) currentEntries[result.page] = result.entries;
    pageFailures.push(...item.value.failures);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
const current = Object.fromEntries(allPages.map((page) => [
  page,
  (currentEntries[page] || []).map((entry) => entry.text).sort((a, b) => a.localeCompare(b, 'ja')),
]));

if (pageFailures.length) {
  console.error(`❌ EN 可視日本語検査で ${pageFailures.length}ページ失敗`);
  pageFailures.forEach(({ page, error }) => console.error(`  ${page}: ${error}`));
  process.exitCode = 1;
} else if (UPDATE) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`✅ EN 可視日本語の基準を更新: ${allPages.length}ページ / ${Object.values(current).reduce((total, values) => total + values.length, 0)}件`);
} else {
  const failures = [];
  const reductions = [];
  for (const page of allPages) {
    const expected = new Set(baseline[page] || []);
    const actual = new Set(current[page] || []);
    for (const entry of currentEntries[page] || []) {
      if (!expected.has(entry.text)) failures.push({ page, ...entry });
    }
    for (const text of expected) {
      if (!actual.has(text)) reductions.push({ page, text });
    }
  }
  for (const page of Object.keys(baseline || {})) {
    if (!current[page]) {
      for (const text of baseline[page]) reductions.push({ page, text });
    }
  }
  if (failures.length) {
    console.error(`❌ EN 可視日本語が基準より増加: ${failures.length}件`);
    failures.forEach(({ page, text, element }) => console.error(`  ${page}: ${text} (${element})`));
    process.exitCode = 1;
  } else {
    console.log(`✅ EN 可視日本語: ${allPages.length}ページ確認、増加 0件`);
  }
  if (reductions.length) {
    console.log(`ℹ️ 基準から ${reductions.length}件減少（失敗にはしません）`);
    reductions.forEach(({ page, text }) => console.log(`  減少 ${page}: ${text}`));
  }
  console.log('ℹ️ 基準を更新するには --update（意図した変更のときだけ使用）');
}
console.log(`⏱ 所要時間: ${((Date.now() - startedAt) / 1000).toFixed(1)}秒（ブラウザ${workerCount}並行）`);
