#!/usr/bin/env node
/**
 * CMS の記事フォームで、要素が重なっていないかを実測する。
 *
 * ■ 何を守るか（AUDIT §9-63）
 *
 *   2026-08-09 に「BODY の下の STATUS / AUTHOR が被って見えない」という
 *   報告があった。実測すると、本文エディタの枠（1751-2289）から
 *   画像レイアウトツールバー（2370-2426）が完全にはみ出し、
 *   その下の AUTHOR 欄（2384-2422）を覆っていた。
 *   **AUTHOR が見えず、押せない状態だった。**
 *
 *   CSS の重なりは、コードを読んでも分からない。実際に描画して
 *   矩形を測るしかない。
 *
 * ■ 認証について
 *
 *   cms.html は読み込み時に prompt() を出し、失敗すると body を
 *   「Access denied」で差し替える（§9-44）。**LP のファイルは変更せず、
 *   配信時に checkAuth だけを素通しさせて**測る。
 *   GAS への通信も握って外へ出さない。
 *
 * ■ 判定
 *
 *   画像ツールバーが STATUS / AUTHOR / PUBLISH AT と重ならないこと。
 *   集中モード・ソース表示・プレビューでも枠内に収まること。
 *
 * 使い方:
 *   node scripts/check_cms_layout.mjs
 */

