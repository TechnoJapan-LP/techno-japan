# 記事本文の「イベントカード」と「開催カレンダー」設計

作成: 2026-08-23 / 用途: アジアのフェスまとめ記事など、複数イベントを並べる記事
実装: Codex 向け。§5 のフェーズを 1 つずつ渡す。

## 0. 結論

| 要素 | 方式 | 理由 |
|---|---|---|
| イベント紹介テンプレ | 本文にショートコード `[[event\|…]]` を書く。CMS に入力フォーム付きボタンを足す | 既存の `[[festival:id]]` と同じ経路で動く。Quill はただの文字として扱うので壊れない |
| 開催カレンダー | `[[calendar]]` を置くと、**その記事内のイベントカードを自動で集めて**月ごとの一覧にする | 別にカレンダーを手入力すると必ず片方が古くなる。カードが唯一の入力元 |
| データの出どころ | **第1段階: カードに直接書く**（DB非依存）。第2段階で Airtable 海外DBから id 参照できるようにする | 海外フェスは LP シートに無い。まず今日から使える形にする |
| JS カレンダー UI（月送り・ポップアップ） | **作らない** | 記事は読むもの。一覧の静的 HTML で十分。JS ゼロで検索エンジンにも全部届く |

## 1. イベントカードのショートコード

### 書式（本文中、1行）

```
[[event|名前|日程|場所|公式URL|補足]]
```

| 位置 | 項目 | 必須 | 形式 | 例 |
|---|---|---|---|---|
| 1 | 名前 | ◯ | 自由 | `Epizode` |
| 2 | 日程 | ◯ | `YYYY-MM-DD` または `YYYY-MM-DD〜YYYY-MM-DD`。未定は `TBA 2027-03`（月まで） | `2026-12-28〜2027-01-08` |
| 3 | 場所 | ◯ | `都市, 国` | `Phu Quoc, Vietnam` |
| 4 | 公式URL | △ | `https://` から | `https://epizode.com` |
| 5 | 補足 | △ | ジャンル・一言。`;` 区切り可 | `Techno;House;11日間` |

例:
```
[[event|Wonderfruit|2026-12-10〜2026-12-14|Pattaya, Thailand|https://wonderfruit.co|Art;Music]]
```

`|` を含む名前は使えない（現状の `[[festival:id|表示名]]` と同じ制約）。

### ビルド時の変換先（`build-detail-pages.mjs`）

```html
<article class="tj-event" itemscope itemtype="https://schema.org/Event"
         data-start="2026-12-28" data-end="2027-01-08">
  <time class="tj-event-date" datetime="2026-12-28">DEC 28, 2026 – JAN 8, 2027</time>
  <h3 class="tj-event-name" itemprop="name">Epizode</h3>
  <p class="tj-event-place" itemprop="location">Phu Quoc, Vietnam</p>
  <p class="tj-event-tags">Techno · House · 11日間</p>
  <a class="tj-event-link" href="https://epizode.com" rel="noopener" target="_blank" itemprop="url">OFFICIAL ↗</a>
</article>
```

- 日付の表示形式は既存 `fmtDate()` を使い、JA/EN で切り替える（EN は `body_en` 側の同じショートコードを解決）
- 日程が過去なら `.is-past` を付け、文字を `--text` 60% にする（FESTIVALS 一覧と同じ規則）
- JSON-LD: 記事の `Article` に加えて、カード全件を `Event` の配列で出す（検索結果のイベント表示を狙う）
- **外部リンクは `safeUrl` を通す**（`https?:` 以外は落とす。既存の安全規則と同じ）

### 見た目（`detail.css`）

```
┃ DEC 28, 2026 – JAN 8, 2027         ← Space Mono, 小さく, アクセント左線 2px
┃ EPIZODE                            ← Bebas Neue 1.75rem
┃ Phu Quoc, Vietnam · Techno · House ← DM Sans, --text 70%
┃ OFFICIAL ↗                         ← mono, 下線
```

- 1 カラム、幅は本文幅いっぱい。画像は持たない（記事内の画像は通常の画像で前後に置く）
- 2 枚以上連続したら `gap: 1px` で積み、境界は `rgba(240,237,232,.08)` の罫線。カードっぽい角丸や影は付けない
- `article-fx` のリビール対象に含める（`transform` のみ、CLS ゼロの規則を守る）

## 2. 開催カレンダーのショートコード

### 書式

```
[[calendar]]              ← 記事内の全カードを月ごとに並べる
[[calendar|2026-12..2027-03]]  ← 期間を絞る（任意）
```

### ビルド時の動き

1. 同じ記事本文（同じ言語）の `[[event|…]]` を全部集める
2. 開始日でソート、`YYYY-MM` ごとにグループ
3. 以下に変換

