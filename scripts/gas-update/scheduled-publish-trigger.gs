/**
 * 予約公開の見回りを、GitHub Actionsのworkflow_dispatchで1時間ごとに開始する。
 *
 * 背景: GitHub Actionsのcronは間引かれることがあり、2026-11-20にも
 * 16時間で2回しか実行されず、16:00 JSTの予約記事が公開されなかった。
 * 貼り付け方: Apps Script「Techno Japan」で「ファイル」→「＋」→「スクリプト」から
 * scheduled-publish-trigger を作り、この内容を貼って保存した後、
 * setupScheduledPublishTrigger をエディタから1回実行する（詳しくはREADME）。
 * 時間主導トリガーは保存済みの最新コードで動くため、ウェブアプリの再デプロイは不要。
 * 初回実行時に、外部URL取得と時間主導トリガー管理の権限承認ダイアログが表示される。
 *
 * Script PropertiesにGITHUB_ACTIONS_TOKENを登録しておくこと。
 * トークンをログ・例外・レスポンスへ含めてはならない。
 */

const SCHEDULED_PUBLISH_WORKFLOW =
  'https://api.github.com/repos/TechnoJapan-LP/techno-japan/actions/workflows/scheduled-publish.yml/dispatches';

function dispatchScheduledPublishCheck() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_ACTIONS_TOKEN');
  if (!token) {
    throw new Error('GITHUB_ACTIONS_TOKEN が未設定です');
  }

  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = UrlFetchApp.fetch(SCHEDULED_PUBLISH_WORKFLOW, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        payload: JSON.stringify({ ref: 'main' }),
        muteHttpExceptions: true
      });
      const code = response.getResponseCode();

      if (code === 204) {
        console.log('scheduled-publish.yml を起動しました: ' + new Date().toISOString());
        return;
      }

      const body = response.getContentText().slice(0, 200);
      console.error('workflow_dispatch failed: HTTP ' + code + ' ' + body);
      if (code >= 500 && code < 600 && attempt === 0) {
        Utilities.sleep(10000);
        continue;
      }
      const httpError = new Error('workflow_dispatch failed: HTTP ' + code);
      httpError.retryable = false;
      throw httpError;
    } catch (error) {
      lastError = error;
      if (error.retryable === false) {
        throw error;
      }
      if (attempt === 1) {
        throw new Error('scheduled publish dispatch failed after retry');
      }
      Utilities.sleep(10000);
    }
  }

  throw lastError || new Error('scheduled publish dispatch failed');
}

function setupScheduledPublishTrigger() {
  removeScheduledPublishTrigger();
  ScriptApp.newTrigger('dispatchScheduledPublishCheck')
    .timeBased()
    .everyHours(1)
    .create();
  const count = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'dispatchScheduledPublishCheck';
  }).length;
  console.log('dispatchScheduledPublishCheck のトリガーを ' + count + ' 本作成しました');
}

function removeScheduledPublishTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'dispatchScheduledPublishCheck') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('dispatchScheduledPublishCheck の既存トリガーを削除しました');
}
