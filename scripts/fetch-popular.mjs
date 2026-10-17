#!/usr/bin/env node

import { createSign } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OUTPUT = path.resolve('LP/data/popular.json');
const DRY_RUN = process.argv.includes('--dry');

function base64Url(value) {
  return Buffer.from(value).toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function makeJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  return `${unsigned}.${base64Url(signer.sign(serviceAccount.private_key))}`;
}

async function responseBody(response) {
  return (await response.text()).trim();
}

async function getAccessToken(serviceAccount) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: makeJwt(serviceAccount),
    }),
  });
  if (!response.ok) {
    throw new Error(`OAuth token request failed (HTTP ${response.status}): ${await responseBody(response)}`);
  }
  const token = await response.json();
  if (!token.access_token) throw new Error(`OAuth token response has no access_token: ${JSON.stringify(token)}`);
  return token.access_token;
}

async function fetchReport(accessToken) {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim() || '535755449';
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      limit: 10000,
    }),
  });
  if (!response.ok) {
    throw new Error(`GA4 report request failed (HTTP ${response.status}): ${await responseBody(response)}`);
  }
  return response.json();
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

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(rawKey);
  } catch (error) {
    throw new Error(`GA4_SA_KEY is not valid JSON: ${error.message}`);
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('GA4_SA_KEY must contain client_email and private_key');
  }

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
