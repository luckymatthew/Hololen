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
const instance = number => ({ id: `browser-hbp09-091-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, modifiers: [], skipUnrestTurn: 0 });

function player(oshiNumber) {
  return {
    name: 'Browser Audit', oshi: instance(oshiNumber),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [], cheerDeck: [], archive: [], holoPower: [], life: [],
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function action(value) { state = applyAction(state, 0, value, cards, () => 0.25); }
function write(value) { output.textContent = JSON.stringify(value, null, 2); }
function fail(message, details) {
  status.textContent = `FAIL: ${message}`;
  choices.replaceChildren();
  write(details);
}

function renderPending() {
  const pending = state.pendingChoice;
  choices.replaceChildren();
  if (pending?.type === 'cardSelection') {
    if (pending.min !== 0 || pending.max !== 1 || pending.optional) {
      fail('the hidden-deck search must offer one matching card while allowing a fail-to-find choice.', { pendingChoice: pending });
      return;
    }
    status.textContent = `Choose a matching card or decline to find (${pending.cards[0]?.number} is available).`;
    const decline = document.createElement('button');
    decline.type = 'button';
    decline.textContent = 'Choose no card (fail to find)';
    decline.addEventListener('click', () => {
      action({ type: 'choose', cardIds: [] });
      write({ selected: [], nextChoice: state.pendingChoice?.type || null });
      renderPending();
    });
    choices.append(decline);
    for (const card of pending.cards) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Select ${cardMap.get(card.number)?.jpName || card.number} (${card.number})`;
      button.addEventListener('click', () => {
        action({ type: 'choose', cardIds: [card.id] });
        write({ selected: card.number, nextChoice: state.pendingChoice?.type || null });
        renderPending();
      });
      choices.append(button);
    }
  } else if (pending?.type === 'stageTarget') {
    status.textContent = 'Choose a free Back position for the searched Holomem.';
    for (const zone of pending.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Place in ${zone}`;
      button.addEventListener('click', () => {
        const placed = pending.cardNumber;
        action({ type: 'choose', zone });
        write({ placed: placed || null, position: zone, nextChoice: state.pendingChoice?.type || null });
        renderPending();
      });
      choices.append(button);
    }
  } else {
    const deployed = Object.entries(state.players[0].zones)
      .filter(([zone, unit]) => zone.startsWith('back') && unit && ['hBP09-071', 'hBP09-036'].includes(unit.stack.at(-1).number))
      .map(([zone, unit]) => ({ zone, number: unit.stack.at(-1).number, stackDepth: unit.stack.length }));
    const bothFound = deployed.some(unit => unit.number === 'hBP09-071') && deployed.some(unit => unit.number === 'hBP09-036');
    const failedToFindThenFound = state.players[0].mainDeck.some(card => card.number === 'hBP09-071')
      && deployed.some(unit => unit.number === 'hBP09-036');
    const pass = state.pendingChoice === null && deployed.every(unit => unit.stackDepth === 1)
      && (bothFound || failedToFindThenFound)
      && state.players[0].archive.some(card => card.number === 'hBP09-091');
    status.textContent = pass
      ? failedToFindThenFound
        ? 'PASS: the player declined to find AZKi; the next Iroha search still resolved and directly staged its selected target.'
        : 'PASS: both selected 1st Holomen were directly staged without either talent already on stage.'
      : 'FAIL: final selected and deployed cards do not match the official text.';
    write({ pass, deployed, unselectedAZKiRemainsInDeck: state.players[0].mainDeck.some(card => card.number === 'hBP09-071'), supportArchived: state.players[0].archive.some(card => card.number === 'hBP09-091'), pendingChoice: state.pendingChoice });
  }
}

function run() {
  choices.replaceChildren();
  state = {
    status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 0,
    players: [player('hBP07-006'), player('hBP09-002')], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [{ turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'opponent-turn triggered effect' }], lifeLosses: [],
  };
  state.players[0].zones.center = unit('hBP09-064');
  state.players[0].mainDeck = [instance('hBP09-071'), instance('hBP09-036'), ...Array.from({ length: 10 }, () => instance('hBP09-051'))];
  const support = instance('hBP09-091');
  state.players[0].hand.push(support);
  try {
    action({ type: 'play', cardId: support.id });
    renderPending();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), { error: String(error) });
  }
}

try {
  const card = cardMap.get('hBP09-091');
  if (!card || !card.abilityText?.includes('前の相手のターン')) throw new Error('Current catalog is missing the hBP09-091 Japanese rule text.');
  document.querySelector('#run').addEventListener('click', run);
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  write({ number: card.number, japaneseText: card.abilityText, oshi: 'hBP07-006', previousTurnDownOwner: 0, previousTurnDownSource: 0, firstCardsInDeck: ['hBP09-071', 'hBP09-036'] });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error), { error: String(error) });
}
