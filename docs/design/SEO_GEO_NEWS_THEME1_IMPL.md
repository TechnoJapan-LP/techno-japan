# テーマ1 実装設計（構造化データ・llms.txt）

作成: 2026-08-24 / 設計: Claude / 実装: Codex
親設計: [SEO_GEO_NEWS.md](SEO_GEO_NEWS.md)

対象は `scripts/build-detail-pages.mjs` のみ。CMS（`cms.js`）と GAS は**触らない**。
Codex が並行して触っているのがその2つなので、衝突しない範囲で切ってある。

---

## 0. 着手前に実測した（2026-08-24）

**親設計 SEO_GEO_NEWS.md の前提が3点、実態とずれていた。**
そのまま実装すると、直っているものを「直す」ことになる。

| 親設計の記述 | 実測 | 影響 |
|---|---|---|
| 「rss.xml は存在しない（404）。llms.txt が嘘の入口を教えている」 | **HTTP 200 で存在する**（`generate-meta.yml` が生成） | **llms.txt の RSS 行を消してはいけない** |
| 「記事内 Event に住所を足す」 | 記事本文の `[[event]]` は **0件**（`grep -o '\[\[event' LP/data.js` → 0） | **対象が無い。今やっても効果0** |
| 「フェス側 JSON-LD に `@id` を持たせる」 | **既にある**（`"@id":".../festivals/transcendence.html#festival"`） | 参照先は完成済み。記事側だけ足せばよい |

あわせて分かったこと:

- 記事は **5本**。全5本が `festivalId` / `image` / `excerpt` / `title_en` / `excerpt_en` / `body_en` を**すべて持つ**
- **AGENTS.md L263「記事の `title_en` / `excerpt_en` / `body_en` は未入力」は現状と合っていない。** 別途訂正が要る
- `llms.txt` の記事リンクは **0本**（親設計の指摘どおり）
- `LP/articles/transcendence.html` は `transcendence-2025-report.html` へ canonical を向けた別名ページ。EN 側に対応が無いのは正常
- 現行 `rss.xml` は **35 item のサイト全体フィード**（先頭が `festivals/snow-machine-japan.html`、`<category>Festival</category>`）。記事フィードではない

---

## 1. 実装順（事故りにくい順・実測で組み直した）

| 手順 | 内容 | 触る出力 | 現時点の対象数 |
|---|---|---|---|
| 第1歩 | llms.txt に記事セクション | テキスト1本 | 5本 |
| 第2歩 | NewsMediaOrganization + 記事 JSON-LD 差分 | 見えない部分のみ | 全記事＋index/about |
| 第3歩 | 記事画像の 1:1 / 4:3 派生 | 画像生成 | 5本 |
| 保留 | 記事内 Event の住所・座標 | — | **0件** |
| 保留 | テーマ2（RSS） | — | 第1〜3歩の結果を見てから |

**「記事内 Event」を保留にしたのは、対象が0件だからである。**
効果が出ない変更を先に入れると、preflight の検査だけが増えて、
実際に効いているかを誰も確かめられない。`[[event]]` を使う記事が1本出てから着手する。

---

## 2. 第1歩: llms.txt に記事を載せる

### なぜ最初か

出力はテキスト1ファイル。HTML に触らないので表示事故が起きない。
そして **AI クローラーに対して「ニュース源」を名乗るのに、記事リンクが1本も無い**のが
現状の最大の穴である。

### 変更内容

`build-detail-pages.mjs` の llms.txt 生成部（L1886〜）に `## 最新記事` を追加する。

- 並び: `date` の新しい順
- 上限: 20本（現在5本。増えても肥大しない）
- 各行: `- YYYY-MM-DD: [タイトル](JA URL) — excerpt` の1行
- EN がある記事は同じ行の末尾に ` / [EN](EN URL)` を付ける
  （全5本に `title_en` / `excerpt_en` があるので、現状は全件に付く）
- 配置: `## 一覧` の後、`## 機械可読データ` の前

**`## 機械可読データ` の RSS 行は残す。** 実在する（HTTP 200）。
ただし現行 RSS は記事フィードではないので、テーマ2で記事フィードを作ったら
「サイト更新フィード」と「記事フィード」を区別して案内し直す。

### 検査（新規 or `check_jsonld.mjs` に追加）

1. `llms.txt` に記事リンクが **1本以上**ある
2. **`llms.txt` 内の全リンクの参照先が実在する。**
   `https://techno-japan.media/` を `LP/` に読み替えてファイル存在を見る。
   これは今回の rss.xml 事故（存在しない入口を案内していた）の再発防止であり、
   **この検査だけは必ず入れること**
3. 記事の件数が data.js の ARTICLES 件数と一致（上限20まで）

### 受け入れ条件

- `bash scripts/preflight.sh` 全件
- 生成された `LP/llms.txt` に5本の記事行があり、JA/EN 両方のURLが 200
- 既存セクション（今後の開催予定 / 一覧 / 機械可読データ）の行数が変わらない

---

## 3. 第2歩: 報道主体の宣言と記事 JSON-LD の増強

### 3-1. NewsMediaOrganization

現在 `LP/index.html` にあるのは素の `Organization` 1件のみ。
これを `NewsMediaOrganization` に格上げし、`@id` で参照できるようにする。

