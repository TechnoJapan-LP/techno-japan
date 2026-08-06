#!/usr/bin/env node
/**
 * fetch-data.mjs — スプレッドシート「LP」の公開CSV → data/*.json
 *
 * docs/DATA_SCHEMA.md §4/§5/§6 に基づく。依存ゼロ（Node 18+ 内蔵 fetch）。
 *
 * 使い方:
 *   node scripts/fetch-data.mjs            # 取得 → バリデーション → data/*.json 書き出し
 *   node scripts/fetch-data.mjs --dry      # 書き出さず、バリデーション結果だけ表示
 *   node scripts/fetch-data.mjs --offline  # /tmp/tj_*.csv を使う（取得済みキャッシュ）
 *   node scripts/fetch-data.mjs --from-festivals --dry
 *                                          # 旧形式（FESTIVALSから導出）を検証
 *
 * 重要な設計判断:
 *  - EDITIONS / LINEUPS は正式な入力元。FESTIVALS はブランド情報を持ち、
 *    開催回と出演情報は各タブから読み込む（旧形式は --from-festivals で検証可能）。
 *  - STATUS: スキーマ §1.4 は「空欄=draft=非公開」。だが現状セルはほぼ全件空欄で、
 *    本番サイトは表示中。よって暫定で PUBLISH_EMPTY_STATUS=true（空欄=公開扱い）。
 *    シートに published を一括入力し終えたら false にしてスキーマ準拠へ。
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'LP', 'data');

const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has('--dry');
const OFFLINE = ARGS.has('--offline');
// 既定は正式なEDITIONS/LINEUPSシートを使う。旧形式は明示的に指定する。
const EDITIONS_FROM_SHEET = !ARGS.has('--from-festivals');

// スキーマ §1.4 準拠に切り替えるときは false にする
const PUBLISH_EMPTY_STATUS = true;

// --- 公開CSV エンドポイント（スキーマ §4）---
const BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRjtTHfeFBadTxdKF2EGg43Mh_iPVlgnI9vMpuk429vB6boVSqkRaVa5UwaUl-Iku4RAPBCXYCFOLHB/pub?single=true&output=csv';
const GIDS = {
  FESTIVALS: '818164718',
  VENUES: '525830431',
  ARTISTS: '648440679',
  EVENTS: '959929754',
  EDITIONS: '1765363054',
  LINEUPS: '580984930',
};

// GENRE 正規リスト（スキーマ §1.3。必要に応じて追記）
const GENRE_ALLOWED = new Set([
  'TECHNO', 'HOUSE', 'MINIMAL', 'AMBIENT', 'DISCO', 'ELECTRO',
  'BASS', 'DUB', 'EXPERIMENTAL', 'LIVE', 'BREAKBEAT', 'TRANCE',
  'PSYTRANCE', 'PSYCHEDELIC', 'HARDCORE', 'DOWNTEMPO', 'LEFTFIELD',
  'MIX', 'OTHERS',
]);

// ---------- RFC 4180 準拠の最小 CSV パーサ（依存ゼロ）----------
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text).filter(r => r.some(c => c.trim() !== ''));
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
}

async function fetchSheet(name) {
  if (OFFLINE) {
    const p = `/tmp/tj_${name}.csv`;
    if (!existsSync(p)) throw new Error(`offline cache not found: ${p}`);
    return csvToObjects(await readFile(p, 'utf-8'));
  }
  const url = `${BASE}&gid=${GIDS[name]}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return csvToObjects(await res.text());
}

// ---------- バリデーション（スキーマ §6）----------
const errors = [];
const warnings = [];
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; // 連続ハイフン・前後ハイフン禁止

function isPublished(row, statusKey = 'STATUS') {
  const s = (row[statusKey] || '').trim().toLowerCase();
  if (s === 'published') return true;
  if (s === 'draft' || s === 'archived') return false;
  return PUBLISH_EMPTY_STATUS; // 空欄
}

// published 行は errors（ビルド停止）、非公開の下書きは warnings（移行時に直すリスト）。
// スキーマ §6 の狙いは「出力されるデータの品質保証」。下書きのゴミで CI を止めない。
function validateId(sheet, id, seen, isPub) {
  const sink = isPub ? errors : warnings;
  const tag = isPub ? '' : '（draft）';
  if (!id) { sink.push(`${sheet}: ID空欄の行がある${tag}`); return; }
  if (!ID_RE.test(id)) sink.push(`${sheet}: ID形式違反 "${id}"${tag}（[a-z0-9-]+ のみ・連続/前後ハイフン禁止）`);
  if (seen.has(id)) sink.push(`${sheet}: ID重複 "${id}"${tag}`);
  seen.add(id);
}

function checkGenre(sheet, id, genre) {
  if (!genre) return;
  // スキーマ §1.3: 「 · 」区切り。現状はカンマ/中黒混在なので分割は寛容に
  const parts = genre.split(/[·,\/]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  for (const g of parts) {
    if (!GENRE_ALLOWED.has(g)) warnings.push(`${sheet} ${id}: GENRE正規リスト外 "${g}"`);
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Phase 0 移行時、元 DATE セルが Date 型だった行は "Sat Apr 11 2026 00:00:00 GMT+0900" に
// 化ける。ISO へ寄せられれば直し、無理なら空にして警告（下書きの品質リスト）。
function normalizeDate(sheet, id, v) {
  const s = (v || '').trim();
  if (!s || ISO_DATE.test(s)) return s;
  const m = s.match(/^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})/); // JS Date.toString()
  if (m) {
    const mon = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' }[m[1]];
    if (mon) {
      warnings.push(`${sheet} ${id}: DATE を Date型文字列から正規化 "${s}" → ${m[3]}-${mon}-${String(m[2]).padStart(2, '0')}`);
      return `${m[3]}-${mon}-${String(m[2]).padStart(2, '0')}`;
    }
  }
  warnings.push(`${sheet} ${id}: DATE形式不明 "${s}"`);
  return s;
}

function normalizeCoordinate(sheet, id, key, value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const n = Number(s.replace(/[°º]/g, '').trim());
  if (Number.isFinite(n)) {
    const normalized = String(n);
    if (normalized !== s) warnings.push(`${sheet} ${id}: ${key} を数値へ正規化 "${s}" → ${normalized}`);
    return normalized;
  }
  warnings.push(`${sheet} ${id}: ${key}形式不明 "${s}"`);
  return s;
}

// ---------- メタカラム除外（スキーマ §5/§1.6）----------
const DROP_KEYS = new Set([
  'editorNotes', 'lastEditedBy', 'lastEditedAt',
  'EDITORNOTES', 'LASTEDITEDBY', 'LASTEDITEDAT',
]);
function stripMeta(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) {
    if (DROP_KEYS.has(k)) continue;
    if (v === '') continue; // 空欄は出さない（JSON を軽く）
    o[k] = v;
  }
  return o;
}

// ---------- メイン ----------
async function main() {
  console.log(`fetch-data.mjs — ${OFFLINE ? 'OFFLINE' : 'LIVE'}${DRY ? ' (dry-run)' : ''}`);

  const raw = {};
  const fetched = await Promise.all(Object.keys(GIDS).map(async name => [name, await fetchSheet(name)]));
  for (const [name, rows] of fetched) {
    raw[name] = rows;
    console.log(`  ${name}: ${rows.length} 行`);
  }

  const artistIds = new Set(raw.ARTISTS.map(r => r.ID).filter(Boolean));
  const venueIds = new Set(raw.VENUES.map(r => r.ID).filter(Boolean));

  // --- ARTISTS ---
  const seenA = new Set();
  const artists = [];
  for (const r of raw.ARTISTS) {
    const pub = isPublished(r);
    validateId('ARTISTS', r.ID, seenA, pub);
    checkGenre('ARTISTS', r.ID, r.GENRE);
    if (r.URL && /instagram\.com/i.test(r.URL)) warnings.push(`ARTISTS ${r.ID}: URLカラムにinstagram.com`);
    if (!pub) continue;
    artists.push(stripMeta(r));
  }

  // --- VENUES ---
  const seenV = new Set();
  const venues = [];
  for (const r of raw.VENUES) {
    const pub = isPublished(r);
    validateId('VENUES', r.ID, seenV, pub);
    checkGenre('VENUES', r.ID, r.GENRE);
    if (!pub) continue;
    venues.push(stripMeta(r));
  }

  // --- FESTIVALS（ブランド情報）---
  const seenF = new Set();
  const festivals = [];
  for (const r of raw.FESTIVALS) {
    const pub = isPublished(r);
    validateId('FESTIVALS', r.ID, seenF, pub);
    checkGenre('FESTIVALS', r.ID, r.GENRE);
    if (/20\d\d/.test(r.NAME || '')) warnings.push(`FESTIVALS ${r.ID}: NAMEに年 "${r.NAME}"（EDITIONS移行で分離）`);
    // DATE は "YYYY-MM-DD" or "YYYY-MM-DD/YYYY-MM-DD" を許容
    const d0 = (r.DATE || '').split('/')[0].trim();
    if (d0 && !ISO_DATE.test(d0)) warnings.push(`FESTIVALS ${r.ID}: DATE形式 "${r.DATE}"`);
    if (!pub) continue;
    festivals.push(stripMeta({ ...r,
      LAT: normalizeCoordinate('FESTIVALS', r.ID, 'LAT', r.LAT),
      LNG: normalizeCoordinate('FESTIVALS', r.ID, 'LNG', r.LNG),
    }));
  }

  // --- EDITIONS / LINEUPS（正式シートまたは旧互換モード）---
  // EDITION_ID = {festivalId}-{年}。LINEUP（名前カンマ区切り）を ARTISTS.NAME と突合して
  // ARTIST_ID を解決、未解決は ACT_LABEL として残す（旧 migrate-phase0.gs と同じ規則）。
  const yearOf = d => (String(d || '').match(/(\d{4})/) || [])[1] || '';
  const normName = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  // 照合対象は「公開されるアーティスト」だけに絞る。
  //
  // raw.ARTISTS を使うと draft / archived まで拾い、lineups.json に
  // ARTIST_ID が入る。しかし build-detail-pages.mjs が読む data.js は
  // 公開分しか持たないため「ARTIST_ID 参照切れ」で throw してビルドが落ちる。
  // 実際に13名を draft で登録した際に発生した（AUDIT §9-27）。
  //
  // 「掲載したいアーティストのみ登録し、それ以外は draft にする」方針を
  // 採る以上、draft のアクトは ACT_LABEL として名前だけ残るのが正しい。
  const nameToArtist = new Map();
  for (const a of artists) {
    const nm = normName(a.NAME);
    if (nm && !nameToArtist.has(nm)) nameToArtist.set(nm, (a.ID || '').trim());
  }

  const seenE = new Set();
  const editions = [];
  const lineups = [];
  if (EDITIONS_FROM_SHEET) {
    // 正式ソース: EDITIONS / LINEUPS。FESTIVALSから消えた過去回も保持する。
    const festivalIds = new Set(festivals.map(f => String(f.ID || '').trim()));
    for (const r of raw.EDITIONS) {
      const id = String(r.EDITION_ID || '').trim();
      const fid = String(r.FESTIVAL_ID || '').trim();
      const pub = isPublished(r);
      validateId('EDITIONS', id, seenE, pub);
      if (!festivalIds.has(fid)) errors.push(`EDITIONS ${id}: FESTIVAL_ID参照切れ "${fid}"`);
      if (!pub) continue;
      editions.push(stripMeta({
        EDITION_ID:id, FESTIVAL_ID:fid, EDITION:r.EDITION || '',
        DATE_START:normalizeDate('EDITIONS', id, r.DATE_START || ''),
        DATE_END:normalizeDate('EDITIONS', id, r.DATE_END || r.DATE_START || ''),
        LOCATION:r.LOCATION || '', LOCATION_JA:r.LOCATION_JA || '', VENUE_ID:r.VENUE_ID || '',
        PREF:r.PREF || '', ADDRESS:r.ADDRESS || '', LAT:normalizeCoordinate('EDITIONS', id, 'LAT', r.LAT), LNG:normalizeCoordinate('EDITIONS', id, 'LNG', r.LNG),
        TICKETURL:r.TICKETURL || '', FLYER:r.FLYER || '', STATUS:r.STATUS || '',
      }));
    }
    const editionIds = new Set(editions.map(e => e.EDITION_ID));
    // 公開されるアーティストの ID と、draft も含む ID→表示名。
    const publishedArtistIds = new Set(artists.map(a => String(a.ID || '').trim()).filter(Boolean));
    const artistNameById = new Map(
      raw.ARTISTS.map(a => [String(a.ID || '').trim(), String(a.NAME || '').trim()]).filter(([id]) => id));
    const editionsByFestival = new Map();
    for (const e of editions) {
      const list = editionsByFestival.get(String(e.FESTIVAL_ID)) || [];
      list.push(e);
      editionsByFestival.set(String(e.FESTIVAL_ID), list);
    }
    for (const r of raw.LINEUPS) {
      const rawEditionId = String(r.EDITION_ID || '').trim();
      let editionId = rawEditionId;
      if (!editionIds.has(editionId) && editionsByFestival.has(editionId)) {
        const candidates = editionsByFestival.get(editionId).slice().sort((a, b) => String(b.EDITION || '').localeCompare(String(a.EDITION || '')));
        if (candidates.length === 1) {
          editionId = candidates[0].EDITION_ID;
          warnings.push(`LINEUPS ${rawEditionId}: 年なしEDITION_IDを ${editionId} へ移送`);
        } else {
          warnings.push(`LINEUPS ${rawEditionId}: 年なしEDITION_ID（候補 ${candidates.map(e => e.EDITION_ID).join(', ')}）`);
        }
      }
      if (!editionIds.has(editionId)) {
        if (rawEditionId) warnings.push(`LINEUPS ${rawEditionId}: EDITION_ID参照切れ`);
        continue;
      }
      /* ARTIST_ID は「公開されているアーティスト」に対してだけ通す。

         §9-27 と同じ穴が、こちら（正式な LINEUPS 経路）に残っていた。
         artistIds は raw.ARTISTS から作るので draft / archived も含む。
         そのまま lineups.json に ARTIST_ID を残すと、build-detail-pages.mjs が
         読む data.js には公開分しか無いため「ARTIST_ID 参照切れ」で
         ビルドが落ちる。2026-08-06 に 20件（waifu / arch / ala）で再発した。

         方針は §9-27 と同じ:「掲載したいアーティストのみ登録し、
         それ以外は draft にする」以上、draft のアクトは
         ACT_LABEL として名前だけ残るのが正しい。リンクは張らずに出す。
         ここで捨てると出演者そのものが消えるので、名前は必ず残す。 */
      const rawArtistId = String(r.ARTIST_ID || '').trim();
      let artistId = rawArtistId;
      let actLabel = r.ACT_LABEL || '';

      /* ARTIST_ID が空でも、ACT_LABEL が公開アーティストの名前と一致すれば繋ぐ。

         2026-08-06 に the-star-festival / transcendence / rainbow-disco-club /
         99flags の LINEUPS 行が ARTIST_ID 空 + ACT_LABEL 文字列に変わっており、
         CLIPZ・DJ HYPE・Powder・SHERELLE・upsammy など15枠のリンクが外れていた。
         アーティスト詳細への導線と、アーティスト側の「出演フェス」逆引きが
         同時に消えるので、影響は LINEUP の見た目だけに留まらない。

         互換モードは以前からこの名前解決をしている（nameToArtist）。
         同じ規則をこちらにも通し、入力の書き方の違いで導線が消えないようにする。
         b2b / live は「Antal & Hunee」のような複合枠なので解決しない
         （互換モードと同一条件）。 */
      const setTypeRaw = String(r.SET_TYPE || 'dj').trim().toLowerCase();
      if (!artistId && actLabel && setTypeRaw === 'dj') {
        const hit = nameToArtist.get(normName(actLabel));
        if (hit && ID_RE.test(hit)) {
          artistId = hit;
          actLabel = '';   // 表示名は ARTISTS 側を正とする（互換モードと同じ）
        }
      }

      if (artistId && !publishedArtistIds.has(artistId)) {
        const known = artistNameById.get(artistId);
        actLabel = actLabel || known || artistId;
        artistId = '';
        warnings.push(known
          ? `LINEUPS ${editionId}: "${rawArtistId}" は draft/archived のため、リンク無しの「${actLabel}」として出します`
          : `LINEUPS ${editionId}: ARTIST_ID参照切れ "${rawArtistId}" — ARTISTS に存在しません（名前だけ出します）`);
      }
      lineups.push(stripMeta({
        EDITION_ID:editionId, ARTIST_ID:artistId, ACT_LABEL:actLabel,
        SET_TYPE:r.SET_TYPE || 'dj', STAGE:r.STAGE || '', DAY:r.DAY || '',
        START:r.START || '', END:r.END || '', SORT:r.SORT || '',
      }));
    }
  } else {
    // 互換モード: 旧FESTIVALS行から1開催回とLINEUPを導出する。
    for (const r of raw.FESTIVALS) {
      const fid = (r.ID || '').trim();
      if (!fid || !isPublished(r)) continue;
      const dParts = (r.DATE || '').split('/').map(s => s.trim());
      const dStart = normalizeDate('EDITIONS', fid, dParts[0] || '');
      const dEnd = normalizeDate('EDITIONS', fid, dParts[1] || dParts[0] || '');
      const year = yearOf(dStart), editionId = fid + (year ? '-' + year : '');
      validateId('EDITIONS', editionId, seenE, true);
      editions.push(stripMeta({EDITION_ID:editionId,FESTIVAL_ID:fid,EDITION:year,DATE_START:dStart,DATE_END:dEnd,LOCATION:r.LOCATION||'',LOCATION_JA:r.location_ja||r.LOCATION_JA||'',PREF:r.CITY||'',ADDRESS:r.ADDRESS||'',LAT:r.LAT||'',LNG:r.LNG||'',TICKETURL:r.TICKETURL||r[' TICKETURL']||'',FLYER:r.FLYER||'',STATUS:r.STATUS||''}));
      (r.LINEUP || '').split(',').map(s => s.trim()).filter(Boolean).forEach((act, i) => {
        const setType = /-live-/i.test(act) ? 'live' : (/\bb2b\b/i.test(act) ? 'b2b' : 'dj');
        const hit = setType === 'dj' ? nameToArtist.get(normName(act)) : '';
        lineups.push(stripMeta({EDITION_ID:editionId,ARTIST_ID:hit&&ID_RE.test(hit)?hit:'',ACT_LABEL:hit?'':act,SET_TYPE:setType,SORT:String(i+1)}));
      });
    }

  }

  /* 旧 FESTIVALS.LINEUP 列からの導出（移行の橋渡し）。

     FESTIVALS には旧 LINEUP 列が残っており、CMS もそこへ書ける。
     正式モードは LINEUPS シートしか読まないので、旧列にしか出演者が
     無いフェスは詳細ページの LINE UP が**黙って出ない**。
     2026-08-06 の実測で 14フェス / 311名 がこの状態だった
     （etsuetsu 57名 / nu-festival 65名 / global-ark 40名 ほか）。
     ページ自体は正常に描画されるので気づけない。AUDIT §9-46。

     LINEUPS が正式な置き場所であることは変えない。移し終えるまでの間、
     旧列の値を捨てないための導出をここに置く。導出ロジックは下の
     互換モードと同一で、違うのは「対応する開催回を選ぶ」ところだけ。

     ・そのフェスに LINEUPS 行が1行でもあれば、シート側が正。何もしない
     ・FESTIVALS.DATE の年に対応する開催回へ付ける。今の出演者は
       今の開催回のものなので、過去回に付けてはいけない
     ・対応する回が無ければ付け先が無い。警告だけ出す
       （loa-lost-paradise / global-ark が該当。EDITIONS に2026回が無い）

     移行が終われば旧列が空になり、このブロックは自然に何もしなくなる。 */
  {
    const editionsByFestival = new Map();
    for (const e of editions) {
      const a = editionsByFestival.get(e.FESTIVAL_ID) || [];
      a.push(e);
      editionsByFestival.set(e.FESTIVAL_ID, a);
    }
    const festivalsWithLineup = new Set();
    for (const l of lineups) {
      const fid = editions.find(e => e.EDITION_ID === l.EDITION_ID)?.FESTIVAL_ID;
      if (fid) festivalsWithLineup.add(fid);
    }

    for (const r of raw.FESTIVALS) {
      const fid = String(r.ID || '').trim();
      if (!fid || !isPublished(r)) continue;
      if (festivalsWithLineup.has(fid)) continue;
      const acts = String(r.LINEUP || '').split(',').map(x => x.trim()).filter(Boolean);
      if (!acts.length) continue;

      const year = yearOf(normalizeDate('EDITIONS', fid, (r.DATE || '').split('/')[0].trim()));
      const eds = editionsByFestival.get(fid) || [];
      const target = eds.find(e => String(e.EDITION) === String(year))
        || eds.find(e => String(e.DATE_START || '').slice(0, 4) === String(year));
      if (!target) {
        warnings.push(
          `FESTIVALS "${fid}": LINEUP列に${acts.length}名あるが、DATE(${r.DATE})の年に対応する`
          + ` EDITIONS 行が無いため出せません（EDITIONS に ${fid}-${year} を追加してください）`
        );
        continue;
      }
      acts.forEach((act, i) => {
        const setType = /-live-/i.test(act) ? 'live' : (/\bb2b\b/i.test(act) ? 'b2b' : 'dj');
        const hit = setType === 'dj' ? nameToArtist.get(normName(act)) : '';
        lineups.push(stripMeta({
          EDITION_ID: target.EDITION_ID,
          ARTIST_ID: hit && ID_RE.test(hit) ? hit : '',
          ACT_LABEL: hit ? '' : act,
          SET_TYPE: setType, STAGE: '', DAY: '', START: '', END: '',
          SORT: String(i + 1),
        }));
      });
      warnings.push(
        `FESTIVALS "${fid}": LINEUP列の${acts.length}名を ${target.EDITION_ID} へ導出しました`
        + `（LINEUPS シートへ移すとステージ・日別・時間も持てます）`
      );
    }
  }

  // --- EVENTS（IDなし → NAME+DATE で暫定キー。孤児参照チェック）---
  const events = [];
  for (const r of raw.EVENTS) {
    if (r.DATE && !ISO_DATE.test(r.DATE)) warnings.push(`EVENTS "${r.NAME}": DATE形式 "${r.DATE}"`);
    for (const aid of (r.LINEUP || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean)) {
      if (ID_RE.test(aid) && !artistIds.has(aid)) {
        warnings.push(`EVENTS "${r.NAME}": LINEUP孤児参照 "${aid}"（ARTISTSに存在しない）`);
      }
    }
    if (r.VENUE && venueIds.size && !venueIds.has(r.VENUE) && ID_RE.test(r.VENUE)) {
      warnings.push(`EVENTS "${r.NAME}": VENUE "${r.VENUE}" がVENUES未登録`);
    }
    if (!isPublished(r)) continue;
    events.push(stripMeta(r));
  }

  // --- レポート（エラーで停止する前に必ず書き出す）---
  const gen = new Date().toISOString();
  const report = [
    `# データ検証レポート ${gen}`,
    `取得: ${OFFLINE ? 'OFFLINE' : 'LIVE'}`,
    `件数: artists ${artists.length} / venues ${venues.length} / festivals ${festivals.length} / editions ${editions.length} / lineups ${lineups.length} / events ${events.length}`,
    `エラー ${errors.length} / 警告 ${warnings.length}`,
    '',
    '## エラー（published 行の致命的問題・ビルド停止）', ...(errors.length ? errors.map(e => '  ✗ ' + e) : ['  (なし)']),
    '',
    '## 警告（下書き品質・移行時の要修正リスト）', ...(warnings.length ? warnings.map(w => '  ! ' + w) : ['  (なし)']),
    '',
  ].join('\n');
  await writeFile(path.join(ROOT, 'validation-report.txt'), report, 'utf-8');

  console.log(`\n検証: エラー ${errors.length} / 警告 ${warnings.length} → validation-report.txt`);
  if (errors.length) { console.log('\n[エラー]'); errors.forEach(e => console.log('  ✗ ' + e)); }
  if (warnings.length) { console.log(`\n[警告] ${warnings.length}件（詳細は validation-report.txt）`); }

  if (errors.length) {
    console.error('\nエラーがあるためJSON書き出しを停止（スキーマ §6）。validation-report.txt は出力済み。');
    process.exit(1);
  }

  if (DRY) { console.log('\n--dry: JSON書き出しスキップ（レポートのみ）'); return; }

  await mkdir(OUT_DIR, { recursive: true });
  const files = {
    'artists.json': { _generatedAt: gen, count: artists.length, items: artists },
    'venues.json': { _generatedAt: gen, count: venues.length, items: venues },
    'festivals.json': { _generatedAt: gen, count: festivals.length, items: festivals },
    'editions.json': { _generatedAt: gen, count: editions.length, items: editions },
    'lineups.json': { _generatedAt: gen, count: lineups.length, items: lineups },
    'events.json': { _generatedAt: gen, count: events.length, items: events },
  };
  for (const [f, data] of Object.entries(files)) {
    await writeFile(path.join(OUT_DIR, f), JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`  → LP/data/${f} (${data.count}件)`);
  }
  console.log('\n完了。');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
