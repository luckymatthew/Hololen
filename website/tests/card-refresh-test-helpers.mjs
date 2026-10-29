// Test-only restoration of a reviewed additive refresh; never rewrites user data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
export const canonical = value => JSON.stringify(normalize(value));
export const hash = value => createHash('sha256').update(value).digest('hex');
export function restoreV2Baseline(input, report) {
  assert.equal(report.schemaVersion, 2);
  const catalog = structuredClone(input), byNumber = new Map(catalog.cards.map(card => [card.number, card]));
  const rollback = report.rollback;
  for (const item of rollback.printingMetadata) {
    const variant = byNumber.get(item.number)?.variants.find(variant => variant.id === item.id);
    assert.ok(variant, `Missing baseline printing ${item.number}/${item.id}`);
    assert.deepEqual(variant[item.key], item.after, `${item.number}/${item.id}: only reported metadata may change`);
    if (item.had) variant[item.key] = structuredClone(item.before); else delete variant[item.key];
  }
  for (const item of rollback.cardMetadata) {
    const card = byNumber.get(item.number); assert.ok(card, `Missing baseline card ${item.number}`);
    assert.deepEqual(card[item.key], item.after, `${item.number}: only reported card metadata may change`);
    if (item.had) card[item.key] = structuredClone(item.before); else delete card[item.key];
  }
  const addedIds = new Set(rollback.addedVariants.map(item => item.id));
  const addedNumbers = new Set(rollback.newCards.map(item => typeof item === 'string' ? item : item.number));
  for (const card of catalog.cards) card.variants = card.variants.filter(variant => !addedIds.has(variant.id));
  catalog.cards = rollback.originalCardOrder.map(number => { assert.ok(!addedNumbers.has(number)); assert.ok(byNumber.has(number)); return byNumber.get(number); });
  catalog.meta = structuredClone(rollback.metaBefore);
  return catalog;
}
