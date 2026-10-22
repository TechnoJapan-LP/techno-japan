/* VENUES magazine phase 3-4: filters, Leaflet/offline map, featured venue and grid. */
(function () {
  'use strict';

  var root = document.getElementById('venues-list-view');
  if (!root) return;
  var isEn = document.documentElement.lang === 'en';
  var esc = window.tjEscapeHtml || function (value) { return String(value == null ? '' : value); };
  var loc = window.tjLocalized || function (primary, ja, en) { return isEn ? (en || primary || ja || '') : (primary || ja || en || ''); };
  var venues = (typeof VENUES !== 'undefined' ? VENUES : []).filter(function (venue) { return venue && venue.id; });
  var state = { city: 'ALL', type: 'ALL', featuredId: '', restored: false };
  var stateKey = 'tj:venue-hub-state:v1';
  var mapWrap = document.getElementById('venue-map');
  var mapSurface = document.getElementById('venue-map-surface');
  var leafletMap = null;
  var leafletMarkers = {};
  var leafletLoadPromise = null;
  var leafletCssReady = false;
  var mapAlignFrame = 0;

  function alignMapTop() {
    if (!mapWrap) return;
    mapWrap.style.marginTop = '0px';
    var top = mapWrap.getBoundingClientRect().top + window.scrollY;
    var fraction = top - Math.floor(top);
    var shift = fraction > 0.0001 ? 1 - fraction : 0;
    mapWrap.style.marginTop = shift ? shift.toFixed(4) + 'px' : '0px';
    if (leafletMap) leafletMap.invalidateSize({ pan: false });
  }
  function scheduleMapTopAlignment() {
    if (mapAlignFrame) cancelAnimationFrame(mapAlignFrame);
    mapAlignFrame = requestAnimationFrame(function () {
      mapAlignFrame = 0;
      alignMapTop();
    });
  }

  function typeValues() {
    var order = ['club', 'bar', 'livehouse'];
    return order.filter(function (type) { return venues.some(function (venue) { return venue.type === type; }); });
  }
  function cityValues() {
    return Array.from(new Set(venues.map(function (venue) { return String(venue.city || '').trim(); }).filter(Boolean))).sort(function (a, b) { return a.localeCompare(b, 'en'); });
  }
  function isValidState() {
    return cityValues().indexOf(state.city) >= 0 || state.city === 'ALL';
  }
  function readUrl() {
    var params = new URLSearchParams(location.search);
    var area = params.get('area');
    var type = params.get('type') || new URLSearchParams(location.hash.replace(/^#/, '')).get('type');
    if (area && cityValues().indexOf(area) >= 0) state.city = area;
    if (type && typeValues().indexOf(type) >= 0) state.type = type;
    if (!isValidState()) state.city = 'ALL';
  }
  function syncUrl() {
    var url = new URL(location.href);
    url.searchParams.delete('area');
    url.searchParams.delete('type');
    if (state.city !== 'ALL') url.searchParams.set('area', state.city);
    if (state.type !== 'ALL') url.searchParams.set('type', state.type);
    url.hash = '';
    history.replaceState(history.state, '', url.pathname + url.search);
  }
  function filtered() {
    return venues.filter(function (venue) {
      return (state.city === 'ALL' || venue.city === state.city) && (state.type === 'ALL' || venue.type === state.type);
    }).sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'en'); });
  }
  function genreLine(venue) {
    var values = Array.isArray(venue.genre) ? venue.genre : String(venue.genre || '').split(/[\s,\/]+/);
    return values.map(function (value) { return String(value).trim(); }).filter(Boolean).slice(0, 3).join(' / ');
  }
  function typeLine(venue) {
    return String(venue.type || '').toUpperCase();
  }
  function metaLine(venue) {
    var values = [venue.area, venue.city, typeLine(venue)];
    if (venue.capacity !== undefined && venue.capacity !== null && String(venue.capacity).trim()) values.push('CAP. ' + venue.capacity);
    return values.filter(Boolean).join(' · ');
  }
  function imageMarkup(venue, sizes, eager, className) {
    if (!venue.image || !String(venue.image).trim()) return '<div class="venue-image-placeholder" aria-hidden="true"></div>';
    var src = typeof tjCardAssetPath === 'function' ? tjCardAssetPath(venue.image) : tjAssetPath(venue.image);
    var srcset = eager && typeof tjHeroSrcsetAttr === 'function' ? tjHeroSrcsetAttr(venue.image, sizes) : (typeof tjCardSrcsetAttr === 'function' ? tjCardSrcsetAttr(venue.image, sizes) : '');
    var dimensions = typeof tjImageSizeAttrs === 'function' ? tjImageSizeAttrs(venue.image) : '';
    return '<img class="' + (className || '') + '" ' + dimensions + srcset + ' src="' + esc(src) + '" alt="" loading="' + (eager ? 'eager' : 'lazy') + '"' + (eager ? ' fetchpriority="high"' : '') + ' decoding="async" style="' + esc(window.tjMagObjectPosition(venue.imagePosition) || '') + '">';
  }
  function detailHref(venue) {
    return (isEn ? '/en' : '') + '/venues/' + encodeURIComponent(venue.id) + '.html';
  }
  function values() {
    var list = filtered();
    var featured = list.find(function (venue) { return venue.id === state.featuredId; }) || list[0] || venues[0] || null;
    if (featured && !list.some(function (venue) { return venue.id === featured.id; })) featured = list[0] || null;
    state.featuredId = featured ? featured.id : '';
    return { list: list, featured: featured, pins: list.filter(function (venue) { return Number.isFinite(Number(venue.lat)) && Number.isFinite(Number(venue.lng)); }) };
  }
  function chip(value, label, current) {
    return '<button class="chip' + (value === current ? ' on' : '') + '" type="button" data-value="' + esc(value) + '" aria-pressed="' + String(value === current) + '">' + esc(label) + '</button>';
  }
  function renderChips() {
    document.getElementById('venues-city-chips').innerHTML = ['ALL'].concat(cityValues()).map(function (city) { return chip(city, city, state.city); }).join('');
    document.getElementById('venues-type-chips').innerHTML = ['ALL'].concat(typeValues()).map(function (type) { return chip(type, type.toUpperCase(), state.type); }).join('');
  }
  function updateMapLabels(count, featured) {
    document.getElementById('venue-map-count').textContent = 'Map · ' + count + ' pins';
    document.getElementById('venue-map-featured').textContent = (window.matchMedia('(hover: none) and (pointer: coarse)').matches ? 'Tap a pin · ' : 'Hover a pin · ') + (featured ? loc(featured.name, '', featured.name_en) : '');
  }
  function renderFeatured(featured) {
    var card = document.getElementById('venue-featured-card');
    if (!featured) { card.hidden = true; return; }
    card.hidden = false;
    card.href = detailHref(featured);
    card.innerHTML = '<div class="venue-featured-image">' + imageMarkup(featured, '(max-width: 900px) calc(100vw - 32px), 36vw', true) + '</div><div class="venue-featured-copy"><span class="mono red">Featured venue</span><h2 class="disp">' + esc(loc(featured.name, '', featured.name_en)) + '</h2><span class="mono venue-featured-meta">' + esc(metaLine(featured)) + '</span><p class="venue-featured-desc">' + esc(loc(featured.desc, '', featured.desc_en)) + '</p></div>';
  }
  function renderGrid(list, featured) {
    var cards = list.filter(function (venue) { return !featured || venue.id !== featured.id; });
    var grid = document.getElementById('venues-grid');
    grid.innerHTML = cards.length ? cards.map(function (venue) {
      return '<a class="venue-grid-card" data-venue-detail-link data-type="' + esc(venue.type || '') + '" href="' + detailHref(venue) + '"><div class="venue-grid-image">' + imageMarkup(venue, '(max-width: 900px) calc(100vw - 32px), (max-width: 1360px) calc(25vw - 40px), 302px', false) + '<span class="venue-fav-mount" data-fav-mount="venue" data-fav-id="' + esc(venue.id) + '"></span></div><div class="venue-grid-title-row"><h3 class="disp venue-grid-title">' + esc(loc(venue.name, '', venue.name_en)) + '</h3><span class="mono venue-grid-city">' + esc(venue.city || '') + '</span></div><span class="mono venue-grid-meta">' + esc([typeLine(venue), venue.capacity ? 'CAP. ' + venue.capacity : ''].filter(Boolean).join(' · ')) + '</span><span class="mono venue-grid-genre">' + esc(genreLine(venue)) + '</span></a>';
    }).join('') : '<p class="venues-empty">' + (isEn ? 'No venues match.' : '該当する会場はありません。') + '</p>';
    document.getElementById('venues-grid-count').textContent = cards.length + ' / ' + venues.length;
    grid.querySelectorAll('[data-fav-mount]').forEach(function (mount) { window.tjFav?.attachHeart(mount, 'venue', mount.dataset.favId, { size: 'sm' }); });
  }
  function setActivePin(id) {
    document.querySelectorAll('#venue-map .club-pin, #venue-map .bar-pin').forEach(function (pin) { pin.classList.toggle('active', pin.dataset.id === id); });
    document.querySelectorAll('#venue-map .venue-pin').forEach(function (pin) { pin.classList.toggle('active', pin.dataset.id === id); });
    document.querySelectorAll('#venue-map .lpin').forEach(function (pin) { pin.classList.toggle('active', pin.dataset.id === id); });
  }
  function choose(id) {
    state.featuredId = id;
    var current = values();
    renderFeatured(current.featured);
    updateMapLabels(current.pins.length, current.featured);
    setActivePin(current.featured && current.featured.id);
  }
  function renderLocal() {
    if (!mapSurface) return;
    var current = values();
    var pins = current.pins;
    var points = pins.map(function (venue) { return [Number(venue.lng), Math.log(Math.tan(Math.PI / 4 + Number(venue.lat) * Math.PI / 360))]; });
    var width = mapSurface.clientWidth || 800;
    var height = mapSurface.clientHeight || 600;
    var padding = 56;
    var minX = points.length ? Math.min.apply(null, points.map(function (point) { return point[0]; })) : 0;
    var maxX = points.length ? Math.max.apply(null, points.map(function (point) { return point[0]; })) : 1;
    var minY = points.length ? Math.min.apply(null, points.map(function (point) { return point[1]; })) : 0;
    var maxY = points.length ? Math.max.apply(null, points.map(function (point) { return point[1]; })) : 1;
    var sx = maxX - minX || 0.01;
    var sy = maxY - minY || 0.01;
    var scale = points.length > 1 ? Math.min((width - padding * 2) / sx, (height - padding * 2) / sy) : 1;
    var ox = (width - sx * scale) / 2;
    var oy = (height - sy * scale) / 2;
    mapSurface.innerHTML = '<div class="lgrid"></div>' + pins.map(function (venue, index) {
      var point = points[index];
      var x = points.length > 1 ? ox + (point[0] - minX) * scale : width / 2;
      var y = points.length > 1 ? oy + (maxY - point[1]) * scale : height / 2;
      var id = esc(venue.id);
      var name = esc(loc(venue.name, '', venue.name_en));
      return '<button class="lpin" data-id="' + id + '" style="left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px" aria-label="' + name + '"><span class="venue-pin" data-id="' + id + '"><span class="' + (venue.type === 'bar' ? 'bar-pin' : 'club-pin') + '" data-id="' + id + '"></span><span class="pin-lbl">' + name + '</span></span></button>';
    }).join('');
    mapWrap.dataset.mapStatus = 'offline';
    alignMapTop();
    updateMapLabels(pins.length, current.featured);
    setActivePin(current.featured && current.featured.id);
  }
  function clearLeafletMarkers() {
    Object.keys(leafletMarkers).forEach(function (id) { leafletMap.removeLayer(leafletMarkers[id]); });
    leafletMarkers = {};
  }
  function renderLeaflet() {
    if (!leafletMap) return;
    var current = values();
    clearLeafletMarkers();
    current.pins.forEach(function (venue) {
      var id = String(venue.id);
      var name = esc(loc(venue.name, '', venue.name_en));
      var pinClass = venue.type === 'bar' ? 'bar-pin' : 'club-pin';
      var icon = L.divIcon({ className: '', html: '<div class="venue-pin" data-id="' + esc(id) + '"><span class="' + pinClass + '" data-id="' + esc(id) + '"></span><span class="pin-lbl">' + name + '</span></div>', iconSize: [10, 10], iconAnchor: [5, 5] });
      var marker = L.marker([Number(venue.lat), Number(venue.lng)], { icon: icon, alt: name }).addTo(leafletMap);
      marker.on('mouseover', function () { choose(id); });
      marker.on('click', function () { choose(id); });
      if (marker._icon) marker._icon.setAttribute('aria-label', name);
      leafletMarkers[id] = marker;
    });
    if (current.pins.length) {
      var bounds = L.latLngBounds(current.pins.map(function (venue) { return [Number(venue.lat), Number(venue.lng)]; }));
      leafletMap.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
    mapWrap.dataset.mapStatus = 'ready';
    alignMapTop();
    updateMapLabels(current.pins.length, current.featured);
    setActivePin(current.featured && current.featured.id);
  }
  function ensureLeafletCss() {
    if (leafletCssReady || document.querySelector('link[data-tj-leaflet], link[href*="/vendor/leaflet-1.9.4/leaflet.css"]')) { leafletCssReady = true; return Promise.resolve(); }
    return new Promise(function (resolve) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/vendor/leaflet-1.9.4/leaflet.css?v=2';
      link.dataset.tjLeaflet = '1';
      link.onload = function () { leafletCssReady = true; resolve(); };
      link.onerror = function () { resolve(); };
      document.head.appendChild(link);
    });
  }
  function tjLoadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletLoadPromise) return leafletLoadPromise;
    leafletLoadPromise = ensureLeafletCss().then(function () {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        var timer = setTimeout(function () { reject(new Error('Leaflet script timed out')); }, 10000);
        script.src = window.TJ_LEAFLET_SRC || '/vendor/leaflet-1.9.4/leaflet.js?v=2';
        script.onload = function () { clearTimeout(timer); window.L ? resolve(window.L) : reject(new Error('Leaflet did not initialize')); };
        script.onerror = function () { clearTimeout(timer); reject(new Error('Leaflet script failed to load')); };
        document.head.appendChild(script);
      });
    });
    return leafletLoadPromise;
  }
  window.tjLoadLeaflet = tjLoadLeaflet;
  function initLeaflet() {
    if (!window.L || leafletMap || !mapSurface) return;
    leafletMap = L.map(mapSurface, { center: [35.658, 139.699], zoom: 13, minZoom: 5, maxZoom: 18, zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    mapWrap.dataset.mapStatus = 'ready';
    window.tjAddMapTiles(leafletMap, { timeout: 15000, onOffline: function () { if (leafletMap) { leafletMap.remove(); leafletMap = null; } renderLocal(); } });
    renderLeaflet();
  }
  function saveState() {
    try { sessionStorage.setItem(stateKey, JSON.stringify({ url: location.pathname + location.search, scrollY: scrollY, savedAt: Date.now() })); } catch (_) {}
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
  function render() {
    var current = values();
    renderChips();
    renderFeatured(current.featured);
    renderGrid(current.list, current.featured);
    updateMapLabels(current.pins.length, current.featured);
    if (leafletMap) renderLeaflet();
    else if (mapWrap.dataset.mapStatus === 'offline') renderLocal();
    scheduleMapTopAlignment();
    document.getElementById('venues-total').textContent = venues.length + ' venues';
    document.querySelectorAll('#venues-city-chips button, #venues-type-chips button').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.value === (button.closest('#venues-city-chips') ? state.city : state.type)));
    });
    window.tjBindCursorExpand?.('a, button');
  }
  root.addEventListener('click', function (event) {
    var chipButton = event.target.closest('.venues-chip-group button');
    if (chipButton) {
      var group = chipButton.closest('.venues-chip-group');
      if (group.id === 'venues-city-chips') state.city = chipButton.dataset.value;
      else state.type = chipButton.dataset.value;
      state.featuredId = '';
      syncUrl();
      render();
      return;
    }
    var link = event.target.closest('[data-venue-detail-link]');
    if (link) saveState();
  });
  mapSurface?.addEventListener('mouseover', function (event) {
    var pin = event.target.closest('.lpin');
    if (pin && mapSurface.contains(pin)) choose(pin.dataset.id);
  });
  mapSurface?.addEventListener('click', function (event) {
    var pin = event.target.closest('.lpin');
    if (pin && mapSurface.contains(pin)) choose(pin.dataset.id);
  });
  readUrl();
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(scheduleMapTopAlignment).observe(mapWrap);
  }
  window.addEventListener('resize', scheduleMapTopAlignment);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMapTopAlignment);
  window.addEventListener('pageshow', restoreState);
  render();
  root.querySelector('.ssr-link-list')?.remove();
  document.documentElement.classList.remove('tj-venues-hydrating');
  tjLoadLeaflet().then(initLeaflet).catch(function () { renderLocal(); });
}());
