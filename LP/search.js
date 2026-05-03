/**
 * Global search — searches across FESTIVALS, ARTISTS, VENUES, EVENTS, ARTICLES (本文含む).
 * Loaded on every page; opens a fullscreen modal on trigger.
 */
(function() {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(() => {
    if (typeof FESTIVALS === 'undefined' && typeof ARTISTS === 'undefined') {
      console.warn('[search] data.js not loaded; skipping search.');
      return;
    }
    initSearch();
  });

  function initSearch() {
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'global-search-modal';
    modal.innerHTML = `
      <div class="gs-overlay"></div>
      <div class="gs-panel">
        <div class="gs-input-wrap">
          <svg class="gs-icon" viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          <input type="text" id="gs-input" placeholder="Search festivals, artists, venues, articles..." autocomplete="off">
          <button class="gs-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="gs-results" id="gs-results">
          <div class="gs-hint">Try typing a festival name, artist, city, or genre</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #global-search-modal { position: fixed; inset: 0; z-index: 10500; display: none; }
      #global-search-modal.active { display: block; }
      .gs-overlay { position: absolute; inset: 0; background: rgba(8,8,8,0.92); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      .gs-panel { position: relative; max-width: 720px; margin: 80px auto 0; padding: 0 24px; }
      .gs-input-wrap { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border: 1px solid rgba(240,237,232,0.15); background: rgba(8,8,8,0.5); }
      .gs-icon { width: 18px; height: 18px; color: rgba(240,237,232,0.5); flex-shrink: 0; }
      #gs-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-family: var(--font-mono); font-size: 14px; letter-spacing: 0.05em; }
      #gs-input::placeholder { color: rgba(240,237,232,0.3); }
      .gs-close { background: none; border: none; color: var(--text); font-size: 24px; line-height: 1; opacity: 0.5; cursor: pointer; padding: 0 8px; }
      .gs-close:hover { opacity: 1; }
      .gs-results { margin-top: 24px; max-height: 70vh; overflow-y: auto; padding-bottom: 40px; }
      .gs-hint { padding: 40px 20px; text-align: center; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; opacity: 0.3; }
      .gs-group { margin-bottom: 24px; }
      .gs-group-label { font-family: var(--font-mono); font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; opacity: 0.4; padding: 8px 20px; border-bottom: 1px solid rgba(240,237,232,0.06); }
      .gs-result { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(240,237,232,0.04); cursor: pointer; transition: background 0.2s ease; }
      .gs-result:hover, .gs-result.gs-active { background: rgba(240,237,232,0.06); }
      .gs-result.gs-active { border-left: 2px solid #ff2d2d; padding-left: 18px; }
      .gs-result { flex-direction: column; align-items: stretch; gap: 4px; }
      .gs-result-name { font-family: var(--font-display); font-size: 16px; text-transform: uppercase; }
      .gs-result-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.05em; opacity: 0.5; line-height: 1.5; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
      .gs-empty { padding: 40px 20px; text-align: center; font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; opacity: 0.3; }

      /* Search trigger button (placed in nav) */
      .gs-trigger {
        background: none; border: none; color: var(--text); cursor: pointer;
        padding: 0; opacity: 0.6; transition: opacity 0.3s ease;
        display: inline-flex; align-items: center;
      }
      .gs-trigger:hover { opacity: 1; }
      .gs-trigger svg { width: 16px; height: 16px; }
      @media (max-width: 768px) {
        .gs-panel { margin-top: 60px; padding: 0 16px; }
      }
    `;
    document.head.appendChild(style);

    const input = document.getElementById('gs-input');
    const results = document.getElementById('gs-results');

    function open() {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => input.focus(), 50);
    }

    function close() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      input.value = '';
      results.innerHTML = '<div class="gs-hint">Try typing a festival name, artist, city, or genre</div>';
    }

    modal.querySelector('.gs-close').addEventListener('click', close);
    modal.querySelector('.gs-overlay').addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && modal.classList.contains('active')) close();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        modal.classList.contains('active') ? close() : open();
      }
    });

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => doSearch(input.value), 150);
    });

    // Keyboard navigation: arrows + enter
    let activeIdx = -1;
    function getResultEls() { return Array.from(results.querySelectorAll('.gs-result')); }
    function setActive(idx) {
      const els = getResultEls();
      if (!els.length) return;
      activeIdx = (idx + els.length) % els.length;
      els.forEach((el, i) => el.classList.toggle('gs-active', i === activeIdx));
      els[activeIdx].scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeIdx + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeIdx - 1);
      } else if (e.key === 'Enter') {
        const els = getResultEls();
        if (activeIdx >= 0 && els[activeIdx]) {
          e.preventDefault();
          els[activeIdx].click();
        } else if (els[0]) {
          e.preventDefault();
          els[0].click();
        }
      }
    });

    // Reset active index when results re-render
    const observer = new MutationObserver(() => { activeIdx = -1; });
    observer.observe(results, { childList: true });

    // Add trigger to nav — group it with the social icons cluster
    document.querySelectorAll('nav .nav-links').forEach(navLinks => {
      const trigger = document.createElement('button');
      trigger.className = 'gs-trigger';
      trigger.setAttribute('aria-label', 'Search');
      trigger.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
      trigger.addEventListener('click', open);
      const socialGroup = navLinks.querySelector('.nav-social');
      if (socialGroup) socialGroup.appendChild(trigger);
      else navLinks.appendChild(trigger);
    });

    // Add to mobile nav overlay
    document.querySelectorAll('.nav-overlay').forEach(overlay => {
      // Insert as a separate link
      const closeBtn = overlay.querySelector('.nav-close');
      if (closeBtn) {
        const searchLink = document.createElement('a');
        searchLink.href = '#';
        searchLink.textContent = 'SEARCH';
        searchLink.style.cssText = 'cursor:pointer';
        searchLink.addEventListener('click', e => {
          e.preventDefault();
          overlay.classList.remove('active');
          document.querySelector('.nav-hamburger')?.classList.remove('active');
          setTimeout(open, 200);
        });
        // Insert before ABOUT (first <a> after close)
        const firstA = overlay.querySelector('a');
        if (firstA) overlay.insertBefore(searchLink, firstA);
      }
    });

    // Expose for external triggers
    window.openGlobalSearch = open;
  }

  function doSearch(q) {
    const results = document.getElementById('gs-results');
    q = q.trim().toLowerCase();
    if (!q) {
      results.innerHTML = '<div class="gs-hint">Try typing a festival name, artist, city, or genre</div>';
      return;
    }

    const groups = [];

    // Festivals
    if (typeof FESTIVALS !== 'undefined') {
      const matches = FESTIVALS.filter(f => {
        if (!f.name) return false;
        return f.name.toLowerCase().includes(q) ||
               (f.city || '').toLowerCase().includes(q) ||
               (f.location || '').toLowerCase().includes(q) ||
               (f.genre || []).join(' ').toLowerCase().includes(q);
      }).slice(0, 6);
      if (matches.length) {
        groups.push({
          label: 'FESTIVALS',
          items: matches.map(f => ({
            name: f.name,
            meta: [f.city, (f.genre || []).join(' / ')].filter(Boolean).join(' — '),
            url: `festivals.html#festival/${f.id}`
          }))
        });
      }
    }

    // Artists
    if (typeof ARTISTS !== 'undefined') {
      const matches = ARTISTS.filter(a => {
        if (!a.name) return false;
        return a.name.toLowerCase().includes(q) ||
               (a.city || '').toLowerCase().includes(q) ||
               (a.country || '').toLowerCase().includes(q) ||
               (Array.isArray(a.genre) ? a.genre.join(' ') : a.genre || '').toLowerCase().includes(q);
      }).slice(0, 6);
      if (matches.length) {
        groups.push({
          label: 'ARTISTS',
          items: matches.map(a => ({
            name: a.name,
            meta: [a.city || a.country, Array.isArray(a.genre) ? a.genre.join(' / ') : a.genre].filter(Boolean).join(' — '),
            url: `artists.html#artist/${a.id}`
          }))
        });
      }
    }

    // Venues
    if (typeof VENUES !== 'undefined') {
      const matches = VENUES.filter(v => {
        if (!v.name || !v.city || v.city === 'undefined') return false;
        return v.name.toLowerCase().includes(q) ||
               v.city.toLowerCase().includes(q) ||
               (v.area || '').toLowerCase().includes(q) ||
               (Array.isArray(v.genre) ? v.genre.join(' ') : v.genre || '').toLowerCase().includes(q);
      }).slice(0, 6);
      if (matches.length) {
        groups.push({
          label: 'VENUES',
          items: matches.map(v => ({
            name: v.name,
            meta: [v.city, v.area].filter(Boolean).join(' — '),
            url: `venues.html#venue/${v.id}`
          }))
        });
      }
    }

    // Events (filter by upcoming only or any)
    if (typeof EVENTS !== 'undefined') {
      const matches = EVENTS.filter(e => {
        if (!e.name) return false;
        return e.name.toLowerCase().includes(q) ||
               (e.city || '').toLowerCase().includes(q) ||
               (e.venue || '').toLowerCase().includes(q);
      }).slice(0, 6);
      if (matches.length) {
        groups.push({
          label: 'EVENTS',
          items: matches.map(e => ({
            name: e.name,
            meta: [e.date, e.venue, e.city].filter(Boolean).join(' — '),
            url: `events.html`
          }))
        });
      }
    }

    // Articles (本文も含めた全文検索)
    if (typeof ARTICLES !== 'undefined') {
      const stripHtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ');
      const matches = ARTICLES.filter(a => {
        if (!a.title) return false;
        // Drafts や status未設定 (=published扱い) を含める
        if (a.status && a.status !== 'published') return false;
        return a.title.toLowerCase().includes(q) ||
               (a.excerpt || '').toLowerCase().includes(q) ||
               (a.category || '').toLowerCase().includes(q) ||
               (Array.isArray(a.tags) ? a.tags.join(' ') : (a.tags || '')).toLowerCase().includes(q) ||
               stripHtml(a.body).toLowerCase().includes(q);
      }).slice(0, 6);
      if (matches.length) {
        groups.push({
          label: 'ARTICLES',
          items: matches.map(a => {
            // body にヒットした場合は本文の一部をスニペット表示
            const inBody = stripHtml(a.body).toLowerCase().includes(q) &&
                           !a.title.toLowerCase().includes(q) &&
                           !(a.excerpt || '').toLowerCase().includes(q);
            let meta = [a.category, a.date].filter(Boolean).join(' — ');
            if (inBody) {
              const stripped = stripHtml(a.body);
              const idx = stripped.toLowerCase().indexOf(q);
              const start = Math.max(0, idx - 40);
              const end = Math.min(stripped.length, idx + q.length + 60);
              const snip = (start > 0 ? '...' : '') + stripped.slice(start, end).trim() + (end < stripped.length ? '...' : '');
              meta = snip;
            } else if (a.excerpt && a.excerpt.toLowerCase().includes(q)) {
              meta = a.excerpt.slice(0, 100);
            }
            return {
              name: a.title,
              meta: meta,
              url: `news.html#article/${a.id}`
            };
          })
        });
      }
    }

    if (!groups.length) {
      results.innerHTML = '<div class="gs-empty">No results found</div>';
      return;
    }

    results.innerHTML = groups.map(g => `
      <div class="gs-group">
        <div class="gs-group-label">${g.label} (${g.items.length})</div>
        ${g.items.map(it => `
          <a href="${it.url}" class="gs-result">
            <div class="gs-result-name">${escapeHtml(it.name)}</div>
            <div class="gs-result-meta">${escapeHtml(it.meta)}</div>
          </a>
        `).join('')}
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
