#!/usr/bin/env node
/**
 * ARTICLE の AI 機能（タイトル候補・要約）が、本文を書いた直後でも
 * 動くことを確かめる。
 *
 * ■ 何を守るか（AUDIT §9-62）
 *
 *   エディタの内容が ar-body（隠しテキストエリア）へ入るのは 300ms の
 *   debounce 後。AI 機能はその ar-body を読むので、**本文を書いてすぐ押すと
 *   まだ空**で「先に本文を書いてください」と出る。書いてあるのに動かない。
 *
 *   翻訳（aiTranslateBody）だけが flushArticleEditorSync() を呼んでおり、
 *   タイトル候補と要約は呼んでいなかった。
 *
 *   さらに flush 自体も「debounce の予約があるときだけ」同期していたため、
 *   既存記事を読み込んだ直後など予約が無い状態では何もしなかった。
 *
 *   守りたい性質:
 *     1. 本文を書いた直後（予約中）でも動く
 *     2. 予約が無い状態（既存記事を開いた直後）でも動く
 *     3. 要約も同様に動く
 *     4. 本文が本当に空なら、正しく止まる
 *
 * ■ なぜブラウザで見ないのか
 *   cms.html は読み込み時に prompt() を出して headless では固まる（§9-44）。
 *   cms.js だけを VM に読み込み、fetch を差し替えて関数を直接叩く。
 *
 * 使い方:
 *   node scripts/check_cms_ai_body.mjs
 */

import fs from 'node:fs'; import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');
const BRIDGE=`;globalThis.__T={ get articleQuill(){return articleQuill}, set articleQuill(v){articleQuill=v},
  get articleSyncTimer(){return articleSyncTimer}, set articleSyncTimer(v){articleSyncTimer=v} };`;
function ctxOf(){
  const els=new Map();
  const mk=id=>({id,value:'',innerHTML:'',dataset:{},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(){},contains(c){return this._s.has(c)}},
    style:{},addEventListener(){},querySelectorAll:()=>[],remove(){}});
  const sent=[];
  const c={console,JSON,Math,Date,String,Number,Boolean,Object,Array,RegExp,Error,Map,Set,Promise,
    document:{documentElement:{lang:'ja'},getElementById:id=>{if(!els.has(id))els.set(id,mk(id));return els.get(id)},
      querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>mk('t'),
      body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},head:{appendChild(){}},cookie:''},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    location:{href:'http://x/cms.html',search:'',hash:'',origin:'http://x'},navigator:{userAgent:'node',onLine:true},
    setTimeout,clearTimeout,setInterval,clearInterval,prompt:()=>'x',confirm:()=>true,alert:()=>{},
    addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    requestAnimationFrame:f=>setTimeout(f,0),scrollTo(){},getComputedStyle:()=>({}),
    history:{replaceState(){},pushState(){}},IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},
    URL,URLSearchParams,TextEncoder,TextDecoder,crypto:{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:a=>a},
    __sent:sent};
  c.fetch=async(u,o)=>{ sent.push(JSON.parse(o?.body||'{}')); return {json:async()=>({status:'ok',text:'案1\n案2\n案3'})}; };
  c.window=c;c.globalThis=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(CMS_PATH,'utf8')+BRIDGE,c,{filename:'cms.js'});
  return c;
}
const results=[];const check=(n,p,d)=>results.push([n,p,d]);
const BODY='<p>本文がここにあります。</p>';

// ① 本文を書いた直後（debounce 未確定）に押す
{
  const c=ctxOf();
  let msg=''; c.toast=(m)=>{msg=m}; c.showTitleCandidates=()=>{}; c.markFormDirty=()=>{};
  c.updateArticlePreview=()=>{}; c.maybeAutoFillReadTime=()=>{}; c.scheduleArticleDraftSave=()=>{};
  c.__T.articleQuill={root:{innerHTML:BODY}};
  c.document.getElementById('ar-body').value='';        // まだ未反映
  c.__T.articleSyncTimer=setTimeout(()=>{},9999);        // 予約中
  c.aiTitleSuggest();
  const posted=c.__sent.find(x=>x.mode==='titles');
  check('本文を書いた直後でもタイトル候補が動く', !!posted, posted?'送信された':'止まった: '+msg);
}

// ② 予約が無い状態（既存記事を開いた直後）
{
  const c=ctxOf();
  let msg=''; c.toast=(m)=>{msg=m}; c.showTitleCandidates=()=>{}; c.markFormDirty=()=>{};
  c.updateArticlePreview=()=>{}; c.maybeAutoFillReadTime=()=>{}; c.scheduleArticleDraftSave=()=>{};
  c.__T.articleQuill={root:{innerHTML:BODY}};
  c.document.getElementById('ar-body').value='';
  c.__T.articleSyncTimer=null;                            // 予約なし
  c.aiTitleSuggest();
  const posted=c.__sent.find(x=>x.mode==='titles');
  check('予約が無い状態でも動く', !!posted, posted?'送信された':'止まった: '+msg);
}

