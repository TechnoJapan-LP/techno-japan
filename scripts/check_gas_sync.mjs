#!/usr/bin/env node
/**
 * リポジトリの .gs と、GAS に**実際に入っているもの**がずれていないか。
 *
 * ■ なぜ必要か（AUDIT §9-72 / §9-74）
 *
 *   GAS のコードは手で貼って運用している。**リポジトリを直しても、
 *   貼り忘れれば本番は変わらない。**しかもエラーは出ない。
 *
 *   2026-08-07 に「AI を Claude Opus 5 に統一した」と記録したが、
 *   翻訳では効いていなかった。新しい `aiTranslateV2_` を貼り足したものの、
 *   **古い版が下に残っていて後勝ちしていた**（§9-72）。
 *   同名関数の二重定義は構文エラーにならないので、静かに古い方が動く。
 *
 *   気づいたのは2026-08-10、AI が動かない原因を追ってブラウザで
 *   GAS を直接覗いたとき。**3日間、記録と実物が食い違っていた。**
 *
 *   `check_gas_ai.mjs` は**リポジトリのファイル**を検証する。
 *   実物は見ていない。そこを埋める。
 *
 * ■ 仕組み
 *
 *   GAS から取った指紋を `scripts/gas-update/live-snapshot.json` に置く。
 *   この検査は、リポジトリの .gs から同じ計算をして突き合わせる。
 *
 *   ・一致        → 貼り済み
 *   ・食い違い    → **リポジトリを直したのに GAS へ貼っていない**（落とす）
 *
 *   指紋はコメントと空白を無視するので、説明文だけの修正では鳴らない。
 *
 * ■ スナップショットの更新方法
 *
 *   GAS に貼って再デプロイしたら、Apps Script のエディタで
 *   `scripts/gas-update/snapshot.js` の中身を実行し、出力を
 *   `live-snapshot.json` に保存する。手順はそのファイルの先頭に書いてある。
 *
 * 使い方:
 *   node scripts/check_gas_sync.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAS_PATH = path.join(ROOT, 'scripts', 'gas-update', 'ai-claude-opus5.gs');
const SNAP_PATH = path.join(ROOT, 'scripts', 'gas-update', 'live-snapshot.json');

/** 見た目の違い（コメント・空白）を落とす。中身が同じなら同じ指紋にする。 */
export function normalize(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ブラウザ側と同じ計算（FNV-1a 32bit を2本）。依存を増やさないための選択。 */
export function fingerprint(s) {
  const fnv = (str, seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  return fnv(s, 2166136261).toString(16).padStart(8, '0')
       + fnv(s, 1099511628211 >>> 0).toString(16).padStart(8, '0');
}

/** 関数定義を、列0の `}` までで切り出す。 */
export function grabFunction(src, name) {
  const i = src.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
  if (i < 0) return null;
  const lines = src.slice(i).split('\n');
  let end = lines.length;
  for (let k = 1; k < lines.length; k++) if (/^\}\s*$/.test(lines[k])) { end = k + 1; break; }
  return lines.slice(0, end).join('\n');
}

export function inspect(src, names, consts) {
  const 関数 = {};
  for (const fn of names) {
    const body = grabFunction(src, fn);
    関数[fn] = body
      ? { 行数: body.split('\n').length, 指紋: fingerprint(normalize(body)), 正規化長: normalize(body).length }
      : '見つからない';
  }
  const 定数 = {};
  for (const c of consts) {
    const hit = src.match(new RegExp('var\\s+' + c + '\\s*=\\s*([^;]+);'));
    定数[c] = hit ? hit[1].trim() : null;
  }
  return { 関数, 定数 };
}

const FUNCTIONS = ['callClaude_', 'aiTranslateV2_', 'aiSummarize'];
const CONSTANTS = ['CLAUDE_MODEL', 'MAX_TOKENS_TRANSLATE', 'MAX_TOKENS_SUMMARY'];

function main() {
  if (!fs.existsSync(SNAP_PATH)) {
    console.log('✗ live-snapshot.json がありません。');
    console.log('  GAS に貼った後、scripts/gas-update/snapshot.js の手順で作成してください。');
    process.exit(1);
  }
  const snap = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
  const repo = inspect(fs.readFileSync(GAS_PATH, 'utf8'), FUNCTIONS, CONSTANTS);

  const failures = [];
  for (const fn of FUNCTIONS) {
    const a = repo.関数[fn], b = snap.関数?.[fn];
    if (!b) { failures.push(`${fn}: スナップショットに記録がありません`); continue; }
    if (a === '見つからない') { failures.push(`${fn}: リポジトリの .gs に見つかりません`); continue; }
    if (a.指紋 !== b.指紋) {
      failures.push(`${fn} が食い違っています（リポジトリ ${a.指紋} / GAS ${b.指紋}）`);
    }
  }
  for (const c of CONSTANTS) {
    if (repo.定数[c] !== snap.定数?.[c]) {
      failures.push(`${c} が食い違っています（リポジトリ ${repo.定数[c]} / GAS ${snap.定数?.[c]}）`);
    }
  }

  if (failures.length) {
    console.log('='.repeat(64));
    console.log('リポジトリの .gs と、GAS に入っているものがずれています:');
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log();
    console.log('  リポジトリを直しただけでは本番は変わりません。');
    console.log('  GAS へ貼って再デプロイし、live-snapshot.json を更新してください。');
    console.log('  （すでに貼ってあるなら、スナップショットの更新漏れです）');
    console.log();
    console.log(`  記録日時: ${snap.取得日時 || '不明'}`);
    process.exit(1);
  }

  console.log(`✅ リポジトリの .gs と GAS の中身は一致しています（${FUNCTIONS.length}関数 / ${CONSTANTS.length}定数）`);
  console.log(`   スナップショット取得: ${snap.取得日時 || '不明'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
