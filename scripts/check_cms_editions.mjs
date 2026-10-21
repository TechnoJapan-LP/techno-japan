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
  duplicateEditionRows,
  editionKeyParts,
  editionLabel,
  editionDraft,
  get lineups(){return lineups},
  nextEditionYear,
  get editions(){return editions},
  addEdition,
  addSameYearEdition,
  ensureFestivalEditionForSave,
  validateBeforeSave,
  buildFullDataJs,
  syncExistingEditionRows,
  syncNewFestivalAfterAdd,
  saveEdit,
  festivalEditionsForSave,
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

// ---- 0f) 保存成功後の処理は全セクションで例外にならず、フェス同期も実行する ----
for (const section of ['venue', 'artist', 'article', 'festival']) {
  const c = makeCtx();
  const values = {
    'v-id': 'venue-id', 'v-name': 'Venue',
    'a-id': 'artist-id', 'a-name': 'Artist',
    'ar-id': 'article-id', 'ar-title': 'Article',
    'f-id': 'festival-id', 'f-name': 'Festival',
  };
  const originalGet = c.document.getElementById;
  c.document.getElementById = (id) => ({...originalGet(id), value: values[id] || ''});
  c.__T.editState[section] = {_row: 12};
  c.__T.editions.length = 0;
  c.__T.editionSheetLoaded = true;
  c.__T.lineups.f = [];
  c.gasPostJson_ = async () => ({status: 'ok'});
  c.validateBeforeSave = () => [];
  c.getPubFields = () => ({});
  c.applyOptimisticUpdate = () => {};
  c.clearFormDirty = () => {};
  c.cancelEdit = () => {};
  c.switchTab = () => {};
  c.rerenderListFromCache = () => {};
  c.loadList = () => {};
  c.toast = () => {};
  c.flushArticleEditorSync = () => {};
  c.getArticleBodyForSave = () => 'body';
  c.syncFestivalDateToLatestEdition = () => {};
  const syncCalls = [];
  c.syncExistingEditionRows = async () => { syncCalls.push('existing'); };
  c.syncNewEditionRows = async () => { syncCalls.push('new'); };
  let postProcessError = null;
  c.aiFail = (_where, message) => { postProcessError = message; };
  c.saveEdit(section);
  await new Promise(resolve => setTimeout(resolve, 0));
  check(`saveEdit(${section}) の成功応答で後処理例外が起きない`, postProcessError === null, postProcessError || '例外なし');
  if (section === 'festival') {
    check('フェス保存成功後に既存回・新規回の同期を呼ぶ', syncCalls.join(',') === 'existing,new', syncCalls.join(',') || '呼び出しなし');
  }
}

// 成功応答後の例外は通信エラーではなく、保存完了後処理として表示する。
{
  const c = makeCtx();
  c.__T.editState.venue = {_row: 12};
  c.gasPostJson_ = async () => ({status: 'ok'});
  c.validateBeforeSave = () => [];
  c.getPubFields = () => ({});
  c.applyOptimisticUpdate = () => {};
  c.clearFormDirty = () => {};
  c.cancelEdit = () => {};
  c.switchTab = () => {};
  c.rerenderListFromCache = () => {};
  c.toast = () => {};
  c.loadList = () => { throw new Error('reload failed'); };
  let message = '';
  c.aiFail = (_where, text) => { message = text; };
  c.saveEdit('venue');
  await new Promise(resolve => setTimeout(resolve, 0));
  check('保存成功後の例外を通信エラーと区別して表示する', message.includes('保存は完了しましたが、後処理でエラーが発生しました: reload failed'), message || '表示なし');
}

