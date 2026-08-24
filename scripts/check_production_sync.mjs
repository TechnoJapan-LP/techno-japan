#!/usr/bin/env node
/**
 * 本番の公開状態をmainと照合する見張り番。
 * 外部ライブラリ・認証情報・データの書き換えは行わない。
 *
 * 通常:
 *   node scripts/check_production_sync.mjs
 * 自動テスト:
 *   node scripts/check_production_sync.mjs --self-test
 *
 * ■ なぜ要るか
 *
 * 2026-08-14 から 08-24 まで、**本番が10日間更新されていなかった**。
 * Publish pipeline は4回失敗し、空コミットの回はワークフロー自体が起動せず、
 * 誰も気づかないまま10日が過ぎた。AUDIT の Publish 事故はすべて
 * 「失敗が静かだった」ことが共通していた。
 *
 * だから見るのは Actions の成否だけではない。**本番が実際に何を配っているか**を
 * main と突き合わせる。ワークフローが起動しなかった事故は、これでしか見つからない。
 *
 * ■ 誤報を出さないための猶予（2026-08-24 追加）
 *
 * Publish から本番反映まで数分かかる。その間 main と本番は正しく食い違う。
 * ここを毎回「未公開」と鳴らすと、通知が信用されなくなり、
 * **本物の失敗を見逃す**という元の事故に戻る。
 * そこで不一致を見つけたら、公開が進行中かどうかを先に確かめる。
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const WORKFLOWS = [
  { file: 'publish-pipeline.yml', label: 'Publish pipeline' },
  { file: 'generate-meta.yml', label: 'sitemap / RSS' },
];

/* 公開を本番へ届ける経路。これが動いている最中の不一致は異常ではない。 */
const DEPLOYING_WORKFLOWS = ['publish-pipeline.yml', 'deploy-pages.yml'];

/* data.js がこの分数以内に変わっていれば、まだ配信が追いついていないとみなす。
   Publish pipeline の実測は 1分38秒 / 1分42秒。倍以上の余裕を取る。 */
const GRACE_MINUTES = 10;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseRuns(payload) {
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  return runs
    .filter((run) => run && run.status === 'completed')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function summarizeWorkflow(payload, label) {
  const latest = parseRuns(payload)[0];
  if (!latest) return `${label}: completed run が見つかりません`;
  return `${label}: ${latest.conclusion} / ${latest.created_at} / ${latest.html_url || 'URLなし'}`;
}

/* 進行中・待機中の run があるか。completed 以外をすべて拾う。 */
function hasRunInFlight(payload) {
  const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  return runs.some((run) => run && run.status !== 'completed');
}

/* コミット時刻が猶予内か。時刻が読めなければ猶予を与えない（安全側）。 */
function isWithinGrace(committedAt, nowMs, graceMinutes = GRACE_MINUTES) {
  const t = new Date(committedAt || '').getTime();
  if (!Number.isFinite(t)) return false;
  const diffMs = nowMs - t;
  if (diffMs < 0) return false;
  return diffMs <= graceMinutes * 60 * 1000;
}

/**
 * 不一致を「異常」と呼ぶかどうかの判断。ネットワークに触らない純関数にしてある。
 * 検知そのものが壊れていないかを --self-test で毎回確かめられるようにするため。
 */
function evaluateSync({ expectedHash, liveHash, publishInFlight = false, dataJsWithinGrace = false }) {
  if (expectedHash === liveHash) {
    return { ok: true, reason: 'match', message: '本番とmainのdata.jsは一致しています。' };
  }
  if (publishInFlight) {
    return {
      ok: true,
      reason: 'in-flight',
      message: '本番とmainのdata.jsが違いますが、公開処理が進行中です。異常として扱いません。',
    };
  }
  if (dataJsWithinGrace) {
    return {
      ok: true,
      reason: 'grace',
      message: `本番とmainのdata.jsが違いますが、直近${GRACE_MINUTES}分以内の公開です。異常として扱いません。`,
    };
  }
  return {
    ok: false,
    reason: 'stale',
    message: '本番とmainのdata.jsが一致しません。未公開状態の可能性があります。',
  };
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: options.headers,
    });
    if (!response.ok) throw new Error(`${url} がHTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function makeApi(token, repository, apiBase) {
  return async (path) => JSON.parse(await fetchText(`${apiBase}/repos/${repository}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  }));
}

