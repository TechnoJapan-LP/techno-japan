# Techno Japan — Magazine Redesign 実装仕様書

作成：2026-10-22 ／ デザインモック：Claude Design キャンバス「Techno Japan — TOP Redesign」
モックのソース：`docs/design-mock/`（`*.dc.html` ＋ `tj-data.js` ＋ `img/`）

このドキュメントは **Claude Code / Codex がブランチ上で段階的に実装するための仕様** です。
本番の構造（`LP/data.js` の ARTICLES / ARTISTS、`LP/data/*.json`、CMS）はそのまま使います。データ移行は不要です。

---

## 0. 進め方（必ず守る）

1. `main` から `redesign/magazine` ブランチを切る。`main` には直接コミットしない。
2. 下の **フェーズ順** に実装し、フェーズごとにローカルで確認してからコミットする。
3. 既存ページの「修正」ではなく **新しいテンプレートへの置き換え** として作る。既存 CSS（`common.css` / `detail.css` / `article-fx.css`）は部品単位で流用してよいが、ページ構造はモックに従う。
4. モックの `.dc.html` は Claude Design の実行環境（`support.js` / `DCLogic`）前提のファイル。**そのまま本番に置かない**。`{{...}}` はデータ差し込み、`sc-for` / `sc-if` はループと条件分岐、`class Component` の `renderVals()` がデータ整形ロジック。この3つを読んで、本番のテンプレート（静的 HTML 生成 or 既存の JS 描画）に移植する。
5. 迷ったらモックの見た目を正とする。モックのキャンバスでは全インタラクションが動くので、挙動の確認はキャンバス（プレイモード）で行う。
6. 画像のパスはモックでは `img/xxx.webp`（`docs/design-mock/img/`）。本番では `images/...` の既存派生（`images/derivatives/card/...`）を使う。

---

## 1. デザインシステム（全ページ共通）

### 色
| 用途 | 値 |
|---|---|
| 背景 | `#080808` |
| 文字（Ink） | `#f0ede8` |
| メタ情報 | `rgba(240,237,232,.62)` |
| アクセント | `#ff2d2d`（●、日付、選択中、エンティティリンク、読了バー） |
| アクセント弱 | `#a82f31`（hover のみ） |
| 罫線 | `rgba(240,237,232,.12)` ／ 強め `.3` |

### 書体
- 見出し：**Bebas Neue**（`.disp`）uppercase、`line-height:.95`、`letter-spacing:.01em`
  - ページ見出し 168px（スマホ 88px）／ セクション見出し 44px ／ カード 26–34px
- 本文：**DM Sans 300** ＋ **Noto Sans JP 300**。本文 16px / 行間 1.95 / 最大幅 720px
- メタ：**Space Mono** 10px、`letter-spacing:.15em`、uppercase（`.mono`）
- Bebas Neue / DM Sans / Space Mono は本番と同じセルフホスト（`/fonts/`）を使う。
- **Noto Sans JP は Google Fonts から読み込む**（2026-10-22 ユーザー決定。300/400/500/700、`display=swap`、preconnect。日本語は自前配信だと数 MB になるため）。
  - 2026-10-23 計測（スマホ 390px・dpr3、ネットワークの実バイト）: TOP 577KB → 1,138KB、記事 1,398KB → 2,268KB（増分はほぼ書体ファイル）。
    「端末の書体を使う」「太さを1種類に絞る」案を示したうえで、ユーザーが**今のまま（4種類）**を選択（2026-10-23）。表示開始の遅れは小さい（display=swap）。

