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
  const dot = document.querySelector('.cursor-dot');
  const ring = document.querySelector('.cursor-ring');
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

  /* Auto-init on DOM ready (or immediately if already parsed). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollReveal);
  } else {
    initScrollReveal();
  }
})();
