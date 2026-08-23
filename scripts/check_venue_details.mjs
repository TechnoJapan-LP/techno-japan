#!/usr/bin/env node
/* VENUES §6-3: 詳細ページのJSON-LD / INFORMATION / 回遊回帰検査 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.join(process.cwd(), 'LP');
const dataSource = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
const context = {};
vm.createContext(context);
new vm.Script(`${dataSource}\n;globalThis.__out={VENUES};`).runInContext(context);
const venues = context.__out.VENUES.filter(v => v.name && v.city && v.city !== 'undefined');
const practical = new Set(['cash-only','cashless-only','id-required','no-photo','smoking','no-reentry']);
const failures = [];
let nearbyCount = 0;

for (const lang of ['ja', 'en']) {
  for (const venue of venues) {
    const file = path.join(root, lang === 'en' ? 'en' : '', 'venues', `${venue.id}.html`);
    if (!fs.existsSync(file)) { failures.push(`${lang}/${venue.id}: 詳細ページが無い`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    if (html.includes('undefined')) failures.push(`${lang}/${venue.id}: undefinedが残っている`);
    const jsonText = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    let json;
    try { json = JSON.parse(jsonText); } catch { failures.push(`${lang}/${venue.id}: JSON-LDを解析できない`); continue; }
    const ld = json.find(item => item['@type']);
    const expected = venue.type === 'bar' ? ['BarOrPub','MusicVenue'] : venue.type === 'club' ? ['NightClub','MusicVenue'] : 'MusicVenue';
    if (JSON.stringify(ld?.['@type']) !== JSON.stringify(expected)) failures.push(`${lang}/${venue.id}: JSON-LD typeが不一致`);
    const hours = String(venue.hours || '').trim();
    const charge = String(venue.charge || '').trim();
    if (hours && !html.includes(`<dt>HOURS</dt><dd>${hours}</dd>`)) failures.push(`${lang}/${venue.id}: HOURSがINFORMATIONに無い`);
    if (charge && !html.includes(`<dt>CHARGE</dt><dd>${charge}</dd>`)) failures.push(`${lang}/${venue.id}: CHARGEがINFORMATIONに無い`);
    if (!hours && html.includes('<dt>HOURS</dt>')) failures.push(`${lang}/${venue.id}: 空のHOURS行がある`);
    if (!charge && html.includes('<dt>CHARGE</dt>')) failures.push(`${lang}/${venue.id}: 空のCHARGE行がある`);
    const features = (Array.isArray(venue.features) ? venue.features : String(venue.features || '').split(/[;,]/)).map(x => String(x).trim());
    const hasPractical = features.some(x => practical.has(x));
    if (hasPractical && !html.includes('GOOD TO KNOW')) failures.push(`${lang}/${venue.id}: GOOD TO KNOWが無い`);
    const nearby = html.match(/<h2>(?:近くの会場|NEARBY VENUES)<\/h2><div class="lineup-list">([\s\S]*?)<\/div>/);
    const count = nearby ? (nearby[1].match(/class="lineup-item"/g) || []).length : 0;
    if (count > 4) failures.push(`${lang}/${venue.id}: 近隣会場が${count}件`);
    if (lang === 'ja') nearbyCount += count;
  }
}
if (!nearbyCount) failures.push('近隣会場ブロックが1件も生成されていない');
if (failures.length) { console.log('VENUES詳細ページに問題があります:'); failures.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log(`  ✅ JSON-LD / INFORMATION / GOOD TO KNOW / 近隣4件上限（${venues.length}件 × JA/EN）`);