### 共通部品
- **固定ヘッダー `.hdr`**：`position:sticky; top:0; z-index:40; background:rgba(8,8,8,.72); backdrop-filter:blur(12px)`、高さ 64px。左ロゴ（ワードマーク、高さ 15px）／中央ナビ（Top / News / Festivals / Artists / Venues / About、等幅 10px）／右に Search ボタン・JA/EN・ハンバーガー。**左のアイコンと赤い日付は無し**。スマホでは Search を隠し（メニュー内にある）、ハンバーガーのみ。
- **動く背景 `.tjbg`**：本番の `.tj-bg` と同じ（グレイン画像 ＋ 80px グリッドのドリフト 20s ＋ 赤いグロー 18s ＋ スキャンライン 8s）。`position:fixed; inset:0; z-index:-1`。ページ本体は `background:transparent`。`prefers-reduced-motion` で停止。
- **コンテナ `.wrap`**：max-width 1360px、左右 padding 40px（スマホ 16px）。
- **フッター**：罫線の上にワードマーク／ナビ（News / Festivals / Artists / Venues / About / Apply / Writer）／Instagram・Threads。下段に `© 2026 Techno Japan` と `Japan's Underground, Curated.`
- **検索オーバーレイ（Search.dc.html）**：全画面、articles / festivals / artists / venues を横断検索。タブ（All / Stories / Festivals / Artists / Venues）、候補チップ、Esc で閉じる。ヘッダーの Search とメニューの検索ボタンから開く。
- **スマホメニュー（Menu.dc.html）**：全画面オーバーレイ。検索ショートカット → 大きな Bebas リンク（番号付き、現在ページは赤）→ 掲載申請 / ライター募集 → JA/EN 切替 → Instagram / Threads → タグライン。
  - **JA/EN 切替はメニューの表示だけでなくページ全体を切り替える**（2026-10-22 ユーザー決定）。押すと同じページの他言語版（`/xxx.html` ⇔ `/en/xxx.html`）へ移動し、ヘッダー・メニュー・本文・フッターがすべてその言語になる。移動先の言語のページ内リンクは同じ言語のページを指すので、以後もその言語のまま。`localStorage` でラベルだけ切り替える方式は使わない。開閉はフェード＋リンクが順に上がってくる。
- **画像**：全ページカラー表示。hover で `scale(1.04)` 0.7s。アーティストもモノクロにしない。
- **チップ `.chip`**：等幅 10px、枠 `.18`、選択中は赤枠＋赤文字。
- **ピル `.pill`**：赤い●＋等幅テキスト、枠 `.35`。

### ブレークポイント
- `max-width:900px` をスマホ扱い。グリッドは 1 カラム（記事は 2 カラム）。

---

## 2. ページ別仕様

### 2.1 TOP（Main.dc.html）
1. 固定ヘッダー → **マーキー**（Bebas 18px、40s linear、`position:sticky; top:64px; z-index:49`、黒背景）
2. **リードカルーセル**（最新 4 記事、スクロール固定）
   - セクション高さ ≈ 4 × ビューポート。内側は `position:sticky; top:64px`。
   - 横並びトラックを `translate3d` で移動。スクロール位置からターゲットを計算し、`requestAnimationFrame` で lerp（係数 0.055）追従。イージングは smoothstep、各パネルに dwell .1。
   - パネル画像は `translate3d(d*14%) scale(1.16)` のパララックス、中央以外は `--dim` で暗くする。
   - インジケータ（ドット）と `01 / 04` カウンター。
   - 4 記事を見終わるまでページは下にスクロールしない（固定のまま横に切り替わる）。
3. **FUTURE**：CMS の「トップ掲載」（`ARTICLES[].featured` が true）に印を付けた 2 記事を固定で表示（2026-10-22 ユーザー決定。記事 ID をコードに書かない）。
   - 印付きが 3 本以上ある時は新しい順に 2 本。2 本に満たない時は空けずに、カテゴリ GUIDE の新しい記事で埋める（安全策）。
   - FUTURE に出す記事は、リードカルーセル（最新 4 記事）から除く（同じ記事を 2 回出さない。カルーセルは残りの新しい順 4 本）。
   - 同じ `featured` は NEWS 一覧の 3 本枠の優先表示（§2.2）にも使われる。
