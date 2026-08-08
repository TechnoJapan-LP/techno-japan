#!/usr/bin/env node
/**
 * 貼り付け用 TSV の列が、実際のシートと一致するかを貼る前に確かめる。
 *
 * ■ なぜ必要か
 *
 *   列がズレたまま貼ると、値が隣の列に入る。しかも**エラーは出ない**ので、
 *   公開されるまで気づけない。過去に HACHA MECHA と SPRING LOVE 春風 で
 *   実際に起きている（AUDIT §9-9 / EDITIONS 投入時の申し送り）。
 *
 *   2026-08-09 にも、VENUE の下書きを 18列で作って**16列目以降がズレていた**。
 *   貼る直前に気づけたのは、たまたま確認したから。**確認を道具にする。**
 *
 *   自分で列を並べないこと。シートの1行目をそのまま使えばズレようがない。
 *
 * ■ 何を見るか
 *
 *   1. 列数がシートと同じか
 *   2. 列名と順序が1つずつ一致するか
 *   3. 各行のセル数がヘッダーと同じか（タブの数え間違い）
 *   4. ID が既にシートにあるか（あるなら追記ではなく更新すべき）
 *
 * 使い方:
 *   node scripts/check_paste_tsv.mjs data/inbox/export/venues-draft.tsv --sheet VENUES
 *   node scripts/check_paste_tsv.mjs <tsv> --gid 525830431
 */

import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub?single=true&output=csv';

// fetch-data.mjs と同じ gid。
const GIDS = {
  FESTIVALS: '818164718',
  VENUES: '525830431',
  ARTISTS: '648440679',
  EVENTS: '959929754',
  EDITIONS: '1765363054',
  LINEUPS: '580984930',
};

function parseCsv(text) {
  const rows = [];
  let cur = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(field); field = ''; }
    else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || cur.length) { cur.push(field); rows.push(cur); }
  return rows;
}

const args = process.argv.slice(2);
const tsvPath = args.find((a) => !a.startsWith('--'));
const sheetName = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;
const gidArg = args.includes('--gid') ? args[args.indexOf('--gid') + 1] : null;
const gid = gidArg || (sheetName ? GIDS[sheetName.toUpperCase()] : null);

if (!tsvPath || !gid) {
  console.error('使い方: node scripts/check_paste_tsv.mjs <tsv> --sheet VENUES');
  console.error('  シート名: ' + Object.keys(GIDS).join(' / '));
  process.exit(1);
}
if (!fs.existsSync(tsvPath)) {
  console.error(`✗ TSV がありません: ${tsvPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(tsvPath, 'utf8').replace(/\n$/, '').split('\n');
const tsvHeader = lines[0].split('\t');
const tsvRows = lines.slice(1).map((l) => l.split('\t'));

const sheetRows = parseCsv(await (await fetch(`${BASE}&gid=${gid}`)).text());
const sheetHeader = sheetRows[0].map((s) => s.trim());

const failures = [];
console.log(`投入元: ${path.basename(tsvPath)}（${tsvRows.length}行）`);
console.log(`シート: gid=${gid}\n`);

// 1) 列数
if (tsvHeader.length !== sheetHeader.length) {
  failures.push(`列数が違う: シート ${sheetHeader.length} / 投入元 ${tsvHeader.length}`);
}

// 2) 列名と順序
const mismatch = [];
for (let i = 0; i < Math.max(sheetHeader.length, tsvHeader.length); i++) {
  const s = sheetHeader[i] ?? '(なし)', t = tsvHeader[i] ?? '(なし)';
  if (s !== t) mismatch.push(`  ${String(i + 1).padStart(2)}列目  シート="${s}"  投入元="${t}"`);
}
if (mismatch.length) {
  failures.push('列名・順序が違う:\n' + mismatch.slice(0, 12).join('\n')
    + (mismatch.length > 12 ? `\n  … ほか ${mismatch.length - 12}件` : '')
    + '\n      → シートの1行目をそのままコピーして使うこと（自分で並べない）');
} else {
  console.log(`  ✅ ${sheetHeader.length}列が名前・順序とも一致`);
}

// 3) 行ごとのセル数
const badCells = tsvRows
  .map((r, i) => [i + 2, r.length])
  .filter(([, n]) => n !== tsvHeader.length);
if (badCells.length) {
  failures.push(`セル数がヘッダーと違う行: ${badCells.map(([l, n]) => `${l}行目=${n}個`).join(', ')}`
    + '\n      → タブの数が合っていない。空欄も必ずタブで埋めること');
} else if (tsvRows.length) {
  console.log(`  ✅ 全${tsvRows.length}行のセル数がヘッダーと一致`);
}

// 4) ID の重複（追記でよいか）
const idCol = tsvHeader.findIndex((h) => h === 'ID' || h === 'EDITION_ID');
if (idCol >= 0) {
  const sheetIds = new Set(sheetRows.slice(1).map((r) => (r[idCol] || '').trim()).filter(Boolean));
  const dup = tsvRows.map((r) => (r[idCol] || '').trim()).filter((v) => v && sheetIds.has(v));
  if (dup.length) {
    failures.push(`シートに既にある ID: ${dup.join(', ')}`
      + '\n      → 末尾に貼ると重複する。その行を更新すること（EDITIONS の重複26行と同じ事故。§9-58）');
  } else {
    console.log('  ✅ 投入する ID はシートに存在しない（末尾へ追記してよい）');
  }
}

if (failures.length) {
  console.log('\n' + '='.repeat(60));
  console.log('このまま貼ると事故になります:');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('\n✅ このまま貼り付けて問題ありません');
