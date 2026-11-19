#!/usr/bin/env node
import assert from 'node:assert/strict';
import { shouldTrigger } from './scheduled-publish-check.mjs';

const now = new Date('2026-11-25T00:00:00Z');
const scheduled = (publishAt) => ({ id: 'a', status: 'scheduled', publishAt });
assert.equal(shouldTrigger([], now, []).trigger, false, '予約なし');
assert.equal(shouldTrigger([scheduled('2026-11-25T09:00:00+09:00')], new Date('2026-11-24T23:00:00Z'), []).trigger, false, '時刻前');
assert.equal(shouldTrigger([scheduled('2026-11-24T23:00:00+09:00')], now, []).trigger, true, '時刻後・runなし');
assert.equal(shouldTrigger([scheduled('2026-11-24T23:00:00+09:00')], now, [{ createdAt: '2026-11-25T00:00:00Z', status: 'completed', conclusion: 'failure' }]).trigger, false, '時刻後・それ以降のrunあり');
assert.equal(shouldTrigger([scheduled('2026-11-17T23:00:00+09:00')], now, []).trigger, false, '8日前');
console.log('✅ scheduled publish: 5 cases passed');
