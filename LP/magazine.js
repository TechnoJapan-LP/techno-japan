/* Shared date, title and image-position helpers for the magazine hubs. */
(function () {
  'use strict';

  function isoDate(value) {
    var match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    var month = Number(match[2]);
    var day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return match[1] + '-' + match[2] + '-' + match[3];
  }

  window.tjMagToday = function () {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  };

  window.tjMagRange = function (dateStr) {
    var parts = String(dateStr || '').split('/');
    if (parts.length > 2) return null;
    var start = isoDate(parts[0]);
    var end = isoDate(parts[1] || parts[0]);
    if (!start || !end || end < start) return null;
    return { start: start, end: end };
  };

  window.tjMagDot = function (dateStr) {
    var date = isoDate(dateStr);
    return date ? date.replace(/-/g, '.') : '';
  };

  window.tjMagRangeShort = function (range) {
    if (!range) return '';
    var start = range.start.slice(5).replace('-', '.');
    var end = range.end.slice(5).replace('-', '.');
    return range.start === range.end ? start : start + '–' + end;
  };

  window.tjMagRangeFull = function (range) {
    if (!range) return '';
    return tjMagDot(range.start) + (range.start === range.end ? '' : '–' + tjMagDot(range.end));
  };

  window.tjMagIsUpcoming = function (range, today) {
    return Boolean(range && range.end >= String(today || tjMagToday()));
  };

  window.tjMagSplitTitle = function (title) {
    var parts = String(title || '').split(/[|｜]/);
    return { main: parts[0].trim(), sub: (parts[1] || '').trim() };
  };

  window.tjMagObjectPosition = function (value) {
    var position = String(value || '').trim();
    return /^[a-z0-9.%\s-]{1,40}$/i.test(position) ? 'object-position:' + position + ';' : '';
  };

  window.tjMagNextAppearances = function (artists, festivals, today) {
    var byId = new Map();
    var byName = new Map();
    (artists || []).forEach(function (artist) {
      if (!artist) return;
      byId.set(String(artist.id || '').trim().toLowerCase(), artist);
      byName.set(String(artist.name || '').trim().toLowerCase(), artist);
    });
    var out = new Map();
    (festivals || []).map(function (festival) {
      var range = festival && (festival._range || window.tjMagRange(festival.date));
      return { festival: festival, range: range };
    }).filter(function (item) {
      return item.range && item.range.end >= String(today || window.tjMagToday());
    }).sort(function (a, b) {
      return a.range.start.localeCompare(b.range.start);
    }).forEach(function (item) {
      var lineup = Array.isArray(item.festival.lineup) ? item.festival.lineup : [];
      lineup.forEach(function (entry) {
        var id = typeof entry === 'object' ? entry.id : entry;
        var name = typeof entry === 'object' ? (entry.name || entry.label) : entry;
        var artist = byId.get(String(id || '').trim().toLowerCase())
          || byName.get(String(name || '').trim().toLowerCase());
        if (artist && !out.has(artist.id)) out.set(artist.id, item);
      });
    });
    return out;
  };

  window.tjMagPinnedCarousel = function (options) {
    var section = options.section;
    var sticky = options.sticky;
    var track = options.track;
    var panels = Array.from(options.panels || []);
    var count = panels.length;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!section || !sticky || !track || count < 2 || reduced.matches) return { reduced: reduced.matches };
    var target = 0;
    var current = 0;
    var raf = 0;
    var dwell = Number(options.dwell || 0.1);
    var shift = Number(options.shift || 0);
    var scale = Number(options.scale || 1);
    var dimScale = Number(options.dimScale == null ? 0.55 : options.dimScale);
    var stickyTop = options.stickyTop || function () { return 0; };
    var paint = function () {
      current += (target - current) * 0.055;
      if (Math.abs(target - current) < 0.0003) current = target;
      track.style.transform = 'translate3d(' + (-current * 100 / count) + '%,0,0)';
      panels.forEach(function (panel, index) {
        var delta = index - current;
        var image = panel.querySelector('img');
        if (image) image.style.transform = 'translate3d(' + (delta * shift) + '%,0,0) scale(' + scale + ')';
        panel.style.setProperty('--dim', String(Math.min(0.55, Math.abs(delta) * dimScale)));
      });
      var index = Math.max(0, Math.min(count - 1, Math.round(current)));
      if (typeof options.onIndex === 'function') options.onIndex(index);
      raf = current === target ? 0 : requestAnimationFrame(paint);
    };
    var onScroll = function () {
      var top = Number(stickyTop()) || 0;
      var rect = section.getBoundingClientRect();
      var span = Math.max(1, rect.height - sticky.offsetHeight - top);
      var startAt = options.startAt == null ? top : Number(options.startAt);
      var progress = Math.max(0, Math.min(1, (startAt - rect.top) / span));
      var position = progress * (count - 1);
      var base = Math.min(count - 2, Math.floor(position));
      var fraction = position - base;
      var eased = fraction < dwell ? 0 : fraction > 1 - dwell ? 1 : (function (x) { return x * x * (3 - 2 * x); })((fraction - dwell) / (1 - 2 * dwell));
      target = Math.min(count - 1, base + eased);
      if (!raf) raf = requestAnimationFrame(paint);
    };
    var snapNow = function () {
      onScroll();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      current = target;
      paint();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return { onScroll: onScroll, snapNow: snapNow, destroy: function () { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); } };
  };
}());
