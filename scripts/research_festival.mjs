#!/usr/bin/env node
/**
 * フェス調査の下ごしらえ — INBOX からスケルトン JSON を作り、座標を埋め、検証する。
 *
 * ■ このスクリプトは Web 検索をしない
 *
 *   検索と本文の読み取りは Claude（このリポジトリで作業しているエージェント）が行う。
 *   スクリプトが担うのは「機械的に決まる部分」だけ:
 *     - INBOX の読み取りと ID の生成
 *     - Nominatim による座標取得
 *     - スキーマ検証
 *     - JSON の読み書き
 *   調べた値と出典を JSON に書き込むのは Claude の仕事。
 *   分担をこう切ったのは、検索結果の取捨選択（第一弾発表か全出演者か等）に
 *   判断が要り、機械化すると誤りが静かに混ざるため。
 *
 * ■ シートには書き込まない
 *
 *   出力は data/inbox/<id>.json のみ。シートへの反映（add_festival）は Phase 2。
 *   数件回して JSON の精度を確認してから進める。
 *
 * ■ CSV を作らない
 *
 *   列ズレ事故（HACHA MECHA 2回 / SPRING LOVE 春風 1回）は「数え間違い」ではなく
 *   「30列を数えなければならない形式を使っていたこと」が原因。GAS の
 *   buildRowFromHeaders はヘッダー名で突合するので、Phase 2 では名前付き JSON を
 *   そのまま渡す。列位置という概念を経路から消す。
 *
 * 使い方:
 *   node scripts/research_festival.mjs init              # INBOX から雛形を作る
 *   node scripts/research_festival.mjs init --name "..."  # 1件だけ手で足す
 *   node scripts/research_festival.mjs geocode <id>      # LOCATION から座標
 *   node scripts/research_festival.mjs validate [<id>]   # スキーマ検証
 *   node scripts/research_festival.mjs list              # 進捗一覧
 *   node scripts/research_festival.mjs stale [日数]      # 古い調査項目（既定14日）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'data', 'inbox');

// fetch-data.mjs と同じ公開CSV。INBOX は既定シート（gid 指定なし）。
const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub?output=csv';

// DATA_SCHEMA §1.1。fetch-data.mjs:107 / check_regressions.py と同一。
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// 単日は YYYY-MM-DD、複数日は開始/終了（cms.js の ds+'/'+de と同じ形）
const DATE_RE = /^\d{4}-\d{2}-\d{2}(\/\d{4}-\d{2}-\d{2})?$/;

/**
 * 調査で埋める項目。FESTIVALS の列名に合わせる（列順ではなく名前で対応させる）。
 * auto: スクリプトが埋める / research: Claude が調べる / human: 人が書く
 */
const FIELDS = [
  ['id',          'auto',     'スラッグ。DATA_SCHEMA §1.1'],
  ['name',        'auto',     'INBOX の FES_NAME'],
  ['date',        'research', 'YYYY-MM-DD または YYYY-MM-DD/YYYY-MM-DD'],
  ['location',    'research', '会場名（英字表記）'],
  ['location_ja', 'research', '会場名（日本語）。座標検索はこちらの方が当たる'],
  ['city',        'research', '都市名'],
  ['address',     'research', '住所。公式サイトに無いことが多い'],
  ['lat',         'auto',     'geocode で取得'],
  ['lng',         'auto',     'geocode で取得'],
  ['url',         'research', '公式サイト'],
  ['instagram',   'research', '公式 Instagram。公式サイトに無いことが多い'],
  ['ticketUrl',   'research', 'チケット販売URL。無料開催なら null'],
  ['lineup',      'research', '出演者。ステージ別・日別は現状の列で表現できない（AUDIT §9-22）'],
  ['genre',       'human',    '正規リスト（DATA_SCHEMA §1.3）から選ぶ'],
  ['desc',        'human',    'メディアのトーンに関わるため人が書く'],
  ['desc_en',     'human',    '同上'],
];

const RESEARCH_KEYS = FIELDS.filter(([, k]) => k === 'research').map(([f]) => f);

// ---------------------------------------------------------------- 小道具

