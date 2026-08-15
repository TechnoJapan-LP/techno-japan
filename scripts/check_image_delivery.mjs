/* 大きい画像を原寸のまま配っていないか。

   ■ なぜ必要か（AUDIT §9-90）

   2026-08-15 の監査で、詳細ページの一番大きい画像（hero）に
   `srcset` が1つも無いことが分かった。関連カードには付いていたのに、
   **一番重い画像だけ**素通しだった。実測:

     フェス詳細  原画 1920px(407KB) → モバイル表示 480px
     記事        原画 1920px        → モバイル表示 496px
     ページ総重量 1,448KB のうち 1,348KB が画像

   hero を直したら、今度は**フライヤーが 624KB で最大**になった。
   派生画像は50件すべて生成済みだったのに、出力側で使っていなかった。
   **「一番大きい画像」を直すと、次に大きいものが顔を出す。**

   結果: フェス詳細 1,448KB → 716KB / 記事 501KB → 209KB。

   ■ 何を見るか

   1. 派生画像が全種類（festivals / artists / venues / articles）にあるか
   2. 詳細ページの hero・フライヤーが srcset を持っているか
   3. srcset が指す派生ファイルが実在するか
   4. sizes が書かれているか（無いと 100vw 扱いで大きすぎる候補を選ぶ）

   ■ ハブ（一覧ページ）は対象外

   localize.js に「一覧ハブでは srcset を使わないこと」と明記がある。
   カードは実測でモバイル452px / PC 848px と大きく、実機（dpr 2〜3）では
   960px がちょうど良い。2026-08-07 に srcset を付けたら PC で 480px が
   選ばれて画質が落ち、撤回した経緯がある。ここを「最適化漏れ」と
   見なして直すと、画質の回帰になる。

   使い方: node scripts/check_image_delivery.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

let failed = 0;
const fail = (m) => { console.log(`  ❌ ${m}`); failed++; };
const pass = (m) => console.log(`  ✅ ${m}`);

/* ---------- 1. 派生画像の網羅 ---------- */
console.log('▸ 派生画像');
const src = fs.readFileSync(path.join(LP, 'image-derivatives.js'), 'utf-8');
const m = src.match(/=\s*(\{[\s\S]*\});\s*$/m);
if (!m) { fail('image-derivatives.js を読めない'); process.exit(1); }
const DERIV = JSON.parse(m[1]);

for (const kind of ['festivals', 'artists', 'venues', 'articles']) {
  const dir = path.join(LP, 'images', kind);
  if (!fs.existsSync(dir)) continue;
  const originals = fs.readdirSync(dir).filter((f) => f.endsWith('.webp'));
  const covered = originals.filter((f) => DERIV[`images/${kind}/${f}`]);
  if (covered.length === originals.length) {
    pass(`${kind}: ${originals.length}枚すべてに派生がある`);
  } else {
    fail(`${kind}: ${originals.length - covered.length}枚に派生が無い`
       + `（build-image-derivatives.py の SOURCE_DIRS を確認）`);
  }
}

/* 派生の実体があるか */
let missingFiles = 0;
for (const entry of Object.values(DERIV)) {
  for (const [p] of entry.srcset || []) {
    if (!fs.existsSync(path.join(LP, p))) missingFiles++;
  }
}
if (missingFiles) fail(`派生画像 ${missingFiles}件の実体が無い`);
else pass(`派生画像の実体がすべて存在する（${Object.keys(DERIV).length}枚 × 2サイズ）`);

/* ---------- 2. 詳細ページの大きい画像 ---------- */
console.log();
console.log('▸ 詳細ページの大きい画像に srcset があるか');

/* hero と フライヤー。ハブのカードは対象外（上のコメント参照）。 */
const TARGETS = [
  { label: 'フェス hero',    dir: 'festivals', re: /<div class="detail-hero-image">\s*<img\b([^>]*)>/ },
  { label: 'フェス フライヤー', dir: 'festivals', re: /<div class="detail-flyer-image"><img\b([^>]*)>/ },
  { label: 'アーティスト hero', dir: 'artists',   re: /<div class="detail-hero detail-hero-portrait"><img\b([^>]*)>/ },
  { label: '会場 hero',      dir: 'venues',    re: /<div class="detail-hero"><img\b([^>]*)>/ },
  { label: '記事 hero',      dir: 'articles',  re: /<header class="article-hero"[^>]*>\s*<img\b([^>]*)>/ },
];

