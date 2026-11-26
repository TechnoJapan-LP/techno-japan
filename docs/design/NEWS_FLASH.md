# 速報記事（NEWS）を手早く作る仕組み — 段階1

2026-11-26 ユーザー決定。来年に向けた開催・出演者・チケットの発表を、1本5分程度の速報記事にする。

## 決定事項

- 速報は既存の記事カテゴリ `NEWS` を使う（新カテゴリは作らない）。
- **TOP の先頭（リードのカルーセル）に期限なしで載る。** リードは全記事の新しい順 4 本なので、新しい記事が出れば自然に後ろへ下がる（今の挙動のまま）。
- TOP に「NEWS」の固定枠を新設し、最新の NEWS 5 本の見出しを並べる。
- TOP の Stories（記事一覧）と Future 枠には NEWS を出さない。
- NEWS ページ（news.html）: 「ALL」には NEWS を出さない。「NEWS」タブにだけ全件残る。
- 記事ページ自体は残す（検索・Google ニュース）。他記事の「関連記事」にも NEWS は出さない。
- TOP 画像は、DB に既にあるフェスの素材（FESTIVALS.image / flyer、最新回の EDITIONS.FLYER）を背景にして、
  Techno Japan の文字組みを CMS の中で重ねて作る（外部の画像を新たに取り込まない）。
- 英語版（title_en / excerpt_en / body_en）も同時に作る。

## 1. サイト側の表示（ハブ JS・生成）

| 場所 | ファイル | 変更 |
|---|---|---|
| TOP リード | LP/top-phase2.js | 変更なし（NEWS も新しい順で入る） |
| TOP Future | LP/top-phase2.js | NEWS を除外 |
| TOP Stories | LP/top-phase2.js | NEWS を除外 |
| TOP NEWS 枠（新設） | LP/index.html ＋ top-phase2.js | Stories の前に `#top2-news`。最新 NEWS 5 本: 日付・見出し・フェス名。0 本なら枠ごと非表示 |
| NEWS ハブ | LP/news-phase3.js | category=ALL のとき NEWS を除外。NEWS タブでは全件 |
| 関連記事 | scripts/build-detail-pages.mjs | 他記事の関連記事候補から NEWS を除外 |

EN ハブは `enHubFromJa` が生成する（JA と同じ JS）。生成後に JA/EN の行数を比較する（AGENTS.md）。

## 2. CMS「速報を作る」

記事編集画面の上部に折りたためるパネル。

入力:
- フェス（既存の fest-picker を流用。必須）
- 知らせの種類: `lineup`（出演者発表）/ `dates`（日程発表）/ `tickets`（チケット発売）/ `other`
- 出典 URL（1 つ以上）
- 出典の本文（メルマガ本文・Instagram のキャプションなどを貼る）

「下書きを作る」で GAS の `ai_news_draft` を呼ぶ。返り値（JSON）:
```
{ title, title_en, excerpt, excerpt_en, body, body_en,
  facts: [{ field, value, quote }],   // 事実ごとに出典本文の引用
  artists: [string],                   // 出典本文に出てくる出演者名（表記そのまま）
  warnings: [string] }
```
CMS 側の検査（AI を信用しない）:
- `artists` の各名前が出典本文に**そのまま含まれる**か確認。含まれない名前は赤字で警告し本文に入れない。
- `facts[].quote` が出典本文に含まれるか確認。含まれない事実は警告。
- 出演者名を ARTIST DB と照合し（既存の matchArtist）、本文の出演者一覧で登録済みのものにリンク。
- 上の検査に通ったものだけフォームへ流し込む: category=NEWS、festivalId、title、excerpt、body、EN 3 項目、date=今日、slug 候補。

本文の型（ARTICLE_BODY_SPEC_FOR_AI.md の記法に従う）:
1. リード 1 文（何が発表されたか）
2. 要点の表: 日程 / 会場 / 出演者（発表分）/ チケット（発売日・価格・URL）— 出典にある項目だけ
3. 出演者一覧（発表順、登録済みはリンク）
4. 補足（あれば 1〜2 文。推測しない）
5. 出典（リンク）

## 3. TOP 画像の自動生成（CMS 内・canvas）

- 背景: 選んだフェスの EDITIONS.FLYER（最新回）→ FESTIVALS.image → FESTIVALS.flyer の順で最初にあるもの。
  サイトの同一オリジン画像（/images/...）を読むので CORS 問題なし。
- 1600×900。背景を cover で敷き、下半分に黒のグラデーション。
- 文字: 左下に種類ラベル（`LINEUP ANNOUNCED` / `DATES ANNOUNCED` / `TICKETS ON SALE` / `NEWS`）、
  フェス名（大）、日程・会場（小）。フォントはサイトと同じ（CMS ページで読み込み済みのものを document.fonts.ready 後に使う）。
- webp で書き出し、既存の記事画像アップロード経路（uploadArticleImageFile）に渡す。
- 生成前にプレビューを見せ、作り直し（ラベル変更）ができる。

## 4. GAS `ai_news_draft`

- scripts/gas-update/ に新関数。既存の `callClaude_` を使う（モデル・キーは既存設定）。
- システムプロンプト: Techno_Japan_Web_Style_Guide.md / Japanese_Writing_Guidelines.md の要点＋「出典本文にない事実を書かない」「丸写ししない」「出演者名は出典の表記のまま」「JSON だけ返す」。
- 貼り替え・再デプロイ後に `scripts/gas-update/snapshot.js` で指紋更新（AGENTS.md）。

## 段階2以降（今回は作らない）

- メルマガの自動取り込み（Gmail ラベル → シートの受け箱）
- Instagram Graph API の取り込み
- 出演者発表から LINEUPS 行・チケット URL を同時に提案
- フェス詳細ページに「最新ニュース」

## 検証（AGENTS.md）

- preflight 全件。TOP / NEWS ハブ（JA/EN・PC/スマホ）を実ブラウザで確認。
- CMS は cms.js を触るので: 実際に CMS で速報を 1 本下書き→プレビュー→画像生成→保存（下書きのまま）→再表示まで確認し、
  `gh workflow run "Publish pipeline"` を自分で流す。CMS を変えたらユーザーに Cmd+Shift+R を伝える。

## GAS の適用手順

1. Apps Script の「Techno Japan」プロジェクトに `scripts/gas-update/ai-news-draft.gs` を新しいスクリプトファイルとして追加し、内容をすべて貼り付ける。
2. `doPost` の既存 action dispatch に、次の1行を追加する。`data` は既存ルーターがJSONから取り出した入力を使う。
   `if (data.action === 'ai_news_draft') return buildResponse(aiNewsDraft(data));`
3. 保存後、Deploy → Manage deployments → 対象デプロイの edit → New version → Deploy で再デプロイする。保存だけでは本番のGAS実行環境は変わらない。
4. 認証済みCMSで「⚡ 速報を作る」を開き、読み取りではなく下書き生成だけを実データで確認する。動作確認のために本番データへ書き込まない。
5. GASへ貼り付け・再デプロイが完了した後、Apps Scriptエディタの開発者コンソールで `scripts/gas-update/snapshot.js` を実行し、出力を `scripts/gas-update/live-snapshot.json` に保存する。続けて `node scripts/check_gas_sync.mjs` を実行する。

`ai_news_draft` の dispatch がこのリポジトリにない場合も、上記の貼り付け先と一行を手作業で追加する。Claude APIキーは既存の `ANTHROPIC_API_KEY` を使い、記事の保存やPublishはCMS利用者が内容を確認してから手動で行う。
