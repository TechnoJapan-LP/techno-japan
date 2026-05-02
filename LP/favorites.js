/**
 * Favorites — localStorage-backed bookmarking for festivals, artists, venues.
 *
 * Public API:
 *   tjFav.toggle(type, id)     — toggle favorite, returns true if added
 *   tjFav.has(type, id)        — check if favorited
 *   tjFav.list(type)           — get array of favorite IDs for a type
 *   tjFav.attachHeart(el, type, id) — attach heart UI to an element
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'tj-favorites-v1';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { festival: [], artist: [], venue: [] };
    } catch (_) {
      return { festival: [], artist: [], venue: [] };
    }
  }

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  const tjFav = {
    has(type, id) {
      const data = load();
      return (data[type] || []).includes(id);
    },
    toggle(type, id) {
      const data = load();
      if (!data[type]) data[type] = [];
      const idx = data[type].indexOf(id);
      if (idx === -1) {
        data[type].push(id);
        save(data);
        document.dispatchEvent(new CustomEvent('tj-fav-change', { detail: { type, id, added: true } }));
        return true;
      } else {
        data[type].splice(idx, 1);
        save(data);
        document.dispatchEvent(new CustomEvent('tj-fav-change', { detail: { type, id, added: false } }));
        return false;
      }
    },
    list(type) {
      return load()[type] || [];
    },
    count() {
      const d = load();
      return (d.festival?.length || 0) + (d.artist?.length || 0) + (d.venue?.length || 0);
    },
    attachHeart(host, type, id, opts) {
      opts = opts || {};
      const btn = document.createElement('button');
      btn.className = 'tj-fav-heart' + (opts.size === 'sm' ? ' sm' : '');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Add to favorites');
      btn.innerHTML = heartSvg();
      const update = () => btn.classList.toggle('active', tjFav.has(type, id));
      update();
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        tjFav.toggle(type, id);
        update();
      });
      host.appendChild(btn);
      return btn;
    }
  };

  function heartSvg() {
    return '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>';
  }

  // Inject styles once
  function injectStyles() {
    if (document.getElementById('tj-fav-styles')) return;
    const style = document.createElement('style');
    style.id = 'tj-fav-styles';
    style.textContent = `
      .tj-fav-heart {
        background: rgba(8,8,8,0.6); border: 1px solid rgba(240,237,232,0.15);
        width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
        cursor: pointer; padding: 0; color: var(--text); opacity: 0.55;
        transition: opacity 0.25s ease, color 0.25s ease, background 0.25s ease, border-color 0.25s ease;
      }
      .tj-fav-heart svg { width: 14px; height: 14px; }
      .tj-fav-heart:hover { opacity: 1; }
      .tj-fav-heart.active { color: #ff2d2d; opacity: 1; border-color: rgba(255,45,45,0.5); }
      .tj-fav-heart.active svg path { fill: #ff2d2d; stroke: #ff2d2d; }
      .tj-fav-heart.sm { width: 26px; height: 26px; }
      .tj-fav-heart.sm svg { width: 12px; height: 12px; }

      .tj-fav-nav {
        font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.15em;
        text-transform: uppercase; opacity: 0.6; transition: opacity 0.3s ease;
        display: inline-flex; align-items: center; color: var(--text);
      }
      .tj-fav-nav:hover { opacity: 1; }
      .tj-fav-nav.has-favorites { color: #ff2d2d; opacity: 1; }
      .tj-fav-nav .tj-fav-count {
        font-size: 9px; letter-spacing: 0.1em;
      }
    `;
    document.head.appendChild(style);
  }

  injectStyles();
  window.tjFav = tjFav;

  // Auto-mount favorites link with counter in nav
  function mountNavLink() {
    document.querySelectorAll('nav .nav-links').forEach(navLinks => {
      if (navLinks.querySelector('.tj-fav-nav')) return;
      const link = document.createElement('a');
      link.href = '/favorites.html';
      link.className = 'tj-fav-nav';
      link.innerHTML = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;vertical-align:middle"><path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11z" stroke="currentColor" stroke-width="1.6" fill="none"/></svg> <span class="tj-fav-count" style="margin-left:4px"></span>`;
      // Insert before search trigger if exists, else append
      const searchTrigger = navLinks.querySelector('.gs-trigger');
      if (searchTrigger) navLinks.insertBefore(link, searchTrigger);
      else navLinks.appendChild(link);
    });
    updateCount();
  }

  function updateCount() {
    const c = tjFav.count();
    document.querySelectorAll('.tj-fav-count').forEach(el => {
      el.textContent = c > 0 ? c : '';
    });
    document.querySelectorAll('.tj-fav-nav').forEach(el => {
      el.classList.toggle('has-favorites', c > 0);
    });
  }

  document.addEventListener('tj-fav-change', updateCount);

  if (document.readyState !== 'loading') mountNavLink();
  else document.addEventListener('DOMContentLoaded', mountNavLink);
})();
