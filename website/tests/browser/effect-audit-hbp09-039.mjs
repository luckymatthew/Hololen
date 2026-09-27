import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const catalog = (await response.json()).cards;
const card = catalog.find(entry => entry.number === 'hBP09-039');
const toolNumbers = ['hBP09-106', 'hBP09-107', 'hBP09-108'];
let serial = 0;
const instance = number => ({ id: `browser-hbp09-039-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function fixture({ firstPlayer = 1, turnsTaken = 1, tools = toolNumbers, performance = false } = {}) {
  const player = name => ({
    name, oshi: instance('hSD10-001'),
    zones: { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [instance('hBP09-051'), ...tools.map(instance), instance('hBP09-051')],
    cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 1, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] },
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
  });
  const state = { status: 'playing', phase: performance ? 'performance' : 'main', turn: 1, activePlayer: 0, firstPlayer,
    players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.back1 = unit('hBP09-039');
  state.players[1].zones.center = unit('hBP09-064');
  if (performance) {
    state.players[0].zones.collab = unit('hBP09-039');
    state.players[0].zones.collab.cheer = [instance('hY01-015')];
    state.players[0].zones.back1 = null;
  }
  return state;
}

function run() {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalog matches official Japanese identity, second-player first-turn text, and colorless 20 Arts',
    card?.jpName === 'カエラ・コヴァルスキア' && card.stage === 'Debut' && card.hp === 130 &&
    card.keyword?.effect === '自分が後攻で最初のターンなら、自分のデッキから、ツール2枚を公開し、手札に加える。そしてデッキをシャッフルする。' &&
    card.arts?.[0]?.damage === 20 && card.arts[0].cost.join() === '無色');

  let state = applyAction(fixture(), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('second player first-turn Collab requires one Tool choice and permits up to two',
    state.pendingChoice?.type === 'cardSelection' && state.pendingChoice.min === 1 && state.pendingChoice.max === 2 &&
    state.pendingChoice.cards.length === 3 && state.pendingChoice.cards.every(item => toolNumbers.includes(item.number)));

  state = applyAction(fixture(), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  const selectedOne = state.pendingChoice?.cards?.[0];
  state = applyAction(state, 0, { type: 'choose', cardIds: [selectedOne?.id] }, catalog, () => 0.4);
  check('one selected Tool is revealed and added while the ordinary Collab card goes to Holo Power',
    !!selectedOne && state.players[0].hand.some(item => item.id === selectedOne.id) && state.players[0].holoPower.length === 1 && state.players[0].mainDeck.length === 3 &&
    state.log.some(entry => JSON.stringify(entry).includes(selectedOne.id)));

  state = applyAction(fixture(), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  const selectedTwo = state.pendingChoice?.cards?.slice(0, 2) || [];
  state = applyAction(state, 0, { type: 'choose', cardIds: selectedTwo.map(item => item.id) }, catalog, () => 0.4);
  check('two selected Tools are both added and removed from the deck', selectedTwo.length === 2 && selectedTwo.every(chosen => state.players[0].hand.some(item => item.id === chosen.id)) && state.players[0].mainDeck.length === 2);

  state = applyAction(fixture({ tools: ['hBP09-106'] }), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  const onlyTool = state.pendingChoice?.cards?.[0];
  check('one matching Tool remains selectable when fewer than two are in the deck', state.pendingChoice?.min === 1 && state.pendingChoice?.max === 1 && onlyTool?.number === 'hBP09-106');

  let shuffleCalls = 0;
  const noToolState = fixture({ tools: [] });
  noToolState.players[0].mainDeck = Array.from({ length: 6 }, () => instance('hBP09-051'));
  state = applyAction(noToolState, 0, { type: 'collab', zone: 'back1' }, catalog, () => { shuffleCalls += 1; return 0.4; });
  check('no matching Tool creates no card selection but still shuffles the remaining deck', state.pendingChoice === null && state.players[0].hand.length === 0 && state.players[0].mainDeck.length === 5 && state.players[0].holoPower.length === 1 && shuffleCalls > 0);

  const firstPlayer = applyAction(fixture({ firstPlayer: 0 }), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  const laterTurn = applyAction(fixture({ turnsTaken: 2 }), 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('first-player first turn and a later second-player turn do not prompt for Tools', firstPlayer.pendingChoice === null && laterTurn.pendingChoice === null);

  state = applyAction(fixture({ performance: true }), 0, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, catalog, () => 0.4);
  check('colorless 20 Arts damages the target, rests Kaela, and keeps its Cheer', state.players[1].zones.center.damage === 20 && state.players[0].zones.collab.rested && state.players[0].zones.collab.cheer.length === 1);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) {
    document.querySelector('#status').textContent = 'FAIL';
    document.querySelector('#result').textContent = String(error?.stack || error);
    window.__effectAudit = { error: String(error?.stack || error) };
  }
});
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalogue is missing hBP09-039';
