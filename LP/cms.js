/* ==============================================================
   CONFIG
   ============================================================== */
/* ==============================================================
   AUTHENTICATION
   ============================================================== */
// 認証はサーバー発行のセッショントークン方式（GAS: Auth.gs）。
// パスワードの SHA-256 を GAS の login に送り、24時間有効なトークンを受け取る。
// 公開ファイルである cms.js には秘密（パスワードハッシュ）を一切置かない。
let AUTH_TOKEN = null; // ログイン後のセッショントークン。GAS へ cmsAuth として送る。

async function sha256(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// パスワード変更: コンソールで setupPassword('新パス') を実行し、表示されたハッシュを
// GAS の スクリプトプロパティ CMS_PASSWORD_HASH に設定する（cms.js の変更は不要）。
window.setupPassword = async (pw) => {
  const h = await sha256(pw);
  console.log('CMS_PASSWORD_HASH = ' + h);
  console.log('この値を GAS の スクリプトプロパティ CMS_PASSWORD_HASH に設定してください。');
  return h;
};

// パスワードハッシュを GAS の login に送り、成功なら {token, expires} を得る
async function requestToken_(pw){
  try {
    const hash = await sha256(pw);
    const res = await fetch(GAS_URL, { method:'POST', body: JSON.stringify({ action:'login', passHash: hash }) }).then(r=>r.json());
    return (res && res.status === 'ok' && res.token) ? res : null;
  } catch(e){ return null; }
}

async function checkAuth(){
  const token = localStorage.getItem('cms_token');
  const exp = +(localStorage.getItem('cms_token_exp') || 0);
  if(token && exp > Date.now()){ AUTH_TOKEN = token; return true; }  // 期限内トークンあり
  localStorage.removeItem('cms_token'); localStorage.removeItem('cms_token_exp');
  for(let i = 0; i < 3; i++){
    const pw = prompt(i===0 ? 'CMS Password:' : 'Wrong password. Try again:');
    if(pw === null) break;
    const r = await requestToken_(pw);
    if(r){
      localStorage.setItem('cms_token', r.token);
      localStorage.setItem('cms_token_exp', String(r.expires || 0));
      AUTH_TOKEN = r.token;
      return true;
    }
  }
  document.body.innerHTML = '<div style="padding:40px;color:#fff;font-family:monospace;background:#0a0a0a;height:100vh;display:flex;align-items:center;justify-content:center"><div><h1 style="margin:0 0 16px">🔒 Access denied</h1><p style="opacity:.6">Refresh the page to try again.</p></div></div>';
  document.body.style.background = '#0a0a0a';
  throw new Error('auth-failed');
}

window.cmsLogout = () => { localStorage.removeItem('cms_token'); localStorage.removeItem('cms_token_exp'); localStorage.removeItem('cms_auth'); location.reload(); };

// Wrap fetch to inject auth token automatically
const _origFetch = window.fetch;
window.fetch = function(url, options){
  if(typeof url === 'string' && url.indexOf('script.google.com') !== -1 && AUTH_TOKEN){
    options = options || {};
    if(options.method === 'POST' && options.body){
      try {
        const body = JSON.parse(options.body);
        body.cmsAuth = AUTH_TOKEN;
        options.body = JSON.stringify(body);
      } catch(e) {}
    } else {
      // GET request — append cmsAuth as query param (avoid reserved 'auth')
      url = url + (url.indexOf('?') !== -1 ? '&' : '?') + 'cmsAuth=' + encodeURIComponent(AUTH_TOKEN);
    }
  }
  return _origFetch.call(this, url, options);
};

const GAS_URL = 'https://script.google.com/macros/s/AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nfDjwglmdu8ClhpWZ-OXSbMM4UyFE_7ZsV-Lpg/exec';
const GMAPS_KEY = 'AIzaSyDBCrbSFx5rnKZIl3cEP8AO87QdeRDZr1Q';
const GENRES = ['TECHNO','HOUSE','MINIMAL','AMBIENT','BASS','LIVE','OTHERS'];
/* Artist DB — will be enriched from GAS on first load */
let ARTIST_DB = [
  {id:'dj-nobu',name:'DJ NOBU'},{id:'wata-igarashi',name:'WATA IGARASHI'},
  {id:'kotsu',name:'KOTSU'},{id:'mayurashka',name:'MAYURASHKA'},
  {id:'ken-ishii',name:'KEN ISHII'},{id:'cabanne',name:'CABANNE'},
  {id:'gonno',name:'GONNO'},{id:'yoshinori-hayashi',name:'YOSHINORI HAYASHI'},
  {id:'fumiya-tanaka',name:'FUMIYA TANAKA'},{id:'cyk',name:'CYK'},
  {id:'haruka',name:'HARUKA'},{id:'mama-snake',name:'MAMA SNAKE'},
  {id:'takaaki-itoh',name:'TAKAAKI ITOH'},{id:'dj-sodeyama',name:'DJ SODEYAMA'},
  {id:'keihin',name:'KEIHIN'},{id:'go-hiyama',name:'GO HIYAMA'},
  {id:'satoshi-tomiie',name:'SATOSHI TOMIIE'},{id:'sunju-hargun',name:'SUNJU HARGUN'},
  {id:'dj-masda',name:'DJ MASDA'},{id:'dj-shufflemaster',name:'DJ SHUFFLEMASTER'},
  {id:'so-inagawa',name:'SO INAGAWA'},{id:'akiram3n',name:'AKIRAM3N'},
  {id:'casual-treatment',name:'CASUAL TREATMENT'},{id:'olive-oil',name:'OLIVE OIL'},
  {id:'budamunk',name:'BUDAMUNK'},{id:'sauce81',name:'SAUCE81'},
  {id:'k-lone',name:'K-LONE'},{id:'marcel-dettmann',name:'MARCEL DETTMANN'},
  {id:'surgeon',name:'SURGEON'},{id:'donato-dozzy',name:'DONATO DOZZY'},
  {id:'objekt',name:'OBJEKT'},{id:'aurora-halal',name:'AURORA HALAL'},
  {id:'risa-taniguchi',name:'RISA TANIGUCHI'},{id:'cio',name:'CIO'},
  {id:'powder',name:'POWDER'},{id:'sapphire-slows',name:'SAPPHIRE SLOWS'},
  {id:'mars89',name:'MARS89'},
];
const ARTIST_LIST = ARTIST_DB.map(a => a.id);
let artistDbLoaded = false;
const GRADIENT_PRESETS = [
  {label:'Forest',  val:'linear-gradient(135deg, #0a1a0a 0%, #1a3a2a 40%, #0d2818 70%, #050f08 100%)'},
  {label:'Night',   val:'linear-gradient(135deg, #0a0a14 0%, #12102a 40%, #1a0e28 70%, #080810 100%)'},
  {label:'Amber',   val:'linear-gradient(135deg, #14100a 0%, #2a1e0e 40%, #1e1408 70%, #0a0806 100%)'},
  {label:'Crimson', val:'linear-gradient(135deg, #140a0a 0%, #2a0e0e 40%, #1e0808 70%, #0a0606 100%)'},
  {label:'Ocean',   val:'linear-gradient(135deg, #0a0a14 0%, #0e1a2a 40%, #08141e 70%, #06080a 100%)'},
  {label:'Ash',     val:'linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 40%, #121212 70%, #080808 100%)'},
];
const SHEET_MAP = { venue:'VENUES', festival:'FESTIVALS', artist:'ARTISTS', event:'EVENTS', article:'ARTICLES', author:'AUTHORS' };
const PREFIX_MAP = { venue:'v', festival:'f', artist:'a', event:'e', article:'ar' };

/* ==============================================================
   STATE
   ============================================================== */
const lineups = { f:[], e:[] };
const editions = [];
let acHighlight = -1;
const editState = { venue:null, festival:null, artist:null, event:null, article:null };
const listCache = { venue:[], festival:[], artist:[], event:[], article:[] };

/* ==============================================================
   INIT
   ============================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  initGenreChips('v-genre');
  initGenreChips('f-genre');
  initGradientPresets();
  injectPublishingSections();
  renderRecentItems();
  renderTrashCount();
  refreshImageSyncButton();
  initKeyboardShortcuts();
  loadAuthorsForDropdown();
  initArticleEditor();
  injectFormSectionLabels();
  markRequiredFields();
  // フォーム入力の dirty 追跡（保存忘れ防止）
  document.querySelectorAll('.form-grid input, .form-grid textarea, .form-grid select').forEach(el => {
    el.addEventListener('input', markFormDirty);
    el.addEventListener('change', markFormDirty);
  });
  // バックグラウンドで全セクションを先読み（キャッシュ未存在のものだけ）
  scheduleBackgroundPreload();
});

/* ==============================================================
   FORM UX — セクション見出し・必須マークの自動挿入
   フィールドIDを起点に .form-group の直前へ見出しを差し込む。
   HTMLを書き換えないので既存の保存ロジックに影響しない。
   ============================================================== */
function injectFormSectionLabels(){
  const SECTIONS = {
    'v-id':       '基本情報',
    'v-url':      'リンク・所在地',
    'v-imageUrl': '画像',
    'v-desc':     '説明',
    'f-id':       '基本情報',
    'f-url':      'リンク・所在地',
    'f-imageUrl': '画像・ビジュアル',
    'f-desc':     '説明・ラインナップ',
    'a-id':       '基本情報',
    'a-imageUrl': '画像',
    'a-instagram':'リンク',
    'a-bio':      'バイオ',
    'ar-id':      '基本情報',
    'ar-imageUrl':'ヒーロー画像',
    'ar-excerpt': '本文・要約',
  };
  Object.entries(SECTIONS).forEach(([fieldId, label]) => {
    const el = document.getElementById(fieldId);
    const group = el && el.closest('.form-group');
    if (!group) return;
    const h = document.createElement('div');
    h.className = 'form-section-label';
    h.textContent = label;
    group.parentNode.insertBefore(h, group);
  });
}

function markRequiredFields(){
  ['v-id','v-name','f-id','f-name','a-id','a-name','e-name','ar-id','ar-title'].forEach(id => {
    const el = document.getElementById(id);
    const label = el && el.closest('.form-group')?.querySelector('label');
    if (label && !label.querySelector('.req-star')) {
      const star = document.createElement('span');
      star.className = 'req-star';
      star.textContent = '*';
      label.appendChild(star);
    }
  });
}

function scheduleBackgroundPreload(){
  const sections = ['festival','venue','artist','event','article','author'];
  // requestIdleCallback または setTimeout でブラウザがアイドルな時に実行
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
  sections.forEach((s, i) => {
    idle(() => {
      // キャッシュにあればスキップ
      if(readSheetCache(s)){ listCache[s] = readSheetCache(s); return; }
      // 800ms ずつ間を空けて GAS 負荷を分散
      setTimeout(() => loadList(s, {silent:true}), i * 800);
    }, {timeout: 5000});
  });
}

function injectPublishingSections(){
  ['venue','festival','artist','event','article'].forEach(section => {
    const btnRow = document.getElementById(section+'-btn-new');
    if(btnRow){
      btnRow.insertAdjacentHTML('beforebegin', buildPublishingSection(section));
    }
  });
}

function loadAuthorsForDropdown(){
  fetch(GAS_URL+'?action=get_sheet&sheet=AUTHORS')
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok' && d.rows){
        const sel = document.getElementById('ar-authorId');
        if(sel){
          sel.innerHTML = '<option value="">— None —</option>' +
            d.rows.map(a => `<option value="${esc(a.id)}">${esc(a.name||a.id)}</option>`).join('');
        }
      }
    }).catch(()=>{});
}

/* ==============================================================
   NAVIGATION
   ============================================================== */
function switchSection(name, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + name).classList.add('active');
  document.querySelectorAll('.sidebar nav button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
function switchTab(section, tab, opts) {
  const parent = document.getElementById('sec-' + section);
  // NEWタブクリック時、編集モード中ならキャンセルしてフォームリセット
  // （editRow経由のプログラム遷移では opts.fromEdit=true でスキップ）
  if (tab === 'form' && !(opts && opts.fromEdit) && editState && editState[section]) {
    cancelEdit(section);
  }
  // 新規記事フォームを開いた時に下書きがあれば復元提案
  if (tab === 'form' && section === 'article' && !(opts && opts.fromEdit) && !(editState && editState.article)) {
    setTimeout(tryRecoverArticleDraft, 100);
    // DATE 未入力のまま公開すると記事詳細が開けないため、今日の日付をプリフィル
    const dEl = document.getElementById('ar-date');
    if (dEl && !dEl.value) dEl.value = new Date().toISOString().slice(0, 10);

  }
  parent.querySelectorAll('.tab-bar button').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'list' && i === 0) || (tab === 'form' && i === 1));
  });
  parent.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(section + '-tab-' + tab).classList.add('active');
}

/* ==============================================================
   GENRE CHIPS
   ============================================================== */
function initGenreChips(id) {
  const c = document.getElementById(id);
  GENRES.forEach(g => {
    const chip = document.createElement('div');
    chip.className = 'chip'; chip.textContent = g; chip.dataset.genre = g;
    chip.onclick = () => chip.classList.toggle('selected');
    c.appendChild(chip);
  });
}
function getSelectedGenres(id) { return [...document.querySelectorAll('#'+id+' .chip.selected')].map(c => c.dataset.genre); }
function setSelectedGenres(id, genres) {
  document.querySelectorAll('#'+id+' .chip').forEach(c => c.classList.toggle('selected', genres.includes(c.dataset.genre)));
}

/* ==============================================================
   GRADIENT PRESETS
   ============================================================== */
function initGradientPresets() {
  const c = document.getElementById('f-gradientPresets');
  GRADIENT_PRESETS.forEach(p => {
    const s = document.createElement('div');
    s.className = 'gradient-swatch'; s.style.background = p.val; s.title = p.label;
    s.onclick = () => {
      c.querySelectorAll('.gradient-swatch').forEach(x => x.classList.remove('selected'));
      s.classList.add('selected');
      document.getElementById('f-heroGradient').value = p.val;
      updateGradientPreview(p.val);
    };
    c.appendChild(s);
  });
}

function updateGradientPreview(val){
  const el=document.getElementById('gradient-preview');
  if(val&&val.includes('gradient')){el.style.display='block';el.style.background=val;}
  else{el.style.display='none';}
}

/* ==============================================================
   LIVE PREVIEW
   ============================================================== */
function openPreview(section){
  if(section==='festival') renderFestivalPreview();
  else if(section==='venue') renderVenuePreview();
  else if(section==='artist') renderArtistPreview();
  document.getElementById('preview-overlay').classList.add('show');
  document.body.style.overflow='hidden';
}

function renderVenuePreview(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const name=g('v-name')||'VENUE NAME';
  const city=g('v-city');
  const area=g('v-area');
  const type=g('v-type');
  const desc=g('v-desc');
  const url=g('v-url');
  const instagram=g('v-instagram');
  const address=g('v-address');
  const capacity=g('v-capacity');
  const imagePath=g('v-image');
  const imageUrl=g('v-imageUrl');
  const pvImg=document.querySelector('#preview-v-image img');
  const imgSrc=resolveImgSrc(imagePath,imageUrl,pvImg);
  const genres=Array.from(document.querySelectorAll('#v-genre .chip.selected')).map(c=>c.textContent.trim());
  const tagsHtml=genres.map(g=>`<span class="pv-tag">${esc(g)}</span>`).join('');
  const linksHtml=[
    url?`<a href="${esc(url)}" class="pv-link" target="_blank">OFFICIAL SITE →</a>`:'',
    instagram?`<a href="${esc(instagram)}" class="pv-link" target="_blank">INSTAGRAM →</a>`:''
  ].join('');
  document.getElementById('preview-content').innerHTML=`
    <div class="pv-hero">
      <div class="pv-hero-image" style="background:linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 100%)">${imgSrc?`<img src="${esc(imgSrc)}" onerror="this.style.display='none'">`:''}</div>
      <div class="pv-hero-info">
        <div class="pv-date">${esc([city,area].filter(Boolean).join(' · '))}</div>
        <div class="pv-name">${esc(name)}</div>
        <div class="pv-location">${esc(type||'')}${capacity?' · CAPACITY '+esc(capacity):''}</div>
        ${tagsHtml?'<div class="pv-tags">'+tagsHtml+'</div>':''}
        ${desc?'<div class="pv-desc">'+esc(desc)+'</div>':'<div class="pv-empty" style="margin-bottom:28px">No description</div>'}
        ${address?'<div class="pv-location" style="margin-bottom:16px">📍 '+esc(address)+'</div>':''}
        <div class="pv-links">${linksHtml}</div>
      </div>
    </div>
  `;
}

function renderArtistPreview(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const name=g('a-name')||'ARTIST NAME';
  const city=g('a-city');
  const country=g('a-country');
  const genre=g('a-genre');
  const bio=g('a-bio');
  const instagram=g('a-instagram');
  const soundcloud=g('a-soundcloud');
  const bandcamp=g('a-bandcamp');
  const website=g('a-website');
  const imagePath=g('a-image');
  const imageUrl=g('a-imageUrl');
  const pvImg=document.querySelector('#preview-a-image img');
  const imgSrc=resolveImgSrc(imagePath,imageUrl,pvImg);
  const linksHtml=[
    website?`<a href="${esc(website)}" class="pv-link" target="_blank">WEBSITE →</a>`:'',
    instagram?`<a href="${esc(instagram)}" class="pv-link" target="_blank">INSTAGRAM →</a>`:'',
    soundcloud?`<a href="${esc(soundcloud)}" class="pv-link" target="_blank">SOUNDCLOUD →</a>`:'',
    bandcamp?`<a href="${esc(bandcamp)}" class="pv-link" target="_blank">BANDCAMP →</a>`:''
  ].filter(Boolean).join('');
  document.getElementById('preview-content').innerHTML=`
    <div class="pv-hero">
      <div class="pv-hero-image" style="background:linear-gradient(135deg,#1a1a1a 0%,#2a2a2a 100%);aspect-ratio:1/1">${imgSrc?`<img src="${esc(imgSrc)}" onerror="this.style.display='none'">`:''}</div>
      <div class="pv-hero-info">
        <div class="pv-date">${esc([city,country].filter(Boolean).join(' · '))}</div>
        <div class="pv-name">${esc(name)}</div>
        ${genre?'<div class="pv-tags"><span class="pv-tag">'+esc(genre)+'</span></div>':''}
        ${bio?'<div class="pv-desc">'+esc(bio)+'</div>':'<div class="pv-empty" style="margin-bottom:28px">No bio</div>'}
        <div class="pv-links">${linksHtml}</div>
      </div>
    </div>
  `;
}
function closePreview(){
  document.getElementById('preview-overlay').classList.remove('show');
  document.body.style.overflow='';
}
function formatPreviewDate(d){
  if(!d)return '';
  const parts=d.split('/');
  const fmt=s=>{const p=s.split('-');if(p.length===3)return p[1]+'.'+p[2];return s;};
  if(parts.length===2)return fmt(parts[0])+' — '+fmt(parts[1])+' . '+parts[0].split('-')[0];
  return fmt(parts[0])+' . '+(parts[0].split('-')[0]||'');
}
function renderFestivalPreview(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  const name=g('f-name')||'FESTIVAL NAME';
  const location=g('f-location');
  const locationJa=g('f-location_ja');
  const city=g('f-city');
  const ds=g('f-dateStart'),de=g('f-dateEnd');
  const dateStr=ds&&de?ds+'/'+de:ds;
  const url=g('f-url');
  const ticketUrl=g('f-ticketUrl');
  const desc=g('f-desc');
  const heroGrad=g('f-heroGradient')||'linear-gradient(135deg,#0a0a0a 0%,#1a1a2a 40%,#0d0d18 70%,#050508 100%)';
  const imagePath=g('f-image');
  const flyerPath=g('f-flyer');
  const imageUrl=g('f-imageUrl');
  const flyerUrl=g('f-flyerUrl');
  // Try multiple image sources: uploaded preview > Drive URL > URL input > local path
  const pvImg=document.querySelector('#preview-f-image img');
  const pvFlyer=document.querySelector('#preview-f-flyer img');
  const imgSrc=resolveImgSrc(imagePath,imageUrl,pvImg);
  const flyerSrc=resolveImgSrc(flyerPath,flyerUrl,pvFlyer);

  // Genre
  const genreEls=document.querySelectorAll('#f-genre .chip.selected');
  const genres=Array.from(genreEls).map(c=>c.textContent.trim());

  // Lineup
  const lineupTags=document.querySelectorAll('#f-lineupTags .lineup-tag');
  const lineup=Array.from(lineupTags).map(t=>t.textContent.replace('×','').trim());

  // Editions
  const editionsHtml=editions.map(ed=>{
    const edLineup=(ed.lineup||[]).map(a=>`<span class="pv-edition-artist">${esc(a)}</span>`).join('');
    return `<div class="pv-edition-row">
      <div class="pv-edition-year">${esc(ed.year)}</div>
      <div class="pv-edition-date">${esc(ed.date)}</div>
      <div class="pv-edition-lineup">${edLineup||'<span class="pv-empty">No lineup</span>'}</div>
    </div>`;
  }).join('');

  const imgHtml=imgSrc?`<img src="${esc(imgSrc)}" onerror="this.style.display='none'">`:'';
  const flyerHtml=flyerSrc?`<img src="${esc(flyerSrc)}" onerror="this.style.display='none'">`:
    '<div class="pv-flyer-placeholder">FLYER IMAGE</div>';
  const urlHtml=url?`<a href="${esc(url)}" class="pv-link" target="_blank">OFFICIAL SITE →</a>`:'';
  const ticketHtml=ticketUrl?`<a href="${esc(ticketUrl)}" class="pv-link" target="_blank">TICKETS →</a>`:'';
  const tagsHtml=genres.map(g=>`<span class="pv-tag">${esc(g)}</span>`).join('');
  const lineupHtml=lineup.map(a=>`<span class="pv-lineup-item">${esc(a)}</span>`).join('');
  const locStr=[locationJa||location,city].filter(Boolean).join(' — ');

  document.getElementById('preview-content').innerHTML=`
    <div class="pv-hero">
      <div class="pv-hero-image" style="background:${heroGrad}">${imgHtml}</div>
      <div class="pv-hero-info">
        <div class="pv-date">${esc(formatPreviewDate(dateStr))}</div>
        <div class="pv-name">${esc(name)}</div>
        <div class="pv-location">${esc(locStr)}</div>
        ${tagsHtml?'<div class="pv-tags">'+tagsHtml+'</div>':''}
        ${desc?'<div class="pv-desc">'+esc(desc)+'</div>':'<div class="pv-empty" style="margin-bottom:28px">No description yet</div>'}
        <div class="pv-links">${urlHtml}${ticketHtml}</div>
      </div>
    </div>
    <div class="pv-flyer-lineup">
      <div>
        <div class="pv-section-label">FLYER</div>
        <div class="pv-flyer-image">${flyerHtml}</div>
      </div>
      ${lineupHtml?'<div><div class="pv-section-label">LINEUP</div><div class="pv-lineup-grid">'+lineupHtml+'</div></div>':''}
    </div>
    ${editionsHtml?'<div class="pv-section"><div class="pv-section-label">PAST EDITIONS</div><div>'+editionsHtml+'</div></div>':''}
  `;
}

/* ==============================================================
   AUTO-FILL
   ============================================================== */
function autoFillVenueImage() {
  const id = document.getElementById('v-id').value.trim();
  document.getElementById('v-image').value = id ? 'images/venues/'+id+'.jpg' : '';
}
function autoFillFestivalImage() {
  const id = document.getElementById('f-id').value.trim();
  document.getElementById('f-image').value = id ? 'images/festivals/'+id+'.jpg' : '';
  document.getElementById('f-flyer').value = id ? 'images/festivals/'+id+'-flyer.jpg' : '';
}
function autoFillArtistImage() {
  const id = document.getElementById('a-id').value.trim();
  document.getElementById('a-image').value = id ? 'images/artists/'+id+'.jpg' : '';
}

/* ==============================================================
   ARTICLE — SLUGIFY (Title → ID)
   ============================================================== */
function slugify(s){
  return (s || '').toString().toLowerCase().trim()
    // CJKは英数slugにできないので削除（残った英数で生成）
    .replace(/[　-〿぀-ゟ゠-ヿ一-鿿＀-￯]/g,' ')
    .replace(/[^a-z0-9\s-]/g,' ')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,60);
}
// 日本語のみタイトルなど slug が空になる場合の安全なフォールバック
function fallbackSlug(){
  const d = new Date();
  const ymd = d.getFullYear().toString()
    + String(d.getMonth()+1).padStart(2,'0')
    + String(d.getDate()).padStart(2,'0');
  return 'post-' + ymd;
}
function onArticleTitleInput(){
  const idEl = document.getElementById('ar-id');
  if (!idEl) return;
  // ユーザーが手動でID編集していたら自動上書きしない
  if (idEl.dataset.userEdited === '1') return;
  // 編集モード中（既存ID）も触らない
  if (editState.article && editState.article._row) return;
  const slug = slugify(document.getElementById('ar-title').value) || fallbackSlug();
  idEl.value = slug;
  markFormDirty();
}
// ID欄: 手入力を許容しつつ、離れた時に必ず URL 安全な形へ正規化する。
// これで Transcendence / "My Article" のような値も transcendence / my-article になる。
document.addEventListener('DOMContentLoaded', () => {
  const idEl = document.getElementById('ar-id');
  if (!idEl) return;
  idEl.addEventListener('input', () => { idEl.dataset.userEdited = '1'; });
  idEl.addEventListener('blur', () => {
    const raw = idEl.value.trim();
    if (!raw) return;
    const clean = slugify(raw) || fallbackSlug();
    if (clean !== raw) idEl.value = clean;
  });
});

/* ==============================================================
   ARTICLE — 読了時間自動計算
   ============================================================== */
function calcReadTime(html){
  if (!html) return 0;
  const text = String(html).replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ');
  const cjk = (text.match(/[一-鿿぀-ゟ゠-ヿ]/g) || []).length;
  const ascii = (text.replace(/[一-鿿぀-ゟ゠-ヿ]/g,'').match(/\b\w+\b/g) || []).length;
  // 日本語: 600字/分、英語: 220語/分（少しゆっくり）
  return Math.max(1, Math.round(cjk/600 + ascii/220));
}
function maybeAutoFillReadTime(){
  const el = document.getElementById('ar-readTime');
  if (!el) return;
  // 文字カウント常時表示
  const html = document.getElementById('ar-body').value || '';
  const text = html.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
  const charCount = text.length;
  const min = calcReadTime(html);
  const wc = document.getElementById('ar-word-count');
  if (wc) wc.innerHTML = `— <strong>${charCount}</strong> chars · <strong>${min}</strong> min read`;
  // ユーザーが手で値を入れていたら readTime 自動上書きしない
  if (el.dataset.userEdited === '1') return;
  if (min > 0) el.value = min;
}
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('ar-readTime');
  if (el) el.addEventListener('input', () => { el.dataset.userEdited = '1'; });
});

/* ==============================================================
   FORM DIRTY TRACKING (未保存変更で離脱警告)
   ============================================================== */
let formDirty = false;
function markFormDirty(){ formDirty = true; }
function clearFormDirty(){ formDirty = false; }
window.addEventListener('beforeunload', (e) => {
  if (formDirty) { e.preventDefault(); e.returnValue = ''; }
});

/* ==============================================================
   ARTICLE — オートセーブ (localStorage)
   ============================================================== */
