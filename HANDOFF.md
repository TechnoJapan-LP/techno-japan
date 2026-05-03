# TECHNO JAPAN — LP Improvement Handoff

このドキュメントは、LP改善作業を新しいClaudeセッションで引き継ぐための情報をまとめています。

---

## プロジェクト概要

- **サイト**: https://techno-japan.media
- **目的**: 日本のアンダーグラウンド・テクノ／ハウスシーンを発信するメディアプラットフォーム
- **構成**: バニラHTML/CSS/JS のシングルページ集合（GitHub Pages配信）
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
Newsletter送信先: tatsuya25shibata@gmail.com (FormSubmit)
```

---

## ファイル構成

```
techno-japan/
├── LP/                          ← 本番デプロイ対象
│   ├── index.html               ← トップ（ランディング）
│   ├── festivals.html           ← フェス一覧 + 詳細（hash routing）
│   ├── events.html              ← イベント一覧
│   ├── artists.html             ← アーティスト一覧 + 詳細
│   ├── venues.html              ← 会場一覧 + 詳細 + 地図
│   ├── discover.html            ← メディアTOP + 記事詳細
│   ├── favorites.html           ← お気に入り一覧（noindex）
│   ├── cms.html                 ← CMS編集画面（要認証/非公開ベース）
│   ├── map.html                 ← 全国マップ
│   ├── data.js                  ← 全データ（ARTISTS/EVENTS/FESTIVALS/VENUES/ARTICLES）
│   ├── search.js                ← グローバル検索（Cmd+K）
│   ├── favorites.js             ← お気に入り（localStorage）
│   ├── manifest.json            ← PWA設定
│   ├── sw.js                    ← Service Worker（v1.1.0）
│   ├── robots.txt
│   ├── sitemap.xml              ← 自動生成
│   ├── rss.xml                  ← 自動生成
│   └── images/
│       ├── artists/
│       ├── festivals/
│       ├── venues/
│       └── discover/
├── scripts/
│   ├── generate-sitemap.py      ← data.js → sitemap.xml
│   └── generate-rss.py          ← data.js → rss.xml
└── .github/workflows/
    ├── generate-meta.yml        ← sitemap/rss 自動生成（push時 + 毎日3:00 UTC）
    ├── lighthouse.yml           ← パフォーマンス計測
    ├── sync-drive-images.yml    ← Drive画像同期
    └── backup-data.yml          ← データバックアップ
