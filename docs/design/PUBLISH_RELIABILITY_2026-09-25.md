# Publish が止まらない仕組みにする（設計案 2026-09-25）

## 今日起きたこと（2026-09-25 02:19 JST）

記事 `odyssey-2026-info` を CMS で Publish → **Publish pipeline が失敗** → 見張り番（watchdog）も失敗通知。

失敗した検査: `articles/odyssey-2026-info.html の image が 16:9・1:1・4:3 の3件で実在する`
→ 実際は 1 件しか無かった。

### 原因の連鎖

| 時刻 | 何が起きたか |
|---|---|
| 00:34 | 定期の **Sync Drive Images** が odyssey の画像を Drive から取り込み、カード用の派生画像を作った。ただし **記事OG用の3比率（16:9 / 1:1 / 4:3）は作らなかった**。3比率は `data.js` に「記事のヒーロー画像」として載っている画像だけに作る仕様で、この時点では記事がまだ Publish されておらず `data.js` に無かった |
| 02:19 | ユーザーが Publish → `data.js` に記事が載る → ページ生成 → JSON-LD の image が1件 → **検査で停止** |
| 04:17（予定） | 次の定期 Sync が3比率を作る → そこで Publish を再実行すれば通る |

つまり **「画像の派生を作る係（Sync）」と「ページを作る係（Publish）」が別のワークフローで、順番が前後すると失敗する**。
画像そのものは同期されていた、という利用者の認識は正しい。足りなかったのは派生画像。

## 過去30回の Publish 失敗 16 件の内訳

| 分類 | 件数 | 日付 | 具体例 |
|---|---|---|---|
| **A. 画像の同期タイミング** | 5 | 09-25, 09-20, 09-12, 09-09, 08-17 | 参照画像が未同期 / 派生が未生成 / Sync が起動できず |
| **B. CMS のデータ不整合** | 5 | 09-15 ×3, 09-14, 08-23 | EDITIONS の FESTIVAL_ID 参照切れ、ID 重複 |
| **C. 生成物 push の競合** | 3 | 09-15, 09-12, 09-09 | 他ワークフローの commit と衝突して push 失敗 |
| D. 開発時の ?v 上げ忘れ | 2 | 09-15, 08-17 | preflight で今は防止済み |
| E. 外部 API の一時障害 | 1 | 09-13 | 検査中に Claude API が 502 |

**A + B + C で 13 / 16 件。** この3つを構造的に潰せば「毎回エラー」は止まる。

## 対策の設計

### M1. Publish が派生画像を自分で作る（A の根治）★最優先

Publish pipeline の「Fetch data」直後に、Sync と同じ手順を入れる:

```
pip install Pillow
python3 scripts/build-image-derivatives.py     # 89秒（Sync 実測）
node    scripts/build-image-dimensions.mjs     # 11秒
```

- `data.js` を取ってきた**直後**なので、Publish された記事のヒーロー画像には必ず3比率が作られる。
- 派生ファイル名は内容ハッシュ付きで**同じ入力→同じ出力**。Sync 側が先に作っていれば差分ゼロ、後から作れば Sync 側も差分ゼロ。二重に作っても衝突しない。
- 生成物は既存の「Commit generated output」に同乗させる（`image-derivatives.js` / `image-dimensions.js` の ?v 更新も同じ仕組みが担う）。
- 所要時間 +約100秒。Publish 全体が 3〜4 分 → 5 分程度。

既存の「Ensure referenced images exist」（原本が未同期なら Sync を起動して待つ）はそのまま残す。原本の同期は Drive にしか無いので Publish 側では作れない。

### M2. 生成物 push の競合をなくす（C の根治）

現状: Publish と Deploy は `concurrency: pages` で直列だが、**Sync は別グループ**（`sync-drive-images`）。
Sync の commit と Publish の commit が同時に走ると、後から push した方が non-fast-forward で落ちる（3回 rebase 再試行で救えなかったのが3件）。

対策:
1. Sync も `concurrency: group: pages`（`cancel-in-progress: false`）に入れて、**リポジトリに commit する3本を完全に直列化**する。
2. 念のため「Commit generated output」の再試行を 3 → 5 回、待ち時間を 5秒 → 15秒に。

### M3. CMS 側でデータ不整合を止める（B の根治）

失敗した5件はすべて **`fetch-data.mjs` の検査**（FESTIVAL_ID 参照切れ / ID 重複）で止まっている。
つまり **押した後に分かる**。これを **押す前に分かる**ようにする。

- `LP/cms.js` の `publishSanityCheck`（既存の「送信前に中身を数で見せる」関門）に、同じ2規則を足す:
  - EDITIONS の `FESTIVAL_ID` が FESTIVALS に存在すること
  - 各シートの ID が重複していないこと
- 不整合があれば **Publish ボタンを押せない**（`aiFail` パネルで行番号と ID を出す）。
- ⚠️ `cms.js` は Publish 経路。AGENTS.md の規則どおり、**自分で Publish pipeline を1回流し、CMS を `?cb=` 付きで開いて実データで検査を呼ぶ**まで完了にしない。

### M4. 失敗の通知を1通・原因つきにする（運用の負担を減らす）

現状は Publish 失敗 → watchdog も失敗 → **同じ事故で2通**。しかも本文は Run の URL だけで、開いてログを読まないと原因が分からない。

- watchdog の通知本文に **失敗したステップ名と最初の ❌ 行**を載せる（`gh run view --log-failed` から抽出）。
- 分類 A なら「次の定期 Sync（毎偶数時 :17）後に自動で再実行します」、B なら「CMS の◯◯行を直してから Publish」を本文に書く。
- A は M1 で消えるので、実質 B の案内だけが残る。

### M5. 外部 API を叩く検査を Publish から外す（E）

`check_gas_ai.mjs` の一部が本物の Claude API を呼び、502 で Publish が止まった（09-13）。
Publish 経路の検査は**モックのみ**にし、実 API はローカルの preflight（任意）に限定する。

## 実装順序（Codex に渡す単位）

| 順 | WP | 触るファイル | Publish 経路 | 検証 |
|---|---|---|---|---|
| 1 | M1 派生を Publish で生成 | `.github/workflows/publish-pipeline.yml` | **触る**（ワークフロー） | `gh workflow run "Publish pipeline"` を自分で流して success を確認 |
| 2 | M2 直列化＋再試行 | `sync-drive-images.yml` / `publish-pipeline.yml` | 触る | 同上。Sync と Publish を同時起動して衝突しないこと |
| 3 | M4 通知の改善 | `production-sync-watchdog.yml` | 触らない（見張り番） | 失敗 Run を指定して本文を確認 |
| 4 | M5 モック限定 | `check_gas_ai.mjs` / `publish-pipeline.yml` | 触る | preflight 緑 |
| 5 | M3 CMS 関門 | `LP/cms.js` | **触る（CMS）** | 実機 Publish＋CMS 実操作（AGENTS.md 手順）。最後に回す |

## 効果の見込み

| 分類 | 対策後 |
|---|---|
| A 画像 5件 | **0**（M1。原本未同期は既存の自動 Sync が対応） |
| B データ 5件 | **0**（M3。CMS で押す前に止まる） |
| C 競合 3件 | **0**（M2） |
| D ?v 2件 | 0（preflight で既に防止） |
| E 外部API 1件 | **0**（M5） |

## 今日の復旧

Sync Drive Images を手動起動（odyssey の3比率を生成）→ Publish pipeline を再実行。
