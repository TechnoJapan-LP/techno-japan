#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { getAccessToken, parseServiceAccount, runReport } from './lib/ga4-api.mjs';

export const AI_REFERRER_PATTERN = [
  'chatgpt\\.com', 'chat\\.openai\\.com', 'openai\\.com', 'perplexity\\.ai',
  'gemini\\.google\\.com', 'bard\\.google\\.com', 'copilot\\.microsoft\\.com',
  'bing\\.com/chat', 'claude\\.ai', 'you\\.com', 'phind\\.com', 'poe\\.com',
  'deepseek\\.com', 'meta\\.ai', 'grok\\.com', 'x\\.ai',
].join('|');

const OUTPUT_JSON = path.resolve('reports/ai-referrals.json');
const OUTPUT_MD = path.resolve('reports/ai-referrals.md');
const DRY_RUN = process.argv.includes('--dry');
const METRICS = ['sessions', 'totalUsers'];

function jstDate(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
}

export function periodInfo(now = new Date()) {
  const today = new Date(now);
  const date = (offset) => {
    const value = new Date(today);
    value.setDate(value.getDate() + offset);
    return jstDate(value);
  };
  return {
    current: { startDate: date(-27), endDate: date(0), label: '直近28日' },
    previous: { startDate: date(-55), endDate: date(-28), label: '前の28日' },
  };
}

export function reportRequest(periods, filtered) {
  const body = {
    dateRanges: [periods.current, periods.previous].map(({ startDate, endDate }) => ({ startDate, endDate })),
    metrics: METRICS.map(name => ({ name })),
  };
  if (filtered) {
    body.dimensions = [{ name: 'sessionSource' }, { name: 'landingPagePlusQueryString' }];
    body.dimensionFilter = {
      filter: {
        fieldName: 'sessionSource',
        stringFilter: { matchType: 'FULL_REGEXP', value: AI_REFERRER_PATTERN, caseSensitive: false },
      },
    };
    body.limit = 10000;
  }
  return body;
}

function metric(row, index) {
  const value = Number(row.metricValues?.[index]?.value || 0);
  return Number.isFinite(value) ? value : 0;
}

function emptyPeriod() {
  return { sessions: 0, totalUsers: 0, share: 0, bySource: [], topLandingPages: [] };
}

export function summarize(filteredReport, allReport, periods) {
  const result = {};
  for (const [periodIndex, key] of [[0, 'current'], [1, 'previous']]) {
    const sourceTotals = new Map();
    const landingTotals = new Map();
    for (const row of filteredReport.rows || []) {
      const source = row.dimensionValues?.[0]?.value || '(unknown)';
      const landingPage = row.dimensionValues?.[1]?.value || '(not set)';
      const sessions = metric(row, periodIndex * METRICS.length);
      const totalUsers = metric(row, periodIndex * METRICS.length + 1);
      const sourceItem = sourceTotals.get(source) || { source, sessions: 0, totalUsers: 0 };
      sourceItem.sessions += sessions; sourceItem.totalUsers += totalUsers; sourceTotals.set(source, sourceItem);
      const landingItem = landingTotals.get(landingPage) || { landingPage, sessions: 0, totalUsers: 0 };
      landingItem.sessions += sessions; landingItem.totalUsers += totalUsers; landingTotals.set(landingPage, landingItem);
    }
    const allRow = allReport.rows?.[0];
    const allSessions = metric(allRow || {}, periodIndex * METRICS.length);
    const allUsers = metric(allRow || {}, periodIndex * METRICS.length + 1);
    const aiSessions = [...sourceTotals.values()].reduce((sum, item) => sum + item.sessions, 0);
    result[key] = {
      ...emptyPeriod(),
      sessions: aiSessions,
      totalUsers: [...sourceTotals.values()].reduce((sum, item) => sum + item.totalUsers, 0),
      share: allSessions ? aiSessions / allSessions : 0,
      allSessions,
      allTotalUsers: allUsers,
      bySource: [...sourceTotals.values()].sort((a, b) => b.sessions - a.sessions || a.source.localeCompare(b.source)),
      topLandingPages: [...landingTotals.values()]
        .sort((a, b) => b.sessions - a.sessions || a.landingPage.localeCompare(b.landingPage)).slice(0, 20),
    };
  }
  return { generatedAt: new Date().toISOString(), propertyId: process.env.GA4_PROPERTY_ID?.trim() || '535755449', periods, ...result };
}

function percentage(value) { return `${(value * 100).toFixed(2)}%`; }

export function renderMarkdown(output) {
  const lines = [
    '# AI経由の流入', '',
    `取得日時: ${output.generatedAt}`, '',
    '| 期間 | AIセッション | 全体セッション | AI割合 |', '|---|---:|---:|---:|',
  ];
  for (const key of ['current', 'previous']) {
    const period = output.periods[key]; const data = output[key];
    lines.push(`| ${period.label}（${period.startDate}〜${period.endDate}） | ${data.sessions} | ${data.allSessions} | ${percentage(data.share)} |`);
  }
  for (const key of ['current', 'previous']) {
    const data = output[key];
    lines.push('', `## ${output.periods[key].label}：参照元別`, '', '| 参照元 | セッション | ユーザー |', '|---|---:|---:|');
    for (const item of data.bySource) lines.push(`| ${item.source} | ${item.sessions} | ${item.totalUsers} |`);
    lines.push('', `### ${output.periods[key].label}：ランディングページ上位20`, '', '| ランディングページ | セッション | ユーザー |', '|---|---:|---:|');
    for (const item of data.topLandingPages) lines.push(`| ${item.landingPage} | ${item.sessions} | ${item.totalUsers} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const rawKey = process.env.GA4_SA_KEY?.trim();
  if (!rawKey) { console.log('GA4_SA_KEY is not set; skipping ai-referrals reports.'); return; }
  const serviceAccount = parseServiceAccount(rawKey);
  const periods = periodInfo();
  const token = await getAccessToken(serviceAccount);
  const filtered = await runReport(token, reportRequest(periods, true));
  const all = await runReport(token, reportRequest(periods, false));
  const output = summarize(filtered, all, periods);
  const markdown = renderMarkdown(output);
  if (DRY_RUN) { console.log(JSON.stringify(output, null, 2)); console.log(markdown); return; }
  await mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_MD, markdown, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_JSON)} and ${path.relative(process.cwd(), OUTPUT_MD)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`fetch-ai-referrals failed: ${error.message}`); process.exitCode = 1; });
}
