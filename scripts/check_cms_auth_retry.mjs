#!/usr/bin/env node
/**
 * CMS の「セッション失効からの自動回復」を検証する。
 *
 * ■ 何を守るか（AUDIT §9-53）
 *
 *   GAS のセッションは時間で失効する。失効後の要求には
 *   「Invalid auth token」が返るが HTTP は 200 なので、
 *   呼び出し側が個別に見ないと気づけない。見ていない機能は
 *   その機能だけが静かに使えなくなる（2026-08-07 に ARTICLE の
 *   翻訳が止まった）。
 *
 *   回復は fetch の入口（window.fetch のラッパ）で1回だけ行う。
 *   呼び出し箇所は16あり、1つずつ直しても次に足したものが漏れるため。
 *
 *   守りたい性質:
 *     1. 失効応答を受けたら、入り直して同じ要求を投げ直す
 *     2. 再試行は1回だけ（無限ループにしない）
 *     3. 正常応答のときは何もしない（無駄な再ログインをしない）
 *     4. GAS 以外の URL には触らない
 *     5. トークンを body に載せている（GET はクエリに載せている）
 *
 * ■ なぜブラウザで見ないのか
 *   cms.html は読み込み時に prompt() を出して headless では固まる
 *   （AUDIT §9-44）。cms.js だけを VM に読み込んで叩く。
 *
 * 使い方:
 *   node scripts/check_cms_auth_retry.mjs
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');

const BRIDGE = `
;globalThis.__T = {
  get AUTH_TOKEN(){return AUTH_TOKEN}, set AUTH_TOKEN(v){AUTH_TOKEN=v},
  get origFetch(){return _origFetch}, set origFetch(v){_origFetch=v},
};`;

function makeCtx({ responses, onLogin }) {
  const calls = [];
  const mkRes = (obj) => ({
    ok: true,
    json: async () => obj,
    clone() { return mkRes(obj); },
  });
  const ctx = {
    console,
    document: {
      documentElement: { lang: 'ja' },
      getElementById: () => ({ value: '', addEventListener(){}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, style:{}, dataset:{}, querySelectorAll:()=>[] }),
      querySelector: () => null, querySelectorAll: () => [], addEventListener(){},
      createElement: () => ({ style:{}, classList:{add(){},remove(){}}, appendChild(){}, setAttribute(){}, addEventListener(){} }),
      body: { appendChild(){}, classList:{add(){},remove(){},toggle(){}} },
      head: { appendChild(){} }, cookie: '',
    },
    localStorage: { _s:new Map(), getItem(k){return this._s.get(k)??null}, setItem(k,v){this._s.set(k,v)}, removeItem(k){this._s.delete(k)} },
    sessionStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
    location: { href:'http://localhost/cms.html', search:'', hash:'', origin:'http://localhost', reload(){} },
    navigator: { userAgent:'node', onLine:true },
    setTimeout, clearTimeout, setInterval, clearInterval,
    prompt: () => 'pw', confirm: () => true, alert: () => {},
    addEventListener(){}, removeEventListener(){},
    matchMedia: () => ({ matches:false, addEventListener(){}, addListener(){} }),
    requestAnimationFrame: (f) => setTimeout(f, 0), scrollTo(){}, getComputedStyle: () => ({}),
    history: { replaceState(){}, pushState(){} },
    IntersectionObserver: class { observe(){} unobserve(){} disconnect(){} },
    URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto: { subtle:{ digest: async () => new ArrayBuffer(32) }, getRandomValues:(a)=>a },
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
    __calls: calls,
  };
  // cms.js が読み込み時に掴む素の fetch。テストの応答列を返す。
  ctx.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    calls.push({ url, body, method: options?.method });
    if (body?.action === 'login') { onLogin?.(); return mkRes({ status:'ok', token:'fresh-token' }); }
    const next = responses.shift();
    return mkRes(next ?? { status:'ok' });
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(CMS_PATH,'utf8') + BRIDGE, ctx, { filename:'cms.js' });
  return ctx;
}

const results = [];
const check = (n, p, d) => results.push([n, p, d]);
const GAS = 'https://script.google.com/macros/s/xxx/exec';

// ---- 1) 失効 → 入り直して投げ直す ----
{
  let logins = 0;
  const c = makeCtx({
    responses: [{ status:'error', message:'Invalid auth token' }, { status:'ok', text:'翻訳結果' }],
    onLogin: () => logins++,
  });
  c.__T.AUTH_TOKEN = 'stale-token';
  const d = await (await c.fetch(GAS, { method:'POST', body: JSON.stringify({ action:'ai_translate' }) })).json();
  const posts = c.__calls.filter(x => x.body?.action === 'ai_translate');
  check('失効したら入り直して投げ直す', d.status === 'ok' && d.text === '翻訳結果' && logins === 1,
    `結果=${d.status} ログイン=${logins}回 翻訳要求=${posts.length}回`);
  check('投げ直しは1回だけ', posts.length === 2, `${posts.length}回`);
  check('投げ直しでは新しいトークンを載せる', posts[1]?.body?.cmsAuth === 'fresh-token', String(posts[1]?.body?.cmsAuth));
}

// ---- 2) 失効が続いても無限ループしない ----
{
  let logins = 0;
  const c = makeCtx({
    responses: [{ status:'error', message:'Invalid auth token' }, { status:'error', message:'Invalid auth token' }],
    onLogin: () => logins++,
  });
  c.__T.AUTH_TOKEN = 'stale-token';
  const d = await (await c.fetch(GAS, { method:'POST', body: JSON.stringify({ action:'ai_translate' }) })).json();
  const posts = c.__calls.filter(x => x.body?.action === 'ai_translate');
  check('直らなくても無限ループしない', posts.length === 2 && logins === 1 && d.status === 'error',
    `要求=${posts.length}回 ログイン=${logins}回`);
  check('直らないときは握りつぶさずエラーを返す', d.status === 'error', d.status);
}

// ---- 3) 正常時は再ログインしない ----
{
  let logins = 0;
  const c = makeCtx({ responses: [{ status:'ok', text:'ok' }], onLogin: () => logins++ });
  c.__T.AUTH_TOKEN = 'good-token';
  const d = await (await c.fetch(GAS, { method:'POST', body: JSON.stringify({ action:'ai_translate' }) })).json();
  check('正常なら再ログインしない', logins === 0 && d.status === 'ok', `ログイン=${logins}回`);
}

// ---- 4) GAS 以外には触らない ----
{
  const c = makeCtx({ responses: [{ status:'error', message:'Invalid auth token' }] });
  c.__T.AUTH_TOKEN = 'tok';
  await c.fetch('https://example.com/api', { method:'POST', body: JSON.stringify({ a:1 }) });
  const call = c.__calls.find(x => String(x.url).includes('example.com'));
  check('GAS 以外の URL にトークンを付けない', call && call.body && call.body.cmsAuth === undefined,
    JSON.stringify(call?.body));
}

// ---- 5) GET はクエリに載せる ----
{
  const c = makeCtx({ responses: [{ status:'ok', rows:[] }] });
  c.__T.AUTH_TOKEN = 'tok';
  await c.fetch(GAS + '?action=get_sheet&sheet=ARTICLES');
  const call = c.__calls.find(x => String(x.url).includes('get_sheet'));
  check('GET はクエリにトークンを載せる', String(call?.url).includes('cmsAuth=tok'), String(call?.url).slice(-40));
}

console.log('\n検証項目'.padEnd(48) + '判定  実測');
console.log('-'.repeat(96));
let fail = 0;
for (const [n, p, d] of results) { if (!p) fail++; console.log(n.padEnd(46) + '  ' + (p ? '✅' : '❌') + '   ' + d); }
console.log('-'.repeat(96));
console.log(fail ? `❌ ${fail}件 失敗` : `✅ 全${results.length}件 通過`);
process.exit(fail ? 1 : 0);
