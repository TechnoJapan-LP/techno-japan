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
