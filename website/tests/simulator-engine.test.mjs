import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction, createLobbyState, joinLobby, publicRoomState, validateBattleDeck } from "../lib/simulator/engine.mjs";

const cards = [
  { number: "OSHI-001", name: "Test Oshi", group: "oshi", life: 5, maxCopies: 1, colors: ["白"], arts: [] },
  { number: "hEB01-003", name: "博衣小夜璃", jpName: "博衣こより", group: "oshi", life: 5, maxCopies: 1, colors: ["黃"], arts: [] },
  { number: "hBD24-001", name: "Birthday Green", group: "oshi", life: 5, maxCopies: 1, colors: ["綠"], oshiSkill: { name: "綠色強化", effect: "[每回合1次] 本回合中，讓自己的1位綠色Holomen的Arts+20。" }, spOshiSkill: { name: "Birthday Gift ～Green～", effect: "[每場遊戲1次] 從自己的牌庫中公開1張綠色Holomen，加入手牌。然後將牌庫洗牌。" }, arts: [] },
  { number: "hBP01-002", name: "Nanashi Mumei", group: "oshi", life: 5, maxCopies: 1, colors: ["白"], oshiSkill: { name: "文明的守護者", effect: "在對手的回合中，自己的#Promise Holomen受到傷害時，該傷害-50。" }, arts: [] },
  { number: "DEBUT-001", name: "Test Talent", jpName: "Test Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, colors: ["白"], arts: [{ name: "Test Art", damage: 20, cost: ["白"], effect: "" }] },
  { number: "GREEN-001", name: "Green Talent", jpName: "Green Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, colors: ["綠"], arts: [{ name: "Green Art", damage: 20, cost: [], effect: "" }] },
  { number: "GREEN-002", name: "Green Search", jpName: "Green Search", group: "holomem", stage: "1st", hp: 120, maxCopies: 50, colors: ["綠"], arts: [] },
  { number: "PROMISE-001", name: "Promise Talent", jpName: "Promise Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, tags: ["#Promise"], colors: ["白"], arts: [] },
  { number: "GEN-COLLAB", name: "Template Talent", jpName: "Template Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, colors: ["白"], keyword: { type: "collab_effect", name: "共通合作", effect: "抽取自己牌庫上方的2張牌。" }, arts: [] },
  { number: "GEN-BLOOM", name: "Template Talent", jpName: "Template Talent", group: "holomem", stage: "1st", hp: 120, maxCopies: 50, colors: ["白"], keyword: { type: "bloom_effect", name: "共通Bloom", effect: "對對手中央Holomen造成30點特殊傷害（即使被擊倒也不會讓對手的生命減少）。" }, arts: [] },
  { number: "GEN-ART", name: "Scaling Talent", jpName: "Scaling Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, colors: ["白"], arts: [{ name: "Cheer Scale", damage: 20, cost: [], effect: "此成員每有1張應援，此技能+20（應援最多5張）。" }] },
  { number: "hSD07-009", name: "Guard Talent", jpName: "Guard Talent", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, colors: ["白"], keyword: { type: "gift", name: "防守", effect: "[僅限中央位置]此成員受到的傷害-10。" }, arts: [] },
  { number: "FIRST-001", name: "Test Talent", jpName: "Test Talent", group: "holomem", stage: "1st", hp: 120, maxCopies: 50, colors: ["白"], arts: [] },
  { number: "SECOND-001", name: "Test Talent", jpName: "Test Talent", group: "holomem", stage: "2nd", hp: 150, maxCopies: 50, colors: ["白"], arts: [] },
  { number: "SPOT-001", name: "Test Spot", jpName: "Test Spot", group: "holomem", stage: "Spot", hp: 90, maxCopies: 50, colors: ["白"], arts: [] },
  { number: "ART-001", name: "Test Artist", jpName: "Test Artist", group: "holomem", stage: "Debut", hp: 100, maxCopies: 50, tags: ["#絵"], colors: ["白"], arts: [] },
  { number: "TARGET-001", name: "Large Target", jpName: "Large Target", group: "holomem", stage: "Debut", hp: 300, maxCopies: 50, colors: ["白"], arts: [] },
  { number: "BUZZ-001", name: "Test Buzz", jpName: "Test Buzz", group: "holomem", stage: "1st", type: "Buzz", typeCode: "buzzCharacter", hp: 180, maxCopies: 50, colors: ["白"], arts: [] },
  { number: "hBP01-104", name: "普通電腦", group: "support", stage: "", type: "道具", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP01-103", name: "電競電腦", jpName: "ゲーミングパソコン", group: "support", stage: "", type: "道具・LIMITED", typeCode: "supportItemLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP01-105", name: "應援棒", jpName: "ペンライト", group: "support", stage: "", type: "道具・LIMITED", typeCode: "supportItemLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP01-106", name: "接下來就拜託了！", jpName: "あとは任せた！", group: "support", stage: "", type: "事件", typeCode: "supportEvent", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP01-107", name: "安可", jpName: "アンコール", group: "support", stage: "", type: "事件", typeCode: "supportEvent", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP02-080", name: "秘密結社holoX", jpName: "秘密結社holoX", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP03-085", name: "超級電腦", jpName: "スーパーパソコン", group: "support", stage: "", type: "道具・LIMITED", typeCode: "supportItemLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP03-087", name: "呼喊與回應", jpName: "コールアンドレスポンス", group: "support", stage: "", type: "事件", typeCode: "supportEvent", maxCopies: 4, colors: [], arts: [] },
  { number: "hSD01-016", name: "春先和香", jpName: "春先のどか", group: "support", stage: "", type: "工作人員・LIMITED", typeCode: "supportStaffLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hSD01-017", name: "經紀人醬", jpName: "マネちゃん", group: "support", stage: "", type: "工作人員・LIMITED", typeCode: "supportStaffLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hSD01-018", name: "備用電腦", jpName: "サブパソコン", group: "support", stage: "", type: "道具", typeCode: "supportItem", maxCopies: 4, colors: [], arts: [] },
  { number: "hSD01-019", name: "厲害電腦", jpName: "スゴイパソコン", group: "support", stage: "", type: "道具・LIMITED", typeCode: "supportItemLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "TOOL-001", name: "Test Tool", group: "support", stage: "", type: "工具", typeCode: "supportTool", abilityText: "這個工具裝備的Holomen，Arts+10。", maxCopies: 4, colors: [], arts: [] },
  { number: "hEB01-018", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "Debut", hp: 120, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Summer Art", damage: 20, cost: ["無色"], effect: "" }] },
  { number: "hEB01-019", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "Debut", hp: 140, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Collab Art", damage: 10, cost: ["無色"], effect: "" }] },
  { number: "hEB01-020", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "1st", hp: 190, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "One", damage: 30, cost: ["無色"], effect: "" }, { name: "Reveal", damage: 50, cost: ["黃", "無色"], effect: "" }] },
  { number: "hEB01-021", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "1st", hp: 160, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Heal", damage: 30, cost: ["無色"], effect: "" }] },
  { number: "hEB01-022", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "1st", hp: 140, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Second Bonus", damage: 30, cost: ["黃"], effect: "" }] },
  { number: "hEB01-023", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "2nd", hp: 210, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Draw to Assistants", damage: 50, cost: ["無色", "無色"], effect: "" }] },
  { number: "hEB01-024", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "2nd", hp: 200, maxCopies: 4, tags: ["#秘密結社holoX", "#サマー"], colors: ["黃"], arts: [{ name: "Assistant Art", damage: 120, cost: ["黃", "無色", "無色"], effect: "" }] },
  { number: "hBP04-012", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "1st", hp: 140, maxCopies: 4, tags: ["#秘密結社holoX"], colors: ["白"], arts: [{ name: "助手", damage: 30, cost: ["白"], effect: "" }] },
  { number: "hBP04-009", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "Debut", hp: 90, maxCopies: 4, tags: ["#秘密結社holoX"], colors: ["白"], arts: [{ name: "Top Three", damage: 20, cost: ["無色"], effect: "" }] },
  { number: "hBP04-011", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "1st", hp: 120, maxCopies: 4, tags: ["#秘密結社holoX"], colors: ["白"], arts: [{ name: "Assistant", damage: 30, cost: ["無色"], effect: "" }] },
  { number: "hSD06-008", name: "博衣小夜璃", jpName: "博衣こより", group: "holomem", stage: "Debut", hp: 90, maxCopies: 4, tags: ["#秘密結社holoX"], colors: ["白"], arts: [{ name: "Brainpower", damage: 10, cost: ["無色"], effect: "" }] },
  { number: "hBP04-105", name: "小夜璃的助手君", jpName: "こよりの助手くん", group: "support", stage: "", type: "粉絲", typeCode: "supportFan", abilityText: "此Fan只能裝備在自己的〈博衣こより〉。", tags: ["#こよラボ"], maxCopies: 4, colors: [], arts: [] },
  { number: "hBP04-097", name: "綠色試管", group: "support", stage: "", type: "工具", typeCode: "supportTool", abilityText: "這個工具裝備的Holomen，Arts+10。", tags: ["#こよラボ"], maxCopies: 4, colors: [], arts: [] },
  { number: "hBP04-100", name: "心心", group: "support", stage: "", type: "吉祥物", typeCode: "supportMascot", abilityText: "這個吉祥物所在的Holomen，HP+20。", tags: ["#こよラボ"], maxCopies: 4, colors: [], arts: [] },
  { number: "hEB01-034", name: "萬事爆解！", group: "support", stage: "", type: "工具", typeCode: "supportTool", abilityText: "帶有這個道具的成員藝能傷害+10。", tags: ["#こよラボ"], maxCopies: 4, colors: [], arts: [] },
  { number: "hEB01-030", name: "Hololive Summer", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP03-088", name: "等待來電", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP05-080", name: "SorAZ慶典", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP06-089", name: "繪畫直播", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP06-090", name: "綻放舞台", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "hBP06-093", name: "山田琉依54世", group: "support", stage: "", type: "事件・LIMITED", typeCode: "supportEventLimited", maxCopies: 4, colors: [], arts: [] },
  { number: "SUPPORT-001", name: "Filler", group: "support", stage: "", type: "事件", maxCopies: 50, colors: [], arts: [] },
  { number: "CHEER-001", name: "白色應援", group: "cheer", stage: "", maxCopies: 20, colors: ["白"], arts: [] },
  { number: "CHEER-002", name: "黃色應援", group: "cheer", stage: "", maxCopies: 20, colors: ["黃"], arts: [] },
];

const officialCards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const effectCards = [...cards, ...officialCards];

const deck = {
  oshi: { "OSHI-001": 1 },
  main: { "DEBUT-001": 4, "hBP01-104": 1, "SUPPORT-001": 45 },
  cheer: { "CHEER-001": 20 },
};

const emptyZones = () => ({ center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null });
const instance = (id, number) => ({ id, number });
const stageUnit = (id, number, options = {}) => ({
  stack: [instance(id, number)],
  cheer: [],
  attachments: [],
  damage: 0,
  rested: false,
  enteredTurn: 0,
  bloomedTurn: 0,
  collabbedTurn: 0,
  returnSlot: null,
  ...options,
});

function player(name, overrides = {}) {
  return {
    name,
    ready: true,
    setupDone: true,
    oshi: instance(`${name}-oshi`, "OSHI-001"),
    mainDeck: [],
    cheerDeck: [],
    hand: [],
    life: [instance(`${name}-life`, "CHEER-001")],
    holoPower: [],
    archive: [],
    zones: emptyZones(),
    collabTurn: 0,
    batonTurn: 0,
    limitedTurn: 0,
    turnsTaken: 2,
    mulliganUsed: false,
    forcedRedraws: 0,
    ...overrides,
  };
}

function playingState(first, second, overrides = {}) {
  return {
    status: "playing",
    players: [first, second],
    activePlayer: 0,
    firstPlayer: 0,
    winner: null,
    turn: 3,
    phase: "main",
    pendingChoice: null,
    log: [],
    ...overrides,
  };
}

test("battle deck validation enforces 1 / 50 / 20 and a Debut", () => {
  assert.deepEqual(validateBattleDeck(deck, cards), { ok: true });
  assert.match(validateBattleDeck({ ...deck, main: { "SUPPORT-001": 50 } }, cards).error, /Debut/);
});

test("selected card printings survive deck validation, shuffle and public room state", () => {
  const printingCards = cards.map((card) => card.number === "OSHI-001"
    ? { ...card, variants: [{ id: "oshi-our", rarity: "OUR", image: "oshi-our.png" }] }
    : card.number === "DEBUT-001"
      ? { ...card, variants: [{ id: "debut-p", rarity: "P", image: "debut-p.png" }, { id: "debut-sec", rarity: "SEC", image: "debut-sec.png" }] }
      : { ...card, variants: card.variants || [] });
  const printingDeck = {
    ...deck,
    printings: {
      "OSHI-001": { "oshi-our": 1 },
      "DEBUT-001": { "debut-p": 2, "debut-sec": 2 },
    },
  };
  assert.deepEqual(validateBattleDeck(printingDeck, printingCards), { ok: true });
  assert.match(validateBattleDeck({ ...printingDeck, printings: { "DEBUT-001": { missing: 1 } } }, printingCards).error, /卡圖版本/);

  let state = joinLobby(createLobbyState("Host", printingDeck), "Guest", printingDeck);
  state = applyAction(state, 0, { type: "ready", ready: true }, printingCards, () => 0.25);
  state = applyAction(state, 1, { type: "ready", ready: true }, printingCards, () => 0.25);
  assert.equal(state.players[0].oshi.variantId, "oshi-our");
  const debutPrintings = [...state.players[0].hand, ...state.players[0].mainDeck]
    .filter((instance) => instance.number === "DEBUT-001")
    .map((instance) => instance.variantId)
    .sort();
  assert.deepEqual(debutPrintings, ["debut-p", "debut-p", "debut-sec", "debut-sec"]);
  assert.equal(publicRoomState(state, 0).players[0].oshi.variantId, "oshi-our");
});

test("room startup shuffles, deals, determines first player and redacts the opponent hand", () => {
  let state = joinLobby(createLobbyState("Host", deck), "Guest", deck);
  state = applyAction(state, 0, { type: "ready", ready: true }, cards, () => 0.25);
  state = applyAction(state, 1, { type: "ready", ready: true }, cards, () => 0.25);
  assert.equal(state.status, "setup");
  assert.equal(state.firstPlayer, 0);
  assert.equal(state.players[0].hand.length, 7);
  assert.equal(state.players[0].life.length, 0, "life is placed after the opening stage, per official setup order");
  assert.equal(state.players[0].cheerDeck.length, 20);
  const view = publicRoomState(state, 0);
  assert.equal(view.players[0].hand.filter(Boolean).length, 7);
  assert.equal(view.players[1].hand.filter(Boolean).length, 0);
  assert.equal(view.players[1].handCount, 7);
});

test("opening setup preserves click order and starts with draw plus mandatory Cheer", () => {
  const allDebutDeck = { oshi: { "OSHI-001": 1 }, main: { "DEBUT-001": 50 }, cheer: { "CHEER-001": 20 } };
  let state = joinLobby(createLobbyState("Host", allDebutDeck), "Guest", allDebutDeck);
  state = applyAction(state, 0, { type: "ready", ready: true }, cards, () => 0.25);
  state = applyAction(state, 1, { type: "ready", ready: true }, cards, () => 0.25);
  const host = [...state.players[0].hand];
  const guest = [...state.players[1].hand];
  state = applyAction(state, 0, { type: "setup", centerId: host[0].id, backIds: [host[2].id, host[1].id], bottomIds: [] }, cards, () => 0.25);
  assert.equal(state.players[0].zones.center.stack[0].id, host[0].id);
  assert.equal(state.players[0].zones.back1.stack[0].id, host[2].id);
  assert.equal(state.players[0].zones.back2.stack[0].id, host[1].id);
  const guestViewBeforeReveal = publicRoomState(state, 1);
  assert.equal(guestViewBeforeReveal.players[0].zones.center.hidden, true);
  assert.deepEqual(guestViewBeforeReveal.players[0].zones.center.stack, []);
  assert.equal(publicRoomState(state, 0).players[0].zones.center.stack[0].id, host[0].id);
  state = applyAction(state, 1, { type: "setup", centerId: guest[0].id, backIds: [], bottomIds: [] }, cards, () => 0.25);
  assert.equal(state.status, "playing");
  assert.equal(state.players[state.firstPlayer].turnsTaken, 1);
  assert.equal(state.phase, "cheer");
  assert.equal(state.pendingChoice.type, "cheerTarget");
  assert.equal(state.players[0].life.length, 5);
  assert.equal(state.players[1].life.length, 5);
});

test("voluntary opening redraw is limited to once", () => {
  const setupPlayer = player("Host", {
    setupDone: false,
    hand: Array.from({ length: 7 }, (_, index) => instance(`h${index}`, "DEBUT-001")),
    mainDeck: Array.from({ length: 43 }, (_, index) => instance(`d${index}`, "DEBUT-001")),
    life: [],
  });
  const state = { status: "setup", players: [setupPlayer, player("Guest")], activePlayer: null, firstPlayer: 0, winner: null, turn: 0, phase: "setup", pendingChoice: null, log: [] };
  const redrawn = applyAction(state, 0, { type: "redraw" }, cards, () => 0.5);
  assert.equal(redrawn.players[0].mulliganUsed, true);
  assert.throws(() => applyAction(redrawn, 0, { type: "redraw" }, cards, () => 0.5), /只可自願重抽 1 次/);
});

test("forced redraw penalty must go to deck bottom before stage setup", () => {
  const setupPlayer = player("Host", {
    setupDone: false,
    forcedRedraws: 1,
    hand: [instance("center", "DEBUT-001"), instance("bottom", "SUPPORT-001"), instance("back", "SPOT-001")],
    mainDeck: [instance("deck", "SUPPORT-001")],
    cheerDeck: Array.from({ length: 20 }, (_, index) => instance(`c${index}`, "CHEER-001")),
    life: [],
    lifeTarget: 5,
  });
  const state = { status: "setup", players: [setupPlayer, player("Guest", { setupDone: false })], activePlayer: null, firstPlayer: 0, winner: null, turn: 0, phase: "setup", pendingChoice: null, log: [] };
  assert.throws(() => applyAction(state, 0, { type: "setup", centerId: "center", backIds: ["back"], bottomIds: [] }, cards), /選擇 1 張/);
  const setup = applyAction(state, 0, { type: "setup", centerId: "center", backIds: ["back"], bottomIds: ["bottom"] }, cards);
  assert.equal(setup.players[0].mainDeck.at(-1).id, "bottom");
  assert.equal(setup.players[0].zones.back1.stack[0].id, "back");
});

test("both players are blocked from Bloom on their own first turn", () => {
  for (const playerIndex of [0, 1]) {
    const first = player("Host", { turnsTaken: playerIndex === 0 ? 1 : 0 });
    const second = player("Guest", { turnsTaken: playerIndex === 1 ? 1 : 0 });
    const current = [first, second][playerIndex];
    current.hand = [instance("first", "FIRST-001")];
    current.zones.center = stageUnit("debut", "DEBUT-001");
    const state = playingState(first, second, { activePlayer: playerIndex, firstPlayer: 0, turn: playerIndex + 1 });
    assert.throws(() => applyAction(state, playerIndex, { type: "play", cardId: "first" }, cards), /第 1 回合都不可 Bloom/);
  }
});

test("a Holomen that entered this turn cannot Bloom, while legal same-level Bloom can", () => {
  const host = player("Host", { hand: [instance("first", "FIRST-001")] });
  host.zones.back1 = stageUnit("debut", "DEBUT-001", { enteredTurn: 3 });
  let state = playingState(host, player("Guest"));
  assert.throws(() => applyAction(state, 0, { type: "play", cardId: "first" }, cards), /本回合才登場/);

  host.zones.back1.enteredTurn = 0;
  host.zones.back1.stack.push(instance("old-first", "FIRST-001"));
  state = playingState(host, player("Guest"));
  const queued = applyAction(state, 0, { type: "play", cardId: "first" }, cards);
  assert.equal(queued.pendingChoice.type, "bloom");
  assert.deepEqual(queued.pendingChoice.options, ["back1"]);
});

test("normal Debut play only offers Back positions and respects the six-Holomen cap", () => {
  const host = player("Host", { hand: [instance("new", "DEBUT-001")] });
  host.zones.center = stageUnit("center", "DEBUT-001");
  const queued = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "new" }, cards);
  assert.deepEqual(queued.pendingChoice.options, ["back1", "back2", "back3", "back4", "back5"]);

  host.zones.collab = stageUnit("collab", "DEBUT-001");
  for (const slot of ["back1", "back2", "back3", "back4"]) host.zones[slot] = stageUnit(slot, "DEBUT-001");
  assert.throws(() => applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "new" }, cards), /上限 6/);
});

test("first player skips first Performance; reset returns Collab rested then draws and Cheers", () => {
  const host = player("Host", {
    turnsTaken: 1,
    mainDeck: [instance("draw", "SUPPORT-001")],
    cheerDeck: [instance("cheer", "CHEER-001")],
  });
  host.zones.center = stageUnit("center", "DEBUT-001");
  host.zones.collab = stageUnit("collab", "DEBUT-001", { rested: true, returnSlot: "back2" });
  const guest = player("Guest", {
    turnsTaken: 0,
    mainDeck: [instance("guest-draw", "SUPPORT-001")],
    cheerDeck: [instance("guest-cheer", "CHEER-001")],
  });
  guest.zones.center = stageUnit("guest-center", "DEBUT-001");
  let state = playingState(host, guest, { turn: 1, phase: "main" });
  state = applyAction(state, 0, { type: "advance" }, cards);
  assert.equal(state.activePlayer, 1);
  assert.equal(state.turn, 2);
  assert.equal(state.phase, "cheer");
  assert.equal(state.players[1].turnsTaken, 1);

  state = applyAction(state, 1, { type: "choose", zone: "center" }, cards);
  state = applyAction(state, 1, { type: "advance" }, cards);
  assert.equal(state.phase, "performance", "the second player may perform on their first turn");
  state = applyAction(state, 1, { type: "advance" }, cards);
  assert.equal(state.activePlayer, 0);
  assert.equal(state.turn, 3);
  assert.equal(state.players[0].zones.collab, null);
  assert.equal(state.players[0].zones.back2.stack[0].id, "collab");
  assert.equal(state.players[0].zones.back2.rested, true);
  assert.equal(state.phase, "cheer");
  assert.equal(state.pendingChoice.type, "cheerTarget");
});

test("end step requires an active Back Holomen to fill an empty Center first", () => {
  const host = player("Host");
  host.zones.back1 = stageUnit("rested", "DEBUT-001", { rested: true });
  host.zones.back2 = stageUnit("active", "DEBUT-001");
  const guest = player("Guest", { mainDeck: [instance("draw", "SUPPORT-001")] });
  guest.zones.center = stageUnit("guest", "DEBUT-001");
  let state = playingState(host, guest, { phase: "performance" });
  state = applyAction(state, 0, { type: "advance" }, cards);
  assert.equal(state.pendingChoice.type, "centerReplacement");
  assert.deepEqual(state.pendingChoice.options, ["back2"]);
  state = applyAction(state, 0, { type: "choose", zone: "back2" }, cards);
  assert.equal(state.players[0].zones.center.stack[0].id, "active");
  assert.equal(state.activePlayer, 1);
});

test("Collab requires an active Back and Baton Touch is once per turn", () => {
  const host = player("Host");
  host.zones.center = stageUnit("center", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  host.zones.back1 = stageUnit("back", "DEBUT-001", { rested: true });
  let state = playingState(host, player("Guest"));
  assert.throws(() => applyAction(state, 0, { type: "collab", zone: "back1" }, cards), /休息中/);
  state.players[0].zones.back1.rested = false;
  state = applyAction(state, 0, { type: "baton", zone: "back1" }, cards);
  assert.equal(state.players[0].batonTurn, 3);
  assert.throws(() => applyAction(state, 0, { type: "baton", zone: "back1" }, cards), /只可接力 1 次/);
});

test("a Holomen stays active when it first moves to Collab and may perform", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001")] });
  host.zones.back1 = stageUnit("back", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "DEBUT-001");
  let state = applyAction(playingState(host, guest), 0, { type: "collab", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.collab.rested, false);
  assert.equal(state.players[0].zones.collab.returnSlot, "back1");
  assert.equal(state.players[0].zones.collab.collabbedTurn, 3);
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 20);
  assert.equal(state.players[0].zones.collab.rested, true);
});

test("generic Collab and Bloom templates resolve draw and special damage", () => {
  const collabHost = player("Host", { mainDeck: [instance("power", "SUPPORT-001"), instance("draw1", "SUPPORT-001"), instance("draw2", "SUPPORT-001")] });
  collabHost.zones.back1 = stageUnit("collab-source", "GEN-COLLAB");
  let state = applyAction(playingState(collabHost, player("Guest")), 0, { type: "collab", zone: "back1" }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["draw1", "draw2"]);

  const bloomHost = player("Host", { hand: [instance("bloom", "GEN-BLOOM")] });
  bloomHost.zones.center = stageUnit("debut", "GEN-COLLAB");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  state = applyAction(playingState(bloomHost, guest), 0, { type: "play", cardId: "bloom" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 30);
});

test("Collab never activates a Bloom-only keyword", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001")] });
  host.zones.back1 = stageUnit("bloom-only", "GEN-BLOOM");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  const state = applyAction(playingState(host, guest), 0, { type: "collab", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.center.damage, 0);
  assert.equal(state.pendingChoice, null);
});

test("every dual-name Holomen can Bloom with either printed member name", () => {
  assert.deepEqual(officialCards
    .filter((card) => card.group === "holomem" && /同時(?:也)?視為/u.test(`${card.extra || ""} ${card.abilityText || ""}`))
    .map((card) => card.number)
    .sort(), ["hBP03-050", "hBP05-040", "hBP06-083", "hBP08-060"]);
  const cases = [
    ["hBP03-050", "hBP03-040", "Fuwawa"],
    ["hBP05-040", "hBP03-025", "Sakura Miko"],
    ["hBP06-083", "hBP04-067", "Oozora Subaru"],
    ["hBP08-060", "hBP08-034", "Mococo"],
  ];
  cases.forEach(([bloomNumber, debutNumber, label], index) => {
    const host = player(`Host-${index}`, { hand: [instance(`bloom-${index}`, bloomNumber)] });
    host.zones.center = stageUnit(`debut-${index}`, debutNumber);
    const state = applyAction(playingState(host, player(`Guest-${index}`)), 0, { type: "play", cardId: `bloom-${index}` }, effectCards);
    assert.equal(state.pendingChoice?.type, "bloom", `${label} should accept the dual-name Bloom card`);
    assert.deepEqual(state.pendingChoice?.options, ["center"]);
  });

  const reverse = player("Reverse", { hand: [instance("subaru-2nd", "hBP06-081")] });
  reverse.zones.center = stageUnit("lambduck", "hBP06-083");
  const state = applyAction(playingState(reverse, player("ReverseGuest")), 0, { type: "play", cardId: "subaru-2nd" }, effectCards);
  assert.equal(state.pendingChoice?.type, "bloom");
  assert.deepEqual(state.pendingChoice?.options, ["center"]);
});

test("hBP08-062 archives one hand card then selects an unlimited Debut from the deck", () => {
  const host = player("Lui", {
    hand: [instance("cost", "SUPPORT-001")],
    mainDeck: [instance("power", "SUPPORT-001"), { ...instance("unlimited-debut", "hBP04-008"), variantId: "870" }, instance("wrong-stage", "FIRST-001")],
  });
  host.zones.back1 = stageUnit("lui", "hBP08-062");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "collab", zone: "back1" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice?.effect, "genericKeywordHandArchiveCost");
  state = applyAction(state, 0, { type: "choose", cardIds: ["cost"] }, effectCards, () => 0.5);
  assert.equal(state.players[0].archive.at(-1)?.id, "cost");
  assert.equal(state.pendingChoice?.effect, "deckCardsToStage");
  assert.equal(state.pendingChoice?.min, 1);
  assert.deepEqual(state.pendingChoice?.cards.map((card) => card.id), ["unlimited-debut"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["unlimited-debut"] }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice?.effect, "placeCard");
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards, () => 0.5);
  assert.equal(state.players[0].zones.back1?.stack.at(-1)?.number, "hBP04-008");
  assert.equal(state.players[0].zones.back1?.stack.at(-1)?.variantId, "870");
});

test("hBP08-062 distinguishes a full six-Holomen stage from an empty deck search", () => {
  const host = player("Full Stage", {
    hand: [instance("cost", "SUPPORT-001")],
    mainDeck: [instance("power", "SUPPORT-001"), instance("unlimited-debut", "hBP04-008")],
  });
  host.zones.center = stageUnit("center", "DEBUT-001");
  host.zones.back1 = stageUnit("lui", "hBP08-062");
  host.zones.back2 = stageUnit("back2", "DEBUT-001");
  host.zones.back3 = stageUnit("back3", "DEBUT-001");
  host.zones.back4 = stageUnit("back4", "DEBUT-001");
  host.zones.back5 = stageUnit("back5", "DEBUT-001");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "collab", zone: "back1" }, effectCards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", cardIds: ["cost"] }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice, null);
  assert.match(state.log[0].message, /有符合條件的卡.*舞台已滿 6 位/u);
});

test("generic Arts scaling and Gift damage reduction use live table state", () => {
  const host = player("Host");
  host.zones.center = stageUnit("source", "GEN-ART", { cheer: [instance("c1", "CHEER-001"), instance("c2", "CHEER-001"), instance("c3", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("guard", "hSD07-009");
  const state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 70, "20 base + 60 per Cheer - 10 Gift");
});

test("official deck and Holo Power edge rules do not treat effect draws like draw-step loss", () => {
  const blocked = player("Blocked");
  blocked.zones.back1 = stageUnit("back", "DEBUT-001");
  assert.throws(() => applyAction(playingState(blocked, player("Guest")), 0, { type: "collab", zone: "back1" }, cards), /主牌庫已空/);

  const host = player("Host", {
    oshi: instance("oshi", "hEB01-003"),
    holoPower: [instance("old", "SUPPORT-001"), instance("newer", "SUPPORT-001"), instance("newest", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("source", "hBP04-012", { cheer: [instance("pay", "CHEER-001")], attachments: [instance("assistant", "hBP04-105")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.deepEqual(state.players[0].holoPower.map((card) => card.id), ["old"], "newest Holo Power is paid first");
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.status, "playing", "failing an effect draw does not lose the game");
  assert.equal(state.players[1].zones.center.damage, 30);
});

test("attachable support targets the actual stage unit and its Arts bonus resolves", () => {
  const host = player("Host", { hand: [instance("tool", "TOOL-001")] });
  host.zones.center = stageUnit("source", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "DEBUT-001");
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "tool" }, cards);
  assert.equal(state.pendingChoice.type, "attachSupport");
  assert.ok(state.pendingChoice.options.includes("center"));
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.attachments[0].number, "TOOL-001");
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 30);
});

test("ordinary computer opens a Debut selection and resolves it server-side", () => {
  const host = player("Host", { mainDeck: [instance("d1", "DEBUT-001")], hand: [instance("pc", "hBP01-104")] });
  const state = playingState(host, player("Guest"), { turn: 2 });
  const queued = applyAction(state, 0, { type: "play", cardId: "pc" }, cards, () => 0.5);
  assert.equal(queued.pendingChoice.type, "ordinaryComputer");
  assert.deepEqual(queued.pendingChoice.options, ["DEBUT-001"]);
  const resolved = applyAction(queued, 0, { type: "choose", cardNumber: "DEBUT-001", zone: "back1" }, cards, () => 0.5);
  assert.equal(resolved.players[0].zones.back1.stack[0].number, "DEBUT-001");
  assert.equal(resolved.players[0].zones.back1.enteredTurn, 2);
  assert.equal(resolved.players[0].mainDeck.length, 0);
  assert.equal(resolved.players[0].archive[0].number, "hBP01-104");

  const skipHost = player("SkipHost", { mainDeck: [instance("skip-debut", "DEBUT-001")], hand: [instance("skip-pc", "hBP01-104")] });
  const skipQueued = applyAction(playingState(skipHost, player("SkipGuest"), { turn: 2 }), 0, { type: "play", cardId: "skip-pc" }, cards, () => 0.5);
  assert.equal(skipQueued.pendingChoice.optional, true);
  const skipped = applyAction(skipQueued, 0, { type: "choose", skip: true }, cards, () => 0.5);
  assert.equal(skipped.players[0].zones.back1, null);
  assert.equal(skipped.players[0].mainDeck[0].id, "skip-debut");
});

test("shared top-look effects filter eligible cards, enforce the hand limit and preserve bottom order", () => {
  const host = player("Host", {
    hand: [instance("event", "hBP02-080")],
    mainDeck: [instance("holox", "hEB01-018"), instance("filler", "SUPPORT-001"), instance("artist", "ART-001"), instance("debut", "DEBUT-001")],
  });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "event" }, cards);
  assert.equal(state.pendingChoice.effect, "topLookToHand");
  assert.deepEqual(state.pendingChoice.selectableIds, ["holox"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["holox"] }, cards);
  assert.equal(state.pendingChoice.effect, "bottomOrder");
  state = applyAction(state, 0, { type: "choose", cardIds: ["debut", "filler", "artist"] }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["holox"]);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["debut", "filler", "artist"]);
  assert.equal(state.players[0].limitedTurn, 3);

  const blocked = player("Blocked", {
    hand: [instance("event", "hBP02-080"), ...Array.from({ length: 7 }, (_, index) => instance(`extra-${index}`, "SUPPORT-001"))],
    mainDeck: [instance("holox", "hEB01-018")],
  });
  assert.throws(() => applyAction(playingState(blocked, player("Guest")), 0, { type: "play", cardId: "event" }, cards), /不可多於 6 張/);
});

test("grouped computer effects choose a Debut and a 1st in sequence", () => {
  const host = player("Host", {
    hand: [instance("pc", "hBP03-085")],
    mainDeck: [instance("debut", "DEBUT-001"), instance("first", "FIRST-001"), instance("second", "SECOND-001"), instance("filler", "SUPPORT-001")],
  });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "pc" }, cards);
  assert.equal(state.pendingChoice.effect, "topLookGrouped");
  assert.deepEqual(state.pendingChoice.selectableIds, ["debut"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["debut"] }, cards);
  assert.equal(state.pendingChoice.effect, "topLookGrouped");
  assert.deepEqual(state.pendingChoice.selectableIds, ["first"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["first"] }, cards);
  assert.equal(state.pendingChoice.effect, "bottomOrder");
  state = applyAction(state, 0, { type: "choose", cardIds: ["filler", "second"] }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["debut", "first"]);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["filler", "second"]);
});

test("backup computer finds one LIMITED support from the actual top five", () => {
  const host = player("Host", {
    hand: [instance("pc", "hSD01-018")],
    mainDeck: [instance("normal", "hBP01-106"), instance("limited", "hBP01-103"), instance("one", "SUPPORT-001"), instance("two", "SUPPORT-001"), instance("three", "SUPPORT-001")],
  });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "pc" }, cards);
  assert.deepEqual(state.pendingChoice.selectableIds, ["limited"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["limited"] }, cards);
  state = applyAction(state, 0, { type: "choose", cardIds: ["normal", "three", "one", "two"] }, cards);
  assert.equal(state.players[0].hand[0].id, "limited");
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["normal", "three", "one", "two"]);
});

