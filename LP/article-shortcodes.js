/*
 * Article shortcode parser/renderer.
 *
 * This is an ES module so the Node build and the CMS can import the same
 * implementation.  The browser global is also exposed for a CMS script that
 * is loaded as type="module": globalThis.TJArticleShortcodes.
 */

const EVENT_RE = /\[\[event\|([^\]]*)\]\]/g;
const CALENDAR_RE = /\[\[calendar(?:\|([^\]]+))?\]\]/g;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TBA_RE = /^TBA\s+(\d{4})-(\d{2})$/i;
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_JA = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function safeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function utcDate(value) {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]) ? date : null;
}

function parseDateSpec(value, label) {
  const text = String(value || '').trim();
  const tba = TBA_RE.exec(text);
  if (tba && Number(tba[2]) >= 1 && Number(tba[2]) <= 12) {
    return { raw: text, start: null, end: null, tba: `${tba[1]}-${tba[2]}`, label };
  }
  const parts = text.split('〜');
  if (parts.length > 2 || !parts[0] || !utcDate(parts[0]) || (parts[1] && !utcDate(parts[1]))) {
    throw new Error(`eventの日付が不正です: ${text}`);
  }
  const start = parts[0];
  const end = parts[1] || start;
  if (end < start) throw new Error(`eventの日付の開始日が終了日より後です: ${text}`);
  return { raw: text, start, end, tba: '', label };
}

function parseMonthFilter(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})\.\.(\d{4})-(\d{2})$/.exec(String(value).trim());
  if (!match || Number(match[2]) > 12 || Number(match[4]) > 12) {
    throw new Error(`calendarの期間が不正です: ${value}`);
  }
  const start = `${match[1]}-${match[2]}`;
  const end = `${match[3]}-${match[4]}`;
  if (end < start) throw new Error(`calendarの期間が逆順です: ${value}`);
  return { start, end };
}

function parseEventFields(fields) {
  const values = String(fields).split('|').map((value) => value.trim());
  const [name, date, place, officialUrl = '', note = ''] = values;
  const errors = [];
  if (!name) errors.push('eventの名前が空です');
  if (!date) errors.push('eventの日程が空です');
  if (!place) errors.push('eventの場所が空です');
  let parsedDate = null;
  if (date) {
    try { parsedDate = parseDateSpec(date, date); } catch (error) { errors.push(error.message); }
  }
  let url = '';
  if (officialUrl) {
    url = safeUrl(officialUrl);
    if (!url) errors.push(`eventのURLが不正です: ${officialUrl}`);
  }
  if (errors.length) throw new Error(errors.join(' / '));
  return {
    name, date: parsedDate, place, url,
    tags: note.split(';').map((tag) => tag.trim()).filter(Boolean),
  };
}

function parseEvents(source) {
  const events = [];
  let match;
  EVENT_RE.lastIndex = 0;
  while ((match = EVENT_RE.exec(String(source || ''))) !== null) {
    const event = parseEventFields(match[1]);
    event.index = events.length;
    event.slug = `${slugify(event.name)}-${event.index + 1}`;
    events.push(event);
  }
  return events;
}

function slugify(value) {
  return String(value).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
}

function formatDate(date, lang = 'en') {
  if (!date) return '';
  const [year, month, day] = date.split('-').map(Number);
  return lang === 'ja' ? `${year}年${month}月${day}日` : `${MONTHS_EN[month - 1]} ${day}, ${year}`;
}

function formatEventDate(date, lang = 'en') {
  if (date.tba) return lang === 'ja' ? `${date.tba.replace('-', '年')}月 日程未定` : `TBA ${date.tba}`;
  if (date.start === date.end) return formatDate(date.start, lang);
  return `${formatDate(date.start, lang)} – ${formatDate(date.end, lang)}`;
}

