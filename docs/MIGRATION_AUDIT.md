# Techno Japan — 移行監査レポート (Phase 0)

> 生成日: 2026-07-11 / データソース: 公開CSV（スプレッドシート「LP」）
> このレポートは **報告のみ**。修正は一切行っていない（CLAUDE.md 方針に従う）。
> 対象は「ウェブ公開CSV」の生データ。件数が data.js と異なるのは STATUS 未公開行を含むため。

## サマリー

| シート | 生データ件数 | 主な問題 |
|---|---|---|
| ARTISTS | 89 | ID規約違反 20件、言語カラム(name_en/bio_en)既存だが充足率低 |
| VENUES | 24 | AREA typo (SHIBUAYA)、言語カラム既存 |
| FESTIVALS | 86 | NAMEに年 9件、EDITIONS/LINEUPS未分離 |
| EVENTS | 7 | IDカラムなし、孤児参照 |

## 1. ID規約違反 (§1.1: `[a-z0-9-]+` のみ)

### ARTISTS — 違反 20件

| 現ID | NAME | 提案slug |
|---|---|---|
| `Ojisan` | Ojisan | `ojisan` |
| `Noritake` | Noritake | `noritake` |
| `Eric Cloutier` | Eric Cloutier | `eric-cloutier` |
| `Caimann` | Caimann | `caimann` |
| `FUJI` | FUJI | `fuji` |
| `Prins Thomas` | Prins Thomas | `prins-thomas` |
| `RAMI` | RAMI | `rami` |
| `Pianeti Sintetici` | Pianeti Sintetici | `pianeti-sintetici` |
| `Ground` | Ground | `ground` |
| `Akie` | Akie | `akie` |
| `Adhémar` | AdhéMar | `adhemar` |
| `Allen Mock` | Allen Mock | `allen-mock` |
| `Doltz. -live-` | Doltz.  Live  | `doltz-live` |
| `Joma` | Joma | `joma` |
| `Suguru Mochizuki` | Suguru Mochizuki | `suguru-mochizuki` |
| `YUKIMASA` | YUKIMASA | `yukimasa` |
| `Tonbo -live-` | Tonbo  Live  | `tonbo-live` |
| `SUNGA` | SUNGA | `sunga` |
| `DJ Yazi` | DJ Yazi | `dj-yazi` |
| `Iron` | Iron | `iron` |

## 2. FESTIVALS — NAMEに年が含まれる (§2.3: ブランド名から年を除去)

| ID | NAME | 備考 |
|---|---|---|
| `arch` | ARCH 2025 | 年をEDITION側へ |
| `festival-fruezinho-2026` | FESTIVAL FRUEZINHO 2026 | 年をEDITION側へ |
| `yagura-2025` | YAGURA 2025 | 年をEDITION側へ |
| `festival-de-frue-2026` | FESTIVAL de FRUE 2026 | 年をEDITION側へ |
| `unknown` | Unknown 2024 | 年をEDITION側へ |
| `wormhole` | wormhole2024 | 年をEDITION側へ |
| `music-2024` | ＋music 2024 | 年をEDITION側へ |
| `capsule-2025` | CAPSULE-山中湖花火音楽祭-2025- | 年をEDITION側へ |
| `mirrorball-village2024` | Mirrorball Village2024 | 年をEDITION側へ |

## 3. 参照切れ・typo（§6 参照バリデーション）

- **EVENTS.LINEUP の孤児参照**: ['cabanne', 'mayurashka']
- **VENUES.AREA typo `SHIBUAYA`**: ['circus-tokyo']

## 4. STATUS 空欄（§1.4: 公開制御が効かない）

- ARTISTS: STATUS空欄 87/89件
- VENUES: STATUS空欄 23/24件
- FESTIVALS: STATUS空欄 81/86件
- EVENTS: STATUS空欄 7/7件

## 5. バイリンガル基盤（§1.2）— 既存カラムの充足状況

スプレッドシートには既に言語カラムが存在。充足率のみ課題。

| シート | 言語カラム | 充足（非空/全体） |
|---|---|---|
| ARTISTS | name_en / bio_en | 0/89 / 0/89 |
| VENUES | name_en / DESC_EN | 0/24 / 0/24 |
| FESTIVALS | name_en / DESC_EN | 0/86 / 0/86 |
| EVENTS | NAME_EN / DESC_EN | 0/7 / 0/7 |

## 6. スキーマ§7で名指しされた個別項目の実データ確認

- matricaria DESC に Fukushima: 該当あり（要修正）
- vent DESC に Shibuya: 該当あり（要修正）

---

## 影響評価

- **本番サイト・CMSへの影響**: このレポート作成では **ゼロ**（読み取り専用）。
- ID変更を実施する場合のみ、記事/アーティストの **URLが変わる** → リダイレクト対応が別途必要。
- サイトは現在 `data.js` 直読み。`data/*.json` パイプライン（§4）は未構築。


## 7. ⚠️ 本番 data.js に既に混入している規約違反（要注意）

ARTISTS 生データ89件のうち ID違反は末尾20件（69行目以降）に集中。
本番 data.js（69件）はそれより手前の clean な slug が中心だが、
**本番 data.js のアーティストIDは全件clean**（規約違反IDの混入ゼロ）。
違反20件はすべて STATUS未公開の生データで、本番には出ていない。

- いずれも「連続ハイフン（`--`）」型。§1.1 は `--` を明確に禁止。
- これらは実在アーティストの詳細ページURL（`artists.html#artist/{id}`）になっているため、
  ID修正時は **リダイレクト or hash側の後方互換**が必要（Phase後半で対応）。
- 修正までは「動いてはいるが規約違反」状態。**勝手に直さず、この報告に留める**（CLAUDE.md 方針）。

## 8. fetch-data.mjs の状態（Phase 0 成果物）

- `scripts/fetch-data.mjs` を作成（依存ゼロ・RFC4180 CSVパーサ内蔵）。
- 現状 `PUBLISH_EMPTY_STATUS=true`（空欄=公開扱い）だと、末尾のID違反20件も
  「公開」判定 → §6 に従いエラー26件でビルド停止する。
  → **これは正しい挙動**（規約違反データを本番JSONに出さないための番人）。
- Phase 0 完了後の使い方: スプレッドシートのID違反を修正 → エラー0 → `data/*.json` 生成成功。
- サイトは現在も `data.js` 直読みのため、`data/*.json` 生成有無に関わらず**本番は無影響**。
