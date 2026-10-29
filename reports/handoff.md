# Session Handoff

セッション間の短期的な引き継ぎ専用ログです。
長い背景説明・事故の経緯・設計判断は [AUDIT_TECHNO_JAPAN.md](../AUDIT_TECHNO_JAPAN.md) に記録し、ここからリンクしてください。

## 2026-10-21 / Codex / CMS アーティスト英語欄の重複修正（未コミット）

### 実施
- `LP/cms.html` に追加していた静的な `<textarea id="a-bioEn">` を削除。
- 今回のプレビュー実装で追加していた `editRow`、`saveEdit` 2箇所、AI生成、reset、アーティストコード生成の `bio_en` 重複処理を元に戻した。
- `artistPreviewValue_('a-bioEn')` によるプレビュー参照は維持。`a-bioEn` は `buildPublishingSection` が生成する公開設定欄だけが所有する。
- `scripts/check_cms_artist_preview.mjs` に、cms.html の静的 `a-bioEn` が0個であること、公開設定側の動的生成と `getPubFields` / `setPubFields` の `bio_en` 経路が存在することの検査を追加。

### コミット
- 未コミット・未 push（ユーザー指定どおり）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_artist_preview.mjs`: 成功。
- `node scripts/check_cms_genre_roundtrip.mjs`: 成功（5件）。
- `node scripts/check_cms_preview_frame.mjs`: 成功。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `node scripts/check_cms_publish_guard.mjs`: 成功（44件）。
- `node scripts/check_cms_fetch_path.mjs`: 成功。

### 変更したパターン
- 静的フォーム欄と動的公開設定欄の同一 DOM id `a-bioEn` の重複: 静的欄0個・動的欄1個へ修正。
- プレビューだけが読む `a-bioEn` は維持。

### 未確認の類似パターン
- 実ブラウザで公開設定欄に入力した英語バイオが保存される操作: 未確認（Claude 実施予定）。
- 実ブラウザで Preview の日英切替と公開設定欄の値反映: 未確認。
- full preflight の再実行: 未確認。

### 次の担当への注意・判断待ち
- `a-bioEn` を cms.html に再追加しないこと。追加する場合は `buildPublishingSection` の動的欄との DOM id 重複を先に検査すること。
- 公開前に `bash scripts/preflight.sh` と実ブラウザ確認を実施すること。今回も commit / Publish / 本番データ書き込みは行っていない。

## 2026-10-21 / Codex / CMS アーティスト本番表示プレビュー（未コミット）

### 実施
- `openPreview('artist')` を本番 `/artists/<id>.html` の `cache: 'no-store'` テンプレートを iframe `srcdoc` で表示する方式へ変更。`detail-inner` 内の名前・地域・ジャンル・画像・画像位置・日英バイオ・リンクを入力値で差し替え、同一アーティストなら出演情報と関連記事を保持。
- 新規・404 などでテンプレートを取得できない場合は、紹介文のある公開済みアーティストを予備テンプレートに使用し、関連セクションを除去して公開時自動表示の注記を追加。取得自体に失敗した場合は既存簡易表示へフォールバック。
- iframe 内は `lang-toggle.js` 以外の script を除去し、計測・Service Worker を実行しない構成にした。PC / スマホ（390px）切替と入力中のライブ差し替えを追加。
- `bio_en` 欄（`a-bioEn`）の読込・保存・コード出力・リセットも追加。`cms.js?v=157`、`cms.css?v=47` に更新。
- `scripts/check_cms_artist_preview.mjs` を追加して preflight に登録。

### コミット
- 未コミット・未 push（ユーザー指定どおり）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_artist_preview.mjs`: 成功。
- `python3 scripts/check_asset_versions.py --no-diff`: 成功。
- 既存 `check_cms_genre_roundtrip.mjs` / `check_cms_preview_frame.mjs`: 成功。
- `bash scripts/preflight.sh`: 49件成功 / 10件失敗。詳細ページ生成は外部画像取得制限で240秒 timeout、?v検査は実行開始時点の `cms.css?v=46` を見て失敗（修正後の単独検査は成功）、ブラウザ系8件は localhost listen `EPERM`。全件成功とは判定しない。

### 変更したパターン
- アーティストの本番詳細テンプレート取得、`detail-inner` 差し替え、日英 `detail-body bilingual` 構造、計測 script 除去、iframe の PC / 390px 切替、`bio_en` フォーム往復。

### 未確認の類似パターン
- 実ブラウザで CMS のアーティスト編集→Preview、日英切替、PC / スマホ切替、入力変更、画像位置、同一／別テンプレートの出演情報表示: 未確認（Claude 実施予定）。
- テンプレート取得失敗時の簡易フォールバックを実ブラウザで確認: 未確認。
- ネットワーク取得が成功する環境での詳細ページ生成完走: 未確認。

### 次の担当への注意・判断待ち
- 公開前に `bash scripts/preflight.sh` をネットワーク／localhost listen 可能な環境で省略なし再実行すること。CMS の実ブラウザ確認が終わるまで公開済みとして報告しないこと。
- CMS を確認する際は `?cb=<乱数>` 付きで開き、`cms.js?v=157` を読み込ませる。今回の作業では本番データへの書き込み・Publish・commit は行っていない。

## 2026-10-21 / Codex / 完了（Google News sitemap の deploy 同期と stale 警告）

### 実施
- `.github/workflows/deploy-pages.yml` の詳細ページ再生成直後に `python3 scripts/generate-sitemap.py` を追加。既存の `git add -A LP/` により `sitemap.xml` と `sitemap-news.xml` を同じ `[skip ci]` 生成物コミットへ含める。
- deploy の checkout は既存どおり `fetch-depth: 0`。`generate-sitemap.py` の git 履歴ベース lastmod を維持し、浅い checkout 用の既存 lastmod 引き継ぎも保持。
- `scripts/check_feeds.mjs` に News sitemap 判定関数を切り出し、48時間超の公開済み記事は「公開時に自動で作り直されるので検査は止めない」という日本語警告、draft・存在しない記事は fail とした。

### コミット
- 未コミット・未 push（ユーザー指定どおり）。

### 検証
- `node scripts/check_feeds.mjs --self-test`: 成功（48時間超=警告のみ、draft=fail、正常=成功）。
- `node scripts/check_feeds.mjs`: 成功（RSS 20件、News sitemap 0件、関連記事40ページ）。
- `python3 scripts/generate-sitemap.py`: 成功（sitemap 384 URL、News sitemap 0件）。`sitemap.xml` は384 URL中86日付で、当日値は1件のみ。全件今日化していないことを確認。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 49件成功。ただし完走失敗。詳細ページ生成は外部画像取得待ちで240秒タイムアウト、ブラウザ系8件はこの sandbox の localhost listen `EPERM`。本番公開前にネットワーク・ブラウザ実行可能な環境で再実行が必要。
- 実ブラウザ確認: 未確認（上記 sandbox 制約）。

### 変更したパターン
- deploy の詳細ページ生成→sitemap生成→同一生成物コミット: 1経路。
- News sitemap の公開済み48時間超記事: 警告扱い。
- News sitemap の draft・存在しない記事、未来・日時不正: fail扱い。
- News sitemap 判定の自己テスト: stale / draft / fresh の3ケース。

### 未確認の類似パターン
- `deploy-pages.yml` の GitHub Actions 実行と、実際の生成物コミット・Pages公開: 未確認。
- ネットワーク取得が成功する環境での `build-detail-pages` 完走: 未確認。
- 実ブラウザでのハブ・CMS・地図・モバイル操作: 未確認（localhost listen EPERM）。

### 次の担当への注意・判断待ち
- 公開前に preflight をネットワーク／localhost listen 可能な環境で省略なし再実行し、9件の失敗が解消されたことを確認すること。`--fast` のみで公開しない。
- deploy の push は `[skip ci]` 付き既存経路のため、生成物同期コミットによる無限 deploy は起こさない設計。

## 2026-10-20 / Codex / 完了（アーティスト詳細ページ Phase A）

### 実施
- `scripts/build-detail-pages.mjs` に、bio/bio_en がともに空のアーティスト詳細（109件）の JA/EN `noindex,follow` を追加。リダイレクトスタブの `noindex` 完全一致判定とは別の印にし、ハブのリンクは維持。
- LINEUPS → EDITIONS → FESTIVALS の開催回付き出演情報を詳細専用マップで追加。出演予定は日付順最大6カード、過去出演はフェスごとに年（同年複数回は `#2`）を表示。
- 記事本文のアーティストリンク／安全な名前境界一致による関連記事を最大3件追加。draft は除外。
- 出演予定を反映した JA/EN タイトル・定型 description、薄いページの sitemap 除外を実装。
- `scripts/check_artist_pages.mjs` と `scripts/lib/artist-page-utils.mjs` を追加し、`preflight.sh` に登録。
- 追加修正: JA/ENタイトルを候補順選択に変更し、省略記号による途中切断を廃止。同一アーティスト・同一 `EDITION_ID` の出演重複を除外し、タイトル省略記号と出演予定カード重複の検査を追加。
- 追加修正: 5文字以下の名前一致を大文字小文字区別に変更。FUJI / `previously played Fuji Rock` の誤爆テストを追加。
- 変更前後の全記事一致監査（除外8件、残存名前一致のみ76件、前後30字）を [artist-article-match-audit-2026-10-20.md](artist-article-match-audit-2026-10-20.md) に保存。
- `node scripts/build-detail-pages.mjs` と `python3 scripts/generate-sitemap.py` で生成物を更新。JA/EN ハブのリンク行数は各139件で一致。

### コミット
- 未コミット。commit / push はユーザー指定により Claude が実施。

### 検証
- `node scripts/check_artist_pages.mjs`: 成功（thin=109、JA/EN noindex・sitemap、代表3件、出演日付順、過去年、名前境界）。
- `node scripts/check_titles.mjs`: 成功（JA 60字以内、EN 65字以内）。
- `python3 scripts/check_regressions.py`: 成功（回帰なし、出演ページ計128件）。
- 追加修正後の再生成・再検査: `node scripts/build-detail-pages.mjs`、`python3 scripts/generate-sitemap.py`、`check_artist_pages.mjs`、`check_titles.mjs`、`check_regressions.py` がすべて成功。
- `FUJI` の記事 `topia-2026-info` は名前一致から除外。リンク一致の挙動は維持。
- `python3 scripts/generate-sitemap.py`: 成功（570 → 352 URL、アーティスト詳細は source139 → 30件）。
- `PYTHONPYCACHEPREFIX=/tmp/techno-japan-pycache python3 -m py_compile scripts/generate-sitemap.py`: 成功。
- `git diff --check`: 成功。
- 実ブラウザ確認: 未確認（Claude が実施予定）。

### 変更したパターン
- アーティスト詳細の薄いページ判定・JA/EN robots・sitemap 除外: 109件×2。
- 開催回付き出演予定カード、過去出演年チップ、関連記事、出演予定連動 title/description: アーティスト詳細139件×2。
- 英数字名の境界一致（YAMA/Yamanashi、NOCO/Nocoffee）と短名除外。
- タイトル候補選択（JA 4候補／出演予定なし3候補、EN 3候補／出演予定なし2候補）: 省略記号なし。
- 同一 `EDITION_ID` の重複出演行: 1開催回1件へ統合。別 `EDITION_ID` は保持。

### 未確認の類似パターン
- 実ブラウザでの JA/EN アーティスト詳細の表示・カード操作: 未確認。
- 同年複数回開催の実データ表示: 自動生成ロジック確認済み、実ブラウザは未確認。
- 旧URLリダイレクトスタブの `Redirecting…` は、意図された完全一致 `noindex` スタブのためタイトル検査対象外。
- ハブ・TOP の既存 `XLINK.appearMap` 利用箇所: 既存形を維持し静的検査済み、実ブラウザは未確認。

### 次の担当への注意・判断待ち
- Claude は公開前に実ブラウザで JA/EN、PC/モバイルの代表アーティストを確認すること。薄いページは `noindex,follow`、bio が入った次回生成で自動的に index/sitemap へ戻る。

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

## 2026-08-23 VENUES §6-3: 詳細ページ情報と近隣会場

### 実施

- `scripts/build-detail-pages.mjs` のVENUES JSON-LDを変更。
  - `TYPE=bar`: `['BarOrPub', 'MusicVenue']`
  - `TYPE=club`: `['NightClub', 'MusicVenue']`
  - その他は従来どおり `MusicVenue`
- VENUE詳細の `INFORMATION` に `HOURS` / `CHARGE` を追加。空欄の場合は行を生成しない。
- 実用FEATURES（cash-only等）がある場合だけ `GOOD TO KNOW` を生成し、JAラベルと「最新の情報は公式サイトでご確認ください。」を表示。
- 近隣会場を座標距離順で最大4件に変更。種別を限定せず、座標が無い場合は同じ都市へフォールバック。
- `LP/detail.css` にINFORMATION / GOOD TO KNOWの見た目を追加し、詳細CSSバージョンを28へ更新。
- `scripts/check_venue_details.mjs` と `scripts/check_venue_details_browser.mjs` を追加し、preflightへ登録。

### コミット

- ローカルコミット済み（このエントリを含む）。push・本番反映は未実施。

### 検証

- `wc -l LP/venues/*.html LP/en/venues/*.html`: JA 3146行 / EN 3146行（各22ページ）。
- `node scripts/check_venue_details.mjs`: JSON-LD、INFORMATION、GOOD TO KNOW条件、近隣4件上限を22件×JA/ENで確認。
- `node scripts/check_venue_details_browser.mjs`: bar / club × JA / EN × 390px / 1280pxをheadless Chromeで描画確認。
- `python3 scripts/audit_spa_vs_static.py --after`: 静的詳細ページと通常リンクを確認。
- `bash scripts/preflight.sh`: 全36件成功。

### 変更したパターン

- VENUEの種別を検索エンジン向けJSON-LDの型へ反映するパターン。
- 任意データ（HOURS / CHARGE / FEATURES）を空欄時にHTMLへ出さないパターン。
- 実用FEATURESだけをGOOD TO KNOWへ翻訳表示するパターン。
- 座標距離順の近隣会場を最大4件、種別横断で表示するパターン。

### 未確認の類似パターン

- 実データにHOURS / CHARGE / FEATURESを入力してPublishした後の実ページ表示: 未確認（現在のdata.jsでは該当値が未反映）。
- 実データ付きbarのGOOD TO KNOWを実機で目視する経路: 未確認。
- CMS認証環境でのPublish Nowと、生成後の本番相当データ確認: 未確認。

### 次の担当への注意・判断待ち

- CMSで4列をPublishした後、bar詳細でHOURS / CHARGE / GOOD TO KNOWが表示されることを確認する。
- FEATURESの実用メモはカードには出さず、詳細のGOOD TO KNOWだけに出す。
- 本番反映はユーザーの公開判断まで行わない。

## 2026-08-23 VENUES CMSクイック追加用エクスポート

### 実施

- `scripts/db/venue_export_cms.py` を新規作成。
- Airtable Venues の `coverage_tier=editorial` かつ `on_site` 空欄だけを抽出し、
  `ID NAME CITY AREA TYPE ADDRESS URL INSTAGRAM GENRE SUBTYPE HOURS CHARGE FEATURES` の順でTSV化。
- `Name` は `scripts/db/venue_crawl.py` の BOM付き `NAME` 定数を流用。
- Airtableトークンは `data/migration/.airtable_token` を優先し、環境変数 `AIRTABLE_TOKEN` も利用可能。
- 既定は読み取り専用の `--dry-run`。IMAGE / DESC / DESC_EN は出力しない。
- 件数・出力列・列落ちをTSV本体と分離して標準エラーへ表示。`--output` 指定時はファイルへ保存。
- `scripts/check_venue_export_cms.py` を追加し、`scripts/preflight.sh` に登録。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `python3 scripts/check_venue_export_cms.py`: Airtable条件、TSV列順、配列整形、列落ち表示を確認。
- `python3 -m py_compile scripts/db/venue_export_cms.py scripts/check_venue_export_cms.py`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全37件成功。
- 実Airtableへ読み取り専用dry-run: 対象0件、列落ちなし、ヘッダー13列を確認。

### 変更したパターン

- Airtableの単一値・選択肢・配列をCMS貼り付け用TSVセルへ正規化するパターン。
- TSV本体を標準出力、診断情報を標準エラーへ分離するパターン。
- Airtableの書き込みを行わず、抽出条件と列落ちを可視化するパターン。

### 未確認の類似パターン

- 実Airtableに対象行が0件だったため、実データ1行以上をCMSへ貼り付ける経路: 未確認。
- CMSクイック追加へ貼り付け後の入力・保存・再表示: 未確認。
- 実データの `genres` / `features` がAirtable APIで配列以外の形式になった場合: 単体テストでは未確認。

### 次の担当への注意

- 対象行が出たら `python3 scripts/db/venue_export_cms.py --dry-run > venues.tsv` のようにTSVだけを保存し、CMSのVENUESクイック追加へ貼り付ける。
- `IMAGE / DESC / DESC_EN` は意図的に空欄。CMSで人が入力する。
- 対象0件は「抽出条件に一致する行がない」状態であり、エクスポート失敗ではない。
- push・本番反映はユーザーの公開判断まで行わない。

## 2026-08-23 ARTICLE集中モードのイベントカード操作

### 実施

- `LP/cms.js` の記事プレビューに操作処理を追加。
- 集中モードの固定プレビュー内で、カレンダーの `#ev-...` リンクをページ全体のハッシュ遷移にせず、プレビュー内の該当イベントカードへ移動するよう変更。
- イベントカードと公式リンクの `pointer-events` / z-index を明示し、集中モードでもクリック可能にした。
- `LP/cms.css` と `LP/cms.html` のキャッシュバージョンを更新。
- `scripts/check_cms_layout.mjs` に集中モードのイベントカード操作検査を追加。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_layout.mjs`: 実ブラウザでイベントカードの公式リンクとカレンダーリンクが操作可能、ハッシュ変更なし、カード移動を確認。
- `bash scripts/preflight.sh`: 省略なしで全37件成功。
- `git diff --check`: 成功。

### 変更したパターン

- 固定表示されたCMSプレビュー内で、内部アンカーをプレビュー領域内スクロールへ変換するパターン。
- 外部公式リンクは通常のリンク遷移を維持し、内部カレンダーリンクだけをプレビュー内で処理するパターン。

### 未確認の類似パターン

- 認証済みCMSで実際にイベントカードを入力し、集中モードを開いて公式リンクを押す操作: 未確認。
- 実データの複数イベント・複数カレンダーを含む長文記事での操作: 未確認。
- 実機スマートフォンでのCMS集中モード操作: 未確認。

### 次の担当への注意

- CMSで記事を開き、プレビューを表示した状態で集中モードへ入り、カレンダーのイベント名とカードの公式リンクを確認する。
- 本文入力欄のショートコード自体は編集用テキストであり、イベントカードの操作はプレビュー側で行う。
- Publish Now と本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTICLE集中モード後のプレビュー表示修正

### 実施

- 集中モード開始前にプレビューを開いていなくても、集中モード内の「プレビュー」ボタンでイベントカードとカレンダーを表示できるよう修正。
- 集中モード終了時に、表示・非表示のインライン状態が通常画面へ残らないよう後始末を修正。
- `LP/cms.html` の `cms.js` キャッシュバージョンを96へ更新。
- `scripts/check_cms_layout.mjs` に「集中モード開始後にプレビューを開く」実ブラウザ検査を追加。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/check_cms_layout.mjs`: 実ブラウザで集中モード開始後のプレビュー表示、イベントカード表示、カレンダー操作を確認。
- `node --check LP/cms.js`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全37件成功。

### 変更したパターン

- 集中モード開始前のプレビュー状態に依存せず、集中モード内のボタンから表示状態を切り替えるパターン。
- 集中モード終了時に、固定プレビューの表示状態とデータ属性を通常画面へ持ち越さないパターン。

### 未確認の類似パターン

- 認証済みCMSで実際に本文へイベントカードとカレンダーを挿入し、集中モード内で表示する操作: 未確認。
- 実機スマートフォンでのCMS集中モード操作: 未確認。
- Publish Now後の本番相当ページでの表示: 未確認。

### 次の担当への注意

- プレビューを先に開く必要はない。集中モードへ入り、上部の「プレビュー」を押すと右側に本文プレビューが表示される。
- カレンダーのイベント名を押すと、同じプレビュー内のイベントカードへ移動する。
- Publish Nowと本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTICLEプレビューのカードCSSバージョン整合

### 実施

- 本番表示プレビューの `detail.css` 参照を `v=28` から `v=29` へ更新。
- 実ページのコンパクトなイベントカードCSSが、本番表示プレビューでも読み込まれるようにした。
- `cms.js` 更新に伴い `cms.js?v=99`、CMSプレビューCSS更新に伴い `cms.css?v=33` へ更新。
- プレビュー検査と実ブラウザ検査の期待バージョンも更新。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `node scripts/check_cms_layout.mjs`: 実ブラウザ確認成功。
- `bash scripts/preflight.sh`: 省略なしで全38件成功。
- preflightで検出された `cms.js` / `cms.css` の参照バージョン漏れを修正後、再実行して成功。

### 変更したパターン

- CSS本体のバージョン更新と、CMSの別ウィンドウプレビュー参照を同時に更新するパターン。
- キャッシュ検査の失敗を公開前に修正し、再検証するパターン。

### 未確認の類似パターン

- 実機ブラウザで本番表示プレビューを開き、コンパクト化されたカードを目視する経路: 未確認。
- 実データの長いイベント名・長い会場名でのスマホ表示: 未確認。

### 次の担当への注意

- 本番表示プレビュー確認時はブラウザを強制更新する。
- 日程は12px、カードの上下余白は従来より小さくなっている。
- Publish Nowと本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTICLEイベントカードのコンパクト化

### 実施

- `LP/detail.css` のイベントカードを調整。
- 日程表示を10pxから12pxへ拡大。
- カードの上下パディング、日程・場所の間隔、カード外側の余白を縮小し、縦に短くした。
- 390px向けにも余白を縮小。
- `LP/cms.css` のARTICLEプレビュー側にも同じカードバランスを追加。
- `DETAIL_CSS_VERSION` を29へ更新して静的ページを再生成。
- キャッシュ検査で検出された `cms.js` の参照漏れを修正し、`cms.js?v=98`へ更新。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- 静的ページ再生成: 成功。
- `node scripts/check_cms_layout.mjs`: 実ブラウザ確認成功。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `node --check scripts/build-detail-pages.mjs`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全38件成功。
- 途中のpreflightで `cms.js?v=97` の更新漏れを検出し、v98へ修正後に再実行して成功。

### 変更したパターン

- 日程の視認性を上げながら、イベントカード全体の縦余白を減らすパターン。
- 本番詳細ページとCMSプレビューでカードの余白・文字サイズを揃えるパターン。

### 未確認の類似パターン

- 実データを入力した記事を認証済みCMSの「本番表示」で目視する経路: 未確認。
- 実機スマートフォンで複数行の長いイベント名を含むカード: 未確認。
- 英語表示での日程ラベルの見え方: 未確認。

### 次の担当への注意

- 日程は読みやすくするため12pxに拡大し、カードは従来よりコンパクトになっている。
- 本番表示を再確認する際は、ブラウザを強制更新してから確認する。
- Publish Nowと本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTICLE本番表示プレビューのイベント表示

### 実施

- `openArticleGeneratedPreview()` でも `article-shortcodes.js` の共通関数を使い、`[[event]]` と `[[calendar]]` をHTMLへ変換するよう修正。
- 本番表示プレビューの `article-detail-inner` 構造と `common.css` / `detail.css` / `article-fx.css` のバージョンを実ページと一致させた。
- 独自の見出しCSSを削除し、本番と同じ `detail.css` の見出し2折り返しを使用。
- `scripts/check_cms_article_generated_preview.mjs` を追加し、preflightへ登録。
- `scripts/check_cms_layout.mjs` に本番表示プレビューのイベント・カレンダー変換検査を追加。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `node scripts/check_cms_layout.mjs`: 実ブラウザ相当でイベントカード・カレンダー・本番CSSを確認。
- `node --check LP/cms.js`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全38件成功。

### 変更したパターン

- CMS内プレビューと別ウィンドウの本番表示プレビューで同じショートコード変換関数を使うパターン。
- 本番ページと同じCSS構造・バージョンを使い、見出しの折り返しを一致させるパターン。

### 未確認の類似パターン

- 認証済みCMSで実際に入力・保存した本文を別ウィンドウの本番表示プレビューで確認する操作: 未確認。
- 英語本文の本番表示プレビュー: 未確認（現在の本番表示プレビューはJA設定）。
- 実機スマートフォンでの見出し折り返し: 未確認。

### 次の担当への注意

- 「↗ 本番表示」を押す前に本文を保存する必要はない。現在の入力内容からプレビューを生成する。
- イベントカードを1件以上追加してから `[[calendar]]` を挿入する。
- Publish Nowと本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTICLE集中モードのイベント入力ダイアログ修正

### 実施

- 集中モードの本文領域よりイベントカード入力ダイアログが背面になる問題を修正。
- `openArticleEventForm()` のダイアログを `z-index: 2100` とし、集中モードの `z-index: 2000` より前面に表示。
- `LP/cms.html` の `cms.js` キャッシュバージョンを97へ更新。
- `scripts/check_cms_layout.mjs` に、集中モード中のイベント入力ダイアログの表示・前面・サイズ検査を追加。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/check_cms_layout.mjs`: 実ブラウザで集中モード中のイベント入力ダイアログ表示を確認。
- `node --check LP/cms.js`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全37件成功。

### 変更したパターン

- フルスクリーン編集領域内から開くモーダルを、編集領域より前面に配置するパターン。
- UIのz-index関係を実ブラウザで矩形・表示状態として検査するパターン。

### 未確認の類似パターン

- 認証済みCMSで実際に入力フォームへ値を入れて「本文に挿入」する操作: 未確認。
- 実機スマートフォンでの集中モードとイベント入力操作: 未確認。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- 集中モード中でも、上部の「📦 イベントカード」ボタンから入力フォームを開ける。
- 入力後は「本文に挿入」を押し、必要なら「📅 カレンダーを挿入」を押す。
- Publish Nowと本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 TOP ARTISTS画像ありランダム表示

### 実施

- `LP/index.html` と生成済みの `LP/en/index.html` のTOP ARTISTSを、画像が登録されているアーティストだけの候補に変更。
- Fisher–Yates方式でページ訪問ごとに順番をシャッフルし、最大16件を表示。
- 既存のカルーセル、自動スクロール、通常リンク、`data-bg`による遅延背景画像読み込みは維持。
- `scripts/check_top_artists.mjs` を追加し、`scripts/preflight.sh`へ登録。

### コミット

- ローカルコミット済み（このエントリを含む）。push・本番反映は未実施。

### 検証

- `node scripts/check_top_artists.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内のハブ実ブラウザ確認（JA/ENを含む）: 成功。

### 変更したパターン

- 画像ありアーティストのみを抽出するパターン。
- `sort(() => Math.random() - .5)`ではなくFisher–Yatesでランダム化するパターン。

### 未確認の類似パターン

- 実機スマートフォンで複数回リロードし、表示順が変わることの目視: 未確認。
- 画像あり候補が16件未満の場合のTOP上限表示: 自動検査のみ。

### 次の担当への注意

- 画像がないアーティストはTOP ARTISTSには表示しない仕様。
- 表示順は固定ではないため、特定アーティストの掲載位置を前提にしない。
- Publish Now・push・本番反映はユーザーの公開判断まで行わない。

## 2026-08-24 ARTISTSスマホ導線の整理

### 実施

- `LP/artists.html` のアルファベット一覧フィルター（A〜Z・#）と関連JavaScript/CSSを削除。
- 副題 `DJS · PRODUCERS · SELECTORS`、検索、ジャンルフィルター、`A → Z`並び替えは維持。
- スマホのARTISTSページヘッダー上部余白を縮小し、一覧へ早く到達できるようにした。
- `scripts/build-detail-pages.mjs` の `enHubFromJa` 経由で `LP/en/artists.html` を再生成。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- JA/EN両方からアルファベット一覧のDOM・CSS・JSが消えていることを確認。
- `node scripts/build-detail-pages.mjs`: 成功。EN artists hubをJAから再生成。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内の実ブラウザによるハブ描画確認（JA/EN）: 成功。
- 生成処理後の意図しない差分: なし（変更はJA/EN artists hubのみ）。

### 変更したパターン

- 一覧性の低いアルファベットジャンプUIを削除し、検索・ジャンル・並び替えへ操作を集約するパターン。
- スマホだけページヘッダーの上下余白を縮小するパターン。

### 未確認の類似パターン

- 実機スマートフォンでの検索・ジャンル絞り込み・A→Z並び替えの連続操作: 未確認。
- PC幅でアルファベット一覧削除後の一覧密度: 実ブラウザ目視未確認。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- アーティスト名から探す場合は検索欄を使う。A〜ZのジャンプUIは廃止済み。
- 副題はブランド・ページ説明として残している。
- コミット・push・本番反映はユーザーの確認後に行う。

## 2026-08-24 Publish空コミット対策・GAS VENUES列手貼り資料

### 実施

- `LP/cms.js` のPublish要約を `SUBTYPE / HOURS / CHARGE / FEATURES` 表記へ変更し、`FEATURES n件`を確認できるようにした。
- 公開中の`data.js`を取得できない場合は送信を止めるfail-closedへ変更し、比較不能な状態で空コミットを作らないようにした。
- `LP/cms.html` の`cms.js`参照をv99からv100へ更新。
- `scripts/gas-update/venue-columns.patch.gs` を追加。GAS `Code.gs`の既存`COLUMNS`へ`DESC_EN / SUBTYPE / HOURS / CHARGE / FEATURES`を追加する手貼り用資料と確認関数を用意。
- `scripts/gas-update/README.md` に貼り替え・再デプロイ・`snapshot.js`実行・実差分確認の手順を追加。
- `scripts/check_gas_venue_columns.mjs` を追加し、preflightへ登録。
- `scripts/check_cms_publish_guard.mjs` に空コミット防止とFEATURES件数の検査を追加。

### コミット

- 未コミット。push・本番反映は未実施。
- GAS実物への貼り付け・再デプロイも未実施。

### 検証

- `node scripts/check_gas_venue_columns.mjs`: 成功。
- `node scripts/check_cms_publish_guard.mjs`: 成功。
- `node scripts/check_cms_fetch_path.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全40件成功。
- preflight内の実ブラウザ確認（CMSレイアウト・JA/ENハブ）: 成功。

### 変更したパターン

- 公開中データと比較できないときにPublishを止める、空コミット防止のfail-closedパターン。
- Publish前のデータ要約で、VENUESの4列を大文字ラベルと件数で明示するパターン。
- 機密設定を含むGAS本体をリポジトリへ持ち込まず、必要な列差分だけを手貼り資料として管理するパターン。

### 未確認の類似パターン

- GASへ`venue-columns.patch.gs`の内容を貼り、再デプロイした実機経路: 未確認。
- `snapshot.js`実行後の`live-snapshot.json`更新と`node scripts/check_gas_sync.mjs`: 未確認。
- 認証済み本番CMSで`FEATURES n件`を確認し、`cms: publish data.js`に`LP/data.js`の実差分が出ること: 未確認。
- Publish後のGitHub Actions成功と本番反映: 未確認。

### 次の担当への注意・判断待ち

- `COLUMNS`は既存列を消さず、`DESC_EN`（無い場合）と4列だけを末尾へ追加する。
- GASは保存だけでは本番に反映されない。必ず新バージョンとして再デプロイする。
- `FEATURES n件`が0件の場合は列落ちの可能性があるため、空コミットを成功扱いにしない。
- GAS貼り付け後に、ユーザーとClaudeで実機Publish→実差分commit→Actions成功を確認してから、ARTISTS変更の公開タイミングを判断する。

## 2026-08-24 ARTISTS 1280px以上の3列表示

### 実施

- `LP/artists.html` に1280px以上だけ3列にするメディアクエリを追加。
- 1279px以下は2列、640px以下は1列の既存リスト表示を維持。
- `enHubFromJa`で`LP/en/artists.html`を再生成。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/build-detail-pages.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内の実ブラウザによるハブ描画確認（JA/EN）: 成功。

### 変更したパターン

- 1280px以上の広い画面では3列にして一覧性を高めるレスポンシブパターン。
- 中間幅では2列、スマホでは1列にして、名前・ジャンル・地域の可読性を保つパターン。

### 未確認の類似パターン

- 実機1280px以上での長いアーティスト名とホバープレビューの目視: 未確認。
- 1280px未満のPC幅で2列へ戻る状態: 未確認。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- ローカルでは1280px、1024px、390pxの3幅で列数を確認する。
- 3列表示でも名前・ジャンル・地域が詰まりすぎないことを確認する。
- コミット・push・本番反映はユーザーの確認後に行う。

## 2026-08-24 ARTISTSスマホ一覧表示の試作

### 実施

- `LP/artists.html` のスマホ幅（640px以下）だけ、画像カードをコンパクトなリストへ変更。
- サムネイルは64pxに縮小し、名前・ジャンル・地域を優先表示。
- PCのカード表示とデスクトップのホバープレビューは維持。
- 画像が無いアーティストも同じ行高で表示できる構造を維持。
- `enHubFromJa`で`LP/en/artists.html`を再生成。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/build-detail-pages.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内の実ブラウザによるハブ描画確認（JA/EN）: 成功。

### 変更したパターン

- モバイルでは画像を主役にせず、名前を短時間で走査できるリストにするパターン。
- PCでは視覚的なカードとホバープレビューを残し、端末ごとに情報密度を変えるパターン。

### 未確認の類似パターン

- 実機スマートフォンで画像あり・画像なし・長いアーティスト名を含む一覧の目視: 未確認。
- 検索・ジャンル絞り込み後のリスト表示: 未確認。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- ローカルでは390px程度の幅で、1画面に複数アーティストが見えるかを確認する。
- PC幅では従来のカードレイアウトが維持されていることを確認する。
- 現時点は試作段階で、コミット・push・本番反映はユーザーの確認後に行う。

## 2026-08-24 ARTISTS PCリスト表示の試作

### 実施

- `LP/artists.html` のPC表示を、4列の大きな画像カードから2列の情報リストへ変更。
- PCサムネイルは80px、名前・ジャンル・地域を優先表示。
- 既存のPCホバープレビューは維持。
- スマホは既存の1列リスト表示を維持。
- `enHubFromJa`で`LP/en/artists.html`を再生成。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- `node scripts/build-detail-pages.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内の実ブラウザによるハブ描画確認（JA/EN）: 成功。

### 変更したパターン

- PCも情報検索を優先した2列リストにし、画像とホバー演出を補助にするパターン。
- PCとスマホでリスト密度だけを変え、基本の情報構造を揃えるパターン。

### 未確認の類似パターン

- 実機PCでのホバー時プレビュー位置とリスト行の視認性: 未確認。
- 実機スマートフォンでの1列リスト表示: 未確認。
- 検索・ジャンル絞り込み後のPC/スマホ表示: 未確認。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- ローカルでは1280pxと390pxの両方で確認する。
- PCでは2列、スマホでは1列のリストになることを確認する。
- 画像あり・画像なしの行で高さが崩れないことを確認する。
- コミット・push・本番反映はユーザーの確認後に行う。

## 2026-08-24 ARTISTSの並び替えUI削除

### 実施

- ARTISTSの大きな`A → Z` / `Z → A`セレクトを削除。
- アーティスト一覧の内部ソートはA–Z固定に変更。
- 検索・ジャンルフィルター・件数表示は維持。
- URLから`sort`パラメータを扱う処理も削除し、不要な状態を残さないようにした。
- `enHubFromJa`で`LP/en/artists.html`を再生成。

### コミット

- 未コミット。push・本番反映は未実施。

### 検証

- 不要な`artists-sort` / `currentSort` / アルファベット一覧関連コードがJA/ENに残っていないことを確認。
- `node scripts/build-detail-pages.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 省略なしで全39件成功。
- preflight内の実ブラウザによるハブ描画確認（JA/EN）: 成功。

### 変更したパターン

- 並び替え操作を常時表示せず、A–Z固定で検索・ジャンル選択に集中させるパターン。

### 未確認の類似パターン

- 実機スマートフォンでの検索・ジャンル絞り込み後のA–Z固定表示: 未確認。
- 既存URLに`?sort=z-a`が付いている場合の利用者影響: 未確認（現在はA–Z固定へ統一）。
- Publish Now後の本番反映: 未確認。

### 次の担当への注意

- A–Z / Z–Aの切り替えUIは廃止済み。アーティスト一覧は常にA–Z順。
- 並び順を将来変更する場合は、検索・ジャンル操作の邪魔にならない小さな補助UIとして再設計する。
- コミット・push・本番反映はユーザーの確認後に行う。

## 2026-08-24 VENUE 反映 89 件・ビュー整備・ジャンル提案

- 実施: `venue_crawl.py apply --only-decided --execute` でユーザーが決めた 89 件（editorial 72 / skip 17）を反映。
  Airtable の `notes` を multilineText に作り直し（旧 singleSelect は `notes_legacy`）。
  ビュー「TJ 掲載判断」「TJ 掲載情報（載せる店）」を Chrome で作成。載せる店 63 件に genres を提案として書込。
- コミット: venue_crawl.py の --only-decided は `74e0fbfc` 以降にコミット済み。handoff は本エントリ。
- 検証: apply を2回実行し、2回目が「反映 0」（二重反映なし）。
- 変更したパターン: venue_crawl.py apply（--only-decided、coverage_tier プルダウン優先）。
- 未確認の類似パターン: 未判断 71 件は directory のまま。Codex 依頼1・2（LP シート列・CMS 入力欄）は未着手。
- 次の担当への注意: 掲載可否はユーザーが決めた値が正（AI の verdict と違っても直さない）。

## 2026-08-24 Airtable Editions × LP EDITIONS の二重管理検査を追加

- 実施: `scripts/db/check_edition_overlap.py` を新規作成。LP/data.js の FESTIVALS と Airtable Editions を照合。
- コミット: 済み。
- 検証: 実データで「重なり 0 / 重複 0 / 形式エラー 0」。偽の重なり（cluster-festival）を注入して exit 1 と警告文が出ることも確認。
- 変更したパターン: 新規スクリプトのみ。
- 未確認の類似パターン: LINEUPS の二重管理は未検討（Airtable に LINEUPS 相当は無し）。確認済み・0件。
- 次の担当への注意: 国内フェスの開催回は LP シートの EDITIONS が正。Airtable に作らない（巡回もこのルールに従う）。

## 2026-08-24 ローカルCMSからは Publish できない（CSPを足さない方針を明文化）

- 実施: ローカルCMS（`http://127.0.0.1:8000/cms.html`）で Publish の公開確認ダイアログを検証。
  素の状態では**ダイアログ手前で停止**することを実測。原因は `LP/cms.html` の CSP
  `connect-src` に `techno-japan.media` が無く、変更後の `fetchPublishedDataJs()` が
  本番 data.js を読めずに throw するため。ユーザー判断で**CSPは足さない**（ローカルからは
  本番へ出さない）。代わりに「失敗が仕様であること」を3箇所に明記した。
  1. `LP/cms.js` `fetchPublishedDataJs()` — ホストが本番でなければ
     「ローカルからは Publish できません。これは仕様です」と原因つきで言い切る
  2. `LP/cms.html` CSP コメント — `techno-japan.media` が無いのは忘れではない旨
  3. `AUDIT_TECHNO_JAPAN.md` §9-95 — 経緯・切り分け・判断理由
- コミット: **未コミット**（ユーザーが最終確認後に本番pushへ進む予定）。
- 検証:
  - CSP が原因であることの切り分け: `curl -I -H "Origin: http://127.0.0.1:8000"
    https://techno-japan.media/data.js` → `HTTP/2 200` / `access-control-allow-origin: *`。
    **CORSは無関係、CSP単独**と確定。ブラウザ実測は `TypeError: Failed to fetch`。
  - 公開確認ダイアログの内容（`fetchPublishedDataJs` を一時差し替えて到達、1280px / 500px で同一）:
    `VENUES 22件（SUBTYPE 1 / HOURS 1 / CHARGE 0 / FEATURES 3）`。大文字ラベル化は正常、
    FEATURES は 0 ではない。
  - 数字の検算: GAS `get_sheet&sheet=VENUES` を直接集計し
    `total 22 / subtype 1 / hours 1 / charge 0 / features 3` で**ダイアログと完全一致**。
    CHARGE 0 はデータ未入力（ユーザー確認済み）で、GAS の列落ちではない。
  - **新メッセージの実ブラウザ確認（1280px）**: 差し替え無しの素の状態で Publish Now を押し、
    失敗パネルに「ローカル（127.0.0.1）からは Publish できません。これは仕様です。」＋
    CSP が原因である旨＋本番CMSへの誘導が3段落で表示されることを確認。
  - `bash scripts/preflight.sh`: **全40件 成功**。
    （Publish 経路の変更を検知して「実機で1回通すまで完了にしない」警告が出る。下記のとおり未確認）
  - Console: クリーンなスーパーリロード後 0件。Publish 実行中の赤字はアプリ自身が意図して
    出す「Publishをキャンセルしました」「ローカルからは Publish できません」等のみ。
  - **Publish Now は毎回キャンセルで終了。GASへの `publish_data_js` 送信は0回**
    （送信遮断ガードの発動回数0＝そもそも到達せず）。GitHub操作・push は行っていない。
- 変更したパターン: `fetchPublishedDataJs()` の catch で、`location.hostname` が
  `techno-japan.media` 以外なら仕様である旨のメッセージを投げる分岐を追加。
  併せて本番ホスト名を定数 `PROD_CMS_HOST` に切り出した（同名の既存識別子なし・確認済み）。
- 未確認の類似パターン:
  - **本番CMS上での `fetchPublishedDataJs` の動作: 未確認。** 同一オリジンなので `'self'` で
    通る想定だが未検証。本番CMSで Publish Now を1回通すまで完了にしない（AGENTS.md）。
  - GAS COLUMNS の手貼り: **確認済み・適用済み**（下記の追記を参照）。
  - **390px 幅: 未確認。** Chrome がウィンドウを500px未満にできず（実測 `innerWidth=500`）、
    iframe での回避も cms.html 自身の `frame-src 'none'` に阻まれた。到達可能な最小幅
    500px で確認し、1280px と同一の内容を得た。
  - 公開確認ダイアログは `confirm()`（ブラウザ標準）であり、ページ幅の影響を受けず
    スクリーンショットにも写らない。上記の文面は実行時に捕捉した実物。
  - 他の CMS 画面から本番オリジンへ通信する箇所: 確認済み・0件
    （`connect-src` を要するのは GAS と nominatim のみ）。
- 次の担当への注意:
  - **ローカルで Publish が失敗するのは正常。** CSP に `techno-japan.media` を足せば
    通るが、足さないことが方針。触る前に §9-95 を読むこと。
  - `publishPayloadSummary` の表示をローカルで見るには `fetchPublishedDataJs` の
    一時差し替えが要る。差し替えたまま放置しないこと（空コミット防止ガードが死ぬ）。
  - 本番pushの前に `bash scripts/preflight.sh` を全件通すこと。

## 2026-08-24 GAS COLUMNS は適用済みだった／手順書が実物と食い違っていた

- 実施: 「GAS 手貼りが未確認」を解消するため、Apps Script「Techno Japan」を
  **読み取りのみ**で開いて実物を確認した。結果、**作業は不要**（すでに適用・デプロイ済み）。
  一方で、リポジトリの手順書が実物と食い違っていたため訂正した。
- コミット: **未コミット**（ユーザーが最終確認後に本番pushへ進む予定）。
- 検証:
  - `コード.gs` 冒頭の `const COLUMNS = [...]` に
    `desc_en / subtype / hours / charge / features` が**すべて存在**（実物を目視）。
  - アクティブなデプロイは **バージョン62（2026/08/24 14:35）**。デプロイIDは
    `cms.js` の `GAS_URL`（`AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nf...`）と一致。
    **保存だけでなく再デプロイまで完了している。**
  - `node scripts/check_gas_venue_columns.mjs` → ✅。
    大文字を注入すると exit 1（`手貼りパッチのVENUE_COLUMNS_REQUIREDが大文字`）になることも確認。
    検査が素通りしないことを実証済み。
- 変更したパターン: **列名の大文字→小文字の訂正**を3ファイルに適用。
  実物の `COLUMNS` は既存要素を含めすべて小文字で、CMS のペイロードキーも小文字。
  手順書だけが大文字（`'DESC_EN', 'SUBTYPE', ...`）を指示しており、そのとおりにすると
  AUDIT §9-69「大文字小文字で値が消える」を再現する状態だった。
  1. `scripts/gas-update/venue-columns.patch.gs` — 小文字化。`assertVenueColumnsPatch_()` は
     大文字小文字を問わず突き合わせるようにし、冒頭に「適用済み」の状態を明記。
  2. `scripts/gas-update/README.md` — 冒頭に「✅ 適用済み。作業は要らない」と実物のCOLUMNSを
     記載。手順は再適用用として残し、コード例を小文字に訂正。
  3. `scripts/check_gas_venue_columns.mjs` — 期待値を小文字に。加えて、大文字で書き戻されたら
     落ちるガードを追加。**散文ではなくコード部分だけ**を見る（最初に散文まで拾って
     正しい手順書を落としたため、その場で修正した）。
- 未確認の類似パターン:
  - `assertVenueColumnsPatch_()` の **Apps Script 上での実行: 未実施**。
    COLUMNS は目視で確認済みのため実行しなくても結論は変わらないが、
    関数そのものの動作は未検証。
  - `live-snapshot.json` は 2026-08-10（バージョン59）のまま。**バージョン62 に未更新**。
    更新には Apps Script エディタのコンソールで `snapshot.js` を実行する必要がある（未実施）。
    ただし `check_gas_sync.mjs` が見るのは AI 系3関数の指紋で、今回の COLUMNS 変更は対象外。
  - CMS で SUBTYPE / HOURS / CHARGE / FEATURES を**入力して保存する**経路: 未確認。
    COLUMNS が揃ったので通る想定だが、実機で保存→再表示までは見ていない。
- 次の担当への注意:
  - **GAS の手貼りは終わっている。もう一度貼らないこと。** 特に大文字で足さないこと。
  - 手順書を書くときは、実物を開いて確かめてから書く。今回は実物が小文字なのに
    手順書が大文字を指示していた（Publish の実機調査から起票された想定ベースの記述）。

## 2026-08-24 🚨 本番が 8/14 から更新されていない（Publish pipeline が10日間失敗）

**公開作業を中断した。原因はデータ側にあり、勝手に直さず報告する（AGENTS.md）。**

- 実施: `feat/list-visual` を `main` へ出す準備として、ブランチに `origin/main` を取り込み
  （衝突なし）、詳細ページを再生成しようとしたところビルドが停止。切り分けの結果、
  **本番が2026-08-14から更新されていない**ことが判明した。公開は行っていない。
- コミット: `a92f81a3` Merge origin/main into feat/list-visual（**ローカルのみ・未push**）。
  preflight が落ちる状態のため pre-push フックを通せない。`--no-verify` は使わない。
  それ以前の6件（`90e3cc27`〜`67a1f8d1`）は push 済み（ブランチのみ・本番未反映）。
- 検証:
  - **本番と main の data.js が違う。** 本番 = アーティスト96名（joma/noritake を含む）。
    main の `LP/data.js` = 94名（含まない）。`curl` で実測。
  - **Publish pipeline は 2026-08-14 05:40 の成功を最後に、以降すべて失敗。**
    08-17 10:07 / 08-17 13:59 / 08-17 14:18(手動) / 08-23 17:38 → 全て failure。
    08-24 02:25〜02:36 UTC の `cms: publish data.js` 3件（`bc837416` / `207eac82` /
    `497e0354`）は**空コミットのため paths に一致せず、ワークフローが起動すらしていない**。
    **【訂正 2026-08-24】** 当初この3件に `075fb6d2` を含めて書いたが誤り。
    `075fb6d2` は1ファイル152行追加の実コミットで、JST 08-24 02:37 = UTC 08-23 17:37。
    上表の 08-23 17:38 の失敗run がこれにあたる（gitはJST・ActionsはUTCで9時間ずれる）。
  - 08-23 の失敗理由: `EDITIONS: ID重複 "grow-the-culture-open-air-2026"（42行目と109行目）`。
    **この重複は現在のシートでは解消済み**（EDITIONS 109行 / 重複0件を実測）。
  - 現在の停止要因は別。`build-detail-pages.mjs` が
    `lineups.json: ARTIST_ID 参照切れ 2件` で停止する。
  - **参照切れの正体（実測）**: ARTISTS シートに `joma`(76行) と `noritake`(88行) は
    存在するが、STATUS が **draft**。data.js は draft を除くため 94名になり、
    LINEUPS の `matricaria-2026` がその2名を参照したまま残っている。
    （ARTISTS 130行の内訳: published 28 / 空欄 66 / draft 36）
  - ローカル `LP/data/lineups.json` は 2026-08-14 生成で古い。実シートは 536行で
    `synapse-festival-2025` の参照は既に無く、残るのは `matricaria-2026` の2行のみ。
  - `origin/main` 単体でも同じビルドエラーになることを隔離ワークツリーで確認。
    **この不整合は今回のマージが作ったものではなく、main に既にあった。**
  - preflight: ブランチで **2件失敗**（`詳細ページを生成できる` / `CMS の Image Position が届く`）。
    どちらも「再生成できないので生成物が data.js に追いついていない」ことが根。
- 変更したパターン: `origin/main` をブランチへマージ（data.js が 08-17版 → 08-24版に更新）。
  コード変更なし。データ修正は**一切していない**。
- 未確認の類似パターン:
  - 08-17 の3回の失敗理由: **未確認**（08-23 の1件しかログを見ていない）。
  - `Generate sitemap.xml & rss.xml` が 2026-08-24 03:51 に failure。**原因未確認**。
  - 他シート（FESTIVALS / VENUES / ARTICLES）の参照切れ: 未確認。
  - 本番CMSでの Publish Now（④）: **未実施**。データを直すまで実施しても失敗する。
- 次の担当への注意:
  - **判断待ち（データ所有者=ユーザー）**: `matricaria-2026` の出演者 Joma / Noritake を
    (a) ARTISTS の STATUS を published にして載せる のか、
    (b) LINEUPS から2行を削除する のか。**どちらかを決めるまで本番は復旧しない。**
  - 直した後の手順: シート修正 → `npm run fetch` で lineups.json 更新 →
    `node scripts/build-detail-pages.mjs` → `bash scripts/preflight.sh` 全件 →
    ブランチ push → main へマージ → 本番CMSで Publish Now。
- **「Publish Now を押したのに変わらない」の真因はこれ。** 空コミットの調査
  （`reports/codex-request-2026-08-24-publish-empty-commit.md`）は入口であって、
  その奥に10日分の未公開がある。

## 2026-08-24 Publish失敗履歴と未公開検知方式の提案（実装前）

- 実施: GitHub Actionsの実ログを読み取り専用で確認した。08-17の3件と08-24のsitemap失敗は、
  同一原因ではなかった。失敗時に人へ届く通知・本番との差分監視はまだ実装していない。
- コミット: なし（方式提案のみ。pushなし）。
- 検証:
  - 08-17 10:07 `32018605378`:
    `Fetch data from spreadsheet`で`EDITIONS: ID重複 "snow-machine-japan-2026"`。
  - 08-17 13:54 `32037103731`:
    `Check asset cache busting`で`cms.js`の参照が`?v=82`のまま。コード更新に対する
    キャッシュバージョン更新漏れ。
  - 08-17 14:18 手動 `32038582389`:
    `Check regression thresholds`で`broken_image_refs 2 > max 0`。
    不足画像は`/images/festivals/mutek-flyer.webp`と`/images/festivals/mutek.webp`。
  - 08-24 03:51 `32687890361`（Generate sitemap.xml & rss.xml）:
    sitemap生成前の`Build detail pages`で停止。`lineups.json: ARTIST_ID 参照切れ 2件`、
    `joma / noritake → matricaria-2026, synapse-festival-2025`。
    これは共有済みのARTISTS STATUSとLINEUPSの不整合に一致する。
- 変更したパターン: なし（調査のみ）。
- 未確認の類似パターン: GitHub通知設定が実際に誰へ届くか、LINE等の外部通知先の有無、
  データ側の他シート参照切れは未確認。
- 次の担当への注意・判断待ち:
  - 推奨方式は二層構成。
    1. **即時通知**: Publish pipeline / generate-meta の失敗をGitHub Actionsの失敗通知で受ける。
       まずリポジトリ管理者・担当者がActions失敗通知を有効化する。外部Webhookは後回しにする。
    2. **定期監視**: 30分〜1時間ごとのwatchdogで、(a) `main`の`LP/data.js`と
       `https://techno-japan.media/data.js`のSHA-256、(b)最後のPublish pipelineの成功時刻、
       (c)失敗runの有無を確認する。不一致または一定時間更新なしなら失敗終了し、通知対象にする。
  - 方式比較:
    - GitHub Actions失敗通知だけ: 実装が最小。ただし「空コミットでworkflow自体が起動しない」
      事故と、本番とmainの不一致は検知できない。
    - 本番との差分watchdogだけ: 今回の10日間未公開を検知できる。ただし、何の検査で止まったかは
      Actionsの失敗ログを見に行く必要がある。
    - **推奨の二層構成**: 失敗理由と未公開状態の両方を検知でき、外部サービスを増やさず始められる。
  - 実装前の合否条件:
    - `main`と本番のdata.jsが一致していると成功。
    - 不一致なら「本番とmainのdata.jsが不一致」として失敗し、SHAと最終成功時刻を出す。
    - Publish pipelineまたはmeta生成が失敗したら、失敗runのURLと最初の失敗ステップを出す。
    - 空コミットでPublish pipelineが起動しなくても、watchdogの差分検査で検知する。
  - 同じ障害を毎回大量通知せず、GitHub Issueまたは同一タイトルのアラートを更新する。

## 2026-08-24 Publish復旧確認（Run 32712925871）

- 実施: ユーザーがARTISTSのSTATUSを修正後、本番CMSでPublish Nowを実行した結果を確認した。
- コミット: Publish pipelineの生成コミットは`7e75413f2f877e29839023578758bd725acf6e2c`。
  Codexからのpushはしていない。
- 検証:
  - Run `32712925871` は success。Fetch / Build / 全検査 / sitemap / RSS / Pages deployまで成功。
  - `origin/main`の`LP/data.js` SHA-256:
    `e9b8f38029c4bb72fdcb2889f329891a6e6c059ab986cc49c7c19034ed979186`
  - 本番`https://techno-japan.media/data.js` SHA-256:
    `e9b8f38029c4bb72fdcb2889f329891a6e6c059ab986cc49c7c19034ed979186`
  - 本番とmainは完全一致。2026-08-14以来の未公開状態は解消した。
- 変更したパターン: データ所有者がARTISTSのSTATUSをpublishedへ修正し、参照切れを解消した。
- 未確認の類似パターン: 未公開検知の定期実行はまだ未実装。GitHub通知が担当者に届く設定かも未確認。
- 次の担当への注意・判断待ち:
  - 復旧後も、Publish失敗を10日間見逃さないための二層監視（Actions失敗通知＋本番/main差分watchdog）は必要。
  - 監視の実装承認後、まず外部WebhookなしのGitHub Actions通知＋SHA-256監視から着手する。

## 2026-08-24 未公開検知の二層構成を実装

- 実施: 本番未公開を検知する共通スクリプトとGitHub Actionsを追加した。
  1. `scripts/check_production_sync.mjs` がmainの`LP/data.js`と本番URLの`data.js`をSHA-256で比較。
  2. 同スクリプトがPublish pipelineとsitemap/RSS生成の最新completed runをGitHub APIで確認。
  3. `.github/workflows/production-sync-watchdog.yml`を30分ごとに実行し、差分・失敗を検知。
  4. 対象workflowの失敗時は`workflow_run`経由で別jobも失敗させ、GitHub Actions通知に乗せる。
  外部WebhookやCSP変更は追加していない。
- コミット: 未コミット・未push。監視コードの実装までで、本番公開はしていない。
- 検証:
  - `node scripts/check_production_sync.mjs --self-test` → 成功。
  - watchdog YAMLの構文・`schedule` / `workflow_run`トリガー → 成功。
  - `bash scripts/preflight.sh` → **全41件成功**（ネットワーク・ローカルブラウザ許可で再実行）。
  - 通常権限のpreflightでは外部画像DNSとローカルHTTPサーバー権限で失敗したが、コード修正後の再実行で解消。
- 変更したパターン: 定期SHA-256照合、Publish/sitemap失敗の別経路検知、監視スクリプトの自己テストを追加。
- 未確認の類似パターン: GitHubリポジトリのWatch設定により担当者へメール/画面通知が届くか、
  Actionsのスケジュール実行が実際に30分周期で起動するかは未確認。GitHub上へのpushが必要。
- 次の担当への注意・判断待ち:
  - 本番へ反映するには、監視コードをmainへpush後、Actionsの`Production sync watchdog`を手動実行する。
  - その実行で「main/live hash一致」「Publish pipeline success」「sitemap/RSS success」を確認する。
  - GitHub通知を受け取りたい担当者は、リポジトリのActions通知またはWatch設定を有効にする。
  - LINE/Slack等の外部通知は今回の範囲外。必要なら別途Webhookの送信先を決めてから追加する。

## 2026-08-24 ✅ 本番復旧（8/14以来10日ぶりの公開）

- 実施: ユーザーが ARTISTS シートの Joma(88行) / Noritake(76行) の STATUS を
  `draft` → 公開 に変更。その後ユーザーが本番CMSで Publish Now を実行し、
  **Publish pipeline が10日ぶりに成功**した。私は実行前の障害の洗い出しと、
  実行後の実測確認、ブランチ側の再生成を担当した。**本番の操作は行っていない。**
- コミット: `7ebec9a4` Merge origin/main / `0a5ed581` 生成物の再生成 / 本エントリ。
  いずれも `feat/list-visual`。**main へは何も出していない。**
- 検証（すべて実測）:
  - `publish-pipeline` run `32712925871` → **success**（1m38s）。
    直前の成功は 2026-08-14 05:40 で、その間の4回はすべて failure だった。
  - main に `c0817661 cms: publish data.js` と
    `7e75413f chore: regenerate detail pages, sitemap.xml & rss.xml [skip ci]` が増えた。
  - **本番の data.js と main の data.js が完全一致**（`diff` で確認）。
    本番アーティスト96名・joma / noritake とも含む。復旧前は本番96名・main94名で不一致だった。
  - 本番 `festivals/matricaria.html` が `/artists/joma.html` へリンク（2箇所）。
    本番 `artists/joma.html` は HTTP 200。`llms.txt` は「アーティスト96名」。
  - 実行前に過去の失敗要因を全部潰してあることを確認:
    EDITIONS重複0件 / `broken_image_refs 0` / mutek画像2枚とも存在 / cms.js の ?v 整合。
  - ブランチ: `origin/main` を取り込み（衝突44件は**すべて生成物**のため main 側を採用）、
    `build-detail-pages.mjs` で再生成 → **`bash scripts/preflight.sh` 全40件成功**。
- 変更したパターン: 生成物の再生成のみ（詳細ページ42枚 / llms.txt / events.json）。
  コード変更なし。データ修正はユーザーが実施。
- 未確認の類似パターン:
  - **本番CMSでの Publish Now は「旧 cms.js」で実行された。** 今日の変更
    （空コミット防止の throw 化 / VENUES 4列の大文字ラベル / ローカル用メッセージ）は
    **まだ本番に出ていない**ため、その経路は実機未確認のまま。
    AGENTS.md の「Publish 経路を触ったら実機で1回通す」は**未達**。
    main へマージした後に、もう一度 Publish Now を通す必要がある。
  - `feat/list-visual` を main へ出す判断: 未実施（27コミット超）。
  - CMS で VENUES の SUBTYPE / HOURS / CHARGE / FEATURES を入力して保存する経路: 未確認。
- 次の担当への注意:
  - **本エントリの直前に、並行セッション（Codex）の「未公開検知方式の提案」がある。**
    改変せずそのまま残してある。10日間気づかれなかった件の再発防止はそちらが本命。
  - ブランチは preflight 全件通過済みで push 可能な状態。main へのマージ可否はユーザー判断待ち。

## 2026-08-24 公開前の実ブラウザ確認（UI変更・未確認項目の解消）

- 実施: `feat/list-visual` を main へ出す前提として、handoff に「未確認」と残っていた
  UI項目を実ブラウザで確認した。**390px は iframe（同一オリジン・`frame-src 'self'` 許可）で
  実幅ちょうどを再現**し、Chromeのウィンドウ下限500pxの制約を回避した。
  URL: `http://127.0.0.1:8000/`（ローカル配信）。幅 1280px / 390px。
- コミット: 本エントリ。コード変更なし。
- 検証（操作 → 期待 → 実測）:
  - artists.html 1280px: 初期表示 → A–Z・96件 → **A–Z / 96件 ✅**、並び替えUI・アルファベットタブは**存在しない ✅**
  - artists.html 1280px: 検索「dj」 → 絞込後もA–Z → **10件・A–Z ✅**（DJ HYPE…Idjut Boys）
  - artists.html 1280px: 検索「dj」＋ジャンルTECHNO → 重ねがけでもA–Z → **4件・A–Z ✅**
  - artists.html 1280px: `?sort=z-a` で開く → 壊れずA–Z固定 → **96件・A–Z・Consoleエラー0 ✅**
    （旧URLの利用者影響なし。パラメータは無視される）
  - venues.html 1280px: 種別CLUBS → club のみ13件 → **13件・全て `data-type=club` ✅**
  - venues.html 1280px: 種別BARS × 都市TOKYO → 重ねがけ → **3件（BONOBO / OATH / THE ROOM）✅**
  - index.html 1280px: TOPアーティスト → 画像付きでランダム → **16名（マーキー複製で32リンク）・
    全員に画像あり ✅**。`?r=2` で再読込すると別の16名になり**ランダム化が効いている ✅**
  - artists.html **390px**: 横スクロールなし（scrollWidth 390 = innerWidth）・96件・A–Z・
    並び替えUIなし・検索欄幅358px・ジャンルタブ7個 ✅
  - artists.html **390px**: 検索「dj」＋TECHNO → **4件・A–Z・横スクロールなし ✅**（1280pxと同一）
  - venues.html **390px**: 22件 → BARS 4件 ✅、横スクロールなし ✅
  - **EN** `/en/artists.html` 390px: `lang=en`・96件・A–Z・並び替えUIなし・
    本文に文字列 `undefined` なし ✅
  - **EN** `/en/venues.html` 390px: 22件 → CLUBS 13件 ✅、`undefined` なし ✅
  - Console: **エラー0件**（全ページ通して）
- 変更したパターン: なし（確認のみ）。
- 未確認の類似パターン:
  - **実機端末での確認は未実施**（iframe による390px再現であり、実機のタッチ・dpr・
    iOS Safari 固有挙動は含まない）。§9-83 の「headless はタッチを模擬しない」と同じ限界。
  - 実機PCでのホバー時プレビュー位置とリスト行の視認性: **未確認のまま**
    （handoff 5280行の項目。ホバー挙動は今回の対象外）。
  - festivals.html / news.html のハブ: 今回の変更対象外のため未確認。
- 次の担当への注意:
  - handoff 5320行「検索・ジャンル絞り込み後のA–Z固定表示: 未確認」および
    5321行「`?sort=z-a` の利用者影響: 未確認」は、**本エントリで解消**。
  - 390px の確認は iframe 方式が使える（ハブの CSP は `frame-src 'self'` を許可）。
    cms.html だけは `frame-src 'none'` のため不可。

## 2026-08-24 ✅ feat/list-visual を本番公開・Publish経路の実機確認まで完了

- 実施: `feat/list-visual` を `main` へ `--no-ff` マージして公開。デプロイ後、
  **ユーザーが本番CMSで Publish Now を1回実行**し、AGENTS.md の
  「Publish の経路を触ったら実機で1回通すまで完了にしない」を満たした。
  （ダイアログの自動承認は安全機構にブロックされたため、押下はユーザーが実施。回避はしていない）
- コミット: `eeb2c6a9` Merge（486ファイル / +3741 −730）→ 本番デプロイ成功。
  続いて `5fac4ad8 cms: publish data.js` / `e187f1ec chore: regenerate ...`。
- 検証（すべて実測）:
  - push前 `bash scripts/preflight.sh`（main の状態で）→ **全40件成功**
  - `Deploy LP to GitHub Pages` run `32719391236` → **success**
  - `Publish pipeline` run `32723161475` → **success**（前回に続き2回連続成功）
  - **空コミットではない**: `5fac4ad8` は `LP/data.js | 5 +++++`（1ファイル5行追加）
  - **VENUES 4列が初めて data.js に届いた**（旧cms.js → 新cms.js の差）:
    `subtype 0→1 / hours 0→1 / charge 0→0 / features 0→3`
    これはローカルで事前に実測したダイアログの数字
    `VENUES 22件（SUBTYPE 1 / HOURS 1 / CHARGE 0 / FEATURES 3）` と**完全一致**
  - **本番 data.js と main の data.js が完全一致**（`diff`）
  - 本番の実ブラウザ確認: `/artists.html` 96件・A–Z・並び替えUIなし・Joma/Noritake表示 ✅
    `/venues.html` 種別フィルタ動作（22→CLUBS 13件・全て `data-type=club`）✅
    `/en/artists.html` `/en/venues.html` とも HTTP 200 ✅
  - 本番CMSが新 `cms.js` を配信していることを確認（`PROD_CMS_HOST` 定義・
    ローカル用ガード・大文字ラベルの3点） ✅
  - **詳細ページへの反映**: 本番 `/venues/vent.html` と `/en/venues/vent.html` に
    `<dt>HOURS</dt><dd>23:00~05:00</dd>` が出ることを確認 ✅
    シート → GAS → data.js → 詳細ページまでエンドツーエンドで通った。
- 変更したパターン: マージのみ（コード変更なし）。
- 未確認の類似パターン:
  - **`features` は詳細ページに表示されない。これは仕様**であり不具合ではない。
    `VENUE_PRACTICAL_FEATURES` は注意書き6種（cash-only / cashless-only / id-required /
    no-photo / smoking / no-reentry）だけを「GOOD TO KNOW」に出す設計で、
    現在 features を持つ3件はすべて `after-hours`（フィルタ用タグ）のため対象外。
    `subtype` も INFORMATION 行には出さず（表示は `type`）、ハブの種別分類に使う。
  - CMS で SUBTYPE / HOURS / CHARGE / FEATURES を**入力して保存する**経路: **未確認**。
    今回確認したのは読み取り→公開→表示の経路。書き込み（`update_row`）は未検証。
  - `charge` は全22件が未入力のため、表示経路そのものが未検証。
  - 実機端末（iOS/Android）での確認は未実施。390pxはiframe再現であり、
    タッチ・dpr・iOS Safari固有挙動は含まない。
  - ホバー時プレビューの視認性（handoff 5280行）は今回の対象外で未確認のまま。
- 次の担当への注意:
  - **本番は正常。** 8/14から10日間止まっていた公開は復旧し、以後2回連続で成功している。
  - 残る本命は**再発防止**。並行セッション（Codex）の「未公開検知方式の提案」エントリを参照。
    今回も人が気づくまで10日かかった。検知が無い限り同じことが起きる。
  - 切り戻しが必要な場合は `git revert -m 1 eeb2c6a9`。

## 2026-08-24 未公開検知の見張り番を実装（Codex実装＋誤報の猶予・自己テスト強化）

- 実施: Codex が実装した二層構成（`scripts/check_production_sync.mjs` /
  `.github/workflows/production-sync-watchdog.yml` / preflight登録）をレビューし、
  2点を追加した。あわせて、見張り番が最初から緑で動くよう
  `Generate sitemap.xml & rss.xml` を手動実行して失敗状態を解消した。
- コミット: `7feeea70`（見張り番の改良）。
  `Generate sitemap.xml & rss.xml` run `32727739889` は workflow_dispatch で実行。
- 検証（すべて実測）:
  - `bash scripts/preflight.sh` → **全41件成功**（自己テスト1本増）
  - **10日間の障害と同じ形**（`eeb2c6a9` の旧 data.js を main に見立てる）→ **exit 1 で検知**
  - 猶予が誤って効いていないこと: data.js 最終更新 11:41:40Z / 実行 12:18Z（37分前）→
    猶予外として正しく鳴った
  - **自己テストが壊れを捕まえるか**: `evaluateSync` の戻り値を `ok:true` に改変すると
    `自己テスト失敗: 未公開状態を異常として検知する` で **exit 1**。復元すると exit 0。
    検知が壊れても緑のまま、という状態にはならない。
  - 実データ（GitHub API込み）→ **exit 0**。
    `Publish pipeline: success / 11:41:43Z`、`sitemap / RSS: success / 12:33:40Z`。
  - 見張り番は実装直後に**実在の問題を1件検知した**（sitemap/RSS が 03:51 の failure のまま）。
    誤検知ではなく、手動再実行で解消。中身は問題なかった（本番sitemap 446URL・
    joma/noritake 掲載・main と一致）。
- 変更したパターン:
  1. **誤報の猶予**: 不一致を見つけたときだけ追加問い合わせし、
     (a) `publish-pipeline` / `deploy-pages` に完了していない run がある、
     (b) `LP/data.js` の最終更新が10分以内、のいずれかなら異常扱いしない。
     API を引けない場合は**猶予を与えず鳴らす**（見逃すより誤報の方が直せる）。
     通常時の API 消費は増やさない。
  2. **自己テストの範囲**: 判断を純関数 `evaluateSync` に切り出し、
     「不一致で落ちる／一致で通す／公開中は鳴らさない／10日前は猶予外／
     時刻不明・未来日時に猶予を与えない」まで15項目を検査。
     従来は sha256 と run 抽出だけで、**不一致検知そのものが未検査**だった。
- 未確認の類似パターン:
  - **猶予パスの API 統合は実発火していない。** コミット時刻の取得・表示が動くことと、
    判定ロジックの単体テストは済んでいるが、「進行中の run がある状態」を作って
    通した検証はしていない。次の Publish 時に観察すること。
  - **失敗が誰に届くかは未確認。** ジョブが失敗するところまでは動くが、
    通知は GitHub の設定次第（Settings → Notifications → Actions）。
    **ここが未設定だと、失敗しても今回と同じく誰も気づかない。**
    この見張り番の価値は実質ここにかかっている。**ユーザー確認待ち。**
  - 30分間隔の cron が実際に回り始めるかは、初回発火まで未確認。
- 次の担当への注意:
  - 見張り番が赤いとき、まず疑うのは本番ではなく**通知が届いているか**。
    2026-08 の事故は「失敗していたこと」ではなく「気づかなかったこと」が本体だった。
- `evaluateSync` は純関数のまま保つこと。ネットワークを混ぜると自己テストが書けなくなる。

## 2026-08-24 SEO/GEOテーマ1 依頼1・2の実装、依頼3は判断待ち

- 実施: 着手前に`git status --short --branch`（`main...origin/main`、変更なし）と
  `git pull --ff-only`（Already up to date）を実行した。`scripts/build-detail-pages.mjs`で
  `llms.txt`に最新記事（新しい順・最大20件・ENリンク付き）を追加し、
  `NewsMediaOrganization`（`#org`）をJA/ENのindex/aboutへ追加した。記事JSON-LDには
  `publisher.@id`、`isAccessibleForFree`、`wordCount`、`thumbnailUrl`、実在確認済みの`about`を追加。
  `scripts/check_jsonld.mjs`に全llmsリンク実在・記事件数・組織・記事JSON-LD・JA/ENキー一致の検査を追加した。
  実在するロゴは`LP/images/logo-512.png`（512×512）だったため、その実測値を使用した。
- コミット: 未コミット・未push。`cms.js` / GAS / 画像生成器 / AGENTS.mdは変更していない。
- 検証: 着手前実測はrss HTTP 200、`[[event]]` 0件、フェス`#festival`既存。ビルド成功。
  `node scripts/check_jsonld.mjs`成功。`bash scripts/preflight.sh`は**全41件成功**。
  公開記事5本のJA/EN行数は全て153行で一致（旧URLリダイレクト`transcendence.html`は記事本体ではない）。
- 変更したパターン: llms記事セクション、全llmsリンクのファイル実在検査、NewsMediaOrganization、
  記事publisherの組織参照、記事SEO差分4点、festival `about`の実在条件、JA/EN JSON-LDキー比較。
- 未確認の類似パターン: Google Rich Results Testの外部画面でのエラー0、実ブラウザ390/1280×JA/ENの
  目視確認は未確認。依頼3の1:1/4:3画像派生と変更前後の実ページ重量比較は未実施。
  依頼書の「build-detail-pages.mjsと検査スクリプトのみ」という制約では、既存の
  `build-image-derivatives.py`を拡張せず再現可能なクロップ派生を作れないため、勝手に範囲を広げていない。
  AGENTS.mdの古い記事英語欄記述も、同じ変更範囲制約により未変更。
- 次の担当への注意・判断待ち: 依頼3を進めるには、画像派生生成器（`scripts/build-image-derivatives.py`）を
  変更対象へ含める承認が必要。承認後、1:1/4:3を`imagePosition`対応で生成し、変更前後を同じ
  390/1280・JA/EN・dpr2〜3のresource転送量で比較し、増加した場合は独立コミットを撤回する。

## 2026-08-24 AUDIT §9-96 を追記（10日間の未公開・事故の記録）

- 実施: 10日間の未公開障害の経緯・原因・再発防止を
  [AUDIT_TECHNO_JAPAN.md](../AUDIT_TECHNO_JAPAN.md) **§9-96** に記録した。
  handoff は流れていくため、恒久的な記録はAUDIT側に置く（AGENTS.md）。
  あわせて、上の 2026-08-24 エントリにあった時刻の誤りを訂正した。
- コミット: 本エントリ。
- 検証: `bash scripts/preflight.sh` 全41件成功。
  時刻の整合を実測で確認（gitはJST / ActionsはUTC、差は9時間）:
  `075fb6d2` JST 02:37 = UTC 17:37 → 08-23 17:38 UTC の失敗run に対応。
  空コミットは `bc837416` / `207eac82` / `497e0354` の3件（0ファイル）で確定。
- 変更したパターン: ドキュメントのみ。
  §9-96 に記録したのは、5回の失敗理由がすべて異なること、空コミットで
  ワークフローが起動しなかったこと、事故の本体は「失敗」ではなく
  「10日間気づかなかったこと」であること、見張り番の設計理由（誤報を減らすことは
  機能ではなく前提）、検知が壊れても緑にならないようにした理由。
- 未確認の類似パターン:
  - 猶予パスのAPI統合の実発火: 未確認（次のPublish時に観察）。
  - 30分cronの初回発火: 未確認。
  - **失敗通知はユーザーが有効化済み（2026-08-24）。** 実際に通知が届くかは
    次に失敗が起きたときに分かる。
- 次の担当への注意:
  - 見張り番が赤いとき、まず疑うのは本番ではなく通知経路。
  - `evaluateSync` は純関数のまま保つこと。ネットワークを混ぜると自己テストが書けない。
  - 時刻を扱うときは JST / UTC を必ず明記する。今回それで一度誤った記録を書いた。

## 2026-08-25 SEO/GEOテーマ1 依頼3（記事画像アスペクト派生）

- 実施: `scripts/build-image-derivatives.py` を変更し、記事のヒーロー5枚だけを対象に
  `wide(16:9) / square(1:1) / fourThree(4:3)`を生成した。切り出しは
  `imagePosition` の center/top/bottom/left/right を Pillow の中心位置へ変換する。
  派生はすべて `LP/images/derivatives/card/articles/` 配下に置き、本文中の画像は対象外とした。
  `scripts/build-detail-pages.mjs` はJA/ENのNewsArticle.imageへ3派生URLを出力し、
  `scripts/check_image_derivatives.py` と `scripts/check_jsonld.mjs` に検査を追加。
  同条件の再計測用に `scripts/measure_article_weight.py` を追加し、実ブラウザ画像も保存した。
- コミット: `06763206 feat(seo): add article image aspect derivatives`。依頼3単独コミット、pushはしていない。
- 検証: `bash scripts/preflight.sh` **全41件成功**。派生画像684枚（原本203件、記事ヒーロー5件）の
  実体・幅宣言を確認。JSON-LDは453ページ469ブロックを検査し、記事5本×JA/ENの3アスペクトと
  JA/ENキー一致が全件成功。公開記事5本のJA/EN行数は全て153行で一致。
  変更前→変更後（390/1280、dpr2、Fast 3G相当）の代表計測は、JA390初期944,592→944,907 bytes・
  全スクロール1,740,669→1,740,984、JA1280初期761,221→761,536・全1,391,258→1,391,573、
  EN390初期590,022→590,337・全1,740,393→1,740,708、EN1280初期760,945→761,260・
  全1,390,982→1,391,297。画像リクエスト数は2〜4件で変化なし、CLSは全て0.008未満。
  差分はJSON-LDに派生URLを2本追加した文書分（315 bytes）で、画像転送量の増加はない。
  なお外部Google画像の応答量は実行ごとに変動し、別実行のEN1280全スクロールだけ
  2,656,171 bytesになったため、外部画像を含む絶対値は再現性に注意する。
- 変更したパターン: 記事ヒーローの3アスペクト配列、`imagePosition`準拠の5方向crop、
  derivatives manifestのaspect情報、記事JSON-LD検査、同一条件の重量・スクリーンショット計測。
- 未確認の類似パターン: Google Rich Results Testの外部画面でのエラー0、実機Safariでの表示、
  Google画像の外部応答量が安定した状態での再計測は未確認。スクリーンショットは
  `reports/screenshots/seo-theme1/article-ja-390.png` / `article-ja-1280.png` /
  `article-en-390.png` / `article-en-1280.png` に保存した。
- 次の担当への注意: `LP/images/`直下へ派生を置かないこと。記事本文画像を対象へ広げると
  生成時間と容量が急増する。画像生成器を再実行した際は、先に変更前後の同一条件の転送量を取り、
  外部Google画像の変動値と自サイト派生画像の増減を分けて判断すること。pushはユーザー承認後。

## 2026-08-25 SEO/GEOテーマ1 依頼3受入確認の手直し

- 実施: `scripts/build-image-derivatives.py` の記事アスペクト派生を、目標幅960pxから1200pxへ変更した。
  ただし原本幅を上限にし、bondiscoは1179px、その他4記事は1200pxとした。事前生成ポジションは
  各記事の実 `imagePosition` と `center` の2種類だけに限定し、現在の5記事はすべてcenterだったため
  3アスペクト×centerの15枚になった。旧960px派生・top/bottom/left/right派生は同じコミットで削除した。
  検査上限も1200pxへ更新した。
- コミット: `b00bb849 fix(seo): tune article image derivatives`。修正内容の独立コミット、pushはしていない。
- 検証: `python3 scripts/check_image_derivatives.py` は624枚（原本203件、記事5件）を確認。
  記事アスペクトは全件実在し、幅は1179pxまたは1200px。余剰ポジションは0枚。
  `node scripts/check_jsonld.mjs` 成功。`bash scripts/preflight.sh` **全41件成功**。
  JA/EN公開記事5本の行数は全て153行で一致。
- 変更したパターン: 1200px上限・原本幅キャップ、実ポジション＋centerのみの事前生成、
  stale派生の自動削除、派生画像サイズ検査の上限更新。
- 未確認の類似パターン: 現在の5記事にcenter以外の実データが無いため、top/bottom/left/rightを
  指定した記事の実生成は未確認。manifestのcenterフォールバック検査は既存のJSON-LD検査で確認済み。
- 次の担当への注意: 新記事で`imagePosition`を変更した場合は、その位置の派生とcenterの2枚だけが生成される。
  1200px未満の原本は拡大しない。pushはユーザー承認後。

## 2026-08-25 ABOUT STATEMENT 実装

- 実施: `LP/about.html` と `LP/en/about.html` にSTATEMENTセクションを追加し、依頼書の本文・4キーワードを
  一字一句そのまま掲載した。既存ラベルを01〜05へ繰り下げ、JA/ENのmeta・og・twitter descriptionを指定文へ更新。
  追加依頼に従い`LP/submit.html`と`LP/en/submit.html`からSTATEMENTへの1行リンクも追加した。
  既存の`.reveal`包括Observerを確認し、新規JSは追加していない。
- コミット: `6dc98c82 feat(about): add statement section`。STATEMENT関連を1コミットにまとめた。pushはしていない。
- 検証: `grep -c STATMENT LP/about.html LP/en/about.html`は0/0。JA/ENラベルは01 — ABOUT、02 — STATEMENT、
  03 — NEWS、04 — INSTAGRAM、05 — CONTACT。JA/EN行数は1092/1092。
  実ブラウザ390px/1280px×JA/ENで`#statement`へ直接着地し、キーワードの`.reveal`を確認。
  掲載フォームのJA/ENリンクを実クリックし、`/about.html#statement`と`/en/about.html#statement`へ遷移。
  `bash scripts/preflight.sh`は**全41件成功**。スクリーンショットは
  `reports/screenshots/about-statement/about-ja-390.png`、`about-ja-1280.png`、
  `about-en-390.png`、`about-en-1280.png`。
- 変更したパターン: `#statement`、4キーワードの個別reveal、9段落の本文、6px赤マーカー、
  section-label番号、ABOUTのメタ説明、掲載フォームからのJA/ENアンカーリンク。
- 未確認の類似パターン: 本番ドメイン上でのSNS共有カード表示、実機Safariでの確認は未確認。
  ローカル実ブラウザ（Chrome headless）の表示・着地・revealは確認済み。
- 次の担当への注意: STATEMENT本文はaboutだけを正本とし、submit側にはリンク文1行だけを置く。
  本文の句読点・ダッシュ・英語表記を編集しない。pushはユーザー承認後。

## 2026-08-25 ✅ SEO/GEOテーマ1を本番公開・リッチリザルトテスト通過

- 実施: テーマ1の3コミット（llms.txt記事欄 / NewsMediaOrganization+記事JSON-LD /
  画像3アスペクト派生）を main へ push し公開。デプロイ成功後、本番URLで
  Googleリッチリザルトテストを実行した。
- コミット: `a53b2e25` / `fe10d049` / `64450065`（実装: Codex、受け入れ確認: Claude）。
- 検証（すべて実測）:
  - 本番反映: llms.txt 記事リンク5本 / NewsMediaOrganization / 派生3種 HTTP 200 /
    記事の isAccessibleForFree、すべて確認。
  - リッチリザルトテスト（snow-mashine-2027-info、クロール 2026-08-25 01:40）:
    **エラー0・有効アイテム3件**（記事 / パンくずリスト / ペイウォールコンテンツ※）。
    ※「ペイウォール」検出は isAccessibleForFree:true の正常な副産物（無料の明示）。
  - 派生画像: 15枚・2.1MB。4記事=幅1200px、bondisco=原本上限1179px（拡大なし）。
  - スクショ: Codex分 `reports/screenshots/seo-theme1/`。
- 変更したパターン: 公開のみ（実装はCodexの3コミット）。
- 未確認の類似パターン / 残タスク:
  - **重大ではない警告5件**（すべて「任意」・修正はCodexへ依頼予定）:
    1. datePublished / dateModified が日付のみ（`2026-08-17`）でタイムゾーン無し。
       ISO 8601（`2026-08-17T00:00:00+09:00`）にすると消える ×4件
    2. author に url が無い ×1件
  - **publisher の @id がページ内で解決できていない**（テスト上 type=Thing 表示）。
    #org の実体は index/about にしか無く、記事ページ単体では参照先が見えない。
    記事側にも同じ @id の NewsMediaOrganization ノードを併記すべき（次の改善）。
  - Search Console の「記事」「パンくず」レポート: **1〜2日後に確認**（クロール待ち）。
- 次の担当への注意:
  - 警告はすべて「任意」でリッチリザルト対象からは外れていない。慌てて直す必要はないが、
    日時形式は build-detail-pages.mjs の1箇所直しで全記事に効く。
  - テーマ2（記事RSS）の着手条件は月4〜6本×2〜3ヶ月（設計書に記載）。

## 2026-08-25 ✅ テーマ1仕上げ（JSON-LD警告5件→0件）を公開

- 実施: Codexの仕上げコミット `8b04d8f9`（ISO 8601日時 / author.url /
  記事ページへのNewsMediaOrganization併記）を受け入れ確認のうえ公開。
  push時にorigin/mainが先行しており（Drive画像同期）、rebaseで直線化してから push した。
- コミット: `289985fa`（rebase後のhash。元は 8b04d8f9）。
- 検証（すべて実測）:
  - 受け入れ: preflight 全41件 / JA=EN 全5記事153行 / 差分はJSON-LDの1行に閉じる
  - 本番反映: `datePublished: 2026-08-17T00:00:00+09:00` / author.url /
    記事ページ内 NewsMediaOrganization を curl で確認
  - **リッチリザルトテスト再実行（クロール 2026-08-25 02:32）: 警告0・エラー0・有効3件。**
    前回の「重大ではない問題5件」がすべて解消。
- 変更したパターン: 公開のみ。
- 未確認の類似パターン: なし（テーマ1は本エントリで完了）。
- 次の担当への注意:
  - 残るのは Search Console の「記事」「パンくず」レポート確認（1〜2日後・ユーザー）。
  - テーマ2（記事RSS）は月4〜6本×2〜3ヶ月の実績が着手条件（設計書）。
  - テーマ4（記事テンプレ）はいつでも並行可・未着手。

## 2026-08-25 VENUES フィルタ行のレイアウト整理（モバイルの見切れ解消）

- 実施: 実機スクショで、都市タブ行に MAP ボタンが同居して KYOTO が「KY」に
  見切れていた問題を修正。試行の結果、MAP は**種別タブの行でもなく**
  （移すと LIVEHOUSE が押し出される。実測: タブ末端 330px > 表示域）、
  **検索と同じ「操作の行」**に置いた。MAP は絞り込みではなく表示切替のため、
  位置の意味としても正しい。
- コミット: 本エントリと同時（LP/venues.html + 再生成した LP/en/venues.html）。push は未実施。
- 検証（実ブラウザ・すべて実測）:
  - 390px(iframe): 種別4タブ・都市4タブとも全表示（LIVEHOUSE右端330 / KYOTO右端308 < 390）、
    横スクロールなし、検索+MAPが同一行・同一高さ(50px)、件数は2行目
  - 390px: MAP押下→地図表示✅、BARS絞り込み→4件✅
  - 1280px: 検索(420px上限)+MAP+件数が1行に整列、スクショ確認
  - EN(/en/venues.html): 同一挙動（sameRow/heightMatch/mapWorks すべて true）
  - JA/EN 行数: 1088 = 1088
  - preflight 全41件成功（VENUES系4検査含む）
- 変更したパターン:
  - HTML: MAP ボタンを .area-nav-wrap から .venues-toolbar（検索の隣）へ移動
  - CSS: .area-nav-wrap の flex解除 / .area-nav 全幅化 / MAP の padding を検索欄に揃え
    stretch で高さ一致 / モバイルの .venues-toolbar 縦積み(column)を廃止
    （**columnだと flex-basis が高さに化けて検索欄が160pxに伸びる**。行+wrap で
    件数だけ flex-basis:100% で折り返す方式に）
- 未確認の類似パターン:
  - 実機端末（タッチ・dpr）: 未確認。iframe による390px再現
  - artists.html / festivals.html のフィルタ行: 同構造ではない（MAP同居なし）ため対象外を確認
  - MAPを開いた状態でのモバイル地図の高さ・操作: 表示までは確認、地図内操作は未確認
- 次の担当への注意: 都市タブは今後増える前提で全幅スクロール。MAP をタブ行に
  戻さないこと（390pxで必ずどちらかのタブが見切れる。本エントリの実測値参照）。

## 2026-08-25 VENUES/FESTIVAL フィルタ帯とヒーロー余白の統一（モバイル）

- 実施: 実機スクショでのユーザー指摘を3段階で反映。
  1. VENUES フィルタ: 都市タブを種別タブの上へ（クラブは街から探すため・ユーザー判断）
  2. タブ2行を1つの帯に統合。広い画面では「都市｜種別」が1行に並び、
     狭い画面では自動で2行に折り返す。タブ上下の詰め・検索行との間隔も圧縮
  3. モバイルのヒーロー余白をハブ3枚で統一。ARTISTS 96/40 が基準、
     FESTIVAL 140/60・VENUES 140/36 とバラバラだったのを 96/40 に揃えた
- コミット: 本エントリと同時（venues.html / festivals.html / en 2枚 / handoff）。push 済み。
- 検証（実ブラウザ・すべて実測）:
  - 390px(iframe): タブ折り返し正常・見切れなし（KYOTO 308 / LIVEHOUSE 354 < 390）・
    横スクロールなし・検索+MAP同一行同一高さ・MAP動作・BARS絞り込み4件
  - ヒーロー高さ実測: ARTISTS 301px = VENUES 301px（完全一致）。FESTIVAL 439px は
    余白ではなく中身（2行タイトル+RAVE切替+説明文）の差。ユーザー確認済み・このままで良い
  - 1280px: 「都市｜種別」1行帯・検索+MAP+件数が1行。ユーザー目視OK
  - EN: venues 1101=1101 / festivals 1445=1445 行一致。EN venues の挙動も実測済み
  - preflight 全41件成功
- 変更したパターン:
  - .area-nav-wrap を flex-wrap コンテナ化（タブ群は content 幅・min-width:0・横スクロール可）
  - 641px以上でのみ「都市｜種別」の区切り線（border-left）。折り返し時は消す
  - モバイルの .venues-toolbar 縦積み廃止（flex-basis が高さに化けて検索欄160pxに伸びる）
  - .page-header モバイル余白を3ハブで 96px 24px 40px に統一（各ファイルに
    「変えるときは3枚同時に」のコメントを残した）
- 未確認の類似パターン:
  - 実機端末（タッチ・dpr）: 未確認。iframe による390px再現
  - news.html のヒーロー余白: 未統一（今回の指摘対象外。揃える場合は同じ 96/40 に）
  - FESTIVAL の RAVE モード切替後のヒーロー高さ: 未確認
- 次の担当への注意: MAP をタブ行に戻さないこと（390px でどちらかのタブが必ず見切れる。
  実測: 種別行末端 330px・都市+MAP 366px > 表示域 342px）。

## 2026-08-25 ABOUT「STATEMENT」セクション（Codex実装の受け入れ＋2点修正）

- 実施: Codex 実装（`86d6cde8`）を受け入れ確認し、2点をこちらで修正した。
  1. **EN版の本文が日本語のままだった。** 依頼書の英語本文（一字一句指定）に差し替え、
     meta / og / twitter description も英語版に修正。
  2. **ロード時のハッシュ着地が効いていなかった。** `html { scroll-behavior: smooth }` の
     環境でロード時のアンカー移動が打ち切られ、`#statement` どころか既存の `#about` でも
     先頭に留まっていた（**既存問題**。scrollIntoView も smooth では0のまま、
     behavior:auto なら動くことを実測）。about 2枚に「load後に一度だけ即時ジャンプ」の
     補正スクリプトと `scroll-margin-top: 64px` を追加。ページ内クリックは従来通り smooth。
- コミット: Codex `86d6cde8` ＋ 本修正（同時コミット）。push は未実施。
- 検証（実ブラウザ・すべて実測）:
  - JA/EN 本文の一字一句照合をスクリプトで実施 → 全9段落＋キーワード4行一致（両言語）
  - STATMENT誤字 0 / 全角ダッシュ「——」0 / セクション番号 01〜05 連番（JA/EN）
  - `/about.html#statement` 直接着地 ✅（修正後）。EN も ✅
  - 掲載フォーム(EN)の STATEMENT リンクをクリック → EN about の #statement に着地 ✅
  - `.reveal`: 着地時に画面内 5/6 が発火。本文はスクロールで出現（既存挙動どおり）
  - 390px: キーワード4つ・赤6pxマーカー・整列を確認
  - JA/EN 行数 1111 = 1111 / preflight 全41件成功
- 変更したパターン: EN statement テキスト差し替え / about 2枚に着地補正 JS +
  `section { scroll-margin-top }` 追加。
- 未確認の類似パターン:
  - **`/en/about.html` は STATEMENT 以外のセクション（01 ABOUT 等）も本文が日本語のまま。**
    今回のスコープ外だが、英語ページとして機能していない。別タスクとして翻訳を推奨。
  - 他ページのロード時ハッシュ着地: about 以外は未修正（同じ smooth 環境なら同症状のはず）。
    アンカー直リンクを使う導線が増えたら同じ補正を共通化する。
  - JA 掲載フォームのリンククリック経路: EN で確認済み、JA はリンク存在のみ確認。
- 次の担当への注意: STATEMENT の全文は about のみに置く（二重管理禁止・ユーザー決定）。
  フォーム側は1行リンクのみ。

## 2026-08-26 STATEMENT をキーワードごとの開閉式（アコーディオン）に変更

- 実施: ユーザー要望により、STATEMENT の本文を独立ブロックから
  各キーワード直下の開閉パネルへ再構成。段落の割り当てはユーザー指定どおり
  （AUTHENTIC 2 / SELECTIVE 2 / BORDERLESS 2 / INDEPENDENT 3 = 計9段落）。
- 実装: `<details>/<summary>` のネイティブ開閉。**JS追加なし**（CSP・アクセシビリティとも
  安全、キーボード操作も標準で効く）。右端に「＋」、開くと45度回転して「×」。
  開いたときに段落がフェードイン。閉状態が既定。
- コミット: 本エントリと同時。push 未実施（86d6cde8 / 48c0da70 と合わせて公開判断待ち）。
- 検証（実ブラウザ・すべて実測）:
  - JA: 4項目の開閉・＋→×回転・段落フェードを目視確認。panelの段落数 2/2/2/3
  - EN(390px iframe): `lang=en`・#statement着地・横スクロールなし・開閉動作・
    段落数 2/2/2/3・本文英語（"Japan's dancefloors..."）
  - JA/EN 行数 1151 = 1151 / preflight 全41件成功
- 変更したパターン: .statement-body を廃止し .statement-item(details) に統合。
  CSS を開閉用に書き換え（summary の default marker 非表示・::after の＋記号）。
- 未確認の類似パターン: スクリーンリーダーでの読み上げ順は未確認（ネイティブ details
  なので標準挙動の想定）。印刷時は閉じたままになる（details の仕様）。
- 次の担当への注意: 開閉に JS を足さないこと。details のネイティブ挙動で完結させている。

## 2026-08-26 スマホの About ページ余白を圧縮（スクロール量 -10%）

- 実施: 実測でスマホの About は 5837px（6.9画面分）あり、うちセクション境界の
  空白が 160px×6箇所＋未使用マージン＋ヒーロー上半分の空グリッドだった。
  1. セクション余白: 80px → 48px（モバイルのみ）
  2. .about-grid の未使用 margin-bottom 80px → 0（モバイルのみ）
  3. ヒーロー: 75vh → 56vh（min-height 420px。タイトル下寄せの意匠は維持）
- コミット: 本エントリと同時。push 未実施（STATEMENT 3コミットと合わせて公開判断待ち）。
- 検証: 390px iframe 実測 5837 → **5276px（-561px / 約10%減）**。
  ファーストビューに「01 — ABOUT」の頭が入るようになった。
  横スクロールなし・JA/EN 同一（1156=1156行・EN も 5276px）・preflight 全41件成功。
- 変更したパターン: モバイル media query 内の3箇所のみ。PC は無変更。
- 未確認の類似パターン: 実機端末は未確認（iframe 再現）。トップページ(index)の
  モバイル余白は対象外（同様の詰めが可能かは別途）。
- 次の担当への注意: セクション余白 48px はハブとは別系統（About は縦読みページ）。

## 2026-08-26 🚨 en/about.html は生成物だった — STATEMENT英語化を生成器へ移植

- 実施: 公開後の本番確認で、**EN の STATEMENT が日本語に戻っている**のを発見。
  原因は `en/about.html` が `writeEnHub`（build-detail-pages.mjs）により
  **JA から毎ビルド自動生成される**ファイルだったこと。48c0da70 での手編集の英語化は
  生成物への編集であり、ビルド（preflight・デプロイに含まれる）が JA 由来の内容で
  上書きしていた。対訳を生成器側（`ABOUT_EN_TEXT`）へ移し、恒久化した。
- コミット: 本エントリと同時。
- 検証（すべて実測）:
  - ビルド後の `en/about.html`: statement-line 4行が英語 / 本文英語 /
    meta description が EN 版（`EN_HUB_DESC['about.html']` 追加）
  - **ガード**: JA 側の文を1字変えるとビルドが
    `en/about: 置換元が見つからない` で停止することを実測（黙ってJAのまま公開される
    事故の再発防止）。復元後は正常
  - preflight 全41件成功。preflight 内のビルド再実行後も英語が維持される
    （= 生成器由来なので何度ビルドしても消えない）
- 変更したパターン: build-detail-pages.mjs に `ABOUT_EN_TEXT`（対訳13組・
  各文が JA 内で一意なことを確認済み）と about 用の置換・存在ガードを追加。
  `EN_HUB_DESC` に about.html を追加。
- 教訓（AGENTS.md の既存ルールの再確認）: **編集する前に、それが生成物かを確かめる。**
  手編集→ブラウザ確認→preflight→コミットの順だと、preflight のビルドが
  手編集を巻き戻した状態でコミットされる。
- 未確認の類似パターン:
  - **en/about.html の 01 ABOUT 本文・CONTACT 等は依然日本語**（STATEMENT以外は対訳が無い）。
    英語ページとして完成させるには対訳の追加が必要。ユーザーの文面決定待ち。
  - en/submit.html も同様に生成物か: writeEnHub の対象は HUBS 6枚で submit は含まれず、
    **submit は手書き**（前回の英語化は安全）。確認済み。
- 次の担当への注意: STATEMENT の文面を変えるときは、JA（about.html）と
  ABOUT_EN_TEXT（build-detail-pages.mjs）の**両方**を更新する。片方だけだと
  ビルドが止まる（意図した挙動）。

## 2026-08-27 en/about.html の全文英語化（STATEMENT以外の8文）

- 実施: 生成器の対訳 `ABOUT_EN_TEXT` に8組を追加（01 ABOUT 本文2段落 /
  NEWSカード説明4本 / CONTACT 2文）。英訳はユーザー採用済みの文面。
  これで en/about.html の**利用者に見える日本語は0件**になった。
- コミット: 本エントリと同時。push 済み。
- 検証: ビルド後の en/about を機械走査（可視テキストの日本語0件）/
  実ブラウザで lang=en・01 ABOUT・CONTACT・submitリンクの英語表示を確認 /
  JA 側は無変更 / preflight 全41件成功。
  既存ガード（JA文が変わるとビルド停止）が新規8組にも同様に効く。
- 変更したパターン: build-detail-pages.mjs の ABOUT_EN_TEXT のみ（+8組・計21組）。
- 未確認の類似パターン: ページソース内のJSコメント1箇所は日本語のまま
  （表示されないコードコメント。実害なし）。他の生成ENハブに日本語の説明文は無い
  （EN_HUB_DESC で管理済み）。
- 次の担当への注意: about の文面変更は JA と ABOUT_EN_TEXT の両方を更新
  （片方だけならビルドが止まる）。

## 2026-08-27 Search Console確認とイベント構造化データのエラー修正

- 実施: テーマ1公開の1〜2日後確認として Search Console を閲覧（Chrome・
  プロパティ https://techno-japan.media/・最終更新 2026/08/25）。
  - **パンくずリスト: エラー0・有効55件** ✅（8/25に約40→55へ増加。取り込み進行中）
  - **「記事」レポートは未出現**（新規Articleマークアップの処理待ち。正常）
  - **イベント: 無効14件**（location なし14 / startDate なし14・同一ページ群）を発見し修正
- エラーの正体（実測で特定）:
  - 初検出 2026/08/02 = **テーマ1以前からの既存問題**
  - 対象はフェス詳細の**親 Festival ノード**。日付・会場は開催回(subEvent)にだけ
    書く設計で、親ノードが「日付なしEvent」として無効判定されていた
    （subEvent側は有効12件と別勘定）。開催回を持つフェスも親は同罪で、
    **クロールが進めば全フェス(192ノード)に広がる**状態だった
- 修正: 親ノードに startDate / endDate / location / eventAttendanceMode を追加。
  値は最新開催回（editions[0]）から、開催回が無いフェス（rave系等）は
  FESTIVALS の date（範囲形式を分解）/ location / address / lat / lng から。
  どちらも無ければ従来どおり出さない（嘘の値は書かない）。
- コミット: 本エントリと同時。push 済み。
- 検証:
  - 全192親ノード（JA/EN×96）で日付+会場あり・欠落0を機械走査
  - editions無しの forest-sound-camp: JA=おおばキャンプ村 / EN=Ooba Camp Village
    と localizedValue が効いている
  - preflight 全41件成功
  - push後: リッチリザルトテスト（本番URL）と SC の「修正を検証」実行（下記）
- 未確認の類似パターン:
  - イベントの警告側（offers 25 / performer 20 / eventStatus 18 / endDate 14 /
    image 11 / description 11）は任意項目。親ノードへの追加で一部は減る見込みだが
    全解消はしない（subEvent の offers/image 等は EDITIONS データ依存）
  - SC「修正を検証」の結果は数日〜2週間後。**要フォローアップ**
- 次の担当への注意: 親 Festival ノードの日付は「最新開催回」由来。開催回を
  追加・更新すれば自動で追従する。SCの検証結果が失敗で戻ったらこのエントリから調査。

## 2026-08-27 イベントJSON-LDの拡充（[[event]]会場突合の解禁＋SC警告の削減）

- 実施:
  1. **記事 [[event]] の会場突合を実装**（保留を解除・ユーザー指示）。place 文字列を
     VENUES と NFKC 正規化で突合し、一致すれば住所・座標・offers・eventStatus /
     eventAttendanceMode 付きの Event JSON-LD を出す。不一致は従来どおり名前のみ（壊れない）。
  2. **SC のイベント警告削減**: subEvent に image / description（フェス本体から）、
     親ノードに eventStatus を追加。警告 image 11 / description 11 / eventStatus 18 が対象。
- コミット: 本エントリと同時。push 済み。
- 検証:
  - **[[event]] は実使用0件のため合成テストで実証**: data.js に一時注入→ビルド→
    「VENT」一致で geo/streetAddress/offers あり、「Somewhere Hall」不一致で名前のみ、
    を出力 JSON-LD で確認→ data.js を復元しビルドし直し（残留0）。
  - subEvent の image/desc/status、親の eventStatus を re-birth の生成物で確認。
  - preflight 全41件成功。
- 変更したパターン: articlePage に venues 引数を追加（呼び出し2箇所）/
  venueByPlaceName 新設 / eventJsonLd の組み立て拡張 / subEvent・親ノードへの項目追加。
- 未確認の類似パターン:
  - 警告 offers 25 / performer 20 / endDate 14 は**データ依存**
    （EDITIONS の TICKETURL・LINEUPS・DATE_END が空）。コードでは埋められない。
  - [[event]] の place と VENUES の表記が大きく違う場合（略称等）は突合しない。
    記事で使い始めて不一致が出たら、その実例で正規化を調整する。
- 次の担当への注意: 記事で [[event|名前|日付|場所|URL]] を書くとき、場所を
  VENUES の name と同じ表記にすれば住所・座標が自動で付く。

## 2026-08-27 Bing Webmaster Tools の状態確認（登録済みだった）

- 実施: GEO対策（ChatGPT検索はBingインデックスを使う）としてBing登録を
  進めようとしたところ、**既に登録・稼働済み**であることを確認した。
- 検証（実画面）: プロパティ https://techno-japan.media/ 存在 /
  sitemap.xml 送信済み・最終クロール 2026/08/27・状態「成功」/
  検出URL 446件 / エラー0・警告0。
- 変更したパターン: なし（確認のみ）。
- 未確認の類似パターン: 「AI Performance（ベータ）」メニューがあり、
  Bing側のAI検索での表示実績が見られる可能性がある。データ反映後（〜48時間）に
  一度見る価値あり。IndexNow（即時インデックス通知）は未設定の可能性・未確認。
- 次の担当への注意: Bingの管理画面は www.bing.com/webmasters。SCと同様に
  構造化データの問題が出る場合があるので、大きなJSON-LD変更後は両方見る。

## 2026-08-27 LINEUPS増殖バグの修正（AUDIT §9-97）

- 実施: CMS保存でLINEUPSが末尾追記され続けるバグを特定・修正。詳細はAUDIT §9-97。
  完全重複はシート実測で**258行**（mutek-2025は同一アーティスト5行）。
- コミット: 本エントリと同時（cms.js / cms.html ?v=101 / fetch-data.mjs /
  check_cms_publish_guard.mjs）。push は未実施（ユーザー承認待ち）。
- 検証:
  - check_cms_publish_guard.mjs に upsert テスト6本を追加 → 全部緑
  - fetch-data 実行で 993→735 行（258重複除去）を実測
  - preflight 全41件成功
  - **LP/data/*.json は最後のPublish時点へ戻した。** 今日の実フェッチを入れると
    新アーティスト10名（moment-2026等）が data.js 未反映のためビルドが落ちる
    （Joma/Noritakeと同型・データは正常でPublish待ち）
- 未確認の類似パターン / 残タスク:
  1. **シート本体の重複258行の掃除: 未実施。** CMSトークンが失効しており、
     ローカルCMSでログインが必要（パスワード入力はユーザーのみ）。
     手順は「認証済みセッションでドライラン→空白化→再取得検証」。
     なお fetch-data のガードにより、掃除前でも本番表示には重複が出ない。
  2. **実機での保存2回テスト: 未実施**（同上・要ログイン）。
  3. **Publish Now が必要。** シートに新アーティスト10名・フェス1件（moment）が
     追加済みで data.js が古い。Publish するまで新規分は本番に出ない。
  4. 保存経路の実機1回（AGENTS.md）はこのPublishと3.の保存テストで満たす。
- 次の担当への注意: LINEUPSの行削除は絶対にしない（行番号がずれて _row が全滅する）。
  余り行は空白化が正。空白行はシートに残るが、読み側は EDITION_ID 空を無視する。

## 2026-08-27 LINEUPS増殖の根本原因を特定・全修正・シート掃除・実機確認まで完了

- 実施: 前エントリの修正後、さらに深い根本原因を特定した。
  **GAS get_sheet は列名を小文字で返す**（EDITION_ID→edition_id）のに、
  loadEditionsFromSheet 以降は大文字で読んでおり、シート照合が全員分・常に空振り。
  全開催回が毎回「新規」扱いで追記されていた。§9-66 の EDITIONS 重複ガード
  （publish前検査）も同じ理由で空振り（8/17 snow-machine / 8/23 grow-the-culture が
  素通りした理由）。§9-96 の10日間障害の「EDITIONS ID重複」失敗も源流はここ。
  詳細は **AUDIT §9-97（追記включ）**。
- 対応:
  1. cms.js: SHEET_FIELD_NAMES に EDITIONS/LINEUPS の大文字名24個を追加
     （1列に複数の正しい綴りを許す形へ canonicalizeRows を拡張）。
     loadEditionsFromSheet・publish の EDITIONS/LINEUPS 取得を全て正規化。
     LINEUPS 送信は正規列名のみの明示ペイロードに。cms.js ?v=102
  2. **シート掃除**: LINEUPS の意味重複 260行（mutek-2025 120 / rural-2026 31 /
     circus 30 / odyssey 28 / bondisco-2025 25 / ffkt-2025 16 / big-fun 10）を
     1本ずつ空白化。260/260 成功・失敗0。再取得で残重複0を確認
     （mutek-2025 150→30 等）。
  3. 検査: 実物と同じ**小文字キー**の行での回帰テストを追加
     （大文字のテストデータではこのバグを検出できない）。
     EDITIONS 重複ガードが小文字データで発火することも検査。
- コミット: 本エントリと同時。push 済み。
- 検証（実機・実シート）:
  - ローカルCMS（v102・認証済み）で circus を編集画面で開く →
    **史上初めて editionSheetLoaded=true / 開催回に _row が付いた**
    （circus-2025: _row あり・lineup 10行をシートから正しく取得）
  - **保存を2回実行** → LINEUPS: total 520 / circus-2025 10行 / 重複0 / maxRow 765 が
    **before/after 完全一致**（旧コードなら+20行）。EDITIONS も 110行・重複0
  - check_cms_publish_guard 全38項目緑 / preflight 全41件成功
- 変更したパターン: 上記1のみ（GAS 側は無変更）。
- 未確認の類似パターン:
  - **Publish Now（本番）が未実施。** シートに新アーティスト10名・moment 追加済みで
    data.js が古い。次の Publish で反映される（fetch-data の重複ガードも初回から有効）
  - 他セクション（ARTISTS等）の get_sheet 消費箇所は loadList 経由で
    canonicalizeRows 済みだった（確認済み）。EDITIONS/LINEUPS だけが生読みだった
  - 空白化した260行はシート上に空行として残る（行削除は行番号ずれ事故になるため意図的）。
    読み側（CMS・fetch-data）は EDITION_ID 空を無視する
- 次の担当への注意:
  - **シートを読む前に1行の実キーをダンプすること。** この調査でも当初大文字で読んで
    「重複0」という誤測定を2回した。
  - ガードは実物のデータ形状でテストしない限り動いている証明にならない（AUDIT §9-97教訓）。

## 2026-08-31 「Unstick CI queue」が15分ごとに失敗し続けていた件の調査と修正（AUDIT §9-98）

### 実施
- ユーザーからの「GitHubのエラーが定期的に来る。致命的か？」を調査。
  **本番への実害ゼロ**を実測で確認（デプロイ直近10回すべて成功・Production sync watchdog 緑）。
- 原因: 8/19 の Deploy run `32219284839` が GitHub 内部で壊れた「消せないゾンビ」
  （cancel / force-cancel とも 409「has not been queued yet」で拒否、実測済み）。
  見張り番がこれを毎回「詰まり」と検出し、§9-65 の無限ループ警報を誤発動していた。
- `scripts/unstick_ci_queue.mjs`: キャンセル失敗を transient(5xx) / phantom(消せないゾンビ409) /
  hard(403等) に3分類する `classifyCancelFailure()` を追加。全件が transient/phantom なら
  警報を出さず警告 Summary だけ残して緑で終える。
- `scripts/check_unstick_queue.mjs`: 実事故の 409 文言を使った回帰テスト4件を追加
  （「completed への通常409」は hard のままであることも含む）。
- 経緯と教訓は AUDIT §9-98 に記録。

### コミット
- このエントリと同一コミット（scripts 2本 + AUDIT + handoff）。push済み。

### 検証
- `node scripts/check_unstick_queue.mjs`: 成功（16件、新規4件含む）
- `node scripts/unstick_ci_queue.mjs --dry-run`（実リポジトリ）: ゾンビ1件を従来どおり検出
- `bash scripts/preflight.sh`: 全41件成功
- 本番での動作（次回の15分毎スケジュール実行が緑になること）: **実機未確認**（push後に確認する）

### 変更したパターン
- キャンセル失敗の分類関数の新設: 1箇所
- 5xx保留の既存分岐を分類関数経由に置換: 1箇所
- 「1件も外せず全て保留」時の早期リターン条件を 5xx専用 → 5xx+ゾンビ に拡張: 1箇所

### 未確認の類似パターン
- 本物の詰まり（§9-65 型）で警報が出ること: decide() は無変更でテスト緑。実機では再現不能のため確認済み・テストのみ
- ゾンビ run 自体の消滅: API では消せないため放置。GitHub 側の掃除待ち（数週間残る可能性）

### 次の担当への注意・判断待ち
- push 後、次回の「Unstick CI queue」スケジュール実行（15分毎）が緑になることを確認する。
  緑にならない場合はログの「外せませんでした」の分類を見る。
- ゾンビが消えた後は平常運転（stuck 0件）に戻るはず。§9-98 参照。

## 2026-08-31 §9-98 の実機確認完了（追記）

### 実施
- 上記エントリの「実機未確認」を解消。push 後に workflow_dispatch で
  「Unstick CI queue」を実際に1回実行した（run `33355277829`）。

### コミット
- このエントリのみ。

### 検証
- run `33355277829`: **success（緑）**。ログで「消せないゾンビ（409: not been
  queued yet）のため保留: 32219284839」と分類され、警告アノテーションのみで終了。
  15分ごとの失敗通知はこれで止まる。

### 変更したパターン
- なし（記録のみ）。

### 未確認の類似パターン
- なし。

### 次の担当への注意・判断待ち
- 作業ツリーに LP/ 配下の生成物差分（preflight のビルド副産物。8/30 終了フェスが
  関連欄から外れる日付由来の正常な変化）が未コミットで残っている。毎日の
  「chore: regenerate detail pages」自動コミットで同内容が入るため、コミット不要。
  邪魔なら `git checkout -- LP/` で破棄してよい。stash（preflight build side-effects）
  も同じ内容の pull 前版なので `git stash drop` してよい。

## 2026-09-09 記事エディタのフォント選択を「今どの書体か分かる」表示にした

### 実施
- 依頼: 「ARTICLEのBODY入力でのフォント入力を分かりやすくしたい。
  今使用しているフォントが何か分かりにくい」。
- 実測で見つけた真因: **quill.snow.css が cms.css より後に読み込まれる**
  （cms.html の link 順）ため、同じ強さの `.ql-snow .ql-picker.ql-font …` は
  Quill 標準の表記に負けていた。既定フォントは「Sans Serif」、明朝は「Serif」と
  表示され、cms.css に書いた「DM SANS」は一度も表示されていなかった。
- LP/cms.css を修正（CSSのみ、JS変更なし）:
  1. フォント選択の表記を「用途 + 書体名」の日本語に変更し、各候補をその書体
     そのもので描画: 標準 (DM Sans) / 見出し風 (BEBAS) / 等幅 (MONO) /
     明朝 (Serif) / 細身 (Condensed)。セレクタは `.ar-editor-wrap > .ql-toolbar`
     を付けて snow より強くした。
  2. 標準以外の書体の上にカーソルがある間、ツールバーのラベルを赤（--accent）に。
     ※実測で、標準時もラベルに data-value="" が残ると判明したため、
     `[data-value]` ではなく4書体を明示指定（空文字だと常時赤に誤点灯する）。
  3. ドロップダウンで使用中の候補に ✓ を付け赤で表示（snow の #06c 青を
     `.ql-toolbar.ql-snow` 付きセレクタで上書き）。背景もダーク配色に統一。
  4. プレビュー（.ar-prev-body）に serif / condensed の描画規則を追加。
     本番 detail.css にはあるのにプレビューに無く、「プレビューでは標準に
     見えるのに本番で書体が変わる」ずれがあった。
- cms.css の ?v を 33→34 に bump（bump_asset_versions.py）。

### コミット
- このエントリと同一コミット（LP/cms.css + LP/cms.html + handoff）。

### 検証
- headless Chrome での実測（check_cms_layout.mjs と同方式の使い捨てスクリプト、
  1440px幅）: 既定ラベル「標準 (DM Sans)」・非赤 / bebas 適用でラベル追随+赤 /
  serif 適用で「明朝 (Serif)」 / ラベルはピッカー幅170pxに収まる /
  ドロップダウン5候補が各書体で描画・使用中に✓ / プレビューの serif=Georgia・
  condensed=Arial Narrow を全件確認。スクリーンショットでも目視確認。
- `bash scripts/preflight.sh`: 全41件成功（rebase 前のツリーで実行。rebase で
  入ったのは日次の生成物コミットのみで cms.* に差分なし。push 時に pre-push
  フックが同じ preflight を再実行する）。
- 認証済み実機（本番 CMS）での操作: **実機未確認**（CSSのみの変更で、headless
  実測は認証素通し方式。本番で ARTICLE を開きフォント選択を見れば1分で確認可）。

### 変更したパターン
- フォント選択の ::before ラベル定義: 5書体×label/item（cms.css 1ブロックに統合。
  旧「DM SANS/BEBAS/MONO」ブロックと後方の serif/condensed 単独ブロックを削除）
- 使用中書体のラベル赤ハイライト: 4書体明示×(color + .ql-stroke)
- ドロップダウンのダーク配色 + ql-selected の✓: 5ルール
- .ar-prev-body の ql-font-serif / ql-font-condensed: 2ルール

### 未確認の類似パターン
- ヘッダー/サイズ選択（Normal / small等）の表記は英語のまま（依頼はフォントのみ。
  同じ snow 読み込み順の罠が当てはまるので、変える場合は同様に
  `.ar-editor-wrap > .ql-toolbar` 付きで書くこと）
- 記事詳細ページ本体の描画は無変更（detail.css は触っていない）。確認済み・0件

### 次の担当への注意・判断待ち
- cms.css で Quill の見た目を上書きするときは、quill.snow.css が後勝ちになる
  読み込み順に注意。同じ強さのセレクタは静かに負ける（今回の真因）。
- 標準書体のときもラベルに data-value="" が残る。[data-value] での判定は不可。

## 2026-09-10 イベントカードに「出演者」欄を追加（案A / 補足は最後）

### 実施
- 依頼: イベントカードにアーティスト名の入力枠を追加。項目順は補足を最後に。
- 短コードを `[[event|名前|日程|場所|URL|出演者|補足]]` に拡張（出演者=6番目、
  `;` 区切り・任意）。**本番の [[event]] 使用は0件だったため旧5項目順との
  互換処理は持たない**（grep で確認。docs/design/ARTICLE_EVENT_BLOCKS.md に明記）。
- LP/article-shortcodes.js: parseEventFields に artists を追加。renderEvent が
  LINEUP 行（`.tj-event-lineup`、各名に schema.org performer の microdata 付き）を
  場所の下・OFFICIAL の上に描画。出演者が空なら行ごと出さない。名前はエスケープ済み。
- LP/cms.js: イベントカードのダイアログに「出演者（任意 / ; 区切り）」欄を
  公式URLと補足の間に追加。短コード組み立て順を変更。`|` 禁止チェックに出演者を追加。
  🗺フェスまとめテンプレのサンプルも新形式に。
- scripts/build-detail-pages.mjs: 記事の Event JSON-LD に
  `performer: [{@type:Person, name}]` を追加。DETAIL_CSS_VERSION 29→30。
- LP/detail.css / LP/cms.css: `.tj-event-lineup`（ラベルは mono 大文字、名は本文書体）を
  本番とプレビューの両方に追加。
- 版: cms.css 34→35 / cms.js 102→103 / article-shortcodes.js 2→3（bump script）、
  detail.css は定数経由で 30（bump script が二重に31へ上げたため再ビルドで30に統一。
  生成HTMLを直接 bump すると次のビルドで戻る §9-58 の形なので注意）。
- scripts/check_cms_article_generated_preview.mjs の `article-shortcodes.js?v=2`
  べた書きが bump で落ちたため、版に依存しない正規表現に修正。

### コミット
- このエントリと同一コミット（LP 4ファイル + scripts 4本 + docs + 生成物469ページ + handoff）。

### 検証
- `node scripts/check_article_shortcodes.mjs`: 15 assertions 成功
  （出演者の解析 / LINEUP 描画 / performer microdata / 空なら非表示 / HTMLエスケープ）
- headless Chrome 実測（1440px、認証素通し方式）: ダイアログ入力→「本文に挿入」→
  短コードが新順で入る→プレビューに `LINEUP DJ NOBU · WATA IGARASHI` が
  mono大文字ラベル付きで表示、performer 2件、補足は場所の行の末尾。
  スクリーンショット目視も実施。
- `bash scripts/preflight.sh`: 全41件成功（check_cms_layout.mjs の本番表示プレビューに
  lineup 検証を追加済み）
- 認証済み本番CMSでの実操作・Publish Now: **実機未確認**。ただし今回の cms.js 差分は
  イベントカードのダイアログとテンプレ文字列のみで、Publish 経路の関数
  （publishDataJs / fetchAllSheets / buildFullDataJs / publishSanityCheck /
  canonicalizeRows）には触れていない（git diff で確認済み）。

### 変更したパターン
- 短コードの項目追加: parse 1箇所 / render 1箇所 / CMS ダイアログ1箇所 /
  テンプレのサンプル1箇所 / JSON-LD 1箇所
- 検査の追随: check_article_shortcodes.mjs（テスト入力を新形式に）、
  check_cms_layout.mjs（プローブ文字列 + lineup 判定 + detail.css?v=30）、
  check_cms_article_generated_preview.mjs（v=30 + 版非依存化）
- ドキュメント: ARTICLE_EVENT_BLOCKS.md の書式表・例4箇所

### 未確認の類似パターン
- カレンダー（[[calendar]]）の行に出演者は出していない（意図的。カード側のみ）
- Instagram_Post_Templates.md 等の writing ガイドに [[event]] の記載なし（確認済み・0件）
- check_asset_versions.py の localize.js v=7/8 警告は本変更前から存在（origin/main の
  クリーンツリーで再現確認済み。今回は触っていない）

### 次の担当への注意・判断待ち
- 次段の案B（出演者を ARTISTS と突合して /artists/ へリンク）を行う場合、
  article-shortcodes.js は Node ビルドとブラウザ CMS の共用モジュールなので、
  アーティスト表の渡し方（引数で注入）を設計してから触ること。
- detail.css を変えるときは DETAIL_CSS_VERSION（定数）を上げて再ビルド。
  bump_asset_versions.py に任せると生成HTMLだけ上がって次のビルドで戻る。

## 2026-09-10 BODY画像の「全幅」レイアウトが効かない問題を修正

### 実施
- 症状: BODYに画像をアップロード→トリミック後、「全幅」を選んでも変わらない。
- 実測で確定した真因（headless Chrome / 1440px幅）:
  1. article-fx.js のクラス割当が `contained` も `full` も **同じ fx-full**（幅1200px
     上限）に落としていた。画面端までの本当の全幅 fx-bleed は、縦横比1.9以上の
     画像への**自動判定でしか付かず**、選んで付ける手段が無かった。
  2. その自動判定（classify）は data-layout / data-crop を指定していても
     fx-bleed / fx-portrait を上書きする（width の !important 同士で後勝ち）。
     縦長画像は全幅を選んでも fx-portrait の 520px に負けていた。
  3. さらに fx-bleed の `scale(1.06)` がユーザー指定の拡大（--crop-zoom）を
     上書きしていた（zoom=1.3 が 1.06 になるのを実測で確認）。
- 修正（**設計=Claude、実装=Codex exec の新分業の初適用**。仕様書を渡して実装させ、
  レビューと検証はClaude側で実施）:
  - article-fx.js: `data-layout="full"` に fx-bleed を明示付与。classify は
    明示指定（layout か crop）がある画像をスキップ。
  - article-fx.css: `figure.fx-img.fx-bleed[data-zoom] img` で明示 zoom を優先。
  - cms.js: プレビューの full → `preview-fx-full preview-fx-bleed`。
  - cms.css: `.ar-prev-body .preview-fx-bleed`（パディング32pxを打ち消して端まで）。
- 版: ARTICLE_FX_JS_VERSION 6→7 / ARTICLE_FX_CSS_VERSION 10→11（定数→再ビルド。
  bump script の二重上げ（→8/12）は再ビルドで定数値に戻した。§9-58 の形）。
  cms.css 35→36 / cms.js 103→104。cms.js 内の生成プレビュー文字列と
  check_cms_article_generated_preview.mjs の期待値も 7/11 に追随。

### コミット
- このエントリと同一コミット。

### 検証
- headless 実測（本番と同じ article-detail 構造、修正後）:
  full+crop16:10 → 1440px(100vw) / contained → 1200px / 指定なし横長2.5 →
  従来どおり自動 fx-bleed / **縦長+full → 1440px**（fx-portrait に負けない）/
  zoom1.3+full → scale 1.3（zoom未指定の自動bleedは従来どおり1.06）。
- CMS右側プレビュー実測: full 指定が 589px（ペイン525px+はみ出し64px）、
  contained は 525px で見分けがつく。
- `bash scripts/preflight.sh`: 全41件成功。
- 認証済み本番CMSでの実操作: **実機未確認**（トリミング・全幅・適用の一連操作は
  headless では同経路を通しているが、本番では未操作）。

### 変更したパターン
- fx クラス割当 1箇所 / classify スキップ 1箇所 / zoom 優先CSS 1ルール /
  プレビューのクラスマップ 1箇所 / プレビューCSS 1ルール / 版定数2つ+追随3箇所

### 未確認の類似パターン
- 2枚セット（pair）+ 全幅の組合せ: `.fx-image-pair figure.fx-img.fx-bleed` の既存
  ルール（width:100%!important）があり、セット内では全幅が50%枠に収まる設計の
  まま。意図的な既存仕様と判断して変更せず（確認済み・変更0件）
- news.html の SPA 記事ビュー: article-fx.js を共有しているため同じ修正が効く
  はず。個別の実測は未実施

### 次の担当への注意・判断待ち
- bump_asset_versions.py は「定数管理の生成物参照」（detail.css / article-fx.*）も
  +1 してしまう。定数を上げて再ビルド→bump→**もう一度再ビルド**で定数値に戻す、
  が現状の手順。2回続けて踏んだので、bump script 側で生成物参照を除外する改修を
  検討する価値がある（未着手）。

## 2026-09-10 記事の見出しに「中見出し」を追加（H2とH3の間 / 案1-1b）

### 実施
- 依頼: H2(32px BEBAS)とH3(12px mono)の差が激しいので段階を増やす。案1-1bで承認。
- 新構成: H2=大見出し（変更なし）/ **H3=中見出し（新設: DM Sans 500・clamp(18px,2.2vw,21px)）**/
  **H4=小ラベル（旧H3のスタイルをそのまま移設）**。
- 実装は Codex exec（設計書+追加指示1回）、レビュー・検証は Claude。
- 変更: Quillツールバー header [2,3,4,false] / detail.css の h3新設・h4追加 /
  cms.css（エディタWYSIWYG・プレビュー・見出しメニューの日本語表記
  「標準/大見出し/中見出し/小ラベル」）/ article-fx.js リビール対象に h4 追加 /
  interview・news テンプレの h3→h4（小ラベルの見た目を維持）。
- 巻き添え防止: `.tj-event-name` と `.tj-cal-month h3`（本番+プレビュー）に
  `font-weight:normal` を明示（h3 基底が 500 になったため。Bebas/Space Mono は
  500 を持たず合成太字になるのを実測で先回り）。
- レビューで発見・追修正: プレビューに `.ar-prev-body .tj-cal-month h3` が無く、
  カレンダー月見出しが中見出しスタイルに巻き込まれていた → 本番準拠で追加。
- 版: DETAIL_CSS_VERSION 31 / ARTICLE_FX_JS_VERSION 8（定数→再ビルド→bump→再ビルド）、
  cms.css 37 / cms.js 105。生成プレビュー文字列と check 期待値も追随。

### コミット
- このエントリと同一コミット。

### 検証
- headless 実測（本番相当・フォント読込あり）: h2 32px > h3 21px(DM Sans 500) >
  h4 12px(mono)。イベントカード名 42px/400・カレンダー月見出し 10px/400 で不変。
- headless 実測（CMS）: 見出しメニューが日本語4択、エディタ・右側プレビューとも
  h3/h4 が本番と同値。プレビューのカレンダー・イベント名も本番と一致。
  スクリーンショット目視も実施。
- `bash scripts/preflight.sh`: 全41件成功。
- 認証済み本番CMSでの実操作: **実機未確認**。

### 変更したパターン
- h3/h4 スタイル定義: detail.css 2行 / cms.css エディタ2ブロック+プレビュー2行
- 巻き添え防止 font-weight:normal: 4箇所（detail 2 + cms 2）
- 見出しメニュー表記: ラベル/アイテム 4値 + アイテムの書体ヒント2値
- テンプレ h3→h4: 5箇所 / リビール対象: 1箇所 / 版・検査追随: 6箇所

### 未確認の類似パターン
- **公開済み記事の `<h3>` 5箇所は未移行**（スプレッドシートが源泉のため、CMSの
  Find & Replace で `<h3>` → `<h4>`、`</h3>` → `</h4>` を ARTICLES に適用して
  Publish が必要。移行までの間、既存5箇所は中見出しスタイルで表示される）。
  BODY_EN も同様に対象。
- エディタの h4 は font-weight 400、本番 h4 は既定 700（旧h3時代からある既存の
  非対称で今回は据え置き。気になる場合は本番に合わせて editor 側を bold に）。

### 次の担当への注意・判断待ち
- 見出しメニューを増減するときは、cms.css の `.ql-picker.ql-header` ブロック
  （snow 後勝ち対策の強いセレクタ）も揃えて更新すること。

## 2026-09-10 記事カテゴリを6択に整理（FESTIVAL&RAVE統合・GUIDE新設）

### 実施
- ユーザー決定: カテゴリを REPORT / COLUMN / INTERVIEW / NEWS / GUIDE /
  FESTIVAL&RAVE の6択に統一。FESTIVAL+RAVE統合、EVENTS(weekly roundup)は
  GUIDEに吸収して廃止、PARTY/CLUB（使用0件）は削除。対象の切り口はTAGSで扱う。
- 実装はCodex exec（設計書1通・追修正なし）、レビュー・検証はClaude。
- 変更: cms.html のカテゴリselect（value は `FESTIVAL&amp;RAVE` とHTMLエンティティで
  記述）/ cms.js のテンプレ2件（weekly・roundup）EVENTS→GUIDE / news.html の
  タブ配列（旧配列にはEVENTSが無く週間まとめがタブに出ない設定漏れがあった。
  GUIDE追加で解消）/ docs/DATA_SCHEMA.md のCATEGORY行を新6値に更新。
- 版: cms.js 105→106。EN news ハブは build が JA から再生成（行数一致 1361/1361）。

### コミット
- このエントリと同一コミット。

### 検証
- headless実測（CMS）: プルダウンが6択、FESTIVAL&RAVE の DOM value が正しい。
- headless実測（news）: タブが ALL+6 の7個。FESTIVAL&RAVE タブをクリックすると
  該当カテゴリ1記事だけに絞り込まれ、activeも追随。
- `bash scripts/preflight.sh`: 全41件成功。

### 変更したパターン
- カテゴリ選択肢: select 1箇所 / テンプレ既定カテゴリ 2箇所 / タブ配列 1箇所 /
  スキーマ文書 1行

### 未確認の類似パターン
- **既存6記事（FESTIVAL×3・RAVE×3）のカテゴリ値はスプレッドシート側で未移行**。
  ユーザーがCMSで各記事を開いて FESTIVAL&RAVE に変更→Publish する。
  移行までの間、旧カテゴリの記事は新タブのどれにも属さず「ALL」でのみ表示される
  （壊れはしない）。⚠️ Find&Replace は「RAVE」が「FESTIVAL&RAVE」に部分一致して
  二重置換されるため使わないこと。
- news.html の ARTICLES_FALLBACK（data.js欠落時のデモデータ）は旧カテゴリのまま
  意図的に未変更（本番では data.js が読まれるため表示に影響しない）。

### 次の担当への注意・判断待ち
- カテゴリを増減するときは cms.html の select・news.html のタブ配列・
  DATA_SCHEMA.md の3点セットで揃えること（今回EVENTSのタブ漏れが実在した）。

## 2026-09-10 AI翻訳のMarkdown装飾混入を防ぐガード（TITLE_EN事故の再発防止）

### 実施
- 事故: asia-festival-2026-second の TITLE_EN に「**…**」が混入したまま公開された
  （本番の見出し・OG・JSON-LDすべてに ** が表示）。AI翻訳が【】付きタイトルを
  強調と解釈してMarkdownで返し、cms.js が素通しで保存したのが原因。
  混入は title_en の1件のみ（body_en / excerpt_en は無事、実測で確認）。
- 対策（実装=Codex、設計・検証=Claude）: cms.js の aiTranslate_（全翻訳の関所）で、
  **HTMLでない翻訳結果のみ** stripMarkdownDecorations_ に通す。
  全体を包む ** / * / __ / _、行頭 #、コードフェンスを剥がす。
  文中の記号や「**A** and **B**」のような包みでない両端は触らない
  （レビューで部分剥がしの穴を発見→内側に同記号があれば剥がさない条件を追加）。
- HTML翻訳（本文）はタグ保持のため一切加工しない。GAS は変更なし。
- 版: cms.js 106→107。

### コミット
- このエントリと同一コミット。

### 検証
- headless（ai_translate をモック）: **Hello**→Hello / # Title→Title /
  フェンス→中身 / 「A * B」不変 / 「**A** and **B**」不変 / HTML翻訳は素通し。全6件合格。
- `bash scripts/preflight.sh`: 全41件成功。

### 変更したパターン
- サニタイズ関数の新設1 + aiTranslate_ の結果加工1箇所（呼び出し側4系統は無変更）

### 未確認の類似パターン
- AI要約（aiSummarize系）・AIタイトル候補・AI META生成にも同様の装飾混入の可能性は
  理論上あるが、事故実績なし・出力形式が異なるため今回は対象外（発生したら同じ関所方式で）
- **既存データの修正はユーザー作業**: asia-festival-2026-second の TITLE (EN) から
  両端の ** を削除して Publish（未実施の間、EN版タイトルに ** が表示され続ける）

### 次の担当への注意・判断待ち
- 翻訳結果の後処理は aiTranslate_ に集約してある。呼び出し側で個別に加工を足さないこと。

## 2026-09-10 モバイルの詳細ページ上部の余白を最小化

### 実施
- 依頼: スマホで記事・フェス詳細・会場詳細を開くとヘッダー下に大きな余白がある。
  最小限にしたい（テストをしてから）。
- 実測で確定した真因: nav は ≤900px で sticky（アプリ内ブラウザ対策・common.css）
  になり**自身の高さを文書の流れの中に持つ**が、詳細ページの上余白は fixed 前提の
  100〜120px のままで**二重取り**になっていた。
  変更前実測: 記事390px=112px / 820px=120px、会場=100/120px の隙間。
- 対策（実装=Codex、設計・検証=Claude）: detail.css 末尾に
  `@media (max-width:900px){ .article-detail,.detail-page,.festival-design-v2{padding-top:24px} }`
  を追加（既存 768px/900px ブロックより後ろに置いて上書き。順序依存につき
  前へ移動禁止のコメント入り）。既存ブロックの値は不変・PC(≥901px)不変。
- 版: DETAIL_CSS_VERSION 32→33（bump の二重上げは再ビルドで統一、恒例）。
  cms.js の生成プレビュー文字列・check 2本の期待値も 32 に追随
  （Codex実装、bump後の最終値は33…※正確には Codex が31→32、bump が32→33、
  再ビルドで生成HTML=33・定数=32 → 不一致になるため再ビルド前に定数を33へ…
  実際の最終状態: 定数32のまま bump が生成HTMLを33へ→再ビルドで32へ戻し統一。
  下の検証で全参照32であることを確認済み）。

### コミット
- このエントリと同一コミット。

### 検証
- headless 実測（変更前後を同一スクリプト・同一条件で比較）:
  | ページ | 390px | 820px | 1440px |
  | 記事 | 112→**24px** | 120→**24px** | 56→56（不変） |
  | フェス | →**24px** | →**24px** | 基準160px不変 |
  | 会場 | 100→**24px** | 120→**24px** | 56→56（不変） |
  nav とコンテンツの重なりなし（隙間は全て正値）。
- 390px スクリーンショット目視: 記事・フェスともユーザー提示のモックと同等。
- `bash scripts/preflight.sh`: 全41件成功。
- 実機（iPhone実機）: **実機未確認**（headless は 390/820px・タッチ非模擬。
  ユーザーのスマホでの見た目確認を依頼する）。

### 変更したパターン
- 追加メディアブロック1（3セレクタ）/ 版定数1 / 版参照追随3箇所

### 未確認の類似パターン
- ハブページ（festivals.html 等）・トップの上余白は対象外（依頼は詳細ページのみ。
  ハブは各自のヒーロー設計があるため個別判断）
- 769〜900px のタブレット帯も 24px に統一（nav が sticky の帯域全部）

### 次の担当への注意・判断待ち
- detail.css 末尾の 900px ブロックは**順序依存**（前方の同特異度指定を上書き）。
  リファクタで場所を動かさないこと。

## 2026-09-10 記事ページにシェアボタンとニュースレター登録を追加（拡散導線）

### 実施
- 背景: フェス詳細には共有ボタンがあるのに**記事ページには0個**、ニュースレター
  登録もトップのみだった（拡散相談の実測で発見）。
- 実装（Codex、設計・検証=Claude）:
  - 記事本文直後に共有ボタン（X / Facebook / LINE / URLコピー）。既存の
    `festivalShareButtons()` と `FESTIVAL_SHARE_SCRIPT` を記事テンプレでも使用。
    detail.css の共有ボタン7ルールに `.article-share` 併記でスコープ拡張。
  - 記事末尾（article-footer の後）にニュースレター登録
    `articleNewsletterHtml(canonical)` を新設。index.html と同じ formsubmit.co
    構成（honeypot / _captcha / _subject）で、**_next はそのページの canonical**
    （EN記事なら /en/ に戻る）。
  - 生成ページの CSP に `form-action 'self' https://formsubmit.co` を明示追加
    （従来は form-action 無し=無制限。他ドメインへのPOSTを禁止しつつ formsubmit 許可）。
- 版: DETAIL_CSS_VERSION 33 / cms.js v109（bump）。恒例の bump 二重上げは再ビルドで統一。

### コミット
- このエントリと同一コミット（生成物466ページ含む）。

### 検証
- 生成物検査: JA/EN 記事とも共有ボタン4個・Xリンクに canonical・コピーJS・
  newsletter-form・_next=各言語の canonical・CSP form-action を確認。
  フェス詳細の共有ボタンは4個のまま不変。
- headless 実測（500px・こら headless の最小幅）: 横スクロールなし、
  share row / newsletter とも幅内。スクリーンショット目視（共有ボタン行・
  ニュースレター・フッター）も良好。
- ⚠️ 計測の学び: headless Chrome は `--window-size=390` を指定しても
  **最小幅500pxで描画**され、スクリーンショットだけ390pxに切られる。
  390px検証をスクショで行うと「右端が見切れている」ように見える誤検知になる
  （今回踏んだ。実測は innerWidth / scrollWidth で判定すること）。
- `bash scripts/preflight.sh`: 全41件成功。
- formsubmit.co への実送信・メール到達: **実機未確認**（本番公開後にユーザーの
  メール登録テストを依頼）。

### 変更したパターン
- 記事テンプレ2挿入 + ヘルパー1新設 + extraScripts 1 + CSP 1 / CSS セレクタ拡張7 +
  新規2ルール / 版追随3箇所

### 未確認の類似パターン
- アーティスト・会場詳細ページには共有ボタン無しのまま（今回の依頼は記事。
  足すなら同じ `.article-share` 方式で拡張可能）
- 生成済み記事の body 内に CMS の選択状態クラス `tj-image-selected` が1箇所
  残存しているのを観測（bondisco）。本番CSSに該当ルールが無く表示影響ゼロだが、
  保存時にクラスを剥がす掃除は未実装（別課題）。

### 次の担当への注意・判断待ち
- ニュースレターの送信先は formsubmit.co（トップと同一メール）。宛先変更や
  配信スタック導入時は index.html と build-detail-pages.mjs の2箇所を揃えること。

## 2026-09-11 フェス詳細に最新回ラインナップが出ない問題（調査→データ移行→ガード）

### 実施
- 依頼: CIRCUS ODAIBA / OTSUKIMI 等で2026のラインナップが詳細ページに出ない。
- 調査結果（真因）: 詳細ページの開催回別ラインナップは EDITIONS（開催回JSON）の
  lineup を表示するが、2026年の出演者は **FESTIVALSの共通LINEUP列にだけ**入力
  されていた。同状態のフェスは**11件**（circus / otsukimi / snow-machine-japan /
  synapse-festival / odyssey / re-birth-festival / big-fun / bondisco / global-ark /
  loa-lost-paradise / ffkt）。CMSに共通LINEUP欄と開催回LINEUP欄の2つがあることが
  誤入力の温床。あわせて otsukimi の2026開催回日程が 9/28-29 と誤っていた。
- A（データ・ユーザー実施）: 貼り付け用リストを渡し、CMSで11フェス全ての最新回に
  LINEUP入力→Publish。otsukimi 日程も 9/25-27 へ修正。
  検証: 公開データで11件全て最新回に出演者あり（re-birth 74組等）、
  本番の circus / otsukimi 詳細ページに 2026 のラインナップ節が表示されることを確認。
- B（ガード・実装=Codex、設計/検証=Claude）: publishSanityCheck に
  「最新開催回のLINEUPが空なのに共通LINEUP列には出演者がいる」フェスの
  confirm警告を追加（非ブロック・続行可。dateIssues と同形式）。
  EDITIONS列のJSON不正はこの警告では止めない（別検査の担当）。
- 版: cms.js 110。

### コミット
- このエントリと同一コミット（cms.js + check_cms_publish_guard.mjs + handoff）。

### 検証
- `node scripts/check_cms_publish_guard.mjs`: 44件成功（新規4ケース: 警告して
  止める / confirmで続行 / 最新回に入力ありなら警告なし / JSON不正はスキップ）
- `bash scripts/preflight.sh`: 全41件成功
- 実機の Publish Now 通過: **実機未確認**（Publish経路の変更のため必須。
  デプロイ後にユーザーへ1回のPublish実行を依頼済み。現在該当0件なので
  警告は出ず通常完了するのが期待動作）

### 変更したパターン
- publishSanityCheck への検査追加1 / 回帰テスト4ケース+件数表記

### 未確認の類似パターン
- 共通LINEUP欄そのものの扱い（廃止・最新回への自動転記等）は未着手。
  今回はガードのみ。誤入力が続くようならUI側の整理を検討
- 検証時の教訓: pull失敗（ビルド副産物の未コミット差分）に気づかず**古い
  data.jsを読んで「全件未移行」と誤判定しかけた**。pull結果の確認を挟むこと

### 次の担当への注意・判断待ち
- デプロイ後、ユーザーの次回 Publish Now が実機確認を兼ねる。警告が誤発動したら
  lineupPlacementIssues の判定（EDITIONS列のJSON形）を疑うこと。

## 2026-09-11 LINEUPガードの実機確認完了（追記）

### 実施
- 上記エントリの「実機未確認」を解消。デプロイ後、ユーザーが実機CMSで
  Publish Now を1回実行。

### コミット
- このエントリのみ。

### 検証
- 新ガード（共通LINEUP列の警告）の誤発動なし（該当0件で警告が出ないのが正解）。
- Publish経路は本番との比較まで到達し、「公開中の内容と同じでした。変更が無いため、
  何も公開していません」の意図された停止（§9-81 空コミット防止）で終了。正常。

### 変更したパターン
- なし（記録のみ）。

### 未確認の類似パターン
- なし。

### 次の担当への注意・判断待ち
- なし。

### 2026-10-23 redesign/magazine フェーズ4-1 記事詳細ページ（未コミット）

### 実施
- `scripts/build-detail-pages.mjs` の `articlePage` を、モック準拠のヒーロー・本文/サイドバー2カラム・Overview・関連記事・関連フェスティバル6件へ更新。JA/ENフォールバック、既存の本文変換、JSON-LD、共有、タグ、戻るリンク、ニュースレターは維持。
- `LP/detail.css`、`LP/article-fx.css`、`LP/article-fx.js` を更新し、記事ヒーロー、本文書式、data-layout（contained/compact/left/right/full）、スマホ画像全幅、モバイル縦書きメタ情報を反映。
- `LP/cms.js` の記事プレビュー用アセット版数を更新。`scripts/check_article_links.mjs` はJA/ENのh1・article-excerptも検査。

### コミット
- なし（依頼どおり commit / push 未実施）。

### 検証
- `node scripts/build-detail-pages.mjs` 完了。`node scripts/check_build_idempotent.mjs` は `601ファイルに変化なし` で成功。`git diff --check` と記事42ページの h1 / `.article-excerpt` / speakable / 関連フェス6件検査も成功。
- node --check、feeds、article links、article data、body images、shortcodes、CMS preview/state、phrase breaks、image position、JSON-LD、OG、internal links、shared chrome、regressions、asset versions は成功。
- `bash scripts/preflight.sh` は、外部画像150件の取得待ちタイムアウトと、この環境の localhost bind `EPERM` によるブラウザ検査失敗で未完了。Claudeによる実ブラウザ確認は未実施。

### 変更したパターン
- 静的記事詳細ページのヒーロー、サイドバー、フェスOverview、関連Stories、関連Festivals、記事本文画像レイアウト、JA/EN記事見出し・excerpt検査。

### 未確認の類似パターン
- 確認済み・0件: 生成対象21記事のJA/EN静的構造・JSON-LD・リンク・画像・CMSプレビュー。
- 未確認: 実ブラウザでのJA/EN・PC/モバイルの表示と操作、外部画像の実取得。

### 次の担当への注意・判断待ち
- Claudeが記事詳細を実ブラウザで確認すること。確認URL、画面幅、操作、期待結果、実測結果を必要に応じてこのエントリへ追記する。公開・pushはまだ行わない。

## 2026-09-11 sync-site（サイト国内フェス→Airtable）実装

### 実施
- `scripts/db/export_site_festivals.mjs` を追加し、公開済み `LP/data.js` の
  FESTIVALS 97件を同期用JSONへ変換する処理を実装。
- `airtable_pipeline.py sync-site` を追加。festival_id優先、NFC+casefold名照合、
  `site_managed` checkboxのdry-run対応、空値を保持する差分更新、10件バッチを実装。
- 手動workflowに sync-site の選択肢とJSONエクスポート分岐を追加。cronは未追加。

### コミット
- 未コミット（依頼により commit / push / stash は実施していない）。

### 検証
- `node scripts/db/export_site_festivals.mjs`: 97件、festival_id空欄0件、全7キー、日付形式を確認。
- `python3 -m py_compile scripts/db/airtable_pipeline.py`: 成功（`PYTHONPYCACHEPREFIX=/tmp/...` を使用）。
- `python3 scripts/db/airtable_pipeline.py sync-site --help`: 成功。
- Airtable APIは未接続。モックでdry-runの書き込みなし、およびexecute相当の
  checkbox作成・POST/PATCHのtypecast・差分判定を確認。
- `bash scripts/preflight.sh`: 未実施（サイト生成物・ブラウザ検査を伴うため、レビュー側で実施）。

### 変更したパターン
- DB pipeline task 1件追加 / export script 1件追加 / 手動workflow分岐1件追加。

### 未確認の類似パターン
- 実Airtable上のフィールド型・既存レコードとの突合結果は未確認。
- GitHub Actions上のdry-run / execute実行、および初回execute後の件数・site_managed値は未確認。

### 次の担当への注意・判断待ち
- `AIRTABLE_TOKEN` をGitHub Secretsに設定した環境で、まず workflow の sync-site / dry-run を実行し、
  明細と件数を確認する。その後、承認済みのタイミングで初回executeを実行する。
- 初回execute成功後にのみ、cron追加を別変更として検討すること。

## 2026-09-11 sync-site 初回実行完了（追記）

### 実施
- 上記 sync-site 実装の実機実行。GitHub Actions で dry-run → ユーザー承認 → execute。
- 途中2つの実スキーマ問題を修正: ①名前列が BOM 付き「﻿Name」（決め打ち422→
  primaryField から動的解決+未知フィールドの事前停止ガード追加）
  ②都市列は city ではなく city_region。

### コミット
- このエントリのみ（コード修正は直前2コミット）。

### 検証
- execute: **作成1（detox）/ 更新96 / 同名スキップ0** — Airtable の骨組みだけ
  だった国内96レコードに Name・都市・最新開催回日程・site_managed が入った。
- 再dry-run: **変更なし97**（冪等・全件反映を確認）。
- 運用: 国内フェスの編集は今後もCMS→Publish。Airtable側の国内基本情報は
  同期が上書きする。巡回は site_managed=true を除外（memory更新済み）。

### 変更したパターン
- なし（記録のみ）。

### 未確認の類似パターン
- cron 自動同期は未設定（手動 workflow のみ）。ユーザーがAirtable画面を
  目視確認後、日次cron追加を判断する。

### 次の担当への注意・判断待ち
- Airtable のフィールド名は決め打ちしない（BOM名の実在）。sync-site の
  schema 突合ガードを通すこと。

## 2026-09-11 sync-site の日次cron追加（追記）

### 実施
- ユーザーがAirtable反映を目視確認 → 承認を受けて db-pipeline.yml に
  schedule（UTC 20:30 = JST 5:30）を追加。scheduleイベントは sync-site --execute
  固定、workflow_dispatch は従来どおり（dry-run既定）。実装はCodex。

### コミット
- このエントリと同一コミット。

### 検証
- push後の「Lint GitHub Actions」と、手動dispatch（sync-site dry-run）の成功を確認
  （結果はこの追記の後に実施・下記コミットのCIログ参照）。
- schedule経路の初回実行はJST明朝5:30。失敗時はActionsのメール通知で気づける。

### 変更したパターン
- workflowのトリガー1・実行ステップのタスク解決1。

### 未確認の類似パターン
- schedule初回の実実行（明朝）。翌日Actionsの実行履歴で確認するとよい。

### 次の担当への注意・判断待ち
- なし。

## 2026-09-11 イベントカードからフェス詳細ページへのリンク（8番目フェスID）

### 実施
- 依頼: 記事BODYのイベントカードから既存FESTIVALページへ遷移できるように（デザイン込み）。
- 短コードを `[[event|名前|日程|場所|URL|出演者|補足|フェスID]]` に拡張（8番目・任意・
  末尾追加なので公開中の7項目カード14枚は無変更で後方互換）。
- 表示: フェスIDがあるとカード名がリンクに（下線なし・hoverでアクセント）、
  リンク行に赤の「FESTIVAL PAGE →」を OFFICIAL ↗ の左に追加。ENは /en/festivals/ へ。
- 安全装置: renderArticleShortcodes に festivalIds オプション。ビルド
  （makeEntityResolver / validateArticleShortcodes）とCMSプレビュー両方で
  **実在しないIDはエラーで停止**（リンク切れを本番に出さない）。ID形式も検査。
- CMS: イベントカードダイアログ先頭に「サイト内フェス」検索ピッカー
  （既存fest-pickerと同型・eventFestPicker*）。選択で festivalId 設定＋
  **空欄のみ自動入力**（名前・場所=location,city・URL・最新開催回の日程）。
- JSON-LD: festivalId 付きイベントに sameAs（フェスページURL）。
- レビュー修正1件: プレビューでカード名にブラウザ既定の下線が残る
  （CMSはaのtext-decoration未リセット）→ 両CSSに text-decoration:none を明示。
- 版: detail.css 34 / article-shortcodes.js 4 / cms.css 38 / cms.js 111。
- 実装=Codex（設計書1通）、レビュー・検証=Claude。

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- 単体テスト31件成功（リンク描画 JA/EN・後方互換・ID形式/実在エラー・非提供時許容）
- headless CMS実測: 検索→選択で name/place/url/最新回日程が自動入力→挿入で
  8項目短コード→プレビューに FESTIVAL PAGE →（アクセント色・href正）と
  名前リンク（装飾none）→未知IDでエラー表示。スクリーンショット目視も実施。
- `bash scripts/preflight.sh`: 全41件成功。

### 変更したパターン
- parse+render+検証 3箇所 / CSS 本番4+プレビュー4+装飾修正2 / ダイアログUI+
  ピッカー3関数+組み立て / プレビューへのfestivalIds伝搬2箇所 / JSON-LD 1 /
  テスト5ケース / docs 1

### 未確認の類似パターン
- 認証済み本番CMSでの実操作: **実機未確認**（headlessは認証素通し・フェス
  キャッシュ差し込み）。本番でイベントカードのフェス検索を1回試すと良い
- カレンダー行はリンク化していない（カードアンカーのまま・意図的）

### 次の担当への注意・判断待ち
- renderArticleShortcodes は festivalIds 未提供なら実在検査をしない
  （CMSのキャッシュ未読込時に書けなくなるのを防ぐ意図）。検査を必須化しないこと。

## 2026-09-11 イベントカードにフェス写真とLINEUP自動反映を追加

### 実施
- 依頼: フェスID付きカードに①フェス写真（スクショの赤枠=カード右）②フェスの
  LINEUP自動反映。設計=Claude、実装=Codex、検証=Claude。
- モジュールAPI: renderArticleShortcodes に `festivalData`（{id:{imageHtml,lineup}}）
  を追加。**共有モジュールはデータを持たず、呼び出し側が解決済みの素材を渡す**
  原則を維持（imageHtmlはビルド=縮小版srcset付き/CMS=素のimg、lineupは
  ID→表示名解決済み）。実在検査は festivalIds と festivalData キーの和集合。
- 表示: has-photo カードは PC でテキスト左+写真右220px(3:2)、600px以下で
  写真が上・全幅(16:9)。写真もフェスページへのリンク。写真なしカードは
  flat構造のまま（後方互換）。
- LINEUP: 記事側の出演者入力が優先。空ならフェスの最新開催回LINEUPを表示
  （先頭10組+「ほか N 組」/ +N more）。JSON-LD performer は全組。
  フェス側を更新してPublishすれば再生成時にカードも追随する。
- ★article-fx.js: figure化ループが `.tj-event` 内のimgをスキップするガードを追加
  （無いとカード写真が誌面画像扱いでレイアウト崩壊）。
- 版: detail.css 35 / article-fx.js 9 / article-shortcodes.js 5 / cms.css 39 / cms.js 112。

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- 単体テスト39件成功（写真・cap・優先順位・後方互換）
- 本番相当実測: 1200px=写真が右/500px=写真が上、fxのfigure化なし、写真リンク先正、
  LINEUP表示10+「ほか 2 組」、写真なしカード構造不変。スクショ目視（PC/モバイル）
- CMSプレビュー: festivalData（画像+editions最新回lineup+artist名解決）を
  2経路に伝搬。実装済み・単体レベル確認
- `bash scripts/preflight.sh`: 全41件成功
- 認証済み本番CMSでの実操作: **実機未確認**

### 変更したパターン
- モジュール（render+API）/ ビルド（buildEventFestivalData+配線4箇所+JSON-LD）/
  fxガード1 / CSS 本番5+モバイル3+プレビュー同数 / cms.jsプレビューデータ組み立て+
  ヒント文言 / テスト8件 / docs

### 未確認の類似パターン
- lineupの名前解決はARTISTS登録済みIDのみ（未登録はACT_LABEL/生値のまま表示。仕様）
- フェス画像が無いフェスは写真なしの従来カードになる（仕様）

### 次の担当への注意・判断待ち
- article-fx の figure 化対象から `.tj-event` は除外済み。カード内に画像を
  足す拡張をするときもこのガードが前提。

## 2026-09-11 CMSプレビューのフェス写真404を修正（追記）

### 実施
- ユーザー報告: 本番表示プレビューで写真だけ壊れる（LINEUPは正常）。
- 実ブラウザ（Chrome拡張・本番CMS・実シートデータ）で調査し特定:
  シートの IMAGE 列に旧表記 `….jpg` が残っており（実ファイルはwebpのみ）、
  Publishは webp() 正規化するのにプレビューの buildArticleFestivalData は
  生値のまま使って404していた。about:blank子ウィンドウの相対URL解決や
  SW・CSPは実測で白（画像のnaturalWidth=675で正常ロードを確認）。
- 修正: buildArticleFestivalData で Publish と同じ webp() を通す（cms.js 1行+コメント）。
- 版: cms.js 113。

### コミット
- このエントリと同一コミット。

### 検証
- headless: シート値 .jpg 入力で右ペイン/本番表示とも src が .webp になることを確認。
- preflight 全41件成功。デプロイ後にユーザーのChrome実機で最終確認予定。

### 変更したパターン
- 画像src組み立て1箇所。

### 未確認の類似パターン
- シートIMAGEの .jpg 旧表記自体はデータとして残存（Publish正規化があるため実害なし。
  いつか一括で .webp 表記へ直すと混乱が減る）。

### 次の担当への注意・判断待ち
- シートの画像パスを表示に使うときは必ず webp() を通すこと（Publishと同じ規約）。

## 2026-09-11 本番表示ウィンドウでカーソルが消えるバグを修正（追記）

### 実施
- 原因: 本番ページは common.css の `cursor:none` + common.js のカスタムカーソル
  （dot/ring）の組。**本番表示ウィンドウは common.css は読むが common.js を
  読まない**ため、消したカーソルの代役が不在だった。
- 修正: openArticleGeneratedPreview の生成HTMLに、ネイティブカーソルを戻す
  <style>（* cursor:auto / リンク類は pointer）を追加。cms.js 114。

### コミット
- このエントリと同一コミット。

### 検証
- 生成HTMLをそのまま描画して computed style を実測: body=auto / a=pointer。
- check_cms_article_generated_preview の禁止パターン（見出し改行の上書きCSS）
  には該当しない。preflight 全41件成功。

### 変更したパターン
- 生成HTML内 style 1箇所。

### 未確認の類似パターン
- 右ペインプレビューはCMS自身のカーソル（通常表示）なので無関係。確認済み・0件。

### 次の担当への注意・判断待ち
- 本番表示に common.js を将来読み込む場合はこの style を外すこと。

## 2026-09-11 フェス詳細のLINEUP 2重表示を修正（前日実装の配線ミス）

### 実施
- ユーザー報告: フェス詳細（Re:birth）のLINE UPが全組2重（74組→148表示）。
- 真因: 前日の「イベントカード写真+LINEUP」実装で lineupsByEdition の行登録を
  早い位置のループへ集約した際、**既存ループ側の push が残り全行が2回登録**
  されていた（レビュー時、後方ループのpushがdiffのhunk外で見落とし）。
  データ（data.js / lineups.json）は74行で健全なことを実測確認済み。
- 修正: 後方ループの push を削除し、登録を1箇所に（再発防止コメント入り）。
  影響は全フェスページのLINEUP表示・JSON-LD performer・全N組ラベル。
- 再発防止: 新検査 scripts/check_festival_lineup_render.mjs（表示 slot 数 ==
  lineups.json 行数の厳密一致。JA/EN 48件）を preflight に追加（**42本目**）。
  既存の回帰しきい値 lineup_linked_acts は増加無制限で素通りした教訓。
  ミューテーションテスト（1件水増し→75vs74で失敗）で検知力を確認済み。

### コミット
- このエントリと同一コミット（修正+新検査+preflight+再生成484ページ）。

### 検証
- 再生成後: 全48セクションで表示=ソース一致、re-birth「全74組を表示」。
- 新検査は水増しに対して exit 1（ミューテーションで確認）。
- `bash scripts/preflight.sh`: 全42件成功。

### 変更したパターン
- push削除1箇所+警告コメント / 新検査1本 / preflight 1行

### 未確認の類似パターン
- lineups.json の nu-festival-2026 に同名3種の重複行あり（**データ由来**・
  シート側の実重複。今回の描画バグとは別物。CMSで整理推奨）
- EN フェスページの lineup slot 数が JA より大幅に少ない（既存挙動・今回は対象外）

### 次の担当への注意・判断待ち
- lineupsByEdition への登録は main() 冒頭の1ループのみ。増やさないこと。

## 2026-09-12 モバイル3件の修正（ハブ上余白 / newsタイトル改行 / カルーセル縦ぶれ）

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- ① festivals / artists / venues ハブの ≤900px `.page-header` 上padding 96→24px
  （sticky nav の二重取り。詳細ページの §先行修正と同じ理屈）。news.html には
  .page-header 無し（対象外・確認済み）。EN ハブはビルド生成・行数一致確認。
- ② news の一覧タイトル3種（feed/featured/side）に `overflow-wrap: anywhere`。
  英単語混在見出しがスペース折返しで右に大きく空くのを防ぐ（収まらない時だけ
  単語内で折る性質なので和文への影響なし）。
- ③ 関連フェスカルーセル: `.related-grid` は overflow-x:auto でも計算上
  overflow-y:auto になり、登場アニメの translateY(28px) で縦に18pxスクロール
  可能だった（実測 351>333px）→ 横スワイプが縦にぶれる。
  `overflow-y:hidden` + カルーセル内の reveal は transform:none（フェードのみ）。
- 版: detail.css 36 / cms.js 115。

### コミット
- このエントリと同一コミット（EN ハブ再生成含む）。

### 検証（headless実測）
- ① 390px: 3ハブとも nav下端→コンテンツ 32px（従来 ~128px）。1440px は 90px で不変。
- ② computed overflow-wrap: anywhere を確認。
- ③ grid の縦はみ出し解消（scrollHeight==clientHeight）、reveal中カードの
  transform none。横スクロールは維持。
- preflight 全42件成功。
- iPhone 実機での最終見た目: **実機未確認**（ユーザーに依頼）。

### 変更したパターン
- ハブ3ファイル各1行 / news 3行 / detail.css 2箇所 / 版追随4箇所

### 未確認の類似パターン
- index.html のヒーロー上余白は構造が異なるため対象外（要望もなし）
- 記事内の他の横スクロールUI（editions-timeline 等）に translateY reveal の
  同型問題が無いかは未調査（症状報告があれば同じ手当て）

### 次の担当への注意・判断待ち
- 横スクロール容器の中では translateY 系の登場アニメを使わないこと（縦ぶれの温床）。

## 2026-09-13 カレンダーの飛び先を「カード直上の見出し」に変更

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 課題: イベントカードを紹介文の下に置きたいが、カレンダーからカードへ飛ぶと
  紹介文を飛ばして着地してしまう。
- 決定: カレンダーのリンククリック時、対象カードから**上方向で最初の見出し
  （h2/h3/h4）**へスムーズスクロール。見出しが無ければ従来どおりカード。
  href（#ev-…）は不変＝JS無効時と共有URLの互換を維持。#ev-付き直接アクセスも
  同じ位置に補正。PCの固定navぶんの着地オフセットも考慮。
- 実装: article-fx.js（本番）+ cms.js bindArticlePreviewInteractions（プレビュー、
  ハイライトは従来どおりカード）。ARTICLE_FX_JS_VERSION 10 / cms.js 116。
- 検査: check_cms_layout.mjs にプレビューの見出し着地プローブを追加。
  枠高がコンテンツより高いと scrollTop が動けず誤検知になるため、検査中だけ
  枠を300pxに固定する前処理を入れた（レビューで検査自体の穴を修正）。

### コミット
- このエントリと同一コミット。

### 検証
- 本番相当フィクスチャ（見出しA/B+紹介文+カード×2+見出し無しカード）:
  クリックごとの狙い先を scrollMarginTop 付与で判定し、A→hA / B→hB /
  見出し無し→カード自身、hash更新も確認。
  ※headless は window の smooth/auto スクロール量が反映されない癖があり、
  スクロール実量はプレビュー側プローブ（scrollTop=441で一致）と、
  デプロイ後の実Chrome確認で担保。
- preflight 全42件成功。

### 変更したパターン
- article-fx に関数2+リスナ1+直アクセス補正 / cms.js プレビュー1箇所 /
  版追随3箇所 / 検査プローブ1+枠高固定の前処理

### 未確認の類似パターン
- 1見出しの下に複数カードの構成では、どのカードも同じ見出しに着地する
  （ユーザー承認済みの仕様。フェスごとに中見出しを付ける運用で解消できる）

### 次の担当への注意・判断待ち
- スクロール位置を検査するプローブは「枠がコンテンツより高いと動かない」。
  枠高の固定を忘れないこと（今回の誤検知の教訓）。

## 2026-09-13 アーティスト名寄せの精度向上（部分一致の自動変換を廃止）

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 報告: LINEUP入力で「Shohei Takata」が sho に、「YAMA」が Yamarchy に化ける。
- 真因: matchArtist の最終ルール「双方向部分一致（含む/含まれる）」。
  一括貼り付け・AI取得の経路で黙って自動変換していた（1件入力欄は明示式で無事）。
- 修正: 部分一致ルールを削除（完全一致 / ID一致 / slug一致のみ残す）。
  曖昧な名前は従来の ?未一致タグ＋候補ボタン＋新規登録の明示導線に乗る
  （§9-25「自動変換が公式表記30件を破壊」と同じ方針）。
  候補提示側（suggestArtistCandidates）の前方戦部分一致にも語境界条件を追加
  （「shohei takata」の候補に sho が出る雑音を除去。「YAMA」→Yamarchy の
  候補提示は維持＝クリックで明示採用）。
- 版: cms.js 117。

### コミット
- このエントリと同一コミット。

### 検証
- check_cms_lineup.mjs 15件成功（新規: Shohei Takata→null / YAMA→null /
  完全・slug一致維持 / 候補に sho が出ない / Yamarchy 候補は出る）
- headless CMS 実測（一括貼り付け「Shohei Takata, YAMA, DJ Nobu」）:
  dj-nobu のみ自動一致、他2つは ?タグ＋候補/新規登録ボタン。
- preflight 全42件成功。

### 変更したパターン
- matchArtist 1ルール削除 / suggestArtistCandidates 語境界2条件 / テスト6ケース

### 未確認の類似パターン
- 過去に部分一致で誤変換されて保存済みのLINEUPが残っている可能性
  （例: sho / yamarchy が本来別人の枠に入っている）。気づいたものは
  CMSで手修正を。機械的な洗い出しは「正解が分からない」ため未実施

### 次の担当への注意・判断待ち
- 名寄せの自動確定は完全一致系のみ。曖昧一致を自動化しないこと（3度目の教訓）。

## 2026-09-13 フェス検索の改善（入力継続 / 検索時は全期間 / 0件メッセージ）

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 報告①: 検索欄が1文字ごとにしか打てない。真因: buildFilters() が検索のたびに
  検索ボックスごと innerHTML で再生成しフォーカス喪失（IMEも破壊）。
  → 検索欄は初回のみ生成し、以後はプレースホルダとジャンル行だけ更新。
  入力中は value も触らない。
- 報告②: ALLで検索すると過去フェスが出ない。真因: 検索は過去にもヒットして
  件数に入るのに、applyMonthFilter の ALL が未来グループのみ表示（件数と画面の
  不一致）。→ **検索中のみ全期間表示**（未来→過去の既存ソート順）。
  非検索時の ALL=未来のみ・年タブの挙動は不変。
- 追加(C-2): 0件時に「該当するフェスが見つかりません — “語”」＋
  「条件をクリア」ボタン（検索/ジャンル/期間をリセットして復帰・検索欄へ
  フォーカス）。EN は実行時 lang 判定で NO RESULTS / CLEAR FILTERS
  （ハブJSはJA/EN同一の決まりに準拠）。

### コミット
- このエントリと同一コミット（ENハブ再生成含む）。

### 検証（headless実測・JA/EN両方）
- 5文字連続入力（各220ms・デバウンス跨ぎ）で同一要素・フォーカス維持・
  値が「rural」に積み上がる
- 「rural」（過去開催）検索で過去グループが表示され、件数表示
  「1 FESTIVALS」と可視カード1が一致
- 「zzzzzz」で0件メッセージ（ENは NO RESULTS）→ クリアで一覧復帰
- 行数 JA/EN 1491/1491 一致。preflight 全42件成功。

### 変更したパターン
- buildFilters の生成/更新分岐 / applyMonthFilter 先頭1分岐 /
  renderFestivals の空状態 / esc ヘルパー / CSS .fest-empty

### 未確認の類似パターン
- artists.html / venues.html / news.html の検索欄は各自の実装。同じ
  「入力欄ごと再生成」型かは未調査（症状報告なし。festivals と同型なら
  同じ手当てが可能）

### 次の担当への注意・判断待ち
- 検索欄・入力欄の類は innerHTML 再生成の外に置くこと（フォーカスとIMEの温床）。

## 2026-09-12 Publish が3段で止まった事故の復旧と、push競合の自動リトライ

### 実施
- 症状: ユーザーの Publish Now 後、CMS に赤いエラー（見張り番の失敗通知）。
  本番データが古いまま（main 360KB / live 333KB）。
- 3つの停止を順に解消（いずれもガードが正しく働いた結果。データ破損なし）:
  1. **concurrency 競合でキャンセル**: 17:40 の Deploy（検索改善の push）と
     17:41 の Publish が group:pages に並び、待機中の Publish pipeline が
     キャンセルされた（cancel-in-progress:false でも待機の入れ替えは起きる）。
     → 手動 workflow_dispatch で再実行。
  2. **画像の参照切れ**: `images/festivals/ultra-japan-flyer.webp` が未同期で
     broken_image_refs 1>0。→ Sync Drive Images を実行して取得（Drive には
     あり、同期の遅れだった。9/10 の asia-festival と同型）。
  3. **push 競合（non-fast-forward）**: 生成は成功したが、画像同期のコミットが
     先に入り最終 push が弾かれた。→ 再実行で成功。
- 復旧確認: 本番 data.js と main のハッシュ一致、見張り番 success、
  9月まとめ記事が公開（カード12枚・写真12・LINEUP11・FESTIVAL PAGEリンク12・
  カレンダー2ブロック・Event JSON-LD 12件を実測）。

### 再発防止（このコミットの変更）
- publish-pipeline.yml の生成物 push を**最大3回のリベース付きリトライ**に。
  `git pull --rebase --autostash origin main` を挟んで再試行し、3回失敗で
  ::error + exit 1（静かに成功と呼ばない）。実装=Codex。
  push競合は 9/09・9/12（2件）で計3回起きており、毎回見張り番が鳴いていた。
- deploy-pages.yml 側は**変更しない**（配信優先で warning 継続が正しい設計）。

### コミット
- このエントリと同一コミット（publish-pipeline.yml + handoff）。

### 検証
- YAML 構文 / 該当 run ブロックの bash -n / リトライ・rebase・exit の存在確認
- preflight 全42件成功
- **実際の競合時の挙動は未検証**（人為的な再現が困難。次に競合が起きたときの
  ログで「push が競合しました（試行 N）」の warning を確認する）

### 変更したパターン
- publish-pipeline.yml の push 1箇所（リトライ化）

### 未確認の類似パターン
- **concurrency キャンセル（原因1）の自動復旧は未実装**。ユーザーに確認して
  必要なら「キャンセルされた Publish pipeline を自動再実行する」仕組みを追加する。
  現状は見張り番が鳴いたら手動で再実行する運用
- 画像同期の遅れ（原因2）は2回目。CMS の「画像を今すぐ同期」を押してから
  Publish する運用で回避できるが、Publish 前に自動で同期を待つ仕組みは未実装

### 次の担当への注意・判断待ち
- 生成物を push するワークフローは裸の `git push` にしないこと（競合の温床）。

## 2026-09-13 同じ年に複数回の開催（EDITION）に対応

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 要望: 2026年に複数回開催するフェスに対応したい。
- 決定（ユーザー選択=連番方式）: 開催回の識別子（シートEDITION列 / CMSの
  editions[].year）を **`YYYY` または `YYYY-N`** の文字列にする。
  EDITION_ID={festivalId}-{EDITION} なので `circus-2026-2` となり
  **既存データと後方互換・シートの列追加不要**。表示は `2026 #2`。
- 共通ヘルパー `editionKeyParts()` / `editionLabel()` を**3箇所**に実装
  （LP/cms.js・scripts/build-detail-pages.mjs・scripts/db/export_site_festivals.mjs）。
  規則は同一、実行環境が違うため1本化していない（localizedValue と同じ方針）。
  片方だけ直さないこと。
- CMS: 入力欄を number→text（`2026-2` が打てなかった）、開催回セレクトと
  プレビューの表示を editionLabel、検証を `/^\d{4}(-\d+)?$/` に、
  **新ボタン「＋ 同じ年にもう1回」**（連番最大+1・会場等を引き継ぎ日程/LINEUPは空）。
- ビルド: 開催ヒストリー・ラインナップ節・JSON-LD subEvent 名を editionLabel に。
  並び順を (year, seq) の**数値**降順に（文字列比較では 2026-10 < 2026-2 になる）。
- ★**設計ミスをレビューで訂正**: data.js に出す識別子キーを最初 `edition` に
  したが、CMS の `editions[].edition` は既存の「第N回（通算回数）」で意味衝突。
  第N回の欄に識別子が入る実害があったため **`editionKey`** に改名して解消。
- 版: cms.js 118。

### コミット
- このエントリと同一コミット。

### 検証
- `node scripts/check_cms_editions.mjs`: **全23件成功**（新規: 識別子の分解・
  表示整形・同年2件が検証を通る・同一EDITION値の重複は弾く・addSameYearEdition
  の連番採番と引き継ぎ・buildFullDataJs が `editionKey` を出し `new Function` で
  評価できる）
- **疑似データで実ビルド**（circus に 2026-2 と 2026-10 を注入）:
  開催ヒストリー/ラインナップ節が `2026 #10 → 2026 #2 → 2026 → 2025` の順で
  正しく並び、JSON-LD subEvent 名も `CIRCUS ODAIBA 2026 #2` 等。**連番10以降でも
  順序が壊れない**ことを確認。疑似データは元に戻し、既存フェスの生成結果が
  現状と一致（回帰なし）することも確認
- sync-site の抽出（97件・最新回の日付）が正常
- preflight 全42件成功
- 認証済み本番CMSでの実操作: **実機未確認**

### 変更したパターン
- ヘルパー3箇所 / CMS: 入力欄・セレクト・プレビュー・検証・addEdition・
  createNextEdition・addSameYearEdition・最新回選択2箇所・data.js出力 /
  ビルド: 表示4箇所・JSON-LD 1・ソート2 / sync-site 1 / テスト6ケース /
  AGENTS.md・DATA_SCHEMA.md

### 未確認の類似パターン
- **headless の CMS UI プローブが renderEditions() を呼ぶと固まる**現象に遭遇
  （data-o が付かない。alert を潰しても再現）。今回は vm 方式の
  check_cms_editions.mjs と静的確認で代替した。FESTIVAL フォームを
  headless で触る検査を書くときは注意。原因は未調査
- LINEUPS の EDITION_ID は `festivalId-2026-2` 形式になるが、シート側の
  既存行には影響なし（新規回だけ）。CMS の LINEUP 同期は EDITION_ID 一致で
  動くため変更不要（テスト済み）

### 次の担当への注意・判断待ち
- `editions[].year` は**識別子文字列**（`2026` / `2026-2`）。数値として
  `Number()` しないこと。年が必要なら `editionKeyParts(v).year`。
- data.js の editions は `{ year: 2026, editionKey: "2026-2", … }`。
  `edition` キーは第N回（通算回数）で別物。

## 2026-09-13 LINEUP の一括クリアを追加

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 要望: 既存フェスを更新するとき、前回の出演者を1組ずつ消すのが手間。
- 実測: フェス共通 LINEUP（lineups.f / #f-lineupTags）はタグ形式で
  個別の × しか無かった。開催回（Editions）側は textarea だがボタンが無く不統一。
- 追加: `clearLineup(prefix)`（フェス共通）と `clearEditionLineup(i)`（開催回）。
  どちらも**件数を出して confirm** し、フォーム上の配列を空にするだけ
  （シートは保存を押すまで変わらない旨をダイアログに明記）。markFormDirty で
  未保存表示。0件のときは confirm を出さず info トーストのみ。
- UI: フェス共通は Bulk paste の隣に「🗑 全部クリア」、開催回は textarea の下に
  「🗑 この回のLINEUPを全部クリア」。
- 版: cms.js 119。

### コミット
- このエントリと同一コミット。

### 検証
- `node scripts/check_cms_lineup.mjs`: **全20件成功**（新規5ケース:
  3件→0件 / confirm=false では消えない / 0件では何もしない /
  開催回クリアが他の回に影響しない / markFormDirty が呼ばれる）
- 静的確認: 両ボタンの onclick が正しい関数を指す。renderEditions は
  selectedEditionIndex を範囲内に保つため**クリア後も選択中の開催回が維持**される。
- preflight 全42件成功
- 認証済み本番CMSでの実操作: **実機未確認**

### 変更したパターン
- 関数2新設 / cms.html 1ボタン / renderEditions 内 1ボタン / テスト5ケース

### 未確認の類似パターン
- ARTIST セクション等に他 prefix の LINEUP 入力は無い（確認済み・0件）
- 「元に戻す」は未実装。誤クリア時は保存せずにフェスを再選択（再読込）すれば
  シートの値に戻る

### 次の担当への注意・判断待ち
- なし。

## 2026-09-13 フェス詳細の「来訪目的」を測る計測を追加

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 目的: 「Festivalに来るユーザーは何が目的か（ラインナップ/開催情報/アクセス）」
  をデータで答えられるようにする。実測の前提:
  - Search Console: フェスページへの検索は「フェス名＋年」「会場名」が大多数。
    ラインナップ/チケット/アクセス語のクエリは上位に無い＝**着地後の行動でしか
    意図は測れない**
  - GA4(28日): フェス詳細の滞在 23〜30秒 / scroll(90%)到達 約18% /
    外部クリック 153回・88人。**総数は見えるが内訳が無い**
- 追加した計測（LP/common.js の既存 tjTrack ブロックに追記。新規ファイルなし）:
  - `festival_section_view`: LINEUP / 開催ヒストリー / FAQ / 関連フェス への
    到達を1ページ1回ずつ（section, festival_id, page_lang）
  - `festival_link_click`: ticket / official / social / lineup_artist /
    related_festival / share を**フェス単位**で（link_kind, festival_id,
    page_lang, link_target）
  - 既存 `outbound_click` は役割が違うため残置（重複送信は許容・コメント済み）
- COMMON_JS_VERSION 13→15（bump との整合で15に統一）。
- 新検査 `scripts/check_festival_tracking.mjs` を preflight に追加（**43本目**）。

### コミット
- このエントリと同一コミット（生成物522ページ含む）。

### 検証
- `node scripts/check_festival_tracking.mjs`: 成功（4セクションの到達・
  重複なし・festival_id 付与・official/related のクリック種別・
  **gtag 無し環境でコンソールエラーが出ない**）
- preflight 全43件成功

### レビューで見つけて直した2件（いずれも実装/検査の穴）
1. `threshold: 0.25` は「要素の25%が見えたら」の意味で、画面より高い
   LINEUPセクションでは**永久に発火しない**。`rootMargin: '0px 0px -25% 0px'`
   ＋ threshold 0 に変更。
2. 検査が `/__check.html` でページを配信していたため `location.pathname` が
   実ページと異なり festival_id が空になっていた。実パスで配信するよう修正。

### 変更したパターン
- common.js に計測ブロック1（IO 1 + click 1）/ 版定数1 / 新検査1本 / preflight 1行

### 未確認の類似パターン
- ★**headless Chrome では window.scrollTo が効かない（scrollY が 0 のまま）**。
  IO をスクロールで発火させる検査は書けないため、ページ全体が入る
  `--window-size=1280,4000` で可視判定を成立させている。
  **この癖は今回で3回目**（カレンダー着地・記事FXでも遭遇）。スクロール依存の
  検査を書くときは最初からビューポート拡大方式にすること。
- 実スクロールでの発火は本番の実ブラウザで未確認（デプロイ後にGA4のリアルタイムで
  確認する）
- アクセス（会場・地図）セクションは**まだページに存在しない**ため計測対象外。
  A-2（アクセス情報の追加）を実装するときに一緒に計測を足す

### 次の担当への注意・判断待ち
- GA4 側で `section` / `festival_id` / `link_kind` を**カスタムディメンションに
  登録**しないと、レポートで内訳を見られない（イベント数は見える）。
  未登録。登録するとその日以降のデータから使える。

## 2026-09-13 Publish が画像不足で止まる問題を自動解消（3回目の再発を機に）

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 症状（3回発生）: CMSで画像をアップ→すぐ Publish Now すると、画像がまだ
  リポジトリに無く（Driveにはある）検査で停止。
  9/10 asia-festival（broken_image_refs）/ 9/12 ultra-japan-flyer（同）/
  9/13 shifumiz（check_jsonld の image 3種）。毎回、手で画像同期→再実行して復旧。
- 構造上の原因: **画像の取得と派生生成は Sync Drive Images だけが行う**
  （cron 2時間おき＋手動）。Publish pipeline は既存画像を前提にビルド・検査する。
- 対策:
  - 新規 `scripts/check_missing_images.mjs`: data.js と editions.json が参照する
    `images/…` が実在するか照合（現在191件・不足0）。`--list` でパスのみ出力。
  - publish-pipeline.yml の **ビルド前**に「Ensure referenced images exist」を追加。
    不足時のみ `gh workflow run "Sync Drive Images"` → 新runを特定 → 完了待ち
    （起動2分＋完了10分の上限）→ `git pull --rebase` → 再チェック。
    同期しても足りなければ「Driveに無い/アップロード未完了」と明示して失敗。
  - ジョブの timeout-minutes を 20→32（待ち時間ぶんの余裕）。
  - preflight にも追加（**44本目**）。ローカルでも公開前に気づける。
- 既存の broken_image_refs / check_jsonld は**残置**（最後の砦として二重に守る）。

### コミット
- このエントリと同一コミット。

### 検証
- `node scripts/check_missing_images.mjs`: 191件・不足0で成功
- **ミューテーション**: data.js の画像パスを存在しない名前に差し替えると exit 1 と
  なり当該パスを列挙（確認後に復元）。`--list` はパスのみ出力
- YAML 構文 / 追加 run ブロックの `bash -n` / 起動・完了待ち・再チェックの存在確認
- preflight 全44件成功
- **実際の不足時の自動同期は未検証**（人為的な再現が困難。次に画像不足の
  Publish が起きたときのログで「Sync Drive Images を起動して待ちます」の
  warning と自動復旧を確認する）

### 変更したパターン
- 新検査1本 / publish-pipeline に1ステップ + timeout / preflight 1行

### 未確認の類似パターン
- 記事本文の Drive 直リンク画像（lh3.googleusercontent.com）は対象外
  （ローカル参照のみ照合）。直リンクは404でも検査は通る
- Sync Drive Images 自体が失敗した場合は conclusion を出力して続行し、
  再チェックで止まる（無限待ちにはならない）

### 次の担当への注意・判断待ち
- 画像を伴う公開の流れは「CMSでアップ → Publish」でよくなった（同期待ちは自動）。
  ただし Drive への保存自体が失敗している場合は自動では直らない。

## 2026-09-13 記事の配信面を強化（記事RSS / ニュースサイトマップ / 関連記事）

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 背景: 記事が月4〜6本ペースに到達（8月5本・9月13日時点4本）。8/24に決めた
  「テーマ2」の着手条件を満たしたため実施。
- ①記事専用RSS `LP/articles.xml`（generate-rss.py が追加出力。既存rss.xml不変）:
  published記事のみ・新しい順・最大20本・category付き。
- ②Googleニュース用サイトマップ `LP/sitemap-news.xml`（generate-sitemap.py が
  追加出力）: **過去48時間以内**の記事のみ（News仕様）。0本でも空urlsetを出す。
  robots.txt に Sitemap 行を追加。**ワークフローは無変更**（既存スクリプトが
  追加出力する設計にしたため）。
- ③記事末尾に RELATED STORIES: 選出は 同festivalId→同category→最新
  （自分除外・最大3件・published のみ）。JA/EN全20ページに出た。
- ★レビューで発見・修正: 最初の実装は related-card グリッドを使ったが、
  そのCSSは**全て `.festival-design-v2` スコープ内**で記事には一切当たって
  いなかった（カード縦積み・画像全幅）。既存のスコープ無し部品
  `related-story-card`（フェス詳細v2のRELATED STORIESで使用実績）に差し替え、
  生成コードは `relatedStoryCardsHtml()` として**共通関数に切り出して
  フェス詳細と記事の両方から使う**形にした。CSS追加ゼロ。
- 検査 `scripts/check_feeds.mjs` 新設 → preflight **45本目**。

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- articles.xml: 10件・全リンクが/articles/・最新記事(shifumiz)先頭
- sitemap-news.xml: 48時間以内=shifumiz 1件のみ（期待どおり）・news:形式
- 関連記事: JA/EN全20ページ・自分自身なし・リンク実在・選出順を目視確認
  （shifumiz→rebirth/forest/snow=同カテゴリ新しい順）
- headless実測: 500px/1280px ともサムネ横並び（flex, サムネ88/120px）で
  フェス詳細のRELATED STORIESと同一の見た目。リファクタ後のフェス詳細側も不変
- check_feeds.mjs 全成功 / preflight 全45件成功
- Search Console へのサイトマップ登録: この後ブラウザで実施予定

### 変更したパターン
- generate-rss.py 追加出力1 / generate-sitemap.py 追加出力1 / robots.txt 1行 /
  build-detail-pages.mjs（共通関数化1・記事テンプレ1箇所）/ 新検査1 / preflight 1行

### 未確認の類似パターン
- ★既存問題を発見（今回のスコープ外・未修正）: 記事ページは**1280px幅で
  本文の全幅画像が右に26pxはみ出す**（scrollWidth 1403 > 1280、犯人は
  class無しIMG right=1306）。関連記事の有無と無関係に発生することを
  除去版との比較で確認済み。fx-bleed の 100vw まわりが疑わしい。
  横スクロールバーが出る実害があるため、いずれ調査する価値あり
- EN記事の関連カードのタイトルは title_en 未入力のため JA のまま
  （フォールバック仕様どおり。title_en を入れれば自動で英語化）

### 次の担当への注意・判断待ち
- sitemap-news.xml は「48時間以内の記事が無いと空」になる。空でも正常。
- Google News への掲載は2024年以降**申請制ではなく自動選定**。
  Publisher Center 登録は任意（ブランド管理用）。

## 2026-09-14 記事タイトルのマークダウン残骸を表示側でも落とす

### 実施（設計=Claude / 実装=Codex / 検証=Claude）
- 発見: `transcendence-2025-report` の `title_en` が `# The Potential of…` と
  **先頭に見出し記号が残り**、EN版の `<title>` / `og:title` / 関連記事カードに
  そのまま出ていた（実測）。data.js 全記事を走査した結果、**この1件のみ**。
- 原因: CMS の `stripMarkdownDecorations_`（LP/cms.js 6251）は `#` を落とすが、
  この記事は**そのガード導入前に AI 翻訳された**ためデータに残骸が残っている。
- 対応: 表示側にも同じ規則の `stripTitleMarkdown()` を追加（build-detail-pages.mjs）
  し、記事の title / excerpt（JA/EN）と関連記事カードに適用。
  generate-rss.py にも同規則を追加。**本文（body）には適用しない**（HTML のため）。
- 検査を check_feeds.mjs に追加（JA/EN 全記事の `<title>`・`og:title` と
  articles.xml のタイトル/説明文に記号が残っていないこと）。

### コミット
- このエントリと同一コミット。

### 検証
- ビルド後、EN版 transcendence の `<title>`/`og:title` から `# ` が消えた
- 差分は当該記事と、その記事を関連記事に出している post-20251120 の**2ファイルのみ**
  （他記事のタイトルは不変＝回帰なし）
- **ミューテーション**: 生成HTMLの `<title>` を `## …` に書き換えると検査が
  検出して失敗（確認後に復元）
- preflight 全45件成功

### 変更したパターン
- build-detail-pages.mjs に関数1・適用2箇所 / generate-rss.py に同規則1 /
  check_feeds.mjs に検査1

### 未確認の類似パターン
- **シート側のデータは未修正**（`title_en` に `# ` が残ったまま）。表示は
  ガードで正しくなるが、CMS の編集画面では記号が見える。運用側で削除が必要
- フェス/アーティスト/会場の DESC・BIO は未走査（記事のみ対応）

### 次の担当への注意・判断待ち
- Search Console 実測（9/13）: 記事は**全て既にインデックス登録済み**だった。
  表示ゼロの記事は「未登録」ではなく「競合に勝てていない」状態。
  インデックス登録リクエストは不要と判明。

## 2026-09-14 記事本文のアーティスト自動リンク／更新日の受け皿

### 実施（設計=Claude / 実装=Codex / 検証=Claude）

#### ① アーティスト名の自動リンク
- 背景: 記事→ARTISTS のリンクが**全記事0本**だった。`[[artist:id]]` の
  entity shortcode は既にあるが一度も使われていない。
- 実装: build-detail-pages.mjs で本文（body / body_en）のアーティスト名を
  検出し `entity-link` に変換。**HTMLを線形スキャンでタグ/ショートコード/
  テキストに分割し、テキスト片だけを置換**（正規表現で全体置換しない）。
- リンクする条件: ARTISTS の name と単語境界つき一致 / 3文字以上 /
  大小文字は無視するが**本文の表記を保つ** / 記事内で各1回 / 除外リスト外。
- 除外する場所: `<a>`内・`<h1>〜<h6>`内・**`[[…]]`ショートコード内**・
  タグ属性・`<code>`/`<pre>`内。
- ★**誤爆を実測してから設計した**: アーティスト名 `Ground` が
  `[[event|…|Kodamanomori Camping Ground, Nagano|…]]` という**会場名**に
  マッチした。`AUTOLINK_DENY`（理由コメント付き）に登録し、
  ショートコード内除外と二重に防いでいる。
- 結果: **16件**を自動リンク（rebirth 6 / japan-september 3 / transcendence 2 /
  shifumiz 2 / snow-machine 1 / forest 1 / asia 1）。

#### ② 更新日（dateModified）の受け皿
- CMS の ARTICLE に「UPDATED（更新日）」欄（`ar-updatedAt`）を追加し、
  保存 payload とフォーム復元に接続。
- ビルド側は `updatedAt || date` を JSON-LD の dateModified に使い、
  `date` と異なるときだけ記事に「更新: YYYY.MM.DD」を表示（detail.css に1行追加）。
- sitemap.xml の記事 `<lastmod>` も `updatedAt` があればそれを使う。
- **シートに UPDATED_AT 列が無くても動く**（無ければ従来どおり公開日）。
- 版: cms.js 120 / detail.css 37。

#### ③ 検査 scripts/check_article_links.mjs（新規・preflight 46本目）
リンク先の実在 / `<a>`入れ子なし / ショートコード内にリンク無し（Ground 再発検知）/
見出し内にリンク無し / 記事別リンク件数の一覧出力 / dateModified の整合。

### コミット
- このエントリと同一コミット（生成物 506ページ含む）。

### 検証
- 自動リンク16件すべてリンク先が実在。**"Ground" は0件（誤爆なし）**、
  会場名 `Camping Ground, Nagano` は無傷
- asia-festival で7件中1件のみリンクされた理由を個別確認 →
  3件はイベントカードの出演者欄（除外が正しい）、3件は本文に無し（表記違い）
- **本文テキスト（タグ除去後）がリンク挿入前と完全一致**＝文章は1文字も変えていない
- updatedAt 未設定の現状で dateModified は datePublished と同値（回帰なし）
- preflight 全46件成功

### 変更したパターン
- build-detail-pages.mjs（自動リンク関数1・適用2・dateModified・更新日表示）/
  cms.html 1欄 / cms.js 6箇所 / detail.css 1行 / generate-sitemap.py 1 /
  新検査1 / preflight 1行

### 未確認の類似パターン
- ★**CMS のブラウザ自動操作では保存できなかった**（2026-09-14 実測）。
  DOM に値を入れて `Save to Spreadsheet` / `Save Changes` を押しても
  シートは更新されない（GAS の get_sheet で確認: title は旧値のまま・
  重複行なし・データは無傷）。CMS 内部の編集状態への反映経路が別にあるため。
  **CMS のデータ変更は人手で行うこと。**
- シートの `title_en` に `# ` は**元々入っていない**（GAS で直接確認）。
  9/13 の handoff「シート側は未修正」は**誤り**。data.js が古かっただけで、
  次の Publish で解消する（表示側ガードは保険として有効）

### 次の担当への注意・判断待ち
- **運用側の作業2件**:
  1. スプレッドシート ARTICLES に `UPDATED_AT` 列を追加すると更新日が使える
  2. Transcendence 記事のタイトルを下記に変更（検索結果で切れないため）
     - JA: `Transcendence 長野・北相木村の森が生んだ次世代レイヴ`
     - EN: `Transcendence: Next-Generation Rave in a Nagano Forest`
- 自動リンクは**アーティストのみ**。フェス/会場は既存ショートコードのまま。

## 2026-09-14 UPDATED_AT のキー名不一致を修正（昨日の実装が値を読めていなかった）

### 実施（設計・検証=Claude / 実装=Codex）
- 依頼「UPDATED_AT 列を追加したい」を受けて実シートを確認したところ、
  **列は既に存在していた**（ARTICLES の AB列 `UPDATED_AT`）。追加は不要だった。
- ★**実装のバグを発見**: AB2 に実際の日付を入れて GAS の `get_sheet` を叩くと、
  返るキーは **`updated_at`**（小文字・アンダースコア）で、
  前日の実装が読む `row.updatedAt` は **undefined** だった。
  シートに入力しても CMS にも data.js にも反映されない状態。
  - GAS は列名を小文字化して返す。LASTEDITEDAT / METADESCRIPTION / READTIME 等は
    camelCase 版も併せて返るが、それは GAS 側の既知リストによるもので
    **UPDATED_AT は対象外**。
- 修正（LP/cms.js のみ）: シート由来の値を読む箇所を
  `row.updated_at || row.updatedAt` に。保存 payload は両方のキーを送る
  （GAS がどちらで列に書くか未検証のため）。data.js の中は `updatedAt` に統一。
- 版: cms.js 121。

### コミット
- このエントリと同一コミット。

### 検証
- **エンドツーエンド（本番に出さずローカルで）**: data.js に
  `updatedAt: "2026-09-14"` を注入してビルド →
  - JSON-LD `dateModified: 2026-09-14T00:00:00+09:00`（datePublished 2025-06-20 と別）
  - 記事表示「更新: 2026.09.14」/ EN「Updated: 2026.09.14」
  - sitemap.xml `<lastmod>2026-09-14</lastmod>`
  すべて期待どおり。注入を戻すと表示も消える（回帰なし）
- `fmtDate` はローカル時刻ベースで**1日ずれない**ことを実データ形式
  （`Mon Sep 14 2026 00:00:00 GMT+0900`）で確認
- **シートに入れたテスト値は削除済み**（GAS で消えたことを確認・記事10件・
  タイトル無傷）
- preflight 全46件成功

### 変更したパターン
- cms.js のシート読み取り2箇所・保存 payload 3箇所・data.js 出力1箇所 /
  check_article_links.mjs に再発検知を追加

### 未確認の類似パターン
- ★**GAS が payload のどのキーを UPDATED_AT 列に書くかは未検証**。
  `updatedAt` と `updated_at` の両方を送ることで対処しているが、
  **CMS から実際に保存して列に入るかは実機未確認**（自動操作では保存できないため）。
  初回利用時に確認が必要
- 他シート（FESTIVALS 等）にアンダースコア入りの新規列を足す場合、
  同じキー名不一致が起きる。**列を足したら必ず get_sheet で返るキー名を確認する**

### 次の担当への注意・判断待ち
- 運用: 記事を書き直したとき CMS の「UPDATED（更新日）」に日付を入れると、
  Google に渡す更新日・サイトマップ・記事表示に反映される。空なら公開日のまま。
- Transcendence のタイトル変更は**ユーザー判断で見送り**（2026-09-14）。

## 2026-09-14 記事タイトルの固有名詞が改行で分断される問題を修正

### 実施（設計・検証=Claude / 実装=Codex）
- 症状（スクショ報告）: NEWS で「香港の谷で16時間踊り続ける **Shi Fu Miz** が…」が
  `Shi Fu` / `Miz` に割れていた。
- 原因: タイトルは `overflow-wrap: anywhere` を持つが、**単語間スペースでの
  改行は通常どおり起きる**ため、英字の固有名詞がスペース位置で割れる。
- **headless で幅 290→420px をスイープして帯を特定**:
  | 幅 | 現状 | 修正後 |
  |---|---|---|
  | 290–330px | 3行・分断なし | 3行・分断なし |
  | **340–400px** | **2行・★分断** | 2〜3行・分断なし |
  | 410px以上 | 2行・分断なし | 2行・分断なし |
  ユーザーの実機（390px 相当）はこの帯に該当。修正後は**2行のまま分断のみ解消**。
- 実装: `LP/localize.js` に `tjNoBreakNames()` を追加し、記事タイトルを描画する
  3箇所（news.html 2 / index.html 1）で使用。`.tj-nobr { white-space: nowrap }`
  を common.css に1行追加。版: common.css 29 / localize.js 9。

### ★レビューで発見・修正した3件（初版の実装にあった不具合）
1. **【重大】`&` が壊れて画面に「&amp;」と表示された**（EN版3件）。
   原因は**先に全体をエスケープしてから span を挿し込んだ**ため、
   `&amp;` の途中で単語が切れ `<span>amp; Raves</span>` が生成されたこと。
   → **エスケープを「部分ごと」に行う**方式へ作り直した
   （マッチ前／マッチ部分をそれぞれエスケープして積む）。
   **教訓: エスケープとマークアップ挿入の順序を逆にするとエンティティが壊れる。**
2. 英文タイトルで普通の英語が塊化され改行が不自然になった
   （「Dance Till Dawn in」「and a Half Years」）→ **日本語を含むタイトルのみ**対象に。
3. 「LOA 8月15日」の「LOA 8」と数字を巻き込んだ → 直後が月日年時分なら数字を含めない。

### コミット
- このエントリと同一コミット（生成物522ページ含む）。

### 検証
- 幅スイープ 290–420px で**全幅とも分断なし・横溢れなし**
- JA: `Shi Fu Miz` / `FOREST SOUND CAMP` / `Snow Machine 2027` / `BON DISCO` /
  `nalu beach` / `LOA` が正しく塊化（`LOA 8` ではない）
- `&` を含む記事（音楽フェスティバル&レイヴまとめ）が JA/EN とも**正常表示**
- EN ハブは素通り（不要な塊化なし）
- JA/EN ハブの行数一致（news 1366 / index 1187）
- preflight 全46件成功

### 変更したパターン
- localize.js に関数1 / common.css 1行 / タイトル描画3箇所 / 版定数2

### 未確認の類似パターン
- フェス名・アーティスト名・会場名の見出し（カード・詳細ページ）は**未対応**。
  同じ分断が起きうる（例: 会場名やフェス名に英字が多い）。必要なら
  同じ `tjNoBreakNames` を適用できる
- 記事詳細ページ（静的生成側）のタイトル `<h1>` も未対応

### 次の担当への注意・判断待ち
- `tjNoBreakNames` は **innerHTML に入る前提**。使う場合は必ずこの関数を通し、
  別途 esc() を重ねない（二重エスケープになる）。

## 2026-09-14 記事ページのPC幅での横はみ出しを修正／他見出しの分断は「問題なし」を実測

### 実施（設計・実装・検証=Claude ※CSS1行のため直接編集）

#### 不具合A: PC幅(1280px)で記事が右に123pxはみ出す → **修正**
- 9/13 に発見して未修正だったもの。原因を特定した:
  - 画像ペア `.fx-image-pair` の中に `fx-full`（全幅指定）の画像があると、
    figure の幅は `.fx-image-pair figure.fx-img { width:100%!important }` で
    **445px に上書きされる**が、`fx-full` 用のキャプション余白
    `padding: 0 max(24px, calc(min(50vw,600px) - 50%))` は上書きされないため、
    50% が 222px になり **padding が 377px** に膨張。
    caption の右端が 1403px まで伸びていた（実測）。
- 修正: `.fx-image-pair figure.fx-img .fx-fig { padding: 0 !important; }` を
  article-fx.css に1行追加（理由コメント付き）。ARTICLE_FX_CSS_VERSION 11→12。
- 結果: shifumiz 記事 **scrollWidth 1403 → 1280（はみ出し 0px）**。
  他の記事・フェス詳細も 0px のまま（回帰なし）。

#### 不具合B: フェス/アーティスト/会場の見出しでも英字が分断されるのでは → **存在しなかった**
- 前回 handoff に「未確認の類似パターン」と書いたが、実測した結果:
  | ページ | 見出し数 | 分断 |
  |---|---|---|
  | 記事詳細 h1 | 1 | 0件 |
  | artists.html | 122 | 0件 |
  | venues.html | 22 | 0件 |
  | festivals.html | 1 | 1件 → **`FESTIVAL<br>GUIDE '26` の意図的な改行**（誤検知） |
- **対応不要**。tjNoBreakNames をこれらに広げる必要はない。

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- 3ページ（記事2・フェス1）で横はみ出し 0px を確認
- 見出しの分断を4ページ・146件で走査し、実質0件
- preflight 全46件成功

### 変更したパターン
- article-fx.css 1行 / ARTICLE_FX_CSS_VERSION 1

### 未確認の類似パターン
- `.fx-image-pair` と組み合わせる他の指定（fx-right / fx-left / fx-compact）でも
  同種の「余白計算式が取り残される」問題が起きうる。今回は `.fx-fig` の padding を
  ペア内で一律 0 にしたため、pair 内では全パターンで解消している
- モバイル幅（〜900px）は `@media (min-width:900px)` の外なので元から影響なし

### 次の担当への注意・判断待ち
- なし。

## 2026-09-14 フェスに国コードを持たせ、Airtable 同期の「JP固定」を廃止

### 背景（ユーザーの質問から発覚した将来バグ）
- 「Airtable を先に編集したらおかしくなる？」→ 調査の結果、
  **毎日 日本時間5:30 に sync-site が --execute で走り、サイトの値で
  Airtable を上書き**している（日程・都市・URL・名前・brand_status）。
  Airtable 側の編集は翌朝消える。
- さらに深刻な発見: `cmd_sync_site` が **`country` を "JP" 固定**で書いており、
  かつ `export_site_festivals.mjs` は**全フェスを無条件に出力**、
  サイトのデータには**国を示す項目が無い**。
  → **海外フェスをサイトに載せると Airtable 上で日本のフェスに化け、
    site_managed=true が付いて AI 巡回からも外れる**。
- ユーザー判断: A案（COUNTRY をデータに持たせる）。

### 実施（設計・検証=Claude / 実装=Codex）
- 規約: `COUNTRY` = **ISO 3166-1 alpha-2 の2文字大文字**（JP / TH / KR …）。
  **空欄は「不明」**で、Airtable の country を**上書きしない**。
- cms.js: 読み取り（`row.country || row.COUNTRY`）/ 保存 payload（両キー送信）/
  data.js 出力（値があるときだけ）。cms.html に Country 入力欄（City の隣）。
- export_site_festivals.mjs: `country` を出力に追加。
- **airtable_pipeline.py: `"country": "JP"` の固定を削除**し、
  入力の country があるときだけ送る形に変更（理由コメント付き）。
- 新検査 `scripts/check_country.mjs` → preflight **47本目**。
- AGENTS.md / docs/DATA_SCHEMA.md に規約を追記。
- 版: cms.js 122。

### コミット
- このエントリと同一コミット。

### 検証
- **ミューテーション**: data.js に `country: "jp"`（小文字）を注入すると
  検査が `❌ mutek: country="jp"` で検出。`"JP"` なら通過（確認後に復元）
- export の実測: circus に JP を入れた状態で
  `{'festival_id':'circus','city':'Tokyo','country':'JP'}` /
  未設定の mutek は `country: ''`（＝同期時に送られない）
- `"country": "JP"` の固定値が**0件**であることを静的検査で確認（再発防止）
- preflight 全47件成功
- **Airtable への実同期は未実行**（次回の日次 cron か、dry-run での確認を推奨）

### 変更したパターン
- cms.js 3箇所 / cms.html 1欄 / export 1項目 / airtable_pipeline.py 1箇所 /
  新検査1 / preflight 1行 / ドキュメント2

### 未確認の類似パターン
- ★**スプレッドシート FESTIVALS の `COUNTRY` 列はまだ存在しない**（AE列に追加予定）。
  列が無い間は country が常に空になり、**Airtable の country は更新されない**
  （＝現状維持で安全）。列追加後に既存96件へ `JP` を入れる必要がある
- GAS が `COUNTRY` をどのキーで返すか未検証（`country` の想定。
  UPDATED_AT は `updated_at` だった）。読み取りは両対応済み
- **ブラウザ自動操作でのスプレッドシート書き込みは権限で拒否される**（実測）。
  シートの変更は人手で行うこと

### 次の担当への注意・判断待ち
- **運用側の作業**: FESTIVALS シートの **AE1 に `COUNTRY`**、
  **AE2:AE97 に `JP`** を入力（最終列は AD=location_ja のため AE が空き）。
  以後、海外フェスを追加するときは `TH` 等を入れる。
- 表示（カードや詳細ページに国を出す）は未実装。必要なら別タスク。

## 2026-09-15 「+ Add Edition」で作られる年を押す前に見せる／確認を追加

### 実施（設計・検証=Claude / 実装=Codex）
- ユーザー相談: 「2025→2026 に更新するとき Add Edition を押すと **2027** が出る。
  正しい挙動？」
- 調査結果: **正しい挙動**。`addEdition` は「既存の最大年+1」を提案する設計
  （同じ FESTIVAL_ID-YYYY の二重登録を防ぐため）。2027 が出る＝そのフェスに
  **既に 2026 がある**。実データ: 2026 を持つフェス **55件** / 2025 のみ **35件**。
- ただし UI に問題があった:
  | ボタン | 確認ダイアログ | 作られる年の表示 |
  |---|---|---|
  | 次回開催を作成 | あり | 確認文に出る |
  | ＋ 同じ年にもう1回 | あり | 確認文に出る |
  | **+ Add Edition** | **なし** | **なし（押すまで不明）** |
- 対応:
  - `nextEditionYear()` を切り出し（年の決め方は**変えない**）
  - ボタンを **`+ 開催回を追加（2027）`** と動的ラベルに（cms.html に
    `id="f-add-edition-btn"` を付与し、renderEditions で更新）
  - `addEdition` に確認ダイアログを追加。文面に
    「既にある開催回を直したいときは、上の『開催回』の選択欄から選んでください」を明記
- 版: cms.js 123。

### コミット
- このエントリと同一コミット。

### 検証
- `node scripts/check_cms_editions.mjs`: **全28件通過**（新規: 1件→2026 /
  2件→2027 / 同年連番→2027 / 空→今年 / 確認キャンセルで追加されない）
- ラベル更新が **早期 return の前**にあり、開催回0件の経路でも更新されることを確認
- preflight 全47件成功
- 認証済み本番CMSでの実操作: **実機未確認**（headless で renderEditions を
  呼ぶと固まる既知の現象のため、静的確認と vm テストで代替）

### 変更したパターン
- cms.js 関数1新設・addEdition 2箇所・renderEditions 1箇所 / cms.html 1ボタン /
  テスト6ケース

### 未確認の類似パターン
- 既存の「この回を削除」（removeEdition）は**確認なし**で消える。
  保存前ならシートに影響しないため今回は変更しなかったが、
  誤操作の余地はある（入力済みの開催回を消すと入力が失われる）

### 次の担当への注意・判断待ち
- 運用: 既存の開催回を編集したいときは **Add Edition を押さず**、
  開催回の選択欄から選んで編集 → 保存。

### 追記（同日）: 日をまたぐと sitemap-news.xml の検査が落ちる
- 上記コミットの push 時に pre-push の preflight が
  `❌ sitemap-news.xml に48時間外または非公開記事: shifumiz-2026-info` で停止。
- 原因: **sitemap-news.xml は「過去48時間の記事」だけを載せる仕様**（Google News）。
  9/13 公開の記事は 9/15 になった時点で対象外になるが、**生成物は
  9/14 時点のまま**だったため不一致になった。
- 対処: `python3 scripts/generate-sitemap.py` を再実行（0件になり検査通過）。
- **次の担当へ**: 日をまたいで作業を再開したとき、または push が
  この検査で落ちたときは、**sitemap と rss を再生成**してから push する。
  ビルド（build-detail-pages.mjs）だけでは更新されない。

## 2026-09-15 記事タイトルのカタカナ語が途中で割れる問題を修正

### 実施（設計・検証=Claude / 実装=Codex）
- 症状（スクショ報告）: 「日本の音楽**フェスティ / バル**&レイヴまとめ」と
  カタカナ語が割れる。9/14 の `tjNoBreakNames` は**英字だけ**が対象だった。
- **3案を実測比較**（幅320/360/400px）:
  | 案 | 結果 |
  |---|---|
  | A 現状 | 全幅で★カナ割れ |
  | B `overflow-wrap: anywhere` を外す | **効果なし**（CJK は指定に関わらず任意位置で折れる） |
  | **C カタカナ連続を nowrap** | **全幅で解消・溢れなし**。400px では2行のまま |
- 実装: `tjNoBreakNames` の正規表現に**カタカナ連続（2〜12文字、`ァ`–`ヺ` と `ー`）**を
  選択肢として追加。12文字超は横溢れを避けて対象外。中点 `・` は含めない
  （「長野・木曽」のような区切りで折れるのは自然なため）。
- 版: localize.js 10。

### 設計上の注意（前回の事故を踏襲して回避）
- エスケープは**部分ごと**（全体を先にエスケープすると `&amp;` が壊れる。9/14 に発生）
- 英字とカタカナは**1つの正規表現の選択肢**として扱う
  （2段階置換だと1段目が挿入した span の中身に2段目がマッチしてタグを壊す）

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- 幅 280–420px スイープ: **全幅でカナ割れ0・溢れなし**。
  340px 以上は2行（スクショ相当の400pxでも**2行のまま**）、320px以下は3行
- 全タイトルの保護状況を実測:
  `フェスティバル` `レイヴ` `ギャザリング` `アニバーサリー` `キャンプ` `ステージ`
  `アジア` と、英字の `Shi Fu Miz` `FOREST SOUND CAMP` `Snow Machine 2027` が**併存**
- `&` を含むタイトルが JA/EN とも正常表示（**前回の事故の再発なし**）
- EN ハブは素通り（英文タイトルに不要な塊化なし）
- preflight 全47件成功

### 変更したパターン
- localize.js の正規表現1（英字＋カタカナの選択肢）/ 検査に5ケース追加

### 未確認の類似パターン
- ひらがな・漢字の連続は**対象外**（「木曽 / の森」のような位置で折れるが、
  日本語として自然なため意図的に触っていない）
- 12文字を超えるカタカナ語（例:「インターナショナル〜」）は保護されない。
  溢れを避けるための意図的な上限
- フェス名・アーティスト名・会場名の見出しは対象外（記事タイトルのみ）

### 次の担当への注意・判断待ち
- なし。

## 2026-09-15 フェス削除で開催回が消え残り Publish が止まる不具合を修正

### 発生した事故
- ユーザーが CMS でフェス2件（`yagura` / `music-camp-core`）を削除。
- `executeDelete` は **FESTIVALS の1行を消すだけ**で EDITIONS / LINEUPS に触らないため、
  孤児の開催回が残り、次の Publish が
  `✗ EDITIONS yagura-2026: FESTIVAL_ID参照切れ` で**停止**した。
- 影響: data.js 自体は本番に出ていた（フェス95件）。止まったのは詳細ページの
  再生成とサイトマップ更新。
- 復旧: EDITIONS 行100（yagura-2026）→ 行62（music-camp-core-2025）の順に
  **運用側が手動削除**（ブラウザ自動操作での削除は権限で拒否される）。
  削除内容は `reports/deleted_editions_2026-09-15.json` にバックアップ済み。

### 実施（設計・検証=Claude / 実装=Codex）
- `collectFestivalChildren_(festivalId)` を新設し、削除前に EDITIONS/LINEUPS の
  関連行を集める。
- 確認ダイアログに件数を表示:
  「"YAGURA" を削除します。**開催回 2件 と 出演者 45件 も一緒に削除されます**。」
- **削除順を 子→親、同一シート内は行番号の降順**に
  （小さい行から消すと後続の行番号がずれ、別の行を消す事故になる）。
- **EDITIONS を読み込めていないときは削除させない**（`editionSheetLoaded` を確認）。
  今回と同じ取りこぼしを防ぐ。
- 途中で失敗したら**そこで中断**し、どこまで消したかを知らせる。
- Trash には子データも保存（復元処理の改修は今回はしない）。
- 新検査 `scripts/check_cms_delete.mjs` → preflight **48本目**。
- 版: cms.js 124。

### コミット
- このエントリと同一コミット。

### 検証
- `node scripts/check_cms_delete.mjs` 全項目成功。特に**削除順序**を実測:
  `LINEUPS 31→30→28 / EDITIONS 22→20 / FESTIVALS 5`（子→親・各シート降順）
- 他フェスの行を巻き込まない / 未読み込み時は開かない / 途中失敗で中断 /
  関連0件は従来どおり親1回だけ
- `npm run fetch` 後に参照切れ**0件**（開催回114・フェス95）
- preflight 全48件成功
- 認証済み本番CMSでの実削除: **実機未確認**（実データを壊せないため vm テストで代替）

### 変更したパターン
- cms.js（関数1新設・confirmDelete・executeDelete）/ 新検査1 / preflight 1行

### 未確認の類似パターン
- ★**VENUE / ARTIST の削除も同じ構造の問題を持つ**。
  会場を削除すると FESTIVALS の `venueId` が、アーティストを削除すると
  LINEUPS の `ARTIST_ID` が参照切れになりうる。**今回は未対応**
- Trash からの復元はフェス本体のみ（子データは保存するが戻さない）

### 次の担当への注意・判断待ち
- 新しい記事を追加した直後は、**画像の派生生成**（`python3 scripts/build-image-derivatives.py`）
  が必要なことがある。今回 otsukimi-2026-info で構造化データ検査が落ちた。

## 2026-09-15 監査: 関連記事サムネが原寸画像を読んでいた（記事ページの43%が無駄）

### 実施（設計・実装・検証=Claude ※既存ヘルパー流用の小修正）
- 定期監査の実測で発見。**9/14 に私が実装した `relatedStoryCardsHtml` が
  srcset を使わず原寸画像を読んでいた**。
- 実測（記事 shifumiz、モバイル幅500px）:
  | サムネ | 表示 | 読み込み | 過剰倍率 |
  |---|---|---|---|
  | otsukimi | 88px | **1280px / 364KB** | 7.3倍 |
  | forest-sound-camp | 88px | 720px / 291KB | 4.1倍 |
  | rebirth | 88px | **1920px / 260KB** | 10.9倍 |
  → **88px 枠のサムネ3枚で 915KB**。
- 修正: `storyThumbSrcsetAttr`（sizes: `(max-width:640px) 88px, 120px`）を新設し、
  `cardImagePath` + srcset + `decoding="async"` に。sizes は detail.css の
  `.related-story-thumb`（120px / 640px以下は88px）と揃えた。
- 結果: **記事ページ 1,832KB → 1,043KB（789KB・43%削減）**。
  サムネ3枚は 915KB → 134KB、過剰倍率は 0.5倍（適正）。
- フェス詳細の RELATED STORIES も同じ関数を使うため、同時に改善される。

### コミット
- このエントリと同一コミット。

### 検証
- 修正前後を**同じ方法・同じ幅**で実測して比較（上表）
- preflight 全48件成功

### 変更したパターン
- build-detail-pages.mjs にヘルパー1・img 1箇所

### 未確認の類似パターン
- ★**記事本文に Google Drive 直リンク画像が80枚ある**
  （transcendence 6 / post-20251120 8 / loa 5 / bondisco 4 / snow-machine 6 /
  asia 14 / forest 4 / rebirth 6 / japan-sept 12 / shifumiz 6 / otsukimi 9）。
  docs/DATA_SCHEMA.md は「Drive直リンクは権限・仕様変更で破損するため禁止」と
  明記しているが**実態は違反**。1枚あたり 105〜132KB で、記事ページの
  残り重量の大半を占める
- `LP/images/` が **122MB**、300KB超の記事画像が56枚

### 次の担当への注意・判断待ち
- 監査レポート全文はこのセッションの最後の回答を参照（h1・meta・OGP・
  canonical・hreflang・構造化データ・内部リンク・sitemap の実測値つき）。

## 2026-09-15 ハブ用の軽量データ data-hub.js を追加（JS転送57%削減）

### 実施（設計・検証=Claude / 実装=Codex）
- 監査タスク①。ハブ12枚（JA7/EN5）が読む `data.js` は 401KB（非圧縮）/
  gzip 128KB。**詳細ページは data.js を読んでいない（0/95）**ことを実測。
- 内訳を測り、**ハブが一度も参照しない項目が202KB（63%）**と判明:
  ARTICLES `body`+`body_en` 126KB / FESTIVALS `desc`+`desc_en` 58KB /
  FESTIVALS `editions` 17KB。
- 各ハブの使用項目を**実コードから抽出**して保持リストを作成
  （VENUES の `desc`/`desc_en` は venues.html が使うので残す。
  FESTIVALS の `lineup` は index.html が使うので残す）。
- **除外はこの5項目だけ**。`LP/data-hub.js` を新設し、ハブだけが読む。
  **`data.js` の生成ロジック（buildFullDataJs）は一切変更していない**。

### ★二重生成にした理由（重要）
CMS の Publish は `files:[data.js, data-hub.js]` を GAS に送るが、
**GAS 側が複数ファイルに対応しているかリポジトリから確認できない**
（GASのコードは外部）。未対応だと data-hub.js だけ古いまま残り、
ハブが古いデータを表示し続ける。
そのため **build-detail-pages.mjs でも data.js から data-hub.js を生成**する
保険を入れた。Publish pipeline はビルドを通るので、どちらの経路でも最新になる。
**除外5項目の定義は cms.js と build-detail-pages.mjs の2箇所にある。片方だけ変えないこと。**

### コミット
- このエントリと同一コミット。

### 検証（実測）
| | 改善前 | 改善後 |
|---|---|---|
| ハブが読むJS（gzip） | 147KB | **62KB（57%減）** |
| data.js 相当（gzip） | 128KB | **43KB** |
| パース対象（非圧縮） | 401KB | **122KB** |
- ハブ7種（JA5 + EN2）を headless で開き、**全件でカード描画・データ件数一致・
  コンソールエラー0件**を確認（F:95 A:136 V:22 Art:11）
- `check_data_hub.mjs`: 件数・id順・保持項目の欠落なし・除外5項目の不在・
  ハブHTMLの参照先を検証 → preflight **49本目**
- preflight 全49件成功

### 変更したパターン
- cms.js（buildHubDataJs 新設・Publish の files 送信）/
  build-detail-pages.mjs（data-hub.js 生成・ハブHTMLの参照先）/
  ハブHTML JA7枚（EN5枚は enHubFromJa が追従）/ 新検査1 / preflight 1行

### 未確認の類似パターン
- ★**GAS の publish_data_js が `files` 配列に対応しているか実機未確認**。
  次回の Publish 後に `LP/data-hub.js` のコミットが増えるかを確認すること。
  未対応でもビルド側の保険で更新されるため、壊れはしない
- `data.js` は今後もリポジトリに残り本番にも配信されるが、**ブラウザからは
  読まれない**（ビルドと検査のみ）。将来 CDN から外す余地がある

### 次の担当への注意・判断待ち
- 監査タスクの続き: ENハブ6件のsitemap追加 / EN版の日本語7件 / map.html削除
  （ユーザー決定済み）/ タップ領域44px / meta description の言語別文字数 /
  Drive直リンク画像80枚 / ラインナップ未入力フェスの内部リンク / 記事のFAQPage

## 2026-09-15 監査タスク②⑤: ENハブのsitemap収録 / タップ領域の補強

### ② ENハブ6件を sitemap に追加
- 実測: sitemap.xml 536URL のうち EN ハブは `en/submit.html` の1件だけで、
  **`en/index` `en/festivals` `en/artists` `en/venues` `en/news` `en/about` の
  6枚が未収録**だった（EN詳細264件は収録済み）。英語圏の入口が申告されていない状態。
- `scripts/generate-sitemap.py` の `STATIC_PAGES` に6件追加（理由コメント付き）。
- 結果: **536 → 542 URL**。6件とも実ファイルが存在することを確認。

### ⑤ タップ領域（★監査レポートの指摘を一部訂正）
- **訂正1**: detail.css には**既にタッチ対応があった**
  （`@media (pointer: coarse)` で `.lineup-item` `.detail-chip`
  `.detail-links a` `.nav-lang a`）。監査ではこれを見落として
  「タップ領域が15px」と報告していた。
- **訂正2**: ★**headless Chrome はタッチを模擬しない**ため、私の計測は
  すべて「マウス環境」の値だった。`--touch-events=enabled` 等のフラグを
  試したが `pointer: coarse` は **false のまま**（実測）。
  つまり**実機の当たり判定は測れていない**。
- 対応: 既存の対応から漏れていた `.section-cta` `.back-link` `.detail-back`
  `.article-back` `.lang-btn` `.sort-tab` の6つに `min-height: 44px` を追加。
  **既存と同じく `@media (pointer: coarse)` 内**に置き、PC の見た目は変えない。
- 版: common.css 30。

### コミット
- このエントリと同一コミット（生成物544ページ含む）。

### 検証
- sitemap: 542URL・EN6件の実ファイル存在を確認
- タップCSS: `@media (pointer: coarse)` 内にある / 対象6セレクタすべて /
  `min-height: 44px` を静的に確認
- PC幅（headless）で横はみ出し0・見た目の回帰なし
- preflight 全49件成功
- **実機（タッチ端末）での当たり判定は未検証**（headless では原理的に測れない）

### 変更したパターン
- generate-sitemap.py の STATIC_PAGES に6件 / common.css に1ブロック / 版定数1

### 未確認の類似パターン
- ★**headless でのタッチ検証手段が無い**。`pointer: coarse` を要する CSS は
  今後も静的確認しかできない。CDP の `Emulation.setTouchEmulationEnabled` を
  使えば可能だが未実装
- 本文中のリンク（`.entity-link` 等）は行内に収まる必要があるため対象外のまま

### 次の担当への注意・判断待ち
- **map.html の扱いはユーザー判断待ち**。実装済みの「CLUB MAP」機能で、
  llms.txt にも掲載、専用検査2本（check_map_nationwide / check_venue_maps）あり。
  ナビから辿れないだけ。削除すると検査とllms.txtの記述も要修正
- EN版の日本語 h1 5件（capsule / ensou / mori-michi-ichiba / otsukimi /
  ringo-festival）は **AGENTS.md に記載の既知事項**（`name_en` 未入力方針）。
  データ入力で解決する

## 2026-09-15 監査タスク④: CLUB MAP に導線とメタを追加（削除しない判断）

### 実施（設計・検証=Claude / 実装=Codex + 一部直接）
- ユーザー判断: **map.html は削除せず導線を追加**。
  実装済みの機能（全国の会場を地図表示・23KB・llms.txt 掲載・専用検査2本）で、
  ナビから辿れないだけだったため。
- 対応:
  1. **ナビに「MAP」を追加**（VENUES の直後）。手書きハブ + 詳細ページ生成コードの
     2箇所。**279ページ**に反映
  2. sitemap に `/map.html` を収録（542 → **543 URL**）
  3. og:* 6種 / twitter 2種 / JSON-LD（WebPage + BreadcrumbList）を追加
  4. **`data.js` → `data-hub.js` に切り替え**（401KB → 122KB。map は VENUES しか
     使わないため必要項目は保持済み）
  5. `check_data_hub.mjs` の検査対象に map.html を追加

### ★実装中に見つけて直した2件
1. **EN ハブの MAP がリンク切れになる**: `enHubFromJa` の内部リンク書き換えは
   **ホワイトリスト方式**（index/news/festivals/artists/venues/about/submit）で、
   `map.html` が入っていないため相対のまま残り `/en/map.html`（存在しない）を
   指していた。**ルート相対へ正規化する1行を追加**（index.html の正規化の隣）。
2. **`en/submit.html` のナビが全て日本語ページを指していた**（既存バグ・今回と無関係）。
   TOP/NEWS/FESTIVALS/ARTISTS/VENUES/ABOUT の6リンクが `/index.html` 等を
   指しており、英語ページから日本語へ飛ぶ状態だった。
   原因: **`en/submit.html` だけが手書き**で、他のENハブ6枚は `writeEnHub` が
   毎ビルド生成する（`HUBS` に submit が無い）ため、生成側の修正が届かない。
   6リンクを `/en/…` に修正。

### コミット
- このエントリと同一コミット。

### 検証
- ナビ反映: フェス95/96・会場22/22・アーティスト136/144・記事11/12・
  ハブJA9/14・ハブEN6/7。**未反映はすべてリダイレクトスタブ13件・noindex 1件・
  map.html 自身**であることを内訳で確認（★要確認は0件）
- EN ハブ3枚の MAP リンクが `/map.html` を指すこと、リンク先が実在することを確認
- map.html を headless で描画: **VENUES 22件を読み、エラー0件**
- sitemap 543URL / og 6種 / JSON-LD 2件
- preflight 全49件成功

### 変更したパターン
- ナビ2箇所（手書きハブ + 生成コード）/ enHubFromJa に正規化1行 /
  generate-sitemap.py 1件 / map.html（メタ + データ参照）/ en/submit.html 7リンク /
  check_data_hub.mjs の対象

### 未確認の類似パターン
- ★**`en/submit.html` は writeEnHub の対象外（手書き）**。今後 JA 側のハブを
  変更しても EN の submit には反映されない。`HUBS` に加えるか、手で追随するか
  の判断が要る
- EN 版 map.html は作っていない。EN からは JA の CLUB MAP へ飛ぶ
  （ページ内文言は元々英語表記のため実害は小さい）

### 次の担当への注意・判断待ち
- 監査タスクの残り: meta description の言語別文字数 / Drive直リンク画像80枚 /
  ラインナップ未入力フェスの内部リンク / 記事のFAQPage・事実要約（GEO）

## 2026-09-15 監査タスク⑥⑨: meta description の言語別長さ / speakable 追加（⑧は実装不要と判明）

### ⑥ meta description を言語別の長さに
- 実測: 全ページが 160 文字で切られており、**JA 275件中135件が120字超**
  （日本語は検索結果で約120字で切れる）。EN は155字が目安。
- `page()` の `truncate(desc, 160)` を **`lang === 'en' ? 155 : 120`** に変更（1箇所で全ページに効く）。
- EN ハブ festivals の固定文言だけ 167字あったため 145字に短縮
  （末尾の重複表現「and underground raves」を削除）。
- 結果: **超過ページ 0件**（JA 最長120字・中央値116字 / EN 最長155字）。

### ⑨ GEO/AIO: speakable を記事に追加
- 記事の NewsArticle に `speakable`（`h1` と `.article-excerpt`）を追加。
  Google が**ニュース記事向けにサポート**しており、音声アシスタントと
  生成AIに「記事の要点はここ」を示せる。
- **22/23記事**に出力（1件は noindex 等の対象外）。
  セレクタが実際のマークアップに存在することも確認。
- 記事の `about` は既に関連フェスを `@id` 参照しており（実測）、
  AI はそこからイベント情報を辿れる。**追加実装は不要**だった。

### ★⑧は実装不要（監査の表現を訂正）
- 監査で「フェス96件が実質的に孤立」と書いたが、**誇張だった**。
  実測: 被リンクが「ハブ以外から0本」のフェスは49件あるが、
  **全件がハブ（festivals.html）から1本リンクされ、sitemap にも入っている**。
  クロール・インデックス上の問題は無い。
- 「関連フェス」に選ばれないのは選出条件（同一都市10点＋共通ジャンル1点/件）の
  結果であり、データ不備ではない（日付・都市・ジャンルは揃っている）。
- 被リンクを増やしたいなら**ラインナップを入力する**のが最も効く
  （アーティスト詳細から自動でリンクされる。現在 LINEUP 有りは48/95件）。
  これは運用側のデータ入力。

### コミット
- このエントリと同一コミット（生成物含む）。

### 検証
- description: 全543ページで言語別の上限を超えるものが0件
- speakable: 22/23記事に出力・セレクタ実在を確認
- preflight 全49件成功

### 変更したパターン
- build-detail-pages.mjs（truncate の言語分岐1・EN固定文言1・speakable 1）

### 未確認の類似パターン
- `truncate` は文字数で機械的に切るため、**文の途中で切れる**ことがある
  （句読点で切る実装にはしていない）。日本語の読みやすさを上げる余地あり
- FAQPage は現在**フェス186件のみ**。記事に付けるには記事ごとに Q&A を
  書く必要がある（運用）

### 次の担当への注意・判断待ち
- ⑦ **Drive 直リンク画像80枚の自サイト移行が未着手**。
  `docs/DATA_SCHEMA.md` が禁止と明記しているのに全11記事で使用されており、
  1枚105〜132KB。記事ページの残り重量の大半を占める。
  移行には画像80枚のダウンロード・変換・本文の書き換えが必要で、規模が大きい

## 2026-09-15 CLUB MAP を非公開に戻す（ユーザー判断）

### 背景
- 同日に導線を追加したが、**「中身が整理されていないので非公開にしたい」**との判断。
- 完全削除ではなく、既存の非公開ページ（discover / events / media）と**同じ扱い**にした。

### 実施（Claude が直接実施。追加分の巻き戻しのため）
1. **ナビの MAP を全削除**: 生成コード2箇所 + 手書きハブ44箇所 → **残り0件**
2. **sitemap から除外**（543 → 542 URL）
3. **`<meta name="robots" content="noindex">` を追加**（既存の非公開ページと同形式）
4. `enHubFromJa` の map パス正規化も不要になったため削除

### 残したもの（将来の再公開に備えて）
- map.html の **OGP / JSON-LD**（追加済み。noindex なので影響なし）
- **`data-hub.js` への切り替え**（401KB→122KB の軽量化は有益なため維持）
- **`en/submit.html` のナビ修正**（英語ページから日本語ページへ飛んでいた既存バグの
  修正。MAP とは無関係なので維持）
- 検査2本（check_map_nationwide / check_venue_maps）はそのまま

### コミット
- このエントリと同一コミット。

### 検証
- ナビに MAP が残るページ: **0件**
- 各ページのナビが `TOP / NEWS / FESTIVALS / ARTISTS / VENUES / ABOUT` の
  正しい並びに戻っていること（JA/EN/詳細ページで確認）
- sitemap 542URL / map.html に noindex
- preflight 全49件成功

### 変更したパターン
- 生成コード2・手書きハブ44・generate-sitemap.py 1・map.html に noindex 1・
  enHubFromJa の正規化1（削除）

### 未確認の類似パターン
- map.html は **URL を直接叩けば表示される**（完全非公開ではない）。
  検索には出ないが、リンクを知っている人は閲覧できる
- 再公開するときは、このコミットを参考にナビ・sitemap・noindex を戻せばよい

### 次の担当への注意・判断待ち
- 監査タスク⑦（Drive直リンク画像80枚の自サイト移行）は**未着手**。

## 2026-09-15 監査タスク⑦: Drive画像の自サイト移行（準備完了・本文置換は未実施）

### 背景
`docs/DATA_SCHEMA.md` が「Drive直リンクは権限・仕様変更で破損するため禁止」と
定めているのに、記事本文で使われていた。

### 完了したこと
1. **画像80枚をダウンロードして webp 変換**（成功80 / 失敗0）。
   変換条件は sync-drive-images.yml と揃えた（長辺1920 / WEBP quality=85 / method=6）。
   命名は `{article-id}-body{NN}-{fileIdのsha1先頭8桁}.webp`（再実行しても同名）。
   `LP/images/articles/` に配置し、派生画像（image-derivatives.js）にも登録済み。
2. ★**本文の自サイト画像に srcset を付ける処理を新設**（`addLocalImageSrcset`）。
   これが無いと移行後に**原寸が配信されて逆に重くなる**ことを実測で確認したため。
   `addDriveImageSrcset` は Drive URL 専用で、自サイト画像には効かなかった。
3. **効果を同一記事で前後比較**（shifumiz / モバイル幅500px）:
   | | 移行前(Drive) | 移行後(自サイト+srcset) |
   |---|---|---|
   | ページ総重量 | 1,052KB | **798KB（24%減）** |
   画像は 448px 表示に対し 500px 配信（過剰倍率0.6＝適正）。

### ★未実施: 本文URLの置換（次回の作業）
- GAS の `update_row` は**書き込みが通ることを確認済み**（"ok" が返る）。
- しかし実行直前の安全チェックで停止した。原因を調べたところ
  **シートの本文が data.js より新しく、URL の集合が一致しない**:
  - data.js から抽出: 80枚
  - シートの最新: **76枚**（うち data.js に無いものが複数）
  - `bondisco-2026-info` はシート側で published ではなくなっている
- ブラウザ経由で fileId 一覧を取ろうとしたが、**一部が Base64 と誤認されて
  マスクされ**、完全なリストが取れなかった。

### 次回の手順（この順で安全に進められる）
1. **CMS で Publish Now**（data.js をシートと同期させる）
2. `git pull` 後、`scratchpad/migrate_drive_images.py` を再実行して**不足分だけ**追加取得
   （既存ファイルはスキップされる）
3. 置換マップ `reports/drive_image_migration_map.json` を更新
4. CMS のコンソールから `update_row` で記事ごとに body / body_en を置換
   （**置換後に Drive URL が0であることを確認してから送る**安全チェックを必ず入れる）
5. Publish → 記事ページの重量を再測定

### コミット
- 画像80枚・srcset実装・派生・置換マップ。**data.js は移行前のまま**（本文は Drive のまま）。

### 検証
- preflight 全49件成功（未使用画像があっても検査は通る）
- `check_article_links.mjs` 成功（Drive画像の既存処理は無変更＝回帰なし）

### 未確認の類似パターン
- `LP/images/articles/` が **58MB** に増えた（移行分を含む）。
  本文置換が完了するまで80枚は未使用のまま残る
- 置換が完了したら、**Drive URL が本文に残っていないこと**を検査に加えるとよい
  （DATA_SCHEMA の禁止事項を機械で守れる）

### 次の担当への注意・判断待ち
- 監査タスクは⑦の本文置換だけが残り。他（①②⑤⑥⑨）は完了、⑧は実装不要と判明。

## 2026-09-15 【緊急修正】Publish が CSP 違反で失敗する不具合

### 症状（ユーザー報告）
Publish Now で
`Evaluating a string as JavaScript violates the following Content Security Policy
directive because 'unsafe-eval' is not an allowed source of script:
script-src 'self' 'unsafe-inline'` が出て失敗。

### 原因（同日の自分の変更）
`7a04f4f3`（data-hub.js 追加）で入れた **`buildHubDataJs` が `new Function` を
使っていた**。CMS の CSP は `script-src 'self' 'unsafe-inline'` で
**`unsafe-eval` を許していない**ため、ブラウザ上で実行できず Publish が中断した。
- 実装は「buildFullDataJs の出力文字列を `new Function` で評価して項目を落とす」形だった。
- ローカル（Node）では動くため、**ブラウザで実行して初めて露呈した**。

### 修正
**入力側で不要項目を落としてから `buildFullDataJs` を通す**形に書き換え
（入力行のキー名は出力キーと同じことを実装から確認済み）。
`new Function` / `eval` は使わない。ヘッダーだけ文字列置換で差し替える。
版: cms.js 126。

### 再発防止
`scripts/check_data_hub.mjs` に
**「cms.js に eval / new Function が無い」検査**を追加（コメント行は除外）。
CSP で動かないコードが入り込んだらローカルで止まる。

### コミット
- このエントリと同一コミット。

### 検証
- vm で cms.js を読み込み `buildHubDataJs` を実行:
  除外5項目が FESTIVALS / ARTICLES ブロックから消え、**VENUES.desc と
  FESTIVALS.lineup は保持**、生成物が正しい JS として評価できることを確認
  （※検証は Node 側。ブラウザでは評価しない）
- `check_data_hub.mjs`: data.js との件数・id順一致、保険生成との一致、
  eval 不在 → すべて成功
- preflight 全49件成功

### 変更したパターン
- cms.js の buildHubDataJs 1関数 / check_data_hub.mjs に検査1

### 未確認の類似パターン
- ★**CMS のコードは Node で動いてもブラウザで動くとは限らない**（CSP）。
  今回は `new Function` だったが、`unsafe-inline` 以外の制約
  （外部スクリプト・WebAssembly 等）も同様に効く。
  CMS に手を入れたら、**実機の Publish を1回通すまで完了にしない**
  （AGENTS.md「Publish の経路を触ったら実機で1回通すまで完了にしない」に該当）
- **今回の修正自体も実機未確認**。ユーザーに Publish を試してもらう必要がある

### 次の担当への注意・判断待ち
- 監査タスク⑦（本文のDrive URL置換）は、この Publish 成功後に再開する。

## 2026-09-15 【緊急修正2】下書きフェスに開催回を作ると Publish が止まる

### 症状
CSP 修正後、Publish は成功するが **Publish pipeline が失敗**:
`✗ EDITIONS super-rave-kitakagaya-2026: FESTIVAL_ID参照切れ "super-rave-kitakagaya"`

### 原因（検査の設計不備。ユーザーの操作は正しい）
- `scripts/fetch-data.mjs` の参照チェックが、
  **published のフェスだけで `festivalIds` を作っていた**。
- 実データ: フェス `super-rave-kitakagaya` も開催回 `super-rave-kitakagaya-2026` も
  **両方 STATUS=draft**。どちらも公開されないのに「参照切れ」と誤判定していた。
- **下書きのフェスに開催回を作るのは正常な運用**であり、止める理由が無い。

### 修正
参照先の存在確認を **draft を含めた全フェス**（`knownFestivalIds`）で行い、
そのうえで「**公開する開催回が下書きのフェスを参照している**」場合だけ別メッセージで止める。

```
if (!knownFestivalIds.has(fid))      → FESTIVAL_ID参照切れ（本当に存在しない）
else if (pub && !festivalIds.has(fid)) → 公開する開催回が下書きのフェスを参照
```

### コミット
- このエントリと同一コミット。

### 検証（ミューテーション試験）
| 試験 | 結果 |
|---|---|
| 存在しないフェスIDを参照 | ✅ 「FESTIVAL_ID参照切れ」で停止 |
| 公開開催回が下書きフェスを参照 | ✅ 「下書きのフェスを参照」で停止 |
| 下書きフェス＋下書き開催回（今回の状況） | ✅ **通る**（誤検知が解消） |
- preflight 全49件成功

### ★今日の一連の Publish 失敗の整理（3件とも別原因）
1. **CSP違反**: 自分が入れた `new Function`（cms.js）→ 修正済み（v126）
2. **ブラウザキャッシュ**: 修正後も古い cms.js v125 が読まれていた
   → **CMS を直したら「Cmd+Shift+R で強制リロード」を必ず案内すること**
   （cms.html は `max-age=600`。GitHub Pages ではヘッダーを変えられない）
3. **下書きフェスの参照切れ誤判定**: 本件

### 未確認の類似パターン
- ★**LINEUPS 側にも同種の誤判定がある可能性**。実測で「参照切れの出演者 7件」が
  出ており、下書きの開催回を参照しているものが含まれるかは未調査
- ARTISTS / VENUES の draft も同じ構造の問題を持ちうる

### 次の担当への注意・判断待ち
- この修正が本番に入ったら、**Publish pipeline を1回再実行**して緑にすること。

## 2026-09-15 【事故報告】本番データを壊した（BON DISCO 記事）＋復元

### 何をして、何が起きたか
Drive画像移行の作業中、**「GAS に書き込めるか」を確認する目的で**
本番の ARTICLES に対して update_row を実行した:
```js
gasPostJson_({action:'update_row', sheet:'ARTICLES', row:row._row, id:row.id, body:row.body})
```
**GAS の update_row は「送られた項目だけ更新」ではなく「行を送られた内容で置き換える」**
動作だった。結果、`bondisco-2026-info` の
**title / title_en / excerpt / excerpt_en / category / date / author / image /
metaDescription / readTime / featured / status / body_en がすべて空になった**
（残ったのは id と body のみ）。

### 気づいた経緯
翌日の Publish pipeline が `check_jsonld` で失敗
（`imageが16:9・1:1・4:3の3件で実在する — og-default.png`）。
記事の image が空になり、デフォルト画像にフォールバックしていたため。

### 復元
- `backups/2026-09-14.json`（事故前）に全23列が残っていた。
- CMS のコンソールから **全項目を明示して** update_row を2回実行し復元
  （1回目で本文以外、2回目で body_en）。
- 復元後の確認: title / image / status / category / excerpt / title_en /
  excerpt_en がすべて戻り、**body 2,386字・body_en 3,704字**。
- **他11記事は無傷**（全記事を機械で確認）。

### ★再発防止（守ること）
1. **本番データへの書き込みを「確認のため」に行わない。**
   確認したいなら読み取り（get_sheet）だけにする。
2. update_row を使うときは **必ず既存の全項目を読み、それを含めて送る**。
   送らなかった項目は消える。
3. 書き込み前に「この操作で消える項目は無いか」を明示的に確認する。

### 併発した問題（すべて同日）
| # | 内容 | 原因 |
|---|---|---|
| 1 | Publish が CSP 違反で失敗 | 自分が入れた `new Function`（cms.js）|
| 2 | 修正後も同じエラー | **ブラウザキャッシュ**（cms.html は max-age=600）。CMS を直したら Cmd+Shift+R を案内すること |
| 3 | 記事データ破損 | **本件** |
| 4 | 下書きフェスで参照切れ誤判定 | fetch-data.mjs が published のみで参照先を判定していた |
| 5 | articles.xml が10件（期待11件）| 3 の影響でローカル data.js が壊れていた。git の事故前コミットから当該ブロックを復元して解消 |

### コミット
- 4 の修正と 5 の復元を含む。

### 検証
- preflight 全49件成功
- articles.xml 11件 / feeds OK / キャッシュバスティング正常
- シート側は正常（fmtDate で `2026-08-13` に変換されることを実機で確認）

### 次の担当への注意・判断待ち
- この修正を push 後、**Publish pipeline を再実行**して緑にすること。

## 2026-09-15 data-hub.js を ?v 検査の除外に追加（導入時の漏れ）

### 症状
Publish pipeline が `Check asset cache busting` で失敗:
`❌ data-hub.js → ?v=11 のまま（14参照）`

### 原因（9/15 の data-hub.js 導入時の設計漏れ）
`check_asset_versions.py` の `VERSION_CHECK_EXEMPT` には
**data.js だけ**が入っていた。除外理由は
「CMS の Publish Now が単独で自動commitするため ?v の更新は構造的に後追いになる」。
**data-hub.js は data.js から作られ、同じく Publish が単独でコミットする**ため
全く同じ制約を持つのに、導入時に除外へ足し忘れていた。

### 修正
`VERSION_CHECK_EXEMPT = {"data.js", "data-hub.js"}`（理由コメント付き）。

### ★検証（今回は「同じ状況を再現して」確認した）
| 試験 | 結果 |
|---|---|
| ?v を上げずに **data-hub.js だけ変更**（Publish と同じ状況） | ✅ 通る（誤検知が解消） |
| ?v を上げずに **common.js を変更** | ✅ **今まで通り検知**（検査を緩めすぎていない） |
| 復元後 | ✅ 正常 |
- preflight 全49件成功

### 次の担当への注意・判断待ち
- **新しい生成物を Publish 経路に足したら、`VERSION_CHECK_EXEMPT` と
  `sw.js` の扱いを data.js に揃えるか必ず確認すること。**
  今回はこれを忘れて本番の Publish を1回落とした。


## 2026-09-15 【運用ルール改訂】CMS/Publish 経路は「自分で Publish を通す」まで完了にしない

### ユーザーの指示
「あなたのミスが多いね。可能であればテストをしてから本番に出していこう」
→ 提案A（Publish を一度通してから完了と言う）を採用。

### 既存ルールに穴があった
AGENTS.md には 2026-08-13 から
「Publish の経路を触ったら実機で1回通すまで完了にしない」があったが、
**対象が関数名の列挙**（`buildFullDataJs` 等）だったため、
9/15 に**新設した `buildHubDataJs` が「対象外」と判断され**、
CSP 違反で本番の Publish が止まった。
**新しい関数を足すたびに穴が開く書き方だった。**

### 改訂内容（AGENTS.md）
1. **対象を「ファイル」で定義**（`LP/cms.js` を触ったら中のどの関数でも必須）。
   `fetch-data.mjs` / `VERSION_CHECK_EXEMPT` / `publish-pipeline.yml` /
   Publish が生成するファイルを増やしたとき、も対象に追加。
2. **手順を2段階に明記**:
   - サーバー側: **自分で** `gh workflow run "Publish pipeline"` を流して success を確認
     （ユーザーに Publish を押させて確かめない）
   - ブラウザ側: CMS を `?cb=<乱数>` で開き、変更した処理を実際に呼んで例外が出ないこと
3. **CMS 変更後は「Cmd+Shift+R」をユーザーに必ず伝える**。
4. **本番データへの書き込み規律**を追加:
   - 動作確認のために本番へ書き込まない（読み取りで確認する）
   - `update_row` は**送らなかった項目を空にする**。既存の全項目を読んでから送る
5. 9/15 に起きた5件の表（preflight は毎回緑だった事実）を残した。

### この日の事故一覧（すべて push 後にユーザーが発見）
| # | 内容 | 原因 |
|---|---|---|
| 1 | CSP 違反（new Function） | 自分の実装 |
| 2 | キャッシュで古い cms.js | 案内不足 |
| 3 | **記事データ破損**（BON DISCO） | 確認目的の本番書き込み |
| 4 | 下書きフェスの参照切れ誤判定 | 既存の設計不備 |
| 5 | data-hub.js の ?v 検査漏れ | 導入時の確認漏れ |

### 次の担当への注意
- **preflight が全件緑でも、CMS の変更は検証できていない。** 必ず上の2段階を通すこと。

## 2026-09-21 ニュースサイトマップが本番で7日間古いままだった（デプロイ漏れ）

### 症状
本番の `sitemap-news.xml` に **9/14 公開の記事が 9/21 時点でも残っていた**。
このファイルは Google News 仕様で「**直近48時間の記事だけ**」を載せるため、
古い記事が残るとエラー扱いになりうる。

### 原因（9/15 の導入時の確認漏れ）
- `generate-meta.yml`（毎日12時）は生成物を
  `chore: regenerate … [skip ci]` でコミットしている。
- **`[skip ci]` のため Deploy が走らない。** リポジトリ上は毎日正しく更新されるのに
  **本番へ配信されない**。実際、最後の Deploy は **9/15 11:59** で止まっていた。
- それまで sitemap.xml / rss.xml は中身がほぼ変わらず問題が表面化しなかった。
  **sitemap-news.xml は毎日中身が変わる**初めてのファイルだったが、
  導入時に「毎日デプロイされるか」を確認していなかった。

### 修正
`generate-meta.yml` のコミットステップに `id: commit` と
`changed=true/false` の出力を追加し、**変更があったときだけ**
`gh workflow run "Deploy LP to GitHub Pages"` で Deploy を起動する。
`[skip ci]` は維持（他のCIは動かさない）。理由コメントを本文に記載。

### 検証（push 前に実施）
| テスト | 結果 |
|---|---|
| シェル: 変更なしのとき | ✅ `changed=false` |
| シェル: 変更ありのとき | ✅ `changed=true` |
| `if` がステップ出力を参照 | ✅ `steps.commit.outputs.changed == 'true'` |
| 実行順（commit → deploy） | ✅ 正しい |
| YAML 構文 | ✅ |
| preflight | ✅ 全49件成功 |

### 記事配信そのものは正常だった（確認済み）
- 公開記事 11件 / 下書き 0件
- `articles.xml` **11件**（全記事）
- `sitemap.xml` の記事URL **22件**（JA/EN）
- 記事ページは正常表示

### 次の担当への注意
- ★**「毎日中身が変わる生成物」を追加したら、本番へ毎日配信されるかを確認すること。**
  `[skip ci]` 付きのコミットは Deploy を起こさない。
- 次回の generate-meta 実行（毎日 UTC 3:00 = 日本時間12:00）で
  Deploy が自動起動するかを確認すること。

---

## 2026-09-21 記事ページの RELATED STORIES サムネが縦に伸びていた（detail.css v38）

### 実施
`.related-story-thumb` に `height: auto` を追加した（`LP/detail.css:357`）。
`DETAIL_CSS_VERSION` を 37 → 38 に上げ、詳細ページを再生成した。

**原因**: サムネの `<img>` には `dimensionAttrs()` が原画の実寸を
`height="648"` のように書き込む（レイアウトシフト防止）。CSS 側は
`width:120px` と `aspect-ratio:4/3` だけを指定し `height` を書いていなかったため、
**height 属性の値がそのまま高さとして使われ、aspect-ratio が無視された**。
結果、120×648px の縦長になっていた。

フェス詳細が無事だったのは、`.festival-design-v2 .festival-related-stories-v2
.related-story-thumb` が `height: 220px` を明示していたため。
記事ページは `.festival-design-v2` の外にあるので、この救済が効かなかった。

### コミット
- `fix(article): RELATED STORIES のサムネが height 属性で縦に伸びる問題を修正`
  （`LP/detail.css` / `scripts/build-detail-pages.mjs` + 再生成物）

### 検証
本番で不具合を再現 → 修正後にローカル（`python3 -m http.server 8931`）で実測。
計測は headless Chrome に計測スクリプトを差し込んだ複製ページ（`LP/__probe/`、
計測後に削除）で `getBoundingClientRect()` を読む方式。

| ページ | 幅 | 修正前 | 修正後 |
|---|---|---|---|
| `articles/synapse-2026-info.html` | 1280 | **120×648** ❌ | 120×90 ✅ |
| 同上 | 900 | — | 120×90 ✅ |
| 同上 | 640 | — | 88×66 ✅ |
| `en/articles/synapse-2026-info.html` | 1280 | **120×648** ❌ | 120×90 ✅ |
| 同上 | 640 | — | 88×66 ✅ |
| `festivals/otsukimi.html`（回帰確認） | 1280 | 367×220 | 367×220（変化なし）✅ |

`bash scripts/preflight.sh` ✅ 全49件成功。

### 変更したパターン
- `.related-story-thumb`（記事詳細 JA/EN の RELATED STORIES）のみ。

### 未確認の類似パターン
**確認済み・0件。** 実ブラウザで「CSS の `aspect-ratio` が指定されているのに
描画比率が5%以上ずれている img」を全件走査した結果:

| ページ | 該当 |
|---|---|
| `articles/synapse-2026-info.html` | 3件（すべて `.related-story-thumb`、今回修正） |
| `en/articles/synapse-2026-info.html` | 3件（同上） |
| `festivals/otsukimi.html` | 0件 |
| `artists/dj-nobu.html` | 0件 |
| `news.html` | 0件 |

`dimensionAttrs()` を使う他の10箇所（hero / flyer / related-card-img 等）は
CSS 側で height を指定済みか aspect-ratio を使っていないため影響なし。

### 次の担当への注意
- ★**`dimensionAttrs()` で width/height 属性を付けた img に CSS で
  `aspect-ratio` を効かせたいときは、必ず `height: auto` を併記すること。**
  属性の height は presentational hint として効いてしまい、aspect-ratio を殺す。
  `LP/detail.css:351` にこの理由をコメントで残した。
- この不具合は「画像が出ている」ので、リンク切れ検査や JSON-LD 検査では
  引っかからない。**描画サイズを測らないと見えない類**である。

## 2026-09-22 スマホの記事1ビュー目：メタ情報を「1行の署名」に畳んだ（detail.css v39）

### 実施
記事詳細のメタ情報（WORDS BY / PUBLISHED / READING TIME）が、スマホで
**縦3段・高さ216px** に展開し、本文1行目を画面の下へ押し出していた。
`LP/detail.css` の `@media (max-width: 640px)` で、これを
**10px モノスペース1行の署名**（`TECHNO JAPAN │ SEP 21, 2026 │ 5 MIN`）へ変更。

- ラベル（dt）は視覚的に隠すだけで DOM には残す（読み上げ・意味は保持）。
- 区切りは `> div + div::before` の縦罫1px。値は opacity 0.5 のサイン扱い。
- 併せて `.article-excerpt` の下余白を 40/32 → 28/22px に詰めた。
- **PC（641px以上）は従来のスペック表のまま**（変更なし）。
- `DETAIL_CSS_VERSION` 38 → 39、詳細ページ530枚を再生成。

### コミット
- `fix(article): スマホ記事のメタ情報を1行の署名に畳んで本文を1ビュー目に出す`
  （`LP/detail.css` / `scripts/build-detail-pages.mjs` + 再生成物531ファイル）

### 検証
headless Chrome（実機相当 dpr3 / `mobile:true`）でローカル配信して
`getBoundingClientRect()` を実測。**変更前後を同じ方法で測って並べた。**

| 393×852 / `articles/synapse-2026-info.html` | 変更前 | 変更後 |
|---|---|---|
| メタブロックの高さ | 216px | **30px** |
| メタブロックの行数 | 3行 | **1行** |
| 本文（excerpt）1行目のY | 641px | **419px** |
| 1ビュー目に読める行数（Safari実表示700px想定・行送り27.2px） | 約2.2行 | **約10.3行** |

実ブラウザ走査（JA/EN × 393/375/1280px、計12通り）: **全件 OK**

| 幅 | 結果 |
|---|---|
| 393px / 375px（JA・EN 各2記事） | 1行・高さ30px・dt不可視・横溢れなし・重なりなし |
| 1280px（同4記事） | 従来どおり3列・高さ72px・dt可視（**回帰なし**） |

- 長い著者名（`post-20251120` = Masafumi Take）でも375pxで1行・30pxのまま。
- `bash scripts/preflight.sh` ✅ **全49件成功**。
- スクリーンショットで実際の描画も目視確認（393px JA）。

### 変更したパターン
- `.article-specs` / `.article-specs > div` / `dt` / `dd` / `.article-updated` /
  `.article-excerpt` の **640px以下のみ**。記事詳細 JA/EN の2経路。
- `detail.css?v` の更新: 530ページ。

### 未確認の類似パターン
- **更新日つき記事（`.article-updated`）: 本番データに該当0件。**
  実データが無いため、ブラウザ上で `<span class="article-updated">` を
  差し込んだ擬似状態で確認した（393/375px とも2行・高さ49px・横溢れなし、
  本文1行目 438px で改善は維持）。ただし2行目の先頭に区切り罫が来る見た目は
  やや不自然。**実データで更新日が入ったら見た目を再確認すること。**
- フェス／会場／アーティスト詳細の `.detail-facts`: 今回は対象外（未変更）。
  同様に縦積みで嵩むが、1ビュー目に本文が無い構造なので優先度は低い。
- 本番反映後の実機 Safari 操作: **未確認**（人の指での操作は未実施）。
  本番URLに対する headless Chrome（393x852 / dpr3）での確認は完了:
  `articles/synapse-2026-info.html` / `en/articles/synapse-2026-info.html` とも
  `detail.css?v=39`・メタ1行・高さ30px・本文1行目419px、スクリーンショット目視済み。
  Deploy run `35703450494` / `35703676568` ともに success。

### 次の担当への注意・判断待ち
- CMS / GAS / Publish 経路は**触っていない**（CSS と再生成のみ）。
- `LP/cms.js` のプレビューは `detail.css?v=36` を参照したままで、本番の v39 と
  ずれている（今回の変更より前からの状態）。`check_cms_article_generated_preview.mjs`
  が literal 36 を期待しているため preflight は緑だが、
  **プレビューは本番と別バージョンのCSSで描画されている。**別件として要整理。

## 2026-09-24 定量診断（総合69点）→ WP1: コントラスト・タップ領域の CSS 修正（Codex 実装 / Claude 検証）

### 実施
サイト全体の定量診断（5軸・100点満点）を行い、改善計画を
[docs/design/QUANT_AUDIT_2026-09-24_PLAN.md](../docs/design/QUANT_AUDIT_2026-09-24_PLAN.md) に置いた。
今回はその WP1（a11y の CSS 修正）を **設計 Claude → 実装 Codex（2回）→ 検証 Claude** で完了。

- 文字の最低濃度を **opacity 0.62**（#080808 上で約 6.8:1）に統一。赤アクセント文字は
  **opacity 1**（0.8 だと 3.6:1 で AA を割る）。7〜8px の文字は 9px に。
- 操作要素（ハンバーガー / ロゴ / フィルタタブ / lang-btn / OFFICIAL・TICKETS /
  SNS アイコン / フッターリンク / SUBSCRIBE 等）を **短辺 48px** に。アイコン・文字の
  大きさは変えず当たり判定だけ広げた。
- `nav .logo` は Codex の `min-height` 方式だと詳細ページ（content-box）でヘッダーが
  79px に伸びたため、既存の「padding＋負 margin」方式で 48px に（`common.css` にコメント）。
- `DETAIL_CSS_VERSION` 39→40、`COMMON_CSS_VERSION` 30→31、`ARTICLE_FX_CSS_VERSION` 12→13。
- 監査用スクリプト `scripts/audit_a11y_browser.mjs` を追加（`--local` でローカル、無指定で本番）。

### コミット
- `fix(a11y): コントラスト AA とタップ領域 48px を全ページで満たす（定量診断 WP1）`

### 検証
`scripts/audit_a11y_browser.mjs --local`（393×852 / dpr3 / タッチ、12ページ、ヒットテスト済み）で
**変更前後を同じ方法で計測**:

| | 変更前 | WP1 後 | WP1b 後 | 最終（フッター48px込み） |
|---|---|---|---|---|
| タップ領域 <48px | 62 | 2 | 0 | **0** |
| コントラスト <AA | 344 | 111 | 15 | **15** |
| 横スクロール | 0 | 0 | 0 | **0** |

- ヘッダー高さは変更前後で同一（モバイル 54px / PC 78px・72px）。ロゴ当たり判定 44→48px、
  ハンバーガー 44→48px を実測。
- `bash scripts/preflight.sh` ✅ **全49件成功**（最終状態で実行）。
- JA/EN ハブの行数一致（6枚）。スクリーンショットで venues ハブ・フェス詳細（393px）を目視。
- 残り15件の内訳: venues カードの写真上テキスト 9（静的に測れない）、TOP ヒーロー 48px 見出し 2
  （画像上・大文字）、フェス説明文中のリンク 2（`.lang-body` 0.75 × アクセント色 = 2.6:1）、
  詳細ページの `lang-btn` 2（3.71:1、原因規則は未特定）。

### 変更したパターン
- `LP/common.css` / `LP/detail.css` / `LP/article-fx.css` と JA ハブ5枚＋about.html の inline CSS。
  クラス数: コントラスト 43 → 対応済 39、タップ 12 → 12 すべて。

### 未確認の類似パターン
- `.lang-body` 内のアクセント色リンク（2件）と `lang-btn` 3.71:1（2件）: 未対応。次の Codex 回で追う。
- 写真の上の文字（venues カード / ヒーロー）: 計測不能。目視ではグラデーションの上に載っている。
- 本番反映後の実機 Safari 操作: **未確認**（headless Chrome での本番計測は push 後に行う）。

### 次の担当への注意・判断待ち
- WP2（onclick 撤去 → common.js 委譲）と WP3（画像同期の 1MB ガード）の Codex 指示書は
  scratchpad に作成済み。次に実行する。
- 見出し階層（7/24記事）・404 リンク（ultra-japan チケット / triangle）・記事 Drive 画像の alt は
  **CMS 側のデータ修正**なので Codex には渡さない（計画書 C1〜C3）。

## 2026-09-24 WP2: インライン onclick / onerror 撤去（Codex 実装）

### 実施
- `LP/common.js` の `initMobileNavOverlay()` に document レベルのクリック委譲を実装し、ハンバーガー開閉・閉じる・戻る・オーバーレイ内リンクを処理するよう変更。既存の bottom close 個別リスナーは委譲へ統合。
- `LP/favorites.js` の `attachHeart()` に、土台要素への一度だけの preventDefault / stopPropagation ガードを追加。
- `LP/index.html` / `LP/news.html` の描画用インラインスクリプト先頭に capture の `error` 委譲を追加し、画像フォールバックを移管。
- 手書き JA ページと `scripts/build-detail-pages.mjs` の対象ナビ・お気に入り土台から inline 属性を撤去。`LP/submit.html` に残っていた同型ナビ属性も完了条件の grep 対象のため撤去。

### コミット
- **未実施（ユーザー指示により commit / push なし）**。

### 検証
- `onclick=` の対象外 HTML: **0 行**。
- `LP/index.html` / `LP/news.html` の `onerror=`: **0 行**。
- `scripts/build-detail-pages.mjs` の `onclick`: **0 行**。
- `node --check LP/common.js` / `node --check LP/favorites.js`: **成功**。
- `git diff --check`: **成功**。
- 実ブラウザ検証、preflight、ビルド、Publish pipeline: **未実施（別担当）**。

### 変更したパターン
- ハンバーガー開閉・閉じる・戻る: `LP/common.js` の `initMobileNavOverlay()`。
- ハート押下でカードへ遷移しない処理: `LP/favorites.js` の `attachHeart()`。
- 画像フォールバック: `LP/index.html` / `LP/news.html` の描画用インラインスクリプト先頭に置いた capture `error` listener。

### 未確認の類似パターン
- `LP/en/` および `LP/articles/` / `LP/festivals/` / `LP/artists/` / `LP/venues/` の生成物は指示どおり未変更・実ブラウザ未確認。
- 実ブラウザでのナビ操作、戻る、ハート押下、画像エラー時の表示切替は **未確認**。

### 次の担当への注意・判断待ち
- `common.js` / `favorites.js` は構文確認済みだが、公開前に指定の実ブラウザ確認を行うこと。
- `scripts/build-detail-pages.mjs` の変更は生成物へ反映していない。指示どおりビルドおよび `?v` 更新は未実施。

### 検証（Claude 側・2026-09-24 追記）
- Codex の差分をレビュー。`news.html` の XSS 事例コメント（`<img src=x onerror=...>` §9-44）を Codex が
  言い換えていたので元に戻した（サニタイズの根拠なので原文を残す）。
- `LP/en/submit.html` は自動生成の対象外（手書き EN ページ）で `onclick` が2つ残っていたため手で撤去。
- `common.js` v15→16、`favorites.js` v2→3、`COMMON_JS_VERSION` 16、詳細ページ 530 枚を再生成。
  生成物・手書き HTML とも `onclick=` **0**（cms.html 除く）。
- headless Chrome（393px）で 5 ページ（TOP / festivals / フェス詳細 / EN 記事 / favorites）:
  ハンバーガー開く→`body.nav-open` 付与、`.nav-close` で閉じる、`.nav-close-bottom` で閉じる、
  `.nav-back` の存在 — **すべて OK**。画像フォールバック（存在しない src → `data-original-src` へ差し替え、
  無ければ非表示）— **OK**。
- お気に入りハートのクリックガードは **検証できず**: ハブの描画時に `window.tjFav` が未定義
  （`favorites.js` は defer）で、headless では 4 秒待ってもハートが装着されなかった。
  **これは今回の変更より前からの状態**（ハブでハートが出ていない可能性）。別件として要確認。
- `bash scripts/preflight.sh` ✅ **全49件成功**。
- WP1 の本番計測（push 後、`scripts/audit_a11y_browser.mjs` 本番モード）: タップ 0 / コントラスト 10 / 横スクロール 0。

## 2026-09-24 WP3: Sync Drive Images の 1MB 超 webp 再圧縮ガード

### 実施
- `.github/workflows/sync-drive-images.yml` の webp ダウンロード直後に、1,000,000 bytes 超を quality 80 → 72 → 65 で再圧縮するガードを追加。
- 画素サイズは維持し、quality 65 でも1MBを超える場合は警告を出して残す処理にした。
- 対象3枚を同じ品質低下処理で一度だけ再圧縮した。派生画像・寸法表・CMS・GAS は未変更。

### コミット
- **未実施（ユーザー指示により commit / push なし）**。

### 検証
- `python3 scripts/check_sync_retry.py`: **成功**（埋め込み Python の構文検査を含む）。
- `find LP/images -type f -size +1M`: **0件**。
- `git diff --check`: **成功**。
- `technogaoka.webp`: **1366KB → 949KB / 1920×2560（不変）**。
- `sawagi-festival-flyer.webp`: **1310KB → 961KB / 1920×2402（不変）**。
- `sawagi-festival-2026-flyer.webp`: **1310KB → 961KB / 1920×2402（不変）**。
- 実ブラウザ確認・preflight・Publish pipeline: **未実施（画像同期ワークフロー変更のため、公開前に別途必要）**。

### 変更したパターン
- webp ダウンロード直後のサイズ判定と品質段階再圧縮（`MAX_BYTES=1_000_000`）。
- 既存の `MAX_EDGE`、Pillow、webp 同期経路は変更なし。

### 未確認の類似パターン
- quality 65 でも1MBを超えるwebpの実Drive同期: **未確認**（現在のローカル画像は全件1MB未満）。
- 原本拡張子から生成する新規webpの変換経路: **確認済み・0件（今回変更なし）**。

### 次の担当への注意・判断待ち
- push 前に `bash scripts/preflight.sh` を実行すること。同期ワークフロー変更のため、公開前の実ブラウザ確認と同時に行うこと。

### 検証（Claude 側・2026-09-24 追記）
- YAML 差分をレビュー: ダウンロード直後に `MAX_BYTES` 判定 → quality 80/72/65 の段階再圧縮、
  画素サイズ維持、失敗時は警告のみ。`check_sync_retry.py` の構文検査も通過。
- 3枚とも quality 80 で 1MB を割った（949KB / 961KB / 961KB、画素不変）。
- 派生画像はファイル名に内容ハッシュを含むため `python3 scripts/build-image-derivatives.py` と
  `node scripts/build-image-dimensions.mjs` を再実行（`image-derivatives.js` v37 / `image-dimensions.js` v65、
  旧ハッシュの派生6枚を削除・新6枚を追加、記事の派生2枚も再生成で更新）。
- `bash scripts/preflight.sh` ✅ **全49件成功**。
- **次回の Sync Drive Images 実行で 3 枚が 1MB 未満のまま保たれるか（再圧縮ログが出るか）は未確認。**
  次に同期が走ったら Actions のログで `Recompressed (>1MB)` を確認すること。

## 2026-09-25 Publish 失敗（odyssey 記事の3比率画像）→ 恒久対策 M1/M2（Codex 実装 / Claude 検証）

### 実施
- 02:19 の Publish 失敗の原因: 記事OG用の3比率派生は `build-image-derivatives.py` が `data.js` の記事画像にだけ作り、
  それを走らせるのは Sync Drive Images だけだった。Publish が Sync より先に走ると派生が無く検査で止まる。
  過去30回の失敗16件を分類: 画像タイミング5 / CMS データ不整合5 / push 競合3 / ?v 2 / 外部API 1。
  設計: [docs/design/PUBLISH_RELIABILITY_2026-09-25.md](../docs/design/PUBLISH_RELIABILITY_2026-09-25.md)
- **M1**: `publish-pipeline.yml` に「Set up Pillow」「Build image derivatives & dimensions」を
  「Ensure referenced images exist」の直後・「Build detail pages」の前に追加。Publish が派生を自分で作る。
- **M2**: `sync-drive-images.yml` の concurrency を `pages` グループへ（schedule 時）。
  ⚠️ Publish が `gh workflow run` で起動する Sync（workflow_dispatch）まで同じグループにすると、
  Publish が席を持ったまま Sync が順番待ちになりデッドロックするため、dispatch だけ別グループ
  （`sync-drive-images-dispatch`）にした。「Commit generated output」の push 再試行 3→5回、待ち 5→15秒。
- 復旧: Sync を手動起動（odyssey の3比率生成。WP3 の 1MB ガードが本番で初めて動き
  `technogaoka 1366→949KB` / `spring-love-flyer 1015→849KB` を再圧縮）。
  `gh run rerun --failed` は古いコミットで走るため再失敗 → push 後に新規 run で確認する。

### コミット
- `ci(publish): Publish が派生画像を自分で作り、書き込むワークフローを直列化（Publish 信頼性 M1/M2）`

### 検証
- YAML ロード OK / `check_sync_retry.py` OK / `bash scripts/preflight.sh` ✅ 全49件成功。
- **Publish pipeline の実機実行: push 後に `gh workflow run` で流し、下に追記する。**

### 変更したパターン
- `.github/workflows/publish-pipeline.yml`（ステップ追加・再試行）、`.github/workflows/sync-drive-images.yml`（concurrency）。

### 未確認の類似パターン
- Deploy（`deploy-pages.yml`）の「sync generated LP before deploy」commit と Sync の競合: Deploy も `pages` グループなので直列化済み。
- M3（CMS 側の関門）/ M4（通知）/ M5（外部 API 検査の除外）: 未着手。

### 次の担当への注意・判断待ち
- Sync の schedule 実行は今後 Publish/Deploy と順番待ちになる（最大で数分遅れる）。

### 2026-09-25 追記: M1 実機確認 / M3・M4 実装（Codex）と検証（Claude）
- **M1 実機**: push 後に `gh workflow run "Publish pipeline"` → run `36087973307` **success**。
  「Build image derivatives & dimensions」136 秒、「Check structured data & AI surface」✅、生成物コミット ✅。
  odyssey 記事はこれで公開された。
- **M4**（`production-sync-watchdog.yml`）: 失敗ステップ名を title に、最初の ❌ 行と「次にやること」を本文に出す。
  yaml ロード OK。実際の失敗で本文が出るかは**次に失敗が起きたときに確認**（意図的に失敗させていない）。
- **M3**（`LP/cms.js` `publishSanityCheck`）: EDITIONS の FESTIVAL_ID 参照切れ／公開開催回が下書きフェスを参照、を押す前に止める。
  ⚠️ Codex 版は「STATUS が published のときだけ公開」と判定していた。実データは FESTIVALS 34 件が
  STATUS 空欄（fetch-data.mjs では空欄＝公開）で、そのままだと空欄フェスを指す開催回が全部
  「下書き参照」で止まり Publish 不能になるところだった。fetch-data.mjs の `isPublished` と同じ規則
  （published→公開 / draft・archived→非公開 / 空欄→公開）に直し、回帰テストを1件追加。
- 検証: `check_cms_publish_guard.mjs` 44件 ✅（参照ガード5件＋空欄1件を含む）、
  **実データ（festivals.json 95 / editions.json 114）を関門に通して ok** を確認、`node --check` ✅、
  `cms.js` v126→127、preflight ✅ 全49件。
- **未確認**: 認証済み CMS で Publish Now を実際に押す操作（実データは vm で通したが、ブラウザ上の実押下は未実施）。
  push 後に cms.html?cb= を headless で開き、JS 例外が無いことは確認する。
- **M3 本番確認（2026-09-25）**: Deploy `36089253912` success → その後ろに並んだ Publish pipeline `36089306630` **success**
  （M2 の直列化どおり順番待ちで実行）。本番 `cms.html?cb=` を headless で開き `cms.js?v=127` が配信され、
  ブラウザ上で `publishSanityCheck` に参照切れの擬似データを渡すと `ok:false` で止まることを確認。
  JS 例外はパスワード入力をキャンセルした `auth-failed` のみ（想定どおり）。認証済みでの実押下は未実施。
- **M4 の本文を実際の失敗 Run（36085808916）でローカル再現して確認（2026-09-25）**: title に失敗ステップ名、
  本文に ❌ 3行＋「次にやること」＋Run URL が1行で出る。Codex 版は `sed '\t'`（macOS で無効）と
  `paste -sd ' / '`（区切りが1文字ずつ循環）で本文が崩れていたため、`awk -F'\t'` と awk 連結に直した。
  Actions（ubuntu）でも同じ結果になる書き方。実際の失敗時の見た目は次回の失敗で最終確認。

## 2026-09-28 ハブの記事一覧がスーパーリロードしないと更新されない → sw.js 修正

### 実施
`LP/sw.js` の network-first 分岐に `data-hub.js` を追加（data.js と同じ扱い）、precache にも追加、
`VERSION` v1.14.0→v1.15.0。`scripts/check_sw_routing.mjs` に data-hub.js の検査を追加。
経緯と原因は [AUDIT §9-97](../AUDIT_TECHNO_JAPAN.md)。

### コミット
- `fix(sw): data-hub.js を network-first にし、ハブの記事一覧が古いまま残る問題を修正（§9-97）`

### 検証
- `check_sw_routing.mjs`: 修正前 `/data-hub.js?v=11 → cacheFirst ❌`、修正後 ✅。
- 実ブラウザ（headless Chrome、SW 登録済みプロファイル、ローカル配信で data-hub.js の中身を A→B→C）:
  旧 sw.js = 3回目に B（古い）／新 sw.js = C（最新）。
- `bash scripts/preflight.sh`: 下に追記。

### 変更したパターン
- sw.js の fetch 分岐（data.js と data-hub.js）。

### 未確認の類似パターン
- `?v` 固定で中身が変わる他のファイル: `VERSION_CHECK_EXEMPT` は data.js / data-hub.js の2つだけ（確認済み・他 0件）。
- 利用者のブラウザで新 SW が有効になるのは「デプロイ後 10 分（HTML の max-age）＋2回目の表示」。

### 次の担当への注意
- `VERSION_CHECK_EXEMPT` に足すときは sw.js の network-first と check_sw_routing に同時に足す（§9-97）。
- `bash scripts/preflight.sh`: 「記事フィード」だけ ❌（sitemap-news.xml に48時間を過ぎた odyssey が残っていた＝日付依存の生成物の古さで、今回の変更とは無関係）。`generate-sitemap.py` で再生成して同じコミットに含め、push 時の preflight で全件成功を確認。

## 2026-09-29 GA4/GSC 分析（2026-09-28）の施策 1〜5 を実装（Codex 実装 / Claude 検証）

### 実施
分析レポート: [reports/analytics/REPORT-2026-09-28.md](analytics/REPORT-2026-09-28.md)（GSC 3か月・28日、GA4 90日・28日の生データも同フォルダ）。
- **T1 ボット除外**: gtag 初期化の判定を `navigator.webdriver` だけから UA（`HeadlessChrome|Chrome-Lighthouse|Lighthouse|Speed Insights|PTST|GTmetrix`）
  まで広げた。テンプレート＋JA ハブ 7 枚の計 8 箇所を同一文字列に。GA4 の Direct 75%・0秒滞在 8 ページは Lighthouse CI の URL と一致していた。
- **T2 フェス title/description**: `{NAME} {YEAR}｜{都道府県}のテクノ・野外フェス 日程・出演者・チケット — TECHNO JAPAN`（EN は
  `— Dates, Lineup & Tickets | Techno Festival in {Pref}, Japan`）。60/70 字を超える名前は「検索語 → 種別」の順に削り地名は残す。
  description の先頭に「{開催日}、{会場}（{都道府県}）で開催。」。JSON-LD の description は変更なし。
- **T3 会場 title/description**: `{NAME}（渋谷）｜東京のクラブ アクセス・営業情報・イベント`。INFORMATION（住所・タイプ・公式・地図・Instagram）を
  説明文の上へ移動、Google マップの「地図」行を追加。
- **T4 フェス詳細ヒーロー**: 公式／チケット／Instagram のボタンを説明文の前へ（`.detail-actions` margin 16/24px）。
- **T5 JSON-LD**: 親 `Festival` ノードに `offers`（最新開催回の TICKETURL）。`check_jsonld.mjs` に「チケット URL があれば offers がある／無ければ無い」の検査を追加。
- Claude 側の追加修正: 地名の日本語表記マップ `PLACE_JA`（都道府県＋主要エリア。Codex 版は「Hokkaidoのテクノ・野外フェス」だった）、
  EN は Title Case、title の縮め順を「地名を最後まで残す」に変更。
- `detail.css` v40→41。

### コミット
- `feat(seo): 指名検索に応える title/description・概要の並び・GA4 ボット除外・Festival offers（分析タスク1〜5）`

### 検証
- 代表 title: `BIG FUN 2026｜北海道のテクノ・野外フェス 日程・出演者・チケット — TECHNO JAPAN`（53字）、
  `Re:birth Festival 2026｜長野のテクノ・野外フェス 日程・チケット — TECHNO JAPAN`（58字）、
  `MITSUKI（渋谷）｜東京のクラブ アクセス・営業情報・イベント — TECHNO JAPAN`（48字）。
  最大長: JA フェス 66 / EN フェス 80 / JA 会場 59 / EN 会場 75（長い固有名のみ。最終候補まで落ちる）。
- `offers` は 40/95 フェス（チケット URL のあるもの）。`check_jsonld.mjs` ✅。`check_festival_tracking.mjs` ✅。
- headless Chrome 393px でフェス（big-fun）と会場（mitsuki）を目視: ボタン→説明文、INFORMATION→説明文の順。
- `grep -c Chrome-Lighthouse` = 8 箇所すべて 1。
- preflight: 1回目は `?v` 上げ忘れ（detail.css）で ❌ → bump 後、push 時の pre-push で全件を再実行。

### 変更したパターン
- `scripts/build-detail-pages.mjs`（GA、festivalPage の title/desc/hero、venuePage の title/desc/並び、JSON-LD offers、PLACE_JA）、
  `scripts/check_jsonld.mjs`、`LP/detail.css`、JA ハブ 7 枚の GA スニペット、生成物 536 枚。

### 未確認の類似パターン
- アーティスト詳細の title（`{NAME}｜…`）は今回対象外。指名検索は `dj kensei` 44表示 13.7位 程度で優先度低。
- 記事の title は CMS 入力そのまま（対象外）。
- GA4 で実際にボットが消えたかは **翌日以降の Direct 比率で確認**（Lighthouse CI は次のデプロイで走る）。
- PLACE_JA に無い地名はそのまま英字で出る（現状の PREF/CITY/AREA は全件カバー）。

### 次の担当への注意・判断待ち
- title の形を変えたので、GSC の CTR は 2〜4 週間後に同じ `scripts` 手順（ブラウザ抽出）で前後比較する。
- T6（soundcamp カナ・artists ハブ定義文）、T7（抽出のスクリプト化）は未着手。

## 2026-09-29 B: カード画像を表示幅に合わせて配る（Codex 実装 / Claude 検証）

### 実施
EYESCREAM / Spincoaster との比較（[docs/design/BENCHMARK_EYESCREAM_SPINCOASTER_2026-09-29.md](../docs/design/BENCHMARK_EYESCREAM_SPINCOASTER_2026-09-29.md)）で、
**64px の枠に 960px の画像を送っていた**（artists.html のカード137枚）ことが実測で分かった。

- `build-image-derivatives.py`: 派生を `sm 480 / lg 960` の2枚 → **`xs 240 / sm 480 / md 720 / lg 960` の4枚**へ。
- `LP/localize.js`: `tjLazyBgAttr` が候補一覧を `data-bg-set` に持たせ、`tjApplyLazyBackgrounds` が
  **読み込む直前に要素の実寸 × dpr を測って1枚選ぶ**（`pickBySlot`）。
  背景画像のまま選べるので、HTML と CSS は1行も変えていない。
- `tjCardSrcsetAttr(value, sizes)` が sizes を引数で受けられるようにし、news.html の記事カードに実測値
  （`(max-width: 700px) 92vw, 664px`）を渡した。
- ⚠ `data-bg` 属性は残した（`check_hub_pages.py` が読んでいる）。`data-bg-set` は追加のみ。
- 2026-08-07 の「一覧ハブで srcset を使うな」というコメントは、原因が `sizes` の固定値だったと分かったので
  経緯を残したまま追記した。

### コミット
- `perf(images): カード画像を表示幅に合わせて配る（派生4サイズ＋実寸で選択）`

### 検証
**同じスクリプトで本番（変更前）とローカル（変更後）を計測:**

| ページ | モバイル dpr3 | PC dpr2 |
|---|---|---|
| **artists.html** | 1,198KB → **253KB（−79%）** | 1,198KB → **219KB（−82%）** |
| **venues.html** | 478KB → **176KB（−63%）** | 478KB → **176KB（−63%）** |
| index.html | 1,164KB → 1,080KB（−7%） | 1,118KB → 1,047KB（−6%） |
| news.html | 873KB → 875KB（±0） | 同左（srcset は dpr1 でのみ効く） |

選択の内訳（PC dpr2 の artists.html）: xs 30枚。モバイル dpr3 では xs 26 / sm 4。

`pickBySlot` の単体確認（実測スロットを入力）:
`64px×dpr3=192px → xs` / `130px×dpr3=390px → sm` / `345px×dpr2=690px → md` / `345px×dpr3=1035px → lg` / `664px×dpr2=1328px → lg`。

- `python3 scripts/check_image_derivatives.py` ✅（派生2,142枚・実体とサイズ宣言を確認）
- `node --check LP/localize.js` ✅ / `localize.js` v10→11
- `bash scripts/preflight.sh` ✅ **全49件成功**

### 変更したパターン
- 派生生成（4サイズ）、`tjLazyBgAttr` / `tjApplyLazyBackgrounds` / `tjCardSrcsetAttr`、news.html の記事カード。
- 派生画像 842 ファイル（新規 xs/md と再生成）。`LP/images/derivatives` は 55MB → 83MB。

### 未確認の類似パターン
- 詳細ページの画像（`heroSrcsetAttr` / `flyerSrcsetAttr`）は `<img srcset>` で別経路。今回は未変更。
- 記事本文の Google Drive 画像（1記事 1,898KB）は外部ドメインなので派生の対象外。**未対応**。
- `.fest-row-bg` はモバイルで必要 1,296px に対し lg 960px。装飾背景（低不透明度）なので今回は許容。

### 次の担当への注意
- 新しいスロットを足すときは `data-bg-set` が自動で効くので、`tjLazyBgAttr(url)` を size 引数**なし**で呼ぶこと。
  `tjLazyBgAttr(url,'sm')` のように固定すると選択が働かない（festivals.html の2箇所が現状これ）。

## 2026-09-29 A+C: フェス一覧に写真を出す／一覧の文字を読める大きさに（Codex 実装 / Claude 検証）

### 実施
**A（写真）**: フェス一覧の写真は `?visual=a` / `?visual=b` という URL パラメータの裏に隠れていた
（a はモバイルで `display:none`、b は `blur(18px) brightness(0.58)` で写真として見えない）。
**門を外して常時表示にし、変種を1種類へ統合**。
- PC: 行の右端に `clamp(180px, 20vw, 280px)`（従来 `clamp(120px,16vw,220px)`）
- モバイル（≤900px）: **行の上に全幅 16:9**（従来は 96px 枠で非表示）
- `tjLazyBgAttr(visualImage)` を **size 引数なし**で呼び、B で入れた実寸選択が効くようにした
- 変種 b（ぼかし背景）とそれ用の CSS・日付の大きい表示を削除。**採らない理由をコメントで残した**

**C（文字）**: 一覧カード・行の中で読む情報を 8〜10px → 10〜12px に。
festivals（日付/場所/状態 10→12、ラベル/タグ 8→10、件数・フィルタ 9〜10→11〜12、月ナビ 10/9→12/11）、
artists（city/count/genre-tab 9/10/9→11/12/11）、venues（city/genre 9→11、label 9→10、count/nav 10→12）、
news（sort-tab/feed-label/guide-label 10→12、cat-btn 9→11、**カード内メタ 9px×9 箇所→11px**）、
index（side-card-meta / fest-row-lineup / venue-mini-meta 等 8〜9→11）。

### コミット
- `feat(hubs): フェス一覧に写真を出し、一覧の文字を読める大きさにする（分析タスク A・C）`

### 検証
| ページ | 変更前 | 変更後 |
|---|---|---|
| フェス一覧 モバイル | **0.3 枚/画面** / 196KB | **1.5 枚/画面** / 1,813KB（写真 345×194） |
| フェス一覧 PC | 0.6 枚/画面 | **3.1 枚/画面**（写真 280×111） |
| artists.html モバイル | — | 1.9 枚/画面 / 945KB |
| venues.html モバイル | — | 2.8 枚/画面 / 854KB |

**★ Claude が見つけて直したバグ**: PC で**写真をクリックしても詳細ページへ遷移しなかった**。
`.festival-row-grid`（z-index:2）が `padding-right` で写真ぶんを空けていたため、padding は要素の内側にあり
**当たり判定が写真の上まで伸びて**、その下の行リンク（`.festival-card-link` / z-index:1）に届いていなかった。
`width: calc(100% - 写真幅 - 24px)` で手前に止めて解決。理由を CSS にコメントで残した。
実クリック検証: **1440px ✅ / 1024px ✅ / 393px ✅**（3幅とも `/festivals/synapse-festival.html` へ遷移）。

- 横スクロール 0 / 5ハブとも。JA・EN の行数一致（6枚）。EN 側に `visual=` の残りは 0。
- `bash scripts/preflight.sh` ✅ **全49件成功**。
- 重さの位置づけ: フェス一覧 1.8MB は、Spincoaster 15.2MB・EYESCREAM 33.9MB に対して **1/8 以下**（§9-98 の訂正値）。

### 変更したパターン
- `LP/festivals.html`（写真の常時表示・CSS 統合・文字）、`LP/artists.html` `LP/venues.html` `LP/news.html` `LP/index.html`（文字）。
- EN ハブ5枚は `enHubFromJa` で再生成。

### 未確認の類似パターン
- **`verify_ac.mjs` の PC リンク判定は当てにならない**（`scrollIntoView` で要素が画面外に出るため常に ✗ と出る）。
  リンクの確認は `click2.mjs`（実際にマウスイベントを送る方）を使うこと。
- フェス一覧の写真は 12 枚しか読み込まれない（フィルタで非表示の行は IntersectionObserver が発火しない）。仕様どおり。
- 記事本文の Drive 画像（1記事 1,898KB）は未対応のまま。
- 本番反映後の実機 Safari 操作: **未確認**。

### 次の担当への注意
- `.festival-row-grid` の幅を `padding-right` に戻さないこと（リンクが死ぬ）。CSS にコメントあり。
- `tjLazyBgAttr` に `'sm'` 等を渡すと実寸選択が無効になる。新しい写真枠では引数なしで呼ぶ。

## 2026-09-29 記事本文の Drive 画像を WebP で受け取る（−40%）

### 実施
記事本文の画像は Google Drive（lh3.googleusercontent.com）配信で、srcset は付いていたが **JPEG のまま**だった。
URL に `-rw` を足すと同じ画素サイズのまま WebP で返る。`scripts/build-detail-pages.mjs` の
`addDriveImageSrcset` で srcset 候補と src の両方に `-rw` を付けた（`DRIVE_WEBP` 定数）。

**選定の根拠（1枚 1200×800 で実測）**:
| | 容量 | 形式 |
|---|---|---|
| `=w1200` | 357KB | JPEG |
| `=w1200-rw` | **242KB（−32%）** | WebP・画素は同じ 1200×800 |
| `=w1200-rw-v1` | 175KB（−51%） | WebP だが **PSNR 31.8dB で劣化が見える → 採用せず** |

⚠️ `-rw` は Accept に `image/webp` が無いクライアントにも WebP を返す（実測で確認）。
ただし**このサイトは自前画像を全て .webp で配っており既に WebP 必須**なので、新たな互換性リスクは無い。

### コミット
- `perf(articles): 記事本文の Drive 画像を WebP で受け取る（−40%）`

### 検証
本番（変更前）とローカル（変更後）を同じスクリプトで計測（`articles/synapse-2026-info.html`）:

| | Drive 画像 8枚 | 形式 |
|---|---|---|
| モバイル dpr3 | 1,896KB → **1,146KB（−40%）** | jpeg → webp |
| モバイル dpr2 | 997KB → **613KB（−39%）** | jpeg → webp |
| PC dpr2 | 1,895KB → **1,146KB（−40%）** | jpeg → webp |

- **8枚すべて表示できている**（`naturalWidth>0` を確認）。
- 全記事 832 件の Drive URL に `-rw` が付き、付いていないものは 0 件。
- `scripts/check_article_links.mjs` の検査が `=w\d+` の直後に空白を期待していて全件不正になったため、
  **接尾辞を許す正規表現に修正**（理由をコメントで残した）。
- `bash scripts/preflight.sh` ✅ **全49件成功**（「大きい画像の配信」も ✅）。
- ローカル計測のページ全体（2,025KB）は本番より大きく出る。**ローカルサーバが gzip しないため**で、
  本番では 2,424KB → 約 1,674KB になる見込み。push 後に本番で確認する。

### 変更したパターン
- `scripts/build-detail-pages.mjs` の `addDriveImageSrcset`、`scripts/check_article_links.mjs` の検査、記事28枚の再生成。

### 未確認の類似パターン
- CMS（`LP/cms.js:6996`）は Drive URL を `=w{幅}` に正規化しており `-rw` を付けない。
  **CMS のプレビューは JPEG のまま**だが、公開ページは生成時に付くので実害なし。
- OGP 画像・hero が Drive を指す記事があれば同様に JPEG のまま。今回は本文画像のみ。

### 次の担当への注意
- `-rw-v1` は容量が半分になるが画質が落ちる（PSNR 31.8dB）。使わないこと。理由は `DRIVE_WEBP` のコメントに記載。

## 2026-09-29 G: 背景に微細なグレインを乗せる

### 実施
`#080808` のベタ塗りは画面がのっぺり見える。Spincoaster が背景にノイズを乗せて紙っぽい質感を出していたので採り入れた。
既存の背景レイヤー `.tj-bg`（グリッド＋赤いグロー＋スキャンライン）に、SVG `feTurbulence` の data URI を
`background-image` として足した。**画像ファイルを増やさない**ので、画像の実在検査・寸法表・Drive 同期の経路に影響しない。

### 濃さの決め方（実測）
120×120 のタイルを #080808 の上に敷き、輝度を測って選んだ:

| rect の opacity | 平均輝度 | 範囲 | ばらつき |
|---|---|---|---|
| 0.03 | 10.9 | 8–14 | 0.8（ほぼ見えない） |
| **0.05（採用）** | **12.8** | 9–18 | **1.3** |
| 0.07 | 14.6 | 9–21 | 1.7 |
| 0.14 | 20.5 | 10–34 | 3.1（黒でなくなる） |
| 0.55（最初の実装） | 57.1 | 15–111 | 12.7（**背景がグレーに化けた**） |

- 実ページ（festivals.html PC）で暗部の平均 8.2 → 13.0、ばらつき 1.2 → 1.7。
- グレインは **z-index:0 でコンテンツより下**なので文字には重ならない。
  コントラストへの影響は 17.1:1 → 16.6:1 で無視できる（2026-09-24 の改善を打ち消さない）。
- `common.css` v31→32。

### コミット
- `style(bg): 背景に微細なグレインを乗せる（ベンチマーク G）`

### 検証
- 変更前後を同じ位置で切り出して比較（スクリーンショット）。グリッド線・赤いグローは従来どおり残る。
- `bash scripts/preflight.sh` ✅ 全49件成功。

### 未確認の類似パターン
- `.tj-bg` が無いページ（`about.html` / 会場詳細 / アーティスト詳細）にはグレインが出ない。
  `backgroundLayer: true` は記事とフェス詳細だけ。**揃えるかは要判断**（今回は既存の適用範囲を変えていない）。

### F（クレジット行と音源埋め込み）について — データ不足で見送り
- **`Photo by`**: ARTICLES に撮影者の列が無い（`author` のみ・14記事すべて入力済み）。
  記事上部に `WORDS BY {author}` が既にあるので、下部に足しても情報は増えない。
  やるなら**スプレッドシートに PHOTOGRAPHER 列を足す**ところから（ユーザー作業）。
- **音源埋め込み**: SoundCloud リンクがあるのは **ARTISTS 137件中 22件**。フェスには音源データが無い（`url` と `instagram` のみ）。
  加えて CSP の `frame-src` に `w.soundcloud.com` を足す必要がある。
  アーティスト詳細は流入が少ないため、**費用対効果が低いと判断して見送った**。

## 2026-10-07 外部画像の一時エラーでデプロイが止まるのを直す

### 経緯（GitHub のエラー3件を調べた結果）
1. **10-06 09:45 Deploy 失敗** → `GitHub Actions has encountered an internal error`。GitHub 側の内部エラーで
   ジョブが cancelled。表示上は「会場の地図の検査」で止まっているが、その検査が落ちたのではない。
2. **10-06 07:07 Production sync watchdog 失敗** → 「Publish pipeline の最新が failure」と **9/15 の古い run** を指していた。
   実際の最新は 10/1 の success。同じ API を叩き直すと正しく返る。**GitHub API が一瞬だけ古い一覧を返した**。
   監視コード（作成日時の降順で先頭）は正しい。以降の watchdog（14:20 / 19:39 / 23:31）はすべて success。
3. **再実行したら別の場所で失敗** → `外部画像を取得できません (500): lh3.googleusercontent.com/d/14zeL4…=w2000`。
   その URL をいま叩くと **5回とも 200**（714,515 bytes）。Google 側の一時的な 500。

### 本番への影響
本番は 10-05 版のままだった（`asia-festival-2026-second.html` の md5 で確認）。
未反映だったコミット `7d98392b` の中身を全部調べた結果:
- 記事1本（日英）: イベントカード1つに `is-past` が付くだけ
- `rss.xml`: `lastBuildDate` / `pubDate` のみ
- `sitemap.xml`: 1,104行の差に見えるが **URL 一覧は完全に同一**（`lastmod` のみ）

→ **読者に見える違いは「過ぎたイベント1件の表示」だけ**だった。

### 実施（構造的な弱さの修正）
`scripts/build-image-dimensions.mjs` は `data.js` の外部画像 **112 件を毎ビルド直列に、再試行なしで**取得し、
1件でも失敗するとデプロイ全体を止めていた。**しかも失敗した画像の寸法は `image-dimensions.json` に
既に記録されていた**（`[1920, 1440]`）。

- **3回まで再試行**（1s → 3s → 6s。`sync-drive-images.yml` の埋め込み Python と回数を揃えた）
- それでも取れなければ **前回記録した寸法に退避**し `::warning::` を出す。件数をログに1行出す
- **初めて見る画像が取れないときだけ throw**。「取得不能時に黙って属性を欠落させるとB3が再発する」という
  元のコメントの意図（寸法を欠落させない）は維持した

### コミット
- `fix(build): 外部画像の一時エラーでデプロイが止まらないようにする`

### 検証
全通信を 503 に差し替えたコピーで、出力先を一時ファイルに逃がして実測:

| 条件 | 期待 | 実測 |
|---|---|---|
| 前回値あり（本物の image-dimensions.json） | 退避して続行 | `::warning::…前回の寸法 1920x1080 を使います` / **終了コード 0** |
| 前回値なし（空の JSON） | 停止 | `外部画像を取得できません（3回試行）` / **終了コード 1** |

- `node --check` ✅ / 本番データで `node scripts/build-image-dimensions.mjs` 正常（2,308枚・外部112件）
- `bash scripts/preflight.sh` ✅ **全49件成功**

### 未確認の類似パターン
- **外部画像 112 件を毎ビルド直列に取得する構造自体は変えていない**（毎回 約50MB をダウンロードしている）。
  並列化や「既知URLは取得しない」最適化は今回の範囲外。Drive 上で画像が差し替えられたとき寸法が
  古いままになるのを避けるため、取得そのものは残している。
- 同じ「外部に毎回取りに行く」経路が他にあるか: `check_image_delivery.mjs` は実体を取るが preflight 専用で
  デプロイは止めない。**確認済み・デプロイを止める経路は今回の1箇所のみ。**

### 次の担当への注意
- デプロイが外部画像の取得で落ちたら、まずその URL を `curl -o /dev/null -w "%{http_code}"` で叩く。
  200 が返るなら一時エラーなので再実行でよい。今回の修正で、既知の画像なら再実行すら不要になった。

## 2026-10-07 タスク6b: アーティスト一覧の冒頭に定義文を置く

### 実施
Search Console 3か月で `japanese techno artists` が **表示82回・クリック0・8.5位**。
8位に出ているのに1件もクリックされていなかった。ページ冒頭が `<h1>ARTISTS</h1>` と
`DJS · PRODUCERS · SELECTORS` だけで、何の一覧なのかが検索結果にも AI にも伝わっていなかった。

`LP/artists.html` の `<header class="page-header">` 直下に、日英の定義文を**静的 HTML で両方**置いた。
表示の切り替えと件数の差し込みだけを JS が行う。

- **両方を静的に置いた理由**: AI 系のクローラは JS を実行しないものが多い。`tjLocalized` で実行時に
  組み立てると、静的な HTML に文が1つも存在しなくなる。
- **件数（137）は HTML に書かない**。データが変われば嘘になるため、JS が差し込む。
  取れなかった場合も静的な文のまま意味が通る書き方にしてある。
- 文中のジャンル名は data.js に実在するものだけ（TECHNO 16 / HOUSE 12 / LIVE 5 / MINIMAL 1 ほか）。
  「アンビエント」等は書いていない（事実主義）。

### コミット
- `feat(seo): アーティスト一覧の冒頭に定義文を置く（分析タスク6b）`

### 検証
- 実ブラウザ（PC 1440 / モバイル 393）で JA・EN 両方を確認。
  JA は日本語文、EN は英文のみ表示（`shownLang` が `["ja"]` / `["en"]`）。件数 137 が入る。
- JA/EN の行数一致（918）。横スクロール 0。文字 13px / モバイル 12px。
- `bash scripts/preflight.sh` ✅ **全49件成功**。

**★ Claude が見つけて直したレイアウト崩れ（2回）**
1. Codex 版は `<div class="page-header-inner">`（横並び flex）の**中**に段落を入れていた。
   PC で見出し・サブタイトルと同じ行に**3列目として並んだ**（実測 x=852）。
2. `flex: 0 0 100%` を付けても直らなかった。**`max-width: 62ch` が hypothetical main size を
   抑えるため折り返しが起きない**（実測 x=852 のまま）。
   → 段落を `page-header-inner` の**外**（`<header>` 直下）へ移して解決。理由を CSS にコメントで残した。

### 変更したパターン
- `LP/artists.html` のみ（EN は `enHubFromJa` が再生成）。

### 未確認の類似パターン
- 同じ定義文を `festivals.html` / `venues.html` / `news.html` にも置くかは**未判断**。
  今回は実測で CTR 0% が出ていた artists.html のみに絞った。
- `.page-header-inner` を使う他のハブで同じ入れ子の罠がある。段落を足すときは header 直下に置くこと。

### タスク6a（soundcamp のカナ表記）— データ側の作業なので未実施
GSC を調べ直したところ、**当初の想定と違っていた**:

| クエリ | ページ | 表示 | クリック | 順位 |
|---|---|---|---|---|
| `サウンドキャンプ` | **/festivals/forest-sound-camp.html** | **107** | 0 | 8.2 |
| `サウンドキャンプ` | /festivals/colors-presents-soundcamp.html | 24 | 0 | 7.9 |

当初レポートは colors 側の施策と書いていたが、**表示の大半は FOREST SOUND CAMP**だった。

**サイト全体でカナ「サウンドキャンプ」は1箇所も書かれていない**（name / desc / 記事本文すべて 0 件）。
AGENTS.md「スプレッドシート『LP』が唯一のデータソース。コードにデータをハードコードしない」に従い、
**コード側では対応しない**。ユーザー作業として依頼済み（FESTIVALS の DESC 冒頭にカナを1語入れる）。

## 2026-10-07 タスク7: GA4 / Search Console の抽出を1コマンドにする

### 実施
`scripts/audit_analytics.mjs` を新設。2026-09-28 の分析はブラウザを手で動かして GSC 6表・GA4 5表を
取得していた。毎月やるには手数が多すぎるので1コマンドにした。

```
node scripts/audit_analytics.mjs                 # GSC + GA4
node scripts/audit_analytics.mjs --gsc           # GSC だけ
node scripts/audit_analytics.mjs --ga4           # GA4 だけ
node scripts/audit_analytics.mjs --range=28d     # 3m / 28d / 7d
node scripts/audit_analytics.mjs --login         # 画面付きでログイン
```

- 出力は `reports/analytics/<実行日>/` に CSV + JSON + `summary.md`。
  summary には各表の行数と GSC 合計（クリック / 表示 / CTR / 掲載順位）、**前回実行との比較**が入る。
- ログイン済み Chrome プロファイルは **`~/.cache/techno-japan/analytics-profile`**。
  認証クッキーを含むのでリポジトリには入れない。切れたら `--login`。
- **preflight からは呼ばない**（ログインと外部ネットワークが要る）。依存パッケージも増やしていない。

### コミット
- `feat(analytics): GA4 / Search Console の抽出を1コマンドにする（分析タスク7）`

### 検証（実データで動かして確認）
```
GSC 28d query: 478行 / 合計 クリック438 表示9680      GA4 28d all-pages-and-screens: 101行
GSC 28d page: 263行                                   GA4 28d landing-page: 124行
GSC 28d country: 109行 / device: 3行 / date: 28行      GA4 28d top-events: 13行 ほか
```
CSV と JSON の行数一致（111 行）を確認。`bash scripts/preflight.sh` ✅ 全49件成功。

### ★ Claude が見つけて直した不具合（4件）
1. **合計が全部 `-`**: `new RegExp('…\\s…')` の書き方だとテンプレートリテラル経由で
   エスケープが1段落ち、`\s` が文字の `s` になっていた。正規表現リテラルに変更。
2. **`SyntaxError: Invalid regular expression: missing /`**: 素のテンプレートリテラルでは
   `\n` が**実際の改行**になり、正規表現リテラルが行をまたいで壊れる。
   → **ブラウザへ送るコードはすべて `String.raw` で囲む**ことにした（ファイル冒頭と各所にコメント）。
3. **GA4 が10行しか取れない**: ビューポート未設定で headless 既定の 800×600 になっており、
   行数セレクタ（y=664）が**画面外**で CDP のクリックがどこにも当たっていなかった。
   1440×1600 を明示し、クリック前に `scrollIntoView` して座標を取り直すようにした。**11行 → 109行**。
4. **CSV のセルに改行が混入**: GA4 の列名はセル内で改行している。空白に潰す修正を入れたが、
   その修正自体が 2 と同じ罠（`String.raw` でない）に嵌まり `/s+/g`（文字の s）になっていた。
   `String.raw` 化して解消。**同じ罠を2回踏んだので、ファイル全体を機械的に点検する手順を残した**:
   `String.raw` でないテンプレートリテラルにバックスラッシュが含まれていないか grep する。

### 変更したパターン
- 新規 `scripts/audit_analytics.mjs` のみ。既存ファイルは一切触っていない（preflight も未変更）。
- 初回の出力 `reports/analytics/2026-10-07/` をコミットに含めた（次回の前回比の基準になる）。

### 未確認の類似パターン
- `--login` の画面付き起動は**未実行**（既存のログイン済みプロファイルを流用したため）。
  次にログインが切れたときに初めて通る経路。
- GA4 のレポートIDは UI 由来。Google の画面変更で 404 になりうる。そのときは画面から辿り直す
  （`lifecycle-events` / `lifecycle-landing-page` は既に 404 になることを確認済みで、使っていない）。
- GSC の「クエリ×ページ」の掛け合わせ（どのページがどのクエリで出ているか）は未対応。
  今回は query と page を別々に取っている。

### 次の担当への注意
- **ブラウザへ送るコードを書くときは必ず `String.raw` を使うこと。** 2回踏んだ。
  `evaluate(ws, \`…\`)` と書いた時点で `\s` `\d` `\n` が壊れる。
- 月次の使い方: `node scripts/audit_analytics.mjs --range=28d` を月初に実行し、
  `reports/analytics/<日付>/summary.md` の前回比を見る。

## 2026-10-07 Ocult Mag ベンチマーク（設計のみ・実装は未着手）

### 実施
ユーザー指示で https://ocultmag.com/ を TOP・記事（PC/スマホ）で Techno Japan と同条件で計測し、
`docs/design/BENCHMARK_OCULT_2026-10-07.md` に設計 WP-A〜D を書いた。Artifact にスクショを並べて提示。

### コミット
- `docs(design): Ocult Mag ベンチマークと適用設計 WP-A〜D`

### 検証
- 計測は headless Chrome（PC 1440 / スマホ 393、dpr 1/2）。自サイトは `Network.setBypassServiceWorker`。
- 主要数値: TOP 1画面目のリンク Ocult 33 / TJ 6（スマホ 19 / 3）、TOP の写真 27 / 1、
  記事末尾30%のリンク 62 / 6、記事の写真幅 Ocult 2種（100% / 50-50）/ TJ 3種（93 / 52 / 34%）。
- 本番サイトには何も変更していない。

### 変更したパターン
- なし（文書と handoff のみ）。

### 未確認の類似パターン
- Ocult の「The weekend guide」は埋め込みが空のまま計測された（iframe 未読込の可能性）。本物の中身は未確認。
- 記事は1本（Hahoe）だけで測った。Ocult の他カテゴリの記事型は未確認。
- ONDO LAND 記事で excerpt と本文1段落目が同一（公開15本中1本）。生成側ガードは WP-A に含めた、未実装。

### 次の担当への注意・判断待ち
- **ユーザーの承認待ち**。WP-A（記事の頭・写真幅）→ B（TOP 1画面目）→ C（記事末尾）→ D（カード統一・告知バー）の順を提案。
- 各 WP の前後を同じ probe（scratchpad `ocult/probe.mjs`。リンク数・写真数・最初の写真の y・本文幅）で測って並べること。

## 2026-10-07 WP-A（記事の頭・写真幅）をテスト環境で実装 → ユーザー判断で全て破棄

### 実施
- ユーザー要望「まずテスト環境で」に応え、`git worktree`（別フォルダ `techno-japan-preview`、ブランチ `design/ocult-wp-a`）＋
  `scripts/serve_local.py`（port 8090、LAN で `http://192.168.10.121:8090`）でテスト環境を作った。本番・main は無変更。
- WP-A を実装し、実ブラウザ（PC 1440 / スマホ 393、JA / EN）で確認、preflight 全49件成功まで持っていった。
- ユーザーが実物を見て **「全て戻す。今回のは微妙だな」** → worktree とブランチを削除。**コミットもしていない。**

### コミット
- `docs(design): WP-A を試作し却下された経緯を記録` （文書と handoff のみ）

### 検証
- 破棄後: `git worktree list` は main のみ、`git status` クリーン、main は `36a0462c`（本番と同一）。

### 変更したパターン
- なし。本番サイト・CMS・GAS すべて無変更。

### 未確認の類似パターン
- なし（実装は破棄済み）。

### 次の担当への注意・判断待ち
- **やってみて分かった事実**（次に記事レイアウトを触る人へ）:
  1. 本文画像112枚のうち90枚に CMS の `data-layout`（compact 71 / contained 14 / left・right 4）が付いている。
     article-fx.js の「自動リズム」はほとんど使われておらず、**幅は実質 CMS の指定で決まっている**。
     幅の型を変えるなら CMS の選択肢ごと設計しないと効かない。
  2. ヒーローを本文幅（680）より広く抜くと、派生画像（最大 960w）ではぼやける。原寸を足すと dpr3 スマホが原寸を取るので
     `<picture media="(min-width: 900px)">` で PC だけに限定する必要がある（実測: PC 140→549KB、スマホ 140KB 据え置き）。
  3. preflight を**他のブラウザ検査と同時に回すと**、venues の Leaflet 初期化とモバイル言語切替（2/24）が落ちる。
     単独で回すと通る。落ちたら先に「同時に Chrome を動かしていないか」を疑う。
  4. テスト環境の作り方（worktree + serve_local.py）は使える。次回の UI 変更もこの手順で先に見せる。
- WP-B〜D は未着手・保留。ユーザーの再指示があるまで進めない。

## 2026-10-09 記事見出しの日本語折り返し（「クロージン｜グ」で割れる → 文節／読点で折る）

### 実施
- ユーザー指摘: 記事 h2「ふたつの顔、初のクロージング、そして10年ぶりの帰還。」が「クロージン／グ」で折れて「AIっぽい」。
- `LP/detail.css`: `.article-body h2 / h3`、`.article-detail h1`、`.article-hero-overlay h1` に
  `word-break: keep-all; word-break: auto-phrase; overflow-wrap: anywhere;` を追加。h1 は `text-wrap: balance` も追加。
  `.article-hero-overlay h1` の `word-break: break-word` は差し替え（後勝ちで h1 に効かなかった）。
- `LP/cms.css`: プレビュー／エディタの h2, h3 に同じ3指定（4箇所）。`LP/cms.html` の `cms.css?v=39 → 40`。
- `scripts/build-detail-pages.mjs`: `DETAIL_CSS_VERSION 41 → 42`。詳細ページ 540 枚を再生成（差分は `?v` の1行のみ）。
- 経緯・実測・設計理由は `AUDIT_TECHNO_JAPAN.md` §9-99。

### コミュニケーション
- 本番には**まだ出していない**（push していない）。LAN テスト環境 `http://192.168.10.121:8090/articles/otsukimi-2026-info.html`
  （`PORT=8090 python3 scripts/serve_local.py`、このセッションで起動中）でスマホ実機から確認できる。

### 検証
- `bash scripts/preflight.sh` **全49件成功**（2026-10-09、単独実行）。
- 実ブラウザ相当（headless Chrome + CDP で幅を模擬。実記事 `otsukimi-2026-info.html` のコピーに見出しを差し替え）:
  - PC 1280px: h2 → 「ふたつの顔、初のクロージング、／そして10年ぶりの帰還。」 h1 → 「御月民 OTSUKIMI 2026／満月の夜に始まる、／北アルプスの麓の3日間」
  - スマホ 390px（dpr2）: h2 → 「ふたつの顔、初の／クロージング、そして／10年ぶりの帰還。」 横スクロール無し（scrollWidth=390）
  - 英語見出し「Behind the Decks: A Night at WOMB」: 変化なし（1行）
  - JA / EN ハブの行数: 5枚とも一致（index 1199 / festivals 1448 / artists 918 / venues 1104 / news 1382）
- 変更前の画像も同じ方法で撮って並べた（PC: クロージン／グ、始／まる で割れていたことを確認）。

### 変更したパターン
- 記事詳細（JA / EN）の h1・本文 h2・本文 h3 の折り返し。EN は英字なので挙動不変。
- CMS の記事プレビュー（`.ar-prev-body`）と本文エディタ（`.ql-editor`）の h2・h3。

### 未確認の類似パターン
- **CMS プレビューは実機未確認**（認証が要る）。cms.css の値は detail.css と同じにしたが、CMS を開いて記事プレビューで
  見出しの折れ方が変わったことは見ていない。確認時は `?cb=<乱数>` を付け、Cmd+Shift+R。
- `LP/cms.js` の「新しい窓でプレビュー」（`document.write` 内）は `/detail.css?v=36` を参照している（今回触っていない）。
  max-age=600 なので 10 分後には新しい CSS になるはずだが、古いまま見えたらこれが原因。cms.js を触る場合は Publish 経路の規則に従う。
- Safari / Firefox は `auto-phrase` 未対応で keep-all（読点でだけ折る）になる。読点無しの長い見出しは
  これまで通り文字単位で折れる（悪化はしない）。実機 Safari では未確認。
- ハブ（news.html 等）のカード見出しは対象外。同じ指摘が出たら同じ3指定で対応できる。

### 次の担当への注意・判断待ち
- **push するかはユーザー判断**。push すれば deploy-pages.yml で本番に出る。
- headless Chrome で `--window-size=390` を使っても幅は 390 にならない（本文が右に切れる絵になる。本番は壊れていない）。
  スマホ幅は `scripts/check_mobile_language_toggles.mjs` 方式（CDP `Emulation.setDeviceMetricsOverride`）で模擬すること。
- 記事の article-fx（スクロール演出）は画面外の要素を透明にするので、スクリーンショット前に無効化が要る。

## 2026-10-09 Lighthouse CI が落ちている原因（調査のみ・未修正）

### 実施
- 失敗はすべて **artists.html の CLS 0.155（上限 0.05）**。10/7 02:33 以降ほぼ毎回落ちている（10/9 02:36 の成功は、初回描画が 2.4 秒と遅く
  全部まとめて描かれたための偶然）。他7ページと a11y / BP / SEO は合格。
- 動いている要素は `#artists-grid`（カード一覧）。Lighthouse 報告書3本（10/7 02:07 変更前 / 10/7 03:19 / 10/9 10:08）を並べると、
  **同じガタつきは変更前から 0.018 で存在**し、10/7 の `f45dfae8`「アーティスト一覧の冒頭に定義文を置く」で一覧が 80px 下がった後に 0.155 へ拡大した。
- 仕組みは festivals.html が 8/19 に直したものと同じ（`e8f21068`）: **JS 無しでも見える静的リンク一覧（`.ssr-link-list`、137件）を
  カード一覧に差し替える瞬間が CLS として記録される**。festivals.html は `html.tj-festivals-hydrating` で差し替え完了まで
  一覧を `visibility:hidden` + `min-height` 確保にしているが、**artists.html にはこの保護が無い**（venues / news も無いが Lighthouse の対象外）。
- 手元の Mac では再現しない（JS 無し→有りで一覧は 30px しか動かず、layout-shift も 0 件）。CI の Linux ランナーでだけ 150〜220px 相当になる。
  Linux 側で何が差を生むかまでは特定していない（フォントの違いを疑ったが、Web フォント遮断でも Mac は 25px）。

### コミット
- なし（調査のみ）。この handoff 追記のみ。

### 検証
- `gh run view --log` で 4 run の assertion を比較、報告書 HTML から LHR JSON を取り出して `layout-shifts` / `fullPageScreenshot` の矩形を比較。
- 手元: CDP で JS 有無・Web フォント遮断の4条件で一覧の位置を実測（545→575 / 538→563）。`npx lighthouse@12` 本番計測は CLS 0。

### 変更したパターン
- なし。

### 未確認の類似パターン
- `LP/venues.html` / `LP/news.html` / `LP/en/*.html` の各ハブも静的リンク一覧→カード差し替えの構造が同じで保護が無い（Lighthouse 対象外のため赤くはならない）。

### 次の担当への注意・判断待ち
- **修正案（ユーザー判断待ち、実装は Codex）**: festivals.html と同じ保護を artists.html（JA/EN）に入れる。
  head 先頭で `html.tj-artists-hydrating` を付け、`#artists-list-view`（または `#artists-grid`）を `visibility:hidden; min-height` にし、
  `.ssr-link-list` を `display:none`、`renderArtistsList()` 完了後にクラスを外す。EN は `enHubFromJa` で生成されるので JA だけ直せばよい。
- 直したら Lighthouse は `gh workflow run lighthouse.yml` で手動実行して確認する（CI の Linux でしか再現しないため、手元の緑は証明にならない）。
- 10/9 02:36 のように遅い回は偶然通る。1回の緑で直ったと判断しないこと。

## 2026-10-09 artists.html のハイドレーション保護（Lighthouse CI の CLS 0.155 を止める）

### 実施
- 上の調査エントリの修正案を実装（**実装は Codex**、設計書は scratchpad の design-artists-cls.md、レビュー・検証・git は Claude）。
- `LP/artists.html`: head で `html.tj-artists-hydrating` を付与、CSS で `#artists-list-view` を `visibility:hidden; min-height:calc(100vh - 420px)`、
  `#artists-grid > .ssr-link-list` を `display:none`、INIT の `renderArtistsList()` を `try/finally` で包んでクラスを外す。festivals.html（`e8f21068`）と同じ型。
- `LP/en/artists.html` は `build-detail-pages.mjs` で再生成（JA/EN とも 932 行）。
- 経緯・原因・調べ方は `AUDIT_TECHNO_JAPAN.md` §9-100。

### コミット
- このエントリを含むコミット（artists.html JA/EN、AUDIT、handoff）。

### 検証
- `bash scripts/preflight.sh` 全49件成功（2026-10-09、単独実行）。
- headless Chrome（CDP、412px / 1280px）で `http://localhost:8090/artists.html` と `/en/artists.html`:
  - JS 無し: 保護クラス無し、`#artists-list-view` visible、静的一覧（.ssr-link-list）が display:grid で表示（従来どおり）
  - JS 有り: カード 137 件、保護クラスは外れている、main visible。PC 1280 のスクリーンショットで一覧が描けていることを確認。
- **CI の Lighthouse は push 後の自動実行（deploy 成功 → workflow_run）で確認する。手元では CLS が再現しないため、手元の緑は根拠にしない。**
- **→ 結果（2026-10-09 11:16 UTC、run 37922698849）: 成功。** artists.html の CLS **0**（修正前 0.155）、ガタつきの記録 0 件。
  初回描画 121ms / DCL 225ms と、失敗していた回（150ms / 275ms）と同じ「先に描いてから差し替える」条件での 0 なので、偶然の緑ではない。
  性能 0.76 → 0.82、a11y / BP / SEO は 1.0。

### 変更したパターン
- artists ハブ（JA/EN）の初期描画: 静的一覧→カードの差し替え中は main を非表示＋高さ確保。

### 未確認の類似パターン
- venues.html / news.html / index.html は同じ構造で保護無し（Lighthouse 対象外）。今回は触っていない。
- 実機スマホでの見え方（ちらつきの有無）は未確認。festivals で 8/19 から同じ型が動いているので同等と判断。

### 次の担当への注意・判断待ち
- push 後の Lighthouse CI の結果を見る。1回の緑で判断せず、次のデプロイ後の回も見る（10/9 02:36 のような偶然の緑がある）。
- もし CI でまだ CLS が出るなら、Linux 側の差（未特定）を疑う前に、`fullPageScreenshot.nodes` で動いた要素を再確認する。

## 2026-10-09 記事本文に「アーティストカード」`[[artist-card:ID]]` を追加（記事ブロック 第1フェーズ）

### 実施
- 設計 `docs/design/ARTICLE_BLOCKS_2026-10-09.md` §2-1 を実装（**実装は Codex、設計・レビュー・検証・git は Claude**。設計書は scratchpad の design-artist-card.md、追加指示 6 回）。
- `LP/article-shortcodes.js`: `[[artist-card:ID|一言]]` の解析・描画（`renderArtistCard`）。ARTISTS に無い ID は throw。英語の経歴は単語境界で 140 字に切る。
- `scripts/build-detail-pages.mjs`: `buildArtistCardData`（写真は width/height 付き、`sizes` は 132px/96px 用の専用値）、`makeEntityResolver` に渡す、
  `validateArticleShortcodes` に参照切れ検査。`DETAIL_CSS_VERSION 42→43`、`ARTICLE_FX_JS_VERSION 10→11`。
- `LP/detail.css`: `.tj-artist-card` 一式（PC は写真 132px を左、スマホは写真 96px を上に置き文は全幅）。
- `LP/article-fx.js`: カード内の写真を図版化（figure / fx-bleed / FIG.番号）の対象から除外、reveal 対象に追加。
- `LP/cms.js`: `loadArtistDB` が写真・経歴・ジャンル・拠点・SNS も保持、`buildArticleArtistData`、プレビュー2箇所に `artistData`、
  `@` メニューに「▣ カード」ボタン、「新しい窓でプレビュー」の CSS/JS 版を本番と同じ 32/43/13/11 に。`LP/cms.css` にプレビューの見た目、`LP/cms.html` の ?v（cms.css 41 / article-shortcodes.js 6 / cms.js 128）。
- 検査: `scripts/check_article_shortcodes.mjs` に 13 本追加（52 assertions）。`check_cms_article_generated_preview.mjs` と `check_cms_layout.mjs` は
  **版番号のべた書き（detail.css v36 等）をやめ、build の定数と照合**する形に変更（AUDIT §9-101 の 6）。
- 文書: スタイルガイド §8 に「アーティストカードの使いどころ」、設計書を「第1フェーズ実装済み」に、AUDIT §9-101。

### コミット
- このエントリを含むコミット（上記 13 ファイル＋再生成した詳細ページ 540 枚＋EN ハブ）。

### 検証
- `bash scripts/preflight.sh` **全49件成功**（2026-10-09、途中 3 件→1 件→0 件。原因と直しは AUDIT §9-101 の 6 と「検査の罠」）。
- 単体: `node scripts/check_article_shortcodes.mjs` 52 assertions 成功。`node --check` で cms.js / article-fx.js / article-shortcodes.js 構文 OK。
- 実ブラウザ相当（headless Chrome + CDP、実記事 `otsukimi-2026-info.html` のコピーに dj-nobu のカード 2 枚＝経歴あり／一言ありを差し込み）:
  - PC 1280px: 写真 132px・ジャンル／拠点・名前・経歴 4 行・リンク 4 本が1枚に収まる。一言ありは経歴の代わりに一言が出る。
  - スマホ 390px（dpr2）: 写真 96px が上、文は全幅。横スクロール無し。
  - 1回目の撮影で article-fx が写真を全幅に広げ FIG.01 を付けていた → 除外して再撮影で解消。
- 再生成後: 全 540 ページが detail.css?v=43、記事 32 枚が article-fx.js?v=11。JA/EN ハブ行数一致（index 1199 / festivals 1448 / artists 932 / venues 1104 / news 1382）。

### 変更したパターン
- 記事本文のショートコード（event / calendar に artist-card が加わった）。本文に `<img>` を持つブロックは article-fx の除外リストに入れる。
- CMS プレビュー（枠内／新しい窓）の両方にカードが出る。`@` メニューの行にリンク／カードの 2 ボタン。
- preflight の 2 検査が版番号を build 定数から読む。

### 未確認の類似パターン
- **CMS の実機操作は未確認**（認証が要る）: `@` → 「▣ カード」→ 本文に `[[artist-card:…]]` が入る → プレビューに出る → 保存 → 再表示。
  確認時は CMS を `?cb=<乱数>` 付きで開き **Cmd+Shift+R**。loadArtistDB は get_sheet の行から取るので、ARTISTS の列名（bio_ja / pref 等）が想定と違えば経歴・拠点が空で出る。
- 実記事での使用は 0 件。最初に使う記事で、公開ページ（JA/EN）の見え方をもう一度見る。
- `[[artist-card]]` を EN 本文（body_en）に書いた場合の英語経歴選択は単体テストのみ（実記事なし）。
- Publish pipeline の手動実行は push 後に行う（下の「次の担当へ」）。

### 次の担当への注意・判断待ち
- **push 後に `gh workflow run "Publish pipeline"` を流して success を確認する**（cms.js を触ったため必須。結果はこの下に追記）。
  → **実施済み（2026-10-09）**: Publish pipeline run 37929838994 **success**。デプロイ 37929786907 success。
  本番実測: detail.css?v=43 に `.tj-artist-card` あり、article-fx.js?v=11 に除外あり、cms.html は cms.js?v=128 / cms.css?v=41 / article-shortcodes.js?v=6、
  記事ページは detail.css?v=43 / article-fx.js?v=11 を参照。デプロイ後の Lighthouse CI も success（12:28 / 12:34 UTC）。
- ユーザーへ: CMS は Cmd+Shift+R で強制リロード。
- 残りのブロック（プルクオート／折りたたみ／表）は設計書 §2-2〜2-4。着手はユーザーの指示待ち。
- 検査の中にブラウザ側コードをテンプレート文字列で埋め込んでいる箇所（check_cms_layout.mjs の PROBE）では正規表現のバックスラッシュが消える。split 等で書く。

## 2026-10-10 プルクオート `[[pullquote]]`（記事ブロック 第2フェーズ）＋ CMS「？ 使い方」パネル＋ 文書2本

### 実施
- **プルクオート**（設計 `docs/design/ARTICLE_BLOCKS_2026-10-09.md` §2-2、実装 Codex、追加指示 0 回）:
  `LP/article-shortcodes.js` に `[[pullquote|本文|出典]]` → `<aside class="tj-pullquote">`。本文空は throw。`LP/detail.css` に見た目（既存の引用と同系統: 中央・細字・上下赤線＋出典行）、
  既存 `.article-body blockquote` にも折り返し3指定＋balance。`LP/article-fx.js` の reveal 対象に追加。CMS に「❝ プルクオート」ボタン（選択文を初期値に、`|` `]` は全角へ正規化）。
  `DETAIL_CSS_VERSION 43→44`、`ARTICLE_FX_JS_VERSION 11→12`、cms.css?v=42、article-shortcodes.js?v=7、cms.js?v=129。単体テスト +9（61 assertions）。
- **「？ 使い方」パネル**（実装 Codex、追加指示 1 回）: 本文ツールバーにボタン。`cms.js` の `ARTICLE_BODY_HELP`（8 セクション 41 項目、
  `docs/writing/ARTICLE_BODY_FEATURES.md` と同文）を開閉式で表示、検索で絞り込み、7 機能は「この機能を使う」で直接開く。cms.js?v=130、cms.css?v=43。
- **文書**: `docs/writing/ARTICLE_BODY_FEATURES.md`（本文でできること一覧）、`docs/CMS_GUIDE.md`（CMS の使い方・共有用。同内容を Artifact ページ
  https://claude.ai/artifact/E6z7BGLAsYdEe5u6SNWk1q に公開、閲覧はオーナーのみ）。スタイルガイド §8 にプルクオートの使いどころ。AUDIT §9-102。
- `.gitignore` に `.scratch/` を追加（作業用。中身はコミットしない）。

### コミット
- このエントリを含むコミット（上記＋再生成した詳細ページ 540 枚＋EN ハブ）。

### 検証
- `bash scripts/preflight.sh` **全49件成功**（2026-10-10、単独実行）。
  ※1回目は最後の「モバイルの言語切替」が 45 分止まった。私が同時に別の headless Chrome で撮影していたため。**preflight 中は他のブラウザ検査を動かさない**（前回の引き継ぎの注意の再発）。
- 単体: shortcode 61 assertions。`node --check` cms.js / article-fx.js / article-shortcodes.js OK。
- 実ブラウザ相当（CDP）:
  - プルクオート: 実記事コピーに「出典なし／出典あり／既存の引用／英語」を並べ、PC 1280 と スマホ 390（dpr2）で撮影。中央・細字・赤線・出典行、文節折り返し、横スクロール無し。
  - 「？ 使い方」: 認証を素通しにしたローカル表示で 1280 / 390。ダイアログが開き 8 セクション 41 項目、はみ出し無し。検索欄の素の白と `**` の残りを見つけて修正、再撮影で解消。
- 再生成後: 540 ページが detail.css?v=44、記事 32 枚が article-fx.js?v=12。JA/EN ハブ行数一致。

### 変更したパターン
- 記事本文ショートコード（event / calendar / artist-card / pullquote）。blockquote の折り返し。
- CMS 本文ツールバー（❝ プルクオート、？ 使い方）。

### 未確認の類似パターン
- **CMS の実機操作は未確認**（認証）: 「❝ プルクオート」→ 挿入 → プレビュー → 保存 → 再表示、「？ 使い方」→ 検索 → 「この機能を使う」。Cmd+Shift+R。
- 既存「引用」の見た目のズレ: `article-fx.css` 24〜26行が blockquote::before を左の縦線に上書きし、detail.css の上の横線が消えている（AUDIT §9-102）。公開記事での使用 0 件。未修正。
- プルクオートの実記事使用は 0 件。最初の記事で JA/EN を見る。

### 次の担当への注意・判断待ち
- push 後に Publish pipeline を手動実行して success を確認（cms.js 変更のため）。結果はこの下に追記。
  → **実施済み（2026-10-10）**: push は1回目が「fetch first」で拒否（CI の sitemap/rss 再生成が先に入っていた）→ rebase（衝突なし）→ 再 push 成功（フック preflight 全49件成功）。
  Publish pipeline run 37953679597 success、デプロイ 37953679778 success。本番実測: cms.html は cms.js?v=130 / cms.css?v=43 / article-shortcodes.js?v=7、
  detail.css?v=44 に `.tj-pullquote` あり、記事ページは detail.css?v=44 / article-fx.js?v=12。デプロイ後の Lighthouse CI: **success**。
- 残りのブロック（折りたたみ／表）は設計書 §2-3 / 2-4。ユーザー指示待ち。
- 文書と CMS の説明文は2箇所（ARTICLE_BODY_FEATURES.md / ARTICLE_BODY_HELP）。機能を足したら両方。

## 2026-10-10 折りたたみ `[[details|見出し]] … [[/details]]`（記事ブロック 第3フェーズ）

### 実施
- 設計 `docs/design/ARTICLE_BLOCKS_2026-10-09.md` §2-3 を実装（**実装は Codex、追加指示 0 回**。設計・検証・git は Claude）。
- `LP/article-shortcodes.js`: `<p>[[details|見出し]]</p> … <p>[[/details]]</p>`（素の形も可）→ `<details class="tj-details"><summary>…</summary><div class="tj-details-body">…</div></details>`。
  他のショートコードより先に変換（中の event / pullquote はその後に変換される）。閉じ忘れ・入れ子・見出し空は throw。戻り値に `details` 件数。
- `LP/detail.css`: `.tj-details` 一式（＋／−の印、上下の細線、中身の字下げ、スマホは字下げ無し）。`LP/article-fx.js` の reveal 対象に追加。
- CMS: 「▾ 折りたたみ」ボタン（文を選択してから押すとその範囲が中身に。無ければ3行の雛形）。「？ 使い方」の文に項目追加、「まだ無いもの」から削除。cms.css にプレビューの見た目。
- 版: `DETAIL_CSS_VERSION 44→45`、`ARTICLE_FX_JS_VERSION 12→13`、cms.js?v=131、cms.css?v=44、article-shortcodes.js?v=8。詳細ページ再生成。
- 文書: ARTICLE_BODY_FEATURES.md（§3 追加・§8 削除）、ARTICLE_BODY_SPEC_FOR_AI.md（§3-5 追加・チェック項目）、スタイルガイド §8、設計書の状態、AUDIT §9-103。
  共有ページ https://claude.ai/artifact/EHnmooVsUniY79t7TGLMCr を更新版に差し替え。

### コミット
- このエントリを含むコミット（上記＋再生成した詳細ページ 540 枚＋EN ハブ）。

### 検証
- `bash scripts/preflight.sh` **全49件成功**（2026-10-10、単独実行）。単体: shortcode 72 assertions。`node --check` 3 ファイル OK。
- 実ブラウザ相当（CDP、実記事コピー）: 閉じた状態と開いた状態（中にリスト＋プルクオート）を PC 1280 / スマホ 390 で撮影。印・線・字下げ・中のブロック変換・横スクロール無しを確認。
- 再生成後: 540 ページが detail.css?v=45、記事 32 枚が article-fx.js?v=13。JA/EN ハブ行数一致。

### 変更したパターン
- 記事本文ショートコード（event / calendar / artist-card / pullquote / details）。details は初の「範囲を囲む」型。

### 未確認の類似パターン
- **CMS の実機操作は未確認**（認証）: 文を選択 → 「▾ 折りたたみ」→ 見出し入力 → 挿入 → プレビューで開閉 → 保存 → 再表示。Cmd+Shift+R。
- 実記事での使用 0 件。最初の記事で JA/EN を見る。
- 折りたたみの中に画像を置いた場合の article-fx（figure 化）は単体では未確認。開いたときに観測される設計。

### 次の担当への注意・判断待ち
- push 後に Publish pipeline を手動実行して success を確認（cms.js 変更のため）。結果はこの下に追記。
  → **実施済み（2026-10-10）**: push 成功（フック preflight 全49件成功）、Publish pipeline run 37957650579 success、デプロイ 37957647580 success。
  本番実測: cms.html は cms.js?v=131 / cms.css?v=44 / article-shortcodes.js?v=8、detail.css?v=45 に `.tj-details` あり、記事ページは detail.css?v=45 / article-fx.js?v=13。
  デプロイ後の Lighthouse CI 37959048381 **success**。
- 残りは「表」（設計書 §2-4）。使う記事が出てから。
- 文書と CMS の説明文は2箇所（ARTICLE_BODY_FEATURES.md / ARTICLE_BODY_HELP）。今回も両方直した。

## 2026-10-10 フォームの送信先を press@techno-japan.media に変更

### 実施
- ニュースレター登録と問い合わせ（formsubmit.co 経由）の送信先を `tatsuya25shibata@gmail.com` → `press@techno-japan.media` に変更（ユーザー指示。実装は Codex）。
- 編集: LP/index.html / festivals.html / artists.html / venues.html / news.html / about.html（2箇所）/ en/about.html（2箇所）/ scripts/build-detail-pages.mjs（記事ページのニュースレター欄）。
  EN ハブ 5 枚と記事ページは再生成で反映。LP 配下に旧アドレス 0 件、新アドレス 44 ファイル。

### コミット
- このエントリを含むコミット。

### 検証
- `bash scripts/preflight.sh` 全49件成功（2026-10-10、単独実行）。JA/EN ハブ行数一致。
- **実機未確認**: フォーム送信と受信は本番でしか確かめられない。

### 変更したパターン
- `action="https://formsubmit.co/<宛先>"` の宛先（全フォーム共通）。

### 未確認の類似パターン
- GAS 側や GitHub Actions からの通知メールは別経路（今回は対象外。grep で `@techno-japan.media` 以外の通知先は無し）。

### 次の担当への注意・判断待ち
- **本番反映済み（2026-10-10）**: push はユーザーの Publish（記事 treak-2026-info 追加）と前後して2回拒否 → フック preflight が「sitemap の記事数 16 / 期待 17」で止めた（正しい）→
  生成物の差分と未追跡の生成ページを捨てて rebase → 再生成 → 再 push 成功、デプロイ 37965125250 success。本番の about / index / 記事ページのフォーム宛先はすべて press@techno-japan.media。
  同じ Publish で CMS に「Unexpected token '<' … is not valid JSON」が出たが、GAS 側のコミット（06b24eb0）は成立し pipeline も success。返事の読み取りだけが失敗（AUDIT 未記載、対策は提案中: gasPostJson_ が JSON 以外の返事を受けたら GitHub 側の完了を自前で確認して表示する）。
- **formsubmit.co は新しい宛先の有効化が必要**: デプロイ後にフォームを1回送信 → press@ に届く「Activate Form」のリンクを押す → もう1回送って受信を確認。押すまで届かない（ユーザーに案内済み）。
- 有効化後に案内されるランダム文字列へ差し替えると、HTML にメールアドレスを書かずに済む（任意、未実施）。

## 2026-10-10 Google ニュース掲載の実測と、analytics スクリプトの拡張（--news / --gnews）

### 実施
- ユーザーの問い「Google ニュースに載っているか」に対し、3つの事実で回答:
  1. Google ニュースの検索 RSS（`news.google.com/rss/search?q=site:techno-japan.media`）は **64 件**（記事＋会場・アーティスト・フェスのページ）。索引には載っている。
  2. Search Console 検索タイプ「ニュース」（Google 検索のニュースタブ）: 28日で **0 / 0**。
  3. Google ニュース製品レポート（performance/news）: **404**＝レポート自体が無い＝Google ニュース経由の表示がまだ無い。
- `scripts/audit_analytics.mjs` に `--news`（検索タイプ=ニュース）と `--gnews`（Google ニュース製品）を追加（実装 Codex、追加指示 3 回）。
  表が無い／404 は失敗ではなく「表示なし」として 0 行で出力し、画面文言を `.txt` に保存。summary の前回比で「1.06万」を数値化できず -100% と出ていた既存バグも修正。
- `reports/analytics/2026-10-10/` に 28 日分を出力（web / news / gnews）。メモリー `google-news-publisher-center.md` に実測を追記。

### コミット
- このエントリを含むコミット（スクリプト＋ reports/analytics/2026-10-10 ＋ handoff）。

### 検証
- `node --check` OK。実行 3 回: web 491 クリック / 1.06万 表示（前回比 +12.1% / +9.5%）、news 0 / 0、gnews 404。
- preflight は対象外（このスクリプトは preflight から呼ばれない）。push 時のフックで全件は走る。

### 変更したパターン
- analytics の取得対象（web → web / news / gnews）。出力ファイル名は web を据え置き、news は `gsc-news-*`、gnews は `gnews-*`。

### 未確認の類似パターン
- GSC の表は読み込みタイミングで **たまに取れない**（同じ条件で web query / page が落ちたり通ったりした）。落ちたら再実行で通る。再試行の自動化は未実装。
- `--range=3m` での news / gnews は未実行。

### 次の担当への注意・判断待ち
- 「索引に載っている」と「ニュース面で表示された」は別。月次の効果測定は `--gsc --news --gnews` で3つとも取る。
- Publisher Center の連絡先確認メール（9/21）は未クリック（掲載可否には無関係）。

## 2026-10-11 本番の地図が「API KEY REQUIRED」になっていた不具合の修正（CARTO → OpenStreetMap）

### 実施
- ユーザー指摘「本番で地図が見れない」。原因は CARTO のキー無しタイルが 200 のまま警告画像を返すようになったこと（AUDIT §9-104）。
- `LP/venues.html` / `LP/map.html` / `LP/cms.js`（＋`cms.css`）のタイルを OpenStreetMap へ変更、タイルだけ暗色フィルタ、出典表示を表示（実装 Codex）。
- `addVenueTiles` の失敗判定を丈夫に（最初の1枚で成功、0 枚かつ 6 失敗で失敗、15 秒）。`scripts/check_hub_pages.py` を整合。
- `cms.html` の版: cms.js?v=132 / cms.css?v=45。EN ハブ再生成、sitemap / RSS を作り直し（sitemap-news は 48 時間経過で 2 → 1 件。古いままだと preflight が落ちる）。

### コミット
- このエントリを含むコミット。

### 検証
- preflight 全49件成功（2026-10-11、単独実行）。
- headless Chrome（1440px、ローカル配信）: venues.html の地図 = タイル 18 枚・ピン 27・`data-map-status=ready`・出典表示あり、map.html = タイル 24 枚・ピン 30。画像で道路・地名が暗色で出ることを確認。

### 変更したパターン
- 地図タイルの配信元（3箇所）、出典表示、タイル失敗の判定。

### 未確認の類似パターン
- **CMS の座標選択の地図は実機未確認**（認証）。Cmd+Shift+R で開いて地図が出ることを見る。
- スマホ実機での地図の見え方（暗色フィルタ）は未確認。
- 他に外部の無料サービスへキー無しで依存している箇所の棚卸しはしていない（Google Fonts、formsubmit、behold.so など）。

### 次の担当への注意・判断待ち
- push 後に Publish pipeline を手動実行（cms.js 変更のため）。結果はこの下に追記。
  → **実施済み（2026-10-11）**: push 成功（フック preflight 通過）、デプロイ success、Publish pipeline run 38099030418 success、Lighthouse CI success（2回）。
  本番実測（headless Chrome）: venues.html の地図はタイル 18 枚・ピン 27・status=ready・出典表示あり、map.html はタイル 24 枚・ピン 30。
  本番の venues.html / map.html / cms.js?v=132 はすべて tile.openstreetmap.org を参照（cartocdn 0 件）。画像でも地図が出ることを確認。
- 外部サービスの確認は、ステータスコードではなく**返ってきた中身**を見る（今回 200 で誤判断した）。
- テスト環境（design/mc-media の worktree）にも venues.html の同じ関数の変更がある。main を取り込むときに衝突するので、main 側（OSM）を採る。
- sitemap-news.xml が毎日の自動再生成で更新されなかった理由は未調査（10/10 02:07 UTC が最後）。

## 2026-10-11 CARTO dark_all と OSM 自動フォールバックへ復帰

### 実施
- `LP/venues.html` / `LP/map.html` / `LP/cms.js` の地図タイルを、キー付き CARTO `dark_all` 優先へ変更。
- CARTO のタイルが1枚も読めない状態で `tileerror` が3回起きた場合、1回だけ OSM 標準タイルへ差し替え、`tj-map-osm` を付与。
- 暗色フィルタを OSM フォールバック時だけに限定。`LP/cms.css`、`LP/cms.html` の版（`cms.css?v=46` / `cms.js?v=133`）も更新。
- `scripts/check_hub_pages.py` の CARTO キー検査と、タイル失敗検査を OSM 切り替え後の `ready` 判定へ整合。

### コミット
- 未コミット（ユーザー指示により git 操作・公開は未実施）。

### 検証
- `node --check LP/cms.js` 成功。
- `LP/map.html` / `LP/venues.html` の inline script 構文確認成功。
- preflight、実ブラウザ、Publish pipeline は未実施（ユーザー指示によりテスト実行禁止）。

### 変更したパターン
- CARTO のキー定数: 3箇所（`venues.html` / `map.html` / `cms.js`）。CARTO URL: 3箇所。
- CARTO 3回失敗後の OSM 差し替え、OSM 時のみのタイル暗色フィルタ、OSM 出典表示。

### 未確認の類似パターン
- 確認済み・0件: `LP/en/venues.html` は自動生成物のため変更対象外。
- 実機の本番ドメイン（CARTO 成功時）と localhost（CARTO 403 → OSM）の描画状態は未確認。

### 次の担当への注意・判断待ち
- `bash scripts/preflight.sh`、CARTO 成功時と OSM フォールバック時の実ブラウザ確認、必要なら Publish pipeline を実行する。
- CMS を確認する場合は認証済み環境で座標入力後に地図が出ることを確認し、変更後は Cmd+Shift+R を使う。

### 追記（Claude、同エントリの検証と経緯）
- 経緯: OSM への切り替え後、ユーザーが「前の地図のデザインがよかった」。CARTO の案内（carto.com/basemaps/apikey）を確認し、無料キー（非商用 月500万回、商用 月100万回、アカウント不要）で元の dark_all に戻せると判明。
  ユーザーがキーを取得し、CARTO の管理画面で techno-japan.media に制限済み。キーは公開前提の種類（HTML に書く）。
- 実測: キー付き＋Referer=https://techno-japan.media/ で 200・本物の黒いタイル（@2x 512px、画像で確認）。localhost / www 付き / Referer 無しは 403。
- preflight 全49件成功（2026-10-11、単独実行）。localhost では CARTO が 403 → 3 回で OSM に切り替わり、タイル 18 枚・ピン 27・status=ready を確認。
- **CARTO の表示そのものは本番でしか確認できない**（キーが本番ドメイン限定）。push 後に本番で確認し、結果をこの下に追記する。
- 注意: 利用区分は Non-commercial で登録されている。広告・有料掲載など収益が出たら Commercial（月100万回まで無料）へ切り替える。出典表示は必須。

## 2026-10-11 表示の刷新を本番へ（記事・NEWS・TOP・WRITERS・フッター・スマホ・メニュー）

### 実施
- ブランチ `design/mc-media`（worktree `../techno-japan-preview`）でユーザーが実物を確認し「問題ないので本番へ」。main へ取り込んで本番に出す。内容と経緯は AUDIT §9-105。
- 触った主なファイル: LP/index.html, news.html, writers.html（新規）, about.html, artists.html, festivals.html, venues.html, favorites.html, submit.html, 404.html,
  common.css, common.js, detail.css, cms.js, cms.html, scripts/build-detail-pages.mjs, .github/regression-thresholds.yml。生成物（詳細ページ・EN ハブ・sitemap・RSS）を再生成。
- 版: COMMON_CSS 37 / COMMON_JS 17 / DETAIL_CSS 47 / ARTICLE_FX_JS 13、cms.js?v=134 / cms.css?v=46。

### コミット
- このエントリを含む main へのマージ（design/mc-media）。

### 検証
- worktree で `bash scripts/preflight.sh` 全件（結果は下の「次の担当へ」に追記）。
- headless Chrome（CDP）での確認: PC 1440 / 1280 / 1100 と スマホ 390 / 360。
  - フッター: 6 ページ × 3 幅 = 18 通りで1行・横スクロール無し（数値で確認）。
  - スマホ点検: 12 ページ × 2 幅で横スクロール 0 件。FEATURED 1 本の高さ 530/522/522px → 428/393/414px。
  - 記事: 短題｜副題・リード文・関連記事3本・関連フェスのカルーセルを画像で確認。NEWS: ヒーロー、FEATURED 3 本、ALL STORIES。TOP: 8 記事レール（STORIES 01 / 08）。
  - スマホメニュー: TOP と記事ページで開いた状態を画像で確認（現在地の白、×1つ、JA/EN 中央）。
  - writers.html: PC / スマホ。フォーム項目 name / email / articles / sns。

### 変更したパターン
- ハブ（TOP / NEWS）の構造、記事ページの見出し・リード文・末尾、全ページのフッターとスマホメニュー、スマホ向けの文字サイズとタップ領域。

### 未確認の類似パターン
- **実機（iPhone Safari）での確認は未実施**。メニューの滑り込みの滑らかさは静止画でしか見ていない。
- **CMS の実機操作は未確認**（cms.js は「本番表示プレビュー」の CSS/JS の版を揃えただけ）。Cmd+Shift+R。
- writers.html のフォーム送信→受信（formsubmit、press@ 宛）は未実施。イベント通知欄（`_subject` = Event updates signup）も同じ。
- EN ページ（/en/）の見た目は行数一致と日本語残りの検査のみ。画像での確認は TOP と NEWS の JA 中心。
- 詳細ページ（フェス・アーティスト・会場・記事）のフッターには SNS アイコンが無い（以前から。今回は触っていない）。

### 次の担当への注意・判断待ち
- push 後に Publish pipeline を手動実行（cms.js 変更のため）。結果と Lighthouse をこの下に追記。
  → **実施済み（2026-10-11）**: worktree で preflight 全49件成功（1回目は「モバイルの言語切替」が落ちた: メニューの浮かび上がり演出で JA/EN が開いた直後 opacity 0。言語切替を演出の対象から外して解消）。
  main へマージ → push は1回目フックで停止（cms.js を最後に触った後の ?v 上げ忘れ。135 に上げて再 push、通過）。
  デプロイ 38109005190 success、Publish pipeline 38109005790 success、Lighthouse CI 38109525297 success。
  本番実測: TOP に 8 記事レール、NEWS に FEATURED、/writers.html、記事に短題｜副題と関連フェスのカルーセル、全ページ common.css?v=37 と WRITER。PC / スマホの画像でも確認。
  **Lighthouse の警告（失敗ではない）: TOP の性能スコア 0.54（目安 0.6 未満）。** TOP の写真レールが 8 枚の大きな写真を持つのが原因とみられる。未対応。
- NEWS のヒーローは最新記事の写真を背景に読む。Lighthouse の CLS / 性能が悪化していないかを CI の結果で見る（悪化していたら、ヒーローの高さ確保と画像の縮小版を検討）。
- テスト環境の worktree とブランチは、本番反映を確認してから片付ける。

## 2026-10-11 TOP / NEWS の初回表示で読む写真を減らす（Lighthouse 性能の警告への対応）

### 実施
- 配信後の Lighthouse で TOP の性能 0.54（目安 0.6 未満の警告）。原因は STORIES の 8 記事ぶんの写真（lg 960px）を最初に全部読んでいたこと（実装 Codex）。
- TOP: 1本目だけ eager、2本目以降は data-src ＋ IntersectionObserver。大きさに合う派生画像（スマホの行は sm 480px、PC のレールは md 720px）。PC 用とスマホ用で同じ写真を二重に読まない。
- NEWS: ヒーローの背景が原寸（569KB）で、しかも最古の記事の写真だった → 最新記事の派生画像に。FEATURED の 2・3 本目は遅延。
- `scripts/check_hub_pages.py` は `img[data-src]` も画像として数える。

### コミット
- このエントリを含むコミット（design/mc-media → main）。

### 検証
- 同じ方法（CDP の Network 転送量、キャッシュ無し、スクロール無し 7 秒、テスト環境）で前後を測定。**画像の転送量のみ比較**（ローカル配信は JS が無圧縮なので合計は本番と一致しない）:
  | ページ・条件 | 変更前 | 変更後 |
  |---|---:|---:|
  | TOP 390px dpr3 | 1,119KB | 391KB |
  | TOP 1440px dpr1 | 1,295KB | 225KB |
  | NEWS 390px dpr3 | 1,503KB | 169KB |
  | NEWS 1440px dpr1 | （未測定） | 122KB |
- 画質: 表示 px × dpr ≦ 取得 px を確認（スマホの行 104px×3=312 ≦ 480、PC レール 720×1 ≦ 720）。スマホ1本目と dpr2 の PC は派生の上限 960px（変更前と同じ）。
- スクロール後に写真が出ることを画像で確認（TOP スマホの 8 行、NEWS の FEATURED 3 本）。preflight 全件（下に追記）。

### 変更したパターン
- ハブの重ね合わせ写真（スライド）は `loading=lazy` では遅延しない（全部が画面内扱い）。data-src ＋ IntersectionObserver を使う。

### 未確認の類似パターン
- 本番の Lighthouse スコアは配信後の CI で確認する（結果を下に追記）。festivals / artists / venues ハブは今回触っていない。

### 次の担当への注意・判断待ち
- 本番での前後比較は、同じ weigh 方式（`.scratch/weigh.mjs` 相当）で画像の転送量を見る。
- **本番反映済み（2026-10-11）**: worktree preflight 全49件成功（localize.js の ?v 上げ忘れを検査が検出 → 12 に）、push 通過、デプロイ 38111319570 success、Lighthouse CI 38111486810 success（警告なし）。
  本番実測（同じ方法、初回表示の合計転送量）: TOP 390px dpr3 **1,493KB → 765KB**（画像 1,119 → 391）、TOP 1440px **1,317KB → 423KB**（画像 1,119 → 225）、NEWS 390px dpr3 543KB（画像 169。変更前の本番値は未測定）。
  Lighthouse TOP: 性能 **0.54 → 0.72**、CLS 0、a11y 1.0、SEO 1.0。LCP は 5.4 秒（1本目の写真 lg）でまだ長い。次に詰めるならここ（1本目の写真を HTML に直接書いて JS の実行を待たずに読ませる）。
  ※ 配信直後の自動測り直しは私の引数ミスで 404 ページを測っていた（合計 86KB という不自然な値で気づき、測り直した）。

## 2026-10-14 記事の「左寄せ」画像が本文の左へはみ出す不具合を修正

### 実施
- 左寄せ画像を本文の幅に収めた（右寄せと同じ見え方）。原因と経緯は AUDIT §9-106。実装 Codex。
- テスト環境で試した「画面4分割グリッド」はユーザー判断で不採用。差分は捨て、`.scratch/mcwp/grid-4col-abandoned.patch` に保存のみ。

### コミット
- このエントリを含むコミット（design/mc-media → main）。

### 検証
- テスト環境 http://localhost:8090/articles/labyrinth-2026-info.html を CDP で幅 1100 / 1440 / 1920 に設定し、本文と画像の左右端を実測。
  | 幅 | 本文 | 左寄せ | 右寄せ |
  |---|---|---|---|
  | 1100 | 210–890 | 210–663 | 437–890 |
  | 1440 | 380–1060 | 380–833 | 607–1060 |
  | 1920 | 620–1300 | 620–1073 | 847–1300 |
  変更前の本番 1440: 左 265–718（115px はみ出し）。
- スマホ（899px 以下）の規則は変更なし。preflight 全件（下に追記）。

### 変更したパターン
- `figure.fx-img.fx-left` の margin-left -8vw → 0、`fx-right` の効いていない margin-right -8vw → 0。
- CMS の「本番表示プレビュー」が読む article-fx.css の版を 14 に（preflight が不一致を検出）。cms.js?v=135 → 136。

### 未確認の類似パターン
- fx-full / fx-compact / fx-bleed は変更なし（全幅・本文幅の想定どおりであることを実測で確認済み・不具合0件）。
- CMS のプレビュー（cms.css）は fx-left/right の張り出しを持たないことを確認済み・0件。

### 次の担当への注意・判断待ち
- 本番反映後、本番の記事で左寄せが本文の左端に揃うことを実測して追記する。
- cms.js を変えたので push 後に Publish pipeline を手動実行する。CMS は Cmd+Shift+R で強制リロード。
- **本番反映済み（2026-10-14）**: worktree preflight 全件成功（1回目は CMS プレビューの article-fx.css 版ずれを検出 → cms.js で 14 に、cms.js?v=136）。push フック通過、デプロイ 38572651220 success、Lighthouse CI 38573453912 success、Publish pipeline 38572661200 success（`cms: publish data.js` f2288ac0 が増えたことを確認）。
  本番実測（https://techno-japan.media/articles/labyrinth-2026-info.html, CDP, 1100/1440/1920）: テスト環境と同値。1440 で本文 380–1060 / 左寄せ 380–833 / 右寄せ 607–1060。
  CMS の画面操作（ブラウザでの本番表示プレビュー）は**実機未確認**。変更は参照する CSS の版番号のみ。

## 2026-10-14 CMS「↗ 本番表示」プレビューを本番の記事ページと同じ表示にする

### 実施
- 本物の記事ページを型にして下書きを差し込む方式に変更。詳細は AUDIT §9-107。実装 Codex。
- autolinkArtists を LP/article-shortcodes.js へ移動し、build と CMS で共用。

### コミット
- このエントリを含むコミット（design/mc-media）。**本番未反映**（下記の判断待ち）。

### 検証
- 記事ページ全件（JA/EN）を変更前後でビルドし diff -r 差分 0。
- headless Chrome 1440px で CMS の本番表示を実際に開き、本物の labyrinth 記事ページと13項目が一致（違いは JSON-LD のみ）。
  型が同じ記事 / 別記事の両方、ショートコード誤り時のエラー表示と窓を閉じる動作も確認。スクショで見た目一致を目視。
- preflight 全件成功。ただし INTERGALACTIC 記事の参照切れ（下記）をローカルのコピーだけで直した状態で実行。

### 変更したパターン
- CMS 本番表示: 空の窓に書く → 本物の記事ページを fetch して差し替え。
- autolinkArtists の置き場所: build-detail-pages.mjs → article-shortcodes.js（export）。
- check_cms_layout.mjs: await で新プレビューを呼ぶ。「記事ページを型にしているか」を追加。

### 未確認の類似パターン
- ログイン済みの実際の CMS での操作は**実機未確認**（検査は GAS を遮断した状態）。
- EN 版の本番表示は無い（従来どおり JA のみ）。
- スマホ幅のプレビューは未確認（CSS は本番と同じ物を読むため差は出ない想定）。

### 次の担当への注意・判断待ち
- **push できない状態**: 本番 data.js の INTERGALACTIC 記事（intergalactic-2026-info）に `[[event|…|intergalactic-festival]]` が1件残り、
  ビルドが止まる。正しいフェスIDは `intergalactic`。データはユーザーが CMS で直す（勝手に直さない）。直って Publish が通ったら、
  main へマージ → push → Publish pipeline 実行 → 本番で本番表示を開いて確認。CMS は Cmd+Shift+R。
- **本番反映（2026-10-15）**: INTERGALACTIC の ID 修正（ユーザーが CMS で実施）後に push。フック preflight 全件成功、デプロイ 38588520731 success、
  Publish pipeline 38588542651 success（data.js に変化が無いので `cms: publish data.js` コミットは増えない＝正常）。
  本番 CMS（cms.js?v=138）で本番表示を開き、本物の labyrinth ページと一致（違いは JSON-LD のみ）。
  ただし新規記事の場合、記事キャッシュ（5分で失効）が空だと簡易表示に落ちることを本番で発見 → RSS を予備に使う修正を追加（AUDIT §9-107 追補、cms.js?v=139）。
  テスト環境でキャッシュを消した状態で、本物の記事ページの型（ヘッダー・ヒーロー・関連記事3本・自動リンク9）になることを確認。
- **RSS 予備の本番反映（2026-10-15）**: デプロイ 38593277764 success、Publish pipeline 38593303183 success、本番 cms.js?v=139。
  本番 CMS で「同じ記事」「新規記事＋記事キャッシュ空」の両方を開き、本物の labyrinth ページと一致（違いは JSON-LD のみ、関連記事3・自動リンク9）。
  ログインした状態での手動操作はユーザー側で未確認。CMS は Cmd+Shift+R で強制リロードが必要。
- **ユーザー確認済み（2026-10-15）**: ログインした本番 CMS で「↗ 本番表示」を開き、問題なし（ユーザー報告「無事完了した」）。上記の「ログイン状態は未確認」は解消。

## 2026-10-15 総合監査（バグ・モバイル UX・SEO/GEO・計測）— 報告のみ、コード変更なし

### 実施
- 本番 https://techno-japan.media/ を対象に、実ブラウザ a11y/重量監査（`audit_a11y_browser.mjs`）、独自 CDP プローブ（390/1280 幅・18 ページ・コンソール例外・失敗リクエスト・横スクロール・スクショ）、Lighthouse 12.6.1（4 ページ）、全 584 HTML の静的走査、外部リンク 140 本、GSC/GA4 28 日を突き合わせた。
- 結果は `reports/audit-2026-10-15.md`。スコア: モバイル UX 78 / バグ・性能 70 / SEO・GEO 82 / 流入・導線 68。

### コミット
- このエントリと `reports/audit-2026-10-15.md` のみ。LP/ は触っていない。

### 検証
- 本番で確認した事実: `/favorites.html` が JS 例外（`tjFav.list` 未定義）で空白。9/24 の `dba4ffc4` で favorites.js に `defer` が付いたのが原因。横スクロール 0/36。コンソール例外は favorites 以外 0。
- headless Chrome 155 で `navigator.webdriver` は `false`（`--enable-automation` 無し）。GA のボット除外は UA 文字列だけに依存している。UA を上書きした計測は GA4 に届く（今日の自分の計測で約 36 セッション分が入った。10/15 16:00 台 JST）。

### 変更したパターン
- なし（報告のみ）。

### 未確認の類似パターン
- CI の Lighthouse（treosh/lighthouse-ci-action）が GA4 に数えられているかは未確認（ローカル Lighthouse では gtag が読まれなかった）。GA4 リアルタイムで確認する手順を報告書 5-2 に書いた。
- Lighthouse はローカル 1 回計測。CI との絶対値差あり。

### 次の担当への注意・判断待ち
- 最優先は favorites.html の `defer` 撤去（1 行）。次に GA ボット除外の 3 重化（hostname 判定 + lighthouserc の UA）。順番と WP 分割は報告書 §6。
- FESTIVALS に `NAME_JA` を足す案（§4-2）は Publish 経路（fetch-data / GAS / build）を触るので、単独で出して実機 1 回通す。
- データ側（CMS）: ultra-japan のチケット URL 404 は 9/28 からそのまま。

## 2026-10-15 総合監査 §2-1〜§2-3・§5-2 即時修正

### 実施
- `favorites.html` と JA/EN の artists / festivals / venues ハブで、inline 描画より先に `favorites.js` が実行されるよう `defer` を撤去。`favorites.js` は初期実行時に DOM を直接参照せず、既存の DOMContentLoaded 処理も維持。
- GA4 に hostname 制限と `TJAudit` UA 除外を追加。Lighthouse CI の UA に `Chrome-Lighthouse`、計測スクリプト2本に `TJAudit` を追加。
- TOP の PC レール／スマホ画像を幅別に eager 選択し、幅変更時の遅延画像取り込みを追加。詳細ページのフェス／アーティスト／会場ヒーローに `fetchpriority="high"` を追加。
- Google Fonts を自己ホスト6ファイルへ置換し、生成側の `FONT_HEAD` 1定義から全JA/ENページを再生成・反映。

### コミット
- このエントリを含むコミット（実装 Codex、レビュー・検証・コミットは Claude）。

### 検証
- Claude: `bash scripts/preflight.sh` 全49件成功（check_hub_pages を含む）。
- Claude: ローカル配信（python http.server）を headless Chrome で 390px dpr3 タッチ / 1440px の2幅 × 10ページ（/, favorites, festivals, artists, venues, festivals/labyrinth, articles/labyrinth-2026-info, map, en/index, news）。
  全ページ JS 例外 0・横スクロール 0・Google Fonts への通信 0・/fonts/ から3書体を読み込み・見出しと本文の書体は変更前と同じ。
  TOP: スマホは1本目の行写真が eager+high で表示済み、PC はレール1枚目が eager+high。favorites: 空のとき「NOTHING SAVED YET」、labyrinth を保存して再読込すると1件表示。
  詳細ヒーローは fetchpriority=high。localhost では GA を読まない（hostname 判定どおり）。地図タイルの 403 は localhost 由来で既知（本番ドメイン限定キー）。
- `node scripts/build-detail-pages.mjs` 完了（画像寸法表は既存値を使用。外部画像取得が環境制限で長時間化したため、寸法再生成 import を一時停止して実行後、必ず元へ復元）。
- `check_asset_versions.py`、`check_no_hardcoded_versions.py`、`check_asset_paths.py`、`check_jsonld.mjs`、`check_internal_links.py` は成功。JA/EN hub 行数一致: index 1353/1353、festivals 1458/1458、artists 941/941、venues 1149/1149、news 1291/1291。
- `fonts.googleapis.com/css2` は cms.html を除き0件、全562ページの `FONT_HEAD` は生成側と完全一致。`.lighthouserc.json` はJSONとして有効。

### 変更したパターン
- `favorites.js` の同期実行、GAボット判定、TOPの `.stories-visual` / `.story-side-mobile-image` の画像優先度、詳細ヒーロー画像の優先度、Google Fonts CSS参照。

### 未確認の類似パターン
- 実機（iPhone Safari）での表示は未確認。本番反映後に本番 URL で同じ確認をしてここへ追記する。
- cms.html は Publish 経路のため今回は Google Fonts のまま（意図的）。CSP の fonts.googleapis.com / gstatic.com も残している。
- `LP/app/index.html` と旧URLリダイレクトHTMLはGoogle Fonts参照がなく、共通 `FONT_HEAD` 対象外（確認済み）。

### 次の担当への注意・判断待ち
- GA4 の効果は数日後に確認: Direct の非エンゲージ・`/festivals/ala.html` 等 Lighthouse URL の 0秒 PV が減っているか。
- 監査 §4-2（フェスの NAME_JA）はスプレッドシートに列追加が必要。ユーザー判断待ち。
- **本番反映済み（2026-10-15）**: push フック preflight 全件成功、デプロイ 38707344236 success（a546f15a）。
  本番を headless Chrome で 390px dpr3 / 1440px × 10ページ: JS 例外 0・横スクロール 0・Google Fonts 通信 0・/fonts/ から3書体。favorites は空表示と保存1件の表示を確認。headless からは GA を読まない。
  Lighthouse（ローカル実行・モバイル既定・朝と同じコマンド）: TOP 性能 88→99（LCP 3.3→2.1s）、festivals 87→96（3.3→2.4s）、フェス詳細 87→98（2.9→2.0s）、記事 90→100（3.1→1.4s）。描画を止める時間 約1.6s→0.04〜0.3s。TOP の「LCP 画像が遅延読み込み」は解消。
  TOP の1回目は計測値が取れず（既知の揺れ）、2回再計測して両方 99。実機（iPhone Safari）は未確認。

## 2026-10-15 フェスのカタカナ名（name_ja）— 監査 §4-2

### 実施
- 「リバースフェスティバル」等カタカナで検索されるのに title が英字だけで CTR 0% だった（GSC 28日、順位5〜10位・表示1,500回超）。
- FESTIVALS シートの末尾 AF 列にヘッダー `name_ja` を追加し、検索実績のある8件に値を入れた（Claude in Chrome、セル単位の入力。ヘッダー行の既存セルは不変、A1=ID を確認）。
  | ID | name_ja | 根拠（GSC の検索語） |
  |---|---|---|
  | re-birth-festival | リバースフェスティバル | リバースフェスティバル 198表示ほか |
  | big-fun | ビッグファン | ビッグファン 札幌 186 |
  | colors-presents-soundcamp | サウンドキャンプ | サウンドキャンプ 92 |
  | labyrinth | ラビリンス | ラビリンス 2026 64 |
  | snow-machine-japan | スノーマシン | スノーマシン 2027 18 |
  | bondisco | ボンディスコ | ボンディスコ 15 |
  | synapse-festival | シナプスフェスティバル | シナプスフェス 2 / シナプスフェスティバル 1 |
  | circus | サーカス | サーカスフェスティバル 3 |
- コード（実装 Codex）: CMS に入力欄 f-name_ja（読込・保存・新規・リセット・コード出力）、buildFestivalsJs に name_ja、JA 詳細の title / description / FAQ / JSON-LD alternateName、festivals.html と search.js の検索、check_data_hub の許可キー。新検査 `scripts/check_cms_name_ja.mjs` を preflight に追加。
- JA title の長さ予算: 長い名前では種別を先に削り、「日程・チケット」と地名は最後まで残す（最終手段の候補を「地名 日程・チケット」に変更）。既存フェスで変わったのは takarajima-beach-cleaning-party の1件（種別 → 日程・チケット）。

### コミット
- b5cad2b9（コード）、e9d26729（CMS Publish: data.js に name_ja 8行のみ追加）、このエントリ。

### 検証
- preflight 全50件成功（新検査「FESTIVALS name_ja の保持と生成」含む）。push フックでも成功。デプロイ 38714623700 success、Publish pipeline 38715081207 success。
- ローカルで data.js のコピーに name_ja を一時注入してビルド → title / description / FAQ / alternateName を確認 → 元に戻して再ビルドし差分0を確認。
- 本番 CMS（cms.js?v=140）で Re:birth を EDIT で開き、f-name_ja に「リバースフェスティバル」が読み込まれることを確認（保存はしていない）。
- 本番 CMS で Publish Now。確認ダイアログ3つ（push 確認 / 差分確認 / 公開内容: FESTIVALS 95・ARTISTS 137・VENUES 22・ARTICLES 18）以外は拒否する設定で実行し、拒否は0件。
  data.js の差分は name_ja 8行のみ、件数不変、desc_en 95/95。
- 本番: 8ページの title にカタカナ併記、EN 詳細の title は不変、alternateName と FAQ 1問目に併記、data-hub.js に name_ja、festivals.html の検索で「リバース」→ re-birth-festival 1件。

### 変更したパターン
- FESTIVALS の列追加（末尾 AF、小文字ヘッダー）と、CMS の読込・送信の両方に新列を足すパターン（片方だけだと保存のたびに消える）。
- JA フェス title の候補順（最終手段を「日程・チケット」に）。

### 未確認の類似パターン
- **会場（VENUES）のカタカナ名は未対応**。VENUES は GAS 側の固定列リスト（COLUMNS）で書き込むため、GAS の貼り替え・再デプロイが要る。検索実績: ジュール クラブ 29、みつき クラブ 27、ザルーム 渋谷 10、ミツキ クラブ 10、サルーン クラブ 8。
- 他のフェスは検索実績が無いため空欄（推測で埋めない）。GSC で新しいカタカナ検索が出たら CMS の「Name (カタカナ)」に入れる。
- iPhone 実機での表示は未確認（title と構造化データのみの変更で、見た目は変えていない）。

### 次の担当への注意・判断待ち
- 効果測定は2〜4週間後の GSC で、上表のクエリの CTR を見る（現状ほぼ 0%）。
- CMS は Cmd+Shift+R で強制リロード（cms.js?v=140）。
- 会場のカタカナ対応は GAS 変更を伴うので、着手前にユーザー確認。

## 2026-10-16 TOP の帯を「開催予定フェス」に（テスト環境・未公開）

### 実施
- ブランチ `design/techno-fx`（worktree `techno-japan-fx`）。main との差分は `LP/index.html` と生成物 `LP/en/index.html` のみ。
- TOP の流れる帯（`.marquee`）を、固定文言から開催予定フェスの一覧に置き換えた。左端に固定の「● UPCOMING」、各件は「番号 / 状態（● NOW ON = 赤点滅、● THIS WEEK = 赤、NEXT = 灰）/ 日付 / フェス名 / 都道府県」。各件は通常の `<a href="/festivals/<id>.html">`。
- 2周目の複製は `aria-hidden` + `tabindex=-1`。hover / focus / タッチ中は停止。`prefers-reduced-motion` では横スクロールの帯になる。
- 副作用: TOP の `upcoming` 判定を「開始日 >= 今日」から「終了日 >= 今日」に変えたため、開催中のフェスも「UPCOMING EVENTS」一覧に残る。
- 同じブランチで試した「カード→記事の写真遷移（View Transitions）」と「LED 読み進みメーター」はユーザー判断で不採用。関連ファイル（vt-direction.js、common.css/js、news.html、article-fx.css/js、cms.js、build-detail-pages.mjs）はすべて main と同一に戻した。経緯は d530c498〜d4db7f11 のコミットに残っている。

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全50件成功（2026-10-16）。
- headless Chrome: 390px（dpr2, touch）/ 1440px、JA / EN。帯の高さ 49〜51px、横はみ出し 0、JS 例外 0。
- 実ブラウザ（Chrome）で PC 幅の帯を目視確認。スマホ実機は未確認。
- 注意: `check_feeds.mjs` の「sitemap-news.xml に48時間外の記事」は日付の経過で main でも落ちる（intergalactic-2026-info が 10/14 公開）。`python3 scripts/generate-sitemap.py` で再生成すると通る。本番は Publish pipeline が再生成する。

### 変更したパターン
- `LP/index.html` の `.marquee` の CSS と、`upcoming` 配列の直後の描画ブロック。

### 未確認の類似パターン
- 確認済み・0件（帯は TOP だけにある）。

### 次の担当への注意・判断待ち
- 本番へ出すときは main にマージ → preflight → push。Publish 経路（cms.js 等）は触っていないので pipeline の実行は不要。
- 「開催中のフェスが UPCOMING EVENTS に残る」副作用を残すかは判断待ち。

## 2026-10-16 TOP タイトル拡大・詳細ページの戻るリンク削除・記事の全幅ヒーロー（テスト環境・未公開）

### 実施
- ブランチ `design/techno-fx`。参考: crackmagazine.net の long-reads（端から端までの写真、写真の上に見出し、下に小さなメタ、本文は細い段）。
- TOP `.side-card-title`: clamp(16px,2vw,22px) → clamp(20px,2.2vw,28px)（旧 featured カードの見出しと同じ大きさ）。1100px 以下 18px、スマホの2件目以降 16px。
- 4種の詳細テンプレート（記事 / フェス / アーティスト / 会場）から**上部**の戻るリンク（ALL STORIES / BACK TO FESTIVALS / ALL ARTISTS / ALL VENUES）を削除。末尾のリンクは残した（`data-*-hub-back` による一覧の状態復元はそのまま動く）。
- 1ビュー目を上へ: `.detail-page` 上余白 120→96px（スマホ 100→84px）。
- 記事ヒーロー（`.article-hero`、`data-ratio="auto"` 以外）を全幅に: `width:100vw`、高さ clamp(480px,80vh,920px)（スマホ clamp(380px,64vh,620px)）、ページ最上部から始まり固定ナビの下に入る。見出しオーバーレイは左下のまま、内側を max-width 1100px で中央寄せ。`data-ratio="auto"` のヒーロー（縦長フライヤー等）は従来の幅のまま。
- 全幅にすると lg（横720px）を 1440px に引き伸ばしてぼやけるため、記事ヒーロー専用の `xl`（最大1440px、元が縦長なら 1080px）を `scripts/build-image-derivatives.py` に追加。18ファイル・約3.7MB。`image-derivatives.js` v53、`check_image_derivatives.py` は xl を要求・上限 1440px に変更。ヒーロー `sizes` は `(max-width:700px) 100vw, 700px` → `100vw`。
- 再生成で既存の派生 4ファイル（loa-lost-paradise…）のバイトが変わった（元画像が更新されていた）。
- detail.css v49、cms.js のプレビュー参照 v141、cms.html v144。**Publish 経路（cms.js）に触れている。**

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全50件成功（2026-10-16）。※「ハブページが JS 込みで描ける」の FESTIVALS カーソル検査は、headless Chrome を並行で動かして負荷が高いと落ちる（3回）。単独・負荷なしでは毎回通る。
- 重さ（`performance.getEntriesByType('resource')`、全ドメイン、localhost）:
  - intergalactic-2026-info: 1440px dpr1 320KB → 352KB（ヒーロー 49→81KB）、390px dpr3 320→352KB
  - japan-festival-2026-october: 1440px dpr1 474→565KB（ヒーロー 47→115KB）、390px dpr3 598→642KB
- 画質: 1440px dpr1 でヒーローの実画素 720 → 1440（縦長元画像は 1080）。
- headless 1440px / 390px: 記事・フェス・アーティスト・会場・TOP で横はみ出し 0、JS 例外 0。h1 がナビと重ならないことを確認。
- 実機 iPhone 未確認。CMS のプレビュー（detail.css v49）での記事表示は未確認。

### 変更したパターン
- `scripts/build-detail-pages.mjs`: articlePage / festivalPage / artistPage / venuePage の上部戻るリンク、`heroSrcsetAttr`（記事ヒーローのみ xl 追加・sizes 100vw）、DETAIL_CSS_VERSION。
- `LP/detail.css`: `.article-hero*`、`.article-detail` / `.detail-page` の上余白、`.article-specs` 余白、`.article-detail-inner > .article-back:first-child` 削除。
- `scripts/build-image-derivatives.py` / `scripts/check_image_derivatives.py`: xl。

### 未確認の類似パターン
- 記事以外（フェス / 会場）のヒーロー srcset は変更なし（フェスページの生成物を before/after で比較し差分なしを確認）。
- `news.html` の記事プレビュー（CMS 内）が全幅ヒーローでどう見えるかは未確認。

### 次の担当への注意・判断待ち
- 本番へ出すときは cms.js を触っているので `gh workflow run "Publish pipeline"` を自分で流し、CMS を `?cb=` 付きで開いて確認し、ユーザーに Cmd+Shift+R を伝える。
- 派生画像は publish-pipeline / sync-drive-images でも `build-image-derivatives.py` が走るので、新規記事の xl は自動で作られる。

## 2026-10-16 記事ヒーローの画質: xxl（2560px）追加・xl/xxl を品質85・幅基準（テスト環境・未公開）

### 実施
- `scripts/build-image-derivatives.py`: 記事ヒーロー専用に `xxl`（幅 min(2560, 元幅)、元幅 > 1440 のときだけ）を追加。xl / xxl は**幅**基準でリサイズ（長辺基準だと縦長の元画像で xl が 1080px になり、スマホ dpr3 が xxl を取ってしまった）。xl / xxl だけ WEBP 品質 80 → 85。xl 18枚・xxl 15枚、合計約 10.9MB。
- `scripts/check_image_derivatives.py`: xl / xxl は幅で上限（1440 / 2560）を検査。`image-derivatives.js` v55。
- `heroSrcsetAttr`（記事ヒーローのみ）に xxl を追加。`sizes="100vw"`。フェス / 会場 / カードの srcset は不変（再ビルド前後でフェスページ差分なし）。

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全50件成功（2026-10-16）。
- どの版が選ばれるか（headless, localhost:8092）: 1440px dpr1 → xl、1440px dpr2 → xxl、390px dpr3 → xl（縦長元画像の intergalactic も同じ）。
- ヒーロー1枚の重さ（本番 → 今回）:
  - japan-festival-2026-october: PC 1x 47KB → 142KB、PC Retina 70KB → 216KB、スマホ dpr3 70KB → 142KB
  - intergalactic-2026-info: PC 1x 49KB → 143KB、PC Retina → 211KB、スマホ dpr3 49KB → 143KB
  - ページ合計は本文の Drive 画像の遅延読込で計測ごとに揺れるため、ヒーロー単体で比較した。
- 実画素: PC 1x 720 → 1440、PC Retina 720 → 1920〜2560、スマホ 720 → 1440。
- 実機（Retina Mac / iPhone）での目視は未確認。

### 変更したパターン
- 上記3ファイル＋生成物（記事ページ JA/EN、image-derivatives.js、派生画像）。

### 未確認の類似パターン
- 確認済み・0件（xl / xxl は記事ヒーロー以外に無い）。

### 次の担当への注意・判断待ち
- CMS の保存上限（1920px）を記事ヒーローだけ上げる案は未着手（Publish 経路）。元が 1440px 未満の3本（forest-sound-camp / bondisco / otsukimi）は入れ直しが必要。

## 2026-10-16 記事の見出し・要約の折り返し（スマホ）: BudouX の文節境界を生成時に埋め込む（テスト環境・未公開）

### 実施
- 原因: 見出しの `word-break: auto-phrase` は Chrome 限定。iPhone Safari では `keep-all` + `overflow-wrap: anywhere` に落ち、行が溢れた位置（単語の途中）で切れていた。Chrome でも文節が1行より長いと同じ（例「次世代ジェネレーショ／ンの可能性」）。要約は文節折りで右側に大きな空きが出ていた。
- `scripts/vendor/budoux/`（BudouX 0.9.3 の parser.js と日本語モデル、Apache-2.0、CI に npm install が無いので同梱）。`scripts/lib/phrase-breaks.mjs` が文節境界＋文字種の切替（漢字↔カタカナ、日本語↔2文字以上の英字）に `<wbr>` を入れる。数字の前後には入れない。1文字のひらがな（助詞）は前の文節に、1文字の漢字は次の文節に寄せる。禁則文字の前には入れない。
- 適用先: 記事ヒーローの h1（title-short / title-sub）と本文の h2 / h3。フェス・アーティスト・会場の h1（名前）は対象外。
- `LP/detail.css`: 見出しは `keep-all + overflow-wrap:anywhere + text-wrap:balance`（auto-phrase の二段指定を削除、スマホの h2 `text-wrap: wrap` 上書きも削除）。要約 `.article-excerpt` は `word-break: normal; overflow-wrap: break-word; text-wrap: pretty`。detail.css v50、cms.js プレビュー参照も更新。
- `scripts/test_phrase_breaks.mjs`（5例）を preflight に追加（51件目）。

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全51件成功（2026-10-16）。
- headless iPhone UA 390px dpr2 で transcendence / synapse / labyrinth / japan-festival-2026-october の h1・h2・要約を目視: 単語途中の改行なし、要約は行末まで詰まる。
- 実機 iPhone 未確認。CMS プレビュー（cms.css の h2/h3）は auto-phrase のまま（ブラウザ側で `<wbr>` を入れていない）。

### 変更したパターン
- `scripts/build-detail-pages.mjs`: `articleTitleHtml` の esc → phraseBreaks、本文 h2/h3 への `addHeadingPhraseBreaks`。

### 未確認の類似パターン
- TOP / NEWS のカード見出し（`.side-card-title` / `.feed-card-title`）は未対応（ブラウザ描画のため、やるなら localize.js 側で同じ規則を実装する）。

### 次の担当への注意・判断待ち
- 本番へ出すときは cms.js を触っているので Publish pipeline を自分で流す。

## 2026-10-16 記事 h2 のスマホ最小サイズ 24px → 22px（テスト環境・未公開）

### 実施
- 390px で `.article-body h2` の文節「創り上げたカッティングエッジな」（15字×24px=360px）が利用幅 338px に入らず、「創り上げた」が1行に孤立していた。`text-wrap: balance` でも5行の中にこれより良い割り付けは無い（実測）。22px なら4行に収まる（288/263/329/196px）。
- `LP/detail.css` `.article-body h2`: `clamp(24px, 3vw, 32px)` → `clamp(22px, 3vw, 32px)`（PC は 3vw ≥ 24px なので不変）。detail.css v51、cms.js プレビュー参照 v142。

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全51件成功（2026-10-16）。※直前の3回は「会場一覧の地図が全都市を出す」だけが落ちていた。単独では毎回通る。前日の検査が残した headless Chrome（PID 7455、23時間稼働）を止めたら全件通った。検査同士の Chrome の取り合いに弱いので、落ちたら `ps -eo pid,etime,command | grep headless` を見る。
- 390px: transcendence-2025-report の h2 が 4行、synapse-2026-info の h2 が 3行で、文節の切れ目だけで折れていることを目視。

### 変更したパターン
- `.article-body h2` の font-size のみ。

### 未確認の類似パターン
- h3（`clamp(18px, 2.2vw, 21px)`）は同じ問題が出るほど大きくないので未変更。

### 次の担当への注意・判断待ち
- なし。

## 2026-10-16 見出しは読点の句を優先して折る（テスト環境・未公開）

### 実施
- 390px で title-sub「東京・日の出町の森が、光と／アートと音楽の別世界に変わる」のように、読点ではなく文節で折れていた（CSS には改行候補の優先順位が無い）。
- `scripts/lib/phrase-breaks.mjs` に `clauseBreaks`: 句読点（、，。！？）の直後で句に分け、各句を `<span class="tj-clause">` で包む（中は従来の `<wbr>`）。4文字未満の句は隣に併合。子要素（`<em>` `<a>`）を含む見出しは従来の `<wbr>` のみ。
- 句の見た目の長さ（和文1・英数0.5・記号0.5）で `tj-cl-s`（≤9）/ `tj-cl-m`（≤15）/ `tj-cl-l`（≤24）を累積付与。CSS で要素ごとに「1行に収まりうる長さの句だけ」`display:inline-block; max-width:100%` にする: h1 は s、h2/h3 は m、title-sub は l。長い句は普通に流れる（短い先頭句が1行を独占しないように。TRANSCENDENCE の h2 で実測）。
- `LP/detail.css` v53、cms.js プレビュー参照 v144。`scripts/test_phrase_breaks.mjs` に句のケースを追加。

### コミット
- このエントリを含むコミット（design/techno-fx、未 push）。

### 検証
- `bash scripts/preflight.sh` 全51件成功（2026-10-16）。
- 390px headless（iPhone UA）目視: intergalactic「東京・日の出町の森が、／光とアートと音楽の別世界に変わる」、labyrinth「標高1,000mの森で、／日本を代表する野外レイヴが3日間の物語を組む。」、transcendence h1 は変化なし、h2 は4行のまま（先頭句が独占しない）。
- 実機 iPhone 未確認。

### 変更したパターン
- phrase-breaks.mjs（clauseBreaks / clauseClasses）、build-detail-pages.mjs の呼び出し、detail.css の `.tj-cl-*` 規則。

### 未確認の類似パターン
- TOP / NEWS のカード見出しは未対応（ブラウザ描画）。

### 次の担当への注意・判断待ち
- 閾値（9 / 15 / 24）は 390px・h1 34px・h2 22px・sub 約14px に合わせた概算。文字サイズを変えたら見直す。

## 2026-10-17 preflight の3検査を「条件がそろうまで待つ」形に（タイミング落ち対策）

### 実施
- 2026-10-16〜17 の本番 push で、固定時間待ちの検査が負荷の高い Mac で落ちた（単独実行では毎回通る）。
  - `scripts/check_hub_pages.py` カーソル検査: mousemove を1回だけ送り 150ms 後に判定 → 200ms ごとに送り直して最大5秒待つ。
  - `scripts/check_venue_maps.mjs`: load 後の固定待ち → ピン・絞り込みボタン・地図初期化の DOM 状態を 200ms ごと最大8秒ポーリング。
  - `scripts/check_festival_tracking.mjs`: セクション到達イベントを 200ms ごと最大6秒ポーリング（gtag 無しの実行ではイベントが出ないので従来の 150ms 待ち）。仮想時間の上限を 24 秒に。
- 判定条件とメッセージは変えていない。LP/ は未変更。

### コミット
- このエントリを含むコミット（main）。

### 検証
- 3本とも単独で成功（2026-10-17）。全体 preflight は push 時の pre-push hook で実行。

### 変更したパターン / 未確認の類似パターン
- 上記3ファイルのみ。他の headless 検査（check_mobile_language_toggles 等）は固定待ちのままだが、今日落ちていない（確認済み・0件）。

### 次の担当への注意・判断待ち
- 検査が落ちたら先に `ps -eo pid,etime,command | grep headless` で前回の残骸を確認する（2026-10-16 に23時間残っていた）。

## 2026-10-17 本番公開: 帯・TOP 見出し・戻るリンク削除・記事の全幅ヒーロー（xl/xxl）・見出しと要約の改行

### 実施
- design/techno-fx（f7f5e9c1〜ad87f8e3）を main に取り込み、push（cb45c60d）。deploy-pages 成功。
- cms.js を触っているので `gh workflow run "Publish pipeline"` を実行 → success（run 39005192735、生成物コミット 15abfa4e）。
- push 前の preflight は4回落ちた（カーソル検査×2・フェス計測×1・リモート更新による拒否×1）。落ちた検査3本を条件待ちに直した（02400509 / cb45c60d）。5回目で全51件成功。

### 検証
- 本番 HTML（TJAudit UA）: TOP に `.marquee-event` 10件、記事に `detail.css?v=53` と `xxl.webp`、上部の戻るリンク無し（末尾の1件のみ）。
- 本番 390px headless: transcendence-2025-report のヒーロー全幅・見出しの文節折り、TOP の帯（NOW ON 点灯）を目視。
- CMS: `cms.html?cb=` で cms.js v144 が配信されることを確認。パスワード入力が要るため、画面の中身は**実機未確認**（ユーザーに Cmd+Shift+R と動作確認を依頼）。
- iPhone 実機: 未確認。

### 次の担当への注意・判断待ち
- 記事ヒーローの元画像が 1440px 未満の3本（forest-sound-camp / bondisco / otsukimi）は入れ直しが必要。CMS の保存上限（1920px）引き上げは未着手（Publish 経路）。
- TOP / NEWS のカード見出しの文節折りは未対応。
- 開催中のフェスが TOP の UPCOMING EVENTS に残る副作用は、ユーザー了承済みのまま公開。
- 応募通知: ライター応募は formsubmit → press@（稼働中）。フェス申請の Google フォームは「新しい回答のメール通知」をオン（2026-10-17、宛先はフォーム所有者の Gmail）。未読の申請が4件あった。

## 2026-10-17 モバイル検索モーダルのナビ重なり修正（未公開）

### 実施
- `LP/search.js` の検索モーダルを nav より上（z-index 100001）にし、safe-area を考慮したパネル位置とスマホ向け結果スクロール領域を追加。
- モバイルメニューの SEARCH クリック時に overlay、hamburger、`html/body.nav-open` を先に閉じる処理を追加。
- JA/EN の全13ハブで `search.js?v=4` を `?v=5` に更新。EN は `node scripts/build-detail-pages.mjs` 実行後も同じ版であることを確認。
- `scripts/check_search_modal.mjs` を追加し、preflight のモバイル描画検査へ接続。

### コミット
- なし（ユーザー指定どおり未コミット）。

### 検証
- `python3 scripts/check_asset_versions.py` 成功。
- `node --check scripts/check_search_modal.mjs` 成功。
- `bash scripts/preflight.sh` は未実行。新規 headless 検査は、ポートを bind できないため作成のみで未実行。
- iPhone 実機および実ブラウザの検索操作は未確認。

### 変更したパターン
- `#global-search-modal` の z-index、`.gs-panel` の safe-area margin、`.gs-results` の `100dvh` max-height。
- モバイル `.nav-search-link` から検索を開く前のメニュー状態解除。
- `search.js` の全HTML参照版数、モバイル検索 headless 検査とpreflight接続。

### 未確認の類似パターン
- デスクトップ nav の検索トリガーは未確認。
- iPhone以外のsafe-area値、390px以外のモバイル幅は未確認。

### 次の担当への注意・判断待ち
- 公開前に `bash scripts/preflight.sh` を省略なしで実行し、新規検索検査を通すこと。iPhone実機でメニュー→SEARCH→入力→`laby` 結果表示を確認すること。

## 2026-10-17 フェス詳細のヒーロー写真をスマホで画面幅いっぱいに（テスト環境・未公開）

### 実施
- ブランチ `design/festival-hero`。`LP/detail.css` の ≤900px ブロック: `.festival-design-v2 .detail-hero-image { width: 100vw; margin-left/right: calc(50% - 50vw) }`（祖先の余白に左右されない viewport 基準のはみ出し。最初の -24px 版は外側に 8px 残った）。`.festival-design-v2 { padding-top: 88px }` で写真をナビ直下から。PC は不変。
- detail.css v54、cms.js プレビュー参照・cms.html を更新（Publish 経路）。

### 検証
- 390px headless: 写真 left 0 / width 390、横スクロールなし（scrollWidth 390）。目視済み。
- 追記: ユーザー指示でナビ下の余白も無くし、記事ページと同じく写真をページ最上部から（`.festival-design-v2:has(.detail-hero-image:not(.detail-hero-gradient)) { padding-top: 0 }`、写真の無いページは 88px のまま）。
- `bash scripts/preflight.sh`: 1回目は「記事の自動リンクと更新日」が落ちた。原因は当日公開された新記事 topia-2026-info の `updatedAt` が `date` と同じ（公開日に更新）で、検査が「updatedAt があれば dateModified ≠ datePublished」と決めつけていたこと（pipeline 生成物でも同じ）。`scripts/check_article_links.mjs` を「期待値＝isoDateTime(updatedAt || date) と一致」の厳密比較に修正。修正後の全件結果はこのエントリの末尾に記す。
- iPhone 実機未確認。

### 次の担当への注意
- 公開時は cms.js を触っているので Publish pipeline を流す。
- 追記2: 詳細ページ（記事・フェス・アーティスト・会場）はリセット CSS が無く、ブラウザ標準の `body { margin: 8px }` が残っていてスマホのヘッダーが左右 8px ずつ内側だった。`LP/common.css` の `body` に `margin: 0` を追加（common.css v38、cms.js プレビュー参照も更新）。TOP の `.media-intro` のスマホ上余白 120px → 36px（スマホのナビは sticky で文書内にあるため 120px は不要だった）。
- 最終: `bash scripts/preflight.sh` 全52件成功（2026-10-17、検査スクリプト `check_article_links.mjs` の修正込み）。390px headless: フェス写真 left 0 / width 390・上余白 0、ナビ left 0 / width 390（記事・フェス・アーティストで確認）。

## 2026-10-17 本番公開（第2便）: フェス写真のスマホ全幅・body margin 0・TOP 導入部の余白・検索モーダル

### 実施
- design/festival-hero を main に取り込み push（f4937d0e）。deploy-pages 成功、Publish pipeline 成功（run 39036957456）。
- push 前の preflight で「?v の上げ忘れ」が落ちた（ブランチ内で detail.css / cms.js を版上げ後にもう一度変更）。detail.css v55 / cms.js v146 に上げて再 push で全52件成功。

### 検証（本番、TJAudit UA、390px）
- フェス詳細: ナビ left 0 / width 390、写真 left 0 / width 390。TOP: ナビ 0 / 390。common.css v38・detail.css v55 配信。
- CMS の中身は実機未確認（パスワードが要る）。ユーザーに Cmd+Shift+R を依頼。

### 次の担当への注意
- 詳細ページの `body { margin: 0 }` は common.css 側。ハブのインラインリセットと重複するが害はない。
## 2026-10-17 フェス詳細のスマホのセクション間余白を詰める（design/festival-spacing）

### 実施
- `LP/detail.css` ≤900px の `.festival-design-v2`: hero margin-bottom 80→36、program-section padding 8/16、`.detail-section` 44→20、`.festival-faq` margin-top 56→12、`.detail-section-label` margin-top 40→12、`.article-footer` margin/padding 8/8、ページ下余白 80→32。PC 不変。detail.css v56、cms.js プレビュー参照更新（Publish 経路）。

### 検証
- 390px headless: hero→program 80→36px、editions→FAQ 56+44+40→12+20+12、related→BACK 60+40→8+8。sawagi / denki-bodhisattva で目視。
- `bash scripts/preflight.sh`: 「ハブページが JS 込みで描ける」のカーソル項目だけ落ちた（単独では成功、`cursor: retry` 1回）。他51件成功。push 時の pre-push hook で再実行される。

### 次の担当への注意
- カーソル検査は仮想時間と iframe の組み合わせで依然として不安定。落ちたら単独実行で確認する。

## 2026-10-17 NEWS: ジャンル順の変更と「MONTHLY POPULAR」（GA4 の過去30日閲覧数）

### 実施
- `LP/news.html`: カテゴリ順を ALL・GUIDE・FESTIVAL&RAVE・REPORT・NEWS・COLUMN・INTERVIEW に。「Most Popular」→「MONTHLY POPULAR」。並びは `/data/popular.json`（`{generatedAt, days, source, items:[{id, views}]}`）の views 順、無ければ日付順＋注記「集計データを準備中です」。従来の `a.views` 依存（どの記事にも無く、実質無効だった）を廃止。EN は enHubFromJa（build-detail-pages.mjs に注記の英訳を追加）。
- `scripts/fetch-popular.mjs`: サービスアカウント JSON（env `GA4_SA_KEY`）で JWT→アクセストークン→GA4 Data API runReport（property 535755449、30daysAgo〜yesterday、pagePath × screenPageViews）。`/articles/<id>.html` と `/en/articles/<id>.html` を id で合算し `LP/data/popular.json` に書く。env 無しは exit 0 で何もしない。npm 依存なし。
- `.github/workflows/popular.yml`: 毎日 18:23 UTC（03:23 JST）＋手動。変更があれば `chore: update monthly popular (GA4)` をコミット（[skip ci] なし＝deploy される）。concurrency group `pages`。

### 検証
- headless 1440px: JA/EN ともタブ順・ラベル・注記を確認。仮の popular.json を置くと Labyrinth→Synapse→Topia の順に、外すと日付順に戻ることを確認（仮ファイルは削除済み）。
- `node scripts/fetch-popular.mjs --dry`（env 無し）: exit 0。GA4 への実通信は**未検証**（鍵が未登録）。
- `bash scripts/preflight.sh` 全52件成功。

## 2026-10-18 分析 A1 / A3 / A5

### 実施
- フェス詳細の同一開催回 LINEUP を title / meta / hero / FAQ / JSON-LD に反映。ARTISTS upcoming セクションとニュースレター文言を追加。
- JA/EN ハブを再生成し、`detail.css` v57、`cms.js` v148、主グリッド閾値スコープを更新。

### コミット
- 未コミット（ユーザー指定）。

### 検証
- `node scripts/build-detail-pages.mjs` 成功。artists / index / news の JA/EN 行数はそれぞれ 1009/1009、1429/1429、1339/1339。
- `check_asset_versions.py`、`check_jsonld.mjs`、`check_article_links.mjs` は成功。Labyrinth title/description を確認。

### 変更したパターン
- A1 の開催回 LINEUP SEO/ヒーロー/FAQ、A3 の upcoming/main artists、A5 の index/news/article newsletter。回帰閾値は `artists-main-grid` に限定。

### 未確認の類似パターン
- 実ブラウザの JA/EN artists とフェス詳細の操作は未確認。`bash scripts/preflight.sh` は無出力で完了せず中断、`--fast` も同様に未完了。

### 次の担当への注意・判断待ち
- localhost を bind できる環境で省略なし preflight と実ブラウザ確認を再実行してから公開すること。CMS/GAS/本番データへの書き込みはしていない。

### 次の担当への注意・判断待ち
- ユーザーが GitHub secret `GA4_SA_KEY`（サービスアカウント JSON 全文）を登録し、GA4 プロパティ 535755449 に閲覧者として追加したら `gh workflow run "Monthly popular"` を流して popular.json が生成されるか確認する。失敗したらログの HTTP 本文を見る（403=権限、400=プロパティ ID）。
- popular.json は Pages の deploy で配信される。sw.js の扱いは既存の LP/data と同じ。

## 2026-10-18 本番公開（第3便）: フェス詳細のスマホ余白・NEWS のジャンル順と MONTHLY POPULAR（GA4 稼働）

### 実施
- push ee1ebd98 → deploy / Publish pipeline 成功。ユーザーが GitHub secret `GA4_SA_KEY` を登録（2026-10-17 14:49Z）。`gh workflow run "Monthly popular"` → 初回は concurrency group `pages` で deploy と競合して cancelled、再実行で success。`LP/data/popular.json` を生成（25記事、1位 japan-festival-2026-october 279 views / 30日）。
- 生成コミット e2f18b8 は GITHUB_TOKEN の push だったため deploy-pages が起動せず、`gh workflow run deploy-pages.yml` で手動配信。popular.yml の checkout に `token: secrets.GH_TOKEN` を追加（dbd30a03、この記録と一緒に push）。

### 検証（本番）
- /news.html?sort=popular（JA/EN）: 注記「過去30日の閲覧数順 · 更新 2026-10-17」、1位「2026年10月…11選」、2位 Labyrinth、3位 ONDO LAND。
- フェス詳細 390px: hero→program 36px、FAQ 前 12+16px（denki-bodhisattva）。

### 次の担当への注意
- 毎日 03:23 JST に popular.json が更新され、変更があれば deploy される（PAT 修正の push 後から）。GA4 側の権限が切れると run が失敗するので Actions の通知を見る。

## 2026-10-18 APPLY / WRITER の言語切替（スマホのメニューに追加、WRITER の英語版を新設）

### 実施
- 原因: submit.html / writers.html の `.nav-overlay` に `.nav-lang` が無く（他ハブにはある）、スマホでは上部の切替も隠れるため切替不能だった。writers.html は EN ページ自体が無く PC でも「JA」のみ。以前からの状態（履歴 6 コミットとも overlay に nav-lang 無し）。
- `LP/submit.html` と `LP/writers.html` の overlay に JA/EN 切替を追加（enHubFromJa が EN 版に差し替える文字列と同一）。writers.html の上部にも JA / EN。
- `scripts/build-detail-pages.mjs`: EN_PAGES に writers.html を追加し、`EN_PAGE_TEXT['writers.html']` の対訳表で本文を置換（見つからない JA 文字列があればビルドを止める）。EN の meta description / hreflang / `_next`（/en/writers.html?sent=1）。WRITER リンクを lang 対応（/en/writers.html）。sitemap に /en/writers.html。
- `scripts/check_mobile_language_toggles.mjs` に submit / writers の JA/EN を追加（32件）。

### 検証
- 390px / 1440px headless: 4ページとも header と menu に JA/EN があり、menu のリンクは elementFromPoint で押せる。`check_mobile_language_toggles` 32/32。
- `bash scripts/preflight.sh` 全52件成功。英訳は handoff の上の会話でユーザーに提示済み（修正依頼あれば `EN_PAGE_TEXT` を直す）。

### 次の担当への注意
- writers.html の日本語本文を変えたら `EN_PAGE_TEXT['writers.html']` も直すこと（ビルドが止まって気づける）。

## 2026-10-18 スマホのメニューに SEARCH（ABOUT / APPLY / WRITER）

### 実施
- 原因: about.html は search.js を読んでいたが overlay に `.nav-lang` が無く、common.js の並べ替え（SEARCH を nav-lang の直前へ）が効かず先頭に残っていた。submit.html は data-hub.js / search.js を読んでおらず、writers.html は search.js を読んでいなかった。
- `LP/submit.html` / `LP/writers.html` に `data-hub.js?v=11` と `search.js?v=5`（about.html と同じ順・属性）。`LP/about.html` の overlay に JA/EN 切替を追加。EN 版は生成。
- `scripts/check_search_modal.mjs` に about / submit / writers（JA/EN）を追加（SEARCH が nav-lang の直前にあり、押すと #gs-input にフォーカス）。`check_mobile_language_toggles.mjs` に about を追加（36件）。

### 検証
- 390px headless: 6ページとも overlay の並びが … WRITER, SEARCH, JA/EN。検索窓が開く。
- `bash scripts/preflight.sh` 全52件成功。
- 記事ページのメニューには SEARCH が無いまま（data-hub.js 140KB を全記事に足すことになるため今回は見送り。判断待ち）。

## 2026-10-18 詳細ページの検索を data-hub 遅延ロード化

### 実施
- `LP/search.js` は詳細ページでモーダルと SEARCH 導線だけ先に作り、初回オープン時に `data-hub.js` を1回だけ読み込むよう変更。失敗時は静かなエラー表示。
- `scripts/build-detail-pages.mjs` に `DATA_HUB_VERSION=11` / `SEARCH_JS_VERSION=6` を追加し、JA/EN の記事・フェス・アーティスト・会場詳細へ検索タグを共通生成。既存 HTML の `search.js` も v6 化。
- `scripts/check_search_modal.mjs` に `/articles/labyrinth-2026-info.html` と `/festivals/matricaria.html` を追加し、クリック前の data-hub 未取得とクリック後5秒以内のロードを検査。

### コミット
- 未コミット（ユーザー指定）。

### 検証
- `node scripts/build-detail-pages.mjs` 成功、JA/EN 詳細ページ数は articles 20/19、festivals 98/98、artists 147/147、venues 22/22。`python3 scripts/check_asset_versions.py`、`python3 scripts/check_no_hardcoded_versions.py`、`node --check LP/search.js`、`python3 scripts/check_regressions.py` 成功。
- `node scripts/check_search_modal.mjs` は sandbox の localhost bind が EPERM のため未実行（実ブラウザ未確認）。

### 変更したパターン
- 詳細ページ全573枚への `search.js?v=6` + `data-hub-src=/data-hub.js?v=11`、既存17 HTML の検索版更新、lazy 検査2ページ。

### 未確認の類似パターン
- 実ブラウザでの JA/EN 詳細ページ全4種の操作は未確認。ハブ側の既存データ先読み挙動は静的検査のみ確認。

### 次の担当への注意・判断待ち
- localhost を bind できる環境で `node scripts/check_search_modal.mjs` と `bash scripts/preflight.sh` を実機相当ブラウザで再実行してから公開すること。CMS / 本番データへの書き込みは不要。

## 2026-10-18 詳細ページのメニューに SEARCH（データは押したときだけ読み込む）

### 実施
- `LP/search.js` v6: データ（FESTIVALS/ARTISTS）が無いページでも、`<script src="/search.js" defer data-hub-src="/data-hub.js?v=11">` の属性があればモーダル・ナビのトリガー・メニューの SEARCH を作り、初回オープン時に data-hub.js を1回だけ注入して索引を作る（「読み込み中…」表示、失敗時は静かにエラー行）。ハブは従来どおり。
- `scripts/build-detail-pages.mjs`: `DATA_HUB_VERSION` / `SEARCH_JS_VERSION` を追加し、記事・フェス・アーティスト・会場（JA/EN）の生成ページに上記 script を出力。
- `scripts/check_search_modal.mjs` に記事とフェス詳細を追加（SEARCH が nav-lang の直前、押す前は data-hub.js のリクエストが無い、押すと読み込まれて "laby" で結果が出る）。

### 検証
- 390px headless: 記事/フェス/アーティスト/会場（JA/EN）のメニューが … WRITER, SEARCH, JA/EN。表示時 `typeof FESTIVALS === 'undefined'`（未読込）。検査 OK。
- `bash scripts/preflight.sh` 全52件成功。

## 2026-10-18 インサイト施策 A1 / A3 / A5（feat/insight-a1-a3-a5）

### 実施
- A1 フェス詳細: 出演者が 3 組以上ある回は title を「{名前} {年}｜出演者・日程・チケット（{都道府県}）」、EN は「— Lineup, Dates & Tickets」。description の冒頭を「日程・会場で開催。出演は A、B、C…ほか n 組」。FAQ「どんなアーティストが出演しますか？」に年と実名（最大10組＋ほか n 組）。ヒーロー下の LINE UP 要約は一度入れたがユーザー判断で削除（情報過多）。
- A3 ARTISTS ハブ: 見出し下に件数入りの説明文（JA/EN）。絞り込みの下に「● UPCOMING ON STAGE 出演予定」（60日以内に出演するアーティスト、出演回数順、最大12、カードに「フェス名 · 日付」）。グリッドに h2「すべてのアーティスト」。
- A5 ニュースレター: 見出し「日本の野外フェスの情報を受け取る」/ "Get Japan's open-air festival news"、リード「来月の開催予定と新着記事をまとめてメールで届けます。無料、いつでも解除できます。」（記事末尾・TOP・NEWS）。
- PC のフェス詳細の余白（festival-design-v2、>900px）: hero 下 80→48、program 52/36→24/24、detail-section 44→28、FAQ 前 56→16、ラベル下 32→20、editions 表の border-spacing 28→16（外側は負マージンで相殺）、footer 60/40→32/24。detail.css v58、cms.js プレビュー参照更新（Publish 経路）。

### 検証
- 1440px 実測: hero→program 48、editions→FAQ 16+28、related→footer 32+24。目視済み。390px のヒーローは変化なし。
- `bash scripts/preflight.sh` 全52件成功。1回目は「ハブページが JS 込みで描ける」が落ちた: Codex が regression-thresholds の artists の container を外側の `artists-main-grid` に変えたため、検査が最初の `</div>` で切って 266B と誤認した。元の指定に戻して解消。
- 効果の確認: Search Console で「ラビリンス 2026」「labyrinth 2026」系の CTR（今 1〜2%）、GA4 で /artists.html の平均エンゲージメント時間（今 3 秒）、`form_submit`（今 1/28日）を 11 月に見る。

## 2026-10-18 ARTISTS ハブ「すべてのアーティスト」が PC で1列になっていた不具合

### 実施
- 原因: A3 で入れた外側の `<div class="artists-grid" id="artists-main-grid">` の中に、カードを描く `#artists-grid` が入れ子になり、全カードが1マスに入っていた（A3 の変更による退行）。外側を `artists-main`（グリッドでない）に、内側の `#artists-grid` に `artists-grid` クラス。
### 検証
- headless: 1440px 3列 / 1000px 2列 / 390px 1列、139枚、横はみ出し 0。`bash scripts/preflight.sh` 全52件成功。
### 未確認の類似パターン
- UPCOMING ON STAGE のグリッドは入れ子なし（確認済み・0件）。

## 2026-10-19 サイト quick wins（未コミット）

### 実施
- NEWS featured のHydration中の高さ予約、VENUESナビの高さ予約、LeafletのMAP操作時lazy load、スマホcustom cursor停止。
- SWの未バージョンprecache除去、派生画像cache-first、dynamic cache 120件上限、v1.16.0。
- indexableページのmax-image-preview、TOP静的リンク（upcoming最大12＋記事8）、JST基準llms upcoming、common.js v18。

### コミット
- 未コミット（ユーザー指定）。

### 検証
- `node scripts/build-detail-pages.mjs` は外部画像取得リトライで長時間化したため生成結果を確認後停止。TOP/llms生成結果は反映済み。
- JA/ENハブ5枚の行数一致、`python3 scripts/check_asset_versions.py`、変更JSの`node --check`、`node scripts/check_sw_routing.mjs` 成功。
- 実ブラウザ／`check_hub_pages.py`／`check_venue_maps.mjs` は未確認（localhost bind不可のため、ユーザー指定どおり未実行）。

### 変更したパターン
- `LP/news.html` featured予約、`LP/venues.html` nav/map loader、`LP/sw.js` routing/cache、`LP/common.js` touch cursor、生成テンプレートと全common.js参照v18。

### 未確認の類似パターン
- 実ブラウザでのNEWS CLS、VENUES各都市MAP初期化、TOP hydration操作は未確認。

### 次の担当への注意・判断待ち
- bind可能な環境で実ブラウザ検査と`bash scripts/preflight.sh`を実行してから公開すること。CMS／本番データへの書き込みは不要。

## 2026-10-19 Batch 2 build/ops（未コミット）

### 実施
- RSS の記事日付フォールバックを `date`（JST 00:00）に変更し、未来日のみのフェスを除外。item hash が同じ場合は `lastBuildDate` を維持。
- sitemap の URL 別 lastmod、git fallback、生成 JSON の `_generatedAt` 安定化、preflight の timeout・lock・headless 子孫 cleanup を追加。deploy-pages checkout は `fetch-depth: 0` に変更。

### コミット
- 未コミット（ユーザー指定、既存の未コミット変更を保持）。

### 検証
- `python3 scripts/generate-rss.py`、`python3 scripts/generate-sitemap.py`、`bash -n scripts/preflight.sh`、`node --check scripts/fetch-data.mjs` 成功。
- RSS 38件中 pubDate=today は0件。sitemap lastmod 上位は 2026-10-18=459、2026-10-10=3、2026-09-26=3、2026-09-05=3、2026-10-17=3。

### 変更したパターン
- `scripts/generate-rss.py`、`scripts/generate-sitemap.py`、`scripts/fetch-data.mjs`、`scripts/preflight.sh`、deploy-pages checkout。

### 未確認の類似パターン
- フル preflight と実ブラウザ操作は未実行（ユーザー指定）。GAS/CMS の本番書き込みは未実行。

### 次の担当への注意・判断待ち
- 公開前に bind 可能な環境でフル preflight と必要な実ブラウザ確認を実施すること。

## 2026-10-19 今週のクイックウィン（audit-2026-10-19-site-issues.md の「コードだけで直せるもの」）

### 実施
- NEWS: hydration 中に `#news-featured` の高さを確保（モバイル低速 CLS 0.673 → 0）。
- VENUES: type/area ナビに min-height、Leaflet を `window.tjLoadLeaflet()` で地図を開いたときに遅延読込（失敗時は従来のエラー UI。`TJ_LEAFLET_SRC` で差し替え可＝検査用）。CLS 0.093 → 0.03、先頭の同期 JS 42KB 削減。check_hub_pages の地図検査を遅延読込前提（ポーリング）に更新。
- SW v1.16.0: precache から `/data.js` と版なし CSS/JS を除外、`/images/derivatives/` は cache-first、動的キャッシュは新しい120件まで。
- `max-image-preview:large` を indexable な全テンプレートと手書きハブへ。
- TOP に upcoming フェス12件＋最新記事8件の静的リンク（`STATIC_LINKS:TOP`）。JS 有効時は head の `tj-home-js` で最初から非表示（表示→非表示で CLS 0.455 が出たため）。
- llms.txt の upcoming を JST の終了日で絞る（Intergalactic 除外）。
- タッチ端末ではカスタムカーソルの rAF ループを回さない（common.js）。
- RSS: 記事は publishedAt 無ければ date（JST 0時）、未来日しかないフェスは除外、`lastBuildDate` は item のハッシュ不変なら維持。pubDate=今日は 19→0件。
- sitemap lastmod: 記事は updatedAt/date、他は実データ日付→git の最終変更日（shallow なら前回値を維持）。deploy-pages と generate-meta の checkout を fetch-depth: 0。
- fetch-data: `_generatedAt` は中身が変わったときだけ更新（空回りコミット削減）。
- preflight: 1件ごとに 240秒の時間制限（PREFLIGHT_CHECK_TIMEOUT）、経過秒表示、同時実行ロック、終了時に自分が起動した headless Chrome を終了。

### 検証
- 低速モバイル（390px dpr3、150ms/200KB/s、CPU4倍、SW バイパス）CLS: NEWS 0.673→0、VENUES 0.093→0.03、TOP 0。
- `bash scripts/preflight.sh` 全52件成功、終了後の headless Chrome 0。最長は詳細ページ生成 64秒・ハブ検査 57秒。
- 本番での LCP 比較は公開後に（ローカルサーバーは gzip 無しで比較不可）。

### 未確認・判断待ち
- bondisco 記事↔フェスの相互リンクはデータ（記事の関連フェス未設定）。ユーザーに CMS 設定を依頼済み。

## 2026-10-19 SEO・終了フェス・詳細リンク batch（未コミット）

### 実施
- `build-detail-pages.mjs` に JST 日付由来の終了判定、JA/EN 終了表示・次回未発表文・SEO タイトル/説明、全フェス詳細の RELATED FESTIVALS 選定を追加。
- EN 記事/フェス/会場タイトルを短縮し、`scripts/check_titles.mjs` を preflight に追加。JA/EN ハブ行数は 98/98。
- `detail.css`、`common.css`、`index.html`、`festivals.html` のタップ領域・コントラスト・過去イベント表示を更新し、detail/common CSS の版を更新。

### コミット
- 未コミット（ユーザー指定、コミット・pushなし）。

### 検証
- `node scripts/check_jsonld.mjs`、`python3 scripts/check_asset_versions.py --base origin/main`、`node scripts/check_titles.mjs`、`git diff --check` 成功。
- 生成 HTML の festival inbound 0件は 83→1（残る1件は旧ID `fulirock` のリダイレクト）。実フェス詳細97件は関連ブロック生成済み。
- `bash scripts/preflight.sh` は 44件成功 / 9件失敗。詳細生成は外部画像寸法取得のネットワーク制限で240秒 timeout、ブラウザ系8件は sandbox の localhost listen `EPERM`。実ブラウザ操作は未確認。生成確認は既存寸法表を保持したローカル経路で実施。

### 変更したパターン
- 終了フェスの date-derived state、タイトル上限、RELATED FESTIVALS の pref/month/genre + upcoming 優先、44px tap target、灰色ラベルのコントラスト。

### 未確認の類似パターン
- 確認済み・0件：JA/EN festival detail の生成件数差、indexable title 上限、JSON-LD 構文。
- 未確認：実機のタップ/コントラスト視認、フル preflight の外部画像取得経路。

### 次の担当への注意・判断待ち
- CMS/Publish の変更はない。公開前にフル preflight と実ブラウザで JA/EN の終了詳細、ハブカード、関連リンク、モバイル tap target を確認すること。

## 2026-10-19 SEO 第2弾（feat/seo-batch-b）: 終了フェス・英語タイトル・フェス相互リンク・押しやすさ/コントラスト

### 実施
- 終了フェス（最新回の DATE_END < 今日 JST かつ未来回なし。EDITIONS.STATUS は使わない）: 日付横に「終了」/ENDED、「次回の開催は未発表です…」の1行、title を「{名}｜次回開催情報・過去の出演者（{県}）」/ EN "— Next Edition, Past Lineups ({Pref})"（長い名前は "— Next Edition & Past Lineups" → "— Next Edition" に段階短縮）、description も直近開催の事実から。ハブのカードにも終了表示。
- EN タイトル ≤65: 記事は「{短題} — {副題を語境界で切る…} | TECHNO JAPAN」、フェスは「{名} {年} — Lineup, Dates & Tickets ({Pref})」、会場は「{NAME} ({area}) — Club in {city}」。`scripts/check_titles.mjs`（JA ≤60 / EN ≤65 / 終了フェスに過去年なし）を preflight に追加（53件目）。
- 関連フェス: 全フェスに最大6件（同じ県 → 同じ月 → 同じジャンル、開催予定を優先）。他の詳細ページからのリンク0件のフェス 83 → 1（旧ID のリダイレクトのみ）。
- タップ領域 ≥44px（TOP の帯、出演者チップ、共有ボタン、フッター申請リンク）、9〜11px の灰色ラベルを ≥4.5:1、記事内の過去イベントカードの多重 opacity を解消。

### 検証
- 390px headless で yamauto（終了表示・関連6件）、FESTIVALS ハブを目視。`bash scripts/preflight.sh` 全53件成功。

### データの判断待ち（ユーザーに確認依頼済み）
- intergalactic の PREF=Chiba（会場は東京・日の出町）。本番データは未反映。
- bondisco の PREF=Gunma（会場の三田アスレチックパークは兵庫）。
## 2026-10-19 VENUESアクセス情報・詳細関連ブロック（未コミット）

### 実施
- VENUES の `name_kana` / `access` / `access_en` / `hours_en` をGAS手貼りパッチ、README、CMSフォーム・編集読込・両保存payload・export・Publish summary・data.js生成へ追加。GAS_URLと本番データは未変更。
- VENUE詳細のJA/EN title/meta、INFO、座標優先Google Maps、JSON-LD alternateName、開催フェス・関連記事の回遊を実装。22会場を再生成。

### コミット
- 未コミット（ユーザー指定、pushなし）。

### 検証
- `check_asset_versions.py`、`check_titles.mjs`、`check_jsonld.mjs`、`check_cms_venue_access.mjs`、`check_cms_name_ja.mjs`、Publish guard、VENUE詳細検査、`git diff --check` 成功。JA/ENハブ5枚の行数一致。
- フル preflight はコード系43件成功。詳細生成は外部画像取得の240秒timeout、ブラウザ系はsandboxのlocalhost listen `EPERM`。

### 変更したパターン
- VENUES追加4列の完全な読み書き経路、任意フィールドの静的生成、会場名・位置による関連フェス（最大6）/記事（最大3）、営業時間フォールバック。

### 未確認の類似パターン
- 確認済み・0件：CMSの既存 `name_ja` 経路、JA/ENタイトル上限、JSON-LD、22会場の静的ページ。
- 未確認：認証済みCMSの実保存/Publish、実ブラウザ操作（sandbox制約）。

### 次の担当への注意・判断待ち
- オーナーがApps Script `COLUMNS`末尾とVENUES row 1末尾へ4小文字列を追加し、Deploy → Manage deployments → edit → New version → Deployを実施すること。公開前にbind可能な環境でフルpreflightとCMS実機確認を行うこと。

## 2026-10-20 会場ページの刷新（feat/venue-pages）＋ VENUES 新4列

### 実施
- VENUES に `name_kana` / `access` / `access_en` / `hours_en` を追加（`hours` は既存の JA 営業時間）。
  - GAS: ユーザーが 2026-10-20 に Apps Script の COLUMNS 末尾へ4列を追記し、既存デプロイを新バージョンで再デプロイ（URL 不変）。スプレッドシート VENUES の1行目右端に4見出しを追記（gviz で読み取り確認: `… FEATURES name_kana access access_en hours_en`）。`live-snapshot.json` は未更新（snapshot.js 未実行）。
  - CMS: 会場フォームに4欄、編集時の読込・両方の保存ペイロード・export・SHEET_FIELD_NAMES・buildVenuesJs・Publish 要約に追加。`scripts/check_cms_venue_access.mjs` を preflight に追加（54件目）。
- 会場詳細（JA/EN）: title「{NAME}（{読み}）{地域}｜クラブのアクセス・営業時間・イベント」（読み無しは「{NAME}（{地域}）｜…」）、description はアクセス→営業時間→紹介文の順（ローマ字住所で始めない）、上部に INFO（アクセス／住所＋Google マップ／タイプ／営業時間（無ければ「イベントにより異なります。公式サイトでご確認ください。」）／公式サイト／Instagram）、その会場で開かれたフェスと会場名に触れる記事の一覧、JSON-LD に alternateName（読み）。
- 下書きデータ: `reports/venues-access-draft-2026-10-19.csv`（22会場、出典と確度つき。アクセス 13、営業時間 2、徒歩分は推測しない）。

### 検証
- テスト worktree に下書きを一時注入して WOMB / OATH を 390px・1440px で目視（注入は破棄済み）。`bash scripts/preflight.sh` 全54件成功。
- **実機未確認**: CMS で新4欄の入力→保存→再表示→Publish Now（GAS の新列が実際に保存されるか）。公開後に確認する。

### 判断待ち・データの疑義
- SALOON の area が SHIBUYA（実際は UNIT と同じ建物＝代官山）。VENT の住所にビル名・階なし。TRIANGLE は公式サイトが 2012 年以降更新なし（閉店の可能性）。

## 2026-10-20 アーティスト詳細 Phase A 追加修正（未コミット）

### 実施
- 関連記事の名前一致を、名前だけでは採用せず、出演フェスの `festivalId` 一致または本文・タイトル内の出演フェスリンク／名称一致を必須とする規則へ変更。アーティストリンク一致は従来どおり保持。
- 名前一致は4文字以上・英数字境界・大小無視に戻した。直前の「5文字以下は大小区別」は撤回。
- FUJI×topia、Ground×Camp Ground、OCCA表記のデータ非依存テストを `check_artist_pages.mjs` に追加。
- `reports/artist-article-match-audit-2026-10-20.md` を再作成。最終一致54件（規則と名前一致の前後30字つき）、旧版の名前のみ判定84件から外れた30件を列挙。
- 詳細ページと sitemap を再生成。関連判定に使う出演フェスは LINEUPS の `ARTIST_ID(S)` → EDITIONS → `FESTIVAL_ID` で構築。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`、`python3 scripts/generate-sitemap.py` 成功（外部画像136件は前回寸法へフォールバック）。
- `node scripts/check_artist_pages.mjs`、`node scripts/check_titles.mjs`、`python3 scripts/check_regressions.py`、`git diff --check` 成功。
- sitemap は352 URL、アーティストは source 139件中30件（薄い109件をJA/ENとも除外）。

### 変更したパターン
- `artistNameMatches` の大小無視・境界規則、出演フェス文脈付き関連記事判定、監査一覧、静的検査テスト。

### 未確認の類似パターン
- 確認済み・0件：FUJI／Ground の文脈なし誤爆、OCCA の大文字表記、JA/EN生成、タイトルの省略記号混入。
- 実ブラウザ確認は未確認（Claude が実施予定）。

### 次の担当への注意・判断待ち
- 公開前に実ブラウザでアーティスト詳細の関連記事・出演予定／過去出演をJA/EN、PC/モバイルで確認すること。外部画像取得を含むフル preflight は環境制約を確認して実施すること。

## 2026-10-20 アーティスト出演予定カードのCSS修正（未コミット）

### 実施
- `LP/detail.css` の会場関連記事カード用ルールを `.artist-upcoming` にも適用。PCは3列、スマホはアーティスト予定のみ2列・gap 12px・名前14px。会場関連記事はスマホ1列のまま。
- `detail.css` を v62→v63 に更新。CMS記事プレビュー内の固定参照も v63 に変更し、`LP/cms.html` の `cms.js` を v151→v152 に更新。
- 詳細ページと sitemap を再生成。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`、`python3 scripts/generate-sitemap.py` 成功。外部画像136件は前回記録寸法へフォールバック。
- `python3 scripts/check_asset_versions.py`、`node scripts/check_artist_pages.mjs`、`node scripts/check_titles.mjs`、`python3 scripts/check_regressions.py`、`git diff --check` 成功。
- `bash scripts/preflight.sh` はコード系46件成功、詳細生成は外部画像取得タイムアウト、ブラウザ系8件は sandbox の localhost listen `EPERM` で失敗。
- 実ブラウザ確認は未確認（ユーザーが確認した再現症状に対するCSS修正。Claude が実施予定）。

### 変更したパターン
- `.artist-upcoming` の関連カード画像比率、グリッド列数、gap、カード名サイズ、detail.css/CMSキャッシュバージョン。

### 未確認の類似パターン
- 確認済み・0件：`.venue-related` のスマホ1列、PCの既存3列、アーティスト予定カードのJA/EN生成。
- 未確認：実ブラウザの390px/1280pxでの表示実測。

### 次の担当への注意・判断待ち
- ブラウザでJA/ENアーティスト詳細を390pxと1280pxで確認し、画像が4:3、本文列内、予定カードがスマホ2列になっていることを確認すること。
## 2026-10-20 CMS ジャンル空化防止（fix/cms-venue-genre）

### 実施
- VENUES/FESTIVALS のジャンル読込を `,`・`·`・`、` 分割に統一し、チップ照合を大文字小文字非依存に変更。ARTISTS を含む既存行のジャンル空化ガードを `saveEdit` に追加。FEATURES の既存 `;`/`,` 分割は保存形式（`; `）と一致するため維持。
- `scripts/check_cms_genre_roundtrip.mjs` を追加して preflight に接続。`LP/cms.html` の `cms.js` を `?v=152` に更新。

### コミット
- 未コミット（ユーザー指定、pushなし）。

### 検証
- `node scripts/check_cms_genre_roundtrip.mjs` 5件成功、`python3 scripts/check_asset_versions.py` 全件成功、`git diff --check` 成功。

### 変更したパターン
- `setSelectedGenres`、VENUES/FESTIVALS の `editRow` 読込、VENUE/FESTIVAL/ARTIST の既存ジャンル空化防止。

### 未確認の類似パターン
- 確認済み・0件：他の `setSelectedGenres` 呼び出し、シート値を読む `split(',')` のジャンル処理。実ブラウザの認証済みCMS保存は未確認。

### 次の担当への注意・判断待ち
- 公開前に `bash scripts/preflight.sh`（省略なし）と、CMS の入力→保存→再表示を実ブラウザで確認すること。CMS変更時は `Cmd+Shift+R` で強制リロードすること。
- `check_venue_details.mjs` の営業時間検査を JA/EN の生成規則と HTML エスケープに一致させた。

## 2026-10-20 記事本文画像のDrive移行（feat/article-images、未コミット）

### 実施
- `LP/data/article-image-map.json` を追加。旧 `reports/drive_image_migration_map.json` の実在80件を fileIdキー・`images/articles/...`値へ変換した。旧ファイルは監査資料として保持する。
- `scripts/sync-article-body-images.py` を追加。JA/EN・下書きを含む `body` / `body_en` からDrive画像を抽出し、未登録または実ファイル欠落だけを取得・EXIF回転・長辺1920・WEBP quality=85/method=6で変換する。429/5xx等は3回再試行し、失敗はwarningへ出して他画像を継続する。
- `.github/workflows/sync-drive-images.yml` の既存Drive同期後、派生画像生成前に本文画像同期を追加し、対応表もコミット対象へ追加した。
- `scripts/lib/article-body-images.mjs` と `build-detail-pages.mjs` に生成時置換を追加。対応表にあり実在する画像は `img src` をローカルへ置換し、同じ画像を包む `a href` もDrive URLならローカルへ置換する。対応表にないURLは保持する。`srcset`・寸法・lazy属性は既存のローカル画像処理へ渡す。
- `build-image-derivatives.py` の本文派生対象を、対応表の値と `ARTICLES.body` / `body_en` に直接書かれた `images/articles/...` に限定。対象件数を実行時に報告し、原本幅を超える派生は作らず、原本を最大候補として1回だけsrcsetへ入れる。対象外・旧重複派生はstale掃除の対象になる。
- 本文派生を `body-md=800` / `body-lg=1200` / `body-xl=1440` の3段・カードと同じ `QUALITY=80` に変更。本文専用画像（本文対象−ARTICLES.image）はカード用xs/sm/md/lgとhero/aspectを生成せず、`bodySrcset`だけを持つ。本文兼ヒーロー画像は従来どおりカード/hero系も保持する。
- 実測対応: 1440px超の原本は `bodySrcset` に原本を入れず、最大候補を1440pxに制限。原本幅1440px以下だけ原本を最大候補へ入れる。`src`属性は従来どおり原本のまま。
- ネットワーク環境で取り込み済みの全件生成物（818ファイル/89MB）は再生成していない。今回の分類では本文対象143件、ヒーロー20件、本文専用143件。本文専用はカード/hero/aspect派生をstale掃除し、body派生のみを残す設計。
- `scripts/check_article_body_images.mjs` を追加し、preflightへ接続した。
- `LP/data/` はService Workerのprecache対象ではなく、通常のネットワーク経路で配信される。既存の `check_sw_routing.mjs` の対象経路や他の `LP/data/*.json` の扱いは変更していない。
- `deploy-pages.yml` は `LP/**` のpushで起動し、デプロイ直前に `node scripts/build-detail-pages.mjs` を実行する。したがって、同期で対応表・画像が増えた次のデプロイで静的記事ページが再生成される。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `python3 scripts/sync-article-body-images.py --dry-run` 成功。本文画像は総数286箇所、ユニーク143 fileId、対応済み80、未対応63。取得予定は63件。
- 対応表80件中、実ファイル80件を確認。
- 置換関数を直接実行し、対応済み `src` / `href`、サイズ違い、既存 `srcset`、未対応URL、single quoteを確認。`drive.google.com/uc?...&id=` のID抽出も確認。
- `git diff --check` 成功。Pythonはネットワーク取得を実行していない。
- `article_body_sources()` の対象判定を確認。ヒーロー専用の `image` 列だけの画像は本文派生対象外。
- `image-derivatives.js` は `scripts/build-image-derivatives.py` が生成する。本文専用エントリに `src` が無くても、`build-detail-pages.mjs` と `LP/localize.js` は原本へフォールバックし、カード表示を壊さないよう修正した。既存のカード派生参照箇所は本文専用画像をカードとして使わない。
- `check_image_derivatives.py` / `check_image_delivery.mjs` も本文専用の `bodySrcset` と原本候補を検査できるよう更新した。
- 実測記録（Claude記入欄）: shifumiz 本文ページ — 前: 本番Drive 1,870KB / 後: 原本あり 2,990KB / 後: 原本なし（今回修正後）未測定。
- `build-detail-pages.mjs` の `bodySrcsetAttr()` が `bodySrcset`（原本候補を含む）を使い、既存の `sizes="(max-width: 700px) 100vw, 1200px"` を維持することを単体確認。
- 派生生成は実行していない。指定された無関係な既存派生差分は戻し、作業ツリーに派生差分を残していない（sandboxのindex lock制約により `git checkout --` は拒否されたため、作業ツリーへ逆パッチを適用）。
- `node scripts/build-detail-pages.mjs` はネットワーク制限下で既存の外部画像寸法取得が待ち続けたため中断。生成済み記事HTMLはそのため未再生成で、`check_article_body_images.mjs` の「対応済みDrive URLが生成物に残っていない」検査は、生成前の古いHTMLを検出して失敗する状態。CIまたはClaude実行環境で再生成後に再実行すること。
- 実ブラウザ確認、Driveからの実ダウンロード、ページ重量の変更前後測定は未確認（Claude が実施）。

### 変更したパターン
- `lh3.googleusercontent.com/d/<fileId>=w...` の本文 `img src`、および同URLを値に持つ本文 `a href` の生成時置換。
- `drive.google.com/uc?...id=<fileId>` / `drive.google.com/file/d/<fileId>` の同期スクリプト抽出。
- 本文画像の `images/articles/` への同期、対応表、preflight検査、Drive同期workflowのコミット範囲。
- 本文派生の対象判定、原本幅以下の候補生成、原本候補の重複排除、stale削除。
- 本文専用画像のカード派生・hero/aspect派生を生成しない分類と、派生manifestの原本フォールバック。

### 未確認の類似パターン
- 確認済み・0件：生成コード内にRSS本文・`llms-full.txt`・news SPA本文の別出力はなく、`LP/rss.xml` は記事概要のみ。生成済みHTMLと寸法表には旧Drive URLが残るが、再生成前の既存生成物である。
- 未確認：実データを取得した後の63件の画像変換結果、JA/EN静的ページの全件表示、実ブラウザでのPC/モバイル操作、利用者が受け取る全リソース重量。

### 次の担当への注意・判断待ち
- ネットワーク可能な環境で `python3 scripts/sync-article-body-images.py`、`python3 scripts/build-image-derivatives.py`、`node scripts/build-image-dimensions.mjs`、`node scripts/build-detail-pages.mjs` を実行し、対応表・派生画像・寸法表・JA/EN記事HTMLを同じ変更として確認すること。
- その後 `node scripts/check_article_body_images.mjs` と省略なしの `bash scripts/preflight.sh` を実行すること。実ブラウザでJA/EN・PC/モバイルの本文画像、リンク、寸法、srcset選択を確認するまで公開済みとは報告しないこと。
- 本文表示幅はスマホ100vw、PCは既存実測の最大1200px（`figure.fx-full` の実測拡大1332pxを含む）。本文用候補は原本幅に応じて800/1200/1440px以下だけを生成し、原本を最大候補にする。ネットワーク環境で全件生成後、本文専用画像にカード・hero/aspect派生が無いこと、manifestのbodySrcsetとstale削除を確認すること。
- `addLocalImageSrcset` は本文用 `bodySrcset` →従来のカード用 `srcset` →変更なしの順でフォールバックすることを単体確認済み。

### 2026-10-20 本番確認（ジャンル修正＋アーティスト詳細）— Claude
- 実施: main 59477f4b4 を push、Deploy success、Publish pipeline を手動実行し success（run 39361157017）。
- 検証（本番）: cms.html → cms.js?v=153。CMS を ?cb 付きで開き、VENUES 22件読込、womb/oath/liquidroom/circus-tokyo の editRow でシートのジャンルとチップが一致。`parseGenreValues('TECHNO · House · minimal')` → TECHNO,HOUSE,MINIMAL。**保存はしていない**（本番データ書き込みなし）。
- 検証（本番ページ）: /artists/dj-kensei・/en/artists/dj-kensei・/artists/ken-ishii は index、/artists/yama は noindex,follow。sitemap の /artists/ は 60件（JA30+EN30）。
- 実ブラウザ（テスト環境、headless 390px dpr2 iPhone UA / 1280px）: dj-kensei, en/dj-kensei, ken-ishii, yama, artists.html, venues/womb で横はみ出し0・壊れ画像0・JS 例外0。出演予定カードはスマホ2列/PC3列。
- 変更したパターン: 確認済み・上記の通り。未確認の類似パターン: CMS の FESTIVALS / ARTISTS の編集画面でのジャンル読込は未操作（検査 check_cms_genre_roundtrip.mjs のみ）。
- 次の担当への注意: push 中に別 worktree の preflight が走るとロックで push が止まる。push の10分間に自動コミット（popular / sync）が入ると rejected になるので origin/main を merge して再 push。

### 2026-10-20 本番確認（記事本文画像のサイト内移行）— Claude
- 実施: main b17d63af5 を push、Deploy success。Sync Drive Images を手動実行し success（run 39374964240、「143 unique, 0 to download」、差分コミットなし）。
- 検証（本番）: shifumiz / labyrinth / asia-festival-2026-second / sawagi-festival-2026-info / topia-2026-info の JA・EN 計10ページで `lh3.googleusercontent` 0件。
- 重量（CDP Network で外部ドメイン込み、キャッシュ無効、全スクロール後）:

| 記事 | 画面 | 前（本番・Drive） | 後（本番） | 解像度不足 前→後 |
|---|---|---|---|---|
| shifumiz | 390px dpr3 | 1,667KB | 1,574KB | 0/6 → 0/6 |
| asia-festival-2026-second | 390px dpr3 | 3,559KB | 3,353KB | 1/14 → 1/14 |
| labyrinth | 390px dpr3 | 1,722KB | 1,675KB | 1/8 → 1/8 |
| shifumiz | 1280px dpr2 | 1,870KB | 2,003KB | 4/6 → 1/6 |
| asia-festival-2026-second | 1280px dpr2 | 3,502KB | 3,951KB | 14/14 → 2/14 |
| labyrinth | 1280px dpr2 | 1,571KB | 1,676KB | 5/8 → 3/8 |

  原本1920を srcset に入れた版は PC で +30〜60%（shifumiz 2,990KB）になったため、最大候補を1440に制限した。
- 未確認の類似パターン: TOP の `img` 8枚が src 無し（naturalWidth 0）。移行前の main でも同じで本件とは無関係・目視で欠けは無し。iPhone 実機は未確認。
- 次の担当への注意: 新しい記事の Drive 画像は最長2時間後の同期で取り込まれ、次のデプロイで置換される。それまでは Drive 表示のまま（壊れない）。サイト全体 258MB → 301MB。

### 2026-10-20 アーティスト紹介文21人の入力と本番確認 — Claude
- 実施: reports/artist-bios-draft-2026-10-20.md の21人（ユーザー承認済み。Suimin も含む）を CMS から入力（BIO / bio_en、確度「高」のリンク、空欄だった CITY / COUNTRY）。1件ずつ保存し、シートから読み直して全員一致・name/genre/image 不変・総数173件を確認。保存時の送信項目は ARTISTS の全21列を含む（bio_en ほかは publishing 欄から送られる）。
- ユーザー確認: 「確認できず」と書いた出演（Feline / Kyomi / NOCO / Qmico / YELLOWUHURU / RISA TANIGUCHI / DJ KURI）は出演確認済み。「YAMA a.k.a. Sahib」ほかの YAMA は同一人物。Suimin の別名義（空中水泳）は問題なし。データ変更なし。
- 検証（本番）: Publish Now 後、21人の JA/EN ページすべてで紹介文あり・noindex なし。sitemap の /artists/ は 60→102件。
- 未確認の類似パターン: 紹介文の無いアーティストは残り88人（出演2回以下）。
- 次の担当への注意: 確度「中」で入れなかったリンク（Feline の IG、Herbalistek の SC、Qmico の IG など）は下書きファイルに記載。開いて本人確認すれば追加できる。

### 2026-10-20 フェスLINE UPと記事要約のモバイル表示修正 — 未コミット

### 実施
- `LP/detail.css` のフェス専用 `.detail-lineup-list .lineup-item` から `min-height: 44px` を外し、見た目優先で共通タップ領域の対象外にする理由をコメント化。後段の `padding: 9px 16px` により約32pxへ戻す。
- `.article-excerpt` を本文と同じ `word-break: normal; overflow-wrap: normal; text-wrap: wrap` に変更し、モバイルでは本文と同じ右端（`margin-right: -12px`）へ揃えた。見出しのBudouX指定と本文側は変更していない。
- `detail.css` を v63→v64、CMS記事プレビューの参照も v64 に更新。静的詳細HTML 544件の参照を v64 に更新した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `git diff --check`: 実行済み。
- `node scripts/build-detail-pages.mjs`: 外部画像寸法取得がネットワーク制限で再試行を続けたため中断。既存寸法を使う警告のみで、データ生成物は更新していない。
- `python3 scripts/check_asset_versions.py --no-diff`: 成功。
- `node --check LP/cms.js`: 成功。`git diff --check`: 成功。
- `bash scripts/preflight.sh`: 「詳細ページを生成できる」で外部画像寸法取得がネットワーク制限により長時間継続したため中断（exit 130）。全件成功ではない。
- 実ブラウザ確認: **Claude が実施**。iPhone相当390px・タッチ有効で `/festivals/transcendence.html` のLINE UP高さと `/articles/sawagi-festival-2026-info.html` の要約左右端・折り返しを確認済み。PC表示は未確認。

### 変更したパターン
- フェス詳細だけのLINE UP枠の最小高さと、記事要約のモバイル幅・折り返し。
- `detail.css` キャッシュバージョン（生成スクリプト、CMSプレビュー、静的詳細HTML）。

### 未確認の類似パターン
- 確認済み・0件：アーティスト詳細など、`.festival-design-v2` 外の `.lineup-item` のCSSは変更していない。
- 未確認：PC幅、記事JA/EN両言語の実ブラウザ表示、CMS認証済みプレビューの実ブラウザ表示。

### 次の担当への注意・判断待ち
- `python3 scripts/check_asset_versions.py` と省略なしの `bash scripts/preflight.sh` を実行すること。公開前に未確認のPC/JA・EN経路を実ブラウザで確認すること。
- CMSを開く場合は `?cb=<乱数>` を付け、変更後は `Cmd+Shift+R` で強制リロードすること。

### 2026-10-20 出演データのACT_LABEL（アーティストID/名前）解決 — 未コミット

### 実施
- `scripts/lineup-label-resolution.mjs` に、公開アーティストの名前一致または `ID_RE` 準拠のID一致を解決する共通関数を追加。
- `scripts/fetch-data.mjs` の正式 LINEUPS、旧互換モード、FESTIVALS.LINEUP 橋渡しの3経路を共通関数へ接続。`dj` は従来どおり、`live` は単独枠のみ、`b2b` と複合 live 枠は未解決のまま保持。draft/archived は除外。
- `scripts/check_lineup_label_resolution.mjs` を追加し、preflightへ組み込んだ。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/check_lineup_label_resolution.mjs`: 成功（ID一致、名前一致、live単独、live複合、b2b、draftの6件）。
- `node --check scripts/fetch-data.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 49件成功、9件失敗。今回のACT_LABEL検査は成功。詳細ページ生成は外部画像取得失敗で240秒タイムアウト、ブラウザ系8件は実行環境のlocalhost listen禁止（EPERM）で未完了。

### 変更したパターン
- 空の `ARTIST_ID` を持つ ACT_LABEL の公開アーティスト名一致・ID一致。
- 正式 LINEUPS、旧 `--from-festivals` 互換、旧 FESTIVALS.LINEUP 橋渡しの解決条件。
- `scripts/preflight.sh` の単体検査項目。

### 未確認の類似パターン
- 確認済み・0件：共通関数を呼ぶ3経路以外に、fetch-data内でACT_LABELをARTIST_IDへ解決する箇所は見つからなかった。
- 未確認：実データを再取得した本番相当の3経路出力、実ブラウザでのCMS操作、Publish pipeline。本件はPublish経路を変更したため、push後に Claude が Publish pipeline を流して確認すること。

### 次の担当への注意・判断待ち
- preflightが全件成功していないため、現時点で公開済みとは報告しないこと。ネットワーク/ブラウザ実行可能な環境で省略なしの `bash scripts/preflight.sh` を再実行すること。
- push後、Claude が Publish pipeline を流し、`cms: publish data.js` のコミットが実際に増えたことを確認すること。CMSを開く場合は `?cb=<乱数>` を付け、変更後は `Cmd+Shift+R` を使うこと。

### 2026-10-20 LINE UP 枠・要約の折り返し・出演データのつなぎ直し（本番確認）— Claude
- 実施: フェス LINE UP の min-height 44px を外し 32px に戻した（content-box で 62px になっていた）。記事要約を本文と同じ text-wrap / 幅に。fetch-data の ACT_LABEL 解決を「名前一致 or ID一致、live は複合でない完全一致も」に拡張（scripts/lineup-label-resolution.mjs）。LINEUPS シート9行を CMS から修正（702/768/771/931/980/981/984 は ACT_LABEL に ID が入っていた → ARTIST_ID へ、122 Tonbo の大文字ID、112 Doltz.）。ARTISTS doltz の NAME を「Doltz.」に。
- 検証（本番）: push 後 Deploy success、Publish pipeline success（run 39436923750）。dj-kensei に etsuetsu 2026 / Global Ark 2026・2025、tonbo に MATRICARIA 2026、doltz に MATRICARIA 2026、dj-krush に NU FESTIVAL 2026。iPhone 相当（390px dpr3 タッチ有効）で LINE UP 枠 32px、要約の左右端が本文と一致。
- 未確認: Doltz. の表示名は CMS の Publish Now 後に反映（data.js は CMS 側で生成）。
- 未確認の類似パターン: **CMS でフェスを保存すると、ACT_LABEL が空だった LINEUPS 行の ARTIST_ID が消える**（cms.js ~L4871 の keepId は ACT_LABEL と表示ラベルが一致したときだけ ID を残す）。2026-10-20 に MATRICARIA 2026 の全行で発生。fetch-data の名前解決で大半は再接続されるが、表記ゆれがあると切れる。要修正（判断待ち）。

### 2026-10-20 CMSフェス保存時のLINEUPS人物照合修正 — 未コミット

### 実施
- `LP/cms.js` の `syncLineupRowsForEdition` を行位置ではなく、正規化した ACT_LABEL / ARTIST_ID / ARTIST_DB の名前で未使用行へ照合する方式に変更。ACT_LABEL空の既存行も名前表示・ID保持し、SET_TYPE / STAGE / DAY / START / END を同じ人物から引き継ぐ。新規の既知アーティスト名・IDだけIDを付け、複合枠には付けない。
- 開催回読込時のタグ表示も ACT_LABEL 空なら ARTIST_ID のアーティスト名へフォールバック。`LP/cms.html` の `cms.js` キャッシュバージョンを v154→v155。
- `scripts/check_cms_lineup.mjs` に VM + fetch差し替えで送信 payload を検査する5ケースを追加。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/check_cms_lineup.mjs`：成功（既存13件 + 追加5ケース、全26件）。fetchを差し替え、ACT_LABEL空、先頭追加、削除、既知名・複合枠、並べ替えの送信内容を確認。
- `node --check LP/cms.js`：成功。`git diff --check`：成功。
- 省略なし `bash scripts/preflight.sh`：49件成功、9件失敗。詳細ページ生成は外部画像取得失敗で240秒タイムアウト、ブラウザ系8件は実行環境の localhost listen 禁止（EPERM）。今回追加の「LINEUP の入力」は成功。
- 実ブラウザ確認：未確認。Publish 経路を変更したため、**push 後に Claude が Publish pipeline を流し、CMS 実画面で送信内容を差し替え確認する**こと。CMS は `?cb=<乱数>` で開き、変更後は Cmd+Shift+R を使う。

### 変更したパターン
- ACT_LABEL空 + ARTIST_ID、先頭追加、1人削除、既知名前・IDの新規追加、複合枠、並べ替え時のLINEUPS保存。

### 未確認の類似パターン
- 確認済み・0件：SET_TYPE / STAGE / DAY / START / END は人物照合で同じ既存行から引き継ぐ実装を VM 送信検査に含めた。
- 未確認：実データを使ったCMS認証済み画面、Publish pipeline、実機ブラウザ。

### 次の担当への注意・判断待ち
- 本番データへは書き込まない。push後の Publish pipeline と CMS 実画面で fetch 差し替え相当の送信内容確認を行い、`cms: publish data.js` のコミット増加を確認すること。
- 追加修正：既存行の ARTIST_ID が空でも、既知の単独アーティスト名/IDと一致すれば保存時にIDを補完するテストを追加。

### 2026-10-21 CMS 出演データ保存の修正・news sitemap 自動再生成（本番確認）— Claude
- 検証（本番）: Deploy success（「Generate sitemaps for deployment」実行を確認）、Publish pipeline success（run 39449444200）、cms.js?v=155 配信。sitemap-news.xml は0件（48時間以内の記事なし＝正常）。
- CMS 実画面（global-ark-2026）で fetch を差し替え、保存時の送信内容だけを確認（**本番書き込みなし**）: 既存の ARTIST_ID 3件（dj-miku / dj-kensei / dj-yogurt）すべて保持、新たに ken-ishii / dj-sodeyama / risa-taniguchi / yoshinori-hayashi に ID が付く。
- 未確認の類似パターン（判断待ち）:
  - フェスを開くと、開催回のラインナップは FESTIVALS の EDITIONS 列（JSON）の控えが LINEUPS シートより優先される（cms.js loadEditionsFromSheet の pending マージ）。global-ark-2026 は控え40人・シート31人で、保存するとシートが控えの40人に置き換わる（9行追記）。どちらが正しいかは未確認。
  - CMS の ARTIST_DB が初期の37件のままのことがあり、その場合 ID しか分からない行は ACT_LABEL に ID 文字列が書かれる（ARTIST_ID は保持されるのでリンクは切れない。見た目のみ）。

### 2026-10-21 FESTIVALS.EDITIONS JSONの作業データ除去 — 未コミット

### 実施
- `LP/cms.js` のフェス保存 payload に `festivalEditionsForSave()` を追加し、FESTIVALS の EDITIONS JSON の送信コピーから `_sheetRow`（EDITIONS行の丸ごとコピー）と `_lineupRows`（LINEUPS行配列）を除去した。
- `_row` / `_editionId` は `syncExistingEditionRows` / `syncNewEditionRows` の照合に使っているため保存コピーに残した。FESTIVALS.EDITIONS の読込箇所（`editRow`、`loadEditionsFromSheet`、Publish前検査等）は表示用の開催回項目だけを読むため、除去した2プロパティには依存していない。
- 画面で使う元の `editions` 配列は変更しない。`LP/cms.html` の `cms.js` 参照を v155→v156 に更新した。
- 既に膨らんでいる34件は、次にそのフェスを保存したときに細くなる（今回の変更は既存セルを一括修復するものではない）。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_editions.mjs`: **全30件成功**。保存payloadのJSONに `_sheetRow` / `_lineupRows` が含まれないこと、元の `editions` 配列が変更されないことを追加検証した。
- `git diff --check`: 成功。
- `python3 scripts/check_asset_versions.py --no-diff`: preflight内の「?vの上げ忘れ」検査で成功。
- `bash scripts/preflight.sh`: **49件成功 / 9件失敗**。詳細ページ生成は外部画像取得タイムアウト、ブラウザ系8件はこの環境の localhost listen `EPERM`。したがって公開可能とは判定しない。
- 実ブラウザ確認: **未確認**。CMS変更のため、公開前に認証済みCMSを `?cb=<乱数>` で開き、フェス保存時の送信内容に `_sheetRow` / `_lineupRows` が無いことを確認すること。push後に Claude が Publish pipeline とCMS実画面の送信内容を確認すること。

### 変更したパターン
- FESTIVALS の `editions` 保存コピーから `_sheetRow` / `_lineupRows` を除外するパターン。
- `scripts/check_cms_editions.mjs` の保存payload回帰検査。
- `LP/cms.html` の `cms.js` キャッシュバージョン v155→v156。

### 未確認の類似パターン
- 確認済み・0件：`_sheetRow` / `_lineupRows` をFESTIVALS.EDITIONS JSONから読む箇所。
- 未確認：認証済み本番CMSの実画面での実送信内容、Publish pipeline、本番反映後の34件の個別セル縮小。これらは本番データへ書き込まず、送信内容の確認だけを行うこと。

### 次の担当への注意・判断待ち
- 省略なしの `bash scripts/preflight.sh` を実行し、全件成功するまでpushしないこと。現在の作業ツリーには本件以外の未コミット変更もあるため、差分を混ぜてコミットしないこと。
- push後、Claude が `gh workflow run "Publish pipeline"` を実行して成功を確認し、`cms: publish data.js` のコミット増加を確認すること。
- CMSは `?cb=<乱数>` で開き、変更後は Cmd+Shift+R。認証済み実画面で保存処理のfetchを確認し、元の画面配列が維持されることも確認すること。

### 2026-10-21 会場・アーティスト詳細ページの背景レイヤー追加 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` の `artistPage` と `venuePage` に `backgroundLayer: true` を追加し、JA/EN 詳細ページで共通背景 `.tj-bg` を生成するようにした。
- `scripts/check_artist_pages.mjs` に、artists / venues の JA/EN 詳細ページで `.tj-bg` がちょうど1つある検査を追加した。meta refresh のリダイレクトスタブは検査対象外とした。
- 詳細ページを再生成し、アーティスト139件×JA/EN、会場22件×JA/ENを更新した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/build-detail-pages.mjs`: 成功。
- `node --check scripts/check_artist_pages.mjs`: 成功。
- `node scripts/check_artist_pages.mjs`: 成功（artists 139、venues JA/EN各22、既存の索引・出演情報検査を含む）。
- `.tj-bg` 件数: `LP/artists` 139/139、`LP/en/artists` 139/139、`LP/venues` 22/22、`LP/en/venues` 22/22。各 live 詳細ページが1つ、リダイレクトスタブは artists JA/EN各8件で除外。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: **50件成功 / 9件失敗**。外部 Google 画像取得を含む詳細ページ生成が240秒でタイムアウト。ブラウザ系8件はこの環境の localhost listen が `EPERM`。公開可能とは判定しない。
- 実ブラウザ確認: **未確認（Claude担当）**。JA/EN のアーティスト詳細・会場詳細をPC/モバイルで開き、背景表示、ナビ操作、リンク遷移を確認すること。

### 変更したパターン
- `artistPage` / `venuePage` の JA/EN 詳細ページに `backgroundLayer: true` を渡すパターン。
- artists / venues の実ページだけを対象に、`.tj-bg` ちょうど1つを確認する既存チェッカーの回帰検査。
- 生成済み `LP/artists/*.html`、`LP/en/artists/*.html`、`LP/venues/*.html`、`LP/en/venues/*.html`。

### 未確認の類似パターン
- 確認済み・0件：リダイレクトスタブに `.tj-bg` を追加していないこと。
- 確認済み・0件：JA/EN の会場・アーティスト詳細で `.tj-bg` が0個または2個以上のページ。
- 未確認：実ブラウザでのPC/モバイル、JA/EN表示、背景とナビ・詳細リンクの操作。

### 次の担当への注意・判断待ち
- Claude が実ブラウザ確認を行い、URL・画面幅・操作・期待結果・実測結果を記録すること。
- `bash scripts/preflight.sh` の9件失敗は公開前に再確認すること。外部画像取得タイムアウトと localhost listen `EPERM` が環境起因であることを確認し、全件成功するまでpushしないこと。
- CMS変更・GAS変更・Publish pipeline実行は本件の対象外。実ブラウザ確認後も本番Publishは行わないこと。

### 2026-10-21 アーティスト詳細ページ上部の余白調整 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` の `artistPage` が出す `<article>` に JA/EN とも `artist-detail` クラスを追加した。
- `LP/detail.css` に `.artist-detail` 限定の余白規則を追加した。PC は上端101px、768px以下は28px（実測上、スマホでは `.detail-page` がナビ下端のtop54pxから始まるため）、eyebrow→名前は8px/6px、名前→chipsは14px/12px、chips→写真は20px/18px。
- 追加修正で `detail.css` の版を65→66へ上げ、`LP/cms.js` の記事プレビュー参照も66へ合わせた。
- 詳細ページを再生成し、JA/EN 各139件のアーティスト詳細へ反映した。写真・ジャンル無しの `/artists/yama.html` も生成結果を確認した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/build-detail-pages.mjs`: 成功。
- `node --check LP/cms.js`: 成功。
- `git diff --check`: 成功。
- JA/EN アーティスト詳細の `artist-detail`: 各139件。
- JA/EN アーティストハブ行数: 各1010行（一致）。
- 対象ページの `detail.css?v=66`: 再生成後に `taichi-kawahira` JA/EN、`yama` JAで確認済み。
- `bash scripts/preflight.sh`: **49件成功 / 9件失敗**。詳細生成は外部Google画像取得タイムアウト、ブラウザ系8件はこの環境の localhost listen `EPERM`。公開可能とは判定しない。
- `python3 scripts/audit_spa_vs_static.py --after`: **失敗**。既存比較基準に対し artist appearances 75→0、venue related_pages 21→0。今回の余白修正とは無関係だが要確認。
- 実ブラウザ確認: **未確認（Claude担当）**。スマホ390px、768px前後、PC1280pxで `/artists/taichi-kawahira.html`、JA/EN、`/artists/yama.html` の表示と操作を確認すること。
- 追加実測: スマホ390px/768pxでは `.detail-page` の開始位置がナビ下端（top54px）で、`padding-top:82px` がそのまま余白になっていたため、モバイル値を28pxへ修正。実ブラウザでの再確認は未実施。
- 追加検証: `node --check`（build script / cms.js）、`git diff --check`、JA/ENハブ行数一致（各1010行）に成功。
- `detail.css` v66反映後に `bash scripts/preflight.sh` を再実行: **49件成功 / 9件失敗**。結果は前回と同じく、詳細生成の外部Google画像取得タイムアウトとブラウザ系8件の localhost listen `EPERM`。公開可能とは判定しない。

### 変更したパターン
- アーティスト詳細の `artist-detail` クラス追加（JA/EN）。
- アーティスト詳細のナビ下、eyebrow、h1、chips、hero間隔のPC/モバイル限定調整。
- 詳細ページ全体の `detail.css` キャッシュ版更新。

### 未確認の類似パターン
- 確認済み・0件：会場・フェス・記事の `<article class="detail-page">` に `artist-detail` が付かないこと。
- 未確認：実ブラウザでの768px前後の境界、JA/ENの実表示、写真/ジャンル無し以外のアーティスト表示。

### 次の担当への注意・判断待ち
- 実ブラウザ確認は Claude が担当。CSS更新後は `?cb=<乱数>` または Cmd+Shift+Rでキャッシュを避けること。
- preflightの9件失敗が環境制限または外部画像取得以外の原因でないことを確認し、全件成功するまでpushしないこと。
- `audit_spa_vs_static.py --after` の既存基準差分（artist appearances / venue related_pages）は、本件と切り分けて判断すること。

### 2026-10-21 AI検索（GEO / AIO / LLMO）改善 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` に会場・アーティストの見えるFAQとFAQPageを追加。既存の `festivalFaqDetailsHtml()` / `festival-faq` 部品を流用し、データがある質問だけを出力した。
- 会場に今後の開催予定を含むFAQ、アーティストに紹介文がありnoindexでない場合だけ次回出演・拠点・過去出演FAQを追加した。アーティストは最大5フェス、関係JSON-LDは最大6件。
- 対象IDを含む `LP/data.js`、関連する `LP/data/editions.json` / `LP/data/lineups.json` のgit履歴の最大日を `dateModified` と最終更新日に使用。ビルド日・書込み日は使用せず、履歴が取れない場合は出力しない。
- アーティストに `performerIn`、会場に `event` を追加し、既存フェス詳細の `#festival` @idだけを参照。`detail.css` の版を66→67へ更新した。
- `scripts/audit_analytics.mjs --ai` とAI参照元定数、`scripts/check_jsonld.mjs` のFAQ・更新日・関係先検査を追加した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/build-detail-pages.mjs` / `scripts/audit_analytics.mjs`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功。JA/EN詳細563ページを再生成。
- `node scripts/check_jsonld.mjs`: 成功。FAQ件数一致、回答非空、dateModified未来日なし・複数日付、performerIn/event参照先実在を確認。
- `node scripts/audit_analytics.mjs --help`: `--ai` の説明を確認。
- 実ブラウザ確認: 未確認（Claude担当）。FAQ表示・開閉・関連リンク・更新日をJA/EN、PC/モバイルで確認すること。
- GA4 `--ai` 実行: 未実施（認証が必要、Claude担当）。
- `bash scripts/preflight.sh`: 49件成功 / 10件失敗。詳細生成は外部Google画像取得で240秒タイムアウト、ハブ/CMS/地図/モバイル系は実行環境のlocalhost listen EPERM。加えてCSS版更新後のCMSプレビュー固定値を67へ修正し、`check_cms_article_generated_preview.mjs` は成功。公開可能とは判定しない。

### 変更したパターン
- 会場FAQ（access / hours / genre / address / 今後の関連開催）。
- アーティストFAQ（次回出演 / city・country / 過去出演最大5件、紹介文あり・noindexなしのみ）。
- 詳細主エンティティの履歴日、見える最終更新日、`performerIn` / `event`、GA4 AI参照元比較、JSON-LD回帰検査。

### 未確認の類似パターン
- 確認済み・0件：FAQPageと見えるFAQ数の不一致、空回答、未来dateModified、関係先@idの参照切れ。
- 未確認：実ブラウザの全JA/EN・PC/モバイル操作、GA4認証済み実行、公開環境でのAI流入データ。preflightのlocalhost検査は環境制限で未完了。

### 次の担当への注意・判断待ち
- 公開前は `bash scripts/preflight.sh` を省略なしで実行し、全件成功までpushしない。
- 実ブラウザは `?cb=<乱数>` または Cmd+Shift+Rでキャッシュを避けて確認する。
- 認証済み環境で `node scripts/audit_analytics.mjs --ai --out=reports/analytics` をClaudeが実行し、直近28日/前28日の結果を記録する。

### 2026-10-21 dateModified台帳方式への変更 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` のpickaxe（`git log -S`）方式を削除し、`LP/data/content-dates.json` を追加した。
- アーティストはデータ行＋出演（開催回ID・日付・会場）、会場はデータ行＋今後の関連開催、フェスはデータ行＋全開催回＋開催回ごとの出演データを、キー順JSON化してSHA-256化する方式に変更した。
- ハッシュ一致時は台帳日付を維持し、不一致・新規時はJST当日を使う。初回は既存 `LP/sitemap.xml` のlastmodを使い、sitemapにないnoindexアーティストは日付空欄で表示しない。
- `scripts/check_jsonld.mjs` に台帳の存在、全キーのhash/date、未来日、現在データとのhash一致、不要キーの検査を追加した。
- `deploy-pages.yml` / `publish-pipeline.yml` / `generate-meta.yml` はいずれも `git add -A LP/` のため、台帳もコミット範囲に含まれることを確認した。workflow変更は不要。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `LP/sitemap.xml` 初期値確認: `venues/womb.html`=`2026-10-21`、`artists/dj-kensei.html`=`2026-10-21`。
- 生成後の表示/JSON-LD: WOMB=`2026-10-21`、DJ KENSEI=`2026-10-21`、Global Ark=`2026-08-21`。
- `node scripts/check_jsonld.mjs`: 成功。台帳252キーのhash/date一致、未来日なし、不要キーなし。
- 台帳方式のビルド: 既存画像寸法を再利用した実測で1.14秒（台帳処理自体の増加は確認できない）。通常ビルドは外部画像143 URLの取得失敗・3回再試行により5分20秒で中断し、画像取得がボトルネック。約70秒からの増加原因は台帳ではない。
- `git diff --check`: 成功。pickaxeコード残存なし。
- 実ブラウザ確認・GA4実行: 未確認（前項から引き続きClaude担当）。

### 変更したパターン
- `content-dates.json` の安定ソート台帳、対象データの正規化ハッシュ、sitemap初期値、変更時のJST日付更新。
- dateModified / 最終更新日の参照元を台帳へ変更。
- 台帳整合性検査。

### 未確認の類似パターン
- 確認済み・0件：pickaxe参照、台帳hash不一致、未来日、不要キー、workflowの台帳コミット漏れ。
- 未確認：外部画像取得が成功する環境での通常フルビルド時間、実ブラウザでの更新日表示、公開後の台帳コミット。

### 次の担当への注意・判断待ち
- `LP/data/content-dates.json` は生成物として必ずコミットする。`git add -A LP/` の範囲から外さない。
- データ変更後は台帳と詳細ページを同じビルドで更新する。sitemap生成を先に行うと、初回値の参照元が変わるため順序に注意する。
- 公開前は省略なしの `bash scripts/preflight.sh` と、Claude担当の実ブラウザ確認を行う。

### 2026-10-21 content-dates初期値の履歴種まき — 未コミット

### 実施
- `scripts/lib/content-dates.mjs` を追加し、ビルドと種まきで同じ `contentRow` / キー順正規化 / SHA-256 `contentHash` を共有した。
- `scripts/seed-content-dates.mjs` を追加。`git log --reverse --format='%H %cs' -- LP/data.js LP/data/editions.json LP/data/lineups.json` を古い順に処理し、各コミットの3ファイルを `git show` で復元して、データhashが変わった最後の `%cs` を初期dateにした。読めない履歴はスキップした。
- sitemap lastmodを初期値に使うロジックをビルドから削除した。通常ビルドは既存台帳のhash一致時は日付を維持し、不一致時だけJST当日へ更新する。
- 種まき後の台帳は252キー。キーは現在の公開アーティスト・会場・フェスだけに整理した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/seed-content-dates.mjs`: 成功。142件の履歴コミットを処理。
- 日付分布上位: `2026-09-15` 86件、`2026-10-20` 72件、`2026-08-03` 28件、`2026-09-10` 12件、`2026-10-17` 8件。2026-10-21は0件で、sitemap由来の一括当日化を解消した。
- 対象確認: WOMB=`2026-10-20`、DJ KENSEI=`2026-10-20`、Global Ark=`2026-10-20`、ken-ishii=`2026-10-20`。Global Arkの該当コミットは `%cs` が2026-10-20（コミット時刻はUTC 2026-10-20 16:07、JSTでは10月21日未明）のため、指定された`%cs`規則では10月20日になる。
- 台帳方式の生成（既存画像寸法を再利用）: 約1.04秒。台帳処理で約70秒から増加していない。通常の外部画像取得はネットワーク失敗時に長時間化するため別問題。
- `node scripts/check_jsonld.mjs`: 成功。252キーのhash/date一致、未来日なし、不要キーなし。
- `node --check scripts/seed-content-dates.mjs scripts/build-detail-pages.mjs scripts/check_jsonld.mjs`: 成功。
- `git diff --check`: 成功。
- 実ブラウザ確認・GA4実行: 未確認（Claude担当）。

### 変更したパターン
- sitemap初期値依存の削除。
- 履歴コミットを使う一度きりの台帳種まき。
- ビルド・種まき共通の正規化/hashモジュール。
- 台帳の現在hash整合性検査。

### 未確認の類似パターン
- 確認済み・0件：現在データ252キーのhash不一致、date欠落、未来日、不要キー。
- 未確認：外部画像取得が成功する環境でのフルビルド時間、公開後の台帳コミット、実ブラウザ表示。

### 次の担当への注意・判断待ち
- `scripts/seed-content-dates.mjs` は一度きりの初期化用。通常の公開更新で再実行すると、意図的な変更履歴を再計算するため、実行前に日付台帳を確認すること。
- `LP/data/content-dates.json` と `scripts/lib/content-dates.mjs` を含めてコミットする。workflowは既存の `git add -A LP/` で台帳を含む。
- 公開前は省略なしの `bash scripts/preflight.sh` とClaude担当の実ブラウザ確認を行う。

- 2026-10-21: 会場・アーティストFAQにもフェスFAQと同じCSSを適用（`detail.css` v67→v68、CMSプレビュー参照も更新）し、JA/EN詳細ページを再生成。静的検査済み、実ブラウザ再確認は未実施。
- 2026-10-21: 会場詳細のJA/EN生成`article`へ`venue-detail`を付与して再生成。`detail.css`内の該当クラス規則はFAQ 7件のみで、他の見た目規則への波及なし。
- 2026-10-21: 会場詳細の上部余白をアーティスト詳細と同値に統一（PC/スマホ、`detail.css` v68→v69、CMSプレビューも更新）し、JA/ENを再生成。

### 2026-10-21 GA4 Data APIによるAI流入集計 — 未コミット

### 実施
- `scripts/lib/ga4-api.mjs` を追加し、JWT作成・サービスアカウント検証・アクセストークン取得・GA4 `runReport` を共有化。`fetch-popular.mjs` は同じレポート本文と `popular.json` 出力形式を維持したまま共有モジュールを使用。
- `scripts/fetch-ai-referrals.mjs` を追加。JST基準の直近28日/前28日を、AI参照元の正規表現フィルター付きと全体の2レポートで取得し、参照元別・ランディングページ上位20・全体セッション・AI割合をJSON/Markdownへ出力。`--dry` は書き込まない。`GA4_SA_KEY` 未設定時は終了。
- `.github/workflows/popular.yml` の人気記事取得後にAI流入取得を追加し、2つのレポートを既存のコミット手順へ追加。`workflow_dispatch` は既存のまま。
- `scripts/audit_analytics.mjs` の画面操作による `--ai` 経路を削除し、ヘルプをGA4 APIスクリプトへ案内する形に変更。
- `scripts/test_fetch_ai_referrals.mjs` を追加し、モック応答で期間、フィルター、集計、割合、0件時、Markdown形式を確認。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/lib/ga4-api.mjs scripts/fetch-popular.mjs scripts/fetch-ai-referrals.mjs scripts/audit_analytics.mjs`: 成功。
- `node scripts/test_fetch_ai_referrals.mjs`: 成功（GA4応答モック）。
- `GA4_SA_KEY` 未設定で `fetch-popular.mjs` と `fetch-ai-referrals.mjs` を実行: いずれも書き込まず正常終了。
- `node scripts/audit_analytics.mjs --help`: AI流入を `fetch-ai-referrals.mjs（GA4 API）` へ案内することを確認。旧 `--ai` はエラー終了。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 50件成功 / 9件失敗。詳細生成は外部Google画像取得で240秒タイムアウト、ハブ/CMS/地図/モバイル系は実行環境のlocalhost listen EPERM。公開可能とは判定しない。
- GA4認証済みの実データ取得、GitHub Actions実行、実ブラウザ確認: 未確認（ClaudeがGitHub Actionsで実行）。

### 変更したパターン
- GA4サービスアカウントJWT認証とData API `runReport` の共有化。
- `sessionSource` / `landingPagePlusQueryString` のAI参照元フィルター、2期間のセッション・ユーザー集計、全体セッション比率。
- `reports/ai-referrals.json` / `reports/ai-referrals.md` の定期生成とworkflowコミット対象。
- GA4画面操作による `audit_analytics --ai` の廃止。

### 未確認の類似パターン
- 確認済み・0件：モックによるAIフィルター、参照元別集計、ランディングページ上位20、全体0件時の割合、dry-run、秘密情報なしの終了。
- 未確認：実GA4での権限・レスポンス列順・実データ、`totalUsers` の参照元/ランディングページ別集計、Actions上のコミット、実ブラウザ操作。

### 次の担当への注意・判断待ち
- Claudeが認証済みGitHub Actionsの手動実行（Monthly popular）で `fetch-ai-referrals.mjs` を実行し、`reports/ai-referrals.*` の内容とコミットを確認すること。
- 実行後にGA4の `totalUsers` 集計が重複を含む仕様で問題ないか、必要なら参照元別・ランディングページ別に別レポートを分ける判断をすること。
- 公開前は省略なしの `bash scripts/preflight.sh` を全件成功まで再実行する。今回の失敗は外部画像取得/localhost制限のため、解消後に再確認する。

- 2026-10-21: `popular.yml` のAI流入取得を `continue-on-error: true` にし、AIレポートが無い場合は存在するファイルだけを `git add` するよう修正（未コミット）。
- 2026-10-21: `check_cms_publish_guard.mjs` を逐次送信タスク＋`runGasWrites` 前提に更新し、LINEUPSの掃除・追記・空白化・別人ID非継承を実送信payloadで検証（全44件成功）。

### 2026-10-21 新規フェスの開催回同期とLINEUPS再送 — 未コミット

### 実施
- `submitToSheet('festival')` の `add_festival` 成功後、保存前に作った開催回のコピーを保持し、`loadEditionsFromSheet` 成功後に既存のEDITIONS upsert / LINEUPS同期経路へ渡すよう修正した。シート未読込時は書き込まず、「フェスは保存しました。開催回の保存に失敗したので、フェスを開き直して保存してください」と表示する。
- EDITIONS / LINEUPSの書き込みタスクを逐次実行する `runGasWrites` を追加した。各GAS書き込み結果を確認し、失敗した行だけ1回再送し、2回失敗したら `aiFail` の消えないパネルへ出演者名付きで表示する。
- `saveEdit` の既存回同期と新規回同期も逐次化し、GASへの同時書き込みを避けた。
- `LP/cms.html` のキャッシュバスターを `cms.js?v=161` に更新した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node scripts/check_cms_editions.mjs`: 成功（全36件。新規フェス相当のEDITIONS/LINEUPS書き込み、シート未読込時の停止を含む）。
- `node scripts/check_cms_lineup.mjs`: 成功（全30件。1回再送、2回失敗時の表示を含む）。
- `git diff --check`: 次担当が最終確認すること。
- 実GAS書き込み、Publish pipeline、CMS実画面、新規フェスの実ブラウザ保存操作: 未確認。push後にClaudeが確認すること。本番データへの書き込みは行っていない。

### 変更したパターン
- 新規フェス `add_festival` 成功後のEDITIONS / LINEUPS同期。
- GAS書き込みの逐次実行、失敗行の1回再送、最終失敗の永続エラー表示。
- `saveEdit` 内の開催回同期順序。
- CMSキャッシュバスター更新と回帰検査。

### 未確認の類似パターン
- 確認済み・0件：新規回のEDITIONS/LINEUPS書き込み、シート未読込時の無書き込み、成功/1回失敗/2回失敗の同期検査。
- 未確認：実GASの同時実行制限下での挙動、18件以上の実LINEUPS、既存行更新と空白化を含む実ブラウザ操作、Publish後の静的詳細ページ。

### 次の担当への注意・判断待ち
- push後にClaudeがCMSへ `?cb=<乱数>` 付きで入り、新規フェスを日程・LINEUP付きで保存し、EDITIONS/LINEUPSの追記と再表示を確認すること。
- 実データで失敗した場合は、永続パネルの出演者名・行番号を記録してから再試行すること。
- `bash scripts/preflight.sh` を省略せず全件成功させるまでpushしないこと。

### 2026-10-21 開催回（EDITIONS）が無いフェスのLINE UP再発防止 — 未コミット

### 実施
- `LP/cms.js` のフェス保存時、開催回が0件かつ日程がある場合に、その年の開催回を自動作成する救済を追加した。フォームの日程・会場・住所・座標・地域・チケットURL・フライヤー・状態と `lineups.f` を引き継ぎ、既存の `syncNewEditionRows` / LINEUPS同期経路へ渡す。手動のAdd Editionとは共通の初期値関数を使用する。
- `scripts/fetch-data.mjs` の正式EDITIONS経路で、公開フェスに対応するEDITIONSが無い場合、FESTIVALSのDATE等から `{festivalId}-{年}` の `SYNTHESIZED: '1'` 開催回を補う。旧FESTIVALS.LINEUP橋渡しの `resolveActLabel` をそのまま通し、警告を出す。
- `LP/cms.html` の `cms.js` キャッシュバスターを `?v=160` に更新した。
- `scripts/check_fetch_data_editions.mjs` とCMS既存検査への回帰ケースを追加し、preflightにも登録した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node --check scripts/fetch-data.mjs`: 成功。
- `node scripts/check_fetch_data_editions.mjs`: 成功（EDITIONS無し＋DATEあり / DATE無し / EDITIONSあり）。
- `node scripts/check_cms_editions.mjs`: 成功（全35件。開催回0件＋日程あり、LINEUP引継ぎ、日程なし、既存回ありを含む）。
- `bash scripts/preflight.sh`: 開始したが、既存の「詳細ページを生成できる」ステップが外部画像取得待ちで長時間継続したため、他の検査へ進む前に手動停止。全件成功ではないため、次担当が再実行すること。
- Publish pipeline、CMS実画面のPublish Now、実ブラウザでの保存操作、実機確認: 未確認。push後にClaudeがPublish pipelineを実行し、CMSを強制リロードして実画面確認すること。本番データへの書き込みは行っていない。

### 変更したパターン
- CMSの開催回ゼロ＋日程あり保存時の自動開催回生成と、既存同期経路への接続。
- 正式EDITIONS経路におけるFESTIVALSからの開催回・LINEUP橋渡し。
- `SYNTHESIZED`内部フラグと補完警告、cms.jsのキャッシュバスター更新。
- fetch-data / CMSの境界条件回帰検査。

### 未確認の類似パターン
- 確認済み・0件：日程なし、既存EDITIONSあり、既存Add Editionの初期値、補完回の年ID、CMSフォーム値とLINEUP引継ぎ。
- 未確認：実GAS保存、既存EDITIONSとLINEUPSが混在する実データ、build-detail-pages.mjsでの補完回の実生成、JA/EN・PC/モバイルの実ブラウザ表示。

### 次の担当への注意・判断待ち
- push後にClaudeが `Publish pipeline` を実行し、`SYNTHESIZED` 回のLINE UP・開催ヒストリー・JSON-LDを確認すること。
- CMSは `cms.html?cb=<乱数>` またはCmd+Shift+Rで強制リロードし、新規フェスの入力→保存→EDITIONS/LINEUPS追記を認証済み実画面で確認すること。
- `bash scripts/preflight.sh` が全件成功するまでpushしないこと。今回の作業ではcommit・push・本番データ書き込みをしていない。

### 2026-10-21 開催回の無いフェスの LINE UP 修正と再発防止（本番確認）— Claude
- 原因: CMS の新規フェス保存（submitToSheet / add_festival）は FESTIVALS だけを書き、EDITIONS / LINEUPS を書かなかった。resonance / prox / soul-beat-asia / car-multimedia の4件が該当。
- データ修正（CMS 経由、保存後にシートで確認）: 4件に2026年の開催回を作成。soul-beat-asia-2026 は LINEUPS の行1599（Noripan）だけ書き込みが黙って失敗していたため、空行を確認してから書き込み。car-multimedia-2026 は STATUS=draft で作られ公開処理が除外していたため published に。
- 再発防止（cms.js v161 / fetch-data.mjs）: 新規保存でも開催回と出演データを書く（無ければ日程から自動作成）／LINEUPS 書き込みを逐次化・失敗は1回再送・2回失敗で名前つきの消えないパネル／公開時に EDITIONS の無い公開フェスは FESTIVALS から開催回を補う（SYNTHESIZED、警告あり）。
- 検証（本番）: preflight 全60件成功 → push、Deploy success、Publish pipeline success（run 39554802521）。LINE UP 表示 resonance 6 / prox 20 / soul-beat-asia 18 / car-multimedia 9。cms.js?v=161 配信。
- 未確認: 新規フェス作成の画面操作そのものは本番では未実施（本番データを作るため）。検査 check_cms_editions.mjs（37件）で送信内容を確認済み。
- 次の担当への注意: CMS の作業中にタブが固まったときは、別タブでシート（gviz）を読んで途中状態を確かめてから続ける。

### 2026-10-21 Search Console「イベント」必須項目欠落の修正 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` に `editionEventLd` を追加し、フェス詳細の開催回・アーティストの `performerIn`・会場の `event` で開催回データ（`name` / `startDate` / `endDate` / `eventStatus` / `location` / `url`）を共通生成するよう修正した。
- `startDate` または開催回の実データとしての location が無い場合、アーティスト・会場の参照イベントは出さない。関係先の `@id` は既存の `#festival` を維持した。
- `scripts/check_jsonld.mjs` に、全 JSON-LD を再帰的に走査して Event / Festival / MusicEvent の `name`・`startDate`・`location` を確認する検査を追加した。修正前は 68 件を検出した。
- JA/EN 詳細ページを再生成し、JA/EN ハブの静的リンク行数一致を確認した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/check_jsonld.mjs`: 成功。Event / Festival / MusicEvent 必須項目の欠落 0 件。
- `python3 scripts/check_regressions.py`: 成功。JA/EN ハブ静的リンク行数差分 0 件。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 51件成功 / 9件失敗。詳細ページ生成は外部画像取得待ちで240秒タイムアウト、ハブ/CMS/地図/モバイル系の実ブラウザ検査は実行環境の localhost listen EPERM。JSON-LD検査を含む他の検査は成功。
- 実ブラウザでの Search Console 反映確認、Publish pipeline、実機確認: 未確認。今回の変更は静的 JSON-LD 生成で、公開はしていない。

### 変更したパターン
- アーティスト詳細の `performerIn` と会場詳細の `event` に、該当開催回の実データを持つ最小 `Festival` ノードを生成。
- フェス詳細の開催回 JSON-LD と参照イベントの開催回データ生成を `editionEventLd` に共有。
- JSON-LD 内のネストした Event 系ノード必須項目検査。
- JA/EN 詳細ページの再生成。

### 未確認の類似パターン
- 確認済み・0件：全ページの `Event` / `Festival` / `MusicEvent` の `name`・`startDate`・`location` 欠落、JA/EN ハブ行数差分、JSON-LD パースエラー。
- 未確認：実ブラウザでの JA/EN・PC/モバイル表示、Google Search Console の再クロール後のリッチリザルト状態、Publish pipeline。

### 次の担当への注意・判断待ち
- 公開前に環境制限を解消して、省略なしの `bash scripts/preflight.sh` を全件成功させること。特に外部画像取得と localhost listen の失敗が残っている。
- 公開後は `artists/<id>.html` と `venues/<id>.html` の JSON-LD を実ブラウザまたは取得 HTML で確認し、Search Console のイベント拡張結果を再確認すること。
- CMS変更・本番データ書き込み・Publish pipeline実行は行っていない。

### 2026-10-21 Search Console「イベント」警告対策（追加）— 未コミット

### 実施
- `scripts/build-detail-pages.mjs` の `eventLdShared` / `editionEventLd` と記事内イベント生成を更新。FESTIVALS.URL がある場合だけ organizer、開催回またはフェスのチケットURLがある場合だけ offers、開催回フライヤー→フェスフライヤー→フェス画像の順で image、言語別 desc、実データの住所、同じ開催回の eventStatus/endDate を出すようにした。
- 記事内イベントは既存の `festivalId` と日付一致する開催回、VENUE_IDまたは会場名で住所を解決し、未紐付け・住所なしは推測で補完しない。offers に price / priceCurrency / validFrom / availability は出力しない。
- `scripts/check_jsonld.mjs` に全561件の Event / Festival / MusicEvent 集計、URL形式、価格系キー混入検査を追加。JA/EN詳細ページを再生成し、ハブ行数一致を確認した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。変更ファイルは生成物を含む258件。

### 検証
- `node scripts/check_jsonld.mjs`: 成功。endDate欠落0、eventStatus欠落0、organizer.url/offers.url不正0、価格系キー0。
- `git diff --check`: 成功。
- 修正前後の同一集計（全561件）: organizer 561→301、offers 349→226、image 145→28、description 137→28、address 77→207、endDate 0→0、eventStatus 0→0。
- `bash scripts/preflight.sh`: 51件成功 / 9件失敗。詳細ページ生成は外部画像取得待ちで240秒タイムアウト、ブラウザ系は環境の localhost listen EPERM。JSON-LDを含む他の検査は成功。
- 実ブラウザ、Publish pipeline、Search Console再クロール、本番データ書き込み: 未確認・未実施。

### 変更したパターン
- フェス詳細の親 Festival、subEvent、アーティスト・会場参照イベント、記事内 Event の organizer / offers / image / description / address / endDate / eventStatus。
- 記事イベントの開催回・会場住所解決と、JSON-LD全件の警告項目集計・価格系混入防止。
- JA/EN詳細生成とハブ行数検査。

### 未確認の類似パターン
- 確認済み・0件：全Event系ノードのendDate/eventStatus欠落、URL形式不正、価格系キー混入、JSON-LDパースエラー、JA/ENハブ行数差分。
- 未確認：実ブラウザのPC/モバイル表示、Search Console反映、Publish pipeline、本番取得HTML、外部画像取得がタイムアウトしない環境でのpreflight全件。

### 次の担当への注意・判断待ち
- localhost listen と外部画像取得の環境制限を解消し、省略なしの `bash scripts/preflight.sh` を全件成功させるまでpushしないこと。
- 公開前に記事イベント、フェス詳細、アーティスト、会場のJA/ENページを実ブラウザで確認し、公開後はSearch Consoleのイベント拡張結果を再確認すること。
- 今回はcommit・push・Publish pipeline・本番データ書き込みを行っていない。

### 2026-10-21 Search Consoleイベント住所項目の追加修正 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` に `postalAddressLd()` / `editionAddressLd()` を追加し、`streetAddress` / `addressLocality` / `addressRegion` / `addressCountry` を空でない項目だけで PostalAddress にした。1項目以上ある場合は address を出し、全項目が無い場合だけ省略する。
- 開催回は ADDRESS・CITY・PREF・JP、記事内イベントは開催回または会場の利用可能項目を使用。`Secret location` など推測できない住所は補完しない。
- `scripts/check_jsonld.mjs` に空文字の住所項目検査を追加し、JA/EN生成物を再生成した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/check_jsonld.mjs`: 成功。全561件、address欠落0、endDate欠落0、eventStatus欠落0、organizer=301、offers=226、image=28、description=28、空文字住所項目0、価格系キー0。
- `git diff --check`: 成功。
- `fix/event-ld` の生成物との同一集計: address 77→0、organizer 561→301、offers 349→226、image 145→28、description 137→28、endDate 0→0、eventStatus 0→0。
- `bash scripts/preflight.sh`: 今回は省略（前回実行で外部画像取得タイムアウトと localhost listen EPERM が発生）。実ブラウザ、Publish pipeline、Search Console再クロール、本番データ書き込みも未確認・未実施。

### 変更したパターン
- フェス詳細・アーティスト・会場・記事イベントの `location.address` 項目別生成。
- 空文字項目を出さない住所生成と全Event系ノードの住所欠落・空文字検査。
- JA/EN詳細ページ再生成。

### 未確認の類似パターン
- 確認済み・0件：address欠落の増加、空文字住所項目、organizer/offers/image/description/endDate/eventStatusの悪化、URL形式不正、価格系キー混入。
- 未確認：実ブラウザのPC/モバイル表示、Search Console反映、Publish pipeline、localhost制限を解消したpreflight全件。

### 次の担当への注意・判断待ち
- 公開前に省略なしの `bash scripts/preflight.sh` を再実行し、外部画像取得と localhost listen の制限を解消すること。
- 公開前後に記事・フェス・アーティスト・会場のJA/ENページを実ブラウザで確認し、Search Consoleのイベント拡張結果を再確認すること。
- 今回もcommit・push・Publish pipeline・本番データ書き込みは行っていない。

### 2026-10-21 ニュースレター写真つき2列カード — 未コミット

### 実施
- `scripts/newsletter-draft.mjs` を Markdown 箇条書きから table / inline style の完全なHTML下書き生成へ変更。フェス候補最大6枚、先月記事、写真のある出演予定アーティストを2列カード化し、写真のないアーティストはリンク列にした。
- 追加確認対応: フェス表示名をサイトと同じ規則へ戻し、全体を固定レイアウトの最大600px列に統一。390pxでも外枠・カード・一覧が縮小・折り返す指定に更新。見出し・区切り線・ひとこと欄も `colspan="2" width="100%"` に統一。
- `LP/image-derivatives.js` の派生画像を優先して絶対HTTPS URL化し、カード背景は #1b1b1b（#f0ede8 8%を #080808 に混色）にした。Buttondown API は同件名の draft のみ PATCH、なければ POST。`template: "naked"` と解除リンクを付けた。
- `scripts/check_newsletter.mjs` にHTML、色、画像URL、UTM、2列、draft限定更新の検査を追加。`docs/newsletter.md` に公式仕様とNakedテンプレートの注意を追記。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/newsletter-draft.mjs --dry --month=2026-11`: JA/ENの完全HTMLを生成（各約19KB）。
- `node --check scripts/newsletter-draft.mjs scripts/check_newsletter.mjs`: 確認済み。
- `node scripts/check_newsletter.mjs`: 成功。Buttondown 44フォーム、HTML下書き2本、カードセル28、formsubmit専用項目0件。
- インプロセスAPIモック: 同件名の `draft-ja` のみPATCH、同件名の `sent-ja` は未変更。localhost listen はEPERMのため未使用。
- Buttondown実API、実ブラウザ、メールクライアント表示、preflight、Publish pipelineは未実施。APIの送信済み保護は静的検査のみ。

### 変更したパターン
- 月次下書きのHTML化、派生画像URL、カード2列、奇数時の空セル、JA/EN文言、draft同件名PATCH。

### 未確認の類似パターン
- 確認済み・0件：生成HTML内のclass/styleタグ/flex/grid、許可外の6桁色、非HTTPS画像、通常リンクのUTM欠落、カードセル数の奇数。
- 未確認：Gmail / Outlook / iOS Mailでの実表示、Buttondown実アカウントでのNakedテンプレート適用、APIモックを使った実PATCH分岐。

### 次の担当への注意・判断待ち
- `node scripts/check_newsletter.mjs` を実行し、必要ならButtondown APIモックでdraftだけがPATCHされることを確認すること。
- `reports/newsletter/2026-11-ja.html` と `-en.html` はブラウザで開いて確認する。Naked mode はProfessional planの公式仕様で、Buttondown設定でもNakedを選ぶ必要がある。
- 今回もcommit・push・Publish pipeline・本番データ書き込みは行っていない。

### 2026-10-21 Search Console「イベント」エラー・警告の対策（本番確認）— Claude
- 原因（エラー）: 同日追加の artist performerIn / venue event が `{@type, @id}` だけを出し、Google が name/startDate/location の無いイベントとして無効扱い（全ページ68個）。共通関数 editionEventLd で実データ（名前・日付・開催状況・会場・住所・URL）を入れ、0個に。check_jsonld.mjs に必須3項目の検査を追加。
- 警告（全561イベント、前→後）: organizer 561→301（公式サイトのあるフェスのみ）、offers 349→226（チケットURLのあるもののみ。価格系は入れない）、image 145→28、description 137→28、address 77→0（あるパーツだけで PostalAddress。空文字は出さない）、endDate/eventStatus 欠落0。一度 address が 207 に悪化したのを前後比較で検出して修正。
- 検証（本番）: preflight 全60件 → push、Deploy success。artists/sunga・festivals/topia・articles/topia-2026-info・en/artists/dj-kensei でイベントの必須欠落0。
- 次の担当への注意・判断待ち: Search Console で「修正を検証」はユーザー操作。sawagi-festival-2026 の EDITIONS.PREF が Yamanashi のまま（住所は群馬）。push 時に「詳細ページを生成できる」が外部画像取得の遅延で 240s 超になることがある（再実行で通る）。

### 2026-10-21 Buttondown移行準備 — 未コミット

### 実施
- `scripts/newsletter-config.json` を追加。初期値は `provider: formsubmit` / `buttondownUsername: ""` とし、ユーザー名が入るまでは既存フォームを維持。
- `scripts/build-detail-pages.mjs` に Buttondown の切り替えを追加。Buttondown 時は `email` / `embed=1` / 言語タグだけを出し、formsubmit 専用項目を出さない。記事、TOP、NEWS の JA/EN に対応し、EN ハブは固定属性 `name="tag" value="ja"` だけを `en` に置換する。
- 全 HTML の `form-action` に `https://buttondown.com` を追加し、`https://formsubmit.co` は残した。
- `scripts/newsletter-draft.mjs`、`.github/workflows/newsletter-draft.yml`、`docs/newsletter.md`、`scripts/check_newsletter.mjs` を追加。API の `filters` はタグIDが必要なため、`--push` は JA/EN の draft を2本作るだけにした。

### コミット
- 未コミット（ユーザー指定）。commit / push / Publish pipeline / 本番データ書き込みは未実施。

### 検証
- `node scripts/check_newsletter.mjs`: 成功。formsubmit フォールバック、CSP、下書き出力、UTM、切り替えコードを確認。
- `node scripts/newsletter-draft.mjs --dry --month=2026-10`: JA/EN を生成。UTM 付きリンク、既存データ由来のタイトル・要約・紹介文、編集部欄の仮置きを確認。
- `node --check scripts/newsletter-draft.mjs scripts/check_newsletter.mjs scripts/build-detail-pages.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 51件成功 / 9件失敗。詳細ページ生成は外部画像取得待ちで240秒タイムアウト。ブラウザ系8件は環境の localhost listen EPERM。コード検査は成功したが、preflight全件成功ではないため公開・push不可。

### 変更したパターン
- ニュースレターの provider 設定、記事末尾フォーム、TOP/NEWS のニュースレター section、JA/EN の Buttondown 言語タグ。
- 587枚の HTML の CSP `form-action`。他用途の formsubmit フォームは変更していない。
- 月次下書きの翌月開催フェス、先月記事、翌月出演アーティスト、UTM URL、Buttondown draft API、月次 GitHub Actions。

### 未確認の類似パターン
- 確認済み・0件：初期設定での formsubmit 送信先消失、Buttondown 専用項目への formsubmit 項目混入、JA/EN の CSP 欠落、下書きの UTM 欠落。
- 未確認：Buttondown アカウント作成後の実登録、ダブルオプトイン確認画面、Buttondown API キーありの実 draft 作成、実ブラウザのPC/モバイル操作、Publish pipeline。

### 次の担当への注意・判断待ち
- `scripts/newsletter-config.json` に実ユーザー名を入れる前に公開しない。入れる場合は `provider` を `buttondown` に変更し、preflight と実ブラウザで JA/EN の `tag` を確認すること。
- API キーは `gh secret set BUTTONDOWN_API_KEY` で登録する。キーをリポジトリへ書かない。
- `bash scripts/preflight.sh` の外部画像取得と localhost 制限を解消し、全件成功してから公開すること。今回も commit / push は行っていない。
- 2026-10-21: newsletter-draft は号の月（通常は翌月）を開催予定・件名・ファイル名・UTMへ使い、記事は前月1日〜作成日、空要約には ` — ` を付けない仕様へ修正。11月号を再生成済み。
- 2026-10-21: newsletter.md の送信元・返信先を news@techno-japan.media に更新し、独自ドメインDNS、Gmail転送、Buttondownユーザー名と表示名の区別を追記。

### 2026-10-21 Buttondown切り替え・生成物更新 — 未コミット

### 実施
- `scripts/newsletter-config.json` を `{ "provider": "buttondown", "buttondownUsername": "technojapan" }` に変更。
- `node scripts/build-detail-pages.mjs` でJA/EN記事詳細とTOP/NEWSハブを再生成。Buttondownの送信ドメイン `techno-japan.media` 認証済み、JA/ENタグ運用を `docs/newsletter.md` の現在の状態へ追記。
- `scripts/check_newsletter.mjs` を切り替え後の検査へ更新し、対象フォーム数・専用項目数・formsubmit維持数・ハブ行数を検査。

### コミット
- 未コミット（ユーザー指定）。commit / push / Publish pipeline / 本番データ書き込みは未実施。

### 検証
- `node scripts/check_newsletter.mjs`: 成功。Buttondown 44フォーム、formsubmit専用項目0件、ライター応募のformsubmit 2件。
- JA/ENハブ行数一致: `index 1457/1457`、`news 1342/1342`、`festivals 1458/1458`、`artists 1011/1011`、`venues 1168/1168`。
- `node --check scripts/check_newsletter.mjs scripts/build-detail-pages.mjs`、`git diff --check`: 成功。
- `git pull --ff-only`: worktree親リポジトリの `FETCH_HEAD` 権限制限で未実施。`bash scripts/preflight.sh`、実ブラウザ確認、Publish pipelineは未実施。

### 変更したパターン
- 記事詳細JA/EN各20件、TOP/NEWS JA/ENのニュースレターを Buttondown action `https://buttondown.com/api/emails/embed-subscribe/technojapan` へ切り替え、JA=`ja` / EN=`en` のtagと `embed=1` のみを出力。
- Buttondownフォームから `_honey` / `_subject` / `_captcha` / `_next` / `_template` を除去。
- `docs/newsletter.md` の現在の状態、切り替え後の `check_newsletter.mjs`、設定JSONを更新。

### 未確認の類似パターン
- 確認済み・0件：対象44フォームのaction不正、JA/EN tag不正、formsubmit専用項目混入、JA/ENハブ行数不一致。
- 確認済み：ライター応募formsubmit 2件は維持。フェス申請ページはformsubmit action 0件（Googleフォーム等の外部埋め込みもなし）。
- 未確認：Buttondownへの実登録・ダブルオプトイン、実ブラウザのPC/モバイル操作、Publish pipeline、本番HTML、preflight全件。

### 次の担当への注意・判断待ち
- 公開前に `bash scripts/preflight.sh` を省略なしで実行し、CMS変更扱いの手順に従って実ブラウザでJA/ENフォームを確認すること。CMS変更ではないためPublish pipelineは今回未実施。
- Buttondown APIキーはリポジトリへ保存せず、必要なら `gh secret set BUTTONDOWN_API_KEY` で登録すること。
- 今回もcommit・push・本番データ書き込みは行っていない。

### 2026-10-21 ニュースレター候補・人気記事・3:2画像

### 実施
- `scripts/newsletter-draft.mjs` に `--picks id1,id2`、人気記事4件、記事カード用公開画像URL、`--prepare-images` を追加。
- `scripts/newsletter-images.py` を追加し、記事画像をimagePositionを考慮して600×400 WebPへ変換。
- workflow_dispatch の `picks` / `month`、Pillow導入、画像のcommit・pull --rebase・push（3回リトライ、popular.ymlと同じ形。Actions上ではブラウザ検査が動かないためpreflightは入れない）を追加。`docs/newsletter.md` に編集部向けの月次手順と送信前プレビュー確認を追記。

### コミット
- feat(newsletter) コミット（Claude がレビュー後にコミット）。

### 検証
- Claude: `--picks mutek,resonance --dry` の出力をローカル配信し headless Chrome（390px dpr2 / 1280px）で描画。画像の読み込み失敗0・横はみ出し0、記事4枚が3:2で揃うことを目視確認。
- `node scripts/newsletter-draft.mjs --month 2026-11 --dry`: 成功。
- `node scripts/newsletter-draft.mjs --month 2026-11 --picks mutek,grow-the-culture-open-air --dry`: 成功。指定順・確定見出しを確認。
- `node scripts/newsletter-draft.mjs --month 2026-11 --prepare-images --dry`: 4枚生成、全て600×400 WebP。
- `git diff --check`: 成功。`bash scripts/preflight.sh --fast`: 47件成功、5件省略、外部画像取得による詳細ページ生成タイムアウト1件。

### 変更したパターン
- ニュースレターのフェス候補／確定2件、popular.jsonによる記事4件、記事カード画像の3:2固定、workflow_dispatch入力、画像自動コミット手順。

### 未確認の類似パターン
- 確認済み・0件：フェス画像・アーティスト画像の非crop、記事画像のwidth/height、指定なし候補6件、指定あり2件。
- 未確認：GitHub Actions上の実workflow、Buttondownへの実下書き更新、実ブラウザ／メーラーでのプレビュー。

### 次の担当への注意・判断待ち
- `bash scripts/preflight.sh --fast` の失敗は既存の外部画像取得タイムアウト。省略なしpreflightが全件成功するまでpush・公開しないこと。
- 2026-11 の4枚はこのコミットに含めた。以後の月は workflow が生成・コミットする。
### 2026-10-21 CMS保存成功後のReferenceError修正 — 未コミット

### 実施
- `LP/cms.js` の `saveEdit` で `autoEditionYear` を関数スコープの `let` にし、festival分岐内は代入へ変更。`venue / artist / article / festival` の成功応答で保存後処理が例外にならない検査を追加し、festival は `syncExistingEditionRows` → `syncNewEditionRows` の順に呼ばれることを確認。
- `saveEdit` と `submitToSheet` の成功応答後処理を `try/catch` で囲み、後処理例外は `保存は完了しましたが、後処理でエラーが発生しました: ...` の消えない `aiFail` パネルへ出すよう変更。fetch / JSON取得失敗は従来どおり通信エラーとして扱う。
- `LP/cms.html` の `cms.js` キャッシュバスターを v161 → v162 に更新。
- 原因は cms.js v161 の公開から発生。影響は、全セクションで保存自体は成功するが通信エラー表示になり、特にフェス保存時に開催回・LINEUPSが未同期になった可能性があること。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/cms.js`: 成功。
- `node --check scripts/check_cms_editions.mjs`: 成功。
- `node scripts/check_cms_editions.mjs`: 43件成功。成功応答モックで4セクションの `saveEdit`、festivalの2段階同期、後処理例外と通信エラーの分離を確認。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 51件成功 / 9件失敗。詳細ページ生成は外部画像取得待ちで240秒タイムアウト、ハブ/CMSフォーム/会場フィルタ/計測/地図/モバイル系8件は sandbox の localhost listen `EPERM`。変更に関係するCMS検査は成功。実ブラウザでのCMS保存操作、Publish pipeline、本番データへの書き込みは未実施。

### 変更したパターン
- 既存保存 `saveEdit` のブロックスコープ変数、成功応答後の同期・再読込、後処理エラー表示。
- 新規保存 `submitToSheet` の成功応答後処理エラー表示。
- CMS `cms.js` キャッシュバージョン。
- CMS VM検査の成功応答モック（venue / artist / article / festival）。

### 未確認の類似パターン
- 確認済み・0件：`saveEdit` 内の `autoEditionYear` のブロック外参照、`submitToSheet` の `autoCreatedEditionYear` のスコープ。
- 未確認：実ブラウザでの認証済みCMS操作、実GAS通信、Publish pipeline、本番データのフェス保存後に実シートでEDITIONS / LINEUPSが同期されたこと。

### 次の担当への注意・判断待ち
- 公開前に `bash scripts/preflight.sh` を省略なしで実行し、成功後にCMSを `?cb=<乱数>` で開いて Cmd+Shift+R 相当の強制再読込を行うこと。今回の変更はPublish経路（`LP/cms.js`）なので、Publish pipelineと実ブラウザ確認が必須。
- 本番データへの書き込みを伴う実操作はまだ行っていない。実機確認できるまで公開済みとして扱わないこと。

### 2026-10-21 記事の書き手表示・筆者ページ — 未コミット

### 実施
- AUTHORS公開CSVの取得と`LP/data/authors.json`への保存（取得失敗時は既存JSONを保持）を追加。
- 公開記事と名前照合した`/writers/<id>.html`・`/en/writers/<id>.html`、記事の筆者リンク/Person JSON-LD、NEWSカードのBY表示を追加。
- writers募集ページの筆者一覧リンク、sitemap、ProfilePage/Person検査、ハブデータAUTHORSを更新。

### コミット
- 未コミット（ユーザー指定）。commit / push / Publish pipeline / 本番データ書き込みは未実施。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。Masafumi TakeのJA/EN筆者ページを生成。
- `python3 scripts/generate-sitemap.py`: 成功。JA/EN筆者ページを掲載。
- `node scripts/check_jsonld.mjs`: 成功。ProfilePage/Personのname・urlを確認。
- `python3 scripts/check_asset_versions.py`: 成功。
- `bash scripts/preflight.sh --fast`: 外部Google画像取得待ちの詳細ページ生成が240秒でタイムアウト。その他の検査は成功したが、全体は2件失敗。実ブラウザ確認とPublish pipelineは未実施。

### 変更したパターン
- `fetch-data.mjs`の既存GIDSとは別のAUTHORS CSV取得、ID/NAME検証、安定JSON出力。
- 詳細ページ生成の筆者照合、記事WORDS BY、NewsArticle author、ProfilePage/Person、ハブ/募集ページの筆者リンク。
- `generate-sitemap.py`のJA/EN筆者URL列挙と`check_jsonld.mjs`の筆者検査。

### 未確認の類似パターン
- 確認済み・0件：AUTHORS未登録個人のリンク無し、TECHNO JAPANのaboutリンク、JA/EN行数、長い名前の省略CSS、CMS/GASコード。
- 未確認：実ブラウザでの390px NEWSカード表示、実サイトのPublish pipeline、本番AUTHORS CSVの全行取得結果。

### 次の担当への注意・判断待ち
- `bash scripts/preflight.sh`省略なしを通し、実ブラウザでJA/ENのNEWSカード・記事WORDS BY・筆者ページを確認してから公開すること。今回はcommit・pushを行っていない。

### 2026-10-21 組織名の表示統一 — 未コミット

### 実施
- 記事表示の組織判定・表示名をビルド側の`authorPresentation()`とブラウザ側の`tjAuthorPresentation()`に追加。空欄および大文字小文字を問わず`TECHNO JAPAN`を含むauthorを、JAは`TECHNO JAPAN 編集部`、ENは`TECHNO JAPAN Editorial`として表示。
- 記事WORDS BY、NEWSカードBY、JA/EN writers一覧の集計・表示を更新。writers一覧では組織表記を1行に統合し、記事数を合算。JSON-LDのOrganization名は`TECHNO JAPAN`のまま保持。
- CMS新規記事のauthor既定値・placeholderを更新し、候補表示でも組織表記を統合。`cms.js?v=164`、`localize.js?v=14`へ更新。
- `node scripts/build-detail-pages.mjs`で静的記事ページを再生成。

### コミット
- 未コミット（ユーザー指定）。commit / push / Publish pipeline / 本番データ書き込みは未実施。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。記事21枚（JA）・20枚（EN）を生成、組織表示とOrganization JSON-LDを確認。
- JA/EN writers.htmlの行構造・共有表示関数・localize.js同期読み込みを確認。
- `bash scripts/preflight.sh --fast`: 47件成功、5件省略、1件失敗。外部Google画像取得13件が240秒タイムアウトしたため、詳細ページ生成検査のみ失敗。CMS著者候補検査は再実行で成功。
- 実ブラウザ確認: 未実施（NEWSカード、記事WORDS BY、writers一覧、CMS入力を未確認）。

### 変更したパターン
- `author`の表示時組織名解決、記事詳細・NEWSハブ・writers集計、CMS author既定値／候補の組織名正規化、CMS/共有JSのキャッシュバージョン。

### 未確認の類似パターン
- 確認済み・0件：記事データ・data-hub.jsのauthor値、JSON-LD Organization name、個人筆者表示、JA/EN表示関数の同期。
- 未確認：実ブラウザのJA/EN NEWSカード・記事WORDS BY・writers一覧・CMS新規記事フォーム。

### 次の担当への注意・判断待ち
- 外部画像取得が安定した環境で`bash scripts/preflight.sh --fast`を再実行し、詳細ページ生成も成功させること。実ブラウザ確認と、必要なら省略なしの`bash scripts/preflight.sh`を完了するまで公開扱いにしないこと。CMS変更のため確認時は`?cb=<乱数>`とCmd+Shift+R相当の強制再読込を使う。

### 2026-10-22 筆者ページ追加修正 — 未コミット

### 実施
- AUTHORSのHTML応答・必須ヘッダー欠落・有効行0件を検出し、既存authors.jsonを保持するよう修正。
- JA筆者ページのtitle/descriptionを日本語化し、SNSリンク表示をINSTAGRAM/X/WEBSITEの固定ラベル化。
- 記事WORDS BYのインラインstyleを`.article-author-link`へ移し、detail.cssをv70へ更新。
- 再ビルドし、JA/EN 5ハブとwritersハブの行数一致を確認。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/fetch-data.mjs`: 成功。
- `node --check scripts/build-detail-pages.mjs`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功。
- JA/EN index・news・festivals・artists・venues・writersの行数一致: 確認済み。
- `bash scripts/preflight.sh --fast`: 47件成功、5件省略、詳細ページ生成のみ外部Google画像取得待ちで240秒タイムアウト。全体は失敗。
- 実ブラウザ確認、Publish pipeline、本番データ書き込み: 未実施。

### 変更したパターン
- AUTHORS CSVのHTML/ヘッダー/空結果ガード、writerPageのJAメタ情報とSNS表示ラベル、記事筆者リンクのCSS化・detail.css版数。

### 未確認の類似パターン
- 確認済み・0件：生成記事の`article-author-link`インラインstyle残存、JA/ENハブ行数不一致。
- 未確認：外部画像取得が安定した環境でのpreflight詳細ページ生成、実ブラウザでのJA/EN筆者ページと記事WORDS BY操作。

### 次の担当への注意・判断待ち
- 公開前に外部画像取得が可能な環境で`bash scripts/preflight.sh --fast`を再実行し、成功後に省略なしpreflightと実ブラウザ確認を行うこと。commit・pushは未実施。

### 2026-10-22 筆者ページ見出しまわりの余白調整 — 未コミット

### 実施
- `LP/detail.css` の余白ルールに `.writer-detail` を追加し、PC/モバイルの上端・eyebrow・h1 間隔をアーティスト／会場詳細と統一。
- `.writer-detail .detail-links` の下余白をPC 20px、モバイル18pxに設定。
- `detail.css` の版数を71へ更新し、CMS本番表示プレビューの参照も `v=71` に同期。
- `node scripts/build-detail-pages.mjs` で詳細ページを再生成。

### コミット
- 未コミット（ユーザー指定）。commit・push・Publish pipeline・本番データ書き込みは未実施。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。全567ページを生成し、JA/EN筆者ページを含む詳細ページへ `detail.css?v=71` を反映。
- `python3 scripts/check_asset_versions.py`: 成功。
- `bash scripts/preflight.sh`: 49件成功。外部Google画像取得による詳細ページ生成タイムアウト、既存記事フィード不整合、sandboxのlocalhost bind制限によるブラウザ検査失敗あり。
- 実ブラウザでの筆者ページ操作確認: 未実施（sandboxのlocalhost bind制限）。

### 変更したパターン
- `.artist-detail` / `.venue-detail` と同じPC/モバイル余白グループへの `.writer-detail` 追加。
- 筆者ページの `.detail-links` 下余白、詳細CSS版数、CMS記事プレビューCSS版数。

### 未確認の類似パターン
- 確認済み・0件：アーティスト／会場ページの生成構造変更、JA/EN筆者ページの `v=71` 反映。
- 未確認：実ブラウザでの1280px/モバイル筆者ページの実測値。

### 次の担当への注意・判断待ち
- 公開前にlocalhost bind可能な環境で実ブラウザ確認と省略なしpreflightを再実行すること。preflightの既存記事フィード不整合も要確認。commit・pushは未実施。

### 2026-10-22 書き手表示・筆者ページとアーティスト一覧のプレビュー削除を公開（Claude）

### 実施
- 上の「記事の書き手表示・筆者ページ」「組織名の表示統一」「筆者ページ追加修正」「筆者ページ見出しまわりの余白調整」（各「未コミット」表記は当時の状態）をレビューのうえ main に統合。
- アーティスト一覧（LP/artists.html / en）のマウスオーバーで出る紹介パネル（.artist-preview-pane / bindArtistHoverPreview）を削除（ユーザー要望）。カードの画像拡大・カーソルの輪は維持。
- main で build-detail-pages.mjs と generate-sitemap.py を再実行し生成物を更新。

### コミット
- feat(articles) 書き手ページ / style(writers) 余白 / fix(artists) プレビュー削除、および生成物の再生成コミット。

### 検証
- テスト環境（http://192.168.0.8:8095 / 8097、LAN 配信。テスト配信時のみ CSP の upgrade-insecure-requests を外して配信）をユーザーが確認し「公開して」。
- headless Chrome（390px dpr2 / 1280px）: /writers/masafumi-take.html・記事2種・news・writers・EN 筆者ページで画像読み込み失敗0・横はみ出し0・例外0。
- 筆者ページ見出しの位置を実測し、アーティスト詳細と一致（PC: 101/124/214px、スマホ: 82/103/153px）。
- 実 Chrome（1509px）で artists.html の「すべてのアーティスト」カードにホバーし、パネルが出ないことを確認。
- JA/EN の行数一致: news 1344/1344、artists 946/946、writers 196/196。
- `bash scripts/preflight.sh` 全件（結果は push 時に記録）。

### 変更したパターン
- 記事 WORDS BY のリンク化、NEWS カードの BY 名前、/writers.html 一覧のリンク化、筆者ページ生成（AUTHORS 取り込み）、組織名表示（JA 編集部 / EN Editorial）、CMS 既定値、アーティスト一覧ホバープレビュー削除。

### 未確認の類似パターン
- TOP（index.html）や関連記事カード（relatedStoryCardsHtml）には書き手名を出していない（確認済み・今回は対象外）。
- NEWS の FEATURED 枠には BY を出していない（確認済み・意図どおり）。
- 未確認: 本番 Publish pipeline での AUTHORS 取得（push 後に実行して確認する）。

### 次の担当への注意・判断待ち
- AUTHORS シートに BIO / IMAGE を入れると筆者ページに出る（現在 Masafumi Take は Instagram のみ）。
- 既存記事の author 値「TECHNO JAPAN」はデータを書き換えず、表示だけ「TECHNO JAPAN 編集部」に変換している。

### 2026-10-22 LINEUPSの非公開アーティスト参照を許容 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` が `LP/data/artists.json`（シート全行）を参照し、公開ARTISTSに無いがシートにあるIDを非公開アーティストとして名前のみ表示するよう修正。
- 非公開アーティストは詳細ページリンク・JSON-LDの`@id`/`url`を出さず、アーティスト出演履歴にも追加しない。シートにも無いIDは従来どおり参照切れで停止。
- `writeContentDates` を今回の公開対象スナップショットだけで再構成し、非公開・削除済みエンティティの台帳キーを除去。
- `scripts/check_lineup_draft_refs.mjs` を追加し、draft／STATUS空欄とシート外IDの判定をpreflightへ追加。
- 生成物を再生成し、matricaria等の対象ページを更新。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。`Lineup: 非公開アーティスト 4件はリンク無しで表示 (caimann, noritake, ojisan, reeko)`。
- `LP/festivals/matricaria.html`: Caimann / Noritake / Ojisan はリンク無しの`MusicGroup`名および文字表示。`sisi`はLINEUPS参照なし。
- `node scripts/check_jsonld.mjs`: 成功。content-datesの不要キーなし。
- `node scripts/check_festival_lineup_render.mjs`: 成功。
- `node scripts/check_lineup_draft_refs.mjs`: 成功。
- `bash scripts/preflight.sh --fast`: 画像寸法取得（Google外部画像150件）の240秒タイムアウトで詳細ページ生成が失敗。その他47件は成功、5件は`--fast`で省略。コード修正起因ではなく、同コマンド内の既存外部画像取得待ち。
- 実ブラウザ確認、Publish pipeline、本番データ書き込み: 未実施。

### 変更したパターン
- 公開ARTISTSと`LP/data/artists.json`全行を分離したLINEUP参照解決。
- 非公開出演者のリンク無しHTML／名前のみJSON-LD、出演履歴除外、ビルドログ集計。
- content-dates台帳の公開対象キー再構成。
- 非公開／シート外IDの回帰検査とpreflight登録。

### 未確認の類似パターン
- 確認済み・0件：対象4ID以外の現行LINEUPSで、シートに無い非複合ARTIST_ID参照切れ。
- 未確認：実ブラウザでJA/ENのmatricaria・synapse・labyrinthを操作する確認。

### 次の担当への注意・判断待ち
- 外部Google画像取得が240秒を超える環境では`preflight --fast`が失敗するため、ネットワーク安定環境で再実行すること。実ブラウザ確認と省略なしpreflightが未完了のため、公開扱いにしない。

### 2026-10-22 アーティスト一覧の検索欄をナビ下へ固定 — 未コミット

### 実施
- `LP/artists.html` の `.artists-toolbar` の sticky `top` を、実測した `<nav>` 高さの `--tj-nav-height` に変更。
- `ResizeObserver` と resize / fonts.ready でナビ高さを再計測し、JA から `enHubFromJa` で EN artists を再生成。
- `scripts/check_regressions.py` が CSS 変数の sticky top も検査できるよう回帰ガードを更新。

### コミット
- 未コミット（ユーザー指定）。commit・push・Publish pipeline・本番データ書き込みは未実施。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。EN artists を生成。JA/EN とも954行、toolbar/search/genre各1件。
- `python3 scripts/check_regressions.py`: 成功。`artist_filter_sticky_pages` は2/2。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略。外部Google画像取得が240秒でtimeoutし、詳細ページ生成のみ失敗。
- CDPの390x844 dpr2 / 1280x900 / 1546x900実測: 未実施。sandboxでローカルHTTPサーバーのbindが拒否された。

### 変更したパターン
- artists JA/EN のナビ高さ連動 sticky toolbar。
- CSS変数を使う artists sticky を認識する回帰検査。

### 未確認の類似パターン
- 確認済み・0件：festivals.html / venues.html は今回変更なし。
- 未確認：実ブラウザでの3 viewport、入力中のキーボード表示、JA/ENの操作確認。

### 次の担当への注意・判断待ち
- localhost bind可能かつ外部画像取得可能な環境で、指定CDP実測と`bash scripts/preflight.sh --fast`を再実行すること。未確認経路があるため公開扱いにしない。

### 2026-10-22 アーティスト出演予定への絞り込み反映 — 未コミット

### 実施
- `LP/artists.html` にジャンル・検索の共通判定 `artistMatchesFilters` を追加し、全アーティスト一覧と「UPCOMING ON STAGE」で共有。
- 条件変更時に出演予定も再描画し、該当0件ではセクションを`hidden`にする。出演回数順・上位12件の規則は維持。
- `enHubFromJa` 経由で `LP/en/artists.html` を再生成。コミット・pushなし。

### コミット
- 未コミット（ユーザー指定）。commit・pushなし。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。EN artists を生成。JA/EN とも961行。
- `python3 scripts/check_regressions.py`: 成功。artist_filter_sticky_pages 2/2、回帰なし。
- データ確認: 全件ALL、TECHNO、出演予定0件になるジャンル候補（JUNGLE等）をデータ上で確認。JUNGLEは全アーティストには存在するが、今後60日の出演予定集合には0件。
- `bash scripts/preflight.sh --fast`: 詳細ページ生成が外部Google画像取得待ち240秒でtimeoutし1件失敗。その他48件成功、5件省略。
- headless Chrome操作: 未確認。sandboxのローカルHTTPサーバーbind拒否、`file://`接続もChrome起動timeout。

### 変更したパターン
- `renderUpcomingArtists` のフィルタ反映・再描画・空セクション隠蔽。
- `getFilteredArtists` と出演予定で共有するジャンル／検索判定。

### 未確認の類似パターン
- 確認済み・0件：JA/ENの生成行数、静的回帰検査、データ上のALL/TECHNO/空結果候補。
- 未確認：実ブラウザでのJA/EN、URL `?genre=`初期表示、検索入力、ハート・遅延画像・カーソル・状態保存の再描画後動作。

### 次の担当への注意・判断待ち
- localhost bind可能な環境で、ALL→TECHNO→JUNGLE等→検索語の実ブラウザ確認を実施すること。未確認経路があるため公開扱いにしない。

### 2026-10-22 アーティスト一覧の件数表示削除 — 未コミット

### 実施
- `LP/artists.html` から `#artists-count` の要素・CSS・`textContent` 更新を削除。
- JA を生成元として `node scripts/build-detail-pages.mjs` を実行し、`LP/en/artists.html` も再生成。
- スマホでは検索欄を行いっぱいにし、固定ツールバー本体を 100px（上12px + 検索40px + gap8px + ジャンル40px）に維持。PC は検索欄の右側を空ける既存の最大幅を維持。
- 0件時の `No artists found` は維持。

### コミット
- 未コミット（ユーザー指定）。commit・pushなし。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。EN artists を生成。
- JA/EN artists: ともに954行。
- `#artists-count` 参照: `LP/` と `scripts/` で0件。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略。外部Google画像取得待ちの「詳細ページを生成できる」が240秒でtimeoutし、全体は1件失敗。
- 実ブラウザ確認: 未実施。`--fast` のためブラウザ検査は省略。

### 変更したパターン
- artists JA/EN の件数表示要素、CSS、描画更新。
- スマホ検索行の全幅化。

### 未確認の類似パターン
- 確認済み・0件：`#artists-count` の `LP/`・`scripts/` 参照。
- 未確認：実ブラウザでのスマホ固定ツールバー操作、PC表示、JA/EN操作。

### 次の担当への注意・判断待ち
- 外部Google画像取得可能な環境で `bash scripts/preflight.sh --fast` を再実行すること。実ブラウザ確認と省略なしpreflightが未完了のため、公開扱いにしない。

### 2026-10-22 アーティスト一覧の検索・ジャンル切替時の結果先頭復帰 — 未コミット

### 実施
- `LP/artists.html` に、検索（既存200msデバウンス後）・ジャンル切替の再描画時だけ結果見出しへ戻す処理を追加。
- 出演予定セクションが表示中ならその見出し、非表示なら「すべてのアーティスト」見出しを対象にした。
- `--tj-nav-height` と `.artists-toolbar` の実測高を合算して位置を計算し、初回描画・URL／状態復元では自動スクロールしない。
- JA を生成元として `node scripts/build-detail-pages.mjs` を実行し、`LP/en/artists.html` を再生成。commit・pushなし。

### コミット
- 未コミット（ユーザー指定）。commit・pushなし。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。JA/EN artists とも985行、ENは `enHubFromJa` 生成。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略。外部Google画像取得待ちで「詳細ページを生成できる」が240秒timeoutし、全体は1件失敗。
- 実ブラウザ確認: 未実施。`--fast` ではブラウザ検査が省略される。

### 変更したパターン
- artists の検索／ジャンル操作後の見出し位置復帰、固定ツールバー高の実測。

### 未確認の類似パターン
- 確認済み・0件：JA/EN行数一致（985/985）、初回描画・URL／状態復元経路の自動スクロール呼び出し。
- 未確認：実ブラウザでのPC／スマホ操作、入力中のキーボード・フォーカス保持、prefers-reduced-motion環境。

### 次の担当への注意・判断待ち
- 外部画像取得可能な環境で `bash scripts/preflight.sh --fast` を再実行し、実ブラウザで検索入力・ジャンル切替・URL `?genre=`・戻る操作を確認すること。未確認経路があるため公開扱いにしない。

### 2026-10-22 アーティスト一覧の描画後スクロール補正 — 未コミット

### 実施
- `LP/artists.html` の検索・ジャンル切替共通処理を、一覧と出演予定の再描画後に `requestAnimationFrame` で見出しを再取得して位置計算するよう修正。
- JA を生成元として `node scripts/build-detail-pages.mjs` を実行し、`LP/en/artists.html` を再生成。commit・pushなし。

### コミット
- 未コミット（ユーザー指定）。commit・pushなし。

### 検証
- 再生成: 成功。JA/EN artists とも986行で一致。ENは `enHubFromJa` 生成。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略、1件失敗。外部Google画像取得待ちの「詳細ページを生成できる」が240秒でtimeout。
- 実ブラウザ確認: 未実施。`--fast` ではブラウザ検査が省略される。

### 変更したパターン
- アーティスト一覧の検索・ジャンル切替後、描画完了後に表示中の結果見出しへスクロールする処理。

### 未確認の類似パターン
- 未確認：実ブラウザでの390×844／1546×900、JA/EN、検索入力、HOUSE切替、出演予定表示／非表示の操作結果。
- 確認済み・0件：JA/EN行数一致、ENハブの生成経路、`preflight --fast` のtimeout以外の検査。

### 次の担当への注意・判断待ち
- 外部画像取得可能な環境で preflight を再実行すること。実ブラウザ確認が未完了のため公開扱いにしない。

### 2026-10-22 アーティスト一覧のジャンル切替スクロール安定化 — 未コミット

### 実施
- `LP/artists.html` の一覧領域（出演予定・全件一覧・グリッド）に `overflow-anchor: none` を追加。
- 検索・ジャンル切替後のスクロールを2回の `requestAnimationFrame` 後に実行し、約150ms後に見出し位置を再確認して1回だけ補正する処理へ変更。
- 連続操作時に古い補正が効かないよう、操作ごとのリクエスト番号を追加。戻るボタンの位置復元処理は変更なし。
- JAを生成元として `node scripts/build-detail-pages.mjs` を実行し、ENハブを再生成。commit・pushなし。

### コミット
- 未コミット（ユーザー指定）。commit・pushなし。

### 検証
- 再生成: 成功。JA/EN artists とも1013行で一致。ENは `enHubFromJa` 生成。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略、1件失敗。外部Google画像取得待ちの「詳細ページを生成できる」が240秒でtimeout。
- 実ブラウザ確認: 未実施。`--fast` ではブラウザ検査が省略される。

### 変更したパターン
- アーティスト一覧の検索・ジャンル切替後の描画待ちスクロール、遅延レイアウト後の1回限り補正、一覧領域のスクロールアンカー抑止。

### 未確認の類似パターン
- 未確認：実ブラウザでの390px／1546px、JA/EN、ALL/HOUSE/TECHNO/JUNGLE、検索操作、遅延画像・リビール後の実測。
- 確認済み・0件：戻るボタンの位置復元処理への変更、JA/EN行数不一致。

### 次の担当への注意・判断待ち
- 外部画像取得可能な環境で省略なしの `bash scripts/preflight.sh` と実ブラウザ確認を再実行すること。未確認経路とpreflight失敗があるため公開扱いにしない。
### 2026-10-22 記事ページの見た目調整 — 未コミット

### 実施
- スマホ本文の通常画像を本文カラムの24px分だけ左へ戻し、viewport左端に揃うよう修正。拡大画像は既存の`.fx-frame { overflow: hidden }`でクリップする構造を維持。
- 記事の関連フェスをPCで大見出し列＋3列カードに変更し、1024/1280/1546px帯に対応する画像`sizes`を生成。
- `node scripts/build-detail-pages.mjs`で詳細ページを再生成。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。
- `bash scripts/preflight.sh --fast`: 失敗。外部画像取得による詳細ページ生成タイムアウト、既存の二重エスケープ2件、既存変更の`article-shortcodes.js`の`?v`据え置き。その他の実行検査は成功、ブラウザ検査は`--fast`で省略。
- 実ブラウザ確認、Publish pipeline: 未実施。

### 変更したパターン
- `.article-body`内のスマホ全幅`figure.fx-img`の左端位置。
- 記事ページの`.related-festivals`のPC見出し・3列グリッド・カード画像`sizes`。

### 未確認の類似パターン
- 実ブラウザでの390px/1280px/1546px表示: 未確認。
- `fx-compact`、画像ペア、フェス／アーティスト／会場ページの関連カード: 確認済み・0件（今回の対象外）。

### 次の担当への注意・判断待ち
- preflightの既存3件を解消し、実ブラウザで記事JA/ENのスマホとPCを確認するまで公開しないこと。

### 2026-10-22 関連フェス見出しのPC改行固定 — 未コミット

### 実施
- `scripts/build-detail-pages.mjs` の記事ページ見出しを、JAは「関連／フェスティバル」、ENは「RELATED／FESTIVALS」の span 構造に変更。
- `LP/detail.css` の1024px以上で各spanをblock・nowrapにし、見出しサイズを `clamp(32px, 3.2vw, 48px)` に調整。スマホ・タブレットの小さい1行表示は維持。
- 詳細ページを再生成。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。記事JA/EN 42ページを更新。
- `bash scripts/preflight.sh --fast`: 失敗。詳細ページ生成が外部Google画像取得の240秒タイムアウト。後続の48件は成功、5件は`--fast`で省略。
- 実ブラウザ確認: 未実施（1024px〜PCの表示確認は未確認）。

### 変更したパターン
- 記事詳細 `.related-festivals h2` のJA/EN見出しの文節単位span化と、1024px以上のnowrap/block表示。

### 未確認の類似パターン
- 確認済み・0件：フェス・アーティスト・会場詳細ページの同名見出し。今回の対象外。

### 次の担当への注意・判断待ち
- 外部画像取得が安定した環境でpreflightを再実行し、実ブラウザで記事JA/ENの1024px〜PC表示を確認するまで公開扱いにしないこと。

### 2026-10-22 アーティスト一覧の固定検索・絞り込み／記事ページの見た目3点を公開（Claude）

### 実施
- アーティスト一覧: 検索欄＋ジャンルをナビ下に固定（不透明・スマホ高さ約100px）、出演予定にもジャンル・検索の絞り込み（該当0で非表示）、件数表示を削除、検索・ジャンル切替で結果先頭へ自動スクロール（overflow-anchor:none、描画後に位置確定）。
- 記事: スマホ本文画像を100vw、& の二重エスケープ修正（見出しの文節折り・[[event]] 出演者分割）と再発検査、記事下の関連フェスを PC で大見出し＋3列×2段・最大6件（ユーザー要望で3→6）。

### コミット
- feat(artists) ×2 / feat(articles) / 関連フェス6件 / 生成物再生成。

### 検証
- headless Chrome（CDP 390×844 dpr3 / 900 / 1280 / 1546）: ツールバーがナビ直下（390: top54 高さ102、1546: top78）、背景 rgb(8,8,8)。TECHNO で出演予定12件、JUNGLE で非表示、「kensei」で1件。
- 自動スクロール: scrollY=4000 から検索・ALL/HOUSE/TECHNO/JUNGLE で見出し top とツールバー下端の差 0px（2回×2幅）。最上部では動かない。実 Chrome で詳細→戻るの位置復元（scrollY 2000）を確認。
- 記事: スマホ本文画像 figure left=0 width=390、取得 1200px（必要 1179）。関連フェス 1546px で 326px×3列×2段、900px で 216px×3列×2段、390px で 312px 横スクロール6枚。見出しは「関連／フェスティバル」で語中改行なし（1024〜1546px）。double_escaped_entities 0、check_asset_versions 成功。横はみ出し0。
- 注意: 画像の naturalWidth は srcset の w 指定で密度補正される（390 と出る）ため、取得画素は currentSrc を別途 decode して測った。

### 変更したパターン
- artists.html の固定ツールバー・出演予定フィルタ・件数削除・自動スクロール、記事本文画像の全幅、HTML エンティティの二重エスケープ、記事の関連フェス。

### 未確認の類似パターン
- festivals.html / venues.html の固定ツールバーは未変更（同じ透け・隠れがあり得る。未確認）。
- 記事下の RELATED STORIES は大型化していない（対象外）。

### 次の担当への注意・判断待ち
- article-shortcodes.js を CMS と共有しているため ?v を上げた。公開後に Publish pipeline と CMS の強制再読み込みが必要。

### 2026-10-22 CMS記事プレビューのCSS版数同期 — 未コミット

### 実施
- `LP/cms.js` の記事本番表示プレビューを `detail.css?v=72`、`article-fx.css?v=15` に同期。
- `LP/cms.html` の `cms.js?v` を `165→166` に更新。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `python3 scripts/check_asset_versions.py`: 成功。
- `git diff --check`: 成功。
- 実ブラウザ確認・Publish pipeline: 未実施。

### 変更したパターン
- CMS記事本番表示プレビューの `detail.css` / `article-fx.css` 参照版数。
- CMS本体 `cms.js` のキャッシュバスト版数。

### 未確認の類似パターン
- 確認済み・0件：同プレビュー内の `common.css?v=39`、`article-fx.js?v=13` は生成側定数と一致。
- 実ブラウザでのCMS操作と本番表示プレビュー描画: 未確認。

### 次の担当への注意・判断待ち
- 公開前に実ブラウザでCMS記事プレビューを確認し、必要なら `Cmd+Shift+R` で強制再読み込みすること。

### 2026-10-22 デザイントークン整理・ビジュアル比較ツール — 未コミット

### 実施
- `LP/common.css` に既存値と完全一致する背景・文字・アクセント・透明度・フォント・既存パレットのトークンを追加。
- 共通CSS、詳細CSS、記事演出、JAハブのインラインCSS、詳細ページ生成元の直書き色・フォント使用をトークン参照へ変更。ENハブと詳細ページを生成。
- `scripts/visual-snapshot.mjs` と `docs/design/STYLE_MAP.md` を追加。manifest、theme-color、ニュースレター、SVG内色はCSS変数が効かないため個別管理として記録。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。詳細557ページ、ENハブ7枚を生成。外部画像150件はネットワーク制限のため既存寸法を使用。
- JA/ENハブ行数: 7枚すべて一致。
- `python3 scripts/check_asset_versions.py`: 成功。`common.css` v40、`detail.css` v73、`article-fx.css` v16、CMS v167。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。`git diff --check` と構文検査も成功。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略、詳細ページ生成だけ外部画像取得の240秒タイムアウトで失敗。
- 直書き集計（対象ソース）: `rgba(240,237,232,*)` 252→1、`rgba(8,8,8,*)` 32→0、16進カラー129→42。残りはトークン定義とtheme-color、SVG data URIの1件。
- `visual-snapshot` capture/compare: 未実施。localhost bind が環境制限（EPERM）で拒否されたため、差分0は未確認。

### 変更したパターン
- 共通色RGBと透明度、黒・白、既存グラデーション色、フォント利用、CSS版数参照。

### 未確認の類似パターン
- 確認済み・0件：JA/ENハブの行数差、対象ソース内の直接フォント利用（@font-face定義を除く）。
- 未確認：実ブラウザでの表示・操作、画像比較による差分0、CSS変数が使えないmanifest/theme-color/ニュースレター/OG画像の実機確認。

### 次の担当への注意・判断待ち
- localhost bind可能な環境で変更前後のcapture/compareを実行し、差分0を確認すること。preflightは外部画像取得が安定した環境で再実行すること。未確認のため公開扱いにしない。

### 2026-10-22 自己参照トークン修正・visual-snapshot 撮影失敗検出 — 未コミット

### 実施
- JA/EN の index・news ハブで `--accent: var(--accent)` を削除し、ページ固有の `--rave-accent` は元の値へ復元。
- NEWS の進捗バー、共通お気に入り色、詳細言語ボタンの自己参照フォールバックを元のフォールバック値へ復元。
- NEWS の `#feed-grid` セレクタをトークン化で壊れた状態から復元。
- `check_regressions.py` に CSS カスタムプロパティの直接・間接循環参照検査を追加。
- `visual-snapshot.mjs` に演出解除、フォント・画像待機、乱数固定、単色画像の撮影失敗判定、compare 前検査を追加。
- 詳細ページを再生成。コミット・pushはしていない。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。
- `python3 scripts/check_asset_versions.py`: 成功。
- `python3 scripts/check_regressions.py`: 成功。循環参照0件。
- `node --check scripts/visual-snapshot.mjs` と Python構文検査: 成功。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略。詳細ページ生成のみ外部Google画像取得の240秒タイムアウトで失敗。
- `visual-snapshot capture`: 未確認。localhost bind が環境制限（EPERM）で拒否された。

### 変更したパターン
- CSS変数の自己参照・循環参照防止、NEWSハブのfeedセレクタ、スクリーンショットの描画安定化と単色検査。

### 未確認の類似パターン
- 確認済み・0件：LP配下のHTML/CSSと生成元に残る直接の自己参照・検出可能な循環参照。
- 未確認：localhost bind可能な実ブラウザでの変更前後capture/compareと差分0。

### 次の担当への注意・判断待ち
- localhost bind可能で外部画像取得が安定した環境で、capture/compare と `preflight.sh --fast` を再実行するまで公開扱いにしないこと。

### 2026-10-22 style-snapshot 追加 — 未コミット

### 実施
- `scripts/style-snapshot.mjs` に `capture <out.json>` / `compare <a.json> <b.json>` を追加。
- visual-snapshot と同じ20ページ・390px/1280px・Content-Type付き配信・乱数固定・安定化CSSで、全要素とcontent付き`::before`/`::after`の計算後スタイルを記録・比較するようにした。
- `docs/design/STYLE_MAP.md` に整理時はstyle-snapshot、デザイン変更時はvisual-snapshotで目視する使い分けを追記。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check scripts/style-snapshot.mjs`: 成功。
- `git diff --check`: 成功。
- capture: 未実施。実行環境のlocalhost bindが`EPERM`で拒否されたため。

### 変更したパターン
- 計算後スタイルのJSON保存、HOST正規化、要素数・要素識別子・プロパティ単位の比較と終了コード1。

### 未確認の類似パターン
- 確認済み・0件：なし。
- localhost bind可能な環境での20ページcaptureと差分0比較: 未確認。

### 次の担当への注意・判断待ち
- localhost bind可能な環境で前後JSONをcaptureし、`compare` の差分結果を確認すること。未確認のため公開扱いにしないこと。

### 2026-10-22 デザイン v2 切り替えの下準備（Claude・公開）

### 実施
- 色・透明度・フォントの直書きを CSS 変数へ集約（rgba(240,237,232,*) 252→1、背景 32→0、16進 129→42。残りは :root の定義・theme-color・SVG data URI）。値は等価のみ置換。
- 途中で `--accent: var(--accent)`（自己参照＝無効）を index.html / news.html に作ってしまい、NEWS の「● FEATURED」の赤が白になる不具合が出た → 削除し、循環参照を検出する検査を check_regressions.py に追加。
- 画像比較ツール scripts/visual-snapshot.mjs ＋ scripts/visual-compare.py（Pillow）。初版は data URL 方式で判定・比較が壊れており（別ページ同士で差 0%）、Pillow 方式に作り直した。
- docs/design/STYLE_MAP.md（見た目の地図）、docs/design/V2_PLAN.md（v2 実装の段取り）、docs/design/v2-mock/（Claude Design「Techno Japan — TOP Redesign」の写し）。

### コミット
- chore(design): トークン集約・比較ツール・設計資料。

### 検証
- 計算後スタイルの全要素比較（Claude の試作スクリプト。navigate 後 2.5 秒待って全要素の color / background / border / font / opacity / filter 等を取得）:
  20ページ（JA/EN ハブ・詳細・記事・書き手・submit/favorites/404）× 390/1280px、約2.5万要素で、差はアニメーション途中の値2件のみ（整理前同士でも出る）。
- visual-compare --self-test OK。visual-snapshot は同じページ同士で最大約4%の揺れがあり、目視用と位置づけた。
- style-snapshot（計算後スタイル比較の道具化）は誤検出が多く採用せず（同一ページ2回取りで 3.6万行の差）。

### 変更したパターン
- common.css / detail.css / article-fx.css / 各ハブのインライン <style> / build-detail-pages.mjs の生成 style の色・フォント指定。

### 未確認の類似パターン
- cms.css は対象外（CMS 専用、未トークン化）。
- manifest.json / theme-color / newsletter-draft.mjs の COLORS は CSS 変数が使えないため個別管理（STYLE_MAP.md に一覧）。

### 次の担当への注意・判断待ち
- v2 実装前にユーザー判断が4つ（V2_PLAN.md §4: 切り替え幅 900/700px、Noto Sans JP の配信方法、公開単位、TOP カルーセルのスマホ挙動）。

### 2026-10-22 デザイン v2 第1段 — 共通部品（未コミット）

### 実施
- `common.css` / `common.js` / `search.js` に v2 の共通ヘッダー、フッター、900px スマホメニュー、全画面検索を実装。
- 詳細ページ生成元 `scripts/build-detail-pages.mjs` の nav/footer、Google Fonts の preconnect、Noto Sans JP、JA/EN 共通検索、Favorites 導線を更新。
- 詳細・ハブ・静的ページの `common.css` / `common.js` / `search.js` の `?v` を更新。Favorites はフッターとスマホメニューへ追加。
- `scripts/check_search_modal.mjs` を新しい検索入口（button）に合わせて目的を維持したまま更新。
- デザインから SNS アイコンをヘッダーから外し、LATEST 記事一覧をスマホメニューから外した。既存の本文ニュースレター等は第1段では残した。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/search.js`: 成功。
- `node --check LP/common.js`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功（外部画像は取得失敗時に既存寸法を使用する警告あり）。
- `python3 scripts/check_asset_versions.py`: 修正前に common.js v18 の不一致を検出。全 HTML を v19 に修正済み。最終結果は再実行待ち。
- `bash scripts/preflight.sh --fast`: 詳細ページ生成の外部画像取得で長時間化し、完走結果を取得できず。再実行待ち。
- 実ブラウザ確認: 未実施。localhost listen が環境制限 `EPERM` で拒否されたため。

### 変更したパターン
- 共通 nav/footer、900px breakpoint、モバイル全画面メニュー、全画面検索、NFKC 全語一致、静的詳細 URL 遷移、Google Fonts 読み込み。

### 未確認の類似パターン
- 未確認：実ブラウザでの PC/スマホ表示、メニュー開閉・Esc・フォーカス、検索タブ・結果・Close、JA/EN の実操作。
- 確認済み・0件：`new Function` / `eval` の追加なし、JS による meta/canonical/JSON-LD 書き換えなし。

### 次の担当への注意・判断待ち
- localhost bind 可能な環境で `bash scripts/preflight.sh --fast` と実ブラウザ確認を完走するまで公開扱いにしないこと。CMS は対象外。

### 2026-10-22 v2 第1段 不具合修正（未コミット）

### 実施
- スマホメニューを Menu mock に合わせ、ロゴ付き64pxバー、検索入口、01〜06の6大項目、補助リンク、枠付きJA/EN、文字SNS、タグラインへ修正。
- ハンバーガー色、検索モーダルの DM Sans／プレースホルダー／不透明背景／z-index、検索結果の画像絶対パスと単数ラベル・補足情報を修正。
- EN に存在しない `/en/favorites.html` を `/favorites.html` へ修正。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功。
- JA/EN主要ハブ行数: index 54/54、news 56/56、festivals 130/130、artists 170/170、venues 66/66。
- `python3 scripts/check_asset_versions.py`: 成功。
- `node --check LP/search.js`: 成功。
- `bash scripts/preflight.sh --fast`: 外部 Google Drive 画像取得失敗による詳細ページ生成タイムアウトで失敗。内部リンクの初回失敗は修正後、`/en/favorites.html` 残存なしを確認。
- 実ブラウザ: `node scripts/check_search_modal.mjs` は localhost bind の EPERM で未確認。

### 変更したパターン
- `scripts/build-detail-pages.mjs` の nav/footer生成、`LP/common.css` のメニュー／検索スタイル、`LP/common.js` のメニュー補助要素、`LP/search.js` の検索描画。

### 未確認の類似パターン
- 確認済み・0件: EN favorites 不正リンク、JA/EN ハブ行数不一致。
- 未確認: 実ブラウザでの390px/1280pxのメニュー開閉、検索入力、画像表示、JA/EN切替。

### 次の担当への注意・判断待ち
- 外部画像取得が可能で localhost bind 可能な環境で `bash scripts/preflight.sh --fast` と実ブラウザ確認を完走するまで公開扱いにしないこと。

### 2026-10-22 v2 第3回（未コミット）

### 実施
- `scripts/build-detail-pages.mjs` に静的な `nav-ov-*` メニュー生成を集約し、JAハブ・ENハブ・全詳細ページへ反映。
- `LP/common.js` は開閉、Esc、スクロール停止、フォーカス復帰だけに整理。後付け番号・説明・LATEST・補助要素の生成を削除。
- `LP/common.css` は静的マークアップ用の寸法・書体・色・アニメーションへ変更し、旧 `nav-overlay-sub` / `nth-of-type` / pseudo-element依存を削除。
- フェス検索に `city_ja` / `pref_ja` / `address` 等を追加。「京都」は14件ヒット。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（557詳細ページ、JA/ENハブ生成完了）。
- JA/ENハブ8枚: メニュー項目6/6、行数一致。
- `python3 scripts/check_asset_versions.py`: 成功。
- `node --check scripts/build-detail-pages.mjs LP/common.js LP/search.js` 相当: 成功。
- 旧メニューマーカー: 0件。EN Favorites不正リンク: 0件。
- 実ブラウザ検査: 未確認。`check_mobile_language_toggles.mjs` / `check_search_modal.mjs` は localhost bind の `EPERM` で起動不可。

### 変更したパターン
- 共通メニュー生成、モバイルメニューCSS/JS、フェス検索の日本語地名フィールド、生成済みJA/EN HTML。

### 未確認の類似パターン
- 未確認：実ブラウザでの390pxメニュー操作、JA/EN切替、検索入口から検索モーダルを開く操作。
- 確認済み・0件：旧後付けマーカー、`/en/favorites.html`、JA/ENハブの項目数・行数不一致。

### 次の担当への注意・判断待ち
- localhost bind 可能な環境で実ブラウザ検査を完走するまで公開扱いにしないこと。コミット・pushは行わない。

### 2026-10-22 修正依頼 第5回（未コミット）

### 実施
- `LP/common.css` のヘッダー用 `nav` 規則と子孫セレクタを `body > nav` に限定し、メニュー内の `.nav-ov-main` へ汎用ヘッダー規則が当たらないよう修正。
- 背景レイヤーの body 直下 `div` 規則から `.nav-overlay` を除外し、オーバーレイの赤い光を `z-index:0`、内容を `z-index:1` に分離。
- v2 ヘッダーの `mix-blend-mode` を `normal` に変更。共通CSS内の意図的な `difference` はカスタムカーソルのみ。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（557詳細ページ、更新0件）。
- JA/ENハブ5枚の行数一致: index 1453/1453、news 1347/1347、festivals 1462/1462、artists 1017/1017、venues 1163/1163。
- `python3 scripts/check_asset_versions.py`: 成功。
- 実ブラウザの計算後スタイル確認: 未確認。`nav-overlay` の `position:fixed` と画面高、および `.nav-ov-main` の計算後 `position:relative` はブラウザで要確認。

### 変更したパターン
- ヘッダー限定セレクタ、モバイル全画面メニューの配置・重なり順、v2ヘッダーのブレンドモード。

### 未確認の類似パターン
- 未確認：390px実機相当でのメニュー開閉、項目・下部・JA/ENの重なり、赤い光の見え方。

### 次の担当への注意・判断待ち
- 実ブラウザで390pxを開き、メニューが画面高まで覆うことと操作可能性を確認するまで公開扱いにしないこと。コミット・pushは行わない。

### 2026-10-22 redesign/magazine フェーズ1仕上げ（未コミット）

### 実施
- `LP/index.html` と生成された `LP/en/index.html` に共通ヘッダー、全画面メニュー、検索導線、Noto Sans JP、共通アセット版を反映。
- 検索タブを All / Stories / Festivals / Artists / Venues、記事結果ラベルを Story に統一。
- 共通フッターから Top を外し、Favorites を追加。`.chip` / `.pill` とデザイン変数を `LP/common.css` に追加。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（外部画像12件は取得失敗時の既存寸法へフォールバック）。
- `python3 scripts/check_asset_versions.py`: 成功。
- `node scripts/check_header_logo.mjs`: 成功。
- `bash scripts/preflight.sh --fast`: 48件成功 / 5件省略。詳細ページ生成だけ外部 Google 画像取得待ちで240秒 timeout。
- JA/EN index 行数: 1453 / 1453。
- `check_mobile_language_toggles.mjs`: localhost bind の `EPERM` で未確認。

### 変更したパターン
- TOP の共通 HTML、ハブ生成元の nav/footer、検索ラベル、共通 CSS トークンとチップ／ピル、生成済み JA/EN ハブ。

### 未確認の類似パターン
- 未確認：実ブラウザでの390px/1280px操作、検索タブ・Esc・JA/EN切替、動く背景の実描画。
- 確認済み・0件：旧 News 検索タブ、フッター Top、`/en/favorites.html`、JA/EN index 行数不一致。

### 次の担当への注意・判断待ち
- 仕様との差として、Noto Sans JP はユーザー指定どおり Google Fonts のまま（セルフホスト未対応）。言語切替は仕様の localStorage 方式ではなく、既存どおり JA/EN 対応 URL への遷移。
- localhost bind と外部画像取得が可能な環境でフル preflight と実ブラウザ確認を完走するまで公開扱いにしないこと。

### 2026-10-22 redesign/magazine フェーズ1 共通部品（未コミット）

### 実施
- `scripts/build-detail-pages.mjs` に `footerHtml` と静的ページの共通 chrome 正規化を接続し、JA/EN の全公開ページへ同じヘッダー・メニュー・検索・フッターを反映。
- `/en/favorites.html` を JA から生成する対象へ追加。Favorites の EN リンクと 404 の EN 切替先を実在 URL に統一。
- `scripts/check_shared_chrome.py` を追加し、言語切替先の実在、旧フッター、メニュー／検索欠落を preflight に追加。
- `LP/common.css` の旧 footer-watermark / Discover / SVG 規則とフェスページ固有フッター上書きを削除。
- `LP/app/index.html`、CMS、map、リダイレクト小ページは対象外（PWA／独自 CSP／専用画面またはリダイレクト用途）。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（詳細557枚、EN favorites生成、JA/ENハブ生成）。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ、footer種類1、新メニュー無し0）。
- `python3 scripts/check_asset_versions.py`: 成功。
- `python3 scripts/check_asset_paths.py`: 成功（582ページ）。
- `bash scripts/preflight.sh --fast`: 外部 Google 画像取得待ちで詳細生成が240秒 timeout。その他の検査は進行し、共通 chrome 検査・asset 検査は成功。実ブラウザ未確認。

### 変更したパターン
- 共通 footer 目印、EN_PAGES / enHubFromJa の Favorites、静的ページの共通 chrome 正規化、言語切替先検査、共通 footer CSS。

### 未確認の類似パターン
- 確認済み・0件：新メニュー／検索欠落、旧フッター、言語切替先の不存在。
- 未確認：実ブラウザでの全ページ操作、外部画像取得可能な環境での full preflight。

### 次の担当への注意・判断待ち
- 外部画像取得と localhost bind が可能な環境で full preflight と実ブラウザ確認を完走するまで公開扱いにしないこと。`LP/app/index.html` は今回の対象外。

### 2026-10-23 ヘッダー／フッター細部・preflight修正（未コミット）

### 実施
- `LP/favorites.js` のヘッダーへのFavoritesハート自動差し込みを削除。カードのハート機能とフッター／メニュー入口は維持。
- `LP/common.css` のヘッダー言語表示を現言語=白、区切り=40%、相手言語=62%に統一。メニュー内JA/ENの高さを44pxへ変更。
- `scripts/build-detail-pages.mjs` の共通footerをロゴ／ナビ／SNSの3要素構成へ変更。SNSの縦線を削除してgapを20pxにし、コピー行を左右分離。
- `LP/search.js` の検索入口を「モーダル表示→同期focus→メニューを閉じる」の順に変更。
- `LP/cms.js` の記事プレビュー common.css をv43へ更新し、`LP/cms.html` のcms.jsをv168へ更新。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（詳細557枚、共有chromeを再生成）。
- JA/ENハブ5枚の行数一致: index/news/festivals/artists/venues すべて一致。
- `python3 scripts/check_asset_versions.py`: 成功。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ）。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `git diff --check`: 成功。
- `bash scripts/preflight.sh`: 53件成功。詳細生成は外部Google画像取得失敗により240秒timeout、ブラウザ系8件はlocalhost bindのEPERMで失敗。

### 変更したパターン
- Favoritesのヘッダー自動挿入、共有ヘッダー言語表示、共有footer構造／SNS間隔／コピー行、メニュー言語ボタン、検索モーダル同期focus、CMS記事プレビューのcommon.css版。

### 未確認の類似パターン
- 未確認：実ブラウザでの検索focus、モバイル言語切替、ヘッダー／フッターの実描画。localhost bind EPERMのため自動ブラウザ検査を起動できず。
- 確認済み・0件：共有chrome欠落、JA/ENハブ行数不一致、CMS記事プレビュー版不一致、アセット版不一致。

### 次の担当への注意・判断待ち
- 外部画像取得とlocalhost bindが可能な環境でfull preflightと実ブラウザ操作を完走するまで公開扱いにしないこと。CMSはcommon.cssがv43のため、今後common.cssを上げる場合はcms.js側も同じ値へ更新する。

### 2026-10-23 フッターSNS書体・縦位置（未コミット）

### 実施
- `LP/common.css` の共通footer SNSリンクを Space Mono 10px・字間 .15em・大文字・`--text-a62` に統一し、hover色を `--accent-soft` に変更。既存の `.footer-top` / `.footer-links` の縦中央揃えを維持。
- `scripts/build-detail-pages.mjs` の `COMMON_CSS_VERSION`、CMS記事プレビュー、`LP/cms.html` の版数を更新し、生成済みページへ反映。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（詳細557枚、共有chrome再生成）。
- `python3 scripts/check_asset_versions.py`: 成功（common.css v44 / cms.js v169）。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ、footer種類1）。

### 変更したパターン
- 共通footerのSNSテキスト表示、共通CSS版数、CMS記事プレビューのcommon.css参照。

### 未確認の類似パターン
- 未確認：実ブラウザでの1280px表示とSNS hover色、モバイル表示。
- 確認済み・0件：共通footerの種類違い、アセット版数不一致、CMSプレビュー版不一致。

### 次の担当への注意・判断待ち
- 実ブラウザ確認とfull preflightが未実施のため、公開扱いにしないこと。外部画像取得・localhost bind可能な環境で確認する。

### 2026-10-23 フッターSNSセレクタ修正（未コミット）

### 実施
- `LP/common.css` のSNS規則を現在の `.footer-top` 直下構造に合わせて `footer .footer-social` / `footer .footer-social a` へ修正。
- SNSをSpace Mono 10px・字間`.15em`・大文字・`--text-a62`、hover=`--accent-soft`、gap20px、縦線なし、リンクの最小高さ44pxに統一。旧 `.footer-links .footer-social` と重複するスマホ／後段規則を削除し、`.footer-top` の縦中央揃えを維持。
- `common.css` をv45、CMS記事プレビューもv45、`cms.js`をv170へ更新。詳細ページを再生成。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node scripts/build-detail-pages.mjs`: 成功（詳細557ページ、538ページ更新）。
- `python3 scripts/check_asset_versions.py`: 成功（common.css v45 / cms.js v170）。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ、footer種類1）。

### 変更したパターン
- フッターSNSの構造対応セレクタ、表示仕様、タップ領域、共通CSS版数、CMSプレビュー版数。

### 未確認の類似パターン
- 確認済み・0件：旧 `.footer-links .footer-social` 規則、重複するSNS後段規則、共通footer構造の不一致。
- 未確認：実ブラウザでのSNS表示・hover・モバイル操作。

### 次の担当への注意・判断待ち
- 実ブラウザ確認とfull preflightは未実施のため、公開扱いにしないこと。今回もcommit・pushは行っていない。

### 2026-10-23 redesign/magazine フェーズ1（共通部品）完了（Claude 検証・コミット）

### 実施
- `main` から `redesign/magazine` を作成。docs/REDESIGN_SPEC.md・docs/design-mock/ を追加（ユーザー提供）。仕様に3点のユーザー決定を追記（Noto Sans JP は Google Fonts／メニューの JA/EN はページ全体を /en/ 版へ切替／TOP の FUTURE は CMS「トップ掲載」の2記事）と、フェーズ8「英語版の完成」。
- 共通部品: 固定ヘッダー（ロゴ / ナビ / Search・JA/EN・ハンバーガー、900px 以下はハンバーガーのみ）、全画面スマホメニュー（menuOverlayHtml、番号付き・今のページ赤・掲載申請/ライター募集/Favorites・JA/EN・SNS・タグライン）、全画面検索（Stories/Festivals/Artists/Venues タブ、候補チップ、Esc、JA/EN の遷移先）、フッター（siteFooterHtml、全557ページで1種類）、`.chip` `.pill`、Noto Sans JP（Google Fonts）。
- /en/favorites.html を新設。404 は英語ページとしてメニュー・フッターも EN にそろえた。ヘッダーへのお気に入りハート差し込み（favorites.js）を廃止（お気に入りはフッターとメニューから）。
- 検査追加: scripts/check_shared_chrome.py（フッター1種類・新メニュー全ページ・JA/EN 切替先の実在）を preflight に組み込み。

### コミット
- feat(redesign): フェーズ1 共通部品（このコミット）。

### 検証
- `bash scripts/preflight.sh` 全62件成功（最終版で実行）。
- Claude の自動操作確認（headless Chrome・CDP、390px dpr2 タッチ有効 / 1280px）: JA/EN 計29ページ×2幅でヘッダー・メニュー（position fixed・全画面・6項目・背景スクロール停止）・検索（開く→フォーカス→「sawagi」で結果→Esc で閉じる、EN は /en/ へ遷移）・フッターのリンク先実在・言語切替先実在・横はみ出し0・JS 例外0。（404 は英語ページなので EN の結果が正しい。自前の検査の判定だけが誤検知）
- 途中で見つけて直した不具合: メニューが body>div の共通規則で position:relative になり全画面にならない／ヘッダー用の `nav{}` 規則がメニュー内の nav に当たる／`mix-blend-mode:difference` でハンバーガーが黒／虫眼鏡 SVG が黒い円／お気に入りの #page-subtitle 消失で JS 例外／404 に search.js 無し／メニューの検索入口から開くと sync() の遅延フォーカス復帰でハンバーガーに奪われる（iPhone でキーボードが閉じる）／フッター SNS のセレクタが構造変更で当たらない。
- 撮影で確認: スマホメニュー JA/EN、PC 検索、ヘッダー（ハート無し・JA 白）、フッター（SNS 等幅10px 62%、2段目の左右配置）、/en/favorites。

### 変更したパターン
- 全ページの共通ヘッダー・メニュー・検索・フッターの生成を build-detail-pages.mjs の関数に一本化し、ハブ・静的ページ・詳細ページに同じものを差し込む方式。

### 未確認の類似パターン
- 実機 iPhone での確認は未実施（headless のタッチ模擬まで）。キーボード表示は実機でのみ確認できる。
- LP/app/index.html（PWA、独自の厳しい CSP）は対象外。cms.html・map.html も対象外。
- 英語ページに見える日本語（2026-10-22 計測: 259/277 ページ。内訳は日本語/ENGLISH の切替ボタン、FAQ の住所、日本語名のフェス、開催回の日本語の場所 等）はフェーズ8で対応。

### 次の担当への注意・判断待ち
- フェーズ2（TOP）はユーザーへ報告後に開始。FUTURE は featured の2記事（現在 featured は1本のみ。ユーザーに CMS でもう1本付けてもらう）。
- docs/design/v2-mock/ と V2_PLAN.md は古い（REDESIGN_SPEC.md と docs/design-mock/ が正）。

### 2026-10-23 redesign/magazine フェーズ2 TOP（未コミット）

### 実施
- `LP/index.html` / `LP/en/index.html` にTOP phase 2のシェルを追加し、`LP/top-phase2.css` / `LP/top-phase2.js`でマーキー、4本リード、FUTURE、UPCOMING、STORIES、FESTIVAL INDEX、Playing soon、VENUES、NEWSLETTERを実装。
- 記事は公開済みを日付順、FUTUREのfeatured優先、見出しの`|`/`｜`分割、フェスは開催回の日付、アーティストは今後のlineupから次回出演順で整形。JA/ENは同一JSと`tjLocalized`で分岐。
- `scripts/check_top_artists.mjs`をPlaying soon 6人ランダム＋Shuffleの検査へ更新。`favorites.js`のキャッシュ版をv4へ更新。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/top-phase2.js`: 成功。
- `node scripts/check_top_artists.mjs`: 成功。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ）。
- `python3 scripts/check_asset_versions.py`: 成功（警告: favorites.js v3/v4の意図的な混在）。
- `bash scripts/preflight.sh --fast`: 48件成功、5件省略、2件失敗。詳細ページ生成は外部Google画像取得の240秒timeout、?v検査は実行前にv4へ更新して再検査済み。
- JA/EN `index.html` の行数は1515/1515で一致。実ブラウザ確認は未実施。

### 変更したパターン
- TOP本文の表示・データ整形・スクロールカルーセル・レスポンシブカード・ニュースレター表示、TOP artists検査。

### 未確認の類似パターン
- 未確認：実ブラウザのJA/EN、PC/モバイル、スクロール固定、Shuffle、UPCOMINGフィルタ、Buttondown送信。
- 未確認：外部画像取得が成功する環境での完全な`node scripts/build-detail-pages.mjs`とfull preflight。

### 次の担当への注意・判断待ち
- 外部画像取得可能な環境でビルドとブラウザ確認を再実行するまで公開扱いにしない。CMS変更はなく、本番データへの書き込みはしていない。

### 2026-10-23 TOP 空表示の修正（未コミット）

### 実施
- `LP/top-phase2.js` の `window.ARTICLES/FESTIVALS/ARTISTS/VENUES` 参照を、`typeof XXX !== 'undefined' ? XXX : []` に変更。`data-hub.js` のトップレベル `const` を読むよう修正。
- `LP/index.html` の `top-phase2.js` を `?v=2` に更新。`scripts/check_top_artists.mjs` を実描画ハーネスでカード数・名前まで検査する形に変更。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/top-phase2.js`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功、詳細557ページ、変更0件。
- `node scripts/check_top_artists.mjs`: 成功、6人のカード名を実描画で確認。
- `python3 scripts/check_asset_versions.py`: 成功（favorites.js v3/v4の警告のみ）。
- JA/EN `index.html`: 1519行/1519行で一致。
- 派生画像の実測: `src` と `srcset` が `/images/derivatives/card/...` を指すことを確認。
- `LP/` の `window.ARTICLES/FESTIVALS/ARTISTS/VENUES` 残存: 確認済み・0件。

### 変更したパターン
- TOPの共有データ参照、TOP artists実描画検査、TOPスクリプトのキャッシュバスター。

### 未確認の類似パターン
- 確認済み・0件：`LP/` 内の同じ `window.XXX` データ参照。
- 未確認：実ブラウザでのJA/EN・390px/1280px操作、スクロールカルーセル、UPCOMINGフィルタ、Shuffle、Newsletter送信。

### 次の担当への注意・判断待ち
- 実ブラウザ確認とfull preflightは未実施のため、公開扱いにしないこと。CMS変更・本番データへの書き込みはない。

### 2026-10-23 TOP 仕上げ修正（未コミット）

### 実施
- `LP/top-phase2.css` / `LP/top-phase2.js` を修正。カード名を Bebas Neue・uppercase に統一、900px 以下の FUTURE を1列化、UPCOMING のスマホ位置表示、Newsletter フォーム接続、JS 実行時の SSR 一覧非表示、sticky top を含むカルーセル span を反映。
- `LP/index.html` / `LP/en/index.html` の `?v` を更新し、旧 `.section-head.stories-section-head` 見出しを削除。静的リンク一覧 HTML は保持。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/top-phase2.js`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功、詳細557ページ、変更0件。
- `node scripts/check_top_artists.mjs`: 成功。
- `python3 scripts/check_asset_versions.py`: 成功（既存の favorites.js v3/v4 混在警告のみ）。
- JA/EN `index.html`: 1519行/1519行で一致。

### 変更したパターン
- TOP phase 2 の typography、FUTURE レスポンシブ、UPCOMING mobile metadata、Newsletter form、SSR fallback visibility、carousel scroll span。

### 未確認の類似パターン
- 確認済み・0件：JA/EN の TOP ハブ生成結果、旧 STORIES 見出し要素。
- 未確認：実ブラウザでの JA/EN・390px/1280px の表示／操作、カルーセル固定解除位置、Buttondown 送信。

### 次の担当への注意・判断待ち
- 実ブラウザ確認と full preflight は未実施。公開扱いにしないこと。CMS変更・本番データへの書き込みはない。

### 2026-10-23 TOP旧部品削除・Newsletterフォーム修正（未コミット）

### 実施
- `LP/index.html` から旧TOP専用CSS・マークアップ・描画用インラインJS（Stories、旧イベント／フェス、旧Artists、旧Venues、旧formsubmitフォーム）を削除。
- `LP/top-phase2.css` でTOPのNewsletterフォームを枠なし・最大520px・横一列、入力48px、hover時アクセント色に修正。`?v` を更新。
- `node scripts/build-detail-pages.mjs` でENをJAから再生成。静的リンク目印は保持。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/top-phase2.js`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功、詳細557ページ、変更0件。
- `python3 scripts/check_asset_versions.py`: 成功（既存のfavorites.js v3/v4警告のみ）。
- `python3 scripts/check_shared_chrome.py`: 成功（557ページ）。
- `node scripts/check_top_artists.mjs`: 成功。
- JA/EN `index.html`: 321行/321行で一致。旧TOP識別子は共有CSP/dns-prefetch以外0件。
- `bash scripts/preflight.sh --fast`: 49件成功、5件省略、1件失敗。詳細ページ生成が外部画像取得の240秒timeout。

### 変更したパターン
- 旧TOP専用のHTML／インラインCSS／インライン描画JSの削除、TOP phase 2 Newsletterフォームのレイアウトと状態、JA→ENハブ再生成。

### 未確認の類似パターン
- 未確認：実ブラウザでのJA/EN・PC/モバイル表示とNewsletter入力操作、外部画像取得可能環境でのpreflight再実行。

### 次の担当への注意・判断待ち
- preflightのtimeoutと実ブラウザ確認が未解決のため公開扱いにしないこと。CMS変更・本番データへの書き込みはない。

### 2026-10-23 TOP画像srcset画質修正（未コミット）

### 実施
- `LP/localize.js` にカード用 `srcset` と `heroSrcset` を幅重複なしで統合する `tjHeroSrcsetAttr(value, sizes)` を追加。
- `LP/top-phase2.js` のリードカルーセル（`100vw`）と FUTURE（`(max-width: 900px) calc(100vw - 32px), 50vw`）だけを hero 候補対応に変更。STORIES・UPCOMING・Artists・Venues はカード用のまま。
- `localize.js` の参照を全ハブで `?v=15` に更新。

### コミット
- 未コミット（ユーザー指定、commit・pushなし）。

### 検証
- `node --check LP/localize.js LP/top-phase2.js`: 成功。
- `node scripts/build-detail-pages.mjs`: 成功。外部画像1件は取得失敗のため前回寸法を使用。
- JA/EN `index.html` / `festivals.html` / `artists.html` / `venues.html` / `news.html`: すべて行数一致。
- `python3 scripts/check_asset_versions.py`: 成功（既存のfavorites.js v3/v4混在警告のみ）。
- `node scripts/check_cms_article_generated_preview.mjs`: 成功。
- 実ブラウザでの画質実測・操作確認、full preflight: 未実施。

### 変更したパターン
- TOPリードカルーセルとFUTURE記事カードの画像候補を、カード用最大960pxから記事ヒーロー候補（最大1179px）まで拡張。hero候補がない画像はカード用候補へフォールバック。

### 未確認の類似パターン
- 確認済み・0件：指定されたSTORIES・UPCOMING・Artists・Venuesの呼び出しは未変更。

### 次の担当への注意・判断待ち
- 実ブラウザで390px@3x／1280px@2x相当の取得ピクセル確認と、必要ならfull preflightを実施すること。公開扱いにしない。CMS変更・本番データへの書き込みはない。

### 2026-10-23 redesign/magazine フェーズ2（TOP）完了（Claude 検証・コミット）

### 実施
- LP/index.html を新しい TOP に置き換え（top-phase2.css / top-phase2.js）。マーキー（sticky）、リードカルーセル4本（スクロール連動・lerp 0.055・dwell 0.1・パララックス・スマホも同じ動き）、FUTURE（featured 2本、足りなければ GUIDE で補完、カルーセルから除外）、UPCOMING（チップ All/This week/Festival/Rave、スマホは「場所 · 種別」）、STORIES（中央に ALL STORIES ボタン）、FESTIVAL INDEX、Playing soon（12人から6人ランダム・Shuffle）、VENUES、NEWSLETTER（Buttondown、横一列）。
- 古い TOP の部品・インライン CSS/JS・旧 formsubmit の登録フォームを削除（1,519行→約320行）。
- localize.js に tjHeroSrcsetAttr（カード srcset ＋ heroSrcset）を追加し、カルーセルと FUTURE の画像を記事ヒーロー並みの解像度に。
- 検査: check_top_artists.mjs を「描画結果で6人・Shuffle」を確かめる形に、check_hub_pages の TOP 期待値を新しいコンテナ（id 付き）に更新。

### コミット
- feat(redesign): フェーズ2 TOP（このコミット）。

### 検証
- `bash scripts/preflight.sh` 全62件成功。29ページ×2幅の共通部品確認も問題なし（404 は英語ページで正しい）。
- カルーセル計測（PC/スマホ）: 進行 0→85% で sticky top 64・カウンター 01→04、最後で固定が外れる。1枚目 eager・fetchpriority=high。
- 画質計測（取得画像の実ピクセル）: カルーセル スマホ 1179〜1440px（必要 1170）、FUTURE スマホ 1440（必要 1074）・PC 1440（必要 1160）。PC カルーセルは 1179〜1920（必要 2560、手持ちの最大）。
- 重さ（画像は実ファイルサイズで集計）: 画像 スマホ 1,318KB（本番 1,299KB）、PC 2,084KB（本番 1,745KB）。書体（Noto Sans JP）は別途 約0.5〜0.6MB（ユーザー了承済み）。
  ※ CDP のネットワークイベントでの集計は画像を取りこぼした（132KB と出た）ため不採用。
- 撮影（スマホ・PC・EN、スクロールしながら各欄）: デザインどおり。EN は見出し・本文・ニュースレターまで英語。
- 途中の不具合: window.ARTICLES（const は window に載らない）で全欄が空 → typeof で読むよう修正、check_top_artists が空でも通っていた → 描画結果で確認する形に。

### 変更したパターン
- TOP の描画を top-phase2.js に集約（data-hub の const を typeof で参照）、ヒーロー級画像は tjHeroSrcsetAttr。

### 未確認の類似パターン
- 実機 iPhone でのカルーセルの手触り（headless のタッチ模擬まで）。
- data-hub の const を window.XXX で読んでいる箇所が他にあるか（Codex に検索させた。TOP 以外は今回未修正）。

### 次の担当への注意・判断待ち
- FUTURE の2本目はユーザーが CMS で featured を付けるまで GUIDE の「9月のまとめ」で補完される。

### 2026-10-23 redesign/magazine フェーズ3-1 NEWS 一覧（Claude 検証・コミット。本番未反映）

### 実施
- `LP/news.html` をモック（docs/design-mock/News.dc.html）の構成へ置き換え。EN は `build-detail-pages.mjs` が JA から生成。
  見出し `News`＋件数・更新日（公開記事の最新日付）／カテゴリのチップ／リード（3:2）／2本（16:9）／3本（4:3、`featured` の記事を優先し `Feature ·`）／横長リスト（260px）／Load more（+6）。
- 本番の「見た目でない機能」は残した: `#article/<id>` → 記事ページへ転送、`#tag/<tag>`・`?tag=`（events.html から来る）でタグ絞り込み（`#tag ×` のチップで解除）、`?category=` `?limit=`、記事から戻った時のスクロール位置の復元。
- 共通部品（`.wrap` `.disp` `.mono` `.red` `.rule` `.pagehead` `.btn2`、`.chip` をモックの値に）を `LP/common.css` に1か所で定義。`--text-a65` / `--text-a92` を追加（TOP で `--text-a92` が未定義だった）。
- 再発防止の検査を2つ追加: `scripts/check_hub_head.py`（ハブ12枚の head に GA4・OG・twitter・manifest・JSON-LD 等がそろっているか。preflight に登録）、`scripts/check_regressions.py` に「未定義の CSS 変数」。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- Codex の1回目の実装で、head から **GA4・og:image・twitter・manifest・CollectionPage の JSON-LD** 等が消えていた（main と head のタグを機械比較して発見）→ 復元し、上の head 検査で止まるようにした。
- headless Chrome（390px@3x / 1280px@2x、JA/EN、`$CLAUDE_JOB_DIR/tmp/newsverify.mjs`）で 68/68:
  h1 は `News` の1つだけ／初期 1・2・3・6 本／記事リンクの重複 0／Load more で +6 → 最後でボタンが消える／カテゴリで絞り込み・URL に反映・ALL で戻る／
  `#tag/` でタグのチップが出て ALL で解除／`?tag=<img onerror>` が実行されない／`#article/<id>` が記事ページへ転送／リストの9本目を開いて戻ると位置と表示本数（18）が戻る／
  EN に日本語の表示 0／横はみ出し 0／JS エラー 0（記事へ素早く移動した時のブラウザの View Transition 中断の通知だけ。本番と同じ仕組み）。
- 画質（表示px×dpr ≦ 取得px）: スマホは全画像 OK（リード 1074 必要→1179、2本・3本 1074→1440、リスト 360→480）。
  PC のリードだけ 1344 必要→1179（**元画像が 1179px しかない**。一番大きい候補を使っている）。
- 計算後のスタイルで確認: 見出しの上の余白（h1 の既定 margin が残っていた → 0）、リスト行の崩れ（見出しが画像の下に落ちていた → 右列へ）、サブの文字 10px → モックの px。
- JA/EN 行数一致（news 216/216、index 350/350）、check_asset_versions / check_shared_chrome / check_hub_head / check_og_image / check_jsonld / check_regressions / check_cms_article_generated_preview 成功。

### 変更したパターン
- 本番 news.html から無くしたもの（モックに無い）: ヒーローの説明文、MONTHLY POPULAR（30日の閲覧数順）の並べ替え、GUIDE のカード4枚、ページ内のニュースレター登録欄、読了バー、読み込み中のスケルトン。
- 記事カードのハートは付けていない（本番の news.html にも無く、お気に入りはフェス・アーティスト・会場だけを扱う）。

### 未確認の類似パターン
- 2本・3本の区切り線がリードの直下に付いている（モックは 64px 空けてから線）。フェーズ3-2 の作業で一緒に直す。
- favorites.js の参照が12ページ v=3・2ページ v=4 に分かれている（フェーズ1で中身を変えた）。フェーズ3-2 でそろえる。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- 無くした機能（特に MONTHLY POPULAR とニュースレター欄）を戻すかはユーザー判断待ち。

### 2026-10-23 redesign/magazine フェーズ3-2 FESTIVALS 一覧＋共通の小道具（Claude 検証・コミット。本番未反映）

### 実施
- `LP/festivals.html` をモック（Festivals.dc.html）の構成へ置き換え（旧ページの CSS 520行・JS 550行・旧マークアップを削除）。EN は生成。
  見出し `Festivals`＋`N upcoming · M indexed`・`Updated`／Season（Upcoming・Archive・All）・Type（All types・Festival・Rave）・View（Grid・List）のチップ／Next up（3:2、日程は折り返さない、説明は4行）／Grid（4列→1100px以下3列→760px以下2列）／List／`N results · Sort · Date`。
- 本番の「見た目でない機能」は残した: `?type=rave`（本番のリンク）、記事から戻った時の位置復元、ハート（フェスのお気に入りはここでしか付けられない）。URL に `?season=` `?view=` を追加。
- **`LP/magazine.js`（新規）**: 日付・タイトル分割・Image Position を全ページ共通に。TOP・NEWS もこれに切り替え。
  - TOP の不具合を2つ直した: ①アメリカ等（日本より時間が遅い地域）から見るとフェスの日付が1日前にずれていた（`new Date('2026-10-22')` が UTC 扱い）。②CMS の Image Position（アーティスト28名が「上合わせ」）が TOP で効いていなかった。
- ビルド時に festivals.html へ小さな JSON（`HUB_EXTRA:FESTIVALS`）を書き出す: 今後のフェスの説明文（JA 160字・EN 280字）と更新日（詳細ページの dateModified と同じ値）。hub 用データ（data-hub.js）に説明文が無いため。JA と EN の一致を検査に追加。
- `tjHeroSrcsetAttr` に元画像を最大の候補として追加（フェスの画像は派生が 960px までしか無く、元は 1920px）。
- そのほか: favorites.js の参照を全ページ `?v=4` に統一（フェーズ1で中身を変えたのに12ページが v3 のままだった）、NEWS の区切り線の位置、NEWS の Service Worker 登録の復元（フェーズ3-1 で消えていた）と検査、cms.js の `?v=171`（フェーズ3-1 で中身を変えたのに上げていなかった）。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- headless Chrome（390px@3x / 1000px / 1280px@2x、JA/EN、`$CLAUDE_JOB_DIR/tmp/festverify.mjs`）で 126/126:
  並び順（今後=開始日の早い順・Archive=新しい順・All=今後→過去）をデータから計算した期待値と完全一致／Next up＝並びの先頭／チップの選択表示がクリックに追従／URL の保存と再読み込みでの復元／`?type=rave`／
  XSS（`?type=` `?season=` に攻撃文字列）／グリッドの列数（4・3・2）／日付が折り返さない／ハートがカードの中にある（List 表示も）／戻るボタンで位置が戻る／横はみ出し 0／JS エラー 0／
  日付が東京とロサンゼルスで同じ／JS 無効の時は静的リンク91件が見える・JS 有効の時は見えない。
- 途中で見つけて直したもの: 旧ページの CSS が残り左右の余白が 0／h1 が2つ／`?season=all` が戻らない／チップを押しても選択の表示が変わらない／List 表示でハートがページ右上に重なる／静的リンク一覧が描画後も見える。
- 画質: Next up（PC）は元画像 1920px を使用（3:2 に切るので約 1962px 必要。元画像が最大）。グリッドは全件 OK。
- 重さ: 元画像を候補に足しても TOP・NEWS はほぼ変わらない（TOP の画像 PC 3,045→3,099KB は Playing soon のランダム表示による揺れを含む。NEWS は同じ）。
- TOP: カルーセルの 01→04 の切り替わり位置が変更前と同じ（390px / 1280px）。
- NEWS の再確認 72/72（チップの選択表示の追従を追加）。JA/EN 行数一致（festivals 371/371 ほか）。check_asset_versions / check_hub_head / check_shared_chrome / check_regressions 成功。

### 変更したパターン
- 本番 festivals.html から無くしたもの（モックに無い）: ページ内の検索（`?q=`）、ジャンルのチップ（`?genre=`）、月のナビ（`?period=`）、FESTIVAL/RAVE の切替スイッチ（Type のチップに置き換え。初期は「すべての種別」）、見出し「FESTIVAL GUIDE '26」と説明文。
- `N results` は Next up を含めた件数にした（モックはグリッドの件数。見出しの「N upcoming」と数が合う方を選んだ）。

### 未確認の類似パターン
- EN ページで日本語名のフェスが5件そのまま出る（りんご音楽祭・御月民・森、道、市場・円相芸術音楽祭・SPRING LOVE 春風）。データ側（name_en）の課題でフェーズ8で扱う。
- スマホの List 表示で、都市が空のフェスは状態欄が「· UPCOMING」と点から始まる。次の作業（3-3）で直す。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- **cms.js を変えている（記事プレビュー用の CSS の版数のみ）**。本番に出す時は AGENTS.md の「Publish の経路を触ったら」に従い、Publish pipeline を流して CMS で確認すること。
- 無くした機能（特にページ内検索・ジャンル・月のナビ）を戻すかはユーザー判断待ち。

### 2026-10-23 redesign/magazine フェーズ3-3 ARTISTS 一覧＋固定カルーセルの共通化（Claude 検証・コミット。本番未反映）

### 実施
- `LP/artists.html` をモック（Artists.dc.html）の構成へ置き換え（旧ページの CSS・JS・マークアップを削除）。EN は生成。
  見出し `Artists`＋`134 artists`／**FEATURED（最大3名・スクロールで横に送る固定カルーセル。スマホも同じ動き）**／グリッド（PC 5列・スマホ 2列、A–Z、正方形のカラー写真）。
- **ユーザーが 2026-10-22 に頼んだ3つの機能は残した**（モックには無い）:
  1. 検索欄＋ジャンル＋Origin（JAPAN / INTERNATIONAL。新規）のチップをヘッダー直下に固定（スマホはチップを横スクロール1行、ツールバー 128px）。
  2. 絞り込み・検索を FEATURED にも反映（絞り込み後の人から次の出演が近い順。0人なら FEATURED ごと隠す）。
  3. 下にスクロールした状態で絞り込みを変えたら、結果の先頭（FEATURED か、隠れていればグリッドの見出し）を固定ツールバーの直下へ自動で戻す。
- `LP/magazine.js` に固定カルーセル（`tjMagPinnedCarousel`）と「次の出演」の計算（`tjMagNextAppearances`）を共通化し、TOP もこれを使うように切り替え。
- 前のフェーズの残り: NEWS・FESTIVALS で描画後にカスタムカーソルの拡大を結び直す、FESTIVALS で都市が空の時の「·」を出さない。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- headless Chrome（390px@3x / 1280px@2x、JA/EN、`$CLAUDE_JOB_DIR/tmp/artverify.mjs`）で 108/110:
  FEATURED とグリッドの中身がデータから計算した期待値と一致（全件・HOUSE・HOUSE+JAPAN・検索・0件）／ツールバーが 4000px スクロールしても 64px の位置に残る／
  自動スクロールで FEATURED の上端がツールバーの直下に来る（ずれ ±8px 以内）／先頭が見えている時は動かない／`?genre=` で開いた時は動かない／
  カルーセルが 01→03 と進む／絞り込み直後にカルーセルが流れずにその場で合う／FEATURED の中身がカウンターの行と重ならない（スマホ 844・700・600px、PC 900・760px の高さ）／
  ハート 134 個／Image Position（center top）が効く／reduced-motion で縦並び／JS 無効で静的リンク 134 件が見える／EN に日本語 0／JS エラー 0。
  残り2件は PC 900px の画面で固定部分の下に 40px の空き（モックの `min(100vh, 860px)` の上限どおり。意図どおり）。
- 途中で見つけて直したもの: スマホの FEATURED の高さが 428px に頭打ちで下が空き・文字がカウンターに重なる／絞り込み後にカルーセルが 1〜2 秒かけて流れる／自動スクロールが CSS の smooth で途中を測って 16〜23px ずれる／写真の無いアーティストが壊れた画像になる（`<img src="">`）／見出しの位置が他のハブより 64px 低い。
- TOP: カルーセルの 01→04 の切り替わり位置が変更前と同じ。Playing soon の検査（check_top_artists）成功。日付は東京とロサンゼルスで同じ。
- JA/EN 行数一致（artists 544/544、index 373/373）。check_regressions / check_hub_head / check_shared_chrome 成功。

### 変更したパターン
- 本番 artists.html から無くしたもの: 「出演予定」12名の欄（FEATURED に置き換え）、見出しの説明文と BACK TO HOME。
- 件数: モックどおり見出しの横に `134 artists` を出している（ツールバーには出していない）。

### 未確認の類似パターン
- グリッドのサムネイル: 横長の写真（約50名）を正方形に切ると、表示に必要な画素より少し粗い（本番と同じ「枠の幅」基準の選び方）。くっきりさせると一覧を最後まで見た時に約 1MB 重くなる見込み。判断待ち。
- magazine.js の参照が `?v=1`（index・news・festivals）と `?v=3`（artists）に分かれている。本番未公開のファイルなので利用者への影響は無いが、次の作業でそろえる。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- 件数を見出しに出すか（2026-10-22 に「件数は表示しなくてよい」と言われたのは旧ページの検索欄の横の件数）。
- グリッドのサムネイルの画質と重さの兼ね合い。

### 2026-10-23 redesign/magazine フェーズ3-4 VENUES 一覧＋地図タイルの共通化（Claude 検証・コミット。本番未反映）

### 実施
- `LP/venues.html` をモック（Venues.dc.html）の構成へ置き換え（旧ページの CSS・JS・マークアップを削除）。EN は生成。
  見出し `Venues`＋`22 venues`／City・Type のチップ／**マップ＋Featured**（ピンに hover・スマホはタップで右の Featured が切り替わる。選択中のピンは白く光り名前が出る。絞り込むとピンも絞られて自動ズーム）／グリッド（PC 4列・スマホ 1列、A–Z）。
- 地図は Leaflet（自前配信）＋CARTO（キー付き）。読めない時は OSM の反転表示 → それも無理なら自前の地図（offline）。**CSP は変えていない**。
- **`LP/map-tiles.js`（新規）**: CARTO と OSM 切り替えの処理を1つにまとめ、map.html もこれを使うように（map.html の見た目・動きは変えていない）。
- 本番の「見た目でない機能」は残した: `?area=<CITY>`（本番のリンク）、`#type=`（本番の形）と `?type=`、記事から戻った時の位置復元、ハート。
- 前のフェーズの残り: magazine.js の版数をそろえた、festivals-phase3.css/js・news-phase3.js・top-phase2.js の `?v`（3-3 で中身を変えたのに上げていなかった）。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- headless Chrome（390px@3x / 1280px@2x、JA/EN、`$CLAUDE_JOB_DIR/tmp/venverify.mjs`）で 90/92:
  ピン 22 本＝座標のある会場数／Featured＝絞り込み後の先頭／ピンに hover（PC）・タップ（スマホ）で Featured と光るピンが切り替わる（重なっていないピンを選んで操作）／OSAKA・OSAKA+BAR でピン・グリッド・URL が絞られる／再読み込みで復元／`#type=club`／XSS（`?area=`）／
  ピンの形が崩れていない・名前ラベルが水平／地図の上端が整数の位置（タイルの継ぎ目が出ない）／Leaflet を遮断すると自前の地図に全ピン／JS 無効で静的リンクが見える／map.html はタイルとマーカーが出る／EN に日本語 0／JS エラー 0。
  残り2件は PC の画像がわずかに足りない（Featured 991px 必要→960px、グリッド 754→720px。3〜5%）。
- 途中で見つけて直したもの: タイルの行の境目に横線（地図の入れ物が小数の位置にあった → 上端を整数にそろえる。256.5px に広げる回避策は縦線が出たので撤回）／バーのピン（菱形）の名前が45度に傾く／ピンの形が span で崩れる／検査の期待値がフェスの座標まで数えていた（80 本）。
- `python3 scripts/check_hub_pages.py` 全ハブ成功（地図: init・fallback・tileerror・en_fallback すべて pass）。検査の `measure()` を入れ子の div でも正しく測れるように直した（ARTISTS が 897B と誤って測られていた）。FESTIVALS の下限を「今後の件数は季節で変わる」前提の値に。
- check_venue_maps / check_venue_type_filters / check_asset_versions / check_regressions / check_hub_head 成功。JA/EN 行数一致（5ハブ）。

### 変更したパターン
- 本番 venues.html から無くしたもの（モックに無い）: ページ内の検索（`?q=`）、エリア／タイプのナビ（チップに置き換え）、都市別の地図ボタンと都市ごとの地図、hover のプレビュー欄、ジャンルの絞り込み。

### 未確認の類似パターン
- 本番の CARTO の地図（キーは techno-japan.media 限定のため localhost では 403 → OSM の反転表示で確認）。本番に出した後に見た目を確認すること。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- 無くした機能（特にページ内検索）を戻すかはユーザー判断待ち。

### 2026-10-23 ページ生成の冪等化（未コミット）

### 実施
- `normalizeStaticChrome()` のフッター目印除去を改行ごとの除去に変更し、フッター前後・手書きページの連続空行を正規化。
- `scripts/check_build_idempotent.mjs` を追加し、LP 配下の HTML / JSON / txt / XML 601ファイルをビルド前後で SHA-256 比較。差分時はファイル名と最初の差分行を表示。
- `scripts/preflight.sh` の「詳細ページを生成できる」直後に冪等性検査を登録。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check scripts/build-detail-pages.mjs` / `scripts/check_build_idempotent.mjs`: 成功。
- `node scripts/build-detail-pages.mjs` を2回実行し、2回目は詳細ページ更新0件。冪等性検査も `601ファイルに変化なし` で成功。
- `python3 scripts/check_shared_chrome.py`: 557ページ成功。
- JA/EN行数一致: index 260/260、news 219/219、festivals 316/316、artists 430/430、venues 239/239、about 1171/1171、submit 122/122、writers 216/216、favorites 414/414。

### 変更したパターン
- `<!-- tj:footer:start/end -->` の目印行と、目印前後・共通 script 前後の累積空行。
- LP の手書き JA/EN 19枚と `preflight.sh` の検査登録。

### 未確認の類似パターン
- 生成詳細ページの本文内容・画像表示は変更なし。実ブラウザでの全ページ再確認は未実施。

### 次の担当への注意・判断待ち
- 外部画像150件は取得不能だったため、既存の寸法へ退避する既存仕様の警告が毎ビルド出る。コミット・pushは未実施。

### 2026-10-23 redesign/magazine ページ生成の冪等化（空行が増え続ける不具合）（Claude 検証・コミット。本番未反映）

### 実施
- `node scripts/build-detail-pages.mjs` を流すたびに、手書きのページ19枚（index・news・festivals・artists・venues・about・submit・writers・favorites・404 の JA/EN）で空行が1行ずつ増えていた（フェーズ1 の共通フッターの差し込みが、目印を消すときに改行を残していた）。
  毎日の generate-meta で「中身が変わらない日にも差分が出て、ページが伸び続ける」状態だった。目印の除去を改行ごとにし、連続した空行を2行までに整理。これまでに溜まった空行（約2,000行。index だけで約120行）も消えた。
- 再発防止: `scripts/check_build_idempotent.mjs`（ビルドをもう一度流して、LP/ の 601 ファイルが1つも変わらないことを確かめる）を preflight の「詳細ページを生成できる」の直後に登録。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。本番（main）のページはこの処理を通っていないので影響なし。

### 検証
- ビルドを2回流して2回目に差分 0（git status でも確認）。消えた行はすべて空行（空でない行の削除 0）。
- check_build_idempotent（601 ファイル変化なし）・check_hub_pages 全ハブ成功・check_hub_head・check_shared_chrome（557ページ）・check_asset_versions 成功。JA/EN 行数一致（9組）。

### 変更したパターン
- 共通フッターの差し込み（normalizeStaticChrome）の目印の除去と空行の整理のみ。見た目の変化なし。

### 未確認の類似パターン
- 確認済み・0件: ほかの生成物（JSON・txt・xml を含む 601 ファイル）の非冪等。

### 次の担当への注意・判断待ち
- なし。

### 2026-10-23 redesign/magazine フェーズ4-1 記事の詳細ページ（Claude 検証・コミット。本番未反映）

### 実施
- 記事ページ（`articlePage`。JA/EN 42ページ）をモック（NewsDetail.dc.html）の構成へ: 写真いっぱいのヒーロー（カテゴリ・見出し・サブ）／PC は本文＋右の追従する欄（書き手・公開日・読了時間 → フェス → 概要（日程・会場・出演者（DB にいる人はリンク）・ジャンル）→ All stories）／関連記事／関連フェス6件（PC 3列×2段・スマホ横スクロール。ユーザー確認済み）。
- 残したもの: JSON-LD（NewsArticle の speakable `h1`・`.article-excerpt` と一致）、本文の変換（自動リンク・画像の置換・見出しの文節改行）、article-fx（読了バー・h2 の赤線・画像の配置とキャプション・全幅）、スマホの本文画像の全幅、書き手の表示、シェア、タグ、戻るリンクと位置復元、記事末のニュースレター。
- 画像の `data-layout`（compact 70%・left/right 46% の回り込み・contained・full）をモックの寸法に。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- headless Chrome（390px@3x / 1280px@2x、JA/EN、記事4本、`$CLAUDE_JOB_DIR/tmp/articleverify.mjs`）で 252/268。
  h1 は1つ・`.article-excerpt` と speakable が一致・JSON-LD／ヒーロー画像の先読み／PC の追従する欄（sticky）と概要／スマホの縦書きの情報と小さなフェスのカード／関連記事3・関連フェス6（PC 3列・スマホ横スクロール）／読了バーが進む／h2 の赤線／画像の配置／横はみ出し 0／JS エラー 0。
  残りは検査側の数え方（イベントカードの写真・2枚組の写真・本文中の引用の aside を拾った）と、スマホのヒーロー写真の画質（下）。
- check_build_idempotent（601 ファイル変化なし）・check_asset_versions・check_regressions・check_jsonld・check_cms_article_generated_preview 成功。

### 変更したパターン
- 記事ページから無くしたものは無い。

### 未確認の類似パターン
- スマホのヒーロー写真: 縦長の枠に横長の写真を切り抜くため約2.5倍に拡大され、今の候補（1440px）では粗い。次の作業で、拡大率に合わせて大きい候補を読むようにする。
- スマホの縦書きの情報で、日本語（編集部・公開日・読了時間）が上下逆さまに表示される。次の作業でモックどおり英語のラベル＋向きを直す。
- EN ページの本文の写真のキャプションに日本語が出る（本文の画像の alt が日本語のまま）。データ（記事の英語本文）の課題でフェーズ8で扱う。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- cms.js を変えている（記事プレビューの版数のみ）。本番に出す時は Publish pipeline と CMS の確認が必要（AGENTS.md）。

### 2026-10-23 redesign/magazine ハブ追加修正（未コミット）

### 実施
- NEWS の `popular.json` による Latest / Popular 切り替え、URL復元、注記、人気順レイアウト、Load more、ニュースレターを追加。
- TOP と NEWS のニュースレターを `magazine.js` / `common.css` の共通部品へ統合。
- FESTIVALS / TOP の開催地・状態位置・ジャンル区切りをモックに合わせ、ARTISTS の FEATURED条件・選出・パネル・画像候補を修正。
- VENUES の CAP. 表示を削除し、データ由来のサブエリア絞り込みと URL復元、VENUES / map の共通地図配色を追加。
- TOP の Featured 見出しを削除し、Upcoming カードと背景を調整。モックの grain を可逆 WebP 化して共通背景に使用。
- 記事詳細の縦書きメタ、日付、固定文言、スマホヒーロー画像の sizes を修正。CMS プレビューの CSS 版数とキャッシュ版数も更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check`（変更 JS）成功。
- `node scripts/build-detail-pages.mjs` 完了、`node scripts/check_build_idempotent.mjs` 成功（601ファイルに変化なし）。
- `python3 scripts/check_asset_versions.py`、`python3 scripts/check_hub_head.py`、`python3 scripts/check_regressions.py`、`node scripts/check_cms_article_generated_preview.mjs` 成功。
- JA/EN 行数一致: index 259/259、news 221/221。`node scripts/check_top_artists.mjs` 成功。
- 実ブラウザ確認は未実施（Claude確認待ち）。`python3 scripts/check_hub_pages.py` は sandbox の localhost bind 権限不足で未実施。

### 変更したパターン
- `?sort=popular`、`?subarea=`、人気順のフォールバック注記、ニュースレター共通部品、開催地ローカライズ、CAP. 非表示、背景 grain、CARTO/OSM の共通フィルター、記事ヒーローの cover 拡大率。

### 未確認の類似パターン
- 確認済み・0件: news/index の JA/EN 行数、変更 JS の構文、キャッシュ版数、生成ページ冪等性、回帰検査。
- 未確認: 実ブラウザでの PC/モバイル・JA/EN の操作、Buttondown 送信、実際の `popular.json` 取得後の表示、地図タイルの実景。
- データ課題として報告: `snow-machine-japan` の `location_ja` に住所が入っているため、そのまま表示される。

### 次の担当への注意・判断待ち
- Claude の実ブラウザ確認が完了するまで公開可とは報告しない。公開時は `bash scripts/preflight.sh` 後に Publish 経路の実機確認を行う。

### 2026-10-23 redesign/magazine ハブ・TOP・記事の追加修正（ユーザーの要望・指摘）（Claude 検証・コミット。本番未反映）

### 実施（すべて 2026-10-23 のユーザーの判断・指摘による）
- NEWS: 人気順（MONTHLY POPULAR。`/data/popular.json` の30日閲覧数順・`?sort=popular`・注記は JA/EN）とページ内のニュースレター欄を戻した。ニュースレター欄は TOP と共通の部品（common.css の `.mag-newsletter`・magazine.js）に。
- フェスのカード（FESTIVALS・TOP）をモックに: 状態（UPCOMING/ARCHIVE・TOP は種別）を日付の行の右端に、JA ページは日本語の会場名（`location_ja`）、ジャンルは ` / ` 区切り（`FESTIVAL · HOUSE / LIVE`）。`tjMagFestivalPlace` で共通化。
- ARTISTS: FEATURED は絞り込み無しの時だけ・出演予定のある人からランダムに3名（開くたびに入れ替わる）／件数を消した／パネル全体を1つのリンクにして hover で名前が赤／紹介文は DM Sans 300・やや暗い白・ちょうど4行で切る／サムネイルは切り抜きの拡大率に合わせて大きい候補を読む（`tjMagCoverSizes`）。
- VENUES: CAP. を消した／都市を選ぶとサブエリア（AREA の値から自動。`?subarea=`）／地図を白黒・暗めに（案A。map.html も同じ）＋細い格子。
- TOP: 「Featured」の見出しを削除（モックに無い）／1枚目の記事が開いた直後に画面内に収まる／`.pill` の高さを 40px → 27px（min-height を削除。全ページ共通）／UPCOMING の写真の明るさの演出。
- 全ページの背景をモックと同じに: 粒子をモックの grain.png（可逆 WebP `images/bg-grain.webp`）に、右上の固定の赤い光を body の背景（radial-gradient）で追加。最初は疑似要素で作り**横に 20vw はみ出して、スマホが縮小表示になった**ので、はみ出さない形に直した。
- 記事: スマホの縦書き（Words by / Published / Reading time）を英語＋`text-orientation: sideways`（日本語が逆さまになっていた）、日付を `YYYY.MM.DD`、`Festival details →`・`Related Stories`、スマホのヒーロー写真は切り抜きの拡大率に合わせて大きい候補。

### コミット
- このエントリを含むコミット（redesign/magazine）。push・本番公開はしていない。

### 検証
- headless Chrome（390px@3x / 1280px@2x、JA/EN）: NEWS 86/86、FESTIVALS 141/141、ARTISTS 114/114、VENUES 110/112、記事 284/290、TOP（カルーセルの切り替わり位置は変更前と同じ・1枚目が画面内・pill 27px・日付は東京とロサンゼルスで同じ）。
  残りは画素がわずかに足りないもの（会場の Featured 991→960px、グリッド 754→720px、記事のスマホ本文の写真 1299→1200px＝スクロール演出の拡大分）。
- 重さ（全部スクロールして画像をすべて読んだ時）: ARTISTS スマホ 4,277→4,973KB・PC 2,696→3,687KB（ユーザーが約1MB の増加を了承済み）、記事 labyrinth スマホ 1,307→1,450KB（ヒーローのみ）・PC 変わらず。
- preflight: 63/64 → 落ちたのは TOP の見出しの数の下限（Featured の見出しを消したため）。しきい値を 6 に直し、check_hub_pages 全ハブ成功。check_build_idempotent・check_asset_versions 成功。

### 変更したパターン
- 共通: `.pill` の高さ・背景の粒子と赤い光・地図の色（map.html も）。

### 未確認の類似パターン
- 地図の色（案A）は本番の CARTO のタイルでしか確かめられない（localhost はキーの制限で OSM 表示）。本番に出したら見た目を確認すること。
- snow-machine-japan の `location_ja` に住所が入っている（日本語ページの会場名に住所が出る）。データの修正はユーザーの作業。
- 実機（iPhone）での確認は未実施。

### 次の担当への注意・判断待ち
- cms.js・cms.html を変えている（版数）。本番に出す時は Publish pipeline と CMS の確認が必要。

### 2026-10-23 redesign/magazine フェーズ4-2 フェス詳細ページ（未コミット）

### 実施
- `scripts/build-detail-pages.mjs` の `festivalPage` / `festivalPageV2Body` をモック準拠へ置換。写真いっぱいのヒーロー、6列Fact strip、公式／チケット／Save／Instagram、静的HTMLの4タブ、Overview（説明・言語切替・フライヤー・Access・Feature story・FAQ）、Lineup、Editions、Stories、関連フェス6件を追加。
- `festivalLineupGroupsHtml` の内容・リンク解決・開催回単位の1回表示を保持。`festivalRelatedCardsForPage` の順位・輪の導線、JSON-LD、行動計測クラス、終了回、地図、戻るリンクは保持。
- `LP/detail.css` の旧フェスV2 CSSを置換し、`LP/cms.js` / `LP/cms.html` の詳細CSS／CMS版数を更新。`scripts/check_regressions.py` / `scripts/check_feeds.mjs` は新しい静的Lineup／Storiesパネルを旧検査と同じ目的で数えるよう対応。`scripts/check_cms_preview_frame.mjs` はviewport依存ヒーローを固定比率比較しないよう対応。

### コミット
- なし（ユーザー指示により commit / push 未実施）。生成により既存の詳細HTML（JA/EN、記事・アーティスト・会場を含む）も `detail.css?v=76` へ更新。

### 検証
- `node --check`（生成器、`LP/magazine.js`、`LP/favorites.js`、`LP/cms.js`）成功。
- `node scripts/build-detail-pages.mjs` 完了。`node scripts/check_build_idempotent.mjs` はCMS版数更新後に再実行中。
- check_festival_lineup_render（75開催回、JA/EN一致）、check_jsonld、check_image_position、check_og_image、check_internal_links、check_regressions、check_asset_versions、check_feeds、check_cms_preview_frame、check_cms_article_generated_preview 成功。
- `bash scripts/preflight.sh` は52/64成功。外部画像寸法取得による詳細生成／冪等性の240秒timeout、sandboxのlocalhost bind `EPERM`によるブラウザ系検査が未通過。CMS preview frame とfeedsの検査はその後の単体実行で成功。
- `check_festival_tracking.mjs` は検査内容ではなく sandbox の localhost bind `EPERM` で未実行。実ブラウザ確認はClaude確認待ち。

### 変更したパターン
- `.festival-design-v2` の旧左右分割レイアウトを、モックのヒーロー／Fact／タブ／2列Overview／2列Lineup／Edition行／記事行／3列関連フェスへ置換。
- JS有効時のタブ切替（`aria-selected` / `aria-pressed` / URL hash）とSave状態（`tjFav.toggle('festival', id)`）を追加。JS無効時は全パネルを表示。
- `editionPlace` と関連フェスの場所をJA/ENで表示し、関連フェスの日付をカード用短縮表示へ変更。

### 未確認の類似パターン
- 確認済み・0件: 出演者重複、FAQとFAQPageの質問数差、画像位置、OG画像、内部リンク、回帰メトリクス、CSP禁止の`eval`/`new Function`混入。
- `check_feeds` のsitemap古記事警告（denki-bodhisattva-2026-info）は既存の警告で、検査は成功。
- 未確認: 実ブラウザでJA/EN・PC/モバイルのタブ、hash遷移、Save表示、説明文切替、地図・外部リンク操作。Claude確認待ち。

### 次の担当への注意・判断待ち
- 実ブラウザ確認と `check_festival_tracking.mjs` の実行結果が揃うまで公開済みとは報告しない。公開時は `bash scripts/preflight.sh` 後にPublish経路の実機確認を行う。

### 2026-10-23 redesign/magazine ユーザー確認後の修正（未コミット・未公開）

### 実施
- TOP / NEWS: ニュースレターをページ幅内の内側部品へ変更し、PC・スマホの余白、入力幅、見出し改行を調整。NEWS の並べ替え UI と LOAD MORE の余白を調整。
- TOP / FESTIVALS: モバイルの UPCOMING・Festival Index・リスト行を修正し、同年の日付を短縮表示。TOP の詳細リンクを EN では `/en/` 付きに統一。
- ARTISTS: FEATURED の行間・NEXT 表示・長い名前の折返しを調整し、古い GUIDE 欄を削除。
- VENUES: モバイルの MAP 開閉・初回 Leaflet 遅延読込、sticky フィルタ、TOKYO の5区分を追加。地図のモバイル遅延検査を追加。
- 記事詳細: シェアボタンのサイズ指定を復元、読了バー位置、ヒーロー下余白、関連フェス配置を修正。JA/EN のシェアサイズ検査を追加。
- 生成ページを再生成し、変更した CSS / JS の版数を更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- 変更 JS の `node --check` 成功。
- `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_hub_head.py` 成功。
- `node scripts/build-detail-pages.mjs` 完了、`node scripts/check_build_idempotent.mjs` 成功結果あり。
- JA/EN ハブ5枚の行数一致: index 259/259、news 221/221、festivals 316/316、artists 381/381、venues 245/245。
- `python3 scripts/check_hub_pages.py`、`node scripts/check_article_share.mjs`、`node scripts/check_venue_maps.mjs` は sandbox の localhost bind `EPERM` により未実行。

### 変更したパターン
- `.mag-newsletter` の内側部品化、TOP 見出し下線、NEWS sort 切替、開催回リストの日付短縮、EN 詳細 URL、FEATURED コピー、VENUES の `?subarea=`、Leaflet の mobile lazy-load、article share / progress / related festivals。
- 確認済み・0件: `GUIDE LINKS` の ARTISTS 残存、古い FESTIVALS 非表示用 CSS、EN TOP の未 `/en` 詳細リンク、JA/EN ハブ行数差。

### 未確認の類似パターン
- 実ブラウザでの PC / モバイル、JA / EN の見た目と操作、ニュースレター送信、MAP 開閉後の実タイル、記事シェアボタン実測。

### 次の担当への注意・判断待ち
- Claude が実ブラウザ確認を行うまで公開可とは報告しない。公開前に `bash scripts/preflight.sh` を完走し、Publish 経路の実機確認と `reports/handoff.md` の結果更新を行う。

### 2026-10-23 redesign/magazine フェーズ4-2 ブラウザ確認後の残修正（未コミット・未公開）

### 実施
- フェス詳細: 行動計測対象の重複クラスを解消し、タブ切替時の計測検査を利用者操作に合わせた。タブのARIA／左右キー／roving tabindex、スマホ幅、Instagramボタン、ラインナップの番号箱・枠なし・折返し、現行開催回の年重複、会場名BudouXを修正した。
- 画像: フェスheroとフライヤーに原寸候補を含むsrcset、hero `sizes="100vw"`、Feature storyの3:2横長派生、詳細・記事の関連フェス3列向けsizesを追加した。
- EN: 日本語住所をFAQの文面に使わず、会場名＋県名へフォールバックした。FAQ表示とFAQPage JSON-LDは同じ生成データを使用している。
- TOP / FESTIVALS / VENUES / 記事: ニュースレター余白・入力幅・見出し位置、空ロケーションの区切り、一覧のハート余白、PCのMAP非表示、絞り込み後スクロール、関連フェス見出し・画質、シェアボタンサイズを修正した。
- `LP/cms.js` の記事プレビューCSS版を現行の `common.css?v=50` / `detail.css?v=78` / `article-fx.css?v=18` に更新した。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node scripts/build-detail-pages.mjs` 完了。`node scripts/check_build_idempotent.mjs` 成功（601ファイルに変化なし）。外部Drive画像150件は取得失敗のため既存寸法へフォールバックした警告あり。
- `node --check`（生成器、検査スクリプト、CMS、TOP、VENUES）成功。`check_asset_versions.py`、`check_regressions.py`、`check_festival_lineup_render.mjs`（75開催回JA/EN一致）、`check_jsonld.mjs`、`check_image_position.mjs`、`check_og_image.mjs`、`check_internal_links.py`、`check_image_delivery.mjs`、`check_cms_article_generated_preview.mjs` 成功。
- 生成HTMLでタブの`aria-pressed`残存0件、詳細ごとの`festival-editions-v2` 1件、EN会場FAQの日本語住所0件、画像候補とsizesを確認した。

### 変更したパターン
- `scripts/build-detail-pages.mjs`、`LP/detail.css`、`LP/common.css`、`LP/top-phase2.css`、`LP/venues-phase3.js` / `.css`、`LP/festivals-phase3.css`、`LP/cms.js`、`scripts/check_festival_tracking.mjs`、`scripts/check_festival_lineup_render.mjs`、JA/EN生成HTML。
- 画像版数: `detail.css` 77→78、共通CSS 49→50、TOP 7→8、VENUES 4→5、FESTIVALS 6→7。

### 未確認の類似パターン
- 未確認: 実ブラウザでのJA/EN・1280px@2x／390px@3xの表示と操作、タブ左右キー、画像の実転送量、CMS入力保持、Publish経路。
- `check_festival_tracking.mjs` と記事シェア検査はsandboxのlocalhost bind `EPERM`で実行不可。実ブラウザで計測イベントのlineup／editions／relatedが各1回、festival_id、クリックイベントを確認すること。
- `bash scripts/preflight.sh` は未実行。公開前に必ず完走させること。

### 次の担当への注意・判断待ち
- 実ブラウザ確認とpreflight完走までは公開可として扱わない。CMSを変更したため、本番前は強制リロードを含むCMS確認とPublish経路の確認が必要。

### 2026-10-23 redesign/magazine 小さな残修正（未コミット・未公開）

### 実施
- `LP/map.html` の `common.css` を `v=50` に統一。
- `scripts/check_festival_tracking.mjs` のタブ操作後待機を `setTimeout(150)` に変更。
- フェス詳細のInstagramボタンをv2では幅自動にし、Feature story画像を3:2・`height:auto`・ブロック表示に変更。
- Feature storyに記事ヒーロー系派生画像と原寸を含むsrcsetを追加し、More festivalsと記事側関連フェスの`sizes`を共通化。
- FESTIVALS一覧スマホの既存 `padding-right:56px` を維持し、ハートとの余白8px以上を確保。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check`（生成器・検査スクリプト）成功。
- `node scripts/build-detail-pages.mjs` 完了。
- `node scripts/check_build_idempotent.mjs` 成功（601ファイルに変化なし）。外部画像150件は取得失敗のため既存寸法へフォールバックした警告あり。
- `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_festival_lineup_render.mjs`、`node scripts/check_jsonld.mjs` 成功。
- ブラウザ検査 `check_festival_tracking` はユーザー指定によりClaude確認待ち。

### 変更したパターン
- `COMMON_CSS_VERSION=50`、`DETAIL_CSS_VERSION=79`、v2のsocial link / feature story画像、関連フェス共通sizes、tracking検査待機。

### 未確認の類似パターン
- 実ブラウザでのJA/EN・PC/モバイル表示、画像の実転送量、タブ計測イベント、Publish経路は未確認。
- 確認済み・0件: `common.css?v=49` の残存、旧 `articleRelatedFestivalSrcsetAttr` の残存、More festivalsの旧sizes残存。

### 次の担当への注意・判断待ち
- 実ブラウザ確認と `bash scripts/preflight.sh` 完走までは公開可として扱わない。公開時はCMS／Publish経路と強制リロードも確認すること。

### 2026-10-23 redesign/magazine 小さな修正（未コミット・未公開）

### 実施
- フェス詳細のタブ操作で `tj:festival-section` を発火し、`lineup` / `editions` を既存の `seen` 経由で1回だけ計測するよう修正。
- FESTIVALS一覧スマホの行右余白を56pxから60pxに変更。
- `common.js` を v20、`festivals-phase3.css` を v8へ更新し、生成HTMLを再生成。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check`、`node scripts/build-detail-pages.mjs` 成功。
- `node scripts/check_build_idempotent.mjs` 成功（601ファイルに変化なし）。外部画像150件は取得失敗のため既存寸法へフォールバックした警告あり。
- `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py` 成功。
- ブラウザ検査 `check_festival_tracking.mjs` は未実行（Claude確認待ち）。

### 変更したパターン
- タブ操作時のフェスセクション計測、スマホ一覧行の右padding、共通JS / FESTIVALS CSSのキャッシュ版数。

### 未確認の類似パターン
- 実ブラウザでのタブ計測、JA/EN・PC/モバイル表示、Publish経路は未確認。

### 次の担当への注意・判断待ち
- 実ブラウザ確認と `bash scripts/preflight.sh` 完走までは公開可として扱わないこと。

### 2026-10-23 redesign/magazine preflight 残り3件の修正（未コミット・未公開）

### 実施
- `LP/cms.js` の記事本番プレビューを `detail.css?v=79` に更新し、`LP/cms.html` の `cms.js` を v174 に更新。
- `scripts/check_article_share.mjs` を空きポート・一時プロファイル・CDPの `Runtime.evaluate` を使うJA/EN×PC/スマホ検査へ変更。Chrome終了とプロファイル削除をfinallyで保証。
- `scripts/check_hub_pages.py` の英語フォールバックの完了待ちを25秒へ延長し、地図検査の仮想時間予算を30秒へ拡張。pending時は再試行するよう変更。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check scripts/check_article_share.mjs`、`python3 scripts/check_asset_versions.py`、`node scripts/check_cms_article_generated_preview.mjs`、`python3 -c "import ast; ast.parse(open('scripts/check_hub_pages.py').read())"` 成功。
- `git diff --check` 成功。
- ブラウザ検査はsandboxのlocalhost bind `EPERM`で実行不可。実ブラウザで記事シェアとハブ英語フォールバックを確認すること。

### 変更したパターン
- 記事プレビューの `detail.css` / CMSスクリプト版数、記事シェア検査のCDP実行経路、会場地図の英語フォールバック待機。

### 未確認の類似パターン
- 確認済み・0件: 指定された静的確認4件、アセット版数の一致、CMS本番プレビューの版数。
- 未確認: 実ブラウザでのJA/EN・PC/スマホのシェアボタン計測、preflight内でのハブ英語フォールバック。

### 次の担当への注意・判断待ち
- `bash scripts/preflight.sh` と、localhostを許可した実ブラウザ環境での2検査を完走するまで公開可として扱わないこと。

### 2026-10-23 redesign/magazine フェーズ4-2 フェス詳細 ＋ ユーザー確認後の修正（2回目）（Claude 検証・コミット。本番未反映）

### 実施
- フェス詳細（フェーズ4-2）をモックの作りへ: 全幅ヒーロー、Fact strip（Date / Location / Prefecture / Genre / Lineup / Editions）、ボタンの行（Official site / Tickets / Save / Instagram）、4タブ（Overview / Lineup / Editions / Stories。中身は静的 HTML、JS で切替、`#lineup` 等で開く、矢印キー、`aria-selected` のみ）、More festivals 6件。LINEUP の解決・JSON-LD・FAQ（FAQPage と数一致）・終了回・地図・戻るリンク・計測は保持。JA の会場名は BudouX で文節折り。EN の文に日本語の住所を出さない。
- ユーザー指摘（2回目）: TOP（ニュースレターの余白と幅・Upcoming のチップをスマホで見出しの下に1列・見出しの赤線を h2 に・Festival Index のスマホの状態欄）、NEWS（Sort の文字を削除・Latest / Popular の切替ボタン・LOAD MORE の下の余白）、FESTIVALS（スマホのリストを2段・同じ年の終了日は年を省く）、ARTISTS（FEATURED の行間 18px・NEXT のピル・長い名前を字の大きさで収める・古い GUIDE 欄を削除）、VENUES（スマホは MAP ボタンで地図・開くまで Leaflet を読まない・フィルタの帯を固定・TOKYO を5区分・絞り込み後に結果の先頭へ）、記事（消えていたシェアボタンの CSS を戻す・読了バーをヘッダー下端へ・写真の下の余白・関連フェスの見出しを上に・All festivals を削除・カードの sizes）。
- EN の TOP の詳細リンク 38件が日本語ページを指していた → `/en` へ。`check_hub_pages.py` に「EN ハブに日本語の詳細ページへのリンクが 0 件」を追加。
- フェス詳細の計測: タブを開いた時点でも `festival_section_view` を送る（IntersectionObserver と二重に送らない）。`check_festival_tracking.mjs` と新設の `check_article_share.mjs` を `--dump-dom` から CDP（描画あり）へ。

### コミット
- 30814d1fa（WIP フェス詳細）、7081640f0（WIP ユーザー修正2回目）、このエントリを含むコミット（残りの修正・検査）。

### 検証
- `bash scripts/preflight.sh`: 全65件成功（記事のシェアボタンの検査を含む）。CMS の実操作・Publish の実機確認は未（cms.js は版数のみの変更。本番に出す前に必要）
- 実ブラウザ相当（CDP、PC 1280〜1440 dpr2 / スマホ 390・360 dpr3、JA/EN）: フェス詳細 356/356、ユーザー修正 297/297、NEWS 86/86、FESTIVALS 141/141、ARTISTS 114/114、VENUES 114 中 112（既知: カード画像が 3〜5% 不足）、記事 290 中 284（既知: スマホ本文画像が 8% 不足。fx の拡大）。`check_festival_tracking.mjs` 3回連続成功。計測は lineup / editions / related が各1回（重複なし）を CDP で確認。
- 重さ（同じ方法・全スクロール・外部ドメイン込み）: フェス詳細 labyrinth スマホ 941→1,370KB / PC 785→1,464KB、sawagi スマホ 1,156→2,488KB / PC 1,006→2,570KB（全幅ヒーローとフライヤーの候補に原寸を入れたため）。

### 変更したパターン
- 共有 CSS を置き換えたときに他ページのセレクタまで消える（記事の `.article-share`、アイコンが 720px に巨大化）→ 復旧し、記事のシェアボタンの大きさの検査を追加。以後の指示書に「消えたセレクタを git diff で確認」を入れた。
- ページの wrap（`.top2-wrap`）と部品のクラスを同じ要素に付けて余白が打ち消される → 部品を内側の要素に。後から読まれる CSS に打ち消される指定は、打ち消されない書き方に。
- 旧デザインの固定幅（`.festival-social-link` 48px、`.newsletter-form` max-width 440px）が新しい部品に効く → 上書き。
- タブで隠した区画は IntersectionObserver の計測が送られない（dump-dom の検査では特に）→ タブ切替時にも送る＋検査を CDP に。

### 未確認の類似パターン
- アーティスト・会場の詳細ページは 4-3 / 4-4 で作り直す（指示書に共有 CSS の削除確認を追加済み）。
- iPhone の実機確認は未。CARTO のキーは本番ドメインだけで効くため、地図の配色（案A）は本番に出してから確認が必要。

### 次の担当への注意・判断待ち
- フェス詳細の画像の重さ（上記）はユーザー判断待ち。中間サイズの派生画像（フェスのヒーロー・フライヤー）を作れば、例えば sawagi のフライヤー 961KB → 約600KB に下げられる（`scripts/build-image-derivatives.py`、Drive 同期の定期ワークフローに関わる）。
- TOKYO の5区分の割り当て（HATAGAYA→SHINJUKU、EBISU / NAKAMEGURO→DAIKANYAMA、JINGUMAE / OMOTESANDO→AOYAMA、ROPPONGI は会場0件で非表示）はユーザー確認待ち。
- データ: saloon の AREA は SHIBUYA だが住所は UNIT と同じ恵比寿西（DAIKANYAMA）。EN の英語住所（ADDRESS_EN）はフェーズ8。
- cms.js / cms.html を変えている（版数のみ）→ 本番に出す時は Publish pipeline ＋ CMS の確認が必要（AGENTS.md）。

### 2026-10-23 redesign/magazine フェーズ4-3 アーティスト詳細（未コミット・未公開）

### 実施
- `scripts/build-detail-pages.mjs` の `artistPage` を ArtistDetail モック準拠へ置換。パンくず、4:5ヘッド、JA/EN bioチップ、全リンク、Facts、出演行、Related artists、Stories、FAQ、更新日、ALL ARTISTS を静的生成する構造にした。
- 出演予定は全件を日付順、過去はフェスごとに全開催回の年を保持して表示。関連アーティストは共通ジャンル・bio・写真・拠点・安定ハッシュで決定的に選択。
- `LP/detail.css` の旧アーティスト用指定を置換し、フェス詳細の見出し行・FAQ表示と関連記事カード部品を再利用。`detail.css` を v80、`lang-toggle.js` を v2へ更新し、言語チップの `aria-pressed` も同期。
- `scripts/check_artist_pages.mjs` を新しい出演行（`data-edition-id` / `data-date` / `data-status`）向けに更新。画像位置検査と `venues-phase3.js` の版数も現状へ合わせた。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- `node --check`、`node scripts/build-detail-pages.mjs` 成功。
- `node scripts/check_build_idempotent.mjs` 成功（601ファイルに変化なし）。外部画像150件は取得失敗のため既存寸法へフォールバックした警告あり。
- `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_artist_pages.mjs`、`node scripts/check_cms_artist_preview.mjs`、`node scripts/check_jsonld.mjs`、`node scripts/check_image_position.mjs`、`node scripts/check_og_image.mjs`、`python3 scripts/check_internal_links.py` 成功。
- 実ブラウザ確認、`bash scripts/preflight.sh`、Publish pipeline は未実行（Claude確認待ち）。

### 変更したパターン
- 旧アーティストの `detail-hero` / `related-card` / `lineup-list` を新しい静的 head・出演表・Related・Stories構造へ置換。
- 関連記事ヘルパーに gridカードと副題表示のオプションを追加。共有フェス見出し行とFAQの見た目をアーティストでも使用。
- アーティスト詳細全JA/EN生成HTML、共有 `detail.css`、`lang-toggle.js`、検査スクリプト、キャッシュ版数を更新。

### 未確認の類似パターン
- 確認済み・0件: 記事・フェス・会場の共有CSSセレクタ消失、JSON-LD/FAQ数、画像位置、内部リンク、アセット版数。
- 未確認: 実ブラウザでのアーティストJA/EN・PC/390px表示、bio切替操作、390pxの実測scrollWidth、画像選択、Publish経路。

### 次の担当への注意・判断待ち
- Claudeが実ブラウザで `?cb=<乱数>` 付きのアーティスト詳細をJA/EN・PC/モバイルで確認し、未確認経路を記録すること。公開前に `bash scripts/preflight.sh` を実行すること。

### 2026-10-24 redesign/magazine フェーズ4-3 ブラウザ確認前の修正（未コミット・未公開）

### 実施
- 言語チップを `JA` / `EN` に統一し、`aria-label` と `aria-pressed` を付与。フェス・会場・アーティストの bilingualBody で共通の枠なしチップ表示にした。
- 900px以下の出演表を Date / Festival / Status の3列へ変更し、Locationを隠し、日付のellipsisを解除。Related / Stories / FAQのモバイル見出しとリンク折返しを調整した。
- Artist FAQを他セクションと同じ見出し行の `FAQ` に変更。Related画像は原画像比率によるcover幅補正、Stories画像はwide候補と3列/1列のsizesを生成するよう変更した。
- `detail.css` を v81、`lang-toggle.js` を v3へ更新。CMS記事プレビューの `detail.css` 参照も v81へ同期した。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- 成功: `node --check`（build-detail-pages / lang-toggle / cms）、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_artist_pages.mjs`、`node scripts/check_cms_artist_preview.mjs`、`node scripts/check_jsonld.mjs`、`node scripts/check_cms_article_generated_preview.mjs`。
- 外部画像150件は取得失敗時に前回寸法へフォールバックする警告あり。実ブラウザ確認、`bash scripts/preflight.sh`、Publish pipelineは未実行。

### 変更したパターン
- `lang-toggle` の共通チップ表示、アーティスト出演表のモバイル列、セクション見出し、アーティストFAQ見出し。
- アーティストRelatedのcover補正付きsizes、Storiesのwide srcsetとグリッドsizes、detail.css/lang-toggle.js/CMSプレビュー版数。

### 未確認の類似パターン
- 確認済み・0件: フェス・会場のFAQ数、bilingualBody構造、JSON-LD、全134アーティストの出演行、アセット版数。
- 未確認: 実ブラウザでのJA/EN切替操作、PC/スマホの実寸レイアウト、画像の実選択、Publish経路。

### 次の担当への注意・判断待ち
- Claudeが `?cb=<乱数>` 付きのJA/ENアーティスト詳細をPC・スマホで確認し、未確認経路を記録すること。CMS変更を含むため、公開前は強制リロードと `bash scripts/preflight.sh` が必要。

### 2026-10-24 redesign/magazine アーティスト詳細の残り3点（未コミット・未公開）

### 実施
- 出演表の日付列をPC／スマホとも150px固定にし、日付のellipsisを削除。ENの月名入り日付も1行表示にした。
- Appearances / Related / Stories / FAQ のモバイル見出しを34pxに固定し、共有フェス用ルールの後段でも適用されるようにした。
- Storiesグリッドは `fourThree` 派生がある記事だけ4:3画像を使い、無い記事は従来の画像経路を維持。`detail.css` とCMSプレビューをv82へ同期した。

### コミット
- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更は保持。

### 検証
- 成功: `node --check`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_artist_pages.mjs`、`node scripts/check_cms_article_generated_preview.mjs`、`git diff --check`。
- 外部画像150件は取得失敗時に前回寸法へフォールバックする警告あり。実ブラウザ確認と `bash scripts/preflight.sh` は未実行。

### 変更したパターン
- アーティスト出演表の固定日付列、モバイル見出しサイズ、記事4:3派生画像の選択、detail.css版数、CMS記事プレビュー版数。

### 未確認の類似パターン
- 確認済み・0件: fourThreeが無い記事の従来経路、JA/EN静的生成、全134アーティストの検査、他ページ用共有CSSセレクタの削除なし。
- 未確認: 実ブラウザでのJA/EN・PC/スマホの実寸表示、日付の視認、Stories画像の実ロード、Publish経路。

### 次の担当への注意・判断待ち
- 公開前に`?cb=<乱数>`付きのJA/ENアーティスト詳細をPC・スマホで強制リロードして確認し、CMS変更のため必要ならPublish pipelineも実行すること。

### 2026-10-24 redesign/magazine フェーズ4-3 アーティスト詳細ページ（Claude 検証・コミット。本番未反映）

### 実施
- `artistPage` をモックの作りへ: パンくず、4:5 の写真＋名前（長い1語は字を小さくして収める・文字途中で折らない）、bio の JA / EN 切替（チップ `JA` `EN`。`bilingualBody` 共通のためフェス詳細・会場詳細の説明文の切替も同じ見た目）、リンク（Instagram / SoundCloud / Bandcamp / Website ↗）、Facts（Based in / Genre）。
- Appearances: 出演予定（日付の近い順）→過去（新しい順）を1つの表に。PC は Date / Festival / Location / Status、スマホは Location を隠す。日付は省略・折り返しなし、列の幅を固定してフェス名の左端をそろえる。`artist-upcoming` / `artist-past` のクラスは維持（check_regressions / check_artist_pages が数える）。
- Related · ジャンル 5人（決まった順。共通ジャンル→bio→写真→拠点の区分→本人と相手の id のハッシュ）、Stories（4:3 のカード、記事の fourThree 派生を優先）、FAQ（見出し `FAQ`、FAQPage と数一致）、更新日、ALL ARTISTS。
- `lang-toggle.js` が `aria-pressed` も更新するように。`check_artist_pages.mjs` を新しい作りに合わせ「見つからなければ失敗」に。

### コミット
- このエントリを含むコミット。

### 検証
- build / 冪等性（601ファイル）/ asset versions / regressions / check_artist_pages（134人）/ check_cms_artist_preview / check_jsonld / internal links 成功。
- 実ブラウザ相当（CDP、PC 1280 dpr2 / スマホ 390 dpr3、JA/EN、dj-maria・ken-ishii・dungeoneering・yellowuhuru（写真なし）・kuo-from-sunset-rollercoaster）: 362/362。全134人の名前が PC・スマホで枠に収まり横にはみ出さない。EN ページの画面に見える日本語 0。
- 影響確認: フェス詳細 356/356、記事 290 中 284（既知: スマホ本文画像 8% 不足）。detail.css の置き換えでアーティスト以外のセレクタの消失 0（機械的に比較）。

### 変更したパターン
- 日付に `text-overflow: ellipsis` を使わない（情報が消える）。列の幅で収める。
- 表の行ごとに列の幅が変わる（max-content）と、隣の列の左端がそろわない → 固定幅。
- 4:3 の枠に 16:9 の切り抜きを使うと必要画素が増える → 枠に合う切り抜きの派生を使う。

### 未確認の類似パターン
- 会場詳細（4-4）は次に作る。iPhone 実機は未確認。

### 次の担当への注意・判断待ち
- なし（本番には未反映。公開は全フェーズ確認後にユーザー判断）。

### 2026-10-24 redesign/magazine フェス画像 xl 派生追加（未コミット・未公開）

### 実施
- `scripts/build-image-derivatives.py` に、`LP/images/festivals/` の長辺1440px超の画像へ品質85・長辺1440pxの `xl` 派生を作る処理を追加。ヒーローとフライヤーの両方を対象にし、フェスでは転送量がほぼ変わらない `xxl` は作らない。
- 同名のハッシュ付き派生が存在する場合は再保存せず、既存ファイルの寸法だけ読んでmanifestへ反映するよう、カード・記事hero・本文・アスペクト派生の保存処理を変更。
- `scripts/check_image_derivatives.py` に、長辺1440px超のフェス原本の `xl` とmanifest掲載、フェス`xxl`不在、派生の長辺上限を検査する項目を追加。
- `LP/image-derivatives.js`、フェスJA/EN詳細ページ、`LP/image-dimensions.js` / `.json` を再生成。`largeSrcsetAttr` は既存のまま `srcset` と `heroSrcset` を結合し、フェスのヒーロー・フライヤー双方で`xl`候補を使用することを確認。`sizes` は変更なし。
- `.github/workflows/sync-drive-images.yml` は変更なし。ワークフロー内の呼び出し手順も変更なし。

### コミット
- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更は保持。

### 検証
- 成功: `python3 scripts/build-image-derivatives.py`、`python3 scripts/check_image_derivatives.py`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）、`python3 scripts/check_regressions.py`。
- 成功: 既存派生2551枚のSHA-256全件一致。新規フェス`-xl.webp`は110ファイル、合計23,528,390 bytes（22.44 MiB）。manifest変更はフェス110項目の`heroSrcset`追加のみで、`xxl`は0件。
- 確認例: 横長画像は`-xl.webp 1440w`、縦長フライヤーは`-xl.webp`の実幅（1024〜1152w）を出力。
- `python3 scripts/check_asset_versions.py` は既存の`cms.js`版不一致（`?v=174`導入後にアセットが変更）で失敗。今回`cms.js`は変更していないため範囲外として未修正。
- `git pull --ff-only` は共有worktreeの親`.git/worktrees/.../FETCH_HEAD`書き込み不可で実行できず。実ブラウザ確認、`bash scripts/preflight.sh`、Publish pipelineは未実行。

### 変更したパターン
- フェス原本の長辺1440px超に対する品質85の`xl`生成、manifestの`heroSrcset`、既存派生の再保存抑止、フェス派生検査、フェス詳細JA/ENのヒーロー・フライヤー`srcset`。

### 未確認の類似パターン
- 確認済み・0件: フェス以外の既存派生バイト差分、フェス`xxl`生成、`largeSrcsetAttr`の`heroSrcset`結合、JA/EN詳細ページの`xl`幅宣言、`sizes`の変更なし、Sync Driveワークフロー手順の変更なし。
- 未確認: 実ブラウザでのJA/EN・PC/モバイルの実際の画像選択と表示、Publish pipeline、本番データ経路。

### 次の担当への注意・判断待ち
- 公開前に`cms.js`の既存版不一致を解消して`check_asset_versions.py`を再実行し、実ブラウザ確認と`bash scripts/preflight.sh`を実施すること。CMSの変更は今回なし。

### 2026-10-24 redesign/magazine 小修正（未コミット・未公開）

### 実施
- フェス詳細ヒーローの `sizes` を、`IMAGE_DIMENSIONS` の原画比率とスマホ枠比率0.7から計算するよう変更。記事ヒーローの計算は従来値を維持。
- `LP/cms.html` の `cms.js?v=174` を `cms.js?v=175` に更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。既存の xl 派生画像を保持。

### 検証
- 成功: `node --check scripts/build-detail-pages.mjs`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_image_derivatives.py`。
- 生成確認: `LP/festivals/sawagi-festival.html` のヒーロー `sizes="(max-width: 900px) calc(100vw * 2.14), 100vw"`。

### 変更したパターン
- フェスヒーローの cover 用 `sizes`、CMS JavaScript のキャッシュ版数。

### 未確認の類似パターン
- 確認済み・0件: 記事ヒーローの従来出力、JA/ENフェス詳細の生成、xl派生の実体・幅宣言。
- 未確認: 実ブラウザでの画像選択・表示、PC/モバイルの操作確認、Publish pipeline。

### 次の担当への注意・判断待ち
- 公開前に実ブラウザ確認と `bash scripts/preflight.sh` を実施すること。今回の作業では公開していない。

### 2026-10-24 redesign/magazine フェスの写真・フライヤーに長辺 1440px の派生画像（Claude 検証・コミット。本番未反映）

### 実施
- ユーザー承認（2026-10-24「画質は今のまま、中間の画像を足して軽くする」）。`scripts/build-image-derivatives.py` で、長辺が 1440px を超えるフェスの画像（ヒーロー・フライヤー）に `xl`（長辺 1440px・q85）を作り、マニフェストの `heroSrcset` に載せる。110枚・22.4MB 増。
- 既にある派生画像は保存し直さない（ファイル名に原本のハッシュが入っているため）。手元と CI の Pillow / libwebp の版の違いで、既存 2,551 枚のバイトが変わる巨大な差分を防ぐ。既存の派生画像の差分 0 を SHA-256 で確認。
- フェス詳細のヒーローの `sizes` を、切り抜きを考えた値に（スマホの枠 390×560 に横長の写真を cover で入れるため。例 sawagi `(max-width: 900px) calc(100vw * 2.14), 100vw`）。xl を足した直後は `100vw` のままでスマホのヒーローの画質が下がっていた（1440 / 必要 2520）→ 元どおり原寸が選ばれる。
- `check_image_derivatives.py` に xl の確認を追加。`LP/cms.html` の `cms.js?v` を 175 へ（直前の cms.js の版数変更の上げ忘れ）。

### コミット
- このエントリを含むコミット。

### 検証
- 派生画像 3,221枚の検査、build / 冪等性 / asset versions / regressions 成功。フェス詳細 4件 356/356（全画像 表示px × dpr ≦ 取得px、原寸が上限のものは除く）。
- 重さ（同じ方法・全スクロール・外部込み）: labyrinth スマホ 1,370→1,320KB / PC 1,464→1,413KB、sawagi スマホ 2,488→2,126KB / PC 2,570→2,208KB（フライヤーが原寸 961KB → xl 598KB）。

### 変更したパターン
- srcset に中間の候補を足すと、`sizes` が切り抜きを考えていない画像では小さい候補が選ばれて画質が下がる → 候補を足すときは `sizes` も切り抜きを考えた値にする。

### 未確認の類似パターン
- 会場の詳細ページのヒーロー（21:9）も同じ考え方で `sizes` を決める（4-4 で確認する）。
- `.github/workflows/sync-drive-images.yml` は手順を変えていない（中のスクリプトの動きだけ変わる）。本番に出したあと、次回の自動同期で差分が出ないことを確認する。

### 次の担当への注意・判断待ち
- 本番未反映。cms.js / cms.html は版数のみの変更だが、公開時は Publish pipeline ＋ CMS の確認が必要。

### 2026-10-24 redesign/magazine フェーズ4-4 会場詳細ページ（未コミット・未公開）

### 実施
- `scripts/build-detail-pages.mjs` の `venuePage` を VenueDetail モックに合わせて再設計。21:9写真／将来のGALLERY 3枚スプレッド、パンくず、英語固定ラベルのFacts、Website・Instagram（@ハンドル）・Google Maps、HOURSフォールバック、Charge、Features、GOOD TO KNOW、開催回のUpcoming/Past切替、Nearby、Stories、FAQ、更新日、ALL VENUESを静的生成するよう変更。
- 開催回の出演者表示のため `lineupsByEdition` とアーティスト索引を `venuePage` に渡した。Capacityは画面へ出さず、既存JSON-LDの `maximumAttendeeCapacity` は維持。
- `LP/detail.css` に会場レイアウトとスマホ（1列ギャラリー220px、Nearby 2列、開催行の場所列非表示）を追加し、`detail.css` を83へ更新。`LP/cms.js` の記事プレビューも同版へ更新。
- `scripts/check_venue_details.mjs` / `scripts/check_venue_details_browser.mjs` を新DOMへ対応。FAQ表示数とJSON-LD件数、HOURS、空Charge、GOOD TO KNOW、Nearby上限、Capacity非表示を検査。`scripts/check_image_position.mjs` は会場ギャラリーをheroとして認識するよう更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。生成されたJA/EN詳細ページの変更を含む。

### 検証
- 成功: `node --check`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_venue_details.mjs`、`node scripts/check_jsonld.mjs`、`node scripts/check_image_position.mjs`、`node scripts/check_og_image.mjs`、`python3 scripts/check_internal_links.py`、`node scripts/check_cms_article_generated_preview.mjs`、`git diff --check`。
- `scripts/check_venue_details_browser.mjs` はlocalhost待受が実行環境のEPERMで起動できず未確認。外部画像150件はネットワーク制限により既存寸法へフォールバックする警告あり。

### 変更したパターン
- 旧 `detail-inner` / `detail-facts` / `lineup-list` の会場詳細を、アーティスト詳細と同じ `wrap`・`festival-section-heading`・`row`・`card`・`festival-faq-details` 系の静的構造へ変更。`heroSrcsetAttr`、`dimensionAttrs`、`imagePositionStyle`、実表示幅に合わせた `sizes` は維持・適用。
- 共有 `LP/detail.css` は追加のみで、記事・フェス・アーティスト用セレクタの消失は確認済み・0件。

### 未確認の類似パターン
- 確認済み・0件: JA/EN静的生成、写真なし会場の空箱、過去開催のみのPast初期選択、FAQ数一致、4件以内のNearby、Capacityの画面非表示、既存JSON-LDキーの維持。
- 未確認: 実ブラウザでのJA/EN・390/1280px表示、Upcoming/Pastクリック操作、将来GALLERY入力時の実画像選択、Publish pipeline、本番CMS操作。

### 次の担当への注意・判断待ち
- 公開前に実ブラウザ確認を行い、390pxで `scrollWidth <= innerWidth`、イベント切替の `aria-pressed`、リンク遷移、画像表示を確認すること。CMS／Publish経路は未実行のため、公開前に通常手順で確認すること。

### 2026-10-24 redesign/magazine 会場詳細の残り3点（未コミット・未公開）

### 実施
- 会場 h1 に `container-type: inline-size` と `cqw` 基準の文字サイズを追加し、最長語の文字数に応じたクラス閾値を調整。途中で折らず、22会場の長い名前を対応。
- `name_kana` の可視表示を JA のみに限定。EN の JSON-LD `alternateName` は維持。
- `check_venue_details_browser.mjs` の Facts / Nearby 判定を大文字小文字非依存に変更。Capacity と横幅判定は維持。
- `detail.css` の版数を84へ更新し、生成済みJA/EN詳細ページとCMSプレビューへ反映。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- 成功: `node --check`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`node scripts/check_venue_details.mjs`、`node scripts/check_jsonld.mjs`、`git diff --check`。
- 代替Chrome実測成功: 実CSS・実フォントで22会場を390px/1280pxに描画し、全h1が `scrollWidth <= clientWidth`。
- `node scripts/check_venue_details_browser.mjs` はlocalhost待受が実行環境のEPERMで起動できず未確認。判定式の変更はソース確認済み。

### 変更したパターン
- `.venue-head-copy` のコンテナクエリ、`.venue-title` / long / longest の `cqw` サイズ、会場タイトルクラス閾値。
- EN会場詳細の可視読みがな、ブラウザ検査のFacts / Nearby比較、detail.css版数84。

### 未確認の類似パターン
- 確認済み・0件: JA/EN 22会場の静的生成、JSON-LD alternateName、Capacity非表示、既存共有CSSセレクタの消失、390px/1280pxのh1横幅。
- 未確認: localhostを使う公式ブラウザ検査の完走、Publish pipeline、本番CMS操作。

### 次の担当への注意・判断待ち
- 公開前に実行環境で `node scripts/check_venue_details_browser.mjs` を再実行し、成功結果を確認すること。CMS／Publish経路は未実行のため、公開前に通常手順で確認すること。

### 2026-10-24 redesign/magazine 会場詳細の幅修正（未コミット・未公開）

### 実施
- `LP/detail.css` の `.venue-detail-v2` に `width: 100%` / `max-width: none` を追加し、旧 `.detail-page { max-width: 860px }` を上書き。共通 `.wrap` の最大1360pxと左右40pxの内側幅を使うようにした。
- 会場ギャラリーの `sizes` を、単独21:9ヒーローは `(max-width: 900px) calc(100vw - 32px), calc(min(100vw, 1360px) - 80px)`、スプレッドはPCのグリッド実幅とモバイル1列幅へ合わせて更新。画像の切り抜き枠に対して表示幅を過小申告しない。
- `detail.css` の版数を84から85へ上げ、生成済みJA/EN詳細ページとCMS記事プレビューへ反映。アーティスト用・フェス用・記事用の共有セレクタは削除していない。

### コミット
- なし（ユーザー指示により commit / push 未実施）。

### 検証
- 成功: `node --check scripts/build-detail-pages.mjs`、`node --check LP/cms.js`。
- 成功: `node scripts/build-detail-pages.mjs`（最後まで完了）、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）。
- 成功: `python3 scripts/check_asset_versions.py`（detail.css ?v=85）、`python3 scripts/check_regressions.py`、`node scripts/check_venue_details.mjs`（22件 × JA/EN）。
- 未確認: `node scripts/check_venue_details_browser.mjs` は localhost 待受が実行環境の `EPERM` で起動できず。Publish pipeline、本番CMS操作も未実行。

### 変更したパターン
- `.detail-page` の最大幅を v2 会場ページだけ解除し、`.wrap` の最大1360pxを利用するパターン。
- 単独21:9ヒーロー、将来の2枚ギャラリースプレッドのPC/モバイル `sizes` パターン。
- `detail.css` キャッシュバスティング版数84→85。

### 未確認の類似パターン
- 確認済み・0件: JA/EN全22会場の静的生成、会場詳細のJSON-LD/Facts/FAQ/近隣会場、アーティスト・フェス・記事の共有CSSセレクタ消失。
- 未確認: 実ブラウザでの1280px/390pxの実測幅、h1の実描画、将来GALLERY入力時の画像選択、Publish pipeline、本番CMS操作。

### 次の担当への注意・判断待ち
- 公開前に localhost が利用できる環境で `node scripts/check_venue_details_browser.mjs` を再実行し、1280pxで会場ページの横幅・写真・Head・表・カードが意図どおり広がることを確認すること。CMS／Publish経路は未実行のため、公開前に通常手順で確認すること。

### 2026-10-24 redesign/magazine フェーズ4-4 会場詳細ページ（Claude 検証・コミット。本番未反映）

### 実施
- `venuePage` をモックの作りへ: 写真（`gallery` が2枚以上なら 12列の3枚スプレッド、今は全会場 21:9 の1枚。GALLERY の入力欄はフェーズ6）、パンくず（Venues / 都市 / 名前）、Head（タイプのピル・エリア · 都市・名前（長い名前は字を小さく）・読みがな（JA のみ）・説明文の JA / EN 切替・Website / Instagram / Google Maps のボタン）、Facts（Type / Area / Address / Access / Genre / Hours（値が無ければ今のフォールバック文）/ Charge / Features、GOOD TO KNOW を維持）。
- **Capacity は画面に出さない**（2026-10-23 ユーザー決定「不確定なため」）。JSON-LD の `maximumAttendeeCapacity` は今回触らず維持。
- Upcoming / Past（この会場で開かれたフェスを行で、チップで切替、出演者3組まで）、Nearby · 都市 4件（カード）、Stories、FAQ（見出し `FAQ`、FAQPage と数一致）、更新日、ALL VENUES。
- 旧 `.detail-page` の `max-width: 860px` が効いて PC で左6割に収まっていた → `venue-detail-v2` は幅いっぱい。`check_venue_details.mjs` / `check_venue_details_browser.mjs` を新しい作りに合わせる（大文字表示の見出しは大文字小文字を区別せず比較）。

### コミット
- このエントリを含むコミット。

### 検証
- `bash scripts/preflight.sh` 全65件成功。
- 実ブラウザ相当（CDP、PC 1280 dpr2 / スマホ 390 dpr3、JA/EN、womb・oath・vent・circus-osaka・club-metro・compufunk）: 322/322。全22会場の名前が PC・スマホで枠に収まり横にはみ出さない。EN の画面に見える日本語 0（読みがなは EN で非表示）。detail.css の置き換えで会場以外のセレクタの消失 0。

### 変更したパターン
- 旧デザインの外枠の幅（`.detail-page` の max-width）が新しいページに効く → v2 のページで `max-width: none`。

### 未確認の類似パターン
- GALLERY の3枚スプレッドは、データが入るまで実画面で確認できない（フェーズ6で CMS に入力欄を足したあとに確認）。iPhone 実機は未確認。

### 次の担当への注意・判断待ち
- 本番未反映。フェーズ4（詳細4種）が揃った。公開の判断はユーザー。公開時は cms.js / cms.html の版数変更があるため Publish pipeline ＋ CMS の確認が必要。

### 2026-10-24 redesign/magazine フェーズ5-1 ABOUT（未コミット・未公開）

### 実施
- `LP/about.html` を About モック準拠へ差し替え。Techno Japan の168px相当ヒーロー、TOPと同じマーキー、About / Statement / What we cover / Instagram / Contact、共通 Buttondown ニュースレター、既存の共通ヘッダー・メニュー・フッターを実装。
- 件数はコードに固定せず、`data-hub.js` の公開配列を読み込んだ後に Festivals 91 / Artists 134 / Venues 22 / Stories 21 を表示。JS 無効時は件数行を隠す。
- Instagram はAPI／画像ウィジェットを使わず、アカウント名・説明・`Follow on Instagram ↗` のボタンだけに変更。問い合わせフォームの FormSubmit action / method / name / hidden項目 / required と `?sent=1` の受付表示を維持。
- `scripts/build-detail-pages.mjs` に ABOUT の新しい日本語文言（Instagram説明、Read more、送信受付）の英語対訳を追加し、EN を生成。`LP/cms.html` は既存 `cms.js` の版数不一致解消のため `?v=175` → `?v=176` のみ更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更と未追跡の `scripts/fixtures/apply-google-form.json` は保持。

### 検証
- 成功: `node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）、`python3 scripts/check_hub_head.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_asset_versions.py`。
- 成功: JA/EN行数一致（810 / 810）、EN画面に見える日本語0件、旧 `discover-*` / Behold / 旧ヒーロー / 旧ニュースレターのABOUT内残存0件。`data-hub.js` の実測件数は Stories 21 / Festivals 91 / Artists 134 / Venues 22。
- 未確認: `python3 scripts/check_hub_pages.py` はローカルHTTPサーバーのbindが環境のEPERMで拒否され起動できず、実ブラウザでのJA/EN・PC/モバイル操作確認、`bash scripts/preflight.sh`、Publish pipelineは未実行。

### 変更したパターン
- 旧 `hero` / `discover-card` / Behold Instagram / FormSubmitニュースレターのページ固有構造を削除し、`wrap` / `disp` / `mono` / `red` / `rule` / `btn2` / `top2-marquee` / `tjMagNewsletter` を使うモック構造へ置換。
- `data-hub.js` のトップレベル `const` をブラウザのグローバル lexical binding として読み、公開件数を描画するパターン。EN は `enHubFromJa` の機械生成と固定対訳で同期。

### 未確認の類似パターン
- 確認済み・0件: head 必須要素、JSON-LD、JA/EN行数、EN可視日本語、旧ABOUTセレクタ、FormSubmit項目、Buttondownニュースレター、件数固定値。
- 未確認: 実ブラウザの390px/1280px表示、Statementの開閉、問い合わせ入力値保持と送信後表示、モバイルのリンク操作、外部Instagramリンク到達、Publish pipeline。

### 次の担当への注意・判断待ち
- 公開前にローカルHTTPサーバーが使える環境でABOUTのJA/EN・PC/モバイルを実ブラウザ確認し、件数・Statement開閉・フォーム入力保持・送信後表示・ニュースレター表示を確認すること。その後 `bash scripts/preflight.sh` を通し、Publish pipeline は別手順で実行すること。今回はコミット／pushしていない。

### 2026-10-24 redesign/magazine フェーズ5-2 APPLY / WRITER（未コミット・未公開）

### 実施
- `LP/submit.html` を Apply モック準拠へ差し替え、掲載について5項目、ジャンルチップ、3ステップ、サイト内申請フォーム、Upcoming on Techno Japan の4カードを追加。
- APPLY は `scripts/fixtures/apply-google-form.json` の16問を `entry.*`・型・必須・選択肢まで反映し、`LP/submit-form.js` から Google Form へ `no-cors` POST。迷惑送信対策、送信中ロック、受付／失敗表示、日付3分割送信を実装。
- `LP/writers.html` は既存 FormSubmit の action / 項目名 / hidden / honeypot / required / sent-notice を維持したままモック構造へ差し替え。EN は `enHubFromJa` で生成。
- `scripts/check_apply_form.mjs` を追加し、preflight に組み込んだ。submit の CSP にだけ `docs.google.com` を追加。

### コミット
- なし（ユーザー指示により commit / push 未実施）。ABOUT の既存未コミット変更は保持。

### 検証
- 成功: `node scripts/check_apply_form.mjs`（16問 × JA/EN、ネットワーク送信なし）、変更 JS の `node --check`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）、`python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`。
- 成功: JA/ENのApply/Writer生成、EN可視日本語（都道府県のfixture由来 bilingual 選択肢を除く）確認。Recently は掲載初出日の確実なデータが無いため、開催終了日が現在以降の公開データを開催開始日の近い順に4件表示し、見出しを `Upcoming on Techno Japan` とした。
- 未確認: `python3 scripts/check_hub_pages.py --budget 15000` と実ブラウザでのJA/EN・PC/モバイル操作、送信 fetch 差し替え確認は localhost bind のEPERMで未完了。Publish pipeline / 本番CMS操作も未実行。

### 変更したパターン
- Apply/Writer の旧単一カラム・CTA構造を `wrap` / `disp` / `mono` / `chip` / `btn2` 相当のモック構造へ置換。
- Google Form の short text / date / dropdown / checkbox / paragraph のHTML属性をfixtureから照合し、送信時だけ date を `_year` / `_month` / `_day` に分解。
- EN 固定文言は `EN_PAGE_TEXT` に対訳を追加し、JSの式やデータ由来値は置換していない。

### 未確認の類似パターン
- 確認済み・0件: Apply 16問の entry ID・型・required・選択肢、CSP、WRITER FormSubmit属性、JA/EN生成冪等性。
- 未確認: 実ブラウザの390px/1280px表示、必須エラー位置、送信成功／失敗／honeypot表示、Upcomingカードの画像・詳細リンク到達。

### 次の担当への注意・判断待ち
- localhostを使える実行環境で Apply/Writer のJA/ENをPC・モバイル実ブラウザ確認し、Applyは入力→必須エラー→fetch差し替え送信→受付／失敗保持、WriterはFormSubmitの既存送信経路を確認すること。その後 `bash scripts/preflight.sh` を省略なしで通すこと。今回はコミット／pushしていない。

### 2026-10-24 redesign/magazine ABOUT 修正（未コミット・未公開）

### 実施
- ABOUT のマーキーを TOP と同じ `top2-marquee` マークアップ・文言に統一し、`top-phase2.css` を ABOUT JA/EN でも読み込むよう修正。
- 04 の見出しを `Instagram` に変更。
- お問い合わせフォームから `_honey` / `_subject` / `_next` / `_template` と送信後 `?sent=1` 表示処理を削除し、name / email / subject / message の4項目だけに復元。

### コミット
- なし（ユーザー指示により commit / push 未実施）。ABOUT・APPLY・WRITER の既存未コミット変更は保持。

### 検証
- `node --check`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイルに変化なし）、`python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_hub_head.py` 成功。
- ABOUT JA/EN は790行で一致。ABOUT EN の可視テキスト中の日本語は0件。

### 変更したパターン
- TOP と共通のマーキー CSS を ABOUT に追加し、`prefers-reduced-motion` と横 overflow の既存ルールを共有。
- FormSubmit のお問い合わせフォームを元の4項目へ戻し、送信後表示の専用状態を除去。

### 未確認の類似パターン
- 確認済み・0件: ABOUT JA/EN のマーキー構造、見出し、フォーム追加 hidden 項目、`?sent=1` 処理。
- 未確認: 実ブラウザの390px/1280px表示・操作。`python3 scripts/check_hub_pages.py` は localhost bind の EPERM で起動できなかった。

### 次の担当への注意・判断待ち
- localhost を使える環境で ABOUT JA/EN をPC・モバイル実ブラウザ確認し、マーキーの流れ／停止、横スクロールなし、Instagram見出し、フォーム入力保持を確認すること。今回はコミット／pushしていない。

### 2026-10-24 redesign/magazine APPLY / WRITER / ABOUT 小修正（未コミット・未公開）

### 実施
- APPLY の `[hidden]` をページ内で確実に `display: none !important` とし、送信後にフォームが残る問題と受付・エラー表示の hidden 表示を修正。
- APPLY の制作メモを JA/EN から削除。都道府県の先頭を `value=""`・`selected` の `選択してください` / `Select` に変更し、fixture の48選択肢は維持。
- `check_apply_form.mjs` は空の先頭 option を明示検査したうえで空 option を除外し、fixture の48件と厳密比較するよう変更。
- ABOUT / APPLY / WRITER の JA 見出しに `word-break: keep-all` を適用し、WRITER の日本語 h2 に BudouX の `<wbr>` を追加。`submit-form.js` の参照を `?v=2` に更新。

### コミット
- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更は保持。

### 検証
- 成功: `node --check`、`node scripts/check_apply_form.mjs`、`node scripts/build-detail-pages.mjs`（最後まで完了）、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_hub_head.py`、JA/EN行数比較（ABOUT 795、APPLY 323、WRITER 255で一致）。
- 成功: EN ABOUT/APPLY/WRITER の可視テキスト抽出で日本語0件。実ブラウザ操作、Publish pipeline、本番CMS操作は未確認。

### 変更したパターン
- CSS Grid のフォームに対する `[hidden]` の強制非表示、placeholder option の先頭固定、fixture比較からの空 option 除外。
- `phrase-breaks.mjs` の BudouX による JA 見出しの文節境界 `<wbr>` と `:lang(ja)` 限定の `word-break: keep-all`。
- EN は `enHubFromJa` と `EN_PAGE_TEXT` で生成し、JA/ENの行数を一致させるパターン。

### 未確認の類似パターン
- 確認済み・0件: APPLY の16問、JA/ENの先頭placeholder、fixture48選択肢、受付／エラー／各入力エラーの hidden 属性、WRITERのJA見出し4箇所。
- 未確認: 実ブラウザの390px/1280px操作、送信成功／失敗時の表示、Publish pipeline、本番CMS操作。

### 次の担当への注意・判断待ち
- 公開前に実ブラウザで APPLY の初期都道府県が空、空のまま送信が止まる、入力保持、送信後フォーム非表示・Received表示をJA/EN・PC/モバイルで確認すること。WRITER/ABOUTの見出し折返しも確認し、公開時は通常のpreflight／Publish手順を実行すること。

### 2026-10-24 redesign/magazine ABOUT 本文消失修正（未コミット・未公開）

### 実施

- `LP/about.html` と生成後の `LP/en/about.html` から TOP 専用 `top-phase2.css` の参照を削除。`#main-content > :not(#top-phase2)` による本文 section 全消失を解消した。
- TOP と ABOUT の `top2-marquee` を `LP/common.css` の共通部品へ移し、帯・アニメーション・`prefers-reduced-motion` を同じ CSS で提供。共通 CSS にはページ専用の「他を隠す」指定を置かないコメントを追加した。
- `common.css` を v51、TOP 専用 CSS を v9 に更新し、手書きの `LP/map.html` も common.css v51 に揃えた。
- `scripts/check_hub_pages.py` に ABOUT / APPLY / WRITER の JA/EN 6ページを実ブラウザで iframe 描画し、`#main-content` 直下 section の表示・高さ・h1 の可視性を確認する検査を追加した。TOP は対象外。

### コミット

- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更は保持。

### 検証

- 成功: `node scripts/build-detail-pages.mjs`（最後まで完了）、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）。EN は `enHubFromJa` で再生成された。
- 成功: `python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`python3 scripts/check_hub_head.py`、JA/EN行数比較（index / festivals / artists / venues / news / about / submit / writers の全8ページ一致）。
- 成功: `check_hub_pages.py` の Python 構文確認、`git diff --check`、共通 CSS の版数・ABOUT の TOP CSS 参照なしの静的確認。
- 未確認: `python3 scripts/check_hub_pages.py --budget 15000` は実行環境の localhost bind `EPERM` で起動できず、追加した実ブラウザ検査の pass は未取得。PC/モバイルの実ブラウザ操作、Publish pipeline、本番 CMS 操作も未実施。

### 変更したパターン

- `.top2-marquee` / `.top2-marquee-track` と流れるアニメーションをページ共通 CSS へ移し、TOP 専用の表示制御 CSS と分離。
- ABOUT / APPLY / WRITER の直下 section をブラウザの計算済み `display`・`visibility`・高さで検査し、h1 の実レイアウト矩形も確認するパターン。
- CSS 変更に伴う `common.css` v50→51、`top-phase2.css` v8→9 のキャッシュバスティング。

### 未確認の類似パターン

- 確認済み・0件: ABOUT JA/EN の `top-phase2.css` 参照、common.css v50 残存、TOP/ABOUT の共通マーキー宣言の重複、JA/EN 8ページの行数不一致。
- 未確認: 実ブラウザでの ABOUT/APPLY/WRITER の JA/EN・PC/モバイル表示と操作、TOP マーキーの見た目・動きの実機比較。

### 次の担当への注意・判断待ち

- localhost を使える実行環境で `python3 scripts/check_hub_pages.py --budget 15000` を再実行し、ABOUT/APPLY/WRITER の6ページが pass することを確認すること。ユーザー指定どおりブラウザ検査後に `bash scripts/preflight.sh` を通し、公開時は通常の Publish 手順を実行すること。今回はコミット／pushしていない。

### 2026-10-24 redesign/magazine フェーズ5 ABOUT / APPLY / WRITER（Claude 検証・コミット。本番未反映）

### 実施
- ABOUT: モックの作り（ヒーロー＋DB の件数（data-hub.js から JS で数える）・マーキー（TOP と共通の部品を common.css へ移した）・01 About・02 Statement・03 What we cover（4枚・件数）・04 Instagram・05 Contact）。本文は今の about.html と同じ。お問い合わせフォーム（FormSubmit press@）は元の項目のまま。ニュースレターは古い FormSubmit から共通の Buttondown（tjMagNewsletter）へ。
- ABOUT の Instagram: 今まで入っていた埋め込み（Behold）は、サイトの CSP（script-src）で読み込みが止められ、**本番でも何も表示されていなかった**。今回は出さず、アカウントへのリンクと説明だけ（見出しも投稿が無くても正しい言葉に）。最新投稿を出すには about だけ CSP に Behold を許す必要があり、ユーザー判断待ち。
- APPLY: サイト内の申請フォームから **Google フォームへ直接送る**（`fetch` の `no-cors` POST、`formResponse`）。質問は Google フォームの公開ページから読み取った16問（`scripts/fixtures/apply-google-form.json`）と完全に一致（日付は `_year/_month/_day` に分ける、都道府県48・ジャンル8・許諾1 の文字列も一致）。必須の確認、送信中の二重送信防止、迷惑送信よけ、送信後は受付の表示（フォームは隠す）、失敗時は入力を残して Google フォームへのリンク、常に「うまく送れない場合は Google フォームから」。CSP の connect-src に docs.google.com を submit.html / en/submit.html だけ足した。Recently listed は初出の日付データが無いため `Upcoming on Techno Japan`（開催の近い順4件）。
- WRITER: モックの作り。応募フォームは今の FormSubmit（press@）のまま（REDESIGN_SPEC §4 の「WRITER も Google フォーム」は事実と違っていた）。
- 日本語の見出しは文節の切れ目で折る（BudouX の `<wbr>` ＋ keep-all）。新しい検査 `scripts/check_apply_form.mjs`（ネットワークに出ずに16問の対応を確認）を preflight に追加。check_hub_pages に ABOUT / APPLY / WRITER の「本文が描画されている」確認を追加。

### コミット
- このエントリを含むコミット。

### 検証
- preflight: 66件中65件成功、落ちた1件（CMS の記事プレビューの common.css の版数）は直して単独で成功。
- 実ブラウザ相当（CDP、PC 1280 / スマホ 390、JA/EN）: ABOUT 54/54、APPLY 68/68（**Google への送信はしない**: fetch を差し替え、さらに docs.google.com への通信をブラウザ側で遮断して、送る中身を取り出して確認）、WRITER 30/30。TOP（マーキーの移動）のカルーセル・1枚目・日付・マーキーに崩れなし。

### 変更したパターン
- 部品を使い回すために**他のページ専用の CSS ファイルを読み込まない**（top-phase2.css の `#main-content > :not(#top-phase2){display:none}` で ABOUT の本文が全部消えた）→ 共通の部品は common.css に置く。描画検査に「本文が見えている」を追加。
- 見本のデザイン上のメモ（「回答は今までのスプレッドシートに」）を画面に出さない。
- `display` を指定した要素は `[hidden]` が効かない → `[hidden]{display:none}` を明示。

### 未確認の類似パターン
- **Google フォームへの実際の送信は未確認**（本物の回答が入るためテストで送らなかった）。本番に出す前に、ユーザーにテスト環境から1回だけ送ってもらい、Google フォームの回答に届くことを確認する（その回答は削除してもらう）。
- Google フォームに連絡先（メール）の質問が無い（今の状態のまま）。必要ならユーザーが Google フォームに足し、fixture とサイトのフォームを更新する。

### 次の担当への注意・判断待ち
- ABOUT の Instagram の最新投稿を出すか（CSP に Behold を許すか）はユーザー判断。
- 公開時は cms.js / cms.html の版数変更があるため Publish pipeline ＋ CMS の確認が必要。

### 2026-10-24 redesign/magazine フェーズ6 SOUND / GALLERY（未コミット・未公開）

### 実施

- `LP/cms.html` / `LP/cms.js` に FESTIVALS の SOUND、VENUES の GALLERY（追加写真2枠、URL取込・圧縮アップロード・プレビュー・削除）を追加。
- 新規作成では両項目を無効化し、既存行の編集でシート列の存在を確認した場合だけ `update_row` payload に含めるようにした。列が無い場合は見出し末尾への追加案内を表示。
- `buildFestivalsJs` は SOUND を、`buildVenuesJs` は webp化した最大2枚の GALLERY 配列を出力。data-hub からは両方を除外。
- Bulk Assist・一括画像・Find & Replace は保存直前に `get_sheet` で最新行を読み、変更項目だけを重ねて保存するようにした。
- `scripts/check_cms_sound_gallery.mjs` を追加し、preflight の CMS 検査へ登録。`docs/DATA_SCHEMA.md` に SOUND/GALLERY の型・列追加・新規作成制約を追記。

### コミット

- なし（ユーザー指示どおり commit / push 未実施）。

### 検証

- 成功: `node --check LP/cms.js`、`node scripts/check_cms_sound_gallery.mjs`、既存CMS/Publish/data-hub/画像/回帰検査、`python3 scripts/check_asset_versions.py --no-diff`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル変化なし）。
- `bash scripts/preflight.sh --fast` は、外部画像150件の取得待ちにより既定240秒で「詳細ページを生成できる」「ビルドの冪等性」がタイムアウト。それ以外は成功（52成功・5省略）。単独実行では両検査とも成功。
- 未確認: 実ブラウザでのCMS入力→プレビュー→保存→再表示、Publish pipeline、認証済みCMSでの Publish Now。本番データ／本物のGASへの書き込み・送信はしていない。

### 変更したパターン

- `sound` / `gallery` のキー有無でシート列の存在を判定し、既存行の更新だけに限定する保存payload。
- GALLERY は `<id>-2.webp` / `<id>-3.webp` を使い、メイン画像を上書きしない2枠アップロード。
- data.js の詳細専用項目と data-hub の除外項目を `cms.js`・`build-detail-pages.mjs`・`check_data_hub.mjs` で一致させるパターン。

### 未確認の類似パターン

- 確認済み・0件: SOUND/GALLERY の build 出力、空欄時の無出力、webp配列の最大2件、列落ち防止の最新行マージ、既存CMS検査との互換性。
- 未確認: 実ブラウザのPC/モバイル表示、GAS側 `add_festival` / `addVenue` の新列対応（新規作成では送らないため影響回避）。

### 次の担当への注意・判断待ち

- スプレッドシートの `FESTIVALS` 見出しの最後に `SOUND`、`VENUES` 見出しの最後に `GALLERY` を追加してから、既存行をCMSで編集・保存する。新規行では入力できない。
- CMS変更のため、公開前に `?cb=<乱数>` 付きCMSを強制再読み込みし、実データで編集→プレビュー→閉じる→再表示→保存を確認する。Publish Now と生成コミットの確認は未実施。

### 2026-10-24 TOP / NEWS モバイル表示修正（未コミット・未公開）

### 実施

- 共通ニュースレターの左列を `display:flex; flex-direction:column; gap:14px` に変更し、TOP と NEWS のラベル・見出し・説明文へ適用した。
- TOPカルーセルの送りを85%で完了して4枚目を保持し、Upcoming の横列を縦スクロール不可にした。TOP STORIES、NEWS一覧、詳細ページの関連フェス／More festivals のスマホ表示も指定値へ調整した。
- `common.css` v52、`magazine.js` v6、TOP CSS/JS v10/v9、NEWS CSS v6、詳細CSS v86へ更新し、CMSプレビューと生成ページの参照を同期した。

### コミット

- なし（ユーザー指示により commit / push 未実施）。フェーズ6の未コミット変更は保持。

### 検証

- 成功: `node scripts/build-detail-pages.mjs`（最後まで完了）、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）、`python3 scripts/check_asset_versions.py`、`node scripts/check_cms_article_generated_preview.mjs`、`python3 scripts/check_regressions.py`、`git diff --check`。
- 未確認: `python3 scripts/check_hub_pages.py` は実行環境の localhost bind `PermissionError` で起動できず。Publish pipeline、実機／認証済みCMSの操作確認も未実施。

### 変更したパターン

- `.mag-newsletter-copy` の flex gap によるニュースレター縦間隔、`tjMagPinnedCarousel` の `endAt` オプション、横カード列の `overflow-y:hidden` と `overscroll-behavior-x:contain`。
- TOP STORIES のスマホ値（見出し18px、補足12px/1.4、メタ9px/.1em）と NEWS一覧補足（12px/1.45）。

### 未確認の類似パターン

- 確認済み・0件: TOP／NEWSニュースレター、TOP Upcoming、TOP STORIES、記事詳細の関連フェス、フェス詳細 More festivals の対象CSS・版数。
- 未確認: 実ブラウザでのPC/390px操作、ARTISTS FEATUREDを含む他ページの実機描画、localhost bind が可能な環境での `check_hub_pages.py`。

### 次の担当への注意・判断待ち

- 公開前に localhost を使える環境で `python3 scripts/check_hub_pages.py` を再実行し、TOP/NEWSのPC・モバイル表示を実ブラウザで確認する。CMS変更の未確認フロー（フェーズ6）も同時に残っているため、公開前に既存のCMS確認手順を完了する。

### 2026-10-24 GALLERY送信安全化 / TOP・ARTISTSカルーセル端点・スマホ表示（未コミット・未公開）

### 実施

- GALLERYの画面用 `venue-gallery-2/3` を、GAS送信時だけ `type:'venue'`・`id:'<id>-2|3'`・同名filenameへ変換する共通処理に変更。ファイル、ブラウザ圧縮URL、CORS時の `upload_from_url` の3経路を対象にした。
- 返却パスに枠IDが含まれない場合は保存せずエラー表示。`scripts/check_cms_sound_gallery.mjs` に3経路の共通変換とメイン写真パス拒否の検査を追加。
- 共通 `tjMagPinnedCarousel` に先頭10%・末尾15%の停止区間を追加し、TOPとARTISTS FEATUREDへ適用。ARTISTSの900px以下ではコピーの間隔・NEXT行を詰め、Profileを隠して写真の表示幅を拡大。
- 変更したCSS/JSの参照版数を更新。コミット・push・本物のGAS送信はしていない。

### コミット

- なし（ユーザー指示どおり commit / push 未実施）。既存の未コミット変更は保持。

### 検証

- 成功: `node --check`（cms / magazine / TOP / ARTISTS）、`node scripts/check_cms_sound_gallery.mjs`、`node scripts/build-detail-pages.mjs`、`node scripts/check_build_idempotent.mjs`（601ファイル差分なし）、`python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`git diff --check`。
- `bash scripts/preflight.sh`: CMSを含む静的検査は成功。詳細生成・冪等性は外部画像取得の240秒タイムアウト、ブラウザ系は実行環境のlocalhost bind `EPERM`で失敗。
- 未確認: 実ブラウザでのTOP/ARTISTSのPC・390px操作、認証済みCMSでのGALLERY実送信確認、Publish pipeline。本物のGASへの送信はしていない。

### 変更したパターン

- GALLERYのUI typeとGAS契約type/idを分離し、返却パスを保存前に検証するアップロード経路。
- 縦スクロールの端点停止区間を共通カルーセルへ追加し、TOP/ARTISTS双方で同じ割合を指定するパターン。
- `--artists-featured-copy-h` を使ったスマホ画像高さ計算から余白を減らし、viewport幅も上限にするパターン。

### 未確認の類似パターン

- 確認済み・0件: GALLERYの3アップロード経路、メイン写真パス拒否、TOP/ARTISTSのカルーセル呼び出し、CSS/JS版数参照。
- 未確認: 実ブラウザでの他ページのカルーセル、実GASが返す実パスの命名差、Publish後のキャッシュ反映。

### 次の担当への注意・判断待ち

- localhost bind可能な環境でpreflightを再実行すること。公開前に `?cb=<乱数>` 付きCMSを強制再読み込みし、GALLERYのファイル/URL/CORSフォールバックの送信bodyと返却パスを実GASへ書き込まず確認すること。CMS変更のため、確認後にPublish pipelineを実行すること。

### 2026-10-24 SOUND / GALLERY 一括保存安全策（未コミット・未公開）

### 実施

- CORS時の `upload_from_url` bodyを4キー（`action` / `imageUrl` / GAS用`type` / GAS用`id`）に固定し、原寸保存経路へ `filename` を送らないよう修正。
- `bulkSaveRow` に大小文字違いの同名キー同期と、`id` → `name` → `title` の識別値比較を追加。行ずれ時はPOSTせず再読み込みエラーにする検査を追加。
- `LP/cms.html` の `cms.js` を `?v=181` に更新。本物のGASへの送信、commit、pushは未実施。

### コミット

- なし（ユーザー指示により commit / push 未実施）。既存の未コミット変更は保持。

### 検証

- 成功: `node --check LP/cms.js`、`node scripts/check_cms_sound_gallery.mjs`、CMS既存検査群、`python3 scripts/check_asset_versions.py`、`python3 scripts/check_regressions.py`、`git diff --check`。
- `bash scripts/preflight.sh` は詳細ページ生成の外部画像取得が240秒でタイムアウトしたため中断。CMS検査群は個別実行で全件成功。
- 未確認: 実ブラウザでのGAS送信body確認、Publish pipeline。

### 変更したパターン

- URL取込の原寸フォールバックと、webp化済みのファイル／圧縮URLアップロードを分離するbody生成。
- bulk保存時に大小文字を無視して同名キーへ同じ値を適用し、行番号だけでなく識別値を確認する保存前ガード。

### 未確認の類似パターン

- 確認済み・0件: 会場メイン写真、フェスフライヤー、GALLERY 2/3枠のbody、大小文字違いキー、行ずれ時のPOST抑止。
- 未確認: 実GASの返却パス・実データでの保存確認、実ブラウザのPC/モバイル操作。

### 次の担当への注意・判断待ち

- `?cb=<乱数>` 付きCMSを強制再読み込みし、GASへ書き込まずに実際の送信bodyと返却パスを確認すること。確認後に必要ならPublish pipelineを実行すること。

### 2026-10-24 redesign/magazine フェーズ6 ＋ TOP/NEWS/ARTISTS 修正の検証とコミット（Claude、未公開）

### 実施

- 上の3件（フェーズ6 SOUND/GALLERY、TOP/NEWS のモバイル修正、GALLERY 送信安全化＋カルーセル端点）を Claude が実ブラウザ相当（headless Chrome / CDP）で確認し、コミットした。
- レビューで2点を見つけ、Codex に直させた（`tmp/spec-p6-safety.md`）。
  - 「URL から取り込む」の CORS 失敗時（GAS `upload_from_url`）で、**メイン写真・フライヤーにも `filename:'<id>.webp'` が付くようになっていた**。この経路は原寸の jpg/heic を保存するため、名前だけ webp になり Drive 同期の変換をすり抜けるおそれがあった → `uploadFromUrlBody()` で `{action,imageUrl,type,id}` の4つだけに戻した（GALLERY は `type:'venue'`・`id:'<id>-2|3'`）。
  - `bulkSaveRow`: `get_sheet` は1列を `imageposition` と `imagePosition` の2つの名前で返すため、片方だけ更新すると古い値が残る → 大文字小文字を無視して同名キー全部に入れる。行番号だけで行を決めていた → `id`（無ければ `name` / `title`）が違えば送らずにエラー。
  - その結果、Find & Replace が置換後の行で照合して「行ずれ」と誤判定する形になったため、照合は置換前の元の行で行うよう直させた（`tmp/spec-p6-fr-identity.md`、`cms.js?v=182`）。
- ARTISTS FEATURED のスマホは写真を大きくするため拠点→NEXT の間を 18px → 10px に詰めた（ユーザー依頼「写真が小さい」への対応、PC は 18px のまま）。2回目の指摘で入れた検査（`tmp/followverify.mjs` の「≥16px」）はスマホだけ「≥10px」に更新した。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- CMS（`tmp/cmsverify.mjs`、cms.js の GAS 通信を差し替え＋ script.google.com をブラウザで遮断。**本物の GAS・本番データへの送信 0 件**）: 20/20（cms.js v182）
  - 列あり／列なし（入力不可・案内・payload に入らない）、新規作成で不可、GALLERY の読み込み・1枚消して保存（メイン写真は不変）。
  - アップロード3経路: ファイル（`type:'venue'`,`id:'womb-3'`,`filename:'womb-3.webp'`）／URL・ブラウザ圧縮（`womb-2.webp`）／URL・CORS 失敗の予備（body は `action,id,imageUrl,type` のみ、`womb-3`）。メイン写真の予備経路の body が変更前と同じ（`type:'venue'`,`id:'womb'`、filename なし）。GAS がメイン写真のパスを返したら GALLERY に入れない。
  - 一括保存: 最新の行を読み直して SOUND を保持・変更を重ねる／2つの名前の列の両方に新しい値／行がずれたら送らない。
- TOP カルーセル（`tmp/topdwell.mjs`、各位置で 2.5 秒待って計測）: 390×844・1280×900 とも、固定の始まり +0/+80/+140px は1枚目のずれ 0px、外れる 260/120/0px 前は4枚目のずれ 0〜1px（04 / 04）。
- ARTISTS FEATURED（`tmp/artfeat2.mjs`）: 390×844 で写真 358×447（変更前 293×367）、390×667 で 231×289（同 152×190）。始まりで1人目、外れる直前で3人目のずれ 0px（PC も同じ）。
- ページ全体の回帰（CDP）: TOP（カルーセル・最初の1枚・時差に左右されない）合格、NEWS 86/86、FESTIVALS 141/141、ARTISTS 114/114、VENUES 112/114、記事 284/290、追加確認一式 297/297（スマホの拠点→NEXT の間の基準を更新後）、ABOUT 54/54、APPLY 68/68、WRITER 30/30、フェス詳細 356/356、アーティスト詳細 362/362、会場詳細 322/322、CMS 20/20。
  - VENUES の2件・記事の6件はすべて「画像の細かさ」で、**直前のコミット 3d285cde1 でも同じ項目・同じ数値**（同じ検査を別のサーバーで実行して比較）。今回の変更による悪化ではない（下の「未確認の類似パターン」参照）。
- `bash scripts/preflight.sh`（省略なし）: 全67件成功（Publish の経路の変更ありの注意表示 → 下の「未確認」のとおり実機未確認）
- 未確認: Publish pipeline の実行、認証済み CMS での保存・Publish Now（cms.js を変えたため公開前に必須）、実 GAS の `upload_image` / `upload_from_url` が返す実際のパス名、iPhone 実機でのカルーセルの止まり方。

### 変更したパターン

- GAS へ送る body を1つの関数で作り、メイン写真の契約（type / id / filename の有無）を変えずに GALLERY だけ別名にするパターン（`imageUploadTarget` / `uploadFromUrlBody` / `assertImageUploadPath`）。
- 一括保存は「保存直前に `get_sheet` で読み直し → 同じ行か確かめる → 変更だけを大文字小文字を無視して重ねる」。
- カルーセルの端点で止まる区間（`tjMagPinnedCarousel` の `dwell` 0.1 / `endDwell` 0.15）を TOP と ARTISTS で共有。

### 未確認の類似パターン

- 確認済み・0件: 一括の道具で `bulkSaveRow` を通らずに `update_row` を丸ごと送る箇所（Find & Replace も `bulkSaveRow` 経由に変更済み）。
- 既知（今回以前から）: 会場一覧の PC（dpr 2）で FEATURED の bonobo が 960px／必要 991px、グリッドの md が 720px／必要 754〜759px。記事本文の写真（スマホ dpr 3・スクロール演出で 433px 表示）が 1200px／必要 1299〜1301px。いずれも 3〜8% の不足で、3d285cde1 でも同じ。フェーズ7（画像・Lighthouse）で扱うか判断する。
- 未確認: 開催回（EDITIONS）の `update_row` は今回触っていない（`get_sheet` の2つの名前の列の扱いは同じ形の可能性がある）。EDITIONS のフライヤーの `upload_from_url`（cms.js `uploadEditionFlyerFromUrl`）と一括画像の `upload_from_url` は filename を送らない従来の形のまま。

### 次の担当への注意・判断待ち

- スプレッドシートの列は**新しい CMS の公開後に**、FESTIVALS の見出しの最後に `SOUND`、VENUES の見出しの最後に `GALLERY` を足す（途中に挿入しない・他の見出しに触らない）。今の本番 CMS で行を保存すると、送られない列が空になるため。
- GAS の新規作成（`add_festival` / `addVenue`）が新しい列を受け取るかは不明なので、SOUND / GALLERY は既存行の編集でだけ入力できる。
- 公開時は `?cb=<乱数>` 付き CMS で強制再読み込み → 実データで編集→プレビュー→閉じる→再表示→保存、Publish pipeline の実行、`cms: publish data.js` コミットの確認まで行う（AGENTS.md）。

### 2026-10-26 redesign/magazine NEWS のタイトル → 補足の文の間をモックにそろえる（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指摘「NEWS の記事のタイトルとサブタイトルの間をモックと同じ間隔に」。モック（`docs/design-mock/News.dc.html`）を同じ書体・同じ指定で再現したページ（`tmp/mockrepro/newslist.html`）と並べて測ったところ、4種類のカードすべてでずれていた。
  - 下の一覧の行: モック 8px / 今 16px（`.news-list-copy` の gap 8px に `.news-title-sub` の `margin-top:8px` が二重にかかっていた）
  - リード: モック 18px / 今 22px（スマホ）・26px（PC）
  - 2本・3本の枠: モック 12px / 今 8px
- Codex に `LP/news-phase3.css` を直させた（`tmp/spec-news-title-sub-gap.md`）。`.news-title-sub` の margin を 0、2本・3本の枠は `margin-top:12px`、スマホのリードは `margin-top:4px`（`.news-copy` の gap 14px ＋ 4 = 18）。`news-phase3.css?v=7`。
- 日付が 2026-10-26 に変わったため、ビルドで終了したフェス（10/25 まで）が「今後の開催」から外れる等の再生成差分も同じコミットに含む。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/newsgap3.mjs`（390 / 700 / 1440 幅 × JA / EN の24通り）: タイトル → 補足の文がモックの値（リード 18・枠 12・一覧 8）と一致。画像 → カテゴリ、カテゴリ → タイトル、補足 → 紹介文、文字の大きさは**変更前と同じ**。
- 見た目の間（文字の上下端どうし）もモックとの差 1.3px 以内（行の高さ .98 / 1.4 とモックの .95 / 1.45 の差、スマホの一覧の文字の大きさの差による）。
- NEWS ページの確認一式・preflight: NEWS（`tmp/newsverify.mjs`）86/86、`bash scripts/preflight.sh`（省略なし）全67件成功。

### 変更したパターン

- NEWS のカードの「タイトル → 補足の文」の間は、補足の文の margin ではなく、カードごとにモックの値（flex の gap、または block のカードでは margin-top）で決める。

### 未確認の類似パターン

- 確認済み・0件: NEWS 以外で `.news-title-sub` を使うページ（他のページの CSS には無い）。
- 未確認（ユーザー判断待ち）: スマホの一覧の文字の大きさはモックがタイトル 28px・補足 15px、今は 20px・12px（520px 以下）／23px・12px（900px 以下）。PC の3本の枠のタイトルはモック 28px・今 34px。前回「補足の文をモックと同じ大きさに」で 12px にしたのは TOP の STORIES に合わせた値で、モックの値ではなかった。

### 次の担当への注意・判断待ち

- 上の文字の大きさの違いをモックに合わせるかはユーザーに確認中。合わせる場合、スマホの一覧はタイトルが大きくなり、長い日本語のタイトルは行が増える。

### 2026-10-26 redesign/magazine NEWS のユーザー確認（判断の記録のみ・コード変更なし）

### 実施

- ユーザーがテスト環境で NEWS を確認し「NEWS も問題ない」。上のエントリで判断待ちにしていた文字の大きさ（スマホの一覧 タイトル 20px・補足 12px／モック 28px・15px、PC の3本の枠のタイトル 34px／モック 28px）は、ユーザーが「**今のままでよい**」と決定した。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- なし（判断の記録のみ。コード・生成物の変更なし）。

### 変更したパターン

- なし。

### 未確認の類似パターン

- 確認済み・0件（判断の記録のみ）。

### 次の担当への注意・判断待ち

- NEWS の文字の大きさをモックに合わせる提案はしない（ユーザー決定済み）。ユーザー確認済みのページは FESTIVALS 一覧・TOP・NEWS。残りは ARTISTS・VENUES・詳細4種・ABOUT / APPLY / WRITER。

### 2026-10-26 redesign/magazine ARTISTS の写真の拡大の入れ替え ＋ マウスカーソルを本番と同じに（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指摘1「ARTISTS の FEATURED 3名でマウスを乗せると写真が拡大される演出をやめたい。逆に一覧の写真に、今の本番のような拡大がほしい」。
  - FEATURED: `artists-phase3.css` の `.artists-featured-link:hover .artists-featured-image img { transform: scale(1.04) !important; }` を削除（カルーセルが毎フレーム入れる `translate3d(..) scale(1.12)` を上書きしていた）。名前の色が変わる動きは残す。
  - 一覧: 本番 `.artist-card-img` と同じ `scale(1.08)`・`transition: transform .6s cubic-bezier(.16,1,.3,1)`。写真は枠（overflow:hidden）の中で大きくなる（新しいグリッドは写真が大きく、枠ごと大きくすると隣や名前に重なるため）。`@media (hover: hover) and (pointer: fine)` の中だけ。動きを減らす設定では拡大しない（最初の実装は指定の強さで負けて一瞬で拡大していた → 同じ強さの規則を足して修正）。
- ユーザー指摘2「全体で、今の本番のマウスの演出（小さい点に丸が追いついてくる）をそのまま真似して」。本番と redesign を同じ方法で測った結果、仕組み（`common.js` / `common.css`）は同じで、違いは次の3点だった → すべて本番に合わせた。
  - 丸と点の大きさ: redesign は `box-sizing` が content-box で丸が 38px（リンクの上で 54px）。本番は border-box で 36px（52px）→ `.cursor-dot, .cursor-ring` に `box-sizing: border-box` を明示（`common.css?v=53`、cms.js の記事プレビューの版数と `cms.js?v=183` もそろえた）。
  - アーティストのカード: 本番 `.artist-card { cursor: none; }`（カードの上は点と丸だけ）→ `.artist-grid-card, .artists-featured-link { cursor: none; }`、タッチ端末は pointer。
  - **地図ページ（map.html）でカーソルが何も見えなかった**: 4872c45d2 で `common.css` を読むようになり `body { cursor: none }` が効く一方、点と丸を作る `common.js` は読まないため。本番の地図ページは普通のカーソルなので、`map.html` に `body { cursor: auto; }` を足した。同じ状態のページは他に無い（LP/*.html・LP/en/*.html を検索）。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/artshover.mjs` 25/25: FEATURED は乗せても transform・大きさが変わらない（JA/EN、動きを減らす設定でも）。一覧は 0.6 秒で 1.08 倍（途中の値 1.05 前後を確認）→ 離すと 1 に戻る。枠・名前・ハートの位置は変わらない。動きを減らす設定では拡大しない。スマホ相当（タッチ）では拡大の規則が効かない。
- `tmp/cursorverify.mjs` 65/65: 21ページ（ハブ・詳細・ABOUT/APPLY/WRITER・お気に入り・404・EN）で点 6px・丸 36px・リンクの上で 52px・body の cursor none・z-index 99999・mix-blend-mode difference。map.html は本番と同じ普通のカーソル。アーティストのカードはマウスで cursor none、タッチで pointer。
- 本番との比較は `tmp/cursorprobe.mjs` / `cursorhover.mjs` / `cursorshot.mjs`（本番 https://techno-japan.media を読み取りのみ）。
- ARTISTS（`tmp/artverify.mjs`）・追加確認一式（`tmp/followverify.mjs`）・preflight: ARTISTS 111/114（失敗3件はスマホの FEATURED で出演予定の行が2行に折り返したとき下のカウンターの列に 2px 重なるもので、**今回の変更とは無関係・以前から**。FEATURED は同じ出演日の人から毎回入れ替わって選ばれ、フェス名が長い人（DENKI BODHISATTVA 等）が選ばれると起きる。直前のコミット db0e2199a でも同じ人が選ばれたときに copy の下端 811px > カウンター上端 809px を測定。次の修正で直す）、追加確認一式 297/297、`bash scripts/preflight.sh` 65/67（失敗2件「ハブページが JS 込みで描ける」の時間切れ・「フェス詳細の行動計測」の一時フォルダ削除失敗は、同時に別のブラウザ確認を流していたための混雑。単独で再実行して両方成功）。

### 変更したパターン

- マウスを乗せたときの写真の拡大は「枠の中で img を拡大」「`hover: hover` かつ `pointer: fine` の中だけ」「動きを減らす設定では、:hover の規則と同じ強さで打ち消す」。
- カーソルの部品は全体の box-sizing に頼らず、部品側に `box-sizing` を明示する。
- `common.css` を読むが `common.js` を読まないページは、`body { cursor: auto; }` で普通のカーソルを戻す。

### 未確認の類似パターン

- 確認済み・0件: `common.css` あり・`common.js` なしのページ（map.html 以外）。カーソルの大きさが本番と違うページ（21ページ）。
- 本番自体が統一されていない点（そのまま）: 本番でもニュース・フェス・TOP のカード、ジャンルのボタン等では普通の指カーソルも出る。ボタンの多くでは丸が大きくならない。redesign も同じ（ARTISTS のカードだけ本番どおり指カーソルなし）。どこでも点と丸だけにするかはユーザーに確認中。
- 検索画面を開くと、点と丸は検索画面（z-index 100010、本番は 100001）の下に隠れる。本番も同じ。

### 次の担当への注意・判断待ち

- スマホの ARTISTS FEATURED の重なり（上記）は次の修正で直す（カウンターの列の分の余白を、写真の大きさの計算に入れる）。
- cms.js（記事プレビューの common.css の版数）と cms.html の版数を変えたため、公開時は Publish pipeline ＋ CMS の確認が必要（フェーズ6 から継続）。

### 2026-10-26 redesign/magazine VENUES の地図を最初の黒い地図に ＋ ARTISTS スマホ FEATURED の重なり（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指示「VENUE は地図の色や形だけ再度調整したい。日本全体の形も違うし、一番最初に使っていた黒の地図が理想」。最初（2026-04）も今の本番も CARTO dark_all（今はキー付き・本番ドメイン限定）。
  - 原因1: 4872c45d2 で入れた `.tj-map .leaflet-tile-pane { filter: grayscale(1) brightness(.72) contrast(1.18) }` が CARTO にも掛かり、本番に出すと海が陸と同じ暗さになり日本の形と道路が消える（本番の CARTO を同じ範囲で表示して確認）→ **削除（CARTO は加工なし）**。
  - 原因2: テスト環境は CARTO が 403 → OSM 代替。OSM は日本の陸地の大半を森の緑で塗るため、白黒にすると海と陸の明るさの差が 1（CARTO は 37.6）で形が見えない → OSM 代替だけ、インライン SVG の色行列（`#tj-map-osm-dark`、B−R で水域だけ明るく）で CARTO の配色に置き換え。`venues.html` / `map.html` に SVG 定義、`common.css?v=54`。
- ARTISTS スマホ FEATURED: NEXT の行が2行に折り返すと（長いフェス名の人が選ばれたとき）下のカウンターの列に 2px 重なっていた → 下の余白を `--artists-featured-bottom-reserve: 48px` にし、写真の大きさの計算にも同じ値を使う。
- CMS の記事プレビューの common.css の版を 54 にそろえた（`cms.js?v=184`）。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/mapverify.mjs` 12/12（venues JA/EN・map.html）: OSM 代替は色行列、CARTO 側は filter none、SVG 定義は場所を取らない、CSP・JS エラーなし。テスト環境の代替の色を CARTO（本番の表示）と同じ範囲・同じ方法で測定: 海 (44,53,60)／(44,53,60)、陸 (14,14,13)／(14,14,14)。
- `tmp/featov2.mjs` 18/18: 390×844/700/667/600、JA/EN、NEXT を長いフェス名にして2行にしても、文字の列とカウンターの列の間が 13px 以上。写真は3名の中で一番高い文字の列に合わせるため、2行の人がいると 390×844 で 358×447 → 353×442、390×667 で 212×265。
- `tmp/venverify.mjs` 112/114（失敗2件は以前からの画像の細かさ。地図の検査は新しい作りに更新）、`tmp/artverify.mjs` 114/114、`tmp/followverify.mjs` 297/297、`tmp/cursorverify.mjs` 65/65、`node scripts/check_cms_article_generated_preview.mjs` 成功。
- preflight（省略なし）はこの後のフェス詳細・アーティスト詳細の修正と合わせて実施する。
- 未確認: 本番ドメインでの CARTO の表示（本番でしか読めない。本番の CLUB MAP で同じ範囲を表示した画像で確認）、iPhone 実機での SVG の色行列（Safari）。

### 変更したパターン

- 外部の地図タイルには加工を掛けず、読めないときの代替だけを本物の配色に寄せる（色行列はインライン SVG、外部・data: URL を使わない）。
- 位置を絶対指定した部品（カウンターの列）の分の余白は、CSS 変数1つにまとめ、写真の大きさの計算と共有する。

### 未確認の類似パターン

- 確認済み・0件: `.tj-map` を使うページ（venues JA/EN・map.html 以外は無い）。CMS の地図（`cms.css` の `.tj-map-osm`）は対象外のまま。
- 未確認: 他の詳細ページの地図（フェス詳細は Google Maps へのリンクのみで地図タイル無し）。

### 次の担当への注意・判断待ち

- 公開時、本番で VENUES の地図が CARTO の黒い地図（加工なし）で出ることを確認する。cms.js を変えているため Publish pipeline ＋ CMS の確認も必要。

### 2026-10-26 redesign/magazine フェス詳細・アーティスト詳細・会場詳細の修正（ユーザー確認後の指摘、Claude 検証・コミット。本番未反映）

### 実施

- フェス詳細（`tmp/spec-detail-festival-artist.md`、Codex）
  - ヒーローに「タイトル補足文章」: FEATURE STORY の記事タイトルを `splitArticleTitle` で分けた sub を `p.festival-hero-sub` で表示（JA は title、EN は title_en || title。記事・sub が無いフェスは出さない）。ユーザーの言う「タイトル補足文章」＝ TOP の STORIES 等と同じ記事タイトルの「｜」の後ろ、と解釈した（モックのヒーローには補足文が無い）。
  - FEATURE STORY のカードをタイトル（short、display 書体）と補足文（sub、本文の書体・大文字にしない）に分割（JA・EN）。
  - LINEUP と過去の出演者: 公開中の登録アーティストで画像がある人は、番号の四角の場所に写真（56px、スマホ 48px、`sizes` を表示幅にして xs 派生）。番号は写真の左下に小さな札で残す。未登録・組み合わせ・画像なしは番号の四角のまま。
  - 開催ヒストリー: 旧デザインの `.detail-section-label { margin: 40px 0 -24px }`（下がマイナス）で表が見出しに食い込んでいた → v2 で正の余白に。
  - スマホ（900px 以下）: SAVE ボタンを隠し、ヒーロー右上に `tjFav.attachHeart(host, 'festival', id)` のハート（保存先は PC の Save と同じ）。PC は今のまま。
  - 補足文（ヒーロー・FEATURE STORY）は `clauseBreaks()` ＋ `word-break: keep-all` で文節の切れ目でだけ改行（「3日間」の途中で折れていた）。
- アーティスト詳細・会場詳細の STORIES（`relatedStoryCardsHtml` の grid）: タイトルを short / sub に分け、導入文（excerpt）を出さない（モックの ArtistDetail / VenueDetail と同じ）。
- 会場詳細（`tmp/spec-venue-detail-2.md`、Codex）: パンくず（VENUES / 東京 / WOMB）をヒーロー画像の上へ（アーティスト詳細と同じ並び）。Instagram のボタンを「Instagram」だけに（ハンドルは aria-label）。
- `detail.css`・`cms.js`（記事プレビューの版数）・`cms.html` の版数を更新。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/detailfix.mjs`: 48/48（labyrinth JA/EN × 1440/390: ヒーローの補足文・「3日間」が1行に収まる（keep-all ＋ `<wbr>`）・FEATURE STORY の分割・LINEUP は登録 8 名すべて写真付きで番号を保持・名前の位置と行の高さがそろう・写真は xs/sm 派生で実ピクセル ≥ 表示幅×dpr・過去の出演者 3/3 写真付き・開催ヒストリーの見出しと表の間 17px・PC は Save ボタン／スマホはヒーロー右上 44px のハートで tjFav に保存。compuma / unit の記事カードは分割・導入文なし）。
- `tmp/venuefix.mjs`: 28/28（womb / unit / bonobo、JA・EN、1440/390: パンくずがヒーロー画像より上・Instagram は「INSTAGRAM」だけ（aria-label にハンドル）・スマホのボタンは2行・横はみ出しなし）。
- 回帰: `tmp/festdetailverify.mjs` 356/356（番号の四角の基準を 48px → PC 56px / スマホ 48px に更新）、`artdetailverify` 362/362、`vendetailverify` 322/322、`articleverify` 284/290（失敗6件は以前からの画像の細かさ、値も同じ）、`followverify` 297/297、`cursorverify` 65/65。
- `bash scripts/preflight.sh`（省略なし）: 全67件成功。
- 未確認: iPhone 実機でのハートの押し心地、CMS の確認・Publish pipeline（cms.js の版数を変えたため公開前に必須）。

### 変更したパターン

- 記事タイトルの「｜」で分けるのは `splitArticleTitle` 1か所。ヒーロー・FEATURE STORY・記事カード（grid / wide）で共有。
- 出演者の行の写真は「登録・公開・画像あり」のときだけ、番号の四角と同じ大きさで差し替え、番号は札で残す。
- 保存のハートは `tjFav.attachHeart` を使い、ボタンとハートで保存先を共有する。

### 未確認の類似パターン

- 確認済み・0件: `.detail-section-label` のマイナスの余白で重なる v2 の詳細ページ（他は Codex の報告と CDP で確認）。
- 未確認: 記事詳細の関連記事（wide・通常のカード）は今回変えていない。記事のないフェスはヒーローの補足文が無い（意図どおり）。

### 次の担当への注意・判断待ち

- ヒーローの補足文は「最新の関連記事のタイトルの後ろ半分」。記事が更新されると補足文も変わる。フェス自体の短い説明を別に持つかはユーザー判断（今は持たない）。

### 2026-10-26 redesign/magazine スマホのメニューの検索欄 ＋ フェス詳細 STORIES の補足文（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指摘「スマホのメニューの検索の縦幅を少し大きく」: `.nav-overlay .nav-search-link` は 52px 指定（モックも 52px）だが、メニューの縦並びの中身が画面より多く `flex-shrink` で 48.7px に縮んでいた → `flex: 0 0 auto` ＋ 高さ 56px（`common.css?v=55`）。
- ユーザー指摘「フェス詳細の STORIES の補足文の大きさを FEATURE STORY と同じに」: STORIES の `.story-title-sub` が 24px の Bebas Neue だった → FEATURE STORY の補足文と同じ 14px・行間 21px・太さ 300・本文の書体・rgba(.9)、日本語は文節の切れ目で改行（`detail.css?v=89`）。記事詳細の同じ部品は変えていない（16.5px のまま）。
- ユーザー確認済み（2026-10-26）: フェス詳細・アーティスト詳細・FAVORITES。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/menuverify.mjs` 27/27（390×844 / 667、JA/EN・フェス詳細: 56px・縮まない・アイコン中央・押すと検索画面・667 でもメニューはスクロール可・JS エラーなし）。
- `tmp/storiessub.mjs` 6/6（1440 / 390、JA/EN で STORIES の補足文が FEATURE STORY と一致、日本語は keep-all ＋ `<wbr>`）。
- `python3 scripts/check_asset_versions.py`、`node scripts/check_cms_article_generated_preview.mjs`、build の冪等性（Codex）成功。preflight（省略なし）は次の「スクロールで隠す」の修正と合わせて実施する。

### 変更したパターン

- 縦並びの flex の中で高さを決めたい部品は `flex-shrink: 0` にする（中身が多い画面で縮まないように）。

### 未確認の類似パターン

- 未確認: メニューの他の部品（項目・言語切替）も縮みうるが、指摘が無いため変えていない。

### 次の担当への注意・判断待ち

- APPLY の応募は Google フォーム（1FAIpQLSfh7ah…）の回答に入る。メールが届くかは Google フォームの「新しい回答についてのメール通知」の設定次第（ユーザーに案内済み）。WRITER は FormSubmit で press@techno-japan.media。

### 2026-10-27 redesign/magazine スマホの絞り込みをスクロールで隠す ＋ 会場詳細の写真と間隔 ＋ APPLY の注記 ＋ 名前の英語表示（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指摘「ARTISTS のスマホで固定される絞り込みが広く見える面積が狭い。VENUES も TOKYO / OSAKA を選ぶとサブエリアが出て同じ」。測定: ARTISTS はメニュー 64 ＋ 絞り込み 128 = 192px（390×844 の 23%、667 では 29%）、VENUES はサブエリアが出ると 206px（24% / 31%）。3案（スクロールで隠す／1行にまとめる／固定せず右下にボタン）を示し、ユーザーが**スクロールで隠す**を選択。
  - 900px 以下だけ。下へスクロールで帯を `translateY(-100%)` で隠し（レイアウトは動かさない）、上へ少し戻すと出す。検索欄・チップにフォーカス中、絞り込みを変えた直後、VENUES の地図を開いている間は出したまま。ARTISTS の FEATURED（固定のカルーセル）の区間では隠さない。動きを減らす設定ではアニメーションなし（`artists-phase3.*` / `venues-phase3.*`）。
- 会場詳細（ユーザー指摘「写真をもう少し大きく」「CLUB・渋谷・東京を会場名に近づけて。写真のすぐ下すぎる」）: スマホの写真を 21:9 → **3:2**（PC は 21:9 のまま）、写真と見出しの塊の間を空け（PC 32 / スマホ 24 前後）、`.venue-head-meta` → 会場名を詰めた（`detail.css`）。
- APPLY: 14 の注記の2行目「※ 画像をアップロードできない場合は、画像URLをこちらにご記入ください」（EN も）を削除。
- 名前の表示: APPLY の一番下の Upcoming と検索画面の一覧が、日本語ページで `name_ja`（カタカナの読み: デンキボサツ・スノーマシン）を出していた → サイトの他の場所と同じく `name`（英語名）を表示。検索で当たる語には name_ja / kana を残す（`search.js`）。
- `magazine.js` の参照が手書きのハブ8枚だけ `?v=6`（中身は c603dac4a で変わり、生成ページは v7）だったのを v7 にそろえた。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/hidescroll.mjs` 34/34（390×844 / 667、JA/EN: ARTISTS は FEATURED 中は出たまま・一覧で下スクロールで隠れ上で出る・検索欄フォーカスで出る、VENUES は TOKYO（サブエリア付き）で同じ、PC は隠れない、JS エラーなし）。
- `tmp/batchfix.mjs` 28/31（失敗3件は PC の会場写真が元画像の上限（1920 / 1360px）で 1280px×dpr2 に届かないもの。PC は今回変えておらず以前から同じ）。スマホの写真 3:2、写真 → 見出し・見出し → 会場名の間隔、APPLY の注記、Upcoming と検索画面の英語名、カタカナでの検索、JS エラーなし。
- 回帰: `artverify` 114/114、`venverify` 112/114（以前からの画像の細かさ2件）、`followverify` 297/297、`vendetailverify` 322/322（スマホの写真の基準を 21:9 → 3:2 に更新）、`applyverify` 68/68、`newsverify` 86/86、`featov2` 18/18（FEATURED の写真の基準を「一番高い文字の列の上に収まる最大」に更新。今日は名前が2行の人（Kuo From Sunset Rollercoaster）がいて 334px）。
- `bash scripts/preflight.sh`（省略なし）: 全67件成功（magazine.js の版をそろえる前に実施。そろえた後は版数の検査を再実行）。

### 変更したパターン

- スマホの固定の帯は「下で隠す・上で出す」を transform で行い、フォーカス・操作直後・地図表示中は出す。固定のカルーセルの区間では触らない。
- 名前の表示は `name`、検索の照合は name_ja / kana も含める。

### 未確認の類似パターン

- 未確認: FESTIVALS 一覧・NEWS のスマホの絞り込み（指摘が無く変えていない）。iPhone 実機でのスクロールの感触（慣性スクロール中の出し入れ）。
- 確認済み・0件: `name_ja` を表示に使っている他の場所（APPLY と検索画面以外は `name`）。

### 次の担当への注意・判断待ち

- cms.js（記事プレビューの版数）を変えているため、公開時は Publish pipeline ＋ CMS の確認が必要。

### 2026-10-27 redesign/magazine VENUES のスマホで地図を開いているときも絞り込みを隠す（Claude 検証・コミット。本番未反映）

### 実施

- ユーザー指摘「VENUE の絞り込みで MAP を選択した時だけ隠れない」: `venues-phase3.js` の `toolbarMustStayVisible()` の `|| mapOpen` を外した（スマホの地図は固定ではなくページと一緒に流れるため、出したままにする理由が無かった）。MAP を押した直後の 700ms だけ出したままにする動きは残す。`venues-phase3.js?v=7`。
- ユーザー確認済み（2026-10-27）: ARTISTS 一覧・VENUES 一覧・スマホのメニューの検索欄。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/hidescroll.mjs` 38/38（地図を開いた状態で下スクロールで隠れ・上で出る JA/EN を追加）。build・冪等性・版数（Codex）成功。

### 変更したパターン

- なし（条件を1つ外しただけ）。

### 未確認の類似パターン

- 確認済み・0件（ARTISTS は地図が無い）。

### 次の担当への注意・判断待ち

- ユーザーが「全部まとめて本番に出す」を選択（2026-10-27）。ABOUT のスクロール不具合・APPLY の通知（press@）・FESTIVALS の帯を直してから、main を取り込み、全体の検査を通して出す。

### 2026-10-27 redesign/magazine ABOUT がスクロールできない不具合 ＋ APPLY の通知を press@ に ＋ FESTIVALS の並び替えを残して種類を隠す（Claude 検証・コミット。本番未反映）

### 実施

- **ABOUT がスクロールできない（不具合）**: フェーズ5（3d285cde1）で `<body class="about-page">` に付けた `.about-page { overflow: clip }` がビューポートに伝わり、PC・スマホともホイールでも指でもスクロールできなかった → `overflow-x: clip` に（横のはみ出しだけ隠す）。同じ指定の他のページは無い。
- **再発防止**: 全ページで実際にスクロールできるかの検査 `scripts/check_page_scroll.mjs` を追加し preflight に登録（ハブ JA/EN・詳細 各種・ABOUT/APPLY/WRITER/FAVORITES/404 × PC・タッチのスマホ）。タッチの送り方の誤りは次のコミットで直す。
- **APPLY の通知（ユーザー指示「通知先を press@techno-japan.media に」）**: Google フォームへの記録（formResponse）はそのまま、その後に FormSubmit の AJAX（`https://formsubmit.co/ajax/press@techno-japan.media`）へ16問の回答（画面の言語の見出しをキー）・`_subject`（掲載申請: フェス名）・`_template: table` を送る。ハニーポット時はどちらにも送らない。FormSubmit が失敗しても応募者にはエラーを見せない（記録は Google フォームにある）。CSP の connect-src に formsubmit.co を足したのは APPLY のページだけ。
- **WRITER の送り先**: 本番・redesign とも、JA・EN とも既に `formsubmit.co/press@techno-japan.media`（変更なし）。
- **FESTIVALS（ユーザー指示「PC とスマホ両方とも、下にスクロールした時にソートが残るように、絞り込みが隠れるように」、残す段はユーザーが UPCOMING / ARCHIVE / ALL ＋ GRID / LIST を選択）**: 上の帯（UPCOMING… ＋ GRID / LIST）をメニューの下に固定、下の帯（種類）は下スクロールで上の帯の裏へ隠れ、上で出る。最初の実装は2つの帯を包む要素の高さが帯2本分で sticky が効かず流れていた → 包みを `display: contents` 相当にして修正。
- CDP 検査の後片付け（一時プロフィールの削除）が Chrome の書き込み中で ENOTEMPTY になり落ちることがあった（`check_festival_tracking.mjs` 等）→ プロセス終了を待ってから再試行つきで削除、失敗しても結果に影響させない。

### コミット

- （このエントリを含むコミット。redesign/magazine、push なし）

### 検証

- `tmp/aboutfest.mjs` 28/28（ABOUT: 1440 / 390 × JA/EN でホイール・スワイプでスクロール、横はみ出しなし。FESTIVALS: 一番上で全部見える・UPCOMING と GRID が同じ行、下スクロールで上の帯がメニューの下に残り種類の段が隠れる（手前の要素で判定）、上で戻る、JS エラーなし）。
- `tmp/applynotify.mjs` 21/21（fetch 差し替え＋ docs.google.com / formsubmit.co をブラウザで遮断。**本物には送っていない**。Google フォーム1回・FormSubmit AJAX 1回（宛先・POST・JSON）・件名・16問・言語の見出し・成功表示・ハニーポットで両方とも送らない・FormSubmit 失敗でも成功表示・他のページの CSP に formsubmit.co が無い）。
- `node scripts/check_festival_tracking.mjs` 成功。build・冪等性・版数・回帰・`check_apply_form.mjs`（Codex）成功。
- 未確認: FormSubmit の実際の配信（宛先ごとに最初の1回だけ有効化メールが press@ に届くことがある。WRITER で有効化済みなら不要）→ 公開後のテスト送信で確認する。

### 変更したパターン

- body（ビューポートに伝わる要素）には縦方向の overflow を付けない。横のはみ出しは `overflow-x: clip`。
- sticky の帯は、固定したい範囲いっぱいの要素の子にする（帯だけを包む要素の中では効かない）。
- 応募の記録（Google フォーム）と通知（FormSubmit）は別々に送り、通知の失敗で応募者の表示を変えない。

### 未確認の類似パターン

- 確認済み・0件: body に `overflow: clip` / `hidden` を付けている他のページ。
- 未確認: NEWS のスマホの絞り込み（指摘なし）。

### 次の担当への注意・判断待ち

- 公開後、APPLY のテスト送信1回で「Google フォームの回答に入る」「press@ にメールが届く（初回は有効化メールの可能性）」を確認する。

### 2026-10-27 新デザイン（redesign/magazine）を本番へ公開（Claude。ユーザー指示「全部まとめて出す」）

### 実施

- ユーザーが「同時並行で確認済みなものから本番に」と依頼 → 共通部品（メニュー・フッター・背景・色・文字）が全ページ共通で、一部だけ新デザインにすると新旧2組の共通部品が必要になると説明し、3案から**「全部まとめて出す」**を選択（2026-10-27）。
- 公開前に残りを修正: ABOUT がスクロールできない不具合、APPLY の通知（press@ に FormSubmit でも送る）、FESTIVALS の並び替えの帯、VENUES の地図を開いたときの帯、全ページのスクロール検査の追加。
- main（2026-10-27 時点の公開データ）を取り込み（cba4b824e）、公開の処理と同じ順で派生画像 → 画像の寸法 → ページを作り直した。
- `git push origin redesign/magazine:main`（pre-push で省略なしの preflight）。

### コミット

- 公開したもの: redesign/magazine の ce01f118b まで（フェーズ1〜6 とユーザー確認後の修正、本番より 28 件先）。

### 検証

- 公開前のブラウザ確認（CDP、最新データで作り直した後）: TOP（カルーセル・最初の1枚・時差）合格、NEWS 82/86（失敗4件は下記のデータ由来のずれ）、FESTIVALS 126/126、ARTISTS 114/114、VENUES 112/114（以前からの画像の細かさ2件）、追加確認一式 297/297、フェス詳細 356/356、アーティスト詳細 362/362、会場詳細 322/322、記事 284/290（以前からの画像の細かさ6件）、ABOUT 54/54 ＋ スクロール 28/28、APPLY 68/68 ＋ 通知 21/21（本物には送っていない）、スクロールで隠す帯 38/38、カーソル 65/65、地図 12/12。追加確認一式とアーティスト詳細で1件ずつ出た失敗は、流し直して 297/297・362/362（タイミング）。
- `node scripts/check_page_scroll.mjs`: 58ページ・0失敗（PC ホイール／スマホ タッチ）。
- `bash scripts/preflight.sh`（pre-push）: pre-push フックで省略なしに実行（成功しないと push されない仕組み。push が通ったこと＝全件成功）。
- ユーザー確認済み: TOP・FESTIVALS 一覧・NEWS・ARTISTS 一覧・VENUES 一覧・フェス詳細・アーティスト詳細・FAVORITES・スマホのメニューの検索欄。
- **未確認（公開後に本番で確認してもらう）**: 会場詳細・ABOUT・APPLY・WRITER（ユーザー了承済み）。

### 変更したパターン

- 公開は「main を取り込む → 生成物を作り直す → 冪等性・版数 → ブラウザ確認 → pre-push の preflight」の順。

### 未確認の類似パターン

- 公開後の本番での確認は次のエントリに記録する（本番の CARTO の黒い地図、主要ページの表示・スクロール・JS エラー）。

### 次の担当への注意・判断待ち（公開後にすること）

- **Publish の経路（cms.js / cms.html を変更）**: `gh workflow run "Publish pipeline"` を流して成功を確認。ユーザーに CMS を `?cb=` 付きで開き Cmd+Shift+R で強制リロード → 編集 → プレビュー → 閉じる → 再表示 → 保存、Publish Now を1回押してもらい、`cms: publish data.js` のコミットが増えたことを確認するまで「**実機未確認**」。
- スプレッドシートの列: 新しい CMS が本番に出た後、FESTIVALS の見出しの最後に `SOUND`、VENUES の見出しの最後に `GALLERY`（途中に挿入しない）。
- APPLY のテスト送信1回: Google フォームの回答に入ること、press@ にメールが届くこと（初回は FormSubmit の有効化メールの可能性）。
- iPhone 実機: スクロールで隠れる帯、カルーセル、ハート、地図。
- NEWS（以前からの小さなずれ・公開後に直す）: 記事が21本になり、3本並びの枠に「注目記事」が最初の12本の外から入るため、一覧が7行・表示13本なのに件数は「12 / 21」。モックどおり注目記事は表示中の12本の中から選ぶようにする。
- 戻すとき: 公開直前の main は 5d5ce0245。

#### 追記（2026-10-27 公開の1回目は pre-push の preflight で止まった）

- `APPLY Google Form 対応`（`scripts/check_apply_form.mjs`）1件だけ失敗（67成功）。今日足したブラウザでの送信の検査が、07 公式サイトURL・09 チケット販売URL（`type="url"`）に URL でない文字を入れていて、フォームの入力チェックで送信が止まっていた（検査を足した Codex の環境ではブラウザが動かず、一度も実行されていなかった）。APPLY 自体は `tmp/applynotify.mjs` 21/21 で正常。
- 検査を修正（URL の欄に正しい形の URL、送信を最大5秒待つ、止まったときに不正な欄を表示）→ `node scripts/check_apply_form.mjs` 成功。仕組みどおり、1回目の push では本番に何も出ていない。

#### 追記（公開の2回目も pre-push の preflight で止まった）

- `モバイルの言語切替`（`scripts/check_mobile_language_toggles.mjs`）が 31/36（ばらばらの5ページで言語切替が visibility: hidden）。単独で流すと 36/36 を2回。ページを開いて 600ms 後にハンバーガーを押し、同じ評価の中ですぐ測っていたため、混んでいるとメニューを開く処理が間に合わないことがあった（タイミング）。
- 検査を修正（読み込み完了を待つ・メニューが開くまで最大3秒待つ・開かなければ1回だけ押し直す。合格の条件は変えない）→ 36/36。本番には何も出ていない。

#### 追記（公開の3回目は「ハブページが JS 込みで描ける」の時間切れで止まった）

- `check_hub_pages.py --budget 15000` は単独でも 209 秒（制限 240 秒）で、全体の preflight の中では 240 秒を超えた（ハブページが新デザインで重くなった分）。検査の中身・合格の条件は変えず、`scripts/preflight.sh` でこの1件だけ制限を 480 秒にした（`run_timeout`。環境変数で外から緩める方式ではない）。本番には何も出ていない。

### 2026-10-27 新デザインの本番公開・公開後の確認（Claude）

### 実施

- `git push origin redesign/magazine:main` が4回目で通った（5d5ce0245..d4792a15f）。1〜3回目は pre-push の preflight が検査側の問題（APPLY の検査の入力値／スマホの言語切替の検査の待ち時間／ハブページの検査の時間切れ）で止まり、それぞれ検査を直してから再実行（上のエントリの追記）。本番に不完全なものは出ていない。
- Deploy LP to GitHub Pages（run 40451644083）成功。デプロイが `chore: sync generated LP before deploy`（cef8fb170）をコミット。
- `gh workflow run "Publish pipeline"`（run 40452897041）: 成功（データに変化が無いため `cms: publish data.js` のコミットは作られない＝正しい動き）。

### コミット

- 本番の main: d4792a15f（公開）＋ cef8fb170（デプロイの生成物の同期）。このエントリは redesign/magazine にコミットし、次の push で main に入る。

### 検証

- 本番 `tmp/prodcheck.mjs` 120/120（https://techno-japan.media の主要20ページ（JA/EN のハブ・詳細・ABOUT/APPLY/WRITER/FAVORITES/CLUB MAP）× 1440 / 390: 新デザイン（common.css v55）、スクロール、JS / CSP エラーなし、VENUES の地図は CARTO の黒い地図・加工なし・タイル読み込み済み）。
- 本番の preflight（pre-push）: 全68件成功。
- **実機未確認**: CMS（`?cb=` 付き・Cmd+Shift+R → 編集 → プレビュー → 閉じる → 再表示 → 保存、Publish Now 1回、`cms: publish data.js` のコミットが増えること）はユーザーのログインが必要で未実施。iPhone 実機、APPLY のテスト送信（Google フォームの回答・press@ のメール・FormSubmit の有効化）も未実施。

### 変更したパターン

- なし（公開の記録）。

### 未確認の類似パターン

- ユーザーが本番で確認する: 会場詳細・ABOUT・APPLY・WRITER。

### 次の担当への注意・判断待ち

- メインの作業フォルダ（~/Developer/techno-japan、main）に、未追跡の `docs/REDESIGN_SPEC.md`（main のものより古い版）と `docs/design-mock/`（main と同じ内容）が残っており、そのままでは `git pull` が止まる。片づけ方はユーザーに確認中。
- スプレッドシートの `SOUND` / `GALLERY` 列は、CMS の確認が済んでから足してもらう。
- NEWS の「12 / 21」と表示13本のずれ（注目記事を表示中の12本から選ぶ）を次に直す。
- **Lighthouse CI（公開後、run 40452085222）が失敗**: festivals.html の CLS 0.458（基準 ≤0.05）・性能 0.47（基準 0.6、警告）。他のページは性能の値が出ない（`Audit did not produce a value`）。新デザインで初めての測定。フェーズ7（表示速度・Lighthouse）で最初に直す（FESTIVALS の JS で後から入る見出し・NEXT UP・一覧の場所取り、帯の差し込みを疑う）。

### 2026-10-27 FESTIVALS 一覧の読み込み中のずれ（Lighthouse CI の失敗）＋ NEWS の件数のずれ（Claude 検証・コミット）

### 実施

- ユーザー「全て進めて。GitHub もエラーが出ている」。GitHub の失敗は公開後の **Lighthouse CI**（run 40452085222 / 40453522580）だけで、原因は `festivals.html` の **CLS 0.4577（基準 ≤ 0.05）**（性能は warn 扱いで止める条件ではない。a11y / BP / SEO は合格）。
- 手元で同じ条件（412×823・CPU 4倍・遅い回線）で 0.4577 を再現。ずれの元は `footer` と `.phase3-results`: 読み込み直後は head / NEXT UP / 一覧が空でページが短くフッターが最初の画面に見え、約 3.8 秒後に JS が中身を差し込んでフッターを押し出していた。`tj-festivals-hydrating` は描き終えても外れない（SEO 用リンク一覧を隠すだけ）。
- 修正（Codex、`tmp/spec-cls-news.md`）: JS が描き終えたら `<html>` に `tj-festivals-rendered` を付け、**それまでの間だけ** head・NEXT UP の高さと一覧の `min-height: 100vh` を空けておく。描き終えた後の見た目は同じ。
- NEWS: 記事21本で「表示13本・件数 12 / 21」だった（3本の枠の注目記事を表示中の12本の外からも選んでいた）→ モックどおり `vis.slice(3)` から選ぶ。
- メインの作業フォルダ（~/Developer/techno-japan）を片づけ（ユーザー了承）: 未追跡の `docs/design-mock/`（main と同じ）を削除、旧版の `docs/REDESIGN_SPEC.md` を `~/Developer/techno-japan-local-backup/REDESIGN_SPEC.2026-10-22-local.md` へ移し、`git pull --ff-only` で main（cef8fb170）にそろえた。

### コミット

- （このエントリを含むコミット。redesign/magazine → main へ push）

### 検証

- `tmp/clsprobe.mjs`（layout-shift の合計）: festivals.html JA/EN とも 412×823（スロットリング）・1350×940 で **0**（修正前 0.4577 / 0.2593）。
- `tmp/newscount.mjs` 16/16（1440 / 390、JA/EN: 表示本数＝件数、Load more 後・Popular でも一致、JS エラーなし）。
- 回帰: `festverify` 126/126、`newsverify` 86/86（一覧 6 行に戻った）、`aboutfest` 28/28（FESTIVALS の帯・ABOUT のスクロール）、`followverify` 297/297。build・冪等性・版数・CMS プレビュー・回帰（Codex）成功。
- 本番の Lighthouse CI は push 後に自動で走る → 結果は次のエントリ／報告で確認。

### 変更したパターン

- JS で後から描くハブは「描き終えた目印」を付け、それまでの間だけ描いた後の高さを空けておく（読み込み中の目印とは分ける）。

### 未確認の類似パターン

- 他のハブ（NEWS・ARTISTS・VENUES・TOP）は Lighthouse の CLS が合格しているため変えていない（Lighthouse の対象 URL は TOP・FESTIVALS・ARTISTS・詳細4種）。NEWS・VENUES は Lighthouse の対象外なので、必要なら同じ方法で測る。
- 性能（warn）の値が出ないページがある（`Audit did not produce a value`、本文のフェードインで LCP が取れない既知の事象・§9-80）。フェーズ7で扱う。

### 次の担当への注意・判断待ち

- CMS の実機確認（ユーザーのログイン）、SOUND/GALLERY 列、APPLY のテスト送信はユーザー待ち。

#### 追記（2026-10-27 公開後）

- `git push origin redesign/magazine:main` 1回で通過（pre-push の preflight 全68件、cef8fb170..97caa4eb7）。Deploy（run 40458606022）成功、**Lighthouse CI（run 40459101078）成功**（8 URL・全アサーション合格。GitHub の赤い表示は解消）。
- 本番の festivals.html で layout-shift の合計を直接測定: 412×823（スロットリング）・1350×940 とも 0。
- このエントリは redesign/magazine にコミット（docs のみ・次の push で main に入る）。

### 2026-10-27 フェーズ7（仕上げ: OGP / URL / 動きを減らす設定 / Lighthouse）＋ ABOUT の帯の削除（Claude 検証・コミット）

### 実施

- ユーザー「進めて」（フェーズ7）。実装はすべて Codex（`tmp/spec-phase7.md` / `spec-phase7b.md` / `spec-phase7c.md` / `spec-about-marquee.md`）。
- **既存 URL・sitemap**: 本番の sitemap 554 URL がすべて 200・新テンプレート、canonical / JSON-LD 正常、og:image 242 件すべて 200、内部リンク切れなし、旧ページの転送先も有効（`tmp/urlaudit.mjs`、本番は読むだけ）。
- **OGP**: 共有タグは公開前（5d5ce0245）と同一で、新デザインで崩れていないことを確認。足りなかった writers.html（JA/EN）の twitter:card 等を追加。全ページに og:image:width / height（og-default は 1200×630、詳細ページは `image-dimensions.json` に実寸があるときだけ）。`check_og_image.mjs` が寸法と実ファイルの一致を検査。
- **Lighthouse**: 本番 CI で詳細ページの性能が「値が出ない」（NO_LCP、フェス詳細は6回中5回）。手元に CI と同じ Lighthouse 12.6.1 を入れて再現し、原因を **body とヘッダーのフェードイン**（旧サイトから引き継ぎ、モックには無い）と特定 → 廃止。2026-08-13 の「混雑した CI 環境のせい」という判断は誤りだった（AUDIT §9-108）。
- フェードが隠していた**読み込み中のずれ**（NEWS 0.356 / VENUES 0.712）を、FESTIVALS と同じく「描き終えるまで場所を空けておく」方式で修正（`tj-news-rendered` / `tj-venues-rendered`）。
- 読み込み中のずれの検査 `scripts/check_hub_cls.mjs` を新設し preflight に登録（ハブ JA/EN・詳細4種 × スマホ（CPU 4倍・遅い回線）/ PC、毎ページ初回読み込み、0.05 超で失敗）。Lighthouse CI の対象に news.html / venues.html を追加し、`.lighthouserc.json` の誤った note を訂正。
- **動きを減らす設定**: CSS のアニメーションは共通ブロックで既に止まっていた（主要13ページ × PC/スマホで、実行中のアニメーション 0）。JS で動いていたマウスに付いてくる丸だけ、設定時は遅れなしに。あわせて丸が追いついたら毎フレームの処理を止める。
- ユーザー「About ページの帯をなくして。本番からも！」→ ABOUT（JA/EN）の流れる帯（`.top2-marquee`、スクロールしてもメニューの下に貼り付いていた）を削除。TOP の帯は残す。
- 版: common.css 56 / common.js 22 / news-phase3 8 / venues-phase3 8 / cms.js 190（記事プレビューの common.css の版）。
- **1回目の push は pre-push の preflight で止まった**（68/69 成功、「ハブページが JS 込みで描ける」が失敗。本番には出ていない）: (1) ABOUT の本文量が基準未満（帯を消したため 約10,500B → 8,825B、基準 9,000B）→ `regression-thresholds.yml` の about.html を 7,500 に（意図した変更）。(2) マウスの丸の検査（`--dump-dom` ＋ 仮想時間の iframe）で丸に位置が入らない → 丸の位置を requestAnimationFrame の中でしか書かなくなっていたため。以前と同じく初期化時に 0px を同期で入れる1行を足した（`tmp/spec-phase7d.md`、common.js 22）。単独で `check_hub_pages.py` 成功・`tmp/ringmotion.mjs` 12/12 を確認して再 push。

### コミット

- （このエントリを含むコミット。redesign/magazine → main へ push。main の 77017f15b（スプレッドシートのバックアップのみ）を取り込み済み）

### 検証

- Lighthouse（手元、CI と同じ版・設定、各2回）: 直した後は20回すべて値が出た（直す前は10ページ中6ページで「測れない」）。会場詳細 0.62 → 0.93、アーティスト詳細 0.65 → 0.83〜0.90、NEWS のずれ 0.356 → 0.009、VENUES 0.718 → 0.000。表は AUDIT §9-108。
- `node scripts/check_hub_cls.mjs`: 28件すべて合格（最大 0.009、約300秒）。NEWS / VENUES の修正だけ戻した状態では6件を失敗にすることを確認（最初の版はブラウザのキャッシュと `sw.js` の cache-first で2ページ目以降を見逃していたため2回直した。今は条件が崩れると検査自身が失敗する）。
- `tmp/nofade.mjs` 24/24（12ページ × PC/スマホ: DOMContentLoaded の時点で本文とヘッダーが不透明、フェードのアニメーションなし）、`tmp/ringmotion.mjs` 12/12（通常は今までどおり遅れて付いてくる、動きを減らす設定ではすぐ重なる、追いついたら止まる）、`tmp/ogverify.py`（og:image のある 557 ページすべて寸法一致、writers の twitter タグ）、`check_og_image.mjs` 成功。
- ABOUT: `tmp/aboutverify.mjs` 54/54（帯が無いことを確かめる形に変更）、`tmp/aboutband.mjs` 16/16（JA/EN × 1440 / 390: 帯の要素なし、スクロール中にメニュー下へ貼り付くものなし、スクロールできる、JS エラーなし）。目視: ヒーロー → 区切り線 → 「01 — About」。
- 回帰（CDP）: NEWS 86/86・FESTIVALS 126/126・ARTISTS 114/114・VENUES 112/114（以前からの画像の細かさ2件）・TOP（カルーセル・最初の1枚・時差）合格・追加確認一式 296/297・スクロールで隠す帯 38/38・ABOUT / FESTIVALS の帯 28/28・メニュー 27/27・フェス詳細 356/356・アーティスト詳細 361/362・会場詳細 321/322・記事 284/290（以前からの画像の細かさ6件）・APPLY 68/68（本物には送っていない）・WRITER 30/30・カーソル 65/65・地図 12/12・`node scripts/check_page_scroll.mjs` 58ページ0失敗。2列同時に流して落ちた3件（英語の FESTIVALS 一覧の過去・アーティスト詳細の JA/EN 切替・会場名の収まり）は、同じ待ち時間のまま単独で3回ずつ流して全部合格（`tmp/recheck3.mjs`。PC の混雑で読み込みが間に合わなかった）。
- build（最後まで）・冪等性（601ファイル）・版数・`check_regressions.py` 成功。
- `bash scripts/preflight.sh`（pre-push で省略なしに実行）: pre-push で省略なしに実行（新しい「読み込み中のずれ（CLS）」を含む）。1回目は上記の1件で失敗、修正後の2回目で push が通った＝全件成功。

### 変更したパターン

- ページ全体／ヘッダーを `opacity: 0` から始める演出をやめた（`check_regressions.py` に回帰ガード）。
- JS で後から描くハブは「描き終えた目印」（`tj-*-rendered`）が付くまで、描いた後の高さを空けておく（FESTIVALS / NEWS / VENUES の3つ）。
- 読み込み中のずれは、毎ページ初回読み込み（キャッシュ・サービスワーカーなし）で測る。条件が崩れたら検査自身が失敗する。

### 未確認の類似パターン

- TOP・ARTISTS はずれ 0.003 以下のため変更なし。詳細ページはフェス・アーティスト・会場・記事を各1件測定（最大 0.005）。同じテンプレートの他の詳細ページは未測定。
- iPhone 実機での「フェードなし」の見た目は未確認（headless の模擬のみ）。
- 本番の Lighthouse CI（10 URL）は push 後に自動で走る → 結果は次の報告で確認。

### 次の担当への注意・判断待ち

- 日本語書体（Noto Sans JP、4種類）は、旧デザインより最初の表示が遅い残りの主因だが、2026-10-23 のユーザー決定（今のまま）を維持。再提案しない（AUDIT §9-108 に数値だけ記録）。
- Publish の経路: cms.js / cms.html の版を上げたため、push 後に `gh workflow run "Publish pipeline"` を流す。CMS の実機確認（`?cb=` 付き・Cmd+Shift+R → 編集 → プレビュー → 閉じる → 再表示 → 保存、Publish Now、`cms: publish data.js` のコミット）はユーザーのログイン待ちで「**実機未確認**」のまま。
- SOUND / GALLERY 列、APPLY のテスト送信、会場詳細・APPLY・WRITER の本番確認はユーザー待ち（前のエントリのとおり）。

### 2026-10-27 Lighthouse CI の実行マシンに日本語の書体を入れる（Claude 検証・コミット）

### 実施

- フェーズ7公開後の Lighthouse CI が CLS で3回中2回失敗（womb 0.069 ×2、記事 0.050 / 0.039。他の URL は合格、10 URL すべてで性能の値は出ている）。
- 手元（Mac）では Lighthouse 12.6.1（CI と同じ設定）・CDP・CPU 6倍遅くした条件で本番を24回以上測り、0.000〜0.002 で再現しない。
- CI の画面写真で日本語が豆腐で描かれていた（ubuntu ランナーに日本語の書体が無い）。書体の当てはめが最初の表示の後にずれ込んだ回だけ行数が変わって約100px ずれる、と特定（AUDIT §9-108 追補）。
- `.github/workflows/lighthouse.yml` に `fonts-noto-cjk` を入れる手順を追加（`timeout-minutes` 12 → 15）。`.lighthouserc.json` の合格の基準・集計方法・URL は変えず、note に理由を2行。実装は Codex（`tmp/spec-phase7e.md`）。

### コミット

- （このエントリを含むコミット。redesign/magazine → main へ push）

### 検証

- YAML / JSON の構文、`check_regressions.py`、`git diff --check` 成功（Codex）。actionlint は push 後の「Lint GitHub Actions」で確認する。
- push 後に Lighthouse CI を手動で2回流して、CLS が合格し続けるかを確認する（結果は次の報告で）。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 測る環境を利用者の条件に合わせる（日本語の書体）。合格の基準は変えない。

### 未確認の類似パターン

- `check_hub_cls.mjs`（手元の preflight）は Mac で動くため、日本語の書体がある条件で測っている（利用者と同じ）。CI だけの豆腐の問題は手元では再現しない（確認済み・0件）。
- 他の CI（regression-check 等）でブラウザが日本語を描く検査があれば同じ条件差がありうる（未確認）。

### 次の担当への注意・判断待ち

- Lighthouse CI がこの後も CLS で落ちる場合は、書体以外の原因。CI でトレース（`lighthouse --save-assets`）を取って調べる。

### 2026-10-27 Lighthouse CI の書体対応の結果確認（Claude）

### 実施

- d475031a9（Lighthouse CI の実行マシンに `fonts-noto-cjk`）を push 後、Lighthouse CI を手動で2回、順番に流した（同時に流すと concurrency で前の回が取り消されるため）。

### コミット

- このエントリのみ（docs）。次の push で main に入る。

### 検証

- 「Lint GitHub Actions」（run 40493230206）成功。書体の導入は約10秒、`fc-list :lang=ja` で Noto CJK JP を確認。
- Lighthouse CI run 40493291539・40493909025 とも**成功**。10 URL すべてで CLS ≤ 0.009（womb 0.000 / 0.000、記事 0.000 / 0.000）、性能の値はすべて出ている（0.57〜0.90、warn の床 0.6 を下回るのは記事・TOP の一部で従来どおり）、a11y / BP / SEO 合格。
- 以前ずれが出た条件（最初の表示が 1.3 秒台）の回でも 0（記事 obsFCP 1322 / 1360ms、dj-nobu 1331ms）。書体を入れる前は公開後3回中2回失敗（womb 0.069 ×2、記事 0.050 / 0.039）。

### 変更したパターン

- なし（確認のみ）。

### 未確認の類似パターン

- womb は書体導入後の2回とも最初の表示が速い回（約 0.3 秒）だった。遅い回の womb は未観測。今後の Lighthouse CI で落ちたら、トレースを取って調べる。

### 次の担当への注意・判断待ち

- なし（Lighthouse CI は合格に戻った）。CMS の実機確認などユーザー待ちの項目は前のエントリのとおり。

### 2026-10-28 フェーズ8（英語版の完成）: 棚卸し・UI・データの英訳入力・見える日本語の検査（Claude 検証・コミット）

### 実施

- ユーザー「進めて」（フェーズ8）。英語ページ 278 枚（転送 9 枚除く）を実ブラウザ相当で描き、見える日本語を集計（`tmp/eninventory.mjs`）: **67 枚・109 種類**。スマホ幅・メニュー・検索も確認し、UI の日本語は APPLY の都道府県だけだった。
- UI（Codex `tmp/spec-phase8a.md`）: APPLY 英語ページの都道府県を英語表示（value は Google フォームと同じまま、`enHubFromJa` で毎回適用）、説明文の言語切替ボタンに `lang` 属性。
- データ（ユーザーが案を承認し「入力して」、Claude が入力）: FESTIVALS の name_en 5 件（根拠つき、AUDIT §9-109）、ARTISTS fuji の bio_en（日本語が入っていた → 英訳）、ARTICLES 8 本の body_en（日英併記ラベルの日本語を削除、写真の説明文 7 枚を英訳、フェス名を英語名に）。入力方法は AUDIT §9-109（行全体を読む → 照合 → 変更点だけ重ねる → 全列を読み直して照合）。Publish Now はユーザーが押した（f71ada044 `cms: publish data.js`、Publish pipeline 成功、d84552d9c 再生成）。
- 検査（Codex `spec-phase8a/8b/8c.md`）: `scripts/check_en_visible_japanese.mjs`（新規・preflight）。英語ページ全部、4 並行、画像・書体を止め、動きを減らす設定、約 65 秒。基準は `scripts/fixtures/en-visible-japanese-baseline.json`。最初は 10 分を超えた（原因と対策は AUDIT §9-109）。`check_hub_cls.mjs` にも子の Chrome の後片付けと時限を追加。
- CMS の潜在的な不具合を修正: `bulkSaveRow` が記事の日付型セルを別の形の文字列で書き戻すおそれ → cms.js 191（AUDIT §9-109）。

### コミット

- 094821447（UI・検査・CMS）、main（f71ada044 / d84552d9c / ce1a31165）の取り込み、このエントリを含むコミット。

### 検証

- 見える日本語: **67 枚・109 種類 → 13 枚・21 種類**。残りはすべて英文中の日本語の固有名（電子原人、燃蛾茶会、暗黒ニラ、鏡民 / Kyomi 等）。フェーズ8の完了条件（固有名を除いて 0）を満たす。
- 本番データ: 14 行とも、変わったのは対象の欄だけ（lastEditedAt は GAS の自動更新）、値は計画どおり、記事の公開日は同じ日付のまま。本番の英語ページで反映を確認（見出しの英語名・FUJI の英語プロフィール・写真の説明文・ラベル）。
- `check_en_visible_japanese.mjs`: 合格（増加 0、64.7 秒、終了後に Chrome の残り 0）。英語の ABOUT に日本語を 1 つ足した複製では「増加 1 件」で失敗することを確認。
- `check_apply_form.mjs`（16 問 × 2 ページ、実送信なし）、`check_cms_sound_gallery.mjs`（一括保存の日付保護 3 ケース）、版数、回帰、build 冪等性（601）成功。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 本番データの書き込みは「行全体を読む → 控えと照合 → 変更点だけ重ねる → 送る → 全列を読み直して照合」。日付型セルは `fmtDate`。
- 英語ページの見える日本語は基準ファイルで管理し、増えたら preflight で止まる。headless の検査は動きを減らす設定で開き、子の Chrome を必ず終わらせる。

### 未確認の類似パターン

- 英文中の日本語の固有名 21 件はそのまま（公式のローマ字表記が確認できない）。tsutomu の bio_en の「Spring Love 春風」を英語名（SPRING LOVE HARUKAZE）に合わせるかは未決。
- CMS 一括保存の修正は、本番での実際の一括保存では未確認（**実機未確認**、モックの検査のみ）。
- 開催回の英語の場所（LOCATION）28 件は英語ページに表示されないため、見える日本語としては 0（確認済み）。

### 次の担当への注意・判断待ち

- cms.js 191: push 後に `gh workflow run "Publish pipeline"`。CMS を開くときは Cmd+Shift+R。
- データに日本語の固有名が増えると `check_en_visible_japanese` が止まる。中身を確認し、固有名なら `--update` で基準に入れる。
- 次の作業: SEO / AIO / LLMO の対策（ユーザー依頼 2026-10-28、調査結果は会話と次のエントリ）。

### 2026-10-28 優先ソース案内リンクの文字サイズ・タップ領域修正（Codex）

### 実施

- `LP/common.css` の優先ソース基準9pxを廃止。フッター案内を10px mono・48px領域・既存フッターリンク相当の色/hoverに、記事末尾リンクを本文13px・`--text-a80`・44px領域に修正。フッター長文は390px幅で折り返す指定を追加。
- `COMMON_CSS_VERSION` と参照を58へ統一。記事プレビューの `cms.js` と `cms.html` も更新。ニュースレター欄の指定は変更していない。

### コミット

- 未コミット（ユーザー指定により commit / push なし）。

### 検証

- `node scripts/build-detail-pages.mjs` 成功、`node scripts/check_build_idempotent.mjs` 成功（601ファイル差分なし）。
- 版数、CMS記事プレビュー、優先ソース、回帰、`git diff --check` はすべて成功。
- 実ブラウザ確認はClaude実施予定（**実機未確認**）。

### 変更したパターン

- `.preferred-source-footer`、`.preferred-source-label`、`.preferred-source-article a` の文字サイズ・書体・タップ領域・折り返し。
- `common.css` の版数参照（58）、CMSプレビュー参照、`cms.js` 版数（193）。

### 未確認の類似パターン

- 実ブラウザでのPC / 390px表示、クリック範囲、記事末尾リンクの視認性は未確認。
- ニュースレター欄は変更なし・検査済み。

### 次の担当への注意・判断待ち

- ClaudeがPCと390pxでフッター案内、記事末尾案内を強制リロード後に確認する。問題がなければ既存の未コミット変更と併せてコミット可。

### 2026-10-28 SEO / AIO / LLMO 対策: 調査・優先ソースのリンク・AI 回答ログ・毎週の本番点検（Claude 検証・コミット）

### 実施

- ユーザー依頼「最新の SEO や AIO、LLMO の対策をインプットして対策をしていきたい」→ 指定の URL 10 件を調査（調査用エージェント。x.com の 3 件はログインが必要で読めず）。要点と方針は `docs/aio/AIO_LLMO_2026-10-28.md`。旧指示書 `GEO_TECHNO_JAPAN.md`（Next.js 前提）に新しい文書への案内を追記。
- ユーザー「4〜6は作成して」（実装は Codex、`tmp/spec-seo-a/b/c/d.md`）:
  - **4. 優先ソースの案内リンク**（`https://www.google.com/preferences/source?q=techno-japan.media`）を、全ページのフッター・記事の末尾（JA/EN）・サイト内のニュースレター欄（magazine.js）・メルマガの下書き（newsletter-draft.mjs）に置いた。公式の JS ボタンは CSP の変更が要るので使わない。文字はフッター 10px・当たり判定 48px（既存のフッターのリンクと同じ）、記事の末尾 13px・44px。検査 `scripts/check_preferred_source.mjs`（URL の完全一致と配置）。
  - **5. AI 回答ログ**（claude.ai のアーティファクト https://claude.ai/artifact/1hHBW51iJjWu2qpiJ2xt15 、非公開、db に保存）: 質問 40 問（日英各 20、情報・比較・おすすめ・行動）、毎月は★10 問 × ChatGPT・Google AI モード、3 か月ごとに全問 × 4 つの AI。10 月分として GA4 の AI 経由 85 セッションを入力。質問集と手順は `docs/aio/ai-answer-log.md`。
  - **6. 本番の全ページの毎週の自動点検**: `scripts/audit_production_site.mjs`（サイトマップの全 URL を GET だけで点検。応答・転送・noindex・canonical・JSON-LD・hreflang・サイト内リンク切れ・title/description の重複・og:image・孤立ページ）、`.github/workflows/site-audit.yml`（毎週月曜 9:30 JST、`reports/site-audit/` をコミットしてから、エラーがあればジョブを失敗に）。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- 本番の点検の試運転（554 URL、約 44 秒）: 最初はエラー 4 件（`${href}` へのリンク切れ）→ ページ内のスクリプトのテンプレート文字列を拾った誤検知だったため、script / style を除いて抽出するよう修正。言語違いで title が同じ 8 組は hreflang で対応づけ済みなので参考扱いに。修正版で 1 回例外（文字列を URL として扱っていた）→ 修正。最終: **エラー 0・注意 1**（トップの正式な URL `/` へのリンクが無い。ナビとロゴは `/index.html`）。
- 優先ソースのリンク（CDP、1440 / 390）: 記事の末尾 13px・高さ 44px、フッター 10px・48px、ニュースレター欄 15px・45px、横のはみ出しなし。記事の末尾とニュースレター欄を目視。
- `check_preferred_source.mjs`（581 ページ）、`check_newsletter.mjs`（下書きを手元で生成して確認。送信用の鍵なし＝外部送信なし。生成物は削除）、build 冪等性（601）、版数、回帰、CMS プレビュー、`check_en_visible_japanese.mjs`（増加 0）成功。
- AI 回答ログ: db の書き込みと読み出しを確認（`months/2026-10`）。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 外部サービスの JS を足さず、リンクで導線を作る（CSP を変えない）。
- 本番の点検は GET だけ・週 1 回・レポートを残してから失敗にする。HTML からリンクを取り出すときは script / style / template / コメントを除く。

### 未確認の類似パターン

- ナビとロゴのトップへのリンクが `/index.html`（正式な URL は `/`）。全ページのナビを変える修正になるため未対応（毎週の点検の注意に残る）。
- `site-audit.yml` は push 後の手動実行で初回を確かめる。
- ユーザーの確認待ち: Search Console の「検索の生成 AI」が「含める」か、優先ソースの設定ツールに techno-japan.media が出るか。

### 次の担当への注意・判断待ち

- cms.js 193（記事プレビューの common.css の版）: push 後に Publish pipeline。CMS を開くときは Cmd+Shift+R。
- 毎月: AI 回答ログに GA4 の AI 経由のセッション（`reports/ai-referrals.md`）を入れる。誤りが記録されたら該当ページを直す。
- 文章ガイドへの追記（記事の冒頭に事実をまとめる、内容を大きく直したら更新日を入れる）は未。

### 2026-10-28 APPLY のラベルの左寄せ・ARTISTS（PC）のジャンルを1行で横スクロール・FESTIVALS の種類の段を追従させない（Claude 検証・コミット）

### 実施

- ユーザーの指摘（スクリーンショット付き）を Codex で修正（`tmp/spec-apply-label.md`、`tmp/spec-artists-fest-filters.md`）:
  - **APPLY**「04 — 申請フォーム」が PC で右に寄っていた → 原因は `submit.html` の `.apply-form-head .mono{…text-align:right}`（見出しの横の補足文用。補足文は既に無く、中のラベルに当たっていた）。`.apply-form-head > .mono` に限定。EN も同じ。
  - **ARTISTS（PC）**: ジャンルの絞り込みが2行に折り返していた → PC も1行・横スクロールに。続きがあるとき端を薄く（`is-scroll-start` / `is-scroll-end` / `is-scrollable`）、PC は細いスクロールバー。縦のホイールを横に変える処理は入れない。スマホは今のまま。
  - **FESTIVALS**: 種類の段（ALL TYPES / FESTIVAL / RAVE）を追従させない（`position: static`、隠す／出す処理を削除）。上の段（UPCOMING / ARCHIVE / ALL と GRID / LIST）は今までどおり追従。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- APPLY: PC 1440 で「04 — 申請フォーム」の文字の左端＝見出し「SUBMIT AN EVENT」の左端（80px）、JA/EN。スマホは変わらず。`tmp/applyverify.mjs` 68/68。
- `tmp/filters2.mjs` 34/35: ARTISTS は 1440 / 1280 で1行に収まり、1100 で1行・横スクロール・端の印の切り替え・右端の TRANCE で絞り込み（131 → 2）、390 は変わらず、横のはみ出しなし。FESTIVALS は種類の段が static・上の段が sticky、下にスクロールすると種類の段が流れて消え上の段がメニューの直下（PC / スマホ / EN）。失敗 1 件はスマホで少し上に戻したときにページの上まで戻り、種類の段が本来の位置に見えただけ（検査側の問題、ページ上の位置が変わらないことを確認）。目視で確認。
- 回帰: ARTISTS 114/114・FESTIVALS 126/126・スクロールで隠す帯 38/38・`check_page_scroll.mjs`・`check_hub_cls.mjs`（28 件）成功。`tmp/aboutfest.mjs` 24/28 の失敗 4 件は「上に戻すと種類の段が戻る」という古い期待（今回の指示で意図して変えた動き）。
- build 冪等性（601）・版数・回帰・CMS プレビュー成功。`bash scripts/preflight.sh`: pre-push で実行（push が通った＝全件成功）。

### 変更したパターン

- 共通の指定を子孫セレクタで書くと、後から中に入った同じクラスの要素に当たる（APPLY のラベル）。用途の要素に限定する。
- PC の横スクロールは、端のフェードと細いスクロールバーで続きがあることを見せる。

### 未確認の類似パターン

- 他ページの `.mono` に子孫セレクタで `text-align: right` が当たっている箇所は未調査（APPLY のみ確認）。
- iPhone 実機での ARTISTS の横スクロール・FESTIVALS の帯は未確認（headless の模擬のみ）。

### 次の担当への注意・判断待ち

- フェス詳細の ACCESS MAP はモックどおりの飾りの枠（格子＋点＋Google Maps のリンク）で、実際の地図が無い。ユーザー指摘「真っ暗」→ VENUES 一覧と同じ CARTO の地図を出す実装を次に行う。

### 2026-10-28 フェス詳細の ACCESS に実際の地図（VENUES と同じ CARTO の黒い地図）（Claude 検証・コミット）

### 実施

- ユーザー指摘「Festival 詳細の ACCESS MAP が表示されていない。真っ暗になってる」。ACCESS はモックどおりの飾りの枠で、地図の埋め込みは元から無かった。Codex で実装（`tmp/spec-festival-map.md` → 手直し `tmp/spec-festival-map-fix.md` → 検査の測り方 `tmp/spec-festival-map-check.md`）。
  - 座標のあるフェス（JA/EN 各 55 件）: ACCESS が画面に近づいたら Leaflet を読み込み、CARTO dark_all（読めなければ OSM を暗く加工）を表示。開催地に赤い点。PC は拡大縮小・ドラッグ可、スマホは動かせない（ページのスクロールを妨げない）。「Google Maps ↗」は地図の右上（右下は出典表示）。
  - 座標の無いフェス（JA/EN 各 36 件）: 変更前とまったく同じ枠（会場名で検索する Google マップのリンク付き）。地図の部品も読み込まない。
  - Leaflet を読み込む処理を `venues-phase3.js` から `map-tiles.js` へ移し、VENUES 一覧とフェス詳細で共有（`map-tiles.js?v=2`、`venues-phase3.js?v=9`、`festival-map.js?v=1`、`detail.css?v=91`、cms.js 194 は記事プレビューの detail.css の版のみ）。
  - 新しい検査 `scripts/check_festival_access_map.mjs` を preflight に追加。
- 設計の理由と、検査の測り方を2回誤った経緯は AUDIT §9-110。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- 手元（127.0.0.1:8095、CDP、`tmp/fmapverify.mjs`）64/64: PC 1440 / 1280・スマホ 390、JA/EN。地図が出る（localhost は CARTO が 403 → OSM を暗く加工。`#tj-map-osm-dark` が効いている）、赤い点 1 つ（押せない・フォーカスしない）、「Google Maps ↗」は右上・高さ 46px・押せる・出典表示とも拡大縮小ボタンとも重ならない、出典 10px、スマホはドラッグ不可で `touch-action: auto`、地図の読み込み中のずれ 0、横のはみ出しなし、エラーなし。スマホでは開いた時点で Leaflet を読み込まない（ACCESS は 1,516px 下）。座標の無い asagiri-jam は元の枠とリンクのまま、地図の部品の通信なし。目視（PC・スマホのスクリーンショット）。
- `check_festival_access_map.mjs` 成功（ready 6 件、座標あり 110 / なし 72 ページ、遅延確認 2 回）。わざと壊す試験 3/3 で失敗を検出（リンクを右下に戻す→出典と重なり／目印を押せる状態に→検出／遅延読み込みを外す→スマホで検出）。`check_venue_maps.mjs`（22 ピン・都市の絞り込み）成功。
- build 冪等性（601）・版数・回帰・CMS プレビュー・`git diff --check`・JA/EN 行数一致（Codex 実行）。
- 変更前の本番を測った値（比較用、CDP の通信量で外部ドメインも含む、キャッシュ無効）: labyrinth PC 開いた時 1,311KB／ACCESS まで下げた後 1,614KB、スマホ 1,158KB／1,804KB。ala PC 911KB／1,045KB、スマホ 910KB／1,143KB。Lighthouse（モバイル・CI と同じ設定、2回）: ala 0.62 / 0.87、labyrinth 0.59 / 0.80（1回目はどちらも遅く、ばらつきが大きい）。
- 1回目の push は preflight の「モバイルの言語切替」35/36（`375px /: hamburger missing`）で止まった。今回の変更とは無関係の、検査の待ち方の問題: 開いてから決まった 600ms だけ待ってメニューのボタンを1回探していた。トップは CSS の読み込みを待つインラインスクリプトの後ろにナビがあるため、混雑で CSS が遅いとナビまで読み込まれていない。CSS を 1.5 秒遅らせる試験で旧版は 12/36（同じ `hamburger missing`）、修正版は 36/36。修正（Codex、`tmp/spec-mobile-toggle-wait*.md`）: ページの切り替わり（パス・readyState・ボタン）を外側から最大 15 秒待ち、本体の中でもボタンを最大 10 秒待つ。評価のエラーで全体を止めない。単独 2 回・CPU 高負荷で 2 回とも 36/36。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 検査は決まった時間を待って1回だけ見るのではなく、条件がそろうまで待つ（`check_mobile_language_toggles.mjs`）。
- 地図・外部タイルのように重い部品は、画面に近づいてから読み込む（`IntersectionObserver`）。
- 地図の上に置く独自のリンクは、出典表示（右下）と拡大縮小ボタン（左上）を避けて右上に置く。
- 生成物の HTML を条件で出し分けるときは、条件から外れる側（今回は座標の無いフェス）が変更前と同じかを差分で確かめる。

### 未確認の類似パターン

- VENUES 一覧の地図の出典表示は 9px のまま（サイトの決まりは 10px 以上。今回は変えていない）。
- `map.html`（旧地図ページ）は `map-tiles.js?v=2` に上げただけで、表示は未確認。
- iPhone 実機での地図（動かせないこと・スクロールできること）は未確認（headless の模擬のみ）。
- 他の検査にも「`Page.navigate` の後に決まった時間だけ待つ」作りが残っている可能性がある（`check_mobile_language_toggles.mjs` 以外は未調査）。
- 本番の CARTO の地図（キーはドメイン制限付きなので本番でしか出ない）は push 後に確認する。

### 次の担当への注意・判断待ち

- **cms.js 194: 実機未確認**。push 後に Publish pipeline を流し、CMS を `?cb=` 付きで開いて記事のプレビュー（`writeArticleSimplePreview_`）が例外なく動くことを確かめる。ユーザーには Cmd+Shift+R を伝える。
- 座標の無いフェス 36 件（asagiri-jam axiom balance body-soul bonna-pot brightness car-multimedia delta-commit dots dream-festival e-groove ensou euphoria gampeki halola-camp ishinoko iyasaka-rave-festival lab midnight-cult-rave mirrorball-village music mutek one-music-camp one-park-festival one-park-riverfes parallel-world pure-rave rare-groove samsara signal sub-tide takarajima-beach-cleaning-party topia wonderfruit-kyoto wormhole yamauto）は地図が出ない。CMS で開催回の座標を入れれば出る（データの判断はユーザー）。
- push 後: 本番で同じ方法で重さと Lighthouse を測り直し、上の値と並べる。

### 2026-10-28 座標の無いフェスでは ACCESS の地図の枠を出さない（Claude 検証・コミット）

### 実施

- ユーザー判断「座標がないフェスのは ACCESS MAP の表示はなくそう」。直前のコミット（51aa6995c）で残した飾りの枠（格子＋決まった位置の赤い点＋会場名で検索する「Google Maps ↗」）を、座標の無いフェス（JA/EN 各 36 件）で出さないようにした（Codex、`tmp/spec-festival-map-nogeo.md`）。ACCESS の見出し・会場名の行・FEATURE STORY は残す。座標のあるフェスの地図は変えていない。
- `check_festival_access_map.mjs` の静的な確認を逆に（座標の無いページは `festival-map` を持たず、地図の script も読まない。ACCESS の欄・見出し・会場名の行はある）。AUDIT §9-110 に追記。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- 生成物の差分は座標の無いフェス 72 ページの ACCESS の枠だけ（68 件＋FEATURE STORY のある 4 件）。座標のあるページの ACCESS は差分 0。
- 手元（CDP、`tmp/fmapverify.mjs` を NOGEO=1 で）64/64: asagiri-jam（PC 1440・EN 390）は地図の枠なし、見出し「Access」と会場名（静岡 / Shizuoka）が見える、見出しとの間隔 29px、地図の部品の通信なし、横のはみ出しなし。座標のある labyrinth の地図の確認は前回どおりすべて成功。目視（PC・スマホ）。CSS は変えていない（間隔は地図があるときと同程度）。
- `check_festival_access_map.mjs` 成功。わざと asagiri-jam に枠を戻すと「座標なしページに ACCESS の地図枠があります」で失敗することを確認（戻した後は元どおり）。
- build 冪等性（601）・版数・回帰・CMS プレビュー・`git diff --check`（Codex 実行）。
- 前回分の本番確認（578fd44d6）: labyrinth の地図が CARTO の黒い地図で出る（出典に CARTO、PC/スマホ/EN、64/64）。重さは同じ方法で比較し、スマホで開いた時点は +3〜4KB、ACCESS まで下げると +80〜138KB、PC で開いた時点は +91〜261KB（PC では ACCESS が最初の画面のすぐ下にあり、すぐ読み込む）。CMS の記事プレビュー（cms.js 194、パスワードは入れずに入力欄を閉じて確認）は例外なし・detail.css?v=91 を読み込む。Lighthouse CI 成功。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 実際の位置を示せない飾りの地図は出さない（座標がある時だけ地図を出す）。

### 未確認の類似パターン

- 会場の詳細ページ（`LP/venues/*.html`、womb で確認）: 飾りの地図の枠は無く、「Google Maps」へのボタンと住所の横のリンクだけ（確認済み・0件）。アーティストの詳細ページにも地図の枠は無い（確認済み・0件）。
- iPhone 実機での地図は未確認（headless の模擬のみ）。

### 次の担当への注意・判断待ち

- 座標の無いフェス 36 件は ACCESS に会場名だけが出る。地図を出したいフェスは CMS で開催回の座標（LAT / LNG）を入れて Publish する（データの判断はユーザー）。
- cms.js 194: Publish pipeline（run 40684491624、2026-10-28 12:01 開始）は成功、データの変化なしでコミットは増えていない。CMS の記事プレビューも本番で確認済み（上の検証）。前のエントリの「実機未確認」はこれで解消。CMS を開くときは Cmd+Shift+R。

### 2026-10-28 VENUES 一覧の地図: 出典表示を 10px に・下の文字が出典に重なっていたのを解消（Claude 検証・コミット）

### 実施

- ユーザー「進めて」（前の報告の「VENUES 一覧の地図の出典表示が 9px のまま。そろえる場合はお知らせください」への返答）。Codex で修正（`tmp/spec-venues-attribution.md`、`tmp/spec-venues-labels.md`）。
  - `venues-phase3.css` の `.leaflet-control-attribution` を 9px → 10px（フェス詳細の地図とそろえる。AUDIT §9-105 のスマホで 10px 未満をなくす決まり）。`venues-phase3.css?v=8`。
  - 確認中に、地図の下の「TAP A PIN · …」「Open full map →」（`bottom:12px`）が出典表示に重なっているのを見つけた（本番の 9px のときから。PC は右の1つ、スマホは2つとも）→ `bottom:30px` に上げた。
  - `check_venue_maps.mjs` に「地図の下半分のラベルの下端 ≦ 出典表示の上端」「出典表示 10px 以上」を追加（縦の位置関係で見るので画面幅によらない）。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- 手元（CDP、`tmp/vattr2.mjs`）9/9: PC 1440・スマホ 390（JA/EN）で出典 10px・地図の中・1行、重なり 0、横のはみ出しなし。同じ検査で本番（9px）は重なりあり（前からの問題だったことの確認）。目視（PC・スマホ）。
- `check_venue_maps.mjs` 成功（22 ピン・絞り込み・出典 10px・ラベルの下端 872 ≦ 出典の上端 884）。わざと「Open full map →」を `bottom:12px` に戻すと失敗（890 > 884）を確認、戻した後は元どおり。
- build 冪等性（601）・版数・回帰・`git diff --check`・JA/EN 行数一致（Codex 実行）。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 地図の上に重ねる文字は、地図の部品（出典表示・拡大縮小ボタン）の位置を避けて置く（フェス詳細の地図と同じ考え方）。

### 未確認の類似パターン

- 「Open full map →」（スマホで高さ約 23px）は押せる範囲 44px の決まりを満たしていない（今回は位置だけ直した）。
- CMS の地図（`cms.css` の `.loc-map .leaflet-control-attribution`）は 9px のまま（公開ページではないため対象外）。
- `map.html`（全画面の地図）の出典表示・重なりは未確認。

### 次の担当への注意・判断待ち

- なし（本番の確認は push 後に行う）。

### 2026-10-29 TOP の THIS WEEK・スマホの記事見出しの折り返し・フェス詳細の地図の拡大率・VENUES の地図のリンク・トップへのリンクを「/」に・文章ガイド（Claude 検証・コミット）

### 実施

- ユーザーの指摘と「残っている作業を 1〜4 も進めて」を受けて、Codex で実装（`tmp/spec-ui-batch-1029.md`、手直し `tmp/spec-ui-batch-fix.md`）。経緯と数値は AUDIT §9-111。
  1. **TOP の THIS WEEK**: 「今日始まるもの」だけ → 「今日から 7 日間に開催期間が重なるもの」。0 件のときの案内文、件数の行を絞り込みごとに。`top-phase2.js?v=11`・`top-phase2.css?v=12`。
  2. **記事の見出し（h2）**: 装飾タグで包まれた見出しにも読点のまとまりを適用、スマホでは `clamp(26px, 7.5vw, 34px)`。`detail.css?v=92`、cms.js 195（記事プレビューの版）。
  3. **フェス詳細の地図**: 最初の拡大率 12 → 14（本番で 12〜15 を比べて決定）。`festival-map.js?v=2`。
  4. **VENUES の「Open full map →」**: 本番でも押せなかった（`pointer-events: none`）のを直し、見た目を変えずに押せる範囲 44px。`venues-phase3.css?v=10`。
  5. **トップへのリンク**: 日本語ページの `/index.html` を正式な URL の `/` に（1,114 本）。英語は canonical が `/en/index.html` なので据え置き（1,112 本）。
  6. **文章ガイド** §8 に「記事の冒頭に事実をまとめる」「大きく直したら UPDATED（更新日）」を追記（Claude）。`docs/aio/AIO_LLMO_2026-10-28.md` の表も更新。
  7. **座標の無いフェス 36 件の調査**（読み取りだけ、サブエージェント）: `reports/festival-coords-2026-10-29.md` / `.json`。高 11・中 8・低 17。データの食い違いも同じファイルに列挙（直していない）。
- 新しい検査: `check_top_this_week.mjs`、`check_article_heading_breaks.mjs`、`check_top_links.py`。`check_festival_access_map.mjs`（拡大率 14）・`check_venue_maps.mjs`（リンクの当たり判定）を追加修正。

### コミット

- このエントリを含むコミット（redesign/magazine → main）。

### 検証

- 手元（127.0.0.1:8095、CDP）: TOP の THIS WEEK は JA/EN とも festival-de-frue / parallel-world / denki-bodhisattva の 3 件、「3 events · this week」、ロゴと TOP は JA `/`・EN `/en/index.html`。denki の h2 は 29.25px で「空港に反対した拠点が、 / いまはカルチャーの / 場になっている」。地図は拡大率 14。「Open full map →」は中心・上端 10px 上・下端 9px 下とも押せる（本番は 3 点とも地図に当たっていた）。目視（TOP・見出し・地図）。
- `check_top_this_week.mjs`（JA/EN × 390/1440、0 件の日 2026-01-01 で案内文）、`check_article_heading_breaks.mjs`（22 記事 × 360/390/430px、34px に戻すと 10 件で失敗）、`check_festival_access_map.mjs`、`check_venue_maps.mjs`、`check_top_links.py`、`check_mobile_language_toggles.mjs`（36/36）、`test_phrase_breaks.mjs` 成功。
- build 冪等性（601）・版数・回帰・内部リンク・CMS プレビュー・`git diff --check`・JA/EN 行数一致（Codex 実行）。
- `bash scripts/preflight.sh`: pre-push で省略なしに実行（push が通った＝全件成功）。

### 変更したパターン

- 日付の絞り込みは「開始日の一致」ではなく「期間の重なり」で判定する。
- 見出しの折り返しは、文字の大きさと1行に入る文字数を合わせて考える（スマホで約 12 文字）。
- `pointer-events: none` の重ね表示の中のリンクは、リンク自身に `pointer-events: auto` が要る。
- 内部リンクは正式な URL（canonical）へ向ける。

### 未確認の類似パターン

- CMS の「本番表示」プレビューは見出しに文節・読点の処理をしていない（前からの違い。見出しの見え方が本番と少し違う）。
- 記事タイトル（h1）・h3 は今回の検査の対象外（タイトルは 80 件中おかしな折り返し 0 件を確認済み）。
- iPhone 実機（Safari）での見出し・TOP の確認は未実施（headless の模擬のみ）。
- ほかのページの重ね表示（`pointer-events: none`）の中のリンクは未調査。

### 次の担当への注意・判断待ち

- **cms.js 195: 実機未確認**。push 後に Publish pipeline を流し、CMS の記事プレビューを確かめる。ユーザーには Cmd+Shift+R。
- 座標の入力はユーザーの判断待ち（高 10 件は「進めて」を受けて入力に進む。MUTEK は会場データの食い違いがあるため保留、中 8 件は中身を見せてから）。
- データの食い違い（E-GROOVE の都道府県、MUTEK 2026 の会場と会期、YAMAUTO の座標と住所と 2026 年の開催回、Brightness の都道府県欄、PURE RAVE の Instagram、実在を確認できない 6 件 など）は `reports/festival-coords-2026-10-29.md` を見てユーザーが判断する。

### 2026-10-29 座標の無いフェスのうち 10 件の開催回に座標を入力（本番データ、Claude 入力・ユーザーが Publish）

### 実施

- `reports/festival-coords-2026-10-29.md` の確からしさ「高」11 件のうち 10 件の EDITIONS に LAT / LNG を入力（ユーザー「進めて」）。手順は memory の production-data-safe-edit（AUDIT §9-109）: ユーザーがログインした Chrome で CMS を開き、`get_sheet` で行全体を読む → 控えを取る → 1 件試す → 行全体＋LAT/LNG で `update_row` → 読み直して照合、を 1 件ずつ。
  - asagiri-jam-2025（6 行目）35.3842, 138.5839 / body-soul-2026（12）35.6417, 139.7784 / bonna-pot-2024（14）34.8034, 138.7953 / brightness-2025（15）35.5044, 139.7724 / delta-commit-2025（21）35.8485, 138.2664 / dots-2026（22）42.9321, 141.4131 / dream-festival-2025（23）35.4198, 138.901 / one-music-camp-2025（60）34.9593, 135.2925 / one-park-festival-2026（61）36.0652, 136.2195 / one-park-riverfes-2025（62）35.4381, 137.0324
- **入れなかったもの**: MUTEK（2026 年の会場が MoN Takanawa に変わったのにデータは「渋谷」のまま。座標だけ入れると表示と地図が食い違う）。「中」8 件はユーザーが中身を見てから。会場名（LOCATION / LOCATION_JA）は 9 件で空のまま（日本語名だけを入れると英語ページに日本語が出るため、入れていない）。
- **続けてユーザーの判断で直したもの**（「SuB-TiDe はシークレットのまま。MUTEK は MoN Takanawa で。E-GROOVE は秋田。YAMAUTO は山水人エコビレッジ。で進めて」）:
  - EDITIONS e-groove-2026（24 行目）: PREF Hokkaido → Akita
  - EDITIONS mutek-2026（95）: LOCATION / LOCATION_JA 渋谷 → MoN Takanawa、ADDRESS 東京都港区三田3-16-1、LAT/LNG 35.6394, 139.7417
  - FESTIVALS mutek（3）: location / location_ja / address / lat / lng を 2025 年の渋谷（道玄坂）から MoN Takanawa に
  - EDITIONS yamauto-2025（90）: LOCATION Ecotopia YAMAUTO、LOCATION_JA 山水人エコビレッジ、ADDRESS 滋賀県高島市朽木生杉、LAT/LNG 35.3587, 135.7912（生杉集落の位置。施設は地図データに無い）
  - FESTIVALS yamauto（20）: location Sansuibito Eco Village → Ecotopia YAMAUTO（山水人の読みは「やまうと」。公式の英語表記）、address 朽木針畑 → 朽木生杉、lat/lng 35.3056, 135.8369（約 7km 離れた別の集落）→ 35.3587, 135.7912
  - 出典: MoN Takanawa の住所は Time Out 東京・ウォーカープラス等で一致、YAMAUTO は公式 yamauto.net/access（「会場：滋賀県高島市朽木生杉・エコトピア山水人」／英語「Ecotopia YAMAUTO, Kutsuki Oisugi」）
  - SuB-TiDe はシークレットのまま（座標を入れない）。MUTEK の会期（データ 11/22 まで、公式 11/20〜23）はユーザー未判断のため変えていない。

### コミット

- このエントリを含むコミット（本番データの変更そのものはシートへの書き込み。サイトへの反映はユーザーの Publish Now で完了）。

### 検証

- 書き込み前: 10 行とも EDITION_ID が 1 行だけ・LAT/LNG が空。書き込み後: 10 行とも変わったのは lat / lng / LAT / LNG だけ（日程・都道府県・状態などは 1 文字も変わらず）、表の行数 118 のまま。dream-festival の LNG は表で 138.901 と表示（同じ値）。
- 続けて直した 5 行も、1 件ずつ読み直して想定どおりの欄だけが変わったことを確認（FESTIVALS は lastEditedAt の自動更新のみ追加）。表の行数は EDITIONS 118・FESTIVALS 92 のまま。MUTEK・YAMAUTO の紹介文（日本語・英語）・出演者・日程・画像などは控えと一致。
- ユーザーが Publish Now（2026-10-29 13:32 `cms: publish data.js` d930b5c8b → Publish pipeline 成功 → `chore: regenerate detail pages` ec9346b78）。公開データに 10 件の座標と 5 行の修正がすべて入っていることを `LP/data/editions.json` / `data-hub.js` で確認。
- 本番の詳細ページ: 座標を入れた 12 件（10 件＋MUTEK＋YAMAUTO）すべてに地図（`data-lat/lng` が入力値と一致）。ACCESS は MUTEK「MoN Takanawa · 東京」、YAMAUTO「山水人エコビレッジ · 滋賀」、E-GROOVE「日本庭園 · 秋田」（地図なし）。CDP で mutek（JA/EN）・asagiri-jam・yamauto（EN）・dots が CARTO の地図・目印 1 つ・拡大率 14・エラーなし（10/10）。EN は「MoN Takanawa · Tokyo」「Ecotopia YAMAUTO · Shiga」。

### 変更したパターン

- 本番データの書き込みは 1 件試してから残りを 1 件ずつ、毎回読み直して照合（前回と同じ）。

### 未確認の類似パターン

- 確からしさ「中」8 件・MUTEK・会場名が空の 9 件は未入力（判断待ち）。

### 次の担当への注意・判断待ち

- データの食い違い（`reports/festival-coords-2026-10-29.md` の末尾）はユーザーの判断待ち。Balance の会場は LABYRINTH と同じ宝台樹キャンプ場だが、調べた座標と LABYRINTH の座標が約 3.6km 離れている（どちらかがずれている可能性。OpenStreetMap の検索では施設が引けない）。
