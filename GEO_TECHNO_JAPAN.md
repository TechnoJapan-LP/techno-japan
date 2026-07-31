# GEO/AIO 実装指示書 — Techno Japan

> このファイルはターミナルの Claude Code / Codex に作業を渡すための指示書です。
> リポジトリのルートに置いて `AGENTS.md` から参照するか、そのまま貼り付けて使ってください。
> 技術スタック前提: **Next.js (App Router 想定) / React / TypeScript**

---

## 0. 進め方の原則

- **1サイトで型を作り、BEATRIP / SELETRADE に横展開する。** Techno Japan が最初のテンプレ元。
- 作った Schema コンポーネント・robots 設定・llms.txt 生成ロジックは、再利用前提で汎用的に書く。
- **分担: Claude = 戦略・文章・スキーマ設計 / Codex = 実装・コード・リファクタ。**
- 各フェーズの最後に `git commit` を挟み、施策単位で履歴を残す(効果測定のため)。

---

## Phase A. 現状監査(実装前に必ず実行)

Codex/Claude Code にリポジトリを読ませて、以下を報告させる。**まだ何も変更しない。**

1. **ルーティング構造の把握**
   - `app/` 配下(または `pages/`)のページ構成を列挙。
   - 記事ページ・アーティストページ・イベントページなど、テンプレートの種類を分類。

2. **既存 Schema.org の有無**
   - `application/ld+json` を含む箇所を全文検索(`grep -r "ld+json"`)。
   - あれば、どのスキーマ型が入っているか(Organization / Article など)。

3. **robots / メタの現状**
   - `app/robots.ts` `public/robots.txt` `app/sitemap.ts` の有無と中身。
   - AIクローラーを誤ってブロックしていないか。

4. **セマンティックHTML の健全性**
   - 記事テンプレートで `<h1>` が1つか、見出し階層が飛んでいないか。
   - `<div>` で見出し・リスト・表を代用している箇所がないか。

5. **画像・パフォーマンス**
   - `next/image` を使わず `<img>` 直書きの箇所。
   - フォント読み込み方法(`next/font` を使っているか)。

**アウトプット:** 上記を `AUDIT_TECHNO_JAPAN.md` として書き出す。以降の実装はこの監査結果に基づく。

---

## Phase B. 技術面の実装(優先度1)

### B-1. Schema.org / JSON-LD

再利用可能な JSON-LD コンポーネントを作る。最低限、以下の型を実装:

- **Organization**(全ページ共通・ルートレイアウトに配置)
  - `name`, `url`, `logo`, `sameAs`(公式SNS: Instagram等), `description`
- **NewsArticle / Article**(記事ページ)
  - `headline`, `datePublished`, `dateModified`, `author`(→ Person), `image`, `publisher`(→ Organization), `description`
- **Person**(執筆者・監修者 = E-E-A-T可視化)
  - `name`, `url`, `jobTitle`, `sameAs`
- **BreadcrumbList**(パンくず・AIのサイト構造理解を助ける)
- **FAQPage**(FAQを持つページのみ、Q&Aを構造化)

実装方針:
- 型安全に書く。`schema-dts` パッケージの利用を検討(TypeScriptで Schema.org の型が効く)。
- データは各ページのフロントマター/CMS/データソースから流し込む。ハードコードしない。
- `generateMetadata` と JSON-LD を分離し、JSON-LDは専用コンポーネント `<JsonLd data={...} />` として `<head>` or body に描画。

### B-2. robots.txt(AIクローラー許可)

`app/robots.ts` で以下を明示的に許可(特段の理由がなければ Allow):
- `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `OAI-SearchBot`, `Applebot-Extended`
- 既存の誤ブロックがあれば解除。
- `Sitemap:` 行を必ず含める。

### B-3. sitemap

`app/sitemap.ts` で全記事・全ページを動的生成。`lastModified` を正確に。

### B-4. セマンティックHTML 修正

Phase A の監査で見つかった箇所を修正:
- 見出しは `<h1>`〜`<h3>` の階層を厳守(1ページ1つの h1)。
- リストは `<ul>`/`<ol>`、比較・スペックは `<table>`。
- 記事本文は `<article>`、セクションは `<section>`。

### B-5. Core Web Vitals

- `<img>` → `next/image` へ置換。
- フォントを `next/font` で最適化。
- 計測: `npx unlighthouse` または Lighthouse でスコアのビフォーを記録。

### B-6. llms.txt(優先度低・最後でよい)

> 注記: 2026年時点で主要AI各社はllms.txtの本番採用を公式表明しておらず、実測でも取得率は低い。
> ただし Perplexity / Claude / コーディングエージェントは読むため、コストが低い範囲で設置する。
> **GEOの主戦力ではない。B-1〜B-4 を優先。**

- `public/llms.txt` に、サイト概要(1段落のブランド要約)+ 主要ページのURL一覧(Markdown形式)。
- 可能なら記事一覧から自動生成するスクリプトにする(手動メンテを避ける)。

---

## Phase C. コンテンツ構造(優先度2)

> ここは Claude(文章)主導。Codex はテンプレート/コンポーネント側を用意。

### C-1. 結論ファースト(BLUF)構造

- 各記事・各見出し(H2/H3)の直下に、**問いへの直接の結論を1〜2文**で置く。
- 記事冒頭に「結論要約ブロック」コンポーネントを用意(`<Summary>` 等)。

### C-2. FAQ の構造化

- ユーザーがAIに投げる自然言語の質問(「〜とは?」「〜の違いは?」)をそのまま見出しに。
- 直下に簡潔な回答。`FAQPage` スキーマ(B-1)と連動。

### C-3. 比較表・箇条書き

- アーティスト比較、イベント情報、機材などは `<table>` / 箇条書きで。
- 数値・一次情報(独自取材、動員数、セットリスト等)を明記 → AIが引用しやすい。

### C-4. エンティティ定義

- 専門用語・自社サービス名に「〇〇とは〜である」の定義文。
- Techno Japan 自体のエンティティ確立(何者で、どの分野の専門か)をAboutページで明確に。

### C-5. E-E-A-T 可視化

- 記事に執筆者名・肩書・実績・プロフィールへのリンク。
- Person スキーマ(B-1)と連動。

---

## Phase D. エンティティ・第三者言及(優先度3)

> コードではなく運用施策。Claude が戦略・文面を支援。

- 業界メディアへの寄稿 / PRプレスリリース。
- Reddit・比較サイト・コミュニティでの自然な言及形成。
- Wikipedia / 各種データベースでのエンティティ整合性(名称・表記ゆれの統一)。
- **リンクがなくても「名前が出る」ことに価値がある**(ブランドメンション)。

---

## 横展開(BEATRIP / SELETRADE)

Techno Japan で確定した以下を、パラメータだけ差し替えて移植:
- JSON-LD コンポーネント群(スキーマ型はサイトの性質で調整: サービス系なら `Service`/`Product` を追加)
- `app/robots.ts` / `app/sitemap.ts`
- 結論ファースト・FAQ・比較表のテンプレート
- llms.txt 生成スクリプト

---

## 効果測定(施策後に随時)

- 各AIサーフェス(ChatGPT / Claude / Perplexity / Google AI Overviews)で「テクノ 日本 メディア」等の想定クエリを投げ、Techno Japan が引用/言及されるか記録。
- サーバーログで AI クローラー(GPTBot / ClaudeBot / PerplexityBot)のアクセス頻度を監視。
- Phase 開始前のスナップショットと比較。
