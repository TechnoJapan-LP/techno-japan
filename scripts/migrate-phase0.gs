/**
 * Migration.gs — Phase 0 構造移行（docs/DATA_SCHEMA.md §7「構造」）
 *
 * 実施すること:
 *   ① EDITIONS シート新設（FESTIVALS 各行 = 1開催回として切り出し・コピー）
 *   ② LINEUPS シート新設（FESTIVALS.LINEUP をパースし ARTISTS.NAME と突合）
 *   ③ EVENTS に ID カラムを付与（{slug}-{YYYYMMDD}）
 *
 * 安全設計:
 *   - FESTIVALS の既存カラムは削除しない（EDITIONS へコピーするだけ）
 *   - EDITIONS / LINEUPS が既に存在する場合は作成スキップ（上書き事故防止）
 *   - 判断が必要な項目（未解決アーティスト名・B2B分解・年不一致等）は
 *     一切自動で決めず「要確認リスト」に列挙する
 *
 * 使い方:
 *   1) 関数 mig_dryRun を選択して実行 → 実行ログを確認（★変更ゼロ）
 *   2) ログ末尾の「要確認リスト」を人間が確認
 *   3) 問題なければ 関数 mig_apply を実行 → シート生成/追記
 */

var MIG_DRY = true;

function mig_dryRun() { MIG_DRY = true;  migratePhase0_(); }
function mig_apply()  { MIG_DRY = false; migratePhase0_(); }

// 各シートの gid（sheetId）と spreadsheet URL を出力（Phase 1 の fetch-data.mjs 用）
function mig_gids() {
  var ss = SpreadsheetApp.getActive();
  var out = ['spreadsheetUrl: ' + ss.getUrl(), 'spreadsheetId: ' + ss.getId(), '--- sheets (name → gid) ---'];
  ss.getSheets().forEach(function (sh) { out.push(sh.getName() + ' → ' + sh.getSheetId()); });
  Logger.log(out.join('\n'));
}

