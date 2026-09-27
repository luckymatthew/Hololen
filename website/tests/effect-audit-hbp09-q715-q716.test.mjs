import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = number => ({ id: `hbp09-q715-${++sequence}`, number });
const unit = (number, cheer = [], damage = 0) => ({
  stack: [instance(number)], cheer, attachments: [], damage, rested: false,
  enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
function player(name, zones) {
  return {
    name, ready: true, setupDone: true, oshi: instance("hBP09-001"),
    mainDeck: Array.from({ length: 20 }, () => instance("hBP09-051")), cheerDeck: [], hand: [],
    life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null, ...zones },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1, turnsTaken: 2, mulliganUsed: false,
    forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    namedUsageTurns: {}, modifiers: [],
  };
}
function game(ownZones, rivalZones) {
  return {
    status: "playing", players: [player("You", ownZones), player("Rival", rivalZones)], activePlayer: 0,
    firstPlayer: 1, winner: null, turn: 3, phase: "performance", pendingChoice: null,
    effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}
const act = (state, action) => applyAction(state, 0, action, cards, () => 0.25);
const basicCheer = () => [instance("hY01-001"), instance("hY01-002")];

test("Q714 hBP09-008 checks each Arts damage event, not damage accumulated across attacks", () => {
  let state = game(
    {
      center: unit("hBP01-010", basicCheer()),
      collab: unit("hBP01-010", basicCheer()),
    },
    { center: unit("hBP09-008") },
  );

  state = act(state, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(state.players[1].zones.center.damage, 20);
  state = act(state, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" });
  assert.equal(state.players[1].zones.center.damage, 40, "the two separate attacks have accumulated 40 damage");
  assert.equal(state.players[0].zones.center.damage, 0, "neither 20-damage event independently reaches the Gift threshold");

  let qualifying = game(
    { center: unit("hBP01-013", basicCheer()) },
    { center: unit("hBP09-008") },
  );
  qualifying = act(qualifying, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(qualifying.players[1].zones.center.damage, 50);
  assert.equal(qualifying.players[0].zones.center.damage, 30, "a single qualifying Arts event still triggers 30 special damage");
});

test("Q715 hBP09-011 does not add separate Arts hits together to reach its 100-damage trigger", () => {
  let state = game(
    {
      center: unit("hBP01-013", basicCheer()),
      collab: unit("hBP01-013", basicCheer()),
    },
    { center: unit("hBP09-011") },
  );
  const defenderDeckBefore = state.players[1].mainDeck.length;

  state = act(state, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(state.players[1].zones.center.damage, 50);
  assert.equal(state.players[1].mainDeck.length, defenderDeckBefore, "one 50-damage Art does not meet the threshold");

  state.players[0].zones.center.rested = false;
  state = act(state, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" });
  assert.equal(state.players[1].zones.center.damage, 100, "the two separate Arts hits total 100 damage on the unit");
  assert.equal(state.players[1].mainDeck.length, defenderDeckBefore, "the Gift checks each single Art damage event, not cumulative damage");
});

test("Q716 hBP09-011 draws before hBP09-069 recalculates its seven-card Art reduction", () => {
  let state = game(
    { center: unit("hBP09-011", basicCheer()) },
    { center: unit("hBP09-069") },
  );
  state.players[0].hand = Array.from({ length: 6 }, () => instance("hBP09-051"));

  state = act(state, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });

  assert.equal(state.players[0].hand.length, 7, "Subaru's printed Art effect resolves before damage is settled");
  assert.equal(state.players[1].zones.center.damage, 0, "Vivi sees the resulting seven-card opposing hand and reduces 40 by 50");
  assert.ok(state.players[1].zones.center.rested === false, "receiving reduced damage does not change the target's rested state");
});
