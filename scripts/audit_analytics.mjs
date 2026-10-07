#!/usr/bin/env node
/*
 * GA4 と Google Search Console の表を抽出するスクリプト。
 * 毎月の効果測定を1コマンドで行えるようにするために作った。
 * preflight からは呼ばれない（Google へのログインと外部ネットワークが必要なため）。
 * Chrome プロファイルは ~/.cache/techno-japan/analytics-profile に保存する。
 * 認証クッキーを含むため、このプロファイルをリポジトリに入れてはいけない。
 * GA4 のレポートIDは UI 由来で壊れやすい。404 になったら画面から辿って取り直すこと。
 * Search Console は sc-domain: ではなく URL プレフィックス
 * https://techno-japan.media/ のプロパティを使う（実測で権限エラーになるため）。
 */

import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const GSC_BREAKDOWNS = ['query', 'page', 'country', 'device', 'date'];
const GA4_REPORTS = [
  'all-pages-and-screens', 'lifecycle-traffic-acquisition-v2', 'landing-page',
  'top-events', 'user-technology-detail',
];
const GSC_URL = 'https://search.google.com/search-console/performance/search-analytics';
const GA4_URL = 'https://analytics.google.com/analytics/web/#/p535755449/reports/explorer';
const LOGIN_MESSAGE = 'ログインが切れています。node scripts/audit_analytics.mjs --login を実行してサインインしてください。';

function help() {
  console.log(`使い方:
  node scripts/audit_analytics.mjs                     # GSC + GA4
  node scripts/audit_analytics.mjs --gsc               # GSC だけ
  node scripts/audit_analytics.mjs --ga4               # GA4 だけ
  node scripts/audit_analytics.mjs --range=28d         # 3m / 28d / 7d
  node scripts/audit_analytics.mjs --login             # 画面付きでログイン
  node scripts/audit_analytics.mjs --out=reports/analytics`);
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { help(); process.exit(0); }
const loginOnly = args.includes('--login');
const onlyGsc = args.includes('--gsc');
const onlyGa4 = args.includes('--ga4');
const rangeArg = args.find(a => a.startsWith('--range='))?.slice(8) || '3m';
if (!['3m', '28d', '7d'].includes(rangeArg)) throw new Error('--range は 3m / 28d / 7d のいずれかです');
if (onlyGsc && onlyGa4) throw new Error('--gsc と --ga4 は同時に指定できません');
const outRoot = path.resolve(args.find(a => a.startsWith('--out='))?.slice(6) || 'reports/analytics');
const today = new Date();
const dateString = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
const profileDir = path.join(process.env.HOME || os.homedir(), '.cache', 'techno-japan', 'analytics-profile');
const chromePath = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function cdp(ws, method, params = {}) {
  const id = ++cdp.nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const onMessage = event => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      ws.removeEventListener('message', onMessage);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    };
    ws.addEventListener('message', onMessage);
  });
}
cdp.nextId = 0;

async function evaluate(ws, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    /* exceptionDetails.text は 'Uncaught' しか入っていないことが多い。
       本当の原因は exception.description にある（2026-10-07、原因が分からず二度手間になった）。 */
    const d = result.exceptionDetails;
    const detail = d.exception?.description || d.text || 'ブラウザ内の評価に失敗しました';
    throw new Error(String(detail).split('\n')[0]);
  }
  return result.result?.value;
}

async function waitFor(ws, expression, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const url = await evaluate(ws, 'location.href');
    if (isLoginUrl(url)) throw Object.assign(new Error(LOGIN_MESSAGE), { loginExpired: true });
    const value = await evaluate(ws, expression);
    if (value) return value;
    await delay(250);
  }
  throw new Error('表が30秒以内に表示されませんでした');
}

function isLoginUrl(url) { return url.startsWith('https://accounts.google.com/'); }
async function assertNotLogin(ws) {
  const url = await evaluate(ws, 'location.href');
  if (isLoginUrl(url)) throw Object.assign(new Error(LOGIN_MESSAGE), { loginExpired: true });
}

async function navigate(ws, url, selectorExpression) {
  await cdp(ws, 'Page.navigate', { url });
  await delay(500);
  await assertNotLogin(ws);
  await waitFor(ws, `!location.href.startsWith('https://accounts.google.com/') && (${selectorExpression})`);
  await assertNotLogin(ws);
}

