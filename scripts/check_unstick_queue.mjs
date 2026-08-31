#!/usr/bin/env node
/**
 * 「詰まった CI を外す」判断が正しいかを試験する。
 *
 * ■ なぜ必要か
 *
 *   この仕組みは**普段は何もしない**。動くのは事故のときだけなので、
 *   壊れていても気づけない。しかも間違うと、動いている CI を殺す。
 *   判断部分（decide）を純粋な関数に分けてあるのは、ここで試験するため。
 *
 *   特に守りたいのは「殺してはいけないものを殺さない」側:
 *     ・in_progress（動作中）
 *     ・waiting（環境の承認待ち＝人を待っている正常な状態）
 *     ・まだ新しい順番待ち
 *
 * 使い方:
 *   node scripts/check_unstick_queue.mjs
 */

import { decide, classifyCancelFailure, DEFAULT_STUCK_MINUTES } from './unstick_ci_queue.mjs';

const NOW = Date.parse('2026-08-09T05:00:00Z');
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();

const DEPLOY = '.github/workflows/deploy-pages.yml';
const PUBLISH = '.github/workflows/publish-pipeline.yml';
const BACKUP = '.github/workflows/backup-data.yml';

let failed = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  ✅ ${name}`);
  else { console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); failed++; }
}

/* --- 1. 実際に起きた事故（2026-08-09）をそのまま再現する ------------------ */
{
  // Publish pipeline が 03:55 から queued のまま65分。
  // その後ろで Deploy が 04:24 から pending（36分）。
  const runs = [
    { id: 31293432293, name: 'Publish pipeline', path: PUBLISH, status: 'queued',
      created_at: minsAgo(65), head_sha: 'aaa', event: 'push' },
    { id: 31294497249, name: 'Deploy LP to GitHub Pages', path: DEPLOY, status: 'pending',
      created_at: minsAgo(36), head_sha: 'bbb', event: 'push' },
  ];
  const d = decide({ runs, nowMs: NOW, headSha: 'bbb' });
  console.log('実際に起きた事故（2026-08-09）');
  check('詰まった2本を両方とも外す', d.stuck.length === 2, `${d.stuck.length}件`);
  check('経過時間を正しく出す', d.stuck[0].ageMinutes === 65, `${d.stuck[0].ageMinutes}分`);
  check('pages グループが空になるので再実行する', d.redispatch === true);
  check('警報は出さない（1回目なので）', d.alarm === '');
}

/* --- 2. 殺してはいけないもの -------------------------------------------- */
{
  console.log('\n殺してはいけないもの');

  const running = [{ id: 1, name: 'Deploy', path: DEPLOY, status: 'in_progress',
    created_at: minsAgo(120), head_sha: 'a', event: 'push' }];
  check('動作中(in_progress)は何時間たっても触らない',
    decide({ runs: running, nowMs: NOW, headSha: 'a' }).stuck.length === 0);

  const waiting = [{ id: 2, name: 'Deploy', path: DEPLOY, status: 'waiting',
    created_at: minsAgo(600), head_sha: 'a', event: 'push' }];
  check('承認待ち(waiting)は触らない（人の操作を待っている）',
    decide({ runs: waiting, nowMs: NOW, headSha: 'a' }).stuck.length === 0);

  const fresh = [{ id: 3, name: 'Deploy', path: DEPLOY, status: 'queued',
    created_at: minsAgo(DEFAULT_STUCK_MINUTES - 1), head_sha: 'a', event: 'push' }];
  check('しきい値未満の順番待ちは触らない',
    decide({ runs: fresh, nowMs: NOW, headSha: 'a' }).stuck.length === 0);

  const justOver = [{ id: 4, name: 'Deploy', path: DEPLOY, status: 'queued',
    created_at: minsAgo(DEFAULT_STUCK_MINUTES), head_sha: 'a', event: 'push' }];
  check('しきい値ちょうどは外す（境界）',
    decide({ runs: justOver, nowMs: NOW, headSha: 'a' }).stuck.length === 1);
}

/* --- 3. 再実行するか / しないか ------------------------------------------ */
{
  console.log('\n再実行の判断');

  // 詰まった Publish を外しても、後ろに動作中のデプロイが居るなら蹴らない。
  const hasSurvivor = [
    { id: 5, name: 'Publish pipeline', path: PUBLISH, status: 'queued',
      created_at: minsAgo(40), head_sha: 'a', event: 'push' },
    { id: 6, name: 'Deploy', path: DEPLOY, status: 'in_progress',
      created_at: minsAgo(2), head_sha: 'a', event: 'push' },
  ];
  const d1 = decide({ runs: hasSurvivor, nowMs: NOW, headSha: 'a' });
  check('後続が残っているなら再実行しない', d1.redispatch === false && d1.stuck.length === 1);

  // pages と関係ないワークフローだけが詰まっていた場合。
  const other = [{ id: 7, name: 'Backup', path: BACKUP, status: 'queued',
    created_at: minsAgo(40), head_sha: 'a', event: 'push' }];
  const d2 = decide({ runs: other, nowMs: NOW, headSha: 'a' });
  check('pages 以外の詰まりも外すが、デプロイは蹴らない',
    d2.stuck.length === 1 && d2.redispatch === false);

  // 蹴ったデプロイがまた詰まった＝無限ループになる状況。
  const looping = [
    { id: 8, name: 'Deploy', path: DEPLOY, status: 'queued',
      created_at: minsAgo(40), head_sha: 'sha1', event: 'workflow_dispatch' },
  ];
  const d3 = decide({ runs: looping, nowMs: NOW, headSha: 'sha1' });
  check('2回目は蹴らずに警報を出す（無限ループ防止）',
    d3.redispatch === false && d3.alarm !== '');
}

/* --- 4. 平常時 ----------------------------------------------------------- */
{
  console.log('\n平常時');
  const normal = [
    { id: 9, name: 'Deploy', path: DEPLOY, status: 'completed',
      created_at: minsAgo(300), head_sha: 'a', event: 'push' },
    { id: 10, name: 'Publish pipeline', path: PUBLISH, status: 'queued',
      created_at: minsAgo(1), head_sha: 'a', event: 'push' },
  ];
  const d = decide({ runs: normal, nowMs: NOW, headSha: 'a' });
  check('何もしない', d.stuck.length === 0 && d.redispatch === false && d.alarm === '');
}

/* --- 5. キャンセル失敗の扱い（§9-98） ------------------------------------ */
{
  console.log('\nキャンセル失敗の扱い');

  // 実際に起きた事故（2026-08-31）: 2026-08-19 の run が GitHub 内部で壊れ、
  // cancel / force-cancel の両方が 409 で断られ続けた。
  const zombie409 =
    'Command failed: gh api -X POST repos/x/y/actions/runs/32219284839/cancel\n' +
    'gh: Cannot cancel a workflow run that has not been queued yet. (HTTP 409)\n' +
    'Command failed: gh api -X POST repos/x/y/actions/runs/32219284839/force-cancel\n' +
    'gh: Cannot cancel a workflow run that has not been queued yet. (HTTP 409)';
  check('消せないゾンビ（409 not been queued yet）は保留',
    classifyCancelFailure(zombie409) === 'phantom');

  check('GitHub 側の一時障害（5xx）は保留',
    classifyCancelFailure('Command failed: gh api ...\ngh: HTTP 502') === 'transient');

  check('権限不足（403）は失敗として報告',
    classifyCancelFailure('Command failed: gh api ...\ngh: HTTP 403') === 'hard');

  // 完了済み run への 409 は「まだ queued でない」ではなく状態違いの別文言。
  // 文言判定なので、通常の 409 まで保留に落とさないことを確かめる。
  check('通常の 409（already completed 等）は失敗として報告',
    classifyCancelFailure('gh: Cannot cancel a workflow run that is completed. (HTTP 409)') === 'hard');
}

console.log();
if (failed) { console.log(`❌ ${failed}件の判断が誤っています`); process.exit(1); }
console.log('✅ 詰まり外しの判断はすべて正しい');