const ARTICLE_DRAFT_KEY = 'tj-cms-article-draft-v1';
let articleDraftTimer = null;
function scheduleArticleDraftSave(){
  clearTimeout(articleDraftTimer);
  articleDraftTimer = setTimeout(saveArticleDraft, 1500);
}
function saveArticleDraft(){
  try {
    const title = (document.getElementById('ar-title')?.value || '').trim();
    const body  = (document.getElementById('ar-body')?.value || '').trim();
    if (!title && !body) { localStorage.removeItem(ARTICLE_DRAFT_KEY); return; }
    const draft = {
      id: g('ar-id'), title: g('ar-title'), category: g('ar-category'),
      date: g('ar-date'), author: g('ar-author'), image: g('ar-image'),
      cardRatio: g('ar-cardRatio'), heroRatio: g('ar-heroRatio'), festivalId: g('ar-festivalId'),
      readTime: g('ar-readTime'), views: g('ar-views'),
      featured: document.getElementById('ar-featured')?.value || 'false',
      status: g('ar-status'), excerpt: g('ar-excerpt'),
      body: g('ar-body'), tags: g('ar-tags'),
      editingRow: editState.article ? editState.article._row : null,
      savedAt: Date.now()
    };
    localStorage.setItem(ARTICLE_DRAFT_KEY, JSON.stringify(draft));
  } catch(e){}
}
function clearArticleDraft(){ localStorage.removeItem(ARTICLE_DRAFT_KEY); }
function loadArticleDraft(){
  try { const raw = localStorage.getItem(ARTICLE_DRAFT_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function tryRecoverArticleDraft(){
  const draft = loadArticleDraft();
  if (!draft) return;
  const minsAgo = Math.max(1, Math.round((Date.now() - (draft.savedAt||Date.now())) / 60000));
  const label = draft.title || draft.id || '無題';
  if (confirm(`未保存の下書きが見つかりました：\n「${label}」(${minsAgo}分前)\n\n復元しますか？`)) {
    setVal('ar-id', draft.id); setVal('ar-title', draft.title);
    setVal('ar-category', draft.category||'REPORT'); setVal('ar-date', fmtDate(draft.date));
    setVal('ar-cardRatio', draft.cardRatio||''); setVal('ar-heroRatio', draft.heroRatio||'');
    festPickerSetValue(draft.festivalId||'');
    setVal('ar-author', draft.author||'TECHNO JAPAN'); setVal('ar-image', draft.image);
    setVal('ar-readTime', draft.readTime); setVal('ar-views', draft.views);
    setVal('ar-featured', draft.featured); setVal('ar-status', draft.status||'published');
    setVal('ar-excerpt', draft.excerpt);
    setArticleBody(draft.body || '');
    setVal('ar-tags', draft.tags);
    if (draft.id) document.getElementById('ar-id').dataset.userEdited = '1';
    if (draft.readTime) document.getElementById('ar-readTime').dataset.userEdited = '1';
    toast('下書きを復元しました', 'success');
    markFormDirty();
  } else {
    clearArticleDraft();
  }
}

/* ==============================================================
   ARTICLE BODY — RICH TEXT EDITOR (Quill)
   ============================================================== */
let articleQuill = null;

// 画像挿入: URL貼付 か ファイルアップロード を選んでもらう
function articleImageHandler(){
  const choice = prompt(
    '画像挿入方法を選んでください:\n\n' +
    '  1: URLを貼り付け\n' +
    '  2: ファイルをアップロード（Google Driveに保存）\n\n' +
    '番号を入力してEnter:',
    '1'
  );
  if (choice === '1') {
    const url = prompt('画像URLを入力（https://...）:');
    if (url && /^https?:\/\//.test(url)) insertImageAtCursor(url);
    else if (url) toast('有効なURLを入力してください', 'error');
  } else if (choice === '2') {
    triggerArticleImageUpload();
  }
}

function insertImageAtCursor(url){
  if (!articleQuill) return;
  const range = articleQuill.getSelection(true) || { index: articleQuill.getLength() };
  articleQuill.insertEmbed(range.index, 'image', url, 'user');
  articleQuill.setSelection(range.index + 1);
}

window.articleImageUploading = false;
function triggerArticleImageUpload(){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    if (file) uploadArticleImageFile(file);
  };
  input.click();
}

function initArticleEditor(){
  if (articleQuill) return articleQuill;
  if (typeof Quill === 'undefined') {
    console.warn('Quill not loaded');
    return null;
  }
  // サイトの3書体だけを許可（デフォルトは DM Sans）。無制限のフォント選択は
  // デザインの一貫性を壊すので、ホワイトリスト方式にしている。
  const TjFont = Quill.import('formats/font');
  TjFont.whitelist = ['bebas', 'mono'];
  Quill.register(TjFont, true);

  // ソフト改行(<br>)を Shift+Enter で入れられるようにする。通常の Enter は段落(<p>)のまま。
  // Quill 1.x の Break blot は既定では insertEmbed で挿入できないため、挿入可能な
  // SmartBreak に差し替える（コミュニティ定番のレシピ）。二重登録を避けるためガード。
  if (!Quill.__tjSmartBreak) {
    const Embed = Quill.import('blots/embed');
    const QBreak = Quill.import('blots/break');
    class SmartBreak extends QBreak {
      length(){ return 1; }
      value(){ return '\n'; }
      insertInto(parent, ref){ Embed.prototype.insertInto.call(this, parent, ref); }
    }
    SmartBreak.blotName = 'break';
    SmartBreak.tagName = 'BR';
    Quill.register(SmartBreak, true);
    Quill.__tjSmartBreak = true;
  }

  articleQuill = new Quill('#ar-body-editor', {
    theme: 'snow',
    placeholder: '本文を書く…（📄テンプレで雛形挿入 / 画像はドラッグ&ドロップやペーストでOK / ⌘S 保存・⌘⇧F 集中モード）',
    modules: {
      toolbar: {
        container: [
          [{ 'header': [2, 3, false] }],
          [{ 'font': ['', 'bebas', 'mono'] }],
          [{ 'size': ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline'],
          ['blockquote'],
          [{ 'align': ['', 'center', 'right'] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          ['link', 'image'],
          ['clean']
        ],
        handlers: {
          image: articleImageHandler
        }
      }
    }
  });
  // Shift+Enter = ソフト改行(<br>)。既定の Enter(段落)より先に評価させるため unshift。
  const enterBindings = articleQuill.keyboard.bindings[13] || (articleQuill.keyboard.bindings[13] = []);
  enterBindings.unshift({
    key: 13, shiftKey: true,
    handler: function(range){
      const q = articleQuill;
      q.insertEmbed(range.index, 'break', true, Quill.sources.USER);
      q.setSelection(range.index + 1, Quill.sources.SILENT);
      return false;
    }
  });
  // 既存記事の <br> を読み込む(dangerouslyPasteHTML)際、既定のクリップボードは
  // <br> を段落分割(\n)に変換してしまう。break 埋め込みとして取り込み、ソフト改行を保つ。
  const QDelta = Quill.import('delta');
  articleQuill.clipboard.addMatcher('BR', () => new QDelta().insert({ break: '' }));

  // Visual で編集 → 同期処理は debounce（毎キーストロークでの
  // innerHTML シリアライズ + プレビュー再描画が入力ラグの原因だった）
  articleQuill.on('text-change', (delta, oldDelta, source) => {
    markFormDirty();                 // 軽いフラグだけ即時
    scheduleArticleEditorSync('quill');
    // 「@」または「＠」を打つと、その場でIDリンク挿入メニューを開く（ツールバーまで
    // スクロールで戻らなくてもリンクを挿せる）
    if (source === 'user'){
      const sel = articleQuill.getSelection();
      if (sel && sel.length === 0 && sel.index > 0){
        const prev = articleQuill.getText(sel.index - 1, 1);
        if (prev === '@' || prev === '＠') toggleEntityLinkMenu(sel.index - 1);
      }
    }
  });
  // HTML source で編集 → 同様に debounce
  document.getElementById('ar-body-source').addEventListener('input', () => {
    markFormDirty();
    scheduleArticleEditorSync('source');
  });
  // ドラッグ&ドロップ + ペースト
  setupArticleEditorDropPaste();
  return articleQuill;
}

/* エディタ同期の debounce（300ms）。
   シリアライズ・プレビュー・文字数計算・下書き保存を1回にまとめる */
let articleSyncTimer = null;
function scheduleArticleEditorSync(from){
  clearTimeout(articleSyncTimer);
  articleSyncTimer = setTimeout(() => runArticleEditorSync(from), 300);
}
function runArticleEditorSync(from){
  let html;
  if (from === 'source') {
    html = document.getElementById('ar-body-source').value;
  } else {
    if (!articleQuill) return;
    html = normalizeArticleHtml(articleQuill.root.innerHTML);
    document.getElementById('ar-body-source').value = html;
  }
  document.getElementById('ar-body').value = html;
  updateArticlePreview(html);
  maybeAutoFillReadTime();
  scheduleArticleDraftSave();
}
// 保存直前に未反映の同期を確定させる
function flushArticleEditorSync(){
  if (articleSyncTimer) {
    clearTimeout(articleSyncTimer);
    articleSyncTimer = null;
    const wrap = document.getElementById('ar-editor-wrap');
    runArticleEditorSync(wrap && wrap.classList.contains('source-mode') ? 'source' : 'quill');
  }
}

function setupArticleEditorDropPaste(){
  const editor = document.querySelector('#ar-body-editor .ql-editor');
  if (!editor) return;
  // クリップボードペースト（スクショ等）
  editor.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        e.preventDefault();
        const f = items[i].getAsFile();
        if (f) uploadArticleImageFile(f);
        return;
      }
    }
  });
  // ドラッグ&ドロップ
  editor.addEventListener('dragover', (e) => {
    if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
      e.preventDefault();
      editor.classList.add('drag-hover');
    }
  });
  editor.addEventListener('dragleave', () => editor.classList.remove('drag-hover'));
  editor.addEventListener('drop', (e) => {
    editor.classList.remove('drag-hover');
    if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const f = e.dataTransfer.files[i];
      if (f.type && f.type.indexOf('image/') === 0) {
        uploadArticleImageFile(f);
      }
    }
  });
}

// 画像アップロード共通処理（ボタン/D&D/ペーストから呼ばれる）
function uploadArticleImageFile(file){
  const id = (document.getElementById('ar-id')?.value || '').trim();
  if (!id) { toast('先に記事のIDを入力してください', 'error'); return; }
  const origMB = (file.size/1024/1024).toFixed(1);
  window.articleImageUploading = true;
  window.articleImageUploadStartedAt = Date.now();
  toast('Compressing... ('+origMB+'MB)', 'info');
  compressImage(file).then(({ dataUrl, blob, width, height, mimeType, ext }) => {
    const compMB = (blob.size/1024/1024).toFixed(2);
    const fmtLabel = mimeType === 'image/webp' ? 'WebP' : 'JPEG';
    toast('Uploading... '+compMB+'MB ('+fmtLabel+')', 'info');
    const filename = id + '-' + Date.now() + '.' + ext;
    const body = {
      action: 'upload_image', type: 'article-body',
      id: id, filename: filename, imageData: dataUrl, mimeType: mimeType
    };
    return fetch(GAS_URL, { method: 'POST', body: JSON.stringify(body) })
      .then(r => r.json())
      .then(d => {
        if (d.status === 'ok' || d.success) {
          toast('挿入しました ('+width+'×'+height+'). 忘れずに「Save Changes」を', 'success');
          const url = d.driveUrl || d.imagePath || ('images/articles/' + filename);
          insertImageAtCursor(url);
        } else {
          toast(d.message || 'Upload failed', 'error');
        }
      });
  }).catch(e => {
    console.error('Image upload error:', e);
    toast('Image error: ' + e.message, 'error');
  }).finally(() => { window.articleImageUploading = false; });
}

let _lastPreviewHtml = null;
function updateArticlePreview(html, force){
  const el = document.getElementById('ar-preview-content');
  if (!el) return;
  // プレビューが閉じている間は再描画しない（開いた時に反映）
  const wrap = document.getElementById('ar-editor-wrap');
  if (!force && wrap && !wrap.classList.contains('preview-mode')) return;
  const trimmed = (html || '').trim();
  if (trimmed === _lastPreviewHtml) return;  // 変更なしなら DOM を触らない
  _lastPreviewHtml = trimmed;
  if (!trimmed || trimmed === '<p><br></p>') {
    el.innerHTML = '<div class="ar-prev-empty">本文を書くとここにプレビューが表示されます</div>';
  } else {
    el.innerHTML = resolveEntityLinksPreview(trimmed);
  }
}

function toggleArticlePreview(){
  const wrap = document.getElementById('ar-editor-wrap');
  const btn = document.getElementById('ar-preview-toggle');
  if (!wrap) return;
  const on = wrap.classList.toggle('preview-mode');
  if (btn) { btn.classList.toggle('active', on); btn.textContent = on ? '✕ プレビューを閉じる' : 'プレビュー'; }
  if (on) {
    // 開いた瞬間に最新HTMLで更新し、画面外で気付かれないようスクロールして見せる
    flushArticleEditorSync();
    updateArticlePreview(document.getElementById('ar-body').value, true);
    const prev = document.querySelector('.ar-preview');
    if (prev) requestAnimationFrame(() => prev.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }
}

/* ---------- 記事テンプレート ---------- */
const ARTICLE_TEMPLATES = {
  report: { label: '📍 イベントレポート', category: 'REPORT', html:
    '<p>[導入 — いつ・どこで・何が行われたか。現場の第一印象を2〜3文で]</p><p><br></p>' +
    '<h2>会場とサウンド</h2><p>[会場の様子、サウンドシステム、空間演出について]</p><p><br></p>' +
    '<h2>ハイライト</h2><p>[印象に残ったDJ/ライブセット。時間帯ごとの流れ]</p><p><br></p>' +
    '<h2>クラウドとカルチャー</h2><p>[客層、雰囲気、コミュニティとしての空気感]</p><p><br></p>' +
    '<h2>総括</h2><p>[このイベントがシーンにとって持つ意味。次回への期待]</p>' },
  interview: { label: '🎤 インタビュー', category: 'INTERVIEW', html:
    '<p>[アーティスト紹介 — 経歴・活動・今回話を聞く理由を2〜3文で]</p><p><br></p>' +
    '<h3>—— まず、最近の活動について聞かせてください。</h3><p>[回答]</p><p><br></p>' +
    '<h3>—— [質問2]</h3><p>[回答]</p><p><br></p>' +
    '<h3>—— [質問3]</h3><p>[回答]</p><p><br></p>' +
    '<h3>—— 最後に、今後の予定を教えてください。</h3><p>[回答]</p><p><br></p>' +
    '<p><em>[締め — ライブ情報やリリース情報へのリンク]</em></p>' },
  news: { label: '⚡ ニュース', category: 'NEWS', html:
    '<p>[リード文 — 何が・いつ・どこで。1〜2文で核心を]</p><p><br></p>' +
    '<p>[詳細 — 背景、ラインナップ、注目ポイント]</p><p><br></p>' +
    '<h3>開催情報</h3><ul><li>日程: [日付]</li><li>会場: [会場名]</li><li>チケット: [価格/リンク]</li></ul>' },
  weekly: { label: '📅 週間まとめ', category: 'EVENTS', html:
    '<p>[今週の見どころを2〜3文で]</p><p><br></p>' +
    '<h2>[曜日] — [イベント名]</h2><p>[会場・出演者・ひとこと]</p><p><br></p>' +
    '<h2>[曜日] — [イベント名]</h2><p>[会場・出演者・ひとこと]</p><p><br></p>' +
    '<h2>[曜日] — [イベント名]</h2><p>[会場・出演者・ひとこと]</p>' },
  column: { label: '💭 コラム', category: 'COLUMN', html:
    '<p>[問題提起・きっかけ — なぜ今これを書くのか]</p><p><br></p>' +
    '<h2>[論点1]</h2><p>[本文]</p><p><br></p>' +
    '<h2>[論点2]</h2><p>[本文]</p><p><br></p>' +
    '<h2>これからのこと</h2><p>[結論・読者への問いかけ]</p>' },
};

function toggleTemplateMenu(){
  let menu = document.getElementById('ar-template-menu');
  if (menu){ menu.remove(); return; }
  const btn = document.getElementById('ar-template-toggle');
  if (!btn) return;
  menu = document.createElement('div');
  menu.id = 'ar-template-menu';
  menu.className = 'ar-template-menu';
  menu.innerHTML = Object.entries(ARTICLE_TEMPLATES).map(([key, t]) =>
    '<button type="button" onclick="applyArticleTemplate(\'' + key + '\')">' + t.label + '</button>'
  ).join('');
  btn.parentElement.style.position = 'relative';
  btn.insertAdjacentElement('afterend', menu);
  const close = (e) => { if (!menu.contains(e.target) && e.target !== btn){ menu.remove(); document.removeEventListener('click', close, true); } };
  setTimeout(() => document.addEventListener('click', close, true), 0);
}

function applyArticleTemplate(key){
  const t = ARTICLE_TEMPLATES[key];
  if (!t) return;
  const current = (document.getElementById('ar-body')?.value || '').replace(/<p><br><\/p>/g, '').trim();
  if (current && !confirm('本文にすでに内容があります。テンプレートで置き換えますか？')) return;
  setArticleBody(t.html);
  const cat = document.getElementById('ar-category');
  if (cat) cat.value = t.category;
  document.getElementById('ar-template-menu')?.remove();
  toast(t.label + ' の雛形を挿入しました', 'success');
}

/* シートデータをキャッシュから返す。無ければ get_sheet で取得してキャッシュ。
   （各セクションのタブを開いていなくても関連フェス選択や本文リンクができるように） */
function ensureSheetCache(section){
  const cached = readSheetCache(section);
  if (cached) return Promise.resolve(cached);
  return fetch(GAS_URL+'?action=get_sheet&sheet='+SHEET_MAP[section])
    .then(r=>r.json()).then(d=>{
      if (d.status==='ok' && d.rows){ writeSheetCache(section, d.rows); return d.rows; }
      return null;
    }).catch(()=>null);
}

/* ---------- 関連フェスの検索ピッカー ---------- */
function festPickerFilter(){
  const input = document.getElementById('ar-festivalId-search');
  const list  = document.getElementById('ar-festivalId-list');
  if (!input || !list) return;
  let rows = (readSheetCache('festival') || []).filter(r => r.id);
  if (rows.length === 0){
    // 未読込なら自動取得して読み込み後に再描画（手動 Refresh 不要）
    list.innerHTML = '<div class="fp-empty">フェス一覧を読み込み中…</div>';
    list.hidden = false;
    ensureSheetCache('festival').then(()=>{
      const l = document.getElementById('ar-festivalId-list');
      if (l && !l.hidden) festPickerFilter();
    });
    return;
  }
  const q = input.value.toLowerCase().trim();
  const hits = rows.filter(r => !q || String(r.name||'').toLowerCase().includes(q) || String(r.id).includes(q))
                   .slice(0, 40);
  list.innerHTML = rows.length === 0
    ? '<div class="fp-empty">フェス一覧が未読込です。FESTIVAL セクションで一度 Refresh してください。</div>'
    : (hits.length
        ? hits.map(r => '<button type="button" data-id="'+esc(r.id)+'" data-name="'+esc(r.name||r.id)+'">'+esc(r.name||r.id)+'<span class="fp-id">'+esc(r.id)+'</span></button>').join('')
        : '<div class="fp-empty">該当なし</div>');
  list.hidden = false;
}
function festPickerSelect(id, name){
  document.getElementById('ar-festivalId').value = id;
  const sel = document.getElementById('ar-festivalId-selected');
  sel.innerHTML = '◆ ' + esc(name || id) + ' <span style="opacity:.45;font-family:var(--font-mono);font-size:.75em">' + esc(id) + '</span>'
                + '<button type="button" class="fp-clear" onclick="festPickerClear()" title="解除">×</button>';
  sel.hidden = false;
  document.getElementById('ar-festivalId-search').value = '';
  document.getElementById('ar-festivalId-list').hidden = true;
  markFormDirty();
}
function festPickerClear(){
  document.getElementById('ar-festivalId').value = '';
  document.getElementById('ar-festivalId-selected').hidden = true;
  markFormDirty();
}
/* 編集を開いた時などに、保存済みIDから選択表示を復元する */
function festPickerSetValue(id){
  if (!id){ festPickerClear(); return; }
  const cached = readSheetCache('festival');
  const r = (cached || []).find(x => x.id === id);
  festPickerSelect(id, r && r.name);
  if (!cached){
    // 名前がキャッシュに無ければ取得して選択表示を更新
    ensureSheetCache('festival').then(rows=>{
      const rr = (rows||[]).find(x => x.id === id);
      if (rr && rr.name && document.getElementById('ar-festivalId').value === id) festPickerSelect(id, rr.name);
    });
  }
}
document.addEventListener('click', e => {
  const wrap = document.getElementById('ar-festivalId-picker');
  const list = document.getElementById('ar-festivalId-list');
  if (!wrap || !list) return;
  if (wrap.contains(e.target)){
    const b = e.target.closest('#ar-festivalId-list button[data-id]');
    if (b) festPickerSelect(b.dataset.id, b.dataset.name);
  } else {
    list.hidden = true;
  }
});

/* ---------- 記事内の ID リンク挿入 ----------
   本文にショートコード [[festival:rural]] / [[artist:dj-nobu]] / [[venue:womb]] を
   挿入する。表示時に各詳細ページへのリンクに変換される（news.html と
   build-detail-pages.mjs 側で解決）。 */
function toggleEntityLinkMenu(caretIndex){
  const atCaret = typeof caretIndex === 'number';   // @/＠ トリガーならキャレット位置に出す
  let menu = document.getElementById('ar-entity-menu');
  if (menu){ menu.remove(); if (!atCaret) return; }  // ボタンはトグル、@は開き直し
  const btn = document.getElementById('ar-entity-toggle');
  if (!btn && !atCaret) return;

  // 候補リスト: フェス/ヴェニューはシートキャッシュ、アーティストは ARTIST_DB
  const opts = [];
  (readSheetCache('festival') || []).forEach(r => r.id && opts.push({type:'festival', id:r.id, name:r.name||r.id}));
  (ARTIST_DB || []).forEach(a => a.id && opts.push({type:'artist', id:a.id, name:a.name||a.id}));
  (readSheetCache('venue') || []).forEach(r => r.id && opts.push({type:'venue', id:r.id, name:r.name||r.id}));

  menu = document.createElement('div');
  menu.id = 'ar-entity-menu';
  menu.className = 'ar-template-menu';
  menu.style.minWidth = '300px';
  menu.innerHTML =
    '<div style="padding:10px 14px 6px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.1em;color:var(--text3)">本文にリンクを挿入（名前で検索）</div>' +
    '<input id="ar-entity-search" type="text" placeholder="例: rural / DJ NOBU / womb" style="margin:0 10px 8px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:.85rem">' +
    '<div id="ar-entity-results" style="max-height:260px;overflow-y:auto"></div>';
  if (atCaret){
    // キャレットのビューポート座標に固定配置（スクロール位置に依存しない）
    const selc = window.getSelection();
    let r = selc && selc.rangeCount ? selc.getRangeAt(0).getBoundingClientRect() : null;
    if (!r || (!r.width && !r.height && !r.top)){
      const q = initArticleEditor(); const b = q.getBounds(caretIndex); const cr = q.container.getBoundingClientRect();
      r = { left: cr.left + b.left, bottom: cr.top + b.top + b.height };
    }
    menu.style.position = 'fixed';
    menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 340)) + 'px';
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.zIndex = '1000';
    document.body.appendChild(menu);
  } else {
    btn.parentElement.style.position = 'relative';
    btn.insertAdjacentElement('afterend', menu);
  }

  const results = menu.querySelector('#ar-entity-results');
  const icon = {festival:'◆', artist:'△', venue:'○'};
  function render(q){
    q = (q||'').toLowerCase().trim();
    const hits = opts.filter(o => !q || o.name.toLowerCase().includes(q) || o.id.includes(q)).slice(0, 30);
    results.innerHTML = hits.length
      ? hits.map(o => '<button type="button" data-type="'+o.type+'" data-id="'+o.id+'" data-name="'+esc(o.name)+'">'+icon[o.type]+' '+esc(o.name)+' <span style="opacity:.4;font-size:.7em">'+o.type+'</span></button>').join('')
      : '<div style="padding:10px 14px;color:var(--text3);font-size:.8rem">'+(opts.length ? '該当なし' : 'データ未読込 — 各セクションで一度 Refresh してください')+'</div>';
  }
  render('');
  const searchEl = menu.querySelector('#ar-entity-search');
  searchEl.addEventListener('input', e => render(e.target.value));

  // フェス/ヴェニューがキャッシュに無ければ取得して候補に追加（各タブを開いていなくても
  // リンクできるように）。アーティストは ARTIST_DB を都度ロードする。
  ['festival','venue'].forEach(sec => {
    if (readSheetCache(sec)) return;
    fetch(GAS_URL+'?action=get_sheet&sheet='+SHEET_MAP[sec])
      .then(r=>r.json()).then(d=>{
        if (d.status==='ok' && d.rows){
          writeSheetCache(sec, d.rows);
          d.rows.forEach(r => r.id && opts.push({type:sec, id:r.id, name:r.name||r.id}));
          if (document.getElementById('ar-entity-menu')) render(searchEl.value);
        }
      }).catch(()=>{});
  });
  if (!(ARTIST_DB && ARTIST_DB.length) && typeof loadArtistDB === 'function'){
    loadArtistDB().then(() => {
      (ARTIST_DB||[]).forEach(a => a.id && !opts.some(o=>o.type==='artist'&&o.id===a.id) && opts.push({type:'artist', id:a.id, name:a.name||a.id}));
      if (document.getElementById('ar-entity-menu')) render(searchEl.value);
    });
  }
  results.addEventListener('click', e => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    if (atCaret){
      // トリガーの @/＠ を消してからリンクを挿入
      const q = initArticleEditor();
      q.deleteText(caretIndex, 1, 'user');
      q.setSelection(caretIndex, 0, 'silent');
    }
    insertEntityShortcode(b.dataset.type, b.dataset.id, b.dataset.name);
    menu.remove();
    document.removeEventListener('keydown', onEsc, true);
  });
  setTimeout(() => menu.querySelector('#ar-entity-search').focus(), 0);
  const close = (e) => { if (!menu.contains(e.target) && e.target !== btn){ menu.remove(); document.removeEventListener('click', close, true); document.removeEventListener('keydown', onEsc, true); } };
  const onEsc = (e) => { if (e.key === 'Escape'){ menu.remove(); document.removeEventListener('click', close, true); document.removeEventListener('keydown', onEsc, true); if (atCaret) initArticleEditor().focus(); } };
  setTimeout(() => { document.addEventListener('click', close, true); document.addEventListener('keydown', onEsc, true); }, 0);
}

/* 本文には実際の <a> を挿し込む。エディタ上でも「Rural」のように
   名前で読めるので、[[festival:rural]] という生の記号より分かりやすい。
   （旧記事のショートコードも表示側で解決し続けるので互換は保たれる） */
function insertEntityShortcode(type, id, name){
  const dir = type === 'article' ? 'articles' : type + 's';
  const href = '/' + dir + '/' + id + '.html';
  const label = name || id;
  const q = initArticleEditor();
  if (q){
    const range = q.getSelection(true) || { index: q.getLength() };
    // 選択中のテキストがあればそれをリンク化、なければ名前を挿入してリンク化
    if (range.length > 0){
      q.formatText(range.index, range.length, 'link', href, 'user');
      q.setSelection(range.index + range.length);
    } else {
      q.insertText(range.index, label, 'user');
      q.formatText(range.index, label.length, 'link', href, 'user');
      // 直後のスペースはリンクに含めない（含めると下線が伸びて不格好）
      q.insertText(range.index + label.length, ' ', { link: false }, 'user');
      q.setSelection(range.index + label.length + 1);
    }
    scheduleArticleEditorSync('quill');
  }
  toast(label + ' へのリンクを挿入しました', 'success');
}

/* プレビュー用: ショートコードをリンク表示に変換 */
function resolveEntityLinksPreview(html){
  return String(html || '').replace(/\[\[(festival|artist|venue|article):([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (m, type, id, label) => {
    let name = label;
    if (!name){
      if (type === 'artist'){ const a = (ARTIST_DB||[]).find(x => x.id === id); name = a && a.name; }
      else { const r = (readSheetCache(type) || []).find(x => x.id === id); name = r && (r.name || r.title); }
    }
    const dir = type === 'article' ? 'articles' : type + 's';
    return '<a class="entity-link" href="/' + dir + '/' + id + '.html">' + esc(name || id) + '</a>';
  });
}

/* ---------- 集中執筆モード（フルスクリーン） ---------- */
function toggleFocusMode(){
  const wrap = document.getElementById('ar-editor-wrap');
  if (!wrap) return;
  const on = wrap.classList.toggle('focus-mode');
  document.body.classList.toggle('ar-focus-open', on);
  const btn = document.getElementById('ar-focus-toggle');
  if (btn){ btn.textContent = on ? '✕ 閉じる (Esc)' : '⛶ 集中モード'; btn.classList.toggle('active', on); }
  if (on){ const ed = document.querySelector('#ar-body-editor .ql-editor'); if (ed) ed.focus(); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape'){
    const w = document.getElementById('ar-editor-wrap');
    if (w && w.classList.contains('focus-mode')){
      toggleFocusMode();
      // 後段の「編集キャンセル確認」まで発火させない
      e.stopImmediatePropagation();
    }
  }
  // Cmd+Shift+F: 集中モード切替（記事セクション表示中のみ）
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f'){
    if (document.querySelector('.section.active')?.id === 'sec-article'){
      e.preventDefault();
      toggleFocusMode();
    }
  }
});

/* Quill は全リンクに target=_blank rel=... を付けるが、サイト内リンクを
   別タブで開くのは不自然なので保存前に外す。 */
function normalizeArticleHtml(html){
  if (!html) return html;
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll('a[href^="/"]').forEach(a => { a.removeAttribute('target'); a.removeAttribute('rel'); });
  return d.innerHTML;
}

function setArticleBody(html){
  const v = html || '';
  document.getElementById('ar-body').value = v;
  const src = document.getElementById('ar-body-source');
  if (src) src.value = v;
  const q = initArticleEditor();
  if (q) {
    // Quill v1.x の正しい HTML 読み込み API（直接 innerHTML 代入は不可）
    // setText で内部 Delta をリセット → dangerouslyPasteHTML で HTML 全体をペースト
    q.setText('');
    if (v) {
      try {
        q.clipboard.dangerouslyPasteHTML(0, v, 'silent');
      } catch (e) {
        console.warn('Quill paste failed, fallback to convert:', e);
        const delta = q.clipboard.convert(v);
        q.setContents(delta, 'silent');
      }
    }
    // ar-body を Quill が解釈した正規化後 HTML で再同期
    document.getElementById('ar-body').value = q.root.innerHTML;
  }
  updateArticlePreview(v);
}

function switchArticleEditor(mode){
  const wrap = document.getElementById('ar-editor-wrap');
  if (!wrap) return;
  const visualTab = wrap.querySelector('[data-mode="visual"]');
  const sourceTab = wrap.querySelector('[data-mode="source"]');
  if (mode === 'source') {
    // Visual → Source: push current Quill HTML to textarea
    if (articleQuill) document.getElementById('ar-body-source').value = articleQuill.root.innerHTML;
    wrap.classList.add('source-mode');
    sourceTab.classList.add('active');
    visualTab.classList.remove('active');
  } else {
    // Source → Visual: push textarea HTML to Quill (proper API)
    const src = document.getElementById('ar-body-source').value;
    if (articleQuill) {
      articleQuill.setText('');
      if (src) {
        try { articleQuill.clipboard.dangerouslyPasteHTML(0, src, 'silent'); }
        catch(e){ articleQuill.setContents(articleQuill.clipboard.convert(src), 'silent'); }
      }
    }
    document.getElementById('ar-body').value = src;
    wrap.classList.remove('source-mode');
    visualTab.classList.add('active');
    sourceTab.classList.remove('active');
  }
}

/* ==============================================================
   IMAGE POSITION CONTROL (generic — artist / venue / festival)
   ============================================================== */
const FORM_BY_PREFIX = {a:'artist', v:'venue', f:'festival'};
function setImagePos(prefix, val){
  document.getElementById(prefix+'-imagePosition').value = val;
  syncImagePos(prefix);
}
function syncImagePos(prefix){
  const val = (document.getElementById(prefix+'-imagePosition').value || 'center').trim();
  const formId = '#form-' + (FORM_BY_PREFIX[prefix] || prefix);
  const btns = document.querySelectorAll(formId+' .img-pos-btn');
  btns.forEach(b => b.classList.toggle('active', b.dataset.pos === val));
  const prev = document.getElementById(prefix+'-imagePosPreview');
  // 配信は webp のみ。生値のままだと 404 で位置調整のプレビューが空になる。
  const img = webp((document.getElementById(prefix+'-image')?.value || '').trim());
  if (img && prev) {
    prev.style.display = 'block';
    prev.style.backgroundImage = `url('${img}')`;
    prev.style.backgroundPosition = val;
  } else if (prev) {
    prev.style.display = 'none';
  }
}
// Aliases for backward compatibility
function setArtistImagePos(val){ setImagePos('a', val); }
function syncArtistImagePos(){ syncImagePos('a'); }

/* ==============================================================
   GEOCODING
   ============================================================== */
function geocode(prefix) {
  const addr = document.getElementById(prefix+'-address').value.trim();
  if (!addr) return toast('Address is empty','error');
  toast('Geocoding...','info');
  // OpenStreetMap Nominatim（APIキー不要・無料）。1秒1リクエストのポリシーに注意。
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(addr))
    .then(r=>r.json()).then(d=>{
      if (Array.isArray(d) && d[0] && d[0].lat && d[0].lon) {
        document.getElementById(prefix+'-lat').value=parseFloat(d[0].lat).toFixed(4);
        document.getElementById(prefix+'-lng').value=parseFloat(d[0].lon).toFixed(4);
        updateLocationMap(prefix);
        toast('Coordinates set','success');
      } else toast('Geocoding failed: 該当なし','error');
    }).catch(()=>toast('Geocoding error','error'));
}

/* LOCATION（施設名）から住所 + 緯度経度をまとめて取得する。
   施設名だけだと曖昧なので City を添えて精度を上げ、日本語の住所で返す。
   ADDRESS は上書きせず「空のときだけ」自動入力し、既存の手入力を尊重する。 */
function geocodeFromLocation(prefix) {
  const primaryLoc = (document.getElementById(prefix+'-location')?.value || '').trim();
  const jaLoc = prefix === 'f'
    ? (document.getElementById('f-location_ja')?.value || '').trim()
    : '';
  // 日本の施設は日本語名の方が地図サービスで照合しやすい。
  // location_ja が未入力の既存行は、従来どおり LOCATION を使う。
  const loc = jaLoc || primaryLoc;
  if (!loc) return toast('Location / Location (JA)（施設名）を入力してください','error');
  const city = (document.getElementById(prefix+'-city')?.value || '').trim();
  // 施設名 + 市 + 国。まず絞り込みで検索し、ダメなら施設名単体で再試行する。
  const queries = [ [loc, city, 'Japan'].filter(Boolean).join(', '), loc + ', Japan' ];
  const addrEl = document.getElementById(prefix+'-address');
  const latEl = document.getElementById(prefix+'-lat');
  const lngEl = document.getElementById(prefix+'-lng');
  toast('📍 施設名から検索中...','info');

  const nominatim = (q) =>
    fetch('https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&accept-language=ja&q='+encodeURIComponent(q))
      .then(r=>r.json()).catch(()=>null);
  const applyHit = (hit) => {
    latEl.value = parseFloat(hit.lat).toFixed(4);
    lngEl.value = parseFloat(hit.lon).toFixed(4);
    if (!addrEl.value.trim() && hit.display_name) addrEl.value = hit.display_name;
    updateLocationMap(prefix);
  };

  (async () => {
    // 1) まず Nominatim を直接。有名施設（英/日）はこれで当たる。
    // ポリシー(1req/秒)を守るため、2回目以降のクエリは間隔を空ける。
    let first = true;
    const politeNominatim = async (q) => {
      if (!first) await new Promise(r => setTimeout(r, 1100));
      first = false;
      return nominatim(q);
    };
    for (const q of queries) {
      const d = await politeNominatim(q);
      if (Array.isArray(d) && d[0] && d[0].lat && d[0].lon) {
        applyHit(d[0]);
        toast('住所と座標を取得しました — 内容を確認してください','success');
        return;
      }
    }

    // 2) 見つからなければ Claude に日本語の正式名称＋住所を推定させ、それで再検索。
    //    （英語表記の施設名は OSM に載っていないことが多いため）
    toast('🤖 AIで施設名を照合中...','info');
    let resolved;
    try {
      resolved = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'resolve_place', location: loc, city: city })
      }).then(r=>r.json());
    } catch (_) {}

    if (resolved && resolved.status === 'ok') {
      const tryQueries = [resolved.name_ja, resolved.address].filter(Boolean);
      for (const q of tryQueries) {
        const d = await politeNominatim(q);
        if (Array.isArray(d) && d[0] && d[0].lat && d[0].lon) {
          applyHit(d[0]);
          // AI が返した住所の方が読みやすければ、それで上書き（空のときだけ）
          if (!addrEl.value.trim() && resolved.address) addrEl.value = resolved.address;
          toast('AIで照合して座標を取得しました — 内容を確認してください','success');
          return;
        }
      }
      // Nominatim では最終的に当たらなかったが、AI住所は入れておく（座標は手動 Geocode 可）
      if (!addrEl.value.trim() && resolved.address) {
        addrEl.value = resolved.address;
        toast('住所を推定しました。ADDRESS横の Geocode で座標を取得してください','info');
        return;
      }
    }
    toast('施設名から見つかりませんでした。ADDRESSに住所を入れて Geocode を試してください','error');
  })();
}

