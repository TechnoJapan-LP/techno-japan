(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TJEditionProposals = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';
  const PH = ['PROPOSAL_ID','FESTIVAL_ID','EDITION','DATE_START','DATE_END','VENUE_CHANGED','LOCATION','LOCATION_JA','PREF','ADDRESS','LAT','LNG','SOURCE_URL','SOURCE_QUOTE','CONFIDENCE','REVIEW_STATUS','FOUND_AT','NOTES','APPLIED_AT'];
  const CONFIDENCE = new Set(['high','medium','low']);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const jsDate = /^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}/;
  const k = (v) => String(v).toLowerCase(); const s = (v) => String(v ?? '').trim();
  function val(row, name) { const exact = Object.keys(row || {}).find((x) => x === name); const found = exact || Object.keys(row || {}).find((x) => k(x) === k(name)); return found === undefined ? undefined : row[found]; }
  function parseDate(value) {
    if (iso.test(s(value))) return s(value);
    if (!jsDate.test(s(value))) return null;
    const date = new Date(value); if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
  }
  function clone(row) { return Object.fromEntries(Object.entries(row || {}).filter(([name]) => name !== '_row')); }
  function maxRow(rows) { return Math.max(1, ...rows.map((row) => Number(row?._row) || 1)); }
  const dateFields = new Set(['date_start','date_end','found_at','date']);
  const numericFields = new Set(['lat','lng']);
  function equal(a, b, name = '') {
    if (dateFields.has(k(name))) {
      const left = parseDate(a); const right = parseDate(b);
      if (left && right) return left === right;
    }
    if (numericFields.has(k(name))) {
      const left = Number(a); const right = Number(b);
      if (s(a) !== '' && s(b) !== '' && Number.isFinite(left) && Number.isFinite(right)) return left === right;
    }
    return String(a ?? '') === String(b ?? '');
  }
  function headerPayload(row, headers, overrides = {}) {
    const payload = {};
    for (const name of headers) {
      let value = val(row, name);
      if (dateFields.has(k(name))) value = parseDate(value) || value || '';
      payload[name] = value ?? '';
    }
    for (const [name, value] of Object.entries(overrides)) payload[name] = value;
    return payload;
  }
  function pushLog(log, message) { log.push(message); if (typeof window !== 'undefined') window.__tjEditionLog = log; }
  function dateString(value) { return jsDate.test(s(value)); }
  function jstIso(now) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }).formatToParts(now instanceof Date ? now : new Date(now));
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`;
  }
  function gas(options) {
    const fetcher = options.fetch || (typeof fetch === 'function' ? fetch : null); const url = options.gasUrl || '';
    if (!fetcher) throw new Error('fetch is required');
    return { read: async (sheet) => { const response = await fetcher(`${url}?action=get_sheet&sheet=${encodeURIComponent(sheet)}`); const data = await response.json(); if (data.status !== 'ok') throw new Error(data.message || 'GAS read failed'); return data.rows || []; }, write: async (body) => { const response = await fetcher(url, { method:'POST', body:JSON.stringify(body) }); const data = await response.json(); if (data.status !== 'ok') throw new Error(data.message || 'GAS write failed'); return data; } };
  }
  function proposalRow(input, id) { const row = {}; for (const h of PH) row[h] = input[h] ?? input[h.toLowerCase()] ?? ''; row.PROPOSAL_ID = id; row.REVIEW_STATUS = 'pending'; return row; }
  function validate(input, proposalRows, editionRows) {
    for (const h of ['FESTIVAL_ID','EDITION','DATE_START','DATE_END','VENUE_CHANGED','SOURCE_URL','SOURCE_QUOTE','CONFIDENCE','FOUND_AT']) if (!s(val(input,h))) throw new Error(`${h} is required`);
    const id = `${s(val(input,'FESTIVAL_ID'))}-${s(val(input,'EDITION'))}`;
    if (s(val(input,'PROPOSAL_ID')) !== id) throw new Error(`PROPOSAL_ID must be ${id}`);
    for (const h of ['DATE_START','DATE_END','FOUND_AT']) if (!iso.test(s(val(input,h)))) throw new Error(`${h} must be ISO date`);
    if (!['yes','no'].includes(s(val(input,'VENUE_CHANGED')).toLowerCase())) throw new Error('VENUE_CHANGED must be yes or no');
    if (!CONFIDENCE.has(s(val(input,'CONFIDENCE')).toLowerCase())) throw new Error('CONFIDENCE is invalid');
    if (proposalRows.some((row) => val(row,'PROPOSAL_ID') === id) || editionRows.some((row) => val(row,'EDITION_ID') === id)) throw new Error(`${id} already exists`);
    return id;
  }
  async function appendProposals(proposals, options = {}) {
    const g = gas(options); const existingP = await g.read('EDITION_PROPOSALS'); const existingE = await g.read('EDITIONS'); const plan = []; let rowNumber = maxRow(existingP) + 1;
    for (const input of proposals) { const id = validate(input, existingP.concat(plan.map((item) => item.row)), existingE); plan.push({ rowNumber:rowNumber++, row:proposalRow(input, id) }); }
    const log = []; if (!options.execute) { if (typeof window !== 'undefined') window.__tjEditionLog = log; return { plan, log }; }
    for (const item of plan) { await g.write({action:'update_row',sheet:'EDITION_PROPOSALS',row:item.rowNumber,...item.row}); const saved = (await g.read('EDITION_PROPOSALS')).find((row) => Number(row._row) === item.rowNumber); if (!saved || Object.entries(item.row).some(([name,value]) => !equal(val(saved,name),value,name))) throw new Error(`proposal read-back mismatch: ${item.row.PROPOSAL_ID}`); pushLog(log, `appended ${item.row.PROPOSAL_ID}`); }
    if (typeof window !== 'undefined') window.__tjEditionLog = log; return { plan, log };
  }
  function editionId(proposal) { return `${s(val(proposal,'FESTIVAL_ID'))}-${s(val(proposal,'EDITION'))}`; }
  function latestStart(row) { return parseDate(val(row,'DATE_START')); }
  function reason(error) { return error instanceof Error ? error.message : String(error); }
  async function applyApproved(options = {}) {
    const g = gas(options); const now = options.now || (() => new Date()); const log = []; const initialProposals = await g.read('EDITION_PROPOSALS');
    const selected = initialProposals.filter((row) => s(val(row,'REVIEW_STATUS')).toLowerCase() === 'approved' && (!options.only || options.only.includes(val(row,'PROPOSAL_ID'))));
    for (const selectedProposal of selected) {
      const festivals = await g.read('FESTIVALS'); const editions = await g.read('EDITIONS'); const currentProposals = await g.read('EDITION_PROPOSALS');
      const proposal = currentProposals.find((row) => Number(row._row) === Number(selectedProposal._row)) || currentProposals.find((row) => val(row,'PROPOSAL_ID') === val(selectedProposal,'PROPOSAL_ID'));
      if (!proposal) { pushLog(log, `${val(selectedProposal,'PROPOSAL_ID')}: error: proposal not found`); continue; }
      const id = editionId(proposal);
      let editionRowWritten = null;
      try {
        const festival = festivals.find((row) => s(val(row,'id') ?? val(row,'ID')) === s(val(proposal,'FESTIVAL_ID'))); const existing = editions.filter((row) => s(val(row,'FESTIVAL_ID')) === s(val(proposal,'FESTIVAL_ID')));
        if (!festival) throw new Error('festival not found');
        if (Object.values(festival).some(dateString)) throw new Error('FESTIVALS contains a JS Date string');
        if (editions.some((row) => s(val(row,'EDITION_ID')) === id)) throw new Error('edition already exists');
        const start = parseDate(val(proposal,'DATE_START')); const end = parseDate(val(proposal,'DATE_END')); if (!start || !end || start > end) throw new Error('invalid proposal dates');
        if (!existing.length) throw new Error('festival has no existing edition');
        const latest = existing.slice().sort((a,b) => (latestStart(b) || '').localeCompare(latestStart(a) || ''))[0]; if (latestStart(latest) && start <= latestStart(latest)) throw new Error('date is not after latest edition');
        const changed = s(val(proposal,'VENUE_CHANGED')).toLowerCase() === 'yes'; const edition = { EDITION_ID:id, FESTIVAL_ID:val(proposal,'FESTIVAL_ID'), EDITION:val(proposal,'EDITION'), DATE_START:start, DATE_END:end, LOCATION:changed ? val(proposal,'LOCATION') : val(latest,'LOCATION'), LOCATION_JA:changed ? val(proposal,'LOCATION_JA') : val(latest,'LOCATION_JA'), VENUE_ID:changed ? '' : val(latest,'VENUE_ID'), PREF:changed ? val(proposal,'PREF') : val(latest,'PREF'), ADDRESS:changed ? val(proposal,'ADDRESS') : val(latest,'ADDRESS'), LAT:changed ? val(proposal,'LAT') : val(latest,'LAT'), LNG:changed ? val(proposal,'LNG') : val(latest,'LNG'), TICKETURL:'', FLYER:'', STATUS:'announced' };
        const newEditionRow = maxRow(editions) + 1;
        if (options.execute) { editionRowWritten = newEditionRow; await g.write({action:'update_row',sheet:'EDITIONS',row:newEditionRow,...edition}); const rows = await g.read('EDITIONS'); const saved = rows.find((row) => Number(row._row) === newEditionRow); if (!saved || Object.entries(edition).some(([name,value]) => !equal(val(saved,name),value,name))) throw new Error('EDITIONS read-back mismatch'); if (rows.length !== editions.length + 1) throw new Error('EDITIONS row count changed unexpectedly'); }
        const original = clone(festival); const dateValue = start === end ? start : `${start}/${end}`; const festivalPayload = {...original}; for (const name of Object.keys(festivalPayload)) if (k(name) === 'date') festivalPayload[name] = dateValue; festivalPayload.DATE = dateValue;
        if (options.execute) { await g.write({action:'update_row',sheet:'FESTIVALS',row:Number(festival._row),...festivalPayload}); const saved = (await g.read('FESTIVALS')).find((row) => Number(row._row) === Number(festival._row)); const ignored = new Set(['date','lasteditedat','lasteditedby']); const mismatches = Object.keys(original).filter((name) => !ignored.has(k(name)) && !equal(val(saved,name),festivalPayload[name],name)); if (mismatches.length) throw new Error(`FESTIVALS read-back mismatch: ${mismatches.join(', ')}`); }
        const applied = headerPayload(proposal, PH, {REVIEW_STATUS:'applied', APPLIED_AT:jstIso(now())}); if (options.execute) await g.write({action:'update_row',sheet:'EDITION_PROPOSALS',row:Number(proposal._row),...applied}); pushLog(log, `${id}: applied`);
      } catch (error) {
        const message = reason(error); if (options.execute) { const note = editionRowWritten ? `${message} / EDITIONS row ${editionRowWritten} already written` : message; const failed = headerPayload(proposal, PH, {REVIEW_STATUS:'error', NOTES:[s(val(proposal,'NOTES')),note].filter(Boolean).join(' / ')}); await g.write({action:'update_row',sheet:'EDITION_PROPOSALS',row:Number(proposal._row),...failed}); }
        pushLog(log, `${id}: error: ${message}`); if (/read-back mismatch/.test(message)) throw error;
      }
    }
    if (typeof window !== 'undefined') window.__tjEditionLog = log;
    return options.execute ? log : { plan:selected.map((row) => ({proposalId:val(row,'PROPOSAL_ID'),action:'apply'})), log };
  }
  return { appendProposals, applyApproved, parseDate };
}));
