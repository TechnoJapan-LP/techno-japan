#!/usr/bin/env node
/**
 * Generate sitemap.xml from data.js
 * Usage: node scripts/generate-sitemap.js
 *
 * Outputs: LP/sitemap.xml
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://techno-japan.media';
const LP_DIR = path.join(__dirname, '..', 'LP');
const OUT_PATH = path.join(LP_DIR, 'sitemap.xml');

// Static pages
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/festivals.html', priority: '0.9', changefreq: 'daily' },
  { path: '/events.html', priority: '0.9', changefreq: 'daily' },
  { path: '/artists.html', priority: '0.8', changefreq: 'weekly' },
  { path: '/venues.html', priority: '0.8', changefreq: 'weekly' },
  { path: '/news.html', priority: '0.9', changefreq: 'daily' },
  { path: '/submit.html', priority: '0.5', changefreq: 'monthly' },
  { path: '/en/submit.html', priority: '0.5', changefreq: 'monthly' },
];

// Load data.js
const dataPath = path.join(LP_DIR, 'data.js');
const dataSource = fs.readFileSync(dataPath, 'utf8');

// Evaluate data.js in isolated context to extract arrays
const sandbox = {};
const script = dataSource + '\nObject.assign(sandbox, { ARTISTS, EVENTS, VENUES, FESTIVALS: typeof FESTIVALS !== "undefined" ? FESTIVALS : [], ARTICLES: typeof ARTICLES !== "undefined" ? ARTICLES : [] });';
const ctx = require('vm').createContext({ sandbox });
require('vm').runInContext(script, ctx);

const { ARTISTS = [], EVENTS = [], VENUES = [], FESTIVALS = [], ARTICLES = [] } = sandbox;

const today = new Date().toISOString().split('T')[0];

// Build URL list
const urls = [];

// Static pages
STATIC_PAGES.forEach(p => {
  urls.push({
    loc: BASE_URL + p.path,
    lastmod: today,
    changefreq: p.changefreq,
    priority: p.priority,
  });
});

// Festivals (deep links)
FESTIVALS.forEach(f => {
  if (f.id) {
    urls.push({
      loc: `${BASE_URL}/festivals.html#festival/${f.id}`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.7',
    });
  }
});

// Artists
ARTISTS.forEach(a => {
  if (a.id) {
    urls.push({
      loc: `${BASE_URL}/artists.html#artist/${a.id}`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }
});

// Venues
VENUES.forEach(v => {
  if (v.id && v.name && v.city && v.city !== 'undefined') {
    urls.push({
      loc: `${BASE_URL}/venues.html#venue/${v.id}`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.6',
    });
  }
});

// Articles (if any)
ARTICLES.forEach(a => {
  if (a.id) {
    urls.push({
      loc: `${BASE_URL}/news.html#article/${a.id}`,
      lastmod: a.publishedAt || today,
      changefreq: 'monthly',
      priority: '0.7',
    });
  }
});

// Generate XML
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

fs.writeFileSync(OUT_PATH, xml);
console.log(`✓ sitemap.xml generated: ${urls.length} URLs`);
console.log(`  → ${OUT_PATH}`);
