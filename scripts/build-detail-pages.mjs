#!/usr/bin/env node
/**
 * 個別詳細ページ（実URL）を data.js から生成する。
 *
 * なぜ必要か:
 *   これまで詳細ページは `news.html#article/xxx` のようなハッシュURLだけだった。
 *   Google はハッシュ以降を別ページとして扱わないため、記事もフェスも
 *   アーティストも「1ページ」としてしか認識されず、個別に検索結果へ出なかった。
 *   ここで実URL（/articles/xxx.html 等）の静的ページを生成して初めて
 *   インデックス対象になる。
 *
 * 出力:
 *   LP/articles/<id>.html
 *   LP/festivals/<id>.html
 *   LP/artists/<id>.html
 *   LP/venues/<id>.html
 *
 * 使い方: node scripts/build-detail-pages.mjs
 * draft確認: node scripts/build-detail-pages.mjs --draft-preview=reports/fixtures/phase5-asian-festival-roundup.json
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { imageSizeAttrs } from './lib/image-size.mjs';
import { clauseBreaks, phraseBreaks } from './lib/phrase-breaks.mjs';
import { autolinkArtists, parseEvents, renderArticleShortcodes } from '../LP/article-shortcodes.js';
import { articleMatchesArtist } from './lib/artist-page-utils.mjs';
import { loadArticleImageMap, replaceMappedArticleImages } from './lib/article-body-images.mjs';
import { contentHash, contentRow } from './lib/content-dates.mjs';
import { resolveLineupArtist } from './lib/lineup-artist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LP_DIR = path.join(__dirname, '..', 'LP');
const DATA_PATH = path.join(LP_DIR, 'data.js');

/* ==============================================================
   アセットの ?v（キャッシュバスティング）

   **ここより下で ?v を文字列にべた書きしないこと。**

   2026-08-07〜08 のデプロイ失敗6件のうち3件がこれだった。
   article-fx の版を文字列で埋めていたため、HTML の ?v を手で上げても
   次のビルドで元に戻り、「直したつもりが直らない」状態が続いた。
   検査は毎回正しく落としていたが、落ちる場所（HTML）と直す場所（ここ）が
   ずれていて原因に辿り着けなかった。AUDIT §9-58。

   使う場所より前で定義すること（2026-08-08 に下方で定義していて
   ReferenceError でビルドが止まった）。scripts/check_no_hardcoded_versions.py
   がべた書きを禁止する。
   ============================================================== */
/* detail.css の ?v は全ページで同一にすること。
   1932e50「Redesign all festival detail pages」で detail.css に259行を追記した際、
   フェス詳細だけを ?v=4 にし、artists/venues/articles/en の226ページは ?v=3 のまま
   残った。追記が .festival-design-v2 配下だけだったので実害は出なかったが、
   sw.js は /detail.css を cacheFirst で持つため（scripts/check_sw_routing.mjs）、
   次に共通ルールを触ったときは 226ページに新CSSが届かない。
   呼び出し側で上書きできる引数にしておくと同じことが起きるので定数にする。
   CSS を変更したら、ここを上げて全詳細ページを再生成する。AUDIT §9-44。 */
const DETAIL_CSS_VERSION = 90;

/* 記事ページの演出アセット。**べた書きしないこと。**

   2026-08-07〜08 のデプロイ失敗6件のうち3件がこれだった。
   生成側が `?v=1` `?v=2` を文字列で埋めていたため、
   article-fx を編集して HTML の ?v を手で上げても、
   **次のビルドで元に戻る。** 直したつもりが直っていない状態が続いた。
   検査（check_asset_versions.py）は毎回正しく落としていたのに、
   落ちる場所と直す場所がずれていて原因に辿り着けなかった。AUDIT §9-58。

   article-fx.js / article-fx.css を変更したら、ここを上げる。 */
const ARTICLE_FX_JS_VERSION = 14;
const ARTICLE_FX_CSS_VERSION = 18;

/* 全ページ共通アセットの版。ここも同じ理由でべた書きしない
   （変更しても次のビルドで戻り、直したつもりが直らない）。 */
const COMMON_JS_VERSION = 20;   // 2026-10-23 festival tab section tracking
const COMMON_CSS_VERSION = 55;   // 2026-10-26 mobile menu search sizing
const DATA_HUB_VERSION = 11;
const SEARCH_JS_VERSION = 9;
const LANG_TOGGLE_VERSION = 3;
const MAGAZINE_JS_VERSION = 7;
const FAVORITES_JS_VERSION = 4;
const EDITIONS_PATH = path.join(LP_DIR, 'data', 'editions.json');
const LINEUPS_PATH = path.join(LP_DIR, 'data', 'lineups.json');
const ARTISTS_PATH = path.join(LP_DIR, 'data', 'artists.json');
const AUTHORS_PATH = path.join(LP_DIR, 'data', 'authors.json');
const IMAGE_DIMENSIONS_PATH = path.join(LP_DIR, 'image-dimensions.json');
const ARTICLE_IMAGE_MAP = loadArticleImageMap(path.join(__dirname, '..'));
const BASE = 'https://techno-japan.media';
const NEWSLETTER_CONFIG_PATH = path.join(__dirname, 'newsletter-config.json');
const NEWSLETTER_CONFIG = fs.existsSync(NEWSLETTER_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(NEWSLETTER_CONFIG_PATH, 'utf8'))
  : { provider: 'formsubmit', buttondownUsername: '' };
const BUTTONDOWN_USERNAME = String(NEWSLETTER_CONFIG.buttondownUsername || '').trim();
const USE_BUTTONDOWN = NEWSLETTER_CONFIG.provider === 'buttondown' && Boolean(BUTTONDOWN_USERNAME);
const DRAFT_PREVIEW_ARG = process.argv.find((arg) => arg.startsWith('--draft-preview='));
const DRAFT_PREVIEW_PATH = DRAFT_PREVIEW_ARG ? path.resolve(process.cwd(), DRAFT_PREVIEW_ARG.slice('--draft-preview='.length)) : '';
const DRAFT_PREVIEW_DIR = path.join(__dirname, '..', 'reports', 'phase5-preview');
const CONTENT_DATES_PATH = path.join(LP_DIR, 'data', 'content-dates.json');
let CONTENT_DATES = {};
let CONTENT_DATE_UPDATES = {};
const CONTENT_SNAPSHOTS = new Map();

/* 最終更新日は、ページに出るデータのハッシュを台帳で追跡する。 */
function loadContentDates() {
  if (!fs.existsSync(CONTENT_DATES_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONTENT_DATES_PATH, 'utf8')) || {}; } catch { return {}; }
}
function contentDate(kind, id, snapshot) {
  const key = `${kind}:${id}`;
  const hash = contentHash(snapshot);
  const old = CONTENT_DATES[key];
  if (old?.hash === hash) return old.date || '';
  const date = jstToday();
  CONTENT_DATE_UPDATES[key] = { hash, date };
  return date;
}
function writeContentDates() {
  const next = {};
  for (const key of CONTENT_SNAPSHOTS.keys()) {
    if (CONTENT_DATE_UPDATES[key]) next[key] = CONTENT_DATE_UPDATES[key];
    else if (CONTENT_DATES[key]) next[key] = CONTENT_DATES[key];
  }
  const sorted = Object.fromEntries(Object.keys(next).sort().map((key) => [key, next[key]]));
  const text = JSON.stringify(sorted, null, 2) + '\n';
  if (!fs.existsSync(CONTENT_DATES_PATH) || fs.readFileSync(CONTENT_DATES_PATH, 'utf8') !== text) fs.writeFileSync(CONTENT_DATES_PATH, text);
}
function updatedLabel(date, lang) {
  return date ? `<p class="detail-last-updated"><time datetime="${esc(date)}">${lang === 'en' ? 'Last updated' : '最終更新'}: ${esc(date)}</time></p>` : '';
}

/* 開催回の識別子は "YYYY" または "YYYY-N"（同年複数回・2026-09-13 対応）。
   EDITION_ID={festivalId}-{この値} なので、同年でも一意になる。
   表示は "2026 #2"。CMS側 LP/cms.js の editionKeyParts()/editionLabel() と
   同じ規則。片方だけ直さないこと。 */
function editionKeyParts(value) {
  const m = String(value || '').trim().match(/^(\d{4})(?:-(\d+))?$/);
  return m ? { year: Number(m[1]), seq: m[2] ? Number(m[2]) : 1 } : { year: 0, seq: 0 };
}
function editionLabel(value) {
  const p = editionKeyParts(value);
  return p.year ? (p.seq > 1 ? `${p.year} #${p.seq}` : String(p.year)) : String(value || '');
}
function editionIdentifier(ed) {
  return ed?.EDITION || ed?.editionKey || (ed?.EDITION_ID ? '' : ed?.year) || '';
}

// 詳細ページとハブのJSテンプレートが同じ最新寸法を参照できるよう、
// ページ生成のたびに実画像から派生メタデータを先に再生成する。
await import('./build-image-dimensions.mjs');
// ブランドロゴ（Organization.logo 用）と OGP フォールバック画像は役割が違うので分ける。
// ロゴは正方形のブランド識別子、OGP は SNS カード向けの横長ビジュアル。
// ロゴを差し替えるときはこのパスのファイルを置き換えるだけでよい（URL は変えない）。
const ORG_ID = `${BASE}/#org`;
const ORG_LOGO = `${BASE}/images/logo-512.png?v=2`;
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  '@id': ORG_ID,
  name: 'TECHNO JAPAN',
  url: `${BASE}/`,
  logo: { '@type': 'ImageObject', url: ORG_LOGO, width: 512, height: 512 },
  sameAs: [
    'https://www.instagram.com/techno.japan_/',
    'https://www.threads.net/@techno.japan_',
  ],
  knowsAbout: ['techno', 'house music', 'music festivals in Japan', 'Japanese club culture'],
  publishingPrinciples: `${BASE}/about.html`,
  inLanguage: ['ja', 'en'],
};
/* 自前の写真を持たないページ（トップ・ABOUT・一覧など283枚）が SNS で
   共有されたときのサムネイル。

   ⚠️ 2026-08-14 まで **他社フェスの写真（Rainbow Disco Club）** が
   全ページの既定になっていた。トップページを X や Instagram で共有すると、
   TECHNO JAPAN と無関係の写真がカードに出ていた。
   ロゴ入りの専用画像（1200x630）に差し替えた。AUDIT §9-86。 */
const DEFAULT_OG = `${BASE}/images/og-default.png?v=1`;

// ID 規約違反(DATA_SCHEMA §1.1)の是正に伴う旧ID→新ID。JA/EN 双方で使う。
// 一度発行したIDは変更しない原則の例外で、一括登録時に ID 欄へ NAME を
// そのまま貼ってしまった分。旧URLは %20 入りで配信されていた。
const ARTIST_ID_FIXES = {
  'Acid Pauli': 'acid-pauli',
  'Alabaster DePlume': 'alabaster-deplume',
  'Juana Molina': 'juana-molina',
  'Kiko Dinucci': 'kiko-dinucci',
  'Kuo from Sunset Rollercoaster': 'kuo-from-sunset-rollercoaster',
  'Sylvan Esso': 'sylvan-esso',
  'The Master Musicians of Joujouka': 'the-master-musicians-of-joujouka',
  // 表示名 "Suze Ijó" のアクセント付き ó が落ちて "ij" になっていた（2026-08-14）。
  // 上の7件と違い %20 は出ていないが、名前と ID が対応しない点で同じ違反。
  // ⚠️ シート側（ARTISTS.ID と LINEUPS.ARTIST_ID の rainbow-disco-club-2026 の1行）を
  //    suze-ijo に直して Publish するまで、この行は何もしない。
  //    redirectStubs が「旧IDが消えて新IDが出てから」しかスタブを出さないため、
  //    先に入れておいても安全（順序を気にしなくてよい）。
  'suze-ij': 'suze-ijo',
};

// 名称の転記誤りに伴う旧ID→新ID。
// INBOX に「FuliRock」と入力されたまま FESTIVALS へ登録されていたが、
// 実体は FUJI ROCK FESTIVAL（日程 2026-07-24/26・新潟県湯沢町 苗場スキー場が
// 公式発表と完全一致し、desc / desc_en も当初から FUJI ROCK について
// 書かれていた）。誤っていたのは id と name だけ。
// 詳細ページが JA/EN で配信済み・sitemap 掲載済みのため、旧URLは残す。
// §9-28 の分類では「正しいコンテンツの正しくないURL」に当たり、
// リダイレクトが妥当（存在すべきでないコンテンツの 404 とは扱いが違う）。
const FESTIVAL_ID_FIXES = {
  fulirock: 'fuji-rock',
};

/* ---------- data.js を読み込む ---------- */
function loadData() {
  const src = fs.readFileSync(DATA_PATH, 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  new vm.Script(src + '\n;globalThis.__out = { ARTISTS, EVENTS, FESTIVALS, VENUES, ARTICLES };').runInContext(ctx);
  return ctx.__out;
}

/* CMS の Publish でも data-hub.js を送っているが、GAS 側が複数ファイルに
   対応していない場合に備えてビルドでも生成する（2026-09-15）。
   除外する7項目は cms.js の buildHubDataJs と同じ。片方だけ変えないこと。 */
function buildHubDataJs(data) {
  const strip = (name, row) => Object.fromEntries(Object.entries(row).filter(([key]) => {
    if (name === 'ARTICLES') return key !== 'body' && key !== 'body_en';
    if (name === 'FESTIVALS') return key !== 'desc' && key !== 'desc_en' && key !== 'editions' && key !== 'sound';
    if (name === 'VENUES') return key !== 'gallery';
    return true;
  }));
  const rows = (name) => (data[name] || []).map((row) => strip(name, row));
  const header = `/* ==========================================================
   TECHNO JAPAN — HUB DATA

   Lightweight shared data for hub pages. Detail-only content stays in data.js.
   ========================================================== */`;
  return [
    header,
    'const ARTISTS = ' + JSON.stringify(rows('ARTISTS')) + ';',
    'const EVENTS = ' + JSON.stringify(rows('EVENTS')) + ';',
    'const FESTIVALS = ' + JSON.stringify(rows('FESTIVALS')) + ';',
    'const VENUES = ' + JSON.stringify(rows('VENUES')) + ';',
    'const ARTICLES = ' + JSON.stringify(rows('ARTICLES')) + ';',
    'const AUTHORS = ' + JSON.stringify(rows('AUTHORS')) + ';',
  ].join('\n\n');
}

function writeHubDataJs(data) {
  const file = path.join(LP_DIR, 'data-hub.js');
  const content = buildHubDataJs(data);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content);
  return true;
}

function loadDraftPreview(file) {
  const article = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    throw new Error(`draft preview: objectが必要です (${file})`);
  }
  if (String(article.status || '').toLowerCase() !== 'draft') {
    throw new Error(`draft preview: status は draft にしてください (${file})`);
  }
  return article;
}

function loadItems(file, label) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.items)) throw new Error(`${label}: items 配列がありません`);
  if (Number.isFinite(data.count) && data.count !== data.items.length) {
    throw new Error(`${label}: count=${data.count} と items=${data.items.length} が一致しません`);
  }
  return data.items;
}

function loadOptionalItems(file, label) {
  if (!fs.existsSync(file)) return [];
  return loadItems(file, label);
}

/* ---------- ユーティリティ ---------- */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* href に入れる URL のスキーム検証。
   esc() は " を潰すので属性からの脱出は防げるが、`javascript:alert(1)` は
   そのまま href に残り、クリックで実行される。URL・TICKETURL・INSTAGRAM・
   SOUNDCLOUD 等はスプレッドシート（CMS）から来るので、現時点では信頼できるが、
   「入力元が1つで信頼できる」という前提はフォーム投稿や取り込みが増えれば崩れる。
   HTML として解釈させる値と同じく、出所を問わず通す。AUDIT §9-44。

   相対パスは自前で組み立てたものなのでそのまま通す。 */
