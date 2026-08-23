# Session Handoff

セッション間の短期的な引き継ぎ専用ログです。
長い背景説明・事故の経緯・設計判断は [AUDIT_TECHNO_JAPAN.md](../AUDIT_TECHNO_JAPAN.md) に記録し、ここからリンクしてください。

## 2026-08-20 / Codex / 完了（RELATED FESTIVALS水平スクロール）

### 実施
- FESTIVAL詳細ページの`RELATED FESTIVALS`だけを横一列のスクロールレールへ変更。
- PCでは複数カードを横に並べ、スマホではスワイプできるカード幅に調整。
- スマホの見出し横に`SWIPE →`サインを追加。
- 詳細ページ共通CSSのキャッシュ番号を`v=24`から`v=25`へ更新し、JA/ENの全詳細ページを再生成。

### コミット
- 実装コミット: `d2f2564f`, `49b5aa5d`
- push / rebase 状態: push済み。Deploy成功

### 検証
- `node scripts/build-detail-pages.mjs`: 成功
- `python3 scripts/check_regressions.py`: 成功（回帰なし）
- `python3 scripts/check_asset_versions.py --base HEAD~1`: 成功
- `node scripts/check_sw_routing.mjs`: 成功
- PC/スマホのローカル表示・横スクロール・リンク操作: 確認済み
- 本番Deploy: 成功（run `32345003586`）
- 本番Lighthouse: 成功（run `32345218538`、8 URLすべて合格）
- 本番JA/EN代表ページ: HTTP 200、`detail.css?v=25`の反映を確認

### 変更したパターン
- FESTIVAL詳細のRELATED FESTIVALS横スクロール: 1パターン
- モバイルのSWIPE案内: 1パターン
- JA/EN詳細ページのCSSキャッシュ更新: 457ページ

### 未確認の類似パターン
- 本番反映後のRELATED FESTIVALS表示: HTML/CSS配信確認済み。実ブラウザでの本番スワイプ操作は未確認
- RELATED STORIESの横スクロール: 今回は対象外

### 次の担当への注意・判断待ち
- 本番DeployとLighthouseは完了。次回、実ブラウザで本番のPC/モバイル横スクロール操作を確認する。

## 2026-08-20 / Codex / 完了（STORIES見出しのキネティックタイポグラフィ）

### 実施
- NEWS/STORIES上部の導入見出しだけにスクロール連動の小さな横移動を追加。
- 記事カード、右記事と左画像の同期、カテゴリ検索、一覧の高さには影響させない構成。
- モバイル（900px以下）と`prefers-reduced-motion`では静止表示。
- JA NEWSを元にEN NEWSを再生成。

### コミット
- 実装コミット: `d8c7026c`（rebase後のローカル履歴）
- push / rebase 状態: push済み。Deploy成功

### 検証
- `git diff --check`: 成功
- `python3 scripts/build-detail-pages.mjs`: 成功（EN NEWS更新）
- `python3 scripts/check_regressions.py`: 成功（回帰なし）
- `python3 scripts/check_asset_versions.py --base HEAD~1`: 成功
- PC/モバイルのローカル表示、記事カード同期、カテゴリ操作: 確認済み
- 本番Deploy: 成功（run `32339113923`）
- 本番Lighthouse: 成功（run `32339245939`、8 URLすべて合格）
- 本番JA/EN NEWS応答: HTTP 200、キネティック実装の反映を確認

### 変更したパターン
- STORIES導入見出しのPCスクロール連動: 1パターン
- モバイル・アクセシビリティ静止表示: 2パターン
- EN NEWS再生成: 1ページ

### 未確認の類似パターン
- 本番反映後のJA/EN NEWS表示: HTTP応答・HTML反映確認済み。実ブラウザの最終目視はユーザー確認待ち
- 動きを減らす設定での本番表示: ローカルCSS確認済み、本番実機は未確認

### 次の担当への注意・判断待ち
- 本番DeployとLighthouseは完了。ユーザーが本番PC/モバイル表示を確認後、最終完了扱いにする。

## 2026-08-20 / Codex / 完了（手動Deploy後のLighthouse自動起動）

### 実施
- 手動起動したDeployでは`workflow_run`経由のLighthouseが自動起動しない場合があるため、Deploy完了後にLighthouseを明示起動する処理を追加。
- `workflow_dispatch`で起動したDeployだけを対象にし、通常のpush後の二重起動は避ける構成にした。
- DeployジョブにActions実行権限を追加。

### コミット
- SHA: `603396f0`
- push / rebase 状態: push済み。Deploy成功

### 検証
- `git diff --check`: 成功
- deploy-pages.yml YAML解析: 成功
- 通常push後のDeploy: 成功（run `32282396821`）
- Deploy後のLighthouse自動起動: 成功（run `32282662561`、8 URLすべて合格）

### 変更したパターン
- 通常push後のDeploy→Lighthouse: 1パターン
- 手動Deploy後のLighthouse起動経路: 1パターン

### 未確認の類似パターン
- Publish pipeline完了後のLighthouse: 今回は未確認

### 次の担当への注意・判断待ち
- 手動Deploy時はDeploy完了後にLighthouseを起動する。通常pushでは既存の`workflow_run`経路を使用する。

## 2026-08-20 / Codex / 完了（FESTIVALS一覧のCLS対策・基準復帰）

### 実施
- FESTIVALS一覧のSSR静的リンクからJavaScriptカード一覧へ差し替わる間だけ、一覧領域を非表示にするハイドレーション用クラスを追加。
- 静的リンク一覧はHTMLに残しており、JavaScript無効時のフォールバックとクローラー向け導線は維持。
- カード一覧の描画・イベント登録後にハイドレーション用クラスを解除するよう変更。
- LighthouseのCLS失敗閾値を、対策前の暫定値`0.06`から本来の`0.05`へ復帰。

### コミット
- 実装コミット: `e8f21068`
- CLS基準復帰コミット: `12b17d02`
- デプロイ後の生成同期: `7cf64102` / `473ab227`
- push / rebase 状態: push済み。Deploy成功

### 検証
- `git diff --check`: 成功
- `python3 scripts/check_regressions.py`: 成功（回帰なし）
- ローカルサーバー: `http://127.0.0.1:8080/festivals.html` の起動プロセスを確認
- 実ブラウザの表示・検索・FESTIVAL/RAVE切替: ローカルで確認済み
- 本番Lighthouse再計測: 成功（run `32265308362`、8 URLすべて合格、FESTIVALSのCLS assertion合格）
- CLS`0.05`基準での本番Lighthouse再計測: 成功（手動run `32275272523`、8 URLすべて合格）

### 変更したパターン
- FESTIVALSハブのSSRリンク→JSカード一覧の初期差し替え: 1パターン

### 未確認の類似パターン
- EN FESTIVALSハブの同じ初期差し替え: 実ブラウザ未確認
- JavaScript無効時のSSRリンク表示: 自動検査未確認
- FESTIVAL/RAVEモード切替後のCLS: ローカル確認済み

### 次の担当への注意・判断待ち
- CLS基準は`0.05`へ復帰済み。Node.js 20廃止予定のGitHub Actions警告は今回の合否に影響なし。

## 2026-08-19 / Codex / 作業中（EDITION重複保存ガード）

### 実施
- CMSのBody (EN)内にある`img`タグを自動検出。
- 画像ごとのEnglish alt入力欄を追加し、入力内容を既存の`body_en` HTMLへ保存できるようにした。
- 日本語を含むaltだけを対象に、既存の英語altや空欄を上書きしない一括AI翻訳ボタンを追加。
- HTML表示時にVisual本文と画像レイアウトツールが重ならないよう非表示化。
- 集中モードではHTML表示時のCSS競合を解消し、ソース欄だけを表示するよう修正。
- Title (EN)・Excerpt (EN)・Body (EN)の空欄だけを対象にする英語版一括生成を追加。
- TOPとNEWSの最初に表示される画像だけを`loading="eager"` / `fetchpriority="high"`に変更。
- NEWS PCでは、画面中央に最も近い右記事カードを基準に左画像を切り替えるよう同期処理を変更。
- NEWS PCでは、右記事へのホバーでも対応する左画像へ即時切り替えるよう追加。
- VENUESに続き、ARTISTSにも画像・ジャンル・地域・BIOのPCホバープレビューを追加。
- カードが画面右側にある場合はプレビューを左側へ出す自動配置を追加。
- VENUESのホバープレビューにも同じ左右自動配置を適用。
- 公開記事数が増えたため、TOP STORIESの初期表示をサイド3件から5件へ拡張。
- CMSキャッシュ番号をCSS v31 / JS v89へ更新。
- ARTISTS・VENUESのカードをTabキーでフォーカスした時も、マウスホバーと同じプレビューを表示。
- NEWSの右記事をTabキーでフォーカスした時も、対応する左画像へ切り替えるよう対応。
- FESTIVALS保存前に、EDITION_IDの重複・開催回IDと年の不一致・シート行番号の不一致を検査。
- EDITIONS同期失敗時にFESTIVALS本体だけが保存済みになる状態を検知し、公開停止と再読み込みを促す表示へ変更。
- 保存前ガードの自動検査を追加。
- CMSの`cms.js`参照をv90へ更新し、保存前ガードのブラウザキャッシュ残りを防止。
- 既存EDITION / LINEUPSの`_row`を数値化してGASへ送信し、文字列行番号が追記扱いになる経路を防止。CMS v91へ更新。
- GASの`updateRow`をEDITION_ID基準の既存行更新に変更し、重複IDは書き込まずエラーにする運用へ変更。
- 認証済みCMSで`grow-the-culture-open-air-2026`の109行目を更新し、保存後に新規行が増えないことを確認。

### コミット
- SHA: 未コミット（CMS v90反映分）
- push / rebase 状態: ローカル検証後にコミット予定。push未実施

### 検証
- `node --check LP/cms.js`: 成功
- `node scripts/check_cms_preview_frame.mjs`: 成功
- `git diff --check`: 成功
- 認証済みCMSでの一括生成→入力確認→保存→再表示: 一括生成は確認済み、保存・再表示は未確認

### 変更したパターン
- ARTICLESのBody (EN)画像alt手入力: 1パターン
- ARTICLESのBody (EN)日本語altの一括英訳: 1パターン

### 未確認の類似パターン
- 画像なし英語本文: 自動的に案内文を表示する経路、実ブラウザ未確認
- 複数画像のalt保存・再表示: 実ブラウザ未確認
- AI翻訳失敗時の再実行と、空欄・既存英語altの保持: 実ブラウザ未確認
- BodyのHTML表示→Visual表示の切替: 修正後の実ブラウザ未確認
- 集中モード→HTML表示: 修正後の実ブラウザ未確認
- 英語版一括生成の入力済み英語保持・失敗時再実行: 実ブラウザ未確認
- TOP・NEWSの初期画像表示と、下部画像の遅延読み込み: 修正後の実ブラウザ未確認
- NEWS PCの右記事と左画像のスクロール同期: 修正後の実ブラウザ未確認
- NEWS PCの右記事ホバーによる画像切替: 修正後の実ブラウザ未確認
- ARTISTS PCのカードホバーとスマホ非表示: 修正後の実ブラウザ未確認
- ARTISTS右端カードの左側表示: 修正後の実ブラウザ未確認
- VENUES右端カードの左側表示: 修正後の実ブラウザ未確認
- TOP STORIESの5件表示と「MORE STORIES」境界: 修正後の実ブラウザ未確認
- ARTISTS・VENUESのTabフォーカスによるプレビュー: 修正後の実ブラウザ未確認
- NEWS右記事のTabフォーカスによる左画像切替: 修正後の実ブラウザ未確認
- EDITION重複時の保存停止: 自動検査済み、認証済みCMSの実ブラウザ未確認
- EDITION同期失敗時の表示: 通信失敗を再現した実ブラウザ未確認
- 既存EDITIONのFLYER変更をGASへ数値行番号で送信: 認証済みCMSで確認済み

### 次の担当への注意・判断待ち
- GAS修正後の保存結果は確認済み。フロントエンド変更をpushし、公開前ゲート後にPublishする。

## 2026-08-18 / Codex / 完了（EN記事のSEOタイトル統一）

### 実施
- EN記事のパンくず構造化データに日本語タイトルが残る問題を修正。
- EN記事の関連記事タイトルも`title_en`を優先するよう修正。
- EN記事5件、関連するENフェス詳細5件を再生成。

### コミット
- SHA: `de740f6c`
- push / rebase 状態: rebase後にpush済み。Deploy成功

### 検証
- `node --check scripts/build-detail-pages.mjs`: 成功
- `git diff --check`: 成功
- Snow Machine ENのBreadcrumbList: 英語タイトルを確認
- `http://127.0.0.1:8080/en/articles/snow-mashine-2027-info.html`: 英語タイトル・関連記事を確認

### 変更したパターン
- EN記事のBreadcrumbList title: 1パターン
- EN記事の関連記事タイトル: 1パターン

### 未確認の類似パターン
- 5件すべてのEN記事を実ブラウザで確認: 自動再生成済み、代表記事を実ブラウザ確認
- 本番反映後の構造化データ: 未確認

### 次の担当への注意・判断待ち
- `de740f6c`のDeploy成功と、本番構造化データの英語タイトルを確認済み。

## 2026-08-18 / Codex / 完了（公開前キャッシュ番号不一致の解消）

### 実施
- Publish失敗ログから、`detail.css`のv22据え置き、`cms.js`のv83据え置き、古いcommon参照を特定。
- `DETAIL_CSS_VERSION`を23、CMS参照をv84へ更新。
- 残存していたcommon.css/common.jsの古い参照をv23/v13へ統一。

### コミット
- SHA: `d48bddd1`
- push / rebase 状態: push済み。Deploy成功

### 検証
- `python3 scripts/check_asset_versions.py --base HEAD~1`: 成功、混在0件
- Publish: 前回はキャッシュ番号不一致で停止。修正後のDeploy run `32089490254`は成功
- 実ブラウザ確認: 既存NEWS確認済み、キャッシュ番号修正後の全ページは未確認

### 変更したパターン
- detail.css参照: 全詳細ページ
- cms.js参照: CMSページ1件
- common.css/common.js参照: 残存旧参照5ページ

### 未確認の類似パターン
- Publish再実行後のDeploy成功: 確認済み
- CMSの認証済み実ブラウザ操作: 未確認

### 次の担当への注意・判断待ち
- 混在0件、Deploy成功、本番NEWS URLのHTTP 200と`storyItems = sorted.slice(0, 6)`を確認済み。

## 2026-08-18 / Codex / 完了（NEWS右レール6記事化）

### 実施
- NEWSの右側記事レールを4記事から最大6記事へ変更。
- 左ビジュアルのスクロール連動も6記事分に拡張。
- EN NEWSを再生成。

### コミット
- SHA: `bddbf3d8`
- push / rebase 状態: 実ブラウザ確認後にpush予定

### 検証
- `node scripts/build-detail-pages.mjs`: 成功
- 詳細ページ: 457ページ、変更0件・削除0件
- `http://127.0.0.1:8080/news.html`: PC/モバイル確認済み、6記事表示・画像連動・スクロール問題なし
- `http://127.0.0.1:8080/en/news.html`: PC/モバイル確認済み、表示問題なし

### 変更したパターン
- NEWS右レール表示件数: 4件→最大6件

### 未確認の類似パターン
- NEWS PC/モバイル実ブラウザ表示: 確認済み・問題なし

### 次の担当への注意・判断待ち
- 確認済みの`bddbf3d8`を本番へpushし、GitHub Actionsの公開結果を確認する。

## 2026-08-18 / Codex / 作業中（NEWS一覧のPC縦長表示を圧縮）

### 実施
- PCのNEWS左ビジュアルをDure Vie準拠の100vhへ変更。
- 右側の記事カードを50vhに揃え、1画面に2記事が見える構成へ調整。
- 右記事カードの上下余白も圧縮。モバイル側の既存レイアウトは維持。
- EN NEWSを再生成。

### コミット
- SHA: 未コミット
- push / rebase 状態: pull --rebase成功後に再生成済み。実ブラウザ確認後にコミット・push予定

### 検証
- 詳細ページ再生成: 457ページ、変更0件・削除0件
- EN NEWS再生成: 1ページ
- 実ブラウザ確認: 未確認

### 変更したパターン
- NEWS PCレイアウト: 左ビジュアル1パターン、右記事カード1パターン

### 未確認の類似パターン
- NEWSのPC実ブラウザ表示: 未確認
- NEWSのモバイル表示: 未確認

### 次の担当への注意・判断待ち
- `http://127.0.0.1:8080/news.html`をPC幅で確認し、左ビジュアルが画面高いっぱい、右記事カードが各50vhで2記事見えることを確認する。モバイルで従来どおり画像付き記事一覧になることも確認する。

## 2026-08-18 / Codex / 完了（JA/EN位置の全ページ統一）

### 実施
- 通常ヘッダーのJA/ENを右端基準で固定。
- モバイルメニュー内のJA/ENを中央基準で固定。
- CSSキャッシュバージョンを更新し、詳細ページを再生成。

### コミット
- SHA: 生成物コミット予定
- push / rebase 状態: `pull --rebase`成功後に再生成・自動検証済み。pushは実ブラウザ確認後

### 検証
- `git diff --check`: 成功
- `node --check LP/common.js`: 成功
- `python3 scripts/audit_spa_vs_static.py --after`: 成功
- 詳細ページ457枚を再生成、削除0件。JA/ENの代表ページでcommon.css v23を確認
- 実ブラウザ確認: 未確認

### 変更したパターン
- JA/EN通常ヘッダー: 1パターン
- JA/ENモバイルメニュー: 1パターン

### 未確認の類似パターン
- JA/ENの全ハブ・全詳細ページ: 自動生成・参照更新済み、実ブラウザは未確認

### 次の担当への注意・判断待ち
- 再生成後、PCとモバイルでJA/ENの位置が通常ヘッダー右端、メニュー中央になることを確認してから公開判断する。

## 2026-08-18 / Codex / 完了（モバイル記事詳細・共通メニューの表示統一）

### 実施
- モバイル記事詳細の固定ヘッダー直下で「ALL STORIES」が重ならないよう、記事上部の安全域を調整。
- 本文と見出しがスマホ画面の右側を過度に余らせないよう、モバイル本文幅と見出しの折返しを調整。
- 共通JS/CSSのキャッシュバージョンを更新し、ページごとの古いヘッダー表示が残らないよう統一。
- 詳細ページを再生成し、JA/ENの全詳細ページへ更新を反映。

### コミット
- SHA: コミット予定（生成物を含む）
- push / rebase 状態: pull --rebase成功後に生成・検証済み。pushは実ブラウザ確認後

### 検証
- `git diff --check`: 成功
- `http://127.0.0.1:8080/articles/bondisco-2026-info.html`: HTTP 200、common.css v22 / common.js v13を確認
- 生成詳細ページ全件の再生成: 438ページ更新、0ページ削除
- 実ブラウザでのモバイル表示確認: 未確認（ユーザー側のChrome確認待ち）

### 変更したパターン
- 記事詳細のモバイル戻る導線・本文見出し幅: 1パターン
- 共通JS/CSSキャッシュバージョン: ハブ・JA/EN詳細ページ全体

### 未確認の類似パターン
- FESTIVAL / ARTIST / VENUE詳細のモバイルヘッダー: 自動生成・参照更新済み、実ブラウザは未確認
- JA / EN各ページの共通メニュー: 自動生成・参照更新済み、実ブラウザは未確認

### 次の担当への注意・判断待ち
- ChromeでPC/モバイル相当幅を確認し、「ALL STORIES」の位置、H2の改行、メニュー上下のXを確認してから公開判断する。

## 2026-08-18 / Codex / 完了（Edition編集時の重複再発防止）

### 実施
- MUTEKのフライヤー編集後に同じ`EDITION_ID`が追記された事象を調査。
- EDITIONS読み込み時に重複IDを行番号付きで検出し、重複がある場合は保存を停止するガードを追加。
- 既存データを自動削除・自動統合せず、誤った開催回を上書きしない安全設計を維持。

### コミット
- SHA: 未コミット
- push / rebase 状態: 未実施

### 検証
- `node --check LP/cms.js`: 成功
- `node scripts/check_cms_editions.mjs`: 15/15項目成功
- `git diff --check`: 成功
- LIVE確認: MUTEK EDITIONS重複6件、LINEUPS重複4セットを確認。既存データ整理が必要

### 変更したパターン
- `LP/cms.js`のEDITIONS読み込み時重複検出・保存停止: 1経路
- `scripts/check_cms_editions.mjs`の重複検出回帰テスト: 1件

