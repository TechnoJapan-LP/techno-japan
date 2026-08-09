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

const BRIDGE = `;globalThis.__T = { publishSanityCheck };`;
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

console.log();
if (failed) { console.log(`❌ ${failed}件の判定が誤っています`); process.exit(1); }
console.log('✅ Publish 前の重複検査はすべて正しい');
