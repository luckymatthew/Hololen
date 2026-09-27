import { applyAction, publicRoomState } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-032');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-032-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const events = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const player = name => ({
  name, oshi: instance('hBP01-001'),
  zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: Array.from({ length: 36 }, () => instance('hBP09-051')),
  cheerDeck: Array.from({ length: 10 }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017'][i % 3])),
  archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
  turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0,
  spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function fixture(hand = []) {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones = { center: unit('hBP09-064'), collab: null, back1: unit('hBP09-032'), back2: unit('hBP09-034'), back3: null, back4: null, back5: null };
  state.players[1].zones.center = unit('hBP09-032');
  state.players[0].hand = hand.map(instance);
  return state;
}
const act = (state, action, playerIndex = 0) => applyAction(state, playerIndex, action, cards, () => 0.4);
const begin = state => act(state, { type: 'collab', zone: 'back1' });
function assertChoice(state, type) {
  if (state.pendingChoice?.type !== type) throw new Error(`Expected ${type} choice, got ${state.pendingChoice?.type || 'none'}`);
}
function pay(state, card) {
  assertChoice(state, 'cardSelection');
  return act(state, { type: 'choose', cardIds: [card.id] }, state.pendingChoice.playerIndex);
}
function target(state, zone) {
  assertChoice(state, 'stageTarget');
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}
function run() {
  const checks = [];
  const check = (name, condition) => checks.push({ name, pass: Boolean(condition) });
  check('catalogue has the printed C/S identity, exact cost/effect text, and 20 Arts', card?.jpName === '大神ミオ' && card.hp === 100 && card.stage === 'Debut' && card.variants.some(v => v.rarity === 'C') && card.variants.some(v => v.rarity === 'S') && card.keyword.effect === '自分の手札の[マスコットかファン]1枚を公開し、デッキの上に戻せる:自分のエールデッキの上から1枚を自分の#ゲーマーズを持つホロメンに送る。' && card.arts[0].damage === 20);

  const selected = fixture(['hBP01-116', 'hBP01-122', 'hBP01-105', 'hBP09-033']);
  const owner = selected.players[0];
  const mascot = owner.hand.find(item => item.number === 'hBP01-116');
  const fan = owner.hand.find(item => item.number === 'hBP01-122');
  const previousDeckTop = owner.mainDeck[0].id;
  const nextDeckTop = owner.mainDeck[1].id;
  let state = begin(selected);
  check('only Mascot and Fan are offered as the optional cost', state.pendingChoice?.optional === true && state.pendingChoice.selectableIds.length === 2 && state.pendingChoice.selectableIds.includes(mascot.id) && state.pendingChoice.selectableIds.includes(fan.id));
  state = pay(state, mascot);
  check('the destination is limited to own Gamers', state.pendingChoice?.options?.length === 2 && state.pendingChoice.options.includes('collab') && state.pendingChoice.options.includes('back2') && !state.pendingChoice.options.includes('center') && !state.pendingChoice.options.includes('opponent-center'));
  const topCheer = state.players[0].cheerDeck[0].id;
  state = target(state, 'back2');
  check('paid Mascot is revealed publicly and returned to exact deck top without shuffling', !state.players[0].hand.some(item => item.id === mascot.id) && state.players[0].mainDeck[0].id === mascot.id && state.players[0].mainDeck[1].id === nextDeckTop && state.players[0].holoPower.some(item => item.id === previousDeckTop) && state.log.some(entry => entry.revealRefs?.some(item => item.id === mascot.id)) && publicRoomState(state, 1, cards).log.some(entry => entry.revealRefs?.some(item => item.id === mascot.id)));
  check('one top Cheer is sent to the selected own Gamer', state.players[0].zones.back2.cheer[0]?.id === topCheer && state.players[1].zones.center.cheer.length === 0);
  check('ineligible Event and Holomem remain in hand', state.players[0].hand.some(item => item.number === 'hBP01-105') && state.players[0].hand.some(item => item.number === 'hBP09-033'));

  const fanState = fixture(['hBP01-122']);
  const fanOnly = fanState.players[0].hand[0];
  let paidFan = pay(begin(fanState), fanOnly);
  paidFan = target(paidFan, 'collab');
  check('Fan alternative works and Mio can receive the top Cheer', paidFan.players[0].zones.collab.cheer.length === 1 && paidFan.players[0].mainDeck.some(item => item.id === fanOnly.id));

  const skipped = fixture(['hBP01-116']);
  const held = skipped.players[0].hand[0];
  let skippedResult = begin(skipped);
  skippedResult = act(skippedResult, { type: 'choose', skip: true }, skippedResult.pendingChoice.playerIndex);
  check('optional cost can be declined without payment or Cheer assignment', !skippedResult.pendingChoice && skippedResult.players[0].hand.some(item => item.id === held.id) && skippedResult.players[0].zones.collab.cheer.length === 0 && skippedResult.players[0].zones.back2.cheer.length === 0);

  const noPayment = begin(fixture(['hBP09-033']));
  check('no eligible hand card means the optional cost/effect does not start', !noPayment.pendingChoice && noPayment.players[0].hand.length === 1 && noPayment.players[0].zones.collab.cheer.length === 0 && noPayment.players[0].zones.back2.cheer.length === 0);

  const arts = fixture([]);
  const source = unit('hBP09-032', ['hY02-001']);
  arts.players[0].zones = { center: source, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  arts.phase = 'performance';
  const artsResult = act(arts, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  check('green 20 Arts settles normal damage and preserves its attached green Cheer', artsResult.players[1].zones.center.damage === 20 && artsResult.players[0].zones.center.rested && artsResult.players[0].zones.center.cheer.some(item => item.number === 'hY02-001'));

  const noCheer = fixture(['hBP01-116']);
  noCheer.players[0].cheerDeck = [];
  const noCheerCost = noCheer.players[0].hand[0];
  const noCheerResult = target(pay(begin(noCheer), noCheerCost), 'back2');
  check('an empty Cheer deck permits a legal target choice but creates no phantom Cheer after the cost resolves', !noCheerResult.pendingChoice && noCheerResult.players[0].mainDeck[0].id === noCheerCost.id && noCheerResult.players[0].zones.back2.cheer.length === 0);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-032';
