import { createSign } from 'node:crypto';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const DEFAULT_PROPERTY_ID = '535755449';

function base64Url(value) {
  return Buffer.from(value).toString('base64')
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
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

export function parseServiceAccount(rawKey) {
  let serviceAccount;
  try { serviceAccount = JSON.parse(rawKey); }
  catch (error) { throw new Error(`GA4_SA_KEY is not valid JSON: ${error.message}`); }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('GA4_SA_KEY must contain client_email and private_key');
  }
  return serviceAccount;
}

async function responseBody(response) { return (await response.text()).trim(); }

export async function getAccessToken(serviceAccount) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: makeJwt(serviceAccount),
    }),
  });
  if (!response.ok) throw new Error(`OAuth token request failed (HTTP ${response.status}): ${await responseBody(response)}`);
  const token = await response.json();
  if (!token.access_token) throw new Error(`OAuth token response has no access_token: ${JSON.stringify(token)}`);
  return token.access_token;
}

export async function runReport(accessToken, body, propertyId = process.env.GA4_PROPERTY_ID?.trim() || DEFAULT_PROPERTY_ID) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`GA4 report request failed (HTTP ${response.status}): ${await responseBody(response)}`);
  return response.json();
}
