# 全方位診断と地続きのロードマップ（2026-08-13）

**すべて提案のみ。本番は変更していない。**

依頼テンプレートの前提2枠（「本日のCodexとの作業内容」「今後の予定」）は
**空欄のまま**だったため、想像で埋めず、リポジトリの記録から実際の文脈を使った。

- **本日の実績（記録から）**: Codex がイベント検索・TOP の NEXT イベント表示・
  出演者表示・記事本文レイアウトを本番公開（`c7fbf503`）。push 前に
  preflight 全26件を通過（昨日定めたルールが初日から機能）。
- **直近の到達点**: 静的473ページ / preflight 26検査 / CI 見張り番 /
  GAS 指紋同期 / 地図の全国対応（map.html・venues.html とも）。

診断は**全項目を実測してから**書いた。一般論は書かない。

---

## 前提の訂正 — テンプレートと実態のずれ

依頼文には「何万もの動的ページ」とあるが、**実態は静的473ページ**である。
この差は些細ではない。**6章（インフラ）と7章（CMS）の答えを根本から変える。**
何万ページの動的サイトなら SSR/ISR とヘッドレス CMS は正しい。
473ページの静的サイトには、どちらも**過剰であり、むしろ後退**になる。

---

## 1. 既存バグ・UI/UX のボトルネック（実測）

### 実測で見つかった問題

| 箇所 | 実測 | 基準 | 判定 |
|---|---|---|---|
| 本文テキスト | コントラスト 17.15:1 | 4.5:1 | ✅ |
| info-card 説明文 (13px) | 7.39:1 | 4.5:1 | ✅ |
| フィルタ非選択 (9px) | 4.71:1 | 4.5:1 | ✅ ただし余裕 0.21 |
| **エリア名ラベル (9px)** | **1.65:1** | 4.5:1 | ❌ |
| **地図フィルタのタップ領域** | **約27px** | 44px | ❌ |

エリア名（SHIBUYA 等）は `pointer-events:none` の装飾なので、
**読ませる意図が無いなら「読めなくてよい」と宣言するのが正しい**。
潰すのではなく支援技術から隠す:

```js
// map.html — エリア名ラベル生成箇所（L.divIcon の html）
html: `<span aria-hidden="true">${a.name}</span>`,
```

タップ領域は見た目を変えずに当たり判定だけ広げられる:

```css
/* venues.html / map.html の .vm-pill / .filter-pill */
.vm-pill { position: relative; }
.vm-pill::after {           /* 見た目はそのまま、押せる範囲だけ 44px に */
  content: ''; position: absolute; inset: -9px 0;
}
```

### 良かった点（直さなくてよい）

- `prefers-reduced-motion` は article-fx / detail / common で対応済み
- hreflang は JA/EN/x-default の3本が全詳細ページにある
- CSP は全ページ配備済み（§security-baseline）

---

## 2. モバイルの極限最適化

### 実測

- `touch-action` の指定: **どこにも無い**。ダブルタップズーム待ちの
  300ms 遅延は現代のブラウザではほぼ解消済みだが、地図の上のボタンは
  スクロールとの競合が起きうる。
- 親指ゾーン: フィルタ列は画面上部にある。**片手操作では届きにくい**が、
  これは意匠の根幹に関わるため、数値でなく判断の問題。変更は提案しない。
- 画面回転: ハブはグリッドが `auto-fill` なので崩れない（実測済みの
  check_hub_pages が毎回見ている）。

### 提案（小さく効く2点だけ）

```css
/* 地図のフィルタボタン — スクロール開始とタップの競合を断つ */
.vm-pill, .filter-pill { touch-action: manipulation; }

/* 9px 固定を、小さい画面でだけわずかに持ち上げる（意匠は保つ） */
.vm-pill { font-size: clamp(9px, 2.4vw, 11px); }
```

CPU/バッテリー: 重いアニメーションは現状ほぼ無い（article-fx は
IntersectionObserver 駆動で、常時 rAF を回すループは無い）。
**Web Worker や will-change の導入は現状では不要**。will-change は
付けっぱなしにするとむしろメモリを食う。必要になったときに、
その要素にだけ付ける。

---

## 3. テクノの美学と両立する軽量インタラクション

### 現状

- カーソル演出（tjBindCursorExpand）・記事スクロール演出 v2 は導入済み
- 慣性スクロール（Lenis 等）は**未導入**

### 判断

慣性スクロールは INP を悪化させる代表格で、**導入するなら CSS
`scroll-behavior` と `scroll-timeline` の範囲に留める**のが本サイト向き。
JS スクロールジャックは、いま preflight が守っている
「JS が死んでもページは読める」という設計と相性が悪い。

キネティック・タイポグラフィをやるなら、この形だけ推奨する
（コンポジタのみで動き、メインスレッドを触らない）:

