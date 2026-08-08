/* ==============================================================
   ARTICLE FX — 記事ページのスクロールインタラクション
   方針: プログレッシブエンハンスメント（JS無しでも記事は完全に読める）。
   レイアウトを動かさない（transform / clip-path のみ）= CLSゼロ。
   prefers-reduced-motion では演出を止め、プログレスバーだけ残す。

   v2: window.articleFX() として再実行可能に。
   - 静的 /articles/*.html では自動起動（従来どおり）
   - news.html の #article/... ビューでは描画後に articleFX() を呼ぶ
   - 横長画像は左右寄せを基本にし、極端に横長な画像だけ fx-bleed にする
   ============================================================== */
(function(){
  'use strict';

  var state = null; // { bar, onScroll, io }

  function teardown(){
    if (!state) return;
    if (state.bar && state.bar.parentNode) state.bar.parentNode.removeChild(state.bar);
    if (state.onScroll) {
      window.removeEventListener('scroll', state.onScroll);
      window.removeEventListener('resize', state.onScroll);
    }
    if (state.io) state.io.disconnect();
    state = null;
  }

  function init(){
    teardown();
    var body = document.querySelector('.article-body');
    if (!body) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. 読了プログレスバー（上端2pxのアクセントライン） ---------- */
    var bar = document.createElement('div');
    bar.className = 'fx-progress';
    bar.innerHTML = '<div class="fx-progress-fill"></div>';
    document.body.appendChild(bar);
    // news.html 旧読了バーとの二重表示防止（deep-link時の実行順に依らず消す）
    var rp = document.getElementById('read-progress');
    if (rp) rp.classList.remove('active');
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
    // 横長画像も左右のリズムを優先する。極端なシネマ比率だけ全幅にする。
    var imgs = [].slice.call(body.querySelectorAll('img'));
    var figIndex = 0;
    imgs.forEach(function(img){
      if (img.closest('figure.fx-img')) return;   // 再実行対策（処理済みはスキップ）
      var p = img.closest('p');
      var textOnly = p && p.textContent.trim() === '' && p.querySelectorAll('img').length === 1;
      var host = textOnly ? p : img;           // 画像単独の<p>なら<p>ごと置換
      figIndex++;
      var fig = document.createElement('figure');
      var requested = img.dataset.layout;
      var rhythm = ['contained', 'left', 'right', 'full', 'compact'].indexOf(requested) >= 0
        ? (requested === 'contained' ? 'fx-full' : 'fx-' + requested)
        : (figIndex % 3 === 1 ? 'fx-full' : (figIndex % 3 === 2 ? 'fx-right' : 'fx-left'));
      var compact = !requested && figIndex % 4 === 0 ? ' fx-compact' : '';
      fig.className = 'fx-img ' + rhythm + compact;
      if (img.dataset.position) fig.dataset.position = img.dataset.position;
      if (img.dataset.crop && /^(16:10|4:3|1:1)$/.test(img.dataset.crop)) fig.dataset.crop = img.dataset.crop;
      if (img.dataset.zoom) fig.dataset.zoom = img.dataset.zoom;
      if (img.dataset.x) fig.dataset.x = img.dataset.x;
      if (img.dataset.y) fig.dataset.y = img.dataset.y;
      if (img.dataset.pairId) fig.dataset.pairId = img.dataset.pairId;
      if (img.dataset.zoom) fig.style.setProperty('--crop-zoom', img.dataset.zoom);
      if (img.dataset.x) fig.style.setProperty('--crop-x', img.dataset.x + '%');
      if (img.dataset.y) fig.style.setProperty('--crop-y', img.dataset.y + '%');
      var frame = document.createElement('div');
      frame.className = 'fx-frame';
      var grid = document.createElement('div');
      grid.className = 'fx-gridlines';
      var cap = document.createElement('figcaption');
      cap.className = 'fx-fig';
      cap.textContent = 'FIG.' + String(figIndex).padStart(2, '0');
      host.parentNode.replaceChild(fig, host);
      frame.appendChild(img);
      frame.appendChild(grid);
      fig.appendChild(frame);
      fig.appendChild(cap);
      img.loading = 'lazy';
      img.decoding = 'async';
      // 実寸が分かった時点で形状クラスを決める:
      //   横長(>=1.4) → 左右寄せを維持
      //   極端な横長(>=1.9) → fx-bleed（全幅・グリッドライン点灯）
      //   縦長(>1.15) → fx-portrait（高さ制限）
      var classify = function(){
        if (!img.naturalWidth || !img.naturalHeight) return;
        if (img.naturalWidth >= img.naturalHeight * 1.9) fig.classList.add('fx-bleed');
        else if (img.naturalHeight > img.naturalWidth * 1.15) fig.classList.add('fx-portrait');
      };
      if (img.complete && img.naturalWidth) classify(); else img.addEventListener('load', classify, { once:true });
    });

    // 同じ pair-id の連続画像を左右50:50の1セットにまとめる
    var pairGroups = {};
    Array.from(body.querySelectorAll('figure.fx-img[data-pair-id]')).forEach(function(fig){
      var id = fig.dataset.pairId;
      (pairGroups[id] || (pairGroups[id] = [])).push(fig);
    });
    Object.keys(pairGroups).forEach(function(id){
      var figs = pairGroups[id];
      if (figs.length !== 2) return;
      var pair = document.createElement('div');
      pair.className = 'fx-image-pair';
      figs[0].parentNode.insertBefore(pair, figs[0]);
      figs.forEach(function(fig){ pair.appendChild(fig); });
    });

    /* ---------- 3. リビール対象の指定 ---------- */
    var targets = [].slice.call(body.querySelectorAll('p, h2, h3, blockquote, figure.fx-img'));
    var specs = document.querySelector('.article-specs');
    var excerpt = document.querySelector('.article-excerpt');
    if (specs) targets.unshift(specs);
    if (excerpt) targets.unshift(excerpt);
    var hero = document.querySelector('.article-hero');
    if (hero) hero.classList.add('fx-hero');

    state = { bar: bar, onScroll: null, io: null };

    if (reduced || !('IntersectionObserver' in window)) {
      // 演出なし: 全て即時表示、バーだけ動かす
      targets.forEach(function(t){ t.classList.add('fx-on'); });
      if (hero) hero.classList.add('fx-on');
      state.onScroll = updateProgress;
      window.addEventListener('scroll', updateProgress, { passive:true });
      updateProgress();
      return;
    }

    targets.forEach(function(t){ if (!t.classList.contains('fx-on')) t.classList.add('fx-reveal'); });

    var staggerQueue = [];
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
    targets.forEach(function(t){ io.observe(t); });
    state.io = io;

    /* ---------- 4. パララックス（画像内部のみ transform） ---------- */
    var pxFrames = [].slice.call(document.querySelectorAll('.fx-frame'));
    var heroImg = hero ? hero.querySelector('img') : null;
    if (hero) requestAnimationFrame(function(){ hero.classList.add('fx-on'); }); // ヒーローは即リビール
    var ticking = false;
    function parallax(){
      ticking = false;
      var vh = window.innerHeight;
      pxFrames.forEach(function(f){
        var r = f.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        // フレームのビューポート内進行度 -1..1 → 内部画像をスライド。
        // 全幅(fx-bleed)はスケール・振幅を抑えめに（拡大ボケと酔いを防ぐ）
        var bleed = f.parentNode.classList.contains('fx-bleed');
        var amp = bleed ? 3 : 5;
        var scale = bleed ? 1.06 : 1.11;
        var prog = ((r.top + r.height / 2) - vh / 2) / (vh / 2 + r.height / 2);
        var img = f.firstElementChild;
        if (img) img.style.transform = 'translateY(' + (prog * amp).toFixed(2) + '%) scale(' + scale + ')';
      });
      if (hero && heroImg) {
        var hr = hero.getBoundingClientRect();
        if (hr.bottom > 0) heroImg.style.transform = 'translateY(' + Math.min(18, -hr.top / 14).toFixed(2) + 'px) scale(1.04)';
      }
      updateProgress();
    }
    function onScroll(){ if (!ticking) { ticking = true; requestAnimationFrame(parallax); } }
    state.onScroll = onScroll;
    window.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', onScroll, { passive:true });
    parallax();
  }

  window.articleFX = init;
  window.articleFX.teardown = teardown;

  // 静的記事ページでは自動起動（news.html は描画後に articleFX() を明示的に呼ぶ）
  if (document.querySelector('.article-body')) init();
})();
