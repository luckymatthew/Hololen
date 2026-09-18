import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction } from "../lib/simulator/engine.mjs";
import {
  OSHI_STAGE_SKILLS,
  CATALOG_ONLY_OSHI,
  enrichOshiCardMetadata,
  isActivatableOshiSkill,
  isReactiveOshiSkill,
  oshiSkillPowerCost,
} from "../lib/simulator/oshi-skill-catalog.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const engineSource = readFileSync(new URL("../lib/simulator/engine.mjs", import.meta.url), "utf8");
const emptyZones = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });
const instance = (id, number) => ({ id, number });
const stageUnit = (id, number, overrides = {}) => ({
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
});

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

function powerCards(prefix, count) {
  return Array.from({ length: count }, (_, index) => instance(`${prefix}-${index + 1}`, "hBP01-104"));
}

test("all 155 pre-hBP09 Oshi retain their exact cost and activation coverage", () => {
  // Retain every prior count and behavior assertion. New catalog-only Oshi are
  // verified independently below rather than silently claiming implementation.
  const oshiCards = cards.filter((card) => card.group === "oshi" && !card.number.startsWith("hBP09-"));
  assert.equal(oshiCards.length, 155);
  assert.equal(oshiCards.filter((card) => card.oshiSkill).length, 155);
  assert.equal(oshiCards.filter((card) => card.spOshiSkill).length, 145);
  assert.equal(oshiCards.filter((card) => card.stageSkill).length, 10);
  assert.equal(Object.keys(OSHI_STAGE_SKILLS).length, 10);

  const costPairs = {};
  for (const card of oshiCards) {
    const normalCost = oshiSkillPowerCost(card.number, "oshi");
    const spCost = card.spOshiSkill ? oshiSkillPowerCost(card.number, "sp") : "-";
    const pair = `${normalCost}/${spCost}`;
    costPairs[pair] = Number(costPairs[pair] || 0) + 1;
    assert.match(card.oshiSkill.timing, new RegExp(`Holo Power -${normalCost}`));
    if (card.spOshiSkill) assert.match(card.spOshiSkill.timing, new RegExp(`Holo Power -${spCost}`));
    assert.notEqual(isActivatableOshiSkill(card.number, "oshi"), isReactiveOshiSkill(card.number, "oshi"));
    if (card.spOshiSkill) assert.notEqual(isActivatableOshiSkill(card.number, "sp"), isReactiveOshiSkill(card.number, "sp"));
  }
  assert.deepEqual(costPairs, {
    "2/2": 98, "X/2": 1, "3/2": 6, "2/3": 3, "1/3": 7, "1/2": 7,
    "3/1": 1, "1/4": 1, "2/1": 18, "6/-": 1, "2/-": 6,
    "2/4": 1, "1/-": 1, "X/-": 1, "4/-": 1, "3/3": 2,
  });
  assert.equal(oshiCards.filter((card) => isActivatableOshiSkill(card.number, "oshi")).length, 139);
  assert.equal(oshiCards.filter((card) => isReactiveOshiSkill(card.number, "oshi")).length, 16);
  assert.equal(oshiCards.filter((card) => card.spOshiSkill && isActivatableOshiSkill(card.number, "sp")).length, 129);
  assert.equal(oshiCards.filter((card) => card.spOshiSkill && isReactiveOshiSkill(card.number, "sp")).length, 16);
});

