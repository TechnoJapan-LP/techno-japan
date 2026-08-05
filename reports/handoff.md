# Session Handoff

セッション間の短期的な引き継ぎ専用ログです。
長い背景説明・事故の経緯・設計判断は [AUDIT_TECHNO_JAPAN.md](../AUDIT_TECHNO_JAPAN.md) に記録し、ここからリンクしてください。

## 記入ルール

- 作業完了時に、下のテンプレートを1エントリ追記する。
- 追記後にこのファイルを含めてコミットする。
- 並行セッションがある場合は、追記前に最新をpull/rebaseする。
- 既存エントリは書き換えず、競合時も両方の記録を残す。
- 必須項目を空欄にしない。「確認済み・0件」「なし」「判断不要」のように明記する。

## 完了報告テンプレート

```md
## YYYY-MM-DD / 担当セッション / 状態（完了・作業中・ブロック）

### 実施
- 

### コミット
- SHA: （未コミットなら「未コミット」）
- push / rebase 状態: 

### 検証
- コマンドまたは実ブラウザ確認: 結果

### 変更したパターン
- （例）`<img src="${...}">` 6箇所
- （無ければ）確認済み・0件

### 未確認の類似パターン
- （例）`background-image: url('${...}')` — 未調査
- （例）`element.src = ...` — 未調査
- （無ければ）確認済み・0件

### 次の担当への注意・判断待ち
- （無ければ）なし
```

## 2026-08-04 / Codex / 完了

### 実施
- `reports/handoff.md`を新設し、必須項目6つとパターン確認欄を定義
- `AGENTS.md`に追記・rebase・AUDIT使い分けの運用ルールを追加
- 既存`HANDOFF.md`に新運用への移行案内を追加

### コミット
- SHA: このエントリを含めてコミット予定
- push / rebase 状態: 未push

### 検証
- `git diff --check`: 実行予定
- Markdown構造: 確認済み

### 変更したパターン
- `reports/handoff.md`の必須6項目テンプレート: 1件
- `AGENTS.md`のセッション間引き継ぎ規則: 1セクション
- `HANDOFF.md`冒頭の移行案内: 1ブロック

### 未確認の類似パターン
- 確認済み・0件（今回の変更は運用文書のみ）

### 次の担当への注意・判断待ち
- なし

## 2026-08-04 / Codex / 完了

### 実施
- 最新`LP/data.js`を確認し、残り46件から既知の残置対象5件と`dungeoneering`を除外
- 最新NAMEを反映した40件の判断用CSVを作成

### コミット
- SHA: このエントリを含めてコミット予定
- push / rebase 状態: 未push

### 検証
- CSV行数: 40件（個別判断9件、draft候補31件）
- `data/inbox/*.json`: 変更なし（別セッションの変更は保持）

### 変更したパターン
- `reports/artists-ref1-review-40.csv`: 新規1ファイル
- 最新data.jsで反映確認: CHOKO / endorphin / NC4K / NUTMEG / TSUTOMU / DJ YURIPON

### 未確認の類似パターン
- 確認済み・0件（外部Web検索・INBOX編集は行っていない）

### 次の担当への注意・判断待ち
- 昨日残すと決めた11件のうち、今回の46件に含まれる5件と`dungeoneering`を除外。残り6件は46件の対象外層に含まれるため、今回のCSVには現れない。

## 2026-08-04 / Codex / 完了

### 実施
- ARTISTS「参照1件・情報なし」74件を棚卸しし、分類CSVを作成

### コミット
- SHA: このエントリを含めてコミット予定
- push / rebase 状態: 未push

### 検証
- CSV行数: 74件
- 詳細ページ存在確認: 74/74
- `data/inbox/*.json`: 未読込・未変更

### 変更したパターン
- `reports/artists-ref1-no-info-74.csv`: 新規1ファイル

### 未確認の類似パターン
- 確認済み・0件（外部Web検索・INBOX編集は行っていない）

### 次の担当への注意・判断待ち
- なし

## 2026-08-04 / Claude (Opus 5) / ブロック（停止条件に到達）

