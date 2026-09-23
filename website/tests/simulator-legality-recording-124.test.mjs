import test from 'node:test';
import assert from 'node:assert/strict';
import {cards, pool, state, unit, inst, attack} from './fixtures/simulator-audit.mjs';
const {applyAction, legalAttachmentTargets, isActionCandidateLegal} = await import(process.env.HOLO_ENGINE_TEST_TARGET || '../lib/simulator/engine.mjs');
const map = new Map(pool.map(card => [card.number, card]));
const fan = map.get('hBP04-105');
const act = (s, a, p = 0, catalog = pool) => applyAction(s, p, a, catalog, () => .5);
function mixedStage() {
  const s = state('hBP04-008'); s.phase = 'main';
  s.players[0].zones.collab = unit('hBP08-062');
  s.players[0].zones.back1 = unit('hBP08-062');
  s.players[0].zones.back2 = unit('hEB01-019');
  s.players[0].hand = [inst(fan.number, 'fan')];
  return s;
}
function searchState() {
  const s = state('hBP04-008'); s.phase = 'main';
  s.players[0].hand = [inst('hBP06-093', 'event')];
  s.players[0].mainDeck = [inst('hBP04-012', 'pick-1'), inst('hEB01-024', 'pick-2'), inst('hBP04-008', 'unpicked')];
  s.players[0].cheerDeck = [inst('hY06-001', 'bonus-top'), inst('hY06-001', 'bonus-next')];
  s.players[0].zones.center.cheer = [inst('hY06-001', 'own-cheer')];
  s.players[1].zones.center.cheer = [inst('hY06-001', 'their-1'), inst('hY06-001', 'their-2')];
  return s;
}

test('Fan trigger sentence cannot hide the Koyori-only recipient restriction', () => {
  const s = mixedStage();
  assert.deepEqual(legalAttachmentTargets(s.players[0], fan, map), ['center', 'back2']);
  const choice = act(s, {type:'play', cardId:'fan'});
  assert.deepEqual(choice.pendingChoice.options, ['center', 'back2']);
  assert.equal(isActionCandidateLegal(choice, 0, {type:'choose', zone:'collab'}, map), false);
  const result = act(choice, {type:'choose', zone:'back2'});
  assert.deepEqual(result.players[0].zones.back2.attachments.map(c => c.id), ['fan']);
  assert.equal(result.players[0].hand.length, 0);
});

test('Japanese and English named recipient restrictions match the same rule', () => {
  const s = mixedStage();
  for (const text of [
    'このファンをホロメンに手札から付けた時、エールを付け替えられる。このファンは、自分の〈博衣こより〉だけに付けられ、何枚でも付けられる。',
    'When this fan is attached to a holomem, you may move a cheer. You may only attach this fan to your 〈博衣こより〉.'
  ]) assert.deepEqual(legalAttachmentTargets(s.players[0], {...fan, abilityText:text}, map), ['center', 'back2']);
});

test('forged or stale hand attachment choices reject without changing any state', () => {
  const s = mixedStage();
  const choice = act(s, {type:'play', cardId:'fan'});
  choice.pendingChoice.options.push('collab');
  const before = structuredClone(choice);
  assert.throws(() => act(choice, {type:'choose', zone:'collab'}), /附加目標/);
  assert.deepEqual(choice, before);
  choice.players[0].zones.back2 = unit('hBP08-062');
  assert.equal(isActionCandidateLegal(choice, 0, {type:'choose', zone:'back2'}, map), false);
  assert.throws(() => act(choice, {type:'choose', zone:'back2'}), /附加目標/);
});

