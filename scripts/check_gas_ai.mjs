#!/usr/bin/env node
/**
 * GAS の AI ハンドラ（翻訳・要約）を Node 上で検証する。
 *
 * ■ なぜ必要か
 *
 *   AI 機能の実体は Google Apps Script 側にあり、リポジトリからは見えない。
 *   clasp も使っていないので、**壊れても誰も気づけない場所**だった。
 *   2026-08-07 に、長い記事の英訳が上限で打ち切られても「成功」として
 *   CMS に返る不具合が見つかった（本文は HTML なのでタグの途中で切れる）。
 *   AUDIT §9-54。
 *
 *   貼り替え用のコードを scripts/gas-update/ai-claude-opus5.gs に置き、
 *   Apps Script 固有の API（PropertiesService / UrlFetchApp）を
 *   差し替えてここで動かす。**GAS に貼る前に間違いを見つけるための検査。**
 *
 *   ※ このファイルは「貼り替え用コードの検査」であって、
 *      本番の GAS が同じ内容である保証はしない。貼り替えたら
 *      Apps Script 側も更新すること。
 *
 * ■ 守る性質
 *
 *   1. 上限で打ち切られたら成功と偽らない（黙って壊れた HTML を渡さない）
 *   2. HTTP エラーを成功として返さない
 *   3. 空の応答を成功にしない
 *   4. 未設定時に実在するキー名を案内する
 *   5. 通信例外を握りつぶさない
 *   6. モデル指定・HTML保持の指示・mode 別の指示が入っている
 *
 * 使い方:
 *   node scripts/check_gas_ai.mjs
 */

import fs from 'node:fs'; import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GAS_PATH = path.join(ROOT, 'scripts', 'gas-update', 'ai-claude-opus5.gs');

function run({ key='sk-ant-test', httpCode=200, body=null, throwOn=null }) {
  const calls = [];
  const ctx = {
    console, JSON, Math, Date, String, Number, Boolean, Object, Array, RegExp, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => k==='ANTHROPIC_API_KEY' ? key : null }) },
    UrlFetchApp: { fetch: (url, opts) => {
      calls.push({ url, payload: JSON.parse(opts.payload) });
      if (throwOn) throw new Error(throwOn);
      return { getResponseCode: () => httpCode, getContentText: () => JSON.stringify(body ?? {}) };
    }},
    __calls: calls,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(GAS_PATH,'utf8'), ctx);
  return ctx;
}

const results=[]; const check=(n,p,d)=>results.push([n,p,d]);
const okBody = (t, stop='end_turn') => ({ content:[{text:t}], stop_reason:stop });

// 1) 翻訳が通る
{
  const c = run({ body: okBody('<p>Translated</p>') });
  const r = c.aiTranslateV2_({ text:'<p>日本語</p>', target:'en', html:true });
  check('翻訳が成功する', r.status==='ok' && r.text==='<p>Translated</p>', `${r.status} ${r.text||r.message}`);
  check('モデルが claude-opus-5', c.__calls[0].payload.model==='claude-opus-5', c.__calls[0].payload.model);
  check('HTML保持の指示が入る', /Preserve every tag/.test(c.__calls[0].payload.system), 'ok');
}

// 2) ★打ち切りを検知する（今回の本命）
{
  const c = run({ body: okBody('<p>途中で切れ', 'max_tokens') });
  const r = c.aiTranslateV2_({ text:'長い記事', target:'en', html:true });
  check('打ち切られたら成功と偽らない', r.status==='error' && /途中で切れ/.test(r.message), `${r.status}: ${r.message}`);
}

// 3) 要約が通る & 引用符除去
{
  const c = run({ body: okBody('「リード文です」') });
  const r = c.aiSummarize({ text:'本文', title:'T', mode:'excerpt' });
  check('要約が成功し引用符を外す', r.status==='ok' && r.text==='リード文です', `${r.status} ${r.text||r.message}`);
  check('要約もモデルが claude-opus-5', c.__calls[0].payload.model==='claude-opus-5', c.__calls[0].payload.model);
}

// 4) ★キー名のエラー文言が正しい
{
  const c = run({ key:null });
  const r1 = c.aiSummarize({ text:'本文' });
  const r2 = c.aiTranslateV2_({ text:'本文' });
  check('未設定時に正しいキー名を案内する（要約）', r1.message==='ANTHROPIC_API_KEY not set', r1.message);
  check('未設定時に正しいキー名を案内する（翻訳）', r2.message==='ANTHROPIC_API_KEY not set', r2.message);
}

