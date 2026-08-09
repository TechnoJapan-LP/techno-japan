/* GAS に実際に入っているコードの指紋を取る。
   ==================================================================

   ■ 何のため

     GAS のコードは手で貼って運用しているので、**リポジトリを直しても
     貼り忘れれば本番は変わらない。**しかもエラーは出ない。

     2026-08-07 に「AI を Claude Opus 5 に統一した」と記録したが、
     翻訳では効いていなかった。新しい関数を貼り足したものの、古い版が
     下に残っていて後勝ちしていた。気づいたのは3日後（AUDIT §9-72）。

     この指紋を live-snapshot.json に置いておけば、
     `check_gas_sync.mjs` が食い違いを検出できる。

   ■ 使い方

     1. GAS に貼って**再デプロイした後**に実行する
        （保存だけでは本番は変わらないので、デプロイ後にやること）
     2. Apps Script のエディタで、このファイルの中身をブラウザの
        開発者ツール（Console）に貼って実行する
        ※ Apps Script 上で「実行」するのではない。Monaco の中身を
          読むので、**ブラウザの Console** で動かす
     3. 出力された JSON を scripts/gas-update/live-snapshot.json に保存する
     4. `node scripts/check_gas_sync.mjs` が通ることを確認する

   ■ なぜ指紋なのか

     コードそのものをリポジトリへ持ってくると、GAS 側にキーが混ざったとき
     一緒に取り込んでしまう。**指紋なら中身を持ち出さずに一致だけ確かめられる。**
     コメントと空白は無視するので、説明文を直しただけでは鳴らない。
   ================================================================== */

(() => {
  const m = monaco.editor.getModels().find(x => x.getLineCount() > 1000);
  if (!m) return 'コード.gs が見つかりません（Apps Script のエディタで実行してください）';
  const src = m.getValue();

  const normalize = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  // check_gas_sync.mjs と同じ計算（FNV-1a 32bit を2本）
  const fnv = (str, seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  };
  const fp = (s) => fnv(s, 2166136261).toString(16).padStart(8, '0')
                  + fnv(s, 1099511628211 >>> 0).toString(16).padStart(8, '0');

  const grab = (name) => {
    const i = src.search(new RegExp('^function\\s+' + name + '\\s*\\(', 'm'));
    if (i < 0) return null;
    const L = src.slice(i).split('\n');
    let end = L.length;
    for (let k = 1; k < L.length; k++) if (/^\}\s*$/.test(L[k])) { end = k + 1; break; }
    return L.slice(0, end).join('\n');
  };

  const 関数 = {};
  ['callClaude_', 'aiTranslateV2_', 'aiSummarize'].forEach((fn) => {
    const b = grab(fn);
    関数[fn] = b
      ? { 行数: b.split('\n').length, 指紋: fp(normalize(b)), 正規化長: normalize(b).length }
      : '見つからない';
  });

  const 定数 = {};
  ['CLAUDE_MODEL', 'MAX_TOKENS_TRANSLATE', 'MAX_TOKENS_SUMMARY'].forEach((c) => {
    const h = src.match(new RegExp('var\\s+' + c + '\\s*=\\s*([^;]+);'));
    定数[c] = h ? h[1].trim() : null;
  });

  // 同名関数の二重定義も見る。構文エラーにならないまま後勝ちする（§9-72）。
  const 重複 = [];
  const seen = new Map();
  monaco.editor.getModels().forEach((mm) => {
    const s = mm.getValue();
    if (/^\s*\{/.test(s)) return;                 // appsscript.json は除外
    s.split('\n').forEach((l) => {
      const h = l.match(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/);
      if (h) seen.set(h[1], (seen.get(h[1]) || 0) + 1);
    });
  });
  seen.forEach((n, k) => { if (n > 1) 重複.push(k + '（' + n + '回）'); });

  const out = {
    _説明: 'GAS に実際に入っているコードの指紋。check_gas_sync.mjs が突き合わせる。',
    _更新方法: 'scripts/gas-update/snapshot.js の手順を参照',
    取得日時: new Date().toLocaleString('ja-JP'),
    重複している関数: 重複.length ? 重複 : 'なし',
    関数,
    定数,
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
})()
