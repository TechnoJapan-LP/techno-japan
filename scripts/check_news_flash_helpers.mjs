#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('LP/cms.js', 'utf8');
const start = source.indexOf('function newsFlashNormalize_');
const end = source.indexOf('function lineupArtistKey', start);
assert(start >= 0 && end > start, 'NEWS_FLASH helper block が見つかりません');
const context = {window: {}, console};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context, {filename: 'LP/cms.js:NEWS_FLASH'});
const api = context.window.TJNewsFlash;
assert(api, 'window.TJNewsFlash が公開されていません');
assert.equal(api.contains('DJ ＮＯＢＵ', 'DJ NOBU'), true);
assert.equal(api.contains('日程は2027年5月3日です', '2027年5月3日'), true);
const verification = api.verifyDraft({artists:['DJ ＮＯＢＵ','NOT IN SOURCE'], facts:[{field:'date',quote:'2027年5月3日'},{field:'bad',quote:'存在しない'}]}, 'DJ NOBUの出演が決定。日程は2027年5月3日です。');
assert.deepEqual(verification.artists, ['DJ ＮＯＢＵ']);
assert.deepEqual(verification.rejectedArtists, ['NOT IN SOURCE']);
assert.equal(verification.facts[0].ok, true);
assert.equal(verification.facts[1].ok, false);
assert.equal(api.buildSlug('Rural Fest', 'lineup', '2027-05-03'), 'rural-fest-lineup-20270503');
assert.equal(api.selectBackground({id:'rural', image:'images/festival.webp', flyer:'images/old.webp'}, [{FESTIVAL_ID:'rural',EDITION:'2026',FLYER:'images/2026.webp'},{FESTIVAL_ID:'rural',EDITION:'2027',FLYER:'images/2027.webp'}]), 'images/2027.webp');
assert.equal(api.selectBackground({id:'rural', image:'images/festival.webp', flyer:'images/old.webp'}, []), 'images/festival.webp');
assert.equal(api.selectBackground({id:'rural', flyer:'images/old.webp'}, []), 'images/old.webp');
console.log('✅ NEWS_FLASH verification helpers');
