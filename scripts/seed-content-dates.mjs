#!/usr/bin/env node
/*
 * content-dates.json の一度きりの種まき。
 * 生成HTMLやsitemapではなく、データファイルの各コミットを古い順に再生し、
 * ページデータのhashが変わった最後の日を初期dateにする。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { contentHash, contentRow } from './lib/content-dates.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'LP', 'data', 'content-dates.json');
const DATA_PATHS = ['LP/data.js', 'LP/data/editions.json', 'LP/data/lineups.json'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TODAY_JST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());

function git(args) { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function atCommit(hash, file) {
  try { return git(['show', `${hash}:${file}`]); } catch { return null; }
}
function loadDataJs(source) {
  const context = {}; vm.createContext(context);
  try {
    new vm.Script(source + '\n;globalThis.__data = { ARTISTS, FESTIVALS, VENUES };').runInContext(context);
    return context.__data;
  } catch { return null; }
}
function loadItems(source) {
  try { return JSON.parse(source).items || []; } catch { return null; }
}
function isPublishedFestival(f) { return f && f.id && String(f.status || '').toLowerCase() !== 'draft'; }
function isComposite(row) {
  const value = row.ARTIST_IDS || row.ARTIST_ID || [];
  const ids = (Array.isArray(value) ? value : String(value).split(',')).map((x) => String(x).trim()).filter(Boolean);
  return ids.length > 1 || !!String(row.JOIN_TYPE || '').trim() || String(row.SET_TYPE || '').toLowerCase() === 'b2b' || (!ids.length && /\s&\s/.test(String(row.ACT_LABEL || '')));
}
function distance(a, b) {
  const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function snapshots(data, editions, lineups, asOfDate) {
  const valid = (x) => x && x.id && String(x.id).trim();
  const fests = (data.FESTIVALS || []).filter(valid);
  const artists = (data.ARTISTS || []).filter(valid);
  const venues = (data.VENUES || []).filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined');
  const byFestival = new Map();
  for (const ed of editions) { if (!byFestival.has(String(ed.FESTIVAL_ID))) byFestival.set(String(ed.FESTIVAL_ID), []); byFestival.get(String(ed.FESTIVAL_ID)).push(ed); }
  const byEdition = new Map();
  for (const row of lineups) { if (!byEdition.has(String(row.EDITION_ID || ''))) byEdition.set(String(row.EDITION_ID || ''), []); byEdition.get(String(row.EDITION_ID || '')).push(row); }
  const out = new Map();
  const artistsById = new Map(artists.map((x) => [String(x.id), x]));
  const artistRows = new Map();
  for (const row of lineups) {
    if (isComposite(row)) continue;
    const value = row.ARTIST_IDS || row.ARTIST_ID || [];
    const id = (Array.isArray(value) ? value : String(value).split(','))[0]?.trim();
    const ed = editions.find((x) => String(x.EDITION_ID) === String(row.EDITION_ID));
    if (!id || !ed || !artistsById.has(id)) continue;
    const list = artistRows.get(id) || [];
    if (list.some((x) => x.edition.EDITION_ID === ed.EDITION_ID)) continue;
    list.push({ festivalId: ed.FESTIVAL_ID, edition: { EDITION_ID: ed.EDITION_ID, DATE_START: ed.DATE_START, DATE_END: ed.DATE_END, LOCATION: ed.LOCATION, LOCATION_JA: ed.LOCATION_JA, ADDRESS: ed.ADDRESS } });
    artistRows.set(id, list);
  }
  for (const artist of artists) out.set(`artist:${artist.id}`, { artist: contentRow(artist), appearances: (artistRows.get(String(artist.id)) || []).sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID))) });
  for (const venue of venues) {
    const name = String(venue.name || '').trim().toLowerCase();
    const upcoming = [];
    for (const festival of fests.filter(isPublishedFestival)) for (const ed of byFestival.get(String(festival.id)) || []) {
      const text = [ed.LOCATION, ed.LOCATION_JA, ed.ADDRESS].some((x) => name && String(x || '').toLowerCase().includes(name));
      const near = venue.lat && venue.lng && ed.LAT && ed.LNG && distance(venue, { lat: ed.LAT, lng: ed.LNG }) <= 0.15;
      const end = String(ed.DATE_END || ed.DATE_START || '');
      if ((text || near) && (!ISO.test(end) || end >= asOfDate)) upcoming.push({ festivalId: festival.id, edition: contentRow(ed) });
    }
    upcoming.sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID)));
    out.set(`venue:${venue.id}`, { venue: contentRow(venue), upcoming });
  }
  for (const festival of fests) out.set(`festival:${festival.id}`, { festival: contentRow(festival), editions: (byFestival.get(String(festival.id)) || []).map((ed) => ({ edition: contentRow(ed), lineups: (byEdition.get(ed.EDITION_ID) || []).map(contentRow) })) });
  return out;
}

const rows = git(['log', '--reverse', '--format=%H %cs', '--', ...DATA_PATHS]).trim().split('\n').filter(Boolean).map((line) => {
  const [hash, date] = line.split(/\s+/); return { hash, date };
});
const lastHashes = new Map();
const seeded = new Map();
let usable = 0;
for (const { hash, date } of rows) {
  const data = loadDataJs(atCommit(hash, 'LP/data.js'));
  const editions = loadItems(atCommit(hash, 'LP/data/editions.json'));
  const lineups = loadItems(atCommit(hash, 'LP/data/lineups.json'));
  if (!data || !editions || !lineups || !ISO.test(date)) continue;
  let current;
    try { current = snapshots(data, editions, lineups, date); } catch { continue; }
  usable++;
  for (const [key, value] of current) {
    const hashValue = contentHash(value);
    if (lastHashes.get(key) !== hashValue) { seeded.set(key, { hash: hashValue, date }); lastHashes.set(key, hashValue); }
  }
}

const currentData = loadDataJs(fs.readFileSync(path.join(ROOT, 'LP/data.js'), 'utf8'));
const currentEditions = JSON.parse(fs.readFileSync(path.join(ROOT, 'LP/data/editions.json'), 'utf8')).items;
const currentLineups = JSON.parse(fs.readFileSync(path.join(ROOT, 'LP/data/lineups.json'), 'utf8')).items;
const current = snapshots(currentData, currentEditions, currentLineups, TODAY_JST);
for (const [key, value] of current) {
  const hash = contentHash(value);
  if (!seeded.has(key) || seeded.get(key).hash !== hash) seeded.set(key, { hash, date: seeded.get(key)?.date || '' });
}
const output = Object.fromEntries([...current.keys()].sort().map((key) => [key, seeded.get(key)]));
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
const distribution = Object.values(output).reduce((map, item) => map.set(item.date || '(empty)', (map.get(item.date || '(empty)') || 0) + 1), new Map());
console.log(`content-dates.json: ${Object.keys(output).length} keys / ${usable} historical commits`);
console.log([...distribution.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([date, count]) => `${date}: ${count}`).join('\n'));
for (const key of ['venue:womb', 'artist:dj-kensei', 'festival:global-ark', 'artist:ken-ishii']) console.log(`${key}: ${JSON.stringify(output[key] || null)}`);
