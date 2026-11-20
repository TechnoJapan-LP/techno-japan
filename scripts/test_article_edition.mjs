#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { articleEditionFor } from './lib/article-edition.mjs';
import { articleMatchReason, artistNameMatches } from './lib/artist-page-utils.mjs';

const editions = [
  { EDITION_ID: 'fest-2025', EDITION: '2025', DATE_START: '2025-11-23' },
  { EDITION_ID: 'fest-2026', EDITION: '2026', DATE_START: '2026-11-22' },
  { EDITION_ID: 'fest-2026-2', EDITION: '2026-2', DATE_START: '2026-12-20' },
  { EDITION_ID: 'fest-2027', EDITION: '2027', DATE_START: '2027-11-21' },
];
const annualEditions = editions.filter((edition) => edition.EDITION_ID !== 'fest-2026-2');
const festival = { id: 'fest', name: 'Test Festival' };
const byFestival = new Map([['fest', editions]]);
const artistA = { id: 'a', name: 'Artist A' };
const artistB = { id: 'b', name: 'Artist B' };

assert.equal(articleEditionFor({ id: 'x-2026-info', title: 'Info' }, 'fest', annualEditions).EDITION_ID, 'fest-2026');
assert.equal(articleEditionFor({ id: 'x-info', title: 'Info', date: '2026-11-20' }, 'fest', annualEditions).EDITION_ID, 'fest-2026');
assert.equal(articleEditionFor({ id: 'x-2026-info', title: 'Info Artist B', body: 'Artist B' }, 'fest', annualEditions).EDITION_ID, 'fest-2026');
assert.equal(articleEditionFor({ id: 'x-info', title: 'Info', date: '2026-12-10' }, 'fest', editions).EDITION_ID, 'fest-2026-2');
assert.equal(articleEditionFor({ id: 'x-2026-info', editionId: 'fest-2025' }, 'fest', editions).EDITION_ID, 'fest-2025');
assert.equal(articleEditionFor({ id: 'x-info', title: 'Info' }, 'fest', editions), null);
assert.equal(articleEditionFor({ id: 'x-2025-info', date: '2025-06-20' }, 'fest', editions.filter((edition) => edition.EDITION !== '2025')), null, 'idの年が存在しない場合は日付で別年へ進まない');
assert.equal(articleEditionFor({ id: 'x-info', date: '2024-01-01' }, 'fest', [{ EDITION_ID: 'fest-2026', EDITION: '2026', DATE_START: '2026-01-01' }]), null, '日付差が200日を超える場合はnull');

const missingYearArticle = { id: 'x-2025-info', festivalId: 'fest', date: '2025-06-20', title: 'Artist B', body: 'Artist B' };
const missingYearEdition = articleEditionFor(missingYearArticle, 'fest', editions.filter((edition) => edition.EDITION !== '2025'));
assert.equal(missingYearEdition, null);
assert.deepEqual(missingYearEdition ? ['b'] : [], [], '開催回が無い記事は自動紐づけ0件');
const transcendencePage = fs.readFileSync(new URL('../LP/articles/transcendence-2025-report.html', import.meta.url), 'utf8');
assert.equal(transcendencePage.includes('class="article-overview"'), false, '開催回が無い記事は開催概要なし');

const article = { id: 'x-2026-info', festivalId: 'fest', date: '2026-11-20', title: 'Artist B is not in this edition', body: 'Artist A' };
const context = { artistFestivalIds: ['fest'], festivals: [festival], editionsByFestival: byFestival };
assert.equal(articleMatchReason(article, artistA, { ...context, artistEditionIds: ['fest-2026'] }), 'festival-id');
assert.equal(articleMatchReason(article, artistB, { ...context, artistEditionIds: ['fest-2027'] }), null);
assert.equal(articleMatchReason({ ...article, artistIds: ['b'] }, artistB, { ...context, artistEditionIds: ['fest-2027'] }), 'artist-id');
assert.equal(artistNameMatches('Artist A appears first; Artist B appears later', 'Artist A'), true);
assert.equal(artistNameMatches('No lineup name appears here', 'Artist B'), false);

const articleText = 'Artist A appears first; Artist B appears later';
const lineup = [
  { EDITION_ID: 'fest-2026', ARTIST_ID: 'a' },
  { EDITION_ID: 'fest-2026', ARTIST_ID: 'b' },
  { EDITION_ID: 'fest-2026', ARTIST_ID: 'draft', STATUS: 'draft' },
  { EDITION_ID: 'fest-2026', ARTIST_IDS: ['a', 'b'] },
];
const publicArtists = new Map([['a', artistA], ['b', artistB]]);
const autoIds = lineup.filter((row) => row.EDITION_ID === 'fest-2026' && row.STATUS !== 'draft' && !(row.ARTIST_IDS?.length > 1))
  .map((row) => publicArtists.get(row.ARTIST_ID)).filter((artist) => artist && artistNameMatches(articleText, artist.name)).map((artist) => artist.id);
assert.deepEqual(['manual', ...autoIds], ['manual', 'a', 'b'], '本文の初出順で自動追加し、draft/合同名義を除外');

console.log('✅ 記事の開催回と出演者の自動紐づけ: 年選択・日付選択・同年2回・明示指定・手動優先・開催回単位のStories判定を確認');
