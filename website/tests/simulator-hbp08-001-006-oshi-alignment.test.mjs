import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction, isActionCandidateLegal } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const instance = (id, number) => ({ id, number });
const powerCards = (prefix, count) => Array.from({ length: count }, (_, index) => instance(`${prefix}-${index + 1}`, "hBP01-104"));
const emptyZones = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });

function stageUnit(id, number, overrides = {}) {
  return {
    stack: [instance(id, number)],
    cheer: [],
    attachments: [],
    damage: 0,
    rested: false,
    enteredTurn: 0,
    bloomedTurn: 0,
    collabbedTurn: 0,
    returnSlot: null,
    modifiers: [],
    ...overrides,
  };
}

function player(name, oshiNumber, overrides = {}) {
  return {
    name,
    ready: true,
    setupDone: true,
    oshi: instance(`${name}-oshi`, oshiNumber),
    mainDeck: [],
    cheerDeck: [],
    hand: [],
    life: [instance(`${name}-life`, "hY01-001")],
    holoPower: [],
    archive: [],
    removed: [],
    zones: emptyZones(),
    collabTurn: 0,
    batonTurn: 0,
    limitedTurn: 0,
    turnsTaken: 2,
    mulliganUsed: false,
    forcedRedraws: 0,
    oshiSkillTurn: 0,
    spOshiSkillUsed: false,
    namedUsageTurns: {},
    modifiers: [],
    ...overrides,
  };
}

function playingState(host, guest, overrides = {}) {
  return {
    status: "playing",
    players: [host, guest],
    activePlayer: 0,
    firstPlayer: 0,
    winner: null,
    turn: 3,
    phase: "main",
    pendingChoice: null,
    effectQueue: [],
    knockouts: [],
    lifeLosses: [],
    log: [],
    ...overrides,
  };
}

function modifier(unit, kind, turn = 3) {
  return unit.modifiers.find((entry) => entry.kind === kind && entry.expiresTurn >= turn);
}

test("hBP08-001 normal Oshi grants +20 normally and replaces it with +50 for a purple Cheer", () => {
  for (const { cheerNumber, expectedDamage } of [
    { cheerNumber: "hY01-001", expectedDamage: 50 },
    { cheerNumber: "hY05-001", expectedDamage: 80 },
  ]) {
    const host = player("IRyS", "hBP08-001", {
      holoPower: powerCards("irys-power", 2),
      zones: { ...emptyZones(), center: stageUnit("irys-center", "hBP01-028", { cheer: [instance("arts-cheer", cheerNumber)] }) },
    });
    const guest = player("Opponent", "hBP08-006");
    guest.zones.center = stageUnit("opponent-center", "hBP07-030");

    let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
    assert.equal(state.players[0].holoPower.length, 0);
    assert.equal(state.pendingChoice.effect, "oshiIrysBuff");
    state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
    assert.equal(modifier(state.players[0].zones.center, "arts")?.amount, expectedDamage - 30);
    state = applyAction(state, 0, { type: "advance" }, cards);
    state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
    assert.equal(state.players[1].zones.center.damage, expectedDamage, cheerNumber);
  }
});

test("hBP08-001 SP counts Cheer and purple Cheer across own IRyS only, drawing before adding Holo Power", () => {
  const host = player("IRyS", "hBP08-001", {
    holoPower: powerCards("sp-cost", 2),
    mainDeck: ["draw-1", "draw-2", "draw-3", "power-1", "power-2"].map((id) => instance(id, "hBP01-104")),
  });
  host.zones.center = stageUnit("irys-one", "hBP08-008", { cheer: [instance("purple-one", "hY05-001"), instance("white-one", "hY01-001")] });
  host.zones.back1 = stageUnit("irys-two", "hBP08-011", { cheer: [instance("purple-two", "hY05-001")] });
  host.zones.back2 = stageUnit("not-irys", "hBP08-041", { cheer: [instance("ignored-cheer", "hY01-001")] });
  const guest = player("Opponent", "hBP08-006");

  const state = applyAction(playingState(host, guest), 0, { type: "spOshiSkill" }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["draw-1", "draw-2", "draw-3"]);
  assert.deepEqual(state.players[0].holoPower.map((card) => card.id), ["power-1", "power-2"]);
  assert.equal(state.players[0].archive.length, 2);
  assert.equal(state.players[0].spOshiSkillUsed, true);
});

