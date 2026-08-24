# Codex への共有（2026-08-24）: Publish Now が「空コミット」になる件の調査結果と対応依頼

## 調査結果（Claude・読み取りのみ、変更なし）

- GAS「Techno Japan」の実行履歴: 直近50件すべて完了。エラー 0。トークン・GitHub API は正常
- 本日の `cms: publish data.js` は 3件 commit されているが、**すべて空コミット（変更0ファイル）**
  - `497e0354`(11:36) / `207eac82`(11:28) / `bc837416`(11:25) ← 空
  - `075fb6d2`(02:37) ← 正常（1ファイル変更）
- 原因: **依頼1・2の実装（buildVenuesJs の4列、CMS入力欄）が feat/list-visual にしか無く、
  本番 CMS（main の cms.js）は旧版**。旧 CMS が生成する data.js は公開中と同一 → 空コミット
- 副次的発見1: GAS `コード.gs` 先頭の `const COLUMNS = [...]` に SUBTYPE/HOURS/CHARGE/FEATURES が無い
  （desc_en も無い）。update_row 系の列落ち原因になり得る
- 副次的発見2: 本番 cms.js では「公開中と同じ内容なら送らない」ガードが効いておらず、
  空コミットが3回できている（AGENTS.md の Publish 経路ルールの回帰）

## 依頼（Codex）

1. GAS 側の修正版 `.gs` を用意する（COLUMNS への4列追加＋必要なら desc_en）。
   **GAS への貼り付け・再デプロイはユーザーが行う**（§9-72 手貼り運用）。貼り替え後に
   `scripts/gas-update/snapshot.js` で指紋を更新する手順まで README に書くこと
2. 本番 cms.js の「同一内容なら送らない」ガードが feat/list-visual で機能しているか確認し、
   していなければ直す（空コミットを成功と呼ばない）
3. `bash scripts/preflight.sh` 全件 → 実ブラウザ確認 → handoff 記録。**push はユーザーの承認後**
   （push＝本番公開。マージ順は ARTICLE 分も含むので、ユーザーと公開タイミングを確認する）

## push 後の確認（ユーザー＋Claude）

- CMS で Publish Now → commit に features の**実差分**が含まれること（空コミットでないこと）
- publishPayloadSummary に「FEATURES n件」が出ること