const read = (p) => fs.readFileSync(p, 'utf8');
const jsonPath = (id) => path.join(OUT_DIR, `${id}.json`);

/** RFC4180 の最小実装。引用符内のカンマと改行を落とさない。 */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/**
 * フェス名から ID を作る。ASCII 化できない文字が残る場合は null を返し、
 * 人にローマ字を決めてもらう（勝手にローマ字化すると表記ゆれの原因になる）。
 */
function slugify(name) {
  const norm = String(name).normalize('NFKC').toLowerCase().replace(/[\u2018\u2019`"']/g, '');
  // 落ちる文字を先に検出する。[^a-z0-9]+ で潰すと
  // 「SPRING LOVE 春風 2026」→「spring-love-2026」のように
  // 日本語部分が黙って消え、"妥当に見えるが意味が落ちた ID" ができる。
  const dropped = norm.match(/[^\x00-\x7f]/g);
  if (dropped) return { id: null, dropped: [...new Set(dropped)].join('') };
  const s = norm.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { id: ID_RE.test(s) ? s : null, dropped: null };
}

/**
 * checkedAt は項目ごとに持つ。文書単位で1つだけ持つと、geocode を流し直しただけで
 * 全体が「今日確認済み」に見えてしまい、ラインナップの鮮度を偽る。
 * 項目ごとに変化の速さが違う（lineup は第一弾→第二弾→全出演者と動くが、
 * url はほぼ変わらない）ので、再調査の判断も項目単位でしかできない。
 */
function nowJst() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().replace(/\.\d+Z$/, '+09:00');
}

/**
 * INBOX の DATE を canonical な形（YYYY-MM-DD / YYYY-MM-DD/YYYY-MM-DD）に寄せる。
 * 寄せられなければ null を返し、生値だけ残す。勝手に解釈して黙って変えない。
 */
function normalizeInboxDate(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (DATE_RE.test(t)) return t;
  const iso = t.replace(/[./]/g, '-').replace(/\s+/g, '');
  // 2026-8-14〜2026-8-15 / 2026-8-14-15 のような書き方を拾う
  const m = iso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[~〜–—-]+(?:(\d{4})-)?(?:(\d{1,2})-)?(\d{1,2}))?$/);
  if (!m) return null;
  const p = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const start = p(m[1], m[2], m[3]);
  if (!m[6]) return start;
  return `${start}/${p(m[4] || m[1], m[5] || m[2], m[6])}`;
}

function field(kind, note) {
  return { value: null, source: null, confidence: null, reason: null, checkedAt: null,
           inboxValue: null, conflictNote: null, kind, note };
}

function skeleton(name, id, inbox = {}) {
  const fields = {};
  for (const [f, kind, note] of FIELDS) fields[f] = field(kind, note);
  fields.name.value = name;
  fields.name.source = 'INBOX';
  fields.name.confidence = 'high';
  fields.name.checkedAt = nowJst();
  fields.id.value = id;
  fields.id.source = 'slugify(name)';
  fields.id.confidence = id ? 'high' : null;
  fields.id.checkedAt = id ? nowJst() : null;

  // INBOX の DATE は「人が把握している申告値」で、正確とは限らない。
  // value には入れない。入れると未検証の値が調査済みに見える。
  // 調査で確定した値と食い違ったら validate が検出する。
  const rawDate = inbox.DATE ?? inbox.date ?? '';
  if (String(rawDate).trim()) {
    const norm = normalizeInboxDate(rawDate);
    fields.date.inboxValue = norm ?? String(rawDate).trim();
    fields.date.note = `INBOX の申告: ${String(rawDate).trim()}`
      + (norm && norm !== String(rawDate).trim() ? `（正規化: ${norm}）` : '')
      + (norm ? '' : '（形式を解釈できず。生値のまま）')
      + '。未検証なので公式情報と突き合わせること';
  }
  if (!id) fields.id.reason = 'ASCII 以外の文字を含むため、ローマ字表記を人が決める必要がある';
  return {
    _schema: 'festival-research/2',
    _createdAt: nowJst(),
    _note: '値と出典は Claude が埋める。DESC/DESC_EN は人が書く（空のままでよい）。',
    inbox,
    fields,
  };
}

// ---------------------------------------------------------------- 既存照合

/**
 * 既存の FESTIVALS を読む。INBOX の名前が既に登録済みなら、Phase 2 は
 * add_festival（新規作成）ではなく update_row（空欄補完）でなければならない。
 * これを見ずに追加すると同じフェスが二重登録される。
 */
function loadExisting() {
  const p = path.join(ROOT, 'LP', 'data.js');
  if (!fs.existsSync(p)) return [];
  const src = read(p);
  const out = [];
  // data.js は生成物。パースせず必要な項目だけ拾う（評価はしない）。
  for (const m of src.matchAll(/\n  \{\n(?:.*\n)*?  \},/g)) {
    const blk = m[0];
    const g = (k) => blk.match(new RegExp(`\\n    ${k}: "((?:[^"\\\\]|\\\\.)*)"`))?.[1];
    const id = g('id');
    if (!id) continue;
    const filled = ['location', 'address', 'lat', 'lng', 'url', 'instagram',
                    'ticketUrl', 'lineup', 'image', 'flyer', 'desc']
      .filter((k) => new RegExp(`\\n    ${k}: `).test(blk));
    out.push({ id, name: g('name') ?? '', date: g('date') ?? '', filled });
  }
  return out;
}

