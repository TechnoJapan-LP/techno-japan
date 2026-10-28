#!/usr/bin/env node
/** 優先ソース案内が全ページとニュースレターへ残っているか検査する。 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const LP = path.join(ROOT, 'LP');
const PREFERRED_SOURCE_URL = 'https://www.google.com/preferences/source?q=techno-japan.media';
const fail = (message) => { throw new Error(message); };
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const htmlFiles = fs.readdirSync(LP, { recursive: true })
  .filter((file) => typeof file === 'string' && file.endsWith('.html'))
  .map((file) => path.join(LP, file))
  .filter((file) => !file.includes(`${path.sep}vendor${path.sep}`) && !file.endsWith(`${path.sep}cms.html`));

for (const file of htmlFiles) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('<!-- tj:footer:start -->') && !html.includes(`href="${PREFERRED_SOURCE_URL}"`)) {
    fail(`${rel}: フッターに優先ソースリンクがありません`);
  }
}

const articleFiles = htmlFiles.filter((file) => file.includes(`${path.sep}articles${path.sep}`));
for (const file of articleFiles) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('class="article-detail"')) continue;
  const share = html.indexOf('class="article-share"');
  const related = html.indexOf('class="article-related-stories"');
  const preferred = html.indexOf('class="preferred-source preferred-source-article"');
  if (preferred < share || (related >= 0 && preferred > related)) {
    fail(`${rel}: 記事末尾の優先ソース案内が記事シェアの後・関連記事の前にありません`);
  }
  if (!html.includes(`href="${PREFERRED_SOURCE_URL}" target="_blank" rel="noopener"`)) {
    fail(`${rel}: 記事ページの優先ソースリンク属性が不正です`);
  }
}

for (const file of ['LP/index.html', 'LP/news.html', 'LP/about.html', 'LP/en/index.html', 'LP/en/news.html', 'LP/en/about.html']) {
  if (!read(file).includes('data-tj-newsletter')) fail(`${file}: ニュースレター欄がありません`);
}

for (const file of ['LP/magazine.js', 'scripts/newsletter-draft.mjs', 'scripts/build-detail-pages.mjs']) {
  const source = read(file);
  if (!source.includes(PREFERRED_SOURCE_URL)) fail(`${file}: 優先ソースURLの定数がありません`);
}

const scanned = [
  ...htmlFiles,
  path.join(ROOT, 'LP/magazine.js'),
  path.join(ROOT, 'scripts/build-detail-pages.mjs'),
  path.join(ROOT, 'scripts/newsletter-draft.mjs'),
];
const invalid = [];
for (const file of scanned) {
  const source = fs.readFileSync(file, 'utf8');
  const matches = source.match(/https?:\/\/[^\s"'<>]*preferences\/source[^\s"'<>]*/g) || [];
  for (const match of matches) if (match !== PREFERRED_SOURCE_URL) invalid.push(`${path.relative(ROOT, file)}: ${match}`);
}
if (invalid.length) fail(`優先ソースURL以外の preferences/source が ${invalid.length} 件あります\n${invalid.join('\n')}`);

const hubs = ['index.html', 'news.html', 'festivals.html', 'artists.html', 'venues.html', 'about.html'];
for (const hub of hubs) {
  for (const file of [`LP/${hub}`, `LP/en/${hub}`]) {
    if (!read(file).includes(`href="${PREFERRED_SOURCE_URL}"`)) fail(`${file}: JA/EN ハブのフッターに優先ソースリンクがありません`);
  }
}

console.log(`preferred source: ${htmlFiles.length} HTML pages, JA/EN hubs, article placements, magazine.js, newsletter generator checked`);
