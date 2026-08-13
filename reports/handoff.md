# Session Handoff

セッション間の短期的な引き継ぎ専用ログです。
長い背景説明・事故の経緯・設計判断は [AUDIT_TECHNO_JAPAN.md](../AUDIT_TECHNO_JAPAN.md) に記録し、ここからリンクしてください。

## 2026-08-07 / Codex / 完了（LINEUP候補の誤採用防止）

### 実施
- LINEUP入力で未登録の `YAMA` が前方一致候補 `YAMARCHY` に暗黙変換されないよう修正
- 候補は「候補を採用」と明示された場合だけ登録
- Enter入力は元の表記を未解決タグとして保持
- CMSのキャッシュ番号を `cms.js?v=53` に更新

### コミット
- SHA: `7e27213`
- push / rebase 状態: push済み。後続pushによりDeployは再確認待ち

### 検証
- `node --check LP/cms.js`: 成功
- `node scripts/check_cms_editions.mjs`: 8/8項目通過

### 変更したパターン
- LINEUP単一入力の候補採用経路: 1経路
- Enterによる未解決表記の保持: 1経路

### 未確認の類似パターン
- 実ブラウザでの認証済みCMS操作: **未実施**

### 次の担当への注意・判断待ち
- `Sync Drive Images` の実行が準備段階で停滞中。CMS修正の本番反映はDeploy完了後に確認する。

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

## 2026-08-06 / Codex / 完了（EDITIONS同期の誤警告）

### 実施
- EDITIONS / LINEUPS同期でGASの `status: "success"` を成功扱いに修正
- 保存成功後に「同期失敗」と表示される誤警告を解消
- `cms.js?v=47` に更新

### コミット
- SHA: `c9f5df5`
- Deploy `31025900460` / Lighthouse `31026044254` 成功

### 検証
- `node --check LP/cms.js`: 成功
- 回帰ガード・Deploy・Lighthouse: 成功

### 変更したパターン
- GAS同期レスポンス成功判定: 1経路

### 未確認の類似パターン
- 認証済みCMSでの実保存操作: **未実施**

## 2026-08-06 / Codex / 完了（全面強化・初動）

### 実施
- 公開・CMS/GAS・Publish・Backup・CIを横断監査
- Publish停止原因 `yazzus` 参照切れを特定
- 参照切れを全件収集し、該当 EDITION_ID まで表示する生成器に改善
- セキュリティ/信頼性の段階的実装計画を `reports/security-hardening-plan.md` に記録

### コミット
- SHA: `d3305c9`
- Deploy `31062591994` 成功

### 検証
- `node --check scripts/build-detail-pages.mjs`: 成功
- 回帰ガード・Deploy: 成功

### 変更したパターン
- LINEUPS参照切れの全件診断: 1経路

### 未確認の類似パターン
- `yazzus` を含む最新シートの修正後Publish: **未実施**（シート修正が必要）
- CMS/GASの実ブラウザ認証操作: **未実施**

## 2026-08-06 / Codex / 完了（Claude引き継ぎ: データ正規化）

### 実施
- FESTIVALS / EDITIONSの緯度経度をfetch時に数値正規化
- 年なし `festival-de-frue` のLINEUPS 7行を唯一の公開回へ移送
- 14フェスのLINEUPS 434枠を再生成
- 回帰ガード・内部リンク・SW routing・Deployを再実行

### コミット
- SHA: `5daaaf6`
- Deploy `31069177224` 成功

### 検証
- FESTIVALS 93 / EDITIONS 97 / LINEUPS 434
- 参照エラー 0、`lineup_linked_acts` 98

### 変更したパターン
- 座標正規化: 1経路
- 年なしEDITION_IDの一意候補移送: 1経路

### 未確認の類似パターン
- `festivals.html` 派生画像生成: **未実装**（原本同期との分離設計が必要）
- 認証済みCMSの実操作: **未実施**

## 2026-08-06 / Codex / 完了（フェスティバルカード派生画像）

### 実施
- フェスティバルカード用に長辺960px・WebP quality 80の派生画像を59件生成
- 原本SHA-256をファイル名に含め、原本変更時にURLを更新
- manifest (`LP/image-derivatives.js`) と `tjCardAssetPath()` でカードだけを切替
- manifestに無い画像は原本へフォールバック
- Drive同期後に派生画像と寸法表を同一コミットへ生成
- 公開前ガード `check_image_derivatives.py` を追加

### 結果
- 派生画像合計: 約5.86MB（フェスティバル原本約18.94MBの30.9%）
- ローカルChrome検査: 壊れた画像0件、XSS 0件
- 回帰ガード、内部リンク、SW routingを通過
- Deploy `31072519892` 成功、Lighthouse `31072577878` 成功

### コミット
- `8bd4919` 派生画像本体
- `22298d5` 回帰ジョブへPillowを追加
- `09fd1c1` Drive同期ワークフローのYAMLインデント修正

### 変更したパターン
- `festivals.html` のカード画像 `tjCardAssetPath(...)`: 既存の画像参照1経路
- Drive同期 → 派生manifest → カード表示: 1経路

### 未確認の類似パターン
- artists / venues / index のカードはmanifest未収録時に原本へフォールバック: **確認済み・派生化は未実施**
- 詳細ヒーロー、フライヤー、CSS `background-image`: **確認済み・原本経路を維持**
- 本番スマホ実機での転送量計測: **未実施**

## 2026-08-06 / Codex / 完了（TOPのPublish後データ反映）

### 実施
- Service Workerの `data.js` を stale-while-revalidate から network-first に変更
- 初回表示は最新ネットワークデータ、オフライン時のみキャッシュへフォールバック
- Service Worker世代を `v1.14.0` に更新
- `check_sw_routing.mjs` の期待戦略を更新

### 原因
- 詳細ページは新しい生成物だったが、TOPの `data.js` は初回に古いキャッシュを返していた
- そのため新規フェスが詳細ページには存在しても、TOPのUpcoming一覧には表示されなかった

### 検証
- `node scripts/check_sw_routing.mjs`: 成功
- Deploy `31074629244`: 成功

### 変更したパターン
- Service Worker `/data.js` ルーティング: 1経路

### 未確認の類似パターン
- 実機でService Worker旧世代から更新される瞬間の表示: **未実施**

## 2026-08-06 / Codex / 完了（Festival入力の公開前関門）

### 実施
- Festivalの新規・既存編集でID、日付、座標を検証
- Editionの年、日付、座標、重複年を検証
- FestivalとEditionの役割をCMSラベルに明示
- Publish前にFESTIVALS / EDITIONS / ARTISTS / VENUES / ARTICLESの差分を表示
- EditionごとのLINEUP件数も差分確認に含めた
- 既存の詳細プレビュー（ヒーロー、日程、会場、フライヤー、LINEUP、履歴）を保存前経路として維持
- `cms.js?v=50`

### 検証
- `node --check LP/cms.js`: 成功
- `check_asset_versions.py`: 成功
- `check_sw_routing.mjs`: 成功
- Deploy `31075799271`: 成功
- Lighthouse `31075883518`: 成功

追記: EDITIONS / LINEUPS の差分取得は補助確認として扱い、取得失敗時も
FESTIVALS等の必須データのPublish自体は止めないようにした。

### 変更したパターン
- 新規Festival保存: バリデーション1経路
- 既存Festival保存: バリデーション1経路
- Publish Now: 差分確認1経路
- Festival/Edition役割説明: CMSフォーム1箇所

### 未確認の類似パターン
- 認証済みCMSで意図的な不正日付を入力する実操作: **未実施**
- Publish差分ダイアログの実ブラウザ操作: **未実施**

## 2026-08-08 / Codex / 公開前ブラウザ確認ルールの明文化

