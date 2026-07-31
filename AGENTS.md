# AGENTS.md

## データ構造

- すべてのデータ定義は [docs/DATA_SCHEMA.md](docs/DATA_SCHEMA.md) に従う。
- スプレッドシート「LP」が唯一のデータソース。コードにデータをハードコードしない。
- ID・GENRE・STATUS等の規約に反するデータを見つけたら、勝手に直さず報告する。

## ビルド運用の注意

- 再生成(build-detail-pages.mjs)の前に必ず git pull する。
  古い data.js でビルドすると Publish 済みの内容が巻き戻る。
- CMS の「Image from URL」は CORS 失敗時に無変換の原本を保存する。
  非 webp は Drive 同期でスキップされるため、成功トーストが出ても
  実際には反映されないことがある。