```html
<nav class="tj-calendar" aria-label="開催カレンダー">
  <div class="tj-cal-month"><h3>2026 DEC</h3>
    <ol>
      <li><time>12.10–14</time><a href="#ev-wonderfruit">Wonderfruit</a><span>Thailand</span></li>
      <li><time>12.28–01.08</time><a href="#ev-epizode">Epizode</a><span>Vietnam</span></li>
    </ol>
  </div>
  …
</nav>
```

- 各行はページ内リンク `#ev-<slug>` でカードへ飛ぶ（カード側に `id="ev-<slug>"` を付ける。slug は名前から `a-z0-9-` へ）
- `TBA` のものは末尾に「日程未定」の塊として出す
- カードが 0 件なら何も出さず、ビルドログに警告を 1 行出す（静かに空を出さない）
- 月名は JA/EN で切り替え

### 「カレンダーに追加」

各カードに Google カレンダーの追加リンク（URL 生成のみ、ファイル不要）を任意で付ける:
`https://calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=20261228/20270109&location=…`
終了日は +1 日（Google は終了日を含まない）。JS 不要。

## 3. CMS 側（`cms.js`）

### 「📦 イベントカード」ボタン

- 既存の「📄テンプレ」「@リンク」と同じ並びにボタンを追加
- 押すと小さなフォーム（名前／開始日／終了日／場所／URL／補足）が出て、「挿入」でキャレット位置にショートコード 1 行を `insertText`
- 日付は `<input type="date">`。終了日が空なら 1 日開催
- 「📅 カレンダーを挿入」は `[[calendar]]` を 1 行入れるだけ

### プレビュー

- CMS の記事プレビュー（`updateArticlePreview`）でも同じ変換をかける。変換関数は `LP/article-shortcodes.js` に切り出し、**ビルド（Node）と CMS（ブラウザ）の両方から同じ関数を読む**（localize の「2箇所に同じ規則」の轍を踏まない）
- エディタ内はショートコードの生文字のまま（Quill を触らない）。「見づらい」が出たら第2段階でカード表示 Blot を検討

### テンプレ追加

`ARTICLE_TEMPLATES` に `roundup`（🗺 フェスまとめ）を足す:
```
[リード — 地域・シーズン・このまとめの視点を2〜3文]
[[calendar]]
<h2>[国・地域名]</h2>
[[event|名前|YYYY-MM-DD〜YYYY-MM-DD|都市, 国|https://|ジャンル]]
[紹介文 — なぜ行く価値があるか 2〜4文]
（以下繰り返し）
```

## 4. 検証（ビルドを止める条件）

`validateArticleShortcodes` を拡張し、draft 以外の記事で次を**エラー**にする:

- `[[event|…]]` の必須 3 項目が空
- 日程が書式外（`YYYY-MM-DD`／`〜`／`TBA YYYY-MM` 以外）、開始 > 終了
- URL が `https?://` 以外
- `[[calendar]]` があるのにカードが 0 件（警告ではなくエラー。置き忘れ防止）

## 5. 実装フェーズ（Codex へ）

各フェーズの完了条件: `bash scripts/preflight.sh` 全件成功 → 実ブラウザで JA/EN の記事を開き、カード・カレンダー・ページ内リンク・外部リンクが動く → CMS で 入力→プレビュー→保存→再表示 で本文が消えない → `reports/handoff.md` に記録。

1. **共通変換関数** `LP/article-shortcodes.js`（event / calendar の解析と HTML 化、JA/EN）。単体テスト `scripts/check_article_shortcodes.mjs` を足して preflight に登録
2. **ビルド組み込み** `build-detail-pages.mjs` の `makeEntityResolver` の後段で呼ぶ。JSON-LD Event 出力。検証 §4
3. **CSS** `detail.css` にカードとカレンダー。390px / 1280px で確認
4. **CMS** ボタン・フォーム・テンプレ・プレビュー。認証済み環境で 入力→プレビュー→閉じる→再表示→保存 を確認
5. **実記事で使う** アジアまとめ記事を draft で作り、カード 5 件以上 + カレンダーで本番相当の見え方を確認してから公開

## 6. 第2段階（今はやらない）

- `[[event:airtable-id]]` で Airtable 海外DB（`brand_status` / `last_date_*` / `official_url`）から自動で埋める。巡回で日程が更新されると記事も追従する。`scripts/db/airtable_pipeline.py export` で `data/festivals-world.json` を吐き、ビルドが読む
- Quill に表示用 Blot を登録してエディタ内でカードとして見せる
- 記事をまたいだ「アジア全体の開催カレンダー」ページ（ハブ）。記事内カレンダーの集計版

## 7. やらないこと

- JS の月送りカレンダー UI、FullCalendar 等のライブラリ（CSP `'self'`、JS 予算、静的生成の原則に反する）
- 本文 HTML に `<div data-json>` を直接埋める方式（Quill が div を落とす。Blot 登録が要り、壊れやすい）
- イベント情報を記事とは別シートに持つ方式（まとめ記事 1 本のために経路を増やさない。Airtable 連携は §6 で扱う）
