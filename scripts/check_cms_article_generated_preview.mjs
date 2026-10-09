#!/usr/bin/env node
/* CMS「本番表示」プレビューが、記事ビルドと同じショートコード/CSSを使うか検査する。
 * 版の出どころは build-detail-pages.mjs の定数。べた書きすると本番とズレたまま緑になる（2026-10-09 に v36 で固定されていた）。 */
import fs from 'node:fs';

const cms = fs.readFileSync('LP/cms.js', 'utf8');
const html = fs.readFileSync('LP/cms.html', 'utf8');
const build = fs.readFileSync('scripts/build-detail-pages.mjs', 'utf8');
const failures = [];
const section = cms.match(/function openArticleGeneratedPreview\(\)\{([\s\S]*?)\n\}\n\n\/\* ---------- 記事テンプレート/);
if (!section) failures.push('openArticleGeneratedPreview が見つからない');
const source = section?.[1] || '';
if (!source.includes('renderArticleShortcodes')) failures.push('本番表示プレビューでショートコード変換を呼んでいない');
if (!source.includes('class="article-detail-inner"')) failures.push('本番表示プレビューが実ページと同じ article-detail-inner を使っていない');
const assetVersions = [
  ['COMMON_CSS_VERSION', '/common.css'],
  ['DETAIL_CSS_VERSION', '/detail.css'],
  ['ARTICLE_FX_CSS_VERSION', '/article-fx.css'],
  ['ARTICLE_FX_JS_VERSION', '/article-fx.js'],
];
for (const [name, asset] of assetVersions) {
  const expected = (build.match(new RegExp(`const ${name} = (\\d+);`)) || [])[1] || '';
  const actual = (source.match(new RegExp(`${asset.replace('.', '\\.') }\\?v=(\\d+)`)) || [])[1] || '';
  if (!expected || actual !== expected) failures.push(`${asset} の版が不一致（期待 ${expected || '不明'} / cms.js の実値 ${actual || 'なし'}）`);
}
if (source.includes('<style>body{padding:80px 24px') || source.includes('.article-body{font-family:var(--font-body)')) {
  failures.push('本番ページの見出し改行を上書きする独自CSSが残っている');
}
// 版番号は bump_asset_versions.py が上げるので、ここでは「読み込みがあること」だけを見る
if (!/article-shortcodes\.js\?v=\d+/.test(html)) failures.push('CMSに共通article-shortcodes.jsが読み込まれていない');
if (failures.length) {
  console.error('CMS本番表示プレビューに問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('✅ 本番表示プレビューがイベントカード/カレンダー変換と本番CSSを使用');
