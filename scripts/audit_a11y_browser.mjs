import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import fs from 'node:fs';

/* 実ブラウザ a11y / 重量監査（2026-09-24 定量診断で使用）
 * 使い方:
 *   node scripts/audit_a11y_browser.mjs            # 本番 https://techno-japan.media を計測
 *   node scripts/audit_a11y_browser.mjs --local    # LP/ をローカル配信して計測（改善前後の比較用）
 *   PAGES=/festivals.html,/artists.html node scripts/audit_a11y_browser.mjs --local
 * 計測: 393x852 / dpr3 / タッチ端末。タップ領域<48px（ヒットテスト済み・段落内リンク除外）、
 * コントラスト AA（opacity と親背景を合成、画像上・フェード前は除外）、横スクロール、
 * performance.getEntriesByType('resource') による外部込みの重量、LCP。 */
const LOCAL = process.argv.includes('--local');
function freePort(){return new Promise((res,rej)=>{const s=createServer();s.once('error',rej);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>res(p));});});}
function chromePath(){for(const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','google-chrome','chromium']){try{execFileSync(p,['--version'],{stdio:'ignore'});return p;}catch{}}throw new Error('no chrome');}
async function cdp(ws,m,p={}){const id=++cdp.nextId;ws.send(JSON.stringify({id,method:m,params:p}));return new Promise((res,rej)=>{const on=(e)=>{const x=JSON.parse(e.data);if(x.id!==id)return;ws.removeEventListener('message',on);x.error?rej(new Error(JSON.stringify(x.error))):res(x.result);};ws.addEventListener('message',on);});}
cdp.nextId=0;
const LP_DIR = path.resolve(new URL('..', import.meta.url).pathname, 'LP');
const localPort = LOCAL ? await freePort() : 0;
const httpServer = LOCAL ? spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>{const u=(q.url||'/').split('?')[0].replace(/^\\/+/,'')||'index.html'; require('fs').createReadStream(require('path').join(${JSON.stringify(LP_DIR)},u)).on('error',()=>{r.statusCode=404;r.end()}).pipe(r)}).listen(${localPort},'127.0.0.1')`], { stdio: 'ignore' }) : null;
const DEBUG_PORT = LOCAL ? localPort + 7 : 9347;
const BASE = LOCAL ? `http://127.0.0.1:${localPort}` : 'https://techno-japan.media';
const pages=process.env.PAGES ? process.env.PAGES.split(',') : ['/','/news.html','/festivals.html','/artists.html','/venues.html','/articles/synapse-2026-info.html','/festivals/matricaria.html','/artists/dj-nobu.html','/venues/www.html','/en/index.html','/en/festivals/matricaria.html','/en/articles/synapse-2026-info.html'];
const chrome=spawn(chromePath(),['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--hide-scrollbars',`--remote-debugging-port=${DEBUG_PORT}`,'about:blank'],{stdio:'ignore'});
const AUDIT = `(() => {
  const vw = innerWidth;
  // --- tap targets
  const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[tabindex]:not([tabindex="-1"])';
  const els = [...document.querySelectorAll(sel)];
  const visible = e => { const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0'&&s.pointerEvents!=='none'; };
  const tapSmall=[]; const seenTap=new Set();
  for (const e of els) {
    if (!visible(e)) continue; { const rr=e.getBoundingClientRect(); const cx=rr.left+rr.width/2, cy=rr.top+rr.height/2; if (cx<0||cy<0||cx>vw||cy>innerHeight) { e.scrollIntoView({block:'center'}); } const r2=e.getBoundingClientRect(); const hit=document.elementFromPoint(Math.min(vw-1,Math.max(0,r2.left+r2.width/2)), Math.min(innerHeight-1,Math.max(0,r2.top+r2.height/2))); if (!hit || !(hit===e || e.contains(hit))) continue; }
    // only elements at least partially inside the document flow and not nested inside another target (avoid double count)
    if (e.parentElement && e.parentElement.closest(sel)) continue;
    const r=e.getBoundingClientRect();
    if (r.width<48 || r.height<48) {
      // inline text links inside paragraphs are exempt by WCAG 2.5.8 (inline exception)
      const inline = getComputedStyle(e).display==='inline' && e.closest('p,li,dd,td,figcaption,.article-body');
      if (inline) continue;
      const key=(e.className||e.tagName)+'|'+Math.round(r.width)+'x'+Math.round(r.height);
      if (seenTap.has(key)) { tapSmall.find(t=>t.key===key).n++; continue; }
      seenTap.add(key);
      tapSmall.push({key, n:1, tag:e.tagName.toLowerCase(), cls:(e.className&&e.className.baseVal!==undefined?e.className.baseVal:String(e.className||'')).slice(0,40), w:Math.round(r.width), h:Math.round(r.height), text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,24)});
    }
  }
  // --- contrast
  const lum = ([r,g,b]) => { const f=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const parse = s => { const m=s.match(/rgba?\\(([^)]+)\\)/); if(!m) return null; const p=m[1].split(',').map(Number); return {rgb:p.slice(0,3), a:p.length>3?p[3]:1}; };
  const blend = (fg, bg) => fg.rgb.map((c,i)=>Math.round(c*fg.a+bg[i]*(1-fg.a)));
  const bgOf = (el) => { let e=el; while(e){ const s=getComputedStyle(e); const c=parse(s.backgroundColor); if(c&&c.a>0.99) return c.rgb; if (c&&c.a>0) { const under=bgOf(e.parentElement)||[8,8,8]; return blend(c,under);} if(s.backgroundImage&&s.backgroundImage!=='none') return null; e=e.parentElement;} return [8,8,8]; };
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const contrastFail=new Map(); let textNodes=0, checked=0, hiddenByOpacity=0;
  while(walker.nextNode()){
    const t=walker.currentNode; if(!t.textContent.trim()) continue; const el=t.parentElement; if(!el) continue;
    if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName)) continue;
    const r=el.getBoundingClientRect(); if(r.width===0||r.height===0) continue;
    const s=getComputedStyle(el); if(s.visibility==='hidden'||s.display==='none') continue;
    textNodes++;
    // effective opacity
    let op=1, e=el; while(e){ op*=parseFloat(getComputedStyle(e).opacity); e=e.parentElement; }
    const fg=parse(s.color); if(!fg) continue; if (op<0.05) { hiddenByOpacity++; continue; }
    const bg=bgOf(el); if(!bg) continue; // over image/gradient: skip (can't measure statically)
    checked++;
    const fgc = blend({rgb:fg.rgb, a:fg.a*op}, bg);
    const L1=lum(fgc), L2=lum(bg); const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const px=parseFloat(s.fontSize); const bold=parseInt(s.fontWeight)>=700; const large = px>=24 || (px>=18.66&&bold);
    const need = large?3:4.5;
    if (ratio<need) { const key=(el.className&&typeof el.className==='string'?el.className.split(' ')[0]:el.tagName.toLowerCase())+'@'+px+'px'; const v=contrastFail.get(key)||{n:0,ratio:ratio,px,text:t.textContent.trim().slice(0,22)}; v.n++; v.ratio=Math.min(v.ratio,ratio); contrastFail.set(key,v); }
  }
  // --- overflow
  const overflow = document.documentElement.scrollWidth > vw+1 || document.body.scrollWidth > vw+1;
  let widest=null; if (overflow) { for (const e of document.querySelectorAll('body *')) { const r=e.getBoundingClientRect(); if (r.right>vw+1 && (!widest || r.right>widest.right)) widest={right:Math.round(r.right), tag:e.tagName, cls:String(e.className).slice(0,40)}; } }
  // --- resources
  const res = performance.getEntriesByType('resource');
  const nav = performance.getEntriesByType('navigation')[0];
  const byType = {}; let total = nav ? (nav.transferSize||nav.encodedBodySize||0) : 0; let external=0;
  for (const r of res) { const t=r.initiatorType||'other'; const sz=r.transferSize||r.encodedBodySize||0; byType[t]=(byType[t]||0)+sz; total+=sz; if(!r.name.startsWith(location.origin)) external+=sz; }
  const top=res.map(r=>({n:r.name.replace(location.origin,'').slice(0,70),kb:Math.round((r.transferSize||r.encodedBodySize||0)/1024),t:r.initiatorType})).sort((a,b)=>b.kb-a.kb).slice(0,6);
  const imgs=[...document.images].filter(i=>i.getBoundingClientRect().width>0);
  const noAlt=imgs.filter(i=>!i.hasAttribute('alt')).length;
  const noDim=imgs.filter(i=>!(i.getAttribute('width')&&i.getAttribute('height'))&&!i.style.aspectRatio).length;
  const lazy=imgs.filter(i=>i.loading==='lazy').length;
  const h1=document.querySelectorAll('h1').length;
  const lcp = window.__lcp || null;
  return { vw, vh: innerHeight, tapSmall: tapSmall.sort((a,b)=>b.n-a.n), tapCount: tapSmall.reduce((s,t)=>s+t.n,0), contrastFail:[...contrastFail.entries()].map(([k,v])=>({k,...v,ratio:Math.round(v.ratio*100)/100})).sort((a,b)=>b.n-a.n), contrastCount:[...contrastFail.values()].reduce((s,v)=>s+v.n,0), textNodes, checked, hiddenByOpacity, overflow, widest, kb: Math.round(total/1024), extKb: Math.round(external/1024), byType: Object.fromEntries(Object.entries(byType).map(([k,v])=>[k,Math.round(v/1024)])), reqs: res.length+1, imgs: imgs.length, noAlt, noDim, lazy, h1, lcp, top };
})()`;
try{
  let t;for(let i=0;i<60&&!t;i++){await delay(200);try{t=(await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json()).find(x=>x.type==='page');}catch{}}
  const ws=new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j);});
  await cdp(ws,'Page.enable');await cdp(ws,'Runtime.enable');await cdp(ws,'Network.enable');
  await cdp(ws,'Network.setCacheDisabled',{cacheDisabled:true});
  await cdp(ws,'Page.addScriptToEvaluateOnNewDocument',{source:`new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lcp=Math.round(e.startTime);}).observe({type:'largest-contentful-paint',buffered:true});`});
  const out=[];
  for (const p of pages) {
    await cdp(ws,'Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:3,mobile:true});
    await cdp(ws,'Emulation.setTouchEmulationEnabled',{enabled:true});
    await cdp(ws,'Page.navigate',{url:BASE+p});
    await delay(LOCAL ? 2500 : 6000);
    // scroll to bottom to trigger lazy content, then back
    await cdp(ws,'Runtime.evaluate',{expression:'window.scrollTo(0,document.body.scrollHeight)'}); await delay(1500);
    await cdp(ws,'Runtime.evaluate',{expression:'window.scrollTo(0,0)'}); await delay(500);
    const r=await cdp(ws,'Runtime.evaluate',{expression:AUDIT,returnByValue:true});
    const v=r.result.value||{error:JSON.stringify(r.result).slice(0,200)};
    out.push({page:p,...v});
    console.log(`${p.padEnd(40)} ${String(v.kb).padStart(5)}KB (ext ${v.extKb}KB, ${v.reqs} req) LCP=${v.lcp}ms tap<48: ${v.tapCount} contrast<AA: ${v.contrastCount}/${v.checked} (opacity0で除外 ${v.hiddenByOpacity}) overflow=${v.overflow}${v.widest?' '+JSON.stringify(v.widest):''} imgs=${v.imgs} noAlt=${v.noAlt} noDim=${v.noDim} lazy=${v.lazy} h1=${v.h1}`);
  }
  const outFile = process.env.OUT || 'reports/audit-a11y-browser.json';
  fs.writeFileSync(outFile, JSON.stringify(out,null,1));
  const tap = out.reduce((s,p)=>s+(p.tapCount||0),0), con = out.reduce((s,p)=>s+(p.contrastCount||0),0), ov = out.filter(p=>p.overflow).length;
  console.log(`\n合計: タップ<48px ${tap} / コントラスト<AA ${con} / 横スクロール ${ov}ページ  → ${outFile}`);
} finally { chrome.kill('SIGTERM'); if (httpServer) httpServer.kill('SIGTERM'); }
