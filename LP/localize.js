/* ==============================================================
   TECHNO JAPAN — localize.js
   ハブ（festivals / artists / venues / news / index）が data.js の
   値を描くときの言語選択。

   なぜ実行時に分岐するのか:
     EN ハブは build-detail-pages.mjs の enHubFromJa が JA ハブから
     機械生成する。あれは正規表現置換なので、JS の式（f.desc → f.desc_en）
     を書き換えさせると `f.desc_en_en` や `festival-desc-jp` にも当たる。
     AGENTS.md が禁じている「HTML/コードを正規表現で読む」の再来になる
     （§9-16 で1日に2回踏み、152行を誤削除している）。
     JS 本体を JA/EN で完全に同一に保ち、<html lang> だけを見て分ける。
     こうすると JA と EN の行数比較が常に一致し、
     「JA だけ直して EN を再生成し忘れる」事故（§9-21）も起きない。

   【重要】このファイルに defer を付けないこと。
     ハブのインライン描画スクリプトはパース中に同期実行され、
     その時点で tjLocalized を呼ぶ。defer にすると描画時には未定義で、
     全カードがフォールバック側に落ちる。2026-08-03 に headless Chrome で
     実測して確認済み（inline実行時 UNDEFINED / DOMContentLoaded時 defined）。
     data.js・image-dimensions.js が defer 無しなのと同じ理由。

   【重複の申し送り】同じ規則が scripts/build-detail-pages.mjs の
     localizedValue() にもある（詳細ページはサーバ側で解決するため）。
     片方だけ直さないこと。AGENTS.md「言語分岐」に記載。
   ============================================================== */
(function () {
  'use strict';

  // <html lang> は enHubFromJa が EN 側で 'en' に書き換える。
  // 想定外の値は JA 扱いにする（EN と誤判定して英語列が空だと、
  // フォールバックを経ても表示が痩せるため）。
  window.TJ_LANG = document.documentElement.lang === 'en' ? 'en' : 'ja';

  /* primary は既存互換の値。言語別値が未入力なら primary、さらに反対言語へ
     フォールバックし、列追加直後でも表示を欠落させない。
     build-detail-pages.mjs の localizedValue() と同一規則。
     あちらは lang を引数で受けるが、ハブは1ページ1言語なので
     TJ_LANG から暗黙に取る。 */
  window.tjLocalized = function (primary, ja, en) {
    var p = String(primary == null ? '' : primary).trim();
    var j = String(ja == null ? '' : ja).trim();
    var e = String(en == null ? '' : en).trim();
    return window.TJ_LANG === 'en' ? (e || p || j) : (j || p || e);
  };

  // data.js の画像は従来 `images/...`（JAハブでは正常な相対パス）だが、
  // /en/ 配下では /en/images/... に解決される。共有ハブでは常にルート相対へ。
  window.tjAssetPath = function (value) {
    var s = String(value == null ? '' : value).trim();
    if (!s || /^(?:https?:|data:|\/)/i.test(s)) return s;
    return '/' + s;
  };
})();
