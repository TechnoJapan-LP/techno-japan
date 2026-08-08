#!/usr/bin/env node
/**
 * CMS の施設名ジオコーディングを検証する。
 *
 * ■ 何を守るか（AUDIT §9-59）
 *
 *   施設名検索（Nominatim）は「それらしい別の場所」を返すことがある。
 *   実測（2026-08-09）:
 *     「UNIT, 代官山」→ 37.4527, 116.2691  ← 中国内陸部
 *     正しくは 35.6471, 139.7023（東京・代官山）
 *
 *   確認せずに入力欄へ書き込むと、当たったように見えて**まったく違う場所**が
 *   入る。地図リンクも詳細ページの座標も狂うが、**数字なので目視では
 *   気づけない。** 日本の範囲外は採用しない。
 *
 *   守りたい性質:
 *     1. 日本国外の座標は入れない
 *     2. 日本国内なら入る
 *     3. 会場は Name を施設名として使う（Location 欄を持たないため）
 *
 * ■ なぜブラウザで見ないのか
 *   cms.html は読み込み時に prompt() を出して headless では固まる（§9-44）。
 *   cms.js だけを VM に読み込み、fetch を差し替えて関数を直接叩く。
 *
 * 使い方:
 *   node scripts/check_cms_geocode.mjs
 */

import fs from 'node:fs'; import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CMS_PATH = path.join(ROOT, 'LP', 'cms.js');
function ctxOf(){
  const els=new Map();
  const mk=id=>({id,value:'',innerHTML:'',dataset:{},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(){},contains(){return false}},
    style:{},addEventListener(){},querySelectorAll:()=>[]});
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
    __els:els};
  c.window=c;c.globalThis=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(CMS_PATH,'utf8'),c,{filename:'cms.js'});
  return c;
}
const results=[];const check=(n,p,d)=>results.push([n,p,d]);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// ① 日本国外の座標は入らない
{
  const c=ctxOf();
  c.toast=()=>{}; c.updateLocationMap=()=>{};
  c.document.getElementById('v-name').value='UNIT';
  c.document.getElementById('v-city').value='';
  // Nominatim を偽装して、中国内陸の座標を返させる
  c.fetch=async(u)=>({json:async()=>
    String(u).includes('nominatim')
      ? [{lat:'37.4527860',lon:'116.2691701',display_name:'どこか'}]
      : ({status:'error'})});
  c.geocodeFromLocation('v');
  await wait(4000);
  const lat=c.document.getElementById('v-lat').value;
  check('日本国外の座標は入れない', lat==='', lat===''?'空のまま（正しい）':'入ってしまった: '+lat);
}

// ② 日本国内なら入る
{
  const c=ctxOf();
  c.toast=()=>{}; c.updateLocationMap=()=>{};
  c.document.getElementById('v-name').value='WOMB';
  c.fetch=async(u)=>({json:async()=>
    String(u).includes('nominatim')
      ? [{lat:'35.6584259',lon:'139.6950494',display_name:'Womb, 渋谷区'}]
      : ({status:'error'})});
  c.geocodeFromLocation('v');
  await wait(2500);
  const lat=c.document.getElementById('v-lat').value, lng=c.document.getElementById('v-lng').value;
  check('日本国内なら座標が入る', lat==='35.6584'&&lng==='139.6950', lat+', '+lng);
}

// ③ 会場は Name を施設名として使う
{
  const c=ctxOf();
  let asked='';
  c.toast=(m)=>{asked=m}; c.updateLocationMap=()=>{};
  c.document.getElementById('v-name').value='';
  c.geocodeFromLocation('v');
  check('会場名が空なら会場名の入力を促す', /会場名/.test(asked), asked||'(何も出ない)');
}

console.log('\n検証項目'.padEnd(40)+'判定  実測');
console.log('-'.repeat(84));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(38)+'  '+(p?'✅':'❌')+'   '+String(d).slice(0,36)); }
console.log('-'.repeat(84));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail?1:0);