### 実施
- `research_festival.mjs init` の上書きバグを修正（AUDIT §9-37）。既存の調査結果を巻き戻していた
- フェス調査バッチ1（開催前の近い順6件）: hacha-mecha / global-ark / loa / bondisco / yamauto / sonic-mania
- 着手前の棚卸しで、未調査17件の内訳が判明:
  - 完全登録済み **1件**（hacha-mecha。調査で内容一致も確認）
  - 一部欠損 **12件**（date/city は入っており、location 系・url・instagram・ticketUrl・lineup が空）
  - 未登録 **4件**（sub-tide / e-groove / sonic-mania / loa）
- INBOX の重複2組を特定（削除は依頼者が実施）

### コミット
- SHA: `7229f64`（init 修正 + §9-37）→ push 済み（`9b9a9dc` に含まれる）
- 調査結果 `data/inbox/*.json` 6件: **未コミット**
- push / rebase 状態: 追記前に rebase 済み

### 検証
- `research_festival.mjs validate`: 対象6件すべて `✓ 調査 9/9`
- `init` 再実行: `作成 0 / スキップ 29`、既存ファイルの git 差分なし（上書き再発しないことを確認）
- geocode: hacha-mecha は施設名で一致（confidence high）。global-ark / bondisco は住所フォールバックで confidence low

### 変更したパターン
- `research_festival.mjs` の存在検査を「書き込み先パス（stem2）」基準に統一: 1箇所
- 調査JSONの記入: 6件 × 9項目

### 未確認の類似パターン
- `research_festival.mjs` の他コマンド（`geocode` / `validate`）に同種の「入口と出口の食い違い」が無いか — **未調査**
- INBOX 由来の日付フォーマット2種（ISO / ドット区切り）が他の列にも混在していないか — **未調査**
- geocode の住所フォールバックで語中切断が起きる件、既存11件の座標にも同じ誤りが無いか — **未調査**

### 次の担当への注意・判断待ち

**停止条件に到達したため、バッチ2に進んでいません。**

1. **日付の食い違い 2件（停止条件）**
   - `sonic-mania`: INBOX `2026.08.14`。SUMMER SONIC 2026 公式サイトに SONICMANIA へのリンクが1本も無く、公式 SONICMANIA ページは2025年版、幕張メッセの会場ページは2024年版が最新。**2026年の開催自体が未確認**。8/14 は SUMMER SONIC 東京の初日で、SONICMANIA は例年その前夜（2026年なら 8/13）
   - `bondisco`: INBOX `2026.08.22-30` / PREF `Kyoto`。IG bio は `22-23 August 2026` / `Hyogo`、公式サイト（2025年版）の会場は兵庫県三田市。**INBOX の日付は同じ行の YAMAUTO（2026.08.22-30）と同一で、転記誤りの可能性が高い**
2. **geocode の想定外挙動（停止条件）**
   - `global-ark`: 施設名（野反湖キャンプ場）が OSM に無く住所フォールバックへ。そこで住所が **語中で切断**され `群馬県吾妻郡中之条町大` になり、**大竹川（川）にヒット**。実際の野反湖から約15km east。`addressCandidates()` の段階的短縮が `大字入山国有林224` を `大` まで削ったため
   - `confidence: low` が付くので設計どおりの安全側だが、**値としては使えない**。野反湖そのものは `36.7069, 138.6458` で引けるため、会場座標は手当てが必要
3. **空振り1件**: `sonic-mania`（3件連続ではないので停止理由ではない）
4. **LOA は検索で完全に空振りしたが、INBOX の Instagram から日付・会場・チケットまで到達できた。** link-open-air の教訓が再現した形。以後も IG を最初に当てること
5. **未調査11件**（すべて開催済み・情報が消えている可能性あり）: japonism / body-soul / signal / dots / samsara / moment / orbit / pure-rave / fulirock / sub-tide / e-groove

## 2026-08-04 / Claude (Opus 5) / 完了（バッチ2・停止条件には未到達）

### 実施
- フェス調査バッチ2（5件）: e-groove / sub-tide / orbit / pure-rave / fulirock
- INBOX の現状を再取得（依頼者の整理が反映済み。26行・重複なし・BonDisco 修正済み・FuliRock の URL 空欄化済み）

