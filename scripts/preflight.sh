#!/usr/bin/env bash
#
# 本番へ出す前に、必ずこれを通す。
# ==================================================================
#
# ■ なぜ必要か（AUDIT §9-77）
#
#   このリポジトリは main へ push した時点で本番へ出る。
#   **push が「保存」ではなく「公開」である。**にもかかわらず、
#   検査は CI 側にしか無く、押した後に落ちる作りだった。
#
#   2026-08-07〜12 の2週間で、本番が壊れた／止まった事故が続いた。
#   ・デプロイ失敗6件（うち3件は ?v の上げ忘れ。§9-58）
#   ・EDITIONS の重複1行で Publish が丸1日失敗（§9-66）
#   ・翻訳が古い版のまま3日間動いていた（§9-72）
#   ・地図が東京しか出していなかった（§9-76）
#
#   検査そのものは23本あった。**まとめて回す手段が無かっただけ。**
#   「テストしてから本番へ出す」を、覚えておく約束ではなく
#   **1つのコマンド**にする。
#
# ■ 使い方
#
#     bash scripts/preflight.sh          # 全部（ブラウザ検査を含む / 数分）
#     bash scripts/preflight.sh --fast   # ブラウザ検査を飛ばす（下書き確認用）
#
#   **--fast で通っても本番へ出してはいけない。**
#   実際に描画しないと分からない不具合が繰り返し起きている
#   （入力欄の重なり §9-63 / 地図の初期化 §9-76）。
#
# ■ ここを通っても、まだ足りないもの
#
#   ・CMS の画面を実際に操作する確認（認証が要るため自動化していない）
#   ・GAS を貼り替えたときの再デプロイ
#   これらは reports/handoff.md に「未確認」と明記すること。
# ==================================================================

set -uo pipefail
cd "$(dirname "$0")/.."

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

pass=0; fail=0; skipped=0
failed_names=()

run() {
  local name="$1"; shift
  printf '  %-46s' "$name"
  if out=$("$@" 2>&1); then
    echo "✅"; pass=$((pass+1))
  else
    echo "❌"; fail=$((fail+1)); failed_names+=("$name")
    echo "$out" | tail -12 | sed 's/^/      /'
  fi
}

skip() {
  printf '  %-46s' "$1"; echo "− 省略（--fast）"; skipped=$((skipped+1))
}

echo "════════════════════════════════════════════════════════════════"
echo " 本番へ出す前の確認"
echo "════════════════════════════════════════════════════════════════"

echo
echo "▸ 生成物とデータ"
run "詳細ページを生成できる"            node scripts/build-detail-pages.mjs
run "回帰のしきい値"                    python3 scripts/check_regressions.py
run "記事データの整合性"                node scripts/check_article_data_integrity.mjs
run "内部リンクが生きている"            python3 scripts/check_internal_links.py
run "画像の軽量版"                      python3 scripts/check_image_derivatives.py

echo
echo "▸ キャッシュと配信"
run "?v の上げ忘れが無い"               python3 scripts/check_asset_versions.py
run "生成側に ?v のべた書きが無い"      python3 scripts/check_no_hardcoded_versions.py
run "Service Worker の経路"             node scripts/check_sw_routing.mjs

echo
echo "▸ CMS"
run "開催回（EDITIONS）"                node scripts/check_cms_editions.mjs
run "著者の候補表示"                    node scripts/check_cms_authors.mjs
run "認証切れの自動復帰"                node scripts/check_cms_auth_retry.mjs
run "LINEUP の入力"                     node scripts/check_cms_lineup.mjs
run "座標の取得"                        node scripts/check_cms_geocode.mjs
run "AI が本文を読む前に確定させる"     node scripts/check_cms_ai_body.mjs
run "Publish 前の関門"                  node scripts/check_cms_publish_guard.mjs
run "データの取得経路"                  node scripts/check_cms_fetch_path.mjs
run "記事フォームの状態保持"            python3 scripts/check_cms_article_state.py

echo
echo "▸ GAS"
run "AI ハンドラ"                       node scripts/check_gas_ai.mjs
run "リポジトリと GAS 実物の一致"       node scripts/check_gas_sync.mjs

echo
echo "▸ CI 自身"
run "詰まり外しの判断"                  node scripts/check_unstick_queue.mjs
run "画像同期の再試行"                  python3 scripts/check_sync_retry.py

echo
echo "▸ 実際に描画して見るもの"
if [ "$FAST" = "1" ]; then
  skip "ハブページが JS 込みで描ける"
  skip "CMS フォームの重なり"
  skip "地図が全国の会場を出す"
  skip "会場一覧の地図が全都市を出す"
  skip "モバイルの言語切替"
else
  run "ハブページが JS 込みで描ける"    python3 scripts/check_hub_pages.py --budget 15000
  run "CMS フォームの重なり"            node scripts/check_cms_layout.mjs
  run "地図が全国の会場を出す"          node scripts/check_map_nationwide.mjs
  run "会場一覧の地図が全都市を出す"    node scripts/check_venue_maps.mjs
  [ -f scripts/check_mobile_language_toggles.mjs ] \
    && run "モバイルの言語切替"         node scripts/check_mobile_language_toggles.mjs
fi

echo
echo "════════════════════════════════════════════════════════════════"
if [ "$fail" -gt 0 ]; then
  echo " ❌ ${fail}件 失敗（成功 ${pass} / 省略 ${skipped}）"
  echo
  echo " 落ちたもの:"
  for n in "${failed_names[@]}"; do echo "   ・$n"; done
  echo
  echo " **本番へ出さないこと。**直してから、もう一度これを通す。"
  echo "════════════════════════════════════════════════════════════════"
  exit 1
fi

if [ "$skipped" -gt 0 ]; then
  echo " ⚠️  ${pass}件 成功・${skipped}件 省略"
  echo
  echo " **--fast は下書き確認用。このまま本番へ出してはいけない。**"
  echo " 出す前に、省略なしで通すこと:  bash scripts/preflight.sh"
  echo "════════════════════════════════════════════════════════════════"
  exit 0
fi

echo " ✅ 全${pass}件 成功"
echo
echo " 残っている確認（自動化できないもの）:"
echo "   ・CMS を実際に操作したか（入力→保存→再表示）"
echo "   ・GAS を触ったなら再デプロイしたか"
echo "   → 未確認なら reports/handoff.md に「未確認」と明記する"
echo "════════════════════════════════════════════════════════════════"
