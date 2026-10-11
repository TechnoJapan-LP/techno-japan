# Minimal Collective ベンチマーク — 「データベース」から「メディア」へ、Techno Japan の設計提案

作成: 2026-10-10 / 状態: **第1弾を本番反映（2026-10-11、AUDIT §9-105）。WP-1 型／WP-3 埋め込みは見送り、LATEST 帯は却下** / 設計: Claude、実装は Codex
対象: https://www.minimalcollective.digital/（Webflow 製。本拠オランダ、2016 年から）
計測: 記事「The weight of a room」「Not a utopia」「Premiere: OK EG - Lily」、/editorial、/、/about、/events、/projects、/join-the-collective。
headless Chrome（PC 1440 / スマホ 390）で DOM の位置・サイズ・書体を数値で取得（`.scratch/mc/dom-*.txt`）。
比較対象: https://techno-japan.media/articles/treak-2026-info.html（2026-10-10 公開の最新記事）。

> 前回（Ocult Mag、2026-10-07）で「記事の頭・写真幅」を変えた試作（WP-A）はユーザー判断で却下された。
> **この提案では写真幅と見出しの位置は触らない。** Minimal Collective から取るのは「レイアウト」より先に
> **「メディアとしての骨組み」**（フォーマット・頻度・記事の文法・回遊・参加の入口）である。

---

## 0. 結論（先に3行）

1. Minimal Collective が「メディア」に見えるのは、**フォーマット（型）が4つに絞られ、月12本のペースで、同じ骨格の記事が並ぶ**から。見た目の洗練は結果であって原因ではない。
2. Techno Japan は **フェス・アーティスト・会場の DB と「開催予定」** という、彼らに無い資産を持っている。DB を捨てるのではなく、**DB の項目を「記事と同じ札（タグ）の付いたカード」として編集面に混ぜる**のが転換の核。
3. 最初にやるのは「記事ページの改装」ではなく **①フォーマットの定義 ②週2本の編集カレンダー ③記事の文法（短題＋副題、リード文）**。これは CMS の列と運用で足りる。レイアウトは最後。

---

## 1. 実測（同じ方法で並べる）

### 1-1. 記事ページ（PC 1440）

| | Minimal Collective | Techno Japan（TREKs 記事） |
|---|---|---|
| 最上部 | 写真 1080×396（画面幅の 75%、中央） | 写真 1144×644（ヒーロー、見出しを重ねる） |
| 見出し | 76.5px PolySans、**「短題: 副題」**（副題は斜体） | 76px Bebas Neue、1行「TREKS \| 京都・久多の森が…」 |
| 署名の行 | 「words by / Victoria Mazzone」「published / June 26, 2026」「reading time / 14 minutes」の **3組のラベル＋値** | WORDS BY / PUBLISHED / READING TIME（同じ3組。既にある） |
| 札（タグ） | 「EDITORIAL」＋「Interview」の2枚。**上の札＝面、下の札＝フォーマット** | カテゴリの札1枚（FESTIVAL&RAVE 等） |
| リード文 | **27px の1段落**（本文の 1.5 倍）。本文に入る前の「この記事は何か」 | 無し（excerpt は要約欄でヒーローの下に小さく） |
| 本文 | 18px / 行幅 693px / 段落 12〜14 本 / 約 1,800〜2,000 語 | 16.56px / 行幅 680px / 段落 10 本前後 |
| 章見出し | h4 31.5px、記事内 4 本 | h2 32px Bebas、記事内 4 本（同等） |
| 引用 | **76.5px（見出しと同じ大きさ）を右に寄せて、1記事に2本** | プルクオート 22〜30px 中央（10/10 に追加済み） |
| 写真 | 本文幅 693 / 1080 / 1440 全幅の3段階、縦位置は 693×1040 | 本文幅 680（FIG 番号つき） ※幅の変更は WP-A で却下済み |
| 埋め込み | **Vimeo（全幅 1440×810）**、Premiere 記事は SoundCloud / Bandcamp の再生枠 | 無し（CSP は YouTube のみ許可、挿入ボタンも無し） |
| 末尾 | 「Related articles」**3本を写真 693×390 ＋ 49.5px の見出しで1本ずつ横並び** | RELATED STORIES 3本（サムネ 120×90 のリスト）→ 関連フェス → タグ → ニュースレター |
| ページ高さ | 13,560px | 9,153px |