4. **UPCOMING**：直近 6 フェス（3 列 × 2 行）、フィルタチップ。日付は `10.22–10.25` 形式（同月でも月を繰り返す）。スマホでは場所を UPCOMING の左に表示。
5. **Stories**：記事グリッド（スマホ 2 列）、中央に `ALL STORIES →` のアウトラインボタン。
6. **Festival Index**：一覧（スマホでは場所をステータスの横に）。
7. **Artists · Playing soon**：直近フェス出演者 12 名をプールし 6 名をランダム表示。Shuffle ボタン。次の出演フェス名・日程を薄い白で表示。
8. **Venues**、**Newsletter**、フッター。

### 2.2 NEWS 一覧（News.dc.html）
- ページ見出し `News` ＋ 件数・更新日。カテゴリチップ。
- リード（最新 1 本、画像 3:2 ＋ ピル・日付・見出し・サブ・抜粋）
- 2 本横並び（16:9）→ **3 本（4:3）：`ARTICLES[].featured` が true の記事を優先**し、メタに `Feature ·` を付ける。残りは新着順。
- 以降は横長リスト（サムネ 260px ＋ 見出し、本番の related-story-card.is-wide の流用）。`Load more`（+6）。

### 2.3 NEWS 詳細（NewsDetail.dc.html）
- **ヒーロー**：全幅写真 ＋ 下からのグラデーション ＋ カテゴリピル ＋ Bebas 見出し ＋ サブ。
  - スマホ：Words by / Published / Reading time を**画像右端に縦書き**（`writing-mode:vertical-rl; transform:rotate(180deg)`、下から上に読む、ラベルと値は同じ 10px 等幅、ラベルは薄いグレー）。
- **読了プログレスバー**：ヘッダー直下に 2px。`article-fx.css` の `.fx-progress` / `.fx-progress-fill` と同じ。記事ブロック（リード〜Share）の読了率で `scaleX` を更新。
- **本文 2 カラム（PC）**：`grid-template-columns: minmax(0,1fr) 300px`。左にリード（18px）・本文（max 720px）・Share。右に **サイドカラム `aside`**（`position:sticky; top:88px`）：Words by / Published / Reading time → Festival（名前 ＋ Festival details →）→ Overview → All stories →。
  - **サイドカラムは Related Stories の手前で追従を止める**：本文ブロックと同じグリッドコンテナに入れ、Related Stories / 関連フェスは別コンテナにする。
  - スマホ：1 カラム。サイドの Words by 等は非表示（ヒーローに縦書きで出す）。Overview 非表示。Festival は**小さな横長カード**（96px 正方形サムネ ＋ 日程 · Upcoming/Archive ＋ フェス名 ＋ 場所 ＋ →）。Category は PC・スマホとも非表示、All stories → のみ。
- **Overview（PC のみ）**：記事に紐づくフェス（`festivalId`）から自動表示。DATE（DATE_START – DATE_END）／VENUE（LOCATION, CITY）／ARTISTS（LINEUP。artists DB にいる人はリンク）／GENRE／SOUND（festivals に `sound` があれば）／STATUS（editions の STATUS が announced 以外なら赤）。
- **本文**：`ARTICLES[].body` をそのまま描画。h2 / h3 / h4 / ul / 外部リンク（別タブ）。`/artists/` `/festivals/` `/venues/` へのリンクは `.ent`（赤・点線下線）。
  - **h2 の下に赤い線**：`article-fx.css` と同じ（2px、画面に入った時に左から伸びる）。
  - **画像の `data-layout`（CMS 既存属性）を CSS で実装**（本番は未実装）：
    - `contained`：本文幅いっぱい
    - `compact`：70% 幅、中央
    - `left` / `right`：46% 幅で float、直後の段落が横に回り込む。`h2/h3/h4/.info` の前で `clear:both`
    - `alt` があれば figcaption（等幅 10px、薄いグレー）
    - スマホでは全て全幅
