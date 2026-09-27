import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction, isActionCandidateLegal } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = number => ({ id: `hbp09-towa-${++sequence}`, number });
const unit = (number, cheer = []) => ({
  stack: [instance(number)], cheer, attachments: [], damage: 0, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
function state(centerCheers = ["hY04-001", "hY01-001"]) {
  const own = {
    name: "You", ready: true, setupDone: true, oshi: instance("hBP09-005"),
    mainDeck: Array.from({ length: 20 }, () => instance("hBP09-051")), cheerDeck: [], hand: [],
    life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: {
      center: unit("hBP09-051", centerCheers.map(instance)),
      collab: unit("hBP01-013", [instance("hY01-001"), instance("hY02-001")]),
      back1: null, back2: null, back3: null, back4: null, back5: null,
    },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1, turnsTaken: 2, mulliganUsed: false,
    forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    namedUsageTurns: {}, modifiers: [],
  };
  const rival = {
    ...structuredClone(own), name: "Rival", oshi: instance("hBP09-001"),
    zones: { center: unit("hBP09-064"), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
  };
  return {
    status: "playing", players: [own, rival], activePlayer: 0, firstPlayer: 1,
    winner: null, turn: 3, phase: "performance", pendingChoice: null,
    effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}
const act = (current, action, random = () => 0.25) => applyAction(current, 0, action, cards, random);

test("Q711 Towa must finish her center Holomem's different-Arts repeat before a Collab attack", () => {
  let current = state();
  current = act(current, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.deepEqual(current.players[0].zones.center.hbp09DifferentArt, {
    turn: current.turn, awaiting: true, name: "愛され系小悪魔",
  });

  const otherHolomemArts = { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" };
  assert.equal(isActionCandidateLegal(current, 0, otherHolomemArts, cards), false,
    "official Q711 forbids another Holomem from attacking before Towa uses her different Art");
  const before = structuredClone(current);
  assert.throws(() => act(current, otherHolomemArts), /Towa|異なる|Arts|アーツ|先/u);
  assert.deepEqual(current, before, "rejecting the out-of-order attack must preserve the pending Towa repeat");
});

test("Q710 Towa's different Art still needs its printed Cheer payment", () => {
  let current = state(["hY04-001"]);
  current = act(current, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(current.players[0].zones.center.hbp09DifferentArt.awaiting, true);
  const secondTowaArt = { type: "attack", sourceZone: "center", artIndex: 1, targetZone: "center" };
  assert.equal(isActionCandidateLegal(current, 0, secondTowaArt, cards), false,
    "the blue Cheer paid for the first Art does not waive the blue-plus-colorless cost of the different Art");
  assert.throws(() => act(current, secondTowaArt), /應援不足/u);
});

test("Q709 the Center Towa can use one differently named Art after her first Art", () => {
  let current = state(["hY04-001", "hY01-001"]);
  current = act(current, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  const differentNamedArt = { type: "attack", sourceZone: "center", artIndex: 1, targetZone: "center" };
  assert.equal(isActionCandidateLegal(current, 0, differentNamedArt, cards), true,
    "Q709 defines the skill as permission for an additional differently named Art");
  current = act(current, differentNamedArt);
  assert.equal(current.players[0].turnEvents.arts.length, 2);
  assert.equal(current.players[0].zones.center.hbp09DifferentArt?.awaiting, false);
});

test("Q53 hBP01-023 must repeat its same Arts before another Holomem can attack", () => {
  let current = state();
  current.players[0].oshi = instance("hBP09-001");
  current.players[0].zones.center = unit("hBP01-023", ["hY01-001", "hY01-001", "hY02-001"].map(instance));
  current.players[1].zones.collab = unit("hBP09-064");
  current = act(current, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, () => 0);
  assert.equal(current.players[0].zones.center.modifiers.find(modifier => modifier.kind === "repeatArts")?.uses, 1,
    "an odd die result creates the required same-Arts continuation");

  const collabAttack = { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" };
  assert.equal(isActionCandidateLegal(current, 0, collabAttack, cards), false,
    "official Q53 does not permit another Holomem's Arts before the repeated Arts");
  const before = structuredClone(current);
  assert.throws(() => act(current, collabAttack), /repeat|繰り返|Arts|アーツ/u);
  assert.deepEqual(current, before, "the failed command must preserve the pending repeated Arts");
  const differentTarget = { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "collab" };
  assert.equal(isActionCandidateLegal(current, 0, differentTarget, cards), false,
    "the repeat belongs to the same Holomem named by the official card text, not a different target");
  assert.throws(() => act(current, differentTarget), /same Holomem|同一/u);
  assert.equal(isActionCandidateLegal(current, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards), true,
    "the original Holomem's same Arts remains the legal continuation");
});
