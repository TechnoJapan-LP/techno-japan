# GAS ハンドラ — add_article / add_artist（✅ 対応完了）

**2026-07-10 時点で、この更新は完了しています。追加作業は不要です。**

## 確認済みの状態

CMS本体スプレッドシート（「LP」/ ID `1DqBbvxhuDh1f1eZibaBfllaVGiMaqO7IjD3Mm-yIZIA`）に
バインドされた GAS プロジェクト「Techno Japan」を確認した結果：

- **GASコード**: `addArticle` / `addArtist` / `addEvent` はすべて
  `buildRowFromHeaders(sheet, data)`（ヘッダ名マッピング式）を使用済み。
  シートのヘッダ行と CMS ペイロードのキーを大文字小文字無視で突き合わせ、
  一致した列に値を書く。列の並び順に非依存。
- **パスワード**: Script Properties (`CMS_PASSWORD_HASH`) から読む方式で、
  コードに平文ハッシュは残っていない（安全）。

## シート列の状態

| シート | 必要な列 | 状態 |
|--------|---------|------|
| ARTISTS | `imagePosition` | ✅ U列に存在（データも既にあり） |
| ARTISTS | `website` | ✅ K列 WEBSITE に存在 |
| ARTICLES | `date` | ✅ W列に追加済み（2026-07-10、Claude in Chrome 経由） |

ARTISTS は既に name_en / bio_en / ogImage / metaDescription / editorNotes / tags 等
まで拡張済み。ARTICLES も title_en / excerpt_en / publishAt / authorId まで対応。

## 今後、新フィールドを足したくなったら

1. 対象シートの**ヘッダ行の末尾**に列名を1つ追加（大文字小文字は問わない）
2. CMS のペイロードに同名キーを含める
3. 以上。GAS のコード変更・再デプロイは**不要**（buildRowFromHeaders が自動対応）

これがこの設計の利点。列を足すだけで拡張できる。

## VENUES 4列の手貼り（2026-08-24）

### ✅ 適用済み。作業は要らない（2026-08-24 15:00 実物確認）

Apps Script「Techno Japan」の `コード.gs` 冒頭を実際に開いて確認した。

```js
const COLUMNS = [
  "id", "name", "city", "area", "type", "image", "genre",
  "capacity", "address", "lat", "lng", "url", "instagram", "desc", "desc_en", "subtype", "hours", "charge",
  "features"
];
```

`desc_en / subtype / hours / charge / features` はすべて入っている。
アクティブなデプロイは **バージョン62（2026/08/24 14:35）**、デプロイIDは
`cms.js` の `GAS_URL`（`AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nf...`）と一致。
**保存だけでなく再デプロイまで済んでいる。**

以下は再適用が必要になったときのための手順として残す。

### ⚠️ 列名は小文字。大文字で足さないこと

この節は当初 `'DESC_EN', 'SUBTYPE', ...` と**大文字で書かれていたが、誤りだった**。
実物の `COLUMNS` は既存要素を含めてすべて小文字で、CMS が送るペイロードのキーも
小文字（`cms.js` の venue 保存を参照）。大文字を足すと既存要素と食い違う。
AUDIT §9-69「大文字小文字で値が消える」は、まさにこの取り違えで起きた事故。

### 貼り替え手順（再適用が必要になった場合）

1. Apps Scriptの「Techno Japan」プロジェクトを開く。
2. `コード.gs` 先頭の `const COLUMNS = [...]` を開く。
3. 既存の列を削除せず、配列の末尾へ次を追加する。**小文字**であること。

   ```js
   'desc_en', 'subtype', 'hours', 'charge', 'features'
   ```

   すでにある列は重複させない。
4. リポジトリの [`venue-columns.patch.gs`](venue-columns.patch.gs) にある
   `assertVenueColumnsPatch_()` を、Apps Scriptのコンソールで実行できる状態にし、
   `OK: desc_en, subtype, hours, charge, features` が返ることを確認する。
   （この関数は大文字小文字を問わずに突き合わせる）
5. コード.gsを保存する。
6. **デプロイ → デプロイを管理 → 編集 → 新バージョン → デプロイ**を行う。
   保存だけでは本番のGAS実行環境は変わらない。
7. 認証済みCMSで「Publish Now」を実行する。`publishPayloadSummary` に
   `FEATURES n件` が出て、GitHubの`cms: publish data.js`コミットで
   `LP/data.js`の実差分が1ファイル以上あることを確認する。空コミットは成功扱いにしない。

### snapshot.js の更新

GASを貼り替えて再デプロイした後、Apps Scriptエディタのブラウザ開発者ツール
Consoleで [`snapshot.js`](snapshot.js) 全体を実行する。出力JSONを
[`live-snapshot.json`](live-snapshot.json) に保存し、次を実行する。

```bash
node scripts/check_gas_sync.mjs
```

`live-snapshot.json`はGASの実物を確認した後に更新する。先に更新して「反映済み」と
記録してはいけない。今回のCOLUMNSは手貼り対象なので、`assertVenueColumnsPatch_()`の
実行結果とPublishの実差分もhandoffへ記録する。

## CMSからの画像同期トリガー

[`trigger-image-sync.gs`](trigger-image-sync.gs) をGASプロジェクトへ追加し、認証済みのPOSTルーターに
`trigger_image_sync` の分岐を追加する。GitHubトークンはコードへ書かず、Script Propertiesの
`GITHUB_ACTIONS_TOKEN` に保存する。必要権限とデプロイ手順は同ファイルのコメント、および実装時の
引き渡し手順に従う。