test("all seven hBP09 Oshi preserve official costs and expose implemented activation windows", () => {
  const incoming = cards.filter((card) => card.group === "oshi" && card.number.startsWith("hBP09-"));
  assert.equal(incoming.length, 7);
  assert.equal(cards.filter((card) => card.group === "oshi").length, 162);
  assert.deepEqual(CATALOG_ONLY_OSHI, []);
  assert.deepEqual(incoming.map(c => c.number).sort(), Array.from({length: 7}, (_,i) => `hBP09-${String(i+1).padStart(3,'0')}`));
  for (const card of incoming) {
    const enriched = enrichOshiCardMetadata(card);
    assert.equal(enriched.number, card.number);
    assert.equal(enriched.oshiSkill.name, card.oshiSkill.name);
    assert.equal(enriched.oshiSkill.effect, card.oshiSkill.effect);
    assert.equal(oshiSkillPowerCost(card.number, 'oshi'), card.oshiSkill.holoPowerCost);
    assert.match(enriched.oshiSkill.timing, new RegExp(`Holo Power -${card.oshiSkill.holoPowerCost}`));
    assert.equal(isReactiveOshiSkill(card.number), card.number === 'hBP09-005');
    assert.equal(isActivatableOshiSkill(card.number), card.number !== 'hBP09-005');
    assert.equal(isActivatableOshiSkill(card.number, 'sp'), card.number === 'hBP09-006');
    if (card.spOshiSkill) assert.equal(oshiSkillPowerCost(card.number, 'sp'), card.spOshiSkill.holoPowerCost);
  }
  // Actual costs, state mutations and invalid actions are independently exercised
  // through applyAction in hbp09-executable.test.mjs, not inferred from this table.
});

test("every active non-Birthday Oshi skill has an engine resolver branch", () => {
  const normalStart = engineSource.indexOf("function hbp09Legacy_resolveNormalOshiSkill");
  const spStart = engineSource.indexOf("function hbp09Legacy_resolveSpOshiSkill");
  const activationStart = engineSource.indexOf("function hbp09Legacy_activateOshiSkill");
  const normalResolver = engineSource.slice(normalStart, spStart);
  const spResolver = engineSource.slice(spStart, activationStart);
  const oshiCards = cards.filter((card) => card.group === "oshi" && !card.number.startsWith("hBP09-"));
  const newPrograms = readFileSync(new URL("../lib/simulator/hbp09/programs.mjs", import.meta.url), "utf8");
  for (const key of ["001:oshi", "002:oshi", "003:oshi", "004:oshi", "006:oshi", "006:sp", "007:oshi"]) assert.ok(newPrograms.includes(key), `${key} executable program missing`);

  for (const card of oshiCards.filter((candidate) => !candidate.number.startsWith("hBD24-") && isActivatableOshiSkill(candidate.number, "oshi"))) {
    if (card.number === "hEB01-003") assert.match(normalResolver, /number === KOYORI_OSHI/u);
    else assert.ok(normalResolver.includes(`"${card.number}"`), `${card.number} normal Oshi resolver is missing`);
  }
  for (const card of oshiCards.filter((candidate) => candidate.spOshiSkill && !candidate.number.startsWith("hBD24-") && isActivatableOshiSkill(candidate.number, "sp"))) {
    assert.ok(spResolver.includes(`"${card.number}"`), `${card.number} SP Oshi resolver is missing`);
  }
});

test("hEB01-002 Marine Stage skill offers and resolves the second Bloom", () => {
  const host = player("Marine", "hEB01-002", { hand: [instance("marine-second", "hEB01-016")] });
  host.zones.center = stageUnit("marine-debut", "hEB01-011", {
    stack: [instance("marine-debut", "hEB01-011"), instance("marine-first", "hEB01-013")],
    bloomedTurn: 3,
  });
  host.zones.collab = stageUnit("collab", "hEB01-004");
  const guest = player("Guest", "hBP08-001", { mainDeck: powerCards("guest-draw", 2) });
  guest.zones.center = stageUnit("guest-center", "hBP07-030");

  let state = applyAction(playingState(host, guest), 0, { type: "advance" }, cards);
  assert.equal(state.phase, "performance");
  assert.equal(state.pendingChoice.effect, "oshiMarineStageBloomCard");
  state = applyAction(state, 0, { type: "choose", cardIds: ["marine-second"] }, cards);
  assert.equal(state.pendingChoice.effect, "oshiMarineStageBloom");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.stack.at(-1).id, "marine-second");
  assert.equal(state.players[0].zones.center.stack.length, 3);
  assert.equal(state.players[0].zones.center.bloomedTurn, 3);
});

