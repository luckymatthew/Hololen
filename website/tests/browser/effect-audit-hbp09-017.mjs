import { applyAction } from '../../lib/simulator/engine.mjs';

const response = await fetch('/cards.json');
if (!response.ok) throw new Error(`Could not load current cards.json (${response.status})`);
const cards = (await response.json()).cards;
const trigger = { number: 'AUDIT-HBP09-017-TRIGGER', name: 'Audit trigger', jpName: '監査用', group: 'holomem', type: 'Holomen', stage: '2nd', hp: 9999, colors: [], tags: [], baton: 0, arts: [{ name: 'Zero trigger', damage: 0, cost: [], effect: '' }] };
const runtimeCards = [...cards, trigger];
const output = document.querySelector('#result');
const status = document.querySelector('#status');
let serial = 0;
const instance = number => ({ id: `browser-hbp09-017-${++serial}`, number });
const unit = (number, stack = [instance(number)]) => ({ stack, cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
const turnEvents = turn => ({ turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 });
let state;

function player(name) {
  return { name, oshi: instance('hBP09-002'), zones: { center: unit(trigger.number), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null }, hand: [], mainDeck: [], cheerDeck: Array.from({ length: 10 }, () => instance('hY01-015')), archive: [], holoPower: [], life: Array.from({ length: 5 }, () => instance('hY01-015')), turnsTaken: 2, modifiers: [], namedUsageTurns: {}, turnEvents: turnEvents(3), oshiSkillTurn: 0, spOshiSkillUsed: false, collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1 };
}

function fixture({ kind = 'arts', amount = 100, zone = 'center', bloomTop = false } = {}) {
  state = { status: 'playing', phase: 'performance', turn: 3, activePlayer: 0, firstPlayer: 0, players: [player('Audit'), player('Opponent')], effectQueue: [], pendingChoice: null, log: [], knockouts: [], lifeLosses: [] };
  state.players[1].zones.center = unit(zone === 'center' ? 'hBP09-017' : trigger.number);
  state.players[1].zones.collab = unit(zone === 'collab' ? 'hBP09-017' : trigger.number);
  state.players[1].zones.back1 = unit(zone === 'back1' ? 'hBP09-017' : trigger.number);
  if (bloomTop) state.players[1].zones[zone].stack.push(instance('hBP09-018'));
  state.effectQueue = [kind === 'arts'
    ? { type: 'dealArtsDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: zone, sourceZone: 'center', damage: amount, sourceName: 'audit', artName: 'audit' }
    : { type: 'specialDamage', playerIndex: 0, targetPlayerIndex: 1, targetZone: zone, sourceZone: 'center', amount, loseLife: false, sourceName: 'audit' }];
  const actionTarget = zone === 'center' ? 'collab' : 'center';
  state = applyAction(state, 0, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: actionTarget }, runtimeCards, () => 0.5);
  return state.players[1].zones[zone];
}

function report(name, pass, details) {
  status.textContent = `${pass ? 'PASS' : 'FAIL'}: ${name}`;
  output.textContent = JSON.stringify({ pass, name, ...details }, null, 2);
}

document.querySelector('#allZones').addEventListener('click', () => {
  try {
    const results = ['center', 'collab', 'back1'].map(zone => ({ zone, damage: fixture({ zone }).damage }));
    report('hBP09-017 reduces 100 Arts damage by 30 in all Stage positions', results.every(item => item.damage === 70), { results });
  } catch (error) { report(String(error), false, { error: String(error) }); }
});

document.querySelector('#special').addEventListener('click', () => {
  try {
    const arts = fixture({ amount: 20 }).damage;
    const special = fixture({ kind: 'special', amount: 30 }).damage;
    report('Arts reduction floors at zero and does not affect Special damage', arts === 0 && special === 30, { arts20AfterReduction: arts, specialDamage30: special });
  } catch (error) { report(String(error), false, { error: String(error) }); }
});

document.querySelector('#underTop').addEventListener('click', () => {
  try {
    const result = fixture({ amount: 100, bloomTop: true });
    report('the underlying hBP09-017 Gift is inactive below a Bloom top card', result.damage === 100 && result.stack.at(-1).number === 'hBP09-018', { damage: result.damage, activeTop: result.stack.at(-1).number });
  } catch (error) { report(String(error), false, { error: String(error) }); }
});

try {
  const card = cards.find(entry => entry.number === 'hBP09-017');
  if (!card || card.keyword?.effect !== 'このホロメンが受けるアーツダメージ-30。') throw new Error('Current catalog does not match official hBP09-017 Gift text.');
  status.textContent = `Ready: ${card.number} · ${card.jpName}`;
  output.textContent = JSON.stringify({ number: card.number, name: card.jpName, CAndS: card.variants.map(variant => variant.id), gift: card.keyword, arts: card.arts[0] }, null, 2);
} catch (error) { report(String(error), false, { error: String(error) }); }
