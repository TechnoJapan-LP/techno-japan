/* TJ APP (仮) — Service Worker
   シェル: cache-first / データ(../data/*.json): stale-while-revalidate
   インストール時に全フェスデータを事前キャッシュ → 圏外の会場でも動く */
const VERSION = 'tjapp-v1.2.0';
const SHELL_CACHE = VERSION + '-shell';
const DATA_CACHE = VERSION + '-data';

const SHELL = ['./', './index.html', './app.css', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const DATA = ['../data/festivals.json', '../data/editions.json', '../data/lineups.json', '../data/artists.json'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL);
    const data = await caches.open(DATA_CACHE);
    await data.addAll(DATA).catch(() => {}); // データ取得失敗でもインストールは通す
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // データ: stale-while-revalidate（即表示 → 裏で更新）
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(request);
      const revalidate = fetch(request).then(res => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => cached);
      return cached || revalidate;
    })());
    return;
  }

  // シェル: cache-first
  e.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const res = await fetch(request);
      if (res.ok && url.pathname.includes('/app/')) (await caches.open(SHELL_CACHE)).put(request, res.clone());
      return res;
    } catch (err) {
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw err;
    }
  })());
});
