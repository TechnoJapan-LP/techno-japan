#!/usr/bin/env node
/* Regression fixture for the NEWS flash display rules shared by TOP, NEWS, and detail generation. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import fs from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const top = fs.readFileSync('LP/top-phase2.js', 'utf8');
const news = fs.readFileSync('LP/news-phase3.js', 'utf8');
const detail = fs.readFileSync('scripts/build-detail-pages.mjs', 'utf8');
const entityLinks = fs.readFileSync('scripts/lib/article-entity-links.mjs', 'utf8');
const index = fs.readFileSync('LP/index.html', 'utf8');
const enIndex = fs.readFileSync('LP/en/index.html', 'utf8');

const fixture = [
  { id: 'news-old', category: 'news', date: '2026-11-20', festivalId: 'f1' },
  { id: 'story-new', category: 'STORY', date: '2026-11-25' },
  { id: 'news-new', category: 'NEWS', date: '2026-11-26', festivalId: 'f1' },
  { id: 'guide', category: 'GUIDE', date: '2026-11-24' },
];
const isNews = (article) => String(article.category || '').toUpperCase() === 'NEWS';
const sorted = fixture.slice().sort((a, b) => b.date.localeCompare(a.date));
assert.deepEqual(sorted.filter((article) => !isNews(article)).map((article) => article.id), ['story-new', 'guide']);
assert.deepEqual(sorted.filter(isNews).slice(0, 5).map((article) => article.id), ['news-new', 'news-old']);
assert.equal(sorted.filter((article) => !isNews(article)).length, 2, 'ALL count must exclude NEWS');
assert.equal(sorted.filter(isNews).length, 2, 'NEWS tab must retain every NEWS article');
assert.equal(sorted.filter(isNews).slice(0, 5).length <= 5, true, 'TOP NEWS must be capped at five');
assert.equal([].filter(isNews).length, 0, 'empty NEWS fixture must hide the section');

assert.match(top, /String\(a && a\.category \|\| ''\)\.toUpperCase\(\) === 'NEWS'/);
assert.match(top, /var newsSection = document\.getElementById\('top2-news'\)/);
assert.match(top, /newsArticles = articles\.filter\(isNews\)\.slice\(0, 5\)/);
assert.match(news, /state\.category === 'ALL'[\s\S]*String\(article\.category \|\| ''\)\.toUpperCase\(\) !== 'NEWS'/);
assert.match(index, /id="top2-news" hidden[\s\S]*id="top2-stories"/);
assert.match(enIndex, /href="\/en\/news\.html\?category=NEWS"/);
assert.match(detail, /!isNewsArticle\(item\)/);
assert.match(detail, /!isNewsArticle\(a\)/);
assert.match(entityLinks, /String\(article\.category \|\| ''\)\.toUpperCase\(\) !== 'NEWS'/);

function chromePath() {
  for (const p of [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean)) {
    try { execFileSync(p, ['--version'], { stdio: 'ignore' }); return p; } catch {}
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

async function cdp(ws, method, params = {}) {
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

async function checkMobileNewsLayout() {
  const root = path.resolve(new URL('..', import.meta.url).pathname);
  const port = await freePort();
  const http = spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>{const u=(q.url||'/').split('?')[0].replace(/^\\/+/, '')||'index.html'; require('fs').createReadStream(require('path').join(${JSON.stringify(root + '/LP')},u)).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(${port},'127.0.0.1')`], { stdio: 'ignore' });
  const chrome = spawn(chromePath(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port + 1}`, 'about:blank',
  ], { stdio: 'ignore' });

  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await delay(100);
      try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find((item) => item.type === 'page'); } catch {}
    }
    if (!target) throw new Error('Chrome DevTools のページに接続できません');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
    await cdp(ws, 'Page.enable');
    await cdp(ws, 'Runtime.enable');
    await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: "try { sessionStorage.setItem('tj-intro', '1'); } catch (e) {}" });
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}/index.html?news-layout-check=1` });

    const end = Date.now() + 15000;
    let result;
    while (Date.now() < end) {
      const out = await cdp(ws, 'Runtime.evaluate', {
        expression: `(() => {
          const section = document.getElementById('top2-news');
          const titles = [...document.querySelectorAll('.top2-news-title')];
          return {
            ready: document.readyState,
            newsCount: titles.length,
            hidden: section?.hidden ?? true,
            widths: titles.map((title) => Math.round(title.getBoundingClientRect().width)),
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          };
        })()`,
        returnByValue: true,
      });
      result = out.result?.value;
      if (result?.ready !== 'loading' && result?.newsCount > 0) break;
      await delay(100);
    }
    assert.ok(result?.newsCount > 0, `expected NEWS rows, got ${JSON.stringify(result)}`);
    assert.equal(result.hidden, false, `#top2-news is hidden: ${JSON.stringify(result)}`);
    assert.ok(result.widths.every((width) => width >= 300), `NEWS title is too narrow: ${JSON.stringify(result)}`);
    assert.ok(result.scrollWidth <= result.innerWidth, `horizontal overflow: ${JSON.stringify(result)}`);
    console.log(`NEWS flash mobile layout: ok (${result.newsCount} rows, widths=${result.widths.join(',')}, scrollWidth=${result.scrollWidth}/${result.innerWidth})`);
  } finally {
    chrome.kill('SIGTERM');
    http.kill('SIGTERM');
  }
}

console.log('NEWS flash regression fixture: ok');
await checkMobileNewsLayout();
