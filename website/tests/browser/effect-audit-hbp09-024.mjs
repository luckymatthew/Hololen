import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const riona = cards.find(card => card.number === 'hBP09-024');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-024-${++serial}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer: cheer.map(card => typeof card === 'string' ? instance(card) : card), attachments: [],
  damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const white = count => Array.from({ length: count }, () => 'hY01-015');

function player(name) {
  return {
    name, oshi: instance('hBP09-001'),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP04-069')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [],
    life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {},
    turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function fixture({ sourceZone = 'center', roster = true, collab = 'hBP07-087' } = {}) {
  const players = [player('Audit'), player('Opponent')];
  const owner = players[0];
  owner.zones.center = sourceZone === 'center' ? unit('hBP09-024', white(2)) : unit('hBP09-064');
  owner.zones.collab = sourceZone === 'collab' ? unit('hBP09-024', white(2)) : unit(collab);
  if (sourceZone === 'center') {
    owner.zones.back1 = unit('hBP08-047');
    owner.zones.back2 = unit('hBP07-032');
    owner.zones.back3 = roster ? unit('hBP09-064') : null;
  } else {
    owner.zones.back1 = unit('hBP07-087');
    owner.zones.back2 = unit('hBP08-047');
    owner.zones.back3 = unit('hBP07-032');
    owner.zones.back4 = unit('hBP09-064');
  }
  players[1].zones.center = unit('hBP09-023');
  players[1].zones.back1 = unit('hBP09-064');
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function apply(state, action, playerIndex = state.pendingChoice?.playerIndex ?? state.activePlayer) {
  return applyAction(state, playerIndex, action, cards, () => 0.5);
}
function check(condition, message) { if (!condition) throw new Error(message); }
function settle(state) {
  for (let count = 0; state.pendingChoice && count < 30; count += 1) {
    const pending = state.pendingChoice;
    const answer = pending.type === 'cardSelection'
      ? { cardIds: pending.selectableIds.slice(0, pending.min || 0) }
      : pending.type === 'optionChoice' && pending.optional
        ? { skip: true }
        : { zone: pending.options?.[0], targetZone: pending.options?.[0] };
    state = apply(state, { type: 'choose', ...answer }, pending.playerIndex);
  }
  check(!state.pendingChoice, 'browser fixture did not finish its pending choices');
  return state;
}

function run() {
  check(riona?.jpName === '響咲リオナ' && riona.variants.some(v => v.rarity === 'R') && riona.variants.some(v => v.rarity === 'SR'), 'current catalog must contain Riona and both printings');
  const complete = apply(fixture(), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const fullRosterCenter = complete.players[1].zones.center.damage === 170;
  const missingMember = apply(fixture({ roster: false }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const missingNameBaseOnly = missingMember.players[1].zones.center.damage === 70;
  const collabRiona = apply(fixture({ sourceZone: 'collab' }), { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const collabGetsBaseOnly = collabRiona.players[1].zones.center.damage === 70;

  const gift = fixture({ collab: 'hBP09-070' });
  gift.players[0].zones.collab.cheer = white(3);
  gift.players[1].hand = [];
  const paidColorlessFlowArts = apply(gift, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  const giftKeepsCostCount = paidColorlessFlowArts.players[1].zones.center.damage === 120 && paidColorlessFlowArts.players[0].zones.collab.cheer.length === 3;

  let noCenterGiftRejected = false;
  try {
    const noGift = fixture({ collab: 'hBP09-070' });
    noGift.players[0].zones.center = unit('hBP09-023');
    noGift.players[0].zones.collab = unit('hBP09-070', white(3));
    apply(noGift, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' });
  } catch { noCenterGiftRejected = true; }
  let untaggedRejected = false;
  try {
    const untagged = fixture({ collab: 'hBP09-053' });
    untagged.players[0].zones.collab = unit('hBP09-053', white(3));
    apply(untagged, { type: 'attack', sourceZone: 'collab', artIndex: 1, targetZone: 'center' });
  } catch { untaggedRejected = true; }

  const down = fixture();
  down.players[0].oshi = instance('hBP09-001');
  down.players[0].zones.center = unit('hBP09-023', white(3));
  down.players[1].zones.center = unit('hBP09-024');
  down.players[1].zones.center.damage = 120;
  const completedDown = settle(apply(down, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const buzzExtraTwoLife = completedDown.players[1].zones.center === null && completedDown.players[1].life.length === 3 && completedDown.lifeLosses.filter(loss => loss.ownerIndex === 1).length === 2;

  const checks = [
    { name: 'R/SR identity matches current catalog', pass: true },
    { name: 'Center Arts gains +100 with all four specified Holomem', pass: fullRosterCenter },
    { name: 'missing one named Holomem leaves Arts at 70', pass: missingNameBaseOnly },
    { name: 'Collab Riona does not get the Center-only Arts bonus', pass: collabGetsBaseOnly },
    { name: 'Center Gift allows FLOW GLOW Collab Arts to pay three changed-color Cheer', pass: giftKeepsCostCount },
    { name: 'Gift is unavailable without Center Riona', pass: noCenterGiftRejected },
    { name: 'Gift does not affect an untagged Collab Holomem', pass: untaggedRejected },
    { name: 'Buzz Extra removes exactly two Life when Riona is Downed', pass: buzzExtraTwoLife },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { fullRosterCenter, missingNameBaseOnly, collabGetsBaseOnly, giftKeepsCostCount, noCenterGiftRejected, untaggedRejected, buzzExtraTwoLife } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  check(passed === checks.length, `${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = riona ? `Ready: ${riona.number} · ${riona.jpName}` : 'FAIL: current catalogue is missing hBP09-024';
