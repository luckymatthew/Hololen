import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = number => ({ number, id: `q738-${++sequence}` });
const unit = number => ({ stack: [instance(number)], cheer: [], attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], skipUnrestTurn: 0 });
function player(name, oshi) {
  return {
    name, ready: true, setupDone: true, oshi: instance(oshi), mainDeck: Array.from({ length: 20 }, () => instance("hBP09-051")),
    cheerDeck: [], hand: [], life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: { center: unit("hBP09-064"), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0, limitedAllowanceTurn: 0, limitedAllowance: 1,
    turnsTaken: 2, mulliganUsed: false, forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 }, namedUsageTurns: {}, modifiers: [],
  };
}
function state() {
  const own = player("You", "hBP09-001"), rival = player("Rival", "hBP09-001");
  own.hand.push(instance("hBP09-094"));
  rival.zones.back1 = unit("hBP09-064");
  return { status: "playing", players: [own, rival], activePlayer: 0, firstPlayer: 1, winner: null, turn: 3, phase: "main", pendingChoice: null, effectQueue: [], knockouts: [{ ownerIndex: 0, turn: 2, sourcePlayerIndex: 1 }], lifeLosses: [], log: [] };
}
function choose(current, playerIndex, choice) {
  return applyAction(current, playerIndex, { type: "choose", ...choice }, cards, () => 0.25);
}

test("hBP09-094 target remains rested after center replacement on the next reset step (official Q738)", () => {
  let current = state();
  current = applyAction(current, 0, { type: "play", cardId: current.players[0].hand[0].id }, cards, () => 0.25);
  assert.equal(current.pendingChoice.type, "stageTarget");
  current = choose(current, 0, { zone: "back1" });
  assert.equal(current.players[1].zones.back1.rested, true);
  assert.equal(current.players[1].zones.back1.skipUnrestTurn, 4);

  // Model the intervening center knockout, then advance through the real turn/reset reducer.
  current.players[1].zones.center = null;
  current = applyAction(current, 0, { type: "advance" }, cards, () => 0.25);
  current = applyAction(current, 0, { type: "advance" }, cards, () => 0.25);
  assert.equal(current.activePlayer, 1);
  assert.equal(current.pendingChoice.type, "centerReplacement");
  current = choose(current, 1, { zone: "back1" });
  assert.equal(current.players[1].zones.center.rested, true);
});

test("hBP09-094 externally rests Raora despite her reset-step active exemption (official Q739)", () => {
  let current = state();
  const raora = cards.find(card => card.group === "holomem" && card.jpName === "ラオーラ・パンテーラ" && card.stage === "1st");
  assert.ok(raora, "the production catalog needs a Raora 1st Holomem printing");
  current.players[0].zones.back1 = unit("hBP09-064");
  current.players[1].oshi = instance("hBP06-001");
  current.players[1].zones.back1 = unit(raora.number);
  current.players[1].holoPower.push(instance("hBP09-051"));
  current.activePlayer = 1;
  current.turn = 2;
  current.players[1].turnEvents.turn = 2;
  current = applyAction(current, 1, { type: "spOshiSkill" }, cards, () => 0.25);
  assert.ok(current.players[1].modifiers.some(modifier => modifier.kind === "raoraReset"));

  current.activePlayer = 0;
  current.turn = 3;
  current.phase = "main";
  current.knockouts = [{ ownerIndex: 0, turn: 2, sourcePlayerIndex: 1 }];
  current.players[0].turnEvents.turn = 3;
  current = applyAction(current, 0, { type: "play", cardId: current.players[0].hand[0].id }, cards, () => 0.25);
  current = choose(current, 0, { zone: "back1" });
  assert.equal(current.players[1].zones.back1.rested, true);
  assert.ok(current.players[1].modifiers.some(modifier => modifier.kind === "raoraReset"));
});

test("hBP09-094 eligibility uses the previous opponent-turn Down event without requiring an opposing effect source", () => {
  let current = state();
  current.knockouts = [{ ownerIndex: 0, turn: 2, sourcePlayerIndex: 0, sourceName: "opponent-turn triggered effect" }];
  current = applyAction(current, 0, { type: "play", cardId: current.players[0].hand[0].id }, cards, () => 0.25);
  assert.equal(current.pendingChoice?.type, "stageTarget");
  assert.ok(current.pendingChoice.options.includes("back1"));
});
