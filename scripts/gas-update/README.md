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

## CMSからの画像同期トリガー

[`trigger-image-sync.gs`](trigger-image-sync.gs) をGASプロジェクトへ追加し、認証済みのPOSTルーターに
`trigger_image_sync` の分岐を追加する。GitHubトークンはコードへ書かず、Script Propertiesの
`GITHUB_ACTIONS_TOKEN` に保存する。必要権限とデプロイ手順は同ファイルのコメント、および実装時の
引き渡し手順に従う。
