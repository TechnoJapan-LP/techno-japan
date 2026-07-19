#!/usr/bin/env node
/**
 * 個別詳細ページ（実URL）を data.js から生成する。
 *
 * なぜ必要か:
 *   これまで詳細ページは `news.html#article/xxx` のようなハッシュURLだけだった。
 *   Google はハッシュ以降を別ページとして扱わないため、記事もフェスも
 *   アーティストも「1ページ」としてしか認識されず、個別に検索結果へ出なかった。
 *   ここで実URL（/articles/xxx.html 等）の静的ページを生成して初めて
 *   インデックス対象になる。
 *
 * 出力:
 *   LP/articles/<id>.html
 *   LP/festivals/<id>.html
 *   LP/artists/<id>.html
 *   LP/venues/<id>.html
 *
 * 使い方: node scripts/build-detail-pages.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LP_DIR = path.join(__dirname, '..', 'LP');
const DATA_PATH = path.join(LP_DIR, 'data.js');
const BASE = 'https://techno-japan.media';
const DEFAULT_OG = `${BASE}/images/festivals/rainbow-disco-club.webp`;

/* ---------- data.js を読み込む ---------- */
function loadData() {
  const src = fs.readFileSync(DATA_PATH, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  new vm.Script(src + '\n;globalThis.__out = { ARTISTS, EVENTS, FESTIVALS, VENUES, ARTICLES };').runInContext(ctx);
  return ctx.__out;
}

/* ---------- ユーティリティ ---------- */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// 本文HTMLからタグを除いて説明文を作る（meta description 用）
const stripTags = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const absUrl = (img) => {
  if (!img) return DEFAULT_OG;
  return String(img).startsWith('http') ? String(img) : `${BASE}/${String(img).replace(/^\//, '')}`;
};


// CMS で指定した表示比率を data 属性 + inline style にする。未指定なら何も出さず既定のCSSが効く。
function ratioAttr(r) {
  const v = String(r || '').trim();
  if (!v) return '';
  if (v === 'auto') return ' data-ratio="auto"';
  if (!/^\d+:\d+$/.test(v)) return '';
  return ` data-ratio="${v}" style="aspect-ratio:${v.replace(':', '/')}"`;
}
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('/')[0].split('-').map(Number);
  if (!y || !m || !day) return '';
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
function fmtFestDate(d) {
  if (!d) return 'DATE TBA';
  const s = String(d);
  if (s.includes('/')) {
    const [start, end] = s.split('/');
    const [sy, sm, sd] = start.split('-').map(Number);
    const ed = end.split('-').map(Number)[2];
    if (!sy || !sm || !sd) return 'DATE TBA';
    return `${MONTHS[sm - 1]} ${sd} — ${ed}, ${sy}`;
  }
  return fmtDate(s) || 'DATE TBA';
}

/* ---------- 共通のページ骨格 ---------- */
const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net; frame-src 'self' https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`;

const NAV = `<nav>
  <a href="/index.html" class="logo">TECHNO JAPAN</a>
  <div class="nav-links">
    <a href="/index.html">TOP</a>
    <a href="/news.html">NEWS</a>
    <a href="/festivals.html">FESTIVALS</a>
    <a href="/artists.html">ARTISTS</a>
    <a href="/venues.html">VENUES</a>
    <a href="/about.html">ABOUT</a>
  </div>
  <button class="nav-hamburger" aria-label="Open menu" onclick="document.querySelector('.nav-overlay').classList.toggle('active');this.classList.toggle('active')"><span></span><span></span><span></span></button>
</nav>
<div class="nav-overlay">
  <button class="nav-close" aria-label="Close menu" onclick="document.querySelector('.nav-overlay').classList.remove('active');document.querySelector('.nav-hamburger').classList.remove('active')"></button>
  <a href="/index.html">TOP</a>
  <a href="/news.html">NEWS</a>
  <a href="/festivals.html">FESTIVALS</a>
  <a href="/artists.html">ARTISTS</a>
  <a href="/venues.html">VENUES</a>
  <a href="/about.html">ABOUT</a>
</div>`;

const FOOTER = `<footer>
  <div class="footer-top">
    <div class="footer-logo">TECHNO JAPAN</div>
    <div class="footer-links">
      <a href="/index.html">TOP</a>
      <a href="/news.html">NEWS</a>
      <a href="/festivals.html">FESTIVALS</a>
      <a href="/artists.html">ARTISTS</a>
      <a href="/venues.html">VENUES</a>
      <a href="/about.html">ABOUT</a>
    </div>
    <div class="footer-copy">&copy; 2025 TECHNO JAPAN. ALL RIGHTS RESERVED.</div>
  </div>
</footer>`;

const GA = `<script>
(function(){
  if (navigator.webdriver) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-4MHCNR7D26';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-4MHCNR7D26');
})();
</script>`;

function page({ title, desc, canonical, image, ogType = 'article', jsonLd, body }) {
  const d = truncate(desc || '', 160);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">

<title>${esc(title)}</title>
<meta name="description" content="${esc(d)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#080808">

<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="TECHNO JAPAN">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(image)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@200;300;400;500&family=Space+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<link rel="stylesheet" href="/detail.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${NAV}
${body}
${FOOTER}
${GA}
</body>
</html>
`;
}

