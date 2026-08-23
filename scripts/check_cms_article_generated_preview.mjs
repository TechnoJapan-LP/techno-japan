#!/usr/bin/env node
/* CMS「本番表示」プレビューが、記事ビルドと同じショートコード/CSSを使うか検査する。 */
import fs from 'node:fs';

const cms = fs.readFileSync('LP/cms.js', 'utf8');
const html = fs.readFileSync('LP/cms.html', 'utf8');
const failures = [];
const section = cms.match(/function openArticleGeneratedPreview\(\)\{([\s\S]*?)\n\}\n\n\/\* ---------- 記事テンプレート/);
if (!section) failures.push('openArticleGeneratedPreview が見つからない');
const source = section?.[1] || '';
if (!source.includes('renderArticleShortcodes')) failures.push('本番表示プレビューでショートコード変換を呼んでいない');
if (!source.includes('class="article-detail-inner"')) failures.push('本番表示プレビューが実ページと同じ article-detail-inner を使っていない');
if (!source.includes('/common.css?v=27') || !source.includes('/detail.css?v=29') || !source.includes('/article-fx.css?v=10') || !source.includes('/article-fx.js?v=6')) {
  failures.push('本番ページと同じCSS/JSバージョンを参照していない');
}
if (source.includes('<style>body{padding:80px 24px') || source.includes('.article-body{font-family:var(--font-body)')) {
  failures.push('本番ページの見出し改行を上書きする独自CSSが残っている');
}
if (!html.includes('article-shortcodes.js?v=2')) failures.push('CMSに共通article-shortcodes.jsが読み込まれていない');
if (failures.length) {
  console.error('CMS本番表示プレビューに問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('✅ 本番表示プレビューがイベントカード/カレンダー変換と本番CSSを使用');
