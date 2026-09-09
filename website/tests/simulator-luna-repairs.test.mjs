import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, attack, fund } from './fixtures/simulator-audit.mjs';

const act = (s, a) => applyAction(structuredClone(s), 0, a, pool, () => 0.5);
function ready(number) {
  const s = state(number);
  fund(s.players[0].zones.center, cards.find(c => c.number === number).arts[0].cost);
  return s;
}
for (const companion of ['none', 'fubuki', 'gamer', 'unrelated']) {
  test(`hBP04-014 Arts needs a non-Fubuki Gamer: ${companion}`, () => {
    const s = ready('hBP04-014');
    if (companion !== 'none') {
      const c = cards.find(c => c.group === 'holomem' && c.stage === 'Debut' &&
        (companion === 'fubuki' ? c.jpName === '白上フブキ' :
          companion === 'gamer' ? c.tags.includes('#ゲーマーズ') && c.jpName !== '白上フブキ' : !c.tags.includes('#ゲーマーズ')));
      s.players[0].zones.back1 = unit(c.number);
    }
    assert.equal(act(s, attack).players[1].zones.center.damage, companion === 'gamer' ? 150 : 100);
  });
}
for (const attachment of ['hBP04-105', 'hBP01-126', null]) {
  test(`hBP04-013 search requires attached Koyo Lab support: ${attachment}`, () => {
    const s = ready('hBP04-013');
    if (attachment) s.players[0].zones.center.attachments = [inst(attachment, 'attached')];
    s.players[0].mainDeck = [inst('hBP04-097', 'eligible'), inst('hBP04-009', 'ineligible')];
    const next = act(s, attack);
    if (attachment !== 'hBP04-105') {
      assert.equal(next.pendingChoice, null);
      assert.equal(next.players[0].hand.length, 0);
      return;
    }
    assert.equal(next.pendingChoice?.effect, 'deckToHandShuffle');
    assert.deepEqual(next.pendingChoice.selectableIds, ['eligible']);
    const end = act(next, { type: 'choose', cardIds: ['eligible'] });
    assert.deepEqual(end.players[0].hand.map(c => c.id), ['eligible']);
    assert.deepEqual(end.players[0].mainDeck.map(c => c.id), ['ineligible']);
    assert.equal(end.players[1].zones.center.damage, 160);
    assert.equal(end.pendingChoice, null);
  });
}
test('hBP04-013 with no matching support still completes its Arts', () => {
  const s = ready('hBP04-013');
  s.players[0].zones.center.attachments = [inst('hBP04-105', 'attached')];
  s.players[0].mainDeck = [inst('hBP04-009', 'ineligible')];
  const end = act(s, attack);
  assert.equal(end.pendingChoice, null);
  assert.equal(end.players[1].zones.center.damage, 160);
  assert.equal(end.players[0].hand.length, 0);
});

for (const number of ['hBP03-002', 'hBP04-002']) {
  function oshiReady({ cheer = true, target = true } = {}) {
    const s = state();
    s.phase = 'main';
    s.players[0].oshi = inst(number);
    s.players[0].holoPower = [inst('hBP04-009', 'power1'), inst('hBP04-009', 'power2')];
    s.players[0].archive = cheer ? [inst('hY01-001', 'archived')] : [];
    if (target) {
      const c = cards.find(c => c.group === 'holomem' && c.stage === 'Debut' &&
        (number === 'hBP03-002' ? c.jpName === '獅白ぼたん' : c.tags.includes('#ReGLOSS')));
      s.players[0].zones.back1 = unit(c.number);
    }
    return s;
  }
  test(number + ' must select an archived Cheer when available', () => {
    const next = act(oshiReady(), { type: 'oshiSkill' });
    assert.equal(next.pendingChoice?.effect, 'archiveCheerToStage');
    assert.throws(() => act(next, { type: 'choose', skip: true }));
    assert.throws(() => act(next, { type: 'choose', cardIds: [] }));
    const target = act(next, { type: 'choose', cardIds: ['archived'] });
    assert.throws(() => act(target, { type: 'choose', zone: 'center' }));
    const end = act(target, { type: 'choose', zone: 'back1' });
    assert.equal(end.players[0].zones.back1.cheer.at(-1).id, 'archived');
    assert.equal(end.players[0].holoPower.length, 0);
    assert.equal(end.pendingChoice, null);
    assert.throws(() => act(end, { type: 'oshiSkill' }));
  });
  test(number + ' with no archived Cheer resolves without a choice', () => {
    assert.equal(act(oshiReady({ cheer: false }), { type: 'oshiSkill' }).pendingChoice, null);
  });
}
test('hBP04-013 required deck search still deals damage', () => {
  const s = ready('hBP04-013');
  s.players[0].zones.center.attachments = [inst('hBP04-105', 'attached')];
  s.players[0].mainDeck = [inst('hBP04-097', 'eligible'), inst('hBP04-009', 'other')];
  const pending = act(s, attack);
  assert.throws(() => act(pending, { type: 'choose', skip: true }));
  const end = act(pending, { type: 'choose', cardIds: ['eligible'] });
  assert.equal(end.players[0].hand.length, 1);
  assert.equal(end.players[0].mainDeck.length, 1);
  assert.equal(end.players[1].zones.center.damage, 160);
  assert.equal(end.pendingChoice, null);
});

