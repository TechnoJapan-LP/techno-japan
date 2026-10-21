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
for (const expected of ['return date >= `${previous}-01` && date <= createdDate', 'status: \'draft\'', 'method: \'PATCH\'', 'query.searchParams.set(\'status\', \'draft\')', 'template: \'naked\'', ": festival.name;", "festival.name_en || festival.name"]) {
  if (!draftGenerator.includes(expected)) fail(`下書きの月・要約処理が見つかりません: ${expected}`);
}
const newsletterFiles = ['reports/newsletter/2026-11-ja.html', 'reports/newsletter/2026-11-en.html'];
const allowedColors = new Set(['#080808', '#1b1b1b', '#f0ede8', '#ff2d2d']);
let cardCells = 0;
for (const file of newsletterFiles) {
  const html = read(file);
  if (!/^<!-- Subject:[\s\S]*<!doctype html>/i.test(html)) fail(`${file}: 完全なHTML下書きではありません`);
  if (/<style\b|\bclass\s*=|display\s*:\s*(?:flex|grid)/i.test(html)) fail(`${file}: メール互換性に反する style/class/flex/grid があります`);
  const colors = [...html.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0].toLowerCase());
  for (const color of colors) if (!allowedColors.has(color)) fail(`${file}: 許可されていない色 ${color}`);
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)) if (!/^https:\/\//.test(match[1])) fail(`${file}: 画像URLがHTTPS絶対URLではありません: ${match[1]}`);
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) if (match[1] !== '{{ unsubscribe_url }}' && !match[1].includes('utm_source=newsletter')) fail(`${file}: UTMのないリンクがあります: ${match[1]}`);
  const images = [...html.matchAll(/<img\b[^>]*\balt="([^"]+)"/gi)];
  if (images.some((match) => !match[1])) fail(`${file}: 画像altが空です`);
  cardCells += (html.match(/<td width="50%"/g) || []).length;
  if (!/<table[^>]+width="600"/.test(html)) fail(`${file}: 600px外枠がありません`);
  if (!html.includes('border-radius:12px') || !html.includes('height:auto')) fail(`${file}: カードの角丸または可変幅画像がありません`);
  if (!html.includes('table-layout:fixed') || !html.includes('max-width:600px')) fail(`${file}: 固定レイアウトまたは600px上限がありません`);
  if (/<td\s+colspan="2"(?!\s+width="100%")/i.test(html)) fail(`${file}: 全幅ブロックのcolspan/width指定がありません`);
}
if (cardCells === 0 || cardCells % 2 !== 0) fail(`カードセルが2列単位ではありません: ${cardCells}`);
if (!draftGenerator.includes("email.status === 'draft'") || draftGenerator.includes('/send-draft')) fail('送信済み、または送信エンドポイントに触れる実装があります');
console.log(`✅ Buttondown newsletters: ${buttondownForms} forms, HTML drafts: ${newsletterFiles.length}, card cells: ${cardCells}, formsubmit-only fields: ${formsubmitOnlyFields}, preserved formsubmit forms: ${preservedFormsubmitCount}`);