import http from 'node:http'; import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const ROOT=path.join(process.cwd(),'LP');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
 let p=decodeURIComponent(u.pathname); if(p==='/')p='/cms.html';
 const f=path.join(ROOT,p);
 if(!f.startsWith(ROOT)||!fs.existsSync(f)){res.writeHead(404);return res.end();}
 let buf=fs.readFileSync(f);
 if(p==='/cms.js'){
   let t=buf.toString('utf8');
   // テスト専用（LP は変更しない）: 認証を素通しし、GAS 通信を握る
   t=t.replace('async function checkAuth(){','async function checkAuth(){ AUTH_TOKEN="t"; return true;');
   t='window.__of=window.fetch;window.fetch=async(u,o)=>String(u).includes("script.google.com")'
     +'?{ok:true,status:200,clone(){return this},json:async()=>({status:"ok",rows:[],sheets:{}})}'
     +':window.__of(u,o);window.prompt=()=>"x";\n'+t;
   buf=Buffer.from(t,'utf8');
 }
 res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});res.end(buf);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const PROBE=`<script>
window.addEventListener('load',()=>setTimeout(()=>{
 const out={};
 try{
  // 認証で body が差し替えられていないか。innerHTML で 'Access denied' を
  // 探すと、cms.html のインライン script に書かれた文字列そのものに当たり、
  // 正常時でも true になる（2026-08-09 に踏んだ）。
  // **差し替えの実態は「記事フォームが描画されない」こと。**それを直接見る。
  const sec=document.getElementById('sec-article');
  out.sectionある = !!sec;
  if(sec){ document.querySelectorAll('.section').forEach(e=>e.classList.remove('active')); sec.classList.add('active'); }
  document.querySelectorAll('#sec-article .tab-content').forEach(e=>e.classList.remove('active'));
  const form=document.getElementById('article-tab-form');
  out.formある = !!form;
  if(form) form.classList.add('active');
  window.initArticleEditor && window.initArticleEditor();
  // フォームを開いた**後**に測る（開く前は display:none で 0 になる）
  out.フォームの高さ = Math.round((document.getElementById('article-tab-form')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height);

  const R=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();
    return {top:Math.round(r.top+window.scrollY),bottom:Math.round(r.bottom+window.scrollY),h:Math.round(r.height)};};
  out.パネル挿入数 = document.querySelectorAll('#sec-article .pub-section').length;
  out.エディタ=R('ar-body-editor'); out.画像ツールバー=R('ar-image-layout-tools');
  out.STATUS=R('ar-status'); out.AUTHOR=R('ar-authorId'); out.PUBLISH_AT=R('ar-publishAt');
  // 親子関係と CSS を見る
  const tb=document.getElementById('ar-image-layout-tools');
  const au=document.getElementById('ar-authorId');
  if(tb){ const cs=getComputedStyle(tb);
    out.ツールバー={position:cs.position,親:tb.parentElement&&(tb.parentElement.id||tb.parentElement.className)}; }
  if(au){ const cs=getComputedStyle(au);
    out.AUTHOR欄={position:cs.position,親:au.parentElement&&(au.parentElement.className),
      祖父:au.parentElement&&au.parentElement.parentElement&&au.parentElement.parentElement.className};
    out.AUTHORはツールバーの中 = tb ? tb.contains(au) : null; }
  const box=(el)=>{if(!el)return null;const r=el.getBoundingClientRect();
    const cs=getComputedStyle(el);
    return {top:Math.round(r.top+scrollY),bottom:Math.round(r.bottom+scrollY),h:Math.round(r.height),
            pos:cs.position,ov:cs.overflow,gridCol:cs.gridColumn};};
  out.エディタ枠 = box(document.getElementById('ar-editor-wrap'));
  out.エディタ本体 = box(document.getElementById('ar-body-editor'));
  out.Quill枠 = box(document.querySelector('#ar-body-editor .ql-container'));
  out.Quill本文 = box(document.querySelector('#ar-body-editor .ql-editor'));
  const qe=document.querySelector('#ar-body-editor .ql-editor');
  if(qe){out.Quill本文2={高さ:Math.round(qe.getBoundingClientRect().height),
    はみ出す:qe.scrollHeight>qe.clientHeight+2, scrollH:qe.scrollHeight, clientH:qe.clientHeight};}
  const be=document.getElementById('ar-body-editor');
  if(be){const cs=getComputedStyle(be); out.エディタ本体CSS={height:cs.height,minHeight:cs.minHeight,display:cs.display};}
  const venueType=document.getElementById('v-type');
  const venueSubtype=document.getElementById('v-subtype');
  const venueSubtypeWrap=document.getElementById('v-subtype-wrap');
  const venueFeatures=document.querySelectorAll('#v-features .chip');
  out.VENUES入力欄={
    subtype:!!venueSubtype, hours:!!document.getElementById('v-hours'), charge:!!document.getElementById('v-charge'),
    features:venueFeatures.length, subtypeOptions:venueSubtype?[...venueSubtype.options].map(o=>o.value):[], hiddenInitially:venueSubtypeWrap?venueSubtypeWrap.hidden:null
  };
  if(venueType&&venueSubtypeWrap){
    venueType.value='bar'; venueType.dispatchEvent(new Event('change'));
    out.VENUES入力欄.subtypeVisibleForBar=!venueSubtypeWrap.hidden;
    venueType.value='club'; venueType.dispatchEvent(new Event('change'));
    out.VENUES入力欄.subtypeHiddenForClub=venueSubtypeWrap.hidden;
  }
  document.getElementById('v-name').value='CHECK VENUE';
  venueType.value='bar'; venueType.dispatchEvent(new Event('change'));
  venueSubtype.value='dj-bar'; document.getElementById('v-hours').value='19:00–03:00';
  document.getElementById('v-charge').value='no-cover';
  document.querySelector('#v-features .chip[data-feature="vinyl"]')?.click();
  document.querySelector('#v-features .chip[data-feature="cashless-only"]')?.click();
  openPreview('venue'); closePreview(); openPreview('venue');
  const previewText=document.getElementById('preview-content')?.textContent||'';
  out.VENUES入力欄.previewReopenKeepsValues=previewText.includes('dj-bar')&&previewText.includes('19:00–03:00')&&previewText.includes('no-cover')&&previewText.includes('vinyl')&&previewText.includes('cashless-only');
  // 集中モードの固定プレビューでも、カレンダーからカードへ移動できること。
  const articlePreview=document.getElementById('ar-preview-content');
  const articleWrap=document.getElementById('ar-editor-wrap');
  articleWrap.classList.add('focus-mode','preview-mode');
  articlePreview.innerHTML='<nav class="tj-calendar"><ol><li><time>JAN 01</time><a href="#ev-preview-event-1">Preview Event</a><span>Tokyo</span></li></ol></nav><p style="height:900px">spacer</p><article class="tj-event" id="ev-preview-event-1"><h3>Preview Event</h3><a class="tj-event-link" href="https://example.com" target="_blank">OFFICIAL ↗</a></article>';
  bindArticlePreviewInteractions(articlePreview);
  const calendarLink=articlePreview?.querySelector('.tj-calendar a');
  const beforeHash=location.hash;
  calendarLink?.click();
  out.イベントカード操作={
    officialLinkPointer:articlePreview?.querySelector('.tj-event-link')?getComputedStyle(articlePreview.querySelector('.tj-event-link')).pointerEvents:'missing',
    calendarLinkPointer:calendarLink?getComputedStyle(calendarLink).pointerEvents:'missing',
    hash変更なし:location.hash===beforeHash,
    cardHighlight:!!articlePreview?.querySelector('.tj-event[data-preview-target="1"]')
  };
  articleWrap.classList.remove('focus-mode','preview-mode');
  // プレビューを先に開かず集中モードへ入った場合も、後から表示できること。
  const probeEditor=document.querySelector('#ar-body-editor .ql-editor');
  if (probeEditor) probeEditor.innerHTML=articlePreview.innerHTML;
  toggleFocusMode();
  toggleArticlePreview();
  out.集中モードからプレビュー表示={
    focus:articleWrap.classList.contains('focus-mode'),
    preview:articleWrap.classList.contains('preview-mode') && getComputedStyle(articlePreview).display!=='none',
    eventVisible:!!articlePreview.querySelector('.tj-event')
  };
  toggleFocusMode();
  // イベントカード入力ダイアログが集中モードの裏に隠れないこと。
  toggleFocusMode();
  openArticleEventForm();
  const eventDialog=document.getElementById('ar-event-dialog');
  const eventDialogBox=eventDialog?.querySelector('.dialog-box');
  out.集中モードのイベント入力={
    visible:!!eventDialog && getComputedStyle(eventDialog).display!=='none',
    zIndex:eventDialog?getComputedStyle(eventDialog).zIndex:'missing',
    boxVisible:!!eventDialogBox && eventDialogBox.getBoundingClientRect().width>0
  };
  eventDialog?.remove();
  toggleFocusMode();
  // 別ウィンドウの本番表示プレビューにも短コードが変換されること。
  let generatedPreview='';
  const originalOpen=window.open;
  window.open=()=>({document:{open(){},write(value){generatedPreview=String(value)},close(){}}});
  if (probeEditor) probeEditor.innerHTML='<p>[[event|Generated Preview Event|2030-01-01|Tokyo|https://example.com|Techno]]</p><p>[[calendar]]</p>';
  openArticleGeneratedPreview();
  window.open=originalOpen;
  out.本番表示プレビュー={
    event:generatedPreview.includes('class="tj-event"'),
    calendar:generatedPreview.includes('class="tj-calendar"'),
    detailInner:generatedPreview.includes('class="article-detail-inner"'),
    productionCss:generatedPreview.includes('/detail.css?v=28')
  };
  out.公開パネル = box(document.querySelector('#sec-article .pub-section'));
  out.パネルの親 = box(document.querySelector('#sec-article .pub-section')?.parentElement);
  out.フォーム格子 = box(document.querySelector('#article-tab-form .form-grid'));
  // 集中モード / ソース表示 / プレビュー でも壊れないか
  const wrap=document.getElementById('ar-editor-wrap');
  out.モード切替={};
  for(const cls of ['focus-mode','source-mode','preview-mode']){
    wrap.classList.add(cls);
    const w=wrap.getBoundingClientRect(), tb=document.getElementById('ar-image-layout-tools').getBoundingClientRect();
    out.モード切替[cls]={枠高さ:Math.round(w.height),ツールバー枠内: tb.bottom<=w.bottom+2};
    wrap.classList.remove(cls);
  }
  const pairs=[['画像ツールバー','STATUS'],['画像ツールバー','AUTHOR'],['画像ツールバー','PUBLISH_AT']];
  out.重なり={};
  for(const [a,b] of pairs){const A=out[a],B=out[b];
    if(A&&B&&A.h&&B.h) out.重なり[a+'×'+b] = !(A.bottom<=B.top||B.bottom<=A.top);}
 }catch(e){out.error=String(e).slice(0,120);}
 document.body.setAttribute('data-o',JSON.stringify(out));
},5000));
</script>`;
const orig=server.listeners('request')[0];server.removeAllListeners('request');
server.on('request',(req,res)=>{const u=new URL(req.url,'http://x');
 if(u.pathname==='/__o.html'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
  return res.end(fs.readFileSync(path.join(ROOT,'cms.html'),'utf8').replace('</body>',PROBE+'</body>'));}
 orig(req,res);});
