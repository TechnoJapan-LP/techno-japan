import assert from 'node:assert/strict';
import { phraseBreaks } from './lib/phrase-breaks.mjs';

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
console.log(`✅ phraseBreaks ${cases.size} samples`);
