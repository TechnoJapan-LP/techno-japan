/* ============================================================
   TECHNO JAPAN — common.js
   Shared cursor + scroll-reveal behavior loaded by every page.
   Page-specific scripts remain inline in each HTML file.
   Exposes window.tjBindCursorExpand(selector) for pages that
   need extra hover targets (cards, etc.) beyond plain links.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- CUSTOM CURSOR ---------- */
  function ensureCursorElement(className) {
    const existing = document.querySelector('.' + className);
    if (existing) return existing;
    const element = document.createElement('div');
    element.className = className;
    element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(element);
    return element;
  }

  // Hand-written pages already contain these nodes. Reuse them when present,
  // and create only the missing node(s) on generated detail pages.
  const dot = ensureCursorElement('cursor-dot');
  const ring = ensureCursorElement('cursor-ring');
  let mouseX = 0, mouseY = 0, ringX = 0, ringY = 0;

  if (dot && ring) {
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
    });

    function animateRing() {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    /* Default hover targets — every link expands the ring. */
    bindCursorExpand('a');
  }

  function bindCursorExpand(selector) {
    if (!ring) return;
    document.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.tjCursor === '1') return;
      el.dataset.tjCursor = '1';
      el.addEventListener('mouseenter', () => {
        ring.style.width = '52px';
        ring.style.height = '52px';
      });
      el.addEventListener('mouseleave', () => {
        ring.style.width = '36px';
        ring.style.height = '36px';
      });
    });
  }
  window.tjBindCursorExpand = bindCursorExpand;

  /* ---------- SCROLL REVEAL ---------- */
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const children = entry.target.querySelectorAll('.reveal');
          if (children.length) {
            children.forEach((child, i) => {
              child.style.transitionDelay = (i * 100) + 'ms';
              child.classList.add('visible');
            });
          }
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    reveals.forEach((el) => observer.observe(el));
  }
  window.tjInitScrollReveal = initScrollReveal;

  /* ---------- MOBILE NAV STATE ---------- */
  function initMobileNav() {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const update = () => {
      const scrolled = window.scrollY > 24;
      nav.classList.toggle('nav-scrolled', scrolled);
      if (window.innerWidth <= 900) {
        nav.style.backgroundColor = scrolled ? 'rgba(8,8,8,0.78)' : 'transparent';
        nav.style.borderBottomColor = scrolled ? 'rgba(240,237,232,0.12)' : 'transparent';
        nav.style.backdropFilter = scrolled ? 'blur(12px)' : 'none';
        nav.style.webkitBackdropFilter = scrolled ? 'blur(12px)' : 'none';
        nav.style.mixBlendMode = scrolled ? 'normal' : 'difference';
      }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* Keep the full-screen menu pinned to the current viewport, even when it
     is opened deep inside a long page. Opening and closing are handled here
     (onclick attributes removed on 2026-09-24 in preparation for CSP nonces). */
  function initMobileNavOverlay() {
    const overlay = document.querySelector('.nav-overlay');
    if (!overlay) return;
    const normalizePath = (value) => {
      const path = value.replace(/\/+$/, '') || '/';
      return path === '/index.html' ? '/' : path;
    };
    const navRoute = (value) => {
      const path = normalizePath(value).replace(/^\/en(?=\/|$)/, '') || '/';
      if (path === '/' || path === '/index.html') return '/';
      if (/^\/articles(?:\/|$)/.test(path)) return '/news.html';
      if (/^\/festivals(?:\/|$)/.test(path)) return '/festivals.html';
      if (/^\/artists(?:\/|$)/.test(path)) return '/artists.html';
      if (/^\/venues(?:\/|$)/.test(path)) return '/venues.html';
      return path;
    };
    const currentPath = navRoute(location.pathname);
    const addLink = (label, href) => {
      const targetHref = document.documentElement.lang === 'en' && /^\/(submit|writers)\.html$/.test(href) ? '/en' + href : href;
      if ([...overlay.querySelectorAll(':scope > a')].some((a) => normalizePath(new URL(a.href, location.origin).pathname) === normalizePath(targetHref))) return;
      const a = document.createElement('a');
      a.href = targetHref;
      a.textContent = label;
      overlay.insertBefore(a, overlay.querySelector(':scope > .nav-lang, :scope > .nav-overlay-social') || null);
    };
    addLink('APPLY', '/submit.html');
    addLink('WRITER', '/writers.html');
    overlay.querySelectorAll(':scope > a[href]').forEach((a) => {
      if (navRoute(new URL(a.href, location.origin).pathname) === currentPath) a.setAttribute('aria-current', 'page');
    });
    const moveSearchLink = () => {
      const searchLink = [...overlay.querySelectorAll(':scope > a')].find((a) => a.textContent.trim() === 'SEARCH');
      const lang = overlay.querySelector(':scope > .nav-lang');
      if (!searchLink || !lang) return;
      searchLink.classList.add('nav-search-link');
      if (searchLink.nextElementSibling !== lang) overlay.insertBefore(searchLink, lang);
    };
    moveSearchLink();
    new MutationObserver(moveSearchLink).observe(overlay, { childList: true });
    if (!overlay.querySelector(':scope > .nav-overlay-social')) {
      const social = document.createElement('span');
      social.className = 'nav-overlay-social';
      social.innerHTML = '<a href="https://www.instagram.com/techno.japan_/" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none"/></svg></a><a href="https://www.threads.net/@techno.japan_" target="_blank" rel="noopener" aria-label="Threads"><svg viewBox="0 0 976.98 1082" fill="currentColor" aria-hidden="true"><path d="M770.35 500.35c-1.35-156.85-86.39-251.37-230.02-251.37-95.87 0-176.5 43.36-218.85 112.47l92.82 64.71c24.05-37.94 57.25-69.45 118.23-69.45 68.77 0 104.34 38.28 114.5 109.42-33.2-5.08-66.4-7.79-100.61-7.79-185.65 0-273.05 84.02-273.05 195.13s87.4 179.55 216.14 179.55c141.27 0 225.62-95.19 260.18-213.09 35.91 16.26 60.64 54.2 60.64 111.12 0 152.45-175.82 235.45-324.88 235.45-219.86 0-363.5-144.32-363.5-379.08 0-287.62 190.05-471.91 445.48-471.91 171.42 0 256.11 75.21 313.7 176.16l94.86-66.4C913.31 94.5 773.4 1 563.36 1 228.65 1 1 238.48 1 583.01c0 315.06 222.91 497.99 488.51 497.99 219.52 0 441.42-128.05 441.42-347.24 0-114.5-65.72-190.39-160.58-233.41zM485.44 718.85c-48.44 0-91.13-23.04-91.13-65.38 0-66.74 81.98-87.06 162.27-87.06 30.49 0 60.3 2.03 86.72 7.79-18.97 86.72-75.21 144.66-157.87 144.66z"/></svg></a>';
      overlay.appendChild(social);
    }
    const articles = typeof ARTICLES !== 'undefined' && Array.isArray(ARTICLES)
      ? ARTICLES.filter((a) => String(a?.status || '').toLowerCase() !== 'draft').sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3)
      : [];
    if (articles.length) {
      const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
      const local = (article, key) => typeof window.tjLocalized === 'function' ? window.tjLocalized(article[key], article[key + '_ja'], article[key + '_en']) : (article[key + '_en'] || article[key] || '');
      const latest = document.createElement('div');
      latest.className = 'nav-latest';
      latest.innerHTML = '<div class="nav-latest-title">LATEST</div>' + articles.map((a) => {
        const prefix = document.documentElement.lang === 'en' ? '/en' : '';
        return '<a class="nav-latest-card" href="' + prefix + '/articles/' + encodeURIComponent(a.id) + '.html"><span>' + esc((a.tags?.[0] || 'ARTICLE').toUpperCase()) + '</span><strong>' + esc(local(a, 'title')) + '</strong><small>' + esc(local(a, 'excerpt')) + ' · ' + esc(a.date || '') + '</small></a>';
      }).join('');
      overlay.appendChild(latest);
    }
    const sync = () => {
      const open = overlay.classList.contains('active');
      document.documentElement.classList.toggle('nav-open', open);
      document.body.classList.toggle('nav-open', open);
    };
    document.addEventListener('click', (event) => {
      const hamburger = event.target.closest('.nav-hamburger');
      const close = event.target.closest('.nav-close, .nav-overlay a');
      const back = event.target.closest('.nav-back');
      if (hamburger) {
        overlay.classList.toggle('active');
        hamburger.classList.toggle('active');
      } else if (back) {
        overlay.classList.remove('active');
        document.querySelector('.nav-hamburger')?.classList.remove('active');
        history.back();
      } else if (close) {
        overlay.classList.remove('active');
        document.querySelector('.nav-hamburger')?.classList.remove('active');
      } else {
        return;
      }
      window.setTimeout(sync, 0);
    });
    sync();
  }

  /* Auto-init on DOM ready (or immediately if already parsed). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initScrollReveal();
      initMobileNav();
      initMobileNavOverlay();
    });
  } else {
    initScrollReveal();
    initMobileNav();
    initMobileNavOverlay();
  }
})();

/* ============================================================
   TECHNO JAPAN — アナリティクス（GA4 カスタムイベント）
   価値の高いユーザー行動だけを計測する。gtag が無い環境（
   ボット除外や広告ブロック）でも無害に no-op になる。
   ============================================================ */
(function () {
  'use strict';
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (_) {}
  }
  window.tjTrack = track;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* Article card photo → static article hero. This is enhancement-only: never cancel navigation. */
    function setArticleHeroTransition(link) {
      var img = link && link.querySelector('img');
      if (!img) return;
      document.querySelectorAll('img').forEach(function (node) { node.style.viewTransitionName = ''; });
      img.style.viewTransitionName = 'tj-hero';
    }
    document.addEventListener('pointerdown', function (event) {
      var link = event.target.closest && event.target.closest('.related-story-card');
      if (link) setArticleHeroTransition(link);
    }, { passive: true });
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('.related-story-card');
      if (link) setArticleHeroTransition(link);
    });

    /* 1) お気に入り登録/解除（何が人気か） */
    document.addEventListener('tj-fav-change', function (e) {
      var d = e.detail || {};
      track(d.added ? 'favorite_add' : 'favorite_remove', {
        item_type: d.type,          // festival / artist / venue
        item_id: d.id
      });
    });

    /* 2) 外部リンク遷移（チケット/公式/SNS のどれが押されるか） */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;                 // 内部リンクは対象外
      if (a.hostname === location.hostname) return;
      var kind = 'external';
      if (/instagram\.com/i.test(href)) kind = 'instagram';
      else if (/twitter\.com|x\.com|threads\.net/i.test(href)) kind = 'social';
      else if (/ticket|eplus|peatix|zaiko|resident|linktr/i.test(href)) kind = 'ticket';
      track('outbound_click', { link_domain: a.hostname, link_kind: kind, link_url: href.slice(0, 200) });
    }, true);

    /* 3) 言語切替（JA/EN どちらの需要が大きいか） */
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.nav-lang a');
      if (!a) return;
      track('language_switch', {
        to_lang: /\/en\//.test(a.getAttribute('href') || '') ? 'en' : 'ja',
        from_path: location.pathname
      });
    }, true);

    /* 4) 記事の読了（本当に最後まで読まれた記事はどれか）
          記事本文がある時だけ、末尾が一度でも見えたら1回送る。 */
    var body = document.querySelector('.article-body');
    if (body && 'IntersectionObserver' in window) {
      var sent = false;
      var end = document.createElement('span');
      end.setAttribute('aria-hidden', 'true');
      body.appendChild(end);
      var io = new IntersectionObserver(function (entries) {
        if (sent) return;
        if (entries.some(function (x) { return x.isIntersecting; })) {
          sent = true;
          track('article_read_complete', { page_path: location.pathname });
          io.disconnect();
        }
      }, { threshold: 0 });
      io.observe(end);
    }

    /* 5) フェス詳細の「何を見に来たか」を測る（2026-09-13）。
          検索の入口は「フェス名＋年」が大多数で、ラインナップ/アクセスへの
          関心は着地後の行動でしか分からない。セクション到達と
          リンク種別をフェス単位で数える。gtag が無ければ全て no-op。 */
    var festRoot = document.querySelector('.festival-detail-page');
    if (festRoot) {
      var festId = (location.pathname.match(/\/festivals\/([^/]+)\.html$/) || [])[1] || '';
      var festLang = document.documentElement.lang === 'en' ? 'en' : 'ja';

      // 5-1) セクション到達（1ページ1回だけ送る）
      if ('IntersectionObserver' in window) {
        var sections = [
          ['lineup',   '.festival-program-section'],
          ['editions', '.festival-editions-v2'],
          ['faq',      '.festival-faq'],
          ['related',  '.related-festivals']
        ];
        var seen = {};
        var sectionIo = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var key = entry.target.getAttribute('data-tj-section');
            if (!key || seen[key]) return;
            seen[key] = true;
            track('festival_section_view', { section: key, festival_id: festId, page_lang: festLang });
            sectionIo.unobserve(entry.target);
          });
        // 巨大なセクションは threshold では発火しないため、rootMargin で判定する。
        }, { threshold: 0, rootMargin: '0px 0px -25% 0px' });
        sections.forEach(function (pair) {
          var el = festRoot.querySelector(pair[1]);
          if (!el) return;
          el.setAttribute('data-tj-section', pair[0]);
          sectionIo.observe(el);
        });
      }

      // 5-2) リンククリックをフェス単位で（外部・内部の両方）。
      // 既存の outbound_click はサイト全体の外部遷移用なので、重複送信を許容する。
      festRoot.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var kind = '';
        if (a.classList.contains('festival-ticket-link')) kind = 'ticket';
        else if (a.classList.contains('festival-official-link')) kind = 'official';
        else if (a.classList.contains('festival-social-link')) kind = 'social';
        else if (a.classList.contains('lineup-item')) kind = 'lineup_artist';
        else if (a.closest('.related-card')) kind = 'related_festival';
        else if (a.classList.contains('share-btn')) kind = 'share';
        if (!kind) return;
        track('festival_link_click', {
          link_kind: kind,
          festival_id: festId,
          page_lang: festLang,
          link_target: href.slice(0, 100)
        });
      }, true);
    }
  });
})();
