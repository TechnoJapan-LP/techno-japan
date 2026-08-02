# SPA / 静的 差分計測の使い方

SPA 廃止の前後で同じ数字を取り、解消したかを機械的に確認するための手順。

## 実行

```bash
python3 scripts/audit_spa_vs_static.py            # 全210件（逐次・15分程度）
python3 scripts/audit_spa_vs_static.py --section festival
python3 scripts/audit_spa_vs_static.py --limit 5  # 動作確認
```

出力:

| ファイル | 用途 |
|---|---|
| `reports/spa-vs-static.md` | 人が読む。項目別合計と差分ランキング |
| `reports/spa-vs-static.csv` | 差分比較用。1行=1エンティティ |

## 前後比較のしかた

```bash
cp reports/spa-vs-static.csv reports/spa-vs-static.before.csv   # 変更前に退避
# … SPA 廃止の実装 …
python3 scripts/audit_spa_vs_static.py
diff <(cut -d, -f1-5 reports/spa-vs-static.before.csv) \
     <(cut -d, -f1-5 reports/spa-vs-static.csv)
```

`missing_in_spa` 列がすべて 0 になれば、静的側にあってユーザーに見えていない
項目が無くなったということ。

## 注意: 並列実行すると数字が壊れる

`--workers` を上げてはいけない。**既定は逐次(1)。**

headless Chrome に `--user-data-dir` を渡すと macOS では起動が戻らない
（空プロファイル・`First Run` 設置・`--headless=new` のいずれも45秒でタイムアウト）。
そのため全インスタンスが既定プロファイルを共有する。並列度を上げると
プロファイルの奪い合いで描画に失敗する個体が出る。

実際に `--workers 6` では、同じコードに対して 87件中 5件失敗 → 87件全滅と
実行ごとに結果が変わった。**失敗した個体は SPA 側が全項目 0 になるため、
「SPA に何も無い」という誤った結論に直結する。**

`spa_rendered` 列が `False` の行は計測失敗なので、数字を信用しないこと。
スクリプトは空振り時に1度だけ直列で取り直すが、それでも `False` が残る場合は
**本当に描画されていない**（下記）。

## 描画されないエンティティ = SPA の実バグ

`spa_rendered=False` が再試行後も残るものは、SPA の JS エラーで詳細ビューが
空になっている。2026-08-02 時点で festival 5件（`ultra-japan` `labyrinth`
`wonderfruit-kyoto` `odyssey` `technogaoka`）が該当。

原因は `festivals.html:1463` の `f.genre.map(...)` がガード無しで、
GENRE 未設定のフェスで `Cannot read properties of undefined (reading 'map')` を
投げること。**カードをクリックすると詳細が白紙になる。**本番でも再現する。

## 数字の読み方

- `missing_in_spa` … 静的にあって SPA に無い要素数の合計（大きいほど実害）
- `extra_in_spa` … SPA にあって静的に無い分。0 でなくても異常ではない
- `<項目>_spa` / `<項目>_static` … 項目ごとの実測値

マークアップは SPA と静的で別実装なので、項目ごとに側別のセレクタで数えている
（例: 開催ヒストリーは SPA が `edition-row`、静的が `edition-date`）。
セレクタは `scripts/audit_spa_vs_static.py` の `*_features()` に集約。
**SPA 廃止で SPA 側のマークアップが消えると SPA 列は 0 になる。それが正常。**
