#!/usr/bin/env node
/*
 * 2026-09-11、build-detail-pages.mjs で lineupsByEdition への行登録が
 * 2箇所に存在し、全フェスのLINEUPが2重表示になる事故が起きた（修正済み）。
 * 既存の回帰しきい値は増加を検知しなかったため、この検査では表示数と
 * データソースの行数を厳密に一致させる。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lineupDataPath = path.join(root, 'LP/data/lineups.json');
const lineupData = JSON.parse(fs.readFileSync(lineupDataPath, 'utf8'));
const sourceItems = Array.isArray(lineupData.items) ? lineupData.items : [];

const sourceCounts = new Map();
for (const row of sourceItems) {
  const editionId = String(row?.EDITION_ID || '').trim();
  if (!editionId) continue;
  sourceCounts.set(editionId, (sourceCounts.get(editionId) || 0) + 1);
}

function renderedCounts(directory) {
  const counts = new Map();
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.html'));

  for (const file of files) {
    const html = fs.readFileSync(path.join(directory, file), 'utf8');
    const festivalId = file.slice(0, -'.html'.length);
    const sections = html.matchAll(
      /<section\b[^>]*\bclass\s*=\s*["'][^"']*\bedition-lineup\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
    );

    for (const match of sections) {
      const sectionBody = match[1];
      const year = sectionBody.match(/<h3\b[^>]*>\s*(\d{4})\s*<\/h3>/i)?.[1];
      if (!year) continue;

      const editionId = `${festivalId}-${year}`;
      const displayedCount = (sectionBody.match(/\bdata-lineup-slot\b/g) || []).length;
      counts.set(editionId, (counts.get(editionId) || 0) + displayedCount);
    }
  }

  return counts;
}

const languages = [
  { label: 'JA', directory: path.join(root, 'LP/festivals') },
  { label: 'EN', directory: path.join(root, 'LP/en/festivals') },
];
const renderedByLanguage = languages.map(({ directory }) => renderedCounts(directory));
const mismatches = [];
let verifiedIds = 0;

for (const editionId of [...sourceCounts.keys()].sort()) {
  const sourceCount = sourceCounts.get(editionId);
  const hasAllLanguageSections = renderedByLanguage.every((counts) => counts.has(editionId));
  if (hasAllLanguageSections) verifiedIds += 1;

  for (let index = 0; index < languages.length; index += 1) {
    const displayedCount = renderedByLanguage[index].get(editionId) || 0;
    if (displayedCount !== sourceCount) {
      mismatches.push(
        `${languages[index].label} ${editionId}: ソース${sourceCount}行 / 表示${displayedCount}件`,
      );
    }
  }
}

if (verifiedIds === 0) {
  console.error('LINEUP表示数の検証対象0件');
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

if (mismatches.length > 0) {
  console.error(`LINEUP表示数の不一致 ${mismatches.length}件`);
  for (const mismatch of mismatches) console.error(`- ${mismatch}`);
  process.exit(1);
}

console.log(`LINEUP表示数の一致 ${verifiedIds}件（JA/EN）`);
