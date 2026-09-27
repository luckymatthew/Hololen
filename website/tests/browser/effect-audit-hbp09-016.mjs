import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const eligibleNumbers = [...new Set(cards.filter(card => card.group === 'holomem' && card.jpName === '轟はじめ' && Number(card.baton || 0) === 1).map(card => card.number))].sort();
const status = document.querySelector('#status');
const output = document.querySelector('#result');
const choices = document.querySelector('#choices');
let serial = 0;
let state;
const instance = number => ({ id: `browser-hbp09-016-${++serial}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name, turn) {
  return {
    name, oshi: instance('hBP09-002'),
    zones: { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-015')),
    turnsTaken: 2, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(turn),
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState({ firstPlayer = 1, turnsTaken = 1, phase = 'main' } = {}) {
  const turn = firstPlayer === 0 && turnsTaken === 1 ? 1 : turnsTaken === 1 ? 2 : 4;
  const own = player('Browser Audit', turn);
  const rival = player('Opponent', turn);
  own.turnsTaken = turnsTaken;
  rival.turnsTaken = firstPlayer === 1 && turnsTaken === 1 ? 1 : 2;
  return { status: 'playing', phase, turn, activePlayer: 0, firstPlayer,
    players: [own, rival], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function collabFixture({ firstPlayer = 1, turnsTaken = 1, matching = eligibleNumbers } = {}) {
  state = baseState({ firstPlayer, turnsTaken });
  state.players[0].zones.back1 = unit('hBP09-016');
  state.players[0].mainDeck = [instance('hBP09-016'), ...matching.map(instance), instance('hBP09-017'), instance('hBP09-020'), instance('hBP03-015')];
}
function action(value) { state = applyAction(state, 0, value, cards, () => 0.25); }
function write(value) { output.textContent = JSON.stringify(value, null, 2); }
function report(name, pass, details) { status.textContent = `${pass ? 'PASS' : 'FAIL'}: ${name}`; write({ pass, name, ...details }); }
function fail(error) { status.textContent = `FAIL: ${String(error)}`; write({ pass: false, error: String(error), stack: error?.stack }); }

document.querySelector('#find').addEventListener('click', () => {
  try {
    choices.replaceChildren();
    collabFixture();
    const collabPower = state.players[0].mainDeck[0];
    action({ type: 'collab', zone: 'back1' });
    const pending = state.pendingChoice;
    if (pending?.type !== 'cardSelection' || pending.min !== 1 || pending.max !== 2) throw new Error('Expected a required one-to-two search on the second player first turn.');
    const choose = document.createElement('button');
    choose.type = 'button'; choose.textContent = 'Choose hBP09-015 and hBP09-018';
    choose.addEventListener('click', () => {
      try {
        const ids = pending.cards.filter(card => ['hBP09-015', 'hBP09-018'].includes(card.number)).map(card => card.id);
        action({ type: 'choose', cardIds: ids });
        const pass = state.pendingChoice === null && ids.every(id => state.players[0].hand.some(card => card.id === id))
          && state.players[0].mainDeck.some(card => card.number === 'hSD05-002')
          && state.players[0].holoPower.at(-1)?.id === collabPower.id;
        report('exact Baton-1 Hajime targets enter hand; starter match remains; ordinary Collab Holo Power is preserved', pass, {
          selectable: pending.cards.map(card => card.number), addedToHand: ids,
          starterMatchRemaining: state.players[0].mainDeck.some(card => card.number === 'hSD05-002'),
          collabPowerId: state.players[0].holoPower.at(-1)?.id,
          pendingChoice: state.pendingChoice,
        });
        choices.replaceChildren();
      } catch (error) { fail(error); }
    });
    choices.append(choose);
    status.textContent = 'Choose two matching Holomem; one is allowed when only one is available.';
    write({ pendingChoiceType: pending.type, min: pending.min, max: pending.max, selectable: pending.cards.map(card => card.number), collabPowerId: collabPower.id });
  } catch (error) { fail(error); }
});

document.querySelector('#nomatch').addEventListener('click', () => {
  try {
    choices.replaceChildren();
    collabFixture({ matching: [] });
    action({ type: 'collab', zone: 'back1' });
    const pass = state.pendingChoice === null && state.players[0].mainDeck.every(card => !eligibleNumbers.includes(card.number));
    report('no eligible Hajime means the mandatory search completes without a choice', pass, {
      remainingDeck: state.players[0].mainDeck.map(card => card.number), pendingChoice: state.pendingChoice,
    });
  } catch (error) { fail(error); }
});

document.querySelector('#single').addEventListener('click', () => {
  try {
    choices.replaceChildren();
    collabFixture({ matching: ['hSD05-002'] });
    action({ type: 'collab', zone: 'back1' });
    const pending = state.pendingChoice;
    const target = pending?.cards?.[0];
    if (pending?.max !== 1 || target?.number !== 'hSD05-002') throw new Error('Expected the only eligible starter match, capped to one selection.');
    action({ type: 'choose', cardIds: [target.id] });
    report('a single matching starter Holomem can be selected', state.pendingChoice === null && state.players[0].hand.some(card => card.id === target.id), {
      selected: target.number, handContainsSelected: state.players[0].hand.some(card => card.id === target.id),
      remainingMax: pending.max,
    });
  } catch (error) { fail(error); }
});

document.querySelector('#outside').addEventListener('click', () => {
  try {
    const cases = [];
    for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
      collabFixture({ firstPlayer, turnsTaken });
      action({ type: 'collab', zone: 'back1' });
      cases.push({ firstPlayer, turnsTaken, hasSearchChoice: state.pendingChoice !== null, collabCompleted: state.players[0].zones.collab.stack.at(-1).number === 'hBP09-016' });
    }
    report('first-player first turn and later second-player turn do not activate the Collab Effect', cases.every(item => !item.hasSearchChoice && item.collabCompleted), { cases });
  } catch (error) { fail(error); }
});

document.querySelector('#arts').addEventListener('click', () => {
  try {
    state = baseState({ firstPlayer: 1, turnsTaken: 1, phase: 'performance' });
    const cheer = instance('hY01-015');
    state.players[0].zones.center = unit('hBP09-016', [cheer]);
    action({ type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
    report('vanilla one-Colorless Arts deals its printed 30 and does not archive its cost', state.players[1].zones.center.damage === 30
      && state.players[0].zones.center.cheer.some(card => card.id === cheer.id), {
      damage: state.players[1].zones.center.damage, cheerRetained: state.players[0].zones.center.cheer.some(card => card.id === cheer.id),
    });
  } catch (error) { fail(error); }
});

try {
  const card = cardMap.get('hBP09-016');
  if (!card || card.keyword?.type !== 'collab' || eligibleNumbers.length < 2) throw new Error('Current catalog lacks the expected hBP09-016 Collab or Baton-1 Hajime search pool.');
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  write({ number: card.number, name: card.jpName, keyword: card.keyword.effect, arts: card.arts[0], searchableHajimeNumbers: eligibleNumbers });
} catch (error) { fail(error); }
