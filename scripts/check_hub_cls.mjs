#!/usr/bin/env node
/*
 * ハブ／詳細ページの読み込み中 CLS を、遅い実機相当の条件で測る。
 * mock や headless の通常条件だけでは、JS ハイドレーション時のずれを
 * 見落とすため、実際の layout-shift entry とその source を記録する。
 * 毎ページ初回読み込みで測る理由: 2ページ目以降は HTTP キャッシュや
 * サービスワーカー（sw.js）の cache-first で描画が先に終わり、ずれが
 * 見えなくなる。2026-10-27 に実際に見逃した。
 */

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';

const ROOT = path.join(process.cwd(), 'LP');
const pages = [
  '/index.html', '/en/index.html',
  '/news.html', '/en/news.html',
  '/festivals.html', '/en/festivals.html',
  '/artists.html', '/en/artists.html',
  '/venues.html', '/en/venues.html',
  '/festivals/ala.html', '/artists/dj-nobu.html',
  '/venues/womb.html', '/articles/transcendence-2025-report.html',
];
const viewports = [
  { name: 'mobile', width: 412, height: 823, dpr: 1.75, mobile: true },
  { name: 'PC', width: 1350, height: 940, dpr: 1, mobile: false },
];
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
  '.xml': 'application/xml;charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.xml']);
const CLS_LIMIT = 0.05;
const CDP_TIMEOUT_MS = 20000;
const DOWNLOAD = 1600 * 1024 / 8;
const UPLOAD = 750 * 1024 / 8;
const startedAt = Date.now();

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
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (await evaluate(ws, 'document.readyState === "complete" && !!document.body')) return;
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
  const extension = path.extname(file);
  const acceptsGzip = /\bgzip\b/i.test(request.headers['accept-encoding'] || '');
  const shouldGzip = acceptsGzip && COMPRESSIBLE.has(extension);
  const headers = {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'Vary': 'Accept-Encoding',
  };
  let body = fs.readFileSync(file);
  if (shouldGzip) {
    body = gzipSync(body);
    headers['Content-Encoding'] = 'gzip';
  }
  response.writeHead(200, headers);
  response.end(body);
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

const observerScript = `(() => {
  const state = { value: 0, entries: [] };
  window.__tjCls = state;
  const describe = (source) => {
    const node = source.node;
    const rect = (value) => value ? {
      x: value.x, y: value.y, width: value.width, height: value.height,
    } : null;
    return {
      node: node ? {
        name: node.nodeName,
        id: node.id || '',
        className: typeof node.className === 'string' ? node.className : '',
        text: (node.textContent || '').trim().slice(0, 100),
      } : null,
      previousRect: rect(source.previousRect),
      currentRect: rect(source.currentRect),
    };
  };
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (entry.hadRecentInput) return;
      state.value += entry.value;
      state.entries.push({
        value: entry.value,
        startTime: entry.startTime,
        sources: (entry.sources || []).map(describe),
      });
    });
  }).observe({ type: 'layout-shift', buffered: true });
})();`;

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const browserPath = chromePath();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-hub-cls-'));
activeProfiles.add(profileDir);
const browser = spawn(browserPath, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
  `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank',
], { stdio: 'ignore' });
activeBrowsers.add(browser);
let ws;
const failures = [];
let checked = 0;

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
  await cdp(ws, 'Network.enable');
  await cdp(ws, 'Network.setBypassServiceWorker', { bypass: true });
  await cdp(ws, 'Network.setCacheDisabled', { cacheDisabled: true });
  await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: observerScript });

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
    await cdp(ws, 'Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp(ws, 'Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: DOWNLOAD,
      uploadThroughput: UPLOAD,
    });

    for (const page of pages) {
      try {
        await cdp(ws, 'Page.navigate', { url: `${base}${page}` });
        await waitForPage(ws);
        await delay(4000);
        const result = await evaluate(ws, `(() => {
          const cls = window.__tjCls || { value: 0, entries: [] };
          const cachedResources = performance.getEntriesByType('resource')
            .filter((entry) => {
              const url = new URL(entry.name, location.href);
              return url.origin === location.origin
                && /\\.(?:css|js)$/i.test(url.pathname)
                && entry.transferSize === 0;
            })
            .map((entry) => new URL(entry.name, location.href).pathname);
          return { ...cls, cachedResources };
        })()`);
        checked += 1;
        if (result.cachedResources.length) {
          failures.push({ viewport: viewport.name, page, result });
          console.log(`❌ ${viewport.name} ${page}: 検査条件の不備（キャッシュ/サービスワーカー）`);
          for (const resource of result.cachedResources) {
            console.log(`   - ${resource}`);
          }
        } else if (result.value > CLS_LIMIT) {
          failures.push({ viewport: viewport.name, page, result });
          console.log(`❌ ${viewport.name} ${page}: CLS ${result.value.toFixed(3)}`);
          for (const entry of result.entries) {
            console.log(`   shift ${entry.value.toFixed(3)} @ ${entry.startTime.toFixed(0)}ms`);
            for (const source of entry.sources) {
              console.log(`   - ${source.node?.name || 'unknown'}#${source.node?.id || ''}.${source.node?.className || ''}`);
              console.log(`     previous=${JSON.stringify(source.previousRect)} current=${JSON.stringify(source.currentRect)}`);
            }
          }
        } else {
          console.log(`✅ ${viewport.name} ${page}: CLS ${result.value.toFixed(3)}`);
        }
      } catch (error) {
        failures.push({ viewport: viewport.name, page, error: error.message });
        console.log(`❌ ${viewport.name} ${page}: ${error.message}`);
      }
    }
  }
} finally {
  if (ws) ws.close();
  await stopProcess(browser);
  activeBrowsers.delete(browser);
  activeProfiles.delete(profileDir);
  await new Promise((resolve) => server.close(resolve));
  removeProfileDir(profileDir);
  console.log(`⏱ 所要時間: ${((Date.now() - startedAt) / 1000).toFixed(1)}秒`);
}

if (failures.length) {
  console.log(`❌ CLS 検査失敗: ${failures.length}件 / ${checked}ページ`);
  process.exit(1);
}
console.log(`✅ CLS 検査成功: ${checked}ページ（しきい値 ${CLS_LIMIT} 以下）`);
