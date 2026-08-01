# Techno Japan — データスキーマ定義書 v1.0

> このドキュメントは Techno Japan の唯一のデータ定義です。リポジトリの `CLAUDE.md` に貼り付けるか、`docs/DATA_SCHEMA.md` として置いて CLAUDE.md から参照してください。
> データソースは Google スプレッドシート「LP」(1つのファイル)。Webサイト・探すアプリ・フェス単体アプリは、すべてこのシートから書き出した JSON を読む。**データの二重管理を絶対にしない。**

---

## 0. 全体原則

1. **Single Source of Truth**: すべてのエンティティデータはスプレッドシート「LP」に置く。コード側にデータをハードコードしない。
2. **エンティティはIDで参照する**: シート間の紐づけは必ずID(slug)で行う。表示名での紐づけは禁止。
3. **表示レイヤーとデータレイヤーの分離**: ARTICLES / AUTHORS / BODY_HISTORY は編集(CMS)レイヤー。VENUES / ARTISTS / FESTIVALS / EDITIONS / LINEUPS / EVENTS はデータレイヤー。
4. **バイリンガル原則**: 言語別カラム(`_JA` / `_EN`)で持つ。シートやファイルを言語で分けない。
5. **未確認情報**: 確定していない値は STATUS や editorNotes で管理し、本文に「TBA」等を直書きしない。日本語コピーの未確認箇所は ［要確認］ を付ける。

## 1. 共通ルール

### 1.1 ID (slug) 規約

- 形式: `[a-z0-9-]+`(小文字英数字とハイフンのみ)。スペース・大文字・連続ハイフン(`--`)・前後ハイフン禁止。
- 一度発行したIDは変更しない(URLになるため)。表示名の修正はNAME側で行う。
- **自動slug化の仕様**(ラインナップ取り込み時):
  - `&` は `and` に変換(例: `Antal & Hunee` → 単一アーティストとしては登録しない。→ LINEUPS の ACT_LABEL 参照)
  - 括弧は中身ごと除去せず、ACT_LABEL に保持したうえで、slugは主体名から生成
  - アクセント付きラテン文字は基底文字に変換(`Suze Ijó` → `suze-ijo`。**文字を脱落させない**)
  - 日本語名はローマ字化してslugにする(`青` → `ao`)。自動変換できない場合はスタブを作らず **要手動対応リストに出力** する。日本語表記は NAME_JA に必ず保持する
- 既存の不正ID(スペース・大文字入り: `Eric Cloutier`, `DJ Yazi` 等)は移行時に一括修正する(§7)。

### 1.2 バイリンガルカラム

- 命名: `NAME_JA` / `NAME_EN`、`DESC_JA` / `DESC_EN`、`BIO_JA` / `BIO_EN`。
- **現状のDESC/BIOカラムの中身は英語**なので、移行時に `_EN` へ移し、`_JA` を新設する(§7)。
- 片言語しかない場合は空欄のまま(フォールバック表示はフロント側の責務)。

### 1.3 GENRE

- 正規リスト: `TECHNO / HOUSE / MINIMAL / BASS / AMBIENT / EXPERIMENTAL / ELECTRONIC / PSYCHEDELIC / DISCO / LIVE / MIX / OTHERS`
- 区切りは半角スペース挟み中黒 **「 · 」** に統一(現状はカンマと中黒が混在 → 移行時に統一)。
- 正規リスト外の値はビルド時に警告。

### 1.4 STATUS

- 値: `published` / `draft` / `archived`。**空欄は `draft` とみなす**(=サイトに出ない)。
- 現状ほぼ空欄なので、公開済みコンテンツには移行時に `published` を明示的に入れる。

### 1.5 地域カラム

- `PREF`: 47都道府県の英語表記(先頭大文字: `Tokyo`, `Niigata`)。入力規則(プルダウン)必須。
- `AREA`(VENUESのみ): 街区名(`SHIBUYA`, `DAIKANYAMA` 等)。こちらもプルダウン化。
- 現状の CITY カラムは PREF に改名。`Kanto`(地方名)や `Kawasaki`(市名)、`kochi`(小文字)は移行時に正規化。

### 1.6 メタカラム(全シート共通・末尾に配置)

`STATUS | ogImage | metaDescription | TAGS | editorNotes | lastEditedBy | lastEditedAt`
- 命名はcamelCaseに統一(EVENTSの全大文字表記は移行時に修正)。
- editorNotes は内部メモ。**サイトには絶対に出力しない**(fetchスクリプトでJSON化の対象外とする)。

