#!/usr/bin/env node
/**
 * 構造化データ（JSON-LD）と AI 向けファイルが壊れていないか。
 *
 * ■ なぜ必要か（AUDIT §9-79）
 *
 *   構造化データは**人間の目に映らない。**壊れても・消えても、
 *   ページの見た目は1ピクセルも変わらない。気づくのは数週間後、
 *   検索やAIからの流入が減ってから。
 *
 *   実際、出演者（performer）は生成コードが8/1からあったのに、
 *   LINEUPS の501行（81%）が名前だけの行で解決に失敗し、
 *   **ほとんどのフェスで出演者が構造化データから消えていた。**
 *   誰も気づかなかった（診断で実測するまで6週間）。
 *
 * ■ 何を見るか
 *
 *   1. 全ページの ld+json が**パースできる**こと（壊れたJSONは無言で無視される）
 *   2. どのブロックにも @type があること
 *   3. **出演者データがあるフェスのページには performer が出ている**こと
 *      （lineups.json と突き合わせる。これが §9-79 の本命）
 *   4. 開催回（subEvent）に eventStatus が出ていること
 *   5. events.json がパースでき、全件に name / url / start があること
 *   6. llms.txt が存在し、events.json への案内を含むこと
 *
 * 使い方:
 *   node scripts/check_jsonld.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');

let failed = 0;
const problems = [];
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
};

/** ページから ld+json ブロックを全部取り出す。 */
function blocksOf(file) {
  const html = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function* htmlFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(f);
    else if (e.name.endsWith('.html')) yield f;
  }
}

/* --- 1〜2) 全ページのパースと @type --- */
let pages = 0, blocks = 0;
const parseErrors = [];
const noType = [];
for (const f of htmlFiles(LP)) {
  const rel = path.relative(LP, f);
  if (rel.startsWith('vendor') || rel === 'cms.html') continue;
  const bs = blocksOf(f);
  if (!bs.length) continue;
  pages++;
  for (const b of bs) {
    blocks++;
    let d;
    try { d = JSON.parse(b); } catch (e) { parseErrors.push(rel); continue; }
    for (const x of Array.isArray(d) ? d : [d]) {
      if (!x['@type']) noType.push(rel);
    }
  }
}
console.log(`対象: ${pages}ページ / ${blocks}ブロック\n`);
check('全ブロックが JSON としてパースできる', parseErrors.length === 0,
  parseErrors.slice(0, 3).join(', '));
check('全ブロックに @type がある', noType.length === 0, noType.slice(0, 3).join(', '));

/* --- 3) 出演データのあるフェスに performer が出ているか --- */
const lineups = JSON.parse(fs.readFileSync(path.join(LP, 'data', 'lineups.json'), 'utf8')).items;
const withLineup = new Set(
  lineups.filter((l) => String(l.ACT_LABEL || l.ARTIST_ID || '').trim())
    .map((l) => String(l.EDITION_ID || '').replace(/-\d{4}$/, ''))
);
const missingPerformer = [];
let checkedFests = 0;
for (const fid of withLineup) {
  const f = path.join(LP, 'festivals', `${fid}.html`);
  if (!fs.existsSync(f)) continue;   // draft 等でページが無いのは別の検査の担当
  checkedFests++;
  const joined = blocksOf(f).join('');
  if (!joined.includes('"performer"')) missingPerformer.push(fid);
}
check(`出演データのあるフェス ${checkedFests}件すべてに performer が出る`,
  missingPerformer.length === 0, missingPerformer.slice(0, 5).join(', '));

/* --- 4) 開催回に eventStatus --- */
const noStatus = [];
for (const fid of [...withLineup].slice(0, 200)) {
  const f = path.join(LP, 'festivals', `${fid}.html`);
  if (!fs.existsSync(f)) continue;
  for (const b of blocksOf(f)) {
    let d; try { d = JSON.parse(b); } catch { continue; }
    for (const x of Array.isArray(d) ? d : [d]) {
      for (const ev of x.subEvent || []) {
        if (!ev.eventStatus) noStatus.push(fid);
      }
    }
  }
}
check('開催回（subEvent）すべてに eventStatus が出る', noStatus.length === 0,
  [...new Set(noStatus)].slice(0, 5).join(', '));

/* --- 5) events.json --- */
const evPath = path.join(LP, 'events.json');
if (!fs.existsSync(evPath)) {
  check('events.json がある', false);
} else {
  let ev;
  try { ev = JSON.parse(fs.readFileSync(evPath, 'utf8')); } catch (e) { ev = null; }
  check('events.json がパースできる', !!ev);
  if (ev) {
    const bad = (ev.events || []).filter((e) => !e.name || !e.url || !/^\d{4}-\d{2}-\d{2}$/.test(e.start || ''));
    check(`events.json の全${(ev.events || []).length}件に name / url / start(ISO) がある`,
      bad.length === 0, JSON.stringify(bad[0] || {}).slice(0, 80));
    check('events.json にタイムスタンプを埋めていない（毎日の差分ノイズ防止）',
      !JSON.stringify(ev).includes('generatedAt'));
  }
}

/* --- 6) llms.txt --- */
const llmsPath = path.join(LP, 'llms.txt');
if (!fs.existsSync(llmsPath)) {
  check('llms.txt がある', false);
} else {
  const t = fs.readFileSync(llmsPath, 'utf8');
  check('llms.txt がサイト名で始まる', t.startsWith('# TECHNO JAPAN'));
  check('llms.txt が events.json を案内している', t.includes('/events.json'));
  check('llms.txt が sitemap を案内している', t.includes('/sitemap.xml'));
}

/* --- robots.txt が地図を隠していないこと（§9-79 で解除した） --- */
const robots = fs.readFileSync(path.join(LP, 'robots.txt'), 'utf8');
check('robots.txt が map.html を隠していない', !/Disallow:\s*\/map\.html/.test(robots));
check('robots.txt は cms.html を隠したまま', /Disallow:\s*\/cms\.html/.test(robots));

console.log();
if (failed) { console.log(`❌ ${failed}件の問題があります`); process.exit(1); }
console.log('✅ 構造化データと AI 向けファイルは健全');
