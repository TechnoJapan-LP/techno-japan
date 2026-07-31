# AUDIT_TECHNO_JAPAN.md — Phase A 現状監査

> [GEO_TECHNO_JAPAN.md](GEO_TECHNO_JAPAN.md) Phase A の成果物。
> **監査日: 2026-07-31 / 対象コミット: `51f6b8f`**（この時点のスナップショット）
> **最終更新: 2026-08-01 / 対応後コミット: `f22cdd1`**
>
> §1〜§5 の本文は **監査時点の記録として原文を保持**している。
> その後に解消した項目には ✅/🔶 の追記を入れ、対応内容は [§9 対応履歴](#9-対応履歴2026-08-01) にまとめた。
> 現在の残タスクは [§6-3 の一覧](#6-3-優先度つき所見一覧) の「状態」列を参照。

---

## 進捗サマリ（2026-08-01 時点）

| 指標 | 監査時 | 現在 |
|---|---:|---:|
| ハブpage→詳細pageの静的リンク | **0** | **206** |
| 参照先が存在しない画像 | **8** | **0** |
| `lang="ja"` で中身が非日本語 | **108** | **52** |
| `<ul>`/`<li>` を使うファイル | **0** | 4 |
| Organization.logo | フェス写真 | 実ロゴ |
| PWAアイコン | 実体なし(404) | 正常 |

18件の所見のうち **6件が解消**。残り12件は §6-3 参照。

---

## 0. 前提の相違（最初に読むこと）

指示書は **Next.js (App Router) / React / TypeScript** を前提にしているが、
本リポジトリは **静的HTML生成 + GAS + スプレッドシート** 構成であり、前提が一致しない。

| 指示書の前提 | 本プロジェクトの実体 |
|---|---|
| `app/` `pages/` ルーティング | `LP/` 配下の静的 `.html` 428ファイル（生成物をコミット） |
| `app/robots.ts` | `LP/robots.txt`（静的） |
| `app/sitemap.ts` | `scripts/generate-sitemap.py` → `LP/sitemap.xml`（CI生成） |
| `<JsonLd>` React コンポーネント | `scripts/build-detail-pages.mjs` 内のテンプレート関数 |
| `next/image` / `next/font` | 素の `<img>` / Google Fonts CDN |
| `schema-dts` (TS型) | 型なし（プレーンJS） |

**結論: 指示書の「実装手段」はそのまま適用できないが、「実装意図」はすべて適用可能。**
Phase B 以降は Next.js API ではなく **`scripts/build-detail-pages.mjs` の改修** として読み替える。

さらに重要な点として、**指示書が Phase B で作れと言っている物の大半は既に存在する。**
Organization / Article / BreadcrumbList / Person スキーマも、robots.txt も、sitemap も稼働済み。
本監査で見つかった真のボトルネックは **技術実装ではなく「中身の欠落」** に寄っている（→ §6）。

---

## 1. ルーティング構造の把握

### 1-1. ページ総数

HTML 総数 **428**（うち noindex 8 / sitemap 登録 419）。

### 1-2. テンプレート種別の分類

生成元はすべて `scripts/build-detail-pages.mjs`（675行）。

| テンプレート | 生成関数 | JA | EN | 計 | 出力先 |
|---|---|---:|---:|---:|---|
| フェス詳細 | `festivalPage()` | 87 | 87 | 174 | `LP/festivals/{id}.html`, `LP/en/festivals/` |
| アーティスト詳細 | `artistPage()` | 97 | 97 | 194 | `LP/artists/{id}.html`, `LP/en/artists/` |
| ヴェニュー詳細 | `venuePage()` | 22 | 22 | 44 | `LP/venues/{id}.html`, `LP/en/venues/` |
| 記事詳細 | `articlePage()` | 2 | 0 | 2 | `LP/articles/{id}.html` |
| **小計（自動生成）** | | | | **414** | |

| 手書きページ | ファイル | 役割 |
|---|---|---|
| トップ | `index.html` | ハブ |
| 一覧ハブ | `festivals.html` / `artists.html` / `venues.html` / `news.html` | 一覧（**JSレンダリング**、§1-3） |
| 静的 | `about.html` / `404.html` / `favorites.html` | — |
| 管理 | `cms.html`（242KB の `cms.js` 同梱） | noindex |
| 地図 | `map.html` | robots.txt で Disallow |
| PWA | `app/index.html` | noindex |
| リダイレクトstub | `media.html` / `discover.html` / `events.html` | → `news.html`、noindex |

### 1-3. 【重大】ハブページはクライアントサイドレンダリング

> ✅ **解消済み（2026-08-01）** — `build-detail-pages.mjs` が `<!-- STATIC_LINKS:*:START/END -->`
> マーカー間に `<ul class="ssr-link-list">` を生成する方式を追加。festivals 86 / artists 97 /
> venues 22 / news 1 の合計206本が静的リンクとして出力され、JS非実行のクローラーからも
> 詳細ページへ到達できるようになった。以下は監査時点の記録。

`festivals.html` / `artists.html` / `venues.html` / `news.html` の一覧部分は空要素で、
`data.js` から JS で描画される。

```html
<!-- LP/festivals.html -->
<main class="festivals-main" id="festivals-main"></main>   <!-- 空 -->
```

`<script>` を除いた HTML から詳細ページへの `<a href>` を数えた結果:

| ハブページ | → festivals/ | → artists/ | → venues/ | → articles/ |
|---|---:|---:|---:|---:|
| `index.html` | 0 | 0 | 0 | 0 |
| `festivals.html` | 0 | 0 | 0 | 0 |
| `artists.html` | 0 | 0 | 0 | 0 |
| `venues.html` | 0 | 0 | 0 | 0 |
| `news.html` | 0 | 0 | 0 | 0 |

**JSを実行しないクローラーから見ると、ハブページから詳細ページへの導線がゼロ。**
414枚の詳細ページの発見経路は実質 `sitemap.xml` のみに依存している。
GPTBot / ClaudeBot / PerplexityBot は基本的に JS を実行しないため、GEO 上の最大の構造的欠陥。

なお **詳細ページ同士は静的リンクで繋がっている**（LINE UP → アーティスト、同一県の他フェスなど）ので、
一度クロールされればグラフは辿れる。欠けているのは「入口」。

### 1-4. 記事（NEWS）が URL を持たない

- `data.js` の `ARTICLES` は **1件のみ**（`transcendence-2025-report`）。`EVENTS` は 0件。
- `news.html` は SPA で、記事URLは `news.html#article/{id}` という **ハッシュURL**。
  ハッシュはクローラーに別ページとして認識されない。
- `news.html` 内の JS が `document.head` に NewsArticle スキーマを動的注入しているが、
  JS 非実行のクローラーには届かない。
- sitemap に載っている記事は静的生成された `articles/transcendence-2025-report.html` の1件だけ。

### 1-5. EN セクションに入口がない

- EN 詳細ページは 206枚あるが、**EN のハブページ（`en/index.html` 等）が存在しない**。
- EN 詳細ページの `<nav>` も JSON-LD の BreadcrumbList も、リンク先はすべて **JA ハブ**（`/festivals.html`）。
- `hreflang` を持つのは詳細ページ 412枚のみ。**ハブページ 16枚には hreflang が無い**。

---

## 2. 既存 Schema.org の有無

`grep -r "ld+json"` の結果: **420 / 428 ファイルに JSON-LD あり（98%）**。想定よりかなり成熟している。

### 2-1. JSON-LD が無い 8ファイル（すべて意図的で問題なし）

`map.html` / `cms.html` / `404.html` / `media.html` / `discover.html` / `events.html` / `app/index.html` / `articles/transcendence.html`
→ 全て noindex または robots.txt Disallow 対象。**対応不要。**

### 2-2. テンプレート別のスキーマ型

| テンプレート | 実装済みスキーマ |
|---|---|
| `index.html` | `WebSite` + `publisher: Organization` + `potentialAction: SearchAction` |
| `about.html` | `Organization` ×3 + `BreadcrumbList` + `Country` |
| ハブページ | `CollectionPage` + `BreadcrumbList` + `WebSite` |
| フェス詳細 | `Festival` + `Place` + `PostalAddress` + `GeoCoordinates` + `performer[]` + `BreadcrumbList` |
| アーティスト詳細 | `MusicGroup` + `Place` + `sameAs[]` + `BreadcrumbList` |
| ヴェニュー詳細 | `MusicVenue` + `PostalAddress` + `GeoCoordinates` + `maximumAttendeeCapacity` + `BreadcrumbList` |
| 記事詳細 | `NewsArticle` + `Person`(author) + `Organization`(publisher) + `ImageObject` + `WebPage` + `BreadcrumbList` |

**指示書 B-1 が要求する Organization / NewsArticle / Person / BreadcrumbList は全て実装済み。**
未実装は **`FAQPage` のみ（サイト全体で 0件）**。

### 2-3. 既存スキーマの品質上の問題

**(a) エンティティ間リンクが無い（GEO上の最大の惜しい点）**

`Festival.performer` に出演者名は入っているが、`@id` / `url` が無く、
自サイトのアーティストページに紐付いていない。HTML 側にはリンクがあるのに、構造化データでは切れている。

```jsonc
// festivals/rainbow-disco-club.html — 現状
"performer": [ { "@type": "MusicGroup", "name": "Ben UFO" }, ... ]
//                                       ↑ url / @id なし → 単なる文字列
```

同様に `MusicVenue`↔`Festival.location`、`MusicGroup`↔出演フェスも未接続。
サイト全体で `@id` を使ったエンティティグラフが 0。

**(b) Organization の `logo` がフェス写真**

> ✅ **解消済み（2026-08-01）** — `DEFAULT_OG` が兼務していた2つの役割を分離。
> `ORG_LOGO`（`/images/logo-512.png`）を新設し `publisher.logo` はこちらを参照。
> `DEFAULT_OG` は OGP フォールバック専用として据え置き。
> 実ロゴ素材を `logo.png`(2000px マスター) / `logo-512.png` / `logo-192.png` で配置。
> URL を固定したので、**今後のロゴ差し替えは画像ファイルの置換のみでコード変更不要**。

`scripts/build-detail-pages.mjs:30`
```js
const DEFAULT_OG = `${BASE}/images/festivals/rainbow-disco-club.webp`;
```
これが Organization の `logo`、および画像未設定ページの `og:image` / `twitter:image` /
JSON-LD `image` のフォールバックとして使われている。
→ ロゴが「別のフェスの現地写真」になっており、AI にブランド視覚identityを誤認させる。

**(c) `sameAs` が Instagram 1件のみ**

> ✅ **解消済み（2026-08-01）** — `index.html` / `about.html` の Organization に
> Threads（`https://www.threads.net/@techno.japan_`）を追加。

`index.html` の Organization は Instagram のみ。ナビには Threads もあるが未登録。
エンティティ確立（Phase D）の基礎として弱い。

**(d) `description` が「…」で途中切断**

`truncate()` (`build-detail-pages.mjs:62`) により meta description / og:description が
文の途中で `…` で切れている。JSON-LD 本体は全文なので影響は meta 側のみだが、
AI が引用する際に不完全な文を掴む。

```
"ARCH returns to Gunma for its eleventh edition, maintaining its reputation as one of Japan's most respected underground gatherings. The festival continues to s…"
```

**(e) `og:type` が全フェス/ヴェニューで `website`**

`build-detail-pages.mjs:440,562` で `ogType: 'website'` 固定。コンテンツページとしては `article` が適切。
（アーティストは `profile` で妥当）

---

## 3. robots / メタの現状

### 3-1. `LP/robots.txt`

```
User-agent: *
Allow: /

# Disallow CMS / preview pages
Disallow: /cms.html
Disallow: /map.html

Sitemap: https://techno-japan.media/sitemap.xml
```

**AIクローラーの誤ブロックは無い。** `User-agent: *` + `Allow: /` により
GPTBot / ClaudeBot / PerplexityBot / Google-Extended / OAI-SearchBot / Applebot-Extended は
すべて暗黙的に許可されている。`Sitemap:` 行もあり。

→ 指示書 B-2 は「誤ブロックの解除」は不要。**明示的な `User-agent` ブロック追記は任意**
（挙動は変わらないが、意図の明文化とログ照合のしやすさで価値はある）。

### 3-2. `LP/sitemap.xml`

- URL 数 **419**、全件に `<lastmod>` あり。ハッシュURLの混入なし。
- 内訳: `/en/` 206、`/artists/` 97、`/festivals/` 87、`/venues/` 22、ハブ等 7。
- **indexable なページ 420 のうち sitemap 未登録は `map.html` 1件のみ**（robots.txt で Disallow 済みなので整合）。
- 生成: `.github/workflows/generate-meta.yml`（push + 毎日 03:00 UTC）→
  `build-detail-pages.mjs` → `generate-sitemap.py` → `generate-rss.py` の順で実行。

### 3-3. `LP/rss.xml`

31 items。中身はフェス情報（`<category>Festival</category>`）で、記事フィードではない。

### 3-4. meta タグのカバレッジ（428ファイル中）

| タグ | 件数 | 備考 |
|---|---:|---|
| `<title>` | 428 | — |
| `name="description"` | 423 | 欠けているのは noindex ページ |
| `rel="canonical"` | 424 | 同上 |
| `og:title` / `og:image` / `og:type` | 420 | 同上 |
| `twitter:card` | 420 | `summary_large_image` |
| `hreflang` | 412 | **詳細ページのみ。ハブ16枚に無し** |
| `name="robots"` (noindex) | 8 | 意図通り |

### 3-5. `llms.txt`

**存在しない。**（指示書 B-6 も優先度低と明記しているので想定内）

### 3-6. その他

- `CNAME`: `techno-japan.media`
- CSP / `X-Content-Type-Options` / `referrer` を meta で設定済み（セキュリティ面は良好）
- GA4 (`G-4MHCNR7D26`) が 421ファイルに導入済み

---

## 4. セマンティックHTML の健全性

### 4-1. 見出し階層 — 良好

| 項目 | 結果 |
|---|---|
| `<h1>` がちょうど1つ | **421 / 428** |
| `<h1>` が 0個 | 6（すべて noindex: `app/index.html`, `articles/transcendence.html`, `discover.html`, `events.html`, `map.html`, `media.html`） |
| `<h1>` が複数 | 1（`cms.html` に6個。管理画面なので対象外） |
| 見出しレベルの飛び | 1（`cms.html` の h1→h3 のみ） |

**公開対象ページの見出し階層に問題なし。** 指示書 B-4 のうち見出し部分は対応不要。

### 4-2. 【重大】リスト・表・時刻要素がサイト全体でゼロ

> 🔶 **一部解消（2026-08-01）** — A1 のハブ静的リンクで `<ul>`/`<li>` が 4ファイルに導入された。
> ただし **`<table>` `<time>` `<figure>` `<blockquote>` は依然ゼロ**、`<main>` も詳細ページ412枚に無い。
> 詳細ページ側の LINE UP のリスト化と日付の `<time datetime>` 化は未着手。

サイト全体（428ファイル）での要素使用状況:

| 要素 | 使用ファイル数 |
|---|---:|
| `<article>` | 414 |
| `<nav>` | 423 |
| `<footer>` | 420 |
| `<dl>` / `<dt>` / `<dd>` | 219 |
| `<main>` | **6** |
| `<section>` | **6** |
| `<ul>` `<ol>` `<li>` | **0** |
| `<table>` `<thead>` `<tbody>` | **0** |
| `<time>` | **0** |
| `<figure>` `<figcaption>` | **0** |
| `<blockquote>` | **0** |

これは指示書 §4「`<div>` でリスト・表を代用している箇所」に **直撃**する。具体例:

```html
<!-- LINE UP: 本来 <ul><li> であるべきリスト -->
<h2>LINE UP</h2>
<div class="lineup-list">
  <span class="lineup-item">Antal &amp; Hunee</span>
  <a class="lineup-item" href="/artists/ben-ufo.html">Ben Ufo</a>
  ...
</div>

<!-- 日付: <time datetime> が無い -->
<div class="detail-eyebrow">APR 17 — 19, 2026 · Higashi-Izu Cross Country Course, Shizuoka</div>
```

一方 **スペック情報の `<dl>` 化は既に適切**（219ファイル）:
```html
<dl class="detail-facts">
  <div><dt>開催日</dt><dd>APR 17 — 19, 2026</dd></div>
  <div><dt>会場</dt><dd>Higashi-Izu Cross Country Course</dd></div>
</dl>
```

**`<main>` が 414枚の詳細ページに無い**のも landmark 欠如として問題（ハブページ6枚にはある）。

### 4-3. 【重大】JAページの本文が全て英語で、`lang="ja"` が付いている

> 🔶 **一部解消（2026-08-01）** — 監査の推定どおり **Publish Now が未実行だったことが原因**で、
> 実行によりフェス86件が `desc`（日本語）/ `desc_en`（英語）のバイリンガル表示に切り替わった。
> `lang="ja"` の誤記は **108件 → 52件**。
> 残る52件はヴェニュー22件・アーティスト4件（各 JA/EN 2ページ）で、
> スプレッドシートに `DESC_JA` / `BIO_JA` が未入力なため。**生成側は既に対応済み**なので、
> 入力して Publish Now すれば同じ仕組みで点灯する。以下は監査時点の記録。

`<p lang="ja">` を持つ 108ブロックすべてで、中身が **英語**。

| ディレクトリ | 総数 | 日本語本文 | 英語本文 | 本文なし |
|---|---:|---:|---:|---:|
| `festivals/` (JA) | 87 | **0** | 86 | 1 |
| `artists/` (JA) | 97 | **0** | 4 | 93 |
| `venues/` (JA) | 22 | **0** | 22 | 0 |

JSON-LD 側も `"inLanguage": "ja"` を宣言しつつ `description` は英語。

**原因は特定済み（バグではなく未反映）。**
`build-detail-pages.mjs:93-111` の `bilingualBody(ja, en, pageLang)` は
`desc` / `desc_en` の両方が揃ったときだけ言語トグルを出し、片方のみなら
`<p lang="${jaT ? 'ja' : 'en'}">` を出力する。
現在 `LP/data.js` に `desc_en` / `bio_en` フィールドが**存在しない**ため、
英語テキストが入った `desc` が「ja スロット」として扱われ、`lang="ja"` が付いている。

> 既知の状況と整合する: バイリンガル移行（DESC=日本語 / DESC_EN=英語）は
> スプレッドシート側で完了しているが、**CMS の「Publish Now」が未実行**のため
> `LP/data.js` に反映されていない。**Publish 実行で自動的に解消する見込み。**
> AGENTS.md の方針に従い、データには手を触れていない。

### 4-4. アクセシビリティ（副次確認）

- `skip-to-content` リンクあり（ハブページ）
- ハンバーガー / SVG に `aria-label` / `aria-hidden` 付与済み
- ナビゲーションが `<ul>` ではなく `<div>` + `<a>` の羅列

---

## 5. 画像・パフォーマンス

### 5-1. `<img>` タグの品質（サイト全体 101タグ）

| 属性 | 件数 | 評価 |
|---|---:|---|
| `alt=` | 95 / 101 | 6件欠落 |
| `loading=` | **9 / 101** | 遅延読込ほぼ未適用 |
| `decoding=` | 11 / 101 | — |
| `fetchpriority=` | 2 / 101 | — |
| `width=` / `height=` | **0 / 101** | **CLS リスク（全件）** |
| `<picture>` | 0 ファイル | — |

`next/image` 相当は当然なし。**`width`/`height` がゼロ件なのが最も影響が大きい**（Core Web Vitals の CLS 直撃）。

### 5-2. 画像アセット

- `LP/images/` 合計 **15MB**、全て `.webp`（クライアント側 `compressImage`、1920px 上限で最適化済み）
- 最大: `festivals/technogaoka.webp` 1.4MB、`festivals/transcendence.webp` 712KB
- ファイル数: artists 4 / festivals 29 / venues 17 / articles 9

### 5-3. 【要修正】参照先が存在しない画像 6件

> ✅ **解消済み（2026-08-01）— 欠落は実際には8件だった。現在0件。**
> 本節の6件は生成HTMLからの参照分のみ。`data.js` 全体では
> `boars-phes-flyer.webp` と `festival-de-frue-flyer.webp`（SPA の `festivals.html:1412`
> からのみ参照）も欠落していた。
>
> **真因はスプレッドシートのセル値ではなく Drive に `.webp` が無かったこと。**
> `LP/cms.js:4369` の `webp()` が Publish 時に拡張子を機械的に `.webp` へ書き換えるため、
> セルが `.jpg` でも `.webp` でも出力は同じ。セル値の修正では直らない。
>
> 詳細な経緯と恒久対策は [§9-2](#9-2-欠落画像の真因と恒久対策) 参照。

各 8箇所（JA/EN × `<img>` + `og:image` + `twitter:image` + JSON-LD `image`）から参照:

| 欠落ファイル | 参照数 | 解消方法 |
|---|---:|---|
| `images/venues/liquidroom.webp` | 8 | CMS から webp をアップロード |
| `images/venues/bonobo.webp` | 8 | CMS から webp をアップロード |
| `images/venues/forestlimit.webp` | 8 | Drive の jpg を同期時に webp 変換 |
| `images/venues/clubasia.webp` | 8 | 同上 |
| `images/venues/mitsuki.webp` | 8 | 同上 |
| `images/festivals/boars-phes.webp` | 8 | FESTIVALS 行を削除（意図的・87→86件） |
| `images/festivals/boars-phes-flyer.webp` | SPAのみ | 同上 |
| `images/festivals/festival-de-frue-flyer.webp` | SPAのみ | Drive の jpg を同期時に webp 変換 |

→ 該当ページで画像が壊れ、OGP も 404 になる。
（AGENTS.md に従い、データ側の問題として報告のみ。修正はしていない）

### 5-4. フォント

- Google Fonts CDN から 423ファイルが読み込み。**セルフホストのフォントファイルは 0**。
- `display=swap` は 423ファイル全てに付与済み（FOIT 回避 OK）。
- `<link rel="preconnect">` を `fonts.googleapis.com` / `fonts.gstatic.com` に設定済み。
- ただし **実フォントファイルの `preload` は無し**、`<link rel="stylesheet">` はレンダーブロッキング。
- **ファミリー指定が4パターンに分裂している**（ウェイト構成違い）:
  ```
  Bebas Neue + DM Sans:200;300;400;500 + Space Mono:400;700
  Bebas Neue + DM Sans:200;300;400;500 + Space Mono:400
  Bebas Neue + DM Sans:200;300;400     + Space Mono:400
  Bebas Neue + DM Sans:200;300         + Space Mono:400
  ```
  → ページ遷移でフォントキャッシュが効かず再取得が走る。

### 5-5. その他の外部リソース

- `unpkg.com/leaflet@1.9.4`（3ファイル、地図）
- `cdn.jsdelivr.net/npm/quill@1.3.7`（CMS）
- `lh3.googleusercontent.com` の画像直参照 6件（Google Drive 直リンク、`about.html` 等）

### 5-6. 計測基盤

`.github/workflows/lighthouse.yml` が **既に稼働中**（push時 + 手動、`treosh/lighthouse-ci-action@v12`）。
対象URL: `/`, `/festivals.html`, `/artists.html` の3本。
→ 指示書 B-5 の「ビフォーを記録」は既存ワークフローのアーティファクトで代替可能。
**ただし計測対象が JS レンダリングのハブ3枚だけで、全体の97%を占める詳細ページが未計測。**

---

## 6. 監査サマリ — 本当のボトルネック

技術的な GEO 基盤（スキーマ・robots・sitemap・見出し階層）は**すでにかなり整っている**。
足を引っ張っているのは主に **コンテンツの欠落** と **JSレンダリング依存** の2点。

### 6-1. コンテンツ充足率

`LP/data.js` の実データ:

| エンティティ | 件数 | 本文あり | 画像あり | 備考 |
|---|---:|---:|---:|---|
| FESTIVALS | 87 | 86 | 16 | LINE UP 掲載は **10件のみ** |
| ARTISTS | 97 | **4** | **4** | **93枚が本文・画像ともに空のスタブ** |
| VENUES | 22 | 22 | 22 | 参照画像5件が実体なし（§5-3） |
| ARTICLES | **1** | 1 | 1 | 編集記事が実質ゼロ |
| EVENTS | **0** | — | — | — |

**アーティストページ 97枚のうち 93枚が、h1 + ジャンルチップ + 関連フェスリンクのみの実質的な空ページ。**
これは GEO 以前に、薄いページの大量生産としてインデックス品質そのもののリスク。

### 6-2. 未活用データの発見

`LP/data/` に **スプレッドシート由来の構造化データが眠っている**（`scripts/fetch-data.mjs` 生成）:

| ファイル | 件数 | 静的ページへの反映 |
|---|---:|---|
| `data/editions.json` | **86** | **0ページ**（「開催ヒストリー」は全 428ファイル中 0件） |
| `data/lineups.json` | **123** | 10フェスのみ（`data.js` 経由分） |
| `data/artists.json` | 90 | — |
| `data/festivals.json` | 86 | — |
| `data/venues.json` | 22 | — |

`_generatedAt` は全て **2026-07-12**（`data.js` の 07-30 より古い）。

> 開催回（EDITIONS）機能は CMS UI では稼働しているが、
> **生成された静的詳細ページには「開催ヒストリー」セクションが 1件も出力されていない**。
> 86回分の開催履歴 + 123行のラインナップは、`Festival.subEvent` / `Event` スキーマと
> 年次アーカイブページに直結する、GEO 上きわめて価値の高い一次データ。
> 報告のみとし、原因調査・修正はしていない。

### 6-3. 優先度つき所見一覧

状態は 2026-08-01 時点。✅=解消 / 🔶=一部解消 / ⬜=未着手。

| # | 所見 | 影響 | 状態 | 次のアクション |
|---|---|---|---|---|
| **A1** | ハブページが JS レンダリングで、詳細ページへの静的リンクが 0（§1-3） | 発見性 | ✅ | — |
| **A2** | アーティスト 93/97 が空スタブ、記事が 1件のみ（§6-1） | 引用価値 | ⬜ | BIO/画像の入力（Phase C） |
| **A3** | JAページ本文が全て英語 + `lang="ja"` 誤記（§4-3） | 言語シグナル | 🔶 | ヴェニュー/アーティストに `DESC_JA`/`BIO_JA` 入力 → Publish Now |
| **A4** | EDITIONS 86件 / LINEUPS 123件が未出力（§6-2） | 一次情報 | ⬜ | 未出力の原因調査 → `Festival.subEvent` 化 |
| **A5** | NEWS 記事がハッシュURLで個別URLを持たない（§1-4） | 発見性 | ⬜ | 記事の静的ページ化（生成側は対応済み） |
| **B1** | `<ul>` `<table>` `<time>` `<main>` がサイト全体でゼロ（§4-2） | 構造理解 | 🔶 | `<ul>`はハブのみ導入済。LINE UP のリスト化・`<time>`・`<main>` が残 |
| **B2** | JSON-LD にエンティティ間リンク（`@id`/`url`）が無い（§2-3a） | 知識グラフ | ⬜ | `performer` に `url` を付与（HTML側にリンクは既存） |
| **B3** | `<img>` に `width`/`height` が 0件（§5-1） | CLS | ⬜ | 生成側で付与 |
| **B4** | 参照先が存在しない画像 6件 × 8参照（§5-3） | 表示崩れ | ✅ | — （実際は8件・現在0件） |
| **C1** | FAQPage スキーマがサイト全体で 0件（§2-2） | AI回答適性 | ⬜ | FAQ コンテンツ整備とセットで |
| **C2** | Organization の `logo` がフェス写真（§2-3b） | ブランド認識 | ✅ | — |
| **C3** | EN セクションに入口が無い / ハブに hreflang 無し（§1-5, §3-4） | 多言語 | ⬜ | EN ハブページの新設 |
| **C4** | meta description が「…」で途中切断（§2-3d） | 引用品質 | ⬜ | `truncate()` を文境界で切るよう変更 |
| **C5** | Google Fonts の指定が4パターンに分裂（§5-4） | キャッシュ効率 | ⬜ | ウェイト構成を1つに統一 |
| **C6** | `sameAs` が Instagram のみ（Threads 未登録）（§2-3c） | エンティティ | ✅ | — |
| **C7** | `og:type` がフェス/ヴェニューで `website` 固定（§2-3e） | — | ⬜ | `article` へ |
| **C8** | `llms.txt` 未設置（§3-5） | 低 | ⬜ | 優先度低（指示書 B-6 も同様） |
| **D1** | PWAアイコンが実体のない `.jpeg` を参照（§1-5 派生・監査後に発見） | PWA | ✅ | — |
| **D2** | CMS「Image from URL」がフォールバック時に無変換の原本を保存し、同期で永久にスキップされる（監査後に発見） | 画像が出ない | ✅ | — （[§9-2](#9-2-欠落画像の真因と恒久対策)） |
| **—** | robots.txt に AI クローラーの**誤ブロックは無い**（§3-1） | 対応不要 | ✅ | — |

---

## 7. Phase B の実装エントリポイント（参考）

指示書の Next.js 前提を本リポジトリに読み替えたマッピング。

| 指示書 | 実際に触るファイル |
|---|---|
| B-1 JSON-LD コンポーネント | `scripts/build-detail-pages.mjs` — `festivalPage():329` / `artistPage():444` / `venuePage():507` / `articlePage():262` / `breadcrumbLd():50` / `page():206`（`:248` で JSON-LD 出力） |
| B-2 robots.txt | `LP/robots.txt`（静的・手編集） |
| B-3 sitemap | `scripts/generate-sitemap.py` + `.github/workflows/generate-meta.yml` |
| B-4 セマンティックHTML | `scripts/build-detail-pages.mjs`（詳細ページ）/ `LP/festivals.html` 等のハブHTML / `LP/cms.js`（SPA描画） |
| B-5 画像・フォント | `scripts/build-detail-pages.mjs` の `<img>` 生成箇所 / 各HTMLの `<link>` head |
| B-6 llms.txt | 新規スクリプト → `LP/llms.txt`、`generate-meta.yml` に追加 |
| ハブのSSR化（A1）| ✅ 実装済 — `build-detail-pages.mjs` の `writeHubLinks()` / `hubLinkList()`。ハブHTML側の `<!-- STATIC_LINKS:*:START/END -->` マーカー間を差し替える |

**注意点:**
- `LP/` 配下の詳細ページは**生成物**。直接編集しても次回 CI 実行で上書きされる。必ず生成側を直すこと。
- `LP/data.js` は CMS の「Publish Now」が生成する。**手編集しない**（AGENTS.md / docs/DATA_SCHEMA.md）。
- **再生成の前に必ず `git pull`。** ローカルの `data.js` が古いまま
  `build-detail-pages.mjs` を実行すると、Publish 済みの内容（バイリンガル等）が巻き戻る。
- 施策単位で `git commit` を分けること（指示書 §0）。

---

## 8. 本監査で変更したもの

- `~/Downloads/GEO_TECHNO_JAPAN.md` をリポジトリルートへ移動（指示書の指定どおり）
- 本ファイル `AUDIT_TECHNO_JAPAN.md` の新規作成

**上記2点以外、コード・データ・設定は一切変更していない。**
（監査後の対応は §9 に分けて記録している）

---

## 9. 対応履歴（2026-08-01）

対応後コミット: `f22cdd1`。

### 9-1. ロゴとブランド識別（C2 / C6 / D1）

`DEFAULT_OG` 1つが「Organization.logo」と「OGP フォールバック」を兼務していたのが問題の本質。
役割を分離した。

| ファイル | 変更 |
|---|---|
| `scripts/build-detail-pages.mjs:31-35` | `ORG_LOGO` 定数を新設。`DEFAULT_OG` は OGP 専用として据え置き |
| `scripts/build-detail-pages.mjs:294` | `NewsArticle.publisher.logo` → `ORG_LOGO` |
| `LP/index.html` / `LP/about.html` / `LP/news.html` | `Organization.logo` を差し替え、`sameAs` に Threads 追加 |
| `LP/manifest.json` | 実体のない `rainbow-disco-club.jpeg` → `logo-192.png` / `logo-512.png`、`type` も `image/png` へ |
| `LP/images/logo{,-512,-192}.png` | 実ロゴを追加（2000px マスター + 派生2つ） |

**URL を固定したので、今後のロゴ差し替えは画像ファイルの置換のみで済む**（コード変更不要）。
`sw.js:82-88` が画像を stale-while-revalidate で扱うため、既存訪問者にも次回アクセスで反映される。
ただし manifest の `sizes` 宣言と実寸を一致させる必要があるため、**正方形を維持すること**。

### 9-2. 欠落画像の真因と恒久対策

対応した所見: **B4 / D2**

**調査で判明した因果:**

1. CMS の「Image from URL」は、まずブラウザで画像を fetch して webp 化する（`cms.js:2095`）
2. 配信元が **CORS を許可していないと fetch が失敗**し、`upload_from_url` にフォールバック（`cms.js:2267`）
3. フォールバックでは GAS がサーバー側で取得し、**原寸の jpg/heic をそのまま Drive に保存**（webp 変換なし）
4. `sync-drive-images.yml` は **webp 以外をスキップ**するため、そのファイルは永久にサイトへ来ない
5. しかも成功と失敗で**同じ「アップロード完了」トースト**が出るため気づけない

Instagram CDN やフェス公式サイトは大半が CORS 非許可なので、URL 経由は高確率で ②→③ に落ちる。
Drive/venues が「22件すべて非webp」だったのはこれが積み重なった結果。

**スプレッドシートのセル値は原因ではない。** `cms.js:4369` の
`webp(p){return p.replace(/\.(jpe?g|png)$/i,'.webp')}` が Publish 時に拡張子を
機械的に書き換えるため、セルが `.jpg` でも `.webp` でも出力は同一。

**対策A — 同期時の webp 変換**（`.github/workflows/sync-drive-images.yml`）

- `Pillow` + `pillow_heif` を導入し、`.jpg/.jpeg/.png/.heic/.heif` を webp 変換
- 変換条件は `compressImage` と同一（長辺1920px / quality 85 / EXIF 回転補正）
- **二重ガード**: Drive 側に webp があればスキップ、リポジトリ側にあってもスキップ
  → 既存47枚を CI 変換版で上書きせず、無意味な差分churn を出さない
- 変換失敗は `::warning::` で GitHub UI に出す（黙って通さない）

出力バイトが決定的であることを確認済み（非決定的だと毎回全画像が差分になる）。

**対策C — CMS でフォールバックを可視化**（`LP/cms.js` / `LP/cms.css`）

- フォールバック時は `showOk`（緑）ではなく `showFallback`（黄）を表示
- プレビュー欄に消えない注記を出す（理由・同期待ちである旨・手動アップロード推奨）
- 一括アップロードもフォールバックした ID を集計して最後に表示

**結果** — 実行ログ:

```
Downloaded: bonobo.webp
Skipped (webp already in Drive): bonobo.jpg      ← 二重変換を回避
Converted: forestlimit.jpg -> forestlimit.webp (68 KB, 980x551)
Converted: mitsuki.jpg     -> mitsuki.webp     (74 KB, 1200x800)
Converted: clubasia.jpg    -> clubasia.webp    (72 KB, 1280x800)
Converted: festival-de-frue-flyer.jpg -> festival-de-frue-flyer.webp (151 KB, 960x1200)
Skipped (webp already in repo): womb.jpeg ...   ← 既存17件は無変更
Skipped (webp already in Drive): technogaoka.heic
```

本番の全URLが 200 を返すことを確認。**欠落参照 0件。**

### 9-3. 残る構造的な課題

Drive 側の原本は依然ほぼ `.jpeg/.jpg/.heic` のままで、リポジトリの webp は
7月22日の一括最適化でコミットされたもの。**Drive とリポジトリが二重管理状態**にある。
対策A で「新規アップロード分が死ぬ」問題は解消したが、
既存原本を Drive で差し替えても、リポジトリに webp がある限り変換されない
（`Skipped (webp already in repo)`）。
画像を更新したい場合は **CMS 経由でアップロードする**必要がある。

### 9-4. データ側の判断（記録）

- **boars-phes の削除は意図的**。FESTIVALS 87→86件、JA/EN ページ2枚と sitemap 2URL が削除された
- `articles/mari-1777827955425.webp` が生成されたが `LP/` から参照されていない。
  記事執筆時にアップして未使用のままか、参照が失われた可能性。害はないため放置