### 未確認の類似パターン
- 重複整理後の認証済みCMS実ブラウザでの保存確認: 未確認
- 重複整理後のPublish pipeline: 未確認

### 次の担当への注意・判断待ち
- LIVEシートのMUTEK重複行を整理し、画像参照切れも解消してからPublishを再実行する。

## 2026-08-17 / Codex / 完了（Publish停止のCMSキャッシュ番号修正）

### 実施
- Publish pipelineの`Check asset cache busting`失敗を確認。
- Edition追加重複防止を含む`LP/cms.js`の変更に対し、参照元`LP/cms.html`の`cms.js?v=82`が更新されていなかったため、`v=83`へ更新。

### コミット
- SHA: 未コミット
- push / rebase 状態: 未実施

### 検証
- `node scripts/check_cms_editions.mjs`: 14/14項目成功（直前確認）
- `git diff --check`: 実施予定
- Publish pipeline: `Check asset cache busting`で停止した原因をログ確認済み。修正後の再実行は未実施

### 変更したパターン
- `LP/cms.html`の`cms.js`キャッシュバージョン: 1箇所

### 未確認の類似パターン
- CMSキャッシュ番号修正後のPublish pipeline: 未確認
- 他のJS/CSS参照バージョン: 確認済み・0件

### 次の担当への注意・判断待ち
- push後にPublish pipelineを再実行し、asset cache bustingからDeployまで成功することを確認する。

## 2026-08-17 / Codex / 完了（FESTIVALS月フィルターの年対応）

### 実施
- 同じ月に複数年の未来イベントがある場合、月フィルターを`FUTURE-YYYY-M`で識別するよう変更。
- 年が混在する月は「MAR 2027」のように表示し、別年のイベントが同時表示されないよう修正。

### コミット
- SHA: 未コミット
- push / rebase 状態: 未実施

### 検証
- `http://127.0.0.1:8080/festivals.html`: 月フィルターで年をまたいだイベントが混ざらないことを実ブラウザ確認
- inline JavaScript syntax check: 成功
- `git diff --check`: 成功

### 変更したパターン
- `LP/festivals.html`の未来月ナビゲーションと月フィルター: 1経路

### 未確認の類似パターン
- EN版FESTIVALSの月フィルター: 確認済み・0件（同一ハブJSを使用）
- 過去イベントの年フィルター: 確認済み・0件（既存ロジックを変更していない）

### 次の担当への注意・判断待ち
- push後のGitHub Pagesデプロイ完了と本番URLでの確認を行う。

## 2026-08-17 / Codex / 完了（FESTIVALS開催年順ソート）

### 実施
- FESTIVALS一覧の未来イベントを月だけでグループ化していたため、2027年3月が2026年8月より先に表示される問題を修正。
- 年→月→日付の順で未来イベントをグループ化・表示するよう変更。

### コミット
- SHA: 未コミット
- push / rebase 状態: 未実施

### 検証
- `http://127.0.0.1:8080/festivals.html`: 2026年イベントが2027年イベントより先に表示されることを実ブラウザで確認
- inline JavaScript syntax check: 成功
- `git diff --check`: 成功
- `scripts/check_hub_pages.py`: 環境のローカルポート権限制限で未実施

### 変更したパターン
- `LP/festivals.html`の未来イベントの年/月グループ化と表示順: 1経路

### 未確認の類似パターン
- EN版FESTIVALSの同一ソート経路: 確認済み・0件（同一ハブJSを使用）
- 過去イベントの年/月表示順: 確認済み・0件（既存ロジックを変更していない）

### 次の担当への注意・判断待ち
- push後のGitHub Pagesデプロイ完了と本番URLでの最終確認を行う。

## 2026-08-17 / Codex / 完了（Publish重複エラーの診断・Edition追加改善）

### 実施
- Publish pipelineが安全停止した原因を確認。LIVEのEDITIONSに`snow-machine-japan-2026`の重複があり、データを推測で自動統合せず公開を停止する現行仕様が正常に働いていた。
- CSV取得時にシート行番号を内部保持し、ID重複エラーを「どのIDの何行目と何行目か」まで表示するよう改善。
- GitHub Actionsのエラー注釈にも検証結果を出し、一覧画面から原因を確認できるよう改善。データの自動削除・先勝ち採用は行わない。
- CMSの「Add Edition」が既存年を再利用しないよう、既存の最大年の翌年を初期値に変更。
- 同一画面で同じ開催年を複数保存しようとした場合、シート書き込み前に停止するガードを追加。

### コミット
- SHA: 未コミット
- push / rebase 状態: 未実施

### 検証
- `node --check scripts/fetch-data.mjs`: 成功
- `node --check LP/cms.js`: 成功
- `node scripts/check_cms_publish_guard.mjs`: 全項目成功
- `node scripts/check_cms_editions.mjs`: 14/14項目成功
- `git diff --check`: 成功
- 実ブラウザ確認: 今回はCI診断コードのみの変更のため対象UIなし。Publish pipelineの実行確認は重複データ修正後に実施

### 変更したパターン
- `scripts/fetch-data.mjs`のCSV行番号メタ情報、ID重複診断、GitHub Actionsエラー注釈: 1経路
- `LP/cms.js`のAdd Edition初期年決定・新規Edition重複防止: 2経路

### 未確認の類似パターン
- 実際のLIVEシートで修正後にPublishが成功する経路: 未確認（EDITIONS重複の修正が必要）
- 認証済みCMSの実ブラウザでAdd Editionを押す操作: 未確認
- `LINEUPS`の同一`EDITION_ID`複数行: 確認済み・0件（出演者ごとの複数行は正しい）

### 次の担当への注意・判断待ち
- `snow-machine-japan-2026`について、EDITIONSシートの重複2行を内容確認し、誤登録行をユーザーが修正する必要がある。修正後にPublish Nowを再実行する。
- 修正反映後、CMSで既存フェスを開き、Add Editionが翌年を提案することを実ブラウザで確認する。

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

## 2026-08-13 / Codex / 本番詳細ページモバイル目視確認

### 実施
- LOA-LOST PARADISEのFestival / Rave詳細をJA・ENのモバイル幅で描画。
- 同イベント記事詳細をJA・ENのモバイル幅で描画。

### コミット
- テスト記録のみ。記事タイトルの表示仕様確認待ち。

### 検証
- Festival / Rave詳細の画像、ジャンル、日程、会場、本文導入を確認。
- 記事詳細の画像、カテゴリ、本文メタ情報、本文領域を確認。
- 4ページすべてHTTP 200。

### 変更したパターン
- 本番詳細ページのモバイル表示確認。

### 未確認の類似パターン
- 長い記事タイトルがモバイルのヒーロー画像内で右端に見切れて見える。
  仕様上の演出か、折り返し修正が必要か未判断。
- 実機のSafari / Chrome操作は未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 記事ヒーロータイトルのモバイル表示を確認後、必要ならCSS修正→再テスト。

## 2026-08-13 / Codex / 記事ヒーロータイトルのモバイル折り返し修正

### 実施
- `.article-hero-overlay h1` に最大幅と折り返し指定を追加。
- 詳細ページCSSキャッシュバージョンを7から8へ更新し、JA / EN静的ページを再生成。

### コミット
- `3e4bcea5 fix: wrap long article hero titles on mobile`
- GitHub Actions regression / Pages deploy 成功（run `31657624271`）。

### 検証
- JA / EN、PC / モバイル相当で`detail.css?v=8`を確認。
- タイトルに`overflow-wrap:anywhere`と`word-break:break-word`が適用され、
  タイトル右端がビューポート内に収まることを実計測。
- 本文16段落、画像5件、リンク1件が保持され、横幅超過なし。
- `bash scripts/preflight.sh` 全27件成功。
- 本番URLで`detail.css?v=8`と記事タイトルを確認。

### 変更したパターン
- 長い日本語記事タイトルがモバイルのヒーロー内で右端に見切れて見えるパターンを、
  折り返し指定で解消。実計測でタイトル幅326px、右端358px、viewport390px。

### 未確認の類似パターン
- 実機Safari / Chromeの表示は未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 本番URLでJA / ENをモバイル描画し、`detail.css?v=8`と画面内への収まりを再確認済み。

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

## 2026-08-13 / Codex / 本番ARTISTS・VENUESモバイル確認

### 実施
- 本番ARTISTS / VENUESをモバイル幅でChrome描画。
- JA / ENの4ハブへHTTPアクセスし、表示要素を確認。

### コミット
- 未コミット。次回のドキュメントコミットに含める。

### 検証
- ARTISTS: A–Zナビ、検索欄、ジャンルフィルター、先頭カード群を確認。
- VENUES: 都市フィルター、検索欄、最初の会場カードを確認。
- `/artists.html`、`/venues.html`、`/en/artists.html`、`/en/venues.html`がHTTP 200。

### 変更したパターン
- 本番ARTISTS / VENUESハブのモバイル表示。

### 未確認の類似パターン
- 実機でのA–Zタップ、検索入力、横スワイプは未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- 次は実機相当の操作確認またはCMS操作確認へ進む。

## 2026-08-13 / Codex / ユーザー確認後の最終公開状態確認

### 実施
- ユーザーによるTOP、FESTIVALS、ARTISTS、VENUESの操作確認がすべてOK。
- 本番主要URL（JA / ENのTOP・4ハブ）を再確認。

### コミット
- `22788018 docs: record production artists and venues review`

### 検証
- 主要8 URLがすべてHTTP 200。
- 作業ツリーはクリーン。
- 直近のUnstick CIは成功。
- UI公開のDeploy / regressionは成功済み。

### 変更したパターン
- ユーザー実操作確認後の公開状態確認。

### 未確認の類似パターン
- Sync Drive ImagesジョブはCMS認証エラー（`Invalid auth token`）で失敗。
  今回のUI公開・既存画像配信とは別系統で、画像同期は未確認。
- CMSの入力→保存→再表示は未確認。

### 次の担当への注意・判断待ち
- UI変更は公開・確認済み。画像を追加・更新する前にCMS_AUTH_HASHを確認し、
  Sync Drive Imagesを再実行すること。

## 2026-08-13 / Claude / アーティスト情報の調査・第1弾（7人・提案のみ）

### 実施
- 名前だけのアーティスト92人のうち、**直近開催に出演する21人**を優先対象に特定
  （events.json × LINEUPS の突き合わせ）。
- うち7人の公式リンク・事実を Web 検索で調査し、出典・確度つきで
  `data/inbox/artist-<id>.json` に保存（artist-research/1 形式）。
- CMS 入力用の下書き `reports/artists-draft-2026-08-13.md` を作成
  （リンク + BIO/bio_en の草稿 + 出典 + 確度 + 入力手順）。

### コミット
-（本コミット）data/inbox 7件 + reports 1件。**本番・シートとも未変更。**

### 検証
- リンクは検索結果の**直リンクがあったものだけ「高」**とし、要約経由のものは
  「中 — 貼る前に本人確認」と明記（acid-pauli の IG / sylvan-esso の WEBSITE）。
- 同名別人の可能性を排除できないもの（moodman の SoundCloud）は**掲載しない**。
- 紹介文は確認できた事実のみで自前執筆。**RA の文章は転載していない**（著作権）。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- **写真は全員未定。**RA・レーベルの写真は撮影者に権利があり取得不可。
  「当面写真なし → フェス経由で許諾」を推奨（下書きに選択肢を記載）。判断待ち。
- Global Ark（8/21）出演の choko / sunga / tsutomu は Web 検索での特定が
  困難。フェス公式 Instagram の出演者告知から辿るのが確実。
- 残り: 直近開催の未調査14人 + その後ろの71人。

### 次の担当への注意・判断待ち
- 入力は**CMS 経由**（シート直貼りは既存行の更新になるため不可）。
  確度「中」の URL は開いて本人確認してから貼ること。
- BIO を書く前に data/inbox/artist-<id>.json の confidence を確認する
  （AGENTS.md の事実主義。low は断定的に書かない）。

## 2026-08-13 / Claude / アーティスト調査・第2弾（IG 実地確認で8人特定）

### 実施
- Web 検索で特定できなかった出演者を、**フェス公式 Instagram のフォロー先
  検索 → 本人プロフィールを開いて確認**する手法で特定。
  - Global Ark 組（8/21 出演・最優先）: choko / sunga / tsutomu
  - Synapse 組（10/2）: ground / ysk / noritake / joma
  - COLORS（9/20）: occa（CHOKO のフォロワー欄から発見）
- **全員、bio に DJ 活動の記載があることを確認してから記録**
  （名前一致＋公式フォローだけでは確定にしない）。
- data/inbox/artist-*.json 8件追加（計15件）。下書き第2弾を
  reports/artists-draft-2026-08-13.md に追記（BIO/bio_en 草稿つき）。

### コミット
- `docs: アーティスト調査・第2弾（IG実地確認8人・計15人分の下書き）`

### 検証
- Instagram プロフィール8件を実際に開き、DJ 活動・所属・拠点の記載を確認。
- 別人だった例を実際に検出（@ga.globalark はアルゼンチンの建材会社）。
  handle 検索だけでは危険という実証。
- ユーザー方針「不確かなものは載せない」に従い、moodman の SoundCloud と
  okadada の Instagram は**保留のまま**（本人確認が取れない）。

### 変更したパターン
- なし（調査・下書きのみ。本番・シート未変更）。

### 未確認の類似パターン
- noritake の SoundCloud は**短縮リンクのみ**（on.soundcloud.com/…）。
  展開先を開いて本来の URL を確認してから登録すること。
- suimin（Odyssey）/ so（御月民）は未特定。各フェス公式 IG の
  フォロー先から辿る手法が有効なはず。
- FRUE 組3人（Kiko Dinucci / Joujouka / Kuo）は次バッチ（開催11月）。

### 次の担当への注意・判断待ち
- **CMS 入力待ち15人分**が reports/artists-draft-2026-08-13.md にある。
  確度「中」の URL は開いて確認してから貼ること。
- 写真は全員空欄のまま（ユーザーが手動で収集する方針。2026-08-13 決定）。

## 2026-08-13 / Claude / アーティスト調査・第3弾（計22人分の下書き完成）

### 実施
- 直近開催の残りを調査: SO（御月民公式のフォロー先→ IG 実地確認。
  The Labyrinth / Mindgames の DJ。SoundCloud も本人 bio から取得）、
  FRUE 組4人（Kiko Dinucci / Joujouka / Juana Molina は Bandcamp 直リンク）。
- 「どんどん追加」の指示により著名どころを前倒し: Gonno / Ben UFO / Daphni。
- data/inbox/artist-*.json 計22件。下書き第3弾を artists-draft-2026-08-13.md に追記。

### コミット
- `docs: アーティスト調査・第3弾（SO実地確認 + 著名6人・計22人分）`

### 検証
- SO は IG プロフィールを開いて本人確認（表示名 SO | satoshi aoyagi、
  bio に DJ / The Labyrinth / soundcloud.com/dj_so）。
- 直リンクが取れたものだけ「高」。要約経由（Gonno の SC / Juana Molina の
  WEBSITE / Ben UFO の COUNTRY）は「中 — 開いて確認」と明記。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- **suimin（Odyssey 9/25）は特定できず登録しない**（公式フォロー先に該当なし）。
  出演者告知投稿のタグから辿る手が残っている。
- moodman の SoundCloud / okadada の IG / Ben UFO の IG も未確認のまま保留。

### 次の担当への注意・判断待ち
- CMS 入力待ち **22人分**。⚡Global Ark 組（8/21）を最優先で。
- 次バッチ候補: hidai（3フェス出演）、dj-maria / kikiorix / dj-yogurt /
  rami / mimu / akie / yamarchy / calpiss / yellowuhuru（各2フェス）。
  国内勢はフェス公式 IG フォロー先方式が有効。

## 2026-08-13 / Claude / アーティスト調査・第4弾（計29人分）

### 実施
- 出演フェス数の多い順に7人を調査。
  - IG 実地確認: hidai（@ala_trippymusic のフォロー先→ bio に PARAMOUNT 一致）、
    TAICHI KAWAHIRA（Brightness LLC 代表・linktr.ee あり）
  - Web 検索: DJ Yogurt（UPSET RECORDINGS 設立者）、DJ KENSEI（SC 直リンク）、
    DJ MIKU（公式サイト・GLOBAL ARK 主宰者と判明）、Kikiorix（IG+SC 直リンク）、
    DJ MARIA.（IG 直リンク・Berghain 出演）
- data/inbox 計29件。下書き第4弾を追記。

### コミット
- `docs: アーティスト調査・第4弾（hidai/KAWAHIRA実地確認 + 著名5人・計29人分）`

### 検証
- IG 2件はプロフィールを開いて本人確認。検索組は直リンクのみ「高」。
- **DJ Yogurt の SoundCloud は候補が複数（3アカウント）で特定できず「載せない」。**
- DJ KENSEI の IG（@sarasvati_music_ashram）は要約情報のみのため保留。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- 保留計6件（moodman SC / okadada IG / suimin / DJ Yogurt SC /
  DJ KENSEI IG / Ben UFO IG）。いずれも「複数候補 or 未確認」で載せない判断。

### 次の担当への注意・判断待ち
- CMS 入力待ち **29人分**（reports/artists-draft-2026-08-13.md）。
- 次バッチの行き先はメモ済み: rami・akie（@matricaria_festival）/
  yamarchy・calpiss（@harukaze_asia）/ yellowuhuru（@etsu_etsu_）/
  mimu（@sub_tide）/ mayudepth（@waifu_party）/ endorphin（@arch___2014）。

## 2026-08-13 / Claude / アーティスト調査・第5弾（計39人分）

### 実施
- 国際的な著名アーティスト10人を Web 検索で調査:
  Four Tet / Floating Points / Helena Hauff / DJ KRUSH / Mala /
  Gerd Janson / HAAi / Prins Thomas / SHERELLE / Daniel Bell。
- 残りの正確な人数を再集計: **50人 → 調査済み10人を引いて残り40人。**
  フェス別の行き先マップを下書きに記録済み。

### コミット
- `docs: アーティスト調査・第5弾（国際的な著名10人・計39人分）`

### 検証
- Bandcamp/SoundCloud は検索結果の直リンクのみ「高」。
  要約経由（HAAi の SC / SHERELLE の IG・SC）は「中 — 開いて確認」。
- Daniel Bell は公式アカウントを確認できず**リンクなしで登録**（事実のみのBIO）。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- 残り40人。RDC 国際勢（suze-ij / jonny-rock / jonathan-kusuma / feline /
  nc4k）、STAR FESTIVAL 勢（dj-hype / clipz / lady-shaka / guchon /
  dj-masda / nasthug）、Transcendence 勢（kohra / paquita-gordon / upsammy）、
  MATRICARIA 国内勢（rami / akie ほか）等。

### 次の担当への注意・判断待ち
- CMS 入力待ち **39人分**。Global Ark（8/21）組を最優先で。

## 2026-08-13 / Claude / アーティスト調査・第6弾（計49人分・保留8件）

### 実施
- 国際勢+国内著名10人: upsammy / Paquita Gordon / Eric Cloutier / DJ Masda /
  Guchon / AOKI takamasa / KOHRA(保留) / Suze Ijó / Jonathan Kusuma / DJ Hype。

### コミット
- `docs: アーティスト調査・第6弾（国際勢+国内著名10人・計49人分）`

### 検証
- 直リンクのみ「高」。DJ Masda / DJ Hype は公式アカウント特定できず
  **リンクなし・経歴のみ**で下書き。
- **KOHRA は同一人物か未確証のため「保留」**（インドの KOHRA が有力だが、
  Transcendence 出演者との同定ができない。フェス公式告知で確認してから）。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- **ID 規約ずれを発見: `suze-ij`**。スキーマ §1.1 では `suze-ijo`
  （アクセント文字は基底文字に変換・文字を落とさない）のはず。
  URL になっているため勝手に変えず**管理判断待ち**として報告。
- 残り約30人は国内勢中心。MATRICARIA 組13人（rami / akie / adhemar /
  allen-mock / caimann / dj-yazi / fuji / iron / ojisan / suguru-mochizuki /
  yukimasa / pianeti-sintetici）、STAR FESTIVAL 残り（clipz / lady-shaka /
  nasthug）、RDC 残り（feline / jonny-rock / nc4k）、春風・ETSUETSU 組
  （yamarchy / calpiss / yellowuhuru / zundoko-disco / you-forgot）、
  qmico / mimu / mayudepth / endorphin / kohei / kuo-from-sunset-rollercoaster。

