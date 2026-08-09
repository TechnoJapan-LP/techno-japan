/**
 * CMS の AI 機能（翻訳・要約）を Claude Opus 5 に統一し、
 * 打ち切り検知とエラー表示を直したもの。2026-08-07。
 *
 * ■ 使い方
 *
 *   Apps Script の該当ファイルで `aiTranslateV2_` と `aiSummarize` を
 *   この内容に置き換えて、デプロイし直す。ルーター側の変更は不要
 *   （`ai_translate` → `aiTranslateV2_`、`ai_summarize` → `aiSummarize` のまま）。
 *
 *   Script Properties の `ANTHROPIC_API_KEY` はそのまま使う。
 *
 * ■ 何を直したか
 *
 *   1. モデルを claude-opus-5 に統一
 *      翻訳は claude-sonnet-5、要約は claude-haiku-4-5 だった。
 *
 *   2. 返答が上限で打ち切られたことを検知する ★重要
 *      翻訳の入力は CMS 側で 12,000文字まで許しているのに、
 *      返答上限が 8,000トークンだった。長い記事は英訳が途中で切れる。
 *      本文は HTML なので、**タグの途中で切れて表示が崩れる**。
 *      しかも API は 200 を返すので、旧コードは切れた文字列を
 *      「翻訳成功」として CMS に渡していた。
 *
 *      Claude は打ち切り時に stop_reason: 'max_tokens' を返す。
 *      推測せずこれを見て、成功と偽らずエラーとして返す。
 *      「黙って壊れたものを渡す」より「できなかったと言う」を選ぶ。
 *      AUDIT §9-54。
 *
 *   3. 要約のエラー文言が存在しないキー名を案内していた
 *      実際に読むのは ANTHROPIC_API_KEY なのに
 *      'CLAUDE_API_KEY not set' と出ていた。未設定時に
 *      存在しない名前を探させることになる。
 *
 *   4. 要約が HTTP ステータスを見ていなかった
 *      json.error だけを見ていたため、error フィールドを持たない
 *      失敗応答（502 等）で content が undefined になり、
 *      空文字を status:'ok' として返していた。
 *
 * ■ モデル変更にあたっての申し送り
 *
 *   Opus は Haiku より応答が遅い。タイトル候補のような
 *   「押してすぐ欲しい」操作では体感が変わる。
 *   速度を優先したくなったら、要約側だけ
 *   claude-haiku-4-5-20251001 に戻してよい（品質差は要約用途では小さい）。
 *
 *   MAX_TOKENS_TRANSLATE を上げすぎるとモデルの上限を超えて
 *   API が 400 を返す。その場合は下げること（打ち切り検知が
 *   入っているので、切れて壊れるより先にエラーで気づける）。
 */

var CLAUDE_MODEL = 'claude-opus-5';
var CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
var MAX_TOKENS_TRANSLATE = 16000;  // 12,000文字の記事をHTMLごと英訳できる余裕
var MAX_TOKENS_SUMMARY = 1000;     // リード文・メタ説明・タイトル3案には十分

/**
 * Claude を呼ぶ共通処理。打ち切りと HTTP エラーをここで一括して見る。
 * 個別の関数で見落とすと「静かに壊れたものが通る」ため1箇所に寄せる。
 */
