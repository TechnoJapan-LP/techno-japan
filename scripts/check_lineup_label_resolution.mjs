import assert from 'node:assert/strict';
import { resolveActLabel } from './lineup-label-resolution.mjs';

const nameToArtist = new Map([
  ['dj kensei', 'dj-kensei'],
  ['tonbo', 'tonbo'],
  ['antal', 'antal'],
]);
const publishedArtistIds = new Set(['dj-kensei', 'tonbo', 'antal']);
const resolve = (actLabel, setType = 'dj', ids = publishedArtistIds) =>
  resolveActLabel({ actLabel, setType, nameToArtist, publishedArtistIds: ids });

assert.deepEqual(resolve('dj-kensei'), { artistId: 'dj-kensei', actLabel: '' }, 'ID一致');
assert.deepEqual(resolve('DJ KENSEI'), { artistId: 'dj-kensei', actLabel: '' }, '名前一致');
assert.deepEqual(resolve('Tonbo', 'live'), { artistId: 'tonbo', actLabel: '' }, 'live単独一致');
assert.deepEqual(resolve('Antal & Hunee', 'live'), { artistId: '', actLabel: 'Antal & Hunee' }, 'live複合は不一致');
assert.deepEqual(resolve('Antal', 'b2b'), { artistId: '', actLabel: 'Antal' }, 'b2bは不一致');
assert.deepEqual(resolve('dj-kensei', 'dj', new Set(['tonbo'])), { artistId: '', actLabel: 'dj-kensei' }, 'draftは不一致');

console.log('ACT_LABEL解決の単体テスト: 6件成功');
