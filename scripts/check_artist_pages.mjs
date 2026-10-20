#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { artistNameMatches, articleMatchesArtist } from './lib/artist-page-utils.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const stripTags = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const html = (file) => fs.readFileSync(file, 'utf8');
const dataContext = {};
vm.createContext(dataContext);
new vm.Script(fs.readFileSync(path.join(LP, 'data.js'), 'utf8') + '\n;globalThis.__artistCheck={ARTISTS};').runInContext(dataContext);
const artists = dataContext.__artistCheck.ARTISTS || [];
const sitemap = html(path.join(LP, 'sitemap.xml'));
const failures = [];
const hasSitemap = (prefix, id) => sitemap.includes(`https://techno-japan.media${prefix}/artists/${id}.html`);

for (const artist of artists) {
  const thin = !stripTags(artist.bio) && !stripTags(artist.bio_en);
  for (const [dir, prefix] of [['artists', ''], ['en/artists', '/en']]) {
    const file = path.join(LP, dir, `${artist.id}.html`);
    const page = html(file);
    const noindex = /<meta name="robots" content="noindex(?:,|\")/i.test(page);
    if (noindex !== thin) failures.push(`${dir}/${artist.id}: noindex=${noindex}, thin=${thin}`);
    if (hasSitemap(prefix, artist.id) === thin) failures.push(`${dir}/${artist.id}: sitemap membership mismatch`);
    if (!thin && !/<meta name="robots" content="max-image-preview:large">/.test(page)) {
      failures.push(`${dir}/${artist.id}: indexable robots marker missing`);
    }
  }
}

for (const id of ['ken-ishii', 'dj-nobu', 'powder']) {
  for (const dir of ['artists', 'en/artists']) {
    const page = html(path.join(LP, dir, `${id}.html`));
    if (/content="noindex(?:,|\")/i.test(page)) failures.push(`${dir}/${id}: must remain indexable`);
    if (!hasSitemap(dir === 'en/artists' ? '/en' : '', id)) failures.push(`${dir}/${id}: missing from sitemap`);
  }
}

const checkUpcomingOrder = (file) => {
  const page = html(file);
  const section = page.match(/<section class="artist-appearances artist-upcoming">([\s\S]*?)<\/section>/)?.[1];
  if (!section) return;
  const dates = [...section.matchAll(/<div class="related-card-date">([^<]*)<\/div>/g)].map((m) => m[1]).filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x));
  if (dates.some((date, index) => index && date < dates[index - 1])) failures.push(`${file}: upcoming cards are not date-sorted`);
};

const isRedirectStub = (page) => /<meta http-equiv="refresh"[^>]*url=/i.test(page);
for (const dir of ['artists', 'en/artists', 'venues', 'en/venues']) {
  const directory = path.join(LP, dir);
  for (const fileName of fs.readdirSync(directory).filter((name) => name.endsWith('.html'))) {
    const file = path.join(directory, fileName);
    const page = html(file);
    if (isRedirectStub(page)) continue;
    const backgroundCount = (page.match(/<div class="tj-bg"/g) || []).length;
    if (backgroundCount !== 1) failures.push(`${dir}/${fileName}: expected exactly one tj-bg, got ${backgroundCount}`);
  }
}

for (const dir of ['artists', 'en/artists']) {
  for (const file of fs.readdirSync(path.join(LP, dir)).filter((name) => name.endsWith('.html'))) {
    const page = html(path.join(LP, dir, file));
    const title = page.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
    const redirectStub = /<meta name="robots" content="noindex">/i.test(page);
    if (!redirectStub && title.includes('…')) failures.push(`${dir}/${file}: title contains an ellipsis`);
    checkUpcomingOrder(path.join(LP, dir, file));
    const upcoming = page.match(/<section class="artist-appearances artist-upcoming">([\s\S]*?)<\/section>/)?.[1];
    if (upcoming) {
      const cards = [...upcoming.matchAll(/<a class="related-card" href="([^"]+)">([\s\S]*?)<\/a>/g)];
      const cardKeys = cards.map((match) => `${match[1]}|${match[2].match(/<div class="related-card-date">([^<]*)<\/div>/)?.[1] || ''}`);
      if (new Set(cardKeys).size !== cardKeys.length) failures.push(`${dir}/${file}: duplicate upcoming festival card`);
    }
    if (page.includes('artist-past') && !/\b(?:19|20)\d{2}(?: #\d+)?\b/.test(page)) failures.push(`${dir}/${file}: past appearance has no year`);
  }
}

const yama = { id: 'yama', name: 'YAMA' };
const noco = { id: 'noco', name: 'NOCO' };
const fuji = { id: 'fuji', name: 'FUJI' };
const ground = { id: 'ground', name: 'Ground' };
const occa = { id: 'occa', name: 'Occa' };
const topia = { id: 'topia', name: 'TOPIA' };
if (!artistNameMatches('YAMA at a festival', 'YAMA') || artistNameMatches('Yamanashi festival', 'YAMA')) failures.push('YAMA boundary test failed');
if (!artistNameMatches('NOCO live set', 'NOCO') || artistNameMatches('Nocoffee release', 'NOCO')) failures.push('NOCO boundary test failed');
if (artistNameMatches('So live set', 'So')) failures.push('short-name test failed');
if (!articleMatchesArtist({ body: '<a href="/artists/yama.html">YAMA</a>' }, yama)) failures.push('artist link match test failed');
if (!articleMatchesArtist({ festivalId: 'topia', body: 'NOCO live at the club' }, noco, { artistFestivalIds: ['topia'], festivals: [topia] })) failures.push('artist contextual name match test failed');
if (articleMatchesArtist({ body: 'Nocoffee live at the club' }, noco)) failures.push('artist false-positive test failed');
if (!artistNameMatches('FUJI', 'FUJI') || !artistNameMatches('previously played Fuji Rock', 'FUJI')) failures.push('FUJI case-insensitive name test failed');
if (articleMatchesArtist({ festivalId: 'topia', body: 'FUJI' }, fuji, { artistFestivalIds: [], festivals: [topia] })) failures.push('FUJI/TOPIA contextual false-positive test failed');
if (articleMatchesArtist({ festivalId: 'topia', body: 'Camp Ground' }, ground, { artistFestivalIds: ['other'], festivals: [topia] })) failures.push('Ground/Camp Ground contextual false-positive test failed');
if (!articleMatchesArtist({ festivalId: 'topia', body: 'OCCA' }, occa, { artistFestivalIds: ['topia'], festivals: [topia] })) failures.push('OCCA contextual match test failed');

if (failures.length) {
  console.error(`❌ artist page checks: ${failures.length}`);
  failures.forEach((failure) => console.error(`  ${failure}`));
  process.exit(1);
}
console.log(`✅ artist pages: ${artists.length} artists, thin=${artists.filter((a) => !stripTags(a.bio) && !stripTags(a.bio_en)).length}, sitemap/indexing and appearance checks passed`);
