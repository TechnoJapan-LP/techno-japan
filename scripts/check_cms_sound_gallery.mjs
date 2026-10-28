#!/usr/bin/env node
/* SOUND / GALLERY の CMS 経路を、GASへ接続せずに検査する。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cms = fs.readFileSync(path.join(root, 'LP', 'cms.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'LP', 'cms.html'), 'utf8');
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

check(/id="f-sound"/.test(html), 'FESTIVALS に f-sound がない');
check(/placeholder="Funktion-One"/.test(html), 'SOUND の例がない');
check(/id="v-gallery"/.test(html) && /id="v-gallery-2-path"/.test(html) && /id="v-gallery-3-path"/.test(html), 'GALLERY の2枠がない');
check((html.match(/data-gallery-control/g) || []).length >= 6, 'GALLERY の操作部品が不足している');
check(/setSoundGalleryAvailability\('festival', false\)/.test(cms), '新規フェスで SOUND を無効化していない');
check(/setSoundGalleryAvailability\('venue', false\)/.test(cms), '新規会場で GALLERY を無効化していない');
check(/hasSheetField\(state,'sound'\).*payload\.sound=g\('f-sound'\)/s.test(cms), '既存フェス編集の SOUND payload がない');
check(/hasSheetField\(state,'gallery'\).*payload\.gallery=g\('v-gallery'\)/s.test(cms), '既存会場編集の GALLERY payload がない');
check(/'sound','gallery'/.test(cms), 'SHEET_FIELD_NAMES に SOUND/GALLERY がない');
check(/get_sheet.*latest|最新の行を取得/s.test(cms), '一括保存の直前再取得がない');
const addStart = cms.indexOf('function submitToSheet');
const addEnd = cms.indexOf('\nfunction ', addStart + 10);
const addBlock = cms.slice(addStart, addEnd);
check(!/sound\s*:\s*g\('f-sound'\)|gallery\s*:\s*g\('v-gallery'\)/.test(addBlock), '新規作成 payload に SOUND/GALLERY が入っている');

const el = () => ({ value:'', disabled:false, style:{}, addEventListener(){}, querySelectorAll:()=>[],
  classList:{add(){},remove(){},toggle(){},contains(){return false;}} });
const ctx = {
  console,
  document:{documentElement:{lang:'ja'},getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener(){},createElement:()=>el(),body:{appendChild(){},classList:{add(){},remove(){}}},head:{appendChild(){}},cookie:''},
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}}, sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  location:{href:'http://localhost/cms.html',search:'',hash:'',origin:'http://localhost'},
  navigator:{userAgent:'node',onLine:true}, fetch:async()=>({json:async()=>({status:'ok'})}),
  prompt:()=>'',confirm:()=>true,alert:()=>{},addEventListener(){},removeEventListener(){},
  setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:f=>setTimeout(f,0),scrollTo(){},
  getComputedStyle:()=>({}),matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),
  history:{replaceState(){},pushState(){}},IntersectionObserver:class{observe(){}unobserve(){}disconnect(){}},
  URL,URLSearchParams,TextEncoder,TextDecoder,crypto:{subtle:{digest:async()=>new ArrayBuffer(32)}},
  Promise,Date,Math,JSON,Object,Array,String,Number,Boolean,RegExp,Error,Map,Set,
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(`${cms}\n;globalThis.__T={buildFestivalsJs,buildVenuesJs,buildHubDataJs,bulkSaveRow,imageUploadTarget,uploadFromUrlBody,assertImageUploadPath};`, ctx, {filename:'cms.js'});

const galleryTarget = (slot, ext = 'webp') => ctx.__T.imageUploadTarget('venue-gallery-'+slot, 'womb', ext);
[2, 3].forEach(slot => {
  const target = galleryTarget(slot);
  check(target.type === 'venue', `GALLERY ${slot} のGAS typeが venue ではない`);
  check(target.id === `womb-${slot}`, `GALLERY ${slot} のGAS idが womb-${slot} ではない`);
  check(target.filename === `womb-${slot}.webp`, `GALLERY ${slot} のfilenameが womb-${slot}.webp ではない`);
  check(ctx.__T.assertImageUploadPath('venue-gallery-'+slot, 'womb', `images/venues/womb-${slot}.webp`) === `images/venues/womb-${slot}.webp`, `GALLERY ${slot} の正常パスを受理しない`);
  let rejected = false;
  try { ctx.__T.assertImageUploadPath('venue-gallery-'+slot, 'womb', 'images/venues/womb.webp'); } catch (_) { rejected = true; }
  check(rejected, `GALLERY ${slot} がメイン写真の返却パスを拒否しない`);
});
const uploadImageBlock = cms.slice(cms.indexOf('function uploadImage('), cms.indexOf('\n// Render an "upload failed" state'));
const compressBlock = cms.slice(cms.indexOf('async function compressUrlAndUpload('), cms.indexOf('\n/* ==============================================================\n   IMAGE PREVIEW HELPERS'));
const uploadFromUrlBlock = cms.slice(cms.indexOf('function uploadFromUrl('), cms.indexOf('\n/* ==============================================================\n   AI GENERATE'));
check(/const target=imageUploadTarget\(type,id,ext\)/.test(uploadImageBlock), 'ファイル経路が共通のGALLERY送信変換を使っていない');
check(/const target=imageUploadTarget\(type,id,comp\.ext\)/.test(compressBlock), '圧縮URL経路が共通のGALLERY送信変換を使っていない');
check(/uploadFromUrlBody\(url,type,id\)/.test(uploadFromUrlBlock), 'CORSフォールバックが原寸用のbody関数を使っていない');
check((uploadImageBlock.match(/assertImageUploadPath\(type,id,imagePath\)/g) || []).length === 1, 'ファイル経路の返却パス検証がない');
check((compressBlock.match(/assertImageUploadPath\(type,id,/g) || []).length === 1, '圧縮URL経路の返却パス検証がない');
check((uploadFromUrlBlock.match(/assertImageUploadPath\(type,id,path\)/g) || []).length === 2, 'CORSフォールバックを含むURL経路の返却パス検証が不足している');
check(!/\.\.\.imageUploadTarget\(type,id,'webp'\)/.test(uploadFromUrlBlock), 'CORSフォールバックがfilename付きのbodyを送っている');
check(!/upload_from_url[^\n]*type:type[^\n]*id:id/.test(uploadFromUrlBlock), 'CORSフォールバックが画面用type/idをGASへ送っている');

const mainUploadBody = ctx.__T.uploadFromUrlBody('https://example.com/main.jpg', 'venue', 'womb');
check(JSON.stringify(mainUploadBody) === JSON.stringify({
  action:'upload_from_url', imageUrl:'https://example.com/main.jpg', type:'venue', id:'womb'
}), '会場メイン写真のCORSフォールバックbodyが変更前と一致しない');
const flyerUploadBody = ctx.__T.uploadFromUrlBody('https://example.com/flyer.jpg', 'festival-flyer', 'f1');
check(JSON.stringify(flyerUploadBody) === JSON.stringify({
  action:'upload_from_url', imageUrl:'https://example.com/flyer.jpg', type:'festival-flyer', id:'f1'
}), 'フェスのフライヤーのCORSフォールバックbodyが不正');
[2, 3].forEach(slot => {
  const body = ctx.__T.uploadFromUrlBody('https://example.com/gallery-'+slot+'.jpg', 'venue-gallery-'+slot, 'womb');
  check(JSON.stringify(body) === JSON.stringify({
    action:'upload_from_url', imageUrl:'https://example.com/gallery-'+slot+'.jpg', type:'venue', id:'womb-'+slot
  }), `GALLERY ${slot} のCORSフォールバックbodyが不正`);
  check(!Object.prototype.hasOwnProperty.call(body, 'filename'), `GALLERY ${slot} のCORSフォールバックbodyにfilenameがある`);
});

const festival = ctx.__T.buildFestivalsJs([{id:'f1',name:'F1',status:'published',sound:'Funktion-One'}]);
const festivalEmpty = ctx.__T.buildFestivalsJs([{id:'f2',name:'F2',status:'published'}]);
check(/sound: "Funktion-One"/.test(festival), 'buildFestivalsJs が SOUND を出さない');
check(!/sound:/.test(festivalEmpty), '空の SOUND を出している');

const venue = ctx.__T.buildVenuesJs([{id:'v1',name:'V1',status:'published',image:'images/venues/v1.jpg',gallery:'images/venues/v1-2.jpg, images/venues/v1-3.png, images/venues/v1-4.jpg'}]);
check(/gallery: \["images\/venues\/v1-2\.webp", "images\/venues\/v1-3\.webp"\]/.test(venue), 'GALLERY が webp 配列・最大2で出ない');
check(!venue.includes('v1-4.webp'), 'GALLERY が3枚以上出ている');
const hub = ctx.__T.buildHubDataJs({FESTIVALS:[{id:'f1',name:'F1',sound:'Funktion-One'}],VENUES:[{id:'v1',name:'V1',gallery:['images/venues/v1-2.webp']}],ARTISTS:[],EVENTS:[],ARTICLES:[]});
check(!/sound:|gallery:/.test(hub), 'data-hub.js に SOUND/GALLERY が残る');

const sent = [];
let latestRows = [{
  _row:2,
  id:'v1',
  name:'fresh name',
  image:'images/venues/v1.webp',
  imageposition:'10% 10%',
  imagePosition:'10% 10%',
  gallery:'images/venues/v1-2.webp',
  sound:'Void Acoustics'
}];
ctx.fetch = async (url, options) => {
  if (String(url).includes('action=get_sheet')) {
    return {json:async()=>({status:'ok',rows:latestRows})};
  }
  if (options?.body) sent.push(JSON.parse(options.body));
  return {json:async()=>({status:'ok'})};
};
await ctx.__T.bulkSaveRow('venue',{_row:2,id:'v1',name:'stale name',image:'images/venues/v1-new.webp'},
  {image:'images/venues/v1-new.webp',imagePosition:'50% 20%'});
const bulkPayload = sent[0] || {};
check(bulkPayload.name === 'fresh name', '一括保存が最新行を使っていない');
check(bulkPayload.gallery === 'images/venues/v1-2.webp' && bulkPayload.sound === 'Void Acoustics', '一括保存で新しい列を保持していない');
check(bulkPayload.image === 'images/venues/v1-new.webp', '一括保存の変更項目を重ねていない');
check(bulkPayload.imageposition === '50% 20%' && bulkPayload.imagePosition === '50% 20%', '一括保存が大文字小文字違いの同名キーを揃えていない');

sent.length = 0;
latestRows = [{_row:3,name:'Old',description:'before'}];
await ctx.__T.bulkSaveRow('event',{_row:3,name:'Old'}, {name:'New'});
const namePayload = sent[0] || {};
check(namePayload.name === 'New', 'IDなし行の名前置換を保存できない');

const findReplaceStart = cms.indexOf('async function findReplaceExecute');
const findReplaceEnd = cms.indexOf('\nfunction escRegExp', findReplaceStart);
const findReplaceBlock = cms.slice(findReplaceStart, findReplaceEnd);
check(/byRow\[key\]=\{section:r\.section,row:r\.row,workingRow:\{\.\.\.r\.row\},patch:\{\}\}/.test(findReplaceBlock), 'Find & Replace が元の行を保持していない');
check(/bulkSaveRow\(section,row,byRow\[k\]\.patch\)/.test(findReplaceBlock), 'Find & Replace が元の行を保存に渡していない');

sent.length = 0;
latestRows = [{_row:2,id:'v2',name:'another venue',image:'images/venues/v2.webp'}];
let movedError = '';
try {
  await ctx.__T.bulkSaveRow('venue',{_row:2,id:'v1',name:'stale name'}, {name:'changed name'});
} catch(error) {
  movedError = error.message;
}
check(movedError === '行の位置が変わっています。ページを再読み込みしてからやり直してください', '行ずれをエラーにしていない');
check(sent.length === 0, '行ずれ時にupdate_rowを送っている');

// Date型セルを get_sheet が返す JS Date.toString() 形式から、
// ARTICLES の日付列だけ YYYY-MM-DD に戻す。GAS へは送らず fetch を記録する。
sent.length = 0;
latestRows = [{
  _row: 4,
  id: 'article-1',
  title: 'Article',
  date: 'Sat Oct 10 2026 00:00:00 GMT+0900 (日本標準時)',
}];
await ctx.__T.bulkSaveRow('article', {_row:4, id:'article-1', title:'Article'}, {title:'Changed'});
const articlePayload = sent[0] || {};
check(articlePayload.date === '2026-10-10', 'ARTICLES の date を YYYY-MM-DD に正規化していない');

sent.length = 0;
latestRows = [{
  _row: 5,
  id: 'festival-1',
  name: 'Festival',
  date: '2026-09-26/2026-09-27',
}];
await ctx.__T.bulkSaveRow('festival', {_row:5, id:'festival-1', name:'Festival'}, {name:'Changed'});
const festivalPayload = sent[0] || {};
check(festivalPayload.date === '2026-09-26/2026-09-27', 'FESTIVALS の文字列 date を変更している');

sent.length = 0;
latestRows = [{
  _row: 6,
  id: 'article-2',
  title: 'Article 2',
  internalDate: 'Sat Oct 10 2026 00:00:00 GMT+0900 (日本標準時)',
}];
let unexpectedDateError = '';
try {
  await ctx.__T.bulkSaveRow('article', {_row:6, id:'article-2', title:'Article 2'}, {title:'Changed'});
} catch (error) {
  unexpectedDateError = error.message;
}
check(
  unexpectedDateError === '日付型の列 internalDate があるため一括保存を中止しました',
  '想定外の列の日付型セルをエラーにしていない',
);
check(sent.length === 0, '想定外の列の日付型セルで update_row を送っている');

if (failures.length) {
  console.error('❌ CMS SOUND/GALLERY 検査');
  failures.forEach(message => console.error(`  - ${message}`));
  process.exit(1);
}
console.log('✅ CMS SOUND/GALLERY・一括保存の日付保護: フォーム・列安全策・生成・保存を確認');
