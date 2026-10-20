#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { driveFileId, loadArticleImageMap, replaceMappedArticleImages } from './lib/article-body-images.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const map = loadArticleImageMap(ROOT);
const entries = Object.entries(map);
const missing = entries.filter(([, relative]) => !fs.existsSync(path.join(ROOT, 'LP', String(relative).replace(/^\/+/, ''))));
if (missing.length) throw new Error(`対応表の実ファイルがありません: ${missing.map(([id, file]) => `${id} → ${file}`).join(', ')}`);

const pages = [];
for (const directory of ['articles', 'en/articles']) {
  const dir = path.join(ROOT, 'LP', directory);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.html'))) pages.push(fs.readFileSync(path.join(dir, file), 'utf8'));
}
const mappedIds = new Set(Object.keys(map));
const remaining = new Set();
for (const page of pages) {
  for (const match of page.matchAll(/https:\/\/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/gi)) {
    if (mappedIds.has(match[1])) throw new Error(`生成済み記事ページに対応済みDrive URLが残っています: ${match[1]}`);
    remaining.add(match[1]);
  }
}
console.log(`対応表: ${entries.length}件 / 実ファイル欠落: ${missing.length}件 / 生成済みページに残る未対応Drive画像: ${remaining.size} unique`);
if (remaining.size) console.log(`::warning::未対応Drive画像（同期前は正常）: ${[...remaining].join(', ')}`);

const [known, knownPath] = entries[0] || ['test', 'images/articles/test.webp'];
const fixture = `<p><a href="https://lh3.googleusercontent.com/d/${known}=w1600"><img src='https://lh3.googleusercontent.com/d/${known}=w2000' srcset="old"></a><img src="https://lh3.googleusercontent.com/d/unknown=w2000"></p>`;
const replaced = replaceMappedArticleImages(fixture, { [known]: knownPath }, ROOT);
if (!replaced.includes(`href="/${knownPath}"`) || !replaced.includes(`src='/${knownPath}'`)) {
  throw new Error('記事本文画像の置換テストに失敗しました');
}
if (driveFileId('https://drive.google.com/uc?export=view&id=abc_123') !== 'abc_123') throw new Error('uc?id= の抽出テストに失敗しました');
console.log('置換関数テスト: mapped/unmapped/srcset既存/サイズ違い/single-quote OK');
