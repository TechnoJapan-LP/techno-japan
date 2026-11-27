# 配信を GitHub Pages から Cloudflare へ移す（計画）

2026-11-28 ユーザー依頼「Cloudflare への移行計画を進めて」。本番を止めずに、並行配信で試してから切り替える。

## 今の状態（2026-11-28 実測）

| 項目 | 値 |
|---|---|
| 配信 | GitHub Pages（`server: GitHub.com`、全ファイル `cache-control: max-age=600`） |
| 配信する中身 | `LP/`（`LP/app` は除外）。4,363 ファイル・約 384MB。25MB を超えるファイルは 0 件 |
| デプロイ経路 | `deploy-pages.yml`（main への push）と `publish-pipeline.yml`（CMS の Publish）の 2 本。どちらも最後に `upload-pages-artifact` → `deploy-pages` |
| ドメイン | `techno-japan.media`（`LP/CNAME`）。`www` は `technojapan-lp.github.io` への CNAME |
| DNS | NS1（`dns1〜4.p06.nsone.net`）。登録事業者の DNS と思われる（要確認） |
| DNS の中身（見えている分） | A ×4（GitHub）、MX `smtp.google.com`（Google Workspace のメール）、TXT（google-site-verification・SPF）、`google._domainkey`（DKIM）、`_dmarc` |
| 404 | `LP/404.html`（GitHub Pages が自動で使う） |
| CSP | 各ページの `<meta http-equiv>` で指定 |
| URL の形 | `.html` 付き。canonical・sitemap（572 件）も `.html` 付き |

## 方式: Cloudflare Workers の静的配信（Pages ではなく）

**Cloudflare Pages は使わない。** Pages は `/festivals/rural.html` を `/festivals/rural` へ自動で転送し、止められない。
canonical・sitemap・Google ニュース・既存の被リンクが全部 `.html` 付きなので、全ページの URL が変わる。

Workers の静的配信（static assets）は `html_handling: "none"` で、今と同じ URL のまま配信できる。
Cloudflare も新規は Workers を推奨している。無料プランの上限（2 万ファイル・1 ファイル 25MB）に収まる。

設定（`wrangler.jsonc` の想定）:

```jsonc
{
  "name": "techno-japan",
  "compatibility_date": "2025-06-01",
  "assets": {
    "directory": "./LP",
    "html_handling": "none",
    "not_found_handling": "404-page"
  }
}
```

- `LP/app` は今と同じく配信前に消す（`.assetsignore` でも可）。
- `CNAME` ファイルは Cloudflare では不要（残しても害はない）。

## 移して良くなること

1. **キャッシュをファイルごとに決められる**（`_headers`）。
   - `?v=` 付きの JS/CSS、`/images/` の webp: 長期キャッシュ（例: 30 日）
   - HTML・`data.js`・`data-hub.js`・`sw.js`: 短く（今と同じ 10 分以下か、毎回確認）
   - `cms.html` / `cms.js`: 毎回確認（今は 10 分キャッシュのため、CMS 更新後に Cmd+Shift+R が必要）
2. **セキュリティヘッダーを本来の形で出せる**: CSP・`X-Content-Type-Options`・`Referrer-Policy`・
   `frame-ancestors`（CMS の枠埋め込み禁止を meta ではなくヘッダーで）。
3. **公開の一時失敗が減る見込み**: GitHub の「No artifacts named github-pages」系の失敗がなくなる。

## やらないこと

- URL の形を変えない（`.html` のまま）。
- 生成・Publish の仕組み（スプレッドシート → GAS → data.js → 生成）は変えない。変えるのは「最後の配信先」だけ。
- 切り替え前に GitHub Pages を止めない（戻せるように残す）。

## 段階

### 段階0: 準備（ユーザー作業）
1. Cloudflare の無料アカウントを作る。
2. API トークンを作る（テンプレート「Edit Cloudflare Workers」。アカウント ID も控える）。Workers の画面で workers.dev のサブドメインを決めておく。
3. GitHub のリポジトリ Secrets に `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録する。
4. ドメインの登録事業者の管理画面で、**今の DNS レコードの一覧**を控える（画面の写しで可）。
   Buttondown など、外から見えないレコードがあり得るため。

### 段階1: 並行配信（本番は GitHub Pages のまま）
- 2 本のデプロイの最後に「Cloudflare へも配る」手順を足す。Secrets が無ければ何もしない。
  GitHub Pages への配信は今のまま。失敗しても本番の配信は止めない（警告だけ）。
- 配信先は `techno-japan.<アカウント名>.workers.dev`（仮のアドレス）。

### 段階2: 仮のアドレスで確かめる
- 全 HTML の応答コード、`.html` のまま 200 になること、存在しない URL で 404.html が出ること。
- TOP・ハブ・詳細（JA/EN・PC/スマホ）の表示、検索、地図、CMS のログインと読み取り。
  - 地図（CARTO）は本番ドメイン限定のキーなので、仮アドレスでは OSM に切り替わるのが正常。
  - GAS は CMS からの呼び出しで、配信元に依存しない（確認だけ）。
- `_headers` を入れて、キャッシュとヘッダーが意図どおりかを `curl -I` で見る。
- 同じ方法で、今の本番と表示速度を並べて測る（AGENTS.md「実測」）。

### 段階3: DNS を Cloudflare へ移す（切り替え前日まで）
- Cloudflare にドメインを追加し、**全レコードを今と同じ値で**作る（A は GitHub のまま。メール関係は必ず「DNS only」）。
- 登録事業者でネームサーバーを Cloudflare に変える。この時点ではまだ GitHub Pages に向いているので、見た目は変わらない。
- 浸透後、メールの送受信（Google Workspace・Buttondown）、Search Console の所有権確認を確かめる。

### 段階4: 切り替え
- Workers にカスタムドメイン `techno-japan.media` と `www` を付ける（A / CNAME が Cloudflare に置き換わる）。
- 直後に段階2の確認を本番ドメインで再実施。地図（CARTO）が本番キーで出ること。
- Search Console・GA で異常がないかを数日見る。

### 段階5: 片付け（1〜2 週間後）
- GitHub Pages への配信手順を外す。`LP/CNAME` を外すか残すか判断。
- AGENTS.md・監視（production-sync-watchdog 等）の「GitHub Pages」前提の記述を直す。

## 戻し方
- 段階4の後に問題が出たら、Workers のカスタムドメインを外し、A レコードを GitHub（185.199.108〜111.153）・`www` の CNAME を `technojapan-lp.github.io` に戻す。GitHub Pages は段階5まで並行で更新され続けているので、中身は最新のまま。

## 判断待ち
- 段階0の作業（アカウント・トークン・Secrets・DNS 一覧）をユーザーが行う。
- ドメインの登録事業者の確認（NS1 を使っている事業者）。
