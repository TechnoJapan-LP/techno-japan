#!/usr/bin/env node
/* CMS本文画像の実ブラウザ検査。GASは空応答に置き換え、実在する記事画像を使う。 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.join(process.cwd(), 'LP');
const image = fs.readdirSync(path.join(ROOT, 'images', 'articles')).find(name => name.endsWith('.webp'));
if (!image) throw new Error('LP/images/articles/*.webp がありません');
const MIME = {'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.webp':'image/webp','.woff2':'font/woff2'};
let server, chrome, ws, profile;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = message => { throw new Error(message); };
function chromePath(){ for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','google-chrome','chromium','chromium-browser']) { if (c.includes('/') ? fs.existsSync(c) : spawnSync('which',[c],{stdio:'ignore'}).status === 0) return c; } return null; }
async function cleanup(){ try{ws?.close()}catch{} try{chrome?.kill()}catch{} try{server?.close()}catch{} try{if(profile)fs.rmSync(profile,{recursive:true,force:true})}catch{} }
process.on('exit', () => { try{if(profile)fs.rmSync(profile,{recursive:true,force:true})}catch{} });

async function main(){
  const cp = chromePath(); if (!cp) fail('headless Chrome が見つかりません');
  server = http.createServer((req,res) => {
    const url = new URL(req.url, 'http://localhost'); let p = decodeURIComponent(url.pathname); if (p === '/') p = '/cms.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(file);
    if (p === '/cms.js') {
      let source = body.toString('utf8').replace('async function checkAuth(){', 'async function checkAuth(){ AUTH_TOKEN="image-layout-test"; return true;');
      source = 'window.__imageLayoutFetch=window.fetch;window.fetch=async(u,o)=>String(u).includes("script.google.com")?{ok:true,status:200,clone(){return this},json:async()=>({status:"ok",rows:[],sheets:{}})}:window.__imageLayoutFetch(u,o);window.prompt=()=>"image-layout-test";\n' + source;
      body = Buffer.from(source);
    }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'}); res.end(body);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const port = 9300 + Math.floor(Math.random()*500); profile = fs.mkdtempSync(path.join(os.tmpdir(),'techno-japan-cms-image-'));
  chrome = spawn(cp,['--headless=new','--disable-gpu','--no-sandbox',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--no-first-run','about:blank'],{stdio:'ignore'});
  let target; for(let i=0;i<60&&!target;i++){ try{target=(await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x=>x.type==='page')}catch{} await sleep(200); }
  if(!target) fail('Chrome DevToolsのページを取得できませんでした');
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0; const pending=new Map(); ws.onmessage=e=>{const m=JSON.parse(e.data), cb=pending.get(m.id);if(cb){pending.delete(m.id);cb(m)}};
  const send=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}))});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)fail(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value};
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.enable'); await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/cms.html?image-layout=${Date.now()}`}); await sleep(3500);
  const data = await evaluate(`(async()=>{
    const out={}, src='/images/articles/${image}';
    document.querySelectorAll('.section').forEach(x=>x.classList.remove('active')); document.getElementById('sec-article').classList.add('active');
    document.querySelectorAll('#sec-article .tab-content').forEach(x=>x.classList.remove('active')); document.getElementById('article-tab-form').classList.add('active');
    initArticleEditor(); await new Promise(r=>setTimeout(r,300));
    const q=articleQuill, preview=document.getElementById('ar-preview-content'), wrap=document.getElementById('ar-editor-wrap'); wrap.classList.add('preview-mode');
    setArticleBody('<p><img src="'+src+'" data-crop="1:1" data-layout="contained"></p>'); await new Promise(r=>setTimeout(r,500));
    const pimg=()=>preview.querySelector('.preview-fx-img img'), ratio=()=>{const r=pimg().getBoundingClientRect();return r.width/r.height};
    q.root.querySelector('img').click(); out.crop11=ratio();
    const crop=document.getElementById('ar-image-crop'); crop.value='16:10'; crop.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,250)); out.crop1610=ratio();
    const sel=document.getElementById('ar-image-layout'); sel.value='right'; sel.dispatchEvent(new Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,250));
    const rr=pimg().closest('figure').getBoundingClientRect(), pr=preview.getBoundingClientRect(); out.right={left:rr.left,right:rr.right,bodyRight:pr.right};
    const insertCases=[['existing-image-before',3],['text-middle',1],['line-end',2],['empty-line',5]];
    out.insertCases={};
    for(const [name,index] of insertCases){
      setArticleBody('<p>前文</p><p><img src="'+src+'" data-layout="right" data-crop="1:1"></p><p><br></p><p>本文</p>'); await new Promise(r=>setTimeout(r,120));
      q.setSelection(index,0,'silent'); const beforeA=q.root.querySelector('img[src="'+src+'"]'); const beforeAttrs={layout:beforeA.dataset.layout,crop:beforeA.dataset.crop}; insertImageAtCursor(src+'#new-'+name); await new Promise(r=>setTimeout(r,120));
      const fresh=[...q.root.querySelectorAll('img')].find(x=>x.src.endsWith('#new-'+name)); const host=fresh?.closest('p'); const selNow=q.getSelection(); const blot=fresh&&Quill.find(fresh); const expected=blot?q.getIndex(blot)+1:null;
      const paragraphText=[...q.root.querySelectorAll('p')].map(p=>p.textContent).join('');
      out.insertCases[name]={newImage:!!fresh,contained:fresh?.dataset.layout==='contained',singleParagraph:!!host&&host.querySelectorAll('img').length===1&&host.textContent.trim()==='',text:q.getText(),originalText:paragraphText.includes('前文')&&paragraphText.includes('本文'),existingAttrs:beforeA?.dataset.layout===beforeAttrs.layout&&beforeA?.dataset.crop===beforeAttrs.crop,selectionAfterImage:!!selNow&&selNow.index===expected};
    }
    setArticleBody('<p><img src="'+src+'" data-layout="compact" data-crop="1:1" data-x="20" data-y="70"></p><p><img src="'+src+'" data-layout="right"></p>'); await new Promise(r=>setTimeout(r,300));
    const before=[...q.root.querySelectorAll('img')].map(x=>x.outerHTML); q.history.undo(); q.history.redo(); const after=[...q.root.querySelectorAll('img')].map(x=>x.outerHTML); out.undoRedo={same:JSON.stringify(before)===JSON.stringify(after),attrs:after.map(x=>/data-(layout|crop|x|y)=/.test(x))};
    setArticleBody('<p>keep</p><p><img src="'+src+'" data-layout="right"></p>'); await new Promise(r=>setTimeout(r,100)); q.history.undo(); out.undoLoad=q.getText().includes('keep');
    setArticleBody('<p><img src="'+src+'"></p><p><img src="'+src+'"></p><p><img src="'+src+'"></p>'); await new Promise(r=>setTimeout(r,300)); const all=[...q.root.querySelectorAll('img')]; all[0].click(); document.getElementById('ar-image-trio').click(); await new Promise(r=>setTimeout(r,300));
    out.trio={editor:[...q.root.querySelectorAll('p')].filter(p=>p.querySelector('img[data-pair-size="3"]')).length,preview:preview.querySelector('.preview-image-trio')?.querySelectorAll('.preview-fx-img').length||0};
    all[0].click(); out.auto=document.getElementById('ar-image-layout').value;
    return out;
  })()`);
  const errors=[]; if(Math.abs(data.crop11-1)>0.03) errors.push('1:1 crop比率'); if(Math.abs(data.crop1610-1.6)>0.03) errors.push('16:10 crop比率'); if(!(data.right?.right>=data.right?.bodyRight-8&&data.right?.left>data.right?.bodyRight-(data.right?.bodyRight-data.right?.left)*2)) errors.push('right寄せ'); for(const [name,item] of Object.entries(data.insertCases||{})) for(const key of ['newImage','contained','singleParagraph','originalText','existingAttrs','selectionAfterImage']) if(!item[key]) errors.push(`挿入位置 ${name}: ${key}`); if(!data.undoRedo?.same||data.undoRedo.attrs.some(x=>!x)) errors.push('undo/redo属性保持'); if(!data.undoLoad) errors.push('読み込み直後undo'); if(data.trio?.editor!==3||data.trio?.preview!==3) errors.push('3枚セット'); if(data.auto!=='') errors.push('自動レイアウト表示');
  if(errors.length){console.error('CMS画像レイアウト検査失敗:',errors.join('、'));console.error(JSON.stringify(data,null,2));process.exitCode=1}else console.log(JSON.stringify(data,null,2)+'\n✅ CMS画像レイアウトを実ブラウザで検証しました');
}
try{await main()}catch(error){console.error(`✗ ${error.message||error}`);process.exitCode=1}finally{await cleanup()}