/* ==============================================================
   LINEUP AUTOCOMPLETE
   ============================================================== */
function filterArtists(inputId, listId, prefix) {
  const val = document.getElementById(inputId).value.toLowerCase();
  const list = document.getElementById(listId);
  acHighlight = -1;
  if (!val) { list.classList.remove('show'); return; }
  const matches = ARTIST_DB.filter(a => (a.id.toLowerCase().includes(val) || a.name.toLowerCase().includes(val)) && !lineups[prefix].includes(a.id));
  if (!matches.length) { list.classList.remove('show'); return; }
  list.innerHTML = matches.map(a => '<div class="autocomplete-item" onmousedown="addLineup(\''+prefix+'\',\''+a.id+'\')"><strong>'+esc(a.id)+'</strong> <span style="opacity:.5;font-size:.8em">'+esc(a.name)+'</span></div>').join('');
  list.classList.add('show');
}
function acKeydown(e, listId, prefix) {
  const list=document.getElementById(listId), items=list.querySelectorAll('.autocomplete-item');
  if (!items.length) return;
  if (e.key==='ArrowDown'){e.preventDefault();acHighlight=Math.min(acHighlight+1,items.length-1)}
  else if(e.key==='ArrowUp'){e.preventDefault();acHighlight=Math.max(acHighlight-1,0)}
  else if(e.key==='Enter'&&acHighlight>=0){e.preventDefault();items[acHighlight].onmousedown();return}
  else return;
  items.forEach((it,i)=>it.classList.toggle('highlight',i===acHighlight));
}
function addLineup(prefix,id){
  if(lineups[prefix].includes(id))return;
  lineups[prefix].push(id);renderLineupTags(prefix);
  document.getElementById(prefix+'-lineupInput').value='';
  document.getElementById(prefix+'-autocomplete').classList.remove('show');
}
function removeLineup(prefix,id){lineups[prefix]=lineups[prefix].filter(a=>a!==id);renderLineupTags(prefix)}
function renderLineupTags(prefix){
  document.getElementById(prefix+'-lineupTags').innerHTML=lineups[prefix].map(a=>{
    const isUnmatched=a.startsWith('?');
    const display=isUnmatched?a.substring(1):a;
    const cls='lineup-tag'+(isUnmatched?' unmatched':'');
    const escaped=a.replace(/'/g,"\\'");
    return '<div class="'+cls+'">'+esc(display)+'<span class="remove" onclick="removeLineup(\''+prefix+'\',\''+escaped+'\')">&times;</span></div>';
  }).join('');
}

/* ==============================================================
   EDITIONS
   ============================================================== */
function addEdition(){editions.push({year:'',date:'',lineup:[]});renderEditions()}
function removeEdition(i){editions.splice(i,1);renderEditions()}
function renderEditions(){
  document.getElementById('f-editions').innerHTML=editions.map((ed,i)=>`
    <div class="edition-block">
      <button class="remove-edition" onclick="removeEdition(${i})">&times;</button>
      <div class="edition-fields">
        <input type="number" placeholder="Year" value="${ed.year}" onchange="editions[${i}].year=this.value">
        <input type="text" placeholder="Date range" value="${ed.date}" onchange="editions[${i}].date=this.value">
      </div>
      <div style="margin-top:8px">
        <input type="text" placeholder="Lineup (comma-separated)" value="${ed.lineup.join(', ')}"
          onchange="editions[${i}].lineup=this.value.split(',').map(s=>s.trim()).filter(Boolean)"
          style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px;font-size:.85rem;color:var(--text)">
      </div>
    </div>`).join('');
}

/* ==============================================================
   LINEUP — ARTIST DB FROM GAS
   ============================================================== */
function loadArtistDB(){
  if(artistDbLoaded) return Promise.resolve();
  return fetch(GAS_URL+'?action=get_sheet&sheet=ARTISTS')
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok'&&d.rows&&d.rows.length){
        ARTIST_DB=d.rows.map(r=>({id:r.id||'',name:r.name||''})).filter(a=>a.id);
        ARTIST_LIST.length=0; ARTIST_DB.forEach(a=>ARTIST_LIST.push(a.id));
        artistDbLoaded=true;
      }
    }).catch(()=>{/* fallback to hardcoded */});
}

/* ==============================================================
   LINEUP — MATCH ARTIST NAME → ID
   ============================================================== */
function matchArtist(name){
  const n=String(name||'').trim();
  if(!n) return null;
  const lower=n.toLowerCase();
  const aName=a=>String(a.name||'').toLowerCase();
  const aId=a=>String(a.id||'').toLowerCase();
  // exact name match (case-insensitive)
  const byName=ARTIST_DB.find(a=>aName(a)===lower);
  if(byName) return byName.id;
  // exact id match
  const byId=ARTIST_DB.find(a=>aId(a)===lower);
  if(byId) return byId.id;
  // slug-style match: "DJ Nobu" → "dj-nobu"
  const slug=lower.replace(/[\s_]+/g,'-').replace(/[^a-z0-9-]/g,'');
  const bySlug=ARTIST_DB.find(a=>aId(a)===slug);
  if(bySlug) return bySlug.id;
  // partial: name contains or is contained (but only for artist names >= 3 chars to avoid false positives)
  const byPartial=ARTIST_DB.find(a=>{const nm=aName(a);return nm.length>=3&&(nm.includes(lower)||lower.includes(nm))});
  if(byPartial) return byPartial.id;
  return null;
}

/* ==============================================================
   LINEUP — AI FETCH
   ============================================================== */
function fetchLineup(){
  const name=g('f-name'), url=g('f-url');
  if(!name) return toast('Enter festival name first','error');
  const btn=document.getElementById('btn-fetch-lineup');
  btn.disabled=true; btn.innerHTML='Fetching<span class="spinner"></span>';
  const statusEl=document.getElementById('lineup-fetch-status');
  statusEl.style.display='none';

  loadArtistDB().then(()=>{
    return fetch(GAS_URL+'?action=get_lineup&name='+encodeURIComponent(name)+'&url='+encodeURIComponent(url));
  })
    .then(r=>r.json())
    .then(d=>{
      btn.disabled=false; btn.textContent='Fetch Lineup (AI)';
      if(d.status==='ok'&&d.artists&&d.artists.length){
        let matched=0, unmatched=0;
        d.artists.forEach(name=>{
          const id=matchArtist(name);
          if(id){
            if(!lineups.f.includes(id)){lineups.f.push(id);matched++}
          }else{
            const tag='?'+name.trim();
            if(!lineups.f.includes(tag)){lineups.f.push(tag);unmatched++}
          }
        });
        renderLineupTags('f');
        statusEl.style.display='block';
        statusEl.style.background='rgba(45,255,110,.1)';statusEl.style.borderLeft='3px solid var(--green)';statusEl.style.color='var(--green)';
        statusEl.textContent=d.artists.length+' artists fetched — '+matched+' matched, '+unmatched+' unregistered';
        toast('Lineup fetched','success');
      }else{
        statusEl.style.display='block';
        statusEl.style.background='rgba(255,45,45,.1)';statusEl.style.borderLeft='3px solid var(--accent)';statusEl.style.color='var(--accent)';
        statusEl.textContent='No artists found'+(d.message?' — '+d.message:'');
        toast('No lineup found','error');
      }
    })
    .catch(err=>{
      btn.disabled=false; btn.textContent='Fetch Lineup (AI)';
      toast('Fetch error: '+err.message,'error');
    });
}

/* ==============================================================
   LINEUP — BULK TEXT INPUT
   ============================================================== */
function toggleBulkLineup(){
  const w=document.getElementById('bulk-lineup-wrap');
  w.style.display=w.style.display==='none'?'block':'none';
}

function processBulkLineup(){
  const text=document.getElementById('bulk-lineup-text').value;
  if(!text.trim()) return toast('Enter artist names','error');
  const names=text.split(/[,\n]+/).map(s=>s.trim()).filter(Boolean);
  toast('Processing '+names.length+' artists...','info');
  loadArtistDB().then(()=>{
    let matched=0, unmatched=0;
    names.forEach(name=>{
      try{
        const id=matchArtist(name);
        if(id){
          if(!lineups.f.includes(id)){lineups.f.push(id);matched++}
        }else{
          const tag='?'+name.trim();
          if(!lineups.f.includes(tag)){lineups.f.push(tag);unmatched++}
        }
      }catch(e){
        console.error('matchArtist error for "'+name+'":',e);
        const tag='?'+name.trim();
        if(!lineups.f.includes(tag)){lineups.f.push(tag);unmatched++}
      }
    });
    renderLineupTags('f');
    const statusEl=document.getElementById('lineup-fetch-status');
    if(statusEl){
      statusEl.style.display='block';
      statusEl.style.background='rgba(45,143,255,.1)';statusEl.style.borderLeft='3px solid var(--blue)';statusEl.style.color='var(--blue)';
      statusEl.textContent=names.length+' processed — '+matched+' matched, '+unmatched+' unregistered';
    }
    document.getElementById('bulk-lineup-text').value='';
    toast('Added '+(matched+unmatched)+' artists','success');
  }).catch(err=>{
    console.error('processBulkLineup error:',err);
    toast('Error: '+(err.message||err),'error');
  });
}

/* ==============================================================
   IMAGE UPLOAD
   ============================================================== */
/* ==============================================================
   PUBLISHING SECTION (Status, OG, Meta, Tags, Notes)
   各フォームに動的に挿入
   ============================================================== */
const PUB_PREFIXES = {venue:'v', festival:'f', artist:'a', event:'e', article:'ar'};
function buildPublishingSection(section){
  const p = PUB_PREFIXES[section];
  const isArticle = section === 'article';
  const nameField = section === 'article' ? 'title' : 'name';
  const descField = section === 'artist' ? 'bio' : section === 'article' ? 'excerpt' : 'desc';
  const descLabel = section === 'artist' ? 'Bio' : section === 'article' ? 'Excerpt' : 'Description';
  // 記事は本文フォーム内の「🌐 英語版」セクション（title_en/excerpt_en/body_en）に一本化
  const enSection = isArticle ? '' : `
      <div class="pub-section">
        <h3>🌐 ENGLISH VERSION <span class="label-hint">(/en/ ページ用。空欄なら日本語にフォールバック。<strong>✨翻訳は下書きです。必ず目視で確認してから公開してください</strong>)</span></h3>
        <div class="form-group">
          <label>${nameField === 'title' ? 'Title' : 'Name'} (EN)</label>
          <input type="text" id="${p}-${nameField}En" placeholder="English ${nameField}..." style="width:100%">
          <button class="btn btn-green btn-sm" style="margin-top:4px" onclick="autoTranslateField('${p}-${nameField}','${p}-${nameField}En','jp-to-en')">✨ 日本語から翻訳</button>
        </div>
        <div class="form-group">
          <label>${descLabel} (EN)</label>
          <textarea id="${p}-${descField}En" rows="8" placeholder="English ${descLabel.toLowerCase()}..." style="width:100%"></textarea>
          <button class="btn btn-green btn-sm" style="margin-top:4px" onclick="autoTranslateField('${p}-${descField}','${p}-${descField}En','jp-to-en')">✨ 日本語から翻訳</button>
        </div>
      </div>`;
  return `
    <div class="form-group full">${enSection}
      <div class="pub-section">
        <h3>📤 PUBLISHING & SEO</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="form-group">
            <label>Status</label>
            <select id="${p}-status" style="width:100%">
              <option value="draft">📝 Draft</option>
              <option value="review">👀 In Review</option>
              <option value="published" selected>✅ Published</option>
              <option value="scheduled">⏰ Scheduled</option>
            </select>
          </div>
          ${isArticle ? `<div class="form-group"><label>Author</label><select id="${p}-authorId" style="width:100%"><option value="">— None —</option></select></div>` : `<div class="form-group"><label>Featured</label><select id="${p}-featuredFlag" style="width:100%"><option value="false">No</option><option value="true">⭐ Yes</option></select></div>`}
        </div>
        ${isArticle ? `<div class="form-group"><label>Publish At (予約公開)</label><input type="datetime-local" id="${p}-publishAt" style="width:100%"></div>` : ''}
        <div class="form-group">
          <label>OG Image URL <span class="label-hint">(SNSシェア用画像)</span></label>
          <input type="url" id="${p}-ogImage" placeholder="https://... (空ならメイン画像を使用)" style="width:100%">
        </div>
        <div class="form-group">
          <label>Meta Description <span class="label-hint">(SEO用 / 160文字以内推奨)</span></label>
          <textarea id="${p}-metaDescription" rows="2" placeholder="検索結果に表示される説明文..." style="width:100%" oninput="updateCharCount('${p}-metaDescription',160)"></textarea>
          <div class="char-count" id="${p}-metaDescription-count">0 / 160</div>
          ${isArticle ? `<button class="btn btn-green btn-sm" style="margin-top:6px" onclick="aiSummarize('meta')">✨ AI Meta 生成</button>` : `<button class="btn btn-green btn-sm" style="margin-top:6px" onclick="aiMetaGenerate('${p}','${section}')">✨ ${descLabel}から生成</button>`}
        </div>
        <div class="form-group">
          <label>Tags <span class="label-hint">(Enter または , で追加)</span>
            <button class="btn btn-sm" style="margin-left:8px;padding:2px 8px;font-size:.6rem" onclick="suggestTags('${p}','${section}')">＋ ジャンル/都市から候補追加</button>
          </label>
          <div class="tag-input-wrap" id="${p}-tags-wrap" onclick="document.getElementById('${p}-tags-input').focus()">
            <input type="text" id="${p}-tags-input" placeholder="Add tag..." onkeydown="handleTagKey(event,'${p}')">
          </div>
          <input type="hidden" id="${p}-tags" value="">
        </div>
        <div class="form-group">
          <label>Editor Notes <span class="label-hint">(チーム内メモ・公開されません)</span></label>
          <textarea id="${p}-editorNotes" rows="2" placeholder="例: 画像差し替え予定 / 〇〇さんに確認" style="width:100%"></textarea>
        </div>
        <div id="${p}-edit-history" style="font-size:.65rem;color:var(--text3);font-family:var(--font-mono);margin-top:8px"></div>
      </div>
    </div>`;
}

function updateCharCount(id, max){
  const v = document.getElementById(id)?.value || '';
  const el = document.getElementById(id+'-count');
  if(!el) return;
  el.textContent = v.length + ' / ' + max;
  el.classList.toggle('over', v.length > max);
}

/* TAG INPUT */
const tagState = {};
function handleTagKey(e, prefix){
  if(e.key === 'Enter' || e.key === ','){
    e.preventDefault();
    const input = e.target;
    const val = input.value.trim().replace(/,/g,'');
    if(val){
      addTag(prefix, val);
      input.value = '';
    }
  } else if(e.key === 'Backspace' && !e.target.value){
    const tags = (tagState[prefix] || []);
    if(tags.length){
      tags.pop();
      renderTags(prefix);
    }
  }
}
function addTag(prefix, tag){
  if(!tagState[prefix]) tagState[prefix] = [];
  if(!tagState[prefix].includes(tag)) tagState[prefix].push(tag);
  renderTags(prefix);
}
function removeTag(prefix, tag){
  if(!tagState[prefix]) return;
  tagState[prefix] = tagState[prefix].filter(t => t !== tag);
  renderTags(prefix);
}
function renderTags(prefix){
  const wrap = document.getElementById(prefix+'-tags-wrap');
  const hidden = document.getElementById(prefix+'-tags');
  if(!wrap) return;
  const tags = tagState[prefix] || [];
  hidden.value = tags.join(',');
  wrap.innerHTML = tags.map(t => `<span class="tag-chip">${esc(t)} <span class="x" onclick="removeTag('${prefix}','${esc(t).replace(/'/g,"\\'")}')">×</span></span>`).join('') +
    `<input type="text" id="${prefix}-tags-input" placeholder="${tags.length?'':'Add tag...'}" onkeydown="handleTagKey(event,'${prefix}')">`;
}
function setTagsValue(prefix, value){
  tagState[prefix] = String(value||'').split(',').map(s=>s.trim()).filter(Boolean);
  renderTags(prefix);
}

/* ==============================================================
   PUBLISHING FIELDS — payload helpers
   ============================================================== */
function getPubFields(section){
  const p = PUB_PREFIXES[section];
  if(!p) return {};
  const fields = {
    status: g(p+'-status') || 'draft',
    ogImage: g(p+'-ogImage'),
    metaDescription: g(p+'-metaDescription'),
    tags: g(p+'-tags'),
    editorNotes: g(p+'-editorNotes'),
    lastEditedAt: new Date().toISOString(),
    lastEditedBy: 'editor'  // future: multi-user支援時に拡張
  };
  if(section === 'article'){
    fields.publishAt = g(p+'-publishAt');
    fields.authorId = g(p+'-authorId');
  }
  // Multi-language（記事は本文フォーム内の ar-title_en / ar-excerpt_en を使うためスキップ）
  if(section !== 'article'){
    const descField = section === 'artist' ? 'bio' : 'desc';
    fields[descField+'_en'] = g(p+'-'+descField+'En');
    fields['name_en'] = g(p+'-nameEn');
  }
  return fields;
}
function setPubFields(section, row){
  const p = PUB_PREFIXES[section];
  if(!p) return;
  setVal(p+'-status', row.status || 'published');
  setVal(p+'-ogImage', row.ogImage || '');
  setVal(p+'-metaDescription', row.metaDescription || '');
  setVal(p+'-editorNotes', row.editorNotes || '');
  setTagsValue(p, row.tags || '');
  // Multi-language fields（記事は本文フォーム内の ar-title_en / ar-excerpt_en を使うためスキップ）
  if(section !== 'article'){
    const descField = section === 'artist' ? 'bio' : 'desc';
    setVal(p+'-'+descField+'En', row[descField+'_en'] || '');
    setVal(p+'-nameEn', row.name_en || '');
  }
  if(section === 'article'){
    setVal(p+'-publishAt', row.publishAt || '');
    setVal(p+'-authorId', row.authorId || '');
  }
  updateCharCount(p+'-metaDescription', 160);
  // 編集履歴表示
  const hist = document.getElementById(p+'-edit-history');
  if(hist){
    if(row.lastEditedAt){
      const d = new Date(row.lastEditedAt);
      hist.textContent = '⏱ Last edited: ' + d.toLocaleString('ja-JP') + (row.lastEditedBy ? ' by '+row.lastEditedBy : '');
    } else hist.textContent = '';
  }
}
function clearPubFields(section){
  const p = PUB_PREFIXES[section];
  if(!p) return;
  // 新規フォームの初期値は draft（DATA_SCHEMA §1.4）。
  // 登録しただけでは公開せず、内容を確認してから明示的に published へ変える運用。
  // 編集時は setPubFields() が既存の値を読むので、既存行の STATUS は変わらない。
  setVal(p+'-status', 'draft');
  setVal(p+'-ogImage', '');
  setVal(p+'-metaDescription', '');
  setVal(p+'-editorNotes', '');
  tagState[p] = [];
  renderTags(p);
  if(section === 'article'){
    setVal(p+'-publishAt', '');
    setVal(p+'-authorId', '');
  }
  // English Version 欄もクリア（記事はインライン ar-*_en が resetForm でクリアされる）
  if(section !== 'article'){
    const descField = section === 'artist' ? 'bio' : 'desc';
    setVal(p+'-'+descField+'En', '');
    setVal(p+'-nameEn', '');
  }
  const hist = document.getElementById(p+'-edit-history');
  if(hist) hist.textContent = '';
}

/* ==============================================================
   COMPLETENESS SCORE
   ============================================================== */
const REQUIRED_FIELDS = {
  venue: ['name','city','image','desc','genre'],
  festival: ['name','city','date','image','desc','genre'],
  artist: ['name','city','image','bio','genre'],
  event: ['name','date','venue'],
  article: ['title','date','image','excerpt']
};
const OPTIONAL_FIELDS = {
  venue: ['url','instagram','address','lat','capacity','metaDescription','tags'],
  festival: ['url','ticketUrl','instagram','address','lat','flyer','heroGradient','metaDescription','tags','lineup'],
  artist: ['country','instagram','soundcloud','website','metaDescription','tags'],
  event: ['city','time','desc','lineup','link'],
  article: ['category','readTime','featured','metaDescription','tags','ogImage']
};
function computeCompleteness(section, row){
  const required = REQUIRED_FIELDS[section] || [];
  const optional = OPTIONAL_FIELDS[section] || [];
  const all = [...required, ...optional];
  let filled = 0;
  let requiredMissing = [];
  all.forEach(f => {
    const v = row[f];
    const has = v !== undefined && v !== null && String(v).trim() !== '';
    if(has) filled++;
    else if(required.includes(f)) requiredMissing.push(f);
  });
  const score = all.length ? Math.round((filled/all.length)*100) : 100;
  return { score, requiredMissing, total: all.length, filled };
}
function completenessBarHtml(score){
  const cls = score < 50 ? 'completeness-low' : score < 80 ? 'completeness-mid' : 'completeness-high';
  return `<span class="completeness-bar" title="${score}% complete"><div class="${cls}" style="width:${score}%"></div></span><span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text2)">${score}%</span>`;
}

/* ==============================================================
   TRANSLATE — JP/EN
   ============================================================== */
function autoTranslateField(srcId, destId, direction){
  // 旧 'translate' アクションは壊れているため ai_translate ベースの aiTranslateField に委譲
  aiTranslateField(srcId, destId, direction === 'en-to-jp' ? 'ja' : 'en');
}
function translateField(fieldId, direction){
  // 同一フィールドを上書き翻訳（EN→JP: 英語で書いた説明文を日本語正に変換する用途）
  const el = document.getElementById(fieldId);
  if(!el) return;
  const text = el.value.trim();
  if(!text) return toast('No text to translate','error');
  const target = direction === 'en-to-jp' ? 'ja' : 'en';
  const btn = event && event.target;
  if(btn){btn.disabled=true;btn.dataset.orig=btn.textContent;btn.innerHTML='Translating<span class="spinner"></span>';}
  toast('✨ 翻訳中...','info');
  aiTranslate_(text, target, false)
    .then(d=>{
      if(btn){btn.disabled=false;btn.textContent=btn.dataset.orig||'Translate';}
      if(d.status==='ok'&&d.text){
        el.value=d.text.trim();
        markFormDirty();
        toast('翻訳しました — 内容を確認してください','success');
      } else toast(d.message||'Translation failed','error');
    }).catch(e=>{
      if(btn){btn.disabled=false;btn.textContent=btn.dataset.orig||'Translate';}
      toast('Translation error','error');
    });
}

/* ==============================================================
   KEYBOARD SHORTCUTS
   ============================================================== */
function initKeyboardShortcuts(){
  document.addEventListener('keydown', e => {
    const cmd = e.metaKey || e.ctrlKey;
    // Cmd+S: 保存
    if(cmd && e.key === 's'){
      e.preventDefault();
      const activeSection = document.querySelector('.section.active')?.id?.replace('sec-','');
      if(!activeSection) return;
      // 編集モード中ならsaveEdit、フォームタブなら新規保存
      if(editState && editState[activeSection]) saveEdit(activeSection);
      else if(document.getElementById(activeSection+'-tab-form')?.classList.contains('active')) submitToSheet(activeSection);
      else toast('Open a form first','info');
    }
    // Cmd+K: 検索フォーカス
    else if(cmd && e.key === 'k'){
      e.preventDefault();
      const activeSection = document.querySelector('.section.active')?.id?.replace('sec-','');
      const searchInput = document.getElementById(activeSection+'-search');
      if(searchInput){ searchInput.focus(); searchInput.select(); }
    }
    // Esc: プレビューを閉じる、編集キャンセル
    else if(e.key === 'Escape'){
      const overlay = document.getElementById('preview-overlay');
      if(overlay && overlay.classList.contains('show')){
        closePreview();
        return;
      }
      const activeSection = document.querySelector('.section.active')?.id?.replace('sec-','');
      if(activeSection && editState && editState[activeSection]){
        if(confirm('Cancel editing?')) cancelEdit(activeSection);
      }
    }
  });
}

/* ==============================================================
   RECENT ITEMS
   ============================================================== */
const RECENT_KEY = 'cms_recent_v1';
const RECENT_MAX = 8;
function getRecentItems(){
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch(e) { return []; }
}
function recordRecentItem(section, row, rowNum){
  let items = getRecentItems();
  const label = row.name || row.title || row.id || '(unnamed)';
  // 重複削除
  items = items.filter(i => !(i.section === section && i.rowNum === rowNum));
  items.unshift({ section, rowNum, label, ts: Date.now() });
  items = items.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(items));
  renderRecentItems();
}
function renderRecentItems(){
  const c = document.getElementById('recent-items');
  if(!c) return;
  const items = getRecentItems();
  if(!items.length){c.innerHTML = '';return;}
  const icons = {festival:'◆', venue:'○', artist:'△', event:'◼', article:'✎'};
  c.innerHTML = '<div style="font-family:var(--font-mono);font-size:.6rem;letter-spacing:1px;color:var(--text3);padding:8px 12px 4px">RECENT</div>' +
    items.map((item,i) => `<button class="recent-item" onclick="openRecent(${i})" title="${esc(item.section)}">${icons[item.section]||''} ${esc(item.label.substring(0,18))}${item.label.length>18?'…':''}</button>`).join('');
}
function openRecent(idx){
  const items = getRecentItems();
  const it = items[idx];
  if(!it) return;
  // セクション切り替え
  const navBtns = document.querySelectorAll('.sidebar nav button');
  let targetBtn = null;
  navBtns.forEach(b => { if(b.textContent.toLowerCase().includes(it.section)) targetBtn = b; });
  if(targetBtn) targetBtn.click();
  // List をロードして該当行を編集モードへ
  loadList(it.section);
  setTimeout(() => {
    const row = listCache[it.section]?.find(r => r._row === it.rowNum);
    if(row) editRow(it.section, it.rowNum);
    else toast('Item not found (may have been deleted)', 'error');
  }, 1500);
}

/* ==============================================================
   CALENDAR VIEW
   ============================================================== */
let festivalView='list', eventView='list';
function setFestivalView(v){
  festivalView=v;
  document.querySelectorAll('#festival-view-toggle button').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  filterFestivalList();
}
function setEventView(v){
  eventView=v;
  document.querySelectorAll('#event-view-toggle button').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  filterEventList();
}
function renderCalendar(section, rows){
  const c=document.getElementById(section+'-list');
  // 月別にグループ化
  const months={};
  rows.forEach(r=>{
    const date=String(r.date||'').substring(0,7); // YYYY-MM
    if(!date.match(/^\d{4}-\d{2}$/)) return;
    if(!months[date]) months[date]=[];
    months[date].push(r);
  });
  const sorted=Object.keys(months).sort().reverse();
  if(!sorted.length){c.innerHTML='<div class="data-list-empty">No dated entries</div>';return}
  const html=sorted.map(ym=>{
    const [y,m]=ym.split('-');
    const items=months[ym].slice(0,4).map(r=>'<div title="'+esc(r.name||'')+'">'+esc((r.name||r.title||'').substring(0,18))+(r.name && r.name.length>18?'…':'')+'</div>').join('');
    const more=months[ym].length>4?'<div style="opacity:.5">+'+(months[ym].length-4)+' more</div>':'';
    return `<div class="cal-month" onclick="document.getElementById('${section}-search').value='${ym}';filter${section.charAt(0).toUpperCase()+section.slice(1)}List()">
      <div class="cal-month-label">${y} / ${m}</div>
      <div class="cal-month-count">${months[ym].length}</div>
      <div class="cal-month-items">${items}${more}</div>
    </div>`;
  }).join('');
  c.innerHTML='<div class="cal-grid">'+html+'</div>';
}

/* ==============================================================
   LOCATION MAP — Lat/Lng visual confirmation
   ============================================================== */
const locMaps = {};
const _locMapTimers = {};
function updateLocationMap(prefix){
  // 手入力中の連続呼び出しを 250ms debounce（Leaflet の setView/invalidateSize は重い）
  clearTimeout(_locMapTimers[prefix]);
  _locMapTimers[prefix] = setTimeout(() => _updateLocationMapNow(prefix), 250);
}
function _updateLocationMapNow(prefix){
  const lat = parseFloat(document.getElementById(prefix+'-lat')?.value);
  const lng = parseFloat(document.getElementById(prefix+'-lng')?.value);
  const container = document.getElementById(prefix+'-map');
  if(!container || !window.L) return;
  if(isNaN(lat) || isNaN(lng)){
    container.classList.remove('show');
    return;
  }
  container.classList.add('show');
  if(!locMaps[prefix]){
    setTimeout(() => {
      locMaps[prefix] = L.map(prefix+'-map', {
        center:[lat,lng], zoom:14, zoomControl:true, attributionControl:false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:19}).addTo(locMaps[prefix]);
      const icon = L.divIcon({className:'',html:'<div style="width:14px;height:14px;background:#ff2d2d;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px rgba(255,45,45,.6)"></div>',iconSize:[14,14],iconAnchor:[7,7]});
      locMaps[prefix].marker = L.marker([lat,lng],{icon}).addTo(locMaps[prefix]);
      setTimeout(()=>locMaps[prefix].invalidateSize(), 100);
    }, 100);
  } else {
    locMaps[prefix].setView([lat,lng], locMaps[prefix].getZoom());
    locMaps[prefix].marker.setLatLng([lat,lng]);
    setTimeout(()=>locMaps[prefix].invalidateSize(), 100);
  }
}

