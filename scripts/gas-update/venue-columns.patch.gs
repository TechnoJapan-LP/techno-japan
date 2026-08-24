/**
 * Techno Japan / GAS Code.gs 手貼りパッチ（VENUES列）
 *
 * 【状態】2026-08-24 15:00 時点で **適用済み・デプロイ済み**。
 *   Apps Script「Techno Japan」の コード.gs 冒頭 `const COLUMNS = [...]` に
 *   desc_en / subtype / hours / charge / features がすべて入っており、
 *   アクティブなデプロイは バージョン62（2026/08/24 14:35）。
 *   デプロイIDは cms.js の GAS_URL と一致（AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nf...）。
 *   以降は「再適用の手順書」ではなく「何が入っているかの記録」として読むこと。
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

// Code.gs の COLUMNS に入っているべき VENUES 用の列（実物と同じ小文字）。
const VENUE_COLUMNS_REQUIRED = Object.freeze([
  'desc_en',
  'subtype',
  'hours',
  'charge',
  'features',
]);

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
