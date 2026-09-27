import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const cardMap = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const choices = document.querySelector('#choices');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-q722-${++serial}`, number });
const unit = number => ({
  stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
const cheerNumbers = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014', 'hY05-012', 'hY06-012'];
const player = (oshi, center) => ({
  name: 'Browser Audit', oshi: instance(`hBP09-${String(oshi).padStart(3, '0')}`),
  zones: { center: unit(center), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP09-051')),
  cheerDeck: Array.from({ length: 10 }, (_, index) => instance(cheerNumbers[index % cheerNumbers.length])),
  archive: [], holoPower: Array.from({ length: 10 }, () => instance('hBP09-051')),
  life: Array.from({ length: 5 }, () => instance(cheerNumbers[0])), turnsTaken: 2,
  modifiers: [], namedUsageTurns: {},
  turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
  oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
});

let state = {
  status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 0,
  players: [player(6, 'hBP09-042'), player(6, 'hBP09-042')],
  effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [],
};
state.players[0].zones.back1 = unit('hBP09-044');
const shield = instance('hBP09-106');
const sword = instance('hBP09-107');
state.players[0].zones.back1.attachments.push(shield, sword);
const bloom = instance('hBP09-043');
state.players[0].hand.push(bloom);

function action(value) {
  state = applyAction(state, 0, value, cards, () => 0.25);
}

function showResult(value) {
  output.textContent = JSON.stringify(value, null, 2);
}

function renderPending() {
  choices.replaceChildren();
  const pending = state.pendingChoice;
  if (pending?.type === 'bloom') {
    status.textContent = 'PASS 1/2: 043 is offered as a legal Bloom; choose Back 1 to continue.';
    const button = document.createElement('button');
    button.textContent = 'Bloom hBP09-043 into Back 1';
    button.addEventListener('click', () => {
      action({ type: 'choose', zone: 'back1' });
      renderPending();
    });
    choices.append(button);
    return;
  }
  if (pending?.type === 'stageAttachmentSelection' && pending.effect === 'archiveExcessAttachment') {
    status.textContent = 'PASS 2/2: the real engine requires one excess Tool to be archived; choose either one.';
    for (const option of pending.attachmentOptions) {
      const button = document.createElement('button');
      button.textContent = `Archive ${cardMap.get(option.number)?.name || option.number} (${option.number})`;
      button.addEventListener('click', () => {
        action({ type: 'choose', attachmentId: option.id });
        const host = state.players[0].zones.back1;
        const tools = host.attachments.filter(card => cardMap.get(card.number)?.typeCode === 'supportTool');
        const archived = state.players[0].archive.filter(card => [shield.id, sword.id].includes(card.id));
        const pass = state.pendingChoice === null && tools.length === 1 && archived.length === 1;
        status.textContent = pass
          ? 'PASS: one Tool remains attached, one Tool is archived, and the mandatory choice cleared.'
          : 'FAIL: the final attachment and Archive state do not match Q722.';
        choices.replaceChildren();
        showResult({ pass, attachedToolIds: tools.map(card => card.id), archivedToolIds: archived.map(card => card.id), pendingChoice: state.pendingChoice });
      });
      choices.append(button);
    }
    return;
  }
  status.textContent = `FAIL: expected a Bloom or excess-Tool choice, received ${pending?.type || 'no pending choice'}.`;
  showResult({ pendingChoice: pending, zones: state.players[0].zones, archive: state.players[0].archive });
}

try {
  if (!cardMap.has('hBP09-043') || !cardMap.has('hBP09-044') || !cardMap.has('hBP09-106') || !cardMap.has('hBP09-107')) {
    throw new Error('The current browser catalog is missing a Q722 card.');
  }
  action({ type: 'play', cardId: bloom.id });
  renderPending();
  showResult({ pendingChoice: state.pendingChoice, originalToolIds: [shield.id, sword.id] });
} catch (error) {
  status.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  showResult({ error: String(error) });
}
