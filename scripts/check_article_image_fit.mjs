#!/usr/bin/env node
/* Article image layout guard. Uses real Chrome layout at desktop/tablet and phone widths. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lpRoot = path.join(root, 'LP');
const viewports = [
  { width: 1440, height: 900, mobile: false },
  { width: 1280, height: 800, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 900, height: 800, mobile: false },
  { width: 768, height: 1024, mobile: false },
  { width: 390, height: 844, mobile: true },
];

function chromePath() {
  for (const candidate of [
    process.env.CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'chromium', 'chromium-browser',
  ].filter(Boolean)) {
    try { execFileSync(candidate, ['--version'], { stdio: 'ignore' }); return candidate; } catch {}
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

async function findArticle() {
  const files = (await readdir(path.join(lpRoot, 'articles')))
    .filter(file => file.endsWith('.html'))
    .sort();
  if (!files.length) throw new Error('LP/articles/*.html がありません');
  for (const file of files) {
    if ((await readFile(path.join(lpRoot, 'articles', file), 'utf8')).includes('data-pair-id')) {
      return `/articles/${file}`;
    }
  }
  return `/articles/${files[0]}`;
}

const injectImages = `
(() => {
  const inject = () => {
    if (document.readyState !== 'interactive') return;
    const body = document.querySelector('.article-body');
    if (!body) return;
    const images = [...body.querySelectorAll('img')].filter(img =>
      !img.closest('.tj-event, .tj-artist-card') && !img.closest('figure.fx-img')
    );
    if (images.length < 3) return;
    images.slice(0, 3).forEach(img => {
      img.removeAttribute('data-layout');
      img.removeAttribute('data-pair-id');
    });
    images[0].dataset.pairId = 'article-image-fit-check';
    images[1].dataset.pairId = 'article-image-fit-check';
    images[2].dataset.layout = 'full';

    // 明示左右寄せの回り込み規則を、article-fx.js 実行前に本文へ追加する。
    const src = images[0].getAttribute('src');
    const a = document.createElement('p');
    const aImg = document.createElement('img');
    aImg.id = 'article-image-wrap-a-img';
    aImg.dataset.layout = 'left';
    aImg.src = src;
    aImg.alt = 'wrap A';
    a.append(aImg, document.createTextNode('回り込む文字。画像と同じ段落に改行なしで続く文章を数行分入れて、画像の右側に表示されることを確認するための検査用テキストです。'));
    const aNext = document.createElement('p');
    aNext.id = 'article-image-wrap-a-next';
    aNext.textContent = 'Aの次の段落';
    const b = document.createElement('p');
    const bImg = document.createElement('img');
    bImg.id = 'article-image-wrap-b-img';
    bImg.dataset.layout = 'right';
    bImg.src = src;
    bImg.alt = 'wrap B';
    b.appendChild(bImg);
    const bNext = document.createElement('p');
    bNext.id = 'article-image-wrap-b-next';
    bNext.textContent = 'Bの次の段落';
    body.append(a, aNext, b, bNext);
  };
  if (document.readyState === 'interactive') inject();
  else document.addEventListener('readystatechange', inject);
})();`;

async function waitForFigures(ws, timeout = 15000) {
  const end = Date.now() + timeout;
  let last = {};
  while (Date.now() < end) {
    const result = await cdp(ws, 'Runtime.evaluate', {
      expression: `(() => ({ ready: document.readyState, body: Boolean(document.querySelector('.article-body')), figures: document.querySelectorAll('.article-body figure.fx-img').length }))()`,
      returnByValue: true,
    });
    last = result.result?.value || last;
    if (last.ready !== 'loading' && last.body && last.figures > 0) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`figure.fx-img 待ち timeout: ${JSON.stringify(last)}`);
}

const port = await freePort();
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(lpRoot, relative);
    if (!file.startsWith(`${lpRoot}${path.sep}`)) throw new Error('invalid path');
    const data = await readFile(file);
    response.writeHead(200);
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));

const chrome = spawn(chromePath(), [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-extensions',
  `--remote-debugging-port=${port + 1}`, 'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  if (typeof WebSocket !== 'function') throw new Error('この Node.js には WebSocket がありません');
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try { target = (await (await fetch(`http://127.0.0.1:${port + 1}/json`)).json()).find(t => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('Chrome DevTools のページに接続できません');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: injectImages });

  const page = await findArticle();
  const failures = [];
  let passed = 0;
  for (const viewport of viewports) {
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile,
    });
    await cdp(ws, 'Page.navigate', { url: `http://127.0.0.1:${port}${page}` });
    await waitForFigures(ws);
    const result = await cdp(ws, 'Runtime.evaluate', {
      expression: `(() => {
        const viewport = ${JSON.stringify(viewport)};
        const body = document.querySelector('.article-body').getBoundingClientRect();
        const sidebar = document.querySelector('.article-sidebar')?.getBoundingClientRect() || null;
        const pair = document.querySelector('.fx-image-pair');
        const aImg = document.getElementById('article-image-wrap-a-img');
        const bImg = document.getElementById('article-image-wrap-b-img');
        const aFig = aImg?.closest('figure.fx-img');
        const bFig = bImg?.closest('figure.fx-img');
        const aNext = document.getElementById('article-image-wrap-a-next');
        const bNext = document.getElementById('article-image-wrap-b-next');
        const figures = [...document.querySelectorAll('.article-body figure.fx-img')];
        const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
        const bounds = el => ({ element: el.className, rect: rect(el) });
        const errors = [];
        const inside = (item, label) => {
          const r = rect(item);
          if (r.left < body.left - 1 || r.right > body.right + 1) errors.push({ reason: label, element: item.className, rect: r, body: { left: body.left, right: body.right } });
          if (sidebar && sidebar.left >= body.right && r.right > sidebar.left + 1) errors.push({ reason: 'sidebar overlap', element: item.className, rect: r, body: { left: body.left, right: body.right }, sidebar: rect(document.querySelector('.article-sidebar')) });
        };
        if (viewport.width >= 701) {
          figures.forEach(fig => inside(fig, 'figure outside article-body'));
          if (!pair) errors.push({ reason: 'missing pair', element: '.fx-image-pair' });
          else {
            inside(pair, 'pair outside article-body');
            const pairFigures = [...pair.querySelectorAll(':scope > figure.fx-img')];
            pairFigures.forEach(fig => inside(fig, 'pair figure outside article-body'));
            const pairRects = pairFigures.map(rect);
            if (pairFigures.length !== 2 || Math.abs(pairRects[0].top - pairRects[1].top) > 2 || Math.abs(pairRects[0].left - pairRects[1].left) < 10) errors.push({ reason: 'pair not side by side', element: '.fx-image-pair', rect: rect(pair), figures: pairFigures.map(bounds) });
          }
        } else {
          const phoneItems = [...document.querySelectorAll('.fx-image-pair > figure.fx-img, figure.fx-img.fx-bleed')];
          phoneItems.forEach(item => { const r = rect(item); if (r.left < -1 || r.right > viewport.width + 1 || Math.abs(r.left) > 1 || Math.abs(r.right - viewport.width) > 1) errors.push({ reason: 'phone image is not viewport width', element: item.className, rect: r, viewport: viewport.width }); });
        }
        if (!aFig || !bFig || !aNext || !bNext) {
          errors.push({ reason: 'wrap fixture missing' });
        } else {
          const ar = rect(aFig), br = rect(bFig);
          const aText = [...aFig.parentElement.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          const textRect = aText ? (() => { const range = document.createRange(); range.setStart(aText, 0); range.setEnd(aText, 1); return rect(range); })() : null;
          const aNextRect = rect(aNext), bNextRect = rect(bNext);
          if (viewport.width >= 900) {
            if (Math.abs(ar.left - body.left) > 1 || Math.abs(ar.width - body.width * .46) > 2) errors.push({ reason: 'explicit left figure geometry', figure: ar, body: rect(document.querySelector('.article-body')) });
            if (!textRect || textRect.left < ar.right - 1 || textRect.top >= ar.bottom) errors.push({ reason: 'same-paragraph text does not wrap right of left figure', figure: ar, text: textRect });
            if (aNextRect.top < ar.bottom - 1) errors.push({ reason: 'next paragraph overlaps explicit left figure', figure: ar, next: aNextRect });
            if (Math.abs(br.right - body.right) > 1) errors.push({ reason: 'explicit right figure geometry', figure: br, body: rect(document.querySelector('.article-body')) });
            if (bNextRect.top < br.bottom - 1) errors.push({ reason: 'next paragraph overlaps standalone right figure', figure: br, next: bNextRect });
          }
          if (viewport.width <= 600) {
            if (Math.abs(ar.left) > 1 || Math.abs(ar.right - viewport.width) > 1 || Math.abs(br.left) > 1 || Math.abs(br.right - viewport.width) > 1) errors.push({ reason: 'explicit figures are not full width on mobile', left: ar, right: br });
            if (!textRect || textRect.top < ar.bottom - 1) errors.push({ reason: 'mobile same-paragraph text is beside figure', figure: ar, text: textRect });
          }
        }
        if (document.documentElement.scrollWidth > viewport.width) errors.push({ reason: 'horizontal scroll', element: 'document', scrollWidth: document.documentElement.scrollWidth, viewport: viewport.width });
        return { errors, figureCount: figures.length, body: { left: body.left, right: body.right }, scrollWidth: document.documentElement.scrollWidth };
      })()`,
      returnByValue: true,
    });
    const value = result.result?.value || { errors: [{ reason: 'no result' }] };
    if (value.errors.length) failures.push(`${viewport.width}px ${page}: ${JSON.stringify(value.errors)}`);
    else passed++;
  }
  if (failures.length) {
    console.error(failures.join('\n'));
    console.error(`article_image_fit: ${passed}/${viewports.length}`);
    process.exitCode = 1;
  } else {
    console.log(`article_image_fit: ${passed}/${viewports.length}`);
  }
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  server.close();
}
