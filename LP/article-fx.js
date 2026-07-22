/* ==============================================================
   ARTICLE FX — 記事ページのスクロールインタラクション
   方針: プログレッシブエンハンスメント（JS無しでも記事は完全に読める）。
   レイアウトを動かさない（transform / clip-path のみ）= CLSゼロ。
   prefers-reduced-motion では演出を止め、プログレスバーだけ残す。
   ============================================================== */
(function(){
  'use strict';
  var body = document.querySelector('.article-body');
  if (!body) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. 読了プログレスバー（上端2pxのアクセントライン） ---------- */
  var bar = document.createElement('div');
  bar.className = 'fx-progress';
  bar.innerHTML = '<div class="fx-progress-fill"></div>';
  document.body.appendChild(bar);
  var fill = bar.firstChild;
  var article = document.querySelector('.article-detail') || document.body;
  function updateProgress(){
    var r = article.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    fill.style.transform = 'scaleX(' + p + ')';
  }

  /* ---------- 2. 本文画像を figure 化: 交互リズム + FIG索引 + ワイプ枠 ---------- */
  // Quill出力は <p><img></p>。画像だけの <p> を <figure> に置き換える。
  var imgs = [].slice.call(body.querySelectorAll('img'));
  var figIndex = 0;
  imgs.forEach(function(img){
    var p = img.closest('p');
    var textOnly = p && p.textContent.trim() === '' && p.querySelectorAll('img').length === 1;
    var host = textOnly ? p : img;           // 画像単独の<p>なら<p>ごと置換
    figIndex++;
    var fig = document.createElement('figure');
    var rhythm = figIndex % 3 === 1 ? 'fx-full' : (figIndex % 3 === 2 ? 'fx-right' : 'fx-left');
    fig.className = 'fx-img ' + rhythm;
    var frame = document.createElement('div');
    frame.className = 'fx-frame';
    var cap = document.createElement('figcaption');
    cap.className = 'fx-fig';
    cap.textContent = 'FIG.' + String(figIndex).padStart(2, '0');
    host.parentNode.replaceChild(fig, host);
    frame.appendChild(img);
    fig.appendChild(frame);
    fig.appendChild(cap);
    img.loading = 'lazy';
    img.decoding = 'async';
    // 縦位置(ポートレート)は原寸で置くと巨大になるので高さを抑える
    var markPortrait = function(){ if (img.naturalHeight > img.naturalWidth * 1.15) fig.classList.add('fx-portrait'); };
    if (img.complete && img.naturalWidth) markPortrait(); else img.addEventListener('load', markPortrait, { once:true });
  });

  /* ---------- 3. リビール対象の指定 ---------- */
  var targets = [].slice.call(body.querySelectorAll('p, h2, h3, blockquote, figure.fx-img'));
  var specs = document.querySelector('.article-specs');
  var excerpt = document.querySelector('.article-excerpt');
  if (specs) targets.unshift(specs);
  if (excerpt) targets.unshift(excerpt);
  var hero = document.querySelector('.article-hero');
  if (hero) hero.classList.add('fx-hero');

  if (reduced || !('IntersectionObserver' in window)) {
    // 演出なし: 全て即時表示、バーだけ動かす
    targets.forEach(function(t){ t.classList.add('fx-on'); });
    if (hero) hero.classList.add('fx-on');
    window.addEventListener('scroll', updateProgress, { passive:true });
    updateProgress();
    return;
  }

  targets.forEach(function(t){ t.classList.add('fx-reveal'); });

  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      // 同時に画面に入った要素は 60ms ずつずらす（機械的なステップ感）
      var delay = (staggerQueue.push(el) - 1) % 5 * 60;
      setTimeout(function(){ el.classList.add('fx-on'); }, delay);
    });
    // キューはフレームごとにリセット
    requestAnimationFrame(function(){ staggerQueue.length = 0; });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  var staggerQueue = [];
  targets.forEach(function(t){ io.observe(t); });

  /* ---------- 4. パララックス（画像内部のみ transform） ---------- */
  var pxFrames = [].slice.call(document.querySelectorAll('.fx-frame'));
  if (hero) {
    var heroImg = hero.querySelector('img');
    requestAnimationFrame(function(){ hero.classList.add('fx-on'); }); // ヒーローは即リビール
  }
  var ticking = false;
  function parallax(){
    ticking = false;
    var vh = window.innerHeight;
    pxFrames.forEach(function(f){
      var r = f.getBoundingClientRect();
      if (r.bottom < -80 || r.top > vh + 80) return;
      // フレームのビューポート内進行度 -1..1 → 内部画像を ±5% スライド
      var prog = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
      var img = f.firstElementChild;
      if (img) img.style.transform = 'translateY(' + (prog * 5).toFixed(2) + '%) scale(1.11)';
    });
    if (hero && heroImg) {
      var hr = hero.getBoundingClientRect();
      if (hr.bottom > 0) heroImg.style.transform = 'translateY(' + Math.min(18, -hr.top / 14).toFixed(2) + 'px) scale(1.04)';
    }
    updateProgress();
  }
  function onScroll(){ if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });
  parallax();
})();
