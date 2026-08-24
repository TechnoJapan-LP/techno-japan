# Codex への依頼（2026-08-23）: VENUES に bar を本格導入するための実装

設計は [docs/design/VENUES_BARS.md](../docs/design/VENUES_BARS.md) に確定済み。本書はその §6 のフェーズを
「いま着手できる順」に並べ直したもの。各フェーズの完了条件は共通:
`bash scripts/preflight.sh` 全件成功 → 実ブラウザ（390px / 1280px、JA / EN）で操作確認 →
`reports/handoff.md` に6項目で記録 → **push しない**。

## 前提（今日までに Claude 側で済んだこと）

- Airtable Venues に `area / address / lat / lng / genres / subtype / hours / charge` 列を追加済み。
  候補店の判断は notes の「提案票」に入っていて、`scripts/db/venue_crawl.py apply` で列へ反映する（Claude が担当）。
- つまり **Airtable 側の形は決まった**。残りは「サイト側（LP シート・CMS・ハブ・詳細）」の実装。
- サイト側の VENUES 列は `ID NAME CITY AREA TYPE IMAGE GENRE CAPACITY ADDRESS LAT LNG URL INSTAGRAM DESC DESC_EN`。
  ここに `SUBTYPE HOURS CHARGE FEATURES` を足す。`CAPACITY` は今後廃止予定（今回は触らない）。

## 依頼 1: データ列の追加（設計 §6-1）

1. LP シートの VENUES に `SUBTYPE / HOURS / CHARGE / FEATURES` を**ヘッダー行の末尾**に追加（A1 を触らない）。
   ※ シートの列追加はユーザーが手で行う。Codex はそれが済んだ前提でコードを直す。
2. `LP/cms.js` の `buildVenuesJs()` に4列を追加（`features` は GENRE と同じく `;` `,` 区切りで配列に）。
3. `publishPayloadSummary` に `features` の件数を足し、列落ちが「FEATURES 5 → 0」の形で見えるようにする。
4. `scripts/check_cms_publish_guard.mjs` に「4列が落ちたら検知」のテストを足す。
5. **AGENTS.md の Publish 経路ルール**: CMS で Publish Now を1回押し、`cms: publish data.js` のコミットに
   `features` が含まれることを実機で確認するまで完了にしない。

## 依頼 2: CMS の入力欄（設計 §6-4）

- `v-type` の下に `v-subtype`（select: dj-bar / music-bar / listening-bar、TYPE=bar のときだけ表示）、
  `v-hours`（text）、`v-charge`（select: no-cover / cover / varies）、`v-features`（チェックボックス群。
  語彙は設計 §2 の表: after-hours / daytime / vinyl / outdoor / rooftop / listening / no-cover /
  cash-only / cashless-only / id-required / no-photo / smoking / no-reentry）。
- 「Venue クイック追加」に `type` を足す（今は club 固定で入る）。
- `check_cms_layout.mjs` に新フィールドを足す。
- 認証済み環境で「入力 → プレビュー → 閉じる → 再表示 → 保存」を実操作し、値が消えないことを確認。

## 依頼 3: ハブ `venues.html`（設計 §6-2）

- 種別フィルタ `[ALL] [CLUBS] [BARS] [LIVEHOUSE]` を都市フィルタの上に新設。URL は `#type=bar`。
- 件数表示 `CLUBS 13 · BARS 4 · LIVEHOUSE 5`。地図モードの `MAP_TYPES` と状態を共有。
- 並び順: 種別 ALL のとき club → livehouse → bar。種別を選んだら名前順。
- カード: bar は右上に SUBTYPE の小ラベル、`CHARGE=no-cover` なら `NO COVER` ピル、
  FEATURES の**個性タグ**（after-hours 等）をピル最大2個。**実用メモ（cash-only 等）はカードに出さない**。
- ハブ JS は JA/EN で同一に保ち、EN は `enHubFromJa` で生成 → **JA と EN の行数を比較**。
- `check_hub_pages.py` と `audit_spa_vs_static.py --after` を通す。

## 依頼 4: 詳細ページ `build-detail-pages.mjs`（設計 §6-3）

- JSON-LD: `TYPE=bar` → `["BarOrPub","MusicVenue"]`、club → `["NightClub","MusicVenue"]`。
- INFORMATION に HOURS / CHARGE の行（無ければ行ごと出さない。`undefined` を出さない）。
- FEATURES の実用メモがあれば **GOOD TO KNOW** 欄（JA: `現金のみ · 要ID · 撮影禁止`）＋「最新は公式で」の一文。
- 回遊「近くの会場」は種別をまたいで出す（上限4件のまま）。
- JA/EN の行数比較。

## 依頼 5: Airtable → CMS クイック追加の流し込み（新規・小さい）

- `scripts/db/venue_export_cms.py`（仮）: Airtable Venues の `coverage_tier=editorial` かつ `on_site` が空の行を、
  CMS クイック追加に貼れる形（ID NAME CITY AREA TYPE ADDRESS URL INSTAGRAM GENRE SUBTYPE HOURS CHARGE FEATURES）で
  TSV に出す。IMAGE / DESC / DESC_EN は空のまま（CMS 段階で人が入れる）。
- `--dry-run` 既定、件数と列落ちを印字。Airtable のトークンは `data/migration/.airtable_token`。
- Airtable の列名は `﻿Name`（先頭 BOM）に注意（`scripts/db/venue_crawl.py` の `NAME` 定数を流用）。

## やらないこと（設計 §8）

- bar 専用ページ・専用カード、`TYPE` の値の追加・改名、営業時間の自動取得、SPA 詳細ビューの再導入。

## 順番の推奨

1 → 2 → 5 → 3 → 4。1 と 2 が終わると Claude 側で Airtable の掲載決定分を CMS に入れられる（5 があると速い）。
3・4 は bar が CMS に数件入ってから実物で見え方を確認した方が手戻りが少ない。
