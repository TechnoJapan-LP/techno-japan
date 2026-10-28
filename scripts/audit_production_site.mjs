#!/usr/bin/env node
/** 本番サイトを GET だけで点検し、週次レポートを作る。 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_BASE = 'https://techno-japan.media';
const USER_AGENT = 'TechnoJapanSiteAudit/1.0 (+https://techno-japan.media/about.html) TJAudit';
const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] || fallback;
  return process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;
}

const base = new URL(argumentValue('--base', DEFAULT_BASE));
base.hash = '';
const outDir = path.resolve(argumentValue('--out', path.join('reports', 'site-audit')));

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function attrs(tag) {
  const result = {};
  const re = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = re.exec(tag))) result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}

function resolveUrl(raw, parent) {
  const value = decodeHtml(raw).trim();
  if (!value || value.startsWith('#') || /^(?:data|javascript|mailto|tel):/i.test(value)) return null;
  try {
    const url = new URL(value, parent);
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function comparableUrl(value) {
  const url = new URL(value);
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

function isRedirect(status) {
  return status >= 300 && status < 400;
}

async function request(url, { readBody = false } = {}) {
  let current = new URL(url).toString();
  const redirects = [];
  const seen = new Set();

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    if (seen.has(current)) {
      return { url, finalUrl: current, status: 0, body: '', redirects, error: '転送がループしています' };
    }
    seen.add(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.1' },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const message = error?.name === 'AbortError' ? '20秒で時間切れになりました' : `取得できませんでした（${error.message}）`;
      return { url, finalUrl: current, status: 0, body: '', redirects, error: message };
    }
    clearTimeout(timer);

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { url, finalUrl: current, status: response.status, body: '', redirects, error: '転送先がありません' };
      if (redirects.length >= MAX_REDIRECTS) {
        return { url, finalUrl: current, status: response.status, body: '', redirects, error: `転送が${MAX_REDIRECTS}回を超えました` };
      }
      const next = resolveUrl(location, current);
      if (!next) return { url, finalUrl: current, status: response.status, body: '', redirects, error: '転送先URLが不正です' };
      redirects.push({ from: current, to: next.toString(), status: response.status });
      current = next.toString();
      continue;
    }

    let body = '';
    if (readBody) {
      try {
        body = await response.text();
      } catch (error) {
        return { url, finalUrl: current, status: response.status, body: '', redirects, error: `本文を読めませんでした（${error.message}）` };
      }
    } else if (response.body) {
      try { await response.body.cancel(); } catch { /* 読み捨て */ }
    }
    return { url, finalUrl: current, status: response.status, body, redirects, contentType: response.headers.get('content-type') || '' };
  }

  return { url, finalUrl: current, status: 0, body: '', redirects, error: '転送を追い切れませんでした' };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function readSitemap(url) {
  const result = await request(url, { readBody: true });
  if (result.error || result.status !== 200) {
    return { urls: [], error: { url, message: result.error || `HTTP ${result.status}` } };
  }
  const urls = [];
  const urlBlocks = [...result.body.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi)].map((match) => match[1]);
  const source = urlBlocks.length ? urlBlocks.join('\n') : result.body;
  for (const match of source.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const target = resolveUrl(match[1].replace(/<[^>]+>/g, ''), url);
    if (target && /^https?:$/i.test(target.protocol)) urls.push(target.toString());
  }
  return { urls, error: null };
}

function metaTags(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => attrs(match[0]));
}

function linkTags(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => attrs(match[0]));
}

function scriptBlocks(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((match) => ({ attrs: attrs(match[1]), body: match[2] }));
}

function removeNonContent(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
}

function pageLinks(html, pageUrl) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    const target = resolveUrl(match[1] ?? match[2] ?? match[3], pageUrl);
    if (target && target.origin === new URL(pageUrl).origin) links.push(target.toString());
  }
  return [...new Set(links)];
}

function titleOf(html) {
  return decodeHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
}

function metaContent(tags, name, attribute = 'name') {
  return tags.find((tag) => String(tag[attribute] || '').toLowerCase() === name)?.content || '';
}