// 5) ★HTTPエラーを見る（旧要約は見ていなかった）
{
  const c = run({ httpCode:502, body:{} });
  const r = c.aiSummarize({ text:'本文' });
  check('502 を成功として返さない', r.status==='error' && /502/.test(r.message), `${r.status}: ${r.message}`);
}

// 6) 応答が空のとき
{
  const c = run({ body:{ content:[{text:''}], stop_reason:'end_turn' } });
  const r = c.aiTranslateV2_({ text:'本文' });
  check('空の応答を成功にしない', r.status==='error', `${r.status}: ${r.message}`);
}

// 7) 例外を握りつぶさない
{
  const c = run({ throwOn:'network down' });
  const r = c.aiSummarize({ text:'本文' });
  check('通信例外をエラーとして返す', r.status==='error' && /network down/.test(r.message), r.message);
}

// 8) mode ごとに指示が変わる
{
  const c = run({ body: okBody('a\nb\nc') });
  c.aiSummarize({ text:'本文', mode:'titles' });
  const sysTitles = c.__calls[0].payload.system;
  const c2 = run({ body: okBody('x') });
  c2.aiSummarize({ text:'本文', mode:'excerpt-en' });
  check('mode で指示が切り替わる',
    /クリックされやすい記事タイトル/.test(sysTitles) && /English summaries/.test(c2.__calls[0].payload.system), 'ok');
}

// 13) キーの前後の空白・改行を落とす（貼り付けで紛れ込む）
{
  const c = run({ key: ' sk-ant-test\n', body: okBody('ok') });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('キーの空白・改行を落として通す', r.status==='ok', r.status+' '+(r.message||''));
}

// 14) 別サービスのキーは、API を叩く前に形で弾く
{
  const c = run({ key: 'AIzaSyDBCrbSFx5rnKZIl3cEP8AO87QdeRDZr1Q', body: okBody('ok') });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('sk-ant- で始まらないキーは叩く前に弾く',
    r.status==='error' && /sk-ant-/.test(r.message), r.message);
  check('弾いたときは API を呼ばない', c.__calls.length===0, c.__calls.length+'回');
}

// 15) 401 は確認すべき場所まで出す（2026-08-10 に実際に出た。§9-71）
{
  const c = run({ httpCode: 401, body: { error: { message: 'invalid x-api-key' } } });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('401 は元の文言を保つ', /invalid x-api-key/.test(r.message), r.message.slice(0,40));
  check('401 は再デプロイの必要まで伝える', /再デプロイ/.test(r.message), r.message.slice(-40));
}

// 16) 空白だけのキーは「未設定」と同じ扱い
{
  const c = run({ key: '   ' });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('空白だけのキーは未設定として扱う', /not set/.test(r.message), r.message);
}

// 17) 残高不足（400）は「お金の問題」と言い切る（§9-71）
{
  const c = run({ httpCode: 400, body: { error: { message: 'Your credit balance is too low to access the Anthropic API' } } });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('残高不足はクレジットの問題だと明示する',
    /クレジット残高/.test(r.message) && /キーは有効/.test(r.message), r.message.slice(0,50));
  check('Cost ではなく Credits を見るよう促す', /Credits/.test(r.message), r.message.slice(-40));
}

// 18) 残高と関係ない 400 では、余計なことを言わない
{
  const c = run({ httpCode: 400, body: { error: { message: 'max_tokens: value exceeds limit' } } });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('別の 400 でクレジットの話をしない', !/クレジット残高/.test(r.message), r.message.slice(0,50));
}

// 19) 401 は残高と無関係だと言い切る
{
  const c = run({ httpCode: 401, body: { error: { message: 'invalid x-api-key' } } });
  const r = c.aiTranslateV2_({ text:'x', target:'en' });
  check('401 は残高と無関係だと明示する', /残高とは無関係/.test(r.message), r.message.slice(0,50));
  check('既存デプロイの編集だと明示する', /新しいデプロイ.*ではなく|既存のデプロイ/.test(r.message), r.message.slice(-50));
}

console.log('\n検証項目'.padEnd(46)+'判定  実測');
console.log('-'.repeat(96));
let fail=0;
for(const [n,p,d] of results){ if(!p)fail++; console.log(n.padEnd(44)+'  '+(p?'✅':'❌')+'   '+String(d).slice(0,44)); }
console.log('-'.repeat(96));
console.log(fail?`❌ ${fail}件 失敗`:`✅ 全${results.length}件 通過`);
process.exit(fail?1:0);
