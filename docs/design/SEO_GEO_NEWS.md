# SEO・GEO（AI検索）・ニュース流通の裏側設計

作成: 2026-08-24 / 対象: https://techno-japan.media
前提: このサイトは WordPress ではなく、`scripts/build-detail-pages.mjs` による静的生成。
よって「CMS に埋めるコード」はすべて **build-detail-pages.mjs への追記**として設計する。

## 0. 現状の実測（2026-08-24）

すでにあるもの（＝作り直さない）:

| 項目 | 実装 | 場所 |
|---|---|---|
| NewsArticle JSON-LD | headline / image / 日付 / author / publisher / keywords / inLanguage | `articlePage()` L757〜 |
| 記事内イベントの Event JSON-LD | `[[event]]` ショートコードから生成 | L784〜 |
| Festival / FAQPage / Offer / MusicVenue / MusicGroup | 詳細ページ全種 | L1381〜 |
| BreadcrumbList | 詳細ページ共通 | L195 |
| canonical / hreflang(ja·en·x-default) / OG / Twitter Card | `page()` | L695〜 |
| sitemap.xml / robots.txt | 静的 + ビルド | LP/ |
| AI 向けサーフェス | llms.txt / events.json | L1886〜 |
| 検査 | `scripts/check_jsonld.mjs`（preflight 内） | |

**見つかった不具合**: llms.txt が `https://techno-japan.media/rss.xml` を案内しているが、
**rss.xml は存在しない（404）**。AI クローラーに嘘の入口を教えている状態。テーマ2で実体を作るまで
llms.txt から行を消すか、先に最小の RSS を出す。

## テーマ1: 構造化データ（JSON-LD）の設計 — 差分だけ

### 1-1. サイト＝報道主体の宣言（NewsMediaOrganization）★最重要

GEO でもニュース認定でも、最初に見られるのは「このドメインは何者か」。
今は index.html に素の `Organization` があるだけ。これを **`NewsMediaOrganization`** に
格上げし、全記事の `publisher` から `@id` で参照する（同一主体だと機械が確定できる）。

```json
{
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  "@id": "https://techno-japan.media/#org",
  "name": "TECHNO JAPAN",
  "url": "https://techno-japan.media/",
  "logo": { "@type": "ImageObject", "url": "https://techno-japan.media/images/logo-og.png", "width": 600, "height": 60 },
  "sameAs": ["https://www.instagram.com/techno.japan_/"],
  "foundingDate": "2025",
  "knowsAbout": ["techno", "house music", "music festivals in Japan", "Japanese club culture"],
  "publishingPrinciples": "https://techno-japan.media/about.html",
  "inLanguage": ["ja", "en"]
}
```

実装: `page()` に定数 `ORG_JSONLD` を持たせ、index / about に埋める。
`articlePage()` の `publisher` を `{ "@id": "https://techno-japan.media/#org" }` 参照に変える。
※ X / SoundCloud 等の公式アカウントが増えたら sameAs に追記（sameAs の数と一貫性が
主体照合の材料になる）。

### 1-2. NewsArticle の増強（差分5点）

```js
const jsonLd = {
  // …既存…
  isAccessibleForFree: true,                    // ①ペイウォール無しの明示（News 要件）
  wordCount: stripTags(L.body).length,          // ②
  thumbnailUrl: image,                          // ③
  image: [image, imageSquare, image43].filter(Boolean),  // ④ 16:9 / 1:1 / 4:3
  about: aboutEntities,                         // ⑤ 記事の主題を @id で実体リンク
};
```

- **④ 画像の複数アスペクト比**: Google News / Discover は 16:9・4:3・1:1 の3種
  （幅1200px以上）を推奨。現状はカード用縮小版の仕組み（CARD_DERIVATIVES）が
  あるので、記事ヒーローから 1:1 と 4:3 の切り出しを同じパイプラインに足す。
  切り出し中心は既存の `imagePosition` を尊重（hero 画質事故 §の教訓）。
- **⑤ about での実体リンク（GEO の本丸）**: 記事が `festivalId` を持つ場合、
  `about: [{ "@id": "https://techno-japan.media/festivals/<id>.html#festival" }]` を出し、
  フェス側 JSON-LD に `"@id": "<canonical>#festival"` を持たせる。
  記事⇄フェス⇄会場⇄アーティストが @id で繋がると、AI 検索は「この記事は
  この実体についての一次情報」と判定しやすくなる。venueId / artistIds 列を
  ARTICLES に足せば同様に拡張できる（列追加はヘッダー末尾・A1不可侵）。

### 1-3. 記事内 Event の増強（Google リッチリザルト要件を満たす）