### 1.7 住所の表記

- `ADDRESS`（現行FESTIVALSのG列、現行VENUESのI列）は、**日本語の公式表記**で保持する。
- 日本語表記を正とする理由は、地図・ジオコーディング照合の精度、施設や主催者の公式表記への忠実性、日英2住所を保守する入力コストを考慮したためである。
- `ADDRESS` は構造化データの `PostalAddress.streetAddress` に出力する。ページ言語が英語でも、住所は日本語表記の同じ値を使用してよい。
- 将来は住所を `addressCountry` / `addressRegion` / `addressLocality` / `streetAddress` に分解し、`PREF`や市区町村を構造化して照合精度をさらに高める余地がある。現段階では既存の `PREF` / `CITY` と `ADDRESS` を無理に自動分割しない。

---

## 2. シート定義(データレイヤー)

### 2.1 VENUES(現状ほぼ完成)

| カラム | 型/例 | 備考 |
|---|---|---|
| ID | `womb` | slug |
| NAME | `WOMB` | 原文表記を保持 |
| NAME_JA | `ウーム` | 任意 |
| PREF | `Tokyo` | プルダウン |
| AREA | `SHIBUYA` | プルダウン(現状 `SHIBUAYA` 等の揺れあり → 修正) |
| TYPE | `club` / `livehouse` / `bar` | プルダウン |
| IMAGE | `images/venues/womb.jpg` | |
| GENRE | `TECHNO · HOUSE` | §1.3 |
| CAPACITY | `800` | 数値 |
| ADDRESS / LAT / LNG | | |
| URL / INSTAGRAM | | fetchスクリプトで相互混入チェック(§6) |
| DESC_JA / DESC_EN | | 現DESCは英語 → DESC_ENへ移動 |
| imagePosition | `center top` | 表示用 |
| (共通メタ §1.6) | | |

### 2.2 ARTISTS

| カラム | 型/例 | 備考 |
|---|---|---|
| ID | `dj-nobu` | slug(§1.1) |
| NAME | `DJ Nobu` | **原文の大文字小文字を破壊しない**(`Ben UFO`を`Ben Ufo`にしない) |
| NAME_JA | `青` | 日本語表記。日本語名アーティストは必須 |
| PREF / COUNTRY | `Chiba` / `Japan` | 海外アーティストはCOUNTRYのみでも可 |
| GENRE | `TECHNO` | §1.3(現状の`HOUSE / MINIMAL`区切りも中黒へ) |
| IMAGE | | |
| BIO_JA / BIO_EN | | 現BIOは英語 → BIO_ENへ |
| SCHEMA_TYPE | `person` / `music-group` | 構造化データの型。空欄は`person`。ユニットは`music-group` |
| MEMBER_IDS | `albino-sound, daigos` | `music-group`の構成員。ARTISTSのIDをカンマ区切り。設定時は`MusicGroup.member`へ出力 |
| INSTAGRAM / SOUNDCLOUD / BANDCAMP / WEBSITE | | |
| imagePosition | | |
| (共通メタ §1.6) | | |

**スタブ運用(公式仕様)**: ラインナップ取り込み時、未登録アーティストは ID+NAME のみのスタブ行として自動追加してよい。スタブは STATUS 空欄(=draft)のまま。充実したら published にする。

**B2B と ユニット/クルーを区別する**: 「複数人の名前が並んでいるか」ではなく、**独立したアクトとして流通しているか**で判定する。

| | 登録 | 表現方法 | 例 |
|---|---|---|---|
| **B2B(その場限りの共演)** | **しない** | LINEUPS の `ARTIST_IDS` に参加者を出演順に格納し、`JOIN_TYPE`(`b2b`/`&`/`vs`)で繋ぐ(§2.4) | `Sisi b2b Ouissam b2b Yamarchy`<br>`Zitto B2B Zurkin`<br>`Antal & Hunee` |
| **ユニット/クルー(独立したアクト)** | **する** | ARTISTS に1行。`SCHEMA_TYPE=music-group`、構成員が判れば `MEMBER_IDS` | `NC4K`<br>`Dungeoneering` |

判定の目安: 固有の名義でリリース・ブッキングされ、その名前自体が検索対象になるならユニット。特定の1公演のためだけの組み合わせなら B2B。迷う場合は登録しない(後から追加はできるが、発行済みIDの削除はURLを壊す)。

