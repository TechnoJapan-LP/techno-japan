#!/usr/bin/env node
/**
 * FESTIVAL の LINEUP 入力を検証する。
 *
 * ■ 何を守るか（AUDIT §9-57）
 *
 *   1. 日本語入力（IME）の変換確定 Enter を拾わない
 *      変換中の Enter は「変換を確定する」操作。ここで拾うと変換途中の文字
 *      （例:「やま」）が LINEUP に入り、続きが打てなくなる。
 *
 *   2. 打った文字が候補に勝手に置き換わらない
 *      「YAMA」と打ったら「YAMA」が入る。候補（Yamarchy）は
 *      クリックしたときだけ採用する。
 *
 *   3. 未照合タグから、打った表記のまま ARTISTS へ登録できる
 *      **NAME は打った表記をそのまま使う。** §9-25 では ID から名前を
 *      機械復元して TKO→Tko / Ben UFO→Ben Ufo のように30件を壊した。
 *      同じことを繰り返さないための検査でもある。
 *
 *   4. 既存 ID と衝突する登録をしない
 *
 * ■ なぜブラウザで見ないのか
 *   cms.html は読み込み時に prompt() を出して headless では固まる
 *   （AUDIT §9-44）。cms.js だけを VM に読み込んで関数を直接叩く。
 *
 * 使い方:
 *   node scripts/check_cms_lineup.mjs
 */

import fs from 'node:fs'; import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');
const BRIDGE=`;globalThis.__T={ get lineups(){return lineups}, get ARTIST_DB(){return ARTIST_DB},
  set ARTIST_DB(v){ARTIST_DB=v}, get acHighlight(){return acHighlight}, set acHighlight(v){acHighlight=v} };`;
function ctxOf(){
  const els=new Map();
  const mk=id=>({id,value:'',innerHTML:'',dataset:{},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,v){v?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    style:{},addEventListener(){},
    querySelectorAll(sel){ if(!/autocomplete-item/.test(sel))return [];
      const n=(this.innerHTML.match(/class="autocomplete-item"/g)||[]).length;
      const self=this; return Array.from({length:n},(_,i)=>({classList:{toggle(){}},click(){self._clicked=i;}}));}});
  const c={console,JSON,Math,Date,String,Number,Boolean,Object,Array,RegExp,Error,Map,Set,
    document:{documentElement:{lang:'ja'},getElementById:id=>{if(!els.has(id))els.set(id,mk(id));return els.get(id)},
      querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>mk('t'),
      body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},head:{appendChild(){}},cookie:''},
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    location:{href:'http://x/cms.html',search:'',hash:'',origin:'http://x'},navigator:{userAgent:'node',onLine:true},
    setTimeout,clearTimeout,setInterval,clearInterval,fetch:async()=>({json:async()=>({status:'ok'})}),
    prompt:()=>'x',confirm:()=>true,alert:()=>{},addEventListener(){},removeEventListener(){},
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),requestAnimationFrame:f=>setTimeout(f,0),
    scrollTo(){},getComputedStyle:()=>({}),history:{replaceState(){},pushState(){}},
    IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},URL,URLSearchParams,TextEncoder,TextDecoder,
    crypto:{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:a=>a},Promise,__els:els};
  c.window=c;c.globalThis=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(CMS_PATH,'utf8')+BRIDGE,c,{filename:'cms.js'});
  return c;
}
let __async=true;const results=[];const check=(n,p,d)=>results.push([n,p,d]);
const key=(k,extra={})=>({key:k,preventDefault(){},...extra});

// ---- 1) YAMA を打って Enter → そのまま入るか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[{id:'yamarchy',name:'Yamarchy'}];
  c.__T.lineups.f.length=0;
  const input=c.document.getElementById('f-lineupInput');
  input.value='YAMA';
  c.filterArtists('f-lineupInput','f-autocomplete','f');
  const list=c.document.getElementById('f-autocomplete');
  const shown=(list.innerHTML.match(/autocomplete-item/g)||[]).length;
  c.acKeydown(key('Enter'),'f-autocomplete','f');
  check('YAMA と打って Enter でそのまま入る',
    c.__T.lineups.f.includes('?YAMA'), `候補${shown}件 / lineup=${JSON.stringify(c.__T.lineups.f)}`);
}

