/* ==========================================================
   TJ APP (仮) — Festival Companion
   データ源: ../data/*.json（スプレッドシート「LP」→ npm run fetch）
   MVP: フェス選択 → ラインナップ → MY SETS（被り検出）/ オフライン対応
   ========================================================== */

const DATA_BASE = '../data/';
const LS_PREFIX = 'tjapp:sets:';

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DB = { festivals: [], editions: [], lineups: [], artists: [], byFest: new Map(), artistName: new Map(), lineupByEdition: new Map() };

/* ---------- data ---------- */
async function loadData() {
  const get = async name => {
    const res = await fetch(DATA_BASE + name + '.json');
    if (!res.ok) throw new Error(name + ': HTTP ' + res.status);
    return (await res.json()).items || [];
  };
  const [festivals, editions, lineups, artists] = await Promise.all([
    get('festivals'), get('editions'), get('lineups'), get('artists'),
  ]);
  Object.assign(DB, { festivals, editions, lineups, artists });
  DB.byFest = new Map(festivals.map(f => [f.ID, f]));
  DB.artistName = new Map(artists.map(a => [a.ID, a.NAME]));
  DB.lineupByEdition = new Map();
  for (const row of lineups) {
    if (!DB.lineupByEdition.has(row.EDITION_ID)) DB.lineupByEdition.set(row.EDITION_ID, []);
    DB.lineupByEdition.get(row.EDITION_ID).push(row);
  }
}

/* ---------- my sets (localStorage) ---------- */
const actKey = row => (row.SORT || '') + '|' + (row.ARTIST_ID || row.ACT_LABEL || '');
const loadSets = ed => { try { return new Set(JSON.parse(localStorage.getItem(LS_PREFIX + ed) || '[]')); } catch { return new Set(); } };
const saveSets = (ed, set) => localStorage.setItem(LS_PREFIX + ed, JSON.stringify([...set]));

/* ---------- helpers ---------- */
const actName = row => row.ARTIST_ID
  ? (DB.artistName.get(row.ARTIST_ID) || row.ARTIST_ID.replace(/-/g, ' ').toUpperCase())
  : (row.ACT_LABEL || '?');

