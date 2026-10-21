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

毎月25日に GitHub Actions が「今月の注目（候補）」つきの下書きを自動で作ります。API キーが登録済みなら Buttondown に JA/EN の下書きが2本作られ、同じ件名の既存 draft があればその draft を PATCH して上書きします。送信済み・予約済みなど draft 以外のメールは検索・更新しません。未登録なら `reports/newsletter/YYYY-MM-ja.html` / `-en.html` に完全なHTMLの下書きが作られます。

1. 編集部のひとことを3〜4行で書く。
2. 「今月の注目（候補）」から注目2件を決め、Claude に FESTIVAL_ID を伝える。
3. Claude が `picks=id1,id2` 付きで workflow を再実行する。同じ号の下書きが上書きされ、「今月の注目」だけが確定版になる。
4. 本文、リンク、言語、タグを確認する。送信前にプレビューで記事カード画像が表示されているか確認する。
5. Buttondown で予約送信する。
6. 翌月に開封率を確認する。

workflow_dispatch では `picks`（FESTIVAL_IDを2件、カンマ区切り）と `month`（YYYY-MM）を任意で指定できます。`picks` を指定した場合、対象月に開催予定がないIDはエラーになります。記事は前月1日から下書き作成日までを対象に、`LP/data/popular.json` の閲覧数順で最大4件を掲載します。

記事カード画像は、下書き作成時に `LP/images/newsletter/<月>/<記事ID>.webp` として600×400（3:2）に準備されます。既存画像は再作成しません。フェスのフライヤーとアーティスト写真は切り抜きません。

## HTML下書きとButtondownのテンプレート

`scripts/newsletter-draft.mjs --dry --month=YYYY-MM` は、メールクライアント向けに table レイアウトとインライン style だけを使ったHTMLを `reports/newsletter/` に出力します。Buttondown Emails API の `body` は HTML または Markdown を受け付け、HTML は自動判定されます。下書きの API payload では `template: "naked"` を指定し、生成した本文の外側に Buttondown の標準テンプレートを重ねない形にしています。

Buttondown のテンプレート設定で外枠を確認し、本文をそのまま使う `Naked`（API値は `naked`）を選んでください。Naked mode は Professional plan で利用でき、解除リンクとして `{{ unsubscribe_url }}` を本文に含める必要があります。Naked 以外のテンプレートでは本文の外側にテンプレートが付くため、600pxの外枠が二重になる可能性があります。テンプレートを切り替えた場合は、プレビューで外枠と配信停止リンクを確認してください。

参照: [Creating an email](https://docs.buttondown.com/api-emails-create)、[Email template](https://docs.buttondown.com/api-emails-template)、[Naked mode](https://docs.buttondown.com/naked-mode)、[Drafting emails via the API](https://docs.buttondown.com/drafting-emails-via-the-api)。

下書きは既存データにある日付、名称、場所、紹介文だけを使います。公開情報にない説明は追加しません。

## 既存登録者の移行

formsubmit で届いた登録者を移すときは、本人がニュースレターの受信に同意したことを確認してください。過去に別の目的で提供されたメールアドレスを、確認なしに一括移行しないでください。移行後も Buttondown のダブルオプトインを使い、本人が登録を確定できる状態にします。

## 切り替え前に戻す場合

`newsletter-config.json` を次に戻して公開すると、formsubmit に戻ります。

```json
{ "provider": "formsubmit", "buttondownUsername": "" }
```