```css
@media (prefers-reduced-motion: no-preference) {
  .hero-title span {
    animation: rise 0.6s cubic-bezier(0.16,1,0.3,1) backwards;
    animation-delay: calc(var(--i) * 40ms);
  }
  @keyframes rise { from { transform: translateY(0.6em); opacity: 0; } }
}
```

transform / opacity 以外を animate しない。これだけで CLS/INP は守られる。

---

## 4. SEO と表示速度

### 実測 — 構造化データはかなり良い。惜しいのは3点

現状: Festival + subEvent（開催回に startDate/endDate/location 入り）+
FAQPage + BreadcrumbList / MusicVenue / NewsArticle。**土台は既にある。**

欠けているもの（**データはシートに全部ある**のに JSON-LD に出ていない）:

| 欠け | 元データ | 効果 |
|---|---|---|
| `performer`（出演者） | LINEUPS シート | 「誰が出るか」で引用される |
| `offers`（チケット） | EDITIONS.TICKETURL | リッチリザルトの必須項目 |
| `eventStatus` | EDITIONS.STATUS | 中止・延期の明示 |

`build-detail-pages.mjs` の subEvent 生成箇所に足すだけ:

```js
// subEvent（開催回）の JSON-LD に追加
...(lineup.length && {
  performer: lineup.map((a) => ({ '@type': 'MusicGroup', name: a.name })),
}),
...(ed.TICKETURL && {
  offers: { '@type': 'Offer', url: ed.TICKETURL,
            availability: 'https://schema.org/InStock' },
}),
eventStatus: 'https://schema.org/EventScheduled',
```

### 実測 — 重大な発見: robots.txt が地図を隠している

```
Disallow: /map.html
```

昨日**全国対応にしたばかりの地図が、検索エンジンから見えない**。
東京専用だった頃の判断が残っているだけの可能性が高い。
1行削るだけだが、意図（CMS と同列に隠したかった？）の確認が先。

### Core Web Vitals の目標値

| 指標 | 目標 | 現状の見立て |
|---|---|---|
| LCP | < 2.0s | 静的+Fastly なので素性は良い。ヒーロー画像に `fetchpriority="high"` が無い |
| INP | < 200ms | data.js 187KB の同期パースが唯一の重り。現状は許容内 |
| CLS | < 0.1 | image-dimensions.js で寸法予約済み。維持 |

**Lighthouse CI は現在「測るだけで落ちない」**。しきい値を入れる:

```yaml
# .github/workflows/lighthouse.yml の with: に追加
configPath: ./.lighthouserc.json
```
```json
{ "ci": { "assert": { "assertions": {
  "categories:performance": ["error", { "minScore": 0.85 }],
  "categories:accessibility": ["error", { "minScore": 0.9 }],
  "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
}}}}
```

---

## 5. AIO / GEO（AI検索・生成AI最適化）

### 実測

- **llms.txt が無い**（AI クローラー向けのサイト案内。低コストで効く）
- robots.txt は `User-agent: *` で AI クローラーも許可済み（現状維持でよい）
- RSS あり / sitemap あり / 開催回に日付入りの Event スキーマあり
  → **「今週末のフェス」系の質問に答える材料は既に構造化されている**

### 提案1: llms.txt をビルドで生成する

手で書くと必ず古くなる。data.js から生成する（生成スクリプトの新設）:

```
# TECHNO JAPAN — techno-japan.media
> 日本のテクノ・ハウスの フェス96・アーティスト103・会場22 を
> 構造化データ付きで掲載する独立メディア。JA/EN。

## Festivals（開催日・場所・出演者つき）
- [ALA](https://techno-japan.media/festivals/ala.html): 2026-09-xx, 長野
- …（PUBLISHED のみ、日付降順）

## Data
- Sitemap: /sitemap.xml   RSS: /rss.xml
```

### 提案2: 機械可読のイベント一覧 `/events.json`

Perplexity や AI Overviews は「一覧を1回で読める JSON」を強く好む。
ビルド時に EDITIONS から生成（announced/on-sale のみ、日付順）:

```json
[{ "name": "LOA-LOST PARADISE- 2026", "start": "2026-08-15",
   "end": "2026-08-16", "pref": "Ibaraki", "venue": "Nalu Beach",
   "lat": 36.16, "lng": 140.58, "genres": ["TECHNO"],
   "url": "https://techno-japan.media/festivals/loa-lost-paradise.html" }]
```

### Google ビジネスプロフィールについて（正直な答え）

GBP は**実店舗・拠点のある事業者向け**で、メディアサイトそのものは
登録対象にならない。「Google Maps で1位」はこのサイトの立場では
**会場側の GBP に引用されること**が現実的な経路。効くのは上の
Event スキーマ（geo 付き）と、会場ページの正確な住所・座標の維持。
**登録を推奨する提案はしない**（できないことを提案しない）。

---

## 6. インフラ構成 — 移行しないことを推奨する

