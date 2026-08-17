#!/usr/bin/env node
/**
 * CMS の開催回（EDITIONS）まわりを、ブラウザを立てずに検証する。
 *
 * ■ なぜブラウザで見ないのか
 *
 *   cms.html は読み込み時に prompt('CMS Password:') を出すので、headless では
 *   モーダルで固まって CDP が 45 秒でタイムアウトする（2026-08-06 に実測）。
 *   検査できないまま放置すると、ここは「壊れても誰も気づかない場所」になる。
 *   cms.js だけを VM に読み込み、DOM と fetch を差し替えて関数を直接叩く。
 *
 * ■ 何を守るか（すべて 2026-08-07 に実在したバグ。AUDIT §9-47）
 *
 *   1. FESTIVALS の DATE を翌年にしたとき、過去回の日程を書き換えないこと
 *      「2025回しか無いフェスの DATE を2026に更新」で、2025回の DATE_START が
 *      2026 に化けていた。EDITION は "2025" のままなので、EDITION_ID が
 *      xxx-2025 なのに日程は2026という行が残る。AGENTS.md が禁じている
 *      「DATE を翌年へ上書きして過去回を消す」を CMS が自動でやっていた。
 *
 *   2. 新規開催回をシート全体の末尾に追記すること
 *      追記位置を「編集中フェスの行だけ」に絞った配列から計算していたため、
 *      別のフェスの行を上書きしていた（54行目の隣 = 55行目に書いていた）。
 *
 *   3. 開催回が1つも無いフェスでも追加できること
 *      「このフェスに行があるか」を「シートを読めたか」と取り違えており、
 *      開催回ゼロのフェスは永久に1つも作れなかった。
 *
 *   4. 同じ画面で2回保存しても行が衝突しないこと
 *
 *   5. 新規開催回に PREF が入ること（空固定だった）
 *
 * 使い方:
 *   node scripts/check_cms_editions.mjs
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');

const BRIDGE = `
;globalThis.__T = {
  editions,
  get editionSheetRows(){return editionSheetRows}, set editionSheetRows(v){editionSheetRows=v},
  get lineupSheetRows(){return lineupSheetRows}, set lineupSheetRows(v){lineupSheetRows=v},
  get editionSheetMaxRow(){return editionSheetMaxRow}, set editionSheetMaxRow(v){editionSheetMaxRow=v},
  get lineupSheetMaxRow(){return lineupSheetMaxRow}, set lineupSheetMaxRow(v){lineupSheetMaxRow=v},
  get editionSheetLoaded(){return editionSheetLoaded}, set editionSheetLoaded(v){editionSheetLoaded=v},
  get editionRowById(){return editionRowById}, set editionRowById(v){editionRowById=v},
  get editionSheetLoadError(){return editionSheetLoadError}, set editionSheetLoadError(v){editionSheetLoadError=v},
  get editions(){return editions},
  addEdition,
  get editState(){return editState},
};`;
const src = fs.readFileSync(CMS_PATH, 'utf8') + BRIDGE;

function makeCtx({ cityValue = 'Ibaraki' } = {}) {
  const calls = [];
  const el = (id) => ({ value: id === 'f-city' ? cityValue : '', addEventListener(){}, querySelectorAll:()=>[], style:{}, classList:{add(){},remove(){},toggle(){}} });
  const ctx = {
    console,
    document: {
      documentElement: { lang: 'ja' },
      getElementById: el,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => ({ style:{}, classList:{add(){},remove(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }),
      body: { appendChild(){}, classList:{add(){},remove(){},toggle(){}} },
      head: { appendChild(){} },
      cookie: '',
    },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { href: 'http://localhost/cms.html', search: '', hash: '', origin: 'http://localhost' },
    navigator: { userAgent: 'node', onLine: true },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async (url, opts) => {
      calls.push(JSON.parse(opts?.body || '{}'));
      return { json: async () => ({ status: 'ok' }) };
    },
    __calls: calls,
    prompt: () => 'x', confirm: () => true, alert: () => {},
    addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: (f) => setTimeout(f, 0), scrollTo(){}, getComputedStyle: () => ({}),
    history: { replaceState(){}, pushState(){} }, IntersectionObserver: class { observe(){} unobserve(){} disconnect(){} },
    URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto: { subtle: { digest: async () => new ArrayBuffer(32) }, getRandomValues: (a) => a },
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx, { filename: 'cms.js' }); }
  catch (e) { console.log('  (読み込み時エラー: ' + e.message + ')'); }
  return ctx;
}

const results = [];
const check = (name, pass, detail) => { results.push([name, pass, detail]); };

// ---- 0) Add Edition が既存年を再利用しないこと ----------------------------
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  c.__T.editions.push({ year: '2026', date: '2026-08-15' });
  c.toast = () => {};
  c.markFormDirty = () => {};
  c.renderEditions = () => {};
  c.__T.addEdition();
  check('既存回がある場合はAdd Editionを翌年で作る',
    c.__T.editions.at(-1)?.year === '2027',
    `追加年=${c.__T.editions.at(-1)?.year}`);
}

// ---- 1) FESTIVALS の DATE を翌年にしても、過去回を書き換えないこと ----
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  c.__T.editions.push({ year: '2025', date: '2025-08-16/2025-08-17', _row: 54 });
  c.toast = () => {};
  c.markFormDirty = () => {};
  c.syncFestivalDateToLatestEdition('2026-08-15/2026-08-16');
  check('DATEを2026にしても2025回の日程を書き換えない',
    c.__T.editions[0].date === '2025-08-16/2025-08-17',
    `2025回の date = ${c.__T.editions[0].date}`);
}

// ---- 2) 同じ年の開催回があれば同期すること ----
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  c.__T.editions.push({ year: '2025', date: '2025-08-16/2025-08-17', _row: 54 });
  c.__T.editions.push({ year: '2026', date: '', _row: 96 });
  c.toast = () => {}; c.markFormDirty = () => {};
  c.syncFestivalDateToLatestEdition('2026-08-15/2026-08-16');
  check('同じ年の開催回には同期する',
    c.__T.editions[1].date === '2026-08-15/2026-08-16' && c.__T.editions[0].date === '2025-08-16/2025-08-17',
    `2026回=${c.__T.editions[1].date} / 2025回=${c.__T.editions[0].date}`);
}

// ---- 3) 新規開催回はシート全体の末尾に追記されること ----
{
  const c = makeCtx();
  // シート全体は 97 行（末尾 _row=98）。編集中フェスの行は 54 だけ。
  c.__T.editionSheetRows = [{ _row: 54, FESTIVAL_ID: 'loa-lost-paradise' }];
  c.__T.lineupSheetRows = [{ _row: 200 }];
  c.__T.editionSheetMaxRow = 98;
  c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.gasWriteSucceeded = () => true;
  const eds = [{ year: '2026', date: '2026-08-15/2026-08-16', location: 'Nalu Beach', lineup: ['GIZMO'] }];
  await c.syncNewEditionRows('loa-lost-paradise', eds).catch(()=>{});
  const edCall = c.__calls.find(x => x.sheet === 'EDITIONS');
  const luCall = c.__calls.find(x => x.sheet === 'LINEUPS');
  check('新規開催回はシート全体の末尾(99)に書く（54の隣を潰さない）',
    edCall?.row === 99, `書き込み先 row=${edCall?.row}`);
  check('新規LINEUPも全体の末尾(401)に書く', luCall?.row === 401, `row=${luCall?.row}`);
  check('新規開催回に PREF が入る（CITY を既定値に）',
    edCall?.PREF === 'Ibaraki', `PREF=${JSON.stringify(edCall?.PREF)}`);
  check('EDITION_ID は {festivalId}-{年}',
    edCall?.EDITION_ID === 'loa-lost-paradise-2026', `EDITION_ID=${edCall?.EDITION_ID}`);
}

// ---- 3b) 同じ画面で同じ年を2件追加しないこと ------------------------------
{
  const c = makeCtx();
  c.__T.editionSheetRows = [];
  c.__T.lineupSheetRows = [];
  c.__T.editionSheetMaxRow = 98;
  c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.gasWriteSucceeded = () => true;
  let err = null;
  await c.syncNewEditionRows('same-fest', [
    { year: '2027', date: '2027-05-01', lineup: [] },
    { year: '2027', date: '2027-06-01', lineup: [] },
  ]).catch(e => err = e);
  check('同じ年の新規開催回を保存前に止める',
    err && String(err.message).includes('same-fest-2027'),
    err ? err.message : 'エラーなし');
  check('重複検知時はシートへ書き込まない',
    c.__calls.length === 0, `書き込み=${c.__calls.length}件`);
}

// ---- 4) 開催回が1つも無いフェスでも追加できること ----
{
  const c = makeCtx();
  c.__T.editionSheetRows = [];          // このフェスには開催回が無い
  c.__T.lineupSheetRows = [];
  c.__T.editionSheetMaxRow = 98;        // シート自体は読めている
  c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.gasWriteSucceeded = () => true;
  let err = null;
  await c.syncNewEditionRows('new-fest', [{ year: '2026', date: '2026-05-01', lineup: [] }]).catch(e => err = e);
  check('開催回ゼロのフェスでも新規追加できる', err === null,
    err ? `エラー: ${err.message}` : '成功');
}

// ---- 5) 同じ画面で2回保存しても、直前の行を上書きしないこと ----
{
  const c = makeCtx();
  c.__T.editionSheetRows = [];
  c.__T.lineupSheetRows = [];
  c.__T.editionSheetMaxRow = 98; c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.gasWriteSucceeded = () => true;
  await c.syncNewEditionRows('a', [{ year: '2026', date: '2026-05-01', lineup: [] }]).catch(()=>{});
  await c.syncNewEditionRows('b', [{ year: '2026', date: '2026-06-01', lineup: [] }]).catch(()=>{});
  const rows = c.__calls.filter(x => x.sheet === 'EDITIONS').map(x => x.row);
  check('2回続けて保存しても行が衝突しない', rows.length === 2 && rows[0] !== rows[1], `rows=${rows.join(', ') || '(書き込みなし)'}`);
}


// ---- 9) 同じ年をもう一度保存しても、行が増えず上書きされること ----
{
  const c = makeCtx();
  c.__T.editionSheetRows = [{ _row: 54, FESTIVAL_ID: 'loa' }];
  c.__T.lineupSheetRows = [];
  c.__T.editionSheetMaxRow = 98; c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.__T.editionRowById = new Map([['loa-2026', 54]]);   // 既に 2026 がある
  c.gasWriteSucceeded = () => true;
  await c.syncNewEditionRows('loa', [{ year:'2026', date:'2026-08-15/2026-08-16', lineup:[] }]);
  const call = c.__calls.find(x => x.sheet === 'EDITIONS');
  check('同じ年は既存の行を上書きする（末尾に足さない）',
    call?.row === 54, `書き込み先 row=${call?.row}（54なら上書き / 99なら重複）`);
}

// ---- 10) 新しい年は末尾に追加されること ----
{
  const c = makeCtx();
  c.__T.editionSheetRows = []; c.__T.lineupSheetRows = [];
  c.__T.editionSheetMaxRow = 98; c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetLoaded = true;
  c.__T.editionRowById = new Map([['loa-2025', 54]]);
  c.gasWriteSucceeded = () => true;
  await c.syncNewEditionRows('loa', [{ year:'2027', date:'2027-08-15', lineup:[] }]);
  const call = c.__calls.find(x => x.sheet === 'EDITIONS');
  check('新しい年は末尾に足す', call?.row === 99, `row=${call?.row}`);
}

// ---- 11) 読み込み失敗のまま保存しようとしたら止まること ----
{
  const c = makeCtx();
  c.__T.editionSheetLoaded = false;
  c.__T.editionSheetLoadError = 'EDITIONS シートを読めませんでした';
  c.__T.editions.length = 0;
  c.__T.editions.push({ year:'2026', date:'2026-08-15' });
  let msg = '';
  c.toast = (m) => { msg = m; };
  c.__T.editState.festival = { _row: 5 };
  c.saveEdit('festival');
  check('読み込み失敗のまま保存させない',
    /読み込め|重複します/.test(msg), msg.slice(0, 40) || '(止まらなかった)');
}

console.log('\n検証項目'.padEnd(52) + '判定  実測');
console.log('-'.repeat(96));
let fail = 0;
for (const [name, pass, detail] of results) {
  if (!pass) fail++;
  console.log(name.padEnd(50) + '  ' + (pass ? '✅' : '❌') + '   ' + detail);
}
console.log('-'.repeat(96));
console.log(fail ? `❌ ${fail}件 失敗` : `✅ 全${results.length}件 通過`);
process.exit(fail ? 1 : 0);
