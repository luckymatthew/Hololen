import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction, isActionCandidateLegal, publicRoomState } from "../lib/simulator/engine.mjs";
import { fixture, unit } from "./hbp09-fixtures.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const byNumber = new Map(cards.map(card => [card.number, card]));
let serial = 0;
const instance = number => ({ id: `vivi-oshi-${++serial}`, number, variantId: byNumber.get(number)?.id });
const withIds = (number, prefix, count) => Array.from({ length: count }, (_, index) => ({
  id: `${prefix}-${index + 1}`, number, variantId: byNumber.get(number)?.id,
}));

function viviGame() {
  const state = fixture();
  state.status = "playing";
  state.turn = 5;
  state.phase = "main";
  state.activePlayer = 0;
  state.pendingChoice = null;
  state.effectQueue = [];
  state.players[0].oshi = instance("hBP09-006");
  state.players[1].oshi = instance("hBP09-001");
  state.players[0].zones.center = unit("hBP09-070");
  state.players[0].holoPower = withIds("hBP09-051", "vivi-payment", 2);
  state.players[1].holoPower = [];
  return state;
}

test("hBP09-006 normal Oshi skill pays 2 Holo Power, draws 3 for its owner and 2 for the opponent", () => {
  const state = viviGame();
  state.players[0].mainDeck = withIds("hBP09-051", "vivi-own-deck", 5);
  state.players[1].mainDeck = withIds("hBP09-064", "vivi-rival-deck", 4);
  const paymentIds = state.players[0].holoPower.map(card => card.id);

  const result = applyAction(state, 0, { type: "oshiSkill" }, cards, () => 0.25);

  assert.equal(result.players[0].hand.length, 3);
  assert.equal(result.players[1].hand.length, 2);
  assert.equal(result.players[0].mainDeck.length, 2);
  assert.equal(result.players[1].mainDeck.length, 2);
  assert.equal(result.players[0].holoPower.length, 0);
  assert.deepEqual(result.players[0].archive.map(card => card.id).sort(), paymentIds.sort(), "Archive is an unordered zone");
  assert.equal(result.players[0].oshiSkillTurn, state.turn);
});

test("hBP09-006 SP skill recycles both hands and only Holomem/Support from both Archives, including paid Holo Power", () => {
  const state = viviGame();
  const ownDeck = withIds("hBP09-051", "vivi-own-deck", 8);
  const rivalDeck = withIds("hBP09-064", "vivi-rival-deck", 8);
  const ownHand = [instance("hBP09-060"), instance("hBP09-092")];
  const rivalHand = [instance("hBP09-065"), instance("hBP09-091")];
  const ownArchive = [instance("hBP09-061"), instance("hBP09-098"), instance("hY01-001")];
  const rivalArchive = [instance("hBP09-068"), instance("hBP09-105"), instance("hY02-001")];
  const payment = [instance("hBP09-051"), instance("hBP09-092"), instance("hBP09-070")];
  state.players[0].mainDeck = ownDeck;
  state.players[1].mainDeck = rivalDeck;
  state.players[0].hand = ownHand;
  state.players[1].hand = rivalHand;
  state.players[0].archive = ownArchive;
  state.players[1].archive = rivalArchive;
  state.players[0].holoPower = payment;
  let shuffleRandomCalls = 0;

  const result = applyAction(state, 0, { type: "spOshiSkill" }, cards, () => {
    shuffleRandomCalls += 1;
    return 0.25;
  });

  assert.equal(result.players[0].spOshiSkillUsed, true);
  assert.equal(result.players[0].holoPower.length, 0);
  assert.equal(result.players[0].hand.length, 7);
  assert.equal(result.players[1].hand.length, 7);
  assert.equal(result.players[0].mainDeck.length, 8);
  assert.equal(result.players[1].mainDeck.length, 5);
  assert.deepEqual(result.players[0].archive.map(card => card.id), [ownArchive[2].id], "Cheer is not a Holomem or Support");
  assert.deepEqual(result.players[1].archive.map(card => card.id), [rivalArchive[2].id]);
  const ownEligibleIds = [...ownDeck, ...ownHand, ...ownArchive.slice(0, 2), ...payment].map(card => card.id).sort();
  const rivalEligibleIds = [...rivalDeck, ...rivalHand, ...rivalArchive.slice(0, 2)].map(card => card.id).sort();
  assert.deepEqual([...result.players[0].mainDeck, ...result.players[0].hand].map(card => card.id).sort(), ownEligibleIds);
  assert.deepEqual([...result.players[1].mainDeck, ...result.players[1].hand].map(card => card.id).sort(), rivalEligibleIds);
  assert.ok(shuffleRandomCalls >= 20, "both rebuilt decks are shuffled before either player draws");

  const rivalView = publicRoomState(result, 1);
  assert.deepEqual(rivalView.players[0].hand, Array(7).fill(null));
  for (const hiddenCard of result.players[0].hand) assert.ok(!JSON.stringify(rivalView).includes(hiddenCard.id));
});

test("hBP09-006 SP still gives each player all available cards when rebuilt decks contain fewer than 7", () => {
  const state = viviGame();
  state.players[0].mainDeck = [];
  state.players[1].mainDeck = withIds("hBP09-064", "vivi-rival-short-deck", 1);
  state.players[0].hand = [instance("hBP09-060")];
  state.players[1].hand = [];
  state.players[0].archive = [instance("hBP09-061"), instance("hY01-001")];
  state.players[1].archive = [];
  state.players[0].holoPower = withIds("hBP09-051", "vivi-short-payment", 3);

  const result = applyAction(state, 0, { type: "spOshiSkill" }, cards, () => 0.25);

  assert.equal(result.players[0].hand.length, 5, "two hand/archive cards plus three paid Holo Power are available");
  assert.equal(result.players[1].hand.length, 1, "the other player still draws their available card");
  assert.equal(result.status, "playing", "an effect draw does not trigger the turn-start deck-out loss condition");
});

test("hBP09-006 SP activation requires a Center 2nd Vivi and is limited to once per game", () => {
  const action = { type: "spOshiSkill" };
  const firstVivi = cards.find(card => card.group === "holomem" && card.jpName === "綺々羅々ヴィヴィ" && card.stage !== "2nd");
  assert.ok(firstVivi);
  const wrongCenter = viviGame();
  wrongCenter.players[0].holoPower = withIds("hBP09-051", "vivi-wrong-center-power", 3);
  wrongCenter.players[0].zones.center = unit(firstVivi.number);
  const map = new Map(cards.map(card => [card.number, card]));
  assert.equal(isActionCandidateLegal(wrongCenter, 0, action, map), false);
  assert.throws(() => applyAction(wrongCenter, 0, action, cards, () => 0.25), /2nd Vivi/u);

  const legal = viviGame();
  legal.players[0].holoPower = withIds("hBP09-051", "vivi-used-sp-power", 3);
  const used = applyAction(legal, 0, action, cards, () => 0.25);
  assert.equal(isActionCandidateLegal(used, 0, action, map), false);
  assert.throws(() => applyAction(used, 0, action, cards, () => 0.25));
});
