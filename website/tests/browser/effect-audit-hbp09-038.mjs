import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const catalog = (await response.json()).cards;
const card = catalog.find(entry => entry.number === 'hBP09-038');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-038-${++serial}`, number });
const unit = (number, attachments = [], cheer = []) => ({
  stack: [instance(number)], cheer: cheer.map(instance), attachments: attachments.map(instance), damage: 0,
  rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});

function fixture({ toolZone = null, nonTool = null, phase = 'main' } = {}) {
  const player = name => ({
    name, oshi: instance('hSD10-001'),
    zones: { center: unit('hBP09-064'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 10 }, () => instance('hBP09-051')),
    cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {},
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] },
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
  });
  const state = { status: 'playing', phase, turn: 3, activePlayer: 0, firstPlayer: 1, players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.back1 = unit('hBP09-038', toolZone === 'back1' ? ['hBP09-108'] : nonTool ? [nonTool] : []);
  if (toolZone === 'center') state.players[0].zones.center.attachments.push(instance('hBP09-106'));
  state.players[1].zones.center = unit('hBP09-064');
  if (phase === 'performance') {
    state.players[0].zones.collab = unit('hBP09-038', [], ['hY03-017']);
    state.players[0].zones.back1 = null;
  }
  return state;
}

function run() {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  const identity = card?.jpName === 'カエラ・コヴァルスキア' && card.stage === 'Debut' && card.hp === 110 &&
    card.keyword?.effect === 'このホロメンにツールが付いているなら、自分のデッキを1枚引く。' &&
    card.arts?.[0]?.damage === 30 && card.arts[0].cost.join() === '紅';
  check('catalog matches official Japanese card identity, Collab text, and red 30 Arts', identity);

  let state = fixture({ toolZone: 'back1' });
  const collabPower = state.players[0].mainDeck[0].id;
  const drawn = state.players[0].mainDeck[1].id;
  const handBefore = state.players[0].hand.length;
  state = applyAction(state, 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('Tool attached to Kaela remains with her; Collab moves the top card to Holo Power and draws exactly one more', state.players[0].zones.collab.attachments.some(item => item.number === 'hBP09-108') && state.players[0].holoPower.at(-1)?.id === collabPower && state.players[0].hand.length === handBefore + 1 && state.players[0].hand.at(-1)?.id === drawn && state.players[0].mainDeck.length === 8);

  state = fixture({ toolZone: 'center' });
  const noToolDeck = state.players[0].mainDeck.length;
  state = applyAction(state, 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('Tool attached to a different Holomem does not draw', state.players[0].hand.length === 0 && state.players[0].mainDeck.length === noToolDeck - 1 && state.players[0].holoPower.length === 1);

  state = fixture({ nonTool: 'hBP09-111' });
  const nonToolDeck = state.players[0].mainDeck.length;
  state = applyAction(state, 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('Fan attachment on Kaela does not satisfy the Tool condition', state.players[0].hand.length === 0 && state.players[0].mainDeck.length === nonToolDeck - 1);

  state = fixture({ toolZone: 'back1' });
  state.players[0].mainDeck = state.players[0].mainDeck.slice(0, 1);
  state = applyAction(state, 0, { type: 'collab', zone: 'back1' }, catalog, () => 0.4);
  check('when ordinary Collab consumes the last deck card, Blacksmith adds no phantom draw', state.players[0].mainDeck.length === 0 && state.players[0].hand.length === 0 && state.players[0].holoPower.length === 1);

  state = fixture({ phase: 'performance' });
  state.players[1].zones.center.damage = 0;
  const cheerId = state.players[0].zones.collab.cheer[0].id;
  state = applyAction(state, 0, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, catalog, () => 0.4);
  check('red 30 Arts damages the target, rests Kaela, and retains the red cost Cheer', state.players[1].zones.center.damage === 30 && state.players[0].zones.collab.rested && state.players[0].zones.collab.cheer[0].id === cheerId);

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
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalogue is missing hBP09-038';
