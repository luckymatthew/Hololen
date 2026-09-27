import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-029');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-029-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function replaceStage(player, zones = {}) {
  for (const old of Object.values(player.zones)) if (old) player.archive.push(...old.stack, ...old.cheer, ...old.attachments);
  player.zones = { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones };
}

function player(name, oshi, deck) {
  return {
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: deck.map(instance), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1,
  };
}

function baseState(deck) {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Noel', 'hBP09-003', deck), player('Opponent', 'hBP09-006', [])], effectQueue: [],
    pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-029');
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}

function downState(top, priorDamage) {
  const state = baseState([]);
  state.phase = 'performance';
  replaceStage(state.players[0], { center: unit('hBP09-023') });
  state.players[0].zones.center.cheer = ['hY01-015', 'hY01-015', 'hY01-015'].map(instance);
  state.players[0].turnEvents = turnEvents(state.turn);
  const defender = state.players[1];
  replaceStage(defender, { center: unit(top), back1: unit('hBP09-064') });
  if (top === 'hBP09-031') defender.zones.center.stack = [instance('hBP09-029'), instance('hBP09-031')];
  defender.zones.center.damage = priorDamage;
  defender.archive.push(...defender.life);
  defender.life = ['hY01-015', 'hY02-013', 'hY03-017', 'hY04-014'].map(instance);
  defender.turnEvents = turnEvents(state.turn);
  return state;
}

function act(state, action, playerIndex = 0, random = () => 0.4) {
  return applyAction(state, playerIndex, action, cards, random);
}

function resolve(state, limit = 30) {
  for (let i = 0; state.pendingChoice && i < limit; i += 1) {
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
  const expectedArts = '自分のデッキから、2nd〈白銀ノエル〉1枚を公開し、手札に加える。そしてデッキをシャッフルする。';
  const expectedExtra = 'このホロメンがダウンした時、自分のライフ-2';
  const deck = ['hBP05-012', 'hBP07-022', 'hBP09-030', 'hBP09-031', 'hBP09-022', 'hBP09-104'];
  const foundState = baseState(deck);
  foundState.phase = 'performance';
  foundState.players[0].zones.center.cheer = ['hY02-013', 'hY02-013', 'hY01-015'].map(instance);
  foundState.players[0].turnEvents = turnEvents(foundState.turn);
  let shuffleCalls = 0;
  let found = act(foundState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, () => { shuffleCalls += 1; return 0.4; });
  const legal = found.pendingChoice?.selectableIds?.map(id => found.players[0].mainDeck.find(entry => entry.id === id)?.number) || [];
  const targetId = found.pendingChoice?.selectableIds?.at(-1);
  if (!targetId) throw new Error('Expected a selectable 2nd Noel');
  found = act(found, { type: 'choose', cardIds: [targetId] }, found.pendingChoice.playerIndex, () => { shuffleCalls += 1; return 0.4; });

  const missState = baseState(['hBP09-022', 'hBP09-023', 'hBP09-104', 'hBP09-100']);
  missState.phase = 'performance';
  missState.players[0].zones.center.cheer = ['hY02-013', 'hY02-013', 'hY01-015'].map(instance);
  missState.players[0].turnEvents = turnEvents(missState.turn);
  let missShuffleCalls = 0;
  const missed = act(missState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, 0, () => { missShuffleCalls += 1; return 0.4; });

  const buzz = resolve(act(downState('hBP09-029', 160), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const ordinary = resolve(act(downState('hBP09-027', 40), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));
  const covered = resolve(act(downState('hBP09-031', 120), { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }));

  const checks = [
    { name: 'catalog contains hBP09-029 and exact Japanese Arts/Extra clauses', pass: card?.stage === '1st' && card.hp === 260 && card.variants.some(v => v.rarity === 'R') && card.variants.some(v => v.rarity === 'SR') && card.arts[0].effect === expectedArts && card.extra === expectedExtra },
    { name: 'real Arts selection includes every 2nd Noel and excludes other stages/types', pass: JSON.stringify(legal) === JSON.stringify(['hBP05-012', 'hBP07-022', 'hBP09-030', 'hBP09-031']) },
    { name: 'confirming the Noel reveals/adds one and shuffles once before 100 damage', pass: found.pendingChoice === null && found.players[0].hand.some(entry => entry.number === 'hBP09-031') && found.players[1].zones.center.damage === 100 && shuffleCalls === 4 },
    { name: 'no-match Arts still shuffles once and deals 100 (Q751)', pass: missed.pendingChoice === null && missed.players[1].zones.center.damage === 100 && missShuffleCalls === 3 },
    { name: 'active Buzz 029 Down replaces normal Life loss with exactly -2', pass: buzz.players[1].zones.center === null && buzz.players[1].life.length === 2 && buzz.lifeLosses.filter(entry => entry.ownerIndex === 1).length === 2 },
    { name: 'ordinary Noel Down remains exactly the normal -1', pass: ordinary.players[1].zones.center === null && ordinary.players[1].life.length === 3 && ordinary.lifeLosses.filter(entry => entry.ownerIndex === 1).length === 1 },
    { name: 'covering Buzz 029 with non-Buzz 2nd ends the -2 replacement', pass: covered.players[1].zones.center === null && covered.players[1].life.length === 3 && covered.lifeLosses.filter(entry => entry.ownerIndex === 1).length === 1 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { legal, selectedHand: found.players[0].hand.map(entry => entry.number), searchShuffleCalls: shuffleCalls, missedShuffleCalls: missShuffleCalls, lifeAfterBuzz: buzz.players[1].life.length, lifeAfterOrdinary: ordinary.players[1].life.length, lifeAfterCovered: covered.players[1].life.length } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-029';