### 実施
- 自動検査だけでUI変更を公開しないルールを `AGENTS.md` に追加。
- 実ブラウザ（または同等のブラウザ自動操作）で、変更箇所の表示・操作・保持を確認してから公開する手順を必須化。
- CMS変更では「入力→プレビュー→閉じる→再表示→保存」の保持確認を必須化。

### コミット
- 未コミット（この追記と `AGENTS.md` の変更を同じコミットにする）。

### 検証
- ワークツリー確認: clean の状態から文書のみを変更。
- 実ブラウザ確認: **今回の既存デプロイについては未実施**。自動検査のみで公開したため、確認不足として記録する。

### 変更したパターン
- `AGENTS.md` に公開前の実ブラウザ確認ゲートを追加（UI操作、データ保持、複数経路、記録）。
- `reports/handoff.md` に今回の未確認事項と運用開始を追記。

### 未確認の類似パターン
- 今回の既存デプロイ済みUIを実ブラウザで再操作する確認 — 未実施。
- CI上でのブラウザ自動操作 smoke test — 未実装。

### 次の担当への注意・判断待ち
- 次のUI変更は、ブラウザ確認（手動または自動）が完了するまで公開しない。
- 既存の「本番表示」プレビューについては、Chrome自動操作をCIに追加し、ボタン操作・画像表示・本文保持を検査する。

## 2026-08-09 / Codex / 集中モードのプレビュー自動表示修正（未公開）

### 実施
- 集中モード開始時に、プレビューを強制的に表示しないよう変更。
- 集中モード開始前にプレビューを表示していた場合だけ、その状態を維持。
- `cms.js` のキャッシュバージョンを `v=67` から `v=68` に更新。

### コミット
- 未コミット（文書ルール変更と合わせて、ブラウザ確認後にコミット予定）。

### 検証
- `node --check LP/cms.js`: 成功。
- `git diff --check`: 成功。
- 実ブラウザ確認: 未実施。確認完了までpush・デプロイしない。

### 変更したパターン
- `toggleFocusMode()` の集中モード開始時プレビュー状態制御。
- `LP/cms.html` の `cms.js?v=68`。

### 未確認の類似パターン
- 集中モード中に手動でプレビューを開閉した場合の表示・終了後の状態: 未確認。
- 375px/390px のCMS表示: 確認済み・0件（今回の変更対象外だが実ブラウザ未実施）。

### 次の担当への注意・判断待ち
- Chromeで「プレビューOFF→集中モード」「プレビューON→集中モード」「本番表示を押さずに別ウィンドウが開かない」を確認してから公開する。

## 2026-08-09 / Codex / 集中モードCSSの強制表示を修正（未公開）

### 実施
- CSSが集中モード中の `.ar-preview` を常に `display:block !important` にしていたため、JavaScriptのOFF判定が無視されていた。
- 集中モード中は通常プレビューを非表示にし、`.preview-mode` が付いた時だけ表示するよう修正。
- `cms.css` のキャッシュバージョンを `v=22` から `v=23` に更新。

### コミット
- 未コミット。ブラウザ確認後に、前回のCMS修正と合わせてコミット予定。

### 検証
- `node --check LP/cms.js`: 成功。
- `python3 scripts/check_cms_article_state.py`: 成功。
- `node scripts/check_article_data_integrity.mjs`: 成功。
- `git diff --check`: 成功。
- 実ブラウザ確認: 未実施。確認完了までpush・デプロイしない。

### 変更したパターン
- `body.ar-focus-open .ar-preview` の表示制御。
- `LP/cms.html` の `cms.css?v=23`。

### 未確認の類似パターン
- 集中モード中の手動プレビュー開閉: 未確認。
- CSSキャッシュ更新後の実ブラウザ表示: 未確認。

### 次の担当への注意・判断待ち
- テスト環境でCSSが `v=23` になっていることを確認してから、プレビューOFF/ONの両ケースを操作確認する。

## 2026-08-09 / Codex / 集中モード全画面・左右分割テスト版（未公開）

### 実施
- 集中モード単体では編集欄を画面全体に広げ、右側の空白をなくすCSSを追加。
- 集中モード中にプレビューを明示的に開いた時だけ、編集欄とプレビューを左右50:50にする。
- 集中モード中にプレビューを閉じると、全画面編集へ戻るよう状態クラスを同期。
- `cms.css` を `v=24`、`cms.js` を `v=69` に更新。

### コミット
- 未コミット。PC幅での実ブラウザ確認後に判断する。

### 検証
- `node --check LP/cms.js`: 未実施（次に実行）。
- 実ブラウザ確認: 未実施。テスト版のためpush・デプロイしない。

### 変更したパターン
- `body.ar-focus-open .ar-editor-wrap.focus-mode` の全画面/50:50切替。
- 集中モード内のプレビューボタンによる `.preview-mode` 付け外し。

### 未確認の類似パターン
- 600px以下のモバイル表示: 未確認。
- 集中モード終了後の通常画面レイアウト: 未確認。

### 次の担当への注意・判断待ち
- PC幅で「集中モードのみ」「プレビューON」「プレビューOFFへ戻る」の3状態を確認する。

## 2026-08-09 / Codex / TOPフェス行スクロールリビール（未公開）

### 実施
- JA/ENのTOP「UPCOMING FESTIVALS」に、行が下から現れ背景画像が軽くズームする演出を追加。
- `prefers-reduced-motion` ではアニメーションを無効化。
- MOREで追加表示する行にも同じリビールを適用。
- 既存の並び順、リンク、データは変更していない。

### コミット
- 未コミット。JA/ENの実ブラウザ確認後に判断する。

### 検証
- `git diff --check`: 成功。
- JA/ENの行数: 1135行 / 1135行で一致。
- JAのローカル確認: 実施済み・意図した演出を確認。
- ENの実ブラウザ確認: 未実施。
- 本番反映: 未実施。

### 変更したパターン
- `LP/index.html` / `LP/en/index.html` の `.fest-row.reveal` CSS。
- フェス行生成時の `reveal` クラス付与。
- MORE展開後の `tjInitScrollReveal()` 呼び出し。

### 未確認の類似パターン
- EN TOPの実ブラウザでのスクロール・MORE展開: 未確認。
- モバイルTOPでの演出と reduced-motion: 未確認。

### 次の担当への注意・判断待ち
- EN TOPを確認し、JA/EN/モバイルで問題がなければコミット候補にする。

## 2026-08-09 / Codex / ARTICLE本文フォント追加テスト版（未公開）

### 実施
- Quillの本文フォント選択に `Serif` と `Condensed` を追加。
- CMSプレビューと詳細記事ページの両方に同じフォントクラスを追加。
- `detail.css` のバージョンを `v=5` から `v=6` にするビルド設定へ更新。
- CMSの `cms.js` キャッシュ番号を `v=70` から `v=71` に更新。

### コミット
- 未コミット。CMSでの選択・保存・詳細ページ表示を確認後に判断する。

### 検証
- `node --check LP/cms.js`: 次に実行。
- 実ブラウザ確認: 未実施。
- 本番反映: 未実施。

### 変更したパターン
- Quill font whitelist / toolbar options。
- CMS editor CSSと記事詳細CSSの `ql-font-serif` / `ql-font-condensed`。
- `build-detail-pages.mjs` の `DETAIL_CSS_VERSION`。

### 未確認の類似パターン
- 日本語本文でのSerif/Condensedの実フォント表示: 未確認。
- EN本文と本番生成後のフォント表示: 未確認。

### 次の担当への注意・判断待ち
- 記事IDの保存不具合は、対象IDと保存時のエラー文を確認してから修正する。

## 2026-08-09 / Codex / ARTICLE新規IDエラー表示の改善（未公開）

### 実施
- 新規記事保存時の `ID and Title required` を、ID未入力/Title未入力/両方未入力に分解して表示。
- ARTICLEのIDにも小文字英数字・ハイフン形式の入口検査を適用。
- `loa-lost-paradise-2026-info` は形式上有効であり、保存不具合の特定待ち。

