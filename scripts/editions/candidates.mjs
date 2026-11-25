#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

function parseArgs(argv) {
  const out = { today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()), days: 30, limit: null, all: false, data: path.join(ROOT, 'LP', 'data.js') };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') out.all = true;
    else if (arg === '--today') out.today = argv[++i];
    else if (arg === '--days') out.days = Number(argv[++i]);
    else if (arg === '--limit') out.limit = Number(argv[++i]);
    else if (arg === '--data') out.data = path.resolve(argv[++i]);
    else throw new Error(`unknown option: ${arg}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.today) || !Number.isFinite(out.days)) throw new Error('today/days is invalid');
  return out;
}

export function loadFestivals(dataPath) {
  const source = fs.readFileSync(dataPath, 'utf8');
  const context = vm.createContext({ console });
  new vm.Script(`${source}\n;globalThis.__festivals = FESTIVALS;`, { filename: dataPath }).runInContext(context);
  return context.__festivals || [];
}

function datePart(value) { return String(value ?? '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || ''; }
function latestEdition(festival) {
  const dates = [];
  const editions = Array.isArray(festival.editions) ? festival.editions : [];
  for (const edition of editions) {
    const date = datePart(edition.date);
    if (!date) return null;
    dates.push({ editionKey: String(edition.editionKey ?? edition.year ?? edition.edition ?? ''), date });
  }
  if (festival.date !== undefined && festival.date !== null && !datePart(festival.date)) return null;
  const festivalDate = datePart(festival.date);
  if (festivalDate) dates.push({ editionKey: String(festival.editionKey ?? festival.year ?? ''), date: festivalDate });
  return dates.sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
}
function isDomestic(festival) { const country = String(festival.country ?? '').trim().toUpperCase(); return !country || country === 'JP' || country === 'JAPAN'; }

export function findCandidates(festivals, { today, days = 30, checked = {}, all = false, limit = null } = {}) {
  const cutoff = new Date(`${today}T00:00:00+09:00`).getTime() - days * 86400000;
  const result = festivals.filter((festival) => {
    if (!festival?.id || !isDomestic(festival)) return false;
    const latest = latestEdition(festival);
    if (!latest || latest.date >= today) return false;
    const record = checked[festival.id];
    return all || !record?.checked_at || Date.parse(record.checked_at) < cutoff;
  }).map((festival) => {
    const latest = latestEdition(festival); const links = festival.links || {};
    return { id:String(festival.id), name:festival.name || '', url:festival.url || `/festivals/${festival.id}.html`, instagram:festival.instagram || links.instagram || '', ticketUrl:festival.ticketUrl || festival.ticketurl || '', latest, checked:checked[festival.id] || null };
  }).sort((a, b) => a.latest.date.localeCompare(b.latest.date) || a.id.localeCompare(b.id));
  return limit == null ? result : result.slice(0, limit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const checkedPath = path.join(ROOT, 'data/edition-crawl/checked.json');
  const checked = fs.existsSync(checkedPath) ? JSON.parse(fs.readFileSync(checkedPath, 'utf8')) : {};
  process.stdout.write(`${JSON.stringify(findCandidates(loadFestivals(options.data), { ...options, checked }), null, 2)}\n`);
}