| id | 結果 |
|---|---|
| `sub-tide` | 公式サイトから会場・住所・チケット・DJ 23組を取得。**今回で最も収穫が大きい** |
| `orbit` | linktree から ZAIKO チケットと会場名。日本語会場名・住所は未到達 |
| `e-groove` | IG bio から日程・会場（秋田市雄和 日本庭園）。**会場とチケットは DM 対応で非公開** |
| `pure-rave` | 主催者アカウントのみ、フェス専用の情報なし（依頼どおり記録） |
| `fulirock` | **実在の確認ができず。FUJI ROCK の可能性が高い**（下記） |

### コミット
- SHA: このエントリを含めてコミット
- push / rebase 状態: 追記前に rebase 済み

### 検証
- `research_festival.mjs validate`: 5件とも `✓ 調査 9/9`
- `geocode sub-tide`: `36.0048, 138.6446`（三川, 南相木村）。南相木ダムから **0.7km** で妥当。confidence medium
- 語中切断の修正後に実行し、異常な短縮は発生しなかった

### 変更したパターン
- 調査JSONの記入: 5件 × 9項目
- `conflictNote` の追記: 2件（pure-rave の日付、fulirock の Instagram）

### 未確認の類似パターン
- INBOX の `PREF` 列に県名でない値が入る例（`pure-rave` = "Kanto"）が他にもないか — **未調査**
- `sub-tide` の Live 欄（B.T.Reo 440 ほか）は本文取得が途中で切れており未収録 — **DJ 欄のみ収録済み**
- IG の bio だけ読んで投稿画像を読んでいない項目（lineup が取れなかった e-groove / orbit / loa） — **未調査**

### 次の担当への注意・判断待ち

1. **`fulirock` は実在しない可能性が高い（判断待ち）**
   - INBOX: `2026.07.24-26` / `Niigata`
   - FUJI ROCK '26 公式: 「2026年7月24日(金) 25日(土) 26日(日)」「新潟県 湯沢町 苗場スキー場」
   - **日程・県が完全一致。** 当初 INBOX に入っていた URL も FUJI ROCK 公式（fujirock_jp）
   - 「FuliRock」名義の独立したフェスは検索で1件も出ない
   - 依頼者は「FuliRock は新潟の別フェスで FUJI ROCK とは無関係」との認識だが、**証拠は逆を示している**
   - **FUJI ROCK の情報を FuliRock として登録してはいけない。** 値は全項目 null のまま保留
2. **`e-groove` は会場・チケットが非公開**（IG bio「チケット、会場はDMへ」）。掲載するなら主催者への確認が要る
3. **`pure-rave` は INBOX の PREF が "Kanto"** で県名ではない。会場非公開のフェスの可能性
4. 残り5件（未着手）: japonism / body-soul / signal / dots / samsara
5. 停止条件には到達していない（空振り連続2件で止まらず、日付食い違い0件、geocode 正常）

## 2026-08-04 / Claude (Opus 5) / 完了（バッチ3＋FUJI ROCK。INBOX 全件が調査済みに）

### 実施
- `fuji-rock`（旧 fulirock）を FUJI ROCK として調査。**既存行の是正であることが判明**
- バッチ3（6件）: japonism / body-soul / signal / dots / samsara / moment
- **これで INBOX 全27件が `調査 9/9` に到達**

| id | 収穫 |
|---|---|
| `fuji-rock` | 公式から日程・会場・住所・チケット・主要30組。geocode は苗場スキー場に正確に一致 |
| `dots` | ZAIKO から会場「藍鱗」・住所・チケット・出演者。geocode も会場名に正確に一致 |
| `japonism` | 欠けていた url / lineup を確認（url は存在せず、lineup は未到達） |
| `body-soul` | 会場 Kiranah Garden Toyosu と公式サイトを特定 |
| `moment` | 会場 Dorogawa Camp Site を特定。linktree に販売リンクは無し |
| `signal` | 日程のみ確定。**既存行が2025年の日付のまま** |
| `samsara` | 会場 Windera CAMPGROUNDS 八ヶ岳（二次情報）。geocode は OSM 未収録で取得できず |