/* ---------- 記事ページ ---------- */
function articlePage(a) {
  const canonical = `${BASE}/articles/${a.id}.html`;
  const title = `${a.title} — TECHNO JAPAN`;
  const desc = a.excerpt || truncate(stripTags(a.body), 160);
  const image = absUrl(a.image);
  const tags = (a.tags || []).map((t) => `<span class="article-tag">#${esc(t)}</span>`).join('');
  const authorName = a.author || 'TECHNO JAPAN';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title,
    description: desc,
    image: [image],
    datePublished: a.date,
    dateModified: a.updated || a.date,
    author: { '@type': /TECHNO JAPAN/i.test(authorName) ? 'Organization' : 'Person', name: authorName },
    publisher: {
      '@type': 'Organization',
      name: 'TECHNO JAPAN',
      url: `${BASE}/`,
      logo: { '@type': 'ImageObject', url: DEFAULT_OG },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: a.category || 'NEWS',
    url: canonical,
  };

  const body = `<article class="article-detail">
  <div class="article-detail-inner">
    <a class="article-back" href="/news.html"><span class="arrow"></span> ALL STORIES</a>
    <div class="article-meta-top">
      <span class="cat-pill">${esc(a.category || 'NEWS')}</span>
      <span>${esc(fmtDate(a.date))}</span>
      <span>${esc(a.readTime || 5)} MIN READ</span>
      ${a.author ? `<span>BY ${esc(a.author)}</span>` : ''}
    </div>
    <h1>${esc(a.title)}</h1>
    <div class="article-excerpt">${esc(a.excerpt || '')}</div>
    ${a.image ? `<div class="article-hero-img"${ratioAttr(a.heroRatio)}><img src="/${String(a.image).replace(/^\//, '')}" alt="${esc(a.title)}"></div>` : ''}
    <div class="article-body">${a.body || ''}</div>
    <div class="article-footer">
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
      <a class="article-back" href="/news.html" style="margin:0"><span class="arrow"></span> ALL STORIES</a>
    </div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, 'articles', `${a.id}.html`), html: page({ title, desc, canonical, image, jsonLd, body }) };
}

/* ---------- フェスティバルページ ---------- */
function festivalPage(f, artistsById) {
  const canonical = `${BASE}/festivals/${f.id}.html`;
  const title = `${f.name} — TECHNO JAPAN`;
  const dateLabel = fmtFestDate(f.date);
  const place = [f.location, f.city].filter(Boolean).join(', ');
  const desc = f.desc || `${f.name}（${dateLabel}${place ? ' / ' + place : ''}）の開催情報・ラインナップ。日本のテクノ／ハウスのフェスティバル情報。`;
  const image = absUrl(f.image || f.flyer);

  const lineup = (f.lineup || [])
    .map((n) => {
      const a = artistsById.get(String(n).toLowerCase());
      return a ? `<a class="lineup-item" href="/artists/${a.id}.html">${esc(a.name)}</a>` : `<span class="lineup-item">${esc(n)}</span>`;
    })
    .join('');

  const start = String(f.date || '').split('/')[0];
  const end = String(f.date || '').includes('/') ? String(f.date).split('/')[1] : start;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    name: f.name,
    description: desc,
    image: [image],
    ...(start ? { startDate: start, endDate: end } : {}),
    url: canonical,
    ...(f.url ? { sameAs: f.url } : {}),
    location: {
      '@type': 'Place',
      name: f.location || f.city || 'Japan',
      address: { '@type': 'PostalAddress', addressLocality: f.city || '', addressCountry: 'JP', ...(f.address ? { streetAddress: f.address } : {}) },
      ...(f.lat && f.lng ? { geo: { '@type': 'GeoCoordinates', latitude: f.lat, longitude: f.lng } } : {}),
    },
    ...(f.lineup && f.lineup.length ? { performer: f.lineup.map((n) => ({ '@type': 'MusicGroup', name: String(n) })) } : {}),
  };

  const genres = (Array.isArray(f.genre) ? f.genre : []).map((g) => `<span class="detail-chip">${esc(g)}</span>`).join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="/festivals.html"><span class="arrow"></span> ALL FESTIVALS</a>
    <div class="detail-eyebrow">${esc(dateLabel)}${place ? ' · ' + esc(place) : ''}</div>
    <h1>${esc(f.name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${f.image || f.flyer ? `<div class="detail-hero"><img src="/${String(f.image || f.flyer).replace(/^\//, '')}" alt="${esc(f.name)}"></div>` : ''}
    ${f.desc ? `<div class="detail-body"><p>${esc(f.desc)}</p></div>` : ''}
    <dl class="detail-facts">
      <div><dt>開催日</dt><dd>${esc(dateLabel)}</dd></div>
      ${f.location ? `<div><dt>会場</dt><dd>${esc(f.location)}</dd></div>` : ''}
      ${f.city ? `<div><dt>エリア</dt><dd>${esc(f.city)}</dd></div>` : ''}
      ${f.address ? `<div><dt>住所</dt><dd>${esc(f.address)}</dd></div>` : ''}
      ${f.url ? `<div><dt>公式サイト</dt><dd><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a></dd></div>` : ''}
      ${f.ticketUrl ? `<div><dt>チケット</dt><dd><a href="${esc(f.ticketUrl)}" target="_blank" rel="noopener">購入ページ</a></dd></div>` : ''}
    </dl>
    ${lineup ? `<h2>LINE UP</h2><div class="lineup-list">${lineup}</div>` : ''}
    <div class="article-footer"><a class="article-back" href="/festivals.html" style="margin:0"><span class="arrow"></span> ALL FESTIVALS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, 'festivals', `${f.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd, body }) };
}

