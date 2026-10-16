import assert from 'node:assert/strict';
import { clauseBreaks, phraseBreaks } from './lib/phrase-breaks.mjs';

const cases = new Map([
  ['野外テクノパーティTRANSCENDENCEで見た次世代ジェネレーションの可能性', '野外<wbr>テクノパーティ<wbr>TRANSCENDENCEで<wbr>見た<wbr>次世代<wbr>ジェネレーションの<wbr>可能性'],
  ['博多湾を望む国営公園で、朝から夜明けまで音が鳴り続けるコミュニティギャザリング', '博多湾を<wbr>望む国営公園で、<wbr>朝から<wbr>夜明けまで<wbr>音が<wbr>鳴り続ける<wbr>コミュニティギャザリング'],
  ['TRANSCENDENCEは、日本の新たなレイヴジェネレーションが創り上げたカッティングエッジなレイヴパーティだ。', 'TRANSCENDENCEは、<wbr>日本の<wbr>新たな<wbr>レイヴジェネレーションが<wbr>創り上げた<wbr>カッティングエッジな<wbr>レイヴパーティだ。'],
  ['標高1,000mの森で、日本を代表する野外レイヴが3日間の物語を組む。', '標高1,000mの<wbr>森で、<wbr>日本を<wbr>代表する<wbr>野外<wbr>レイヴが<wbr>3日間の<wbr>物語を<wbr>組む。'],
  ['日本の音楽フェスティバル&レイヴ11選', '日本の<wbr>音楽<wbr>フェスティバル&amp;レイヴ11選'],
]);

for (const [input, expected] of cases) {
  assert.equal(phraseBreaks(input), expected, input);
}
assert.equal(phraseBreaks('TRANSCENDENCE / festival'), 'TRANSCENDENCE / festival');
assert.equal(phraseBreaks('日本&amp;音楽'), '日本&amp;音楽');

const clauseCases = new Map([
  ['東京・日の出町の森が、光とアートと音楽の別世界に変わる', '<span class="tj-clause tj-cl-m tj-cl-l">東京・日の<wbr>出町の<wbr>森が、</span><span class="tj-clause tj-cl-l">光と<wbr>アートと<wbr>音楽の<wbr>別世界に<wbr>変わる</span>'],
  ['TRANSCENDENCEは、日本の新たなレイヴジェネレーションが創り上げたカッティングエッジなレイヴパーティだ。', '<span class="tj-clause tj-cl-s tj-cl-m tj-cl-l">TRANSCENDENCE<wbr>は、</span><span class="tj-clause">日本の<wbr>新たな<wbr>レイヴジェネレーションが<wbr>創り上げた<wbr>カッティングエッジな<wbr>レイヴパーティだ。</span>'],
]);
for (const [input, expected] of clauseCases) {
  assert.equal(clauseBreaks(input), expected, input);
  for (const clause of clauseBreaks(input).matchAll(/<span class="tj-clause">([\s\S]*?)<\/span>/g)) {
    assert.ok(clause[1].replaceAll('<wbr>', '').length >= 4, clause[1]);
  }
}
console.log(`✅ phraseBreaks ${cases.size} samples`);