### コミット
- SHA: このエントリを含めてコミット
- push / rebase 状態: 追記前に rebase 済み

### 検証
- `research_festival.mjs validate`: **全27件 `✓ 調査 9/9`、`✗` は0件**
- `geocode fuji-rock`: `36.795, 138.7788`（苗場スキー場, 湯沢町）— 会場名で正確に一致
- `geocode dots`: `42.9321, 141.4131`（藍鱗, 有明, 清田区, 札幌市）— 会場名で正確に一致
- `geocode samsara`: 見つからず（Windera CAMPGROUNDS が OSM 未収録）。値は入れていない

### 変更したパターン
- 調査JSONの記入: 6件 × 9項目 ＋ fuji-rock 11項目
- `id` の是正: 2件（`fulirock`→`fuji-rock` ファイル名も変更、`body-soul-live-in-japan`→`body-soul`）
- 画像から読み取った項目（confidence low ＋ note に「画像から読み取り、未検証」）: 3件
  （body-soul の location_ja / moment の location_ja / moment の city）

### 未確認の類似パターン
- **`init` が id.value と ファイル名で別の値を採る場合がある** — `body-soul` で発生。
  名前が slugify できると `id.value` は slugify 結果、ファイル名は既存 FESTIVALS の id になる。
  他に該当する行がないか — **未調査**
- IG 投稿画像の中にある lineup（`loa` / `e-groove` / `orbit` / `japonism` / `signal` / `samsara` / `moment` の7件）— **未取得**
- 既存 FESTIVALS 行の日付が前年のまま、というケース — `signal` で1件確認。**他は未調査**

### 次の担当への注意・判断待ち

1. **`fuji-rock` は新規登録ではなく既存行の是正**
   - 既存 `fulirock` 行の `desc` / `desc_en` は**すでに FUJI ROCK について書かれている**（「フジロックフェスティバルは、毎夏、苗場の山々を…」）。誤っているのは `id` と `name` だけ
   - 詳細ページ `/festivals/fulirock.html`（JA/EN）と sitemap 掲載があるため、**ID 変更時は `build-detail-pages.mjs` の `REDIRECTS` に旧ID のスタブを追加すること**
   - §9-28 の分類では「正しいコンテンツの正しくないURL」に当たり、リダイレクトが妥当（404 にすべき類ではない）
2. **`signal` の既存行が前年の日付** — `2025-06-14/2025-06-15`。IG bio・INBOX・二次情報の3つが `2026-06-13/2026-06-14` で一致するので更新が必要
3. **`samsara` の座標が取れない** — Windera CAMPGROUNDS 八ヶ岳 が OSM 未収録。CMS の「施設名から検索」(resolve_place) を使うか、八ヶ岳周辺の代表座標で代用するか判断が要る
4. **`e-groove` の LOCATION 表記**（判断待ち。下記の提案参照）
5. **`pure-rave` の開催地** — 主催者アカウントに情報が無く、INBOX の PREF も「Kanto」で県名でない。会場非公開型の可能性

## 2026-08-04 / Claude (Opus 5) / 完了（判断5件の反映 ＋ init のID不一致を構造的に修正）

### 実施
- `fulirock` → `fuji-rock` のリダイレクトを `build-detail-pages.mjs` に追加
- `samsara` の座標を富士見町の代表座標で記録（会場は OSM 未収録）
- `e-groove` の LOCATION を A案（判明している会場名を残す）で記録
- `pure-rave` の city を空欄化（会場非公開のため）
- **`init` が id.value とファイル名で別の値を採るバグを修正**（調査ではなくコード側で塞いだ）

### コミット
- SHA: このエントリを含めてコミット
- push / rebase 状態: 追記前に rebase 済み

### 検証
- `research_festival.mjs validate`: **全27件 `✓`、`✗` 0件**
- `init` のID不一致: 全27件を照合し**現時点の不一致は0件**。さらに `body-soul.json` を消して
  再生成し、`id.value` が既存FESTIVALSの `body-soul` になることを確認（修正前は `body-soul-live-in-japan`）
