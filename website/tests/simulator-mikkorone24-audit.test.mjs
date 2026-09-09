import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { pool, state, inst } from "./fixtures/simulator-audit.mjs";

const supportNumber = "hBP02-086";
const act = (s, action, die = 1, randomOverride = null) => applyAction(structuredClone(s), 0, action, pool, randomOverride || (() => (die - 0.5) / 6));

function setup(deck = null) {
  const s = state();
  s.phase = "main";
  s.players[0].hand = [inst("hBP02-084", "event")];
  s.players[0].mainDeck = deck || [
    inst(supportNumber, "draw-1"),
    inst(supportNumber, "draw-2"),
    inst("AUDIT-DUMMY", "debut"),
    inst(supportNumber, "tail-1"),
    inst(supportNumber, "tail-2"),
  ];
  return s;
}

for (const die of [1, 2, 3, 4, 5, 6]) test(`Mikkorone 24 die ${die}`, () => {
  const s = act(setup(), { type: "play", cardId: "event" }, die);
  const success = [3, 5, 6].includes(die);
  assert.equal(s.players[0].hand.filter((card) => card.id.startsWith("draw-")).length, 2);
  if (success) {
    assert.equal(s.pendingChoice.type, "cardSelection");
    assert.equal(s.pendingChoice.effect, "deckToHandShuffle");
    assert.equal(s.pendingChoice.min, 0);
    assert.equal(s.pendingChoice.max, 1);
    assert.equal(s.pendingChoice.optional, true);
    assert.deepEqual(s.pendingChoice.selectableIds, ["debut"]);
  } else {
    assert.equal(s.pendingChoice, null);
    assert.equal(s.players[0].hand.length, [2, 4].includes(die) ? 3 : 2);
  }
});

test("Mikkorone 24 may treat an eligible Debut in the hidden deck as absent and still shuffles", () => {
  let s = act(setup(), { type: "play", cardId: "event" }, 3);
  const before = s.players[0].mainDeck.map((card) => card.id);
  s = act(s, { type: "choose", skip: true }, 1, () => 0);
  assert.equal(s.pendingChoice, null);
  assert.equal(s.players[0].hand.some((card) => card.id === "debut"), false);
  assert.notDeepEqual(s.players[0].mainDeck.map((card) => card.id), before);
});

test("Mikkorone 24 may reveal one Debut, add it to hand, then shuffles", () => {
  let s = act(setup(), { type: "play", cardId: "event" }, 5);
  const before = s.players[0].mainDeck.filter((card) => card.id !== "debut").map((card) => card.id);
  s = act(s, { type: "choose", cardIds: ["debut"] }, 1, () => 0);
  assert.ok(s.players[0].hand.some((card) => card.id === "debut"));
  assert.notDeepEqual(s.players[0].mainDeck.map((card) => card.id), before);
});

test("Mikkorone 24 finishes and shuffles when no Debut exists after drawing", () => {
  const deck = [
    inst(supportNumber, "draw-1"),
    inst(supportNumber, "draw-2"),
    inst(supportNumber, "tail-1"),
    inst(supportNumber, "tail-2"),
    inst(supportNumber, "tail-3"),
  ];
  const before = deck.slice(2).map((card) => card.id);
  let calls = 0;
  const s = act(setup(deck), { type: "play", cardId: "event" }, 6, () => calls++ === 0 ? (6 - 0.5) / 6 : 0);
  assert.equal(s.pendingChoice, null);
  assert.notDeepEqual(s.players[0].mainDeck.map((card) => card.id), before);
  assert.equal(s.players[0].hand.length, 2);
});
