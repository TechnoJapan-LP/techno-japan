#!/usr/bin/env node
/* TOPのARTISTSが画像あり・ランダム順で描画される構造かを検査する。 */
import fs from 'node:fs';

const html = fs.readFileSync('LP/index.html', 'utf8');
const failures = [];
if (!html.includes("const withImg = allArtists.filter(a => a.image && a.image.trim());")) failures.push('画像あり候補の抽出がない');
if (!html.includes('function shuffleArtists(items)')) failures.push('Fisher–Yatesシャッフルがない');
if (!html.includes('const artistsToShow = shuffleArtists(withImg).slice(0, 16);')) failures.push('画像あり候補だけをランダム表示していない');
if (html.includes('const artistsToShow = [...withImg, ...others]')) failures.push('画像なし候補を混ぜる旧ロジックが残っている');
if (!html.includes('tjLazyBgAttr(a.image)')) failures.push('既存の遅延背景画像処理を使っていない');
if (failures.length) {
  console.error('TOP ARTISTSに問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('✅ TOP ARTISTSは画像あり・ランダム順・既存遅延読み込み');
