import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-040');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-040-${++serial}`, number });
const toolNumbers = ['hBP09-106', 'hBP09-107'];
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function fixture({ archive = toolNumbers, opponentArchive = [] } = {}) {
  const player = name => ({
    name, oshi: instance('hSD10-001'),
    zones: { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP09-051')),
    cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 2, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] },
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
  });
  const state = { status: 'playing', phase: 'main', turn: 3, activePlayer: 0, firstPlayer: 0,
    players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-064');
  state.players[0].zones.back1 = unit('hBP09-040');
  state.players[0].archive = archive.map(instance);
  state.players[1].zones.center = unit('hBP09-064');
  state.players[1].archive = opponentArchive.map(instance);
  return state;
}

function collab(state) {
  return applyAction(state, 0, { type: 'collab', zone: 'back1' }, cards, () => 0.4);
}

function artsFixture() {
  const state = fixture({ archive: [] });
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-040');
  state.players[0].zones.center.cheer = [instance('hY03-001')];
  state.players[0].zones.back1 = null;
  return state;
}

function run() {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalog includes the red 40-damage vanilla Arts', card?.arts?.[0]?.name === '終わらぬ探求' && card.arts[0].damage === 40 && JSON.stringify(card.arts[0].cost) === JSON.stringify(['紅']));
  check('catalog Japanese identity and optional one-Tool Collab text',
    card?.jpName === 'カエラ・コヴァルスキア' && card.stage === '1st' && card.hp === 180 &&
    card.keyword?.name === 'クレーバーな仕事人' &&
    card.keyword?.effect === "自分のアーカイブの#カエラ'sアームズを持つツール1枚を手札に戻せる。");

  const arts = applyAction(artsFixture(), 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.4);
  check('real vanilla Arts pays red, rests Kaela, deals 40 and keeps the Cheer attached',
    arts.players[1].zones.center.damage === 40 && arts.players[0].zones.center.rested === true && arts.players[0].zones.center.cheer.length === 1);

  let state = collab(fixture());
  const chosen = state.pendingChoice?.cards?.[0];
  check('only own matching archive Tools are offered in a one-card optional choice',
    state.pendingChoice?.type === 'cardSelection' && state.pendingChoice.playerIndex === 0 &&
    state.pendingChoice.min === 1 && state.pendingChoice.max === 1 && state.pendingChoice.optional === true &&
    state.pendingChoice.cards.length === 2 && state.pendingChoice.cards.every(item => toolNumbers.includes(item.number)));

  const selectedId = chosen?.id;
  state = applyAction(state, 0, { type: 'choose', cardIds: [selectedId] }, cards, () => 0.4);
  check('selected Tool returns to hand, other Tool stays archived, and Collab Holo Power remains',
    state.pendingChoice === null && state.players[0].hand.some(item => item.id === selectedId) &&
    state.players[0].archive.length === 1 && toolNumbers.includes(state.players[0].archive[0].number) &&
    state.players[0].holoPower.length === 1);

  state = collab(fixture());
  state = applyAction(state, 0, { type: 'choose', skip: true }, cards, () => 0.4);
  check('the optional return can be declined without moving a Tool',
    state.pendingChoice === null && state.players[0].hand.length === 0 && state.players[0].archive.length === 2 && state.players[0].holoPower.length === 1);

  state = collab(fixture({ archive: ['hBP09-108', 'hBP09-111'], opponentArchive: ['hBP09-106'] }));
  check('untagged Tool, Fan and opponent archive cannot satisfy the filter',
    state.pendingChoice === null && state.players[0].archive.length === 2 && state.players[1].archive.length === 1);

  state = collab(fixture({ archive: [] }));
  check('no eligible Tool creates no empty prompt', state.pendingChoice === null && state.players[0].archive.length === 0);

  state = collab(fixture());
  const beforeInvalidChoice = JSON.stringify(state);
  let invalidRejected = false;
  try { applyAction(state, 0, { type: 'choose', cardIds: ['not-eligible'] }, cards, () => 0.4); }
  catch { invalidRejected = true; }
  check('a stale/nonselectable archive ID is rejected without mutating the pending state', invalidRejected && JSON.stringify(state) === beforeInvalidChoice);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) {
    document.querySelector('#status').textContent = 'FAIL';
    document.querySelector('#result').textContent = String(error?.stack || error);
    window.__effectAudit = { error: String(error?.stack || error) };
  }
});
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-040';
