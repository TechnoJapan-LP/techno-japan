/* CMS の Image Position が、詳細ページの写真に本当に効いているか。

   ■ なぜ必要か（AUDIT §9-83）

   CMS には3種すべて（アーティスト / 会場 / フェス）に Image Position の
   入力欄があり、「頭が切れるときは top を選ぶ」と書いてある。
   入力は保存され、data.js にも書き出されていた。

   **ところが詳細ページに届いていたのはフェスだけだった。**
   アーティストと会場の hero は object-position を出力しておらず、
   CMS で "center top" を入れても実際の描画は 50% 50% のままだった。

     WATA IGARASHI   指定 center top → 実際 50% 50%
     原画 1440×1440 が 3:2 の枠に入り、縦の33%が切られ
     **上から17%（＝頭）が消えていた**

   入力欄がある・保存もされる・data.js にも載る。
   **最後の1行だけが無かった。**画面を見る以外に気づく方法が無かった。

   ■ 何を見るか

   data.js で imagePosition を持つ全項目について、生成された詳細ページの
   hero 画像に同じ object-position が入っているか。JA / EN 両方。
   指定が無い項目は center が入っていることも確かめる。

   使い方: node scripts/check_image_position.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

const sandbox = {};
new Function('window', fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + `
  window.__d = {
    ARTISTS: typeof ARTISTS !== 'undefined' ? ARTISTS : [],
    VENUES: typeof VENUES !== 'undefined' ? VENUES : [],
    FESTIVALS: typeof FESTIVALS !== 'undefined' ? FESTIVALS : []
  };`)(sandbox);
const DATA = sandbox.__d;

const KINDS = [
  { key: 'ARTISTS', dir: 'artists', label: 'アーティスト' },
  { key: 'VENUES', dir: 'venues', label: '会場' },
  { key: 'FESTIVALS', dir: 'festivals', label: 'フェス' },
];

/* hero の <img> を取り出す。回遊カード（related-card-img）は別物なので除く。 */
function heroImgTag(html) {
  const m = html.match(/<div class="detail-hero[^"]*">\s*<img\b[^>]*>/)
        || html.match(/<div class="detail-hero-image">\s*<img\b[^>]*>/);
  return m ? m[0] : null;
}

let failed = 0;
let checked = 0;
const misses = [];

for (const { key, dir, label } of KINDS) {
  const items = (DATA[key] || []).filter((x) => x.image);
  let positioned = 0;
  for (const item of items) {
    const want = String(item.imagePosition || 'center').trim() || 'center';
    if (item.imagePosition) positioned++;
    for (const lang of ['ja', 'en']) {
      const file = path.join(LP, lang === 'en' ? 'en' : '', dir, `${item.id}.html`);
      if (!fs.existsSync(file)) continue;   // draft 等で生成されないものは対象外
      checked++;
      const tag = heroImgTag(fs.readFileSync(file, 'utf8'));
      if (!tag) { misses.push([label, item.id, lang, want, 'hero画像が見つからない']); failed++; continue; }
      const m = tag.match(/object-position:([^";]*)/);
      const got = m ? m[1].trim() : null;
      if (got !== want) {
        misses.push([label, item.id, lang, want, got === null ? 'object-position が無い' : got]);
        failed++;
      }
    }
  }
  console.log(`  ${label}: 画像あり ${items.length}件（うち位置指定 ${positioned}件）`);
}

console.log();
if (failed) {
  console.log('❌ Image Position が詳細ページに届いていません:');
  for (const [label, id, lang, want, got] of misses.slice(0, 20)) {
    console.log(`  ✗ ${label} ${id} (${lang})  CMS指定 "${want}"  →  ${got}`);
  }
  if (misses.length > 20) console.log(`  … ほか ${misses.length - 20}件`);
  console.log();
  console.log('  build-detail-pages.mjs の imagePositionStyle() を hero の <img> に');
  console.log('  付けてください。2026-08-14 まで、アーティストと会場では');
  console.log('  この1行が無く、CMS の指定が画面に届いていませんでした（AUDIT §9-83）。');
  process.exit(1);
}

console.log(`✅ ${checked}ページとも CMS の Image Position どおりに出力されています`);
