# ABOUT「STATEMENT」セクション 実装設計

作成: 2026-08-25 / 設計: Claude / 実装: Codex
対象: `LP/about.html` と `LP/en/about.html`（両方とも手書きファイル。ビルド生成物ではない）

## 0. 実測した現状（2026-08-25）

- セクション構成: `#about`(01 — ABOUT) → `#media`(02 — NEWS) →
  `#instagram`(03 — INSTAGRAM) → `#contact`(04 — CONTACT)
- ラベル書式: `<div class="section-label reveal">0N — LABEL</div>`（スペース+em dash+スペース）
- **ページ内アンカーへのリンクは `#about` の3箇所のみ**（ナビ769 / オーバーレイ785 / フッター961）。
  NEWS以降へのセクションリンクは存在しない → 繰り下げで直すのは**ラベル表記だけ**でよい
- 見出し級タイポ: `.about-headline` = `var(--font-display)` / `clamp(48px, 6vw, 96px)` /
  `line-height:1` / uppercase（「JAPAN'S UNDERGROUND, CURATED.」がこれ）
- 本文タイポ: `.about-body p` = `var(--font-body)` / weight 200 / 15px / line-height 1.9 /
  opacity .7 / 段落間 24px
- セクション余白: `section { padding: 120px 40px }`、モバイル(628行) `80px 24px`
- 出現アニメ: `.reveal` → IntersectionObserver で `.visible` 付与（既存機構をそのまま使う）
- JA/EN は行数まで同一（1022 = 1022）。**構造を同一に保ち、行数一致を維持する**
- meta description は現在 JA/EN 同一文面（両方日本語混じり）。今回それぞれ更新する

## 1. 挿入位置と番号繰り下げ

`#about` の `</section>` 直後、`<!-- MEDIA PILLARS -->` の前に新セクションを挿入。

ラベル変更（JA/EN 両方）:
| 現在 | 変更後 |
|---|---|
| （新規） | `02 — STATEMENT` |
| `02 — NEWS` | `03 — NEWS` |
| `03 — INSTAGRAM` | `04 — INSTAGRAM` |
| `04 — CONTACT` | `05 — CONTACT` |

## 2. マークアップ（骨格）

```html
<!-- STATEMENT -->
<section id="statement">
  <div class="section-label reveal">02 — STATEMENT</div>
  <div class="statement-keywords">
    <div class="statement-keyword reveal">
      <div class="statement-word">AUTHENTIC</div>
      <div class="statement-line">本物の音楽体験だけを。</div>
    </div>
    <!-- SELECTIVE / BORDERLESS / INDEPENDENT 同構造 -->
  </div>
  <div class="statement-body reveal">
    <p>…（本文9段落。テキストは依頼書の文面を一字一句そのまま）…</p>
  </div>
</section>
```

- `id="statement"` で `about.html#statement` 直リンク可
- キーワード4つは `.reveal` を個別に付け、順に浮かび上がらせる（既存機構のみ・新JS不可）

## 3. CSS（指針）

```css
.statement-keywords { margin-bottom: 80px; }
.statement-keyword { padding: 28px 0; border-bottom: 1px solid rgba(240,237,232,0.08); }
.statement-keyword:first-child { border-top: 1px solid rgba(240,237,232,0.08); }
.statement-word {
  font-family: var(--font-display);
  font-size: clamp(48px, 6vw, 96px);   /* about-headline と同格 */
  line-height: 1; text-transform: uppercase;
}
.statement-line {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.15em;
  opacity: 0.5; margin-top: 10px;
}
.statement-word::before {              /* アクセントは最小限: 6pxの赤マーカーのみ */
  content: ''; display: inline-block; width: 6px; height: 6px;
  background: #ff2d2d; margin-right: 20px; vertical-align: middle;
}
.statement-body { max-width: 720px; }
.statement-body p { /* .about-body p と同値 */
  font-family: var(--font-body); font-weight: 200; font-size: 15px;
  line-height: 1.9; opacity: 0.7; margin-bottom: 24px;
}
@media (max-width: 768px) {
  .statement-keyword { padding: 20px 0; }
  .statement-keywords { margin-bottom: 56px; }
}
```

### 設計判断（要件との差分を明示）

- **背景色**: 要件は「#000000」だが、既存セクションはサイト基調色の上に置かれており、
  1セクションだけ純黒にすると帯状の段差が出る。**「既存の構造・余白のルールを踏襲する」を
  優先し、背景指定は追加しない**（サイト基調がすでに黒系）。純黒を立てたい場合は
  `#statement { background:#000 }` を足すだけだが、まずは無しで見る。
- キーワードの赤マーカーは `::before` の6px角のみ。ホバー装飾は（リンクではないので）付けない。
- 本文は2カラムにしない。宣言文は1カラム・最大720pxが読みやすく、
  キーワードの視覚的な強さと干渉しない。

## 4. メタ情報

- JA: `TECHNO JAPANについて — 日本のアンダーグラウンド・ダンスミュージックシーンを厳選して届けるメディア。AUTHENTIC / SELECTIVE / BORDERLESS / INDEPENDENT。`
- EN: `About TECHNO JAPAN — a selective media for Japan's underground dance music scene. AUTHENTIC / SELECTIVE / BORDERLESS / INDEPENDENT.`
- og:description / twitter:description が about を持つ場合は同時に整合（実装時に確認）

## 5. 検査・受け入れ条件

1. テキストは依頼書の文面を**一字一句そのまま**（要約・言い換え禁止）。
   `STATMENT` の誤字が0件であること（`grep -c STATMENT` = 0）
2. セクション番号: `grep 'section-label'` で 01〜05 が連番・重複なし（JA/EN とも）
3. `about.html#statement` へ直接アクセスしてセクション先頭に着地する
4. `.reveal` アニメが新セクションでも発火する（既存Observerが `.reveal` を包括収集して
   いるか実装時に確認。セレクタ列挙型なら追記）
5. JA/EN の行数一致を維持
6. 実ブラウザ 390px / 1280px × JA / EN（390px は同一オリジン iframe 可）
7. `bash scripts/preflight.sh` 全件
8. push はユーザー承認後