- **Related Stories**（3 本、横長カード）→ **関連フェスティバル**（横スクロール）→ フッター。

### 2.4 FESTIVALS 一覧（Festivals.dc.html）
- 見出し ＋ `N upcoming · M indexed`。フィルタ：Season（Upcoming / Archive / All）／Type（All types / Festival / Rave）／View（Grid / List）。
  - スマホ：1 行目 Season、2 行目に Type（左）と View（右端、下揃え）。チップの余白を少し詰める。
- **Next up**（リード）：画像 3:2 ＋ 日程（Bebas 72px、**折り返し禁止**、スマホは `clamp(36px,13vw,56px)`）＋ 名前 ＋ 場所 ＋ 説明。
- Grid（4 列 → 1100px 以下 3 列 → 760px 以下 2 列）／List（日付・名前・場所・種別・ステータス。スマホは場所をステータスの横に）。

### 2.5 FESTIVAL 詳細（FestivalDetail.dc.html）
- ヒーロー → Fact strip（DATE / LOCATION / PREF / GENRE / LINEUP / EDITIONS）→ ラインナップ（artists DB とリンク）→ 過去の開催（editions）→ 関連記事 → フッター。

### 2.6 ARTISTS 一覧（Artists.dc.html）
- ジャンルチップは**本番 artists.html と同じ順**：ALL, TECHNO, HOUSE, MINIMAL, EXPERIMENTAL, AMBIENT, ELECTRONIC, LIVE ＋ データにあるその他。Origin（ALL / JAPAN / INTERNATIONAL）。
- **FEATURED 3 名（スクロール固定カルーセル）**：TOP と同じ仕組み。出演予定（`next`）が近い順に 3 名。各パネルは 4:5 画像 ＋ Featured 01 · ジャンル ＋ 名前（Bebas 大）＋ 拠点 ＋ Next · フェス名 日程 ＋ bio ＋ Profile →。ドットと `01 / 03`。スマホは縦積み（bio 非表示）。
- グリッド 5 列（スマホ 2 列）：正方形写真 ＋ 名前 ＋ ジャンル ＋ 拠点。FEATURED の 3 名は除く。

### 2.7 ARTIST 詳細（ArtistDetail.dc.html）
- 4:5 写真 ＋ 名前 ＋ JA/EN 切替（bio / bio_en）＋ リンク（Instagram / SoundCloud / Bandcamp）＋ Facts（Based in / Genre）。
- Appearances（`FESTIVALS.LINEUP ↔ ARTISTS.ID`）→ Related（同ジャンル 5 名、スマホは 4 名）→ Stories。

### 2.8 VENUES 一覧（Venues.dc.html）
- 見出し ＋ City / Type チップ。
- **マップ ＋ Featured**（7:5 グリッド）：
  - マップは本番 `map.html` と同じ **Leaflet 1.9.4 ＋ CARTO dark_all**（読めない時は OSM を反転表示 → それも無理なら自前描画のオフライン地図）。ズームコントロール非表示、スクロールズーム無効。
  - ピンは `venues.json` の LAT / LNG で全件。クラブ＝丸 `.club-pin`、バー＝菱形 `.bar-pin`（本番と同じ CSS）。
  - City / Type で絞ると地図のピンも絞られ、`fitBounds` で自動ズーム。
  - **ピンに hover（スマホはタップ）で右の Featured がそのベニューに切り替わる**。選択中のピンは白く光り名前ラベルが出る。
  - Featured カード：画像（flex で高さを合わせる）＋ Featured venue ＋ 名前 56px ＋ エリア・タイプ ＋ 説明（4 行で省略）。
- グリッド 4 列：4:3 写真 ＋ 名前 ＋ 都市 ＋ タイプ ＋ ジャンル。

