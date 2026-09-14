#!/usr/bin/env node
/* RSS / Google News sitemap / related stories の生成物検査。外部パッケージ不要。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.join(process.cwd(), 'LP');
const errors = [];
const fail = (message) => errors.push(message);
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

function loadArticles() {
  const context = {};
  vm.createContext(context);
  try {
    new vm.Script(read(path.join(root, 'data.js')) + '\nthis.__articles = ARTICLES;').runInContext(context);
  } catch (error) {
    fail(`data.js の ARTICLES を読めない: ${error.message}`);
    return [];
  }
  return Array.isArray(context.__articles) ? context.__articles : [];
}

function checkNoBreakNames() {
  const context = { document: { documentElement: { lang: 'ja' } } };
  context.window = context;
  vm.createContext(context);
  try {
    new vm.Script(read(path.join(root, 'localize.js'))).runInContext(context);
  } catch (error) {
    fail(`localize.js の tjNoBreakNames を読めない: ${error.message}`);
    return;
  }
  const noBreak = context.tjNoBreakNames;
  const japanese = noBreak('【2026年9月】日本の音楽フェスティバル&レイヴまとめ');
  if (!japanese.includes('<span class="tj-nobr">フェスティバル</span>')) {
    fail('tjNoBreakNames が「フェスティバル」を保護していない');
  }
  if (!japanese.includes('<span class="tj-nobr">レイヴ</span>')) {
    fail('tjNoBreakNames が「レイヴ」を保護していない');
  }
  if (!japanese.includes('&amp;') || japanese.includes('&amp</')) {
    fail('tjNoBreakNames の & エンティティが壊れている');
  }

  const mixed = noBreak('香港の谷で16時間踊り続ける Shi Fu Miz が10周年アニバーサリー');
  if (!mixed.includes('<span class="tj-nobr">Shi Fu Miz</span>')) {
    fail('tjNoBreakNames が「Shi Fu Miz」を保護していない');
  }
  if (!mixed.includes('<span class="tj-nobr">アニバーサリー</span>')) {
    fail('tjNoBreakNames が「アニバーサリー」を保護していない');
  }

  const longKana = noBreak('日本のアイウエオカキクケコサシス情報');
  if (longKana.includes('<span class="tj-nobr">')) {
    fail('tjNoBreakNames が12文字を超えるカタカナ語を保護している');
  }

  const english = 'Shi Fu Miz celebrates its anniversary';
  if (noBreak(english) !== english) fail('英文のみのタイトルが素通りしていない');
}

checkNoBreakNames();

function checkXml(file, label) {
  const xml = read(file);
  if (!xml) {
    fail(`${label} が存在しない`);
    return '';
  }
  if (/(^|[^&])&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(xml)) fail(`${label} に未エスケープの & がある`);
  const stack = [];
  const tags = xml.match(/<!--[\s\S]*?-->|<\?[^>]*\?>|<!DOCTYPE[^>]*>|<[^>]+>/gi) || [];
  for (const token of tags) {
    if (token.startsWith('<!--') || token.startsWith('<?') || token.startsWith('<!DOCTYPE')) continue;
    if (token.startsWith('</')) {
      const name = token.match(/^<\/\s*([\w:.-]+)/)?.[1];
      if (!name || stack.pop() !== name) { fail(`${label} のタグ対応が不正`); break; }
    } else if (!token.endsWith('/>')) {
      const name = token.match(/^<\s*([\w:.-]+)/)?.[1];
      if (name) stack.push(name);
    }
  }
  if (stack.length) fail(`${label} の閉じタグが不足`);
  return xml;
}

const hasMarkdownDecoration = (value) => {
  const text = String(value || '').trim();
  return /^#|^```|^\*\*[\s\S]+\*\*$/.test(text);
};

function checkArticleMetadata(file, html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
  if (title !== undefined && hasMarkdownDecoration(title)) {
    fail(`${file} <title> にマークダウン記号が残っている: ${title}`);
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\bproperty=["']og:title["']/i.test(tag)) continue;
    const value = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (value !== undefined && hasMarkdownDecoration(value)) {
      fail(`${file} og:title にマークダウン記号が残っている: ${value}`);
    }
  }
}

const articles = loadArticles();
const published = articles.filter((article) => article?.status === 'published' && article.id);
const rss = checkXml(path.join(root, 'articles.xml'), 'articles.xml');
const rssItems = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
if (rss && rssItems.length !== Math.min(published.length, 20)) {
  fail(`articles.xml の記事数が不一致: ${rssItems.length} / 期待 ${Math.min(published.length, 20)}`);
}
for (const item of rssItems) {
  const link = item.match(/<link>([^<]*)<\/link>/)?.[1] || '';
  if (!link.includes('/articles/')) fail(`articles.xml に記事以外のリンク: ${link}`);
}
const latest = [...published].sort((a, b) => String(b.publishedAt || b.date || '').localeCompare(String(a.publishedAt || a.date || '')))[0];
if (latest && !rss.includes(`/articles/${latest.id}.html`)) fail(`articles.xml に最新記事がない: ${latest.id}`);

for (const [file, label] of [[path.join(root, 'articles.xml'), 'articles.xml'], [path.join(root, 'rss.xml'), 'rss.xml']]) {
  const xml = read(file);
  for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    for (const field of ['title', 'description']) {
      const value = item[1].match(new RegExp(`<${field}>([\\s\\S]*?)<\\/${field}>`, 'i'))?.[1];
      if (value !== undefined && hasMarkdownDecoration(value)) {
        fail(`${label} <${field}> にマークダウン記号が残っている: ${value}`);
      }
    }
  }
}

const newsSitemap = checkXml(path.join(root, 'sitemap-news.xml'), 'sitemap-news.xml');
if (newsSitemap && !newsSitemap.includes('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')) {
  fail('sitemap-news.xml に news 名前空間がない');
}
const parseDate = (article) => {
  const value = article.publishedAt || article.date;
  if (!value) return NaN;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00+09:00`) : Date.parse(value);
};
const now = Date.now();
const expectedNews = new Set(published.filter((article) => {
  const time = parseDate(article);
  return Number.isFinite(time) && time <= now && now - time <= 48 * 60 * 60 * 1000;
}).map((article) => article.id));
const actualNews = new Set([...newsSitemap.matchAll(/<loc>https:\/\/techno-japan\.media\/articles\/([^<]+)\.html<\/loc>/g)].map((m) => m[1]));
for (const id of actualNews) {
  const article = published.find((item) => item.id === id);
  if (!article || !expectedNews.has(id)) fail(`sitemap-news.xml に48時間外または非公開記事: ${id}`);
}
for (const id of expectedNews) if (!actualNews.has(id)) fail(`sitemap-news.xml に直近48時間の記事がない: ${id}`);

if (!read(path.join(root, 'robots.txt')).includes('Sitemap: https://techno-japan.media/sitemap-news.xml')) {
  fail('robots.txt に sitemap-news.xml の行がない');
}

for (const lang of ['', 'en/']) {
  for (const article of published) {
    const file = path.join(root, lang, 'articles', `${article.id}.html`);
    const html = read(file);
    if (!html) { fail(`${lang || 'ja/'}${article.id}.html が存在しない`); continue; }
    checkArticleMetadata(file, html);
    const section = html.match(/<section class="detail-section festival-related-stories-v2 article-related-stories">([\s\S]*?)<\/section>/)?.[1];
    if (published.length >= 2 && !section) { fail(`${file} に RELATED STORIES がない`); continue; }
    if (!section) continue;
    for (const link of section.matchAll(/href="([^"]*\/articles\/([^"/]+)\.html)"/g)) {
      if (link[2] === article.id) fail(`${file} の関連記事が自分自身を指す`);
      const target = path.join(root, lang, 'articles', `${link[2]}.html`);
      if (!fs.existsSync(target)) fail(`${file} の関連記事リンク先がない: ${link[1]}`);
    }
  }
}

const festivalFixture = path.join(root, 'festivals', 're-birth-festival.html');
const festivalHtml = read(festivalFixture);
if (!festivalHtml) {
  fail('フェス関連記事の確認対象が存在しない: re-birth-festival.html');
} else {
  const festivalSection = festivalHtml.match(/<section class="detail-section festival-related-stories-v2">([\s\S]*?)<\/section>/)?.[1];
  if (!festivalSection || !festivalSection.includes('class="related-stories"')) fail('フェス関連記事の既存セクションが維持されていない');
  for (const link of festivalSection.matchAll(/href="([^"]*\/articles\/([^"/]+)\.html)"/g)) {
    if (!fs.existsSync(path.join(root, 'articles', `${link[2]}.html`))) fail(`フェス関連記事リンク先がない: ${link[1]}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`❌ ${error}`);
  process.exit(1);
}
console.log(`✅ feeds OK: RSS ${rssItems.length}件 / News sitemap ${actualNews.size}件 / related stories ${published.length * 2}ページ`);
