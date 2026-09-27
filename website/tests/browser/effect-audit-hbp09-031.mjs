import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-031');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-031-${++serial}`, number });
const unit = (number, damage = 0, cheer = []) => ({ stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const player = (name, oshi) => ({
  name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: Array.from({ length: 36 }, () => instance('hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
  archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {},
  turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function stateFor({ oshi = 'hBP09-006', centerDamage = 210, sourceDamage = 20, target = 'hBP09-029' } = {}) {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1, players: [player('Noel', oshi), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].turnEvents.turn = state.turn;
  state.players[0].zones = { center: unit('hBP09-031', centerDamage, ['hY02-013', 'hY02-013', 'hY02-013', 'hY02-013']), collab: null, back1: unit('hBP09-031', 180), back2: unit('hBP09-030', 100), back3: null, back4: null, back5: null };
  state.players[1].zones.center = unit(target);
  return state;
}
const act = (value, action, playerIndex = 0) => applyAction(value, playerIndex, action, cards, () => 0.4);
function healWithEvent(value, eventNumber, zone = 'center') {
  const source = instance(eventNumber);
  value.players[0].hand.push(source);
  let next = act(value, { type: 'play', cardId: source.id });
  const effect = next.pendingChoice?.effect;
  if (!['hbp09', 'healAndModifier'].includes(effect)) throw new Error(`Expected Noel recovery choice, received ${effect || next.pendingChoice?.type}`);
  next = act(next, { type: 'choose', ...(effect === 'hbp09' ? { ref: 'noel' } : {}), zone }, next.pendingChoice.playerIndex);
  return next;
}

function run() {
  if (!card) throw new Error('Current card catalogue is missing hBP09-031');
  const once = healWithEvent(stateFor(), 'hBP09-100');
  const again = healWithEvent(once, 'hBP09-100');
  const oldBowl = healWithEvent(stateFor(), 'hBP05-075');
  const exact = stateFor({ oshi: 'hBP09-003', centerDamage: 20 }); exact.phase = 'performance';
  const exactResult = act(exact, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const below = stateFor({ oshi: 'hBP05-001', centerDamage: 21 }); below.phase = 'performance';
  const belowResult = act(below, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const unrelatedOshi = stateFor({ oshi: 'hBP09-006' }); unrelatedOshi.phase = 'performance';
  const unrelatedResult = act(unrelatedOshi, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const checks = [
    { name: 'current catalog identity, Gift/Arts text and RR/SR/UR printings', pass: card.jpName === '白銀ノエル' && card.hp === 220 && card.variants.some(v => v.rarity === 'RR') && card.variants.some(v => v.rarity === 'SR') && card.variants.some(v => v.rarity === 'UR') && card.keyword.effect === '[ターンに1回]このホロメンが〈牛丼〉の能力で回復するHP+100。' && card.arts[0].damage === 10 && card.arts[0].effect.includes('残りHPが200以上') },
    { name: 'hBP09-100 Gyudon receives the printed 50 plus Gift 100', pass: once.players[0].zones.center.damage === 60 },
    { name: 'second Gyudon in the same turn cannot reuse that Noel copy Gift', pass: again.players[0].zones.center.damage === 10 },
    { name: 'older hBP05-075 Gyudon recovers 20 plus 100 while retaining its modifier', pass: oldBowl.players[0].zones.center.damage === 90 && oldBowl.players[0].zones.center.modifiers.some(m => m.kind === 'batonCost' && m.amount === -2) },
    { name: 'remaining HP threshold applies at 200 and stops below it', pass: exactResult.players[1].zones.center.damage === 210 && belowResult.players[1].zones.center.damage === 10 },
    { name: 'Noel Oshi name is required for the +200 Arts', pass: unrelatedResult.players[1].zones.center.damage === 10 },
  ];
  const passed = checks.filter(check => check.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}

document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-031';