- リダイレクト: `build-detail-pages.mjs` 実行で **スタブは出ない**ことを確認（`0 written`）。
  旧IDが現役かつ新IDが未登場のためで、既存のガードが意図どおり働いている
- `samsara` の会場は英字・日本語・キャンプ場表記の4通りで Nominatim を試して全て不発

### 変更したパターン
- `REDIRECTS` に `festivals` / `en/festivals` を追加: 2エントリ（`FESTIVAL_ID_FIXES`）
- `redirectStubs()` の呼び出しを festivals の writeAll に追加: JA/EN 2箇所
- `init` の id 決定ロジック: 1箇所
- 調査JSONの修正: 3件（samsara 座標 / e-groove LOCATION / pure-rave city）

### 未確認の類似パターン
- `REDIRECTS` に `venues` / `en/venues` の経路が無い。会場のID是正が起きた場合に
  リダイレクトを出せない — **未調査**（現時点で該当なし）
- `init` は INBOX の名称が変わると別ファイルを作る。`fulirock.json` が再生成された（削除済み）。
  他に旧名のまま残っている調査ファイルが無いか — **確認済み・0件**
- IG 投稿画像の中にある lineup 7件 — **別タスクに切り出し（優先度低）**

### 次の担当への注意・判断待ち
1. **`fuji-rock` のシート修正待ち**。FESTIVALS の **A列（ID）を `fuji-rock`、C列（NAME）を `FUJI ROCK FESTIVAL '26`** へ。
   Publish 後の次回ビルドで `/festivals/fulirock.html` が自動的にリダイレクトスタブへ変わる
2. **`signal` の日付更新待ち**。既存 `2025-06-14/2025-06-15` → **`2026-06-13/2026-06-14`**
3. `samsara` の座標は富士見町の代表座標（`35.9146, 138.2407`、confidence low）。
   会場が富士見町にあること自体が二次情報なので、一次情報が出たら差し替える
4. `e-groove` の「日本庭園」は一般名詞で正式名称が未確認。掲載前に主催者確認が望ましい
# 2026-08-04 / Codex / モバイル言語トグル修正

### 変更
- `LP/common.css`: モバイル overlay 内の `.nav-lang` を追加。現在言語の視認性とリンクの44px以上のタップ領域を確保。
- `scripts/build-detail-pages.mjs`: 詳細ページの overlay に言語トグルを生成。
- JA ハブ5枚を更新し、EN ハブ5枚と JA/EN 詳細ページを再生成。
- `scripts/check_mobile_language_toggles.mjs` と npm script `check:mobile-language` を追加。

### 確認
- `npm run check:mobile-language`: 375px / 390px、JA/EN 12ページを展開検査し **24/24**。
- `python3 scripts/check_regressions.py`: **回帰なし**。
- デスクトップ用 `.nav-links` のトグルは維持。詳細生成物の JA/EN に overlay トグルを確認。

### 変更したパターン
- `nav .nav-links` 内の既存トグル — 変更なし（デスクトップ用）。
- `.nav-overlay .nav-lang` — 新規追加、ハブ10枚＋詳細生成テンプレート。

### 未確認の類似パターン
- `nav-lang` を持たない EN 対応外のページ（記事等）— **確認済み・対象外**。
- JavaScript が動的に生成する別の言語リンク — **確認済み・0件**。

### 次の担当への注意・判断待ち
- Publish 後に詳細ページを再生成する場合は、`git pull` 後に `npm run check:mobile-language` と回帰ガードを再実行すること。

## 2026-08-04 / Claude (Opus 5) / 完了（ARTISTS 整理の反映検証。common.css の ?v 漏れを1件検出・修正）

### 実施
- Publish（`759fa55`）の反映を検証。`npm run fetch` → `build-detail-pages.mjs`
- draft 化されたアーティストを data.js の差分から特定（**24件**）
- 閾値4件を実測値へ更新（うち3件は draft 化の帰結、1件は他セッションの変更由来）
- **`common.css` の `?v` 据え置きを検出して修正**（下記）

