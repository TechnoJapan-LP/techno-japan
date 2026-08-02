# SPA 詳細ビュー vs 静的詳細ページ 差分実測

`scripts/audit_spa_vs_static.py` の出力。SPA 廃止の前後で再実行すると比較できる。

カードのリンクは `preventDefault()` で SPA へ遷移するため、**JS 有効の通常ユーザーが
見ているのは SPA 側**。静的側にしか無い項目はユーザーに届いていない。

## この表が何時点のものか

SPA 廃止が進行中のため、**セクションごとに計測時点が違う。**

| セクション | 計測対象 | 状態 |
|---|---|---|
| festival | `039acd8`（廃止直前）の worktree | **廃止前の記録**。`e381842` で廃止済み |
| artist | `039acd8`（廃止直前）の worktree | **廃止前の記録**。`8c289b4` で廃止済み |
| venue | 現在の作業ツリー | **現役**。SPA 詳細は生きている |
| article | 現在の作業ツリー | **現役**。SPA 詳細は生きている |

festival / artist はコミットハッシュ固定の worktree で測ったので、
`git worktree add <dir> 039acd8` すれば同じ数字を再現できる。

### ⚠ 計測中にファイルが差し替わると数字が壊れる

最初の計測は Codex の廃止コミットと並行して走らせてしまい、
festival / artist が「廃止後」を測っていた（全件 `spa_rendered=False`）。
**同一リポジトリで並行作業しているときは、計測対象をコミットで固定すること。**

## 数字の読み方の注意: artist の `bio`

`bio` は **SPA 100 / 静的 4** と出るが、これは「SPA のほうが充実している」ではない。

`artists.html` の詳細ビューは `${a.bio}` をガード無しで埋めていた。
data.js の ARTISTS 100件のうち **96件は `bio` キー自体を持たない**ため、
テンプレートリテラルが `undefined` を文字列化し、**画面に "undefined" と
表示されていた。**計測はそれを「中身あり」と数えている。

静的側の 4 は BIO を実際に持つ4件。`genre` / `country` / `city` も同じ状態だった。
**この項目は「SPA が96件で undefined を露出していた」と読む。**
廃止(`8c289b4`)でコードごと消えたため、現在は発生しない。

## サマリ

| セクション | 件数 | SPA に欠けがある | 欠け要素の合計 |
|---|---|---|---|
| festival | 87 | 87 | 680 |
| artist | 100 | 71 | 75 |
| venue | 22 | 21 | 120 |
| article | 1 | 1 | 3 |

## festival

### 項目別の合計（SPA / 静的）

| 項目 | SPA 合計 | 静的 合計 | 差 |
|---|---|---|---|
| artist_links | 143 | 75 | **-68** |
| editions | 0 | 86 | **+86** |
| faq_qa | 0 | 188 | **+188** |
| instagram | 1 | 20 | **+19** |
| lineup | 143 | 130 | **-13** |
| official_link | 21 | 13 | **-8** |
| past_lineup | 0 | 0 | **+0** |
| related | 0 | 300 | **+300** |
| summary | 0 | 87 | **+87** |

### 差分が大きい順（上位30 / 該当 87件）

