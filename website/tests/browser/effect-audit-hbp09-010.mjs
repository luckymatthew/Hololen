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
let selected = [];
let mode = '';
let collabProof = null;
const instance = number => ({ id: `browser-hbp09-010-${++serial}`, number });
const unit = number => ({
  stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = () => ({ turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(oshiNumber = 'hBP09-006') {
  return {
    name: 'Browser Audit', oshi: instance(oshiNumber),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 16 }, () => instance('hBP09-051')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-015')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(),
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState(phase) {
  return { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 0,
    players: [player(), player('hBP09-002')], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [], lifeLosses: [] };
}

function action(value) {
  state = applyAction(state, 0, value, cards, () => 0.25);
}

function write(value) {
  output.textContent = JSON.stringify(value, null, 2);
}

function runArt() {
  choices.replaceChildren();
  mode = 'art';
  state = baseState('performance');
  const source = unit('hBP09-009');
  source.stack.push(instance('hBP09-010'));
  source.cheer = [instance('hY01-015'), instance('hY02-013')];
  source.bloomedTurn = 7;
  state.players[0].zones.center = source;
  state.players[1].zones.center = unit('hBP09-064');
  state.players[1].zones.back1 = unit('hBP09-064');
  state.players[1].zones.center.attachments.push(instance('hBP01-114'));
  state.players[1].zones.back1.attachments.push(instance('hBP01-115'));
  action({ type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const pending = state.pendingChoice;
  if (pending?.type !== 'cardSelection' || pending.playerIndex !== 0 || pending.min !== 1 || pending.max !== 1 || pending.optional) {
    status.textContent = 'FAIL: expected one mandatory opponent-Tool choice from the Arts player.';
    write({ pendingChoice: pending });
    return;
  }
  status.textContent = 'Choose one opposing Tool to archive. The Arts damage settles after this choice.';
  for (const card of pending.cards) {
    const zone = Object.keys(state.players[1].zones).find(key => state.players[1].zones[key]?.attachments.some(item => item.id === card.id));
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Archive ${cardMap.get(card.number)?.name || card.number} from opponent ${zone}`;
    button.addEventListener('click', () => {
      action({ type: 'choose', cardIds: [card.id] });
      const archived = state.players[1].archive.some(item => item.id === card.id);
      const remains = Object.values(state.players[1].zones).some(unit => unit?.attachments.some(item => item.id !== card.id && item.number === 'hBP01-114'));
      const pass = archived && remains && state.players[1].zones.center.damage === 30 && state.pendingChoice === null;
      status.textContent = pass ? 'PASS: selected Tool reached the opponent Archive; other Tool remains; Arts dealt 30.' : 'FAIL: final Arts/Tool state does not match the Japanese text.';
      choices.replaceChildren();
      write({ pass, archivedTool: card.number, archivedByOwner: state.players[1].archive.some(item => item.id === card.id), remainingToolIds: Object.values(state.players[1].zones).flatMap(unit => unit?.attachments || []).map(item => item.id), opponentCenterDamage: state.players[1].zones.center.damage, pendingChoice: state.pendingChoice });
    });
    choices.append(button);
  }
  write({ pendingChoiceType: pending.type, selectableTools: pending.cards.map(card => ({ id: card.id, number: card.number })) });
}

function renderCollabChoice() {
  choices.replaceChildren();
  const pending = state.pendingChoice;
  if (pending?.type !== 'cardSelection' || pending.min !== 2 || pending.max !== 2 || pending.optional) {
    status.textContent = 'FAIL: expected a mandatory ordered choice of two hand cards.';
    write({ pendingChoice: pending });
    return;
  }
  status.textContent = 'Select two hand cards in order, then confirm their order on the deck bottom.';
  selected = [];
  const buttons = new Map();
  for (const card of pending.cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = `${cardMap.get(card.number)?.name || card.number} (${card.number})`;
    button.addEventListener('click', () => {
      if (selected.includes(card.id)) selected = selected.filter(id => id !== card.id);
      else if (selected.length < 2) selected.push(card.id);
      for (const [id, control] of buttons) {
        control.setAttribute('aria-pressed', String(selected.includes(id)));
        control.textContent = `${cardMap.get(pending.cards.find(item => item.id === id)?.number)?.name || id} (${id})${selected.includes(id) ? ` — order ${selected.indexOf(id) + 1}` : ''}`;
      }
      confirm.disabled = selected.length !== 2;
    });
    buttons.set(card.id, button);
    choices.append(button);
  }
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.textContent = 'Confirm selected order';
  confirm.disabled = true;
  confirm.addEventListener('click', () => {
    action({ type: 'choose', cardIds: [...selected] });
    const bottomIds = state.players[0].mainDeck.slice(-2).map(card => card.id);
    const pass = state.pendingChoice === null
      && JSON.stringify(bottomIds) === JSON.stringify(selected)
      && state.players[0].holoPower.at(-1)?.id === collabProof.collabPower.id
      && JSON.stringify(state.players[0].hand.map(card => card.id).sort()) === JSON.stringify(collabProof.drawn.map(card => card.id).sort());
    status.textContent = pass ? 'PASS: two were drawn, two choices returned to the bottom in click order, and Collab power was preserved.' : 'FAIL: bottom-deck order or Collab draw result is incorrect.';
    choices.replaceChildren();
    write({ pass, selectedInOrder: selected, deckBottomIds: bottomIds, collabPowerId: state.players[0].holoPower.at(-1)?.id, remainingHandIds: state.players[0].hand.map(card => card.id), pendingChoice: state.pendingChoice });
  });
  choices.append(confirm);
  write({ pendingChoiceType: pending.type, requiredCount: pending.min, orderedChoiceIdsAvailable: pending.selectableIds, selectedInOrder: selected });
}

function runCollab() {
  mode = 'collab';
  choices.replaceChildren();
  state = baseState('main');
  const playerState = state.players[0];
  const source = unit('hBP09-009');
  source.stack.push(instance('hBP09-010'));
  source.bloomedTurn = 7;
  playerState.zones.back1 = source;
  playerState.hand = [instance('hBP09-051'), instance('hBP09-052')];
  playerState.mainDeck = ['hBP09-064', 'hBP09-065', 'hBP09-066', 'hBP09-067'].map(instance);
  collabProof = { collabPower: playerState.mainDeck[0], drawn: playerState.mainDeck.slice(1, 3) };
  action({ type: 'collab', zone: 'back1' });
  renderCollabChoice();
}

try {
  const card = cardMap.get('hBP09-010');
  if (!card || card.keyword?.type !== 'collab' || card.arts?.[0]?.damage !== 30 || !card.arts[0].effect?.includes('ツール1枚')) {
    throw new Error('The current browser catalog is missing hBP09-010 official fields.');
  }
  document.querySelector('#run-art').addEventListener('click', runArt);
  document.querySelector('#run-collab').addEventListener('click', runCollab);
  status.textContent = `Ready: current catalog has ${card.variants.length} canonical hBP09-010 printings.`;
  write({ number: card.number, printings: card.variants.map(variant => variant.id), collab: card.keyword.effect, arts: card.arts[0].effect });
} catch (error) {
  status.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  write({ error: String(error) });
}
