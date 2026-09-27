import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current website cards.json (${response.status})`);
const cards = (await response.json()).cards;
const card = cards.find(entry => entry.number === 'hBP09-047');
const subarus = cards.filter(entry => entry.group === 'holomem' && entry.jpName === '大空スバル' && entry.stage);
const subaruNumber = subarus[0]?.number;
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-047-${++serial}`, number });
const unit = (number, cheer = []) => ({ stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });

function state({ phase = 'main', center = 'hBP09-041', subaruZone = null, underTop = false, opponentSubaru = false } = {}) {
  const zones = { center: unit(center), collab: null, back1: unit('hBP09-047'), back2: null, back3: null, back4: null, back5: null };
  if (subaruZone) {
    zones[subaruZone] = unit(underTop ? 'hBP09-008' : (subaruZone === 'center' ? center : subaruNumber));
    if (underTop) zones[subaruZone].stack.push(instance('hBP09-047'));
  }
  return {
    status: 'playing', phase, turn: 8, activePlayer: 0, firstPlayer: 1,
    players: [
      { name: 'Player', oshi: instance('hBP09-001'), zones, hand: [], mainDeck: [instance('hBP09-046'), instance('hBP09-048'), instance('hBP09-049')], cheerDeck: [instance('hY03-001')], archive: [], holoPower: [], life: ['hY01-001','hY02-001','hY03-001','hY04-001','hY05-001'].map(instance), turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
      { name: 'Opponent', oshi: instance('hBP09-006'), zones: { center: unit(opponentSubaru ? subaruNumber : 'hBP09-041'), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: [], archive: [], holoPower: [], life: [], turnsTaken: 3, modifiers: [], namedUsageTurns: {}, turnEvents: { turn: 8, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0 },
    ],
    effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [],
  };
}

function act(current, action) { return applyAction(current, 0, action, cards, () => 0.37); }

function run() {
  const topCard = state({ center: 'hBP09-008' });
  const powerId = topCard.players[0].mainDeck[0].id;
  const drawId = topCard.players[0].mainDeck[1].id;
  const collabResult = act(topCard, { type: 'collab', zone: 'back1' });
  const collabDraw = collabResult.players[0].zones.collab.stack.at(-1).number === 'hBP09-047'
    && collabResult.players[0].holoPower.at(-1).id === powerId
    && collabResult.players[0].hand.map(item => item.id).join(',') === drawId
    && collabResult.players[0].mainDeck.length === 1;

  const nonCenter = state({ subaruZone: 'back5' });
  const nonCenterTopId = nonCenter.players[0].mainDeck[0].id;
  const noCollabDrawResult = act(nonCenter, { type: 'collab', zone: 'back1' });
  const collabRequiresCenter = noCollabDrawResult.players[0].holoPower.at(-1).id === nonCenterTopId
    && noCollabDrawResult.players[0].hand.length === 0
    && noCollabDrawResult.players[0].mainDeck.length === 2;

  const shortDeck = state({ center: 'hBP09-008' });
  shortDeck.players[0].mainDeck = [instance('hBP09-046')];
  const shortResult = act(shortDeck, { type: 'collab', zone: 'back1' });
  const noAvailableDraw = shortResult.players[0].holoPower.at(-1).number === 'hBP09-046'
    && shortResult.players[0].hand.length === 0
    && shortResult.players[0].mainDeck.length === 0
    && shortResult.pendingChoice === null;

  const artsFor = (options = {}) => {
    const battle = state({ ...options, phase: 'performance' });
    battle.players[0].zones.center = unit('hBP09-047', [instance('hY03-001')]);
    const paidId = battle.players[0].zones.center.cheer[0].id;
    const result = act(battle, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
    return { result, paidId };
  };
  const bonus = artsFor({ subaruZone: 'back5' });
  const artsBonus = bonus.result.players[1].zones.center.damage === 40
    && bonus.result.players[0].zones.center.rested
    && bonus.result.players[0].zones.center.cheer[0]?.id === bonus.paidId;
  const opponentOnly = artsFor({ opponentSubaru: true });
  const ignoreOpponent = opponentOnly.result.players[1].zones.center.damage === 20;
  const covered = artsFor({ subaruZone: 'back5', underTop: true });
  const ignoreCovered = covered.result.players[1].zones.center.damage === 20;

  const checks = [
    { name: 'official C/S identity, Collab Effect, Arts text and one-Red/20 catalog data are present', pass: card?.jpName === 'ハコス・ベールズ' && card.stage === 'Debut' && card.hp === 100 && card.baton === 0 && card.colors?.includes('紅') && new Set(card.variants?.map(item => item.rarity)).size === 2 && new Set(card.variants?.map(item => item.rarity)).has('C') && new Set(card.variants?.map(item => item.rarity)).has('S') && card.keyword.effect === '自分のセンターが〈大空スバル〉なら、自分のデッキを1枚引く。' && card.arts[0].cost.join(',') === '無色' && card.arts[0].damage === 20 && card.arts[0].effect === '自分のステージに〈大空スバル〉がいるなら、このアーツ+20。' },
    { name: 'FUNNY RAT draws one after ordinary Collab when own Center is Subaru', pass: collabDraw },
    { name: 'FUNNY RAT does not draw when Subaru is on own Back instead of Center', pass: collabRequiresCenter },
    { name: 'FUNNY RAT safely draws zero when ordinary Collab consumes the last deck card', pass: noAvailableDraw },
    { name: 'Balloon Arts applies +20 for Subaru on own Stage and retains paid Cheer', pass: artsBonus },
    { name: 'Balloon Arts does not count an opposing Subaru', pass: ignoreOpponent },
    { name: 'Balloon Arts does not count a Subaru under the top Holomem', pass: ignoreCovered },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { collabDraw, collabRequiresCenter, noAvailableDraw, artsBonus, ignoreOpponent, ignoreCovered } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = card && subaruNumber ? `Ready: ${card.number} · ${card.jpName}` : 'FAIL: required card data is missing';
