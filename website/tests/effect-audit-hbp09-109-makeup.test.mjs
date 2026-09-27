import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { fixture, instance, unit, cards } from "./hbp09-fixtures.mjs";

let sequence = 0;
const card = number => cards.find(value => value.number === number);
const identified = (number, label) => ({ ...instance(number), id: `makeup-${label}-${++sequence}` });
const act = (state, action) => applyAction(state, 0, action, cards, () => 0.5);

function makeupState({ center = "hBP09-070", target = "hBP09-068", hand = "hBP09-069", targetBloomedTurn = 5, targetEnteredTurn = 2 } = {}) {
  const state = fixture();
  state.turn = 5;
  state.phase = "performance";
  state.activePlayer = 0;
  state.pendingChoice = null;
  state.effectQueue = [];
  state.players[1].cheerDeck = [];
  state.players[0].zones.center = unit(center);
  state.players[0].zones.center.attachments = [identified("hBP09-109", "tool")];
  const bloomed = unit(target);
  bloomed.stack = [identified("hBP09-064", "debut-under"), identified(target, "bloomed-top")];
  bloomed.enteredTurn = targetEnteredTurn;
  bloomed.bloomedTurn = targetBloomedTurn;
  bloomed.damage = 30;
  bloomed.rested = true;
  state.players[0].zones.back1 = bloomed;
  state.players[0].hand = [identified(hand, "hand")];
  return state;
}

function answer(state, action) {
  assert.ok(state.pendingChoice, "the preceding effect should request a choice");
  return act(state, { type: "choose", ...action });
}

test("hBP09-109 grants its attached Vivi +20 Arts damage", () => {
  const state = fixture();
  state.turn = 5; state.phase = "performance"; state.activePlayer = 0;
  state.players[0].zones.center = unit("hBP09-068");
  state.players[0].zones.center.cheer = [identified("hY05-012", "arts-cost")];
  state.players[0].zones.center.attachments = [identified("hBP09-109", "arts-tool")];
  const result = act(state, { type: "attack", sourceZone: "center", targetZone: "center", artIndex: 0 });
  assert.equal(result.players[1].zones.center.damage, 60, "the printed 40 damage includes the attached tool's +20");
});

test("hBP09-109 activates at Performance end and permits one extra Bloom of a this-turn FLOW GLOW Bloom", () => {
  const state = makeupState();
  const performanceTurn = state.turn;
  const originalUnitId = state.players[0].zones.back1.stack[0].id;
  const handId = state.players[0].hand[0].id;
  let result = act(state, { type: "advance" });

  assert.equal(result.pendingChoice?.type, "stageTarget");
  assert.deepEqual(result.pendingChoice.options, ["back1"]);
  result = answer(result, { zone: "back1" });
  assert.equal(result.pendingChoice?.type, "cardSelection");
  assert.deepEqual(result.pendingChoice.selectableIds, [handId]);
  result = answer(result, { cardIds: [handId] });

  const bloomed = result.players[0].zones.back1;
  assert.equal(bloomed.stack.at(-1).number, "hBP09-069");
  assert.equal(bloomed.stack[0].id, originalUnitId);
  assert.equal(bloomed.stack.length, 3);
  assert.equal(bloomed.damage, 30, "Bloom preserves damage under comprehensive rule 5.14.2");
  assert.equal(bloomed.rested, true);
  assert.equal(bloomed.bloomedTurn, performanceTurn);
  assert.equal(result.players[0].hand.some(value => value.id === handId), false);
});

test("hBP09-109 does not offer a repeat Bloom when no legal this-turn FLOW GLOW target exists", () => {
  const notFlowGlow = card("hBP09-031");
  assert.ok(notFlowGlow);
  const state = makeupState({ target: notFlowGlow.number });
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice, null);
  assert.notEqual(result.phase, "performance");
  assert.equal(state.players[0].hand.length, 1);
});

test("hBP09-109 ignores a FLOW GLOW Holomem that did not Bloom this turn", () => {
  const state = makeupState({ targetBloomedTurn: 4 });
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice, null);
  assert.notEqual(result.phase, "performance");
});

test("hBP09-109 does not allow a newly entered stage Holomem to Bloom during its entry turn", () => {
  const state = makeupState({ targetEnteredTurn: 5 });
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice, null);
  assert.notEqual(result.phase, "performance");
});

