# 国内フェスの次回開催を「提案 → 承認 → 反映」で更新する（段階1）

2026-11-26 ユーザー決定: **承認は必ず挟む**。段階1から進める。

## 背景

- 国内フェス92件のうち90件は、最新の開催回がすでに終わっている（2026-10-30 の editions.json で集計）。
  来年分は人が気づいたときに CMS で手入力するしかない。
- 海外フェス（Airtable）は「Claude が調べる → Updates Inbox に pending → ユーザー承認 → apply」で更新している。
  Airtable が自動で日程を更新しているわけではない。同じ流れを LP スプレッドシートにも作る。
- 国内フェスの開催回は LP シートの EDITIONS が唯一の正（Airtable には毎朝 sync-site で一方向コピー。
  Airtable 側に国内の開催回を作らない ＝ 2026-08-24 決定・`check_edition_overlap.py`）。

## 段階1の流れ

```
① 候補を選ぶ   scripts/editions/candidates.mjs（data.js から機械的に）
② 調べる       Claude セッションの WebSearch。公式で裏取り。出典と確度を残す
③ 提案を書く   LP シートの新タブ EDITION_PROPOSALS に REVIEW_STATUS=pending で追記
④ 承認         ユーザーがシートで REVIEW_STATUS を approved / rejected に変える
⑤ 反映         Claude が CMS 画面内で apply（下記）。ユーザーが Publish Now
```

「巡回して（国内）」と言われたら ①〜③、「承認したので反映して」と言われたら ⑤。

## なぜ ⑤ で FESTIVALS.DATE も書くのか

ハブ（festivals.html）の日程・Upcoming 判定は data.js の `festival.date` を使う。これは
**FESTIVALS シートの DATE 列**から来る（`cms.js` buildFestivalsJs）。EDITIONS に行を足すだけでは
詳細ページの開催ヒストリーは増えるが、一覧は過去の日程のまま。
CMS の手動保存も `syncFestivalDateToLatestEdition` で DATE と同年の開催回を揃えている。同じ状態を作る。

## EDITION_PROPOSALS タブ（ヘッダー行・この順）

| 列 | 例 | 説明 |
|---|---|---|
| PROPOSAL_ID | `rainbow-disco-club-2027` | = 提案する EDITION_ID。1提案1行 |
| FESTIVAL_ID | `rainbow-disco-club` | FESTIVALS の ID と完全一致 |
| EDITION | `2027` / `2027-2` | |
| DATE_START / DATE_END | `2027-04-23` / `2027-04-25` | ISO。1日開催は同値 |
| VENUE_CHANGED | `no` / `yes` | yes のときだけ下の会場列を使う。no なら前回から引き継ぐ |
| LOCATION / LOCATION_JA / PREF / ADDRESS / LAT / LNG | | VENUE_CHANGED=yes のときのみ |
| SOURCE_URL | 公式ページ | 必須 |
| SOURCE_QUOTE | 日程が書かれた一文 | 必須 |
| CONFIDENCE | `high` / `medium` / `low` | 公式サイト・公式チケット=high、公式SNSのみ=medium、集約サイトのみ=low |
| REVIEW_STATUS | `pending` / `approved` / `rejected` / `applied` / `error` | ユーザーが approved / rejected にする |
| FOUND_AT | `2026-11-26` | |
| NOTES | | 会場変更・名称変更・中止・休止などの注記 |
| APPLIED_AT | | 反映日時（apply が書く） |

- 「来年の日程は未発表」は提案を書かない。調べた事実は `data/edition-crawl/checked.json`（リポジトリ）に
  `{festival_id: {checked_at, result: "no-news"|"proposed"|"ended"|"hiatus", note}}` で残す。本番シートを汚さない。
- 中止・休止・終了の疑いは提案にせず、NOTES 付きで完了報告に書く（勝手に STATUS を変えない）。

## ⑤ apply の手順と守ること

対象: REVIEW_STATUS=approved の行。1件ずつ、すべて CMS 画面内（認証付き fetch）で行う。

1. EDITIONS / FESTIVALS / EDITION_PROPOSALS を get_sheet で読む。
2. 検査（どれかに当たればその提案は REVIEW_STATUS=error、NOTES に理由。書き込まない）
   - FESTIVAL_ID が FESTIVALS に無い
   - EDITION_ID が EDITIONS に**既にある**（上書きしない。CMS の upsert とは逆に止める）
   - DATE_START/END が ISO でない、START > END、または前回より前
   - そのフェスに EDITIONS 行が1行も無い（引き継ぐ会場が無い）
3. EDITIONS に新しい行を `update_row`（row = 最終行+1。CMS の syncNewEditionRows と同じ追記方式）。
   値: EDITION_ID / FESTIVAL_ID / EDITION / DATE_START / DATE_END、会場系は最新の開催回から引き継ぐ
   （VENUE_CHANGED=yes なら提案の値）、TICKETURL・FLYER は空、STATUS=`announced`。
   LINEUPS には触らない。
4. 読み直して、追加した行が送った値と一致し、既存行の数が変わっていないことを確認。
5. FESTIVALS の該当行を**全列読み、DATE だけ** `DATE_START/DATE_END`（1日なら DATE_START）に変えて update_row。
   大文字小文字違いの重複キーは両方送る。送った後に読み直し、変わった列が DATE（と lastEditedAt）だけか照合。
   ずれていたら止めて報告（AGENTS.md「本番データへの書き込み」）。
6. 提案行を全列読み、REVIEW_STATUS=applied・APPLIED_AT を付けて update_row。
7. 全件終わったら、ユーザーに Publish Now を押してもらい、`cms: publish data.js` と Publish pipeline の成功、
   本番の festivals.html とフェス詳細で新しい日程を確認する。

## やらないこと（段階1）

- 承認なしの反映
- LINEUPS・チケット URL・フライヤーの自動更新（日程の流れが安定してから）
- 既存の開催回の書き換え（日程訂正は従来どおり CMS で手で）
- Airtable への国内開催回の作成

## 段階2・3（参考）

- 段階2: CMS に「次回開催の提案」画面。承認ボタンで ⑤ を実行。
  あわせて Publish 時に FESTIVALS.date を「最新の開催回」から導くようにすれば ⑤-5 が不要になる（cms.js の Publish 経路の変更なので実機 Publish 確認が必須）。
- 段階3: 公式サイトの変化検出（週1）＋ Claude API で読み取り → 提案を自動で書く。通知はメール。

## 使い方

候補を出すときは、リポジトリのルートで次を実行する。

```bash
node scripts/editions/candidates.mjs --today 2026-11-26
```

通常は直近30日以内に確認したフェスを省く。もう一度すべて見るときは `--all`、件数を絞るときは `--limit 10` を付ける。日付を指定しない場合は JST の今日を使う。調べた結果は `data/edition-crawl/checked.json` に残し、日程が見つからない場合も `no-news` などの結果を記録する。

提案をシートへ追記・反映する処理は、CMS にログインした状態で Claude in Chrome の `javascript_tool` に貼り付けて使う。リポジトリのファイルをその場で読み込むことはできないため、`scripts/editions/cms-edition-proposals.js` の内容をコピーして CMS のコンソールへ貼り付ける。最初は必ず `execute:false` のドライランで対象、行番号、書き込み内容を確認する。確認後だけ `execute:true` にして実行する。
