import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-045');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-045-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function player(name, oshi) {
  return { name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 20 }, (_, i) => instance(i % 2 ? 'hBP09-047' : 'hBP09-046')), cheerDeck: [], archive: [], holoPower: [], life: ['hY01-001', 'hY02-001', 'hY03-001', 'hY04-001', 'hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 };
}

function baseState(phase = 'main') {
  const state = { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1, players: [player('Haato', 'hBP09-001'), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP07-038');
  state.players[1].zones.center = unit('hBP09-041');
  state.players[1].zones.collab = unit('hBP09-042');
  state.players[1].zones.back1 = unit('hBP09-043');
  return state;
}

function act(state, action, playerIndex = 0, random = () => 0.4) { return applyAction(state, playerIndex, action, cards, random); }
function answer(state, action, random = () => 0.4) { return act(state, { type: 'choose', ...action }, state.pendingChoice.playerIndex, random); }

function bloomResult(randomValue) {
  const state = baseState('main');
  const player = state.players[0];
  player.hand = [instance('hBP09-045')];
  player.mainDeck = [instance('hBP09-046'), instance('hBP09-047'), instance('hBP09-048')];
  const bloom = player.hand[0];
  let result = act(state, { type: 'play', cardId: bloom.id }, 0, () => randomValue);
  if (result.pendingChoice?.type !== 'bloom' || !result.pendingChoice.options.includes('center')) throw new Error('hBP09-045 did not enter the legal same-name Center Bloom choice');
  result = answer(result, { zone: 'center' }, () => randomValue);
  return result;
}

function artResult({ target, archive }) {
  const state = baseState('performance');
  const player = state.players[0];
  player.zones.center = unit('hBP09-045', ['hY03-001', 'hY03-002', 'hY03-017'].map(instance));
  player.archive = archive.map(instance);
  state.players[1].zones = { center: unit(target), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  let result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  if (archive.some(number => number === 'hBP03-031')) {
    const min = result.pendingChoice?.min;
    const max = result.pendingChoice?.max;
    const pendingBefore = JSON.stringify(result);
    let rejectedEmpty = false;
    try { answer(result, { cardIds: [] }); } catch { rejectedEmpty = JSON.stringify(result) === pendingBefore; }
    result = answer(result, { cardIds: [result.pendingChoice.selectableIds[0]] });
    result = answer(result, { zone: 'back1' });
    return { state: result, min, max, rejectedEmpty, archiveWasDeployed: result.players[0].zones.back1?.stack.at(-1).number === 'hBP03-031' };
  }
  return { state: result, min: null, max: null, rejectedEmpty: true, archiveWasDeployed: false };
}

function run() {
  const odd = bloomResult(0);
  const even = bloomResult(0.2);
  const requiredRed = artResult({ target: 'hBP03-035', archive: ['hBP03-031'] });
  const yellow = artResult({ target: 'hBP05-072', archive: ['hBP03-031'] });
  const noMatch = artResult({ target: 'hBP03-035', archive: ['hBP03-032'] });
  const checks = [
    { name: 'current catalog has official R/S hBP09-045 text and stats', pass: card?.jpName === '赤井はあと' && card.stage === '2nd' && card.hp === 200 && card.variants?.length === 2 && card.keyword.effect.includes('特殊ダメージ30') && card.arts[0].damage === 170 && card.arts[0].effect.includes('Debut〈赤井はあと〉1枚') },
    { name: 'odd Bloom die deals 30 Special damage only to opposing Center', pass: odd.players[1].zones.center.damage === 30 && odd.players[1].zones.collab.damage === 0 && odd.players[1].zones.back1.damage === 0 && odd.players[0].hand.length === 0 },
    { name: 'even Bloom die draws the next two cards and causes no damage', pass: even.players[0].hand.map(item => item.number).join(',') === 'hBP09-046,hBP09-047' && even.players[1].zones.center.damage === 0 && even.players[1].zones.collab.damage === 0 && even.players[1].zones.back1.damage === 0 },
    { name: 'Arts mandatory one-card archive choice rejects empty selection and deploys Debut Haato', pass: requiredRed.min === 1 && requiredRed.max === 1 && requiredRed.rejectedEmpty && requiredRed.archiveWasDeployed && requiredRed.state.players[1].zones.center.damage === 170 },
    { name: 'Yellow +50 is independent and no matching archive card creates no prompt', pass: yellow.state.players[1].zones.center.damage === 220 && noMatch.state.pendingChoice === null && noMatch.state.players[1].zones.center.damage === 170 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { odd: { center: odd.players[1].zones.center.damage, collab: odd.players[1].zones.collab.damage, back1: odd.players[1].zones.back1.damage, die: odd.players[0].turnEvents.dice.at(-1)?.value }, even: { hand: even.players[0].hand.map(item => item.number), remainingDeck: even.players[0].mainDeck.map(item => item.number), die: even.players[0].turnEvents.dice.at(-1)?.value }, requiredRed: { min: requiredRed.min, max: requiredRed.max, rejectedEmpty: requiredRed.rejectedEmpty, deployed: requiredRed.archiveWasDeployed, damage: requiredRed.state.players[1].zones.center.damage }, yellowDamage: yellow.state.players[1].zones.center.damage, noMatchDamage: noMatch.state.players[1].zones.center.damage } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-045';
