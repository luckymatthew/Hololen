import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-044');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-044-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function player(name, oshi) {
  return { name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 20 }, () => instance('hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [], life: ['hY01-001', 'hY02-001', 'hY03-001', 'hY04-001', 'hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 };
}

function baseState(phase = 'main') {
  const state = { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1, players: [player('Kaela', 'hBP09-004'), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-042');
  state.players[1].zones.center = unit('hBP09-042');
  return state;
}

function act(state, action, playerIndex = 0) { return applyAction(state, playerIndex, action, cards, () => 0.4); }
function answer(state, action) { return act(state, { type: 'choose', ...action }, state.pendingChoice.playerIndex); }

function run() {
  const red = ['hY03-001', 'hY03-002'];
  const artsCases = [
    { tools: [], otherTools: [], expected: 100 },
    { tools: ['hBP09-108'], otherTools: [], expected: 100 },
    { tools: [], otherTools: ['hBP09-106', 'hBP09-107'], expected: 100 },
    { tools: ['hBP09-106'], otherTools: [], expected: 160 },
    { tools: ['hBP09-107'], otherTools: [], expected: 200 },
    { tools: ['hBP09-106', 'hBP09-107'], otherTools: [], expected: 200 },
  ].map(({ tools, otherTools, expected }) => {
    const state = baseState('performance');
    state.players[0].zones.center = unit('hBP09-044');
    state.players[0].zones.center.cheer = red.map(instance);
    state.players[0].zones.center.attachments = tools.map(instance);
    if (otherTools.length) {
      state.players[0].zones.back1 = unit('hBP09-042');
      state.players[0].zones.back1.attachments = otherTools.map(instance);
    }
    const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
    return { tools, otherTools, expected, actual: result.players[1].zones.center.damage, pass: result.players[1].zones.center.damage === expected && result.players[0].zones.center.rested };
  });

  const green = baseState('performance');
  green.players[0].zones.center = unit('hBP09-044');
  green.players[0].zones.center.cheer = red.map(instance);
  green.players[0].zones.center.attachments = [instance('hBP09-106')];
  green.players[1].zones.center = unit('hBP09-034');
  const greenResult = act(green, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });

  const underpaid = baseState('performance');
  underpaid.players[0].zones.center = unit('hBP09-044');
  underpaid.players[0].zones.center.cheer = [instance('hY03-001')];
  let underpaidRejected = false;
  try { act(underpaid, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }); }
  catch { underpaidRejected = !underpaid.players[0].zones.center.rested && underpaid.players[0].zones.center.cheer.length === 1; }

  const attach = baseState();
  attach.players[0].zones.back1 = unit('hBP09-044');
  attach.players[0].zones.back1.attachments = [instance('hBP09-108')];
  const second = instance('hBP09-106');
  const third = instance('hBP09-107');
  attach.players[0].hand.push(second, third);
  let choice = act(attach, { type: 'play', cardId: second.id });
  const permitsSecondArms = choice.pendingChoice?.options?.includes('back1');
  choice = answer(choice, { zone: 'back1' });
  let thirdChoice = act(choice, { type: 'play', cardId: third.id });
  const rejectsThirdKaelaTarget = !thirdChoice.pendingChoice?.options?.includes('back1') && thirdChoice.pendingChoice?.options?.includes('center');
  thirdChoice = answer(thirdChoice, { zone: 'center' });

  const checks = [
    { name: 'official 044 Japanese identity, Gift, two-red Arts and Green +50 text', pass: card?.jpName === 'カエラ・コヴァルスキア' && card.stage === '2nd' && card.hp === 200 && card.variants?.length === 3 && card.keyword.effect.includes("#カエラ'sアームズ") && card.arts[0].damage === 100 && JSON.stringify(card.arts[0].cost) === JSON.stringify(['紅', '紅']) && card.arts[0].specialTargets?.[0] === '綠' && card.arts[0].specialValues?.[0] === 50 },
    { name: 'Arts uses the source Kaela Tool condition, while Holo Sword +40 is a separate bonus', pass: artsCases.every(item => item.pass) },
    { name: 'Green Arts bonus combines independently with an Arms Tool', pass: greenResult.players[1].zones.center.damage === 210 },
    { name: 'an Arts that lacks two red Cheer is rejected without resting or spending Cheer', pass: underpaidRejected },
    { name: 'Gift permits the additional Arms Tool but excludes a third Tool target on Kaela', pass: permitsSecondArms && rejectsThirdKaelaTarget && thirdChoice.players[0].zones.back1.attachments.length === 2 && thirdChoice.players[0].zones.center.attachments.some(item => item.id === third.id) },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { artsCases, greenArtsDamage: greenResult.players[1].zones.center.damage, additionalToolOptions: ['center', 'back1'].filter(zone => thirdChoice.players[0].zones[zone]?.attachments?.some(item => item.id === third.id)) } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-044';