test("hBP08-002 distributes its top Cheer only among rested Cecilia and readies recipients after the distribution", () => {
  const host = player("Cecilia", "hBP08-002", {
    holoPower: powerCards("cecilia-power", 2),
    cheerDeck: [instance("top-one", "hY01-001"), instance("top-two", "hY01-001"), instance("remaining", "hY01-001")],
  });
  host.zones.center = stageUnit("cecilia-center", "hBP08-021", { rested: true });
  host.zones.back1 = stageUnit("cecilia-back", "hBP08-022", { rested: true });
  host.zones.back2 = stageUnit("other-rested", "hBP08-008", { rested: true });
  const guest = player("Opponent", "hBP08-006");

  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.deepEqual(new Set(state.pendingChoice.options), new Set(["center", "back1"]));
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.rested, true, "the recipients remain rested until both Cheer cards are distributed");
  assert.equal(state.players[0].zones.back1.rested, true);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  assert.deepEqual(new Set(state.pendingChoice.options), new Set(["center", "back1"]));
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.center.rested, false);
  assert.equal(state.players[0].zones.back1.rested, false);
  assert.equal(state.players[0].zones.back2.rested, true, "a Cecilia that received no Cheer is not readied");
  assert.deepEqual(state.players[0].zones.center.cheer.map((card) => card.id), ["top-one"]);
  assert.deepEqual(state.players[0].zones.back1.cheer.map((card) => card.id), ["top-two"]);
  assert.deepEqual(state.players[0].cheerDeck.map((card) => card.id), ["remaining"]);
});

test("hBP08-004 normal Oshi increases the opposing Center's Baton cost by 3 through that opponent's next turn", () => {
  const host = player("Suu", "hBP08-004", { holoPower: powerCards("suu-power", 1) });
  const guest = player("Opponent", "hBP08-006");
  guest.zones.center = stageUnit("opponent-center", "hBP08-013", { cheer: powerCards("baton-cheer", 4) });
  guest.zones.back1 = stageUnit("replacement", "hBP08-008");

  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.deepEqual(modifier(state.players[1].zones.center, "batonCost"), {
    kind: "batonCost", amount: 3, expiresTurn: 4, sourceNumber: "hBP08-004",
  });
  state.activePlayer = 1;
  state.turn = 4;
  assert.equal(isActionCandidateLegal(state, 1, { type: "baton", zone: "back1" }, cards), false, "four Cheer cannot pay the base two plus the temporary three");
  state.turn = 5;
  assert.equal(isActionCandidateLegal(state, 1, { type: "baton", zone: "back1" }, cards), true, "the increase expires after the opponent's next turn");
  state = applyAction(state, 1, { type: "baton", zone: "back1" }, cards);
  assert.equal(state.players[1].archive.length, 2);
});

test("hBP08-004 SP deals special damage equal to the Center's current damage to one opposing Back Holomen", () => {
  const host = player("Suu", "hBP08-004", { holoPower: powerCards("suu-sp-power", 2) });
  const guest = player("Opponent", "hBP08-006");
  guest.zones.center = stageUnit("opponent-center", "hBP08-013", { damage: 80 });
  guest.zones.back1 = stageUnit("opponent-back", "hBP08-008");

  let state = applyAction(playingState(host, guest), 0, { type: "spOshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.equal(state.players[0].spOshiSkillUsed, true);
  assert.deepEqual(state.pendingChoice.options, ["back1"]);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.back1.damage, 80);
  assert.equal(state.players[1].zones.center.damage, 80);
});

test("hBP08-006 archives each selected Holo Power and grants all colors to one opposing Holomen per card this turn", () => {
  const host = player("Ina", "hBP08-006", {
    holoPower: powerCards("ina-power", 2),
    zones: { ...emptyZones(), center: stageUnit("ina-attacker", "hBP08-068", { cheer: [instance("ina-cheer", "hY05-001")] }) },
  });
  const guest = player("Opponent", "hBP08-006");
  guest.zones.center = stageUnit("opponent-center", "hBP08-041");
  guest.zones.collab = stageUnit("opponent-collab", "hBP08-030");

  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.pendingChoice.effect, "oshiInaPower");
  assert.equal(state.pendingChoice.min, 1);
  state = applyAction(state, 0, { type: "choose", cardIds: ["ina-power-1"] }, cards);
  assert.equal(state.players[0].holoPower.length, 1);
  assert.equal(state.players[0].archive.length, 1);
  assert.equal(state.pendingChoice.effect, "oshiAllColors");
  assert.deepEqual(new Set(state.pendingChoice.options), new Set(["center", "collab"]));
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.ok(modifier(state.players[1].zones.center, "allColors"));
  assert.equal(state.players[1].zones.collab.modifiers.some((entry) => entry.kind === "allColors"), false);

  state = applyAction(state, 0, { type: "advance" }, cards);
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 30, "the all-colors Center also has colors different from the opposing Oshi and receives the special damage");
  assert.equal(state.players[1].zones.collab.damage, 20, "the non-purple Collab still receives the printed special damage");
});
