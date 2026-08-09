#!/usr/bin/env node
/**
 * 順番待ちのまま固まった CI を検出して外す。
 *
 * ■ なぜ必要か（AUDIT §9-65）
 *
 *   2026-08-09、Publish pipeline が `queued` のまま**60分**動かなかった。
 *   実行機が割り当てられず、GitHub 側の障害でもなかった（全サービス正常）。
 *
 *   問題は「止まったこと」より、**止まったまま誰も気づけないこと**だった。
 *
 *   ・`timeout-minutes: 20` は**動き出してからの時計**で、
 *     順番待ちのまま固まると永久に効かない。
 *   ・deploy-pages と publish-pipeline は `concurrency: pages` で直列化して
 *     いるため（§9-50）、1本詰まると**後続が全部止まる。**
 *     実際この日は、後ろのデプロイが30分 pending のまま待たされていた。
 *   ・失敗ではないので通知も出ない。ユーザーが「Publish が完了しない」と
 *     気づくまで、サイトは更新されないまま放置される。
 *
 *   詰まりを防ぐことはできない（GitHub 側の都合）。**外す側を自動にする。**
 *
 * ■ 何をするか
 *
 *   1. 順番待ちのまま STUCK_MINUTES 以上経った run を探す
 *   2. それをキャンセルする（後続が動き出す）
 *   3. pages グループを空にしてしまった場合だけ、デプロイを1回だけ再実行する
 *
 * ■ 触らないもの
 *
 *   ・`in_progress`   … 動いている。timeout-minutes が効く範囲なので任せる
 *   ・`waiting`       … **環境の承認待ち。**人の操作を待っている正常な状態で、
 *                       ここを殺すと承認フローが壊れる。必ず除外する
 *                       （現在は承認ルール未設定だが、後で足したとき事故る）
 *
 * 使い方:
 *   node scripts/unstick_ci_queue.mjs --dry-run    # 何をするか見るだけ
 *   node scripts/unstick_ci_queue.mjs              # 実際にキャンセルする
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** 順番待ちを表す状態。`waiting`（承認待ち）は**入れない**。 */
export const QUEUED_STATES = new Set(['queued', 'pending', 'requested']);

/** concurrency: pages で直列化しているワークフロー。1本詰まると全部止まる。 */
export const PAGES_WORKFLOWS = new Set([
  '.github/workflows/deploy-pages.yml',
  '.github/workflows/publish-pipeline.yml',
]);

export const DEPLOY_WORKFLOW = '.github/workflows/deploy-pages.yml';

/** 何分で「詰まった」とみなすか。通常の順番待ちは数秒〜数分。 */
export const DEFAULT_STUCK_MINUTES = 25;

/**
 * 判断だけを行う純粋な関数。API を叩かないので、そのまま試験できる。
 *
 * @param {object} o
 * @param {Array}  o.runs          gh api の workflow_runs 相当
 * @param {number} o.nowMs         現在時刻
 * @param {number} o.stuckMinutes  この分数を超えた順番待ちを詰まりとみなす
 * @param {string} o.headSha       既定ブランチの先頭 SHA（再実行の重複防止に使う）
 */
export function decide({ runs, nowMs, stuckMinutes = DEFAULT_STUCK_MINUTES, headSha = '' }) {
  const ageMin = (r) => (nowMs - Date.parse(r.created_at)) / 60000;

  const stuck = runs
    .filter((r) => QUEUED_STATES.has(r.status) && ageMin(r) >= stuckMinutes)
    .map((r) => ({ ...r, ageMinutes: Math.round(ageMin(r)) }));

  const cancelledIds = new Set(stuck.map((r) => r.id));

  // pages グループを詰まらせていたか。
  const cancelledPages = stuck.some((r) => PAGES_WORKFLOWS.has(r.path));

  // キャンセル後に pages グループへ残るもの（動作中 or まだ新しい順番待ち）。
  const pagesSurvivors = runs.filter(
    (r) =>
      PAGES_WORKFLOWS.has(r.path) &&
      !cancelledIds.has(r.id) &&
      (r.status === 'in_progress' || QUEUED_STATES.has(r.status))
  );

  // 既に「詰まり外し」でデプロイを蹴っていないか。
  // 蹴ったものがまた詰まると、放っておけば無限に蹴り続ける。
  const alreadyRedispatched = runs.some(
    (r) =>
      r.path === DEPLOY_WORKFLOW &&
      r.event === 'workflow_dispatch' &&
      headSha &&
      r.head_sha === headSha
  );

  let redispatch = false;
  let alarm = '';
  if (cancelledPages && pagesSurvivors.length === 0) {
    if (alreadyRedispatched) {
      // 2回目。詰まりが常態化している＝人が見るべき状態。
      alarm =
        '詰まり外しの後に蹴ったデプロイが、また詰まりました。' +
        '繰り返し蹴っても同じなので、ここで止めます。GitHub Actions の状態を確認してください。';
    } else {
      redispatch = true;
    }
  }

  return { stuck, redispatch, alarm, pagesSurvivors };
}

/* ---------------------------------------------------------------- 実行部 */

