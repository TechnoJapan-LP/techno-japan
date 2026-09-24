# 定量診断（2026-09-24）改善計画 — 設計 Claude / 実装 Codex

診断結果（総合 69/100）を、実装単位（WP = Work Package）に分けた計画。
**設計・レビュー・検証・git 操作は Claude、コード編集は Codex** の分業で進める。
各 WP の Codex 向け指示書は scratchpad に置き、完了ごとに `reports/handoff.md` へ記録する。

## 診断の要点（数値）

| 軸 | 点 | 未達の主要指標 |
|---|---|---|
| パフォーマンス | 72 | 1MB超画像 3枚 / 記事の実機重量 2,423KB（Drive 画像 1,898KB） |
| モバイル・a11y | 55 | コントラスト AA 違反 347箇所（43クラス）/ タップ領域<48px 61箇所（12クラス） |
| SEO/GEO/AIO | 88 | 記事の見出し階層スキップ 7/24 |
| コード品質 | 70 | ESLint エラー5（search.js no-undef）/ 未使用CSS 17 / 外部リンク 404×1・timeout×1 |
| セキュリティ | 58 | サーバーヘッダ 0/6（GitHub Pages）/ `'unsafe-inline'` 557枚 / onclick 1,114箇所 |

計測方法は `scripts/audit_a11y_browser.mjs`（本番 or ローカルを headless Chrome 393×852 dpr3 で走査）。
**改善前後は必ず同じスクリプトで測る。**

## WP 一覧と順序

| WP | 内容 | 担当 | 触るファイル | 効果（目標） | Publish経路 |
|---|---|---|---|---|---|
| WP1 | コントラスト・タップ領域の CSS 修正 | Codex → Claude 検証 | common.css / detail.css / article-fx.css / ハブ5枚の inline CSS | 違反 347→≤50、タップ 61→0 | 触らない |
| WP2 | インライン `onclick` / `onerror` の撤去（common.js へ移設） | Codex → Claude 検証 | common.js / build-detail-pages.mjs / ハブ HTML / favorites.html / about.html | onclick 1,114→0（CSP nonce 化の前提） | 触らない |
| WP3 | 画像同期に 1MB ガード＋既存3枚の再圧縮 | Codex → Claude 検証 | .github/workflows/sync-drive-images.yml / LP/images/festivals/*.webp（3枚） | 1MB超 3→0、以後も発生しない | 触らない（CI自身） |
| WP4 | `search.js` の global 宣言（ESLint エラー 5→0） | Claude 直接 | LP/search.js | 5→0 | 触らない |
| WP5 | 未使用 CSS 17クラスの削除 | Codex（WP1 と同時可） | common.css / detail.css | 17→0 | 触らない |
| C1 | 記事の見出し階層（h2→h4）を CMS で修正 | **ユーザー（CMS）** | スプレッドシート ARTICLES.body | 7/24→0 | Publish で反映 |
| C2 | 外部リンク修正（ultra-japan チケット404 / triangle timeout） | **ユーザー（CMS）** | FESTIVALS / VENUES | 2→0 | Publish で反映 |
| C3 | 記事本文の Drive 画像に alt（synapse 3枚） | **ユーザー（CMS）** | ARTICLES.body | 3→0 | Publish で反映 |
| D1 | 記事本文の Drive 画像をリポジトリ側 WebP へミラー（2,423KB→≤1,500KB） | 要設計（別 WP） | fetch/derivatives 経路 | — | 触る可能性あり |
| D2 | `frame-ancestors` / HSTS（Cloudflare 等の前段） | **判断待ち**（インフラ） | — | — | — |
| D3 | `cms.js` の未使用変数 166 | **やらない**（Publish 経路で効果小・リスク大） | — | — | — |

## 各 WP の完了条件

- WP1: `node scripts/audit_a11y_browser.mjs --local` で contrast 合計 ≤50・tap 0・overflow 0。
  PC 1280px で見た目の階層（active/inactive）が残っていること。preflight 全緑。
- WP2: `grep -c 'onclick=' LP/**/*.html` が 0（cms.html 除く）。ハブ・詳細でメニュー開閉、
  戻る（history.back）、stopPropagation 依存の操作が実ブラウザで動く。preflight 全緑。
- WP3: `find LP/images -size +1M` が 0。`python3 scripts/check_sync_retry.py` 緑。
  次回の Sync Drive Images 実行後も 3枚が 1MB 未満のまま（同期で巻き戻らない）。

## AGENTS.md の該当制約

- push = 公開。`bash scripts/preflight.sh` 全件成功が前提。
- ハブ JS は JA/EN 同一。EN ハブは `enHubFromJa` で生成 → **JA だけ編集し、再生成後に行数を比較**。
- `localize.js` に defer を付けない。`common.js` は defer（inline 描画からは呼べない）。
- CSS/JS を変えたら `python3 scripts/bump_asset_versions.py` で ?v を上げ、`DETAIL_CSS_VERSION` 等の定数も揃える。
- CMS / GAS / Publish 経路は今回どの WP でも触らない。
