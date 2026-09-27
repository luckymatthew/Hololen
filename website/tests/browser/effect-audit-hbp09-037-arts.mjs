import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const catalog = (await response.json()).cards;
const yellow = { number: 'AUDIT-YELLOW-TARGET', name: 'Audit Yellow Target', jpName: 'Audit Yellow Target', group: 'holomem', typeCode: 'character', type: 'Holomen', stage: '1st', hp: 9999, colors: ['黃'], tags: [], baton: 0, arts: [{ name: 'No-op', damage: 0, cost: [], effect: '' }] };
const green = { ...yellow, number: 'AUDIT-GREEN-TARGET', colors: ['綠'] };
const cards = [...catalog, yellow, green];
const card = catalog.find(entry => entry.number === 'hBP09-037');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-037-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
function fixture(oshi = 'hSD10-001', target = yellow.number) {
  const player = name => ({ name, oshi: instance('hSD10-001'), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 10 }, () => instance('hBP09-051')), cheerDeck: [], archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 });
  const state = { status: 'playing', phase: 'performance', turn: 3, activePlayer: 0, firstPlayer: 1, players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].oshi = instance(oshi);
  state.players[0].zones.center = unit('hBP09-037');
  state.players[0].zones.center.cheer = [instance('hY02-013'), instance('hY02-013'), instance('hY01-015')];
  state.players[0].zones.collab = unit('hBP09-036');
  state.players[0].zones.collab.cheer = [instance('hY02-013')];
  state.players[0].zones.back1 = { ...unit('hBP09-031'), stack: [instance('hBP09-030'), instance('hBP09-031')] };
  state.players[0].zones.back2 = unit('hBP01-048');
  state.players[1].zones.center = unit(target);
  return state;
}
const attack = (state, oshi = 'hSD10-001', target = yellow.number) => {
  const configured = fixture(oshi, target);
  return applyAction(configured, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.4);
};
function run() {
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('packaged R/SR catalog has 2nd green 200 HP, correct Japanese Arts, 80 base, and Yellow +50', card?.jpName === '輪堂千速' && card.stage === '2nd' && card.hp === 200 && ['R', 'SR'].every(rarity => card.variants.some(variant => variant.rarity === rarity)) && card.arts?.[0]?.effect === '自分の推しホロメンが〈輪堂千速〉なら、自分のステージのDebut以外のホロメン1人につき、このアーツ+30。' && card.arts[0].damage === 80 && card.arts[0].specialTargets?.join() === '黃' && card.arts[0].specialValues?.[0] === 50);
  let state = fixture();
  const costIds = state.players[0].zones.center.cheer.map(item => item.id);
  let result = applyAction(state, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.4);
  check('Chihaya Oshi counts Center, Collab, and one Bloomed Back once each, excludes Debut, and applies Yellow +50', result.players[1].zones.center.damage === 220);
  check('Arts rests the attacker but its three cost Cheer remain attached', result.players[0].zones.center.rested && result.players[0].zones.center.cheer.map(item => item.id).join() === costIds.join());
  result = attack(state, 'hBP09-001', yellow.number);
  check('non-Chihaya Oshi suppresses only the stage-count bonus; Yellow +50 still applies', result.players[1].zones.center.damage === 130);
  result = attack(state, 'hBP09-001', green.number);
  check('non-Chihaya Oshi against non-Yellow target leaves base damage 80', result.players[1].zones.center.damage === 80);
  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalogue is missing hBP09-037';
