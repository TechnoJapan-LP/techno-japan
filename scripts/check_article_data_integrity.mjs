#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('LP/data.js', 'utf8') + '\nthis.__ARTICLES = ARTICLES;';
const context = {};
vm.runInNewContext(source, context, { filename: 'LP/data.js' });
const articles = Array.isArray(context.__ARTICLES) ? context.__ARTICLES : [];
const errors = [];

for (const article of articles) {
  const id = String(article?.id || '(no-id)');
  for (const field of ['body', 'body_en']) {
    const value = article?.[field];
    if (value == null || value === '') {
      if (field === 'body') errors.push(`${id}: body is empty`);
      continue;
    }
    if (String(value).includes('\uFFFD')) errors.push(`${id}: ${field} contains replacement character`);
    if (/<(?:p|h[1-6])[^>]*>\s*undefined\s*</i.test(String(value))) errors.push(`${id}: ${field} contains literal undefined`);
    for (const match of String(value).matchAll(/<img\b[^>]*>/gi)) {
      if (!/\bsrc\s*=\s*["'][^"']+["']/i.test(match[0])) errors.push(`${id}: ${field} has image without src`);
    }
  }
}

if (errors.length) {
  console.error('Article data integrity: FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Article data integrity: OK (${articles.length} articles)`);
