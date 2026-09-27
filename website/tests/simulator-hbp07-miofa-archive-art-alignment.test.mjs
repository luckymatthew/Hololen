import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { attack, fund, inst, pool, state } from "./fixtures/simulator-audit.mjs";

function startMiofaArt(topNumber) {
  let game = state("hBP07-024");
  fund(game.players[0].zones.center, ["綠"]);
  game.players[0].mainDeck = [inst(topNumber, "top"), inst("AUDIT-DUMMY", "next")];
  game = applyAction(game, 0, attack, pool, () => 0);
  return game;
}

test("hBP07-024 offers its top-card Archive as an optional Arts choice", () => {
  const game = startMiofaArt("hBP01-102");
  assert.equal(game.pendingChoice.type, "optionChoice");
  assert.equal(game.pendingChoice.effect, "hBP07MiofaArchiveTop");
  assert.equal(game.pendingChoice.optional, true);
  assert.deepEqual(game.pendingChoice.modeOptions.map(({ id }) => id), ["archive"]);
});

test("hBP07-024 may skip archiving and then its Arts gets no support bonus", () => {
  let game = startMiofaArt("hBP01-102");
  game = applyAction(game, 0, { type: "choose", skip: true }, pool, () => 0);
  assert.equal(game.players[0].archive.length, 0);
  assert.equal(game.players[0].mainDeck[0].id, "top");
  assert.equal(game.players[1].zones.center.damage, 10);
});

test("hBP07-024 gains +30 only when the archived top card is a Support", () => {
  let supportGame = startMiofaArt("hBP01-102");
  supportGame = applyAction(supportGame, 0, { type: "choose", optionId: "archive" }, pool, () => 0);
  assert.equal(supportGame.players[0].archive[0].id, "top");
  assert.equal(supportGame.players[1].zones.center.damage, 40);

  let cheerGame = startMiofaArt("hY01-001");
  cheerGame = applyAction(cheerGame, 0, { type: "choose", optionId: "archive" }, pool, () => 0);
  assert.equal(cheerGame.players[0].archive[0].id, "top");
  assert.equal(cheerGame.players[1].zones.center.damage, 10);
});
