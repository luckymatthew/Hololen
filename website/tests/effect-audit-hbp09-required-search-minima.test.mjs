import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMS } from '../lib/simulator/hbp09/programs.mjs';

const expected = new Map([
  ['007:oshi', [1, 2]],
  ['013:keyword', [1, 1]],
  ['016:keyword', [2, 2]],
  ['026:keyword', [1, 1, 2]],
  ['028:keyword', [1, 1]],
  ['029:art0', [1, 1]],
  ['039:keyword', [2, 2]],
  ['048:keyword', [1, 1, 2]],
  ['065:keyword', [2, 2]],
  ['068:art1', [1, 1]],
  ['090:support', [1, 1]],
]);

function searchSteps(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const entry of value) searchSteps(entry, found);
    return found;
  }
  if (value.op === 'chooseCards' && value.search === true) found.push(value);
  for (const child of Object.values(value)) searchSteps(child, found);
  return found;
}

for (const [programKey, [min, max, count = 1]] of expected) {
  test(`${programKey} mandatory ability allows hidden-deck fail-to-find and preserves its printed maximum`, () => {
    const steps = searchSteps(PROGRAMS[programKey]);
    assert.equal(steps.length, count, `expected ${count} separate search instruction(s)`);
    for (const step of steps) {
      assert.equal(step.min, min, 'Comprehensive Rules 10.7.2.3.1 preserves the requested count when selecting cards, while 10.7.2.3.5 permits selecting none from a hidden area');
      assert.equal(step.max, max, 'the search limit follows the Japanese card text');
      assert.equal(Boolean(step.optional), false);
    }
  });
}
