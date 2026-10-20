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
const BRIDGE=`;globalThis.__T={ get lineups(){return lineups}, get editions(){return editions}, get ARTIST_DB(){return ARTIST_DB},
  set ARTIST_DB(v){ARTIST_DB=v}, get acHighlight(){return acHighlight}, set acHighlight(v){acHighlight=v},
  get lineupSheetRows(){return lineupSheetRows}, set lineupSheetRows(v){lineupSheetRows=v},
  get lineupSheetMaxRow(){return lineupSheetMaxRow}, set lineupSheetMaxRow(v){lineupSheetMaxRow=v},
  syncLineupRowsForEdition };`;
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
async function syncCaptured(c, labels, existingRows){
  const sent=[];
  c.fetch=async (_url, options)=>{sent.push(JSON.parse(options.body));return {json:async()=>({status:'ok'})};};
  const requests=[];
  c.__T.lineupSheetRows=[...existingRows];
  c.__T.lineupSheetMaxRow=Math.max(1,...existingRows.map(r=>Number(r._row)||0));
  c.syncLineupRowsForEdition('fest-2026', labels, existingRows, requests);
  await Promise.all(requests);
  return sent;
}

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

// ---- 8) 部分一致では自動変換せず、候補提示だけ行う ----
{
  const c=ctxOf();
  c.__T.ARTIST_DB=[
    {id:'sho',name:'SHO'},
    {id:'yamarchy',name:'Yamarchy'},
    {id:'dj-nobu',name:'DJ Nobu'},
  ];
  check('Shohei Takata は sho に自動変換しない',
    c.matchArtist('Shohei Takata')===null, String(c.matchArtist('Shohei Takata')));
  check('YAMA は Yamarchy に自動変換しない',
    c.matchArtist('YAMA')===null, String(c.matchArtist('YAMA')));
  check('DJ Nobu の完全一致は生きている',
    c.matchArtist('DJ Nobu')==='dj-nobu', String(c.matchArtist('DJ Nobu')));
  check('dj nobu の slug 一致は生きている',
    c.matchArtist('dj nobu')==='dj-nobu', String(c.matchArtist('dj nobu')));
  const shoCandidates=c.suggestArtistCandidates('Shohei Takata');
  check('Shohei Takata の候補に sho を出さない',
    !shoCandidates.some(a=>a.id==='sho'), JSON.stringify(shoCandidates));
  const yamaCandidates=c.suggestArtistCandidates('YAMA');
  check('YAMA の候補に Yamarchy を出す',
    yamaCandidates.some(a=>a.id==='yamarchy'), JSON.stringify(yamaCandidates));
}

// ---- 9) フェス共通 LINEUP を確認後に一括クリアできるか ----
{
  const c=ctxOf();
  c.__T.lineups.f.push('a','b','c');
  let dirty=0; c.markFormDirty=()=>{dirty++;}; c.confirm=()=>true; c.toast=()=>{};
  c.clearLineup('f');
  check('フェス共通 LINEUP を確認後に一括クリアできる',
    c.__T.lineups.f.length===0, JSON.stringify(c.__T.lineups.f));
}

// ---- 10) キャンセル時はフェス共通 LINEUP を消さないか ----
{
  const c=ctxOf();
  c.__T.lineups.f.push('a','b','c');
  c.confirm=()=>false; c.toast=()=>{};
  c.clearLineup('f');
  check('フェス共通 LINEUP はキャンセル時に消えない',
    c.__T.lineups.f.length===3, JSON.stringify(c.__T.lineups.f));
}

// ---- 11) 空のフェス共通 LINEUP は確認なしで何もしないか ----
{
  const c=ctxOf();
  let confirmed=0, type=''; c.confirm=()=>{confirmed++;return true;}; c.toast=(_,t)=>{type=t;};
  c.clearLineup('f');
  check('空の LINEUP は確認なしで info 通知だけ出す',
    confirmed===0 && type==='info', `confirm=${confirmed} type=${type}`);
}

// ---- 12) 開催回 LINEUP だけを一括クリアし、他の開催回を保持するか ----
{
  const c=ctxOf();
  c.__T.editions.push({year:'2026',lineup:['a','b']},{year:'2027',lineup:['c']});
  let dirty=0; c.markFormDirty=()=>{dirty++;}; c.confirm=()=>true; c.toast=()=>{};
  c.clearEditionLineup(0);
  check('開催回 LINEUP のクリアが対象の開催回だけに適用される',
    c.__T.editions[0].lineup.length===0 && c.__T.editions[1].lineup.length===1,
    JSON.stringify(c.__T.editions));
}

// ---- 13) クリア後は未保存状態になるか ----
{
  const c=ctxOf();
  c.__T.lineups.f.push('a');
  let dirty=0; c.markFormDirty=()=>{dirty++;}; c.confirm=()=>true; c.toast=()=>{};
  c.clearLineup('f');
  check('LINEUP クリア後に markFormDirty が呼ばれる', dirty===1, `dirty=${dirty}`);
}

