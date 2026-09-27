import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current website cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-049');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
const subaruOshis = ['hBP09-001', 'hBP04-006', 'hBD24-056', 'hSD19-001'];
let serial = 0;
const instance = number => ({ id: `browser-hbp09-049-${++serial}`, number });
const unit = (number, cheerNumbers = []) => ({ stack: [instance(number)], cheer: cheerNumbers.map(instance), attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const events = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });

function state({ oshi = 'hBP09-001', target = 'hBP01-037', cheerNumbers = [], archive = [] } = {}) {
  return {
    status: 'playing', phase: 'performance', turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [
      { name: 'Player', oshi: instance(oshi), zones: { center: unit('hBP09-049', cheerNumbers), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
        hand: [], mainDeck: [], cheerDeck: [], archive: archive.map(instance), holoPower: [], life: ['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001'].map(instance),
        turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
      { name: 'Opponent', oshi: instance('hBP09-006'), zones: { center: unit(target), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
        hand: [], mainDeck: [], cheerDeck: [], archive: [], holoPower: [], life: ['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001'].map(instance),
        turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: events(8), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
    ],
    effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [],
  };
}

function act(current, action) { return applyAction(current, 0, action, cards, () => 0.37); }
function attack(current) { return act(current, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }); }
function answer(current, choice) { return act(current, { type: 'choose', ...choice }); }

function run() {
  const identity = card?.jpName === 'ハコス・ベールズ' && card.stage === '2nd' && card.hp === 190 && card.baton === 2
    && new Set(card.variants.map(item => item.rarity)).size === 2
    && card.keyword?.effect === '自分の推しホロメンが〈大空スバル〉なら、このホロメンのアーツに必要な無色-3。'
    && card.arts?.[0]?.damage === 80 && card.arts[0].specialTargets?.[0] === '綠' && card.arts[0].specialValues?.[0] === 50;

  const subaruGift = subaruOshis.map(oshi => {
    const result = attack(state({ oshi, target: 'hBP09-041' }));
    return { oshi, pass: result.players[1].zones.center.damage === 80 && result.players[0].zones.center.rested
      && result.players[0].zones.center.cheer.length === 0 && result.pendingChoice === null };
  });

  let rejectsTwoCheer = false;
  try { attack(state({ oshi: 'hBP09-006', target: 'hBP09-041', cheerNumbers: ['hY01-001', 'hY02-001'] })); }
  catch { rejectsTwoCheer = true; }
  const fullCost = state({ oshi: 'hBP09-006', target: 'hBP09-041', cheerNumbers: ['hY01-001', 'hY02-001', 'hY03-001'] });
  const paid = attack(fullCost);
  const paidCheer = paid.players[0].zones.center.cheer.length === 3 && paid.players[0].zones.center.rested;

  const green = attack(state({ oshi: 'hBP09-006', target: 'hBP01-037', cheerNumbers: ['hY01-001', 'hY02-001', 'hY03-001'] }));
  const red = attack(state({ oshi: 'hBP09-006', target: 'hBP09-041', cheerNumbers: ['hY01-001', 'hY02-001', 'hY03-001'] }));
  const colorIcon = green.players[1].zones.center.damage === 130 && red.players[1].zones.center.damage === 80;

  const recoverState = state({ oshi: 'hBP04-006', target: 'hBP09-041', archive: ['hBP09-010', 'hBP09-048', 'hBP09-041'] });
  const beforeIds = cardIds(recoverState).sort();
  let recovery = attack(recoverState);
  const mandatoryChoice = recovery.pendingChoice?.type === 'cardSelection' && recovery.pendingChoice.min === 1 && recovery.pendingChoice.max === 1 && recovery.pendingChoice.optional === false;
  const selectable = new Set(recovery.pendingChoice?.cards.map(entry => entry.number) || []);
  const selected = recovery.pendingChoice?.cards.find(entry => entry.number === 'hBP09-048');
  if (selected) recovery = answer(recovery, { cardIds: [selected.id] });
  const recoveredOne = selected && recovery.players[0].hand.some(entry => entry.id === selected.id)
    && recovery.players[0].archive.some(entry => entry.number === 'hBP09-010')
    && recovery.players[0].archive.some(entry => entry.number === 'hBP09-041') && cardIds(recovery).sort().join(',') === beforeIds.join(',');

  const otherOshi = attack(state({ oshi: 'hBP09-006', target: 'hBP09-041', cheerNumbers: ['hY01-001','hY02-001','hY03-001'], archive: ['hBP09-010','hBP09-048'] }));
  const gated = otherOshi.pendingChoice === null && otherOshi.players[0].archive.map(entry => entry.number).join(',') === 'hBP09-010,hBP09-048';
  const emptyArchive = attack(state({ oshi: 'hBP09-001', target: 'hBP09-041' }));
  const skipsEmptyRecovery = emptyArchive.pendingChoice === null && emptyArchive.players[1].zones.center.damage === 80;

  const checks = [
    { name: 'official R/SR identity and exact Gift/Arts metadata', pass: Boolean(identity) },
    { name: 'all official Subaru Oshi printings remove three Colorless Arts requirements', pass: subaruGift.every(item => item.pass) },
    { name: 'other Oshi needs three Cheer and Arts Cheer remains attached', pass: rejectsTwoCheer && paidCheer },
    { name: 'Green special-attack icon adds 50 only to Green targets', pass: colorIcon },
    { name: 'Subaru recovery is mandatory for one eligible Archive card and preserves all cards', pass: mandatoryChoice && selectable.size === 2 && recoveredOne },
    { name: 'recovery is Oshi-gated and an empty eligible Archive has no impossible prompt', pass: gated && skipsEmptyRecovery },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { subaruGift, rejectsTwoCheer, paidCheer, colorIcon, mandatoryChoice, selectable: [...selectable], recoveredOne, gated, skipsEmptyRecovery } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

function cardIds(current) {
  return current.players.flatMap(player => [player.oshi, ...player.mainDeck, ...player.cheerDeck, ...player.hand, ...player.archive, ...player.holoPower, ...player.life,
    ...Object.values(player.zones).filter(Boolean).flatMap(unit => [...unit.stack, ...unit.cheer, ...unit.attachments])].filter(Boolean).map(entry => entry.id));
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: required hBP09-049 data is missing';
