import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = (number, id = `effect-audit-${++sequence}`) => ({ number, id });
const unit = (number, cheerIds = []) => ({
  stack: [instance(number)],
  cheer: cheerIds.map((id) => instance("hY01-001", id)),
  attachments: [], damage: 0, rested: false, enteredTurn: 0, bloomedTurn: 0,
  collabbedTurn: 0, returnSlot: null, modifiers: [],
});
const player = (name, zones) => ({
  name, ready: true, setupDone: true, oshi: instance("hBP09-001"),
  mainDeck: Array.from({ length: 30 }, (_, index) => instance("hBP09-051", `${name}-deck-${index}`)),
  cheerDeck: [], hand: [], life: Array.from({ length: 5 }, (_, index) => instance("hY01-001", `${name}-life-${index}`)),
  holoPower: [], archive: [], removed: [], zones,
  collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
  limitedAllowanceTurn: 0, limitedAllowance: 1, turnsTaken: 2,
  mulliganUsed: false, forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
  turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
  namedUsageTurns: {}, modifiers: [],
});
function state(ownZones) {
  const empty = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });
  const opponent = empty(); opponent.center = unit("hBP09-064");
  return {
    status: "playing", players: [player("You", ownZones), player("Opponent", opponent)],
    activePlayer: 0, firstPlayer: 1, winner: null, turn: 3, phase: "main",
    pendingChoice: null, effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}
function play093(current) {
  const support = instance("hBP09-093", "support-093");
  current.players[0].hand.push(support);
  return applyAction(current, 0, { type: "play", cardId: support.id }, cards, () => 0.25);
}
function choose(current, action) {
  assert.ok(current.pendingChoice, "the effect must request an explicit mandatory choice");
  return applyAction(current, current.pendingChoice.playerIndex, { type: "choose", ...action }, cards, () => 0.25);
}

test("hBP09-093 cannot be used with only one Holomem and one attached cheer (official Q735)", () => {
  const zones = { center: unit("hBP09-064", ["only-cheer"]), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  const before = state(zones);
  before.players[0].hand.push(instance("hBP09-093", "support-093"));
  const original = structuredClone(before);
  assert.throws(() => applyAction(before, 0, { type: "play", cardId: "support-093" }, cards, () => 0.25), /可轉移至另一位/iu);
  assert.deepEqual(before, original, "an illegal use cannot archive the Support or change state");
});

test("hBP09-093 reassigns from one of four Holomen to a different Holomem before its conditional bonus (official Q737)", () => {
  const zones = { center: unit("hBP09-064", ["center-cheer"]), collab: null,
    back1: unit("hBP09-064", ["back1-cheer"]), back2: unit("hBP09-064", ["back2-cheer"]),
    back3: unit("hBP09-064", ["back3-cheer"]), back4: null, back5: null };
  const current = state(zones);
  current.players[0].archive.push(instance("hY01-001", "archive-cheer"));
  let next = play093(current);
  assert.equal(next.pendingChoice.type, "cardSelection");
  assert.equal(next.pendingChoice.optional, false);
  next = choose(next, { cardIds: ["center-cheer"] });
  assert.equal(next.pendingChoice.type, "stageTarget");
  assert.equal(next.pendingChoice.optional, false);
  assert.ok(!next.pendingChoice.options.includes("center"), "the selected Cheer must move off its original Holomem");
  next = choose(next, { zone: "back1" });
  assert.deepEqual(next.players[0].zones.center.cheer.map((card) => card.id), []);
  assert.deepEqual(next.players[0].zones.back1.cheer.map((card) => card.id), ["back1-cheer", "center-cheer"]);
  assert.equal(next.pendingChoice, null, "after the mandatory move only three Holomen have cheer, so the four-Holomem bonus is unavailable");
});

test("hBP09-093 still requires reassignment with four Holomen, one Cheer and no archived Cheer (official Q736)", () => {
  const zones = { center: unit("hBP09-064", ["center-cheer"]), collab: null,
    back1: unit("hBP09-064"), back2: unit("hBP09-064"), back3: unit("hBP09-064"), back4: null, back5: null };
  const current = state(zones);
  let next = play093(current);
  assert.equal(next.pendingChoice.type, "cardSelection");
  assert.equal(next.pendingChoice.optional, false, "having no archived Cheer does not make the required reassignment optional");
  next = choose(next, { cardIds: ["center-cheer"] });
  assert.equal(next.pendingChoice.type, "stageTarget");
  assert.equal(next.pendingChoice.optional, false);
  assert.ok(!next.pendingChoice.options.includes("center"));
  next = choose(next, { zone: "back1" });
  assert.equal(next.pendingChoice, null, "the second clause is skipped after reassignment leaves fewer than four Cheer holders");
});