### 2.9 VENUE 詳細（VenueDetail.dc.html）
- **写真**：`GALLERY` が 2 枚以上あれば 12 カラムの 3 枚スプレッド（大 1 ＋ 小 2）。無ければ 21:9 の 1 枚。
- Head：ピル（タイプ）＋ エリア ＋ 名前（Bebas 大）＋ かな ＋ 説明 ＋ ボタン（Website / Instagram / Google Maps）。
- **Facts**：Type / Area / Capacity / Address / Access / Genre / **Hours（HOURS があれば）** / **Features（FEATURES があればピルで）**。
- Upcoming at …（イベント DB 接続予定）→ Nearby（同じ都市 4 件）→ Stories。

### 2.10 ABOUT（About.dc.html）
- ヒーロー（`Techno Japan` Bebas 168px ＋ `Japan's Underground, Curated.` ＋ DB 件数）→ マーキー → 01 About → 02 Statement（Authentic / Selective / Borderless / Independent、5:7 の 2 カラム）→ 03 What we cover（4 タイル、件数自動）→ 04 Instagram（最新 4 投稿）→ 05 Contact（フォーム）。本文テキストは本番 `about.html` と同一。

### 2.11 APPLY（Apply.dc.html）
- 本番 `submit.html` の内容：掲載について（5 項目）／掲載の目安（ジャンルチップ）／掲載までの流れ（3 ステップ）／申請フォーム／Recently listed（直近フェス 4 件）。
- **フォームはサイト内のデザインのまま Google フォームへ直接 POST**（§4）。

### 2.12 WRITER（Writer.dc.html）
- 本番 `writers.html` の内容：Why write（7 項目）／Formats（Report / Interview / Guide / News）／書いている人（authors ＋ 記事数）／応募フォーム（Google フォームへ POST、§4）。

---

## 3. CMS・データの追加（本番側の作業）

| 対象 | 追加項目 | 用途 |
|---|---|---|
| `festivals`（CMS ＋ `data/festivals.json`） | `SOUND`（テキスト、例 `Funktion-One`） | 記事詳細 Overview の SOUND 行 |
| `venues`（CMS ＋ `data/venues.json`） | `GALLERY`（画像パスをカンマ区切り、最大 2） | ベニュー詳細の 3 枚スプレッド |
| `venues` | `HOURS` / `FEATURES` | **既にある**。詳細ページで表示するだけ |
| `articles`（`data.js`） | `featured`（boolean） | NEWS 一覧の 3 本枠に優先表示。**既にある** |
| `venues` | `LAT` / `LNG` | **既にある**。マップのピン |

CMS（`cms.html` / `cms.js`）に SOUND と GALLERY の入力欄を足し、JSON 書き出しに含める。

---

## 4. フォーム → Google フォーム直接送信

APPLY と WRITER のフォームは、サイトのデザインのまま Google フォームに送る（方式 B）。

1. 対象の Google フォーム（APPLY は現在の `submit.html` が飛ばしている `https://docs.google.com/forms/d/e/1FAIpQLSfh7ahIgtN5zflxeSbKBGLqTB07SS1DbCFpm0SrCU-5-PLDvg/viewform`、WRITER は `writers.html` のもの）を開き、「事前入力した URL を取得」または HTML ソースから各設問の `entry.XXXXXXXX` を控える。
2. 送信先は `.../formResponse`。`fetch` で `mode:'no-cors'`、`method:'POST'`、`Content-Type: application/x-www-form-urlencoded` の `URLSearchParams` を送る（レスポンスは読めないので、送信後は受付メッセージに切り替える）。
3. 対応表（例、APPLY）：

| サイトのフィールド | Google フォーム |
|---|---|
| イベント / フェス名 `a-name` | `entry.______` |
| 種別 `a-type` | `entry.______` |
| 日程 `a-date` | `entry.______` |
| 会場 / 都道府県 `a-venue` | `entry.______` |
| ジャンル `a-genre` | `entry.______` |
| 公式 URL / チケット `a-url` | `entry.______` |
| ラインナップ `a-lineup` | `entry.______` |
| 紹介文 `a-desc` | `entry.______` |
| 担当者名 `a-contact` | `entry.______` |
| Email `a-email` | `entry.______` |
| 備考 `a-note` | `entry.______` |

