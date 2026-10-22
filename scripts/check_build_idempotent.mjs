#!/usr/bin/env node
/**
 * ビルド前後の生成対象を比較し、同じビルドをもう一度流しても
 * HTML / JSON / txt / XML が変わらないことを確認する。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lp = path.join(root, 'LP');
const extensions = new Set(['.html', '.json', '.txt', '.xml']);

function filesUnder(dir) {
  const found = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (extensions.has(path.extname(entry.name).toLowerCase())) found.push(full);
    }
  }
  walk(dir);
  return found.sort();
}

function snapshot() {
  const result = new Map();
  for (const file of filesUnder(lp)) {
    const content = fs.readFileSync(file);
    result.set(path.relative(root, file), {
      hash: crypto.createHash('sha256').update(content).digest('hex'),
      text: content.toString('utf8'),
    });
  }
  return result;
}

function firstDiff(before, after) {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const limit = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < limit; i += 1) {
    if (oldLines[i] !== newLines[i]) {
      return `行 ${i + 1}: 前=${JSON.stringify(oldLines[i] ?? '')} 後=${JSON.stringify(newLines[i] ?? '')}`;
    }
  }
  return '行差分を特定できませんでした';
}

const before = snapshot();
try {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-detail-pages.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
} catch (error) {
  process.exitCode = error.status || 1;
  process.exit();
}
const after = snapshot();
const changed = [];
const names = new Set([...before.keys(), ...after.keys()]);
for (const name of [...names].sort()) {
  const oldFile = before.get(name);
  const newFile = after.get(name);
  if (!oldFile || !newFile) {
    changed.push(`${name}: ${oldFile ? '削除' : '追加'}`);
  } else if (oldFile.hash !== newFile.hash) {
    changed.push(`${name}: ${firstDiff(oldFile.text, newFile.text)}`);
  }
}

if (changed.length) {
  console.error(`❌ ビルドが冪等ではありません（${changed.length}ファイル）`);
  for (const item of changed) console.error(`  ${item}`);
  process.exitCode = 1;
} else {
  console.log(`✅ ビルド冪等性: ${after.size}ファイルに変化なし`);
}