### コミット
- 未コミット。フォント追加テストと合わせて確認後に判断する。

### 検証
- `node --check LP/cms.js`: 次に実行。
- 実ブラウザでの新規記事保存: 未実施。

### 変更したパターン
- `submitToSheet('article')` の必須項目エラー表示。
- `validateBeforeSave()` のARTICLE ID形式検査。

### 未確認の類似パターン
- GAS側での `add_article` 応答（重複/認証/シート書込）: 未確認。
- ID入力後にタイトル入力・保存する実操作: 未確認。

### 次の担当への注意・判断待ち
- 次回同じIDで保存し、表示された不足項目またはGAS応答を記録する。

## 2026-08-09 / Claude / CMSレイアウト重なり修正・CI片側更新の修正

### 実施
- CMS記事フォームで STATUS / AUTHOR / PUBLISH AT が画像レイアウトツールバーに
  覆われて押せない状態を修正。`.ar-editor-wrap` を flex 化して中身を包み、
  `#ar-body-editor{min-height:540px}` で本文の広さ（537px）を維持。
  `flex:1 0 auto` で伸ばす案は重なりが再発したため不採用。
  集中モードは別の高さ規則を持つため `:not(.focus-mode)` で除外。
- `scripts/check_cms_layout.mjs` を新規追加。headless Chrome で cms.html を
  描画し、ツールバーと各入力欄の矩形が交差しないことを実測する。
  regression-check.yml / publish-pipeline.yml の2本に組み込み済み。
- `generate-meta.yml` のコミット対象を `git add -A LP/` に変更。
  従来の列挙では `LP/festivals` がフォルダのため `LP/festivals.html` に当たらず、
  EN は `LP/en` でフォルダごと入るため **EN のハブだけが更新されていた。**
- `check_regressions.py` に `hub_static_link_ja_en_gaps` を追加。
  JA と EN のハブで静的リンクの件数を比べ、ずれたら落とす。
- 取り残されていた生成物（JA ハブ4枚・image-dimensions）を更新。

### コミット
- `b18f9d63` fix(cms): STATUS/AUTHOR が本文エディタに覆われて押せない問題を修正
- `ece6199e` fix(ci): EN のハブだけ更新され JA が取り残される構造を直す

### 検証
- `check_cms_layout.mjs`: 重なり3組すべて false / 本文 539px / 集中モード・
  ソース表示・プレビューの3モードでツールバーが枠内。
  ネガティブコントロール（元の CSS に戻す）で落ちることを確認済み。
- `check_regressions.py`: `hub_static_link_ja_en_gaps` = 0 で通過。
  取り残されていた実際の `LP/news.html` に戻すと `1 > max 0` で落ちることを確認済み。
- CMSガード一式（editions / authors / auth_retry / lineup / geocode / ai_body /
  gas_ai）すべて通過。`check_asset_versions.py` / `check_sw_routing.mjs` /
  `check_internal_links.py` / `check_no_hardcoded_versions.py` 通過。
- 記事↔フェスの相互リンク: `data.js` に festivalId を仮挿入してビルドし、
  記事ページ→フェス・フェスページ→記事の双方が JA/EN とも出ることを確認。
  仮データは削除済み（生成物も戻して再ビルド済み）。

### 変更したパターン
- `.ar-editor-wrap` が中身の高さを合算していないため、次の要素と重なるパターン。
- CI のコミット対象がフォルダ名の列挙で、同名の `.html` を取りこぼすパターン
  （`LP/festivals` は `LP/festivals.html` に当たらない）。

### 未確認の類似パターン
- CMS の他フォーム（FESTIVAL / ARTIST / VENUE）での要素の重なり:
  **未確認。** `check_cms_layout.mjs` は記事フォームだけを見ている。
- 他ワークフローのコミット対象: 確認済み・0件。
  `deploy-pages.yml` / `publish-pipeline.yml` は元から `git add -A LP/`。
  `sync-drive-images.yml` は画像用で `git add -u LP/` を併用しており取りこぼしなし。
- `LP/venues.html` の静的リンク: 確認済み・0件（JA=22 / EN=22 で一致）。

### 次の担当への注意・判断待ち
- **ARTICLES の festivalId が data.js に入っていない。** シート側には値が
  反映済みとの報告だが、`237a1fd6` の Publish 時点では入っておらず、
  現在の `LP/data.js` でも 0 件。生成側の実装は JA/EN とも動作確認済みなので、
  **CMS で記事を開いて関連フェスを選び直し、保存 → Publish Now** で点灯する。
- `check_cms_layout.mjs` は headless Chrome を使うため、CI では
  「Verify Chrome is available」ステップより後に置いてある。順序を変えないこと。

## 2026-08-09 / Claude / 順番待ちのまま固まった CI を自動で外す

### 実施
- `.github/workflows/unstick-queue.yml` を追加。15分ごとに走り、
  順番待ちのまま25分以上たった run を外す。それで `concurrency: pages` が
  空になった場合だけ、デプロイを1回だけ蹴り直す。最悪40分で自動復旧する。
- 判断は `scripts/unstick_ci_queue.mjs` の `decide()` に純粋な関数として分離。
  `in_progress`（動作中）と `waiting`（環境の承認待ち）は絶対に触らない。
- 蹴り直したデプロイがまた詰まった場合は、同じ SHA への `workflow_dispatch` を
  検出して蹴らず、ジョブを失敗させて通知する（無限ループ防止）。
- 見張り番自身は `concurrency: pages` に入れていない
  （入れると外したい相手の後ろに並んで一緒に固まる）。
- `scripts/check_unstick_queue.mjs` で判断を13件試験。CI 2本に組み込み済み。
- 平常時の実行で、キャンセルの権限があるかを毎回確認する。
  完了済みの run へのキャンセルは 409、権限が無ければ 403 になる違いを使い、
  **run を1つも壊さずに**判別する。

### コミット
- `0577a43e` fix(ci): 順番待ちのまま固まった CI を自動で外す見張り番を追加
- `chore(ci): 詰まり外しに閾値の手動指定を追加（実地検証と手動復旧用）`
- `chore(ci): 詰まり外しの権限を、何も壊さずに毎回確認する`

### 検証
- `check_unstick_queue.mjs`: 13件すべて通過。実際に起きた事故
  （65分の Publish ＋ 36分の Deploy）を再現した事例を含む。
- ネガティブコントロール: `waiting` を対象に含めると落ちる／
  無限ループ防止を外すと落ちる、の2つを確認済み。
- 実地: `gh workflow run unstick-queue.yml -f dry_run=true` を本番で2回実行し、
  success。ログに「25分以上固まっている run はありません」
  「キャンセルの権限あり（409 = 正常）」を確認。
  **CI 上のトークンで実際に外せることまで確認済み。**
- 詰まりの解消そのものは実地で確認済み（詰まった run を1本外したところ、
  後ろで36分 pending だったデプロイが success になり、cms.css v=26 と
  JA ハブの更新が本番へ出た）。

### 変更したパターン
- 順番待ちのまま固まる事故に `timeout-minutes` が効かないパターン
  （動き出してからの時計のため）。
- 失敗ではないので通知が出ず、人が気づくまで放置されるパターン。

### 未確認の類似パターン
- **見張り番が実際に run をキャンセルする経路は、実地では未発火。**
  権限があることは確認済みだが、詰まりが起きていないため
  「本当に外れるところ」までは踏んでいない。判断部分は試験済み。
- `concurrency` を持つ他ワークフロー（generate-meta / lighthouse /
  sync-drive-images）での同種の詰まり: 未発生。見張り番は
  ワークフローを問わず順番待ちを見るので、起きれば同じように外れる。
- 環境の承認ルール（required reviewers）を追加した場合: 未検証。
  `waiting` は除外しているので殺さない設計だが、実際に設定した例は無い。

