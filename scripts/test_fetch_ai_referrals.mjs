#!/usr/bin/env node

import assert from 'node:assert/strict';
import { AI_REFERRER_PATTERN, periodInfo, reportRequest, renderMarkdown, summarize } from './fetch-ai-referrals.mjs';

const periods = periodInfo(new Date('2026-10-21T00:00:00+09:00'));
const request = reportRequest(periods, true);
assert.deepEqual(request.dimensions.map(item => item.name), ['sessionSource', 'landingPagePlusQueryString']);
assert.equal(request.dimensionFilter.filter.fieldName, 'sessionSource');
assert.match(AI_REFERRER_PATTERN, /chatgpt\\.com/);
assert.match(AI_REFERRER_PATTERN, /grok\\.com/);
assert.deepEqual(request.dateRanges, [
  { startDate: '2026-09-24', endDate: '2026-10-21' },
  { startDate: '2026-08-27', endDate: '2026-09-23' },
]);

const filtered = { rows: [
  { dimensionValues: [{ value: 'chatgpt.com' }, { value: '/articles/a.html' }], metricValues: [{ value: '3' }, { value: '2' }, { value: '1' }, { value: '1' }] },
  { dimensionValues: [{ value: 'chatgpt.com' }, { value: '/articles/b.html' }], metricValues: [{ value: '2' }, { value: '1' }, { value: '0' }, { value: '0' }] },
  { dimensionValues: [{ value: 'claude.ai' }, { value: '/articles/c.html' }], metricValues: [{ value: '1' }, { value: '1' }, { value: '0' }, { value: '0' }] },
] };
const all = { rows: [{ metricValues: [{ value: '100' }, { value: '80' }, { value: '50' }, { value: '40' }] }] };
const output = summarize(filtered, all, periods);
assert.equal(output.current.sessions, 6);
assert.equal(output.previous.sessions, 1);
assert.equal(output.current.allSessions, 100);
assert.equal(output.current.share, 0.06);
assert.deepEqual(output.current.bySource.map(item => item.source), ['chatgpt.com', 'claude.ai']);
assert.equal(output.current.topLandingPages[0].landingPage, '/articles/a.html');
assert.match(renderMarkdown(output), /AI割合/);

const zero = summarize({ rows: [] }, { rows: [{ metricValues: [{ value: '0' }, { value: '0' }, { value: '0' }, { value: '0' }] }] }, periods);
assert.equal(zero.current.share, 0);
console.log('fetch-ai-referrals mock checks passed');
