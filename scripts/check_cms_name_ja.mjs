#!/usr/bin/env node
/**
 * FESTIVALS.name_ja の CMS 入出力と data.js 生成を検査する。
 * GAS へは接続せず、CMS のソースと buildFestivalsJs に擬似データを渡す。
 */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cmsPath = path.join(ROOT, 'LP', 'cms.js');
const htmlPath = path.join(ROOT, 'LP', 'cms.html');
const cms = fs.readFileSync(cmsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

const checks = [];
const check = (label, ok, detail = '') => checks.push([label, ok, detail]);

check('フェス編集フォームに name_ja 入力欄がある',
  /id="f-name_ja"/.test(html));
check('編集読込が name_ja をフォームへ入れる',
  /setVal\('f-name_ja',row\.name_ja\)/.test(cms));
check('既存保存が name_ja を送る',
  /location_ja:g\('f-location_ja'\),name_ja:g\('f-name_ja'\)/.test(cms));
check('新規保存が name_ja を送る',
  /location_ja:g\('f-location_ja'\),name_ja:g\('f-name_ja'\)/g.test(cms));
check('リセット対象に name_ja がある',
  /festival:\['f-id','f-name','f-name_ja'/.test(cms));

const el = () => ({ value: '', addEventListener() {}, querySelectorAll: () => [],
  style: {}, classList: { add() {}, remove() {}, toggle() {} } });
const ctx = {
  console, document: { documentElement: { lang: 'ja' }, getElementById: el,
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    createElement: () => el(), body: { appendChild() {}, classList: { add() {}, remove() {} } },
    head: { appendChild() {} }, cookie: '' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  location: { href: 'http://localhost/cms.html', search: '', hash: '', origin: 'http://localhost' },
  navigator: { userAgent: 'node', onLine: true }, fetch: async () => ({ json: async () => ({ status: 'ok' }) }),
  prompt: () => 'x', confirm: () => true, alert: () => {}, addEventListener() {}, removeEventListener() {},
  setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: (f) => setTimeout(f, 0),
  scrollTo() {}, getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  history: { replaceState() {}, pushState() {} }, IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  URL, URLSearchParams, TextEncoder, TextDecoder, crypto: { subtle: { digest: async () => new ArrayBuffer(32) } },
  Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(`${cms}\n;globalThis.__buildFestivalsJs = buildFestivalsJs;`, ctx, { filename: 'cms.js' });

const withName = ctx.__buildFestivalsJs([{
  id: 're-birth-festival', name: 'Re:birth Festival', name_ja: 'リバースフェスティバル',
  status: 'published', date: '2026-09-11/2026-09-13', location: 'Nagano', city: 'NAGANO'
}]);
const withoutName = ctx.__buildFestivalsJs([{
  id: 'big-fun', name: 'Big Fun', status: 'published', date: '2026-10-01', location: 'Tokyo', city: 'TOKYO'
}]);
check('buildFestivalsJs が name_ja を出力する',
  withName.includes('name_ja: "リバースフェスティバル"'));
check('name_ja が無い行は出力を増やさない',
  !withoutName.includes('name_ja:'));

let failed = 0;
for (const [label, ok, detail] of checks) {
  if (ok) console.log(`  ✅ ${label}`);
  else { console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
}
if (failed) process.exitCode = 1;
else console.log(`name_ja CMS 検査: ${checks.length}件すべて成功`);
