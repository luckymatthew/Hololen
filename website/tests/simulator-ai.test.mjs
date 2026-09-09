import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createLobbyState, joinLobby } from "../lib/simulator/engine.mjs";
import { chooseAiAction, runAiStep, runAiUntilHuman } from "../lib/simulator/ai.mjs";

const cards = [
  { number: "O-1", name: "AI Oshi", group: "oshi", life: 5, maxCopies: 1, colors: ["白"], arts: [] },
  { number: "D-1", name: "AI Debut", jpName: "AI Debut", group: "holomem", stage: "Debut", hp: 100, maxCopies: 99, colors: ["白"], arts: [{ name: "Strike", damage: 30, cost: [] }] },
  { number: "D-2", name: "AI Charger", jpName: "AI Charger", group: "holomem", stage: "Debut", hp: 100, maxCopies: 99, colors: ["白"], arts: [{ name: "Charged Strike", damage: 90, cost: ["白", "白"] }] },
  { number: "C-1", name: "White Cheer", group: "cheer", maxCopies: 20, colors: ["白"], arts: [] },
];

const deck = { oshi: { "O-1": 1 }, main: { "D-1": 50 }, cheer: { "C-1": 20 } };

function startSolo(random = () => 0.8) {
  let state = createLobbyState("Human", deck);
  state = joinLobby(state, "AIこより · EXPERT", deck);
  state.mode = "solo";
  state.aiPlayer = 1;
  state = applyAction(state, 0, { type: "ready", ready: true }, cards, random);
  state = applyAction(state, 1, { type: "ready", ready: true }, cards, random);
  return state;
}

test("single-player AI chooses a legal opening board and waits for the human", () => {
  const state = runAiUntilHuman(startSolo(), cards, 1, () => 0.8);
  assert.equal(state.status, "setup");
  assert.equal(state.players[1].setupDone, true);
  assert.ok(state.players[1].zones.center);
  assert.equal(state.players[0].setupDone, false);
});

test("single-player AI advances exactly one visible decision per step", () => {
  const state = runAiStep(startSolo(), cards, 1, () => 0.8);
  assert.equal(state.aiLastStepCount, 1);
  assert.equal(state.players[1].setupDone, true);
  assert.equal(state.players[0].setupDone, false);
});

test("card-aware AI completes its turn instead of blocking on choices", () => {
  let state = runAiUntilHuman(startSolo(), cards, 1, () => 0.8);
  const human = state.players[0];
  state = applyAction(state, 0, { type: "setup", centerId: human.hand[0].id, backIds: [], bottomIds: [] }, cards, () => 0.8);
  state = runAiUntilHuman(state, cards, 1, () => 0.8);
  assert.ok(state.status === "finished" || state.activePlayer === 0 || state.pendingChoice?.playerIndex === 0);
  assert.ok(Number(state.aiLastStepCount || 0) > 0);
});

test("combat AI prioritizes a legal knockout instead of spreading damage", () => {
  let state = runAiUntilHuman(startSolo(), cards, 1, () => 0.8);
  const human = state.players[0];
  state = applyAction(state, 0, { type: "setup", centerId: human.hand[0].id, backIds: [], bottomIds: [] }, cards, () => 0.8);
  state.activePlayer = 1;
  state.firstPlayer = 0;
  state.phase = "performance";
  state.turn = 2;
  state.pendingChoice = null;
  state.players[1].turnsTaken = 2;
  state.players[1].zones.center.rested = false;
  state.players[0].zones.center.damage = 0;
  state.players[0].zones.collab = { stack: [{ id: "wounded", number: "D-1" }], cheer: [], attachments: [], damage: 80, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null };
  const action = chooseAiAction(state, 1, cards);
  assert.equal(action.type, "attack");
  assert.equal(action.targetZone, "collab");
});

test("generic AI sends Cheer to the unit that becomes attack-ready", () => {
  let state = runAiUntilHuman(startSolo(), cards, 1, () => 0.8);
  state.status = "playing";
  state.players[1].zones.center = { stack: [{ id: "charger", number: "D-2" }], cheer: [{ id: "cheer-one", number: "C-1" }], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null };
  state.players[1].zones.back1 = { stack: [{ id: "bench", number: "D-1" }], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null };
  state.activePlayer = 1;
  state.phase = "cheer";
  state.pendingChoice = { type: "cheerTarget", playerIndex: 1, cardNumber: "C-1", options: ["center", "back1"] };
  state.players[1].cheerDeck = [{ id: "cheer-two", number: "C-1" }];
  const action = chooseAiAction(state, 1, cards);
  assert.deepEqual(action, { type: "choose", zone: "center" });
});