test("hEB01-002 normal Oshi skill pays 2 and deals both 50-damage hits with a three-card Center stack", () => {
  const host = player("Marine", "hEB01-002", { holoPower: powerCards("marine-power", 2) });
  host.zones.center = stageUnit("marine-debut", "hEB01-011", {
    stack: [instance("marine-debut", "hEB01-011"), instance("marine-first", "hEB01-013"), instance("marine-second", "hEB01-016")],
  });
  const guest = player("Guest", "hBP08-001");
  guest.zones.center = stageUnit("guest-center", "hBP08-012");
  guest.zones.back1 = stageUnit("target", "hBP07-030");

  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.equal(state.players[0].archive.length, 2);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.back1.damage, 50);
  assert.equal(state.pendingChoice.effect, "oshiMarineSpecialDamage");
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.back1.damage, 100);
});

test("hBP03-002 Botan SP skill is active, pays 2 and snipes a non-Debut Center for 100", () => {
  const host = player("Botan", "hBP03-002", { holoPower: powerCards("botan-power", 2) });
  host.zones.center = stageUnit("green-center", "hBP07-030");
  const guest = player("Guest", "hBP08-001");
  guest.zones.center = stageUnit("target-center", "hBP08-012");

  let state = applyAction(playingState(host, guest), 0, { type: "spOshiSkill" }, cards);
  assert.equal(state.pendingChoice.effect, "specialDamage");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 100);
  assert.equal(state.players[0].archive.length, 2);
  assert.equal(state.players[0].spOshiSkillUsed, true);
});

test("Sora and Lui automatic end-of-turn Stage skills resolve", () => {
  const sora = player("Sora", "hEB01-001", {
    mainDeck: [instance("sora-power", "hBP01-104"), instance("sora-draw", "hBP01-104")],
  });
  sora.zones.center = stageUnit("sora-center", "hEB01-004");
  sora.zones.collab = stageUnit("sora-collab", "hEB01-005");
  sora.zones.back1 = stageUnit("sora-second", "hEB01-009");
  const soraGuest = player("Guest", "hBP08-001", { mainDeck: powerCards("guest", 2) });
  soraGuest.zones.center = stageUnit("guest-center", "hBP08-012");
  let state = applyAction(playingState(sora, soraGuest, { phase: "performance" }), 0, { type: "advance" }, cards);
  assert.equal(state.players[0].holoPower[0].id, "sora-power");
  assert.equal(state.players[0].hand[0].id, "sora-draw");

  const lui = player("Lui", "hBP08-005", {
    hand: [instance("kept", "hBP01-104")],
    mainDeck: powerCards("lui-draw", 3),
  });
  lui.zones.center = stageUnit("lui-center", "hBP08-061");
  lui.zones.collab = stageUnit("lui-collab", "hBP08-062");
  const luiGuest = player("Guest2", "hBP08-001", { mainDeck: powerCards("guest2", 2) });
  luiGuest.zones.center = stageUnit("guest2-center", "hBP08-012");
  state = applyAction(playingState(lui, luiGuest, { phase: "performance" }), 0, { type: "advance" }, cards);
  assert.equal(state.players[0].hand.length, 4);
});

