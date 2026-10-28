#!/usr/bin/env node
/* フェス詳細 ACCESS MAP の遅延初期化、座標、操作性、フォールバックと、
 * 座標なしページで地図を出さないことを確認する。 */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.join(process.cwd(), 'LP');
const FESTIVAL = 'labyrinth';
const pages = ['/festivals/labyrinth.html', '/en/festivals/labyrinth.html'];
const viewports = [
  { name: 'PC', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'PC narrow', width: 1280, height: 720, dpr: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, dpr: 3, mobile: true },
];
const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.json': 'application/json;charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
const chromeCandidates = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => (
  candidate.includes('/') ? fs.existsSync(candidate) : spawnSync('which', [candidate]).status === 0
));
const editionsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'editions.json'), 'utf8'));
const editions = Array.isArray(editionsData) ? editionsData : editionsData.items;
const expectedEdition = editions.find((edition) => edition.EDITION_ID === `${FESTIVAL}-2026`);

if (!chrome) {
  console.error('✗ Chrome/Chromium が見つかりません');
  process.exit(1);
}
if (!expectedEdition || !Number.isFinite(Number(expectedEdition.LAT)) || !Number.isFinite(Number(expectedEdition.LNG))) {
  console.error(`✗ ${FESTIVAL}-2026 の座標が読めません`);
  process.exit(1);
}

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

let nextCdpId = 0;
function cdp(ws, method, params = {}) {
  const id = ++nextCdpId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      clearTimeout(timer);
      ws.removeEventListener('message', onMessage);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    };
    ws.addEventListener('message', onMessage);
  });
}

async function evaluate(ws, expression) {
  const result = await cdp(ws, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'ブラウザ内の評価に失敗しました');
  }
  return result.result?.value;
}

async function waitFor(ws, expression, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await evaluate(ws, expression)) return true;
    await delay(100);
  }
  return false;
}

async function waitForScrollSettled(ws, timeout = 3000) {
  const deadline = Date.now() + timeout;
  let previous = await evaluate(ws, 'window.scrollY');
  while (Date.now() < deadline) {
    await delay(Math.min(150, deadline - Date.now()));
    const current = await evaluate(ws, 'window.scrollY');
    if (current === previous) return { settled: true, scrollY: current };
    previous = current;
  }
  return { settled: false, scrollY: previous };
}

async function openTarget(debugPort) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(100);
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
      const target = targets.find((item) => item.type === 'page');
      if (target) return target;
    } catch {
      // DevTools endpoint が開くまで待つ。
    }
  }
  throw new Error('Chrome DevTools のページに接続できません');
}

async function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  const exited = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 2000);
    child.once('close', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  if (!exited && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) resolve();
      else child.once('close', resolve);
    });
  }
}

function removeProfileDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`⚠️ 一時プロフィールの削除に失敗しました: ${error.message}`);
  }
}

function errorsProbe() {
  return `
    window.__tjFestivalMapErrors = [];
    window.addEventListener('error', function(event) {
      window.__tjFestivalMapErrors.push(event.message || 'window error');
    });
    window.addEventListener('unhandledrejection', function(event) {
      window.__tjFestivalMapErrors.push(String(event.reason || 'unhandled rejection'));
    });
  `;
}

