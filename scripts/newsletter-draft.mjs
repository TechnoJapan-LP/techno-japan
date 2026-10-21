#!/usr/bin/env node
/** 月次ニュースレターのHTML下書きを作る。外部送信は --push と API キーがある時だけ。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BASE = 'https://techno-japan.media';
const BUTTONDOWN_API = process.env.BUTTONDOWN_API_URL || 'https://api.buttondown.com/v1/emails';
const args = new Set(process.argv.slice(2));
const monthIndex = process.argv.indexOf('--month');
const monthArg = monthIndex >= 0 ? process.argv[monthIndex + 1] : process.argv.find((arg) => arg.startsWith('--month='))?.slice(8);

function jstDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function jstMonth() { return jstDate().slice(0, 7); }
function validMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error(`--month は YYYY-MM で指定してください: ${value}`);
  const date = new Date(`${value}-01T00:00:00Z`);
  if (date.getUTCMonth() + 1 !== Number(value.slice(5))) throw new Error(`存在しない月です: ${value}`);
  return value;
}
function shiftMonth(value, delta) {
  const date = new Date(`${value}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}
function monthLabel(value, lang) {
  const [year, month] = value.split('-').map(Number);
  return lang === 'ja' ? `${year}年${month}月` : new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function loadData() {
  const context = {};
  vm.createContext(context);
  const source = fs.readFileSync(path.join(ROOT, 'LP/data.js'), 'utf8');
  new vm.Script(`${source}\n;globalThis.__data = { FESTIVALS, ARTICLES, ARTISTS };`).runInContext(context);
  const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, `LP/data/${name}.json`), 'utf8')).items || [];
  return { festivals: context.__data.FESTIVALS, articles: context.__data.ARTICLES, artists: context.__data.ARTISTS, editions: read('editions'), lineups: read('lineups') };
}
function loadDerivatives() {
  const source = fs.readFileSync(path.join(ROOT, 'LP/image-derivatives.js'), 'utf8');
  const match = source.match(/window\.TJ_IMAGE_DERIVATIVES\s*=\s*(\{[\s\S]*?\});/);
  return match ? JSON.parse(match[1]) : {};
}
function imageUrl(source, derivatives) {
  const raw = String(source || '').trim();
  if (!raw) return '';
  if (/^https:\/\//.test(raw)) return raw;
  if (/^http:\/\//.test(raw)) return '';
  const original = raw.replace(/^\/+/, '');
  const entry = derivatives[original];
  const selected = typeof entry === 'string' ? entry : entry?.src || original;
  if (fs.existsSync(path.join(ROOT, 'LP', selected))) return new URL(`/${selected}`, BASE).toString();
  if (selected !== original && fs.existsSync(path.join(ROOT, 'LP', original))) return new URL(`/${original}`, BASE).toString();
  return '';
}
function utm(pathname, month) {
  const url = new URL(pathname, BASE);
  url.searchParams.set('utm_source', 'newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', month);
  return url.toString();
}
function dateLabel(start, end, lang) {
  const date = new Date(`${start}T00:00:00Z`);
  if (lang === 'ja') return end && end !== start ? `${start.replaceAll('-', '.')}–${end.slice(5).replace('-', '.')}` : start.replaceAll('-', '.');
  const first = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  if (!end || end === start) return `${first}, ${start.slice(0, 4)}`;
  return `${first}–${end.slice(5).replace('-', '/')}, ${start.slice(0, 4)}`;
}
// Match the detail page display rule: JA uses the public name; EN falls back to it.
function festivalName(festival, lang) { return lang === 'en' ? (festival.name_en || festival.name) : festival.name; }
function location(ed, lang) { return lang === 'ja' ? (ed.LOCATION_JA || ed.LOCATION || ed.PREF || '') : (ed.LOCATION || ed.PREF || ed.LOCATION_JA || ''); }
function issueEditions(data, targetMonth) {
  return data.editions.filter((ed) => String(ed.DATE_START || '').startsWith(targetMonth) && !['cancelled', 'draft'].includes(String(ed.STATUS || '').toLowerCase())).sort((a, b) => String(a.DATE_START).localeCompare(String(b.DATE_START)));
}
function festivalRows(data, targetMonth) {
  const byId = new Map(data.festivals.map((f) => [String(f.id), f]));
  return issueEditions(data, targetMonth).map((ed) => ({ ed, festival: byId.get(String(ed.FESTIVAL_ID)) })).filter((row) => row.festival);
}
function artistRows(data, targetMonth) {
  const issueIds = new Set(issueEditions(data, targetMonth).map((ed) => ed.EDITION_ID));
  const artists = new Map(data.artists.map((artist) => [String(artist.id), artist]));
  const ids = [];
  for (const row of data.lineups) {
    const artist = artists.get(String(row.ARTIST_ID || ''));
    if (issueIds.has(row.EDITION_ID) && artist && !ids.includes(artist.id)) ids.push(artist.id);
  }
  return ids.map((id) => artists.get(id));
}
function articleRows(data, targetMonth, createdDate) {
  const previous = shiftMonth(targetMonth, -1);
  return data.articles.filter((article) => {
    const date = String(article.date || '').split('/')[0];
    return date >= `${previous}-01` && date <= createdDate && String(article.status || '').toLowerCase() !== 'draft';
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// #1b1b1b is the sRGB result of blending #f0ede8 at 8% over #080808.
const COLORS = { bg: '#080808', panel: '#1b1b1b', text: '#f0ede8', accent: '#ff2d2d' };
const cell = 'border-collapse:collapse;';
function sectionHeading(text) { return `<tr><td colspan="2" width="100%" style="width:100%;padding:28px 0 10px;border-bottom:1px solid rgba(240,237,232,0.28);font-size:18px;line-height:24px;font-weight:700;color:${COLORS.text};">${esc(text)}</td></tr>`; }
function card(item, month) {
  const image = item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${esc(item.title)}" width="100%" height="auto" style="display:block;width:100%;height:auto;border:0;">` : '';
  const href = esc(utm(item.href, month));
  return `<td width="50%" valign="top" style="width:50%;padding:0 5px 10px 5px;"><a href="${href}" style="display:block;color:${COLORS.text};text-decoration:none;"><table role="presentation" width="100%" style="${cell}width:100%;background-color:${COLORS.panel};border-radius:12px;overflow:hidden;"><tr><td>${image}</td></tr><tr><td style="padding:12px 12px 14px;"><div style="font-size:11px;line-height:16px;font-weight:700;letter-spacing:.04em;color:${COLORS.accent};">${esc(item.label)}</div><div style="color:${COLORS.text};font-size:15px;line-height:21px;font-weight:700;max-height:63px;overflow:hidden;">${esc(item.title)}</div></td></tr></table></a></td>`;
}
function cardGrid(items, month, lang) {
  if (!items.length) return `<tr><td colspan="2" width="100%" style="width:100%;padding:12px 0;color:#f0ede8;font-size:14px;line-height:22px;">${lang === 'ja' ? '掲載できる項目はありません。' : 'No items to feature.'}</td></tr>`;
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(`<tr>${card(items[i], month)}${items[i + 1] ? card(items[i + 1], month) : '<td width="50%" style="width:50%;padding:0 5px 10px 5px;">&nbsp;</td>'}</tr>`);
  return rows.join('');
}
function listRow(text) { return `<tr><td colspan="2" width="100%" style="width:100%;padding:4px 0;color:${COLORS.text};font-size:14px;line-height:22px;word-break:break-word;overflow-wrap:anywhere;">${text}</td></tr>`; }
function buildBody(data, targetMonth, lang, createdDate, derivatives) {
  const upcoming = festivalRows(data, targetMonth);
  const articles = articleRows(data, targetMonth, createdDate);
  const artists = artistRows(data, targetMonth);
  const title = monthLabel(targetMonth, lang);
  const picks = upcoming.slice(0, 6).map(({ ed, festival }) => ({ href: `/festivals/${festival.id}.html`, title: festivalName(festival, lang), label: dateLabel(ed.DATE_START, ed.DATE_END, lang), imageUrl: imageUrl(festival.flyer || festival.image, derivatives) }));
  const stories = articles.map((article) => ({ href: `/articles/${article.id}.html`, title: lang === 'en' ? (article.title_en || article.title) : article.title, label: `${article.category || 'STORY'} · ${String(article.date || '').slice(0, 10)}`, imageUrl: imageUrl(article.image, derivatives) }));
  const artistCards = artists.filter((artist) => artist.image).map((artist) => ({ href: `/artists/${artist.id}.html`, title: artist.name, label: lang === 'ja' ? '出演予定' : 'UPCOMING', imageUrl: imageUrl(artist.image, derivatives) }));
  const artistLinks = artists.filter((artist) => !artist.image).map((artist) => `<a href="${esc(utm(`/artists/${artist.id}.html`, targetMonth))}" style="color:${COLORS.text};text-decoration:underline;">${esc(artist.name)}</a>`).join(' · ');
  const schedule = upcoming.length ? upcoming.map(({ ed, festival }) => listRow(`${esc(dateLabel(ed.DATE_START, ed.DATE_END, lang))} — ${esc(festivalName(festival, lang))} — ${esc(location(ed, lang))} — <a href="${esc(utm(`/festivals/${festival.id}.html`, targetMonth))}" style="color:${COLORS.text};text-decoration:underline;">${lang === 'ja' ? '詳細' : 'Details'}</a>`)).join('') : listRow(lang === 'ja' ? '掲載できる開催予定はありません。' : 'No scheduled events to list.');
  const editorial = lang === 'ja' ? 'ここに3〜4行の編集部のひとことを入れてください。' : 'Add 3–4 lines from the editorial team here.';
  const footer = lang === 'ja' ? 'TECHNO JAPAN のサイトを見る' : 'Visit TECHNO JAPAN';
  return `<!-- buttondown-editor-mode: fancy -->\n<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:${COLORS.bg};color:${COLORS.text};"><table role="presentation" width="100%" style="${cell}width:100%;background-color:${COLORS.bg};table-layout:fixed;"><tr><td align="center" style="padding:20px 10px;"><table role="presentation" width="600" style="${cell}width:100%;max-width:600px;background-color:${COLORS.bg};color:${COLORS.text};table-layout:fixed;"><tr><td colspan="2" width="100%" style="width:100%;padding:8px 0 24px;border-bottom:1px solid rgba(240,237,232,0.28);"><h1 style="margin:0;color:${COLORS.text};font-size:24px;line-height:30px;">TECHNO JAPAN — ${esc(title)}</h1></td></tr><tr><td colspan="2" width="100%" style="width:100%;padding:24px 0 4px;color:${COLORS.text};font-size:15px;line-height:24px;word-break:break-word;overflow-wrap:anywhere;">${esc(editorial)}</td></tr>${sectionHeading(lang === 'ja' ? '今月の注目（候補）' : 'This month’s picks (candidates)')}${cardGrid(picks, targetMonth, lang)}${sectionHeading(lang === 'ja' ? `${title}の開催予定` : `Schedule for ${title}`)}${schedule}${sectionHeading(lang === 'ja' ? '先月の新着記事' : 'New stories from last month')}${cardGrid(stories, targetMonth, lang)}${sectionHeading(lang === 'ja' ? `${title}に出演予定のアーティスト` : `Artists appearing in ${title}`)}${cardGrid(artistCards, targetMonth, lang)}${artists.some((artist) => !artist.image) ? listRow(artistLinks) : ''}<tr><td colspan="2" width="100%" style="width:100%;padding:28px 0 8px;border-top:1px solid rgba(240,237,232,0.28);"><a href="${esc(utm('/', targetMonth))}" style="color:${COLORS.accent};font-size:14px;line-height:22px;font-weight:700;text-decoration:none;">${esc(footer)} →</a></td></tr><tr><td colspan="2" width="100%" style="width:100%;padding:12px 0 0;color:${COLORS.text};font-size:11px;line-height:18px;"><a href="{{ unsubscribe_url }}" style="color:${COLORS.text};text-decoration:underline;">${lang === 'ja' ? '配信停止' : 'Unsubscribe'}</a></td></tr></table></td></tr></table></body></html>`;
}
function subject(targetMonth, lang) { return lang === 'ja' ? `${monthLabel(targetMonth, lang)}のフェス・レイヴ情報 — TECHNO JAPAN` : `Festivals & raves in Japan — ${monthLabel(targetMonth, 'en')}`; }
async function buttondownRequest(key, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Buttondown request failed: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
async function pushDraft(key, subjectLine, body, lang) {
  const query = new URL(BUTTONDOWN_API); query.searchParams.set('status', 'draft');
  const listed = await buttondownRequest(key, query.toString());
  const matches = (listed?.results || []).filter((email) => email.status === 'draft' && email.subject === subjectLine);
  const payload = JSON.stringify({ subject: subjectLine, body, status: 'draft', template: 'naked' });
  if (matches.length) {
    for (const email of matches) await buttondownRequest(key, `${BUTTONDOWN_API}/${encodeURIComponent(email.id)}`, { method: 'PATCH', body: payload });
    console.log(`Buttondown ${lang} draft updated: ${matches.map((email) => email.id).join(', ')}`);
  } else {
    const result = await buttondownRequest(key, BUTTONDOWN_API, { method: 'POST', body: payload });
    console.log(`Buttondown ${lang} draft created: ${result?.id || '(id unavailable)'}`);
  }
}

const createdDate = jstDate();
const targetMonth = validMonth(monthArg || shiftMonth(jstMonth(), 1));
const data = loadData();
const derivatives = loadDerivatives();
const outputDir = path.join(ROOT, 'reports/newsletter'); fs.mkdirSync(outputDir, { recursive: true });
const drafts = {};
for (const lang of ['ja', 'en']) {
  const body = buildBody(data, targetMonth, lang, createdDate, derivatives);
  const file = path.join(outputDir, `${targetMonth}-${lang}.html`);
  fs.writeFileSync(file, `<!-- Subject: ${subject(targetMonth, lang)} -->\n${body}\n`);
  drafts[lang] = { body, subject: subject(targetMonth, lang), file };
  console.log(`Wrote ${file}`);
}
if (args.has('--push')) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) console.log('BUTTONDOWN_API_KEY is not set; no drafts were pushed.');
  else { await pushDraft(key, drafts.ja.subject, drafts.ja.body, 'ja'); await pushDraft(key, drafts.en.subject, drafts.en.body, 'en'); }
}
