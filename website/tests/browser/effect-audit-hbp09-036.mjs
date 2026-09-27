import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-036');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-036-${++serial}`, number });
const unit = (number, cheers = 0) => ({
  stack: [instance(number)], cheer: Array.from({ length: cheers }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017'][i % 3])),
  attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const player = (name, oshi) => ({
  name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: [], cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
  turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] },
  oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function fixture() {
  return { status: 'playing', phase: 'main', turn: 3, activePlayer: 0, firstPlayer: 1,
    players: [player('Player', 'hBP07-003'), player('Opponent', 'hBP01-001')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}
const act = (state, action, index = 0) => applyAction(state, index, action, cards, () => 0.4);
function collabFixture(center, cheerDeck, opponentCenter = 'hBP01-046') {
  const state = fixture();
  state.players[0].zones = { center: unit(center), collab: null, back1: unit('hBP09-036'), back2: null, back3: null, back4: null, back5: null };
  state.players[0].mainDeck = Array.from({ length: 10 }, () => instance('hBP09-051'));
  state.players[0].cheerDeck = cheerDeck.map(instance);
  state.players[1].zones.center = unit(opponentCenter);
  return state;
}
function artsFixture(center, centerCheers, backCheers = 5, opponentCheers = 4) {
  const state = fixture();
  state.phase = 'performance';
  state.players[0].zones = { center: unit(center, centerCheers), collab: unit('hBP09-036', 1), back1: unit('hBP07-068', backCheers), back2: null, back3: null, back4: null, back5: null };
  state.players[1].zones.center = unit('hBP01-046', opponentCheers);
  return state;
}
function run() {
  if (!card) throw new Error('Current catalogue is missing hBP09-036');
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalog identity, R/SR printings and exact official Japanese Collab/Arts text', card.jpName === '風真いろは' && card.stage === '1st' && card.hp === 160 && ['R', 'SR'].every(rarity => card.variants.some(variant => variant.rarity === rarity)) && card.keyword.effect === '自分のステージの〈AZKi〉1人を選ぶ。自分のエールデッキから、選んだホロメンと同色のエール1枚を選んだホロメンに送る。そしてエールデッキをシャッフルする。' && card.arts[0].effect === '自分のセンターの〈AZKi〉のエール1枚につき、このアーツ+20。');

  let state = collabFixture('hBP07-068', ['hY02-013', 'hY03-017', 'hY05-012']);
  let result = act(state, { type: 'collab', zone: 'back1' });
  check('Collab exposes only own-stage AZKi as target', result.pendingChoice?.options?.join() === 'center');
  result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex);
  check('purple AZKi can select only a purple Cheer from the full Cheer Deck', result.pendingChoice?.cards?.map(item => item.number).join() === 'hY05-012');
  const selected = result.pendingChoice?.cards?.[0];
  if (selected) result = act(result, { type: 'choose', cardIds: [selected.id] }, result.pendingChoice.playerIndex);
  check('selected Cheer moves to that AZKi and the Collab sequence completes', !result.pendingChoice && result.players[0].zones.center.cheer.some(item => item.id === selected?.id));

  state = collabFixture('hBP07-068', ['hY02-013', 'hY03-017', 'hY06-012']);
  const originalOrder = state.players[0].cheerDeck.map(item => item.id);
  result = act(state, { type: 'collab', zone: 'back1' });
  result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex);
  check('no matching Cheer still performs the mandatory multi-card shuffle and moves nothing', !result.pendingChoice && result.players[0].cheerDeck.map(item => item.id).join() !== originalOrder.join() && result.players[0].zones.center.cheer.length === 0);

  for (const count of [0, 1, 3]) {
    state = artsFixture('hBP01-046', count);
    result = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
    check(`Arts uses only ${count} Cheer on own Center AZKi (+${count * 20})`, result.players[1].zones.center.damage === 20 + count * 20 && result.players[0].zones.collab.rested);
  }

  state = artsFixture('hBP02-024', 4, 5, 6);
  result = act(state, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  check('Arts excludes backline and opponent AZKi, and a Center AZKi covered by another Holomem', result.players[1].zones.center.damage === 20);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalogue is missing hBP09-036';