- ユニットを登録する場合も、`NAME` に構成員名を含めない。`NC4K(Stones Taro b2b Lomax)` ではなく `NC4K` とし、構成員は `MEMBER_IDS` で表す。
- 演奏形態(`live` / `dj`)は名前に混ぜない。LINEUPS の `PERF_TYPE` で持つ。既存の `-live-` 付き行は移行時に解体する。

**要対応: `nc4k` の二重登録**

`nc4k` が ARTISTS と lineups.json の双方に存在し、同一のアクトが2つの形で表現されている。

| 所在 | 値 | 問題 |
|---|---|---|
| ARTISTS | ID=`nc4k` / NAME=`Nc4k(Stones Taro b2b Lomax)` | NAME に構成員と `b2b` を含む。上記ルール違反 |
| lineups.json | `ACT_LABEL="NC4K (Stones Taro & Lomax)"` (ARTIST_ID 空) | 同じアクトが未解決枠として別に存在 |

`NC4K` は独立したクルーなのでユニットとして扱うのが正しい。対応方針:

1. ARTISTS の NAME を `NC4K` に整える(IDは`nc4k`のまま変更しない)
2. `SCHEMA_TYPE=music-group` を設定し、`stones-taro` / `lomax` を ARTISTS に登録のうえ `MEMBER_IDS` に接続
3. lineups.json 側の該当行は `ARTIST_IDS=nc4k` に解決し、`ACT_LABEL` は掲載原文として残す

同様の確認が必要なもの: `Dungeoneering (Albino Sound & Daigos)` はユニットとして登録すべきだが未登録。

**決定: 誤発行された B2B の URL は 404 のままにする(2026-08-01)**

B2B なのに ARTISTS に登録されていた2件を削除した。旧データの遺物で、上記ルールに反する。

| 削除したID | 実体 | 影響を受けた URL |
|---|---|---|
| `antal-hunee` | `Antal & Hunee`(共演枠) | `/artists/antal-hunee.html` と `/en/artists/antal-hunee.html` |
| `sisi-b2b-ouissam-b2b-yamarchy` | Sisi b2b Ouissam b2b Yamarchy(共演枠) | 同上2URL。**sitemap 登録済み・インデックス済み** |

計4URLが 404 になる。**リダイレクトを設定しない**と判断した。理由:

1. B2B 枠に恒久URLを与えないという上記の方針と整合する。リダイレクトを置くことは、そのURLに恒久的な意味を認めることになる
2. 適切なリダイレクト先が存在しない。出演フェスへ飛ばすのは意味的に別物(アーティストを探した人にフェスを見せる)、一覧ページへ飛ばすのは情報価値がない
3. **誤って発行されたURLにリダイレクトを与えると、誤りを固定化する。** 消えるべきものは消えるのが正しい

ID 規約違反7件の是正(§1.1)ではリダイレクトを設けたが、それとは扱いが異なる。前者は「正しいコンテンツの正しくないURL」なので移動先が存在する。後者は「存在すべきでないコンテンツ」なので移動先がない。**リダイレクトの要否は、移動先が意味的に成立するかで判断する。**

今後、同種の削除(B2B・重複・誤登録の解体)でも 404 を既定とする。

### 2.3 FESTIVALS(ブランド)+ EDITIONS(開催回)★構造変更

この節には、稼働中のスプレッドシートと移行後のデータモデルを併記する。両者を混同しないこと。

- **現在のCMS・フォーム・fetch処理を接続するとき**は、直下の「現状」を参照する。移行完了まではこちらが実際の入出力契約である。
- **新しいデータモデルの設計・移行作業**では、後段の「目標」を参照する。目標の列を、未移行の実シートに存在するものとして扱わない。
- シート連携は列位置ではなく**ヘッダー名ベース**で行う。列記号は現状確認用であり、固定的なAPIとして依存しない。

#### 現状: 稼働中のFESTIVALSシート

現在は「1フェス=1行」で、ブランド情報と開催回情報が同じ行に存在する。列構成は次のとおり。