test("gaming computer pays the newest Holo Power and excludes Buzz from its deck search", () => {
  const host = player("Host", {
    hand: [instance("pc", "hBP01-103")],
    holoPower: [instance("old", "SUPPORT-001"), instance("new", "SUPPORT-001")],
    mainDeck: [instance("first", "FIRST-001"), instance("buzz", "BUZZ-001"), instance("yellow", "hEB01-018")],
  });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "pc" }, cards, () => 0.5);
  assert.deepEqual(state.players[0].holoPower.map((card) => card.id), ["old"]);
  assert.deepEqual(state.pendingChoice.selectableIds, ["first"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["first"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "first"));
  assert.ok(state.players[0].archive.some((card) => card.id === "new"));
  assert.ok(state.players[0].archive.some((card) => card.id === "pc"));
});

test("great computer pays the clicked stage Cheer before its non-Buzz search", () => {
  const host = player("Host", {
    hand: [instance("pc", "hSD01-019")],
    mainDeck: [instance("second", "SECOND-001"), instance("buzz", "BUZZ-001")],
  });
  host.zones.center = stageUnit("center", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "pc" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.type, "payStageCheerForSearch");
  assert.deepEqual(state.pendingChoice.options, ["pay"]);
  state = applyAction(state, 0, { type: "choose", cheerId: "pay" }, cards, () => 0.5);
  assert.equal(state.players[0].zones.center.cheer.length, 0);
  assert.deepEqual(state.pendingChoice.selectableIds, ["second"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["second"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "second"));
  assert.ok(state.players[0].archive.some((card) => card.id === "pay"));
});

test("shared draw and hand-reset staff effects resolve automatically", () => {
  const drawHost = player("DrawHost", {
    hand: [instance("staff", "hSD01-016")],
    mainDeck: [instance("one", "SUPPORT-001"), instance("two", "SUPPORT-001"), instance("three", "SUPPORT-001"), instance("four", "SUPPORT-001")],
  });
  const drawn = applyAction(playingState(drawHost, player("Guest")), 0, { type: "play", cardId: "staff" }, cards);
  assert.deepEqual(drawn.players[0].hand.map((card) => card.id), ["one", "two", "three"]);
  assert.equal(drawn.players[0].mainDeck[0].id, "four");

  const resetHost = player("ResetHost", {
    hand: [instance("manager", "hSD01-017"), instance("held-one", "SUPPORT-001"), instance("held-two", "SUPPORT-001")],
    mainDeck: Array.from({ length: 5 }, (_, index) => instance(`deck-${index}`, "SUPPORT-001")),
  });
  const reset = applyAction(playingState(resetHost, player("Guest")), 0, { type: "play", cardId: "manager" }, cards, () => 0.5);
  assert.equal(reset.players[0].hand.length, 5);
  assert.equal(reset.players[0].mainDeck.length, 2);
  assert.ok(reset.players[0].archive.some((card) => card.id === "manager"));
});

test("Cheer Stick selects an actual matching Cheer and a table target", () => {
  const host = player("Host", {
    hand: [instance("stick", "hBP01-105")],
    holoPower: [instance("power", "SUPPORT-001")],
    cheerDeck: [instance("white", "CHEER-001"), instance("yellow", "CHEER-002")],
  });
  host.zones.center = stageUnit("center", "DEBUT-001");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "stick" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "cheerStickCheer");
  assert.deepEqual(state.pendingChoice.selectableIds, ["white"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["white"] }, cards, () => 0.5);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards, () => 0.5);
  assert.equal(state.players[0].zones.center.cheer[0].id, "white");
  assert.deepEqual(state.players[0].cheerDeck.map((card) => card.id), ["yellow"]);
});