// ---- 0e) 開催回ゼロ＋日程ありの保存救済 -------------------------------
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  c.__T.lineups.f = ['artist-id', 'Artist label'];
  c.toast = () => {}; c.markFormDirty = () => {}; c.renderEditions = () => {};
  const originalGet = c.document.getElementById;
  c.document.getElementById = (id) => {
    const values = {'f-location':'Venue','f-location_ja':'会場','f-city':'TOKYO','f-address':'Address','f-lat':'35','f-lng':'139','f-ticketUrl':'https://tickets.example','f-flyer':'flyer.webp','f-status':'published'};
    return {...originalGet(id), value: values[id] || ''};
  };
  c.__T.ensureFestivalEditionForSave('2026-08-15', '2026-08-16');
  const created = c.__T.editions[0];
  check('開催回0件＋日程ありで同年の開催回を1件作る', c.__T.editions.length === 1 && created.year === '2026' && created.date === '2026-08-15/2026-08-16', JSON.stringify(created));
  check('自動作成回へフォーム値を引き継ぐ', created.location === 'Venue' && created.location_ja === '会場' && created.pref === 'TOKYO' && created.address === 'Address' && created.lat === '35' && created.lng === '139' && created.ticketUrl === 'https://tickets.example' && created.flyer === 'flyer.webp' && created.status === 'published', JSON.stringify(created));
  check('自動作成回へフェスLINEUPを引き継ぐ', JSON.stringify(created.lineup) === JSON.stringify(['artist-id', 'Artist label']), JSON.stringify(created.lineup));
  c.__T.editions.length = 0;
  check('日程が無い場合は開催回を作らない', c.__T.ensureFestivalEditionForSave('', '') === '' && c.__T.editions.length === 0, JSON.stringify(c.__T.editions));
  c.__T.editions.push({year:'2025'});
  check('既存の開催回がある場合は動作を変えない', c.__T.ensureFestivalEditionForSave('2026-08-15', '') === '' && c.__T.editions.length === 1, JSON.stringify(c.__T.editions));
}

// ---- 0e) FESTIVALS.EDITIONS の保存payloadから作業用台帳を除く ----------------
{
  const c = makeCtx();
  const source = [
    {year:'2026', _row:109, _editionId:'same-fest-2026',
      _sheetRow:{EDITION_ID:'same-fest-2026', DATE_START:'2026-08-15'},
      _lineupRows:[{_row:401, ACT_LABEL:'DJ'}], lineup:['DJ']}
  ];
  const payloadEditions = c.__T.festivalEditionsForSave(source);
  const serialized = JSON.stringify({editions:payloadEditions});
  check('保存payloadのEDITIONS JSONに作業用台帳を含めない',
    !serialized.includes('_sheetRow') && !serialized.includes('_lineupRows')
      && serialized.includes('"_row":109') && serialized.includes('"_editionId":"same-fest-2026"'),
    serialized);
  check('EDITIONS保存用コピーが画面のeditions配列を変更しない',
    source[0]._sheetRow?.EDITION_ID === 'same-fest-2026'
      && source[0]._lineupRows?.[0]?._row === 401,
    JSON.stringify(source));
}

// ---- 0b) 同年複数開催の識別子・表示規則 ------------------------------
{
  const c = makeCtx();
  check('EDITION識別子を年と連番に分解する',
    JSON.stringify(c.__T.editionKeyParts('2026')) === JSON.stringify({year:2026,seq:1})
      && JSON.stringify(c.__T.editionKeyParts('2026-2')) === JSON.stringify({year:2026,seq:2})
      && c.__T.editionKeyParts('').year === 0 && c.__T.editionKeyParts('26').seq === 0,
    JSON.stringify([c.__T.editionKeyParts('2026'), c.__T.editionKeyParts('2026-2'), c.__T.editionKeyParts(''), c.__T.editionKeyParts('26')]));
  check('EDITION表示を連番形式に整形する',
    c.__T.editionLabel('2026') === '2026' && c.__T.editionLabel('2026-2') === '2026 #2',
    `${c.__T.editionLabel('2026')} / ${c.__T.editionLabel('2026-2')}`);
}