/* ==============================================================
   VALIDATION HELPERS
   ============================================================== */
function isValidUrl(s){
  if(!s) return true; // 空はOK（オプション）
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch(e) { return false; }
}
function checkDuplicateId(section, id){
  if(!id || !listCache[section]) return null;
  const exists = listCache[section].find(r => String(r.id||'').toLowerCase() === id.toLowerCase());
  return exists ? exists : null;
}
function findSimilarIds(section, id){
  if(!id || !listCache[section]) return [];
  const lower = id.toLowerCase();
  return listCache[section].filter(r => {
    const rid = String(r.id||'').toLowerCase();
    if(rid === lower) return false;
    // ハイフン違いや短縮形を検出
    return rid.includes(lower) || lower.includes(rid);
  }).slice(0, 3);
}
function validateBeforeSave(section, payload){
  const errors = [];
  // URL系フィールドをチェック
  const urlFields = ['url','ticketUrl','instagram','soundcloud','bandcamp','website','link','image','flyer'];
  urlFields.forEach(f => {
    if(payload[f] && !payload[f].startsWith('images/') && !isValidUrl(payload[f])){
      errors.push(f + ': 有効なURLではありません ('+payload[f]+')');
    }
  });
  // ID の slug 規約チェック（DATA_SCHEMA §1.1）。
  // クイック追加は slugify() で生成するので安全だが、フル追加はID手入力のため
  // NAME をそのまま貼ると大文字・スペース入りのIDが通ってしまう。実際にこの経路で
  // 7件（"Acid Pauli" 等）が混入し、URL に %20 が出る状態になった。
  // 発行後のIDは変更できない（URLになる）ので、入口で止める。
  // 自動整形はしない。IDはURLとして恒久的に残るため、人が意図を確認して決めるべき。
  if(payload.id && ['venue','festival','artist'].includes(section)){
    const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;   // fetch-data.mjs と同一
    if(!ID_RE.test(payload.id)){
      const suggest = slugify(payload.name || '');
      errors.push('ID "'+payload.id+'" は形式違反です（小文字英数字とハイフンのみ／'
        + 'スペース・大文字・連続ハイフン・前後ハイフン禁止）'
        + (suggest ? '\n  → 例: ' + suggest : ''));
    }
  }
  // 日本語のみの名前は slugify() が空を返し、ID を自動生成できない。
  // スキーマ §1.1 は「自動変換できない場合はスタブを作らず要手動対応」としているので、
  // 勝手に日付ベースの ID を振らず、ローマ字での手入力を促す。
  // 既に妥当なIDが手入力されていれば何も言わない（ao / NAME=青 のような正常ケース）。
  if(payload.action && payload.action.startsWith('add_') && payload.name
     && !slugify(payload.name) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.id || '')
     && ['venue','festival','artist'].includes(section)){
    errors.push('名前 "'+payload.name+'" からIDを自動生成できません'
      + '（日本語のみ等）。ローマ字で手入力してください（例: 青 → ao）');
  }
  // ID重複チェック（新規登録のみ）
  if(payload.action && payload.action.startsWith('add_') && payload.id){
    const dup = checkDuplicateId(section, payload.id);
    if(dup) errors.push('ID "'+payload.id+'" は既に存在します ('+(dup.name||dup.title)+')');
    const similar = findSimilarIds(section, payload.id);
    if(similar.length){
      const names = similar.map(s => s.id).join(', ');
      if(!confirm('似たIDがあります: '+names+'\n\nこのまま登録しますか？')) {
        errors.push('登録キャンセル');
      }
    }
  }
  return errors;
}

/* 画像を圧縮: 最大幅 maxW、品質 quality
   WebP対応ブラウザでは WebP（〜35%軽量）、非対応なら JPEG にフォールバック */
function compressImage(file, maxW=1920, quality=0.85){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = reject;
    img.onload = () => {
      const ratio = Math.min(1, maxW/img.width);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // WebP サポート判定
      const supportsWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      const mimeType = supportsWebp ? 'image/webp' : 'image/jpeg';
      const ext = supportsWebp ? 'webp' : 'jpg';
      canvas.toBlob(blob => {
        if(!blob) return reject(new Error('compression failed'));
        const fr = new FileReader();
        fr.onload = () => resolve({dataUrl: fr.result, blob, width: w, height: h, mimeType, ext});
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      }, mimeType, quality);
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* URL画像をブラウザ側でfetch → compressImage(webp/1920px上限) し、
   ファイルアップロードと同じ upload_image / upload_festival_image 経路へ送る。
   CORS やネットワークで fetch できない、または画像でない場合は null を返し、
   呼び出し側は従来の GAS upload_from_url（サーバfetch・原寸）にフォールバックする。 */
async function compressUrlAndUpload(url, type, id){
  let blob;
  try {
    const res = await fetch(url, {mode:'cors'});
    if(!res.ok) return null;
    blob = await res.blob();
  } catch(_) { return null; }            // CORS / ネットワーク → フォールバック
  let comp;
  try { comp = await compressImage(blob); } // 画像でなければ img.onerror で reject
  catch(_) { return null; }
  const action = type.startsWith('festival') ? 'upload_festival_image' : 'upload_image';
  const filename = type === 'festival-flyer' ? (id+'-flyer.'+comp.ext) : (id+'.'+comp.ext);
  try {
    const d = await fetch(GAS_URL,{method:'POST',body:JSON.stringify({
      action, imageData:comp.dataUrl, mimeType:comp.mimeType, id, type, filename
    })}).then(r=>r.json());
    if(d.status==='ok' || d.success) return { path: d.imagePath||d.path||'', comp };
  } catch(_) {}
  return null;
}

/* ==============================================================
   IMAGE PREVIEW HELPERS
   既存画像のプレビュー表示 / 削除（編集モード用）
   ============================================================== */
// Drive→サイト同期前でも、同じタブ内ではアップロード済みBlobを確認できるようにする。
// 保存先パスをキーにするため、Save Changes後に編集フォームを開き直しても再利用できる。
const pendingImagePreviews = new Map();
function rememberPendingImagePreview(imagePath, blob){
  if(!imagePath || !blob) return '';
  const oldUrl = pendingImagePreviews.get(imagePath);
  if(oldUrl) URL.revokeObjectURL(oldUrl);
  const objectUrl = URL.createObjectURL(blob);
  pendingImagePreviews.set(imagePath, objectUrl);
  return objectUrl;
}
function releasePendingImagePreview(imagePath){
  const objectUrl = pendingImagePreviews.get(imagePath);
  if(!objectUrl) return;
  URL.revokeObjectURL(objectUrl);
  pendingImagePreviews.delete(imagePath);
}
function uploadCompleteInfo(imagePath, details){
  return '<div class="preview-info" style="color:var(--yellow)">'
    +'<strong>✓ Driveへのアップロード完了</strong>'+(details||'')
    +(imagePath ? '<br>'+esc(imagePath) : '')
    +'<br>「Save Changes」で画像パスを保存してください。'
    +'<br>左メニューの「画像を今すぐ同期」を押すと、通常1〜3分で反映されます。</div>';
}
window.addEventListener('beforeunload',()=>{
  pendingImagePreviews.forEach(url=>URL.revokeObjectURL(url));
  pendingImagePreviews.clear();
});

/* アップロード直後の画像はまだ Drive→サイトへ同期されていないため、サイト上のパスでは
   404 になる（同期は定期実行）。その場合は Drive 上の実物を直接表示して「アップロードは
   成功している」ことが分かるようにする。Drive にも無ければ本当に見つからない扱い。 */
function fallbackToDriveImage(img){
  const path = img.getAttribute('data-path') || '';
  const m = path.match(/^images\/([^/]+)\/(.+)$/);
  const showMissing = () => {
    img.style.display='none';
    const ph = img.parentNode && img.parentNode.querySelector('.img-missing-placeholder');
    if (ph) ph.style.display='flex';
  };
  if(!m) return showMissing();
  fetch(GAS_URL+'?action=get_images&type='+encodeURIComponent(m[1]))
    .then(r=>r.json()).then(d=>{
      // Drive 側のファイル名は原本のまま（.jpeg）のことも webp 変換後のこともある。
      // data-path は生値なので、両方の名前で探す。
      const want = [m[2], webp(m[2])];
      const hit = ((d && d.status==='ok' && d.images) || []).find(i => want.includes(i.name));
      if(hit && hit.url){
        img.onerror = showMissing;      // Drive URL でも失敗したら諦める
        img.src = driveThumb(hit.url, 400);
        const info = img.parentNode && img.parentNode.querySelector('.preview-info');
        if(info) info.insertAdjacentHTML('beforeend',
          ' <span style="color:var(--yellow);font-size:.9em">（Drive にアップ済み — サイトへは同期後に反映）</span>');
      } else showMissing();
    }).catch(showMissing);
}
function showCurrentImage(previewId, imagePath, clearCallExpr){
  if(!imagePath) return;
  const el=document.getElementById(previewId);
  if(!el) return;
  el.style.display='block';
  const pendingUrl = pendingImagePreviews.get(imagePath) || '';
  // サイト上に無ければ Drive の実物へフォールバック（同期待ちを「消えた」と誤解させない）
  const errHandler = "fallbackToDriveImage(this)";
  // 配信されるのは webp のみなので表示は webp() を通す。
  // data-path は Drive 原本を名前で引くためのキーなので生値のまま渡す
  // （Drive 側は .jpeg のままのことがある。fallbackToDriveImage が両方の名前を試す）。
  el.innerHTML =
    '<img src="'+esc(pendingUrl||webp(imagePath))+'" data-path="'+esc(imagePath)+'" alt="current" onerror="'+errHandler+'" style="max-height:140px">' +
    '<div class="img-missing-placeholder" style="display:none;width:200px;height:120px;background:#1a1a1a;border:1px dashed #444;border-radius:4px;align-items:center;justify-content:center;color:#888;font-family:var(--font-mono);font-size:.7rem;text-align:center;padding:8px;line-height:1.4">📁 画像ファイルが<br>見つかりません<br><span style="opacity:.6">(Drive 同期待ち or 手動で再 upload)</span></div>' +
    (pendingUrl
      ? uploadCompleteInfo(imagePath, '')
      : '<div class="preview-info">現在の画像 — '+esc(webp(imagePath))+'</div>') +
    '<div class="preview-info"><button type="button" class="btn btn-sm btn-accent" style="padding:2px 8px;font-size:.65rem" onclick="'+clearCallExpr+'">✕ Remove</button></div>';
}
function clearImageField(prefix, opts){
  opts=opts||{};
  const pathId=opts.pathId||(prefix+'-image');
  const urlId=opts.urlId||(prefix+'-imageUrl');
  const previewId=opts.previewId||('preview-'+prefix+'-image');
  const pathEl=document.getElementById(pathId);
  const oldPath=(pathEl?.value||'').trim();
  if(oldPath) releasePendingImagePreview(oldPath);
  if(pathEl){pathEl.removeAttribute('readonly');pathEl.value='';pathEl.setAttribute('readonly','');}
  const urlEl=document.getElementById(urlId);
  if(urlEl) urlEl.value='';
  const previewEl=document.getElementById(previewId);
  if(previewEl){previewEl.style.display='none';previewEl.innerHTML='';}
  // Reset hidden file input under upload-area
  const fileInputs=document.querySelectorAll('#sec-'+(opts.section||'')+' .upload-area input[type=file]');
  fileInputs.forEach(i=>{i.value='';});
  // Position preview refresh (artist/venue/festival)
  if(typeof syncImagePos==='function' && document.getElementById(prefix+'-imagePosition')) syncImagePos(prefix);
  toast('画像をクリアしました（保存で反映）','info');
}

function uploadImage(input,type,prefix){
  const file=input.files[0]; if(!file)return;
  const id=document.getElementById(prefix+'-id')?.value?.trim();
  if(!id)return toast('Enter ID first','error');
  const origMB=(file.size/1024/1024).toFixed(1);
  const previewId='preview-'+prefix+'-'+(type==='festival-flyer'?'flyer':'image');
  const previewEl=document.getElementById(previewId);

  toast('Compressing... ('+origMB+'MB)','info');
  compressImage(file).then(({dataUrl, blob, width, height, mimeType, ext})=>{
    const compMB=(blob.size/1024/1024).toFixed(2);
    const fmtLabel = mimeType === 'image/webp' ? 'WebP' : 'JPEG';
    toast('Uploading... '+origMB+'MB → '+compMB+'MB ('+fmtLabel+')','info');
    if(previewEl){
      previewEl.style.display='block';
      previewEl.innerHTML='<img src="'+dataUrl+'" alt="preview"><div class="preview-info">'+esc(file.name)+' — '+width+'×'+height+' ('+origMB+'MB → '+compMB+'MB '+fmtLabel+') uploading...</div>';
    }
    // festival系は upload_festival_image、それ以外は upload_image
    const action=type.startsWith('festival')?'upload_festival_image':'upload_image';
    const filename = type === 'festival-flyer' ? (id+'-flyer.'+ext) : (id+'.'+ext);
    const body={action,imageData:dataUrl,mimeType,id,type,filename};
    return fetch(GAS_URL,{method:'POST',body:JSON.stringify(body)}).then(r=>r.json()).then(d=>{
      if(d.status==='ok'||d.success){
        const imagePath=d.imagePath||d.path||'';
        toast('Driveへのアップロード完了 — Save Changes後に画像同期ボタンを押してください','success');
        if(imagePath&&prefix){
          const target=type==='festival-flyer'?prefix+'-flyer':prefix+'-image';
          const el=document.getElementById(target);
          if(el)el.value=imagePath;
        }
        if(previewEl){
          const localUrl=rememberPendingImagePreview(imagePath,blob);
          const img=previewEl.querySelector('img');
          if(img&&localUrl)img.src=localUrl;
          const info=previewEl.querySelector('.preview-info');
          if(info)info.outerHTML=uploadCompleteInfo(imagePath,' — '+width+'×'+height+' ('+compMB+'MB '+fmtLabel+')');
        }
      } else {
        toast(d.message||'Upload failed','error');
        renderUploadFailed(previewEl,'✗ Upload failed: '+(d.message||''),prefix,type);
      }
    });
  }).catch(e=>{
    console.error('Compress/upload error:',e);
    toast('Image error: '+e.message,'error');
    renderUploadFailed(previewEl,'✗ '+(e.message||'error'),prefix,type);
  }).finally(()=>{
    // Always clear file input so re-selecting the same file fires onchange
    try{input.value='';}catch(_){}
  });
}

// Render an "upload failed" state with a Retry hint + Dismiss button.
// Clears the path field so the failed file path doesn't get saved.
function renderUploadFailed(previewEl,message,prefix,type){
  if(!previewEl) return;
  // Clear the path field that uploadImage may have set partially
  const pathFieldId=prefix+'-'+(type==='festival-flyer'?'flyer':'image');
  const pathEl=document.getElementById(pathFieldId);
  const oldPath=(pathEl?.value||'').trim();
  if(oldPath) releasePendingImagePreview(oldPath);
  if(pathEl){pathEl.removeAttribute('readonly');pathEl.value='';pathEl.setAttribute('readonly','');}
  previewEl.style.display='block';
  previewEl.innerHTML='<div class="preview-info" style="color:#ff6b6b">'+esc(message)+' <button type="button" class="btn btn-sm" style="margin-left:8px;padding:2px 8px;font-size:.65rem" onclick="this.closest(\'.img-preview\').style.display=\'none\';this.closest(\'.img-preview\').innerHTML=\'\'">Dismiss</button></div>';
}

/* ==============================================================
   IMAGE / FLYER FROM URL
   画像URLを直接指定 → GAS経由でDriveにアップロード
   汎用関数: 全セクション共通で使用
   ============================================================== */
function uploadFromUrl(prefix,type,pathFieldId,urlFieldId,previewId){
  const url=document.getElementById(urlFieldId).value.trim();
  if(!url)return toast('画像URLを入力してください','error');
  if(!url.startsWith('http'))return toast('有効なURLを入力してください','error');
  // Instagram投稿URLの検知
  if(url.match(/instagram\.com\/(p|reel)\//)){
    const pEl=document.getElementById(previewId);
    if(pEl){pEl.style.display='block';pEl.innerHTML='<div class="insta-help">'
      +'<p><strong>Instagram投稿URLは直接使えません</strong></p>'
      +'<p>投稿画像を保存して「手動アップロード」を使うか、画像を右クリック→「画像アドレスをコピー」で画像URLを取得してください。</p></div>';}
    return toast('Instagram投稿URLではなく画像URLを貼り付けてください','error');
  }
  const id=document.getElementById(prefix+'-id')?.value?.trim();
  if(!id)return toast('先にIDを入力してください','error');
  const btn=event.target;
  btn.disabled=true;btn.innerHTML='UPLOADING...<span class="spinner"></span>';
  const previewEl=document.getElementById(previewId);
  if(previewEl)previewEl.style.display='none';
  const done=()=>{btn.disabled=false;btn.textContent='UPLOAD';};
  const showOk=(path,extra,blob)=>{
    toast('Driveへのアップロード完了 — Save Changes後に画像同期ボタンを押してください','success');
    document.getElementById(pathFieldId).value=path||'';
    if(previewEl){
      const localUrl=rememberPendingImagePreview(path,blob);
      previewEl.style.display='block';
      previewEl.innerHTML='<img src="'+esc(localUrl||url)+'" alt="preview" onerror="this.style.display=\'none\'">'
        +uploadCompleteInfo(path,extra||'');
    }
  };
  // ブラウザ側で webp 化できず、原寸のまま Drive に入った場合の表示。
  // 「完了」だけ出して黙っていると、サイトに出ないことに気づけない（webp 化は
  // Sync Drive Images 側で行うため即時反映されない）。
  const showFallback=(path)=>{
    toast('Driveへのアップロード完了 — Save Changes後に画像同期ボタンを押してください','warning');
    document.getElementById(pathFieldId).value=path||'';
    if(previewEl){
      previewEl.style.display='block';
      previewEl.innerHTML='<img src="'+esc(url)+'" alt="preview" onerror="this.style.display=\'none\'">'
        +'<div class="preview-info" style="color:var(--yellow)">⚠ 原寸のままDriveに保存しました — '+esc(path||'')
        +'<br>配信元がCORSを許可していないため、ブラウザ側でwebp化できませんでした。'
        +'<br>webp変換は画像同期時に行われるため、<strong>サイトへの反映は即時ではありません</strong>。'
        +'<br><strong>「Save Changes」で画像パスを保存してください。</strong>'
        +'<br>左メニューの「画像を今すぐ同期」を押すと、通常1〜3分で反映されます。</div>';
    }
  };
  // まずブラウザ側で圧縮を試す（1920px/webp）。CORS等で不可なら従来の原寸経路へ。
  compressUrlAndUpload(url,type,id).then(r=>{
    if(r){ done(); showOk(r.path, ' — '+(r.comp.blob.size/1024/1024).toFixed(2)+'MB WebP', r.comp.blob); return; }
    return fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'upload_from_url',imageUrl:url,type:type,id:id})})
      .then(x=>x.json()).then(d=>{
        done();
        if(d.success){ showFallback(d.path); }
        else { toast(d.error||'アップロード失敗','error'); renderUploadFailed(previewEl,'✗ '+(d.error||'アップロード失敗'),prefix,type); }
      });
  }).catch(e=>{
    done();
    toast('通信エラー: '+e.message,'error');
    renderUploadFailed(previewEl,'✗ 通信エラー: '+e.message,prefix,type);
  });
}

/* ==============================================================
   AI GENERATE
   ============================================================== */
function aiGenerate(section){
  let name,city,extraContext='',url='',instagram='';
  if(section==='venue'){
    name=g('v-name');city=g('v-city');url=g('v-url');instagram=g('v-instagram');
    extraContext='capacity: '+g('v-capacity')+', type: '+g('v-type');
  } else if(section==='festival'){
    name=g('f-name');city=g('f-city');url=g('f-url');instagram=g('f-instagram');
    extraContext='location: '+g('f-location')+', type: '+g('f-type');
  } else if(section==='artist'){
    name=g('a-name');city=g('a-city');instagram=g('a-instagram');
    url=g('a-website');
    extraContext='genre: '+g('a-genre')+', country: '+g('a-country');
  }
  if(!name)return toast('Enter name first','error');
  toast('Generating...','info');
  fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'aiGenerate',section,name,city,context:extraContext,url,instagram})})
    .then(r=>r.json()).then(d=>{
      if(d.success){
        if(section==='venue'){if(d.desc)document.getElementById('v-desc').value=d.desc;if(d.capacity)document.getElementById('v-capacity').value=d.capacity}
        else if(section==='festival'){if(d.desc)document.getElementById('f-desc').value=d.desc}
        else if(section==='artist'){if(d.bio)document.getElementById('a-bio').value=d.bio}
        toast('Generated','success');
      }else toast(d.error||'Generation failed','error');
    }).catch(()=>toast('Generation error','error'));
}

/* ==============================================================
   LIST — LOAD
   ============================================================== */
let festivalYearFilter = 'ALL';
let festivalMonthFilter = 'ALL';

/* ==============================================================
   PERFORMANCE — debounce helper
   ============================================================== */
function debounce(fn, wait){
  let t;
  return function(){
    const args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), wait);
  };
}
// デバウンス版 filter（200ms 待ってから実行）
const debouncedFilterArtist = debounce(()=>filterArtistList(), 200);
const debouncedFilterFestival = debounce(()=>filterFestivalList(), 200);
const debouncedFilterVenue = debounce(()=>filterVenueList(), 200);
const debouncedFilterEvent = debounce(()=>filterEventList(), 200);
const debouncedFilterArticle = debounce(()=>filterArticleList(), 200);
const debouncedFilterAuthor = debounce(()=>filterAuthorList(), 200);

/* ==============================================================
   PERFORMANCE — localStorage cache layer
   ============================================================== */
const SHEET_CACHE_TTL = 5 * 60 * 1000; // 5分
function readSheetCache(section){
  try {
    const raw = localStorage.getItem('sheet_cache_'+section);
    if(!raw) return null;
    const {ts, rows} = JSON.parse(raw);
    if(Date.now() - ts > SHEET_CACHE_TTL) return null;
    return rows;
  } catch(e) { return null; }
}
function writeSheetCache(section, rows){
  try { localStorage.setItem('sheet_cache_'+section, JSON.stringify({ts:Date.now(), rows})); }
  catch(e) { /* localStorage full */ }
}
function invalidateSheetCache(section){
  if(section) localStorage.removeItem('sheet_cache_'+section);
  else ['venue','festival','artist','event','article','author'].forEach(s=>localStorage.removeItem('sheet_cache_'+s));
}

function applyLoadedRows(section, rows, container){
  listCache[section] = rows;
  if(section==='festival') buildYearFilter(rows);
  if(section==='artist'){filterArtistList();return}
  if(section==='festival'){filterFestivalList();return}
  if(section==='venue'){filterVenueList();return}
  if(section==='event'){filterEventList();return}
  if(section==='article'){filterArticleList();return}
  if(section==='author'){filterAuthorList();return}
  renderList(section, rows);
}

function loadList(section, opts){
  opts = opts || {};
  const force = !!opts.force;
  const silent = !!opts.silent; // バックグラウンド先読み用
  const container = document.getElementById(section+'-list');

  // キャッシュチェック
  if(!force){
    const cached = readSheetCache(section);
    if(cached){
      if(container && !silent) applyLoadedRows(section, cached, container);
      else if(silent){ listCache[section] = cached; }
      // バックグラウンドで再取得（stale-while-revalidate）
      fetch(GAS_URL+'?action=get_sheet&sheet='+SHEET_MAP[section])
        .then(r=>r.json()).then(d=>{
          if(d.status==='ok'&&d.rows){
            writeSheetCache(section, d.rows);
            // データに変更があれば再描画
            if(JSON.stringify(d.rows)!==JSON.stringify(cached) && container && container.offsetParent !== null){
              applyLoadedRows(section, d.rows, container);
            } else {
              listCache[section] = d.rows;
            }
          }
        }).catch(()=>{});
      return;
    }
  }

  if(container && !silent) container.innerHTML='<div class="data-list-loading">Loading<span class="spinner"></span></div>';
  fetch(GAS_URL+'?action=get_sheet&sheet='+SHEET_MAP[section])
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok'&&d.rows){
        writeSheetCache(section, d.rows);
        if(silent){ listCache[section] = d.rows; return; }
        applyLoadedRows(section, d.rows, container);
      }
      else if(container){container.innerHTML='<div class="data-list-empty">Failed to load</div>';toast('Load failed','error')}
    }).catch(err=>{if(container && !silent){container.innerHTML='<div class="data-list-empty">Error: '+err.message+'</div>';toast('Load error','error')}});
}

/* 日付セルは ISO ("2026-07-24" / "2026-07-24/2026-07-26") と
   JS Date.toString() ("Sun Jul 26 2026 ...") が混在する。YYYY-MM に正規化する。 */
const MONTH_LABELS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function ymOf(dateVal){
  const s=String(dateVal||'').trim();
  if(!s) return '';
  const head=s.split('/')[0].trim();
  const iso=head.match(/(\d{4})-(\d{2})/);
  if(iso) return iso[1]+'-'+iso[2];
  const d=new Date(head);
  if(!isNaN(d)) return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  return '';
}

function buildYearFilter(rows){
  const yms=[...new Set(rows.map(r=>ymOf(r.date)).filter(Boolean))];
  const years=[...new Set(yms.map(v=>v.slice(0,4)))].sort().reverse();
  const c=document.getElementById('festival-year-filter');
  const label=t=>'<span style="font-family:var(--font-mono);font-size:.65rem;letter-spacing:1px;color:var(--text3);text-transform:uppercase">'+t+'</span>';
  c.innerHTML='';
  c.style.flexWrap='wrap';

  const yearRow=document.createElement('div');
  yearRow.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;width:100%';
  yearRow.innerHTML=label('Year:');
  const mkYear=(val,text)=>{
    const b=document.createElement('button');
    b.className='btn btn-sm'+(festivalYearFilter===val?' btn-accent':'');
    b.textContent=text; b.dataset.year=val;
    b.onclick=()=>{festivalYearFilter=val;filterFestivalList();highlightYearBtn()};
    yearRow.appendChild(b);
  };
  mkYear('ALL','ALL');
  years.forEach(y=>mkYear(y,y));
  c.appendChild(yearRow);

  // 月フィルタ。年が ALL のときは全年の同じ月を対象にする。
  const monthRow=document.createElement('div');
  monthRow.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;width:100%;margin-top:6px';
  monthRow.innerHTML=label('Month:');
  const available=new Set(yms.filter(v=>festivalYearFilter==='ALL'||v.startsWith(festivalYearFilter)).map(v=>v.slice(5,7)));
  const mkMonth=(val,text,enabled)=>{
    const b=document.createElement('button');
    b.className='btn btn-sm'+(festivalMonthFilter===val?' btn-accent':'');
    b.textContent=text; b.dataset.month=val;
    if(!enabled){ b.disabled=true; b.style.opacity='.3'; b.title='該当データなし'; }
    else b.onclick=()=>{festivalMonthFilter=val;filterFestivalList();highlightYearBtn()};
    monthRow.appendChild(b);
  };
  mkMonth('ALL','ALL',true);
  MONTH_LABELS.forEach((lbl,i)=>{
    const mm=String(i+1).padStart(2,'0');
    mkMonth(mm,lbl,available.has(mm));
  });
  c.appendChild(monthRow);
}

function highlightYearBtn(){
  document.querySelectorAll('#festival-year-filter .btn').forEach(b=>{
    const isActive=(b.dataset.year!==undefined&&b.dataset.year===festivalYearFilter)||
                   (b.dataset.month!==undefined&&b.dataset.month===festivalMonthFilter);
    b.classList.toggle('btn-accent',isActive);
  });
  // 年を切り替えると選択可能な月が変わるので、フィルタUIを組み直す。
  const rows=listCache.festival||[];
  if(rows.length) buildYearFilter(rows);
}

function filterByYear(rows){
  return rows.filter(r=>{
    const ym=ymOf(r.date);
    if(festivalYearFilter!=='ALL' && ym.slice(0,4)!==festivalYearFilter) return false;
    if(festivalMonthFilter!=='ALL' && ym.slice(5,7)!==festivalMonthFilter) return false;
    return true;
  });
}

