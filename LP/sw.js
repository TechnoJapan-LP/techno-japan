/**
 * Service Worker for TECHNO JAPAN
 *
 * Strategy:
 * - HTML pages: network-first (fresh content) with cache fallback
 * - CSS/JS/fonts: cache-first。更新は URL の ?v を上げて別キャッシュキーにすることで
 *   届ける（バックグラウンド更新は行わない）。?v の更新漏れは
 *   scripts/check_asset_versions.py が止める。
 * - images: stale-while-revalidate（同名で差し替えられるため）
 * - data.js: network-first。CMS の Publish Now が commit するので
 *   人が HTML の ?v を上げる機会が無く、初回から最新データを優先する。
 *
 * ⚠ fetch ハンドラの分岐は上から順に評価され、最初に一致したところで return する。
 *   data.js の判定は必ず CSS/JS の判定より前に置くこと（url.pathname は
 *   クエリを含まないため /data.js?v=7 は /\.js$/ にも一致してしまう）。
 *   順序を守れているかは scripts/check_sw_routing.mjs が検査する。
 */

const VERSION = 'v1.14.0';
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
  '/news.html',
  '/favorites.html',
  '/common.css',
  '/common.js',
  '/favorites.js',
  '/search.js',
  '/article-fx.css',
  '/article-fx.js',
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

  // data.js: network-first
  //
  // 下の CSS/JS 判定より必ず前に置く。url.pathname はクエリを含まないので
  // /data.js?v=7 の pathname は /data.js となり /\.js$/ にも一致する。
  // 順序を逆にすると cache-first に吸われ、Publish しても一覧に反映されない
  // （実際に v1.12.0 までこの状態で、この分岐は到達不能だった）。
  //
  // data.js は CMS の Publish Now が直接 commit するため、他の JS のように
  // 「変更したら参照元 HTML の ?v を上げる」運用が効かない。?v=10 は固定のまま
  // 中身だけが変わるので、キャッシュキーで鮮度を管理できない。
  //
  // 【相互参照】この「?v で鮮度管理しない」という決定は、
  // scripts/check_asset_versions.py の TRACK_ACROSS_PUSHES と対になっている。
  // あちらに data.js を足すと「?v を必ず上げよ」と要求することになり、
  // ここの前提と矛盾する。2026-08-03 に一度足して同日に外した（AUDIT §9-32）。
  // stale-while-revalidate では初回表示に古い一覧が出るため、data.js は
  // network-first にする。ネットワーク障害時だけキャッシュへフォールバックする。
  if (url.pathname.endsWith('/data.js')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // フォント/CSS/JS はクエリ(?v)でバージョン管理しているので cache-first でよい。
  // 更新は ?v を上げて別のキャッシュキーにすることで届ける。
  if (/\.(css|js|woff2?|ttf|otf)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 画像は stale-while-revalidate。
  // CMS で同じファイル名のまま画像を差し替えることがあり、cache-first だと
  // 一度見た人には古い画像が永久に表示され続けてしまう。
  if (/\.(png|jpe?g|webp|avif|svg|gif|ico)$/i.test(url.pathname)) {
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

// キャッシュに在れば即返して終わり。バックグラウンド更新は「行わない」。
// 対象は ?v 付きの CSS/JS/フォントだけで、更新すれば ?v が変わり別のキャッシュキーに
// なるため、同じ URL の中身が変わることが無い。裏で取り直しても常に同じ内容で、
// 全ページ読み込みごとにネットワーク往復が倍になるだけになる。
// （ヘッダーコメントには v1.12.0 まで "with background update" と書かれていたが、
//   実装は最初から無く、記述のほうが誤っていた）
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