### コミット
- SHA: このエントリを含めてコミット
- push / rebase 状態: 追記前に rebase 済み

### 検証

| 確認項目 | 結果 |
|---|---|
| draft 化件数 | **24件**（ARTISTS 109 → 88。別途 sisi / ouissam / tonbo の3件が新規公開） |
| 詳細ページの削除 | **24件すべて JA/EN とも削除済み** |
| published 残存 | **0件**（draft 化した24件はいずれも data.js に残っていない） |
| 取り残しページ | **0件**（published でない詳細ページはリダイレクトスタブのみ） |
| `lineup_linked_acts` | 115 → **91** |
| `/festivals/fulirock.html` | **JA/EN ともリダイレクトスタブに変化**。JA → `/festivals/fuji-rock.html`、EN → `/en/festivals/fuji-rock.html`。遷移先も実在 |
| `signal` の日付 | **2026-06-13/2026-06-14** に更新済み（JA/EN の JSON-LD `startDate` も一致） |
| 全ガード | `check_regressions` ✅ / `check_hub_pages` ✅（例外0・Broken images 0）/ `check_sw_routing` ✅ / `check_asset_versions` ✅ / `check:mobile-language` 24/24 ✅ |
| 再生成の不動点 | ✅ `0 written` |

### 変更したパターン
- 閾値の引き下げ4件（すべて根拠を note に明記）
  - `lineup_linked_acts` 115 → 91（Perkey の編集判断による draft 化）
  - `artist_entity_id_pages` 200 → 176（88件 × JA/EN と一致を確認）
  - `submit_link_pages` 426 → 415（詳細ページ48枚の削除分。スタブはフッターを持たない）
  - `en_hub_static_links_ja_chars` 52 → 51（`ao`「青」の draft 化で1字減）
- `common.css?v=4` → `?v=5`: HTML 416枚 ＋ 生成側テンプレート1箇所

### 未確認の類似パターン
- 他セッションの `b84e4b8` は `common.css` 以外の JS/CSS を変更していない — **確認済み・0件**
- リダイレクトスタブの `<html lang="ja">` が EN 版でも "ja" のまま — **未対応**（noindex の中継ページなので実害は小さい）
- `etsuetsu` の LINEUP が `dj-yogurt`（ハイフン区切り）で未解決のまま — **依頼者が次の Publish で修正予定**

### 次の担当への注意・判断待ち

1. **`common.css` の `?v` 漏れを1件検出した（修正済み）**
   - `b84e4b8`「fix: expose mobile language toggle in menu」が `.nav-overlay .nav-lang` の CSS を
     `common.css` に追加したが、`?v=4` を据え置いていた
   - `sw.js` は CSS を cache-first で扱うため、**一度訪問したブラウザにはモバイルトグルの
     スタイルが永久に届かない**状態だった。機能そのものが見えない
   - §9-36 と同型。**同日に広げた `check_asset_versions.py` の検査（対象リスト → 除外リスト）が
     捕まえた。** 反転していなければ素通りしていた
   - `?v=5` へ更新済み（HTML 416枚＋生成側テンプレート）。**生成側を忘れると次のビルドで巻き戻る**
2. `lineup_linked_acts` は 91 が新しい下限。`etsuetsu` の LINEUP 修正で 92 になる見込み
3. `sisi` / `ouissam` / `tonbo` の3件が新たに published になっている。意図した公開か未確認

## 2026-08-05 / Codex / 完了（EDITIONS・LINEUPS正式接続）

### 実施
- `fetch-data.mjs` の正式ソースを EDITIONS（gid `1765363054`）/ LINEUPS（gid `580984930`）へ切替
- CMSでシートの開催回を読み込み、既存行の回別編集を `update_row` で同期
- 新規開催回・出演行は各シート末尾の次行へ `update_row` で追記
- DATA_SCHEMA と AUDIT §9-43 を実装状態へ更新

### コミット
- SHA: `3e985ed`（正式ソース接続）、`b59bfa4`（CMS同期）
- push / rebase 状態: push済み。Deploy `30970256013` 成功