const server = http.createServer((request, response) => {
  let requestPath;
  try {
    requestPath = decodeURIComponent(new URL(request.url, 'http://check.local').pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  const file = path.join(ROOT, requestPath);
  if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  response.end(fs.readFileSync(file));
});

async function checkPage(ws, base, page, viewport) {
  await cdp(ws, 'Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.dpr,
    mobile: viewport.mobile,
  });
  await cdp(ws, 'Emulation.setTouchEmulationEnabled', viewport.mobile
    ? { enabled: true, maxTouchPoints: 5 }
    : { enabled: false });
  await cdp(ws, 'Page.navigate', { url: `${base}${page}` });
  const loaded = await waitFor(ws, 'document.readyState === "complete" && !!document.querySelector(".festival-detail-page")');
  if (!loaded) throw new Error(`${page} が読み込めませんでした`);
  await delay(300);

  const initial = await evaluate(ws, `({
    leaflet: performance.getEntriesByType('resource').some(function(entry) { return /\\/leaflet(?:\\.min)?\\.js(?:\\?|$)/.test(entry.name); }),
    mapDistance: (() => {
      var map = document.querySelector('.festival-map');
      return map ? map.getBoundingClientRect().top - innerHeight : null;
    })(),
    status: document.querySelector('.festival-map')?.dataset.mapStatus || '',
    errors: window.__tjFestivalMapErrors || []
  })`);
  if (initial.mapDistance === null) throw new Error(`${page} ${viewport.name}: 座標付きACCESS地図がありません`);
  if (initial.mapDistance > 350) {
    deferredChecks += 1;
    if (initial.leaflet) throw new Error(`${page} ${viewport.name}: ACCESS が${Math.round(initial.mapDistance)}px離れた初期表示で Leaflet を読み込んだ`);
  } else {
    console.log(`  − ${viewport.name} ${page}: ACCESS は初期表示から${Math.round(initial.mapDistance)}px、読み込みを許可`);
  }

  const scrolled = await evaluate(ws, `(() => {
    var map = document.querySelector('.festival-map');
    if (!map) return false;
    map.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    return true;
  })()`);
  if (!scrolled) throw new Error(`${page} ${viewport.name}: 座標付きACCESS地図がありません`);
  const initialized = await waitFor(ws, `(() => {
    var map = document.querySelector('.festival-map');
    return map && (map.dataset.mapStatus === 'ready' || map.dataset.mapStatus === 'offline');
  })()`);
  if (!initialized) throw new Error(`${page} ${viewport.name}: 地図が ready/offline になりませんでした`);
  const scrollSettled = await waitForScrollSettled(ws);
  if (!scrollSettled.settled) {
    throw new Error(`${page} ${viewport.name}: スクロールが3秒以内に停止しませんでした (scrollY=${scrollSettled.scrollY})`);
  }

  const result = await evaluate(ws, `(() => {
    var map = document.querySelector('.festival-map');
    var leafletMap = map && map._tjMap;
    var link = map && map.querySelector('.festival-map-link');
    var rect = link && link.getBoundingClientRect();
    var attribution = map && map.querySelector('.leaflet-control-attribution');
    var attributionRect = attribution && attribution.getBoundingClientRect();
    var mapRect = map && map.getBoundingClientRect();
    var marker = map && map.querySelector('.festival-map-marker');
    var tilePane = map && map.querySelector('.leaflet-tile-pane');
    var linkCenterElement = rect && document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    var overlaps = function (a, b) {
      return !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    };
    return {
      status: map?.dataset.mapStatus || '',
      center: leafletMap ? leafletMap.getCenter() : null,
      markers: map ? map.querySelectorAll('.festival-map-marker').length : 0,
      dragEnabled: leafletMap ? leafletMap.dragging.enabled() : null,
      googleHref: link?.href || '',
      linkVisible: !!rect && rect.width > 0 && rect.height > 0 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
      linkHeight: rect?.height || 0,
      linkInteractive: !!link && (linkCenterElement === link || link.contains(linkCenterElement)),
      attributionText: attribution?.textContent || '',
      attributionVisible: !!attributionRect && attributionRect.width > 0 && attributionRect.height > 0,
      attributionInMap: !!mapRect && !!attributionRect && attributionRect.left >= mapRect.left - 1 && attributionRect.right <= mapRect.right + 1 && attributionRect.top >= mapRect.top - 1 && attributionRect.bottom <= mapRect.bottom + 1,
      attributionFontSize: attribution ? parseFloat(getComputedStyle(attribution).fontSize) : 0,
      linksOverlapAttribution: overlaps(rect, attributionRect),
      osmClass: !!map?.classList.contains('tj-map-osm'),
      osmFilter: tilePane ? getComputedStyle(tilePane).filter : '',
      osmFilterDef: !!document.getElementById('tj-map-osm-dark'),
      markerRole: marker?.getAttribute('role') || '',
      markerTabindex: marker?.getAttribute('tabindex'),
      touchAction: map?.querySelector('.leaflet-container') ? getComputedStyle(map.querySelector('.leaflet-container')).touchAction : '',
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      errors: window.__tjFestivalMapErrors || []
    };
  })()`);
  const failures = [];
  if (initial.errors.length) failures.push(`初期化エラー: ${initial.errors.join(' / ')}`);
  if (result.errors.length) failures.push(`ブラウザエラー: ${result.errors.join(' / ')}`);
  if (!['ready', 'offline'].includes(result.status)) failures.push(`status=${result.status}`);
  if (result.status === 'ready') {
    const latDiff = Math.abs(Number(result.center?.lat) - Number(expectedEdition.LAT));
    const lngDiff = Math.abs(Number(result.center?.lng) - Number(expectedEdition.LNG));
    if (latDiff > 0.001 || lngDiff > 0.001) failures.push(`中心座標が不一致 (${result.center?.lat}, ${result.center?.lng})`);
    if (result.markers !== 1) failures.push(`赤い目印 ${result.markers}件`);
    if (viewport.mobile && result.dragEnabled !== false) failures.push('390pxでドラッグが無効になっていない');
    if (result.linksOverlapAttribution) failures.push('Google Mapsリンクと出典表示が重なっている');
    if (!result.linkInteractive) failures.push('Google Mapsリンクの中心がリンクではない');
    if (result.linkHeight < 44) failures.push(`Google Mapsリンクの高さが${result.linkHeight}px`);
    if (!result.attributionVisible || !result.attributionInMap || !result.attributionText.includes('OpenStreetMap')) failures.push('出典表示が地図内に見えない、または OpenStreetMap がない');
    if (result.attributionFontSize < 10) failures.push(`出典表示の文字が${result.attributionFontSize}px`);
    if (result.osmClass && (!result.osmFilterDef || !/tj-map-osm-dark/.test(result.osmFilter))) failures.push('OSM地図の暗色フィルターがない');
    if (result.markerRole === 'button' || result.markerTabindex !== null) failures.push('目印に操作用role/tabindexがある');
    if (viewport.mobile && /^(none|.*pinch-zoom.*)$/.test(result.touchAction)) failures.push(`390pxのtouch-actionが${result.touchAction}`);
  }
  if (!/^https:\/\/maps\.google\.com\/\?q=/.test(result.googleHref)) failures.push('Google Mapsリンクが不正');
  if (!result.linkVisible) failures.push('Google Mapsリンクが押せる位置にない');
  if (result.overflow) failures.push('ページが横にはみ出している');
  if (failures.length) throw new Error(`${page} ${viewport.name}: ${failures.join(' / ')}`);
  return result.status;
}

function inspectStaticPages() {
  const locales = [
    { label: 'JA', dir: path.join(ROOT, 'festivals'), urlPrefix: '/festivals/' },
    { label: 'EN', dir: path.join(ROOT, 'en', 'festivals'), urlPrefix: '/en/festivals/' },
  ];
  let coordinateCount = 0;
  let noCoordinateCount = 0;
  let noCoordinatePage = null;
  for (const locale of locales) {
    const files = fs.readdirSync(locale.dir).filter((name) => name.endsWith('.html')).sort();
    let localeCoordinateCount = 0;
    let localeNoCoordinateCount = 0;
    for (const name of files) {
      const html = fs.readFileSync(path.join(locale.dir, name), 'utf8');
      if (!html.includes('class="festival-detail-page')) continue;
      const hasCoordinateMap = html.includes('class="festival-map tj-map"');
      const scripts = [...html.matchAll(/<script\b[^>]+src="([^"]*(?:map-tiles|festival-map)\.js\?v=\d+)"[^>]*>/g)];
      const allMapScripts = [...html.matchAll(/<script\b[^>]+src="[^"]*(?:map-tiles|festival-map)\.js(?:\?[^" ]*)?"[^>]*>/g)];
      const access = html.match(/<aside class="festival-access">([\s\S]*?)<\/aside>/)?.[1] || '';
      if (!access) throw new Error(`${locale.label} ${name}: ACCESS欄がありません`);
      if (!/<div class="festival-panel-heading"><h2 class="mono red">Access<\/h2><\/div>/.test(access)) {
        throw new Error(`${locale.label} ${name}: ACCESS見出しがありません`);
      }
      if (hasCoordinateMap) {
        localeCoordinateCount += 1;
        const hasDeferredMapTiles = scripts.some((match) => /map-tiles\.js\?v=\d+/.test(match[1]) && /\sdefer(?:\s|>)/.test(match[0]));
        const hasDeferredFestivalMap = scripts.some((match) => /festival-map\.js\?v=\d+/.test(match[1]) && /\sdefer(?:\s|>)/.test(match[0]));
        if (scripts.length !== 2 || !hasDeferredMapTiles || !hasDeferredFestivalMap) {
          throw new Error(`${locale.label} ${name}: 座標付き地図の map script または defer が不正`);
        }
      } else {
        localeNoCoordinateCount += 1;
        if (html.includes('class="festival-map')) throw new Error(`${locale.label} ${name}: 座標なしページにACCESSの地図枠があります`);
        if (!/<div class="festival-panel-heading"><h2 class="mono red">Access<\/h2><\/div><span class="mono">[^<]*<\/span>/.test(access)) {
          throw new Error(`${locale.label} ${name}: 座標なしページに会場名の行がありません`);
        }
        if (allMapScripts.length) throw new Error(`${locale.label} ${name}: 座標なしページに map script があります`);
        if (!noCoordinatePage && locale.label === 'JA') noCoordinatePage = `${locale.urlPrefix}${name}`;
      }
    }
    coordinateCount += localeCoordinateCount;
    noCoordinateCount += localeNoCoordinateCount;
    console.log(`  ✅ 静的 ${locale.label}: 座標あり ${localeCoordinateCount}件 / なし ${localeNoCoordinateCount}件`);
  }
  console.log(`  ✅ 静的合計: 座標あり ${coordinateCount}件 / なし ${noCoordinateCount}件`);
  return noCoordinatePage;
}

let browser;
let ws;
let profileDir;
let base;
let deferredChecks = 0;
try {
  const noCoordinatePage = inspectStaticPages();
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const debugPort = await freePort();
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-festival-access-map-'));
  browser = spawn(chrome, [
    '--headless=new', '--no-sandbox', '--no-first-run', '--disable-extensions',
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, 'about:blank',
  ], { stdio: 'ignore' });
  const target = await openTarget(debugPort);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  await cdp(ws, 'Page.enable');
  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: errorsProbe() });

  let readyCount = 0;
  let offlineCount = 0;
  for (const viewport of viewports) {
    for (const page of pages) {
      const status = await checkPage(ws, base, page, viewport);
      if (status === 'ready') readyCount += 1;
      else offlineCount += 1;
      console.log(`  ✅ ${viewport.name} ${page}: ACCESS MAP ${status}`);
    }
  }

  if (noCoordinatePage) {
    await cdp(ws, 'Page.navigate', { url: `${base}${noCoordinatePage}` });
    if (!await waitFor(ws, 'document.readyState === "complete" && !!document.querySelector(".festival-detail-page")')) {
      throw new Error(`座標なしページ ${noCoordinatePage} が読み込めませんでした`);
    }
    const noMap = await evaluate(ws, `({
      frame: !!document.querySelector('.festival-map'),
      access: !!document.querySelector('aside.festival-access'),
      heading: (() => {
        var heading = document.querySelector('aside.festival-access .festival-panel-heading h2');
        return heading && heading.textContent.trim() === 'Access';
      })(),
      venue: (() => {
        var venue = document.querySelector('aside.festival-access .festival-panel-heading + .mono');
        if (!venue) return false;
        var rect = venue.getBoundingClientRect();
        return !!venue.textContent.trim() && rect.width > 0 && rect.height > 0;
      })(),
      mapScript: performance.getEntriesByType('resource').some(function(entry) { return /(?:map-tiles|festival-map)\\.js(?:\\?|$)/.test(entry.name); }),
      leaflet: performance.getEntriesByType('resource').some(function(entry) { return /\\/leaflet(?:\\.min)?\\.js(?:\\?|$)/.test(entry.name); }),
      errors: window.__tjFestivalMapErrors || []
    })`);
    if (noMap.frame || !noMap.access || !noMap.heading || !noMap.venue || noMap.mapScript || noMap.leaflet || noMap.errors.length) throw new Error(`座標なしページ ${noCoordinatePage} のACCESS欄または通信が不正です`);
    console.log(`  ✅ 座標なしフェス ${noCoordinatePage}: ACCESS見出し・会場名あり / 地図通信なし`);
  }
  if (deferredChecks < 2) throw new Error(`遠い初期表示の遅延読み込み確認が${deferredChecks}回で、2回未満`);
  console.log(`  ✅ 遠い初期表示の遅延確認: ${deferredChecks}回`);
  console.log(`  ✅ Festival ACCESS MAP: ready ${readyCount}件 / offline ${offlineCount}件`);
} catch (error) {
  console.error(`✗ フェス詳細ACCESS地図: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (ws) ws.close();
  if (browser) await stopProcess(browser);
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (profileDir) removeProfileDir(profileDir);
}
