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
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { imageSizeAttrs } from './lib/image-size.mjs';

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
const DETAIL_CSS_VERSION = 8;

/* 記事ページの演出アセット。**べた書きしないこと。**

   2026-08-07〜08 のデプロイ失敗6件のうち3件がこれだった。
   生成側が `?v=1` `?v=2` を文字列で埋めていたため、
   article-fx を編集して HTML の ?v を手で上げても、
   **次のビルドで元に戻る。** 直したつもりが直っていない状態が続いた。
   検査（check_asset_versions.py）は毎回正しく落としていたのに、
   落ちる場所と直す場所がずれていて原因に辿り着けなかった。AUDIT §9-58。

   article-fx.js / article-fx.css を変更したら、ここを上げる。 */
const ARTICLE_FX_JS_VERSION = 5;
const ARTICLE_FX_CSS_VERSION = 6;

/* 全ページ共通アセットの版。ここも同じ理由でべた書きしない
   （変更しても次のビルドで戻り、直したつもりが直らない）。 */
const COMMON_JS_VERSION = 3;
const COMMON_CSS_VERSION = 8;   // 2026-08-14 ヘッダーのロゴを画像化（nav .logo img）
const LANG_TOGGLE_VERSION = 1;
const EDITIONS_PATH = path.join(LP_DIR, 'data', 'editions.json');
const LINEUPS_PATH = path.join(LP_DIR, 'data', 'lineups.json');
const IMAGE_DIMENSIONS_PATH = path.join(LP_DIR, 'image-dimensions.json');
const BASE = 'https://techno-japan.media';

// 詳細ページとハブのJSテンプレートが同じ最新寸法を参照できるよう、
// ページ生成のたびに実画像から派生メタデータを先に再生成する。
await import('./build-image-dimensions.mjs');
// ブランドロゴ（Organization.logo 用）と OGP フォールバック画像は役割が違うので分ける。
// ロゴは正方形のブランド識別子、OGP は SNS カード向けの横長ビジュアル。
// ロゴを差し替えるときはこのパスのファイルを置き換えるだけでよい（URL は変えない）。
const ORG_LOGO = `${BASE}/images/logo-512.png?v=2`;
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

function loadItems(file, label) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!data || !Array.isArray(data.items)) throw new Error(`${label}: items 配列がありません`);
  if (Number.isFinite(data.count) && data.count !== data.items.length) {
    throw new Error(`${label}: count=${data.count} と items=${data.items.length} が一致しません`);
  }
  return data.items;
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
  return hit ? hit.src : String(source || '').trim().replace(/^\/+/, '');
}
/* 関連カードは実測 324px 幅で表示される。960px を全端末へ配らない。 */
function cardSrcsetAttr(source) {
  const hit = cardEntry(source);
  if (!hit || !hit.srcset || !hit.srcset.length) return '';
  const set = hit.srcset.map(([p, w]) => `/${p} ${w}w`).join(', ');
  return ` srcset="${esc(set)}" sizes="(max-width: 700px) 100vw, 360px"`;
}

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

