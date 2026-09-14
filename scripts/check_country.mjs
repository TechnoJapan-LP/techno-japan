#!/usr/bin/env node
/**
 * FESTIVALS の国コードと Airtable 同期経路を検査する。
 * COUNTRY 列の移行中は空欄を許容し、件数だけを情報として表示する。
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataPath = join(root, 'LP', 'data.js');
const exporterPath = join(root, 'scripts', 'db', 'export_site_festivals.mjs');
const pipelinePath = join(root, 'scripts', 'db', 'airtable_pipeline.py');

function loadFestivals() {
  const source = readFileSync(dataPath, 'utf8');
  const start = source.indexOf('const FESTIVALS = [');
  if (start < 0) throw new Error('const FESTIVALS が見つかりません');
  const arrayStart = source.indexOf('[', start);
  const end = source.indexOf('\n];', arrayStart);
  if (end < 0) throw new Error('FESTIVALS の終端が見つかりません');
  return new Function(`return ${source.slice(arrayStart, end + 2)}`)();
}

function fail(messages) {
  for (const message of messages) console.error(`❌ ${message}`);
  process.exit(1);
}

const festivals = loadFestivals();
const invalid = festivals
  .filter((festival) => Object.prototype.hasOwnProperty.call(festival, 'country'))
  .filter((festival) => !/^[A-Z]{2}$/.test(String(festival.country)));
if (invalid.length) {
  fail(invalid.map((festival) => `${festival.id}: country=${JSON.stringify(festival.country)}`));
}

let exported;
try {
  exported = JSON.parse(execFileSync(process.execPath, [exporterPath], { encoding: 'utf8' }));
} catch (error) {
  fail([`export_site_festivals.mjs の実行に失敗: ${error.message}`]);
}
const missingExportKeys = exported.filter((festival) => !Object.prototype.hasOwnProperty.call(festival, 'country'));
if (missingExportKeys.length) {
  fail([`export の ${missingExportKeys.length}件に country キーがありません`]);
}

const pipeline = readFileSync(pipelinePath, 'utf8');
if (/["']country["']\s*:\s*["']JP["']/.test(pipeline)) {
  fail(['airtable_pipeline.py に country の JP 固定値が残っています']);
}

const emptyCount = festivals.filter((festival) => !String(festival.country || '').trim()).length;
console.log(`✅ FESTIVALS の国コード: ${festivals.length - emptyCount}件設定済み / 空欄 ${emptyCount}件`);
console.log(`✅ export_site_festivals.mjs: ${exported.length}件すべてに country キーあり`);
console.log('✅ airtable_pipeline.py: country の JP 固定値なし');
