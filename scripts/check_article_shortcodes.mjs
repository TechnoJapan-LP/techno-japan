import assert from 'node:assert/strict';
import {
  parseEventFields,
  renderArticleShortcodes,
  safeUrl,
} from '../LP/article-shortcodes.js';

const input = 'Intro\n[[event|Epizode|2026-12-28〜2027-01-08|Phu Quoc, Vietnam|https://epizode.com|Techno;House]]\n[[calendar]]';
const rendered = renderArticleShortcodes(input, { lang: 'en' });
assert.equal(rendered.events.length, 1);
assert.equal(rendered.calendars, 1);
assert.match(rendered.html, /class="tj-event"/);
assert.match(rendered.html, /class="tj-calendar"/);
assert.match(rendered.html, /href="#ev-epizode-1"/);
assert.match(rendered.html, /OFFICIAL/);
assert.doesNotMatch(rendered.html, /\[\[(event|calendar)/);

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

console.log('article shortcodes: 8 assertions passed');