function migratePhase0_() {
  var ss = SpreadsheetApp.getActive();
  var log = [], review = [];
  function L(s) { log.push(s); }
  function R(s) { review.push(s); }

  L('=== Phase 0 移行 ' + (MIG_DRY ? '[DRY RUN — 変更なし]' : '[APPLY — 書き込み実行]') + ' ===');

  var shFest = ss.getSheetByName('FESTIVALS');
  var shArt  = ss.getSheetByName('ARTISTS');
  var shEv   = ss.getSheetByName('EVENTS');
  if (!shFest || !shArt || !shEv) { L('ERROR: FESTIVALS/ARTISTS/EVENTS のいずれかが見つからない'); return flush_(log, review); }

  function headerMap(sheet) {
    var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var idx = {};
    h.forEach(function (name, i) { idx[String(name).trim()] = i; });
    return { headers: h, idx: idx };
  }
  function rowsOf(sheet) {
    var last = sheet.getLastRow();
    return last < 2 ? [] : sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  }
  function slugify(s) {
    s = String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  }
  function yearOf(d) { var m = String(d || '').match(/(\d{4})/); return m ? m[1] : ''; }
  function isValidId(id) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id); }

  var fH = headerMap(shFest), aH = headerMap(shArt), eH = headerMap(shEv);
  var fRows = rowsOf(shFest), aRows = rowsOf(shArt), eRows = rowsOf(shEv);
  L('FESTIVALS: ' + fRows.length + '行 / ARTISTS: ' + aRows.length + '行 / EVENTS: ' + eRows.length + '行');

  function fget(r, col) { return fH.idx[col] != null ? String(r[fH.idx[col]] || '').trim() : ''; }

  // ARTISTS: NAME(正規化) → {id, name}
  var nameToArtist = {};
  var aIdI = aH.idx['ID'], aNmI = aH.idx['NAME'];
  aRows.forEach(function (r) {
    var nm = String(r[aNmI] || '').trim();
    if (!nm) return;
    var key = nm.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!nameToArtist[key]) nameToArtist[key] = { id: String(r[aIdI] || '').trim(), name: nm };
  });

  var fIdI = fH.idx['ID'], fNmI = fH.idx['NAME'], fDtI = fH.idx['DATE'];

  // ============ ① EDITIONS ============
  var EDITIONS_HEADERS = ['EDITION_ID', 'FESTIVAL_ID', 'EDITION', 'DATE_START', 'DATE_END', 'LOCATION', 'VENUE_ID', 'PREF', 'ADDRESS', 'LAT', 'LNG', 'TICKETURL', 'FLYER', 'STATUS'];
  var editionsData = [];
  fRows.forEach(function (r) {
    var fid = String(r[fIdI] || '').trim();
    if (!fid) return;
    var parts = String(r[fDtI] || '').trim().split('/').map(function (s) { return s.trim(); });
    var dStart = parts[0] || '', dEnd = parts[1] || parts[0] || '';
    var edYear = yearOf(dStart);
    var nameYear = (String(r[fNmI] || '').match(/(20\d\d)/) || [])[1] || '';
    if (nameYear && edYear && nameYear !== edYear) {
      R('EDITION年不一致: [' + fid + '] NAME="' + r[fNmI] + '"(年' + nameYear + ') ≠ DATE年' + edYear + ' → EDITION値の確認');
    }
    editionsData.push([
      fid + (edYear ? '-' + edYear : ''), fid, edYear, dStart, dEnd,
      fget(r, 'LOCATION'), '', fget(r, 'CITY'), fget(r, 'ADDRESS'),
      fget(r, 'LAT'), fget(r, 'LNG'), (fget(r, 'TICKETURL') || fget(r, ' TICKETURL')), fget(r, 'FLYER'),
      fget(r, 'STATUS')
    ]);
  });
  L('① EDITIONS: ' + editionsData.length + '行 生成予定');

  // ============ ② LINEUPS ============
  var LINEUPS_HEADERS = ['EDITION_ID', 'ARTIST_ID', 'ACT_LABEL', 'SET_TYPE', 'STAGE', 'DAY', 'START', 'END', 'SORT'];
  var lineupsData = [], unresolved = {};
  fRows.forEach(function (r) {
    var fid = String(r[fIdI] || '').trim();
    if (!fid) return;
    var edId = fid + (yearOf(String(r[fDtI] || '').split('/')[0]) ? '-' + yearOf(String(r[fDtI] || '').split('/')[0]) : '');
    var lineup = fget(r, 'LINEUP');
    if (!lineup) return;
    lineup.split(',').map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (act, i) {
      var setType = /-live-/i.test(act) ? 'live' : (/\bb2b\b/i.test(act) ? 'b2b' : 'dj');
      var artistId = '', actLabel = '';
      if (setType === 'dj') {
        var hit = nameToArtist[act.toLowerCase().replace(/\s+/g, ' ').trim()];
        if (hit && isValidId(hit.id)) {
          artistId = hit.id;
        } else if (hit) {
          actLabel = act; unresolved[act] = 'id-invalid';
          R('LINEUP: "' + act + '" は ARTISTS に有るが ID不正("' + hit.id + '")→ ID修正後に再リンク [' + edId + ']');
        } else {
          actLabel = act; unresolved[act] = 'no-match';
        }
      } else {
        actLabel = act;
        R('LINEUP: 分解要 "' + act + '" (' + setType + ') [' + edId + ']');
      }
      lineupsData.push([edId, artistId, actLabel, setType, '', '', '', '', String(i + 1)]);
    });
  });
  Object.keys(unresolved).forEach(function (nm) {
    if (unresolved[nm] === 'no-match') R('LINEUP未解決(ARTISTS該当なし): "' + nm + '"');
  });
  L('② LINEUPS: ' + lineupsData.length + '行 生成予定 / 未解決アクト ' + Object.keys(unresolved).length + '種');

  // ============ ③ EVENTS ID ============
  var eHasId = eH.idx['ID'] != null;
  var eNmI = eH.idx['NAME'], eDtI = eH.idx['DATE'];
  var evIdPlan = [];
  eRows.forEach(function (r) {
    var nm = String(r[eNmI] || '').trim();
    var ymd = (String(r[eDtI] || '').replace(/-/g, '').match(/(\d{8})/) || [])[1] || yearOf(r[eDtI]);
    evIdPlan.push({ name: nm, id: slugify(nm) + (ymd ? '-' + ymd : '') });
  });
  L('③ EVENTS ID: ' + (eHasId ? '既にIDカラムあり → スキップ' : evIdPlan.length + '件に付与予定'));
  evIdPlan.forEach(function (p) { L('    ' + p.name + ' → ' + p.id); });

  // ============ 書き込み（APPLY のみ）============
  if (!MIG_DRY) {
    if (ss.getSheetByName('EDITIONS')) { L('WARN: EDITIONS 既存 → 作成スキップ'); }
    else {
      var se = ss.insertSheet('EDITIONS');
      se.getRange(1, 1, 1, EDITIONS_HEADERS.length).setValues([EDITIONS_HEADERS]);
      if (editionsData.length) se.getRange(2, 1, editionsData.length, EDITIONS_HEADERS.length).setValues(editionsData);
      L('✔ EDITIONS 作成: ' + editionsData.length + '行');
    }
    if (ss.getSheetByName('LINEUPS')) { L('WARN: LINEUPS 既存 → 作成スキップ'); }
    else {
      var sl = ss.insertSheet('LINEUPS');
      sl.getRange(1, 1, 1, LINEUPS_HEADERS.length).setValues([LINEUPS_HEADERS]);
      if (lineupsData.length) sl.getRange(2, 1, lineupsData.length, LINEUPS_HEADERS.length).setValues(lineupsData);
      L('✔ LINEUPS 作成: ' + lineupsData.length + '行');
    }
    if (!eHasId) {
      shEv.insertColumnBefore(1);
      shEv.getRange(1, 1).setValue('ID');
      var ids = evIdPlan.map(function (p) { return [p.id]; });
      if (ids.length) shEv.getRange(2, 1, ids.length, 1).setValues(ids);
      L('✔ EVENTS: ID列を先頭に挿入 + ' + ids.length + '件付与');
    } else {
      L('EVENTS: ID列が既に存在 → スキップ');
    }
  }

  return flush_(log, review);

  function flush_(log, review) {
    var out = log.join('\n');
    out += '\n\n===== 要確認リスト (' + review.length + '件) — 勝手に直さず報告 =====\n';
    out += review.length ? review.join('\n') : '(なし)';
    Logger.log(out);
  }
}