// ---- 14) 既存 LINEUPS の人物照合と属性引き継ぎ ----
const artistRows=[
  {id:'dj-kensei',name:'DJ KENSEI'},
  {id:'live-a',name:'LIVE A'},
  {id:'live-b',name:'LIVE B'},
  {id:'new-artist',name:'NEW ARTIST'},
];
const lineupRows=[
  {_row:2,EDITION_ID:'fest-2026',ACT_LABEL:'',ARTIST_ID:'dj-kensei',SET_TYPE:'dj',STAGE:'A'},
  {_row:3,EDITION_ID:'fest-2026',ACT_LABEL:'LIVE A',ARTIST_ID:'live-a',SET_TYPE:'live',STAGE:'B'},
  {_row:4,EDITION_ID:'fest-2026',ACT_LABEL:'LIVE B',ARTIST_ID:'live-b',SET_TYPE:'live',STAGE:'C'},
];
{
  const c=ctxOf(); c.__T.ARTIST_DB=artistRows;
  check('ACT_LABEL空・ARTIST_IDだけの行を名前表示できる',
    c.lineupDisplayLabel(lineupRows[0])==='DJ KENSEI', c.lineupDisplayLabel(lineupRows[0]));
  const sent=await syncCaptured(c,['DJ KENSEI','LIVE A','LIVE B'],lineupRows);
  check('ACT_LABEL空の既存行も保存後にARTIST_IDを保持する',
    sent[0].ARTIST_ID==='dj-kensei' && sent[0].ACT_LABEL==='DJ KENSEI', JSON.stringify(sent[0]));
}
{
  const c=ctxOf(); c.__T.ARTIST_DB=[{id:'sunga',name:'SUNGA'}];
  const rows=[{_row:2,EDITION_ID:'fest-2026',ACT_LABEL:'SUNGA',ARTIST_ID:'',SET_TYPE:'dj'}];
  const sent=await syncCaptured(c,['SUNGA'],rows);
  check('既存行の既知アーティストにARTIST_IDを補完する',
    sent[0].ARTIST_ID==='sunga', JSON.stringify(sent[0]));
}
{
  const c=ctxOf(); c.__T.ARTIST_DB=artistRows;
  const sent=await syncCaptured(c,['NEW PERSON','DJ KENSEI','LIVE A','LIVE B'],lineupRows);
  const byLabel=new Map(sent.map(x=>[x.ACT_LABEL,x]));
  check('先頭追加でも既存全員のIDとSET_TYPEを人物単位で保持する',
    byLabel.get('DJ KENSEI')?.ARTIST_ID==='dj-kensei' && byLabel.get('LIVE A')?.ARTIST_ID==='live-a'
      && byLabel.get('LIVE A')?.SET_TYPE==='live' && byLabel.get('LIVE B')?.ARTIST_ID==='live-b'
      && byLabel.get('LIVE B')?.SET_TYPE==='live', JSON.stringify(sent));
}
{
  const c=ctxOf(); c.__T.ARTIST_DB=artistRows;
  const sent=await syncCaptured(c,['DJ KENSEI','LIVE B'],lineupRows);
  const blank=sent.find(x=>x.row===4);
  check('1人削除で残りのIDを保持し余り行を空白化する',
    sent[0].ARTIST_ID==='dj-kensei' && sent[1].ARTIST_ID==='live-b'
      && blank?.EDITION_ID==='' && blank?.ARTIST_ID==='' && blank?.ACT_LABEL==='', JSON.stringify(sent));
}
{
  const c=ctxOf(); c.__T.ARTIST_DB=artistRows;
  const sent=await syncCaptured(c,['NEW ARTIST','LIVE A & LIVE B','LIVE A b2b LIVE B'],lineupRows);
  check('既知の名前にはIDを付け複合枠には付けない',
    sent[0].ARTIST_ID==='new-artist' && sent[0].ACT_LABEL==='NEW ARTIST'
      && sent[1].ARTIST_ID==='' && sent[1].ACT_LABEL==='LIVE A & LIVE B'
      && sent[2].ARTIST_ID==='' && sent[2].ACT_LABEL==='LIVE A b2b LIVE B', JSON.stringify(sent));
}
{
  const c=ctxOf(); c.__T.ARTIST_DB=artistRows;
  const sent=await syncCaptured(c,['LIVE B','DJ KENSEI','LIVE A'],lineupRows);
  const ids=sent.filter(x=>x.EDITION_ID).map(x=>x.ARTIST_ID);
  check('並べ替えだけで全員のIDを保持する',
    ids.join(',')==='live-b,dj-kensei,live-a', JSON.stringify(sent));
}

console.log('\n検証項目'.padEnd(44)+'判定  実測');
console.log('-'.repeat(92));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(42)+'  '+(p?'✅':'❌')+'   '+String(d).slice(0,160)); }
console.log('-'.repeat(92));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail ? 1 : 0);
