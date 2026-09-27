import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error('Could not load current cards.json (' + response.status + ')');
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-022');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: 'browser-hbp09-022-' + (++serial), number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name) {
  return {
    name, oshi: instance('hBP09-001'),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [instance('hBP04-069'), instance('hBP04-072')], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function fixture(power = 10) {
  const players = [player('Audit'), player('Opponent')];
  players[0].hand = [instance('hBP09-022')];
  players[0].holoPower = Array.from({ length: power }, () => instance('hY01-001'));
  players[0].zones.center = unit('hBP03-069');
  players[1].zones.center = unit('hBP04-069');
  players[1].zones.back1 = unit('hBP04-072');
  return { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function apply(state, action, playerIndex = state.pendingChoice?.playerIndex ?? state.activePlayer) {
  return applyAction(state, playerIndex, action, cards, () => 0.5);
}
function check(condition, message) { if (!condition) throw new Error(message); }
function beginBloom(power) {
  const initial = fixture(power);
  let state = apply(initial, { type: 'play', cardId: initial.players[0].hand[0].id });
  check(state.pendingChoice?.type === 'bloom', 'hBP09-022 must ask for a legal same-name Bloom base');
  state = apply(state, { type: 'choose', zone: 'center' }, 0);
  return state;
}

function run() {
  check(card, 'hBP09-022 is missing from the current catalogue');
  const nine = beginBloom(9);
  const requiredTargetAtNine = nine.pendingChoice?.type === 'stageTarget' && nine.pendingChoice.playerIndex === 0 && ['center', 'back1'].every(zone => nine.pendingChoice.options.includes(zone));
  const savedNine = JSON.parse(JSON.stringify(nine));
  const completedNine = apply(savedNine, { type: 'choose', zone: 'center' }, 0);
  const noTransformationAtNine = completedNine.players[1].zones.center.hbp09Stage === undefined && completedNine.players[0].holoPower.length === 9;

  let ten = beginBloom(10);
  const requiredTargetAtTen = ten.pendingChoice?.type === 'stageTarget';
  ten = apply(JSON.parse(JSON.stringify(ten)), { type: 'choose', zone: 'center' }, 0);
  const bothStagesAtTen = ten.players[1].zones.center.hbp09Stage?.stage === '2nd' && cards.find(item => item.number === ten.players[1].zones.center.stack.at(-1).number)?.stage === '1st';
  ten = apply(ten, { type: 'oshiSkill' }, 0);
  ten = apply(ten, { type: 'choose', zone: 'center' }, 0);
  const subaruCandidates = new Set(ten.pendingChoice.selectableIds.map(id => ten.players[0].mainDeck.find(item => item.id === id)?.number));
  const bothSubaruLevels = ten.pendingChoice?.type === 'cardSelection' && subaruCandidates.has('hBP04-069') && subaruCandidates.has('hBP04-072');

  const arts = [];
  for (const [power, target, expected] of [[3, 'hBP09-022', 100], [4, 'hBP09-022', 150], [3, 'hBP07-076', 150], [4, 'hBP07-076', 200]]) {
    const state = fixture(power);
    state.phase = 'performance';
    state.players[0].zones.center = unit('hBP09-022', ['hY01-001', 'hY01-002']);
    state.players[1].zones.center = unit(target);
    const result = apply(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
    arts.push({ power, target, expected, actual: result.players[1].zones.center?.damage, passed: result.players[1].zones.center?.damage === expected });
  }

  const printingsAndText = ['hbp09-hBP09-022_R', 'hbp09-hBP09-022_SR'].every(id => card.variants.some(variant => variant.id === id))
    && card.keyword.effect === '相手のステージのホロメン1人を選ぶ。自分のホロパワーが10枚以上あるなら、このターンの間、選んだホロメンは2ndホロメンとしても扱う。'
    && card.arts[0].effect === '自分のホロパワーが4枚以上あるなら、このアーツ+50。';

  const checks = [
    { name: '9 Holo Power still prompts for the mandatory opponent target', pass: requiredTargetAtNine },
    { name: 'pending target save/reload resolves without adding the conditional stage', pass: noTransformationAtNine },
    { name: '10 Holo Power adds 2nd while preserving printed 1st', pass: requiredTargetAtTen && bothStagesAtTen },
    { name: 'Q705/Q706 Subaru Oshi accepts both the 1st and 2nd level', pass: bothSubaruLevels },
    { name: 'Arts thresholds and Purple +50 icon are independent', pass: arts.every(item => item.passed) },
    { name: 'catalogue text and both R/SR printings are present', pass: printingsAndText },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = (passed === checks.length ? 'PASS ' : 'FAIL ') + passed + '/' + checks.length;
  output.textContent = JSON.stringify({ checks, detail: { nineTargetOptions: nine.pendingChoice?.options, noTransformationAtNine, bothStagesAtTen, bothSubaruLevels, arts, printingsAndText } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  check(passed === checks.length, `${passed}/${checks.length} browser assertions passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? 'Ready: ' + card.number + ' · ' + card.jpName : 'FAIL: current catalogue is missing hBP09-022';
