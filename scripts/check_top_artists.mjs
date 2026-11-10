#!/usr/bin/env node
/* TOP phase 2 の Playing soon が出演予定を優先し、品切れ時も補充できるか検査する。 */
import fs from 'node:fs';
import vm from 'node:vm';

const failures = [];
const html = fs.readFileSync('LP/top-phase2.js', 'utf8');
const dataSource = fs.readFileSync('LP/data-hub.js', 'utf8');
const magazineSource = fs.readFileSync('LP/magazine.js', 'utf8');
function jsonConstant(name) {
  const line = dataSource.split('\n').find((entry) => entry.startsWith(`const ${name} = `));
  if (!line) throw new Error(`${name} が data-hub.js にありません`);
  return JSON.parse(line.slice(`const ${name} = `.length, -1));
}
const artists = jsonConstant('ARTISTS');
const festivals = jsonConstant('FESTIVALS');
function sourceWithFestivals(value) {
  const prefix = 'const FESTIVALS = ';
  return dataSource.split('\n').map((line) => line.startsWith(prefix) ? `${prefix}${JSON.stringify(value)};` : line).join('\n');
}
function fixedDate(iso) {
  const RealDate = Date;
  return class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return new RealDate(iso).getTime(); }
  };
}
function runScenario(name, scenarioFestivals, today) {
  const rendered = {};
  function element(selector) {
    return {dataset: {filter: 'all'}, classList: {add() {}, remove() {}}, style: {setProperty() {}, transform: ''}, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return element(selector); }, set innerHTML(value) { rendered[selector] = String(value); }, get innerHTML() { return rendered[selector] || ''; }, textContent: ''};
  }
  const root = element('#top-phase2');
  root.querySelector = (selector) => element(selector);
  root.querySelectorAll = () => [];
  const document = {documentElement: {lang: 'ja'}, getElementById(id) { return id === 'top-phase2' ? root : element('#' + id); }, querySelector(selector) { return element(selector); }};
  const window = {matchMedia() { return {matches: true}; }, addEventListener() {}, requestAnimationFrame() {}, IntersectionObserver: function () { this.observe = () => {}; }};
  window.window = window;
  const IntersectionObserver = function () { this.observe = () => {}; this.unobserve = () => {}; };
  const context = vm.createContext({console, document, window, IntersectionObserver, Set, Map, Date: fixedDate(today), Math, String, Object, Array, encodeURIComponent});
  vm.runInContext(sourceWithFestivals(scenarioFestivals), context, {filename: 'LP/data-hub.js'});
  vm.runInContext(magazineSource, context, {filename: 'LP/magazine.js'});
  vm.runInContext(html, context, {filename: 'LP/top-phase2.js'});
  const markup = rendered['.top2-artist-grid'] || '';
  const cards = [...markup.matchAll(/<a class="top2-card top2-artist-card[\s\S]*?<h3>([^<]+)<\/h3><p>([^<]*)<\/p><\/a>/g)].map((match) => ({name: match[1], sub: match[2]}));
  const expected = Math.min(6, artists.filter((artist) => artist.image).length);
  if (cards.length !== expected) failures.push(`${name}: 描画カードが${cards.length}人（期待値${expected}人）`);
  if (new Set(cards.map((card) => card.name)).size !== cards.length) failures.push(`${name}: カード名が重複`);
  if (!cards.every((card) => card.name)) failures.push(`${name}: カード名が空`);
  return {cards};
}
const sceneA = runScenario('場面A', festivals, '2026-11-10');
console.log(`✅ 場面A: 実データで${sceneA.cards.length}人を描画（重複なし・名前あり）`);
const sceneB = runScenario('場面B', [], '2026-11-10');
const festivalNames = festivals.map((festival) => String(festival.name || '')).filter(Boolean);
if (sceneB.cards.some((card) => festivalNames.some((name) => card.sub.includes(name)) || /\d{4}[.\-]\d{2}[.\-]\d{2}/.test(card.sub))) failures.push('場面B: 補充カードのサブテキストにフェス名または日付がある');
console.log(`✅ 場面B: 出演予定0人でも${sceneB.cards.length}人を描画（フェス名・日付なし）`);
const plannedArtists = artists.filter((artist) => artist.image).slice(0, 5);
const plannedFestival = [{id: 'checker-festival', name: 'Checker Festival', date: '2027-01-01', lineup: plannedArtists.map((artist) => artist.id)}];
const sceneC = runScenario('場面C', plannedFestival, '2026-11-10');
const sceneCNames = new Set(sceneC.cards.map((card) => card.name));
const missing = plannedArtists.filter((artist) => !sceneCNames.has(artist.name));
if (missing.length) failures.push(`場面C: 出演予定アーティストが欠落（${missing.map((artist) => artist.name).join('、')}）`);
console.log(`✅ 場面C: 出演予定${plannedArtists.length}人を全員含めて${sceneC.cards.length}人を描画（優先）`);
if (!html.includes('slice(0, 12)')) failures.push('次の出演順12人のプールがない');
if (!html.includes('function shuffle(list)')) failures.push('訪問ごとのシャッフルがない');
if (!html.includes('top2-shuffle')) failures.push('Shuffle操作がない');
if (failures.length) {
  console.error('TOP ARTISTSに問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
