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

  /* Auto-init on DOM ready (or immediately if already parsed). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initScrollReveal();
      initMobileNav();
    });
  } else {
    initScrollReveal();
    initMobileNav();
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
  });
})();
