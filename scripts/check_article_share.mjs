#!/usr/bin/env node
/* JA/EN の記事詳細を実ブラウザで描画し、シェアボタンと SVG の大きさを確認する。 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const article = fs.readdirSync(path.join(LP, 'articles')).find((file) => file.endsWith('.html'));
if (!article) throw new Error('記事詳細ページがありません');

const pages = [`/articles/${article}`, `/en/articles/${article}`];
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

if (!chrome) throw new Error('Chrome/Chromium が見つかりません');

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

async function waitFor(ws, expression, timeout = 5500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(ws, expression)) return true;
    await delay(100);
  }
  return false;
}

async function openTarget(debugPort) {
  for (let i = 0; i < 60; i += 1) {
    await delay(100);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      const target = targets.find((item) => item.type === 'page');
      if (target) return target;
    } catch {
      // Chrome の DevTools HTTP endpoint が開くまで待つ。
    }
  }
  throw new Error('Chrome DevTools のページに接続できません');
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
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

const server = http.createServer((request, response) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  const file = path.join(LP, requestPath);
  if (!file.startsWith(`${LP}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const debugPort = await freePort();
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-article-share-'));
const browser = spawn(chrome, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--no-first-run',
  '--disable-extensions',
  '--disable-dev-shm-usage',
  `--user-data-dir=${profileDir}`,
  `--remote-debugging-port=${debugPort}`,
  'about:blank',
], { stdio: 'ignore' });
let ws;
const results = [];
const failures = [];
const base = `http://127.0.0.1:${server.address().port}`;

try {
  const target = await openTarget(debugPort);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');

  for (const mobile of [false, true]) {
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: mobile ? 390 : 1280,
      height: mobile ? 844 : 800,
      deviceScaleFactor: mobile ? 2 : 1,
      mobile,
    });
    for (const page of pages) {
      await cdp(ws, 'Page.navigate', { url: `${base}${page}` });
      const loaded = await waitFor(ws, `document.readyState === 'complete'
        && document.querySelectorAll('.article-share .share-btn').length > 0`);
      if (!loaded) throw new Error(`${page} のシェアボタンが描画されませんでした`);
      await delay(100);
      const value = await evaluate(ws, `(() => {
        const buttons = [...document.querySelectorAll('.article-share .share-btn')];
        const rect = (element) => {
          const box = element.getBoundingClientRect();
          return [box.width, box.height];
        };
        return {
          page: location.pathname,
          button: buttons.map(rect),
          svg: buttons.map((button) => rect(button.querySelector('svg'))),
        };
      })()`);
      results.push({ ...value, mobile });
    }
  }
} catch (error) {
  failures.push(`ブラウザ検査に失敗: ${error.message}`);
} finally {
  if (ws) ws.close();
  await stopProcess(browser);
  server.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
}

for (const value of results) {
  const dimensions = value.button;
  const first = dimensions[0];
  const aligned = first && dimensions.every(([width, height]) => (
    Math.abs(width - first[0]) <= 0.01 && Math.abs(height - first[1]) <= 0.01
  ));
  if (!dimensions.length || dimensions.some((size) => size.some((dimension) => dimension > 44.01))) {
    failures.push(`${value.page} (${value.mobile ? 'スマホ' : 'PC'}): share button ${JSON.stringify(dimensions)}`);
  }
  if (!value.svg.length || value.svg.some((size) => !size || size.some((dimension) => dimension > 14.01))) {
    failures.push(`${value.page} (${value.mobile ? 'スマホ' : 'PC'}): share SVG ${JSON.stringify(value.svg)}`);
  }
  if (!aligned) failures.push(`${value.page} (${value.mobile ? 'スマホ' : 'PC'}): share button sizes are not aligned ${JSON.stringify(dimensions)}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`✅ article share buttons: JA/EN × PC/スマホ rendered within 44px; SVG within 14px (${article})`);
