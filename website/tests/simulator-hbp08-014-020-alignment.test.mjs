import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { cards, inst, pool, state, unit, fund } from "./fixtures/simulator-audit.mjs";

function resolveArtsDamage(sourcePlayerIndex, targetPlayerIndex = 0) {
  const battle = state("hBP08-015");
  battle.phase = "main";
  battle.activePlayer = sourcePlayerIndex;
  battle.players[targetPlayerIndex].zones.center = unit("hBP08-015");
  battle.players[sourcePlayerIndex].zones.back1 = unit("AUDIT-DUMMY");
  battle.effectQueue = [{
    type: "dealArtsDamage",
    playerIndex: sourcePlayerIndex,
    targetPlayerIndex,
    targetZone: "center",
    sourceZone: "back1",
    damage: 20,
    sourceName: "Scope check",
    artName: "Scope check Arts",
  }];
  return applyAction(battle, sourcePlayerIndex, { type: "advance" }, pool, () => 0.5);
}

test("hBP08-015 Gift reduces incoming opponent Arts damage by 10", () => {
  const opponentArts = resolveArtsDamage(1);
  assert.equal(opponentArts.players[0].zones.center.damage, 10);
});

test("hBP08-015 Gift does not reduce same-owner Arts damage", () => {
  const ownArts = resolveArtsDamage(0);
  assert.equal(ownArts.players[0].zones.center.damage, 20);
});

test("hBP08-015 Gift does not reduce special damage", () => {
  const battle = state("hBP08-015");
  battle.phase = "main";
  battle.activePlayer = 1;
  battle.players[0].zones.center = unit("hBP08-015");
  battle.players[1].zones.back1 = unit("AUDIT-DUMMY");
  battle.effectQueue = [{ type: "specialDamage", playerIndex: 1, targetPlayerIndex: 0, targetZone: "center", sourceZone: "back1", amount: 20, loseLife: true, sourceName: "Scope check" }];
  const result = applyAction(battle, 1, { type: "advance" }, pool, () => 0.5);
  assert.equal(result.players[0].zones.center.damage, 20);
});

test("hBP08-014 Arts adds 20 per attached purple Cheer and the printed red bonus", () => {
  const battle = state("hBP08-014");
  fund(battle.players[0].zones.center, ["紫", "紫", "白"]);
  battle.players[0].zones.back1 = unit("hBP08-016");
  const redTarget = cards.filter((card) => card.group === "holomem" && card.colors.includes("紅")).sort((left, right) => right.hp - left.hp)[0];
  assert.ok(redTarget, "fixture needs a red Holomem to exercise the printed target bonus");
  battle.players[1].zones.center = unit(redTarget.number);

  const result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5);

  assert.equal(result.players[1].zones.center.damage, 220);
  assert.ok(result.players[0].zones.center.modifiers.some((modifier) => modifier.kind === "arts" && modifier.amount === 40));
  assert.ok(result.players[0].zones.back1.modifiers.some((modifier) => modifier.kind === "arts" && modifier.amount === 40));
});

test("hBP08-015 basic Arts deals its printed 20 damage", () => {
  const battle = state("hBP08-015");
  fund(battle.players[0].zones.center, ["白"]);
  const result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5);
  assert.equal(result.players[1].zones.center.damage, 20);
});

for (const soraCount of [2, 3]) {
  test(`hBP08-016 first Arts draws only with three Sora (${soraCount})`, () => {
    const battle = state("hBP08-016");
    fund(battle.players[0].zones.center, ["白"]);
    battle.players[0].zones.back1 = unit("hBP08-015");
    if (soraCount === 3) battle.players[0].zones.back2 = unit("hBP08-017");
    battle.players[0].mainDeck = [inst("AUDIT-DUMMY", "top"), inst("AUDIT-DUMMY", "next")];

    const result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5);

    assert.equal(result.players[1].zones.center.damage, 30);
    assert.equal(result.players[0].hand.length, soraCount === 3 ? 1 : 0);
    if (soraCount === 3) assert.equal(result.players[0].hand[0].id, "top");
  });
}

