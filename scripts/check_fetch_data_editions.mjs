#!/usr/bin/env node
/** fetch-data の EDITIONS 欠落フェス補完を純粋関数で検査する。 */
import { synthesizeMissingFestivalEditions } from './fetch-data.mjs';

let failed = 0;
const check = (name, pass, detail='') => {
  if (pass) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};
const normalize = (_sheet, _id, value) => value;

{
  const editions = [], warnings = [];
  const made = synthesizeMissingFestivalEditions({festivals:[{ID:'resonance',DATE:'2026-08-15/2026-08-16',LOCATION:'Venue',CITY:'TOKYO'}],editions,warnings,dateNormalizer:normalize});
  check('EDITIONS無し＋DATEありは開催回を補う', made.length === 1 && editions[0].EDITION_ID === 'resonance-2026' && editions[0].SYNTHESIZED === '1' && warnings[0].includes('resonance'), JSON.stringify({editions,warnings}));
}
{
  const editions = [], warnings = [];
  const made = synthesizeMissingFestivalEditions({festivals:[{ID:'no-date',DATE:''}],editions,warnings,dateNormalizer:normalize});
  check('DATE無しは補わない', made.length === 0 && editions.length === 0 && warnings.length === 0, JSON.stringify({editions,warnings}));
}
{
  const editions = [{FESTIVAL_ID:'existing'}], warnings = [];
  const made = synthesizeMissingFestivalEditions({festivals:[{ID:'existing',DATE:'2026-08-15'}],editions,warnings,dateNormalizer:normalize});
  check('EDITIONSありは補わない', made.length === 0 && editions.length === 1 && warnings.length === 0, JSON.stringify({editions,warnings}));
}

if (failed) process.exit(1);
console.log('✅ fetch-data の開催回補完検査を通過');
