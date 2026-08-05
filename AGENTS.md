# AGENTS.md

## データ構造

- すべてのデータ定義は [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) に従う。
- スプレッドシート「LP」が唯一のデータソース。コードにデータをハードコードしない。
- ID・GENRE・STATUS等の規約に反するデータを見つけたら、勝手に直さず報告する。

## 文章を書くとき

- **DESC / DESC_EN / BIO / bio_en / 記事本文を書くときは
  [docs/writing/](docs/writing/) のガイドに従う。**
  - [Techno_Japan_Web_Style_Guide.md](docs/writing/Techno_Japan_Web_Style_Guide.md)
    サイト掲載文の文体・編集ルール。データベース項目の要件は §10
  - [Japanese_Writing_Guidelines.md](docs/writing/Japanese_Writing_Guidelines.md)
    日本語の文体・表記
  - [Instagram_Post_Templates.md](docs/writing/Instagram_Post_Templates.md)
    SNS 投稿の型
- **事実主義が最優先。** ソースに無い情報を推測で補わない。
  調査で埋めた値は `data/inbox/<id>.json` に出典と確度が残っているので、
  文章を書く前にそれを確認する（`confidence: low` の値を断定的に書かない）。

## 詳細ページと SPA（設計方針）

- **詳細ページは静的生成のみ。** `LP/festivals/` `LP/artists/` `LP/venues/` `LP/articles/`
  を `build-detail-pages.mjs` が生成する。SEO も UI も、詳細はここが唯一の実体。
- **ハブページ（`festivals.html` 等）は一覧・検索・フィルタだけを担う。**
  詳細ビューは持たない。2026-08-02 に全4セクションで廃止した。
- **ハブから詳細への遷移は通常の `<a href="/festivals/xxx.html">`。**
  `preventDefault()` で横取りしない。クリックに処理を挟む場合（スクロール位置の保存等）も
  遷移そのものは止めないこと。回帰ガード:
  `python3 scripts/audit_spa_vs_static.py --after`

### SPA 詳細ビューを再導入しないこと

「一覧ページで詳細も見せた方が速い」という発想は自然に出てくるが、**やらない。**

2026-08-01 に「SEO は静的ページが担うので SPA 側は UI 専用でよい」と判断したが、
これは誤りだった。カードが `preventDefault()` で SPA へ遷移するため、
**JS 有効の通常ユーザーは静的詳細ページに一度も到達していなかった。**
静的側にだけ実装した FAQ・開催ヒストリー・要約文・回遊ブロックなど
**878件の内容がクローラーにしか届いていなかった**（実測 / `reports/spa-vs-static.md`）。

同じ内容を2箇所に持つと、必ず片方だけ古くなる。実際に起きたこと:

- `artists.html` の SPA 詳細が `${a.bio}` をガード無しで埋め、96件で
  画面に文字列 `undefined` を表示していた
- `festivals.html:1463` の `f.genre.map` が GENRE 未設定の5件で落ち、
  詳細が白紙になっていた
- 回遊ブロック420本（festival 300 / venue 120）が SPA 側に無く、
  **「詳細 → 詳細」の導線が切れていた**

経緯と実測は [AUDIT_TECHNO_JAPAN.md](AUDIT_TECHNO_JAPAN.md) §9-20（判断の誤り）/
§9-23（廃止完了）。

### meta / canonical / JSON-LD

- ハブは**静的な** canonical と JSON-LD を持つ（一覧ページとしてのもの）。
  4ハブとも同一構造で、JS による書き換えは無い。
- **JS で meta / canonical / JSON-LD を書き換えないこと。** 詳細の URL は
  静的ページなので、動的注入の必要が無い。
- かつて `news.html` だけが動的注入を持っていたが、SPA 詳細の廃止（`38e0325`）で
  一緒に消えた。**現在は4ハブとも特別扱いは無い。**

## ハブの言語分岐（JA / EN）

EN ハブ5枚（festivals / artists / venues / news / index）は
`build-detail-pages.mjs` の `enHubFromJa` が JA から機械生成する。

- **ハブ JS を JA/EN で同一に保つ。** 言語分岐は実行時に
  `LP/localize.js` の `TJ_LANG`（`document.documentElement.lang`）で行う。
- **`enHubFromJa` で JS の式を置換しないこと。** `f.desc` → `f.desc_en` のような
  置換は `f.desc_en_en` や `festival-desc-jp` にも当たる。下の
  「HTML を正規表現で扱うときの注意」と同じ罠で、あちらより危険。
- 生成後は **JA と EN の行数を比較**する（5枚とも一致するのが正常）。

### ⚠️ localizedValue 相当が2箇所にある

同じフォールバック規則の実装が**2つ**ある。**片方だけ直さないこと。**

| 場所 | 用途 | 形 |
|---|---|---|
| `scripts/build-detail-pages.mjs` の `localizedValue()` | 詳細ページ。ビルド時にサーバ側で解決 | `(primary, ja, en, lang)` |
| `LP/localize.js` の `tjLocalized()` | ハブ。ブラウザで実行時に解決 | `(primary, ja, en)` — lang は `TJ_LANG` から暗黙 |

