# TECHNO JAPAN — Handoff (2026-05-05 更新)

> **運用移行のお知らせ（2026-08-04）**
>
> 現在のセッション間引き継ぎは [reports/handoff.md](reports/handoff.md) を使用してください。
> 本ファイルは2026-05-05時点のプロジェクト概要・過去資料として保持しています。
> 新しい作業状態、コミット、検証結果、未確認パターンはここに追記せず、`reports/handoff.md`へ記録してください。

このドキュメントは、次のClaude（または開発者）セッションで引き継ぐための情報をまとめています。

---

## プロジェクト概要

- **サイト**: https://techno-japan.media
- **目的**: 日本のアンダーグラウンド・テクノ／ハウスシーンを発信するメディアプラットフォーム
- **構成**: バニラHTML/CSS/JS のマルチページ（GitHub Pages配信）
- **CMS**: GAS（Google Apps Script）+ Google Spreadsheet → `LP/data.js` に同期
- **計測**: GA4 (`G-4MHCNR7D26`) / Search Console
- **Instagram連携**: Behold.so（@techno.japan_）

## アカウント・キー情報

```
本番ドメイン: techno-japan.media (GitHub Pages)
GitHub: TechnoJapan-LP/techno-japan
GA4測定ID: G-4MHCNR7D26
Search Console: 認証済み
Behold.so feed-id: KSdgYwJwBxsVTQksVCVP
Instagram: @techno.japan_
Threads: @techno.japan_
Newsletter送信先: tatsuya25shibata@gmail.com (FormSubmit)
```

---

## サイト構造（IA）

```
/                  index.html       メディアTOP（最新記事 + 直近フェス + アーティスト + VENUES）
/about.html        ブランドLP（旧 index.html。ヒーロー + About + Discoverカード + Contact）
/news.html         記事一覧 + 記事詳細（hash routing #article/{id}, #tag/{slug}）
/festivals.html    フェス一覧 + 詳細（hash routing #festival/{id}）
/artists.html      アーティスト一覧 + 詳細（#artist/{id}）
/venues.html       会場一覧 + 詳細 + 地図 + ホバープレビュー（#venue/{id}）
/favorites.html    お気に入り一覧（noindex, localStorage 駆動）
/events.html       (deprecated) /news.html#tag/events へ meta-refresh リダイレクト
/discover.html     (deprecated) /news.html へ meta-refresh リダイレクト
/404.html          ブランデッド 404 ページ
/cms.html          CMS編集画面（noindex, 認証は外部任せ）
/map.html          全国マップ（古い、利用状況要確認）
```

---

## ファイル構成

```
techno-japan/
├── LP/                          ← 本番デプロイ対象
│   ├── index.html               ← メディアTOP
│   ├── about.html               ← ブランドLP
│   ├── news.html                ← 記事一覧 + 詳細（hash routing）
│   ├── festivals.html           ← フェス一覧 + 詳細
│   ├── artists.html             ← アーティスト一覧 + 詳細
│   ├── venues.html              ← 会場一覧 + 詳細 + 地図 + ホバープレビュー
│   ├── favorites.html           ← お気に入り一覧（noindex）
│   ├── events.html              ← 旧EVENTS、現在 news へリダイレクト
│   ├── discover.html            ← 旧DISCOVER、現在 news へリダイレクト
│   ├── 404.html                 ← ブランデッド 404
│   ├── cms.html                 ← CMS編集画面（noindex, SRI付き）
│   ├── map.html                 ← 全国マップ
│   ├── common.css               ← 共通スタイル（リセット/nav/footer/cursor/...）
│   ├── common.js                ← 共通JS（cursor expand + scroll reveal）
│   ├── data.js                  ← 全データ（ARTISTS/EVENTS/FESTIVALS/VENUES/ARTICLES）
│   ├── search.js                ← グローバル検索（Cmd+K）
│   ├── favorites.js             ← お気に入り（localStorage）
│   ├── manifest.json            ← PWA設定
│   ├── sw.js                    ← Service Worker（v1.6.0）
│   ├── robots.txt
│   ├── sitemap.xml              ← 自動生成
│   ├── rss.xml                  ← 自動生成
│   └── images/
│       ├── artists/             ← *.webp（オリジナル .jpg/.jpeg もそのまま残置）
│       ├── festivals/           ← *.webp
│       ├── venues/              ← *.webp
│       └── discover/            ← *.webp
├── scripts/
│   ├── generate-sitemap.py      ← data.js → sitemap.xml
│   └── generate-rss.py          ← data.js → rss.xml
└── .github/workflows/           ← sitemap/rss auto-gen, lighthouse, drive sync, backup
```

