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
// 説明文トグルを持つページ（festival/venue/artist）に読み込むスクリプト。
// .bilingual が無いページでは no-op なので副作用なし。
const LANG_TOGGLE_SCRIPT = '\n<script src="/lang-toggle.js?v=1" defer></script>';
// 説明文（desc/bio）をバイリンガル表示する。ja=日本語スロット, en=英語スロット。
// 両方あるときだけ言語トグルを出し、pageLang をデフォルト表示にする（SEO: 既定言語を
// 可視・もう一方は lang 属性付きで hidden → 言語シグナルを濁さない）。片方だけなら従来通り。
function bilingualBody(ja, en, pageLang) {
  const jaT = String(ja || '').trim();
  const enT = String(en || '').trim();
  if (jaT && enT) {
    const hid = (l) => (l === pageLang ? '' : ' hidden');   // 既定言語以外は hidden 属性で隠す
    const act = (l) => (l === pageLang ? ' is-active' : '');
    return `<div class="detail-body bilingual">
      <div class="lang-toggle" role="group" aria-label="${pageLang === 'en' ? 'Description language' : '説明文の言語'}">
        <button type="button" class="lang-btn${act('ja')}" data-lang="ja">日本語</button>
        <button type="button" class="lang-btn${act('en')}" data-lang="en">ENGLISH</button>
      </div>
      <div class="lang-body" data-lang="ja" lang="ja"${hid('ja')}><p>${esc(jaT)}</p></div>
      <div class="lang-body" data-lang="en" lang="en"${hid('en')}><p>${esc(enT)}</p></div>
    </div>`;
  }
  const only = jaT || enT;
  if (!only) return '';
  return `<div class="detail-body"><p lang="${jaT ? 'ja' : 'en'}">${esc(only)}</p></div>`;
}
// 本文中の [[festival:id]] / [[artist:id]] / [[venue:id]] を詳細ページへのリンクに変換
function makeEntityResolver(data) {
  const table = { festival: data.FESTIVALS || [], artist: data.ARTISTS || [], venue: data.VENUES || [], article: data.ARTICLES || [] };
  return (html) => String(html || '').replace(/\[\[(festival|artist|venue|article):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, type, id, label) => {
    const rec = (table[type] || []).find((x) => x.id === id);
    const name = label || (rec && (rec.name || rec.title)) || id;
    const dir = type === 'article' ? 'articles' : type + 's';
    return `<a class="entity-link" href="/${dir}/${id}.html">${esc(name)}</a>`;
  });
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

function navHtml(lang, altHref) {
  // 言語トグル: 対になるページがある時だけ JA / EN を出す
  const toggle = altHref
    ? (lang === 'ja'
        ? `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="${altHref}">EN</a></span>`
        : `<span class="nav-lang"><a href="${altHref}">JA</a><span class="nav-lang-sep">/</span><span class="nav-lang-cur">EN</span></span>`)
    : '';
  return `<nav>
  <a href="/index.html" class="logo">TECHNO JAPAN</a>
  <div class="nav-links">
    <a href="/index.html">TOP</a>
    <a href="/news.html">NEWS</a>
    <a href="/festivals.html">FESTIVALS</a>
    <a href="/artists.html">ARTISTS</a>
    <a href="/venues.html">VENUES</a>
    <a href="/about.html">ABOUT</a>
    ${toggle}
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
}

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

function page({ title, desc, canonical, image, ogType = 'article', jsonLd, body, lang = 'ja', altHref = null, extraScripts = '' }) {
  const d = truncate(desc || '', 160);
  // hreflang: JA/EN 両方が存在するページだけ相互宣言する
  const abs = (path) => `${BASE}${path}`;
  const hreflang = altHref
    ? (lang === 'ja'
        ? `<link rel="alternate" hreflang="ja" href="${esc(canonical)}">\n<link rel="alternate" hreflang="en" href="${esc(abs(altHref))}">\n<link rel="alternate" hreflang="x-default" href="${esc(abs(altHref))}">`
        : `<link rel="alternate" hreflang="en" href="${esc(canonical)}">\n<link rel="alternate" hreflang="ja" href="${esc(abs(altHref))}">\n<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">`)
    : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">

<title>${esc(title)}</title>
<meta name="description" content="${esc(d)}">
<link rel="canonical" href="${esc(canonical)}">
${hreflang}
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#080808">

<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="TECHNO JAPAN">
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(image)}">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@200;300;400;500&family=Space+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<link rel="stylesheet" href="/detail.css?v=2">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${navHtml(lang, altHref)}
${body}
${FOOTER}
${GA}
<script src="/common.js?v=2" defer></script>${extraScripts}
</body>
</html>
`;
}

/* ---------- 記事ページ ---------- */
function articlePage(a, resolveEntities, lang = 'ja') {
  // EN版は title_en / excerpt_en / body_en を使う（無い項目はJAへフォールバック）
  const L = lang === 'en'
    ? { title: a.title_en || a.title, excerpt: a.excerpt_en || a.excerpt, body: a.body_en || a.body, prefix: '/en' }
    : { title: a.title, excerpt: a.excerpt, body: a.body, prefix: '' };
  const hasAlt = lang === 'ja' ? !!(a.title_en || a.body_en) : true;
  const altHref = hasAlt ? (lang === 'ja' ? `/en/articles/${a.id}.html` : `/articles/${a.id}.html`) : null;
  const canonical = `${BASE}${L.prefix}/articles/${a.id}.html`;
  const title = `${L.title} — TECHNO JAPAN`;
  const desc = L.excerpt || truncate(stripTags(L.body), 160);
  const image = absUrl(a.image);
  const tags = (a.tags || []).map((t) => `<span class="article-tag">#${esc(t)}</span>`).join('');
  const authorName = a.author || 'TECHNO JAPAN';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: L.title,
    description: desc,
    image: [image],
    inLanguage: lang,
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

  const heroBlock = a.image
    ? `<header class="article-hero"${ratioAttr(a.heroRatio)}>
        <img src="/${String(a.image).replace(/^\//, '')}" alt="${esc(L.title)}" fetchpriority="high" decoding="async">
        <div class="article-hero-overlay">
          <div class="article-chips"><span class="cat-pill">${esc(a.category || 'NEWS')}</span></div>
          <h1>${esc(L.title)}</h1>
        </div>
      </header>`
    : `<div class="article-meta-top"><span class="cat-pill">${esc(a.category || 'NEWS')}</span></div><h1>${esc(L.title)}</h1>`;

  const body = `<article class="article-detail">
  <div class="article-detail-inner">
    <a class="article-back" href="/news.html"><span class="arrow"></span> ALL STORIES</a>
    ${heroBlock}
    <dl class="article-specs">
      <div><dt>WORDS BY</dt><dd>${esc(a.author || 'TECHNO JAPAN')}</dd></div>
      <div><dt>PUBLISHED</dt><dd>${esc(fmtDate(a.date) || '—')}</dd></div>
      <div><dt>READING TIME</dt><dd>${esc(a.readTime || 5)} MIN</dd></div>
    </dl>
    <div class="article-excerpt">${esc(L.excerpt || '')}</div>
    <div class="article-body">${resolveEntities(L.body || '')}</div>
    <div class="article-footer">
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
      <a class="article-back" href="/news.html" style="margin:0"><span class="arrow"></span> ALL STORIES</a>
    </div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'articles'] : ['articles']), `${a.id}.html`), html: page({ title, desc, canonical, image, jsonLd, body, lang, altHref, extraScripts: '\n<script src="/article-fx.js?v=1" defer></script>' }) };
}

/* ---------- フェスティバルページ ---------- */
function festivalPage(f, artistsById, articles, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/festivals/${f.id}.html`;
  const name = lang === 'en' ? (f.name_en || f.name) : f.name;
  const bodyDesc = lang === 'en' ? (f.desc_en || f.desc) : (f.desc || f.desc_en);
  const canonical = `${BASE}${prefix}/festivals/${f.id}.html`;
  const title = `${name} — TECHNO JAPAN`;
  const dateLabel = fmtFestDate(f.date);
  const place = [f.location, f.city].filter(Boolean).join(', ');
  const desc = bodyDesc || (lang === 'en'
    ? `${name} (${dateLabel}${place ? ' / ' + place : ''}) — dates, lineup and info. Techno & house festivals in Japan.`
    : `${name}（${dateLabel}${place ? ' / ' + place : ''}）の開催情報・ラインナップ。日本のテクノ／ハウスのフェスティバル情報。`);
  const image = absUrl(f.image || f.flyer);

  // このフェスに紐づく記事（ARTICLES.festivalId で関連付け）
  const related = (articles || []).filter((a) => a.festivalId === f.id && a.status !== 'draft');
  const relatedHtml = related.length
    ? `<div class="related-stories"><h2>RELATED STORIES</h2>` + related.map((a) =>
        `<a class="related-story-card" href="${(lang === 'en' && (a.title_en || a.body_en)) ? '/en' : ''}/articles/${a.id}.html">
          ${a.image ? `<img class="related-story-thumb" src="/${String(a.image).replace(/^\//, '')}" alt="" loading="lazy">` : ''}
          <div><div class="related-story-meta">${esc(a.category || 'STORY')} · ${esc(fmtDate(a.date))}</div>
          <div class="related-story-title">${esc(a.title)}</div></div>
        </a>`).join('') + `</div>`
    : '';

  const lineup = (f.lineup || [])
    .map((n) => {
      const a = artistsById.get(String(n).toLowerCase());
      return a ? `<a class="lineup-item" href="${prefix}/artists/${a.id}.html">${esc(lang === 'en' ? (a.name_en || a.name) : a.name)}</a>` : `<span class="lineup-item">${esc(n)}</span>`;
    })
    .join('');

  // EDITIONS（開催回）— data.js の f.editions: [{year, date, lineup[]}]
  const editions = (Array.isArray(f.editions) ? f.editions : [])
    .filter((ed) => ed && ed.year)
    .sort((a, b) => String(b.year).localeCompare(String(a.year)));
  const editionsHtml = editions.length
    ? `<h2>${lang === 'en' ? 'EDITIONS' : '開催ヒストリー'}</h2>` + editions.map((ed) => {
        const edLineup = (ed.lineup || [])
          .map((n) => {
            const a = artistsById.get(String(n).toLowerCase());
            return a ? `<a class="lineup-item" href="${prefix}/artists/${a.id}.html">${esc(lang === 'en' ? (a.name_en || a.name) : a.name)}</a>` : `<span class="lineup-item">${esc(n)}</span>`;
          }).join('');
        return `<section class="edition-block-static">
          <h3 class="edition-year">${esc(String(ed.year))}</h3>
          ${ed.date ? `<div class="detail-eyebrow">${esc(fmtFestDate(ed.date))}</div>` : ''}
          ${edLineup ? `<div class="lineup-list">${edLineup}</div>` : ''}
        </section>`;
      }).join('')
    : '';

  const start = String(f.date || '').split('/')[0];
  const end = String(f.date || '').includes('/') ? String(f.date).split('/')[1] : start;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    name: name,
    description: desc,
    inLanguage: lang,
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
    ...(editions.length ? { subEvent: editions.map((ed) => ({
      '@type': 'Festival',
      name: `${name} ${ed.year}`,
      ...(/^\d{4}-\d{2}-\d{2}/.test(String(ed.date || '')) ? { startDate: String(ed.date).split('/')[0] } : {}),
      location: { '@type': 'Place', name: f.location || f.city || 'Japan' },
    })) } : {}),
  };

  const genres = (Array.isArray(f.genre) ? f.genre : []).map((g) => `<span class="detail-chip">${esc(g)}</span>`).join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="/festivals.html"><span class="arrow"></span> ALL FESTIVALS</a>
    <div class="detail-eyebrow">${esc(dateLabel)}${place ? ' · ' + esc(place) : ''}</div>
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${f.image || f.flyer ? `<div class="detail-hero"><img src="/${String(f.image || f.flyer).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(f.desc, f.desc_en, lang)}
    <dl class="detail-facts">
      <div><dt>${lang === 'en' ? 'DATES' : '開催日'}</dt><dd>${esc(dateLabel)}</dd></div>
      ${f.location ? `<div><dt>${lang === 'en' ? 'VENUE' : '会場'}</dt><dd>${esc(f.location)}</dd></div>` : ''}
      ${f.city ? `<div><dt>${lang === 'en' ? 'AREA' : 'エリア'}</dt><dd>${esc(f.city)}</dd></div>` : ''}
      ${f.address ? `<div><dt>${lang === 'en' ? 'ADDRESS' : '住所'}</dt><dd>${esc(f.address)}</dd></div>` : ''}
      ${f.url ? `<div><dt>${lang === 'en' ? 'OFFICIAL SITE' : '公式サイト'}</dt><dd><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a></dd></div>` : ''}
      ${f.ticketUrl ? `<div><dt>${lang === 'en' ? 'TICKETS' : 'チケット'}</dt><dd><a href="${esc(f.ticketUrl)}" target="_blank" rel="noopener">${lang === 'en' ? 'Buy tickets' : '購入ページ'}</a></dd></div>` : ''}
    </dl>
    ${lineup ? `<h2>LINE UP</h2><div class="lineup-list">${lineup}</div>` : ''}
    ${editionsHtml}${relatedHtml}
    <div class="article-footer"><a class="article-back" href="/festivals.html" style="margin:0"><span class="arrow"></span> ALL FESTIVALS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'festivals'] : ['festivals']), `${f.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd, body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT }) };
}