for (const t of TARGETS) {
  const dir = path.join(LP, t.dir);
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  let found = 0, withSrcset = 0, withSizes = 0, broken = 0;
  for (const f of files) {
    const html = fs.readFileSync(path.join(dir, f), 'utf-8');
    const hit = html.match(t.re);
    if (!hit) continue;
    found++;
    const attrs = hit[1];
    /* 派生が無い画像（Drive 直リンク等）は srcset を出しようがない。
       原本が images/ 配下にあるものだけを対象にする。 */
    const srcMatch = attrs.match(/src="\/([^"?]+)"/);
    const hasDeriv = srcMatch && DERIV[srcMatch[1]];
    if (!hasDeriv) continue;
    if (/\bsrcset="/.test(attrs)) withSrcset++;
    if (/\bsizes="/.test(attrs)) withSizes++;
    for (const p of (attrs.match(/\/images\/derivatives\/[^\s",]+/g) || [])) {
      if (!fs.existsSync(path.join(LP, p.replace(/^\//, '')))) broken++;
    }
  }
  if (!found) { console.log(`  － ${t.label}: 対象ページなし`); continue; }
  const target = files.filter((f) => {
    const html = fs.readFileSync(path.join(dir, f), 'utf-8');
    const hit = html.match(t.re);
    if (!hit) return false;
    const sm = hit[1].match(/src="\/([^"?]+)"/);
    return sm && DERIV[sm[1]];
  }).length;
  if (withSrcset === target && withSizes === target && !broken) {
    pass(`${t.label}: ${target}枚すべてに srcset + sizes（派生の実体も確認）`);
  } else {
    if (withSrcset < target) fail(`${t.label}: ${target - withSrcset}枚に srcset が無い（原寸を全端末へ配っている）`);
    if (withSizes < target) fail(`${t.label}: ${target - withSizes}枚に sizes が無い（100vw 扱いで大きすぎる候補を選ぶ）`);
    if (broken) fail(`${t.label}: srcset が指す派生 ${broken}件の実体が無い`);
  }
}

console.log();
console.log('▸ 記事本文の外部画像（Google Drive）');
/* ⚠️ 前夜の計測は自サイトへの通信しか数えず、記事を 209KB と報告した。
   実際は Drive の画像が別に約3.2MB あった。**外部も数える**こと。

   Drive は URL 末尾の =w数字 でその場で縮小した画像を返すので、
   同じIDから srcset が組める。実測（2026-08-15 / 記事1本）:
     変更前 3,547KB → 変更後 1,048KB（スマホ dpr1）
     変更前 3,539KB → 変更後 1,836KB（スマホ dpr3 = 実機相当）
   AUDIT §9-91。 */
{
  const dirs = ['articles', path.join('en', 'articles')];
  let total = 0, withSrcset = 0, noLazy = 0;
  const bad = [];
  for (const d of dirs) {
    const dir = path.join(LP, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(dir, f), 'utf-8');
      for (const tag of html.match(/<img\b[^>]*lh3\.googleusercontent\.com[^>]*>/gi) || []) {
        total++;
        if (/\bsrcset=/i.test(tag)) withSrcset++;
        else bad.push(`${d}/${f}`);
        if (!/\bloading="lazy"/i.test(tag)) noLazy++;
      }
    }
  }
  if (!total) {
    console.log('  － Drive 画像なし');
  } else if (withSrcset === total) {
    pass(`${total}枚すべてに srcset がある（原寸を全端末へ配っていない）`);
    if (noLazy) fail(`${noLazy}枚に loading="lazy" が無い`);
    else pass('すべて loading="lazy"');
  } else {
    fail(`${total - withSrcset}枚が原寸のまま（1枚 最大628KB）。`
       + `例: ${[...new Set(bad)].slice(0, 3).join(', ')}`);
  }
}

console.log();
if (failed) {
  console.log(`❌ ${failed}件の問題があります`);
  console.log('  大きい画像を原寸のまま配ると、モバイルの LCP が直撃を受けます。');
  console.log('  2026-08-15 の修正でフェス詳細 1,448KB → 716KB になりました（AUDIT §9-90）。');
  process.exit(1);
}
console.log('✅ 大きい画像はすべて端末に合った大きさで配られます');
