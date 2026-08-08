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
| 記事の共有URL | ハッシュ版 | 静的ページURL |
| FAQPage スキーマ | **0** | **172ページ / 376問** |
| `Festival.subEvent` | 0 | 86ページ |
| 回帰ガード | なし | 14メトリクス + JS健全性検査 |

23件の所見（監査18件 + 監査後に発見した5件）のうち **13件が解消**、3件が一部解消。
残りは [§6-3](#6-3-優先度つき所見一覧) 参照。

**所見自体の訂正が1件ある**（A5）。詳細は [§1-4](#1-4-記事newsが-url-を持たない) 冒頭。

**残る最大の課題は A2**（アーティスト96/100 が本文なし）。技術的な地ならしは
ほぼ終わり、ここからはコンテンツの問題になる。

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

> ⚠️ **見出しと結論が誤り。訂正済み（2026-08-01）**
>
> - **誤**: NEWS記事がハッシュURLで個別URLを持たない
> - **正**: **個別URLは存在し、sitemap にも登録済み。**
>   `articlePage()` (`build-detail-pages.mjs:266`) が `/articles/{id}.html` を
>   NewsArticle + BreadcrumbList + canonical 付きで生成し、
>   `generate-sitemap.py:128-131` が sitemap に登録している。
>   旧ID用のリダイレクトスタブ機構（`REDIRECTS`）も既存。
>   SPA 側も `canonical` / `og:url` を静的ページのURLへ書き換えており、
>   Google はフラグメントを無視するため重複URLも発生していない。
> - **実害**: 共有ボタンが渡すURLがハッシュ版だったため、SNS 経由の
>   被リンク・メンションが記事ページに集まらず、OGP取得クローラーは
>   SPA実行前の NEWS 一覧の og を読んでいた（記事ごとのカードが出ない）。
> - **影響度**: 発見性 → **シェア経路の価値損失**に下方修正。
> - ✅ 解消済み — `news.html:1336` の共有URLを `articleUrlAbs`（静的ページURL）に変更。
>   X / Facebook / LINE / コピーの4経路すべてが同一変数を経由するため1行で解決。
>
> 監査時に `news.html` のハッシュURLとJS内リンクだけを見て、生成側と sitemap の
> 記事対応を確認しきれていなかったのが誤りの原因。以下は監査時点の記録。

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

> ✅ **解消済み（2026-08-01）— 108件 → 0件。**
>
> 監査の推定どおり原因は **Publish Now の未実行**で、コードの不具合ではなかった。
> 生成側の `bilingualBody()` は当初から対応済みで、データ入力だけが不足していた。
>
> | 段階 | 対応 | 残件 |
> |---|---|---:|
> | 監査時 | — | **108** |
> | ① | Publish Now 実行 → フェス86件が `desc`(日本語)/`desc_en`(英語) に切替 | **52** |
> | ② | ヴェニュー22件の `DESC` を `DESC_EN` へ移し、`DESC` に日本語を入力 | **8** |
> | ③ | アーティスト4名（dj-nobu / ken-ishii / kotsu / wata-igarashi）の BIO を日本語化 | **0** |
>
> ②の途中に「N列が空・W列に英語のみ」という中間状態があり、この時点で
> `bilingualBody()` は単言語ブランチに落ちて `<p lang="en">` を出すため、
> **日本語未入力のままでも誤記としては解消していた**（表示は英語のまま）。
> 誤記件数だけを追うと進捗を誤読しかねない点に注意。
>
> **⚠️ 誤記ゼロはコンテンツが充実したという意味ではない。**
> 現在 `lang="ja"` ブロックは全224個ありすべて日本語だが、その内訳は
> **「日本語で正しく書かれた4件」＋「そもそも本文を持たない96件」**である。
> アーティスト100件のうち BIO があるのは4件だけで、96件は本文が空のため
> 検査対象のブロック自体が存在しない。この項目(A3)の解消と、
> **A2（アーティスト96件が空スタブ）は別問題**として残っている。
>
> 以下は監査時点の記録。

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

> ✅ **解消済み（2026-08-01）— 実画像から取得した寸法を生成ページと
> JavaScript テンプレートへ付与。** ただし Lighthouse の同一ローカル条件で
> `festivals.html` を3回計測したCLS中央値は変更前 `0.10030`、変更後 `0.11401` で、
> **`width`/`height` の付与だけではCLS改善効果を実測できなかった。**
>
> Chrome の layout-shift エントリを追跡した結果、実際の主因は固定背景の
> `.tj-bg::after` と `.tj-scan` が `top` / `left` をアニメーションしていたことだった。
> 両方を同じ軌道・速度の `transform: translate()` ベースへ移行したところ、
> Lighthouse CI の本番計測でCLSは `0.10` 前後から対象8ページすべて `0` になった。
> **推測した対策を重ねる前に、計測から原因を特定して直すことの重要性が
> 示された事例である。** 今後はCLS `0.05` をCIの失敗閾値として回帰を防止する。

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

> ✅ **解消済み（2026-08-01）** — `editions.json` は `Festival.subEvent` として86ページに、
> `lineups.json` は `performer` と LINE UP セクションとして出力されるようになった。
> `data/*.json` も再生成し（07-12 → 08-01）、ARTISTS 90 → 100件、lineups 123 → 130行。
> 詳細は §9-7 と、閾値ファイルの各 note を参照。以下は監査時点の記録。
>
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
| **A2** | アーティスト 96/100 が空スタブ、記事が 1件のみ（§6-1） | 引用価値 | ⬜ | **残る最大の課題。** BIO/画像の入力（Phase C） |
| **A3** | JAページ本文が全て英語 + `lang="ja"` 誤記（§4-3） | 言語シグナル | ✅ | — （108→0。ただし A2 とは別問題） |
| **A4** | EDITIONS 86件 / LINEUPS 123件が未出力（§6-2） | 一次情報 | ✅ | — （subEvent + LINE UP として出力） |
| **A5** | ~~NEWS 記事がハッシュURLで個別URLを持たない~~ → **訂正**: 個別URLは存在。実害は共有URLがハッシュ版だったこと（§1-4） | シェア経路 | ✅ | — |
| **B1** | `<ul>` `<table>` `<time>` `<main>` がサイト全体でゼロ（§4-2） | 構造理解 | 🔶 | `<ul>`(ハブ)・`<table>`/`<time>`(開催ヒストリー)・`<dl>`(FAQ) は導入済。**LINE UP のリスト化と `<main>` が残** |
| **B2** | JSON-LD にエンティティ間リンク（`@id`/`url`）が無い（§2-3a） | 知識グラフ | 🔶 | アーティストに `@id` 付与済。**`performer` への `url` 付与が残** |
| **B3** | `<img>` に `width`/`height` が 0件（§5-1） | CLS | ✅ | 欠落は解消。ただしCLS改善効果は実測できず、主因は別にある（§5-1） |
| **B4** | 参照先が存在しない画像 6件 × 8参照（§5-3） | 表示崩れ | ✅ | — （実際は8件・現在0件） |
| **C1** | FAQPage スキーマがサイト全体で 0件（§2-2） | AI回答適性 | ✅ | — （86フェス × JA/EN、376問。§9-8） |
| **C2** | Organization の `logo` がフェス写真（§2-3b） | ブランド認識 | ✅ | — |
| **C3** | EN セクションに入口が無い / ハブに hreflang 無し（§1-5, §3-4） | 多言語 | ⬜ | EN ハブページの新設 |
| **C4** | meta description が「…」で途中切断（§2-3d） | 引用品質 | ⬜ | `truncate()` を文境界で切る |
| **C5** | Google Fonts の指定が4パターンに分裂（§5-4） | キャッシュ効率 | ⬜ | ウェイト構成を統一 |
| **C6** | `sameAs` が Instagram のみ（Threads 未登録）（§2-3c） | エンティティ | ✅ | — |
| **C7** | `og:type` がフェス/ヴェニューで `website` 固定（§2-3e） | — | ⬜ | `article` へ |
| **C8** | `llms.txt` 未設置（§3-5） | 低 | ⬜ | 優先度低 |
| **D1** | PWAアイコンが実体のない `.jpeg` を参照（監査後に発見） | PWA | ✅ | — |
| **D2** | CMS「Image from URL」が無変換の原本を保存し同期でスキップされる（監査後に発見） | 画像が出ない | ✅ | — （§9-2） |
| **D3** | `festivals.html` が10日間 JS 停止で一覧を表示していなかった（監査後に発見） | 全機能停止 | ✅ | — （§9-6） |
| **D4** | DATE が日付型セルで CMS 表示が崩れる。CSV では検出不能（監査後に発見） | 規約違反 | 🔶 | **D列の「書式なしテキスト」化と6件の再入力が残**（§9-9） |
| **D5** | `body-soul` の DATE 欠落（D3 の原因データ） | 一覧から消える | ✅ | — （`2026-06-07` を入力済み） |
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

### 9-3. 記事の共有URL

対応した所見: **A5**（所見の記述自体も訂正。[§1-4](#1-4-記事newsが-url-を持たない) 参照）

調査の結果、記事の静的ページ生成・sitemap 登録・canonical はすべて既に実装済みで、
**残っていたのは共有URLだけ**だった。

```js
// LP/news.html:1336
- const url = `https://techno-japan.media/news.html#article/${a.id}`;
+ const url = articleUrlAbs;   // :1280 で定義済みの静的ページURL
```

X / Facebook / LINE / コピーの4経路すべてが `url` を経由するため1行で解決する。
headless Chrome で実測し、4経路すべてが
`https://techno-japan.media/articles/transcendence-2025-report.html` を指し、
描画後DOMに `news.html#article/` が0件であることを確認済み。

**見送った案:**

- **クリック挙動の変更**（`onclick` の `preventDefault()` 廃止）と **pushState 化** —
  SPA の回遊体験（一覧に戻る・タグ絞り込み）を優先。canonical で検索側は解決済み。
- **`#article/` → 静的ページへの強制リダイレクト** — 同上の理由。
- **`#tag/`** — 一覧の絞り込み状態を表すものなので、ハッシュのままが妥当。

### 9-4. 残る構造的な課題

Drive 側の原本は依然ほぼ `.jpeg/.jpg/.heic` のままで、リポジトリの webp は
7月22日の一括最適化でコミットされたもの。**Drive とリポジトリが二重管理状態**にある。
対策A で「新規アップロード分が死ぬ」問題は解消したが、
既存原本を Drive で差し替えても、リポジトリに webp がある限り変換されない
（`Skipped (webp already in repo)`）。
画像を更新したい場合は **CMS 経由でアップロードする**必要がある。

### 9-5. データ側の判断（記録）

- **boars-phes の削除は意図的**。FESTIVALS 87→86件、JA/EN ページ2枚と sitemap 2URL が削除された
- `articles/mari-1777827955425.webp` が生成されたが `LP/` から参照されていない。
  記事執筆時にアップして未使用のままか、参照が失われた可能性。害はないため放置

### 9-6. festivals.html の10日間の障害（監査後に発覚）

**症状**: 本番のフェス一覧がまったく表示されず、絞り込み・検索も効かない。

**原因**: `LP/festivals.html:1159` の `getYearFromDate()`。

```js
function getYearFromDate(dateStr) {
  const [start] = dateStr.split('/');   // dateStr が undefined で例外
```

`data.js` の `body-soul` に `date` が無く、過去フェスを年でグループ化する処理で
`undefined.split()` が投げられ、**`buildMonthNav()` 以降の JS が全停止**していた。
一覧・月ナビ・ジャンルフィルタ・検索がまとめて死ぬ。

**発生時期は 2026-07-22（`ab64e92` の Publish）。今日の作業は原因ではない。**
`data.js` の全履歴を追跡して `body-soul.date` の消失時点を特定し、
当時の `festivals.html` + `data.js` をローカルで再現して同じ例外が出ることを実証した。
`getYearFromDate` 自体は 7/19 以前から存在しており、**コードは変わらずデータが壊れた**という順序。

**A1 の静的リンクが症状を可視化した。**

| | `<main>` の中身 | 見え方 |
|---|---|---|
| A1 実装前（〜7/31） | 0 bytes | 真っ白（誰も気づかない） |
| A1 実装後 | 9,130 bytes | 86件の素の箇条書き（「レイアウトが崩れた」と認識される） |

皮肉だが、**A1 が無ければ今も真っ白のまま放置されていた可能性が高い**。
フォールバックは SEO のためだけでなく、障害の可視化にも効くという実例。

**対応**: 他の日付ヘルパ（`formatFestDate` / `getMonthFromDate` / `isFuture`）は
すべて null ガード済みで `getYearFromDate` だけが漏れていたため、同じ形に揃えた。
呼び出し2箇所で `null` を除外し、日付なしフェスは月グループを作らない。
あわせて `.ssr-link-list` に CSS を定義した（定義が無く素の `<ul>` で出ていた）。

全ハブページの `.split()` を洗い直したが、**クラッシュしうる箇所は他になかった**。

### 9-7. 回帰ガードの構築

10日間気づかれなかったことが本質的な問題だったため、機械的な検出手段を作った。

**静的検査** — `.github/regression-thresholds.yml` + `scripts/check_regressions.py`。
「ページ数は増えても減らない」単調性だけを見る。意図的な減少は閾値を更新して
`note` に理由を書く運用（サイレントな引き下げの防止）。現在14メトリクス。

| 領域 | メトリクス |
|---|---|
| ラインナップ | `festival_performer_pages` 9 / `festival_performer_total` 75 / `lineup_section_pages` 10 |
| 内部リンク | `internal_links_to_artists` 75 / `internal_links_to_festivals` 75 / `artist_appearances_pages` 71 |
| 構造化データ | `festival_subevent_pages` 86 / `artist_entity_id_pages` 200 |
| FAQ・要約 | `festival_faq_pages` 172 / `festival_faq_section_pages` 172 / `festival_faq_qa_total` 376 / `festival_summary_pages` 172 |
| データ健全性 | `broken_image_refs` 0（max） / `artist_id_violations` 0（max） |

**JS健全性検査** — `scripts/check_hub_pages.py`。headless Chrome でハブ4ページを
実際に描画し、①Uncaught 例外 ②JS だけが生成するクラスの数 ③コンテナのサイズ を見る。
静的検査では「JS は配信されているが実行時に死ぬ」障害を検出できないため。

②を要素数で見るのが要点。**JS が落ちても A1 の静的リンクが残るので、
リンクの有無では描画失敗を検出できない。**

いずれも実効性を検証済み。`getYearFromDate` のガードを外して 7/22 の障害を
再現すると3シグナルすべてで検出し、`festival-de-frue` の LINE UP と performer を
落とすと3メトリクスが検出する。

設計上の判断:
- スキーマと可視HTMLは**別メトリクス**にした（片方だけ壊れることがあり、
  構造化データだけあって画面に出ていない状態は Google のガイドライン違反にもなる）
- Q&A は**ページ数と総数の両方**を持つ（ページ数だけだと1ページの設問が
  4問→1問に減っても検出できない）
- 合算メトリクスの min は合算値にする（`festival_faq_qa_total` を片言語分の
  188 にすると EN の全設問が消えても通ってしまう）

**このガードで検出できないもの**: 表示崩れ、文言の質、リンク先の妥当性、
1ページ内の部分的な欠落（メトリクスを追加しない限り）。件数の単調性しか見ていない。

### 9-8. FAQ と要約文（C1 の解消）

監査 C1「FAQPage がサイト全体で 0件」が解消した。フェス86件 × JA/EN に
`FAQPage` スキーマと可視HTMLの両方が入っている。

```html
<section class="festival-faq"><h2>よくある質問</h2><dl>
  <div><dt>FESTIVAL de FRUEの開催日はいつですか？</dt><dd>…2026年10月31日から…</dd></div>
```

設問はデータから自動生成され（開催日・会場・チケット等）、1ページあたり1〜4問、
合計376問（JA 188 + EN 188）。`<dl>` 構造なので監査 B1（リスト要素がゼロ）にも寄与する。
あわせて `<p class="festival-summary">` の要約文が172ページに入り、
指示書 Phase C-1（結論ファースト / BLUF）に対応した。

### 9-9. DATE の型混在（監査後に発覚）

CMS のフェス一覧で DATE の表示形式が2種類混在していた。

| 入力値 | Sheets の解釈 | GAS `getValues()` | CMS 表示 |
|---|---|---|---|
| `2025-09-07`（単日） | **日付型セル** | `Date` オブジェクト | `Sun Sep 07 2025 00:00:00 G…` |
| `2026-11-07/2026-11-08` | 文字列（`/` があり解釈不能） | 文字列 | 正常 |

**複数日が正しく見えていたのは「Sheets が日付と認識できなかったから」**という
消極的な理由で、混在は必然だった。DATA_SCHEMA は DATE を文字列と定めているため、
日付型セル6件（dom / intergalactic / big-fun / circus / topia / body-soul）は規約違反。

**サイト側への影響は無かった。** 書き出し(`buildFullDataJs`)と編集フォームは
`fmtDate()` を通しており、`data.js` も JSON-LD の `startDate`/`endDate`/`subEvent`
344個も `<time datetime>` も全件 ISO。**一覧描画(`renderList`)だけが生値を出していた。**

**重要な発見: この規約違反は CSV 経由では原理的に検出できない。**

Google Sheets の CSV 出力は日付型セルを表示書式に従って `2025-09-07` と
文字列化するため、`fetch-data.mjs`（公開CSV経由）からはセルの型が見えない。
gviz エンドポイントも試したが列単位の型しか返さず、全86件を `string` と報告した。
**型のまま値を受け取れるのは GAS 経由の CMS だけ**なので、検出はそこでしかできない。
`publishSanityCheck` に `instanceof Date` の判定を追加し、この理由をコードにも残した。

### 9-10. 画像の命名と自動採番

欠落画像の調査で判明した命名の実態を記録する。

| 用途 | 規則 | 例 |
|---|---|---|
| メイン画像 | `{ID}.webp` | `womb.webp` |
| フライヤー | `{ID}-flyer.webp` | `rainbow-disco-club-flyer.webp` |
| 開催回別 | `{ID}-{年}.webp` | `arch-2025.webp` |
| 記事内画像 | `{記事ID}-{13桁のepoch ms}.webp` | `transcendence-2025-report-1784770795749.webp` |

CMS のアップロードはファイル名を自動生成する（`cms.js:2106`）。

```js
const filename = type === 'festival-flyer' ? (id+'-flyer.'+comp.ext) : (id+'.'+comp.ext);
```

**エンティティ画像は ID から決まるため、同じエンティティに再アップロードすると
Drive 上で同名になり差し替えになる。** 記事内画像だけはタイムスタンプ付きで
毎回新規ファイルになるため、差し替えても旧ファイルが Drive に残る
（`articles/mari-1777827955425.webp` のように未参照ファイルが生まれる原因）。

拡張子は `compressImage()` の webp 対応判定で決まり、実質常に `.webp`。
ただし CORS フォールバック経路（§9-2）だけは原本の拡張子のまま保存される。

### 9-11. アセットのキャッシュバスティング破れ（監査後に発覚）

CMS の変更をデプロイしても、ブラウザ側に反映されない事象が起きた。
`cms.html`（新しい英語欄が見える）と `cms.js`（STATUS の draft 既定が効かない）で
新旧が食い違うのが手がかりになった。

**原因**: `sw.js:73` が前提としている「クエリでバージョン管理」が守られていなかった。

```js
// フォント/CSS/JS はファイル名かクエリでバージョン管理しているので cache-first でよい
if (/\.(css|js|woff2?|ttf|otf)$/i.test(url.pathname)) {
  event.respondWith(cacheFirst(request));
```

HTML は network-first なので `cms.html` は更新される。しかし JS/CSS は **cache-first** で、
キャッシュキーはクエリを含む完全URL。`cms.js?v=25` のまま中身だけ変えても、
一度取得したブラウザは永久に旧版を使い続ける。

| アセット | ?v 最終変更 | 実体の最終変更 | 据え置き中の変更回数 |
|---|---|---|---:|
| `cms.js` | 2026-07-13 | 2026-08-01 | **26** |
| `cms.css` | 2026-07-19 | 2026-08-01 | **8** |
| `data.js` | — | 2026-08-01 | **16** |
| `common.css` | — | 2026-08-01 | 1 |

**7月13日以降に入れた cms.js の変更26回ぶんが、既存ブラウザには届いていなかった。**
本番のファイル自体は正しく配信されていた（`curl` で全変更を確認済み）ので、
サーバ側ではなくキャッシュ層の問題。

**対応**: `cms.js?v=26` / `cms.css?v=12` / `common.css?v=3` / `data.js?v=7` へ更新。

**構造的な弱点**: バージョン更新が手作業で、忘れても誰も気づかない。
`favorites.js` / `search.js` / `image-dimensions.js` は**クエリ自体が無く**、
ファイル名も変わらないため、更新手段が存在しない状態にある。
恒久対策としてはビルド時にコンテンツハッシュを付与するのが本筋。

### 9-12. 記録: CMS の画像パス自動補完が .jpg を入れる

`cms.js:480-489` の `autoFillVenueImage` / `autoFillFestivalImage` /
`autoFillArtistImage` が、ID から画像パスを組み立てるときに `.jpg` を付けている。

```js
document.getElementById('f-image').value = id ? 'images/festivals/'+id+'.jpg' : '';
document.getElementById('f-flyer').value = id ? 'images/festivals/'+id+'-flyer.jpg' : '';
```

サイトが配信するのは `.webp` のみ（§9-2）。実害は今のところ無い —
Publish 時に `cms.js:4369` の `webp()` が拡張子を `.webp` へ正規化するため。
ただし **CMS の画面上は実在しないパスが表示され**、混乱の元になる。
`images/venues/womb.jpg` と表示されるが実体は `womb.webp`。

4箇所すべてを `.webp` に変えるのが素直。未修正。

### 9-13. 記事の keywords が静的ページに出ていなかった

`news.html:1331` の SPA は動的注入する JSON-LD に `keywords` を入れていたが、
`articlePage()` が生成する静的ページには無かった。

```js
// news.html（SPA）だけが出していた
keywords: (Array.isArray(a.tags) ? a.tags.join(', ') : '') || undefined,
```

JS を実行しないクローラーには SPA の注入が届かないため、**A5（共有URLが
ハッシュ版）とまったく同じ「SPA だけ対応済み」の取りこぼし**だった。

`articlePage()` の jsonLd に追加し、出力形式を SPA と揃えた（カンマ区切り
文字列、タグが無ければキーごと省略）。静的・SPA とも
`"Dj, Rave, transcendence"` で一致することを確認。

**教訓**: SPA と静的生成の二重実装があるため、片方だけに機能が入る事故が
起きやすい。news.html に手を入れたら `articlePage()` も見る、という対応関係を
意識する必要がある。同種の取りこぼしが他にも残っている可能性がある。

### 9-14. 将来の検討事項: TAGS 列は現状「死に列」

FESTIVALS / VENUES / ARTISTS の TAGS 列（共通メタ §1.6）は、
入力UIがあるのにサイトへ一切出力されていない。活用するなら以下が前提になる。

**① Publish 経路に載っていない**

`data.js` を組み立てる `buildFestivalsJs` / `buildVenuesJs` / `buildArtistsJs` は
`tags` を出力しない。出力しているのは `buildArticlesJs` だけ（`cms.js:4678-4683`）。
シートに値を入れても Publish しても `data.js` に現れず、サイトにも出ない。
実データでも FESTIVALS 87件・VENUES 22件・ARTISTS 100件すべて TAGS は空で、
値があるのは記事1件のみ。

**② CITY の表記揺れで同一概念が別タグになる**

CMS の「＋ ジャンル/都市から候補追加」（`suggestTags` / `cms.js:1645`）は
GENRE + CITY + TYPE を候補にするが、シートの表記が統一されていない。

| 由来 | 表記 | 例 |
|---|---|---|
| GENRE | 全大文字 | `TECHNO` `HOUSE` |
| CITY | **シートごとに不統一** | FESTIVALS は `Chiba`、VENUES/ARTISTS は `TOKYO` |
| TYPE | 小文字 | `festival` `rave` `club` |

同じ東京でも `Tokyo` と `TOKYO` の2タグが生まれる。
記事の既存タグはさらに別系統（`["Dj","Rave","transcendence"]`）。

**③ 正規化が無く完全一致で重複判定している**

`addTag()`（`cms.js`）は `includes` による完全一致で重複を弾くだけで、
大小変換もトリム以外の正規化もしない。上記②の揺れがそのまま別タグとして残る。
`news.html:1098` のタグ絞り込みは `toLowerCase()` で比較するため検索は通るが、
**表示は原文のまま**なので `#Dj` と `#DJ` が並びうる。

**④ タグの表記規約が DATA_SCHEMA に無い**

GENRE には §1.3 の正規リストがあるが、タグ全体の規約は未定義。
活用前に「大小・言語・区切り・許可語彙」を決める必要がある。
現時点で日本語タグの前例はゼロ（GENRE/CITY/TYPE がすべて英語のため）。

**着手する場合の順序**: ④ 規約を決める → ② CITY 表記を PREF 規約（§1.5）へ
正規化 → ③ `addTag()` に正規化を入れる → ① 出力を追加。
逆順にやると、揺れたタグが本番に出てから直すことになる。

### 9-15. 【設計方針・撤回済み】SEO は静的ページが担う。SPA には足さない

> ⚠ **この方針は 2026-08-02 に撤回された。**前提だった「静的ページが
> クローラーに届いていれば十分」は、カードが `preventDefault()` で SPA へ
> 遷移するため**ユーザーが静的詳細に到達していなかった**ことで崩れた。
> 誤りの内容は §9-20、廃止完了は §9-23。**記録として原文を残す。**

**2026-08-02 決定。以後この方針に従う。**（← 当時の記述。現在は無効）

> **SPA の詳細ビューは UI の利便性のためのものであり、SEO は静的ページが担う。**
> SPA 側に SEO 実装（JSON-LD 注入・meta 書き換え・canonical 更新）を新たに追加しない。

**決定の理由:**

1. 静的ページが正規URLとして実在し（記事2 / フェス86 / アーティスト107 / ヴェニュー22）、
   A1 の静的リンクから到達できる。canonical もそこを指している
2. SPA の JSON-LD 注入は JS を実行するクローラーにしか効かない。そして
   **そのクローラーは canonical が指す静的ページも読める**ので、二重に持つ意味が薄い
3. 二重実装を維持すると「片方だけ対応済み」の事故が続く。2026-08-01〜02 の2日で
   2件発生した（§1-4 の共有URL、§9-13 の keywords）

**この方針に基づき、対応不要と判断した差分（調査済み・記録のみ）:**

| # | 差分 | 判断 |
|---|---|---|
| 1 | SPA の NewsArticle に `inLanguage` が無い（静的にはある） | 対応不要 |
| 2 | SPA が `BreadcrumbList` を注入しない（静的にはある） | 対応不要 |
| 3 | festivals / artists / venues の詳細ビューが SEO 更新を一切しない<br>（meta 書き換え0・canonical 書き換え0・JSON-LD 注入0） | 対応不要 |
| 4 | SPA が `og:site_name` / `og:locale` / `twitter:card` を更新しない | 対応不要（初期値が正しく、記事ごとに変わる値でもない） |

**`news.html` の SEO 更新は歴史的経緯である。**

記事だけが meta 10項目・canonical・JSON-LD の動的注入を持っているが、これは
ハッシュURLしか無かった時代の名残であり、**あるべき姿ではない**。
現在は静的な記事ページが存在し canonical もそちらを指すため、役割は終わっている。

ただし**動いているものを剥がすコストのほうが高い**ため、既存実装はそのまま残す。
**これを「対応済みの見本」と見なして他セクションに横展開しないこと。**
方向としては逆で、記事側が過剰である。

**次に触る人へ**: `festivals.html` 等の詳細ビューに canonical や JSON-LD が
無いのは、**実装漏れではなく意図した設計**である。「記事だけ対応済みだから
揃えよう」と考えたら、まずこの節を読むこと。

### 9-16. 【教訓】nav-lang の境界判定に `</span></span>` を使わない

**同じ間違いを1日に2回した。** 3回目を防ぐため、事実を具体的に残す。

言語トグルのマークアップは JA と EN で**構造が非対称**である。

```html
<!-- JA: 最後が </a></span> -->
<span class="nav-lang"><span class="nav-lang-cur">JA</span><span class="nav-lang-sep">/</span><a href="/en/x.html">EN</a></span>

<!-- EN: 最後が </span></span> -->
<span class="nav-lang"><a href="/x.html">JA</a><span class="nav-lang-sep">/</span><span class="nav-lang-cur">EN</span></span>
```

現在言語は `<span>`、相手言語は `<a>` で出すため、閉じタグの並びが揃わない。
したがって次の正規表現は **JA 側で意図どおり動かない**。

```js
/<span class="nav-lang">[\s\S]*?<\/span><\/span>/
```

**1回目（生成コード）**: EN ハブ生成でトグルを差し替えようとしてこれを使った。
JA 側は `</span></span>` が nav-lang 内に現れないため、非貪欲でも**10KB 先**の
別要素までマッチし、詳細ビューのマークアップ152行を巻き込んで削除した。
`artist-back-btn` が消えて `Cannot read properties of null` が出たことで発覚
（headless Chrome の Uncaught 検出。静的HTML検査では通り抜けていた）。

**2回目（検証コード）**: 本番確認でトグルの有無を調べるのに同じ形を使い、
JA 側だけマッチせず「JA トップに言語トグルが無い」と**誤報告した**。
実際は6ハブすべてに存在し、正常に機能していた。

**対策**: 生成側が出す固定文字列をそのまま探す。生成と検証で同じ定数を見れば、
構造が変わってもズレない。`scripts/check_regressions.py` の
`hub_language_toggles` はこの方針で実装してある。

```python
f'<span class="nav-lang-cur">{cur}</span>' in html
and f'href="{other_href}">{other_lang}</a>' in html
```

**一般化**: このリポジトリの HTML は手書きで、同種の要素でも状態によって
タグ構成が変わる箇所がある。閉じタグの並びを境界に使う正規表現は、
片方の状態でしか検証していないと静かに壊れる。
固定文字列か、開始タグからタグ名を取って対応する閉じタグを探す方式にする
（後者は §9-11 のコンテナ抽出で採用した）。

### 9-17. 【パターン】renderList は生値を表示する — Publish 時の正規化を通すこと

CMS のフェス一覧で、サムネイル列に `✕` や `—` が出るフェスがあった。

| 記号 | 意味 | 原因 |
|---|---|---|
| `✕` | IMAGE に値があるが URL が 404（`onerror` で差し替わる） | シート生値が `.jpeg`、実体は `.webp` のみ |
| `—` | IMAGE が未登録（セルが空） | 正常な表示。71/87件が該当 |

**サイトは壊れていない。CMS 一覧だけがズレる。**

```
シート  .jpeg  ← CMS 一覧はこれを直接 <img src> にする → 404 → ✕
   ↓ webp() で正規化（cms.js:4576、Publish 時）
data.js .webp
   ↓
生成物  .webp  ← サイトは正常
```

**これは 9-9（DATE の型混在）とまったく同じ構図である。**
どちらも `renderList()` が**シートの生値をそのまま表示**していたことが原因で、
書き出し（`buildXxxJs`）と編集フォームは正規化を通していた。**一覧描画だけが漏れていた。**

| 列 | Publish 時の正規化 | renderList への適用 |
|---|---|---|
| `date` | `fmtDate()` | 2026-08-01 に修正（§9-9） |
| `image` | `webp()` | 2026-08-02 に修正（本節） |
| 他9列（id / name / city / type / genre / category / title / venue / readTime / website） | **なし** | 生値のままでよい |

修正は1行。`webp()` は関数宣言なので巻き上げにより `renderList` から参照できる。

```js
const img = webp(String(r.image||'').trim());
```

シートの26セルが `.jpeg` / `.jpg` のまま残っているが（Drive 原本のファイル名に由来）、
表示側で吸収するので実害は消えた。セルを直しても Drive の原本が `.jpeg` である限り
新規アップロードのたびに再発するため、表示側で正規化するほうが正しい。

**今後 renderList に列を追加するときは、その列が Publish 経路で正規化されているかを
必ず確認すること。** 正規化があるなら一覧描画にも同じ関数を通す。
`buildVenuesJs` / `buildFestivalsJs` / `buildArtistsJs` / `buildArticlesJs` を見れば分かる。

**追記（同日）**: 一覧を直した後、**編集画面のプレビューにも同じ問題が残っていた**。
「現在の画像 — images/festivals/snow-machine-japan.jpeg」と生値のまま表示され 404。
1件直して終わりにせず、`<img src>` に値を渡す箇所を全部数えるべきだった。

`cms.js` 内で画像パスを DOM に渡すのは13箇所。分類すると：

| 経路 | 箇所 | 値の出どころ | 対応 |
|---|---|---|---|
| セクション別プレビュー（venue / artist / festival の IMAGE・FLYER） | L330 / L367 / L417 / L418 | フォームの生値 | `resolveImgSrc()` に集約 |
| 「現在の画像」プレビュー | L2218 | フォームの生値 | `webp()` |
| 画像位置調整プレビュー | L1280 | フォームの生値 | `webp()` |
| 一覧サムネイル | L2606 | シート生値 | `webp()`（前述） |
| アップロード中／完了プレビュー | L2094 / L2261 / L2279 / L2342 / L2354 | dataURL・blob・外部URL | **対象外**（サイト内パスでない） |
| Drive 画像ブラウザ | L2199 / L3711 | `driveThumb()` の Drive URL | **対象外** |

プレビュー4箇所は**同じ7行が3つの関数にコピーされていた**（`resolveImg` の重複定義）。
1箇所直しても他2つに残るため、トップレベルの `resolveImgSrc()` 1本に統合した。
重複を残したまま個別に `webp()` を足すと、次に触る人がまた片方だけ直す。

`resolveImgSrc()` は**サイト内の相対パスのときだけ** `webp()` を通す。
`http(s)` の外部URL、`imageUrl` フィールド、アップロード直後の `blob:` は変換しない
（外部URLの `.jpeg` を `.webp` に書き換えたら、それこそ 404 になる）。

`fallbackToDriveImage()` は Drive を**ファイル名の完全一致**で引くため、
`data-path` は生値のまま渡し、照合側で生値と webp 名の両方を試すようにした。
Drive の原本は CORS フォールバック時に `.jpeg` のまま保存されることがあり、
通常アップロードでは `.webp` になるため、どちらも在りうる。

実測（フェス87件）:

| 列 | 値あり | 未登録 | 生値で404 | webp化後404 |
|---|---|---|---|---|
| IMAGE | 16 | 71 | 12 | **0** |
| FLYER | 15 | 72 | 14 | **0** |

**教訓**: 「同じ構図が他にないか」を確認するとき、*列*を数えるだけでは足りない。
**値が DOM に届く経路（sink）を数える。** 今回は列としては IMAGE/FLYER の2つだが、
経路は7つあった。

**なぜ回帰ガードで検出できなかったか**: `broken_image_refs` は生成物の HTML を
走査するが、生成物には `webp()` を通った `.webp` しか出ない。シートの生値は
検査の視界に入らない。同メトリクスは「サイト訪問者に壊れた画像が出ないこと」を
守るもので、今回の「CMS 運用者に ✕ が見えること」は守備範囲が違う。
表示側で正規化した以上、追加のメトリクスは不要と判断した。

### 9-18. Service Worker の分岐順で data.js が cache-first に吸われていた

HACHA MECHA を Publish Now しても本番の一覧に出ない、という報告から発覚。
**静的ページ側は正常だった**（`/festivals/hacha-mecha.html` は JA/EN とも 200、
sitemap にも掲載、data.js にも `status: "published"` で存在）。出ないのは SPA の一覧だけ。

`sw.js` の fetch ハンドラは上から順に評価し、最初に一致した分岐で `return` する。

```js
// L74 ← ここで data.js が捕まる
if (/\.(css|js|woff2?|ttf|otf)$/i.test(url.pathname)) { cacheFirst(request); return; }
...
// L88 ← 到達不能（デッドコード）
if (url.pathname.endsWith('/data.js')) { staleWhileRevalidate(request); return; }
```

**`url.pathname` はクエリを含まない。** `/data.js?v=7` の pathname は `/data.js` なので
`/\.js$/` にも一致する。data.js 専用の分岐は書かれていたが、一度も実行されていなかった。

さらに `cacheFirst()` にバックグラウンド更新は無い（後述）。結果:

| 訪問者 | 挙動 |
|---|---|
| 初回訪問 | 正しく表示される |
| 一度でも訪問済み | `tj-static-v1.12.0` の古い data.js が永久に返る |

HTML は network-first なので静的ページだけは新しくなる。
**「詳細ページは出るのに一覧に出ない」という切り分けが、そのまま原因を指していた。**

#### なぜ ?v で防げないか

data.js は **CMS の Publish Now が直接 commit する**（`git log` の `cms: publish data.js`）。
他の JS のように「変更したら参照元 HTML の `?v` を上げる」運用が働く余地が無い。
`?v=7` は固定のまま中身だけが変わるため、キャッシュキーで鮮度を管理できない。
**Publish のたびに中身が変わるものを cache-first に置くこと自体が誤り。**

`check_asset_versions.py`（§9-11）が検出できなかったのもこれが理由で、
同スクリプトは「origin/main から変更された JS/CSS の `?v` が据え置きか」を見る。
data.js は常に変更されるので毎回引っかかってしまい、そもそも運用に乗らない。

#### 対応

- data.js の分岐を CSS/JS 判定より**前**へ移動
- `VERSION` を `v1.12.0` → `v1.13.0`。`activate` が古いキャッシュを消すので、
  既に古い data.js を掴んでいるブラウザも次回訪問で復旧する
- `scripts/check_sw_routing.mjs` を追加（後述）

#### cacheFirst のコメントが実装と食い違っていた件

ヘッダーには "cache-first with background update" と書かれていたが、実装に更新は無い。
**コメントのほうを実装に合わせた。** cache-first の対象は `?v` 付きの CSS/JS/フォントだけで、
更新すれば `?v` が変わり別のキャッシュキーになる。同じ URL の中身は変わらないので、
裏で取り直しても常に同じ内容が返り、全ページ読み込みでネットワーク往復が倍になるだけ。
**実装が正しく、記述が誤っていた。**

#### 他に同じ理由でキャッシュに吸われているファイルは無いか

参照される JS/CSS は12件、**全件が `?v` 付き**（クエリ無しはゼロ）。
判定は「`?v` があるか」ではなく **「誰がそのファイルを書き換えるか」**。

| ファイル | 書き換える主体 | cache-first で安全か |
|---|---|---|
| `data.js` | CMS の Publish Now（自動 commit） | **× 今回修正** |
| `image-dimensions.js` | 人が `build-image-dimensions.mjs` を実行して commit | ○ `?v` 運用が効く |
| `common.js` / `common.css` / `search.js` / `favorites.js` / `lang-toggle.js` / `article-fx.*` / `detail.css` / `cms.*` | 人の編集 | ○ 同上 |

`image-dimensions.js` は `\.js$` に一致して cache-first になるが、人が編集して commit する
ものなので `?v` を上げれば届く（実際 2026-08-02 に `?v=1` → `?v=2` へ更新されている）。
**cache-first のままで正しい。** 更新漏れは `check_asset_versions.py` が止める。

自動 commit されるものは data.js のみ。ワークフローが commit するのは
`LP/images/`（stale-while-revalidate）と生成 HTML・sitemap・rss（network-first）で、
いずれも cache-first の経路に乗らない。

#### 回帰ガード: scripts/check_sw_routing.mjs

「分岐が書かれているか」ではなく **「実際にどの戦略が呼ばれるか」** を検査する。
今回の不具合は分岐が*存在した*のに到達しなかったのだから、存在を見ても意味がない。

sw.js を Node の `vm` でスタブ環境に読み込み、合成した fetch イベントを流して、
`caches` / `fetch` スタブへの**呼び出し順**から実際の戦略を判定する。

| 呼び出し順 | 戦略 |
|---|---|
| `fetch` | networkFirst |
| `caches.match` → `fetch` | cacheFirst |
| `caches.open` → `cache.match` → `fetch` | staleWhileRevalidate |

正規表現で sw.js を読むのではなく**実行する**ので、分岐の並べ替えや条件式の
書き換えにも追随する（§9-16 の教訓 — HTML/コードを正規表現で読むな）。

`MUST_NOT_BE_CACHE_FIRST` に「自動 commit されるので `?v` が上がらないファイル」を
理由つきで列挙し、cache-first に落ちたら fail させる。あわせて
`.github/workflows/*.yml` の `git add` を走査し、**JS/CSS を自動 commit する
ワークフローが増えたら警告**する（同じ性質のファイルが増えたことに気づくため）。

v1.12.0 の並び順を再現して fail することを確認済み。`regression-check.yml` に組み込んだ。

#### 副次的に見つかったデータ誤り（未修正・報告のみ）

シート FESTIVALS の `name_en` 列に、名前ではなく英語の説明文（`DESC_EN` と同一の347文字）が
入っており、EN ページの `<h1>` と `<title>` が説明文になっていた。全87件中この1件のみ。
AGENTS.md の方針に従い修正はせず報告した。

### 9-19. 英語入力欄が2組あり、上の組は保存時に必ず捨てられていた（7/22 に直した回帰）

`name_en` に説明文が入っていた件（§9-18 末尾）の調査から発覚。
CMS の venue / festival / artist フォームには **同じラベルの英語入力欄が2組**あった。

| | 見出し | 要素ID | 定義場所 |
|---|---|---|---|
| A | 🌐 **英語版**（説明文のすぐ下） | `f-name_en` / `f-desc_en` | `cms.html`（静的） |
| B | 🌐 **ENGLISH VERSION**（Publishing の直前） | `f-nameEn` / `f-descEn` | `cms.js` の `buildPublishingSection()` が注入 |

保存はこの順で、**A は常に B に上書きされていた**。

```js
Object.assign(payload,{ …, name_en: g('f-name_en'), desc_en: g('f-desc_en') });  // A を読む
…
if(section !== 'author') Object.assign(payload, getPubFields(section));           // B で上書き
```

- 新規追加: B は空なので、A に書いた英語は**空で保存**される
- 既存編集: `setPubFields()` が B に旧値を入れるため、A を直しても**旧値で上書き**される

つまり **A に入力しても絶対に保存されない。**画面には見えているので、
入力者からは「保存したのに反映されない」としか見えない。

#### これは 7/22 に一度直っていた

`c41f403`（2026-07-22）のコミットメッセージ:

> 重複していた英語入力欄を統合: フェスDesc(EN)/アーティストBio(EN)は
> 「🌐 ENGLISH VERSION」セクションに一本化（**保存時に古い値で上書きされる事故の芽を除去**）

**その10日後、`f3fb4e5`（2026-08-01「英語欄を3セクションに追加」）で A 側を作り直し、
同じ構造を復活させてしまった。** 既存の B 側に気づかないまま「英語欄が無い」と判断して
追加したのが原因。**過去の修正コミットを確認していれば防げた。**

#### 8/1 の「DESC_EN が入らない」の真因

当時は「`saveEdit` 内で `desc_en` を読む処理が `resetForm` より後に来ている」と結論したが、
`git blame` で確認すると **`resetForm(section)` の呼び出し位置は 2026-07-10 の `fb7efe98` 以降
一度も動いていない**（payload 構築のほうが先で、順序は最初から正しかった）。
一方 A 側の読み取り行は `f3fb4e5`（8/1）で追加されている。

症状（A に入力 → シートが空）を説明できるのは **B による上書き**のほうで、
最終的に保存できたのは B 側に入力したときだったと考えるのが自然。
**当時の結論は誤りだった可能性が高い。**

#### 対応

- `cms.html` の A 側3ブロック（各5行）を削除
- `cms.js` から A 側への参照12箇所を除去（`editRow` の `setVal` 3、payload の読み取り
  6＝新規追加と編集の両パス、`resetForm` の id リスト3）
- A に足していた注意書き「✨翻訳は下書きです。必ず目視で確認してから公開してください」を
  B の見出しへ移設。翻訳ボタンは B に既にある（`autoTranslateField`）
- **記事セクションは対象外。** `buildPublishingSection()` は `isArticle` のとき英語欄を
  出さない（`const enSection = isArticle ? '' : …`）ので、`cms.html` の
  `ar-title_en` / `ar-excerpt_en` / `ar-body_en` は重複しておらず、消すと入力欄が無くなる。
  「🌐 英語版」で一括削除しようとして気づいた（4件ヒットし、3件だけが重複）

#### 教訓

**「欄が無い」と判断して追加する前に、同名の欄が別の場所で生成されていないか探す。**
今回 B 側は `cms.js` がテンプレート文字列で注入していたため、`cms.html` を
grep しても見つからなかった。**静的 HTML だけを見て「無い」と判断してはいけない。**

§9-17 の教訓（値が DOM に届く経路を数える）と同じ構図で、
**DOM に存在する要素は静的ファイルだけでは分からない。**

### 9-20. 「SEO は静的ページが担う」の前提が誤っていた — 静的詳細はユーザーに届いていない

> **時系列**: 8/1 §9-15 でこの方針を決定 → 8/2 前提の誤りが判明（本節）→
> 8/2 全4セクションで SPA 詳細ビューを廃止（§9-23）。
> **現在この方針は無効。**AGENTS.md は「詳細ページは静的生成のみ」に置き換え済み。

§9-15 / AGENTS.md に記録した設計方針が、**前提の確認不足により誤っていた。**

#### 8/1 に何をどう判断したか

「記事まわりの JSON-LD を SPA と静的で全項目突き合わせる」調査の結論として、
SPA の詳細ビューと静的詳細ページで出力に差があることを確認した。そのうえで
**「SPA の詳細ビューは UI の利便性のためのもので、SEO は静的ページが担う」**
を明示的な設計方針とし、SPA 側に SEO 実装を足さないことを決めた。
`festivals.html` 等の詳細ビューに canonical や JSON-LD が無いのは
「実装漏れではなく意図した設計」と AGENTS.md に明記した。

#### 判断の前提

この判断が成り立つ条件は **「静的ページが正規 URL でクローラーに届いていること」**
だった。canonical・sitemap・hreflang が静的ページを指しており、
JS を実行するクローラーも canonical 先を読める。だから二重実装は不要、とした。

**この前提自体は正しい。クローラーには実際に届いている。**

#### 見落とし

**カードのリンクが `preventDefault()` で SPA へ遷移する。**

```js
// festivals.html:1016 / artists.html:864 / venues.html:800 / news.html:1070
<a href="/festivals/${f.id}.html"
   onclick="event.preventDefault();location.hash='festival/'+…">
```

`href` は静的ページを指しているので、リンクとしては正しく見える。だが JS が
有効な通常のユーザーがクリックすると `preventDefault()` され、SPA の
ハッシュビューへ遷移する。**静的詳細ページに到達するのは、クローラーと、
JS 無効の閲覧者と、URL を直接開いた人だけ。**

つまり静的ページにだけ実装した FAQ・開催ヒストリー・performer・Instagram・
要約文・回遊ブロックは、**クローラーには届いているが人間のユーザーには
一度も表示されていなかった。**

#### 教訓: 「クローラーに届いているか」と「ユーザーに届いているか」は別の問い

8/1 に確認したのは前者だけだった。canonical と sitemap を見て
「届いている」と結論し、**そのページに人間がどう到達するかを確認しなかった。**

SEO の観点では静的ページで十分でも、**同じ内容がユーザーに見えているかは
別に確かめる必要がある。**「SEO 対応済み」は「実装済み」を意味しない。

チェックすべきだったのは1つだけ。**「カードをクリックしたらどの URL に行くか」。**
`preventDefault()` の有無を見れば済んだ。実装の内容ではなく、
**ユーザーの導線**を見ていれば気づけた。

同種の間違いを避けるための問い:
- その内容は**どの URL** に出力されているか
- その URL に**ユーザーはどうやって到達する**か
- 到達しないなら、それは**誰のための実装**か

#### 実害の規模（実測）

`scripts/audit_spa_vs_static.py` で全210エンティティを実測した。
結果は `reports/spa-vs-static.md`。SPA 詳細に無く静的にだけある要素の合計は **878**。

| セクション | 件数 | 欠けがある | 欠け合計 | 計測時点 |
|---|---|---|---|---|
| festival | 87 | 87 | 680 | `039acd8`（廃止前）|
| artist | 100 | 71 | 75 | `039acd8`（廃止前）|
| venue | 22 | 21 | 120 | 現在（SPA 現役）|
| article | 1 | 1 | 3 | 現在（SPA 現役）|

festival の内訳（SPA→静的）:

| 項目 | SPA | 静的 |
|---|---|---|
| 回遊ブロック（「〇〇の他のフェス」） | 0 | **300** |
| FAQ の Q&A | 0 | **188** |
| 開催ヒストリー | 0 | **86** |
| 要約文 | 0 | **87** |
| Instagram | 1 | 20 |
| ラインナップ | 143 | 130 |

**回遊ブロックが最大の欠落だった。**当初 Codex が 99flags で観測した
「ラインナップ SPA 13 / 静的 19」は、静的側の 19 に回遊ブロックの
6件（同じ `lineup-item` クラスを使い回している）が混ざった数で、
LINE UP 章だけなら両側 13 で同数だった。差は別の項目にあった。

構造的な原因は**データ源の違い**。静的生成は `LP/data/editions.json`（86行）と
`LP/data/lineups.json`（130行）を追加で読むが、SPA は `data.js` しか読まない。
`data.js` は editions を1件も持たず、lineup も 11/87 しかない。
SPA 側に `editions-timeline` の描画コードはあるが、**データが無いので永久に出ない。**

#### 副産物: SPA が白紙になるフェスが5件あった

`festivals.html:1463` の `f.genre.map(...)` にガードが無く、GENRE 未設定の
5件（`ultra-japan` `labyrinth` `wonderfruit-kyoto` `odyssey` `technogaoka`）で
`Cannot read properties of undefined (reading 'map')` が出て詳細ビューが空になっていた。
差分どころか何も表示されていない。廃止(`e381842`)で解消。

同型のガード漏れを Artist / Venue / News でも探した。

| 箇所 | 状態 |
|---|---|
| `artists.html` の `${a.genre}` / `${a.bio}` | 96件が undefined 表示。廃止(`8c289b4`)で解消 |
| `venues.html` の `c.genre.some(...)` ×5 | **落ちる。地図のジャンル絞り込み。`a61c6d2` で修正** |
| `news.html` の `a.tags` | 全箇所ガード済み。問題なし |

`venues.html` は SPA 詳細の廃止とは独立した実バグだった。地図の絞り込みは
詳細ビューを廃止しても残るため、Venue の廃止を待たずに `Array.isArray` ガードを入れた。

#### 計測は対象コミットを固定すること

最初の計測は Codex の廃止コミットと並行して走らせてしまい、festival / artist が
「廃止後」を測っていた（全件 `spa_rendered=False`）。**同一リポジトリで並行作業して
いるときは、`git worktree add <dir> <commit>` で計測対象を固定する。**
今回の廃止前データはすべて `039acd8` の worktree で取り直した。

なお headless Chrome を並列実行すると、既定プロファイルの奪い合いで描画に失敗する
個体が出る（`--workers 6` で 87件中 5件失敗 → 87件全滅と実行ごとに結果が変わった）。
失敗個体は SPA 側が全項目 0 になり「SPA に何も無い」という誤った結論に直結する。
逐次実行が既定。詳細は `reports/README-spa-vs-static.md`。

#### AGENTS.md の記述は SPA 廃止後に見直しが必要

現在の AGENTS.md「SEO の担当範囲（設計方針）」は、
**SPA の詳細ビューが存在することを前提に書かれている。**

- 「SPA の詳細ビューは UI の利便性のためのもの」→ SPA 廃止で対象が消える
- 「SPA 側に SEO 実装を新たに足さない」→ 同上
- 「`festivals.html` 等の詳細ビューに canonical や JSON-LD が無いのは意図した設計」
  → 詳細ビュー自体が無くなるので記述の対象が消える

**SPA 廃止が完了した時点で、この節は「詳細は静的ページに一本化」という
簡潔な記述に置き換えるべき。**残したままだと、存在しない SPA 詳細ビューについての
指示が残り、次に読む人を混乱させる。`news.html` の動的注入についての
「歴史的経緯」の記述も、同時に整理対象になる。

### 9-21. 回帰検査のデプロイ必須化が、翌日に実際の事故を止めた

`039acd8`（2026-08-02 13:54）で deploy-pages.yml に回帰検査の合格を必須化した。
**その約1時間後、この仕組みが実際に壊れたデプロイを2回止めた。**

#### 何が起きたか

§9-20 の調査中に見つかった `venues.html` のクラッシュ（地図のジャンル絞り込みで
`c.genre.some` が undefined を踏む）を `a61c6d2` で修正した。5箇所すべてに
`Array.isArray` ガードを入れ、実データで再現と修正を確認してから push した。

**が、`LP/en/venues.html` を再生成していなかった。**

EN ハブは `build-detail-pages.mjs` が JA から生成する。JA だけ直して push したため、
生成物とコミット内容が食い違い、検査が落ちた。

```
##[error]LP/ の生成物がコミット内容と一致しません（1 ファイル）。
 LP/en/venues.html | 20 +++++++++++++++-----
```

`a61c6d2` と、その後の `6acf326` の2件がデプロイされずに止まった。
pull → 再生成 → 差分確認（ガード5箇所の伝播のみ、JA/EN とも 1222 行で一致）→
コミットで解消し、`e70359e` で success。

#### 検査が無ければどうなっていたか

**JA だけ直り、EN は落ちたまま本番に出ていた。**しかも症状は
「東京の地図でジャンルを絞ると固まる」という、EN サイトを見ない限り
気づけないもの。次に誰かが `build-detail-pages.mjs` を実行するまで
差分は表面化せず、そのときには原因のコミットから何日も離れている。

§9-11（cms.js の変更26件が `?v` 据え置きで届いていなかった）と同じ形で、
**「片方だけ直った」状態が静かに残る**事故だった。

#### 記録する理由

回帰ガードは「入れたが何も起きない」期間が長く、価値が見えにくい。
**入れた翌日に実際の事故を止めた**という事実は、この種の投資を続ける根拠になる。

あわせて、ガードが機能する条件も確認できた。この検査は
「生成物がコミット内容と一致するか」を**生成側の変更有無に関わらず毎回**見る。
「生成側を触ったときだけ検査する」という設計だったら、今回は
`LP/venues.html`（生成物ではなく手書きのハブ）を触っただけなので**素通りしていた。**
検査対象を絞り込まなかったことが効いた。

#### 補足: 回遊ブロックは AI クローラーの導線でもある

§9-20 の実測で最大の欠落だった回遊ブロック（festival 300本 / venue 120本）は、
ユーザーの回遊導線であると同時に**エンティティ間を辿る内部リンク**でもある。

8/1 の A1 で「ハブ → 詳細」は開通させたが、**「詳細 → 詳細」は SPA 側で
切れていた。**静的ページには回遊ブロックがあるので、クローラーから見た
リンクグラフは繋がっている。だが**ユーザーから見たグラフは詳細で行き止まり**
だった。ここでも「クローラーに届いているか」と「ユーザーに届いているか」の
区別（§9-20）が効いている。

### 9-22. 【課題・未対応】LINEUP はステージ別・日別の構造を表現できない

フェス情報の入力効率化を検討する過程で、実在のフェスを1件調べたところ判明した。
**入力効率化とは別のスキーマの課題**なので、切り離して記録する。

#### 現状

| 保持場所 | 形 | 実データ |
|---|---|---|
| `FESTIVALS.LINEUP`（R列） | カンマ区切り → `data.js` でフラット配列 | 11/87件・最大21名 |
| `LINEUPS` タブ → `LP/data/lineups.json` | 1行=1出演 | 130行・10 EDITION |

`lineups.json` の列は **`EDITION_ID` / `ARTIST_ID` / `SET_TYPE` / `SORT` / `ACT_LABEL`**。
`SET_TYPE` は `dj` 126 / `b2b` 2 / `live` 2、`ACT_LABEL` は55行で使用。

#### 表現できないもの

「SPRING LOVE 春風 2026」を実際に調べたところ、こうなっていた。

```
DAY 1 (3/28)  SPRING STAGE / ART STAGE / PEACE TENT / NIGHT HARUKAZE(別会場 22:00)
DAY 2 (3/29)  SPRING STAGE / …
```

**4ステージ × 2日、50名超。**現状のスキーマではフラットに潰すしかなく、
「誰がどのステージの何日目に出るか」が落ちる。`SORT` で順序は持てるが、
**ステージも日付も持てない。**

#### 補足: LINEUPS タブに STAGE / DAY 列は無い

検討時に「LINEUPS タブには STAGE / DAY が設計済みなので移行時に解決する」と
想定したが、**実データを確認したところ両列とも存在しない**（上記5列のみ）。
移行しただけでは解決せず、**列の追加が必要**。

日付については `EDITIONS` タブが `DATE_START` / `DATE_END` を持つが、
これは開催回の期間であって**出演日ではない**。EDITION 単位なので、
2日間のフェスで「どちらの日か」は区別できない。

#### 解決の方向（未着手）

`LINEUPS` に `STAGE` と `DAY`（または `SET_DATE`）を追加するのが素直。
1行=1出演の正規化構造なので、列追加で表現できる。
ただし以下は未検討:

- 静的ページ側の LINE UP 表示をステージ別にグルーピングするか
- `Festival.performer` の JSON-LD をどう分けるか（`subEvent` に寄せる案）
- 既存130行のマイグレーション（STAGE 不明のものをどう埋めるか）

**当面はフラットのまま運用する。**大規模フェスを登録するときに情報が
落ちることを承知したうえでの判断。

### 9-23. SPA 詳細ビューの廃止完了 — 878件の内容がユーザーに届くようになった

§9-20 で実測した「静的ページにあるがユーザーには見えていない」878件について、
4セクションすべての SPA 詳細ビューが廃止され、本番へ反映されたことを確認した。

| セクション | 廃止コミット | 廃止前の欠落 |
|---|---|---|
| festival | `e381842` | 680 |
| artist | `8c289b4` | 75 |
| venue | `fdd3bef` | 120 |
| article | `38e0325` | 3 |
| | | **計 878** |

#### 「878 → 0」ではない

当初この完了条件を `missing_in_spa` が 0 になることと表現したが、**これは誤り。**
あのメトリクスは「SPA と静的の差」であり、SPA が消えた世界では分母が無くなる。
SPA 側が全項目 0 になるだけで差は縮まらず、むしろ広がって見える。

正しくは **「878件がユーザーに届くようになった」**。確かめるべきは次の2つで、
`scripts/audit_spa_vs_static.py --after` として実装した。

**1. SPA 詳細ビューへ入る経路が消えたか**（JA/EN 8ハブすべてで確認）

| 検査 | 結果 |
|---|---|
| `id="<section>-detail"` が無い | ✅ 8/8 |
| `location.hash='<section>/` が無い | ✅ 8/8 |
| カードリンクが `preventDefault` されていない | ✅ 8/8 |
| 静的詳細ページが全件ある | ✅ festival 87 / artist 100 / venue 22 / article 1 |

**2. 廃止のついでに静的側が痩せていないか**（`spa-vs-static.before.csv` と突合）

| 項目 | 廃止前 | 廃止後 |
|---|---|---|
| 回遊ブロック（festival） | 300 | **300** |
| 回遊ブロック（venue） | 120 | **120** |
| FAQ の Q&A | 188 | **188** |
| 開催ヒストリー | 86 | **86** |
| 要約文 | 87 | **87** |
| ラインナップ | 130 | **130** |
| 出演フェス（artist） | 75 | **75** |

**全22項目が同値。1件も減っていない。**これが本体に近い検査で、
SPA を消すついでに静的側を壊していたら、split-brain が解消しても内容が失われる。

本番の実ファイルでも抜き取り確認した。`/festivals/99flags.html` `/festivals/paramount.html`
は 200 で FAQ・開催ヒストリー・要約文・回遊をすべて持ち、ハブのカードリンクは
`href="/festivals/${id}.html"` で静的ページを指している。

#### これで解消したこと

- **「詳細 → 詳細」の導線が繋がった**（§9-21 の補足）。8/1 の A1 で「ハブ → 詳細」は
  開通していたが、詳細で行き止まりになっていた。回遊420本（festival 300 + venue 120）が
  ユーザーから辿れるようになった
- クローラーが見るリンクグラフとユーザーが見るリンクグラフが一致した
- `artists.html` が96件に文字列 "undefined" を表示していた問題も同時に消滅（§9-20）

#### 訂正: 旧 Festival SPA にも回遊ブロックは存在した

§9-20 と `reports/spa-vs-static.md` の `related: SPA 0 / 静的 300` を根拠に、
旧 Festival SPA には「関連フェス」の回遊ブロックが無かったと判断していたが、これは誤り。
`039acd8:LP/festivals.html` の実コードには `buildRelatedFestivals(current)` があり、
`renderDetail()` の末尾から実際に呼ばれていた。同じ地域または共通ジャンルを持つフェスを
スコア順に最大4件選び、画像・日付・名称・地域を持つ `RELATED FESTIVALS` カードとして
実行時に描画していた。

誤集計の直接原因は `scripts/audit_spa_vs_static.py` の `festival_features()` が、SPA側の
回遊を解析せず `"related": (0, ...)` と **0をハードコードしていた**こと。静的側の300は
生成済みHTMLにある具体的なリンク数である一方、SPA側はJavaScriptによる実行時生成だったため、
この2値をそのまま比較することはできなかった。したがって「SPAに回遊が無かった」および
「回遊300本がクローラーにしか届いていなかった」という旧記述は、Festivalについては撤回する。
SPA廃止によってURL・内容・ユーザー経路を静的ページへ統一した意義は変わらないが、
回遊UIの有無をその根拠には用いない。

この誤った数字はPerkeyとClaudeによる実装優先順位の判断にも使われた。今後、実行時生成の
特徴量を静的解析できない場合は0で代用せず「未計測」とし、ブラウザ実行で確認する。

#### 残る作業

`AGENTS.md` の「SEO の担当範囲（設計方針）」は SPA 詳細ビューの存在を前提に
書かれており、**現在は見直し予告の注記だけが入っている状態。**
節そのものを「詳細は静的ページに一本化」へ置き換える作業が残っている。
`news.html` の動的注入についての「歴史的経緯」の記述も同時に整理対象。

### 9-24. CMS の CSP と認証トークンのオリジン分離（未着手）

CMS は認証情報 `cms_token` と有効期限を `localStorage` に保存している。現在の
`cms.html` は公開サイトと同じ `https://techno-japan.media` オリジンにあるため、
同一オリジン上で実行された JavaScript は理論上このトークンへアクセスできる。
公開ページで外部 CDN のスクリプトを許可することは、単なる表示部品の依存ではなく、
CMS の認証情報へ到達し得るコードを同一権限で実行する意味を持つ。

現状の `cms.html` には Content Security Policy が設定されていない。CSP の段階導入を
検討したが、`Content-Security-Policy-Report-Only` は `<meta http-equiv>` では利用できず、
HTTP レスポンスヘッダーでの配信が必要。一方、現在利用している GitHub Pages では
任意のレスポンスヘッダーを設定できない。このため、現行構成のまま report-only で
実アクセスを観測してから強制モードへ移ることはできない。

#### 承認済みの段階導入案（着手は後回し）

1. CMS が使う通信先・画像元・外部ライブラリ・インライン処理を実ブラウザで全数記録する
2. CMS 側の Leaflet と Quill もローカル化し、外部スクリプト依存を先に減らす
3. CSP 付きのテスト用 CMS でログイン・読込・保存・画像・ジオコード・同期・Publish を検証する
4. Cloudflare 等を前段に置ける場合に限り、`/cms.html` へ Report-Only ヘッダーを配信して違反を収集する
5. 検証済みの許可リストを meta CSP として本番適用する
6. インラインイベントを外部 JS へ段階的に移し、最終的に `'unsafe-inline'` を削除する
7. CSP 違反と主要 CMS 操作を CI の実ブラウザテストで保護する

コンテンツ充足を優先し、管理機能を拙速な CSP で停止させないため、現時点では記録のみに
留める。ただし、CSP は同一オリジンにある認証情報そのものを分離する仕組みではない。
中期的には CMS を `cms.techno-japan.media` へ移し、公開サイトと別オリジンにすることが
本質的な対策となる。GitHub Pages でのサブドメイン運用、GAS 通信、Drive 同期、費用への
影響は別タスクで調査する。

### 9-25. LINEUP のアーティスト名照合 — 130行中55件(42%)がリンクされていない

#### 照合はどこで行われるか

**`scripts/fetch-data.mjs:225`。**`build-detail-pages.mjs` でも CMS でもない。
`FESTIVALS.LINEUP`（カンマ区切りの名前）を `ARTISTS.NAME` と突合して
`LP/data/lineups.json` を生成する。シートの LINEUPS タブは読んでいない
（ビルド時に導出。コメントに「旧 migrate-phase0.gs と同じ規則」）。

```js
const normName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
```

#### 何を吸収し、何を吸収しないか

| ケース | 結果 |
|---|---|
| 大文字小文字（`DJ Nobu` / `dj nobu`） | **吸収する** |
| 前後の空白 | 吸収する |
| 名前中の連続空白（`DJ  Nobu`） | 吸収する |
| 全角空白（`DJ　Nobu`） | 吸収する（`\s` が全角空白にマッチ） |
| **全角英字**（`ＤＪ Ｎｏｂｕ`） | **吸収しない**（NFKC 正規化が無い） |
| **記号**（`.` `-` `&` `☆`） | **吸収しない**。`Dj Maria.` と `Dj Maria` は別物 |

**SET_TYPE が `b2b` / `live` の行は照合を試みない。**
`/-live-/i` または `/\bb2b\b/i` に一致すると、メンバー分解せず
そのまま `ACT_LABEL` になる（複数人を1枠で表すための設計）。
`-live-` はハイフンで囲む表記が必要で、`LIVE ACT` は `dj` 判定になる。

#### 照合失敗時の挙動

`<a>` ではなく **`<span>` になり、アーティスト詳細へのリンクが張られない**
（`build-detail-pages.mjs:554`）。ビルドは止まらず、警告のみ。

```
LINEUPS {editionId}: 未解決アクト "{名前}"（ARTISTS.NAME に無し）
```

逆に `ARTIST_ID` が付いているのに ARTISTS に無い場合は `throw` する。
**片方向だけ厳格**で、名前照合の失敗は静かに通る。

#### 現状（2026-08-02）

| 区分 | 件数 |
|---|---|
| `ARTIST_ID` あり（リンクされる） | 75 |
| `ACT_LABEL` のみ（リンクなし） | **55（42%）** |

`ACT_LABEL` のみ55件のうち51件が `SET_TYPE=dj`、つまり名前照合の失敗。
残り4件は b2b / live で設計どおり。

51件の内訳:

- **ARTISTS に未登録: 46名**（`upsammy` `Kohra` `Paquita Gordon` `Antal & Hunee` ほか）
- 記号・表記の違いだけ: 5件（`M.I.O`/`Mio`、`CAPTAIN-K`/`Captain K` 等）

**主因は照合ロジックではなくアーティストの未登録。**
リストは `data/inbox/export/unregistered-artists.csv`。

#### 正規化強化は採用しない

記号を落とす照合にすると `M.I.O` と `Mio` のように**別名義かもしれないものを
機械的に同一視**する危険がある。改善するのは5件だけで、割に合わない。
候補提示にとどめる方針（`audit-lineups-migration.mjs` の
`NAME_MATCH_CANDIDATE` が既にその形）。

#### 副次的に判明: ARTISTS.NAME が機械的に Title Case 化されている

照合には影響しない（`toLowerCase` するため）が、**表示が公式表記と食い違う。**
LINEUP の元表記と比べて大文字小文字だけ違うものが **30/100件**。

| ARTISTS.NAME | 本来の表記 |
|---|---|
| `Tko` | `TKO` |
| `Haai` | `HAAi` |
| `Ben Ufo` | `Ben UFO` |
| `Dj Miku` / `Dj Kensei` / `Dj Yogurt` | `DJ MIKU` / `DJ KENSEI` / `DJ Yogurt` |
| `AdhéMar` | `Adhémar` |
| `The Master Musicians Of Joujouka` | `... of Joujouka` |
| `Kuo From Sunset Rollercoaster` | `... from Sunset Rollercoaster` |

前置詞まで大文字化されている点から、**どこかで一律の Title Case 変換が
かかった**と考えられる。スタイルガイドは「大文字小文字も公式に準拠する」と
定めており（`docs/writing/Japanese_Writing_Guidelines.md`）、現状は違反している。

**文字が落ちているのは1件のみ**: `suze-ij`（`Suze Ijó` の `ó` が ID と NAME の
両方から脱落）。今日 slugify で「春風」が消えた件（§9-19 の同型）と同じ、
**非 ASCII が黙って落ちる**パターン。

### 9-26. Reveal の重複実装と詳細ページへの未適用

2026-08-03 時点で、スクロール時の Reveal は4ハブに個別実装され、同時に
`common.js` の共通 `IntersectionObserver` も読み込まれている。各ハブでは同じ
`.reveal` 要素を複数の Observer が監視する重複状態になっている。

- Festivals: 移動距離16px、0.7秒
- Venues: 移動距離30px、0.8秒
- News: 移動距離20px、0.6秒
- Artists: 独自の距離・速度設定
- 生成詳細ページ461枚: `.reveal` 要素0件（`common.js` は対象なしで終了）

後日の共通化では、次の順序で進める。

1. `common.css` に標準Revealを定義する
2. 距離・速度をCSS変数でページごとに調整可能にする
3. `common.js` のObserverを単一インスタンス化する
4. 動的描画後に使える `tjObserveReveals(root)` を提供する
5. 4ハブの独自Observerを削除する
6. 詳細ページの対象セクションへ `.reveal` を付与する
7. `prefers-reduced-motion` ではアニメーションなしで即時表示する
8. 実ブラウザ回帰検査を追加する

ヒーローは初期表示を維持し、フライヤー／LINE UP、開催ヒストリー、FAQ、SHARE、
RELATED FESTIVALS など下層セクションをReveal対象とする案が妥当。動的描画を持つ
ハブの再監視が関係するため、カーソル対応とは分離して実装する。

### 9-27. fetch-data.mjs が draft のアーティストまで LINEUP 照合していた

「掲載したいアーティストのみ登録し、それ以外は draft にする」方針を決めた直後、
**その方針を使うとビルドが落ちる**ことが判明した。

#### 発見の経緯

未登録アーティスト13名を登録する際、CSV を `STATUS=draft` で出力した。
既存111件は109件が空欄・2件が published で draft は1件も無く、
「新規は draft 既定」という別の方針を機械的に適用したのが誤りだった。

その状態で `fetch-data.mjs` → `build-detail-pages.mjs` を回すと落ちた。

```
Error: lineups.json: ARTIST_ID 参照切れ "kohra"（ほか12件）
```

#### 構造

```
fetch-data.mjs   raw.ARTISTS（draft 含む）で LINEUP を照合
                 → lineups.json に draft の ARTIST_ID が入る
LP/data.js       Publish Now が draft を除外
                 → 13名が存在しない
build-detail-pages.mjs
                 → ARTIST_ID 参照切れで throw
```

**2つのデータ源が draft の扱いで食い違っていた。**
`fetch-data.mjs` は照合に `raw.ARTISTS` を使い、公開判定を通していなかった。

#### なぜ方針の障害になるか

ARTISTS 111件のうち、LINEUP から参照されているのは93件。
**参照ありのアーティストを draft にした瞬間にビルドが落ちる。**
参照なし18件なら問題ないが、それ以外は draft にできない。
「削除ではなく draft にする」という安全な選択肢が、実質使えない状態だった。

#### 対応

照合マップの構築を `raw.ARTISTS` から `artists`（`isPublished` 通過分）に変更した。

```js
// 変更前
for (const a of raw.ARTISTS) { … }
// 変更後
for (const a of artists) { … }
```

draft のアクトは照合に当たらず `ACT_LABEL` に落ちる。生成物では `<span>` で
リンクなし表示になり、名前は残る。これが方針として正しい挙動。

`raw.*` の参照は他に4箇所あるが、EVENTS の孤児参照チェック（警告のみ）と
各シートのループ（内部で `isPublished` 判定済み）で、生成物に影響しない。
**問題があったのは照合マップの1箇所だけ。**

#### 記録: STATUS 空欄が公開扱いという分かりにくさ

`fetch-data.mjs:35` の `PUBLISH_EMPTY_STATUS = true` により、
**STATUS 空欄は公開扱い**になる。現状 ARTISTS 124件のうち122件が空欄で、
明示的に `published` と入っているのは2件だけ。

つまり「STATUS を見ても公開されているか分からない」状態で、
今回の draft 混入もこの分かりにくさが遠因だった。
スキーマ本来は `published` の明示を要求しており、
`fetch-data.mjs:17-18` のコメントにも「一括入力し終えたら false にする」とある。

**未対応。**空欄122件に `published` を入れて `PUBLISH_EMPTY_STATUS=false` に
切り替えるのが本来の姿だが、影響範囲が広いので別途進める。

### 9-28. 【訂正】draft にすると詳細ページは削除され 404 になる

「削除ではなく draft にする」方針を設計した際、**事実誤認があった。**

#### 誤って記録していたこと

> `build-detail-pages.mjs` は不要になったファイルを削除しません。
> `draft` にしても `LP/artists/tonbo.html` は残り続けます。

**これは誤り。**削除処理は既に実装されている。

```js
// build-detail-pages.mjs:1116
// データから消えたページは削除する（同期が作った重複コピーもここで掃除される）
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.html')) continue;
  if (!wanted.has(f)) { fs.unlinkSync(path.join(dir, f)); removed++; }
}
```

実装を確認せずに述べた。段階1（`tonbo` 1件を draft）を実行したところ、
CI の再生成コミット `a8528e6` が JA/EN 2ファイルを削除した
（`2 files changed, 248 deletions`）。

#### 設計への影響

| 段階 | 当初の想定 | 実際 |
|---|---|---|
| draft 化 | ページは残る。404 にならない | **ページが削除され 404 になる** |
| 段階4（ファイル削除） | ここで初めて 404 | **不要。draft 化で自動的に消える** |

**「様子を見ながら段階的に進める」の安全性は当初想定より低い。**
draft にした時点で 404 が発生する。`published` に戻せばページも復活するので
取り消しは可能だが、その間は 404 のままになる。

18件（JA/EN 計36ページ）を一度に draft 化すると、36ページが同時に 404 になる。
小分けにするか、リダイレクト設計を先に決めるかの判断が要る。

#### 段階1の検証結果（`tonbo`）

| 項目 | 結果 |
|---|---|
| `data.js` から消える | ✅ 124 → 123件 |
| 詳細ページの生成 | ✅ 対象外になる |
| sitemap から消える | ✅ 2件 → 0件 |
| `artists.html` の静的リンク | ✅ 自動で消える（`writeHubLinks`） |
| 回帰ガード | ✅ 落ちない |
| `lineup_linked_acts` | ✅ 115 のまま（参照なしのため） |
| **詳細ページファイル** | **❌ 削除される（想定は「残る」）** |

6項目は想定どおりで、**1項目だけが誤っていた。**

#### 教訓

「実装されていない」と述べるときは、**実装が無いことを確認する必要がある。**
今回は `grep unlinkSync` の一行で分かることを、確認せずに断定した。
§9-20（クローラーに届くかとユーザーに届くかは別）と同じ構図で、
**確かめていないことを確かめたことのように書いた。**

### 9-29. 【申し送り】ARTISTS の draft 化と Title Case 修正の前提

2026-08-03 深夜時点の状態。翌日以降に続ける際の前提をまとめる。

#### draft 化の運用（段階1で判明したこと）

| 事項 | 内容 |
|---|---|
| **生成物のコミットが伴う** | `LP/data/*.json`（6件）と `artists.html` の静的リンク。これを忘れると CI の「生成物がコミット内容と一致しません」でデプロイが止まる（実際に1回止めた） |
| **まとめて行うと差分が大きい** | 18件なら詳細ページ36件の削除 + `artists.json` + 静的リンク18行。小分けを推奨 |
| **内部リンクからの 404 流入は発生しない** | sitemap と `artists.html` の静的リンクは `build-detail-pages.mjs` が自動で消す。外部直リンクと検索結果からの流入のみが 404 に当たる |
| **404 は自前ページ** | `LP/404.html` が返る（`<title>404 — TECHNO JAPAN`）。GitHub 既定の素の 404 ではなく、ナビとフッターを備えたページなので訪問者を誘導できる |
| **取り消し可能** | `published` に戻せばページ・sitemap・静的リンクすべて復活する |

残りは17件（18件から `suze-ij` を除く。照合が復活したため対象外）。

#### Title Case 修正の進捗

反映済み: A の10件 + `TKO` = **11件**。照合は全件維持される
（変更が大文字小文字のみで `normName` の `toLowerCase()` により正規化結果が不変。14パターンで検証）。

未調査: **19件**。内訳は `arch` 11件 / `ala` 5件 / その他3件。

#### arch のフライヤーから読み取れたこと（重要）

`LP/images/festivals/arch-flyer.webp` を確認したところ、
**フライヤーの表記自体が全部大文字だった。**

```
AKIHIRO SUZUKI / ENDORPHIN / KEVIN MIYAGI / PSYCHOGEM aka DJHIROAKI
SHO / TAKEHIRO IMAIZUMI / TAZZY / TKO / TMAK / YEARK / YURIPON
CHOKO / CAPTAIN-K / TAKAAKI ITOH
```

つまり **LINEUP の全部大文字表記はフライヤーを書き写したもの**であり、
アーティストの公式表記とは限らない。`arch` 由来11件は
**フライヤーを根拠にできない。**個別に公式（SNS・レーベル）を当たる必要がある。

一方で、フライヤーから**新しい事実**も得られた。

- `PSYCHOGEM` は **`PSYCHOGEM aka DJHIROAKI`** が正式（別名義あり）
- `TAKAAKI ITOH`（GUEST DJ）と **`198`** が LINEUP に入っていない可能性
- `青 (COSθ)` の所属表記あり。`ao` の登録名 `青` と一致
- 会場は「小平の里キャンプ場（群馬県みどり市大間々町小平甲495）」

`ala` `transcendence` `rainbow-disco-club` のフライヤーも実体があるので、
同様に確認できる。`waifu` は FLYER 未登録。

### 9-30. 分割コミットでキャッシュバスティング検査をすり抜ける

2026-08-03 の本番総点検で、`data.js` が更新されている一方、参照元14ページの
クエリが `?v=7` のままになっていることを確認した。

原因は、Publishによる `data.js` 更新と生成物更新を別コミットに分けたこと。
`check_asset_versions.py` は通常、直前コミットとの差だけを見るため、次の流れでは
どちらの検査からも変更の組み合わせが見えない。

1. Publish commitで `data.js` だけが変わる
2. 後続の生成物commitでHTML等を更新する
3. 後続commitの検査では `data.js` は変更対象に入らない
4. 結果として、参照クエリを上げていなくても検査を通過する

実際に変更全体を含む基点から検査すると、次のエラーを再現した。

```text
data.js を変更したが ?v が据え置き。参照元（LP/map.html 等 14箇所）の ?v を上げること
```

今回はService Workerの分岐順を同日に修正し、`data.js` を
`stale-while-revalidate` で処理していたため、実害は「最初の表示で旧データを返し、
バックグラウンド更新後の再遷移・再読込で新しくなる」に限定された。実測でも、
既存Chromeプロファイルでは旧124件、キャッシュ回避取得では最新123件が返った。

もし `data.js` がJS/CSS一般の `cache-first` 分岐に吸われたままだった場合、同じURLの
キャッシュが残り続け、新データが既存ブラウザへ永久に届かない事故になっていた。
今日 `sw.js` の分岐順を修正していたことが救いになった事例である。

#### 翌日の対応

- `data.js?v=7` を `v=8` に上げ、参照元14ページを更新する
- Publish commitと生成物commitが分かれても検出できるよう、キャッシュ検査の比較範囲を改善する
- sitemapに含まれるリダイレクトスタブ7件を整理する（別セッションで発見）

「変更を分けてコミットする」こと自体はレビュー性を高めるが、検査がコミット単体だけを
比較している場合は、相互に必要な変更を分断して検査の穴を作る。生成物差分だけでなく、
デプロイ対象となる一連の変更範囲を通した検査が必要。

### 9-31. PSYCHOGEM の正式表記と別名義（aka）の未設計

Title Case で壊れた `ARTISTS.NAME` の公式表記調査により、`psychogem` の正式表記は
**`PSYCHOGEM aka DJ HIROAKI`** と確認できた。レーベル／リリース情報と複数の出演告知で
この表記が一致している。

ただし、現在の FESTIVALS.LINEUP は `PSYCHOGEM` である。ARTISTS.NAME だけを完全表記へ
変更すると、`fetch-data.mjs` の `normName()` は大文字小文字と空白しか正規化しないため、
`PSYCHOGEM` と `PSYCHOGEM aka DJ HIROAKI` は一致しない。結果として ARTIST_ID の照合が
切れ、アーティスト詳細へのリンクが `<span>` に落ちる。

このため今回のNAME修正では **PSYCHOGEMを見送る**。別名義（aka）を表現するデータ設計は
未定であり、単発でLINEUPかNAMEの一方だけを直すと不整合を残す。同種のケースは
`Masa aka Kyounote` など他にもありうるため、個別例外ではなく次をまとめて設計する必要がある。

- 正式な表示名と照合用別名を別フィールドにするか
- LINEUP側に入力された短縮名／旧名／別名義をどこで正規化するか
- `aka` を表示名の一部として扱うか、別名義メタデータとして構造化するか
- 1人が複数名義を持つ場合のURL・詳細ページ・LINEUPリンクをどう統合するか

**別名義の設計が決まるまで、`PSYCHOGEM` は現状維持する。**

### 9-31. EN ハブの言語分岐 — 「コードは存在するが実行されない」の3例目を事前に回避した

EN ハブ5枚は `enHubFromJa` が JA から機械生成しているが、**データ描画時の
言語分岐が無く、中身が日本語のまま**だった。実測で EN Festivals の
描画後コンテナに日本語が 11,196 字。

#### 前提の訂正2件

着手前の想定と実データが違った。**どちらも実測で先に潰せた。**

| 想定 | 実際 |
|---|---|
| `name_en` が入っているのに使われていない | `name_en` は **全セクション0件**。`data.js` に1つも無い |
| 日本語10,306字の出どころは不明 | **99% が `f.desc`**（13,589字中、描画分11,097） |

`build-detail-pages.mjs` は `f.name_en \|\| f.name` を30箇所以上で書いているが、
**全て `f.name` にフォールバックしている。**詳細ページの EN 版も見出しは日本語。
`name_en` は「フェス・アーティスト・会場名はほぼ英字表記が実態」という理由で
**入力しない方針**に決まった（2026-08-03）。日本語名の5件だけ後日検討する。

一方 `desc_en` はフェス89/89・会場22/22 で完備しており、`desc` と同一のものは0件。
**データは揃っていて、描画側の分岐だけが無かった。**

#### 方式の選択: トランスフォーム置換ではなく実行時分岐

`enHubFromJa` は全工程が正規表現置換なので、そこに `f.desc` → `f.desc_en` を
足す案があった。**採らなかった。**`f.desc_en` が `f.desc_en_en` になり、
`festival-desc-jp` というクラス名にも当たる。§9-16 で1日に2回踏んで152行を
誤削除した「HTML/コードを正規表現で読むな」と同じ罠で、しかも境界が無いぶん危険。

代わりに `<html lang>` を実行時に見る。**JA/EN のハブ JS が完全に同一に保たれる**ので、
「JA だけ直して EN を再生成し忘れる」（§9-21 で実際に起きた）が構造的に起きない。
JA と EN の行数比較もそのまま使える（5枚とも一致を確認）。

この流儀は新設ではなく、既に2箇所で使われていた
（`venues.html` の地図フォールバック、`news.html` の `articleDetailHref`）。

#### `common.js` に置こうとして撤回した — defer で実行順が逆になる

当初「共有関数なので `common.js` へ」と設計し、**そう決定した後に `defer` に気づいた。**

```
<script src="common.js?v=3" defer></script>   ← パース完了後に実行
<script src="data.js?v=9"></script>            ← パース中に実行
<script>  renderFestivals();  </script>        ← パース中に実行（ここで呼ぶ）
```

`defer` はファイル全体の実行を遅らせるので、**描画時点では未定義**になる。
最小再現を headless Chrome で作って確認した。

```
inline 実行時:        UNDEFINED
DOMContentLoaded 時:  defined
```

置いていたら全カードがフォールバック側に落ち、**§9-18（分岐が到達不能）・
§9-20（クローラーには届くがユーザーには届かない）と同型の「書いたのに効かない」
3例目**になっていた。今回は事前に実測して回避できた。

`data.js` と `image-dimensions.js` だけが `defer` 無しなのは、まさに描画経路の
硬い依存だから。**同じ性質のものは同じ扱いにする。**新規に `LP/localize.js`
（非 defer）を作り、5ハブの `data.js` 直前に置いた。

`localizedValue` 相当が `build-detail-pages.mjs`（ビルド時・Node）と
`LP/localize.js`（実行時・ブラウザ）の2箇所になる。実行環境が違うので1本に
寄せていない。**片方だけ直さないよう AGENTS.md に明記した。**

#### 実測（描画後・データ描画コンテナに限定）

| ハブ | JA | EN | |
|---|---|---|---|
| festivals | 11,196 | **35** | −99.7% |
| artists | 1 | 1 | `name_en` 未入力（方針どおり） |
| venues | 0 | 0 | |
| news | 35 | 27 | `title_en` 未入力 |
| index | 39 | 39 | 同上 |

**JA 側は 11,196 のまま不変**（EN 化で JA を痩せさせていない）。

EN festivals に残る35字の全内訳:

- 21字 = 日本語名のフェス5件（`SPRING LOVE 春風` / `円相芸術音楽祭` / `森、道、市場` /
  `CAPSULE-山中湖花火音楽祭` / `ensou`）。`name_en` 未入力の方針どおり
- 14字 = `rainbow-disco-club` の `LOCATION` が空で `LOCATION_JA`
  「東伊豆クロスカントリーコース」へフォールバック。**データ側の欠け**

#### 計測を2回間違えた — スコープの既定値に注意

1回目の計測で「news 94字 / index 112字」と報告したが**誤り**だった。
**`news.html` と `index.html` には `<main>` 要素が無く**、スクリプトが
無言で `<body>` 全体にフォールバックしてナビ・フッターまで数えていた。

```python
m = re.search(r'<main[^>]*>(.*?)</main>', body, re.S)
inner = m.group(1) if m else body     # ← この既定値が誤報の原因
```

**「見つからなければ全体」は計測では危険な既定値。**見つからなかったことを
黙って別の意味にすり替える。データ描画コンテナの id を明示して測り直した。

§9-20 で「並列実行で失敗した個体が全項目0になり、SPA に何も無いという誤った
結論に直結した」のと同じ形で、**計測スクリプトの失敗が静かに数値へ化ける。**

#### 【課題・未対応】ハブ2枚に `<main>` が無い

`news.html` と `index.html` は `<main>` を持たない（festivals / artists /
venues は持つ）。セマンティクスとアクセシビリティの欠けで、監査 §4 の範囲。
**別タスクとして扱う。**上記のとおり計測スクリプトの誤りも誘発した。

#### 回帰ガード3件を追加

| メトリクス | 値 | 判定 |
|---|---|---|
| `en_hub_jsonld_ja_chars` | 126 → **0** | `max: 0` |
| `en_hub_static_links_ja_chars` | 216 | `max: 216`（0 は達成不能） |
| `en_hub_leaks_to_ja` | 0 | 既存。note に守備範囲を追記 |

**`en_hub_leaks_to_ja` は名前が示すより守備範囲が狭かった。**見ているのは
リンク先の URL だけで、文言の言語は見ていない。このメトリクスが緑のまま
EN ハブに日本語が11,000字あった。**名前から守備範囲を推測させないよう
note に明記した。**

`en_hub_jsonld_ja_chars` は `alternateName` を除外する。`en/index.html` の
`"alternateName": "テクノジャパン"` は英語ページでも**正しい**構造化データで、
これを含めて0を目指すと正しい値を消す方向に圧力がかかる。
**「日本語が残っている＝誤り」ではない。キーによって正しさが違う。**

`en_hub_static_links_ja_chars` は 0 にできない。`森、道、市場` のように
フェス名そのものが日本語で、`name_en` を入力しない方針だから。
**目標を 0 に置かず「増やさない」に置いた。**

`EN_HUB_DESC` は meta 3種にしか適用されておらず、JSON-LD の `description` が
素通りしていた（EN ハブ4枚が日本語併記）。`replaceCollectionPageDesc()` を追加。
置換対象は `CollectionPage.description` だけで、`index.html` の
`WebSite.description` は「サイト全体の説明」なので触らない。
置換は `JSON.parse` で値を特定してから文字列リテラルだけを差し替える方式で、
整形も行数も変えない（§9-16 に従い生ブロックを正規表現で書き換えない）。
特定できない場合は**黙って素通りさせず throw する** — 素通りは
「置換したつもりで JA が残る」という、まさに今回直した事故そのものになるため。

#### ホバー限定 UI は検査しない判断

`venues.html` の hover preview（`#vp-desc`、`v.desc` 2,771字）は
`(hover: none)` と `max-width: 1100px` で早期 return するため、headless では
描画されない。**検査コストが高くモバイルでは表示もされないので、
回帰ガードの対象外とし目視確認に留めた**（2026-08-03 判断）。
コード自体は `tjLocalized` を通してある。

### 9-32. 記録があっても参照されなければ、同じ判断が繰り返される

EN ハブの言語分岐（§9-31）を進める過程で、**既に文書に書かれていた前提を
読まずに同じ誤りを繰り返す**パターンが1日に3回出た。個別の不具合ではなく、
「記録の届き方」の問題として3件まとめて残す。

#### (1) `?v` 強制と Service Worker の前提が正面から矛盾していた

8/2 の §9-30 で `check_asset_versions.py` に
`TRACK_ACROSS_PUSHES = {"data.js"}` を入れ、Publish と生成物のコミットが
分かれても `data.js` の `?v` 据え置きを検出できるようにした。

**が、その日のうちに3回、Publish のたびにこの検査が落ちた。**
運用が甘いからではない。`data.js` は CMS の Publish Now が単独で自動 commit
するため、**`?v` の更新は構造的に必ず後追いになる。**CMS の設計に内在する
順序制約で、気をつけても消えない。

そして、その理由は**既に2箇所に書かれていた。**

```js
// LP/sw.js
// data.js は CMS の Publish Now が直接 commit するため、他の JS のように
// 「変更したら参照元 HTML の ?v を上げる」運用が効かない。?v=7 は固定のまま
// 中身だけが変わるので、キャッシュキーで鮮度を管理できない。
if (url.pathname.endsWith('/data.js')) { staleWhileRevalidate(request); return; }
```

```js
// scripts/check_sw_routing.mjs
{ path: '/data.js', why: 'Publish Now が commit するので ?v が上がらない' },
```

§9-18 に至っては **「data.js は常に変更されるので毎回引っかかってしまい、
そもそも運用に乗らない」** と明示していた。

つまり2つのガードが `data.js` について正反対を要求していた。

| | 要求 |
|---|---|
| `sw.js` / `check_sw_routing.mjs` | `?v` が維持できないから stale-while-revalidate にした |
| `check_asset_versions.py`（§9-30） | `?v` を必ず維持せよ |

**対応（案A）**: `TRACK_ACROSS_PUSHES` を空にした。

`?v` を外す判断の根拠は「保険が別にある」こと。cache-first に吸われる事故
（§9-18 の実害）は `check_sw_routing.mjs` の `MUST_NOT_BE_CACHE_FIRST` が
**sw.js を実際に実行して**守っている。`?v` は二重の保険で、しかも維持できない
ほうだった。代償は Publish 直後の初回表示だけが古いこと（SWR なので次の遷移で
新しくなる）。3往復のコストと天秤にかけて外す判断をした。

**再発防止**: `check_asset_versions.py` と `sw.js` に**相互参照**を書いた。
どちらから読んでも、もう片方の前提に辿り着く。§9-18 に書いてあっても
`check_asset_versions.py` を編集する人には届かなかったので、
**決定の記録は、その決定を覆しうるコードの隣に置く。**

#### (2) 設計ドキュメントの「目標」を実装済みの仕様として読んだ

`editions.json` の LOCATION 逆転を報告する際、「シートの EDITIONS タブの
LOCATION / LOCATION_JA を直してください」と指示した。**EDITIONS タブは
存在しない。**

実在するタブは VENUES / FESTIVALS / ARTISTS / EVENTS / ARTICLES の5つだけで、
`editions.json` は `fetch-data.mjs` が **FESTIVALS の各行から導出**している
（`LOCATION` は E列、`LOCATION_JA` は AD列の写し）。だから逆転は1箇所にしか
無かった。

根拠にしたのは DATA_SCHEMA §2.3 の表だが、あれは **「EDITIONS(開催回・**目標**)
— **新設**シート」** の節だった。

**`backups/latest.json` のトップレベルキーを1回見れば済んだ。**
設計文書ではなく実データを見る。

#### (3) 警告は書かれていたが、読む導線に無かった

さらに悪いことに、§2.3 には**まさにこの誤りを禁じる警告があった。**

> 目標の列を、未移行の実シートに存在するものとして扱わない。

**読んでいない。**`grep LOCATION` で241行目の表に直接飛び、節の前置き（166行目）を
読まなかったからである。

これは §9-20（クローラーに届く ≠ ユーザーに届く）と同型で、
**「文書の冒頭に書いてある ≠ 読む人に届く」。**
文書は先頭から読まれるとは限らない。`grep` で飛び込む読者には前置きは存在しない。

**対応**: 警告を**各表の直前**に再掲した。節見出しにも
【実装済み】/【設計案・未実装】を付け、EDITIONS の表の直前には導出元の
対応表（どの列の写しか、直すなら FESTIVALS）を置いた。

**教訓**: 注意書きは「節の先頭」ではなく**間違えられる場所の隣**に置く。
(1) の相互参照と同じ構図である。

#### 同日に見つかった、記録が効いた例（対比）

逆に、記録が正しく効いた例もある。ハブに `tjLocalized` を置く先を
`common.js` にしようとして、`defer` で実行順が逆になることに気づけたのは、
§9-18 と §9-20 が「コードは存在するが実行されない」パターンを繰り返し
記録していたからだった（詳細は §9-31）。**実測して確かめる習慣が働いた。**

記録が効くかどうかは、内容の正しさではなく**読む導線があるか**で決まる。

#### 付随して直したもの

- `check_sw_routing.mjs` の参照 `?v` が実態と乖離していた（`data.js?v=7` /
  `common.js?v=2` / `image-dimensions.js?v=2`）。ルーティングは `pathname` で
  分岐するので**判定には影響しない**が、読む人を誤解させる。実値に合わせ、
  「値は判定に影響しない」と明記した。`localize.js` も検査対象に追加
- `cms.js` を変更して `cms.html` の `?v` が据え置きだった（§9-11 と同型）。
  `v=34 → v=35`

### 9-33. 【課題・未対応】LINEUP が表示名で照合している

`FESTIVALS.LINEUP` はカンマ区切りの**アーティスト名の文字列**で、
`fetch-data.mjs` がそれを `ARTISTS.NAME` と突き合わせて `ARTIST_ID` を解決する。

```js
const normName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
```

**DATA_SCHEMA §0 の原則2「表示名での紐づけは禁止」に正面から反する残存経路。**
`LINEUPS` 側は `ARTIST_ID` を持っているので、問題は FESTIVALS.LINEUP だけにある。

#### 2026-08-03 に実際に切れた

Title Case 修正10件のうち、9件は大文字・小文字の変更だけだったので
`toLowerCase()` が吸収して無傷だった。**1件だけが語の増える改名**で、そこが切れた。

```
ARTISTS.NAME   Yuripon → DJ YURIPON      （"DJ " が増えた）
FESTIVALS.arch LINEUP  "YURIPON"          （据え置き）
→ normName の比較で不一致。ARTIST_ID 未解決に落ち lineup_linked_acts 115 → 114
```

`normName` は小文字化と空白正規化しかしないので、**接頭辞・記号・表記の揺れは
そのままリンク切れになる。**アーティストは公開のままで詳細ページも存在するのに、
一覧からの導線だけが静かに消える。

今回は `lineup_linked_acts`（min 115）が検出して止めた。§9-25 で
「守りたいのは、いま張れているリンクが壊れて減らないこと」と定義したのが効いた。
**閾値を下げて隠さず、データ側（LINEUP 文字列）を直して 115 に戻した。**

#### なぜ今すぐ直さないか

恒久策は FESTIVALS.LINEUP を ID 参照にすることだが、
これは §9-22（ステージ別・日別を表現できない）と同じ
「LINEUP スキーマの作り直し」に含まれる。個別に手を入れると二重作業になる。

**それまでは、アーティストを改名するたびに LINEUP 文字列も追従させる必要がある。**
改名時は `lineup_linked_acts` の増減を必ず確認すること。

### 9-34. 【課題・未対応】ARTISTS「参照1件・情報なし」74件の扱い

§9-29 の申し送りの続き。2026-08-03 に参照ゼロの14件を draft 化して
123 → 109 件になったが、**「LINEUP から1件だけ参照され、BIO も画像も無い」層が
74件残っている。**

`yuripon` もこの層に近い（`arch` 1件のみの参照、`bio` 空）。今回そのために
詳細ページが1枚生成され、リンクが切れ、閾値が動いた。

判断すべきこと:

- 1件参照・情報なしのアーティストに詳細ページを持たせるか
- 持たせないなら LINEUP からはどう見せるか（`ACT_LABEL` のままにする）
- `bio` が4/123件しか無い現状で、そもそも詳細ページが読者に何を提供するか

**個別に判断せず、74件をまとめて方針決めする。**
`lineup_linked_acts` の閾値は方針が決まった時点で実測値へ調整する。

### 9-35. EN ハブの画像が全滅していた — 経路を数え直す(2回目)

2026-08-03、EN ハブの画像がすべて表示されていないという報告。
米国からの流入が増えている時期で、緊急対応になった。

#### 原因

`data.js` の画像パスは**相対**（`images/festivals/x.webp`）で、`/en/` 配下の
ページから参照すると `/en/images/...` に解決されて 404 になる。

```
src属性の生値   images/festivals/hacha-mecha.webp
解決後URL       https://techno-japan.media/en/images/festivals/hacha-mecha.webp → 404
naturalWidth    0（11枚すべて）
```

`onerror="this.style.display='none'"` があるため、**壊れアイコンではなく
「何も出ない」**に見える。異常が異常らしく見えなかった。

**EN ハブが新設された `bcef2ea` の時点から壊れていた。** `enHubFromJa` は
`<script>` / `<link>` の相対パスをルート相対へ正規化するが、`data.js` 由来の
画像パスは実行時に埋まるので対象外だった。EN 詳細ページは
`build-detail-pages.mjs` が `/images/...` と絶対で出すため正常だった。

当初「同日に入れた言語分岐（§9-31）が原因では」と疑われたが、
当該コミットの差分は `alt="${f.name}"` → `alt="${name}"` のみで
`src="${f.image}"` は1バイトも変わっていない。**revert しても直らない**ことを
先に確認してから前進修正に進んだ。

#### 経路は10あった。`<img src>` だけ直すと5件残る

| 方式 | 件数 | 場所 |
|---|---|---|
| `<img src="…">` | 4 | festivals 1 / news 2 / index 1 |
| `background-image:url(…)` | **5** | artists 1 / index 4 |
| `img.src = …` | 1 | venues 1 |

最初の修正は `<img src>` 系と index の1件（計6）に `tjAssetPath()` を通したが、
**index.html の `background-image` 4件が残った。**本番の `/en/index.html` で
実測すると `.fest-row-bg` / `.fest-row-thumb` / `.artist-mini-img` /
`.venue-mini-img` の**32枚**が `/en/images/...` を指したままだった。

**§9-17（`webp()` の適用漏れ）とまったく同じ構図。**あのときも「列を数える
だけでは足りない、値が DOM に届く経路（sink）を数える」と書いた。
**同じ教訓を、同じ月に、同じ形で踏んだ。**

今回の追加要因は**方式が3種類あったこと**。`grep '<img'` だけでは
`background-image` も `img.src =` も見つからない。
**`src` という語で探すのではなく、「画像の値がどこへ渡るか」で探す。**

#### なぜ既存のガードが1つも止められなかったか

| ガード | 見ているもの | なぜ素通りしたか |
|---|---|---|
| `broken_image_refs` | 生成物 HTML の `/images/` 参照 | 画像パスは `data.js` から JS が実行時に埋めるので、静的HTMLに現れない |
| `check_hub_pages.py` | 要素数・コンテナサイズ・例外・日本語 | 画像の読み込み成否を見ていない。カードは正常に描画されるので全項目パスする |

**「ページは正しく描画されている」と「ページが正しく見えている」は別の問い。**
§9-20（クローラーに届く ≠ ユーザーに届く）の同型で、今回は
「DOM に出ている ≠ 画像が表示されている」だった。

#### 追加したガード: 描画後の画像取得可否（許容 0件）

`check_hub_pages.py` に `__image-test.html` を追加した。JA/EN 全ハブを
iframe で順に開き、描画後に参照される画像URLを集めて `fetch` で取得を試す。

**`naturalWidth === 0` を見る案を採らなかった理由**が2つある。

1. **`background-image` は `naturalWidth` を持たない。**壊れた10経路のうち
   5がそれで、しかも最初の修正で取りこぼしたのがちょうどその5件だった。
   `naturalWidth` 方式だと **index.html の事故を丸ごと見逃していた**
2. `loading="lazy"` の画像は headless で未読込のまま `naturalWidth === 0` に
   なり、**誤検出**する

URL の取得可否を直接見れば、方式に依存せず誤検出も無い。
検証として、`background-image` の修正だけを巻き戻した複製に対して実行し、
**14件を検出**することを確認した（`<img src>` は直したままなので、
`naturalWidth` 方式なら0件だった状況）。

検査が完了しなかった場合（`pending` / `missing`）も fail にする。
**「終わらなかった」を「異常なし」と読み替えない。**§9-32 で
「見つからなければ全体」という既定値が誤報を生んだのと同じ注意。

#### 自分の見落としについて

**この 404 を、同日の計測中に実際に目にしていた。**日本語文字数を測るために
ローカルサーバでハブを描画したとき、ログに
`"GET /en/images/festivals/hacha-mecha.webp" 404` が大量に出ていた。
日本語の文字数だけを見ていて拾わなかった。

**目的の指標を測っているときほど、視界の外の異常は素通りする。**
ログに出ている 404 は、測っている対象と無関係でも異常である。

#### 付随: detail.css の v=3/4 は意図的な分割（揃えてはいけない）

調査中、`check_asset_versions.py` が `detail.css: v=3/4` を警告していたのを
「既存の警告」として流していたので、内容を確認した。**誤検知だった。**

`1932e50` の detail.css 変更259行は**すべて `.festival-design-v2` 配下の
純粋な追加**で、既存ルールの変更・削除は 0行（実測）。だから
フェス詳細178ページだけ `v=4` に上げ、新ルールを使わない264ページは
`v=3` に据え置いてある。**揃えると264ページ分の CSS キャッシュを
内容変更ゼロのまま捨てる。**

警告文に「意図的な分割かを確認すること」を足し、判断材料
（その版で増えた規則を据え置き側が使うか）を
`check_asset_versions.py` の該当箇所にコメントで残した。
§9-32 と同じく、**判断の記録は、その判断を覆しうるコードの隣に置く。**

### 9-36. 「対象リスト」を空にして、検査そのものを無効化した

EN ハブ画像の修正（§9-35）を本番で確認したところ、**修正が効いていなかった。**

```
HTML の tjAssetPath          5箇所        ← 配信されている
window.tjAssetPath           undefined    ← 定義されていない
オリジンの localize.js       2049B  tjAssetPath あり
SW 経由の /localize.js?v=1   1764B  tjAssetPath なし   ← 旧版が返る
キャッシュ                   tj-static-v1.13.0
```

`localize.js` に `tjAssetPath` を足したのに **`?v=1` を据え置いたまま push した。**
`sw.js` は `.js` を cache-first で扱うので、一度でも訪問したブラウザには
旧版が永久に返る。新しい HTML が古い JS を呼び、`tjAssetPath` が undefined。

**§9-11（`cms.js` が `?v=25` のまま26回変更され、7/13以降の改修が届いていなかった）と
まったく同型。**あのとき作った `check_asset_versions.py` が、今回は止められなかった。

#### なぜ止められなかったか — 私が同日に検査を無効化していた

`check_asset_versions.py` の検査(2)「現在の `?v` 導入後に変更されたアセット」は
こう書かれていた。

```python
for asset in sorted(TRACK_ACROSS_PUSHES):
```

同日、§9-32 の案Aで `data.js` を `?v` 強制から外すため、
**`TRACK_ACROSS_PUSHES = set()` と空にした。**
このループは対象リストを回すので、**空にした瞬間に検査(2)全体が無効になった。**

もう一方の検査(1)は `origin/main` との差分を見るため、
**変更が merge された後は差分ゼロで素通りする。**
結果、`localize.js` はどちらの網にも掛からなかった。

**外すべきだったのは `data.js` という要素であって、検査そのものではない。**
`data.js` を除外する判断（SWR で鮮度を担保、保険は `check_sw_routing.mjs`）は
今も正しい。**外し方が間違っていた。**

#### 対応: 対象リストを除外リストへ反転する

```python
VERSION_CHECK_EXEMPT = {"data.js"}
...
for asset in sorted(set(refs) - VERSION_CHECK_EXEMPT):
```

これで既定が「全アセットを検査する」になり、除外は理由を書いて明示的に足す形になる。
**「リストに入れたものを検査する」設計は、リストが空になったとき無言で
何も検査しなくなる。**「全部検査し、除外を明示する」なら、
除外を消し忘れても検査は効いたままで、失敗の向きが安全側になる。

#### 反転した途端、同じ事故が2件見つかった

| アセット | 最終変更 | `?v` 導入 | 状態 |
|---|---|---|---|
| `common.css` | `862cc6a` | `153d819` の `?v=3` | 変更が後 → **2日間、旧版が返っていた** |
| `search.js` | `5d55eeb` | `3ec3a5b` の `?v=1` | 同上 |

どちらも 2026-08-01 の変更で、`?v` を上げないまま2日経っていた。
`common.css?v=4`（458箇所）・`search.js?v=2`（13箇所）・`localize.js?v=2`（10箇所）へ更新。

`build-detail-pages.mjs` のテンプレート側 `/common.css?v=3` も同時に上げた。
**ここを忘れると次のビルドで458ページが巻き戻る**（スクリプト冒頭の
`GENERATOR` のコメントが警告していたとおり）。

#### ローカル検査では原理的に見えない

今日追加した画像ガード（§9-35）はこの事故を検出できない。
**ローカル検査は Service Worker を介さないので、常に最新の `localize.js` を読む。**
壊れているのは「一度訪問したことがあるブラウザ」だけで、
初回訪問・CI・curl はすべて正常に見える。

この層を守れるのは `check_asset_versions.py` だけである。
**「本番の返却訪問者にだけ起きる障害」は、描画検査では届かない。**

#### 教訓

- **対象リスト方式の検査は、リストが空になると無言で死ぬ。**
  除外リスト方式なら、除外を書き忘れても検査は効く。**既定を安全側に倒す。**
- 検査の対象を狭める変更は、**その検査が他に何を守っていたかを確認してから**行う。
  今回は「data.js 専用の仕組み」だと思い込んで、汎用の検査だと気づかなかった
- §9-32 で「決定の記録は、それを覆しうるコードの隣に置く」と書いた。
  今回はその隣に置いた記録（`TRACK_ACROSS_PUSHES` のコメント）が
  **data.js の話しかしていなかった。**リストの性質そのもの
  （対象か除外か、空にすると何が起きるか）を書いていなかった

### 9-37. init が「ID を自動生成できない行」で調査結果を巻き戻していた

フェス調査の残り18件に着手するため `research_festival.mjs init` を実行したところ、
**完了済みの `ensou.json` / `mori-michi-ichiba.json` が雛形の初期値に巻き戻った。**

```diff
 "date": {
-  "value": "2026-05-15/2026-05-17",
-  "source": "https://sonminentertainment.zaiko.io/e/ensoufest2026",
-  "confidence": "high",
+  （雛形の空値へ）
```

コミット済みだったので `git checkout` で復元できたが、**調査途中（未コミット）に
踏んでいれば復元できなかった。**

#### 原因: 存在検査が「確定前のパス」を見ていた

```
L298  stem  = id || '_todo-<base64>'      日本語名 → slugify 失敗 → '_todo-xxxx'
L300  existsSync(jsonPath(stem))          '_todo-xxxx' は存在しない → 通過
L321  stem2 = hit ? hit.id : stem         既存 FESTIVALS の行と一致 → 'ensou' に確定
L322  existsSync(jsonPath(stem2))         存在するが…
L324    if (prev.name !== name) スキップ   同名なので条件に掛からず通過
L331  writeFileSync(jsonPath(stem2))      ← 上書き
```

L322 の検査は「**別**のフェスが同じ ID を使っていないか」という衝突検査で、
存在検査ではない。同名（＝同じフェス）は「衝突ではない」ので素通りする。

**書き込み先は `stem2` なのに、存在検査は `stem` に対して行われていた。**
両者が食い違うのは「名前を ID 化できず、かつ既存 FESTIVALS に該当行がある」
場合だけで、それがちょうど日本語名のフェスだった。

`ensou`（円相芸術音楽祭）と `mori-michi-ichiba`（森、道、市場）はどちらも
前回 ID を人が決めており、**`init` を回すたびに必ず巻き戻る構造**になっていた。
日本語名のフェスが INBOX に入るたびに再発する。

#### 対応

`stem2` 側の存在検査で、同名だった場合も «既存（上書きしない）» としてスキップする。
**検査は「最終的に書き込むパス」に対して行う。**

再現確認: 修正前は `+ ensou [既存行 — 空欄補完]` と書き込まれていたものが、
修正後は `= ensou 既存（上書きしない）` になり、`date` の値も保持された。
29行すべてが «作成 0 / スキップ 29» になることを確認。

#### §9-17 / §9-35 と同じ「片方の経路だけ保護されている」形

| | 保護された経路 | 漏れた経路 |
|---|---|---|
| §9-17 | `webp()` を通した一覧描画 | 編集画面プレビュー等、残り6経路 |
| §9-35 | `tjAssetPath()` を通した `<img src>` | `background-image` 5経路 |
| §9-37 | `stem` に対する存在検査 | `stem2`（実際の書き込み先） |

いずれも**「守っているつもりの検査が、実際の出口を見ていなかった」。**
§9-17 で「値が DOM に届く経路を数える」と書いたのと同じ問いを、
書き込み側にも適用する必要がある。**検査対象は入口ではなく出口で決める。**

#### 副次: INBOX に重複行が2組あった

着手前の点検で、年号を除いた名前で照合すると2組の重複が見つかった。

| 名前 | 残す | 削除 | 備考 |
|---|---|---|---|
| FESTIVAL FRUEZINHO | 行4 `2026-06-13` | 行12 `FESTIVAL FRUEZINHO 2026` `2026.06.13` | 同一フェス |
| rural | 行5 `2026-07-17/2026-07-20` | 行19 `2026.07.17-20` | 同一フェス（前回も2行あった） |

**削除side はどちらも日付が `2026.06.13` / `2026.07.17-20` のドット区切り**で、
残す側は ISO 形式。別の入力経路から流し込まれた行と見られる。
完了済みの `festival-fruezinho.json` / `rural.json` はどちらも ISO 側
（行4・行5）を取り込んでいる。

`init` は ID 衝突として `FESTIVAL FRUEZINHO 2026` をスキップするが、
`rural` は**同名なので2行目も同じファイルに書こうとする。**
今回の修正が無ければ、ここでも調査結果が巻き戻っていた。

### 9-38. 住所の段階的短縮が「大字」を割って、15km 離れた川にヒットした

フェス調査で `global-ark` の座標を取ったところ、野反湖から約15km 離れた
「大竹川」という川にヒットした。

```
入力  群馬県吾妻郡中之条町大字入山国有林224
実行  群馬県吾妻郡中之条町大        ← ここが投げられた
結果  大竹川, 中之条町, 吾妻郡, 群馬県  36.5908, 138.7935
実際  野反湖                          36.7069, 138.6458   → 約15km
```

#### 原因

`addressCandidates()` は施設名で引けなかったときのフォールバックとして、
住所を段階的に短くして試す。その一段が `字` を境に切っていた。

```js
const noAza = noNum.replace(/字[^字]*$/, '').trim();
```

**「大字」は2文字で1語。** `字入山国有林` だけを落とすと `大` が孤立して残り、
`中之条町大` という**存在しない地名**ができる。Nominatim は近い綴りの
「大竹川」を返し、値としては座標の形をしているので通ってしまう。

```js
const noAza = noNum.replace(/大?字[^字]*$/, '').trim();   // 修正後
```

修正後は `群馬県吾妻郡中之条町` になる。`湯沢町大字三国` → `湯沢町`、
`長南町字米満` → `長南町` も正しく短縮されることを確認した。

#### confidence: low は付いていた。それでも足りなかった

このスクリプトは施設名で当たらなかった場合に `confidence: low` を付ける設計で、
今回もそうなっていた。**設計としては安全側に倒れている。**

だが `low` は「精度が粗い（町丁目レベル）」の意味で使われており、
**「15km 離れた別の地物」を意味していない。**同じラベルで
「粗いが正しい」と「そもそも間違い」が混ざると、ラベルが判断材料にならない。

実際、他の `low` 6件を点検したところ、クエリはすべて実在する地名で、
粗いだけだった。**壊れていたのは1件だけで、それは `low` からは区別できなかった。**

#### 検出方法: 「クエリが語中で切れていないか」を見る

既存の座標を再点検するにあたり、座標そのものの妥当性は
（会場名の多くが OSM に無いため）機械照合できなかった。
代わりに **記録されているクエリ文字列**を見た。

```
q が「大」または「字」で終わる → 語中切断の疑い
```

10件中1件（`global-ark`）だけが該当し、他は有効な地名だった。
**値ではなく、値を得た手順を検査する。**値の正しさを直接確かめられないとき、
入力の妥当性は確かめられることがある。

`note` にクエリと OSM の返り値を残す設計になっていたおかげで、
この事後検証ができた。**自動で埋めた値は、どう埋めたかも一緒に残す。**

#### 対応

- `addressCandidates()` を修正（`大?字`）
- `global-ark` は会場名が OSM に無いため、野反湖の座標で代用。
  `confidence: low` のまま、note に「野反湖の座標。キャンプ場そのものではない」と明記

### 9-39. 同じ push で3本が並走し、正しくなった生成物がデプロイされていなかった

2026-08-04、Publish のたびに GitHub Actions が失敗しているという報告。
4件の失敗を調べたところ、原因は3種類で、性質が違った。

| ワークフロー | 原因 | 実害 |
|---|---|---|
| Generate sitemap ×2 | `editions.json: FESTIVAL_ID 参照切れ "fulirock"` | あり（sitemap が生成されない） |
| Lighthouse CI | CLS `0.05336 > 0.05` | 軽微（境界上の揺らぎ） |
| **Deploy LP** | `LP/ の生成物がコミット内容と一致しません` | **あり（配信されない）** |

#### 参照切れは ID 変更の片側だけが反映されていた

`fulirock` → `fuji-rock` の ID 是正で `data.js` は新IDになったが、
コミット済みの `LP/data/editions.json` は `FESTIVAL_ID: "fulirock"` のままだった。
ビルドの参照整合性チェックが正しく止めていた。

**CMS の Publish は `data.js` しか更新しない。** `LP/data/*.json` は
`fetch-data.mjs` が別に作る。フェスの ID を変えるときは両方を同じ push に
含める必要がある。§9-32 で「editions.json は FESTIVALS から導出」と
書いたが、導出を**いつ実行するか**は書いていなかった。

#### Deploy の失敗は構造的で、しかも「赤いだけ」ではなかった

`cms: publish data.js` の push で、3つのワークフローが**並行に**起動していた。

```
① deploy-pages   LP/** に一致 → regression-check → 生成物が data.js に未追従 → ❌
② generate-meta  LP/data.js に一致 → 再生成 → [skip ci] でコミット
③ lighthouse     paths 指定なし（全 push）→ 60秒待って本番を計測
```

②が生成物を正しくするが、`[skip ci]` なので deploy は起きない。
①は既に落ちている。結果として **正しくなった生成物は、次に誰かが
人手で push するまでデプロイされない。**

赤いバッジがノイズに見えていたが、実際には**配信が遅れていた。**

③も、deploy の成否と無関係に走るので、deploy が落ちた push では
**古い本番を計測して結果を出していた。**Publish のたびに deploy が
落ちていたので、その間の Lighthouse 結果はすべて前の内容のものだった。

#### 対応: Publish の経路を一本道にする

`publish-pipeline.yml` を新設し、`LP/data.js` の push だけを受ける。

```
fetch → build → 検査4種 → sitemap/RSS → commit [skip ci] → deploy
```

- **無限ループにならない**: 生成物のコミットに `[skip ci]` を付け、
  デプロイは同じ run の working tree（`./LP`）から行う。
  新しいコミットを拾い直す必要がないので再トリガが要らない
- `deploy-pages.yml` は job の `if` で Publish を除外（人手 push 用に残す）。
  **当初 `paths` に `!LP/data.js` と書いたが、これでデプロイが完全に止まった**（後述）
- `generate-meta.yml` は push トリガーを廃止し、日次の保険だけ残す。
  **保険側にも同じ整合性検査を通す。** 素通りさせると、壊れたデータのまま
  sitemap だけが更新され、存在しないURLを載せた sitemap を配ることになる
- `lighthouse.yml` は `workflow_run` に変え、**deploy が success のときだけ**走らせる

#### パイプラインでは「生成物が一致するか」を検査しない

`regression-check.yml` の「生成物がコミット内容と一致するか」は、
**人手 push で再生成漏れを止めるための検査**（§9-21 で実際に事故を止めた）。
今まさに再生成した直後のパイプラインでは常に真になり、意味を持たない。
同じ名前の検査でも、経路によって意味が変わる。

#### 残した重なり

1つの push に `LP/data.js` と他の `LP/**` が同時に含まれると、両方が起動する。
パスフィルタでは「data.js だけが変わった push」を表現できない。
実運用では CMS が data.js を単独でコミットし、人手 push は data.js を
含まないので起きない。起きても `concurrency: pages` で直列化され、
同じ内容を2回デプロイするだけで壊れない。
**条件分岐を足して複雑にするより、重なりを許容して記録する方を選んだ。**

#### CLS は閾値を上げた（宿題として残す）

`festivals.html` の CLS が `0.05336` で、同じ内容でも run によって
通ったり落ちたりしていた。0.05 → 0.06 へ。

**本来は改善すべきで、原因は festivals.html のカード描画。**
カードは `data.js` から JS で描かれるため、後から差し込まれてレイアウトがずれる。
画像は `tjImageSizeAttrs` で `width`/`height` を入れてあるので、
残っているのはカード自体の高さが描画前に確定していない分と思われる。
`.lighthouserc.json` の `_note` に「緩めた値で通ることを『直った』と
読み替えないため」と明記した。改善したら 0.05 に戻す。

#### 修正の過程で、本番デプロイを2回止めた

このワークフロー修正そのもので回帰を2件出した。どちらも**「検査を書いたのに
止まらなかった」**形で、今日の他の節と同じ構図なので記録する。

**(1) `paths` の否定パターンでデプロイが完全に止まった**

`deploy-pages.yml` から Publish を除くために、こう書いた。

```yaml
paths:
  - 'LP/**'
  - '.github/workflows/deploy-pages.yml'
  - '!LP/data.js'
```

ドキュメント上は「後続の否定パターンに一致したパスだけが除外される」。
だから `LP/data/*.json` や `deploy-pages.yml` 自身が変わった push では
起動するはずだった。**実際には1本も起動しなくなった。**

`5e52acf` はその両方を変更している push だったが、Deploy の run が
1件も作られていない。否定を1つ足しただけで**フィルタ全体が効かなくなった**
ように見える。サイトが更新されなくなる回帰で、**気づいたのは
「push したのに run が出ない」ことに違和感を持ったからで、
何かが赤くなったわけではない。**

**失敗が沈黙として現れる変更は、成功と区別がつかない。**
`paths` の否定は使わず、判定は job の `if` で行う。

```yaml
if: "${{ !startsWith(github.event.head_commit.message, 'cms: publish') }}"
```

**(2) YAML 構文エラーのまま push した**

上の `if` を引用符無しで書いたため、式中の `'cms: publish'` のコロンを
YAML がマッピングのキー区切りと解釈し、ファイル全体がパース不能になった。

```
ScannerError: mapping values are not allowed here (line 38, column 63)
```

**構文検証は書いてあった。それでも素通りした。**

```bash
python3 -c "import yaml; ..." ; git add ... ; git commit ... ; git push
#                             ^ セミコロン連結なので、検証が落ちても後続が走る
```

§9-36 で「対象リストを空にすると検査が無言で死ぬ」と書いた翌々時間に、
**検査の結果を使わないという別の形で同じ失敗をした。**
検査を書くことと、失敗を後続に伝えることは別の作業である。
`&&` で連結し、検証が落ちたらコミットしないようにした。

#### 初回実行の実測（workflow_dispatch）

```
 3秒  Fetch data from spreadsheet
 2秒  Build detail pages
 4秒  Check asset cache busting
 0秒  Check service worker routing / Check regression thresholds
20秒  Check hub pages render (JS health)   ← 支配的。headless Chrome で11ページ
 0秒  Generate sitemap.xml / rss.xml
 2秒  Commit generated output（差分なしで抜けた）
 6秒  Deploy to GitHub Pages
----
57秒  合計
```

検査4種と描画検査を挟んでも1分以内。従来の Deploy 単体（18秒〜3分）と
比べて実用上の差は無い。

sitemap のリダイレクトスタブ除外も確認した。スタブ17件
（Title Case 7件 × JA/EN、記事1件、今日追加した `fulirock` 2件）が
すべて除外され、`<loc>` は412件。除外は個別列挙ではなく
`<meta name="robots" content="noindex">` の有無で判定しているため、
**スタブが増えても漏れない。**

`deploy-pages` の `if` による skip は `push` イベントでないと発火しないため、
**次の実データ Publish まで未検証。**

### 9-40. LINEUP の未照合候補を CMS で提示する（実装済み）

§9-33 で記録したとおり、LINEUP は掲載原文の表示名と ARTISTS の NAME/ID を
照合するため、`YURIPON` / `DJ YURIPON`、`dj-yogurt` / `DJ Yogurt`、
`NC4K (Stones Taro & Lomax)` / `NC4K` のような表記差がリンク切れを生む。

2026-08-04、CMS に `suggestArtistCandidates()` を追加した。
`matchArtist()` は厳密な照合のまま維持し、候補生成だけを分離している。
候補は最大3件で、前方一致・部分一致・主体名一致・限定的な編集距離を使い、
候補名・ID・一致理由・確度を表示する。3文字以下の記号除去一致は抑制するため、
`M.I.O` を `Mio` と同一視しない。

候補は入力中の autocomplete と未照合タグの横に表示し、保存時にも確認する。
候補の採用は明示ボタンを押した場合だけで、自動置換はしない。FESTIVALS.LINEUP
は掲載原文を保持する必要があるためである。

将来 LINEUPS 構造へ移行する際は、候補採用で `ARTIST_ID` を設定し、公式発表の
原文を `ACT_LABEL` に残す。この方針は §9-22 のデータ構造課題と §9-33 の
表示名照合問題を同時に解消する展望として記録する。

### 9-41. ARTICLES の公開整合性ガード（実装済み）

記事を増やす前に、公開経路の3つの死角を塞いだ。

- `build-detail-pages.mjs` は公開記事本文（JA/EN）の `[[festival:id]]`、
  `[[artist:id]]`、`[[venue:id]]`、`[[article:id]]` をビルド時に検証し、
  存在しないIDがあれば停止する。draft本文は未完成保存を許容するため対象外。
- sitemap は `data.js` の ARTICLES を無条件に列挙せず、生成済みで noindex でない
  記事ページだけを列挙する。
- 回帰ガードに、JA/ENニュースハブの静的リンク先と sitemap の記事URLが
  公開HTMLへ到達できることを追加した。draftやリダイレクトスタブの混入は0件を要求する。

今回後回しにした課題は以下である。

- スキーマとCMS項目の不一致（`AUTHOR_ID`、CATEGORY、`views`）
- 本文画像の外部URL依存
- `RELATED_FESTIVALS` 等の複数関連付け

記事IDを公開後に変更する場合は、既存の `REDIRECTS.articles` に
`旧ID: 新ID` を追加すれば、フェスの `fulirock` → `fuji-rock` と同じ
noindex のリダイレクトスタブを JA/EN に生成できる。変更前後の両IDが
公開データに存在するタイミングでは衝突を避けるためスタブを出さない安全策もある。

### 9-40. EDITIONS 構造が無いために「翌年の開催回」を登録できない — LOA の実例

INBOX の調査結果をシートへ反映する分類作業で、**新規登録に見えたフェスが
既存フェスの翌年開催回だった**ケースが出た。§9-22（LINEUP がステージ別・
日別を表現できない）と同根で、開催回を持てない構造の別の症状。

```
既存 FESTIVALS   loa-lost-paradise   LOA-LOST PARADISE-   2025-08-16/17   Ibaraki
INBOX の調査結果 loa                 LOA                  2026-08-15/16   Nalu Beach, 鉾田市
```

Instagram アカウントが両方とも `loa_lost_paradise` で一致しており、同一フェスの
2025年回と2026年回である。**新 ID `loa` で登録すれば二重登録になる。**

#### なぜ気づけたか

分類スクリプトは「調査JSONの id が FESTIVALS に無ければ新規」と判定する。
`loa` は無いので新規に分類された。**気づいたのは別件（過去日付の棚卸し）で
FESTIVALS 全89件を一覧したとき**で、`loa-lost-paradise` が目に入ったからだった。

**ID が違えば別フェスとして扱われる。**名前が似ていても、Instagram が
同じでも、機械的には別物になる。今回は偶然見つかったが、
分類だけを信じていれば二重登録していた。

#### 同じ形が他にもある

同日の棚卸しで、既存行の日付が前年のまま残っているものが4件見つかった
（`bondisco` / `global-ark` / `orbit` / `yamauto`）。加えて `signal` も同じだった。

これらは「1フェス=1行、DATE を上書き」という現構造では**正しい運用**である。
翌年の開催が決まったら DATE を書き換えるしかない。だが:

- 上書きすると**前年の開催回の記録が消える**
- 書き換え忘れると**過去日付のまま残る**（今回の5件）
- 別 ID で登録すると**二重登録になる**（今回の LOA）

**どれを選んでも問題が出る。**構造が選択肢を持っていない。

#### 現状の回避策

`loa` は登録を見送り、調査結果は `data/inbox/loa.json` に残した。
`loa-lost-paradise` の DATE を 2026年回へ書き換えるという選択肢もあるが、
2025年回の記録が失われるため保留とした。

**EDITIONS が実装されれば、FESTIVALS はブランド1行、開催回は EDITIONS の
複数行になり、この3つの問題が同時に解ける。**DATA_SCHEMA §2.3 の
「目標」がまさにこの構造で、`editions.json` は既に存在するが
`fetch-data.mjs` が FESTIVALS から1行ずつ導出しているだけで、
**1フェス1開催回しか表現できない**（§9-32）。

#### 判定材料として使えるもの

新規か既存の別回かを見分けるとき、ID の有無だけでは足りない。
今回効いたのは **Instagram アカウントの一致**だった。
同じ主催が同じアカウントで告知するため、名前の表記ゆれより信頼できる。

分類スクリプトに「INBOX の URL/INSTAGRAM が既存行の instagram と一致する行が
無いか」を見る判定を足せば、同種の取りこぼしを機械的に拾える。
**未実装。**次に同じ作業をするときの改善候補として記録する。

### 9-41. バックアップ対象がハードコードで、2シートが一度も保全されていなかった

EDITIONS シートの調査中に、`backups/latest.json` に EDITIONS が含まれていない
ことに気づいた。`.github/workflows/backup-data.yml` を見ると原因は単純だった。

```python
SHEETS = ['VENUES', 'FESTIVALS', 'ARTISTS', 'EVENTS', 'ARTICLES']
```

**ハードコードで、EDITIONS と LINEUPS が入っていない。**
シートを増やしても自動では入らない。

#### 実害

| シート | 行数 | バックアップ |
|---|---|---|
| EDITIONS | 84 | **一度も取られていない** |
| LINEUPS | 284 | **一度も取られていない** |

EDITIONS の84行には、FESTIVALS からは再現できない過去回が含まれていた
（`body-soul-2025` / `signal-2025` / `grow-the-culture-open-air-2025`）。
FESTIVALS は「1フェス=1行、DATE を上書き」なので、前年の日付は既に無い。
**これらが失われたら復元手段が無かった。**

LINEUPS 284行も同様で、`ARTIST_ID` の解決結果を含む出演情報が
まるごと保全対象外だった。

#### なぜ気づかなかったか

**追加を忘れても、既存5シートのバックアップは成功し続ける。**
ワークフローは緑のまま、`backups/` にはファイルが毎日増える。
「バックアップは動いている」という観測は正しく、
「何がバックアップされているか」を誰も確認していなかった。

このワークフローには「全シートが0行なら保存しない」という
まっとうなガードがある（§データ障害の教訓）。だが**そのガードも
`SHEETS` の中しか見ない。**リストに無いシートは、
存在しないのと同じ扱いになる。

**§9-36 と同型。**「対象リスト方式は、リストが不完全でも成功する」。
あちらは空にして検査全体が死に、こちらは足し忘れて対象が欠けた。
どちらも**失敗が沈黙として現れる**。

#### 対応

`SHEETS` に EDITIONS / LINEUPS を追加し、
**「シートを新設したらここに必ず追加すること」**をコメントで明示した。

#### 今後シートを追加するときのチェック項目

新しいシートを作ったら、以下をすべて確認する。
どれか1つでも漏れると、静かに片肺運転になる。

1. `backup-data.yml` の `SHEETS` — **保全されるか**
2. `fetch-data.mjs` の `GIDS` — JSON に書き出されるか
   （ただし未使用のシートを入れると取得ループで落ちるので、
   使い始めるタイミングで入れる。EDITIONS は `TJ_EDITIONS_GID` で
   任意読み取りにしてある）
3. `docs/DATA_SCHEMA.md` — 実在する列として記載されているか
   （§9-32 の「設計案を実装済みと読む」誤りを避けるため、
   実装状態を明記する）
4. 回帰ガード — 件数や参照整合を見る指標が要るか
5. CMS — 入力経路を持つなら、書き込み先とタイミングを記録する

**リスト方式の設定は、追加を忘れても壊れない。だから忘れる。**
チェック項目として書き残すしかない。

### 9-42. data.js の除外が検査1に届いていなかった

案A（data.jsをTRACK_ACROSS_PUSHESから外す）を適用した際、履歴比較である
検査2だけを除外し、同一pushの差分比較である検査1は全JS/CSSを対象にしたまま
だった。そのため `data.js` を除外したつもりでも、Publish pushでは
`?v=10` 据え置きとして検出され続けた。

これは、方針と実装が一致しない状態が続き、「除外したつもり」が実際には
効いていなかった例である。検査対象リストを空にして検査そのものを無効化した
§9-36と同型で、**除外の適用範囲を検査ごとに確認しなかったこと**が原因。

#### 対応

`VERSION_CHECK_EXEMPT = {"data.js"}` を検査1にも適用し、data.jsは
同一push比較・履歴比較の両方から除外した。`check_sw_routing.mjs` の
SWR実行検査は引き続き有効である。

### 9-43. 開催回をCMSで選択・編集する経路

FESTIVALSの編集画面に開催回セレクターを追加した。既存の`Editions`欄を
後方互換で読み込み、年・回数・日程・会場・住所・座標・チケット・フライヤー・
ステータス・LINEUPを開催回単位で編集できる。保存値は既存のFESTIVALS行の
`EDITIONS` JSON欄に保持され、`fetch-data.mjs`は複数開催回を展開して
`editions.json` / `lineups.json`を生成する。

EDITIONS / LINEUPSシートの読み取りは段階2として接続済み（EDITIONS gid
`1765363054`、LINEUPS gid `580984930`）。`fetch-data.mjs` の既定経路と
Publish pipeline はシートを正式ソースとして `editions.json` / `lineups.json` を
生成する。CMSの既存行更新は `update_row` で同期し、新規行もシート末尾の次行へ
同じ `update_row` を送るため、既存GASのヘッダー写像を共有する。

### 9-44. セキュリティ全面点検と、404 にならないリンク切れ（2026-08-06）

「全体のバグ修正とセキュリティ強化」の依頼を受けた全面点検。
推測ではなく実測で確かめたものだけを記す。

#### A. 反射型 XSS（実際に発火した）

`news.html` の `?tag=` と `#tag/` が、URL の値をそのまま
`pill.innerHTML` に差し込んでいた。
`/news.html?tag=<img src=x onerror=...>` を headless Chrome で開き、
**onerror が実行されることを確認**した（理論上の指摘ではない）。

ハブ全体でテンプレートリテラルを `innerHTML` に代入する箇所は71あるが、
攻撃者が値を決められるのは URL パラメータ由来のものだけで、
実測で発火したのはこの1経路。他は固定リストか data.js 由来だった。

対応:

- `localize.js` に `tjEscapeHtml()` を追加し、`innerHTML` へ入れる前に通す
- `sanitizeTag()` を追加。既知タグに一致するか `^[\w-]+$` のものだけ通し、
  64文字を超えるものは落とす。`?tag=` と `#tag/` の両方の入口に適用
- **`?v=2 → v=3` を10ファイル + `check_sw_routing.mjs` で更新**。
  最初これを忘れ、ブラウザには古い `localize.js` が配信されて
  `tjEscapeHtml is not defined` になった。§9-36 と同じ踏み方で、
  `check_asset_versions.py` が拾った

#### B. セキュリティヘッダを全449ページへ

GitHub Pages は HTTP ヘッダを設定できないので `<meta http-equiv>` で入れる。
CSP / X-Content-Type-Options / Referrer-Policy / Permissions-Policy の4種。

- 生成物は `build-detail-pages.mjs` に定数を置き、詳細ページと
  リダイレクトスタブの両方に出す
- `map.html` は Leaflet を unpkg.com から読んでいた。CSP に外部 CDN を
  書き足すのではなく、**`/vendor/leaflet-1.9.4/` に取り込んで self に閉じた**。
  第三者 CDN は、そこが乗っ取られた日にこちらのページで任意コードが動く
- `cms.html` だけ別の CSP にした。`localStorage` に `cms_token` を持つので、
  外部オリジンの script は一切許可しない
- `LP/app/index.html`（PWA）はリポジトリ内で唯一ヘッダが無かった。
  ここは外部スクリプトを一切読まないので、`app.js` からインライン
  ハンドラ（`onclick` / `onerror`）を除去して
  **`script-src 'self'`（`'unsafe-inline'` 無し）**にした。リポジトリ内で最も厳しい。

  **なお `LP/app/` は本番に出ていない。** `deploy-pages.yml` に
  `rm -rf ./LP/app` があり、開発中として除外されている
  （`/app/index.html` は本番では 404 ページが返る）。
  今開いている穴を塞いだのではなく、**公開する日に穴が開いていないようにした**もの。
  公開はその step を消すだけなので、塞いでから消せる状態にしておく

#### C. `javascript:` URL（esc() では止まらない）

`esc()` は `"` を潰すので属性からの脱出は防ぐが、
`href="javascript:..."` はそのまま残りクリックで実行される。
URL / TICKETURL / INSTAGRAM / SOUNDCLOUD などはスプレッドシート由来で
現時点では信頼できるが、入力経路が増えれば前提は崩れる。

`build-detail-pages.mjs` と `LP/app/app.js` に `safeUrl()` を追加し
（http / https / mailto / tel と相対パスのみ通す）、
データ由来の `href` 9箇所に適用。`map.html` の `link.href = club.url` にも
同じ規則を入れた。**この2つの `safeUrl()` は同じ規則なので、
片方だけ直さないこと**（`localizedValue()` と同じ申し送り）。

#### D. 404 にならないリンク切れ ← 今回いちばん大きい

2026-08-02 に SPA 詳細ビューを廃止した（§9-23）とき、
`#festival/<id>` を**解釈する側**は消えたが、**そこへ飛ばす側**が残っていた。

| 場所 | 影響 |
|---|---|
| `index.html`（JA/EN） | フェス行・アーティスト・会場の**全カード** |
| `favorites.html` | お気に入りカード3種 |
| `search.js` | 検索結果の**全項目**（フェス/アーティスト/会場/記事） |
| `app/app.js` | ラインナップのアーティスト名 |

`festivals.html#festival/xxx` は 200 を返す。ハブは正常に描画される。
だから**リンク切れ検査にも、ハブ描画検査にも、SPA/静的差分検査にも映らない**。
トップから詳細へ一度も行けない状態が4日間続いていた。
トップは最も踏まれるページで、検索はもう一つの主要導線である。

対応: すべて `/festivals/<id>.html` 形式の静的詳細ページ直リンクに変更。
EN は `enHubFromJa` が `/en/` を前置する既存規則にそのまま乗る。
`search.js` は JA/EN 共通で読まれるので `<html lang>` で分岐させた
（`news.html` の `articleDetailHref` と同じ規則）。

`index.html` の記事リンクは `news.html#article/<id>` で、これは
news.html 側の `location.replace` で最終的には詳細に着いていた。
ただし**そのために news.html と data.js を読んでから改めて遷移**していたので、
静的ページ直結に変えた。

実測（`--dump-dom` で描画後の href を取り、実際に fetch して確認）:

```
index: フェス行        /festivals/hacha-mecha.html → 200 (詳細ページ)  ✅
index: アーティスト     /artists/dj-nobu.html → 200 (詳細ページ)        ✅
index: 会場            /venues/o-east.html → 200 (詳細ページ)          ✅
index: 記事            /articles/....html → 200 (詳細ページ)           ✅
en/index: フェス行     /en/festivals/hacha-mecha.html → 200            ✅
```

#### E. detail.css のバージョンが2つに割れていた

`1932e50`「Redesign all festival detail pages」で `detail.css` に259行を
追記した際、フェス詳細だけ `?v=4` にし、**artists / venues / articles / en の
226ページは `?v=3` のまま**残っていた。

追記が `.festival-design-v2` 配下だけだったので実害は出ていない。
ただし `sw.js` は `/detail.css` を cache-first で持つので、
次に共通ルールを触れば226ページに新 CSS が届かない。
呼び出し側で上書きできる引数（`detailCssVersion`）だったのが原因なので、
**モジュール定数 `DETAIL_CSS_VERSION` にして上書きできなくした**。

#### F. 追加した回帰ガード

いずれも**負のコントロールで検出できることを確認**してから入れた。
「緑になった」だけでは、検査が何も見ていない場合と区別できない（§9-32）。

1. `check_hub_pages.py` に XSS 検査を追加。
   iframe で実際に8本の攻撃 URL を踏み、`onerror` が動いた数を数える。
   静的に「未エスケープの補間」を探す方式では、その大半がデータ由来で
   安全なため真偽が決まらない。実際に踏むほうが判定が付く。
   *負のコントロール: `tjEscapeHtml` を外すと `2件 発火` と出た*

2. `check_internal_links.py`（新規）。
   廃止済み SPA ハッシュ形式の禁止と、449ページの内部リンク実在確認。
   D で見たとおり **404 にならない壊れ方があるので、404 を探すだけでは足りない**。
   消えた受け手に向けたリンク形式そのものを禁止する。
   *負のコントロール: 死んだリンクを1本戻すと該当行を指して落ちた*

   自分の説明文に禁止パターンを書くと自己検出するので、
   走査前にコメントを潰している。理由を書けないガードは、
   次に触る人が理由を知らないまま消しにかかる。

3. 両方を `publish-pipeline.yml` と `regression-check.yml` に組み込み。

#### 残っている申し送り

- `check_asset_versions.py` は `LP/app/app.js` を
  「どの HTML からも参照されていない」として素通しする。
  PWA のシェルは `?v=` ではなく `app/sw.js` の `VERSION` 定数で
  無効化する方式なので、**`app.js` / `app.css` / `app/index.html` を触ったら
  `VERSION` を上げること**。今回 `v1.3.0 → v1.4.0`

### 9-45. 転送量の実測と、背景画像が1枚も遅延していなかった件（2026-08-06）

「ユーザー数が増えても耐えられる設計に」という依頼に対して、
まず**どこが詰まるのかを実測**した。推測で最適化すると、
効かない場所を触って効く場所を残すことになる。

#### 前提: 詰まるのはサーバではない

公開ページは完全な静的配信で、実行時に叩く自前バックエンドが無い。
投稿は Google フォームへの外部リンク、Instagram は about.html だけで
IntersectionObserver 遅延読み込み、CMS の GAS は運用者しか触らない。
**つまり「アクセスが増えて落ちるサーバ」が存在しない。**

律速は2つだけ:

1. GitHub Pages の帯域（ソフト上限 100GB/月）
2. 端末側の転送量と描画コスト（モバイル回線での体感）

どちらも **1訪問あたりの転送量**で決まる。そこを測った。

#### 実測（412x915 / gzip 有効 / 画像込み）

```
                    対応前      対応後
index.html         2.82 MB  →  1.38 MB   （うち画像 2.70 → 1.26 MB）
artists.html       0.53 MB  →  0.11 MB   （うち画像 0.43 → 0.01 MB）
festivals.html     4.87 MB      4.87 MB   ← 未解決。後述
venues.html        0.17 MB      0.17 MB
news.html          0.68 MB      0.67 MB
festivals/ala.html 0.48 MB      0.48 MB
```

トップ 2.82MB は 100GB/月 に対して約 36千 PV 相当。1.38MB なら約 74千 PV 相当。

#### 原因: loading="lazy" は `<img>` にしか効かない

`festivals.html` は `<img loading="lazy">` を使っており正しく遅延していた。
一方、**トップのフェス行・アーティスト・会場カードと `artists.html` の
カードはすべて CSS の `background-image`** で、
background-image は画面外でも即座に取りに行く。
つまり**トップは1枚も遅延していなかった**。

対応: `localize.js` に `tjLazyBgAttr()` / `tjApplyLazyBackgrounds()` を追加。
テンプレートは `style` ではなく `data-bg` に URL を入れ、
`innerHTML` 後に IntersectionObserver（rootMargin 600px）へ登録する。
到達する頃には読み終わっているので体感は変わらない。
`IntersectionObserver` が無ければ即座に全部立てる。
**「遅延できないなら表示しない」にはしない。**

#### 検査の穴を同時に塞いだ

遅延させると背景 URL が `style` 属性に現れなくなるので、
`check_hub_pages.py` の画像検査（`[style*="background-image"]` を見る）から
**対象が丸ごと消える**。転送量が減ったのを「改善」と読んでいたら、
実際には画像が出なくなっていた場合と区別が付かない（§9-32）。

- 画像検査が `[data-bg]` と適用済みの `element.style.backgroundImage` の
  両方を見るようにした
  *負のコントロール: `data-bg` の URL に `.broken` を足すと 4件 404 と出た*
- 別途、背の高いビューポートで開いて
  **背景が実際に適用され、その URL が 200 で取れる**ところまで確認した
  （index 14枚 / artists 3枚、読めない 0）

#### 未解決: festivals.html の 4.87MB

遅延読み込みは効いている（92枚中17枚程度しか取っていない）。
残っているのは**画像1枚あたりが大きいこと**。

```
webp 92枚 / 平均 272KB / 最大 1366KB
実寸は 1080〜1920px（CMS の compressImage と Drive 同期の長辺上限が 1920px）
```

カードの表示幅は 400〜600px なので、**面積で10〜20倍を送っている**。
800px 版を作れば festivals.html は 4.87MB → 1MB 前後になる見込み。

これは「派生画像の生成」という新しいパイプライン段階が要る:

- `LP/images/` の中身は `sync-drive-images.yml` が2時間おきに
  Drive から**上書きダウンロード**する。ここに派生を置くと消えるか、
  毎回差分が出る。**別ディレクトリ（例 `LP/images-sm/`）に出すこと。**
  同 workflow は `git add` するだけで削除はしないので、別階層なら干渉しない
- 生成は CI（Pillow は sync-drive-images が既に入れている）。
  原本が更新されたら作り直す必要があるので、ハッシュ manifest を持たせる
- 参照側はカード用途だけを差し替える。詳細ページのヒーローは原寸のまま

**独断で入れるには影響範囲が広い**（画像が全滅する事故は §9-35 で起きている）
ので、ここまでを申し送りとして残す。


#### 追記: Drive 同期のたびに CI が落ちていた

上の作業中に踏んだ。`sync-drive-images.yml` は2時間おきに Drive から
画像を取ってコミットするが、**`LP/image-dimensions.js` を作り直さない**。
寸法表は `LP/images/` の中身から生成されるので、画像が1枚増えれば古くなる。
次の deploy で `regression-check` が
「生成物がコミット内容と一致しません」で落ちる。

つまり**人が何もしなくても2時間おきに CI が壊れうる**状態だった。
さらに、手で作り直しても `?v` を上げないと
`check_asset_versions.py` が今度はそちらで落ちる。

対応（2箇所）:

1. `build-image-dimensions.mjs` が、中身が変わったときに
   参照側の `?v` を自分で上げるようにした。
   **参照されている最大値の次を全参照に揃える**（ファイルごとに +1 すると
   §9-44 E の `detail.css` と同じ混在が起きる）。
   中身が変わらなければ何もしない（冪等）
2. `sync-drive-images.yml` が画像を取った後に
   `node scripts/build-image-dimensions.mjs` を走らせ、
   寸法表と `?v` を**同じコミットに含める**ようにした

これで「同期した側が、同期に伴う生成物まで責任を持つ」形になる。

### 9-46. 全面セキュリティ/信頼性強化の初動（2026-08-06）

ユーザー増加を前提に、公開サイト・CMS/GAS・Publish・Backup・CIを横断監査した。
公開サイトは静的配信で実行時バックエンドを持たないため、主な可用性リスクは
GitHub Pagesの帯域、生成パイプライン停止、CMS/GAS認証境界である。

実測された最新の公開停止原因は、Publish pipeline `31023946153` が
`LINEUPS.ARTIST_ID=yazzus` の参照切れで停止したこと。壊れたリンクを公開しない停止は
維持しつつ、`build-detail-pages.mjs` が参照切れを全件収集し、該当 `EDITION_ID` と共に
修正案を表示するよう改善した（`d3305c9`）。

全面強化の計画は `reports/security-hardening-plan.md` に記録した。優先順位は、
参照切れ復旧導線、CMS/GAS認証・権限、入力/画像/URL境界、Publish/Backup再実行性、
CI権限・依存関係・秘密情報、実ブラウザ/負荷計測の順とする。

### 9-46. 出演者311名が詳細ページに出ていなかった（2026-08-06）

`https://techno-japan.media/festivals/loa-lost-paradise.html` で
「LINEUP がフライヤー横に入っていない」という指摘から入った。
調べたら1ページの話ではなかった。

#### 何が起きていたか

`FESTIVALS` シートには旧 `LINEUP` 列が残っており、CMS もそこへ書ける。
一方 `fetch-data.mjs` の正式モード（段階2で `EDITIONS` / `LINEUPS` シートを
正式ソースにした）は **`LINEUPS` シートしか読まない**。

その結果、旧列にしか出演者が無いフェスは
**詳細ページの LINE UP が黙って出ない**。
ページ自体は正常に描画され、エラーも警告も出ない。

実測（ライブシート / 2026-08-06）:

```
14フェス / 311名 が該当
  nu-festival 65 / etsuetsu 57 / global-ark 40 / rural 31 / sub-tide 23
  spring-love-harukaze 16 / hacha-mecha 13 / letus-music-camp 13
  loa-lost-paradise 13 / link-open-air 10 / e-groove 10
  festival-de-frue 7 / festival-fruezinho 7 / ensou 6
```

**「出ない」ことが検出されない構造だったのが本体。**
参照切れ（`ARTIST_ID参照切れ` 等）は警告が出るのに、
「そもそも参照が無い」は誰も見ていなかった。

#### 対応

`fetch-data.mjs` の正式モードに、旧列からの導出を橋渡しとして入れた。
`LINEUPS` が正式な置き場所であることは変えない。

- そのフェスに `LINEUPS` 行が1行でもあれば、シート側が正。何もしない
- `FESTIVALS.DATE` の年に対応する開催回へ付ける。
  **今の出演者は今の開催回のものなので、過去回に付けてはいけない**
- 対応する回が無ければ付け先が無い。警告だけ出す
- 導出したときも警告を出す（移行が終わるまで見えるようにしておく）

移行が終われば旧列が空になり、このブロックは自然に何もしなくなる。

導出ロジックは互換モード（`--legacy`）と同一で、
違うのは「対応する開催回を選ぶ」ところだけ。

検証（ローカルで fetch → build して実測、生成物は戻した）:

```
hacha-mecha    LINE UP=あり  出演枠 13
nu-festival    LINE UP=あり  出演枠 65
etsuetsu       LINE UP=あり  出演枠 57
rural          LINE UP=あり  出演枠 31
sub-tide       LINE UP=あり  出演枠 23
→ detail-flyer-lineup has-two-columns（フライヤーの横に並ぶ）
```

#### 付け先が無い2件 — 別の事故が隠れていた

`loa-lost-paradise` と `global-ark` だけ導出できなかった。
両方とも **`FESTIVALS.DATE` が2026なのに `EDITIONS` に2025回しか無い**。

これは AGENTS.md が禁じている
「FESTIVALS の DATE を翌年へ上書きして過去回を消す」の**裏返し**で、
DATE だけ2026に進めて EDITIONS に回を足していない状態。
詳細ページは `editions[0]` を見るので、**2025の日程・会場を表示し続けていた**。
指摘されたページで日程が「AUG 16—17, 2025」だったのはこれが理由。

対応: `data/inbox/export/editions-2026-add.tsv`（2行 × 15列）を生成。
値はすべて `FESTIVALS` シートの現在値の転記で、推測は入れていない。
貼り付け後に `EDITIONS` へ2026回が入り、導出も通るようになる。

#### ついでに見つかったデータの傷

- **`global-ark` の `FESTIVALS.LAT` が `36.6976°`**（度記号付き）。
  `Number.isFinite(Number(LAT))` が false になるので地図リンクが
  座標ではなく文字列検索にフォールバックする。
  生成した TSV では `36.6976` にしたが、**FESTIVALS 側も直すこと**
- `LINEUPS` に `EDITION_ID = "festival-de-frue"`（年なし）の行が7つある。
  `EDITION_ID参照切れ` として捨てられている

#### 追記: 導出を通したら、同じ穴が LINEUPS 経路にも残っていた

`EDITIONS` に2026回を追加してもらい導出を通したところ、ビルドが
**`ARTIST_ID 参照切れ 22件`** で落ちた（waifu / arch / ala / matricaria）。

原因は §9-27 とまったく同じで、直した場所が違っただけだった。
`artistIds` は `raw.ARTISTS` から作るので **draft / archived も含む**。
`fetch-data.mjs` の正式な `LINEUPS` 経路はその ID をそのまま
`lineups.json` に残すが、`build-detail-pages.mjs` が読む `data.js` には
公開分しか無いので落ちる。§9-27 の修正は互換モード側の
`nameToArtist` にしか入っていなかった。

対応: 方針は §9-27 と同じ（「掲載したいアーティストのみ登録し、
それ以外は draft にする」以上、draft のアクトは `ACT_LABEL` として
名前だけ残るのが正しい）。**リンクは張らずに名前で出す。**
ここで行ごと捨てると出演者そのものが消えるので、名前は必ず残す。
20件が該当した（arch 12 / waifu 5 / ala 3）。

#### さらに: 入力の書き方が変わってリンクが15枠外れていた

同じ確認で、**私が触っていないフェスから19本のリンクが消えている**のを見つけた。
調べると `LINEUPS` シート側が `ARTIST_ID` 空 + `ACT_LABEL` 文字列に
変わっており（`the-star-festival-2026` / `transcendence-2026` /
`rainbow-disco-club-2026` / `99flags-2026`）、
CLIPZ・DJ HYPE・Powder・SHERELLE・upsammy など15枠が
**アーティスト詳細へのリンクと、アーティスト側の「出演フェス」逆引きを
同時に失っていた。**

互換モードは以前からこの名前解決をしている（`nameToArtist`）。
同じ規則を正式経路にも通し、**入力の書き方の違いで導線が消えないようにした。**
`b2b` / `live` は複合枠なので解決しない（互換モードと同一条件）。

残る4枠は編集判断による表記なので、そのままにした:

```
Antal & Hunee                       b2b の組
Dungeoneering (Albino Sound & Daigos)  メンバー註記
Space Drum Meditation - Live        ライブ註記
```

結果、リンク付き枠は **98 → 98**（差し引きゼロ）。
`check_regressions.py` は閾値を1つも下げずに通った。
**「閾値を下げれば通る」で済ませていたら、15本の導線を失ったまま
気づかなかった。**

### 9-47. Claude引き継ぎ: 座標正規化と年なしEDITION_ID（2026-08-06）

`global-ark` の FESTIVALS.LAT に付いていた度記号を、fetch時に数値へ正規化した。
入力元の値は変更せず、生成物側で `36.6976°` → `36.6976` とする。

LINEUPSの `festival-de-frue`（年なし）7行は、公開EDITIONSの唯一の候補
`festival-de-frue-2026` へ移送する。候補が複数ある場合は自動移送せず警告にする。
これにより出演者を黙って捨てず、曖昧な履歴参照は公開前に検出できる。

検証: FESTIVALS 93 / EDITIONS 97 / LINEUPS 434、参照エラー0。
回帰ガード、内部リンク、SW routing、Deploy `31069177224` は成功。

未実装: `festivals.html` の派生画像生成。原本同期と分離した派生ディレクトリ、
ハッシュmanifest、カード用途だけの参照切替を設計してから着手する。

### 9-48. フェスティバルカード画像の派生配信（2026-08-06）

`festivals.html` は一覧カードのために原本画像をそのまま読み込み、初回転送量が
約4.87MB（派生画像生成前の実測）になっていた。原本を変更せず、カード用途だけ
長辺960px・WebP quality 80の派生画像へ切り替えた。

- `scripts/build-image-derivatives.py` が `LP/images/festivals/*.webp` から生成
- 出力名は原本SHA-256先頭8桁を含め、原本変更時にURLが変わる
- `LP/image-derivatives.js` のmanifestを `tjCardAssetPath()` が参照
- manifestに無い画像は従来の原本へフォールバック（表示を壊さない）
- Drive同期後に派生画像、寸法表を同一コミットへ生成
- `check_image_derivatives.py` が原本・manifest・出力寸法を公開前に検査

59件の派生画像は約5.86MB。原本の約30.9%で、カード用途の転送量を抑えつつ、
詳細ヒーロー・フライヤー・未対応種類（artists/venues）の原本経路は変更しない。
ローカルのハブ実ブラウザ検査では壊れた画像0件、回帰ガードも通過した。

初回pushでは、回帰ジョブにPillowをインストールしていなかったため検査が失敗した。
依存を追加して解消した。またDrive同期ワークフローにコメントのインデント誤りが
あり、ジョブなしで失敗していたためYAMLを修正した。

### 9-49. Publish後のTOP一覧が古いdata.jsを表示する問題（2026-08-06）

詳細ページは新しい生成物なのにTOPのUpcoming Festivalsだけ古い並びになる事象を
確認した。原因はService Workerの `data.js` stale-while-revalidateで、初回表示時に
古いキャッシュを返してから裏で更新していたことだった。

`data.js` はCMSのPublish Nowが同じURLで更新するため、初回からネットワークを
優先し、ネットワーク障害時だけキャッシュへフォールバックする `networkFirst` に
変更した。Service Workerのキャッシュ世代も `v1.14.0` に更新し、
`check_sw_routing.mjs` の期待値も更新した。

Deploy `31074629244` は成功。これにより、Publish直後の初回TOP表示でも最新の
FESTIVALS一覧を取得できる。

### 9-50. Festival入力の公開前関門（2026-08-06）

Festival入力を増やす前の事故防止としてCMSに4つの関門を追加した。

- 保存時: FestivalのID、日付、座標、Edition年・日付・座標の形式と範囲を検証
- 既存行の編集も新規登録と同じ検証経路を通す
- Festival / Editionの役割をフォーム上に明示
- Publish前: 前回Publishの軽量スナップショットと比較し、FESTIVALS・EDITIONS等の
  追加、削除、変更、LINEUP件数を確認してから続行する

プレビューは既存のFestival詳細相当（ヒーロー、日程、会場、フライヤー、LINEUP、
開催履歴）を保存前に表示する経路を維持した。

Deploy `31075799271`、Lighthouse `31075883518` は成功。

### 9-47. 翌年へ更新すると開催回が壊れる（CMS / 2026-08-07）

「毎回2025年のフェスを2026年に更新するとき、2026の情報を入れると
Edition がエラーになる」という報告から。原因は1つではなく、
`LP/cms.js` の開催回まわりに**5つ**あった。
§9-46 で loa-lost-paradise / global-ark に2026回が無かったのも、
元をたどればここに行き着く。

#### A. FESTIVALS の DATE を翌年にすると、過去回が書き換わっていた

`syncFestivalDateToLatestEdition()` は「最新の開催回」に**無条件で**
DATE を書いていた。2025回しか無いフェスの DATE を2026にすると、
**2025回の `DATE_START` が2026に化ける。**
`EDITION` は "2025" のままなので、`EDITION_ID = xxx-2025` なのに
日程は2026、という行ができ、過去回の記録が消える。

AGENTS.md が明文で禁じている
「FESTIVALS の `DATE` を翌年へ上書きして過去回を消してはいけない」を、
**CMS が保存のたびに自動でやっていた。**

対応: 同じ年の開催回がある場合だけ同期する。無ければ触らず、
「次回開催を作成」を促すトーストを出す。ここで勝手に回を作らないのは、
会場・チケット・フライヤーが未確認のまま公開されうるため。
保存前検査にも「年と日程の年が食い違う行」を足した。

#### B. 新規開催回が、別のフェスの行を上書きしていた

`syncNewEditionRows()` の追記位置:

```js
let nextEditionRow = Math.max(1, ...editionSheetRows.map(r => Number(r._row)||0)) + 1;
```

`editionSheetRows` は `loadEditionsFromSheet()` が
**編集中フェスで絞り込んだ**配列である。
そこから最大行+1 を出すと、シートの末尾ではなく
**そのフェスの行の直後**を指す。54行目にしか行が無いフェスなら 55行目、
つまり**無関係なフェスの開催回に上書きする。**

幸い実データに被害は無かった（`EDITION_ID` の重複0件・
`EDITION_ID ≠ FESTIVAL_ID-EDITION` 0件を確認）。
C の理由で、この経路がそもそも成功していなかったためと思われる。

対応: シート全体の末尾を `editionSheetMaxRow` として別に持つ。

#### C. 開催回が1つも無いフェスは、永久に1つも作れなかった

```js
if (!editionSheetRows.length) return Promise.reject(new Error('EDITIONSシートが未読込'));
```

見ているのは「**このフェスに開催回があるか**」なのに、
エラー文言は「**シートが読めていない**」になっている。
開催回ゼロのフェスで保存すると必ずここで落ち、
`FESTIVALSは保存済みですが、新規EDITIONSの追加に失敗しました` が出る。
`loadEditionsFromSheet()` 側も `if(!editionSheetRows.length) return;` で
早期に抜けており、読込済みフラグが立たなかった。

対応: `editionSheetLoaded` を分けて、判定を
「シートを読めたか」に変えた。

#### D. 新規開催回の PREF が空固定だった

```js
LOCATION:e.location||'', LOCATION_JA:e.location_ja||'', VENUE_ID:'', PREF:'', ...
```

そもそも開催回オブジェクトに `pref` / `venueId` のキーが無く、
UI にも入力欄が無かった。詳細ページの地域表示は
`currentEdition?.PREF || f.city` なので FESTIVALS.CITY に落ちて
見た目は繕えていたが、EDITIONS 単体では県が分からない行が増え続けていた。

対応: 開催回に `pref` / `venueId` を持たせ、シートから読み、
「次回開催を作成」で引き継ぎ、UI に Pref 欄を出した。
新規行の既定値はフォームの CITY。

#### E. 同じ画面で2回保存すると、直前に足した回を上書きしていた

追記後に末尾位置を進めていなかったため、
2回目の保存が同じ行番号を再利用していた。

#### 検査

`scripts/check_cms_editions.mjs`（新規）。
**cms.html は読み込み時に `prompt('CMS Password:')` を出すので
headless ブラウザでは固まる**（§9-44 で実測。CDP が45秒でタイムアウト）。
検査できない場所は「壊れても誰も気づかない場所」になるので、
`cms.js` だけを VM に読み込み、DOM と `fetch` を差し替えて関数を直接叩く。
`const` / `let` はグローバルに載らないので、末尾に橋渡しを足して参照する。

負のコントロール（修正前の `cms.js` で同じ検査を回す）:

```
DATEを2026にしても2025回の日程を書き換えない      ❌ 2026-08-15/2026-08-16 に化けた
新規開催回はシート全体の末尾(99)に書く             ❌ row=55（別フェスの行）
新規LINEUPも全体の末尾(401)に書く                ❌ row=201
新規開催回に PREF が入る                        ❌ PREF=""
開催回ゼロのフェスでも新規追加できる                ❌ EDITIONSシートが未読込
2回続けて保存しても行が衝突しない                  ❌ 書き込みなし
→ 8件中6件が失敗。修正後は全8件通過。
```

`publish-pipeline.yml` / `regression-check.yml` に組み込んだ。

### 9-48. 開催回ごとのフライヤーが死蔵されていた（2026-08-07）

`EDITIONS.FLYER` は CMS にアップロード欄があり、シートにも保存されていたが、
**どこにも表示されていなかった。** 詳細ページのフライヤーは
`FESTIVALS.FLYER`（フェス共通の1枚）だけを見ていた。
26件が入力済みで、すべて画面に出ていなかった。

フライヤーは本来「その年のもの」なので、開催回側を優先する。

#### 拡張子が実体とずれていた

採用にあたって実ファイルを確かめたところ、**26件中15件が存在しなかった。**
すべて `.jpg` で、同名の `.webp` は在った。

原因は取り込み経路にある。CMS の「Image from URL」が原本(jpg/png/heic)を
Drive に置き、`sync-drive-images.yml` が**同名の .webp に変換して**取り込む。
このときシートの `FLYER` は原本の名前のまま残る。
サイトが配信するのは webp だけなので（AGENTS.md「ビルド運用の注意」）、
**同名の .webp が在るならそれが実体**である。推測ではなく変換規則そのもの。

`resolveImagePath()` で `.jpg/.png/.heic → .webp` を試し、
読み替えた件数をビルドログに必ず出す（シート側を直せば読み替えは不要になる）。
実体が見つからない場合はフェス共通のフライヤーへ落とし、これも件数を出す。
**黙って落とすと「入れたのに出ない」が続く。**

#### 効果

現時点で **26件すべて同じ画像**（開催回のフライヤー＝フェス共通のフライヤー）
だったため、**見た目は変わっていない。**変わったのは `alt` 属性が
「ARCH Flyer」→「ARCH 2026 Flyer」と年を含むようになった点だけ。

効いてくるのは次に年ごとのフライヤーを入れたときで、
それまで無視されていた入力が反映されるようになる。

動作は実測で確かめた（`arch-2026` の `FLYER` を一時的に別画像へ向け、
詳細ページがその画像を出すこと・寸法属性も追随することを確認して戻した）。

#### 残っている申し送り

- シートの `EDITIONS.FLYER` 15件は拡張子が `.jpg` のまま。
  表示はビルド側で吸収しているが、**シートを `.webp` に直せば読み替えは不要**
- `EDITIONS.VENUE_ID` は CMS から書けるようにしたが、まだ表示に使っていない

### 9-49. ファビコンがサイト全体で1つも無かった（2026-08-07）

Google の検索結果にロゴではなく既定の地球アイコンが出ている、という指摘から。
ロゴの問題ではなく、**サイト全体でファビコンの宣言が1つも無かった。**

```
/favicon.ico                        → 404
rel="icon" を持つページ             → 449中1（本番未公開の LP/app/ のみ）
```

`manifest.json` には PWA 用の `icons` があるが、
**Google は検索結果のファビコンにあれを使わない。**
`/favicon.ico` か `<link rel="icon">` のどちらかが要る。
どちらも無かったので、出しようが無かった。

#### 用意したもの

| ファイル | 用途 |
|---|---|
| `/favicon.ico` | Google が最初に見に行く場所。16/32/48px を1ファイルに |
| `/images/favicon-192.png` | Google の条件「正方形・48pxの倍数」を満たす明示宣言用 |
| `/apple-touch-icon.png` | iOS のホーム画面用（180px） |

画像は `logo-512.png` から**マーク部分だけを切り出した**もの。
ロゴには下に `TECHNO JAPAN` の文字があるが、16px では必ず潰れるうえ、
文字を入れるとその分マークが小さくなって判別できなくなる。
実測（16px を拡大して確認）のうえでマークのみにした。

宣言は全449ページに入れた。生成物は `build-detail-pages.mjs` の
`FAVICON_TAGS`、手管理のハブ等21ページは直接。

#### 確認

`robots.txt` は `/favicon.ico` を拒否していない
（`Disallow` は `/cms.html` と `/map.html` のみ）。

ブラウザで実際に描画して取得できることを確かめた
（宣言が在るだけ・ファイルが在るだけでは、CSP の `img-src` で
止まる可能性が残るため）:

```
festivals.html / index.html / 詳細ページ / EN ハブ いずれも
  /favicon.ico=200  /images/favicon-192.png=200  /apple-touch-icon.png=200
```

**反映には Google の再クロールが必要で、置いてすぐには変わらない。**
数日〜数週間かかる。Search Console で再クロールを促せる。

### 9-50. デプロイの途中中断で公開が消える（2026-08-07）

「デプロイが重なったりエラーになったりする」という相談。1日の実行履歴を
見ると、症状は2つに分かれた。

#### 症状1: `failure` の正体は GitHub 側の一時障害

失敗した run はどれも `Set up job` の段階で落ちており、ログは
`Failed to resolve action download info: Internal Server Error` /
`Service Unavailable`。これは checkout などの action を GitHub が配れなかった
だけで、**こちらのコードとは無関係**。一時的なもので再実行すれば通る。

#### 症状2: `cancelled` が本当の問題 — 良いデプロイが途中で消えていた

`deploy-pages.yml` / `publish-pipeline.yml` はどちらも
`concurrency: { group: pages, cancel-in-progress: true }` だった。
`true` は「同じグループの実行中を、新しい run が来たら kill する」。

これが §9-49 のファビノンが公開されなかった直接原因:

```
1. ファビコンのデプロイが動き出す
2. 直後に別コミットが push され、動いていたデプロイを途中で kill
3. その別コミットは `cms: publish`（deploy-pages では if でスキップ）
4. → 誰も何も公開しないまま終わる
```

`concurrency` のキャンセルは**ジョブの `if` 判定より前**に効くので、
スキップされる運命の run でも、実行中の本物のデプロイを道連れにする。
GitHub 側の一時障害で後続が落ちた場合も同じで、
**殺した後に公開できないと、前の良いデプロイごと失われる。**

#### 対応: `cancel-in-progress: false`

実行中は最後まで完走させる。GitHub 仕様での false の挙動:

- 実行中の run は絶対に kill されない（完走する）
- push が重なると新しい run が pending になり、
  **それより前の pending は自動キャンセルされる**
- → 「実行中1本 ＋ 最新の待機1本」だけが残る

つまり **latest は必ず後で公開され、かつデプロイが N 本積み上がらない。**
今後 `cancelled` と出るのは「まだ始まってもいない pending が最新に
差し替えられた」ケースだけで、実行中の作業が失われることは無くなる。

`true` の狙い（古い内容を公開しない）は false でも保たれる ──
静的サイトで各デプロイは全ツリーをアップロードするので、
最後に完走した run の内容＝最新で確定する。

#### 二重起動は実害が無いことも確認

`deploy-pages`（paths: `LP/**` ほか）と `publish-pipeline`（paths: `LP/data.js`）が
同じ push で両方走るのは「data.js と他ファイルを同時に変える push」だけ。
実履歴では data.js を変えるのは `cms: publish`（data.js 単独）のみで、
他コミットは data.js を触らない。二重起動はほぼ発生せず、
起きても同じ `pages` グループで直列化される。今回は触らない。

### 9-51. 詳細ページの関連カードが原寸を読んでいた（2026-08-07）

§9-45 の宿題「festivals.html が 4.87MB」は、その後 Codex が
カード用縮小画像（`build-image-derivatives.py` / `image-derivatives.js` /
`tjCardAssetPath`）を入れて **1.80MB** まで下がっていた。
残りを詰めるにあたって実測し直したところ、**別のところが増えていた。**

#### 詳細ページが 0.48MB → 1.07MB に増えていた

`festivals/ala.html` の内訳:

```
  137 KB  ala.webp（ヒーロー）
   59 KB  ala-flyer.webp
  185 KB  bondisco.webp          ┐
  153 KB  forest-sound-camp.webp │ 下部の「関連フェス」カード4枚
  263 KB  global-ark.webp        │ すべて原寸
  249 KB  loa-lost-paradise.webp ┘
```

縮小画像の差し替えは `tjCardAssetPath`（ブラウザ側の JS）で行っており、
**静的生成の詳細ページには効かない。** 新しいフェスが増えて関連カードが
埋まったぶん、そのまま原寸が増えていた。

対応: `build-detail-pages.mjs` でも `image-derivatives.js` の対応表を読み、
関連カードを縮小版にした（`loadCardDerivatives` / `cardImagePath`）。
**1.07MB → 0.66MB。**

#### srcset は「実測してから」でないと逆効果

転送量をさらに削るため 480px 版を足して `srcset` を入れたが、
**表示幅を測らずに `sizes` を書いたら画質が落ちた。**

| 場所 | 実測表示幅 | 適正 |
|---|---|---|
| `festivals.html` のカード | モバイル452px / PC **848px** | 960px（lg） |
| 詳細ページの関連カード | **324px** | 480px（sm） |

一覧のカードは「小さなサムネイル」ではなく大きなビジュアルで、
960px がちょうど良い。ここに `sizes="...480px"` と書いたところ、
PC で 480px 版が選ばれて **848px の枠に 480px を引き伸ばす**状態になった。

`sizes` は実際の表示幅の宣言であって、希望を書く場所ではない。
**実測より小さく書けば、ブラウザは正直に小さい画像を選んでぼやける。**

結論として `srcset` は関連カード（324px）にだけ残し、
一覧カードからは撤回した。`localize.js` の `tjCardSrcsetAttr` に
「一覧ハブでは使わないこと」と実測値つきで書いた。

#### 検査2つを新形式に追随させた

manifest を `{src, srcset:[[path,幅],...]}` に変えたので、既存検査が壊れた。

- `check_regressions.py` の `broken_image_refs` が **14件の誤検出**。
  `srcset="a.webp 480w, b.webp 960w"` を1本のパスとして扱い、
  幅指定やカンマごとファイル名と見なしていた。
  srcset だけ先に分解してから同じ検査にかけるようにした
- `check_image_derivatives.py`（Codex 作）が旧形式（文字列）前提で
  `TypeError` で落ちていた。両形式を受けるようにしたうえで、
  **srcset の幅宣言が実体と一致するか**の検証を足した。
  ここがずれると、ぼやけ（小さいのに大きいと宣言）か
  無駄な転送（逆）が起きるが、目視では気づけない
  *負のコントロール: 宣言を 480 → 900 に改ざんすると検出した*

#### 現状と、ここから先

```
index.html          2.82MB → 0.80MB
festivals.html      4.87MB → 1.80MB
festivals/ala.html  0.48MB → 0.66MB（一時 1.07MB まで増えたのを戻した）
artists.html        0.53MB → 0.12MB
```

**festivals.html の 1.80MB はほぼ下限。** 画像14枚 × 平均120KB で、
1枚ずつは 960px と適正。これ以上削るには
「カードを小さくする」「画質を下げる」「初期表示の枚数を減らす」の
いずれかで、**デザインの判断が要る**ため手を付けていない。

### 9-52. ARTICLE の Author を候補つき入力にした（2026-08-07）

CMS の ARTICLE 編集で Author が素の自由入力だった
（`placeholder="e.g. TECHNO JAPAN"`）。

自由入力なので、同じ人が「TECHNO JAPAN」「Techno Japan」「テクノジャパン」と
**表記ゆれしたまま溜まっていく。** 記事一覧・記事詳細にはその文字列が
そのまま出るので、ゆれると読者には別人に見える。
`AUTHORS` シートは既にあり `ar-authorId` のドロップダウンも用意されていたが、
**表示に使われるのは `ar-author` の自由入力のほう**で、両者が連動していなかった。

#### 候補の出どころは2つ

1. `AUTHORS` シートに登録された執筆者（正式な表記）
2. **これまでの記事で実際に使われた author 名**

2 が要る。シートに未登録の書き手でも、一度使った表記に揃えられる。
既存記事は `listCache.article`（`loadList` が貯めた行）から読む。

#### 入力値は候補に強制しない

クリックしたときだけ置き換える。アーティスト候補と同じ方針で、
**入力中の文字列を勝手に候補へ変換しない**（`filterArtists` のコメント参照）。
入力値と完全一致する候補は出さない（出す意味がない）。

#### 検査

`scripts/check_cms_authors.mjs`（新規）。
cms.html は読み込み時に `prompt()` を出して headless では固まるため
（§9-44 で実測）、`cms.js` だけを VM に読み込んで DOM と `fetch` を
差し替えて関数を直接叩く（§9-47 の `check_cms_editions.mjs` と同じ方式）。

守る性質は7つ ── 候補が出る / 重複しない / 前方一致が先 /
クリックで入る / 入力値と同じ候補は出さない / 入力を勝手に変えない /
AUTHORS が空でも壊れない。

*負のコントロール: 「過去の記事から候補を集める」行を消すと2件失敗した。*

`publish-pipeline.yml` / `regression-check.yml` に組み込み。

#### 実装中に見つけたこと

候補を閉じるとき `classList.remove('show')` だけで `innerHTML` を
残していると、次に開いた瞬間に古い候補が一瞬見える
（描画より先に `show` が付くため）。閉じるときに中身も消すようにした。

### 9-53. セッション失効で機能が1つずつ静かに死ぬ（2026-08-07）

「ARTICLE の翻訳機能がとまってた」という報告。翻訳のコードは壊れておらず、
**セッショントークンの失効**だった。

#### なぜ気づけないか

GAS のセッションは時間で失効する。失効後に投げると
`{status:'error', message:'Invalid auth token'}` が返るが、
**HTTP は 200** なので `fetch` は成功として扱う。
呼び出し側が message を個別に見ないと気づけない。

画面はログイン済みに見えたままなので、利用者からは
「その機能だけ壊れた」としか映らない。全体が落ちるより厄介で、
**どこから直せばいいのか分からない**。

#### 回復処理が1経路にしか入っていなかった

失効を検出して入り直す `gasPostJson_` は既にあったが、
通っていたのは**画像アップロードだけ**だった。

```
gasPostJson_ 経由（回復する）  : 画像アップロード 7箇所
素の fetch（回復しない）       : 翻訳 / AI生成 / AI要約 / 保存 / 削除 /
                                 開催回の同期 / Publish ほか 16箇所
```

翻訳はこの「回復しない」側だった。

#### 入口で1回だけ回復させる

呼び出し箇所を1つずつ直しても、**次に足したものが漏れる**。
`window.fetch` のラッパ（元々トークンを差し込んでいた場所）で、
失効応答を受けたら入り直して同じ要求を投げ直すようにした。
以後どこから呼んでも同じように回復する。

実装上の注意:

- 本文を読むと stream が消費されるので `clone()` を検査に使う
- JSON でない応答（HTML エラーページ等）は素通しする
- **再試行は1回だけ。** 直らなければ呼び出し側にそのまま返す。
  握りつぶして成功に見せない
- `login` 自体は `AUTH_TOKEN` が無い状態で呼ばれるので対象外
  （再帰しない）

あわせて、翻訳・AI生成・AI要約・保存・削除の5経路は
`gasPostJson_` 経由に揃えた（応答の解釈も1箇所になる）。

#### 検査

`scripts/check_cms_auth_retry.mjs`（新規）。
失効応答を返す偽の GAS を差し込み、8項目を見る:

```
失効したら入り直して投げ直す / 投げ直しは1回だけ /
新しいトークンを載せる / 無限ループしない /
直らないときは握りつぶさない / 正常時は再ログインしない /
GAS 以外にトークンを付けない / GET はクエリに載せる
```

*負のコントロール: 入口の回復処理を1行外すと4件失敗した。*

`publish-pipeline.yml` / `regression-check.yml` に組み込み。

### 9-54. AI 機能は Google ではなく Claude だった／打ち切りが成功扱いだった（2026-08-07）

「Google の API を使わずに翻訳する方法はあるか」「DeepL に変更する」
という相談から、GAS の中身を確認した。

#### 前提が違っていた

**Google の API はどこにも使われていなかった。**

| 機能 | 実体 |
|---|---|
| `ai_translate` → `aiTranslateV2_` | Anthropic Claude（`claude-sonnet-5`） |
| `ai_summarize` → `aiSummarize` | Anthropic Claude（`claude-haiku-4-5`） |

DeepL への移行は**必要が無かった**ので取りやめた。
むしろ既存の system prompt は
「アンダーグラウンド・テクノ／ハウス誌のプロ翻訳者として訳す」
「固有名詞はそのまま残す」「HTML のタグと属性は保持する」
と作り込まれており、DeepL に替えると**この文体指定が失われる**。
翻訳専用サービスには渡せない情報だった。

**GAS の中身がリポジトリに無いことが、この遠回りの原因。**
clasp も使っていないため、何を使っているか誰も確認できない状態だった。

#### 見つかった不具合

**1. 上限で打ち切られた結果を「成功」として返していた（重要）**

CMS は本文を 12,000文字まで送るのに、翻訳の `max_tokens` は 8,000 だった。
長い記事は英訳が途中で終わるが、**API は 200 を返す**ので、
旧コードは切れた文字列をそのまま `status:'ok'` で CMS に渡していた。
本文は HTML なので、**タグの途中で切れて表示が崩れる。**

Claude は打ち切り時に `stop_reason: 'max_tokens'` を返す。
推測せずこれを見て、エラーとして返すようにした。
**「黙って壊れたものを渡す」より「できなかったと言う」を選ぶ。**

**2. 要約が HTTP ステータスを見ていなかった**

`json.error` だけを見ていたため、`error` フィールドを持たない失敗応答
（502 等）では `content` が undefined になり、
空文字を `status:'ok'` として返していた。

**3. エラー文言が存在しないキー名を案内していた**

実際に読むのは `ANTHROPIC_API_KEY` なのに `'CLAUDE_API_KEY not set'`
と出ていた。未設定時に存在しない名前を探させることになる。
翻訳側は正しかったので、要約側だけの書き間違い。

#### 対応

`scripts/gas-update/ai-claude-opus5.gs` に貼り替え用コードを置いた
（既存の `trigger-image-sync.gs` と同じ運用）。

- モデルを `claude-opus-5` に統一（依頼による）
- Claude 呼び出しを `callClaude_` に集約。打ち切り・HTTPエラー・空応答を
  **1箇所で**見る。個別に書くと今回のように片方だけ見落とす
- `MAX_TOKENS_TRANSLATE = 16000`

申し送り: Opus は Haiku より遅い。タイトル候補のような
「押してすぐ欲しい」操作は体感が変わる。速度を優先するなら
要約側だけ Haiku に戻してよい。

#### 検査

`scripts/check_gas_ai.mjs`（新規）。
`PropertiesService` / `UrlFetchApp` を差し替えて Node 上で動かす。
**GAS に貼る前に間違いを見つけるための検査**であって、
本番の Apps Script が同じ内容である保証はしない（そこは人が貼る）。

12項目を検証。*負のコントロール: 打ち切り検知を1行外すと該当項目が失敗した。*

`publish-pipeline.yml` / `regression-check.yml` に組み込み。

### 9-55. 記事とフェスの紐づけが片方向だった（2026-08-08）

「ARTICLE の関連フェスティバルはアクティブになってる？」という質問から。

**紐づけ（`ARTICLES.festivalId`）自体は前からあったが、
使っていたのはフェス側だけだった。**

```
フェス詳細 → 「RELATED STORIES」で記事を出す     あった
記事詳細   → 関連フェスへの導線                  無かった
```

詳細 → 詳細が繋がらない形で、§9-23 で回遊が切れたときと同じ。対にした。

#### さらに、どちらの向きにも何も出ていなかった

**全記事の `festivalId` が空だった。** CMS の入力欄（フェス名で検索するピッカー）も
保存処理（`cms.js` の payload）も生きているのに、値が入っていないため
**フェス側の「RELATED STORIES」も表示されていなかった。**
機能が無いのではなく、使われていなかった。

#### 実装

`articlePage()` に `festivals` と `editionsByFestival` を渡し、
記事下部（`article-footer` の直前）にカードを出す。
日程・会場は**開催回の最新**から取る（フェス詳細と同じ規則）。
画像はカード用の縮小版（§9-51）。

**スタイルは新規に書いた。** 既存の `.related-card` 系は
`.festival-design-v2` 配下にしか無く、記事ページ（`.article-detail`）には効かない。
共通化も考えたが、フェス側は3〜4枚を横に並べるグリッド、
記事側は1枚だけで幅の扱いが違うため、**無理に1本化しなかった。**

実測（headless Chrome）:

```
PC(1440px)   カード420px / 画像420x315 / 実体360px / → /festivals/transcendence.html
スマホ(412px) カード436px（上限解除）/ 実体500px
EN版          → /en/festivals/transcendence.html
```

#### 並行作業の扱い

実装した時点で `LP/detail.css` と `build-detail-pages.mjs` を
別セッション（Codex）がアニメーション演出のために編集中だった。
同一ファイルに両者の変更が同居し、**自分の分だけを切り出せない。**

利用者と相談して「相手の作業を待つ」を選び、
自分の変更を巻き戻して `reports/` に保管した。
完了連絡を受けてから、**先に Codex の作業を独立したコミットにし**、
そのうえで自分の実装を戻した。混ぜてコミットしない。

#### 途中で見つけた別の問題: `HANDOFF.md` と `handoff.md`

macOS はファイル名の大文字小文字を区別しないため両者は同一ファイルだが、
git が追跡しているのは `HANDOFF.md` だけ。
`git add handoff.md` は**何も stage しない**。
2026-08-07 の申し送りコミットは、これで**追記が丸ごと漏れていた**
（コミットは成功し、`reports/` の1ファイルだけが入った）。

エラーも警告も出ないので気づけない。**`HANDOFF.md`（大文字）で指定すること。**

#### ARTICLE の Views について

同時に「Views を自動反映したい」と相談を受けたが、
**出自を辿ったらサンプルデータだった。**

2026-04-15（`b1aefe1`）に記事一覧を作った際、画面確認用の架空値
（`views: 2400` / `3100` など）として入っていたものを、
CMS 化のときにそのまま入力欄にしたもの。同時期の `readTime` も同じ。
目的があって設計された項目ではない。

現在の用途は記事一覧の「人気順」の並び替えのみで、根拠は手入力の `1500`。
記事が1本しかないため並び替えとしても機能していない。
自動化するなら GA（導入済み・実数が溜まっている）から日次で取り込む案が
現実的だが、**記事が増えてからでよい**と判断して見送った。

### 9-56. 本文の貼り付け・メンションで表示位置が戻る（2026-08-08 / 未解決）

「BODY に貼り付けやメンションをすると、毎回本文の一番上に戻る」という報告。
**headless では再現できなかった。** 対処は入れたが、原因は特定できていない。

#### 外れた仮説（すべて実測で否定）

1. **Quill の `scrollingContainer` 未指定**
   既定は `this.options.scrollingContainer || this.root`。
   このCMSは `body{overflow:hidden}` で `.main` が動くので、
   「見当違いの要素を復元している」と考えた。
   → **`.ql-editor` は Quill 標準CSSで `overflow-y:auto` を持つ。**
   エディタ自身がスクロールするので既定で正しい。`.main` に変える修正は
   むしろ逆効果だったので撤回した。

2. **プレビュー欄の `innerHTML` 差し替え**
   `.ar-preview` は `max-height:600px; overflow-y:auto` で自前スクロールする。
   → 実測 0px。Chrome は同等の内容なら scrollTop を保つ。

3. **選択位置の消失**（ボタン押下でフォーカスが外れ index 0 に戻る）
   → 実測。blur 後も `getSelection(true)` は元の位置(400)を返した。

4. **貼り付け時のズレ 70px**
   一度は再現したが、計測をやり直したところ
   **テスト手順で先に呼んでいた `setSelection` が動かしていた**もので、
   貼り付け自体は動かしていなかった。Quill の onPaste は
   `scrollingContainer.scrollTop` を保存・復元しており正しく効いている。

#### 利用者からの追加情報

- 動くのは**本文の中だけ**（ページ全体ではない）
- **貼り付け（文字・画像）・@メンション・ボタンからのリンク挿入、すべてで起きる**
- **集中モードでも起きる**

「すべての操作で起きる」なら共通経路は `text-change` →
`scheduleArticleEditorSync` だが、この経路はエディタのDOMを触っていない
（`normalizeArticleHtml` は detached な div を使う）。ここも合致しない。

#### 入れた対処

原因を特定できていないので、**症状を打ち消す**方針にした。
`preserveArticleScroll()` で、挿入・貼り付けの前後に
スクロール位置を保存して戻す。対象は状況で変わるため3つとも見る:

```
通常       .main（body は overflow:hidden）
集中モード  .ar-editor-wrap（position:fixed + overflow-y:auto）
どちらでも  .ql-editor（内容が高さを超えたとき）
```

復元を「同期・rAF・80ms」の3回に分けているのは、
Quill が同期と非同期の両方で動かすため。

**入力位置が画面外へ消える心配は無い。** 貼り付け前に見えていた位置へ
戻すだけなので、貼り付け後もその位置は見えている。

#### 申し送り

**これで直る保証は無い。** 再現できていない以上、
利用者に実機で確認してもらう必要がある。
直らない場合、次に見るべきは:

- ブラウザ拡張やIME（headless には無い要素）
- `ar-body`（textarea）が実は表示されていて、`value` 代入で
  スクロールが動いている可能性
- 画像貼り付け時の `uploadArticleImageFile` → 挿入経路（未検証）

### 9-57. LINEUP に日本語名が打てない／未登録アーティストを登録できない（2026-08-08）

「FESTIVAL の LINEUP で YAMA が ARTIST に入らない、レコメンドのせいで
入力できない」という報告。**別々の2つの問題**だった。

#### ① 日本語入力の変換確定 Enter を拾っていた ← 「入力できない」の正体

`acKeydown` は Enter を「入力終わり」として扱い、その時点の文字列を
`?タグ` として LINEUP に積む。しかし **IME で変換中の Enter は
「変換を確定する」操作**であって、入力を終える操作ではない。

「やま」と打って変換確定のつもりで Enter を押すと、
**変換途中の「やま」がそのまま登録され、続きが打てなくなる。**
日本語のアーティスト名では毎回起きる。

対応: `e.isComposing || e.keyCode === 229` のときは何もしない。
`isComposing` は変換中に true、229 は古いブラウザの同等表現。

*負のコントロール: この1行を外すと「?やま」が積まれることを確認。*

#### ② 「ARTIST に入らない」は仕様どおりだった

未照合の表記は `?タグ` のまま保存され、ARTISTS には登録されない。
自動登録は §9-25 で無効化されている ── ID から名前を機械復元した結果、
`TKO→Tko` / `HAAi→Haai` / `Ben UFO→Ben Ufo` / `Adhémar→Adh Mar` のように
**100件中30件の公式表記を壊した**ため。

自動登録は復活させない。代わりに **未照合タグの下に
「＋「YAMA」を新規登録」ボタン**を出し、1件ずつ明示的に登録できるようにした。

**NAME は打った表記をそのまま使う。** ID だけ名前から生成する。
§9-25 の再発を防ぐため、検査でも `Ben UFO` が `Ben Ufo` にならないことを見る。
既存 ID と衝突する場合は登録せず、候補の採用を促す。

#### 誤解だったもの

「レコメンドが入力を置き換える」は**起きていなかった。**
`filterArtists` は候補を表示するだけで、採用はクリック時のみ。
`YAMA` と打って Enter を押せば `?YAMA` が入る（実測で確認）。
症状の実体は①だった。

#### 検査

`scripts/check_cms_lineup.mjs`（新規、CI 組込）。9項目:

```
YAMA を打って Enter でそのまま入る / IME変換中の Enter で確定させない /
候補が出ていても入力値が優先される / 前の選択状態で暴発しない /
未照合タグに新規登録ボタンが出る / 候補ボタンも併存する /
打った表記のまま NAME に入る / 登録後タグが照合済みになる /
既存IDと衝突したら登録しない
```

*負のコントロール: IMEガードと表記保持を壊すと2件失敗した。*

#### 並行作業の扱い

`cms.js` / `cms.html` / `cms.css` を別セッション（Codex）が
記事画像のレイアウト機能で編集中だった。前回（§9-55）と同じく、
**先に Codex の作業を独立したコミットにしてから**自分の分を載せた。
混ぜてコミットしない。

### 9-58. デプロイと Publish が繰り返し失敗する構造（2026-08-08）

「何度修正してもデプロイがエラーになる。Publish Now は毎回落ちる」
という指摘。**直近40件の実行を1件ずつ開いて失敗段階を集計した。**
推測ではなく実測から原因を3つに切り分けた。

```
失敗6件の内訳（Lighthouse の skipped は除く）
  Publish pipeline  1件  Fetch data from spreadsheet
  Deploy            3件  Check asset cache busting
  Deploy            2件  生成物のズレ
```

#### ① Publish Now が毎回落ちる — EDITIONS に重複26行

```
✗ EDITIONS: ID重複 "circus-2025"（行 69, 106, 108, 110, 118）
… 10種類 / 26行。重複はすべて末尾（99行以降）に追記されていた。
```

**原因は CMS の「黙って握りつぶす」実装。**

```js
if(er.status!=='ok'||!Array.isArray(er.rows)) return;   // 黙って抜ける
}catch(_){ /* 旧JSONのフォールバックを維持 */ }           // 黙って握りつぶす
```

シートの読み込みに失敗すると、開催回は「シートのどの行か」（`_row`）を
持たないまま残る。`syncNewEditionRows` は `!e._row` を「新規」と判定するため、
**保存のたびに全開催回が末尾へ追記される。** 読み込み失敗が起きた回数だけ
重複が積み上がる（circus-2025 が5行あるのはこのため）。

しかも重複10種類のうち**9種類は中身が食い違う**（会場名・県が入っている方と
空の方がある）。機械的な削除はできない。

対応3点:

1. **読み込み失敗を黙って飲み込まない。** 失敗を記録してトーストを出す
2. **失敗したまま保存させない。** 開催回がある状態で未読込なら保存を止める。
   「保存できたのにデータが壊れる」より「保存できないと分かる」を選ぶ
3. **年度ごとの上書き（upsert）にする。** `EDITION_ID = {festivalId}-{年}` は
   シート上で必ず1行。`_row` を知っているかではなく **ID が既にあるか**で
   判定し、あればその行を書き換える。利用者の提案どおり

#### ② デプロイ失敗3件 — 直したつもりが毎回戻っていた

`article-fx.js` / `article-fx.css` の `?v` 据え置きで3回落ちた。
**手で HTML の `?v` を上げても直らなかった。**

```js
extraScripts: '\n<link rel="stylesheet" href="/article-fx.css?v=1">\n'
            + '<script src="/article-fx.js?v=2" defer></script>'
```

生成側が版を**文字列で埋めていた**ため、HTML を直しても
**次のビルドで元に戻る。**

検査（`check_asset_versions.py`）は毎回正しく落としていた。
問題は**落ちる場所（HTML の `?v`）と直すべき場所（生成側の定数）が
ずれていた**こと。検査が「何を直せばいいか」を示せていなかった。

対応: `ARTICLE_FX_JS_VERSION` 等の定数にした。
`common.js` / `common.css` / `lang-toggle.js` も同じ構造だったので、
**壊れる前にまとめて定数化**した。

`scripts/check_no_hardcoded_versions.py`（新規）で
生成スクリプトへのべた書きを禁止する。
*負のコントロール: 1箇所べた書きに戻すと検出した。*

#### ③ `?v` を手作業から外す

`scripts/bump_asset_versions.py`（新規）。
`origin/main` から中身が変わった JS/CSS を探し、参照している HTML の
`?v` を**最大値+1 に揃えて**上げる（ファイルごとに +1 すると番号が割れる。§9-44 E）。

`data.js`（Publish のたびに変わる・SWR）と、生成物
（`image-dimensions.js` / `image-derivatives.js`。それぞれの生成側が上げる）は
対象外にしてある。

**検出する側は残したまま、上げる作業だけ手から外す。**
「人が覚えておく」前提の運用は続かなかった、というのが今回の教訓。

#### 残っている作業（利用者の判断が要る）

**EDITIONS の重複26行の整理。** 中身が9種類で食い違うため、
どちらを残すかは編集判断。照合表を出して選んでもらう。
これが片付くまで Publish Now は落ち続ける。