/* 警告: ブラウザへ送るコードは必ず String.raw で囲むこと。
   素のテンプレートリテラルだと Node 側で \\n や \\d や \\s が先に解釈され、
   正規表現リテラル /\\n+/ が「実際の改行を含む正規表現」になって
   SyntaxError: Invalid regular expression: missing / で落ちる
   （2026-10-07 に実際に踏んだ。exceptionDetails.text が 'Uncaught' しか出さず
   原因が分からなかったので、evaluate 側も description を出すようにした）。 */
async function extractGsc(ws) {
  const value = await evaluate(ws, String.raw`(() => {
    const tables = [...document.querySelectorAll('table')];
    const table = tables.find(t => t.querySelector('tbody tr'));
    if (!table) return null;
    const headers = [...table.querySelectorAll('thead th')].map(x => x.innerText.trim().replace(/\s+/g, ' '));
    const rows = [...table.querySelectorAll('tbody tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.trim().replace(/\s+/g, ' ')));
    /* 合計は表ではなく上部のカードにある。innerText では
       「合計クリック数」と数値の間が改行になるので、| に潰してから1本の正規表現で拾う。
       new RegExp に文字列を渡す書き方はエスケープが1段落ちて使えない。
       正規表現リテラル + String.raw で書くこと（この関数の上のコメント参照）。 */
    const text = document.body.innerText.replace(/\n+/g, ' | ');
    const m = text.match(/合計クリック数 \| ([\d.,万]+)[\s\S]{0,120}?合計表示回数 \| ([\d.,万]+)[\s\S]{0,120}?平均 CTR \| ([\d.]+%)[\s\S]{0,120}?平均掲載順位 \| ([\d.]+)/);
    const find = (i) => (m ? m[i] : '');
    return { headers, rows, totals: { clicks: find(1), impressions: find(2), ctr: find(3), position: find(4) } };
  })()`);
  if (!value?.rows?.length) throw new Error('GSC の行を取得できませんでした');
  return value;
}

/* GA4 の表は既定で10行しか出さない。行数セレクタ（中身が数字だけの mat-select）を開いて
   最大値（250）を選ぶ。Angular Material は要素の .click() を無視することがあるので
   CDP のマウスイベントを送る。

   ⚠️ 選んだ直後は再描画が終わっていない。固定待ちでは足りず、2026-10-07 の実測では
   700ms 待ちで 11 行（＝既定の10行＋見出し）のままだった。**行数が増えるまで待つ**こと。 */
