#!/usr/bin/env node
/* フェス詳細ページの行動計測を、gtag有り／無しの実ブラウザで確認する。 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.join(process.cwd(), 'LP');
const pagePath = '/festivals/circus.html';
const source = fs.readFileSync(path.join(ROOT, pagePath), 'utf8');
const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
};
const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'
];
const chrome = chromeCandidates.find((candidate) =>
  candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0,
);

const fail = (message) => { console.log(`  ❌ ${message}`); };
const pass = (message) => { console.log(`  ✅ ${message}`); };

if (!chrome) {
  console.error('✗ headless Chrome が見つかりません');
  process.exit(1);
}

const makeProbe = (withGtag) => `
<script>
window.__tjCheckCalls = [];
window.__tjCheckErrors = [];
window.addEventListener('error', function(e) {
  window.__tjCheckErrors.push(e.message || 'window error');
});
window.__tjCheckConsoleError = console.error;
console.error = function() {
  window.__tjCheckErrors.push(Array.prototype.join.call(arguments, ' '));
  window.__tjCheckConsoleError.apply(console, arguments);
};
${withGtag ? `window.dataLayer = [];
window.gtag = function() {
  var args = Array.prototype.slice.call(arguments);
  window.dataLayer.push(args);
  if (args[0] === 'event') window.__tjCheckCalls.push({ name: args[1], params: args[2] || {} });
};
Object.defineProperty(window, 'gtag', { writable: false, configurable: false });` : ''}
</script>`;

const actionProbe = `
<script>
(async function() {
  var wait = function(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); };
  var preventTestNavigation = function(e) {
    var a = e.target.closest && e.target.closest('.festival-official-link, .related-card');
    if (a) e.preventDefault();
  };
  document.addEventListener('click', preventTestNavigation, true);
  await wait(300);
  for (var i = 0; i < 4; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await wait(200);
  }
  var official = document.querySelector('.festival-official-link');
  if (official) official.click();
  await wait(150);
  var related = document.querySelector('.related-card');
  if (related) related.click();
  await wait(200);
  document.body.setAttribute('data-tj-tracking-check', JSON.stringify({
    calls: window.__tjCheckCalls || [],
    errors: window.__tjCheckErrors || []
  }));
})();
</script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://check.local');
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === pagePath) {
    const withGtag = url.searchParams.get('gtag') === '1';
    let html = source;
    if (!withGtag) {
      // 本番のGA初期化を外し、gtag無し環境を再現する。
      html = html.replace(/<script>\s*window\.dataLayer\s*=\s*window\.dataLayer[\s\S]*?<\/script>/, '');
    }
    html = html.replace('</head>', makeProbe(withGtag) + '</head>');
    html = html.replace('</body>', actionProbe + '</body>');
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    return res.end(html);
  }
  if (filePath === '/') filePath = pagePath;
  const file = path.join(ROOT, filePath);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) {
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const render = (withGtag) => new Promise((resolve) => {
  /* headless Chrome は window.scrollTo が効かない（scrollY が 0 のまま）。
     スクロールで IO を発火させられないため、ページ全体が入る高さの
     ビューポートで開いて可視判定を成立させる。実スクロールでの挙動は
     本番の実ブラウザで確認する。 */
  const args = [
    '--headless=new', '--disable-gpu', '--disable-service-worker', '--no-sandbox',
    '--no-first-run', '--window-size=1280,4000', '--virtual-time-budget=12000',
    '--dump-dom', `${base}${pagePath}?gtag=${withGtag ? '1' : '0'}`
  ];
  const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('close', () => resolve(output));
});

const parseResult = (dom) => {
  const match = dom.match(/data-tj-tracking-check="([^\"]*)"/);
  if (!match) return null;
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
};

const withGtag = parseResult(await render(true));
const withoutGtag = parseResult(await render(false));
server.close();

const failures = [];
if (!withGtag) failures.push('gtag有りの実ブラウザ結果を取得できない');
if (!withoutGtag) failures.push('gtag無しの実ブラウザ結果を取得できない');
if (withGtag) {
  const sectionCalls = withGtag.calls.filter((call) => call.name === 'festival_section_view');
  const sections = new Set(sectionCalls.map((call) => call.params.section));
  for (const required of ['lineup', 'editions', 'related']) {
    if (!sections.has(required)) failures.push(`セクション到達 ${required} が送られない`);
  }
  if (sectionCalls.some((call) => call.params.festival_id !== 'circus')) failures.push('セクションイベントのfestival_idがcircusではない');
  const counts = new Map();
  for (const call of sectionCalls) counts.set(call.params.section, (counts.get(call.params.section) || 0) + 1);
  for (const [section, count] of counts) if (count > 1) failures.push(`セクション ${section} が${count}回送られる`);
  const events = withGtag.calls.filter((call) => call.name === 'festival_section_view' || call.name === 'festival_link_click');
  if (events.some((call) => call.params.festival_id !== 'circus')) failures.push('フェス計測イベントにfestival_id: circusが無い');
  if (!withGtag.calls.some((call) => call.name === 'festival_link_click' && call.params.link_kind === 'official')) failures.push('公式リンクのクリックイベントが無い');
  if (!withGtag.calls.some((call) => call.name === 'festival_link_click' && call.params.link_kind === 'related_festival')) failures.push('関連フェスのクリックイベントが無い');
  if (withGtag.errors.length) failures.push(`gtag有り環境にコンソールエラー: ${withGtag.errors.join(' / ')}`);
  if (!failures.length) pass(`セクション ${[...sections].sort().join(' / ')}、公式・関連フェスのクリックを確認`);
}
if (withoutGtag && withoutGtag.errors.length) failures.push(`gtag無し環境にコンソールエラー: ${withoutGtag.errors.join(' / ')}`);
else if (withoutGtag) pass('gtag無し環境でもコンソールエラーなし');

if (failures.length) {
  failures.forEach(fail);
  if (withGtag) console.log(`  gtag有りで回収したイベント: ${JSON.stringify(withGtag.calls)}`);
  process.exit(1);
}
console.log('✅ フェス詳細の行動計測を実ブラウザで確認しました');
