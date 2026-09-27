import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { cards, pool, state, inst } from "./fixtures/simulator-audit.mjs";

test("hBP07-007 SP requires one to four eligible Nene Debuts and places the selected cards", () => {
  const neneDebut = cards.find((card) => card.group === "holomem"
    && card.stage === "Debut"
    && ["桃鈴ねね", "桃鈴音音"].some((name) => card.jpName === name || card.name === name));
  assert.ok(neneDebut, "fixture catalog contains a Nene Debut");

  const game = state();
  game.phase = "main";
  game.players[0].oshi = inst("hBP07-007", "oshi");
  game.players[0].holoPower = [inst("AUDIT-DUMMY", "power")];
  const neneCards = Array.from({ length: 4 }, (_, index) => inst(neneDebut.number, `nene-${index + 1}`));
  game.players[0].mainDeck = [...neneCards, inst("AUDIT-DUMMY", "filler")];

  let result = applyAction(game, 0, { type: "spOshiSkill" }, pool, () => 0);
  assert.equal(result.pendingChoice?.effect, "deckCardsToStage");
  assert.equal(result.pendingChoice?.optional, false);
  // Hidden deck choices use min=0 to represent an empty filtered result;
  // nonEmptyMin enforces the printed minimum whenever eligible cards exist.
  assert.equal(result.pendingChoice?.min, 0);
  assert.equal(result.pendingChoice?.nonEmptyMin, 1);
  assert.equal(result.pendingChoice?.max, 4);
  assert.throws(() => applyAction(result, 0, { type: "choose", skip: true }, pool, () => 0));

  result = applyAction(result, 0, { type: "choose", cardIds: neneCards.map((card) => card.id) }, pool, () => 0);
  for (const zone of ["back1", "back2", "back3", "back4"]) {
    assert.equal(result.pendingChoice?.effect, "placeCard");
    result = applyAction(result, 0, { type: "choose", zone }, pool, () => 0);
  }
  assert.equal(result.pendingChoice, null);
  assert.deepEqual(
    ["back1", "back2", "back3", "back4"].map((zone) => result.players[0].zones[zone]?.stack[0]?.id),
    neneCards.map((card) => card.id),
  );
  assert.deepEqual(result.players[0].mainDeck.map((card) => card.id), ["filler"]);
});
