#!/usr/bin/env node
/* VENUES の追加4列が CMS の読込・保存・出力経路から落ちていないかを静的に検査する。 */
import fs from 'node:fs';

const cms = fs.readFileSync('LP/cms.js', 'utf8');
const html = fs.readFileSync('LP/cms.html', 'utf8');
const fields = ['name_kana', 'access', 'access_en', 'hours_en'];
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

for (const field of fields) {
  check(html.includes(`id="v-${field}"`), `フォームに v-${field} がない`);
  check(new RegExp(`setVal\\('v-${field}',row\\.${field}\\)`).test(cms), `編集読込が ${field} を保持しない`);
  check(cms.includes(`'${field}'`), `SHEET_FIELD_NAMES に ${field} がない`);
  check(new RegExp(`${field}:g\\('v-${field}'\\)`).test(cms), `${field} の保存読込がない`);
  check(new RegExp(`if\\(r\\.${field}\\) l\\.push`).test(cms), `buildVenuesJs が ${field} を出力しない`);
}

const venuePayloads = [...cms.matchAll(/(?:Object\.assign\(payload,|payload=\{)[\s\S]*?\n\s*\};/g)]
  .map((match) => match[0]).filter((block) => block.includes("g('v-name')"));
check(venuePayloads.length >= 2, 'VENUES の保存 payload が2本見つからない');
for (const field of fields) {
  check(venuePayloads.filter((block) => block.includes(`${field}:g('v-${field}')`)).length >= 2,
    `${field} が両方のVENUES保存 payloadにない`);
}

const exportBlock = cms.slice(cms.indexOf('function submitVenue()'), cms.indexOf('function submitFestival()'));
for (const field of fields) check(exportBlock.includes(`${field}:g('v-${field}')`), `export builder に ${field} がない`);

if (failures.length) {
  console.error('❌ CMS VENUES追加列検査');
  failures.forEach((message) => console.error(`  - ${message}`));
  process.exit(1);
}
console.log('✅ CMS VENUES追加4列: フォーム読込・両保存payload・export・SHEET_FIELD_NAMES・生成を確認');
