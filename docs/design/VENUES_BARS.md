# VENUES に Bar（Music Bar / DJ Bar）を本格的に加える設計

作成: 2026-08-23 / 実装: Codex（§6 のフェーズを 1 つずつ）

## 0. 現状（事実）

- サイトの VENUES は 22 件: club 13 / livehouse 5 / **bar 4**（The Room, OATH, bonobo, NOON）
- `TYPE` 列は `club / bar / livehouse` の 3 値。CMS の選択肢も同じ
- ハブ `venues.html` の絞り込みは **都市（ALL / TOKYO / OSAKA / KYOTO）だけ**。種別での絞り込みは地図モードにしか無い（`MAP_TYPES` の CLUBS / BARS / LIVEHOUSE）
- 詳細ページの JSON-LD は全件 `MusicVenue`
- Airtable 候補: 日本の bar **106 件**（club 129 件）。bar を本格的に入れると **club と同数か上回る**

## 1. 結論（やる / やらない）

| | 判断 | 理由 |
|---|---|---|
| `TYPE` に新しい値を足す（`dj-bar` 等） | **やらない** | 既存の描画・地図・CMS・検査が 3 値前提。増やすと全部に分岐が要る |
| `SUBTYPE` 列を 1 つ足す（任意） | **やる** | `dj-bar / music-bar / listening-bar`。表示と検索の補助。空でも壊れない |
| ハブに種別の絞り込みを足す | **やる** | bar が 30 件を超えると、都市だけでは club が埋もれる |
| bar 専用の別ページ（`bars.html`） | **やらない** | 「クラブの前後に寄る店」という回遊が本質。同じ地図・同じ都市タブの中にいるべき |
| 営業時間・チャージの列 | **`HOURS` と `CHARGE` を任意で足す** | bar は「今夜ふらっと入れるか」が判断材料。club には不要なので任意 |
| 「聴き専（listening bar）」をテクノ媒体に載せるか | **載せる。ただし電子音楽が軸のものだけ** | 判断の軸は [[coverage_tier]] と同じ「音・場・実務」 |

## 2. データ（`docs/DATA_SCHEMA.md` §2.1 への追記）

| 列 | 値 | 必須 | 備考 |
|---|---|---|---|
| `TYPE` | `club / bar / livehouse` | ◯ | 変更なし |
| `SUBTYPE` | `dj-bar / music-bar / listening-bar`（bar のとき） | — | club / livehouse は空。将来 club 用に `warehouse` 等を足してもよい |
| `HOURS` | `19:00–03:00`（自由記述、短く） | — | 曜日差は書かない。詳細は公式へ |
| `CHARGE` | `no-cover / cover / varies` | — | 「入場無料」が bar の強い訴求点。`FEATURES` の `no-cover` と重複するので、**CHARGE を正、FEATURES 側は検索用の写し**とする |
| `GENRE` | 既存 | — | bar も同じ語彙（§1.3） |
| `FEATURES` | `;` 区切り。**個性**: `after-hours / daytime / vinyl / outdoor / rooftop / listening / no-cover`、**実用メモ**: `cash-only / cashless-only / id-required / no-photo / smoking / no-reentry` | — | 種別でもジャンルでもない**特徴タグ**。個性タグはカードのピルと記事の切り口に、実用メモは詳細ページの「GOOD TO KNOW」欄にだけ出す（カードには出さない）。Airtable Venues の `features`（複数選択）と同じ語彙。語彙の正は本表 |

- **列の追加はヘッダー行の末尾**に。A1 を触らない（[[data-outage-guards]]）
- **列を足しただけでは `data.js` に出ない。** `LP/cms.js` の `buildVenuesJs()` が列を名指しで書き出している（`id, name, city, area, type, image, genre, capacity, address, lat, lng, url, instagram, desc_en, name_en, desc`）。
  `subtype / hours / charge / features` の 4 行をここに足す（`features` は GENRE と同じく `;` `,` で分割して配列に）。
  `publishPayloadSummary` の件数表示にも `features` を足し、列落ちが「FEATURES 5 → 0」の形で見えるようにする
- GAS 側（`get_sheet`）はヘッダー名で全列を返すので変更不要。ただし **Publish は実機で 1 回通す**（AGENTS.md の Publish 経路ルール）
- Airtable 側は `venue_type=bar` のまま。`SUBTYPE` 相当は Airtable には持たず、載せると決めた時点で CMS に入れる
- **`FEATURES` は Airtable の段階から付ける**（候補の時点で「After Hours をやっている」と分かることが多い）。掲載時に CMS へ写す。語彙は両側で同一に保つ

## 3. ハブ（`venues.html`）

### 絞り込みを 2 段にする

```
[ ALL ] [ CLUBS ] [ BARS ] [ LIVEHOUSE ]      ← 種別（新設・1段目）
[ ALL ] [ TOKYO ] [ OSAKA ] [ KYOTO ] [ ● MAP ]  ← 都市（既存・2段目）
```