### 検証
- `node scripts/fetch-data.mjs --dry`: EDITIONS 95行 / LINEUPS 130行、エラー0
- `python3 scripts/check_regressions.py`: 全項目通過
- `python3 scripts/check_asset_versions.py --base HEAD~1`: cms.js v39、通過
- GitHub Actions 回帰ガード・Deploy: 成功

### 変更したパターン
- EDITIONS / LINEUPS 公開CSV → JSON生成: 1経路
- CMS開催回編集 → EDITIONS / LINEUPS `update_row`: 2経路

### 未確認の類似パターン
- `festival-de-frue` のLINEUPS 7行が `festival-de-frue-2026` を参照していない — **警告として検出済み・データ修正は未実施**
- `matricaria-2026` の `doltz.` / `Tonbo` ARTIST_ID参照切れ — **警告として検出済み・データ修正は未実施**

## 2026-08-05 / Codex / 作業中（開催回CMSブリッジ）

### 実施
- FESTIVALS CMS に開催回セレクターを追加
- 年・回数・日程・会場・住所・座標・チケット・フライヤー・ステータス・LINEUPを回ごとに編集可能化
- `fetch-data.mjs` が既存の `Editions` JSON から複数開催回を展開できるよう変更

### コミット
- SHA: `3282b65`（CMS・複数回展開）、`8d8813e`（AUDIT §9-43）
- push / rebase 状態: push済み。Deploy `30967144297` 成功

### 検証
- `node --check LP/cms.js`: 成功
- `node --check scripts/fetch-data.mjs`: 成功
- `check_asset_versions.py`: 成功（cms.css v14 / cms.js v37）
- `check_regressions.py`: 成功
- GitHub Actions 回帰ガード・Deploy: 成功

### 変更したパターン
- 開催回選択・回別入力フォーム: 1経路
- FESTIVALS の Editions JSON → editions/lineups 展開: 1経路

### 未確認の類似パターン
- EDITIONS / LINEUPS シートを正式な書き込み元にするGAS経路: **未実装**
- EDITIONSシートからCMSへ直接読み込み・行追加する経路: **未確認**

### 次の担当への注意・判断待ち
- 現在は既存FESTIVALS行の `EDITIONS` JSON を使う移行ブリッジ。EDITIONS / LINEUPS シートの正式入稿元切替は段階2として残る。

## 2026-08-05 / Codex / 完了（EDITIONS FLYERアップロード）

### 実施
- 開催回ごとの FLYER にファイル選択アップロードを追加
- 画像URLからのアップロードを追加（CORS時はGASフォールバック）
- アップロード直後のプレビューを追加
- 命名を `images/festivals/{EDITION_ID}-flyer.webp` に統一
- Drive同期の既存 `festivals` フォルダ経路を利用
- AGENTS.md / DATA_SCHEMA.md に開催回運用と命名規則を記録

### コミット
- SHA: `1f510cc`（FLYER UI）、rebase後 `2e65cd8`
- push / rebase 状態: push済み。Deploy `31014727911` 成功

### 検証
- `node --check LP/cms.js`: 成功
- `check_asset_versions.py`: cms.css v15 / cms.js v41
- GitHub Actions 回帰ガード・Deploy: 成功

### 変更したパターン
- EDITIONS FLYERのファイルアップロード / URLアップロード / プレビュー: 1経路

### 未確認の類似パターン
- 実ブラウザでの認証後のDrive保存操作: **未実施**（この実行環境にブラウザ操作環境なし）
- EDITIONS に開催回ごとの IMAGE（メイン画像）を持たせる設計: **未実装**。現状はブランド共通IMAGE + 回別FLYER。

## 2026-08-05 / Codex / 完了（次回開催作成フロー）

### 実施
- 既存フェス編集時の FESTIVALS 日程欄を読み取り専用化し、履歴の上書きを防止
- EDITIONS の開催回セレクターに「次回開催を作成」を追加
- 選択中の回から翌年を作成し、会場・住所・座標を引き継ぎ、日程・チケット・フライヤー・LINEUPは空欄化
- AGENTS.md に年次更新の運用ルールを追記