規則は同一（`en` なら `en || primary || ja`、`ja` なら `ja || primary || en`）。
ハブはブラウザ、詳細はビルド時なので実行環境が違い、1本には寄せていない。

### ⚠️ localize.js に `defer` を付けないこと

ハブのインライン描画スクリプトは**パース中に同期実行**され、その時点で
`tjLocalized` を呼ぶ。`defer` にすると描画時に未定義になり、全カードが
フォールバック側に落ちる。2026-08-03 に headless Chrome で実測して確認した
（inline 実行時 `UNDEFINED` / DOMContentLoaded 時 `defined`）。
`data.js` と `image-dimensions.js` が `defer` 無しなのと同じ理由。
`common.js` は `defer` なので**ここには置けない**（一度そう設計して撤回した）。

### データ側の前提

- **`name_en` は入力しない方針**（2026-08-03 判断）。フェス・アーティスト・
  会場名はほぼ英字表記が実態で、別列を持つ意味が薄い。`tjLocalized(x.name, '', x.name_en)`
  は現状 no-op だが、将来 NAME_EN が入ったとき描画側を触らずに済むよう通してある。
  日本語名のもの（`森、道、市場` / `円相芸術音楽祭` / `御月民 -OTSUKIMI-` 等）だけ
  いずれ英語表記を検討する。
- `desc_en` はフェス89/89・会場22/22 で揃っている。記事の
  `title_en` / `excerpt_en` / `body_en` は未入力（CMS の「🌐 ENGLISH VERSION」）。

## HTML を正規表現で扱うときの注意

- **閉じタグの並びを境界にしない。** 例: `<span class="nav-lang">[\s\S]*?</span></span>`
  は言語トグルの JA 側にマッチしない。現在言語は `<span>`、相手言語は `<a>` で
  出すため、JA は `</a></span>`、EN は `</span></span>` で終わり構造が非対称。
  1日に2回踏んだ（生成コードで152行を誤削除／検証コードで誤検出）。
- 代わりに **生成側が出す固定文字列をそのまま探す**か、開始タグからタグ名を取って
  対応する閉じタグを探す。詳細は [AUDIT_TECHNO_JAPAN.md](AUDIT_TECHNO_JAPAN.md) §9-16。
- 生成物を機械置換するときは、置換後に必ず **JA と EN の行数を比較**する。
  行数が変われば何かを巻き込んでいる。

## ビルド運用の注意

- 再生成(build-detail-pages.mjs)の前に必ず git pull する。
  古い data.js でビルドすると Publish 済みの内容が巻き戻る。
- CMS の「Image from URL」は CORS 失敗時に無変換の原本を保存する。
  非 webp は Drive 同期でスキップされるため、成功トーストが出ても
  実際には反映されないことがある。

## FESTIVAL の開催回を更新するとき

- FESTIVAL_ID（ブランドID）は変更しない。開催回は EDITIONS シートの
  `EDITION_ID={FESTIVAL_ID}-{年}` を選択・編集する。
- 日程、会場、住所、座標、チケット、フライヤー、ステータスは EDITIONS の値を更新する。
  FESTIVALS の `DATE` を翌年へ上書きして過去回を消してはいけない。
- 出演者は LINEUPS シートで同じ EDITION_ID の行を編集する。ARTIST_ID は
  ARTISTS の小文字ハイフン区切り ID と完全一致させる。
- CMS の FESTIVALS 編集画面では開催回を選択して保存できる。保存後は Publish pipeline が
  EDITIONS / LINEUPS を再取得して生成物を更新する。
- 新規開催回は CMS の「Add Edition」から追加する。既存の開催回を編集した場合は
  `update_row`、新規行はシート末尾への追記として保存される。保存後に公開前ガードを通す。
- 既存の開催回から翌年を作るときは「次回開催を作成」を使う。会場・住所・座標は引き継ぐが、
  日程・チケット・フライヤー・LINEUPは空欄で作成されるため、内容を確認してから保存する。
  元の開催回は変更されず、過去の履歴として残る。
- 複数エージェントが同一リポジトリで並行作業する場合、
  build-detail-pages.mjs の編集中は他セッションでビルドを実行しない。
  ビルド前に git status で他セッションの未コミット変更がないか確認する。

## セッション間の引き継ぎ

- 短期的な作業状態・次の担当への注意は [reports/handoff.md](reports/handoff.md) に記録する。
- 作業完了時は、実装と検証の後、`reports/handoff.md` に完了報告を追記してから、そのファイルを含めてコミットする。
- 必須項目は「実施」「コミット」「検証」「変更したパターン」「未確認の類似パターン」「次の担当への注意・判断待ち」の6項目。空欄は禁止し、「確認済み・0件」「なし」など明示する。
- 変更報告には、変更したパターンを具体的に列挙する。類似する未確認パターンも具体的に列挙し、確認したが該当しなければ「確認済み・0件」と書く。
- 並行セッションでは、追記前に最新をpull/rebaseする。既存エントリを改変せず、競合時は両方のエントリを残す。
- 恒久的な判断・事故の経緯・設計理由は `AUDIT_TECHNO_JAPAN.md` に記録し、handoffからリンクする。
