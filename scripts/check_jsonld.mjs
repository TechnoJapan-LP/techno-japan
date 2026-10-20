#!/usr/bin/env node
/**
 * 構造化データ（JSON-LD）と AI 向けファイルが壊れていないか。
 *
 * ■ なぜ必要か（AUDIT §9-79）
 *
 *   構造化データは**人間の目に映らない。**壊れても・消えても、
 *   ページの見た目は1ピクセルも変わらない。気づくのは数週間後、
 *   検索やAIからの流入が減ってから。
 *
 *   実際、出演者（performer）は生成コードが8/1からあったのに、
 *   LINEUPS の501行（81%）が名前だけの行で解決に失敗し、
 *   **ほとんどのフェスで出演者が構造化データから消えていた。**
 *   誰も気づかなかった（診断で実測するまで6週間）。
 *
 * ■ 何を見るか
 *
 *   1. 全ページの ld+json が**パースできる**こと（壊れたJSONは無言で無視される）
 *   2. どのブロックにも @type があること
 *   3. **出演者データがあるフェスのページには performer が出ている**こと
 *      （lineups.json と突き合わせる。これが §9-79 の本命）
 *   4. 開催回（subEvent）に eventStatus が出ていること
 *   5. events.json がパースでき、全件に name / url / start があること
 *   6. llms.txt が存在し、events.json への案内を含むこと
 *
 * 使い方:
 *   node scripts/check_jsonld.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { contentHash, contentRow } from './lib/content-dates.mjs';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

let failed = 0;
const problems = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

/** ページから ld+json ブロックを全部取り出す。 */
function blocksOf(file) {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(f);
    else if (e.name.endsWith('.html')) yield f;
  }
}

function jsonLdObjects(file) {
  return blocksOf(file).flatMap((b) => {
    try {
      const value = JSON.parse(b);
      return Array.isArray(value) ? value : [value];
    } catch { return []; }
  });
}

function loadPublishedArticles() {
  const context = {};
  vm.createContext(context);
  new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + '\n;globalThis.__articles = ARTICLES;').runInContext(context);
  return (context.__articles || []).filter((a) => a && a.id && a.status !== 'draft');
}

function loadPublishedFestivals() {
  const context = {};
  vm.createContext(context);
  new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + '\n;globalThis.__festivals = FESTIVALS;').runInContext(context);
  return (context.__festivals || []).filter((f) => f && f.id && String(f.status || '').toLowerCase() !== 'draft');
}
function loadPublishedEntities(name) {
  const context = {};
  vm.createContext(context);
  new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + `\n;globalThis.__items = ${name};`).runInContext(context);
  return (context.__items || []).filter((x) => x && x.id && String(x.status || '').toLowerCase() !== 'draft');
}

function editionKeyParts(value) {
  const m = String(value || '').trim().match(/^(\d{4})(?:-(\d+))?$/);
  return m ? { year: Number(m[1]), seq: m[2] ? Number(m[2]) : 1 } : { year: 0, seq: 0 };
}

function editionIdentifier(ed) {
  return ed?.EDITION || ed?.editionKey || (ed?.EDITION_ID ? '' : ed?.year) || '';
}

function expectedFestivalTicketUrl(festival, editions) {
  const sorted = editions.filter((ed) => String(ed.FESTIVAL_ID) === String(festival.id)).sort((a, b) => {
    const ap = editionKeyParts(editionIdentifier(a));
    const bp = editionKeyParts(editionIdentifier(b));
    return bp.year - ap.year || bp.seq - ap.seq || String(b.DATE_START || '').localeCompare(String(a.DATE_START || ''));
  });
  return String(sorted[0]?.TICKETURL || festival.ticketUrl || festival.ticket_url || festival.tickets || '').trim();
}

function localPathFromSiteUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.origin !== 'https://techno-japan.media') return null;
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname.endsWith('/')) pathname += 'index.html';
  if (!pathname.startsWith('/') || pathname.includes('..')) return null;
  return path.join(LP, pathname.slice(1));
}

function loadData() {
  const context = {}; vm.createContext(context);
  new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + '\n;globalThis.__data = { ARTISTS, FESTIVALS, VENUES };').runInContext(context);
  return context.__data;
}

