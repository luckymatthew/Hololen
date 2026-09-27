import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const instance = (id, number) => ({ id, number });
const powerCards = (prefix, count) => Array.from({ length: count }, (_, index) => instance(`${prefix}-${index + 1}`, "hBP01-104"));
const zones = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });

function stageUnit(id, number, overrides = {}) {
  return {
    stack: [instance(id, number)], cheer: [], attachments: [], damage: 0, rested: false,
    enteredTurn: 0, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null, modifiers: [], ...overrides,
  };
}

function player(name, oshiNumber, overrides = {}) {
  return {
    name, ready: true, setupDone: true, oshi: instance(`${name}-oshi`, oshiNumber),
    mainDeck: [], cheerDeck: [], hand: [], life: [instance(`${name}-life`, "hY01-001")],
    holoPower: [], archive: [], removed: [], zones: zones(), collabTurn: 0, batonTurn: 0,
    limitedTurn: 0, turnsTaken: 2, mulliganUsed: false, forcedRedraws: 0,
    oshiSkillTurn: 0, spOshiSkillUsed: false, namedUsageTurns: {}, modifiers: [], ...overrides,
  };
}

function playingState(host, guest) {
  return {
    status: "playing", players: [host, guest], activePlayer: 0, firstPlayer: 0, winner: null,
    turn: 3, phase: "main", pendingChoice: null, effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}

function kanadeTurn(powerCount) {
  const host = player("Kanade", "hBP08-007", { holoPower: powerCards("kanade-power", powerCount) });
  host.zones.center = stageUnit("kanade-center", "hBP03-080", { cheer: [instance("kanade-arts-cheer", "hY01-001")] });
  host.zones.back1 = stageUnit("regloss-back", "hBP03-046");
  const guest = player("Opponent", "hBP08-006");
  guest.zones.center = stageUnit("opponent-center", "hBP07-030");

  let state = applyAction(playingState(host, guest), 0, { type: "advance" }, cards);
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[0].zones.center.lastArtsTurn, state.turn);
  return applyAction(state, 0, { type: "advance" }, cards);
}

test("hBP08-007 normal Oshi is offered only after Center Kanade's Arts and pays two Holo Power when used", () => {
  let state = kanadeTurn(2);
  assert.equal(state.pendingChoice.effect, "oshiKanadeSwap");
  assert.equal(state.pendingChoice.optional, true);
  assert.deepEqual(state.pendingChoice.options, ["back1"]);
  assert.equal(state.players[0].holoPower.length, 2, "choosing whether to activate must happen before payment");

  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.deepEqual(state.players[0].archive.map((card) => card.id).sort(), ["kanade-power-1", "kanade-power-2"].sort());
  assert.equal(state.players[0].oshiSkillTurn, 3);
  assert.equal(state.players[0].zones.center.stack.at(-1).id, "regloss-back");
  assert.equal(state.players[0].zones.back1.stack.at(-1).id, "kanade-center");
});

test("hBP08-007 does not offer its normal Oshi skill after Arts when two Holo Power are unavailable", () => {
  const state = kanadeTurn(1);
  assert.equal(state.pendingChoice, null);
  assert.equal(state.players[0].holoPower.length, 1);
  assert.equal(state.activePlayer, 1);
});

test("hBP08-007 normal Oshi can be declined without paying Holo Power", () => {
  const state = kanadeTurn(2);
  const afterSkip = applyAction(state, 0, { type: "choose", skip: true }, cards);
  assert.equal(afterSkip.players[0].holoPower.length, 2);
  assert.equal(afterSkip.players[0].archive.length, 0);
  assert.equal(afterSkip.players[0].oshiSkillTurn, 0);
  assert.equal(afterSkip.activePlayer, 1);
});

test("hBP08-007 SP attaches the top three Cheer to Center Kanade, then archives three stage Cheer at turn end", () => {
  const host = player("Kanade", "hBP08-007", {
    holoPower: powerCards("kanade-sp-power", 1),
    cheerDeck: [instance("top-one", "hY01-001"), instance("top-two", "hY01-001"), instance("top-three", "hY01-001")],
  });
  host.zones.center = stageUnit("kanade-center", "hBP03-080", { cheer: [instance("existing-center", "hY05-001")] });
  host.zones.back1 = stageUnit("regloss-one", "hBP03-046", { cheer: [instance("existing-back-one", "hY01-001")] });
  host.zones.back2 = stageUnit("regloss-two", "hBP03-048", { cheer: [instance("existing-back-two", "hY01-001")] });
  const guest = player("Opponent", "hBP08-006");

  let state = applyAction(playingState(host, guest), 0, { type: "spOshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.equal(state.players[0].spOshiSkillUsed, true);
  assert.deepEqual(state.players[0].zones.center.cheer.map((card) => card.id), ["existing-center", "top-one", "top-two", "top-three"]);
  assert.deepEqual(state.players[0].cheerDeck, []);

  state = applyAction(state, 0, { type: "advance" }, cards);
  state = applyAction(state, 0, { type: "advance" }, cards);
  assert.equal(state.pendingChoice.effect, "endKanadeArchive");
  for (let index = 0; index < 3; index += 1) {
    assert.equal(state.pendingChoice.meta.remaining, 3 - index);
    const cheerId = state.pendingChoice.cheerOptions[0].id;
    state = applyAction(state, 0, { type: "choose", cheerId }, cards);
  }
  const cheerArchives = state.players[0].archive.filter((card) => cards.find((definition) => definition.number === card.number)?.group === "cheer");
  assert.equal(cheerArchives.length, 3);
  assert.equal(state.players[0].zones.center.cheer.length + state.players[0].zones.back1.cheer.length + state.players[0].zones.back2.cheer.length, 3);
  assert.equal(state.activePlayer, 1);
});