### 次の担当への注意・判断待ち
- **ARTICLES の festivalId は本番の data.js にまだ 0 件。**
  CMS の Publish Now がコミットまで届いていない（リポジトリに新しい
  `cms: publish data.js` が増えていない）。原因特定には CMS が出した
  メッセージ（差分確認の内容 / `Publish error:` の文言 / `Building...` と
  `Pushing to GitHub...` のどちらで止まったか）が要る。
- 手動で詰まりを外したいときは
  `gh workflow run unstick-queue.yml -f stuck_minutes=5` のように
  閾値を短くして実行できる。`-f dry_run=true` で対象だけ確認できる。

## 2026-08-09 / Claude / Publish 失敗の原因特定と、押す前に止める関門

### 実施
- Publish Now の失敗原因を特定: **EDITIONS の `synapse-festival-2026` が
  92行目と107行目で重複。**§9-58 の掃除の消し漏れで、8/8 17:02 以降
  丸1日、同じ理由で失敗し続けていた。**データ側の問題でコード変更では直らない。**
- `publishNow` が EDITIONS を取得するようにし、`publishSanityCheck` に
  EDITION_ID の重複検査を追加。押す前に行番号まで出して止める。
- `scripts/check_cms_publish_guard.mjs`（9件）を追加し、CI 2本に組み込み。

### コミット
- `1218a7e2` fix(cms): 必ず失敗する状態で Publish を押せてしまう問題を直す

### 検証
- `check_cms_publish_guard.mjs`: 9件すべて通過。実際に起きた重複
  （92行目と107行目）を再現した事例を含む。
- ネガティブコントロール: 重複判定を `>1` → `>2` に変えると落ちることを確認。
- `node --check LP/cms.js` / `check_asset_versions.py`（cms.js ?v=73）通過。
- **実ブラウザでの Publish Now は未実施**（重複を消すまで必ず失敗するため、
  データ修正後にユーザー環境で確認が必要）。

### 変更したパターン
- 必ず失敗すると分かっている状態で、CMS が Publish を押せてしまうパターン。
- 「重複がある」とだけ伝えて、どの行かを出さないパターン
  （消す対象を人が探すことになり、§9-58 の消し漏れの一因）。

### 未確認の類似パターン
- 他シートの ID 重複（FESTIVALS / ARTISTS / VENUES / ARTICLES）:
  **未確認。**`fetch-data.mjs` は検証しているが、CMS 側の事前検査は
  今回 EDITIONS のみ追加した。同じ事故が起きうる。
- `publishSanityCheck` が見ていない `fetch-data.mjs` のエラー種別:
  **未確認。**今回のように「CI でしか分からないエラー」が他にもある可能性。
  `validation-report.txt` のエラー一覧と突き合わせるのが次の一手。

### 次の担当への注意・判断待ち
- **ユーザー作業が必要: EDITIONS の92行目を削除する。**
  92行目は LOCATION・ADDRESS・LAT すべて空で、`STATUS=published` は
  開催回には存在しない値（`announced`/`on-sale`/`soldout`/`finished`/`cancelled`）。
  107行目が会場・住所・座標を持つ正しい行。削除後に Publish Now で通る。
- 削除しても festivalId が data.js に入らない場合は、記事側の保存を先に確認する。

## 2026-08-09 / Claude / 取得経路の違いで列が落ちていた件

### 実施
- 記事の関連フェスが編集画面には出るのに公開に乗らず、Publish が
  **空コミット**（変更0件）を作っていた原因を特定。
  取得経路が2つあり、返す列が違っていた。
    編集・一覧  `get_sheet`（1枚ずつ）    → 新しい列が出る
    Publish     `get_all_sheets`（一括）  → 新しい列が落ちる
  落ちていたのは `festivalId` / `cardRatio` / `heroRatio` / `views` の4列で、
  すべて 2026-08-09 に追加した列。`title_en` 等は両方に出ていた。
- `fetchAllSheets` に `perSheet` option を追加し、Publish と Export を
  `{fresh:true,perSheet:true}` に変更。一括経路は一覧の初回読み込みで
  使うため残した。
- `scripts/check_cms_fetch_path.mjs`（6件）を追加し、CI 2本に組み込み。

### コミット
- `e32629b8` fix(cms): Publish が列を落とす経路でデータを取っていた問題を直す

### 検証
- `check_cms_fetch_path.mjs`: 6件通過。一括経路が列を落とす状況を再現し、
  perSheet では一括を呼ばないこと・新しい列が残ること・perSheet 無しでは
  従来どおり一括で取ること（既存動作を壊さない）を確認。
- ネガティブコントロール: `perSheet:true` を外すと落ちることを確認。
- CMS ガード一式（fetch_path / publish_guard / editions / authors / lineup /
  ai_body）すべて通過。`node --check LP/cms.js` 通過。
- 本番反映を実測: `cms.js?v=74` を確認（23:37）。
- **実ブラウザでの Publish Now は未実施。**修正が効いたかは、次に
  ユーザーが Publish Now を押した結果（data.js に festivalId が入るか）で決まる。

### 変更したパターン
- 同じデータを2つの経路で取得し、片方だけが新しい列を返さないパターン。
- 値が無いときに項目を省く書き出しのため、「無い」と「取れなかった」を
  区別できず、失敗が成功に見えるパターン。

### 未確認の類似パターン
- **GAS の `get_all_sheets` がなぜ新しい列を落とすのかは未確認。**
  ヘッダー行のキャッシュが疑わしいが、GAS のソースを見ていない。
  一括経路を使う残りの箇所（一覧の初回読み込み、cms.js:4589）は
  同じ問題を抱えたままである。新しい列に依存しないため実害は出ていない。
- ARTICLES 以外のシートで同種の列落ちが起きているか: 未確認。
  今回は ARTICLES にしか新しい列を足していないため顕在化していない。
- ARTICLES シートの列名が `festivalId`（キャメル）と `VIEWS`（大文字）で
  混在しており、CMS は名前をそのまま照合する。`VIEWS` は CMS が `views` を
  探すため取りこぼす。Views は廃止方針のため今回は手を付けていない。

### 次の担当への注意・判断待ち
- **ユーザー作業: CMS を再読み込み（`cms.js?v=74` を読ませる）してから
  Publish Now。**これで data.js に festivalId が入るはず。
  入れば記事ページ・フェスページの双方に相互リンクが出る
  （生成側は仮データで動作確認済み）。
- 入らなかった場合は、GAS の `get_sheet` 側も新しい列を返していないことになる。
  その場合は GAS のソース（`get_sheet` / `get_all_sheets`）の確認が必要。

## 2026-08-10 / Claude / 列名の綴り違いを検出する

### 実施
- 「シートには入っているのに CMS に反映されない」という報告に対し、
  CMS がシートの列名を**完全一致**で読むため、1文字違うと
  エラーも警告も出さずに無視する構造を確認。
- `publishSanityCheck` に列名の突き合わせを追加。
  大小文字・記号・空白を取り除いた形が既知の項目と一致する列だけを
  「惜しい」列として指摘し、正しい綴りを示す。
- 未知の列を全部警告しない（メモ用の列などで毎回鳴ると無視されるため）。
- `scripts/check_cms_publish_guard.mjs` に6件追加（計15件）。

### コミット
- `279588e4` fix(cms): 列名の綴り違いで値が黙って捨てられる状態を検出する

### 検証
- `check_cms_publish_guard.mjs`: 15件通過。指摘する側（FestivalId /
  FESTIVAL_ID / VIEWS）と鳴らない側（正しい綴り / 無関係な列 / 列が無い）を
  両方試験。
- ネガティブコントロール: 正規化を外して完全一致で照合すると落ちることを確認。
- `check_cms_fetch_path.mjs` / `check_asset_versions.py` / `node --check` 通過。
- 本番反映を実測: `cms.js?v=75`（00:05）。

