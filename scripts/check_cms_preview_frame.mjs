/* CMS のプレビューが、詳細ページと同じ見え方をしているか。

   ■ なぜ必要か（AUDIT §9-84）

   Image Position を詳細ページに効かせた直後（§9-83）、
   「プレビューで確認できるようになってる？」と聞かれて調べたところ、
   **確認画面のほうが実ページと食い違っていた。**

   CMS には位置確認の場所が2つある。

     1. 入力欄の下の小さなプレビュー（img-pos-preview）
        位置は反映していたが、**枠の形がアーティストだけ違った**。
        16:9 で表示していたが実ページは 3:2。正方形の写真なら
        プレビューは44%切るのに実ページは33%。**11%多く切って見せていた。**

     2. 「👁 Preview」の全画面プレビュー（pv-hero-image）
        **object-position を一切出していなかった。**
        top にしても常に中央で表示。枠もアーティスト 1:1 と実ページ 3:2 で別物。

   位置を合わせるための機能なのに、**確認画面がその調整を見せていなかった。**

   ■ 何を見るか

   detail.css の実ページの枠と、CMS の2つのプレビューの枠が一致しているか。
   加えて、全画面プレビューが object-position を出す作りになっているか。

   使い方: node scripts/check_cms_preview_frame.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const read = (f) => fs.readFileSync(path.join(LP, f), 'utf8');

const detailCss = read('detail.css');
const cmsHtml = read('cms.html');
const cmsJs = read('cms.js');
const cmsCss = read('cms.css');

const ratio = (s) => {
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  return m ? +(Number(m[1]) / Number(m[2])).toFixed(3) : null;
};

/* 実ページの枠を detail.css から読む（べた書きせず、実物を見る） */
function realRatio(selector) {
  const re = new RegExp(String.raw`${selector}[^{]*\{[^}]*aspect-ratio:\s*([0-9./\s]+)`);
  const m = detailCss.match(re);
  return m ? ratio(m[1]) : null;
}

const KINDS = [
  { key: 'a', label: 'アーティスト', real: realRatio(String.raw`\.detail-hero-portrait`) },
  { key: 'v', label: '会場', real: realRatio(String.raw`\.detail-hero\s`) },
  { key: 'f', label: 'フェス', real: realRatio(String.raw`\.detail-hero-image`) },
];

let failed = 0;
const fail = (msg) => { console.log(`  ❌ ${msg}`); failed++; };
const pass = (msg) => console.log(`  ✅ ${msg}`);

console.log('▸ 入力欄の下の小さなプレビュー（img-pos-preview）');
for (const k of KINDS) {
  if (k.real === null) { fail(`${k.label}: detail.css から実ページの枠を読めない`); continue; }
  const m = cmsHtml.match(new RegExp(`id="${k.key}-imagePosPreview"[^>]*aspect-ratio:\\s*([0-9./]+)`));
  if (!m) { fail(`${k.label}: プレビュー要素に aspect-ratio が無い`); continue; }
  const got = ratio(m[1]);
  if (Math.abs(got - k.real) < 0.02) pass(`${k.label}: ${got} = 実ページ ${k.real}`);
  else fail(`${k.label}: プレビュー ${got} ≠ 実ページ ${k.real}（プレビューが嘘をつく）`);
}

console.log();
console.log('▸ 「👁 Preview」の全画面プレビュー（pv-hero-image）');

const ratioMap = cmsJs.match(/const PV_HERO_RATIO\s*=\s*\{([^}]*)\}/);
if (!ratioMap) fail('PV_HERO_RATIO が cms.js に無い');
else {
  for (const k of KINDS) {
    if (k.real === null) continue;
    const m = ratioMap[1].match(new RegExp(`${k.key}\\s*:\\s*'([0-9./]+)'`));
    if (!m) { fail(`${k.label}: PV_HERO_RATIO に定義が無い`); continue; }
    const got = ratio(m[1]);
    if (Math.abs(got - k.real) < 0.02) pass(`${k.label}: ${got} = 実ページ ${k.real}`);
    else fail(`${k.label}: プレビュー ${got} ≠ 実ページ ${k.real}`);
  }
}

/* 3つの hero がすべて pvHeroStyle() を通しているか */
const heroTags = cmsJs.match(/<div class="pv-hero-image"[^>]*>/g) || [];
const withStyle = heroTags.filter((t) => t.includes('pvHeroStyle(')).length;
if (heroTags.length === 0) fail('pv-hero-image の出力が見つからない');
else if (withStyle === heroTags.length) pass(`hero ${heroTags.length}箇所すべてが pvHeroStyle() を通している`);
else fail(`hero ${heroTags.length}箇所のうち ${heroTags.length - withStyle}箇所が pvHeroStyle() を通していない`);

/* CSS 側が --pv-pos を実際に使っているか */
if (/\.pv-hero-image img\{[^}]*object-position:\s*var\(--pv-pos/.test(cmsCss))
  pass('cms.css が object-position:var(--pv-pos) を適用している');
else
  fail('cms.css の .pv-hero-image img に object-position:var(--pv-pos) が無い（位置が効かない）');

console.log();
if (failed) {
  console.log(`❌ ${failed}件の食い違いがあります`);
  console.log('  プレビューと詳細ページの枠がずれると、CMS で合わせたつもりの位置が');
  console.log('  本番で別の切れ方になります。2026-08-14 まで実際にずれていました（AUDIT §9-84）。');
  process.exit(1);
}
console.log('✅ CMS のプレビューは、詳細ページと同じ枠・同じ位置指定で表示されます');
