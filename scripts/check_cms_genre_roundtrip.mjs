#!/usr/bin/env node
/** Verify that sheet genre separators are parsed into selectable CMS genres. */

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = fs.readFileSync(path.join(root, 'LP/cms.js'), 'utf8');
const noop = () => {};
const element = () => ({ value: '', style: {}, addEventListener: noop,
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  querySelectorAll: () => [], appendChild: noop, setAttribute: noop });
const ctx = {
  console,
  document: { documentElement: { lang: 'ja' }, getElementById: element,
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop,
    createElement: element, body: element(), head: element(), cookie: '' },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  location: { href: 'http://localhost/cms.html', search: '', hash: '', origin: 'http://localhost' },
  navigator: { userAgent: 'node', onLine: true }, fetch: async () => ({ json: async () => ({}) }),
  prompt: () => '', confirm: () => true, alert: noop, addEventListener: noop,
  removeEventListener: noop, setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (fn) => setTimeout(fn, 0), scrollTo: noop,
  getComputedStyle: () => ({}), matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  history: { replaceState: noop, pushState: noop },
  IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  URL, URLSearchParams, TextEncoder, TextDecoder, crypto: { subtle: { digest: async () => new ArrayBuffer(32) } },
  Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(`${source}\n;globalThis.__parseGenreValues = parseGenreValues; globalThis.__setSelectedGenres = setSelectedGenres;`, ctx, { filename: 'cms.js' });

const parse = ctx.__parseGenreValues;
const cases = [
  ['TECHNO · HOUSE · MINIMAL', ['TECHNO', 'HOUSE', 'MINIMAL']],
  ['techno, house, minimal', ['techno', 'house', 'minimal']],
  ['TECHNO、 HOUSE、MINIMAL', ['TECHNO', 'HOUSE', 'MINIMAL']],
];
let failed = 0;
for (const [input, expected] of cases) {
  const actual = [...parse(input)];
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '  ✅' : '  ❌'} ${JSON.stringify(input)} → ${JSON.stringify(actual)}`);
  if (!ok) failed++;
}
const chips = ['TECHNO', 'HOUSE', 'MINIMAL'].map((genre) => ({
  dataset: { genre }, classList: { selected: false, toggle(_name, selected) { this.selected = selected; } },
}));
ctx.document.querySelectorAll = () => chips;
ctx.__setSelectedGenres('v-genre', ['techno', 'minimal']);
const chipMatchOk = chips[0].classList.selected && !chips[1].classList.selected && chips[2].classList.selected;
console.log(`${chipMatchOk ? '  ✅' : '  ❌'} 大文字小文字を無視したチップ選択`);
if (!chipMatchOk) failed++;
const hasGuard = /ジャンルが空になります。ジャンルを選び直してから保存してください。/.test(source)
  && /\['venue','festival','artist'\]\.includes\(section\)/.test(source);
console.log(`${hasGuard ? '  ✅' : '  ❌'} 既存ジャンルの空化ガード`);
if (!hasGuard) failed++;
if (failed) process.exitCode = 1;
else console.log('CMS ジャンル往復検査: 5件すべて成功');