| 列記号 | ヘッダー名 |
|---|---|
| A | ID |
| B | TYPE |
| C | NAME |
| D | DATE |
| E | LOCATION |
| F | CITY |
| G | ADDRESS |
| H | LAT |
| I | LNG |
| J | IMAGE |
| K | FLYER |
| L | HEROGRADIENT |
| M | GENRE |
| N | DESC |
| O | URL |
| P | ` TICKETURL`（先頭空白あり。`TICKETURL`へ修正予定） |
| Q | INSTAGRAM |
| R | LINEUP |
| S | EDITIONS |
| T | STATUS |
| U | ogImage |
| V | metaDescription |
| W | TAGS |
| X | editorNotes |
| Y | lastEditedBy |
| Z | lastEditedAt |
| AA | name_en |
| AB | DESC_EN |
| AC | imagePosition |
| AD | location_ja |

- `LOCATION` は既存データとの互換性を保つ英語・ローマ字表記、`location_ja` は日本語の公式会場名を保持する。日本語表示は `location_ja` を優先し、空欄なら `LOCATION` にフォールバックする。英語表示は `LOCATION` を使用する。
- GAS の `update_row` は部分更新ではない。`buildRowFromHeaders` で行全体を組み立て直し、payload にないヘッダーの値を空文字で上書きする。そのため CMS は編集時に、`location_ja` を含むシートの全フィールドを必ず payload に含める。今後列を追加するときも、シート追加と同時に CMS の読込・フォーム・更新 payload を対応させること。

#### 目標: FESTIVALSとEDITIONSの分離

現状の「1フェス=1行、DATEを上書き」構造をやめ、**恒久情報(ブランド)と開催回情報を分離**する。すでに`YAGURA 2025`のNAMEとDATE(2026年)がズレる等の実害が出ている。

**FESTIVALS(ブランド・目標)** — フェスの恒久的な情報のみ:

| カラム | 型/例 | 備考 |
|---|---|---|
| ID | `rainbow-disco-club` | **年を含めない**(`yagura-2025`→`yagura`) |
| TYPE | `festival` / `rave` | プルダウン。空欄多数 → 移行時に補完 |
| NAME | `Rainbow Disco Club` | 年を含めない |
| NAME_JA | | |
| GENRE | `TECHNO · HOUSE` | |
| DESC_JA / DESC_EN | | ブランドとしての説明 |
| URL / INSTAGRAM | | |
| IMAGE / HEROGRADIENT / imagePosition | | ブランドのキービジュアル |
| (共通メタ §1.6) | | |

**EDITIONS(開催回・目標)** — 新設シート。1開催回=1行:

| カラム | 型/例 | 備考 |
|---|---|---|
| EDITION_ID | `rainbow-disco-club-2026` | `{FESTIVAL_ID}-{EDITION}` |
| FESTIVAL_ID | `rainbow-disco-club` | FESTIVALS参照 |
| EDITION | `2026` | 年。年2回開催等は `2026-spring` も可 |
| DATE_START / DATE_END | `2026-04-17` / `2026-04-19` | ISO形式。1日開催はENDも同値 |
| LOCATION | `Higashi-Izu Cross Country Course` | 会場名 |
| LOCATION_JA | `東伊豆クロスカントリーコース` | 日本語の公式会場名。現行FESTIVALSの`location_ja`から引き継ぐ |
| VENUE_ID | | 会場がVENUESにある場合のみ(任意) |
| PREF | `Shizuoka` | プルダウン |
| ADDRESS / LAT / LNG | | |
| TICKETURL | | |
| FLYER | | 開催回ごとのフライヤー |
| STATUS | `announced` / `on-sale` / `soldout` / `finished` / `cancelled` | 開催回のライフサイクル。公開可否は共通STATUSと別カラム |
| (共通メタ §1.6) | | |

> 移行: 現FESTIVALSの各行から DATE / LOCATION / TICKETURL / FLYER 等を EDITIONS に切り出す。EDITION は DATE の年から自動推定し、NAME内の年(`ARCH 2025`等)と食い違う行は要確認リストへ(§7)。

### 2.4 LINEUPS ★新設(このプロジェクトの核)

フェス開催回 × アーティストの中間テーブル。「探すアプリ」のフィルタ、アーティストページの出演歴、フェス単体アプリのタイムテーブルすべての土台。

