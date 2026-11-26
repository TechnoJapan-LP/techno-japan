#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

// package.json の type=module に左右されないよう、UMD を CommonJS 形式で評価する。
export function loadEditionProposals() {
  const filename = fileURLToPath(new URL('./cms-edition-proposals.js', import.meta.url));
  const module = { exports: {} };
  const context = {
    module,
    globalThis: {},
    window: undefined,
    Intl,
    Date,
    URL,
    fetch: globalThis.fetch,
    console,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  const api = module.exports;
  if (typeof api.appendProposals !== 'function' || typeof api.applyApproved !== 'function') {
    throw new Error(`${filename}: UMD API の読み込みに失敗しました`);
  }
  return api;
}

const { appendProposals } = loadEditionProposals();

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbxhJ6rtGoAirNyV5TtBvzWHNOT8RuB0nfDjwglmdu8ClhpWZ-OXSbMM4UyFE_7ZsV-Lpg/exec';

function requireAuthHash() {
  const hash = process.env.CMS_AUTH_HASH;
  if (!hash) throw new Error('CMS_AUTH_HASH が未設定です（GAS へログインできません）');
  return hash;
}

async function jsonResponse(response, label) {
  if (!response || response.ok === false) throw new Error(`${label} failed: HTTP ${response?.status ?? 'unknown'}`);
  try { return await response.json(); } catch (error) { throw new Error(`${label} のJSON読み込みに失敗しました: ${error.message}`); }
}

export async function login(fetchImpl = globalThis.fetch, gasUrl = GAS_URL, passHash = process.env.CMS_AUTH_HASH) {
  if (!passHash) throw new Error('CMS_AUTH_HASH が未設定です');
  if (typeof fetchImpl !== 'function') throw new Error('fetch が利用できません');
  const response = await fetchImpl(gasUrl, {
    method: 'POST',
    body: JSON.stringify({ action: 'login', passHash }),
  });
  const data = await jsonResponse(response, 'GAS login');
  if (data.status !== 'ok' || !data.token) throw new Error(`GAS ログイン失敗: ${data.message || JSON.stringify(data)}`);
  return data.token;
}

// GAS のセッショントークンを、CMS と同じ形式で全リクエストに付ける。
export function authFetch(fetchImpl, token) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch が利用できません');
  if (!token) throw new Error('GAS 認証トークンが空です');
  return async (url, options = {}) => {
    const next = { ...options };
    if (String(next.method || 'GET').toUpperCase() === 'GET') {
      const parsed = new URL(url);
      parsed.searchParams.set('cmsAuth', token);
      return fetchImpl(parsed.toString(), next);
    }
    let body = next.body;
    if (typeof body === 'string') body = JSON.parse(body);
    next.body = JSON.stringify({ ...(body || {}), cmsAuth: token });
    return fetchImpl(url, next);
  };
}

function value(row, name) {
  const key = Object.keys(row || {}).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? '' : row[key];
}

function proposalId(proposal) {
  return String(value(proposal, 'PROPOSAL_ID') || `${value(proposal, 'FESTIVAL_ID')}-${value(proposal, 'EDITION')}`);
}

export async function planPush(proposals, options = {}) {
  const existingProposals = await options.read('EDITION_PROPOSALS');
  const existingEditions = await options.read('EDITIONS');
  const existingProposalIds = new Set(existingProposals.map((row) => String(value(row, 'PROPOSAL_ID'))));
  const existingEditionIds = new Set(existingEditions.map((row) => String(value(row, 'EDITION_ID'))));
  const seen = new Set([...existingProposalIds, ...existingEditionIds]);
  const accepted = [];
  const results = [];
  for (const proposal of proposals) {
    const id = proposalId(proposal);
    const confidence = String(value(proposal, 'CONFIDENCE')).toLowerCase();
    if (seen.has(id)) {
      results.push({ proposal, id, result: 'skipped-exists' });
    } else if (confidence === 'low') {
      results.push({ proposal, id, result: 'skipped-low' });
    } else {
      accepted.push(proposal);
      seen.add(id);
    }
  }
  const appended = await options.append(accepted);
  const appendedIds = new Set((appended.plan || []).map((item) => value(item.row, 'PROPOSAL_ID')));
  for (const proposal of accepted) results.push({ proposal, id: proposalId(proposal), result: appendedIds.has(proposalId(proposal)) ? 'appended' : 'skipped-exists' });
  return { results, appended, appendedIds: [...appendedIds] };
}

async function run(file, { execute = false, reportPath } = {}) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || !Array.isArray(raw.proposals)) throw new Error(`${file}: proposals 配列がありません`);
  const hash = requireAuthHash();
  const baseFetch = globalThis.fetch;
  const token = await login(baseFetch, GAS_URL, hash);
  const fetcher = authFetch(baseFetch, token);
  const read = async (sheet) => {
    const data = await jsonResponse(await fetcher(`${GAS_URL}?action=get_sheet&sheet=${encodeURIComponent(sheet)}`), `${sheet} read`);
    if (data.status !== 'ok') throw new Error(`${sheet} read failed: ${data.message || JSON.stringify(data)}`);
    return data.rows || [];
  };
  const result = await planPush(raw.proposals, {
    read,
    append: (accepted) => appendProposals(accepted, { fetch: fetcher, gasUrl: GAS_URL, execute }),
  });
  const lines = result.results.map(({ proposal, id, result: status }) => `${id}: ${status} (${value(proposal, 'DATE_START')}–${value(proposal, 'DATE_END')})`);
  console.log(`${file}: appended ${result.appendedIds.length}, skipped ${result.results.length - result.appendedIds.length}`);
  for (const line of lines) console.log(`  ${line}`);
  const report = { file, appended_ids: result.appendedIds, results: result.results.map(({ proposal, id, result: status }) => ({ proposal_id: id, date_start: value(proposal, 'DATE_START'), date_end: value(proposal, 'DATE_END'), confidence: value(proposal, 'CONFIDENCE'), source_url: value(proposal, 'SOURCE_URL'), result: status })) };
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    const table = ['| proposal id | dates | confidence | source | result |', '|---|---|---|---|---|', ...report.results.map((row) => `| ${row.proposal_id} | ${row.date_start}–${row.date_end} | ${row.confidence} | [source](${row.source_url}) | ${row.result} |`)].join('\n') + '\n';
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### 次回開催提案\n${table}`);
  }
  return report;
}

function parseArgs(args) {
  const file = args.find((arg) => !arg.startsWith('--'));
  const execute = args.includes('--execute');
  const reportIndex = args.indexOf('--report');
  return { file, execute, reportPath: reportIndex >= 0 ? args[reportIndex + 1] : undefined };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(process.argv[1]))) {
  const { file, execute, reportPath } = parseArgs(process.argv.slice(2));
  if (!file) { console.error('使い方: node scripts/editions/push-proposals.mjs <file.json> [--execute] [--report <path>]'); process.exit(2); }
  run(file, { execute, reportPath }).catch((error) => { console.error(`提案の送信に失敗しました: ${error.message}`); process.exit(1); });
}
