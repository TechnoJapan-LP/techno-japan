#!/usr/bin/env node
/*
 * CMS 集中モードを実ブラウザで検査する。
 *
 * 認証は配信時だけ素通しにし、GAS 通信は空レスポンスへ置き換える。
 * --fast では実行されないブラウザ検査なので、DOM だけの検査にしない。
 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = path.join(process.cwd(), 'LP');
const MIME = {
  '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'
};
let server;
let chrome;
let ws;
let profile;

function findChrome(){
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'
  ];
  for (const candidate of candidates) {
    if (candidate.includes('/')) { if (fs.existsSync(candidate)) return candidate; }
    else { const found = spawnSync('which', [candidate]); if (found.status === 0) return String(found.stdout).trim(); }
  }
  return null;
}
function sleep(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }
function fail(message){ throw new Error(message); }

async function cleanup(){
  try { ws?.close(); } catch (_) {}
  try { chrome?.kill(); } catch (_) {}
  try { server?.close(); } catch (_) {}
  try { if (profile) fs.rmSync(profile, {recursive:true, force:true}); } catch (_) {}
}
process.on('exit', () => { try { if (profile) fs.rmSync(profile, {recursive:true, force:true}); } catch (_) {} });

async function main(){
  const chromePath = findChrome();
  if (!chromePath) fail('headless Chrome が見つかりません');
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let requestPath = decodeURIComponent(url.pathname);
    if (requestPath === '/') requestPath = '/cms.html';
    const file = path.join(ROOT, requestPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    let body = fs.readFileSync(file);
    if (requestPath === '/cms.js') {
      let source = body.toString('utf8');
      source = source.replace('async function checkAuth(){', 'async function checkAuth(){ AUTH_TOKEN="focus-test"; return true;');
      source = 'window.__focusFetch=window.fetch;window.fetch=async(u,o)=>String(u).includes("script.google.com")'
        + '?{ok:true,status:200,clone(){return this},json:async()=>({status:"ok",rows:[],sheets:{}})}'
        + ':window.__focusFetch(u,o);window.prompt=()=>"focus-test";\n' + source;
      body = Buffer.from(source, 'utf8');
    }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    res.end(body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const port = 9300 + Math.floor(Math.random() * 500);
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'techno-japan-cms-focus-'));
  chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'
  ], {stdio:'ignore'});
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = pages.find(item => item.type === 'page');
      if (target) break;
    } catch (_) {}
    await sleep(200);
  }
  if (!target) fail('Chrome DevTools のページを取得できませんでした');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let messageId = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); callback(message); }
  };
  const send = (method, params = {}) => new Promise(resolve => {
    const id = ++messageId; pending.set(id, resolve); ws.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (result.result?.exceptionDetails) fail(JSON.stringify(result.result.exceptionDetails).slice(0, 600));
    return result.result?.result?.value;
  };
  await send('Emulation.setDeviceMetricsOverride', {width:1440, height:900, deviceScaleFactor:1, mobile:false});
  await send('Page.enable');
  await send('Page.navigate', {url:`${base}/cms.html?focus=${Date.now()}`});
  await sleep(4000);
  const imageName = fs.readdirSync(path.join(ROOT, 'images')).find(name => /\.(webp|png|jpe?g)$/i.test(name));
  if (!imageName) fail('検査用画像が見つかりません');
  const data = await evaluate(`(async()=>{
    const out={};
    const sec=document.getElementById('sec-article');
    document.querySelectorAll('.section').forEach(el=>el.classList.remove('active'));
    sec.classList.add('active');
    document.querySelectorAll('#sec-article .tab-content').forEach(el=>el.classList.remove('active'));
    document.getElementById('article-tab-form').classList.add('active');
    initArticleEditor();
    await new Promise(r=>setTimeout(r,300));
    let html='';
    for(let i=1;i<=7;i++){
      html+='<h2>SECTION '+i+'</h2>';
      for(let j=0;j<4;j++) html+='<p>'+('第'+i+'章の本文テキスト。').repeat(16)+'</p>';
      if(i===3||i===5||i===7) html+='<p><img src="/images/${imageName}"></p>';
    }
    setArticleBody(html);
    await new Promise(r=>setTimeout(r,400));
    const wrap=document.getElementById('ar-editor-wrap');
    const tools=document.getElementById('ar-image-layout-tools');
    const qe=document.querySelector('#ar-body-editor .ql-editor');
    const visible=el=>!!el&&getComputedStyle(el).display!=='none'&&el.getBoundingClientRect().height>0;
    const width=()=>Math.round(qe.querySelector('p').getBoundingClientRect().width);
    toggleFocusMode(); await new Promise(r=>setTimeout(r,300));
    out.a={hidden:!visible(tools),width:width()};
    toggleArticlePreview(); await new Promise(r=>setTimeout(r,900));
    out.preview={visible:visible(document.querySelector('.ar-preview')),width:width()};
    const image=qe.querySelector('img'); image.click(); await new Promise(r=>setTimeout(r,250));
    out.b={visible:visible(tools),position:getComputedStyle(tools).position};
    const select=document.getElementById('ar-image-layout'); select.focus(); select.value='full'; select.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(r=>setTimeout(r,250));
    out.c={visible:visible(tools)};
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>setTimeout(r,250));
    out.d={hidden:!visible(tools),focus:wrap.classList.contains('focus-mode')};
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>setTimeout(r,250));
    out.e={focus:wrap.classList.contains('focus-mode')};
    toggleFocusMode(); await new Promise(r=>setTimeout(r,300));
    toggleArticlePreview(); await new Promise(r=>setTimeout(r,900));
    const prev=document.querySelector('.ar-preview');
    const leftCandidates=[qe,document.querySelector('#ar-body-editor .ql-container'),wrap].filter(el=>el&&el.scrollHeight>el.clientHeight+5);
    const left=leftCandidates[0];
    const alignment=[];
    for(const n of [3,5,7]){
      const lh=[...qe.querySelectorAll('h2')].find(el=>el.textContent.trim()==='SECTION '+n);
      const rh=[...prev.querySelectorAll('h2')].find(el=>el.textContent.trim()==='SECTION '+n);
      const lr=left.getBoundingClientRect(), rr=prev.getBoundingClientRect();
      left.scrollTop+=lh.getBoundingClientRect().top-(lr.top+left.clientHeight/3);
      left.dispatchEvent(new Event('scroll')); await new Promise(r=>setTimeout(r,300));
      const leftOffset=lh.getBoundingClientRect().top-(left.getBoundingClientRect().top+left.clientHeight/3);
      const rightOffset=rh.getBoundingClientRect().top-(prev.getBoundingClientRect().top+prev.clientHeight/3);
      alignment.push({section:n,diff:Math.round(Math.abs(leftOffset-rightOffset))});
    }
    out.f={alignment};
    const status=document.getElementById('ar-status');
    out.h={scheduled:[...status.options].some(o=>o.value==='scheduled'),publishAt:!!document.getElementById('ar-publishAt')};
    return out;
  })()`);
  const failures=[];
  if (!data.a?.hidden) failures.push('a: 画像未選択時に画像設定欄が非表示でない');
  if (!data.b?.visible || data.b.position !== 'sticky') failures.push('b: 画像クリック後の表示またはstickyが不正');
  if (!data.c?.visible) failures.push('c: select操作後に画像設定欄が消えた');
  if (!data.d?.hidden || !data.d?.focus) failures.push('d: Escで画像設定欄だけを閉じられない');
  if (data.e?.focus) failures.push('e: 2回目のEscで集中モードが終了しない');
  for (const item of data.f?.alignment || []) if (item.diff > 120) failures.push(`f: SECTION ${item.section} の差が${item.diff}px`);
  if ((data.preview?.width || 0) < 600) failures.push(`g: プレビューあり本文幅が${data.preview?.width || 0}px`);
  if ((data.a?.width || 0) < 900) failures.push(`g: プレビューなし本文幅が${data.a?.width || 0}px`);
  if (!data.h?.scheduled || !data.h?.publishAt) failures.push('h: scheduled または publishAt 欄がない');
  if (failures.length) { console.error('CMS集中モード検査失敗'); failures.forEach(item => console.error(`  ✗ ${item}`)); console.error(JSON.stringify(data,null,2)); process.exitCode=1; }
  else { console.log(JSON.stringify(data,null,2)); console.log('✅ CMS集中モードの全項目を実ブラウザで検証しました'); }
}

try { await main(); }
catch (error) { console.error(`✗ ${error.message || error}`); process.exitCode=1; }
finally { await cleanup(); }
