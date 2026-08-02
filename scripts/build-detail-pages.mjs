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
import { imageSizeAttrs } from './lib/image-size.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LP_DIR = path.join(__dirname, '..', 'LP');
const DATA_PATH = path.join(LP_DIR, 'data.js');
const EDITIONS_PATH = path.join(LP_DIR, 'data', 'editions.json');
const LINEUPS_PATH = path.join(LP_DIR, 'data', 'lineups.json');
const IMAGE_DIMENSIONS_PATH = path.join(LP_DIR, 'image-dimensions.json');
const BASE = 'https://techno-japan.media';

// 詳細ページとハブのJSテンプレートが同じ最新寸法を参照できるよう、
// ページ生成のたびに実画像から派生メタデータを先に再生成する。
await import('./build-image-dimensions.mjs');
// ブランドロゴ（Organization.logo 用）と OGP フォールバック画像は役割が違うので分ける。
// ロゴは正方形のブランド識別子、OGP は SNS カード向けの横長ビジュアル。
// ロゴを差し替えるときはこのパスのファイルを置き換えるだけでよい（URL は変えない）。
const ORG_LOGO = `${BASE}/images/logo-512.png`;
const DEFAULT_OG = `${BASE}/images/festivals/rainbow-disco-club.webp`;

// ID 規約違反(DATA_SCHEMA §1.1)の是正に伴う旧ID→新ID。JA/EN 双方で使う。
// 一度発行したIDは変更しない原則の例外で、一括登録時に ID 欄へ NAME を
// そのまま貼ってしまった分。旧URLは %20 入りで配信されていた。
const ARTIST_ID_FIXES = {
  'Acid Pauli': 'acid-pauli',
  'Alabaster DePlume': 'alabaster-deplume',
  'Juana Molina': 'juana-molina',
  'Kiko Dinucci': 'kiko-dinucci',
  'Kuo from Sunset Rollercoaster': 'kuo-from-sunset-rollercoaster',
  'Sylvan Esso': 'sylvan-esso',
  'The Master Musicians of Joujouka': 'the-master-musicians-of-joujouka',
};

/* ---------- data.js を読み込む ---------- */
function loadData() {
  const src = fs.readFileSync(DATA_PATH, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  new vm.Script(src + '\n;globalThis.__out = { ARTISTS, EVENTS, FESTIVALS, VENUES, ARTICLES };').runInContext(ctx);
  return ctx.__out;
}

function loadItems(file, label) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.items)) throw new Error(`${label}: items 配列がありません`);
  if (Number.isFinite(data.count) && data.count !== data.items.length) {
    throw new Error(`${label}: count=${data.count} と items=${data.items.length} が一致しません`);
  }
  return data.items;
}

/* ---------- ユーティリティ ---------- */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// 本文HTMLからタグを除いて説明文を作る（meta description 用）
const stripTags = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// パンくずJSON-LD（検索結果に「TECHNO JAPAN › FESTIVALS › 名前」のパスを出す）
function breadcrumbLd(sectionLabel, sectionPath, name, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TECHNO JAPAN', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: sectionLabel, item: BASE + sectionPath },
      { '@type': 'ListItem', position: 3, name: String(name), item: canonical },
    ],
  };
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// primary は既存互換の値。言語別値が未入力なら primary、さらに反対言語へ
// フォールバックし、列追加直後でも表示を欠落させない。
function localizedValue(primary, ja, en, lang) {
  const values = {
    primary: String(primary || '').trim(),
    ja: String(ja || '').trim(),
    en: String(en || '').trim(),
  };
  return lang === 'en'
    ? (values.en || values.primary || values.ja)
    : (values.ja || values.primary || values.en);
}

