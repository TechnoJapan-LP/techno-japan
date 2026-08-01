import fs from 'node:fs';
import path from 'node:path';

function webpSize(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > buffer.length) return null;
    if (type === 'VP8 ' && length >= 10 && buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    if (type === 'VP8L' && length >= 5 && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8X' && length >= 10) {
      return {
        width: 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16),
        height: 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16),
      };
    }
    offset = data + length + (length % 2);
  }
  return null;
}

function pngSize(buffer) {
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function jpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

export function readImageSizeBuffer(buffer, label = 'image') {
  const size = webpSize(buffer) || pngSize(buffer) || jpegSize(buffer);
  if (!size || !size.width || !size.height) throw new Error(`画像サイズを取得できません: ${label}`);
  return size;
}

export function readImageSize(file) {
  return readImageSizeBuffer(fs.readFileSync(file), file);
}

export function resolveLocalImage(lpDir, source) {
  const value = String(source || '').split(/[?#]/)[0];
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return null;
  const relative = value.replace(/^\/+/, '');
  const exact = path.join(lpDir, relative);
  if (fs.existsSync(exact)) return exact;
  const webp = exact.replace(/\.(?:jpe?g|png)$/i, '.webp');
  return fs.existsSync(webp) ? webp : null;
}

export function imageSizeAttrs(lpDir, source) {
  const file = resolveLocalImage(lpDir, source);
  if (!file) return '';
  const { width, height } = readImageSize(file);
  return `width="${width}" height="${height}"`;
}