test("position swap, Encore and Call-and-Response all use actual table or card clicks", () => {
  const swapHost = player("SwapHost", { hand: [instance("swap", "hBP01-106")] });
  swapHost.zones.center = stageUnit("center", "DEBUT-001");
  swapHost.zones.back1 = stageUnit("back", "ART-001");
  swapHost.zones.back2 = stageUnit("rested", "DEBUT-001", { rested: true });
  let state = applyAction(playingState(swapHost, player("Guest")), 0, { type: "play", cardId: "swap" }, cards);
  assert.deepEqual(state.pendingChoice.options, ["back1"]);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.center.stack[0].id, "back");
  assert.equal(state.players[0].zones.back1.stack[0].id, "center");

  const encoreHost = player("EncoreHost", {
    hand: [instance("encore", "hBP01-107")],
    archive: [instance("white", "CHEER-001"), instance("yellow", "CHEER-002"), instance("filler", "SUPPORT-001")],
  });
  state = applyAction(playingState(encoreHost, player("Guest")), 0, { type: "play", cardId: "encore" }, cards, () => 0.5);
  assert.deepEqual(state.pendingChoice.selectableIds.sort(), ["white", "yellow"]);
  state = applyAction(state, 0, { type: "choose", cardIds: ["yellow", "white"] }, cards, () => 0.5);
  assert.deepEqual(state.players[0].cheerDeck.map((card) => card.id).sort(), ["white", "yellow"]);

  const moveHost = player("MoveHost", { hand: [instance("move", "hBP03-087")] });
  moveHost.zones.center = stageUnit("center", "DEBUT-001", { cheer: [instance("move-white", "CHEER-001")] });
  moveHost.zones.back1 = stageUnit("back", "ART-001", { cheer: [instance("stay-yellow", "CHEER-002")] });
  state = applyAction(playingState(moveHost, player("Guest")), 0, { type: "play", cardId: "move" }, cards);
  assert.equal(state.pendingChoice.type, "moveStageCheerSource");
  state = applyAction(state, 0, { type: "choose", cheerId: "move-white" }, cards);
  assert.equal(state.pendingChoice.type, "moveStageCheerTarget");
  assert.deepEqual(state.pendingChoice.options, ["back1"]);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.center.cheer.length, 0);
  assert.deepEqual(state.players[0].zones.back1.cheer.map((card) => card.id), ["stay-yellow", "move-white"]);
});