async function selectLargestGa4PageSize(ws) {
  const countRows = () => evaluate(ws, `document.querySelectorAll('[role="row"]').length`);
  const before = await countRows();
  const rect = await evaluate(ws, String.raw`(() => { const s=[...document.querySelectorAll('mat-select')].find(x => /^\s*\d+\s*$/.test(x.innerText)); if (!s) return null; const r=s.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2, now:Number(s.innerText.trim())}; })()`);
  if (!rect) { console.log('  （行数セレクタが見つからないので既定の行数のまま取得します）'); return; }
  /* ⚠️ 行が出た直後はまだ Angular の初期化が終わっておらず、クリックしても
     ドロップダウンが開かない（2026-10-07 実測: option が null のまま10秒待って諦めていた）。
     少し待ってから押し、開かなければもう一度押す。 */
  const openOptions = async () => {
    // 表が長いとセレクタが下へ流れるので、画面内に入れてから座標を取り直す
    await evaluate(ws, String.raw`(() => { const s=[...document.querySelectorAll('mat-select')].find(x => /^\s*\d+\s*$/.test(x.innerText)); if (s) s.scrollIntoView({block:'center'}); return 1; })()`);
    await delay(400);
    const r2 = await evaluate(ws, String.raw`(() => { const s=[...document.querySelectorAll('mat-select')].find(x => /^\s*\d+\s*$/.test(x.innerText)); if (!s) return null; const r=s.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; })()`);
    if (r2) { rect.x = r2.x; rect.y = r2.y; }
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await cdp(ws, 'Input.dispatchMouseEvent', { type, x: rect.x, y: rect.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
    }
    return waitFor(ws, String.raw`(() => { const o=[...document.querySelectorAll('mat-option')].map(x => Number(x.innerText.trim())).filter(Number.isFinite); return o.length ? Math.max(...o) : null; })()`, 6000).catch(() => null);
  };
  await delay(2500);
  let option = await openOptions();
  if (!option) { await delay(2500); option = await openOptions(); }
  if (!option || option <= rect.now) return;
  const optionRect = await evaluate(ws, `(() => { const x=[...document.querySelectorAll('mat-option')].find(x => Number(x.innerText.trim()) === ${option}); if (!x) return null; const r=x.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; })()`);
  if (!optionRect) return;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await cdp(ws, 'Input.dispatchMouseEvent', { type, x: optionRect.x, y: optionRect.y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
  }
  // 行が増えるまで待つ。増えないまま時間切れでも、取れるぶんは取る。
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    await delay(400);
    if ((await countRows()) > before) return;
  }
  /* 元の行数が上限（見出し＋合計＋rect.now 行）に達していなかった表は、
     データ自体が10行未満なので増えなくて当たり前。警告は打ち切られていた表だけに出す。 */
  if (before >= rect.now + 2) {
    console.log(`  （行数を ${option} にしたが増えませんでした。表示されているぶんだけ取得します）`);
  }
}

async function extractGa4(ws) {
  await selectLargestGa4PageSize(ws);
  await delay(1200);
  const value = await evaluate(ws, String.raw`(() => {
    const rows = [...document.querySelectorAll('[role="row"]')];
    if (rows.length < 2) return null;
    /* GA4 の列名はセル内で改行している（「ページパスとスクリーン クラス\nページパスとスクリーン クラス」）。
       そのまま CSV にすると1セルが複数行になって読みにくいので空白に潰す。 */
    const cells = row => [...row.querySelectorAll('[role="cell"], [role="columnheader"]')].map(x => x.innerText.trim().replace(/\s+/g, ' '));
    return { headers: cells(rows[0]), rows: rows.slice(1).map(cells), totals: {} };
  })()`);
  if (!value?.rows?.length) throw new Error('GA4 の行を取得できませんでした');
  return value;
}

function csv(rows, headers) {
  return [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
}
function rangeInfo() {
  const days = rangeArg === '3m' ? 90 : Number(rangeArg.slice(0, -1));
  const start = new Date(today); start.setDate(start.getDate() - days + 1);
  const ymd = d => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).replaceAll('-', '');
  return { days, gsc: rangeArg === '3m' ? 'num_of_months=3' : `num_of_days=${days}`, start: ymd(start), end: ymd(today), label: rangeArg === '3m' ? '90d' : rangeArg };
}

function numeric(value) { return Number(String(value).replaceAll(',', '').replace('%', '').replace('万', '')) || 0; }
function formatTotal(value) { return value || '-'; }
function pctChange(current, previous) { return previous ? `${((numeric(current) - numeric(previous)) / numeric(previous) * 100).toFixed(1)}%` : '—'; }

async function previousGscTotals() {
  try {
    const dirs = (await readdir(outRoot, { withFileTypes: true })).filter(x => x.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x => x.name).filter(x => x < dateString).sort().reverse();
    if (!dirs[0]) return null;
    return JSON.parse(await readFile(path.join(outRoot, dirs[0], `gsc-${rangeArg}.json`), 'utf8'));
  } catch { return null; }
}

async function main() {
  try { execFileSync(chromePath, ['--version'], { stdio: 'ignore' }); } catch { throw new Error(`Chrome が見つかりません: ${chromePath}`); }
  await mkdir(profileDir, { recursive: true });
  const port = await freePort();
  const chrome = spawn(chromePath, ['--no-first-run', '--disable-extensions', `--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`, ...(loginOnly ? [] : ['--headless=new']), 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 100 && !target; i++) { await delay(100); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.type === 'page'); } catch {} }
    if (!target) throw new Error('Chrome DevTools のページに接続できません');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
    await cdp(ws, 'Page.enable'); await cdp(ws, 'Runtime.enable');
    /* 警告: ビューポートを必ず広げること。headless の既定は 800x600 で、
       GA4 の行数セレクタは y=664 付近にあるため画面外になり、CDP のマウスイベントが
       どこにも当たらない（2026-10-07 実測: ドロップダウンが開かず10行のままだった）。 */
    await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 1600, deviceScaleFactor: 1, mobile: false });
    if (loginOnly) {
      for (const url of ['https://search.google.com/search-console', 'https://analytics.google.com']) {
        await cdp(ws, 'Page.navigate', { url });
        await delay(1500);
        console.log('ログインしたら、このウィンドウを閉じてください。Enterで次へ進みます。');
        await new Promise(resolve => process.stdin.once('data', resolve));
      }
      return;
    }
    const range = rangeInfo();
    const results = { gsc: {}, ga4: {} }; const failures = [];
    if (!onlyGa4) for (const breakdown of GSC_BREAKDOWNS) {
      try {
        const url = `${GSC_URL}?resource_id=${encodeURIComponent('https://techno-japan.media/')}&${range.gsc}&breakdown=${breakdown}`;
        await navigate(ws, url, 'document.querySelectorAll("table tbody tr").length > 0');
        results.gsc[breakdown] = await extractGsc(ws);
        const t = results.gsc[breakdown].totals;
        console.log(`GSC ${rangeArg} ${breakdown}: ${results.gsc[breakdown].rows.length}行 / 合計 クリック${formatTotal(t.clicks)} 表示${formatTotal(t.impressions)}`);
      } catch (error) { if (error.loginExpired) throw error; failures.push(`GSC ${breakdown}: ${error.message}`); console.error(`GSC ${rangeArg} ${breakdown}: 取得失敗`); }
    }
    if (!onlyGsc) for (const report of GA4_REPORTS) {
      try {
        const url = `${GA4_URL}?params=_u..nav%3Dmaui%26_u.date00%3D${range.start}%26_u.date01%3D${range.end}&r=${report}`;
        await navigate(ws, url, 'document.querySelectorAll("[role=row]").length > 1');
        results.ga4[report] = await extractGa4(ws);
        console.log(`GA4 ${range.label} ${report}: ${results.ga4[report].rows.length}行`);
      } catch (error) { if (error.loginExpired) throw error; failures.push(`GA4 ${report}: ${error.message}`); console.error(`GA4 ${range.label} ${report}: 取得失敗`); }
    }
    const totalTables = Object.keys(results.gsc).length + Object.keys(results.ga4).length;
    if (!totalTables) { for (const failure of failures) console.error(`取得できなかった表: ${failure}`); process.exitCode = 1; return; }
    const dir = path.join(outRoot, dateString); await mkdir(dir, { recursive: true });
    for (const [breakdown, data] of Object.entries(results.gsc)) await writeFile(path.join(dir, `gsc-${rangeArg}-${breakdown}.csv`), csv(data.rows, data.headers));
    for (const [report, data] of Object.entries(results.ga4)) await writeFile(path.join(dir, `ga4-${range.label}-${report}.csv`), csv(data.rows, data.headers));
    if (Object.keys(results.gsc).length) await writeFile(path.join(dir, `gsc-${rangeArg}.json`), JSON.stringify(results.gsc, null, 2) + '\n');
    if (Object.keys(results.ga4).length) await writeFile(path.join(dir, `ga4-${range.label}.json`), JSON.stringify(results.ga4, null, 2) + '\n');
    const previous = await previousGscTotals();
    const summary = [`# Analytics audit`, '', `- 実行日: ${dateString}`, `- 期間: ${rangeArg}（${range.start}〜${range.end}）`, '', '| 表 | 行数 |', '|---|---:|', ...Object.entries(results.gsc).map(([k,v]) => `| GSC ${k} | ${v.rows.length} |`), ...Object.entries(results.ga4).map(([k,v]) => `| GA4 ${k} | ${v.rows.length} |`), ''];
    if (Object.keys(results.gsc).length) {
      summary.push('| GSC 合計 | 値 | 前回比 |', '|---|---:|---:|');
      const t = results.gsc[Object.keys(results.gsc)[0]].totals; const p = previous?.[Object.keys(results.gsc)[0]]?.totals;
      for (const [label, key] of [['クリック','clicks'],['表示','impressions'],['CTR','ctr'],['掲載順位','position']]) summary.push(`| ${label} | ${formatTotal(t[key])} | ${p ? pctChange(t[key], p[key]) : '—'} |`);
      summary.push('');
    }
    if (failures.length) summary.push('## 取得できなかった表', '', ...failures.map(x => `- ${x}`), '');
    await writeFile(path.join(dir, 'summary.md'), summary.join('\n'));
    for (const failure of failures) console.error(`取得できなかった表: ${failure}`);
    if (failures.length) process.exitCode = 1;
  } finally { chrome.kill('SIGTERM'); }
}

main().catch(error => { if (error.loginExpired) { console.error(error.message); process.exitCode = 2; } else { console.error(error.message); process.exitCode = 1; } });
