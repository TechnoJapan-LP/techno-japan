/* Shared behavior for generated detail pages. Loaded with defer after page-specific scripts. */
(function () {
  'use strict';

  function bindHubBackLinks() {
    ['festival', 'artist', 'venue', 'article'].forEach(function (kind) {
      var attribute = 'data-' + kind + '-hub-back';
      document.querySelectorAll('[' + attribute + ']').forEach(function (link) {
        link.addEventListener('click', function (event) {
          try {
            var referrer = new URL(document.referrer);
            if (referrer.origin === window.location.origin && referrer.pathname === link.dataset[kind + 'HubBack']) {
              event.preventDefault();
              history.back();
            }
          } catch (_) {}
        });
      });
    });
  }

  function bindShareCopy() {
    document.querySelectorAll('.share-copy-btn').forEach(function (button) {
      button.addEventListener('click', function () {
        navigator.clipboard.writeText(button.dataset.copyUrl).then(function () {
          button.classList.add('copied');
          window.setTimeout(function () { button.classList.remove('copied'); }, 1500);
        });
      });
    });
  }

  function bindFestivalTabs() {
    var root = document.querySelector('.festival-design-v2');
    if (!root) return;
    var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-festival-tab]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-festival-panel]'));
    var valid = buttons.map(function (button) { return button.getAttribute('data-festival-tab'); });
    if (!buttons.length || !panels.length) return;
    function apply(tab, writeHash) {
      if (valid.indexOf(tab) < 0) tab = 'overview';
      root.classList.add('festival-tabs-ready');
      buttons.forEach(function (button) {
        var selected = button.getAttribute('data-festival-tab') === tab;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.setAttribute('tabindex', selected ? '0' : '-1');
        button.classList.toggle('is-active', selected);
      });
      panels.forEach(function (panel) {
        var active = panel.getAttribute('data-festival-panel') === tab;
        panel.classList.toggle('is-active', active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      if (writeHash && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', tab === 'overview' ? window.location.pathname + window.location.search : '#' + tab);
      }
      if (writeHash && tab !== 'overview') {
        document.dispatchEvent(new CustomEvent('tj:festival-section', { detail: { section: tab } }));
      }
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () { apply(button.getAttribute('data-festival-tab'), true); });
      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        var current = buttons.indexOf(button);
        var offset = event.key === 'ArrowRight' ? 1 : -1;
        var next = buttons[(current + offset + buttons.length) % buttons.length];
        next.focus();
        apply(next.getAttribute('data-festival-tab'), true);
      });
    });
    window.addEventListener('hashchange', function () { apply(window.location.hash.slice(1), false); });
    apply(window.location.hash.slice(1), false);
  }

  function bindFestivalFavorites() {
    var buttons = document.querySelectorAll('[data-festival-save]');
    var mounts = document.querySelectorAll('[data-festival-fav]');
    if (!buttons.length && !mounts.length) return;
    var update = function () {
      buttons.forEach(function (button) {
        var id = button.getAttribute('data-festival-save');
        var saved = window.tjFav && window.tjFav.has('festival', id);
        button.textContent = saved ? 'Saved' : 'Save';
        button.setAttribute('aria-pressed', saved ? 'true' : 'false');
      });
      mounts.forEach(function (mount) {
        var id = mount.getAttribute('data-festival-fav');
        var saved = window.tjFav && window.tjFav.has('festival', id);
        var heart = mount.querySelector('.tj-fav-heart');
        if (heart) heart.classList.toggle('active', saved);
      });
    };
    mounts.forEach(function (mount) {
      var id = mount.getAttribute('data-festival-fav');
      if (window.tjFav) window.tjFav.attachHeart(mount, 'festival', id);
    });
    buttons.forEach(function (button) {
      var id = button.getAttribute('data-festival-save');
      button.addEventListener('click', function () {
        if (window.tjFav) window.tjFav.toggle('festival', id);
        update();
      });
    });
    document.addEventListener('tj-fav-change', update);
    update();
  }

  function init() {
    bindHubBackLinks();
    bindShareCopy();
    bindFestivalTabs();
    bindFestivalFavorites();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
