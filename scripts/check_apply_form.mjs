#!/usr/bin/env node
/* APPLY の HTML / 公開 Google Form fixture と、送信 payload を検査する。
   ブラウザ検査では localhost 上で fetch を差し替えるため、外部送信は行わない。 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/apply-google-form.json', 'utf8'));
const pages = ['LP/submit.html', 'LP/en/submit.html'];
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attr = (tag, name) => tag.match(new RegExp(`\\b${escapeRegExp(name)}="([^"]*)"`))?.[1] ?? null;
const hasRequired = tag => /\brequired(?:\s|=|>|$)/.test(tag);
const fail = message => { throw new Error(message); };

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  if (!/connect-src[^;]*https:\/\/docs\.google\.com/.test(html)) fail(`${page}: CSP connect-src に docs.google.com がない`);
  if (!/connect-src[^;]*https:\/\/formsubmit\.co/.test(html)) fail(`${page}: CSP connect-src に formsubmit.co がない`);
  for (const question of fixture.questions) {
    const entry = escapeRegExp(question.entry);
    const inputTags = [...html.matchAll(new RegExp(`<input\\b[^>]*\\bname="${entry}"[^>]*>`, 'g'))].map(match => match[0]);
    const textareaTags = [...html.matchAll(new RegExp(`<textarea\\b[^>]*\\bname="${entry}"[^>]*>`, 'g'))].map(match => match[0]);
    const selectMatch = html.match(new RegExp(`<select\\b[^>]*\\bname="${entry}"[^>]*>[\\s\\S]*?<\\/select>`));
    const tags = [...inputTags, ...textareaTags, ...(selectMatch ? [selectMatch[0]] : [])];
    if (!tags.length) fail(`${page}: ${question.entry} がない`);

    if (question.type === 'short_text' && !inputTags.some(tag => ['text', 'url', null].includes(attr(tag, 'type')))) fail(`${page}: ${question.entry} は text input ではない`);
    if (question.type === 'date' && !inputTags.some(tag => attr(tag, 'type') === 'date')) fail(`${page}: ${question.entry} は date input ではない`);
    if (question.type === 'paragraph' && !textareaTags.length) fail(`${page}: ${question.entry} は textarea ではない`);
    if (question.type === 'dropdown' && !selectMatch) fail(`${page}: ${question.entry} は select ではない`);
    if (question.type === 'checkbox' && !inputTags.some(tag => attr(tag, 'type') === 'checkbox')) fail(`${page}: ${question.entry} は checkbox ではない`);

    const required = tags.some(hasRequired);
    if (required !== question.required) fail(`${page}: ${question.entry} の required が fixture と違う`);

    if (question.type === 'dropdown') {
      const rawOptions = [...selectMatch[0].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(match => ({attrs: match[1], value: attr(match[1], 'value'), text: match[2].trim()}));
      const placeholder = page.startsWith('LP/en/') ? 'Select' : '選択してください';
      if (rawOptions[0]?.value !== '' || rawOptions[0]?.text !== placeholder || !/\bselected(?:\s|=|>|$)/.test(rawOptions[0]?.attrs || '')) {
        fail(`${page}: ${question.entry} の先頭に selected な空の選択肢がない`);
      }
      const options = rawOptions.filter(option => option.value !== '').map(({value, text}) => ({value, text}));
      const expected = question.options.map(value => ({value, text: value}));
      if (JSON.stringify(options) !== JSON.stringify(expected)) fail(`${page}: ${question.entry} の選択肢が fixture と違う`);
    }
    if (question.type === 'checkbox') {
      const options = inputTags.filter(tag => attr(tag, 'type') === 'checkbox').map(tag => attr(tag, 'value'));
      if (JSON.stringify(options) !== JSON.stringify(question.options)) fail(`${page}: ${question.entry} の checkbox 選択肢が fixture と違う`);
    }
  }
}

const script = fs.readFileSync('LP/submit-form.js', 'utf8');
if (!script.includes(fixture.action)) fail('submit-form.js: fixture.action へ送信していない');
if (!/fetch\(\s*['"]https:\/\/docs\.google\.com\/forms\/d\/e\//.test(script)) fail('submit-form.js: Google Form への fetch がない');
if (!/method:\s*['"]POST['"]/.test(script) || !/mode:\s*['"]no-cors['"]/.test(script)) fail('submit-form.js: POST/no-cors がない');
if (!/application\/x-www-form-urlencoded/.test(script)) fail('submit-form.js: Content-Type が違う');
if (!/body\.set\(['"]fvv['"],\s*['"]1['"]\)/.test(script) || !/body\.set\(['"]pageHistory['"],\s*['"]0['"]\)/.test(script)) fail('submit-form.js: fvv/pageHistory がない');
if (!script.includes('https://formsubmit.co/ajax/press@techno-japan.media')) fail('submit-form.js: FormSubmit AJAX の宛先がない');
if (!/Content-Type['"]:\s*['"]application\/json/.test(script) || !/Accept\s*:\s*['"]application\/json/.test(script)) fail('submit-form.js: FormSubmit のJSONヘッダーがない');
if (!/JSON\.stringify\(formSubmitPayload\(\)\)/.test(script)) fail('submit-form.js: 16問のJSON payloadを送っていない');

const ROOT = path.join(process.cwd(), 'LP');
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json;charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};
const chromeCandidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'
].filter(Boolean);
const chrome = chromeCandidates.find(candidate => (
  candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0
));
if (!chrome) console.warn('⚠️ APPLYの実ブラウザ検査: Chrome/Chromiumが見つからないため静的検査のみ');

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
    awaitPromise: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'APPLYブラウザ評価に失敗しました');
  return result.result?.value;
}

const applyServer = http.createServer((request, response) => {
  let requestPath;
  try { requestPath = decodeURIComponent(new URL(request.url, 'http://check.local').pathname); } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (requestPath === '/') requestPath = '/submit.html';
  const file = path.join(ROOT, requestPath);
  if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

const fetchProbe = `
  window.__applyFetchCalls = [];
  window.fetch = function(url, options) {
    var body = options && options.body;
    if (body && typeof body.entries === 'function') body = Array.from(body.entries());
    window.__applyFetchCalls.push({
      url: String(url),
      method: options && options.method,
      mode: options && options.mode,
      headers: options && options.headers,
      body: body
    });
    return Promise.resolve({ ok: true, status: 200, type: 'opaque' });
  };
`;

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

async function runApplyBrowserCheck() {
  let port;
  try {
    port = await freePort();
    await new Promise((resolve, reject) => {
      applyServer.once('error', reject);
      applyServer.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.warn('⚠️ APPLYの実ブラウザ検査: localhostにbindできないため静的検査のみ');
      return false;
    }
    throw error;
  }
  const debugPort = await freePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-apply-form-'));
  const browser = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank'
  ], { stdio: 'ignore' });
  let ws;
  try {
    let target;
    for (let attempt = 0; attempt < 60 && !target; attempt += 1) {
      await delay(100);
      try {
        const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
        target = targets.find(item => item.type === 'page');
      } catch {}
    }
    if (!target) throw new Error('Chrome DevTools のページに接続できません');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });
    await cdp(ws, 'Page.enable');
    await cdp(ws, 'Runtime.enable');
    await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: fetchProbe });

    for (const page of pages) {
      await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}/${page.replace(/^LP\//, '')}` });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (await evaluate(ws, 'document.readyState === "complete" && !!document.querySelector("#apply-form")')) break;
        await delay(100);
      }
      const result = await evaluate(ws, `(() => {
        const form = document.querySelector('#apply-form');
        if (!form) return { error: 'apply form missing' };
        const fields = [...form.querySelectorAll('[data-question]')];
        fields.forEach((field, index) => {
          const controls = [...field.querySelectorAll('input, textarea, select')];
          const checkboxes = controls.filter(control => control.type === 'checkbox');
          if (checkboxes.length) {
            checkboxes[0].checked = true;
            checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            const control = controls[0];
            if (control.type === 'date') control.value = index === 1 ? '2026-11-01' : '2026-11-02';
            else if (control.tagName === 'SELECT') control.value = control.options[1].value;
            else control.value = index === 0 ? 'Fixture Festival' : 'Fixture answer ' + (index + 1);
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        form.requestSubmit();
        return { labels: fields.map(field => (field.querySelector('label, legend')?.textContent || '').replace(/^\\s*\\d+\\s*/, '').trim()) };
      })()`);
      if (result?.error) fail(`${page}: ${result.error}`);
      await delay(250);
      const calls = await evaluate(ws, 'window.__applyFetchCalls');
      const google = calls?.find(call => call.url.includes('docs.google.com/forms/d/e/'));
      const formSubmit = calls?.find(call => call.url === 'https://formsubmit.co/ajax/press@techno-japan.media');
      if (!google || google.method !== 'POST' || google.mode !== 'no-cors') fail(`${page}: Google Form の送信が変わった`);
      const googleEntries = new Map(google?.body || []);
      for (const question of fixture.questions) {
        if (question.type === 'date') {
          for (const suffix of ['_year', '_month', '_day']) {
            if (!googleEntries.has(`${question.entry}${suffix}`)) fail(`${page}: Google Form の日付項目 ${question.entry}${suffix} がない`);
          }
        } else if (!googleEntries.has(question.entry)) {
          fail(`${page}: Google Form の ${question.entry} がない`);
        }
      }
      if (!formSubmit) fail(`${page}: FormSubmit の AJAX 送信がない`);
      if (formSubmit?.method !== 'POST') fail(`${page}: FormSubmit がPOSTではない`);
      if (formSubmit?.headers?.['Content-Type'] !== 'application/json' || formSubmit?.headers?.Accept !== 'application/json') {
        fail(`${page}: FormSubmit のJSONヘッダーが違う`);
      }
      let payload;
      try { payload = JSON.parse(formSubmit.body); } catch { payload = null; }
      if (!payload) fail(`${page}: FormSubmit のJSONが解析できない`);
      if (payload?._template !== 'table') fail(`${page}: FormSubmit の _template がtableではない`);
      const english = page.includes('/en/');
      const subject = english ? 'TECHNO JAPAN — Listing application: Fixture Festival' : 'TECHNO JAPAN — 掲載申請: Fixture Festival';
      if (payload?._subject !== subject) fail(`${page}: FormSubmit の _subject が違う`);
      for (const label of result.labels || []) if (!(label in (payload || {}))) fail(`${page}: FormSubmit に「${label}」がない`);

      await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}/${page.replace(/^LP\//, '')}` });
      await delay(500);
      const honeypotCalls = await evaluate(ws, `(() => {
        const form = document.querySelector('#apply-form');
        const fields = [...form.querySelectorAll('[data-question]')];
        fields.forEach((field, index) => {
          const control = field.querySelector('input, textarea, select');
          if (!control) return;
          if (control.type === 'checkbox') control.checked = true;
          else if (control.tagName === 'SELECT') { control.value = control.options[1].value; control.dispatchEvent(new Event('change', { bubbles: true })); }
          else if (control.type === 'date') control.value = '2026-11-01';
          else control.value = index === 0 ? 'Fixture Festival' : 'Fixture answer ' + (index + 1);
        });
        document.querySelector('[name="website"]').value = 'bot';
        form.requestSubmit();
        return true;
      })()`);
      if (!honeypotCalls) fail(`${page}: ハニーポット検査の送信操作に失敗`);
      await delay(150);
      const callsAfterHoneypot = await evaluate(ws, 'window.__applyFetchCalls');
      if (callsAfterHoneypot?.length) fail(`${page}: ハニーポット入力時に送信された`);
    }
  } finally {
    if (ws) ws.close();
    await stopProcess(browser);
    applyServer.close();
    removeProfileDir(profileDir);
  }
  return true;
}

const browserChecked = chrome ? await runApplyBrowserCheck() : false;
console.log(browserChecked
  ? `APPLY form OK: ${fixture.questions.length}問 × ${pages.length}ページ、Google/FormSubmitを差し替えて送信内容を確認（実送信なし）`
  : `APPLY form OK: ${fixture.questions.length}問 × ${pages.length}ページ、静的検査済み（localhost制約のためブラウザ送信検査は未実行・実送信なし）`);
