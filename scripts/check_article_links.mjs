import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const dataSource = fs.readFileSync(path.join(root, 'LP/data.js'), 'utf8');
const context = {};
vm.createContext(context);
new vm.Script(`${dataSource}\n;globalThis.__data = { ARTICLES, ARTISTS };`).runInContext(context);
const { ARTICLES, ARTISTS } = context.__data;
const artistIds = new Set(ARTISTS.map((artist) => String(artist.id || '').trim()).filter(Boolean));
const liveArticles = ARTICLES.filter((article) => String(article.status || '').toLowerCase() !== 'draft');
const files = liveArticles.map((article) => ({
  article,
  file: path.join(root, 'LP/articles', `${article.id}.html`),
}));

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
let totalLinks = 0;

for (const { article, file } of files) {
  check(fs.existsSync(file), `${article.id}: HTMLがありません`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const links = [...html.matchAll(/<a\s+class="entity-link"\s+href="\/artists\/([^"./]+)\.html">/g)];
  totalLinks += links.length;
  for (const [, id] of links) {
    check(artistIds.has(id), `${article.id}: artistリンク先がデータにありません (${id})`);
    check(fs.existsSync(path.join(root, 'LP/artists', `${id}.html`)), `${article.id}: artistリンク先ファイルがありません (${id})`);
  }
  check(!/<a[^>]*>[^<]*<a\s/.test(html), `${article.id}: <a>の入れ子を検出しました`);
  const articleBody = html.match(/<div class="article-body">([\s\S]*?)<\/div>/)?.[1] || '';
  check(!/\[\[[\s\S]*?<a\s+class="entity-link"[\s\S]*?\]\]/.test(articleBody), `${article.id}: shortcode内に自動リンクがあります`);
  const headingHasLink = [...articleBody.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)]
    .some(([, , content]) => /<a\s+class="entity-link"/.test(content));
  check(!headingHasLink, `${article.id}: 見出し内に自動リンクがあります`);

  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => { try { return JSON.parse(json); } catch { return null; } })
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .find((item) => item?.['@type'] === 'NewsArticle');
  check(!!ld, `${article.id}: NewsArticle JSON-LDがありません`);
  if (ld) {
    const published = String(ld.datePublished || '');
    const modified = String(ld.dateModified || '');
    check(article.updatedAt ? modified !== published : modified === published, `${article.id}: dateModified が期待値と異なります`);
  }
  console.log(`${article.id}: ${links.length} link(s)`);
}

check(totalLinks > 0, '自動リンクが1件も生成されていません');
if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exit(1);
}
console.log(`article links: ${totalLinks} total; all checks passed`);
