#!/usr/bin/env node
/** CMS のフェス削除が EDITIONS / LINEUPS まで連鎖することを検証する。 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=fs.readFileSync(path.join(root,'LP/cms.js'),'utf8');
const bridge=`;globalThis.__T={
 get editionSheetRows(){return editionSheetRows},set editionSheetRows(v){editionSheetRows=v},
 get lineupSheetRows(){return lineupSheetRows},set lineupSheetRows(v){lineupSheetRows=v},
 get editionSheetLoaded(){return editionSheetLoaded},set editionSheetLoaded(v){editionSheetLoaded=v},
 get listCache(){return listCache},collectFestivalChildren_,confirmDelete,executeDelete
};`;
function context(){
  const calls=[],store=new Map(),elements=new Map();
  const element=id=>elements.get(id)||elements.set(id,{value:'',textContent:'',onclick:null,style:{},classList:{add(){this.opened=true},remove(){},toggle(){}},addEventListener(){},querySelectorAll:()=>[]}).get(id);
  const c={console,document:{documentElement:{lang:'ja'},getElementById:element,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:()=>element('created'),body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},head:{appendChild(){}},cookie:''},
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},sessionStorage:{getItem:()=>null,setItem(){}},
    location:{href:'http://localhost/cms.html',search:'',hash:'',origin:'http://localhost'},navigator:{userAgent:'node',onLine:true},
    fetch:async(_url,opts)=>{if(opts?.body)calls.push(JSON.parse(opts.body));return{json:async()=>({status:'ok'})}},
    prompt:()=>'',confirm:()=>true,alert(){},addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),requestAnimationFrame:f=>setTimeout(f,0),scrollTo(){},getComputedStyle:()=>({}),history:{replaceState(){},pushState(){}},IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},URL,URLSearchParams,TextEncoder,TextDecoder,crypto:{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:a=>a},Promise,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Error,Map,Set,setTimeout,clearTimeout,setInterval,clearInterval};
  c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(source+bridge,c,{filename:'cms.js'});c.calls=calls;c.elements=elements;return c;
}
const results=[];const check=(n,ok,d)=>results.push([n,ok,d]);
{
 const c=context();c.__T.editionSheetRows=[{_row:62,FESTIVAL_ID:'music-camp-core',EDITION_ID:'music-camp-core-2025'},{_row:100,FESTIVAL_ID:'yagura',EDITION_ID:'yagura-2026'},{_row:101,FESTIVAL_ID:'yagura',EDITION_ID:'yagura-2027'},{_row:102,FESTIVAL_ID:'other',EDITION_ID:'other-2026'}];c.__T.lineupSheetRows=[{_row:210,EDITION_ID:'yagura-2026'},{_row:211,EDITION_ID:'other-2026'},{_row:212,EDITION_ID:'yagura-2027'},{_row:213,EDITION_ID:'yagura-2026'}];const x=c.__T.collectFestivalChildren_('yagura');
 check('関連する開催回2件・出演者3件を拾う',x.editions.length===2&&x.lineups.length===3,`editions=${x.editions.length} lineups=${x.lineups.length}`);check('他フェスの行を巻き込まない',x.editionIds.join(',')==='yagura-2026,yagura-2027'&&!x.lineups.some(r=>r.EDITION_ID==='other-2026'),x.editionIds.join(','));
}
{
 const c=context();c.__T.editionSheetLoaded=false;c.__T.listCache.festival=[{_row:5,id:'yagura'}];let msg='';c.toast=m=>{msg=m};c.confirmDelete('festival',5,'YAGURA');check('EDITIONS未読込時はダイアログを開かない',msg.includes('読み込め')&&!c.elements.get('confirmDialog')?.classList.opened,msg||'toastなし');
}
{
 const c=context();c.__T.editionSheetLoaded=true;c.__T.listCache.festival=[{_row:5,id:'yagura'}];c.__T.editionSheetRows=[{_row:20,FESTIVAL_ID:'yagura',EDITION_ID:'yagura-2026'},{_row:22,FESTIVAL_ID:'yagura',EDITION_ID:'yagura-2027'}];c.__T.lineupSheetRows=[{_row:30,EDITION_ID:'yagura-2026'},{_row:28,EDITION_ID:'yagura-2026'},{_row:31,EDITION_ID:'yagura-2027'}];c.confirmDelete('festival',5,'YAGURA');await c.elements.get('confirmOk').onclick();
 const expected=[['LINEUPS',31],['LINEUPS',30],['LINEUPS',28],['EDITIONS',22],['EDITIONS',20],['FESTIVALS',5]];
 check('削除順はLINEUPS→EDITIONS→FESTIVALS、各シート降順',JSON.stringify(c.calls.map(x=>[x.sheet,x.row]))===JSON.stringify(expected),JSON.stringify(c.calls));
}
{
 const c=context();c.__T.editionSheetLoaded=true;c.__T.listCache.festival=[{_row:5,id:'yagura'}];c.__T.editionSheetRows=[{_row:20,FESTIVAL_ID:'yagura',EDITION_ID:'yagura-2026'}];c.__T.lineupSheetRows=[{_row:30,EDITION_ID:'yagura-2026'},{_row:28,EDITION_ID:'yagura-2026'}];let n=0;c.gasPostJson_=async body=>{n++;if(n===2)return{status:'error',message:'停止'};c.calls.push(body);return{status:'ok'}};c.confirmDelete('festival',5,'YAGURA');await c.elements.get('confirmOk').onclick();check('途中失敗後は次のdelete_rowを呼ばない',c.calls.length===1&&c.calls[0].sheet==='LINEUPS',JSON.stringify(c.calls));
}
{
 const c=context();c.__T.editionSheetLoaded=true;c.__T.listCache.festival=[{_row:5,id:'empty'}];c.__T.editionSheetRows=[];c.__T.lineupSheetRows=[];c.confirmDelete('festival',5,'EMPTY');await c.elements.get('confirmOk').onclick();check('関連0件は親1回だけ削除する',c.calls.length===1&&c.calls[0].sheet==='FESTIVALS',JSON.stringify(c.calls));
}
let failed=0;for(const[r,ok,d]of results){if(!ok)failed++;console.log(r+'  '+(ok?'✅':'❌')+'  '+d)}if(failed)process.exitCode=1;