### 次の担当への注意・判断待ち
- CMS 入力待ち **48人分**。⚡Global Ark（8/21）組を最優先。
- `suze-ij` の ID 修正は URL 変更を伴うため要判断（§1.1 違反の報告）。

## 2026-08-13 / Claude / アーティスト調査・第7弾（計55人分・残り37人）

### 実施
- 6人調査: Pianeti Sintetici / DJ YAZI / Kuo From Sunset Rollercoaster /
  Jonny Rock / LADY SHAKA / Clipz。
- MATRICARIA 公式 IG のフォロー先で rami / akie を検索 → **該当なし**。
  このフェスは出演者をフォローしない方針らしく、この手法が効かない。

### コミット
- `docs: アーティスト調査・第7弾（6人・計55人分）`

### 検証
- 直リンクのみ「高」。DJ YAZI / Clipz / Kuo は公式アカウント特定できず
  **リンクなし・経歴のみ**。
- 正確な残数を再集計: **残り37人** = 出演データあり24 + スタブ13。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- rami は @99flags_party、akie は @nu_fes_tokyo のフォロー先が次の手。
- スタブ13人に Antal / Hunee / GE-OLOGY / Idjut Boys /
  Space Drum Meditation 等の著名どころ（検索で確定可能）。
- 国内勢24人（qmico / mimu / mayudepth / endorphin / feline / nc4k /
  yamarchy / ojisan / caimann / fuji / adhemar / allen-mock /
  suguru-mochizuki / yukimasa / iron / zundoko-disco / calpiss / kohei /
  you-forgot / nasthug / suimin ほか）は各フェス IG の告知投稿タグが最後の手。

### 次の担当への注意・判断待ち
- CMS 入力待ち **54人分**（+KOHRA 保留）。⚡Global Ark（8/21）組を最優先。

## 2026-08-13 / Claude / アーティスト調査・第8弾（計63人分・残り29人）

### 実施
- スタブの著名勢6人（Antal / Hunee / GE-OLOGY / Idjut Boys /
  Space Drum Meditation / Ouissam=要確認）を Web 検索で調査。
- 以前のフォロー欄で見つけた2人を IG 実地確認:
  Mr.Disco Kid（@mr_disco_kid）/ DOLTZ（@doltzdeep・Bitta 関連・2.1万フォロワー）。
- Instagram のスクリーンショットが固まる事象が発生 → **get_page_text での
  テキスト抽出に切り替えて確認を続行**（bio の文言はテキストで取得可能）。

### コミット
- `docs: アーティスト調査・第8弾（著名スタブ6人 + IG発見2人・計63人分）`

### 検証
- 直リンクのみ「高」。Ouissam は**同名アカウントが複数**のため「中・要確認」。
- Hunee の拠点はベルリン/アムステルダム両説あり COUNTRY を「中」に。

### 変更したパターン
- なし（調査・下書きのみ）。

### 未確認の類似パターン
- 残り29人 = 国内勢22 + スタブ4（captain-k / sakuma / dungeoneering / sisi）
  + tonbo（**draft 化済みのため調査不要の可能性**。要確認）+ rami / akie 再挑戦。
- 国内勢の最終手段はフェス公式 IG の「出演者告知投稿のタグ」。
  フォロー先検索より手間だが確実。

### 次の担当への注意・判断待ち
- CMS 入力待ち **61人分**。⚡Global Ark（8/21）を最優先。

## 2026-08-13 / Claude / アーティスト紹介文 v2（5行版・51人）

### 実施
- 紹介文を5行へ拡充した改訂版 `reports/artists-bio-v2-2026-08-13.md` を作成。
  **事実が確認できている51人のみ**が対象。
- **事実の薄い10人は据え置き**（acid-pauli / akiram-en / choko / ground /
  hidai / joma / noritake / okadada / ysk ほか）。水増しになるため増やさない。
  増やすには追加取材が要る（linktr.ee / SoundCloud プロフィール / フェスの紹介投稿）。
- 文体を Techno_Japan_Web_Style_Guide に合わせた
  （編集者の視点・具体で語る・締めの一文・全角ダッシュ禁止）。

### コミット
-（本コミット）reports/artists-bio-v2-2026-08-13.md + data/inbox 14件更新。

### 検証
- **本文の年号・固有名詞が出典（data/inbox）に存在するかを機械照合した。**
  初回 186件の指摘は大半が誤検出（英訳地名・所有格・トークン分割）だったため
  検査を精密化し、**本物の指摘2種を発見した。**
  1. **出典への記録漏れ14件** — 調査時に検索結果で見ていたが inbox に
     書き残していなかった事実（DJ Masda のレーベル所属作家、Helena Hauff の
     Birds and Other Instruments、Prins Thomas のサブレーベル等）。
     **本文を削らず、出典側に `facts_extra` として追記**して追跡可能にした。
  2. **裏の取れていない記述1件** — Hunee の「Antal との B2B」。
     シーンでは知られた話だが今回の調査に出典がないため**日英とも削除**した。
- 表記ルール検査（全角ダッシュ / 英文の長音符 / 感嘆符）すべて 0件。
- 最終照合: **51人すべての年号・固有名詞が出典に存在する**ことを確認。

### 変更したパターン
- 紹介文に「調べたが記録していない事実」が混ざり、あとから検証できなくなる
  パターン。**書いたことは必ず出典ファイルに戻す。**
- 「シーンで知られている」ことを出典なしに書いてしまうパターン（Hunee の例）。

### 未確認の類似パターン
- 据え置き10人の追加取材は未実施。
- 第1〜8弾の下書き（artists-draft）側の紹介文は v1 のまま。
  **CMS へ入れるときは v2 を優先し、v1 は据え置き10人ぶんだけ使う。**

### 次の担当への注意・判断待ち
- 入力時は **BIO/bio_en は v2、リンク・CITY 等は v1（artists-draft）** から取る。
- 写真は空欄のまま（手動収集の方針）。

---

## 2026-08-14 英語版 ABOUT が CSS 無しで公開されていた（緊急対応）

### 実施
- **`LP/en/about.html`** の CSS / JS 参照5本を相対→絶対パスへ修正（本番に出ている実体）
- **`LP/about.html`** も同様に修正し、理由をコメントで残した（原本）
- **`scripts/check_asset_paths.py`** を新規追加。preflight「キャッシュと配信」に組み込み
- `AUDIT_TECHNO_JAPAN.md` §9-82 に経緯を記録
- 併せて §9-81 の Publish 改善（送信内容サマリ・無変更検知・AGENTS.md 追記）を同梱

### 原因
`LP/about.html` が `href="common.css?v=6"` と**相対パス**で書かれていた。
ルート直下の `/about.html` では `/common.css` に解決するため**日本語版は正常**。
しかし同じファイルが `/en/about.html` に置かれると `/en/common.css` を探して 404 になり、
CSS 5本すべてが読めず素の HTML で公開されていた。

さらに `build-detail-pages.mjs` が英語版を生成しているのは5ハブ
（index/festivals/artists/venues/news）だけで、`about.html` / `submit.html` は
**一度手でコピーされたきり再生成されない**。原本を直しても複製に届かず、
EN 側を直接修正する必要があった。

### コミット
（本エントリと同一コミット。下記「検証」の後に push）

### 検証
**実ブラウザ（headless Chrome / 1440×1000）で計測。**

本番 `https://techno-japan.media/en/about.html`（修正前）:
```
背景色 rgba(0,0,0,0) / 文字色 rgb(0,0,0) / /en/common.css=0(404) / 最初のSVG 1637px
```

ローカル修正後 `/en/about.html`・`/about.html`・`/en/submit.html` の3経路:
```
背景色 rgb(8,8,8) / 文字色 rgb(240,237,232) / フォント "DM Sans"
/common.css?v=6 = 142ルール / 読めなかった資産 なし / 最初のSVG 16px
```
→ **英語・日本語で計測値が完全に一致。**

ネガティブコントロール3経路すべてで検知を確認:
```
LP/en/about.html を相対に戻す → ✅「LP/en/common.css が無い」
LP/about.html を相対に戻す    → ✅「en/about.html 側で 404」
LP/submit.html を相対に戻す   → ✅「en/submit.html 側で 404」
```
（初回の破壊は `/manifest.json` の `.js` に当たっており、置換1件でも狙いが外れていた。
　一致文字列を印字させて修正。AUDIT §9-82）

preflight: **全28件成功**（新検査を含む）。

### 変更したパターン
- `LP/en/about.html` — `common.css` `common.js` `data.js` `favorites.js` `search.js` の5本
- `LP/about.html` — 同5本
- preflight に「CSS / JS の参照先が実在する」を追加（27→28件）

### 未確認の類似パターン
- **`/en/` 配下の全7枚を検査済み・相対パス0件。** 生成5ハブは `enHubFromJa` が
  絶対パスへ書き換えるため元から無事だった
- **LP 配下473ページ全体で、解決できない CSS / JS 参照は0件**（検査で確認済み）
- 画像・フォントの相対パスは今回の検査対象外。**未確認**
  （CSS が効かない致命傷にはならないため今回は見送り）

### 次の担当への注意・判断待ち
- ⚠️ **`LP/en/about.html` と `LP/en/submit.html` は手書きの複製**で、生成経路に無い。
  JA 側を直しても EN 側は追従しない。**JA の about / submit を編集したら EN も手で直す。**
  同じ内容を2箇所に持つ構造なので、いずれ生成経路へ寄せるか要判断
- **Publish 経路（cms.js）の変更が未コミット分に含まれる。** preflight は緑だが、
  過去3回モック緑・実機失敗が起きている。**CMS で Publish Now を1回押して
  `cms: publish data.js` のコミットが増えることを確認するまで完了ではない**（実機未確認）
- CMS 入力の積み残し: アーティスト54名（紹介文v2 + リンク）。
  ⚡Global Ark(8/21) の CHOKO / SUNGA / TSUTOMU が最優先
- 報告済みでユーザー判断待ちのデータ課題: EDITIONS の `STATUS=published` 36行 /
  TICKETURL 未入力 20/104 / ID規約違反 `suze-ij`（正しくは `suze-ijo`）

## 2026-08-14 / Codex / STORIES演出の段階導入方針

### 判断
- NEWSページでは、Dure Vieを参考にした「PCは左画像固定・右記事スクロール・記事連動で画像切替」の演出を試験中。
- TOPのSTORIESには、記事数が増えるまで同じ演出を導入しない。
- TOPのモバイル表示は現状を維持する。
- TOPへの導入は、常時4〜6本以上の記事が揃った時点で再検討する。

### 注意
- 現在のNEWS演出は未公開のローカル変更（`LP/news.html` / `LP/en/news.html`）。
- TOPへ反映する場合も、まずローカルのPC・モバイル・JA・ENでテストしてから公開する。

### ローカル確認結果
- ユーザー確認で、PCのNEWSページをスクロールした際に右記事と左画像が正常に切り替わることを確認。
- NEWS変更は引き続き本番未公開。preflight後に公開判断する。

### 公開結果（2026-08-14）
- ユーザー確認後、NEWSレール変更は自動同期コミット `4f672aaf` に含まれて本番反映済み。
- JA / ENの本番NEWS HTMLで`stories-visual`と`story-side-item`を確認。
- Pages Deploy `31726205067` 成功、作業ツリーはクリーン。

### 公開後のNEWS機能テスト（2026-08-14）
- JA / EN、PC / モバイルでレール画像4枚・記事4件を確認。
- RAVEカテゴリ切替で2件表示、記事リンクとLOAD MOREの挙動を確認。
- 横幅超過なし。回帰検査・内部リンク検査も成功。
- CMS関連の別作業による未コミット変更があるため、今回のテストでは変更していない。

---

## 2026-08-14 CMS の Image Position が詳細ページに届いていなかった

### 実施
- `scripts/build-detail-pages.mjs` に `imagePositionStyle()` を追加し、
  **アーティスト詳細（1346行）と会場詳細（1416行）の hero に付与**
- 同じ式が散っていた既存3箇所（フェス hero / 回遊カード2種）も同関数へ集約。
  直書きは定義の1箇所のみに
- `scripts/check_image_position.mjs` を新規追加。preflight「生成物とデータ」に組み込み
- 詳細ページ再生成（LP/artists/ LP/venues/ LP/festivals/ の JA・EN）
- `AUDIT_TECHNO_JAPAN.md` §9-83 に記録

### 原因
CMS には3種すべてに Image Position の入力欄があり、保存も data.js への
書き出しも一覧カードへの反映も正常だった。**詳細ページの hero に
`object-position` を出力する1行だけが、アーティストと会場で欠けていた。**
`.detail-hero img { object-fit: cover }` のため、指定が無いと必ず中央基準で切れる。

### コミット
（本エントリと同一コミット）

### 検証
**実ブラウザ（headless Chrome / 1440×1000）で計測。**

修正前:
```
WATA IGARASHI  CMS指定 center top → 実際 50% 50%（無視）
枠 860×573 / 原画 1440×1440 → 縦33%が切れ、上から17%（頭）が消失
```

修正後（4経路）:
```
アーティスト WATA IGARASHI  center top → 50% 0%  ✅ 切り落としは全て下側・上0%
アーティスト Acid Pauli     指定なし    → 50% 50% ✅
会場 UNIT                   center top → 50% 0%  ✅
英語版 WATA IGARASHI        center top → 50% 0%  ✅
```

ネガティブコントロール: アーティスト hero から `imagePositionStyle(a)` を外して
再生成 → **22件を検知して落ちた**（復旧後は緑）。

preflight: **全29件成功**（新検査を含む。28→29件）。

※ 修正後の初回計測で「上から17%切れている」と出たが、**計測式の誤り**だった。
　`parseFloat("0%")/100 || 0.5` が 0 を偽値として 0.5 に落としていた。
　式を直して再計測（AUDIT §9-83）。

### 変更したパターン
- アーティスト詳細 hero — `object-position` を新規付与（JA/EN 各96枚）
- 会場詳細 hero — 同上（JA/EN 各22枚）
- フェス詳細 hero / 回遊カード2種 — 出力は不変のまま共通関数へ集約
- preflight に「CMS の Image Position が届く」を追加（28→29件）

### 未確認の類似パターン
- **data.js で imagePosition を持つ全項目を検査済み・不一致0件**
  （アーティスト11 / 会場22 / フェス42 の画像あり項目、JA+EN 計150ページ）
- 一覧ハブ（artists / venues / festivals / index）は元から効いていた。**確認済み・0件**
- 記事（ARTICLES）に imagePosition の概念は無い。**該当なし**
- `heroGradient` など他の見た目系フィールドが同様に届いていないかは**未確認**

### 次の担当への注意・判断待ち
- `center` 以外を指定しているのはアーティスト1名（wata-igarashi）・会場1件（unit）・
  フェス6件のみ。**今後アーティスト写真を集める際、頭が切れたら
  CMS の Image Position に `top` を入れれば詳細ページにも効くようになった**
- ⚠️ **Publish 経路（cms.js）の §9-81 変更が依然として実機未確認。**
  CMS で Publish Now を1回押し、`cms: publish data.js` のコミットが
  増えることの確認が必要
- CMS 入力の積み残し: アーティスト54名（紹介文v2 + リンク）。
  ⚡Global Ark(8/21) の CHOKO / SUNGA / TSUTOMU が最優先
- ユーザー判断待ちのデータ課題: EDITIONS の `STATUS=published` 36行 /
  TICKETURL 未入力 20/104 / ID規約違反 `suze-ij`（正しくは `suze-ijo`）

---

## 2026-08-14 CMS のプレビューが実ページと違う見え方をしていた

### 実施
- `LP/cms.html` — アーティストの小プレビュー枠を `16/9` → `3/2`（実ページと同じ）。
  会場・フェスにも「実ページの枠と揃える」根拠コメントを追加
- `LP/cms.js` — `PV_HERO_RATIO` と `pvHeroStyle(prefix)` を追加し、
  「👁 Preview」の hero 3箇所すべてに適用（枠の比率＋CSS変数 `--pv-pos`）
- `LP/cms.css` — `.pv-hero-image img` に `object-position:var(--pv-pos,center)` を追加
- `scripts/check_cms_preview_frame.mjs` を新規追加。preflight「CMS」に組み込み
- `cms.css?v=26→27` / `cms.js?v=79→80`
- `AUDIT_TECHNO_JAPAN.md` §9-84 に記録

### 原因
CMS の位置確認は2箇所ある。両方とも実ページと食い違っていた。

1. **入力欄の下の小プレビュー** — 位置は反映していたが、
   アーティストの枠が `16:9`。実ページは `3:2`。正方形写真で
   **プレビューは44%切るのに実ページは33%。11%多く切って見せていた**
2. **「👁 Preview」全画面プレビュー** — `object-position` を一切出しておらず、
   `top` にしても**常に中央**で表示。枠もアーティスト `1:1` と実ページ `3:2` で別物

小プレビューが指定に反応するため、枠まで疑う理由が無かった。

### コミット
（本エントリと同一コミット）

### 検証
**実ブラウザ（headless Chrome）で計測。**
```
アーティスト  入力 "center top"    → 描画 50% 0%    枠 1.500 = 実ページ 1.500 ✅
会場         入力 "center bottom" → 描画 50% 100%  枠 1.778 = 実ページ 1.778 ✅
フェス        未指定               → 描画 50% 50%   枠 1.600 = 実ページ 1.600 ✅
```

ネガティブコントロール3経路とも検知:
```
小プレビューの枠を 16/9 に戻す     → ✅
全画面プレビューの枠を 1/1 に戻す  → ✅
CSS の object-position を消す     → ✅
```

preflight: **全30件成功**（29→30件）。`node --check LP/cms.js` も通過。

※ `cms.html` を丸ごと headless で開く検証は GAS 通信待ちで**2回とも5分でタイムアウト**した。
　`--virtual-time-budget` は保留中のネットワークを打ち切らない。
　**実物の cms.js から対象関数を正規表現で切り出し**、同じ CSS を読む最小ページで計測した。

### 変更したパターン
- 小プレビュー（img-pos-preview）— アーティストのみ枠を変更。会場・フェスは元から一致
- 全画面プレビュー（pv-hero-image）— 3種すべてに枠と位置指定を新規付与
- `.pv-hero-image img` の CSS に `object-position` を追加
- preflight に「プレビューが実ページと同じ枠」を追加（29→30件）

### 未確認の類似パターン
- **CMS 内の画像プレビューは上記2種で全部**（`img-pos-preview` 3件 /
  `pv-hero-image` 3件）。検査で全件突き合わせ済み・不一致0件
- 記事（ARTICLE）のプレビューに hero 画像の位置指定は無い。**該当なし**
- 一覧カードの見え方（ハブのカード枠）とプレビューの一致は**未確認**。
  カードは位置指定が元から効いており、枠は小さく影響が出にくいため今回は見送り
- ⚠️ **実ブラウザでの CMS 操作確認は未実施（実機未確認）。**
  関数単位では実測したが、**ログイン済みの CMS で
  アーティストを開き → Image Position を押し → 小プレビューと
  「👁 Preview」の両方が動くこと**は未確認

### 次の担当への注意・判断待ち
- ⚠️ **CMS を実際に開いての確認が2件たまっている（どちらも実機未確認）**
  1. 本件のプレビュー表示（アーティストを開いて `top` を押す）
  2. §9-81 の Publish Now（`cms: publish data.js` のコミットが増えるか）
  `cms.js?v=80` に上がっているので、**CMS を開く前にスーパーリロード**が要る
- CMS 入力の積み残し: アーティスト54名（紹介文v2 + リンク）。
  ⚡Global Ark(8/21) の CHOKO / SUNGA / TSUTOMU が最優先
- ユーザー判断待ちのデータ課題: EDITIONS の `STATUS=published` 36行 /
  TICKETURL 未入力 20/104 / ID規約違反 `suze-ij`（正しくは `suze-ijo`）
### NEWSアクセシビリティ・低モーション検証（2026-08-14）

#### 実施
- `/news.html` と `/en/news.html` を実ブラウザ相当のChrome検証で確認。
- 画面幅 1440×900、390×844 のPC・モバイル幅で、低モーション設定を有効化。
- 記事一覧、最初の記事リンクへのキーボードフォーカス、リンク遷移先、見出し、main要素、横方向のはみ出しを確認。

#### コミット
- 既存のNEWSレール実装・公開済みコードに対する検証のみ。追加変更なし、追加コミットなし。

#### 検証
- JA/ENとも記事表示4件、記事リンク8件、フォーカス取得成功、記事URL有効、h1/main存在、横スクロールなし。
- 低モーション設定でも表示・キーボード操作が維持されることを確認。
- `scripts/check_asset_versions.py` 成功。既存の `common.css` / `common.js` の複数バージョン警告以外にエラーなし。
- `git diff --check` 成功。