test("hBP09-109's optional extra Bloom can be declined without spending a hand card", () => {
  const state = makeupState();
  const originalStack = state.players[0].zones.back1.stack.map(value => value.id);
  const originalHand = state.players[0].hand.map(value => value.id);
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice?.type, "stageTarget");
  assert.equal(result.pendingChoice.optional, true, "the Japanese text says the target may Bloom again");
  const declined = answer(result, { skip: true });
  assert.deepEqual(declined.players[0].zones.back1.stack.map(value => value.id), originalStack);
  assert.deepEqual(declined.players[0].hand.map(value => value.id), originalHand);
  assert.notEqual(declined.phase, "performance", "declining resolves the end-of-performance trigger");
});

test("hBP09-109 cannot give the same unit a second extra Bloom after Bloom Stage already used rule 5.28", () => {
  const state = makeupState({ hand: "hBP09-069" });
  state.phase = "main";
  state.players[0].life = state.players[0].life.slice(0, 4);
  state.players[0].hand.push(identified("hBP06-090", "bloom-stage"));
  state.players[0].hand.push(identified("hBP09-070", "second-makeup-candidate"));

  let result = act(state, { type: "play", cardId: state.players[0].hand[1].id });
  assert.equal(result.pendingChoice?.effect, "bonusBloomCard");
  const bloomCard = result.pendingChoice.selectableIds.find(id => result.players[0].hand.find(value => value.id === id)?.number === "hBP09-069");
  assert.ok(bloomCard, "the real support can choose the valid 2nd Vivi card for the already-bloomed FLOW GLOW unit");
  result = answer(result, { cardIds: [bloomCard] });
  assert.equal(result.pendingChoice?.type, "bonusBloomTarget");
  result = act(result, { type: "choose", zone: "back1" });
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, "hBP09-069");
  assert.equal(result.players[0].zones.back1.bloomedTurn, result.turn);
  assert.equal(result.players[0].bonusBloomUsedTurn, result.turn, "Bloom Stage has now consumed its own once-per-turn effect");
  assert.equal(result.players[0].zones.back1.extraBloomUsedTurn, result.turn, "the same unit records its rule 5.28 extra Bloom");

  result = act(result, { type: "advance" });
  assert.equal(result.phase, "performance");
  result = act(result, { type: "advance" });
  assert.equal(result.pendingChoice, null, "rule 5.28 allows an already-bloomed unit to bypass the rule only once this turn");
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, "hBP09-069");
  assert.ok(result.players[0].hand.some(value => value.number === "hBP09-070"), "no second Bloom card should be spent");
});

test("hBP09-109 can still use its extra Bloom on a different unit after another unit's one use", () => {
  const state = makeupState();
  const performanceTurn = state.turn;
  const other = unit("hBP09-068");
  other.stack = [identified("hBP09-064", "other-debut"), identified("hBP09-068", "other-first")];
  other.enteredTurn = 2;
  other.bloomedTurn = state.turn;
  state.players[0].zones.back2 = other;
  state.phase = "main";
  state.players[0].life = state.players[0].life.slice(0, 4);
  const bloomStage = identified("hBP06-090", "other-bloom-stage");
  const makeupCard = identified("hBP09-070", "other-makeup-card");
  state.players[0].hand.push(bloomStage, makeupCard);

  let result = act(state, { type: "play", cardId: bloomStage.id });
  const firstExtra = result.pendingChoice.selectableIds.find(id => result.players[0].hand.find(value => value.id === id)?.number === "hBP09-069");
  assert.ok(firstExtra);
  result = answer(result, { cardIds: [firstExtra] });
  result = act(result, { type: "choose", zone: "back1" });
  assert.equal(result.players[0].zones.back1.extraBloomUsedTurn, result.turn);
  assert.equal(result.players[0].zones.back2.extraBloomUsedTurn, 0);

  result = act(result, { type: "advance" });
  result = act(result, { type: "advance" });
  assert.equal(result.pendingChoice?.type, "stageTarget");
  assert.deepEqual(result.pendingChoice.options, ["back2"], "5.28 is per Holomem, not a per-player cap");
  result = answer(result, { zone: "back2" });
  assert.equal(result.pendingChoice?.type, "cardSelection");
  result = answer(result, { cardIds: [makeupCard.id] });
  assert.equal(result.players[0].zones.back2.stack.at(-1).id, makeupCard.id);
  assert.equal(result.players[0].zones.back2.extraBloomUsedTurn, performanceTurn);
  assert.ok(result.players[0].zones.back1.stack.some(value => value.number === "hBP09-069"));
});

