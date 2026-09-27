import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const map = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-052-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const player = name => ({ name, oshi: instance('hBP09-005'), ready: true, setupDone: true, turnsTaken: 1, mainDeck: [], cheerDeck: [], hand: [], life: [], holoPower: [], archive: [], removed: [], zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1, oshiSkillTurn: 0, spOshiSkillUsed: false, namedUsageTurns: {}, modifiers: [], turnEvents: { turn: 2, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 } });

function setup({ firstPlayer = 1, turnsTaken = 1, cheer = true } = {}) {
  const own = player('You');
  const opponent = player('Opponent');
  own.zones.center = unit('hBP09-051');
  own.zones.back1 = unit('hBP09-052');
  own.mainDeck = [instance('hBP09-064'), instance('hBP09-057')];
  own.cheerDeck = cheer ? [instance('hY04-014'), instance('hY01-015')] : [];
  own.turnsTaken = turnsTaken;
  opponent.zones.center = unit('hBP09-052');
  opponent.zones.back1 = unit('hBP09-052');
  return { status: 'playing', phase: 'main', turn: firstPlayer === 0 ? 1 : 2, activePlayer: 0, firstPlayer, players: [own, opponent], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

try {
  const towa = map.get('hBP09-052');
  const officialText = '自分が後攻で最初のターンなら、自分のエールデッキの上から1枚を自分の〈常闇トワ〉に送る。';
  if (!towa || towa.keyword?.effect !== officialText || !towa.variants.some(item => item.rarity === 'U')) throw new Error('Official U printing identity or Japanese effect text is missing');

  let transfer = applyAction(setup(), 0, { type: 'collab', zone: 'back1' }, cards, () => 0.25);
  if (transfer.pendingChoice?.type !== 'stageTarget' || transfer.pendingChoice.options.join(',') !== 'center,collab') throw new Error(`Own Towa targets were ${transfer.pendingChoice?.options?.join(',') || 'none'}`);
  const topId = transfer.players[0].cheerDeck[0].id;
  const nextId = transfer.players[0].cheerDeck[1].id;
  transfer = applyAction(transfer, 0, { type: 'choose', zone: 'center' }, cards, () => 0.25);
  if (transfer.pendingChoice) throw new Error('Target selection left an unresolved choice');
  if (transfer.players[0].zones.center.cheer[0]?.id !== topId || transfer.players[0].cheerDeck.length !== 1 || transfer.players[0].cheerDeck[0]?.id !== nextId) throw new Error('Effect did not attach exactly the top Cheer to the selected own Towa');
  if (transfer.players[1].zones.center.cheer.length || transfer.players[1].zones.back1.cheer.length) throw new Error('Effect attached Cheer to an opponent Towa');

  let empty = applyAction(setup({ cheer: false }), 0, { type: 'collab', zone: 'back1' }, cards, () => 0.25);
  if (empty.pendingChoice?.type !== 'stageTarget' || empty.pendingChoice.options.join(',') !== 'center,collab') throw new Error('The legal own-Towa target choice is missing with an empty Cheer Deck');
  empty = applyAction(empty, 0, { type: 'choose', zone: 'center' }, cards, () => 0.25);
  if (empty.pendingChoice) throw new Error('The empty-deck effect did not finish after choosing its legal recipient');
  if (empty.players[0].zones.center.cheer.length || empty.players[0].zones.collab.cheer.length) throw new Error('Empty Cheer Deck moved or created Cheer');

  for (const [firstPlayer, turnsTaken] of [[0, 1], [1, 2]]) {
    const outOfWindow = applyAction(setup({ firstPlayer, turnsTaken }), 0, { type: 'collab', zone: 'back1' }, cards, () => 0.25);
    if (outOfWindow.pendingChoice || outOfWindow.players[0].cheerDeck.length !== 2) throw new Error(`Printed timing gate failed (firstPlayer=${firstPlayer}, turnsTaken=${turnsTaken})`);
  }

  status.textContent = 'PASS: hBP09-052 uses only own Towa targets, attaches the top Cheer in the printed turn window, and resolves a legal target without creating Cheer when the deck is empty.';
  output.textContent = JSON.stringify({ pass: true, cases: ['second player first turn: select own Towa and attach exactly the top Cheer', 'empty Cheer Deck: select a legal Towa target, then perform no impossible attachment', 'first player/later turn: no trigger'], runtime: 'current website source applyAction in Chromium; not full SimulatorClient UI' }, null, 2);
} catch (error) {
  status.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  output.textContent = JSON.stringify({ pass: false, error: String(error) }, null, 2);
}