test("hBP08-016 second Arts keeps its printed 90 damage", () => {
  const battle = state("hBP08-016");
  fund(battle.players[0].zones.center, ["白", "白", "白"]);
  const result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 1, targetZone: "center" }, pool, () => 0.5);
  assert.equal(result.players[1].zones.center.damage, 90);
});

test("hBP08-017 Arts does not count a 2nd member outside #0期生", () => {
  const battle = state("hBP08-017");
  fund(battle.players[0].zones.center, ["白", "無色"]);
  const other2nd = cards.find((card) => card.group === "holomem" && card.stage === "2nd" && !card.tags.includes("#0期生"));
  assert.ok(other2nd, "fixture needs a non-#0期生 2nd Holomem");
  battle.players[0].zones.back1 = unit(other2nd.number);
  const result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5);
  assert.equal(result.players[1].zones.center.damage, 40);
});

for (const zone of ["center", "collab", "back1"]) {
  test(`hBP08-018 Bloom draw respects its Center/Collab-only restriction (${zone})`, () => {
    const battle = state("hBP08-018");
    battle.phase = "main";
    battle.players[0].hand = [inst("hBP08-018", "bloom")];
    battle.players[0].zones[zone] = unit("hBP08-016", { enteredTurn: 1 });
    battle.players[0].mainDeck = [inst("AUDIT-DUMMY", "draw1"), inst("AUDIT-DUMMY", "draw2")];

    let result = applyAction(battle, 0, { type: "play", cardId: "bloom" }, pool, () => 0.5);
    result = applyAction(result, 0, { type: "choose", zone }, pool, () => 0.5);

    assert.equal(result.players[0].hand.length, zone === "back1" ? 0 : 2);
    assert.equal(result.players[0].mainDeck.length, zone === "back1" ? 2 : 0);
  });
}

test("hBP08-018 Arts grants the Back-2nd target only under a Sora Oshi", () => {
  const battle = state("hBP08-018");
  battle.phase = "performance";
  battle.players[0].oshi = inst("hSD01-001", "sora-oshi");
  battle.players[0].zones.center = unit("hBP08-016", { cheer: [inst("hY01-001", "pay1")] });
  battle.players[0].zones.collab = unit("hBP08-018", { cheer: [inst("hY01-001", "pay2"), inst("hY01-001", "pay3"), inst("hY01-001", "pay4"), inst("hY01-001", "pay5")] });
  battle.players[1].zones.center = unit("AUDIT-DUMMY");
  battle.players[1].zones.back2 = unit("hBP08-016");

  let result = applyAction(battle, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, pool, () => 0.5);

  assert.equal(result.pendingChoice?.effect, "artAttackSecondBack");
  result = applyAction(result, 0, { type: "choose", zone: "center" }, pool, () => 0.5);
  assert.ok(result.players[0].zones.center.modifiers.some((modifier) => modifier.kind === "attackSecondBack"));
});

test("hBP08-018 Arts does not offer the extra target under another Oshi", () => {
  const battle = state("hBP08-018");
  battle.phase = "performance";
  battle.players[0].zones.center = unit("hBP08-016", { cheer: [inst("hY01-001", "pay1")] });
  battle.players[0].zones.collab = unit("hBP08-018", { cheer: [inst("hY01-001", "pay2"), inst("hY01-001", "pay3"), inst("hY01-001", "pay4"), inst("hY01-001", "pay5")] });
  battle.players[1].zones.center = unit("AUDIT-DUMMY");
  battle.players[1].zones.back2 = unit("hBP08-016");
  const result = applyAction(battle, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, pool, () => 0.5);
  assert.notEqual(result.pendingChoice?.effect, "artAttackSecondBack");
  assert.equal(result.players[0].zones.center.modifiers.some((modifier) => modifier.kind === "attackSecondBack"), false);
});