### 変更したパターン
- シートの列名と CMS の項目名が食い違い、値が黙って捨てられるパターン。
  読めないことがどこにも表示されず、原因を推測する手掛かりが無かった。

### 未確認の類似パターン
- **ARTICLES 以外のシート（FESTIVALS / ARTISTS / VENUES / EDITIONS）の
  列名突き合わせ: 未実装。**同じ事故が起きうる。今回は報告のあった
  ARTICLES に限定した。
- `VIEWS`（シート）と `views`（CMS）の不一致は**未修正のまま**。
  Views は廃止方針のため実害は無いが、新しい検査では指摘される。
- **今回の festivalId が実際にどの綴りだったかは未確認。**
  次の Publish で警告が出れば列名の問題、出なければ別の原因。

### 次の担当への注意・判断待ち
- **ユーザー作業: CMS を強制リロードして `cms.js?v=75` にしてから Publish Now。**
  - 「列名が違うため、CMS が読めていない列があります」と出たら → 列名の問題。
    ARTICLES シートの1行目を、示された綴りに直す。
  - 何も出ずに、それでも festivalId が data.js に入らないなら → 列名ではない。
    その場合は GAS の `get_sheet` のソース確認が必要（§9-67 の未確認事項）。

## 2026-08-10 / Claude / 列名の大文字小文字を読む側で吸収する（§9-68 の訂正を含む）

### 実施
- §9-68 の警告が実際に鳴り、`readtime` / `metadescription` / `festivalid` の
  **3つとも全部小文字**だった。シートの誤りではなく、GAS の返し方の違い。
    `get_all_sheets`（まとめて）… 見出しの綴りのまま（readTime）
    `get_sheet`（1枚ずつ）      … すべて小文字（readtime）
- **§9-67 の「公開だけ1枚ずつにする」は対症療法として誤りだった。**
  まとめて取れば festivalId が読めず、1枚ずつ取れば readTime が読めない。
  片方を直すと片方が壊れる構造だった。
- **§9-68 の警告文は「シートの見出しを直してください」と誤った指示を出していた。**
  シートは正しく、直せば逆に壊れる。ユーザーには訂正済み。
- `canonicalizeRows()` を追加し、取り込み時に正しい綴りの別名を足す。
  取り込み口5箇所（一覧2 / fetchAllSheets 3）に適用。以降のコードは変更不要。
- 警告側も、名寄せで読めているなら黙るよう修正。

### コミット
- `b0bc1615` fix(cms): 取得経路で列名の大文字小文字が変わる問題を、読む側で吸収する

### 検証
- `check_cms_fetch_path.mjs`（10件）: **両経路を実測どおりに再現**
  （まとめて＝そのまま / 1枚ずつ＝小文字）。どちらでも festivalId と
  readTime が読め、data.js まで出ることを確認。
- `check_cms_publish_guard.mjs`（17件）: 名寄せ済みなら黙り、
  名寄せできない列だけ指摘することを確認。
- ネガティブコントロール2種: 名寄せを外すと落ちる／
  「空で上書きしない」ガードを外すと `{readTime:5, readtime:''}` で
  値が '' に壊れることを実測。
- CMS ガード9本すべて通過。`check_asset_versions.py` 通過。
- 本番反映を実測: `cms.js?v=76`（00:19）。

### 変更したパターン
- 同じデータを2つの経路で取得し、**キーの大文字小文字が経路で変わる**パターン。
  完全一致で読むコードでは、経路を変えるだけで値が黙って消える。
- 症状の出ている経路だけを切り替える対症療法（§9-67）が、
  別の項目を壊すパターン。

### 未確認の類似パターン
- **GAS 側でなぜ経路によって綴りが変わるのかは未確認。**
  CMS 側で吸収したので実害は消えるが、根本は GAS にある。
- `SHEET_FIELD_NAMES` に載せていない camelCase 列は名寄せされない。
  現在は ARTICLES / FESTIVALS / VENUES / ARTISTS / EDITIONS / LINEUPS の
  既知項目のみ。**新しく camelCase の列を足すときは、ここにも足すこと。**
- FESTIVALS / VENUES / ARTISTS 側で実際に取りこぼしが起きていたかは未確認
  （`location_ja` `ticketUrl` `desc_en` などは名寄せ対象に入れた）。

### 次の担当への注意・判断待ち
- **ユーザー作業: CMS を強制リロードして `cms.js?v=76` にしてから Publish Now。**
  警告は出なくなるはず。出たら、それは本当に名寄せできない列名。
- **シートの見出しは直さないこと。**§9-68 の警告に従って直すと逆に壊れる。

## 2026-08-10 / Claude / AI が動かない原因の特定（Claude API 401）

### 実施
- 「AI タイトル生成・本文翻訳が動かない」の原因を追ったが、CMS 側の結線・
  認証トークンの付与・GAS の応答・GAS の実装（12件）・モデル名のいずれも正常。
  残るのは実行時の message だけだったが、**3秒で消えるトーストにしか
  出ていなかった**ため前に進めなかった。
- `aiFail()` を追加し、AI の失敗を消えない・コピーできるパネルで表示。
  toast のままだった AI 系エラー10箇所を統一（§9-70）。
- その結果 **`Claude API 401`**（キーは設定済みだが Anthropic が拒否）と判明。
- GAS 側で潰せる原因を対処（§9-71）:
  キーの前後の空白・改行を除去 / `sk-ant-` で始まらないキーは API を叩く前に
  弾く / 401 の文言に確認手順（再デプロイの必要を含む）を追加。

### コミット
- `1e30898c` fix(cms): AI が動かない理由を、消えない形で出す
- `4c0f6edd` fix(gas): APIキーの空白混入と形式違いを潰し、401 に確認手順を添える

### 検証
- `check_cms_ai_body.mjs`: 9件通過（理由の本文がそのまま出る／キー未設定・400・
  未知のエラーで出し分かる）。ネガティブコントロール（本文を潰すと落ちる）確認。
- `check_gas_ai.mjs`: 18件通過（空白付きキーで通る／形式違いは API を呼ばずに
  弾く／401 が元の文言＋再デプロイの案内を持つ／空白だけのキーは未設定扱い）。
  ネガティブコントロール（空白除去を外すと落ちる）確認。
- CMS ガード9本すべて通過。本番反映を実測: `cms.js?v=77`（00:37）。
- **AI 機能そのものは未動作のまま。**キーが有効にならない限り確認できない。

### 変更したパターン
- 失敗の理由が数秒で消え、利用者は「動かない」としか報告できず、
  こちらは「コードは正常」としか返せない膠着パターン。
- 資格情報の貼り付けで前後に空白が混ざり、見た目では気づけないまま
  401 になるパターン。

### 未確認の類似パターン
- **GAS の再デプロイ後に 401 が消えるかは未確認**（ユーザー作業待ち）。
- AI 以外の GAS 機能（画像同期・place 解決）のエラー表示は
  トーストのまま。同じ膠着が起きうるが、今回は AI に限定した。
- `scripts/gas-update/ai-claude-opus5.gs` の変更は**リポジトリ上のみ**。
  GAS 側へ貼り直して再デプロイしない限り反映されない。

### 次の担当への注意・判断待ち
- **ユーザー作業:**
  1. console.anthropic.com でキーが有効か／クレジットが残っているか確認
  2. GAS のスクリプト プロパティ `ANTHROPIC_API_KEY` を入れ直す
  3. `scripts/gas-update/ai-claude-opus5.gs` を GAS に貼り直す（今回の変更分）
  4. **GAS を再デプロイ**（保存だけでは反映されない）
- キーは資格情報のため、こちらでは設定も確認もしない。

## 2026-08-10 / Claude / AI 機能の復旧（翻訳・タイトル生成とも稼働）