const normName = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function findExisting(all, name) {
  const n = normName(name);
  const n2 = normName(String(name).replace(/\s*20\d\d\s*$/, ''));
  return all.find((f) => normName(f.name) === n || normName(f.id) === n
                      || normName(f.name) === n2 || normName(f.id) === n2) ?? null;
}

// ---------------------------------------------------------------- init

async function cmdInit(args) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manual = args.find((a) => a.startsWith('--name='))?.slice(7)
    ?? (args.includes('--name') ? args[args.indexOf('--name') + 1] : null);

  const onlyArg = args.find((a) => a.startsWith('--only='))?.slice(7)
    ?? (args.includes('--only') ? args[args.indexOf('--only') + 1] : null);
  const only = onlyArg ? onlyArg.split(',').map((x) => normName(x)) : null;

  let entries = [];
  if (manual) {
    entries = [{ FES_NAME: manual }];
  } else {
    const rows = parseCsv(await (await fetch(BASE)).text());
    const head = rows[0].map((h) => h.trim());
    const iName = head.findIndex((h) => /^FES_NAME$/i.test(h));
    if (iName < 0) {
      console.error('  INBOX のヘッダーが想定と違います:', head.join(' / '));
      return 1;
    }
    const iStatus = head.findIndex((h) => /^STATUS/i.test(h));
    for (const r of rows.slice(1)) {
      const name = (r[iName] || '').trim();
      if (!name) continue;
      const status = iStatus >= 0 ? (r[iStatus] || '').trim().toLowerCase() : '';
      // new か空欄だけを対象にする。drafted / registered は再処理しない。
      if (status && status !== 'new') continue;
      const rec = {};
      head.forEach((h, i) => { if (h) rec[h] = (r[i] || '').trim(); });
      entries.push(rec);
    }
    if (only) entries = entries.filter((e) => only.includes(normName(e.FES_NAME)));
  }

  if (!entries.length) {
    console.log('  対象がありません（INBOX が空か、STATUS が new の行がない）');
    return 0;
  }

  const existingAll = loadExisting();
  let made = 0, skipped = 0;
  for (const e of entries) {
    const name = e.FES_NAME;
    const { id, dropped } = slugify(name);
    // ID 未確定でも、あとで人が探せるようファイル名は名前由来にする
    // （連番だとどのフェスか分からず、複数件あると照合できない）。
    const stem = id || '_todo-' + Buffer.from(name).toString('base64url').slice(0, 16);
    const out = jsonPath(stem);
    if (fs.existsSync(out)) {
      console.log(`  = ${stem.padEnd(28)} 既存（上書きしない）`);
      skipped++;
      continue;
    }
    const doc = skeleton(name, id, e);
    const hit = findExisting(existingAll, name);
    if (hit) {
      doc.existing = {
        id: hit.id, name: hit.name, date: hit.date, filled: hit.filled,
        note: '既に FESTIVALS に登録済み。Phase 2 は add_festival ではなく'
            + ' update_row で空欄だけ埋めること（追加すると二重登録になる）',
      };
      if (!doc.fields.id.value) {
        doc.fields.id.value = hit.id;
        doc.fields.id.source = '既存 FESTIVALS の行';
        doc.fields.id.confidence = 'high';
        doc.fields.id.reason = null;
        doc.fields.id.checkedAt = nowJst();
      }
    }
    const stem2 = hit ? hit.id : stem;
    fs.writeFileSync(jsonPath(stem2), JSON.stringify(doc, null, 2) + '\n');
    console.log(`  + ${(stem2).padEnd(28)} ${name}` + (hit ? '  [既存行 — 空欄補完]' : '  [新規]'));
    if (!id) console.log(`      ↑ "${dropped ?? ''}" を落とさずに ID 化できません。id.value を手で決めてください`);
    made++;
  }
  console.log(`\n  作成 ${made} / スキップ ${skipped} → ${path.relative(ROOT, OUT_DIR)}/`);
  console.log('  次: Claude が各項目を調べて value と source を埋める');
  return 0;
}

