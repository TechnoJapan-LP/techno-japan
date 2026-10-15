/* Directional MPA View Transition enhancement. This file is intentionally
   classic/blocking so pageswap and pagereveal are registered before paint. */
(function () {
  'use strict';
  if (!window || !document) return;
  var KEY = 'tj-vt-dir';
  var PENDING_KEY = 'tj-vt-pending';
  var LEAVING_KEY = 'tj-vt-leaving';
  var POINTERS = new WeakMap();
  var CHOSEN_IMAGES = new WeakMap();
  var PREFETCHED = Object.create(null);
  var selectors = '.side-card, [data-article-detail-link], .related-story-card';

  function readMap() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; }
  }
  function remember(path, direction) {
    try {
      var map = readMap();
      map[path] = direction;
      var keys = Object.keys(map);
      keys.slice(0, Math.max(0, keys.length - 20)).forEach(function (key) { delete map[key]; });
      sessionStorage.setItem(KEY, JSON.stringify(map));
    } catch (_) {}
  }
  function writeSession(key, value) {
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function readSession(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }
  function removeSession(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function inViewport(el) {
    if (!visible(el)) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  }
  function visibleImages(link) {
    if (!link) return [];
    return Array.prototype.filter.call(link.querySelectorAll('img'), visible);
  }
  function heroImageFor(link, clientX, clientY) {
    if (!link) return null;
    var images = visibleImages(link);
    if (images.length) {
      if (typeof clientX === 'number' && typeof clientY === 'number') {
        var hit = images.find(function (image) {
          var r = image.getBoundingClientRect();
          return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        });
        if (hit) return hit;
        return images.slice().sort(function (a, b) {
          return Math.abs(a.getBoundingClientRect().left + a.getBoundingClientRect().width / 2 - clientX) -
            Math.abs(b.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - clientX);
        })[0];
      }
      return images[0];
    }
    var story = link.closest('[data-story-index]');
    if (!story) return null;
    var index = story.getAttribute('data-story-index');
    var slide = document.querySelector('.stories-visual [data-story-visual="' + index + '"]');
    if (!slide || !slide.classList.contains('is-active')) return null;
    var railImage = slide.querySelector('img');
    return visible(railImage) ? railImage : null;
  }
  function directionFor(link, clientX, clientY, image) {
    if (!link || typeof clientX !== 'number' || typeof clientY !== 'number') return 'right';
    var images = visibleImages(link);
    var imageRect = image && image.getBoundingClientRect();
    var imageContainsPointer = imageRect && clientX >= imageRect.left && clientX <= imageRect.right && clientY >= imageRect.top && clientY <= imageRect.bottom;
    if (!image || !link.contains(image) || images.length !== 1 || !imageContainsPointer) image = null;
    var rect = (image || link).getBoundingClientRect();
    return clientX < rect.left + rect.width / 2 ? 'left' : 'right';
  }
  function articlePath(href) {
    try {
      var path = new URL(href, location.href).pathname;
      return /\/articles\/[^/]+\.html$/.test(path) ? path : '';
    } catch (_) { return ''; }
  }
  function clearHeroNames() {
    document.querySelectorAll('[style*="view-transition-name"], img').forEach(function (node) {
      node.style.viewTransitionName = '';
    });
  }
  function setHero(link, image) {
    clearHeroNames();
    image = image || heroImageFor(link);
    if (image) image.style.viewTransitionName = 'tj-hero';
  }
  function preloadHero(link, image) {
    var path = articlePath(link && link.href);
    var srcset = image && (image.getAttribute('srcset') || image.dataset.srcset);
    if (!path || !srcset || PREFETCHED[path]) return;
    PREFETCHED[path] = true;
    var preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'image';
    preload.setAttribute('imagesrcset', srcset);
    preload.setAttribute('imagesizes', '(max-width: 700px) 100vw, 700px');
    preload.fetchPriority = 'high';
    document.head.appendChild(preload);
  }
  function record(link, clientX, clientY) {
    var image = heroImageFor(link, clientX, clientY);
    var direction = directionFor(link, clientX, clientY, image);
    var images = visibleImages(link);
    var imageIndex = images.indexOf(image);
    if (imageIndex < 0) imageIndex = 0;
    POINTERS.set(link, direction);
    CHOSEN_IMAGES.set(link, image);
    setHero(link, image);
    var path = articlePath(link && link.href);
    if (path) {
      remember(path, { d: direction, i: imageIndex });
      writeSession(PENDING_KEY, { path: path, dir: direction, ts: Date.now() });
    }
    return image;
  }
  function isArticlePath(path) { return /\/articles\/[^/]+\.html$/.test(path || ''); }
  function isListPath(path) { return /^\/(?:en\/)?(?:index\.html|news\.html)?$/.test(path || ''); }
  function setTransitionDirection(event, direction) {
    if (direction !== 'left' && direction !== 'right') return;
    var root = document.documentElement;
    root.classList.remove('tj-vt-left', 'tj-vt-right');
    root.classList.add('tj-vt-' + direction);
    try {
      if (event.viewTransition && event.viewTransition.types) event.viewTransition.types.add('tj-from-' + direction);
      if (event.viewTransition && event.viewTransition.finished) {
        event.viewTransition.finished.finally(function () { root.classList.remove('tj-vt-left', 'tj-vt-right'); });
      }
    } catch (_) {}
  }
  function activation(event) {
    try { return (event && event.activation) || (window.navigation && navigation.activation) || null; } catch (_) { return null; }
  }
  function entryPath(entry) {
    try { return entry && new URL(entry.url).pathname || ''; } catch (_) { return ''; }
  }
  function hasSavedPath(path) {
    return !!(path && readMap()[path]);
  }
  function recentSession(value, path) {
    return !!(value && value.path === path && typeof value.ts === 'number' && Date.now() - value.ts < 5000);
  }
  function shouldExpectRender() {
    var active = activation(null);
    var current = location.pathname;
    if (isListPath(current)) {
      var from = entryPath(active && active.from);
      if (active && active.navigationType === 'traverse' && isArticlePath(from) && hasSavedPath(from)) return true;
      var leaving = readSession(LEAVING_KEY);
      return recentSession(leaving, leaving && leaving.path) && isArticlePath(leaving.path) && hasSavedPath(leaving.path);
    }
    if (isArticlePath(current)) {
      var pending = readSession(PENDING_KEY);
      if (recentSession(pending, current) && hasSavedPath(current)) return true;
      var fromList = entryPath(active && active.from);
      return !!(active && isListPath(fromList) && hasSavedPath(current));
    }
    return false;
  }
  if (shouldExpectRender()) {
    document.head.appendChild(Object.assign(document.createElement('link'), {
      rel: 'expect', href: '#tj-vt-anchor', blocking: 'render'
    }));
  }
  function transitionDirection(event) {
    var active = activation(event);
    if (!active) return '';
    var from = '';
    var entry = '';
    try {
      from = active.from && new URL(active.from.url).pathname;
      entry = active.entry && new URL(active.entry.url).pathname;
    } catch (_) { return ''; }
    var map = readMap();
    if (isArticlePath(entry)) return typeof map[entry] === 'string' ? map[entry] : map[entry] && map[entry].d || '';
    if (isArticlePath(from) && isListPath(entry)) return typeof map[from] === 'string' ? map[from] : map[from] && map[from].d || '';
    return '';
  }
  function restoreCardForPath(path) {
    var map = readMap();
    var saved = map[path];
    if (!saved) return;
    var imageIndex = typeof saved === 'string' ? 0 : saved.i;
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i += 1) {
      var link = links[i];
      if (articlePath(link.href) !== path) continue;
      var images = visibleImages(link);
      var image = images[imageIndex] || images[0] || heroImageFor(link);
      if (!inViewport(image)) continue;
      clearHeroNames();
      image.style.viewTransitionName = 'tj-hero';
      return;
    }
  }
  function restoreCard(event) {
    var active = activation(event);
    if (!active || !(active.from && active.entry)) return;
    var from = '';
    var entry = '';
    try {
      from = new URL(active.from.url).pathname;
      entry = new URL(active.entry.url).pathname;
    } catch (_) { return; }
    if (!isArticlePath(from) || !isListPath(entry)) return;
    restoreCardForPath(from);
  }
  document.addEventListener('pointerdown', function (event) {
    var link = event.target.closest && event.target.closest(selectors);
    if (link) {
      var image = record(link, event.clientX, event.clientY);
      preloadHero(link, image);
    }
  }, { passive: true, capture: true });
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest(selectors);
    if (!link) return;
    if (POINTERS.has(link)) {
      setHero(link, CHOSEN_IMAGES.get(link));
      return;
    }
    record(link, event.detail === 0 ? undefined : event.clientX, event.detail === 0 ? undefined : event.clientY);
  }, { capture: true });
  if ('onpageswap' in window) window.addEventListener('pageswap', function (event) {
    var direction = transitionDirection(event);
    if (direction) setTransitionDirection(event, direction);
    var hero = document.querySelector('[style*="view-transition-name: tj-hero"]');
    if (hero && hero.getBoundingClientRect().bottom < 0) hero.style.viewTransitionName = '';
  });
  if ('onpagereveal' in window) window.addEventListener('pagereveal', function (event) {
    if (event.viewTransition) document.documentElement.classList.add('tj-vt-nav');
    var active = activation(event);
    var direction = transitionDirection(event);
    if (active) {
      if (direction) setTransitionDirection(event, direction);
      restoreCard(event);
      return;
    }
    var now = Date.now();
    var pending = readSession(PENDING_KEY);
    if (pending && pending.path === location.pathname && now - pending.ts < 5000) {
      direction = pending.dir;
      removeSession(PENDING_KEY);
      if (direction) setTransitionDirection(event, direction);
      return;
    }
    var leaving = readSession(LEAVING_KEY);
    if (isListPath(location.pathname) && leaving && isArticlePath(leaving.path) && now - leaving.ts < 5000) {
      direction = readMap()[leaving.path] || '';
      removeSession(LEAVING_KEY);
      if (direction) {
        setTransitionDirection(event, direction);
        restoreCardForPath(leaving.path);
      }
    }
  });
  if (isArticlePath(location.pathname)) {
    window.addEventListener('pagehide', function () {
      writeSession(LEAVING_KEY, { path: location.pathname, ts: Date.now() });
    });
  }
}());