```

---

## 完了済み機能（Phase 1〜6）

### Phase 1: SEO基盤 ✅
- 全ページに canonical / OG / Twitter Card メタタグ
- Schema.org JSON-LD（Organization / WebSite / CollectionPage）
- robots.txt
- sitemap.xml（186 URLs：6 静的 + 86 festivals + 69 artists + 22 venues + 3 articles）
- GitHub Actions で sitemap/rss 自動再生成

### Phase 2: 解析 ✅
- Google Analytics 4 (`G-4MHCNR7D26`) 全ページに設置
- Search Console 認証済み・sitemap送信済み

### Phase 3: エンゲージメント ✅
- ニュースレター登録欄（FormSubmit経由）
- RSS フィード（rss.xml、30件）
- SNSシェアボタン（X / Facebook / LINE / コピー）— festival/artist/venue 詳細
- 関連フェスティバル（同じ都市・ジャンル）

### Phase 4: パフォーマンス ✅
- PWA（`manifest.json` + `sw.js`、3つのキャッシュ戦略）
- 画像 lazy loading + decoding async
- Lighthouse CI ワークフロー
- favorites.js / search.js を defer
- Behold widget を IntersectionObserver で遅延ロード
- iOSオートズーム防止 (`font-size: 16px`)
- prefers-reduced-motion 対応

### Phase 5: 多言語 ⏸ スキップ
- CMSに `name_en` `desc_en` `bio_en` フィールドあるが、データ未充足
- 将来やる場合：URL分離方式 (`/en/*`) 推奨

### Phase 6: UX拡張 ✅
- グローバル検索（`search.js`、`Cmd+K` で起動、↑↓Enter 操作）
- お気に入り機能（`favorites.js`、localStorage、ハート UI）
- お気に入り一覧ページ（`favorites.html`）
- ナビにお気に入りカウンター

### Phase 7: 画像位置設定（artist / venue / festival） ✅
- CMS: 3セクション共通の汎用 `setImagePos(prefix, val)` / `syncImagePos(prefix)` ヘルパー
- CMS: 各フォームに `Image Position` 入力 + 3×3アンカーグリッド + 16:9ライブプレビュー
- CMS payload (add/update): 3セクションとも `imagePosition` を送信
- data.js export builder: artist/venue/festival とも `imagePosition` を出力
- スプレッドシート: ARTISTS シートに `imagePosition` 列追加済み
  - **要対応**: VENUES / FESTIVALS シートにも `imagePosition` 列を追加
- GAS: `buildRowFromHeaders` がデータ側キーも正規化（lowercase + no-space）するよう修正
  → 副作用として `lastEditedAt` `ogImage` `metaDescription` 等の保存漏れも解消
- 表示側:
  - `artists.html` 詳細: `object-position: var(--img-pos)`
  - `artists.html` 一覧 / `index.html` ARTISTS カルーセル: `background-position`
  - `venues.html` 詳細 hero / `index.html` venue-mini-img: `background-position`
  - `festivals.html` カードリスト / 詳細 hero / 関連カード: `object-position`
  - `index.html` fest-row-thumb / fest-row-bg: `background-position`

### Phase 8: アーティスト画像アップロード周りの整備 ✅
- GAS: `uploadImage` を `type` で `artists`/`venues`/`festivals` に振り分け
- GAS: `ARTISTS_FOLDER_ID = "16Tke6MdkD1OPNElvRFjACrz-Y2ggEn5j"` を追加
- CMS: `uploadImage` の payload に `type` を含めて送信
- CMS: 編集モードで既存画像プレビュー + ✕ Remove ボタン
- CMS: アップロード失敗時に Dismiss ボタン + file input クリアで再試行可能
- CMS: editRow → switchTab の fromEdit フラグで、編集突入直後の自動キャンセル抑止
- Workflow: `sync-drive-images.yml` に `cmsAuth` パラメータを追加

---

## ページごとの実装メモ

### `index.html`
- ヒーロー: `TECHNO JAPAN` タイトル + アニメグリッド + マーキー
- About → Discover (4 cards) → Instagram (Behold widget) → Newsletter → Footer
- Schema.org: Organization + WebSite

### `festivals.html`
- リスト/詳細を hash routing
- 月ナビ + 年度トグル（PAST→2026/2025/2024 トグル）
- Festival/Rave モード切替
- 各カードにハートアイコン
- 詳細ページに関連フェスティバル + シェアボタン

### `artists.html`
- 4列グリッド（モバイル2列）+ 検索 / ソート / ジャンルフィルター
- カード右上にハート
- 詳細: バイオ / ジャンル / 出演イベント / 出演会場 / シェア

### `venues.html`
- 3列グリッド + エリアフィルター（ALL/TOKYO/OSAKA/...）
- MAP ボタン（右固定、stickyナビ）
- 詳細: 住所 / 地図 / イベント / アーティスト / シェア

### `discover.html`
- メディアTOP（durevie.paris風）
- LATEST/MOST POPULAR ソートタブ
- メイングリッド（featured + 3 side cards）
- ARCHIVE feed + カテゴリフィルター
- **記事詳細** (`#article/{id}`): 動的 title/description、シェアボタン、タグ

### `favorites.html`
- localStorage の `tj-favorites-v1` を読んで表示
- カテゴリ別グリッド（festivals / artists / venues）
- 空状態メッセージ + CTA

---

## データ管理フロー

```
[Spreadsheet] ← 編集 → [CMS (cms.html)]
      ↓
   [GAS API]
      ↓
[data.js export] ← CMSの「EXPORT data.js」ボタンでDL
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
const ARTISTS = [{ id, name, city, country, genre, image, bio, links: {...} }, ...];
const EVENTS = [{ name, date, venue, city, lineup, time, desc, link }, ...];
const FESTIVALS = [{ id, name, city, location, date, genre, image, flyer, lineup, editions: [], ... }, ...];
const VENUES = [{ id, name, city, area, type, image, genre, capacity, address, lat, lng, url, instagram, desc }, ...];
const ARTICLES = [{ id, title, excerpt, body, category, date, author, image, featured, views, readTime, tags, status }, ...];
```

---

## 既知の課題 / 未対応

### コンテンツ不足
- **アーティスト画像**: 69件中4件のみ（残り65件はグラデーションプレースホルダー）
- **記事**: サンプル3本のみ。週1ペースで増やすべき
- **イベント**: 7件のみ
- **会場の英語版テキスト**: 未対応

### 機能未実装
- **多言語切替（Phase 5）**: 未着手
- **タグページ** (`/tags/...`): タグデータ自体がほぼ無い
- **Author プロフィールページ**: AUTHORS シートはあるが LP 側の表示なし
- **記事内自動リンク**: 「DJ NOBU」「WOMB」を自動でリンク化
- **コメント機能**（Giscus等）
- **イベント投稿フォーム**（読者から）
- **チケット販売連携**

### GAS 側
- `add_article` ハンドラの **body / author / tags / status** フィールドは
  `buildRowFromHeaders` 修正により自動対応されたはず（要確認：ARTICLES シートに
  該当列が存在すること）。

### パフォーマンス
- HTML/CSS/JS の minify は未実装（インラインスクリプトが多くリスク高のためスキップ）
- WebP/AVIF への画像変換は未実装
- CDN 配信（Cloudflare R2 等）は未実装

---

## 直近の変更（最新コミット順）

```
c1c3023 perf: speed up loading + mobile optimizations
43f0ff6 feat: CMS — full article management (body, author, tags, status)
0c4bff9 feat: article system — ARTICLES schema, detail view, 3 sample articles
0c842da feat: polish favorites & search
a4b7253 feat: Phase 6 UX — global search, favorites
490381b feat: Phase 4 performance — PWA, lazy loading, lighthouse CI
fc48104 feat: Phase 3 engagement — newsletter, RSS, share buttons, related content
8c2b298 0503_3 (GA4 setup)
d340a7b feat: Phase 1 SEO foundation — meta tags, OG/Twitter, sitemap, schema.org
```

---

## 開発環境

### プレビューサーバー
- ディレクトリ: `/tmp/lp-preview/`
- スクリプト: `/tmp/serve_lp.py`（Python http.server, port 8080, no-cache）
- 起動: `python3 /tmp/serve_lp.py`
- LP変更時: `cp LP/*.html LP/data.js LP/sw.js LP/manifest.json LP/sitemap.xml LP/rss.xml LP/search.js LP/favorites.js /tmp/lp-preview/`

### サイトマップ・RSS手動生成
```bash
cd /Users/shibatatatsuya/Documents/GitHub/techno-japan
python3 scripts/generate-sitemap.py
python3 scripts/generate-rss.py
```

### Node は未インストール
ビルドツール（Vite等）は使っていない。すべてバニラ。

---

## デザイン規約

```css
:root {
  --bg: #080808;            /* 黒背景 */
  --text: #f0ede8;          /* オフホワイト */
  --accent: #ff2d2d;        /* 赤アクセント */
  --font-display: 'Bebas Neue';
  --font-mono: 'Space Mono';
  --font-body: 'DM Sans';
}
```

- **ブレークポイント**: 1100px / 900px / 768px / 480px
- **カーソル**: カスタム（dot + ring、touch-deviceでは非表示）
- **アニメーション**: IntersectionObserver で `.reveal` → `.visible`
- **グリッド背景**: 80px間隔ドリフト + scan-line（共通 `section-bg`）

---

## 次にやるべきこと（優先順位）

### 短期
1. **記事を週1で書く** — 現状3本のみ。10本ぐらいあるとサイトが活きる
2. **アーティスト画像追加 + Image Position調整** — 主要DJの写真を集めて頭切れを修正
3. **ARTICLES シートのヘッダー確認** — body/author/tags/status の列があるか

### 中期
4. **Phase 5（多言語）** — CMSの英語フィールドを埋めて URL分離方式で実装
5. **タグシステムの活用** — 記事 + festival + artist のタグを統一
6. **コメント機能** — Giscusで簡単導入

### 長期
7. **チケット販売アフィリエイト**
8. **メンバーシップ**（限定コンテンツ）
9. **iOSアプリ化**（PWAは既に基盤あり、Capacitorで包む）

---

## このドキュメントの使い方（次のClaudeセッション向け）

1. このファイル `HANDOFF.md` を読み込む
2. ユーザーから具体的な改善要望を聞く
3. 変更後はコミット & push
4. 必要なら `HANDOFF.md` を更新

セッション開始時の挨拶例:
> 「LP改善の続きですね。`HANDOFF.md` 確認しました。前回までで Phase 1〜6 完了 + 記事システム + パフォーマンス最適化が完了しています。今日は何を進めますか？」