// ---- 2) 日本語入力の変換確定 Enter で誤って確定しないか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[];
  c.__T.lineups.f.length=0;
  const input=c.document.getElementById('f-lineupInput');
  input.value='やま';   // 変換途中
  c.acKeydown(key('Enter',{isComposing:true}),'f-autocomplete','f');
  check('IME変換中の Enter で確定させない',
    !c.__T.lineups.f.length, `lineup=${JSON.stringify(c.__T.lineups.f)}`);
}

// ---- 3) 候補が出ている状態で Enter を押したら、入力値が優先されるか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[{id:'yamarchy',name:'Yamarchy'}];
  c.__T.lineups.f.length=0;
  const input=c.document.getElementById('f-lineupInput');
  input.value='YAMA';
  c.filterArtists('f-lineupInput','f-autocomplete','f');
  c.acKeydown(key('Enter'),'f-autocomplete','f');
  check('候補が出ていても入力値が優先される',
    c.__T.lineups.f.includes('?YAMA') && !c.__T.lineups.f.includes('yamarchy'),
    JSON.stringify(c.__T.lineups.f));
}

// ---- 4) 前の操作で選択が残っていると誤って候補が入らないか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[{id:'yamarchy',name:'Yamarchy'}];
  c.__T.lineups.f.length=0;
  const input=c.document.getElementById('f-lineupInput');
  input.value='YAMA';
  c.filterArtists('f-lineupInput','f-autocomplete','f');
  c.__T.acHighlight=0;                     // 前に矢印キーを使った状態
  c.acKeydown(key('Enter'),'f-autocomplete','f');
  check('前の選択状態が残っていても暴発しない',
    !c.__T.lineups.f.includes('yamarchy'), JSON.stringify(c.__T.lineups.f)+' highlight=0');
}


// ---- 5) 未照合タグに「新規登録」ボタンが出るか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[{id:'yamarchy',name:'Yamarchy'}];
  c.__T.lineups.f.length=0; c.__T.lineups.f.push('?YAMA');
  c.renderLineupTags('f');
  const html=c.document.getElementById('f-lineupTags').innerHTML;
  check('未照合タグに新規登録ボタンが出る',
    /lineup-register/.test(html) && /YAMA」を新規登録/.test(html),
    /lineup-register/.test(html)?'あり':'なし');
  check('候補（採用）ボタンも併存する',
    /adoptArtistSuggestion/.test(html), /adoptArtistSuggestion/.test(html)?'あり':'なし');
}

// ---- 6) 打った表記のまま登録され、タグが照合済みになるか ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[]; c.__T.lineups.f.length=0; c.__T.lineups.f.push('?Ben UFO');
  c.toast=()=>{}; c.markFormDirty=()=>{}; c.confirm=()=>true;
  let sent=null;
  c.gasPostJson_ = async (body)=>{ sent=body; return {status:'ok'}; };
  await c.registerLineupArtist('f','?Ben UFO');
  check('打った表記のまま NAME に入る（Ben Ufo にしない）',
    sent && sent.name==='Ben UFO' && sent.id==='ben-ufo', JSON.stringify(sent));
  check('登録後タグが照合済みになる',
    c.__T.lineups.f.includes('ben-ufo') && !c.__T.lineups.f.includes('?Ben UFO'),
    JSON.stringify(c.__T.lineups.f));
}

// ---- 7) 既存IDと衝突したら登録しない ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[{id:'yamarchy',name:'Yamarchy'}];
  c.__T.lineups.f.length=0; c.__T.lineups.f.push('?Yamarchy');
  let msg=''; c.toast=(m)=>{msg=m;}; c.markFormDirty=()=>{}; c.confirm=()=>true;
  let sent=null; c.gasPostJson_=async(b)=>{sent=b;return {status:'ok'};};
  await c.registerLineupArtist('f','?Yamarchy');
  check('既存IDと衝突したら登録しない', sent===null && /既にあります/.test(msg), msg.slice(0,36));
}

console.log('\n検証項目'.padEnd(44)+'判定  実測');
console.log('-'.repeat(92));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(42)+'  '+(p?'✅':'❌')+'   '+String(d).slice(0,42)); }
console.log('-'.repeat(92));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail ? 1 : 0);