function loadImageDimensions() {
  if (!fs.existsSync(IMAGE_DIMENSIONS_PATH)) throw new Error('image-dimensions.json がありません。先に node scripts/build-image-dimensions.mjs を実行してください');
  return JSON.parse(fs.readFileSync(IMAGE_DIMENSIONS_PATH, 'utf8'));
}
let IMAGE_DIMENSIONS = {};
function dimensionAttrs(source) {
  const key = String(source || '').split(/[?#]/)[0].replace(/^\/+/, '');
  const size = IMAGE_DIMENSIONS[String(source || '').split(/[?#]/)[0]] || IMAGE_DIMENSIONS[key];
  return size ? `width="${size[0]}" height="${size[1]}"` : imageSizeAttrs(LP_DIR, source);
}
function addHtmlImageDimensions(html) {
  return String(html || '').replace(/<img\b(?![^>]*\bwidth=)([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (tag, before, quote, src, after) => {
    const attrs = dimensionAttrs(src);
    if (!attrs) throw new Error(`画像寸法メタデータがありません: ${src}`);
    return `<img ${attrs}${before}src=${quote}${src}${quote}${after}>`;
  });
}

/* ---------- 回遊導線（ページ間の相互リンク）。main() が索引をセットする ---------- */
let XLINK = { fests: [], venues: [], appearMap: new Map() };
function relatedChips(items, dir, lang) {
  const prefix = lang === 'en' ? '/en' : '';
  return `<div class="lineup-list">` + items.map((x) =>
    `<a class="lineup-item" href="${prefix}/${dir}/${x.id}.html">${esc(lang === 'en' ? (x.name_en || x.name) : x.name)}</a>`
  ).join('') + `</div>`;
}

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
const FESTIVAL_HUB_BACK_SCRIPT = `
<script>
function bindFestivalHubBackLinks() {
  document.querySelectorAll('[data-festival-hub-back]').forEach((link) => {
    link.addEventListener('click', (event) => {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin && referrer.pathname === link.dataset.festivalHubBack) {
          event.preventDefault();
          history.back();
        }
      } catch (_) {}
    });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFestivalHubBackLinks, { once: true });
} else {
  bindFestivalHubBackLinks();
}
</script>`;
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

/* 詳細ページの nav。EN ページでは EN 版が実在するリンク先だけ /en/ へ向ける。
   EN_PAGES に無いもの（index.html）は JA のままにして 404 を作らない。
   これを入れる前は EN 詳細206枚の nav が全て JA を指しており、
   英語ユーザーはどこを押しても日本語ページに出てしまっていた。 */
function navLink(lang, page) {
  return (lang === 'en' && EN_PAGES.has(page)) ? `/en/${page}` : `/${page}`;
}

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
    <a href="${navLink(lang, 'index.html')}">TOP</a>
    <a href="${navLink(lang, 'news.html')}">NEWS</a>
    <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
    <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
    <a href="${navLink(lang, 'venues.html')}">VENUES</a>
    <a href="${navLink(lang, 'about.html')}">ABOUT</a>
    ${toggle}
  </div>
  <button class="nav-hamburger" aria-label="Open menu" onclick="document.querySelector('.nav-overlay').classList.toggle('active');this.classList.toggle('active')"><span></span><span></span><span></span></button>
</nav>
<div class="nav-overlay">
  <button class="nav-close" aria-label="Close menu" onclick="document.querySelector('.nav-overlay').classList.remove('active');document.querySelector('.nav-hamburger').classList.remove('active')"></button>
  <a href="${navLink(lang, 'index.html')}">TOP</a>
  <a href="${navLink(lang, 'news.html')}">NEWS</a>
  <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
  <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
  <a href="${navLink(lang, 'venues.html')}">VENUES</a>
  <a href="${navLink(lang, 'about.html')}">ABOUT</a>
</div>`;
}

function footerHtml(lang) {
  const submissionHref = lang === 'en' ? '/en/submit.html' : '/submit.html';
  const submissionLabel = lang === 'en' ? 'Festival Submission' : 'FESTIVAL 掲載申請';
  return `<footer>
  <div class="footer-top">
    <div class="footer-logo">TECHNO JAPAN</div>
    <div class="footer-links">
      <a href="${navLink(lang, 'index.html')}">TOP</a>
      <a href="${navLink(lang, 'news.html')}">NEWS</a>
      <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
      <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
      <a href="${navLink(lang, 'venues.html')}">VENUES</a>
      <a href="${navLink(lang, 'about.html')}">ABOUT</a>
      <a href="${submissionHref}">${submissionLabel}</a>
    </div>
    <div class="footer-copy">&copy; 2025 TECHNO JAPAN. ALL RIGHTS RESERVED.</div>
  </div>
</footer>`;
}

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
<link rel="stylesheet" href="/common.css?v=3">
<link rel="stylesheet" href="/detail.css?v=3">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${navHtml(lang, altHref)}
${body}
${footerHtml(lang)}
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
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: a.category || 'NEWS',
    // SPA(news.html) は動的注入で keywords を出していたが、静的ページ側が
    // 欠けていた。JS を実行しないクローラーには SPA の注入が届かないため、
    // A5（共有URLがハッシュ版）と同じ「SPAだけ対応済み」の取りこぼし。
    // 出力形式は SPA と揃える（カンマ区切り文字列・空なら省略）。
    ...(Array.isArray(a.tags) && a.tags.length
      ? { keywords: a.tags.join(', ') }
      : {}),
    url: canonical,
  };

  const heroBlock = a.image
    ? `<header class="article-hero"${ratioAttr(a.heroRatio)}>
        <img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}" alt="${esc(L.title)}" fetchpriority="high" decoding="async">
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
    <div class="article-body">${addHtmlImageDimensions(resolveEntities(L.body || ''))}</div>
    <div class="article-footer">
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
      <a class="article-back" href="/news.html" style="margin:0"><span class="arrow"></span> ALL STORIES</a>
    </div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'articles'] : ['articles']), `${a.id}.html`), html: page({ title, desc, canonical, image, jsonLd: [jsonLd, breadcrumbLd('NEWS', '/news.html', a.title, canonical)], body, lang, altHref, extraScripts: '\n<link rel="stylesheet" href="/article-fx.css?v=1">\n<script src="/article-fx.js?v=2" defer></script>' }) };
}

/* ---------- フェスティバルページ ---------- */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function editionLocationName(ed, lang) {
  return localizedValue(ed.LOCATION, ed.LOCATION_JA, ed.LOCATION_EN, lang);
}

function editionPlace(ed, lang) {
  return [editionLocationName(ed, lang), ed.PREF].filter(Boolean).join(', ');
}

function editionLocationLd(ed, lang) {
  return {
    '@type': 'Place',
    name: editionLocationName(ed, lang) || ed.PREF || 'Japan',
    address: {
      '@type': 'PostalAddress',
      addressRegion: ed.PREF || '',
      addressCountry: 'JP',
      ...(ed.ADDRESS ? { streetAddress: ed.ADDRESS } : {}),
    },
    ...(ed.LAT && ed.LNG ? {
      geo: { '@type': 'GeoCoordinates', latitude: ed.LAT, longitude: ed.LNG },
    } : {}),
  };
}

function editionStatusLd(status) {
  const values = {
    announced: 'EventScheduled',
    'on-sale': 'EventScheduled',
    soldout: 'EventScheduled',
    finished: 'EventScheduled',
    cancelled: 'EventCancelled',
  };
  const value = values[String(status || '').trim().toLowerCase()];
  return value ? `https://schema.org/${value}` : null;
}

function editionDateHtml(ed, lang) {
  const start = String(ed.DATE_START || '');
  const end = String(ed.DATE_END || '');
  const startHtml = ISO_DATE.test(start) ? `<time datetime="${start}">${esc(start)}</time>` : esc(start);
  if (!end || end === start) return startHtml;
  const endHtml = ISO_DATE.test(end) ? `<time datetime="${end}">${esc(end)}</time>` : esc(end);
  return `${startHtml}<span class="edition-date-sep" aria-label="${lang === 'en' ? 'to' : 'から'}"> — </span>${endHtml}`;
}

function editionsTable(editions, lang) {
  if (!editions.length) return '';
  const rows = editions.map((ed) => `<tr>
      <th scope="row">${esc(ed.EDITION || ed.EDITION_ID)}</th>
      <td class="edition-date">${editionDateHtml(ed, lang)}</td>
      <td>${esc(editionPlace(ed, lang) || '—')}</td>
      <td>${esc(ed.STATUS || '—')}</td>
      <td>${ed.TICKETURL ? `<a href="${esc(ed.TICKETURL)}" target="_blank" rel="noopener">${lang === 'en' ? 'Tickets' : 'チケット'}</a>` : '—'}</td>
    </tr>`).join('\n');
  return `<h2>${lang === 'en' ? 'EDITIONS' : '開催ヒストリー'}</h2>
  <div class="editions-table-wrap">
    <table class="editions-table">
      <caption>${lang === 'en' ? 'Festival edition history' : 'フェスティバル開催履歴'}</caption>
      <thead><tr>
        <th scope="col">${lang === 'en' ? 'EDITION' : '開催回'}</th>
        <th scope="col">${lang === 'en' ? 'DATES' : '日程'}</th>
        <th scope="col">${lang === 'en' ? 'VENUE' : '会場'}</th>
        <th scope="col">STATUS</th>
        <th scope="col">${lang === 'en' ? 'LINK' : 'リンク'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function lineupArtistIds(row) {
  const value = row.ARTIST_IDS || row.ARTIST_ID || [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
}

// 新列へ移行するまでの安全側フォールバック。ACT_LABELは分割せず、
// 複合の可能性がある枠をリンク/performer対象から丸ごと除外する。
function isCompositeLineup(row) {
  const ids = lineupArtistIds(row);
  return ids.length > 1 || !!String(row.JOIN_TYPE || '').trim() ||
    String(row.SET_TYPE || '').trim().toLowerCase() === 'b2b' ||
    (!ids.length && /\s&\s/.test(String(row.ACT_LABEL || '')));
}

function lineupEntity(row, artistsById, lang) {
  if (isCompositeLineup(row)) return null;
  const id = lineupArtistIds(row)[0];
  if (!id) return null;
  const artist = artistsById.get(id);
  if (!artist) throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  return {
    '@type': artistSchemaType(artist),
    '@id': artistEntityId(id),
    name: lang === 'en' ? (artist.name_en || artist.name) : artist.name,
    url: `${BASE}/artists/${encodeURIComponent(id)}.html`,
  };
}

function lineupSlotHtml(row, artistsById, lang) {
  if (isCompositeLineup(row)) return `<span class="lineup-item" data-lineup-slot data-lineup-composite>${esc(row.ACT_LABEL || '')}</span>`;
  const id = lineupArtistIds(row)[0];
  if (!id) return `<span class="lineup-item" data-lineup-slot>${esc(row.ACT_LABEL || '')}</span>`;
  const artist = artistsById.get(id);
  if (!artist) throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  const prefix = lang === 'en' ? '/en' : '';
  const name = lang === 'en' ? (artist.name_en || artist.name) : artist.name;
  return `<a class="lineup-item" data-lineup-slot data-lineup-artist="${esc(id)}" href="${prefix}/artists/${encodeURIComponent(id)}.html">${esc(name)}</a>`;
}

function festivalLineupsHtml(editions, lineupsByEdition, artistsById, lang) {
  const groups = editions.map((ed) => ({ ed, rows: lineupsByEdition.get(ed.EDITION_ID) || [] }))
    .filter((group) => group.rows.length);
  if (!groups.length) return '';
  const body = groups.map(({ ed, rows }) => {
    const slots = [...rows]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
      .map((row) => lineupSlotHtml(row, artistsById, lang)).join('');
    return groups.length > 1
      ? `<section class="edition-lineup"><h3>${esc(ed.EDITION || ed.EDITION_ID)}</h3><div class="lineup-list">${slots}</div></section>`
      : `<div class="lineup-list">${slots}</div>`;
  }).join('');
  return `<section class="festival-lineups"><h2>LINE UP</h2>${body}</section>`;
}

function festivalDateText(ed, lang) {
  const start = String(ed?.DATE_START || '');
  const end = String(ed?.DATE_END || '');
  if (!ISO_DATE.test(start)) return '';
  const format = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return lang === 'en'
      ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
      : `${year}年${month}月${day}日`;
  };
  if (!ISO_DATE.test(end) || end === start) return format(start);
  return lang === 'en' ? `${format(start)} to ${format(end)}` : `${format(start)}から${format(end)}`;
}

function festivalAreaText(festival, edition, lang) {
  const parts = [edition?.PREF, festival.city]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);
  return lang === 'en' ? parts.reverse().join(', ') : parts.join('');
}

function festivalGenreText(festival, lang) {
  const genres = (Array.isArray(festival.genre) ? festival.genre : String(festival.genre || '').split('/'))
    .map((genre) => String(genre).trim())
    .filter(Boolean);
  if (!genres.length) return '';
  return lang === 'en' ? genres.join(' / ').toLowerCase() : genres.join('／');
}

function festivalSummary(festival, edition, name, lang) {
  const area = festivalAreaText(festival, edition, lang);
  const genre = festivalGenreText(festival, lang);
  const date = festivalDateText(edition, lang);
  const venue = edition ? editionLocationName(edition, lang) : '';
  if (lang === 'en') {
    const kind = genre ? `${genre} festival` : (festival.type === 'rave' ? 'rave' : 'festival');
    const first = `${name} is a ${kind}${area ? ` held in ${area}` : ''}.`;
    const second = date ? `The latest listed edition is ${date}${venue ? ` at ${venue}` : ''}.` : '';
    return [first, second].filter(Boolean).join(' ');
  }
  const kind = genre ? `${genre}のフェスティバル` : (festival.type === 'rave' ? 'レイヴ' : 'フェスティバル');
  const first = `${name}は、${area ? `${area}で開催される` : ''}${kind}です。`;
  const second = date ? `最新の開催回は${date}${venue ? `、${venue}で` : ''}の開催です。` : '';
  return [first, second].filter(Boolean).join('');
}

function festivalFaqItems(editions, lineupsByEdition, artistsById, name, lang) {
  const current = editions[0];
  if (!current) return [];
  const date = festivalDateText(current, lang);
  const venueParts = [editionLocationName(current, lang), current.ADDRESS, current.PREF]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const rows = lineupsByEdition.get(current.EDITION_ID) || [];
  const acts = [...rows]
    .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
    .map((row) => {
      if (isCompositeLineup(row)) return String(row.ACT_LABEL || '').trim();
      const id = lineupArtistIds(row)[0];
      const artist = id ? artistsById.get(id) : null;
      return artist ? (lang === 'en' ? (artist.name_en || artist.name) : artist.name) : String(row.ACT_LABEL || '').trim();
    })
    .filter(Boolean);
  const items = [];
  if (date) items.push(lang === 'en'
    ? { question: `When is ${name} held?`, answer: `The latest listed date for ${name} is ${date}.` }
    : { question: `${name}の開催日はいつですか？`, answer: `${name}の最新の開催日は${date}です。` });
  if (venueParts.length) items.push(lang === 'en'
    ? { question: `Where is ${name} held?`, answer: `${name} is held at ${venueParts.join(', ')}.` }
    : { question: `${name}の会場はどこですか？`, answer: `${name}の会場は${venueParts.join('、')}です。` });
  if (current.TICKETURL) items.push(lang === 'en'
    ? { question: `Where can I buy tickets for ${name}?`, answer: `Tickets for ${name} are available at ${current.TICKETURL}.`, url: current.TICKETURL }
    : { question: `${name}のチケットはどこで買えますか？`, answer: `${name}のチケットは${current.TICKETURL}で購入できます。`, url: current.TICKETURL });
  if (acts.length) items.push(lang === 'en'
    ? { question: `Which artists are playing at ${name}?`, answer: `The lineup includes ${acts.join(', ')}.` }
    : { question: `${name}にはどんなアーティストが出演しますか？`, answer: `出演アーティストは${acts.join('、')}です。` });
  return items;
}

function festivalFaqHtml(items, lang) {
  if (!items.length) return '';
  const answerHtml = (item) => item.url
    ? esc(item.answer).replace(esc(item.url), `<a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a>`)
    : esc(item.answer);
  return `<section class="festival-faq"><h2>${lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : 'よくある質問'}</h2><dl>${items.map((item) =>
    `<div><dt>${esc(item.question)}</dt><dd>${answerHtml(item)}</dd></div>`
  ).join('')}</dl></section>`;
}

function festivalPage(f, festivalEditions, lineupsByEdition, artistsById, articles, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const hubHref = `${prefix}/festivals.html`;
  const altHref = (lang === 'ja' ? '/en' : '') + `/festivals/${f.id}.html`;
  const name = lang === 'en' ? (f.name_en || f.name) : f.name;
  const bodyDesc = lang === 'en' ? (f.desc_en || f.desc) : (f.desc || f.desc_en);
  const canonical = `${BASE}${prefix}/festivals/${f.id}.html`;
  // SEO: エンティティ名だけでなく検索キーワード（テクノ フェス 日本 等）をtitleに含める
  const title = lang === 'en'
    ? `${name} — Techno ${f.type === 'rave' ? 'Rave' : 'Festival'} in Japan | TECHNO JAPAN`
    : `${name}｜日本のテクノ・${f.type === 'rave' ? 'レイヴ' : '野外フェス'} — TECHNO JAPAN`;
  const desc = bodyDesc || (lang === 'en'
    ? `${name} — edition history and information for a techno / house festival in Japan.`
    : `${name}の開催履歴・基本情報。日本のテクノ／ハウスのフェスティバル情報。`);
  const image = absUrl(f.image || f.flyer);

  // このフェスに紐づく記事（ARTICLES.festivalId で関連付け）
  const related = (articles || []).filter((a) => a.festivalId === f.id && a.status !== 'draft');
  const relatedHtml = related.length
    ? `<div class="related-stories"><h2>RELATED STORIES</h2>` + related.map((a) =>
        `<a class="related-story-card" href="${(lang === 'en' && (a.title_en || a.body_en)) ? '/en' : ''}/articles/${a.id}.html">
          ${a.image ? `<img ${dimensionAttrs(a.image)} class="related-story-thumb" src="/${String(a.image).replace(/^\//, '')}" alt="" loading="lazy">` : ''}
          <div><div class="related-story-meta">${esc(a.category || 'STORY')} · ${esc(fmtDate(a.date))}</div>
          <div class="related-story-title">${esc(a.title)}</div></div>
        </a>`).join('') + `</div>`
    : '';

  const editions = [...festivalEditions].sort((a, b) =>
    String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')) ||
    String(b.EDITION || '').localeCompare(String(a.EDITION || ''))
  );
  const editionsHtml = editionsTable(editions, lang);
  const lineupsHtml = festivalLineupsHtml(editions, lineupsByEdition, artistsById, lang);
  const currentEdition = editions[0];
  const summary = festivalSummary(f, currentEdition, name, lang);
  const faqItems = festivalFaqItems(editions, lineupsByEdition, artistsById, name, lang);
  const faqHtml = festivalFaqHtml(faqItems, lang);
  const performers = editions.flatMap((ed) => lineupsByEdition.get(ed.EDITION_ID) || [])
    .map((row) => lineupEntity(row, artistsById, lang)).filter(Boolean);
  const sameAs = [f.url, f.instagram]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const officialLinkHtml = f.url
    ? `<a class="detail-link festival-official-link" href="${esc(f.url)}" target="_blank" rel="noopener">OFFICIAL SITE</a>`
    : '';
  const socialLinksHtml = f.instagram ? `<div class="festival-social-links">
      <a class="festival-social-link" href="${esc(f.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>
      </a>
    </div>` : '';
  const externalLinksHtml = (officialLinkHtml || socialLinksHtml)
    ? `<div class="festival-external-links">
    ${[officialLinkHtml, socialLinksHtml].filter(Boolean).join('\n    ')}
  </div>`
    : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    '@id': `${BASE}/festivals/${encodeURIComponent(f.id)}.html#festival`,
    name: name,
    description: desc,
    inLanguage: lang,
    image: [image],
    url: canonical,
    ...(sameAs.length ? { sameAs } : {}),
    ...(performers.length ? { performer: performers } : {}),
    ...(editions.length ? { subEvent: editions.map((ed) => ({
      '@type': 'Festival',
      '@id': `${BASE}/festivals/${encodeURIComponent(f.id)}.html#edition-${encodeURIComponent(ed.EDITION_ID)}`,
      name: `${name} ${ed.EDITION || ''}`.trim(),
      ...(ISO_DATE.test(String(ed.DATE_START || '')) ? { startDate: ed.DATE_START } : {}),
      ...(ISO_DATE.test(String(ed.DATE_END || '')) ? { endDate: ed.DATE_END } : {}),
      location: editionLocationLd(ed, lang),
      ...((lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupEntity(row, artistsById, lang)).filter(Boolean).length
        ? { performer: (lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupEntity(row, artistsById, lang)).filter(Boolean) }
        : {}),
      ...(editionStatusLd(ed.STATUS) ? { eventStatus: editionStatusLd(ed.STATUS) } : {}),
      ...(ed.TICKETURL ? { offers: { '@type': 'Offer', url: ed.TICKETURL } } : {}),
    })) } : {}),
  };

  const genres = (Array.isArray(f.genre) ? f.genre : []).map((g) => `<span class="detail-chip">${esc(g)}</span>`).join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="${hubHref}" data-festival-hub-back="${hubHref}"><span class="arrow"></span> ALL FESTIVALS</a>
    <h1>${esc(name)}</h1>
    ${summary ? `<p class="festival-summary">${esc(summary)}</p>` : ''}
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${f.image || f.flyer ? `<div class="detail-hero"><img ${dimensionAttrs(f.image || f.flyer)} src="/${String(f.image || f.flyer).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(f.desc, f.desc_en, lang)}
${externalLinksHtml ? `    ${externalLinksHtml}\n` : ''}    ${editionsHtml}${lineupsHtml}${faqHtml}${relatedHtml}
    ${(() => { // 回遊: 同じエリアの他のフェス
      const others = XLINK.fests.filter((x) => x.id !== f.id && x.city && f.city && String(x.city).toLowerCase() === String(f.city).toLowerCase()).slice(0, 6);
      if (!others.length) return '';
      return `<h2>${lang === 'en' ? `MORE IN ${esc(String(f.city).toUpperCase())}` : `${esc(f.city)}の他のフェス`}</h2>${relatedChips(others, 'festivals', lang)}`;
    })()}
    <div class="article-footer"><a class="article-back" href="${hubHref}" data-festival-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL FESTIVALS</a></div>
  </div>
</article>`;

  const faqLd = faqItems.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null;
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'festivals'] : ['festivals']), `${f.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('FESTIVALS', '/festivals.html', name, canonical), ...(faqLd ? [faqLd] : [])], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT + FESTIVAL_HUB_BACK_SCRIPT }) };
}

/* ---------- アーティストページ ---------- */
const artistEntityId = (id) => `${BASE}/artists/${encodeURIComponent(id)}.html#artist`;
const artistSchemaType = (artist) =>
  String(artist?.schemaType || artist?.schema_type || artist?.SCHEMA_TYPE || 'person').trim().toLowerCase() === 'music-group'
    ? 'MusicGroup'
    : 'Person';