### 1-2. 一覧（/editorial と /news.html）

| | Minimal Collective | Techno Japan |
|---|---|---|
| 絞り込み | **「Format」**（Premiere / Extended Feature / Interview / Guide）と **「Last posted」** | カテゴリ（URL の `category` / `tag` / `sort`） |
| カードの大きさ | **2種**: 特集＝写真 693×390 ＋ 49.5px 見出し ＋ 2行要約、Premiere＝正方形 333×333 のジャケット ＋ 31.5px 見出し | 1種 |
| 札 | 「EDITORIAL」＋フォーマット＋日付、13.5px | カテゴリ札 |
| 見出しの文法 | 「短題: *副題*」（副題は斜体。短題は 2〜3 語） | 1本の長い見出し |

### 1-3. TOP

| | Minimal Collective | Techno Japan |
|---|---|---|
| 1画面目 | 宣言文 76.5px「Operating at the intersection of music, art and technology」＋ **右から流れる横帯**（EVENT / EDITORIAL Premiere / Extended Feature / PROJECT の札つき） | 宣言文 52px ＋ タグの流れ ＋ STORIES |
| 2画面目 | 「Editorial」特集 2本（写真・札・日付・見出し・要約）＋「All editorials」 | STORIES 一覧 |
| 3画面目 | 「Events」自主イベント ＋ **「Pre-register for future events」**（メール登録） | UPCOMING EVENTS（開催予定の DB。彼らに無い資産） |
| 4画面目 | Premiere の格子（ジャケット） | ARTISTS / VENUES |

### 1-4. 運用の数字（/editorial の日付と札から）

| 月 | 本数 | 内訳 |
|---|---:|---|
| 2026-07 | 6 | |
| 2026-08 | 12 | |
| 2026-09 | 12 | |
| 2026-10（10日まで） | 6 | |
| 直近 26 本の内訳 | | **Premiere 20 / Extended Feature 4 / Interview・Guide 少数** |

→ **月 12 本 ＝ 週 3 本。うち 3/4 が Premiere（新曲の先行公開＝短い記事＋再生枠）**。
長文の特集は週1本弱。**量を Premiere で、深さを Extended Feature で**作っている。

### 1-5. メディアとしての部品（記事以外）

| 部品 | Minimal Collective | 役割 |
|---|---|---|
| About | 「音楽・アート・テクノロジーの交差点で活動する集団。協働プロジェクト・イベント・フォーマットを起こす」2016〜 | **何者かを1文で** |
| Events | 自主イベント（Post-Space × Oude Kerk、FIBER Festival 等）と過去開催 | メディアが「場」も持つ |
| Projects | Horst / De School / ONE との協働 | 他ブランドと組む実績 |
| Pre-register | 「将来のイベントに事前登録」メール欄 | 読者→参加者 |
| Join the collective | 寄稿・参加の応募フォーム（応募多数で返信遅延の注記） | 読者→作り手 |
| Store（準備中） | 事前登録 | 収益 |

### 1-6. Techno Japan が持っていて、彼らに無いもの（残す・活かす）
- **フェス 89 / アーティスト 137 / 会場 22 の DB と、開催回（EDITIONS）・LINEUP・開催予定。** 彼らの Events は自分たちの催し 1 本だけ。
- 日英の2言語、黒の世界観、Bebas の見出し、FIG 索引、イベントカード／カレンダー／アーティストカードのブロック。
- Google ニュースの索引に既に載っている（2026-10-10 実測、64 件）。

### 1-7. 取らないもの
明るい地色・PolySans・物販・Cookie バナー・Webflow のページ遷移演出。Techno Japan の識別性（黒／赤／Bebas）を落とす。
**写真幅と見出し位置**（WP-A で却下済み）。

---

## 2. 設計 — 「DB の上にメディアの骨組みを載せる」

