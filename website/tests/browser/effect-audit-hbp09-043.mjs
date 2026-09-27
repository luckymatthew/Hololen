import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-043');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-043-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function player(name, oshi) {
  return { name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: Array.from({ length: 20 }, () => instance('hBP09-051')), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [], life: ['hY01-001', 'hY02-001', 'hY03-001', 'hY04-001', 'hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 };
}

function baseState(phase = 'main') {
  const state = { status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1, players: [player('Kaela', 'hBP09-004'), player('Opponent', 'hBP09-006')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-042');
  state.players[1].zones.center = unit('hBP09-041');
  return state;
}

function act(state, action, playerIndex = 0) { return applyAction(state, playerIndex, action, cards, () => 0.4); }

function collabFixture({ tools = ['hBP09-106', 'hBP09-107'], opponentTools = [], archive = ['hY01-001', 'hBP09-108'] } = {}) {
  const state = baseState();
  state.players[0].zones.back1 = unit('hBP09-043');
  state.players[0].zones.center.attachments = tools.slice(0, 1).map(instance);
  state.players[0].zones.back1.attachments = tools.slice(1).map(instance);
  state.players[0].archive = archive.map(instance);
  state.players[1].zones.center.attachments = opponentTools.map(instance);
  return state;
}

function answer(state, action) {
  const owner = state.pendingChoice.playerIndex;
  return act(state, { type: 'choose', ...action }, owner);
}

function run() {
  let collab = act(collabFixture(), { type: 'collab', zone: 'back1' });
  const cheerChoice = collab.pendingChoice?.cards?.map(item => item.number) || [];
  const cheerId = collab.pendingChoice?.selectableIds?.[0];
  collab = answer(collab, { cardIds: [cheerId] });
  const hasOwnTarget = collab.pendingChoice?.options?.includes('center');
  collab = answer(collab, { zone: 'center' });

  const belowThreshold = act(collabFixture({ tools: ['hBP09-106', 'hBP09-108'], opponentTools: ['hBP09-107'] }), { type: 'collab', zone: 'back1' });

  const yellow = baseState('performance');
  yellow.players[0].zones.center = unit('hBP09-043');
  yellow.players[0].zones.center.cheer = [instance('hY03-017')];
  yellow.players[1].zones.center = unit('hBP03-064');
  yellow.players[1].zones.collab = unit('hBP09-040');
  yellow.players[1].zones.collab.damage = 20;
  yellow.players[1].zones.back1 = unit('hBP09-041');
  const arts = act(yellow, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });

  const noCollab = baseState('performance');
  noCollab.players[0].zones.center = unit('hBP09-043');
  noCollab.players[0].zones.center.cheer = [instance('hY03-017')];
  noCollab.players[1].zones.collab = null;
  const ordinary = act(noCollab, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });

  const sameTarget = baseState('performance');
  sameTarget.players[0].zones.center = unit('hBP09-043');
  sameTarget.players[0].zones.center.cheer = [instance('hY03-017')];
  sameTarget.players[1].zones.collab = unit('hBP03-064');
  sameTarget.players[1].zones.collab.damage = 20;
  let sameTargetResult = act(sameTarget, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'collab' });
  const oneDown = sameTargetResult.knockouts.length === 1 && sameTargetResult.knockouts[0].byArts === true && sameTargetResult.lifeLosses.filter(entry => entry.ownerIndex === 1).length === 1 && sameTargetResult.players[1].zones.collab === null && sameTargetResult.pendingChoice?.type === 'lifeCheerTarget';
  sameTargetResult = answer(sameTargetResult, { zone: 'center' });

  const checks = [
    { name: 'official current Japanese card identity and both effect clauses', pass: card?.jpName === 'カエラ・コヴァルスキア' && card.stage === '2nd' && card.hp === 200 && card.keyword.effect.includes('2枚以上') && card.arts[0].damage === 60 && card.arts[0].specialTargets?.[0] === '黃' && card.arts[0].specialValues?.[0] === 50 && card.arts[0].effect === '相手のコラボホロメンに特殊ダメージ30を与える。' },
    { name: 'two own matching Tools allow exactly one archived Cheer and an own destination', pass: JSON.stringify(cheerChoice) === JSON.stringify(['hY01-001']) && hasOwnTarget && collab.pendingChoice === null && collab.players[0].zones.center.cheer.some(item => item.id === cheerId) && collab.players[0].holoPower.length === 1 },
    { name: 'opponent and untagged Tools do not satisfy the own matching Tool threshold', pass: belowThreshold.pendingChoice === null && belowThreshold.players[0].zones.center.cheer.length === 0 && belowThreshold.players[0].archive.some(item => item.number === 'hY01-001') },
    { name: 'Yellow Arts target gets +50 while opposing Collab independently receives 30 Special damage', pass: arts.players[1].zones.center.damage === 110 && arts.players[1].zones.collab.damage === 50 && arts.players[1].zones.back1.damage === 0 && arts.players[0].zones.center.rested && arts.players[0].zones.center.cheer.length === 1 },
    { name: 'without an opposing Collab, the ordinary 60 Arts still settles', pass: ordinary.pendingChoice === null && ordinary.players[1].zones.center.damage === 60 && ordinary.players[0].zones.center.rested },
    { name: '30 Special plus 110 Yellow Arts damage commit one Down at the Arts-resolution boundary', pass: oneDown && sameTargetResult.pendingChoice === null && sameTargetResult.players[1].zones.center.cheer.length === 1 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { recoveredCheer: collab.players[0].zones.center.cheer.map(item => item.number), yellowArtsDamage: arts.players[1].zones.center.damage, existingCollabDamage: 20, specialDamageApplied: arts.players[1].zones.collab.damage - 20 } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-043';
