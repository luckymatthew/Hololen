import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const map = new Map(cards.map(card => [card.number, card]));
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-051-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const player = name => ({ name, oshi: instance('hBP09-005'), ready: true, setupDone: true, turnsTaken: 3, mainDeck: [], cheerDeck: [], hand: [], life: [], holoPower: [], archive: [], removed: [], zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1, oshiSkillTurn: 0, spOshiSkillUsed: false, namedUsageTurns: {}, modifiers: [], turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 } });

function setup(legalBackSong) {
  const own = player('You');
  const opponent = player('Opponent');
  own.zones.center = unit('hBP09-051', [instance('hY04-014'), instance('hY01-015')]);
  own.zones.collab = unit('hBP01-013');
  own.zones.back1 = unit(legalBackSong ? 'hBP01-013' : 'hBP09-049');
  own.zones.back2 = unit('hBP09-049');
  opponent.zones.center = unit('hBP09-064');
  opponent.zones.back1 = unit('hBP09-052');
  return { status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1, players: [own, opponent], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

try {
  const towa = map.get('hBP09-051');
  if (!towa || !towa.variants.some(item => item.rarity === 'C') || !towa.variants.some(item => item.rarity === 'S')) throw new Error('Official C/S printing identity is missing');
  if (towa.arts[1].effect !== 'このホロメンのエール1枚を自分の#歌を持つバックホロメンに付け替えられる。') throw new Error('Japanese Arts effect text differs from the official page');

  const noTarget = applyAction(setup(false), 0, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' }, cards, () => 0.25);
  if (noTarget.pendingChoice) throw new Error(`No legal Back #歌 target still prompted ${noTarget.pendingChoice.type}`);
  if (noTarget.players[1].zones.center.damage !== 30) throw new Error(`Targetless Arts dealt ${noTarget.players[1].zones.center.damage}, expected 30`);
  if (noTarget.players[0].zones.center.cheer.length !== 2) throw new Error('Targetless resolution moved Arts Cheer');

  let transfer = applyAction(setup(true), 0, { type: 'attack', sourceZone: 'center', artIndex: 1, targetZone: 'center' }, cards, () => 0.25);
  const cheerIds = transfer.players[0].zones.center.cheer.map(card => card.id);
  if (transfer.pendingChoice?.type !== 'cardSelection' || !transfer.pendingChoice.optional || transfer.pendingChoice.cards.some(card => !cheerIds.includes(card.id))) throw new Error('Transfer did not offer one of this Towa\'s Cheer cards as an optional choice');
  transfer = applyAction(transfer, 0, { type: 'choose', cardIds: [cheerIds[0]] }, cards, () => 0.25);
  if (transfer.pendingChoice?.type !== 'stageTarget' || transfer.pendingChoice.options.join(',') !== 'back1') throw new Error(`Transfer target choices were ${transfer.pendingChoice?.options?.join(',') || 'none'}, expected only own Back #歌`);
  transfer = applyAction(transfer, 0, { type: 'choose', zone: 'back1' }, cards, () => 0.25);
  if (transfer.pendingChoice) throw new Error('Transfer left an unresolved choice');
  if (transfer.players[0].zones.center.cheer.length !== 1 || transfer.players[0].zones.back1.cheer[0]?.id !== cheerIds[0]) throw new Error('Selected Cheer did not move to the own Back #歌 unit');
  if (transfer.players[1].zones.center.damage !== 30) throw new Error('Optional transfer changed the Arts damage');

  status.textContent = 'PASS: hBP09-051 Arts resolves targetless without a no-op prompt and moves only the selected Cheer to an eligible own Back #歌 Holomem.';
  output.textContent = JSON.stringify({ pass: true, cases: ['no legal destination: 30 damage, no prompt, no move', 'legal recipient: optional selection restricted to source Cheer and own Back #歌', 'Arts payment: blue plus one any-color Cheer is retained unless the selected transfer moves one'] }, null, 2);
} catch (error) {
  status.textContent = `FAIL: ${error instanceof Error ? error.message : String(error)}`;
  output.textContent = JSON.stringify({ pass: false, error: String(error) }, null, 2);
}
