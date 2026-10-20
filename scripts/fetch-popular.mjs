#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { getAccessToken, parseServiceAccount, runReport } from './lib/ga4-api.mjs';

const OUTPUT = path.resolve('LP/data/popular.json');
const DRY_RUN = process.argv.includes('--dry');

async function fetchReport(accessToken) {
  return runReport(accessToken, {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      limit: 10000,
  });
}

function aggregate(report) {
  const totals = new Map();
  const articlePath = /^\/(?:en\/)?articles\/([a-z0-9-]+)\.html$/;
  for (const row of report.rows || []) {
    const rawPath = row.dimensionValues?.[0]?.value || '';
    const pagePath = rawPath.split(/[?#]/, 1)[0];
    const match = articlePath.exec(pagePath);
    if (!match) continue;
    const views = Number(row.metricValues?.[0]?.value || 0);
    if (!Number.isFinite(views)) continue;
    totals.set(match[1], (totals.get(match[1]) || 0) + views);
  }
  return [...totals.entries()]
    .map(([id, views]) => ({ id, views }))
    .sort((a, b) => b.views - a.views || a.id.localeCompare(b.id));
}

async function main() {
  const rawKey = process.env.GA4_SA_KEY?.trim();
  if (!rawKey) {
    console.log('GA4_SA_KEY is not set; skipping popular.json generation.');
    return;
  }

  const serviceAccount = parseServiceAccount(rawKey);

  const items = aggregate(await fetchReport(await getAccessToken(serviceAccount)));
  const output = {
    generatedAt: new Date().toISOString(),
    days: 30,
    source: 'ga4',
    items,
  };
  console.log('Top 10 monthly popular articles:');
  for (const item of items.slice(0, 10)) console.log(`  ${item.id}: ${item.views}`);
  if (DRY_RUN) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
}

main().catch(error => {
  console.error(`fetch-popular failed: ${error.message}`);
  process.exitCode = 1;
});