const artistMemberIds = (artist) => {
  const value = artist?.memberIds || artist?.member_ids || artist?.MEMBER_IDS || [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
};

function artistPage(a, artistsById, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/artists/${a.id}.html`;
  const name = lang === 'en' ? (a.name_en || a.name) : a.name;
  const bio = lang === 'en' ? (a.bio_en || a.bio) : (a.bio || a.bio_en);
  const canonical = `${BASE}${prefix}/artists/${a.id}.html`;
  const fromJapan = !a.country || /japan/i.test(String(a.country));
  const title = lang === 'en'
    ? `${name} — Techno DJ / Artist${fromJapan ? ' from Japan' : ''} | TECHNO JAPAN`
    : `${name}｜テクノDJ・アーティスト — TECHNO JAPAN`;
  const place = [a.city, a.country].filter(Boolean).join(', ');
  // bioが無い/短い時は、ジャンル・拠点入りのキーワードリッチな定型文にフォールバック
  const bioDesc = bio ? truncate(stripTags(bio), 160) : '';
  const genreTxt = String(a.genre || '').trim();
  const desc = bioDesc.length >= 50 ? bioDesc : (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — ${genreTxt || 'techno / house'} DJ & artist. Profile, links and festival appearances in Japan's underground scene.`
    : `${name}${place ? '（' + place + '）' : ''} — ${genreTxt ? genreTxt + 'の' : ''}DJ／アーティスト。プロフィール・SNSリンク・日本のテクノ／ハウスシーンでの出演フェス情報。TECHNO JAPANのアーティスト名鑑。`);
  const image = absUrl(a.image);
  const links = a.links || {};
  const schemaType = artistSchemaType(a);
  const members = schemaType === 'MusicGroup'
    ? artistMemberIds(a).map((id) => artistsById.get(id)).filter(Boolean)
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': artistEntityId(a.id),
    name: name,
    inLanguage: lang,
    description: desc,
    ...(a.image ? { image: [image] } : {}),
    url: canonical,
    ...(place ? { location: { '@type': 'Place', name: place } } : {}),
    ...(Array.isArray(a.genre) && a.genre.length ? { genre: a.genre } : {}),
    ...(Object.values(links).filter(Boolean).length ? { sameAs: Object.values(links).filter(Boolean) } : {}),
    ...(members.length ? { member: members.map((member) => ({
      '@type': artistSchemaType(member),
      '@id': artistEntityId(member.id),
      name: lang === 'en' ? (member.name_en || member.name) : member.name,
      url: `${BASE}${lang === 'en' ? '/en' : ''}/artists/${encodeURIComponent(member.id)}.html`,
    })) } : {}),
  };

  const genres = (Array.isArray(a.genre) ? a.genre : String(a.genre || '').split('/').filter(Boolean))
    .map((g) => `<span class="detail-chip">${esc(String(g).trim())}</span>`).join('');

  const linkRow = Object.entries(links)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a class="detail-link" href="${esc(v)}" target="_blank" rel="noopener">${esc(k.toUpperCase())}</a>`)
    .join('');
  const appearances = XLINK.appearMap.get(String(a.id)) || [];
  const appearancesHtml = appearances.length
    ? `\n    <section class="artist-appearances"><h2>${lang === 'en' ? 'APPEARANCES' : '出演フェス'}</h2>${relatedChips(appearances, 'festivals', lang)}</section>`
    : '';

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="/artists.html"><span class="arrow"></span> ALL ARTISTS</a>
    ${place ? `<div class="detail-eyebrow">${esc(place)}</div>` : ''}
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${a.image ? `<div class="detail-hero detail-hero-portrait"><img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(a.bio, a.bio_en, lang)}
    ${linkRow ? `<div class="detail-links">${linkRow}</div>` : ''}${appearancesHtml}
    <div class="article-footer"><a class="article-back" href="/artists.html" style="margin:0"><span class="arrow"></span> ALL ARTISTS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'artists'] : ['artists']), `${a.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd: [jsonLd, breadcrumbLd('ARTISTS', '/artists.html', name, canonical)], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT }) };
}

/* ---------- ヴェニューページ ---------- */
function venuePage(v, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/venues/${v.id}.html`;
  const name = lang === 'en' ? (v.name_en || v.name) : v.name;
  const bodyDesc = lang === 'en' ? (v.desc_en || v.desc) : (v.desc || v.desc_en);
  const canonical = `${BASE}${prefix}/venues/${v.id}.html`;
  const title = lang === 'en'
    ? `${name} — Club / Venue in ${v.city || 'Japan'} | TECHNO JAPAN`
    : `${name}｜${v.city ? v.city + 'の' : ''}クラブ・ヴェニュー — TECHNO JAPAN`;
  const place = [v.area, v.city].filter(Boolean).join(', ');
  const desc = bodyDesc || (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — club / venue guide. Japan's underground dance music.`
    : `${name}${place ? '（' + place + '）' : ''}の基本情報。日本のアンダーグラウンド・ダンスミュージックのクラブ／ヴェニュー。`);
  const image = absUrl(v.image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicVenue',
    '@id': `${BASE}/venues/${encodeURIComponent(v.id)}.html#venue`,
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
    ${v.image ? `<div class="detail-hero"><img ${dimensionAttrs(v.image)} src="/${String(v.image).replace(/^\//, '')}" alt="${esc(name)}"></div>` : ''}
    ${bilingualBody(v.desc, v.desc_en, lang)}
    <dl class="detail-facts">
      ${v.type ? `<div><dt>${lang === 'en' ? 'TYPE' : 'タイプ'}</dt><dd>${esc(v.type)}</dd></div>` : ''}
      ${v.capacity ? `<div><dt>${lang === 'en' ? 'CAPACITY' : 'キャパシティ'}</dt><dd>${esc(v.capacity)}</dd></div>` : ''}
      ${v.address ? `<div><dt>${lang === 'en' ? 'ADDRESS' : '住所'}</dt><dd>${esc(v.address)}</dd></div>` : ''}
      ${v.url ? `<div><dt>${lang === 'en' ? 'OFFICIAL SITE' : '公式サイト'}</dt><dd><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.url)}</a></dd></div>` : ''}
    </dl>
    ${(() => { // 回遊: 同じ街の他のヴェニュー
      const others = XLINK.venues.filter((x) => x.id !== v.id && x.city && v.city && String(x.city).toLowerCase() === String(v.city).toLowerCase()).slice(0, 6);
      if (!others.length) return '';
      return `<h2>${lang === 'en' ? `MORE VENUES IN ${esc(String(v.city).toUpperCase())}` : `${esc(v.city)}の他のヴェニュー`}</h2>${relatedChips(others, 'venues', lang)}`;
    })()}
    <div class="article-footer"><a class="article-back" href="/venues.html" style="margin:0"><span class="arrow"></span> ALL VENUES</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'venues'] : ['venues']), `${v.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('VENUES', '/venues.html', name, canonical)], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT }) };
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

/* ---------- ハブページの静的リンク ---------- */
function festivalHubLabel(f, editions = []) {
  const details = [];
  const current = [...editions].sort((a, b) => String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')))[0];
  const year = String(current?.EDITION || current?.DATE_START || '').match(/\b\d{4}\b/)?.[0];
  if (year) details.push(year);
  const place = current ? editionPlace(current, 'ja') : '';
  if (place) details.push(place);
  return `${f.name || ''}${details.length ? ` — ${details.join(' · ')}` : ''}`;
}

function hubLinkList(items, dirName, labelFor) {
  return `<ul class="ssr-link-list">\n${items.map((item) =>
    `  <li><a href="/${dirName}/${encodeURIComponent(item.id)}.html">${esc(labelFor(item))}</a></li>`
  ).join('\n')}\n</ul>`;
}

/* ---------- EN ハブページの生成 ----------
   JA ハブ（手書きHTML）を唯一のソースとし、機械置換で EN 版を作る。
   テンプレート化しない理由: ハブ4枚は互いに style 7-19% / JS 9-25% しか
   共通しておらず、畳めるのは nav/footer 等の外枠 10.8KB だけ。労力に見合わない。
   一方 JA→EN の差分は「メタ + 内部リンク + 固定文言1つ」しかないので、
   置換のほうが確実で、JA を直せば EN が自動追随する（二重管理が起きない）。 */

// EN 版が実在するページ。ここに無いものは JA を指したままにする（404 を作らない）。
const EN_PAGES = new Set(['index.html', 'about.html', 'submit.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html']);

// EN ハブの meta description（JA は日英併記なので英語のみに差し替える）
const EN_HUB_DESC = {
  'festivals.html': "Techno, house and open-air festivals across Japan. Browse by date, region and genre — the definitive guide to Japan's electronic music festivals and underground raves.",
  'artists.html': "DJs and artists shaping Japan's underground techno and house scene. Profiles, genres and festival appearances.",
  'venues.html': "Clubs, warehouses and music bars across Japan. The venues that define the country's underground electronic music scene.",
  'news.html': "Stories, interviews and reports from Japan's underground techno and house scene.",
  'index.html': "Japan's underground techno & house — stories, festivals, artists, venues.",
};

// 本文に残る日本語の固定文言（データ由来の日本語は対象外）
const EN_HUB_TEXT = [
  ['FESTIVAL 掲載申請', 'Submit a Festival'],
];

function enHubFromJa(html, page) {
  let s = html;
  const abs = (p) => `${BASE}/${p === 'index.html' ? '' : p}`;

  // 言語シグナル
  s = s.replace(/<html lang="[^"]*"/, '<html lang="en"');
  s = s.replace(/(property="og:locale" content=")[^"]*/, '$1en_US');

  // 正規URL と OGP URL を /en/ 側へ。
  // index.html だけ JA 側が "https://techno-japan.media/" とディレクトリ表記なので、
  // abs() が返す末尾スラッシュ形と一致させる。EN 側は /en/index.html を明示する
  // （/en/ でも配信されるが、canonical は1つに定めたいので実ファイル名にする）。
  const jaUrl = abs(page);
  s = s.replace(new RegExp(`(rel="canonical" href=")${jaUrl}"`), `$1${BASE}/en/${page}"`);
  s = s.replace(new RegExp(`(property="og:url" content=")${jaUrl}"`), `$1${BASE}/en/${page}"`);

  // description 系を英語のみに
  const d = EN_HUB_DESC[page];
  if (d) {
    for (const attr of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      s = s.replace(new RegExp(`(<meta ${attr} content=")[^"]*`), `$1${d}`);
    }
  }

  // 内部リンク: EN 版があるページだけ /en/ へ。相対・絶対の両表記に対応する。
  s = s.replace(/href="\/?((?:index|news|festivals|artists|venues|about|submit)\.html)"/g,
    (m, p) => (EN_PAGES.has(p) ? `href="/en/${p}"` : m));
  // EN 版が無いページ（index）は相対表記だと /en/index.html を指してしまう。
  // ルート相対に正規化して JA トップへ確実に戻す。
  s = s.replace(/href="index\.html"/g, 'href="/index.html"');

  // JA ハブは共有アセットを相対パスで読んでいる。/en/ に置くと /en/data.js を
  // 探して 404 になり、FESTIVALS is not defined でページ全体が死ぬ。
  // ルート相対へ正規化する。?v のクエリは維持する（キャッシュバスティング §9-11）。
  s = s.replace(/(<(?:script|link)[^>]*(?:src|href)=")((?!https?:|\/|#|mailto:|data:)[a-z0-9-]+\.(?:js|css)(?:\?v=\d+)?)"/g,
    '$1/$2"');

  // 詳細ページへのリンクを EN 側へ。A1 の静的リンク一覧と、SPA が描画する
  // カードの両方が対象。EN 詳細は 206枚すべて実在する。
  s = s.replace(/href="\/(festivals|artists|venues|articles)\//g, 'href="/en/$1/');
  s = s.replace(/href="\/\$\{/g, 'href="/en/${');   // JS テンプレート内の絶対パス
  s = s.replace(/`\/(festivals|artists|venues|articles)\/\$\{/g, '`/en/$1/${');

  // 固定文言
  for (const [ja, en] of EN_HUB_TEXT) s = s.split(ja).join(en);

  // hreflang: JA 側の3行を EN 視点の3行へ「置換」する。
  // 追記にすると JA から引き継いだ分と二重になる（6本出る）。
  s = s.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  s = s.replace(`<link rel="canonical" href="${BASE}/en/${page}">`,
    `<link rel="canonical" href="${BASE}/en/${page}">\n${hreflangPair(page, 'en')}`);

  // 言語トグル（JA 側と対になる形）。
  // `<span class="nav-lang">[\s\S]*?</span></span>` のような緩い正規表現は使わない。
  // nav-lang 内には </span></span> が現れないため 10KB 先まで走り、
  // 詳細ビューのマークアップ152行を巻き込んで消す事故を起こした。
  // 実際に生成される固定文字列だけを対象にする。
  const jaToggle = `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="/en/${page}">EN</a></span>`;
  const enToggle = `<span class="nav-lang"><a href="/${page}">JA</a><span class="nav-lang-sep">/</span><span class="nav-lang-cur">EN</span></span>`;
  if (!s.includes(jaToggle)) throw new Error(`${page}: 言語トグルが見つからない（JA 側の生成と不整合）`);
  s = s.split(jaToggle).join(enToggle);

  return s;
}

function hreflangPair(page, self) {
  // index の JA 版は "/" で配信される（canonical もそう書かれている）ので合わせる
  const ja = page === 'index.html' ? `${BASE}/` : `${BASE}/${page}`;
  const en = `${BASE}/en/${page}`;
  return [
    `<link rel="alternate" hreflang="${self}" href="${self === 'ja' ? ja : en}">`,
    `<link rel="alternate" hreflang="${self === 'ja' ? 'en' : 'ja'}" href="${self === 'ja' ? en : ja}">`,
    `<link rel="alternate" hreflang="x-default" href="${en}">`,
  ].join('\n');
}

/* JA ハブを正す（lang / hreflang / 言語トグル）。EN 生成の前に実行する。
   全ハブが <html lang="en"> なのに og:locale="ja_JP" という矛盾状態だった。 */
function fixJaHub(fileName) {
  const file = path.join(LP_DIR, fileName);
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  s = s.replace(/<html lang="[^"]*"/, '<html lang="ja"');

  const canon = fileName === 'index.html'
    ? `<link rel="canonical" href="${BASE}/">`
    : `<link rel="canonical" href="${BASE}/${fileName}">`;
  if (s.includes(canon) && !s.includes('hreflang')) {
    s = s.replace(canon, `${canon}\n${hreflangPair(fileName, 'ja')}`);
  }
  // 言語トグルを nav-social の直後に置く（無ければ nav-links の末尾）
  if (!s.includes('nav-lang')) {
    const toggle = `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="/en/${fileName}">EN</a></span>`;
    s = s.replace(/(<span class="nav-social">[\s\S]*?<\/span>)(\s*<\/div>)/, `$1\n    ${toggle}$2`);
  }
  if (s === before) return false;
  fs.writeFileSync(file, s);
  return true;
}

function writeEnHub(fileName) {
  const src = fs.readFileSync(path.join(LP_DIR, fileName), 'utf8');
  const out = path.join(LP_DIR, 'en', fileName);
  const html = enHubFromJa(src, fileName);
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (cur === html) return false;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return true;
}

function writeHubLinks(fileName, markerName, html) {
  const file = path.join(LP_DIR, fileName);
  const start = `<!-- STATIC_LINKS:${markerName}:START -->`;
  const end = `<!-- STATIC_LINKS:${markerName}:END -->`;
  const source = fs.readFileSync(file, 'utf8');
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) {
    throw new Error(`${fileName}: 静的リンクの生成マーカーが見つかりません`);
  }
  const next = source.replace(pattern, `${start}\n${html}\n${end}`);
  if (next === source) return false;
  fs.writeFileSync(file, next);
  return true;
}

function main() {
  IMAGE_DIMENSIONS = loadImageDimensions();
  const { ARTISTS = [], FESTIVALS = [], VENUES = [], ARTICLES = [] } = loadData();
  const EDITIONS = loadItems(EDITIONS_PATH, 'editions.json');
  const LINEUPS = loadItems(LINEUPS_PATH, 'lineups.json');

  // 安全弁: data.js の主要配列が空なのに既存ページが大量にある場合、
  // 生成を続けると writeAll の掃除で全ページ削除→本番404になる
  // （2026-07-23〜30 のフェス全消失事故の再発防止・CI側の最後の砦）。
  for (const [name, arr, dir] of [['FESTIVALS', FESTIVALS, 'festivals'], ['ARTISTS', ARTISTS, 'artists'], ['VENUES', VENUES, 'venues']]) {
    const existing = fs.existsSync(path.join(LP_DIR, dir)) ? fs.readdirSync(path.join(LP_DIR, dir)).filter((f) => f.endsWith('.html')).length : 0;
    if (arr.length === 0 && existing > 10) {
      console.error(`⛔ ${name} が data.js で0件ですが既存ページが${existing}件あります。` +
        `シート/Publishの障害の可能性が高いため、ページ削除を防ぐべく生成を中断します。`);
      process.exit(1);
    }
  }

  const valid = (x) => x && x.id && String(x.id).trim();
  const festivalIds = new Set(FESTIVALS.filter(valid).map((f) => String(f.id)));
  const editionIds = new Set();
  const editionsByFestival = new Map();
  for (const ed of EDITIONS) {
    if (!ed.EDITION_ID || !ed.FESTIVAL_ID) throw new Error('editions.json: EDITION_ID / FESTIVAL_ID が空の行があります');
    if (editionIds.has(ed.EDITION_ID)) throw new Error(`editions.json: EDITION_ID 重複 "${ed.EDITION_ID}"`);
    if (!festivalIds.has(String(ed.FESTIVAL_ID))) throw new Error(`editions.json: FESTIVAL_ID 参照切れ "${ed.FESTIVAL_ID}"`);
    editionIds.add(ed.EDITION_ID);
    if (!editionsByFestival.has(ed.FESTIVAL_ID)) editionsByFestival.set(ed.FESTIVAL_ID, []);
    editionsByFestival.get(ed.FESTIVAL_ID).push(ed);
  }
  const resolveEntities = makeEntityResolver({ ARTISTS, FESTIVALS, VENUES, ARTICLES });
  const pubArticles = ARTICLES.filter(valid).filter((a) => a.status !== 'draft');
  const pubFests = FESTIVALS.filter(valid);
  const pubArtists = ARTISTS.filter(valid);
  const pubVenues = VENUES.filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined');
  const artistsById = new Map(pubArtists.map((artist) => [String(artist.id), artist]));
  const festivalsById = new Map(pubFests.map((festival) => [String(festival.id), festival]));
  const editionById = new Map(EDITIONS.map((edition) => [String(edition.EDITION_ID), edition]));
  const lineupsByEdition = new Map();
  const appearMap = new Map();
  for (const row of LINEUPS) {
    const edition = editionById.get(String(row.EDITION_ID || ''));
    if (!edition) throw new Error(`lineups.json: EDITION_ID 参照切れ "${row.EDITION_ID || ''}"`);
    if (!lineupsByEdition.has(row.EDITION_ID)) lineupsByEdition.set(row.EDITION_ID, []);
    lineupsByEdition.get(row.EDITION_ID).push(row);

    if (isCompositeLineup(row)) continue;
    const artistId = lineupArtistIds(row)[0];
    if (!artistId) continue;
    if (!artistsById.has(artistId)) throw new Error(`lineups.json: ARTIST_ID 参照切れ "${artistId}"`);
    const festival = festivalsById.get(String(edition.FESTIVAL_ID));
    if (!festival) throw new Error(`lineups.json: FESTIVAL_ID 参照切れ "${edition.FESTIVAL_ID}"`);
    if (!appearMap.has(artistId)) appearMap.set(artistId, new Map());
    appearMap.get(artistId).set(festival.id, festival);
  }
  XLINK = {
    fests: FESTIVALS,
    venues: VENUES,
    appearMap: new Map([...appearMap].map(([artistId, festivals]) => [artistId, [...festivals.values()]])),
  };

  // ID変更に伴う旧URLのリダイレクトスタブ（writeAll の掃除で消されないよう wanted に含める）
  // { dir: { oldId: newId } }
  const REDIRECTS = {
    articles: { transcendence: 'transcendence-2025-report' },
    // 一括登録時に ID 欄へ NAME をそのまま貼ってしまった7件（大文字・スペース入り、
    // DATA_SCHEMA §1.1 違反）。URL に %20 が出ていたため slug へ修正した。
    // 発行済みIDの変更なので旧URLからのリダイレクトを必ず残す。
    artists: ARTIST_ID_FIXES,
    'en/artists': ARTIST_ID_FIXES,
  };
  // 旧IDがまだ data.js に現役で存在する間はスタブを出さない。
  // writeAll は basename をキーにした Map で後勝ちになるため、スタブを出すと
  // 同名の本物のページを上書きし、まだ存在しない新URLへ飛ばす壊れたページになる。
  // 新IDが未登場の間も出さない（リダイレクト先が 404 になるため）。
  // これにより CMS の Publish Now より先にこのパッチを入れても安全で、
  // Publish 後は次回ビルドで自動的にスタブが出る。
  const redirectStubs = (dirName, liveIds = new Set()) =>
    Object.entries(REDIRECTS[dirName] || {})
      .filter(([oldId, newId]) => !liveIds.has(oldId) && liveIds.has(newId))
      .map(([oldId, newId]) => {
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

  // リダイレクトスタブの衝突判定に使う「現役ID」の集合
  const liveArticleIds = new Set(pubArticles.map((a) => a.id));
  const liveArtistIds = new Set(pubArtists.map((a) => a.id));

  const counts = {
    articles: writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'ja')).concat(redirectStubs('articles', liveArticleIds)), 'articles'),
    festivals: writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, ARTICLES, 'ja')), 'festivals'),
    artists: writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'ja')).concat(redirectStubs('artists', liveArtistIds)), 'artists'),
    venues: writeAll(pubVenues.map((v) => venuePage(v, 'ja')), 'venues'),
    // 英語版（/en/…）。記事は英訳がある時だけ生成する
    'en/articles': writeAll(pubArticles.filter((a) => a.title_en || a.body_en).map((a) => articlePage(a, resolveEntities, 'en')), 'en/articles'),
    'en/festivals': writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, ARTICLES, 'en')), 'en/festivals'),
    'en/artists': writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'en')).concat(redirectStubs('en/artists', liveArtistIds)), 'en/artists'),
    'en/venues': writeAll(pubVenues.map((v) => venuePage(v, 'en')), 'en/venues'),
  };

  const hubCounts = {
    'news.html': {
      total: pubArticles.length,
      written: writeHubLinks('news.html', 'ARTICLES', hubLinkList(pubArticles, 'articles', (a) => a.title || '')),
    },
    'festivals.html': {
      total: pubFests.length,
      written: writeHubLinks('festivals.html', 'FESTIVALS', hubLinkList(pubFests, 'festivals', (f) => festivalHubLabel(f, editionsByFestival.get(f.id) || []))),
    },
    'artists.html': {
      total: pubArtists.length,
      written: writeHubLinks('artists.html', 'ARTISTS', hubLinkList(pubArtists, 'artists', (a) => a.name || '')),
    },
    'venues.html': {
      total: pubVenues.length,
      written: writeHubLinks('venues.html', 'VENUES', hubLinkList(pubVenues, 'venues', (v) => v.name || '')),
    },
  };

  // JA ハブを正してから EN を作る。順序が逆だと、直す前の JA から EN が生まれる。
  // 静的リンクの差し替え（上の hubCounts）も EN へ引き継ぐため、この位置に置く。
  const HUBS = ['index.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html'];
  const jaFixed = HUBS.filter(fixJaHub);
  const enWritten = HUBS.filter(writeEnHub);

  console.log('Detail pages:');
  let total = 0, written = 0, removed = 0;
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v.total} pages (updated ${v.written}, removed ${v.removed})`);
    total += v.total; written += v.written; removed += v.removed;
  }
  console.log(`  total: ${total} pages — ${written} written, ${removed} removed`);
  console.log(`JA hubs fixed (lang/hreflang/toggle): ${jaFixed.length ? jaFixed.join(', ') : 'none'}`);
  console.log(`EN hubs written: ${enWritten.length ? enWritten.join(', ') : 'none (up to date)'}`);
  console.log('Hub static links:');
  for (const [file, result] of Object.entries(hubCounts)) {
    console.log(`  ${file}: ${result.total} links (${result.written ? 'updated' : 'unchanged'})`);
  }
}

main();