Google フォーム側の設問を増減した時はこの表を更新する。フォームの必須項目（`required`）は Google 側と揃える。
4. 送信成功後の表示：`Received` ＋ 受付メッセージ（モックと同じ）。

---

## 5. 実装フェーズ

| # | 内容 | 完了条件 |
|---|---|---|
| 1 | 共通部品：デザイントークン（CSS 変数）、固定ヘッダー、動く背景、フッター、検索オーバーレイ、スマホメニュー（JA/EN） | 全ページで同じヘッダー／メニュー／検索が動く |
| 2 | TOP | カルーセル・FUTURE・UPCOMING・Stories・Festival Index・Playing soon・Newsletter |
| 3 | 一覧：NEWS / FESTIVALS / ARTISTS / VENUES | フィルタ、Grid/List、FEATURED カルーセル、Leaflet マップ連動 |
| 4 | 詳細：NEWS / FESTIVAL / ARTIST / VENUE | 読了バー、h2 赤線、サイドカラム、画像 data-layout、Overview、Facts（Hours / Features）、ギャラリー分岐 |
| 5 | ABOUT / APPLY / WRITER ＋ Google フォーム直接送信 | 3 ページの表示とフォーム送信 |
| 6 | CMS：SOUND / GALLERY の入力欄と JSON 出力 | CMS から入力 → サイトに反映 |
| 7 | 仕上げ：OGP / sitemap / 既存 URL の維持、`prefers-reduced-motion`、Lighthouse | 旧 URL が全て新テンプレートで開く |
| 8 | **英語版の完成**（2026-10-22 ユーザー要望「デザイン変更が終わったら全て英語で見られるように」） | EN の全ページで、画面に見える日本語が 0（固有名の日本語表記を除く。下記） |

各フェーズの確認は、モックのキャンバスの該当アートボード（PC 1440px / スマホ 390px）と並べて行う。

### フェーズ 8：英語版の完成
- **UI の文言**：全ページ共通部品・各テンプレートの固定文言（見出し・ボタン・ラベル・FAQ・空状態・エラー）を EN ページでは英語にする。フェーズ 1〜7 で新しく作る文言は、作る時点で JA/EN の両方を用意する（後回しにしない）。
- **データ**：EN ページは `en || primary || ja` の規則で、英語が無い項目だけ日本語に戻る。英語が無い項目を洗い出して埋める。
  - 2026-10-22 時点の棚卸し：記事 21 本・アーティスト 134 人・フェス 91 件・会場 22 件の説明文は英語あり。
    残りは「日本語名のフェス 6 件（英語表記 3 件のみ）」「開催回の英語の場所（LOCATION）が無い 28 件」「記事本文中の日英併記ラベル」など。
  - 翻訳は Claude が下書き → ユーザーが確認 → CMS で入力（または全項目を読んでから `update_row`）。本番データへの書き込みは AGENTS.md の決まりに従う。
  - 固有名（フェス・会場の日本語の正式名称）は、英語表記を決めて `name_en` に入れる（AGENTS.md「日本語名のものだけいずれ英語表記を検討する」）。
- **検査**：EN の全ページを実ブラウザ相当で開き、画面に見える日本語を数える検査を preflight に加える（増えたら失敗）。

---

## 6. モックの更新（参考）

`.scratch/tj-design-sync/sync.mjs`（gitignore 下）が `LP/data` と `data.js` からモック用データ（`design-data.json` ＋ `img/`）を書き出す。lat / lng、hours / features / gallery、記事本文と本文画像にも対応済み。本番データを変えた後にキャンバスを更新したい時は `node .scratch/tj-design-sync/sync.mjs` を実行し、Claude に「同期して」と伝える。