---

## このセッションで完了したこと（2026-05-03 → 2026-05-05）

### IA 大改装
- 旧 `index.html` (ブランドLP) を `about.html` に移動
- 新 `index.html` を **メディアTOP** として再構築
  - イントロタグライン
  - **STORIES**: featured 1 + side 最大7 + MOREトグル
  - **UPCOMING FESTIVALS**: HÖR風フルワイド行レイアウト、最大8 + MOREトグル
  - **ARTISTS**: 自動スクロール縦長カードカルーセル + 左右矢印
  - **VENUES**: 都市タブで絞り込み (TOKYO/OSAKA/KYOTO)
- `DISCOVER` → `NEWS` 全置換（URL も `/discover.html` → `/news.html`、リダイレクトスタブ残置）
- `VENUE` → `VENUES`（複数形）
- `EVENTS` をナビから除外 → 週間ロールアップ記事として news に統合
- ナビフラット化: `TOP | NEWS | FESTIVALS | ARTISTS | VENUES | ABOUT | [IG][Threads][Search][Heart]`

### コード品質
- `common.css` (約 420行) / `common.js` (約 100行) を抽出 → 全ページから参照
- 各HTMLから重複CSSを削除（合計 -1,700 行）

### NEWS 機能
- 動的 OG / Twitter / canonical メタ更新（記事ごと）
- Schema.org `NewsArticle` JSON-LD 動的生成
- 記事本文の **自動リンク化**（DOM walk で artist / venue / festival 名を href 化、初出のみ）
- **タグシステム**: `<a href="#tag/{slug}">` クリックでアーカイブをタグフィルタ
- **Giscus コメント枠**（`GISCUS_CONFIG` を埋めれば即稼働）
- "READ" ホバーアニメ on 記事矢印（durevie.paris風）
- LOAD MORE / カテゴリフィルタ既存

### VENUES 機能
- HÖR風ホバープレビューパネル（写真 + 詳細、デスクトップ専用）
- GUIDE セクション（NEWS / FESTIVALS / ARTISTS / VENUES 4枚カード）を news / about / festivals / artists / venues に共通配置

### ブランディング / UX
- accent: `#ff2d2d`（鋭い赤）+ accent-soft: `#a82f31`（編集ワイン）の2色運用
- 控えめなホバー＋ニュースレターセクションに subtle radial wash
- DM Sans / Bebas Neue / Space Mono 構成は維持（ロゴ画像化は一度入れたが revert 済み）
- a11y: aria-label / 44px タップターゲット / Skip-to-content / `:focus-visible` 強調

### パフォーマンス
- **WebP 化**: 全 48 枚の content image を WebP に変換、`data.js` 参照も `.webp` に
  - 元 72MB → 18MB (75.6% 削減)
- DNS prefetch: GA / GTM / Behold / FormSubmit
- `loading="lazy" decoding="async"` は既存維持
- SW v1.6.0 で precache 更新

