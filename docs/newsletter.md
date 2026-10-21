# TECHNO JAPAN ニュースレター運用手順

このニュースレターは、アカウントを作るまでは現在の formsubmit のまま動きます。Buttondown のユーザー名を設定して公開した後に、登録先が切り替わります。

## 最初の設定

1. [Buttondown](https://buttondown.com/) でアカウントを作成する。
2. 送信者名を `TECHNO JAPAN`、返信先を `press@techno-japan.media` にする。
3. 住所・連絡先を表示する。これは特定電子メール法に対応するために必要です。
4. ダブルオプトインを有効にする。
5. `ja` と `en` のタグを作る。サイトのフォームは、日本語ページからの登録に `ja`、英語ページからの登録に `en` を付けます。
6. API キーを作り、リポジトリの作業ディレクトリで次を自分で実行する。

   ```bash
   gh secret set BUTTONDOWN_API_KEY
   ```

7. `scripts/newsletter-config.json` の `buttondownUsername` に Buttondown のユーザー名を入れ、`provider` を `buttondown` に変更する。

   ```json
   { "provider": "buttondown", "buttondownUsername": "あなたのユーザー名" }
   ```

8. `bash scripts/preflight.sh` を実行して確認してから公開する。フォームの切り替え後は、JA/EN のフォームがそれぞれ `ja`/`en` になっていることを確認する。

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
