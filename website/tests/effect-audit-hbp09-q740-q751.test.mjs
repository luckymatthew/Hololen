import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = number => ({ id: `hbp09-q740-${++sequence}`, number });
const unit = (number, cheer = [], damage = 0) => ({
  stack: [instance(number)], cheer, attachments: [], damage, rested: false,
  enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
function player(name, oshi = "hBP09-001") {
  return {
    name, ready: true, setupDone: true, oshi: instance(oshi),
    mainDeck: Array.from({ length: 20 }, () => instance("hBP09-051")), cheerDeck: [], hand: [],
    life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: { center: unit("hBP09-064"), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1, turnsTaken: 2, mulliganUsed: false,
    forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    namedUsageTurns: {}, modifiers: [],
  };
}
function game(oshi = "hBP09-001") {
  return {
    status: "playing", players: [player("You", oshi), player("Rival")], activePlayer: 0,
    firstPlayer: 1, winner: null, turn: 3, phase: "main", pendingChoice: null,
    effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}
const act = (state, action, random = () => 0.25) => applyAction(state, 0, action, cards, random);
const play = (state, number) => {
  const card = instance(number);
  state.players[0].hand.push(card);
  return act(state, { type: "play", cardId: card.id });
};

test("Q740 hBP09-095 does not count the Support currently resolving in its Archive threshold", () => {
  let state = game("hBP09-007");
  state.players[0].archive.push(instance("hBP09-095"));
  state.players[1].zones.center = unit("hBP09-064");
  state = play(state, "hBP09-095");
  assert.equal(state.pendingChoice.type, "stageTarget");
  state = act(state, { type: "choose", zone: "center" });
  assert.equal(state.players[1].zones.center.damage, 10);
  assert.equal(state.players[0].archive.filter(card => card.number === "hBP09-095").length, 2);
});

test("Q741-Q743 hBP09-097 may return and reattach the same Cheer when it is the only one", () => {
  let state = game();
  const cheer = instance("hY01-001");
  state.players[0].zones.center.cheer = [cheer];
  state.players[0].cheerDeck = [];
  state = play(state, "hBP09-097");
  assert.equal(state.pendingChoice.type, "cardSelection");
  assert.deepEqual(state.pendingChoice.selectableIds, [cheer.id]);
  state = act(state, { type: "choose", cardIds: [cheer.id] });
  assert.equal(state.players[0].cheerDeck.length, 1, "returned Cheer is available before the required shuffle");
  assert.equal(state.pendingChoice.type, "cardSelection");
  assert.deepEqual(state.pendingChoice.selectableIds, [cheer.id]);
  state = act(state, { type: "choose", cardIds: [cheer.id] });
  assert.equal(state.pendingChoice.type, "stageTarget");
  assert.deepEqual(state.pendingChoice.options, ["center"], "the single Holomem is a legal same-source destination");
  state = act(state, { type: "choose", zone: "center" });
  assert.deepEqual(state.players[0].zones.center.cheer.map(card => card.id), [cheer.id]);
  assert.equal(state.players[0].cheerDeck.length, 0);
});

test("Q744 hBP09-098 does not count itself as an archived LIMITED Support", () => {
  let state = game();
  const drawn = state.players[0].mainDeck.slice(0, 4).map(card => card.id);
  state.players[0].mainDeck = state.players[0].mainDeck.slice(0, 4);
  state = play(state, "hBP09-098");
  assert.equal(state.pendingChoice, null, "the current LIMITED card is not yet in the Archive during its check");
  assert.deepEqual(state.players[0].hand.map(card => card.id), drawn);
  assert.ok(state.players[0].archive.some(card => card.number === "hBP09-098"));
});

test("Q745 hBP09-101 counts Arts from other Holomem toward Towa's third-Arts back target", () => {
  let state = game("hBP09-005");
  state.players[0].zones.center = unit("hBP09-056", [instance("hY01-002")]);
  state.players[0].turnEvents.arts = ["hBP03-056", "hBP03-056"];
  state.players[1].zones.center = unit("hBP09-064");
  const vivi = cards.find(card => card.group === "holomem" && card.jpName === "綺々羅々ヴィヴィ" && card.stage === "1st");
  assert.ok(vivi);
  state.players[1].zones.back1 = unit(vivi.number);
  state = play(state, "hBP09-101");
  assert.equal(state.players[1].zones.center.damage, 20);
  assert.equal(state.players[0].hbp09TowaBackTurn, state.turn);
  state = act(state, { type: "advance" });
  assert.equal(state.phase, "performance");
  state = act(state, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "back1" });
  assert.ok(state.players[1].zones.back1.damage > 0, "Towa's third Arts can target the non-Debut back Holomem");
});

test("Q749-Q750 hBP09-104 snapshots all tied highest-HP Holomem and keeps both buffs through Bloom", () => {
  let state = game();
  state.players[0].zones.center = unit("hBP09-029");
  state.players[0].zones.back1 = unit("hBP09-029");
  state.players[0].zones.back2 = unit("hBP09-064");
  state = play(state, "hBP09-104");
  for (const zone of ["center", "back1"]) assert.ok(state.players[0].zones[zone].modifiers.some(modifier => modifier.kind === "arts" && modifier.amount === 30));
  assert.equal(state.players[0].zones.back2.modifiers.some(modifier => modifier.amount === 30), false);

  const bloom = instance("hBP09-031");
  state.players[0].hand.push(bloom);
  state = act(state, { type: "play", cardId: bloom.id });
  assert.equal(state.pendingChoice.type, "bloom");
  assert.ok(state.pendingChoice.options.includes("back1"));
  state = act(state, { type: "choose", zone: "back1" });
  assert.equal(state.players[0].zones.back1.stack.at(-1).number, "hBP09-031");
  for (const zone of ["center", "back1"]) assert.ok(state.players[0].zones[zone].modifiers.some(modifier => modifier.kind === "arts" && modifier.amount === 30));
});

test("Q751 a stated shuffle still executes when hBP09-090 finds no eligible Holomem", () => {
  let state = game();
  state.players[0].holoPower = [instance("hBP09-051")];
  state.players[0].mainDeck = ["hBP09-064", "hBP09-056", "hBP09-065"].map(instance);
  const before = state.players[0].mainDeck.map(card => card.id);
  state.players[0].hand.push(instance("hBP09-090"));
  let randomCalls = 0;
  state = act(state, { type: "play", cardId: state.players[0].hand.at(-1).id }, () => { randomCalls++; return 0.25; });
  assert.equal(state.players[0].mainDeck.length, before.length);
  assert.notDeepEqual(state.players[0].mainDeck.map(card => card.id), before, "mandatory shuffle changes this deterministic three-card deck");
  assert.ok(randomCalls > 0, "the unproductive search still consumes shuffle randomness");
  assert.equal(state.players[0].mainDeck.every(card => card.number !== "hBP09-001"), true);
});