const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);
function safeUrl(value) {
  const v = String(value ?? '').trim();
  if (!v) return '';
  // スキームを持たない（= 相対 / ルート相対 / フラグメント）ものは自前の組み立て。
  if (/^(?:\/|#|\.)/.test(v)) return v;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return v;
  try {
    if (SAFE_URL_SCHEMES.has(new URL(v).protocol)) return v;
  } catch { /* 壊れたURLは落とす */ }
  console.warn(`  ⚠ 危険なスキームの URL を除去: ${v.slice(0, 80)}`);
  return '';
}

// 本文HTMLからタグを除いて説明文を作る（meta description 用）
const stripTags = (html) => String(html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/* AI 翻訳が残すマークダウン記号を表示側でも落とす（2026-09-13）。
   CMS の stripMarkdownDecorations_（LP/cms.js）と同じ規則。ガード導入前に
   翻訳されたデータが残っており、EN の <title> に "# " が出ていた。
   本文には使わない（本文は HTML なのでそのまま出す）。 */
function stripTitleMarkdown(text) {
  let t = String(text == null ? '' : text).trim();
  t = t.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  t = t.replace(/^#{1,6}\s+/, '');
  for (const [re, delim] of [[/^\*\*([\s\S]+)\*\*$/, '**'], [/^\*([\s\S]+)\*$/, '*'], [/^__([\s\S]+)__$/, '__'], [/^_([\s\S]+)_$/, '_']]) {
    const m = t.match(re);
    if (m && !m[1].includes(delim)) { t = m[1].trim(); break; }
  }
  return t;
}

// パンくずJSON-LD（検索結果に「TECHNO JAPAN › FESTIVALS › 名前」のパスを出す）
function breadcrumbLd(sectionLabel, sectionPath, name, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TECHNO JAPAN', item: BASE + '/' },
      { '@type': 'ListItem', position: 2, name: sectionLabel, item: BASE + sectionPath },
      { '@type': 'ListItem', position: 3, name: String(name), item: canonical },
    ],
  };
}

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function jstToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

function latestEdition(editions = []) {
  return [...editions].sort((a, b) => String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')))[0] || null;
}

function isEndedFestival(editions = [], today = jstToday()) {
  const latest = latestEdition(editions);
  if (!latest || !ISO_DATE.test(String(latest.DATE_END || ''))) return false;
  const hasFutureEdition = editions.some((ed) => ISO_DATE.test(String(ed.DATE_START || '')) && String(ed.DATE_START) >= today);
  return String(latest.DATE_END) < today && !hasFutureEdition;
}

function truncateAtWord(value, max) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  if (max <= 1) return '…'.slice(0, max);
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, '').trim();
  return `${cut || text.slice(0, max - 1).trim()}…`;
}

function articleSeoTitle(title, festivalName = '', year = '') {
  const parts = splitArticleTitle(title);
  const short = parts.short;
  const sub = parts.sub;
  const suffix = ' | TECHNO JAPAN';
  const subRoom = 65 - suffix.length - short.length - 3; // short + " — " + sub
  if (sub && subRoom >= 12) {
    return `${short} — ${truncateAtWord(sub, subRoom)}${suffix}`;
  }
  if (festivalName && year) {
    const festivalTitle = `${short} ${year}: Lineup, Dates & Tickets${suffix}`;
    if (festivalTitle.length <= 65) return festivalTitle;
  }
  return `${truncateAtWord(short, 65 - suffix.length)}${suffix}`;
}

function japaneseArticleSeoTitle(title) {
  const short = String(title || '').split(/[｜|]/, 1)[0].trim();
  return truncate(`${short} — TECHNO JAPAN`, 60);
}

// primary は既存互換の値。言語別値が未入力なら primary、さらに反対言語へ
// フォールバックし、列追加直後でも表示を欠落させない。
function localizedValue(primary, ja, en, lang) {
  const values = {
    primary: String(primary || '').trim(),
    ja: String(ja || '').trim(),
    en: String(en || '').trim(),
  };
  return lang === 'en'
    ? (values.en || values.primary || values.ja)
    : (values.ja || values.primary || values.en);
}

// ブラウザ側の tjAuthorPresentation() と同じ判定・表示規則。
// 記事データの author 値と JSON-LD の組織名は変更せず、表示名だけを解決する。
function authorPresentation(authorName, lang) {
  const raw = String(authorName ?? '').trim();
  const isOrganization = !raw || /TECHNO JAPAN/i.test(raw);
  return {
    isOrganization,
    name: isOrganization ? (lang === 'en' ? 'TECHNO JAPAN Editorial' : 'TECHNO JAPAN 編集部') : raw,
  };
}

function isoDateTime(value) {
  const date = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+09:00` : date;
}

function loadImageDimensions() {
  if (!fs.existsSync(IMAGE_DIMENSIONS_PATH)) throw new Error('image-dimensions.json がありません。先に node scripts/build-image-dimensions.mjs を実行してください');
  return JSON.parse(fs.readFileSync(IMAGE_DIMENSIONS_PATH, 'utf8'));
}
let IMAGE_DIMENSIONS = {};
function dimensionAttrs(source) {
  const key = String(source || '').split(/[?#]/)[0].replace(/^\/+/, '');
  const size = IMAGE_DIMENSIONS[String(source || '').split(/[?#]/)[0]] || IMAGE_DIMENSIONS[key];
  return size ? `width="${size[0]}" height="${size[1]}"` : imageSizeAttrs(LP_DIR, source);
}
/* CMS の Image Position を style に落とす。

   写真は object-fit: cover（枠に合わせて切り抜く）で出すため、位置指定が
   無いと必ず中央基準で切れる。CMS の入力欄に「頭が切れるときは top を選ぶ」
   と書いてあるのは、まさにこれを避けるため。

   ⚠️ 2026-08-14 まで、この指定はフェスにしか効いていなかった。
   アーティストと会場の詳細ページが object-position を出しておらず、
   CMS で "center top" を入れても実際の描画は 50% 50% のままだった。
   WATA IGARASHI は原画 1440×1440 が 3:2 の枠に入るため縦の33%が切られ、
   上から17%（＝頭）が消えていた。AUDIT §9-83。

   同じ式を3箇所に書くと必ず片方だけ古くなるので、ここに1本化する。 */
function imagePositionStyle(item) {
  return ` style="object-position:${esc(String(item && item.imagePosition || 'center').trim() || 'center')}"`;
}
/* カード用の縮小版画像を使う。

   ハブ（festivals.html 等）は image-derivatives.js の対応表を JS で引いて
   カード画像を縮小版に差し替えているが、**詳細ページは静的生成なので
   その仕組みが効かない**。実測で festivals/ala.html が 0.48MB → 1.07MB に
   増えていたのは、下部の「関連フェス」カード4枚が原寸を読んでいたため
   （850KB / 4枚）。カードは 1枚あたり数百pxでしか表示しないので、
   960px 上限の縮小版で十分。AUDIT §9-51。

   対応表が無い画像（外部URL・記事画像など）は原本のままにする。 */
const DERIVATIVES_PATH = path.join(LP_DIR, 'image-derivatives.js');
function loadCardDerivatives() {
  if (!fs.existsSync(DERIVATIVES_PATH)) return {};
  const src = fs.readFileSync(DERIVATIVES_PATH, 'utf8');
  const m = src.match(/window\.TJ_IMAGE_DERIVATIVES\s*=\s*(\{[\s\S]*?\});/);
  if (!m) return {};
  try { return JSON.parse(m[1]); } catch { return {}; }
}
let CARD_DERIVATIVES = {};
/* 対応表は {src, srcset:[[path,幅],...]}。旧形式（文字列）も受ける。 */
function cardEntry(source) {
  const key = String(source || '').trim().replace(/^\/+/, '');
  const hit = CARD_DERIVATIVES[key];
  if (!hit) return null;
  return typeof hit === 'string' ? { src: hit, srcset: null } : hit;
}
function cardImagePath(source) {
  const hit = cardEntry(source);
  return hit && hit.src ? hit.src : String(source || '').trim().replace(/^\/+/, '');
}
/* 派生画像から srcset を組む。sizes は「その画像が実際に何px幅で出るか」。

   ⚠️ sizes は実測で決めること。憶測で書くとブラウザが小さすぎる／
   大きすぎる候補を選び、ボケるか無駄に重くなる。
   下の3つの数値はすべて headless Chrome の実測（2026-08-15）。 */
function srcsetAttr(source, sizes) {
  const hit = cardEntry(source);
  if (!hit || !hit.srcset || !hit.srcset.length) return '';
  const set = hit.srcset.map(([p, w]) => `/${p} ${w}w`).join(', ');
  return ` srcset="${esc(set)}" sizes="${esc(sizes)}"`;
}

function imageSourceWidth(source) {
  const key = String(source || '').split(/[?#]/)[0].replace(/^\/+/, '');
  const size = IMAGE_DIMENSIONS[String(source || '').split(/[?#]/)[0]] || IMAGE_DIMENSIONS[key];
  return size && Number(size[0]) > 0 ? Number(size[0]) : 0;
}

function coverSizes(source, boxAspect, sizes) {
  const key = String(source || '').split(/[?#]/)[0].replace(/^\/+/, '');
  const size = IMAGE_DIMENSIONS[String(source || '').split(/[?#]/)[0]] || IMAGE_DIMENSIONS[key];
  const imageAspect = size && Number(size[0]) > 0 && Number(size[1]) > 0
    ? Number(size[0]) / Number(size[1])
    : 1;
  const frameAspect = Number(boxAspect) > 0 ? Number(boxAspect) : 1;
  const scale = Math.max(1, imageAspect / frameAspect);
  if (scale <= 1.0001) return sizes;
  const parts = [];
  let start = 0;
  let depth = 0;
  const rawSizes = String(sizes || '');
  for (let index = 0; index < rawSizes.length; index += 1) {
    if (rawSizes[index] === '(') depth += 1;
    if (rawSizes[index] === ')') depth -= 1;
    if (rawSizes[index] === ',' && depth === 0) {
      parts.push(rawSizes.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(rawSizes.slice(start));
  return parts.map((part) => {
    const value = part.trim();
    const factor = Math.round(scale * 1000) / 1000;
    const calcIndex = value.lastIndexOf('calc(');
    if (calcIndex >= 0 && value.endsWith(')')) {
      const prefix = value.slice(0, calcIndex);
      const calc = value.slice(calcIndex);
      return `${prefix}calc((${calc.slice(5, -1)}) * ${factor})`;
    }
    const match = value.match(/(\d+(?:\.\d+)?(?:vw|vh|px|rem))\s*$/);
    if (!match) return value;
    const scaled = `calc(${match[1]} * ${factor})`;
    return value.slice(0, match.index) + scaled;
  }).join(', ');
}

function largeSrcsetAttr(source, sizes) {
  const hit = cardEntry(source);
  const candidates = (hit?.srcset || []).concat(hit?.heroSrcset || []);
  const sourceWidth = imageSourceWidth(source);
  const sourceKey = String(source || '').trim().replace(/^\/+/, '');
  if (sourceWidth && sourceKey && !/^https?:/i.test(sourceKey)) candidates.push([sourceKey, sourceWidth]);
  const unique = [...new Map(candidates.map(([pathName, width]) => [`${pathName}:${width}`, [pathName, width]])).values()]
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  if (!unique.length) return '';
  const set = unique.map(([pathName, width]) => `/${pathName} ${width}w`).join(', ');
  return ` srcset="${esc(set)}" sizes="${esc(sizes)}"`;
}
function bodySrcsetAttr(source, sizes) {
  const hit = cardEntry(source);
  if (!hit || !hit.bodySrcset || !hit.bodySrcset.length) return '';
  const set = hit.bodySrcset.map(([p, w]) => `/${p} ${w}w`).join(', ');
  return ` srcset="${esc(set)}" sizes="${esc(sizes)}"`;
}
/* 関連カードは実測 324px 幅で表示される。960px を全端末へ配らない。 */
const cardSrcsetAttr = (s) => srcsetAttr(s, '(max-width: 700px) 100vw, 360px');
/* 記事ページの関連フェスはPCで左の見出し列を除いた3等分になる。
   表示幅の2倍を取得できるよう、各ブレークポイントの実測幅を sizes に反映する。 */
const threeColumnCardSizes = '(max-width: 900px) 80vw, calc((min(100vw, 1360px) - 80px - 64px) / 3)';
const relatedFestivalSrcsetAttr = (s) => srcsetAttr(s, threeColumnCardSizes);
// 記事内アーティストカードの写真枠は detail.css の 132px / 96px と揃える。
const artistCardSrcsetAttr = (s) => srcsetAttr(s, '(max-width: 600px) 96px, 132px');
/* 関連記事のサムネは CSS で 120px（640px以下は 88px）に固定表示される。
   ここを cardSrcsetAttr（360px 想定）や原寸にすると、88px の枠に 1280〜1920px の
   画像を読み込むことになる。実測では記事1ページで 915KB の無駄が出ていた
   （2026-09-15）。sizes は detail.css の .related-story-thumb と揃えること。 */
const storyThumbSrcsetAttr = (s) => srcsetAttr(s, '(max-width: 640px) 88px, 120px');
function articleWideImagePath(source, imagePosition) {
  const wide = cardEntry(source)?.aspect?.wide;
  const position = articlePositionKey(imagePosition);
  return wide?.[position]?.path || wide?.center?.path || cardImagePath(source);
}
function articleFourThreeImagePath(source, imagePosition) {
  const fourThree = cardEntry(source)?.aspect?.fourThree;
  const position = articlePositionKey(imagePosition);
  return fourThree?.[position]?.path || fourThree?.center?.path || cardImagePath(source);
}
function articleWideSrcsetAttr(source, imagePosition, sizes) {
  const wide = cardEntry(source)?.aspect?.wide;
  const position = articlePositionKey(imagePosition);
  const entry = wide?.[position] || wide?.center;
  if (!entry) return largeSrcsetAttr(source, sizes);
  const hit = cardEntry(source);
  const candidates = [
    [entry.path, entry.w],
    ...(hit?.srcset || []),
    ...(hit?.heroSrcset || []),
  ];
  const sourceWidth = imageSourceWidth(source);
  const sourceKey = String(source || '').trim().replace(/^\/+/, '');
  if (sourceWidth && sourceKey && !/^https?:/i.test(sourceKey)) {
    candidates.push([sourceKey, sourceWidth]);
  }
  const unique = [...new Map(
    candidates.map(([pathName, width]) => [`${pathName}:${width}`, [pathName, width]]),
  ).values()]
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  const set = unique.map(([pathName, width]) => `/${pathName} ${width}w`).join(', ');
  return ` srcset="${esc(set)}" sizes="${esc(sizes)}"`;
}
function articleFourThreeSrcsetAttr(source, imagePosition, sizes) {
  const fourThree = cardEntry(source)?.aspect?.fourThree;
  const position = articlePositionKey(imagePosition);
  const entry = fourThree?.[position] || fourThree?.center;
  if (!entry) return articleWideSrcsetAttr(source, imagePosition, sizes);
  return ` srcset="/${esc(entry.path)} ${esc(String(entry.w))}w" sizes="${esc(sizes)}"`;
}
// 記事末尾の大判は 260px 幅。
const relatedStoryWideSrcsetAttr = (s) => srcsetAttr(s, '(max-width: 700px) 100vw, 260px');
const artistRelatedSizes = '(max-width: 900px) calc((100vw - 48px) / 2), calc((min(100vw, 1360px) - 80px - 80px) / 5)';
const artistStoryGridSizes = '(max-width: 900px) calc(100vw - 32px), calc((min(100vw, 1360px) - 80px - 64px) / 3)';

function splitArticleTitle(title) {
  const value = String(title || '');
  const delimiter = value.search(/[｜|]/);
  if (delimiter < 0) return { short: value, sub: '' };
  return {
    short: value.slice(0, delimiter).trim(),
    sub: value.slice(delimiter + 1).trim(),
  };
}

function articlePositionKey(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('top')) return 'top';
  if (v.includes('bottom')) return 'bottom';
  if (v.includes('left')) return 'left';
  if (v.includes('right')) return 'right';
  return 'center';
}

/* NewsArticle.image は同じ原画の水増しではなく、実際の切り出し画像を出す。
   imagePosition は crop 生成時の center/top/bottom 等と同じキーへ変換する。 */
function articleImageVariants(source, imagePosition) {
  const entry = cardEntry(source);
  const aspect = entry?.aspect;
  if (!aspect) return [absUrl(source)];
  const position = articlePositionKey(imagePosition);
  const variants = ['wide', 'square', 'fourThree']
    .map((name) => aspect[name]?.[position]?.path || aspect[name]?.center?.path)
    .filter(Boolean);
  return variants.length === 3 ? variants.map((p) => absUrl(p)) : [absUrl(source)];
}

/* hero（詳細ページの一番大きい画像）。実測 モバイル480px / PC 696px。

   ⚠️ 2026-08-15 まで hero だけ srcset が無く、原寸をそのまま配っていた。
   関連カードには srcset が付いていたのに、**一番重い画像だけ**素通し。

     フェス詳細  原画 1920px(407KB) → モバイル表示 480px
     記事        原画 1920px        → モバイル表示 496px

   LCP（最初に大きな絵が出るまでの時間）に直接効く。 */
const heroSrcsetAttr = (s, sizes = '100vw', _articleHero = false) => largeSrcsetAttr(s, sizes);

/* 記事ヒーローはモバイルで min(80vh, 640px) の縦長枠に cover する。
   横長写真をそのまま 100vw で読むと、表示に必要な横幅を満たさず粗くなるため、
   dimensionAttrs と同じ原画寸法から cover の拡大率を sizes に反映する。 */
function coverHeroSizes(source, frameAspect) {
  const key = String(source || '').split(/[?#]/)[0].replace(/^\/+/, '');
  const size = IMAGE_DIMENSIONS[String(source || '').split(/[?#]/)[0]] || IMAGE_DIMENSIONS[key];
  if (!size || !size[0] || !size[1]) return '100vw';
  const scale = Math.max(1, (size[0] / size[1]) / frameAspect);
  const factor = Math.round(scale * 1000) / 1000;
  return `(max-width: 900px) calc(100vw * ${factor}), 100vw`;
}

function articleHeroSizes(source) {
  return coverHeroSizes(source, 0.6);
}

function festivalHeroSizes(source) {
  return coverHeroSizes(source, 0.7);
}

/* 開催回のフライヤー。実測 モバイル488px / タブレット582px / PC 511px。

   ⚠️ hero を直した直後の計測で、**フライヤーが 624KB で最大の重量**だと
   分かった（フェス詳細のモバイル総量1,080KBのうち624KB）。
   派生は50件すべて生成済みだったのに、出力側で使っていなかった。
   「一番大きい画像」を直したら次に大きいものが顔を出す。 */
const flyerSrcsetAttr = (s) => largeSrcsetAttr(s, '(max-width: 700px) calc(100vw - 32px), 520px');

/* 開催回ごとのフライヤーを優先して選ぶ。

   フライヤーは年ごとに違うのに、詳細ページは長らく FESTIVALS.FLYER
   （フェス共通の1枚）だけを出していた。EDITIONS.FLYER は CMS に
   アップロード欄まであって保存もされていたのに、**どこにも表示されず
   26件が死蔵されていた**（2026-08-07 調査 / AUDIT §9-48）。

   ただし、そのうち15件は拡張子が .jpg のままで実ファイルが無い
   （サイトが配信するのは webp のみ）。そのまま出すと画像が割れるので、
   実在するものだけを採用し、無ければフェス共通のものへ落とす。
   捨てずに warn を出して、直すべき行が見えるようにする。 */
const missingEditionFlyers = new Set();
const rewrittenEditionFlyers = new Set();

function localImageExists(source) {
  const s = String(source || '').trim();
  if (!s) return false;
  if (/^https?:/i.test(s)) return true;          // 外部URLは取得可否を見ない
  return fs.existsSync(path.join(LP_DIR, s.replace(/^\/+/, '')));
}

/* シートに記録された拡張子が古いことがある。

   CMS の「Image from URL」が原本(jpg/png/heic)を Drive に置き、
   sync-drive-images.yml が **同じ名前の .webp に変換して**取り込む。
   このときシートの FLYER は原本の名前のまま残るため、
   `arch-flyer.jpg` と書いてあるのに実体は `arch-flyer.webp`、
   という行ができる。EDITIONS.FLYER の26件中15件がこれだった。

   サイトが配信するのは webp だけなので（AGENTS.md「ビルド運用の注意」）、
   同名の .webp が在るならそれが実体。推測ではなく変換規則そのもの。 */
function resolveImagePath(source) {
  const s = String(source || '').trim();
  if (!s || /^https?:/i.test(s)) return s;
  if (localImageExists(s)) return s;
  const asWebp = s.replace(/\.(jpe?g|png|heic|heif)$/i, '.webp');
  return asWebp !== s && localImageExists(asWebp) ? asWebp : '';
}

/* 開催回ごとのフライヤーを優先する。無ければフェス共通のものへ落とす。 */
function pickFlyer(festival, edition) {
  const editionFlyer = String(edition?.FLYER || '').trim();
  if (editionFlyer) {
    const resolved = resolveImagePath(editionFlyer);
    if (resolved) {
      if (resolved !== editionFlyer) {
        rewrittenEditionFlyers.add(`${edition?.EDITION_ID || '?'}: ${editionFlyer} → ${resolved}`);
      }
      return { src: resolved, edition: edition?.EDITION || '' };
    }
    missingEditionFlyers.add(`${edition?.EDITION_ID || '?'}: ${editionFlyer}`);
  }
  return { src: String(festival?.flyer || '').trim(), edition: '' };
}

/* 記事本文の Google Drive 画像を、端末に合った大きさで配る。

   ■ なぜ必要か（AUDIT §9-91）

   本文の画像は CMS から Drive のURLで入っており、末尾が `=w2000` だった。
   実測（2026-08-15）:

     表示幅   スマホ 484px / PC 468〜1332px
     配信     2000px = 1枚 628KB
     記事1本に8枚 → 約3MB

   Drive は URL 末尾の `=w数字` でその場で縮小した画像を返す。
   **同じIDから複数サイズを出せるので srcset が組める。**

     =w2000  628KB  1920x2485
     =w1200  227KB  1200x1553
     =w800    99KB   800x1035
     =w480    39KB   480x621

   ■ src は変えない

   src を変えると IMAGE_DIMENSIONS の引き当てキーが変わって
   addHtmlImageDimensions が落ちる。また width/height が実物と
   食い違いになる。**srcset を足すだけ**にすれば、
   srcset を解釈する現代のブラウザは小さい方を選び、
   解釈しない環境は従来どおり src を読む。どちらも壊れない。

   ■ この見落としが起きた理由

   前夜の計測で「記事 501KB → 209KB」と報告したが、
   **自サイトへの通信しか数えておらず、Drive の画像は素通りしていた。**
   実際の記事ページはモバイルで約3.2MBだった。
   「実測した」と言うとき、利用者が実際に受け取るもの全部を
   数えているかを確かめること。 */
const DRIVE_IMG = /(<img\b[^>]*\bsrc=(["']))(https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_-]+)=w(\d+)(\2[^>]*>)/gi;
/* 候補の幅。⚠️ 実測で決めること。

   1600 を足して測ったら、実機相当（390px / dpr3）が
   1,836KB → 2,646KB と **44%重くなった**（2026-08-15 実測）。
   得られるのは PC の全幅画像を Retina で見たときの精細さだけで、
   モバイル優先の方針に見合わない。**足さずに戻した。**

   なお Drive は原本より大きくは返さない。原本1100pxの画像は
   =w1200 も =w2000 も同じ 1100px・208KB が返る。
   「w2000 だから1920px」とは限らない。 */
const DRIVE_WIDTHS = [480, 800, 1200];
/* Drive に WebP で返させる接尾辞。

   2026-09-29 実測（記事 synapse-2026-info の本文画像 1枚・1200x800）:
     =w1200        357KB  image/jpeg
     =w1200-rw     242KB  image/webp   −32%・画素は同じ 1200x800
     =w1200-rw-v1  175KB  image/webp   −51% だが PSNR 31.8dB で劣化が見える → 使わない

   ⚠️ -rw は Accept に image/webp が無いクライアントにも WebP を返す（実測）。
   ただしこのサイトは自前画像を全て .webp で配っており、既に WebP 必須。
   したがって新たな互換性リスクは無い。

   JPEG と WebP の差は PSNR 34.3dB。同じ原本を別方式で圧縮した差であり、
   この容量帯では WebP の方が実質的に有利。 */
const DRIVE_WEBP = '-rw';
function addDriveImageSrcset(html) {
  return String(html || '').replace(DRIVE_IMG, (tag, head, _q, base, w, tail) => {
    if (/\bsrcset=/i.test(tag)) return tag;           // 既にあるものは触らない
    const set = DRIVE_WIDTHS.map((n) => `${base}=w${n}${DRIVE_WEBP} ${n}w`).join(', ');
    /* sizes は実測値。本文画像はスマホ484px / PC は 503px〜1332px（fx-full が全幅）。
       PC は article-fx.css で figure.fx-full が min(100vw, 1200px)。
       視差の拡大込みで実測1332px。ここを実際より小さく書くと
       ブラウザは正直に小さい画像を選び、ぼやける。 */
    const attrs = ` srcset="${esc(set)}" sizes="(max-width: 700px) 100vw, 1200px"`;
    const lazy = /\bloading=/i.test(tag) ? '' : ' loading="lazy" decoding="async"';
    return `${head}${base}=w${w}${DRIVE_WEBP}${tail.slice(0, 1)}${attrs}${lazy}${tail.slice(1)}`;
  });
}

/* 本文の自サイト画像に srcset を付ける（2026-09-15）。
   Drive 直リンクからの移行で、本文画像が /images/articles/… を指すようになった。
   addDriveImageSrcset は Drive URL 専用なので、こちらで派生画像を割り当てる。
   sizes は addDriveImageSrcset と同じ実測値（本文はスマホ全幅 / PC は最大1200px）。
   派生が無い画像（登録前・外部URL）はそのまま返す。 */
const LOCAL_ARTICLE_IMG = /(<img\b[^>]*\bsrc=(["']))(\/?images\/[^"']+)(\2[^>]*>)/gi;
function addLocalImageSrcset(html) {
  return String(html || '').replace(LOCAL_ARTICLE_IMG, (tag, head, _q, source, tail) => {
    if (/\bsrcset=/i.test(tag)) return tag;           // 既にあるものは触らない
    // 本文用派生が無い既存の自サイト画像は、従来のカード用派生へフォールバックする。
    const attrs = bodySrcsetAttr(source, '(max-width: 700px) 100vw, 1200px')
      || srcsetAttr(source, '(max-width: 700px) 100vw, 1200px');
    if (!attrs) return tag;                           // 派生が無いものはそのまま
    const lazy = /\bloading=/i.test(tag) ? '' : ' loading="lazy" decoding="async"';
    return `${head}${source}${tail.slice(0, 1)}${attrs}${lazy}${tail.slice(1)}`;
  });
}

function addHtmlImageDimensions(html) {
  return String(html || '').replace(/<img\b(?![^>]*\bwidth=)([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (tag, before, quote, src, after) => {
    const attrs = dimensionAttrs(src);
    if (!attrs) throw new Error(`画像寸法メタデータがありません: ${src}`);
    return `<img ${attrs}${before}src=${quote}${src}${quote}${after}>`;
  });
}

/* 記事本文の見出しだけに、ブラウザを問わず使える文節の折り返し位置を埋め込む。 */
function addHeadingPhraseBreaks(html) {
  return String(html || '').replace(/<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (block, level, attrs, contents) => {
    const processText = /<[^>]+>/.test(contents) ? phraseBreaks : clauseBreaks;
    const processed = contents.replace(/(^|>)([^<]+)(?=<|$)/g, (_text, prefix, text) => `${prefix}${processText(text)}`);
    return `<h${level}${attrs}>${processed}</h${level}>`;
  });
}

/* ---------- 回遊導線（ページ間の相互リンク）。main() が索引をセットする ---------- */
let XLINK = { fests: [], venues: [], appearMap: new Map() };

/* EN ハブの静的リンク一覧。main() が { page: { marker, html } } をセットし、
   enHubFromJa がラベルを差し替える。JA から機械生成する経路では URL しか
   書き換わらず、ラベルは JA のまま残っていた。 */
let EN_HUB_LINKS = {};
function relatedChips(items, dir, lang) {
  const prefix = lang === 'en' ? '/en' : '';
  return `<div class="lineup-list">` + items.map((x) =>
    `<a class="lineup-item" href="${prefix}/${dir}/${x.id}.html">${esc(lang === 'en' ? (x.name_en || x.name) : x.name)}</a>`
  ).join('') + `</div>`;
}

const absUrl = (img) => {
  if (!img) return DEFAULT_OG;
  return String(img).startsWith('http') ? String(img) : `${BASE}/${String(img).replace(/^\//, '')}`;
};


// CMS で指定した表示比率を data 属性 + inline style にする。未指定なら何も出さず既定のCSSが効く。
function ratioAttr(r) {
  const v = String(r || '').trim();
  if (!v) return '';
  if (v === 'auto') return ' data-ratio="auto"';
  if (!/^\d+:\d+$/.test(v)) return '';
  return ` data-ratio="${v}" style="aspect-ratio:${v.replace(':', '/')}"`;
}
// 説明文トグルを持つページ（festival/venue/artist）に読み込むスクリプト。
// .bilingual が無いページでは no-op なので副作用なし。
const LANG_TOGGLE_SCRIPT = `\n<script src="/lang-toggle.js?v=${LANG_TOGGLE_VERSION}" defer></script>`;
const FESTIVAL_HUB_BACK_SCRIPT = `
<script>
function bindFestivalHubBackLinks() {
  document.querySelectorAll('[data-festival-hub-back]').forEach((link) => {
    link.addEventListener('click', (event) => {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin && referrer.pathname === link.dataset.festivalHubBack) {
          event.preventDefault();
          history.back();
        }
      } catch (_) {}
    });
  });
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFestivalHubBackLinks, { once: true });
} else {
  bindFestivalHubBackLinks();
}
</script>`;
const ARTIST_HUB_BACK_SCRIPT = FESTIVAL_HUB_BACK_SCRIPT
  .replaceAll('Festival', 'Artist')
  .replaceAll('festival', 'artist');
const VENUE_HUB_BACK_SCRIPT = FESTIVAL_HUB_BACK_SCRIPT
  .replaceAll('Festival', 'Venue')
  .replaceAll('festival', 'venue');
const ARTICLE_HUB_BACK_SCRIPT = FESTIVAL_HUB_BACK_SCRIPT
  .replaceAll('Festival', 'Article')
  .replaceAll('festival', 'article');
// 説明文（desc/bio）をバイリンガル表示する。ja=日本語スロット, en=英語スロット。
// 両方あるときだけ言語トグルを出し、pageLang をデフォルト表示にする（SEO: 既定言語を
// 可視・もう一方は lang 属性付きで hidden → 言語シグナルを濁さない）。片方だけなら従来通り。
function bilingualBody(ja, en, pageLang, extraClass = '') {
  const jaT = String(ja || '').trim();
  const enT = String(en || '').trim();
  if (jaT && enT) {
    const hid = (l) => (l === pageLang ? '' : ' hidden');   // 既定言語以外は hidden 属性で隠す
    const act = (l) => (l === pageLang ? ' is-active' : '');
    return `<div class="detail-body bilingual${extraClass ? ` ${extraClass}` : ''}">
      <div class="lang-toggle" role="group" aria-label="${pageLang === 'en' ? 'Description language' : '説明文の言語'}">
        <button type="button" class="lang-btn${act('ja')}" data-lang="ja" aria-label="日本語" aria-pressed="${pageLang === 'ja' ? 'true' : 'false'}">JA</button>
        <button type="button" class="lang-btn${act('en')}" data-lang="en" aria-label="English" aria-pressed="${pageLang === 'en' ? 'true' : 'false'}">EN</button>
      </div>
      <div class="lang-body" data-lang="ja" lang="ja"${hid('ja')}><p>${esc(jaT)}</p></div>
      <div class="lang-body" data-lang="en" lang="en"${hid('en')}><p>${esc(enT)}</p></div>
    </div>`;
  }
  const only = jaT || enT;
  if (!only) return '';
  return `<div class="detail-body${extraClass ? ` ${extraClass}` : ''}"><p lang="${jaT ? 'ja' : 'en'}">${esc(only)}</p></div>`;
}
// 本文中の [[festival:id]] / [[artist:id]] / [[venue:id]] を詳細ページへのリンクに変換
function buildEventFestivalData({ festivals = [], editionsByFestival = new Map(), lineupsByEdition = new Map(), artists = [] }) {
  const artistsById = new Map(artists.map((artist) => [String(artist.id), artist]));
  return Object.fromEntries(festivals.map((f) => {
    const editions = [...(editionsByFestival.get(String(f.id)) || [])].sort((a, b) => {
      const ap = editionKeyParts(editionIdentifier(a)), bp = editionKeyParts(editionIdentifier(b));
      return bp.year - ap.year || bp.seq - ap.seq;
    });
    const latest = editions[0];
    const lineup = latest
      ? (lineupsByEdition.get(String(latest.EDITION_ID)) || []).map((row) => {
          const ids = lineupArtistIds(row);
          if (ids.length === 1 && artistsById.has(ids[0])) return artistsById.get(ids[0]).name || ids[0];
          return row.ACT_LABEL || ids[0] || '';
        }).filter(Boolean)
      : [];
    const img = f.image || f.flyer;
    return [String(f.id), {
      ...(img ? { imageHtml: `<img ${dimensionAttrs(cardImagePath(img))} src="/${cardImagePath(img)}"${cardSrcsetAttr(img)} alt="${esc(f.name)}" loading="lazy" decoding="async">` } : {}),
      ...(lineup.length ? { lineup } : {}),
    }];
  }).filter(([, value]) => value.imageHtml || value.lineup));
}

function buildArtistCardData(artists = []) {
  return Object.fromEntries(artists.map((a) => {
    const image = a.image;
    return [String(a.id), {
      name: a.name,
      genre: a.genre,
      place: [a.city, a.country].filter(Boolean).join(', '),
      bio: a.bio,
      bioEn: a.bio_en,
      links: a.links || {},
      ...(image ? { imageHtml: `<img ${dimensionAttrs(cardImagePath(image))} src="/${cardImagePath(image)}"${artistCardSrcsetAttr(image)} alt="${esc(a.name)}" loading="lazy" decoding="async"${imagePositionStyle(a)}>` } : {}),
    }];
  }).filter(([id]) => id));
}

function makeEntityResolver(data, festivalData = null, artistData = null) {
  const table = { festival: data.FESTIVALS || [], artist: data.ARTISTS || [], venue: data.VENUES || [], article: data.ARTICLES || [] };
  const festivalIds = new Set(table.festival.map((x) => String(x.id || '').trim()).filter(Boolean));
  return (html, lang = 'en') => {
    const entityHtml = String(html || '').replace(/\[\[(festival|artist|venue|article):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, type, id, label) => {
    const rec = (table[type] || []).find((x) => x.id === id);
    const name = label || (rec && (rec.name || rec.title)) || id;
    const dir = type === 'article' ? 'articles' : type + 's';
    return `<a class="entity-link" href="/${dir}/${id}.html">${esc(name)}</a>`;
    });
    return renderArticleShortcodes(entityHtml, { lang, festivalIds, festivalData, artistData }).html;
  };
}

// 公開記事本文の entity shortcode は、生成前に参照先を検証する。
// 未知のIDをそのままリンク化すると、見た目は正常でも404リンクが公開されるため、
// draft以外の記事だけを対象にビルドを停止する（draftは未完成本文を保存できる）。
function validateArticleShortcodes(data) {
  const table = {
    festival: new Set((data.FESTIVALS || []).map((x) => String(x.id || '').trim()).filter(Boolean)),
    artist: new Set((data.ARTISTS || []).map((x) => String(x.id || '').trim()).filter(Boolean)),
    venue: new Set((data.VENUES || []).map((x) => String(x.id || '').trim()).filter(Boolean)),
    article: new Set((data.ARTICLES || []).map((x) => String(x.id || '').trim()).filter(Boolean)),
  };
  const re = /\[\[(festival|artist|venue|article):([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  const artistCardRe = /\[\[artist-card:([a-z0-9-]+)(?:\|([^\]]*))?\]\]/g;
  const errors = [];
  for (const article of (data.ARTICLES || [])) {
    if (String(article.status || '').toLowerCase() === 'draft') continue;
    for (const [lang, body] of [['ja', article.body], ['en', article.body_en]]) {
      const text = String(body || '');
      let match;
      while ((match = re.exec(text)) !== null) {
        if (!table[match[1]].has(match[2])) {
          errors.push(`${article.id || '(no-id)'}[${lang}]: ${match[1]}:${match[2]}`);
        }
      }
      re.lastIndex = 0;
      while ((match = artistCardRe.exec(text)) !== null) {
        if (!table.artist.has(match[1])) errors.push(`${article.id || '(no-id)'}[${lang}]: artist-card:${match[1]}`);
      }
      artistCardRe.lastIndex = 0;
      try {
        renderArticleShortcodes(text, { lang, festivalIds: table.festival });
      } catch (error) {
        errors.push(`${article.id || '(no-id)'}[${lang}]: ${error.message}`);
      }
    }
  }
  if (errors.length) {
    throw new Error(`記事本文の shortcode 参照切れ（${errors.length}件）:\n  - ${errors.join('\n  - ')}`);
  }
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function fmtDate(d) {
  return fmtDateDots(d);
}
function fmtMetaDateJa(start, end) {
  if (!ISO_DATE.test(String(start || ''))) return '';
  const [sy, sm, sd] = String(start).split('-').map(Number);
  if (!ISO_DATE.test(String(end || '')) || end === start) return `${sy}年${sm}月${sd}日`;
  const [ey, em, ed] = String(end).split('-').map(Number);
  if (sy === ey && sm === em) return `${sy}年${sm}月${sd}日〜${ed}日`;
  if (sy === ey) return `${sy}年${sm}月${sd}日〜${em}月${ed}日`;
  return `${sy}年${sm}月${sd}日〜${ey}年${em}月${ed}日`;
}
function fmtMetaDateEn(start, end) {
  if (!ISO_DATE.test(String(start || ''))) return '';
  const month = (value) => MONTHS[Number(String(value).split('-')[1]) - 1]
    .toLowerCase().replace(/^./, (char) => char.toUpperCase());
  const [sy, sm, sd] = String(start).split('-').map(Number);
  if (!ISO_DATE.test(String(end || '')) || end === start) return `${month(start)} ${sd}, ${sy}`;
  const [ey, em, ed] = String(end).split('-').map(Number);
  if (sy === ey && sm === em) return `${month(start)} ${sd}–${ed}, ${sy}`;
  if (sy === ey) return `${month(start)} ${sd}–${month(end)} ${ed}, ${sy}`;
  return `${month(start)} ${sd}, ${sy}–${month(end)} ${ed}, ${ey}`;
}
function fmtDateDots(d) {
  const match = String(d || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
}
function fmtFestDate(d) {
  if (!d) return 'DATE TBA';
  const s = String(d);
  if (s.includes('/')) {
    const [start, end] = s.split('/');
    const [sy, sm, sd] = start.split('-').map(Number);
    const ed = end.split('-').map(Number)[2];
    if (!sy || !sm || !sd) return 'DATE TBA';
    return `${MONTHS[sm - 1]} ${sd} — ${ed}, ${sy}`;
  }
  return fmtDate(s) || 'DATE TBA';
}

/* ---------- 共通のページ骨格 ---------- */
// 使わない強力な機能を明示的に閉じる。サードパーティのスクリプトが混入しても
// 位置情報やカメラを勝手に要求できない。interest-cohort は FLoC の無効化。
/* ファビコン。Google 検索結果とブラウザのタブに出る小さいアイコン。

   2026-08-07 まで**サイト全体で1つも宣言が無く**、`/favicon.ico` も404だった。
   PWA の manifest.json には icons があるが、Google はあれを検索結果に使わない。
   その結果、検索結果には既定の地球アイコンが出ていた。

   Google の条件: 正方形で48pxの倍数、サイト全体で同一、robots で拒否しない。
   `/favicon.ico` は宣言が無くても取りに来るので、実体を置いたうえで明示もする。
   反映には Google の再クロールが要るので、置いてすぐには変わらない。

   画像はロゴのマーク部分だけを切り出したもの（`TECHNO JAPAN` の文字は
   16pxでは必ず潰れ、その分マークが小さくなるので入れていない）。 */
const FAVICON_TAGS = [
  '<link rel="icon" href="/favicon.ico?v=2" sizes="32x32">',
  '<link rel="icon" type="image/png" href="/images/favicon-192.png?v=2" sizes="192x192">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2">',
].join('\n');

const PERMISSIONS_POLICY = 'geolocation=(), microphone=(), camera=(), interest-cohort=()';

const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net; frame-src 'self' https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com; form-action 'self' https://formsubmit.co https://buttondown.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`;
const APPLY_CSP = CSP.replace("connect-src 'self'", "connect-src 'self' https://docs.google.com");

const FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
<link rel="preload" as="font" type="font/woff2" href="/fonts/dm-sans-v17-latin.woff2" crossorigin>
<link rel="preload" as="font" type="font/woff2" href="/fonts/bebas-neue-v16-latin.woff2" crossorigin>
<style>
@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/bebas-neue-v16-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Bebas Neue';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/bebas-neue-v16-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:200 500;font-display:swap;src:url('/fonts/dm-sans-v17-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'DM Sans';font-style:normal;font-weight:200 500;font-display:swap;src:url('/fonts/dm-sans-v17-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Space Mono';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/space-mono-v17-latin-ext.woff2') format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}
@font-face{font-family:'Space Mono';font-style:normal;font-weight:400;font-display:swap;src:url('/fonts/space-mono-v17-latin.woff2') format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
</style>`;

/* 詳細ページの nav。EN ページでは EN 版が実在するリンク先だけ /en/ へ向ける。
   EN_PAGES に無いもの（index.html）は JA のままにして 404 を作らない。
   これを入れる前は EN 詳細206枚の nav が全て JA を指しており、
   英語ユーザーはどこを押しても日本語ページに出てしまっていた。 */
function navLink(lang, page) {
  return (lang === 'en' && EN_PAGES.has(page)) ? `/en/${page}` : `/${page}`;
}

function menuOverlayHtml(lang, currentKey = '', altHref = null) {
  const en = lang === 'en';
  const prefix = en ? '/en' : '';
  const labels = en
    ? [['top', 'Top', '', 'index.html'], ['news', 'News', 'Stories', 'news.html'], ['festivals', 'Festivals', 'Index', 'festivals.html'], ['artists', 'Artists', 'Database', 'artists.html'], ['venues', 'Venues', 'Clubs & sites', 'venues.html'], ['about', 'About', '', 'about.html']]
    : [['top', 'Top', 'トップ', 'index.html'], ['news', 'News', 'ニュース・記事', 'news.html'], ['festivals', 'Festivals', 'フェス一覧', 'festivals.html'], ['artists', 'Artists', 'アーティスト', 'artists.html'], ['venues', 'Venues', 'クラブ・会場', 'venues.html'], ['about', 'About', 'テクノジャパンについて', 'about.html']];
  const href = (file) => `${prefix}/${file}`;
  const items = labels.map(([key, label, note, file], i) => `    <a href="${href(file)}" class="nav-ov-item" style="animation-delay:${(0.06 + i * 0.06).toFixed(2)}s"${key === currentKey ? ' aria-current="page"' : ''}><span class="nav-ov-num">${String(i + 1).padStart(2, '0')}</span><span class="nav-ov-label">${label}</span><span class="nav-ov-note">${note}</span></a>`).join('\n');
  const language = altHref
    ? (en
      ? `<a href="${altHref}" class="nav-ov-lang">JA</a><span class="nav-ov-lang-current" aria-current="true">EN</span>`
      : `<span class="nav-ov-lang-current" aria-current="true">JA</span><a href="${altHref}" class="nav-ov-lang">EN</a>`)
    : '';
  return `<div class="nav-overlay" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="nav-ov-top"><a href="${href('index.html')}" class="nav-ov-logo" aria-label="TECHNO JAPAN"><img src="/images/logo-wordmark.png?v=1" alt="TECHNO JAPAN" width="158" height="13"></a><button class="nav-close" type="button" aria-label="${en ? 'Close menu' : 'メニューを閉じる'}"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3l12 12M15 3L3 15"/></svg></button></div>
  <button class="nav-search-link" type="button"><svg class="nav-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg><span>${en ? 'Festival, artist, venue, city…' : 'フェス、アーティスト、会場、都市…'}</span></button>
  <nav class="nav-ov-main" aria-label="Main">
${items}
  </nav>
  <div class="nav-ov-foot">
    <div class="nav-ov-sub"><a href="${prefix}/submit.html">${en ? 'Apply' : '掲載申請'}</a><a href="${prefix}/writers.html">${en ? 'Writer' : 'ライター募集'}</a><a href="${en ? '/en/favorites.html' : '/favorites.html'}">Favorites</a></div>
    <div class="nav-ov-row">${altHref ? `<div class="nav-lang" role="group" aria-label="Language">${language}</div>` : ''}<div class="nav-ov-social"><a href="https://www.instagram.com/techno.japan_/" target="_blank" rel="noopener">Instagram</a><a href="https://www.threads.net/@techno.japan_" target="_blank" rel="noopener">Threads</a></div></div>
    <span class="nav-ov-tag">${en ? "Japan's Underground, Curated." : '日本のアンダーグラウンドを、キュレーションする。'}</span>
  </div>
</div>`;
}

function navHtml(lang, altHref, currentKey = '') {
  // 言語トグル: 対になるページがある時だけ JA / EN を出す
  const toggle = altHref
    ? (lang === 'ja'
        ? `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="${altHref}">EN</a></span>`
        : `<span class="nav-lang"><a href="${altHref}">JA</a><span class="nav-lang-sep">/</span><span class="nav-lang-cur">EN</span></span>`)
    : '';
  return `<nav>
  <a href="/index.html" class="logo"><img src="/images/logo-wordmark.png?v=1" alt="TECHNO JAPAN" width="158" height="13" decoding="async"></a>
  <div class="nav-links">
    <a href="${navLink(lang, 'index.html')}">TOP</a>
    <a href="${navLink(lang, 'news.html')}">NEWS</a>
    <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
    <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
    <a href="${navLink(lang, 'venues.html')}">VENUES</a>
    <a href="${navLink(lang, 'about.html')}">ABOUT</a>
    <button class="gs-trigger" type="button" aria-label="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span>SEARCH</span></button>
    ${toggle}
  </div>
  <button class="nav-hamburger" aria-label="Open menu"><span></span><span></span><span></span></button>
</nav>
${menuOverlayHtml(lang, currentKey, altHref)}`;
}

function footerHtml(lang) {
  const submissionHref = lang === 'en' ? '/en/submit.html' : '/submit.html';
  const submissionLabel = 'APPLY';
  const favoritesHref = lang === 'en' ? '/en/favorites.html' : '/favorites.html';
  return `<!-- tj:footer:start -->
<footer>
  <div class="footer-top">
    <div class="footer-logo"><img src="/images/logo-wordmark.png?v=1" alt="TECHNO JAPAN" width="158" height="13" loading="lazy" decoding="async"></div>
    <div class="footer-links">
      <a href="${navLink(lang, 'news.html')}">NEWS</a>
      <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
      <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
      <a href="${navLink(lang, 'venues.html')}">VENUES</a>
      <a href="${navLink(lang, 'about.html')}">ABOUT</a>
      <a href="${submissionHref}">${submissionLabel}</a>
      <a href="${lang === 'en' ? '/en/writers.html' : '/writers.html'}">WRITER</a>
      <a href="${favoritesHref}">FAVORITES</a>
    </div>
    <span class="footer-social"><a href="https://www.instagram.com/techno.japan_/" target="_blank" rel="noopener">INSTAGRAM</a><a href="https://www.threads.net/@techno.japan_" target="_blank" rel="noopener">THREADS</a></span>
  </div>
  <div class="footer-copy"><span>&copy; 2026 Techno Japan</span><span>Japan's Underground, Curated.</span></div>
</footer>
<!-- tj:footer:end -->`;
}

/* 手書きページも、生成詳細ページと同じ枠を使う。タグの対応する閉じタグを
   数えて範囲を求めるため、閉じタグの並びを境界にしない（AUDIT §9-16）。 */
function replaceElement(html, tag, startAt, replacement) {
  const open = new RegExp(`<${tag}\\b[^>]*>`, 'i');
  const close = new RegExp(`</${tag}>`, 'ig');
  const startMatch = open.exec(html.slice(startAt));
  if (!startMatch) return html;
  const start = startAt + startMatch.index;
  const bodyStart = start + startMatch[0].length;
  const token = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'ig');
  token.lastIndex = bodyStart;
  let depth = 1;
  let match;
  while ((match = token.exec(html))) {
    if (match[0][1] === '/') depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(0, start) + replacement + html.slice(token.lastIndex);
  }
  throw new Error(`${tag} の対応する閉じタグが見つかりません`);
}

function normalizeStaticChrome(fileName, lang) {
  const file = path.join(LP_DIR, fileName);
  if (!fs.existsSync(file)) throw new Error(`${fileName}: 静的ページがありません`);
  const before = fs.readFileSync(file, 'utf8');
  const currentKey = ({ 'index.html': 'top', 'news.html': 'news', 'festivals.html': 'festivals', 'artists.html': 'artists', 'venues.html': 'venues', 'about.html': 'about', 'favorites.html': 'favorites' })[path.basename(fileName)] || '';
  const is404 = path.basename(fileName) === '404.html';
  const altHref = is404
    ? (lang === 'en' ? '/index.html' : '/en/index.html')
    : (lang === 'en' ? `/${path.basename(fileName)}` : `/en/${path.basename(fileName)}`);
  let next = before;
  // 旧版が複数の overlay を持つ場合も、生成した1個だけを残す。
  let oldOverlay;
  while ((oldOverlay = next.search(/<div\b[^>]*class="nav-overlay"/i)) >= 0) {
    next = replaceElement(next, 'div', oldOverlay, '');
  }
  // 既存の手書き／前回の中間版が複数あっても、先に全 nav を除去して1個だけ挿入する。
  const firstNav = next.search(/<nav\b/i);
  if (firstNav < 0) throw new Error(`${fileName}: nav がありません`);
  const navPrefix = next.slice(0, firstNav);
  let navRest = next.slice(firstNav);
  while (/<nav\b/i.test(navRest)) navRest = replaceElement(navRest, 'nav', 0, '');
  next = navPrefix + navHtml(lang, altHref, currentKey) + navRest;
  // 目印だけを消すと、その行の改行が残って毎ビルド空行が増える。
  // 既存の累積分も含め、目印は行ごと除去して枠の前後を1改行に戻す。
  next = next.replace(/[ \t]*<!-- tj:footer:(?:start|end) -->[ \t]*(?:\r?\n|$)/g, '');
  next = next.replace(/(?:\r?\n[ \t]*){2,}(?=<footer\b)/g, '\n');
  const footer = footerHtml(lang);
  const footerStart = next.indexOf('<footer');
  next = footerStart < 0
    ? next.replace(/<\/body>/i, `${footer}\n</body>`)
    : replaceElement(next, 'footer', footerStart, footer);
  next = next.replace(/(<\/footer>)(?:\r?\n[ \t]*){2,}(?=<script\b)/g, '$1\n');
  next = next.replace(/href="(?:\.\/|\/)?common\.css\?v=\d+"/g, `href="/common.css?v=${COMMON_CSS_VERSION}"`)
    .replace(/(?:src|href)="(?:\.\/)?common\.js\?v=\d+"/g, (m) => m.replace(/"[^"/]*common\.js/, `"/common.js`).replace(/\?v=\d+/, `?v=${COMMON_JS_VERSION}`));
  next = next.replace(/((?:src|href)=")(?!\/|https?:|#|data:)([^"\s]+\.(?:js|css)(?:\?v=\d+)?)(")/g, '$1/$2$3');
  // 旧版の累積分も含め、手書きページの連続空行は最大2行に揃える。
  next = next.replace(/(?:\r?\n[ \t]*){3,}/g, '\n\n');
  if (next !== before) fs.writeFileSync(file, next);
  return next !== before;
}

const GA = `<script>
(function(){
  // ボット（headless / Lighthouse / 自動操作）は計測しない。
  // 2026-09-28 の GA4 では Direct 75%・Chrome の 90% が非エンゲージで、
  // 0秒滞在のページ8本が lighthouse.yml の URL と一致していた（自分たちの検査を利用者として数えていた）。
  if (location.hostname !== 'techno-japan.media') return;
  if (navigator.webdriver || /HeadlessChrome|Chrome-Lighthouse|Lighthouse|Speed Insights|PTST|GTmetrix|TJAudit/i.test(navigator.userAgent)) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-4MHCNR7D26';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-4MHCNR7D26');
})();
</script>`;



function page({ title, desc, canonical, image, ogType = 'article', jsonLd, body, lang = 'ja', altHref = null, currentKey = '', extraScripts = '', backgroundLayer = false, robots = 'max-image-preview:large' }) {
  /* 検索結果に出る長さは言語で違う。日本語は全角のため PC で約120字、
     英語は約155字で切られる。160 固定だと日本語の135ページが途中で切れていた
     （2026-09-15 実測: JA 275件中120字超が135件）。 */
  const d = truncate(desc || '', lang === 'en' ? 155 : 120);
  // hreflang: JA/EN 両方が存在するページだけ相互宣言する
  const abs = (path) => `${BASE}${path}`;
  const hreflang = altHref
    ? (lang === 'ja'
        ? `<link rel="alternate" hreflang="ja" href="${esc(canonical)}">\n<link rel="alternate" hreflang="en" href="${esc(abs(altHref))}">\n<link rel="alternate" hreflang="x-default" href="${esc(abs(altHref))}">`
        : `<link rel="alternate" hreflang="en" href="${esc(canonical)}">\n<link rel="alternate" hreflang="ja" href="${esc(abs(altHref))}">\n<link rel="alternate" hreflang="x-default" href="${esc(canonical)}">`)
    : '';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Permissions-Policy" content="${PERMISSIONS_POLICY}">
${FAVICON_TAGS}

<title>${esc(title)}</title>
<meta name="description" content="${esc(d)}">
<meta name="robots" content="${robots}"${robots === 'noindex,follow' ? ' data-tj-thin="artist"' : ''}>
<link rel="canonical" href="${esc(canonical)}">
${hreflang}
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#080808">

<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="TECHNO JAPAN">
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(image)}">

${FONT_HEAD}
<link rel="stylesheet" href="/common.css?v=${COMMON_CSS_VERSION}">
<link rel="stylesheet" href="/detail.css?v=${DETAIL_CSS_VERSION}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${backgroundLayer ? '<div class="tj-bg" aria-hidden="true"><div class="tj-scan"></div></div>\n' : ''}${navHtml(lang, altHref, currentKey)}
${body}
${footerHtml(lang)}
${GA}
<script src="/common.js?v=${COMMON_JS_VERSION}" defer></script>
<script src="/search.js?v=${SEARCH_JS_VERSION}" defer data-hub-src="/data-hub.js?v=${DATA_HUB_VERSION}"></script>${extraScripts}
</body>
</html>
`;
}

/* ---------- 記事ページ ---------- */
/* [[event]] の place 文字列を VENUES と突合する。
   一致すれば Event JSON-LD に住所・座標を出せる（Google のイベント
   リッチリザルトは location の住所が実質必須。親設計 SEO_GEO_NEWS.md 1-3）。
   表記ゆれに耐えるよう NFKC 正規化＋英数字のみで比較する。
   一致しなければ従来どおり名前だけ出す（壊れない設計）。 */
function venueByPlaceName(place, venues) {
  const norm = (v) => String(v || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, '');
  const key = norm(place);
  if (!key) return null;
  return venues.find((v) => norm(v.name) === key) || null;
}

function venueByEdition(edition, venues) {
  const id = String(edition?.VENUE_ID || edition?.venueId || '').trim();
  if (!id) return null;
  return (venues || []).find((venue) => String(venue.id || '').trim() === id) || null;
}

function articleEventEdition(event, festivalId, editionsByFestival) {
  if (!festivalId || !event?.date?.start) return null;
  return (editionsByFestival.get(festivalId) || []).find((edition) => (
    String(edition.DATE_START || '') === event.date.start
    && String(edition.DATE_END || edition.DATE_START || '') === event.date.end
  )) || null;
}

function venueAddressLd(venue) {
  return postalAddressLd({
    streetAddress: venue?.address || venue?.ADDRESS,
    addressLocality: venue?.city || venue?.CITY,
    addressRegion: venue?.pref || venue?.PREF,
    addressCountry: 'JP',
  });
}

function newsletterFormHtml({ canonical = '', lang = 'ja', indent = '        ' } = {}) {
  if (USE_BUTTONDOWN) {
    return [
      `<form class="newsletter-form" action="https://buttondown.com/api/emails/embed-subscribe/${esc(BUTTONDOWN_USERNAME)}" method="POST">`,
      `${indent}<input type="email" name="email" placeholder="your@email.com" required>`,
      `${indent}<input type="hidden" name="embed" value="1">`,
      `${indent}<input type="hidden" name="tag" value="${lang === 'en' ? 'en' : 'ja'}">`,
      `${indent}<button type="submit">SUBSCRIBE</button>`,
      `${indent.slice(0, -2)}</form>`,
    ].join('\n');
  }
  return [
    `<form class="newsletter-form" action="https://formsubmit.co/press@techno-japan.media" method="POST">`,
    `${indent}<input type="text" name="_honey" tabindex="-1" autocomplete="off" class="tj-honeypot" aria-hidden="true">`,
    `${indent}<input type="email" name="email" placeholder="your@email.com" required>`,
    `${indent}<input type="hidden" name="_subject" value="TECHNO JAPAN — Newsletter signup">`,
    `${indent}<input type="hidden" name="_captcha" value="true">`,
    `${indent}<input type="hidden" name="_next" value="${esc(canonical)}">`,
    `${indent}<button type="submit">SUBSCRIBE</button>`,
    `${indent.slice(0, -2)}</form>`,
  ].join('\n');
}

/* 記事末尾のニュースレター登録。provider が formsubmit の間は従来の
   フォームをそのまま出し、Buttondown に切り替えた時だけ専用項目にする。 */
function articleNewsletterHtml(canonical, lang = 'ja') {
  const isEn = lang === 'en';
  return `<section class="newsletter article-newsletter">
      <div class="newsletter-eyebrow">NEWSLETTER</div>
      <div class="newsletter-title">${isEn ? "Get Japan's open-air festival news" : '日本の野外フェスの情報を受け取る'}</div>
      <div class="newsletter-desc">${isEn ? 'Upcoming festivals and new stories in one email. Free, unsubscribe anytime.' : '来月の開催予定と新着記事をまとめてメールで届けます。無料、いつでも解除できます。'}</div>
      ${newsletterFormHtml({ canonical, lang })}
    </section>`;
}

function relatedStoryCardsHtml(items, lang, { forceEnglishPath = false, compactDate = false, wide = false, grid = false, heading = 'RELATED STORIES', clauseBreakSub = false } = {}) {
  const cards = (items || []).map((a) => {
    const englishPath = lang === 'en' && (forceEnglishPath || a.title_en || a.body_en) ? '/en' : '';
    const title = stripTitleMarkdown(lang === 'en' ? (a.title_en || a.title) : a.title);
    const date = compactDate
      ? String(a.date || '').split('/')[0].replace(/-/g, '.')
      : fmtDate(a.date);
    const cardClass = wide ? 'related-story-card is-wide' : (grid ? 'related-story-card is-grid' : 'related-story-card');
    const thumbSrcsetAttr = wide
      ? relatedStoryWideSrcsetAttr
      : grid
        ? (source) => articleFourThreeSrcsetAttr(source, a.imagePosition, artistStoryGridSizes)
        : storyThumbSrcsetAttr;
    const storyTitle = wide || grid ? splitArticleTitle(title) : null;
    const titleSubHtml = storyTitle?.sub
      ? (clauseBreakSub && lang === 'ja' ? clauseBreaks(storyTitle.sub) : esc(storyTitle.sub))
      : '';
    const titleHtml = storyTitle
      ? `<span class="story-title-short">${esc(storyTitle.short)}</span>${titleSubHtml ? `<span class="story-title-sub">${titleSubHtml}</span>` : ''}`
      : esc(title);
    const storyImagePath = grid
      ? articleFourThreeImagePath(a.image, a.imagePosition)
      : cardImagePath(a.image);
    const thumb = grid
      ? `<div class="related-story-thumb artist-story-thumb">${a.image ? `<img ${dimensionAttrs(storyImagePath)} src="/${storyImagePath}"${thumbSrcsetAttr(a.image)} alt="" loading="lazy" decoding="async">` : ''}</div>`
      : (a.image ? `<img ${dimensionAttrs(storyImagePath)} class="related-story-thumb" src="/${storyImagePath}"${thumbSrcsetAttr(a.image)} alt="" loading="lazy" decoding="async">` : '');
    return `<a class="${cardClass}" href="${englishPath}/articles/${a.id}.html">
          ${thumb}
          <div><div class="related-story-meta">${esc(a.category || 'STORY')} · ${esc(date)}</div>
          <div class="related-story-title">${titleHtml}</div></div>
        </a>`;
  }).join('');
  return cards ? `<div class="related-stories">${heading ? `<h2>${heading}</h2>` : ''}${cards}</div>` : '';
}

function authorMatches(articleName, authorName) {
  return String(articleName || '').trim().toLocaleLowerCase() === String(authorName || '').trim().toLocaleLowerCase();
}

function buildAuthorIndex(authors, articles) {
  const published = (articles || []).filter((article) => article && String(article.status || '').toLowerCase() !== 'draft');
  return new Map((authors || []).filter((author) => author?.id && author?.name).map((author) => {
    const stories = published.filter((article) => authorMatches(article.author, author.name))
      .sort((a, b) => String(b.publishedAt || b.date || '').localeCompare(String(a.publishedAt || a.date || '')));
    return [author.id, { ...author, stories }];
  }));
}

function resolveAuthor(authorName, authorIndex) {
  const name = String(authorName || '').trim();
  return [...(authorIndex || new Map()).values()].find((author) => authorMatches(name, author.name)) || null;
}

function authorHref(author, lang) {
  return `${lang === 'en' ? '/en' : ''}/writers/${encodeURIComponent(author.id)}.html`;
}

function writerPage(author, lang, authorIndex) {
  const prefix = lang === 'en' ? '/en' : '';
  const canonical = `${BASE}${authorHref(author, lang)}`;
  const altHref = `${lang === 'ja' ? '/en' : ''}/writers/${encodeURIComponent(author.id)}.html`;
  const name = author.name;
  const bio = String(author.bio || '').trim();
  const stories = author.stories || [];
  const image = absUrl(author.image);
  const links = [
    ['INSTAGRAM', author.instagram],
    ['X', author.twitter],
    ['WEBSITE', author.website],
  ].map(([label, value]) => ({ label, href: String(value || '').trim() })).filter(({ href }) => href);
  const title = lang === 'ja' ? `${name}（ライター）| TECHNO JAPAN` : `${name} — Writer | TECHNO JAPAN`;
  const desc = bio || (lang === 'ja' ? `${name} が TECHNO JAPAN に書いた記事の一覧。` : `${name} — writer at TECHNO JAPAN.`);
  const person = {
    '@type': 'Person', name, url: canonical,
    ...(bio ? { description: bio } : {}),
    ...(author.image ? { image } : {}),
    ...(links.length ? { sameAs: links.map(({ href }) => href) } : {}),
  };
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'ProfilePage', name: `${name} | TECHNO JAPAN`, url: canonical,
    mainEntity: person, inLanguage: lang,
  };
  const linkHtml = links.map(({ label, href }) => `<a class="detail-link" href="${esc(safeUrl(href))}" target="_blank" rel="me noopener">${label}</a>`).join('');
  const body = `<article class="detail-page writer-detail">
  <div class="detail-inner">
    <div class="detail-eyebrow">WRITER</div>
    <h1>${esc(name)}</h1>
    ${author.image ? `<div class="detail-hero detail-hero-portrait"><img ${dimensionAttrs(author.image)} src="/${String(author.image).replace(/^\//, '')}"${heroSrcsetAttr(author.image)} alt="${esc(name)}" fetchpriority="high"></div>` : ''}
    ${bio ? `<div class="detail-body"><p>${esc(bio)}</p></div>` : ''}
    ${linkHtml ? `<div class="detail-links">${linkHtml}</div>` : ''}
    ${stories.length ? `<section class="detail-section writer-stories">${relatedStoryCardsHtml(stories, lang, { forceEnglishPath: true, compactDate: true, wide: true, heading: 'STORIES' })}</section>` : ''}
    <div class="article-footer"><a class="article-back" href="${prefix}/writers.html" style="margin:0"><span class="arrow"></span> WRITERS</a></div>
  </div>
</article>`;
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'writers'] : ['writers']), `${author.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd: [jsonLd, breadcrumbLd('WRITERS', '/writers.html', name, canonical)], body, lang, altHref, currentKey: 'about', backgroundLayer: true }) };
}

function isPublishedFestival(festival) {
  return festival && festival.id && String(festival.status || '').toLowerCase() !== 'draft';
}

function relatedFestivalCardHtml(festival, lang, prefix, editionsByFestival, editionOverride = null, imageSrcsetAttr = cardSrcsetAttr, articleContext = false) {
  const feds = editionOverride
    ? [editionOverride]
    : [...(editionsByFestival.get(String(festival.id)) || [])].sort((x, y) =>
      String(y.DATE_START || '').localeCompare(String(x.DATE_START || '')));
  const current = feds[0];
  const name = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
  const image = festival.image || festival.flyer;
  const place = [
    current ? editionLocationName(current, lang) : localizedValue(festival.location, festival.location_ja, '', lang),
    current?.PREF || festival.city,
  ].filter(Boolean).join(' — ');
  const date = current?.DATE_START
    ? [current.DATE_START, current.DATE_END].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' — ')
    : (festival.date || '');
  const today = jstToday();
  const end = current?.DATE_END || current?.DATE_START || '';
  const status = ISO_DATE.test(String(end)) && end >= today
    ? (lang === 'en' ? 'Upcoming' : '開催予定')
    : (lang === 'en' ? 'Archive' : '過去');
  return `<a class="related-card" href="${prefix}/festivals/${encodeURIComponent(festival.id)}.html">
    <div class="related-card-img">${image ? `<img ${dimensionAttrs(cardImagePath(image))} src="/${cardImagePath(image)}"${imageSrcsetAttr(image)} alt="${esc(name)}" loading="lazy"${imagePositionStyle(festival)}>` : ''}</div>
    <div class="related-card-info">
      <div class="related-card-date">${esc(date)}${articleContext ? ` · <span class="related-card-status">${esc(status)}</span>` : ''}</div>
      <div class="related-card-name">${esc(name)}</div>
      <div class="related-card-loc">${esc(place)}</div>
    </div>
  </a>`;
}

function selectRelatedFestivals(article, body, festivals, editionsByFestival, primaryFestivalId) {
  const maxRelatedFestivals = 6;
  const published = (festivals || []).filter(isPublishedFestival);
  const byId = new Map(published.map((festival) => [String(festival.id), festival]));
  const selected = [];
  const add = (festival) => {
    if (festival && !selected.some((item) => String(item.id) === String(festival.id)) && selected.length < maxRelatedFestivals) selected.push(festival);
  };
  add(byId.get(String(primaryFestivalId || '')));

  const shortcodeRe = /\[\[festival:([a-z0-9-]+)(?:\|[^\]]+)?\]\]/gi;
  let match;
  while ((match = shortcodeRe.exec(String(body || ''))) !== null) add(byId.get(match[1]));

  const plainBody = stripTags(body || '').toLocaleLowerCase();
  for (const festival of published) {
    const name = String(festival.name || '').trim();
    if (name.length >= 4 && plainBody.includes(name.toLocaleLowerCase())) add(festival);
  }

  if (selected.length >= maxRelatedFestivals) return selected;
  const today = new Date().toISOString().slice(0, 10);
  const primaryEditions = editionsByFestival.get(String(primaryFestivalId || '')) || [];
  const primaryPrefs = new Set(primaryEditions.map((edition) => String(edition.PREF || '').trim().toLowerCase()).filter(Boolean));
  const upcoming = [];
  for (const festival of published) {
    if (selected.some((item) => String(item.id) === String(festival.id))) continue;
    const editions = (editionsByFestival.get(String(festival.id)) || [])
      .filter((edition) => {
        const start = String(edition.DATE_START || '');
        const end = ISO_DATE.test(String(edition.DATE_END || '')) ? edition.DATE_END : start;
        return ISO_DATE.test(start) && end >= today && String(edition.STATUS || '').trim().toLowerCase() !== 'cancelled';
      })
      .sort((a, b) => String(a.DATE_START).localeCompare(String(b.DATE_START)));
    if (!editions.length) continue;
    const edition = editions[0];
    upcoming.push({ festival, edition, samePref: primaryPrefs.has(String(edition.PREF || '').trim().toLowerCase()) });
  }
  upcoming.sort((a, b) => Number(b.samePref) - Number(a.samePref)
    || String(a.edition.DATE_START).localeCompare(String(b.edition.DATE_START))
    || String(a.festival.name || '').localeCompare(String(b.festival.name || '')));
  upcoming.forEach(({ festival }) => add(festival));
  return selected;
}

function articleOverviewHtml(festival, edition, lineupsByEdition, artists, allArtists, lang) {
  if (!festival || !edition) return '';
  const publicArtistsById = new Map((artists || []).map((artist) => [String(artist.id || '').trim(), artist]));
  const allArtistsById = new Map((allArtists || []).map((artist) => [String(artist.ID || artist.id || '').trim(), artist]).filter(([id]) => id));
  const lineupRows = lineupsByEdition.get(String(edition.EDITION_ID || '')) || [];
  const lineup = lineupRows.map((row) => {
    if (isCompositeLineup(row)) return `<span>${esc(row.ACT_LABEL || '')}</span>`;
    const id = lineupArtistIds(row)[0];
    const resolved = resolveLineupArtist(row, publicArtistsById, allArtistsById);
    if (resolved.status === 'published') {
      const artist = resolved.artist;
      const name = lang === 'en' ? (artist.name_en || artist.name) : artist.name;
      return `<a class="ent" href="${lang === 'en' ? '/en' : ''}/artists/${encodeURIComponent(id)}.html">${esc(name)}</a>`;
    }
    const artist = resolved.artist;
    const name = String(row.ACT_LABEL || artist?.NAME || artist?.name || id || '').trim();
    return `<span>${esc(name)}</span>`;
  }).filter(Boolean).join('<span class="article-overview-sep">, </span>');
  const date = lang === 'en'
    ? fmtMetaDateEn(edition.DATE_START, edition.DATE_END)
    : fmtMetaDateJa(edition.DATE_START, edition.DATE_END);
  const venue = [editionLocationName(edition, lang), festival.city].filter(Boolean).join(', ');
  const genre = Array.isArray(festival.genre) ? festival.genre.join(' / ') : String(festival.genre || '').trim();
  const sound = String(festival.sound || festival.SOUND || '').trim();
  const status = String(edition.STATUS || '').trim();
  const statusHtml = status && status.toLowerCase() !== 'announced'
    ? `<div class="article-overview-row is-status"><dt>STATUS</dt><dd>${esc(status)}</dd></div>`
    : '';
  const optionalRows = [
    lineup ? `<div class="article-overview-row"><dt>ARTISTS</dt><dd class="article-overview-artists">${lineup}</dd></div>` : '',
    genre ? `<div class="article-overview-row"><dt>GENRE</dt><dd>${esc(genre)}</dd></div>` : '',
    sound ? `<div class="article-overview-row"><dt>SOUND</dt><dd>${esc(sound)}</dd></div>` : '',
    statusHtml,
  ].filter(Boolean).join('\n    ');
  return `<section class="article-overview">
  <h2 class="mono red">Overview</h2>
  <dl>
    <div class="article-overview-row"><dt>DATE</dt><dd>${esc(date || '—')}</dd></div>
    <div class="article-overview-row"><dt>VENUE</dt><dd>${esc(venue || '—')}</dd></div>
${optionalRows ? `    ${optionalRows}\n` : ''}  </dl>
  <p class="article-overview-source mono">From festivals DB · ${esc(edition.EDITION_ID || edition.EDITION || '')}</p>
</section>`;
}

function articlePage(a, resolveEntities, lang = 'ja', festivals = [], editionsByFestival = new Map(), venues = [], festivalData = null, articles = [], artists = [], authorIndex = new Map(), lineupsByEdition = new Map(), allArtists = []) {
  // EN版は title_en / excerpt_en / body_en を使う（無い項目はJAへフォールバック）
  const L = lang === 'en'
    ? { title: stripTitleMarkdown(a.title_en || a.title), excerpt: stripTitleMarkdown(a.excerpt_en || a.excerpt), body: a.body_en || a.body, prefix: '/en' }
    : { title: stripTitleMarkdown(a.title), excerpt: stripTitleMarkdown(a.excerpt), body: a.body, prefix: '' };
  const hasAlt = lang === 'ja' ? !!(a.title_en || a.body_en) : true;
  const altHref = hasAlt ? (lang === 'ja' ? `/en/articles/${a.id}.html` : `/articles/${a.id}.html`) : null;
  const canonical = `${BASE}${L.prefix}/articles/${a.id}.html`;
  const hubHref = `${L.prefix}/news.html`;
  const desc = L.excerpt || truncate(stripTags(L.body), 160);
  const image = absUrl(a.image);
  const tags = (a.tags || []).map((t) => `<span class="article-tag">#${esc(t)}</span>`).join('');
  const rawAuthorName = String(a.author || '').trim();
  const authorView = authorPresentation(rawAuthorName, lang);
  const author = resolveAuthor(rawAuthorName, authorIndex);
  const articleEvents = parseEvents(L.body || '');
  const festivalId = String(a.festivalId || '').trim();
  const relatedFestival = festivalId
    ? (festivals || []).find((f) => String(f.id) === festivalId && isPublishedFestival(f))
    : null;
  const relatedYear = latestEdition(editionsByFestival.get(festivalId) || [])?.EDITION?.match(/^\d{4}/)?.[0]
    || latestEdition(editionsByFestival.get(festivalId) || [])?.DATE_START?.match(/^\d{4}/)?.[0]
    || '';
  const title = lang === 'en'
    ? articleSeoTitle(L.title, relatedFestival ? (relatedFestival.name_en || relatedFestival.name) : '', relatedYear)
    : japaneseArticleSeoTitle(L.title);
  const relatedFestivalPath = relatedFestival
    ? path.join(LP_DIR, 'festivals', `${relatedFestival.id}.html`)
    : '';
  const about = relatedFestival && fs.existsSync(relatedFestivalPath)
    ? [{ '@id': `${BASE}/festivals/${encodeURIComponent(relatedFestival.id)}.html#festival` }]
    : undefined;
  const articleImages = articleImageVariants(a.image, a.imagePosition);
  const isOrganizationAuthor = authorView.isOrganization;
  const relatedEdition = relatedFestival ? latestEdition(editionsByFestival.get(festivalId) || []) : null;
  const articleOverview = articleOverviewHtml(relatedFestival, relatedEdition, lineupsByEdition, artists, allArtists, lang);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: L.title,
    description: desc,
    image: articleImages,
    isAccessibleForFree: true,
    /* 音声アシスタントと生成AIに「記事の要点はここ」を明示する（2026-09-15）。
       Google は speakable をニュース記事向けにサポートしている。
       セレクタは実際のマークアップと一致させること（h1 と .article-excerpt）。 */
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.article-excerpt'],
    },
    wordCount: stripTags(L.body || '').length,
    thumbnailUrl: articleImages[0] || image,
    ...(about ? { about } : {}),
    inLanguage: lang,
    datePublished: isoDateTime(a.date),
    dateModified: isoDateTime(a.updatedAt || a.date),
    author: isOrganizationAuthor
      ? { '@type': 'Organization', name: 'TECHNO JAPAN', url: `${BASE}/` }
      : author
        ? { '@type': 'Person', name: rawAuthorName, url: `${BASE}${authorHref(author, lang)}`, ...(author.instagram || author.twitter || author.website ? { sameAs: [author.instagram, author.twitter, author.website].filter(Boolean) } : {}) }
        : { '@type': 'Person', name: rawAuthorName },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    articleSection: a.category || 'NEWS',
    // SPA(news.html) は動的注入で keywords を出していたが、静的ページ側が
    // 欠けていた。JS を実行しないクローラーには SPA の注入が届かないため、
    // A5（共有URLがハッシュ版）と同じ「SPAだけ対応済み」の取りこぼし。
    // 出力形式は SPA と揃える（カンマ区切り文字列・空なら省略）。
    ...(Array.isArray(a.tags) && a.tags.length
      ? { keywords: a.tags.join(', ') }
      : {}),
    url: canonical,
  };
  const eventJsonLd = articleEvents.map((event) => {
    const eventFestivalId = String(event.festivalId || festivalId).trim();
    const eventFestival = eventFestivalId
      ? (festivals || []).find((f) => String(f.id) === eventFestivalId && isPublishedFestival(f))
      : null;
    const eventEdition = articleEventEdition(event, eventFestivalId, editionsByFestival);
    const venue = venueByPlaceName(event.place, venues) || venueByEdition(eventEdition, venues);
    const eventAddress = editionAddressLd(eventEdition || {}) || venueAddressLd(venue);
    return {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: event.name,
      ...(event.date.start ? { startDate: event.date.start, endDate: event.date.end || event.date.start } : {}),
      location: venue
        ? {
            '@type': 'Place',
            name: venue.name,
            ...(eventAddress ? { address: eventAddress } : {}),
            ...(venue.lat && venue.lng ? { geo: { '@type': 'GeoCoordinates', latitude: venue.lat, longitude: venue.lng } } : {}),
          }
        : {
            '@type': 'Place',
            name: event.place,
            ...(eventAddress ? { address: eventAddress } : {}),
          },
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...eventLdShared({ festival: eventFestival, edition: eventEdition, lang }),
      eventStatus: editionStatusLd(eventEdition?.STATUS),
      ...(event.url ? { url: event.url } : {}),
      ...(eventFestivalId ? { sameAs: [`${BASE}/festivals/${eventFestivalId}.html`] } : {}),
      ...((event.artists.length ? event.artists : festivalData?.[event.festivalId]?.lineup || []).length
        ? { performer: (event.artists.length ? event.artists : festivalData[event.festivalId].lineup).map((name) => ({ '@type': 'Person', name })) }
        : {}),
    };
  });

  const { short: articleTitleShort, sub: articleTitleSub } = splitArticleTitle(L.title);
  const articleTitleHtml = `<span class="article-title-short">${clauseBreaks(articleTitleShort)}</span>${articleTitleSub ? `<span class="article-title-sub">${clauseBreaks(articleTitleSub)}</span>` : ''}`;
  const articleHeroMeta = `<dl class="article-hero-meta" aria-label="Article information">
      <div><dt>Words by</dt><dd>${esc(authorView.name)}</dd></div>
      <div><dt>Published</dt><dd>${esc(fmtDate(a.date) || '—')}</dd></div>
      <div><dt>Reading time</dt><dd>${esc(a.readTime || 5)} MIN</dd></div>
    </dl>`;
  const heroBlock = a.image
    ? `<header class="article-hero"${ratioAttr(a.heroRatio)}>
        <img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}"${heroSrcsetAttr(a.image, articleHeroSizes(a.image), true)}${imagePositionStyle(a)} alt="${esc(L.title)}" fetchpriority="high" decoding="async">
        ${articleHeroMeta}
        <div class="article-hero-overlay">
          <div class="article-hero-overlay-inner">
            <div class="article-chips"><span class="cat-pill">${esc(a.category || 'NEWS')}</span></div>
            <h1 class="disp">${articleTitleHtml}</h1>
          </div>
        </div>
      </header>`
    : `<header class="article-meta-top"><span class="pill">${esc(a.category || 'NEWS')}</span>${articleHeroMeta}</header><h1 class="disp">${articleTitleHtml}</h1>`;

  /* 記事に紐づくフェス（ARTICLES.festivalId）。

     紐づけ自体は前からあり、**フェス側の「RELATED STORIES」だけが**
     それを使っていた。記事 → フェスの導線は無く、片方向だった
     （2026-08-07 / AUDIT §9-55）。詳細 → 詳細が繋がらない状態は
     §9-23 で回遊が切れたときと同じ形なので、対にしておく。

     カード画像はハブと同じ縮小版を使う（§9-51）。 */
  const relatedFestivals = selectRelatedFestivals(a, L.body, festivals, editionsByFestival, festivalId);
  const relatedFestivalHtml = relatedFestivals.length
    ? `<section class="related-festivals">
    <div class="related-section-head"><h2 class="disp">${lang === 'en' ? 'Related festivals' : '関連フェスティバル'}</h2></div>
    <div class="related-festivals-track">${relatedFestivals.map((festival) => relatedFestivalCardHtml(festival, lang, L.prefix, editionsByFestival, null, relatedFestivalSrcsetAttr, true)).join('')}</div>
  </section>`
    : '';

  const articleDateKey = (item) => String(item.publishedAt || item.date || '').trim();
  const publishedArticles = (articles || [])
    .filter((item) => item && item.status === 'published' && item.id && item.id !== a.id)
    .sort((x, y) => articleDateKey(y).localeCompare(articleDateKey(x)));
  const relatedArticles = [];
  const addRelated = (items) => {
    for (const item of items) {
      if (!relatedArticles.some((selected) => selected.id === item.id) && relatedArticles.length < 3) {
        relatedArticles.push(item);
      }
    }
  };
  addRelated(publishedArticles.filter((item) => festivalId && String(item.festivalId || '').trim() === festivalId));
  addRelated(publishedArticles.filter((item) => a.category && item.category === a.category));
  addRelated(publishedArticles);
  const relatedStoriesHtml = relatedArticles.length
    ? `<section class="detail-section festival-related-stories-v2 article-related-stories">${relatedStoryCardsHtml(relatedArticles, lang, { forceEnglishPath: true, compactDate: true, wide: true, heading: 'Related Stories' })}</section>`
    : '';

  const updatedDate = String(a.updatedAt || '').trim();
  const updatedHtml = updatedDate && updatedDate !== String(a.date || '').trim()
    ? `<span class="article-updated">${lang === 'en' ? 'Updated: ' : '更新: '}${esc(fmtDateDots(updatedDate))}</span>`
    : '';
  const authorHtml = isOrganizationAuthor
    ? `<a class="article-author-link" href="${lang === 'en' ? '/en/about.html' : '/about.html'}">${esc(authorView.name)}</a>`
    : author
      ? `<a class="article-author-link" href="${authorHref(author, lang)}">${esc(authorView.name)}</a>`
      : esc(authorView.name);
  const festivalName = relatedFestival
    ? (lang === 'en' ? (relatedFestival.name_en || relatedFestival.name) : relatedFestival.name)
    : '';
  const festivalImage = relatedFestival?.image || relatedFestival?.flyer || '';
  const festivalDate = relatedEdition
    ? (lang === 'en' ? fmtMetaDateEn(relatedEdition.DATE_START, relatedEdition.DATE_END) : fmtMetaDateJa(relatedEdition.DATE_START, relatedEdition.DATE_END))
    : '';
  const festivalPlace = relatedEdition
    ? [editionLocationName(relatedEdition, lang), relatedFestival.city].filter(Boolean).join(' · ')
    : '';
  const festivalStatus = relatedEdition && ISO_DATE.test(String(relatedEdition.DATE_END || relatedEdition.DATE_START || '')) && String(relatedEdition.DATE_END || relatedEdition.DATE_START) >= jstToday()
    ? (lang === 'en' ? 'Upcoming' : '開催予定')
    : (lang === 'en' ? 'Archive' : '過去');
  const festivalHref = relatedFestival ? `${L.prefix}/festivals/${encodeURIComponent(relatedFestival.id)}.html` : '';
  const festivalAside = relatedFestival
    ? `<section class="article-festival">
    <div class="article-festival-desktop">
      <h2 class="mono red">Festival</h2>
      <a class="article-festival-name disp" href="${festivalHref}">${esc(festivalName)}</a>
      <a class="article-festival-details mono" href="${festivalHref}">Festival details →</a>
    </div>
    <a class="article-festival-mobile" href="${festivalHref}">
      <span class="article-festival-thumb">${festivalImage ? `<img ${dimensionAttrs(cardImagePath(festivalImage))} src="/${cardImagePath(festivalImage)}"${relatedFestivalSrcsetAttr(festivalImage)} alt="${esc(festivalName)}" loading="lazy" decoding="async"${imagePositionStyle(relatedFestival)}>` : ''}</span>
      <span class="article-festival-copy"><span class="mono red">${esc(festivalDate)} · ${esc(festivalStatus)}</span><span class="disp">${esc(festivalName)}</span><span class="mono">${esc(festivalPlace)}</span></span>
      <span class="mono article-festival-arrow" aria-hidden="true">→</span>
    </a>
  </section>`
    : '';
  // 自動リンクを先に適用し、カードHTMLはその後に生成する（二重リンク防止）。
  const linkedBody = autolinkArtists(L.body || '', artists);
  const renderedBody = addLocalImageSrcset(addDriveImageSrcset(addHtmlImageDimensions(addHeadingPhraseBreaks(replaceMappedArticleImages(resolveEntities(linkedBody, lang), ARTICLE_IMAGE_MAP, path.join(__dirname, '..'))))));
  const body = `<article class="article-detail">
  <div class="article-detail-inner">
    ${heroBlock}
    <div class="article-main-grid">
      <div class="article-content">
        <div class="article-excerpt">${esc(L.excerpt || '')}</div>
        <div class="article-body">${renderedBody}</div>
        <div class="article-share">${festivalShareButtons(L.title, canonical, lang)}</div>
      </div>
      <aside class="article-sidebar">
        <dl class="article-specs">
          <div><dt>WORDS BY</dt><dd>${authorHtml}</dd></div>
          <div><dt>PUBLISHED</dt><dd>${esc(fmtDate(a.date) || '—')}${updatedHtml}</dd></div>
          <div><dt>READING TIME</dt><dd>${esc(a.readTime || 5)} MIN</dd></div>
        </dl>
${festivalAside ? `        ${festivalAside}\n` : ''}${articleOverview ? `        ${articleOverview}\n` : ''}        <a class="article-sidebar-back mono" href="${hubHref}" data-article-hub-back="${hubHref}">${lang === 'en' ? 'All stories' : 'ALL STORIES'} →</a>
      </aside>
    </div>
    ${relatedStoriesHtml}
    ${relatedFestivalHtml}
    <div class="article-footer">
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
      <a class="article-back" href="${hubHref}" data-article-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL STORIES</a>
    </div>
    ${articleNewsletterHtml(canonical, lang)}
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'articles'] : ['articles']), `${a.id}.html`), html: page({ title, desc, canonical, image, jsonLd: [jsonLd, ORG_JSONLD, breadcrumbLd('NEWS', '/news.html', L.title, canonical), ...eventJsonLd], body, lang, altHref, currentKey: 'news', backgroundLayer: true, extraScripts: `\n<link rel="stylesheet" href="/article-fx.css?v=${ARTICLE_FX_CSS_VERSION}">\n<script src="/article-fx.js?v=${ARTICLE_FX_JS_VERSION}" defer></script>` + ARTICLE_HUB_BACK_SCRIPT + FESTIVAL_SHARE_SCRIPT }) };
}

/* ---------- フェスティバルページ ---------- */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/* 地名の日本語表記。EDITIONS.PREF / FESTIVALS.city / VENUES.city・area は英字で入っている
   （"Hokkaido" "TOKYO" "SHIBUYA"）。JA ページの title に "Hokkaidoのテクノ・野外フェス" と
   出すと、利用者が実際に検索する「北海道」「札幌」「渋谷」と一致しない（2026-09-28 の GSC:
   `big fun 札幌 2026` 277表示、`the room 渋谷` 333表示）。知らない値はそのまま返す（嘘を書かない）。 */
const PLACE_JA = {
  hokkaido: '北海道', aomori: '青森', iwate: '岩手', miyagi: '宮城', akita: '秋田', yamagata: '山形', fukushima: '福島',
  ibaraki: '茨城', tochigi: '栃木', gunma: '群馬', saitama: '埼玉', chiba: '千葉', tokyo: '東京', kanagawa: '神奈川',
  niigata: '新潟', toyama: '富山', ishikawa: '石川', fukui: '福井', yamanashi: '山梨', nagano: '長野', gifu: '岐阜',
  shizuoka: '静岡', aichi: '愛知', mie: '三重', shiga: '滋賀', kyoto: '京都', osaka: '大阪', hyogo: '兵庫', nara: '奈良',
  wakayama: '和歌山', tottori: '鳥取', shimane: '島根', okayama: '岡山', hiroshima: '広島', yamaguchi: '山口',
  tokushima: '徳島', kagawa: '香川', ehime: '愛媛', kochi: '高知', fukuoka: '福岡', saga: '佐賀', nagasaki: '長崎',
  kumamoto: '熊本', oita: '大分', miyazaki: '宮崎', kagoshima: '鹿児島', okinawa: '沖縄',
  kanto: '関東', hakuba: '白馬', kawasaki: '川崎', sapporo: '札幌', nagoya: '名古屋', kobe: '神戸', yokohama: '横浜',
  shibuya: '渋谷', ebisu: '恵比寿', daikanyama: '代官山', nakameguro: '中目黒', omotesando: '表参道', jingumae: '神宮前',
  hatagaya: '幡ヶ谷', shinsaibashi: '心斎橋', umeda: '梅田', kitahama: '北浜', 'jingu-marutamachi': '神宮丸太町',
};
const placeJa = (value) => PLACE_JA[String(value || '').trim().toLowerCase()] || String(value || '').trim();
const placeEn = (value) => String(value || '').trim().replace(/[A-Za-z]+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());


function editionLocationName(ed, lang) {
  return localizedValue(ed.LOCATION, ed.LOCATION_JA, ed.LOCATION_EN, lang);
}

function editionPlace(ed, lang) {
  const pref = lang === 'en' ? placeEn(ed.PREF) : placeJa(ed.PREF);
  return [editionLocationName(ed, lang), pref].filter(Boolean).join(', ');
}

function postalAddressLd({ streetAddress = '', addressLocality = '', addressRegion = '', addressCountry = '' } = {}) {
  const fields = [
    ['streetAddress', streetAddress],
    ['addressLocality', addressLocality],
    ['addressRegion', addressRegion],
    ['addressCountry', addressCountry],
  ].filter(([, value]) => String(value || '').trim());
  return fields.length
    ? { '@type': 'PostalAddress', ...Object.fromEntries(fields.map(([key, value]) => [key, String(value).trim()])) }
    : null;
}

function editionAddressLd(ed) {
  return postalAddressLd({
    streetAddress: ed.ADDRESS,
    addressLocality: ed.CITY || ed.city,
    addressRegion: ed.PREF,
    // EDITIONS は日本のフェス開催回データなので、国コードはデータの前提に従う。
    addressCountry: 'JP',
  });
}

function editionLocationLd(ed, lang) {
  const address = editionAddressLd(ed);
  return {
    '@type': 'Place',
    name: editionLocationName(ed, lang) || ed.PREF || 'Japan',
    ...(address ? { address } : {}),
    ...(ed.LAT && ed.LNG ? {
      geo: { '@type': 'GeoCoordinates', latitude: ed.LAT, longitude: ed.LNG },
    } : {}),
  };
}

/* JSON-LD 用の出演者。ARTIST_ID が解決できれば登録アーティストへのリンク付き、
   できなければ ACT_LABEL の名前だけで出す。

   LINEUPS 621行のうち **501行は ARTIST_ID を持たない名前だけの行**（2026-08-13 実測）。
   lineupEntity（リンク必須）だけに頼ると、出演者情報のほとんどが
   構造化データから消える。名前だけでも schema.org として有効で、
   AI検索が「誰が出るか」を読める。AUDIT §9-79。 */
function lineupPerformerLd(row, artistsById, allArtistsById, lang) {
  const linked = lineupEntity(row, artistsById, allArtistsById, lang);  // 参照切れは従来どおり例外で止める
  if (linked) return linked;
  const label = String(row.ACT_LABEL || '').trim();
  return label ? { '@type': 'MusicGroup', name: label } : null;
}

/* 同じ出演者が複数の開催回に出ると親の performer が重複するので名寄せする。 */
function dedupePerformers(list) {
  const seen = new Set();
  return list.filter((p) => {
    const key = p['@id'] || p.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function editionStatusLd(status) {
  const values = {
    announced: 'EventScheduled',
    'on-sale': 'EventScheduled',
    soldout: 'EventScheduled',
    finished: 'EventScheduled',
    cancelled: 'EventCancelled',
  };
  const value = values[String(status || '').trim().toLowerCase()];
  /* 空欄・規約外（published 等が36件ある。§9-79）は EventScheduled を出す。
     掲載している開催回である以上 scheduled は事実であり、eventStatus は
     リッチリザルトの推奨項目。cancelled だけは明示値が必要なので既定にしない。
     規約外の値そのものは直さず報告する（AGENTS.md）。 */
  return `https://schema.org/${value || 'EventScheduled'}`;
}

function eventLdShared({ festival, edition, lang }) {
  if (!festival) return {};
  const festivalName = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
  const officialUrl = safeUrl(festival.url);
  const ticketUrl = safeUrl(String(
    edition?.TICKETURL || festival.ticketUrl || festival.ticket_url || festival.tickets || '',
  ).trim());
  const imageSource = String((pickFlyer(festival, edition).src || festival.image || '')).trim();
  const description = lang === 'en' ? (festival.desc_en || festival.desc) : (festival.desc || festival.desc_en);
  return {
    eventStatus: editionStatusLd(edition?.STATUS),
    ...(officialUrl ? { organizer: { '@type': 'Organization', name: festivalName, url: officialUrl } } : {}),
    ...(ticketUrl ? { offers: { '@type': 'Offer', url: ticketUrl } } : {}),
    ...(imageSource ? { image: absUrl(imageSource) } : {}),
    ...(description ? { description } : {}),
  };
}

/* 開催回を参照するページ（フェス・アーティスト・会場）で共用する
   最小のイベントノード。開催回の実データが不足している場合は、
   検索エンジンに不完全な Event を渡さない。 */
function editionEventLd({ festival, edition, lang, idSuffix = '#festival', includeUrl = true }) {
  const startDate = String(edition?.DATE_START || '');
  const locationAvailable = [
    edition?.LOCATION, edition?.LOCATION_JA, edition?.LOCATION_EN,
    edition?.PREF, edition?.ADDRESS, edition?.LAT, edition?.LNG,
  ].some((value) => String(value ?? '').trim());
  if (!festival || !edition || !ISO_DATE.test(startDate) || !locationAvailable) return null;

  const festivalName = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
  const festivalPath = `${lang === 'en' ? '/en' : ''}/festivals/${encodeURIComponent(festival.id)}.html`;
  return {
    '@type': 'Festival',
    '@id': `${BASE}/festivals/${encodeURIComponent(festival.id)}.html${idSuffix}`,
    name: `${festivalName || ''} ${editionLabel(editionIdentifier(edition))}`.trim(),
    startDate,
    endDate: ISO_DATE.test(String(edition.DATE_END || '')) ? edition.DATE_END : startDate,
    ...eventLdShared({ festival, edition, lang }),
    location: editionLocationLd(edition, lang),
    ...(includeUrl ? { url: `${BASE}${festivalPath}` } : {}),
  };
}

function editionDateHtml(ed, lang) {
  const start = String(ed.DATE_START || '');
  const end = String(ed.DATE_END || '');
  const startHtml = ISO_DATE.test(start) ? `<time datetime="${start}">${esc(start)}</time>` : esc(start);
  if (!end || end === start) return startHtml;
  const endHtml = ISO_DATE.test(end) ? `<time datetime="${end}">${esc(end)}</time>` : esc(end);
  return `${startHtml}<span class="edition-date-sep" aria-label="${lang === 'en' ? 'to' : 'から'}"> — </span>${endHtml}`;
}

function editionsTable(editions, lang) {
  if (!editions.length) return '';
  const rows = editions.map((ed) => `<tr>
      <th scope="row">${esc(editionLabel(editionIdentifier(ed)) || ed.EDITION_ID)}</th>
      <td class="edition-date">${editionDateHtml(ed, lang)}</td>
      <td>${esc(editionPlace(ed, lang) || '—')}</td>
      <td>${esc(ed.STATUS || '—')}</td>
      <td>${ed.TICKETURL ? `<a href="${esc(safeUrl(ed.TICKETURL))}" target="_blank" rel="noopener">${lang === 'en' ? 'Tickets' : 'チケット'}</a>` : '—'}</td>
    </tr>`).join('\n');
  return `<h2>${lang === 'en' ? 'EDITIONS' : '開催ヒストリー'}</h2>
  <div class="editions-table-wrap">
    <table class="editions-table">
      <caption>${lang === 'en' ? 'Festival edition history' : 'フェスティバル開催履歴'}</caption>
      <thead><tr>
        <th scope="col">${lang === 'en' ? 'EDITION' : '開催回'}</th>
        <th scope="col">${lang === 'en' ? 'DATES' : '日程'}</th>
        <th scope="col">${lang === 'en' ? 'VENUE' : '会場'}</th>
        <th scope="col">STATUS</th>
        <th scope="col">${lang === 'en' ? 'LINK' : 'リンク'}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function lineupArtistIds(row) {
  const value = row.ARTIST_IDS || row.ARTIST_ID || [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
}

// 新列へ移行するまでの安全側フォールバック。ACT_LABELは分割せず、
// 複合の可能性がある枠をリンク/performer対象から丸ごと除外する。
function isCompositeLineup(row) {
  const ids = lineupArtistIds(row);
  return ids.length > 1 || !!String(row.JOIN_TYPE || '').trim() ||
    String(row.SET_TYPE || '').trim().toLowerCase() === 'b2b' ||
    (!ids.length && /\s&\s/.test(String(row.ACT_LABEL || '')));
}

function lineupEntity(row, artistsById, allArtistsById, lang) {
  if (isCompositeLineup(row)) return null;
  const id = lineupArtistIds(row)[0];
  if (!id) return null;
  const resolved = resolveLineupArtist(row, artistsById, allArtistsById);
  if (resolved.status === 'missing') throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  const artist = resolved.artist;
  if (resolved.status === 'unpublished') {
    const name = String(row.ACT_LABEL || artist.NAME || artist.name || id).trim();
    return name ? { '@type': 'MusicGroup', name } : null;
  }
  return {
    '@type': artistSchemaType(artist),
    '@id': artistEntityId(id),
    name: lang === 'en' ? (artist.name_en || artist.name) : artist.name,
    url: `${BASE}/artists/${encodeURIComponent(id)}.html`,
  };
}

function lineupSlotHtml(row, artistsById, allArtistsById, lang) {
  if (isCompositeLineup(row)) return `<span class="lineup-item disp" data-lineup-slot data-lineup-composite>${esc(row.ACT_LABEL || '')}</span>`;
  const id = lineupArtistIds(row)[0];
  if (!id) return `<span class="lineup-item disp" data-lineup-slot>${esc(row.ACT_LABEL || '')}</span>`;
  const resolved = resolveLineupArtist(row, artistsById, allArtistsById);
  if (resolved.status === 'missing') throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  const artist = resolved.artist;
  if (resolved.status === 'unpublished') {
    const name = String(row.ACT_LABEL || artist.NAME || artist.name || id).trim();
    return `<span class="lineup-item disp" data-lineup-slot>${esc(name)}</span>`;
  }
  const prefix = lang === 'en' ? '/en' : '';
  const name = lang === 'en' ? (artist.name_en || artist.name) : artist.name;
  return `<a class="lineup-item disp" data-lineup-slot data-lineup-artist="${esc(id)}" href="${prefix}/artists/${encodeURIComponent(id)}.html">${esc(name)}</a>`;
}

function lineupArtistImageHtml(row, artistsById, allArtistsById) {
  if (isCompositeLineup(row)) return '';
  const resolved = resolveLineupArtist(row, artistsById, allArtistsById);
  if (resolved.status === 'missing') throw new Error(`lineups.json: ARTIST_ID 参照切れ "${lineupArtistIds(row)[0]}"`);
  if (resolved.status !== 'published' || !resolved.artist?.image) return '';
  const source = resolved.artist.image;
  const image = cardImagePath(source);
  return `<img ${dimensionAttrs(image)} src="/${image}"${srcsetAttr(source, '56px')} alt="" loading="lazy" decoding="async"${imagePositionStyle(resolved.artist)}>`;
}

function festivalLineupsHtml(editions, lineupsByEdition, artistsById, allArtistsById, lang) {
  const groups = editions.map((ed) => ({ ed, rows: lineupsByEdition.get(ed.EDITION_ID) || [] }))
    .filter((group) => group.rows.length);
  if (!groups.length) return '';
  const body = groups.map(({ ed, rows }) => {
    const slots = [...rows]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
      .map((row) => lineupSlotHtml(row, artistsById, allArtistsById, lang)).join('');
    return groups.length > 1
      ? `<section class="edition-lineup"><h3>${esc(editionLabel(editionIdentifier(ed)) || ed.EDITION_ID)}</h3><div class="lineup-list">${slots}</div></section>`
      : `<div class="lineup-list">${slots}</div>`;
  }).join('');
  return `<section class="festival-lineups"><h2>LINE UP</h2>${body}</section>`;
}

function festivalDateText(ed, lang) {
  const start = String(ed?.DATE_START || '');
  const end = String(ed?.DATE_END || '');
  if (!ISO_DATE.test(start)) return '';
  const format = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return lang === 'en'
      ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
      : `${year}年${month}月${day}日`;
  };
  if (!ISO_DATE.test(end) || end === start) return format(start);
  return lang === 'en' ? `${format(start)} to ${format(end)}` : `${format(start)}から${format(end)}`;
}

function festivalAreaText(festival, edition, lang) {
  const parts = [edition?.PREF, festival.city]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index);
  return lang === 'en' ? parts.reverse().join(', ') : parts.join('');
}

function festivalGenreText(festival, lang) {
  const genres = (Array.isArray(festival.genre) ? festival.genre : String(festival.genre || '').split('/'))
    .map((genre) => String(genre).trim())
    .filter(Boolean);
  if (!genres.length) return '';
  return lang === 'en' ? genres.join(' / ').toLowerCase() : genres.join('／');
}

function festivalSummary(festival, edition, name, lang) {
  const area = festivalAreaText(festival, edition, lang);
  const genre = festivalGenreText(festival, lang);
  const date = festivalDateText(edition, lang);
  const venue = edition ? editionLocationName(edition, lang) : '';
  if (lang === 'en') {
    const kind = genre ? `${genre} festival` : (festival.type === 'rave' ? 'rave' : 'festival');
    const first = `${name} is a ${kind}${area ? ` held in ${area}` : ''}.`;
    const second = date ? `The latest listed edition is ${date}${venue ? ` at ${venue}` : ''}.` : '';
    return [first, second].filter(Boolean).join(' ');
  }
  const kind = genre ? `${genre}のフェスティバル` : (festival.type === 'rave' ? 'レイヴ' : 'フェスティバル');
  const first = `${name}は、${area ? `${area}で開催される` : ''}${kind}です。`;
  const second = date ? `最新の開催回は${date}${venue ? `、${venue}で` : ''}の開催です。` : '';
  return [first, second].filter(Boolean).join('');
}

function festivalFaqItems(editions, lineupsByEdition, artistsById, allArtistsById, name, lang, lineupEdition = editions[0]) {
  const current = lineupEdition;
  if (!current) return [];
  const date = festivalDateText(current, lang);
  const address = String(current.ADDRESS || '').trim();
  const englishAddress = address && !/[\u3040-\u30ff\u3400-\u9fff]/.test(address) ? address : '';
  const venueParts = (lang === 'en'
    ? [editionLocationName(current, 'en'), englishAddress, placeEn(current.PREF)]
    : [editionLocationName(current, lang), address, current.PREF])
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const rows = lineupsByEdition.get(current.EDITION_ID) || [];
  const acts = [...rows]
    .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
    .map((row) => {
      if (isCompositeLineup(row)) return String(row.ACT_LABEL || '').trim();
      const id = lineupArtistIds(row)[0];
      const artist = id ? (artistsById.get(id) || allArtistsById.get(id)) : null;
      return artist ? (lang === 'en' ? (artist.name_en || artist.name) : artist.name) : String(row.ACT_LABEL || '').trim();
    })
    .filter(Boolean);
  const items = [];
  if (date) items.push(lang === 'en'
    ? { question: `When is ${name} held?`, answer: `The latest listed date for ${name} is ${date}.` }
    : { question: `${name}の開催日はいつですか？`, answer: `${name}の最新の開催日は${date}です。` });
  if (venueParts.length) items.push(lang === 'en'
    ? { question: `Where is ${name} held?`, answer: `${name} is held at ${venueParts.join(', ')}.` }
    : { question: `${name}の会場はどこですか？`, answer: `${name}の会場は${venueParts.join('、')}です。` });
  if (current.TICKETURL) items.push(lang === 'en'
    ? { question: `Where can I buy tickets for ${name}?`, answer: `Tickets for ${name} are available at ${current.TICKETURL}.`, url: current.TICKETURL }
    : { question: `${name}のチケットはどこで買えますか？`, answer: `${name}のチケットは${current.TICKETURL}で購入できます。`, url: current.TICKETURL });
  if (acts.length) {
    const visibleActs = acts.slice(0, 10);
    const remaining = Math.max(0, acts.length - visibleActs.length);
    items.push(lang === 'en'
      ? { question: `Which artists are playing at ${name}?`, answer: `${name} ${editionIdentifier(current)} lineup: ${visibleActs.join(', ')}${remaining ? ` and ${remaining} more.` : '.'}` }
      : { question: `${name}にはどんなアーティストが出演しますか？`, answer: `${editionIdentifier(current)}年の出演は${visibleActs.join('、')}${remaining ? `ほか${remaining}組` : ''}です。` });
  }
  return items;
}

function festivalFaqHtml(items, lang) {
  if (!items.length) return '';
  const answerHtml = (item) => item.url
    ? esc(item.answer).replace(esc(item.url), `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">${esc(item.url)}</a>`)
    : esc(item.answer);
  return `<section class="festival-faq"><h2>${lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : 'よくある質問'}</h2><dl>${items.map((item) =>
    `<div><dt>${esc(item.question)}</dt><dd>${answerHtml(item)}</dd></div>`
  ).join('')}</dl></section>`;
}

function festivalFaqDetailsHtml(items, lang, artistHeading = false) {
  if (!items.length) return '';
  const answerHtml = (item) => item.url
    ? esc(item.answer).replace(esc(item.url), `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">${esc(item.url)}</a>`)
    : esc(item.answer);
  const heading = artistHeading
    ? '<div class="festival-section-heading"><h2 class="disp">FAQ</h2></div>'
    : `<h2 class="detail-section-label">${lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : 'よくある質問'}</h2>`;
  return `<section class="detail-section festival-faq festival-faq-details">
      ${heading}
      <div class="festival-faq-list">${items.map((item) => `<details>
        <summary>${esc(item.question)}</summary>
        <div class="festival-faq-answer"><p>${answerHtml(item)}</p></div>
      </details>`).join('')}</div>
    </section>`;
}

function faqJsonLd(items) {
  return items.length ? {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: items.map((item) => ({ '@type': 'Question', name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer } })),
  } : null;
}

function venueFaqItems(v, venueName, venueFestivals, lang) {
  const access = lang === 'en' ? (v.access_en || v.access) : v.access;
  const hours = lang === 'en' ? (v.hours_en || v.hours) : v.hours;
  const address = String(v.address || '').trim();
  const genres = (Array.isArray(v.genre) ? v.genre : String(v.genre || '').split('/'))
    .map((x) => String(x).trim()).filter(Boolean);
  const items = [];
  if (access) items.push(lang === 'en'
    ? { question: `How do I get to ${venueName}?`, answer: access }
    : { question: `${venueName}へのアクセスは？`, answer: access });
  if (hours) items.push(lang === 'en'
    ? { question: `What are the hours at ${venueName}?`, answer: hours }
    : { question: `${venueName}の営業時間は？`, answer: hours });
  if (genres.length) items.push(lang === 'en'
    ? { question: `What genres are played at ${venueName}?`, answer: genres.join(' / ') }
    : { question: `${venueName}ではどんなジャンルが流れる？`, answer: genres.join('／') });
  if (address) items.push(lang === 'en'
    ? { question: `What is the address of ${venueName}?`, answer: address }
    : { question: `${venueName}の住所は？`, answer: address });
  const upcoming = venueFestivals.filter((x) => x.upcoming && x.latest);
  if (upcoming.length) {
    const answer = upcoming.map(({ festival, latest }) => {
      const festivalName = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
      return `${festivalName} (${festivalDateText(latest, lang) || String(latest.DATE_START || '')})`;
    }).join(lang === 'en' ? ', ' : '、');
    items.push(lang === 'en'
      ? { question: `What festivals and events are scheduled at ${venueName}?`, answer }
      : { question: `${venueName}で開催予定のフェス・イベントは？`, answer });
  }
  return items;
}

function artistFaqItems(name, a, nearest, pastByFestival, lang) {
  const items = [];
  if (nearest) {
    const festivalName = lang === 'en' ? (nearest.festival.name_en || nearest.festival.name) : nearest.festival.name;
    const place = editionLocationName(nearest.edition, lang);
    const date = festivalDateText(nearest.edition, lang) || String(nearest.edition.DATE_START || '');
    items.push(lang === 'en'
      ? { question: `When is ${name}'s next appearance?`, answer: `${date} at ${festivalName}${place ? ` (${place})` : ''}` }
      : { question: `${name}の次の出演はいつ？`, answer: `${date}の${festivalName}${place ? `（${place}）` : ''}` });
  }
  const city = String(a.city || '').trim();
  const country = String(a.country || '').trim();
  if (city || country) items.push(lang === 'en'
    ? { question: `Where is ${name} based?`, answer: [city, country].filter(Boolean).join(', ') }
    : { question: `${name}の拠点は？`, answer: [city, country].filter(Boolean).join('、') });
  if (pastByFestival.size) {
    const answer = [...pastByFestival.values()].slice(0, 5).map(({ festival, editions }) => {
      const label = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
      const years = [...new Set(editions.map((ed) => editionLabel(editionIdentifier(ed))))].join('・');
      return `${label} ${years}`;
    }).join(lang === 'en' ? ', ' : '、');
    items.push(lang === 'en'
      ? { question: `What festivals has ${name} played?`, answer }
      : { question: `${name}はどんなフェスに出演している？`, answer });
  }
  return items;
}

function festivalEditionsTimelineHtml(editions, lang) {
  if (editions.length < 2) return '';
  const rows = editions.map((ed, index) => `<tr class="edition-timeline-row reveal" style="transition-delay:${index * 100}ms">
        <th class="edition-year" scope="row">${esc(editionLabel(editionIdentifier(ed)) || ed.EDITION_ID)}</th>
        <td class="edition-date">${editionDateHtml(ed, lang)}</td>
        <td class="edition-place">${esc(editionPlace(ed, lang) || '—')}</td>
      </tr>`).join('');
  return `<section class="detail-section festival-editions-history">
      <h2 class="detail-section-label">${lang === 'en' ? 'PAST EDITIONS' : '開催ヒストリー'}</h2>
      <div class="editions-timeline-wrap"><table class="editions-timeline">
        <caption>${lang === 'en' ? 'Festival edition history' : 'フェスティバル開催履歴'}</caption>
        <thead><tr>
          <th scope="col">${lang === 'en' ? 'EDITION' : '開催回'}</th>
          <th scope="col">${lang === 'en' ? 'DATES' : '日程'}</th>
          <th scope="col">${lang === 'en' ? 'VENUE' : '会場'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>`;
}

function festivalLineupGroupsHtml(editions, lineupsByEdition, artistsById, allArtistsById, lang) {
  const groups = editions.map((ed) => ({ ed, rows: lineupsByEdition.get(ed.EDITION_ID) || [] }))
    .filter((group) => group.rows.length);
  return groups.map(({ ed, rows }) => {
    const slots = [...rows]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
      .map((row, index) => {
        const number = String(index + 1).padStart(2, '0');
        const image = lineupArtistImageHtml(row, artistsById, allArtistsById);
        const numberHtml = image
          ? `<span class="festival-act-number festival-act-number-image"><span class="festival-act-photo">${image}</span><span class="festival-act-number-label mono">${number}</span></span>`
          : `<span class="festival-act-number mono">${number}</span>`;
        return `<li class="festival-act">${numberHtml}${lineupSlotHtml(row, artistsById, allArtistsById, lang)}</li>`;
      });
    const visible = slots.slice(0, 30).join('');
    const overflow = slots.slice(30);
    const more = overflow.length ? `<details class="lineup-more">
        <summary>${lang === 'en' ? `SHOW ALL ${slots.length} ARTISTS` : `全${slots.length}組を表示`}</summary>
        <ul class="detail-lineup-list">${overflow.join('')}</ul>
      </details>` : '';
    const heading = groups.length > 1 ? `<h3>${esc(editionLabel(editionIdentifier(ed)) || ed.EDITION_ID)}</h3>` : '';
    return `<section class="edition-lineup reveal" data-edition-id="${esc(ed.EDITION_ID)}">${heading}<ul class="detail-lineup-list">${visible}</ul>${more}</section>`;
  }).join('');
}

function festivalRelatedCards(current, lang) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
  const dateStatus = (item) => {
    const parts = String(item.date || '').split('/').map((s) => s.trim()).filter(Boolean);
    const end = parts[1] || parts[0] || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return 'unknown';
    return end >= today ? 'upcoming' : 'past';
  };
  const genres = (item) => (Array.isArray(item.genre) ? item.genre : String(item.genre || '').split('/'))
    .map((genre) => String(genre).trim()).filter(Boolean);
  const currentGenres = genres(current);
  // CITY一致=10点、共通GENRE=1点/ジャンル。従来どおり地域を優先する。
  const candidates = XLINK.fests
    .filter((item) => item.id !== current.id && (item.type || 'festival') === (current.type || 'festival'))
    .map((item) => {
      const sameCity = item.city && current.city && String(item.city).toLowerCase() === String(current.city).toLowerCase();
      const sharedGenres = genres(item).filter((genre) => currentGenres.includes(genre)).length;
      return { item, sameCity, sharedGenres, score: (sameCity ? 10 : 0) + sharedGenres, status: dateStatus(item) };
    })
    .filter(({ sameCity, sharedGenres, status }) => (sameCity || sharedGenres) && status !== 'unknown')
    .sort((a, b) => b.score - a.score || String(a.item.name || '').localeCompare(String(b.item.name || '')))
  // 未来/開催中を優先。現行条件で1件以下なら過去開催で最大4件まで補完する。
  const upcoming = candidates.filter((candidate) => candidate.status === 'upcoming');
  const past = candidates.filter((candidate) => candidate.status === 'past');
  const selected = upcoming.length <= 1
    ? upcoming.concat(past).slice(0, 4)
    : upcoming.slice(0, 4);
  if (!selected.length) return '';
  const prefix = lang === 'en' ? '/en' : '';
  const cards = selected.map(({ item, status }, index) => {
    const name = lang === 'en' ? (item.name_en || item.name) : item.name;
    const img = item.image || item.flyer;
    const pastLabel = status === 'past'
      ? `<span class="related-card-past" style="opacity:.55;font-size:.72em;letter-spacing:.04em">${lang === 'en' ? 'Past event' : '過去の開催'}</span> · `
      : '';
    return `<a class="related-card reveal" style="transition-delay:${index * 100}ms" href="${prefix}/festivals/${encodeURIComponent(item.id)}.html">
        <div class="related-card-img">${img ? `<img ${dimensionAttrs(cardImagePath(img))} src="/${cardImagePath(img)}"${cardSrcsetAttr(img)} alt="${esc(name)}" loading="lazy"${imagePositionStyle(item)}>` : ''}</div>
        <div class="related-card-info">
          <div class="related-card-date">${pastLabel}${esc(item.date || '')}</div>
          <div class="related-card-name">${esc(name)}</div>
          <div class="related-card-loc">${esc(item.city || '')}</div>
        </div>
      </a>`;
  }).join('');
  return `<section class="detail-section related-festivals">
      <h2 class="detail-section-label">RELATED FESTIVALS</h2>
      <div class="related-grid">${cards}</div>
    </section>`;
}

function festivalRelatedCardsForPage(current, lang, allFestivals, editionsByFestival) {
  const today = jstToday();
  const genresOf = (f) => (Array.isArray(f.genre) ? f.genre : String(f.genre || '').split('/'))
    .map((g) => String(g).trim().toLowerCase()).filter(Boolean);
  const currentEdition = latestEdition(editionsByFestival.get(String(current.id)) || []);
  const currentPref = String(currentEdition?.PREF || current.city || '').trim().toLowerCase();
  const currentMonth = String(currentEdition?.DATE_START || '').slice(5, 7);
  const currentGenres = new Set(genresOf(current));
  const ranked = (allFestivals || []).filter((f) => isPublishedFestival(f) && String(f.id) !== String(current.id))
    .map((festival) => {
      const edition = latestEdition(editionsByFestival.get(String(festival.id)) || []);
      const pref = String(edition?.PREF || festival.city || '').trim().toLowerCase();
      const month = String(edition?.DATE_START || '').slice(5, 7);
      const sharedGenre = genresOf(festival).some((g) => currentGenres.has(g));
      const future = !!edition && ISO_DATE.test(String(edition.DATE_START || '')) && String(edition.DATE_END || edition.DATE_START) >= today;
      const group = pref && currentPref && pref === currentPref ? 0 : month && currentMonth && month === currentMonth ? 1 : sharedGenre ? 2 : 3;
      return { festival, edition, group, future };
    })
    .sort((a, b) => a.group - b.group || Number(b.future) - Number(a.future)
      || String(b.edition?.DATE_START || '').localeCompare(String(a.edition?.DATE_START || ''))
      || String(a.festival.name || '').localeCompare(String(b.festival.name || '')))
  const chosen = ranked.slice(0, 6);
  // Keep the preference/month/genre ranking, but add a small deterministic ring
  // so isolated festivals also receive inbound links from nearby detail pages.
  const ringAll = (allFestivals || []).filter(isPublishedFestival).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const currentIndex = ringAll.findIndex((f) => String(f.id) === String(current.id));
  const ring = [1, 2, 3].map((offset) => ringAll[(currentIndex + offset + ringAll.length) % ringAll.length]).filter(Boolean);
  for (const festival of ring) {
    const hit = ranked.find((item) => String(item.festival.id) === String(festival.id));
    if (hit && !chosen.some((item) => String(item.festival.id) === String(festival.id))) {
      chosen.pop();
      chosen.push(hit);
    }
  }
  const candidates = chosen;
  if (!candidates.length) return '';
  const prefix = lang === 'en' ? '/en' : '';
  const cards = candidates.map(({ festival, edition }, index) => {
    const name = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
    const image = festival.image || festival.flyer;
    const date = edition ? festivalShortDateText(edition, lang) : String(festival.date || '').replace(/-/g, '.');
    const region = edition?.PREF || festival.city;
    const place = [edition ? editionLocationName(edition, lang) : localizedValue(festival.location, festival.location_ja, '', lang), lang === 'en' ? placeEn(region) : placeJa(region)].filter(Boolean).join(' · ');
    return `<a class="related-card reveal" style="transition-delay:${index * 100}ms" href="${prefix}/festivals/${encodeURIComponent(festival.id)}.html">
      <div class="related-card-img">${image ? `<img ${dimensionAttrs(cardImagePath(image))} src="/${cardImagePath(image)}"${relatedFestivalSrcsetAttr(image)} alt="${esc(name)}" loading="lazy"${imagePositionStyle(festival)}>` : ''}</div>
      <div class="related-card-info"><div class="related-card-date">${esc(date)}</div><div class="related-card-name">${esc(name)}</div><div class="related-card-loc">${esc(place)}</div></div>
    </a>`;
  }).join('');
  return `<section class="detail-section related-festivals festival-more-festivals"><div class="festival-section-heading"><h2 class="disp">More festivals</h2><a class="mono" href="${prefix}/festivals.html">Full index →</a></div><div class="related-grid">${cards}</div></section>`;
}

// 記事ページでも使う共有ボタン markup。
function festivalShareButtons(name, canonical, lang) {
  const title = encodeURIComponent(`${name} — TECHNO JAPAN`);
  const url = encodeURIComponent(canonical);
  const label = lang === 'en' ? 'Share' : '共有';
  return `<div class="share-buttons">
      <span class="share-buttons-label">SHARE</span>
      <a class="share-btn" href="https://twitter.com/intent/tweet?text=${title}&url=${url}" target="_blank" rel="noopener" aria-label="${label}: X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg></a>
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener" aria-label="${label}: Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.673 3.667h-3.246v7.98z"></path></svg></a>
      <a class="share-btn" href="https://social-plugins.line.me/lineit/share?url=${url}" target="_blank" rel="noopener" aria-label="${label}: LINE"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.275.091-.52-.008-.709-.219l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.254-.09.51.001.689.221l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zM9.769 8.108v4.771c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63zm-2.466 5.4H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"></path></svg></a>
      <button class="share-btn share-copy-btn" type="button" data-copy-url="${esc(canonical)}" aria-label="${lang === 'en' ? 'Copy URL' : 'URLをコピー'}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h11v14H8zM5 17H3V3h12v2"></path></svg>
      </button>
    </div>`;
}

const FESTIVAL_SHARE_SCRIPT = `
<script>
document.querySelectorAll('.share-copy-btn').forEach(function(button) {
  button.addEventListener('click', function() {
    navigator.clipboard.writeText(button.dataset.copyUrl).then(function() {
      button.classList.add('copied');
      window.setTimeout(function() { button.classList.remove('copied'); }, 1500);
    });
  });
});
</script>`;

function festivalHeroDateHtml(edition, lang = 'ja', ended = false) {
  const start = String(edition?.DATE_START || '');
  const end = String(edition?.DATE_END || '');
  if (!ISO_DATE.test(start)) return ended ? `<span class="festival-ended-label">${lang === 'en' ? 'ENDED' : '終了'}</span>` : '';
  const label = ended ? `<span class="festival-ended-label">${lang === 'en' ? 'ENDED' : '終了'}</span>` : '';
  const withLabel = (date) => `<span class="detail-date-text">${date}</span>${label}`;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const parts = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day, monthName: months[month - 1] };
  };
  const first = parts(start);
  if (!ISO_DATE.test(end) || end === start) {
    return withLabel(`<time datetime="${start}">${first.monthName} ${first.day}, ${first.year}</time>`);
  }
  const last = parts(end);
  if (first.year === last.year && first.month === last.month) {
    return withLabel(`<time datetime="${start}">${first.monthName} ${first.day}</time> — <time datetime="${end}">${last.day}, ${last.year}</time>`);
  }
  if (first.year === last.year) {
    return withLabel(`<time datetime="${start}">${first.monthName} ${first.day}</time> — <time datetime="${end}">${last.monthName} ${last.day}, ${last.year}</time>`);
  }
  return withLabel(`<time datetime="${start}">${first.monthName} ${first.day}, ${first.year}</time> — <time datetime="${end}">${last.monthName} ${last.day}, ${last.year}</time>`);
}

