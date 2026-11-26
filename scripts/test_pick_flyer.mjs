#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pickFlyer } from './pick-flyer.mjs';

const resolve = (value) => String(value || '').replace(/\.jpg$/i, '.webp');
const festival = { flyer: 'images/festivals/brand.jpg' };

assert.deepEqual(pickFlyer(festival, { EDITION_ID:'f-2026', EDITION:'2026', FLYER:'' }, [
  { EDITION_ID:'f-2026', EDITION:'2026', FLYER:'' },
], resolve), { src:'images/festivals/brand.jpg', edition:'' });

const editions = [
  { EDITION_ID:'f-2026', EDITION:'2026', FLYER:'images/festivals/brand.jpg' },
  { EDITION_ID:'f-2027', EDITION:'2027', FLYER:'' },
];
assert.deepEqual(pickFlyer(festival, editions[1], editions, resolve), { src:'', edition:'' });
assert.deepEqual(pickFlyer(festival, editions[0], editions, resolve), { src:'images/festivals/brand.webp', edition:'2026' });

const older = [
  { EDITION_ID:'f-2025', EDITION:'2025', FLYER:'images/festivals/older.webp' },
  { EDITION_ID:'f-2026', EDITION:'2026', FLYER:'' },
];
assert.deepEqual(pickFlyer(festival, older[1], older, resolve), { src:'images/festivals/brand.jpg', edition:'' });
console.log('✅ 開催回フライヤー選択');