/* --- 1〜2) 全ページのパースと @type --- */
let pages = 0, blocks = 0;
const parseErrors = [];
const noType = [];
for (const f of htmlFiles(LP)) {
  const rel = path.relative(LP, f);
  if (rel.startsWith('vendor') || rel === 'cms.html') continue;
  const bs = blocksOf(f);
  if (!bs.length) continue;
  pages++;
  for (const b of bs) {
    blocks++;
    let d;
    try { d = JSON.parse(b); } catch (e) { parseErrors.push(rel); continue; }
    for (const x of Array.isArray(d) ? d : [d]) {
      if (!x['@type']) noType.push(rel);
    }
  }
}
console.log(`対象: ${pages}ページ / ${blocks}ブロック\n`);
check('全ブロックが JSON としてパースできる', parseErrors.length === 0,
  parseErrors.slice(0, 3).join(', '));
check('全ブロックに @type がある', noType.length === 0, noType.slice(0, 3).join(', '));

/* --- NewsMediaOrganization / NewsArticle 差分 --- */
const ORG_ID = 'https://techno-japan.media/#org';
const orgPages = ['index.html', 'about.html', 'en/index.html', 'en/about.html'];
for (const rel of orgPages) {
  const file = path.join(LP, rel);
  const org = jsonLdObjects(file).find((x) => x['@type'] === 'NewsMediaOrganization');
  check(`${rel} に NewsMediaOrganization がある`, !!org);
  if (org) {
    check(`${rel} の組織 @id が #org`, org['@id'] === ORG_ID, String(org['@id'] || ''));
    check(`${rel} のロゴ寸法が実測値`, org.logo?.width === 512 && org.logo?.height === 512,
      JSON.stringify(org.logo || {}));
  }
}

