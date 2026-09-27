import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-042');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-042-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function replaceStage(player, zones = {}) {
  for (const old of Object.values(player.zones)) if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function player(name, oshi) {
  return {
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
    archive: [], holoPower: [], life: ['hY01-001', 'hY02-001', 'hY03-001', 'hY04-001', 'hY05-001'].map(instance),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState() {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Kaela', 'hBP09-004'), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null,
    log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-042');
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}

function attackFixture({ archive = ['hBP09-106', 'hBP09-041'], targetDamage = 60 } = {}) {
  const state = baseState();
  state.phase = 'performance';
  replaceStage(state.players[0], { center: unit('hBP09-042') });
  state.players[0].zones.center.cheer = ['hY03-017', 'hY03-017'].map(instance);
  state.players[0].archive = archive.map(instance);
  state.players[0].turnEvents = turnEvents(state.turn);
  replaceStage(state.players[1], { center: unit('hBP09-064'), back1: unit('hBP09-064') });
  state.players[1].zones.center.damage = targetDamage;
  state.players[1].turnEvents = turnEvents(state.turn);
  state.players[1].life = ['hY01-001', 'hY02-001', 'hY03-001', 'hY04-001', 'hY05-001'].map(instance);
  return state;
}

function incomingDownFixture(top = 'hBP09-042', priorDamage = 120) {
  const state = baseState();
  state.activePlayer = 1;
  state.phase = 'performance';
  state.players.forEach(entry => { entry.turnsTaken = 3; entry.turnEvents = turnEvents(state.turn); });
  replaceStage(state.players[1], { center: unit('hBP09-023') });
  state.players[1].zones.center.cheer = ['hY01-015', 'hY01-015', 'hY01-015'].map(instance);
  replaceStage(state.players[0], { center: unit(top), back1: unit('hBP09-064') });
  if (top === 'hBP09-043') state.players[0].zones.center.stack = [instance('hBP09-042'), instance('hBP09-043')];
  state.players[0].zones.center.damage = priorDamage;
  state.players[0].life = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014', 'hY05-012'].map(instance);
  return state;
}

function act(state, action, playerIndex = 0) { return applyAction(state, playerIndex, action, cards, () => 0.4); }

function resolve(state, limit = 30) {
  for (let index = 0; state.pendingChoice && index < limit; index += 1) {
    const choice = state.pendingChoice;
    let answer;
    if (choice.type === 'cardSelection') answer = { cardIds: choice.selectableIds.slice(0, choice.min || 0) };
    else if (choice.type === 'optionChoice') answer = { optionId: choice.modeOptions[0].id, option: choice.modeOptions[0].id, mode: choice.modeOptions[0].id };
    else if (choice.optional) answer = { skip: true };
    else answer = { zone: choice.options?.[0], targetZone: choice.options?.[0] };
    state = act(state, { type: 'choose', ...answer }, choice.playerIndex);
  }
  if (state.pendingChoice) throw new Error(`Unresolved choice: ${state.pendingChoice.type}`);
  return state;
}

function run() {
  const expectedGift = 'このホロメンが相手のホロメンをダウンさせた時、自分のアーカイブのホロメン1枚を手札に戻す。';
  const expectedArts = "自分のアーカイブの#カエラ'sアームズを持つツール1枚をこのホロメンに付ける。";
  const expectedExtra = 'このホロメンがダウンした時、自分のライフ-2';

  const paidState = attackFixture();
  let paid = act(paidState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const artsTargets = paid.pendingChoice?.selectableIds?.map(id => paid.players[0].archive.find(entry => entry.id === id)?.number) || [];
  paid = act(paid, { type: 'choose', cardIds: [paid.pendingChoice.selectableIds[0]] }, paid.pendingChoice.playerIndex);
  const giftTargets = paid.pendingChoice?.selectableIds?.map(id => paid.players[0].archive.find(entry => entry.id === id)?.number) || [];
  paid = act(paid, { type: 'choose', cardIds: [paid.pendingChoice.selectableIds[0]] }, paid.pendingChoice.playerIndex);
  paid = resolve(paid);

  const empty = resolve(act(attackFixture({ archive: [] }), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const buzz = resolve(act(incomingDownFixture(), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 1));
  const covered = resolve(act(incomingDownFixture('hBP09-043', 80), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 1));

  const checks = [
    { name: 'official catalog identity and Japanese Gift, Arts, and Extra clauses', pass: card?.typeCode === 'buzzCharacter' && card.stage === '1st' && card.hp === 240 && card.arts[0].damage === 70 && card.arts[0].effect === expectedArts && card.keyword.effect === expectedGift && card.extra === expectedExtra },
    { name: 'real Arts exposes only a matching Arms Tool, then the Down Gift only an archived Holomem', pass: JSON.stringify(artsTargets) === JSON.stringify(['hBP09-106']) && JSON.stringify(giftTargets) === JSON.stringify(['hBP09-041']) },
    { name: 'after resolving both selections, Tool attaches, one Holomem returns, and the target is Downed', pass: paid.pendingChoice === null && paid.players[0].zones.center.attachments.some(entry => entry.number === 'hBP09-106') && paid.players[0].hand.filter(entry => entry.number === 'hBP09-041').length === 1 && paid.players[1].zones.center === null && paid.players[1].life.length === 4 },
    { name: 'no eligible Tool or archived Holomem opens no impossible selection and the Arts damage still resolves', pass: empty.pendingChoice === null && empty.players[0].hand.length === 0 && empty.players[1].zones.center === null && empty.players[1].life.length === 4 },
    { name: 'active-top 042 Buzz Down loses exactly two Life', pass: buzz.players[0].zones.center === null && buzz.players[0].life.length === 3 && buzz.lifeLosses.filter(entry => entry.ownerIndex === 0).length === 2 },
    { name: 'covering the Buzz with non-Buzz 2nd uses only ordinary one-Life Down processing', pass: covered.players[0].zones.center === null && covered.players[0].life.length === 4 && covered.lifeLosses.filter(entry => entry.ownerIndex === 0).length === 1 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { artsTargets, giftTargets, lifeAfterBuzz: buzz.players[0].life.length, lifeAfterCovered: covered.players[0].life.length } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-042';