function issue(url, message, extra = {}) {
  return { url, message, ...extra };
}

function duplicateWarnings(values, label) {
  const groups = new Map();
  for (const item of values) {
    if (!item.value) continue;
    if (!groups.has(item.value)) groups.set(item.value, []);
    groups.get(item.value).push(item.url);
  }
  return [...groups.entries()]
    .filter(([, urls]) => urls.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([value, urls]) => ({ type: `duplicate-${label}`, message: `${label === 'title' ? 'title' : 'meta description'} が同じページ`, value, urls }));
}

function areMutuallyHreflanged(urls, hreflangPairs) {
  const keys = urls.map(comparableUrl);
  return keys.every((from, index) => keys.every((to, targetIndex) => (
    index === targetIndex || hreflangPairs.has(from + '\n' + to)
  )));
}

function duplicateWarningsWithoutLocalizedPairs(values, label, hreflangPairs) {
  const groups = new Map();
  for (const item of values) {
    if (!item.value) continue;
    if (!groups.has(item.value)) groups.set(item.value, []);
    groups.get(item.value).push(item.url);
  }
  const warnings = [];
  let localizedGroupCount = 0;
  for (const [value, urls] of [...groups.entries()]
    .filter(([, groupUrls]) => groupUrls.length > 1)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
    if (areMutuallyHreflanged(urls, hreflangPairs)) {
      if (label === 'title') localizedGroupCount += 1;
      continue;
    }
    warnings.push({
      type: 'duplicate-' + label,
      message: (label === 'title' ? 'title' : 'meta description') + ' が同じページ',
      value,
      urls,
    });
  }
  return { warnings, localizedGroupCount };
}

function canonicalTargetForLink(target, canonicalByUrl) {
  const url = new URL(target);
  const targetKey = comparableUrl(target);
  if (canonicalByUrl.has(targetKey)) return canonicalByUrl.get(targetKey);
  if (!url.pathname.endsWith('/index.html')) return targetKey;
  const directory = new URL(target);
  directory.pathname = directory.pathname.slice(0, -'index.html'.length) || '/';
  const directoryKey = comparableUrl(directory);
  return canonicalByUrl.get(directoryKey) || targetKey;
}

function formatIssue(item) {
  const from = item.from ? `（リンク元: \`${item.from}\`）` : '';
  return `- \`${item.url}\` — ${item.message}${from}`;
}

