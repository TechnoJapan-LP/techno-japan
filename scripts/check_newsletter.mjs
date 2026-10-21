#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts/newsletter-config.json'), 'utf8'));
const fail = (message) => { throw new Error(message); };
if (config.provider !== 'buttondown' || config.buttondownUsername !== 'technojapan') fail('Buttondown の設定が technojapan になっていません');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const articleFiles = (dir) => fs.readdirSync(path.join(root, dir)).filter((file) => file.endsWith('.html'));
const targetFiles = [
  'LP/index.html', 'LP/news.html', 'LP/en/index.html', 'LP/en/news.html',
  ...articleFiles('LP/articles').map((file) => `LP/articles/${file}`).filter((file) => read(file).includes('class="newsletter article-newsletter"')),
  ...articleFiles('LP/en/articles').map((file) => `LP/en/articles/${file}`).filter((file) => read(file).includes('class="newsletter article-newsletter"')),
];
const forms = (html) => [...html.matchAll(/<section class="newsletter[^"]*"[\s\S]*?<form\b[\s\S]*?<\/form>\s*<\/section>/g)].map((match) => match[0]);
let buttondownForms = 0;
let formsubmitOnlyFields = 0;
for (const file of targetFiles) {
  const html = read(file);
  if (!html.includes("form-action 'self' https://formsubmit.co https://buttondown.com")) fail(`${file}: CSP に両方の送信先がありません`);
  const pageForms = forms(html);
  if (pageForms.length !== 1) fail(`${file}: ニュースレター section のフォーム数が ${pageForms.length}（1ではありません）`);
  const form = pageForms[0];
  const expectedTag = file.startsWith('LP/en/') ? 'en' : 'ja';
  if (!form.includes('action="https://buttondown.com/api/emails/embed-subscribe/technojapan"')) fail(`${file}: Buttondown action が不正です`);
  if (!form.includes(`name="tag" value="${expectedTag}"`)) fail(`${file}: tag=${expectedTag} がありません`);
  buttondownForms += 1;
  formsubmitOnlyFields += (form.match(/name="(?:_honey|_subject|_captcha|_next|_template)"/g) || []).length;
}
if (formsubmitOnlyFields !== 0) fail(`Buttondown フォーム内の formsubmit 専用項目が ${formsubmitOnlyFields} 件あります`);

const preservedFormsubmitFiles = ['LP/writers.html', 'LP/en/writers.html'];
const preservedFormsubmitCount = preservedFormsubmitFiles.reduce((count, file) => count + (read(file).match(/action="https:\/\/formsubmit\.co\/press@techno-japan\.media"/g) || []).length, 0);
if (preservedFormsubmitCount !== 2) fail(`ライター応募の formsubmit フォーム数が ${preservedFormsubmitCount}（2ではありません）`);

const hubNames = ['index.html', 'news.html', 'festivals.html', 'artists.html', 'venues.html'];
for (const hub of hubNames) {
  const jaLines = read(`LP/${hub}`).split('\n').length;
  const enLines = read(`LP/en/${hub}`).split('\n').length;
  if (jaLines !== enLines) fail(`${hub}: JA/EN の行数が ${jaLines}/${enLines} で不一致です`);
}

const generator = read('scripts/build-detail-pages.mjs');
for (const expected of ['https://buttondown.com/api/emails/embed-subscribe/', 'name="embed" value="1"', 'name="tag" value="${lang === \'en\' ? \'en\' : \'ja\'}"']) {
  if (!generator.includes(expected)) fail(`Buttondown 切り替え処理が見つかりません: ${expected}`);
}
const draftGenerator = read('scripts/newsletter-draft.mjs');
for (const expected of ['return date >= `${previous}-01` && date <= createdDate', 'summary ? ` — ${summary}` : \'\'']) {
  if (!draftGenerator.includes(expected)) fail(`下書きの月・要約処理が見つかりません: ${expected}`);
}
console.log(`✅ Buttondown newsletters: ${buttondownForms} forms, formsubmit-only fields: ${formsubmitOnlyFields}, preserved formsubmit forms: ${preservedFormsubmitCount}`);
