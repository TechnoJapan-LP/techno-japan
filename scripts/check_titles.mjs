#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
const year = Number(today.slice(0, 4));
const context = {};
vm.createContext(context);
new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + '\n;globalThis.__data={FESTIVALS};').runInContext(context);
const editions = JSON.parse(fs.readFileSync(path.join(LP, 'data', 'editions.json'), 'utf8')).items || [];
const byFestival = new Map();
for (const ed of editions) {
  const id = String(ed.FESTIVAL_ID || '');
  if (!byFestival.has(id)) byFestival.set(id, []);
  byFestival.get(id).push(ed);
}
const latest = (rows) => [...rows].sort((a, b) => String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')))[0];
const ended = new Set((context.__data.FESTIVALS || []).filter((f) => {
  const rows = byFestival.get(String(f.id)) || [];
  const last = latest(rows);
  return last && String(last.DATE_END || '') < today && !rows.some((e) => String(e.DATE_START || '') >= today);
}).map((f) => String(f.id)));

const offenders = [];
const checkDir = (dir, max, lang) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.html'))) {
    const rel = path.relative(LP, path.join(dir, file));
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '')
      .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (title.length > max) offenders.push(`${rel}: ${title.length} > ${max} — ${title}`);
    if (lang === 'ja' && rel.startsWith('festivals/')) {
      const id = file.slice(0, -5);
      if (ended.has(id) && new RegExp(`\\b(?:19|20)\\d{2}\\b`).test(title) && !title.includes(String(year))) {
        offenders.push(`${rel}: ended title contains a past year — ${title}`);
      }
    }
  }
};
checkDir(path.join(LP, 'articles'), 60, 'ja');
checkDir(path.join(LP, 'festivals'), 60, 'ja');
checkDir(path.join(LP, 'artists'), 60, 'ja');
checkDir(path.join(LP, 'venues'), 60, 'ja');
checkDir(path.join(LP, 'en', 'articles'), 65, 'en');
checkDir(path.join(LP, 'en', 'festivals'), 65, 'en');
checkDir(path.join(LP, 'en', 'artists'), 65, 'en');
checkDir(path.join(LP, 'en', 'venues'), 65, 'en');
if (offenders.length) {
  console.error(`❌ title offenders: ${offenders.length}`);
  offenders.forEach((x) => console.error(`  ${x}`));
  process.exit(1);
}
console.log('✅ all indexable JA titles <= 60 and EN titles <= 65');
