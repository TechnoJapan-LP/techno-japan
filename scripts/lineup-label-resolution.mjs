/**
 * LINEUPS/FESTIVALS.LINEUP の ACT_LABEL を公開アーティストへ解決する。
 * データ取得や書き出しを伴わない純粋な判定として切り出しておく。
 */

export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normName = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const LIVE_COMPOSITE_RE = /&|b2b| x |×|\/|\+|,/i;

/**
 * @param {object} options
 * @param {string} options.actLabel
 * @param {string} options.setType
 * @param {Map<string,string>} options.nameToArtist - 公開アーティスト名→ID
 * @param {Set<string>} options.publishedArtistIds
 * @returns {{artistId: string, actLabel: string}}
 */
export function resolveActLabel({ actLabel, setType, nameToArtist, publishedArtistIds }) {
  const label = String(actLabel || '').trim();
  const type = String(setType || 'dj').trim().toLowerCase();
  if (!label || (type !== 'dj' && type !== 'live')) {
    return { artistId: '', actLabel: label };
  }
  if (type === 'live' && LIVE_COMPOSITE_RE.test(label)) {
    return { artistId: '', actLabel: label };
  }

  const byName = nameToArtist.get(normName(label)) || '';
  const byId = ID_RE.test(label) && publishedArtistIds.has(label) ? label : '';
  const artistId = byName || byId;
  if (!artistId || !ID_RE.test(artistId) || !publishedArtistIds.has(artistId)) {
    return { artistId: '', actLabel: label };
  }
  return { artistId, actLabel: '' };
}
