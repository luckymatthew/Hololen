import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let serial = 0;
const instance = number => ({ id: `q748-${++serial}`, number });
const unit = () => ({ stack: [instance("hBP09-064")], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
function scenario(powerCount) {
  const player = (name, oshi) => ({
    name, ready: true, setupDone: true, oshi: instance(oshi), mainDeck: Array.from({ length: 10 }, () => instance("hBP09-051")),
    cheerDeck: [], hand: [], life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: { center: unit(), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
    turnsTaken: 2, mulliganUsed: false, forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, namedUsageTurns: {}, modifiers: [],
  });
  const own = player("You", "hBP09-002"), rival = player("Rival", "hBP09-001");
  own.mainDeck = [];
  own.holoPower = Array.from({ length: powerCount }, () => instance("hBP09-051"));
  const support = instance("hBP09-102");
  own.hand.push(support);
  return { state: { status: "playing", players: [own, rival], activePlayer: 0, firstPlayer: 1, winner: null, turn: 3, phase: "main", pendingChoice: null, effectQueue: [], knockouts: [], lifeLosses: [], log: [] }, support };
}

test("hBP09-102 cannot be played with neither deck nor Holo Power cards (official Q748)", () => {
  const { state, support } = scenario(0), before = structuredClone(state);
  assert.throws(() => applyAction(state, 0, { type: "play", cardId: support.id }, cards, () => 0.25), /牌庫與 Holo Power 均沒有/u);
  assert.deepEqual(state, before, "a prohibited Support use must not archive the card or mutate state");
});

test("hBP09-102 remains usable with empty deck and one Holo Power, and taking one is mandatory (Q746/Q747)", () => {
  const { state, support } = scenario(1), power = state.players[0].holoPower[0];
  let next = applyAction(state, 0, { type: "play", cardId: support.id }, cards, () => 0.25);
  assert.equal(next.pendingChoice.type, "cardSelection");
  assert.equal(next.pendingChoice.min, 1);
  assert.equal(next.pendingChoice.max, 1);
  assert.equal(next.pendingChoice.optional, false);
  assert.throws(() => applyAction(next, 0, { type: "choose", cardIds: [] }, cards, () => 0.25), /Wrong selection count/u);
  next = applyAction(next, 0, { type: "choose", cardIds: [power.id] }, cards, () => 0.25);
  assert.equal(next.pendingChoice, null);
  assert.deepEqual(next.players[0].holoPower, []);
  assert.ok(next.players[0].hand.some(card => card.id === power.id));
});