### コミット
- SHA: `13033e6`（CMS）、`97d927f`（生成物）、`a829cfe`（キャッシュ更新）
- push済み。Deploy `31016416478` 成功

### 検証
- `node --check LP/cms.js`: 成功
- `git diff --check`: 成功
- 回帰ガード（生成物・cache busting・SW routing・閾値・JS health）: 成功

### 変更したパターン
- 開催回の新規作成ボタン・翌年複製: 1経路
- 既存フェスの日程入力欄の編集保護: 1経路

### 未確認の類似パターン
- 認証済みCMSでの実ブラウザ操作（次回開催作成→保存→シート反映）: **未実施**
- 複数年表記（`2026-spring` 等）の回数自動判定: **未確認**。年の選択・回数は保存前に確認する。

## 2026-08-05 / Codex / 完了（日程ショートカットの改善）

### 実施
- FESTIVALSの日程欄を既存フェスでも編集可能に戻した
- 保存時、読み込み済みの最新年EDITIONSへ日程を同期
- 過去のEDITIONSは変更しない
- 保存処理がフォーム初期化後もEDITIONS/LINEUPSを同期できるよう退避データを使用
- `cms.js?v=43` に更新

### コミット
- SHA: `3b109b2`
- push済み。Deploy `31018681146` / Lighthouse `31018772835` 成功

### 検証
- `node --check LP/cms.js`: 成功
- 回帰ガード・Deploy・Lighthouse: 成功

### 変更したパターン
- FESTIVALS日程 → 最新EDITIONS日程同期: 1経路

### 未確認の類似パターン
- 認証済みCMSでの実際の保存操作: **未実施**

## 2026-08-06 / Codex / 完了（EDITIONSフライヤー保存競合）

### 実施
- EDITIONSシートの非同期読込中にフライヤーを保存すると値が消える競合を修正
- 読込中に保存操作を行った場合は読込完了後に自動継続
- 読込前に入力したFLYERパス・日程等をシート値で上書きしないよう保持
- `cms.js?v=44` に更新

### コミット
- SHA: `335739b`
- Deploy `31020366999` 成功

### 検証
- `node --check LP/cms.js`: 成功
- 回帰ガード・Deploy: 成功

### 変更したパターン
- EDITIONS読込とCMS保存の競合保護: 1経路

### 未確認の類似パターン
- 認証済みCMSで実際にファイルを選択して保存する操作: **未実施**

## 2026-08-06 / Codex / 完了（EDITIONS LINEUP複数行入力）

### 実施
- LINEUP欄をtextarea化し、1行1組の貼り付けに対応
- カンマ区切り入力も引き続き対応
- 保存時に改行・カンマを分解してLINEUPSへ反映
- `cms.css?v=16` / `cms.js?v=45` に更新

### コミット
- SHA: `699198e`（入力UI）、`2cdc634`（キャッシュ更新）
- Deploy `31023518085` 成功

### 検証
- `node --check LP/cms.js`: 成功
- 回帰ガード・Deploy: 成功

### 変更したパターン
- EDITIONS LINEUP textarea（改行・カンマ分解）: 1経路

### 未確認の類似パターン
- 認証済みCMSで実際に複数行を貼り付けて保存する操作: **未実施**

## 2026-08-06 / Codex / 完了（次回開催の日程自動反映）

### 実施
- 次回EDITIONSの最新年・日程を保存すると、FESTIVALSの日程も自動更新
- 日程未入力時はFESTIVALSを上書きしない
- 過去回のEDITIONSは変更しない
- `cms.js?v=46` に更新

### コミット
- SHA: `92bc8bb`（実装）、`9d2b8ff`（生成物）、`88a1605`（キャッシュ更新）
- Deploy `31025333765` 成功

### 検証
- `node --check LP/cms.js`: 成功
- 回帰ガード・Deploy: 成功

### 変更したパターン
- 最新EDITIONS日程 → FESTIVALS日程同期: 1経路

### 未確認の類似パターン
- 認証済みCMSでGlobal Arkの2026年版を実操作する確認: **未実施**