test("Hololive Summer draws two then resolves the top-card choice", () => {
  const host = player("Host", {
    hand: [instance("summer", "hEB01-030")],
    mainDeck: [instance("draw1", "SUPPORT-001"), instance("draw2", "SUPPORT-001"), instance("pick", "hEB01-020"), instance("archive", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("s1", "hEB01-018");
  host.zones.back1 = stageUnit("s2", "hEB01-019");
  host.zones.back2 = stageUnit("s3", "hEB01-020");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "summer" }, cards, () => 0.5);
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[0].limitedTurn, 3);
  assert.equal(state.pendingChoice.type, "cardSelection");
  state = applyAction(state, 0, { type: "choose", cardIds: ["pick"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "pick"));
  assert.ok(state.players[0].archive.some((card) => card.id === "archive"));
});

test("Koyori Collab on the second player's first turn searches Debut then KoyoLab", () => {
  const host = player("Host");
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const guest = player("Guest", {
    turnsTaken: 1,
    mainDeck: [instance("power", "SUPPORT-001"), instance("debut", "hEB01-018"), instance("fan", "hBP04-105")],
  });
  guest.zones.center = stageUnit("guest-center", "hEB01-018");
  guest.zones.back1 = stageUnit("collabber", "hEB01-019");
  let state = applyAction(playingState(host, guest, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "groupedDeckToHand");
  state = applyAction(state, 1, { type: "choose", cardIds: ["debut"] }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "groupedDeckToHand");
  state = applyAction(state, 1, { type: "choose", cardIds: ["fan"] }, cards, () => 0.5);
  assert.deepEqual(state.players[1].hand.map((card) => card.id).sort(), ["debut", "fan"]);
});

test("Koyori Bloom returns Assistant cards from archive", () => {
  const host = player("Host", {
    hand: [instance("bloom", "hEB01-022")],
    archive: [instance("assistant1", "hBP04-105"), instance("assistant2", "hBP04-105")],
  });
  host.zones.back1 = stageUnit("debut", "hEB01-018");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "bloom" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.pendingChoice.effect, "archiveAssistants");
  state = applyAction(state, 0, { type: "choose", cardIds: ["assistant1", "assistant2"] }, cards);
  assert.equal(state.players[0].hand.filter((card) => card.number === "hBP04-105").length, 2);
  assert.equal(state.players[0].archive.length, 0);
});

test("Koyori 2nd Bloom orders four archived Koyori, then attaches the clicked KoyoLab support", () => {
  const host = player("Host", {
    hand: [instance("bloom", "hEB01-023")],
    archive: [instance("k1", "hEB01-018"), instance("k2", "hEB01-019"), instance("k3", "hEB01-020"), instance("k4", "hEB01-022"), instance("tool", "hEB01-034")],
  });
  host.zones.center = stageUnit("first", "hEB01-020");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "bloom" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.pendingChoice.effect, "koyoriBottom");
  state = applyAction(state, 0, { type: "choose", cardIds: ["k3", "k1", "k4", "k2"] }, cards);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["k3", "k1", "k4", "k2"]);
  assert.equal(state.pendingChoice.effect, "chooseArchiveSupportForAttach");
  state = applyAction(state, 0, { type: "choose", cardIds: ["tool"] }, cards);
  assert.equal(state.pendingChoice.type, "attachArchivedSupport");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.attachments[0].id, "tool");
});

