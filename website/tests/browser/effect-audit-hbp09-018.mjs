import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error('Could not load current cards.json (' + response.status + ')');
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-018');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let sequence = 0;
const instance = number => ({ id: 'browser-hbp09-018-' + (++sequence), number });
const unit = (number, energy = 0) => ({ stack: [instance(number)], cheer: Array.from({ length: energy }, () => instance('hY01-015')), attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name) {
  return { name, oshi: instance('hBP09-002'), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')), archive: [], holoPower: Array.from({ length: 10 }, () => instance('hY01-015')), life: Array.from({ length: 5 }, () => instance('hY01-015')), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function fixture({ bloomZone = 'center', deckCount = 3 } = {}) {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = unit(bloomZone === 'center' ? 'hBP09-015' : 'hBP09-064');
  players[0].zones.back1 = bloomZone === 'back1' ? unit('hBP09-015') : null;
  players[0].hand = [instance('hBP09-018')];
  players[0].mainDeck = ['hBP09-016', 'hBP09-017', 'hBP09-020'].slice(0, deckCount).map(instance);
  players[1].zones.center = unit('hBP09-064');
  players[1].zones.back1 = unit('hBP09-064');
  return { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function bloom(zone, deckCount = 3) {
  let state = fixture({ bloomZone: zone, deckCount });
  const expected = state.players[0].mainDeck.slice(0, 2).map(card => card.id);
  state = applyAction(state, 0, { type: 'play', cardId: state.players[0].hand[0].id }, cards, () => 0.5);
  if (state.pendingChoice?.type !== 'bloom' || !state.pendingChoice.options.includes(zone)) throw new Error('Bloom did not present the specified legal position.');
  state = JSON.parse(JSON.stringify(state));
  state = applyAction(state, state.pendingChoice.playerIndex, { type: 'choose', zone }, cards, () => 0.5);
  return { drawn: state.players[0].hand.map(item => item.id), expected: expected.slice(0, deckCount), deckCount: state.players[0].mainDeck.length, status: state.status, bloomTop: state.players[0].zones[zone].stack.at(-1).number };
}

function arts(sourceZone) {
  const state = fixture();
  state.phase = 'performance';
  state.players[0].zones.center = sourceZone === 'center' ? unit('hBP09-018', 1) : unit('hBP09-064', 1);
  state.players[0].zones.collab = sourceZone === 'collab' ? unit('hBP09-018', 1) : null;
  if (sourceZone === 'collab') { state.players[0].zones.collab.collabbedTurn = state.turn; state.players[0].collabTurn = state.turn; }
  state.players[0].turnEvents = turnEvents(state.turn);
  const settled = applyAction(state, 0, { type: 'attack', sourceZone, artIndex: 0, targetZone: 'center' }, cards, () => 0.5);
  return settled.players[1].zones.center.damage;
}

document.querySelector('#run').addEventListener('click', () => {
  try {
    if (!card) throw new Error('hBP09-018 is missing from the current card catalogue.');
    const center = bloom('center');
    const back = bloom('back1');
    const one = bloom('center', 1);
    const empty = bloom('center', 0);
    const centerArts = arts('center');
    const collabArts = arts('collab');
    const checks = [
      { name: 'Center Bloom draws the top two once across save/reload', pass: center.drawn.length === 2 && center.expected.length === 2 && center.drawn.every((id, index) => id === center.expected[index]) && center.deckCount === 1 && center.bloomTop === 'hBP09-018' },
      { name: 'Back Bloom does not draw', pass: back.drawn.length === 0 && back.deckCount === 3 && back.bloomTop === 'hBP09-018' },
      { name: 'one-card deck draws the one available card', pass: one.drawn.length === 1 && one.expected.length === 1 && one.status === 'playing' },
      { name: 'empty deck draw effect does not cause turn-draw loss', pass: empty.drawn.length === 0 && empty.status === 'playing' },
      { name: 'Center Arts deals printed 30', pass: centerArts === 30 },
      { name: 'Collab Arts deals 50 including its +20', pass: collabArts === 50 },
      { name: 'catalog has matching C/S variants and official Japanese clauses', pass: card.variants.map(variant => variant.id).includes('hbp09-hBP09-018_C') && card.variants.map(variant => variant.id).includes('hbp09-hBP09-018_S') && card.keyword.effect === '[センターポジション限定]自分のデッキを2枚引く。' && card.arts[0].effect === '[コラボポジション限定]このアーツ+20。' },
    ];
    const passed = checks.filter(check => check.pass).length;
    status.textContent = (passed === checks.length ? 'PASS ' : 'FAIL ') + passed + '/' + checks.length;
    output.textContent = JSON.stringify({ checks, detail: { centerBloom: center, backBloom: back, oneCardDraw: one, emptyDeckDraw: empty, centerArts, collabArts, variants: card.variants.map(variant => variant.id) } }, null, 2);
  } catch (error) {
    status.textContent = 'FAIL';
    output.textContent = String(error?.stack || error);
  }
});

status.textContent = card ? 'Ready: ' + card.number + ' · ' + card.jpName : 'FAIL: current catalogue is missing hBP09-018';