### WP-1 フォーマット（型）を4つに定め、札を2段にする（運用＋CMS、最優先）

Minimal Collective の記事は「EDITORIAL（面）」＋「Premiere（型）」の2枚の札を持つ。型が決まると、**書き方・長さ・頻度・カードの大きさ**が決まる。

| 型（案） | 中身 | 長さ | 頻度 | カード |
|---|---|---|---|---|
| **PREMIERE / MIX** | 日本のアーティスト・レーベルの新曲先行公開、または招待ミックス。再生枠＋200〜400字＋アーティストカード | 短 | **週1** | 正方形（ジャケット） |
| **FEATURE** | 長文（インタビュー・現場レポート・論考）。1,800〜3,000字、写真 6〜10、引用 2 | 長 | 月2 | 大（写真＋要約） |
| **GUIDE** | 月次フェスまとめ、週末ガイド、会場ガイド（既存の GUIDE） | 中 | 月2 | 大 |
| **NOTE** | 速報・告知（既存の NEWS）。300〜600字＋イベントカード | 短 | 随時 | 小 |

- データ: ARTICLES の CATEGORY は 6 択のまま、**`FORMAT` 列を新設**（上の4値）。CATEGORY＝面（テーマ）、FORMAT＝型。
- CMS: FORMAT のプルダウンと、型ごとのテンプレ（既存の 📄 テンプレを型に合わせて組み直す）。
- 記事提案 AI には型を指定して出させる（`ARTICLE_BODY_SPEC_FOR_AI.md` に FORMAT 欄を追加）。
- **週2本**（PREMIERE/MIX 1 ＋ FEATURE/GUIDE/NOTE 1）＝月 8 本を最低線にする。Minimal Collective の月 12 本は Premiere で量を稼いでいる。同じ構造。

### WP-2 記事の文法: 「短題: 副題」とリード文（運用＋生成、CMS の列1つ）

- **見出しを「短題」＋「副題」に分ける**（例: `TREKs` ／ `京都・久多の森が、3日間だけ "COMMUNE" になる`）。
  Minimal Collective は `Post-iconoclasm: Reinterpreting the lost…` の形で、カードでも記事でも副題を斜体で出す。
  Techno Japan は既に「TREKS | 京都・…」と `|` で書いているので、**TITLE を `|` で分けて描画**すれば列を増やさずに済む（副題は DM Sans 細字、短題は Bebas）。
- **リード文（デッキ）を 1 段落、本文の 1.5 倍で置く**: EXCERPT をそのまま使う。ヒーローの下、署名の行の前。
  ※ WP-A でも提案したが却下理由が「写真幅と見出し位置」か「リード文」か分からないため、**テスト環境でリード文だけを単独で見せて判断を仰ぐ**。
- 署名の行は既存の 3 組（WORDS BY / PUBLISHED / READING TIME）で同等。変更しない。

### WP-3 Premiere を成立させる部品: 再生枠の埋め込みブロック（ショートコード、1本）

- `[[embed|URL]]` を追加。SoundCloud / Bandcamp / YouTube / Mixcloud の URL を、公開時に `<iframe>`（16:9 または再生バー高）に変換。
  許可ドメイン以外は公開を止める（既存の参照切れと同じ）。
- CSP の `frame-src` に `https://w.soundcloud.com https://bandcamp.com https://www.mixcloud.com https://player.vimeo.com` を追加（全 449 ページ共通の CSP なので build の定数で1箇所）。
- CMS に「▶ 埋め込み」ボタン（URL を貼るだけ）。プレビューでも再生枠が出る。
- これが無いと PREMIERE / MIX 型は作れない。**WP-1 の前提**。

### WP-4 一覧（/news）を「編集面」にする: 型の絞り込みと2種のカード

- 絞り込みを **FORMAT**（PREMIERE / FEATURE / GUIDE / NOTE）と **最終更新順**に。カテゴリは第2階層へ。
- カードを **2種** に: FEATURE / GUIDE ＝ 写真 16:9 ＋ 札 2 枚 ＋ 日付 ＋ 見出し（短題＋副題）＋ 2行要約。PREMIERE ＝ 正方形ジャケット ＋ 短い見出し。NOTE ＝ 写真なしの1行。
- 既存の `news.html` の JS（`category` / `tag` / `sort` の URL パラメータ）に `format` を足す形で、構造は変えない。

