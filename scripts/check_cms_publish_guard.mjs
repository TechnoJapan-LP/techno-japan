#!/usr/bin/env node
/**
 * Publish を押す前の関門（publishSanityCheck）が、必ず失敗する状態を
 * ちゃんと止めるかを検証する。
 *
 * ■ 何を守るか（AUDIT §9-66）
 *
 *   EDITIONS に同じ EDITION_ID の行が2つあると、fetch-data.mjs が
 *   「エラー」で書き出しを止めるため **Publish は必ず失敗する。**
 *
 *   ところが CMS は EDITIONS を取得しておらず、押した時点では成功したように
 *   見えていた。失敗が分かるのは20分後、CI が赤くなってから。
 *
 *   2026-08-09、synapse-festival-2026 の重複1行が消し漏れており、
 *   **丸1日 Publish が同じ理由で失敗し続けていた。**
 *   8/8 02:47 の時点では16件の重複があり、消したときに1件だけ残った。
 *
 *   押す前に、行番号まで出して止める。
 *
 * ■ 通してはいけないもの / 止めてはいけないもの
 *
 *   止める : EDITION_ID の重複
 *   通す   : LINEUPS の EDITION_ID 重複（出演者ごとに1行なので正しい）
 *   通す   : EDITIONS を取得できなかった場合（この検査のために Publish 自体を
 *            止めない。取得失敗は別の問題）
 *   通す   : EDITION_ID が空の行（別の検査の担当）
 *
 * 使い方:
 *   node scripts/check_cms_publish_guard.mjs
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');

const BRIDGE = `;globalThis.__T = {
  publishSanityCheck,
  publishPayloadSummary,
  buildVenuesJs,
  fetchPublishedDataJs,
  validateEditionSyncBeforeSave,
  setEditionSheetState: (loaded, rows) => {
    editionSheetLoaded = loaded;
    editionSheetLoadError = '';
    editionRowById = new Map(rows || []);
  }
};`;
const src = fs.readFileSync(CMS_PATH, 'utf8') + BRIDGE;

function makeCtx() {
  const el = () => ({ value: '', addEventListener(){}, querySelectorAll:()=>[], style:{},
    classList:{add(){},remove(){},toggle(){}} });
  const ctx = {
    console,
    document: {
      documentElement: { lang: 'ja' }, getElementById: el,
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      createElement: () => ({ style:{}, classList:{add(){},remove(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }),
      body: { appendChild(){}, classList:{add(){},remove(){},toggle(){}} },
      head: { appendChild(){} }, cookie: '',
    },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { href: 'http://localhost/cms.html', search: '', hash: '', origin: 'http://localhost' },
    navigator: { userAgent: 'node', onLine: true },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async () => ({ json: async () => ({ status: 'ok' }) }),
    prompt: () => 'x', confirm: () => true, alert: () => {},
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: (f) => setTimeout(f, 0), scrollTo(){}, getComputedStyle: () => ({}),
    history: { replaceState(){}, pushState(){} },
    IntersectionObserver: class { observe(){} unobserve(){} disconnect(){} },
    URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto: { subtle: { digest: async () => new ArrayBuffer(32) }, getRandomValues: (a) => a },
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  try { vm.runInContext(src, ctx, { filename: 'cms.js' }); }
  catch (e) { console.log('  (読み込み時エラー: ' + e.message + ')'); }
  return ctx;
}

/** 重複以外では引っかからない、最低限まともなデータ。 */
const BASE = {
  FESTIVALS: [{ ID: 'f1', DATE: '2026-10-02', LOCATION: 'X', LOCATION_JA: '' }],
  ARTISTS: [{ ID: 'a1' }],
  VENUES: [{ ID: 'v1' }],
  ARTICLES: [{ ID: 'ar1' }],
  EVENTS: [],
};

