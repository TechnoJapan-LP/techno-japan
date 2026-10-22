/* Shared Leaflet tile setup for map.html and the VENUES hub. */
(function () {
  'use strict';

  /* Public CARTO key. The key is restricted to techno-japan.media in CARTO's
     dashboard; the free plan is used within its monthly allowance. Attribution
     is required for both CARTO and OpenStreetMap. */
  var CARTO_KEY = 'cb1_4gpv_1_06398582bb637e335325cc2f';
  var CARTO_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY;
  var OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  var ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
  var OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

  window.tjAddMapTiles = function (map, options) {
    options = options || {};
    var layer = null;
    var loadedTiles = 0;
    var tileErrors = 0;
    var usingOsm = false;
    var settled = false;
    var timer = null;
    var timeout = Number(options.timeout || 0);

    function ready() {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (typeof options.onReady === 'function') options.onReady({ layer: layer, osm: usingOsm });
    }

    function offline(reason) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (typeof options.onOffline === 'function') options.onOffline(reason);
    }

    function install(useOsm) {
      usingOsm = useOsm;
      loadedTiles = 0;
      tileErrors = 0;
      layer = useOsm
        ? L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION })
        : L.tileLayer(CARTO_URL, {
            subdomains: 'abcd',
            maxZoom: 19,
            attribution: ATTRIBUTION
          });
      layer.on('tileload', function () {
        loadedTiles += 1;
        ready();
      });
      layer.on('tileerror', function () {
        tileErrors += 1;
        if (!usingOsm && loadedTiles === 0 && tileErrors >= 3) {
          map.getContainer().classList.add('tj-map-osm');
          map.removeLayer(layer);
          install(true);
        } else if (usingOsm && loadedTiles === 0 && tileErrors >= 6) {
          offline('osm tile error');
        }
      });
      layer.addTo(map);
      return layer;
    }

    install(false);
    if (timeout > 0) {
      timer = setTimeout(function () {
        if (settled) return;
        if (loadedTiles > 0) ready();
        else if (usingOsm) offline('tile timeout');
        else {
          map.getContainer().classList.add('tj-map-osm');
          if (layer) map.removeLayer(layer);
          install(true);
          timer = setTimeout(function () {
            if (!settled && loadedTiles === 0) offline('osm tile timeout');
          }, timeout);
        }
      }, timeout);
    }
    return layer;
  };
}());