#### 変更したパターン
- なし（NEWSレールの表示・操作確認のみ）。

#### 未確認の類似パターン
- CMS編集画面の実ブラウザ操作は本検証の対象外。既存の未確認事項を維持。

#### 次の担当への注意・判断待ち
- NEWSのJA/EN、PC/モバイル、低モーション・キーボード操作は確認済み。
- 次は記事詳細ページの実ブラウザ確認、または別セクションのUI検証へ進められる。
### 記事詳細の読了プログレスバー視認性改善（2026-08-14）

#### 実施
- ユーザー確認で「進捗バーが見えづらい」と判明したため、`LP/article-fx.css` の読了プログレスバーを調整。
- 高さを2pxから3pxへ変更し、未読部分の背景濃度とアクセント色の軽い発光を追加。
- `ARTICLE_FX_CSS_VERSION` を4から5へ上げ、JA/ENの記事詳細ページを再生成。

#### コミット
- 作業完了後に、変更ファイルと本記録をまとめてコミット予定。

#### 検証
- JA/EN、PC/モバイル幅で記事本文・hero画像・記事内画像5点・横幅崩れなしを確認。
- `scripts/check_asset_versions.py` 成功。`article-fx.css` は全参照が `?v=5`。
- 既存警告として `common.css` / `common.js` の複数バージョン表示あり。今回の変更による警告ではない。
- ユーザー確認済みの本文・画像・スクロール演出は維持。

#### 変更したパターン
- 記事詳細の読了プログレスバー（JA/EN、全記事詳細ページ）。

#### 未確認の類似パターン
- 本番環境での視認性は未確認。ローカルでユーザーの再確認後に公開判断。

#### 次の担当への注意・判断待ち
- ローカルをスーパーリロードして、画面最上部の赤いバーが見やすくなったか確認する。
- 問題なければ、preflightと本番公開前の実ブラウザ確認へ進む。
### 記事詳細プログレスバーの重なり順修正（2026-08-14）

#### 実施
- Chrome相当の実ブラウザ確認で、バー要素は生成されているがヘッダーの背面に隠れていることを特定。
- `.fx-progress` の `z-index` を200から100001へ変更し、ヘッダー（100000）より前面に表示。
- `ARTICLE_FX_CSS_VERSION` を5から6へ更新し、JA/ENの記事詳細ページを再生成。

#### コミット
- 作業完了後に、CSS・生成ページ・本記録をまとめてコミット予定。

#### 検証
- ChromeのDOM確認で `.fx-progress` / `.fx-progress-fill` の生成を確認。
- 原因は「要素が無い」ではなく、ヘッダーの `z-index` による背面化と特定。
- 生成後の全記事ページで `article-fx.css?v=6` を参照。

#### 変更したパターン
- 記事詳細ページ上端の読了プログレスバー（JA/EN、全記事詳細ページ）。

#### 未確認の類似パターン
- 本番環境での表示は未確認。ローカルChromeでのスーパーリロード確認後に公開判断。

#### 次の担当への注意・判断待ち
- `Command + Shift + R` 後、ヘッダー最上部より前面に赤いバーが見えることを確認する。
- 問題なければ、preflightと本番公開前の実ブラウザ確認へ進む。

---

## 2026-08-14 ヘッダーのロゴを文字から画像へ（ロゴ完成版 第2弾）

### 実施
- `LP/images/logo-wordmark.png` を新規作成（474×39px = 表示 158×13px の3倍）
  原本 `6_TECHNO JAPAN@2x.png`（2726×224・白・透過）からの縮小のみ
- ヘッダーの `TECHNO JAPAN` を `<img>` に差し替え（**452ページ + 生成側1**）
  - `<a class="logo">` 形式 451件 / `<div class="logo">` 形式 2件（about JA・EN）
- `LP/common.css` に `nav .logo img { height:13px; width:auto }` を追加。
  `nav .logo` を `display:flex; align-items:center` に
- **`common.css` の版が2箇所でずれていた**（詳細ページ v5 / ハブ v6）ため
  `COMMON_CSS_VERSION = 7` に統一 → 452枚すべて v7
- `scripts/check_header_logo.mjs` を新規追加。preflight「生成物とデータ」に組み込み
- `AUDIT_TECHNO_JAPAN.md` §9-85 に記録

### 設計の根拠（サイズの決め方）
原本は 12.17:1 の横長。高さを揃えると幅が出すぎるため、**内部の文字の
大きさ**を基準にした（原本の文字高 160px / 全体 224px）。
現在の文字ロゴ 114×16px（字面 約8px）に対し、**158×13px** で字面がほぼ同じ。

幅の上限は狭い画面の実測から決めた:
```
PC(1440px)       右のメニューまで 550px
タブレット(900px)  右のメニューまで  42px  ← ここが制約
```
検査の上限を 190px に設定。**PC だけ見ると衝突に気づけない。**

### コミット
（本エントリと同一コミット）

### 検証
**実ブラウザ（headless Chrome）で 5ページ × 3画面幅 = 15経路。**
```
トップ / アーティスト詳細 / フェス一覧 / 英語トップ / ABOUT
× PC(1440) / タブレット(900) / スマホ(390)

全15経路: 表示 158x13px・画像読み込み成功・画面外へのはみ出し無し
          メニューとの間隔 PC 547〜644px / タブレット 39〜136px
```

ネガティブコントロール4経路とも検知:
```
1ページだけ文字に戻す       → ✅
width/height 属性を消す     → ✅
ロゴを広げすぎる(158→240px) → ✅
CSS の width:auto を消す    → ✅
```

preflight: **全31件成功**（30→31件）。

### 変更したパターン
- ヘッダーのロゴ 452ページ（`<a class="logo">` 451 / `<div class="logo">` 2、うち about JA/EN）
- `nav .logo` / `nav .logo img` の CSS
- `common.css?v` を 5・6 の混在から 7 に統一（452枚）
- preflight に「ヘッダーのロゴ」を追加（30→31件）

### 未確認の類似パターン
- **フッターの `TECHNO JAPAN`（`footer-logo`）は文字のまま**。451ページ。
  今回の指示は「サイト上部」のみのため意図的に対象外。**要判断**
- CMS のサイドバー `sidebar-logo` も文字のまま。管理画面なので対象外
- **`common.js` の版も v3/v4 でずれている**（`check_asset_versions.py` が
  警告を出し続けている）。common.css と同じ構造の問題。**未着手**
- 印刷用スタイル・OGP 画像でのロゴ利用は**該当なし**

### 次の担当への注意・判断待ち
- ⚠️ **ロゴ原本はラスタ（PNG）で、最大 2726×224。** ベクター（SVG）があれば
  差し替えたい。実使用は 512px 以下なので**現状で支障は無い**
- **フッターのロゴも画像にするか要判断**（今回は上部のみ）
- **SNS シェア画像が全ハブで Rainbow Disco Club の写真のまま。**
  ロゴが揃った今、専用の 1200×630 を作る好機。**利用者へ提案済み・返答待ち**
- CMS 入力の積み残し: アーティスト54名（紹介文v2 + リンク）
- ユーザー判断待ちのデータ課題: EDITIONS の `STATUS=published` 36行 /
  TICKETURL 未入力 20/104 / ID規約違反 `suze-ij`（正しくは `suze-ijo`）

---

## 2026-08-14 フッターのロゴ画像化 ＋ SNS シェア画像を専用画像へ

### 実施
**① SNS シェア画像（AUDIT §9-86）**
- `LP/images/og-default.png`（1200×630・利用者提供）を新規設置
- `build-detail-pages.mjs` の `DEFAULT_OG` を差し替え（詳細ページ266枚）
- ハブ15枚は HTML べた書きのため直接置換（og:image + twitter:image 計30件）
- **RDC 自身のページ2枚は変更せず**（本来の画像として正しい）
- `ORG_LOGO` に `?v=2` を付与
- `scripts/check_og_image.mjs` を新規追加。preflight に組み込み

**② フッターのロゴ（AUDIT §9-87）**
- `<div class="footer-logo">TECHNO JAPAN</div>` を画像に差し替え
  （**451ページ + 生成側1 = 452件**）
- ヘッダーと違い `loading="lazy"` を付与（画面下のため）
- `LP/common.css` に `.footer-logo img { height:13px; width:auto }`
- `check_header_logo.mjs` をフッターにも拡張
- `COMMON_CSS_VERSION` 7 → 8（452枚すべて v8）

### 原因（SNS 画像）
自前の写真を持たないページ283枚の既定 `og:image` が
`images/festivals/rainbow-disco-club.webp` だった。
**トップページを SNS で共有すると他社フェスの写真がカードに出ていた。**
`og:image` はページを開いても表示されないため、**サイトを何度見ても
気づけない**。仮置きの画像がそのまま既定として283ページに配られていた。

### コミット
（本エントリと同一コミット）

### 検証
**実ブラウザ（headless Chrome）4ページ × 3画面幅 = 12経路**
```
トップ / アーティスト詳細 / 英語トップ / ABOUT × PC(1440)/タブレット(900)/スマホ(390)
全12経路: ヘッダー 158x13 / フッター 158x13・画像読込成功・はみ出し無し
フッターとリンク群の間隔: PC 133〜179px、900px 以下は縦積み（衝突なし）
```
フッターのみを描画したスクリーンショットで見た目も確認。

ネガティブコントロール **6経路すべて検知**:
```
[フッター] 1ページだけ文字に戻す / loading=lazy を消す / CSS を消す  → ✅✅✅
[SNS画像] 既定をフェス写真に戻す / og:image を消す / twitter:image だけ変える → ✅✅✅
```

preflight: **全32件成功**（31→32件）。

### 変更したパターン
- フッターのロゴ 451ページ（`<div class="footer-logo">`）
- `og:image` / `twitter:image` の既定 281ページ（詳細266 + ハブ15）
- `.footer-logo` / `.footer-logo img` の CSS
- `common.css?v` 7 → 8（452枚）
- preflight に「SNS シェア画像」を追加、「ヘッダーのロゴ」を
  「ヘッダー・フッターのロゴ」に拡張（31→32件）

### 未確認の類似パターン
- **サイト内のロゴ表示箇所はヘッダー・フッターで全部**。両方とも画像化済み。
  CMS のサイドバー `sidebar-logo` は管理画面なので対象外（文字のまま）
- **og:image を持つ451ページすべてを検査済み・不整合0件**
  （og と twitter の食い違い0 / 参照先の欠落0）
- **`common.js` の版が v3/v4 でずれたまま**。`check_asset_versions.py` が
  警告を出し続けている。common.css と同じ構造の問題。**未着手**
- OGP の `og:image:width` / `og:image:height` の宣言有無は**未確認**
  （無くても表示はされるが、初回表示が速くなる）

### 次の担当への注意・判断待ち
- ⚠️ **ロゴ原本はラスタ（PNG）のまま。** ヘッダー／フッター用 `logo-wordmark.png`
  は原本 2726×224 からの縮小で作っており、これ以上大きくはできない。
  SVG があれば差し替えたいが、**現状の用途では支障なし**
- **`common.js` の版ずれ（v3/v4）が未解決。** 今回 common.css は統一したが、
  common.js は手つかず。同じ直し方（生成側の定数と HTML を揃える）で直せる
- CMS 入力の積み残し: アーティスト54名（紹介文v2 + リンク）
- ユーザー判断待ちのデータ課題: EDITIONS の `STATUS=published` 36行 /
  TICKETURL 未入力 20/104 / ID規約違反 `suze-ij`（正しくは `suze-ijo`）

---

## 2026-08-14 common.js の版統一 ／ ID規約違反の移行表 ／ SVG は不採用

### 実施
**① common.js の版ずれを統一（AUDIT §9-88）**
- `COMMON_JS_VERSION` 3 → 4、生成済み HTML 436枚も v4 に。**452枚すべて v4**
- `check_asset_versions.py` に「生成側の定数と HTML のずれ」を**失敗**として追加
  （※既存の「混在」検査は警告のまま。detail.css の意図的分割 §9-35 を壊さないため）

**② ID規約違反 `suze-ij` の移行表を追加**
- `ARTIST_ID_FIXES` に `'suze-ij': 'suze-ijo'` を追加（`build-detail-pages.mjs`）
- **シート未変更のため、現時点では何も起きない**。`redirectStubs` が
  「旧IDが data.js から消え、新IDが登場してから」しかスタブを出さない設計のため、
  先に入れておいて安全

**③ 受領した SVG は不採用（AUDIT §9-89）**
- `名称未設定のデザイン.svg` は中身が 799×417 の PNG 埋め込みで、ベクターではなかった
- **アセットは差し替えていない**（品質が上がらず、描画が重くなるだけのため）

### コミット
（本エントリと同一コミット）

### 検証
```
common.js の版: 直す前 v3=436 / v4=16  →  直した後 v4=452
```
ネガティブコントロール:
```
ハブ1枚だけ版を戻す（今回の事故の形）→ ✅ 検知
定数だけ上げて HTML を放置          → ✅ 検知
detail.css の意図的な混在           → 警告のみ・失敗にしない ✅
```
SVG の判定: `<image>` を除去して描画 → 白い画素 **0.00%**（絵が完全に消えた）

preflight: **全32件成功**。

### 変更したパターン
- `common.js?v` 3/4 の混在 → 452枚すべて v4
- `check_asset_versions.py` に定数ずれ検査を追加（定数を持つ5アセットが対象:
  common.css / common.js / lang-toggle.js / article-fx.css / article-fx.js）
- `ARTIST_ID_FIXES` に1件追加

### 未確認の類似パターン
- **定数を持つ5アセットは全て一致を確認済み・ずれ0件**
- `detail.css` は定数を持たないため対象外（意図的な v3/v4 分割・§9-35）。**変更なし**
- 画像アセット（favicon 等）の `?v` は今回の検査対象外。
  生成側の定数を持たず HTML べた書きのため。**未確認だが現状は全て v=2 で一致**

### 次の担当への注意・判断待ち
- ⚠️ **`suze-ij` はシート側の変更待ち。利用者が手動で対応予定。**
  変更が必要なのは2箇所:
  1. `ARTISTS` シートの `ID`： `suze-ij` → `suze-ijo`
  2. `LINEUPS` シートの `ARTIST_ID`：1行（`EDITION_ID=rainbow-disco-club-2026`,
     `SET_TYPE=dj`, `SORT=18`）を `suze-ijo` に
  この2つを直して **Publish Now → 次のビルド**で、
  `/artists/suze-ij.html` から新URLへのリダイレクトが自動生成される
- ⚠️ **EDITIONS の STATUS 36行も利用者が手動対応予定**
  （`published` は規約外。正しくは announced / on-sale / soldout / finished / cancelled）
- **ロゴのベクター版は引き続き無し。** 実使用は最大512pxなので支障なし。
  Illustrator 等から真のアウトライン SVG が出せれば差し替え価値あり
- CMS 入力の積み残し: アーティスト96名中、紹介文79・写真79・リンク79が未入力
- チケットURL 未入力 86/106
### PCヘッダー追従のChrome再検証と固定強制（2026-08-14）

#### 実施
- 別作業の完了後、作業ツリーがクリーンであることを確認。
- Chromeで記事ページをスクロールし、`nav` の実測位置を確認。
- CSSルールは `position: fixed` だが実測値が `relative` になる経路があったため、PCメディアクエリ内で `position/top/left/right: !important` を付与。
- `COMMON_CSS_VERSION` を8から9へ更新し、生成ページへ反映する準備をした。

#### コミット
- 作業完了後に、共通CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- 修正前のChrome実測: スクロール後 `nav` のtopが負数となり、ヘッダーが画面外へ移動。
- 修正後はキャッシュバージョン更新と再生成後に、同じChrome実測を再実施する。

#### 変更したパターン
- PC幅（901px以上）の共通ナビゲーション固定位置。

#### 未確認の類似パターン
- モバイル幅（900px以下）は今回の固定位置強制の対象外。既存挙動を別途確認する。

#### 次の担当への注意・判断待ち
- 再生成後、JA/ENの記事詳細をPC幅でスクロールし、ヘッダーのtopが0付近で維持されることを確認する。
- その後、preflightと本番公開前の実ブラウザ確認へ進む。
### PCヘッダー追従の再生成・検証完了（2026-08-14）

#### 実施
- `COMMON_CSS_VERSION=9` を全HTMLへ反映し、詳細ページ・ハブページの参照を統一。
- PC（1440×900）のChromeで記事詳細を開き、`nav` の計算値を確認。

#### コミット
- 共通CSS・生成スクリプト・生成済み詳細ページ・ハブページ・本記録を同一コミットにまとめる。

#### 検証
- Chrome実測: `position: fixed`、スクロール前後の `nav.getBoundingClientRect().top` は0、PC用背景も表示。
- `scripts/check_asset_versions.py`: 成功。common.cssのv8/v9混在なし。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 生成物、回帰、内部リンク、構造化データ、CSS/JS参照、CMS/GAS検査を通過。

#### 変更したパターン
- PC幅（901px以上）の全ページ共通ヘッダー固定・背景表示。
- JA/ENのハブおよび詳細ページのcommon.cssキャッシュバージョン。

#### 未確認の類似パターン
- モバイル幅（900px以下）のヘッダーは今回のPC固定強制の対象外。既存挙動を維持。
- 本番デプロイ後の実ブラウザ確認は未実施。

#### 次の担当への注意・判断待ち
- 本番公開前に、PC記事詳細のスクロール追従とモバイル表示を実環境で確認する。
- ユーザー確認後にのみデプロイする。
### PCヘッダーの記事貫通修正（2026-08-14）

#### 実施
- Chromeで、記事画像・文字が固定ヘッダーの前面に表示される問題を確認。
- 原因は共通レイヤー指定 `body > nav, ... { z-index: 1; }` が、後段でヘッダーの重なり順を上書きしていたこと。
- PCヘッダーの `z-index` を `100000 !important` にして、記事コンテンツより前面に固定。
- `COMMON_CSS_VERSION` を9から10へ更新。

#### コミット
- 作業完了後に、共通CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- 修正前: `nav`の重なり順が1となり、記事がヘッダーを貫通。
- 修正後はキャッシュ更新・再生成後にPC幅Chromeで、記事がヘッダー下を通ることを確認する。

#### 変更したパターン
- PC幅（901px以上）の共通ヘッダーの固定位置と重なり順。

#### 未確認の類似パターン
- モバイル幅（900px以下）のヘッダーは今回の対象外。
- 本番環境での最終表示は未確認。

#### 次の担当への注意・判断待ち
- 再生成後、PC記事詳細でヘッダーの背景が不透明に見え、記事が貫通しないことを確認する。
- ユーザー確認後にのみ本番デプロイする。
### PCヘッダー貫通修正のChrome検証結果（2026-08-14）

#### 実施
- `common.css?v=10` を詳細ページ・ハブページへ反映。
- PC幅1440pxのChromeで記事詳細を再読み込みし、ヘッダーの固定位置と重なり順を確認。

#### コミット
- 作業完了後に、共通CSS・生成スクリプト・全生成ページ・ハブページ・本記録をコミット予定。

#### 検証
- `nav`: `position: fixed`、`top: 0`、`z-index: 100000`。
- ヘッダー背景: `rgba(8, 8, 8, 0.82)` を確認。
- 記事コンテンツがヘッダーより前面に出る原因を解消。

#### 変更したパターン
- PC幅（901px以上）の記事詳細ヘッダーの固定位置・重なり順。
- 全HTMLのcommon.cssキャッシュバージョン v9→v10。

#### 未確認の類似パターン
- モバイル幅（900px以下）は今回の修正対象外。
- 本番デプロイ後の実ブラウザ表示は未確認。

#### 次の担当への注意・判断待ち
- ユーザーがローカルでPC記事ページをスーパーリロードし、画像・本文がヘッダーを貫通しないことを確認する。
- 確認後にpreflight再実行と本番公開判断へ進む。
### 読了プログレスバーを固定ヘッダー直下へ移動（2026-08-14）

#### 実施
- 読了プログレスバーを画面最上端から固定ヘッダー直下へ移動。
- 高さを3pxから2pxへ変更。
- PCはヘッダー高さ69px、モバイルは53pxとして位置を分け、safe-areaにも対応。
- `ARTICLE_FX_CSS_VERSION` を6から7へ更新。

#### コミット
- 作業完了後に、CSS・生成スクリプト・生成済み記事ページ・本記録をコミット予定。

