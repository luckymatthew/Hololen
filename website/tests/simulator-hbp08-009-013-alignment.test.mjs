import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const instance = (id, number) => ({ id, number });
const emptyZones = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });

function stageUnit(id, number, overrides = {}) {
  return {
    stack: [instance(id, number)], cheer: [], attachments: [], damage: 0, rested: false,
    enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], ...overrides,
  };
}

function player(name, overrides = {}) {
  return {
    name, ready: true, setupDone: true, oshi: instance(`${name}-oshi`, "hBP08-001"),
    mainDeck: [], cheerDeck: [], hand: [], life: [instance(`${name}-life`, "hY01-001")],
    holoPower: [], archive: [], removed: [], zones: emptyZones(), collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, turnsTaken: 2, mulliganUsed: false, forcedRedraws: 0,
    oshiSkillTurn: 0, spOshiSkillUsed: false, namedUsageTurns: {}, modifiers: [], ...overrides,
  };
}

function playingState(players, overrides = {}) {
  return {
    status: "playing", players, activePlayer: 0, firstPlayer: 0, winner: null,
    turn: 3, phase: "main", pendingChoice: null, effectQueue: [], knockouts: [], lifeLosses: [], log: [],
    ...overrides,
  };
}

function attackWith(number, cheers, opponentNumber = "hBP01-028") {
  const host = player("IRyS");
  host.zones.center = stageUnit("irys-attacker", number, { cheer: cheers.map((cheer, index) => instance(`cheer-${index}`, cheer)) });
  host.mainDeck = [instance("gift-top", "hY01-001")];
  const guest = player("Opponent");
  guest.zones.center = stageUnit("opponent-center", opponentNumber);
  return applyAction(playingState([host, guest], { phase: "performance" }), 0,
    { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
}

test("hBP08-009 and hBP08-010 basic Arts use their printed colorless cost and damage", () => {
  for (const [number, damage] of [["hBP08-009", 20], ["hBP08-010", 40]]) {
    const state = attackWith(number, ["hY01-001"]);
    assert.equal(state.players[1].zones.center.damage, damage);
    assert.equal(state.players[0].zones.center.cheer.length, 1);
  }
});

test("hBP08-011 Arts draws one only when that IRyS has attached purple Cheer", () => {
  const purple = attackWith("hBP08-011", ["hY05-001"]);
  assert.equal(purple.players[0].hand.length, 1);
  assert.equal(purple.players[0].mainDeck.length, 0);

  const white = attackWith("hBP08-011", ["hY01-001"]);
  assert.equal(white.players[0].hand.length, 0);
  assert.equal(white.players[0].mainDeck.length, 1);
});

test("hBP08-011 Collab draws one only when that IRyS has attached white Cheer", () => {
  for (const [cheer, draws] of [["hY01-001", true], ["hY05-001", false]]) {
    const guest = player("FirstPlayer");
    const host = player("IRyS", { turnsTaken: 2, mainDeck: [instance("collab-power", "hY01-001"), instance("draw-card", "hY01-001")] });
    host.zones.back1 = stageUnit("irys-collab", "hBP08-011", { cheer: [instance("attached-cheer", cheer)] });
    const state = applyAction(playingState([guest, host], { activePlayer: 1, turn: 4 }), 1,
      { type: "collab", zone: "back1" }, cards);
    assert.equal(state.players[1].hand.some((card) => card.id === "draw-card"), draws);
    assert.equal(state.players[1].mainDeck.some((card) => card.id === "draw-card"), !draws);
  }
});

test("hBP08-012 Arts adds 20 special damage to the opposing Center only with attached purple Cheer", () => {
  const purple = attackWith("hBP08-012", ["hY01-001", "hY05-001"]);
  assert.equal(purple.players[1].zones.center.damage, 70);

  const white = attackWith("hBP08-012", ["hY01-001", "hY01-001"]);
  assert.equal(white.players[1].zones.center.damage, 50);
});

test("hBP08-012 Bloom bottoms one stage Cheer, then gives the Cheer deck top to an own IRyS", () => {
  const host = player("IRyS", {
    hand: [instance("bloom-card", "hBP08-012")],
    cheerDeck: [instance("cheer-top", "hY01-001")],
  });
  host.zones.center = stageUnit("irys-debut", "hBP01-028", { cheer: [instance("cheer-cost", "hY05-001")] });
  const guest = player("Opponent");

  let state = applyAction(playingState([host, guest]), 0, { type: "play", cardId: "bloom-card" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.pendingChoice.type, "stageCheerSelection");
  assert.equal(state.pendingChoice.effect, "cheerBottomToIrys");
  assert.equal(state.pendingChoice.optional, true);
  state = applyAction(state, 0, { type: "choose", cheerId: "cheer-cost" }, cards);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);

  assert.equal(state.players[0].zones.center.cheer.some((cheer) => cheer.id === "cheer-top"), true);
  assert.deepEqual(state.players[0].cheerDeck.map((cheer) => cheer.id), ["cheer-cost"]);
});

test("hBP08-013 purple Cheer adds 50 Arts damage and its knockout Gift moves deck top into Holo Power", () => {
  const state = attackWith("hBP08-013", ["hY01-001", "hY05-001"]);
  assert.equal(state.players[1].zones.center, null);
  assert.deepEqual(state.players[0].holoPower.map((card) => card.id), ["gift-top"]);
});

test("hBP08-013 has no purple-Cheer Arts bonus when only white Cheer is attached", () => {
  const state = attackWith("hBP08-013", ["hY01-001", "hY01-001"], "hBP01-028");
  assert.equal(state.players[1].zones.center.damage, 70);
  assert.deepEqual(state.players[0].holoPower, []);
});
