import fs from 'node:fs';
import path from 'node:path';

const DRIVE_ID = /(?:lh3\.googleusercontent\.com\/d\/|drive\.google\.com\/file\/d\/)([A-Za-z0-9_-]+)/i;
const DRIVE_UC_ID = /drive\.google\.com\/uc\?[^"'<>\s]*?\bid=([A-Za-z0-9_-]+)/i;

export function driveFileId(url) {
  const value = String(url || '');
  return value.match(DRIVE_ID)?.[1] || value.match(DRIVE_UC_ID)?.[1] || '';
}

export function loadArticleImageMap(rootDir) {
  const file = path.join(rootDir, 'LP', 'data', 'article-image-map.json');
  if (!fs.existsSync(file)) return {};
  const map = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!map || Array.isArray(map) || typeof map !== 'object') {
    throw new Error(`記事画像対応表の形式が不正です: ${file}`);
  }
  return map;
}

export function replaceMappedArticleImages(html, map, rootDir) {
  const source = String(html || '');
  return source.replace(/(\b(?:src|href)\s*=\s*["'])(https:\/\/[^"'<>\s]+)(["'])/gi,
    (whole, head, url, quote) => {
      const id = driveFileId(url);
      const relative = id ? String(map?.[id] || '').replace(/^\/+/, '') : '';
      if (!relative || !fs.existsSync(path.join(rootDir, 'LP', relative))) return whole;
      return `${head}/${relative}${quote}`;
    });
}