test("Koyori Collab groups every Assistant heal into one allocation", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001")] });
  host.zones.center = stageUnit("center", "hEB01-018", { damage: 40, attachments: [instance("a1", "hBP04-105")] });
  host.zones.back1 = stageUnit("collab", "hEB01-021", { attachments: [instance("a2", "hBP04-105")] });
  host.zones.back2 = stageUnit("back", "hEB01-018", { damage: 20 });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "collab", zone: "back1" }, cards);
  assert.equal(state.pendingChoice.type, "healDistribution");
  assert.equal(state.pendingChoice.count, 2);
  state = applyAction(state, 0, { type: "choose", allocations: { center: 1, back2: 1 } }, cards);
  assert.equal(state.players[0].zones.center.damage, 20);
  assert.equal(state.players[0].zones.back2.damage, 0);
});

test("starter Koyori Collab draws when the Center is holoX and hand count is at most five", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001"), instance("draw", "SUPPORT-001")] });
  host.zones.center = stageUnit("center", "hEB01-018");
  host.zones.back1 = stageUnit("collab", "hSD06-008");
  const state = applyAction(playingState(host, player("Guest")), 0, { type: "collab", zone: "back1" }, cards);
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["draw"]);
  assert.deepEqual(state.players[0].holoPower.map((card) => card.id), ["power"]);
});

test("Koyori Oshi skill pays power, reveals with Assistant bonus and grants Arts +30", () => {
  const host = player("Host", {
    oshi: instance("oshi", "hEB01-003"),
    holoPower: [instance("p1", "SUPPORT-001"), instance("p2", "SUPPORT-001")],
    mainDeck: [instance("debut", "hEB01-018"), instance("first", "hEB01-020"), instance("second", "hEB01-024")],
  });
  host.zones.center = stageUnit("source", "hEB01-018", { cheer: [instance("pay", "CHEER-001"), instance("pay2", "CHEER-001")], attachments: [instance("assistant", "hBP04-105")] });
  host.zones.collab = stageUnit("white-source", "hBP04-012", { cheer: [instance("white-pay", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.players[0].holoPower.length, 0);
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[0].koyoriArtsBonusTurn, 3);
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards, () => 0.5);
  assert.equal(state.players[1].zones.center.damage, 70, "base 20 + KoyoLab 20 + Oshi 30");
  state = applyAction(state, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, cards, () => 0.5);
  assert.equal(state.players[1].zones.center.damage, 130, "the Oshi +30 also applies to white Hakui Koyori");
});

test("birthday Oshi templates use table clicks and the SP skill searches the matching color", () => {
  const host = player("Host", {
    oshi: instance("birthday", "hBD24-001"),
    holoPower: [instance("power-1", "SUPPORT-001"), instance("power-2", "SUPPORT-001"), instance("power-3", "SUPPORT-001"), instance("power-4", "SUPPORT-001")],
    mainDeck: [instance("green-search", "GREEN-002")],
  });
  host.zones.center = stageUnit("green", "GREEN-001");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "oshiSkill" }, cards);
  assert.equal(state.pendingChoice.type, "stageTarget");
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.modifiers[0].amount, 20);
  state = applyAction(state, 0, { type: "spOshiSkill" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckToHandShuffle");
  state = applyAction(state, 0, { type: "choose", cardIds: ["green-search"] }, cards, () => 0.5);
  assert.equal(state.players[0].hand[0].id, "green-search");
  assert.equal(state.players[0].spOshiSkillUsed, true);
});

