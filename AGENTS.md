# AGENTS.md

## データ構造

- すべてのデータ定義は [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) に従う。
- スプレッドシート「LP」が唯一のデータソース。コードにデータをハードコードしない。
- ID・GENRE・STATUS等の規約に反するデータを見つけたら、勝手に直さず報告する。

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
- 複数エージェントが同一リポジトリで並行作業する場合、
  build-detail-pages.mjs の編集中は他セッションでビルドを実行しない。
  ビルド前に git status で他セッションの未コミット変更がないか確認する。