function resolveIncomingRaoraDamage(withChattino) {
  const battle = state("AUDIT-DUMMY", "AUDIT-DUMMY");
  battle.phase = "main";
  battle.activePlayer = 1;
  const chattino = cards.find((card) => card.jpName === "Chattino" || card.name === "Chattino");
  battle.players[0].zones.center = unit("hBP08-019", {
    attachments: withChattino ? [inst(chattino.number, "chattino")] : [],
  });
  battle.players[1].zones.back1 = unit("AUDIT-DUMMY");
  battle.effectQueue = [{
    type: "dealArtsDamage",
    playerIndex: 1,
    targetPlayerIndex: 0,
    targetZone: "center",
    sourceZone: "back1",
    damage: 140,
    sourceName: "Scope check",
    artName: "Scope check Arts",
  }];
  return applyAction(battle, 1, { type: "advance" }, pool, () => 0.5);
}

test("hBP08-019 Gift gives +30 HP only while Chattino is equipped", () => {
  const protectedRaora = resolveIncomingRaoraDamage(true);
  const unprotectedRaora = resolveIncomingRaoraDamage(false);
  assert.equal(protectedRaora.players[0].zones.center.damage, 140);
  assert.equal(unprotectedRaora.players[0].zones.center, null);
});

test("hBP08-019 without Chattino reduces its White Arts cost and resolves the search", () => {
  const battle = state("hBP08-019");
  battle.players[0].mainDeck = [inst(cards.find((card) => card.jpName === "Chattino" || card.name === "Chattino").number, "pick")];

  let result = applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5);
  assert.equal(result.pendingChoice?.optional, false);
  result = applyAction(result, 0, { type: "choose", cardIds: ["pick"] }, pool, () => 0.5);
  assert.deepEqual(result.pendingChoice.options, ["center"]);
  result = applyAction(result, 0, { type: "choose", zone: "center" }, pool, () => 0.5);
  assert.equal(result.players[0].zones.center.attachments[0].id, "pick");
  assert.equal(result.players[1].zones.center.damage, 10);
});

test("hBP08-019 with Chattino no longer has its conditional White cost reduction", () => {
  const battle = state("hBP08-019");
  const chattino = cards.find((card) => card.jpName === "Chattino" || card.name === "Chattino");
  battle.players[0].zones.center.attachments = [inst(chattino.number, "chattino")];
  assert.throws(() => applyAction(battle, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, pool, () => 0.5));
});

for (const archivedCount of [1, 2]) {
  test(`hBP08-020 Collab archives and replaces ${archivedCount} deck cards`, () => {
    const battle = state("hBP08-020");
    battle.phase = "main";
    battle.players[0].zones.back1 = unit("hBP08-020");
    battle.players[0].mainDeck = [
      inst("AUDIT-DUMMY", "collab-power"),
      inst("AUDIT-DUMMY", "archive1"),
      inst("AUDIT-DUMMY", "archive2"),
      inst("AUDIT-DUMMY", "draw1"),
      inst("AUDIT-DUMMY", "draw2"),
    ];

    let result = applyAction(battle, 0, { type: "collab", zone: "back1" }, pool, () => 0.5);
    assert.equal(result.pendingChoice?.effect, "archiveDeckTopDraw");
    result = applyAction(result, 0, { type: "choose", optionId: String(archivedCount) }, pool, () => 0.5);

    assert.equal(result.players[0].holoPower.at(-1).id, "collab-power");
    assert.deepEqual(result.players[0].archive.map((card) => card.id), archivedCount === 1 ? ["archive1"] : ["archive1", "archive2"]);
    assert.equal(result.players[0].hand.length, archivedCount);
    assert.deepEqual(result.players[0].hand.map((card) => card.id), archivedCount === 1 ? ["archive2"] : ["draw1", "draw2"]);
  });
}