// ---------------------------------------------------------------- geocode

/** Nominatim は 1req/秒。CMS の geocodeFromLocation と同じ順で試す。 */
async function nominatim(q) {
  const u = 'https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1'
    + '&accept-language=ja&q=' + encodeURIComponent(q);
  const r = await fetch(u, { headers: { 'User-Agent': 'techno-japan-research/1.0' } });
  if (!r.ok) return null;
  const d = await r.json();
  return Array.isArray(d) && d[0]?.lat ? d[0] : null;
}

/** 日本国内か。短縮クエリは国外の同名地物を引くことがある（「宝台樹」→ 台湾）。 */
function inJapan(hit) {
  const lat = parseFloat(hit.lat), lon = parseFloat(hit.lon);
  if (!(lat >= 24 && lat <= 46 && lon >= 122 && lon <= 154)) return false;
  return /日本|Japan/.test(hit.display_name || '');
}

/**
 * 住所を段階的に短くした候補を作る。番地まで載っていない地物が多く、
 * フルの住所では当たらないことがある（実測: 群馬県利根郡みなかみ町藤原915-1 は外れ、
 * みなかみ町藤原 は当たる）。短くするほど粗くなるので confidence を下げる。
 */
function addressCandidates(addr) {
  const a = String(addr || '').trim();
  if (!a) return [];
  const out = [a];
  const noNum = a.replace(/[甲乙丙丁]?[\d０-９]+([-−ー－][\d０-９]+)*$/, '').trim();
  if (noNum && noNum !== a) out.push(noNum);
  const noAza = noNum.replace(/字[^字]*$/, '').trim();
  if (noAza && noAza !== noNum) out.push(noAza);
  // 都道府県を落とすと当たることがある（実測: みなかみ町藤原）
  const noPref = (out[out.length - 1] || a).replace(/^.{2,3}[都道府県]/, '').replace(/^.{2,4}郡/, '').trim();
  if (noPref && !out.includes(noPref)) out.push(noPref);
  return [...new Set(out)];
}