| # | id | name | 欠け | 内訳（SPA→静的） |
|---|---|---|---|---|
| 1 | `paramount` | PARAMOUNT | 14 | editions 0→1, faq_qa 0→4, instagram 1→4, related 0→5, summary 0→1 |
| 2 | `99flags` | 99flags | 13 | editions 0→1, faq_qa 0→4, instagram 0→1, related 0→6, summary 0→1 |
| 3 | `festival-de-frue` | FESTIVAL de FRUE | 13 | editions 0→1, faq_qa 0→4, instagram 0→1, related 0→6, summary 0→1 |
| 4 | `rainbow-disco-club` | Rainbow Disco Club | 12 | editions 0→1, faq_qa 0→3, instagram 0→1, related 0→6, summary 0→1 |
| 5 | `arch` | ARCH | 11 | editions 0→1, faq_qa 0→3, instagram 0→1, related 0→5, summary 0→1 |
| 6 | `ala` | ALA | 11 | editions 0→1, faq_qa 0→4, instagram 0→1, related 0→4, summary 0→1 |
| 7 | `transcendence` | Transcendence | 11 | editions 0→1, faq_qa 0→3, instagram 0→1, related 0→5, summary 0→1 |
| 8 | `grow-the-culture-open-air` | GROW THE CULTURE OPEN AIR | 11 | editions 0→1, faq_qa 0→2, instagram 0→1, related 0→6, summary 0→1 |
| 9 | `waifu` | WAIFU | 10 | editions 0→1, faq_qa 0→3, instagram 0→1, related 0→4, summary 0→1 |
| 10 | `the-star-festival` | THE STAR FESTIVAL | 10 | editions 0→1, faq_qa 0→4, instagram 0→1, related 0→3, summary 0→1 |
| 11 | `goj-ichi-festival` | Gojū-Ichi Festival | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 12 | `festival-fruezinho` | FESTIVAL FRUEZINHO | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 13 | `re-birth-festival` | Re:birth Festival | 10 | editions 0→1, faq_qa 0→2, instagram 0→1, related 0→5, summary 0→1 |
| 14 | `ultra-japan` | Ultra Japan | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 15 | `unknown` | Unknown | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 16 | `dom` | DOM24 | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 17 | `bonna-pot` | Bonna Pot | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 18 | `lab` | LAB.vol.6 | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 19 | `axiom` | axiom | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 20 | `body-soul` | Body&SOUL Live in Japan | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 21 | `signal` | Signal | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 22 | `euphoria` | Euphoria | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 23 | `sawagi-festival` | Sawagi Festival | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 24 | `sangenjaya-music-festival` | SANGENJAYA MUSIC FESTIVAL | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 25 | `ffkt` | FFKT | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 26 | `circus` | CIRCUS | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 27 | `rare-groove` | Rare Groove | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 28 | `delta-commit` | DELTA COMMIT | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 29 | `music` | ＋music | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |
| 30 | `lost-find` | Lost&Find | 10 | editions 0→1, faq_qa 0→2, related 0→6, summary 0→1 |

⚠ SPA 詳細ビューが描画されなかった 5件: `ultra-japan`, `labyrinth`, `wonderfruit-kyoto`, `odyssey`, `technogaoka`

## artist

### 項目別の合計（SPA / 静的）

| 項目 | SPA 合計 | 静的 合計 | 差 |
|---|---|---|---|
| appearances | 0 | 75 | **+75** |
| bandcamp | 3 | 3 | **+0** |
| bio | 100 | 4 | **-96** |
| instagram | 4 | 4 | **+0** |
| soundcloud | 4 | 4 | **+0** |

### 差分が大きい順（上位30 / 該当 71件）

