import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-030');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-030-${++serial}`, number });
const unit = (number, damage = 0) => ({ stack: [instance(number)], cheer: [], attachments: [], damage, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function player(name, oshi) {
  return {
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 30 }, () => instance('hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState() {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Noel', 'hBP09-003'), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones = { center: unit('hBP09-064', 20), collab: null, back1: unit('hBP09-030'), back2: unit('hBP09-064', 20), back3: null, back4: null, back5: null };
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}

function archiveGyudon(state, count) {
  const owner = state.players[0];
  for (let index = 0; index < count; index += 1) {
    const instance = owner.mainDeck.pop();
    instance.number = 'hBP09-100';
    owner.archive.push(instance);
  }
}

function act(state, action, playerIndex = 0, random = () => 0.4) {
  return applyAction(state, playerIndex, action, cards, random);
}

function run() {
  const collab = baseState();
  archiveGyudon(collab, 2);
  let distributed = act(collab, { type: 'collab', zone: 'back1' });
  const firstChoice = distributed.pendingChoice;
  if (firstChoice?.type !== 'healDistribution' || firstChoice.count !== 2 || firstChoice.unitAmount !== 10) throw new Error(`Expected two 10-HP allocations, received ${firstChoice?.type || 'none'}`);
  distributed = act(distributed, { type: 'choose', allocations: { center: 1, back2: 1 } }, firstChoice.playerIndex);

  const zero = baseState();
  const zeroResult = act(zero, { type: 'collab', zone: 'back1' });

  const capped = baseState();
  capped.players[0].zones.center.damage = 5;
  archiveGyudon(capped, 3);
  let cappedChoice = act(capped, { type: 'collab', zone: 'back1' });
  const capPending = cappedChoice.pendingChoice;
  cappedChoice = act(cappedChoice, { type: 'choose', allocations: { center: 1, back2: 2 } }, capPending.playerIndex);

  const fullTarget = baseState();
  fullTarget.players[0].zones.back2.damage = 0;
  archiveGyudon(fullTarget, 2);
  let fullTargetPending = act(fullTarget, { type: 'collab', zone: 'back1' });
  const fullTargetChoice = fullTargetPending.pendingChoice;
  fullTargetPending = act(fullTargetPending, { type: 'choose', allocations: { center: 1, back2: 1 } }, fullTargetChoice.playerIndex);

  const arts = baseState();
  arts.phase = 'performance';
  arts.players[0].zones = { center: unit('hBP09-030'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  arts.players[0].zones.center.cheer = ['hY02-013', 'hY02-013'].map(instance);
  arts.players[1].zones = { center: unit('hBP03-066'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  archiveGyudon(arts, 2);
  const artResult = act(arts, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });

  const gyudonEvent = baseState();
  gyudonEvent.phase = 'performance';
  gyudonEvent.players[0].zones = { center: unit('hBP09-030'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  gyudonEvent.players[0].zones.center.cheer = ['hY02-013', 'hY02-013'].map(instance);
  gyudonEvent.players[1].zones = { center: unit('hBP03-066'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  archiveGyudon(gyudonEvent, 1);
  const unrelatedEvent = gyudonEvent.players[0].mainDeck.pop();
  unrelatedEvent.number = 'hBP09-104';
  gyudonEvent.players[0].archive.push(unrelatedEvent);
  const gyudonEventResult = act(gyudonEvent, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });

  const checks = [
    { name: 'official hBP09-030 U/S identity and Japanese text are present', pass: card?.stage === '2nd' && card.hp === 220 && card.variants.some(v => v.rarity === 'U') && card.variants.some(v => v.rarity === 'S') && card.keyword.effect === '自分のアーカイブの〈牛丼〉1枚につき、自分のホロメン1人のHP10回復。' && card.arts[0].effect === '自分のアーカイブの〈牛丼〉1枚につき、このアーツ+10。' },
    { name: 'two archived Gyudon create two separately assignable 10-HP heals', pass: distributed.pendingChoice === null && distributed.players[0].zones.center.damage === 10 && distributed.players[0].zones.back2.damage === 10 },
    { name: 'three heals cap at remaining damage after allocation', pass: cappedChoice.pendingChoice === null && cappedChoice.players[0].zones.center.damage === 0 && cappedChoice.players[0].zones.back2.damage === 0 },
    { name: 'a full own Holomem is still an eligible recovery target', pass: fullTargetChoice.options.includes('back2') && fullTargetPending.pendingChoice === null && fullTargetPending.players[0].zones.center.damage === 10 && fullTargetPending.players[0].zones.back2.damage === 0 },
    { name: 'zero archived Gyudon opens no empty target prompt', pass: zeroResult.pendingChoice === null && zeroResult.players[0].zones.center.damage === 20 && zeroResult.players[0].zones.back2.damage === 20 },
    { name: 'Arts is 100 + 2 Gyudon × 10 + 50 against Yellow', pass: artResult.players[1].zones.center.damage === 170 },
    { name: 'hBP09-100 counts as Gyudon but another Event does not', pass: gyudonEventResult.players[1].zones.center.damage === 160 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { firstPendingChoice: firstChoice, healedCenterDamage: distributed.players[0].zones.center.damage, healedBack2Damage: distributed.players[0].zones.back2.damage, zeroPendingChoice: zeroResult.pendingChoice, artsDamage: artResult.players[1].zones.center.damage } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-030';
