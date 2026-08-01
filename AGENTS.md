# AGENTS.md

## データ構造

- すべてのデータ定義は [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) に従う。
- スプレッドシート「LP」が唯一のデータソース。コードにデータをハードコードしない。
- ID・GENRE・STATUS等の規約に反するデータを見つけたら、勝手に直さず報告する。

## SEO の担当範囲（設計方針）

- **SEO は静的ページ（`LP/articles/` `LP/festivals/` `LP/artists/` `LP/venues/`）が担う。
  SPA の詳細ビューは UI の利便性のためのもの。**
- **SPA 側に SEO 実装（JSON-LD 注入・meta 書き換え・canonical 更新）を新たに足さない。**
  JS を実行するクローラーは canonical が指す静的ページも読めるため、二重に持つ意味が薄い。
  二重実装は「片方だけ対応済み」の事故を生む。
- `news.html` だけが meta / canonical / JSON-LD の動的注入を持つのは**歴史的経緯**。
  ハッシュURLしか無かった時代の名残で、あるべき姿ではない。動いているので残しているだけ。
  **これを見本に他セクションへ横展開しないこと。**
- `festivals.html` 等の詳細ビューに canonical や JSON-LD が無いのは**意図した設計**であり、
  実装漏れではない。詳細は [AUDIT_TECHNO_JAPAN.md](AUDIT_TECHNO_JAPAN.md) §9-15。

## ビルド運用の注意

- 再生成(build-detail-pages.mjs)の前に必ず git pull する。
  古い data.js でビルドすると Publish 済みの内容が巻き戻る。
- CMS の「Image from URL」は CORS 失敗時に無変換の原本を保存する。
  非 webp は Drive 同期でスキップされるため、成功トーストが出ても
  実際には反映されないことがある。
- 複数エージェントが同一リポジトリで並行作業する場合、
  build-detail-pages.mjs の編集中は他セッションでビルドを実行しない。
  ビルド前に git status で他セッションの未コミット変更がないか確認する。
