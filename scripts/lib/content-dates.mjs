import crypto from 'node:crypto';

/** JSONのキー順に依存しない、content-dates台帳用の正規化。 */
export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function contentHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

/** CMSの内部作業項目はページのデータではないため除外する。 */
export function contentRow(row) {
  if (!row || typeof row !== 'object') return row;
  return Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('_')));
}
