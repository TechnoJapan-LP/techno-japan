const ENTITY_ID_RE = /^[a-z0-9-]+$/;

export function articleRefIds(article, field) {
  const value = article?.[field];
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map((id) => String(id || '').trim().toLowerCase())
    .filter((id) => ENTITY_ID_RE.test(id)))];
}

export function articleEntityRefWarnings(articlesBlock, entityBlock, fieldName) {
  const refs = [...String(articlesBlock || '').matchAll(new RegExp(`${fieldName}: \\[([^\\]]*)\\]`, 'g'))]
    .flatMap((match) => [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]));
  const known = new Set([...String(entityBlock || '').matchAll(/\n    id: "([a-z0-9-]+)"/g)]
    .map((match) => match[1]));
  return [...new Set(refs.filter((id) => !known.has(id)))];
}

export function prioritizeEntityArticles(articles, entityId, field, automaticMatch, max = 3) {
  const id = String(entityId || '').trim().toLowerCase();
  const published = (articles || []).filter((article) => (
    article && String(article.status || '').toLowerCase() !== 'draft'
  ));
  const explicit = published.filter((article) => articleRefIds(article, field).includes(id));
  const automatic = published.filter((article) => !explicit.includes(article) && automaticMatch(article));
  return [...explicit, ...automatic].slice(0, max);
}

export { ENTITY_ID_RE };
