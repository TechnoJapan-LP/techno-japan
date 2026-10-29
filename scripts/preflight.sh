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

CHECK_TIMEOUT="${PREFLIGHT_CHECK_TIMEOUT:-240}"
LOCK_ROOT="${TMPDIR:-/tmp}/techno-japan-preflight.lock"
LOCK_PID="${LOCK_ROOT}/pid"
if ! mkdir "$LOCK_ROOT" 2>/dev/null; then
  old_pid="$(cat "$LOCK_PID" 2>/dev/null || true)"
  if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
    echo "preflight is already running (PID $old_pid); exiting." >&2
    exit 2
  fi
  rm -f "$LOCK_PID"
  rmdir "$LOCK_ROOT" 2>/dev/null || { echo "preflight lock is busy; exiting." >&2; exit 2; }
  mkdir "$LOCK_ROOT" 2>/dev/null || { echo "preflight lock is busy; exiting." >&2; exit 2; }
fi
echo "$$" > "$LOCK_PID"

kill_headless_children() {
  local root child command
  for child in $(pgrep -P "${1:-$$}" 2>/dev/null || true); do
    kill_headless_children "$child"
    command="$(ps -p "$child" -o command= 2>/dev/null || true)"
    case " $command " in
      *" --headless"*|*" headless "*|*--remote-debugging-port=*)
        kill "$child" 2>/dev/null || true
        ;;
    esac
  done
}

