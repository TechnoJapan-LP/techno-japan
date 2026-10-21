#!/usr/bin/env node
/** 月次ニュースレターの下書きを作る。外部送信は --push と API キーがある時だけ。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const BASE = 'https://techno-japan.media';
const args = new Set(process.argv.slice(2));
const monthIndex = process.argv.indexOf('--month');
const monthArg = monthIndex >= 0 ? process.argv[monthIndex + 1] : process.argv.find((arg) => arg.startsWith('--month='))?.slice(8);

function jstDate() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function jstMonth() {
  return jstDate().slice(0, 7);
}
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
function loadData() {
  const context = {};
  vm.createContext(context);
  const source = fs.readFileSync(path.join(ROOT, 'LP/data.js'), 'utf8');
  new vm.Script(`${source}\n;globalThis.__data = { FESTIVALS, ARTICLES, ARTISTS };`).runInContext(context);
  const read = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, `LP/data/${name}.json`), 'utf8')).items || [];
  return {
    festivals: context.__data.FESTIVALS,
    articles: context.__data.ARTICLES,
    artists: context.__data.ARTISTS,
    editions: read('editions'),
    lineups: read('lineups'),
  };
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
function shortText(value, max = 100) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/[、。,.!?！？\s]+$/, '')}…`;
}
function festivalName(festival, lang) { return lang === 'en' ? (festival.name_en || festival.name) : festival.name; }
function location(ed, lang) { return lang === 'ja' ? (ed.LOCATION_JA || ed.LOCATION || ed.PREF || '') : (ed.LOCATION || ed.PREF || ed.LOCATION_JA || ''); }
function issueEditions(data, targetMonth) {
  return data.editions.filter((ed) => String(ed.DATE_START || '').startsWith(targetMonth) && !['cancelled', 'draft'].includes(String(ed.STATUS || '').toLowerCase()))
    .sort((a, b) => String(a.DATE_START).localeCompare(String(b.DATE_START)));
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
    if (issueIds.has(row.EDITION_ID) && artist && (artist.bio || artist.bio_en) && !ids.includes(artist.id)) ids.push(artist.id);
  }
  return ids.map((id) => artists.get(id)).slice(0, 8);
}
function articleRows(data, targetMonth, createdDate) {
  const previous = shiftMonth(targetMonth, -1);
  return data.articles.filter((article) => {
    const date = String(article.date || '').split('/')[0];
    return date >= `${previous}-01` && date <= createdDate && String(article.status || '').toLowerCase() !== 'draft';
  })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function buildBody(data, targetMonth, lang, createdDate) {
  const upcoming = festivalRows(data, targetMonth);
  const articles = articleRows(data, targetMonth, createdDate);
  const artists = artistRows(data, targetMonth);
  const title = lang === 'ja' ? monthLabel(targetMonth, lang) : monthLabel(targetMonth, lang);
  const lines = [
    `# TECHNO JAPAN — ${title}`,
    '',
    '## 編集部のひとこと',
    lang === 'ja' ? 'ここに3〜4行の編集部のひとことを入れてください。' : 'Add 3–4 lines from the editorial team here.',
    '',
    `## ${lang === 'ja' ? '今月の注目（候補）' : 'This month’s picks (candidates)'}`,
    lang === 'ja' ? '編集者が3本選ぶ前提の候補です。' : 'Candidates for the editor to choose three from.',
    ...(upcoming.slice(0, 6).map(({ ed, festival }) => `- ${dateLabel(ed.DATE_START, ed.DATE_END, lang)} — [${festivalName(festival, lang)}](${utm(`/festivals/${festival.id}.html`, targetMonth)})`)),
    ...(upcoming.length ? [] : [`- ${lang === 'ja' ? '候補なし' : 'No candidates.'}`]),
    '',
    `## ${lang === 'ja' ? `${monthLabel(targetMonth, lang)}の開催予定` : `Schedule for ${monthLabel(targetMonth, lang)}`}`,
    ...(upcoming.map(({ ed, festival }) => `- ${dateLabel(ed.DATE_START, ed.DATE_END, lang)} — ${festivalName(festival, lang)} — ${location(ed, lang)} — [詳細](${utm(`/festivals/${festival.id}.html`, targetMonth)})`)),
    ...(upcoming.length ? [] : [`- ${lang === 'ja' ? '掲載できる開催予定はありません。' : 'No scheduled events to list.'}`]),
    '',
    `## ${lang === 'ja' ? '先月の新着記事' : 'New stories from last month'}`,
    ...(articles.map((article) => {
      const summary = shortText(lang === 'en' ? (article.excerpt_en || article.excerpt) : article.excerpt, 120);
      const label = `[${lang === 'en' ? (article.title_en || article.title) : article.title}](${utm(`/articles/${article.id}.html`, targetMonth)})`;
      return `- ${label}${summary ? ` — ${summary}` : ''}`;
    })),
    ...(articles.length ? [] : [`- ${lang === 'ja' ? '掲載できる記事はありません。' : 'No new stories to list.'}`]),
    '',
    `## ${lang === 'ja' ? `${monthLabel(targetMonth, lang)}に出演予定のアーティスト` : `Artists appearing in ${monthLabel(targetMonth, lang)}`}`,
    ...(artists.map((artist) => `- [${artist.name}](${utm(`/artists/${artist.id}.html`, targetMonth)}) — ${shortText(lang === 'en' ? (artist.bio_en || artist.bio) : artist.bio, 120)}`)),
    ...(artists.length ? [] : [`- ${lang === 'ja' ? '紹介文のあるアーティストはありません。' : 'No artists with an existing bio were found.'}`]),
    '',
    `---\n[${lang === 'ja' ? 'TECHNO JAPAN のサイトを見る' : 'Visit TECHNO JAPAN'}](${utm('/', targetMonth)})`,
    '',
  ];
  return lines.join('\n');
}
function subject(targetMonth, lang) {
  const [year, month] = targetMonth.split('-').map(Number);
  return lang === 'ja' ? `${year}年${month}月のフェス・レイヴ情報 — TECHNO JAPAN` : `Festivals & raves in Japan — ${monthLabel(targetMonth, 'en')}`;
}
async function pushDraft(key, subjectLine, body, lang) {
  const response = await fetch('https://api.buttondown.com/v1/emails', {
    method: 'POST',
    headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject: subjectLine, body, status: 'draft' }),
  });
  if (!response.ok) throw new Error(`Buttondown ${lang} draft failed: HTTP ${response.status} ${await response.text()}`);
  const result = await response.json();
  console.log(`Buttondown ${lang} draft created: ${result.id || '(id unavailable)'}`);
}

const createdDate = jstDate();
// 通常の25日実行は、翌月に届ける号を作る。--month は号の月を直接指定する。
const targetMonth = validMonth(monthArg || shiftMonth(jstMonth(), 1));
const data = loadData();
const outputDir = path.join(ROOT, 'reports/newsletter');
fs.mkdirSync(outputDir, { recursive: true });
const drafts = {};
for (const lang of ['ja', 'en']) {
  const body = buildBody(data, targetMonth, lang, createdDate);
  const file = path.join(outputDir, `${targetMonth}-${lang}.md`);
  const content = `<!-- Subject: ${subject(targetMonth, lang)} -->\n\n${body}`;
  fs.writeFileSync(file, content);
  drafts[lang] = { body, subject: subject(targetMonth, lang), file };
  console.log(`Wrote ${file}`);
}
if (args.has('--push')) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) console.log('BUTTONDOWN_API_KEY is not set; no drafts were pushed.');
  else {
    await pushDraft(key, drafts.ja.subject, drafts.ja.body, 'ja');
    await pushDraft(key, drafts.en.subject, drafts.en.body, 'en');
  }
}