function fmtRange(s, e) {
  if (!s && !e) return '';
  return [s, e].filter(Boolean).join('–');
}
// "HH:MM" → 分。終了が開始以前なら翌日跨ぎとして +24h
function toMin(t) { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function rangeOf(row) {
  let s = toMin(row.START), e = toMin(row.END);
  if (s == null || e == null) return null;
  if (e <= s) e += 1440;                    // 終了が翌日（23:00–00:30 等）
  if (s < 360) { s += 1440; e += 1440; }    // 6:00 前開始は同 DAY の深夜扱い（00:00–01:00 等）
  return { s, e, day: row.DAY || '' };
}
// 選択中セット同士の時間被り（同一 DAY・時刻あり同士のみ判定）
function findClashes(rows) {
  const clashKeys = new Set();
  const timed = rows.map(r => ({ r, t: rangeOf(r) })).filter(x => x.t);
  for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
    const a = timed[i], b = timed[j];
    if (a.t.day !== b.t.day) continue;
    if (a.t.s < b.t.e && b.t.s < a.t.e) { clashKeys.add(actKey(a.r)); clashKeys.add(actKey(b.r)); }
  }
  return clashKeys;
}
const isFuture = ed => {
  const end = new Date(ed.DATE_END || ed.DATE_START || 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return end >= now;
};

/* ---------- router ---------- */
function route() {
  const h = window.location.hash || '#/';
  let m;
  if ((m = h.match(/^#\/fest\/([a-z0-9-]+)/))) return renderFest(m[1], 'lineup');
  if ((m = h.match(/^#\/my\/([a-z0-9-]+)/))) return renderFest(m[1], 'my');
  return renderPicker();
}

/* ---------- screen: fest picker ---------- */
function renderPicker(query = '') {
  $('#fest-tabs').hidden = true;
  const q = query.trim().toLowerCase();
  const editions = DB.editions
    .filter(ed => {
      if (!q) return true;
      const f = DB.byFest.get(ed.FESTIVAL_ID);
      return (f?.NAME || ed.FESTIVAL_ID).toLowerCase().includes(q) || (ed.PREF || '').toLowerCase().includes(q);
    });
  const upcoming = editions.filter(isFuture).sort((a, b) => new Date(a.DATE_START) - new Date(b.DATE_START));
  const past = editions.filter(ed => !isFuture(ed)).sort((a, b) => new Date(b.DATE_START) - new Date(a.DATE_START));

  const item = ed => {
    const f = DB.byFest.get(ed.FESTIVAL_ID);
    const n = (DB.lineupByEdition.get(ed.EDITION_ID) || []).length;
    const mine = loadSets(ed.EDITION_ID).size;
    return `<button class="fest-item" data-ed="${esc(ed.EDITION_ID)}">
      <span><span class="fest-item-name">${esc(f?.NAME || ed.FESTIVAL_ID)}</span>
        <div class="fest-item-meta">${esc(ed.DATE_START || '')}${ed.DATE_END && ed.DATE_END !== ed.DATE_START ? ' → ' + esc(ed.DATE_END) : ''} · ${esc(ed.PREF || ed.LOCATION || '')}</div></span>
      <span class="fest-item-badge${n ? ' has-lineup' : ''}">${n ? n + ' ACTS' : '—'}${mine ? ' · ★' + mine : ''}</span>
    </button>`;
  };

  $('#screen').innerHTML = `
    <div class="screen-hero">FESTIVAL<br>COMPANION</div>
    <div class="screen-sub">TJ APP (仮) — LINEUPS · MY SETS · OFFLINE</div>
    <div class="offline-note">OFFLINE — 保存済みデータを表示中</div>
    <input class="search-box" id="picker-search" type="search" placeholder="SEARCH FESTIVALS..." value="${esc(query)}" autocomplete="off">
    ${upcoming.length ? `<div class="picker-group-label">Upcoming</div>${upcoming.map(item).join('')}` : ''}
    ${past.length ? `<div class="picker-group-label">Past</div>${past.map(item).join('')}` : ''}
    ${!editions.length ? '<div class="my-empty">NO FESTIVALS FOUND</div>' : ''}
  `;
  $('#picker-search').addEventListener('input', e => {
    const v = e.target.value;
    renderPicker(v);
    const box = $('#picker-search'); box.focus(); box.setSelectionRange(v.length, v.length);
  });
  document.querySelectorAll('.fest-item').forEach(b =>
    b.addEventListener('click', () => { window.location.hash = '#/fest/' + b.dataset.ed; }));
}

/* ---------- screen: lineup / my sets ---------- */
function renderFest(editionId, tab) {
  const ed = DB.editions.find(e => e.EDITION_ID === editionId);
  if (!ed) { window.location.hash = '#/'; return; }
  const f = DB.byFest.get(ed.FESTIVAL_ID);
  const all = (DB.lineupByEdition.get(editionId) || []).slice()
    .sort((a, b) => (a.DAY || '').localeCompare(b.DAY || '') || (toMin(a.START) ?? 9e9) - (toMin(b.START) ?? 9e9) || (+a.SORT || 0) - (+b.SORT || 0));
  const sets = loadSets(editionId);
  const mine = all.filter(r => sets.has(actKey(r)));
  const clashes = findClashes(mine);
  const rows = tab === 'my' ? mine : all;
  const hasTimes = all.some(r => rangeOf(r));

  const rowHtml = r => {
    const k = actKey(r), on = sets.has(k), clash = tab === 'my' && clashes.has(k);
    const link = r.ARTIST_ID ? `<a href="../artists.html#artist/${esc(r.ARTIST_ID)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${esc(actName(r))}</a>` : esc(actName(r));
    return `<div class="act-row${clash ? ' clash' : ''}">
      <button class="act-star${on ? ' on' : ''}" data-k="${esc(k)}" aria-label="MY SETS に追加">${on ? '★' : '☆'}</button>
      <div class="act-main"><div class="act-name">${link}</div>
        ${r.STAGE ? `<div class="act-sub">${esc(r.STAGE)}</div>` : ''}</div>
      ${clash ? '<span class="clash-badge">CLASH</span>' : ''}
      ${r.SET_TYPE && r.SET_TYPE !== 'dj' ? `<span class="set-badge ${esc(r.SET_TYPE)}">${esc(r.SET_TYPE)}</span>` : ''}
      <span class="act-time">${esc(fmtRange(r.START, r.END))}</span>
    </div>`;
  };

  // DAY 見出しでグループ（DAY 無しは単一グループ）
  let listHtml = '';
  let lastDay = '__none__';
  for (const r of rows) {
    const d = r.DAY || '';
    if (d !== lastDay) { if (d) listHtml += `<div class="day-label">DAY ${esc(d)}</div>`; lastDay = d; }
    listHtml += rowHtml(r);
  }
  if (!rows.length) listHtml = `<div class="my-empty">${tab === 'my' ? '☆ をタップして自分のセットを組もう' : 'ラインナップ未登録'}</div>`;

  $('#screen').innerHTML = `
    <div class="offline-note">OFFLINE — 保存済みデータを表示中</div>
    <div class="fest-head">
      <div class="screen-title"><a href="#/">← ALL FESTIVALS</a></div>
      <div class="screen-hero">${esc(f?.NAME || ed.FESTIVAL_ID)}</div>
      <div class="screen-sub">${esc(ed.DATE_START || '')}${ed.DATE_END && ed.DATE_END !== ed.DATE_START ? ' → ' + esc(ed.DATE_END) : ''} · ${esc(ed.LOCATION || '')} ${esc(ed.PREF || '')}</div>
    </div>
    ${listHtml}
    ${tab === 'my' && mine.length ? `<div class="my-actions"><button class="btn-ghost" id="clear-sets">CLEAR ALL</button></div>` : ''}
    ${tab === 'my' && mine.length && !hasTimes ? `<div class="notice">セット時刻（START/END）が公開されると、ここで自動的に時間被りを検出します。</div>` : ''}
  `;

  // タブ
  const tabs = $('#fest-tabs'); tabs.hidden = false;
  $('#tab-lineup').href = '#/fest/' + editionId;
  $('#tab-my').href = '#/my/' + editionId;
  $('#tab-lineup').classList.toggle('active', tab === 'lineup');
  $('#tab-my').classList.toggle('active', tab === 'my');
  $('#my-count').textContent = sets.size ? '★' + sets.size : '';

  // スター切替
  document.querySelectorAll('.act-star').forEach(b => b.addEventListener('click', () => {
    const s = loadSets(editionId);
    s.has(b.dataset.k) ? s.delete(b.dataset.k) : s.add(b.dataset.k);
    saveSets(editionId, s);
    renderFest(editionId, tab);
  }));
  $('#clear-sets')?.addEventListener('click', () => {
    if (confirm('MY SETS をすべて解除しますか？')) { saveSets(editionId, new Set()); renderFest(editionId, tab); }
  });
  window.scrollTo(0, 0);
}

/* ---------- online / offline ---------- */
function updateNet() {
  const off = !navigator.onLine;
  document.body.classList.toggle('is-offline', off);
  $('#net-status').classList.toggle('offline', off);
}
window.addEventListener('online', updateNet);
window.addEventListener('offline', updateNet);

/* ---------- boot ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
window.addEventListener('hashchange', route);
updateNet();
loadData().then(route).catch(err => {
  $('#screen').innerHTML = `<div class="my-empty">データを読み込めませんでした<br>${esc(err.message)}<br><br><button class="btn-ghost" onclick="location.reload()">RELOAD</button></div>`;
});
