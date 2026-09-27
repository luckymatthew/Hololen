import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { pool, inst, state, unit, fund } from "./fixtures/simulator-audit.mjs";

function resolveCeciliaAbilityDamage(sourcePlayerIndex) {
  const battle = state("AUDIT-DUMMY", "AUDIT-DUMMY");
  battle.phase = "main";
  battle.activePlayer = sourcePlayerIndex;
  battle.players[0].zones.center = unit("hBP08-024", { rested: true });
  battle.players[sourcePlayerIndex].zones.back1 = unit("AUDIT-DUMMY");
  battle.pendingChoice = {
    type: "stageTarget",
    playerIndex: sourcePlayerIndex,
    targetPlayerIndex: 0,
    options: ["center"],
    effect: "specialDamage",
    optional: false,
    meta: { amount: 20, loseLife: false, sourceName: "Scope check", sourceZone: "back1" },
  };
  return applyAction(battle, sourcePlayerIndex, { type: "choose", zone: "center" }, pool, () => 0.5);
}

test("hBP08-024 protects a rested Cecilia from an opponent ability, not her owner's ability", () => {
  const opponentEffect = resolveCeciliaAbilityDamage(1);
  const ownerEffect = resolveCeciliaAbilityDamage(0);

  assert.equal(opponentEffect.players[0].zones.center.damage, 0);
  assert.equal(ownerEffect.players[0].zones.center.damage, 20);
});

test("hBP08-022 makes the Cecilia that Baton Touch moved to the Back rested", () => {
  const battle = state("hBP08-022");
  battle.phase = "main";
  fund(battle.players[0].zones.center, ["白"]);
  battle.players[0].zones.back1 = unit("AUDIT-DUMMY");

  const result = applyAction(battle, 0, { type: "baton", zone: "back1" }, pool, () => 0.5);

  assert.equal(result.players[0].zones.back1.stack.at(-1).number, "hBP08-022");
  assert.equal(result.players[0].zones.back1.rested, true);
});

test("hBP08-023 does not heal from a single rested Justice after its optional rest", () => {
  const battle = state("hBP08-023");
  battle.phase = "main";
  battle.players[0].hand = [inst("hBP08-023", "bloom")];
  battle.players[0].zones.center = unit("hBP08-022", { enteredTurn: 1 });
  battle.players[0].zones.back1 = unit("hBP08-024", { damage: 60 });

  let result = applyAction(battle, 0, { type: "play", cardId: "bloom" }, pool, () => 0.5);
  result = applyAction(result, 0, { type: "choose", zone: "center" }, pool, () => 0.5);
  result = applyAction(result, 0, { type: "choose", optionId: "use" }, pool, () => 0.5);

  assert.equal(result.players[0].zones.center.rested, true);
  assert.equal(result.players[0].zones.back1.damage, 60);
  assert.equal(result.pendingChoice, null);
});

test("hBP08-026 Collab grants +50 to itself only when two Justice are rested", () => {
  const battle = state("AUDIT-DUMMY");
  battle.phase = "main";
  battle.players[0].zones.back1 = unit("hBP08-026");
  fund(battle.players[0].zones.back1, ["綠", "無色"]);
  battle.players[0].zones.back2 = unit("hBP08-024", { rested: true });
  battle.players[0].zones.back3 = unit("hBP08-024", { rested: true });

  let result = applyAction(battle, 0, { type: "collab", zone: "back1" }, pool, () => 0.5);
  assert.ok(result.players[0].zones.collab.modifiers.some((modifier) => modifier.kind === "arts" && modifier.amount === 50));
  result.phase = "performance";
  result = applyAction(result, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, pool, () => 0.5);
  assert.equal(result.players[1].zones.center.damage, 140);
});
