import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitAuditClauses } from '../scripts/audit-clause-parser.mjs';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('quoted Oshi-skill punctuation stays inside the hBP09-023 Arts clause', () => {
  assert.deepEqual(splitAuditClauses('[センターポジション限定]このターンに自分の推しスキル「Good Luck, holoh3ro!」を使っていたなら、このアーツ+80。'), [
    '[センターポジション限定]このターンに自分の推しスキル「Good Luck, holoh3ro!」を使っていたなら、このアーツ+80。',
  ]);
});

test('Japanese full stops still separate independently resolvable effect sentences', () => {
  assert.deepEqual(splitAuditClauses('相手のホロメン1人を選ぶ。このターンの間、そのホロメンは2ndとして扱う。'), [
    '相手のホロメン1人を選ぶ。',
    'このターンの間、そのホロメンは2ndとして扱う。',
  ]);
});

test('English terminal punctuation separates only at sentence boundaries', () => {
  assert.deepEqual(splitAuditClauses('Do step 1.5 first. Then shuffle!'), ['Do step 1.5 first.', 'Then shuffle!']);
});

test('effect matrix carries independently verified identity and printing evidence instead of ignoring card overrides', () => {
  execFileSync(process.execPath, ['scripts/generate-card-effect-matrix.mjs'], { cwd: websiteRoot, stdio: 'ignore' });
  const matrix = JSON.parse(readFileSync(path.join(websiteRoot, 'docs/effect-audit/CARD_EFFECT_MATRIX_CURRENT.json'), 'utf8'));
  const kaela = matrix.cardChecks.find(row => row.cardNumber === 'hBP09-044');

  assert.equal(kaela.identityStatus, 'PARTIAL');
  assert.equal(kaela.basicActionStatus, 'UNVERIFIED');
  assert.equal(kaela.printingEquivalenceStatus, 'PARTIAL');
  assert.deepEqual(matrix.cardsByStatus, { PARTIAL: 12, UNVERIFIED: 1382 });
  assert.deepEqual(matrix.basicActionByStatus, { PARTIAL: 7, UNVERIFIED: 1387 });
  assert.deepEqual(matrix.printingEquivalenceByStatus, { PARTIAL: 9, UNVERIFIED: 1385 });
  // Only two text-free Cheer cards were added; no new rules have been audited.
  assert.equal(matrix.currentCardCount, 1394);
  assert.equal(matrix.printingCount, 2981);
  assert.equal(matrix.abilityCount, 2468);
  assert.equal(matrix.clauseCount, 3130);
  assert.equal(matrix.complete, false);
  for (const number of ['hY03-018', 'hY04-015']) {
    const card = matrix.cardChecks.find(row => row.cardNumber === number);
    assert.ok(card, `${number} must be included in the audit denominator`);
    assert.equal(card.identityStatus, 'UNVERIFIED');
    assert.equal(card.basicActionStatus, 'UNVERIFIED');
    assert.equal(card.printingEquivalenceStatus, 'UNVERIFIED');
    assert.equal(card.hasPrintedRulesText, false);
    assert.deepEqual(card.abilityIds, []);
  }

});
