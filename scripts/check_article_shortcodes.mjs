import assert from 'node:assert/strict';
import {
  parseEventFields,
  renderArticleShortcodes,
  safeUrl,
} from '../LP/article-shortcodes.js';

// 項目の並びは [[event|名前|日程|場所|URL|出演者|補足|フェスID]]
const input = 'Intro\n[[event|Epizode|2026-12-28〜2027-01-08|Phu Quoc, Vietnam|https://epizode.com|DJ NOBU;WATA IGARASHI|Techno;House]]\n[[calendar]]';
const rendered = renderArticleShortcodes(input, { lang: 'en' });
assert.equal(rendered.events.length, 1);
assert.equal(rendered.calendars, 1);
assert.match(rendered.html, /class="tj-event"/);
assert.match(rendered.html, /class="tj-calendar"/);
assert.match(rendered.html, /href="#ev-epizode-1"/);
assert.match(rendered.html, /OFFICIAL/);
assert.doesNotMatch(rendered.html, /<p>\s*<article class="tj-event/);
assert.doesNotMatch(rendered.html, /<p>\s*<nav class="tj-calendar/);
assert.doesNotMatch(rendered.html, /\[\[(event|calendar)/);

// 出演者: LINEUP 行として描画され、schema.org の performer が付く
assert.deepEqual(rendered.events[0].artists, ['DJ NOBU', 'WATA IGARASHI']);
assert.deepEqual(rendered.events[0].tags, ['Techno', 'House']);
assert.match(rendered.html, /class="tj-event-lineup"/);
assert.match(rendered.html, /itemprop="performer"/);
assert.match(rendered.html, /DJ NOBU/);
// 出演者が空でも LINEUP 行を出さない（旧5項目形式もこの形で受ける）
const noArtists = parseEventFields('Epizode|2026-12-28|Phu Quoc, Vietnam|https://epizode.com||Techno');
assert.deepEqual(noArtists.artists, []);
assert.doesNotMatch(
  renderArticleShortcodes('[[event|Epizode|2026-12-28|Phu Quoc, Vietnam]]').html,
  /tj-event-lineup/
);
// 出演者名の HTML はエスケープされる
assert.match(
  renderArticleShortcodes('[[event|X|2026-12-28|Tokyo||<b>A</b>]]').html,
  /&lt;b&gt;A&lt;\/b&gt;/
);

assert.throws(
  () => parseEventFields('Name|2026/12/28|Tokyo'),
  /日付が不正/
);
assert.throws(
  () => parseEventFields('Name|2026-12-28|Tokyo|javascript:alert(1)'),
  /URLが不正/
);
assert.throws(
  () => renderArticleShortcodes('No cards here\n[[calendar]]'),
  /eventカードが0件/
);
assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
assert.equal(safeUrl('javascript:alert(1)'), '');

const linked = renderArticleShortcodes(
  '[[event|Rural|2027-05-01|Tokyo|||Techno|rural]]',
  { lang: 'ja', festivalIds: ['rural'] }
);
assert.match(linked.html, /class="tj-event-name-link"/);
assert.match(linked.html, /class="tj-event-link tj-event-festival-link"/);
assert.match(linked.html, /href="\/festivals\/rural\.html"/);
assert.match(
  renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||rural]]', { lang: 'en', festivalIds: ['rural'] }).html,
  /href="\/en\/festivals\/rural\.html"/
);
const legacy = renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo|||Techno]]').html;
assert.doesNotMatch(legacy, /tj-event-name-link|tj-event-festival-link/);
assert.throws(
  () => renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||Rural]]'),
  /フェスIDが不正/
);
assert.throws(
  () => renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||unknown]]', { festivalIds: ['rural'] }),
  /存在しません/
);
assert.match(
  renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||unknown]]').html,
  /href="\/en\/festivals\/unknown\.html"/
);

const festivalData = { rural: { imageHtml: '<img src="/images/rural.webp" alt="Rural">', lineup: ['A', 'B', 'C'] } };
const autoLineup = renderArticleShortcodes(
  '[[event|Rural|2027-05-01|Tokyo||||rural]]', { lang: 'ja', festivalData }
);
assert.match(autoLineup.html, /has-photo/);
assert.match(autoLineup.html, /tj-event-photo/);
assert.match(autoLineup.html, /src="\/images\/rural\.webp"/);
assert.equal((autoLineup.html.match(/itemprop="performer"/g) || []).length, 3);
const twelve = Array.from({ length: 12 }, (_, i) => `Artist ${i + 1}`);
const capped = renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||rural]]', {
  lang: 'ja', festivalData: { rural: { lineup: twelve } }
}).html;
assert.match(capped, /ほか 2 組/);
assert.equal((capped.match(/itemprop="performer"/g) || []).length, 10);
assert.match(renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo|https://example.com|Article Act||rural]]', {
  lang: 'en', festivalData: { rural: { lineup: ['Festival Act'] } }
}).html, /Article Act/);
assert.doesNotMatch(renderArticleShortcodes('[[event|Rural|2027-05-01|Tokyo||||rural]]').html, /has-photo|tj-event-main/);