test('archive attachment final execution rechecks the recipient, preserving source on rejection', () => {
  const s = mixedStage(); s.players[0].archive = s.players[0].hand; s.players[0].hand = [];
  s.pendingChoice = {type:'attachArchivedSupport', playerIndex:0, cardId:'fan', cardNumber:fan.number, options:['center','collab'], optional:true};
  const before = structuredClone(s);
  assert.throws(() => act(s, {type:'choose', zone:'collab'}), /附加目標/);
  assert.deepEqual(s, before);
  const attached = act(s, {type:'choose', zone:'center'});
  assert.equal(attached.players[0].zones.center.attachments[0].id, 'fan');
  assert.equal(attached.players[0].archive.length, 0);
});

test('attachment play has no candidate when every own Holomen is an illegal recipient', () => {
  const s = mixedStage(); s.players[0].zones.center = unit('hBP08-062'); s.players[0].zones.back2 = null;
  assert.equal(isActionCandidateLegal(s, 0, {type:'play', cardId:'fan'}, map), false);
  assert.throws(() => act(s, {type:'play', cardId:'fan'}), /合法 Holomen/);
});

test('holoXSearch produces JSON-stable optional cheer choice; target consumes only deck top', () => {
  const s = searchState();
  let next = act(s, {type:'play', cardId:'event'});
  assert.equal(next.pendingChoice.effect, 'holoXSearch');
  next = act(next, {type:'choose', cardIds:['pick-1','pick-2']});
  assert.equal(next.pendingChoice.type, 'eventCheerTarget');
  assert.equal(next.pendingChoice.optional, true);
  assert.equal(next.pendingChoice.cheerCard, null);
  assert.deepEqual(next.pendingChoice, JSON.parse(JSON.stringify(next.pendingChoice)));
  assert.deepEqual(next.players[0].cheerDeck.map(c => c.id), ['bonus-top','bonus-next']);
  const attached = act(next, {type:'choose', zone:'center'});
  assert.deepEqual(attached.players[0].zones.center.cheer.map(c => c.id), ['own-cheer','bonus-top']);
  assert.deepEqual(attached.players[0].cheerDeck.map(c => c.id), ['bonus-next']);
  assert.deepEqual(attached.players[0].hand.map(c => c.id).sort(), ['pick-1','pick-2']);
});

test('holoXSearch bonus skip preserves deck; equal cheer and empty deck offer no bonus', () => {
  const s = searchState();
  let next = act(act(s, {type:'play', cardId:'event'}), {type:'choose', cardIds:['pick-1','pick-2']});
  const skipped = act(next, {type:'choose', skip:true});
  assert.deepEqual(skipped.players[0].cheerDeck, next.players[0].cheerDeck);
  assert.deepEqual(skipped.players[0].zones.center.cheer, next.players[0].zones.center.cheer);
  assert.equal(skipped.pendingChoice, null);
  for (const kind of ['equal', 'empty']) {
    const noBonus = searchState();
    if (kind === 'equal') noBonus.players[1].zones.center.cheer.pop();
    else noBonus.players[0].cheerDeck = [];
    const result = act(act(noBonus, {type:'play', cardId:'event'}), {type:'choose', cardIds:['pick-1','pick-2']});
    assert.equal(result.pendingChoice, null);
  }
});

test('manual-skill prefilter removes nonexistent Gift and Fan activations, retains usable Gift', () => {
  const s = mixedStage(); const before = structuredClone(s);
  assert.equal(isActionCandidateLegal(s, 0, {type:'giftSkill', zone:'center'}, map), false);
  s.players[0].zones.center.attachments = [inst(fan.number)];
  assert.equal(isActionCandidateLegal(s, 0, {type:'attachmentSkill', zone:'center', cardNumber:fan.number}, map), false);
  const legal = mixedStage(); legal.players[0].zones.center = unit('hBP03-030', {attachments:[inst('hBP03-107')]});
  assert.equal(isActionCandidateLegal(legal, 0, {type:'giftSkill', zone:'center'}, map), true);
  assert.doesNotThrow(() => act(legal, {type:'giftSkill', zone:'center'}));
  s.players[0].zones.center.attachments = []; assert.deepEqual(s, before);
});

