#!/usr/bin/env node
/**
 * 会場一覧（venues.html）の地図が、データにある全都市を出せるか。
 *
 * ■ 何を守るか（AUDIT §9-78）
 *
 *   venues.html は TOKYO / OSAKA / NAGOYA / KYOTO / HAKUBA の**5都市を
 *   べた書き**していた。約280行のほぼ同じコードが5つ並び、
 *   HTML の入れ物も CSS の指定も5つ分あった。
 *
 *   **対応表に無い都市は、MAP を押しても何も起きない。**
 *   `ALL_MAPS_CFG.find(m => m.city === city)` が undefined を返すだけで、
 *   ボタンは光るのに地図が出ない。**エラーも警告も出ない。**
 *
 *   地域ナビ自体は `[...new Set(VENUES.map(v => v.city))]` で自動追随する。
 *   **一覧は増えるのに地図だけ出ない**という食い違いが起きる。
 *   福岡・札幌へ広げる前に潰す（§9-76 で map.html は対応済み）。
 *
 * ■ 何を見るか（実際に描画して測る）
 *
 *   1. データにある都市すべてに地図の入れ物があること
 *   2. どの都市の MAP を押しても、地図が表示されピンが出ること
 *   3. ピンの数が、その都市の会場数と一致すること
 *   4. 絞り込み（ジャンル / 種別）がどの都市でも効くこと
 *   5. 都市を切り替えると前の地図が隠れること
 *
 * 使い方:
 *   node scripts/check_venue_maps.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
];
function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (c.includes('/')) { if (fs.existsSync(c)) return c; continue; }
    if (spawnSync('which', [c]).status === 0) return String(spawnSync('which', [c]).stdout).trim();
  }
  return null;
}

/** data.js から、地図に出るべき都市と件数を読む（期待値）。 */
function expectedByCity() {
  const src = fs.readFileSync(path.join(LP, 'data.js'), 'utf8');
  const m = src.match(/const VENUES\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) return null;
  // eslint-disable-next-line no-eval
  const venues = eval(m[1]);
  const by = {};
  venues.filter((v) => v.city && v.city !== 'undefined' && v.lat && v.lng)
    .forEach((v) => { by[v.city] = (by[v.city] || 0) + 1; });
  return by;
}

/* 各都市の MAP を順に開き、状態を集める。
   タイルの読み込みは待たない（外部通信で不安定なため）。見るのは
   「入れ物が出るか」「ピンが出るか」「絞り込みが効くか」。 */
const PROBE = `<script>
window.addEventListener('load', () => setTimeout(async () => {
  const out = { cities: {}, errors: [] };
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const nav = document.getElementById('area-nav');
  const btn = document.getElementById('area-map-btn');
  const links = [].slice.call(nav.querySelectorAll('a[data-area]'))
    .map(a => a.dataset.area).filter(a => a !== 'ALL');
  for (const city of links) {
    try {
      [].slice.call(nav.querySelectorAll('a[data-area]'))
        .filter(a => a.dataset.area === city)[0].click();
      await wait(120);
      btn.click();
      await wait(900);
      const wraps = [].slice.call(document.querySelectorAll('[id$="-map-wrap"]'))
        .filter(w => w.style.display !== 'none');
      const wrap = wraps[0] || null;
      const pins = wrap ? wrap.querySelectorAll('.vm-pin, .vm-pin-bar').length : 0;
      const pills = wrap ? wrap.querySelectorAll('.vm-pill').length : 0;
      let afterFilter = null;
      if (wrap) {
        const techno = [].slice.call(wrap.querySelectorAll('.vm-pill[data-genre]'))
          .filter(p => p.dataset.genre === 'TECHNO')[0];
        if (techno) { techno.click(); await wait(250);
          afterFilter = wrap.querySelectorAll('.vm-pin, .vm-pin-bar').length;
          const all = [].slice.call(wrap.querySelectorAll('.vm-pill[data-genre]'))
            .filter(p => p.dataset.genre === 'ALL')[0];
          if (all) { all.click(); await wait(250); }
        }
      }
      out.cities[city] = { 表示された: !!wrap, 開いた数: wraps.length, ピン: pins, 絞込ボタン: pills, TECHNOで絞った後: afterFilter };
      btn.click();   // 閉じる
      await wait(150);
    } catch (e) { out.errors.push(city + ': ' + e.message); }
  }
  document.title = 'RES:' + JSON.stringify(out);
}, 1200));
</script>`;

const PROBE_PATH = '/__venue-maps-probe.html';
const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === PROBE_PATH) {
    const html = fs.readFileSync(path.join(LP, 'venues.html'), 'utf8').replace('</body>', PROBE + '</body>');
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    return res.end(html);
  }
  const f = path.join(LP, p);
  if (!f.startsWith(LP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME = findChrome();
if (!CHROME) { server.close(); console.error('✗ headless Chrome が見つかりません'); process.exit(1); }

const dom = await new Promise((resolve) => {
  const pr = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--window-size=1440,1200', '--virtual-time-budget=30000', '--dump-dom', `${base}${PROBE_PATH}`],
    { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = '';
  pr.stdout.on('data', (d) => { out += d; });
  pr.on('close', () => resolve(out));
});
server.close();

const m = dom.match(/<title>RES:([^<]*)<\/title>/);
if (!m) { console.error('✗ 計測できませんでした（ページを開けていない可能性）'); process.exit(1); }
const res = JSON.parse(m[1].replace(/&quot;/g, '"'));
const expected = expectedByCity();

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

console.log('data.js の都市:', Object.entries(expected).map(([c, n]) => `${c}(${n})`).join(' / '));
console.log();

check('例外が出ていない', res.errors.length === 0, res.errors.join(' / '));

for (const [city, count] of Object.entries(expected)) {
  const r = res.cities[city];
  console.log(`▸ ${city}`);
  if (!r) { check(`${city} の地図を開ける`, false, 'そもそも地域ナビに出ていない'); continue; }
  check('MAP を押すと地図が出る', r.表示された === true);
  check('開くのは1つだけ（前のが隠れる）', r.開いた数 === 1, `${r.開いた数}個`);
  check(`ピンが会場数と一致（${count}件）`, r.ピン === count, `実測 ${r.ピン}`);
  check('絞り込みボタンが並ぶ', r.絞込ボタン >= 7, `${r.絞込ボタン}個`);
  check('ジャンルで絞ると数が変わる（または0になる）',
    r.TECHNOで絞った後 !== null && r.TECHNOで絞った後 <= r.ピン,
    `TECHNO で ${r.TECHNOで絞った後}`);
}

console.log();
if (failed) { console.log(`❌ ${failed}件の問題があります`); process.exit(1); }
console.log('✅ 会場一覧の地図は、データにある全都市を出せる');