function renderList(section, rows){
  const c=document.getElementById(section+'-list');
  if(!rows.length){c.innerHTML='<div class="data-list-empty">No data</div>';return}
  const cols = {
    venue:   [{k:'name',l:'Name'},{k:'city',l:'City'},{k:'type',l:'Type'},{k:'genre',l:'Genre'}],
    festival:[{k:'name',l:'Name'},{k:'date',l:'Date'},{k:'city',l:'City'},{k:'type',l:'Type'}],
    artist:  [{k:'name',l:'Name'},{k:'city',l:'City'},{k:'genre',l:'Genre'}],
    event:   [{k:'name',l:'Name'},{k:'date',l:'Date'},{k:'venue',l:'Venue'},{k:'city',l:'City'}],
    article: [{k:'title',l:'Title'},{k:'category',l:'Category'},{k:'date',l:'Date'},{k:'readTime',l:'Read Time'}],
    author:  [{k:'name',l:'Name'},{k:'id',l:'ID'},{k:'website',l:'Website'}],
  }[section];
  const showStatus = section !== 'author';
  const showThumb = ['article','artist','venue','festival'].includes(section);
  const ths=(showThumb?'<th style="width:64px"></th>':'')+(showStatus?'<th style="width:40px">📊</th><th style="width:90px">Status</th>':'')+cols.map(c=>'<th>'+c.l+'</th>').join('')+'<th></th>';
  const trs=rows.map(r=>{
    let prefix='';
    if(showThumb){
      // シートの生値は Drive 原本の拡張子（.jpeg/.jpg）のままのことがあるが、
      // 配信されるのは webp のみ。生値で <img src> にすると 404 になり ✕ が出る。
      // Publish 時と同じ webp() を通す（date 列に fmtDate() を通すのと同じ理由）。
      const img=webp(String(r.image||'').trim());
      prefix+= img
        ? '<td class="thumb-cell"><img class="list-thumb" src="'+esc(img)+'" loading="lazy" onerror="this.outerHTML=\'<span class=list-thumb-none>✕</span>\'"></td>'
        : '<td class="thumb-cell"><span class="list-thumb-none">—</span></td>';
    }
    if(showStatus){
      const status=String(r.status||'published').toLowerCase();
      const statusBadge='<span class="status-pill status-'+esc(status)+'">'+esc(status)+'</span>';
      const comp=computeCompleteness(section, r);
      const compHtml=completenessBarHtml(comp.score);
      const noteIcon=r.editorNotes?' 📝':'';
      prefix+='<td>'+compHtml+'</td><td>'+statusBadge+noteIcon+'</td>';
    }
    // date 列は fmtDate() を通す。Sheets が日付と解釈できたセル（単日 "2025-09-07" 等）は
    // GAS の getValues() が Date オブジェクトを返すため、生値だと
    // "Sun Sep 07 2025 00:00:00 GMT+0900" と表示される。複数日 "A/B" は Sheets が
    // 日付と解釈できず文字列のまま来るので、一覧に2形式が混在していた。
    // 書き出し(buildFullDataJs)と編集フォームは既に fmtDate() 済みで、ここだけ漏れていた。
    const tds=cols.map(c=>'<td>'+esc(c.k==='date'?fmtDate(r[c.k]):r[c.k])+'</td>').join('');
    const nameVal=esc(r.name||r.title||r.id||'');
    // 楽観的挿入直後（GAS応答待ち）は行番号未確定なので操作ボタンを出さない
    const actions = r.__syncing
      ? '<td class="actions"><span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text3)">⏳ syncing...</span></td>'
      : '<td class="actions"><button class="btn btn-sm btn-blue" onclick="editRow(\''+section+'\','+r._row+')">Edit</button><button class="btn btn-sm btn-accent" onclick="confirmDelete(\''+section+'\','+r._row+',\''+nameVal.replace(/'/g,"\\'")+'\')">Delete</button></td>';
    return '<tr'+(r.__syncing?' style="opacity:.55"':'')+'>'+prefix+tds+actions+'</tr>';
  }).join('');
  c.innerHTML='<table class="data-table"><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table>';
}

/* ==============================================================
   AUTHOR LIST — SEARCH
   ============================================================== */
function filterAuthorList(){
  if(!listCache.author)return;
  const q=(document.getElementById('author-search')?.value||'').toLowerCase();
  let rows=listCache.author;
  if(q) rows=rows.filter(r=>String(r.name||'').toLowerCase().includes(q)||String(r.id||'').toLowerCase().includes(q));
  renderList('author', rows);
}

/* ==============================================================
   ARTIST LIST — SEARCH & SORT
   ============================================================== */
let artistSortKey='name', artistSortAsc=true;
function filterArtistList(){
  if(!listCache.artist)return;
  const q=(document.getElementById('artist-search')?.value||'').toLowerCase();
  let rows=listCache.artist;
  if(q) rows=rows.filter(r=>String(r.name||'').toLowerCase().includes(q)||String(r.id||'').toLowerCase().includes(q)||String(r.city||'').toLowerCase().includes(q)||String(r.genre||'').toLowerCase().includes(q));
  rows=sortRows(rows, artistSortKey, artistSortAsc, 'artist');
  renderList('artist', rows);
}
function sortArtistList(key){
  if(artistSortKey===key) artistSortAsc=!artistSortAsc;
  else { artistSortKey=key; artistSortAsc=true; }
  highlightSortBtn('artist', key, ['name','city','genre']);
  filterArtistList();
}
function sortRows(rows, key, asc, section){
  // 完成度ソート: スコアの低い（情報が欠けている）エントリを上に
  if(key==='__comp' && section){
    const scored = rows.map(r => ({r, s: computeCompleteness(section, r).score}));
    scored.sort((a,b) => asc ? a.s - b.s : b.s - a.s);
    return scored.map(x => x.r);
  }
  return [...rows].sort((a,b)=>{
    const va=String(a[key]||'').toLowerCase();
    const vb=String(b[key]||'').toLowerCase();
    return asc?va.localeCompare(vb):vb.localeCompare(va);
  });
}

/* ==============================================================
   GENERIC LIST FILTER & SORT helpers
   ============================================================== */
function applyListFilter(section, searchKeys, sortKey, sortAsc, sortGroup, preFilterFn){
  if(!listCache[section]) return;
  const q=(document.getElementById(section+'-search')?.value||'').toLowerCase();
  let rows=listCache[section];
  if(preFilterFn) rows=preFilterFn(rows);
  if(q) rows=rows.filter(r=>searchKeys.some(k=>String(r[k]||'').toLowerCase().includes(q)));
  rows=sortRows(rows, sortKey, sortAsc, section);
  renderList(section, rows);
}
function highlightSortBtn(section, key, group){
  document.querySelectorAll('#'+section+'-tab-list .btn-sm').forEach(b=>{
    const t=b.textContent.toLowerCase();
    const isComp=t.includes('未完成');
    if(t===key || (key==='__comp' && isComp)) b.className='btn btn-sm btn-accent';
    else if(group.includes(t) || isComp) b.className='btn btn-sm';
  });
}

/* ==============================================================
   VENUE LIST — SEARCH & SORT
   ============================================================== */
let venueSortKey='name', venueSortAsc=true;
function filterVenueList(){
  applyListFilter('venue', ['name','id','city','area','type','genre'], venueSortKey, venueSortAsc);
}
function sortVenueList(key){
  if(venueSortKey===key) venueSortAsc=!venueSortAsc;
  else { venueSortKey=key; venueSortAsc=true; }
  highlightSortBtn('venue', key, ['name','city','type']);
  filterVenueList();
}

/* ==============================================================
   EVENT LIST — SEARCH & SORT
   ============================================================== */
let eventSortKey='date', eventSortAsc=false;
function filterEventList(){
  if(!listCache.event)return;
  const q=(document.getElementById('event-search')?.value||'').toLowerCase();
  let rows=listCache.event;
  if(q) rows=rows.filter(r=>
    String(r.name||'').toLowerCase().includes(q) ||
    String(r.venue||'').toLowerCase().includes(q) ||
    String(r.city||'').toLowerCase().includes(q) ||
    String(r.lineup||'').toLowerCase().includes(q) ||
    String(r.date||'').includes(q)
  );
  if(eventView==='calendar'){ renderCalendar('event', rows); return; }
  rows=sortRows(rows, eventSortKey, eventSortAsc, 'event');
  renderList('event', rows);
}
function sortEventList(key){
  if(eventSortKey===key) eventSortAsc=!eventSortAsc;
  else { eventSortKey=key; eventSortAsc=(key!=='date'); }
  highlightSortBtn('event', key, ['name','date','venue']);
  filterEventList();
}

/* ==============================================================
   ARTICLE LIST — SEARCH & SORT
   ============================================================== */
let articleSortKey='date', articleSortAsc=false;
function filterArticleList(){
  applyListFilter('article', ['title','id','category','excerpt'], articleSortKey, articleSortAsc);
}
function sortArticleList(key){
  if(articleSortKey===key) articleSortAsc=!articleSortAsc;
  else { articleSortKey=key; articleSortAsc=(key!=='date'); }
  highlightSortBtn('article', key, ['title','date','category']);
  filterArticleList();
}

/* ==============================================================
   FESTIVAL LIST — SEARCH & SORT
   ============================================================== */
let festivalSortKey='date', festivalSortAsc=false;
function filterFestivalList(){
  if(!listCache.festival)return;
  const q=(document.getElementById('festival-search')?.value||'').toLowerCase();
  let rows=filterByYear(listCache.festival);
  if(q) rows=rows.filter(r=>
    String(r.name||'').toLowerCase().includes(q) ||
    String(r.id||'').toLowerCase().includes(q) ||
    String(r.city||'').toLowerCase().includes(q) ||
    String(r.location||'').toLowerCase().includes(q) ||
    String(r.location_ja||'').toLowerCase().includes(q) ||
    String(r.genre||'').toLowerCase().includes(q) ||
    String(r.lineup||'').toLowerCase().includes(q) ||
    String(r.date||'').includes(q)
  );
  if(festivalView==='calendar'){ renderCalendar('festival', rows); return; }
  rows=sortRows(rows, festivalSortKey, festivalSortAsc, 'festival');
  renderList('festival', rows);
}
function sortFestivalList(key){
  if(festivalSortKey===key) festivalSortAsc=!festivalSortAsc;
  else { festivalSortKey=key; festivalSortAsc=(key!=='date'); }
  document.querySelectorAll('#festival-tab-list .btn-sm').forEach(b=>{
    const t=b.textContent.toLowerCase();
    if(t===key) b.className='btn btn-sm btn-accent';
    else if(['name','city','date'].includes(t)) b.className='btn btn-sm';
  });
  filterFestivalList();
}

/* ==============================================================
   EDIT ROW
   ============================================================== */
function editRow(section, rowNum){
  const row=listCache[section].find(r=>r._row===rowNum);
  if(!row)return toast('Row not found','error');
  editState[section]={...row};
  recordRecentItem(section, row, rowNum);

  if(section==='venue'){
    setVal('v-id',row.id); setVal('v-name',row.name); setVal('v-city',row.city);
    setVal('v-area',row.area); setVal('v-type',row.type||'club');
    setVal('v-image',row.image); setVal('v-capacity',row.capacity);
    setVal('v-url',row.url); setVal('v-address',row.address);
    setVal('v-lat',row.lat); setVal('v-lng',row.lng);
    setVal('v-instagram',row.instagram); setVal('v-desc',row.desc);
    setVal('v-imagePosition',row.imagePosition || '');
    setSelectedGenres('v-genre',(row.genre||'').split(',').map(s=>s.trim()).filter(Boolean));
    updateLocationMap('v');
    syncImagePos('v');
    if(row.image) showCurrentImage('preview-v-image',row.image,"clearImageField('v',{section:'venue'})");
  }
  else if(section==='festival'){
    setVal('f-id',row.id); setVal('f-type',row.type||'festival');
    setVal('f-name',row.name); setVal('f-city',row.city);
    setVal('f-location',row.location); setVal('f-url',row.url);
    setVal('f-location_ja',row.location_ja);
    setVal('f-ticketUrl',row.ticketUrl); setVal('f-instagram',row.instagram); setVal('f-address',row.address);
    setVal('f-lat',row.lat); setVal('f-lng',row.lng);
    setVal('f-image',row.image); setVal('f-flyer',row.flyer);
    setVal('f-heroGradient',row.heroGradient); setVal('f-desc',row.desc);
    setVal('f-imagePosition',row.imagePosition || '');
    const dates=fmtDate(row.date||'').split('/');  // date型/Date.toString混在を YYYY-MM-DD に正規化（input[type=date]が空になるのを防ぐ）
    setVal('f-dateStart',dates[0]); setVal('f-dateEnd',dates[1]);
    setSelectedGenres('f-genre',(row.genre||'').split(',').map(s=>s.trim()).filter(Boolean));
    lineups.f=(row.lineup||'').split(',').map(s=>s.trim()).filter(Boolean);
    renderLineupTags('f');
    // EDITIONS（シートにはJSON文字列で保存されている）
    editions.length=0;
    if(row.editions){
      try{
        const eds=typeof row.editions==='string'?JSON.parse(row.editions):row.editions;
        if(Array.isArray(eds)) eds.forEach(ed=>editions.push({year:ed.year||'',date:ed.date||'',lineup:Array.isArray(ed.lineup)?ed.lineup:[]}));
      }catch(e){console.warn('editions parse failed',e);}
    }
    renderEditions();
    document.getElementById('lineup-fetch-status').style.display='none';
    document.getElementById('bulk-lineup-wrap').style.display='none';
    document.getElementById('gradient-preview').style.display='none';
    if(row.heroGradient) updateGradientPreview(row.heroGradient);
    updateLocationMap('f');
    syncImagePos('f');
    if(row.image) showCurrentImage('preview-f-image',row.image,"clearImageField('f',{section:'festival',pathId:'f-image',previewId:'preview-f-image'})");
    if(row.flyer) showCurrentImage('preview-f-flyer',row.flyer,"clearImageField('f',{section:'festival',pathId:'f-flyer',previewId:'preview-f-flyer'})");
  }
  else if(section==='artist'){
    setVal('a-id',row.id); setVal('a-name',row.name); setVal('a-city',row.city);
    setVal('a-country',row.country); setVal('a-genre',row.genre);
    setVal('a-image',row.image); setVal('a-bio',row.bio);
    setVal('a-imagePosition',row.imagePosition || '');
    setVal('a-instagram',row.instagram); setVal('a-soundcloud',row.soundcloud);
    setVal('a-bandcamp',row.bandcamp); setVal('a-website',row.website);
    if(typeof syncArtistImagePos==='function') syncArtistImagePos();
    if(row.image) showCurrentImage('preview-a-image',row.image,"clearImageField('a',{section:'artist'})");
  }
  else if(section==='event'){
    setVal('e-name',row.name); setVal('e-date',row.date);
    setVal('e-venue',row.venue); setVal('e-city',row.city);
    setVal('e-time',row.time); setVal('e-desc',row.desc);
    setVal('e-link',row.link);
    lineups.e=(row.lineup||'').split(',').map(s=>s.trim()).filter(Boolean);
    renderLineupTags('e');
  }
  else if(section==='article'){
    setVal('ar-id',row.id); setVal('ar-title',row.title);
    setVal('ar-category',row.category||'REPORT'); setVal('ar-date',fmtDate(row.date));
    setVal('ar-cardRatio',row.cardRatio||''); setVal('ar-heroRatio',row.heroRatio||'');
    festPickerSetValue(row.festivalId||'');
    setVal('ar-title_en',row.title_en||''); setVal('ar-excerpt_en',row.excerpt_en||''); setVal('ar-body_en',row.body_en||'');
    setVal('ar-author',row.author||'TECHNO JAPAN');
    setVal('ar-image',row.image); setVal('ar-readTime',row.readTime);
    setVal('ar-views',row.views); setVal('ar-featured',String(row.featured==='true'||row.featured===true));
    setVal('ar-status',row.status||'published');
    setVal('ar-excerpt',row.excerpt);
    setArticleBody(row.body || '');
    setVal('ar-tags',Array.isArray(row.tags)?row.tags.join(', '):(row.tags||''));
    // 既存編集時は ID/readTime の自動上書きを抑制
    document.getElementById('ar-id').dataset.userEdited = '1';
    document.getElementById('ar-readTime').dataset.userEdited = row.readTime ? '1' : '';
    if(row.image) showCurrentImage('preview-ar-image',row.image,"clearImageField('ar',{section:'article'})");
  }
  else if(section==='author'){
    setVal('au-id',row.id); setVal('au-name',row.name); setVal('au-bio',row.bio);
    setVal('au-image',row.image); setVal('au-instagram',row.instagram);
    setVal('au-twitter',row.twitter); setVal('au-website',row.website);
  }

  // Publishing fields をセット（author以外）
  if(section !== 'author') setPubFields(section, row);

  document.getElementById(section+'-edit-name').textContent=row.name||row.title||row.id||'';
  document.getElementById(section+'-edit-banner').classList.add('show');
  document.getElementById(section+'-btn-new').style.display='none';
  switchTab(section,'form',{fromEdit:true});
  document.querySelector('.main').scrollTo(0,0);
}

/* ==============================================================
   SAVE EDIT
   ============================================================== */
function saveEdit(section){
  const state=editState[section];
  if(!state)return;
  if (section === 'article' && window.articleImageUploading) {
    // アップロードが本当に進行中の時だけブロック。fetch がハングして
    // フラグが固まると保存が永久に不能になるため、45秒超は stale とみなして解除。
    if (Date.now() - (window.articleImageUploadStartedAt || 0) < 45000) {
      return toast('画像アップロード中...完了してから保存してください', 'error');
    }
    window.articleImageUploading = false;
  }
  if (section === 'article') flushArticleEditorSync();
  const payload={action:'update_row',sheet:SHEET_MAP[section],row:state._row};

  if(section==='venue'){
    Object.assign(payload,{id:g('v-id'),name:g('v-name'),city:g('v-city'),area:g('v-area'),
      type:g('v-type'),image:g('v-image'),imagePosition:g('v-imagePosition'),genre:getSelectedGenres('v-genre').join(', '),
      capacity:g('v-capacity'),address:g('v-address'),lat:g('v-lat'),lng:g('v-lng'),
      url:g('v-url'),instagram:g('v-instagram'),desc:g('v-desc')});
  }
  else if(section==='festival'){
    const ds=g('f-dateStart'),de=g('f-dateEnd');
    Object.assign(payload,{id:g('f-id'),type:g('f-type'),name:g('f-name'),city:g('f-city'),
      location:g('f-location'),location_ja:g('f-location_ja'),url:g('f-url'),ticketUrl:g('f-ticketUrl'),instagram:g('f-instagram'),
      address:g('f-address'),lat:g('f-lat'),lng:g('f-lng'),
      date:ds&&de?ds+'/'+de:ds,genre:getSelectedGenres('f-genre').join(', '),
      image:g('f-image'),imagePosition:g('f-imagePosition'),flyer:g('f-flyer'),heroGradient:g('f-heroGradient'),
      desc:g('f-desc'),lineup:cleanLineup(lineups.f).join(', '),
      editions:editions.filter(e=>e.year).map(e=>({...e}))});
  }
  else if(section==='artist'){
    Object.assign(payload,{id:g('a-id'),name:g('a-name'),city:g('a-city'),country:g('a-country'),
      genre:g('a-genre'),image:g('a-image'),imagePosition:g('a-imagePosition'),bio:g('a-bio'),
      instagram:g('a-instagram'),soundcloud:g('a-soundcloud'),
      bandcamp:g('a-bandcamp'),website:g('a-website')});
  }
  else if(section==='event'){
    Object.assign(payload,{name:g('e-name'),date:g('e-date'),venue:g('e-venue'),
      city:g('e-city'),time:g('e-time'),desc:g('e-desc'),
      lineup:lineups.e.join(', '),link:g('e-link')});
  }
  else if(section==='article'){
    Object.assign(payload,{id:g('ar-id'),title:g('ar-title'),category:g('ar-category'),
      date:g('ar-date'),author:g('ar-author'),image:g('ar-image'),readTime:g('ar-readTime'),
      cardRatio:g('ar-cardRatio'),heroRatio:g('ar-heroRatio'),festivalId:g('ar-festivalId'),
      title_en:g('ar-title_en'),excerpt_en:g('ar-excerpt_en'),body_en:g('ar-body_en'),
      views:g('ar-views'),featured:g('ar-featured'),excerpt:g('ar-excerpt'),
      body:g('ar-body'),tags:g('ar-tags'),status:g('ar-status')});
    if(!payload.date) payload.date = new Date().toISOString().slice(0,10); // DATE空のまま保存すると記事詳細が壊れるため
  }
  else if(section==='author'){
    Object.assign(payload,{id:g('au-id'),name:g('au-name'),bio:g('au-bio'),
      image:g('au-image'),instagram:g('au-instagram'),twitter:g('au-twitter'),website:g('au-website')});
  }
  // Publishing fields をマージ（author以外）
  if(section !== 'author') Object.assign(payload, getPubFields(section));

  const unregisteredArtists=(section==='festival')
    ? lineups.f.filter(a=>a.startsWith('?')).map(a=>a.substring(1))
    : [];

  // ---- 楽観的UI: GAS応答を待たずにリストへ即反映 ----
  const rowNum = state._row;
  applyOptimisticUpdate(section, rowNum, payload);
  clearFormDirty();
  if (section === 'article') { clearArticleDraft(); if (typeof festPickerClear === 'function') festPickerClear(); }
  cancelEdit(section);
  switchTab(section,'list');
  rerenderListFromCache(section);
  toast('保存中...','info');

  fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)})
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok'||d.success){
        toast('Updated ✓','success');
        if(unregisteredArtists.length){autoRegisterArtists(unregisteredArtists);invalidateSheetCache('artist');}
        // 裏で正データに置き換え（画面はすでに更新済みなので silent）
        loadList(section, {force:true, silent:true});
      } else {
        toast('保存失敗: '+(d.message||'')+' — リストを再読込します','error');
        invalidateSheetCache(section);
        loadList(section, {force:true});
      }
    }).catch(()=>{
      toast('通信エラー — リストを再読込します','error');
      invalidateSheetCache(section);
      loadList(section, {force:true});
    });
}

/* 楽観的更新: listCache の該当行にフォーム値をマージして即描画 */
function applyOptimisticUpdate(section, rowNum, payload){
  const rows = listCache[section];
  if(!rows) return;
  const idx = rows.findIndex(r => r._row === rowNum);
  if(idx < 0) return;
  const {action, sheet, row, ...fields} = payload;
  rows[idx] = {...rows[idx], ...fields};
  writeSheetCache(section, rows);
}

const LIST_FILTER_FNS = {
  venue: () => filterVenueList(),
  festival: () => filterFestivalList(),
  artist: () => filterArtistList(),
  event: () => filterEventList(),
  article: () => filterArticleList(),
  author: () => filterAuthorList(),
};
function rerenderListFromCache(section){
  const fn = LIST_FILTER_FNS[section];
  if(fn && listCache[section]) fn();
}

/* ==============================================================
   CANCEL EDIT
   ============================================================== */
function cancelEdit(section){
  editState[section]=null;
  document.getElementById(section+'-edit-banner').classList.remove('show');
  document.getElementById(section+'-btn-new').style.display='';
  resetForm(section);
}

/* ==============================================================
   DELETE
   ============================================================== */
let pendingDelete=null;
function confirmDelete(section,rowNum,name){
  pendingDelete={section,rowNum};
  document.getElementById('confirmTitle').textContent='DELETE';
  document.getElementById('confirmMsg').textContent='"'+name+'" will be permanently deleted. This cannot be undone.';
  document.getElementById('confirmOk').onclick=executeDelete;
  document.getElementById('confirmDialog').classList.add('show');
}
function closeConfirm(){document.getElementById('confirmDialog').classList.remove('show');pendingDelete=null}
function executeDelete(){
  if(!pendingDelete)return;
  const{section,rowNum}=pendingDelete;
  // 削除前に行データを保存（Undoで復元できるように）
  const row = listCache[section]?.find(r => r._row === rowNum);
  closeConfirm();
  toast('Deleting...','info');
  fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'delete_row',sheet:SHEET_MAP[section],row:rowNum})})
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok'||d.success){
        if(row) saveDeletedItem(section, row);
        toast('Deleted — undo via "Trash" in sidebar','success');
        renderTrashCount();
        invalidateSheetCache(section);
        loadList(section, {force:true});
      } else toast('Delete failed: '+(d.message||''),'error');
    }).catch(()=>toast('Delete error','error'));
}

/* ==============================================================
   FIND & REPLACE / BULK EDIT
   ============================================================== */
function openFindReplace(){
  const overlay=document.createElement('div');
  overlay.className='dialog-overlay show';
  overlay.style.zIndex=700;
  overlay.innerHTML=`<div class="dialog-box" style="max-width:560px">
    <h3>🔍 Find & Replace</h3>
    <p style="color:var(--text2);font-size:.85rem;margin-bottom:14px">全シートを横断して文字列を検索・置換します。</p>
    <div class="form-group">
      <label style="display:block;font-size:.7rem;color:var(--text3);margin-bottom:4px">Find</label>
      <input type="text" id="fr-find" placeholder="検索する文字列" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
    </div>
    <div class="form-group" style="margin-top:8px">
      <label style="display:block;font-size:.7rem;color:var(--text3);margin-bottom:4px">Replace with (空なら検索のみ)</label>
      <input type="text" id="fr-replace" placeholder="置換後の文字列" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
    </div>
    <div class="form-group" style="margin-top:8px">
      <label style="display:block;font-size:.7rem;color:var(--text3);margin-bottom:4px">Section</label>
      <select id="fr-section" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
        <option value="all">All Sections</option>
        <option value="venue">Venues</option>
        <option value="festival">Festivals</option>
        <option value="artist">Artists</option>
        <option value="event">Events</option>
        <option value="article">Articles</option>
      </select>
    </div>
    <div class="form-group" style="margin-top:8px">
      <label><input type="checkbox" id="fr-case"> Case sensitive</label>
    </div>
    <div id="fr-results" style="margin-top:12px;max-height:240px;overflow-y:auto;font-size:.8rem"></div>
    <div class="btn-row" style="margin-top:16px;justify-content:flex-end">
      <button class="btn btn-sm" onclick="this.closest('.dialog-overlay').remove()">Close</button>
      <button class="btn btn-sm btn-blue" onclick="findReplaceSearch()">Find</button>
      <button class="btn btn-sm btn-yellow" onclick="findReplaceExecute()">Replace All</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}
async function findReplaceSearch(){
  const find=document.getElementById('fr-find').value;
  if(!find) return toast('Enter search text','error');
  const sectionSel=document.getElementById('fr-section').value;
  const caseSensitive=document.getElementById('fr-case').checked;
  const sections=sectionSel==='all'?['venue','festival','artist','event','article']:[sectionSel];
  document.getElementById('fr-results').innerHTML='<div style="color:var(--text3)">Searching...</div>';
  // load all needed lists
  await Promise.all(sections.map(s=>!listCache[s] && new Promise(res=>{
    fetch(GAS_URL+'?action=get_sheet&sheet='+SHEET_MAP[s]).then(r=>r.json()).then(d=>{
      if(d.status==='ok')listCache[s]=d.rows||[];
      res();
    }).catch(()=>res());
  })));
  const results=[];
  sections.forEach(sec=>{
    (listCache[sec]||[]).forEach(row=>{
      Object.entries(row).forEach(([k,v])=>{
        if(k.startsWith('_'))return;
        const str=String(v||'');
        const target=caseSensitive?str:str.toLowerCase();
        const needle=caseSensitive?find:find.toLowerCase();
        if(target.includes(needle)){
          results.push({section:sec,row,field:k,value:str});
        }
      });
    });
  });
  const c=document.getElementById('fr-results');
  if(!results.length){c.innerHTML='<div style="color:var(--text3)">No matches</div>';return;}
  c.innerHTML='<div style="margin-bottom:8px;color:var(--text2)">'+results.length+' matches found in '+(new Set(results.map(r=>r.section+r.row.id))).size+' items</div>'+
    results.slice(0,30).map(r=>{
      const label=r.row.name||r.row.title||r.row.id;
      const snippet=r.value.length>80?r.value.substring(0,80)+'…':r.value;
      return '<div style="padding:6px;border-bottom:1px solid var(--border);font-size:.75rem"><strong>'+esc(r.section)+'</strong> · <em style="color:var(--text2)">'+esc(label)+'</em> · '+esc(r.field)+': <span style="color:var(--text3)">'+esc(snippet)+'</span></div>';
    }).join('') + (results.length>30?'<div style="padding:8px;color:var(--text3)">...and '+(results.length-30)+' more</div>':'');
  window._frResults=results;
}
async function findReplaceExecute(){
  if(!window._frResults){toast('Search first','error');return findReplaceSearch();}
  const find=document.getElementById('fr-find').value;
  const replace=document.getElementById('fr-replace').value;
  const caseSensitive=document.getElementById('fr-case').checked;
  if(!find) return toast('Enter search text','error');
  if(!confirm(`置換を実行しますか?\n${window._frResults.length}件 を "${find}" → "${replace}" に置換します。`)) return;
  // 行ごとにグループ化して update_row 呼び出し
  const byRow={};
  window._frResults.forEach(r=>{
    const key=r.section+'_'+r.row._row;
    if(!byRow[key])byRow[key]={section:r.section,row:{...r.row}};
    const val=String(byRow[key].row[r.field]||'');
    const re=caseSensitive?new RegExp(escRegExp(find),'g'):new RegExp(escRegExp(find),'gi');
    byRow[key].row[r.field]=val.replace(re, replace);
  });
  toast('Updating '+Object.keys(byRow).length+' items...','info');
  let done=0,errors=0;
  for(const k of Object.keys(byRow)){
    const {section,row}=byRow[k];
    const payload={action:'update_row',sheet:SHEET_MAP[section],row:row._row,...row};
    delete payload._row;
    try {
      const r=await fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)}).then(r=>r.json());
      if(r.status==='ok'||r.success)done++; else errors++;
    } catch(e){errors++}
  }
  toast(`Replaced: ${done} succeeded, ${errors} failed`,errors?'error':'success');
  window._frResults=null;
  // 全シートのキャッシュクリア
  ['venue','festival','artist','event','article'].forEach(s=>{listCache[s]=null});
}
function escRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

/* ==============================================================
   BULK ASSIST — 一括補助（空欄のみ・確認/進捗/中断）
   既存の aiGenerate(GAS) / geocode(Google) / update_row を再利用。
   既存値は絶対に上書きしない（空欄のみ対象）。
   ============================================================== */
let bulkCancel = false;
let bulkData = null; // { artist:[], festival:[], venue:[] } (rows with _row)

function openBulkAssist(){
  bulkCancel = false;
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay show';
  overlay.id = 'bulk-overlay';
  overlay.style.zIndex = 700;
  overlay.innerHTML = `<div class="dialog-box" style="max-width:600px">
    <h3>⚡ 一括補助 — BULK ASSIST</h3>
    <p style="color:var(--text2);font-size:.85rem;margin-bottom:12px">空欄だけを AI 生成・ジオコーディングで埋めます（<strong>既存値は上書きしません</strong>）。まず「スキャン」で不足件数を確認してください。</p>
    <button class="btn btn-sm btn-blue" onclick="bulkScan()">🔍 スキャン</button>
    <div id="bulk-report" style="margin-top:14px;font-size:.82rem"></div>
    <div id="bulk-progress" style="margin-top:12px;font-family:var(--font-mono);font-size:.78rem;color:var(--text2);white-space:pre-line"></div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-sm" id="bulk-cancel-btn" onclick="bulkCancel=true" style="display:none">中断</button>
      <button class="btn btn-sm" onclick="document.getElementById('bulk-overlay').remove()">閉じる</button>
    </div>
  </div>`;
  overlay.addEventListener('click', e=>{ if(e.target===overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function bulkScan(){
  const rep = document.getElementById('bulk-report');
  rep.textContent = 'スキャン中...';
  fetchAllSheets(['ARTISTS','FESTIVALS','VENUES']).then(d=>{
    bulkData = {
      artist:   (d.ARTISTS||[]).map(r=>({...r})),
      festival: (d.FESTIVALS||[]).map(r=>({...r})),
      venue:    (d.VENUES||[]).map(r=>({...r})),
    };
    const missBio  = bulkData.artist.filter(r=>r.name && !r.bio).length;
    const missFD   = bulkData.festival.filter(r=>r.name && !r.desc).length;
    const missVD   = bulkData.venue.filter(r=>r.name && !r.desc).length;
    const geoF     = bulkData.festival.filter(r=>r.address && (!r.lat || !r.lng)).length;
    const geoV     = bulkData.venue.filter(r=>r.address && (!r.lat || !r.lng)).length;
    const line = (label, n, fn) => n
      ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)"><span>${label}: <strong>${n}</strong>件</span><button class="btn btn-sm btn-accent" onclick="${fn}">実行</button></div>`
      : `<div style="padding:8px 0;border-bottom:1px solid var(--border);opacity:.45">${label}: 0件 ✓</div>`;
    const gap = (label, rows, section, id) => rows.length
      ? `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="var l=document.getElementById('${id}');l.style.display=l.style.display==='none'?'block':'none'">
            <span>${label}: <strong>${rows.length}</strong>件</span><span style="opacity:.5;font-size:.7rem">▸ 一覧</span></div>
          <div id="${id}" style="display:none;margin-top:6px;max-height:200px;overflow-y:auto">${
            rows.map(r=>`<div style="display:flex;justify-content:space-between;padding:3px 0 3px 10px;font-size:.78rem"><span>${esc(r.name||r.id)}</span><a style="cursor:pointer;color:var(--text2);text-decoration:underline" onclick="bulkJumpEdit('${section}',${r._row})">編集</a></div>`).join('')
          }</div></div>`
      : `<div style="padding:6px 0;border-bottom:1px solid var(--border);opacity:.45">${label}: 0件 ✓</div>`;

    rep.innerHTML =
      `<div style="font-size:.7rem;letter-spacing:.1em;opacity:.5;margin-bottom:4px">AI 生成（空欄のみ・自動）</div>` +
      line('アーティスト BIO', missBio, "bulkAiRun('artist','bio')") +
      line('フェス 説明', missFD, "bulkAiRun('festival','desc')") +
      line('ヴェニュー 説明', missVD, "bulkAiRun('venue','desc')") +
      `<div style="font-size:.7rem;letter-spacing:.1em;opacity:.5;margin:14px 0 4px">ジオコーディング（住所あり・座標なし・自動）</div>` +
      line('フェス 座標', geoF, "bulkGeoRun('festival')") +
      line('ヴェニュー 座標', geoV, "bulkGeoRun('venue')") +
      `<div style="font-size:.7rem;letter-spacing:.1em;opacity:.5;margin:14px 0 4px">手動入力が必要（一覧→編集へジャンプ）</div>` +
      gap('アーティスト 画像なし', bulkData.artist.filter(r=>r.name && !r.image), 'artist', 'gap-a-img') +
      gap('フェス 画像なし', bulkData.festival.filter(r=>r.name && !r.image), 'festival', 'gap-f-img') +
      gap('フェス フライヤーなし', bulkData.festival.filter(r=>r.name && !r.flyer), 'festival', 'gap-f-fly') +
      gap('フェス ラインナップなし', bulkData.festival.filter(r=>r.name && !r.lineup), 'festival', 'gap-f-lu') +
      gap('フェス 公式URLなし', bulkData.festival.filter(r=>r.name && !r.url), 'festival', 'gap-f-url');
  }).catch(e=>{ rep.innerHTML = '<span style="color:var(--accent)">取得失敗: '+esc(e.message)+'（ログイン状態を確認）</span>'; });
}

