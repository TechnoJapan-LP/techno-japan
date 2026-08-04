#!/usr/bin/env node
/**
 * EDITIONS シートに貼り付けた内容を検証する。
 *
 * ■ なぜ必要か
 *
 *   列ズレ事故（HACHA MECHA 2回 / SPRING LOVE 春風 1回）は「30列を数えなければ
 *   ならない形式」が原因だった。EDITIONS は14列で少ないが、TSV を1回貼るという
 *   点は同じで、ズレたことに気づく手段が無ければ同じ事故が起きる。
 *
 *   貼り付けは人がやる作業なので、事故は「起きない」ようにするのではなく
 *   「起きたら必ず分かる」ようにする。投入元の TSV と、シートから読んだ結果を
 *   突き合わせ、1セルでも違えば止める。
 *
 * ■ 何を見るか
 *
 *   1. ヘッダー名が期待どおりか（列順が違っても名前で照合する）
 *   2. 行数が投入元と一致するか
 *   3. EDITION_ID が一意か
 *   4. FESTIVAL_ID が FESTIVALS に実在するか（参照切れ）
 *   5. 全セルが投入元 TSV と一致するか ← 列ズレはここで必ず出る
 *   6. 日付が YYYY-MM-DD のままか（スプレッドシートの日付型変換で壊れていないか）
 *
 *   6 は特に重要。DATE_START を書式なしテキストにし忘れると 2026/7/17 や
 *   シリアル値（46000 のような数値）に化ける。AUDIT §9-9 と同じ事故。
 *
 * 使い方:
 *   node scripts/verify_editions_sheet.mjs                    # 公開CSVを読んで検証
 *   node scripts/verify_editions_sheet.mjs --gid 123456789    # EDITIONS の gid を指定
 *   node scripts/verify_editions_sheet.mjs --seed <path>      # 投入元TSVを指定
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEED_DEFAULT = path.join(ROOT, 'data', 'inbox', 'export', 'editions-seed.tsv');

// fetch-data.mjs と同じ公開CSV。gid を付けるとそのタブを取れる。
const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub?output=csv';

const COLS = ['EDITION_ID', 'FESTIVAL_ID', 'EDITION', 'DATE_START', 'DATE_END',
  'LOCATION', 'LOCATION_JA', 'PREF', 'ADDRESS', 'LAT', 'LNG', 'TICKETURL', 'FLYER', 'STATUS'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function readSeed(p) {
  const lines = fs.readFileSync(p, 'utf8').replace(/\n$/, '').split('\n');
  const header = lines[0].split('\t');
  return lines.slice(1).map((l) => {
    const cells = l.split('\t');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

function festivalIds() {
  const p = path.join(ROOT, 'LP', 'data', 'festivals.json');
  if (!fs.existsSync(p)) return null;
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return new Set((doc.items || doc).map((f) => String(f.ID || f.id || '').trim()));
}

async function main() {
  const args = process.argv.slice(2);
  const gid = args.find((a) => a.startsWith('--gid='))?.slice(6)
    ?? (args.includes('--gid') ? args[args.indexOf('--gid') + 1] : null);
  const seedPath = args.find((a) => a.startsWith('--seed='))?.slice(7)
    ?? (args.includes('--seed') ? args[args.indexOf('--seed') + 1] : SEED_DEFAULT);

  if (!fs.existsSync(seedPath)) {
    console.error(`✗ 投入元TSVがありません: ${seedPath}`);
    process.exit(1);
  }
  const seed = readSeed(seedPath);

  const url = gid ? `${BASE}&gid=${gid}` : BASE;
  console.log(`投入元 : ${path.relative(ROOT, seedPath)}（${seed.length}行）`);
  console.log(`シート : ${gid ? 'gid=' + gid : '既定タブ'}\n`);

  const rows = parseCsv(await (await fetch(url)).text());
  if (!rows.length) { console.error('✗ シートが空です'); process.exit(1); }

  const failures = [];
  const header = rows[0].map((s) => s.trim());

  // 1. ヘッダー
  const missing = COLS.filter((c) => !header.includes(c));
  const extra = header.filter((h) => h && !COLS.includes(h));
  if (missing.length) failures.push(`ヘッダーに不足: ${missing.join(', ')}`);
  if (extra.length) console.log(`  ⚠ 想定外の列（無視）: ${extra.join(', ')}`);
  if (missing.length) {
    console.error('\n✗ ヘッダーが一致しません。EDITIONS 以外のタブを読んでいる可能性があります。');
    console.error(`  読んだ列: ${header.join(' | ')}`);
    console.error('  --gid で EDITIONS タブの gid を指定してください。');
    process.exit(1);
  }
  console.log('  ✅ ヘッダー14列を確認（列順は名前で吸収）');

  const sheet = rows.slice(1)
    .filter((r) => r.some((c) => String(c).trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));

  // 2. 行数
  if (sheet.length !== seed.length) {
    failures.push(`行数が違う: シート ${sheet.length} / 投入元 ${seed.length}`);
  } else {
    console.log(`  ✅ 行数 ${sheet.length} が投入元と一致`);
  }

  // 3. EDITION_ID の一意性
  const ids = sheet.map((r) => r.EDITION_ID);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dup.length) failures.push(`EDITION_ID が重複: ${dup.join(', ')}`);
  else console.log('  ✅ EDITION_ID は一意');

  // 4. FESTIVAL_ID の参照整合
  const fids = festivalIds();
  if (fids) {
    const orphan = [...new Set(sheet.map((r) => r.FESTIVAL_ID).filter((v) => v && !fids.has(v)))];
    if (orphan.length) failures.push(`FESTIVAL_ID の参照切れ: ${orphan.join(', ')}`);
    else console.log('  ✅ FESTIVAL_ID はすべて FESTIVALS に実在');
  } else {
    console.log('  −  LP/data/festivals.json が無いため参照整合はスキップ');
  }

  // 5. 日付型に化けていないか
  const badDate = [];
  for (const r of sheet) {
    for (const k of ['DATE_START', 'DATE_END']) {
      const v = r[k];
      if (v && !DATE_RE.test(v)) badDate.push(`${r.EDITION_ID}.${k}="${v}"`);
    }
  }
  if (badDate.length) {
    failures.push(`日付が YYYY-MM-DD でない ${badDate.length}件: ${badDate.slice(0, 5).join(', ')}`
      + (badDate.length > 5 ? ' ほか' : '')
      + '\n      → 列を「書式なしテキスト」にしてから貼り直すこと（AUDIT §9-9）');
  } else {
    console.log('  ✅ DATE_START / DATE_END は YYYY-MM-DD のまま');
  }

  // 6. 全セル照合。列ズレはここで必ず出る。
  const seedById = new Map(seed.map((r) => [r.EDITION_ID, r]));
  const diffs = [];
  for (const r of sheet) {
    const s = seedById.get(r.EDITION_ID);
    if (!s) { diffs.push(`${r.EDITION_ID}: 投入元に無い行`); continue; }
    for (const c of COLS) {
      if ((r[c] ?? '') !== (s[c] ?? '')) {
        diffs.push(`${r.EDITION_ID}.${c}  シート="${r[c]}"  投入元="${s[c]}"`);
      }
    }
  }
  for (const s of seed) if (!sheet.some((r) => r.EDITION_ID === s.EDITION_ID)) {
    diffs.push(`${s.EDITION_ID}: シートに無い行`);
  }
  if (diffs.length) {
    failures.push(`セルの不一致 ${diffs.length}件:\n      ` + diffs.slice(0, 12).join('\n      ')
      + (diffs.length > 12 ? `\n      … ほか ${diffs.length - 12}件` : ''));
  } else {
    console.log(`  ✅ 全 ${sheet.length}行 × ${COLS.length}列 が投入元と完全一致（列ズレなし）`);
  }

  if (failures.length) {
    console.error('\n' + '='.repeat(60));
    console.error('EDITIONS シートに問題があります:');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log('\n✅ EDITIONS シートは投入元と一致しています');
}

main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