#### 検証
- 再生成後、PC・モバイルのChromeでバー位置と高さを確認する。
- 既存のヘッダー固定・記事貫通防止を維持する。

#### 変更したパターン
- 記事詳細ページの読了プログレスバー（JA/EN、PC/モバイル）。

#### 未確認の類似パターン
- 本番環境での表示は未確認。

#### 次の担当への注意・判断待ち
- ローカルでスーパーリロード後、ヘッダー直下に2pxのバーが表示されることをユーザー確認する。
- 問題なければ本番公開前検証へ進む。
### 進捗バー位置の最終Chrome検証（2026-08-14）

#### 実施
- `article-fx.css?v=8` をJA/ENの記事詳細ページへ反映。
- PC幅1440pxのChromeで記事ページを確認。

#### コミット
- 作業完了後に、生成済み8記事ページと本記録をコミット予定。

#### 検証
- `nav`: `position: fixed`、`top: 0`、`z-index: 100000`。
- `.fx-progress`: `position: fixed`、画面上端から69px、height 2px。
- 共通レイヤー指定による位置ずれが解消され、ヘッダー直下に固定されることを確認。

#### 変更したパターン
- 記事詳細の読了プログレスバー（PC: ヘッダー直下69px / 2px）。

#### 未確認の類似パターン
- モバイル幅の実Chrome確認は未実施。
- 本番環境での表示は未確認。

#### 次の担当への注意・判断待ち
- ローカルでユーザーが表示確認後、本番公開前検証へ進む。
### モバイルヘッダーの追従修正（2026-08-14）

#### 実施
- Chromeの390×844確認で、スマホのロゴが記事と一緒にスクロールすることを確認。
- 共通レイヤー指定でモバイル`nav`が`position: relative`になっていたため、901px未満でも`position: fixed`と`z-index: 100000`を強制。
- `COMMON_CSS_VERSION` を10から11へ更新。

#### コミット
- 作業完了後に、共通CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- 修正前のモバイル: `nav` position relative、ロゴがスクロール。
- 修正後はJA/ENのモバイル記事ページで、ロゴ・ナビ・進捗バーの固定を確認する。

#### 変更したパターン
- 901px未満の共通モバイルヘッダー固定。

#### 未確認の類似パターン
- 本番環境でのモバイル表示は未確認。

#### 次の担当への注意・判断待ち
- ローカルでスーパーリロード後、スマホ幅でロゴが画面上部に残ることを確認する。
- ユーザー確認後に本番公開前検証へ進む。
### モバイルヘッダー追従のChrome検証完了（2026-08-14）

#### 実施
- `common.css?v=11` を全HTMLへ反映。
- モバイル幅390×844のChromeでJA記事詳細を確認。

#### コミット
- 作業完了後に、生成ページ・ハブページ・本記録をコミット予定。

#### 検証
- `nav`: `position: fixed`、`top: 0`、`z-index: 100000`。
- スクロール後も`nav`のtopは0、ロゴが画面上部に残ることを確認。
- 進捗バーはヘッダー直下53px、height 2px。
- 横スクロールなし。

#### 変更したパターン
- 901px未満のモバイル共通ヘッダー固定。
- 全HTMLのcommon.cssキャッシュバージョン v10→v11。

#### 未確認の類似パターン
- 本番環境でのモバイル表示は未確認。

#### 次の担当への注意・判断待ち
- ユーザーがローカルでスマホ幅を確認後、本番公開前検証へ進む。
### モバイルヘッダーの透明→半透明切替（2026-08-14）

#### 実施
- モバイルのスクロール量が24px以下では透明、24px超で半透明黒＋ぼかし＋下線へ切り替える処理を追加。
- `COMMON_JS_VERSION` を4から5、`COMMON_CSS_VERSION` を11から12へ更新。
- PCの固定ヘッダー挙動は変更しない。

#### コミット
- 作業完了後に、common.js/css・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- 追加後、モバイルChromeで最上部とスクロール後のヘッダー表示を確認する。
- ロゴの固定、進捗バー位置、横スクロールなしを維持する。

#### 変更したパターン
- 901px未満のモバイルヘッダー背景状態。

#### 未確認の類似パターン
- 本番環境での切替表示は未確認。

#### 次の担当への注意・判断待ち
- ローカルで最上部は透明、下スクロール後は半透明になることをユーザー確認する。
- 問題なければ最終回帰テストへ進む。
### モバイル透明→半透明ヘッダーの反映（2026-08-14）

#### 実施
- モバイルヘッダーにスクロール状態クラスと直接スタイル適用を追加。
- 最上部は透明、24px超のスクロールで半透明黒・ぼかし・下線へ切替。
- `COMMON_JS_VERSION` を5から6へ更新し、生成ページを再生成。

#### コミット
- 作業完了後に、生成ページ・ハブページ・本記録をコミット予定。

#### 検証
- Chrome 500px幅で、スクロール状態クラス `nav-scrolled`、固定ヘッダー、進捗バー53px/2px、横スクロールなしを確認。
- 通常のユーザーChromeではスーパーリロード後に透明→半透明の見た目を確認する。

#### 変更したパターン
- 901px未満のモバイルヘッダーの背景状態。
- 全HTMLのcommon.jsキャッシュバージョン v5→v6。

#### 未確認の類似パターン
- 本番環境での切替表示は未確認。

#### 次の担当への注意・判断待ち
- ユーザーがスマホ幅で、最上部は透明・スクロール後は半透明になることを確認する。
- 問題なければ最終回帰テストと本番公開判断へ進む。
### 本番デプロイ完了：モバイル透明→半透明ヘッダー（2026-08-14）

#### 実施
- 最終ブラウザ確認後、`main`へpushして本番公開。
- PC/モバイルの固定ヘッダー、記事貫通防止、ヘッダー直下2px進捗バー、モバイル透明→半透明切替を公開。

#### コミット
- デプロイ対象: `e14b379b`
- GitHub Pages Deploy run: `31792485091` — success

#### 検証
- preflight: 全32件成功。
- ユーザーによるローカル最終確認: 問題なし。
- 本番URL JA/EN記事とNEWS: HTTP 200。
- 本番記事: `common.css?v=12`, `common.js?v=6`, `article-fx.css?v=8` を確認。

#### 変更したパターン
- PC/モバイル固定ヘッダー。
- モバイル透明→半透明ヘッダー。
- ヘッダー直下の読了プログレスバー。

#### 未確認の類似パターン
- CMS実機操作とGAS再デプロイは今回のUI変更対象外で未確認。

#### 次の担当への注意・判断待ち
- 本番の実機Chrome/Safariで、キャッシュ更新後の見え方を必要に応じて確認。
- 次のUI変更時は、既存のヘッダー固定・進捗バー位置・モバイル切替を回帰確認する。
### FESTIVAL関連記事カードのレイアウト修正（2026-08-14）

#### 実施
- 本番確認で、フェス詳細のRELATED STORIES画像が120px固定のままになり、広いカード内で極端に細く表示される問題を確認。
- フェス詳細v2では、画像を左32%・記事情報を右68%の2カラムに変更。
- モバイルでは画像を上、記事情報を下にする縦積みへ変更。
- `DETAIL_CSS_VERSION` を8から9へ更新。

#### コミット
- 作業完了後に、詳細CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- ローカルChromeでPC・モバイルのRELATED STORIESカードを確認する。
- 既存のフェス関連カード、記事リンク、横幅崩れがないことを確認する。

#### 変更したパターン
- FESTIVAL詳細ページのRELATED STORIES（PC 2カラム / モバイル縦積み）。

#### 未確認の類似パターン
- 本番反映後の関連記事カードは未確認。

#### 次の担当への注意・判断待ち
- ローカル確認後、preflightを通してから本番公開する。
### FESTIVAL関連記事カードのモバイル上書き修正（2026-08-14）

#### 実施
- Chrome 500px幅で、先行修正後もフェス専用CSSが関連記事カードを2カラムに戻していることを確認。
- フェス専用の`@media (max-width: 900px)`内で、関連記事を1カラム・画像16:9へ明示。
- `DETAIL_CSS_VERSION` を9から10へ更新。

#### コミット
- 作業完了後に、詳細CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- 修正後にPC/スマホ幅の関連記事カードを再確認する。

#### 変更したパターン
- FESTIVAL詳細のRELATED STORIESモバイルカード。

#### 未確認の類似パターン
- 本番反映後のカード表示は未確認。

#### 次の担当への注意・判断待ち
- モバイルで画像が上、記事情報が下になることを確認してから公開する。
### FESTIVAL関連記事カードのPC/モバイル検証完了（2026-08-14）

#### 実施
- フェス詳細 `bondisco.html` をChromeでPC 1440px・モバイル500pxで確認。

#### コミット
- 作業完了後に、生成済み詳細ページと本記録をコミット予定。

#### 検証
- PC: `grid-template-columns: 419px 859px`、画像幅419px、横スクロールなし。
- モバイル: 1カラム、画像幅402px、横スクロールなし。
- 関連記事カードの画像と記事情報が、PCでは左右、モバイルでは上下に正しく配置。

#### 変更したパターン
- FESTIVAL詳細 RELATED STORIES（PC/モバイル）。

#### 未確認の類似パターン
- 本番デプロイ後のカード表示は未確認。

#### 次の担当への注意・判断待ち
- preflightと最終本番公開前確認後に、公開判断する。
### ラインナップなしフェスのフライヤー左寄せ（2026-08-14）

#### 実施
- ラインナップが存在しないフェス詳細に `flyer-only` クラスを付与。
- PCではフライヤーを左寄せ、最大幅520pxに制限。
- ラインナップありのフェスとモバイル表示は既存レイアウトを維持。
- `DETAIL_CSS_VERSION` を10から11へ更新。

#### コミット
- 作業完了後に、生成スクリプト・詳細CSS・生成ページ・本記録をコミット予定。

#### 検証
- ラインナップなし対象ページをPC・モバイルChromeで確認する。
- フライヤーの左寄せ、画像の崩れ、横スクロールなしを確認する。

#### 変更したパターン
- FESTIVAL詳細のラインナップなし・フライヤーのみ状態。

#### 未確認の類似パターン
- 本番反映後のフライヤーのみ状態は未確認。

#### 次の担当への注意・判断待ち
- ローカル確認後、preflightと本番公開前確認へ進む。
### フライヤーのみフェスのPC検証完了（2026-08-14）

#### 実施
- `forest-sound-camp.html` をPC幅1440pxのChromeで確認。

#### コミット
- 作業完了後に、生成ページと本記録をコミット予定。

#### 検証
- `flyer-only` クラスを確認。
- フライヤー幅520px、左端48pxで左寄せ表示。
- 横スクロールなし。

#### 変更したパターン
- ラインナップなし・フライヤーのみのFESTIVAL詳細。

#### 未確認の類似パターン
- 本番デプロイ後の表示は未確認。

#### 次の担当への注意・判断待ち
- モバイル幅でも既存の全幅表示が維持されることを確認後、preflight・公開判断へ進む。
### モバイルのFLYER上余白を縮小（2026-08-14）

#### 実施
- ユーザー確認で、スマホのフェス詳細におけるFLYERセクション上の余白が大きいと判明。
- モバイルのみ `.festival-program-section` の上余白を52pxから28pxへ縮小。
- PCの余白とフライヤー左寄せは変更しない。
- `DETAIL_CSS_VERSION` を11から12へ更新。

#### コミット
- 作業完了後に、詳細CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- モバイルのフライヤー上余白と、PCの左寄せ表示を確認する。

#### 変更したパターン
- FESTIVAL詳細のモバイルFLYERセクション上余白。

#### 未確認の類似パターン
- 本番反映後の余白は未確認。

#### 次の担当への注意・判断待ち
- ローカル確認後、preflightと本番公開前確認へ進む。
### モバイルFLYER上余白の追加縮小（2026-08-14）

#### 実施
- ユーザー確認で、InstagramからFLYER見出しまでの余白がまだ大きいと判明。
- モバイルの`festival-program-section`上余白を28pxから8pxへ縮小。
- PCレイアウトは変更しない。
- `DETAIL_CSS_VERSION` を12から13へ更新。

#### コミット
- 作業完了後に、詳細CSS・生成スクリプト・生成ページ・本記録をコミット予定。

#### 検証
- モバイルのInstagram〜FLYER間隔と、PCのフライヤー左寄せを確認する。

#### 変更したパターン
- FESTIVAL詳細のモバイルFLYERセクション上余白。

#### 未確認の類似パターン
- 本番反映後の余白は未確認。

#### 次の担当への注意・判断待ち
- ローカル確認後、preflightと本番公開前確認へ進む。
### TOP STORIESのPC/モバイル検証（2026-08-14）

#### 実施
- TOPのSTORIESをJA/EN、PC1440px・モバイル390pxでChrome相当検証。

#### コミット
- UI変更なし。検証記録のみコミット予定。

#### 検証
- featured 1件 + side 3件、合計4記事を表示。
- JA/ENとも記事リンク4件が各言語の静的詳細ページを指すことを確認。
- PC/モバイルとも横スクロールなし。

#### 変更したパターン
- TOP STORIESの4記事表示・記事リンク。

#### 未確認の類似パターン
- 記事5本以上になった場合のMORE STORIES展開は未確認（現在4本のため対象外）。

#### 次の担当への注意・判断待ち
- TOP STORIESは現状維持で問題なし。記事数が5本以上になった時にMORE STORIESを再確認する。

### 写真の初期表示明度とRELATED FESTIVALSホバー改善（2026-08-15）

#### 実施
- TOP、STORIES、FESTIVALS一覧の写真を、初期状態から見やすい明るさへ調整。
- Festival詳細のメイン写真・関連記事写真も同じ基準へ調整。
- Festival詳細のRELATED FESTIVALSに、ホバー時の拡大・明度/彩度変化・浮き上がり・アクセントカラー変化を追加。

#### コミット
- 本エントリとUI変更を同一コミットに含める予定。
- 本番デプロイは未実施。

#### 検証
- Festival詳細 `/festivals/arch.html` をPCで確認し、RELATED FESTIVALSのホバー演出を確認済み。
- 同ページをモバイル幅で確認し、1列表示・画像・リンク・横スクロールなしを確認済み。
- `python3 scripts/check_regressions.py` 成功。
- `python3 scripts/check_internal_links.py` 成功。

#### 変更したパターン
- TOPのSTORIES/FESTIVAL写真、STORIES一覧・記事写真、FESTIVALS一覧写真。
- Festival詳細のメイン写真、RELATED FESTIVALS、記事詳細の関連Festival。

#### 未確認の類似パターン
- 本番デプロイ後のPC/モバイル表示は未確認。
- `prefers-reduced-motion` 環境でのホバー表示は未確認。

#### 次の担当への注意・判断待ち
- 本番へ反映する場合は、詳細CSSのキャッシュ更新を考慮して公開前ブラウザ確認を行う。

### モバイル記事詳細・固定メニューの再修正（2026-08-15）

#### 実施
- 記事詳細モバイルのALL STORIES上余白を縮小し、タップ領域を35px確保。
- 共通の背景重ね合わせルールがnav-overlayの`position:fixed`を`relative`へ上書きしていたため、固定指定を強制。
- メニューを現在のビューポート全体へ固定し、背景スクロールを停止。
- 固定ヘッダーをメニューより背面に置き、メニュー内の重複BACKボタンを非表示化。
- 共通CSS/JS・詳細CSSのキャッシュ番号を更新し、JA/EN全生成ページを同期。

#### コミット
- ローカル検証済み。ユーザー確認後にコミット・公開予定。

#### 検証
- Chrome DevTools相当、390×844で`/articles/bondisco-2026-info.html`を実測。
- ページを`scrollY=1200`まで移動してメニューを開いた結果、overlayは`top:0 / left:0 / 390×844 / position:fixed / z-index:100001`。
- ヘッダーは`position:fixed / z-index:100000`、HTML/bodyのoverflowはhiddenとなり、背景スクロール停止を確認。
- 初期位置のALL STORIESは`top:88 / bottom:123`、ヘッダー下端54px、ヒーロー画像開始143pxで確認。
- キャッシュバージョン、回帰、内部リンクの各チェック成功。

#### 変更したパターン
- モバイル記事詳細のALL STORIES、全ページ共通モバイルメニュー、全詳細ページのアセット参照番号。

#### 未確認の類似パターン
- ユーザー端末のSafari実機表示は未確認。

#### 次の担当への注意・判断待ち
- ユーザーがモバイルSafariで記事中ほどからメニューを開き、表示位置とALL STORIESの余白を確認後、preflight・公開へ進む。

### メニュー下部閉じるボタンとPC ALL STORIES位置調整（2026-08-15）

#### 実施
- モバイルメニュー下部にも44pxの閉じる×ボタンを追加。
- PC記事詳細のALL STORIESをヒーロー画像の左端へ整列。
- 既存の上部×、固定メニュー、背景スクロール停止は維持。

#### コミット
- ローカル検証済み。ユーザー確認後に公開予定。

#### 検証
- Chrome相当の1440×900でALL STORIES左端170px、ヒーロー左端170pxを確認。
- Chrome相当の390×844で、スクロール途中のメニューを確認。
- overlayは`top:0 / 390×844 / position:fixed / z-index:100001`。
- 下部×は`top:788px / 44×44px`、HTML/bodyのoverflow hiddenを確認。
- キャッシュ番号・回帰・内部リンクは前項のチェックで成功。

#### 変更したパターン
- モバイルメニューの上下閉じるボタン、PC記事詳細のALL STORIES位置。

#### 未確認の類似パターン
- ユーザー端末のSafari実機での下部×タップは未確認。

#### 次の担当への注意・判断待ち
- ユーザーがスマホとPCで最終確認後、本番反映へ進む。

---

## 2026-08-15 モバイル監査の指摘6件を修正（AUDIT §9-90）

### 実施
1. **`build-image-derivatives.py` の対象を4種に拡張**（festivals のみ → festivals /
   artists / venues / articles）。169枚 × 2サイズ = 338枚を生成
2. **詳細ページの hero に srcset を適用**（フェス / アーティスト / 会場 / 記事の4箇所）。
   `srcsetAttr(source, sizes)` に共通化し、`cardSrcsetAttr` / `heroSrcsetAttr` /
   `flyerSrcsetAttr` を薄いラッパに
3. **フライヤーにも srcset を適用**（hero を直した直後の再計測で最大重量だと判明）
4. **ロゴの当たり判定を 13px → 44px**（`padding` で広げ負の `margin` で相殺）
5. **`map.html` に h1 / canonical / hreflang を追加**（他477枚には全て有り）
6. **`eventAttendanceMode` を全 subEvent に追加**（105/105）
7. `scripts/check_image_delivery.mjs` を新規追加。`check_header_logo.mjs` に
   タップ領域、`check_og_image.mjs` に単体ページの基本タグ検査を追加

### コミット
（本エントリと同一コミット）

### 検証
**実ブラウザ（headless Chrome / 390×844）でページ重量を実測。**
```
フェス詳細  1,448KB → 717KB  (−51%)
記事          501KB → 209KB  (−58%)
アーティスト詳細        → 133KB
会場詳細              → 160KB
```
**ロゴのタップ領域は変更前後を4指標で比較し、全て同一を確認**（幅390/1440）:
```
ロゴ画像の上端 20/32px・左端 24/40px・ヘッダー高 54/78px・メニュー上端 0/28px
→ 変更前と完全一致。見た目は1pxも動かず、当たり判定のみ 13px→44px
```
構造化データ: subEvent 105件の startDate / location / eventStatus /
eventAttendanceMode がいずれも **105/105（100%）**。

ネガティブコントロール **7経路すべて検知**:
```
hero から srcset を外す / フライヤーから srcset を外す /
派生の対応表から artists を削除 / 余白を削る / margin の相殺を崩す /
h1 を div に戻す / canonical を消す
```
※「派生の対応表から artists を削除」は初回、**定数だけ変えて再生成しておらず
　検査対象の状態が変わっていなかった**ため見逃しに見えた。対応表そのものを
　書き換えて測り直し、検知を確認（§9-82 と同じ形の失敗）。

preflight: **全33件成功**（32→33件）。

### 変更したパターン
- 派生画像の生成対象 1種 → 4種（77枚を新規生成）
- hero の srcset 4箇所（フェス42 / アーティスト17 / 会場22 / 記事4枚）
- フライヤーの srcset（39枚）
- `nav .logo` / `.footer-logo` のタップ領域
- `map.html` の h1 / canonical / hreflang
- subEvent の `eventAttendanceMode`（105件）
- `common.css?v` 12 → 13（452枚）

