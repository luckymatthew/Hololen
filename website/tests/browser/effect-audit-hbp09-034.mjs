import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-034');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-034-${++serial}`, number });
const unit = (number, damage = 0) => ({ stack: [instance(number)], cheer: [], attachments: [], damage, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const events = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const player = (name, oshi) => ({
  name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: Array.from({ length: 36 }, () => instance('hBP09-051')),
  cheerDeck: Array.from({ length: 10 }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017'][i % 3])),
  archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
  turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0, spOshiSkillUsed: false,
  collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function fixture(archiveNumbers = ['hBP01-116', 'hBP01-122', 'hBP09-100', 'hBP09-051']) {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Player', 'hBP01-001'), player('Opponent', 'hBP01-001')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones = { center: unit('hBP09-064', 150), collab: null, back1: unit('hBP09-034'), back2: null, back3: null, back4: null, back5: null };
  state.players[0].archive = archiveNumbers.map(instance);
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}
const act = (state, action, playerIndex = 0) => applyAction(state, playerIndex, action, cards, () => 0.4);
function collab(state) {
  const next = act(state, { type: 'collab', zone: 'back1' });
  if (!next.pendingChoice || next.pendingChoice.type !== 'cardSelection') throw new Error(`Expected two-card cost selection, got ${next.pendingChoice?.type || 'none'}`);
  return next;
}
function pay(state, cardIds) { return act(state, { type: 'choose', cardIds }, state.pendingChoice.playerIndex); }
function answer(state, action) { return act(state, action, state.pendingChoice.playerIndex); }
function run() {
  if (!card) throw new Error('Current card catalogue is missing hBP09-034');
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalogue identity, R/SR variants, exact Japanese Collab text and Buzz Extra', card.jpName === '大神ミオ' && card.typeCode === 'buzzCharacter' && card.hp === 240 && card.variants.some(v => v.rarity === 'R') && card.variants.some(v => v.rarity === 'SR') && card.keyword.effect === '自分のアーカイブの[マスコットとファン]合計2枚を好きな順でデッキの上に戻せる:自分のホロメン1人のHP100回復。' && card.extra === 'このホロメンがダウンした時、自分のライフ-2');

  const paidState = fixture();
  const owner = paidState.players[0];
  const mascot = owner.archive.find(c => c.number === 'hBP01-116');
  const fan = owner.archive.find(c => c.number === 'hBP01-122');
  const noCostCards = owner.archive.filter(c => ![mascot.id, fan.id].includes(c.id));
  const expectedDeckTop = owner.mainDeck[1];
  let result = collab(paidState);
  check('only archive Mascot/Fan are available and two can be selected', result.pendingChoice.optional && result.pendingChoice.max === 2 && result.pendingChoice.selectableIds.length === 2 && result.pendingChoice.selectableIds.includes(mascot.id) && result.pendingChoice.selectableIds.includes(fan.id));
  result = pay(result, [fan.id, mascot.id]);
  check('the chosen card order becomes deck-top order and only own Holomem are heal targets', result.pendingChoice?.type === 'stageTarget' && result.pendingChoice.options.includes('center') && result.pendingChoice.options.includes('collab') && !result.pendingChoice.options.includes('opponent-center') && result.players[0].mainDeck[0].id === fan.id && result.players[0].mainDeck[1].id === mascot.id && noCostCards.every(c => result.players[0].archive.some(item => item.id === c.id)));
  result = answer(result, { type: 'choose', zone: 'center' });
  check('the selected damaged own Holomem recovers 100 HP, capped by prior damage', !result.pendingChoice && result.players[0].zones.center.damage === 50);

  const skipped = fixture();
  const deckBefore = skipped.players[0].mainDeck.map(c => c.id).slice(1);
  result = collab(skipped);
  result = answer(result, { type: 'choose', skip: true });
  check('declining cost leaves archived cards and post-Collab deck order alone without healing', !result.pendingChoice && result.players[0].archive.length === 4 && result.players[0].mainDeck.map(c => c.id).join() === deckBefore.join() && result.players[0].zones.center.damage === 150);

  const insufficient = fixture(['hBP01-116']);
  result = act(insufficient, { type: 'collab', zone: 'back1' });
  check('one eligible card cannot satisfy the exact two-card cost', !result.pendingChoice && result.players[0].archive.length === 1 && result.players[0].zones.center.damage === 150);

  const down = fixture([]);
  const source = unit('hBP09-034');
  source.cheer = [instance('hY02-001'), instance('hY02-001'), instance('hY01-001')];
  const sourceCheerIds = source.cheer.map(item => item.id);
  down.players[0].zones = { center: source, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  down.players[1].zones = { center: unit('hBP09-034', 140), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  down.phase = 'performance';
  result = act(down, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  check('Buzz Down Extra applies exactly two Life loss after the 110 Arts KO, with required Cheer retained', result.players[1].life.length === 3 && result.log.some(entry => JSON.stringify(entry).includes('造成 110 傷害')) && result.players[0].zones.center.rested && result.players[0].zones.center.cheer.map(item => item.id).join() === sourceCheerIds.join());

  const invalid = fixture([]);
  const underpaid = unit('hBP09-034');
  underpaid.cheer = [instance('hY02-001'), instance('hY02-001')];
  invalid.players[0].zones = { center: underpaid, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  invalid.phase = 'performance';
  const before = JSON.stringify(invalid);
  let rejected = false;
  try { act(invalid, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }); } catch { rejected = true; }
  check('110 Arts rejects an underpaid two-Cheer attack without state mutation', rejected && JSON.stringify(invalid) === before);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-034';
