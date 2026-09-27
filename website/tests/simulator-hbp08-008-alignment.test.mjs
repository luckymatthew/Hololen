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

test("hBP08-008 basic Arts costs one colorless Cheer and deals 30 damage", () => {
  const host = player("IRyS");
  host.zones.center = stageUnit("irys-center", "hBP08-008", { cheer: [instance("white-cheer", "hY01-001")] });
  const guest = player("Opponent");
  guest.zones.center = stageUnit("opponent-center", "hBP01-015");

  const state = applyAction(playingState([host, guest], { phase: "performance" }), 0,
    { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);

  assert.equal(state.players[1].zones.center.damage, 30);
  assert.equal(state.players[0].zones.center.rested, true);
  assert.deepEqual(state.players[0].zones.center.cheer.map((card) => card.id), ["white-cheer"]);
  assert.equal(state.players[0].archive.some((card) => card.id === "white-cheer"), false);
});

test("hBP08-008 second-player first-turn Collab buffs one #Promise Holomen without drawing when no stage Cheer is purple", () => {
  const guest = player("FirstPlayer");
  const host = player("IRyS", {
    turnsTaken: 1,
    mainDeck: [instance("collab-power", "hY01-001"), instance("top-card", "hY01-001")],
  });
  host.zones.center = stageUnit("promise-center", "hBP01-015", { cheer: [instance("white-cheer", "hY01-001")] });
  host.zones.back1 = stageUnit("irys-collab", "hBP08-008");

  let state = applyAction(playingState([guest, host], { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1,
    { type: "collab", zone: "back1" }, cards);
  assert.equal(state.pendingChoice.effect, "addModifier");
  state = applyAction(state, 1, { type: "choose", zone: "center" }, cards);

  assert.equal(state.players[1].zones.center.modifiers.at(-1).amount, 30);
  assert.deepEqual(state.players[1].hand, []);
  assert.deepEqual(state.players[1].mainDeck.map((card) => card.id), ["top-card"]);
});

test("hBP08-008 Promise of Spring does not activate on its owner's first-player first turn", () => {
  const guest = player("Opponent");
  const host = player("IRyS", { turnsTaken: 1, mainDeck: [instance("collab-power", "hY01-001")] });
  host.zones.center = stageUnit("promise-center", "hBP01-015");
  host.zones.back1 = stageUnit("irys-collab", "hBP08-008");

  const state = applyAction(playingState([guest, host], { activePlayer: 1, firstPlayer: 1, turn: 1 }), 1,
    { type: "collab", zone: "back1" }, cards);

  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[1].zones.center.modifiers.length, 0);
});
