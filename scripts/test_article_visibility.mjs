#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { buildNow, isArticleLive } from './article-visibility.mjs';

const root = path.resolve(import.meta.dirname, '..');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'scripts/fixtures/article-visibility-cases.json'), 'utf8'));
const jsResults = cases.map(({ article, now }) => isArticleLive(article, new Date(now)));
assert.deepEqual(jsResults, cases.map((item) => item.live));

const py = spawnSync('python3', ['-c', `import json,sys,datetime; sys.path.insert(0, 'scripts'); import article_visibility; print(json.dumps([article_visibility.is_article_live(x['article'], datetime.datetime.fromisoformat(x['now'].replace('Z','+00:00'))) for x in json.load(sys.stdin)]))`], {
  cwd: root, input: JSON.stringify(cases), encoding: 'utf8',
});
assert.equal(py.status, 0, py.stderr);
assert.deepEqual(JSON.parse(py.stdout), cases.map((item) => item.live));

const cmsSource = fs.readFileSync(path.join(root, 'LP/cms.js'), 'utf8');
const context = { console, Date, Intl, Object, String, Number, Boolean, RegExp, Map, Set, URL, URLSearchParams };
context.window = context;
context.document = { getElementById: () => ({ value: '', classList: { add(){}, remove(){}, toggle(){} } }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({}) };
context.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
context.sessionStorage = context.localStorage;
context.location = { href: '', hostname: '', search: '' };
context.fetch = async () => ({ json: async () => ({}) });
context.confirm = () => true; context.prompt = () => ''; context.alert = () => {};
context.setTimeout = setTimeout; context.clearTimeout = clearTimeout; context.setInterval = setInterval; context.clearInterval = clearInterval;
context.addEventListener = () => {}; context.removeEventListener = () => {};
vm.createContext(context);
vm.runInContext(`${cmsSource}\n;globalThis.__visibility={isArticleLiveCms,normalizePublishAt,buildArticlesJs,buildHubDataJs};`, context);
const cmsResults = cases.map(({ article, now }) => context.__visibility.isArticleLiveCms(article, new Date(now)));
assert.deepEqual(cmsResults, cases.map((item) => item.live));
assert.equal(context.__visibility.normalizePublishAt('2026-11-25T09:00'), '2026-11-25T09:00:00+09:00');
assert.equal(context.__visibility.normalizePublishAt('Wed Nov 25 2026 09:00:00 GMT+0900 (日本標準時)'), '2026-11-25T09:00:00+09:00');
assert.equal(context.__visibility.normalizePublishAt('2026-11-25'), '2026-11-25T00:00:00+09:00');
const scheduledData = context.__visibility.buildArticlesJs([
  { id: 'future', title: 'Future', status: 'scheduled', publishAt: '2026-11-26T09:00' },
  { id: 'bad', title: 'Bad', status: 'scheduled', publishAt: 'invalid' },
  { id: 'archived', title: 'Archived', status: 'archived' },
]);
assert.match(scheduledData, /id: "future"/);
assert.doesNotMatch(scheduledData, /id: "bad"/);
assert.doesNotMatch(scheduledData, /id: "archived"/);
const hubData = context.__visibility.buildHubDataJs({ ARTICLES: [{ id: 'future', title: 'Future', status: 'scheduled', publishAt: '2099-01-01T00:00:00+09:00' }], FESTIVALS: [], ARTISTS: [], VENUES: [], EVENTS: [] });
assert.doesNotMatch(hubData, /future/);
console.log(`✅ article visibility: ${cases.length} cases agree in Node/Python/CMS`);
