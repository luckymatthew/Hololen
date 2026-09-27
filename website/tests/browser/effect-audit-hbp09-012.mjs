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
let bloomProof;
const instance = number => ({ id: `browser-hbp09-012-${++serial}`, number });
const unit = number => ({
  stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(oshiNumber = 'hBP09-001') {
  return {
    name: 'Browser Audit', oshi: instance(oshiNumber),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 16 }, () => instance('hBP09-051')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-015')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8),
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState(phase) {
  return {
    status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 0,
    players: [player(), player('hBP09-002')], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [], lifeLosses: [],
  };
}

function action(value) {
  state = applyAction(state, 0, value, cards, () => 0.25);
}

function write(value) { output.textContent = JSON.stringify(value, null, 2); }

function runBloom() {
  choices.replaceChildren();
  state = baseState('main');
  state.players[0].oshi = instance('hBP09-001');
  state.players[0].zones.center = unit('hBP09-009');
  state.players[0].zones.back1 = unit('hBP09-009');
  state.players[0].zones.back2 = unit('hBP09-009');
  state.players[1].holoPower = [instance('hBP09-051'), instance('hBP09-052')];
  state.players[0].hand = [instance('hBP09-012'), instance('hBP09-012'), instance('hBP09-012')];
  bloomProof = { initialDeckTop: state.players[0].mainDeck[0].id, initialPower: state.players[0].holoPower.length };
  action({ type: 'play', cardId: state.players[0].hand[0].id });
  const pending = state.pendingChoice;
  if (pending?.type !== 'bloom' || pending.playerIndex !== 0 || !pending.options.includes('center')) {
    status.textContent = 'FAIL: expected the real Bloom target choice.';
    write({ pendingChoice: pending });
    return;
  }
  status.textContent = 'Choose Center to resolve Bloom and its Oshi/Power-gated effect.';
  for (const zone of pending.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Bloom to ${zone}`;
    button.addEventListener('click', () => {
      action({ type: 'choose', zone });
      const firstGain = state.players[0].holoPower.at(-1)?.id === bloomProof.initialDeckTop;
      const onceKey = state.players[0].namedUsageTurns['hbp09:BIG3-side-S'];
      const secondCard = state.players[0].hand.find(card => card.number === 'hBP09-012');
      action({ type: 'play', cardId: secondCard.id });
      if (state.pendingChoice?.type !== 'bloom') {
        status.textContent = 'FAIL: second copy could not reach Bloom target choice.';
        write({ pendingChoice: state.pendingChoice, afterFirst: firstGain, onceKey });
        return;
      }
      action({ type: 'choose', zone: 'back1' });
      const noDuplicate = state.players[0].holoPower.length === bloomProof.initialPower + 1;
      state.turn += 1;
      state.players[0].turnEvents = turnEvents(state.turn);
      const thirdCard = state.players[0].hand.find(card => card.number === 'hBP09-012');
      action({ type: 'play', cardId: thirdCard.id });
      action({ type: 'choose', zone: 'back2' });
      const nextTurnWorks = state.players[0].holoPower.length === bloomProof.initialPower + 2;
      const pass = firstGain && onceKey === 8 && noDuplicate && nextTurnWorks && state.pendingChoice === null;
      status.textContent = pass ? 'PASS: eligible top card moved to Holo Power, same-turn copy did not repeat, next turn refreshed.' : 'FAIL: Bloom gate, use counter, or next-turn reset differs from expected behavior.';
      choices.replaceChildren();
      write({ pass, firstGain, usedTurn: onceKey, noDuplicate, nextTurnWorks, holoPowerIds: state.players[0].holoPower.map(card => card.id), mainDeckLength: state.players[0].mainDeck.length, pendingChoice: state.pendingChoice });
    });
    choices.append(button);
  }
  write({ pendingChoiceType: pending.type, bloomTargets: pending.options, initialOpposingHoloPower: state.players[1].holoPower.length });
}

function runArts() {
  choices.replaceChildren();
  state = baseState('performance');
  const source = unit('hBP09-009');
  source.stack.push(instance('hBP09-012'));
  source.bloomedTurn = 7;
  source.cheer = [instance('hY01-001'), instance('hY01-001'), instance('hY01-001')];
  state.players[0].zones.center = source;
  state.players[1].zones.center = unit('hBP02-017');
  state.knockouts = [{ turn: 7, ownerIndex: 0, sourcePlayerIndex: 0, sourceName: 'opponent-turn triggered effect' }];
  action({ type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const damage = state.players[1].zones.center?.damage;
  const pass = damage === 130;
  status.textContent = pass ? 'PASS: prior own Down grants +50 Arts despite the source metadata.' : 'FAIL: Arts result differs from the expected 130.';
  write({ pass, printedDamage: cardMap.get('hBP09-012')?.arts?.[0]?.damage, priorDown: state.knockouts[0], targetDamage: damage, expectedDamage: 130, pendingChoice: state.pendingChoice });
}

try {
  const card = cardMap.get('hBP09-012');
  if (!card || card.keyword?.type !== 'bloom' || card.arts?.[0]?.damage !== 80) throw new Error('Current catalog is missing the hBP09-012 Bloom/Arts entries.');
  document.querySelector('#run-bloom').addEventListener('click', runBloom);
  document.querySelector('#run-arts').addEventListener('click', runArts);
  status.textContent = `Ready: current catalog has ${card.variants.length} canonical hBP09-012 printings.`;
  write({ number: card.number, printings: card.variants.map(variant => variant.id), bloom: card.keyword.effect, arts: card.arts[0] });
} catch (error) {
  status.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  write({ error: String(error) });
}
