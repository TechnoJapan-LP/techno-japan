# TECHNO JAPAN — Handoff (2026-05-05 更新)

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

### GAS 側
- `add_article` ハンドラに **body / author / tags / status / imagePosition** フィールドの保存処理がまだ
  - 当面は CMS の「Generate Code」→ data.js コピペ運用、または GAS 更新が必要
- `add_artist` ハンドラも `imagePosition` 未対応

### コンテンツ不足
- **アーティスト画像**: 69件中4件のみ（残り65件はグラデーションプレースホルダー）
- **記事**: 1〜3本のみ。週1ペースで増やすべき
- **会場の英語版テキスト**: 未対応

### Giscus コメント
- `news.html` の `GISCUS_CONFIG` が空。giscus.app で repo / repoId / categoryId を取得して埋める必要あり

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

### プレビューサーバー
- ディレクトリ: `/tmp/lp-preview/`
- スクリプト: `/tmp/serve_lp.py`（Python http.server, port 8080, no-cache）
- 起動: `python3 /tmp/serve_lp.py`
- LP変更時: `cp LP/*.html LP/data.js LP/sw.js LP/manifest.json LP/sitemap.xml LP/rss.xml LP/search.js LP/favorites.js LP/common.css LP/common.js /tmp/lp-preview/`

### サイトマップ・RSS手動生成
```bash
cd /Users/shibatatatsuya/Documents/GitHub/techno-japan
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

## 次にやるべきこと（優先順位）

### 短期
1. **GASのadd_article / add_artist ハンドラ更新** — body/author/tags/status/imagePosition 対応
2. **Giscusセットアップ** — giscus.app で repo接続 → `news.html` の `GISCUS_CONFIG` を埋める
3. **記事を週1で書く** — EVENTS タグ付きの「次の週末ガイド」など、現状ほぼ空
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
