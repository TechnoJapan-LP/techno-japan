import assert from 'node:assert/strict';
import { normalizeArticleHeadingLevels } from './lib/article-heading-levels.mjs';

assert.equal(
  normalizeArticleHeadingLevels('<h2>A</h2><h4>B</h4>'),
  '<h2>A</h2><h3 data-hl="4">B</h3>'
);
assert.equal(
  normalizeArticleHeadingLevels('<h3>A</h3><h4>B</h4>'),
  '<h2 data-hl="3">A</h2><h3 data-hl="4">B</h3>'
);
assert.equal(
  normalizeArticleHeadingLevels('<h4>A</h4><h2>B</h2><h4>C</h4>'),
  '<h2 data-hl="4">A</h2><h2>B</h2><h3 data-hl="4">C</h3>'
);
const widgetReport = { changes: [], classSkips: [] };
assert.equal(
  normalizeArticleHeadingLevels('<h3 class="tj-event-name">B</h3><h4>C</h4>', widgetReport),
  '<h3 class="tj-event-name">B</h3><h3 data-hl="4">C</h3>'
);
assert.equal(widgetReport.classSkips.length, 1);
const unchanged = '<h2>A</h2><h3>B</h3><h4>C</h4>';
assert.equal(normalizeArticleHeadingLevels(unchanged), unchanged);
assert.equal(normalizeArticleHeadingLevels('<h2><h4>nested</h4></h2>'), '<h2><h4>nested</h4></h2>');

console.log('  ✅ 記事見出しレベル正規化の単体テスト');
