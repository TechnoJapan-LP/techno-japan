#!/usr/bin/env node
/**
 * クラブ地図（map.html）が、東京以外の会場も出しているか。
 *
 * ■ 何を守るか（AUDIT §9-76）
 *
 *   `map.html` は長らく `v.city === 'TOKYO'` で絞っていた。
 *   **大阪6件・京都1件が地図に1つも出ていなかった。**
 *   一覧は `[...new Set(VENUES.map(v => v.city))]` で自動追随するのに、
 *   地図だけが取り残されていた。福岡や札幌を足しても同じことが起きる。
 *
 *   絞り込みを外すだけでは足りない。次の2つで**静かに元通りになる。**
 *
 *   1. `minZoom` が高いままだと、日本全体が画面に入らない。
 *      引けないので、東京以外のピンに辿り着けない。
 *   2. 初期表示が固定の中心・ズームだと、増えた都市が画面外に出る。
 *
 *   さらに、`#map` は position:absolute で読み込み直後の高さが 0 のことがあり、
 *   その状態の `fitBounds` は**黙って無視される。**実際、同じコードで
 *   ズームが 9 になったり 13 になったりした。**1回の確認では気づけない。**
 *
 * ■ 何を見るか（実際に描画して測る）
 *
 *   ・data.js にある全都市のピンが出ていること
 *   ・引いた状態で東京の地名ラベルが隠れること
 *   ・**5回読み込んで結果がぶれないこと**（初期化のタイミング依存を検出する）
 *   ・PC 幅とモバイル幅の両方
 *
 * 使い方:
 *   node scripts/check_map_nationwide.mjs
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
    const r = spawnSync('which', [c]);
    if (r.status === 0) return String(r.stdout).trim();
  }
  return null;
}

const PROBE = `<script>window.addEventListener('load',()=>setTimeout(()=>{
  var o={zoom:map.getZoom(), pins:document.querySelectorAll('.club-pin,.bar-pin').length,
    cities:[...new Set(CLUBS.map(function(c){return c.city}))].sort(),
    minZoom:map.getMinZoom(),
    labelsHidden:[].slice.call(document.querySelectorAll('.area-label')).every(function(e){return e.style.display==='none'})};
  document.title='RES:'+JSON.stringify(o);
},2500));</script>`;

const MIME = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json' };

const PROBE_PATH = '/__map-nationwide-probe.html';

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === PROBE_PATH) {
    const html = fs.readFileSync(path.join(LP, 'map.html'), 'utf8').replace('</body>', PROBE + '</body>');
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

/** data.js に入っている都市を、描画せずに読み出す（期待値の作成用）。 */
function citiesInData() {
  const src = fs.readFileSync(path.join(LP, 'data.js'), 'utf8');
  const m = src.match(/const VENUES\s*=\s*(\[[\s\S]*?\n\];)/);
  if (!m) return null;
  // eslint-disable-next-line no-eval
  const venues = eval(m[1]);
  return [...new Set(venues.filter((v) => v.lat && v.lng).map((v) => v.city))].sort();
}

function render(size) {
  return new Promise((resolve) => {
    const pr = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
      `--window-size=${size}`, '--virtual-time-budget=6000', '--dump-dom', `${base}${PROBE_PATH}`],
      { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    pr.stdout.on('data', (d) => { out += d; });
    pr.on('close', () => {
      const m = out.match(/<title>RES:([^<]*)<\/title>/);
      resolve(m ? JSON.parse(m[1].replace(/&quot;/g, '"')) : null);
    });
  });
}

let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

const expected = citiesInData();
console.log(`data.js の都市: ${expected ? expected.join(' / ') : '読めず'}\n`);

for (const [label, size] of [['PC 1440x900', '1440,900'], ['モバイル 390x844', '390,844']]) {
  console.log(label);
  const runs = [];
  for (let i = 0; i < 5; i++) runs.push(await render(size));

  if (runs.some((r) => r === null)) {
    check('描画できる', false, '計測できなかった回がある');
    continue;
  }
  check('全都市のピンが出る',
    runs.every((r) => JSON.stringify(r.cities) === JSON.stringify(expected)),
    runs.map((r) => r.cities.join('+')).join(' / '));
  check('会場の件数だけピンがある',
    new Set(runs.map((r) => r.pins)).size === 1 && runs[0].pins > 0,
    runs.map((r) => r.pins).join(', '));
  check('日本全体まで引ける（minZoom が十分低い）',
    runs.every((r) => r.minZoom <= 7), `minZoom = ${runs[0].minZoom}`);
  check('引いた状態で東京の地名ラベルが隠れる',
    runs.every((r) => r.labelsHidden === true),
    runs.map((r) => r.labelsHidden).join(', '));
  // ここが本命。1回だけ見ても分からない種類の不具合を検出する。
  check('5回読み込んでも結果がぶれない',
    new Set(runs.map((r) => r.zoom)).size === 1,
    'ズーム = ' + runs.map((r) => r.zoom).join(', '));
  console.log();
}

server.close();
if (failed) { console.log(`❌ ${failed}件の問題があります`); process.exit(1); }
console.log('✅ クラブ地図は全国の会場を表示できる');