function festivalShortDateText(edition, lang = 'ja') {
  const start = String(edition?.DATE_START || '');
  const end = String(edition?.DATE_END || '');
  if (!ISO_DATE.test(start)) return '';
  const [, startMonth, startDay] = start.split('-').map(Number);
  const formatMonth = (month) => lang === 'en'
    ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]
    : String(month);
  if (!ISO_DATE.test(end) || end === start) return `${formatMonth(startMonth)}.${startDay}`;
  const [, endMonth, endDay] = end.split('-').map(Number);
  if (startMonth === endMonth) return `${formatMonth(startMonth)}.${startDay}–${endDay}`;
  return `${formatMonth(startMonth)}.${startDay}–${formatMonth(endMonth)}.${endDay}`;
}

const FESTIVAL_TABS_SCRIPT = `
<script>
(function() {
  'use strict';
  var root = document.querySelector('.festival-detail-page');
  if (!root) return;
  var buttons = Array.prototype.slice.call(root.querySelectorAll('[data-festival-tab]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-festival-panel]'));
  var valid = buttons.map(function(button) { return button.getAttribute('data-festival-tab'); });
  if (!buttons.length || !panels.length) return;
  function apply(tab, writeHash) {
    if (valid.indexOf(tab) < 0) tab = 'overview';
    root.classList.add('festival-tabs-ready');
    buttons.forEach(function(button) {
      var selected = button.getAttribute('data-festival-tab') === tab;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.setAttribute('tabindex', selected ? '0' : '-1');
      button.classList.toggle('is-active', selected);
    });
    panels.forEach(function(panel) {
      var active = panel.getAttribute('data-festival-panel') === tab;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    if (writeHash && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', tab === 'overview' ? window.location.pathname + window.location.search : '#' + tab);
    }
    if (writeHash && tab !== 'overview') {
      document.dispatchEvent(new CustomEvent('tj:festival-section', { detail: { section: tab } }));
    }
  }
  buttons.forEach(function(button) {
    button.addEventListener('click', function() { apply(button.getAttribute('data-festival-tab'), true); });
    button.addEventListener('keydown', function(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      var current = buttons.indexOf(button);
      var offset = event.key === 'ArrowRight' ? 1 : -1;
      var next = buttons[(current + offset + buttons.length) % buttons.length];
      next.focus();
      apply(next.getAttribute('data-festival-tab'), true);
    });
  });
  window.addEventListener('hashchange', function() { apply(window.location.hash.slice(1), false); });
  apply(window.location.hash.slice(1), false);
})();
</script>`;

