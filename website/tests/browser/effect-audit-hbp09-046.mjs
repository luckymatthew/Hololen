import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current website cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-046');
const debuts = cards.filter(entry => entry.group === 'holomem' && entry.jpName === '百鬼あやめ' && entry.stage === 'Debut').map(entry => entry.number);
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-046-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function baseState(stageCount = 6) {
  const zones = { center: unit('hBP09-001'), collab: null, back1: unit('hBP09-046'), back2: unit('hBP09-047'), back3: unit('hBP09-048'), back4: unit('hBP09-049'), back5: unit('hBP09-050') };
  if (stageCount < 6) zones.back5 = null;
  return {
    status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [
      { name: 'Player', oshi: instance('hBP09-001'), zones, hand: [], mainDeck: [instance('hBP09-047'), instance(debuts.find(number => number !== 'hBP09-046')), instance('hBP09-048'), instance('hBP09-049')], cheerDeck: [instance('hY03-001'), instance('hY04-001')], archive: [], holoPower: [], life: ['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
      { name: 'Opponent', oshi: instance('hBP09-006'), zones: { center: unit('hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: [], archive: [], holoPower: [], life: [], turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
    ],
    effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [],
  };
}

function act(state, action, random = () => 0.37) { return applyAction(state, 0, action, cards, random); }
function choose(state, action, random) { return act(state, { type: 'choose', ...action }, random); }

function run() {
  const artState = baseState(6);
  artState.phase = 'performance';
  artState.players[0].zones.center = unit('hBP09-046');
  artState.players[0].zones.center.cheer = [instance('hY03-001')];
  artState.players[1].zones.center = unit('hBP09-041');
  const paidCheerId = artState.players[0].zones.center.cheer[0].id;
  const artResult = act(artState, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  const printedArts = card?.arts?.[0];
  const artsResolve = printedArts?.name === '鬼の宴' && printedArts.damage === 20
    && artResult.players[1].zones.center.damage === 20
    && artResult.players[0].zones.center.rested
    && artResult.players[0].zones.center.cheer.map(item => item.id).join(',') === paidCheerId
    && artResult.pendingChoice === null;

  const full = baseState(6);
  const originalTopCheer = full.players[0].cheerDeck[0].id;
  const originalDeck = full.players[0].mainDeck.slice(1).map(item => item.id).sort();
  let shuffleCalls = 0;
  let result = act(full, { type: 'collab', zone: 'back1' }, () => { shuffleCalls += 1; return 0.37; });
  const collabResolved = result.players[0].zones.collab.stack.at(-1).number === 'hBP09-046' && result.players[0].holoPower.at(-1).number === 'hBP09-047';
  result = choose(result, { optionId: 'yes' }, () => { shuffleCalls += 1; return 0.37; });
  const fullStage = result.pendingChoice === null
    && result.players[0].archive.some(item => item.id === originalTopCheer)
    && result.players[0].mainDeck.map(item => item.id).sort().join(',') === originalDeck.join(',')
    && Object.values(result.players[0].zones).filter(Boolean).length === 6
    && shuffleCalls > 0;

  let room = baseState(5);
  room.players[0].zones.back5 = null;
  room = act(room, { type: 'collab', zone: 'back1' });
  room = choose(room, { optionId: 'yes' });
  const selectable = room.pendingChoice?.cards.find(item => debuts.includes(item.number));
  const offeredOne = room.pendingChoice?.type === 'cardSelection' && room.pendingChoice.max === 1 && Boolean(selectable);
  if (selectable) room = choose(room, { cardIds: [selectable.id] });
  const legalTarget = room.pendingChoice?.type === 'stageTarget' && room.pendingChoice.options.includes('back1');
  if (legalTarget) room = choose(room, { zone: 'back1' });
  const legalDeployment = Boolean(selectable) && room.players[0].zones.back1?.stack.at(-1).number === selectable.number && Object.values(room.players[0].zones).filter(Boolean).length === 6;

  const decline = baseState(6);
  const declinedCheer = decline.players[0].cheerDeck[0].id;
  let declineRandomCalls = 0;
  let declined = act(decline, { type: 'collab', zone: 'back1' }, () => { declineRandomCalls += 1; return 0.37; });
  const declinedDeck = declined.players[0].mainDeck.map(item => item.id);
  declined = choose(declined, { optionId: 'no' }, () => { declineRandomCalls += 1; return 0.37; });
  const optionalDecline = declined.pendingChoice === null && declined.players[0].cheerDeck[0].id === declinedCheer
    && declined.players[0].mainDeck.map(item => item.id).join(',') === declinedDeck.join(',') && declineRandomCalls === 0;

  const noTarget = baseState(5);
  noTarget.players[0].zones.back5 = null;
  noTarget.players[0].mainDeck = [instance('hBP09-047'), instance('hBP09-048'), instance('hBP09-049')];
  let noFindRandomCalls = 0;
  let noFind = act(noTarget, { type: 'collab', zone: 'back1' }, () => { noFindRandomCalls += 1; return 0.37; });
  noFind = choose(noFind, { optionId: 'yes' }, () => { noFindRandomCalls += 1; return 0.37; });
  const paidFailToFind = noFind.pendingChoice === null && noFind.players[0].zones.back1 === null && noFindRandomCalls > 0;

  const checks = [
    { name: 'official U/S card identity, Japanese Collab text, and printed Arts are in the current catalog', pass: card?.jpName === '百鬼あやめ' && card.stage === 'Debut' && card.hp === 110 && card.colors?.includes('紅') && new Set(card.variants?.map(item => item.rarity)).size === 2 && new Set(card.variants?.map(item => item.rarity)).has('U') && new Set(card.variants?.map(item => item.rarity)).has('S') && card.keyword.effect.includes('エールデッキの上から1枚をアーカイブできる') && printedArts?.name === '鬼の宴' && printedArts?.damage === 20 && printedArts?.cost?.join(',') === '紅' },
    { name: 'printed one-Red Arts deals 20, rests Ayame, and retains the paid Cheer', pass: artsResolve },
    { name: 'official Q724 full-Stage route pays Cheer, skips deployment, and shuffles', pass: collabResolved && fullStage },
    { name: 'with room available, the rule still searches, deploys one Debut Ayame, and caps Stage at six', pass: offeredOne && legalTarget && legalDeployment },
    { name: 'declining the optional Cheer payment leaves state unchanged after ordinary Collab', pass: optionalDecline },
    { name: 'after payment, fail-to-find keeps the open slot and still shuffles', pass: paidFailToFind },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { fullStage: { pending: result.pendingChoice, cheerPaid: result.players[0].archive.some(item => item.id === originalTopCheer), stageCount: Object.values(result.players[0].zones).filter(Boolean).length, shuffleCalls }, openSlot: { offeredOne, legalTarget, deployed: legalDeployment, stageCount: Object.values(room.players[0].zones).filter(Boolean).length }, optionalDecline, paidFailToFind, noFindShuffleCalls: noFindRandomCalls } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current website catalog is missing hBP09-046';
