# TECHNO JAPAN ニュースレター運用手順

現在の状態（2026-10-21）：Buttondown（ユーザー名 `technojapan`）へ切り替え済みです。送信ドメイン `techno-japan.media` は認証済みです。JA の登録には `ja`、EN の登録には `en` タグが付きます。ライター応募などニュースレター以外のフォームは formsubmit のままです。

## 最初の設定

1. [Buttondown](https://buttondown.com/) でアカウントを作成する。
2. 送信者名（表示名）を `TECHNO JAPAN`、返信先を `news@techno-japan.media` にする。送信元アドレスも `news@techno-japan.media` にする。
3. Buttondown の「独自ドメインからの送信」で `techno-japan.media` を登録する。Buttondown に表示される DNS レコード（SPF / DKIM / Return-Path）を DNS に追加する。既存の SPF レコードがある場合は、SPF を複数にせず、既存の内容と Buttondown の指定を1本にまとめる。
4. `news@techno-japan.media` を Gmail に転送しておく。返信や配信停止の連絡が届く窓口です。
5. 住所・連絡先を表示する。これは特定電子メール法に対応するために必要です。
6. ダブルオプトインを有効にする。
7. `ja` と `en` のタグを作る。サイトのフォームは、日本語ページからの登録に `ja`、英語ページからの登録に `en` を付けます。
8. API キーを作り、リポジトリの作業ディレクトリで次を自分で実行する。

   ```bash
   gh secret set BUTTONDOWN_API_KEY
   ```

9. Buttondown の設定にある「ユーザー名」と「表示名」は別物です。ユーザー名は URL `https://buttondown.com/○○○` の `○○○` 部分（英数字）で、サイトのフォームに使うのはこのユーザー名です。表示名（`TECHNO JAPAN`）を `buttondownUsername` に入れないでください。
10. `scripts/newsletter-config.json` の `buttondownUsername` に Buttondown のユーザー名を入れ、`provider` を `buttondown` に変更する。

   ```json
   { "provider": "buttondown", "buttondownUsername": "あなたのユーザー名" }
   ```

11. `bash scripts/preflight.sh` を実行して確認してから公開する。フォームの切り替え後は、JA/EN のフォームがそれぞれ `ja`/`en` になっていることを確認する。

## 毎月の流れ

毎月25日に GitHub Actions が下書きを作ります。API キーが登録済みなら Buttondown に JA/EN の下書きが2本作られ、未登録なら `reports/newsletter/` に Markdown の下書きが作られます。

1. 編集部のひとことを3〜4行で書く。
2. 「今月の注目（候補）」から3本を選ぶ。
3. 本文、リンク、言語、タグを確認する。
4. Buttondown で予約送信する。
5. 翌月に開封率を確認する。

下書きは既存データにある日付、名称、場所、紹介文だけを使います。公開情報にない説明は追加しません。

## 既存登録者の移行

formsubmit で届いた登録者を移すときは、本人がニュースレターの受信に同意したことを確認してください。過去に別の目的で提供されたメールアドレスを、確認なしに一括移行しないでください。移行後も Buttondown のダブルオプトインを使い、本人が登録を確定できる状態にします。

## 切り替え前に戻す場合

`newsletter-config.json` を次に戻して公開すると、formsubmit に戻ります。

```json
{ "provider": "formsubmit", "buttondownUsername": "" }
```