function festivalPageV2Body({ f, editions, lineupsByEdition, artistsById, allArtistsById, lang, name, canonical, summary, faqItems, relatedHtml, relatedArticles, lineupEdition, ended, endedNotice, allFestivals, editionsByFestival, modified }) {
  const prefix = lang === 'en' ? '/en' : '';
  const hubHref = `${prefix}/festivals.html`;
  const currentEdition = lineupEdition || editions[0];
  const dateHtml = festivalHeroDateHtml(currentEdition, lang, ended);
  const locationName = currentEdition
    ? editionLocationName(currentEdition, lang)
    : localizedValue(f.location, f.location_ja, '', lang);
  const locationRegion = lang === 'en' ? placeEn(currentEdition?.PREF || f.city) : placeJa(currentEdition?.PREF || f.city);
  const locationParts = [locationName, locationRegion].filter(Boolean);
  const location = locationParts.filter((part, index) => index === 0 || !String(locationParts[0]).toLowerCase().includes(String(part).toLowerCase())).join(' · ');
  const hasGeo = !!String(currentEdition?.LAT || '').trim() && !!String(currentEdition?.LNG || '').trim()
    && Number.isFinite(Number(currentEdition.LAT)) && Number.isFinite(Number(currentEdition.LNG));
  const mapQuery = hasGeo
    ? `${Number(currentEdition.LAT)},${Number(currentEdition.LNG)}`
    : [locationName, locationRegion].filter(Boolean).join(' ');
  const mapUrl = mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}` : '';
  const genres = (Array.isArray(f.genre) ? f.genre : String(f.genre || '').split('/'))
    .map((genre) => String(genre).trim()).filter(Boolean);
  const heroImage = f.image || f.flyer;
  const featureStory = [...(relatedArticles || [])].sort((a, b) => String(b.publishedAt || b.date || '').localeCompare(String(a.publishedAt || a.date || '')))[0];
  const featureStoryTitle = featureStory ? stripTitleMarkdown(lang === 'en' ? (featureStory.title_en || featureStory.title) : featureStory.title) : '';
  const featureStoryTitleParts = splitArticleTitle(featureStoryTitle);
  const festivalSubText = (text) => lang === 'ja' ? clauseBreaks(text) : esc(text);
  const heroSub = featureStoryTitleParts.sub
    ? `<p class="festival-hero-sub">${festivalSubText(featureStoryTitleParts.sub)}</p>`
    : '';
  const heroHtml = heroImage ? `<div class="detail-hero-image">
        <img ${dimensionAttrs(heroImage)} src="/${String(heroImage).replace(/^\//, '')}"${heroSrcsetAttr(heroImage, festivalHeroSizes(heroImage))} alt="${esc(name)}" fetchpriority="high" decoding="async"${imagePositionStyle(f)}>
      </div>` : '<div class="detail-hero-image detail-hero-gradient" aria-hidden="true"></div>';
  const official = f.url
    ? `<a class="btn festival-official-link" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">Official site ↗</a>`
    : '';
  const tickets = currentEdition?.TICKETURL
    ? `<a class="btn2 festival-ticket-link" href="${esc(safeUrl(currentEdition.TICKETURL))}" target="_blank" rel="noopener">Tickets</a>`
    : '';
  const instagram = f.instagram
    ? `<a class="btn2 festival-social-link" href="${esc(safeUrl(f.instagram))}" target="_blank" rel="noopener" aria-label="Instagram">Instagram</a>`
    : '';
  const lineupRows = currentEdition ? (lineupsByEdition.get(currentEdition.EDITION_ID) || []) : [];
  const lineupCount = lineupRows.length;
  const firstYear = editions.map((edition) => editionKeyParts(editionIdentifier(edition)).year).filter(Boolean).sort((a, b) => a - b)[0] || '';
  const flyerPick = pickFlyer(f, currentEdition);
  const flyerAlt = flyerPick.edition ? `${name} ${flyerPick.edition} Flyer` : `${name} Flyer`;
  const flyer = flyerPick.src ? `<div class="detail-flyer-col">
        <div class="mono red festival-overview-label">Flyer</div>
        <div class="detail-flyer-image"><img ${dimensionAttrs(flyerPick.src)} src="/${String(flyerPick.src).replace(/^\//, '')}"${flyerSrcsetAttr(flyerPick.src)} alt="${esc(flyerAlt)}" loading="lazy"></div>
      </div>` : '';
  const lineupGroups = festivalLineupGroupsHtml(currentEdition ? [currentEdition] : [], lineupsByEdition, artistsById, allArtistsById, lang);
  const pastEditions = currentEdition ? editions.filter((edition) => edition.EDITION_ID !== currentEdition.EDITION_ID) : editions;
  const pastLineupGroups = festivalLineupGroupsHtml(pastEditions, lineupsByEdition, artistsById, allArtistsById, lang);
  const historyHtml = festivalEditionsTimelineHtml(editions, lang);
  const faqDetailsHtml = festivalFaqDetailsHtml(faqItems, lang);
  const shareHtml = `<section class="festival-share-section">${festivalShareButtons(name, canonical, lang)}</section>`;
  const hasDescription = !!String(f.desc || f.desc_en || '').trim();
  const description = hasDescription ? bilingualBody(f.desc, f.desc_en, lang, 'festival-description-inline') : '';
  const overviewDescription = description || (summary ? `<p class="festival-summary">${esc(summary)}</p>` : '');
  const featureStoryHref = featureStory ? `${lang === 'en' ? '/en' : ''}/articles/${featureStory.id}.html` : '';
  const featureStoryHtml = featureStory ? `<a class="festival-feature-story" href="${featureStoryHref}">
        <span class="mono red">Feature story</span>
        ${featureStory.image ? (() => { const image = articleWideImagePath(featureStory.image, featureStory.imagePosition); return `<img ${dimensionAttrs(image)} src="/${image}"${articleWideSrcsetAttr(featureStory.image, featureStory.imagePosition, '(max-width: 900px) calc(100vw - 32px), 520px')} alt="" loading="lazy" decoding="async">`; })() : ''}
        <span class="festival-feature-story-title">${esc(featureStoryTitleParts.short)}</span>${featureStoryTitleParts.sub ? `<span class="festival-feature-story-sub">${festivalSubText(featureStoryTitleParts.sub)}</span>` : ''}
        <span class="mono red">Read →</span>
      </a>` : '';
  const actionButtons = [official, tickets,
    `<button class="btn2 festival-save" type="button" data-festival-save="${esc(f.id)}" aria-pressed="false">Save</button>`,
    instagram].filter(Boolean).join('');
  const shortDate = festivalShortDateText(currentEdition, lang) || String(f.date || '').replace(/-/g, '.');
  const statusLabel = ended ? 'ARCHIVE' : 'UPCOMING';
  const statusClass = ended ? '' : 'red';
  const typeLabel = f.type === 'rave' ? 'RAVE' : 'FESTIVAL';
  const locationMapHtml = mapUrl
    ? `<a class="festival-map" href="${esc(safeUrl(mapUrl))}" target="_blank" rel="noopener"><span class="festival-map-dot" aria-hidden="true"></span><span class="mono">Google Maps ↗</span></a>`
    : `<div class="festival-map"><span class="festival-map-dot" aria-hidden="true"></span></div>`;
  const currentLineupPanel = `<section class="festival-tab-panel festival-program-section" id="lineup" data-festival-panel="lineup" role="tabpanel" aria-labelledby="festival-tab-lineup">
      <div class="festival-panel-heading"><h2 class="disp">Lineup</h2><span class="mono">${esc(editionLabel(editionIdentifier(currentEdition)) || '')}</span></div>
      ${lineupGroups || `<p class="festival-empty mono">${lang === 'en' ? 'Lineup information is not available.' : '出演者情報はありません。'}</p>`}
    </section>`;
  const editionsPanel = `<section class="festival-tab-panel festival-editions-v2" id="editions" data-festival-panel="editions" role="tabpanel" aria-labelledby="festival-tab-editions">
      <div class="festival-panel-heading"><h2 class="disp">Editions</h2><span class="mono">${editions.length} ${lang === 'en' ? 'indexed' : '開催回'}</span></div>
      <div class="festival-edition-rows">${editions.map((edition) => {
        const editionStatus = String(edition.STATUS || '').trim().toLowerCase();
        const editionEnded = editionStatus === 'finished' || (ISO_DATE.test(String(edition.DATE_END || edition.DATE_START || '')) && String(edition.DATE_END || edition.DATE_START) < jstToday());
        const place = editionPlace(edition, lang);
        return `<div class="festival-edition-row"><span class="disp festival-edition-year">${esc(editionLabel(editionIdentifier(edition)) || edition.EDITION_ID)}</span><span class="festival-edition-name">${esc(name)} ${esc(editionLabel(editionIdentifier(edition)) || '')}</span><span class="festival-edition-place">${esc(place || '—')}</span><span class="mono ${editionEnded ? '' : 'red'}">${editionEnded ? 'ARCHIVE' : 'UPCOMING'}</span></div>`;
      }).join('')}</div>
      ${pastLineupGroups ? `<div class="festival-past-lineups"><h3 class="mono red">${lang === 'en' ? 'Past lineups' : '過去の出演者'}</h3>${pastLineupGroups}</div>` : ''}
      ${historyHtml || ''}
    </section>`;
  const storiesPanel = relatedHtml ? `<section class="festival-tab-panel festival-stories-panel" id="stories" data-festival-panel="stories" role="tabpanel" aria-labelledby="festival-tab-stories"><div class="festival-panel-heading"><h2 class="disp">Stories</h2><span class="mono">${relatedArticles.length}</span></div>${relatedHtml}</section>` : '';

  return `<article class="festival-detail-page festival-design-v2">
  <div class="festival-detail-inner">
    <header class="festival-detail-hero">
      ${heroHtml}
      <div class="festival-hero-fav" data-festival-fav="${esc(f.id)}"></div>
      <div class="festival-hero-overlay"><div class="wrap">
        <div class="festival-hero-meta"><span class="pill">${typeLabel}</span><span class="mono ${statusClass}">${statusLabel}${editionLabel(editionIdentifier(currentEdition)) ? ` · ${esc(editionLabel(editionIdentifier(currentEdition)))}` : ''}</span></div>
        <h1 class="disp festival-hero-title">${esc(name)}</h1>${heroSub}
      </div></div>
    </header>

    <div class="wrap festival-content">
      <section class="festival-facts facts" aria-label="Festival facts">
        <div class="fact"><span class="mono">Date</span><span class="disp fact-big fact-date">${esc(shortDate)}</span><span class="mono">${esc(String(currentEdition?.DATE_START || '').slice(0, 4))}</span></div>
        <div class="fact"><span class="mono">Location</span><b>${locationName ? clauseBreaks(locationName) : '—'}</b>${mapUrl ? `<a class="mono red" href="${esc(safeUrl(mapUrl))}" target="_blank" rel="noopener">Map ↗</a>` : ''}</div>
        <div class="fact"><span class="mono">Prefecture</span><b>${esc(locationRegion || '—')}</b><span class="mono">Japan</span></div>
        <div class="fact"><span class="mono">Genre</span><b>${esc(genres.join(' / ') || '—')}</b></div>
        <div class="fact"><span class="mono">Lineup</span><span class="disp fact-big">${lineupCount}</span><span class="mono">artists</span></div>
        <div class="fact"><span class="mono">Editions</span><span class="disp fact-big">${editions.length}</span><span class="mono">since ${esc(String(firstYear || '—'))}</span></div>
      </section>

      ${endedNotice ? `<p class="festival-ended-notice mono">${esc(endedNotice)}</p>` : ''}
      <div class="festival-actions"><div class="festival-action-buttons">${actionButtons}</div>${relatedArticles.length ? `<span class="mono festival-shared">Shared by ${relatedArticles.length} ${relatedArticles.length === 1 ? 'story' : 'stories'} on Techno Japan</span>` : ''}</div>

      <nav class="tabs festival-tabs" role="tablist" aria-label="Festival details">
        <button class="tab is-active" id="festival-tab-overview" type="button" role="tab" data-festival-tab="overview" aria-controls="overview" aria-selected="true" tabindex="0">Overview</button>
        <button class="tab" id="festival-tab-lineup" type="button" role="tab" data-festival-tab="lineup" aria-controls="lineup" aria-selected="false" tabindex="-1">Lineup</button>
        <button class="tab" id="festival-tab-editions" type="button" role="tab" data-festival-tab="editions" aria-controls="editions" aria-selected="false" tabindex="-1">Editions</button>
        ${relatedHtml ? '<button class="tab" id="festival-tab-stories" type="button" role="tab" data-festival-tab="stories" aria-controls="stories" aria-selected="false" tabindex="-1">Stories</button>' : ''}
      </nav>

      <section class="festival-tab-panel festival-overview-panel" id="overview" data-festival-panel="overview" role="tabpanel" aria-labelledby="festival-tab-overview">
        <div class="festival-overview-grid">
          <div class="festival-overview-copy">${overviewDescription}${flyer ? `<div class="festival-flyer-wrap">${flyer}</div>` : ''}</div>
          <aside class="festival-access"><div class="festival-panel-heading"><h2 class="mono red">Access</h2></div>${locationMapHtml}<span class="mono">${esc(location || '—')}</span>${featureStoryHtml}</aside>
        </div>
        ${faqDetailsHtml || ''}
      </section>
      ${currentLineupPanel}
      ${editionsPanel}
      ${storiesPanel}
    </div>

    <div class="wrap festival-lower-content">
      ${shareHtml}
      ${festivalRelatedCardsForPage(f, lang, allFestivals, editionsByFestival)}
      ${updatedLabel(modified, lang)}
      <div class="article-footer"><a class="detail-back" href="${hubHref}" data-festival-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> BACK TO FESTIVALS</a></div>
    </div>
  </div>
</article>`;
}

