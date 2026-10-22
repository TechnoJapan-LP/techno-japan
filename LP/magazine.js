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
}());
