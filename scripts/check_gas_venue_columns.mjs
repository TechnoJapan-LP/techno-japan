#!/usr/bin/env node
/* GAS手貼りパッチに、Publish経路で必要なVENUES列が揃っているかを検査する。 */
import fs from 'node:fs';

const patch = fs.readFileSync('scripts/gas-update/venue-columns.patch.gs', 'utf8');
const readme = fs.readFileSync('scripts/gas-update/README.md', 'utf8');
/* 列名は小文字。実物の COLUMNS が小文字で、CMS のペイロードキーも小文字のため。
   当初この検査は大文字を要求しており、実物と食い違っていた（2026-08-24 訂正）。
   大文字を足すと §9-69「大文字小文字で値が消える」を再現する。 */
const required = ['desc_en', 'subtype', 'hours', 'charge', 'features'];
const missingPatch = required.filter((name) => !patch.includes(`'${name}'`));
const failures = [];
if (missingPatch.length) failures.push(`手貼りパッチに不足: ${missingPatch.join(', ')}`);
if (!readme.includes('デプロイ')) failures.push('READMEにGAS再デプロイ手順がない');
if (!readme.includes('snapshot.js')) failures.push('READMEにsnapshot.js更新手順がない');
if (!readme.includes('FEATURES n件')) failures.push('READMEにFEATURES件数の実機確認がない');
/* 大文字で書き戻されたら落とす。手順書が実物と食い違うと、次の人が
   大文字を足して §9-69 を再現する。

   **散文ではなくコード部分だけを見る。** 「かつて大文字で書かれていた」と
   説明する文章まで拾ってしまい、正しい手順書を落とした（2026-08-24）。 */
const UPPER = /'(DESC_EN|SUBTYPE|HOURS|CHARGE|FEATURES)'/;
const readmeCodeBlocks = readme.match(/```[\s\S]*?```/g) || [];
if (readmeCodeBlocks.some((block) => UPPER.test(block))) {
  failures.push('READMEのコード例がCOLUMNS列名を大文字で書いている（実物は小文字）');
}
const requiredArray = (patch.match(/VENUE_COLUMNS_REQUIRED\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\)/) || [])[1] || '';
if (!requiredArray) {
  failures.push('手貼りパッチに VENUE_COLUMNS_REQUIRED の配列が見つからない');
} else if (UPPER.test(requiredArray)) {
  failures.push('手貼りパッチのVENUE_COLUMNS_REQUIREDが大文字（実物は小文字）');
}

if (failures.length) {
  console.error('GAS VENUES列の手順に問題があります:');
  failures.forEach((failure) => console.error(`  ✗ ${failure}`));
  process.exit(1);
}
console.log('✅ GAS VENUES列パッチと手貼り・再デプロイ手順を確認');