async function check() {
  const expectedPath = process.env.PRODUCTION_SYNC_EXPECTED || 'LP/data.js';
  const liveUrl = process.env.PRODUCTION_SYNC_LIVE_URL || 'https://techno-japan.media/data.js';
  const expected = await fs.readFile(expectedPath);
  const live = Buffer.from(await fetchText(liveUrl));
  const expectedHash = sha256(expected);
  const liveHash = sha256(live);

  console.log(`main: 本番データ ${expectedHash} (${expected.length} bytes)`);
  console.log(`live: 本番データ ${liveHash} (${live.length} bytes)`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const apiBase = process.env.GITHUB_API_URL || 'https://api.github.com';

  if (!token || !repository) {
    /* API を引けないときは猶予を判定できない。**猶予を与えずに鳴らす**。
       見逃すより誤報の方がまだ直せる。 */
    const verdict = evaluateSync({ expectedHash, liveHash });
    console.log('Actions: GitHub API情報なし（ハッシュ照合のみ）');
    if (!verdict.ok) throw new Error(verdict.message);
    console.log(verdict.message);
    return;
  }

  const api = makeApi(token, repository, apiBase);

  let publishInFlight = false;
  let dataJsWithinGrace = false;
  if (expectedHash !== liveHash) {
    /* 不一致のときだけ追加で問い合わせる。通常時のAPI消費を増やさない。 */
    for (const file of DEPLOYING_WORKFLOWS) {
      const payload = await api(`/actions/workflows/${file}/runs?branch=main&per_page=10`);
      if (hasRunInFlight(payload)) { publishInFlight = true; break; }
    }
    if (!publishInFlight) {
      const commits = await api('/commits?sha=main&path=LP/data.js&per_page=1');
      const committedAt = commits?.[0]?.commit?.committer?.date || commits?.[0]?.commit?.author?.date;
      dataJsWithinGrace = isWithinGrace(committedAt, Date.now());
      if (committedAt) console.log(`data.js の最終更新: ${committedAt}`);
    }
  }

  const verdict = evaluateSync({ expectedHash, liveHash, publishInFlight, dataJsWithinGrace });
  console.log(verdict.message);
  if (!verdict.ok) throw new Error(verdict.message);

  for (const workflow of WORKFLOWS) {
    const payload = await api(`/actions/workflows/${workflow.file}/runs?branch=main&per_page=20`);
    console.log(summarizeWorkflow(payload, workflow.label));
    const latest = parseRuns(payload)[0];
    if (!latest) throw new Error(`${workflow.label}の完了済みrunがありません。`);
    if (latest.conclusion !== 'success') {
      throw new Error(`${workflow.label}の最新runが${latest.conclusion}です。${latest.html_url || ''}`);
    }
  }
}

/* 検知そのものが壊れていないかを確かめる。
   preflight から毎回走るので、「一致したときに通る」だけでなく
   **「不一致のときに落ちる」**ことまで見る。ここを緩めないこと。 */
function selfTest() {
  const assert = (cond, label) => { if (!cond) throw new Error(`自己テスト失敗: ${label}`); };

  const same = Buffer.from('same');
  assert(sha256(same) === sha256(Buffer.from('same')), 'SHA-256同値判定');
  assert(sha256(same) !== sha256(Buffer.from('different')), 'SHA-256差分判定');

  const payload = { workflow_runs: [
    { status: 'completed', conclusion: 'failure', created_at: '2026-08-24T01:00:00Z' },
    { status: 'completed', conclusion: 'success', created_at: '2026-08-23T01:00:00Z' },
    { status: 'in_progress', conclusion: null, created_at: '2026-08-24T02:00:00Z' },
  ] };
  assert(parseRuns(payload)[0].conclusion === 'failure', '最新completed runの抽出');
  assert(hasRunInFlight(payload) === true, '進行中runの検出');
  assert(hasRunInFlight({ workflow_runs: [{ status: 'completed', conclusion: 'success' }] }) === false,
    '完了のみのときに進行中と誤判定しない');

  /* ここが本体。2026-08-14〜24 の10日間の障害と同じ形。 */
  const stale = evaluateSync({ expectedHash: 'aaa', liveHash: 'bbb' });
  assert(stale.ok === false && stale.reason === 'stale', '未公開状態を異常として検知する');

  const matched = evaluateSync({ expectedHash: 'aaa', liveHash: 'aaa' });
  assert(matched.ok === true && matched.reason === 'match', '一致時に通す');

  /* 誤報を出さないための猶予。ただし猶予は「不一致のとき」にしか効かせない。 */
  const inFlight = evaluateSync({ expectedHash: 'aaa', liveHash: 'bbb', publishInFlight: true });
  assert(inFlight.ok === true && inFlight.reason === 'in-flight', '公開処理中は異常にしない');

  const grace = evaluateSync({ expectedHash: 'aaa', liveHash: 'bbb', dataJsWithinGrace: true });
  assert(grace.ok === true && grace.reason === 'grace', '直近の公開は異常にしない');

  const now = Date.parse('2026-08-24T12:00:00Z');
  assert(isWithinGrace('2026-08-24T11:55:00Z', now) === true, '5分前は猶予内');
  assert(isWithinGrace('2026-08-24T11:40:00Z', now) === false, '20分前は猶予外');
  assert(isWithinGrace('2026-08-14T03:00:00Z', now) === false, '10日前は猶予外（今回の障害）');
  assert(isWithinGrace('', now) === false, '時刻が読めないときは猶予を与えない');
  assert(isWithinGrace('2026-08-24T12:30:00Z', now) === false, '未来日時に猶予を与えない');

  console.log('✅ 本番同期監視の自己テスト成功（不一致検知・猶予判定を含む15項目）');
}

if (process.argv.includes('--self-test')) selfTest();
else check().catch((error) => { console.error(`❌ ${error.message}`); process.exitCode = 1; });

export { parseRuns, sha256, summarizeWorkflow, evaluateSync, hasRunInFlight, isWithinGrace };