test('Fubura candidate requires the actual holder, two cheer and unused per-turn skill', () => {
  const fubuki = cards.find(c => c.jpName === '白上フブキ' && c.stage === 'Debut');
  const s = state(fubuki.number); s.phase = 'main';
  s.players[0].zones.center.attachments = [inst('hBP02-092', 'fubura')];
  s.players[0].zones.center.cheer = [inst('hY01-001','one'), inst('hY01-001','two')];
  const command = {type:'attachmentSkill', zone:'center', cardNumber:'hBP02-092'};
  assert.equal(isActionCandidateLegal(s, 0, command, map), true);
  assert.doesNotThrow(() => act(s, command));
  s.players[0].zones.center.cheer.pop();
  assert.equal(isActionCandidateLegal(s, 0, command, map), false);
});

test('collab, baton and attack prefilters respect stage, timing and payment without mutation', () => {
  const s = state(); s.phase = 'main'; s.players[0].zones.back1 = unit('AUDIT-DUMMY');
  const before = structuredClone(s);
  assert.equal(isActionCandidateLegal(s, 0, {type:'collab', zone:'back1'}, map), true);
  assert.equal(isActionCandidateLegal(s, 0, {type:'baton', zone:'back1'}, map), true);
  assert.deepEqual(s, before);
  s.players[0].zones.collab = unit('AUDIT-DUMMY');
  assert.equal(isActionCandidateLegal(s, 0, {type:'collab', zone:'back1'}, map), false);
  s.phase = 'performance'; s.players[1].zones.back1 = unit('AUDIT-DUMMY');
  assert.equal(isActionCandidateLegal(s, 0, attack, map), true);
  assert.equal(isActionCandidateLegal(s, 0, {...attack, sourceZone:'back1'}, map), false);
  assert.equal(isActionCandidateLegal(s, 0, {...attack, targetZone:'back1'}, map), false);
  s.players[0].zones.center.rested = true;
  assert.equal(isActionCandidateLegal(s, 0, attack, map), false);
});

// Official recipient/bonus text checked against primary card records:
// https://hololive-official-cardgame.com/cardlist/?expansion_name=hBP04&id=969&view=text
// https://hololive-official-cardgame.com/cardlist/?id=1570
// These fixtures contain synthetic card instances, not user battle data.
const activeGiftFixtures = [
  ['hSD10-004', s => {
    s.players[0].oshi = inst('hSD10-001');
    s.players[0].zones.center.stack = [inst('hSD10-002','under'), inst('hSD10-004','top')];
    s.players[0].zones.center.bloomedTurn = s.turn;
    s.players[0].hand = [inst('hSD10-006')];
    s.players[1].zones.center = unit('hBP04-012');
  }],
  ['hBP01-045', s => {s.players[0].life.length = 3; s.players[0].hand = [inst('hBP01-047')];}],
  ['hBP03-030', s => {s.players[0].zones.center.attachments = [inst('hBP03-107')];}],
  ['hBP06-070', s => {s.players[0].zones.center.attachments = [inst('hBP06-099')];}],
  ['hBP07-080', s => {s.players[0].oshi = inst('hBP07-007'); s.players[0].archive = [inst('hBP07-110')];}],
  ['hSD13-013', s => {s.players[0].zones.center.stack = [inst('hSD13-008','under'), inst('hSD13-013','top')];}],
];
for (const [number, prepare] of activeGiftFixtures) test(`active Gift ${number} survives the candidate prefilter`, () => {
  const s = state(number); s.phase = 'main'; prepare(s);
  const command = {type:'giftSkill', zone:'center', cardNumber:number};
  const before = structuredClone(s);
  assert.equal(isActionCandidateLegal(s, 0, command, map), true);
  assert.deepEqual(s, before);
  assert.doesNotThrow(() => act(s, command));
});

