#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/newsletter-config.json'), 'utf8'));
const fail = (message) => { throw new Error(message); };
if (config.provider !== 'formsubmit' || config.buttondownUsername !== '') fail('初期設定は formsubmit / 空のユーザー名である必要があります');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const jaIndex = read('LP/index.html');
const jaNews = read('LP/news.html');
const enIndex = read('LP/en/index.html');
const enNews = read('LP/en/news.html');
const jaArticle = read('LP/articles/intergalactic-2026-info.html');
const enArticle = read('LP/en/articles/intergalactic-2026-info.html');
for (const [name, html] of Object.entries({ jaIndex, jaNews, enIndex, enNews, jaArticle, enArticle })) {
  if (!html.includes("form-action 'self' https://formsubmit.co https://buttondown.com")) fail(`${name}: CSP に両方の送信先がありません`);
  if (html.includes('buttondown.com/api/emails/embed-subscribe')) fail(`${name}: 初期設定で Buttondown に切り替わっています`);
}
if (![jaIndex, jaNews, jaArticle, enIndex, enNews, enArticle].every((html) => html.includes('https://formsubmit.co/press@techno-japan.media'))) {
  fail('初期設定の formsubmit フォームが見つかりません');
}

for (const lang of ['ja', 'en']) {
  const file = path.join(root, 'reports/newsletter/2026-11-${lang}.md'.replace('${lang}', lang));
  const body = fs.readFileSync(file, 'utf8');
  if (!body.includes(lang === 'ja' ? '<!-- Subject: 2026年11月のフェス・レイヴ情報 — TECHNO JAPAN -->' : '<!-- Subject: Festivals & raves in Japan — November 2026 -->')) fail(`${lang}: 号の月・件名が11月になっていません`);
  if (!body.includes('utm_source=newsletter&utm_medium=email&utm_campaign=2026-11')) fail(`${lang}: 号の月UTM がありません`);
  if (!body.includes(lang === 'ja' ? 'ここに3〜4行' : 'Add 3–4 lines')) fail(`${lang}: 編集部欄の仮置きがありません`);
  if (/ —\s*$/m.test(body)) fail(`${lang}: 要約が空の行に em dash が残っています`);
}

const generator = read('scripts/build-detail-pages.mjs');
for (const expected of ['https://buttondown.com/api/emails/embed-subscribe/', 'name="embed" value="1"', 'name="tag" value="${lang === \'en\' ? \'en\' : \'ja\'}"']) {
  if (!generator.includes(expected)) fail(`Buttondown 切り替え処理が見つかりません: ${expected}`);
}
const draftGenerator = read('scripts/newsletter-draft.mjs');
for (const expected of ['return date >= `${previous}-01` && date <= createdDate', 'summary ? ` — ${summary}` : \'\'']) {
  if (!draftGenerator.includes(expected)) fail(`下書きの月・要約処理が見つかりません: ${expected}`);
}
console.log('✅ newsletter config / form fallback / CSP / draft output checks passed');