### 判断: GitHub Pages のまま。SSR/ISR へは行かない

| 観点 | 現状（GitHub Pages） | Vercel/SSR 移行後 |
|---|---|---|
| ページ数 | 473（静的で十分な規模） | 同じものを動的に作るだけ |
| 配信 | Fastly の CDN で全世界エッジ済み | 同等（改善なし） |
| 更新頻度 | Publish 時のみ（数分で反映） | ISR でも体感差なし |
| 障害点 | GitHub のみ | GitHub + Vercel + ランタイム |
| 費用 | 0円 | 従量課金 |
| **失うもの** | — | **preflight 26検査・publish pipeline・見張り番・§9-50〜78 の全知見** |

「リアルタイムなフェス情報」は要件として存在しない
（開催情報の更新は日単位。Publish パイプラインで足りている）。

**再検討のトリガー**（これが起きたら移行を検討する、を先に決めておく）:
- ページ数が 5,000 を超える（ビルド時間が数分を超え始める）
- ログイン・パーソナライズ・コメント等の動的機能が要件になる
- 更新から反映までを1分未満にする業務要件が生まれる

---

## 7. ヘッドレス CMS — これも移行しない。理由は §9 の全歴史

MicroCMS / Contentful / Sanity への移行は**推奨しない**。

1. **スキーマは既に設計済みで、稼働している。**
   FESTIVALS ↔ EDITIONS ↔ LINEUPS ↔ ARTISTS、ARTICLES.festivalId の
   リレーションは docs/DATA_SCHEMA.md に文書化され、CMS（cms.html）と
   生成系がその上で動いている。ヘッドレス CMS で作り直すのは
   **同じものをもう一度作る**ことに等しい。
2. 直近2週間で潰した事故（列名ゆれ §9-69、取得経路差 §9-67、
   二重定義 §9-72…）は**移行すれば消える種類の問題ではなく、
   移行先で別の顔をして再発する**。今は検査26本が張ってある。
3. 費用: 現構成は0円。リレーション必須の規模だと Contentful/Sanity は
   月額課金帯に入る。

**再検討のトリガー**:
- 同時編集者が3人を超える（Sheets の行ロック無し運用が破綻する）
- 権限分離（編集者ごとの担当範囲）が要件になる
- 記事が月20本を超える（Quill+Sheets の限界が先に来る）

---

## 8. 自動化・CI/CD — 8割は既にある。足すのは3つだけ

### 既にあるもの（依頼文が求めたもののうち）

| 依頼 | 現状 |
|---|---|
| 画像の次世代フォーマット自動変換 | ✅ webp 変換（クライアント）+ 軽量版生成（build-image-derivatives.py） |
| SEO メタデータの自動バリデーション | ✅ check_regressions.py（canonical / JSON-LD / hreflang / 静的リンク） |
| GitHub Actions の自動テスト・デプロイ | ✅ 26検査 × 2ワークフロー + preflight + 見張り番 |

### 足す価値のある3つ

**(a) JSON-LD の構文検証**（§4 の performer/offers を足すときの安全網）

```yaml
- name: Validate structured data
  run: node scripts/check_jsonld.mjs   # 全473ページの ld+json を JSON.parse + 必須キー検査
```

**(b) Lighthouse のしきい値**（§4 のとおり。測るだけ→落ちる、へ）

**(c) AVIF は見送り**（正直な評価）: webp 比の削減は写真系で 10〜20%。
本サイトの画像は既に軽量版で 12MB → この差のためにビルド時間と
Safari 旧版の分岐を抱える価値は薄い。**「やらない」を記録する。**

---

## 優先順位つきロードマップ

| 優先 | 施策 | 工数 | 期待効果 | 章 |
|---|---|---|---|---|
| **1** | robots.txt の `/map.html` 封鎖を解除（意図確認のうえ） | 1行 | 全国地図が検索に出る | 4 |
| **2** | JSON-LD に performer / offers / eventStatus | 小 | AI検索・リッチリザルトの本命 | 4,5 |
| **3** | llms.txt + events.json をビルド生成 | 小 | 生成AI検索の引用元になる | 5 |
| **4** | タップ領域 44px 化 + touch-action | 小 | モバイル操作性 | 1,2 |
| **5** | Lighthouse しきい値 + JSON-LD 検証を CI へ | 小 | 劣化の自動検出 | 8 |
| 6 | エリア名ラベルに aria-hidden | 極小 | 支援技術のノイズ除去 | 1 |
| — | SSR/ISR・ヘッドレス CMS 移行 | — | **やらない（トリガー明記済み）** | 6,7 |
| — | AVIF 追加 | — | **やらない（費用対効果薄）** | 8 |

1〜6 を合わせても、これまでの1タスク分の規模。すべて既存の preflight の
守備範囲内で実施でき、**明日そのまま着手できる**。
