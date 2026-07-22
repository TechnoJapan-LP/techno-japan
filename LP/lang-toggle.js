/* ==============================================================
   LANG TOGGLE — 詳細ページ（festival/venue/artist）の説明文だけを
   日本語⇔英語で切り替える。ページ全体の言語（/en/）とは独立した
   軽量な「その場切替」。両言語がある時だけサーバがトグルを出す。
   選択は localStorage に保存し、閲覧中は他ページでも引き継ぐ。
   ============================================================== */
(function () {
  'use strict';
  var groups = document.querySelectorAll('.detail-body.bilingual');
  if (!groups.length) return;
  var KEY = 'tj-desc-lang';
  var pref = null;
  try { pref = localStorage.getItem(KEY); } catch (e) {}

  function apply(root, lang) {
    var btns = root.querySelectorAll('.lang-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('is-active', btns[i].getAttribute('data-lang') === lang);
    var bodies = root.querySelectorAll('.lang-body');
    for (var j = 0; j < bodies.length; j++) bodies[j].hidden = bodies[j].getAttribute('data-lang') !== lang;
  }

  function has(root, lang) { return !!root.querySelector('.lang-body[data-lang="' + lang + '"]'); }

  // 保存済みの好みがあれば初期表示を合わせる（両言語が揃うブロックのみ）
  if (pref) {
    for (var g = 0; g < groups.length; g++) if (has(groups[g], pref)) apply(groups[g], pref);
  }

  for (var k = 0; k < groups.length; k++) {
    (function (root) {
      var btns = root.querySelectorAll('.lang-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', function () {
          var lang = this.getAttribute('data-lang');
          try { localStorage.setItem(KEY, lang); } catch (e) {}
          for (var m = 0; m < groups.length; m++) if (has(groups[m], lang)) apply(groups[m], lang);
        });
      }
    })(groups[k]);
  }
})();
