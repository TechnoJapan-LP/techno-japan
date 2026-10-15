/* Directional MPA View Transition enhancement. This file is intentionally
   classic/blocking so pageswap and pagereveal are registered before paint. */
(function () {
  'use strict';
  if (!window || !document) return;
  var KEY = 'tj-vt-dir';
  var PENDING_KEY = 'tj-vt-pending';
  var LEAVING_KEY = 'tj-vt-leaving';
  var POINTERS = new WeakMap();
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
  function heroImageFor(link) {
    if (!link) return null;
    var own = link.querySelector('img');
    if (visible(own)) return own;
    var story = link.closest('[data-story-index]');
    if (!story) return null;
    var index = story.getAttribute('data-story-index');
    var slide = document.querySelector('.stories-visual [data-story-visual="' + index + '"]');
    if (!slide || !slide.classList.contains('is-active')) return null;
    var railImage = slide.querySelector('img');
    return visible(railImage) ? railImage : null;
  }
  function directionFor(link, clientX) {
    if (!link || typeof clientX !== 'number') return 'right';
    var image = heroImageFor(link);
    if (!image || !link.contains(image)) image = null;
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
  function setHero(link) {
    clearHeroNames();
    var image = heroImageFor(link);
    if (image) image.style.viewTransitionName = 'tj-hero';
  }
  function record(link, clientX) {
    var direction = directionFor(link, clientX);
    POINTERS.set(link, direction);
    setHero(link);
    var path = articlePath(link && link.href);
    if (path) {
      remember(path, direction);
      writeSession(PENDING_KEY, { path: path, dir: direction, ts: Date.now() });
    }
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
    if (isArticlePath(entry)) return map[entry] || '';
    if (isArticlePath(from) && isListPath(entry)) return map[from] || '';
    return '';
  }
  function restoreCardForPath(path) {
    var map = readMap();
    if (!map[path]) return;
    var target = Array.prototype.find.call(document.querySelectorAll('a[href]'), function (link) {
      return articlePath(link.href) === path;
    });
    var image = target && heroImageFor(target);
    if (!inViewport(image)) return;
    clearHeroNames();
    image.style.viewTransitionName = 'tj-hero';
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
    if (link) record(link, event.clientX);
  }, { passive: true, capture: true });
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest(selectors);
    if (!link) return;
    if (POINTERS.has(link)) {
      setHero(link);
      return;
    }
    record(link, event.detail === 0 ? undefined : event.clientX);
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
