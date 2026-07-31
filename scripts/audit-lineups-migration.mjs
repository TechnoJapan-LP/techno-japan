#!/usr/bin/env node
/**
 * LINEUPSの新列への安全なコピー案と、人手確認が必要な行をCSVへ出す。
 * 入力JSONやdata.js、スプレッドシートは一切更新しない。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'LP', 'data');
const REPORT_DIR = path.join(ROOT, 'reports');
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const readItems = (name) => {
  const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
  if (!Array.isArray(data.items)) throw new Error(`${name}: items 配列がありません`);
  return data.items;
};

function loadDataJs() {
  const src = fs.readFileSync(path.join(ROOT, 'LP', 'data.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  new vm.Script(`${src}\n;globalThis.__data = { ARTISTS, FESTIVALS };`).runInContext(ctx);
  return ctx.__data;
}

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const csv = (headers, rows) => [headers, ...rows]
  .map((row) => row.map(csvCell).join(','))
  .join('\n') + '\n';

const lineups = readItems('lineups.json');
const editions = readItems('editions.json');
const { ARTISTS: artists, FESTIVALS: festivals } = loadDataJs();
const editionIds = new Set(editions.map((ed) => String(ed.EDITION_ID || '')));
const artistIds = new Set(artists.map((artist) => String(artist.id || '')));
const editionToFestival = new Map(editions.map((edition) => [edition.EDITION_ID, edition.FESTIVAL_ID]));
const festivalsWithLineups = new Set(lineups.map((row) => editionToFestival.get(row.EDITION_ID)).filter(Boolean));
const legacyArtistIds = (row) => String(row.ARTIST_IDS || row.ARTIST_ID || '')
  .split(',').map((id) => id.trim()).filter(Boolean);
const isComposite = (row) => {
  const ids = legacyArtistIds(row);
  return ids.length > 1 || !!String(row.JOIN_TYPE || '').trim() ||
    String(row.SET_TYPE || '').trim().toLowerCase() === 'b2b' ||
    (!ids.length && /\s&\s/.test(String(row.ACT_LABEL || '')));
};
const normalizeName = (value) => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\blive\b/g, '').replace(/[^a-z0-9]+/g, '');
const artistsByNormalizedName = new Map();
for (const artist of artists) {
  for (const value of [artist.id, artist.name, artist.name_en]) {
    if (!value) continue;
    const key = normalizeName(value);
    if (!artistsByNormalizedName.has(key)) artistsByNormalizedName.set(key, new Map());
    artistsByNormalizedName.get(key).set(artist.id, artist);
  }
}

const copyRows = [];
const reviewRows = [];

for (const row of lineups) {
  const oldArtistId = String(row.ARTIST_ID || '').trim();
  const oldSetType = String(row.SET_TYPE || '').trim().toLowerCase();
  let joinType = '';
  let perfType = '';

  if (oldSetType === 'dj' || oldSetType === 'live' || oldSetType === 'hybrid') {
    perfType = oldSetType;
  } else if (oldSetType === 'b2b') {
    joinType = 'b2b';
    reviewRows.push([
      row.EDITION_ID, row.SORT, row.ACT_LABEL, oldArtistId,
      'COMPOSITE_SLOT_REQUIRES_ARTIST_IDS',
      '参加者ごとのIDとPERF_TYPEを手入力。ACT_LABELは分割しない',
    ]);
  } else {
    reviewRows.push([
      row.EDITION_ID, row.SORT, row.ACT_LABEL, oldArtistId,
      'UNKNOWN_SET_TYPE',
      `SET_TYPE=${row.SET_TYPE || '(blank)'} を確認`,
    ]);
  }

  if (!editionIds.has(String(row.EDITION_ID || ''))) {
    reviewRows.push([row.EDITION_ID, row.SORT, row.ACT_LABEL, oldArtistId, 'ORPHAN_EDITION_ID', 'EDITIONSに存在しない']);
  }
  if (oldArtistId && (!ID_RE.test(oldArtistId) || !artistIds.has(oldArtistId))) {
    reviewRows.push([row.EDITION_ID, row.SORT, row.ACT_LABEL, oldArtistId, 'INVALID_OR_ORPHAN_ARTIST_ID', 'ARTISTSのslugを確認']);
  }
  if (!oldArtistId && row.ACT_LABEL && oldSetType !== 'b2b') {
    reviewRows.push([row.EDITION_ID, row.SORT, row.ACT_LABEL, '', 'ACT_LABEL_ONLY', 'ARTIST_IDSを手入力するか未解決枠として確認']);
  }
  if (/\blive\b/i.test(String(row.ACT_LABEL || '')) && perfType !== 'live') {
    reviewRows.push([row.EDITION_ID, row.SORT, row.ACT_LABEL, oldArtistId, 'LIVE_LABEL_TYPE_MISMATCH', 'PERF_TYPE=live を確認']);
  }

  copyRows.push([
    row.EDITION_ID, oldArtistId, joinType, perfType, row.ACT_LABEL || '',
    row.STAGE || '', row.DAY || '', row.START || '', row.END || '', row.SORT || '',
  ]);
}

// SCHEMA_TYPEは名前から推測しない。全アーティストを確認対象として出し、
// person / music-group の判断はスプレッドシート側で行う。
const schemaRows = artists.map((artist) => [
  artist.id || '', artist.name || '', artist.schemaType || artist.schema_type || artist.SCHEMA_TYPE || '',
  artist.memberIds || artist.member_ids || artist.MEMBER_IDS || '',
  'person または music-group を設定（空欄時の表示既定はperson）',
]);

// 複合枠を除くACT_LABEL-only行だけを、スプレッドシート手入力用に出す。
// 名称一致は候補の提示だけで、自動適用しない。
const backfillRows = lineups
  .filter((row) => !legacyArtistIds(row).length && row.ACT_LABEL && !isComposite(row))
  .map((row) => {
    const candidates = [...(artistsByNormalizedName.get(normalizeName(row.ACT_LABEL)) || new Map()).values()];
    const candidate = candidates.length === 1 ? candidates[0] : null;
    return [
      row.EDITION_ID, row.SORT, row.ACT_LABEL, row.SET_TYPE || '',
      candidate?.id || '', candidate?.name || '', candidate ? 'NAME_MATCH_CANDIDATE' : 'ARTIST_ID_REQUIRED',
    ];
  });

// 旧data.jsにラインナップがあるのにLINEUPSへ未移行のフェスを自動検出する。
// 旧データにも詳細がない要確認フェスは --missing-festivals=id1,id2 でレポートへ追加できる。
const requestedMissingIds = new Set(process.argv.slice(2)
  .filter((arg) => arg.startsWith('--missing-festivals='))
  .flatMap((arg) => arg.slice('--missing-festivals='.length).split(','))
  .map((id) => id.trim()).filter(Boolean));
const missingFestivalIds = new Set([
  ...festivals.filter((festival) => Array.isArray(festival.lineup) && festival.lineup.length && !festivalsWithLineups.has(festival.id)).map((festival) => festival.id),
  ...requestedMissingIds,
]);
const missingFestivalRows = [...missingFestivalIds].flatMap((festivalId) => {
  const festival = festivals.find((item) => item.id === festivalId);
  if (!festival) return [[festivalId, '', '', 'FESTIVAL_ID_NOT_FOUND']];
  const legacyLineup = Array.isArray(festival.lineup) ? festival.lineup : [];
  if (!legacyLineup.length) return [[festival.id, festival.name || '', '', 'FULL_LINEUP_REGISTRATION_REQUIRED']];
  return legacyLineup.map((actLabel) => [festival.id, festival.name || '', actLabel, 'LINEUP_ROW_REGISTRATION_REQUIRED']);
});

fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.writeFileSync(path.join(REPORT_DIR, 'lineups-column-copy.csv'), csv([
  'EDITION_ID', 'ARTIST_IDS', 'JOIN_TYPE', 'PERF_TYPE', 'ACT_LABEL',
  'STAGE', 'DAY', 'START', 'END', 'SORT',
], copyRows));
fs.writeFileSync(path.join(REPORT_DIR, 'lineups-migration-review.csv'), csv([
  'EDITION_ID', 'SORT', 'ACT_LABEL', 'OLD_ARTIST_ID', 'ISSUE', 'ACTION',
], reviewRows));
fs.writeFileSync(path.join(REPORT_DIR, 'artists-schema-type-review.csv'), csv([
  'ARTIST_ID', 'NAME', 'CURRENT_SCHEMA_TYPE', 'MEMBER_IDS', 'ACTION',
], schemaRows));
fs.writeFileSync(path.join(REPORT_DIR, 'lineups-artist-id-backfill.csv'), csv([
  'EDITION_ID', 'SORT', 'ACT_LABEL', 'CURRENT_SET_TYPE',
  'CANDIDATE_ARTIST_ID', 'CANDIDATE_ARTIST_NAME', 'STATUS',
], backfillRows));
fs.writeFileSync(path.join(REPORT_DIR, 'lineups-missing-festivals.csv'), csv([
  'FESTIVAL_ID', 'FESTIVAL_NAME', 'LEGACY_ACT_LABEL', 'STATUS',
], missingFestivalRows));

console.log(`LINEUPS: ${lineups.length} rows`);
console.log(`  safe column-copy proposals: ${copyRows.length}`);
console.log(`  review issues: ${reviewRows.length}`);
console.log(`ARTISTS schema review: ${schemaRows.length} rows`);
console.log(`ARTIST_ID backfill: ${backfillRows.length} rows (${backfillRows.filter((row) => row[4]).length} name-match candidates)`);
console.log(`Missing festival lineups: ${missingFestivalIds.size} festivals / ${missingFestivalRows.length} review rows`);
console.log(`Reports: ${path.relative(ROOT, REPORT_DIR)}/`);