| カラム | 型/例 | 備考 |
|---|---|---|
| EDITION_ID | `matricaria-2026` | EDITIONS参照 |
| ARTIST_IDS | `dj-nobu, wata-igarashi` | ARTISTS参照。出演順のIDをカンマ区切り。未解決の場合は空欄可 |
| JOIN_TYPE | `b2b` / `&` / `vs` | 複数アーティスト間の接続表記。単独出演は空欄 |
| PERF_TYPE | `dj` / `live` / `hybrid` | 演奏形態。省略時`dj`。出演者名やACT_LABELへ混ぜない |
| ACT_LABEL | `Space Drum Meditation` | **掲載原文または未解決枠**。文字列を分割・解析してIDを推測しない |
| STAGE | `OCEAN STAGE` | 任意(タイムテーブル用) |
| DAY | `1` | 任意 |
| START / END | `23:00` / `25:00` | 任意。30時間表記可(§2.5) |
| SORT | `1` | 掲載順(ヘッドライナー=小さい数字) |

- B2B等は「1出演枠=1行」。参加者全員を`ARTIST_IDS`へ出演順に格納し、`JOIN_TYPE`を間に表示する。
- HTMLでは`ARTIST_IDS`の各IDを個別の詳細ページへリンクする。構造化データの`performer`も各アーティストを独立したエンティティとして出力し、B2B全体を架空のPerson/MusicGroupにしない。
- `ACT_LABEL`から`b2b`、`&`、`vs`、`live`等を実行時に抽出しない。名前自体に`&`等を含むアーティストを破壊するため、構造化は必ず専用列を使う。
- `SCHEMA_TYPE=music-group`のアーティストは`MusicGroup`として出力する。構成員データがある場合は`MusicGroup.member`へ各アーティストの`@id`を接続する。
- 移行は旧列の確実なコピーと要確認CSVの生成まで自動化し、スプレッドシートやJSONを自動更新しない。未解決名の登録・複合枠の分解は人が確認する。

### 2.5 EVENTS(クラブイベント)

| カラム | 型/例 | 備考 |
|---|---|---|
| ID | `underground-frequency-20260517` | **新設**(現状IDなし)。`{slug}-{YYYYMMDD}` |
| NAME / NAME_JA | | |
| DATE | `2026-05-17` | ISO |
| VENUE_ID | `club-metro` | VENUES参照(推奨) |
| VENUE_NAME | `NAEBA SKI RESORT` | VENUESにない一回限りの会場用フォールバック。VENUE_IDと排他 |
| PREF | | VENUE_ID指定時はVENUESから導出(入力不要) |
| TIME | `23:00 - 05:00` | 30時間表記可(`28:00`=翌4時)。表記は `HH:MM - HH:MM` に統一 |
| DESC_JA / DESC_EN | | |
| LINEUP | `dj-nobu, wata-igarashi` | **artist IDのカンマ区切り**(現方式を維持。イベントは小規模なので中間テーブル不要) |
| LINK | チケット/告知URL | |
| (共通メタ §1.6) | | camelCaseに改名 |

- LINEUPのIDはビルド時にARTISTS存在チェック(現状 `mayurashka`, `cabanne` が孤児参照)。

### 2.6 フォーム申請の取り込み

フェスティバル掲載申請フォームの回答は、列位置ではなく**ヘッダー名ベース**で取り込む。フォーム回答シートの列追加・並べ替えや、FESTIVALSシートの列移動があっても、列記号に依存してはならない。

| フォーム項目 | FESTIVALS列 | 備考 |
|---|---|---|
| 1. フェスティバル名 | NAME → ID を生成 | §1.1の命名規則に従いスラッグ化 |
| 2. 開催日 / 3. 終了日 | DATE | `YYYY-MM-DD` または `YYYY-MM-DD/YYYY-MM-DD` |
| 4. 会場名 | LOCATION | |
| 5. 都道府県 | CITY | 英語側を採用（「群馬県 / Gunma」→ `Gunma`） |
| 6. 会場住所 | ADDRESS | LAT/LNGは編集部が別途取得 |
| 7. 公式サイトURL | URL | |
| 8. 公式Instagram | INSTAGRAM | |
| 9. チケット販売URL | TICKETURL | |
| 10. ジャンル | GENRE | 編集部が最終判断 |
| 11. 紹介文（日本語） | DESC | |
| 12. 紹介文（英語） | DESC_EN | |
| 13. ラインナップ | LINEUPSタブへ | ARTIST_ID付与は編集部 |
| 14. プレスキット・素材URL | IMAGE / FLYER | CMSの「Image from URL」経由。自動命名されるため手動リネーム不要 |
| 15. 備考 / 16. 掲載許諾 | （取り込まない） | 回答シートに記録として残す |
| （自動） | STATUS | 必ず`draft`で作成する |

#### 取り込み原則

