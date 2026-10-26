/* ARTISTS phase 3-3: filtered featured carousel and indexed grid. */
(function () {
  'use strict';

  var root = document.getElementById('artists-phase3');
  if (!root) return;
  var isEn = document.documentElement.lang === 'en';
  var esc = window.tjEscapeHtml || function (value) { return String(value == null ? '' : value); };
  var loc = window.tjLocalized || function (primary, ja, en) { return isEn ? (en || primary || ja || '') : (primary || ja || en || ''); };
  var artists = (typeof ARTISTS !== 'undefined' ? ARTISTS : []);
  var festivals = (typeof FESTIVALS !== 'undefined' ? FESTIVALS : []).map(function (festival) {
    return Object.assign({}, festival, {_range: window.tjMagRange(festival.date)});
  }).filter(function (festival) { return festival._range; });
  var today = window.tjMagToday();
  var next = window.tjMagNextAppearances(artists, festivals, today);
  var state = { genre: 'ALL', origin: 'ALL', q: '', restored: false };
  var featuredSelection = null;
  var scrollRequest = 0;
  var activeCarousel = null;
  var toolbar = document.getElementById('artists-toolbar');
  var mobileQuery = window.matchMedia('(max-width: 900px)');
  var toolbarScrollFrame = 0;
  var toolbarLastY = window.scrollY;
  var toolbarDirection = 0;
  var toolbarDirectionAnchor = window.scrollY;
  var toolbarOpenUntil = 0;
  var toolbarStartY = toolbar ? toolbar.getBoundingClientRect().top + window.scrollY : 0;
  var genreOrder = ['ALL', 'TECHNO', 'HOUSE', 'MINIMAL', 'EXPERIMENTAL', 'AMBIENT', 'ELECTRONIC', 'LIVE'];
  var stateKey = 'tj:artist-hub-state:v1';

  function genresOf(artist) {
    return (Array.isArray(artist.genre) ? artist.genre : String(artist.genre || '').split(/\s*\/\s*/))
      .map(function (value) { return String(value).trim().toUpperCase(); }).filter(Boolean);
  }
  function placeOf(artist) { return [artist.city, artist.country].filter(Boolean).join(' · '); }
  function dateLabel(range) { return window.tjMagRangeFull(range); }
  function searchText(artist) { return [artist.name, artist.city, artist.country, genresOf(artist).join(' ')].join(' ').toLowerCase(); }
  function filtered() {
    return artists.filter(function (artist) {
      var genreMatch = state.genre === 'ALL' || genresOf(artist).indexOf(state.genre) >= 0;
      var originMatch = state.origin === 'ALL' || (state.origin === 'JAPAN' ? String(artist.country || '').toUpperCase() === 'JAPAN' : String(artist.country || '').toUpperCase() !== 'JAPAN');
      return genreMatch && originMatch && (!state.q || searchText(artist).indexOf(state.q.toLowerCase()) >= 0);
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'en'); });
  }
  function genres() {
    var found = new Set();
    artists.forEach(function (artist) { genresOf(artist).forEach(function (genre) { found.add(genre); }); });
    return genreOrder.concat(Array.from(found).filter(function (genre) { return genreOrder.indexOf(genre) < 0; }));
  }
  function syncUrl() {
    var url = new URL(location.href);
    ['genre', 'origin', 'q'].forEach(function (key) { url.searchParams.delete(key); });
    if (state.genre !== 'ALL') url.searchParams.set('genre', state.genre);
    if (state.origin !== 'ALL') url.searchParams.set('origin', state.origin.toLowerCase());
    if (state.q) url.searchParams.set('q', state.q);
    history.replaceState(history.state, '', url.pathname + url.search);
  }
  function readUrl() {
    var params = new URLSearchParams(location.search);
    var genre = String(params.get('genre') || '').toUpperCase();
    var origin = String(params.get('origin') || '').toUpperCase();
    var available = genres();
    if (genre && available.indexOf(genre) >= 0) state.genre = genre;
    if (origin === 'JAPAN' || origin === 'INTERNATIONAL') state.origin = origin;
    state.q = String(params.get('q') || '').slice(0, 120);
  }
  function chipMarkup(value, current) {
    return '<button class="chip' + (value === current ? ' is-active' : '') + '" type="button" data-filter-value="' + esc(value) + '" aria-pressed="' + (value === current ? 'true' : 'false') + '">' + esc(value) + '</button>';
  }
  function renderChips() {
    document.getElementById('artists-genre-chips').innerHTML = genres().map(function (value) { return chipMarkup(value, state.genre); }).join('');
    document.getElementById('artists-origin-chips').innerHTML = ['ALL', 'JAPAN', 'INTERNATIONAL'].map(function (value) { return chipMarkup(value, state.origin); }).join('');
  }
  function imageMarkup(artist, sizes, eager, boxAspect) {
    if (!artist.image) return '<span class="artist-image-placeholder" aria-hidden="true"></span>';
    var src = typeof tjCardAssetPath === 'function' ? tjCardAssetPath(artist.image) : artist.image;
    var coverSizes = typeof window.tjMagCoverSizes === 'function' && boxAspect
      ? window.tjMagCoverSizes(artist.image, boxAspect, sizes)
      : sizes;
    var attrs = typeof tjCardSrcsetAttr === 'function' ? tjCardSrcsetAttr(artist.image, coverSizes) : '';
    var dimensions = typeof tjImageSizeAttrs === 'function' ? tjImageSizeAttrs(artist.image) : '';
    return '<img ' + dimensions + attrs + ' src="' + esc(src) + '" alt="" loading="' + (eager ? 'eager' : 'lazy') + '"' + (eager ? ' fetchpriority="high"' : '') + ' decoding="async" style="' + (window.tjMagObjectPosition(artist.imagePosition) || '') + '">';
  }
  function attachHeart(mount, artist) {
    if (window.tjFav && mount && artist) window.tjFav.attachHeart(mount, 'artist', artist.id, { size: 'sm' });
  }
  function longestNameWord(value) {
    var words = String(value || '').split(/\s+/).map(function (word) {
      return Array.from(word).length;
    });
    return Math.max.apply(null, words.concat([1]));
  }
  function featuredMarkup(artist, index) {
    var appearance = next.get(artist.id);
    var genre = genresOf(artist).join(' / ');
    var artistName = loc(artist.name, '', artist.name_en);
    var nextLine = appearance
      ? '<div class="featured-next"><span class="pill">Next</span>'
        + '<span class="featured-next-name">' + esc(loc(appearance.festival.name, '', appearance.festival.name_en)) + '</span>'
        + '<span class="mono featured-next-date">' + esc(dateLabel(appearance.range)) + '</span></div>'
      : '';
    var bio = loc(artist.bio, '', artist.bio_en);
    var href = (isEn ? '/en' : '') + '/artists/' + encodeURIComponent(artist.id) + '.html';
    return '<article class="artists-featured-panel"><a class="wrap artists-featured-link artists-featured-content" href="' + href + '">'
      + '<div class="artists-featured-image">' + imageMarkup(artist, '(max-width: 900px) 100vw, 42vw', index === 0, 4 / 5)
      + '<span class="fav-mount" data-fav-id="' + esc(artist.id) + '"></span></div>'
      + '<div class="artists-featured-copy" style="--name-chars:' + longestNameWord(artistName) + '">'
      + '<div class="mono red">Featured ' + String(index + 1).padStart(2, '0') + ' · ' + esc(genre) + '</div>'
      + '<h2 class="disp">' + esc(artistName) + '</h2><div class="mono featured-place">' + esc(placeOf(artist)) + '</div>'
      + nextLine + (bio ? '<p class="artist-bio">' + esc(bio) + '</p>' : '')
      + '<span class="featured-profile">Profile →</span></div></a></article>';
  }
  function gridMarkup(artist) {
    return '<a class="artist-grid-card" data-artist-detail-link href="' + (isEn ? '/en' : '') + '/artists/' + encodeURIComponent(artist.id) + '.html"><div class="artist-grid-image">' + imageMarkup(artist, '(max-width: 900px) calc(50vw - 22px), 18vw', false, 1) + '<div class="fav-mount" data-fav-id="' + esc(artist.id) + '"></div></div><h3 class="disp">' + esc(loc(artist.name, '', artist.name_en)) + '</h3><div class="mono">' + esc(genresOf(artist).join(' / ')) + '</div><div class="mono artist-place">' + esc(placeOf(artist)) + '</div></a>';
  }
  function featuredArtists(list) {
    if (!featuredSelection) {
      var scheduled = artists.filter(function (artist) { return next.has(artist.id); });
      var shuffled = scheduled.slice().sort(function () { return Math.random() - .5; }).slice(0, 3);
      var chosen = shuffled.slice();
      artists.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'en'); }).forEach(function (artist) {
        if (chosen.length < 3 && !chosen.some(function (item) { return item.id === artist.id; })) chosen.push(artist);
      });
      featuredSelection = chosen.sort(function (a, b) {
        var ad = next.get(a.id), bd = next.get(b.id);
        if (ad && bd) return ad.range.start.localeCompare(bd.range.start);
        if (ad) return -1;
        if (bd) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'en');
      });
    }
    return list.filter(function (artist) { return featuredSelection.some(function (selected) { return selected.id === artist.id; }); }).sort(function (a, b) {
      var ad = next.get(a.id), bd = next.get(b.id);
      if (ad && bd) return ad.range.start.localeCompare(bd.range.start);
      if (ad) return -1;
      if (bd) return 1;
      return String(a.name || '').localeCompare(String(b.name || ''), 'en');
    }).slice(0, 3);
  }
  function syncToolbarHeight() {
    var update = function () { document.documentElement.style.setProperty('--artists-toolbar-h', toolbar.getBoundingClientRect().height + 'px'); };
    update();
    if (window.ResizeObserver) new ResizeObserver(update).observe(toolbar);
  }
  function syncFeaturedCopyHeight(featured) {
    if (!featured || featured.hidden) return;
    if (featured.__artistsCopyObserver) featured.__artistsCopyObserver.disconnect();
    var copies = Array.from(featured.querySelectorAll('.artists-featured-copy'));
    var update = function () {
      var height = copies.reduce(function (max, copy) {
        return Math.max(max, copy.getBoundingClientRect().height);
      }, 0);
      featured.style.setProperty('--artists-featured-copy-h', height + 'px');
    };
    update();
    if (window.ResizeObserver) {
      featured.__artistsCopyObserver = new ResizeObserver(update);
      copies.forEach(function (copy) { featured.__artistsCopyObserver.observe(copy); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  }
  function toolbarNavHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tj-nav-height')) || 64;
  }
  function showToolbar() {
    toolbar.classList.remove('is-hidden');
  }
  function holdToolbarOpen(duration) {
    toolbarOpenUntil = Math.max(toolbarOpenUntil, performance.now() + duration);
    showToolbar();
  }
  function featuredIsActive() {
    var featured = document.getElementById('artists-featured');
    return Boolean(featured && !featured.hidden && featured.getBoundingClientRect().bottom > toolbarNavHeight());
  }
  function toolbarMustStayVisible() {
    return !mobileQuery.matches
      || toolbarOpenUntil > performance.now()
      || toolbar.matches(':focus-within')
      || window.scrollY <= toolbarStartY - toolbarNavHeight()
      || featuredIsActive();
  }
  function updateToolbarVisibility() {
    if (toolbarScrollFrame) return;
    toolbarScrollFrame = requestAnimationFrame(function () {
      toolbarScrollFrame = 0;
      var y = window.scrollY;
      if (toolbarMustStayVisible()) {
        showToolbar();
        toolbarLastY = y;
        toolbarDirection = 0;
        toolbarDirectionAnchor = y;
        return;
      }
      var delta = y - toolbarLastY;
      if (Math.abs(delta) >= 1) {
        var direction = delta > 0 ? 1 : -1;
        if (direction !== toolbarDirection) {
          toolbarDirection = direction;
          toolbarDirectionAnchor = y;
        } else if (Math.abs(y - toolbarDirectionAnchor) >= 10) {
          toolbar.classList.toggle('is-hidden', direction > 0);
          toolbarDirectionAnchor = y;
        }
      }
      toolbarLastY = y;
    });
  }
  function shouldScroll() {
    var heading = document.getElementById('artists-featured');
    if (!heading || heading.hidden) heading = document.getElementById('artists-results-anchor');
    return heading && heading.getBoundingClientRect().top < (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tj-nav-height')) || 64) + document.getElementById('artists-toolbar').getBoundingClientRect().height;
  }
  function scrollResults(id) {
    if (id !== scrollRequest) return;
    var featured = document.getElementById('artists-featured');
    var heading = featured && !featured.hidden ? featured : document.getElementById('artists-results-anchor');
    if (!heading) return;
    var toolbar = document.getElementById('artists-toolbar');
    var offset = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tj-nav-height')) || 64) + toolbar.getBoundingClientRect().height;
    scrollTo({top: Math.max(0, heading.getBoundingClientRect().top + scrollY - offset), behavior: 'instant'});
    if (activeCarousel && activeCarousel.snapNow) activeCarousel.snapNow();
    setTimeout(function () {
      if (id !== scrollRequest) return;
      var delta = heading.getBoundingClientRect().top - offset;
      if (Math.abs(delta) > 4) scrollTo({top: Math.max(0, heading.getBoundingClientRect().top + scrollY - offset), behavior: 'instant'});
      if (activeCarousel && activeCarousel.snapNow) activeCarousel.snapNow();
    }, 150);
  }
  function render() {
    var list = filtered();
    var showFeatured = state.genre === 'ALL' && state.origin === 'ALL' && !state.q;
    var feats = showFeatured ? featuredArtists(list) : [];
    var featureIds = new Set(feats.map(function (artist) { return artist.id; }));
    var grid = list.filter(function (artist) { return !featureIds.has(artist.id); });
    var featured = document.getElementById('artists-featured');
    featured.hidden = !feats.length;
    featured.classList.toggle('is-single', feats.length === 1);
    featured.innerHTML = feats.length ? '<div class="artists-featured-sticky"><div class="artists-featured-track">' + feats.map(featuredMarkup).join('') + '</div>' + (feats.length > 1 ? '<div class="artists-featured-ui wrap"><div>' + feats.map(function (_, index) { return '<i class="fdot' + (index === 0 ? ' is-on' : '') + '"></i>'; }).join('') + '</div><span class="mono" data-featured-counter>01 / ' + String(feats.length).padStart(2, '0') + '</span><span class="mono scroll-label">Scroll ↓</span></div>' : '') + '</div>' : '';
    syncFeaturedCopyHeight(featured);
    document.getElementById('artists-grid-heading').textContent = isEn ? 'All artists' : 'アーティスト一覧';
    document.getElementById('artists-grid').innerHTML = grid.length ? grid.map(gridMarkup).join('') : '<p class="artists-empty">' + (isEn ? 'No artists match.' : '該当するアーティストはいません。') + '</p>';
    renderChips();
    document.getElementById('artists-search').value = state.q;
    document.getElementById('artists-search').placeholder = isEn ? 'Artist, city or genre' : 'アーティスト名・都市・ジャンル';
    document.querySelectorAll('#artists-phase3 .fav-mount').forEach(function (mount) {
      var artist = artists.find(function (item) { return item.id === mount.dataset.favId; });
      attachHeart(mount, artist);
    });
    if (activeCarousel && activeCarousel.destroy) activeCarousel.destroy();
    var carousel = window.tjMagPinnedCarousel({section: featured, sticky: featured.querySelector('.artists-featured-sticky'), track: featured.querySelector('.artists-featured-track'), panels: featured.querySelectorAll('.artists-featured-panel'), dwell: .12, startDwell: .1, endDwell: .15, shift: 10, scale: 1.12, stickyTop: function () { return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tj-nav-height')) || 64) + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--artists-toolbar-h')) || 0); }, onIndex: function (index) {
      var dots = featured.querySelectorAll('.fdot');
      dots.forEach(function (dot, dotIndex) { dot.classList.toggle('is-on', dotIndex === index); });
      var counter = featured.querySelector('[data-featured-counter]');
      if (counter) counter.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(feats.length).padStart(2, '0');
    } });
    activeCarousel = carousel;
    if (carousel.snapNow) carousel.snapNow();
    if (carousel.reduced) featured.classList.add('is-reduced');
    window.tjBindCursorExpand?.('a, button');
    document.querySelectorAll('#artists-phase3 [data-artist-detail-link]').forEach(function (link) { link.addEventListener('click', saveState); });
    var ssr = root.querySelector('.ssr-link-list');
    if (ssr) ssr.remove();
  }
  function saveState() {
    try { sessionStorage.setItem(stateKey, JSON.stringify({url: location.pathname + location.search, scrollY: scrollY, savedAt: Date.now()})); } catch (_) {}
  }
  function restoreState(event) {
    if (event && event.persisted) return;
    try {
      var saved = JSON.parse(sessionStorage.getItem(stateKey) || 'null');
      if (!saved || saved.url !== location.pathname + location.search || Date.now() - saved.savedAt > 1800000) return;
      sessionStorage.removeItem(stateKey);
      requestAnimationFrame(function () { requestAnimationFrame(function () { scrollTo(0, saved.scrollY); }); });
    } catch (_) {}
  }
  function onFilterChange() {
    holdToolbarOpen(700);
    var wasScrolled = shouldScroll();
    scrollRequest += 1;
    render();
    syncUrl();
    if (wasScrolled && !state.restored) {
      var id = scrollRequest;
      requestAnimationFrame(function () { requestAnimationFrame(function () { scrollResults(id); }); });
    }
  }
  readUrl();
  renderChips();
  document.getElementById('artists-search').addEventListener('input', function () {
    clearTimeout(window.__tjArtistSearchTimer);
    window.__tjArtistSearchTimer = setTimeout(function () { state.q = document.getElementById('artists-search').value.trim(); onFilterChange(); }, 200);
  });
  root.addEventListener('click', function (event) {
    var chip = event.target.closest('[data-filter-value]');
    if (!chip) return;
    var group = chip.closest('[data-filter-group]');
    if (group === document.getElementById('artists-origin-chips')) state.origin = chip.dataset.filterValue;
    else state.genre = chip.dataset.filterValue;
    onFilterChange();
  });
  window.addEventListener('pageshow', restoreState);
  toolbar.addEventListener('focusin', showToolbar);
  window.addEventListener('scroll', updateToolbarVisibility, { passive: true });
  mobileQuery.addEventListener?.('change', updateToolbarVisibility);
  syncToolbarHeight();
  try { render(); } finally { document.documentElement.classList.remove('tj-artists-hydrating'); }
}());