function renderMarkdown(report) {
  const lines = [
    '# 本番サイト定期点検',
    '',
    `- 実行日時: ${report.generated_at}`,
    `- 対象サイト: ${report.base}`,
    `- 調べたURL数: ${report.url_count}`,
    `- エラー件数: ${report.error_count}`,
    `- 注意件数: ${report.warning_count}`,
    '',
    '## エラー（直すべきもの）',
    '',
  ];
  if (report.errors.length) lines.push(...report.errors.map(formatIssue));
  else lines.push('問題なし');
  lines.push('', '## 注意（直した方がよいもの）', '');
  if (!report.warnings.length) {
    lines.push('問題なし');
  } else {
    const visible = report.warnings.slice(0, 30);
    lines.push(...visible.map((item) => {
      if (item.urls) return `- ${item.message}: ${item.urls.map((url) => `\`${url}\``).join('、')}`;
      return formatIssue(item);
    }));
    if (report.warnings.length > visible.length) lines.push(`- ほか ${report.warnings.length - visible.length} 件`);
  }
  lines.push('', '参考: 言語違いで同じ title の組 ' + report.localized_title_duplicate_groups + ' 組（hreflang で対応づけ済み）');
  return lines.join('\n') + '\n';
}

async function main() {
  const generatedAt = new Date().toISOString();
  const sitemapUrls = [new URL('/sitemap.xml', base).toString(), new URL('/sitemap-news.xml', base).toString()];
  const sitemapResults = await Promise.all(sitemapUrls.map(readSitemap));
  const errors = [];
  for (const result of sitemapResults) if (result.error) errors.push(issue(result.error.url, `サイトマップを読めませんでした: ${result.error.message}`));

  const urls = [...new Set(sitemapResults.flatMap((result) => result.urls))];
  const pageResults = await mapLimit(urls, CONCURRENCY, (url) => request(url, { readBody: true }));
  const pageByUrl = new Map(urls.map((url, index) => [url, pageResults[index]]));
  const resourceCache = new Map(pageByUrl);
  const internalLinks = new Map();
  const titles = [];
  const descriptions = [];
  const inbound = new Map(urls.map((url) => [comparableUrl(url), new Set()]));
  const hreflangTargets = [];
  const canonicalByUrl = new Map();
  const imageTargets = [];
  const warnings = [];

  for (const [url, result] of pageByUrl) {
    if (result.error) {
      errors.push(issue(url, result.error));
      continue;
    }
    if (result.status !== 200) errors.push(issue(url, `HTTP ${result.status} が返りました（200ではありません）`));
    if (result.redirects.length) errors.push(issue(url, `${result.redirects.length}回転送されました。サイトマップには最終URLを載せてください`));
    const html = result.body;
    const scripts = scriptBlocks(html);
    const cleanHtml = removeNonContent(html);
    const metas = metaTags(cleanHtml);
    const links = linkTags(cleanHtml);
    const pageTitle = titleOf(cleanHtml);
    const description = metaContent(metas, 'description');
    titles.push({ url, value: pageTitle });
    descriptions.push({ url, value: description });
    if (!pageTitle) warnings.push(issue(url, 'title がありません'));
    if (!description) warnings.push(issue(url, 'meta description がありません'));
    if (metas.some((tag) => tag['http-equiv']?.toLowerCase() === 'refresh')) errors.push(issue(url, 'meta refresh による転送があります'));
    if (metaContent(metas, 'robots').split(',').some((token) => token.trim().toLowerCase() === 'noindex')) errors.push(issue(url, 'robots に noindex が指定されています'));

    const canonicalTag = links.find((tag) => String(tag.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
    if (!canonicalTag?.href) {
      errors.push(issue(url, 'canonical がありません'));
    } else if (!/^https?:\/\//i.test(canonicalTag.href)) {
      errors.push(issue(url, 'canonical が絶対URLではありません'));
    } else {
      try {
        const canonicalUrl = comparableUrl(canonicalTag.href);
        canonicalByUrl.set(comparableUrl(url), canonicalUrl);
        if (canonicalUrl !== comparableUrl(result.finalUrl)) errors.push(issue(url, 'canonical がこのページ自身を指していません'));
      } catch {
        errors.push(issue(url, 'canonical URL が不正です'));
      }
    }

    for (const script of scripts.filter((item) => item.attrs.type?.toLowerCase() === 'application/ld+json')) {
      try {
        if (!script.body.trim()) throw new Error('空です');
        JSON.parse(script.body);
      } catch (error) {
        errors.push(issue(url, `JSON-LD をJSONとして読めません（${error.message}）`));
      }
    }

    const alternates = links.filter((tag) => tag.rel?.toLowerCase().split(/\s+/).includes('alternate') && tag.hreflang && tag.href);
    for (const tag of alternates) {
      const target = resolveUrl(tag.href, url);
      if (target) hreflangTargets.push({ from: url, url: target.toString(), language: tag.hreflang });
    }

    const ogImage = metaContent(metas, 'og:image', 'property');
    if (!ogImage) {
      warnings.push(issue(url, 'og:image がありません'));
    } else {
      const target = resolveUrl(ogImage, url);
      if (!target) warnings.push(issue(url, 'og:image のURLが不正です'));
      else imageTargets.push({ from: url, url: target.toString() });
    }

    const pageInternalLinks = pageLinks(cleanHtml, url);
    internalLinks.set(url, pageInternalLinks);
    for (const target of pageInternalLinks) {
      const key = comparableUrl(target);
      if (inbound.has(key) && key !== comparableUrl(url)) inbound.get(key).add(url);
    }
  }

  const hreflangPairs = new Set(
    hreflangTargets.map((item) => comparableUrl(item.from) + '\n' + comparableUrl(item.url)),
  );
  const getResource = async (url) => {
    if (!resourceCache.has(url)) resourceCache.set(url, await request(url));
    return resourceCache.get(url);
  };
  const linkChecks = [...new Set([...internalLinks.values()].flat())];
  const linkResults = await mapLimit(linkChecks, CONCURRENCY, async (url) => ({ url, result: await getResource(url) }));
  const linkSources = new Map();
  for (const [source, links] of internalLinks) for (const target of links) {
    if (!linkSources.has(target)) linkSources.set(target, []);
    linkSources.get(target).push(source);
  }
  for (const { url, result } of linkResults) {
    if (result.error || result.status !== 200) {
      for (const from of linkSources.get(url) || []) errors.push(issue(url, `サイト内リンクのリンク先がHTTP ${result.status || '取得失敗'} です`, { from }));
    }
  }

  const hreflangChecks = [...new Map(hreflangTargets.map((item) => [item.url, item])).values()];
  const hreflangResults = await mapLimit(hreflangChecks, CONCURRENCY, async (item) => ({ ...item, result: await getResource(item.url) }));
  for (const item of hreflangResults) {
    if (item.result.error || item.result.status !== 200) errors.push(issue(item.from, `hreflang=${item.language} の相手がHTTP ${item.result.status || '取得失敗'} です: ${item.url}`));
  }

  const imageChecks = [...new Map(imageTargets.map((item) => [item.url, item])).values()];
  const imageResults = await mapLimit(imageChecks, CONCURRENCY, async (item) => ({ ...item, result: await getResource(item.url) }));
  const imageFailures = new Map();
  for (const item of imageResults) if (item.result.error || item.result.status !== 200) imageFailures.set(item.url, item.result);
  for (const item of imageTargets) if (imageFailures.has(item.url)) {
    const result = imageFailures.get(item.url);
    // 同じ画像を使うページごとに、どのページの注意かを残す。
    warnings.push(issue(item.from, `og:image がHTTP ${result.status || '取得失敗'} です: ${item.url}`));
  }

  const titleDuplicates = duplicateWarningsWithoutLocalizedPairs(titles, 'title', hreflangPairs);
  const descriptionDuplicates = duplicateWarningsWithoutLocalizedPairs(descriptions, 'description', hreflangPairs);
  warnings.push(...titleDuplicates.warnings, ...descriptionDuplicates.warnings);

  const alternateLinksByCanonical = new Map();
  for (const links of internalLinks.values()) {
    for (const target of links) {
      const targetKey = comparableUrl(target);
      const canonicalKey = canonicalTargetForLink(target, canonicalByUrl);
      if (canonicalKey === targetKey) continue;
      if (!alternateLinksByCanonical.has(canonicalKey)) {
        alternateLinksByCanonical.set(canonicalKey, new Set());
      }
      alternateLinksByCanonical.get(canonicalKey).add(new URL(target).pathname);
    }
  }
  for (const url of urls) {
    const key = comparableUrl(url);
    if (inbound.get(key)?.size) continue;
    const aliases = [...(alternateLinksByCanonical.get(key) || [])];
    const aliasMessage = aliases.length
      ? '。' + aliases.map((alias) => String.fromCharCode(96) + alias + String.fromCharCode(96)).join('、') + ' へのリンクはある'
      : '';
    warnings.push(issue(url, 'サイトマップにはありますが、サイト内のaリンクからたどれません（孤立ページ' + aliasMessage + '）'));
  }

  const report = {
    generated_at: generatedAt,
    base: base.toString().replace(/\/$/, ''),
    url_count: urls.length,
    error_count: errors.length,
    warning_count: warnings.length,
    localized_title_duplicate_groups: titleDuplicates.localizedGroupCount,
    errors,
    warnings,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, 'latest.md'), renderMarkdown(report));
  const history = path.join(outDir, 'history.csv');
  if (!fs.existsSync(history)) fs.writeFileSync(history, 'date,url_count,error_count,warning_count\n');
  fs.appendFileSync(history, `${generatedAt.slice(0, 10)},${report.url_count},${report.error_count},${report.warning_count}\n`);
  console.log(`site audit: ${report.url_count} URLs, ${report.error_count} errors, ${report.warning_count} warnings`);
  if (report.error_count) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`site audit failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
