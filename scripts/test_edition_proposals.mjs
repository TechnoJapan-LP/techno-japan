#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { findCandidates } from './editions/candidates.mjs';
import './editions/cms-edition-proposals.js';
const proposals = globalThis.TJEditionProposals;

const headers = { EDITION_PROPOSALS:['PROPOSAL_ID','FESTIVAL_ID','EDITION','DATE_START','DATE_END','VENUE_CHANGED','LOCATION','LOCATION_JA','PREF','ADDRESS','LAT','LNG','SOURCE_URL','SOURCE_QUOTE','CONFIDENCE','REVIEW_STATUS','FOUND_AT','NOTES','APPLIED_AT'], EDITIONS:['EDITION_ID','FESTIVAL_ID','EDITION','DATE_START','DATE_END','LOCATION','LOCATION_JA','VENUE_ID','PREF','ADDRESS','LAT','LNG','TICKETURL','FLYER','STATUS'], FESTIVALS:['ID','DATE','name','desc','ticketurl','ticketUrl','flyer','lastEditedAt','lineup'], LINEUPS:['EDITION_ID','ARTIST_ID','ACT_LABEL','SET_TYPE','SORT'] };
function fakeGas(initial, { mismatch = false, dateStrings = false, proposalDateCells = false } = {}) {
  const sheets = structuredClone(initial); const calls = [];
  const norm = (x) => String(x).toLowerCase(); const rows = (sheet) => sheets[sheet];
  const response = (data) => ({ ok:true, async json(){ return data; } });
  const fetch = async (url, options = {}) => {
    if (!options.method) { const sheet = new URL(url).searchParams.get('sheet'); return response({status:'ok',rows:structuredClone(rows(sheet))}); }
    const body = JSON.parse(options.body); calls.push(body); const seen = new Map(); for (const [name, value] of Object.entries(body)) { const lower = norm(name); if (seen.has(lower) && String(seen.get(lower) ?? '') !== String(value ?? '')) throw new Error(`case-insensitive duplicate payload key: ${name}`); seen.set(lower, value); } const sheet = rows(body.sheet); const index = sheet.findIndex((r) => Number(r._row) === Number(body.row)); const target = index >= 0 ? index : sheet.length;
    const output = {}; for (const h of headers[body.sheet]) { const source = Object.keys(body).find((k) => k === h) || Object.keys(body).find((k) => norm(k) === norm(h)); const value = source === undefined ? '' : body[source]; if (value !== '' && value !== undefined) output[h === 'ticketUrl' ? h : h.toLowerCase()] = value; }
    for (const name of ['lat','lng']) if (output[name] !== undefined && output[name] !== '') output[name] = Number(output[name]);
    if (proposalDateCells && body.sheet === 'EDITION_PROPOSALS') for (const name of ['DATE_START','DATE_END','FOUND_AT']) if (output[name.toLowerCase()]) { const [year, month, day] = output[name.toLowerCase()].split('-'); output[name.toLowerCase()] = `Fri Apr 23 2027 00:00:00 GMT+0900 (日本標準時)`.replace('2027', year).replace('Apr', ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]).replace('23', day); }
    output._row = Number(body.row); if (mismatch && body.sheet === 'FESTIVALS') output.desc = 'CORRUPTED';
    sheet[target] = output; return response({status:'ok'});
  };
  if (dateStrings) sheets.FESTIVALS[0].DATE = 'Sat Oct 10 2026 00:00:00 GMT+0900 (日本標準時)';
  return { fetch, calls, sheets };
}
const baseFestival = {_row:12, ID:'alpha', DATE:'2026-10-10', name:'Alpha', desc:'keep me', ticketurl:'old-a', ticketUrl:'old-a', flyer:'brand-flyer', lastEditedAt:'x'};
const baseEdition = {_row:121, edition_id:'alpha-2026', festival_id:'alpha', edition:'2026', date_start:'2026-10-10', date_end:'2026-10-11', location:'Old Hall', location_ja:'旧会場', venue_id:'venue-old', pref:'Tokyo', address:'address', lat:'35', lng:'139', ticketurl:'old-ticket', flyer:'old-flyer', status:'ended'};
const proposal = {PROPOSAL_ID:'alpha-2027',FESTIVAL_ID:'alpha',EDITION:'2027',DATE_START:'2027-10-10',DATE_END:'2027-10-11',VENUE_CHANGED:'no',LAT:'35.7530',LNG:'139.1230',SOURCE_URL:'https://example.test',SOURCE_QUOTE:'official date',CONFIDENCE:'high',FOUND_AT:'2026-11-26'};