test("reactive Oshi damage reduction pauses for the defender and applies before damage", () => {
  const host = player("Host");
  host.zones.center = stageUnit("attacker", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest", { oshi: instance("mumei", "hBP01-002"), holoPower: [instance("power-old", "SUPPORT-001"), instance("power-new", "SUPPORT-001")] });
  guest.zones.center = stageUnit("promise", "PROMISE-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.pendingChoice.type, "optionChoice");
  assert.equal(state.pendingChoice.playerIndex, 1);
  state = applyAction(state, 1, { type: "choose", optionId: "normal:50" }, cards);
  assert.equal(state.players[1].zones.center.damage, 0);
  assert.equal(state.players[1].oshiSkillTurn, 3);
});

test("Kokoro records its conditional Arts bonus when its Koyori performs Collab", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001")] });
  host.zones.back1 = stageUnit("source", "hEB01-018", { cheer: [instance("pay", "CHEER-001")], attachments: [instance("mascot", "hBP04-100")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "collab", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.collab.koyoriMascotBonusTurn, 3);
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 50, "20 base + 20 KoyoLab + 10 Collab mascot trigger");
});

test("Bloom Stage permits one extra same-turn Bloom after drawing two", () => {
  const host = player("Host", {
    life: Array.from({ length: 4 }, (_, index) => instance(`life${index}`, "CHEER-001")),
    hand: [instance("event", "hBP06-090"), instance("second", "hEB01-024")],
    mainDeck: [instance("draw1", "SUPPORT-001"), instance("draw2", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("debut", "hEB01-018", { stack: [instance("debut", "hEB01-018"), instance("first", "hEB01-020")], bloomedTurn: 3 });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "event" }, cards);
  assert.equal(state.players[0].bonusBloomTurn, 3);
  assert.equal(state.pendingChoice.effect, "bonusBloomCard");
  state = applyAction(state, 0, { type: "choose", cardIds: ["second"] }, cards);
  assert.equal(state.pendingChoice.type, "bonusBloomTarget");
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[0].zones.center.stack.at(-1).number, "hEB01-024");
  assert.equal(state.players[0].bonusBloomUsedTurn, 3);
});

test("Koyori 2nd distributes one 20 HP heal for every revealed Holomen", () => {
  const host = player("Host", {
    oshi: instance("oshi", "hEB01-003"),
    mainDeck: [instance("r1", "hEB01-018"), instance("r2", "hEB01-020"), instance("r3", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("source", "hEB01-024", { cheer: [instance("yellow", "CHEER-002"), instance("white1", "CHEER-001"), instance("white2", "CHEER-001")], attachments: [instance("a1", "hBP04-105"), instance("a2", "hBP04-105")] });
  host.zones.back1 = stageUnit("hurt", "hEB01-018", { damage: 40 });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards, () => 0.5);
  const revealLog = state.log.find((entry) => entry.message.includes("展示"));
  assert.deepEqual(revealLog.cardRefs.map((card) => card.id), ["r1", "r2", "r3"]);
  assert.deepEqual(revealLog.revealRefs.map((card) => card.id), ["r1", "r2", "r3"], "all revealed cards share one immutable popup batch");
  assert.equal(state.players[1].zones.center.damage, 0, "Arts text resolves before damage");
  assert.equal(state.pendingChoice.type, "healDistribution");
  assert.equal(state.pendingChoice.count, 2);
  state = applyAction(state, 0, { type: "choose", allocations: { back1: 2 } }, cards);
  assert.equal(state.players[0].zones.back1.damage, 0);
  assert.equal(state.players[1].zones.center.damage, 160, "120 base + 2 revealed Holomen × 20");
});

test("Koyori Arts reveal bonuses and draw-to-Assistant count resolve automatically", () => {
  const host = player("Host", { oshi: instance("oshi", "hEB01-003"), mainDeck: [instance("member", "hEB01-018"), instance("other", "SUPPORT-001"), instance("draw3", "SUPPORT-001")] });
  host.zones.center = stageUnit("source", "hEB01-020", { cheer: [instance("yellow", "CHEER-002"), instance("white", "CHEER-001")] });
  host.zones.back1 = stageUnit("assistants", "hEB01-018", { attachments: [instance("a1", "hBP04-105"), instance("a2", "hBP04-105"), instance("a3", "hBP04-105")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 1, targetZone: "center" }, cards, () => 0.5);
  assert.equal(state.players[1].zones.center.damage, 60, "50 base + one revealed Holomen");

  state.players[0].zones.center = stageUnit("draw-source", "hEB01-023", { cheer: [instance("p1", "CHEER-001"), instance("p2", "CHEER-001")] });
  state.players[0].hand = [];
  state.players[0].mainDeck = [instance("d1", "SUPPORT-001"), instance("d2", "SUPPORT-001"), instance("d3", "SUPPORT-001")];
  state.players[0].zones.center.rested = false;
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[0].hand.length, 3);
});

test("Koyori 1st Arts gains +20 while any 2nd is on the stage", () => {
  const host = player("Host");
  host.zones.center = stageUnit("source", "hEB01-022", { cheer: [instance("pay", "CHEER-002")] });
  host.zones.back1 = stageUnit("second", "hEB01-024");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  const state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.players[1].zones.center.damage, 50);
});

test("Koyori top-three Arts lets the player order all cards when no search target exists", () => {
  const host = player("Host", { mainDeck: [instance("one", "SUPPORT-001"), instance("two", "SUPPORT-001"), instance("three", "SUPPORT-001")] });
  host.zones.center = stageUnit("source", "hBP04-009", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.pendingChoice.effect, "bottomOrder");
  state = applyAction(state, 0, { type: "choose", cardIds: ["three", "one", "two"] }, cards);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["three", "one", "two"]);
});

test("Assistant Arts selects the archive card, then the actual other Koyori on the table", () => {
  const host = player("Host", { archive: [instance("assistant1", "hBP04-105"), instance("assistant2", "hBP04-105")] });
  host.zones.center = stageUnit("source", "hBP04-011", { cheer: [instance("pay", "CHEER-001")] });
  host.zones.back1 = stageUnit("target-koyori", "hEB01-018");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.pendingChoice.effect, "chooseArchivedAssistantForAttach");
  state = applyAction(state, 0, { type: "choose", cardIds: ["assistant2"] }, cards);
  assert.equal(state.pendingChoice.type, "attachArchivedSupport");
  assert.deepEqual(state.pendingChoice.options, ["back1"]);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.back1.attachments[0].id, "assistant2");
  assert.equal(state.pendingChoice.type, "moveCheer");
  state = applyAction(state, 0, { type: "choose", cheerId: "pay" }, cards);
  assert.equal(state.players[0].zones.center.cheer.length, 0);
  assert.equal(state.players[0].zones.back1.cheer[0].id, "pay");
});

test("Koyori Bloom search and Assistant Arts draw chain through hand and table clicks", () => {
  const host = player("Host", {
    hand: [instance("bloom", "hBP04-012")],
    mainDeck: [instance("assistant", "hBP04-105"), instance("draw", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("debut", "hBP04-009", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "bloom" }, cards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckToHandShuffle");
  state = applyAction(state, 0, { type: "choose", cardIds: ["assistant"] }, cards, () => 0.5);
  state = applyAction(state, 0, { type: "play", cardId: "assistant" }, cards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  state.phase = "performance";
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.ok(state.players[0].hand.some((card) => card.id === "draw"));
});

test("summer Koyori Gift returns the clicked KoyoLab attachment only on the opponent turn", () => {
  const host = player("Host");
  host.zones.center = stageUnit("attacker", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest", { life: [instance("l1", "CHEER-001"), instance("l2", "CHEER-001")] });
  guest.zones.center = stageUnit("defender", "hEB01-018", { damage: 100, attachments: [instance("tool", "hEB01-034")] });
  guest.zones.back1 = stageUnit("survivor", "hEB01-019");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.pendingChoice.effect, "returnArchivedToHand");
  state = applyAction(state, 1, { type: "choose", cardIds: ["tool"] }, cards);
  assert.equal(state.players[1].hand[0].id, "tool");
  assert.equal(state.pendingChoice.type, "lifeCheerTarget");
  state = applyAction(state, 1, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.back1.cheer[0].id, "l2", "the newest Life is attached");
  assert.equal(state.players[1].life.length, 1);
});

test("the last Life Cheer still uses a table click before the loss is finalized", () => {
  const host = player("Host");
  host.zones.center = stageUnit("attacker", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("Guest", { life: [instance("last-life", "CHEER-002")] });
  guest.zones.center = stageUnit("defender", "DEBUT-001", { damage: 80 });
  guest.zones.back1 = stageUnit("survivor", "DEBUT-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, cards);
  assert.equal(state.status, "playing");
  assert.equal(state.pendingChoice.type, "lifeCheerTarget");
  state = applyAction(state, 1, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.back1.cheer[0].id, "last-life");
  assert.equal(state.status, "finished");
  assert.equal(state.winner, 0);
});

test("knockout and Life attachment logs preserve exact card codes and printings", () => {
  const host = player("Host");
  host.zones.center = stageUnit("attacker", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
  const guest = player("AIこより · EXPERT", { life: [instance("life-one", "CHEER-001"), instance("life-two", "CHEER-002")] });
  guest.zones.center = stageUnit("defender", "hEB01-024", {
    stack: [{ id: "defender", number: "hEB01-024", variantId: "heb01-hEB01-024-SR-3" }],
    damage: 190,
  });
  guest.zones.back1 = stageUnit("survivor", "hEB01-020", {
    stack: [{ id: "survivor", number: "hEB01-020", variantId: "heb01-hEB01-020-SR-2" }],
  });
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  const knockoutLog = state.log.find((entry) => entry.message.includes("倒下，生命 -1"));
  assert.match(knockoutLog.message, /hEB01-024/);
  assert.deepEqual(knockoutLog.cardRefs, [{ id: "defender", number: "hEB01-024", variantId: "heb01-hEB01-024-SR-3" }]);
  assert.deepEqual(knockoutLog.revealRefs, []);
  const lifeRevealLog = state.log.find((entry) => entry.message.includes("公開生命"));
  assert.deepEqual(lifeRevealLog.revealRefs, [{ id: "life-two", number: "CHEER-002" }]);

  state = applyAction(state, 1, { type: "choose", zone: "back1" }, effectCards);
  const attachLog = state.log.find((entry) => entry.message.includes("公開的生命應援附加到"));
  assert.match(attachLog.message, /hEB01-020/);
  assert.deepEqual(attachLog.cardRefs, [{ id: "survivor", number: "hEB01-020", variantId: "heb01-hEB01-020-SR-2" }]);
  assert.deepEqual(attachLog.revealRefs, attachLog.cardRefs);
});

test("Drawing Stream selects an actual Cheer, table target, then archived Art holomem", () => {
  const host = player("Host", {
    hand: [instance("event", "hBP06-089")],
    cheerDeck: [instance("white", "CHEER-001"), instance("yellow", "CHEER-002")],
    archive: [instance("artist", "ART-001")],
  });
  host.zones.center = stageUnit("stage-artist", "ART-001");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "event" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "drawingStreamCheer");
  state = applyAction(state, 0, { type: "choose", cardIds: ["yellow"] }, cards, () => 0.5);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  assert.equal(state.pendingChoice.cardNumber, "CHEER-002");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards, () => 0.5);
  assert.equal(state.players[0].zones.center.cheer[0].id, "yellow");
  assert.equal(state.pendingChoice.effect, "archiveToHand");
  state = applyAction(state, 0, { type: "choose", cardIds: ["artist"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "artist"));
});

test("Drawing Stream requires available Cheer before archived Art recovery", () => {
  const host = player("Host", {
    hand: [instance("event", "hBP06-089")],
    cheerDeck: [instance("white", "CHEER-001")],
    archive: [instance("artist", "ART-001")],
  });
  host.zones.center = stageUnit("stage-artist", "ART-001");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "event" }, cards, () => 0.5);
  assert.throws(() => applyAction(state, 0, { type: "choose", skip: true }, cards, () => 0.5));
  state = applyAction(state, 0, { type: "choose", cardIds: ["white"] }, cards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards, () => 0.5);
  assert.equal(state.players[0].zones.center.cheer.length, 1);
  assert.equal(state.pendingChoice.effect, "archiveToHand");
  state = applyAction(state, 0, { type: "choose", cardIds: ["artist"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "artist"));
});

test("Waiting Call makes the opponent click their own Back card and does not trigger Collab", () => {
  const host = player("Host", { hand: [instance("event", "hBP03-088")], life: [instance("h1", "CHEER-001")] });
  host.zones.center = stageUnit("host", "DEBUT-001");
  const guest = player("Guest", { life: [instance("g1", "CHEER-001"), instance("g2", "CHEER-001")] });
  guest.zones.center = stageUnit("guest", "DEBUT-001");
  guest.zones.back1 = stageUnit("forced", "hEB01-019");
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "event" }, cards);
  assert.equal(state.pendingChoice.playerIndex, 1);
  assert.equal(publicRoomState(state, 0).pendingChoice.type, "opponent");
  assert.equal(publicRoomState(state, 1).pendingChoice.type, "forcedCollab");
  state = applyAction(state, 1, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[1].zones.collab.stack[0].id, "forced");
  assert.equal(state.players[1].zones.collab.collabbedTurn, 0);
  assert.equal(state.players[1].holoPower.length, 0);
});

test("Waiting Call remains usable when its movement cannot change the opponent stage", () => {
  const host = player("Host", { hand: [instance("event", "hBP03-088")], life: [instance("h1", "CHEER-001")] });
  host.zones.center = stageUnit("host", "DEBUT-001");
  const guest = player("Guest", { life: [instance("g1", "CHEER-001"), instance("g2", "CHEER-001")] });
  guest.zones.center = stageUnit("guest", "DEBUT-001");
  guest.zones.collab = stageUnit("occupied", "DEBUT-001");
  const state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "event" }, cards);
  assert.equal(state.pendingChoice, null);
  assert.ok(state.players[0].archive.some((card) => card.id === "event"));
  assert.equal(state.players[1].zones.collab.stack[0].id, "occupied");
});

test("SorAZ Celebration searches a 1st then preserves the clicked bottom order", () => {
  const host = player("Host", {
    hand: [instance("event", "hBP05-080")],
    mainDeck: [instance("draw1", "SUPPORT-001"), instance("draw2", "SUPPORT-001"), instance("one", "SUPPORT-001"), instance("first", "hEB01-020"), instance("two", "SUPPORT-001"), instance("three", "SUPPORT-001"), instance("four", "SUPPORT-001")],
  });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "event" }, cards);
  assert.equal(state.pendingChoice.effect, "sorazPick");
  state = applyAction(state, 0, { type: "choose", cardIds: ["first"] }, cards);
  assert.equal(state.pendingChoice.effect, "bottomOrder");
  state = applyAction(state, 0, { type: "choose", cardIds: ["four", "two", "one", "three"] }, cards);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["four", "two", "one", "three"]);
  assert.ok(state.players[0].hand.some((card) => card.id === "first"));
});

test("HoloX event finds two available cards, then uses a table click for optional top Cheer", () => {
  const host = player("Host", {
    hand: [instance("event", "hBP06-093")],
    mainDeck: [instance("x1", "hEB01-018"), instance("x2", "hEB01-019"), instance("other", "SUPPORT-001")],
    cheerDeck: [instance("cheer", "CHEER-001")],
  });
  host.zones.center = stageUnit("center", "hEB01-018");
  const guest = player("Guest");
  guest.zones.center = stageUnit("guest", "DEBUT-001", { cheer: [instance("g1", "CHEER-001"), instance("g2", "CHEER-001")] });
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "event" }, cards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "holoXSearch");
  state = applyAction(state, 0, { type: "choose", cardIds: ["x1", "x2"] }, cards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "x2"));
  assert.ok(state.players[0].hand.some((card) => card.id === "x1"));
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards, () => 0.5);
  assert.equal(state.players[0].zones.center.cheer[0].id, "cheer");
});

test("Green Test Tube archives the clicked Cheer then readies a rested holoX Holomen", () => {
  const host = player("Host");
  host.zones.center = stageUnit("source", "hEB01-020", { cheer: [instance("cost", "CHEER-001")], attachments: [instance("tube", "hBP04-097")] });
  host.zones.back1 = stageUnit("target", "hEB01-018", { rested: true });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "attachmentSkill", zone: "center" }, cards);
  assert.equal(state.pendingChoice.type, "archiveCheerForSkill");
  state = applyAction(state, 0, { type: "choose", cheerId: "cost" }, cards);
  assert.equal(state.pendingChoice.type, "unrestTarget");
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.players[0].zones.back1.rested, false);
  assert.ok(state.players[0].archive.some((card) => card.id === "cost"));
});

test("Anything Solved may deal 30 special damage at Performance end", () => {
  const host = player("Host");
  host.zones.center = stageUnit("source", "hEB01-024", { attachments: [instance("tool", "hEB01-034")] });
  const guest = player("Guest", { mainDeck: [instance("draw", "SUPPORT-001")], life: [instance("l1", "CHEER-001"), instance("l2", "CHEER-001")] });
  guest.zones.center = stageUnit("target", "hEB01-018", { damage: 90 });
  guest.zones.back1 = stageUnit("survivor", "hEB01-019");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "advance" }, cards);
  assert.equal(state.pendingChoice.type, "endToolDamage");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, cards);
  assert.equal(state.players[1].life.length, 1);
  assert.equal(state.players[0].archive.some((card) => card.id === "tool"), true);
  assert.equal(state.pendingChoice.type, "lifeCheerTarget");
  state = applyAction(state, 1, { type: "choose", zone: "back1" }, cards);
  assert.equal(state.activePlayer, 1);
});

test("Nene Arts with Girafa deals Arts damage to both Center and Collab", () => {
  const host = player("Host");
  host.zones.center = stageUnit("nene", "hBP07-081", {
    cheer: [instance("y1", "CHEER-002"), instance("y2", "CHEER-002")],
    attachments: [instance("girafa", "hBP07-103")],
  });
  const guest = player("Guest");
  guest.zones.center = stageUnit("center-target", "TARGET-001");
  guest.zones.collab = stageUnit("collab-target", "TARGET-001");
  const state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(state.players[1].zones.center.damage, 50);
  assert.equal(state.players[1].zones.collab.damage, 50);
});

