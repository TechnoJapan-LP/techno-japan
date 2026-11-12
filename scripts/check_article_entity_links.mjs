#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { articleEntityRefWarnings, articleRefIds, prioritizeEntityArticles } from './lib/article-entity-links.mjs';

const articles = [
  { id: 'automatic', status: 'published', title: 'DJ NOBU story' },
  { id: 'explicit', status: 'published', artistIds: 'dj-nobu, wata-igarashi' },
  { id: 'venue-explicit', status: 'published', venueIds: ['womb'] },
  { id: 'draft', status: 'draft', artistIds: 'dj-nobu' },
  { id: 'missing', status: 'published', artistIds: 'does-not-exist' },
];
assert.deepEqual(articleRefIds(articles[1], 'artistIds'), ['dj-nobu', 'wata-igarashi']);
assert.deepEqual(articleRefIds({ artistIds: ['a', ' a ', 'bad_id', ''] }, 'artistIds'), ['a']);
assert.deepEqual(articleEntityRefWarnings(
  '\n    artistIds: ["known", "missing"],',
  '\n    id: "known",',
  'artistIds',
), ['missing']);
assert.deepEqual(articleEntityRefWarnings(
  '\n    artistIds: ["known"],',
  '\n    id: "known",',
  'artistIds',
), []);
assert.deepEqual(prioritizeEntityArticles(articles, 'dj-nobu', 'artistIds', (article) => article.id === 'automatic').map((a) => a.id), ['explicit', 'automatic']);
assert.deepEqual(prioritizeEntityArticles(articles, 'womb', 'venueIds', () => false).map((a) => a.id), ['venue-explicit']);

const cms = fs.readFileSync('LP/cms.js', 'utf8');
const festivalPayloads = (cms.match(/festivalId:g\('ar-festivalId'\)/g) || []).length;
const artistPayloads = (cms.match(/artistIds:g\('ar-artistIds'\)/g) || []).length;
const venuePayloads = (cms.match(/venueIds:g\('ar-venueIds'\)/g) || []).length;
assert.equal(festivalPayloads, 2, 'article save payload count changed unexpectedly');
assert.equal(artistPayloads, festivalPayloads);
assert.equal(venuePayloads, festivalPayloads);
assert.match(cms, /'artistIds','venueIds'/);
assert.match(cms, /const ARTICLE_FIELDS = \[[\s\S]*'artistIds','venueIds'/);
assert.match(cms, /matchAll\(\/\\n    id: "\(\[a-z0-9-\]\+\)"\/g\)/);
assert.doesNotMatch(cms, /status: "draft"/);
console.log('article entity links: ok');