### 未確認の類似パターン
- **ハブのカード画像は意図的に srcset 無し。触っていない。**
  `localize.js:71` に「一覧ハブでは使わないこと」と明記（2026-08-07 実測で
  PC の画質が落ちたため撤回した経緯）。実機は dpr 2〜3 で 960px が適正
- **記事本文の画像8枚と地図タイル9枚に `alt` が無い**（監査で検出・**未修正**）。
  記事画像は Google Drive 直リンクで派生も無い。CMS 側の対応が要る
- **`offers`（チケット）が subEvent の 19%（20/105）**。TICKETURL 未入力86件と連動。
  データ入力待ちのため未対応
- 12px未満の文字（フェス一覧277箇所ほか）は**意匠と判断し未変更**

### 次の担当への注意・判断待ち
- ⚠️ **監査で誤検知を2件出した。手順として記録しておく（§9-90）**
  1. 「フィルタが押せない」→ `[class*=filter]` が親コンテナに先に当たっていた。
     セレクタは列挙順ではなく**文書順で最初の一致**を返す
  2. 「モバイルでカスタムカーソルが動く」→ headless がタッチを模擬しないだけ。
     コードは既に正しい
  **headless は実機ではない。dpr もタッチも既定では模擬されない**
- **記事画像の alt が未対応。** CMS の画像挿入時に alt を必須にするのが本筋
- **GEO/AIO 提案は未着手**（記事4本のみ。既存データの記事化が低コストで効く）
- CMS 入力の積み残し: アーティスト96名中 紹介文79・写真79・リンク79
- チケットURL 未入力 86/106

---

## 2026-08-15 記事本文の Drive 画像を端末に合わせて配る（AUDIT §9-91）

### 実施
- `build-detail-pages.mjs` に `addDriveImageSrcset()` を追加し、記事本文へ適用
  - Drive の `=w2000` はそのまま `src` に残し、**srcset を足すだけ**
    （src を変えると IMAGE_DIMENSIONS の引き当てが壊れる）
  - 候補 `480w / 800w / 1200w`、`sizes="(max-width: 700px) 100vw, 1200px"`
  - `loading="lazy" decoding="async"` を付与
- `scripts/check_image_delivery.mjs` に Drive 画像の検査を追加
- **`AGENTS.md` に「『実測した』と言う前に、測っているものを確かめる」を追加**
  （利用者の指示によるルール化）

### 原因
記事本文の画像46枚（日英全記事）が Google Drive の `=w2000` で配信されていた。
実際の表示幅はスマホ484px / PC 503〜1332px。1枚あたり最大628KB。

**前夜の計測（§9-90）はこれを数えていなかった。** 計測サーバーが自サイトへの
通信しか数えず、外部ドメインが素通りしていた。「記事 209KB」と報告したが
実際は約3.2MBだった。`performance.getEntriesByType('resource')` を読む方式に変更。

### コミット
（本エントリと同一コミット）

### 検証
**変更前後を同じ方法（外部込み）で測定。**
```
スマホ 390px dpr1        3,547KB → 1,048KB  (-70%)
スマホ 390px dpr3(実機)   3,539KB → 1,836KB  (-48%)
PC 1440px dpr2          3,539KB → 1,836KB  (-48%)
```
**画質の確認**（表示px × dpr ≦ 取得px）:
```
スマホ dpr1  484×1=484 ≦ 800   ✅
PC 通常 dpr2 503×2=1006 ≦ 1200 ✅
スマホ dpr3  484×3=1452 > 1200 △ 0.83倍（許容と判断）
PC fx-full dpr2 1332×2=2664 > 1200 △（下記参照）
```
**候補に 1600 を足して測ったところ実機相当が 1,836KB → 2,646KB（+44%）**
となったため**採用せず戻した**。得られるのは PC 全幅画像の Retina 表示のみで、
モバイル優先の方針に見合わない。

ネガティブコントロール2経路とも検知（本文への適用を外す / lazy を外す）。
preflight: **全33件成功**。

### 変更したパターン
- 記事本文の Drive 画像 46枚（日英）に srcset + sizes + lazy
- `check_image_delivery.mjs` に Drive 画像の検査
- `AGENTS.md` に計測ルール（外部込みで測る / 実機の dpr / 前後比較 / 悪化確認）

### 未確認の類似パターン
- **本文の Drive 画像は46枚すべて対応済み・未対応0件**
- **hero・フライヤー・関連カードは §9-90 で対応済み**
- ハブのカード画像は意図的に srcset 無し（`localize.js:71`）。**変更なし**
- **記事本文の `alt` は46枚すべて未設定のまま（未対応）。**
  影響は AUDIT §9-91 に記載。CMS 側で必須化するのが本筋
- Drive 以外の外部画像（他ドメイン）は**現時点で0件**

### 次の担当への注意・判断待ち
- ⚠️ **`alt` 46枚が未対応。** 読み上げソフトがURLを読む状態。
  暫定策として `alt=""` を入れれば「装飾扱い」で読み飛ばされるが、
  本文の内容画像なので情報が落ちる。**CMS で入力できる形にするのが先**
- **Drive は原本より大きくは返さない。** 原本1100pxの画像は
  `=w2000` でも 1100px が返る。URLの数字＝実サイズではない
- **記事ページはまだ 1.8MB（実機相当）。** 8枚の写真がある記事なので
  これ以上は画質とのトレードオフ。減らすなら枚数か、Drive をやめて
  自サイトに置き webp 化するのが次の手
- CMS 入力の積み残し: アーティスト96名中 紹介文79・写真79・リンク79
- チケットURL 未入力 86/106

---

## 2026-08-15 CMS に画像の説明文（alt）入力欄を追加（AUDIT §9-92）

### 実施
- `LP/cms.html` — 記事の画像設定パネルに `#ar-image-alt`（説明文の入力欄）を追加
- `LP/cms.js` — 3箇所
  1. 画像選択時に有効化する対象へ `ar-image-alt` を追加
  2. 画像を選んだとき、現在の `alt` を入力欄へ読み込む
  3. 「画像に適用」で `setAttribute('alt', ...)`。**空でも属性は残す**
- `scripts/check_cms_preview_frame.mjs` に入力欄の仕組み4点の検査を追加
- `scripts/check_image_delivery.mjs` に alt の入力進捗を表示（**未入力でも止めない**）
- `cms.css?v=27→28` / `cms.js?v=80→81`

### なぜ CMS が先か
本文 HTML はシートの `BODY` 列にあるため、生成側で alt を足しても
**次の Publish で上書きされて消える**。入力欄 → シート保存 → 生成物、の順が必要。

なお受け皿はほぼ出来ていた（設定パネル・alt 保持処理は既存）。**入力欄が無いだけだった。**

### コミット
（本エントリと同一コミット）

### 検証
**CMS は認証で headless が止まるため、同梱 Quill を読み込み、
cms.js から実物の関数を切り出して往復させた。**
```
✅ 「画像に適用」で alt が入る
✅ 保存されるHTMLに alt が含まれる
✅ 閉じて再表示しても消えない（別 Quill へ流し込む経路）
✅ 再表示時に入力欄へ読み戻る
✅ 空にしても alt="" が残る（属性ごと消えない）
```
生成側が alt を消さないことも実物の関数で4パターン確認
（説明文あり / 空 / なし / 属性が前後にある）。

ネガティブコントロール4経路すべて検知（入力欄を消す / 有効化配列から外す /
読み込みを消す / 書き込みを消す）。
※「有効化配列から外す」は初回見逃した。**検査側の欠陥**で、空白をまとめた結果
　`[^\n]*` が全文に広がっていた。配列の中身を見る形に修正し再確認。

preflight: **全33件成功**。

### 変更したパターン
- `cms.html` の画像設定パネル（入力欄＋説明文）
- `cms.js` の3箇所（有効化 / 読み込み / 書き込み）
- 検査2本に項目追加
- `cms.css?v` / `cms.js?v`

### 未確認の類似パターン
- **⚠️ 実ブラウザでの CMS 操作は未確認（実機未確認）。**
  関数単位と Quill 往復は実測したが、**ログイン済みの CMS で
  記事を開き → 画像をクリック → 説明文を入力 →「画像に適用」→ 保存 →
  再表示**までは未確認。認証が必要なため
- 記事以外（フェス・会場・アーティストの画像）に alt の概念は無い。**該当なし**
- 記事 hero の alt は記事タイトルが入る（生成側）。**既に有り**

### 次の担当への注意・判断待ち
- ⚠️ **CMS を実ブラウザで1回操作して確認が必要。**
  `cms.js?v=81` に上がっているので、**開く前にスーパーリロード**
- ⚠️ **Publish 経路（cms.js）を変更したため、Publish Now の実機確認も必要**
  （preflight が警告を出している。過去3回モック緑・実機失敗）
- **既存46枚の説明文は未入力。** 今後の記事は最初から入る状態になった。
  既存分は記事を編集する機会に埋める運用
- **説明文は事実に基づいて書くこと。** 写っている人物・会場が確実でなければ
  「ステージの照明」のように確かなことだけを書く（入力欄にも注記済み）
- **並行作業**: Codex が `build-detail-pages.mjs` を編集中のため、
  本作業は生成側に一切触れていない

---

## 2026-08-17 CMS画像alt入力の実ブラウザ確認完了

### 実施・検証
- ログイン済みCMSで記事を開き、本文画像を選択
- 「説明文」へ入力 → 「画像に適用」 → 保存 → 記事を再表示
- 入力したaltが保持され、再表示後も消えないことを確認

### 未確認の類似パターン
- 記事以外（フェス・会場・アーティスト）の画像alt入力: 該当なし

### 次の担当への注意・判断待ち
- 既存記事46枚のalt入力は未対応。記事更新時に順次入力する

---

## 2026-08-17 9月フェスまとめ記事の下書きを作成

### 実施
- `reports/article-draft-2026-09-festivals.md` — 2026年9月開催の9フェスをまとめた
  CMS 入稿用ドラフト。データ源は EDITIONS / FESTIVALS / LINEUPS シート＋公式ソースの
  Web 確認（出典は下書き末尾の編集メモに列挙）

### 検証
- 日程・会場・住所・リンクは全てシートの実データ
- Web で追加確認できたもの: FFKT の段階制価格（¥16,000〜22,000 / U-23 ¥13,000）と
  第1弾ラインナップ / ONE PARK の会場（福井市中央公園）と第1弾 / BIG FUN の 9/6 開催
- **推測で埋めた項目はゼロ**。サウンドシステム等の未確認項目は「未発表」と明記

### 未確認の類似パターン・判断待ち
- ⚠️ **OTSUKIMI の日程が食い違い**: シート 9/28-29 vs 外部まとめ 9/25-27。
  本文に［要確認］を付けてある。**主催 IG で確認してから公開すること**
- **OTSUKIMI の DESC が「長野」だが会場は新潟・糸魚川**。シート修正を推奨
- ONE PARK 2026 は J-POP 中心の編成（レミオロメン等）。記事では「あわせてチェック」枠で
  正直に扱った。当サイトの desc（エレクトロニック中心の記述）と実態がずれている可能性

---

## 2026-08-19 定期監査②: ニュースの画像が原寸配信 → 対応表の読み込み漏れ（AUDIT §9-93）

### 実施
- `news.html` / `index.html` の記事カード4箇所を `tjCardAssetPath`＋原本フォールバックへ
  （フェス一覧と同じ型）。EN ハブは再生成で追従
- **真因**: news.html だけ `image-derivatives.js` 未読み込み。追加した
- `check_image_delivery.mjs` に「tjCardAssetPath 使用ページは対応表必須」を追加

### 検証
- 実機相当（390px/dpr3）: ニュース 2,157→869KB（−60%）/ トップ 1,531→1,034KB（−32%）
- 表示健全性 5経路: 壊れ0・非表示0・派生使用を確認
- NC: news から読み込みを外す → 検知 ✅
- preflight 全33件成功

### 未確認の類似パターン
- tjCardAssetPath 使用6ページすべて対応表読み込み済みを検査で確認・漏れ0件
- ハブのカードに srcset を足さない方針（§9-35）は維持

### 次の担当への注意・判断待ち
- alt 16/58（利用者入力中）/ TICKETURL announced 3/16
- 9月まとめ記事の下書き（8/17）が未入稿。OTSUKIMI の日程確認待ち

---

## 2026-08-19 DB移行 Step 2: 管理シートの移行前分析を実施

### 実施
- 内部管理シート（xlsx）を `data/migration/`（**gitignore 済み・非公開**）に受領し、
  対象10タブを機械分析。詳細は `data/migration/analysis/report.md`（非公開）
- リポジトリが PUBLIC のため、移行データ一式は git から構造的に遮断済み

### 検証
- 日付書式は3パターンで94%＝機械変換可能を確認
- サイト公開中データ（data.js）との名寄せ照合を実施
- 重複候補・語彙棚卸し・鮮度分布を summary.json / report.md に出力（非公開）

### 次の担当への注意
- **公開リポジトリに移行データの中身を書かないこと**（handoff にも件数以上の詳細は書かない）
- ジャンル語彙の正規化先はユーザー判断待ち
- LP シートと Publish 経路は本件で一切触っていない

---

## 2026-08-19 DB移行 Step 2-B 完了: Airtable 取り込みファイル一式を生成

### 実施
- `scripts/migration/build_airtable_import.py` 新規（公開リポジトリに置くためデータ非含有）
- `data/migration/out/`（非公開）に festivals/venues/editions/promoters/media/pilot/issues の7ファイル生成
- 語彙変換はユーザー確定版（Deep→DEEP TECHNO 等、Mix/Consepting はジャンル要判定＋特徴タグ）

### 検証
- 列数整合・slug 一意性・日付変換率（directory 783中746）・抜き取り5種を確認
- 途中で slug 衝突3種を検出し修正（数字のみslug／連番不備／海外同名の誤スキップ）

### 次の担当への注意
- Airtable 取り込みは `data/migration/out/IMPORT_GUIDE.md`（非公開）の手順で。パイロット→本番の順
- 「サイト掲載と同名・要確認」3件は別フェスか要判断
- LP・Publish 経路は不変更

---

## 2026-08-19 ハブ検査の負荷耐性＋関門運用の固定（AUDIT §9-94）

### 実施
- `check_hub_pages.py`: 空DOM（<2KB）のときだけ1回・倍猶予で再試行
- ゾンビ headless Chrome 13個を掃除（`--headless=new` 限定の pkill。実ブラウザ非対象）
- 検査の実行形を固定: パイプ禁止・ファイル出力・exit をログへ直接記録・長時間は background

### 検証
- NC: 本物の描画故障（クラス名破壊・DOM131KB）→ 再試行後も exit=1 で検出 ✅
- 全ハブ11ページ ✅ / preflight 全33件成功（exit=0 をログで直接確認）

### 次の担当への注意
- **このマシンは並行セッションで負荷が高い。**ブラウザ検査が「毎回違うページで空DOM」
  で落ちたら環境起因を疑う。§9-94 参照
- 無効な関門で push が2回走った（中身は無害）。preflight をパイプに通さないこと

---

## 2026-08-19 Airtable 本番取り込み完了（Chrome 実操作）

### 実施（Claude が Chrome を直接操作）
- パイロット50件で検証（文字化け・型推定・タグ分割）→ 合格後に本番へ
- ベース「TECHNO JAPAN DB」を作成し5テーブルを取り込み・リネーム:
  Festivals 879 / Venues 634 / Promoters 159 / Media 142 / Editions 723
- **Editions.Festival をリンク型へ変換**（単一リンク・Festivals テーブルへ）

### 検証
- 各テーブルの行数が CSV と一致
- 日本語名・アクセント付き文字の化けなし / genres・features はタグ分割 /
  日付は Date 型 / media_type 分類 142/142
- **リンク照合: Festival is empty = 0件（723/723 成功）**

### 実測で分かった操作の注意（次回のブラウザ操作向け）
- Airtable のドロップダウン項目は **hover してからクリック**しないと拾われない
  （クリックのみだと既定の「新規テーブル作成」に落ちる。3回誤爆した）
- トライアル関連のダイアログには触れず閉じる（プラン同意はユーザー操作に委ねる）

### 残タスク（任意・ユーザー判断）
- Promoters.linked_festivals のリンク型変換（同じ手順で可能）
- ビュー作成（🇯🇵掲載候補 / 要確認 / 日付が古い）は IMPORT_GUIDE §4 参照
- パイロットベース「pilot_festivals.csv」の削除
- **トライアル14日以内に Team プランへアップグレード**（超過するとベースが読み取り専用化）

---

## 2026-08-20 アジア8〜12月フェスまとめ記事の下書きを作成

### 実施
- `reports/article-draft-2026-asia-festivals.md` — Instagram まとめ投稿の記事版。
  アジア14フェス（韓国4・モンゴル・台湾・中国・インド2・インドネシア・タイ3・香港）を
  依頼の紹介順どおりに構成。日付・会場は Airtable DB ＋ Web で裏取り済み（出典は編集メモに列挙）

### コミット
- 本エントリと同じコミット（docs のみ・[skip ci]）

### 検証
- 14件中12件は公式サイト/報道ソースで日程・会場を確認。
  裏取り結果とDB・依頼文の食い違いは下書き末尾「編集メモ」に集約

### 変更したパターン
- 下書き md の新規追加のみ。サイト生成物・データは不変更

### 未確認の類似パターン
- Fingerprints Summer Camp: 日付が依頼(8/22-23)とDB(8/22-24)で食い違い。会場「江原道」未確認
- Thevault_Rave 8/29: Web上で開催情報を確認できず（IG要確認）
- Zhao Dai On Leave: 2026年の会場未発表（例年は河北・Aranya Golden Coast）

### 次の担当への注意・判断待ち
- **依頼文の「Wonderfruits / Chiang Mai」は誤り。正しくは Wonderfruit / パタヤ**
  （The Fields at Siam Country Club）。**IG投稿スライド側の表記も要確認**
- 記事タイトルは「2026年下半期」とした（IG投稿の「8月-9月」枠と実リストが不一致のため）。ユーザー判断待ち
- 画像14点が全件プレースホルダー。フライヤー取得→`images/articles/`へ（Drive直リンク禁止）
- CMS入稿・Publish は未実施（下書き段階）

---

## 2026-08-20 アジアまとめ記事: 食い違い3件をユーザー確認・IG実査で解決

### 実施
- Wonderfruit=パタヤ確定 / Fingerprints=8/22〜24確定（ユーザー確認）
- Thevault_Rave: 公式IG投稿を実ブラウザで閲覧し確認。8/29(土)22:00〜翌3:00、
  完全ゲストリスト制200人、会場非公開（30年封存の地下金庫）。下書きに反映
- Airtable Updates Inbox に thevault-rave の日付更新提案を1件追加（pending・出典IG）。
  初回POSTで target_festival を lemme-live の recID と取り違え→即時修正済み（対象は正しい recLxR1zvJjugctpA）

### コミット
- 本エントリと同じコミット（docs のみ・[skip ci]）

### 検証
- IG投稿本文から日付・時間・入場条件・会場の扱いを引用で記録（下書き編集メモ参照）

### 変更したパターン
- reports/article-draft-2026-asia-festivals.md のカレンダー・Thevault節・編集メモ

### 未確認の類似パターン
- Thevaultの開催都市: IGは非公開（過去投稿に桃園の記載）。依頼文の「台北」はカレンダー表のみ維持。断定はユーザー判断待ち
- IG投稿スライド側のWonderfruit表記（Chiang Mai と書かれていれば要修正）: 未確認

### 次の担当への注意・判断待ち
- 残タスクは画像14点の取得・タイトル期間表記の判断・CMS入稿（前エントリ参照）

---

## 2026-08-23 FESTIVALS / VENUES 一覧ビジュアル2案の比較

### 実施: 何をどこに変えたか

- `LP/festivals.html:472-605,1290-1420`
  - `?visual=a`: 行右端に派生 `sm` の4:3画像を追加（ぼかしなし）。
  - `?visual=b`: 行全体に派生 `sm` の背景画像、blur 18px / grayscale 55% /
    brightness 0.58、左→右暗幕、右端の日付を追加。
  - パラメータなしは変更前表示の比較用。画像なし行は視覚要素を生成しない。
  - reduced-motion では案Bのhover filter/transform変化を停止。
- `LP/venues.html:69-98,797-816`
  - 22件のVENUESカード右側に派生 `sm` を追加。画像がない場合は子要素を生成しない。
  - 画像は `data-bg` と `tjApplyLazyBackgrounds` で遅延適用。
- `LP/localize.js:66-71,135-164`
  - 既存の派生表から `sm` を選ぶ引数と、ページごとのrootMarginを追加。
