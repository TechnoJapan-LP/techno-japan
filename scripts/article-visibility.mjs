/*
 * Articles are filtered in Node, Python, and LP/cms.js because each runtime
 * owns a different part of the publish path. Keep the rule identical in all
 * three places; changing only one creates mismatched pages, feeds, or hubs.
 */

const JST = '+09:00';

export function parsePublishAt(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let normalized = raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) normalized = `${raw}T00:00:00${JST}`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) normalized = `${raw}:00${JST}`;
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) normalized = `${raw}${JST}`;
  else if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && /Z$|[+-]\d{2}:?\d{2}$/.test(raw)) normalized = raw;
  else return null;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildNow() {
  const configured = String(process.env.TJ_BUILD_NOW || '').trim();
  if (configured) {
    const date = new Date(configured);
    if (Number.isNaN(date.getTime())) throw new Error(`TJ_BUILD_NOW が不正です: ${configured}`);
    return date;
  }
  return new Date();
}

export function isArticleLive(article, now = buildNow()) {
  const status = String(article?.status ?? '').trim().toLowerCase();
  if (status === 'draft') return false;
  if (status !== 'scheduled') return true;
  const publishAt = parsePublishAt(article?.publishAt);
  return Boolean(publishAt && publishAt.getTime() <= now.getTime());
}