// ③ 要約（抜粋）も同じく動く
{
  const c=ctxOf();
  let msg=''; c.toast=(m)=>{msg=m}; c.markFormDirty=()=>{};
  c.updateArticlePreview=()=>{}; c.maybeAutoFillReadTime=()=>{}; c.scheduleArticleDraftSave=()=>{};
  c.__T.articleQuill={root:{innerHTML:BODY}};
  c.document.getElementById('ar-body').value='';
  c.__T.articleSyncTimer=null;
  c.aiSummarize('excerpt');
  const posted=c.__sent.find(x=>x.action==='ai_summarize');
  check('抜粋の自動生成も動く', !!posted, posted?'送信された':'止まった: '+msg);
}

// ④ 本文が本当に空なら、ちゃんと止まる
{
  const c=ctxOf();
  let msg=''; c.toast=(m)=>{msg=m}; c.showTitleCandidates=()=>{}; c.markFormDirty=()=>{};
  c.updateArticlePreview=()=>{}; c.maybeAutoFillReadTime=()=>{}; c.scheduleArticleDraftSave=()=>{};
  c.__T.articleQuill={root:{innerHTML:'<p><br></p>'}};
  c.document.getElementById('ar-body').value='';
  c.__T.articleSyncTimer=null;
  c.aiTitleSuggest();
  check('本文が空なら正しく止まる', !c.__sent.length && /本文を書いて/.test(msg), msg||'(何も出ない)');
}

/* aiFail は要素を組み立てて body に足す。疑似DOM に append と
   テキストの蓄積が要るので、この試験のためだけの最小実装を用意する。 */
function fakeDom(c){
  const mk = () => {
    const el = {
      style:{}, className:'', id:'', __children:[],
      set textContent(v){ el.__own = String(v); }, get textContent(){ return el.__own||''; },
      set innerHTML(v){ el.__own = String(v); }, get innerHTML(){ return el.__own||''; },
      get __text(){ return (el.__own||'') + el.__children.map(x=>x.__text||'').join(' '); },
      append(...xs){ el.__children.push(...xs); },
      appendChild(x){ el.__children.push(x); return x; },
      addEventListener(){}, setAttribute(){}, remove(){},
      classList:{add(){},remove(){},toggle(){},contains:()=>false},
    };
    return el;
  };
  c.document.createElement = mk;
  const shown = [];
  c.document.body.appendChild = (el) => { shown.push(el); return el; };
  return shown;
}

// ⑤ 失敗の理由が消えずに残ること（2026-08-10 / §9-70）
//
//    AI が動かないときに要るのは「動かない」ではなく理由。
//    3秒で消えるトーストだと、キー未設定なのかモデル指定ミスなのか
//    分からず、原因の切り分けに進めない。
{
  const c=ctxOf();
  c.toast=()=>{};
  const shown=fakeDom(c);
  c.aiFail('翻訳', 'ANTHROPIC_API_KEY not set');
  check('失敗の理由が画面に残る', shown.length===1, shown.length+'件');
  const text = shown.length ? String(shown[0].__text||'') : '';
  check('理由の本文がそのまま出る', text.includes('ANTHROPIC_API_KEY not set'), text.slice(0,40));
  check('対処の手掛かりを添える', text.includes('スクリプト プロパティ'), text.slice(0,60));
}
{
  const c=ctxOf();
  c.toast=()=>{};
  const shown=fakeDom(c);
  c.aiFail('翻訳', 'Claude API 400: max_tokens too large');
  const text = shown.length ? String(shown[0].__text||'') : '';
  check('400 ならモデル・上限の確認を促す', text.includes('MAX_TOKENS'), text.slice(0,60));
}
{
  const c=ctxOf();
  c.toast=()=>{};
  const shown=fakeDom(c);
  c.aiFail('翻訳', '見たことのないエラー');
  const text = shown.length ? String(shown[0].__text||'') : '';
  check('未知のエラーは文言の共有を促す', text.includes('そのまま共有'), text.slice(0,60));
}

console.log('\n検証項目'.padEnd(44)+'判定  実測');
console.log('-'.repeat(88));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(42)+'  '+(p?'✅':'❌')+'   '+String(d).slice(0,36)); }
console.log('-'.repeat(88));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail?1:0);