function renderEvent(event, lang = 'en') {
  const past = event.date.end ? event.date.end < new Date().toISOString().slice(0, 10) : false;
  const tags = event.tags.length ? ` · ${event.tags.map(escapeHtml).join(' · ')}` : '';
  const official = event.url
    ? `<a class="tj-event-link" href="${escapeHtml(event.url)}" rel="noopener" target="_blank" itemprop="url">OFFICIAL ↗</a>`
    : '';
  return `<article class="tj-event${past ? ' is-past' : ''}" id="ev-${escapeHtml(event.slug)}" itemscope itemtype="https://schema.org/Event" data-start="${escapeHtml(event.date.start || '')}" data-end="${escapeHtml(event.date.end || '')}">` +
    `<time class="tj-event-date" datetime="${escapeHtml(event.date.start || event.date.tba)}" itemprop="startDate">${escapeHtml(formatEventDate(event.date, lang))}</time>` +
    `<h3 class="tj-event-name" itemprop="name">${escapeHtml(event.name)}</h3>` +
    `<p class="tj-event-place" itemprop="location">${escapeHtml(event.place)}${tags}</p>${official}</article>`;
}

function eventMonth(event) {
  return event.date.start ? event.date.start.slice(0, 7) : event.date.tba;
}

function renderCalendar(events, range = null, lang = 'en') {
  if (!events.length) throw new Error('calendarがあるのにeventカードが0件です');
  const filtered = events.filter((event) => !range || (eventMonth(event) >= range.start && eventMonth(event) <= range.end));
  const groups = new Map();
  filtered.sort((a, b) => eventMonth(a).localeCompare(eventMonth(b)) || a.index - b.index);
  for (const event of filtered) {
    const month = eventMonth(event);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(event);
  }
  const months = [...groups.entries()].map(([month, monthEvents]) => {
    const [year, monthNumber] = month.split('-').map(Number);
    const heading = lang === 'ja' ? `${year}年 ${MONTHS_JA[monthNumber - 1]}` : `${year} ${MONTHS_EN[monthNumber - 1]}`;
    const rows = monthEvents.map((event) => `<li><time datetime="${escapeHtml(event.date.start || event.date.tba)}">${escapeHtml(formatEventDate(event.date, lang))}</time><a href="#ev-${escapeHtml(event.slug)}">${escapeHtml(event.name)}</a><span>${escapeHtml(event.place)}</span></li>`).join('');
    return `<div class="tj-cal-month"><h3>${heading}</h3><ol>${rows}</ol></div>`;
  }).join('');
  return `<nav class="tj-calendar" aria-label="${lang === 'ja' ? '開催カレンダー' : 'Event calendar'}">${months}</nav>`;
}

function renderArticleShortcodes(source, { lang = 'en' } = {}) {
  const text = String(source || '');
  const events = parseEvents(text);
  const calendarMatches = [];
  CALENDAR_RE.lastIndex = 0;
  let match;
  while ((match = CALENDAR_RE.exec(text)) !== null) calendarMatches.push({ raw: match[0], range: parseMonthFilter(match[1]) });
  if (calendarMatches.length && !events.length) throw new Error('calendarがあるのにeventカードが0件です');
  let eventIndex = 0;
  let html = text.replace(EVENT_RE, (_, fields) => {
    const event = parseEventFields(fields);
    event.index = eventIndex;
    event.slug = `${slugify(event.name)}-${eventIndex + 1}`;
    eventIndex += 1;
    return renderEvent(event, lang);
  });
  html = html.replace(CALENDAR_RE, (_, value) => renderCalendar(events, parseMonthFilter(value), lang));
  // CMSのQuillは短いコードを<p>[[event|...]]</p>として保存する。
  // article/nav はpの子にできないため、ブロックの外側だけを取り除いて
  // ブラウザのHTMLパーサーによるDOMの組み替えを防ぐ。
  html = html
    .replace(/<p>\s*(<article class="tj-event[\s\S]*?<\/article>)\s*<\/p>/g, '$1')
    .replace(/<p>\s*(<nav class="tj-calendar[\s\S]*?<\/nav>)\s*<\/p>/g, '$1');
  return { html, events, calendars: calendarMatches.length };
}

const API = { parseEventFields, parseEvents, parseMonthFilter, renderEvent, renderCalendar, renderArticleShortcodes, safeUrl };
globalThis.TJArticleShortcodes = API;
export { parseEventFields, parseEvents, parseMonthFilter, renderEvent, renderCalendar, renderArticleShortcodes, safeUrl };
