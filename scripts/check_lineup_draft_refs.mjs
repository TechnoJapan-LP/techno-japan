#!/usr/bin/env node
import assert from 'node:assert/strict';
import { resolveLineupArtist } from './lib/lineup-artist.mjs';

const published = new Map([['live-a', { id: 'live-a', name: 'Live A' }]]);
const all = new Map([
  ['live-a', { ID: 'live-a', NAME: 'Live A' }],
  ['draft-a', { ID: 'draft-a', NAME: 'Draft A', STATUS: 'draft' }],
  ['blank-status', { ID: 'blank-status', NAME: 'Blank Status' }],
]);

assert.equal(resolveLineupArtist({ ARTIST_ID: 'draft-a' }, published, all).status, 'unpublished', 'draft行を非公開として扱う');
assert.equal(resolveLineupArtist({ ARTIST_ID: 'blank-status' }, published, all).status, 'unpublished', 'STATUS空欄も非公開として扱う');
assert.equal(resolveLineupArtist({ ARTIST_ID: 'missing-a' }, published, all).status, 'missing', 'シートにも無いIDは参照切れ');

console.log('LINEUP 非公開／参照切れ判定: 3件成功（draft 2ケース・missing 1ケース）');