- `LP/en/festivals.html` / `LP/en/venues.html`
  - `scripts/build-detail-pages.mjs` の `enHubFromJa` で再生成。
  - `wc -l`:
    - `LP/festivals.html` 1,442 / `LP/en/festivals.html` 1,442
    - `LP/venues.html` 1,002 / `LP/en/venues.html` 1,002

### 計測: 変更前 / 案A / 案B

条件は全ケース同一: headless Chrome、390×844、DPR2、iPhone UA、Fast 3G、
resource entriesのtransferSize合計＋navigation transferSize、スクロール前後を計測。
画像リクエスト数は最下部までスクロールした時点。案A/Bは最終調整後の値。

| ページ・言語 | 状態 | 初期表示 KB | 全スクロール KB | 画像リクエスト数 | LCP ms | CLS |
|---|---:|---:|---:|---:|---:|---:|
| FESTIVALS JA | 変更前 | 478.3 | 478.3 | 3 | 1,232 | 0.00015 |
| FESTIVALS JA | 案A | 565.1 | 896.6 | 13 | 1,232 | 0.00015 |
| FESTIVALS JA | 案B | 565.1 | 565.1 | 14 | 4,852 | 0.00015 |
| FESTIVALS EN | 変更前 | 478.4 | 478.4 | 3 | 1,196 | 0.00015 |
| FESTIVALS EN | 案A | 565.2 | 565.2 | 14 | 1,220 | 0.00015 |
| FESTIVALS EN | 案B | 565.2 | 565.2 | 14 | 4,632 | 0.00015 |
| VENUES JA | 変更前 | 577.8 | 577.8 | 3 | 1,928 | 0.04471 |
| VENUES JA | 案A | 579.2 | 579.2 | 25 | 4,520 | 0.04471 |
| VENUES EN | 変更前 | 577.9 | 577.9 | 3 | 1,924 | 0.04471 |
| VENUES EN | 案A | 589.9 | 597.9 | 25 | 4,792 | 0.04471 |

KBは1KB=1024bytesで換算。案BはFESTIVALSのみ実装対象、VENUESは案Aのみ。
`CLS 0.04471` は変更前から存在するVENUES側の既存値で、今回の画像追加による増加はない。

### 合否: 事前基準との比較

- FESTIVALS 案A: 合格。初期 +86.8KB、全スクロール +418.3KB、LCP JA ±0ms /
  EN +24ms、CLS +0。全基準内。
- FESTIVALS 案B: 不採用候補。初期重量は +86.8KBで通るが、LCPがJA +3,620ms /
  EN +3,436msで、+200ms基準を大幅超過。
- VENUES 案A: 不採用候補。重量増はJA +1.4KB / EN +12.0KBで通るが、LCPが
  JA +2,592ms / EN +2,868msで基準超過。CLSは既存の0.04471で、絶対値0.02基準には
  変更前から未達。画像の遅延範囲を追加調整してもLCP基準内にはならなかった。

### 目視: スクショのパス一覧と気づいた問題

保存先: `reports/screenshots/list-visual/`

- 案A: `a-ja-festivals-390.png`, `a-en-festivals-390.png`,
  `a-ja-festivals-1280.png`, `a-en-festivals-1280.png`
- 案B: `b-ja-festivals-390.png`, `b-en-festivals-390.png`,
  `b-ja-festivals-1280.png`, `b-en-festivals-1280.png`
- VENUES案A: `a-ja-venues-390.png`, `a-en-venues-390.png`,
  `a-ja-venues-1280.png`, `a-en-venues-1280.png`
- 比較用追加確認: `b-ja-venues-390.png`, `b-en-venues-390.png`,
  `b-ja-venues-1280.png`, `b-en-venues-1280.png`

案Aは右側の画像が行の情報と競合せず、案Bは暗幕により白文字のコントラストを維持。
案Bはモバイルで日付が大きく、行の情報領域を圧迫する。画像なし行は黒のままで、
灰色枠・壊れた画像アイコンは発生しなかった。

390pxの1画面に入る完全なFESTIVAL行数（JA / EN）は、変更前 5 / 5、案A 5 / 4、
案B 5 / 4。案A/BのENのみ1件減少。案A/Bともフィルタ後の画像対応は一致した。

### 操作確認

- JA/ENで月・ジャンルフィルタ後の行と画像の対応を確認: `visualConsistency: true`
- VENUES検索 `WOMB` で1件に絞り込み、画像表示を確認。
- FESTIVALS/ENを含む通常 `<a href>` をクリックし、静的詳細ページへ遷移。
- `preventDefault()` による詳細遷移横取りなし。
- `python3 scripts/check_hub_pages.py`: JS例外0、壊れた画像0、XSS発火0。
- `python3 scripts/audit_spa_vs_static.py --after`: 4セクションともSPA詳細なし。

### 提案: どちらを採るか

FESTIVALSは案Aを採用候補とする。案Bは視覚的には強いが、LCPが約3.4〜3.6秒悪化し、
データベース一覧の検索体験に対する基準を満たさない。案Aは初期+86.8KB、全スクロール
+418.3KBで、LCP/CLSも基準内。

VENUES案Aは見た目と重量は良いが、LCP基準を超えているため、現時点では本採用しない。
VENUESは画像を表示する場合のLCP対策を別途行い、再計測してから判断する。
最終判断はユーザーに委ねる。

### 未確認

- 実機のiPhone Safari、Instagram内ブラウザ、LINE内ブラウザでの操作は未確認。
  今回はChrome headlessの390px/DPR2と1280pxで確認した。
- CMS入力・Publish・GAS再デプロイは今回のUI変更対象外のため未実施。
- VENUESの「画像なし行」は現在の22件すべて画像あり。FESTIVALSでは画像あり22件、
  画像なし49件をブラウザDOMで確認し、画像なし行が黒のままであることを確認。

## 2026-08-23 追加修正: モバイル案AとVENUESホバー

### 変更

- FESTIVALS案Aは390px以下で右側画像を非表示に変更。
- PCでは画像の有無にかかわらず右側の予約幅を統一し、行の本文幅を揃えた。
- VENUESは画像と役割が重なる面塗りホバーを削除し、境界線と矢印の反応だけを残した。

### 再確認

- 修正後の390px案A: FESTIVALS JA/ENとも画像リクエスト3件（ロゴ等のみ）、
  LCP JA 1,204ms / EN 1,196ms、CLS 0.00015。
- 画像あり22件・画像なし49件の行でレイアウトを確認。
- JA/ENフィルタ後の画像整合性 `true`、通常詳細リンク遷移 `true`。
- 修正後のスクリーンショットは既存の
  `reports/screenshots/list-visual/a-ja-festivals-390.png` と
  `a-en-festivals-390.png` を更新。
- `bash scripts/preflight.sh`: 全33件成功。

### 未確認

- 実機iPhone / Instagram内ブラウザ / LINE内ブラウザは引き続き未確認。

## 2026-08-23 追加修正: DATEラベルとVENUESホバーの削除

- FESTIVALS一覧の各行から `DATE` ラベルを削除し、日付だけを表示。
- VENUESはホバープレビューの呼び出し、枠線変化、矢印のホバー表示を停止。
  矢印は薄く常時表示。
- `bash scripts/preflight.sh`: 全33件成功。
- `scripts/check_hub_pages.py` が検査するハブ描画・画像・JS例外はpreflight内で成功。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 追加修正: スマホVIEWをさらに右下へ

- スマホの円形矢印ボタンを `right 12px / bottom 12px` に変更。
- 390px JA/ENのローカルスクリーンショットと転送量・LCP・CLSを確認。
- 本番反映、push、PR作成は未実施。

## 2026-08-24 フェーズ1: 記事イベントショートコード共通関数

### 実施

- `LP/article-shortcodes.js` を新規作成。`[[event|名前|日程|場所|公式URL|補足]]` と `[[calendar]]` の解析、検証、HTML化を実装。
- NodeのES module importと、ブラウザの`globalThis.TJArticleShortcodes`で同じ関数を利用できる形にした。
- `scripts/check_article_shortcodes.mjs` を新規作成し、`scripts/preflight.sh`へ登録。

### コミット

- ローカルコミット（この追記を含む）。push・本番反映は行っていない。

### 検証

- `node scripts/check_article_shortcodes.mjs`: 8 assertions passed。
- 日付書式違い、`javascript:` URL、calendarのみでevent 0件の3ケースがエラーになることを確認。
- `bash scripts/preflight.sh`: 省略なしで実行。記事イベントショートコードを含む表示済み検査項目は成功。
- `LP/article-shortcodes.js`はフェーズ1の共通関数のみで、既存のビルド本文・CMSプレビューには未接続。

### 変更したパターン

- event単日、event期間、補足タグ、https公式URL、calendarの月別グループ化、JA/EN表示分岐、過去イベントの`is-past`。
- 不正な日付、開始日が終了日より後の日付、不正URL、event 0件のcalendarをエラー化。

### 未確認の類似パターン

- CMS画面の入力フォーム、プレビュー、保存、再表示: 未確認（フェーズ3以降の対象）。
- 実記事のビルド生成、記事JSON-LDへのEvent追加: 未確認（フェーズ2以降の対象）。
- ブラウザ上の既存記事への表示確認: 未確認（まだビルド/CMSへ接続していないため）。

### 次の担当への注意

- §7の禁止事項を守り、JS月送りカレンダー、FullCalendar、別シート管理、`data-json`埋め込みを追加しない。
- フェーズ2では`build-detail-pages.mjs`へ接続する前に、必ず`git pull`と`git status`を確認し、JA/EN生成後に実ブラウザで記事・カード・カレンダー・外部リンクを確認する。

## 2026-08-24 フェーズ2: 静的記事ビルドへの接続

### 実施

- ビルド前に`git pull --ff-only origin main`を実行し、`Already up to date.`を確認。
- `scripts/build-detail-pages.mjs`の`makeEntityResolver`後段で`renderArticleShortcodes`を呼ぶよう変更。
- 記事本文のeventを`Event` JSON-LDとして記事JSON-LD配列へ追加。
- 公開記事のJA/EN本文について、event必須項目・日付・URL・calendarのevent 0件を`validateArticleShortcodes`で検証。

### コミット

- フェーズ2変更はローカルコミット予定。push・本番反映は行わない。

### 検証

- `node scripts/build-detail-pages.mjs`: 成功（記事JA 6件 / EN 5件を生成、既存出力の更新なし）。
- 生成後の記事行数: JA `779 total`、EN `765 total`。
- `python3 scripts/audit_spa_vs_static.py --after`: 成功。静的記事5件と通常リンクを確認。
- `node scripts/check_article_shortcodes.mjs`: 8 assertions passed。
- `bash scripts/preflight.sh`: 省略なしで実行。記事イベントショートコードを含む検査項目は成功。
- 実ブラウザ: Chromeで共通モジュールを読み込み、`tj-event` / `tj-calendar`生成を確認。ローカルJA記事`/articles/bondisco-2026-info.html`とEN記事`/en/articles/bondisco-2026-info.html`を開き、`article-detail` / `article-body` / title表示を確認。

### 変更したパターン

- 既存entity shortcode → event/calendar shortcodeの順で変換。
- JA/EN本文ごとのevent抽出、記事JSON-LDへのEvent配列追加、公開記事のショートコード検証。

### 未確認の類似パターン

- 実データ内にevent/calendar shortcodeを含む公開記事がまだ無いため、生成済み実記事でカード・カレンダー・Event JSON-LDが出る経路: 未確認。
- CMSの入力→プレビュー→閉じる→再表示→保存: 未確認（フェーズ3対象）。
- 実機iPhone / Instagram内ブラウザ / LINE内ブラウザ: 未確認。

### 次の担当への注意

- フェーズ3以降も§7の禁止事項を守る。JS月送り、FullCalendar、別シート、`data-json`埋め込みは追加しない。
- 実データにshortcodeを入れる場合は、公開前にJA/EN記事の実ブラウザ表示、ページ内リンク、公式外部リンク、JSON-LDを確認し、同じ6項目をhandoffへ追記する。

## 2026-08-24 フェーズ3: イベントカードと開催カレンダーの見た目

### 実施

- `LP/detail.css`へ`.tj-event` / `.tj-calendar` / `.tj-cal-month`の静的スタイルを追加。
- 色は既存の`--bg` / `--text` / `--accent`と既存の透明度表現のみ、フォントは既存のBebas Neue / Space Mono / DM Sansのみを使用。
- `LP/article-fx.js`のリビール対象へ`.tj-event`と`.tj-calendar`を追加。既存の`.fx-reveal`によるopacity + transformのみを使用し、レイアウト寸法を変える演出は追加していない。
- `DETAIL_CSS_VERSION`を26、`ARTICLE_FX_JS_VERSION`を6へ更新し、JA/EN静的ページを再生成。

### コミット

- フェーズ3変更はローカルコミット済み（このエントリを含む）。push・本番反映は行わない。

### 検証

- `node scripts/build-detail-pages.mjs`: 成功（JA/ENの静的ページを再生成）。
- `bash scripts/preflight.sh`: 省略なしで実行。表示された検査項目は成功。
- 実ブラウザChromeで390pxと1280pxを確認し、イベントカード・開催カレンダーの最終表示を保存。
- スクリーンショット: `reports/screenshots/article-events-phase3-390.png`、`reports/screenshots/article-events-phase3-1280.png`。
- fixtureで`common.css`込みの表示を確認。初回のcommon.css未読込による白背景はfixtureを修正して再撮影済み。

### 変更したパターン

- 1カラムのイベントカード、左アクセント線、日付・名称・場所・公式リンク、過去イベントの薄表示。
- 月見出しと静的リストによる開催カレンダー、390pxでの1列化、1280pxでの日付・名称・場所の3列配置。
- `prefers-reduced-motion`時は既存の`.fx-reveal`停止規則を適用。

### 未確認の類似パターン

- 実データに`[[event]]` / `[[calendar]]`を含む公開記事がないため、実記事ページでのカード・カレンダー表示: 未確認。
- 実機iPhone / Android / Instagram内ブラウザ / LINE内ブラウザ: 未確認。
- CMS入力画面から保存したshortcodeの表示: 未確認（フェーズ4対象）。

### 次の担当への注意

- fixtureは削除済み。スクショは残している。
- CSS変更時は`DETAIL_CSS_VERSION`、article-fx.js変更時は`ARTICLE_FX_JS_VERSION`を必ず更新し、生成後の全ページ参照を確認する。
- §7の禁止事項（JS月送り、FullCalendar、別シート、`data-json`埋め込み）を追加しない。

## 2026-08-24 フェーズ4: CMSイベントカード入力・プレビュー

### 実施

- `LP/cms.html`の記事本文ツールバーに「📦 イベントカード」「📅 カレンダーを挿入」を追加。
- イベントカードフォームから名前・開始日・終了日・場所・公式URL・補足を入力し、`[[event|…]]`をVisual/HTML本文のカーソル位置へ挿入。
- `ARTICLE_TEMPLATES`に`roundup`（🗺 フェスまとめ）を追加。
- `updateArticlePreview`でentity shortcode変換後、`globalThis.TJArticleShortcodes.renderArticleShortcodes`を使ってevent/calendarを変換。
- CMSへ`LP/article-shortcodes.js`をmoduleとして読み込み、`cms.js`のキャッシュバージョンを92へ更新。

### コミット

- フェーズ4変更はローカルコミット済み（このエントリを含む）。push・本番反映は行わない。

### 検証

- `node --check LP/cms.js`: 成功。
- `node scripts/check_article_shortcodes.mjs`: 8 assertions passed。
- ChromeでCMS HTMLの配信と共通moduleの読み込みを試行。
- 既存CMSの認証が必要なため、認証後の実操作はこの環境では完了できなかった。

### 変更したパターン

- イベントカード入力フォーム、必須項目チェック、日付順チェック、https URLチェック、`|`入力拒否。
- Visual本文への挿入、HTML本文への挿入、カレンダー単独挿入、roundupテンプレート、プレビューの共通変換。

### 未確認の類似パターン

- 認証済みCMSでの「入力→プレビュー→閉じる→再表示→保存」: 未確認。
- 保存後の本文再取得、Quill再初期化後のshortcode保持: 未確認。
- CMSでroundupテンプレートを選択し、calendarとeventを編集・保存する経路: 未確認。
- 実機iPhone / Android / Instagram内ブラウザ / LINE内ブラウザ: 未確認。

### 次の担当への注意

- 認証済みCMSで上記の未確認経路を必ず実操作し、本文が消えないことを確認する。
- 認証済み環境で確認できるまで、公開済みとして扱わない。
- §7の禁止事項（JS月送り、FullCalendar、別シート、`data-json`埋め込み）を追加しない。

## 2026-08-23 追加修正: スマホのVENUES VIEW位置

- スマホもPCと同じく、円形の矢印ボタンを画像領域の右下（right 24px / bottom 24px）へ配置。
- 390px JA/ENのローカルスクリーンショットと転送量・LCP・CLSを確認。
- JA/EN行数は 1009行 / 1009行。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 追加修正: PCのVENUES VIEW位置

- PCでは円形の矢印ボタンを画像領域の右下（right 24px / bottom 24px）へ移動。
- 390px以下では従来位置（right 32px / bottom 48px）を維持。
- 1280px/390pxのJA/ENローカルスクリーンショットと転送量・LCP・CLSを再確認。
- `bash scripts/preflight.sh`: 全33件成功。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 追加修正: VENUES VIEWホバー表現

- 初期表示を円形ボタン内の `→` に変更。
- PCのマウスホバー時だけ矢印を `VIEW` に切り替える。
- タッチ端末では矢印表示を維持し、カードの縦幅と通常の詳細リンク遷移は変更なし。
- 390px JA/ENスクリーンショットと検索・絞り込み・リンク確認を実施。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 追加修正: VENUES VIEWのREAD準拠

- VENUESの `VIEW` を記事一覧のREADリンクと同じフォントサイズ、字間、大文字表示、透明度に統一。
- モバイルの右下固定レイアウトは維持し、カードの縦幅は変更していない。
- JA/EN再生成後の行数は 1001行 / 1001行。
- 390pxスクリーンショットを再取得: `reports/screenshots/list-visual/a-ja-venues-390.png`、
  `a-en-venues-390.png`。
- 再計測: JA 初期592,756B・最下部592,756B、LCP 4,544ms、CLS 0.0447。
  EN 初期603,800B・最下部1,076,155B、LCP 5,248ms、CLS 0.0447。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 追加修正: VENUESスマホのVIEW矢印

- 390px以下では `VIEW →` を画像上の絶対配置から本文下の通常フローへ変更。
- JA/ENの390pxスクリーンショットで、画像と重ならず読めることを確認。
- 転送量・画像リクエスト・LCP/CLSを再計測済み。
- `bash scripts/preflight.sh`: 全33件成功。
- push、PR、本番反映は未実施。

## 2026-08-23 追加修正: VENUESスマホのVIEWラベル

- モバイルVENUESカードの縦積み指定を削除し、直前の右下固定レイアウトへ戻した。
- 行内リンクの表示を `VIEW →` から記事一覧のREADリンクに合わせた `VIEW` に変更。
- JA変更後にENを再生成。`wc -l LP/venues.html LP/en/venues.html` は 996行 / 996行。
- 390pxローカル計測: JA 初期592,680B・最下部592,680B、画像3件→25件、LCP 4,528ms、CLS 0.0447。
  EN 初期607,052B・最下部611,989B、画像2件→25件、LCP 4,832ms、CLS 0.0447。
- `scripts/check_list_visual_interactions.py --root LP --state A`: JA/ENの検索・絞り込み後画像整合性・通常リンクを確認。
- `bash scripts/preflight.sh`: 全33件成功。
- 本番反映、push、PR作成は未実施。

## 2026-08-23 フェーズ5: アジアのフェスまとめdraft

### 実施

- `reports/fixtures/phase5-asian-festival-roundup.json` に、`status: "draft"` のアジアフェスまとめ記事を作成。
- JA/EN本文それぞれにイベントカード5件と `[[calendar]]` を含めた。
- `scripts/build-detail-pages.mjs` に `--draft-preview=<fixture>` を追加し、通常の公開ビルド（draft除外）を変えずに `reports/phase5-preview/` へJA/EN静的記事を生成できるようにした。
- `LP/article-shortcodes.js` はCMSが保存する `<p>[[event|…]]</p>` を正しいブロックHTMLへ変換し、イベントカードとカレンダーのアンカーを一致させるよう修正。
- 変更箇所: `scripts/build-detail-pages.mjs:80-82,141-149,1958-1977`、`LP/article-shortcodes.js:165-180`、`scripts/check_article_shortcodes.mjs:16-17`。