// Bulk Assist から特定アイテムの編集画面へジャンプ（既存 editRow を再利用）
function bulkJumpEdit(section, rowNum){
  document.getElementById('bulk-overlay')?.remove();
  document.querySelectorAll('.sidebar nav button').forEach(b=>{ if(b.textContent.toLowerCase().includes(section)) b.click(); });
  setTimeout(()=>{ try { editRow(section, rowNum); } catch(e){ toast('編集画面を開けませんでした','error'); } }, 300);
}

/* ==============================================================
   BULK IMPORT — 一括登録/インポート
   ① CSV/一覧で一括追加（draft）  ② 開催回の複製  ③ 画像URL一括アップロード
   既存の add_*（QUICK_ADD_DEFS）/ upload_from_url / update_row を再利用。
   すべて確認・進捗・中断つき。追加は draft、重複IDはスキップ。
   ============================================================== */
let biCancel = false;
const biProg = msg => { const el=document.getElementById('bi-progress'); if(el) el.textContent = msg; };
const biField = 'font-family:var(--font-mono);font-size:.8rem;width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)';

function openBulkImport(){
  biCancel = false;
  const ov = document.createElement('div');
  ov.className = 'dialog-overlay show'; ov.id = 'bi-overlay'; ov.style.zIndex = 700;
  ov.innerHTML = `<div class="dialog-box" style="max-width:640px;max-height:88vh;overflow-y:auto">
    <h3>⬆ 一括登録 / インポート</h3>

    <div style="margin-top:14px;padding:12px;background:var(--bg3);border-radius:var(--radius)">
      <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">① CSV / 一覧で一括追加（draft）</div>
      <select id="bi-csv-sec" style="${biField};margin-bottom:6px">
        <option value="artist">Artists — name, city, genre</option>
        <option value="festival">Festivals — name, city, dateStart, dateEnd</option>
        <option value="venue">Venues — name, city, area</option>
      </select>
      <textarea id="bi-csv" rows="4" placeholder="1行1件。カンマ区切り。例:&#10;DJ Nobu, CHIBA, TECHNO&#10;Wata Igarashi, TOKYO, TECHNO" style="${biField};resize:vertical"></textarea>
      <div style="margin-top:6px;display:flex;gap:8px"><button class="btn btn-sm btn-blue" onclick="biCsvPreview()">プレビュー</button></div>
      <div id="bi-csv-report" style="margin-top:8px;font-size:.78rem"></div>
    </div>

    <div style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:var(--radius)">
      <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">② 開催回の複製（フェス → 翌年の下書き）</div>
      <select id="bi-dup-fest" style="${biField};margin-bottom:6px"><option value="">読み込み中...</option></select>
      <div style="display:flex;gap:6px;margin-bottom:6px">
        <input id="bi-dup-id" placeholder="新ID (例: rural-2027)" style="${biField}">
        <input id="bi-dup-ds" type="date" style="${biField}">
        <input id="bi-dup-de" type="date" style="${biField}">
      </div>
      <button class="btn btn-sm btn-accent" onclick="biDuplicate()">複製して下書き作成</button>
    </div>

    <div style="margin-top:12px;padding:12px;background:var(--bg3);border-radius:var(--radius)">
      <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">③ 画像URL 一括アップロード（→ Drive）</div>
      <select id="bi-img-target" style="${biField};margin-bottom:6px">
        <option value="artist-image">アーティスト画像</option>
        <option value="festival-image">フェス画像</option>
        <option value="festival-flyer">フェス フライヤー</option>
      </select>
      <textarea id="bi-img" rows="4" placeholder="1行1件「id, 画像URL」。例:&#10;dj-nobu, https://.../nobu.jpg&#10;wata-igarashi, https://.../wata.jpg" style="${biField};resize:vertical"></textarea>
      <div style="margin-top:6px"><button class="btn btn-sm btn-accent" onclick="biImgRun()">アップロード実行</button></div>
    </div>

    <div id="bi-progress" style="margin-top:12px;font-family:var(--font-mono);font-size:.78rem;color:var(--text2);white-space:pre-line"></div>
    <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-sm" id="bi-cancel-btn" onclick="biCancel=true" style="display:none">中断</button>
      <button class="btn btn-sm" onclick="document.getElementById('bi-overlay').remove()">閉じる</button>
    </div>
  </div>`;
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  document.body.appendChild(ov);
  // フェス複製の候補を読み込み
  fetchAllSheets(['FESTIVALS']).then(d=>{
    const sel = document.getElementById('bi-dup-fest'); if(!sel) return;
    biFestRows = (d.FESTIVALS||[]).map(r=>({...r}));
    sel.innerHTML = '<option value="">フェスを選択...</option>' +
      biFestRows.filter(r=>r.id).map(r=>`<option value="${esc(r.id)}">${esc(r.name||r.id)} (${esc(r.date||'')})</option>`).join('');
  }).catch(()=>{ const sel=document.getElementById('bi-dup-fest'); if(sel) sel.innerHTML='<option value="">取得失敗（ログイン確認）</option>'; });
}
let biFestRows = [];

// ---- ① CSV 一括追加 ----
function biParseCsv(section, text){
  const defFields = { artist:['name','city','genre'], festival:['name','city','dateStart','dateEnd'], venue:['name','city','area'] }[section];
  return text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(line=>{
    const parts = line.split(',').map(s=>s.trim());
    const o = {}; defFields.forEach((f,i)=>{ if(parts[i]) o[f]=parts[i]; });
    o.id = slugify(o.name||'');
    if(section==='festival'){ o.date = o.dateStart && o.dateEnd ? o.dateStart+'/'+o.dateEnd : (o.dateStart||''); }
    return o;
  }).filter(o=>o.name && o.id);
}
function biCsvPreview(){
  const section = document.getElementById('bi-csv-sec').value;
  const rows = biParseCsv(section, document.getElementById('bi-csv').value);
  const rep = document.getElementById('bi-csv-report');
  if(!rows.length){ rep.innerHTML = '<span style="opacity:.5">有効な行がありません</span>'; return; }
  rep.innerHTML = 'ID重複チェック中...';
  const sheetName = section.toUpperCase()+'S';
  fetchAllSheets([sheetName]).catch(()=>({})).then(d=>{
    const existing = new Set(((d&&d[sheetName])||[]).map(r=>r.id));
    let dup=0;
    const list = rows.map(r=>{ const isDup=existing.has(r.id); if(isDup)dup++; return `<div style="display:flex;justify-content:space-between;padding:2px 0;${isDup?'opacity:.4':''}"><span>${esc(r.name)} → <code>${esc(r.id)}</code></span>${isDup?'<span style="color:var(--accent);font-size:.7rem">既存・スキップ</span>':''}</div>`; }).join('');
    const addN = rows.length - dup;
    rep.innerHTML = `<div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:8px">${list}</div>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center"><span>${addN}件を追加（draft）／${dup}件スキップ</span>${addN?`<button class="btn btn-sm btn-accent" onclick='biCsvRun(${JSON.stringify(section)})'>${addN}件を追加</button>`:''}</div>`;
    window._biCsvRows = rows; window._biCsvExisting = existing;
  });
}
async function biCsvRun(section){
  const rows = (window._biCsvRows||[]).filter(r=>!window._biCsvExisting.has(r.id));
  if(!rows.length) return;
  if(!confirm(`${rows.length}件を draft として追加します。続行しますか?`)) return;
  biCancel=false; document.getElementById('bi-cancel-btn').style.display='';
  const action = QUICK_ADD_DEFS[section].action;
  let done=0, fail=0;
  for(const r of rows){
    if(biCancel) break;
    biProg(`追加中... ${done+fail+1}/${rows.length}\n${r.name}`);
    try {
      const {dateStart, dateEnd, ...vals} = r;
      const res = await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action, ...vals, status:'draft'})}).then(x=>x.json());
      (res.success||res.status==='ok') ? done++ : fail++;
    } catch(e){ fail++; }
    await new Promise(r=>setTimeout(r,600));
  }
  document.getElementById('bi-cancel-btn').style.display='none';
  biProg(`${biCancel?'中断':'完了'}: ${done}件追加 / ${fail}件失敗`);
  invalidateSheetCache(section);
}

// ---- ② 開催回の複製 ----
async function biDuplicate(){
  const fid = document.getElementById('bi-dup-fest').value;
  const newId = document.getElementById('bi-dup-id').value.trim();
  const ds = document.getElementById('bi-dup-ds').value, de = document.getElementById('bi-dup-de').value;
  if(!fid) return toast('複製元フェスを選択してください','error');
  if(!newId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newId)) return toast('新IDを正しい形式で入力（例: rural-2027）','error');
  if((listCache.festival||[]).some(r=>r.id===newId) || biFestRows.some(r=>r.id===newId)) return toast('そのIDは既に存在します','error');
  const src = biFestRows.find(r=>r.id===fid);
  if(!src) return toast('複製元が見つかりません','error');
  if(!confirm(`「${src.name}」を複製して下書き（${newId}）を作成します。ラインナップ等もコピーされます。続行?`)) return;
  const {_row, ...fields} = src;
  const payload = { action: QUICK_ADD_DEFS.festival.action, ...fields, id:newId, status:'draft',
    date: (ds && de) ? ds+'/'+de : (ds || fields.date || '') };
  biProg('複製中...');
  try {
    const res = await fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)}).then(x=>x.json());
    if(res.success||res.status==='ok'){ biProg('✓ 下書きを作成しました: '+newId); invalidateSheetCache('festival'); toast('複製しました (draft)','success'); }
    else biProg('失敗: '+(res.message||res.error||''));
  } catch(e){ biProg('通信エラー: '+e.message); }
}

// ---- ③ 画像URL 一括アップロード ----
async function biImgRun(){
  const target = document.getElementById('bi-img-target').value; // artist-image / festival-image / festival-flyer
  const section = target.startsWith('artist') ? 'artist' : 'festival';
  const field = target.endsWith('flyer') ? 'flyer' : 'image';
  const pairs = document.getElementById('bi-img').value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
    .map(l=>{ const i=l.indexOf(','); return i<0?null:{ id:l.slice(0,i).trim(), url:l.slice(i+1).trim() }; })
    .filter(p=>p && p.id && /^https?:/.test(p.url));
  if(!pairs.length) return toast('「id, 画像URL」を1行ずつ入力してください','error');
  const d = await fetchAllSheets([section.toUpperCase()+'S']).catch(()=>({}));
  const rows = (d[section.toUpperCase()+'S'] || listCache[section] || []);
  const byId = new Map(rows.map(r=>[r.id, r]));
  const valid = pairs.filter(p=>byId.has(p.id));
  const missing = pairs.filter(p=>!byId.has(p.id)).map(p=>p.id);
  if(!valid.length) return toast('該当IDが見つかりません: '+missing.join(', '),'error');
  if(!confirm(`${valid.length}件の画像を Drive にアップロードし、${field} を設定します。${missing.length?'\n（ID不明でスキップ: '+missing.join(', ')+'）':''}\n続行しますか?`)) return;
  biCancel=false; document.getElementById('bi-cancel-btn').style.display='';
  let done=0, fail=0, fellBack=[];
  for(const p of valid){
    if(biCancel) break;
    biProg(`アップロード中... ${done+fail+1}/${valid.length}\n${p.id}`);
    try {
      // まずブラウザ側で圧縮（1920px/webp）。CORS等で不可なら原寸の upload_from_url へ。
      let path=null;
      const c = await compressUrlAndUpload(p.url, target, p.id);
      if(c){ path=c.path; }
      else {
        const up = await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'upload_from_url', imageUrl:p.url, type:target, id:p.id})}).then(x=>x.json());
        // webp 化されず原寸で入った分は、同期時に変換されるまでサイトに出ない。
        // 黙って done に混ぜると気づけないので ID を控えて最後に出す。
        if(up.success && up.path){ path=up.path; fellBack.push(p.id); }
      }
      if(path){
        const row = {...byId.get(p.id)}; row[field] = path;
        await bulkSaveRow(section, row); done++;
      } else fail++;
    } catch(e){ fail++; }
    await new Promise(r=>setTimeout(r,800));
  }
  document.getElementById('bi-cancel-btn').style.display='none';
  biProg(`${biCancel?'中断':'完了'}: ${done}件設定 / ${fail}件失敗`
    + (fellBack.length ? `\n⚠ ${fellBack.length}件は原寸のままです。画像同期ボタンを押すとwebpへ変換されます: ${fellBack.join(', ')}` : ''));
  if(fellBack.length) toast(`${fellBack.length}件は原寸のままアップロード — 反映は同期後`,'warning');
  invalidateSheetCache(section);
}

async function bulkSaveRow(section, row){
  const payload = { action:'update_row', sheet:SHEET_MAP[section], row:row._row, ...row };
  delete payload._row;
  const r = await fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)}).then(r=>r.json());
  if(!(r.status==='ok'||r.success)) throw new Error(r.message||'save failed');
}
const bulkProg = msg => { const el=document.getElementById('bulk-progress'); if(el) el.textContent = msg; };

async function bulkAiRun(section, field){
  if(!bulkData) return;
  const rows = bulkData[section].filter(r=>r.name && !r[field]);
  if(!rows.length) return;
  if(!confirm(`${rows.length}件に AI 生成を実行し、スプレッドシートに保存します。\nAI を ${rows.length} 回呼び出します（時間・コストがかかります）。\n空欄のみ対象・既存値は変更しません。続行しますか?`)) return;
  bulkCancel = false;
  document.getElementById('bulk-cancel-btn').style.display='';
  let done=0, fail=0;
  for(const row of rows){
    if(bulkCancel){ break; }
    bulkProg(`AI生成中... ${done+fail+1}/${rows.length}\n${row.name}`);
    try {
      const body = { action:'aiGenerate', section, name:row.name, city:row.city||'',
        context: section==='artist'   ? ('genre: '+(row.genre||'')+', country: '+(row.country||''))
               : section==='festival' ? ('location: '+(row.location||'')+', type: '+(row.type||''))
               :                        ('capacity: '+(row.capacity||'')+', type: '+(row.type||'')),
        url: row.url || row.website || '', instagram: row.instagram || '' };
      const d = await fetch(GAS_URL,{method:'POST',body:JSON.stringify(body)}).then(r=>r.json());
      const val = d && (d.bio || d.desc);
      if(d && d.success && val){ row[field]=val; await bulkSaveRow(section,row); done++; }
      else fail++;
    } catch(e){ fail++; }
    await new Promise(r=>setTimeout(r,1200)); // レート制限対策
  }
  document.getElementById('bulk-cancel-btn').style.display='none';
  bulkProg(`${bulkCancel?'中断':'完了'}: ${done}件生成 / ${fail}件失敗`);
  ['venue','festival','artist','event','article'].forEach(s=>{listCache[s]=null;});
}

async function bulkGeoRun(section){
  if(!bulkData) return;
  const rows = bulkData[section].filter(r=>r.address && (!r.lat || !r.lng));
  if(!rows.length) return;
  if(!confirm(`${rows.length}件をジオコーディングし、スプレッドシートに保存します。\n住所から座標を取得し、座標が空の行のみ埋めます。続行しますか?`)) return;
  bulkCancel = false;
  document.getElementById('bulk-cancel-btn').style.display='';
  let done=0, fail=0;
  for(const row of rows){
    if(bulkCancel){ break; }
    bulkProg(`ジオコーディング中... ${done+fail+1}/${rows.length}\n${row.name}`);
    try {
      const d = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(row.address)).then(r=>r.json());
      if(Array.isArray(d) && d[0] && d[0].lat && d[0].lon){
        row.lat = parseFloat(d[0].lat).toFixed(4); row.lng = parseFloat(d[0].lon).toFixed(4);
        await bulkSaveRow(section,row); done++;
      } else fail++;
    } catch(e){ fail++; }
    await new Promise(r=>setTimeout(r,1100)); // Nominatim: 1リクエスト/秒 ポリシー順守
  }
  document.getElementById('bulk-cancel-btn').style.display='none';
  bulkProg(`${bulkCancel?'中断':'完了'}: ${done}件座標設定 / ${fail}件失敗`);
  ['venue','festival'].forEach(s=>{listCache[s]=null;});
}

/* ==============================================================
   HOME DASHBOARD
   ============================================================== */
function openHomeDashboard(){
  toast('Loading dashboard...','info');
  fetchAllSheets(['VENUES','FESTIVALS','ARTISTS','EVENTS','ARTICLES']).then(d=>{
    const data={
      artist:d.ARTISTS||[],event:d.EVENTS||[],festival:d.FESTIVALS||[],
      venue:d.VENUES||[],article:d.ARTICLES||[]
    };
    Object.assign(listCache, data);
    renderHomeDashboard(data);
  }).catch(err=>toast('Dashboard error: '+err.message,'error'));
}

/* キャッシュ＋batch 経由で複数シートを取得
   opts.fresh: キャッシュを使わず必ずシートから取り直す（Publish/Export用。
   2026-07-23 のフェス全ページ消失事故の再発防止: 欠落・失敗を握りつぶさない） */
function fetchAllSheets(sheetNames, opts){
  opts = opts || {};
  const SECTION_BY_SHEET = {VENUES:'venue',FESTIVALS:'festival',ARTISTS:'artist',EVENTS:'event',ARTICLES:'article',AUTHORS:'author'};
  const result = {};
  const missing = [];
  sheetNames.forEach(s => {
    const sec = SECTION_BY_SHEET[s];
    const cached = !opts.fresh && sec && readSheetCache(sec);
    if(cached) result[s] = cached;
    else missing.push(s);
  });
  if(!missing.length) return Promise.resolve(result);
  // 不足分は batch エンドポイントで一括取得
  return fetch(GAS_URL+'?action=get_all_sheets&sheets='+missing.join(','))
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok' && d.sheets){
        Object.entries(d.sheets).forEach(([sheet,rows])=>{
          if(!Array.isArray(rows)) return;      // 欠落・不正はresultに入れない（下の検査で検知）
          result[sheet] = rows;
          const sec = SECTION_BY_SHEET[sheet];
          if(sec && rows.length) writeSheetCache(sec, rows); // 空をキャッシュに書かない
        });
        // バッチ応答に要求シートが欠けていたら失敗として扱う（黙って空にしない）
        const lost = missing.filter(s => !Array.isArray(result[s]));
        if(lost.length) throw new Error('シート取得に失敗: ' + lost.join(', '));
      } else {
        // batch エンドポイント未対応の GAS にフォールバック
        return Promise.all(missing.map(s=>
          fetch(GAS_URL+'?action=get_sheet&sheet='+s).then(r=>r.json()).then(d=>{
            if(d.status!=='ok' || !Array.isArray(d.rows)) throw new Error('シート取得に失敗: '+s+' — '+(d.message||'unknown'));
            result[s] = d.rows;
            const sec = SECTION_BY_SHEET[s];
            if(sec && d.rows.length) writeSheetCache(sec, d.rows);
          })
        )).then(()=>result);
      }
      return result;
    });
}
function renderHomeDashboard(data){
  const overlay=document.createElement('div');
  overlay.className='dialog-overlay show';
  overlay.style.zIndex=700;
  // 各セクションのドラフト・低完成度・最近編集集計
  const drafts={};
  const lowQuality={};
  const recent={};
  Object.entries(data).forEach(([section,rows])=>{
    drafts[section]=rows.filter(r=>String(r.status||'').toLowerCase()==='draft');
    lowQuality[section]=rows.map(r=>({r,c:computeCompleteness(section,r)})).filter(x=>x.c.score<70).slice(0,5);
    recent[section]=rows.filter(r=>r.lastEditedAt).sort((a,b)=>String(b.lastEditedAt).localeCompare(String(a.lastEditedAt))).slice(0,3);
  });
  const totalDrafts=Object.values(drafts).reduce((s,a)=>s+a.length,0);
  const totalLow=Object.values(lowQuality).reduce((s,a)=>s+a.length,0);
  const draftHtml=Object.entries(drafts).filter(([_,d])=>d.length).map(([sec,d])=>
    '<div style="margin-bottom:8px"><strong style="font-size:.7rem;font-family:var(--font-mono);letter-spacing:1px;color:var(--text2)">'+sec.toUpperCase()+' ('+d.length+')</strong>'+
    d.slice(0,3).map(r=>'<div style="padding:4px 0 4px 12px;font-size:.8rem"><a style="color:var(--text);cursor:pointer;text-decoration:underline" onclick="closeHomeAndEdit(\''+sec+'\','+r._row+')">'+esc(r.name||r.title||r.id)+'</a></div>').join('')+
    '</div>'
  ).join('') || '<div style="color:var(--text3);font-size:.8rem">No drafts</div>';
  const lowHtml=Object.entries(lowQuality).filter(([_,d])=>d.length).map(([sec,items])=>
    '<div style="margin-bottom:8px"><strong style="font-size:.7rem;font-family:var(--font-mono);letter-spacing:1px;color:var(--text2)">'+sec.toUpperCase()+'</strong>'+
    items.map(({r,c})=>'<div style="padding:4px 0 4px 12px;font-size:.8rem;display:flex;justify-content:space-between"><a style="color:var(--text);cursor:pointer;text-decoration:underline" onclick="closeHomeAndEdit(\''+sec+'\','+r._row+')">'+esc(r.name||r.title||r.id)+'</a><span style="color:var(--accent);font-size:.7rem">'+c.score+'%</span></div>').join('')+
    '</div>'
  ).join('') || '<div style="color:var(--text3);font-size:.8rem">All entries are 70%+ complete 🎉</div>';
  overlay.innerHTML=`<div class="dialog-box" style="max-width:760px;max-height:85vh;overflow-y:auto" id="home-dashboard">
    <h3>🏠 Welcome back, editor</h3>
    <p style="color:var(--text2);margin-bottom:20px">Today's editorial overview</p>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px">
      ${Object.entries(data).map(([sec,rows])=>`<div style="text-align:center;background:var(--bg3);padding:12px;border-radius:var(--radius)"><div style="font-family:var(--font-display);font-size:1.6rem">${rows.length}</div><div style="font-family:var(--font-mono);font-size:.55rem;color:var(--text3);letter-spacing:1px;text-transform:uppercase">${sec}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div style="background:var(--bg3);padding:14px;border-radius:var(--radius);border-left:3px solid #999">
        <h4 style="margin-bottom:10px;font-size:.85rem">📝 Drafts (${totalDrafts})</h4>
        ${draftHtml}
      </div>
      <div style="background:var(--bg3);padding:14px;border-radius:var(--radius);border-left:3px solid var(--yellow)">
        <h4 style="margin-bottom:10px;font-size:.85rem">⚠️ Needs Improvement (${totalLow})</h4>
        ${lowHtml}
      </div>
    </div>
    <div class="btn-row" style="margin-top:20px"><button class="btn" onclick="this.closest('.dialog-overlay').remove()">Close</button></div>
  </div>`;
  document.body.appendChild(overlay);
}
function closeHomeAndEdit(section, rowNum){
  document.getElementById('home-dashboard')?.closest('.dialog-overlay')?.remove();
  const navBtns = document.querySelectorAll('.sidebar nav button');
  navBtns.forEach(b => { if(b.textContent.toLowerCase().includes(section)) b.click(); });
  setTimeout(() => { editRow(section, rowNum); }, 300);
}

/* ==============================================================
   IMAGE LIBRARY
   ============================================================== */
const IMAGE_SYNC_COOLDOWN_KEY = 'cms_image_sync_cooldown_until';
const IMAGE_SYNC_COOLDOWN_MS = 3 * 60 * 1000;
let imageSyncCooldownTimer = null;

function setImageSyncStatus(message, isError){
  const el=document.getElementById('image-sync-status');
  if(!el)return;
  el.textContent=message||'';
  el.style.display=message?'block':'none';
  el.style.color=isError?'#ff6b6b':'var(--yellow)';
}

function refreshImageSyncButton(){
  const btn=document.getElementById('btn-sync-images');
  if(!btn)return;
  if(imageSyncCooldownTimer){clearTimeout(imageSyncCooldownTimer);imageSyncCooldownTimer=null;}
  const until=Number(localStorage.getItem(IMAGE_SYNC_COOLDOWN_KEY)||0);
  const remaining=Math.max(0,until-Date.now());
  if(remaining>0){
    btn.disabled=true;
    btn.textContent='↻ 同期処理中 ('+Math.ceil(remaining/1000)+'秒)';
    imageSyncCooldownTimer=setTimeout(refreshImageSyncButton,1000);
  }else{
    localStorage.removeItem(IMAGE_SYNC_COOLDOWN_KEY);
    btn.disabled=false;
    btn.textContent='↻ 画像を今すぐ同期';
  }
}

async function triggerImageSync(){
  const btn=document.getElementById('btn-sync-images');
  const until=Number(localStorage.getItem(IMAGE_SYNC_COOLDOWN_KEY)||0);
  if(until>Date.now()){
    refreshImageSyncButton();
    return toast('画像同期はすでに開始されています','info');
  }
  if(btn){btn.disabled=true;btn.textContent='↻ 同期を開始中...';}
  setImageSyncStatus('GitHub Actionsへ同期を依頼しています...',false);
  try{
    const d=await fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'trigger_image_sync'})}).then(r=>r.json());
    if(d && (d.status==='ok'||d.success)){
      localStorage.setItem(IMAGE_SYNC_COOLDOWN_KEY,String(Date.now()+IMAGE_SYNC_COOLDOWN_MS));
      setImageSyncStatus('同期を開始しました。通常1〜3分で反映されます。',false);
      toast('同期を開始しました。通常1〜3分で反映されます。','success');
      refreshImageSyncButton();
      return;
    }
    throw new Error((d&&d.message)||'同期を開始できませんでした');
  }catch(e){
    setImageSyncStatus('同期開始エラー: '+e.message,true);
    toast('画像同期を開始できませんでした','error');
    if(btn){btn.disabled=false;btn.textContent='↻ 画像を今すぐ同期';}
  }
}

function openImageLibrary(){
  toast('Loading images...','info');
  Promise.all([
    fetch(GAS_URL+'?action=get_images&type=venues').then(r=>r.json()),
    fetch(GAS_URL+'?action=get_images&type=festivals').then(r=>r.json()),
    fetch(GAS_URL+'?action=get_images&type=artists').then(r=>r.json())
  ]).then(([v,f,a])=>{
    const all=[
      ...((v.images||[]).map(i=>({...i,type:'venues'}))),
      ...((f.images||[]).map(i=>({...i,type:'festivals'}))),
      ...((a.images||[]).map(i=>({...i,type:'artists'})))
    ];
    renderImageLibrary(all);
  }).catch(e=>toast('Image library error: '+e.message,'error'));
}
function renderImageLibrary(images){
  const overlay=document.createElement('div');
  overlay.className='dialog-overlay show';
  overlay.style.zIndex=700;
  overlay.id='img-lib-overlay';
  overlay.innerHTML=`<div class="dialog-box" style="max-width:900px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column">
    <h3>🖼 Image Library (${images.length})</h3>
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <input type="text" id="img-lib-search" placeholder="Filter by name..." oninput="filterImageLibrary()" style="flex:1;min-width:140px;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
      <select id="img-lib-type" onchange="filterImageLibrary()" style="padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text)">
        <option value="all">All Types</option>
        <option value="venues">Venues</option>
        <option value="festivals">Festivals</option>
        <option value="artists">Artists</option>
      </select>
    </div>
    <div id="img-lib-grid" style="overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;padding:8px"></div>
    <div class="btn-row" style="margin-top:12px"><button class="btn btn-sm" onclick="this.closest('.dialog-overlay').remove()">Close</button></div>
  </div>`;
  document.body.appendChild(overlay);
  window._imgLibAll = images;
  filterImageLibrary();
}
function filterImageLibrary(){
  const all=window._imgLibAll||[];
  const q=(document.getElementById('img-lib-search')?.value||'').toLowerCase();
  const type=document.getElementById('img-lib-type')?.value||'all';
  let filtered=all;
  if(type!=='all') filtered=filtered.filter(i=>i.type===type);
  if(q) filtered=filtered.filter(i=>String(i.name||'').toLowerCase().includes(q));
  const grid=document.getElementById('img-lib-grid');
  if(!grid) return;
  if(!filtered.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">No images</div>';return;}
  grid.innerHTML=filtered.map(img=>{
    const path='images/'+img.type+'/'+img.name;
    return `<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;cursor:pointer" onclick="copyImagePath('${esc(path)}')" title="${esc(path)}">
      <div style="aspect-ratio:1;background:#0a0a0a;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${esc(driveThumb(img.url,240))}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.parentElement.innerHTML='🖼'"></div>
      <div style="padding:6px;font-size:.65rem;font-family:var(--font-mono);color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(img.name)}</div>
      <div style="padding:0 6px 6px;font-size:.6rem;color:var(--text3)">${esc(img.type)}</div>
    </div>`;
  }).join('');
}
function copyImagePath(path){
  navigator.clipboard.writeText(path).then(()=>{
    toast('📋 Copied: '+path,'success');
  }).catch(()=>toast('Copy failed','error'));
}

/* ==============================================================
   STATS DASHBOARD
   ============================================================== */
function openStats(){
  toast('Loading stats...','info');
  fetchAllSheets(['VENUES','FESTIVALS','ARTISTS','EVENTS']).then(d=>{
    const stats = computeStats({
      artists: d.ARTISTS||[], events: d.EVENTS||[], festivals: d.FESTIVALS||[], venues: d.VENUES||[]
    });
    renderStatsDialog(stats);
  }).catch(err => toast('Stats error: '+err.message,'error'));
}
function computeStats(data){
  const byCity = {};
  const byGenre = {};
  const byYear = {};
  const byCountry = {};
  const byMonth = {};
  // 都市別 (Venues + Festivals)
  [...data.venues, ...data.festivals].forEach(r=>{
    const c=String(r.city||'').toUpperCase().trim();
    if(c) byCity[c]=(byCity[c]||0)+1;
  });
  // ジャンル別 (全部)
  [...data.venues, ...data.festivals, ...data.artists].forEach(r=>{
    String(r.genre||'').split(/[·,]/).forEach(g=>{
      const t=g.trim().toUpperCase();
      if(t) byGenre[t]=(byGenre[t]||0)+1;
    });
  });
  // 年別 (Festivals + Events)
  [...data.festivals, ...data.events].forEach(r=>{
    const y=String(r.date||'').substring(0,4);
    if(y.match(/^\d{4}$/)) byYear[y]=(byYear[y]||0)+1;
  });
  // 月別 (Festivals)
  data.festivals.forEach(r=>{
    const m=String(r.date||'').substring(5,7);
    if(m.match(/^\d{2}$/)) byMonth[m]=(byMonth[m]||0)+1;
  });
  // 国別 (Artists)
  data.artists.forEach(r=>{
    const c=String(r.country||'').toUpperCase().trim();
    if(c) byCountry[c]=(byCountry[c]||0)+1;
  });
  return {
    totals: {
      venues: data.venues.length,
      festivals: data.festivals.length,
      artists: data.artists.length,
      events: data.events.length
    },
    byCity, byGenre, byYear, byCountry, byMonth
  };
}
function topN(obj, n){
  return Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);
}
function renderStatsDialog(stats){
  const overlay = document.createElement('div');
  overlay.className='dialog-overlay show';
  overlay.style.zIndex=700;
  const bar = (label, count, max) => {
    const w = Math.max(2, (count/max)*100);
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:.75rem">
      <div style="width:120px;color:var(--text2);font-family:var(--font-mono);font-size:.7rem">${esc(label)}</div>
      <div style="flex:1;background:var(--bg3);border-radius:2px;height:14px;position:relative">
        <div style="width:${w}%;background:var(--accent);height:100%;border-radius:2px"></div>
      </div>
      <div style="width:32px;text-align:right;color:var(--text);font-family:var(--font-mono);font-size:.75rem">${count}</div>
    </div>`;
  };
  const section = (title, entries) => {
    if(!entries.length) return '';
    const max = entries[0][1];
    return `<div style="margin-top:20px"><h4 style="margin-bottom:8px;color:var(--text2);font-family:var(--font-mono);font-size:.7rem;letter-spacing:1px">${title}</h4>${entries.map(([k,v])=>bar(k,v,max)).join('')}</div>`;
  };
  overlay.innerHTML = `<div class="dialog-box" style="max-width:680px;max-height:85vh;overflow-y:auto">
    <h3>📊 Stats Dashboard</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">
      <div style="text-align:center;background:var(--bg3);padding:14px;border-radius:var(--radius)">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--text)">${stats.totals.festivals}</div>
        <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text3);letter-spacing:1px">FESTIVALS</div>
      </div>
      <div style="text-align:center;background:var(--bg3);padding:14px;border-radius:var(--radius)">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--text)">${stats.totals.venues}</div>
        <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text3);letter-spacing:1px">VENUES</div>
      </div>
      <div style="text-align:center;background:var(--bg3);padding:14px;border-radius:var(--radius)">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--text)">${stats.totals.artists}</div>
        <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text3);letter-spacing:1px">ARTISTS</div>
      </div>
      <div style="text-align:center;background:var(--bg3);padding:14px;border-radius:var(--radius)">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--text)">${stats.totals.events}</div>
        <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--text3);letter-spacing:1px">EVENTS</div>
      </div>
    </div>
    ${section('TOP CITIES', topN(stats.byCity, 8))}
    ${section('TOP GENRES', topN(stats.byGenre, 8))}
    ${section('FESTIVALS BY MONTH', Object.entries(stats.byMonth).sort())}
    ${section('BY YEAR', Object.entries(stats.byYear).sort().reverse().slice(0,5))}
    ${section('ARTISTS BY COUNTRY', topN(stats.byCountry, 5))}
    <div class="btn-row" style="margin-top:24px"><button class="btn" onclick="this.closest('.dialog-overlay').remove()">Close</button></div>
  </div>`;
  document.body.appendChild(overlay);
}