{
  const legacyFestival = {...baseFestival, lineup:'Old Artist'};
  const dryFake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[legacyFestival],LINEUPS:[]});
  const dry = await proposals.applyApproved({fetch:dryFake.fetch,gasUrl:'https://gas',execute:false});
  assert.equal(dry.plan[0].action, 'blocked-legacy-lineup');
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[legacyFestival],LINEUPS:[]});
  await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true});
  assert.equal(fake.calls.filter((x) => x.sheet === 'EDITIONS' || x.sheet === 'FESTIVALS').length, 0);
  assert.equal(fake.sheets.EDITION_PROPOSALS[0].review_status, 'error');
  assert.match(fake.sheets.EDITION_PROPOSALS[0].notes, /legacy LINEUP only: move FESTIVALS\.LINEUP into LINEUPS for alpha-2026 before applying/);
}
{
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[{...baseFestival,lineup:'Old Artist'}],LINEUPS:[{_row:8,edition_id:'alpha-2026',artist_id:'old-artist',act_label:'Old Artist',set_type:'live',sort:1}]});
  const result = await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true});
  assert.match(result[0], /applied/);
}
{
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival],LINEUPS:[]});
  const result = await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true});
  assert.match(result[0], /applied/);
}

{
  const fake = fakeGas({EDITION_PROPOSALS:[], EDITIONS:[{_row:5,edition_id:'x-2020',festival_id:'x'}], FESTIVALS:[]});
  const dry = await proposals.appendProposals([proposal], {fetch:fake.fetch,gasUrl:'https://gas',execute:false});
  assert.equal(dry.plan[0].rowNumber, 2); assert.equal(fake.calls.length, 0); assert.equal(dry.plan[0].row.REVIEW_STATUS, 'pending');
  const gap = fakeGas({EDITION_PROPOSALS:[{_row:2,proposal_id:'old'}], EDITIONS:[], FESTIVALS:[]});
  const appended = await proposals.appendProposals([proposal], {fetch:gap.fetch,gasUrl:'https://gas',execute:true}); assert.equal(appended.plan[0].rowNumber, 3); assert.equal(gap.calls.length, 1);
  const dates = fakeGas({EDITION_PROPOSALS:[], EDITIONS:[], FESTIVALS:[]}, {proposalDateCells:true}); const dated = await proposals.appendProposals([proposal], {fetch:dates.fetch,gasUrl:'https://gas',execute:true}); assert.equal(dated.log.length, 1);
}
{
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]});
  const result = await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true,now:()=>new Date('2026-11-26T01:00:00Z')});
  assert.match(result[0], /applied/); const editionWrite = fake.calls.find((x) => x.sheet === 'EDITIONS'); assert.equal(editionWrite.row, 122); assert.equal(editionWrite.LOCATION, 'Old Hall'); assert.equal(editionWrite.TICKETURL, '');
  assert.equal(fake.calls.some((x) => x.sheet === 'EDITIONS' && x.row === 121), false);
  const festWrite = fake.calls.find((x) => x.sheet === 'FESTIVALS'); assert.equal(festWrite.desc, 'keep me'); assert.equal(festWrite.ticketurl, 'old-a'); assert.equal(festWrite.ticketUrl, 'old-a'); assert.equal(festWrite.DATE, '2027-10-10/2027-10-11');
  const savedProposal = fake.sheets.EDITION_PROPOSALS[0]; assert.equal(savedProposal.review_status, 'applied'); assert.ok(savedProposal.applied_at);
}
{
  const emptyLatest = {...baseEdition, flyer:''};
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[emptyLatest],FESTIVALS:[baseFestival]});
  const dry = await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:false});
  assert.equal(dry.plan[0].action, 'copy-flyer-and-apply'); assert.equal(fake.calls.length, 0);
  await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true});
  const copy = fake.calls.find((x) => x.sheet === 'EDITIONS' && x.row === 121); assert.equal(copy.flyer, 'brand-flyer');
  assert.equal(fake.sheets.EDITIONS.find((row) => row._row === 121).flyer, 'brand-flyer');
  assert.equal(fake.sheets.EDITIONS.find((row) => row._row === 122).flyer || '', '');
}
{
  const secondFestival = {...baseFestival, _row:13, ID:'beta', name:'Beta'};
  const secondEdition = {...baseEdition, _row:122, edition_id:'beta-2026', festival_id:'beta'};
  const secondProposal = {...proposal, PROPOSAL_ID:'beta-2027', FESTIVAL_ID:'beta'};
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'},{_row:4,...secondProposal,review_status:'approved'}], EDITIONS:[baseEdition,secondEdition], FESTIVALS:[baseFestival,secondFestival]});
  const result = await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true,now:()=>new Date('2026-11-26T01:00:00Z')});
  assert.equal(result.filter((line) => /applied/.test(line)).length, 2); assert.deepEqual(fake.sheets.EDITIONS.map((row) => row.edition_id).sort(), ['alpha-2026','alpha-2027','beta-2026','beta-2027']); assert.equal(fake.sheets.EDITIONS.length, 4);
}
{
  for (const bad of [
    { name:'missing festival', data:{EDITION_PROPOSALS:[{_row:3,...proposal,FESTIVAL_ID:'missing',review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]} },
    { name:'duplicate edition', data:{EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition,{...baseEdition,_row:8,edition_id:'alpha-2027'}],FESTIVALS:[baseFestival]} },
    { name:'backwards date', data:{EDITION_PROPOSALS:[{_row:3,...proposal,DATE_START:'2025-01-01',DATE_END:'2025-01-02',review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]} },
    { name:'no edition', data:{EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[],FESTIVALS:[baseFestival]} },
  ]) { const fake = fakeGas(bad.data); await proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true}); assert.equal(fake.calls.at(-1).sheet,'EDITION_PROPOSALS',bad.name); assert.equal(fake.sheets.EDITION_PROPOSALS[0].review_status,'error'); }
}
{
  const fake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]}, {mismatch:true}); await assert.rejects(() => proposals.applyApproved({fetch:fake.fetch,gasUrl:'https://gas',execute:true})); assert.match(fake.sheets.EDITION_PROPOSALS[0].notes, /EDITIONS row 122 already written/);
  const dateFake = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,DATE_START:'Sat Oct 10 2027 00:00:00 GMT+0900 (日本標準時)',DATE_END:'Sun Oct 11 2027 00:00:00 GMT+0900 (日本標準時)',review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]}); await proposals.applyApproved({fetch:dateFake.fetch,gasUrl:'https://gas',execute:true}); assert.equal(dateFake.calls.find((x) => x.sheet === 'EDITIONS').DATE_START,'2027-10-10');
  const badDate = fakeGas({EDITION_PROPOSALS:[{_row:3,...proposal,review_status:'approved'}],EDITIONS:[baseEdition],FESTIVALS:[baseFestival]}, {dateStrings:true}); await proposals.applyApproved({fetch:badDate.fetch,gasUrl:'https://gas',execute:true}); assert.equal(badDate.calls.length,1); assert.equal(badDate.calls[0].sheet,'EDITION_PROPOSALS');
}
{
  const candidates = findCandidates([{id:'jp-old',name:'Old',country:'JP',date:'2025-01-01',editions:[{year:'2025',date:'2025-01-01'}]},{id:'foreign',country:'US',date:'2020-01-01'},{id:'future',country:'',date:'2027-01-01'}],{today:'2026-11-26',checked:{'jp-old':{checked_at:'2026-11-01T00:00:00+09:00'}},all:false}); assert.equal(candidates.length,0); assert.equal(findCandidates([{id:'jp-old',name:'Old',country:'JP',date:'2025-01-01'}],{today:'2026-11-26',all:true})[0].id,'jp-old');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'edition-fixture-')); const fixture = path.join(dir,'data.js'); fs.writeFileSync(fixture,'const FESTIVALS = [{id:"a",name:"A",country:"JP",date:"2025-01-01"},{id:"b",name:"B",country:"US",date:"2020-01-01"}];'); const run = spawnSync(process.execPath,['scripts/editions/candidates.mjs','--data',fixture,'--today','2026-11-26','--all'],{encoding:'utf8'}); assert.equal(run.status,0); assert.equal(JSON.parse(run.stdout)[0].id,'a');
}
console.log('✅ 次回開催の提案と反映（模擬GAS）');