const publishedArticles = loadPublishedArticles();
const articleLdByLang = new Map();
for (const article of publishedArticles) {
  const id = String(article.id);
  for (const [lang, rel] of [['ja', `articles/${id}.html`], ['en', `en/articles/${id}.html`]]) {
    const file = path.join(LP, rel);
    const ld = jsonLdObjects(file).find((x) => x['@type'] === 'NewsArticle');
    check(`${rel} がNewsArticleを持つ`, !!ld);
    if (!ld) continue;
    if (!articleLdByLang.has(lang)) articleLdByLang.set(lang, new Map());
    articleLdByLang.get(lang).set(id, ld);
    check(`${rel} のpublisherが#org`, ld.publisher?.['@id'] === ORG_ID,
      JSON.stringify(ld.publisher || {}));
    check(`${rel} の記事SEO差分4点`, ld.isAccessibleForFree === true
      && Number.isInteger(ld.wordCount) && ld.wordCount > 0
      && typeof ld.thumbnailUrl === 'string' && ld.thumbnailUrl.startsWith('https://'),
      JSON.stringify({ isAccessibleForFree: ld.isAccessibleForFree, wordCount: ld.wordCount, thumbnailUrl: ld.thumbnailUrl }));
    const imageFiles = Array.isArray(ld.image) ? ld.image.map((url) => localPathFromSiteUrl(url)) : [];
    check(`${rel} のimageが16:9・1:1・4:3の3件で実在する`, imageFiles.length === 3 && imageFiles.every((file) => file && fs.existsSync(file)),
      JSON.stringify(ld.image || []));
    if (article.festivalId) {
      const aboutId = ld.about?.[0]?.['@id'];
      const aboutFile = aboutId ? localPathFromSiteUrl(aboutId.replace(/#festival$/, '')) : null;
      check(`${rel} のabout参照先が実在する`, !!aboutId && !!aboutFile && fs.existsSync(aboutFile), aboutId || 'aboutなし');
    }
  }
}
const jaArticles = articleLdByLang.get('ja') || new Map();
const enArticles = articleLdByLang.get('en') || new Map();
for (const id of jaArticles.keys()) {
  const jaKeys = Object.keys(jaArticles.get(id)).sort().join('|');
  const enKeys = Object.keys(enArticles.get(id) || {}).sort().join('|');
  check(`記事${id}のJA/EN JSON-LDキー構成が一致`, jaKeys === enKeys, `${jaKeys} / ${enKeys}`);
}

/* --- 3) 出演データのあるフェスに performer が出ているか --- */
const lineups = JSON.parse(fs.readFileSync(path.join(LP, 'data', 'lineups.json'), 'utf8')).items;
const withLineup = new Set(
  lineups.filter((l) => String(l.ACT_LABEL || l.ARTIST_ID || '').trim())
    .map((l) => String(l.EDITION_ID || '').replace(/-\d{4}$/, ''))
);
const missingPerformer = [];
let checkedFests = 0;
for (const fid of withLineup) {
  const f = path.join(LP, 'festivals', `${fid}.html`);
  if (!fs.existsSync(f)) continue;   // draft 等でページが無いのは別の検査の担当
  checkedFests++;
  const joined = blocksOf(f).join('');
  if (!joined.includes('"performer"')) missingPerformer.push(fid);
}
check(`出演データのあるフェス ${checkedFests}件すべてに performer が出る`,
  missingPerformer.length === 0, missingPerformer.slice(0, 5).join(', '));

/* --- 4) 親 Festival の offers --- */
const publishedFestivals = loadPublishedFestivals();
const editions = JSON.parse(fs.readFileSync(path.join(LP, 'data', 'editions.json'), 'utf8')).items;
const missingFestivalOffers = [];
const unexpectedFestivalOffers = [];
for (const festival of publishedFestivals) {
  const file = path.join(LP, 'festivals', `${festival.id}.html`);
  if (!fs.existsSync(file)) continue;
  const festivalLd = jsonLdObjects(file).find((x) => x['@type'] === 'Festival' && !x['@id']?.includes('#edition-'));
  const expectedUrl = expectedFestivalTicketUrl(festival, editions);
  const actualUrl = String(festivalLd?.offers?.url || '').trim();
  if (expectedUrl && actualUrl !== expectedUrl) missingFestivalOffers.push(`${festival.id}: ${expectedUrl}`);
  if (!expectedUrl && actualUrl) unexpectedFestivalOffers.push(`${festival.id}: ${actualUrl}`);
}
check('チケットURLがある公開フェスの親 Festival に offers.url がある', missingFestivalOffers.length === 0,
  missingFestivalOffers.slice(0, 5).join(', '));
check('チケットURLがない公開フェスの親 Festival に offers がない', unexpectedFestivalOffers.length === 0,
  unexpectedFestivalOffers.slice(0, 5).join(', '));

/* --- 5) 開催回に eventStatus --- */
const noStatus = [];
for (const fid of [...withLineup].slice(0, 200)) {
  const f = path.join(LP, 'festivals', `${fid}.html`);
  if (!fs.existsSync(f)) continue;
  for (const b of blocksOf(f)) {
    let d; try { d = JSON.parse(b); } catch { continue; }
    for (const x of Array.isArray(d) ? d : [d]) {
      for (const ev of x.subEvent || []) {
        if (!ev.eventStatus) noStatus.push(fid);
      }
    }
  }
}
check('開催回（subEvent）すべてに eventStatus が出る', noStatus.length === 0,
  [...new Set(noStatus)].slice(0, 5).join(', '));

/* --- 5b) GEO detail pages: visible FAQ, freshness, and entity relations --- */
const publishedArtists = loadPublishedEntities('ARTISTS');
const publishedVenues = loadPublishedEntities('VENUES').filter((v) => v.name && v.city && v.city !== 'undefined');
const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
const detailDates = new Set();
const badRelations = [];
const badFaq = [];
const badDates = [];
for (const [kind, entities] of [['artists', publishedArtists], ['venues', publishedVenues], ['festivals', publishedFestivals]]) {
  for (const entity of entities) {
    for (const rel of [kind === 'artists' ? `artists/${entity.id}.html` : kind === 'venues' ? `venues/${entity.id}.html` : `festivals/${entity.id}.html`, kind === 'artists' ? `en/artists/${entity.id}.html` : kind === 'venues' ? `en/venues/${entity.id}.html` : `en/festivals/${entity.id}.html`]) {
      const file = path.join(LP, rel);
      if (!fs.existsSync(file)) continue;
      const html = fs.readFileSync(file, 'utf8');
      const objects = jsonLdObjects(file);
      const main = objects.find((x) => x['@id'] && !String(x['@id']).includes('#edition-'));
      const date = String(main?.dateModified || '');
      if (date) { detailDates.add(date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayIso) badDates.push(`${rel}: dateModified=${date}`); }
      const faq = objects.find((x) => x['@type'] === 'FAQPage');
      const visible = (html.match(/<section class="detail-section festival-faq festival-faq-details">[\s\S]*?<\/section>/g) || []).join('').match(/<details>/g)?.length || 0;
      if (faq && (faq.mainEntity || []).length !== visible || faq && (faq.mainEntity || []).some((q) => !String(q.acceptedAnswer?.text || '').trim())) badFaq.push(`${rel}: FAQPage=${faq.mainEntity?.length || 0}, visible=${visible}`);
      for (const relation of [...(main?.performerIn || []), ...(main?.event || [])]) {
        const target = localPathFromSiteUrl(String(relation['@id'] || '').replace(/#festival$/, ''));
        if (!target || !fs.existsSync(target)) badRelations.push(`${rel}: ${relation['@id'] || ''}`);
      }
    }
  }
}
check('会場・アーティスト・フェス詳細のFAQPageと見えるFAQの質問数が一致し、回答が空でない', badFaq.length === 0, badFaq.slice(0, 5).join(', '));
check('dateModifiedがISO日付で未来でない', badDates.length === 0, badDates.slice(0, 3).join(', '));
check('詳細ページのdateModifiedが全ページ同一ではない', detailDates.size > 1, [...detailDates].join(', '));
check('performerIn / event のフェス @id が実在する', badRelations.length === 0, badRelations.slice(0, 5).join(', '));

/* --- 5c) content-dates ledger --- */
const datesPath = path.join(LP, 'data', 'content-dates.json');
let ledger = null;
try { ledger = JSON.parse(fs.readFileSync(datesPath, 'utf8')); } catch { ledger = null; }
check('content-dates.json がある', !!ledger && !Array.isArray(ledger));
if (ledger) {
  const data = loadData();
  const editionByFestival = new Map();
  for (const ed of editions) {
    const key = String(ed.FESTIVAL_ID);
    if (!editionByFestival.has(key)) editionByFestival.set(key, []);
    editionByFestival.get(key).push(ed);
  }
  const lineupsByEdition = new Map();
  for (const row of lineups) {
    const key = String(row.EDITION_ID || '');
    if (!lineupsByEdition.has(key)) lineupsByEdition.set(key, []);
    lineupsByEdition.get(key).push(row);
  }
  const snapshots = new Map();
  const isComposite = (row) => {
    const ids = String(row.ARTIST_IDS || row.ARTIST_ID || '').split(',').map((x) => x.trim()).filter(Boolean);
    return ids.length > 1 || row.JOIN_TYPE || String(row.SET_TYPE || '').toLowerCase() === 'b2b' || (!ids.length && /\s&\s/.test(String(row.ACT_LABEL || '')));
  };
  const artistsById = new Map(publishedArtists.map((x) => [String(x.id), x]));
  const artistRows = new Map();
  for (const row of lineups) {
    if (isComposite(row)) continue;
    const id = String(row.ARTIST_IDS || row.ARTIST_ID || '').split(',')[0].trim();
    const ed = editions.find((x) => String(x.EDITION_ID) === String(row.EDITION_ID));
    if (!id || !ed || !artistsById.has(id)) continue;
    const list = artistRows.get(id) || [];
    if (list.some((x) => x.edition.EDITION_ID === ed.EDITION_ID)) continue;
    list.push({ festivalId: ed.FESTIVAL_ID, edition: { EDITION_ID: ed.EDITION_ID, DATE_START: ed.DATE_START, DATE_END: ed.DATE_END, LOCATION: ed.LOCATION, LOCATION_JA: ed.LOCATION_JA, ADDRESS: ed.ADDRESS } });
    artistRows.set(id, list);
  }
  for (const artist of publishedArtists) snapshots.set(`artist:${artist.id}`, { artist: contentRow(artist), appearances: (artistRows.get(String(artist.id)) || []).sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID))) });
  const venueDistance = (a, b) => {
    const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
    const r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  for (const venue of publishedVenues) {
    const name = String(venue.name || '').trim().toLowerCase();
    const upcoming = [];
    for (const festival of publishedFestivals) for (const ed of editionByFestival.get(String(festival.id)) || []) {
      const text = [ed.LOCATION, ed.LOCATION_JA, ed.ADDRESS].some((x) => name && String(x || '').toLowerCase().includes(name));
      const near = venue.lat && venue.lng && ed.LAT && ed.LNG && venueDistance(venue, { lat: ed.LAT, lng: ed.LNG }) <= 0.15;
      const end = String(ed.DATE_END || ed.DATE_START || '');
      if ((text || near) && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end >= today)) upcoming.push({ festivalId: festival.id, edition: contentRow(ed) });
    }
    upcoming.sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID)));
    snapshots.set(`venue:${venue.id}`, { venue: contentRow(venue), upcoming });
  }
  for (const festival of publishedFestivals) snapshots.set(`festival:${festival.id}`, { festival: contentRow(festival), editions: (editionByFestival.get(String(festival.id)) || []).map((ed) => ({ edition: contentRow(ed), lineups: (lineupsByEdition.get(ed.EDITION_ID) || []).map(contentRow) })) });
  const expectedKeys = new Set([...snapshots.keys()]);
  const badLedger = [];
  for (const key of expectedKeys) {
    const entry = ledger[key];
    if (!entry || typeof entry.hash !== 'string' || !Object.prototype.hasOwnProperty.call(entry, 'date')) { badLedger.push(`${key}: missing hash/date`); continue; }
    if (entry.date && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || entry.date > today)) badLedger.push(`${key}: invalid date ${entry.date}`);
    if (entry.hash !== contentHash(snapshots.get(key))) badLedger.push(`${key}: hash mismatch`);
  }
  const unexpectedKeys = Object.keys(ledger).filter((key) => !expectedKeys.has(key));
  check(`content-dates.json の${expectedKeys.size}キーにhash/dateがあり現在データと一致`, badLedger.length === 0, badLedger.slice(0, 5).join(', '));
  check('content-dates.json に不要なキーがない', unexpectedKeys.length === 0, unexpectedKeys.slice(0, 5).join(', '));
}

