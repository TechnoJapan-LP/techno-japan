import { Parser } from '../vendor/budoux/parser.js';
import { model } from '../vendor/budoux/model-ja.js';

const parser = new Parser(model);
const KINSOKU_CLOSE = new Set([...`、。，．・ー々ぁぃぅぇぉっゃゅょ）」』】〉》〕］}ゝゞ々,.!?:;)]}`]);
const KINSOKU_OPEN = new Set([...`（「『【〈《〔［(`]);
const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HAN = /\p{Script=Han}/u;
const KATAKANA = /\p{Script=Katakana}/u;
const HIRAGANA = /\p{Script=Hiragana}/u;
const LATIN = /[A-Za-z]/;

function scriptClass(char) {
  if (HAN.test(char)) return 'kanji';
  if (KATAKANA.test(char)) return 'katakana';
  if (HIRAGANA.test(char)) return 'japanese';
  if (LATIN.test(char)) return 'latin';
  return '';
}

function isNumericContext(text, index) {
  if (/\d/.test(text[index - 1] || '') || /\d/.test(text[index] || '')) return true;
  let start = index - 1;
  while (start >= 0 && /[A-Za-z0-9,.'-]/.test(text[start])) start -= 1;
  let end = index;
  while (end < text.length && /[A-Za-z0-9,.'-]/.test(text[end])) end += 1;
  return /\d/.test(text.slice(start + 1, end));
}

function isScriptBoundary(text, index) {
  const left = text[index - 1];
  const right = text[index];
  const pair = new Set([scriptClass(left), scriptClass(right)]);
  if (isNumericContext(text, index)) return false;
  if (pair.has('kanji') && pair.has('katakana')) return true;

  // Only a real Latin word run creates a Japanese/Latin opportunity.
  // Digits and punctuation must stay attached to their surrounding token.
  if (!(pair.has('latin') && (pair.has('kanji') || pair.has('katakana') || pair.has('japanese')))) return false;
  let start = index;
  while (start > 0 && LATIN.test(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && LATIN.test(text[end])) end += 1;
  return end - start >= 2;
}

function canBreak(text, index) {
  if (index <= 0 || index >= text.length) return false;
  return !KINSOKU_CLOSE.has(text[index]) && !KINSOKU_OPEN.has(text[index - 1]);
}

function mergeTinyChunks(text, breaks) {
  let changed = true;
  while (changed) {
    changed = false;
    const boundaries = [0, ...[...breaks].sort((a, b) => a - b), text.length];
    for (let i = 1; i < boundaries.length - 1; i += 1) {
      const start = boundaries[i - 1];
      const end = boundaries[i];
      const chunk = text.slice(start, end);
      const leadingParticle = HIRAGANA.test(text[start]) && KINSOKU_CLOSE.has(text[start + 1] || '');
      if (chunk.length !== 1 && !leadingParticle) continue;
      if (HIRAGANA.test(chunk) || leadingParticle) {
        breaks.delete(start);
        changed = true;
        break;
      }
      if (HAN.test(chunk)) {
        breaks.delete(end);
        changed = true;
        break;
      }
    }
  }
}

function decodeHtmlEntities(text) {
  let value = String(text ?? '');
  for (let i = 0; i < 3; i += 1) {
    const decoded = value.replace(/&(amp|lt|gt|quot|apos|#39|#x27|#(\d+)|#x([\da-f]+));/gi, (match, name, decimal, hex) => {
      const lower = name.toLowerCase();
      if (lower === 'amp') return '&';
      if (lower === 'lt') return '<';
      if (lower === 'gt') return '>';
      if (lower === 'quot') return '"';
      if (lower === 'apos' || lower === '#39' || lower === '#x27') return "'";
      const code = decimal ? Number(decimal) : parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    });
    if (decoded === value) break;
    value = decoded;
  }
  return value;
}

function escapeHtml(text) {
  return decodeHtmlEntities(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function phraseBreaks(text) {
  const value = String(text ?? '');
  if (!JAPANESE.test(value)) return escapeHtml(value);

  const breaks = new Set();
  let offset = 0;
  for (const phrase of parser.parse(value)) {
    offset += phrase.length;
    if (offset < value.length && canBreak(value, offset)) breaks.add(offset);
  }
  for (let i = 1; i < value.length; i += 1) {
    if (isScriptBoundary(value, i) && canBreak(value, i)) breaks.add(i);
  }
  mergeTinyChunks(value, breaks);

  let output = '';
  for (let i = 0; i < value.length; i += 1) {
    if (breaks.has(i)) output += '<wbr>';
    const entity = value.slice(i).match(/^&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/i);
    if (entity) {
      output += entity[0];
      i += entity[0].length - 1;
      continue;
    }
    output += escapeHtml(value[i]);
  }
  return output;
}

function mergeShortClauses(clauses) {
  const merged = [];
  for (const clause of clauses) {
    if (clause.length < 4 && merged.length) merged[merged.length - 1] += clause;
    else merged.push(clause);
  }
  if (merged.length > 1 && merged.at(-1).length < 4) {
    merged[merged.length - 2] += merged.pop();
  }
  return merged;
}

function visualLength(text) {
  return Array.from(text).reduce((length, char) => {
    if (/[A-Za-z0-9]/.test(char)) return length + 0.5;
    if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(char) || char.codePointAt(0) > 0xff) return length + 1;
    return length + 0.5;
  }, 0);
}

function clauseClasses(clause) {
  const length = visualLength(clause);
  return [length <= 9 ? 'tj-cl-s' : '', length <= 15 ? 'tj-cl-m' : '', length <= 24 ? 'tj-cl-l' : '']
    .filter(Boolean).join(' ');
}

export function clauseBreaks(text) {
  const value = String(text ?? '');
  const clauses = [];
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (`、，。！？`.includes(value[i])) {
      clauses.push(value.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < value.length) clauses.push(value.slice(start));
  if (clauses.length < 2) return phraseBreaks(value);
  return mergeShortClauses(clauses)
    .map((clause) => {
      const classes = clauseClasses(clause);
      return `<span class="tj-clause${classes ? ` ${classes}` : ''}">${phraseBreaks(clause)}</span>`;
    })
    .join('');
}
