/**
 * Techno Japan / GAS Code.gs 手貼りパッチ（VENUES列）
 *
 * 【状態】
 *   desc_en / subtype / hours / charge / features は 2026-08-24 に
 *   適用・デプロイ済み（アクティブなデプロイはバージョン62）。
 *   デプロイIDは cms.js の GAS_URL と一致（AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nf...）。
 *
 * 【未適用（2026-10-19 追加）】
 *   name_kana / access / access_en / hours_en は、本番GASとVENUESシートに
 *   まだ適用されていない。次の手順をすべて実施すること。
 *   1. Apps Script「Techno Japan」コード.gs の `const COLUMNS = [...]` の
 *      VENUES 用の並びの末尾に 'name_kana','access','access_en','hours_en' を
 *      小文字で追記して保存する。
 *   2. デプロイ → デプロイを管理 → 鉛筆 → バージョン「新バージョン」→ デプロイ
 *      （URL は変えない）。
 *   3. スプレッドシート VENUES シートの1行目の右端に同じ4つの見出しを追記する
 *      （既存の見出しは動かさない）。
 *   4. node scripts/gas-update/snapshot.js で指紋を更新する。
 *
 * 【重要】列名は **小文字**。大文字で足さないこと。
 *
 *   COLUMNS の既存要素はすべて小文字（"id", "name", "city", ...）で、
 *   CMS が送るペイロードのキーも小文字（cms.js の venue 保存を参照）。
 *   ここに 'SUBTYPE' のような大文字を足すと、既存の小文字要素と食い違う。
 *   AUDIT §9-69「大文字小文字で値が消える」は、まさにこの取り違えで起きている。
 *
 *   この資料は当初 大文字（'DESC_EN', 'SUBTYPE', ...）で書かれていたが、
 *   実物の COLUMNS は小文字だった。2026-08-24 に実物へ合わせて訂正した。
 *
 * 既存の列を丸ごと置き換えないこと。追記のみ。
 */

// 手貼りパッチに記載する VENUES 用の列（すべて小文字）。
const VENUE_COLUMNS_REQUIRED = Object.freeze([
  'desc_en',
  'subtype',
  'hours',
  'charge',
  'features',
  'name_kana',
  'access',
  'access_en',
  'hours_en',
]);

/* オーナー向け手貼り手順（既存列は絶対に並べ替えない）。
 * Apps Script の VENUES セクションにある `const COLUMNS = [...]` の末尾へ
 * 'name_kana', 'access', 'access_en', 'hours_en' を追加し、保存する。
 * デプロイ → デプロイを管理 → 編集 → 新バージョン → デプロイを実行する。
 * その後、VENUES シート row 1 の末尾へ同じ4つの小文字ヘッダーを追加する。
 * 既存ヘッダーは絶対に並べ替えない。
 */

/**
 * 確認用。Code.gs の既存 COLUMNS が配列として見える環境（Apps Script）で実行する。
 * COLUMNS を書き換えないので、いつ実行しても安全。
 *
 * 大文字小文字は問わずに突き合わせる。実物は小文字だが、将来どちらで
 * 書かれていても「足りているか」だけを見たいため。
 */
function assertVenueColumnsPatch_() {
  const have = COLUMNS.map((name) => String(name).toLowerCase());
  const missing = VENUE_COLUMNS_REQUIRED.filter((name) => have.indexOf(name) === -1);
  if (missing.length) throw new Error('COLUMNSに不足: ' + missing.join(', '));
  return 'OK: ' + VENUE_COLUMNS_REQUIRED.join(', ');
}