/* ---------- アーティストページ ---------- */
function artistPage(a, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/artists/${a.id}.html`;
  const name = lang === 'en' ? (a.name_en || a.name) : a.name;
  const bio = lang === 'en' ? (a.bio_en || a.bio) : (a.bio || a.bio_en);
  const canonical = `${BASE}${prefix}/artists/${a.id}.html`;
  const title = `${name} — TECHNO JAPAN`;
  const place = [a.city, a.country].filter(Boolean).join(', ');
  const desc = bio ? truncate(stripTags(bio), 160) : (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — artist profile. Japan's underground techno / house scene.`
    : `${name}${place ? '（' + place + '）' : ''}のプロフィール。日本のアンダーグラウンド・テクノ／ハウスシーンで活動するアーティスト。`);
  const image = absUrl(a.image);
  const links = a.links || {};

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name: name,
    inLanguage: lang,
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
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${a.image ? `<div class="detail-hero detail-hero-portrait"><img src="/${String(a.image).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(a.bio, a.bio_en, lang)}
    ${linkRow ? `<div class="detail-links">${linkRow}</div>` : ''}
    <div class="article-footer"><a class="article-back" href="/artists.html" style="margin:0"><span class="arrow"></span> ALL ARTISTS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'artists'] : ['artists']), `${a.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd, body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT }) };
}

