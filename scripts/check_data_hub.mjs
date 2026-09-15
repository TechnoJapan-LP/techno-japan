#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'LP', 'data.js');
const hubPath = path.join(root, 'LP', 'data-hub.js');

const REQUIRED = {
  FESTIVALS: ['id', 'name', 'name_en', 'date', 'city', 'image', 'imagePosition', 'genre',
    'location', 'location_ja', 'type', 'venue', 'venue_en', 'lineup', 'status', 'featured', 'area', 'country'],
  ARTISTS: ['id', 'name', 'name_en', 'city', 'country', 'genre', 'image', 'imagePosition'],
  VENUES: ['id', 'name', 'name_en', 'city', 'area', 'genre', 'image', 'imagePosition', 'type',
    'subtype', 'charge', 'features', 'lat', 'lng', 'desc', 'desc_en', 'status'],
  ARTICLES: ['id', 'title', 'title_en', 'excerpt', 'excerpt_en', 'image', 'imagePosition',
    'date', 'category', 'readTime', 'tags', 'views', 'status', 'featured', 'festivalId'],
};
const EXCLUDED = {
  FESTIVALS: ['desc', 'desc_en', 'editions'],
  ARTICLES: ['body', 'body_en'],
};
const DATASETS = ['FESTIVALS', 'ARTISTS', 'VENUES', 'ARTICLES', 'EVENTS'];

const fail = (message) => { throw new Error(message); };
const read = (file) => fs.readFileSync(file, 'utf8');
const evaluate = (source, label) => {
  try {
    return new Function(source + '\nreturn {FESTIVALS, ARTISTS, VENUES, ARTICLES, EVENTS};')();
  } catch (error) {
    fail(`${label} を評価できません: ${error.message}`);
  }
};
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const ids = (rows, name) => rows.map((row, index) => {
  if (!row || !hasValue(row.id)) fail(`${name}[${index}] に id がありません`);
  return row.id;
});

if (!fs.existsSync(hubPath)) fail('LP/data-hub.js がありません');
const data = evaluate(read(dataPath), 'LP/data.js');
const hub = evaluate(read(hubPath), 'LP/data-hub.js');
console.log('✅ data-hub.js は new Function で評価できます');

// build-detail-pages.mjs の保険生成と同じ規約で、data.js から期待値を組み立てる。
// 実ファイルを退避・復元するテストではなく、生成関数の入力と出力の対応を検証する。
const expectedHub = {};
for (const name of DATASETS) {
  expectedHub[name] = (data[name] || []).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => {
    if (name === 'ARTICLES') return key !== 'body' && key !== 'body_en';
    if (name === 'FESTIVALS') return key !== 'desc' && key !== 'desc_en' && key !== 'editions';
    return true;
  })));
}
if (JSON.stringify(expectedHub) !== JSON.stringify(hub)) {
  fail('data.js から保険生成した期待値と data-hub.js の内容が一致しません');
}
const buildSource = read(path.join(root, 'scripts', 'build-detail-pages.mjs'));
if (!buildSource.includes('function buildHubDataJs(data)') || !buildSource.includes('writeHubDataJs(data)')) {
  fail('build-detail-pages.mjs に data-hub.js の保険生成経路がありません');
}
console.log('✅ data.js から保険生成した data-hub.js と一致');

for (const name of DATASETS) {
  if (!Array.isArray(data[name]) || !Array.isArray(hub[name])) fail(`${name} が配列ではありません`);
  if (data[name].length !== hub[name].length) {
    fail(`${name} の件数が不一致: data.js=${data[name].length}, data-hub.js=${hub[name].length}`);
  }
  const dataIds = ids(data[name], name);
  const hubIds = ids(hub[name], `hub ${name}`);
  if (JSON.stringify(dataIds) !== JSON.stringify(hubIds)) {
    fail(`${name} の id 集合または並び順が不一致です`);
  }
  console.log(`✅ ${name}: ${data[name].length}件、id順一致`);
}

const missing = [];
for (const [name, fields] of Object.entries(REQUIRED)) {
  data[name].forEach((row, index) => fields.forEach((field) => {
    if (hasValue(row[field]) && !hasValue(hub[name][index][field])) {
      missing.push(`${name}[${index}] ${row.id}: ${field}`);
    }
  }));
}
if (missing.length) fail(`保持項目が欠落しています:\n${missing.join('\n')}`);
console.log('✅ 保持項目: data.js に値がある項目は欠落なし');

const excludedFound = [];
for (const [name, fields] of Object.entries(EXCLUDED)) {
  hub[name].forEach((row, index) => fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(row, field)) excludedFound.push(`${name}[${index}] ${field}`);
  }));
}
if (excludedFound.length) fail(`除外項目が data-hub.js に残っています:\n${excludedFound.join('\n')}`);
console.log('✅ 除外5項目: data-hub.js に含まれていません');

const dataSize = fs.statSync(dataPath).size;
const hubSize = fs.statSync(hubPath).size;
console.log(`ℹ️ サイズ: data.js=${dataSize} bytes / data-hub.js=${hubSize} bytes (${(hubSize / dataSize * 100).toFixed(1)}%)`);
if (hubSize >= dataSize) fail('data-hub.js が data.js 以上のサイズです');
if (hubSize > 130 * 1024) console.warn('⚠️ data-hub.js が130KBを超えています');

const jaHubs = ['index.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html', 'about.html', 'favorites.html', 'map.html'];
const enHubs = ['index.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html'];
for (const file of jaHubs) {
  const html = read(path.join(root, 'LP', file));
  if (!/src="\/?data-hub\.js\?v=\d+"/.test(html) || /src="\/?data\.js\?v=\d+"/.test(html)) {
    fail(`JA ${file} のデータ参照が不正です`);
  }
}
for (const file of enHubs) {
  const html = read(path.join(root, 'LP', 'en', file));
  if (!/src="\/?data-hub\.js\?v=\d+"/.test(html) || /src="\/?data\.js\?v=\d+"/.test(html)) {
    fail(`EN ${file} のデータ参照が不正です（enHubFromJa で生成してください）`);
  }
}
console.log(`✅ ハブHTML: JA${jaHubs.length}枚 / EN${enHubs.length}枚が data-hub.js のみ参照`);