test("Watame and AZKi continuous Stage skills apply on Arts use", () => {
  const watame = player("Watame", "hBP07-001", { mainDeck: [instance("watame-power", "hBP01-104")] });
  watame.zones.center = stageUnit("watame-center", "hBP07-008", { cheer: [instance("white", "hY01-001")] });
  const watameGuest = player("Guest", "hBP08-001");
  watameGuest.zones.center = stageUnit("watame-target", "hBP07-030");
  let state = applyAction(playingState(watame, watameGuest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[0].holoPower[0].id, "watame-power");
  assert.equal(state.players[1].zones.center.damage, 20);

  const azki = player("AZKi", "hBP07-006", { holoPower: powerCards("azki-power", 2) });
  azki.zones.center = stageUnit("azki-center", "hBP07-063", { cheer: [instance("purple", "hY05-001")] });
  const azkiGuest = player("Guest2", "hBP08-001");
  azkiGuest.zones.center = stageUnit("azki-target", "hBP07-030");
  state = applyAction(playingState(azki, azkiGuest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 70);
});

test("Haato Stage skill draws two once when her own ability returns Haato to the deck", () => {
  const host = player("Haato", "hBP07-004", {
    holoPower: powerCards("haato-power", 2),
    mainDeck: [instance("draw-1", "hBP01-104"), instance("draw-2", "hBP01-104")],
  });
  host.zones.center = stageUnit("haato-center", "hBP07-038");
  host.zones.back1 = stageUnit("haato-debut", "hBP07-036");
  const guest = player("Guest", "hBP08-001");
  guest.zones.center = stageUnit("guest-center", "hBP08-012");

  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["draw-1", "draw-2"]);
  assert.equal(state.players[0].mainDeck.at(-1).id, "haato-debut");
  assert.equal(state.players[0].namedUsageTurns["oshi-stage:hBP07-004"], 3);
});

test("Cecilia remains rested during reset while another Holomen becomes active", () => {
  const host = player("Host", "hBP08-001");
  host.zones.center = stageUnit("host-center", "hBP08-012");
  const cecilia = player("Cecilia", "hBP08-002", { mainDeck: powerCards("cecilia-draw", 2) });
  cecilia.zones.center = stageUnit("cecilia-center", "hBP08-021", { rested: true });
  cecilia.zones.back1 = stageUnit("other", "hBP08-012", { rested: true });

  const state = applyAction(playingState(host, cecilia, { phase: "performance" }), 0, { type: "advance" }, cards);
  assert.equal(state.activePlayer, 1);
  assert.equal(state.players[1].zones.center.rested, true);
  assert.equal(state.players[1].zones.back1.rested, false);
});

test("FUWAMOCO red Cheer can pay a blue Arts cost but still counts as only one Cheer", () => {
  const host = player("FUWAMOCO", "hBP08-003", { mainDeck: [instance("draw", "hBP01-104")] });
  host.zones.center = stageUnit("fuwawa", "hBP08-055", { cheer: [instance("red", "hY03-001")] });
  const guest = player("Guest", "hBP08-001");
  guest.zones.center = stageUnit("target", "hBP07-030");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 20);
  assert.equal(state.players[0].hand[0].id, "draw");

  const mococo = player("Mococo", "hBP08-003", { cheerDeck: [instance("top-cheer", "hY01-001")] });
  mococo.zones.center = stageUnit("mococo", "hBP08-037", { cheer: [instance("red-1", "hY03-001"), instance("red-2", "hY03-001")] });
  mococo.zones.back1 = stageUnit("fuwawa-back", "hBP08-055");
  const mococoGuest = player("Guest2", "hBP08-001");
  mococoGuest.zones.center = stageUnit("mococo-target", "hBP07-030");
  state = applyAction(playingState(mococo, mococoGuest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  assert.deepEqual(state.pendingChoice.options, ["back1"]);

  const tripleBlue = stageUnit("fuwawa-second", "hBP08-059", { cheer: [instance("one-red", "hY03-001")] });
  host.zones.center = tripleBlue;
  state = playingState(host, guest, { phase: "performance" });
  assert.throws(() => applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards), /應援不足/);
});

test("Ina Arts are free only while every opposing Holomen has a color outside the opposing Oshi", () => {
  const ina = player("Ina", "hBP08-006");
  ina.zones.center = stageUnit("ina-center", "hBP08-071");
  const different = player("Different", "hBP08-006");
  different.zones.center = stageUnit("red-target", "hBP08-041");
  let state = applyAction(playingState(ina, different, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 50);

  const same = player("Same", "hBP08-006");
  same.zones.center = stageUnit("purple-target", "hBP08-071");
  state = playingState(ina, same, { phase: "performance" });
  assert.throws(() => applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards), /應援不足/);
});
