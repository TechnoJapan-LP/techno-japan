#!/usr/bin/env node
/* APPLY の HTML と、公開 Google Form の fixture の対応だけを検査する。
   この検査はファイルを読むだけで、送信・ネットワークアクセスは行わない。 */
import fs from 'node:fs';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/apply-google-form.json', 'utf8'));
const pages = ['LP/submit.html', 'LP/en/submit.html'];
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const attr = (tag, name) => tag.match(new RegExp(`\\b${escapeRegExp(name)}="([^"]*)"`))?.[1] ?? null;
const hasRequired = tag => /\brequired(?:\s|=|>|$)/.test(tag);
const fail = message => { throw new Error(message); };

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  if (!/connect-src[^;]*https:\/\/docs\.google\.com/.test(html)) fail(`${page}: CSP connect-src に docs.google.com がない`);
  for (const question of fixture.questions) {
    const entry = escapeRegExp(question.entry);
    const inputTags = [...html.matchAll(new RegExp(`<input\\b[^>]*\\bname="${entry}"[^>]*>`, 'g'))].map(match => match[0]);
    const textareaTags = [...html.matchAll(new RegExp(`<textarea\\b[^>]*\\bname="${entry}"[^>]*>`, 'g'))].map(match => match[0]);
    const selectMatch = html.match(new RegExp(`<select\\b[^>]*\\bname="${entry}"[^>]*>[\\s\\S]*?<\\/select>`));
    const tags = [...inputTags, ...textareaTags, ...(selectMatch ? [selectMatch[0]] : [])];
    if (!tags.length) fail(`${page}: ${question.entry} がない`);

    if (question.type === 'short_text' && !inputTags.some(tag => ['text', 'url', null].includes(attr(tag, 'type')))) fail(`${page}: ${question.entry} は text input ではない`);
    if (question.type === 'date' && !inputTags.some(tag => attr(tag, 'type') === 'date')) fail(`${page}: ${question.entry} は date input ではない`);
    if (question.type === 'paragraph' && !textareaTags.length) fail(`${page}: ${question.entry} は textarea ではない`);
    if (question.type === 'dropdown' && !selectMatch) fail(`${page}: ${question.entry} は select ではない`);
    if (question.type === 'checkbox' && !inputTags.some(tag => attr(tag, 'type') === 'checkbox')) fail(`${page}: ${question.entry} は checkbox ではない`);

    const required = tags.some(hasRequired);
    if (required !== question.required) fail(`${page}: ${question.entry} の required が fixture と違う`);

    if (question.type === 'dropdown') {
      const rawOptions = [...selectMatch[0].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(match => ({attrs: match[1], value: attr(match[1], 'value'), text: match[2].trim()}));
      const placeholder = page.startsWith('LP/en/') ? 'Select' : '選択してください';
      if (rawOptions[0]?.value !== '' || rawOptions[0]?.text !== placeholder || !/\bselected(?:\s|=|>|$)/.test(rawOptions[0]?.attrs || '')) {
        fail(`${page}: ${question.entry} の先頭に selected な空の選択肢がない`);
      }
      const options = rawOptions.filter(option => option.value !== '').map(({value, text}) => ({value, text}));
      const expected = question.options.map(value => ({value, text: value}));
      if (JSON.stringify(options) !== JSON.stringify(expected)) fail(`${page}: ${question.entry} の選択肢が fixture と違う`);
    }
    if (question.type === 'checkbox') {
      const options = inputTags.filter(tag => attr(tag, 'type') === 'checkbox').map(tag => attr(tag, 'value'));
      if (JSON.stringify(options) !== JSON.stringify(question.options)) fail(`${page}: ${question.entry} の checkbox 選択肢が fixture と違う`);
    }
  }
}

const script = fs.readFileSync('LP/submit-form.js', 'utf8');
if (!script.includes(fixture.action)) fail('submit-form.js: fixture.action へ送信していない');
if (!/fetch\(\s*['"]https:\/\/docs\.google\.com\/forms\/d\/e\//.test(script)) fail('submit-form.js: Google Form への fetch がない');
if (!/method:\s*['"]POST['"]/.test(script) || !/mode:\s*['"]no-cors['"]/.test(script)) fail('submit-form.js: POST/no-cors がない');
if (!/application\/x-www-form-urlencoded/.test(script)) fail('submit-form.js: Content-Type が違う');
if (!/body\.set\(['"]fvv['"],\s*['"]1['"]\)/.test(script) || !/body\.set\(['"]pageHistory['"],\s*['"]0['"]\)/.test(script)) fail('submit-form.js: fvv/pageHistory がない');
console.log(`APPLY form OK: ${fixture.questions.length}問 × ${pages.length}ページ、ネットワーク送信なし`);
