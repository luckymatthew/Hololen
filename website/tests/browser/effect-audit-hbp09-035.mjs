import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-035');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-035-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const events = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const player = (name, oshi) => ({
  name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017'][i % 3])),
  archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
  turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0, spOshiSkillUsed: false,
  collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function fixture(deckNumbers) {
  const state = { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Player', 'hBP07-003'), player('Opponent', 'hBP01-001')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  const owner = state.players[0];
  owner.zones = { center: unit('hBP09-035'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  owner.zones.center.cheer = Array.from({ length: 4 }, () => instance('hY02-001'));
  owner.mainDeck = deckNumbers.map(instance);
  state.players[1].zones = { center: unit('hBP05-050'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  return state;
}
const act = (state, action, playerIndex = 0) => applyAction(state, playerIndex, action, cards, () => 0.4);
const attack = state => act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
function run() {
  if (!card) throw new Error('Current card catalogue is missing hBP09-035');
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalogue identity, RR/SR/UR printings and exact Japanese Arts text', card.jpName === '大神ミオ' && card.stage === '2nd' && card.hp === 210 && ['RR', 'SR', 'UR'].every(rarity => card.variants.some(variant => variant.rarity === rarity)) && card.arts[0].effect === '自分のデッキの上から2枚をアーカイブできる:自分のステージのホロメン1人を選ぶ。この能力でアーカイブしたサポート1枚につき、このターンの間、選んだホロメンのアーツ+30。');

  for (const deckNumbers of [[], ['hBP09-100']]) {
    const state = fixture(deckNumbers);
    const deckIds = state.players[0].mainDeck.map(item => item.id);
    const cheerIds = state.players[0].zones.center.cheer.map(item => item.id);
    const result = attack(state);
    check(`zero/one deck card (${deckNumbers.length}): exact-two cost is unavailable while ordinary Arts resolves`, !result.pendingChoice && result.players[0].mainDeck.map(item => item.id).join() === deckIds.join() && result.players[0].archive.length === 0 && result.players[1].zones.center.damage === 230 && result.players[0].zones.center.rested && result.players[0].zones.center.cheer.map(item => item.id).join() === cheerIds.join());
  }

  const paid = fixture(['hBP09-100', 'hBP01-116']);
  const supportIds = paid.players[0].mainDeck.map(item => item.id);
  let result = attack(paid);
  check('two deck cards still offer the optional cost', result.pendingChoice?.type === 'optionChoice' && result.pendingChoice.modeOptions.some(option => option.id === 'yes'));
  result = act(result, { type: 'choose', optionId: 'yes', option: 'yes', mode: 'yes' }, result.pendingChoice.playerIndex);
  check('paying archives exactly two cards then asks for an own-stage target', result.pendingChoice?.type === 'stageTarget' && supportIds.every(id => result.players[0].archive.some(item => item.id === id)) && result.players[0].mainDeck.length === 0);
  result = act(result, { type: 'choose', zone: 'center' }, result.pendingChoice.playerIndex);
  check('two Support cards add +60 to the selected attacker before Blue +50, downing the 250 HP Buzz', !result.pendingChoice && result.log.some(entry => JSON.stringify(entry).includes('造成 290 傷害')) && result.players[1].life.length === 3);

  const declined = fixture(['hBP09-100', 'hBP01-116']);
  result = attack(declined);
  result = act(result, { type: 'choose', optionId: 'no', option: 'no', mode: 'no' }, result.pendingChoice.playerIndex);
  check('declining leaves deck and archive intact and resolves base plus Blue damage', !result.pendingChoice && result.players[0].mainDeck.length === 2 && result.players[0].archive.length === 0 && result.players[1].zones.center.damage === 230);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalogue is missing hBP09-035';