現状の `[[event]]` 由来 Event は name / startDate / location(name) のみ。
Google のイベントリッチリザルトは **location に住所**が実質必須。VENUES と突合できる
場合は座標・住所ごと出す:

```js
{
  "@type": "Event",
  name, startDate, endDate,
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  location: venue
    ? { "@type": "Place", name: venue.name,
        address: { "@type": "PostalAddress", streetAddress: venue.address, addressLocality: venue.city, addressCountry: "JP" },
        geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lng } }
    : { "@type": "Place", name: event.place },
  organizer: { "@id": "https://techno-japan.media/#org" }, // 主催が別なら出さない
  ...(event.url ? { offers: { "@type": "Offer", url: event.url, availability: "https://schema.org/InStock" } } : {})
}
```

突合キー: `[[event]]` の place 文字列 → VENUES.name の正規化一致（なければ従来通り name のみ）。

### 1-4. llms.txt の拡充（記事を載せる）

今は開催予定とハブしか無く、**記事へのリンクが1本も無い**。AI クローラーに
「ニュース源」と認識させたいなら記事が最優先。

- `## 最新記事` セクションを追加: 日付・タイトル・URL・1行要約（excerpt）を新しい順に20本
- 存在しない rss.xml の行は、テーマ2で実体を作るまで削除
- 英語版の入口（/en/）は既にある。記事の EN 版があるものは EN URL も併記

### 1-5. 検査（check_jsonld.mjs への追加）

1. 全記事: `isAccessibleForFree` / `publisher.@id` / image 3種の存在
2. `@id` 参照の整合: 記事の about が指す #festival が実在ページにあるか
3. llms.txt: 記事リンクが1本以上・リンク先が全て実在ファイル（**rss.xml 事故の再発防止**）
4. Event: startDate があるのに location.address が無い件数を警告（VENUES 突合漏れの検知）

### 導入手順（テーマ1）

1. `build-detail-pages.mjs` に ORG_JSONLD・publisher @id 参照・NewsArticle 差分5点（半日）
2. 画像 1:1 / 4:3 派生の生成をビルドに追加 → **実測でページ重量が悪化していないか比較**（半日）
3. Event×VENUES 突合 + llms.txt 記事セクション（半日）
4. check_jsonld.mjs 拡張 → `bash scripts/preflight.sh` 全件 → 実ブラウザ確認 →
   [リッチリザルトテスト](https://search.google.com/test/rich-results) で記事1本・フェス1本を検証
5. 公開後に Search Console の「パンくず/イベント/記事」レポートでエラー0を確認

## テーマ2: RSS・ニュース流通（次に着手）

- `rss.xml`（RSS 2.0 + `content:encoded` 全文 + `media:content` でアイキャッチ +
  `atom:link rel=self`）をビルドで生成。JA を主フィード、`/en/rss.xml` を別フィードに
- Google Publisher Center: 独自ドメイン・著者/日付明示・お問い合わせ導線（about）・
  HTTPS・sitemap 済みなので、フィード登録と所有権確認だけで申請可能な状態にある
- llms.txt / `<link rel="alternate" type="application/rss+xml">` を全ページ head に追加

## テーマ3: 公開→SNS 自動配送（Make 前提の骨子）

- トリガー: rss.xml の新アイテム（Make の RSS モジュール、15分間隔）
- 分岐: ① X: Claude API で 5W1H 要約→日英2ポスト＋アイキャッチ ② Discord/Telegram:
  Webhook でそのまま通知 ③ Reddit: 投稿文だけ生成して**下書きを人に送る**（自動投稿は
  サブレディット規約違反で BAN リスクが高い。r/techno は自己宣伝制限あり）
- 事故対策: 送信前に URL の 200 チェック / 同一 URL は一度だけ（Make の重複フィルタ）

## テーマ4: 記事テンプレ（Writing ガイドへの追記として設計）

- 冒頭150字に 5W1H（GEO の引用単位）/ 見出しは質問形を1つ以上（FAQPage 連動）/
  タグ=keywords / 出典リンク明記。docs/writing/ に「公開前チェックリスト」を1枚足す
- CMS 側でチェックリストを機械化（excerpt 空・画像なし・タグ0 で警告）は別途

## やらないこと

- JS による meta / JSON-LD の動的注入（AGENTS.md の禁止事項）
- 全文 articleBody を JSON-LD に複製（ページ肥大・重複コンテンツの温床）
- Reddit への完全自動投稿（BAN リスク）
- ニュースサイトマップ(news:news)は記事が数十本/月になるまで保留（現在5本）
