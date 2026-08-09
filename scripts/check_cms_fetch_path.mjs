#!/usr/bin/env node
/**
 * Publish が「列を落とさない経路」でデータを取っているかを検証する。
 *
 * ■ 何を守るか（AUDIT §9-67）
 *
 *   2026-08-09、記事に追加した festivalId / cardRatio / heroRatio / views の
 *   4列が、**編集画面には出るのに data.js には入らなかった。**
 *   以前からある title_en などは両方に出ていた。
 *
 *   取得経路が2つあり、返ってくる列が違っていた。
 *
 *     編集・一覧  … get_sheet（1枚ずつ）   → 新しい列が出る
 *     Publish     … get_all_sheets（一括） → 新しい列が落ちる
 *
 *   落ちても**エラーは出ない。**Publish は成功し、コミットは空になり、
 *   「押したのに何も変わらない」という形でしか気づけなかった。
 *
 *   Publish と書き出しは `perSheet:true` で1枚ずつ取る。
 *   公開は頻度が低いので、5回に増えても実用上の差は無い。
 *
 * ■ 何を見るか
 *
 *   1. perSheet:true のとき get_all_sheets を**呼ばない**
 *   2. perSheet 無しのときは従来どおり一括で取る（既存動作を壊さない）
 *   3. Publish と Export の呼び出しが perSheet:true になっている
 *
 * 使い方:
 *   node scripts/check_cms_fetch_path.mjs
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');
const source = fs.readFileSync(CMS_PATH, 'utf8');

let failed = 0;
const check = (name, pass, detail = '') => {
  if (pass) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

function makeCtx(rowsBySheet) {
  const urls = [];
  const ctx = {
    console,
    document: {
      documentElement: { lang: 'ja' },
      getElementById: () => ({ value:'', addEventListener(){}, querySelectorAll:()=>[], style:{},
        classList:{add(){},remove(){},toggle(){},contains:()=>false} }),
      querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
      createElement: () => ({ style:{}, classList:{add(){},remove(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }),
      body: { appendChild(){}, classList:{add(){},remove(){},toggle(){}} },
      head: { appendChild(){} }, cookie: '',
    },
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    sessionStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    location: { href: 'http://x/cms.html', search: '', hash: '', origin: 'http://x' },
    navigator: { userAgent: 'node', onLine: true },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async (url) => {
      urls.push(String(url));
      const u = new URL(String(url), 'http://x');
      const action = u.searchParams.get('action');
      if (action === 'get_all_sheets') {
        // 一括経路は「新しい列を落とす」壊れた状態を再現する。
        const sheets = {};
        for (const s of (u.searchParams.get('sheets') || '').split(',')) {
          sheets[s] = (rowsBySheet[s] || []).map(({ festivalId, ...rest }) => rest);
        }
        return { json: async () => ({ status: 'ok', sheets }) };
      }
      if (action === 'get_sheet') {
        const s = u.searchParams.get('sheet');
        return { json: async () => ({ status: 'ok', rows: rowsBySheet[s] || [] }) };
      }
      return { json: async () => ({ status: 'ok' }) };
    },
    __urls: urls,
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
  try { vm.runInContext(source + ';globalThis.__T={fetchAllSheets};', ctx, { filename: 'cms.js' }); }
  catch (e) { console.log('  (読み込み時エラー: ' + e.message + ')'); }
  return ctx;
}

const ROWS = {
  ARTICLES: [{ id: 'a1', title: 'T', status: 'published', festivalId: 'loa-lost-paradise', _row: 2 }],
  VENUES: [{ id: 'v1', _row: 2 }], FESTIVALS: [{ id: 'f1', _row: 2 }],
  ARTISTS: [{ id: 'ar1', _row: 2 }], EVENTS: [],
};

console.log('取得経路');
{
  const c = makeCtx(ROWS);
  const d = await c.__T.fetchAllSheets(['ARTICLES'], { fresh: true, perSheet: true });
  check('perSheet では一括エンドポイントを呼ばない',
    !c.__urls.some((u) => u.includes('get_all_sheets')), c.__urls.join(' , '));
  check('perSheet なら新しい列が残る', d.ARTICLES?.[0]?.festivalId === 'loa-lost-paradise',
    JSON.stringify(d.ARTICLES?.[0]));
}
{
  const c = makeCtx(ROWS);
  await c.__T.fetchAllSheets(['ARTICLES'], { fresh: true });
  check('perSheet 無しは従来どおり一括で取る（既存動作を壊さない）',
    c.__urls.some((u) => u.includes('get_all_sheets')));
}

console.log('\n呼び出し側');
{
  const publishLine = source.split('\n').find((l) => l.includes("action: 'publish_data_js'"));
  const calls = source.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => l.includes("fetchAllSheets(['VENUES','FESTIVALS','ARTISTS','EVENTS','ARTICLES'],{fresh:true"));
  check('Publish と Export の2経路が見つかる', calls.length === 2, `${calls.length}件`);
  check('その2経路とも perSheet:true になっている',
    calls.every(([, l]) => l.includes('perSheet:true')),
    calls.map(([n]) => n + '行目').join(' , '));
  check('publish_data_js の呼び出しは残っている', !!publishLine);
}

console.log();
if (failed) { console.log(`❌ ${failed}件が誤っています`); process.exit(1); }
console.log('✅ Publish は列を落とさない経路でデータを取っている');
