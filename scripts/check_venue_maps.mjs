#!/usr/bin/env node
/* VENUES phase 3-4: the shared filtered map renders every coordinate pin. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const hubSource = fs.readFileSync(path.join(LP, 'data-hub.js'), 'utf8');
const venuesMatch = hubSource.match(/const VENUES\s*=\s*(\[[\s\S]*?\]);/);
if (!venuesMatch) throw new Error('data-hub.js の VENUES が読めません');
const expectedPins = JSON.parse(venuesMatch[1]).filter((venue) => Number.isFinite(Number(venue.lat)) && Number.isFinite(Number(venue.lng))).length;
const PROBE_PATH = '/__venue-map-probe.html';
const PROBE = `<script>
window.addEventListener('load', async () => {
  const out = { errors: [], ready: false, status: '', pins: 0, filteredPins: 0, mapRect: null, attribution: null, lowerLabels: [] };
  const wait = async (read, ok, timeout = 12000) => { const deadline = Date.now() + timeout; let value = read(); while (!ok(value) && Date.now() < deadline) { await new Promise(r => setTimeout(r, 100)); value = read(); } return value; };
  try {
    const map = await wait(() => document.getElementById('venue-map'), el => el?.dataset.mapStatus === 'ready' && el.querySelector('.leaflet-container'));
    out.ready = !!map;
    out.status = map?.dataset.mapStatus || '';
    out.pins = map?.querySelectorAll('.club-pin, .bar-pin').length || 0;
    if (map) {
      const mapRect = map.getBoundingClientRect();
      const attribution = map.querySelector('.leaflet-control-attribution');
      const attributionRect = attribution?.getBoundingClientRect();
      out.mapRect = { top: mapRect.top, bottom: mapRect.bottom, height: mapRect.height };
      out.attribution = attribution && attributionRect ? {
        top: attributionRect.top,
        bottom: attributionRect.bottom,
        height: attributionRect.height,
        fontSize: parseFloat(getComputedStyle(attribution).fontSize),
      } : null;
      const lowerHalf = mapRect.top + mapRect.height / 2;
      out.lowerLabels = [...map.querySelectorAll('.maplbl')].map((label) => {
        const rect = label.getBoundingClientRect();
        return {
          id: label.id || '',
          text: label.textContent.trim(),
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          inLowerHalf: rect.bottom > lowerHalf,
        };
      }).filter((label) => label.inLowerHalf);
    }
    const city = document.querySelector('#venues-city-chips button[data-value]:not([data-value="ALL"])');
    city?.click();
    const filtered = await wait(() => document.getElementById('venue-map')?.querySelectorAll('.club-pin, .bar-pin').length || 0, count => count > 0);
    out.filteredPins = filtered;
  } catch (error) { out.errors.push(error.message); }
  document.title = 'RES:' + JSON.stringify(out);
});
</script>`;
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (requestPath === PROBE_PATH) {
    const html = fs.readFileSync(path.join(LP, 'venues.html'), 'utf8').replace('</body>', PROBE + '</body>');
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return res.end(html);
  }
  const file = path.join(LP, requestPath);
  if (!file.startsWith(LP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const chrome = candidates.find(candidate => candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0);
if (!chrome) { server.close(); console.error('✗ headless Chrome が見つかりません'); process.exit(1); }
const dom = await new Promise(resolve => {
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1440,1200', '--virtual-time-budget=30000', '--dump-dom', `${base}${PROBE_PATH}`], { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = ''; child.stdout.on('data', data => { out += data; }); child.on('close', () => resolve(out));
});
server.close();
const match = dom.match(/<title>RES:([^<]*)<\/title>/);
if (!match) { console.error('✗ 計測できませんでした'); process.exit(1); }
const result = JSON.parse(match[1].replace(/&quot;/g, '"'));
const failures = [];
if (result.errors.length) failures.push(result.errors.join(' / '));
if (!result.ready || result.status !== 'ready') failures.push(`Leaflet map status=${result.status}`);
if (result.pins !== expectedPins) failures.push(`座標ピン ${result.pins}件（期待 ${expectedPins}件）`);
if (!result.filteredPins || result.filteredPins > result.pins) failures.push(`City filter pins=${result.filteredPins}`);
if (!result.attribution) failures.push('出典表示の矩形を取得できません');
if (result.attribution && (!Number.isFinite(result.attribution.fontSize) || result.attribution.fontSize < 10)) failures.push(`出典表示 font-size=${result.attribution.fontSize}px（10px未満または計測不能）`);
if (result.attribution) {
  result.lowerLabels.forEach((label) => {
    if (label.bottom > result.attribution.top) failures.push(`${label.id || '.maplbl'} bottom=${label.bottom}px > attribution top=${result.attribution.top}px`);
  });
}
if (failures.length) { console.log('VENUES地図に問題があります:'); failures.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`  ✅ Leaflet map ready / coordinate pins ${result.pins}件`);
console.log(`  ✅ City filter pins ${result.filteredPins}件`);
console.log(`  ✅ attribution top=${result.attribution.top}px bottom=${result.attribution.bottom}px height=${result.attribution.height}px font-size=${result.attribution.fontSize}px`);
result.lowerLabels.forEach((label) => console.log(`  ✅ ${label.id || '.maplbl'} top=${label.top}px bottom=${label.bottom}px <= attribution top=${result.attribution.top}px`));
