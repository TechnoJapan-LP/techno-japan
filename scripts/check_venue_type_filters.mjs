#!/usr/bin/env node
/* VENUES §6-2: 種別フィルタの実ブラウザ回帰検査 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.join(process.cwd(), 'LP');
const MIME = { '.html':'text/html;charset=utf-8', '.js':'text/javascript;charset=utf-8', '.css':'text/css;charset=utf-8', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/venues.html';
  if (p === '/__check.html') return;
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const probe = `<script>
window.addEventListener('load', () => setTimeout(() => {
  const out = {};
  const cards = () => [...document.querySelectorAll('#venues-grid .venue-grid-card')];
  const visible = () => cards().filter(c => c.style.display !== 'none');
  const typeNav = [...document.querySelectorAll('#venues-type-chips button')];
  out.typeButtons = typeNav.map(a => a.dataset.value);
  out.allOrder = cards().map(c => c.querySelector('.venue-grid-title')?.textContent.trim());
  document.querySelector('#venues-type-chips button[data-value="bar"]')?.click();
  out.barHash = location.hash;
  out.barVisibleTypes = visible().map(c => c.dataset.type);
  out.barVisibleCount = visible().length;
  out.barNames = visible().map(c => c.querySelector('.venue-grid-title')?.textContent.trim());
  out.barLabels = visible().flatMap(c => [...c.querySelectorAll('.venue-grid-meta, .venue-grid-genre')].map(x => x.textContent.trim()));
  document.querySelector('#venues-type-chips button[data-value="ALL"]')?.click();
  out.allHash = location.hash;
  out.allVisibleCount = visible().length;
  document.body.setAttribute('data-venue-filter-check', JSON.stringify(out));
}, 1800));
</script>`;
const url = `${base}/venues.html`;
const source = fs.readFileSync(path.join(ROOT, 'venues.html'), 'utf8').replace('</body>', probe + '</body>');
server.on('request', (req, res) => {
  if (new URL(req.url, 'http://x').pathname === '/__check.html') {
    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); res.end(source);
  }
});
const chromeCandidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'chromium'];
const chrome = chromeCandidates.find(c => c.includes('/') ? fs.existsSync(c) : spawnSync('which', [c]).status === 0);
if (!chrome) { server.close(); console.error('Chrome not found'); process.exit(1); }
const dom = await new Promise(resolve => {
  const child = spawn(chrome, ['--headless=new','--disable-gpu','--no-sandbox','--window-size=1280,1600','--virtual-time-budget=9000','--dump-dom',`${base}/__check.html`], {stdio:['ignore','pipe','ignore']});
  let out = ''; child.stdout.on('data', d => out += d); child.on('close', () => resolve(out));
});
server.close();
const match = dom.match(/data-venue-filter-check="([^\"]*)"/);
if (!match) { console.error('✗ フィルタ結果を取得できませんでした'); process.exit(1); }
const result = JSON.parse(match[1].replace(/&quot;/g, '"'));
const failures = [];
if (result.typeButtons.join(',') !== 'ALL,club,bar,livehouse') failures.push(`種別ボタン: ${result.typeButtons.join(',')}`);
if (result.barHash !== '') failures.push(`barのURLクエリ: ${result.barHash}`);
if (!result.barVisibleCount || result.barVisibleTypes.some(t => t !== 'bar')) failures.push('bar選択時にbar以外が表示');
if (result.barNames.some((name, i, names) => i && String(name).localeCompare(String(names[i - 1])) < 0)) failures.push('bar選択時の名前順が崩れている');
if (result.allHash !== '') failures.push(`ALLのURLハッシュが残る: ${result.allHash}`);
if (result.allOrder.some((name, i, names) => i && String(name).localeCompare(String(names[i - 1])) < 0)) failures.push('ALL時の名前順がA–Zではない');
if (result.barLabels.some(label => /cash-only|cashless-only|id-required|no-photo|smoking|no-reentry/.test(label))) failures.push('実用メモがカードに表示されている');
if (failures.length) { console.log('VENUES種別フィルタに問題があります:'); failures.forEach(f => console.log('  ✗ ' + f)); console.log(JSON.stringify(result, null, 2)); process.exit(1); }
console.log(`  ✅ 種別ボタン ${result.typeButtons.join(' / ')}`);
console.log(`  ✅ bar選択で ${result.barVisibleCount}件、URL ?type=bar`);
console.log(`  ✅ ALL時の名前順 A–Z`);
console.log('  ✅ 実用メモはカードに表示されない');
