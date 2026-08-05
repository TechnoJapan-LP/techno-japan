#!/usr/bin/env node
/**
 * Service Worker のルーティング回帰ガード。
 *
 * なぜ必要か:
 *   sw.js の fetch ハンドラは上から順に評価され、最初に一致した分岐で return する。
 *   v1.12.0 では data.js の stale-while-revalidate 分岐が CSS/JS の cache-first 判定
 *   より後ろに置かれており、到達不能だった。url.pathname はクエリを含まないため
 *   /data.js?v=7 の pathname は /data.js となり /\.js$/ にも一致してしまう。
 *   結果、一度サイトを見たブラウザには古い data.js が返り続け、Publish Now しても
 *   新しいフェスが一覧に出なかった（HACHA MECHA / 2026-08-02）。
 *
 *   コードを読んでも「上に別の分岐がある」ことには気づきにくい。分岐の存在ではなく
 *   「実際にどの戦略が呼ばれるか」を確かめる必要がある。
 *
 * どう検査するか:
 *   sw.js を Node 上でスタブ環境に読み込み、合成した fetch イベントを流して
 *   caches / fetch の呼ばれ方から実際に選ばれた戦略を判定する。
 *   正規表現で sw.js を読むのではなく実行するので、分岐の並べ替えや
 *   条件式の書き換えにも追随する。
 *
 * 使い方:
 *   node scripts/check_sw_routing.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = join(ROOT, 'LP', 'sw.js');
const ORIGIN = 'https://techno-japan.media';

/**
 * Publish / CI が自動 commit するため、参照元 HTML の ?v を人が上げる機会が無いファイル。
 * これらを cache-first に置くと、一度訪問したブラウザに永久に古い内容が返る。
 *
 * data.js — CMS の Publish Now が commit する（git log の "cms: publish data.js"）。
 *   ?v=7 は固定のまま中身だけが変わるので、キャッシュキーで鮮度を管理できない。
 *
 * ここに載っていない JS/CSS（common.js, image-dimensions.js 等）は人が編集して
 * commit するものなので、?v を上げる運用で足りる。その運用漏れは
 * scripts/check_asset_versions.py が別途止める。
 */
/* 【query の値は判定に影響しない】sw.js は url.pathname で分岐するため、
   ?v が幾つでもルーティングは変わらない。ここに値を書いているのは
   「クエリ付きでも pathname 判定が効くこと」を再現するためだけで、
   実態と一致していなくても検査は正しく動く。
   とはいえ古い値が残ると読む人を誤解させるので、2026-08-03 時点の
   実値に合わせてある。ズレても慌てて直す必要はない。 */
const MUST_NOT_BE_CACHE_FIRST = [
  { path: '/data.js', query: '?v=10', why: 'Publish Now が commit するので ?v が上がらない' },
];

/** 逆に cache-first のままでよいことを固定するケース（戦略の取り違え防止）。 */
const EXPECTED = [
  { path: '/common.js', query: '?v=3', want: 'cacheFirst' },
  { path: '/common.css', query: '?v=4', want: 'cacheFirst' },
  { path: '/image-dimensions.js', query: '?v=4', want: 'cacheFirst' },
  { path: '/localize.js', query: '?v=4', want: 'cacheFirst' },
  { path: '/images/festivals/hacha-mecha.webp', query: '', want: 'staleWhileRevalidate' },
  { path: '/data.js', query: '?v=10', want: 'staleWhileRevalidate' },
];

/**
 * sw.js を読み込み、fetch リスナーを取り出す。
 * 戦略の判定は「どの関数が呼ばれたか」ではなく、スタブへの呼び出し順から行う:
 *   networkFirst          … いきなり fetch()
 *   cacheFirst            … caches.match() → fetch()
 *   staleWhileRevalidate  … caches.open() → cache.match() → fetch()
 */
