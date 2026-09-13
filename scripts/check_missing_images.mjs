/*
 * CMSで画像をアップロードしてすぐPublishすると、Driveには画像があっても
 * Sync Drive Imagesがまだ取り込んでおらず、Publishが画像検査で止まることがある。
 * Publish前に参照画像の実在を確認し、不足時に画像同期を起動できるようにする。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LP = path.join(ROOT, 'LP');
const LIST_ONLY = process.argv.slice(2).includes('--list');

function readReferencedImages() {
  const dataJs = fs.readFileSync(path.join(LP, 'data.js'), 'utf8');
  const paths = new Set();
  for (const match of dataJs.matchAll(/"(images\/[^"\\]*)"/g)) paths.add(match[1]);

  const editions = JSON.parse(fs.readFileSync(path.join(LP, 'data', 'editions.json'), 'utf8'));
  for (const item of editions.items || []) {
    if (typeof item.FLYER === 'string' && item.FLYER.startsWith('images/')) {
      paths.add(item.FLYER);
    }
  }
  return [...paths];
}

function existingPath(imagePath) {
  if (fs.existsSync(path.join(LP, imagePath))) return imagePath;

  // Sync Drive Imagesは原本の拡張子を同名のwebpへ変換して取り込む。
  const webpPath = imagePath.replace(/\.(jpe?g|png|heic|heif)$/i, '.webp');
  return webpPath !== imagePath && fs.existsSync(path.join(LP, webpPath))
    ? webpPath
    : null;
}

const missing = readReferencedImages().filter((imagePath) => !existingPath(imagePath));

if (LIST_ONLY) {
  for (const imagePath of missing) console.log(imagePath);
  process.exit(missing.length ? 1 : 0);
}

if (missing.length === 0) {
  console.log(`✅ 参照画像はすべて存在します（${readReferencedImages().length}件）`);
  process.exit(0);
}

for (const imagePath of missing) console.log(`  - ${imagePath}`);
console.log(`❌ 実在しない参照画像 ${missing.length}件`);
process.exit(1);