function gh(args) {
  // stderr を親へ素通しさせない。権限確認は 409 を**期待して**呼ぶので、
  // gh のエラー行がそのまま出るとログ上は失敗に見える。
  return execFileSync('gh', args, {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * キャンセルの権限が本当にあるかを、**何も壊さずに**確かめる。
 *
 * 詰まりは滅多に起きないので、いざ起きたときに「権限が無くて外せません」だと
 * 意味がない。かといって、動いている run で試すわけにもいかない。
 *
 * **完了済みの run に対するキャンセルは 409（状態が違う）で断られる。**
 * 権限が無ければ 403 になる。この違いで、run を1つも壊さずに判別できる。
 */
function probeCancelPermission(repo, runs) {
  const done = runs.find((r) => r.status === 'completed');
  if (!done) return '完了済みの run が無いため確認できませんでした';
  try {
    gh(['api', '-X', 'POST', `repos/${repo}/actions/runs/${done.id}/cancel`]);
    return '⚠️ 完了済みの run のキャンセルが通ってしまいました（想定外）';
  } catch (e) {
    const msg = String(e.stderr || e.message);
    if (/HTTP 409/.test(msg)) return '✅ キャンセルの権限あり（完了済みには 409 で断られる = 正常）';
    if (/HTTP 403/.test(msg)) return '✗ キャンセルの権限がありません（permissions: actions: write を確認）';
    return `？判定できません: ${msg.split('\n')[0]}`;
  }
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mi = process.argv.indexOf('--stuck-minutes');
  const stuckMinutes = mi >= 0 ? Number(process.argv[mi + 1]) : DEFAULT_STUCK_MINUTES;
  const repo = process.env.GITHUB_REPOSITORY || gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();

  // 直近100本だけを見ると、**詰まった run がそれより古いと見落とす。**
  // 詰まりは長く残るものなので、状態で名指しして取り直す。
  // 同じ run が複数の問い合わせに出るので id で重複を除く。
  const byId = new Map();
  const collect = (query) => {
    for (const r of JSON.parse(gh(['api', `repos/${repo}/actions/runs?${query}`])).workflow_runs) {
      byId.set(r.id, {
        id: r.id, name: r.name, path: r.path, status: r.status,
        created_at: r.created_at, head_sha: r.head_sha, event: r.event,
      });
    }
  };
  collect('per_page=100');
  for (const s of ['queued', 'in_progress', 'pending', 'requested', 'waiting']) {
    collect(`status=${s}&per_page=100`);
  }
  const runs = [...byId.values()];
  const headSha = gh(['api', `repos/${repo}/commits/HEAD`, '--jq', '.sha']).trim();

  const { stuck, redispatch, alarm, pagesSurvivors } = decide({
    runs, nowMs: Date.now(), stuckMinutes, headSha,
  });

  if (!stuck.length) {
    console.log(`✅ ${stuckMinutes}分以上、順番待ちのまま固まっている run はありません`);
    // 平常時こそ、いざというとき外せるかを確かめておく。
    console.log(`   ${probeCancelPermission(repo, runs)}`);
    return;
  }

  console.log(`順番待ちのまま ${stuckMinutes}分以上たった run: ${stuck.length}件`);
  for (const r of stuck) console.log(`  ✗ ${r.id}  ${r.name}（${r.ageMinutes}分）`);

  if (dryRun) {
    console.log('\n--dry-run のため何もしていません。');
    if (redispatch) console.log('  → 実行時はこの後デプロイを1回だけ再実行します。');
    if (alarm) console.log(`  → 実行時は失敗として報告します: ${alarm}`);
    return;
  }

  for (const r of stuck) {
    try {
      gh(['api', '-X', 'POST', `repos/${repo}/actions/runs/${r.id}/cancel`]);
      console.log(`  外しました: ${r.id}`);
    } catch (e) {
      // 通常のキャンセルに応じない run 用の強制停止。
      try {
        gh(['api', '-X', 'POST', `repos/${repo}/actions/runs/${r.id}/force-cancel`]);
        console.log(`  強制的に外しました: ${r.id}`);
      } catch (e2) {
        console.log(`  外せませんでした: ${r.id} — ${e2.message.split('\n')[0]}`);
      }
    }
  }

  if (redispatch) {
    gh(['workflow', 'run', 'deploy-pages.yml', '--ref', 'main']);
    console.log('\nデプロイを1回だけ再実行しました（pages グループが空になったため）。');
  } else if (pagesSurvivors.length) {
    console.log(`\n後続の ${pagesSurvivors.length}件が動き出すので、再実行はしません。`);
  }

  // 結果を必ず残す。詰まりは「起きたことに気づけない」のが本体の問題。
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    fs.appendFileSync(summary,
      `### 詰まった CI を外しました\n\n` +
      stuck.map((r) => `- \`${r.name}\` を ${r.ageMinutes}分の順番待ちで停止\n`).join('') +
      (redispatch ? '\nデプロイを1回だけ再実行しました。\n' : '') +
      (alarm ? `\n**${alarm}**\n` : ''));
  }

  if (alarm) {
    console.error(`\n✗ ${alarm}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
