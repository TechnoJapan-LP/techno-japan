#!/usr/bin/env node
/* TOP phase 2 の Playing soon が実際に6枚のカードを描画できるか検査する。 */
import fs from 'node:fs';
import vm from 'node:vm';

const failures = [];
const html = fs.readFileSync('LP/top-phase2.js', 'utf8');
const rendered = {};
function element(selector) {
  return {
    dataset: {filter: 'all'},
    classList: {add() {}, remove() {}},
    style: {setProperty() {}, transform: ''},
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return element(selector); },
    set innerHTML(value) { rendered[selector] = String(value); },
    get innerHTML() { return rendered[selector] || ''; },
    textContent: ''
  };
}
const root = element('#top-phase2');
root.querySelector = (selector) => element(selector);
root.querySelectorAll = () => [];
const document = {
  documentElement: {lang: 'ja'},
  getElementById(id) { return id === 'top-phase2' ? root : element('#' + id); },
  querySelector(selector) { return element(selector); }
};
const window = {
  matchMedia() { return {matches: true}; },
  addEventListener() {},
  requestAnimationFrame() {},
  IntersectionObserver: function () { this.observe = () => {}; }
};
window.window = window;
const IntersectionObserver = function () { this.observe = () => {}; this.unobserve = () => {}; };
const context = vm.createContext({console, document, window, IntersectionObserver, Set, Date, Math, String, Object, Array, encodeURIComponent});
vm.runInContext(fs.readFileSync('LP/data-hub.js', 'utf8'), context, {filename: 'LP/data-hub.js'});
vm.runInContext(html, context, {filename: 'LP/top-phase2.js'});
const cards = [...(rendered['.top2-artist-grid'] || '').matchAll(/<h3>([^<]+)<\/h3>/g)].map((match) => match[1]);
if (cards.length !== 6) failures.push(`Playing soon の描画カードが${cards.length}人（6人ではない）`);
if (new Set(cards).size !== cards.length) failures.push('Playing soon のカード名が重複している');
if (!cards.every(Boolean)) failures.push('Playing soon のカード名が空');
if (!html.includes('slice(0, 12)')) failures.push('次の出演順12人のプールがない');
if (!html.includes('function shuffle(list)')) failures.push('訪問ごとのシャッフルがない');
if (!html.includes('top2-shuffle')) failures.push('Shuffle操作がない');
if (failures.length) {
  console.error('TOP ARTISTSに問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log(`✅ Playing soon は6人を描画（${cards.join('、')}）・次回出演順プール・Shuffle`);
