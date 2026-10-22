# TECHNO JAPAN v2 デザイン切り替え — 実装の段取り

作成: 2026-10-22（Claude）。元デザイン: claude.ai のデザイン「Techno Japan — TOP Redesign」
（https://claude.ai/artifact/DSq6nxQVHgXkG9wBK8xc5X）。同じ内容の写しを `docs/design/v2-mock/` に置いた。

> モックは `*.dc.html`（Claude Design の形式）。見た目・寸法・文言の仕様書として読む。
> そのままサイトに貼るものではない（`<x-dc>` `<sc-for>` 等は Claude Design 専用の記法）。

## 1. 何が変わるか（モックの範囲）

| 画面 | モック | 今のファイル | 規模 |
|---|---|---|---|
| TOP | Main.dc.html | LP/index.html（インラインCSS 661行） | 大：マーキー、リード記事カルーセル（スクロールで横に送る）、FUTURE、UPCOMING 帯、記事グリッド、FESTIVAL INDEX 行、ARTISTS+VENUES、NEWSLETTER |
| NEWS 一覧 | News.dc.html | LP/news.html | 中：LEAD → 2枚 → 3枚 → 横長リスト行。カテゴリのフィルター |
| FESTIVALS 一覧 | Festivals.dc.html | LP/festivals.html | 中：大見出し 168px、Season/Type/View(Grid・List) チップ、Next up リード、4列グリッド／行表示 |
| ARTISTS 一覧 | Artists.dc.html | LP/artists.html | 中：FEATURED、グリッド。※今日入れた「固定検索・出演予定の絞り込み・自動スクロール」との整合を取る |
| VENUES 一覧 | Venues.dc.html | LP/venues.html | 中：地図＋FEATURED、グリッド |
| 記事詳細 | NewsDetail.dc.html | build-detail-pages.mjs の articlePage | 小〜中：今のヒーロー構成を継承。RELATED STORIES / RELATED FESTIVALS |
| フェス詳細 | FestivalDetail.dc.html | 同 festivalPage（festival-design-v2） | 大：HERO、FACT STRIP（6マス）、タブ（OVERVIEW/LINEUP/EDITIONS/STORIES）、MORE FESTIVALS |
| アーティスト詳細 | ArtistDetail.dc.html | 同 artistPage | 中：HEAD、UPCOMING APPEARANCES、RELATED ARTISTS、STORIES |
| 会場詳細 | VenueDetail.dc.html | 同 venuePage | 中：GALLERY SPREAD、HEAD、UPCOMING HERE、NEARBY、STORIES |
| 検索 | Search.dc.html | 今のヘッダー検索（search.js） | 中：全画面の検索。タブ、候補、種類別の結果 |
| メニュー（スマホ） | Menu.dc.html | common.js のモバイルナビ | 小〜中：全画面、番号付きの大きな項目、検索の入口、JA/EN、SNS |
| デザインの決まり | System.dc.html | LP/common.css :root | — |

スマホ版のモック（Mobile*.dc.html）は、デスクトップ版を 390px 幅で表示したもの。レイアウトの切り替え点は 900px（モックの `@media (max-width:900px)`）。
今のサイトの切り替え点（700px 前後）と違うので、どちらに合わせるか最初に決める。

## 2. 変わらないもの（今のサイトと同じ）

モックの「Editorial System v2」は、今のサイトの色・書体をそのまま土台にしている。
- 色: 背景 #080808 ／ 文字 #f0ede8 ／ 補助文字 = 文字の 62% ／ 赤 #ff2d2d（●・日付・選択中・リンク）／ ワインレッド #a82f31（マウスを乗せたときだけ）
- 書体: Bebas Neue（見出し）／ DM Sans 300（本文）／ Space Mono 10px・字間 .15em・大文字（日付や場所などの小さな情報）
- 背景の 80px グリッド線（3%）、記事ヒーローの写真＋下からのグラデーション、cat-pill（● 付きの枠）
→ 今日の下準備で作った CSS 変数（--text-rgb など）がそのまま使える。