/* ==============================================================
   TRASH / UNDO DELETE
   削除した行を30日間localStorage保存 → 復元可能
   ============================================================== */
const TRASH_KEY = 'cms_trash_v1';
const TRASH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
function getTrash(){
  try {
    const items = JSON.parse(localStorage.getItem(TRASH_KEY) || '[]');
    const now = Date.now();
    return items.filter(i => (now - i.deletedAt) < TRASH_TTL_MS);
  } catch(e) { return []; }
}
function saveDeletedItem(section, row){
  const items = getTrash();
  items.unshift({ section, row: { ...row }, deletedAt: Date.now() });
  localStorage.setItem(TRASH_KEY, JSON.stringify(items.slice(0, 50)));
}
function renderTrashCount(){
  const el = document.getElementById('trash-count');
  if(!el) return;
  const n = getTrash().length;
  el.textContent = n ? '('+n+')' : '';
}
function openTrash(){
  const items = getTrash();
  if(!items.length) return toast('Trash is empty','info');
  const overlay = document.createElement('div');
  overlay.className='dialog-overlay show';
  overlay.style.zIndex=700;
  overlay.innerHTML = `<div class="dialog-box" style="max-width:600px;max-height:80vh;overflow-y:auto">
    <h3>🗑 Trash (${items.length})</h3>
    <p>削除されたアイテム — 30日間保管。クリックで復元できます。</p>
    <div id="trash-list">${items.map((it,i)=>{
      const label = it.row.name || it.row.title || it.row.id || '(unnamed)';
      const ago = Math.round((Date.now()-it.deletedAt)/1000/60);
      const agoStr = ago<60?ago+'m ago':ago<1440?Math.round(ago/60)+'h ago':Math.round(ago/1440)+'d ago';
      return `<div style="padding:10px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><strong>${esc(label)}</strong><br><span style="color:var(--text3);font-size:.7rem">${esc(it.section)} · ${agoStr}</span></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-green" onclick="restoreTrash(${i})">Restore</button>
          <button class="btn btn-sm btn-accent" onclick="removeTrashPermanent(${i})">Delete</button>
        </div>
      </div>`;
    }).join('')}</div>
    <div class="btn-row" style="margin-top:16px"><button class="btn btn-sm" onclick="this.closest('.dialog-overlay').remove()">Close</button></div>
  </div>`;
  document.body.appendChild(overlay);
}
function restoreTrash(idx){
  const items = getTrash();
  const it = items[idx];
  if(!it) return;
  const action = 'add_'+it.section;
  const payload = { action, ...it.row };
  delete payload._row;
  toast('Restoring...','info');
  fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)})
    .then(r=>r.json()).then(d=>{
      if(d.status==='ok'||d.success){
        toast('Restored','success');
        items.splice(idx,1);
        localStorage.setItem(TRASH_KEY, JSON.stringify(items));
        renderTrashCount();
        document.querySelector('.dialog-overlay[style*="zIndex"]')?.remove();
      } else toast('Restore failed: '+(d.message||''),'error');
    }).catch(()=>toast('Restore error','error'));
}
function removeTrashPermanent(idx){
  if(!confirm('完全に削除しますか？（復元できません）')) return;
  const items = getTrash();
  items.splice(idx,1);
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
  renderTrashCount();
  document.querySelector('.dialog-overlay')?.remove();
  openTrash();
}

/* ==============================================================
   SUBMIT TO SHEET (new row)
   ============================================================== */
function submitToSheet(section){
  if (section === 'article') flushArticleEditorSync();
  let payload;
  if(section==='venue'){
    payload={action:'addVenue',id:g('v-id'),name:g('v-name'),city:g('v-city'),area:g('v-area'),
      type:g('v-type'),image:g('v-image'),imagePosition:g('v-imagePosition'),genre:getSelectedGenres('v-genre').join(', '),
      capacity:g('v-capacity'),address:g('v-address'),lat:g('v-lat'),lng:g('v-lng'),
      url:g('v-url'),instagram:g('v-instagram'),desc:g('v-desc')};
    if(!payload.id||!payload.name)return toast('ID and Name required','error');
  }
  else if(section==='festival'){
    const ds=g('f-dateStart'),de=g('f-dateEnd');
    payload={action:'add_festival',id:g('f-id'),type:g('f-type'),name:g('f-name'),city:g('f-city'),
      location:g('f-location'),location_ja:g('f-location_ja'),url:g('f-url'),ticketUrl:g('f-ticketUrl'),instagram:g('f-instagram'),
      address:g('f-address'),lat:g('f-lat'),lng:g('f-lng'),date:ds&&de?ds+'/'+de:ds,
      genre:getSelectedGenres('f-genre').join(', '),image:g('f-image'),imagePosition:g('f-imagePosition'),flyer:g('f-flyer'),
      heroGradient:g('f-heroGradient'),desc:g('f-desc'),lineup:cleanLineup(lineups.f).join(', '),
      editions:editions};
    if(!payload.id||!payload.name)return toast('ID and Name required','error');
  }
  else if(section==='artist'){
    payload={action:'add_artist',id:g('a-id'),name:g('a-name'),city:g('a-city'),country:g('a-country'),
      genre:g('a-genre'),image:g('a-image'),imagePosition:g('a-imagePosition'),bio:g('a-bio'),
      instagram:g('a-instagram'),soundcloud:g('a-soundcloud'),bandcamp:g('a-bandcamp'),website:g('a-website')};
    if(!payload.id||!payload.name)return toast('ID and Name required','error');
  }
  else if(section==='event'){
    payload={action:'add_event',name:g('e-name'),date:g('e-date'),venue:g('e-venue'),
      city:g('e-city'),time:g('e-time'),desc:g('e-desc'),lineup:lineups.e.join(', '),link:g('e-link')};
    if(!payload.name)return toast('Name required','error');
  }
  else if(section==='article'){
    payload={action:'add_article',id:g('ar-id'),title:g('ar-title'),category:g('ar-category'),
      date:g('ar-date'),author:g('ar-author'),image:g('ar-image'),readTime:g('ar-readTime'),
      cardRatio:g('ar-cardRatio'),heroRatio:g('ar-heroRatio'),festivalId:g('ar-festivalId'),
      title_en:g('ar-title_en'),excerpt_en:g('ar-excerpt_en'),body_en:g('ar-body_en'),
      views:g('ar-views'),featured:g('ar-featured'),excerpt:g('ar-excerpt'),
      body:g('ar-body'),tags:g('ar-tags'),status:g('ar-status')};
    if(!payload.id||!payload.title)return toast('ID and Title required','error');
    if(!payload.date) payload.date = new Date().toISOString().slice(0,10); // DATE空のまま公開すると記事詳細が壊れるため
  }
  else if(section==='author'){
    payload={action:'add_author',id:g('au-id'),name:g('au-name'),bio:g('au-bio'),
      image:g('au-image'),instagram:g('au-instagram'),twitter:g('au-twitter'),website:g('au-website')};
    if(!payload.id||!payload.name)return toast('ID and Name required','error');
  }
  // Publishing fields をマージ（author以外）
  if(section !== 'author') Object.assign(payload, getPubFields(section));
  // バリデーション
  const errors = validateBeforeSave(section, payload);
  if(errors.length){
    return toast(errors[0], 'error');
  }
  // Festivalの場合、未登録アーティストを自動でARTISTSに追加
  const unregisteredArtists=(section==='festival')
    ? lineups.f.filter(a=>a.startsWith('?')).map(a=>a.substring(1))
    : [];

  // ---- 楽観的UI: 「⏳ syncing」行として即リストに出し、GAS応答は裏で待つ ----
  applyOptimisticInsert(section, payload);
  clearFormDirty();
  if (section === 'article') clearArticleDraft();
  resetForm(section);
  switchTab(section,'list');
  rerenderListFromCache(section);
  toast('保存中...','info');

  fetch(GAS_URL,{method:'POST',body:JSON.stringify(payload)})
    .then(r=>r.json()).then(r=>{
      console.log('Save response:',r);
      if(r.success||r.status==='ok'){
        toast('Saved ✓','success');
        if(unregisteredArtists.length){
          autoRegisterArtists(unregisteredArtists);
          invalidateSheetCache('artist');
        }
        // 正式な行番号を取り込むため裏で再読込（syncing 行が実データに置き換わる）
        loadList(section, {force:true});
      } else {
        const msg=r.message||r.error||'Save failed';
        console.error('Save failed:',r);
        toast('保存失敗: '+msg+' — リストを再読込します','error');
        invalidateSheetCache(section);
        loadList(section, {force:true});
      }
    })
    .catch(e=>{
      console.error('Save error:',e);
      toast('通信エラー: '+e.message+' — リストを再読込します','error');
      invalidateSheetCache(section);
      loadList(section, {force:true});
    });
}

/* 楽観的挿入: 行番号が確定するまで __syncing フラグ付きでキャッシュ先頭に追加 */
function applyOptimisticInsert(section, payload){
  if(!listCache[section]) listCache[section] = [];
  const {action, ...fields} = payload;
  listCache[section].unshift({...fields, _row: -1, __syncing: true});
}

/* ==============================================================
   QUICK ADD — 最小フィールドで即保存 → あとから詳細を追記
   大量登録時期のための2段階フロー。保存は draft ステータス。
   ============================================================== */
const QUICK_ADD_DEFS = {
  venue: { title: 'Venue クイック追加', action: 'addVenue', fields: [
    { key: 'name', label: 'Name', ph: 'e.g. CLUB METRO', required: true, slugSource: true },
    { key: 'id',   label: 'ID (URL slug)', ph: 'nameから自動生成', required: true },
    { key: 'city', label: 'City', ph: 'e.g. KYOTO' },
    { key: 'area', label: 'Area', ph: 'e.g. SHIMOGYO' },
  ]},
  festival: { title: 'Festival クイック追加', action: 'add_festival', fields: [
    { key: 'name', label: 'Name', ph: 'e.g. RURAL', required: true, slugSource: true },
    { key: 'id',   label: 'ID (URL slug)', ph: 'nameから自動生成', required: true },
    { key: 'dateStart', label: 'Date Start', type: 'date' },
    { key: 'dateEnd',   label: 'Date End', type: 'date' },
    { key: 'city', label: 'City / Pref', ph: 'e.g. NIIGATA' },
  ]},
  artist: { title: 'Artist クイック追加', action: 'add_artist', fields: [
    { key: 'name', label: 'Name', ph: 'e.g. DJ NOBU', required: true, slugSource: true },
    { key: 'id',   label: 'ID (URL slug)', ph: 'nameから自動生成', required: true },
    { key: 'city', label: 'City', ph: 'e.g. TOKYO' },
    { key: 'genre', label: 'Genre', ph: 'e.g. TECHNO' },
  ]},
  event: { title: 'Event クイック追加', action: 'add_event', fields: [
    { key: 'name', label: 'Name', ph: 'e.g. FUTURE TERROR', required: true },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'venue', label: 'Venue', ph: 'e.g. WOMB' },
    { key: 'city', label: 'City', ph: 'e.g. TOKYO' },
  ]},
};