- フォーム経由で作成した行は、例外なく`STATUS=draft`とする。人間が内容を確認し、`published`へ変更するまで公開しない。
- 日付・会場・出演者などの事実確認は編集部が行う。フォーム回答だけを根拠に自動公開しない。
- GENREの確定、ARTIST_IDの付与、LAT/LNGの取得は編集部の確認工程で行う。
- ラインナップの表示名からIDを推測したり、B2B・複合出演枠を文字列解析で分割したりしない。§2.4の規則に従う。

---

## 3. シート定義(CMSレイヤー)

### 3.1 ARTICLES

| カラム | 型/例 | 備考 |
|---|---|---|
| ID | `transcendence-2026-report` | slug(§1.1)。**対象+年+種別**の形式。フェスIDと同名にしない |
| TITLE / TITLE_EN | | 現TITLEは日本語 → JA正とし、TITLE_ENに英訳 |
| CATEGORY | `REPORT` / `INTERVIEW` / `NEWS` / `FEATURE` | プルダウン(現`category`を改名・統一) |
| DATE | `2026-05-20` | 公開日(ISO)。**現状のDATE/date/PUBLISHATの3重複を一本化** |
| AUTHOR_ID | `techno-japan` | AUTHORS参照(現`author`テキストと`AUTHORID`を一本化) |
| IMAGE | `images/articles/transcendence-2026.webp` | ファイル名もslug準拠 |
| cardRatio | `auto` / `4:5` / `1:1` / `3:2` / `16:9` / 空 | **トップページのカード**での画像表示比率。空欄なら従来の見た目のまま。`auto`は元画像の縦横比で切り抜かない |
| heroRatio | `auto` / `4:5` / `1:1` / `3:2` / `16:9` / 空 | **記事詳細ページのヒーロー**での画像表示比率。空欄なら16:9。縦長写真は`auto`推奨 |
| READTIME | `2` | 分。ビルド時にbodyから自動計算も可 |
| festivalId | `transcendence` | 関連フェスのID。設定するとフェス詳細ページ（SPA/静的とも）に RELATED STORIES として記事カードが表示される |
| body_en | HTML | 英語版本文。**title_en か body_en がある記事だけ `/en/articles/` が生成される**。CMSの「✨ 本文をまるごと英訳」でAI下書き生成可 |

**多言語ページ生成**: メインURL（`/articles/` `/festivals/` `/artists/` `/venues/`）は日本語（lang=ja）、`/en/` 配下に英語版を生成。相互に hreflang を宣言し、x-default は英語版。フェス/アーティスト/ヴェニューは常に両言語生成（`DESC_EN` / `bio_en` / `name_en` を使用、無ければフォールバック）。ナビ右端に JA/EN トグルが出る。

**本文内リンク（ショートコード）**: BODY 中に `[[festival:rural]]` / `[[artist:dj-nobu]]` / `[[venue:womb]]` / `[[article:id]]` と書くと、表示時に各詳細ページへのリンクに変換される。表示名はデータから自動で引く。`[[artist:dj-nobu|ノブさん]]` のように `|` でラベル指定も可。CMSエディタの「＠ ID」ボタンから検索して挿入できる。
| FEATURED | `TRUE` / 空欄 | トップ掲載フラグ |
| EXCERPT / EXCERPT_EN | | |
| body | HTML | セル上限5万字に注意。超える場合はGoogle Docs参照方式に移行を検討 |
| RELATED_FESTIVALS | `transcendence` | ★新設。フェスIDのカンマ区切り。フェスページに関連記事を自動表示 |
| RELATED_ARTISTS / RELATED_VENUES | | ★新設。同上 |
| (共通メタ §1.6) | | EVENTSと同様、camelCaseに統一 |

- **VIEWSカラムは廃止**(手入力の閲覧数は維持不能。必要ならアナリティクスから取得)。
- body内の画像は `images/articles/` 配下に統一。`lh3.googleusercontent.com` 等のDrive直リンクは権限・仕様変更で破損するため禁止。
- 記事本文は日本語を正とし、英語版はTITLE_EN/EXCERPT_EN+(必要なら)body_enで管理。

### 3.2 AUTHORS / BODY_HISTORY

**BODY_HISTORY**(記事本文のバージョン履歴・システムテーブル):

| カラム | 型/例 | 備考 |
|---|---|---|
| savedAt | ISO datetime | 保存時刻 |
| articleId | `transcendence-2026-report` | ARTICLES参照。**記事IDを変更したら履歴側も一括置換すること** |
| title | | 保存時点のタイトル |
| bodySnapshot | HTML | 保存前の本文全体 |