/* --- 6) events.json --- */
const evPath = path.join(LP, 'events.json');
if (!fs.existsSync(evPath)) {
  check('events.json がある', false);
} else {
  let ev;
  try { ev = JSON.parse(fs.readFileSync(evPath, 'utf8')); } catch (e) { ev = null; }
  check('events.json がパースできる', !!ev);
  if (ev) {
    const bad = (ev.events || []).filter((e) => !e.name || !e.url || !/^\d{4}-\d{2}-\d{2}$/.test(e.start || ''));
    check(`events.json の全${(ev.events || []).length}件に name / url / start(ISO) がある`,
      bad.length === 0, JSON.stringify(bad[0] || {}).slice(0, 80));
    check('events.json にタイムスタンプを埋めていない（毎日の差分ノイズ防止）',
      !JSON.stringify(ev).includes('generatedAt'));
  }
}

/* --- 7) llms.txt --- */
const llmsPath = path.join(LP, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  check('llms.txt がある', false);
} else {
  const t = fs.readFileSync(llmsPath, 'utf8');
  check('llms.txt がサイト名で始まる', t.startsWith('# TECHNO JAPAN'));
  check('llms.txt が events.json を案内している', t.includes('/events.json'));
  check('llms.txt が sitemap を案内している', t.includes('/sitemap.xml'));
  const links = [...t.matchAll(/\]\((https:\/\/techno-japan\.media\/[^)]+)\)/g)].map((m) => m[1]);
  const missingLinks = links.filter((url) => {
    const file = localPathFromSiteUrl(url);
    return !file || !fs.existsSync(file);
  });
  const articleLinks = links.filter((url) => /^https:\/\/techno-japan\.media\/articles\/[^/]+\.html$/.test(url));
  check(`llms.txt の全${links.length}リンク先が実在する`, missingLinks.length === 0, missingLinks.slice(0, 3).join(', '));
  check('llms.txt に記事リンクが1本以上ある', articleLinks.length > 0);
  check(`llms.txt の記事件数がARTICLESと一致する（上限20）`, articleLinks.length === Math.min(publishedArticles.length, 20),
    `${articleLinks.length} / ${Math.min(publishedArticles.length, 20)}`);
}

/* --- robots.txt が地図を隠していないこと（§9-79 で解除した） --- */
const robots = fs.readFileSync(path.join(LP, 'robots.txt'), 'utf8');
check('robots.txt が map.html を隠していない', !/Disallow:\s*\/map\.html/.test(robots));
check('robots.txt は cms.html を隠したまま', /Disallow:\s*\/cms\.html/.test(robots));

console.log();
if (failed) { console.log(`❌ ${failed}件の問題があります`); process.exit(1); }
console.log('✅ 構造化データと AI 向けファイルは健全');
