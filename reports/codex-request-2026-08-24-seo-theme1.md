# Codex への依頼（2026-08-24）: SEO/GEO テーマ1 の実装

設計: [docs/design/SEO_GEO_NEWS_THEME1_IMPL.md](../docs/design/SEO_GEO_NEWS_THEME1_IMPL.md)
親設計: [docs/design/SEO_GEO_NEWS.md](../docs/design/SEO_GEO_NEWS.md)

**触るのは `scripts/build-detail-pages.mjs` と検査スクリプトのみ。**
`cms.js` / GAS には触らないこと（Codex の publish 系作業と衝突するため、意図的に分けてある）。

---

## 先に読んでほしい: 親設計の前提が3点ずれている

実装前に実測した。**親設計 SEO_GEO_NEWS.md を鵜呑みにしないこと。**

| 親設計の記述 | 実測（2026-08-24） | 影響 |
|---|---|---|
| 「rss.xml は存在しない（404）」 | **HTTP 200 で存在する** | **llms.txt の RSS 行を消さないこと** |
| 「記事内 Event に住所を足す」 | 記事本文の `[[event]]` は **0件** | **今回の範囲から外した** |
| 「フェス側 JSON-LD に `@id` を持たせる」 | **既にある**（`#festival`） | 記事側だけ足せばよい |

再現コマンド:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://techno-japan.media/rss.xml   # → 200
grep -o '\[\[event' LP/data.js | wc -l                                        # → 0
grep -o '"@id": *"[^"]*#festival"' LP/festivals/transcendence.html | head -1   # → 存在
```

前回の VENUES COLUMNS 依頼で「実物を見ずに想定で手順書を書き、大文字/小文字を取り違えた」
（AUDIT §9-69 の再現一歩手前）ことがあった。**今回は実測値を上に置いてある。**
それでも着手前に自分でも確かめてほしい。値が変わっていたら設計ごと直す。

---

## 依頼1: llms.txt に記事セクションを追加（最優先）

`build-detail-pages.mjs` の llms.txt 生成部（L1886〜）に `## 最新記事` を追加する。

- `date` の新しい順、上限20本（現在5本）
- 各行 `- YYYY-MM-DD: [タイトル](JA URL) — excerpt`
- EN があれば行末に ` / [EN](EN URL)`（現状は全5本にある）
- 配置は `## 一覧` の後、`## 機械可読データ` の前
- **`## 機械可読データ` の RSS 行は残す**

### 必ず入れる検査

**`llms.txt` 内の全リンクの参照先が実在すること。**
`https://techno-japan.media/` → `LP/` に読み替えてファイル存在を見る。

これは今回の rss.xml 事故（実在しない入口を AI クローラーに案内していた）の
再発防止であり、**この検査だけは省略しないこと**。他の2つ（記事リンクが1本以上、
件数が ARTICLES と一致）も入れる。

---

## 依頼2: NewsMediaOrganization と記事 JSON-LD の増強

### 2-1. 組織の宣言

`ORG_ID = 'https://techno-japan.media/#org'` として `NewsMediaOrganization` を定義し、
index / about（JA・EN）に埋める。現在 index にあるのは素の `Organization` 1件。

**`logo` の `width` / `height` は実ファイルを測って入れること。**
親設計に書いてある `600 × 60` は未検証の値。`LP/images/logo-og.png` を実際に測る。

### 2-2. 記事の publisher を `{ '@id': ORG_ID }` 参照に変える

`articlePage()` L767。

### 2-3. NewsArticle に4点追加

```js
isAccessibleForFree: true,
wordCount: <本文からタグを除いた文字数>,
thumbnailUrl: <hero画像の絶対URL>,
about: [{ '@id': `https://techno-japan.media/festivals/${festivalId}.html#festival` }],
```

`about` は全5記事で出せる（全記事に `festivalId` があり、参照先も実在する）。
**`festivalId` が空、または対応ページが無い場合は `about` を出さないこと。**
存在しない `@id` を指すのは rss.xml と同じ「嘘の入口」になる。

親設計にある `image` の3アスペクト配列は**依頼3に回す**。

### 検査（`check_jsonld.mjs` に追加）

1. index / about に `NewsMediaOrganization`、`@id` が `#org`
2. 全記事の `publisher` が `{"@id": ...}` で `#org` と一致
3. 全記事に `isAccessibleForFree` / `wordCount` / `thumbnailUrl`
4. **`about` の `@id` が指すファイルが実在する**
5. JA と EN で JSON-LD のキー構成が一致

---

## 依頼3: 記事画像の 1:1 / 4:3 派生（**ここだけ慎重に**）

既存の `CARD_DERIVATIVES`（L263 / L1975）と同じパイプラインに記事ヒーローの
1:1・4:3 を足し、`NewsArticle.image` を `[16:9, 1:1, 4:3]` の配列にする。
切り出し中心は既存の `imagePosition` を尊重すること。

### この歩だけ、受け入れ条件が「実測で悪化していないこと」

過去に srcset の候補を増やして**実機相当で 1,836KB → 2,646KB と44%重くした事故**がある
（AGENTS.md「実測した」と言う前に、測っているものを確かめる）。

- **変更前と変更後を同じ方法で測る。**片方だけの数字は改善の証明にならない
- ページ重量は `performance.getEntriesByType('resource')` で測る。
  自前プロキシでは外部ドメイン（Google Drive の本文画像）が抜ける
- dpr は 1 ではない。実機相当（2〜3）で測る
- 対象: 記事ページ1本 × JA/EN × 390px/1280px

**重くなったら入れない。** 撤退できるよう、この依頼は独立したコミットにすること。

---

## 範囲外（やらないこと）

- **記事内 Event の住所・座標** — `[[event]]` の使用が0件。対象が出てから
- **テーマ2（記事RSS）** — 依頼1〜3の公開結果を見てから
- `cms.js` / GAS への変更
- JS による meta / canonical / JSON-LD の動的注入（AGENTS.md 禁止）
- 全文 `articleBody` の JSON-LD 複製
- `enHubFromJa` での JS 式の置換

---

## 共通の受け入れ条件

1. `bash scripts/preflight.sh` **全件成功**（`--fast` 不可）
2. **JA と EN の行数比較**（生成物を機械置換したら必ず）
3. JSON-LD は不可視。**見た目が1px も変わらないこと。**変わったら別の何かを壊している
4. [リッチリザルトテスト](https://search.google.com/test/rich-results) で記事1本「エラー0」
5. 実ブラウザ確認（390px / 1280px × JA / EN）。390px は**同一オリジン iframe** で実幅を作れる
   （ハブの CSP は `frame-src 'self'` を許可。`cms.html` だけは `frame-src 'none'` で不可）
6. `reports/handoff.md` に6項目すべて記録。**未確認は「未確認」と書く**
7. **push はユーザーの承認後**（push＝本番公開）

## 着手前の確認（AGENTS.md の並行作業ルール）

```bash
git status          # 他セッションの未コミット変更が無いこと
git pull            # 古い data.js でビルドすると Publish 済みが巻き戻る
```

## 付随して直してほしいこと

`AGENTS.md` L263「記事の `title_en` / `excerpt_en` / `body_en` は未入力」は**現状と合っていない**。
実測では全5記事に3項目とも入っている。依頼1で EN URL を出すなら、ここも実態に合わせて直す。
