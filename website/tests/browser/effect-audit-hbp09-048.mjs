import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current website cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-048');
const targets = ['hBP09-010', 'hBP09-048'];
const searchedNames = new Set(['大空スバル', 'ハコス・ベールズ']);
const fillers = cards.filter(entry => entry.group === 'holomem' && !searchedNames.has(entry.jpName)).slice(0, 14).map(entry => entry.number);
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-048-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function deckWithTargets(numbers) {
  const deck = numbers.map(instance);
  for (const number of fillers) for (let copy = 0; copy < 4 && deck.length < 50; copy++) deck.push(instance(number));
  if (deck.length !== 50) throw new Error('Could not form the legal 50-card browser fixture.');
  return deck;
}

function initialState({ oshi = 'hBP09-001', searchTargets = targets, collab = true, phase = 'main' } = {}) {
  return {
    status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [
      { name: 'Player', oshi: instance(oshi), zones: { center: unit('hBP09-047'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
        hand: [instance('hBP09-048')], mainDeck: deckWithTargets(searchTargets), cheerDeck: [instance('hY03-001')], archive: [], holoPower: [],
        life: ['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {},
        turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
      { name: 'Opponent', oshi: instance('hBP09-006'), zones: { center: unit('hBP09-041'), collab: collab ? unit('hBP09-042') : null,
          back1: unit('hBP09-043'), back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: [],
        archive: [], holoPower: [], life: [], turnsTaken: 3, modifiers: [], namedUsageTurns: {},
        turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
    ],
    effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [],
  };
}

function act(state, action, random = () => 0.37) { return applyAction(state, 0, action, cards, random); }
function answer(state, choice) { return act(state, { type: 'choose', ...choice }); }

function bloom048(state) {
  const cardInstance = state.players[0].hand.find(entry => entry.number === 'hBP09-048');
  let next = act(state, { type: 'play', cardId: cardInstance.id });
  if (next.pendingChoice?.type !== 'bloom') throw new Error('Expected the Bloom position choice.');
  next = answer(next, { zone: 'center' });
  if (next.players[0].zones.center.stack.at(-1).number !== 'hBP09-048') throw new Error('hBP09-048 did not Bloom.');
  return next;
}

function selectNumber(state, number) {
  const pending = state.pendingChoice;
  const selected = pending?.cards.find(entry => entry.number === number && pending.selectableIds.includes(entry.id));
  if (!selected) throw new Error(`Missing selectable ${number}.`);
  return answer(state, { cardIds: [selected.id] });
}

function art(state, die, targetZone = 'center') {
  state.phase = 'performance';
  state.players[0].hand = [];
  state.players[0].zones = { center: unit('hBP09-048', [instance('hY03-001')]), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[0].turnEvents = { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  const result = act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone }, () => (die - 0.5) / 6);
  return result;
}

function run() {
  const identity = card?.jpName === 'ハコス・ベールズ' && card.stage === '1st' && card.hp === 160 && card.baton === 1
    && new Set(card.variants.map(item => item.rarity)).size === 2 && card.keyword.type === 'bloom'
    && card.keyword.effect === '自分の推しホロメンが〈大空スバル〉なら、自分のデッキから、1st[〈大空スバル〉と〈ハコス・ベールズ〉]1枚ずつを公開し、手札に加える。そしてデッキをシャッフルする。'
    && card.arts[0].effect === 'サイコロを1回振る。奇数なら、相手のコラボホロメンに特殊ダメージ20を与える。';

  let both = bloom048(initialState());
  const bothSearch = [];
  for (const number of targets) {
    const pending = both.pendingChoice;
    bothSearch.push(pending?.type === 'cardSelection' && pending.min === 0 && pending.nonEmptyMin === 1 && pending.max === 1);
    both = selectNumber(both, number);
  }
  const selectsBoth = both.pendingChoice === null && both.players[0].hand.map(item => item.number).sort().join(',') === [...targets].sort().join(',');

  let failFind = bloom048(initialState());
  failFind = answer(failFind, { cardIds: [] });
  const continuesAfterFail = failFind.pendingChoice?.type === 'cardSelection' && failFind.pendingChoice.min === 0;
  failFind = selectNumber(failFind, 'hBP09-048');
  const failToFindAllowed = continuesAfterFail && failFind.pendingChoice === null && failFind.players[0].hand.length === 1
    && failFind.players[0].mainDeck.some(item => item.number === 'hBP09-010');

  const nonSubaru = initialState({ oshi: 'hBP09-006' });
  const beforeDeck = nonSubaru.players[0].mainDeck.map(item => item.id).join(',');
  const gated = bloom048(nonSubaru);
  const correctOshiGate = gated.pendingChoice === null && gated.players[0].hand.length === 0 && gated.players[0].mainDeck.map(item => item.id).join(',') === beforeDeck;

  let allDice = true;
  for (let die = 1; die <= 6; die++) {
    const result = art(initialState({ oshi: 'hBP09-006', phase: 'performance' }), die);
    allDice &&= result.players[1].zones.center.damage === 30
      && result.players[1].zones.collab.damage === (die % 2 ? 20 : 0)
      && result.players[1].zones.back1.damage === 0
      && result.players[0].turnEvents.dice.at(-1).value === die
      && result.pendingChoice === null;
  }

  const noCollab = art(initialState({ oshi: 'hBP09-006', collab: false }), 1);
  const skipsMissingCollab = noCollab.players[1].zones.center.damage === 30 && noCollab.players[1].zones.collab === null && noCollab.pendingChoice === null;
  const sameCollabTarget = art(initialState({ oshi: 'hBP09-006' }), 3, 'collab');
  const bothDamageKindsApply = sameCollabTarget.players[1].zones.collab.damage === 50 && sameCollabTarget.players[1].zones.center.damage === 0;

  const checks = [
    { name: 'official U/S identity and exact Japanese Bloom/Arts text', pass: Boolean(identity) },
    { name: 'Subaru Oshi searches one 1st Subaru and one 1st Baelz', pass: bothSearch.every(Boolean) && selectsBoth },
    { name: 'hidden search can fail to find a target and continue the second search', pass: failToFindAllowed },
    { name: 'Bloom search is gated by the own Subaru Oshi', pass: correctOshiGate },
    { name: 'all six die faces resolve exact base Arts and odd-only Collab Special damage', pass: allDice },
    { name: 'odd result skips additional damage when opposing Collab is absent', pass: skipsMissingCollab },
    { name: 'Arts and Special damage both resolve when the Collab is also the Arts target', pass: bothDamageKindsApply },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { bothSearch, selectsBoth, continuesAfterFail, failToFindAllowed, correctOshiGate, allDice, skipsMissingCollab, bothDamageKindsApply } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: required hBP09-048 data is missing';
