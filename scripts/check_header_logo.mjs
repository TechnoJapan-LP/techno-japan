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

/* ヘッダー（class="logo"）とフッター（class="footer-logo"）の両方を見る。
   2026-08-14 の第1弾ではヘッダーだけを画像化したため、この検査も
   ヘッダーしか見ていなかった。第2弾でフッターも画像にしたので広げた。 */
const BOXES = [
  { label: 'ヘッダー', re: /<(a|div)[^>]*class="logo"[^>]*>([\s\S]*?)<\/\1>/ },
  { label: 'フッター', re: /<div[^>]*class="footer-logo"[^>]*>([\s\S]*?)<\/div>/ },
];

const withImg = [];
let src = null;

console.log('▸ 全ページに入っているか');
for (const box of BOXES) {
  const found = [];
  const textLeft = [];
  let noBox = 0;
  for (const f of htmls) {
    const html = fs.readFileSync(f, 'utf8');
    const m = html.match(box.re);
    const rel = path.relative(LP, f);
    if (!m) { noBox++; continue; }
    const inner = m[m.length - 1];
    const img = inner.match(/<img[^>]*>/);
    if (!img) { textLeft.push(rel); continue; }
    found.push([rel, img[0]]);
    withImg.push([rel, img[0], box.label]);
    const sm = img[0].match(/src="([^"]+)"/);
    if (sm && !src) src = sm[1];
  }
  if (textLeft.length) {
    fail(`${box.label}: ${textLeft.length}ページがまだ文字のまま: ${textLeft.slice(0, 5).join(', ')}`);
  } else if (found.length === 0) {
    fail(`${box.label}: ロゴが1ページも見つからない`);
  } else {
    pass(`${box.label}: ${found.length}ページすべてがロゴ画像（文字のまま残ったページ 0件）`);
  }
  if (noBox > 5) console.log(`  （${box.label}を持たないページ ${noBox}件は対象外）`);
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

/* 同じ場所のロゴは全ページで同一か（1枚だけ古い、を防ぐ）。
   ヘッダーとフッターは別々に見る。フッターは画面下なので loading="lazy" が
   付き、ヘッダーは最初に見えるので付かない。**この差は正しい。**
   まとめて1種類だと判定すると、正しい違いを不具合として報告してしまう。 */
for (const label of ['ヘッダー', 'フッター']) {
  const tags = withImg.filter(([, , l]) => l === label).map(([, t]) => t.replace(/\s+/g, ' '));
  const shapes = new Set(tags);
  if (shapes.size === 1) pass(`${label}: ${tags.length}ページとも同じ <img>（食い違い 0件）`);
  else fail(`${label}: <img> の書き方が ${shapes.size} 種類ある（1種類であるべき）`);
}
/* 画面下のフッターだけは遅延読み込みにしておく（初期表示を軽くする） */
const footerTag = (withImg.find(([, , l]) => l === 'フッター') || [])[1] || '';
if (/loading="lazy"/.test(footerTag)) pass('フッター: loading="lazy" が付いている');
else fail('フッター: loading="lazy" が無い（画面下なのに先に読み込む）');
const headerTag = (withImg.find(([, , l]) => l === 'ヘッダー') || [])[1] || '';
if (!/loading="lazy"/.test(headerTag)) pass('ヘッダー: 即時読み込み（lazy 無し）');
else fail('ヘッダー: loading="lazy" が付いている（最初に見える位置なので遅れて出る）');

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
console.log('▸ タップ領域');
/* ロゴを画像にした際、当たり判定が画像の高さ(13px)まで縮んだ。
   推奨は44px。padding で広げ、同じ量の負の margin で相殺してある
   （見た目の位置は変わらない）。2026-08-15 実測で 158x13 → 158x44。
   AUDIT §9-90。 */
{
  const cssAll = fs.readFileSync(path.join(LP, 'common.css'), 'utf-8');
  const rule = cssAll.match(/nav \.logo, \.footer-logo \{([^}]*)\}/);
  if (!rule) {
    fail('common.css に nav .logo, .footer-logo のタップ領域指定が無い');
  } else {
    const b = rule[1];
    const pt = Number((b.match(/padding-top:\s*(\d+)px/) || [])[1] || 0);
    const pb = Number((b.match(/padding-bottom:\s*(\d+)px/) || [])[1] || 0);
    const mt = Number((b.match(/margin-top:\s*-(\d+)px/) || [])[1] || 0);
    const mb = Number((b.match(/margin-bottom:\s*-(\d+)px/) || [])[1] || 0);
    const tap = (h || 0) + pt + pb;
    if (tap >= 44) pass(`当たり判定 ${tap}px（画像${h}px + 余白${pt + pb}px）— 推奨44px以上`);
    else fail(`当たり判定 ${tap}px は小さい（推奨44px）。指で押しにくい`);
    if (pt === mt && pb === mb) pass('余白と同じだけ負の margin があり、見た目の位置は変わらない');
    else fail(`padding(${pt}/${pb}) と margin(-${mt}/-${mb}) が非対称。ヘッダーの高さが動く`);
  }
}

console.log();
console.log('▸ CSS');
const css = fs.readFileSync(path.join(LP, 'common.css'), 'utf8');
for (const sel of ['nav \\.logo img', '\\.footer-logo img']) {
  const label = sel.includes('footer') ? 'フッター' : 'ヘッダー';
  const rule = css.match(new RegExp(sel + ' \\{([^}]*)\\}'));
  if (!rule) {
    fail(`common.css に ${sel.replace(/\\\\/g, '')} の指定が無い（原寸で出て崩れる）`);
    continue;
  }
  const body = rule[1];
  if (/height:\s*\d+px/.test(body)) pass(`${label}: 高さが固定されている`);
  else fail(`${label}: height が px で固定されていない`);
  if (/width:\s*auto/.test(body)) pass(`${label}: 幅は auto（縦横比が保たれる）`);
  else fail(`${label}: width: auto が無い（画像が歪む）`);
}

console.log();
if (failed) {
  console.log(`❌ ${failed}件の問題があります`);
  process.exit(1);
}
console.log('✅ ヘッダーのロゴは全ページで正しく設定されています');
