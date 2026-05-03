# 🔄 Techno Japan CMS — プロジェクトサマリー

> 最終更新: 2026-05  
> このファイルは Claude との引き継ぎ用。新しいチャットで参照してもらう。

---

## プロジェクト概要

**Techno Japan** — 日本のアンダーグラウンドテクノシーンを発信するメディアサイト。CMSで編集、GitHub Pagesで公開。

## 構成

```
/Users/shibatatatsuya/Documents/GitHub/techno-japan/
├── LP/
│   ├── cms.html         ← メインのCMS（4500行超）
│   ├── data.js          ← LP用データ（CMSからExport）
│   ├── index.html, festivals.html, venues.html, artists.html, events.html, articles.html, discover.html, map.html
│   ├── images/{venues,festivals,artists}/  ← Drive→GitHub Actions同期
│   └── backups/         ← 日次自動バックアップJSON
└── .github/workflows/
    ├── sync-drive-images.yml   ← 30分おき画像同期
    └── backup-data.yml         ← 日次バックアップ
```

## バックエンド

- **Google Apps Script (GAS)**: `https://script.google.com/macros/s/AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nfDjwglmdu8ClhpWZ-OXSbMM4UyFE_7ZsV-Lpg/exec`
- **Google Spreadsheet**: 6シート（VENUES, FESTIVALS, ARTISTS, EVENTS, ARTICLES, AUTHORS）
- **Google Drive**: 画像保管
  - `VENUES_FOLDER_ID = "1c57ZkrkBj5GioKLO7h2eBrBecpj3oqli"`
  - `FESTIVALS_FOLDER_ID = "15MAHqOfAjjNN_AvD0Hzdrko5NFujfIQi"`
  - `ARTISTS_FOLDER_ID = "16Tke6MdkD1OPNElvRFjACrz-Y2ggEn5j"`

## 認証

- パスワード: `techno-japan-admin`
- ハッシュ: `e49c925f394b2f9cb9d5ab42549c800cb532b4444279cc813ed101af618c9e8c`
- GAS Script Properties に `CMS_PASSWORD_HASH` 設定済み
- API認証: 全リクエストに `cmsAuth` パラメータ（GAS側でチェック）

## CMS機能（実装済み）

### コンテンツ管理
- 6セクション CRUD（Festival/Venue/Artist/Event/Article/Author）
- 検索・ソート（全セクション）
- カレンダービュー（Festival/Event）
- ライブプレビュー（実サイト風表示）
- Lat/Lng マップ表示（Leaflet）
- Hero Gradient プレビュー

### Publishing機能
- Status（draft/review/published/scheduled）
- OG Image / Meta Description
- Tags（チップ式UI）
- Editor Notes（チーム内メモ）
- 編集履歴（lastEditedAt/By）
- 完成度スコア（必須項目チェック）
- バリデーション（URL/重複ID）

### 多言語
- JP/EN タブ式入力（name_en, desc_en, bio_en）
- AI自動翻訳（JP→EN, EN→JP）

### AI支援
- AI Generate（説明文生成 - URL+Instagramから）
- AI Lineup Fetch（フェスのラインナップ取得）
- AI Translate

### 画像管理
- 自動圧縮（1920px・JPEG 85%）
- URL/手動アップロード
- Image Library（Drive一覧）
- 自動Drive→ローカル同期（GitHub Actions）

### 編集ワークフロー
- Trash（30日復元可能）
- Recent items（サイドバー）
- 未登録アーティスト自動追加
- Find & Replace（全シート横断）
- Bulk edit
- キーボードショートカット（Cmd+S, Cmd+K, Esc）

### ダッシュボード
- Home（Drafts一覧、低完成度警告）
- Stats（都市/ジャンル/月別統計）
- Image Library

### パフォーマンス
- localStorage 5分キャッシュ + stale-while-revalidate
- バックグラウンド先読み（requestIdleCallback）
- 検索デバウンス（200ms）
- GAS CacheService（5分）
- Batch endpoint（`get_all_sheets`）
- ヘッダー駆動の行構築（`buildRowFromHeaders`）

### 自動化
- data.js エクスポート（ワンクリック）
- 日次バックアップ（GitHub Actions, JST 11:00）
- 画像同期（30分おき）

## 公開

- **CMS URL**: `https://technojapan-lp.github.io/techno-japan/LP/cms.html`
- **GitHub Repo**: `https://github.com/TechnoJapan-LP/techno-japan`
- **GitHub Secrets**: `GH_TOKEN`, `CMS_AUTH_HASH` 設定済み

## GAS主要関数

- `doPost(e)` / `doGet(e)` - 認証チェック付きルーティング
- `getSheetData(params)` - キャッシュ付きシート読み取り
- `getAllSheets(params)` - バッチ読み取り
- `addVenue/Festival/Artist/Event/Article/Author(data)` - ヘッダー駆動で追加
- `updateRow(data)` - ヘッダー駆動で更新
- `deleteRow(data)` - 削除
- `uploadImage/uploadFestivalImage/uploadFromUrl(data)` - Drive保存
- `aiGenerate/translateText/getLineup(data)` - Claude API呼び出し
- `buildRowFromHeaders(sheet, data)` - ヘッダー駆動ヘルパー
- `clearSheetCache(name)` - キャッシュクリア

## 次に取り組みたいこと（候補）

### LP（公開サイト）側の改善
1. Open Graph / Twitter Card メタタグ
2. Sitemap.xml + robots.txt
3. Schema.org 構造化データ
4. Google Analytics
5. 多言語切替UI（CMSで`_en`データ準備済み）
6. Tags ページ
7. RSS feed
8. PWA化

### CMS側の追加候補
- 承認ワークフロー（draft → review → published）
- Discord/Slack通知（Webhook on save）
- 公開予約自動化（GitHub Actions cron）
- アクセス分析の取り込み（GA → views カラム）
- マルチユーザー認証

## 開発ワークフロー

- **ローカル**: `/Users/shibatatatsuya/Documents/GitHub/techno-japan/LP/cms.html` で編集
- **プレビュー**: `/tmp/lp-preview/cms.html` (port 8080)
- **本番反映**: GitHub Desktop で commit & push → 数分後に GitHub Pages に反映
- **GAS編集**: Google Apps Script エディタで直接、デプロイ時は既存デプロイの「編集→新バージョン」

---

## 新しいチャットでの使い方

新しい Claude のチャットを開いて、最初に下記のように声をかけてください：

> このプロジェクトの続きをやりたい。  
> `/Users/shibatatatsuya/Documents/GitHub/techno-japan/PROJECT_SUMMARY.md` を読んで、現状を把握してください。

これで Claude がファイルを読んで全体像を理解してくれます。

その後、具体的にやりたいことを伝えてください：
- 「LP側のSEO対策（Phase 1）をやりたい」
- 「○○のバグを直したい」
- 「○○機能を追加したい」

---

## このファイルの更新

新しい機能を追加したり、構成が変わったりしたら、このファイルも更新しましょう。
チャットの最後に Claude に「PROJECT_SUMMARY.md を最新に更新して」とお願いすればOK。