function festivalPage(f, festivalEditions, lineupsByEdition, artistsById, allArtistsById, articles, allFestivals = [], editionsByFestival = new Map(), lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/festivals/${f.id}.html`;
  const name = lang === 'en' ? (f.name_en || f.name) : f.name;
  const nameJa = String(f.name_ja || '').trim();
  const seoName = lang === 'ja' && nameJa && nameJa !== name ? `${name}（${nameJa}）` : name;
  const bodyDesc = lang === 'en' ? (f.desc_en || f.desc) : (f.desc || f.desc_en);
  const canonical = `${BASE}${prefix}/festivals/${f.id}.html`;
  const desc = bodyDesc || (lang === 'en'
    ? `${name} — edition history and information for a techno / house festival in Japan.`
    : `${name}の開催履歴・基本情報。日本のテクノ／ハウスのフェスティバル情報。`);
  const image = absUrl(f.image || f.flyer);

  // このフェスに紐づく記事（ARTICLES.festivalId で関連付け）
  const related = (articles || []).filter((a) => a.festivalId === f.id && a.status !== 'draft');
  const relatedHtml = related.length
    ? relatedStoryCardsHtml(related, lang, { forceEnglishPath: true, compactDate: true, wide: true, heading: 'Stories', clauseBreakSub: true })
    : '';

  const editions = [...festivalEditions].sort((a, b) => {
    const ap = editionKeyParts(editionIdentifier(a)), bp = editionKeyParts(editionIdentifier(b));
    return bp.year - ap.year || bp.seq - ap.seq || String(b.DATE_START || '').localeCompare(String(a.DATE_START || ''));
  });
  const modified = contentDate('festival', f.id, CONTENT_SNAPSHOTS.get(`festival:${f.id}`));
  const latestEdition = editions[0];
  const ended = isEndedFestival(editions);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lineupEdition = editions.find((ed) => {
    const end = String(ed.DATE_END || ed.DATE_START || '');
    return ISO_DATE.test(end) && new Date(`${end}T23:59:59`) >= today;
  }) || latestEdition;
  const currentEdition = lineupEdition;
  const lineupRows = lineupEdition ? (lineupsByEdition.get(lineupEdition.EDITION_ID) || []) : [];
  const lineupActs = lineupRows.map((row) => {
    if (isCompositeLineup(row)) return String(row.ACT_LABEL || '').trim();
    const id = lineupArtistIds(row)[0];
    const artist = id ? artistsById.get(id) : null;
    return artist ? (lang === 'en' ? (artist.name_en || artist.name) : artist.name) : String(row.ACT_LABEL || '').trim();
  }).filter(Boolean);
  const lineupCount = lineupRows.length;
  const hasLineup = lineupCount >= 3;
  const year = String(currentEdition?.EDITION || '').match(/^\d{4}/)?.[0] || '';
  const prefRaw = currentEdition?.PREF || f.city || '';
  const pref = lang === 'en' ? placeEn(prefRaw) : placeJa(prefRaw);
  const festivalTypeJa = f.type === 'rave' ? 'テクノ・レイヴ' : 'テクノ・野外フェス';
  const festivalTypeEn = f.type === 'rave' ? 'Rave' : 'Festival';
  const nameYear = `${seoName}${year ? ` ${year}` : ''}`;
  /* 指名検索（フェス名＋年）に「日程・出演者・チケット」で応える。長い名前では
     種別を先に削り、日程・チケットと地名は最後まで残す。 */
  const titleName = nameJa || name;
  const titleNameYear = `${titleName}${year ? ` ${year}` : ''}`;
  const jaCandidates = ended ? [
    `${seoName}｜次回開催情報・過去の出演者（${pref || '日本'}）— TECHNO JAPAN`,
    `${seoName}｜次回開催情報・過去の出演者 — TECHNO JAPAN`,
  ] : [
    ...(hasLineup ? [
    `${titleNameYear}｜出演者・日程・チケット（${pref || '日本'}）— TECHNO JAPAN`,
      `${titleNameYear}｜出演者・日程・チケット — TECHNO JAPAN`,
    ] : []),
    `${titleNameYear}｜${pref || '日本'}の${festivalTypeJa} 日程・チケット — TECHNO JAPAN`,
    `${titleNameYear}｜${pref || '日本'}の${festivalTypeJa} — TECHNO JAPAN`,
    `${titleNameYear}｜${pref || '日本'} 日程・チケット — TECHNO JAPAN`,
  ];
  const enCandidates = ended ? [
    `${name} — Next Edition & Past Lineups | TECHNO JAPAN`,
    `${name} — Next Edition | TECHNO JAPAN`,
    `${name} | TECHNO JAPAN`,
  ] : [
    ...(hasLineup ? [`${nameYear} — Lineup, Dates & Tickets (${pref || 'Japan'}) | TECHNO JAPAN`] : []),
    `${nameYear} — Lineup, Dates & Tickets | TECHNO JAPAN`,
    `${nameYear} | TECHNO JAPAN`,
  ];
  const title = lang === 'en'
    ? truncate(enCandidates.find((t) => t.length <= 65) || enCandidates[enCandidates.length - 1], 65)
    : truncate(jaCandidates.find((t) => t.length <= 60) || jaCandidates[jaCandidates.length - 1], 60);
  const editionDate = currentEdition
    ? (lang === 'en'
        ? fmtMetaDateEn(currentEdition.DATE_START, currentEdition.DATE_END)
        : fmtMetaDateJa(currentEdition.DATE_START, currentEdition.DATE_END))
    : '';
  const editionLocation = currentEdition ? editionLocationName(currentEdition, lang) : '';
  const metaLead = ended && editionDate && editionLocation
    ? (lang === 'en'
        ? `${name} has been held in ${pref || 'Japan'}. The latest edition was held in ${editionDate} at ${editionLocation}. `
        : `${seoName}は${pref || '日本'}で開催されてきた${festivalTypeJa}。直近は${editionDate}に${editionLocation}で開催。`)
    : editionDate && editionLocation
    ? (lang === 'en'
        ? (hasLineup
            ? `${editionDate}, ${editionLocation} (${pref || 'Japan'}). Lineup: ${lineupActs.slice(0, 5).join(', ')}${Math.max(0, lineupCount - 5) ? ` and ${Math.max(0, lineupCount - 5)} more.` : '.'}`
            : `${editionDate} at ${editionLocation}, ${pref || 'Japan'}. `)
        : (hasLineup
            ? `${seoName} ${year}は${editionDate}、${editionLocation}（${pref || '日本'}）で開催。出演は${lineupActs.slice(0, 5).join('、')}${Math.max(0, lineupCount - 5) ? `ほか${Math.max(0, lineupCount - 5)}組` : ''}。`
            : `${editionDate}、${editionLocation}（${pref || '日本'}）で開催。`))
    : '';
  const metaFallback = lang === 'en'
    ? `${name} — edition history and information for a techno / house festival in Japan.`
    : `${name}の開催履歴・基本情報。日本のテクノ／ハウスのフェスティバル情報。`;
  const metaDescSource = ended
    ? `${metaLead}${bodyDesc || metaFallback}`
    : hasLineup
    ? `${metaLead}${bodyDesc || metaFallback}`
    : (lang === 'ja' && seoName !== name
      ? `${seoName}は、${editionDate && editionLocation ? `${editionDate}、${editionLocation}（${pref || '日本'}）で開催。` : ''}${bodyDesc || '開催履歴・基本情報。日本のテクノ／ハウスのフェスティバル情報。'}`
      : `${metaLead}${bodyDesc || metaFallback}`);
  const metaDesc = truncate(metaDescSource, hasLineup ? 120 : 160);
  const summary = festivalSummary(f, currentEdition, name, lang);
  const faqItems = festivalFaqItems(editions, lineupsByEdition, artistsById, allArtistsById, seoName, lang, lineupEdition);
  const performers = dedupePerformers(
    editions.flatMap((ed) => lineupsByEdition.get(ed.EDITION_ID) || [])
    .map((row) => lineupPerformerLd(row, artistsById, allArtistsById, lang)).filter(Boolean));
  const sameAs = [f.url, f.instagram]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  /* 親の Festival ノードにも startDate / location を持たせる。

     日付・会場は開催回（subEvent）にだけ書く設計だったが、Google は
     親ノードを独立した Event アイテムとして評価するため、親が
     「startDate なし / location なし」の**無効アイテム**として
     Search Console に積まれていた（2026-08-27 実測: 無効14件。
     subEvent 側は有効12件と別勘定。クロールが進めば全フェスに広がる）。

     値は開催回があれば最新回（editions[0]）から、無ければ FESTIVALS の
     date（"開始/終了" の範囲形式）と location / address / lat / lng から取る。
     どちらも無いフェスは従来どおり出さない（嘘の値は書かない）。 */
  const parentDates = (() => {
    if (currentEdition) {
      return {
        ...(ISO_DATE.test(String(currentEdition.DATE_START || '')) ? { startDate: currentEdition.DATE_START } : {}),
        endDate: ISO_DATE.test(String(currentEdition.DATE_END || '')) ? currentEdition.DATE_END : currentEdition.DATE_START,
      };
    }
    const [ds, de] = String(f.date || '').split('/');
    return {
      ...(ISO_DATE.test(String(ds || '')) ? { startDate: ds } : {}),
      ...(ISO_DATE.test(String(de || '')) ? { endDate: de } : (ISO_DATE.test(String(ds || '')) ? { endDate: ds } : {})),
    };
  })();
  const parentLocation = currentEdition
    ? editionLocationLd(currentEdition, lang)
    : ((f.location || f.city) ? {
        '@type': 'Place',
        name: localizedValue(f.location, f.location_ja, '', lang) || f.city || 'Japan',
        address: {
          '@type': 'PostalAddress',
          addressRegion: f.city || '',
          addressCountry: 'JP',
          ...(f.address ? { streetAddress: f.address } : {}),
        },
        ...(f.lat && f.lng ? { geo: { '@type': 'GeoCoordinates', latitude: f.lat, longitude: f.lng } } : {}),
      } : null);
  const parentTicketUrl = [currentEdition?.TICKETURL, f.ticketUrl, f.ticket_url, f.tickets]
    .map((value) => String(value || '').trim()).find(Boolean) || '';
  const parentOfficialUrl = safeUrl(f.url);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    '@id': `${BASE}/festivals/${encodeURIComponent(f.id)}.html#festival`,
    name: name,
    ...(nameJa && nameJa !== name ? { alternateName: nameJa } : {}),
    description: desc,
    inLanguage: lang,
    image: [image],
    url: canonical,
    ...(modified ? { dateModified: modified } : {}),
    ...parentDates,
    ...(parentLocation ? { location: parentLocation } : {}),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: editionStatusLd(currentEdition?.STATUS) || 'https://schema.org/EventScheduled',
    /* 親ノードにも offers。subEvent だけだと親が「チケット情報なし」の Event として評価される（2026-09-28 GSC/GA4 分析） */
    ...(parentTicketUrl && safeUrl(parentTicketUrl) ? { offers: { '@type': 'Offer', url: safeUrl(parentTicketUrl) } } : {}),
    ...(parentOfficialUrl ? { organizer: { '@type': 'Organization', name, url: parentOfficialUrl } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(performers.length ? { performer: performers } : {}),
    ...(editions.length ? { subEvent: editions.map((ed) => ({
      ...editionEventLd({
        festival: f,
        edition: ed,
        lang,
        idSuffix: `#edition-${encodeURIComponent(ed.EDITION_ID)}`,
        includeUrl: false,
      }),
      ...((lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupPerformerLd(row, artistsById, allArtistsById, lang)).filter(Boolean).length
        ? { performer: (lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupPerformerLd(row, artistsById, allArtistsById, lang)).filter(Boolean) }
        : {}),
      /* image / description は SC で「任意項目なし」警告が各11件出ていた（2026-08-27）。
         開催回に固有の画像・説明は無いので、フェス本体のものを渡す。 */
      image: [image],
      ...(desc ? { description: desc } : {}),
      /* 現地開催であることを明示する。Google / AI 検索が「配信のみ」と
         誤解しないための項目で、無いと Event のリッチリザルトで警告になる。
         このサイトが扱うのは屋外フェスとクラブ公演だけなので、
         全件 Offline で事実として正しい。2026-08-15 追加（AUDIT §9-90）。 */
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      ...(ed.TICKETURL ? { offers: { '@type': 'Offer', url: ed.TICKETURL } } : {}),
    })) } : {}),
  };

  const endedNotice = ended ? (lang === 'en' ? "The next edition hasn't been announced yet. We'll update this page." : '次回の開催は未発表です。決まり次第このページで更新します。') : '';
  const body = festivalPageV2Body({ f, editions, lineupsByEdition, artistsById, allArtistsById, lang, name, canonical, summary, faqItems, relatedHtml, relatedArticles: related, lineupEdition, ended, endedNotice, allFestivals, editionsByFestival, modified });

  const faqLd = faqItems.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null;
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'festivals'] : ['festivals']), `${f.id}.html`), html: page({ title, desc: metaDesc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('FESTIVALS', '/festivals.html', name, canonical), ...(faqLd ? [faqLd] : [])], body, lang, altHref, currentKey: 'festivals', extraScripts: LANG_TOGGLE_SCRIPT + FESTIVAL_HUB_BACK_SCRIPT + FESTIVAL_SHARE_SCRIPT + FESTIVAL_TABS_SCRIPT + `\n<script src="/magazine.js?v=${MAGAZINE_JS_VERSION}"></script>\n<script src="/favorites.js?v=${FAVORITES_JS_VERSION}"></script>\n<script>\n(function() {\n  var buttons = document.querySelectorAll('[data-festival-save]');\n  var mounts = document.querySelectorAll('[data-festival-fav]');\n  var update = function() {\n    buttons.forEach(function(button) {\n      var id = button.getAttribute('data-festival-save');\n      var saved = window.tjFav && window.tjFav.has('festival', id);\n      button.textContent = saved ? 'Saved' : 'Save';\n      button.setAttribute('aria-pressed', saved ? 'true' : 'false');\n    });\n    mounts.forEach(function(mount) {\n      var id = mount.getAttribute('data-festival-fav');\n      var saved = window.tjFav && window.tjFav.has('festival', id);\n      var heart = mount.querySelector('.tj-fav-heart');\n      if (heart) heart.classList.toggle('active', saved);\n    });\n  };\n  mounts.forEach(function(mount) {\n    var id = mount.getAttribute('data-festival-fav');\n    if (window.tjFav) window.tjFav.attachHeart(mount, 'festival', id);\n  });\n  buttons.forEach(function(button) {\n    var id = button.getAttribute('data-festival-save');\n    button.addEventListener('click', function() {\n      if (window.tjFav) window.tjFav.toggle('festival', id);\n      update();\n    });\n  });\n  document.addEventListener('tj-fav-change', update);\n  update();\n})();\n</script>`, backgroundLayer: true }) };
}

