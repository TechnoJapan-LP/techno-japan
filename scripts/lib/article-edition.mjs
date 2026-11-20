const YEAR_RE = /(?:^|[^0-9])(20\d{2})(?![0-9])/g;

function dateValue(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00Z`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function editionYear(edition) {
  return String(edition?.EDITION || '').match(/^(20\d{2})/)?.[1]
    || String(edition?.DATE_START || '').match(/^(20\d{2})/)?.[1] || '';
}

function yearsIn(value) {
  const years = [];
  const text = String(value || '');
  let match;
  while ((match = YEAR_RE.exec(text))) years.push(match[1]);
  YEAR_RE.lastIndex = 0;
  return years;
}

function nearestEdition(candidates, baseDate, maxDays = Infinity) {
  if (!baseDate || !candidates.length) return null;
  return candidates.map((edition, index) => ({ edition, index, date: dateValue(edition.DATE_START) }))
    .filter((item) => item.date)
    .filter((item) => Math.abs(item.date - baseDate) <= maxDays * 24 * 60 * 60 * 1000)
    .sort((left, right) => {
      const distance = Math.abs(left.date - baseDate) - Math.abs(right.date - baseDate);
      return distance || (left.date >= baseDate ? 0 : 1) - (right.date >= baseDate ? 0 : 1) || left.index - right.index;
    })[0]?.edition || null;
}

/** Select the edition an article is about, without falling back to the latest edition. */
export function articleEditionFor(article, festivalId, editions = []) {
  const candidates = Array.isArray(editions) ? editions : [];
  const explicitId = String(article?.editionId || '').trim().toLowerCase();
  if (explicitId) {
    const explicit = candidates.find((edition) => String(edition.EDITION_ID || '').trim().toLowerCase() === explicitId);
    if (explicit) return explicit;
  }
  const idYears = yearsIn(article?.id);
  const titleYears = yearsIn(article?.title);
  const availableYears = new Set(candidates.map(editionYear).filter(Boolean));
  const baseDate = dateValue(article?.publishAt) || dateValue(article?.date);
  // An explicit year in the id is a hard constraint. Never attach a later
  // edition merely because its date happens to be close.
  if (idYears.length && !availableYears.has(idYears[0])) return null;
  const year = idYears[0] || titleYears.find((candidate) => availableYears.has(candidate)) || '';
  if (year) {
    const sameYear = candidates.filter((edition) => editionYear(edition) === year);
    return sameYear.length === 1 ? sameYear[0] : nearestEdition(sameYear, baseDate);
  }
  return nearestEdition(candidates, baseDate, 200);
}