function callClaude_(systemPrompt, userText, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) return { status: 'error', message: 'ANTHROPIC_API_KEY not set' };

  /* 前後の空白・改行を落とす。

     キーはコピー＆ペーストで入れるので、末尾に改行や空白が紛れ込みやすい。
     見た目では気づけないのに、API は 401 で拒否する。
     「キーは合っているのに通らない」で時間を溶かす典型なので、
     ここで吸収する。AUDIT §9-71。 */
  key = String(key).replace(/\s+/g, '');
  if (!key) return { status: 'error', message: 'ANTHROPIC_API_KEY not set' };

  /* 形が明らかに違うなら、API を叩く前に言う。
     401 は「キーが無効」としか分からないが、これなら**何が違うか**が分かる。 */
  if (key.indexOf('sk-ant-') !== 0) {
    return {
      status: 'error',
      message: 'ANTHROPIC_API_KEY の形式が違います（sk-ant- で始まる必要があります）。'
             + '別のサービスのキー（Google/Gemini など）が入っていないか確認してください'
    };
  }

  var res = UrlFetchApp.fetch(CLAUDE_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }]
    })
  });

  var code = res.getResponseCode();
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) {}

  if (code !== 200) {
    var detail = (body.error && body.error.message) || 'unknown';
    /* 401 は「キーが拒否された」以上のことを API が教えてくれない。
       確認する場所を、その場で示す。2026-08-10 に実際に出た（§9-71）。 */
    /* 残高不足は 400 で返る。401（キーが無効）とは原因も対処も違うのに、
       文言を読まないと区別できない。**「お金」か「キー」かをここで言い切る。**
       2026-08-10、利用額 $0.40 の表示を見て「残高はあるのに 401」と
       混乱が生じた。金額の表示と 401 は無関係（§9-71）。 */
    if (code === 400 && /credit balance/i.test(detail)) {
      detail += '\n\nこれは**クレジット残高**の問題です（キーは有効）。\n'
             + 'console.anthropic.com の Billing でクレジットを追加してください。\n'
             + '※ Cost（使った額）ではなく Credits（残り）を見ること。';
    }
    if (code === 401) {
      detail += '\n\n確認すること:\n'
             + '  1. console.anthropic.com の API keys に、そのキーがまだ存在するか\n'
             + '     ※ 401 は**キーの問題**です。残高とは無関係（残高不足は 400 で返ります）\n'
             + '     迷ったら Create Key で新しく作り直すのが早いです\n'
             + '  2. GAS のスクリプト プロパティに入れ直す（前後の空白は自動で除去します）\n'
             + '  3. 入れ直したら **GAS を再デプロイ** する（保存だけでは反映されません）\n'
             + '     ※「新しいデプロイ」ではなく、既存のデプロイを編集して新バージョンにすること';
    }
    return { status: 'error', message: 'Claude API ' + code + ': ' + detail };
  }

  /* 応答から本文を取り出す。

     **content[0] が本文とは限らない。**応答は複数のブロックの配列で、
     モデルによっては thinking ブロックが先頭に来る。
     `content[0].text` だけを見ると、本文があるのに空と判定してしまう。

     2026-08-10、キーを直したあと `Claude API: 応答が空でした` が出た。
     HTTP は 200 で、本文も返っていたのに、先頭ブロックが text ではなかった。
     **type が 'text' のブロックを全部つなぐ。**AUDIT §9-73。 */
  var blocks = (body.content && body.content.length) ? body.content : [];
  var text = '';
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i] && blocks[i].type === 'text' && blocks[i].text) text += blocks[i].text;
  }
  // type が無い応答（古い形式）にも備える。
  if (!text && blocks.length === 1 && blocks[0] && blocks[0].text) text = blocks[0].text;

  /* 上限で打ち切られた場合。HTML なら閉じタグを失っているので使わせない。
     **空判定より先に見る。**thinking が上限を食い切ると本文が空になり、
     「応答が空」と報告してしまって、本当の原因（上限）に辿り着けない。 */
  if (body.stop_reason === 'max_tokens') {
    return {
      status: 'error',
      message: '長すぎて途中で切れました（上限 ' + maxTokens + 'トークン）。'
             + '本文を分割して実行するか、GAS の MAX_TOKENS を上げてください'
    };
  }

  if (!text) {
    /* 空のときは**何が返ってきたか**を添える。これが無いと、
       ブロック構成が変わったときに毎回ここで詰まる。 */
    var kinds = [];
    for (var j = 0; j < blocks.length; j++) kinds.push((blocks[j] && blocks[j].type) || '?');
    return {
      status: 'error',
      message: 'Claude API: 本文が取り出せませんでした'
             + '（ブロック ' + (kinds.length ? kinds.join('/') : 'なし')
             + ' / stop_reason ' + (body.stop_reason || '不明') + '）'
    };
  }

  return { status: 'ok', text: text };
}