### コミット

- フェーズ5変更をローカルコミット済み。push・PR作成・本番反映は行わない。
- 公開判断は未実施。`status: draft` のまま、通常ビルドには出ない。

### 検証

- `node scripts/build-detail-pages.mjs --draft-preview=reports/fixtures/phase5-asian-festival-roundup.json`: 成功。JA=5件 / EN=5件、JA/ENにcalendar各1件。
- 生成記事の行数: `wc -l` でJA 137行 / EN 137行。
- `node scripts/check_article_shortcodes.mjs`: 8 assertions passed（不正日付、URL不正、calendar単独0件、ブロックHTMLを確認）。
- `python3 scripts/audit_spa_vs_static.py --after`: 成功。
- `bash scripts/preflight.sh`: **全34件成功**。
- 実ブラウザ（Chrome）でJA/EN × 390px/1280pxを確認。共通CSS適用後のイベントカード、カレンダー、見出し、日英切替を確認し、短コードが画面に残らないことを確認。

### 変更したパターン

- CMS/Quillが本文を `<p>` で包むイベントカード・カレンダー。
- 同一イベント配列から生成するイベントカードのアンカーとカレンダーリンク。
- draft専用ローカルプレビューと、通常公開ビルドのdraft除外。

### 未確認の類似パターン

- 認証済みCMSで実際に「入力→プレビュー→閉じる→再表示→保存」し、GAS経由でこのdraftを作成する経路: 未確認（フェーズ4から継続）。
- 実機iPhone / Android、Instagram内ブラウザ、LINE内ブラウザ: 未確認。今回の390pxは実ブラウザのモバイル設定で確認。
- 公開判断・Publish Now・本番URLでの表示: 未確認（ユーザー判断待ち）。

### 次の担当への注意

- 公開前に認証済みCMSで本文の保存・再表示を実操作し、draftの内容が消えないことを確認する。
- 公開する場合は、先にユーザーが公開判断を行う。pushは本番公開なので、明示指示とpreflight全件成功の両方が必要。
- `--draft-preview` はローカル確認専用。通常の `node scripts/build-detail-pages.mjs` はdraftを生成しない。
- §7の禁止事項（JS月送り、FullCalendar、別シート、`data-json`埋め込み）を追加しない。

## 2026-08-23 フェーズ5表示不具合修正: カレンダーの固定表示

### 実施

- 原因は、記事内カレンダーを意味的な`<nav>`で出力していたため、`LP/common.css`のサイトヘッダー用`nav { position: fixed }`が誤適用されていたこと。
- `LP/detail.css`で`.article-body .tj-calendar`だけ`position: static`、通常の本文フロー、モバイル縦積みに戻す指定を追加。
- `DETAIL_CSS_VERSION`を26から27へ更新。
- shortcode本体変更のキャッシュ漏れを防ぐため、`LP/cms.html`の`article-shortcodes.js`を`?v=1`から`?v=2`へ更新。

### コミット

- ローカルコミットのみ。push・本番反映は未実施。

### 検証

- JA/EN・390px/1280pxをChrome実ブラウザで再撮影。
- PCでカレンダーがヘッダー位置に固定されず、記事本文内に表示されることを確認。
- `node scripts/check_article_shortcodes.mjs`: 成功。
- 修正前のpreflightはキャッシュバージョン1件のみ失敗。`?v=2`修正後、`bash scripts/preflight.sh`は全34件成功。

### 変更したパターン

- PC固定ヘッダーと記事内`nav`のCSS競合。
- スマホのstickyヘッダー指定と記事内カレンダーの競合。

### 未確認の類似パターン

- 認証済みCMS保存後に新しい`article-shortcodes.js?v=2`が読み込まれる経路: 未確認。
- 実機iPhone / Android、Instagram内ブラウザ、LINE内ブラウザ: 未確認。

### 次の担当への注意

- 記事本文に`nav`など共通UIと同じ要素名を追加する場合、`common.css`のグローバルセレクタとの競合を確認する。
- 公開前にpreflight全件成功を再確認する。

## 2026-08-23 VENUE 巡回: 東京 bar 02

- 実施: Airtable Venues（Tokyo / bar / directory）から30件を WebSearch で調査し、
  `data/inbox/venues/tokyo-bar-02.json` に出典・確度・判断（載せる5 / 保留9 / 載せない16）を記録。
- コミット: 未（データファイルのみ、コードは未変更）。
- 検証: JSON の読み込みと件数を確認（30件）。Airtable への書き戻しは未実施（ユーザーの○×待ち）。
- 変更したパターン: なし（コード変更なし）。
- 未確認の類似パターン: IG のみで Web に痕跡が無い5件（BAR結界 / Open Source / bar__kraken / FOLK / bar not bar）は判断保留。
- 次の担当への注意: ○×が決まったら coverage_tier / notes / venue_type（88block は club）を Airtable に書き戻す。
  venue_id の修正候補: bar-jp-2・music-bar・neo、A10 と地下肆は未設定。残り東京 bar 25件 → 大阪 club。

## 2026-08-23 VENUE 巡回: 東京 bar 03（東京 bar 一巡完了）

- 実施: Airtable Venues（Tokyo / bar / directory）の残り25件を WebSearch で調査し、
  `data/inbox/venues/tokyo-bar-03.json` に記録（載せる3 / 保留4 / 載せない17、重複1）。
- コミット: 未（データファイルのみ、コードは未変更）。
- 検証: JSON の読み込みと件数を確認（24件）。Airtable への書き戻しは未実施（ユーザーの○×待ち）。
- 変更したパターン: なし（コード変更なし）。
- 未確認の類似パターン: 確認済み・0件（東京 bar の directory 行はすべて調査済み）。
- 次の担当への注意: BAROOM は 2026-02-20 閉店（venue_status=closed へ）。TACOS BAR / SG Club /
  INCredible COFFEE は音楽会場ではない（Airtable から外す候補）。THE ROOM は掲載済なので editorial へ。
  東京 bar 01〜03 の○×が決まったら coverage_tier / notes / venue_type を書き戻し、次は大阪 club 11件。

## 2026-08-23 VENUE 巡回: 東京 club 02 ＋ 大阪 01（東京・大阪の club/bar を一巡）

- 実施: Airtable Venues の Tokyo/club 残り27件を `data/inbox/venues/tokyo-club-02.json`（○7/△10/×10）、
  Osaka/club 11 + bar 6 を `data/inbox/venues/osaka-01.json`（○7/△8/×2）に WebSearch の出典つきで記録。
- コミット: 未（データファイルのみ、コードは未変更）。
- 検証: 両 JSON の読み込みと件数（27 / 17）を確認。Airtable への書き戻しは未実施（ユーザーの○×待ち）。
- 変更したパターン: なし（コード変更なし）。
- 未確認の類似パターン: city='TOKYO'（大文字）の directory 8行、Tokyo/Osaka の record-shop 27行、地方都市・海外は未巡回。
- 次の担当への注意: 壊れた行『53263.0』（Tokyo/club）は削除候補。TERANOMA は裏難波へ移転済で Airtable の住所更新が必要。
  LOOPY PURR ×2 は統合。無重力セッションは会場でなくコレクティブ。

## 2026-08-23 VENUE 巡回: 愛知・北海道・京都・白馬（長野）

- 実施: Airtable Venues の directory 行を WebSearch で調査し `data/inbox/venues/` に記録。
  aichi-01（12件: ○4/△5/×3）、hokkaido-01（16件: ○2/△5/×9）、kyoto-01（5件: ○2/△2/×1）、hakuba-nagano-01（7件: ○1/△4/×2）。
- コミット: 未（データファイルのみ、コードは未変更）。
- 検証: 4 JSON の読み込みと件数を確認（12/16/5/7）。Airtable への書き戻しは未実施（ユーザーの○×待ち）。
- 変更したパターン: なし（コード変更なし）。
- 未確認の類似パターン: 兵庫・新潟・静岡・沖縄などの地方、東京/大阪の record-shop、海外は未巡回。
- 次の担当への注意: スキー場の店（Hertzz / DJ Bar Steam / ニセコ各店）は冬季限定なので HOURS に営業期間を書く。
  cafe commons は2025年3月閉店→倶知安で再開予定（未確認）。venue_id 修正候補: bar（薬膳BAR）・bar-jp（唐草）・balance-jp・log。

## 2026-08-23 Festival の country / city_region を Inbox 経由で直せるようにした

- 実施: `scripts/db/airtable_pipeline.py` の `FIELD_MAP` に `country` と `city_region` を追加。
  過去の巡回で notes に書いていた国の誤り8件（Field Maneuvers GB / ОСТРОВ RU / Beyond The Valley AT→AU /
  AfrikaBurn ZA + city_region Tankwa Karoo / Dockyard NL / Bosburcht NL / BUMBAYÉ CO）を Updates Inbox に pending で投入。
- コミット: 未。
- 検証: `apply --dry-run` は従来の提案で正常に動作。**新しい field_name=country の apply --execute は、ユーザー承認後の実機で未確認。**
  `country` は単一選択型だが typecast:true で新しい選択肢が作られる（既存の brand_status と同じ仕組み）。
- 変更したパターン: FIELD_MAP への2行追加。
- 未確認の類似パターン: Venues の country / city には同じ経路が無い（Inbox は target_festival のみ）。確認済み・0件（Festivals 側）。
- 次の担当への注意: 承認 → `apply --execute` のあと、Festivals の country が実際に変わったことを1件確認する。

## 2026-08-23 Festivals に ticket_url を追加

- 実施: Airtable Festivals に `ticket_url`（url 型）を API で新設。`airtable_pipeline.py` の `FIELD_MAP` に `ticket_url` を追加。
- コミット: 未。
- 検証: 列の作成を API の応答で確認（flda2tjHuI5ZuFpvO）。構文チェックのみ。apply の実機は country と同様に承認後に確認。
- 変更したパターン: FIELD_MAP への1行追加。
- 未確認の類似パターン: サイト側シートの `TICKETURL` とは別管理（Airtable → LP シートの同期は無い）。確認済み・0件。
- 次の担当への注意: 次回の巡回から ticket_url 空のフェスにチケットページを提案する。年で変わらない公式ページを優先。

## 2026-08-23 VENUE 巡回の結果を Airtable notes の「提案票」にした

- 実施: `scripts/db/venue_crawl.py` を新規作成（propose / apply、--dry-run 既定）。
  9 バッチの JSON から 160 行の Venues に提案票を書き込み（既存 notes は保持）。
- コミット: 未。
- 検証: propose は一致なし 0 / 複数一致 14（重複行）。apply --dry-run = 反映 107 / 保留 53 / 不正 0。
  「23時閉店」を閉店と誤判定する不具合を修正（CLOSED_RE）、再 propose で BAROOM だけが closed になることを確認。
  **apply --execute は未実行**（ユーザーが notes を見て判断してから）。
- 変更したパターン: 新規スクリプト。tokyo-bar-02.json の Upstairs を type=record-shop に修正。
- 未確認の類似パターン: Festivals には同じ提案票方式を入れていない（Inbox 方式のまま）。確認済み・0件。
- 次の担当への注意: 重複行（Grassroots/TENCUPS、濤 TOH×2、COUNTER CLUB×2、Open Source×2、Upstairs×2、THE TOKYO×2、
  THmC×2、Pure's×2、THE ROOM×2、LOOPY PURR×2、ALFFO×2）には同じ提案票が入っている。統合はユーザーが手で。

## 2026-08-23 Venues に CMS 入力用の列を追加

- 実施: Airtable Venues に area / address / lat / lng / genres / subtype / hours / charge を API で追加。
  `venue_crawl.py` の提案票に area / genres 行を足し、apply が area / address / subtype / hours / charge / genres を書くよう拡張。
  160 行の提案票を書き直した（area・address 入り）。
- コミット: 未。
- 検証: apply --dry-run で MEIMEI 等に area / address / hours / charge が入ることを確認（反映107 / 保留53 / 不正0）。apply --execute は未実行。
- 変更したパターン: venue_crawl.py の render_card / cmd_apply。
- 未確認の類似パターン: lat / lng は空のまま（住所からの一括変換は未実装）。genres は巡回 JSON に無いので提案票では空（ユーザーが書く）。
  CMS 側（LP シート・cms.js）には subtype / hours / charge をまだ入れていない（VENUES_BARS.md §6-1 の作業）。
- 次の担当への注意: area は日本（JP）の行だけ使う。海外は city のみ。image / desc / desc_en / capacity は Airtable に持たない（ユーザー決定）。

## 2026-08-23 VENUES §6-1: サイト側4列のPublish経路

### 実施

- `LP/cms.js` の `SHEET_FIELD_NAMES` に `subtype / hours / charge / features` を追加し、取得行の正規化対象にした。
- `buildVenuesJs()` が4列を `data.js` に出力するようにした。`features` は `;` と `,` の両方で分割して配列化する。
- `publishPayloadSummary()` のVENUES要約に4列の件数を追加し、列落ちを `features 5 → 0` のように確認できるようにした。
- `scripts/check_cms_publish_guard.mjs` に4列の要約、data.js出力、列落ち0件のテストを追加。
- LPシートのヘッダーは変更していない（ユーザーが末尾へ手動追加する前提）。

### コミット

- ローカルコミット済み（f5c628c7）。push・本番反映は未実施。

### 検証

- `node scripts/check_cms_publish_guard.mjs`: 成功。既存検査＋VENUES 4列検査。
- `node --check LP/cms.js`: 成功。
- 実ブラウザで既存VENUES一覧のJA/EN・390px/1280px表示を確認。390pxの計測はJA 593,347B / EN 612,656B、1280pxはJA 593,347B / EN 585,175B（EN全スクロール593,440B）。スクリーンショットは`reports/screenshots/venues-phase6-1-390/`と`reports/screenshots/venues-phase6-1-1280/`。
- `bash scripts/preflight.sh`: 全34件成功。

### 変更したパターン

- VENUES行の`subtype / hours / charge / features`取得・data.js出力。
- `features`のセミコロン・カンマ区切り配列化。
- Publish前の件数要約と列落ち検知。

### 未確認の類似パターン

- ユーザーがLPシート末尾へ4列を追加した実データの取得: 未確認。
- 認証済みCMSでPublish Nowを押し、`cms: publish data.js`コミットに`features`が含まれること: 未確認。
- CMS入力UIの4フィールド: フェーズ4ではなく§6-4対象のため未実装・未確認。

### 次の担当への注意・判断待ち

- LPシートのVENUESヘッダー末尾へ`SUBTYPE / HOURS / CHARGE / FEATURES`を手動追加してから、認証済みCMSでPublish Nowを1回実行する。
- Publish後の`data.js`で実際に`subtype / hours / charge / features`が出ることを確認するまで、フェーズ1完了とは扱わない。
- §6-2のハブUI、§6-3の詳細ページ、§6-4のCMS入力UIは今回の変更に含めない。

## 2026-08-23 VENUES §6-4: CMS入力欄

### 実施

- `LP/cms.html` の `v-type` 下に `v-subtype`（bar時のみ表示）、`v-hours`、`v-charge`、`v-features`（設計§2の13語）を追加。
- `LP/cms.js` のVENUESプレビュー、既存行の読込、編集保存、新規保存、コード生成、リセットに4項目を接続。
- 「Venue クイック追加」にTYPE選択（club / bar / livehouse）を追加。連続入力時もclub初期値を保持。
- `scripts/check_cms_layout.mjs` に入力欄、選択肢数、bar限定表示、プレビュー再表示保持の検査を追加。
- `LP/cms.html` の `cms.js` キャッシュバスターを `v=94` に更新。

### コミット

- ローカルコミット済み（このエントリを含む）。push・本番反映は未実施。

### 検証

- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_publish_guard.mjs`: 成功（既存検査を含む全項目）。
- `node scripts/check_cms_layout.mjs`: 成功。headless Chromeで入力欄・FEATURES 13語・bar時のSUBTYPE表示・プレビュー閉じる→再表示で値が残ることを確認。
- `bash scripts/preflight.sh`: 全34件成功。

### 変更したパターン

- VENUESの編集フォームで、barだけSUBTYPEを表示するパターン。
- FEATURESを既存GENREと同じチップUIで複数選択し、シートへ`; `区切りで保存するパターン。
- クイック追加でVENUE TYPEを選択し、初期値clubでdraft保存するパターン。

### 未確認の類似パターン

- 認証済みCMSでの実操作「入力 → プレビュー → 閉じる → 再表示 → 保存」およびGAS実保存: 未確認。
- 認証済みCMSで編集した行を再読込して4項目が復元される経路: 未確認。
- LPシートに実データを入力し、Publish後の `data.js` に4項目が反映される経路: 未確認（§6-1から継続）。

### 次の担当への注意・判断待ち

- 本番CMSへはまだ反映していない。認証済み環境でbarのテスト行を使い、4項目の入力値が保存後も残ることを確認する。
- 保存前にプレビューを閉じても入力欄の値は保持されるが、実GAS保存の成否は画面で確認すること。
- 確認後に初めてPublish経路を実機完了扱いにする。pushはユーザーの公開判断まで行わない。

## 2026-08-23 VENUES §6-2: 種別フィルタとカード情報

### 実施

- `LP/venues.html` に `[ALL] [CLUBS] [BARS] [LIVEHOUSE]` の種別フィルタを都市フィルタの上へ追加。
- 種別は `#type=bar` でURLに保持し、既存の `area` / `q` クエリと併用可能にした。
- 件数表示を `22 VENUES · CLUBS 13 · BARS 4 · LIVEHOUSE 5` 形式に変更。
- ALL時は `club → livehouse → bar`、種別選択時は名前順に並べ替え。
- barカードにSUBTYPE、`no-cover` のNO COVER、個性FEATURES（最大2個）を表示。cash-only等の実用メモは除外。
- 一覧フィルタと地図の `MAP_TYPES` が `currentType` を共有するように変更。
- `scripts/check_venue_type_filters.mjs` を追加し、preflightへ登録。
- `scripts/build-detail-pages.mjs` の `enHubFromJa` でENハブを再生成。

### コミット

- ローカルコミット済み（このエントリを含む）。push・本番反映は未実施。

### 検証

- `wc -l LP/venues.html LP/en/venues.html`: JA 1078行 / EN 1078行。
- `node scripts/check_venue_type_filters.mjs`: 種別4ボタン、`#type=bar`、bar 4件、ALL時の並び順、実用メモ非表示を実ブラウザで確認。
- `python3 scripts/check_hub_pages.py`: 全ハブ描画・地図・JA/ENフォールバック成功。
- `python3 scripts/audit_spa_vs_static.py --after`: SPA詳細なし、静的詳細リンク全件成功。
- `bash scripts/preflight.sh`: 全35件成功。
- 実ブラウザ計測（390px / 1280px、JA / EN）:
  - 390 JA: 初期597,571B / 全スクロール597,571B、画像2→25、LCP 2016ms、CLS 0.0682。
  - 390 EN: 初期597,664B / 全スクロール623,918B、画像2→25、LCP 2076ms、CLS 0.0682。
  - 1280 JA: 初期597,571B / 全スクロール597,571B、画像2→13、LCP 2460ms、CLS 0.0399。
  - 1280 EN: 初期589,399B / 全スクロール597,664B、画像1→22、LCP 2000ms、CLS 0.0560。

### 変更したパターン

- 都市・検索に加えて種別を独立状態として扱うフィルタパターン。
- ハッシュ（種別）とクエリ（都市・検索）を同時に保持するURLパターン。
- bar固有の補助ラベルと、個性FEATURESだけをカードへ出すパターン。
- 一覧と都市別Leaflet地図で種別状態を同期するパターン。

### 未確認の類似パターン

- 実データにSUBTYPE / CHARGE / FEATURESが入った状態で、実際のbarカードへ各ラベルが表示されること: 未確認（現在のdata.jsでは該当値が未反映）。
- 地図を開いた後に地図内の種別ボタンを操作し、一覧側へ反映される実機操作: 自動コード経路は検査済みだが、地図タイル表示を含む手操作は未確認。
- 認証済みCMSでのPublish後、本番相当のdata.jsを使ったJA/EN表示: 未確認。

### 次の担当への注意・判断待ち

- 本番へはまだ反映していない。先にCMSで4列を含むVENUESデータをPublishし、barカードの実表示を確認する。
- 実データ反映後、390pxでSUBTYPE / NO COVER / 個性タグが画像やVIEWボタンと重ならないことを再確認する。
- pushはユーザーの公開判断まで行わない。