/* ---------- ヴェニューページ ---------- */
function venuePage(v, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/venues/${v.id}.html`;
  const name = lang === 'en' ? (v.name_en || v.name) : v.name;
  const bodyDesc = lang === 'en' ? (v.desc_en || v.desc) : (v.desc || v.desc_en);
  const canonical = `${BASE}${prefix}/venues/${v.id}.html`;
  const title = `${name} — TECHNO JAPAN`;
  const place = [v.area, v.city].filter(Boolean).join(', ');
  const desc = bodyDesc || (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — club / venue guide. Japan's underground dance music.`
    : `${name}${place ? '（' + place + '）' : ''}の基本情報。日本のアンダーグラウンド・ダンスミュージックのクラブ／ヴェニュー。`);
  const image = absUrl(v.image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicVenue',
    name: name,
    inLanguage: lang,
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
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${v.image ? `<div class="detail-hero"><img src="/${String(v.image).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(v.desc, v.desc_en, lang)}
    <dl class="detail-facts">
      ${v.type ? `<div><dt>${lang === 'en' ? 'TYPE' : 'タイプ'}</dt><dd>${esc(v.type)}</dd></div>` : ''}
      ${v.capacity ? `<div><dt>${lang === 'en' ? 'CAPACITY' : 'キャパシティ'}</dt><dd>${esc(v.capacity)}</dd></div>` : ''}
      ${v.address ? `<div><dt>${lang === 'en' ? 'ADDRESS' : '住所'}</dt><dd>${esc(v.address)}</dd></div>` : ''}
      ${v.url ? `<div><dt>${lang === 'en' ? 'OFFICIAL SITE' : '公式サイト'}</dt><dd><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.url)}</a></dd></div>` : ''}
    </dl>
    <div class="article-footer"><a class="article-back" href="/venues.html" style="margin:0"><span class="arrow"></span> ALL VENUES</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'venues'] : ['venues']), `${v.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd, body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT }) };
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

  const resolveEntities = makeEntityResolver({ ARTISTS, FESTIVALS, VENUES, ARTICLES });
  const pubArticles = ARTICLES.filter(valid).filter((a) => a.status !== 'draft');
  const pubFests = FESTIVALS.filter(valid);
  const pubArtists = ARTISTS.filter(valid);
  const pubVenues = VENUES.filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined');

  // ID変更に伴う旧URLのリダイレクトスタブ（writeAll の掃除で消されないよう wanted に含める）
  // { dir: { oldId: newId } }
  const REDIRECTS = {
    articles: { transcendence: 'transcendence-2025-report' },
  };
  const redirectStubs = (dirName) =>
    Object.entries(REDIRECTS[dirName] || {}).map(([oldId, newId]) => {
      const to = `/${dirName}/${newId}.html`;
      return {
        file: path.join(LP_DIR, dirName, `${oldId}.html`),
        html: `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<title>Redirecting…</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${BASE}${to}">
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>Moved: <a href="${to}">${BASE}${to}</a></p></body></html>
`,
      };
    });

  const counts = {
    articles: writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'ja')).concat(redirectStubs('articles')), 'articles'),
    festivals: writeAll(pubFests.map((f) => festivalPage(f, artistsById, ARTICLES, 'ja')), 'festivals'),
    artists: writeAll(pubArtists.map((a) => artistPage(a, 'ja')), 'artists'),
    venues: writeAll(pubVenues.map((v) => venuePage(v, 'ja')), 'venues'),
    // 英語版（/en/…）。記事は英訳がある時だけ生成する
    'en/articles': writeAll(pubArticles.filter((a) => a.title_en || a.body_en).map((a) => articlePage(a, resolveEntities, 'en')), 'en/articles'),
    'en/festivals': writeAll(pubFests.map((f) => festivalPage(f, artistsById, ARTICLES, 'en')), 'en/festivals'),
    'en/artists': writeAll(pubArtists.map((a) => artistPage(a, 'en')), 'en/artists'),
    'en/venues': writeAll(pubVenues.map((v) => venuePage(v, 'en')), 'en/venues'),
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