// ---- 0c) 同年2件は検証を通し、同一EDITION値は弾く ----------------------
{
  const c = makeCtx();
  const base = { id:'same-fest', date:'2026-08-15', editions:[
    {year:'2026', date:'2026-08-15'}, {year:'2026-2', date:'2026-08-20'}
  ]};
  const valid = c.__T.validateBeforeSave('festival', base);
  const duplicate = c.__T.validateBeforeSave('festival', {...base, editions:[...base.editions, {year:'2026-2', date:'2026-08-21'}]});
  check('同年2件（2026 / 2026-2）の検証を通す', valid.length === 0, valid.join(' / '));
  check('同じEDITION値の重複は検出する', duplicate.some(x => x.includes('EDITIONSの開催回が重複しています: 2026-2')), duplicate.join(' / '));
}

// ---- 0d) 同年追加・data.js出力 ----------------------------------------
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  c.__T.editions.push({year:'2026', location:'Venue', address:'Address', lat:'1', lng:'2'});
  c.toast = () => {}; c.markFormDirty = () => {}; c.renderEditions = () => {};
  c.__T.addSameYearEdition();
  const created = c.__T.editions.at(-1);
  const source = c.__T.buildFullDataJs({FESTIVALS:[{id:'same-fest',name:'Same Fest',status:'published',editions:[{year:'2026-2',date:'2026-08-20',lineup:[]}]}]});
  let evaluated = true;
  try { new Function(source + '\nreturn FESTIVALS;'); } catch (_) { evaluated = false; }
  check('同じ年の開催回を2026-2で追加する', created?.year === '2026-2' && created.location === 'Venue' && !created.date && !created.ticketUrl && !created.flyer && created.lineup.length === 0, JSON.stringify(created));
  check('data.js出力は数値yearとeditionKey文字列を持ち構文評価できる', source.includes('year: 2026, editionKey: "2026-2"') && !source.includes('edition: "2026-2"') && evaluated, source.match(/year: 2026[^\n]*/)?.[0] || '該当なし');
  const s = makeCtx();
  s.__T.editionSheetRows = []; s.__T.lineupSheetRows = [];
  s.__T.editionSheetMaxRow = 98; s.__T.lineupSheetMaxRow = 400; s.__T.editionSheetLoaded = true;
  s.gasWriteSucceeded = () => true;
  await s.syncNewEditionRows('same-fest', [{year:'2026-2', date:'2026-08-20', lineup:[]}]);
  check('同年連番のEDITION_IDを生成する', s.__calls.find(x => x.sheet === 'EDITIONS')?.EDITION_ID === 'same-fest-2026-2', s.__calls.find(x => x.sheet === 'EDITIONS')?.EDITION_ID || 'なし');
}

// ---- 0a) 既存シートの重複を読み込み時点で止めること ------------------------
{
  const c = makeCtx();
  const dup = c.__T.duplicateEditionRows([
    { EDITION_ID: 'mutek-2026', _row: 108 },
    { EDITION_ID: 'mutek-2026', _row: 114 },
    { EDITION_ID: 'mutek-2025', _row: 107 },
  ]);
  check('既存EDITIONSの重複を行番号付きで検出する',
    dup.length === 1 && dup[0].id === 'mutek-2026'
      && dup[0].rowNums.join(',') === '108,114', JSON.stringify(dup));
}