async function cmdGeocode(args) {
  const ids = args.filter((a) => !a.startsWith('--'));
  if (!ids.length) return console.error('  id を指定してください'), 1;

  for (const id of ids) {
    const p = jsonPath(id);
    if (!fs.existsSync(p)) { console.error(`  ✗ ${id}: JSON がありません`); continue; }
    const doc = JSON.parse(read(p));
    const f = doc.fields;
    // 日本の施設は日本語名の方が OSM に載っている（cms.js:1318 と同じ理由）
    const loc = f.location_ja?.value || f.location?.value;
    if (!loc && !f.address?.value) {
      console.error(`  ✗ ${id}: location / location_ja / address のいずれも未入力`);
      continue;
    }
    const city = f.city?.value || '';

    // 施設名 → 住所（段階的に短縮）の順。短いクエリほど粗いので後ろに置く。
    const facility = loc ? [[loc, city, 'Japan'].filter(Boolean).join(', '), `${loc}, Japan`] : [];
    const addrQs = addressCandidates(f.address?.value);
    const queries = [...facility, ...addrQs];
    let hit = null, used = null, idx = -1;
    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));   // 1req/秒を守る
      const h = await nominatim(queries[i]);
      if (!h) continue;
      if (!inJapan(h)) {
        console.log(`      × "${queries[i]}" → 国外にヒット（${h.display_name.slice(0, 40)}）。採用しない`);
        continue;
      }
      hit = h; used = queries[i]; idx = i; break;
    }
    // 施設名で当たれば高信頼、住所の短縮で当たったものは粗い点なので下げる
    const conf = idx < facility.length ? 'high' : (idx === facility.length ? 'medium' : 'low');

    if (!hit) {
      for (const k of ['lat', 'lng']) {
        f[k].value = null;
        f[k].reason = `Nominatim で見つからず（試行: ${queries.join(' / ')}）`;
        f[k].checkedAt = nowJst();
      }
      console.log(`  ✗ ${id}: 見つかりません → CMS の「施設名から検索」(resolve_place) を使ってください`);
    } else {
      f.lat.value = Number(parseFloat(hit.lat).toFixed(4));
      f.lng.value = Number(parseFloat(hit.lon).toFixed(4));
      for (const k of ['lat', 'lng']) {
        f[k].source = 'nominatim.openstreetmap.org';
        f[k].confidence = conf;
        f[k].checkedAt = nowJst();
        f[k].note = `query: ${used} → ${hit.display_name}`;
      }
      if (!f.address.value && hit.display_name) {
        f.address.value = hit.display_name;
        f.address.source = 'nominatim.openstreetmap.org';
        f.address.confidence = 'low';
        f.address.checkedAt = nowJst();
        f.address.note = '逆引きの表示名。正式な住所ではないので要確認';
      }
      console.log(`  ✓ ${id}: ${f.lat.value}, ${f.lng.value}  (${hit.display_name.slice(0, 46)})`);
    }
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n');
  }
  return 0;
}

// ---------------------------------------------------------------- validate

function validateDoc(id, doc) {
  const errs = [], warns = [];
  const f = doc.fields || {};
  const v = (k) => f[k]?.value;

  if (!v('id')) errs.push('id が未確定（ローマ字表記を決める）');
  else if (!ID_RE.test(v('id'))) errs.push(`id が規約違反: "${v('id')}"（DATA_SCHEMA §1.1）`);
  else if (v('id') !== id) errs.push(`id "${v('id')}" とファイル名 "${id}" が不一致`);

  if (!v('name')) errs.push('name が空');
  if (v('date') && !DATE_RE.test(v('date')))
    errs.push(`date の形式が不正: "${v('date')}"（YYYY-MM-DD または .../...）`);

  // INBOX の申告と調査結果の食い違い。黙って上書きせず、必ず記録させる。
  // 実例: Sonic Mania がシート上 2026-08-14/15 だったが実際は 2026-08-13。
  const dc = f.date;
  if (dc?.value && dc.inboxValue && dc.value !== dc.inboxValue && !dc.conflictNote)
    errs.push(`date: INBOX の申告 "${dc.inboxValue}" と調査結果 "${dc.value}" が食い違う`
      + ' → conflictNote に経緯を書き、シート側の訂正を報告すること');

  for (const [k, kind] of FIELDS.map(([a, b]) => [a, b])) {
    const cell = f[k];
    if (!cell) { errs.push(`項目 ${k} が JSON に無い`); continue; }
    // 「調べていない」と「無かった」の区別。research 項目が空なら理由が要る。
    if (kind === 'research' && cell.value == null && !cell.reason)
      warns.push(`${k}: 未調査（値が無いなら reason を書く）`);
    if (cell.value != null && kind === 'research' && !cell.source)
      errs.push(`${k}: 値があるのに source が無い`);
    if ((cell.value != null || cell.reason) && !cell.checkedAt && kind !== 'human')
      errs.push(`${k}: 調査済みなのに checkedAt が無い`);
  }
  const done = RESEARCH_KEYS.filter((k) => f[k]?.value != null || f[k]?.reason).length;
  return { errs, warns, progress: `${done}/${RESEARCH_KEYS.length}` };
}

