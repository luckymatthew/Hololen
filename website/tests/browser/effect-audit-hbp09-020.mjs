import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error('Could not load current cards.json (' + response.status + ')');
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-020');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: 'browser-hbp09-020-' + (++serial), number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name) {
  return { name, oshi: instance('hBP09-002'), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: Array.from({ length: 10 }, () => instance('hY01-001')), life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function artsFixture(target = 'hBP02-047') {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = unit('hBP01-017', ['hY01-001']); // Its second Arts costs White + Colorless.
  players[0].zones.collab = unit('hBP09-020', ['hY01-001']);
  players[0].zones.collab.collabbedTurn = 8;
  players[0].collabTurn = 8;
  players[0].zones.back1 = unit('hBP09-018');
  players[1].zones.center = unit(target);
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function resetFixture(number) {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = unit('hBP09-018');
  players[0].zones.collab = unit(number, ['hY01-001']);
  players[0].zones.collab.rested = true;
  players[0].collabTurn = 7;
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 1, firstPlayer: 0, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function act(state, action, playerIndex = state.activePlayer) {
  return applyAction(state, playerIndex, action, cards, () => 0.5);
}

function settle(state, limit = 80) {
  for (let i = 0; state.pendingChoice && i < limit; i++) {
    const pending = state.pendingChoice;
    let answer;
    if (pending.type === 'cardSelection') answer = { cardIds: pending.selectableIds.slice(0, pending.min || 0) };
    else if (pending.type === 'optionChoice' && pending.optional) answer = { skip: true };
    else answer = { zone: pending.options?.[0], targetZone: pending.options?.[0] };
    state = act(state, { type: 'choose', ...answer }, pending.playerIndex);
  }
  if (state.pendingChoice) throw new Error('A pending choice did not resolve: ' + state.pendingChoice.type);
  return state;
}

function run() {
  if (!card) throw new Error('hBP09-020 is missing from the packaged current catalogue.');

  const purple = artsFixture('hBP02-047');
  const centerCheerId = purple.players[0].zones.center.cheer[0].id;
  let state = act(purple, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const purpleDamage = state.players[1].zones.center.damage;
  const reduction = state.players[0].zones.center.modifiers.find(item => item.kind === 'artCost:white');
  const collabCostRemains = state.players[0].zones.collab.cheer.length === 1;
  state = act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' });
  const discountedArtsDidNotArchiveCheer = state.players[0].zones.center.cheer[0].id === centerCheerId;

  const white = act(artsFixture('hBP02-014'), { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const whiteDamage = white.players[1].zones.center.damage;

  // Advance through actual turn boundaries and assign the automatic Cheer to
  // Back, keeping exactly one Cheer on the Center after the modifier expires.
  state = settle(act(state, { type: 'advance' }, 0));
  state = settle(act(state, { type: 'advance' }, 1));
  state = act(state, { type: 'advance' }, 1);
  const newTurn = state.turn;
  const pending = state.pendingChoice;
  if (pending?.type !== 'cheerTarget' || !pending.options.includes('back1')) throw new Error('New-turn Cheer placement choice did not offer Back.');
  state = act(state, { type: 'choose', zone: 'back1' }, 0);
  state = act(state, { type: 'advance' }, 0);
  let expiredArtsRejected = false;
  try { act(state, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' }, 0); }
  catch { expiredArtsRejected = true; }

  const resetResults = ['hBP09-020', 'hBP09-018'].map(number => {
    const result = act(resetFixture(number), { type: 'advance' }, 1);
    return { number, movedToBack: result.players[0].zones.collab === null && result.players[0].zones.back1.stack.at(-1).number === number, rested: result.players[0].zones.back1.rested };
  });
  const checks = [
    { name: 'Purple +50 adds to 60 Arts damage only against Purple', pass: purpleDamage === 110 && whiteDamage === 60 },
    { name: 'Collab-only effect reduces Center White by one and preserves the Colorless requirement', pass: reduction?.amount === -1 && reduction.expiresTurn === 8 && discountedArtsDidNotArchiveCheer && collabCostRemains },
    { name: 'turn-scoped cost reduction expires after the actual turn boundary', pass: newTurn > reduction.expiresTurn && expiredArtsRejected },
    { name: 'Gift keeps hBP09-020 active after Reset Step while ordinary hBP09-018 rests', pass: resetResults[0].movedToBack && !resetResults[0].rested && resetResults[1].movedToBack && resetResults[1].rested },
    { name: 'catalog retains U/S printings and exact Japanese ability text', pass: ['hbp09-hBP09-020_U', 'hbp09-hBP09-020_S'].every(id => card.variants.some(variant => variant.id === id)) && card.keyword.effect === 'このホロメンはリセットステップでお休みしない。' && card.arts[0].effect === '[コラボポジション限定]このターンの間、自分のセンターホロメンのアーツに必要な白-1。' },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = (passed === checks.length ? 'PASS ' : 'FAIL ') + passed + '/' + checks.length;
  output.textContent = JSON.stringify({ checks, detail: { purpleDamage, whiteDamage, reduction, centerCheerAfterDiscountedArts: state.players[0].zones.center.cheer.length, newTurn, resetResults, variants: card.variants.map(item => item.id) } }, null, 2);
  if (passed !== checks.length) throw new Error(passed + '/' + checks.length + ' browser assertions passed');
  return { passed, total: checks.length, checks };
}

document.querySelector('#run').addEventListener('click', () => {
  try { const result = run(); window.__effectAudit = result; }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});

status.textContent = card ? 'Ready: ' + card.number + ' · ' + card.jpName : 'FAIL: current catalogue is missing hBP09-020';
