/**
 * CMSからGitHub Actionsの画像同期を開始するGASハンドラ。
 *
 * ルーターの認証チェック後に次を追加する:
 *   if (data.action === 'trigger_image_sync') {
 *     return buildResponse(triggerImageSync());
 *   }
 *
 * Script Propertiesに GITHUB_ACTIONS_TOKEN を登録してからデプロイする。
 * トークンをCMSやレスポンスへ含めてはならない。
 */
function triggerImageSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return { status: 'ok', message: '画像同期はすでに開始されています', alreadyRunning: true };
  }

  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('image_sync_dispatched')) {
      return { status: 'ok', message: '画像同期はすでに開始されています', alreadyRunning: true };
    }

    const token = PropertiesService.getScriptProperties().getProperty('GITHUB_ACTIONS_TOKEN');
    if (!token) {
      return { status: 'error', message: 'GITHUB_ACTIONS_TOKEN が未設定です' };
    }

    const endpoint = 'https://api.github.com/repos/TechnoJapan-LP/techno-japan/actions/workflows/sync-drive-images.yml/dispatches';
    const response = UrlFetchApp.fetch(endpoint, {
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

    if (response.getResponseCode() !== 204) {
      console.error('workflow_dispatch failed: HTTP ' + response.getResponseCode());
      return { status: 'error', message: 'GitHub Actionsの起動に失敗しました（HTTP ' + response.getResponseCode() + '）' };
    }

    // CMSの連打や複数タブからの重複起動をGAS側でも抑止する。
    cache.put('image_sync_dispatched', '1', 180);
    return { status: 'ok', message: '同期を開始しました。通常1〜3分で反映されます。' };
  } catch (error) {
    console.error('triggerImageSync failed: ' + error);
    return { status: 'error', message: '画像同期の開始中にエラーが発生しました' };
  } finally {
    lock.releaseLock();
  }
}