let failed = 0;
const check = (name, pass, detail = '') => {
  if (pass) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

const c = makeCtx();

/* --- -1. 空コミットを成功扱いしない経路 ------------------------------- */
{
  console.log('空コミット防止の経路');
  check('公開内容の比較に失敗したら送信を止める',
    /fetchPublishedDataJs/.test(src)
      && !/\.catch\(\(\) => null\)/.test(src)
      && /空コミット防止のため公開を停止しました/.test(src));
  const summary = c.__T.publishPayloadSummary([
    'const VENUES = [', '  {', '    id: "v",',
    '    features: ["after-hours"],', '  },', '];',
  ].join('\n'));
  check('Publish要約にFEATURES件数を表示する', /FEATURES 1/.test(summary), summary);
}

/* --- 0. 保存開始前のEDITION同期チェック ------------------------------- */
{
  console.log('保存開始前のEDITION同期チェック');
  c.__T.setEditionSheetState(true, [['festival-2026', 12]]);
  const ok = c.__T.validateEditionSyncBeforeSave('festival', [
    { year: '2026', _editionId: 'festival-2026', _row: 12 },
  ]);
  check('正常な既存開催回を通す', ok.length === 0);

  const duplicate = c.__T.validateEditionSyncBeforeSave('festival', [
    { year: '2026', _editionId: 'festival-2026', _row: 12 },
    { year: '2026' },
  ]);
  check('同じ開催年の保存を開始前に止める', duplicate.some(x => x.includes('festival-2026')));

  const mismatch = c.__T.validateEditionSyncBeforeSave('festival', [
    { year: '2026', _editionId: 'festival-2025', _row: 12 },
  ]);
  check('開催回IDと年の不一致を止める', mismatch.some(x => x.includes('IDと年が一致しません')));

  c.__T.setEditionSheetState(false);
  const loadError = c.__T.validateEditionSyncBeforeSave('festival', [{ year: '2026' }]);
  check('シート未読込時に保存を止める', loadError.length === 1);
}

/* --- 1. 実際に起きた事故（2026-08-09）をそのまま再現する ------------------ */
{
  console.log('実際に起きた事故（synapse-festival-2026 の重複）');
  const r = c.__T.publishSanityCheck({
    ...BASE,
    EDITIONS: [
      { EDITION_ID: 'synapse-festival-2026', FESTIVAL_ID: 'synapse-festival', _row: 92 },
      { EDITION_ID: 'synapse-festival-2026', FESTIVAL_ID: 'synapse-festival', _row: 107 },
      { EDITION_ID: 'other-2026', FESTIVAL_ID: 'other', _row: 5 },
    ],
  });
  check('重複があれば止める', r.ok === false);
  check('どの ID か伝える', String(r.message).includes('synapse-festival-2026'));
  check('どの行かまで伝える',
    String(r.message).includes('92行目') && String(r.message).includes('107行目'),
    r.message);
}

/* --- 2. 止めてはいけないもの -------------------------------------------- */
{
  console.log('\n止めてはいけないもの');

  check('重複が無ければ通す',
    c.__T.publishSanityCheck({ ...BASE, EDITIONS: [
      { EDITION_ID: 'a-2026', _row: 2 }, { EDITION_ID: 'b-2026', _row: 3 },
    ] }).ok === true);

  check('EDITIONS を取れなかった場合は通す（Publish 自体は止めない）',
    c.__T.publishSanityCheck({ ...BASE }).ok === true);

  check('EDITION_ID が空の行は重複扱いしない',
    c.__T.publishSanityCheck({ ...BASE, EDITIONS: [
      { EDITION_ID: '', _row: 2 }, { EDITION_ID: '', _row: 3 }, { EDITION_ID: 'a-2026', _row: 4 },
    ] }).ok === true);

  check('LINEUPS で同じ EDITION_ID が並んでいても通す（出演者ごとに1行）',
    c.__T.publishSanityCheck({ ...BASE, EDITIONS: [{ EDITION_ID: 'a-2026', _row: 2 }],
      LINEUPS: [
        { EDITION_ID: 'a-2026', ACT_LABEL: 'DJ 1', _row: 2 },
        { EDITION_ID: 'a-2026', ACT_LABEL: 'DJ 2', _row: 3 },
      ] }).ok === true);
}

/* --- 3. 複数の重複 ------------------------------------------------------- */
{
  console.log('\n複数ある場合');
  const r = c.__T.publishSanityCheck({ ...BASE, EDITIONS: [
    { EDITION_ID: 'a-2026', _row: 2 }, { EDITION_ID: 'a-2026', _row: 9 },
    { EDITION_ID: 'b-2025', _row: 3 }, { EDITION_ID: 'b-2025', _row: 10 },
  ] });
  check('2件とも挙げる',
    r.ok === false && String(r.message).includes('a-2026') && String(r.message).includes('b-2025'));

  const many = Array.from({ length: 24 }, (_, i) => [
    { EDITION_ID: `x${i}-2026`, _row: i * 2 + 2 },
    { EDITION_ID: `x${i}-2026`, _row: i * 2 + 3 },
  ]).flat();
  const r2 = c.__T.publishSanityCheck({ ...BASE, EDITIONS: many });
  check('多すぎるときは省略して件数を出す',
    r2.ok === false && String(r2.message).includes('他 14 件'), r2.message);
}

/* --- 4. 列名の綴り違い（シートにあるのに読めていない列） ------------------ */
{
  console.log('\n列名の綴り違い');

  const withCol = (col) => c.__T.publishSanityCheck({
    ...BASE,
    ARTICLES: [{ id: 'a1', title: 'T', status: 'published', [col]: 'loa-lost-paradise', _row: 2 }],
  });

  // confirm は true を返すので ok:true のまま。message ではなく
  // 「警告が出たか」を confirm の呼び出しで見る。
  const asked = [];
  c.confirm = (msg) => { asked.push(msg); return true; };

  asked.length = 0; withCol('FestivalId');
  check('大文字違い FestivalId を指摘する',
    asked.some(m => m.includes('FestivalId') && m.includes('festivalId')), asked.join(' / '));

  asked.length = 0; withCol('FESTIVAL_ID');
  check('区切り違い FESTIVAL_ID を指摘する',
    asked.some(m => m.includes('FESTIVAL_ID') && m.includes('festivalId')));

  asked.length = 0; withCol('VIEWS');
  check('VIEWS → views を指摘する',
    asked.some(m => m.includes('VIEWS') && m.includes('views')));

  asked.length = 0; withCol('festivalId');
  check('正しい綴りなら何も言わない', asked.length === 0, asked.join(' / '));

  asked.length = 0; withCol('編集メモ');
  check('関係ない列では鳴らない（メモ用の列などで毎回鳴らせない）',
    asked.length === 0, asked.join(' / '));

  asked.length = 0;
  c.__T.publishSanityCheck({ ...BASE, ARTICLES: [{ id:'a1', title:'T', status:'published', _row:2 }] });
  check('列が無いだけなら鳴らない', asked.length === 0);

  c.confirm = () => true;
}

/* --- 5. 名寄せ済みなら「綴りが違う」と言わないこと ------------------------ */
{
  console.log('\n名寄せ後の誤警告');
  const asked = [];
  c.confirm = (msg) => { asked.push(msg); return true; };

  // canonicalizeRows を通した後の行（小文字キーと正しい綴りが両方ある）。
  asked.length = 0;
  c.__T.publishSanityCheck({ ...BASE, ARTICLES: [
    { id:'a1', title:'T', status:'published', _row:2,
      festivalid:'loa', festivalId:'loa', readtime:3, readTime:3 },
  ]});
  check('取得経路の都合で小文字キーが残っていても黙る（2026-08-09 の誤報告）',
    asked.length === 0, asked.join(' / '));

  // 名寄せできなかった場合だけ言う。
  asked.length = 0;
  c.__T.publishSanityCheck({ ...BASE, ARTICLES: [
    { id:'a1', title:'T', status:'published', _row:2, 'festival id':'loa' },
  ]});
  check('正しい綴りが無ければ従来どおり指摘する',
    asked.some(m => m.includes('festivalId')), asked.join(' / '));

  c.confirm = () => true;
}

/* --- 6. 送る中身を数で見せる / 無変更を成功と呼ばない（§9-81） --------------
   Publish の事故は症状がいつも「静か」だった。列が落ちても件数が減るだけ、
   中身が同じなら空コミット、失敗しても3秒で消える。
   検査はモックで通っていたが、モックは GAS の実挙動を再現できない。
   最後の砦を「実際に送る中身そのもの」に置く。 */
{
  console.log('\n送信前の要約');

  const DATA = [
    'const FESTIVALS = [',
    '  {', '    id: "a",', '  },', '  {', '    id: "b",', '  },', '];',
    '',
    'const ARTISTS = [',
    '  {', '    id: "x",', '    bio: "…",', '    image: "i.webp",', '    links: {},', '  },',
    '  {', '    id: "y",', '  },', '];',
    '',
    'const VENUES = [', '  {', '    id: "v",',
    '    subtype: "dj-bar",', '    hours: "20:00–03:00",',
    '    charge: "no-cover",', '    features: ["after-hours", "vinyl"],',
    '  },', '];',
    '',
    'const ARTICLES = [',
    '  {', '    id: "ar",', '    body_en: "…",', '    festivalId: "a",', '  },', '];',
    '',
    'const EVENTS = [', '];',
  ].join('\n');

  const sum = c.__T.publishPayloadSummary(DATA);
  check('フェスの件数を出す', /FESTIVALS\s+2件/.test(sum), sum);
  check('アーティストの件数と内訳を出す',
    /ARTISTS\s+2件（紹介文 1 \/ 画像 1 \/ リンク 1）/.test(sum), sum);
  check('記事の英語本文と関連フェスの数を出す',
    /ARTICLES\s+1件（英語本文 1 \/ 関連フェス 1）/.test(sum), sum);
  check('VENUESの4列の件数を出す',
    /VENUES\s+1件（SUBTYPE 1 \/ HOURS 1 \/ CHARGE 1 \/ FEATURES 1）/.test(sum), sum);
  const venueJs = c.__T.buildVenuesJs([{
    id: 'v1', name: 'Test Bar', subtype: 'dj-bar', hours: '20:00–03:00',
    charge: 'no-cover', features: 'after-hours;vinyl, no-cover',
  }]);
  check('VENUESの4列をdata.jsへ出力する',
    /subtype: "dj-bar"/.test(venueJs)
      && /hours: "20:00–03:00"/.test(venueJs)
      && /charge: "no-cover"/.test(venueJs)
      && /features: \["after-hours", "vinyl", "no-cover"\]/.test(venueJs), venueJs);
  check('ファイルの大きさを出す', /ファイルの大きさ \d+KB/.test(sum), sum);

  // §9-67 / §9-69 の再現: 列が落ちると数字が減って目に入る
  const dropped = DATA
    .replace('    bio: "…",\n', '')
    .replace('    image: "i.webp",\n', '')
    .replace('    subtype: "dj-bar",\n', '')
    .replace('    hours: "20:00–03:00",\n', '')
    .replace('    charge: "no-cover",\n', '')
    .replace('    features: ["after-hours", "vinyl"],\n', '');
  const sum2 = c.__T.publishPayloadSummary(dropped);
  check('列が落ちると件数が減って見える（§9-67 の再現）',
    /紹介文 0 \/ 画像 0/.test(sum2), sum2);
  check('VENUESの4列が落ちると0件になる',
    /VENUES\s+1件（SUBTYPE 0 \/ HOURS 0 \/ CHARGE 0 \/ FEATURES 0）/.test(sum2), sum2);
}

console.log();
if (failed) { console.log(`❌ ${failed}件の判定が誤っています`); process.exit(1); }
console.log('✅ Publish 前の重複検査はすべて正しい');