```js
const ORG_ID = 'https://techno-japan.media/#org';
const ORG_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  '@id': ORG_ID,
  name: 'TECHNO JAPAN',
  url: 'https://techno-japan.media/',
  logo: { '@type': 'ImageObject', url: 'https://techno-japan.media/images/logo-og.png' },
  sameAs: ['https://www.instagram.com/techno.japan_/'],
  knowsAbout: ['techno', 'house music', 'music festivals in Japan', 'Japanese club culture'],
  publishingPrinciples: 'https://techno-japan.media/about.html',
  inLanguage: ['ja', 'en'],
};
```

埋める先: index / about（JA・EN とも）。
`logo` の `width` / `height` は**実ファイルを測って入れる**こと。
`LP/images/logo-og.png` の実寸を確認せずに書かない（親設計の 600×60 は未検証の値）。

### 3-2. 記事の publisher を @id 参照に

`articlePage()` L767 の `publisher` を `{ '@id': ORG_ID }` に変える。
記事ごとに組織情報を重複させず、機械が「同一主体」と確定できる形にする。

### 3-3. NewsArticle の差分4点

```js
isAccessibleForFree: true,            // ペイウォール無しの明示
wordCount: <本文からタグを除いた文字数>,
thumbnailUrl: <hero画像の絶対URL>,
about: [{ '@id': `https://techno-japan.media/festivals/${festivalId}.html#festival` }],
```

`about` は **全5記事で出せる**（全記事に `festivalId` があり、参照先の `#festival` も実在する）。
`festivalId` が空、または対応するフェスページが無い場合は `about` を**出さない**。
存在しない `@id` を指すのは、rss.xml と同じ「嘘の入口」になる。

親設計にある `image` の3アスペクト配列は**第3歩に回す**（画像生成が絡むため）。

### 検査（`check_jsonld.mjs` に追加）

1. index / about に `NewsMediaOrganization` があり `@id` が `#org`
2. 全記事の `publisher` が `{"@id": ...}` 形式で、値が `#org` と一致
3. 全記事に `isAccessibleForFree` / `wordCount` / `thumbnailUrl` がある
4. **`about` の `@id` が指すファイルが実在する**（第1歩の検査2と同じ思想）
5. JA と EN で JSON-LD のキー構成が一致

### 受け入れ条件

- preflight 全件
- **JA と EN の行数比較**（AGENTS.md の生成物ルール）
- [リッチリザルトテスト](https://search.google.com/test/rich-results) に記事1本の HTML を貼り「エラー0」
- 見た目が1px も変わらないこと（JSON-LD は不可視。変わったら別の何かを壊している）

---

## 4. 第3歩: 記事画像の 1:1 / 4:3 派生

### 唯一、慎重にやる歩

**過去に srcset の候補を増やして実機相当で 1,836KB → 2,646KB と44%重くした事故がある**
（AGENTS.md「実測した」と言う前に、測っているものを確かめる）。同じ轍を踏まない。

### 変更内容

既存の `CARD_DERIVATIVES`（L263〜 / L1975 で読み込み）と同じパイプラインに、
記事ヒーローの 1:1 と 4:3 を足す。切り出し中心は **既存の `imagePosition` を尊重**する
（hero 画質事故の教訓）。生成した派生は `NewsArticle` の
`image: [16:9, 1:1, 4:3]` 配列に入れる。

### 測り方（ここを外すと意味が無い）

- **変更前と変更後を同じ方法で測る。** 片方だけの数字は改善の証明にならない
- ページ重量は `performance.getEntriesByType('resource')` で測る。
  自前プロキシは外部ドメイン（Google Drive の本文画像）を取りこぼす
- dpr は 1 ではない。実機相当（2〜3）で測る
- 対象: 記事ページ1本を JA/EN・390px/1280px

### 受け入れ条件

- **記事ページの実機相当ページ重量が、変更前より増えていないこと**
- 増えたら入れない。撤退できるよう、この歩は独立したコミットにする
- 派生画像が `表示px × dpr ≦ 取得px` を満たす（軽くする代わりにぼやけさせない）

---

## 5. 保留にするもの

| 項目 | 理由 | 着手条件 |
|---|---|---|
| 記事内 Event の住所・座標 | **`[[event]]` の使用が0件** | `[[event]]` を使う記事が1本出たら |
| テーマ2（記事RSS） | 第1〜3歩の公開結果を見てから | 現行 rss.xml との棲み分けを決めてから |
| ニュースサイトマップ | 記事5本では早い（親設計どおり） | 数十本/月になったら |

**記事ペースの見込み（2026-08-24 ユーザー決定）: 月4〜6本。**
このペースが2〜3ヶ月続けば Google Publisher Center の審査に耐える更新頻度になる。
テーマ2はその時点で着手する（先にインフラを作らない — 蛇口より水が先）。

---

## 6. やらないこと（AGENTS.md）

- JS による meta / canonical / JSON-LD の動的注入
- 全文 `articleBody` の JSON-LD への複製
- `cms.js` / GAS への変更（Codex の並行作業と衝突する）
- `enHubFromJa` で JS の式を置換すること

## 7. 公開判断

第1〜3歩をまとめて出すか分けるかは、Codex の publish 系修正の公開タイミング次第。
どちらにせよ **preflight 全件 → 実ブラウザ（390/1280・JA/EN）→ handoff 記録 → ユーザーが push 判断**。
公開1〜2日後に Search Console の「記事」「パンくず」レポートでエラー0を確認する。