test("Nene over-cheer Arts moves the clicked opposing Cheer to the bottom", () => {
  const host = player("Host");
  host.zones.center = stageUnit("nene", "hBP07-083", { cheer: [instance("y1", "CHEER-002"), instance("y2", "CHEER-002"), instance("y3", "CHEER-002")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("center-target", "TARGET-001", { cheer: [instance("center-cheer", "CHEER-001")] });
  guest.zones.collab = stageUnit("collab-target", "TARGET-001", { cheer: [instance("collab-cheer", "CHEER-002")] });
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(state.pendingChoice.type, "stageCheerSelection");
  assert.equal(state.pendingChoice.ownerIndex, 1);
  state = applyAction(state, 0, { type: "choose", cheerId: "collab-cheer" }, effectCards);
  assert.equal(state.players[1].zones.collab.cheer.length, 0);
  assert.equal(state.players[1].cheerDeck.at(-1).id, "collab-cheer");
  assert.equal(state.players[1].zones.center.damage, 100);
});

test("Sora Arts grants another Sora a table-click attack against a Back 2nd", () => {
  const host = player("Host", { oshi: instance("sora-oshi", "hSD01-001") });
  host.zones.center = stageUnit("other-sora", "hBP08-016", { cheer: [instance("center-pay", "CHEER-001")] });
  host.zones.collab = stageUnit("source-sora", "hBP08-018", { cheer: [instance("p1", "CHEER-001"), instance("p2", "CHEER-001"), instance("p3", "CHEER-001"), instance("p4", "CHEER-001")] });
  const guest = player("Guest");
  guest.zones.center = stageUnit("center-target", "TARGET-001");
  guest.zones.back1 = stageUnit("back-second", "SECOND-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "artAttackSecondBack");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.ok(state.players[0].zones.center.modifiers.some((modifier) => modifier.kind === "attackSecondBack"));
  state = applyAction(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "back1" }, effectCards);
  assert.equal(state.players[1].zones.back1.damage, 30);
});

test("Fubuki Cafe distributes every selected archived character attachment by table clicks", () => {
  const host = player("Host", { archive: [instance("mascot", "hBP02-089"), instance("fan", "hBP02-099")] });
  host.zones.center = stageUnit("fubuki", "hBP05-070", { cheer: [instance("p1", "CHEER-001"), instance("p2", "CHEER-001")] });
  host.zones.back1 = stageUnit("friend", "DEBUT-001");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest, { phase: "performance" }), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "artArchiveAttachmentsDistribute");
  state = applyAction(state, 0, { type: "choose", cardIds: ["mascot", "fan"] }, effectCards);
  assert.equal(state.pendingChoice.type, "attachArchivedSupport");
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.type, "attachArchivedSupport");
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[0].zones.back1.attachments[0].id, "mascot");
  assert.equal(state.players[0].zones.center.attachments[0].id, "fan");
});

test("AZKi Oshi searches an Event only after a knockout in the previous opposing turn", () => {
  const host = player("Host", { oshi: instance("azki-oshi", "hBP07-006"), holoPower: [instance("azki-power", "SUPPORT-001")], mainDeck: [instance("event", "hBP01-106"), instance("other", "SUPPORT-001")] });
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const guest = player("Guest");
  guest.zones.center = stageUnit("guest-center", "DEBUT-001");
  const base = playingState(host, guest, { knockouts: [{ turn: 2, ownerIndex: 0, sourcePlayerIndex: 1, card: { number: "DEBUT-001", name: "Test Talent" } }] });
  let state = applyAction(base, 0, { type: "oshiSkill" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckToHandShuffle");
  state = applyAction(state, 0, { type: "choose", cardIds: ["event"] }, effectCards, () => 0.5);
  assert.ok(state.players[0].hand.some((card) => card.id === "event"));

  const invalid = playingState(player("NoKO", { oshi: instance("azki-oshi-2", "hBP07-006"), holoPower: [instance("azki-power-2", "SUPPORT-001")] }), player("Guest2"));
  assert.throws(() => applyAction(invalid, 0, { type: "oshiSkill" }, effectCards), /沒有被擊倒/);
});

test("Kiara Bloom archives every selected Kiara from the deck before shuffling", () => {
  const host = player("Host", {
    hand: [instance("bloom", "hBP03-036")],
    mainDeck: [instance("kiara-1", "hBP01-064"), instance("other", "SUPPORT-001"), instance("kiara-2", "hBP08-041")],
  });
  host.zones.center = stageUnit("debut", "hBP01-062");
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "bloom" }, effectCards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "kiaraReveal");
  state = applyAction(state, 0, { type: "choose", cardIds: ["kiara-1", "kiara-2"] }, effectCards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", optionId: "archive" }, effectCards, () => 0.5);
  assert.deepEqual(state.players[0].archive.map((card) => card.id).sort(), ["kiara-1", "kiara-2"]);
  assert.deepEqual(state.players[0].mainDeck.map((card) => card.id), ["other"]);
});

test("Moona Collab uses a table click and repeats the target's current damage as special damage", () => {
  const host = player("Host", { mainDeck: [instance("power", "SUPPORT-001")] });
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  host.zones.back1 = stageUnit("moona", "hBP06-053");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target", "TARGET-001", { damage: 40 });
  let state = applyAction(playingState(host, guest), 0, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.effect, "specialDamageEqualCurrentDamage");
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[1].zones.center.damage, 80);
});

