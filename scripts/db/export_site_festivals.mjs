#!/usr/bin/env node
/**
 * LP/data.js の FESTIVALS を sync-site 用の JSON に変換する。
 * data.js はこのリポジトリ自身が生成する信頼できる入力なので、対象配列を
 * new Function で評価する（外部入力を評価する用途ではない）。
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const data = readFileSync(join(here, '../../LP/data.js'), 'utf8');
const start = data.indexOf('const FESTIVALS = [');
if (start < 0) throw new Error('const FESTIVALS が見つかりません');
const arrayStart = data.indexOf('[', start);
const end = data.indexOf('\n];', arrayStart);
if (end < 0) throw new Error('FESTIVALS の終端が見つかりません');
const festivals = new Function(`return ${data.slice(arrayStart, end + 2)}`)();

function dateParts(raw) {
  const value = String(raw || '').trim();
  if (!value) return ['', ''];
  const [startDate, endDate = startDate] = value.split('/');
  return [startDate || '', endDate || ''];
}

function latestDate(festival) {
  const editions = Array.isArray(festival.editions) ? festival.editions : [];
  if (editions.length) {
    const latest = editions.reduce((best, edition) => {
      const year = Number(edition?.year);
      return !best || year > Number(best.year) ? edition : best;
    }, null);
    return dateParts(latest?.date);
  }
  return dateParts(festival.date);
}

const output = festivals.map((festival) => {
  const [last_date_start, last_date_end] = latestDate(festival);
  return {
    festival_id: String(festival.id || ''),
    name: String(festival.name || ''),
    city: String(festival.city || ''),
    official_url: String(festival.url || ''),
    status: String(festival.status || ''),
    last_date_start,
    last_date_end,
  };
});

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