- 種別は URL の `#type=bar` に残す（都市と同じ方式）。共有リンクで「東京のバー」を開ける
- 件数を `22 VENUES` の横に `CLUBS 13 · BARS 4 · LIVEHOUSE 5` と出す
- 地図モードの `MAP_TYPES` と状態を共有し、**片方で選んだ種別がもう片方にも効く**
- 並び順: 種別 ALL のとき **club → livehouse → bar** の順で固定（club が先頭に来る）。種別を選んだら名前順

### カード

- bar は club と同じカードを使う。違いは右上に `SUBTYPE` の小さなラベル（`DJ BAR` / `MUSIC BAR` / `LISTENING`）と、`CHARGE=no-cover` のとき `NO COVER` のピル
- `FEATURES` の**個性タグ**（after-hours 等）があればピル（club にも出る）。ピルは最大 2 個まで。**実用メモ（cash-only 等）はカードに出さない**
- 画像が無い bar は **載せない**（club と同じ基準）。bar は店内写真の権利が取りにくいので、掲載前に権利を確認する

## 4. 詳細ページ（`build-detail-pages.mjs`）

- JSON-LD: `TYPE=bar` のとき `@type: ["BarOrPub","MusicVenue"]`、club は `NightClub` も併記（`["NightClub","MusicVenue"]`）。今は全件 `MusicVenue` だけ
- `HOURS` / `CHARGE` があれば INFORMATION ブロックに行を足す（無ければ行ごと出さない。`undefined` を出さない）
- `FEATURES` の実用メモがあれば INFORMATION の下に **GOOD TO KNOW** 欄（例: `CASH ONLY · ID REQUIRED · NO PHOTOS`）。JA は `現金のみ · 要ID · 撮影禁止`。変わりやすい情報なので「最新は公式で」の一文を常に添える
- 回遊ブロック「近くの会場」は **種別をまたいで**出す（club の詳細に近くの bar が出るのが狙い）。距離は既存の座標で計算。
  既存の回遊ブロックの件数が増えないよう、上限 4 件のまま
- EN 版: `SUBTYPE` のラベルは英語固定、`HOURS` はそのまま

## 5. CMS（`cms.js` / `cms.html`）

- `v-type` の下に `v-subtype`（select、TYPE=bar のときだけ表示）、`v-hours`（text）、`v-charge`（select）、`v-features`（チェックボックス群。GENRE の複数選択 UI と同じ部品を使う）
- 「Venue クイック追加」のフィールドに `type` を足す（今は name / id / city / area のみで、TYPE が club 固定で入る）
- 一括補助（Bulk Assist）は変更なし。AI 紹介文の文体は bar でも `docs/writing/` に従う
- `check_cms_layout.mjs` の検査に新フィールドを足す

## 6. 実装フェーズ（Codex へ）

完了条件は各フェーズ共通: `bash scripts/preflight.sh` 全件成功 → 実ブラウザ（390px / 1280px、JA / EN）で操作確認 → `reports/handoff.md` に 6 項目で記録 → push しない。

1. **データ**: シートに `SUBTYPE / HOURS / CHARGE / FEATURES` を末尾に追加（ユーザーが手で）→ `buildVenuesJs()` と `publishPayloadSummary` に 4 列を追加 → `check_cms_publish_guard.mjs` に「列が落ちたら検知」のテストを足す → CMS で Publish Now を 1 回押し、`cms: publish data.js` のコミットに `features` が含まれることを**実機で確認**
2. **ハブ**: 種別フィルタ（2段目の上）、URL ハッシュ、件数表示、並び順、地図との状態共有。`check_hub_pages.py` と `audit_spa_vs_static.py --after` を通す。既存 4 件の bar で表示確認
3. **詳細**: JSON-LD の型、INFORMATION の行、回遊ブロックの種別横断。JA/EN の行数比較
4. **CMS**: 3 フィールドとクイック追加の TYPE。認証済み環境で「入力→プレビュー→閉じる→再表示→保存」
5. **投入**: 東京の bar を 5 件（SHeLTeR・Débris を含む）draft で入れ、本番相当で見え方を確認してから公開

## 7. 掲載判断の軸（bar 用に具体化）

| 軸 | bar で見るもの | 落とす例 |
|---|---|---|
| 音 | DJ ブースと音響が主役か。月数回以上、テクノ/ハウス/ダブ/アンビエント系の夜があるか | J-POP・80s 中心、カラオケ併設 |
| 場 | 一人でも、海外から来た人でも入れるか | 会員制、紹介制、スナック |
| 実務 | 住所・営業日・IG が生きている。写真の権利が取れる | IG 更新が 1 年止まっている |

迷ったら載せず、Airtable の `coverage_tier=skip` と理由を残す。

## 8. やらないこと

- bar 専用のハブページ、bar 専用のカードデザイン
- `TYPE` の値の追加・改名（既存 22 件と検査が壊れる）
- 営業時間の自動取得（Google Places 等）。手入力のみ。変わりやすい情報なので「詳細は公式へ」の一文を常に添える