test("Gigi first-turn Collab places the selected Justice 1st through a table slot click", () => {
  const host = player("Host", { turnsTaken: 1 });
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const guest = player("Guest", {
    turnsTaken: 1,
    mainDeck: [instance("power", "SUPPORT-001"), instance("justice", "hBP04-017")],
  });
  guest.zones.center = stageUnit("guest-center", "DEBUT-001");
  guest.zones.back1 = stageUnit("gigi", "hSD13-009");
  let state = applyAction(playingState(host, guest, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckCardsToStage");
  state = applyAction(state, 1, { type: "choose", cardIds: ["justice"] }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "placeCard");
  state = applyAction(state, 1, { type: "choose", zone: "back1" }, effectCards, () => 0.5);
  assert.equal(state.players[1].zones.back1.stack[0].id, "justice");
  assert.equal(state.players[1].zones.back1.stack.length, 1, "the 1st enters directly instead of Blooming");
});

test("Suu first-turn Collab logs the base draw separately from the opponent Baton bonus", () => {
  const host = player("Host");
  host.zones.center = stageUnit("host-center", "hBP01-014");
  const guest = player("Guest", {
    turnsTaken: 1,
    mainDeck: [instance("power", "SUPPORT-001"), instance("draw-1", "SUPPORT-001"), instance("draw-2", "SUPPORT-001"), instance("draw-3", "SUPPORT-001")],
  });
  guest.zones.center = stageUnit("guest-center", "DEBUT-001");
  guest.zones.back1 = stageUnit("suu", "hBP08-047");
  const state = applyAction(playingState(host, guest, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.players[1].hand.length, 3);
  assert.ok(state.log.some((entry) => /先抽 1 張.*費用 2.*額外抽 2 張.*合共 3 張/u.test(entry.message)));
});

test("Suu knockout Gift triggers only on a real knockout in the opposing turn and targets Back only", () => {
  const makeState = (damage) => {
    const host = player("Host");
    host.zones.center = stageUnit("attacker", "DEBUT-001", { cheer: [instance("pay", "CHEER-001")] });
    const guest = player("Guest", { cheerDeck: [instance("gift-cheer", "CHEER-002")], life: [instance("life", "CHEER-001")] });
    guest.zones.center = stageUnit("suu", "hBP08-050", { damage });
    guest.zones.back1 = stageUnit("survivor", "DEBUT-001");
    return playingState(host, guest, { phase: "performance" });
  };

  const nonlethal = applyAction(makeState(130), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(nonlethal.players[1].zones.center.damage, 150);
  assert.equal(nonlethal.pendingChoice, null);
  assert.equal(nonlethal.players[1].cheerDeck.length, 1);

  let lethal = applyAction(makeState(140), 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, effectCards);
  assert.equal(lethal.pendingChoice.type, "eventCheerTarget");
  assert.deepEqual(lethal.pendingChoice.options, ["back1"]);
  lethal = applyAction(lethal, 1, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(lethal.players[1].zones.back1.cheer[0].id, "gift-cheer");
  assert.equal(lethal.pendingChoice.type, "lifeCheerTarget");
});

test("Watame Bloom damages the clicked Center or Collab before the opponent draws", () => {
  const host = player("Host", { hand: [instance("bloom", "hBP07-012")] });
  host.zones.center = stageUnit("debut", "hBP07-008");
  const guest = player("Guest", { mainDeck: [instance("opponent-draw", "SUPPORT-001")] });
  guest.zones.center = stageUnit("target", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "specialDamageThenOpponentDraw");
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[1].zones.center.damage, 30);
  assert.equal(state.players[1].hand[0].id, "opponent-draw");
  assert.equal(state.players[0].hand.length, 0);
});

test("Lamy Bloom requires Snowpeople and changes only its draw count at three attachments", () => {
  const resolve = (snowpeople) => {
    const host = player("Host", { hand: [instance("bloom", "hBP06-054")], mainDeck: [instance("draw-1", "SUPPORT-001"), instance("draw-2", "SUPPORT-001")] });
    host.zones.center = stageUnit("lamy", "hBP04-045", { attachments: Array.from({ length: snowpeople }, (_, index) => instance(`snow-${index}`, "hBP04-106")) });
    const guest = player("Guest");
    guest.zones.center = stageUnit("target", "TARGET-001");
    let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "bloom" }, effectCards);
    return applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  };
  const none = resolve(0);
  assert.equal(none.players[1].zones.center.damage, 0);
  assert.equal(none.players[0].hand.length, 0);
  const one = resolve(1);
  assert.equal(one.players[1].zones.center.damage, 30, "the attached Snowperson adds its own +10 special-damage modifier");
  assert.equal(one.players[0].hand.length, 1);
  const three = resolve(3);
  assert.equal(three.players[1].zones.center.damage, 50, "three Snowpeople add +30 to the Bloom effect's base 20");
  assert.equal(three.players[0].hand.length, 2);
});

test("Zeta and Chihaya Bloom effects restrict their searches and table targets", () => {
  const zeta = player("Zeta", { hand: [instance("bloom", "hBP07-019")], mainDeck: [instance("bazo", "hBP07-105"), instance("other", "SUPPORT-001")] });
  zeta.zones.center = stageUnit("zeta-debut", "hBP07-015");
  let state = applyAction(playingState(zeta, player("Guest")), 0, { type: "play", cardId: "bloom" }, effectCards, () => 0.5);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckSupportToAttach");
  state = applyAction(state, 0, { type: "choose", cardIds: ["bazo"] }, effectCards, () => 0.5);
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards, () => 0.5);
  assert.equal(state.players[0].zones.center.attachments[0].id, "bazo");

  const chihaya = player("Chihaya", { hand: [instance("bloom", "hBP07-033")] });
  chihaya.zones.center = stageUnit("debut", "hBP07-032");
  chihaya.zones.back1 = stageUnit("not-bloomed", "hSD10-002");
  state = applyAction(playingState(chihaya, player("Guest2")), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[0].zones.center.modifiers.at(-1).amount, 30);
  assert.equal(state.players[0].zones.back1.modifiers.length, 0);
});

test("Niko counterattack Bloom checks the previous opposing turn and is once per turn", () => {
  const host = player("Host", {
    hand: [instance("bloom-1", "hBP07-089"), instance("bloom-2", "hBP07-089")],
    mainDeck: [instance("draw-1", "SUPPORT-001"), instance("draw-2", "SUPPORT-001"), instance("draw-3", "SUPPORT-001"), instance("draw-4", "SUPPORT-001")],
  });
  host.zones.center = stageUnit("debut-1", "hBP07-087");
  host.zones.back1 = stageUnit("debut-2", "hBP07-087");
  const knockout = { turn: 2, ownerIndex: 0, sourcePlayerIndex: 1, card: { number: "hBP07-087", name: "虎金妃笑虎", tags: ["#FLOW GLOW"] } };
  let state = applyAction(playingState(host, player("Guest"), { knockouts: [knockout] }), 0, { type: "play", cardId: "bloom-1" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[0].hand.length, 3);
  state = applyAction(state, 0, { type: "play", cardId: "bloom-2" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(state.players[0].hand.length, 2, "the second copy must not draw again in the same turn");
});

test("Aki parfait Bloom offers only Aki with a Tool and applies the 20/50 replacement", () => {
  const host = player("Host", { hand: [instance("bloom", "hBP08-028")] });
  host.zones.center = stageUnit("aki-debut", "hBP01-032", { attachments: [instance("tool-1", "TOOL-001")] });
  host.zones.back1 = stageUnit("aki-buzz", "hBP03-022", { attachments: [instance("tool-2", "TOOL-001")] });
  host.zones.back2 = stageUnit("other", "DEBUT-001", { attachments: [instance("tool-3", "TOOL-001")] });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.deepEqual(state.pendingChoice.options, ["center", "back1"]);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(state.players[0].zones.back1.modifiers.at(-1).amount, 50);
  assert.equal(state.players[0].zones.back2.modifiers.length, 0);
});

test("Sora and Mori Bloom resolve draw-bottom and archive-top literally", () => {
  const sora = player("Sora", { hand: [instance("bloom", "hEB01-007"), instance("keep", "SUPPORT-001")], mainDeck: [instance("drawn", "SUPPORT-001")] });
  sora.zones.center = stageUnit("debut", "hEB01-004");
  let state = applyAction(playingState(sora, player("Guest")), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "handToBottom");
  assert.ok(state.pendingChoice.selectableIds.includes("drawn"));
  state = applyAction(state, 0, { type: "choose", cardIds: ["drawn"] }, effectCards);
  assert.equal(state.players[0].mainDeck.at(-1).id, "drawn");
  assert.deepEqual(state.players[0].hand.map((card) => card.id), ["keep"]);

  const mori = player("Mori", { hand: [instance("bloom", "hSD18-008")], mainDeck: [instance("archived", "SUPPORT-001")] });
  mori.zones.center = stageUnit("mori-debut", "hSD18-002");
  state = applyAction(playingState(mori, player("Guest2")), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[0].archive[0].id, "archived");
  assert.equal(state.players[0].hand.length, 0);
});

test("Ollie and Bae Collab draw first, then require the correct archive cost", () => {
  const ollie = player("Ollie", { hand: [instance("keep", "SUPPORT-001")], mainDeck: [instance("power", "SUPPORT-001"), instance("drawn", "SUPPORT-001")] });
  ollie.zones.center = stageUnit("center", "DEBUT-001");
  ollie.zones.back1 = stageUnit("ollie", "hBP02-049");
  let state = applyAction(playingState(ollie, player("Guest")), 0, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.effect, "handToArchive");
  assert.equal(state.pendingChoice.min, 1);
  state = applyAction(state, 0, { type: "choose", cardIds: ["drawn"] }, effectCards);
  assert.ok(state.players[0].archive.some((card) => card.id === "drawn"));

  const host = player("Host");
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const bae = player("Bae", { turnsTaken: 1, mainDeck: [instance("power", "SUPPORT-001"), instance("draw-1", "SUPPORT-001"), instance("draw-2", "SUPPORT-001"), instance("draw-3", "SUPPORT-001")] });
  bae.zones.center = stageUnit("bae-center", "DEBUT-001");
  bae.zones.back1 = stageUnit("bae", "hBP06-041");
  state = applyAction(playingState(host, bae, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.players[1].hand.length, 3);
  assert.equal(state.pendingChoice.effect, "handToArchive");
  assert.equal(state.pendingChoice.min, 2);
  state = applyAction(state, 1, { type: "choose", cardIds: ["draw-1", "draw-2"] }, effectCards);
  assert.equal(state.players[1].hand.length, 1);
});

test("Watame and IRyS Collab keep their conditional draw clauses separate from their buffs", () => {
  const watame = player("Watame", { mainDeck: [instance("power", "SUPPORT-001"), instance("draw-1", "SUPPORT-001"), instance("draw-2", "SUPPORT-001")] });
  watame.zones.center = stageUnit("watame-center", "hBP07-012", { cheer: Array.from({ length: 6 }, (_, index) => instance(`cheer-${index}`, "CHEER-001")) });
  watame.zones.back1 = stageUnit("watame-collab", "hBP07-013");
  let state = applyAction(playingState(watame, player("Guest")), 0, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.players[0].hand.length, 2);
  assert.equal(state.players[0].zones.center.modifiers.at(-1).amount, 20);
  assert.equal(state.players[0].zones.collab.modifiers.at(-1).amount, 20);

  const host = player("Host");
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const irys = player("IRyS", { turnsTaken: 1, mainDeck: [instance("power", "SUPPORT-001"), instance("draw", "SUPPORT-001")] });
  irys.zones.center = stageUnit("promise", "PROMISE-001", { cheer: [instance("purple", "hY05-010")] });
  irys.zones.back1 = stageUnit("irys", "hBP08-008");
  state = applyAction(playingState(host, irys, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.effect, "addModifier");
  state = applyAction(state, 1, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[1].zones.center.modifiers.at(-1).amount, 30);
  assert.equal(state.players[1].hand[0].id, "draw");
});

test("Koyori Spot branches on the actual Center name", () => {
  const sora = player("Sora", { mainDeck: [instance("power", "SUPPORT-001"), instance("draw", "SUPPORT-001")] });
  sora.zones.center = stageUnit("sora-center", "hEB01-004");
  sora.zones.back1 = stageUnit("spot", "hSD01-015");
  let state = applyAction(playingState(sora, player("Guest")), 0, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.players[0].hand[0].id, "draw");
  assert.equal(state.pendingChoice, null);

  const azki = player("AZKi", { mainDeck: [instance("power", "SUPPORT-001")], cheerDeck: [instance("cheer", "CHEER-002")] });
  azki.zones.center = stageUnit("azki-center", "hBP01-045");
  azki.zones.back1 = stageUnit("spot", "hSD01-015");
  state = applyAction(playingState(azki, player("Guest2")), 0, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.type, "eventCheerTarget");
  assert.deepEqual(state.pendingChoice.options, ["center"]);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[0].zones.center.cheer[0].id, "cheer");
});

test("Summer Sora places up to three unlimited Debuts by table clicks, then bottoms one hand card only at three", () => {
  const host = player("Host");
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const sora = player("Sora", {
    turnsTaken: 1,
    hand: [instance("bottom", "SUPPORT-001")],
    mainDeck: [instance("power", "SUPPORT-001"), instance("sora-1", "hBP01-021"), instance("sora-2", "hBP01-021"), instance("sora-3", "hBP01-021"), instance("other", "SUPPORT-001")],
  });
  sora.zones.center = stageUnit("sora-center", "hEB01-004");
  sora.zones.back1 = stageUnit("summer-sora", "hEB01-005");
  let state = applyAction(playingState(host, sora, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "deckCardsToStage");
  state = applyAction(state, 1, { type: "choose", cardIds: ["sora-1", "sora-2", "sora-3"] }, effectCards, () => 0.5);
  for (const zone of ["back1", "back2", "back3"]) state = applyAction(state, 1, { type: "choose", zone }, effectCards, () => 0.5);
  assert.equal(state.pendingChoice.effect, "handToBottom");
  state = applyAction(state, 1, { type: "choose", cardIds: ["bottom"] }, effectCards, () => 0.5);
  assert.equal(state.players[1].mainDeck.at(-1).id, "bottom");
  assert.deepEqual(["back1", "back2", "back3"].map((zone) => state.players[1].zones[zone].stack[0].id), ["sora-1", "sora-2", "sora-3"]);
});

test("generic single-target Arts buffs use a table click instead of buffing every match", () => {
  const host = player("Host", { hand: [instance("bloom", "hBP03-012")] });
  host.zones.center = stageUnit("luna", "hBP03-009");
  host.zones.back1 = stageUnit("fan-1", "DEBUT-001", { attachments: [instance("attached-1", "hBP03-112")] });
  host.zones.back2 = stageUnit("fan-2", "DEBUT-001", { attachments: [instance("attached-2", "hBP03-112")] });
  let state = applyAction(playingState(host, player("Guest")), 0, { type: "play", cardId: "bloom" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "addModifier");
  assert.deepEqual(state.pendingChoice.options, ["back1", "back2"]);
  state = applyAction(state, 0, { type: "choose", zone: "back2" }, effectCards);
  assert.equal(state.players[0].zones.back1.modifiers.length, 0);
  assert.equal(state.players[0].zones.back2.modifiers.at(-1).amount, 20);
});

test("Niko first-turn Collab pays exactly two top Cheer before its one-target FLOW GLOW buff", () => {
  const host = player("Host");
  host.zones.center = stageUnit("host-center", "DEBUT-001");
  const niko = player("Niko", {
    turnsTaken: 1,
    mainDeck: [instance("power", "SUPPORT-001")],
    cheerDeck: [instance("cost-1", "CHEER-001"), instance("cost-2", "CHEER-002")],
  });
  niko.zones.center = stageUnit("flow-center", "hSD10-002");
  niko.zones.back1 = stageUnit("niko", "hBP07-087");
  let state = applyAction(playingState(host, niko, { activePlayer: 1, firstPlayer: 0, turn: 2 }), 1, { type: "collab", zone: "back1" }, effectCards);
  assert.equal(state.pendingChoice.effect, "genericKeywordCheerDeckCost");
  state = applyAction(state, 1, { type: "choose", optionId: "2" }, effectCards);
  assert.equal(state.players[1].archive.filter((card) => card.id.startsWith("cost-")).length, 2);
  assert.equal(state.pendingChoice.effect, "addModifier");
  assert.deepEqual(state.pendingChoice.options, ["center", "collab"]);
  state = applyAction(state, 1, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.players[1].zones.center.modifiers.at(-1).amount, 20);
  assert.equal(state.players[1].zones.collab.modifiers.length, 0);
});

test("named once-per-turn Bloom damage does not resolve from a second copy", () => {
  const host = player("Host", { hand: [instance("bloom-1", "hBP05-044"), instance("bloom-2", "hBP05-044")] });
  host.zones.center = stageUnit("okayu-1", "hBP05-041");
  host.zones.back1 = stageUnit("okayu-2", "hBP05-042");
  const guest = player("Guest");
  guest.zones.center = stageUnit("target-center", "TARGET-001");
  guest.zones.back1 = stageUnit("target-back", "TARGET-001");
  let state = applyAction(playingState(host, guest), 0, { type: "play", cardId: "bloom-1" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "center" }, effectCards);
  assert.equal(state.pendingChoice.effect, "specialDamage");
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(state.players[1].zones.center.damage, 10);
  assert.equal(state.players[1].zones.back1.damage, 10);
  state = applyAction(state, 0, { type: "play", cardId: "bloom-2" }, effectCards);
  state = applyAction(state, 0, { type: "choose", zone: "back1" }, effectCards);
  assert.equal(state.players[1].zones.center.damage, 10);
  assert.equal(state.players[1].zones.back1.damage, 10);
  assert.equal(state.pendingChoice, null);
});





