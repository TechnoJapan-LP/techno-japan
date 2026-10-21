/** LINEUPS の ARTIST_ID を公開／非公開／参照切れに分類する。 */
export function resolveLineupArtist(row, publicArtistsById, allArtistsById) {
  const value = row?.ARTIST_IDS || row?.ARTIST_ID || '';
  const id = (Array.isArray(value) ? value : String(value).split(','))
    .map((item) => String(item).trim()).filter(Boolean)[0] || '';
  if (!id) return { id: '', status: 'label-only', artist: null };
  const published = publicArtistsById.get(id);
  if (published) return { id, status: 'published', artist: published };
  const sheetArtist = allArtistsById.get(id);
  if (sheetArtist) return { id, status: 'unpublished', artist: sheetArtist };
  return { id, status: 'missing', artist: null };
}
