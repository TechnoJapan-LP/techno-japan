(() => {
  'use strict';

  const NEWS_HUB_STATE_KEY = 'tj:news-hub-state:v1';
  const NEWS_QUERY_KEYS = ['category', 'tag', 'limit'];
  const isEnglish = document.documentElement.lang === 'en';
  const published = (typeof ARTICLES !== 'undefined' ? ARTICLES : [])
    .filter((article) => String(article?.status || '').toLowerCase() !== 'draft');
  const state = { category: 'ALL', tag: null, visible: 12 };

  const escapeHtml = (value) => (
    typeof tjEscapeHtml === 'function'
      ? tjEscapeHtml(String(value ?? ''))
      : String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      }[character]))
  );

  const localized = (article, key) => (
    typeof tjLocalized === 'function'
      ? tjLocalized(article[key], '', article[`${key}_en`])
      : (isEnglish ? (article[`${key}_en`] || article[key] || '') : (article[key] || article[`${key}_en`] || ''))
  );

  const articleDetailHref = (article) => `${isEnglish ? '/en' : ''}/articles/${encodeURIComponent(article.id)}.html`;
  const sortNewest = (left, right) => new Date(right.date) - new Date(left.date);
  const dateDots = (date) => String(date || '').replace(/-/g, '.');
  const latestDate = () => dateDots([...published].sort(sortNewest)[0]?.date);

  function splitTitle(value) {
    const text = String(value || '');
    const separator = text.search(/[｜|]/);
    if (separator < 0) return { title: text.trim(), sub: '' };
    return { title: text.slice(0, separator).trim(), sub: text.slice(separator + 1).trim() };
  }

  function titleMarkup(article, headingTag) {
    const parts = splitTitle(localized(article, 'title'));
    const shortTitle = typeof tjNoBreakNames === 'function' ? tjNoBreakNames(parts.title) : escapeHtml(parts.title);
    return `<${headingTag} class="disp news-title"><span class="news-title-main">${shortTitle}</span></${headingTag}>${parts.sub ? `<p class="sub news-title-sub">${escapeHtml(parts.sub)}</p>` : ''}`;
  }

  function imageMarkup(article, kind, eager = false) {
    if (!article.image) return '<span class="news-image-placeholder" aria-hidden="true"></span>';
    const sizes = {
      lead: '(max-width: 900px) calc(100vw - 32px), 58vw',
      wide: '(max-width: 900px) calc(100vw - 32px), (max-width: 1360px) calc(50vw - 60px), 620px',
      three: '(max-width: 900px) calc(100vw - 32px), (max-width: 1360px) calc(33vw - 40px), 405px',
      list: '(max-width: 900px) 120px, 260px',
    }[kind];
    const src = typeof tjCardAssetPath === 'function' ? tjCardAssetPath(article.image) : article.image;
    const srcset = kind === 'list' ? tjCardSrcsetAttr(article.image, sizes) : tjHeroSrcsetAttr(article.image, sizes);
    const dimensions = typeof tjImageSizeAttrs === 'function' ? tjImageSizeAttrs(article.image) : '';
    return `<img ${dimensions}${srcset} src="${escapeHtml(src)}" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async" alt="${escapeHtml(localized(article, 'title'))}">`;
  }

  function metaMarkup(article, featured = false) {
    return `<div class="mono red news-meta">${featured ? 'Feature · ' : ''}${escapeHtml(article.category || '')} · ${escapeHtml(dateDots(article.date))}</div>`;
  }

  function cardMarkup(article, kind, featured = false, index = 0) {
    const className = kind === 'list' ? 'news-list-card news-card' : `news-card news-${kind}-card`;
    const copy = `${metaMarkup(article, featured)}
  ${titleMarkup(article, 'h3')}`;
    return `<a class="${className}" href="${articleDetailHref(article)}" data-article-detail-link>
  <div class="news-image news-image-${kind}">${imageMarkup(article, kind)}</div>
  ${kind === 'list' ? `<div class="news-list-copy">${copy}</div>` : copy}
</a>`;
  }

  function sanitizeTag(raw) {
    const value = String(raw == null ? '' : raw).trim();
    if (!value || value.length > 64) return null;
    const known = new Set(published.flatMap((article) => Array.isArray(article.tags) ? article.tags.map(String) : []));
    const existing = [...known].find((tag) => tag.toLowerCase() === value.toLowerCase());
    if (existing) return existing;
    return /^[\w-]+$/.test(value) ? value : null;
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(location.search);
    if (params.get('category')) state.category = params.get('category').toUpperCase();
    if (params.get('tag')) state.tag = sanitizeTag(params.get('tag'));
    const limit = Number(params.get('limit'));
    if (Number.isInteger(limit) && limit >= 12) state.visible = limit;
    const articleMatch = location.hash.match(/^#article\/([^/?#]+)/);
    if (articleMatch) {
      const id = decodeURIComponent(articleMatch[1]);
      const article = published.find((item) => item.id === id);
      location.replace(article ? articleDetailHref(article) : `/articles/${encodeURIComponent(id)}.html`);
      return false;
    }
    if (location.hash.startsWith('#tag/')) {
      state.tag = sanitizeTag(decodeURIComponent(location.hash.slice(5)));
      state.category = 'ALL';
      syncUrl();
    }
    return true;
  }

  function syncUrl() {
    const url = new URL(location.href);
    NEWS_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
    if (state.category !== 'ALL') url.searchParams.set('category', state.category);
    if (state.tag) url.searchParams.set('tag', state.tag);
    if (state.visible > 12) url.searchParams.set('limit', String(state.visible));
    url.hash = '';
    history.replaceState(null, '', url);
  }

  function saveHubState() {
    sessionStorage.setItem(NEWS_HUB_STATE_KEY, JSON.stringify({ url: location.href, scrollY, savedAt: Date.now() }));
  }

  function restoreHubScroll() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(NEWS_HUB_STATE_KEY) || 'null');
      if (!saved || saved.url !== location.href || Date.now() - saved.savedAt > 30 * 60 * 1000) return;
      sessionStorage.removeItem(NEWS_HUB_STATE_KEY);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(0, saved.scrollY)));
    } catch (_) {
      // sessionStorage が使えない環境では復元を省略する。
    }
  }

  function filteredArticles() {
    return [...published].sort(sortNewest).filter((article) => {
      const categoryMatches = state.category === 'ALL' || String(article.category || '').toUpperCase() === state.category;
      const tagMatches = !state.tag || (Array.isArray(article.tags) && article.tags.some((tag) => String(tag).toLowerCase() === state.tag.toLowerCase()));
      return categoryMatches && tagMatches;
    });
  }

  function renderCategoryNav() {
    const nav = document.getElementById('category-nav');
    const categories = ['ALL', ...new Set(published.map((article) => String(article.category || '').toUpperCase()).filter(Boolean))];
    const tagChip = state.tag
      ? `<button class="chip is-active tag-filter-chip" type="button" data-clear-tag aria-label="${isEnglish ? 'Clear tag filter' : 'タグの絞り込みを解除'}" aria-pressed="true">#${escapeHtml(state.tag)} ×</button>`
      : '';
    nav.innerHTML = `${tagChip}${categories.map((category) => `<button class="chip${state.category === category && !state.tag ? ' is-active' : ''}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${state.category === category && !state.tag}">${escapeHtml(category)}</button>`).join('')}`;
  }

  function render() {
    const items = filteredArticles();
    const visible = items.slice(0, state.visible);
    const lead = visible[0];
    const wide = visible.slice(1, 3);
    const pool = items.slice(3);
    const featured = pool.filter((article) => article.featured === true);
    const regular = pool.filter((article) => article.featured !== true);
    const three = [...featured, ...regular].slice(0, 3);
    const used = new Set([...(lead ? [lead] : []), ...wide, ...three].map((article) => article.id));
    const rest = visible.filter((article) => !used.has(article.id));
    const empty = isEnglish ? 'No stories in this category.' : 'このカテゴリの記事はありません。';
    document.getElementById('news-count').textContent = `${items.length} stories`;
    document.getElementById('news-updated').textContent = `Updated ${latestDate()}`;
    renderCategoryNav();
    document.getElementById('news-featured').innerHTML = lead
      ? `<a class="news-lead" href="${articleDetailHref(lead)}" data-article-detail-link>
  <div class="news-image news-image-lead">${imageMarkup(lead, 'lead', true)}</div>
  <div class="news-copy">
    <div class="news-meta"><span class="pill">${escapeHtml(lead.category || '')}</span><span class="mono">${escapeHtml(dateDots(lead.date))}</span></div>
    ${titleMarkup(lead, 'h2')}
    ${localized(lead, 'excerpt') ? `<p class="news-excerpt">${escapeHtml(localized(lead, 'excerpt'))}</p>` : ''}
    <span class="mono news-read">Read →</span>
  </div>
</a>`
      : `<p class="news-empty">${empty}</p>`;
    document.getElementById('news-two-section').innerHTML = wide.length
      ? `<div class="news-grid">${wide.map((article, index) => cardMarkup(article, 'wide', false, index)).join('')}</div>` : '';
    document.getElementById('news-three-section').innerHTML = three.length
      ? `<div class="news-three">${three.map((article, index) => cardMarkup(article, 'three', article.featured === true, index)).join('')}</div>` : '';
    document.getElementById('feed-grid').innerHTML = rest.map((article) => cardMarkup(article, 'list')).join('');
    document.getElementById('news-shown').textContent = `${Math.min(state.visible, items.length)} / ${items.length}`;
    document.getElementById('load-more-btn').hidden = state.visible >= items.length;
    bindArticleNavigation();
    document.documentElement.classList.remove('tj-news-hydrating');
  }

  function bindArticleNavigation() {
    document.querySelectorAll('[data-article-detail-link]:not([data-news-state-bound])').forEach((link) => {
      link.dataset.newsStateBound = 'true';
      link.addEventListener('click', saveHubState);
    });
  }

  document.getElementById('category-nav').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-clear-tag')) state.tag = null;
    if (button.dataset.category) {
      state.category = button.dataset.category;
      if (state.category === 'ALL') state.tag = null;
    }
    state.visible = 12;
    syncUrl();
    render();
  });
  document.getElementById('load-more-btn').addEventListener('click', () => {
    state.visible += 6;
    syncUrl();
    render();
  });

  if (readStateFromUrl()) {
    render();
    addEventListener('pageshow', restoreHubScroll);
  } else {
    document.documentElement.classList.remove('tj-news-hydrating');
  }
})();