test("hBP09-109 can decline the hand card after selecting a valid target", () => {
  const state = makeupState();
  const stack = state.players[0].zones.back1.stack.map(value => value.id);
  const hand = state.players[0].hand.map(value => value.id);
  let result = act(state, { type: "advance" });
  result = answer(result, { zone: "back1" });
  assert.equal(result.pendingChoice?.type, "cardSelection");
  assert.equal(result.pendingChoice.optional, true);
  result = answer(result, { skip: true });
  assert.deepEqual(result.players[0].zones.back1.stack.map(value => value.id), stack);
  assert.deepEqual(result.players[0].hand.map(value => value.id), hand);
  assert.notEqual(result.phase, "performance");
});

test("hBP09-109 still requires a normal Bloom-level progression from hand", () => {
  const state = makeupState({ hand: "hBP09-064" });
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice, null, "a same-name Debut cannot Bloom down onto an existing 1st");
  assert.equal(result.players[0].hand[0].number, "hBP09-064");
});

test("hBP09-109 cannot attach to a Holomem that already has another Tool", () => {
  const state = fixture();
  state.phase = "main"; state.activePlayer = 0; state.pendingChoice = null; state.effectQueue = [];
  state.players[0].zones = { center: unit("hBP09-070"), collab: null, back1: null, back2: null, back3: null, back4: null, back5: null };
  state.players[0].zones.center.attachments = [identified("hBP09-110", "existing-tool")];
  const makeup = identified("hBP09-109", "new-tool");
  state.players[0].hand = [makeup];
  assert.throws(() => act(state, { type: "play", cardId: makeup.id }), /沒有可附加/u);
  assert.deepEqual(state.players[0].hand.map(value => value.id), [makeup.id]);
  assert.deepEqual(state.players[0].zones.center.attachments.map(value => value.number), ["hBP09-110"]);
});

test("legacy mid-turn saves fail closed when a generic extra Bloom target cannot be reconstructed", () => {
  const state = makeupState();
  const legacyTurn = state.turn;
  state.phase = "main"; state.players[0].life = state.players[0].life.slice(0, 4);
  const bloomStage = identified("hBP06-090", "legacy-bloom-stage");
  const secondMakeup = identified("hBP09-070", "legacy-second-makeup");
  state.players[0].hand.push(bloomStage, secondMakeup);
  let result = act(state, { type: "play", cardId: bloomStage.id });
  const firstExtra = result.pendingChoice.selectableIds.find(id => result.players[0].hand.find(value => value.id === id)?.number === "hBP09-069");
  result = answer(result, { cardIds: [firstExtra] });
  result = act(result, { type: "choose", zone: "back1" });

  // Simulate a save made before extraBloomUsedTurn existed on stage units.
  for (const player of result.players) {
    for (const stageUnit of Object.values(player.zones)) if (stageUnit) delete stageUnit.extraBloomUsedTurn;
    delete player.extraBloomUsageUnknownTurn;
  }
  result = act(result, { type: "advance" });
  assert.equal(result.players[0].extraBloomUsageUnknownTurn, legacyTurn);
  result = act(result, { type: "advance" });
  assert.equal(result.pendingChoice, null, "unknown legacy attribution must not allow a possible second Bloom");
  assert.ok(result.players[0].hand.some(value => value.id === secondMakeup.id));
});

test("hBP09-109's extra ability also triggers when attached Vivi is 1st", () => {
  const state = makeupState({ center: "hBP09-068" });
  const performanceTurn = state.turn;
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice?.type, "stageTarget");
  assert.deepEqual(result.pendingChoice.options, ["back1"]);
  const target = answer(result, { zone: "back1" });
  const bloomed = answer(target, { cardIds: [target.pendingChoice.selectableIds[0]] });
  assert.equal(bloomed.players[0].zones.back1.bloomedTurn, performanceTurn);
  assert.equal(bloomed.players[0].zones.back1.stack.at(-1).number, "hBP09-069");
});

test("hBP09-109's extra ability is absent below 1st-stage Vivi", () => {
  const state = makeupState({ center: "hBP09-064" });
  const result = act(state, { type: "advance" });
  assert.equal(result.pendingChoice, null);
  assert.equal(result.players[0].zones.back1.stack.at(-1).number, "hBP09-068");
});