### WP-5 記事の末尾: 「次の1本」を大きく3本（レイアウト、小）

- RELATED STORIES の 120×90 サムネのリストを、**写真 16:9（本文幅）＋ 見出し 42px の3本縦並び**にする（Minimal Collective の Related articles と同じ型）。
- 関連フェス・タグ・ニュースレターの順は変えない。Ocult の WP-C（4段階の回遊）は保留のまま。

### WP-6 TOP: 「最新の動き」を型の札つきで混ぜる（DB→メディアの接点）

- 1画面目の宣言文の直下に、**横に流れる帯**を置く: 最新の記事（FEATURE / PREMIERE）、直近の開催予定（EVENT）、更新された会場・アーティスト（VENUE / ARTIST）を**同じカードの形で、左上に型の札**。
  これが「DB の更新」を「メディアの動き」として見せる唯一の場所になる。
- 2画面目は FEATURE 2本（写真・札・日付・短題＋副題・要約）。UPCOMING EVENTS は3画面目に残す（固有資産）。
- ※ Ocult の WP-B と重なる。WP-B は「宣言文を縮める」が主眼で、ここは「型の札で混ぜる」が主眼。宣言文は残す。

### WP-7 参加の入口（ページ 2 枚、フォームは既存の formsubmit）

- **「Contributors / 寄稿する」ページ**: AUTHORS シートを使った筆者一覧 ＋ 寄稿の応募フォーム（press@ 宛）。Minimal Collective の Join the collective。
- **「次のイベント情報を受け取る」**: UPCOMING EVENTS の横にメール欄（ニュースレターと同じ formsubmit、`_subject` だけ変える）。Pre-register for future events。
- 「Projects（協働）」「Store」は TJ にまだ実体が無いので作らない。実績ができたら。

---

## 3. 進め方（1フェーズ＝Codex への1依頼。レイアウトは最後）

| 順 | WP | 触るもの | 検証 |
|---|---|---|---|
| 1 | WP-1 FORMAT 列とテンプレ | シート列追加（ユーザー）、cms.js、DATA_SCHEMA、AI 仕様書 | CMS で保存→再表示 |
| 2 | WP-3 埋め込みブロック | article-shortcodes.js、build（CSP）、detail.css、cms.js | 実記事コピーで SoundCloud / Bandcamp が再生枠で出る |
| 3 | WP-2 短題＋副題、リード文 | build（描画）、news.html カード | **テスト環境で先に見せる**（WP-A の教訓） |
| 4 | WP-4 一覧の絞り込みと2種カード | news.html | PC / スマホ、JA / EN |
| 5 | WP-5 末尾の関連3本 | build、detail.css | 同上 |
| 6 | WP-6 TOP の帯 | index.html、data-hub.js | 同上。1画面目の写真・リンク数を Ocult の表と同じ方法で再計測 |
| 7 | WP-7 寄稿・事前登録 | 新ページ 2 枚、formsubmit | 送信→受信 |

- 各フェーズ: preflight 全件 → `git worktree` ＋ `serve_local.py` のテスト環境で実物を見せる → 判断 → 本番。
- **運用（週2本）は WP-1 と同時に始める**。レイアウトが整うのを待たない。Google ニュースの索引には既に載っており、足りないのは本数（§AUDIT 9-100 以降の実測）。

## 4. 判断してほしいこと

1. 型の4つ（PREMIERE/MIX・FEATURE・GUIDE・NOTE）と、週2本の最低線でよいか。
2. 「短題: 副題」を TITLE の `|` で表すか、列を分けるか。
3. リード文（デッキ）は WP-A で一度却下された要素。**単独でもう一度テスト環境で見る**か、見送るか。
4. 埋め込み（WP-3）の許可ドメイン: SoundCloud / Bandcamp / YouTube / Mixcloud / Vimeo でよいか。
