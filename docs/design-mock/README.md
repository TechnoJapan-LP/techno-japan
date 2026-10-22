# design-mock

Claude Design キャンバス「Techno Japan — TOP Redesign」からの書き出し（2026-10-22）。
実装仕様は `../REDESIGN_SPEC.md`。

- `*.dc.html` — 各ページのモック（Claude Design の形式）。そのままブラウザでは動かない。
  - `{{...}}` = データ差し込み、`<sc-for>` / `<sc-if>` = ループ／条件、`class Component` の `renderVals()` = データ整形ロジック
  - `Mobile*.dc.html` は同じページを 390px 幅で表示するラッパー（中身は PC 版と共通、CSS の `max-width:900px` で切り替え）
  - `Search.dc.html` / `Menu.dc.html` は全ページ共通の検索オーバーレイとスマホメニュー
  - `System.dc.html` はデザインシステムの説明ボード
- `tj-data.js` / `tj-data.json` — モックが読んでいるデータ（`LP/data` と `data.js` から同期したもの。articles 21 / festivals 25 / artists 53 / venues 22）
- `img/` — モックで使っている画像（本番の `images/derivatives/` の派生）
- `canvas.json` — キャンバス上の配置（参考）

本番コードには影響しません。
