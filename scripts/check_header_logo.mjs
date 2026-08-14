/* ヘッダーのロゴが、全ページで正しく出ているか。

   ■ なぜ必要か（AUDIT §9-85）

   2026-08-14、ヘッダーの `TECHNO JAPAN` を文字からロゴ画像に差し替えた。
   452ページすべてに同じ <img> が入る形なので、壊れ方も452ページ同時になる。

   文字と違って画像は、次の形で静かに壊れる。

     ・ファイルが無い / パスが違う  → 何も出ない（alt が小さく出るだけ）
     ・width/height 属性が無い      → 読み込み後にヘッダーが飛ぶ
     ・幅を広げすぎる               → 右のメニューと重なる

   最後のものが一番危ない。**PC では余裕があるので気づけない。**
   タブレット幅（900px）で右のメニューまで 42px しか無く、
   ここから +40px 程度広げると衝突する。

   ■ 何を見るか

   1. 全 HTML のヘッダーが同じロゴ画像を参照しているか（取り残し 0件）
   2. 参照先のファイルが実在するか
   3. width / height 属性があり、実画像の縦横比と合っているか
   4. CSS が高さを固定し、幅を auto にしているか
   5. 表示幅が、タブレット幅で衝突しない範囲に収まっているか

   使い方: node scripts/check_header_logo.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

/* タブレット幅（900px）で右のメニューまで残っていた実測値が 42px。
   ロゴをここから 30px 以上広げると重なる。余裕を見て上限を決める。 */
const MAX_DISPLAY_WIDTH = 190;

let failed = 0;
const fail = (m) => { console.log(`  ❌ ${m}`); failed++; };
const pass = (m) => console.log(`  ✅ ${m}`);

const htmls = [...fs.readdirSync(LP, { recursive: true })]
  .filter((f) => typeof f === 'string' && f.endsWith('.html') && !f.startsWith('vendor'))
  .map((f) => path.join(LP, f));

/* ヘッダー（nav 内）のロゴだけを見る。フッターの footer-logo は対象外。 */
const LOGO_BOX = /<(a|div)[^>]*class="logo"[^>]*>([\s\S]*?)<\/\1>/;

const withImg = [];
const textLeft = [];
const noBox = [];
let src = null;

for (const f of htmls) {
  const html = fs.readFileSync(f, 'utf8');
  const m = html.match(LOGO_BOX);
  const rel = path.relative(LP, f);
  if (!m) { noBox.push(rel); continue; }
  const inner = m[2];
  const img = inner.match(/<img[^>]*>/);
  if (!img) { textLeft.push(rel); continue; }
  withImg.push([rel, img[0]]);
  const s = img[0].match(/src="([^"]+)"/);
  if (s && !src) src = s[1];
}

console.log('▸ 全ページに入っているか');
if (textLeft.length) {
  fail(`${textLeft.length}ページがまだ文字のまま: ${textLeft.slice(0, 5).join(', ')}`);
} else {
  pass(`${withImg.length}ページすべてがロゴ画像（文字のまま残ったページ 0件）`);
}
if (noBox.length && noBox.length > 5) {
  console.log(`  （ヘッダーを持たないページ ${noBox.length}件は対象外）`);
}

console.log();
console.log('▸ 画像の実体と寸法');
if (!src) {
  fail('ロゴ画像の src が読み取れない');
} else {
  const file = path.join(LP, src.split('?')[0].replace(/^\//, ''));
  if (!fs.existsSync(file)) {
    fail(`参照先が実在しない: ${src}`);
  } else {
    pass(`参照先が実在する: ${src}`);
    if (!/\?v=/.test(src)) {
      fail('src に ?v が無い（差し替えてもブラウザが古い画像を出し続ける）');
    } else {
      pass('src に ?v が付いている');
    }
  }
}

/* すべてのページで同じ src / width / height か（1枚だけ古い、を防ぐ） */
const shapes = new Set(withImg.map(([, tag]) => tag.replace(/\s+/g, ' ')));
if (shapes.size === 1) pass('452ページとも同じ <img>（食い違い 0件）');
else fail(`<img> の書き方が ${shapes.size} 種類ある（1種類であるべき）`);

const sample = withImg[0]?.[1] || '';
const w = Number((sample.match(/width="(\d+)"/) || [])[1]);
const h = Number((sample.match(/height="(\d+)"/) || [])[1]);
if (!w || !h) {
  fail('width / height 属性が無い（読み込み後にヘッダーが飛ぶ）');
} else {
  pass(`width="${w}" height="${h}" が入っている（レイアウトが飛ばない）`);
  if (w > MAX_DISPLAY_WIDTH) {
    fail(`表示幅 ${w}px は広すぎる（上限 ${MAX_DISPLAY_WIDTH}px）。`
       + 'タブレット幅で右のメニューと重なる');
  } else {
    pass(`表示幅 ${w}px は上限 ${MAX_DISPLAY_WIDTH}px 以内`);
  }
}

console.log();
console.log('▸ CSS');
const css = fs.readFileSync(path.join(LP, 'common.css'), 'utf8');
const rule = css.match(/nav \.logo img \{([^}]*)\}/);
if (!rule) {
  fail('common.css に nav .logo img の指定が無い（原寸で出て崩れる）');
} else {
  const body = rule[1];
  if (/height:\s*\d+px/.test(body)) pass('高さが固定されている');
  else fail('height が px で固定されていない');
  if (/width:\s*auto/.test(body)) pass('幅は auto（縦横比が保たれる）');
  else fail('width: auto が無い（画像が歪む）');
}

console.log();
if (failed) {
  console.log(`❌ ${failed}件の問題があります`);
  process.exit(1);
}
console.log('✅ ヘッダーのロゴは全ページで正しく設定されています');
