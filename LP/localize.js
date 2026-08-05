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

  /* HTML エスケープ。innerHTML に値を差し込む前に必ず通す。
     テンプレートリテラルで組み立てた文字列を innerHTML に代入する箇所が
     ハブ全体で71ある。そのうち攻撃者が制御できるのは URL パラメータ由来の
     値だけで、2026-08-06 の監査では news.html の ?tag= が実際に発火した
     （<img src=x onerror=...> が実行された）。AUDIT §9-44。

     data.js 由来の値は CMS 経由なので現時点では信頼できるが、
     「信頼できる入力だから素通しでよい」は入力経路が増えたときに崩れる。
     文字列を HTML として解釈させる箇所では、出所を問わず通すのが安全側。 */
  window.tjEscapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* ---------- 背景画像の遅延読み込み ----------

     ブラウザの loading="lazy" は <img> にしか効かない。
     CSS の background-image は画面外でも即座に取りに行く。

     2026-08-06 に実測したところ、トップの初回訪問は 2.82MB で
     そのうち 2.70MB が画像だった（412x915 の viewport）。
     festivals.html は <img loading="lazy"> を使っているが、
     トップのフェス行・アーティスト・会場カードと artists.html の
     カードはすべて background-image なので、1枚も遅延していなかった。
     適用後は 1.38MB / 0.11MB。AUDIT §9-45。

     使い方: テンプレートでは style ではなく tjLazyBgAttr(url) を展開し、
     innerHTML を入れ終わったら tjApplyLazyBackgrounds(root) を呼ぶ。
     画面に近づいた時点で style.backgroundImage を立てる。
     rootMargin を広めに取ってあるので、スクロールして到達する頃には
     読み終わっている（体感は変えずに初回の転送だけ減らす）。

     IntersectionObserver が無い環境では即座に全部立てる。
     「遅延できないなら表示しない」にはしないこと。

     【検査の申し送り】遅延させた画像は style 属性に現れないため、
     scripts/check_hub_pages.py の画像検査に映らなくなる。
     あちらは [data-bg] と element.style の両方を見るようにしてある。
     属性名を変えるなら両方直すこと。 */
  window.tjLazyBgAttr = function (url) {
    var u = window.tjAssetPath(url);
    return u ? ' data-bg="' + window.tjEscapeHtml(u) + '"' : '';
  };

  var lazyBgObserver = null;
  window.tjApplyLazyBackgrounds = function (root) {
    var scope = root || document;
    var targets = scope.querySelectorAll ? scope.querySelectorAll('[data-bg]') : [];
    if (!targets.length) return;

    function show(el) {
      var url = el.getAttribute('data-bg');
      if (!url) return;
      el.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
      el.removeAttribute('data-bg');
    }

    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) show(targets[i]);
      return;
    }
    if (!lazyBgObserver) {
      lazyBgObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          show(entry.target);
          obs.unobserve(entry.target);
        });
      }, { rootMargin: '600px 0px' });
    }
    for (var j = 0; j < targets.length; j++) lazyBgObserver.observe(targets[j]);
  };
})();
