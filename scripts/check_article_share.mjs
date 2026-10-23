#!/usr/bin/env node
/* JA/EN の記事詳細を実ブラウザで描画し、シェアボタンと SVG の大きさを確認する。 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const article = fs.readdirSync(path.join(LP, 'articles')).find((file) => file.endsWith('.html'));
if (!article) throw new Error('記事詳細ページがありません');

const PROBE_PATH = '/__article-share-probe.html';
const PROBE = `<script>
window.addEventListener('load', async () => {
  const pages = ['/articles/${article}', '/en/articles/${article}'];
  const result = {};
  for (const page of pages) {
    const frame = document.createElement('iframe');
    frame.src = page;
    frame.style.cssText = 'position:absolute;left:-9999px;width:1280px;height:900px;border:0';
    document.body.appendChild(frame);
    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    const doc = frame.contentDocument;
    const button = doc.querySelector('.article-share .share-btn');
    const svg = button?.querySelector('svg');
    const buttonRect = button?.getBoundingClientRect();
    const svgRect = svg?.getBoundingClientRect();
    result[page] = {
      button: buttonRect ? [buttonRect.width, buttonRect.height] : null,
      svg: svgRect ? [svgRect.width, svgRect.height] : null,
    };
    frame.remove();
  }
  document.title = 'RES:' + JSON.stringify(result);
});
</script>`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (requestPath === PROBE_PATH) {
    const html = fs.readFileSync(path.join(LP, 'articles', article), 'utf8').replace('</body>', PROBE + '</body>');
    response.writeHead(200, { 'Content-Type': MIME['.html'] });
    response.end(html);
    return;
  }
  const file = path.join(LP, requestPath);
  if (!file.startsWith(LP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const chrome = candidates.find((candidate) => candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0);
if (!chrome) {
  server.close();
  throw new Error('headless Chrome が見つかりません');
}
const base = `http://127.0.0.1:${server.address().port}`;
const output = spawnSync(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
  '--disable-dev-shm-usage', '--window-size=1400,1000', '--virtual-time-budget=30000',
  '--dump-dom', `${base}${PROBE_PATH}`,
], { encoding: 'utf8', timeout: 90000 });
server.close();

const match = output.stdout.match(/<title>RES:([^<]*)<\/title>/);
if (!match) throw new Error('記事シェアボタンの描画結果を取得できません');
const result = JSON.parse(match[1]);
const failures = [];
for (const [page, value] of Object.entries(result)) {
  if (!value.button || value.button.some((size) => size > 44.01)) failures.push(`${page}: share button ${JSON.stringify(value.button)}`);
  if (!value.svg || value.svg.some((size) => size > 14.01)) failures.push(`${page}: share SVG ${JSON.stringify(value.svg)}`);
}
if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`✅ article share buttons: JA/EN rendered within 44px; SVG within 14px (${article})`);
