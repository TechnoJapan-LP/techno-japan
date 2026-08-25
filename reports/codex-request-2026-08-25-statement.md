# Codex への依頼（2026-08-25）: ABOUT「STATEMENT」セクションの実装

設計: [docs/design/ABOUT_STATEMENT.md](../docs/design/ABOUT_STATEMENT.md) を先に読むこと。
対象は `LP/about.html` と `LP/en/about.html` のみ（両方とも手書き。ビルド生成物ではない）。

## 実測済みの前提（再確認不要だが、ずれていたら設計ごと直す）

- セクションリンクは `#about` の3箇所のみ。NEWS以降へのアンカーリンクは無い
  → 繰り下げはラベル表記（02→03、03→04、04→05）だけでよい
- `.reveal` の出現アニメは既存機構。Observer が `.reveal` を包括収集しているか確認し、
  セレクタ列挙型なら新クラスを追記
- JA/EN は行数まで同一（1022=1022）。**構造を同一にして行数一致を維持**

## 絶対条件

1. **テキストは下記を一字一句そのまま使う。** 要約・言い換え・句読点変更禁止
2. 「STATEMENT」のスペル注意（STATMENT 禁止）。全角ダッシュ「——」を本文に使わない
3. 既存セクションのレイアウトを壊さない（差分は挿入と番号ラベルのみに閉じる）
4. アクセント #FF2D2D は設計書の6pxマーカーのみ。大面積使用禁止
5. push しない（ユーザー承認後にこちらで公開）

## コンテンツ（JA: about.html）

セクション見出し: `02 — STATEMENT`

キーワードと直下の一行:

```
AUTHENTIC     本物の音楽体験だけを。
SELECTIVE     すべては発信しない。厳選して届ける。
BORDERLESS    日本と世界を、交差させる。
INDEPENDENT   どこにも偏らず、フラットであり続ける。
```

本文（9段落・この順で・一字一句そのまま）:

> 日本のダンスフロアには、世界に誇るべき圧倒的なクオリティ、細部に宿るホスピタリティ、そして真摯な音楽体験が存在します。
>
> 私たちの目的は、音楽そのものを目的に世界中から人々が訪れるような、持続可能で熱量ある循環を、この地に生み出すことです。
>
> しかし、アンダーグラウンドカルチャーの美しさは、「ただ広めればいい」というものではありません。知る人ぞ知る場の空気感、限られた空間だからこそ成り立つ純度。それは、私たちが何よりも守るべき境界線です。
>
> だからこそ、Techno Japanは、すべての情報を発信するメディアではありません。現場で感じ、深く賛同したイベントとカルチャーだけを、厳選して届けます。
>
> 私たちの視線は日本の内側にとどまりません。世界のダンスフロアで生まれるムーブメントを日本へ、日本の熱量を世界へ。本物の音楽体験に、国境はないからです。
>
> 日本と世界をボーダレスに交差させることが、シーンを次へと進めていく。私たちはそう信じています。
>
> そして、ひとつの約束を。特定の資本や過度な商業的思惑、偏った思想を介入させず、客観的でフラットな視点を貫き続けます。
>
> 私たちが目指すのは、人、場所、音楽をつなぐ、シーンの接続点となるフラットなメディアです。
>
> Techno Japanは、この姿勢で届けていきます。

## コンテンツ（EN: en/about.html）

セクション見出し: `02 — STATEMENT`

```
AUTHENTIC     Only real music experiences.
SELECTIVE     We don't publish everything. We select.
BORDERLESS    Crossing Japan and the world.
INDEPENDENT   No capital, no agenda, no bias.
```

本文（9段落・一字一句そのまま）:

> Japan's dancefloors hold world-class quality, hospitality woven into every detail, and a sincerity toward music itself.
>
> Our purpose is to create a lasting, passionate cycle here, one that draws people from around the world for the music itself.
>
> But the beauty of underground culture is not something to simply spread. The air of places known only to those who know, the purity that exists because a space is limited. That is the boundary we protect above all.
>
> This is why Techno Japan does not publish everything. We select only the events and cultures we have felt and believed in, on the floor.
>
> Our gaze does not stop at Japan's borders. Movements from the world's dancefloors to Japan, Japan's heat to the world. Authenticity knows no borders.
>
> Crossing Japan and the world, borderless, is what moves this scene forward. That is what we believe.
>
> And one promise. No capital, no agenda, no bias. We stay objective and flat, always.
>
> What we aim to be is a flat, open media, a point of contact connecting people, places, and music.
>
> This is how Techno Japan will keep delivering.

## メタ情報の更新

- JA `meta description`:
  `TECHNO JAPANについて — 日本のアンダーグラウンド・ダンスミュージックシーンを厳選して届けるメディア。AUTHENTIC / SELECTIVE / BORDERLESS / INDEPENDENT。`
- EN `meta description`:
  `About TECHNO JAPAN — a selective media for Japan's underground dance music scene. AUTHENTIC / SELECTIVE / BORDERLESS / INDEPENDENT.`
- og:description / twitter:description に about の説明があれば同時に整合させる

## 受け入れ条件

1. `grep -c STATMENT LP/about.html LP/en/about.html` → 0 / 0
2. `grep 'section-label' LP/about.html` → 01〜05 連番（EN も）
3. `http://…/about.html#statement` で直接着地
4. 4キーワードで `.reveal` アニメが発火
5. JA/EN 行数一致
6. 実ブラウザ 390px / 1280px × JA / EN（既存セクションが崩れていないことも見る）
7. `bash scripts/preflight.sh` 全件成功
8. `reports/handoff.md` に6項目記録。push はしない