| # | id | name | 欠け | 内訳（SPA→静的） |
|---|---|---|---|---|
| 1 | `hidai` | Hidai | 2 | appearances 0→2 |
| 2 | `dj-maria` | Dj Maria. | 2 | appearances 0→2 |
| 3 | `gonno` | Gonno | 2 | appearances 0→2 |
| 4 | `rami` | RAMI | 2 | appearances 0→2 |
| 5 | `dj-nobu` | DJ Nobu | 1 | appearances 0→1 |
| 6 | `dj-miku` | Dj Miku | 1 | appearances 0→1 |
| 7 | `dj-kensei` | Dj Kensei | 1 | appearances 0→1 |
| 8 | `dj-yogurt` | Dj Yogurt | 1 | appearances 0→1 |
| 9 | `taichi-kawahira` | Taichi Kawahira | 1 | appearances 0→1 |
| 10 | `tsutomu` | Tsutomu | 1 | appearances 0→1 |
| 11 | `qmico` | Qmico | 1 | appearances 0→1 |
| 12 | `nutmeg` | Nutmeg | 1 | appearances 0→1 |
| 13 | `snipe1` | Snipe1 | 1 | appearances 0→1 |
| 14 | `liarako` | Liarako | 1 | appearances 0→1 |
| 15 | `mimu` | Mimu | 1 | appearances 0→1 |
| 16 | `yazzus` | Yazzus | 1 | appearances 0→1 |
| 17 | `cosmic-caz` | Cosmic Caz | 1 | appearances 0→1 |
| 18 | `janus-rose` | Janus Rose | 1 | appearances 0→1 |
| 19 | `mayudepth` | Mayudepth | 1 | appearances 0→1 |
| 20 | `akii` | Akii | 1 | appearances 0→1 |
| 21 | `aliceyuki` | Aliceyuki | 1 | appearances 0→1 |
| 22 | `choko` | Choko | 1 | appearances 0→1 |
| 23 | `akihiro-suzuki` | Akihiro Suzuki | 1 | appearances 0→1 |
| 24 | `endorphin` | Endorphin | 1 | appearances 0→1 |
| 25 | `kevin-miyagi` | Kevin Miyagi | 1 | appearances 0→1 |
| 26 | `psychogem` | Psychogem | 1 | appearances 0→1 |
| 27 | `sho` | Sho | 1 | appearances 0→1 |
| 28 | `takehiro-imaizumi` | Takehiro Imaizumi | 1 | appearances 0→1 |
| 29 | `tazzy` | Tazzy | 1 | appearances 0→1 |
| 30 | `tko` | Tko | 1 | appearances 0→1 |

## venue

### 項目別の合計（SPA / 静的）

| 項目 | SPA 合計 | 静的 合計 | 差 |
|---|---|---|---|
| desc | 22 | 22 | **+0** |
| festival_links | 0 | 0 | **+0** |
| instagram | 22 | 0 | **-22** |
| related | 0 | 120 | **+120** |

### 差分が大きい順（上位30 / 該当 21件）

| # | id | name | 欠け | 内訳（SPA→静的） |
|---|---|---|---|---|
| 1 | `womb` | WOMB | 6 | related 0→6 |
| 2 | `circus-tokyo` | CIRCUS TOKYO | 6 | related 0→6 |
| 3 | `saloon` | SALOON | 6 | related 0→6 |
| 4 | `solfa` | SOLFA | 6 | related 0→6 |
| 5 | `unit` | UNIT | 6 | related 0→6 |
| 6 | `liquidroom` | LIQUIDROOM | 6 | related 0→6 |
| 7 | `clubasia` | CLUBASIA | 6 | related 0→6 |
| 8 | `mitsuki` | MITSUKI | 6 | related 0→6 |
| 9 | `the-room` | THE ROOM | 6 | related 0→6 |
| 10 | `oath` | OATH | 6 | related 0→6 |
| 11 | `www` | WWW | 6 | related 0→6 |
| 12 | `o-east` | SPOTIFY O-EAST | 6 | related 0→6 |
| 13 | `bonobo` | BONOBO | 6 | related 0→6 |
| 14 | `forestlimit` | FORESTLIMIT | 6 | related 0→6 |
| 15 | `vent` | VENT | 6 | related 0→6 |
| 16 | `circus-osaka` | CIRCUS OSAKA | 5 | related 0→5 |
| 17 | `club-joule` | CLUB JOULE | 5 | related 0→5 |
| 18 | `compufunk` | COMPUFUNK RECORDS | 5 | related 0→5 |
| 19 | `noon` | NOON + CAFE | 5 | related 0→5 |
| 20 | `triangle` | TRIANGLE | 5 | related 0→5 |
| 21 | `sunhall` | SUNHALL | 5 | related 0→5 |

## article

### 項目別の合計（SPA / 静的）

| 項目 | SPA 合計 | 静的 合計 | 差 |
|---|---|---|---|
| body_chars | 1656 | 1456 | **-200** |
| tags | 0 | 3 | **+3** |

### 差分が大きい順（上位30 / 該当 1件）

| # | id | name | 欠け | 内訳（SPA→静的） |
|---|---|---|---|---|
| 1 | `transcendence-2025-report` | 野外テクノパーティTranscendenceで見た次世代ジェネレーシ | 3 | tags 0→3 |
