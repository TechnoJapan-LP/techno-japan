/* Lazy Leaflet map for festival detail ACCESS panels. */
(function () {
  'use strict';

  function setOffline(mapWrap, surface) {
    if (mapWrap._tjMap) {
      mapWrap._tjMap.remove();
      mapWrap._tjMap = null;
    }
    surface.textContent = '';
    mapWrap.dataset.mapStatus = 'offline';
  }

  function initialize(mapWrap) {
    if (mapWrap.dataset.mapInitialized === 'true') return;
    mapWrap.dataset.mapInitialized = 'true';
    var surface = mapWrap.querySelector('.festival-map-surface');
    var lat = Number(mapWrap.dataset.lat);
    var lng = Number(mapWrap.dataset.lng);
    if (!surface || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setOffline(mapWrap, surface || mapWrap);
      return;
    }

    mapWrap.dataset.mapStatus = 'loading';
    var touchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    var loadLeaflet = window.tjLoadLeaflet;
    var addMapTiles = window.tjAddMapTiles;
    if (typeof loadLeaflet !== 'function' || typeof addMapTiles !== 'function') {
      setOffline(mapWrap, surface);
      return;
    }

    loadLeaflet().then(function (L) {
      var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var map = L.map(surface, {
        center: [lat, lng],
        zoom: 14,
        scrollWheelZoom: false,
        attributionControl: true,
        zoomControl: !touchDevice,
        dragging: !touchDevice,
        touchZoom: false,
        doubleClickZoom: !touchDevice,
        tap: false,
        zoomAnimation: !reducedMotion,
        fadeAnimation: !reducedMotion,
        markerZoomAnimation: !reducedMotion
      });
      mapWrap._tjMap = map;
      surface._tjMap = map;
      map.setView([lat, lng], 14, { animate: false });

      var marker = L.marker([lat, lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'festival-map-marker',
          html: '<span class="festival-map-dot festival-map-leaflet-dot" aria-hidden="true"></span>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        }),
        alt: mapWrap.dataset.mapLabel || ''
      }).addTo(map);
      marker._tjFestivalMarker = true;

      addMapTiles(map, {
        timeout: 15000,
        onReady: function () {
          mapWrap.dataset.mapStatus = 'ready';
          map.invalidateSize({ pan: false });
        },
        onOffline: function () {
          setOffline(mapWrap, surface);
        }
      });
    }).catch(function () {
      setOffline(mapWrap, surface);
    });
  }

  function observe(mapWrap) {
    if (!('IntersectionObserver' in window)) {
      initialize(mapWrap);
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
      observer.disconnect();
      initialize(mapWrap);
    }, { rootMargin: '300px' });
    observer.observe(mapWrap);
  }

  document.querySelectorAll('.festival-map[data-lat][data-lng]').forEach(observe);
}());
