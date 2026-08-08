# VENUE 下書きの出典（2026-08-09）

## このファイルの使い方

`data/inbox/export/venues-draft.tsv` は **シートに貼るための一度きりの下書き**。
ここに会場を貯めていくものではない。**貼ったら役目は終わり。**
貼ったあとの正はスプレッドシート（VENUES）。

**貼る前に必ず確認する:**

```
node scripts/check_paste_tsv.mjs data/inbox/export/venues-draft.tsv --sheet VENUES
```

列数・列順・セル数・ID重複を見る。この下書きは最初 18列で作ってしまい、
**16列目以降がズレていた**（貼る直前に気づいた）。列がズレたまま貼ると
値が隣の列に入り、**エラーは出ない**ので公開されるまで気づけない。


**空欄は「確認できなかった」という意味。推測では埋めていない。**
（AGENTS.md「事実主義が最優先。ソースに無い情報を推測で補わない」）

対象は club / livehouse / bar の常設施設のみ。
フェスの屋外会場（キャンプ場など）は VENUES の性格に合わないため入れていない。

## KIETH FLACK（福岡）

| 項目 | 値 | 出典 |
|---|---|---|
| 住所 | 福岡県福岡市中央区舞鶴1-8-28 マジックスクエアビル 1F.2F | 公式サイト https://kiethflack.net/ |
| 公式 | https://kiethflack.net/ | 同上 |
| Instagram | https://www.instagram.com/kiethflack/ | 公式サイトのリンク |

## PRECIOUS HALL（札幌）

| 項目 | 値 | 出典 |
|---|---|---|
| 住所 | 北海道札幌市中央区南2条西3丁目 パレードビル B2F | 公式Instagram プロフィール |
| Instagram | https://www.instagram.com/precioushall_sapporo/ | 同上 |
| 公式サイト | **未取得** | precioushall.com は証明書エラーで開けず。RA は 403 |

## CLUB ABOUT（名古屋）

| 項目 | 値 | 出典 |
|---|---|---|
| 住所 | 愛知県名古屋市中区栄4丁目13-3 B1 | 公式アクセスページ https://club-about.com/access.html |
| 公式 | https://www.club-about.com/ | — |
| Instagram | **未取得** | 公式サイトに記載なし |

## 全件で空にした項目と理由

- **LAT / LNG** — Nominatim が日本語住所をほぼ解決できなかった（実測で全滅）。
  CMS の「📍 検索」は AI 照合の第2段があるので、そちらで取得する方が当たる。
  **取得後は必ず地図で位置を確認すること**（国外の座標が返る事例あり。AUDIT §9-59）
- **GENRE** — 一次情報に明記が無い。実際のブッキング傾向を見て人が決める
- **DESC / DESC_EN** — 文章は docs/writing/ のガイドに沿って人が書くか、
  CMS の AI 生成（Claude・文体指定つき）を使う
- **IMAGE** — 写真の権利があるため、こちらでは用意しない
- **CAPACITY** — 廃止方針（2026-08-09）につき空のまま

## STATUS を draft にしてある理由

上記のとおり未確定の項目が残るため。
内容を確認して埋めてから published にすること。