### 実施
- ブラウザ操作で GAS を直接調査し、3つの別々の原因を順に解消した。
  1. **`aiTranslateV2_` が二重定義**され、後勝ちで**古い版（Sonnet 5・
     UrlFetchApp 直叩き）が動いていた**（§9-72）。1541〜1574行を削除。
     8/7 に「Opus 5 に統一」と記録していたが、翻訳では効いていなかった。
  2. **APIキーが無効**（401）。ユーザーが入れ直して解消。
  3. **`content[0]` だけを見て本文を取り出していた**ため、先頭が thinking
     ブロックだと「応答が空」と誤判定していた（§9-73）。
     `type === 'text'` を全部つなぐよう修正。
- 予防として `MAX_TOKENS_SUMMARY` を 1000 → 4000（保存済み・**未デプロイ**）。
- CMS 側は §9-70 で AI エラーを消えないパネル表示に変更済み。
  **これが無ければ原因に辿り着けなかった。**

### コミット
- `c249118c` docs: GAS で翻訳が二重定義され古い版が動いていた件（§9-72）
- `ff9eb2d0` fix(gas): 応答の content[0] だけを見て「空」と誤判定していた問題
- `ccf62c3a` fix(gas): 要約側の出力上限を 1000 → 4000
- `docs: AI タイトル生成を直したのは content 取り出しの修正だと訂正`

### 検証
- **ユーザー実機で確認済み: 本文まるごと英訳・AIタイトル候補とも動作。**
  デプロイ バージョン58（2026/08/10 1:16）で稼働。
- `check_gas_ai.mjs` 30件通過。ネガティブコントロール3種を確認
  （空白除去を外す／全ての400でクレジット案内／content[0]だけ見る）。
- GAS への適用は Monaco 経由。**適用前に `new Function()` で構文検証し、
  関数の総数が変わらないことを確認**してから反映した。

### 変更したパターン
- 同名関数が二重に定義され、構文エラーにならないまま後勝ちするパターン。
  リポジトリの検査はファイルを見るが、**GAS の実物は見ていない。**
- API 応答を `content[0]` 決め打ちで取り出すパターン。
- 症状の差を説明できる仮説を1つ見つけて、確かめる前に原因と断定するパターン
  （MAX_TOKENS を「真犯人」と誤記し、後で訂正した）。

### 未確認の類似パターン
- **`MAX_TOKENS_SUMMARY = 4000` は未デプロイ。**次のデプロイで入る。
- `Migration.gs` / `Auth.gs` / `triggerImageSync.gs` に同名関数の重複が
  無いかは**未確認。**`コード.gs` しか調べていない。
- **リポジトリの `.gs` と GAS の実物が一致しているかを検査する仕組みは無い。**
  手で貼る運用である限り、同じ食い違いが再発しうる。

### 次の担当への注意・判断待ち
- GAS を編集するときは、行番号を目視で数えて選択しない。
  Monaco 経由で構造から範囲を求め、適用前に構文検証すること（§9-73 に手順）。
- リポジトリと GAS 実物の突合は未解決の宿題。

## 2026-08-10 / Claude / GAS 実物との突き合わせ（宿題の消化）

### 実施
- **他ファイルの二重定義を実測**: 5ファイル・73関数を走査し、**重複は0件**。
  §9-72 の `aiTranslateV2_` が唯一だった。
- **リポジトリと GAS 実物のずれを検出する仕組みを新設**（§9-74）。
    `scripts/gas-update/snapshot.js`        GAS 側で実行し指紋を出す
    `scripts/gas-update/live-snapshot.json` その指紋
    `scripts/check_gas_sync.mjs`            突き合わせ（CI 2本に組み込み）
  **コードそのものはリポジトリへ持ってこない。**GAS 側にキーが混ざったとき
  一緒に取り込むため。指紋なら中身を持ち出さずに一致だけ確かめられる。
- **作った検査がさっそく食い違いを検出。**GAS の `callClaude_` にキーの
  空白除去・`sk-ant-` 形式確認・401/400 の言い分けが入っていなかった
  （正規化長 1608 / リポジトリ 2452）。リポジトリ版で置き換え済み。
- ユーザーが**バージョン59（2026/08/10 6:17）としてデプロイ済み**。

### コミット
- `07b04794` feat(ci): リポジトリの .gs と GAS の実物のずれを検出する
- （本コミット）スナップショットをバージョン59 で更新

### 検証
- `check_gas_sync.mjs`: 3関数・3定数すべて指紋一致。
  ネガティブコントロール3種を確認（貼り忘れ→落ちる／コメントのみ→鳴らない／
  定数変更→落ちる）。
- `check_gas_ai.mjs`: 30件通過。
- デプロイ画面で **CMS が使うデプロイID（AKfycbxhJ6rt…）の
  バージョンが59 に更新されている**ことを実測。URL は不変。
- **AI 機能はユーザー実機で動作確認済み**（翻訳・タイトル候補とも）。

### 変更したパターン
- リポジトリと手貼り運用の GAS がずれても検出できないパターン。
- 存在確認をファイル全体の文字列検索で行い、別の関数の同じ記述を拾って
  誤って「入っている」と報告するパターン（今回実際に踏んだ）。

### 未確認の類似パターン
- **`Migration.gs` / `Auth.gs` / `triggerImageSync.gs` の中身は
  スナップショットの対象外。**重複が無いことは確認したが、指紋は
  AI 関連3関数と3定数のみ。他を守りたければ対象を増やす。
- スナップショットの更新は**手動**。貼ってデプロイした後に
  `snapshot.js` を実行して更新する運用。忘れると CI が落ちて気づける
  （落ちる側に倒してあるので、黙って古くなることは無い）。

### 次の担当への注意・判断待ち
- GAS を編集したら、必ず `snapshot.js` を実行して `live-snapshot.json` を
  更新すること。手順は snapshot.js の先頭に記載。
- GAS の編集は行番号を目視で数えず、Monaco 経由で構造から範囲を求め、
  適用前に `new Function()` で構文検証すること（§9-73 / §9-74）。

## 2026-08-12 / Claude / 地図の全国対応と、公開前テストの義務化

### 実施
- **クラブ地図（map.html）を全国対応**（§9-76）。`v.city === 'TOKYO'` を外し、
  `minZoom` 11→5、初期表示を会場に合わせて寄せる、東京の地名ラベルは
  寄せたときだけ出す、表題を「CLUB MAP」に変更。
- **画像同期の一時的な失敗を再試行するようにした**（§9-75）。
  08-12 07:55 の失敗は GAS の一時的な 404 で、実体は無事だった。
- **「本番へ出す前に必ずテストする」を絶対ルールとして運用に反映**（§9-77）。
  `scripts/preflight.sh` で25本を1コマンドに集約し、AGENTS.md の**冒頭**に明記。
  memory にも `preflight-before-deploy` として保存。
- `bonobo` の URL と `global-ark` の座標は**ユーザーが修正済み**（実測で確認）。

### コミット
- `5522d90d` fix(ci): 一時的な通信失敗で画像同期が落ちないようにする
- `9b73128e` feat(map): クラブ地図を全国対応にする
- （本コミット）公開前テストの義務化

### 検証
- **`bash scripts/preflight.sh` 全25件成功**（本コミットの push 前に実施）。
- `check_map_nationwide.mjs`: PC 幅・モバイル幅の各5回で、全都市のピン・
  ズーム・ラベルの出し分けがぶれないことを確認。
- ネガティブコントロール: 東京限定に戻す／`minZoom` を戻す／`const` を
  後ろへ移す、の3種で落ちることを確認。
  **1回目の壊し方が本物と違って検査をすり抜けたため、作り直した。**
- 実ブラウザ（Chrome）で map.html を確認: 東京・大阪・京都のピンが表示され、
  大阪のピンをクリックして情報カード（CIRCUS OSAKA / 公式サイトへのリンク）が
  開くことを実測。