/* ==== CMS: AI翻訳 v2 — HTML保持対応 ==== */
function aiTranslateV2_(data) {
  var text = String(data.text || '').trim();
  if (!text) return { status: 'error', message: 'text required' };

  var target = data.target === 'ja' ? 'ja' : 'en';
  var isHtml = !!data.html;

  var sys = target === 'en'
    ? 'You are a professional translator for an underground techno/house music magazine based in Japan. Translate the given Japanese text into natural, editorial English. Keep proper nouns (artist, festival, venue names) unchanged.'
    : 'あなたは日本のアンダーグラウンド・テクノ／ハウス誌のプロ翻訳者です。与えられた英語のテキストを自然で読みやすい日本語に翻訳してください。固有名詞（アーティスト名・フェス名・会場名）はそのまま残してください。';
  sys += isHtml
    ? ' The input is HTML. Preserve every tag and attribute exactly as-is; translate only the human-readable text content. Output only the translated HTML with no explanations or code fences.'
    : ' Output only the translation, nothing else.';

  return callClaude_(sys, text, MAX_TOKENS_TRANSLATE);
}

/**
 * 記事本文を要約。mode: 'excerpt'(JP) | 'excerpt-en'(EN) | 'meta' | 'titles'
 */
function aiSummarize(data) {
  try {
    var text  = (data.text || '').trim();
    var title = (data.title || '').trim();
    var mode  = data.mode || 'excerpt';
    if (!text) return { status: 'error', message: 'text is empty' };

    var systemPrompt, userPrompt;

    if (mode === 'meta') {
      systemPrompt = 'あなたは日本のテクノ・ハウス音楽メディア「TECHNO JAPAN」の編集者です。SEOに強いメタディスクリプションを書きます。';
      userPrompt =
        '以下の記事のメタディスクリプションを書いてください。\n' +
        '- 検索結果に表示される説明文として最適化\n' +
        '- 必ず155文字以内（半角英数も1文字としてカウント）\n' +
        '- 記事の主題が一目で分かる\n' +
        '- クリックしたくなる表現\n' +
        '- 引用符・見出し・記号は使わない（プレーンテキストのみ）\n\n' +
        (title ? 'タイトル: ' + title + '\n\n' : '') +
        '本文:\n' + text + '\n\n' +
        'メタディスクリプションのみを出力してください（前置き・解説不要）。';

    } else if (mode === 'titles') {
      systemPrompt = 'あなたは日本のテクノ・ハウス音楽メディア「TECHNO JAPAN」の編集者です。クリックされやすい記事タイトルを書きます。';
      userPrompt =
        '以下の記事に最適なタイトルを **3つ** 提案してください。\n' +
        '- それぞれ20〜35文字\n' +
        '- 1案目は王道、2案目は SEO意識、3案目はキャッチーで挑戦的\n' +
        '- 引用符・絵文字・装飾は使わない\n' +
        '- 各候補を改行のみで区切る（番号や記号は付けない）\n\n' +
        '本文:\n' + text + '\n\n' +
        '3つのタイトルだけを改行区切りで出力してください（前置き不要）。';

    } else if (mode === 'excerpt-en') {
      systemPrompt = 'You are an editor for "TECHNO JAPAN", a Japanese underground techno/house media outlet. Write concise English summaries.';
      userPrompt =
        'Write a short English excerpt (1-2 sentences, max ~150 characters) for the following article. ' +
        'Keep it punchy, descriptive, and engaging. No quotes, no markdown, plain text only.\n\n' +
        (title ? 'Title: ' + title + '\n\n' : '') +
        'Article:\n' + text + '\n\n' +
        'Output only the excerpt, no preamble.';

    } else {
      // excerpt (JP)
      systemPrompt = 'あなたは日本のテクノ・ハウス音楽メディア「TECHNO JAPAN」の編集者です。記事の魅力的なリードを書きます。';
      userPrompt =
        '以下の記事から1〜2文のリード文（excerpt）を書いてください。\n' +
        '- 80〜140文字\n' +
        '- 記事を読みたくなる訴求\n' +
        '- 引用符・見出し・記号は使わない\n\n' +
        (title ? 'タイトル: ' + title + '\n\n' : '') +
        '本文:\n' + text + '\n\n' +
        'リード文のみを出力してください（前置き不要）。';
    }

    var result = callClaude_(systemPrompt, userPrompt, MAX_TOKENS_SUMMARY);
    if (result.status !== 'ok') return result;

    // 余分な引用符を除去（モデルが「」や "" で囲むことがある）
    var out = result.text.trim().replace(/^["「]/, '').replace(/["」]$/, '');
    return { status: 'ok', text: out };

  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}
