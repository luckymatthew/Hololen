import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-041');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-041-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function fixture({ sourceTool = null, otherUnit = null, otherTool = null, opponentTool = null } = {}) {
  const player = name => ({
    name, oshi: instance('hSD10-001'),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP09-051')),
    cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 2, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] },
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
  });
  const state = { status: 'playing', phase: 'performance', turn: 3, activePlayer: 0, firstPlayer: 0,
    players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-041');
  if (sourceTool) state.players[0].zones.center.attachments.push(instance(sourceTool));
  else state.players[0].zones.center.cheer.push(instance('hY03-017'));
  if (otherUnit) {
    state.players[0].zones.back1 = unit(otherUnit);
    if (otherTool) state.players[0].zones.back1.attachments.push(instance(otherTool));
  }
  state.players[1].zones.center = unit('hBP09-064');
  if (opponentTool) {
    state.players[1].zones.back1 = unit('hBP01-014');
    state.players[1].zones.back1.attachments.push(instance(opponentTool));
  }
  return state;
}

function attack(state) {
  return applyAction(state, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.4);
}

function run() {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalog Japanese card text contains the red-cost Gift and Buzz/2nd Kaela Arms Arts clause',
    card?.jpName === 'カエラ・コヴァルスキア' && card.stage === '1st' && card.hp === 170 &&
    card.keyword?.effect?.includes('必要な赤-1') && card.arts?.[0]?.damage === 30 &&
    card.arts?.[0]?.effect?.includes('Buzzホロメンか2ndホロメン'));

  let state = attack(fixture({ sourceTool: 'hBP04-098' }));
  check('source Kaela Arms Tool removes the red Cheer requirement and its conditional Arts clause adds the second +10',
    state.players[1].zones.center.damage === 50 && state.players[0].zones.center.cheer.length === 0 && state.players[0].zones.center.rested);

  state = attack(fixture());
  check('without a Tool, the printed red Cheer is required and base Arts deals 30', state.players[1].zones.center.damage === 30);

  const unpaid = fixture({ otherUnit: 'hBP01-014', otherTool: 'hBP04-098' });
  unpaid.players[0].zones.center.cheer = [];
  let rejected = false;
  try { attack(unpaid); } catch { rejected = true; }
  check('a qualifying Tool on another unit does not reduce this Kaela’s red Arts cost', rejected && unpaid.players[0].zones.center.rested === false);

  state = attack(fixture({ otherUnit: 'hBP09-042', otherTool: 'hBP09-106' }));
  check('an own Buzz with a Kaela Arms Tool gives exactly +20 Arts', state.players[1].zones.center.damage === 50);

  state = attack(fixture({ otherUnit: 'hBP09-038', otherTool: 'hBP04-098' }));
  check('a tagged Tool on a Debut does not qualify for Kaela-041’s +20 condition', state.players[1].zones.center.damage === 30);

  state = attack(fixture({ opponentTool: 'hBP04-098' }));
  check('an opponent’s qualifying Tool does not satisfy the own-stage Arts condition', state.players[1].zones.center.damage === 30);

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
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-041';