// Chrome の場所は OS で違う。mac のパスを直書きすると CI（Linux）で動かない。
// check_hub_pages.py の CHROME_CANDIDATES と同じ順で探す。
const CHROME_CANDIDATES=[
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome','google-chrome-stable','chromium','chromium-browser',
];
function findChrome(){
  for(const c of CHROME_CANDIDATES){
    if(c.includes('/')){ if(fs.existsSync(c)) return c; continue; }
    const r=spawnSync('which',[c]); if(r.status===0) return String(r.stdout).trim();
  }
  return null;
}
const CHROME=findChrome();
if(!CHROME){ server.close(); console.error('✗ headless Chrome が見つかりません'); process.exit(1); }
const dom=await new Promise(r=>{const pr=spawn(CHROME,['--headless=new','--disable-gpu','--no-sandbox','--window-size=1440,2400',
 '--virtual-time-budget=16000','--no-first-run','--dump-dom',`${base}/__o.html`],
 {stdio:['ignore','pipe','ignore']});let o='';pr.stdout.on('data',d=>o+=d);pr.on('close',()=>r(o));});
const m=dom.match(/data-o="([^"]*)"/);
server.close();
if(!m){ console.error('✗ 計測できませんでした（フォームを開けていない可能性）'); process.exit(1); }
const d=JSON.parse(m[1].replace(/&quot;/g,'"'));
const failures=[];
if(!(d.フォームの高さ > 500)) failures.push(`記事フォームが描画されていない（高さ ${d.フォームの高さ}px）。認証で body が差し替えられた可能性`);
if(!d.formある) failures.push('記事フォームを開けなかった');
for(const [k,v] of Object.entries(d.重なり||{})) if(v) failures.push(`${k} が重なっている`);
for(const [mode,r] of Object.entries(d.モード切替||{})) if(!r.ツールバー枠内)
  failures.push(`${mode}: 画像ツールバーがエディタ枠からはみ出している`);