**新しく入るもの**
- **Noto Sans JP**（日本語の書体。今は日本語が端末の標準書体）。モックは Google Fonts から読み込み。
  今のサイトは書体を自前のファイル（LP/fonts/）で配信しているので、どちらにするか決める。
  - Google Fonts: 必要な文字だけ分割して届くので軽い。CSP は fonts.googleapis.com / fonts.gstatic.com を既に許可済み。
  - 自前配信: 日本語は全部入りだと数MB。分割が必要で手間。→ **Google Fonts を推奨**（実装後に記事ページの重さを変更前後で測って並べる）。
- 見出しサイズの段階: ページ見出し 168px、ヒーロー 76–92px、カード 28–34px、サブ見出しは見出しの 0.42 倍。
- 動き: マーキー 40 秒、画像は乗せると 1.04 倍（0.7 秒）、アーティスト写真は白黒→カラー、見出しは乗せるとワインレッド、地図ピンは 2.4 秒で脈打つ。
  背景のグリッドの動き・走査線は今のまま。`prefers-reduced-motion` のときは止める。

## 3. 進め方（おすすめの順番）

一度に全部を入れ替えず、**共通部分 → 一覧 → 詳細** の順に、1段ずつテスト環境で確かめてから次へ進む。

1. **共通の土台**（全ページに効く）: Noto Sans JP、文字サイズの段階を CSS 変数に、ヘッダー（ロゴ・ナビ・日付・Search ボタン・JA/EN）、フッター、スマホのメニュー、検索の全画面
2. **TOP**（一番大きい。カルーセルは動きの確認に時間がかかる）
3. **一覧 4枚**（NEWS / FESTIVALS / ARTISTS / VENUES）。EN 版は enHubFromJa で自動生成されるので JA だけ直す
4. **詳細 4種**（記事 / フェス / アーティスト / 会場）。build-detail-pages.mjs のテンプレートを直して再生成
5. 仕上げ: CMS のプレビュー（cms.js が本番の詳細ページの見た目を使う）、ニュースレターの色、manifest

各段で:
- 変更前に `node scripts/visual-snapshot.mjs capture <dir>` で撮る → 変更 → もう一度撮って compare（意図しない所が変わっていないか）
- CSS/JS を変えたら ?v を上げる（cms.js 内のプレビュー用 CSS 版数も。今日これで1回落ちた）
- `bash scripts/preflight.sh` を全件 → 実ブラウザでスマホ・PC を操作 → 公開

## 4. 先に決めておくこと（ユーザー判断）

1. レイアウトの切り替え点: モックの 900px に合わせるか、今の 700px 前後を残すか
2. Noto Sans JP: Google Fonts で読み込むか、自前で配信するか（推奨: Google Fonts）
3. 公開の単位: 全部そろってから一度に切り替えるか、段ごとに公開するか
   （段ごとだと途中は新旧のデザインが混ざる。一度に切り替えるなら、作業ブランチで全部作ってからまとめて公開）
4. TOP のカルーセル（スクロールで横に送る）: スマホでも同じ動きにするか、スマホは縦に並べるか

## 5. 実装で気をつけること（このリポジトリの決まり）

- ハブの JS は JA/EN 同一。EN は `enHubFromJa` で生成し、生成後に JA/EN の行数を比べる
- 詳細ページは静的生成のみ。SPA の詳細ビューを復活させない。カードは普通の `<a href>` で遷移する
- JS で meta / canonical / JSON-LD を書き換えない
- localize.js に defer を付けない
- 文字の途中で改行しない（見出しは BudouX の文節折り）
- データはスプレッドシートが唯一の元。モックの文言（"Japan's Underground, Curated." 等）はサイトの定型文なので可。数字や名前は実データから出す
- 画像は「表示幅 × dpr ≦ 取得する画像の幅」を満たすこと。srcset の sizes を実際の表示幅に合わせる
- 重さは performance.getEntriesByType('resource') で、変更前後を同じ方法で測って並べる