/* ---------- アーティストページ ---------- */
const artistEntityId = (id) => `${BASE}/artists/${encodeURIComponent(id)}.html#artist`;
const artistSchemaType = (artist) =>
  String(artist?.schemaType || artist?.schema_type || artist?.SCHEMA_TYPE || 'person').trim().toLowerCase() === 'music-group'
    ? 'MusicGroup'
    : 'Person';
const artistMemberIds = (artist) => {
  const value = artist?.memberIds || artist?.member_ids || artist?.MEMBER_IDS || [];
  return (Array.isArray(value) ? value : String(value).split(','))
    .map((id) => String(id).trim())
    .filter(Boolean);
};

function artistGenres(artist) {
  const values = Array.isArray(artist?.genre) ? artist.genre : String(artist?.genre || '').split(/[\/,]/);
  return values.map((genre) => String(genre).trim()).filter(Boolean);
}

function artistLinkLabel(key) {
  const labels = {
    instagram: 'Instagram',
    soundcloud: 'SoundCloud',
    bandcamp: 'Bandcamp',
    website: 'Website',
  };
  const raw = String(key || '').trim();
  return labels[raw.toLowerCase()] || `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
}

function artistNameClass(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  const longest = Math.max(0, ...words.map((word) => [...word].length));
  if (longest > 16) return ' artist-title-longest';
  if (longest > 10) return ' artist-title-long';
  return '';
}

function artistStableHash(left, right) {
  const value = `${left}\u0000${right}`;
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function artistPage(a, artistsById, lang = 'ja', artistAppearances = new Map(), editionsByFestival = new Map(), articles = []) {
  const hubHref = `${lang === 'en' ? '/en' : ''}/artists.html`;
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/artists/${a.id}.html`;
  const name = lang === 'en' ? (a.name_en || a.name) : a.name;
  const bio = lang === 'en' ? (a.bio_en || a.bio) : (a.bio || a.bio_en);
  const canonical = `${BASE}${prefix}/artists/${a.id}.html`;
  const fromJapan = !a.country || /japan/i.test(String(a.country));
  const appearances = artistAppearances.get(String(a.id)) || [];
  const upcoming = appearances.filter((item) => item.upcoming).sort((x, y) => {
    const xDate = ISO_DATE.test(String(x.edition.DATE_START || '')) ? String(x.edition.DATE_START) : '9999-99-99';
    const yDate = ISO_DATE.test(String(y.edition.DATE_START || '')) ? String(y.edition.DATE_START) : '9999-99-99';
    return xDate.localeCompare(yDate) || String(x.festival.name || '').localeCompare(String(y.festival.name || ''));
  });
  const nearest = upcoming[0] || null;
  const nearestName = nearest ? (lang === 'en' ? (nearest.festival.name_en || nearest.festival.name) : nearest.festival.name) : '';
  const title = lang === 'en'
    ? (() => {
      const candidates = nearest
        ? [`${name} at ${nearestName} — DJ Profile | TECHNO JAPAN`, `${name} — DJ Profile & Festival Appearances | TECHNO JAPAN`, `${name} | TECHNO JAPAN`]
        : [`${name} — DJ Profile & Festival Appearances | TECHNO JAPAN`, `${name} | TECHNO JAPAN`];
      return candidates.find((candidate) => candidate.length <= 65) || candidates[candidates.length - 1];
    })()
    : (() => {
      const candidates = nearestName
        ? [`${name}｜${nearestName}出演・プロフィール — TECHNO JAPAN`, `${name}｜${nearestName}出演・プロフィール`, `${name}｜出演フェス・プロフィール — TECHNO JAPAN`, `${name}｜プロフィール`]
        : [`${name}｜DJ・アーティストのプロフィールと出演フェス — TECHNO JAPAN`, `${name}｜プロフィールと出演フェス — TECHNO JAPAN`, `${name}｜プロフィール`];
      return candidates.find((candidate) => candidate.length <= 60) || candidates[candidates.length - 1];
    })();
  const place = [a.city, a.country].filter(Boolean).join(', ');
  // bioが無い/短い時は、ジャンル・拠点入りのキーワードリッチな定型文にフォールバック
  const bioDesc = bio ? truncate(stripTags(bio), 160) : '';
  const genreTxt = String(a.genre || '').trim();
  const upcomingLead = nearest
    ? (lang === 'en'
      ? `${nearestName} (${fmtMetaDateEn(nearest.edition.DATE_START, nearest.edition.DATE_END) || 'Date TBA'}) — upcoming appearance. `
      : `${nearestName}（${fmtMetaDateJa(nearest.edition.DATE_START, nearest.edition.DATE_END) || '日程未定'}）に出演予定。`)
    : '';
  const desc = bioDesc.length >= 50 ? bioDesc : (lang === 'en'
    ? `${upcomingLead}${name}${place ? ' (' + place + ')' : ''} — ${genreTxt || 'techno / house'} DJ & artist. Profile, links and festival appearances in Japan's underground scene.`
    : `${upcomingLead}${name}${place ? '（' + place + '）' : ''} — ${genreTxt ? genreTxt + 'の' : ''}DJ／アーティスト。プロフィール・SNSリンク・日本のテクノ／ハウスシーンでの出演フェス情報。TECHNO JAPANのアーティスト名鑑。`);
  const image = absUrl(a.image);
  const links = a.links || {};
  const schemaType = artistSchemaType(a);
  const members = schemaType === 'MusicGroup'
    ? artistMemberIds(a).map((id) => artistsById.get(id)).filter(Boolean)
    : [];
  const modified = contentDate('artist', a.id, CONTENT_SNAPSHOTS.get(`artist:${a.id}`));
  const performerIn = upcoming.slice(0, 6)
    .map(({ festival, edition }) => editionEventLd({ festival, edition, lang }))
    .filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': artistEntityId(a.id),
    name: name,
    inLanguage: lang,
    description: desc,
    ...(a.image ? { image: [image] } : {}),
    url: canonical,
    ...(modified ? { dateModified: modified } : {}),
    ...(performerIn.length ? { performerIn } : {}),
    ...(place ? { location: { '@type': 'Place', name: place } } : {}),
    ...(Array.isArray(a.genre) && a.genre.length ? { genre: a.genre } : {}),
    ...(Object.values(links).filter(Boolean).length ? { sameAs: Object.values(links).filter(Boolean) } : {}),
    ...(members.length ? { member: members.map((member) => ({
      '@type': artistSchemaType(member),
      '@id': artistEntityId(member.id),
      name: lang === 'en' ? (member.name_en || member.name) : member.name,
      url: `${BASE}${lang === 'en' ? '/en' : ''}/artists/${encodeURIComponent(member.id)}.html`,
    })) } : {}),
  };

  const genreList = artistGenres(a);
  const genreLine = genreList.join(' / ');
  const localizedCity = lang === 'en' ? placeEn(a.city) : placeJa(a.city);
  const localizedCountry = lang === 'en' ? placeEn(a.country) : placeJa(a.country);
  const basedIn = [localizedCity, localizedCountry].filter(Boolean).join(' · ');
  const linkRow = Object.entries(links)
    .filter(([, value]) => value)
    .map(([key, value]) => `<a class="btn2" href="${esc(safeUrl(value))}" target="_blank" rel="noopener">${esc(artistLinkLabel(key))} ↗</a>`)
    .join('');
  const pastByFestival = new Map();
  for (const item of appearances.filter((entry) => !entry.upcoming)) {
    const key = String(item.festival.id);
    if (!pastByFestival.has(key)) pastByFestival.set(key, { festival: item.festival, editions: [] });
    const group = pastByFestival.get(key);
    const editionKey = String(item.edition.EDITION_ID || editionIdentifier(item.edition));
    if (!group.editions.some((edition) => String(edition.EDITION_ID || editionIdentifier(edition)) === editionKey)) group.editions.push(item.edition);
  }
  const appearanceLocation = (edition) => [
    editionLocationName(edition, lang),
    lang === 'en' ? placeEn(edition.PREF) : placeJa(edition.PREF),
  ].filter(Boolean).join(' · ');
  const appearanceRow = ({ festival, edition, upcoming: isUpcoming, yearLabels = null, editionIds = [] }) => {
    const festivalName = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
    const date = festivalShortDateText(edition, lang) || '—';
    const yearLine = yearLabels || editionLabel(editionIdentifier(edition));
    const ids = editionIds.length ? editionIds : [edition.EDITION_ID || editionIdentifier(edition)];
    return `<a class="artist-appearance-row row" href="${prefix}/festivals/${encodeURIComponent(festival.id)}.html" data-edition-id="${esc(ids.join(','))}" data-date="${esc(String(edition.DATE_START || ''))}" data-status="${isUpcoming ? 'upcoming' : 'archive'}">
      <span class="artist-appearance-date"><span class="disp">${esc(date)}</span><span class="mono">${esc(yearLine || '—')}</span></span>
      <span class="artist-appearance-festival">${esc(festivalName)}</span>
      <span class="artist-appearance-location hide">${esc(appearanceLocation(edition) || '—')}</span>
      <span class="mono${isUpcoming ? ' red' : ''}">${isUpcoming ? 'UPCOMING' : 'ARCHIVE'}</span>
    </a>`;
  };
  const upcomingRows = upcoming.map((item) => appearanceRow(item)).join('');
  const pastGroups = [...pastByFestival.values()]
    .map((group) => ({ ...group, editions: [...group.editions].sort((x, y) => String(y.DATE_START || '').localeCompare(String(x.DATE_START || ''))) }))
    .sort((x, y) => String(y.editions[0]?.DATE_START || '').localeCompare(String(x.editions[0]?.DATE_START || '')));
  const pastRows = pastGroups.map(({ festival, editions }) => {
    const latest = editions[0];
    const years = editions.map((edition) => editionLabel(editionIdentifier(edition))).filter(Boolean).join(' · ');
    const ids = editions.map((edition) => edition.EDITION_ID || editionIdentifier(edition));
    return appearanceRow({ festival, edition: latest, upcoming: false, yearLabels: years, editionIds: ids });
  }).join('');
  const upcomingBlock = upcomingRows ? `\n      <div class="artist-upcoming">${upcomingRows}</div>` : '';
  const pastBlock = pastRows ? `\n      <div class="artist-past">${pastRows}</div>` : '';
  const appearancesHtml = upcoming.length || pastGroups.length
    ? `<section class="artist-appearances">
      <div class="festival-section-heading"><h2 class="disp">Appearances</h2></div>
      <div class="artist-appearance-columns row mono"><span>Date</span><span>Festival</span><span class="hide">Location</span><span>Status</span></div>${upcomingBlock}${pastBlock}
    </section>`
    : '';
  const relatedCandidates = [...artistsById.values()]
    .filter((artist) => String(artist.id) !== String(a.id))
    .map((artist) => {
      const common = genreList.filter((genre) => artistGenres(artist).includes(genre)).length;
      const hasBio = Boolean(stripTags(artist.bio || artist.bio_en));
      const hasPhoto = Boolean(artist.image);
      const sameOrigin = fromJapan === (!artist.country || /japan/i.test(String(artist.country)));
      return { artist, common, hasBio, hasPhoto, sameOrigin, hash: artistStableHash(a.id, artist.id) };
    });
  const relatedComparator = (left, right) => right.common - left.common
    || Number(right.hasBio) - Number(left.hasBio)
    || Number(right.hasPhoto) - Number(left.hasPhoto)
    || Number(right.sameOrigin) - Number(left.sameOrigin)
    || left.hash - right.hash;
  const relatedArtists = [
    ...relatedCandidates.filter((candidate) => candidate.common > 0).sort(relatedComparator),
    ...relatedCandidates.filter((candidate) => candidate.common === 0 && candidate.sameOrigin).sort(relatedComparator),
    ...relatedCandidates.filter((candidate) => candidate.common === 0 && !candidate.sameOrigin).sort(relatedComparator),
  ].slice(0, 5);
  const relatedHeading = genreLine ? `Related · ${genreLine}` : 'Related artists';
  const relatedHtml = relatedArtists.length
    ? `<section class="artist-related-artists">
      <div class="festival-section-heading"><h2 class="disp">${esc(relatedHeading)}</h2><a class="mono" href="${hubHref}">All artists →</a></div>
      <div class="artist-related-grid">${relatedArtists.map(({ artist }) => {
        const relatedName = lang === 'en' ? (artist.name_en || artist.name) : artist.name;
        const relatedGenres = artistGenres(artist).join(' / ');
        const relatedImage = artist.image;
        return `<a class="artist-related-card card" href="${prefix}/artists/${encodeURIComponent(artist.id)}.html">
          <div class="artist-related-image img">${relatedImage ? `<img ${dimensionAttrs(cardImagePath(relatedImage))} src="/${cardImagePath(relatedImage)}"${largeSrcsetAttr(relatedImage, coverSizes(relatedImage, 1, artistRelatedSizes))} alt="${esc(relatedName)}" loading="lazy" decoding="async"${imagePositionStyle(artist)}>` : ''}</div>
          <span class="disp artist-related-name">${esc(relatedName)}</span>
          <span class="mono">${esc(relatedGenres)}</span>
        </a>`;
      }).join('')}</div>
    </section>`
    : '';
  const faqItems = stripTags(a.bio || a.bio_en) && !(!stripTags(a.bio) && !stripTags(a.bio_en))
    ? artistFaqItems(name, a, nearest, pastByFestival, lang) : [];
  const faqHtml = faqItems.length ? festivalFaqDetailsHtml(faqItems, lang, true) : '';
  const faqLd = faqJsonLd(faqItems);
  const artistFestivalIds = appearances.map(({ festival }) => festival.id);
  const artistArticles = (articles || []).filter((article) => String(article.status || '').toLowerCase() !== 'draft' && articleMatchesArtist(article, a, { artistFestivalIds, festivals: XLINK.fests })).slice(0, 3);
  const articlesHtml = artistArticles.length
    ? `<section class="artist-stories">
      <div class="festival-section-heading"><h2 class="disp">Stories</h2><a class="mono" href="${prefix}/news.html">All stories →</a></div>
      ${relatedStoryCardsHtml(artistArticles, lang, { forceEnglishPath: true, compactDate: true, grid: true, heading: '' })}
    </section>`
    : '';
  const bioHtml = bilingualBody(a.bio, a.bio_en, lang, 'artist-bio').replaceAll('class="lang-btn', 'class="lang-btn chip');
  const factsHtml = `<div class="artist-facts facts">
      <div class="fact"><span class="mono">Based in</span><span>${esc(basedIn || '—')}</span></div>
      <div class="fact"><span class="mono">Genre</span><span>${esc(genreLine || '—')}</span></div>
    </div>`;
  const headImage = a.image
    ? `<img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}"${heroSrcsetAttr(a.image, '(max-width: 900px) calc(100vw - 32px), min(510px, 41vw)')} alt="${esc(name)}" fetchpriority="high"${imagePositionStyle(a)}>`
    : '';
  const sectionsHtml = appearancesHtml || relatedHtml || articlesHtml || faqHtml
    ? `\n    ${appearancesHtml}${relatedHtml}${articlesHtml}${faqHtml}`
    : '';

  const body = `<article class="detail-page artist-detail artist-detail-v2">
  <div class="wrap artist-detail-wrap">
    <nav class="artist-breadcrumb mono" aria-label="Breadcrumb"><a href="${hubHref}">Artists</a><span>/</span><span>${esc(name)}</span></nav>
    <section class="artist-head">
      <div class="artist-head-photo img">${headImage}</div>
      <div class="artist-head-copy">
        <h1 class="disp artist-title${artistNameClass(name)}">${esc(name)}</h1>
        ${bioHtml}${linkRow ? `\n        <div class="artist-links">${linkRow}</div>` : ''}
        ${factsHtml}
      </div>
    </section>${sectionsHtml}
    ${updatedLabel(modified, lang)}
    <div class="article-footer artist-footer"><a class="article-back" href="${hubHref}" data-artist-hub-back="${hubHref}"><span class="arrow"></span> ALL ARTISTS</a></div>
  </div>
</article>`;

  const thin = !stripTags(a.bio) && !stripTags(a.bio_en);
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'artists'] : ['artists']), `${a.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd: [jsonLd, breadcrumbLd('ARTISTS', '/artists.html', name, canonical), ...(faqLd ? [faqLd] : [])], body, lang, altHref, currentKey: 'artists', robots: thin ? 'noindex,follow' : 'max-image-preview:large', extraScripts: LANG_TOGGLE_SCRIPT + ARTIST_HUB_BACK_SCRIPT, backgroundLayer: true }) };
}

/* Instagram の URL から表示用の @ハンドルを取り出す。

   会場詳細に Instagram を出す（2026-08-09）。22件すべてに入力があるのに
   詳細ページのどこにも出ていなかった（一覧では使われていた。AUDIT §9-60）。
   クラブは公式サイトを持たない・更新が止まっている例が多く、
   Instagram が実質の一次情報になっている。

   URL をそのまま出すと長いので @womb_tokyo の形にする。
   取り出せない形の URL は、そのまま出して壊さない。 */
function instagramHandle(url) {
  const m = String(url || '').match(/instagram\.com\/([^/?#]+)/i);
  return m && m[1] ? '@' + m[1] : String(url || '');
}

const VENUE_PRACTICAL_FEATURES = {
  'cash-only': ['現金のみ', 'CASH ONLY'],
  'cashless-only': ['キャッシュレスのみ', 'CASHLESS ONLY'],
  'id-required': ['要ID', 'ID REQUIRED'],
  'no-photo': ['撮影禁止', 'NO PHOTOS'],
  'smoking': ['喫煙可', 'SMOKING'],
  'no-reentry': ['再入場不可', 'NO RE-ENTRY'],
};

function venueFeatures(value) {
  return (Array.isArray(value) ? value : String(value || '').split(/[;,]/))
    .map((item) => String(item).trim()).filter(Boolean);
}

const VENUE_FEATURE_LABELS = {
  'after-hours': 'After-hours',
  daytime: 'Daytime',
  vinyl: 'Vinyl',
  outdoor: 'Outdoor',
  rooftop: 'Rooftop',
  listening: 'Listening',
  'no-cover': 'No cover',
};

function venueFeatureLabel(feature, lang) {
  const key = String(feature || '').trim();
  if (Object.prototype.hasOwnProperty.call(VENUE_PRACTICAL_FEATURES, key)) {
    return VENUE_PRACTICAL_FEATURES[key][lang === 'en' ? 1 : 0];
  }
  return VENUE_FEATURE_LABELS[key] || key;
}

function venueTitleClass(name) {
  const longest = Math.max(0, ...String(name || '').trim().split(/\s+/).filter(Boolean).map((word) => [...word].length));
  if (longest > 16) return ' venue-title-longest';
  if (longest > 8) return ' venue-title-long';
  return '';
}

function venueGallerySources(value) {
  return (Array.isArray(value) ? value : String(value || '').split(','))
    .map((item) => String(item || '').trim()).filter(Boolean).slice(0, 2);
}

const VENUE_EVENTS_SCRIPT = `
<script>
(function() {
  'use strict';
  document.querySelectorAll('[data-venue-events]').forEach(function(section) {
    var buttons = Array.prototype.slice.call(section.querySelectorAll('[data-venue-event-toggle]'));
    var rows = Array.prototype.slice.call(section.querySelectorAll('[data-venue-event-row]'));
    if (!buttons.length || !rows.length) return;
    function apply(status) {
      buttons.forEach(function(button) {
        var selected = button.getAttribute('data-venue-event-toggle') === status;
        button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        button.classList.toggle('is-active', selected);
      });
      rows.forEach(function(row) {
        row.hidden = row.getAttribute('data-venue-event-status') !== status;
      });
    }
    buttons.forEach(function(button) {
      button.addEventListener('click', function() { apply(button.getAttribute('data-venue-event-toggle')); });
    });
    apply(section.getAttribute('data-venue-event-default') || 'upcoming');
  });
}());
</script>`;

function venueDistance(a, b) {
  const lat1 = Number(a.lat), lng1 = Number(a.lng), lat2 = Number(b.lat), lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function venueUpcomingEditions(v, allFestivals, editionsByFestival) {
  const venueName = String(v.name || '').trim().toLocaleLowerCase();
  return (allFestivals || []).filter(isPublishedFestival).flatMap((festival) =>
    (editionsByFestival.get(String(festival.id)) || []).filter((edition) => {
      const textMatch = [edition.LOCATION, edition.LOCATION_JA, edition.ADDRESS]
        .some((value) => venueName && String(value || '').toLocaleLowerCase().includes(venueName));
      const near = v.lat && v.lng && edition.LAT && edition.LNG
        && venueDistance(v, { lat: edition.LAT, lng: edition.LNG }) <= 0.15;
      const end = String(edition.DATE_END || edition.DATE_START || '');
      return (textMatch || near) && (!ISO_DATE.test(end) || end >= jstToday());
    }).map((edition) => ({ festivalId: festival.id, edition: contentRow(edition) }))
  );
}
function prepareContentDateSnapshots({ pubFests, pubArtists, pubVenues, editionsByFestival, lineupsByEdition, artistAppearances }) {
  CONTENT_DATES = loadContentDates();
  for (const artist of pubArtists) {
    const appearances = (artistAppearances.get(String(artist.id)) || []).map(({ edition, festival }) => ({
      festivalId: festival.id,
      edition: { EDITION_ID: edition.EDITION_ID, DATE_START: edition.DATE_START, DATE_END: edition.DATE_END, LOCATION: edition.LOCATION, LOCATION_JA: edition.LOCATION_JA, ADDRESS: edition.ADDRESS },
    })).sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID)));
    CONTENT_SNAPSHOTS.set(`artist:${artist.id}`, { artist: contentRow(artist), appearances });
  }
  for (const venue of pubVenues) {
    const upcoming = venueUpcomingEditions(venue, pubFests, editionsByFestival)
      .sort((a, b) => String(a.edition.EDITION_ID).localeCompare(String(b.edition.EDITION_ID)));
    CONTENT_SNAPSHOTS.set(`venue:${venue.id}`, { venue: contentRow(venue), upcoming });
  }
  for (const festival of pubFests) {
    const editions = (editionsByFestival.get(String(festival.id)) || []).map((edition) => ({
      edition: contentRow(edition), lineups: (lineupsByEdition.get(edition.EDITION_ID) || []).map(contentRow),
    }));
    CONTENT_SNAPSHOTS.set(`festival:${festival.id}`, { festival: contentRow(festival), editions });
  }
}

/* ---------- ヴェニューページ ---------- */
function venueTypeLabels(type) {
  const key = String(type || '').trim().toLowerCase();
  if (key === 'bar') return { ja: 'バー', en: 'Bar' };
  if (key === 'livehouse') return { ja: 'ライブハウス', en: 'Live House' };
  return { ja: 'クラブ', en: 'Club' };
}

function venueTitleTypeJa(type) {
  const key = String(type || '').trim().toLowerCase();
  if (key === 'club') return 'クラブ';
  if (key === 'livehouse') return 'ライブハウス';
  return 'ヴェニュー';
}

function venuePage(v, lang = 'ja', allFestivals = [], editionsByFestival = new Map(), articles = [], lineupsByEdition = new Map(), artistsById = new Map(), allArtistsById = new Map()) {
  const prefix = lang === 'en' ? '/en' : '';
  const hubHref = `${prefix}/venues.html`;
  const altHref = (lang === 'ja' ? '/en' : '') + `/venues/${v.id}.html`;
  const name = lang === 'en' ? (v.name_en || v.name) : v.name;
  const bodyDesc = lang === 'en' ? (v.desc_en || v.desc) : (v.desc || v.desc_en);
  const canonical = `${BASE}${prefix}/venues/${v.id}.html`;
  const cityRaw = String(v.city || '').trim();
  const areaRaw = String(v.area || '').trim();
  const city = lang === 'en' ? placeEn(cityRaw) : placeJa(cityRaw);
  const areaLabel = areaRaw && areaRaw.toLowerCase() !== cityRaw.toLowerCase() ? (lang === 'en' ? placeEn(areaRaw) : placeJa(areaRaw)) : '';
  const place = [areaRaw, cityRaw].filter(Boolean).join(', ');
  const venueType = venueTypeLabels(v.type);
  const titlePlace = [areaLabel, city].filter(Boolean).join(', ') || 'Japan';
  const nameKana = String(v.name_kana || '').trim();
  const areaTitle = areaLabel || city;
  const titleTypeJa = venueTitleTypeJa(v.type);
  const titleName = nameKana
    ? `${name}（${nameKana}）${areaTitle}`
    : areaTitle
      ? `${name}（${areaTitle}）`
      : name;
  const titleNameWithoutArea = nameKana ? `${name}（${nameKana}）` : name;
  const jaTitleCandidates = [
    `${titleName}｜${titleTypeJa}のアクセス・営業時間・イベント — TECHNO JAPAN`,
    `${titleName}｜${titleTypeJa}のアクセス・営業時間 — TECHNO JAPAN`,
    `${titleNameWithoutArea}｜${titleTypeJa}のアクセス・営業時間 — TECHNO JAPAN`,
  ];
  const title = lang === 'en'
    ? [`${name} (${areaLabel || titlePlace}) — ${venueType.en} in ${city || 'Japan'} | TECHNO JAPAN`, `${name} | TECHNO JAPAN`].find((t) => t.length <= 65) || `${name} | TECHNO JAPAN`
    : jaTitleCandidates.find((candidate) => candidate.length <= 60) || truncate(jaTitleCandidates[jaTitleCandidates.length - 1], 60);
  const jsonLdDesc = bodyDesc || (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — club / venue guide. Japan's underground dance music.`
    : `${name}${place ? '（' + place + '）' : ''}の基本情報。日本のアンダーグラウンド・ダンスミュージックのクラブ／ヴェニュー。`);
  const accessText = lang === 'en' ? (v.access_en || v.access) : v.access;
  const hoursText = lang === 'en' ? (v.hours_en || v.hours) : v.hours;
  const descLead = accessText
    ? `${accessText}。${hoursText ? `${lang === 'en' ? 'Hours' : '営業時間'}: ${hoursText}。` : ''}`
    : `${hoursText ? `${lang === 'en' ? 'Hours' : '営業時間'}: ${hoursText}。` : ''}`;
  const desc = truncate(`${descLead}${bodyDesc || (lang === 'en'
    ? `${name} — club / venue guide. Japan's underground dance music.`
    : `${name}の基本情報。日本のアンダーグラウンド・ダンスミュージックの会場。`)}`, 160);
  const image = absUrl(v.image);
  const venueLdType = v.type === 'bar'
    ? ['BarOrPub', 'MusicVenue']
    : v.type === 'club'
      ? ['NightClub', 'MusicVenue']
      : 'MusicVenue';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': venueLdType,
    '@id': `${BASE}/venues/${encodeURIComponent(v.id)}.html#venue`,
    name: name,
    ...(nameKana ? { alternateName: nameKana } : {}),
    inLanguage: lang,
    description: jsonLdDesc,
    ...(v.image ? { image: [image] } : {}),
    url: canonical,
    /* sameAs は「同じ主体を指す別のURL」。公式サイトと Instagram の両方を
       並べると、検索エンジンが同一の店だと判断しやすくなる。 */
    ...((() => {
      const same = [v.url, v.instagram].map((u) => String(u || '').trim()).filter(Boolean);
      return same.length ? { sameAs: same.length === 1 ? same[0] : same } : {};
    })()),
    address: { '@type': 'PostalAddress', addressLocality: v.city || '', addressCountry: 'JP', ...(v.address ? { streetAddress: v.address } : {}) },
    ...(v.lat && v.lng ? { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } } : {}),
    ...(v.capacity ? { maximumAttendeeCapacity: v.capacity } : {}),
  };

  const genres = (Array.isArray(v.genre) ? v.genre : String(v.genre || '').split('/').filter(Boolean))
    .map((g) => String(g).trim()).filter(Boolean);
  const genreLine = genres.join(' / ');
  const charge = String(v.charge || '').trim();
  const features = venueFeatures(v.features);
  const practical = features.filter((feature) => Object.prototype.hasOwnProperty.call(VENUE_PRACTICAL_FEATURES, feature));
  const goodToKnow = practical.map((feature) => venueFeatureLabel(feature, lang));
  const mapQuery = v.lat && v.lng ? `${v.lat},${v.lng}` : (v.address || '');
  const mapUrl = mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}` : '';
  const hoursFallback = lang === 'en' ? 'Hours vary by event. Check the official site for details.' : 'イベントにより異なります。公式サイトでご確認ください。';
  const typeUpper = String(v.type || '').trim().toUpperCase();
  const areaCity = [areaLabel, city].filter(Boolean).join(' · ') || '—';
  const featureChips = features.map((feature) => `<span class="pill">${esc(venueFeatureLabel(feature, lang))}</span>`).join('');
  const goodToKnowHtml = goodToKnow.length ? `<div class="venue-good-to-know">
        <span class="mono red">GOOD TO KNOW</span>
        <div class="venue-good-to-know-items">${goodToKnow.map((item) => `<span>${esc(item)}</span>`).join(' · ')}</div>
        <p>${lang === 'en' ? 'Check the official source for the latest information.' : '最新の情報は公式サイトでご確認ください。'}</p>
      </div>` : '';

  const venueNameForMatch = String(v.name || '').trim().toLocaleLowerCase();
  const venueFestivals = (allFestivals || []).filter(isPublishedFestival).map((festival) => {
    const editions = editionsByFestival.get(String(festival.id)) || [];
    const matching = editions.filter((edition) => {
      const textMatch = [edition.LOCATION, edition.LOCATION_JA, edition.ADDRESS]
        .some((value) => venueNameForMatch && String(value || '').toLocaleLowerCase().includes(venueNameForMatch));
      const near = v.lat && v.lng && edition.LAT && edition.LNG
        && venueDistance(v, { lat: edition.LAT, lng: edition.LNG }) <= 0.15;
      return textMatch || near;
    });
    if (!matching.length) return null;
    const latest = [...matching].sort((a, b) => String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')))[0];
    const end = String(latest.DATE_END || latest.DATE_START || '');
    return { festival, latest, upcoming: !ISO_DATE.test(end) || end >= jstToday() };
  }).filter(Boolean).sort((a, b) => Number(b.upcoming) - Number(a.upcoming)
    || String(a.latest.DATE_START || '').localeCompare(String(b.latest.DATE_START || ''))).slice(0, 6);
  const modified = contentDate('venue', v.id, CONTENT_SNAPSHOTS.get(`venue:${v.id}`));
  const eventRefs = venueFestivals.filter((x) => x.upcoming).slice(0, 6)
    .map(({ festival, latest }) => editionEventLd({ festival, edition: latest, lang }))
    .filter(Boolean);
  const faqItems = venueFaqItems(v, name, venueFestivals, lang);
  const faqLd = faqJsonLd(faqItems);
  if (modified) jsonLd.dateModified = modified;
  if (eventRefs.length) jsonLd.event = eventRefs;
  const venueArticles = (articles || []).filter((article) => {
    if (!article || String(article.status || '').toLowerCase() === 'draft' || !venueNameForMatch) return false;
    return [article.title, article.title_en, article.body, article.body_en]
      .some((value) => stripTags(value || '').toLocaleLowerCase().includes(venueNameForMatch));
  }).slice(0, 3);
  const gallery = venueGallerySources(v.gallery || v.GALLERY);
  const galleryImage = (source, sizes, loading = 'lazy') => {
    const sourcePath = String(source || '').trim().replace(/^\/+/, '');
    const src = /^https?:/i.test(sourcePath) ? sourcePath : `/${sourcePath}`;
    const srcset = loading === 'high' ? heroSrcsetAttr(source, sizes) : largeSrcsetAttr(source, sizes);
    return `<img ${dimensionAttrs(sourcePath)} src="${esc(src)}"${srcset} alt="${esc(name)}" ${loading === 'high' ? 'fetchpriority="high"' : `loading="${loading}"`} decoding="async"${imagePositionStyle(v)}>`;
  };
  const hasGallery = gallery.length >= 2;
  const galleryHtml = hasGallery
    ? `<div class="venue-gallery venue-gallery-spread">
        <div class="venue-gallery-main img">${v.image ? galleryImage(v.image, '(max-width: 900px) calc(100vw - 32px), calc((min(100vw, 1360px) - 80px - 132px) * 2 / 3 + 84px)', 'high') : ''}</div>
        <div class="venue-gallery-small img">${galleryImage(gallery[0], '(max-width: 900px) calc(100vw - 32px), calc((min(100vw, 1360px) - 80px - 132px) / 3 + 36px)')}</div>
        <div class="venue-gallery-small img">${galleryImage(gallery[1], '(max-width: 900px) calc(100vw - 32px), calc((min(100vw, 1360px) - 80px - 132px) / 3 + 36px)')}</div>
      </div>`
    : `<div class="venue-gallery venue-gallery-single img">${v.image ? galleryImage(v.image, '(max-width: 900px) calc(100vw - 32px), calc(min(100vw, 1360px) - 80px)', 'high') : ''}</div>`;
  const buttonLink = (label, url) => url
    ? `<a class="btn2" href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${label} ↗</a>`
    : '';
  const instagramLink = v.instagram
    ? `<a class="btn2" href="${esc(safeUrl(v.instagram))}" target="_blank" rel="noopener" aria-label="Instagram ${esc(instagramHandle(v.instagram))}">Instagram</a>`
    : '';
  const linkRow = [
    buttonLink('Website', v.url),
    instagramLink,
    buttonLink('Google Maps', mapUrl),
  ].filter(Boolean).join('');
  const addressValue = v.address
    ? `${esc(v.address)}${mapUrl ? ` <a class="mono venue-fact-link" href="${esc(safeUrl(mapUrl))}" target="_blank" rel="noopener">Google Maps ↗</a>` : ''}`
    : '—';
  const factsHtml = `<div class="venue-facts">
      <span class="mono red venue-facts-heading">Facts</span>
      <div class="fact venue-fact venue-fact-first"><span class="mono">Type</span><span>${esc(typeUpper || '—')}</span></div>
      <div class="fact venue-fact"><span class="mono">Area</span><span>${esc(areaCity)}</span></div>
      <div class="fact venue-fact"><span class="mono">Address</span><span>${addressValue}</span></div>
      <div class="fact venue-fact"><span class="mono">Access</span><span>${esc(accessText || '—')}</span></div>
      <div class="fact venue-fact"><span class="mono">Genre</span><span class="mono venue-fact-value">${esc(genreLine || '—')}</span></div>
      <div class="fact venue-fact"><span class="mono">Hours</span><span>${esc(hoursText || hoursFallback)}</span></div>
      ${charge ? `<div class="fact venue-fact"><span class="mono">Charge</span><span>${esc(charge)}</span></div>` : ''}
      ${features.length ? `<div class="fact venue-fact"><span class="mono">Features</span><span class="venue-feature-list">${featureChips}</span></div>` : ''}
      ${goodToKnowHtml}
    </div>`;

  const lineupLine = (edition) => {
    const lineupRows = [...(lineupsByEdition.get(String(edition.EDITION_ID || '')) || [])]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0));
    const acts = lineupRows.map((row) => {
      const ids = lineupArtistIds(row);
      const artist = ids.length === 1 ? (artistsById.get(ids[0]) || allArtistsById.get(ids[0])) : null;
      return artist ? (lang === 'en' ? (artist.name_en || artist.name || artist.NAME) : (artist.name || artist.NAME)) : (row.ACT_LABEL || ids[0] || '');
    }).filter(Boolean).slice(0, 3);
    if (acts.length) return acts.join(' · ');
    return [editionLocationName(edition, lang), lang === 'en' ? placeEn(edition.PREF) : placeJa(edition.PREF)].filter(Boolean).join(' · ') || '—';
  };
  const venueEventRows = venueFestivals.map(({ festival, latest, upcoming }) => {
    const festivalName = lang === 'en' ? (festival.name_en || festival.name) : festival.name;
    const date = festivalShortDateText(latest, lang) || '—';
    const year = editionLabel(editionIdentifier(latest)) || String(latest.DATE_START || '').slice(0, 4) || '—';
    const status = upcoming ? 'upcoming' : 'past';
    return `<a class="venue-event-row row" href="${prefix}/festivals/${encodeURIComponent(festival.id)}.html" data-venue-event-row data-venue-event-status="${status}">
        <span class="venue-event-date"><span class="disp">${esc(date)}</span><span class="mono">${esc(year)}</span></span>
        <span class="venue-event-name">${esc(festivalName)}</span>
        <span class="venue-event-lineup hide">${esc(lineupLine(latest))}</span>
        <span class="mono${upcoming ? ' red' : ''}">${upcoming ? 'UPCOMING' : 'PAST'}</span>
      </a>`;
  }).join('');
  const upcomingCount = venueFestivals.filter((item) => item.upcoming).length;
  const eventsHtml = venueFestivals.length ? `<section class="venue-events" data-venue-events data-venue-event-default="${upcomingCount ? 'upcoming' : 'past'}">
      <div class="festival-section-heading"><h2 class="disp">Upcoming at ${esc(name)}</h2><div class="venue-event-tabs"><button class="chip${upcomingCount ? ' is-active' : ''}" type="button" data-venue-event-toggle="upcoming" aria-pressed="${upcomingCount ? 'true' : 'false'}">Upcoming</button><button class="chip${upcomingCount ? '' : ' is-active'}" type="button" data-venue-event-toggle="past" aria-pressed="${upcomingCount ? 'false' : 'true'}">Past</button></div></div>
      <div class="venue-event-columns row mono"><span>Date</span><span>Event</span><span class="hide">Lineup</span><span>Status</span></div>
      ${venueEventRows}
    </section>` : '';
  const sameCity = XLINK.venues.filter((x) => x.id !== v.id && x.city && v.city && String(x.city).toLowerCase() === String(v.city).toLowerCase());
  const withDistance = v.lat && v.lng && XLINK.venues.some((x) => x.lat && x.lng)
    ? XLINK.venues.filter((x) => x.id !== v.id && x.lat && x.lng).sort((a, b) => venueDistance(v, a) - venueDistance(v, b))
    : sameCity;
  const nearby = withDistance.slice(0, 4);
  const nearbyCardSizes = '(max-width: 900px) calc((100vw - 48px) / 2), calc((min(100vw, 1360px) - 80px - 72px) / 4)';
  const nearbyHtml = nearby.length ? `<section class="venue-nearby">
      <div class="festival-section-heading"><h2 class="disp">Nearby · ${esc(city || 'Japan')}</h2><a class="mono" href="${hubHref}">All venues →</a></div>
      <div class="venue-nearby-grid">${nearby.map((near) => {
        const nearName = lang === 'en' ? (near.name_en || near.name) : near.name;
        const nearArea = lang === 'en' ? placeEn(near.area || near.city) : placeJa(near.area || near.city);
        const nearType = String(near.type || '').trim().toUpperCase();
        const nearImage = near.image ? cardImagePath(near.image) : '';
        const nearSrc = nearImage ? (/^https?:/i.test(nearImage) ? nearImage : `/${nearImage}`) : '';
        return `<a class="venue-nearby-card card" href="${prefix}/venues/${encodeURIComponent(near.id)}.html">
          <div class="venue-nearby-image img">${nearSrc ? `<img ${dimensionAttrs(nearImage)} src="${esc(nearSrc)}"${largeSrcsetAttr(near.image, nearbyCardSizes)} alt="${esc(nearName)}" loading="lazy" decoding="async"${imagePositionStyle(near)}>` : ''}</div>
          <span class="disp venue-nearby-name">${esc(nearName)}</span>
          <span class="mono">${esc([nearArea, nearType].filter(Boolean).join(' · '))}</span>
        </a>`;
      }).join('')}</div>
    </section>` : '';
  const storiesHtml = venueArticles.length ? `<section class="artist-stories venue-stories">
      <div class="festival-section-heading"><h2 class="disp">Stories</h2><a class="mono" href="${prefix}/news.html">All stories →</a></div>
      ${relatedStoryCardsHtml(venueArticles, lang, { forceEnglishPath: true, compactDate: true, grid: true, heading: '' })}
    </section>` : '';

  const body = `<article class="detail-page venue-detail venue-detail-v2">
  <div class="wrap venue-detail-wrap">
    <nav class="venue-breadcrumb mono" aria-label="Breadcrumb"><a href="${hubHref}">Venues</a><span>/</span>${city ? `<a href="${hubHref}?area=${encodeURIComponent(cityRaw)}">${esc(city)}</a><span>/</span>` : ''}<span>${esc(name)}</span></nav>
    ${galleryHtml}
    <section class="venue-head">
      <div class="venue-head-copy">
        <div class="venue-head-meta"><span class="pill">${esc(typeUpper || 'VENUE')}</span><span class="mono">${esc(areaCity)}</span></div>
        <h1 class="disp venue-title${venueTitleClass(name)}">${esc(name)}</h1>
        ${lang === 'ja' && nameKana ? `<span class="mono venue-kana">${esc(nameKana)}</span>` : ''}
        ${bilingualBody(v.desc, v.desc_en, lang, 'venue-description').replaceAll('class="lang-btn', 'class="lang-btn chip')}
        ${linkRow ? `<div class="venue-links">${linkRow}</div>` : ''}
      </div>
      ${factsHtml}
    </section>
    ${eventsHtml}
    ${nearbyHtml}
    ${storiesHtml}
    ${faqItems.length ? `\n    <section class="venue-faq">${festivalFaqDetailsHtml(faqItems, lang, true)}</section>` : ''}
    ${updatedLabel(modified, lang)}
    <div class="article-footer venue-footer"><a class="article-back" href="${hubHref}" data-venue-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL VENUES</a></div>
  </div>
