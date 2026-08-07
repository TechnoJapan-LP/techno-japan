#!/usr/bin/env node
/**
 * CMS の ARTICLE / Author 候補（オートコンプリート）を検証する。
 *
 * ■ なぜブラウザで見ないのか
 *
 *   cms.html は読み込み時に prompt('CMS Password:') を出すので headless では
 *   固まる（AUDIT §9-44 で実測）。cms.js だけを VM に読み込み、DOM と fetch を
 *   差し替えて関数を直接叩く。scripts/check_cms_editions.mjs と同じ方式。
 *
 * ■ 何を守るか（AUDIT §9-52）
 *
 *   Author は自由入力なので、同じ人が「TECHNO JAPAN」「Techno Japan」と
 *   表記ゆれしたまま溜まる。記事一覧や記事詳細にそのまま出るので、
 *   ゆれると別人に見える。候補は AUTHORS シートの登録者と、
 *   過去の記事で実際に使われた名前の両方から出す。
 *
 *   守りたい性質:
 *     1. 候補が出る（シート・過去記事の両方から、重複なく）
 *     2. 前方一致を先に並べる
 *     3. クリックしたときだけ入力欄が変わる（暗黙変換をしない）
 *     4. 入力値と同じ候補は出さない（出す意味がない）
 *     5. AUTHORS が空でも壊れない
 *
 * 使い方:
 *   node scripts/check_cms_authors.mjs
 */

import fs from 'node:fs'; import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');

const BRIDGE = `
;globalThis.__T = {
  get AUTHOR_DB(){return AUTHOR_DB}, set AUTHOR_DB(v){AUTHOR_DB=v},
  get acHighlight(){return acHighlight}, set acHighlight(v){acHighlight=v},
  get listCache(){return listCache},
};`;
const src = fs.readFileSync(CMS_PATH, 'utf8') + BRIDGE;

function makeCtx(){
  const els = new Map();
  const mkEl = (id) => {
    const el = {
      id, value:'', innerHTML:'', dataset:{},
      classList:{ _s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
                  toggle(c,v){v?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)} },
      style:{}, addEventListener(){},
      querySelectorAll(sel){
        if(!/autocomplete-item/.test(sel)) return [];
        const n=(el.innerHTML.match(/class="autocomplete-item"/g)||[]).length;
        return Array.from({length:n},(_,i)=>({ classList:{toggle(){}}, click(){ el._clicked=i; } }));
      },
    };
    return el;
  };
  const ctx = {
    console,
    document:{ documentElement:{lang:'ja'},
      getElementById:(id)=>{ if(!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
      querySelector:()=>null, querySelectorAll:()=>[], addEventListener(){},
      createElement:()=>mkEl('tmp'), body:{appendChild(){},classList:{add(){},remove(){},toggle(){}}},
      head:{appendChild(){}}, cookie:'' },
    localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
    location:{href:'http://localhost/cms.html',search:'',hash:'',origin:'http://localhost'},
    navigator:{userAgent:'node',onLine:true},
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async()=>({json:async()=>({status:'ok'})}),
    prompt:()=>'x', confirm:()=>true, alert:()=>{},
    addEventListener(){}, removeEventListener(){},
    matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
    requestAnimationFrame:(f)=>setTimeout(f,0), scrollTo(){}, getComputedStyle:()=>({}),
    history:{replaceState(){},pushState(){}},
    IntersectionObserver: class { observe(){} unobserve(){} disconnect(){} },
    URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto:{subtle:{digest:async()=>new ArrayBuffer(32)},getRandomValues:(a)=>a},
    Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
    __els: els,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx, {filename:'cms.js'});
  return ctx;
}

const results=[];
const check=(n,p,d)=>results.push([n,p,d]);

const c = makeCtx();
c.markFormDirty = () => {};
// AUTHORS シートに2名、過去記事に1名
c.__T.AUTHOR_DB = [{id:'techno-japan', name:'TECHNO JAPAN'}, {id:'mari', name:'Mari Sakurai'}];
c.__T.listCache.article = [{author:'Masafumi Take'}, {author:'TECHNO JAPAN'}];

const input = c.document.getElementById('ar-author');
const list  = c.document.getElementById('ar-author-ac');

// 1) 空欄でフォーカス → 全候補が出る
input.value=''; c.filterAuthors('ar-author','ar-author-ac',true);
const n1=(list.innerHTML.match(/autocomplete-item/g)||[]).length;
check('空欄で候補が出る（AUTHORS 2名＋過去記事1名）', n1===3 && list.classList.contains('show'), `${n1}件`);

// 2) 絞り込み
input.value='ma'; c.filterAuthors('ar-author','ar-author-ac');
const names=[...list.innerHTML.matchAll(/data-name="([^"]*)"/g)].map(m=>m[1]);
check('「ma」で前方一致が先頭に来る', names[0]==='Mari Sakurai' && names.includes('Masafumi Take'), names.join(', '));

// 3) 重複しない（TECHNO JAPAN はシートと過去記事の両方にある）
input.value=''; c.filterAuthors('ar-author','ar-author-ac',true);
const all=[...list.innerHTML.matchAll(/data-name="([^"]*)"/g)].map(m=>m[1]);
check('同じ名前が重複しない', new Set(all).size===all.length, all.join(', '));

// 4) 候補をクリックすると入力欄が置き換わる
c.adoptAuthor('ar-author','ar-author-ac','Mari Sakurai');
check('候補を選ぶと入力欄に入る', input.value==='Mari Sakurai' && !list.classList.contains('show'), input.value);

// 5) 入力値と完全一致の候補は出さない（出す意味がない）
input.value='TECHNO JAPAN'; c.filterAuthors('ar-author','ar-author-ac');
const after=[...list.innerHTML.matchAll(/data-name="([^"]*)"/g)].map(m=>m[1]);
check('入力値と同じ候補は出さない（候補欄が閉じる）',
  !after.includes('TECHNO JAPAN') && !list.classList.contains('show'),
  (after.join(', ')||'(候補なし)') + ' / show=' + list.classList.contains('show'));

// 6) 入力を勝手に候補へ書き換えない
input.value='Yamada'; c.filterAuthors('ar-author','ar-author-ac');
check('入力値を勝手に変えない', input.value==='Yamada', input.value);

// 7) シートが空でも壊れない
const c2=makeCtx(); c2.markFormDirty=()=>{};
c2.__T.AUTHOR_DB=[]; c2.__T.listCache.article=[];
let ok=true; try{ c2.filterAuthors('ar-author','ar-author-ac',true);}catch(e){ok=false;}
check('AUTHORS が空でも例外にならない', ok, ok?'OK':'例外');

console.log('\n検証項目'.padEnd(46)+'判定  実測');
console.log('-'.repeat(92));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(44)+'  '+(p?'✅':'❌')+'   '+d); }
console.log('-'.repeat(92));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail?1:0);
