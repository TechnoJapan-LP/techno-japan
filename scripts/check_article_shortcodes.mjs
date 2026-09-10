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

console.log('article shortcodes: 39 assertions passed');