const q=d.Quill本文2;
  if(q && q.高さ < 400) failures.push(`本文の入力欄が狭い（${q.高さ}px）。従来は約537px`);
if(!d.VENUES入力欄?.subtype||!d.VENUES入力欄?.hours||!d.VENUES入力欄?.charge) failures.push('VENUESのSUBTYPE / HOURS / CHARGE入力欄が不足');
if(d.VENUES入力欄?.features!==13) failures.push(`VENUESのFEATURES選択肢が不足（${d.VENUES入力欄?.features||0}件、13件必要）`);
if(d.VENUES入力欄 && (!d.VENUES入力欄.subtypeVisibleForBar || !d.VENUES入力欄.subtypeHiddenForClub)) failures.push('SUBTYPEのbar限定表示が動作していない');
if(d.VENUES入力欄 && !d.VENUES入力欄.previewReopenKeepsValues) failures.push('VENUESのプレビュー再表示で入力値が保持されていない');
if(d.イベントカード操作 && (d.イベントカード操作.officialLinkPointer!=='auto' || d.イベントカード操作.calendarLinkPointer!=='auto' || !d.イベントカード操作.hash変更なし || !d.イベントカード操作.cardHighlight)) failures.push('集中モードのイベントカード / カレンダーリンクを操作できない');
if(d.集中モードからプレビュー表示 && (!d.集中モードからプレビュー表示.focus || !d.集中モードからプレビュー表示.preview || !d.集中モードからプレビュー表示.eventVisible)) failures.push('集中モード開始後にプレビューを表示できない');
if(d.集中モードのイベント入力 && (!d.集中モードのイベント入力.visible || Number(d.集中モードのイベント入力.zIndex)<=2000 || !d.集中モードのイベント入力.boxVisible)) failures.push('集中モードのイベント入力ダイアログが前面に出ない');
if(d.本番表示プレビュー && (!d.本番表示プレビュー.event || !d.本番表示プレビュー.calendar || !d.本番表示プレビュー.detailInner || !d.本番表示プレビュー.productionCss)) failures.push('本番表示プレビューにイベントカード / カレンダー / 本番CSSが反映されない');
  if(failures.length){
  console.log('CMS のレイアウトに問題があります:');
  for(const f of failures) console.log('  ✗ '+f);
  console.log('\n  実測値:', JSON.stringify(d,null,1));
  process.exit(1);
}
console.log('  ✅ 画像ツールバーが STATUS / AUTHOR / PUBLISH AT と重ならない');
console.log(`  ✅ 集中モード・ソース表示・プレビューでも枠内に収まる`);
console.log(`  ✅ 本文の入力欄の高さ ${q?q.高さ:'?'}px`);
console.log('\n✅ CMS のレイアウトは正常');