### セキュリティ
- 全ページに **CSP (Content Security Policy)** meta（許可リスト方式、`object-src 'none'` 等）
- `X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`Permissions-Policy`
- **cms.html**: より厳格な CSP + `noindex,nofollow,noarchive,noimageindex` + googlebot 専用タグ
- **SRI (Subresource Integrity)** on Quill / Leaflet CDN
- newsletter フォームに **honeypot** (`_honey`)、`_captcha=true`

---

## データ管理フロー

```
[Spreadsheet] ← 編集 → [CMS (cms.html)]
      ↓
   [GAS API]
      ↓
[data.js export] ← CMSの「Publish Now」または「Export data.js」ボタンでDL
      ↓
[GitHub に push]
      ↓
[GitHub Pages 自動デプロイ]
      ↓
[GitHub Actions]
   ├→ sitemap.xml 自動生成
   └→ rss.xml 自動生成
```

### data.js のスキーマ

```js
const ARTISTS = [{ id, name, city, country, genre, image, imagePosition?, bio, links: {...} }, ...];
const EVENTS = [{ name, date, venue, city, lineup, time, desc, link }, ...];
const FESTIVALS = [{ id, name, city, location, date, genre, image, flyer, lineup, editions: [], ... }, ...];
const VENUES = [{ id, name, city, area, type, image, genre, capacity, address, lat, lng, url, instagram, desc }, ...];
const ARTICLES = [{ id, title, excerpt, body, category, date, author, image, featured, views, readTime, tags, status }, ...];
```

新フィールド:
- **`imagePosition`** (ARTISTS): CSS `object-position` 形式 (`top`, `center`, `50% 25%` 等)。CMSに3x3アンカーボタングリッド付き
- **`updated`** (ARTICLES, 任意): 更新日（schema.org dateModified に使用）

---

## 既知の課題 / 未対応

### GAS 側（更新キット準備済み）
- **`scripts/gas-update/README.md`** に貼り付け用コードと手順あり（10分作業）
  - ヘッダ名マッピング式 `addRowByHeaders_()` で add_article / add_artist を全フィールド対応化
  - シートに列追加が必要: ARTICLES に `date`、ARTISTS に `imagePosition` / `website`
- `update_row`（編集保存）は既に全フィールド動作 → 新規作成のみが対象

### コンテンツ不足
- **アーティスト画像**: 69件中4件のみ（残り65件はグラデーションプレースホルダー）
- **記事**: 1〜3本のみ。週1ペースで増やすべき
- **会場の英語版テキスト**: 未対応

### Giscus コメント（設定済み・要アプリインストール）
- `GISCUS_CONFIG` は実値設定済み（repo / repoId / Announcements カテゴリID）
- GitHub Discussions は API で有効化済み
- **残り1手順**: giscus GitHub App のインストール → https://github.com/apps/giscus
  （TechnoJapan-LP/techno-japan を選択して Install。これでコメント欄が稼働）

### 多言語（未着手）
- CMSに `name_en` `desc_en` `bio_en` フィールドあるが、データ未充足
- 将来やる場合：URL分離方式 (`/en/*`) 推奨

### CMS 認証
- `cms.html` は URL 直叩きでアクセス可能。Cloudflare Access / GitHub OAuth / Basic Auth で外部認証必要

---

## 直近の主要コミット

```
e0019e0 feat(security): defense-in-depth — CSP, security meta, SRI, honeypots
566534c feat: introduce accent-soft (#a82f31) for warmer hovers + section tints
85dfdbc Revert "feat: brand the site with the new TECHNO JAPAN logo"
d83f404 feat(venues): HÖR-style hover preview pane (desktop only)
b9b59ca feat: GUIDE section everywhere — reordered cards, sky-blue VENUES
3f13df7 feat(cms+artists): per-artist image position
0b8081a feat: SEO, content, nav, EVENTS-as-news polish
62522c5 feat: rename /discover.html → /news.html
49914f7 feat: split LP from media TOP — index.html is media hub
4b2819b feat(home): redesign UPCOMING FESTIVALS as HÖR-style rows
d5ed22a feat(home): convert ARTISTS to auto-scrolling carousel
a196eb1 feat(home): arrow controls for ARTISTS carousel
```

---

## 開発環境

### ⚠️ 運用パス変更（2026-07-10 のフォルダ整理）
- `update_festivals.py / .sh` は **LP/ → scripts/** に移動。
  crontab が古いパス（`.../techno-japan/LP/update_festivals.sh`）を指していたら
  `.../techno-japan/scripts/update_festivals.sh` に更新すること。
- Googleサービスアカウント鍵も `scripts/` に移動（git 追跡外・root .gitignore で恒久除外）
- 日次バックアップは `LP/backups/` → リポジトリ直下 `backups/` に移動
  （デプロイ対象から除外。workflow も更新済み）
- `media.html` は noindex リダイレクトスタブ化（→ /news.html）

### プレビューサーバー
- ディレクトリ: `/tmp/lp-preview/`
- スクリプト: `/tmp/serve_lp.py`（Python http.server, port 8080, no-cache）
- 起動: `python3 /tmp/serve_lp.py`
- LP変更時: `cp LP/*.html LP/data.js LP/sw.js LP/manifest.json LP/sitemap.xml LP/rss.xml LP/search.js LP/favorites.js LP/common.css LP/common.js /tmp/lp-preview/`

### サイトマップ・RSS手動生成
```bash
cd /Users/shibatatatsuya/Developer/techno-japan
python3 scripts/generate-sitemap.py
python3 scripts/generate-rss.py
```

### WebP 再生成（新規画像追加時）
```python
from PIL import Image
img = Image.open('images/festivals/new.jpg')
img.convert('RGB').save('images/festivals/new.webp', 'WEBP', quality=82, method=6)
```

### Node は未インストール
ビルドツール（Vite等）は使っていない。すべてバニラ。

---

## デザイン規約

```css
:root {
  --bg: #080808;            /* 黒背景 */
  --text: #f0ede8;          /* オフホワイト */
  --accent: #ff2d2d;        /* シャープな赤（アクセント） */
  --accent-soft: #a82f31;   /* 編集ワイン（ホバー・セクションtint） */
  --font-display: 'Bebas Neue';
  --font-mono: 'Space Mono';
  --font-body: 'DM Sans';
}
```

- **ブレークポイント**: 1100px / 900px / 768px / 480px
- **カーソル**: カスタム（dot + ring、touch-deviceでは非表示）
- **アニメーション**: IntersectionObserver で `.reveal` → `.visible`
- **グリッド背景**: 80px間隔ドリフト + scan-line（about.html / 404.html）

---

## 2026-08-06 の全面点検（セキュリティ・バグ・負荷）

詳細は AUDIT_TECHNO_JAPAN.md **§9-44 / §9-45**。ここは要点だけ。

### 直したもの

| | 内容 |
|---|---|
| 反射型XSS | `news.html` の `?tag=` で `<img src=x onerror=...>` が**実際に発火していた**。`tjEscapeHtml()` + `sanitizeTag()` で塞いだ |
| セキュリティヘッダ | CSP / nosniff / Referrer-Policy / Permissions-Policy を**全449ページ**へ。`map.html` の Leaflet は unpkg.com から `/vendor/` へ取り込んで self に閉じた |
| `javascript:` URL | `esc()` では止まらない。`safeUrl()` をデータ由来 href 9箇所に適用 |
| **導線切れ** | SPA 廃止（§9-23）以降、**トップ・検索・お気に入り・APP から詳細ページへ一度も行けていなかった**。全て静的詳細ページ直リンクへ |
| 転送量 | 背景画像が1枚も遅延していなかった。トップ **2.82MB → 1.38MB**、artists **0.53MB → 0.11MB** |
| CI | Drive 同期のたびに CI が落ちる状態だった。同期側が寸法表と `?v` まで作るようにした |

### 増えたガード

- `scripts/check_internal_links.py`（新規）— 廃止済み SPA ハッシュの禁止 + 内部リンク実在確認
- `check_hub_pages.py` に XSS 検査（実際に攻撃URLを踏む）と、遅延背景の画像検査

いずれも**負のコントロールで検出できることを確認**してから入れてある。
緑になっただけでは、検査が何も見ていない場合と区別が付かない（§9-32）。

### 触るときの注意

- `safeUrl()` は `build-detail-pages.mjs` と `LP/app/app.js` の**2箇所に同じ規則**がある。片方だけ直さないこと
- `LP/app/`（PWA）は **`deploy-pages.yml` の `rm -rf ./LP/app` で本番に出していない**（開発中）。
  公開はその step を消すだけ。CSP は先に入れてあるので、消す前に塞ぐ作業は要らない
- `LP/app/`（PWA）は `?v=` ではなく `app/sw.js` の `VERSION` 定数でキャッシュを切る。
  `app.js` / `app.css` / `app/index.html` を触ったら `VERSION` を上げること
- `app/index.html` の CSP は `script-src 'self'`（`'unsafe-inline'` 無し）。
  `onclick=` 等の属性ハンドラを足すと**黙ってブロックされる**。`addEventListener` を使うこと
- 背景画像は `style` ではなく `tjLazyBgAttr()` で `data-bg` に入れ、`innerHTML` 後に
  `tjApplyLazyBackgrounds(root)` を呼ぶ

### 残っている宿題（§9-45 に設計あり）

**`festivals.html` が 1訪問 4.87MB。** 遅延読み込みは効いていて、
残りは画像1枚が大きいこと（webp 平均272KB・実寸1080〜1920px に対し
カード表示幅は400〜600px）。800px の派生画像を作れば 1MB 前後になる見込み。

ただし `LP/images/` は `sync-drive-images.yml` が2時間おきに上書きするので、
**派生は別ディレクトリ（例 `LP/images-sm/`）に出すこと**。
影響範囲が広く（画像全滅の事故は §9-35 で起きている）独断では入れていない。

---

## 2026-08-07 フェスを翌年へ更新するときの開催回（AUDIT §9-47）

「2025年のフェスを2026年に更新すると Edition がエラーになる」の修正。
`LP/cms.js` に5つ原因があった。

### 使い方が変わるところ

- **FESTIVALS の DATE を翌年にしても、既存の開催回は書き換わらなくなった。**
  以前は最新の開催回に無条件で上書きしていて、2025回の日程が2026に化けていた
  （AGENTS.md が禁じている「過去回を消す」を CMS が自動でやっていた）。
- 翌年の開催回が無い状態で DATE だけ翌年にすると、
  **「◯年の開催回がありません。『次回開催を作成』で追加してください」** と出る。
  そこで開催回を作ってから日程を入れる、が正しい手順。
- 開催回に **Pref 欄**が増えた。空なら FESTIVALS の CITY が既定値になる。

### 直した中身

| | 内容 |
|---|---|
| A | DATE の翌年更新で過去回の日程が書き換わっていた |
| B | 新規開催回が**別のフェスの行を上書き**していた（追記位置を絞り込み後の配列から計算） |
| C | 開催回が1つも無いフェスは**永久に1つも作れなかった**（「シート未読込」と誤表示） |
| D | 新規開催回の PREF が空固定。開催回に `pref` / `venueId` のキー自体が無かった |
| E | 同じ画面で2回保存すると直前に足した回を上書きしていた |

実データの被害は確認済みで0件（`EDITION_ID` 重複0 / `EDITION_ID ≠ FESTIVAL_ID-EDITION` 0）。

### 検査

`scripts/check_cms_editions.mjs`（新規、CI 組込済）。
**cms.html は読み込み時に `prompt()` を出すので headless ブラウザでは固まる**ため、
`cms.js` だけを VM に読んで DOM と `fetch` を差し替えて叩いている。
修正前の `cms.js` では8件中6件が落ちることを確認済み。

CMS の開催回まわりを触ったら `node scripts/check_cms_editions.mjs` を回すこと。

---

## 記事ページの「関連フェスティバル」 2026-08-08 完了

記事の下部に、紐づけたフェスへのカードを出す。**実装・スタイル・検証すべて完了。**

一時保留していた（Codex のアニメーション作業と同一ファイルだったため）が、
先方の完了連絡を受けて別コミットに分離したうえで再開した。
`reports/pending-article-related-festival.js.txt` は役目を終えたので削除。

実測（headless Chrome / 2026-08-08）:

```
PC(1440px)   カード420px / 画像420x315 / 実体360px / → /festivals/transcendence.html
スマホ(412px) カード436px（上限解除）/ 実体500px
EN版          → /en/festivals/transcendence.html
```

日程・会場は**開催回の最新**から取る。画像はカード用の縮小版（§9-51）。

### 関連して分かったこと

- **記事 ⇄ フェスの紐づけは片方向だった。** `ARTICLES.festivalId` は
  フェス側の「RELATED STORIES」だけが使っており、記事→フェスの導線は無かった
- **現時点で全記事の `festivalId` が空。** CMS の入力欄も紐づけ処理も生きているが、
  値が入っていないので**どちらの向きにも何も出ていない**。
  CMS で記事にフェスを選んで保存すれば、フェス側にはすぐ出る

### ARTICLE の Views について

自動反映を検討したが、**そもそも出自がサンプルデータだった**。
2026-04-15 に記事一覧を作った際、画面確認用の架空値（2400 / 3100 など）として
入っていたものを、CMS 化のときに入力欄にしただけ。同時期の `readTime` も同じ。

現在の用途は記事一覧の「人気順」の並び替えのみで、根拠は手入力の `1500`。
自動化するなら GA（既に導入済み・実数が溜まっている）から日次で取り込む案が現実的だが、
**記事が増えてからでよい**と判断して保留。

---

## 次にやるべきこと（優先順位）

### 短期
1. **GASのadd_article / add_artist ハンドラ更新** — body/author/tags/status/imagePosition 対応
2. **Giscusセットアップ** — giscus.app で repo接続 → `news.html` の `GISCUS_CONFIG` を埋める
3. **記事を週1で書く** — 毎週月曜 09:00 JST に `weekly-article-draft` workflow が
   直近14日のイベント/フェスをまとめた CMS 貼り付け用ドラフトを **GitHub Issue として自動起票**。
   Issue の（）を埋めて CMS → Article → New に貼るだけ
4. **アーティスト画像追加** — 主要DJの写真を集める

### 中期
5. **CMS 認証ゲート** — Cloudflare Access / Basic Auth / GitHub OAuth
6. **Phase 5（多言語）** — CMSの英語フィールドを埋めて URL分離方式で実装
7. **タグページ専用URL** — 現状 `#tag/foo` は hash routing。`/tags/foo.html` で静的生成も検討
8. **記事内の関連記事レコメンド** — タグ重なり度で出す

### 長期
9. **チケット販売アフィリエイト**
10. **メンバーシップ**（限定コンテンツ）
11. **iOSアプリ化**（PWAは既に基盤あり、Capacitorで包む）

---

## このドキュメントの使い方（次のClaudeセッション向け）

1. このファイル `HANDOFF.md` を読み込む
2. ユーザーから具体的な改善要望を聞く
3. 変更後はコミット & push
4. 必要なら `HANDOFF.md` を更新

セッション開始時の挨拶例:
> 「LP改善の続きですね。`HANDOFF.md` 確認しました。最新はメディアTOP / NEWS / VENUES ホバープレビュー / WebP / CSP まで完了しています。今日は何を進めますか？」
