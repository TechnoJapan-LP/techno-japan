function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function artistNameMatches(text, name) {
  const candidate = String(name || '').trim();
  if (candidate.length < 4) return false;
  const haystack = String(text || '');
  if (/^[\x00-\x7F]+$/.test(candidate)) {
    const boundary = `(?<![A-Za-z0-9])${escapeRegExp(candidate)}(?![A-Za-z0-9])`;
    return new RegExp(boundary, 'i').test(haystack);
  }
  return haystack.toLocaleLowerCase().includes(candidate.toLocaleLowerCase());
}

function fieldsOf(article) {
  return [article.title, article.title_en, article.body, article.body_en]
    .filter(Boolean).map(String);
}

function festivalRecordsFor(artistFestivalIds, festivals) {
  const ids = new Set([...new Set(artistFestivalIds || [])].map((id) => String(id)));
  return (festivals || []).filter((festival) => ids.has(String(festival.id || '')));
}

export function articleMatchReason(article, artist, { artistFestivalIds = [], festivals = [] } = {}) {
  if (!article || !artist) return null;
  const id = String(artist.id || '').trim();
  const link = id && new RegExp(`(?:/en)?/artists/${escapeRegExp(id)}\\.html(?:["'#?]|$)`, 'i');
  const fields = fieldsOf(article);
  if (link && fields.some((value) => link.test(value))) return 'artist-link';
  const nameMatch = fields.some((value) => artistNameMatches(value.replace(/<[^>]*>/g, ' '), artist.name));
  if (!nameMatch) return null;
  const records = festivalRecordsFor(artistFestivalIds, festivals);
  if (records.some((festival) => String(article.festivalId || '') === String(festival.id || ''))) return 'festival-id';
  for (const festival of records) {
    const festivalId = String(festival.id || '').trim();
    const festivalLink = festivalId && new RegExp(`(?:/en)?/festivals/${escapeRegExp(festivalId)}\\.html(?:["'#?]|$)`, 'i');
    if (festivalLink && fields.some((value) => festivalLink.test(value))) return 'festival-link';
    const festivalName = String(festival.name || '').trim();
    if (festivalName.length >= 4 && fields.some((value) => artistNameMatches(value.replace(/<[^>]*>/g, ' '), festivalName))) return 'festival-name';
  }
  return null;
}

export function articleMatchesArtist(article, artist, options = {}) {
  return Boolean(articleMatchReason(article, artist, options));
}
