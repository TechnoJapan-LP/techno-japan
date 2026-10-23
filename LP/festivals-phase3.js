(function () {
  'use strict';

  var root = document.getElementById('festivals-phase3');
  if (!root) return;
  var isEn = document.documentElement.lang === 'en';
  var esc = window.tjEscapeHtml || function (value) {
    return String(value == null ? '' : value);
  };
  var loc = window.tjLocalized || function (primary, ja, en) {
    return isEn ? (en || primary || ja || '') : (primary || ja || en || '');
  };
  var today = tjMagToday();
  var extra = {};
  var params = new URLSearchParams(location.search);
  var seasonParam = params.get('season');

  try {
    extra = JSON.parse(document.getElementById('festival-hub-extra')?.textContent || '{}');
  } catch (_) {}

  var state = {
    season: seasonParam === 'past' ? 'archive' : seasonParam === 'all' ? 'all' : 'upcoming',
    type: ['festival', 'rave'].includes(params.get('type')) ? params.get('type') : 'all',
    view: params.get('view') === 'list' ? 'list' : 'grid'
  };
  var festivals = (typeof FESTIVALS !== 'undefined' ? FESTIVALS : [])
    .map(function (festival) {
      return Object.assign({}, festival, { range: tjMagRange(festival.date) });
    })
    .filter(function (festival) {
      return festival.range;
    });

  function isUpcoming(festival) {
    return tjMagIsUpcoming(festival.range, today);
  }

  function filtered() {
    var list = festivals.filter(function (festival) {
      var upcoming = isUpcoming(festival);
      var seasonMatch = state.season === 'upcoming' ? upcoming : state.season === 'archive' ? !upcoming : true;
      var typeMatch = state.type === 'all' || String(festival.type || 'festival').toLowerCase() === state.type;
      return seasonMatch && typeMatch;
    });
    return list.sort(function (a, b) {
      var aUpcoming = isUpcoming(a);
      var bUpcoming = isUpcoming(b);
      if (state.season === 'archive') return b.range.start.localeCompare(a.range.start);
      if (state.season === 'all' && aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? a.range.start.localeCompare(b.range.start) : b.range.start.localeCompare(a.range.start);
    });
  }

  function image(festival, lead) {
    var sizes = lead
      ? '(max-width: 900px) calc(100vw - 32px), 64vw'
      : '(max-width: 760px) calc(50vw - 28px), (max-width: 1100px) calc(33vw - 40px), (max-width: 1360px) calc(25vw - 38px), 302px';
    var srcset = lead ? tjHeroSrcsetAttr(festival.image, sizes) : tjCardSrcsetAttr(festival.image, sizes);
    return '<img ' + tjImageSizeAttrs(festival.image) + srcset + ' src="' + esc(tjCardAssetPath(festival.image))
      + '" sizes="' + esc(sizes) + '" loading="' + (lead ? 'eager' : 'lazy') + '"'
      + (lead ? ' fetchpriority="high"' : '') + ' decoding="async" alt="'
      + esc(loc(festival.name, '', festival.name_en)) + '" style="' + tjMagObjectPosition(festival.imagePosition) + '">';
  }

  function place(festival) {
    return typeof window.tjMagFestivalPlace === 'function'
      ? window.tjMagFestivalPlace(festival)
      : [festival.location_ja || festival.location, festival.city].filter(Boolean).join(' · ');
  }

  function heart(festival) {
    return '<span class="phase3-heart" data-fav-mount="festival" data-fav-id="' + esc(festival.id) + '"></span>';
  }

  function card(festival) {
    var upcoming = isUpcoming(festival);
    var genreLine = (Array.isArray(festival.genre) ? festival.genre : []).map(function (genre) { return String(genre).trim(); }).filter(Boolean).join(' / ');
    return '<a class="phase3-card" href="' + (isEn ? '/en' : '') + '/festivals/' + encodeURIComponent(festival.id)
      + '.html" data-festival-detail-link><div class="phase3-card-image">' + image(festival, false) + heart(festival)
      + '</div><div class="phase3-card-top"><span class="disp phase3-card-date">' + tjMagRangeShort(festival.range)
      + '</span><span class="phase3-card-status ' + (upcoming ? '' : 'is-archive') + '">'
      + (upcoming ? 'UPCOMING' : 'ARCHIVE') + '</span></div><h3 class="disp phase3-card-name">'
      + esc(loc(festival.name, '', festival.name_en)) + '</h3><span class="mono phase3-card-meta">'
      + esc(place(festival)) + '</span><span class="mono phase3-card-meta">'
      + esc([String(festival.type || 'festival').toUpperCase(), genreLine].filter(Boolean).join(' · '))
      + '</span></a>';
  }

  function row(festival) {
    var upcoming = isUpcoming(festival);
    return '<a class="phase3-list-row" href="' + (isEn ? '/en' : '') + '/festivals/' + encodeURIComponent(festival.id)
      + '.html" data-festival-detail-link><span class="mono">' + tjMagRangeFull(festival.range)
      + '</span><span class="disp phase3-list-name">' + esc(loc(festival.name, '', festival.name_en))
      + '</span><span class="mono phase3-hide">' + esc(place(festival)) + '</span><span class="mono phase3-hide">'
      + esc(String(festival.type || 'festival')) + '</span><span class="mono phase3-list-status '
      + (upcoming ? '' : 'is-archive') + '" data-city="' + esc(festival.city || '') + '">'
      + (upcoming ? 'UPCOMING' : 'ARCHIVE') + '</span>' + heart(festival) + '</a>';
  }

  function syncUrl() {
    var url = new URL(location.href);
    ['season', 'type', 'view'].forEach(function (key) { url.searchParams.delete(key); });
    if (state.season !== 'upcoming') url.searchParams.set('season', state.season === 'archive' ? 'past' : 'all');
    if (state.type !== 'all') url.searchParams.set('type', state.type);
    if (state.view !== 'grid') url.searchParams.set('view', state.view);
    history.replaceState(null, '', url);
  }

  function render() {
    root.querySelectorAll('[data-filter]').forEach(function (group) {
      group.querySelectorAll('button').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.value === state[group.dataset.filter]));
      });
    });
    var items = filtered();
    var lead = state.season !== 'archive' ? items[0] : null;
    var visible = lead ? items.slice(1) : items;
    var next = root.querySelector('#festival-phase3-next');
    var results = root.querySelector('#festival-phase3-results');
    next.innerHTML = lead ? '<a class="phase3-next" href="' + (isEn ? '/en' : '') + '/festivals/' + encodeURIComponent(lead.id)
      + '.html" data-festival-detail-link><div class="phase3-next-image">' + image(lead, true) + heart(lead)
      + '</div><div class="phase3-next-copy"><span class="mono red">Next up · ' + esc(String(lead.type || 'festival').toUpperCase())
      + '</span><span class="disp phase3-date">' + tjMagRangeShort(lead.range) + '</span><h2 class="disp phase3-next-name">'
      + esc(loc(lead.name, '', lead.name_en)) + '</h2><span class="mono">' + esc(place(lead)) + '</span>'
      + (extra.desc?.[lead.id]?.[isEn ? 'en' : 'ja'] ? '<p class="phase3-desc">' + esc(extra.desc[lead.id][isEn ? 'en' : 'ja']) + '</p>' : '')
      + '</div></a>' : '';
    results.innerHTML = state.view === 'grid'
      ? '<div class="phase3-grid">' + visible.map(card).join('') + '</div>'
      : '<div class="phase3-list"><div class="phase3-list-head mono"><span>Date</span><span>Festival</span><span class="phase3-hide">Location</span><span class="phase3-hide">Type</span><span>Status</span></div>' + visible.map(row).join('') + '</div>';
    root.querySelector('#festival-phase3-count').textContent = items.length + ' results';
    root.querySelector('#festival-phase3-empty').textContent = items.length ? '' : (isEn ? 'No festivals match these filters.' : '該当するフェスはありません。');
    root.querySelectorAll('[data-fav-mount]').forEach(function (mount) {
      window.tjFav?.attachHeart(mount, 'festival', mount.dataset.favId, { size: 'sm' });
    });
    window.tjBindCursorExpand?.('a, button');
  }

  root.querySelector('[data-filter="season"]').addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;
    state.season = button.dataset.value;
    syncUrl();
    render();
  });
  root.querySelector('[data-filter="type"]').addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;
    state.type = button.dataset.value;
    syncUrl();
    render();
  });
  root.querySelector('[data-filter="view"]').addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;
    state.view = button.dataset.value;
    syncUrl();
    render();
  });
  root.querySelector('#festival-phase3-head').innerHTML = '<h1 class="disp pagehead">Festivals</h1><div class="phase3-meta"><span class="mono red">'
    + festivals.filter(isUpcoming).length + ' upcoming · ' + festivals.length + ' indexed</span><span class="mono">'
    + (extra.updated ? 'Updated ' + extra.updated.replace(/-/g, '.') : '') + '</span></div>';
  root.addEventListener('click', function (event) {
    var link = event.target.closest('[data-festival-detail-link]');
    if (link) sessionStorage.setItem('tj:festival-hub-state:v1', JSON.stringify({ url: location.href, scrollY: scrollY, savedAt: Date.now() }));
  });
  render();
  root.querySelector('.ssr-link-list')?.remove();
  document.documentElement.classList.add('tj-festivals-phase3-ready');
}());