/* ---------- アーティストページ ---------- */
function artistPage(a) {
  const canonical = `${BASE}/artists/${a.id}.html`;
  const title = `${a.name} — TECHNO JAPAN`;
  const place = [a.city, a.country].filter(Boolean).join(', ');
  const desc = a.bio ? truncate(stripTags(a.bio), 160) : `${a.name}${place ? '（' + place + '）' : ''}のプロフィール。日本のアンダーグラウンド・テクノ／ハウスシーンで活動するアーティスト。`;
  const image = absUrl(a.image);
  const links = a.links || {};

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: a.name,
    description: desc,
    ...(a.image ? { image: [image] } : {}),
    url: canonical,
    ...(place ? { location: { '@type': 'Place', name: place } } : {}),
    ...(Array.isArray(a.genre) && a.genre.length ? { genre: a.genre } : {}),
    ...(Object.values(links).filter(Boolean).length ? { sameAs: Object.values(links).filter(Boolean) } : {}),
  };

  const genres = (Array.isArray(a.genre) ? a.genre : String(a.genre || '').split('/').filter(Boolean))
    .map((g) => `<span class="detail-chip">${esc(String(g).trim())}</span>`).join('');

  const linkRow = Object.entries(links)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a class="detail-link" href="${esc(v)}" target="_blank" rel="noopener">${esc(k.toUpperCase())}</a>`)
    .join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="/artists.html"><span class="arrow"></span> ALL ARTISTS</a>
    ${place ? `<div class="detail-eyebrow">${esc(place)}</div>` : ''}
    <h1>${esc(a.name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${a.image ? `<div class="detail-hero detail-hero-portrait"><img src="/${String(a.image).replace(/^\//, '')}" alt="${esc(a.name)}"></div>` : ''}
    ${a.bio ? `<div class="detail-body"><p>${esc(a.bio)}</p></div>` : ''}
    ${linkRow ? `<div class="detail-links">${linkRow}</div>` : ''}
    <div class="article-footer"><a class="article-back" href="/artists.html" style="margin:0"><span class="arrow"></span> ALL ARTISTS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, 'artists', `${a.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd, body }) };
}

