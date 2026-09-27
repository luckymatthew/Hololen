import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const engineTarget = process.env.HOLO_ENGINE_TEST_TARGET || 'lib/simulator/engine.mjs';
const catalogTarget = process.env.HOLO_CARD_CATALOG_TEST_TARGET || 'public/cards.json';
const { applyAction, isActionCandidateLegal } = await import(pathToFileURL(resolve(process.cwd(), engineTarget)).href);
const cards = JSON.parse(readFileSync(resolve(process.cwd(), catalogTarget), 'utf8')).cards;
const androidCards = JSON.parse(readFileSync(resolve(process.cwd(), '../../android-current/app/src/main/assets/cards.json'), 'utf8')).cards;
const { onlineActions } = await import(pathToFileURL(resolve(process.cwd(), '../../android-current/web/battle/online.mjs')).href);
const dummy = { number: 'AUDIT-DUMMY', name: 'Audit dummy', jpName: 'Audit dummy', group: 'holomem', stage: 'Debut', hp: 10000, colors: [], tags: [], arts: [{ name: 'Audit damage', damage: 100, cost: [], effect: '' }] };
const oshi = { number: 'AUDIT-OSHI', name: 'Audit oshi', group: 'oshi', colors: [], life: 5, arts: [] };
const pool = [...cards, dummy, oshi];
const inst = (number, id = number) => ({ number, id });
const unit = (number, options = {}) => ({ stack: [inst(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, ...options });
const laplus1st = cards.find(card => card.group === 'holomem' && card.stage === '1st' && card.jpName === 'ラプラス・ダークネス');
assert.ok(laplus1st, 'Catalog must contain a 1st Laplus');

function stateWithKaras({ zone = 'collab', holder = laplus1st.number, attached = true } = {}) {
  const makePlayer = name => ({
    name, ready: true, setupDone: true, oshi: inst(oshi.number),
    mainDeck: Array.from({ length: 12 }, (_, i) => inst(dummy.number, `${name}-deck-${i}`)),
    cheerDeck: [], hand: [], life: Array.from({ length: 5 }, (_, i) => inst('hY01-001', `${name}-life-${i}`)),
    holoPower: [], archive: [], zones: { center: unit(dummy.number), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    collabTurn: 3, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, turnsTaken: 2,
  });
  const s = { status: 'playing', players: [makePlayer('A'), makePlayer('B')], activePlayer: 0, firstPlayer: 0, winner: null, turn: 3, phase: 'main', pendingChoice: null, log: [] };
  s.players[0].zones[zone] = unit(holder, { returnSlot: zone === 'collab' ? 'back1' : null, attachments: attached ? [inst('hBP04-103', 'karas')] : [] });
  if (zone === 'collab') s.players[0].zones.center = unit(dummy.number, { id: 'center' });
  return s;
}

test('Karas skill is a legal manual action only from attached Laplus in Collab', () => {
  const s = stateWithKaras();
  const action = { type: 'attachmentSkill', zone: 'collab', cardNumber: 'hBP04-103' };
  assert.equal(isActionCandidateLegal(s, 0, action, pool), true);
  assert.equal(isActionCandidateLegal(s, 0, { ...action, zone: 'back1' }, pool), false);
  assert.equal(isActionCandidateLegal(stateWithKaras({ holder: 'hBP04-054' }), 0, action, pool), true, 'the extra ability has no 1st-or-higher restriction');
  assert.equal(isActionCandidateLegal(stateWithKaras({ holder: 'AUDIT-DUMMY' }), 0, action, pool), false);
  assert.equal(isActionCandidateLegal(stateWithKaras({ attached: false }), 0, action, pool), false);
});

test('Karas odd die moves its Laplus from Collab to Back without a Cheer cost', () => {
  const s0 = stateWithKaras();
  const action = { type: 'attachmentSkill', zone: 'collab', cardNumber: 'hBP04-103' };
  const s = applyAction(s0, 0, action, pool, () => 0);
  assert.equal(s.players[0].zones.collab, null);
  assert.equal(s.players[0].zones.back1?.stack.at(-1)?.number, laplus1st.number);
  assert.equal(s.players[0].zones.back1?.attachments[0]?.number, 'hBP04-103');
  assert.equal(s.players[0].zones.back1?.returnSlot, null);
  assert.equal(s.players[0].archive.filter(card => card.number === 'hY01-001').length, 0);
  assert.equal(s.players[0].namedUsageTurns?.['attachment:hBP04-103:karas'], 3);
});

test('Karas even die leaves Laplus in Collab and consumes this copy for the turn', () => {
  const s0 = stateWithKaras();
  const action = { type: 'attachmentSkill', zone: 'collab', cardNumber: 'hBP04-103' };
  const s = applyAction(s0, 0, action, pool, () => 0.99);
  assert.equal(s.players[0].zones.collab?.stack.at(-1)?.number, laplus1st.number);
  assert.equal(s.players[0].zones.back1, null);
  assert.equal(s.players[0].namedUsageTurns?.['attachment:hBP04-103:karas'], 3);
  assert.equal(isActionCandidateLegal(s, 0, action, pool), false);
});

test('Karas keeps its passive +10 Arts modifier while its activated skill is available', () => {
  const s0 = stateWithKaras();
  s0.phase = 'performance';
  s0.players[0].zones.collab.cheer = [inst('hY05-001', 'purple-cheer')];
  const s = applyAction(s0, 0, { type: 'attack', sourceZone: 'collab', targetZone: 'center', artIndex: 0 }, pool, () => 0);
  assert.equal(s.players[1].zones.center.damage, 50, 'printed 40 Arts receives the attached Mascot\'s passive +10');
});

test('hBP08-102 applies its printed Arts值+10 on the selected engine source', () => {
  const buzz = cards.find(card => card.group === 'holomem' && card.typeCode === 'buzzCharacter' && card.arts?.[0]?.effect === '');
  assert.ok(buzz, 'Selected card catalogue needs a Buzz with an unconditional first Arts');
  const s = stateWithKaras({ zone: 'center', holder: buzz.number, attached: false });
  s.phase = 'performance';
  const attacker = s.players[0].zones.center;
  attacker.attachments.push(inst('hBP08-102', 'hoodie'));
  const cheerCards = { '白': 'hY01-001', '綠': 'hY02-001', '紅': 'hY03-001', '藍': 'hY04-001', '紫': 'hY05-001', '黃': 'hY06-001', '無色': 'hY01-001' };
  attacker.cheer = (buzz.arts[0].cost || []).map((color, index) => inst(cheerCards[color], `hoodie-cheer-${index}`));
  const result = applyAction(s, 0, { type: 'attack', sourceZone: 'center', targetZone: 'center', artIndex: 0 }, pool, () => 0);
  assert.equal(result.players[1].zones.center.damage, buzz.arts[0].damage + 10);
});

test('Android online action list exposes the legal Karas skill and hides it after use', () => {
  const s = stateWithKaras();
  for (const player of s.players) {
    player.oshi = inst('hBD24-001');
    player.holoPowerCount = 0;
  }
  const action = { type: 'attachmentSkill', zone: 'collab', cardNumber: 'hBP04-103' };
  assert.ok(onlineActions(s, androidCards).some(candidate => JSON.stringify(candidate) === JSON.stringify(action)));
  s.players[0].namedUsageTurns = { 'attachment:hBP04-103:karas': s.turn };
  assert.equal(onlineActions(s, androidCards).some(candidate => candidate.type === action.type && candidate.cardNumber === action.cardNumber), false);
});
