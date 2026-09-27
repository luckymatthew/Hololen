import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { inst, pool, state, unit } from "./fixtures/simulator-audit.mjs";

function collabWatame(playerIndex, turnsTaken) {
  let game = state("AUDIT-DUMMY");
  game.phase = "main";
  game.activePlayer = playerIndex;
  game.players[playerIndex].turnsTaken = turnsTaken;
  game.players[playerIndex].zones.back1 = unit("hBP07-023");
  game.players[playerIndex].mainDeck = [
    inst("AUDIT-DUMMY", "power"),
    inst("AUDIT-DUMMY", "top-1"),
    inst("AUDIT-DUMMY", "top-2"),
    inst("AUDIT-DUMMY", "top-3"),
    inst("AUDIT-DUMMY", "next"),
  ];
  return applyAction(game, playerIndex, { type: "collab", zone: "back1" }, pool, () => 0);
}

test("hBP07-023 top-three search runs only for the second player's first turn", () => {
  const firstPlayerLaterTurn = collabWatame(0, 2);
  assert.equal(firstPlayerLaterTurn.pendingChoice, null);
  const secondPlayerLaterTurn = collabWatame(1, 2);
  assert.equal(secondPlayerLaterTurn.pendingChoice, null);
  const secondPlayerFirstTurn = collabWatame(1, 1);
  assert.equal(secondPlayerFirstTurn.pendingChoice.type, "cardSelection");
  assert.equal(secondPlayerFirstTurn.pendingChoice.min, 1);
  assert.equal(secondPlayerFirstTurn.pendingChoice.max, 1);
  assert.equal(secondPlayerFirstTurn.pendingChoice.optional, false);
  assert.equal(secondPlayerFirstTurn.pendingChoice.meta.remainder, "top");
});