- 保持ポリシー: 1記事につき直近10件まで(超過分はスクリプトで削除)。全文スナップショット方式はファイル肥大の原因になるため。
- AUTHORSは現行運用を維持。
- **AUTHORS・BODY_HISTORY・editorNotes は公開ビルドに含めない。**「ウェブに公開」もデータレイヤーのタブのみに限定する。

---

## 4. データパイプライン

```
Google Sheets「LP」
   └─(ウェブに公開: データレイヤーのタブのみCSV公開)
scripts/fetch-data.mjs
   ├─ 各タブのCSVをfetch(下記gid表)
   ├─ パース → バリデーション(§6)
   └─ data/*.json に書き出し(gitコミットする)
site/ = data/*.json を読んで静的生成
将来のアプリ = 同じ data/*.json(またはそれを返すAPI)を読む
```

公開CSV URL(確認済み・fetch-data.mjsで使用):

```
BASE = https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub?single=true&output=csv
FESTIVALS: &gid=818164718
VENUES:    &gid=525830431
ARTISTS:   &gid=648440679
EVENTS:    &gid=959929754
EDITIONS / LINEUPS: 新設後にgidを追記
```

- data/*.json はコミットする(シート障害時もビルド可能・変更履歴がgitに残る)。
- 取得は sheet名ではなく **gid指定**(タブ名変更に強い)。タブの並び順には依存しない。

## 5. JSON出力仕様

- `data/venues.json`, `data/artists.json`, `data/festivals.json`(EDITIONS・LINEUPSをネスト), `data/events.json`
- festivals.json は「ブランド + editions[] + 各editionのlineup[]」の形に結合して出力:

```json
{
  "id": "matricaria",
  "type": "festival",
  "name": "MATRICARIA",
  "genre": ["TECHNO", "HOUSE", "AMBIENT"],
  "desc": { "ja": "...", "en": "..." },
  "editions": [
    {
      "id": "matricaria-2026",
      "edition": "2026",
      "dateStart": "2026-05-29",
      "dateEnd": "2026-05-31",
      "location": "Naeba Greenland",
      "locationJa": "苗場グリーンランド",
      "pref": "Niigata",
      "lineup": [
        {
          "artistIds": ["dj-nobu", "wata-igarashi"],
          "joinType": "b2b",
          "perfType": "dj",
          "actLabel": null,
          "sort": 1
        }
      ]
    }
  ]
}
```

- `editorNotes` / `lastEditedBy` / AUTHORS / BODY_HISTORY は出力しない。
- STATUSがpublished以外のレコードは(プレビュービルドを除き)出力しない。

## 6. バリデーション(fetch-data.mjs に実装)

エラー(ビルド停止):
- ID形式違反(`[a-z0-9-]+`以外、連続ハイフン)/ ID重複
- 参照切れ: LINEUPS.ARTIST_IDS内の各ID、LINEUPS.EDITION_ID、EDITIONS.FESTIVAL_ID、EVENTS.VENUE_ID、EVENTS.LINEUP内ID
- DATE形式違反(ISO以外)、DATE_START > DATE_END
- LINEUPS.ARTIST_IDSが複数なのにJOIN_TYPEが空欄

警告(ビルド継続・レポート出力):
- GENREが正規リスト外/区切り文字違反
- PREF・AREAがプルダウン値以外
- URLカラムに `instagram.com`、INSTAGRAMカラムにそれ以外のドメイン
- DESC_JA・DESC_EN両方空/publishedなのに画像なし
- NAMEに年が含まれる(FESTIVALS)
- EDITIONとDATEの年の不一致
- LINEUPS.ARTIST_IDSが単一なのにJOIN_TYPEあり
- LINEUPS.PERF_TYPEが`dj` / `live` / `hybrid`以外
- LINEUPS.ACT_LABELのみでARTIST_IDSが空欄（要確認一覧へ）
- ARTISTS.SCHEMA_TYPEが`person` / `music-group`以外
- ARTISTS.MEMBER_IDS内の参照切れ、または`person`にMEMBER_IDSが設定されている

## 7. 移行チェックリスト(Phase 0)

実データ監査(2026-07-11)で確認した修正項目。上から順に。

**構造(スクリプトで実施)**
- [ ] EDITIONSシート新設、FESTIVALSから開催回情報を切り出し(§2.3)
- [ ] LINEUPSシート新設、FESTIVALS.LINEUP文字列をパースして移行(§2.4)
- [ ] EVENTSにIDカラム追加、VENUE→VENUE_ID/VENUE_NAME分離(§2.5)
- [ ] 全シート: DESC/BIO(英語)→ `_EN` へ移動、`_JA` カラム新設
- [ ] EVENTSのメタカラム名をcamelCaseに統一
- [ ] CITY → PREF 改名+値の正規化(`Kanto`→実際の県、`Kawasaki`→`Kanagawa`、`kochi`→`Kochi`)
- [ ] GENRE区切りを「 · 」に統一(FESTIVALSはカンマ/中黒混在)

**ID修正(要注意・URLに影響)**
- [ ] ARTISTS末尾の不正ID約20件をslug化(`Eric Cloutier`→`eric-cloutier`, `DJ Yazi`→`dj-yazi`, `Adhémar`→`adhemar`, `Doltz. -live-`→`doltz` 等)
- [ ] 破壊された名前の復元: `Antal  Hunee`→B2B解体、`Nc4k Stones Taro  Lomax`→`NC4K`、`Suze Ij`→`Suze Ijó`、`Ben Ufo`→`Ben UFO`、`Dj Maria.`→`DJ Maria.`、`AdhéMar`→`Adhémar`
- [ ] B2B行・`-live-`行を解体してLINEUPSのACT_LABEL/SET_TYPEへ
- [ ] 消えたアーティストの追加: `青`(ARCHラインナップ、slug要手動決定)
- [ ] FESTIVALSのID/NAMEから年を除去(`yagura-2025`→`yagura` 等)。EDITION側に年を移す

**データ修正(手動)**
- [ ] MATRICARIA: DESCの「Fukushima's evolving cultural landscape」を修正(会場はNaeba/Niigata)
- [ ] VENT: DESCの「basement club in Shibuya」を修正(南青山)
- [ ] circus-tokyo: AREA `SHIBUAYA`→`SHIBUYA`
- [ ] PARAMOUNT: TICKETURL(`https://l.instagram.com/`)を正しいURLに
- [ ] FuliRock: ID/NAME要確認(DESCはFuji Rockの説明。意図的な表記か確認)
- [ ] EVENTS: ダミーデータ7件の扱いを決定(削除 or 実データ投入)。孤児参照 `mayurashka`, `cabanne` を解決
- [ ] YAGURA/＋music/Mirrorball等、NAMEの年とDATEの年が不一致の行をEDITIONS移行時に確認
- [ ] published相当のレコードにSTATUSを明示投入(現状ほぼ空欄)

**ARTICLES(§3.1)**
- [ ] 記事ID `Transcendence` → `transcendence-2026-report` にslug化(画像ファイル名も追随)
- [ ] DATE / date / PUBLISHAT を DATE に一本化し、公開日を入力(現状published記事に日付なし)
- [ ] author / AUTHORID を AUTHOR_ID に一本化(AUTHORSシートのIDと紐づけ)
- [ ] category → CATEGORY 改名+プルダウン化
- [ ] RELATED_FESTIVALS / RELATED_ARTISTS / RELATED_VENUES カラム新設(Transcendence記事に `transcendence` を設定)
- [ ] VIEWSカラム廃止
- [ ] body内のDrive直リンク画像(`lh3.googleusercontent.com`)を `images/articles/` へ移設
- [ ] 記事IDのslug化に合わせて BODY_HISTORY.articleId を一括置換(履歴の孤児化防止)

**運用**
- [ ] AREA / PREF / TYPE / GENRE / STATUS / SET_TYPE にデータ入力規則(プルダウン)を設定
- [ ] 「ウェブに公開」の対象をデータレイヤーのタブのみに限定(AUTHORS / BODY_HISTORYは除外)

## 8. Claude Codeでの進め方

- Phase 0: このドキュメントの§7を実施(シート整備スクリプト+手動修正)
- Phase 1: `scripts/fetch-data.mjs`(§4)+バリデーション(§6)
- Phase 2: サイトのVENUES/ARTISTS/FESTIVALSページを data/*.json から生成
- Phase 3: FESTIVALS一覧の探索機能(フィルタ: PREF/月/GENRE/TYPE)
- Phase 4: `/f/{edition_id}` フェス単体ビュー(LINEUP/TIMETABLE/MAP)
- 各Phaseは別セッションで実施し、着手前にプランを提示させること。