const artistData = { 'dj-nobu': {
  name: 'DJ Nobu', genre: 'Techno', place: 'CHIBA, JAPAN',
  bio: '日本のテクノシーンを代表するDJ。長い経歴と豊かな経験を持つアーティスト。',
  bioEn: 'A leading DJ in Japan’s techno scene with a long career and rich experience.',
  imageHtml: '<img src="/images/dj-nobu.webp" alt="DJ Nobu">',
  links: { instagram: 'https://instagram.com/djnobu' },
} };
const artistCard = renderArticleShortcodes('[[artist-card:dj-nobu]]', { lang: 'ja', artistData });
assert.match(artistCard.html, /class="tj-artist-card has-photo"/);
assert.match(artistCard.html, /href="\/artists\/dj-nobu\.html"/);
assert.match(artistCard.html, /DJ Nobu/);
assert.match(artistCard.html, /日本のテクノシーンを代表するDJ/);
const artistNote = renderArticleShortcodes('[[artist-card:dj-nobu|この夜の<b>クロージング</b>]]', { lang: 'ja', artistData });
assert.match(artistNote.html, /tj-artist-card-note/);
assert.doesNotMatch(artistNote.html, /tj-artist-card-bio/);
assert.match(renderArticleShortcodes('[[artist-card:dj-nobu]]', { lang: 'en', artistData }).html, /A leading DJ in Japan/);
assert.match(renderArticleShortcodes('[[artist-card:dj-nobu]]', { lang: 'ja', artistData }).html, /日本のテクノシーン/);
assert.match(artistNote.html, /&lt;b&gt;クロージング&lt;\/b&gt;/);
assert.throws(() => renderArticleShortcodes('[[artist-card:unknown]]', { artistData }), /unknown/);
assert.doesNotMatch(renderArticleShortcodes('<p>[[artist-card:dj-nobu]]</p>', { artistData }).html, /<p>\s*<aside/);
assert.equal(renderArticleShortcodes('[[artist:dj-nobu]]', { artistData }).html, '[[artist:dj-nobu]]');
const longBio = { 'dj-nobu': { ...artistData['dj-nobu'], bio: 'あ'.repeat(141) } };
assert.match(renderArticleShortcodes('[[artist-card:dj-nobu]]', { lang: 'ja', artistData: longBio }).html, /あ{140}…/);
const longEnglishBio = { 'dj-nobu': { ...artistData['dj-nobu'], bioEn: 'word '.repeat(100) } };
assert.match(renderArticleShortcodes('[[artist-card:dj-nobu]]', { lang: 'en', artistData: longEnglishBio }).html, /word…<\/p>/);

const pullquote = renderArticleShortcodes('[[pullquote|本文]]');
assert.match(pullquote.html, /<aside class="tj-pullquote">/);
assert.match(pullquote.html, /class="tj-pullquote-text">本文<\/p>/);
assert.doesNotMatch(pullquote.html, /tj-pullquote-source/);
assert.match(renderArticleShortcodes('[[pullquote|本文|DJ Nobu]]').html, /tj-pullquote-source">— DJ Nobu<\/p>/);
assert.match(renderArticleShortcodes('[[pullquote|<b>本文<\/b>]]').html, /&lt;b&gt;本文&lt;\/b&gt;/);
assert.throws(() => renderArticleShortcodes('[[pullquote|]]'), /本文が空/);
assert.throws(() => renderArticleShortcodes('[[pullquote| |X]]'), /本文が空/);
assert.doesNotMatch(renderArticleShortcodes('<p>[[pullquote|本文]]</p>').html, /<p>\s*<aside/);
assert.equal(renderArticleShortcodes('[[pullquote|本文]][[pullquote|別の本文|出典]]').pullquotes, 2);

const details = renderArticleShortcodes('<p>[[details|見出し]]</p><p>中身</p><p>[[/details]]</p>');
assert.match(details.html, /<details class="tj-details">/);
assert.match(details.html, /<summary class="tj-details-summary">見出し<\/summary>/);
assert.match(details.html, /<div class="tj-details-body"><p>中身<\/p><\/div>/);
assert.doesNotMatch(details.html, /\[\[/);
assert.match(renderArticleShortcodes('[[details|A]]x[[/details]]').html, /<div class="tj-details-body">x<\/div>/);
assert.match(renderArticleShortcodes('[[details|A]]<p>[[pullquote|本文]]</p>[[/details]]').html, /tj-details-body[\s\S]*tj-pullquote/);
assert.match(renderArticleShortcodes('[[details|<b>見出し</b>]]x[[/details]]').html, /&lt;b&gt;見出し&lt;\/b&gt;/);
assert.equal(details.details, 1);
assert.throws(() => renderArticleShortcodes('[[details|A]]x'), /閉じ忘れ/);
assert.throws(() => renderArticleShortcodes('[[details|A]][[details|B]]x[[/details]][[/details]]'), /入れ子/);
assert.throws(() => renderArticleShortcodes('[[details|]]x[[/details]]'), /見出しが空/);

console.log('article shortcodes: 72 assertions passed');
