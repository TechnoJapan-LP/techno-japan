#!/usr/bin/env node
/* 記事本文 h2 のモバイル折り返しを全記事・3幅で検査する。 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const LP = path.join(ROOT, 'LP');
const articleFiles = fs.readdirSync(path.join(LP, 'articles')).filter((file) => file.endsWith('.html')).sort();
const chromeCandidates = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0);
if (!chrome) throw new Error('Chrome/Chromium が見つかりません');

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, 'http://check.local').pathname).replace(/^\/+/, '');
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
  child.kill('SIGTERM'); await delay(300);
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
}

const katakana = /^[\u30a0-\u30ff]$/;
const badHead = /^[、。，．！？）」』ーぁぃぅぇぉっゃゅょァィゥェォッャュョ]/;
const onlyPunctuation = /^[、。，．！？）」』ー]+$/;

try {
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const debugPort = await freePort();
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-article-heading-'));
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
  const failures = [];
  for (const width of [360, 390, 430]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 3, mobile: true });
    for (const file of articleFiles) {
      await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/articles/${file}` });
      if (!await waitFor('document.readyState === "complete" && document.fonts.status === "loaded" && !!document.querySelector(".article-body")')) {
        failures.push(`${file} ${width}px: 読み込み待ちがタイムアウト`); continue;
      }
      const headings = await evaluate(`(() => {
        const japanese = /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\u3040-\\u309f\\u30a0-\\u30ff]/;
        const readLines = (heading) => {
          const lineThreshold = parseFloat(getComputedStyle(heading).fontSize) / 2;
          const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
          const chars = [];
          let node;
          while ((node = walker.nextNode())) {
            for (let i = 0; i < node.textContent.length; i += 1) {
              const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
              const rect = range.getBoundingClientRect();
              if (rect.width || rect.height) chars.push({ char: node.textContent[i], top: Math.round(rect.top * 10) / 10 });
            }
          }
          const lines = [];
          for (const item of chars) {
            let line = lines.find((candidate) => Math.abs(candidate.top - item.top) < lineThreshold);
            if (!line) { line = { top: item.top, text: '' }; lines.push(line); }
            line.text += item.char;
          }
          lines.sort((a, b) => a.top - b.top);
          return lines.map((line) => line.text);
        };
        return [...document.querySelectorAll('.article-body h2')].map((heading) => ({
          text: heading.textContent.trim(), lines: readLines(heading),
        })).filter((heading) => japanese.test(heading.text));
      })()`);
      for (const heading of headings) {
        const badLines = heading.lines.filter((line) => onlyPunctuation.test(line) || badHead.test(line));
        const brokenKatakana = heading.lines.slice(0, -1).some((line, index) => {
          const next = heading.lines[index + 1];
          const last = [...line].at(-1); const first = [...next].at(0);
          return katakana.test(last || '') && katakana.test(first || '') && last !== '・' && first !== '・';
        });
        if (badLines.length || brokenKatakana) failures.push(`${file} ${width}px: ${heading.text} / lines=${JSON.stringify(heading.lines)}`);
      }
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`  ✅ 記事 h2 の折り返し: ${articleFiles.length}記事 × 360/390/430px`);
} finally {
  if (ws) ws.close();
  await stopProcess(browser);
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (profileDir) fs.rmSync(profileDir, { recursive: true, force: true });
}
