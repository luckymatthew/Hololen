import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
let state;
const instance = number => ({ id: `browser-hbp09-026-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name, turn) {
  return { name, oshi: instance('hBP09-002'),
    zones: { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [], cheerDeck: Array.from({ length: 8 }, () => instance('hY02-001')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY02-001')),
    turnsTaken: 1, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(turn), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function freshState({ firstPlayer = 1, turnsTaken = 1, searchedDeck = [] } = {}) {
  const turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : firstPlayer === 1 && turnsTaken === 1 ? 2 : 4;
  state = { status: 'playing', phase: 'main', turn, activePlayer: 0, firstPlayer,
    players: [player('Browser Audit', turn), player('Opponent', turn)], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [], lifeLosses: [] };
  state.players[0].turnsTaken = turnsTaken;
  state.players[0].zones.back1 = unit('hBP09-026');
  state.players[0].mainDeck = [instance('hBP09-026'), ...searchedDeck.map(instance)];
}

function countedRandom() {
  let calls = 0;
  return Object.assign(() => ((calls++ % 7) + 1) / 8, { count: () => calls });
}
function action(value, random) { state = applyAction(state, 0, value, cards, random); }
function fail(error) { status.textContent = `FAIL: ${String(error)}`; output.textContent = JSON.stringify({ pass: false, error: String(error), stack: error?.stack }, null, 2); }
function report(name, pass, details = {}) { status.textContent = `${pass ? 'PASS' : 'FAIL'}: ${name}`; output.textContent = JSON.stringify({ pass, name, ...details }, null, 2); }
function choose(ids, random) { action({ type: 'choose', cardIds: ids }, random); }

document.querySelector('#both').addEventListener('click', () => {
  try {
    const random = countedRandom();
    freshState({ searchedDeck: ['hBP09-025', 'hBP09-100', 'hBP09-104', 'hBP09-098'] });
    action({ type: 'collab', zone: 'back1' }, random);
    const first = state.pendingChoice;
    if (first?.type !== 'cardSelection' || first.cards[0]?.number !== 'hBP09-025' || random.count() !== 0) throw new Error('Expected Noel search first with no earlier deck shuffle.');
    choose([first.cards[0].id], random);
    const second = state.pendingChoice;
    if (second?.type !== 'cardSelection' || second.cards[0]?.number !== 'hBP09-100' || random.count() !== 0) throw new Error('Expected Gyudon search second; no shuffle is allowed between the two groups.');
    choose([second.cards[0].id], random);
    const expectedRandomCalls = state.players[0].mainDeck.length - 1;
    report('both printed search groups resolve before exactly one final shuffle', state.pendingChoice === null
      && new Set(state.players[0].hand.map(card => card.number)).size === 2
      && state.players[0].hand.some(card => card.number === 'hBP09-025')
      && state.players[0].hand.some(card => card.number === 'hBP09-100')
      && random.count() === expectedRandomCalls, {
      hand: state.players[0].hand.map(card => card.number), remainingDeckCount: state.players[0].mainDeck.length,
      expectedRandomCalls, actualRandomCalls: random.count(), pendingChoice: state.pendingChoice });
  } catch (error) { fail(error); }
});

document.querySelector('#partial').addEventListener('click', () => {
  try {
    const random = countedRandom();
    freshState({ searchedDeck: ['hBP09-100', 'hBP09-104', 'hBP09-098'] });
    action({ type: 'collab', zone: 'back1' }, random);
    const pending = state.pendingChoice;
    if (pending?.type !== 'cardSelection' || pending.cards[0]?.number !== 'hBP09-100' || random.count() !== 0) throw new Error('Missing Noel must advance to Gyudon without shuffling early.');
    choose([pending.cards[0].id], random);
    const expectedRandomCalls = state.players[0].mainDeck.length - 1;
    report('an unavailable Noel group is skipped; Gyudon resolves and the deck shuffles once at the end', state.pendingChoice === null
      && state.players[0].hand.some(card => card.number === 'hBP09-100')
      && random.count() === expectedRandomCalls, { hand: state.players[0].hand.map(card => card.number), expectedRandomCalls, actualRandomCalls: random.count() });
  } catch (error) { fail(error); }
});

document.querySelector('#none').addEventListener('click', () => {
  try {
    const random = countedRandom();
    freshState({ searchedDeck: ['hBP09-104', 'hBP09-098', 'hBP09-093'] });
    action({ type: 'collab', zone: 'back1' }, random);
    const expectedRandomCalls = state.players[0].mainDeck.length - 1;
    report('Q751: both searches miss but the effect still shuffles the deck exactly once', state.pendingChoice === null
      && state.players[0].hand.length === 0 && random.count() === expectedRandomCalls, {
      mainDeckCount: state.players[0].mainDeck.length, expectedRandomCalls, actualRandomCalls: random.count() });
  } catch (error) { fail(error); }
});

document.querySelector('#timing').addEventListener('click', () => {
  try {
    const cases = [];
    for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
      const random = countedRandom();
      freshState({ firstPlayer, turnsTaken, searchedDeck: ['hBP09-025', 'hBP09-100'] });
      action({ type: 'collab', zone: 'back1' }, random);
      cases.push({ firstPlayer, turnsTaken, pendingChoice: state.pendingChoice?.type || null,
        ordinaryCollabCompleted: state.players[0].zones.collab?.stack.at(-1).number === 'hBP09-026', randomCalls: random.count() });
    }
    const card = cardMap.get('hBP09-026');
    report('first-player first turn and second-player later turns do not search; normal Arts/catalog remain intact', cases.every(item => !item.pendingChoice && item.ordinaryCollabCompleted && item.randomCalls === 0)
      && card?.arts[0].damage === 20 && card.arts[0].cost[0] === '綠', { cases, arts: card?.arts[0] });
  } catch (error) { fail(error); }
});

try {
  const card = cardMap.get('hBP09-026');
  if (!card || card.keyword?.name !== 'マッスル・グレイス') throw new Error('Current website catalogue is missing official hBP09-026.');
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  output.textContent = JSON.stringify({ number: card.number, name: card.jpName, keyword: card.keyword.effect, arts: card.arts[0] }, null, 2);
} catch (error) { fail(error); }