- データ: `bonobo` URL = https://www.bonobo.jp/ ／
  `global-ark` LAT = 36.6976（数値として読める）を実測で確認。

### 変更したパターン
- 一覧は都市を自動生成して追随するのに、地図だけ絞り込みがべた書きで
  取り残されるパターン。
- 高さ 0 の要素に対する `fitBounds` が黙って無視されるパターン。
- `const` の宣言順で、コールバック内が ReferenceError で静かに死ぬパターン。
- 検査はあるのに、まとめて回す手段が無く実行されないパターン。

### 未確認の類似パターン
- **`venues.html` は5都市（TOKYO/OSAKA/NAGOYA/KYOTO/HAKUBA）の地図を
  べた書きしている**（約280行の重複）。**福岡・札幌を足しても地図に出ない。**
  `map.html` と同じ問題が残っている。データ駆動へ寄せる価値はあるが、
  UI 変更が大きいため今回は手を付けていない。
- **CMS の実操作（入力→保存→再表示）は未実施。**認証が要るため自動化していない。
- `preflight.sh` は CI と同じ検査を回すが、**`--fast` の存在自体が抜け道**に
  なりうる。警告は出しているが、強制はしていない。

### 次の担当への注意・判断待ち
- **push の前に必ず `bash scripts/preflight.sh` を全件通すこと。**
  main への push はそのまま本番公開になる。AGENTS.md 冒頭に明記した。
- 会場を福岡・札幌へ広げるなら、`venues.html` の地図のべた書きを先に
  片付けるか、少なくとも「地図には出ない」と分かった上で進めること。

## 2026-08-12 / Claude / 会場一覧の地図を都市に依存しない作りにした

### 実施
- `venues.html` の5都市べた書き（約280行）を撤去し、`VENUES` にある都市の
  分だけ生成する形にした（§9-78）。**268行 → 147行。**
  - HTML の入れ物5つ → `#city-maps` 1つ（`buildCityMapSections`）
  - CSS の id 列挙 → `.city-map-wrap` / `.city-map-filters` / `.city-map`
  - JS の5複製 → `createCityMap(city)` 1つ
  - `ALL_MAPS_CFG` の手書き配列 → `citiesWithMaps()` から生成
  - 中心座標も持たず、その都市の会場から `fitBounds` で求める
- `scripts/check_venue_maps.mjs` を追加（CI 2本 + preflight）。
- `check_hub_pages.py` のフォールバック検査が東京の id を直接指していたため、
  クラスで取る形に修正。

### コミット
- `95256e80` refactor(venues): 会場一覧の地図を都市に依存しない作りにする

### 検証
- **改修前に、福岡の会場を1件だけ仮に入れて壊れていることを実測**
  （MAP を押しても地図が出ず、ピン0・絞り込み0）。改修後は同じデータで全通過。
- 仮データ撤去後、既存3都市（TOKYO 15 / OSAKA 6 / KYOTO 1）も全通過。
- JA/EN の行数一致（944行）。都市名のべた書きは JA/EN とも0件。
- 実ブラウザ（Chrome）で OSAKA → KYOTO と切り替え、地図が1つだけ開くこと、
  中心が会場に合っていることを確認。
- **`bash scripts/preflight.sh` 全26件成功**（push 前に実施）。
- ネガティブコントロール3種（都市の抽出を東京限定に戻す／入れ物の生成を
  止める／絞り込みの生成を消す）で落ちることを確認。

### 変更したパターン
- 都市ごとにコードを複製し、対応表に無い都市が黙って無視されるパターン。
- 検査が特定の都市の id に依存し、都市を増やすと検査のほうが壊れるパターン。
- **ネガティブコントロールの置換が一致せず、壊したつもりで壊れていない
  パターン**（2回踏んだ）。置換後に件数を数えて確認すること。

### 未確認の類似パターン
- **記事本文の貼り付けで画面が飛ぶ件は未検証のまま。**対策は入れているが、
  実機での確認をしていない（§9-62 前後の対応）。
- `VIEWS`（シート）と `views`（CMS）の不一致は未修正。Views は廃止方針。
- CMS の実操作（入力→保存→再表示）は自動化しておらず、毎回未確認のまま。

### 次の担当への注意・判断待ち
- **会場追加の準備は整っている。**福岡・札幌をシートに足せば、一覧・地図・
  詳細ページ・英語版すべてに自動で出る。コード変更は不要。
  貼る前に `node scripts/check_paste_tsv.mjs <tsv> --sheet VENUES` を通すこと。
- push の前に必ず `bash scripts/preflight.sh`（AGENTS.md 冒頭のルール）。

## 2026-08-12 / Codex / TOPアーティスト1件目の視認性修正

### 実施
- TOPのARTISTSカルーセル左端フェードを見直し、先頭カード（#01）が左側の
  マスクで薄くならないよう変更。右端のフェードは維持。

### コミット
- 未コミット。公開前のテスト段階。

### 検証
- 実ブラウザ（Chrome）で `/index.html` と `/en/index.html` をPC・モバイル相当で確認。
  #01 DJ Nobu がDOMに存在し、`display:block`・`opacity:1`で表示されることを確認。
- NEXTイベントは `NEXT RAVE / LOA-LOST PARADISE-`、一覧の先頭は #02、重複なし。
- `python3 scripts/check_regressions.py` 成功。
- `python3 scripts/check_internal_links.py` 成功。
- `git diff --check` 成功。

### 変更したパターン
- 横スクロールカルーセルの装飾用フェードが先頭カードの視認性を損なうパターン。

### 未確認の類似パターン
- 実機（iOS Safari / Android Chrome）の表示は未確認。

### 次の担当への注意・判断待ち
- 本番公開前に、実機または同等のブラウザ自動操作でTOPの先頭カードを再確認し、
  `bash scripts/preflight.sh` 全件を実行すること。今回は公開していない。

## 2026-08-12 / Codex / UPCOMING EVENTS先頭イベントの出演者表示

### 実施
- TOPのNEXT Festival / Raveカードに、データの`lineup`から出演者名を表示。
- JA / ENとも同じ描画ロジックにし、出演者が未登録のイベントでは空欄を出さない。

### コミット
- 未コミット。公開前のテスト段階。

### 検証
- 実ブラウザ（Chrome）で `/index.html` と `/en/index.html` をPC・モバイル相当で確認。
  `NEXT RAVE / LOA-LOST PARADISE-` と出演者8名＋省略記号を確認。
- 下の一覧は #02から始まり、NEXTとの重複なし。
- `python3 scripts/check_regressions.py`、`python3 scripts/check_internal_links.py`、
  `git diff --check` 成功。

### 変更したパターン
- 一覧側には出演者があるのに、最初のNEXTイベントカードだけ出演者が欠けるパターン。

### 未確認の類似パターン
- 実機（iOS Safari / Android Chrome）の表示は未確認。

### 次の担当への注意・判断待ち
- 本番公開前に実機または同等のブラウザ自動操作と、`bash scripts/preflight.sh` 全件を実施。
  今回は公開していない。

## 2026-08-13 / Codex / イベント検索・TOPプレビューを本番公開

### 実施
- `c7fbf503` を `main` へpushし、イベント検索、Festival / Rave表示、TOPのNEXTイベントと
  出演者表示、記事本文レイアウト、先頭アーティストの視認性修正を公開。

### コミット
- `c7fbf503 feat: improve event discovery and homepage previews`
- GitHub Pages deploy run `31610593651` 成功。

### 検証
- push前 `bash scripts/preflight.sh` 全26件成功。
- GitHub Actions regression check 成功、Pages deploy 成功。
- 公開URL `https://techno-japan.media/` を直接取得し、`NEXT RAVE` と
  `UPCOMING EVENTS` を確認。
- 公開URLをChrome headlessで描画し、`NEXT RAVE`、`LOA-LOST PARADISE-`、
  `GIZMO`、`Global Ark`、`#02`を確認。

