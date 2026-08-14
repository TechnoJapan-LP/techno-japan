/* SNS でシェアしたときのサムネイル（og:image）が妥当か。

   ■ なぜ必要か（AUDIT §9-86）

   2026-08-14 まで、自前の写真を持たないページ283枚の og:image が
   **他社フェスの写真（Rainbow Disco Club）** だった。

     トップ / ABOUT / アーティスト一覧 / 会場一覧 / ニュース …
     → すべて images/festivals/rainbow-disco-club.webp

   TECHNO JAPAN のトップページを X や Instagram で共有すると、
   TECHNO JAPAN と無関係の写真がカードに出ていた。
   ページは正常に表示されるので、**共有しない限り気づけなかった。**

   ■ 何を見るか

   1. すべてのページに og:image と twitter:image があるか
   2. og:image と twitter:image が食い違っていないか
   3. 参照先の画像が実在するか
   4. 既定画像（自前の写真が無いページ用）が、特定のフェスの写真に
      なっていないか ← これが今回の事故そのもの
   5. 既定画像が SNS 推奨の 1200x630 前後か

   使い方: node scripts/check_og_image.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const BASE = 'https://techno-japan.media';

let failed = 0;
const fail = (m) => { console.log(`  ❌ ${m}`); failed++; };
const pass = (m) => console.log(`  ✅ ${m}`);

const htmls = [...fs.readdirSync(LP, { recursive: true })]
  .filter((f) => typeof f === 'string' && f.endsWith('.html') && !f.startsWith('vendor'))
  .map((f) => path.join(LP, f));

const grab = (html, prop, attr) =>
  (html.match(new RegExp(`<meta ${attr}="${prop}" content="([^"]*)"`)) || [])[1] || null;

const localPath = (url) => {
  if (!url) return null;
  const u = url.startsWith(BASE) ? url.slice(BASE.length) : url;
  if (!u.startsWith('/')) return null;
  return path.join(LP, u.split('?')[0].replace(/^\//, ''));
};

const missing = [];
const mismatched = [];
const broken = new Set();
const counts = new Map();
let checked = 0;

for (const f of htmls) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(LP, f);
  const og = grab(html, 'og:image', 'property');
  const tw = grab(html, 'twitter:image', 'name');
  // OG を持たないページ（CMS 等）は対象外
  if (!og && !tw && !/og:title|twitter:card/.test(html)) continue;
  checked++;
  if (!og) { missing.push(`${rel} (og:image)`); continue; }
  if (tw && tw !== og) mismatched.push(rel);
  counts.set(og, (counts.get(og) || 0) + 1);
  const lp = localPath(og);
  if (lp && !fs.existsSync(lp)) broken.add(`${rel} → ${og}`);
}

console.log('▸ 宣言');
if (missing.length) fail(`${missing.length}ページに og:image が無い: ${missing.slice(0, 3).join(', ')}`);
else pass(`${checked}ページすべてに og:image がある`);
if (mismatched.length) fail(`${mismatched.length}ページで og:image と twitter:image が違う: ${mismatched.slice(0, 3).join(', ')}`);
else pass('og:image と twitter:image が一致している');

console.log();
console.log('▸ 参照先');
if (broken.size) {
  fail(`${broken.size}件が実在しない画像を指している`);
  for (const b of [...broken].slice(0, 5)) console.log(`      ${b}`);
} else {
  pass('参照先の画像はすべて実在する');
}

console.log();
console.log('▸ 既定画像（自前の写真が無いページが使うもの）');
/* 最も多くのページが使っているものを既定画像とみなす */
const [topUrl, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
if (!topUrl) {
  fail('既定画像を特定できない');
} else {
  console.log(`  最も多く使われている: ${topUrl}（${topCount}ページ）`);
  if (/\/images\/(festivals|artists|venues|articles)\//.test(topUrl)) {
    fail('既定画像が特定のフェス／アーティスト／会場の写真になっている。'
       + 'サイト共通のロゴ画像にしてください');
    console.log('      2026-08-14 まで他社フェスの写真が283ページの既定でした（AUDIT §9-86）。');
  } else {
    pass('既定画像は特定の対象の写真ではない（サイト共通の画像）');
  }
  const lp = localPath(topUrl);
  if (lp && fs.existsSync(lp)) {
    /* PNG のヘッダーから寸法を読む（外部ライブラリを使わない） */
    const buf = fs.readFileSync(lp);
    if (buf.slice(1, 4).toString() === 'PNG') {
      const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
      const ratio = +(w / h).toFixed(2);
      console.log(`  寸法: ${w}x${h}（縦横比 ${ratio}）`);
      if (w >= 1200 && h >= 600 && ratio > 1.7 && ratio < 2.0) {
        pass('SNS 推奨の 1200x630 相当（1.91:1）');
      } else {
        fail(`SNS 推奨の 1200x630（1.91:1）から外れている`);
      }
    }
    if (!/\?v=/.test(topUrl)) {
      fail('既定画像に ?v が無い（差し替えても SNS 側の古い画像が残りやすい）');
    } else {
      pass('既定画像に ?v が付いている');
    }
  }
}

console.log();
if (failed) {
  console.log(`❌ ${failed}件の問題があります`);
  process.exit(1);
}
console.log('✅ SNS シェア画像は全ページで正しく設定されています');