function openQuickAdd(section){
  const def = QUICK_ADD_DEFS[section];
  if (!def) return;
  closeQuickAdd();
  const overlay = document.createElement('div');
  overlay.id = 'quick-add-modal';
  overlay.className = 'dialog-overlay show';
  const fieldsHtml = def.fields.map(f => `
    <div style="margin-bottom:12px">
      <label style="display:block;font-family:var(--font-mono);font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin-bottom:5px">${f.label}${f.required ? '<span class="req-star">*</span>' : ''}</label>
      <input type="${f.type||'text'}" id="qa-${f.key}" placeholder="${f.ph||''}" style="width:100%;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:.9rem">
    </div>`).join('');
  overlay.innerHTML = `
    <div class="dialog-box" style="max-width:440px">
      <h3>⚡ ${def.title}</h3>
      <p style="margin-bottom:16px">最小情報で draft 保存。詳細はあとから追記できます。</p>
      ${fieldsHtml}
      <div class="btn-row" style="margin-top:16px">
        <button class="btn btn-sm" onclick="closeQuickAdd()">Cancel</button>
        <button class="btn btn-sm btn-yellow" onclick="submitQuickAdd('${section}', true)">保存して次を追加</button>
        <button class="btn btn-sm btn-accent" onclick="submitQuickAdd('${section}', false)">保存して閉じる</button>
      </div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeQuickAdd(); });
  document.body.appendChild(overlay);
  // name → id 自動生成（手動編集したら追従を止める）
  const nameEl = document.getElementById('qa-name');
  const idEl = document.getElementById('qa-id');
  if (nameEl && idEl) {
    idEl.addEventListener('input', () => { idEl.dataset.userEdited = '1'; });
    nameEl.addEventListener('input', () => {
      if (idEl.dataset.userEdited !== '1') idEl.value = slugify(nameEl.value);
    });
  }
  // Enter で「保存して次を追加」/ Esc で閉じる
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submitQuickAdd(section, true); }
    if (e.key === 'Escape') closeQuickAdd();
  });
  if (nameEl) nameEl.focus();
}

function closeQuickAdd(){
  const el = document.getElementById('quick-add-modal');
  if (el) el.remove();
}

function submitQuickAdd(section, keepOpen){
  const def = QUICK_ADD_DEFS[section];
  if (!def) return;
  const values = {};
  for (const f of def.fields) {
    const v = (document.getElementById('qa-'+f.key)?.value || '').trim();
    if (f.required && !v) return toast(f.label + ' は必須です', 'error');
    values[f.key] = v;
  }
  // festival: dateStart/dateEnd → date に統合
  if (section === 'festival') {
    const ds = values.dateStart, de = values.dateEnd;
    values.date = ds && de ? ds + '/' + de : (ds || '');
    delete values.dateStart; delete values.dateEnd;
  }
  const payload = { action: def.action, ...values, status: 'draft' };

  // 楽観的挿入 → リストに即表示、GAS応答は裏で
  applyOptimisticInsert(section, payload);
  rerenderListFromCache(section);
  toast('保存中... (draft)', 'info');

  fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(r => r.json()).then(r => {
      if (r.success || r.status === 'ok') {
        toast('⚡ 追加しました (draft)', 'success');
        loadList(section, { force: true });
      } else {
        toast('追加失敗: ' + (r.message || r.error || '') + ' — リストを再読込します', 'error');
        invalidateSheetCache(section);
        loadList(section, { force: true });
      }
    })
    .catch(e => {
      toast('通信エラー: ' + e.message, 'error');
      invalidateSheetCache(section);
      loadList(section, { force: true });
    });

  if (keepOpen) {
    // フィールドをクリアして連続入力
    def.fields.forEach(f => {
      const el = document.getElementById('qa-'+f.key);
      if (el) { el.value = ''; delete el.dataset.userEdited; }
    });
    document.getElementById('qa-name')?.focus();
  } else {
    closeQuickAdd();
    switchTab(section, 'list');
  }
}

function autoRegisterArtists(artistIds){
  let done=0;
  artistIds.forEach(id=>{
    const name=id.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    fetch(GAS_URL,{method:'POST',body:JSON.stringify({action:'add_artist',id:id,name:name})})
      .then(r=>r.json()).then(r=>{
        done++;
        if(r.status==='ok') {
          ARTIST_DB.push({id:id,name:name});
          ARTIST_LIST.push(id);
        }
        if(done===artistIds.length){
          toast(done+' artists auto-registered','success');
          // ?プレフィックスを除去してタグを更新
          lineups.f=lineups.f.map(a=>a.startsWith('?')?a.substring(1):a);
          renderLineupTags('f');
        }
      }).catch(()=>{done++});
  });
}

/* ==============================================================
   EXPORT DATA.JS
   ============================================================== */
/* ==============================================================
   ARTICLE EDIT HISTORY — body のバージョン履歴
   ============================================================== */
function showArticleHistory(){
  const articleId = (document.getElementById('ar-id')?.value || '').trim();
  if (!articleId) return toast('IDが必要です（保存済み記事のみ履歴表示可能）', 'error');
  toast('履歴を取得中...', 'info');
  fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'get_article_history', articleId: articleId })
  }).then(r=>r.json()).then(d=>{
    if (d.status !== 'ok') return toast('履歴取得失敗: '+(d.message||''), 'error');
    if (!d.versions || !d.versions.length) return toast('この記事の履歴はまだありません', 'info');
    renderArticleHistoryModal(d.versions);
  }).catch(e=>toast('History error: '+e.message, 'error'));
}

function renderArticleHistoryModal(versions){
  const existing = document.getElementById('history-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'history-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;max-width:760px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.6)';
  inner.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="font-family:var(--font-mono);font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text3)">📜 編集履歴 ('+versions.length+'件)</div><button class="btn btn-sm" onclick="document.getElementById(\'history-modal\').remove()">✕ Close</button></div>';
  versions.forEach((v, i) => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-radius:6px;padding:14px;margin-bottom:10px;background:var(--bg3)';
    const ts = formatHistoryTimestamp(v.savedAt);
    const preview = (v.body||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 200);
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<div style="font-family:var(--font-mono);font-size:.7rem;color:var(--text2)">' +
          '<strong style="color:var(--text)">' + esc(ts) + '</strong>' +
          (v.title ? ' · ' + esc(v.title) : '') +
        '</div>' +
        '<button class="btn btn-sm btn-yellow" data-idx="'+i+'">↩ Restore</button>' +
      '</div>' +
      '<div style="font-size:.85rem;color:var(--text2);line-height:1.5">' + esc(preview) + (preview.length >= 200 ? '...' : '') + '</div>';
    card.querySelector('button').onclick = () => {
      if (!confirm('この履歴で本文を上書きします（現在の本文は次回保存時に履歴に残ります）。続行しますか?')) return;
      setArticleBody(v.body || '');
      markFormDirty();
      modal.remove();
      toast('履歴から復元しました（Save Changes でスプレッドシートに保存）', 'success');
    };
    inner.appendChild(card);
  });
  modal.appendChild(inner);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function formatHistoryTimestamp(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const Y=d.getFullYear(), M=String(d.getMonth()+1).padStart(2,'0'), D=String(d.getDate()).padStart(2,'0');
  const h=String(d.getHours()).padStart(2,'0'), m=String(d.getMinutes()).padStart(2,'0');
  return Y+'-'+M+'-'+D+' '+h+':'+m;
}

/* ==============================================================
   AI TITLE SUGGEST — 本文からタイトル候補を3案生成
   ============================================================== */
function aiTitleSuggest(){
  const bodyHtml = (document.getElementById('ar-body')?.value || '').trim();
  if (!bodyHtml || bodyHtml === '<p><br></p>') return toast('先に本文を書いてください', 'error');
  const text = bodyHtml.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
  toast('✨ タイトル候補を生成中...', 'info');
  fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'ai_summarize', mode: 'titles', text: text.slice(0,8000) })
  }).then(r=>r.json()).then(d=>{
    if (d.status === 'ok' && d.text) {
      const candidates = d.text.split(/\n+/).map(s=>s.replace(/^[\d.\-\)・*]\s*/,'').replace(/^[「『"']/,'').replace(/[」』"']$/,'').trim()).filter(Boolean).slice(0,3);
      if (!candidates.length) return toast('候補が空でした', 'error');
      showTitleCandidates(candidates);
    } else {
      toast('AI failed: '+(d.message||'unknown'), 'error');
    }
  }).catch(e=>{ console.error(e); toast('AI error: '+e.message, 'error'); });
}

function showTitleCandidates(candidates){
  // シンプルなオーバーレイ表示
  const existing = document.getElementById('title-candidate-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'title-candidate-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
  const inner = document.createElement('div');
  inner.style.cssText = 'background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:24px;max-width:600px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,.6)';
  inner.innerHTML = '<div style="font-family:var(--font-mono);font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin-bottom:16px">✨ タイトル候補（クリックで採用）</div>';
  candidates.forEach(c => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 16px;font-size:.9rem;line-height:1.4';
    b.textContent = c;
    b.onclick = () => {
      document.getElementById('ar-title').value = c;
      onArticleTitleInput();
      modal.remove();
      toast('タイトルを設定しました', 'success');
    };
    inner.appendChild(b);
  });
  const close = document.createElement('button');
  close.className = 'btn btn-sm';
  close.textContent = 'Cancel';
  close.style.cssText = 'margin-top:8px';
  close.onclick = () => modal.remove();
  inner.appendChild(close);
  modal.appendChild(inner);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

/* ==============================================================
   AI SUMMARIZE — 本文から excerpt / meta description を AI 生成
   mode: 'excerpt' | 'excerpt-en' | 'meta'
   ============================================================== */
/* ---------- AI 翻訳（GAS 側の ai_translate を呼ぶ） ---------- */
function aiTranslate_(text, target, isHtml){
  return fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'ai_translate', text: String(text).slice(0, 12000), target: target, html: !!isHtml })
  }).then(r => r.json());
}

function aiTranslateField(srcId, dstId, target){
  const src = (document.getElementById(srcId)?.value || '').trim();
  if (!src) return toast('先に元のテキストを入力してください', 'error');
  toast('✨ 翻訳中...', 'info');
  aiTranslate_(src, target, false).then(d => {
    if (d.status === 'ok' && d.text){
      document.getElementById(dstId).value = d.text.trim();
      markFormDirty();
      toast('翻訳しました — 内容を確認してください', 'success');
    } else toast('翻訳エラー: ' + (d.message || 'unknown'), 'error');
  }).catch(e => toast('翻訳エラー: ' + e.message, 'error'));
}

function aiTranslateBody(){
  flushArticleEditorSync();
  const src = (document.getElementById('ar-body')?.value || '').trim();
  if (!src || src === '<p><br></p>') return toast('先に本文を書いてください', 'error');
  toast('✨ 本文を英訳中...（長い記事は少し時間がかかります）', 'info');
  aiTranslate_(src, 'en', true).then(d => {
    if (d.status === 'ok' && d.text){
      document.getElementById('ar-body_en').value = d.text.trim();
      markFormDirty();
      toast('英訳完了 — 内容を確認して保存してください', 'success');
    } else toast('翻訳エラー: ' + (d.message || 'unknown'), 'error');
  }).catch(e => toast('翻訳エラー: ' + e.message, 'error'));
}

function aiSummarize(mode){
  const bodyHtml = (document.getElementById('ar-body')?.value || '').trim();
  const title = (document.getElementById('ar-title')?.value || '').trim();
  if (!bodyHtml || bodyHtml === '<p><br></p>') return toast('先に本文を書いてください', 'error');

  const text = bodyHtml.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&[a-z]+;/g,' ').replace(/\s+/g,' ').trim();
  const targetId = mode === 'meta' ? 'ar-metaDescription' : 'ar-excerpt';
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return toast('Field not found: '+targetId, 'error');

  const btnLabel = mode === 'meta' ? 'AI Meta' : (mode === 'excerpt-en' ? 'AI Excerpt EN' : 'AI Excerpt');
  toast('✨ '+btnLabel+' 生成中...', 'info');

  fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({
      action: 'ai_summarize',
      mode: mode,
      title: title,
      text: text.slice(0, 8000)  // 安全のため上限
    })
  }).then(r=>r.json()).then(d=>{
    if (d.status === 'ok' && d.text) {
      targetEl.value = d.text.trim();
      // char count 更新（meta description）
      if (mode === 'meta' && typeof updateCharCount === 'function') updateCharCount('ar-metaDescription', 160);
      markFormDirty();
      toast('✨ 生成完了', 'success');
    } else {
      toast('AI failed: '+(d.message||'unknown'), 'error');
    }
  }).catch(e=>{
    console.error('AI summarize error:', e);
    toast('AI error: '+e.message, 'error');
  });
}

/* ---------- SEO入力の効率化 ---------- */
// 非記事セクション: Description/Bio から Meta Description をAI生成
function aiMetaGenerate(p, section){
  const descField = section === 'artist' ? 'bio' : 'desc';
  const text = (g(p+'-'+descField) || '').replace(/\s+/g,' ').trim();
  if(!text) return toast('先に' + (section==='artist'?'Bio':'Description') + 'を入力してください','error');
  toast('✨ AI Meta 生成中...','info');
  fetch(GAS_URL,{method:'POST',body:JSON.stringify({
    action:'ai_summarize', mode:'meta',
    title: g(p+'-name') || '',
    text: text.slice(0, 8000)
  })}).then(r=>r.json()).then(d=>{
    if(d.status==='ok' && d.text){
      setVal(p+'-metaDescription', d.text.trim());
      updateCharCount(p+'-metaDescription', 160);
      markFormDirty();
      toast('✨ 生成完了 — 内容を確認してください','success');
    } else toast('AI failed: '+(d.message||'unknown'),'error');
  }).catch(e=>toast('AI error: '+e.message,'error'));
}

// フォーム内のジャンル/都市/タイプ等からタグ候補をワンクリック追加
function suggestTags(p, section){
  let cands = [];
  if(section === 'venue' || section === 'festival'){
    cands = getSelectedGenres(p+'-genre').concat([g(p+'-city'), g(p+'-type')]);
  } else if(section === 'artist'){
    cands = (g('a-genre')||'').split(/[\/,、・]+/).concat([g('a-city'), g('a-country')]);
  } else if(section === 'event'){
    cands = [g('e-city'), g('e-venue')];
  } else if(section === 'article'){
    cands = [g('ar-category')];
  }
  cands = cands.map(s=>String(s||'').trim()).filter(Boolean);
  if(!cands.length) return toast('候補が見つかりません（ジャンル/都市を先に入力）','error');
  const before = (tagState[p]||[]).length;
  cands.forEach(t=>addTag(p, t));
  const added = (tagState[p]||[]).length - before;
  if(added > 0){ markFormDirty(); toast(added+'件のタグを追加しました','success'); }
  else toast('すべて追加済みです','info');
}

/* ---------- ID入力の自動slug化（§1.1: 小文字英数字とハイフンのみ） ---------- */
document.addEventListener('input', e=>{
  const t = e.target;
  if(!t.id || !/^(v|f|a|ar|au)-id$/.test(t.id)) return;
  const cleaned = t.value.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-{2,}/g,'-');
  if(cleaned !== t.value){
    const pos = t.selectionStart;
    const diff = t.value.length - cleaned.length;
    t.value = cleaned;
    try{ t.setSelectionRange(Math.max(0,pos-diff), Math.max(0,pos-diff)); }catch(_){}
  }
});
// フォーカスが外れたら前後ハイフンを除去（入力中は "dj-" のような途中状態を許す）
document.addEventListener('change', e=>{
  const t = e.target;
  if(!t.id || !/^(v|f|a|ar|au)-id$/.test(t.id)) return;
  const trimmed = t.value.replace(/^-+|-+$/g,'');
  if(trimmed !== t.value) t.value = trimmed;
});

function buildFullDataJs(d){
  const lines=[];
  lines.push(dataJsHeader());
  lines.push(buildArtistsJs(d.ARTISTS||[]));
  lines.push(buildEventsJs(d.EVENTS||[]));
  lines.push(buildFestivalsJs(d.FESTIVALS||[]));
  lines.push(buildVenuesJs(d.VENUES||[]));
  lines.push(buildArticlesJs(d.ARTICLES||[]));
  return lines.join('\n\n');
}

/* Publish前サニティチェック（2026-07-23 フェス全消失事故の再発防止）。
   主要シートが 0件、または前回Publish時から半分以下に減っていたら中断する。
   前回件数は localStorage に保存（初回は 0件チェックのみ）。 */
function publishSanityCheck(d){
  const CORE = ['FESTIVALS','ARTISTS','VENUES','ARTICLES']; // EVENTSは意図的に空があり得る
  const counts = {};
  CORE.concat(['EVENTS']).forEach(k => counts[k] = (d[k]||[]).length);
  const zero = CORE.filter(k => counts[k] === 0);
  if(zero.length) return {ok:false, message:'⛔ '+zero.join(', ')+' が0件です。シート取得に失敗している可能性が高いためPublishを中断しました。リロード後に再試行してください。'};
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem('tj_publish_counts')||'null'); } catch(_){}
  if(prev){
    const dropped = CORE.filter(k => typeof prev[k]==='number' && prev[k] > 0 && counts[k] < prev[k] * 0.5);
    if(dropped.length){
      const detail = dropped.map(k => k+': '+prev[k]+'→'+counts[k]).join(' / ');
      if(!confirm('⚠️ 前回Publishから件数が大幅に減っています。\n'+detail+'\n\n意図した削除でなければキャンセルしてください。続行しますか?')) return {ok:false, message:'Publishをキャンセルしました'};
    }
  }
  // FESTIVALS の DATE 検証。
  // 2026-07-22 の Publish で1件の DATE が失われ、festivals.html の
  // getYearFromDate が undefined.split() で落ちて一覧が10日間表示されなかった。
  // JS 側は防御済みなのでもう落ちないが、DATE が無いフェスは月グループを
  // 作れず一覧から消える（＝サイトから見えなくなる）ため、公開前に知らせる。
  const dateIssues = (d.FESTIVALS||[]).map(f => {
    const id = (f.ID || f.id || '').trim();
    const raw = (f.DATE != null ? f.DATE : f.date);
    // Date型セルの検出。DATA_SCHEMA は DATE を YYYY-MM-DD の「文字列」と定めているが、
    // Sheets が日付と解釈できた値（単日入力）はセルが日付書式になり、GAS の
    // getValues() が Date オブジェクトを返す。複数日 "A/B" は解釈できず文字列のまま。
    //
    // ここが唯一の関門である理由: 公開CSV は Date型セルを表示書式に従って
    // "2025-09-07" と文字列化して出すため、CSV 経由の fetch-data.mjs では
    // セルの型を原理的に判別できない（gviz も列単位の型しか返さない）。
    // 型のまま値を受け取れるのは GAS 経由の CMS だけなので、検出はここでしかできない。
    // 書き出しは fmtDate() が正規化するので data.js やサイトは壊れないが、
    // 放置すると生値を読む箇所が増えたときに再発する。
    if (raw instanceof Date) {
      return isNaN(raw.getTime())
        ? { id, reason: 'DATE が不正な日付型セル' }
        : { id, reason: 'DATE が日付型セル（要「書式なしテキスト」化）→ ' + fmtDate(raw) };
    }
    const v = String(raw == null ? '' : raw).trim();
    if(!v) return { id, reason: 'DATE 未入力' };
    // "YYYY-MM-DD" または "YYYY-MM-DD/YYYY-MM-DD"（スキーマ §2.3）
    const ok = v.split('/').every(p => /^\d{4}-\d{2}-\d{2}$/.test(p.trim()));
    return ok ? null : { id, reason: 'DATE 形式不正 "'+v+'"' };
  }).filter(Boolean);
  if(dateIssues.length){
    const detail = dateIssues.slice(0,10).map(x => '  ・'+x.id+' — '+x.reason).join('\n')
      + (dateIssues.length>10 ? '\n  …他 '+(dateIssues.length-10)+' 件' : '');
    if(!confirm('⚠️ DATE に問題があるフェスが '+dateIssues.length+' 件あります。\n'
      +detail
      +'\n\n未入力・形式不正のものはフェス一覧に表示されません（詳細ページは残ります）。'
      +'\n形式は YYYY-MM-DD または YYYY-MM-DD/YYYY-MM-DD の「文字列」です。'
      +'\n日付型セルは公開時に自動で正規化されるためサイトは壊れませんが、'
      +'\nD列を「書式なしテキスト」にして入力し直すのが正しい状態です。'
      +'\n\nこのまま公開しますか?')) return {ok:false, message:'Publishをキャンセルしました（DATEを修正してください）'};
  }
  return {ok:true, counts};
}

function exportDataJs(){
  toast('Exporting...','info');
  fetchAllSheets(['VENUES','FESTIVALS','ARTISTS','EVENTS','ARTICLES'],{fresh:true}).then(d=>{
    const sane = publishSanityCheck(d);
    if(!sane.ok) return toast(sane.message,'error');
    const content=buildFullDataJs(d);
    downloadFile('data.js',content);
    toast('data.js exported','success');
  }).catch(e=>toast('Export error: '+e.message,'error'));
}

/* ==============================================================
   PUBLISH NOW — data.js を直接 GitHub にコミット
   ============================================================== */
/* 未保存の編集があるまま公開すると、その変更が本番に出ずに「反映されない」と
   見えてしまう。公開前に必ず気付けるようにする。 */
function unsavedEditWarning(){
  if (!formDirty) return null;
  const section = document.querySelector('.section.active')?.id?.replace('sec-','') || '';
  const editing = section && editState && editState[section];
  const label = editing
    ? (document.getElementById(section+'-edit-name')?.textContent || '').trim()
    : '';
  return '⚠️ 保存していない編集があります'
    + (section ? '\n対象: ' + section.toUpperCase() + (label ? ' / ' + label : '') : '')
    + '\n\nこのまま公開すると、この変更は本番に反映されません。'
    + '\n先に「Save Changes」を押すことをおすすめします。'
    + '\n\nそれでも公開しますか?';
}

function publishDataJs(opts){
  opts = opts || {};
  const warn = unsavedEditWarning();
  if (warn && !confirm(warn)) return;
  if (!confirm('data.js をビルドして GitHub に直接 push します。\n（数分後に LP 本番に反映）\n\n続行しますか?')) return;
  const btn = document.getElementById('btn-publish-now');
  if (btn) { btn.disabled = true; btn.dataset.originalText = btn.innerHTML; btn.innerHTML = 'Building...'; }
  toast('Building data.js...','info');
  fetchAllSheets(['VENUES','FESTIVALS','ARTISTS','EVENTS','ARTICLES'],{fresh:true}).then(d=>{
    const sane = publishSanityCheck(d);
    if(!sane.ok) throw new Error(sane.message);
    try { localStorage.setItem('tj_publish_counts', JSON.stringify(sane.counts)); } catch(_){}
    const content = buildFullDataJs(d);
    if (btn) btn.innerHTML = 'Pushing to GitHub...';
    toast('Pushing to GitHub...','info');
    return fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'publish_data_js',
        content: content,
        message: opts.message || 'cms: publish data.js'
      })
    }).then(r=>r.json());
  }).then(r=>{
    if (r.status === 'ok' || r.success) {
      const sha = (r.sha || '').slice(0,7);
      toast('🚀 Published! ('+sha+') — 数分後に本番反映', 'success');
      if (r.commitUrl) {
        // 通知トーストから commit を開けるようコンソールに出力
        console.log('Commit URL:', r.commitUrl);
      }
    } else {
      toast('Publish failed: ' + (r.message || 'unknown'), 'error');
    }
  }).catch(e=>{
    console.error('Publish error:', e);
    toast('Publish error: '+e.message, 'error');
  }).finally(()=>{
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.originalText || '🚀 Publish Now'; }
  });
}
function dataJsHeader(){
  return `/* ==========================================================
   TECHNO JAPAN — SHARED DATA

   Edit this file to update artists, events, and venues across all pages.
   events.html, artists.html, venues.html, news.html, and map.html
   all read from here.
   ========================================================== */`;
}
function q(s){return String(s||'').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\n/g,'\\n')}
// 画像は配信フォーマットの .webp に正規化（サイトは最適化済み .webp を配信）。
// .webp が無い画像は元々 .jpg/.png も欠落しているため、変換で悪化しない。
function webp(p){return String(p||'').replace(/\.(jpe?g|png)$/i,'.webp')}
// プレビューに出す画像 URL を決める（venue / artist / festival の3プレビュー共通）。
// path はシートの生値で、拡張子が Drive 原本のまま（.jpeg/.jpg）のことがあるが、
// サイトへ配信されるのは webp のみ。サイト内の相対パスのときだけ webp() を通す。
// アップロード直後の DOM 上の src と、http(s) の外部URLはそのまま使う（変換対象外）。
function resolveImgSrc(path,urlField,pvEl){
  if(pvEl&&pvEl.src)return pvEl.src;
  if(path&&path.startsWith('http'))return path;
  if(urlField)return urlField;
  if(path)return webp(path);
  return '';
}
// Google Drive の lh3 URL は末尾に =wN を付けると N px のサムネイルを配信する。
// 画像ライブラリのグリッド等、原寸不要な場面で帯域を節約する。lh3 以外は無変換。
function driveThumb(url, w){
  const s = String(url||'');
  if(/lh3\.googleusercontent\.com\/d\//.test(s)) return s.replace(/=[sw]\d+(-[a-z0-9]+)*$/i,'') + '=w' + w;
  if(/drive\.google\.com\/thumbnail/.test(s)) return s.replace(/([?&])sz=[^&]*/,'$1sz=w'+w);
  return s;
}
// Normalize a date to "YYYY-MM-DD" (LP-compatible). Handles:
//   - Date objects
//   - JS Date.toString() like "Sun May 17 2026 00:00:00 GMT+0900 (日本標準時)"
//   - ISO 8601 like "2026-05-16T15:00:00.000Z"
//   - Already YYYY-MM-DD
//   - Range "YYYY-MM-DD/YYYY-MM-DD" (each side normalized)
function fmtDate(d){
  if(!d) return '';
  if(d instanceof Date){
    if(isNaN(d.getTime())) return '';
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+dd;
  }
  const s=String(d).trim();
  if(!s) return '';
  // Range: "YYYY-MM-DD/YYYY-MM-DD" or other date / date
  if(s.indexOf('/')>-1){
    return s.split('/').map(p=>fmtDate(p.trim())).filter(Boolean).join('/');
  }
  // Already YYYY-MM-DD (or longer ISO datetime starting with date)
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m) return m[1]+'-'+m[2]+'-'+m[3];
  // Try parsing as Date (handles toString format and ISO)
  const parsed=new Date(s);
  if(!isNaN(parsed.getTime())){
    const y=parsed.getFullYear(), mm=String(parsed.getMonth()+1).padStart(2,'0'), dd=String(parsed.getDate()).padStart(2,'0');
    return y+'-'+mm+'-'+dd;
  }
  return s;
}
function buildArtistsJs(rows){
  // draft と id 無し行は公開しない（ARTICLES と同じルール）
  rows = rows.filter(r => String(r.id||'').trim() && (!r.status || String(r.status).toLowerCase() === 'published'));
  const items=rows.map(r=>{
    const l=[];
    l.push('  {');
    l.push('    id: "'+q(r.id)+'",');
    l.push('    name: "'+q(r.name)+'",');
    if(r.city) l.push('    city: "'+q(r.city)+'",');
    if(r.country) l.push('    country: "'+q(r.country)+'",');
    if(r.genre) l.push('    genre: "'+q(r.genre)+'",');
    if(r.image) l.push('    image: "'+q(webp(r.image))+'",');
    if(r.imagePosition) l.push('    imagePosition: "'+q(r.imagePosition)+'",');
    if(r.bio) l.push('    bio: "'+q(r.bio)+'",');
    if(r.bio_en) l.push('    bio_en: "'+q(r.bio_en)+'",');
    if(r.name_en) l.push('    name_en: "'+q(r.name_en)+'",');
    const links=[];
    if(r.instagram) links.push('      instagram: "'+q(r.instagram)+'"');
    if(r.soundcloud) links.push('      soundcloud: "'+q(r.soundcloud)+'"');
    if(r.bandcamp) links.push('      bandcamp: "'+q(r.bandcamp)+'"');
    if(r.website) links.push('      website: "'+q(r.website)+'"');
    if(links.length){
      l.push('    links: {');
      l.push(links.join(',\n')+',');
      l.push('    }');
    }
    l.push('  },');
    return l.join('\n');
  });
  return 'const ARTISTS = [\n'+items.join('\n')+'\n];';
}
function buildEventsJs(rows){
  // draft と id 無し行は公開しない（ARTICLES と同じルール）
  rows = rows.filter(r => String(r.id||'').trim() && (!r.status || String(r.status).toLowerCase() === 'published'));
  const items=rows.map(r=>{
    const l=[];
    l.push('  {');
    l.push('    name: "'+q(r.name)+'",');
    if(r.date) l.push('    date: "'+q(fmtDate(r.date))+'",');
    if(r.venue) l.push('    venue: "'+q(r.venue)+'",');
    if(r.city) l.push('    city: "'+q(r.city)+'",');
    if(r.time) l.push('    time: "'+q(r.time)+'",');
    if(r.desc) l.push('    desc: "'+q(r.desc)+'",');
    if(r.lineup){
      const arr=String(r.lineup).split(',').map(s=>'"'+q(s.trim())+'"').filter(s=>s!=='""');
      if(arr.length) l.push('    lineup: ['+arr.join(', ')+'],');
    }
    if(r.link) l.push('    link: "'+q(r.link)+'",');
    l.push('  },');
    return l.join('\n');
  });
  return 'const EVENTS = [\n'+items.join('\n')+'\n];';
}
function buildFestivalsJs(rows){
  // draft と id 無し行は公開しない（ARTICLES と同じルール）
  rows = rows.filter(r => String(r.id||'').trim() && (!r.status || String(r.status).toLowerCase() === 'published'));
  const items=rows.map(r=>{
    const l=[];
    l.push('  {');
    l.push('    id: "'+q(r.id)+'",');
    if(r.type) l.push('    type: "'+q(r.type)+'",');
    l.push('    name: "'+q(r.name)+'",');
    if(r.date) l.push('    date: "'+q(fmtDate(r.date))+'",');
    if(r.location) l.push('    location: "'+q(r.location)+'",');
    if(r.location_ja) l.push('    location_ja: "'+q(r.location_ja)+'",');
    if(r.city) l.push('    city: "'+q(r.city)+'",');
    if(r.address) l.push('    address: "'+q(r.address)+'",');
    const lat=parseFloat(r.lat); if(!isNaN(lat)) l.push('    lat: '+lat+',');
    const lng=parseFloat(r.lng); if(!isNaN(lng)) l.push('    lng: '+lng+',');
    if(r.image) l.push('    image: "'+q(webp(r.image))+'",');
    if(r.imagePosition) l.push('    imagePosition: "'+q(r.imagePosition)+'",');
    if(r.flyer) l.push('    flyer: "'+q(webp(r.flyer))+'",');
    if(r.heroGradient) l.push('    heroGradient: "'+q(r.heroGradient)+'",');
    if(r.genre){
      const arr=String(r.genre).split(/[,·]/).map(s=>'"'+q(s.trim())+'"').filter(s=>s!=='""');
      if(arr.length) l.push('    genre: ['+arr.join(', ')+'],');
    }
    if(r.desc) l.push('    desc: "'+q(r.desc)+'",');
    if(r.desc_en) l.push('    desc_en: "'+q(r.desc_en)+'",');
    if(r.name_en) l.push('    name_en: "'+q(r.name_en)+'",');
    if(r.url) l.push('    url: "'+q(r.url)+'",');
    if(r.ticketUrl) l.push('    ticketUrl: "'+q(r.ticketUrl)+'",');
    if(r.instagram) l.push('    instagram: "'+q(r.instagram)+'",');
    if(r.lineup){
      const arr=String(r.lineup).split(',').map(s=>'"'+q(s.trim())+'"').filter(s=>s!=='""');
      if(arr.length) l.push('    lineup: ['+arr.join(', ')+'],');
    }
    if(r.editions){
      try{
        const eds=typeof r.editions==='string'?JSON.parse(r.editions):r.editions;
        if(Array.isArray(eds)&&eds.length){
          l.push('    editions: [');
          eds.forEach(ed=>{
            const eLineup=(ed.lineup||[]).map(a=>'"'+q(a)+'"').join(', ');
            l.push('      { year: '+ed.year+', date: "'+q(fmtDate(ed.date))+'", lineup: ['+eLineup+'] },');
          });
          l.push('    ],');
        }
      }catch(e){}
    }
    l.push('  },');
    return l.join('\n');
  });
  return 'const FESTIVALS = [\n'+items.join('\n')+'\n];';
}
function buildVenuesJs(rows){
  // draft と id 無し行は公開しない（ARTICLES と同じルール）
  rows = rows.filter(r => String(r.id||'').trim() && (!r.status || String(r.status).toLowerCase() === 'published'));
  const items=rows.map(r=>{
    const l=[];
    l.push('  {');
    l.push('    id: "'+q(r.id)+'",');
    l.push('    name: "'+q(r.name)+'",');
    if(r.city) l.push('    city: "'+q(r.city)+'",');
    if(r.area) l.push('    area: "'+q(r.area)+'",');
    if(r.type) l.push('    type: "'+q(r.type)+'",');
    if(r.image) l.push('    image: "'+q(webp(r.image))+'",');
    if(r.imagePosition) l.push('    imagePosition: "'+q(r.imagePosition)+'",');
    if(r.genre){
      const arr=String(r.genre).split(/[,·]/).map(s=>'"'+q(s.trim())+'"').filter(s=>s!=='""');
      if(arr.length) l.push('    genre: ['+arr.join(', ')+'],');
    }
    const cap=parseInt(r.capacity); if(!isNaN(cap)) l.push('    capacity: '+cap+',');
    if(r.address) l.push('    address: "'+q(r.address)+'",');
    const lat=parseFloat(r.lat); if(!isNaN(lat)) l.push('    lat: '+lat+',');
    const lng=parseFloat(r.lng); if(!isNaN(lng)) l.push('    lng: '+lng+',');
    if(r.url) l.push('    url: "'+q(r.url)+'",');
    if(r.instagram) l.push('    instagram: "'+q(r.instagram)+'",');
    if(r.desc_en) l.push('    desc_en: "'+q(r.desc_en)+'",');
    if(r.name_en) l.push('    name_en: "'+q(r.name_en)+'",');
    if(r.desc) l.push('    desc: "'+q(r.desc)+'"');
    l.push('  },');
    return l.join('\n');
  });
  return 'const VENUES = [\n'+items.join('\n')+'\n];';
}
function buildArticlesJs(rows){
  // Filter out drafts
  const published = rows.filter(r => !r.status || r.status === 'published');
  const items = published.map(r => {
    const l = [];
    l.push('  {');
    l.push('    id: "'+q(r.id)+'",');
    l.push('    title: "'+q(r.title)+'",');
    if(r.title_en) l.push('    title_en: "'+q(r.title_en)+'",');
    if(r.excerpt) l.push('    excerpt: "'+q(r.excerpt)+'",');
    if(r.excerpt_en) l.push('    excerpt_en: "'+q(r.excerpt_en)+'",');
    if(r.body) {
      // Use template literal for multi-line body content; escape backticks
      const safeBody = String(r.body).replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
      l.push('    body: `'+safeBody+'`,');
    }
    if(r.body_en) {
      const safeBodyEn = String(r.body_en).replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$\{/g,'\\${');
      l.push('    body_en: `'+safeBodyEn+'`,');
    }
    if(r.category) l.push('    category: "'+q(r.category)+'",');
    if(r.date) l.push('    date: "'+q(fmtDate(r.date))+'",');
    if(r.author) l.push('    author: "'+q(r.author)+'",');
    if(r.image) l.push('    image: "'+q(r.image)+'",');
    if(r.cardRatio) l.push('    cardRatio: "'+q(r.cardRatio)+'",');
    if(r.festivalId) l.push('    festivalId: "'+q(r.festivalId)+'",');
    if(r.heroRatio) l.push('    heroRatio: "'+q(r.heroRatio)+'",');
    if(r.featured === true || r.featured === 'true' || r.featured === 'TRUE') l.push('    featured: true,');
    if(r.views) l.push('    views: '+(parseInt(r.views,10)||0)+',');
    if(r.readTime) l.push('    readTime: '+(parseInt(r.readTime,10)||5)+',');
    if(r.tags) {
      const tagsArr = Array.isArray(r.tags)
        ? r.tags
        : String(r.tags).split(',').map(t=>t.trim()).filter(Boolean);
      l.push('    tags: '+JSON.stringify(tagsArr)+',');
    }
    l.push('    status: "'+(r.status||'published')+'",');
    l.push('  },');
    return l.join('\n');
  });
  const header = `/* ==========================================================
   ARTICLES — Editorial content for DISCOVER page
   ========================================================== */
`;
  return header + 'const ARTICLES = [\n'+items.join('\n')+'\n];';
}
function downloadFile(filename,content){
  const blob=new Blob([content],{type:'text/javascript'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ==============================================================
   GENERATE CODE — VENUE
   ============================================================== */
function submitVenue(){
  const d={id:g('v-id'),name:g('v-name'),city:g('v-city'),area:g('v-area'),type:g('v-type'),image:g('v-image'),imagePosition:g('v-imagePosition'),genre:getSelectedGenres('v-genre'),capacity:g('v-capacity'),address:g('v-address'),lat:g('v-lat'),lng:g('v-lng'),url:g('v-url'),instagram:g('v-instagram'),desc:g('v-desc')};
  if(!d.id||!d.name)return toast('ID and Name required','error');
  const genreStr=d.genre.map(g=>`"${g}"`).join(', ');
  const lines=[`  {`,`    id: "${d.id}",`,`    name: "${d.name}",`,`    city: "${d.city}",`,`    area: "${d.area}",`,`    type: "${d.type}",`,`    image: "${d.image}",`];
  if(d.imagePosition)lines.push(`    imagePosition: "${d.imagePosition}",`);
  lines.push(`    genre: [${genreStr}],`,`    capacity: ${d.capacity||0},`);
  if(d.address)lines.push(`    address: "${d.address}",`);
  if(d.lat)lines.push(`    lat: ${d.lat},`);if(d.lng)lines.push(`    lng: ${d.lng},`);
  if(d.url)lines.push(`    url: "${d.url}",`);if(d.instagram)lines.push(`    instagram: "${d.instagram}",`);
  lines.push(`    desc: "${escDesc(d.desc)}"`);lines.push(`  },`);
  showOutput('venue',lines.join('\n'));toast('Code generated','success');
}

/* ==============================================================
   GENERATE CODE — FESTIVAL
   ============================================================== */
function submitFestival(){
  const d={id:g('f-id'),type:g('f-type'),name:g('f-name'),city:g('f-city'),location:g('f-location'),location_ja:g('f-location_ja'),url:g('f-url'),ticketUrl:g('f-ticketUrl'),instagram:g('f-instagram'),lat:g('f-lat'),lng:g('f-lng'),dateStart:g('f-dateStart'),dateEnd:g('f-dateEnd'),genre:getSelectedGenres('f-genre'),image:g('f-image'),imagePosition:g('f-imagePosition'),flyer:g('f-flyer'),heroGradient:g('f-heroGradient'),desc:g('f-desc'),lineup:cleanLineup(lineups.f),editions:editions.map(e=>({...e}))};
  if(!d.id||!d.name)return toast('ID and Name required','error');
  const genreStr=d.genre.map(g=>`"${g}"`).join(', ');
  const lineupStr=d.lineup.map(a=>`"${a}"`).join(', ');
  const dateStr=d.dateStart&&d.dateEnd?d.dateStart+'/'+d.dateEnd:d.dateStart||'';
  const lines=[`  {`,`    id: "${d.id}",`,`    type: "${d.type}",`,`    name: "${d.name}",`,`    date: "${dateStr}",`,`    location: "${d.location}",`,`    city: "${d.city}",`];
  if(d.location_ja)lines.push(`    location_ja: "${d.location_ja}",`);
  if(d.lat)lines.push(`    lat: ${d.lat},`);if(d.lng)lines.push(`    lng: ${d.lng},`);
  lines.push(`    image: "${d.image}",`,`    flyer: "${d.flyer}",`);
  if(d.imagePosition)lines.push(`    imagePosition: "${d.imagePosition}",`);
  if(d.heroGradient)lines.push(`    heroGradient: "${d.heroGradient}",`);
  lines.push(`    genre: [${genreStr}],`,`    desc: "${escDesc(d.desc)}",`);
  if(d.url)lines.push(`    url: "${d.url}",`);
  if(d.instagram)lines.push(`    instagram: "${d.instagram}",`);
  lines.push(`    ticketUrl: "${d.ticketUrl||''}",`,`    lineup: [${lineupStr}],`);
  if(d.editions.length){lines.push(`    editions: [`);d.editions.forEach(ed=>{const edL=ed.lineup.map(l=>`"${l}"`).join(', ');lines.push(`      { year: ${ed.year}, date: "${ed.date}", lineup: [${edL}] },`)});lines.push(`    ]`)}
  lines.push(`  },`);
  showOutput('festival',lines.join('\n'));toast('Code generated','success');
}

/* ==============================================================
   GENERATE CODE — ARTIST
   ============================================================== */
function submitArtist(){
  const d={id:g('a-id'),name:g('a-name'),city:g('a-city'),country:g('a-country'),genre:g('a-genre'),image:g('a-image'),imagePosition:g('a-imagePosition'),bio:g('a-bio'),instagram:g('a-instagram'),soundcloud:g('a-soundcloud'),bandcamp:g('a-bandcamp'),website:g('a-website')};
  if(!d.id||!d.name)return toast('ID and Name required','error');
  const lines=[`  {`,`    id: "${d.id}",`,`    name: "${d.name}",`,`    city: "${d.city}",`,`    country: "${d.country}",`,`    genre: "${d.genre}",`,`    image: "${d.image}",`];
  if(d.imagePosition) lines.push(`    imagePosition: "${d.imagePosition}",`);
  lines.push(`    bio: "${escDesc(d.bio)}",`);
  const links=[];
  if(d.instagram)links.push(`      instagram: "${d.instagram}",`);
  if(d.soundcloud)links.push(`      soundcloud: "${d.soundcloud}",`);
  if(d.bandcamp)links.push(`      bandcamp: "${d.bandcamp}",`);
  if(d.website)links.push(`      website: "${d.website}",`);
  if(links.length){lines.push(`    links: {`);lines.push(...links);lines.push(`    }`)}
  lines.push(`  },`);
  showOutput('artist',lines.join('\n'));toast('Code generated','success');
}

/* ==============================================================
   GENERATE CODE — EVENT
   ============================================================== */
function submitEvent(){
  const d={name:g('e-name'),date:g('e-date'),venue:g('e-venue'),city:g('e-city'),time:g('e-time'),desc:g('e-desc'),lineup:[...lineups.e],link:g('e-link')};
  if(!d.name)return toast('Name required','error');
  const lineupStr=d.lineup.map(a=>`"${a}"`).join(', ');
  const lines=[`  {`,`    name: "${d.name}",`,`    date: "${d.date}",`,`    venue: "${d.venue}",`,`    city: "${d.city}",`];
  if(d.time)lines.push(`    time: "${d.time}",`);
  if(d.desc)lines.push(`    desc: "${escDesc(d.desc)}",`);
  if(d.lineup.length)lines.push(`    lineup: [${lineupStr}],`);
  if(d.link)lines.push(`    link: "${d.link}",`);
  lines.push(`  },`);
  showOutput('event',lines.join('\n'));toast('Code generated','success');
}

/* ==============================================================
   GENERATE CODE — ARTICLE
   ============================================================== */
function submitArticle(){
  const d={
    id:g('ar-id'),title:g('ar-title'),excerpt:g('ar-excerpt'),body:g('ar-body'),
    category:g('ar-category'),date:g('ar-date'),author:g('ar-author'),image:g('ar-image'),
    featured:g('ar-featured'),views:g('ar-views'),readTime:g('ar-readTime'),
    status:g('ar-status'),tags:g('ar-tags')
  };
  if(!d.id||!d.title)return toast('ID and Title required','error');
  const escSingle = s => (s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const tagsArr = (d.tags||'').split(',').map(t=>t.trim()).filter(Boolean);
  const lines=[
    `  {`,
    `    id: '${d.id}',`,
    `    title: '${escSingle(d.title)}',`,
    `    excerpt: '${escSingle(d.excerpt)}',`,
    `    body: \`${(d.body||'').replace(/`/g,'\\`')}\`,`,
    `    category: '${d.category}',`,
    `    date: '${d.date}',`,
    `    author: '${escSingle(d.author||'TECHNO JAPAN')}',`,
    `    image: '${d.image}',`,
  ];
  if(d.featured==='true')lines.push(`    featured: true,`);
  lines.push(
    `    views: ${d.views||0},`,
    `    readTime: ${d.readTime||5},`,
    `    tags: ${JSON.stringify(tagsArr)},`,
    `    status: '${d.status||'published'}',`,
    `  },`
  );
  showOutput('article',lines.join('\n'));toast('Code generated','success');
}

/* ==============================================================
   OUTPUT
   ============================================================== */
function showOutput(section,code){
  const panel=document.getElementById('output-'+section),codeEl=document.getElementById('code-'+section);
  codeEl.textContent=code;panel.classList.add('show');
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function copyOutput(section){navigator.clipboard.writeText(document.getElementById('code-'+section).textContent).then(()=>toast('Copied!','success'))}

/* ==============================================================
   RESET
   ============================================================== */
function resetForm(section){
  const fields={
    venue:['v-id','v-name','v-city','v-area','v-image','v-imagePosition','v-capacity','v-address','v-lat','v-lng','v-url','v-instagram','v-desc','v-imageUrl'],
    festival:['f-id','f-name','f-city','f-location','f-location_ja','f-url','f-ticketUrl','f-instagram','f-address','f-lat','f-lng','f-dateStart','f-dateEnd','f-image','f-imagePosition','f-flyer','f-heroGradient','f-desc','f-imageUrl','f-flyerUrl'],
    artist:['a-id','a-name','a-city','a-country','a-genre','a-image','a-imagePosition','a-bio','a-instagram','a-soundcloud','a-bandcamp','a-website','a-imageUrl'],
    event:['e-name','e-date','e-venue','e-city','e-time','e-desc','e-link'],
    article:['ar-id','ar-title','ar-category','ar-date','ar-author','ar-image','ar-imageUrl','ar-readTime','ar-views','ar-excerpt','ar-body','ar-tags','ar-cardRatio','ar-heroRatio','ar-festivalId','ar-title_en','ar-excerpt_en','ar-body_en'],
    author:['au-id','au-name','au-bio','au-image','au-instagram','au-twitter','au-website'],
  }[section];
  fields.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  // プレビューをクリア
  document.querySelectorAll('.img-preview').forEach(p=>{p.style.display='none';p.innerHTML='';});
  if(section==='venue'){document.getElementById('v-type').value='club';document.querySelectorAll('#v-genre .chip').forEach(c=>c.classList.remove('selected'))}
  if(section==='festival'){document.getElementById('f-type').value='festival';document.querySelectorAll('#f-genre .chip').forEach(c=>c.classList.remove('selected'));document.querySelectorAll('#f-gradientPresets .gradient-swatch').forEach(s=>s.classList.remove('selected'));lineups.f=[];renderLineupTags('f');editions.length=0;renderEditions();document.getElementById('lineup-fetch-status').style.display='none';document.getElementById('gradient-preview').style.display='none';document.getElementById('bulk-lineup-wrap').style.display='none'}
  if(section==='event'){lineups.e=[];renderLineupTags('e')}
  if(section==='article'){document.getElementById('ar-category').value='REPORT';document.getElementById('ar-featured').value='false';document.getElementById('ar-status').value='published';document.getElementById('ar-author').value='TECHNO JAPAN';setArticleBody('')}
  // Publishing fields をクリア（author以外）
  if(section !== 'author') clearPubFields(section);
  // author には出力ボックスが無い（無い場合に落ちると保存フローが途中で死ぬ）
  document.getElementById('output-'+section)?.classList.remove('show');
}

/* ==============================================================
   UTILS
   ============================================================== */
function g(id){return document.getElementById(id).value.trim()}
function setVal(id,v){document.getElementById(id).value=v||''}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function escDesc(s){return(s||'').replace(/"/g,'\\"').replace(/\n/g,' ')}
function cleanLineup(arr){return arr.map(a=>a.startsWith('?')?a.substring(1):a)}
function toast(msg,type){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type+' show';clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),3000)}
document.addEventListener('click',e=>{if(!e.target.closest('.lineup-input-wrap'))document.querySelectorAll('.autocomplete-list').forEach(l=>l.classList.remove('show'))});