</article>`;

  const html = page({ title, desc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('VENUES', '/venues.html', name, canonical), ...(faqLd ? [faqLd] : [])], body, lang, altHref, currentKey: 'venues', extraScripts: LANG_TOGGLE_SCRIPT + VENUE_HUB_BACK_SCRIPT + (eventsHtml ? VENUE_EVENTS_SCRIPT : ''), backgroundLayer: true })
    .replace(/[ \t]+$/gm, '');
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'venues'] : ['venues']), `${v.id}.html`), html };
}

/* ---------- 実行 ---------- */
function writeAll(pages, dirName) {
  const dir = path.join(LP_DIR, dirName);
  fs.mkdirSync(dir, { recursive: true });

  // 中身が変わったファイルだけ書く。
  // 毎回「全削除→全書き直し」にすると、iCloud/Drive 同期下では大量の書き込みが
  // 競合コピー（"foo 2.html"）を生む。差分だけ触れば通常は書き込み0件で済む。
  const wanted = new Map(pages.map((p) => [path.basename(p.file), p]));
  let written = 0;

  for (const [name, p] of wanted) {
    const cur = fs.existsSync(p.file) ? fs.readFileSync(p.file, 'utf8') : null;
    if (cur !== p.html) { fs.writeFileSync(p.file, p.html); written++; }
  }

  // データから消えたページは削除する（同期が作った重複コピーもここで掃除される）
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    if (!wanted.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
  }

  return { total: pages.length, written, removed };
}

/* ---------- ハブページの静的リンク ---------- */
function festivalHubLabel(f, editions = [], lang = 'ja') {
  const details = [];
  const current = [...editions].sort((a, b) => String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')))[0];
  const year = String(current?.EDITION || current?.DATE_START || '').match(/\b\d{4}\b/)?.[0];
  if (year) details.push(year);
  // lang を 'ja' で固定していたため、EN ハブの静的リンクに JA の会場名が出ていた。
  // editionPlace はもともと lang を受け取れる（LOCATION_EN → LOCATION → LOCATION_JA）。
  const place = current ? editionPlace(current, lang) : '';
  if (place) details.push(place);
  const name = lang === 'en' ? (f.name_en || f.name || '') : (f.name || '');
  return `${name}${details.length ? ` — ${details.join(' · ')}` : ''}`;
}

function hubLinkList(items, dirName, labelFor) {
  return `<ul class="ssr-link-list">\n${items.map((item) =>
    `  <li><a href="/${dirName}/${encodeURIComponent(item.id)}.html">${esc(labelFor(item))}</a></li>`
  ).join('\n')}\n</ul>`;
}

function topLinkList(items) {
  return `<ul class="ssr-link-list">\n${items.map((item) =>
    `  <li><a href="${item.href}">${esc(item.label)}</a></li>`
  ).join('\n')}\n</ul>`;
}

function todayInJapan() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}

/* ---------- EN ハブページの生成 ----------
   JA ハブ（手書きHTML）を唯一のソースとし、機械置換で EN 版を作る。
   テンプレート化しない理由: ハブ4枚は互いに style 7-19% / JS 9-25% しか
   共通しておらず、畳めるのは nav/footer 等の外枠 10.8KB だけ。労力に見合わない。
   一方 JA→EN の差分は「メタ + 内部リンク + 固定文言1つ」しかないので、
   置換のほうが確実で、JA を直せば EN が自動追随する（二重管理が起きない）。 */

// EN 版が実在するページ。ここに無いものは JA を指したままにする（404 を作らない）。
const EN_PAGES = new Set(['index.html', 'about.html', 'submit.html', 'writers.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html', 'favorites.html']);

// EN ハブの meta description（JA は日英併記なので英語のみに差し替える）
const EN_HUB_DESC = {
  'submit.html': "Submit a techno or underground electronic music festival or event held in Japan for consideration by Techno Japan. Listing is free of charge.",
  'writers.html': "Write for TECHNO JAPAN — report on Japan's underground dance music scene from the perspective of someone who is there.",
  'festivals.html': "Techno, house and open-air festivals across Japan. Browse by date, region and genre — the definitive guide to Japan's electronic music festivals.",
  'artists.html': "DJs and artists shaping Japan's underground techno and house scene. Profiles, genres and festival appearances.",
  'venues.html': "Clubs, warehouses and music bars across Japan. The venues that define the country's underground electronic music scene.",
  'news.html': "Stories, interviews and reports from Japan's underground techno and house scene.",
  'index.html': "Japan's underground techno & house — stories, festivals, artists, venues.",
  'about.html': "About TECHNO JAPAN — a selective media for Japan's underground dance music scene. AUTHENTIC / SELECTIVE / BORDERLESS / INDEPENDENT.",
  'favorites.html': "Your saved festivals, artists, and venues from Japan's underground scene.",
};

// 本文に残る日本語の固定文言（データ由来の日本語は対象外）
const EN_HUB_TEXT = [
  ['日本の野外フェスの情報を受け取る', "Get Japan's open-air festival news"],
  ['来月の開催予定と新着記事をまとめてメールで届けます。無料、いつでも解除できます。', 'Upcoming festivals and new stories in one email. Free, unsubscribe anytime.'],
  ['最新の投稿とお知らせをInstagramで。', 'Latest posts and updates on Instagram.'],
  ['お問い合わせを受け付けました。編集部から返信します。', "We've received your message. The editors will be in touch."],
  ['続きを読む +', 'Read more +'],
  ['APPLY', 'APPLY'],
  ['過去30日の閲覧数順 · 更新', 'Ranked by views over the last 30 days · updated'],
  ['集計データを準備中です（過去30日の閲覧数で並びます）', 'Counting in progress — ranked by views over the last 30 days'],
];

const EN_PAGE_TEXT = {
  'news.html': [
    ['並べ替え', 'Sort'],
  ],
  'artists.html': [
    ['アーティスト一覧', 'All artists'],
  ],
  'submit.html': [
    ['Techno Japanへのフェスティバル・イベント掲載申請。掲載は無料です。', 'Submit a festival or event for consideration by Techno Japan. Listing is free of charge.'],
    ['本文へ移動', 'Skip to content'],
    ['Techno Japanでは、日本国内で開催されるテクノおよびアンダーグラウンドなエレクトロニックミュージックのフェスティバル・イベント情報を掲載しています。掲載は無料です。下記フォームよりご申請ください。', 'Techno Japan lists techno and underground electronic music festivals and events held in Japan. Listing is free of charge. Please apply using the form below.'],
    ['掲載について', 'About listings'],
    ['掲載するフェスティバル・イベントは、編集部がメディアの方向性に照らして判断しています。掲載の考え方は', 'The editorial team reviews festival and event listings against the direction of the media. For our approach, see '],
    ['をご覧ください。', '.'],
    ['掲載は無料です。掲載に伴う費用は一切発生しません', 'Listing is free. There is no charge for publication.'],
    ['申請いただいたすべてのイベントの掲載をお約束するものではありません', 'We cannot guarantee that every submitted event will be listed.'],
    ['掲載可否の理由について、個別のご回答は行っておりません', 'We do not provide individual explanations for listing decisions.'],
    ['提供いただいた情報は、掲載時に編集部で編集する場合があります', 'The editorial team may edit the information provided when publishing it.'],
    ['掲載後の情報修正・削除のご依頼は、フォーム記載の連絡先より承ります', 'For corrections or removal after publication, please use the contact details in the form.'],
    ['掲載の目安', 'What we list'],
    ['テクノ、ハウス、ミニマル、アンビエント、エクスペリメンタルなど、エレクトロニックミュージックを軸としたフェスティバル・イベントを対象としています。', 'We focus on festivals and events centered on electronic music, including techno, house, minimal, ambient and experimental music.'],
    ['掲載までの流れ', 'How it works'],
    ['フォームより申請', 'Submit the form'],
    ['編集部で内容を確認', 'The editorial team reviews your information'],
    ['掲載が決定した場合、サイトに公開されます', 'If approved, your event will be published on the site'],
    ['(お急ぎの場合は備考欄にその旨をお書きください)', '(If your request is urgent, please note that in the comments.)'],
    ['掲載後の情報更新、ラインナップの追加発表なども随時受け付けています。', 'We also accept updates after publication, including newly announced lineups.'],
    ['同じフォームよりご連絡ください。', 'Please contact us using the same form.'],
    ['SUBMISSION · 掲載は無料', 'SUBMISSION · Listing is free'],
    ['応募フォームへ', 'Application form'],
    ['STATEMENT →', 'STATEMENT →'],
    ['04 — 申請フォーム', '04 — Application form'],
    ['Genres', 'Genres'],
    ['Flow', 'Flow'],
    ['Submit an event', 'Submit an event'],
    ['選択してください', 'Select'],
    ['フェスティバル名', 'Festival name'],
    ['開催日', 'Start date'],
    ['終了日', 'End date'],
    ['※ 複数日開催の場合', '※ For multi-day events'],
    ['会場名', 'Venue name'],
    ['都道府県', 'Prefecture'],
    ['会場住所', 'Venue address'],
    ['※ シークレットロケーションの場合や、公開前の場合は未記入で構いません', '※ Leave blank for secret locations or if not yet announced'],
    ['公式サイトURL', 'Official website'],
    ['※ 公式サイトがない場合は未記入で構いません。SNSのみでも掲載可能です', '※ Optional. Social media accounts alone are sufficient'],
    ['公式Instagram', 'Official Instagram'],
    ['チケット販売URL', 'Ticket page'],
    ['※ 未定・未公開の場合は未記入で構いません。決まり次第ご連絡いただければ追記します', '※ Leave blank if not yet available. Let us know once tickets go on sale'],
    ['ジャンル', 'Genre'],
    ['紹介文(日本語)', 'Description in Japanese'],
    ['※ 200字程度', '※ About 200 Japanese characters'],
    ['紹介文(英語)', 'Description in English'],
    ['※ 200 words or fewer', '※ 200 words or fewer'],
    ['ラインナップ', 'Lineup'],
    ['※ 1行につき1組ご記入ください。発表済みの範囲で構いません', '※ One artist per line. Announced acts only is fine'],
    ['プレスキット・その他資料のURL', 'Press kit or other materials'],
    ['※ プレスキット、素材フォルダ、リリース文など', '※ Press kits, asset folders, or press releases'],
    ['備考・特記事項', 'Remarks'],
    ['※ 掲載にあたってお伝えしたいことがあればご自由にどうぞ', '※ Anything else you would like us to know'],
    ['掲載許諾', 'Permission'],
    ['<span>提供した画像・情報のTechno Japan上での掲載に許諾します</span>', '<span>I grant permission to publish the submitted images and information on Techno Japan</span>'],
    ['フライヤー画像はフォーム送信後にメールで受け付けます', 'Flyer images can be sent by email after submitting the form'],
    ['申請する', 'Apply'],
    ['うまく送れない場合は', 'If the form does not work, use'],
    ['こちらのフォーム', 'this form'],
    ['Google フォームから', 'Google Forms'],
    ['Upcoming on Techno Japan', 'Upcoming on Techno Japan'],
    ['All festivals →', 'All festivals →'],
    ['申請を受け付けました。編集部で確認のうえ、掲載が決まった場合はサイトに公開されます。', 'The editorial team will review your submission and publish it if approved.'],
    ['送信できませんでした。入力内容は保持しています。', 'We could not send your application. Your entries have been kept.'],
    ['から送信してください。', ' to send it.'],
  ],
  'writers.html': [
    ['応募を受け付けました。編集部から連絡します。', "Thanks — we've received your application. The editors will be in touch."],
    ['TECHNO JAPAN の<wbr>ライター募集', 'Write for TECHNO JAPAN'],
    ['日本のアンダーグラウンドなダンスミュージックの現場を、現場にいる人の目で書き残したいと考えています。', "We want to document Japan's underground dance music scene through the eyes of the people who are actually there."],
    ['レポート、インタビュー、ガイド、短報を募集しています。', "We're looking for reports, interviews, guides and short news pieces."],
    ['TECHNO JAPAN で<wbr>書くと', 'What you get'],
    ['TECHNO JAPAN のフォロワー（ダンスミュージックが好きな人たち）に、記事を直接届けられる', "Your piece reaches TECHNO JAPAN's followers — people who love dance music — directly"],
    ['署名記事として残り、筆者ページに蓄積される', "It's published under your byline and collected on your writer page"],
    ['日本語と英語の2言語で公開される。英語版は編集部が用意する', 'Published in both Japanese and English; the editors prepare the translation'],
    ['記事がフェス・アーティスト・会場のデータベースと自動でつながり、関連ページから読まれ続ける', 'Articles link automatically to the festival, artist and venue database, so they keep being read from related pages'],
    ['Google ニュースの索引に載っている媒体で、ウェブ検索からも読まれる', 'TECHNO JAPAN is indexed by Google News and found through web search'],
    ['校正・写真のレイアウト・検索向けの調整は編集部が行う。書くことに集中できる', 'Editing, photo layout and search optimisation are handled by the editors — you focus on writing'],
    ['公開時に Instagram / Threads で告知する', 'Every piece is announced on Instagram and Threads'],
    ['書いている<wbr>人', 'Our writers'],
    ['ライターに<wbr>応募する', 'Apply to write'],
    ['過去の執筆記事', 'Previous articles (links)'],
    ['SNS アカウント', 'Social accounts'],
    ['URL を改行で。無ければ空欄で構いません', 'One URL per line; leave blank if none'],
    ['Instagram / X / Threads など', 'Instagram / X / Threads etc.'],
    ['WRITERS WANTED · レポート / インタビュー / ガイド / ニュース', 'WRITERS WANTED · Reports / Interviews / Guides / News'],
    ['応募フォームへ', 'Application form'],
    ['Stories →', 'Stories →'],
    ['01 — About', '01 — About'],
    ['02 — Why write', '02 — Why write'],
    ['Formats', 'Formats'],
    ['03 — Writers', '03 — Writers'],
    ['04 — Apply', '04 — Apply'],
    ['4 formats', '4 formats'],
    ['フェスやパーティの現場レポート。音、空間、人の動きを、その場にいた人の目で。', 'Reports from festivals and parties — sound, space and movement, seen by someone who was there.'],
    ['アーティスト、オーガナイザー、ベニューへのインタビュー。', 'Interviews with artists, organisers and venues.'],
    ['街、季節、ジャンルごとのガイド。初めて来る人にも、通う人にも。', 'Guides by city, season and genre — for first-timers and regulars alike.'],
    ['新しいフェスの告知、ラインナップ発表などのニュース。', 'News including new festival announcements and lineup reveals.'],
    ['authors DB', 'authors DB'],
    ['過去の記事や SNS を見て、編集部から連絡します。書きたいテーマがあれば一言添えてください。', 'The editors will review your previous work and social accounts. Tell us briefly what you would like to write about.'],
  ],
};

/* about.html の STATEMENT を EN 版で英語にするための対訳。
   **en/about.html は writeEnHub が JA から毎ビルド生成する。**手で英語化しても
   次のビルドで消える（2026-08-26 に実際に起きた。デプロイ中のビルドが
   手編集の英語を日本語へ巻き戻した）。文面を変えるときは JA 側と、
   この対訳の両方を更新する。JA 側の文が見つからなければビルドを止める
   （黙って JA のまま公開される事故を防ぐ）。 */
const ABOUT_EN_TEXT = [
  ['本物の音楽体験だけを。', 'Only real music experiences.'],
  ['すべては発信しない。厳選して届ける。', "We don't publish everything. We select."],
  ['日本と世界を、交差させる。', 'Crossing Japan and the world.'],
  ['どこにも偏らず、フラットであり続ける。', 'No capital, no agenda, no bias.'],
  ['日本のダンスフロアには、世界に誇るべき圧倒的なクオリティ、細部に宿るホスピタリティ、そして真摯な音楽体験が存在します。',
   "Japan's dancefloors hold world-class quality, hospitality woven into every detail, and a sincerity toward music itself."],
  ['私たちの目的は、音楽そのものを目的に世界中から人々が訪れるような、持続可能で熱量ある循環を、この地に生み出すことです。',
   'Our purpose is to create a lasting, passionate cycle here, one that draws people from around the world for the music itself.'],
  ['しかし、アンダーグラウンドカルチャーの美しさは、「ただ広めればいい」というものではありません。知る人ぞ知る場の空気感、限られた空間だからこそ成り立つ純度。それは、私たちが何よりも守るべき境界線です。',
   'But the beauty of underground culture is not something to simply spread. The air of places known only to those who know, the purity that exists because a space is limited. That is the boundary we protect above all.'],
  ['だからこそ、Techno Japanは、すべての情報を発信するメディアではありません。現場で感じ、深く賛同したイベントとカルチャーだけを、厳選して届けます。',
   'This is why Techno Japan does not publish everything. We select only the events and cultures we have felt and believed in, on the floor.'],
  ['私たちの視線は日本の内側にとどまりません。世界のダンスフロアで生まれるムーブメントを日本へ、日本の熱量を世界へ。本物の音楽体験に、国境はないからです。',
   "Our gaze does not stop at Japan's borders. Movements from the world's dancefloors to Japan, Japan's heat to the world. Authenticity knows no borders."],
  ['日本と世界をボーダレスに交差させることが、シーンを次へと進めていく。私たちはそう信じています。',
   'Crossing Japan and the world, borderless, is what moves this scene forward. That is what we believe.'],
  ['そして、ひとつの約束を。特定の資本や過度な商業的思惑、偏った思想を介入させず、客観的でフラットな視点を貫き続けます。',
   'And one promise. No capital, no agenda, no bias. We stay objective and flat, always.'],
  ['私たちが目指すのは、人、場所、音楽をつなぐ、シーンの接続点となるフラットなメディアです。',
   'What we aim to be is a flat, open media, a point of contact connecting people, places, and music.'],
  ['Techno Japanは、この姿勢で届けていきます。', 'This is how Techno Japan will keep delivering.'],
  // ---- STATEMENT 以外の about 全文（2026-08-27 ユーザー採用） ----
  ['Techno Japanは、日本のアンダーグラウンドなテクノ/ハウスシーンを扱うカルチャーメディアです。イベント情報の羅列にとどまらず、アーティスト、会場、フェスティバル、クラブカルチャーを、編集的な視点とシーンへの理解をもって紹介します。',
   "Techno Japan is a culture media covering Japan's underground techno and house scene. More than a listing of events, we present artists, venues, festivals and club culture with an editorial eye and a real understanding of the scene."],
  ['国内外の読者に向けて、日本のアンダーグラウンドをより見えやすく、より意味のあるものにすること。それが私たちの存在理由です。',
   "To make Japan's underground more visible, and more meaningful, for readers at home and abroad. That is why we exist."],
  ['日本のアンダーグラウンドシーンの最新記事、インタビュー、特集など。',
   "The latest stories, interviews and features from Japan's underground scene."],
  ['オープンエアのギャザリング、レイヴ、そして日本を代表する野外電子音楽フェスティバル。',
   "Open-air gatherings, raves, and Japan's defining outdoor electronic music festivals."],
  ['新しい才能から、確かなセレクターまで。日本のサウンドを形づくるアーティスト達。',
   "From emerging talent to trusted selectors. The artists shaping Japan's sound."],
  ['日本のアンダーグラウンドなナイトクラブやミュージックバー、そしてユニークな空間。',
   "Japan's underground nightclubs, music bars and singular spaces."],
  ['コラボレーション、取材・掲載のご相談、広告掲載、その他のお問い合わせはこちらから。',
   'For collaborations, press and listing inquiries, advertising, and anything else — reach us here.'],
  ['APPLY →', 'APPLY →'],
];

function enHubFromJa(html, page) {
  let s = html;
  const abs = (p) => `${BASE}/${p === 'index.html' ? '' : p}`;
  const menuKey = ({ 'index.html': 'top', 'news.html': 'news', 'festivals.html': 'festivals', 'artists.html': 'artists', 'venues.html': 'venues', 'about.html': 'about', 'favorites.html': 'favorites' })[page] || '';
  const jaMenu = menuOverlayHtml('ja', menuKey, `/en/${page}`);
  const enMenu = menuOverlayHtml('en', menuKey, `/${page}`);
  if (!s.includes(jaMenu)) throw new Error(`${page}: JAメニューが見つからない（生成と不整合）`);
  s = s.split(jaMenu).join(enMenu);
  const jaFooter = footerHtml('ja');
  if (!s.includes(jaFooter)) throw new Error(`${page}: JAフッターが見つからない（生成と不整合）`);
  s = s.split(jaFooter).join(footerHtml('en'));

  // 言語シグナル
  s = s.replace(/<html lang="[^"]*"/, '<html lang="en"');
  s = s.replace(/(property="og:locale" content=")[^"]*/, '$1en_US');

  // 正規URL と OGP URL を /en/ 側へ。
  // index.html だけ JA 側が "https://techno-japan.media/" とディレクトリ表記なので、
  // abs() が返す末尾スラッシュ形と一致させる。EN 側は /en/index.html を明示する
  // （/en/ でも配信されるが、canonical は1つに定めたいので実ファイル名にする）。
  const jaUrl = abs(page);
  s = s.replace(new RegExp(`(rel="canonical" href=")${jaUrl}"`), `$1${BASE}/en/${page}"`);
  s = s.replace(new RegExp(`(property="og:url" content=")${jaUrl}"`), `$1${BASE}/en/${page}"`);

  // description 系を英語のみに
  const d = EN_HUB_DESC[page];
  if (d) {
    for (const attr of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      s = s.replace(new RegExp(`(<meta ${attr} content=")[^"]*`), `$1${d}`);
    }
    s = replaceCollectionPageDesc(s, d, page);
  }

  // Buttondown の言語タグだけは固定 HTML 属性を置換する。JS の式や
  // data.js の参照を置換すると、別の式まで巻き込むため行わない。
  if (USE_BUTTONDOWN && (page === 'index.html' || page === 'news.html')) {
    s = s.split('name="tag" value="ja"').join('name="tag" value="en"');
  }

  // 静的リンク一覧のラベルを EN 版へ差し替える。
  // href はこの下の /en/ 書き換えに任せるので、JA と同じ表記で出しておく。
  // 日本語名のフェス（森、道、市場 等）は name_en が無いので JA のまま残るが、
  // 会場名は EDITIONS の LOCATION が英字表記を持っているぶんだけ英語になる。
  const links = EN_HUB_LINKS[page];
  if (links) s = replaceHubLinksBlock(s, links.marker, links.html, `en/${page}`);

  // 内部リンク: EN 版があるページだけ /en/ へ。相対・絶対の両表記に対応する。
  s = s.replace(/href="\/?((?:index|news|festivals|artists|venues|about|submit|writers|favorites)\.html)"/g,
    (m, p) => (EN_PAGES.has(p) ? `href="/en/${p}"` : m));
  // EN 版が無いページ（index）は相対表記だと /en/index.html を指してしまう。
  // ルート相対に正規化して JA トップへ確実に戻す。
  s = s.replace(/href="index\.html"/g, 'href="/index.html"');

  // JA ハブは共有アセットを相対パスで読んでいる。/en/ に置くと /en/data-hub.js を
  // 探して 404 になり、FESTIVALS is not defined でページ全体が死ぬ。
  // ルート相対へ正規化する。?v のクエリは維持する（キャッシュバスティング §9-11）。
  s = s.replace(/(<(?:script|link)[^>]*(?:src|href)=")((?!https?:|\/|#|mailto:|data:)[a-z0-9-]+\.(?:js|css)(?:\?v=\d+)?)"/g,
    '$1/$2"');

  // 詳細ページへのリンクを EN 側へ。A1 の静的リンク一覧と、SPA が描画する
  // カードの両方が対象。EN 詳細は 206枚すべて実在する。
  s = s.replace(/href="\/(festivals|artists|venues|articles)\//g, 'href="/en/$1/');
  s = s.replace(/href="\/\$\{/g, 'href="/en/${');   // JS テンプレート内の絶対パス
  s = s.replace(/`\/(festivals|artists|venues|articles)\/\$\{/g, '`/en/$1/${');

  // 固定文言
  for (const [ja, en] of EN_HUB_TEXT) s = s.split(ja).join(en);

  // about の STATEMENT 対訳（各文は JA 内で一意であることを 2026-08-26 に確認済み）
  if (page === 'about.html') {
    for (const [ja, en] of ABOUT_EN_TEXT) {
      if (!s.includes(ja)) throw new Error(`en/about: 置換元が見つからない（JA側の文が変わった？）: ${ja.slice(0, 24)}…`);
      s = s.split(ja).join(en);
    }
  }

  const pageText = EN_PAGE_TEXT[page];
  if (pageText) {
    for (const [ja, en] of pageText) {
      const occurrences = s.split(ja).length - 1;
      if (occurrences !== 1) throw new Error(`en/${page}: 置換元の出現数が${occurrences}件（1件必須）: ${ja.slice(0, 24)}…`);
      s = s.replace(ja, en);
    }
  }
  s = s.split('メニューを開く').join('Open menu');
  s = s.split('メニューを閉じる').join('Close menu');
  s = s.split('本文へ移動').join('Skip to content');
  if (page === 'writers.html') s = s.replace('https://techno-japan.media/writers.html?sent=1', 'https://techno-japan.media/en/writers.html?sent=1');

  // hreflang: JA 側の3行を EN 視点の3行へ「置換」する。
  // 追記にすると JA から引き継いだ分と二重になる（6本出る）。
  s = s.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  s = s.replace(`<link rel="canonical" href="${BASE}/en/${page}">`,
    `<link rel="canonical" href="${BASE}/en/${page}">\n${hreflangPair(page, 'en')}`);

  // 言語トグル（JA 側と対になる形）。
  // `<span class="nav-lang">[\s\S]*?</span></span>` のような緩い正規表現は使わない。
  // nav-lang 内には </span></span> が現れないため 10KB 先まで走り、
  // 詳細ビューのマークアップ152行を巻き込んで消す事故を起こした。
  // 実際に生成される固定文字列だけを対象にする。
  const jaToggle = `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="/en/${page}">EN</a></span>`;
  const enToggle = `<span class="nav-lang"><a href="/${page}">JA</a><span class="nav-lang-sep">/</span><span class="nav-lang-cur">EN</span></span>`;
  if (!s.includes(jaToggle)) throw new Error(`${page}: 言語トグルが見つからない（JA 側の生成と不整合）`);
  s = s.split(jaToggle).join(enToggle);

  return s;
}

/* JSON-LD の description を EN 版へ。

   EN_HUB_DESC を meta 3種にしか適用しておらず、JSON-LD の description が
   JA のまま残っていた（2026-08-03、en_hub_jsonld_ja_chars で検出。
   EN ハブ4枚が日本語併記だった）。

   対象は CollectionPage.description だけにする。index.html の
   WebSite.description は「サイト全体の説明」で、ページの説明で上書きするのは
   意味的に誤り。あちらは元から英語で日本語の混入も無い。

   置換は JSON.parse で値を特定してから、その文字列リテラルだけを差し替える。
   生ブロックを正規表現で書き換えない（§9-16）。整形も行数も変わらないので、
   「JA と EN の行数を比較する」という検証がそのまま使える。 */
function replaceCollectionPageDesc(html, desc, page) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (block, json) => {
    let parsed;
    try { parsed = JSON.parse(json); } catch { return block; }   // 解析できない塊は触らない
    let out = block;
    for (const o of (Array.isArray(parsed) ? parsed : [parsed])) {
      if (!o || o['@type'] !== 'CollectionPage') continue;
      if (typeof o.description !== 'string' || o.description === desc) continue;
      const literal = JSON.stringify(o.description);
      // 見つからないなら黙って素通りさせない。JSON の整形が想定と違うということで、
      // 素通りさせると「置換したつもりで JA が残る」= 今回直している事故そのものになる。
      if (!out.includes(literal)) {
        throw new Error(`${page}: JSON-LD の description を特定できない（整形が想定と違う）`);
      }
      out = out.split(literal).join(JSON.stringify(desc));
    }
    return out;
  });
}

function hreflangPair(page, self) {
  // index の JA 版は "/" で配信される（canonical もそう書かれている）ので合わせる
  const ja = page === 'index.html' ? `${BASE}/` : `${BASE}/${page}`;
  const en = `${BASE}/en/${page}`;
  return [
    `<link rel="alternate" hreflang="${self}" href="${self === 'ja' ? ja : en}">`,
    `<link rel="alternate" hreflang="${self === 'ja' ? 'en' : 'ja'}" href="${self === 'ja' ? en : ja}">`,
    `<link rel="alternate" hreflang="x-default" href="${en}">`,
  ].join('\n');
}

/* JA ハブを正す（lang / hreflang / 言語トグル）。EN 生成の前に実行する。
   全ハブが <html lang="en"> なのに og:locale="ja_JP" という矛盾状態だった。 */
function fixJaHub(fileName) {
  const file = path.join(LP_DIR, fileName);
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  const menuKey = ({ 'index.html': 'top', 'news.html': 'news', 'festivals.html': 'festivals', 'artists.html': 'artists', 'venues.html': 'venues', 'about.html': 'about' })[fileName] || '';
  const menuStart = s.indexOf('<div class="nav-overlay"');
  const menuEndCandidates = menuStart < 0 ? [] : ['\n<!--', '\n<main', '\n<section', '\n<footer'].map((marker) => s.indexOf(marker, menuStart)).filter((index) => index >= 0);
  const menuEnd = menuEndCandidates.length ? Math.min(...menuEndCandidates) : -1;
  if (menuStart < 0 || menuEnd < 0) throw new Error(`${fileName}: nav-overlay の境界が見つからない`);
  const menu = menuOverlayHtml('ja', menuKey, `/en/${fileName}`);
  s = s.slice(0, menuStart) + menu + s.slice(menuEnd);

  // favorites.js が更新する見出しを共通部品の差し替えで失わない。
  // EN はこの JA ハブから生成するため、ここで構造を復元しておく。
  if (fileName === 'favorites.html' && !s.includes('id="page-subtitle"')) {
    s = s.replace(
      '<div class="nav-overlay"',
      '<header class="page-header">\n' +
      '  <h1 class="page-title">FAVORITES</h1>\n' +
      '  <div class="page-subtitle" id="page-subtitle">YOUR SAVED FESTIVALS · ARTISTS · VENUES</div>\n' +
      '</header>\n' +
      '<div class="nav-overlay"',
    );
  }

  s = s.replace(/<html lang="[^"]*"/, '<html lang="ja"');
  s = s.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*/, `$1${fileName === 'submit.html' ? APPLY_CSP : CSP}`);

  if (USE_BUTTONDOWN && (fileName === 'index.html' || fileName === 'news.html')) {
    s = s.replace(/(<section class="newsletter"[\s\S]*?<form class="newsletter-form")[^>]*>[\s\S]*?<\/form>([\s\S]*?<\/section>)/,
      (match, formStart, afterForm) => {
        const button = match.match(/<button type="submit">([\s\S]*?)<\/button>/)?.[1] || 'SUBSCRIBE';
        const form = [
          `${formStart} action="https://buttondown.com/api/emails/embed-subscribe/${esc(BUTTONDOWN_USERNAME)}" method="POST">`,
          '    <input type="email" name="email" required placeholder="your@email.com">',
          '    <input type="hidden" name="embed" value="1">',
          '    <input type="hidden" name="tag" value="ja">',
          `    <button type="submit">${button}</button>`,
          '  </form>',
        ].join('\n');
        return `${form}${afterForm}`;
      });
  }

  if (!/<meta name="robots" content="noindex(?:,|\")/.test(s) && !s.includes('max-image-preview:large')) {
    s = s.replace(/(<meta name="description"[^>]*>)/, '$1\n<meta name="robots" content="max-image-preview:large">');
  }

  if (fileName === 'index.html' || fileName === 'about.html') {
    s = ensureNewsMediaOrganization(s, fileName);
  }

  const canon = fileName === 'index.html'
    ? `<link rel="canonical" href="${BASE}/">`
    : `<link rel="canonical" href="${BASE}/${fileName}">`;
  if (s.includes(canon) && !s.includes('hreflang')) {
    s = s.replace(canon, `${canon}\n${hreflangPair(fileName, 'ja')}`);
  }
  // 言語トグルを nav-social の直後に置く（無ければ nav-links の末尾）
  if (!s.includes('nav-lang')) {
    const toggle = `<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="/en/${fileName}">EN</a></span>`;
    s = s.replace(/(<span class="nav-social">[\s\S]*?<\/span>)(\s*<\/div>)/, `$1\n    ${toggle}$2`);
  }
  if (s === before) return false;
  fs.writeFileSync(file, s);
  return true;
}

/* index/about は手書きのJSON-LDを持つため、JAを正規化してからENへ引き継ぐ。
   既存のWebSite / BreadcrumbListは残し、報道主体だけを独立ブロックで宣言する。 */
function ensureNewsMediaOrganization(html, page) {
  const marker = /"@type"\s*:\s*"NewsMediaOrganization"/;
  if (marker.test(html) && html.includes(`"@id": "${ORG_ID}"`)) return html;
  const block = `<script type="application/ld+json">\n${JSON.stringify(ORG_JSONLD, null, 2)}\n</script>`;
  const first = '<script type="application/ld+json">';
  if (!html.includes(first)) throw new Error(`${page}: JSON-LDの挿入位置が見つかりません`);
  return html.replace(first, `${block}\n${first}`);
}

function writeEnHub(fileName) {
  const src = fs.readFileSync(path.join(LP_DIR, fileName), 'utf8');
  const out = path.join(LP_DIR, 'en', fileName);
  const html = enHubFromJa(src, fileName);
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (cur === html) return false;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return true;
}

/* STATIC_LINKS ブロックの中身を差し替える。JA への書き出し（writeHubLinks）と
   EN 生成時のラベル差し替え（enHubFromJa）で共通に使う。
   START/END はマーカー名込みの固定文字列なので、間を [\s\S]*? で取って安全。 */
function replaceHubLinksBlock(source, markerName, html, label) {
  const start = `<!-- STATIC_LINKS:${markerName}:START -->`;
  const end = `<!-- STATIC_LINKS:${markerName}:END -->`;
  const pattern = new RegExp(`${start}[\\s\\S]*?${end}`);
  if (!pattern.test(source)) {
    throw new Error(`${label}: 静的リンクの生成マーカーが見つかりません`);
  }
  return source.replace(pattern, `${start}\n${html}\n${end}`);
}

function festivalHubExtraBlock(festivals) {
  const today = todayInJapan();
  const desc = {};
  for (const festival of festivals) {
    const range = String(festival.date || '').split('/');
    const end = range[1] || range[0];
    if (!ISO_DATE.test(range[0]) || !ISO_DATE.test(end) || end < today) continue;
    if (festival.desc || festival.desc_en) {
      desc[festival.id] = {
        ...(festival.desc ? { ja: truncate(festival.desc, 160) } : {}),
        ...(festival.desc_en ? { en: truncateAtWord(festival.desc_en, 280) } : {}),
      };
    }
  }
  const allDates = { ...CONTENT_DATES, ...CONTENT_DATE_UPDATES };
  const updated = Object.entries(allDates)
    .filter(([key]) => key.startsWith('festival:'))
    .map(([, value]) => value.date)
    .filter(Boolean)
    .sort()
    .pop() || '';
  const json = JSON.stringify({ updated, desc }).replace(/<\/script/gi, '<\\/script');
  return `<!-- HUB_EXTRA:FESTIVALS:START -->\n<script type="application/json" id="festival-hub-extra">${json}</script>\n<!-- HUB_EXTRA:FESTIVALS:END -->`;
}

function replaceFestivalHubExtra(source, block, label) {
  const pattern = /<!-- HUB_EXTRA:FESTIVALS:START -->[\s\S]*?<!-- HUB_EXTRA:FESTIVALS:END -->/;
  if (!pattern.test(source)) throw new Error(`${label}: FESTIVALS HUB_EXTRA marker missing`);
  return source.replace(pattern, block);
}

function writeHubLinks(fileName, markerName, html) {
  const file = path.join(LP_DIR, fileName);
  const source = fs.readFileSync(file, 'utf8');
  const next = replaceHubLinksBlock(source, markerName, html, fileName);
  if (next === source) return false;
  fs.writeFileSync(file, next);
  return true;
}


/* ==============================================================
   AI検索向けの機械可読データ（llms.txt / events.json）
   ==============================================================

   生成AI検索（ChatGPT / Perplexity / AI Overviews）は「一覧を1回で
   読める場所」を強く好む。HTML を473ページ巡回させるより、
   要点をまとめた2ファイルを置くほうが引用されやすい。AUDIT §9-79。

   ・events.json … 今後の開催回（日付・場所・座標・チケット）。日付昇順
   ・llms.txt    … サイトの説明と主要な入口（llmstxt.org の慣行に沿う）

   **タイムスタンプを埋めない。**毎日の再生成コミット（generate-meta）で
   中身が変わっていないのに毎回差分が出る、を避ける。 */
function buildAiSurface({ pubFests, editionsByFestival, pubVenues, pubArtists, pubArticles }) {
  const today = todayInJapan();
  const events = [];
  for (const f of pubFests) {
    for (const ed of (editionsByFestival.get(String(f.id)) || [])) {
      const start = String(ed.DATE_START || '');
      if (!ISO_DATE.test(start)) continue;
      const end = ISO_DATE.test(String(ed.DATE_END || '')) ? ed.DATE_END : start;
      if (end < today) continue;                                   // 終わった回は載せない
      if (String(ed.STATUS || '').trim().toLowerCase() === 'cancelled') continue;
      events.push({
        name: `${f.name} ${editionLabel(editionIdentifier(ed))}`.trim(),
        url: `${BASE}/festivals/${encodeURIComponent(f.id)}.html`,
        start,
        end,
        ...(ed.LOCATION ? { venue: ed.LOCATION } : {}),
        ...(ed.PREF ? { pref: ed.PREF } : {}),
        ...(Number(ed.LAT) && Number(ed.LNG) ? { lat: Number(ed.LAT), lng: Number(ed.LNG) } : {}),
        ...(Array.isArray(f.genre) && f.genre.length ? { genres: f.genre } : {}),
        ...(ed.TICKETURL ? { tickets: ed.TICKETURL } : {}),
      });
    }
  }
  events.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));

  const eventsJson = JSON.stringify({
    source: `${BASE}/`,
    license: 'データの出典として techno-japan.media へのリンクを求めます',
    count: events.length,
    events,
  }, null, 2) + '\n';

  const lines = [
    '# TECHNO JAPAN',
    '',
    `> 日本のテクノ / ハウスの独立メディア。フェスティバル${pubFests.length}件・`,
    `> アーティスト${pubArtists.length}名・会場${pubVenues.length}件・記事${pubArticles.length}本を日英で掲載し、`,
    '> 開催日・場所・出演者を構造化データ（schema.org）付きで公開している。',
    '',
    `## 今後の開催予定（${events.length}件）`,
    '',
    ...events.slice(0, 40).map((e) =>
      `- ${e.start}${e.end !== e.start ? `〜${e.end}` : ''}: [${e.name}](${e.url})` +
      `${e.venue ? ` — ${e.venue}` : ''}${e.pref ? `, ${e.pref}` : ''}`),
    ...(events.length > 40 ? [`- …ほか ${events.length - 40} 件は events.json を参照`] : []),
    '',
    '## 一覧',
    '',
    `- [Festivals](${BASE}/festivals.html)`,
    `- [Artists](${BASE}/artists.html)`,
    `- [Venues](${BASE}/venues.html)`,
    `- [News](${BASE}/news.html)`,
    `- [Club Map](${BASE}/map.html)`,
    `- [English](${BASE}/en/)`,
    '',
    '## 最新記事',
    '',
    ...[...pubArticles]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 20)
      .map((a) => {
        const title = String(a.title || a.id || '').replace(/\s+/g, ' ').trim();
        const excerpt = stripTags(a.excerpt || '').replace(/\s+/g, ' ').trim();
        const ja = `${BASE}/articles/${encodeURIComponent(a.id)}.html`;
        const hasEn = !!(a.title_en || a.body_en);
        const en = hasEn ? ` / [EN](${BASE}/en/articles/${encodeURIComponent(a.id)}.html)` : '';
        return `- ${a.date || ''}: [${title}](${ja}) — ${excerpt}${en}`;
      }),
    '',
    '## 機械可読データ',
    '',
    `- [Events (JSON)](${BASE}/events.json): 今後の開催回。日付・場所・座標・チケットURL`,
    `- [Sitemap](${BASE}/sitemap.xml)`,
    `- [RSS](${BASE}/rss.xml)`,
    '',
  ];
  const llmsTxt = lines.join('\n');

  const writeIfChanged = (file, content) => {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
    fs.writeFileSync(file, content);
    return true;
  };
  const w1 = writeIfChanged(path.join(LP_DIR, 'events.json'), eventsJson);
  const w2 = writeIfChanged(path.join(LP_DIR, 'llms.txt'), llmsTxt);
  console.log(`AI surface: events.json ${events.length}件 (${w1 ? 'updated' : 'unchanged'}), llms.txt (${w2 ? 'updated' : 'unchanged'})`);
}


