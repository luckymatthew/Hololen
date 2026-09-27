import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const noel = cards.find(card => card.number === 'hBP09-028');
const gyudon = cards.find(card => card.number === 'hBP09-100');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-028-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function fixture(deck) {
  const player = (name, oshi) => ({
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: deck.map(instance), cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')),
    archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
    turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0,
    spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1,
  });
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Noel', 'hBP09-003'), player('Opponent', 'hBP09-006')], effectQueue: [],
    pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit('hBP09-026');
  state.players[0].zones.center.enteredTurn = 1;
  state.players[0].hand = [instance('hBP09-028')];
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}

function beginBloom(state, random) {
  state = applyAction(state, 0, { type: 'play', cardId: state.players[0].hand[0].id }, cards, random);
  if (state.pendingChoice?.type !== 'bloom') throw new Error('hBP09-028 did not enter a real Bloom target choice');
  state = applyAction(state, 0, { type: 'choose', zone: 'center' }, cards, random);
  return state;
}

function run() {
  const printed = '自分のデッキから、〈牛丼〉1枚を公開し、手札に加える。そしてデッキをシャッフルする。';
  let selectedRandomCalls = 0;
  let found = beginBloom(fixture(['hBP09-100', 'hBP09-104', 'hBP09-098', 'hBP09-093']), () => { selectedRandomCalls += 1; return 0.4; });
  const targetId = found.pendingChoice?.selectableIds?.[0];
  const target = found.players[0].mainDeck.find(card => card.id === targetId);
  if (!target || target.number !== 'hBP09-100') throw new Error('Search did not restrict the revealed selection to the Gyudon card');
  if (selectedRandomCalls !== 0) throw new Error('The deck shuffled before the selected card was added');
  found = applyAction(found, 0, { type: 'choose', cardIds: [targetId] }, cards, () => { selectedRandomCalls += 1; return 0.4; });
  const missDeck = fixture(['hBP09-104', 'hBP09-098', 'hBP09-093', 'hBP09-102']);
  let missRandomCalls = 0;
  const missed = beginBloom(missDeck, () => { missRandomCalls += 1; return 0.4; });
  const checks = [
    { name: 'official catalog identity, C/S printings and exact Japanese Bloom text', pass: noel?.stage === '1st' && noel.hp === 150 && noel.variants.some(v => v.rarity === 'C') && noel.variants.some(v => v.rarity === 'S') && noel.keyword?.effect === printed && gyudon?.jpName.includes('牛丼') },
    { name: 'real Bloom choice finds and reveals only one Gyudon, then one final shuffle', pass: found.pendingChoice === null && found.players[0].hand.some(card => card.number === 'hBP09-100') && found.players[0].mainDeck.length === 3 && selectedRandomCalls === 2 && found.log.some(line => JSON.stringify(line).includes('hBP09-100')) },
    { name: 'missed search still resolves and shuffles once per official Q751', pass: missed.pendingChoice === null && missed.players[0].hand.length === 0 && missed.players[0].mainDeck.length === 4 && missRandomCalls === 3 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: {
    foundHand: found.players[0].hand.map(card => card.number), foundDeck: found.players[0].mainDeck.map(card => card.number), foundShuffleRandomCalls: selectedRandomCalls,
    missHand: missed.players[0].hand.map(card => card.number), missDeckSize: missed.players[0].mainDeck.length, missShuffleRandomCalls: missRandomCalls,
  } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = noel ? `Ready: ${noel.number} · ${noel.jpName}` : 'FAIL: current catalog is missing hBP09-028';
