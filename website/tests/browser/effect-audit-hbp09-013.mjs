import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const choices = document.querySelector('#choices');
const output = document.querySelector('#result');
let serial = 0;
let state;
const instance = number => ({ id: `browser-hbp09-013-${++serial}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = () => ({ turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player() {
  return {
    name: 'Browser Audit', oshi: instance('hBP09-002'),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-015')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(),
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState(phase) {
  return { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 0,
    players: [player(), player()], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function action(value, random = () => 0.25) { state = applyAction(state, 0, value, cards, random); }
function write(value) { output.textContent = JSON.stringify(value, null, 2); }
function fail(message, details) {
  status.textContent = `FAIL: ${message}`;
  choices.replaceChildren();
  write(details);
}

function collabFixture(noMatch = false) {
  state = baseState('main');
  state.players[0].zones.back1 = unit('hBP09-013');
  state.players[0].mainDeck = (noMatch
    ? ['hBP09-051', 'hBP09-098', 'hBP09-051', 'hBP09-051']
    : ['hBP09-051', 'hBP09-094', 'hBP09-099', 'hBP09-098', 'hBP09-051', 'hBP09-051']).map(instance);
}

function runCollab(find) {
  choices.replaceChildren();
  collabFixture(!find);
  const collabPower = state.players[0].mainDeck[0];
  let randomCalls = 0;
  action({ type: 'collab', zone: 'back1' }, () => { randomCalls += 1; return 0.25; });
  const pending = state.pendingChoice;
  if (find && (pending?.type !== 'cardSelection' || pending.min !== 1 || pending.max !== 1 || pending.optional)) {
    fail('expected a required one-card choice among the two named Supports.', { pendingChoice: pending });
    return;
  }
  if (!find) {
    const pass = pending === null && randomCalls > 0 && state.players[0].holoPower.at(-1)?.id === collabPower.id
      && state.players[0].mainDeck.every(card => !['hBP09-094', 'hBP09-099'].includes(card.number));
    status.textContent = pass ? 'PASS: no choice was opened; Collab Holo Power was placed; the written shuffle ran.' : 'FAIL: no-match resolution did not finish and shuffle.';
    write({ pass, pendingChoice: pending, randomCalls, collabPowerId: state.players[0].holoPower.at(-1)?.id, remainingMainDeck: state.players[0].mainDeck.map(card => card.number) });
    return;
  }
  status.textContent = 'Choose one matching Support; zero choices are rejected.';
  for (const card of pending.cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Select ${cardMap.get(card.number)?.jpName || card.number} (${card.number})`;
    button.addEventListener('click', () => {
      action({ type: 'choose', cardIds: [card.id] });
      const selectedInHand = state.players[0].hand.some(item => item.id === card.id);
      const otherNamedRemains = state.players[0].mainDeck.some(item => item.number !== card.number && ['hBP09-094', 'hBP09-099'].includes(item.number));
      const pass = state.pendingChoice === null && selectedInHand && otherNamedRemains
        && state.players[0].holoPower.at(-1)?.id === collabPower.id;
      status.textContent = pass ? 'PASS: selected Support entered hand, other named Support stayed in deck, and Collab Holo Power was preserved.' : 'FAIL: selected Support or deck result differs from the card text.';
      choices.replaceChildren();
      write({ pass, selected: card.number, selectedInHand, otherNamedRemainsInDeck: otherNamedRemains, collabPowerId: state.players[0].holoPower.at(-1)?.id, remainingMainDeck: state.players[0].mainDeck.map(item => item.number), pendingChoice: state.pendingChoice });
    });
    choices.append(button);
  }
  write({ pendingChoiceType: pending.type, min: pending.min, max: pending.max, selectable: pending.cards.map(card => card.number), collabPowerId: collabPower.id });
}

function runArts(targetNumber, expectedDamage) {
  choices.replaceChildren();
  state = baseState('performance');
  state.players[0].zones.center = unit('hBP09-013', [instance('hY01-015'), instance('hY01-001'), instance('hY01-002')]);
  state.players[1].zones.center = unit(targetNumber);
  action({ type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const actual = state.players[1].zones.center.damage;
  const pass = actual === expectedDamage;
  status.textContent = pass ? `PASS: ${targetNumber} received ${actual} Arts damage.` : `FAIL: expected ${expectedDamage}, received ${actual}.`;
  write({ pass, targetNumber, targetColors: cardMap.get(targetNumber)?.colors, actualDamage: actual, expectedDamage, arts: cardMap.get('hBP09-013')?.arts?.[0] });
}

try {
  const card = cardMap.get('hBP09-013');
  if (!card || card.keyword?.type !== 'collab' || card.arts?.[0]?.damage !== 100) throw new Error('Current catalog is missing hBP09-013 Collab or Arts fields.');
  if (!cardMap.get('hBP01-067')?.colors?.includes('紅') || !cardMap.get('hBP01-081')?.colors?.includes('藍')) throw new Error('Current catalog is missing red/blue Arts controls.');
  document.querySelector('#find').addEventListener('click', () => runCollab(true));
  document.querySelector('#nomatch').addEventListener('click', () => runCollab(false));
  document.querySelector('#red').addEventListener('click', () => runArts('hBP01-067', 150));
  document.querySelector('#blue').addEventListener('click', () => runArts('hBP01-081', 100));
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  write({ number: card.number, name: card.jpName, collab: card.keyword.effect, arts: card.arts[0], colorTargets: ['hBP01-067', 'hBP01-081'] });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), { error: String(error) });
}