function main() {
  IMAGE_DIMENSIONS = loadImageDimensions();
  CARD_DERIVATIVES = loadCardDerivatives();
  const data = loadData();
  const AUTHORS = loadOptionalItems(AUTHORS_PATH, 'authors.json');
  data.AUTHORS = AUTHORS;
  const { ARTISTS = [], FESTIVALS = [], VENUES = [], ARTICLES = [] } = data;
  console.log(`Hub data: ${writeHubDataJs(data) ? 'updated' : 'unchanged'}`);
  const EDITIONS = loadItems(EDITIONS_PATH, 'editions.json');
  const LINEUPS = loadItems(LINEUPS_PATH, 'lineups.json');
  const ALL_ARTISTS = loadItems(ARTISTS_PATH, 'artists.json');

  // 安全弁: data.js の主要配列が空なのに既存ページが大量にある場合、
  // 生成を続けると writeAll の掃除で全ページ削除→本番404になる
  // （2026-07-23〜30 のフェス全消失事故の再発防止・CI側の最後の砦）。
  for (const [name, arr, dir] of [['FESTIVALS', FESTIVALS, 'festivals'], ['ARTISTS', ARTISTS, 'artists'], ['VENUES', VENUES, 'venues']]) {
    const existing = fs.existsSync(path.join(LP_DIR, dir)) ? fs.readdirSync(path.join(LP_DIR, dir)).filter((f) => f.endsWith('.html')).length : 0;
    if (arr.length === 0 && existing > 10) {
      console.error(`⛔ ${name} が data.js で0件ですが既存ページが${existing}件あります。` +
        `シート/Publishの障害の可能性が高いため、ページ削除を防ぐべく生成を中断します。`);
      process.exit(1);
    }
  }

  const valid = (x) => x && x.id && String(x.id).trim();
  const festivalIds = new Set(FESTIVALS.filter(valid).map((f) => String(f.id)));
  const editionIds = new Set();
  const editionsByFestival = new Map();
  for (const ed of EDITIONS) {
    if (!ed.EDITION_ID || !ed.FESTIVAL_ID) throw new Error('editions.json: EDITION_ID / FESTIVAL_ID が空の行があります');
    if (editionIds.has(ed.EDITION_ID)) throw new Error(`editions.json: EDITION_ID 重複 "${ed.EDITION_ID}"`);
    if (!festivalIds.has(String(ed.FESTIVAL_ID))) throw new Error(`editions.json: FESTIVAL_ID 参照切れ "${ed.FESTIVAL_ID}"`);
    editionIds.add(ed.EDITION_ID);
    if (!editionsByFestival.has(ed.FESTIVAL_ID)) editionsByFestival.set(ed.FESTIVAL_ID, []);
    editionsByFestival.get(ed.FESTIVAL_ID).push(ed);
  }
  const lineupsByEdition = new Map();
  for (const row of LINEUPS) {
    const key = String(row.EDITION_ID || '');
    if (!lineupsByEdition.has(key)) lineupsByEdition.set(key, []);
    lineupsByEdition.get(key).push(row);
  }
  const festivalData = buildEventFestivalData({ festivals: FESTIVALS, editionsByFestival, lineupsByEdition, artists: ARTISTS });
  const artistData = buildArtistCardData(ARTISTS);
  const resolveEntities = makeEntityResolver({ ARTISTS, FESTIVALS, VENUES, ARTICLES }, festivalData, artistData);
  validateArticleShortcodes({ ARTISTS, FESTIVALS, VENUES, ARTICLES });
  const authorIndex = buildAuthorIndex(AUTHORS, ARTICLES);

  // CMS未接続のローカル確認用。通常ビルドには一切含めず、reports配下へ
  // JA/ENの静的ページだけを書き出す。公開データのdraft除外ルールは維持する。
  if (DRAFT_PREVIEW_PATH) {
    const draft = loadDraftPreview(DRAFT_PREVIEW_PATH);
    const jaEvents = parseEvents(draft.body || '');
    const enEvents = parseEvents(draft.body_en || draft.body || '');
    if (jaEvents.length < 5 || enEvents.length < 5) {
      throw new Error(`draft preview: JA/ENともイベントカード5件以上が必要です (JA=${jaEvents.length}, EN=${enEvents.length})`);
    }
    fs.rmSync(DRAFT_PREVIEW_DIR, { recursive: true, force: true });
    for (const lang of ['ja', 'en']) {
      const built = articlePage(draft, resolveEntities, lang, FESTIVALS, editionsByFestival, [], festivalData, ARTICLES, ARTISTS, authorIndex, lineupsByEdition, ALL_ARTISTS);
      const relative = path.relative(LP_DIR, built.file);
      const file = path.join(DRAFT_PREVIEW_DIR, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, built.html);
      console.log(`Draft preview ${lang}: ${file}`);
    }
    console.log(`Draft preview events: JA=${jaEvents.length}, EN=${enEvents.length}`);
    return;
  }

  const pubArticles = ARTICLES.filter(valid).filter((a) => a.status !== 'draft');
  const pubFests = FESTIVALS.filter(valid);
  const pubArtists = ARTISTS.filter(valid);
  const pubVenues = VENUES.filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined');
  const pubAuthors = [...authorIndex.values()].filter((author) => author.stories.length > 0);
  const artistsById = new Map(pubArtists.map((artist) => [String(artist.id), artist]));
  const allArtistsById = new Map(ALL_ARTISTS.map((artist) => [String(artist.ID || artist.id || '').trim(), artist]).filter(([id]) => id));
  const festivalsById = new Map(pubFests.map((festival) => [String(festival.id), festival]));
  const editionById = new Map(EDITIONS.map((edition) => [String(edition.EDITION_ID), edition]));
  const appearMap = new Map();
  const artistAppearances = new Map();
  const missingArtistRefs = new Map();
  const unpublishedArtistRefs = new Map();
  for (const row of LINEUPS) {
    const edition = editionById.get(String(row.EDITION_ID || ''));
    if (!edition) throw new Error(`lineups.json: EDITION_ID 参照切れ "${row.EDITION_ID || ''}"`);
    // ⚠ lineupsByEdition への push はここでしない。2026-09-11、イベントカード用の
    // 早いループ（buildEventFestivalData の前）に集約した際、この行を残して
    // **全フェスの LINEUP が2重表示**になった。登録は1箇所だけに保つこと。

    if (isCompositeLineup(row)) continue;
    const artistId = lineupArtistIds(row)[0];
    if (!artistId) continue;
    if (!artistsById.has(artistId) && allArtistsById.has(artistId)) {
      const refs = unpublishedArtistRefs.get(artistId) || [];
      refs.push(String(row.EDITION_ID || ''));
      unpublishedArtistRefs.set(artistId, refs);
      continue;
    }
    if (!artistsById.has(artistId)) {
      const refs = missingArtistRefs.get(artistId) || [];
      refs.push(String(row.EDITION_ID || ''));
      missingArtistRefs.set(artistId, refs);
      continue;
    }
    const festival = festivalsById.get(String(edition.FESTIVAL_ID));
    if (!festival) throw new Error(`lineups.json: FESTIVAL_ID 参照切れ "${edition.FESTIVAL_ID}"`);
    if (!appearMap.has(artistId)) appearMap.set(artistId, new Map());
    appearMap.get(artistId).set(festival.id, festival);
    if (!artistAppearances.has(artistId)) artistAppearances.set(artistId, []);
    const appearanceKey = `${artistId}\u0000${String(edition.EDITION_ID)}`;
    const existingAppearances = artistAppearances.get(artistId);
    if (existingAppearances.some((item) => item.key === appearanceKey)) continue;
    existingAppearances.push({
      key: appearanceKey,
      festival,
      edition,
      upcoming: !ISO_DATE.test(String(edition.DATE_END || '')) || String(edition.DATE_END || '') >= jstToday(),
    });
  }
  if (missingArtistRefs.size) {
    const details = [...missingArtistRefs.entries()]
      .map(([id, editions]) => `  - ${id}: ${[...new Set(editions)].join(', ')}`)
      .join('\n');
    throw new Error(`lineups.json: ARTIST_ID 参照切れ ${missingArtistRefs.size}件。ARTISTSシートに追加するか、LINEUPSのIDを修正してください。\n${details}`);
  }
  if (unpublishedArtistRefs.size) {
    const ids = [...unpublishedArtistRefs.keys()].sort();
    const count = ids.length;
    console.log(`Lineup: 非公開アーティスト ${count}件はリンク無しで表示 (${ids.join(', ')})`);
  }
  prepareContentDateSnapshots({ pubFests, pubArtists, pubVenues, editionsByFestival, lineupsByEdition, artistAppearances });
  XLINK = {
    fests: FESTIVALS,
    venues: VENUES,
    appearMap: new Map([...appearMap].map(([artistId, festivals]) => [artistId, [...festivals.values()]])),
  };

  // ID変更に伴う旧URLのリダイレクトスタブ（writeAll の掃除で消されないよう wanted に含める）
  // { dir: { oldId: newId } }
  const REDIRECTS = {
    articles: { transcendence: 'transcendence-2025-report' },
    // 一括登録時に ID 欄へ NAME をそのまま貼ってしまった7件（大文字・スペース入り、
    // DATA_SCHEMA §1.1 違反）。URL に %20 が出ていたため slug へ修正した。
    // 発行済みIDの変更なので旧URLからのリダイレクトを必ず残す。
    artists: ARTIST_ID_FIXES,
    'en/artists': ARTIST_ID_FIXES,
    festivals: FESTIVAL_ID_FIXES,
    'en/festivals': FESTIVAL_ID_FIXES,
  };
  // 旧IDがまだ data.js に現役で存在する間はスタブを出さない。
  // writeAll は basename をキーにした Map で後勝ちになるため、スタブを出すと
  // 同名の本物のページを上書きし、まだ存在しない新URLへ飛ばす壊れたページになる。
  // 新IDが未登場の間も出さない（リダイレクト先が 404 になるため）。
  // これにより CMS の Publish Now より先にこのパッチを入れても安全で、
  // Publish 後は次回ビルドで自動的にスタブが出る。
  const redirectStubs = (dirName, liveIds = new Set()) =>
    Object.entries(REDIRECTS[dirName] || {})
      .filter(([oldId, newId]) => !liveIds.has(oldId) && liveIds.has(newId))
      .map(([oldId, newId]) => {
      const to = `/${dirName}/${newId}.html`;
      return {
        file: path.join(LP_DIR, dirName, `${oldId}.html`),
        html: `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Permissions-Policy" content="${PERMISSIONS_POLICY}">
${FAVICON_TAGS}
<title>Redirecting…</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${BASE}${to}">
<meta http-equiv="refresh" content="0; url=${to}">
</head><body><p>Moved: <a href="${to}">${BASE}${to}</a></p></body></html>
`,
      };
    });

  // リダイレクトスタブの衝突判定に使う「現役ID」の集合
  const liveArticleIds = new Set(pubArticles.map((a) => a.id));
  const liveArtistIds = new Set(pubArtists.map((a) => a.id));
  const liveFestivalIds = new Set(pubFests.map((f) => f.id));

  const counts = {
    articles: writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'ja', pubFests, editionsByFestival, pubVenues, festivalData, ARTICLES, ARTISTS, authorIndex, lineupsByEdition, ALL_ARTISTS)).concat(redirectStubs('articles', liveArticleIds)), 'articles'),
    festivals: writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, allArtistsById, ARTICLES, pubFests, editionsByFestival, 'ja')).concat(redirectStubs('festivals', liveFestivalIds)), 'festivals'),
    artists: writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'ja', artistAppearances, editionsByFestival, pubArticles)).concat(redirectStubs('artists', liveArtistIds)), 'artists'),
    venues: writeAll(pubVenues.map((v) => venuePage(v, 'ja', pubFests, editionsByFestival, pubArticles, lineupsByEdition, artistsById, allArtistsById)), 'venues'),
    writers: writeAll(pubAuthors.map((author) => writerPage(author, 'ja', authorIndex)), 'writers'),
    // 英語版（/en/…）。未翻訳フィールドは articlePage 内で元データへ
    // フォールバックし、EN ハブの通常遷移先を必ず実在させる。
    'en/articles': writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'en', pubFests, editionsByFestival, pubVenues, festivalData, ARTICLES, ARTISTS, authorIndex, lineupsByEdition, ALL_ARTISTS)), 'en/articles'),
    'en/festivals': writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, allArtistsById, ARTICLES, pubFests, editionsByFestival, 'en')).concat(redirectStubs('en/festivals', liveFestivalIds)), 'en/festivals'),
    'en/artists': writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'en', artistAppearances, editionsByFestival, pubArticles)).concat(redirectStubs('en/artists', liveArtistIds)), 'en/artists'),
    'en/venues': writeAll(pubVenues.map((v) => venuePage(v, 'en', pubFests, editionsByFestival, pubArticles, lineupsByEdition, artistsById, allArtistsById)), 'en/venues'),
    'en/writers': writeAll(pubAuthors.map((author) => writerPage(author, 'en', authorIndex)), 'en/writers'),
  };
  writeContentDates();

  const today = todayInJapan();
  const upcomingTopFests = pubFests
    .map((festival) => {
      const edition = (editionsByFestival.get(String(festival.id)) || [])
        .filter((ed) => {
          const start = String(ed.DATE_START || '');
          const end = ISO_DATE.test(String(ed.DATE_END || '')) ? ed.DATE_END : start;
          return ISO_DATE.test(start) && end >= today && String(ed.STATUS || '').trim().toLowerCase() !== 'cancelled';
        })
        .sort((a, b) => String(a.DATE_START).localeCompare(String(b.DATE_START)))[0];
      return edition ? { festival, edition } : null;
    })
    .filter(Boolean)
    .sort((a, b) => String(a.edition.DATE_START).localeCompare(String(b.edition.DATE_START)))
    .slice(0, 12);
  const latestTopArticles = [...pubArticles]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 8);
  const topLinksJa = topLinkList([
    ...upcomingTopFests.map(({ festival, edition }) => ({
      href: `/festivals/${encodeURIComponent(festival.id)}.html`,
      label: festivalHubLabel(festival, [edition]),
    })),
    ...latestTopArticles.map((article) => ({
      href: `/articles/${encodeURIComponent(article.id)}.html`,
      label: article.title || article.id || '',
    })),
  ]);

  const hubCounts = {
    'index.html': {
      total: upcomingTopFests.length + latestTopArticles.length,
      written: writeHubLinks('index.html', 'TOP', topLinksJa),
    },
    'news.html': {
      total: pubArticles.length,
      written: writeHubLinks('news.html', 'ARTICLES', hubLinkList(pubArticles, 'articles', (a) => a.title || '')),
    },
    'festivals.html': {
      total: pubFests.length,
      written: writeHubLinks('festivals.html', 'FESTIVALS', hubLinkList(pubFests, 'festivals', (f) => festivalHubLabel(f, editionsByFestival.get(f.id) || []))),
    },
    'artists.html': {
      total: pubArtists.length,
      written: writeHubLinks('artists.html', 'ARTISTS', hubLinkList(pubArtists, 'artists', (a) => a.name || '')),
    },
    'venues.html': {
      total: pubVenues.length,
      written: writeHubLinks('venues.html', 'VENUES', hubLinkList(pubVenues, 'venues', (v) => v.name || '')),
    },
  };
  const festivalExtra = festivalHubExtraBlock(pubFests);
  const festivalHubFile = path.join(LP_DIR, 'festivals.html');
  const festivalHubSource = fs.readFileSync(festivalHubFile, 'utf8');
  fs.writeFileSync(festivalHubFile, replaceFestivalHubExtra(festivalHubSource, festivalExtra, 'festivals.html'));

  // EN ハブ用のラベル。JA と同じ items・同じ順序で、ラベルだけ EN 規則にする。
  // 件数や順序を変えると en_hub_leaks_to_ja や静的リンク数の検査とズレるため、
  // hubLinkList の呼び出し方は JA 側と対称に保つこと。
  const topLinksEn = topLinkList([
    ...upcomingTopFests.map(({ festival, edition }) => ({
      href: `/festivals/${encodeURIComponent(festival.id)}.html`,
      label: festivalHubLabel(festival, [edition], 'en'),
    })),
    ...latestTopArticles.map((article) => ({
      href: `/articles/${encodeURIComponent(article.id)}.html`,
      label: article.title_en || article.title || article.id || '',
    })),
  ]);
  EN_HUB_LINKS = {
    'index.html': { marker: 'TOP', html: topLinksEn },
    'news.html': { marker: 'ARTICLES', html: hubLinkList(pubArticles, 'articles', (a) => a.title_en || a.title || '') },
    'festivals.html': { marker: 'FESTIVALS', html: hubLinkList(pubFests, 'festivals', (f) => festivalHubLabel(f, editionsByFestival.get(f.id) || [], 'en')) },
    'artists.html': { marker: 'ARTISTS', html: hubLinkList(pubArtists, 'artists', (a) => a.name_en || a.name || '') },
    'venues.html': { marker: 'VENUES', html: hubLinkList(pubVenues, 'venues', (v) => v.name_en || v.name || '') },
  };

  // JA ハブを正してから EN を作る。順序が逆だと、直す前の JA から EN が生まれる。
  // 静的リンクの差し替え（上の hubCounts）も EN へ引き継ぐため、この位置に置く。
  const STATIC_CHROME_PAGES = [
    'index.html', 'about.html', 'submit.html', 'festivals.html', 'artists.html', 'venues.html',
    'news.html', 'about.html', 'submit.html', 'writers.html', 'favorites.html', '404.html',
  ];
  const staticChromeUpdated = STATIC_CHROME_PAGES.filter((fileName, index, all) =>
    all.indexOf(fileName) === index && normalizeStaticChrome(fileName, fileName === '404.html' ? 'en' : 'ja'));
  const HUBS = ['index.html', 'about.html', 'submit.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html', 'writers.html', 'favorites.html'];
  const jaFixed = HUBS.filter(fixJaHub);
  const enWritten = HUBS.filter(writeEnHub);
  console.log(`Shared chrome: ${staticChromeUpdated.length} JA pages normalized (app/cms/map/redirect stubs excluded)`);

  buildAiSurface({ pubFests, editionsByFestival, pubVenues, pubArtists, pubArticles });

  console.log('Detail pages:');
  let total = 0, written = 0, removed = 0;
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v.total} pages (updated ${v.written}, removed ${v.removed})`);
    total += v.total; written += v.written; removed += v.removed;
  }
  console.log(`  total: ${total} pages — ${written} written, ${removed} removed`);
  if (rewrittenEditionFlyers.size) {
    // シートの拡張子が原本(jpg等)のまま。表示は webp で通しているが、
    // シート側の拡張子を直せば、この読み替えは不要になる。
    console.log(`EDITIONS.FLYER の拡張子を実体(.webp)に読み替えた: ${rewrittenEditionFlyers.size}件`);
    for (const m of [...rewrittenEditionFlyers].sort()) console.log(`  - ${m}`);
  }
  if (missingEditionFlyers.size) {
    // 実ファイルが無いので表示できず、フェス共通のフライヤーに落としたもの。
    // 黙って落とすと「入れたのに出ない」が続くため、毎ビルドで出す。
    console.log(`EDITIONS.FLYER のファイルが無く共通フライヤーに落とした: ${missingEditionFlyers.size}件`);
    for (const m of [...missingEditionFlyers].sort()) console.log(`  - ${m}`);
  }
  console.log(`JA hubs fixed (lang/hreflang/toggle): ${jaFixed.length ? jaFixed.join(', ') : 'none'}`);
  console.log(`EN hubs written: ${enWritten.length ? enWritten.join(', ') : 'none (up to date)'}`);
  console.log('Hub static links:');
  for (const [file, result] of Object.entries(hubCounts)) {
    console.log(`  ${file}: ${result.total} links (${result.written ? 'updated' : 'unchanged'})`);
  }
}

main();
