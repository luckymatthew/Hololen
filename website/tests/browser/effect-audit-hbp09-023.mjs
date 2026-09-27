import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const zeta = cards.find(card => card.number === 'hBP09-023');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-023-${++serial}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer: cheer.map(card => typeof card === 'string' ? instance(card) : card),
  attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0,
  collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const cheer = count => Array.from({ length: count }, (_, index) => index < 2 ? 'hY01-015' : 'hY02-013');

function player(name, oshi = 'hBP09-001') {
  return {
    name, oshi: instance(oshi),
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP04-069')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [],
    holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8),
    oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseFixture({ phase = 'performance', sourceZone = 'center', useSkill = false } = {}) {
  const players = [player('Audit', 'hBP07-002'), player('Opponent', 'hBP09-001')];
  const owner = players[0];
  owner.holoPower = Array.from({ length: 10 }, () => instance('hY01-001'));
  owner.zones.center = sourceZone === 'center' ? unit('hBP09-023', cheer(3)) : unit('hBP09-064');
  owner.zones.back1 = unit('hBP09-064');
  if (sourceZone === 'collab') {
    owner.zones.collab = unit('hBP09-023', cheer(3));
    owner.zones.collab.collabbedTurn = 8;
    owner.collabTurn = 8;
  }
  owner.oshiSkillTurn = useSkill ? 8 : 0;
  players[1].zones.center = unit('hBP09-023');
  players[1].zones.back1 = unit('hBP09-064');
  return { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function apply(state, action, playerIndex = state.pendingChoice?.playerIndex ?? state.activePlayer, random = () => 0.5) {
  return applyAction(state, playerIndex, action, cards, random);
}
function check(condition, message) { if (!condition) throw new Error(message); }
function settle(state, random = () => 0.5) {
  for (let count = 0; state.pendingChoice && count < 30; count += 1) {
    const pending = state.pendingChoice;
    const answer = pending.type === 'cardSelection'
      ? { cardIds: pending.selectableIds.slice(0, pending.min || 0) }
      : pending.type === 'optionChoice' && pending.optional
        ? { skip: true }
        : { zone: pending.options?.[0], targetZone: pending.options?.[0] };
    state = apply(state, { type: 'choose', ...answer }, pending.playerIndex, random);
  }
  check(!state.pendingChoice, 'a browser fixture did not finish its pending choices');
  return state;
}

function resolveZetaSkill(state) {
  let result = apply(state, { type: 'oshiSkill' }, 0);
  check(result.pendingChoice?.type === 'stageTarget', 'Zeta Oshi skill must request a Stage target');
  check(result.pendingChoice.options.includes('back1'), 'a Back Holomem is a legal skill target');
  result = apply(JSON.parse(JSON.stringify(result)), { type: 'choose', zone: 'back1' }, 0);
  check(result.players[0].oshiSkillTurn === result.turn, 'skill usage is recorded on the current turn');
  return result;
}

function run() {
  check(zeta, 'hBP09-023 is missing from current cards.json');
  const centerSkill = resolveZetaSkill(baseFixture({ phase: 'main', sourceZone: 'center' }));
  let center = apply(centerSkill, { type: 'advance' }, 0);
  check(center.phase === 'performance', 'the actual main-step transition reaches Performance');
  center = apply(center, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
  const centerDamage = center.players[1].zones.center.damage;

  let collab = resolveZetaSkill(baseFixture({ phase: 'main', sourceZone: 'collab' }));
  collab = apply(collab, { type: 'advance' }, 0);
  collab = apply(collab, { type: 'attack', sourceZone: 'collab', artIndex: 0, targetZone: 'center' }, 0);
  const collabDamage = collab.players[1].zones.center.damage;

  const noSkill = baseFixture({ sourceZone: 'center' });
  const noSkillResult = apply(noSkill, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
  const noSkillDamage = noSkillResult.players[1].zones.center.damage;

  const lowCost = baseFixture({ sourceZone: 'center' });
  lowCost.players[0].zones.center.cheer = cheer(2).map(instance);
  let costRejected = false;
  try { apply(lowCost, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0); }
  catch { costRejected = true; }

  const gift = baseFixture({ sourceZone: 'center' });
  gift.players[0].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  gift.players[1].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  gift.players[1].zones.center = unit('hBP09-016');
  let giftResult = apply(gift, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
  const q718Ordering = giftResult.players[1].zones.center?.downPending === true
    && giftResult.players[0].turnEvents.dice.map(roll => roll.value).join(',') === '4,4'
    && giftResult.lifeLosses[0]?.sourceName === 'hBP09-023'
    && giftResult.players[1].life.length === 3;
  giftResult = settle(giftResult);
  const q718NormalDownAfterGift = giftResult.players[1].zones.center === null
    && giftResult.players[1].life.length === 2
    && giftResult.lifeLosses.map(loss => loss.sourceName).join(',') === 'hBP09-023,轟一';

  const mismatch = baseFixture({ sourceZone: 'center' });
  mismatch.players[0].modifiers = [{ kind: 'dieOverride', amount: 1, expiresTurn: 8 }];
  mismatch.players[0].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  mismatch.players[1].life = Array.from({ length: 4 }, () => instance('hY01-001'));
  mismatch.players[1].zones.center = unit('hBP09-018');
  mismatch.players[1].zones.center.damage = 150;
  const mismatchResult = apply(mismatch, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, () => 0);
  const mismatchNoGift = mismatchResult.players[0].turnEvents.dice.map(roll => roll.value).join(',') === '1,1'
    && mismatchResult.players[1].life.length === 3
    && mismatchResult.lifeLosses.every(loss => loss.sourceName !== 'hBP09-023');

  const buzz = baseFixture({ sourceZone: 'center' });
  buzz.players[0].oshi = instance('hBP09-001');
  buzz.players[1].zones.center = unit('hBP09-023');
  buzz.players[1].zones.center.damage = 140;
  let buzzResult = apply(buzz, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0);
  const buzzLifeLoss = buzzResult.players[1].zones.center === null && buzzResult.players[1].life.length === 3;
  buzzResult = settle(buzzResult);
  const buzzSingleReplacement = buzzResult.players[1].life.length === 3 && buzzResult.lifeLosses.filter(loss => loss.ownerIndex === 1).length === 2;

  const printingText = ['hbp09-hBP09-023_R', 'hbp09-hBP09-023_SR'].every(id => zeta.variants.some(variant => variant.id === id))
    && zeta.hp === 220 && zeta.extra === 'このホロメンがダウンした時、自分のライフ-2'
    && zeta.keyword.effect === 'このホロメンが相手のホロメンをダウンさせた時、自分の推しホロメンが〈ベスティア・ゼータ〉なら、サイコロを2回振る。出た目の合計数がお互いのライフの合計数と同じなら、相手のライフ-1。'
    && zeta.arts[0].effect.includes('Good Luck, holoh3ro!');

  const checks = [
    { name: 'actual Zeta Oshi skill target persists and Center Arts deals 200', pass: centerDamage === 200 },
    { name: 'current-turn skill does not grant the Center-only bonus in Collab', pass: collabDamage === 120 },
    { name: 'no matching current-turn skill leaves Center Arts at 120', pass: noSkillDamage === 120 },
    { name: 'two White Cheer alone fails the White+White+Colorless cost check', pass: costRejected },
    { name: 'Q718 matching Gift resolves before the ordinary Down Life damage', pass: q718Ordering && q718NormalDownAfterGift },
    { name: 'non-matching dice produce no Gift Life loss', pass: mismatchNoGift },
    { name: 'Buzz Extra replaces the ordinary Down loss with exactly two Life', pass: buzzLifeLoss && buzzSingleReplacement },
    { name: 'catalogue retains R/SR identity, 220 HP, and all Japanese clauses', pass: printingText },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { centerDamage, collabDamage, noSkillDamage, costRejected, q718Ordering, q718NormalDownAfterGift, mismatchNoGift, buzzLifeLoss, buzzSingleReplacement, printingText } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  check(passed === checks.length, `${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = zeta ? `Ready: ${zeta.number} · ${zeta.jpName}` : 'FAIL: current catalogue is missing hBP09-023';