// ---- 0) Add Edition の提案年と確認 ----------------------------------------
{
  const c = makeCtx();
  c.__T.editions.length = 0;
  check('開催回1件の次年を求める',
    (c.__T.editions.push({ year: '2025' }), c.__T.nextEditionYear() === '2026'), c.__T.nextEditionYear());
  c.__T.editions.push({ year: '2026' });
  check('開催回2件の最大年の次年を求める', c.__T.nextEditionYear() === '2027', c.__T.nextEditionYear());
  c.__T.editions.length = 0;
  c.__T.editions.push({ year: '2026' }, { year: '2026-2' });
  check('同年連番を同じ年として次年を求める', c.__T.nextEditionYear() === '2027', c.__T.nextEditionYear());
  c.__T.editions.length = 0;
  check('開催回が空なら今年を求める', c.__T.nextEditionYear() === String(new Date().getFullYear()), c.__T.nextEditionYear());

  c.__T.editions.push({ year: '2026', date: '2026-08-15' });
  c.toast = () => {};
  c.markFormDirty = () => {};
  c.renderEditions = () => {};
  c.confirm = () => false;
  const beforeCancel = c.__T.editions.length;
  c.__T.addEdition();
  check('確認キャンセル時はAdd Editionを追加しない', c.__T.editions.length === beforeCancel, `件数=${c.__T.editions.length}`);

  c.__T.editions.length = 0;
  c.__T.editions.push({ year: '2026', date: '2026-08-15' });
  c.confirm = () => true;
  const proposedYear = c.__T.nextEditionYear();
  c.__T.addEdition();
  check('既存回がある場合はAdd Editionを翌年で作る',
    c.__T.editions.length === 2 && c.__T.editions.at(-1)?.year === proposedYear,
    `件数=${c.__T.editions.length} / 追加年=${c.__T.editions.at(-1)?.year}`);
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

// ---- 2e) 新規フェス保存後もEDITIONS / LINEUPSへ同期する ----------------
{
  const c = makeCtx();
  c.__T.editionSheetLoaded = true;
  c.__T.editionSheetMaxRow = 98; c.__T.lineupSheetMaxRow = 400;
  c.__T.editionSheetRows = []; c.__T.lineupSheetRows = [];
  await c.__T.syncNewFestivalAfterAdd('new-festival', [{year:'2026',date:'2026-08-15',location:'Venue',lineup:['Noripan']}]);
  const edition = c.__calls.find(x => x.sheet === 'EDITIONS');
  const lineup = c.__calls.find(x => x.sheet === 'LINEUPS');
  check('新規フェス保存後にEDITIONSとLINEUPSへ書き込む',
    edition?.EDITION_ID === 'new-festival-2026' && lineup?.EDITION_ID === 'new-festival-2026' && lineup?.ACT_LABEL === 'Noripan',
    JSON.stringify({edition,lineup}));
  const blocked = makeCtx();
  blocked.__T.editionSheetLoaded = false;
  let blockedError = null;
  await blocked.__T.syncNewFestivalAfterAdd('new-festival', [{year:'2026',lineup:['Noripan']}]).catch(e => blockedError = e);
  check('EDITIONSを読めていない新規フェスは書き込まない',
    blockedError && blocked.__calls.length === 0, blockedError?.message || '書き込みが発生');
}

// ---- 3) 新規開催回はシート全体の末尾に追記されること ----
// ---- 2b) 既存行の行番号を数値化して更新すること -----------------------
{
  const c = makeCtx();
  c.gasWriteSucceeded = () => true;
  await c.syncExistingEditionRows('grow-the-culture-open-air', [{
    _row: '109', _editionId: 'grow-the-culture-open-air-2026',
    _sheetRow: { EDITION_ID: 'grow-the-culture-open-air-2026', FESTIVAL_ID: 'grow-the-culture-open-air' },
    year: '2026', flyer: 'images/festivals/grow-the-culture-open-air-2026-flyer.webp', lineup: [], _lineupRows: []
  }]);
  const call = c.__calls.find(x => x.sheet === 'EDITIONS');
  check('既存EDITIONの文字列行番号を数値化して更新する',
    call?.row === 109 && call?.FLYER.includes('grow-the-culture-open-air-2026-flyer.webp'),
    `row=${call?.row} / FLYER=${call?.FLYER}`);
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
  check('EDITION_ID は {festivalId}-{EDITION}',
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
