/**
 * NEWS速報の下書きを作る。ai-claude-opus5.gs の callClaude_ を利用する。
 * doPost の既存 dispatch に次の1行を追加する:
 *   if (data.action === 'ai_news_draft') return buildResponse(aiNewsDraft(data));
 */
function aiNewsDraft(data) {
  try {
    data = data || {};
    var festival = data.festival || {};
    var kind = String(data.kind || 'other');
    var allowedKinds = { lineup: true, dates: true, tickets: true, other: true };
    if (!festival.id || !festival.name) return { status: 'error', message: 'festival.id と festival.name は必須です' };
    if (!allowedKinds[kind]) return { status: 'error', message: 'kind が不正です' };
    var sources = Array.isArray(data.sources) ? data.sources : [];
    sources = sources.map(function (source) {
      return { url: String(source && source.url || '').trim(), text: String(source && source.text || '').trim() };
    }).filter(function (source) { return source.url || source.text; });
    if (!sources.length || !sources.some(function (source) { return source.text; })) {
      return { status: 'error', message: '出典本文が必要です' };
    }

    var system = [
      'あなたはTECHNO JAPANの速報記事を編集する日本語編集者です。',
      'Techno Japanの文体は、クールだが冷たすぎず、簡潔だが素っ気なくない。大げさな煽り、クリックベイト、観光ガイド調、根拠のない一般論を避ける。',
      '最重要ルール: 出典本文に明記された事実だけを書く。日付、会場、都市、料金、URL、出演者名を推測・補完しない。確認できない項目は書かない。',
      '出典の文章を一文まるごとコピーしてはいけない。意味を保ち、自然な日本語または英語に書き直す。',
      'アーティスト名は、出典本文にある表記を一字一句そのまま artists に入れる。大文字小文字、記号、空白を勝手に直さない。英語本文（body_en・excerpt_en・title_en）でも、出演者名は出典の表記のまま書く（日本語名をローマ字化・翻訳しない）。',
      '日本語では全角ダッシュ（——）を使わない。英語では長音符（ー）と全角ダッシュを使わない。',
      'タイトルはサイトの「Main | sub」形式。Mainにイベント名または発表の主題、subに発表内容を置く。既存NEWSのタイトル形式に合わせ、過剰な宣伝文句を避ける。',
      '本文はARTICLE_BODY_SPEC_FOR_AI.mdに従うHTML。NEWSの5部構成は、1.何が発表されたかのリード、2.出典にある要点のリスト（日時・会場・出演者・チケット）、3.発表順の出演者一覧、4.出典に基づく補足、5.出典リンク。存在しない項目は省略する。',
      '使用可能なHTMLはp、h2、h3、h4、strong、em、a、ul、ol、li、brとサイトのショートコード。table、div、span、style、script、img、Markdownは使わない。外部リンクはtarget="_blank" rel="noopener"を付ける。',
      'factsのquoteは、検証用に出典本文から短く抜き出した文字列にする。artistsとfactsは本文で実際に使ったものだけにする。warningsには情報不足や出典間の不一致を書く。',
      '前置き、説明、Markdownコードフェンスを付けず、次のJSONだけを返す。',
      '{"title":"","title_en":"","excerpt":"","excerpt_en":"","body":"","body_en":"","facts":[{"field":"","value":"","quote":""}],"artists":[""],"warnings":[""]}'
    ].join('\n');
    var user = '対象フェス:\n' + JSON.stringify({
      id: festival.id, name: festival.name, name_ja: festival.name_ja || '',
      date: festival.date || '', location: festival.location || '',
      location_ja: festival.location_ja || '', city: festival.city || ''
    }) + '\n発表種別: ' + kind + '\n\n出典:\n' + sources.map(function (source, index) {
      return '［' + (index + 1) + '］URL: ' + source.url + '\n本文:\n' + source.text;
    }).join('\n\n');
    var result = callClaude_(system, user, 4000);
    if (!result || result.status !== 'ok') return result || { status: 'error', message: 'Claude APIの応答がありません' };
    var raw = String(result.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    var draft;
    try { draft = JSON.parse(raw); } catch (parseError) {
      return { status: 'error', message: 'AIのJSONを解析できませんでした: ' + parseError.message };
    }
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return { status: 'error', message: 'AIのJSON形式が不正です' };
    }
    return { status: 'ok', draft: {
      title: String(draft.title || ''), title_en: String(draft.title_en || ''),
      excerpt: String(draft.excerpt || ''), excerpt_en: String(draft.excerpt_en || ''),
      body: String(draft.body || ''), body_en: String(draft.body_en || ''),
      facts: Array.isArray(draft.facts) ? draft.facts.map(function (fact) {
        return { field: String(fact && fact.field || ''), value: String(fact && fact.value || ''), quote: String(fact && fact.quote || '') };
      }) : [],
      artists: Array.isArray(draft.artists) ? draft.artists.map(String).filter(Boolean) : [],
      warnings: Array.isArray(draft.warnings) ? draft.warnings.map(String).filter(Boolean) : []
    }};
  } catch (error) {
    return { status: 'error', message: '速報下書きの生成に失敗しました: ' + (error && error.message || error) };
  }
}
