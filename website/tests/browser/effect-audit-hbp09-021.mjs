import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error('Could not load current cards.json (' + response.status + ')');
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-021');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: 'browser-hbp09-021-' + (++serial), number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name) {
  return { name, oshi: instance('hBP09-002'), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 40 }, (_, i) => instance(i === 0 ? 'hBP09-050' : 'hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function fixture({ target = 'hBP09-018', source = 'hBP09-021', batonTurn = 0, sourceZone = 'center', targetDamage = 0, deckSize = 4 } = {}) {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = unit(sourceZone === 'center' ? source : 'hBP01-017', sourceZone === 'center' ? ['hY01-001', 'hY01-001'] : ['hY01-001']);
  if (sourceZone === 'collab') {
    players[0].zones.collab = unit(source, ['hY01-001', 'hY01-001']);
    players[0].zones.collab.collabbedTurn = 8;
    players[0].collabTurn = 8;
  }
  players[0].batonTurn = batonTurn;
  players[0].turnEvents = turnEvents(8);
  players[0].mainDeck = Array.from({ length: deckSize }, (_, i) => instance(i === 0 ? 'hBP09-050' : 'hBP09-051'));
  players[1].zones.center = unit(target);
  players[1].zones.center.damage = targetDamage;
  players[1].zones.center.damage = targetDamage;
  players[1].zones.back1 = unit('hBP09-015');
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function apply(state, action, playerIndex = state.activePlayer) {
  return applyAction(state, playerIndex, action, cards, () => 0.5);
}

function settle(state, limit = 80) {
  for (let i = 0; state.pendingChoice && i < limit; i++) {
    const pending = state.pendingChoice;
    let answer;
    if (pending.type === 'cardSelection') answer = { cardIds: pending.selectableIds.slice(0, pending.min || 0) };
    else if (pending.optional) answer = { skip: true };
    else answer = { zone: pending.options?.[0], targetZone: pending.options?.[0] };
    state = apply(state, { type: 'choose', ...answer }, pending.playerIndex);
  }
  if (state.pendingChoice) throw new Error('Pending choice did not resolve: ' + state.pendingChoice.type);
  return state;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function run() {
  assert(card, 'hBP09-021 is missing from the current catalogue');

  const plain = fixture({ target: 'hBP09-021', batonTurn: 0 });
  let state = settle(apply(plain, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const baseDamage = state.players[1].zones.center.damage;
  const staleBaton = settle(apply(fixture({ target: 'hBP09-021', batonTurn: 7 }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const staleBatonDamage = staleBaton.players[1].zones.center.damage;

  const red = settle(apply(fixture({ target: 'hBP01-071', batonTurn: 8 }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const white = settle(apply(fixture({ target: 'hBP09-021', batonTurn: 8 }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const redDamage = red.players[1].zones.center.damage;
  const whiteDamage = white.players[1].zones.center.damage;

  const giftFixture = fixture({ target: 'hBP09-018', batonTurn: 8, deckSize: 3 });
  const topId = giftFixture.players[0].mainDeck[0].id;
  const oldPower = giftFixture.players[0].holoPower.length;
  const gift = settle(apply(giftFixture, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const giftExactTop = gift.players[0].holoPower.at(-1)?.id === topId && gift.players[0].mainDeck[0]?.id === giftFixture.players[0].mainDeck[1].id && gift.players[0].holoPower.length === oldPower + 1;

  const actualBaton = fixture({ target: 'hBP09-018', batonTurn: 0 });
  actualBaton.phase = 'main';
  actualBaton.players[0].zones.back1 = actualBaton.players[0].zones.center;
  actualBaton.players[0].zones.center = unit('hBP01-017', ['hY01-001']);
  actualBaton.players[0].zones.back2 = unit('hBP09-016');
  actualBaton.players[0].zones.back1.cheer = [instance('hY01-001'), instance('hY01-001')];
  state = apply(actualBaton, { type: 'collab', zone: 'back1' });
  state = apply(state, { type: 'baton', zone: 'back2' });
  const batonTurn = state.players[0].batonTurn;
  state = apply(state, { type: 'advance' });
  state = settle(apply(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }));
  const actualBatonDamage = state.players[1].zones.center === null && batonTurn === 8;

  const noDownBase = fixture({ target: 'hBP09-021', batonTurn: 0 });
  state = settle(apply(noDownBase, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const noDownNoGift = state.players[1].zones.center.damage === 80 && state.players[0].holoPower.length === 0;
  const coveredFixture = fixture({ target: 'hBP09-018', batonTurn: 8, targetDamage: 100 });
  coveredFixture.players[0].zones.center.stack.push(instance('hBP09-020'));
  state = settle(apply(coveredFixture, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const coveredNoGift = state.players[1].zones.center === null && state.players[0].holoPower.length === 0;

  const checks = [
    { name: '80 base Arts and a previous-turn Baton do not add the +80', pass: baseDamage === 80 && staleBatonDamage === 80 },
    { name: 'same-turn Baton adds +80; Red +50 remains target-specific', pass: redDamage === 210 && whiteDamage === 160 },
    { name: 'Gift transfers exactly one actual main-deck top card after its KO', pass: giftExactTop && gift.players[1].zones.center === null },
    { name: 'real Collab then Baton actions enable the same-turn Arts bonus', pass: actualBatonDamage },
    { name: 'no KO and a covered Gift source do not grant Holo Power', pass: noDownNoGift && coveredNoGift },
    { name: 'catalogue retains RR/SR/UR and exact Japanese rules text', pass: ['hbp09-hBP09-021_RR', 'hbp09-hBP09-021_SR', 'hbp09-hBP09-021_UR'].every(id => card.variants.some(variant => variant.id === id)) && card.keyword.effect === 'このホロメンが相手のホロメンをダウンさせた時、自分のデッキの上から1枚をホロパワーにする。' && card.arts[0].effect === 'このターンに自分のホロメンがバトンタッチしていたなら、このアーツ+80。' },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = (passed === checks.length ? 'PASS ' : 'FAIL ') + passed + '/' + checks.length;
  output.textContent = JSON.stringify({ checks, detail: { baseDamage, staleBatonDamage, redDamage, whiteDamage, giftExactTop, actualBatonTurn: batonTurn, actualBatonDamage, noDownNoGift, coveredNoGift, variants: card.variants.map(item => item.id) } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  assert(passed === checks.length, `${passed}/${checks.length} browser assertions passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? 'Ready: ' + card.number + ' · ' + card.jpName : 'FAIL: current catalogue is missing hBP09-021';
