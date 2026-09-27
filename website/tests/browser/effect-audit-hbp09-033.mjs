import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-033');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-033-${++serial}`, number });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const events = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const player = name => ({
  name, oshi: instance('hBP01-001'),
  zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  hand: [], mainDeck: Array.from({ length: 36 }, () => instance('hBP09-051')),
  cheerDeck: Array.from({ length: 10 }, (_, i) => instance(['hY01-015', 'hY02-013', 'hY03-017'][i % 3])),
  archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-001')),
  turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0, spOshiSkillUsed: false,
  collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
});
function fixture(top = 'hBP09-100') {
  const state = { status: 'playing', phase: 'main', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [player('Player'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones = { center: unit('hBP09-032'), collab: null, back1: unit('hBP09-034'), back2: null, back3: null, back4: null, back5: null };
  state.players[0].hand = [instance('hBP09-033')];
  if (top === null) state.players[0].mainDeck = [];
  else state.players[0].mainDeck[0] = instance(top);
  state.players[1].zones.center = unit('hBP09-064');
  return state;
}
const act = (state, action, playerIndex = 0) => applyAction(state, playerIndex, action, cards, () => 0.4);
function bloom(state) {
  const bloomCard = state.players[0].hand[0];
  let result = act(state, { type: 'play', cardId: bloomCard.id });
  if (result.pendingChoice?.type !== 'bloom') throw new Error(`Expected Bloom choice, got ${result.pendingChoice?.type || 'none'}`);
  result = act(result, { type: 'choose', zone: 'center' });
  if (result.pendingChoice?.type !== 'optionChoice') throw new Error(`Expected optional mill choice, got ${result.pendingChoice?.type || 'none'}`);
  return result;
}
function option(state, id) { return act(state, { type: 'choose', optionId: id, option: id, mode: id }, state.pendingChoice.playerIndex); }
function target(state, zone) {
  if (state.pendingChoice?.type !== 'stageTarget') throw new Error(`Expected a Holomem destination, got ${state.pendingChoice?.type || 'none'}`);
  return act(state, { type: 'choose', zone }, state.pendingChoice.playerIndex);
}
function run() {
  if (!card) throw new Error('Current card catalogue is missing hBP09-033');
  const checks = [];
  const check = (name, pass) => checks.push({ name, pass: Boolean(pass) });
  check('catalogue identity, U/S printings, Japanese Bloom text and Arts', card.jpName === '大神ミオ' && card.stage === '1st' && card.hp === 170 && card.variants.some(v => v.rarity === 'U') && card.variants.some(v => v.rarity === 'S') && card.keyword.name === '濡れ髪ミオしゃ' && card.keyword.effect === '自分のデッキの上から1枚をアーカイブできる:アーカイブしたカードがサポートなら、自分のエールデッキの上から1枚を自分のホロメンに送る。' && card.arts[0].damage === 50);

  const supportState = fixture('hBP09-100');
  const support = supportState.players[0].mainDeck[0];
  const cheerTop = supportState.players[0].cheerDeck[0];
  let paid = option(bloom(supportState), 'yes');
  check('a milled Support is archived before the owner destination choice', paid.players[0].archive.some(item => item.id === support.id) && paid.pendingChoice?.type === 'stageTarget' && paid.pendingChoice.options.includes('center') && paid.pendingChoice.options.includes('back1'));
  paid = target(paid, 'back1');
  check('one top Cheer is sent to the selected own Holomem and the effect settles', !paid.pendingChoice && paid.players[0].zones.back1.cheer.at(-1)?.id === cheerTop.id && !paid.players[0].cheerDeck.some(item => item.id === cheerTop.id));

  const holomemState = fixture('hBP09-051');
  const milledHolomem = holomemState.players[0].mainDeck[0];
  const noSupport = option(bloom(holomemState), 'yes');
  check('a non-Support card is still archived and does not trigger Cheer sending', noSupport.players[0].archive.some(item => item.id === milledHolomem.id) && !noSupport.pendingChoice && noSupport.players[0].cheerDeck.length === 10);

  const skippedState = fixture('hBP09-100');
  const deckBefore = skippedState.players[0].mainDeck.map(item => item.id);
  const archiveBefore = skippedState.players[0].archive.map(item => item.id);
  const cheerBefore = skippedState.players[0].cheerDeck.map(item => item.id);
  const skipped = option(bloom(skippedState), 'no');
  check('declining the optional mill leaves deck/archive/Cheer zones unchanged', !skipped.pendingChoice && skipped.players[0].mainDeck.map(item => item.id).join() === deckBefore.join() && skipped.players[0].archive.map(item => item.id).join() === archiveBefore.join() && skipped.players[0].cheerDeck.map(item => item.id).join() === cheerBefore.join());

  const emptyDeck = fixture(null);
  const noCard = option(bloom(emptyDeck), 'yes');
  check('empty main deck produces no phantom archive or Cheer', !noCard.pendingChoice && noCard.players[0].mainDeck.length === 0 && noCard.players[0].archive.length === 0 && noCard.players[0].cheerDeck.length === 10);

  const emptyCheer = fixture('hBP09-100');
  emptyCheer.players[0].cheerDeck = [];
  let noCheer = option(bloom(emptyCheer), 'yes');
  noCheer = target(noCheer, 'back1');
  check('empty Cheer deck completes a valid destination with no phantom Cheer', !noCheer.pendingChoice && noCheer.players[0].zones.back1.cheer.length === 0 && noCheer.players[0].cheerDeck.length === 0);

  const arts = fixture('hBP09-100');
  const source = unit('hBP09-033');
  source.cheer = [instance('hY02-001'), instance('hY01-015')];
  arts.players[0].zones = { center: source, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  arts.phase = 'performance';
  const attack = act(arts, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
  check('green 50 Arts deals normal damage, rests the source and preserves its required Cheer', attack.players[1].zones.center.damage === 50 && attack.players[0].zones.center.rested && attack.players[0].zones.center.cheer.length === 2);

  const passed = checks.filter(item => item.pass).length;
  document.querySelector('#status').textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  document.querySelector('#result').textContent = JSON.stringify({ checks }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
}
document.querySelector('#run').addEventListener('click', () => { try { run(); } catch (error) { document.querySelector('#status').textContent = 'FAIL'; document.querySelector('#result').textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; } });
document.querySelector('#status').textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: current catalog is missing hBP09-033';
