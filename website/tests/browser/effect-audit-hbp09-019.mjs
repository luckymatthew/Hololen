import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error('Could not load current cards.json (' + response.status + ')');
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-019');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: 'browser-hbp09-019-' + (++serial), number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer: cheer.map(instance), attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const layered = (numbers, cheer = []) => ({ ...unit(numbers.at(-1), cheer), stack: numbers.map(instance) });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function player(name) {
  return { name, oshi: instance('hBP09-002'), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: Array.from({ length: 10 }, () => instance('hY01-001')), life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function bloomFixture() {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = layered(['hBP09-018', 'hBP09-020'], ['hY01-001']);
  players[0].zones.back1 = unit('hBP09-015');
  players[0].zones.back2 = unit('hBP09-016');
  players[0].hand = [instance('hBP09-019')];
  const bloom = players[0].hand[0];
  players[1].zones.center = unit('hBP09-064');
  players[1].zones.back1 = unit('hBP09-064');
  return { state: { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] }, bloom };
}

function bloomAndChoose(targetZone) {
  const { state: initial, bloom } = bloomFixture();
  let state = applyAction(initial, 0, { type: 'play', cardId: bloom.id }, cards, () => 0.5);
  state = JSON.parse(JSON.stringify(state));
  if (state.pendingChoice?.type !== 'bloom' || !state.pendingChoice.options.includes('back1')) throw new Error('The real pending Bloom choice did not contain Back.');
  state = applyAction(state, state.pendingChoice.playerIndex, { type: 'choose', zone: 'back1' }, cards, () => 0.5);
  const targetOptions = state.pendingChoice?.options;
  state = applyAction(state, state.pendingChoice.playerIndex, { type: 'choose', zone: targetZone }, cards, () => 0.5);
  return { state, targetOptions, initial: structuredClone(initial) };
}

function artsFixture(sourceZone, batonTurn) {
  const players = [player('Audit'), player('Opponent')];
  players[0].zones.center = sourceZone === 'center' ? layered(['hBP09-015', 'hBP09-019'], ['hY01-001']) : unit('hBP09-064');
  if (sourceZone === 'collab') { players[0].zones.collab = unit('hBP09-019', ['hY01-001']); players[0].collabTurn = 8; players[0].zones.collab.collabbedTurn = 8; }
  if (sourceZone === 'center') players[0].zones.back1 = unit('hBP09-016');
  players[0].batonTurn = batonTurn;
  players[1].zones.center = unit('hBP09-064');
  players[1].zones.back1 = unit('hBP09-064');
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function arts(sourceZone, batonTurn) {
  const state = artsFixture(sourceZone, batonTurn);
  const result = applyAction(state, 0, { type: 'attack', sourceZone, artIndex: 0, targetZone: 'center' }, cards, () => 0.5);
  return result.players[1].zones.center.damage;
}

document.querySelector('#run').addEventListener('click', () => {
  try {
    if (!card) throw new Error('hBP09-019 is missing from the packaged current catalogue.');
    const selections = ['center', 'back1', 'back2'].map(bloomAndChoose);
    const reduced = selections[0];
    const modifier = reduced.state.players[0].zones.center.modifiers.find(item => item.kind === 'batonCost');
    const BatonCheerId = reduced.state.players[0].zones.center.cheer[0].id;
    const Baton = applyAction(reduced.state, 0, { type: 'baton', zone: 'back1' }, cards, () => 0.5);
    const centerAfterExpiry = bloomAndChoose('center').state;
    centerAfterExpiry.turn += 1;
    centerAfterExpiry.players[0].batonTurn = 0;
    let expiryRejected = false;
    try { applyAction(centerAfterExpiry, 0, { type: 'baton', zone: 'back1' }, cards, () => 0.5); }
    catch { expiryRejected = true; }
    const centerAfterBatonArts = arts('center', 8);
    const centerWithoutBatonArts = arts('center', 7);
    const collabAfterBatonArts = arts('collab', 8);
    const backAttack = artsFixture('center', 8);
    backAttack.players[0].zones.back2 = unit('hBP09-019', ['hY01-001']);
    let backRejected = false;
    try { applyAction(backAttack, 0, { type: 'attack', sourceZone: 'back2', artIndex: 0, targetZone: 'center' }, cards, () => 0.5); }
    catch { backRejected = true; }
    const checks = [
      { name: 'Back Bloom offers only controller-owned Stage targets, including itself', pass: selections.every(item => item.targetOptions?.length === 3) && selections.map(item => item.state.players[0].zones.center.modifiers.some(m => m.kind === 'batonCost') ? 'center' : item.state.players[0].zones.back1.modifiers.some(m => m.kind === 'batonCost') ? 'back1' : 'back2').join(',') === 'center,back1,back2' },
      { name: 'the selected 2-Cheer Center Baton is reduced to zero and archives no Cheer', pass: modifier?.amount === -2 && modifier?.expiresTurn === 8 && Baton.players[0].zones.back1.stack.at(-1).number === 'hBP09-020' && Baton.players[0].zones.back1.cheer.some(item => item.id === BatonCheerId) },
      { name: 'the Baton reduction does not survive the turn boundary', pass: expiryRejected },
      { name: 'Center Arts is 60 after a same-turn Baton and 40 otherwise', pass: centerAfterBatonArts === 60 && centerWithoutBatonArts === 40 },
      { name: 'Center-only Arts bonus does not apply from Collab', pass: collabAfterBatonArts === 40 },
      { name: 'Back cannot be an Arts source', pass: backRejected },
      { name: 'catalog retains R/SR identity and exact Japanese text', pass: ['hbp09-hBP09-019_R', 'hbp09-hBP09-019_SR'].every(id => card.variants.some(variant => variant.id === id)) && card.keyword.effect === '[バックポジション限定]自分のステージのホロメン1人を選ぶ。このターンの間、選んだホロメンのバトンタッチに必要な無色-2。' && card.arts[0].effect === '[センターポジション限定]このターンに自分のホロメンがバトンタッチしていたなら、このアーツ+20。' },
    ];
    const passed = checks.filter(check => check.pass).length;
    status.textContent = (passed === checks.length ? 'PASS ' : 'FAIL ') + passed + '/' + checks.length;
    output.textContent = JSON.stringify({ checks, detail: { targetOptions: selections.map(item => item.targetOptions), modifier, cheerAfterFreeBaton: Baton.players[0].zones.back1.cheer.length, centerAfterBatonArts, centerWithoutBatonArts, collabAfterBatonArts, variants: card.variants.map(variant => variant.id) } }, null, 2);
  } catch (error) {
    status.textContent = 'FAIL';
    output.textContent = String(error?.stack || error);
  }
});

status.textContent = card ? 'Ready: ' + card.number + ' · ' + card.jpName : 'FAIL: current catalogue is missing hBP09-019';