function addHtmlImageDimensions(html) {
  return String(html || '').replace(/<img\b(?![^>]*\bwidth=)([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (tag, before, quote, src, after) => {
    const attrs = dimensionAttrs(src);
    if (!attrs) throw new Error(`画像寸法メタデータがありません: ${src}`);
    return `<img ${attrs}${before}src=${quote}${src}${quote}${after}>`;
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
        <button type="button" class="lang-btn${act('ja')}" data-lang="ja">日本語</button>
        <button type="button" class="lang-btn${act('en')}" data-lang="en">ENGLISH</button>
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
function makeEntityResolver(data) {
  const table = { festival: data.FESTIVALS || [], artist: data.ARTISTS || [], venue: data.VENUES || [], article: data.ARTICLES || [] };
  return (html) => String(html || '').replace(/\[\[(festival|artist|venue|article):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, type, id, label) => {
    const rec = (table[type] || []).find((x) => x.id === id);
    const name = label || (rec && (rec.name || rec.title)) || id;
    const dir = type === 'article' ? 'articles' : type + 's';
    return `<a class="entity-link" href="/${dir}/${id}.html">${esc(name)}</a>`;
  });
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
    }
  }
  if (errors.length) {
    throw new Error(`記事本文の shortcode 参照切れ（${errors.length}件）:\n  - ${errors.join('\n  - ')}`);
  }
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('/')[0].split('-').map(Number);
  if (!y || !m || !day) return '';
  return `${MONTHS[m - 1]} ${day}, ${y}`;
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

const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' https:; connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net; frame-src 'self' https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com; base-uri 'self'; object-src 'none'; upgrade-insecure-requests`;

/* 詳細ページの nav。EN ページでは EN 版が実在するリンク先だけ /en/ へ向ける。
   EN_PAGES に無いもの（index.html）は JA のままにして 404 を作らない。
   これを入れる前は EN 詳細206枚の nav が全て JA を指しており、
   英語ユーザーはどこを押しても日本語ページに出てしまっていた。 */
function navLink(lang, page) {
  return (lang === 'en' && EN_PAGES.has(page)) ? `/en/${page}` : `/${page}`;
}

function navHtml(lang, altHref) {
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
    ${toggle}
  </div>
  <button class="nav-hamburger" aria-label="Open menu" onclick="document.querySelector('.nav-overlay').classList.toggle('active');this.classList.toggle('active')"><span></span><span></span><span></span></button>
</nav>
<div class="nav-overlay">
  <button class="nav-close" aria-label="Close menu" onclick="document.querySelector('.nav-overlay').classList.remove('active');document.querySelector('.nav-hamburger').classList.remove('active')"></button>
  <a href="${navLink(lang, 'index.html')}">TOP</a>
  <a href="${navLink(lang, 'news.html')}">NEWS</a>
  <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
  <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
  <a href="${navLink(lang, 'venues.html')}">VENUES</a>
  <a href="${navLink(lang, 'about.html')}">ABOUT</a>
${toggle ? `  ${toggle}\n` : ''}</div>`;
}

function footerHtml(lang) {
  const submissionHref = lang === 'en' ? '/en/submit.html' : '/submit.html';
  const submissionLabel = lang === 'en' ? 'Festival Submission' : 'FESTIVAL 掲載申請';
  return `<footer>
  <div class="footer-top">
    <div class="footer-logo"><img src="/images/logo-wordmark.png?v=1" alt="TECHNO JAPAN" width="158" height="13" loading="lazy" decoding="async"></div>
    <div class="footer-links">
      <a href="${navLink(lang, 'index.html')}">TOP</a>
      <a href="${navLink(lang, 'news.html')}">NEWS</a>
      <a href="${navLink(lang, 'festivals.html')}">FESTIVALS</a>
      <a href="${navLink(lang, 'artists.html')}">ARTISTS</a>
      <a href="${navLink(lang, 'venues.html')}">VENUES</a>
      <a href="${navLink(lang, 'about.html')}">ABOUT</a>
      <a href="${submissionHref}">${submissionLabel}</a>
    </div>
    <div class="footer-copy">&copy; 2025 TECHNO JAPAN. ALL RIGHTS RESERVED.</div>
  </div>
</footer>`;
}

const GA = `<script>
(function(){
  if (navigator.webdriver) return;
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



function page({ title, desc, canonical, image, ogType = 'article', jsonLd, body, lang = 'ja', altHref = null, extraScripts = '', backgroundLayer = false }) {
  const d = truncate(desc || '', 160);
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

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@200;300;400;500&family=Space+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css?v=${COMMON_CSS_VERSION}">
<link rel="stylesheet" href="/detail.css?v=${DETAIL_CSS_VERSION}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
${backgroundLayer ? '<div class="tj-bg" aria-hidden="true"><div class="tj-scan"></div></div>\n' : ''}${navHtml(lang, altHref)}
${body}
${footerHtml(lang)}
${GA}
<script src="/common.js?v=${COMMON_JS_VERSION}" defer></script>${extraScripts}
</body>
</html>
`;
}

/* ---------- 記事ページ ---------- */
function articlePage(a, resolveEntities, lang = 'ja', festivals = [], editionsByFestival = new Map()) {
  // EN版は title_en / excerpt_en / body_en を使う（無い項目はJAへフォールバック）
  const L = lang === 'en'
    ? { title: a.title_en || a.title, excerpt: a.excerpt_en || a.excerpt, body: a.body_en || a.body, prefix: '/en' }
    : { title: a.title, excerpt: a.excerpt, body: a.body, prefix: '' };
  const hasAlt = lang === 'ja' ? !!(a.title_en || a.body_en) : true;
  const altHref = hasAlt ? (lang === 'ja' ? `/en/articles/${a.id}.html` : `/articles/${a.id}.html`) : null;
  const canonical = `${BASE}${L.prefix}/articles/${a.id}.html`;
  const hubHref = `${L.prefix}/news.html`;
  const title = `${L.title} — TECHNO JAPAN`;
  const desc = L.excerpt || truncate(stripTags(L.body), 160);
  const image = absUrl(a.image);
  const tags = (a.tags || []).map((t) => `<span class="article-tag">#${esc(t)}</span>`).join('');
  const authorName = a.author || 'TECHNO JAPAN';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: L.title,
    description: desc,
    image: [image],
    inLanguage: lang,
    datePublished: a.date,
    dateModified: a.updated || a.date,
    author: { '@type': /TECHNO JAPAN/i.test(authorName) ? 'Organization' : 'Person', name: authorName },
    publisher: {
      '@type': 'Organization',
      name: 'TECHNO JAPAN',
      url: `${BASE}/`,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
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

  const heroBlock = a.image
    ? `<header class="article-hero"${ratioAttr(a.heroRatio)}>
        <img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}" alt="${esc(L.title)}" fetchpriority="high" decoding="async">
        <div class="article-hero-overlay">
          <div class="article-chips"><span class="cat-pill">${esc(a.category || 'NEWS')}</span></div>
          <h1>${esc(L.title)}</h1>
        </div>
      </header>`
    : `<div class="article-meta-top"><span class="cat-pill">${esc(a.category || 'NEWS')}</span></div><h1>${esc(L.title)}</h1>`;

  /* 記事に紐づくフェス（ARTICLES.festivalId）。

     紐づけ自体は前からあり、**フェス側の「RELATED STORIES」だけが**
     それを使っていた。記事 → フェスの導線は無く、片方向だった
     （2026-08-07 / AUDIT §9-55）。詳細 → 詳細が繋がらない状態は
     §9-23 で回遊が切れたときと同じ形なので、対にしておく。

     カード画像はハブと同じ縮小版を使う（§9-51）。 */
  const relatedFestival = String(a.festivalId || '').trim()
    ? (festivals || []).find((f) => String(f.id) === String(a.festivalId).trim())
    : null;
  const relatedFestivalHtml = relatedFestival ? (() => {
    const feds = [...(editionsByFestival.get(relatedFestival.id) || [])].sort((x, y) =>
      String(y.DATE_START || '').localeCompare(String(x.DATE_START || '')));
    const cur = feds[0];
    const fname = lang === 'en' ? (relatedFestival.name_en || relatedFestival.name) : relatedFestival.name;
    const img = relatedFestival.image || relatedFestival.flyer;
    const place = [
      cur ? editionLocationName(cur, lang) : localizedValue(relatedFestival.location, relatedFestival.location_ja, '', lang),
      cur?.PREF || relatedFestival.city,
    ].filter(Boolean).join(' — ');
    const when = cur?.DATE_START
      ? [cur.DATE_START, cur.DATE_END].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' — ')
      : (relatedFestival.date || '');
    return `<div class="related-festival">
      <h2>${lang === 'en' ? 'RELATED FESTIVAL' : '関連フェスティバル'}</h2>
      <a class="related-card" href="${L.prefix}/festivals/${encodeURIComponent(relatedFestival.id)}.html">
        <div class="related-card-img">${img ? `<img ${dimensionAttrs(cardImagePath(img))} src="/${cardImagePath(img)}"${cardSrcsetAttr(img)} alt="${esc(fname)}" loading="lazy"${imagePositionStyle(relatedFestival)}>` : ''}</div>
        <div class="related-card-info">
          <div class="related-card-date">${esc(when)}</div>
          <div class="related-card-name">${esc(fname)}</div>
          <div class="related-card-loc">${esc(place)}</div>
        </div>
      </a>
    </div>`;
  })() : '';

  const body = `<article class="article-detail">
  <div class="article-detail-inner">
    <a class="article-back" href="${hubHref}" data-article-hub-back="${hubHref}"><span class="arrow"></span> ALL STORIES</a>
    ${heroBlock}
    <dl class="article-specs">
      <div><dt>WORDS BY</dt><dd>${esc(a.author || 'TECHNO JAPAN')}</dd></div>
      <div><dt>PUBLISHED</dt><dd>${esc(fmtDate(a.date) || '—')}</dd></div>
      <div><dt>READING TIME</dt><dd>${esc(a.readTime || 5)} MIN</dd></div>
    </dl>
    <div class="article-excerpt">${esc(L.excerpt || '')}</div>
    <div class="article-body">${addHtmlImageDimensions(resolveEntities(L.body || ''))}</div>
    ${relatedFestivalHtml}
    <div class="article-footer">
      ${tags ? `<div class="article-tags">${tags}</div>` : ''}
      <a class="article-back" href="${hubHref}" data-article-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL STORIES</a>
    </div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'articles'] : ['articles']), `${a.id}.html`), html: page({ title, desc, canonical, image, jsonLd: [jsonLd, breadcrumbLd('NEWS', '/news.html', a.title, canonical)], body, lang, altHref, backgroundLayer: true, extraScripts: `\n<link rel="stylesheet" href="/article-fx.css?v=${ARTICLE_FX_CSS_VERSION}">\n<script src="/article-fx.js?v=${ARTICLE_FX_JS_VERSION}" defer></script>` + ARTICLE_HUB_BACK_SCRIPT }) };
}

/* ---------- フェスティバルページ ---------- */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function editionLocationName(ed, lang) {
  return localizedValue(ed.LOCATION, ed.LOCATION_JA, ed.LOCATION_EN, lang);
}

function editionPlace(ed, lang) {
  return [editionLocationName(ed, lang), ed.PREF].filter(Boolean).join(', ');
}

function editionLocationLd(ed, lang) {
  return {
    '@type': 'Place',
    name: editionLocationName(ed, lang) || ed.PREF || 'Japan',
    address: {
      '@type': 'PostalAddress',
      addressRegion: ed.PREF || '',
      addressCountry: 'JP',
      ...(ed.ADDRESS ? { streetAddress: ed.ADDRESS } : {}),
    },
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
function lineupPerformerLd(row, artistsById, lang) {
  const linked = lineupEntity(row, artistsById, lang);  // 参照切れは従来どおり例外で止める
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
      <th scope="row">${esc(ed.EDITION || ed.EDITION_ID)}</th>
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

function lineupEntity(row, artistsById, lang) {
  if (isCompositeLineup(row)) return null;
  const id = lineupArtistIds(row)[0];
  if (!id) return null;
  const artist = artistsById.get(id);
  if (!artist) throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  return {
    '@type': artistSchemaType(artist),
    '@id': artistEntityId(id),
    name: lang === 'en' ? (artist.name_en || artist.name) : artist.name,
    url: `${BASE}/artists/${encodeURIComponent(id)}.html`,
  };
}

function lineupSlotHtml(row, artistsById, lang) {
  if (isCompositeLineup(row)) return `<span class="lineup-item" data-lineup-slot data-lineup-composite>${esc(row.ACT_LABEL || '')}</span>`;
  const id = lineupArtistIds(row)[0];
  if (!id) return `<span class="lineup-item" data-lineup-slot>${esc(row.ACT_LABEL || '')}</span>`;
  const artist = artistsById.get(id);
  if (!artist) throw new Error(`lineups.json: ARTIST_ID 参照切れ "${id}"`);
  const prefix = lang === 'en' ? '/en' : '';
  const name = lang === 'en' ? (artist.name_en || artist.name) : artist.name;
  return `<a class="lineup-item" data-lineup-slot data-lineup-artist="${esc(id)}" href="${prefix}/artists/${encodeURIComponent(id)}.html">${esc(name)}</a>`;
}

function festivalLineupsHtml(editions, lineupsByEdition, artistsById, lang) {
  const groups = editions.map((ed) => ({ ed, rows: lineupsByEdition.get(ed.EDITION_ID) || [] }))
    .filter((group) => group.rows.length);
  if (!groups.length) return '';
  const body = groups.map(({ ed, rows }) => {
    const slots = [...rows]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
      .map((row) => lineupSlotHtml(row, artistsById, lang)).join('');
    return groups.length > 1
      ? `<section class="edition-lineup"><h3>${esc(ed.EDITION || ed.EDITION_ID)}</h3><div class="lineup-list">${slots}</div></section>`
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

function festivalFaqItems(editions, lineupsByEdition, artistsById, name, lang) {
  const current = editions[0];
  if (!current) return [];
  const date = festivalDateText(current, lang);
  const venueParts = [editionLocationName(current, lang), current.ADDRESS, current.PREF]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const rows = lineupsByEdition.get(current.EDITION_ID) || [];
  const acts = [...rows]
    .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
    .map((row) => {
      if (isCompositeLineup(row)) return String(row.ACT_LABEL || '').trim();
      const id = lineupArtistIds(row)[0];
      const artist = id ? artistsById.get(id) : null;
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
  if (acts.length) items.push(lang === 'en'
    ? { question: `Which artists are playing at ${name}?`, answer: `The lineup includes ${acts.join(', ')}.` }
    : { question: `${name}にはどんなアーティストが出演しますか？`, answer: `出演アーティストは${acts.join('、')}です。` });
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

function festivalFaqDetailsHtml(items, lang) {
  if (!items.length) return '';
  const answerHtml = (item) => item.url
    ? esc(item.answer).replace(esc(item.url), `<a href="${esc(safeUrl(item.url))}" target="_blank" rel="noopener">${esc(item.url)}</a>`)
    : esc(item.answer);
  return `<section class="detail-section festival-faq festival-faq-details">
      <h2 class="detail-section-label">${lang === 'en' ? 'FREQUENTLY ASKED QUESTIONS' : 'よくある質問'}</h2>
      <div class="festival-faq-list">${items.map((item) => `<details>
        <summary>${esc(item.question)}</summary>
        <div class="festival-faq-answer"><p>${answerHtml(item)}</p></div>
      </details>`).join('')}</div>
    </section>`;
}

function festivalEditionsTimelineHtml(editions, lang) {
  if (editions.length < 2) return '';
  const rows = editions.map((ed, index) => `<tr class="edition-timeline-row reveal" style="transition-delay:${index * 100}ms">
        <th class="edition-year" scope="row">${esc(ed.EDITION || ed.EDITION_ID)}</th>
        <td class="edition-date">${editionDateHtml(ed, lang)}</td>
        <td class="edition-place">${esc(editionPlace(ed, lang) || '—')}</td>
      </tr>`).join('');
  return `<section class="detail-section festival-editions-v2">
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

function festivalLineupGroupsHtml(editions, lineupsByEdition, artistsById, lang) {
  const groups = editions.map((ed) => ({ ed, rows: lineupsByEdition.get(ed.EDITION_ID) || [] }))
    .filter((group) => group.rows.length);
  return groups.map(({ ed, rows }) => {
    const slots = [...rows]
      .sort((a, b) => Number(a.SORT || 0) - Number(b.SORT || 0))
      .map((row) => `<li>${lineupSlotHtml(row, artistsById, lang)}</li>`);
    const visible = slots.slice(0, 30).join('');
    const overflow = slots.slice(30);
    const more = overflow.length ? `<details class="lineup-more">
        <summary>${lang === 'en' ? `SHOW ALL ${slots.length} ARTISTS` : `全${slots.length}組を表示`}</summary>
        <ul class="detail-lineup-list">${overflow.join('')}</ul>
      </details>` : '';
    return `<section class="edition-lineup reveal"><h3>${esc(ed.EDITION || ed.EDITION_ID)}</h3><ul class="detail-lineup-list">${visible}</ul>${more}</section>`;
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

function festivalHeroDateHtml(edition) {
  const start = String(edition?.DATE_START || '');
  const end = String(edition?.DATE_END || '');
  if (!ISO_DATE.test(start)) return '';
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const parts = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day, monthName: months[month - 1] };
  };
  const first = parts(start);
  if (!ISO_DATE.test(end) || end === start) {
    return `<time datetime="${start}">${first.monthName} ${first.day}, ${first.year}</time>`;
  }
  const last = parts(end);
  if (first.year === last.year && first.month === last.month) {
    return `<time datetime="${start}">${first.monthName} ${first.day}</time> — <time datetime="${end}">${last.day}, ${last.year}</time>`;
  }
  if (first.year === last.year) {
    return `<time datetime="${start}">${first.monthName} ${first.day}</time> — <time datetime="${end}">${last.monthName} ${last.day}, ${last.year}</time>`;
  }
  return `<time datetime="${start}">${first.monthName} ${first.day}, ${first.year}</time> — <time datetime="${end}">${last.monthName} ${last.day}, ${last.year}</time>`;
}

function festivalPageV2Body({ f, editions, lineupsByEdition, artistsById, lang, name, canonical, summary, faqItems, relatedHtml }) {
  const prefix = lang === 'en' ? '/en' : '';
  const hubHref = `${prefix}/festivals.html`;
  const currentEdition = editions[0];
  const dateHtml = festivalHeroDateHtml(currentEdition);
  const locationName = currentEdition
    ? editionLocationName(currentEdition, lang)
    : localizedValue(f.location, f.location_ja, '', lang);
  const locationRegion = currentEdition?.PREF || f.city;
  const location = [locationName, locationRegion].filter(Boolean).join(' — ');
  const hasGeo = !!String(currentEdition?.LAT || '').trim() && !!String(currentEdition?.LNG || '').trim()
    && Number.isFinite(Number(currentEdition.LAT)) && Number.isFinite(Number(currentEdition.LNG));
  const mapQuery = hasGeo
    ? `${Number(currentEdition.LAT)},${Number(currentEdition.LNG)}`
    : [locationName, locationRegion].filter(Boolean).join(' ');
  const mapUrl = mapQuery ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}` : '';
  const genres = (Array.isArray(f.genre) ? f.genre : []).map((genre) => `<span class="detail-tag">${esc(genre)}</span>`).join('');
  const heroImage = f.image || f.flyer;
  const heroHtml = heroImage ? `<div class="detail-hero-image">
        <img ${dimensionAttrs(heroImage)} src="/${String(heroImage).replace(/^\//, '')}" alt="${esc(name)}"${imagePositionStyle(f)}>
      </div>` : '<div class="detail-hero-image detail-hero-gradient" aria-hidden="true"></div>';
  const official = f.url
    ? `<a class="detail-official festival-official-link" href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">OFFICIAL SITE</a>`
    : '';
  const tickets = currentEdition?.TICKETURL
    ? `<a class="detail-official festival-ticket-link" href="${esc(safeUrl(currentEdition.TICKETURL))}" target="_blank" rel="noopener">TICKETS</a>`
    : '';
  const instagram = f.instagram ? `<div class="festival-social-links">
        <a class="festival-social-link" href="${esc(safeUrl(f.instagram))}" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>
        </a>
      </div>` : '';
  const actions = [official, tickets, instagram].filter(Boolean).join('');
  const lineupGroups = festivalLineupGroupsHtml(editions, lineupsByEdition, artistsById, lang);
  const lineupCount = editions.reduce((total, edition) => total + (lineupsByEdition.get(edition.EDITION_ID) || []).length, 0);
  const flyerPick = pickFlyer(f, currentEdition);
  const flyerAlt = flyerPick.edition ? `${name} ${flyerPick.edition} Flyer` : `${name} Flyer`;
  const flyer = flyerPick.src ? `<div class="detail-flyer-col">
        <div class="detail-section-label">FLYER</div>
        <div class="detail-flyer-image"><img ${dimensionAttrs(flyerPick.src)} src="/${String(flyerPick.src).replace(/^\//, '')}" alt="${esc(flyerAlt)}" loading="lazy"></div>
      </div>` : '';
  const lineup = lineupGroups ? `<div class="detail-lineup-col">
        <h2 class="detail-section-label">LINE UP</h2>
        ${lineupGroups}
      </div>` : '';
  const flyerLineup = flyer || lineup
    ? `<div class="detail-flyer-lineup${flyer && lineup && lineupCount > 3 ? ' has-two-columns' : ''}">${flyer}${lineup}</div>`
    : '';
  const historyHtml = festivalEditionsTimelineHtml(editions, lang);
  const faqDetailsHtml = festivalFaqDetailsHtml(faqItems, lang);
  const shareHtml = `<section class="festival-share-section">${festivalShareButtons(name, canonical, lang)}</section>`;
  const hasDescription = !!String(f.desc || f.desc_en || '').trim();
  const description = hasDescription ? bilingualBody(f.desc, f.desc_en, lang, 'festival-description-inline') : '';
  const heroDescription = description || (summary ? `<p class="detail-desc festival-summary">${esc(summary)}</p>` : '');
  const programSection = flyerLineup ? `<section class="festival-program-section">${flyerLineup}</section>` : '';

  return `<article class="festival-detail-page festival-design-v2">
  <div class="festival-detail-inner">
    <a class="detail-back" href="${hubHref}" data-festival-hub-back="${hubHref}"><span class="arrow"></span> BACK TO FESTIVALS</a>

    <header class="festival-detail-hero">
      ${heroHtml}
      <div class="detail-hero-info">
${genres ? `        <div class="detail-tags">${genres}</div>\n` : ''}${dateHtml ? `        <div class="detail-date">${dateHtml}</div>\n` : ''}
        <h1 class="detail-name">${esc(name)}</h1>
${location ? (mapUrl
          ? `        <a class="detail-location detail-location-map" href="${esc(safeUrl(mapUrl))}" target="_blank" rel="noopener">${esc(location)}<span aria-hidden="true">↗</span></a>\n`
          : `        <div class="detail-location">${esc(location)}</div>\n`) : ''}${heroDescription ? `        ${heroDescription}\n` : ''}${actions ? `        <div class="detail-actions">${actions}</div>\n` : ''}
      </div>
    </header>

${programSection ? `    ${programSection}\n` : ''}${historyHtml ? `    ${historyHtml}\n` : ''}${faqDetailsHtml ? `    ${faqDetailsHtml}\n` : ''}    ${shareHtml}
${relatedHtml ? `    <section class="detail-section festival-related-stories-v2">${relatedHtml}</section>\n` : ''}    ${festivalRelatedCards(f, lang)}
    <div class="article-footer"><a class="detail-back" href="${hubHref}" data-festival-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> BACK TO FESTIVALS</a></div>
  </div>
</article>`;
}

function festivalPage(f, festivalEditions, lineupsByEdition, artistsById, articles, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/festivals/${f.id}.html`;
  const name = lang === 'en' ? (f.name_en || f.name) : f.name;
  const bodyDesc = lang === 'en' ? (f.desc_en || f.desc) : (f.desc || f.desc_en);
  const canonical = `${BASE}${prefix}/festivals/${f.id}.html`;
  // SEO: エンティティ名だけでなく検索キーワード（テクノ フェス 日本 等）をtitleに含める
  const title = lang === 'en'
    ? `${name} — Techno ${f.type === 'rave' ? 'Rave' : 'Festival'} in Japan | TECHNO JAPAN`
    : `${name}｜日本のテクノ・${f.type === 'rave' ? 'レイヴ' : '野外フェス'} — TECHNO JAPAN`;
  const desc = bodyDesc || (lang === 'en'
    ? `${name} — edition history and information for a techno / house festival in Japan.`
    : `${name}の開催履歴・基本情報。日本のテクノ／ハウスのフェスティバル情報。`);
  const image = absUrl(f.image || f.flyer);

  // このフェスに紐づく記事（ARTICLES.festivalId で関連付け）
  const related = (articles || []).filter((a) => a.festivalId === f.id && a.status !== 'draft');
  const relatedHtml = related.length
    ? `<div class="related-stories"><h2>RELATED STORIES</h2>` + related.map((a) =>
        `<a class="related-story-card" href="${(lang === 'en' && (a.title_en || a.body_en)) ? '/en' : ''}/articles/${a.id}.html">
          ${a.image ? `<img ${dimensionAttrs(a.image)} class="related-story-thumb" src="/${String(a.image).replace(/^\//, '')}" alt="" loading="lazy">` : ''}
          <div><div class="related-story-meta">${esc(a.category || 'STORY')} · ${esc(fmtDate(a.date))}</div>
          <div class="related-story-title">${esc(a.title)}</div></div>
        </a>`).join('') + `</div>`
    : '';

  const editions = [...festivalEditions].sort((a, b) =>
    String(b.DATE_START || '').localeCompare(String(a.DATE_START || '')) ||
    String(b.EDITION || '').localeCompare(String(a.EDITION || ''))
  );
  const currentEdition = editions[0];
  const summary = festivalSummary(f, currentEdition, name, lang);
  const faqItems = festivalFaqItems(editions, lineupsByEdition, artistsById, name, lang);
  const performers = dedupePerformers(
    editions.flatMap((ed) => lineupsByEdition.get(ed.EDITION_ID) || [])
      .map((row) => lineupPerformerLd(row, artistsById, lang)).filter(Boolean));
  const sameAs = [f.url, f.instagram]
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Festival',
    '@id': `${BASE}/festivals/${encodeURIComponent(f.id)}.html#festival`,
    name: name,
    description: desc,
    inLanguage: lang,
    image: [image],
    url: canonical,
    ...(sameAs.length ? { sameAs } : {}),
    ...(performers.length ? { performer: performers } : {}),
    ...(editions.length ? { subEvent: editions.map((ed) => ({
      '@type': 'Festival',
      '@id': `${BASE}/festivals/${encodeURIComponent(f.id)}.html#edition-${encodeURIComponent(ed.EDITION_ID)}`,
      name: `${name} ${ed.EDITION || ''}`.trim(),
      ...(ISO_DATE.test(String(ed.DATE_START || '')) ? { startDate: ed.DATE_START } : {}),
      ...(ISO_DATE.test(String(ed.DATE_END || '')) ? { endDate: ed.DATE_END } : {}),
      location: editionLocationLd(ed, lang),
      ...((lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupPerformerLd(row, artistsById, lang)).filter(Boolean).length
        ? { performer: (lineupsByEdition.get(ed.EDITION_ID) || []).map((row) => lineupPerformerLd(row, artistsById, lang)).filter(Boolean) }
        : {}),
      ...(editionStatusLd(ed.STATUS) ? { eventStatus: editionStatusLd(ed.STATUS) } : {}),
      ...(ed.TICKETURL ? { offers: { '@type': 'Offer', url: ed.TICKETURL } } : {}),
    })) } : {}),
  };

  const body = festivalPageV2Body({ f, editions, lineupsByEdition, artistsById, lang, name, canonical, summary, faqItems, relatedHtml });

  const faqLd = faqItems.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null;
  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'festivals'] : ['festivals']), `${f.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('FESTIVALS', '/festivals.html', name, canonical), ...(faqLd ? [faqLd] : [])], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT + FESTIVAL_HUB_BACK_SCRIPT + FESTIVAL_SHARE_SCRIPT, backgroundLayer: true }) };
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

function artistPage(a, artistsById, lang = 'ja') {
  const hubHref = `${lang === 'en' ? '/en' : ''}/artists.html`;
  const prefix = lang === 'en' ? '/en' : '';
  const altHref = (lang === 'ja' ? '/en' : '') + `/artists/${a.id}.html`;
  const name = lang === 'en' ? (a.name_en || a.name) : a.name;
  const bio = lang === 'en' ? (a.bio_en || a.bio) : (a.bio || a.bio_en);
  const canonical = `${BASE}${prefix}/artists/${a.id}.html`;
  const fromJapan = !a.country || /japan/i.test(String(a.country));
  const title = lang === 'en'
    ? `${name} — Techno DJ / Artist${fromJapan ? ' from Japan' : ''} | TECHNO JAPAN`
    : `${name}｜テクノDJ・アーティスト — TECHNO JAPAN`;
  const place = [a.city, a.country].filter(Boolean).join(', ');
  // bioが無い/短い時は、ジャンル・拠点入りのキーワードリッチな定型文にフォールバック
  const bioDesc = bio ? truncate(stripTags(bio), 160) : '';
  const genreTxt = String(a.genre || '').trim();
  const desc = bioDesc.length >= 50 ? bioDesc : (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — ${genreTxt || 'techno / house'} DJ & artist. Profile, links and festival appearances in Japan's underground scene.`
    : `${name}${place ? '（' + place + '）' : ''} — ${genreTxt ? genreTxt + 'の' : ''}DJ／アーティスト。プロフィール・SNSリンク・日本のテクノ／ハウスシーンでの出演フェス情報。TECHNO JAPANのアーティスト名鑑。`);
  const image = absUrl(a.image);
  const links = a.links || {};
  const schemaType = artistSchemaType(a);
  const members = schemaType === 'MusicGroup'
    ? artistMemberIds(a).map((id) => artistsById.get(id)).filter(Boolean)
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': artistEntityId(a.id),
    name: name,
    inLanguage: lang,
    description: desc,
    ...(a.image ? { image: [image] } : {}),
    url: canonical,
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

  const genres = (Array.isArray(a.genre) ? a.genre : String(a.genre || '').split('/').filter(Boolean))
    .map((g) => `<span class="detail-chip">${esc(String(g).trim())}</span>`).join('');

  const linkRow = Object.entries(links)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a class="detail-link" href="${esc(safeUrl(v))}" target="_blank" rel="noopener">${esc(k.toUpperCase())}</a>`)
    .join('');
  const appearances = XLINK.appearMap.get(String(a.id)) || [];
  const appearancesHtml = appearances.length
    ? `\n    <section class="artist-appearances"><h2>${lang === 'en' ? 'APPEARANCES' : '出演フェス'}</h2>${relatedChips(appearances, 'festivals', lang)}</section>`
    : '';

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="${hubHref}" data-artist-hub-back="${hubHref}"><span class="arrow"></span> ALL ARTISTS</a>
    ${place ? `<div class="detail-eyebrow">${esc(place)}</div>` : ''}
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${a.image ? `<div class="detail-hero detail-hero-portrait"><img ${dimensionAttrs(a.image)} src="/${String(a.image).replace(/^\//, '')}" alt="${esc(name)}"${imagePositionStyle(a)}></div>` : ''}
    ${bilingualBody(a.bio, a.bio_en, lang)}
    ${linkRow ? `<div class="detail-links">${linkRow}</div>` : ''}${appearancesHtml}
    <div class="article-footer"><a class="article-back" href="${hubHref}" data-artist-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL ARTISTS</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'artists'] : ['artists']), `${a.id}.html`), html: page({ title, desc, canonical, image, ogType: 'profile', jsonLd: [jsonLd, breadcrumbLd('ARTISTS', '/artists.html', name, canonical)], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT + ARTIST_HUB_BACK_SCRIPT }) };
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

/* ---------- ヴェニューページ ---------- */
function venuePage(v, lang = 'ja') {
  const prefix = lang === 'en' ? '/en' : '';
  const hubHref = `${prefix}/venues.html`;
  const altHref = (lang === 'ja' ? '/en' : '') + `/venues/${v.id}.html`;
  const name = lang === 'en' ? (v.name_en || v.name) : v.name;
  const bodyDesc = lang === 'en' ? (v.desc_en || v.desc) : (v.desc || v.desc_en);
  const canonical = `${BASE}${prefix}/venues/${v.id}.html`;
  const title = lang === 'en'
    ? `${name} — Club / Venue in ${v.city || 'Japan'} | TECHNO JAPAN`
    : `${name}｜${v.city ? v.city + 'の' : ''}クラブ・ヴェニュー — TECHNO JAPAN`;
  const place = [v.area, v.city].filter(Boolean).join(', ');
  const desc = bodyDesc || (lang === 'en'
    ? `${name}${place ? ' (' + place + ')' : ''} — club / venue guide. Japan's underground dance music.`
    : `${name}${place ? '（' + place + '）' : ''}の基本情報。日本のアンダーグラウンド・ダンスミュージックのクラブ／ヴェニュー。`);
  const image = absUrl(v.image);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicVenue',
    '@id': `${BASE}/venues/${encodeURIComponent(v.id)}.html#venue`,
    name: name,
    inLanguage: lang,
    description: desc,
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
    .map((g) => `<span class="detail-chip">${esc(String(g).trim())}</span>`).join('');

  const body = `<article class="detail-page">
  <div class="detail-inner">
    <a class="article-back" href="${hubHref}" data-venue-hub-back="${hubHref}"><span class="arrow"></span> ALL VENUES</a>
    ${place ? `<div class="detail-eyebrow">${esc(place)}</div>` : ''}
    <h1>${esc(name)}</h1>
    ${genres ? `<div class="detail-chips">${genres}</div>` : ''}
    ${v.image ? `<div class="detail-hero"><img ${dimensionAttrs(v.image)} src="/${String(v.image).replace(/^\//, '')}" alt="${esc(name)}"${imagePositionStyle(v)}></div>` : ''}
    ${bilingualBody(v.desc, v.desc_en, lang)}
    <dl class="detail-facts">
      ${v.type ? `<div><dt>${lang === 'en' ? 'TYPE' : 'タイプ'}</dt><dd>${esc(v.type)}</dd></div>` : ''}
      ${v.address ? `<div><dt>${lang === 'en' ? 'ADDRESS' : '住所'}</dt><dd>${esc(v.address)}</dd></div>` : ''}
      ${v.url ? `<div><dt>${lang === 'en' ? 'OFFICIAL SITE' : '公式サイト'}</dt><dd><a href="${esc(safeUrl(v.url))}" target="_blank" rel="noopener">${esc(v.url)}</a></dd></div>` : ''}
      ${v.instagram ? `<div><dt>Instagram</dt><dd><a href="${esc(safeUrl(v.instagram))}" target="_blank" rel="noopener">${esc(instagramHandle(v.instagram))}</a></dd></div>` : ''}
    </dl>
    ${(() => { // 回遊: 同じ街の他のヴェニュー
      const others = XLINK.venues.filter((x) => x.id !== v.id && x.city && v.city && String(x.city).toLowerCase() === String(v.city).toLowerCase()).slice(0, 6);
      if (!others.length) return '';
      return `<h2>${lang === 'en' ? `MORE VENUES IN ${esc(String(v.city).toUpperCase())}` : `${esc(v.city)}の他のヴェニュー`}</h2>${relatedChips(others, 'venues', lang)}`;
    })()}
    <div class="article-footer"><a class="article-back" href="${hubHref}" data-venue-hub-back="${hubHref}" style="margin:0"><span class="arrow"></span> ALL VENUES</a></div>
  </div>
</article>`;

  return { file: path.join(LP_DIR, ...(lang === 'en' ? ['en', 'venues'] : ['venues']), `${v.id}.html`), html: page({ title, desc, canonical, image, ogType: 'website', jsonLd: [jsonLd, breadcrumbLd('VENUES', '/venues.html', name, canonical)], body, lang, altHref, extraScripts: LANG_TOGGLE_SCRIPT + VENUE_HUB_BACK_SCRIPT }) };
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

/* ---------- EN ハブページの生成 ----------
   JA ハブ（手書きHTML）を唯一のソースとし、機械置換で EN 版を作る。
   テンプレート化しない理由: ハブ4枚は互いに style 7-19% / JS 9-25% しか
   共通しておらず、畳めるのは nav/footer 等の外枠 10.8KB だけ。労力に見合わない。
   一方 JA→EN の差分は「メタ + 内部リンク + 固定文言1つ」しかないので、
   置換のほうが確実で、JA を直せば EN が自動追随する（二重管理が起きない）。 */

// EN 版が実在するページ。ここに無いものは JA を指したままにする（404 を作らない）。
const EN_PAGES = new Set(['index.html', 'about.html', 'submit.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html']);

// EN ハブの meta description（JA は日英併記なので英語のみに差し替える）
const EN_HUB_DESC = {
  'festivals.html': "Techno, house and open-air festivals across Japan. Browse by date, region and genre — the definitive guide to Japan's electronic music festivals and underground raves.",
  'artists.html': "DJs and artists shaping Japan's underground techno and house scene. Profiles, genres and festival appearances.",
  'venues.html': "Clubs, warehouses and music bars across Japan. The venues that define the country's underground electronic music scene.",
  'news.html': "Stories, interviews and reports from Japan's underground techno and house scene.",
  'index.html': "Japan's underground techno & house — stories, festivals, artists, venues.",
};

// 本文に残る日本語の固定文言（データ由来の日本語は対象外）
const EN_HUB_TEXT = [
  ['FESTIVAL 掲載申請', 'Submit a Festival'],
];

function enHubFromJa(html, page) {
  let s = html;
  const abs = (p) => `${BASE}/${p === 'index.html' ? '' : p}`;

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

  // 静的リンク一覧のラベルを EN 版へ差し替える。
  // href はこの下の /en/ 書き換えに任せるので、JA と同じ表記で出しておく。
  // 日本語名のフェス（森、道、市場 等）は name_en が無いので JA のまま残るが、
  // 会場名は EDITIONS の LOCATION が英字表記を持っているぶんだけ英語になる。
  const links = EN_HUB_LINKS[page];
  if (links) s = replaceHubLinksBlock(s, links.marker, links.html, `en/${page}`);

  // 内部リンク: EN 版があるページだけ /en/ へ。相対・絶対の両表記に対応する。
  s = s.replace(/href="\/?((?:index|news|festivals|artists|venues|about|submit)\.html)"/g,
    (m, p) => (EN_PAGES.has(p) ? `href="/en/${p}"` : m));
  // EN 版が無いページ（index）は相対表記だと /en/index.html を指してしまう。
  // ルート相対に正規化して JA トップへ確実に戻す。
  s = s.replace(/href="index\.html"/g, 'href="/index.html"');

  // JA ハブは共有アセットを相対パスで読んでいる。/en/ に置くと /en/data.js を
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

  s = s.replace(/<html lang="[^"]*"/, '<html lang="ja"');

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
  const today = new Date().toISOString().slice(0, 10);
  const events = [];
  for (const f of pubFests) {
    for (const ed of (editionsByFestival.get(String(f.id)) || [])) {
      const start = String(ed.DATE_START || '');
      if (!ISO_DATE.test(start)) continue;
      const end = ISO_DATE.test(String(ed.DATE_END || '')) ? ed.DATE_END : start;
      if (end < today) continue;                                   // 終わった回は載せない
      if (String(ed.STATUS || '').trim().toLowerCase() === 'cancelled') continue;
      events.push({
        name: `${f.name} ${ed.EDITION || ''}`.trim(),
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
  const { ARTISTS = [], FESTIVALS = [], VENUES = [], ARTICLES = [] } = loadData();
  const EDITIONS = loadItems(EDITIONS_PATH, 'editions.json');
  const LINEUPS = loadItems(LINEUPS_PATH, 'lineups.json');

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
  const resolveEntities = makeEntityResolver({ ARTISTS, FESTIVALS, VENUES, ARTICLES });
  validateArticleShortcodes({ ARTISTS, FESTIVALS, VENUES, ARTICLES });
  const pubArticles = ARTICLES.filter(valid).filter((a) => a.status !== 'draft');
  const pubFests = FESTIVALS.filter(valid);
  const pubArtists = ARTISTS.filter(valid);
  const pubVenues = VENUES.filter(valid).filter((v) => v.name && v.city && v.city !== 'undefined');
  const artistsById = new Map(pubArtists.map((artist) => [String(artist.id), artist]));
  const festivalsById = new Map(pubFests.map((festival) => [String(festival.id), festival]));
  const editionById = new Map(EDITIONS.map((edition) => [String(edition.EDITION_ID), edition]));
  const lineupsByEdition = new Map();
  const appearMap = new Map();
  const missingArtistRefs = new Map();
  for (const row of LINEUPS) {
    const edition = editionById.get(String(row.EDITION_ID || ''));
    if (!edition) throw new Error(`lineups.json: EDITION_ID 参照切れ "${row.EDITION_ID || ''}"`);
    if (!lineupsByEdition.has(row.EDITION_ID)) lineupsByEdition.set(row.EDITION_ID, []);
    lineupsByEdition.get(row.EDITION_ID).push(row);

    if (isCompositeLineup(row)) continue;
    const artistId = lineupArtistIds(row)[0];
    if (!artistId) continue;
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
  }
  if (missingArtistRefs.size) {
    const details = [...missingArtistRefs.entries()]
      .map(([id, editions]) => `  - ${id}: ${[...new Set(editions)].join(', ')}`)
      .join('\n');
    throw new Error(`lineups.json: ARTIST_ID 参照切れ ${missingArtistRefs.size}件。ARTISTSシートに追加するか、LINEUPSのIDを修正してください。\n${details}`);
  }
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
    articles: writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'ja', pubFests, editionsByFestival)).concat(redirectStubs('articles', liveArticleIds)), 'articles'),
    festivals: writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, ARTICLES, 'ja')).concat(redirectStubs('festivals', liveFestivalIds)), 'festivals'),
    artists: writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'ja')).concat(redirectStubs('artists', liveArtistIds)), 'artists'),
    venues: writeAll(pubVenues.map((v) => venuePage(v, 'ja')), 'venues'),
    // 英語版（/en/…）。未翻訳フィールドは articlePage 内で元データへ
    // フォールバックし、EN ハブの通常遷移先を必ず実在させる。
    'en/articles': writeAll(pubArticles.map((a) => articlePage(a, resolveEntities, 'en', pubFests, editionsByFestival)), 'en/articles'),
    'en/festivals': writeAll(pubFests.map((f) => festivalPage(f, editionsByFestival.get(f.id) || [], lineupsByEdition, artistsById, ARTICLES, 'en')).concat(redirectStubs('en/festivals', liveFestivalIds)), 'en/festivals'),
    'en/artists': writeAll(pubArtists.map((a) => artistPage(a, artistsById, 'en')).concat(redirectStubs('en/artists', liveArtistIds)), 'en/artists'),
    'en/venues': writeAll(pubVenues.map((v) => venuePage(v, 'en')), 'en/venues'),
  };

  const hubCounts = {
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

  // EN ハブ用のラベル。JA と同じ items・同じ順序で、ラベルだけ EN 規則にする。
  // 件数や順序を変えると en_hub_leaks_to_ja や静的リンク数の検査とズレるため、
  // hubLinkList の呼び出し方は JA 側と対称に保つこと。
  EN_HUB_LINKS = {
    'news.html': { marker: 'ARTICLES', html: hubLinkList(pubArticles, 'articles', (a) => a.title_en || a.title || '') },
    'festivals.html': { marker: 'FESTIVALS', html: hubLinkList(pubFests, 'festivals', (f) => festivalHubLabel(f, editionsByFestival.get(f.id) || [], 'en')) },
    'artists.html': { marker: 'ARTISTS', html: hubLinkList(pubArtists, 'artists', (a) => a.name_en || a.name || '') },
    'venues.html': { marker: 'VENUES', html: hubLinkList(pubVenues, 'venues', (v) => v.name_en || v.name || '') },
  };

  // JA ハブを正してから EN を作る。順序が逆だと、直す前の JA から EN が生まれる。
  // 静的リンクの差し替え（上の hubCounts）も EN へ引き継ぐため、この位置に置く。
  const HUBS = ['index.html', 'festivals.html', 'artists.html', 'venues.html', 'news.html'];
  const jaFixed = HUBS.filter(fixJaHub);
  const enWritten = HUBS.filter(writeEnHub);

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
