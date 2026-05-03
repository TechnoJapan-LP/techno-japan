/**
 * Service Worker for TECHNO JAPAN
 *
 * Strategy:
 * - HTML pages: network-first (fresh content) with cache fallback
 * - Static assets (CSS/JS/fonts/images): cache-first with background update
 * - data.js: stale-while-revalidate (fast load, update in background)
 */

const VERSION = 'v1.3.0';
const STATIC_CACHE = `tj-static-${VERSION}`;
const DYNAMIC_CACHE = `tj-dynamic-${VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/about.html',
  '/festivals.html',
  '/events.html',
  '/artists.html',
  '/venues.html',
  '/discover.html',
  '/favorites.html',
  '/common.css',
  '/common.js',
  '/favorites.js',
  '/search.js',
  '/data.js',
];

// Install: precache core pages
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache failed', err))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: routing strategies
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and external requests (analytics, behold, fonts)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  // Skip API endpoints
  if (url.pathname.startsWith('/api/')) return;

  // HTML: network-first
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first
  if (/\.(css|js|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|gif|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // data.js: stale-while-revalidate
  if (url.pathname.endsWith('/data.js')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network with cache fallback
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Offline fallback for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}
