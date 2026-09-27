import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const noel = cards.find(card => card.number === 'hBP09-027');
const status = document.querySelector('#status');
const output = document.querySelector('#result');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-027-${++serial}`, number });
const unit = (number, damage = 0) => ({
  stack: [instance(number)], cheer: [], attachments: [], damage, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0,
});
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0, dice: [] });
const cheerFor = { '白': 'hY01-015', '綠': 'hY02-013', '紅': 'hY03-017', '藍': 'hY04-014', '紫': 'hY05-012', '黃': 'hY06-012' };

function fixture({ attacker = 'hBP09-028', targetZone = 'center', priorDamage = 0, covered = false } = {}) {
  const player = (name, oshi) => ({
    name, oshi: instance(oshi), zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    hand: [], mainDeck: Array.from({ length: 40 }, () => instance('hBP09-104')),
    cheerDeck: Array.from({ length: 10 }, () => instance('hY01-001')), archive: [], holoPower: [],
    life: Array.from({ length: 5 }, () => instance('hY01-001')), turnsTaken: 3, modifiers: [], namedUsageTurns: {},
    turnEvents: turnEvents(7), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
  });
  const state = { status: 'playing', phase: 'performance', turn: 7, activePlayer: 0, firstPlayer: 1, players: [player('Attacker', 'hBP09-006'), player('Defender', 'hBP09-006')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[0].zones.center = unit(attacker);
  state.players[0].zones.center.cheer = cards.find(card => card.number === attacker).arts[0].cost.map(color => instance(cheerFor[color] || 'hY01-015'));
  state.players[1].zones.center = unit(targetZone === 'center' ? 'hBP09-027' : 'hBP09-064', targetZone === 'center' ? priorDamage : 0);
  state.players[1].zones.collab = targetZone === 'collab' ? unit('hBP09-027', priorDamage) : null;
  state.players[1].zones.back1 = unit('hBP09-064');
  if (covered) {
    const top = unit('hBP09-028');
    top.stack = [instance('hBP09-027'), instance('hBP09-028')];
    state.players[1].zones.center = top;
  }
  if (attacker === 'hBP09-054') state.players[0].zones.back1 = unit('hBP09-056');
  return state;
}

function resolve(state, targetZone = 'center') {
  state = applyAction(state, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone }, cards, () => 0.5);
  for (let index = 0; state.pendingChoice && index < 20; index += 1) {
    const choice = state.pendingChoice;
    let action;
    if (choice.type === 'cardSelection') action = { type: 'choose', cardIds: choice.selectableIds.slice(0, choice.min || 0) };
    else if (choice.type === 'optionChoice') action = { type: 'choose', optionId: choice.modeOptions[0].id, option: choice.modeOptions[0].id, mode: choice.modeOptions[0].id };
    else action = { type: 'choose', zone: choice.options?.[0], targetZone: choice.options?.[0] };
    state = applyAction(state, choice.playerIndex, action, cards, () => 0.5);
  }
  if (state.pendingChoice) throw new Error('Effect choices did not finish');
  return state;
}

function run() {
  const printedText = 'このホロメンのHPが減っていないなら、このホロメンが1stホロメンから受けるアーツダメージ-50。';
  const freshFirst = resolve(fixture());
  const damaged = resolve(fixture({ priorDamage: 1 }));
  const debut = resolve(fixture({ attacker: 'hBP09-026' }));
  const collab = resolve(fixture({ targetZone: 'collab' }), 'collab');
  const covered = resolve(fixture({ covered: true }));
  const special = resolve(fixture({ attacker: 'hBP09-054' }));
  const checks = [
    { name: 'official identity, C/S catalog and printed Gift text are present', pass: noel?.hp === 160 && noel.stage === '1st' && noel.variants.some(v => v.rarity === 'C') && noel.variants.some(v => v.rarity === 'S') && noel.keyword?.effect === printedText },
    { name: 'undamaged Noel reduces 30 Arts from 1st to the zero floor', pass: freshFirst.players[1].zones.center.damage === 0 },
    { name: 'one prior damage disables the reduction (1 + 30)', pass: damaged.players[1].zones.center.damage === 31 },
    { name: 'Debut source does not qualify for the 1st-source Gift', pass: debut.players[1].zones.center.damage === 20 },
    { name: 'an undamaged Collab Noel also receives the unpositioned Gift', pass: collab.players[1].zones.collab.damage === 0 },
    { name: 'covered Noel Gift does not transfer to active hBP09-028', pass: covered.players[1].zones.center.stack.at(-1).number === 'hBP09-028' && covered.players[1].zones.center.damage === 30 },
    { name: '1st-source special damage is not reduced as Arts damage', pass: special.players[1].zones.center.damage === 50 },
  ];
  const passed = checks.filter(check => check.pass).length;
  status.textContent = `${passed === checks.length ? 'PASS' : 'FAIL'} ${passed}/${checks.length}`;
  output.textContent = JSON.stringify({ checks, detail: {
    freshFirstDamage: freshFirst.players[1].zones.center.damage,
    priorDamageThenArts: damaged.players[1].zones.center.damage,
    debutArts: debut.players[1].zones.center.damage,
    collabDamage: collab.players[1].zones.collab.damage,
    coveredTop: covered.players[1].zones.center.stack.at(-1).number,
    coveredTopDamage: covered.players[1].zones.center.damage,
    specialDamageThenArts: special.players[1].zones.center.damage,
  } }, null, 2);
  window.__effectAudit = { passed, total: checks.length, checks };
  if (passed !== checks.length) throw new Error(`${passed}/${checks.length} browser checks passed`);
  return window.__effectAudit;
}

document.querySelector('#run').addEventListener('click', () => {
  try { run(); }
  catch (error) { status.textContent = 'FAIL'; output.textContent = String(error?.stack || error); window.__effectAudit = { error: String(error?.stack || error) }; }
});
status.textContent = noel ? `Ready: ${noel.number} · ${noel.jpName}` : 'FAIL: current catalog is missing hBP09-027';