/* ---------- ヴェニューページ ---------- */
function venuePage(v) {
  const canonical = `${BASE}/venues/${v.id}.html`;
  const title = `${v.name} — TECHNO JAPAN`;
  const place = [v.area, v.city].filter(Boolean).join(', ');
  const desc = v.desc || `${v.name}${place ? '（' + place + '）' : ''}の基本情報。日本のアンダーグラウンド・ダンスミュージックのクラブ／ヴェニュー。`;
  const image = absUrl(v.image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicVenue',
    name: v.name,
    description: desc,
    ...(v.image ? { image: [image] } : {}),
    url: canonical,
    ...(v.url ? { sameAs: v.url } : {}),
    address: { '@type': 'PostalAddress', addressLocality: v.city || '', addressCountry: 'JP', ...(v.address ? { streetAddress: v.address } : {}) },
    ...(v.lat && v.lng ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}),
    ...(v.capacity ? { maximumAttendeeCapacity: v.capacity } : {}),
  };

  const genres = (Array.isArray(v.genre) ? v.genre : String(v.genre || '').split('/').filter(Boolean))
    .map((g) => `<span class="detail-chip">${esc(String(g).trim())}</span>`).join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="/venues.html"><span class="arrow"></span> ALL VENUES</a>
    ${place ? `<div class="detail-eyebrow">${esc(place)}</div>` : ''}
    <h1>${esc(v.name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${v.image ? `<div class="detail-hero"><img src="/${String(v.image).replace(/^\//, '')}" alt="${esc(v.name)}"></div>` : ''}
    ${v.desc ? `<div class="detail-body"><p>${esc(v.desc)}</p></div>` : ''}
    <dl class="detail-facts">
      ${v.type ? `<div><dt>タイプ</dt><dd>${esc(v.type)}</dd></div>` : ''}
      ${v.capacity ? `<div><dt>キャパシティ</dt><dd>${esc(v.capacity)}</dd></div>` : ''}
      ${v.address ? `<div><dt>住所</dt><dd>${esc(v.address)}</dd></div>` : ''}
      ${v.url ? `<div><dt>公式サイト</dt><dd><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.url)}</a></dd></div>` : ''}
    </dl>
    <div class="article-footer"><a class="article-back" href="/venues.html" style="margin:0"><span class="arrow"></span> ALL VENUES</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, 'venues', `${v.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd, body }) };
}

/* ---------- 実行 ---------- */
function writeAll(pages, dirName) {
  const dir = path.join(LP_DIR, dirName);
  fs.mkdirSync(dir, { recursive: true });

  // 中身が変わったファイルだけ書く。
  // 毎回「全削除→全書き直し」にすると、iCloud/Drive 同期下では大量の書き込みが
  // 競合コピー（"foo 2.html"）を生む。差分だけ触れば通常は書き込み0件で済む。
  const wanted = new Map(pages.map((p) => [path.basename(p.file), p]));
  let written = 0;

  for (const [name, p] of wanted) {
    const cur = fs.existsSync(p.file) ? fs.readFileSync(p.file, 'utf8') : null;
    if (cur !== p.html) { fs.writeFileSync(p.file, p.html); written++; }
  }

  // データから消えたページは削除する（同期が作った重複コピーもここで掃除される）
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    if (!wanted.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }

  return { total: pages.length, written, removed };
}

function main() {
  const { ARTISTS = [], FESTIVALS = [], VENUES = [], ARTICLES = [] } = loadData();

  const artistsById = new Map();
  for (const a of ARTISTS) {
    if (a.id) artistsById.set(String(a.name || '').toLowerCase(), a);
  }

  const valid = (x) => x && x.id && String(x.id).trim();

  const counts = {
    articles: writeAll(ARTICLES.filter(valid).filter((a) => a.status !== 'draft').map(articlePage), 'articles'),
    festivals: writeAll(FESTIVALS.filter(valid).map((f) => festivalPage(f, artistsById)), 'festivals'),
    artists: writeAll(ARTISTS.filter(valid).map(artistPage), 'artists'),
    venues: writeAll(VENUES.filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined').map(venuePage), 'venues'),
  };

  console.log('Detail pages:');
  let total = 0, written = 0, removed = 0;
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v.total} pages (updated ${v.written}, removed ${v.removed})`);
    total += v.total; written += v.written; removed += v.removed;
  }
  console.log(`  total: ${total} pages — ${written} written, ${removed} removed`);
}

main();