function cmdValidate(args) {
  const only = args.filter((a) => !a.startsWith('--'));
  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((n) => n.endsWith('.json')) : [];
  const targets = only.length ? only.map((i) => `${i}.json`) : files;
  if (!targets.length) return console.log('  対象がありません'), 0;

  let bad = 0;
  for (const n of targets) {
    const id = n.replace(/\.json$/, '');
    const p = path.join(OUT_DIR, n);
    if (!fs.existsSync(p)) { console.error(`  ✗ ${id}: ファイルがありません`); bad++; continue; }
    const { errs, warns, progress } = validateDoc(id, JSON.parse(read(p)));
    const mark = errs.length ? '✗' : warns.length ? '△' : '✓';
    console.log(`  ${mark} ${id.padEnd(28)} 調査 ${progress}`);
    errs.forEach((e) => console.log(`      ERROR ${e}`));
    warns.forEach((w) => console.log(`      warn  ${w}`));
    if (errs.length) bad++;
  }
  return bad ? 1 : 0;
}

/** 何日以上前に調べた項目かを出す。フェス情報は更新されるので再調査の判断に使う。 */
function cmdStale(args) {
  const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 14);
  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((n) => n.endsWith('.json')) : [];
  const limit = Date.now() - days * 86400_000;
  let hits = 0;
  console.log(`  ${days} 日以上前に調べた項目:\n`);
  for (const n of files) {
    const doc = JSON.parse(read(path.join(OUT_DIR, n)));
    const old = Object.entries(doc.fields)
      .filter(([, c]) => c.checkedAt && Date.parse(c.checkedAt) < limit)
      .map(([k, c]) => `${k}(${c.checkedAt.slice(0, 10)})`);
    if (!old.length) continue;
    hits++;
    console.log(`  ${n.replace(/\.json$/, '')}`);
    console.log(`      ${old.join(' ')}`);
  }
  if (!hits) console.log('  なし');
  return 0;
}

function cmdList() {
  const files = fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((n) => n.endsWith('.json')) : [];
  if (!files.length) return console.log('  data/inbox/ は空です'), 0;
  console.log(`  ${'id'.padEnd(28)} 調査   座標  DESC  日付  最終調査      name`);
  for (const n of files) {
    const doc = JSON.parse(read(path.join(OUT_DIR, n)));
    const f = doc.fields;
    const done = RESEARCH_KEYS.filter((k) => f[k]?.value != null || f[k]?.reason).length;
    console.log(`  ${n.replace(/\.json$/, '').padEnd(28)} ${String(done).padStart(2)}/${RESEARCH_KEYS.length}`
      + `  ${f.lat?.value != null ? ' ✓  ' : ' –  '}`
      + `  ${f.desc?.value ? '✓' : '–'}`
      + `     ${f.date?.inboxValue && f.date?.value && f.date.value !== f.date.inboxValue ? '⚠' : ' '}`
      + `     ${(Object.values(f).map((c) => c.checkedAt).filter(Boolean).sort().pop() ?? '—').slice(0, 10)}`
      + `    ${f.name?.value ?? ''}`);
  }
  return 0;
}

// ---------------------------------------------------------------- main

const [cmd, ...rest] = process.argv.slice(2);
const table = { init: cmdInit, geocode: cmdGeocode, validate: cmdValidate, list: cmdList, stale: cmdStale };
if (!table[cmd]) {
  console.log(read(fileURLToPath(import.meta.url)).split('\n').slice(1, 38).join('\n')
    .replace(/^ \*\/?ic?/gm, '').replace(/^\s?\*\s?/gm, ''));
  process.exit(cmd ? 1 : 0);
}
process.exit((await table[cmd](rest)) || 0);
