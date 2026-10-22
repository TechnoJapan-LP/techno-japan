# デザインの地図

このサイトの色・文字・余白を探すときの入口です。今回の整理では、表示される値を変えずに、共通CSSから変更できる名前を付けました。

## どこに何があるか

- `LP/common.css`: 全ページ共通の背景、文字色、アクセント、フォント、ナビゲーション。
- `LP/detail.css`: フェス・アーティスト・会場・記事など静的な詳細ページの共通部分。
- `LP/article-fx.css`: 記事本文の演出。
- `LP/index.html`、`about.html`、`festivals.html`、`artists.html`、`venues.html`、`news.html`、`writers.html`: 各ハブ固有のインラインCSS。JA版を編集し、EN版は生成します。
- `scripts/build-detail-pages.mjs`: 詳細ページとENハブを生成する元ファイル。ここを直したら再生成します。
- `LP/cms.css` / `LP/cms.js`: CMS専用。今回の共通トークン化の対象外ですが、記事プレビューは公開ページのCSS版数を参照します。
- `scripts/newsletter-draft.mjs`: メール専用の色。CSS変数は使えないため、別途管理します。
- `LP/manifest.json`、HTMLの`theme-color`、OG画像: ブラウザやSNS用の色で、CSS変数は使えません。

## まず見るトークン

`LP/common.css`の`:root`が変更箇所です。

| 名前 | 値 | 主な使いどころ |
|---|---|---|
| `--bg` / `--bg-rgb` | `#080808` / `8, 8, 8` | ページ背景、黒の濃淡 |
| `--text` / `--text-rgb` | `#f0ede8` / `240, 237, 232` | 本文、線、面の濃淡 |
| `--accent` / `--accent-rgb` | `#ff2d2d` / `255, 45, 45` | 赤い強調、リンク、状態 |
| `--accent-soft` / `--accent-soft-rgb` | `#a82f31` / `168, 47, 49` | ワイン色の面・演出 |
| `--font-display` | `'Bebas Neue', sans-serif` | 大見出し |
| `--font-mono` | `'Space Mono', monospace` | ラベル、ナビ、メタ情報 |
| `--font-body` | `'DM Sans', sans-serif` | 本文、説明文 |

`--text-a01`〜`--text-a90`、`--bg-a02`〜`--bg-a97`、`--accent-a03`〜、`--accent-soft-a06`〜は、それぞれ既存の透明度をそのまま表します。たとえば文字色を全体で変えるなら`--text`と`--text-rgb`を変更します。特集カード等の既存パレットは`--palette-<16進値>`として値を保持しています。

## CSS変数が使えない場所

次はCSSの中から変数を参照できないため、変更時に個別確認が必要です。

- `LP/manifest.json`の`theme_color` / `background_color`
- 各HTMLの`<meta name="theme-color">`
- `scripts/newsletter-draft.mjs`の`COLORS`
- OG画像やSNS画像そのもの（画像ファイル内の色）
- `data:image/svg+xml`の埋め込み画像内の色

これらは見た目の比較対象から漏れやすいので、変更後にブラウザとSNS用素材も確認します。

## デザイン変更の手順

1. ブランチを作る。
2. `node scripts/visual-snapshot.mjs capture /private/tmp/design-before`で変更前を撮る。
3. トークンまたは必要な個別値を変更する。
4. CSS/JSの`?v=`を上げる。詳細ページは`build-detail-pages.mjs`の版数を上げる。
5. `node scripts/build-detail-pages.mjs`で詳細ページとENハブを再生成する。
6. `node scripts/visual-snapshot.mjs capture /private/tmp/design-after`、続けて`compare`で比較する。撮影後の健全性確認と比較は `scripts/visual-compare.py`（Pillow）が行い、ほぼ単色の画像があれば比較を止めます。
7. `python3 scripts/check_asset_versions.py`、`bash scripts/preflight.sh --fast`を通す。
8. 実ブラウザで代表ページをJA/EN・PC/モバイル確認してから公開する。

## `?v=`を上げ忘れやすい場所

- `build-detail-pages.mjs`の`COMMON_CSS_VERSION`、`DETAIL_CSS_VERSION`、`ARTICLE_FX_CSS_VERSION`。
- ハブHTMLの`common.css?v=`。
- `LP/cms.html`の`cms.js?v=`。
- `LP/cms.js`内の記事プレビュー用`common.css`、`detail.css`、`article-fx.css`の版数。

CMSの版数を変えた場合は、`scripts/check_cms_article_generated_preview.mjs`も実行します。生成物を保存しただけでは公開版は変わりません。

## スナップショットツール

デザイン変更のときは`visual-snapshot`で変更前・変更後の画像を撮り、差分画像を目で見て「触っていない所が崩れていないか」を確かめます。

**注意（2026-10-22 実測）**: 背景のアニメーション（グリッドの動き等）のため、同じページを2回撮っても最大約4%の差が出ます。
差分の割合だけで「変わった／変わっていない」を判断しないこと。変更前を2回撮って比べた結果（揺れの大きさ）と並べて見る。

見た目を1pxも変えない整理（トークン化など）の確認は、全要素の計算後スタイル（色・線・書体・大きさ・透明度など）を変更前後で比べる方法で行った
（2026-10-22、20ページ×2幅・約2.5万要素で差 0。手順は reports/handoff.md の同日の記録）。この比較を道具化した版は誤検出が多く、採用していない。

```bash
node scripts/visual-snapshot.mjs capture <出力dir>
node scripts/visual-snapshot.mjs compare <変更前dir> <変更後dir>
python3 scripts/visual-compare.py check <出力dir>
python3 scripts/visual-compare.py compare <変更前dir> <変更後dir> [--out <差分dir>]
python3 scripts/visual-compare.py --self-test
```

390px（DPR 2・タッチ）と1280px（DPR 1）で代表ページを撮影し、最大6000pxまで縦方向を比較します。比較は同名 PNG のサイズと RGB 差（いずれかの値が16超の画素割合）を判定し、差分画像と変更範囲の変更前・変更後画像を出力します。Chromeがlocalhostにbindできない環境では撮影できないため、その場合は「未実施」と記録してください。