### 変更したパターン
- 検索語入力時のFestival / Rave横断検索とカード色分け。
- TOPのNEXTイベント表示と一覧重複防止。
- NEXTイベントの出演者表示。
- 記事本文の可読性、TOPカルーセル先頭カードの視認性。

### 未確認の類似パターン
- CMSの実操作（入力→保存→再表示）は未確認。
- iOS Safari / Android Chromeの実機確認は未確認。

### 次の担当への注意・判断待ち
- 公開済み。公開後の実機確認とCMS操作確認は次のテスト項目。

## 2026-08-13 / Codex / 本番Festival・Rave検索スモークテスト

### 実施
- 公開URLをChromeで直接描画し、JA / ENの`?q=loa`・`?q=global`検索を確認。
- TOP、検索結果、LOA-LOST PARADISE / Global ArkのJA / EN詳細ページを確認。

### コミット
- テスト記録のみ。次回のドキュメントコミットに含める。

### 検証
- 検索結果に`LOA-LOST PARADISE-`、`Global Ark`、Festival / Raveラベルが表示。
- TOP、検索ページ、JA / EN詳細ページ全8URLがHTTP 200。
- LOA / Global Ark詳細ページで出演者データを確認。

### 変更したパターン
- 本番CDN上での検索URL描画とイベント詳細導線。

### 未確認の類似パターン
- iOS Safari / Android Chrome実機でのタップ操作は未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 検索とイベント詳細の本番導線は確認済み。次は実機タップ確認またはCMS操作確認。

## 2026-08-13 / Codex / 本番スクリーンショット目視確認

### 実施
- 本番TOPをPC幅（1440×900）・モバイル幅（390×844）で描画。
- 本番FESTIVALS検索をモバイル幅で描画し、`loa`検索状態を確認。

### コミット
- テスト記録のみ。コミット `b9f05dfc` の後続記録。

### 検証
- TOP PC: ナビゲーション、ヒーロー、STORIES配置を確認。
- TOPモバイル: ヘッダー、ヒーロー、画像の崩れなし。
- FESTIVALSモバイル: 検索欄、Festival / Rave切替、`loa`表示を確認。
- 画面全体を横に押し広げる崩れは目視上なし。

### 変更したパターン
- 本番公開後の主要画面の実画像確認。

### 未確認の類似パターン
- 実機のSafari / Chromeでのタップ・スワイプは未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 次は実機操作確認またはCMS操作確認へ進む。

## 2026-08-13 / Codex / 本番JA・EN切替とRAVE導線確認

### 実施
- 本番FESTIVALSのJA / ENページを取得し、言語切替リンクとRAVE切替要素を確認。
- EN FESTIVALSをモバイル幅でChrome描画し、画面を目視確認。

### コミット
- テスト記録のみ。後続ドキュメントコミットに含める。

### 検証
- JAのENリンクが`/en/festivals.html`を指すことを確認。
- JA / EN FESTIVALSがHTTP 200。
- FESTIVALSページにRAVE切替要素が存在。
- ENモバイルで見出し、検索欄、年・ジャンルフィルターの崩れなし。

### 変更したパターン
- 本番の言語切替とFestival / Raveモード導線。

### 未確認の類似パターン
- 実機での実際のタップ切替は未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 次は実機タップ確認またはCMS操作確認へ進む。

## 2026-08-13 / Claude / 全方位診断（提案のみ・本番変更なし）

### 実施
- 8領域（UI/UX・モバイル・演出・SEO・AIO/GEO・インフラ・CMS・CI/CD）を
  **全項目実測してから**診断し、`reports/diagnosis-2026-08-13.md` に記録。
- 依頼テンプレートの前提2枠（今日の作業・今後の予定）が空欄だったため、
  handoff と git log から実際の文脈（Codex のイベント検索公開等）を使用。

### コミット
- （本コミット）reports/diagnosis-2026-08-13.md

### 検証
- 提案のみで LP/ は未変更のためデプロイは走らない（reports/ は対象外パス）。
- 実測に使った数値はすべて診断書に記載（コントラスト比・タップ領域・
  JSON-LD のキー・robots.txt・Lighthouse 設定・ページ数473）。

### 変更したパターン
- なし（提案のみ）。

### 未確認の類似パターン
- **robots.txt が /map.html を Disallow している。**全国対応済みの地図が
  検索から見えない。意図（CMS と同列に隠したかった？）は未確認のため、
  勝手に外していない。**ユーザーの判断待ち。**
- MusicVenue スキーマに geo が入っているかは未確認（住所は有り）。

### 次の担当への注意・判断待ち
- 診断書の優先順位1〜6 は着手可能。1（robots.txt）だけは意図確認が先。
- SSR/ISR・ヘッドレスCMS・AVIF は「やらない」判断と再検討トリガーを
  診断書に明記した。次に同じ提案が出たらそこを参照。

## 2026-08-13 / Claude / 診断の優先1〜6を実施・本番公開済み

### 実施
- **出演者を構造化データに復旧**（本命）。LINEUPS 621行中501行が
  ARTIST_ID 無しの名前だけ行で、リンク必須の lineupEntity が全部捨てていた。
  名前だけでも MusicGroup として出すよう修正（lineupPerformerLd）。
  出演データのあるフェス31件すべてに点灯（LOA=13名）。
- eventStatus の既定を EventScheduled に（cancelled のみ明示必須のため既定外）。
- robots.txt の `/map.html` 封鎖を解除（ユーザー承認済み・cms.html は維持）。
- llms.txt / events.json をビルド生成（buildAiSurface・タイムスタンプ無し）。
- タップ領域 44px 化（pointer: coarse のみ）+ touch-action: manipulation。
- Lighthouse にカテゴリ別の床（性能0.60/A11y0.85/BP0.90/SEO0.90 =
  実測の床のすこし下。理想値は張らない）。
- エリア名ラベルに aria-hidden。
- 恒久チェック `check_jsonld.mjs` を CI 2本 + preflight に追加（計27検査）。

### コミット
- `aba2958e` feat(seo): 出演者を構造化データに復旧し、AI検索向けの入口を整備

### 検証
- push 前 preflight 全27件成功。deploy success。
- 本番実測: llms.txt HTTP 200 / events.json 17件 / LOA に performer /
  robots.txt の Disallow は cms.html のみ。
- ネガティブコントロール2種（performer 対応を外す＝元のバグ再現／
  robots 封鎖を戻す）で check_jsonld が落ちることを確認。
  **置換後に件数を出力して「本当に壊した」ことを確かめてから判定**（§9-78 の反省）。

### 変更したパターン
- リンク解決できない出演行を黙って捨て、構造化データから出演者が消えるパターン。
- 目に見えないデータ（JSON-LD）の欠落に誰も気づけないパターン。
- 理想値のしきい値が初日から赤くなり、赤が無視されるパターン（床は実測の下に張る）。

### 未確認の類似パターン
- **EDITIONS.STATUS の規約外 `published` 36件・空欄55件はデータ課題のまま**
  （AGENTS.md に従い勝手に直していない）。シートで announced 等へ要修正。
  eventStatus は既定で出るが、soldout/finished の区別はデータ修正後に効く。
- TICKETURL 未入力 84/104件。入れば offers が自動で出る（コード対応済み）。
- 検索エンジンが llms.txt / events.json を実際に取得しているかは
  数週間後にアクセスログ等でしか確認できない。

### 次の担当への注意・判断待ち
- 診断書（reports/diagnosis-2026-08-13.md）の末尾に**診断自体の訂正**が2件ある。
  「コードに無い」と断定する前に生成コードを読むこと。
- events.json / llms.txt は build-detail-pages.mjs の buildAiSurface が生成。
  **タイムスタンプを入れないこと**（毎日の再生成で差分ノイズになる）。