function loadFetchHandler() {
  let fetchHandler = null;
  const calls = [];

  const cacheStub = {
    match: async () => { calls.push('cache.match'); return undefined; },
    put: async () => {},
    addAll: async () => {},
  };
  const sandbox = {
    console,
    URL,
    Promise,
    self: {
      location: { origin: ORIGIN },
      addEventListener: (type, fn) => { if (type === 'fetch') fetchHandler = fn; },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async (name) => { calls.push(`caches.open:${name}`); return cacheStub; },
      match: async () => { calls.push('caches.match'); return undefined; },
      keys: async () => [],
      delete: async () => {},
    },
    fetch: async () => { calls.push('fetch'); return { ok: true, clone: () => ({}) }; },
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(readFileSync(SW, 'utf8'), sandbox, { filename: 'sw.js' });

  if (!fetchHandler) throw new Error('sw.js が fetch リスナーを登録していない');
  return { fetchHandler, calls };
}

/** 1件のリクエストを流し、選ばれた戦略名を返す。 */
async function routeOf({ fetchHandler, calls }, path, query) {
  calls.length = 0;
  let responded = null;
  const request = {
    url: ORIGIN + path + query,
    method: 'GET',
    headers: { get: () => '' },   // accept: HTML ではない
  };
  fetchHandler({ request, respondWith: (p) => { responded = p; } });
  if (!responded) return 'passthrough';   // respondWith されず SW をすり抜けた
  await responded.catch(() => {});

  const seq = calls.join(',');
  if (seq.startsWith('caches.open') && calls.includes('cache.match')) return 'staleWhileRevalidate';
  if (calls[0] === 'caches.match') return 'cacheFirst';
  if (calls[0] === 'fetch') return 'networkFirst';
  return `unknown(${seq})`;
}

async function main() {
  const sw = loadFetchHandler();
  const failures = [];
  const rows = [];

  for (const c of MUST_NOT_BE_CACHE_FIRST) {
    const got = await routeOf(sw, c.path, c.query);
    const ok = got !== 'cacheFirst';
    if (!ok) {
      failures.push(
        `${c.path}${c.query} が cache-first に吸われている（${c.why}）。\n` +
        `      sw.js の fetch ハンドラで ${c.path} の分岐を CSS/JS 判定より前に置くこと。`
      );
    }
    rows.push([`${c.path}${c.query}`, got, 'cacheFirst 以外', ok]);
  }

  for (const c of EXPECTED) {
    const got = await routeOf(sw, c.path, c.query);
    const ok = got === c.want;
    if (!ok) failures.push(`${c.path}${c.query}: ${got}（期待 ${c.want}）`);
    rows.push([`${c.path}${c.query}`, got, c.want, ok]);
  }

  const w = Math.max(...rows.map(r => r[0].length));
  console.log(`検査対象: LP/sw.js\n`);
  console.log(`${'URL'.padEnd(w)}  ${'実際の戦略'.padEnd(22)} ${'期待'.padEnd(22)} 判定`);
  console.log('-'.repeat(w + 52));
  for (const [url, got, want, ok] of rows) {
    console.log(`${url.padEnd(w)}  ${got.padEnd(22)} ${want.padEnd(22)} ${ok ? '✅' : '❌'}`);
  }

  // ワークフローが JS/CSS を自動 commit し始めていないか。
  // 新たに機械書き換えされるファイルが増えたら、上のリストへの追加を促す。
  const wfDir = join(ROOT, '.github', 'workflows');
  let autoCommitted = [];
  try {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync(wfDir).filter(n => n.endsWith('.yml'))) {
      const txt = readFileSync(join(wfDir, f), 'utf8');
      for (const m of txt.matchAll(/git add\s+([^\n]+)/g)) {
        for (const p of m[1].split(/\s+/)) {
          if (/\.(js|css)$/.test(p)) autoCommitted.push(`${f}: ${p}`);
        }
      }
    }
  } catch { /* ワークフローが読めなければスキップ */ }
  if (autoCommitted.length) {
    console.log('\n⚠ ワークフローが JS/CSS を直接 commit しています。');
    console.log('  ?v の手動更新が効かないため、MUST_NOT_BE_CACHE_FIRST への追加を検討してください:');
    autoCommitted.forEach(l => console.log(`    - ${l}`));
  }

  if (failures.length) {
    console.log('\n' + '='.repeat(60));
    console.log('Service Worker のルーティングに問題があります:');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    console.log(`
fetch ハンドラの分岐は上から順に評価され、最初に一致したところで return します。
url.pathname はクエリを含まないため、/data.js?v=7 は /\\.js$/ にも一致します。
詳細は AUDIT_TECHNO_JAPAN.md §9-18。`);
    return 1;
  }

  console.log('\n✅ ルーティングに問題なし');
  return 0;
}

process.exit(await main());
