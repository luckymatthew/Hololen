import { applyAction, isActionCandidateLegal } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
let state;
const instance = number => ({ id: `browser-hbp09-015-${++serial}`, number });
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

function baseState(phase = 'main') {
  return { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 0,
    players: [player(), player()], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function clickAction(action) { state = applyAction(state, 0, action, cards, () => 0.25); }
function result(name, pass, details) {
  status.textContent = `${pass ? 'PASS' : 'FAIL'}: ${name}`;
  output.textContent = JSON.stringify({ pass, name, ...details }, null, 2);
}
function handler(id, run) {
  document.querySelector(id).addEventListener('click', () => {
    try { run(); }
    catch (error) {
      status.textContent = `FAIL: ${id} threw`;
      output.textContent = JSON.stringify({ pass: false, error: String(error), stack: error?.stack }, null, 2);
    }
  });
}

handler('#discount', () => {
  state = baseState();
  state.players[0].zones.center = unit('hBP09-015');
  state.players[0].zones.back1 = unit('hBP09-016');
  state.players[0].zones.collab = unit('hBP09-017');
  state.players[1].zones.center = unit('hBP09-064');
  for (let i = 1; i <= 4; i += 1) state.players[1].zones[`back${i}`] = unit('hBP09-017');
  const beforeArchiveCount = state.players[0].archive.filter(card => card.number.startsWith('hY')).length;
  const legal = isActionCandidateLegal(state, 0, { type: 'baton', zone: 'back1' }, cards);
  clickAction({ type: 'baton', zone: 'back1' });
  const passed = legal && state.players[0].zones.center.stack.at(-1).number === 'hBP09-016'
    && state.players[0].zones.back1.stack.at(-1).number === 'hBP09-015'
    && state.players[0].archive.filter(card => card.number.startsWith('hY')).length === beforeArchiveCount;
  result('three own Holomem including Collab reduce hBP09-015 Baton to zero; five opposing Holomem do not add to own count', passed, {
    ownStageCount: Object.values(state.players[0].zones).filter(Boolean).length,
    opponentStageCount: Object.values(state.players[1].zones).filter(Boolean).length,
    legalWithoutCheer: legal, batonTurn: state.players[0].batonTurn,
    center: state.players[0].zones.center.stack.at(-1).number,
    back1: state.players[0].zones.back1.stack.at(-1).number,
  });
});

handler('#threshold', () => {
  state = baseState();
  state.players[0].zones.center = unit('hBP09-015');
  state.players[0].zones.back1 = unit('hBP09-016');
  state.players[1].zones.center = unit('hBP09-064');
  for (let i = 1; i <= 4; i += 1) state.players[1].zones[`back${i}`] = unit('hBP09-017');
  const legal = isActionCandidateLegal(state, 0, { type: 'baton', zone: 'back1' }, cards);
  result('two own Holomem do not meet the three-Holomem Gift threshold even with five opponents', !legal, {
    ownStageCount: Object.values(state.players[0].zones).filter(Boolean).length,
    opponentStageCount: Object.values(state.players[1].zones).filter(Boolean).length,
    legalWithoutCheer: legal,
  });
});

handler('#scope', () => {
  state = baseState();
  const paidCheer = instance('hY05-001');
  state.players[0].zones.center = unit('hBP09-064', [paidCheer]);
  state.players[0].zones.back1 = unit('hBP09-015');
  state.players[0].zones.back2 = unit('hBP09-017');
  state.players[1].zones.center = unit('hBP09-064');
  const legal = isActionCandidateLegal(state, 0, { type: 'baton', zone: 'back1' }, cards);
  clickAction({ type: 'baton', zone: 'back1' });
  const paid = state.players[0].archive.some(card => card.id === paidCheer.id);
  result('the Gift does not discount another Center Holomem when hBP09-015 is in Back', legal && paid
    && state.players[0].zones.center.stack.at(-1).number === 'hBP09-015'
    && state.players[0].zones.back1.stack.at(-1).number === 'hBP09-064', {
    legal, printedCostPaid: paid, center: state.players[0].zones.center.stack.at(-1).number,
    back1: state.players[0].zones.back1.stack.at(-1).number,
  });
});

handler('#buried', () => {
  state = baseState();
  state.players[0].zones.center = unit('hBP09-015');
  state.players[0].zones.center.stack.push(instance('hBP09-018'));
  state.players[0].zones.back1 = unit('hBP09-016');
  state.players[0].zones.back2 = unit('hBP09-017');
  const legalWithoutCheer = isActionCandidateLegal(state, 0, { type: 'baton', zone: 'back1' }, cards);
  result('hBP09-015 Gift does not apply under the 1st-level top card', !legalWithoutCheer, {
    centerStack: state.players[0].zones.center.stack.map(card => card.number),
    ownStageCount: Object.values(state.players[0].zones).filter(Boolean).length,
    legalWithoutCheer,
  });
});

handler('#arts', () => {
  state = baseState();
  state.players[0].mainDeck = Array.from({ length: 10 }, () => instance('hBP09-017'));
  state.players[0].zones.center = unit('hBP09-064', [instance('hY05-001')]);
  state.players[0].zones.back1 = unit('hBP09-015', [instance('hY01-001')]);
  state.players[0].zones.back2 = unit('hBP09-017');
  state.players[1].zones.center = unit('hBP09-064');
  clickAction({ type: 'collab', zone: 'back1' });
  clickAction({ type: 'baton', zone: 'back2' });
  clickAction({ type: 'advance' });
  clickAction({ type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const damage = state.players[1].zones.center.damage;
  result('hBP09-015 Arts gains 20 after another own Holomem Batons this turn', damage === 40, {
    batonTurn: state.players[0].batonTurn, currentTurn: state.turn, damage, expectedDamage: 40,
  });
});

try {
  const card = cardMap.get('hBP09-015');
  if (!card || card.keyword?.type !== 'gift' || card.arts?.[0]?.damage !== 20) throw new Error('Current catalog is missing hBP09-015 Gift or Arts fields.');
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  output.textContent = JSON.stringify({ number: card.number, name: card.jpName, gift: card.keyword.effect, arts: card.arts[0] }, null, 2);
} catch (error) {
  status.textContent = `FAIL: ${String(error)}`;
  output.textContent = JSON.stringify({ pass: false, error: String(error) }, null, 2);
}
