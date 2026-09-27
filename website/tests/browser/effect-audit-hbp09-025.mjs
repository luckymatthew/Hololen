import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const noel = cards.find(card => card.number === 'hBP09-025');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-025-${++serial}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer: cheer.map(card => typeof card === 'string' ? instance(card) : card), attachments: [],
  damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });

function fixture(oshiNumber) {
  const player = (name, oshi) => ({
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP04-069')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [],
    life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {},
    turnEvents: turnEvents(6), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  });
  const players = [player('Attacker', 'hBP09-006'), player('Noel', oshiNumber)];
  players[0].zones.center = unit('hBP09-023', Array.from({ length: 3 }, () => 'hY01-015'));
  players[1].zones.center = unit('hBP09-025');
  players[1].zones.center.damage = 10;
  players[1].zones.back1 = unit('hBP09-064');
  return { status: 'playing', phase: 'performance', turn: 6, activePlayer: 0, firstPlayer: 1, players, effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
}

function run() {
  if (!noel || !noel.variants.some(variant => variant.rarity === 'C') || !noel.variants.some(variant => variant.rarity === 'S')) throw new Error('The current catalog must contain hBP09-025 C and S printings');
  const withSkill = applyAction(fixture('hBP09-003'), 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.5);
  const bonusPass = withSkill.players[1].zones.center?.damage === 130;
  const withoutSkill = applyAction(fixture('hBP09-006'), 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.5);
  const boundaryPass = withoutSkill.players[1].zones.center === null;
  const covered = fixture('hBP09-003');
  covered.players[1].zones.center = unit('hBP09-028');
  covered.players[1].zones.center.stack = [instance('hBP09-025'), instance('hBP09-028')];
  covered.players[1].zones.center.damage = 30;
  const coveredTopDoesNotInheritGift = applyAction(covered, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' }, cards, () => 0.5);
  const coveredPass = coveredTopDoesNotInheritGift.players[1].zones.center === null;
  const checks = [
    { name: 'C/S identity and Japanese catalog Gift are loaded', pass: noel.hp === 130 && noel.keyword.effect === '自分の推しホロメンが推しステージスキルを持つなら、このホロメンのHP+20。' },
    { name: 'Stage Skill Oshi keeps Noel alive at 130 total damage (150 effective HP)', pass: bonusPass },
    { name: 'Oshi without a Stage Skill leaves Noel at 130 HP and the same damage Downs her', pass: boundaryPass },
    { name: 'Covered Noel Gift stops when a non-Gift Bloom is the active top card', pass: coveredPass },
  ];
  const passed = checks.filter(item => item.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: { withStageSkillDamage: withSkill.players[1].zones.center?.damage ?? null, withoutStageSkillDown: withoutSkill.players[1].zones.center === null, coveredTopDown: coveredPass } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = noel ? `Ready: ${noel.number} · ${noel.jpName}` : 'FAIL: current catalog is missing hBP09-025';