cleanup() {
  kill_headless_children
  if [ "$(cat "$LOCK_PID" 2>/dev/null || true)" = "$$" ]; then
    rm -f "$LOCK_PID"
    rmdir "$LOCK_ROOT" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT

FAST=0
[ "${1:-}" = "--fast" ] && FAST=1

pass=0; fail=0; skipped=0
failed_names=()

run() {
  run_timeout "$CHECK_TIMEOUT" "$@"
}

run_timeout() {
  local timeout="$1"; shift
  local name="$1"; shift
  local started now elapsed pid status out_file
  started=$(date +%s)
  echo "  ▶ $name"
  out_file="${TMPDIR:-/tmp}/preflight-$$-${RANDOM}.out"
  ("$@") >"$out_file" 2>&1 &
  pid=$!
  while kill -0 "$pid" 2>/dev/null; do
    now=$(date +%s); elapsed=$((now - started))
    if [ "$elapsed" -ge "$timeout" ]; then
      kill_headless_children "$pid"
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      echo "  ❌ $name — TIMEOUT after ${elapsed}s (limit ${timeout}s)"
      fail=$((fail+1)); failed_names+=("$name (timeout)")
      tail -12 "$out_file" | sed 's/^/      /'
      rm -f "$out_file"
      return
    fi
    sleep 1
  done
  wait "$pid"; status=$?
  now=$(date +%s); elapsed=$((now - started))
  if [ "$status" -eq 0 ]; then
    echo "  ✅ $name (${elapsed}s)"; pass=$((pass+1))
  else
    echo "  ❌ $name (${elapsed}s)"; fail=$((fail+1)); failed_names+=("$name")
    tail -12 "$out_file" | sed 's/^/      /'
  fi
  rm -f "$out_file"
}

skip() {
  printf '  %-46s' "$1"; echo "− 省略（--fast）"; skipped=$((skipped+1))
}

echo "════════════════════════════════════════════════════════════════"
echo " 本番へ出す前の確認"
echo "════════════════════════════════════════════════════════════════"

echo
echo "▸ 生成物とデータ"
run "参照画像の実在"                    node scripts/check_missing_images.mjs
run "フェスの国コード"                  node scripts/check_country.mjs
run "詳細ページを生成できる"            node scripts/build-detail-pages.mjs
run "ビルドの冪等性"                    node scripts/check_build_idempotent.mjs
run "記事見出しのphrase breaks"          node scripts/test_phrase_breaks.mjs
run "回帰のしきい値"                    python3 scripts/check_regressions.py
run "LINEUPの表示数がソースと一致"      node scripts/check_festival_lineup_render.mjs
run "記事データの整合性"                node scripts/check_article_data_integrity.mjs
run "記事本文画像の対応表と置換"        node scripts/check_article_body_images.mjs
run "記事イベントショートコード"        node scripts/check_article_shortcodes.mjs
run "記事の自動リンクと更新日"            node scripts/check_article_links.mjs
run "内部リンクが生きている"            python3 scripts/check_internal_links.py
run "日本語・英語トップURL"              python3 scripts/check_top_links.py
run "構造化データと AI 向けファイル"       node scripts/check_jsonld.mjs
run "タイトル長と終了年"                  node scripts/check_titles.mjs
run "アーティスト詳細ページ"              node scripts/check_artist_pages.mjs
run "CMS の Image Position が届く"      node scripts/check_image_position.mjs
run "ヘッダー・フッターのロゴ"      node scripts/check_header_logo.mjs
run "共通ヘッダー・メニュー・フッター" python3 scripts/check_shared_chrome.py
run "Google 優先ソース導線"           node scripts/check_preferred_source.mjs
run "ハブのSEO・計測ヘッダー"          python3 scripts/check_hub_head.py
run "SNS シェア画像"                    node scripts/check_og_image.mjs
run "大きい画像の配信"                  node scripts/check_image_delivery.mjs
run "画像の軽量版"                      python3 scripts/check_image_derivatives.py
run "記事フィードと関連記事"              node scripts/check_feeds.mjs
run "ハブ用データの整合"                  node scripts/check_data_hub.mjs
run "LINEUP ACT_LABELの解決"             node scripts/check_lineup_label_resolution.mjs
run "LINEUP 非公開アーティストの参照判定" node scripts/check_lineup_draft_refs.mjs
run "EDITIONS欠落フェスの公開補完"        node scripts/check_fetch_data_editions.mjs

echo
echo "▸ キャッシュと配信"
run "?v の上げ忘れが無い"               python3 scripts/check_asset_versions.py
run "生成側に ?v のべた書きが無い"      python3 scripts/check_no_hardcoded_versions.py
run "Service Worker の経路"             node scripts/check_sw_routing.mjs
run "CSS / JS の参照先が実在する"       python3 scripts/check_asset_paths.py
run "APPLY Google Form 対応"            node scripts/check_apply_form.mjs

echo
echo "▸ CMS"
run "開催回（EDITIONS）"                node scripts/check_cms_editions.mjs
run "FESTIVALS name_ja の保持と生成"     node scripts/check_cms_name_ja.mjs
run "VENUES追加4列の保持と生成"          node scripts/check_cms_venue_access.mjs
run "CMS SOUND / GALLERY"                node scripts/check_cms_sound_gallery.mjs
run "CMSの削除の連鎖"                    node scripts/check_cms_delete.mjs
run "CMS ジャンルの往復"                 node scripts/check_cms_genre_roundtrip.mjs
run "著者の候補表示"                    node scripts/check_cms_authors.mjs
run "認証切れの自動復帰"                node scripts/check_cms_auth_retry.mjs
run "LINEUP の入力"                     node scripts/check_cms_lineup.mjs
run "座標の取得"                        node scripts/check_cms_geocode.mjs
run "AI が本文を読む前に確定させる"     node scripts/check_cms_ai_body.mjs
run "Publish 前の関門"                  node scripts/check_cms_publish_guard.mjs
run "GAS VENUES列パッチ"                 node scripts/check_gas_venue_columns.mjs
run "データの取得経路"                  node scripts/check_cms_fetch_path.mjs
run "プレビューが実ページと同じ枠"    node scripts/check_cms_preview_frame.mjs
run "CMSアーティスト本番表示プレビュー" node scripts/check_cms_artist_preview.mjs
run "記事フォームの状態保持"            python3 scripts/check_cms_article_state.py

echo
echo "▸ GAS"
run "AI ハンドラ"                       node scripts/check_gas_ai.mjs
run "リポジトリと GAS 実物の一致"       node scripts/check_gas_sync.mjs

echo
echo "▸ CI 自身"
run "詰まり外しの判断"                  node scripts/check_unstick_queue.mjs
run "画像同期の再試行"                  python3 scripts/check_sync_retry.py
run "本番同期監視の自己テスト"            node scripts/check_production_sync.mjs --self-test

echo
echo "▸ 実際に描画して見るもの"
if [ "$FAST" = "1" ]; then
  skip "ハブページが JS 込みで描ける"
  skip "CMS フォームの重なり"
  skip "地図が全国の会場を出す"
  skip "会場一覧の地図が全都市を出す"
  skip "モバイルの言語切替"
else
  # 実測で単独でも209秒、preflight全体では240秒を超えたため。検査の中身は変えない。
  run_timeout 480 "ハブページが JS 込みで描ける"    python3 scripts/check_hub_pages.py --budget 15000
  run "全ページのスクロール"            node scripts/check_page_scroll.mjs
  run_timeout 600 "読み込み中のずれ（CLS）"       node scripts/check_hub_cls.mjs
  run_timeout 600 "EN画面の可視日本語"       node scripts/check_en_visible_japanese.mjs
  run "CMS フォームの重なり"            node scripts/check_cms_layout.mjs
  run "VENUES 種別フィルタ"              node scripts/check_venue_type_filters.mjs
run "VENUES 詳細ページ"                 node scripts/check_venue_details.mjs
run "VENUES CMSエクスポート"             python3 scripts/check_venue_export_cms.py
run "ARTICLE本番表示プレビュー"          node scripts/check_cms_article_generated_preview.mjs
  run "記事シェアボタンの描画サイズ"          node scripts/check_article_share.mjs
  run_timeout 120 "記事見出しの折り返し"        node scripts/check_article_heading_breaks.mjs
  run_timeout 120 "TOP THIS WEEK"             node scripts/check_top_this_week.mjs
run "TOP ARTISTSランダム表示"             node scripts/check_top_artists.mjs
  run "フェス詳細の行動計測"                node scripts/check_festival_tracking.mjs
  run "地図が全国の会場を出す"          node scripts/check_map_nationwide.mjs
  run "会場一覧の地図が全都市を出す"    node scripts/check_venue_maps.mjs
  run "フェス詳細ACCESS地図"            node scripts/check_festival_access_map.mjs
  [ -f scripts/check_mobile_language_toggles.mjs ] \
    && run "モバイルの言語切替"         node scripts/check_mobile_language_toggles.mjs
  [ -f scripts/check_search_modal.mjs ] \
    && run "モバイル検索モーダル"         node scripts/check_search_modal.mjs
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
echo
# Publish 経路は7回壊れ、うち3回は直前の修正が引き金だった（§9-81）。
# モックの検査が全部緑でも壊れていたので、変更を検出したら実機確認を促す。
if git diff --name-only origin/main 2>/dev/null | grep -qE "LP/cms\.js|scripts/gas-update/"; then
  echo "════════════════════════════════════════════════════════════════"
  echo " ⚠️  Publish の経路（cms.js / GAS）に変更があります"
  echo
  echo " **モックの検査が全部緑でも、実機では壊れていたことが3回あります。**"
  echo " （§9-67 → §9-69 / §9-80 と、修正が次の失敗を呼んだ）"
  echo
  echo " 完了と呼ぶ前に:"
  echo "   1. CMS で実際に Publish Now を1回押す"
  echo "   2. 'cms: publish data.js' のコミットが増えたことを確認する"
  echo "   3. 未確認なら handoff に「実機未確認」と明記する"
fi
echo "════════════════════════════════════════════════════════════════"
