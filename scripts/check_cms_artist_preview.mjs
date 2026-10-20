#!/usr/bin/env node
/* アーティスト CMS プレビューが本番の詳細ページをテンプレートにし、
 * bilingualBody の構造と計測除去の方針を維持しているか確認する。 */
import fs from 'node:fs';

const cms = fs.readFileSync('LP/cms.js', 'utf8');
const html = fs.readFileSync('LP/cms.html', 'utf8');
const build = fs.readFileSync('scripts/build-detail-pages.mjs', 'utf8');
const failures = [];
const required = [
  ["アーティストテンプレートを no-store で取得", "fetch('/artists/'+encodeURIComponent(id)+'.html',{cache:'no-store'})"],
  ['detail-inner を使う', "querySelector('.detail-page .detail-inner')"],
  ['本番の detail-body bilingual 構造', 'class="detail-body bilingual"'],
  ['言語ボタンの data-lang', 'data-lang="ja"'],
  ['言語本文の lang-body', 'class="lang-body"'],
  ['iframe の srcdoc 表示', "iframe.srcdoc='<!doctype html>'"],
];
for (const [label, needle] of required) if (!cms.includes(needle)) failures.push(`${label}: ${needle}`);

const buildBody = build.match(/function bilingualBody\([\s\S]*?\n}\n\/\/ 本文中/ )?.[0] || '';
const previewBody = cms.match(/function artistPreviewBilingualBody_\([\s\S]*?\n}\nfunction artistPreviewGenreHtml_/)?.[0] || '';
for (const token of ['detail-body', 'bilingual', 'lang-toggle', 'lang-body', 'data-lang="ja"', 'data-lang="en"']) {
  if (!buildBody.includes(token)) failures.push(`build-detail-pages.mjs に比較対象 ${token} がない`);
  if (!previewBody.includes(token)) failures.push(`CMS bilingualBody 相当が ${token} を出していない`);
}
if (!/cache:\s*'no-store'/.test(cms)) failures.push('テンプレート fetch が cache:no-store ではない');
const sanitizer = cms.match(/function prepareArtistPreviewDocument_\([\s\S]*?\n}\nfunction renderArtistTemplatePreview_/)?.[0] || '';
if (!sanitizer.includes("/\\/lang-toggle\\.js(?:\\?|$)/")) failures.push('プレビュー用 script の許可が lang-toggle.js に限定されていない');
if (!sanitizer.includes('script.remove()')) failures.push('プレビュー用の不要な script 除去がない');
if (/gtag|googletagmanager|serviceWorker|navigator\.serviceWorker/.test(sanitizer)) failures.push('プレビュー用 document 準備処理に計測または Service Worker が残っている');
if (!/function renderArtistPreview\(\)[\s\S]*?簡易表示/.test(cms)) failures.push('テンプレート取得失敗時の簡易表示フォールバックがない');

// bio_en は buildPublishingSection が動的に作る公開設定欄だけが所有する。
// cms.html に同じ id を置くと getElementById が誤って先頭の欄を返すため、静的欄は0個であることを確認する。
const staticBioEnCount = (html.match(/id=["']a-bioEn["']/g) || []).length;
if (staticBioEnCount !== 0) failures.push(`cms.html に a-bioEn の静的 id が ${staticBioEnCount} 個ある（公開設定の動的欄と重複）`);
const publishingSection = cms.match(/function buildPublishingSection\(section\)[\s\S]*?\n}\n\nfunction updateCharCount/)?.[0] || '';
if (!publishingSection.includes("section === 'artist' ? 'bio'")) failures.push('buildPublishingSection の artist bio 分岐が見つからない');
if (!publishingSection.includes('id="${p}-${descField}En"')) failures.push('公開設定側の動的 a-bioEn 生成が見つからない');
if (!cms.includes("fields[descField+'_en'] = g(p+'-'+descField+'En')")) failures.push('getPubFields の bio_en 読み取りが見つからない');
if (!cms.includes("setVal(p+'-'+descField+'En', row[descField+'_en'] || '')")) failures.push('setPubFields の bio_en 書き込みが見つからない');
if (!cms.includes("artistPreviewValue_('a-bioEn')")) failures.push('プレビューが公開設定側の a-bioEn を読んでいない');

if (failures.length) {
  console.error('CMS アーティストプレビュー検査に失敗しました:');
  failures.forEach(failure => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('✅ CMS アーティストプレビューが本番テンプレート・bilingualBody構造・計測除去を満たす');