test('archive Kiara Gift retains legal Bloom and rejects missing resource requirement', () => {
  const s = state('hBP08-042'); s.phase = 'main';
  s.players[0].archive = [inst('hBP08-044','kiara'), ...Array.from({length:9},(_,i)=>inst('AUDIT-DUMMY','cost-'+i))];
  const command = {type:'giftSkill', cardNumber:'hBP08-044'};
  assert.equal(isActionCandidateLegal(s, 0, command, map), true);
  assert.doesNotThrow(() => act(s, command));
  s.players[0].archive.pop();
  assert.equal(isActionCandidateLegal(s, 0, command, map), false);
});

test('Green Test Tube retains its manual skill and passive attachments cannot impersonate it', () => {
  const s = state('hBP04-012'); s.phase = 'main';
  s.players[0].zones.center.attachments = [inst('hBP04-097')];
  s.players[0].zones.center.cheer = [inst('hY06-001')];
  s.players[0].zones.back1 = unit('hBP08-062', {rested:true});
  const command = {type:'attachmentSkill', zone:'center', cardNumber:'hBP04-097'};
  assert.equal(isActionCandidateLegal(s, 0, command, map), true);
  assert.doesNotThrow(() => act(s, command));
  assert.equal(isActionCandidateLegal(s, 0, {...command,cardNumber:'hBP04-105'}, map), false);
  assert.throws(() => act(s, {...command,cardNumber:'hBP04-105'}), /沒有可主動使用/);
});

test('funded catalog Oshi activations accepted by the engine remain eligible for candidate generation', () => {
  let executable = 0;
  for (const oshi of cards.filter(c => c.group === 'oshi')) {
    const s = state(); s.phase = 'main'; s.players[0].oshi = inst(oshi.number);
    const members = cards.filter(c => c.group === 'holomem' && c.jpName === oshi.jpName);
    const center = members.find(c => c.stage === '2nd') || members[0];
    const back = members.find(c => c.stage === '1st');
    if (center) s.players[0].zones.center = unit(center.number);
    if (back) s.players[0].zones.back1 = unit(back.number);
    s.players[0].holoPower = Array.from({length:10},(_,i)=>inst('hY01-001',`power-${i}`));
    s.players[0].cheerDeck = Array.from({length:10},(_,i)=>inst('hY01-001',`cheer-${i}`));
    for (const type of ['oshiSkill','spOshiSkill']) {
      try { act(s,{type}); }
      catch (error) {
        // Effect-specific targets remain the resolver's responsibility. Never
        // swallow the independent audit loader's successful-action assertion.
        if (String(error.message).includes('PREFILTER_FALSE_NEGATIVE')) throw error;
        continue;
      }
      executable++;
      assert.equal(isActionCandidateLegal(s,0,{type},map),true,`${oshi.number}:${type}`);
    }
  }
  assert.ok(executable >= 25, `Expected broad successful activation coverage, got ${executable}`);
});

test('legal Bloom, repeated Arts and back-target modifiers remain eligible', () => {
  let s = state('hSD10-003'); s.phase = 'main'; s.players[0].hand = [inst('hSD10-006','bloom')];
  assert.equal(isActionCandidateLegal(s,0,{type:'play',cardId:'bloom'},map),true);
  assert.doesNotThrow(() => act(s,{type:'play',cardId:'bloom'}));
  s = state(); s.players[0].zones.center.lastArtsTurn = s.turn;
  s.players[0].zones.center.modifiers = [{kind:'repeatArts',uses:1,artIndex:0,expiresTurn:s.turn}];
  assert.equal(isActionCandidateLegal(s,0,attack,map),true);
  assert.doesNotThrow(() => act(s,attack));
  s.players[1].zones.back1 = unit('AUDIT-DUMMY');
  s.players[0].zones.center.modifiers.push({kind:'attackBack',expiresTurn:s.turn});
  assert.equal(isActionCandidateLegal(s,0,{...attack,targetZone:'back1'},map),true);
  assert.doesNotThrow(() => act(s,{...attack,targetZone:'back1'}));
});
