# FESTIVALS 充足状況レポート

> 生成: `scripts/audit_festivals_completeness.py`（読み取り専用）
> 対象: スプレッドシート「LP」FESTIVALS タブ **86件**
> 検査項目: 14（開催日, 会場名, 住所, 緯度, 経度, メイン画像, フライヤー, 説明(日本語), 説明(英語), 公式サイト, Instagram, チケットURL, ジャンル, ラインナップ）

項目別の欠落一覧は `reports/festivals-missing-<項目>.csv` に出力している。
各CSVには、その項目を埋めるときに参照できる既存値を同梱した
（例: 座標が空なら会場名と住所を並べる）。

## (a) 項目別の欠落件数

| 項目 | 欠落 | 充足 | 充足率 | CSV |
|---|---:|---:|---:|---|
| チケットURL | **79** | 7 | 8% | `festivals-missing-ticketurl.csv` |
| ラインナップ | **76** | 10 | 12% | `festivals-missing-lineup.csv` |
| 公式サイト | **74** | 12 | 14% | `festivals-missing-url.csv` |
| 緯度 | **72** | 14 | 16% | `festivals-missing-lat.csv` |
| 経度 | **72** | 14 | 16% | `festivals-missing-lng.csv` |
| フライヤー | **72** | 14 | 16% | `festivals-missing-flyer.csv` |
| 住所 | **71** | 15 | 17% | `festivals-missing-address.csv` |
| メイン画像 | **71** | 15 | 17% | `festivals-missing-image.csv` |
| 会場名 | **70** | 16 | 19% | `festivals-missing-location.csv` |
| Instagram | **70** | 16 | 19% | `festivals-missing-instagram.csv` |
| ジャンル | **7** | 79 | 92% | `festivals-missing-genre.csv` |
| 開催日 | **0** | 86 | 100% | `—` |
| 説明(日本語) | **0** | 86 | 100% | `—` |
| 説明(英語) | **0** | 86 | 100% | `—` |

**全項目が埋まっているフェス: 5件** — 99flags, ala, matricaria, paramount, the-star-festival

1フェスあたりの平均欠落数: **8.5 / 14項目**

## (b) 欠落数の多い順（上位20件）

| # | ID | NAME | 欠落数 | 欠落項目 |
|---:|---|---|---:|---|
| 1 | `festival-fruezinho` | FESTIVAL FRUEZINHO | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 2 | `labyrinth` | Labyrinth | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 3 | `link-open-air` | Link Open Air | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 4 | `odyssey` | Odyssey | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 5 | `ultra-japan` | Ultra Japan | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 6 | `wonderfruit-kyoto` | Wonderfruit Kyoto | **11** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ジャンル / ラインナップ |
| 7 | `annahme` | annahme | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 8 | `asagiri-jam` | ASAGIRI JAM | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 9 | `axiom` | axiom | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 10 | `balance` | Balance | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 11 | `big-fun` | BIG FUN | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 12 | `body-soul` | Body&SOUL Live in Japan | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 13 | `bondisco` | BonDisco | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 14 | `bonna-pot` | Bonna Pot | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 15 | `brightness` | Brightness | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 16 | `capsule` | CAPSULE-山中湖花火音楽祭 | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 17 | `circle` | Circle | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 18 | `circus` | CIRCUS | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 19 | `colors-presents-soundcamp` | COLORS Presents SOUNDCAMP | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |
| 20 | `delta-commit` | DELTA COMMIT | **10** | 会場名 / 住所 / 緯度 / 経度 / メイン画像 / フライヤー / 公式サイト / Instagram / チケットURL / ラインナップ |

## (c) 項目別CSV

| ファイル | 項目 | 件数 |
|---|---|---:|
| `festivals-missing-ticketurl.csv` | チケットURL | 79 |
| `festivals-missing-lineup.csv` | ラインナップ | 76 |
| `festivals-missing-url.csv` | 公式サイト | 74 |
| `festivals-missing-lat.csv` | 緯度 | 72 |
| `festivals-missing-lng.csv` | 経度 | 72 |
| `festivals-missing-flyer.csv` | フライヤー | 72 |
| `festivals-missing-address.csv` | 住所 | 71 |
| `festivals-missing-image.csv` | メイン画像 | 71 |
| `festivals-missing-location.csv` | 会場名 | 70 |
| `festivals-missing-instagram.csv` | Instagram | 70 |
| `festivals-missing-genre.csv` | ジャンル | 7 |

### ラインナップの内訳

| 状態 | 件数 |
|---|---:|
| ラインナップ行あり | 10 |
| うち ARTIST_ID 解決済みの行を持つ | 9 |
| 行はあるが全行未解決 | 1 |
| 行なし | 76 |

