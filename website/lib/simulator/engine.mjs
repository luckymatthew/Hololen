import { diceRuns, diceDecision, runDiceAction } from "./dice-actions.mjs";
import { DECK_SEARCH_EFFECTS, EXTENDED_SUPPORT_EFFECTS, SIMPLE_SUPPORT_EFFECTS, TOP_LOOK_EFFECTS } from "./effect-catalog.mjs";
import { isReactiveOshiSkill, oshiSkillPowerCost } from "./oshi-skill-catalog.mjs";

const STAGE_SLOTS = ["center", "collab", "back1", "back2", "back3", "back4", "back5"];
const BACK_SLOTS = STAGE_SLOTS.filter((slot) => slot.startsWith("back"));
const ORDINARY_COMPUTER = "hBP01-104";
const AUTOMATED_EVENT_CARDS = new Set(["hEB01-030", "hBP03-088", "hBP05-080", "hBP06-089", "hBP06-090", "hBP06-093"]);
const ASSISTANT_CARD = "hBP04-105";
const KOYORI_OSHI = "hEB01-003";

function clone(value) {
  return structuredClone(value);
}

function countCards(section) {
  return Object.values(section || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function catalogMap(cards, state = null) {
  const map = new Map(cards.map((card) => [card.number, card]));
  map.gameState = state;
  return map;
}

function secureRandom() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return value / 0x1_0000_0000;
}

function shuffle(input, random = secureRandom) {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function makeInstances(section, owner, printings = {}) {
  const result = [];
  let serial = 0;
  for (const [number, count] of Object.entries(section).sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))) {
    const selectedPrintings = Object.entries(printings?.[number] || {})
      .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
      .flatMap(([variantId, printingCount]) => Array.from({ length: Math.max(0, Number(printingCount) || 0) }, () => variantId));
    for (let copy = 0; copy < count; copy += 1) {
      serial += 1;
      const variantId = selectedPrintings[copy];
      result.push({ id: `${owner}-${serial}-${number}`, number, ...(variantId ? { variantId } : {}) });
    }
  }
  return result;
}

function emptyZones() {
  return Object.fromEntries(STAGE_SLOTS.map((slot) => [slot, null]));
}

function unit(card, turn = 0) {
  return {
    stack: [card],
    cheer: [],
    attachments: [],
    damage: 0,
    rested: false,
    enteredTurn: turn,
    bloomedTurn: 0,
    collabbedTurn: 0,
    koyoriMascotBonusTurn: 0,
    returnSlot: null,
    modifiers: [],
    skipUnrestTurn: 0,
  };
}

function topCard(stageUnit) {
  return stageUnit?.stack?.[stageUnit.stack.length - 1] || null;
}

function removeById(list, id) {
  const index = list.findIndex((card) => card.id === id);
  if (index < 0) return null;
  return list.splice(index, 1)[0];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function snapshotCardRefs(cardRefs = []) {
  return (cardRefs || []).filter(Boolean).map((card) => ({
    id: card.id,
    number: card.number,
    ...(card.variantId ? { variantId: card.variantId } : {}),
  }));
}

function appendLog(state, message, cardRefs = [], options = {}) {
  const refs = snapshotCardRefs(cardRefs);
  const revealed = snapshotCardRefs(Array.isArray(options.revealRefs)
    ? options.revealRefs
    : options.reveal === false
      ? []
      : /(?:公開|展示)/u.test(message)
        ? cardRefs
        : []);
  state.log.unshift({ id: crypto.randomUUID(), at: Date.now(), message, cardRefs: refs, revealRefs: revealed });
}

function normalizeLegacyState(state) {
  if (!Array.isArray(state.effectQueue)) state.effectQueue = [];
  if (!Array.isArray(state.knockouts)) state.knockouts = [];
  if (!Array.isArray(state.lifeLosses)) state.lifeLosses = [];
  if (!Array.isArray(state.log)) state.log = [];
  state.log.forEach((entry) => {
    entry.cardRefs = snapshotCardRefs(entry.cardRefs || []);
    entry.revealRefs = snapshotCardRefs(Array.isArray(entry.revealRefs)
      ? entry.revealRefs
      : /(?:公開|展示)/u.test(String(entry.message || ""))
        ? entry.cardRefs
        : []);
  });
  for (const [playerIndex, player] of state.players.entries()) {
    if (!player.zones) continue;
    if (!Number.isInteger(player.turnsTaken)) {
      if (["playing", "finished"].includes(state.status) && Number.isInteger(state.firstPlayer)) {
        player.turnsTaken = playerIndex === state.firstPlayer ? Math.ceil(Number(state.turn || 0) / 2) : Math.floor(Number(state.turn || 0) / 2);
      } else {
        player.turnsTaken = 0;
      }
    }
    player.collabTurn = Number(player.collabTurn || 0);
    player.batonTurn = Number(player.batonTurn || 0);
    player.limitedTurn = Number(player.limitedTurn || 0);
    player.limitedUsesCount = Number(player.limitedUsesCount || 0);
    player.limitedAllowanceTurn = Number(player.limitedAllowanceTurn || 0);
    player.limitedAllowance = Number(player.limitedAllowance || 1);
    player.forcedRedraws = Number(player.forcedRedraws || 0);
    player.mulliganUsed = Boolean(player.mulliganUsed);
    player.oshiSkillTurn = Number(player.oshiSkillTurn || 0);
    player.shionRerollUsesTurn = Number(player.shionRerollUsesTurn || 0);
    player.shionRerollUsesCount = Number(player.shionRerollUsesCount || 0);
    player.spOshiSkillUsed = Boolean(player.spOshiSkillUsed);
    if (!player.turnEvents || typeof player.turnEvents !== "object") player.turnEvents = { turn: 0, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
    if (!Array.isArray(player.removed)) player.removed = [];
    if (!player.namedUsageTurns || typeof player.namedUsageTurns !== "object") player.namedUsageTurns = {};
    if (!Array.isArray(player.modifiers)) player.modifiers = [];
    player.koyoriArtsBonusTurn = Number(player.koyoriArtsBonusTurn || 0);
    player.bonusBloomTurn = Number(player.bonusBloomTurn || 0);
    player.bonusBloomUsedTurn = Number(player.bonusBloomUsedTurn || 0);
    player.bonusBloomTargetId = String(player.bonusBloomTargetId || "");
    for (const slot of STAGE_SLOTS) {
      const stageUnit = player.zones[slot];
      if (!stageUnit) continue;
      if (!Number.isInteger(stageUnit.enteredTurn)) stageUnit.enteredTurn = 0;
      if (!Number.isInteger(stageUnit.bloomedTurn)) stageUnit.bloomedTurn = 0;
      if (!Number.isInteger(stageUnit.collabbedTurn)) stageUnit.collabbedTurn = 0;
      if (!Number.isInteger(stageUnit.koyoriMascotBonusTurn)) stageUnit.koyoriMascotBonusTurn = 0;
      if (!Array.isArray(stageUnit.attachments)) stageUnit.attachments = [];
      if (!Array.isArray(stageUnit.modifiers)) stageUnit.modifiers = [];
      stageUnit.skipUnrestTurn = Number(stageUnit.skipUnrestTurn || 0);
      if (!("returnSlot" in stageUnit)) stageUnit.returnSlot = null;
    }
  }
}

export function validateBattleDeck(deck, cards) {
  if (!deck || typeof deck !== "object") return { ok: false, error: "牌組格式不正確。" };
  const map = catalogMap(cards);
  const expected = { oshi: 1, main: 50, cheer: 20 };
  for (const section of Object.keys(expected)) {
    if (!deck[section] || typeof deck[section] !== "object" || Array.isArray(deck[section])) {
      return { ok: false, error: "牌組缺少必要區域。" };
    }
    if (countCards(deck[section]) !== expected[section]) {
      const label = section === "oshi" ? "推し" : section === "main" ? "主牌組" : "應援牌組";
      return { ok: false, error: `${label}必須為 ${expected[section]} 張。` };
    }
    for (const [number, rawCount] of Object.entries(deck[section])) {
      const count = Number(rawCount);
      const card = map.get(number);
      if (!card || !Number.isInteger(count) || count < 1 || count > 99) {
        return { ok: false, error: `卡號 ${number} 或張數無效。` };
      }
      const expectedGroup = section === "oshi" ? "oshi" : section === "cheer" ? "cheer" : null;
      if ((expectedGroup && card.group !== expectedGroup) || (section === "main" && !["holomem", "support"].includes(card.group))) {
        return { ok: false, error: `${number} 放錯牌組區域。` };
      }
      if (count > (card.maxCopies || 4)) return { ok: false, error: `${number} 超過可放入張數。` };
    }
  }
  const hasDebut = Object.keys(deck.main).some((number) => map.get(number)?.group === "holomem" && map.get(number)?.stage === "Debut");
  if (!hasDebut) return { ok: false, error: "主牌組最少要有 1 張 Debut Holomen。" };
  if (deck.printings != null) {
    if (typeof deck.printings !== "object" || Array.isArray(deck.printings)) return { ok: false, error: "卡圖版本格式不正確。" };
    for (const [number, allocation] of Object.entries(deck.printings)) {
      const card = map.get(number);
      const deckCount = Number(deck.oshi[number] || deck.main[number] || deck.cheer[number] || 0);
      if (!card || deckCount <= 0 || !allocation || typeof allocation !== "object" || Array.isArray(allocation)) return { ok: false, error: `${number} 的卡圖版本無效。` };
      let allocated = 0;
      for (const [variantId, rawCount] of Object.entries(allocation)) {
        const count = Number(rawCount);
        if (!(card.variants || []).some((variant) => variant.id === variantId) || !Number.isInteger(count) || count < 1) return { ok: false, error: `${number} 的卡圖版本無效。` };
        allocated += count;
      }
      if (allocated > deckCount) return { ok: false, error: `${number} 選擇的卡圖版本多過牌組張數。` };
    }
  }
  return { ok: true };
}

export function createLobbyState(name, deck) {
  return {
    status: "waiting",
    players: [{ name, deck, ready: false }],
    activePlayer: null,
    firstPlayer: null,
    winner: null,
    turn: 0,
    phase: "lobby",
    pendingChoice: null,
    effectQueue: [],
    knockouts: [],
    lifeLosses: [],
    log: [{ id: crypto.randomUUID(), at: Date.now(), message: `${name} 建立了私人房間。` }],
  };
}

export function joinLobby(stateInput, name, deck) {
  const state = clone(stateInput);
  assert(state.status === "waiting" && state.players.length === 1, "這個房間已經滿員或對局已開始。 ");
  state.players.push({ name, deck, ready: false });
  state.status = "lobby";
  state.phase = "lobby";
  appendLog(state, `${name} 已用房間碼加入。`);
  return state;
}

function materializePlayer(player, owner, cards, random) {
  const map = catalogMap(cards);
  const oshi = makeInstances(player.deck.oshi, owner, player.deck.printings)[0];
  const oshiCard = map.get(oshi.number);
  const mainDeck = shuffle(makeInstances(player.deck.main, owner, player.deck.printings), random);
  const cheerDeck = shuffle(makeInstances(player.deck.cheer, owner, player.deck.printings), random);
  const lifeCount = Math.max(1, Number(oshiCard?.life || 5));
  const hand = mainDeck.splice(0, 7);
  return {
    name: player.name,
    ready: true,
    setupDone: false,
    oshi,
    mainDeck,
    cheerDeck,
    hand,
    life: [],
    lifeTarget: lifeCount,
    holoPower: [],
    archive: [],
    removed: [],
    zones: emptyZones(),
    collabTurn: 0,
    batonTurn: 0,
    limitedTurn: 0,
    limitedUsesCount: 0,
    limitedAllowanceTurn: 0,
    limitedAllowance: 1,
    turnsTaken: 0,
    mulliganUsed: false,
    forcedRedraws: 0,
    oshiSkillTurn: 0,
    shionRerollUsesTurn: 0,
    shionRerollUsesCount: 0,
    spOshiSkillUsed: false,
    turnEvents: { turn: 0, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    namedUsageTurns: {},
    modifiers: [],
    koyoriArtsBonusTurn: 0,
    bonusBloomTurn: 0,
    bonusBloomUsedTurn: 0,
    bonusBloomTargetId: "",
  };
}

function initializeGame(state, cards, random) {
  state.players = state.players.map((player, index) => materializePlayer(player, index, cards, random));
  state.status = "setup";
  state.phase = "setup";
  state.activePlayer = null;
  state.firstPlayer = random() < 0.5 ? 0 : 1;
  appendLog(state, `雙方牌組已自動洗牌並各抽 7 張；${state.players[state.firstPlayer].name} 成為先攻。`);
}

function hasDebutInHand(player, map) {
  return player.hand.some((instance) => map.get(instance.number)?.stage === "Debut");
}

function redrawOpeningHand(state, playerIndex, map, random) {
  const player = state.players[playerIndex];
  assert(!player.setupDone, "你已完成開局設置。 ");
  assert(!player.mulliganUsed, "每位玩家每場對局只可自願重抽 1 次。 ");
  player.mulliganUsed = true;
  player.mainDeck = shuffle([...player.mainDeck, ...player.hand], random);
  player.hand = player.mainDeck.splice(0, 7);
  appendLog(state, `${player.name} 已使用每場 1 次的自願重抽。`);

  while (!hasDebutInHand(player, map)) {
    if (player.forcedRedraws >= 6) {
      state.status = "finished";
      state.phase = "finished";
      state.winner = playerIndex === 0 ? 1 : 0;
      state.pendingChoice = null;
      appendLog(state, `${player.name} 強制重抽 6 次後仍沒有 Debut，${state.players[state.winner].name} 勝出。`);
      return;
    }
    player.mainDeck = shuffle([...player.mainDeck, ...player.hand], random);
    player.hand = player.mainDeck.splice(0, 7);
    player.forcedRedraws += 1;
    appendLog(state, `${player.name} 公開沒有 Debut 的手牌並自動強制重抽（第 ${player.forcedRedraws} 次）。`);
  }
}

function setupStage(state, playerIndex, action, map, random) {
  const player = state.players[playerIndex];
  assert(!player.setupDone, "你已完成開局設置。 ");
  const center = player.hand.find((card) => card.id === action.centerId);
  assert(center && map.get(center.number)?.stage === "Debut", "中央位置必須選擇手牌中的 Debut Holomen。 ");
  const backIds = Array.isArray(action.backIds) ? [...new Set(action.backIds)] : [];
  assert(backIds.length <= 5 && !backIds.includes(action.centerId), "後排最多選擇 5 位 Holomen。 ");
  const backCards = backIds.map((id) => player.hand.find((card) => card.id === id));
  assert(backCards.every(Boolean), "開局選擇包含不在手牌的卡。 ");
  assert(backCards.every((card) => {
    const info = map.get(card.number);
    return info?.group === "holomem" && ["Debut", "Spot"].includes(info.stage);
  }), "後排只可放置 Debut 或 Spot Holomen。 ");

  const bottomIds = Array.isArray(action.bottomIds) ? [...new Set(action.bottomIds)] : [];
  const forcedRedraws = Number(player.forcedRedraws || 0);
  const stageIds = new Set([action.centerId, ...backIds]);
  assert(bottomIds.length === forcedRedraws, `強制重抽後要選擇 ${forcedRedraws} 張手牌放到主牌庫底。`);
  assert(bottomIds.every((id) => !stageIds.has(id) && player.hand.some((card) => card.id === id)), "牌庫底補正包含無效或已放到舞台的卡。 ");

  const centerCard = removeById(player.hand, action.centerId);
  player.zones.center = unit(centerCard);
  bottomIds.forEach((id) => {
    const selected = removeById(player.hand, id);
    player.mainDeck.push(selected);
  });
  backCards.forEach((card, index) => {
    const selected = removeById(player.hand, card.id);
    player.zones[BACK_SLOTS[index]] = unit(selected);
  });
  if (player.life.length === 0) player.life = player.cheerDeck.splice(0, Number(player.lifeTarget || 5));
  player.setupDone = true;
  appendLog(state, `${player.name} 已按選擇次序完成中央及後排設置。`);

  if (state.players.every((candidate) => candidate.setupDone)) {
    state.status = "playing";
    state.turn = 1;
    if (!Number.isInteger(state.firstPlayer)) state.firstPlayer = random() < 0.5 ? 0 : 1;
    state.activePlayer = state.firstPlayer;
    appendLog(state, `${state.players[state.activePlayer].name} 的第 1 回合開始；略過重置步驟。`);
    beginTurn(state, state.activePlayer, map);
  }
}

function stageUnitCount(player) {
  return STAGE_SLOTS.reduce((count, slot) => count + (player.zones[slot] ? 1 : 0), 0);
}

function emptyBackSlots(player) {
  return BACK_SLOTS.filter((slot) => !player.zones[slot]);
}

function talentMatches(left, right) {
  const leftNames = new Set(cardAliases(left));
  return cardAliases(right).some((name) => leftNames.has(name));
}

function legalBloomStage(playedCard, current) {
  return playedCard?.stage === "1st" ? ["Debut", "1st"].includes(current?.stage) : playedCard?.stage === "2nd" && ["1st", "2nd"].includes(current?.stage);
}
function fastForwardBloomTargets(player, card, map, turn) {
  if (card?.group !== "holomem" || card.stage !== "1st") return [];
  return BACK_SLOTS.filter(zone => {
    const unit = player.zones[zone];
    return unit && unitCard(unit, map)?.stage === "Debut" && unit.enteredTurn === turn && unit.bloomedTurn !== turn && talentMatches(unitCard(unit, map), card) && Number(card.hp) > Number(unit.damage || 0);
  });
}
function bloomTargets(player, playedCard, map, turn) {
  if (Number(player.turnsTaken || 0) <= 1) return [];
  const allowedStages = playedCard.stage === "1st" ? ["Debut", "1st"] : playedCard.stage === "2nd" ? ["1st", "2nd"] : [];
  if (allowedStages.length === 0) return [];
  const extraBloomAvailable = Number(player.bonusBloomTurn || 0) === turn && Number(player.bonusBloomUsedTurn || 0) !== turn;
  return STAGE_SLOTS.filter((slot) => {
    const stageUnit = player.zones[slot];
    const current = map.get(topCard(stageUnit)?.number);
    const previous = map.get(stageUnit?.stack?.at(-2)?.number);
    const alreadyBloomedThisTurn = Number(stageUnit?.bloomedTurn || 0) === turn;
    const matchesRestrictedExtraBloom = !player.bonusBloomTargetId || (topCard(stageUnit)?.id === player.bonusBloomTargetId && playedCard.stage === "2nd");
    const validExtraBloom = extraBloomAvailable && matchesRestrictedExtraBloom && ["1st", "2nd"].includes(playedCard.stage) && current?.stage === "1st" && previous?.stage === "Debut" && alreadyBloomedThisTurn;
    return current
      && current.stage !== "Spot"
      && allowedStages.includes(current.stage)
      && talentMatches(current, playedCard)
      && Number(stageUnit.enteredTurn || 0) !== turn
      && (!alreadyBloomedThisTurn || validExtraBloom)
      && Number(playedCard.hp || 0) > Number(stageUnit.damage || 0);
  });
}

function queuePlay(state, playerIndex, cardInstance, card, map) {
  const player = state.players[playerIndex];
  if (["Debut", "Spot"].includes(card.stage)) {
    assert(stageUnitCount(player) < 6, "舞台上的 Holomen 已達官方上限 6 位。 ");
    const options = emptyBackSlots(player);
    assert(options.length > 0, "舞台沒有可放置這張卡的位置。 ");
    state.pendingChoice = { type: "playHolomen", playerIndex, cardId: cardInstance.id, cardNumber: card.number, options };
    return;
  }
  assert(Number(player.turnsTaken || 0) > 1, "先攻或後攻玩家自己的第 1 回合都不可 Bloom。 ");
  const options = bloomTargets(player, card, map, state.turn);
  assert(options.length > 0, "沒有合法 Bloom 對象：本回合才登場、已 Bloom、Spot、名稱／階級或 HP 不符的 Holomen 都不可選。 ");
  state.pendingChoice = { type: "bloom", playerIndex, cardId: cardInstance.id, cardNumber: card.number, options };
}

function normalizeCardName(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/gu, "").replaceAll("卷", "巻");
}

function treatedAsHolomemNames(card) {
  if (card?.group !== "holomem") return [];
  const text = `${card?.extra || ""} ${card?.abilityText || ""}`;
  if (!/(?:同時(?:也)?視為|也視為|としても扱|also\s+(?:be\s+)?treated\s+as)/iu.test(text)) return [];
  return [...text.matchAll(/[〈<]([^〉>]+)[〉>]/gu)].map((match) => match[1]);
}

function cardAliases(card) {
  return [...new Set([card?.name, card?.jpName, card?.enName, ...treatedAsHolomemNames(card)]
    .filter(Boolean)
    .map(normalizeCardName))];
}

function cardHasTag(card, tag) {
  return (card?.tags || []).includes(tag);
}

function cardHasName(card, name) {
  const wanted = normalizeCardName(name);
  return cardAliases(card).some((alias) => alias === wanted || alias.includes(wanted) || wanted.includes(alias));
}

function cardIsBuzz(card) {
  return String(card?.type || "").toUpperCase().includes("BUZZ");
}

function cardIsUnlimitedDebut(card) {
  return card?.group === "holomem" && card.stage === "Debut" && (Boolean(card.unlimited) || /任意張數|不受張數限制/u.test(String(card.extra || "")));
}

const SKILL_COLOR_WORDS = Object.freeze([
  ["白", /白(?:色|屬性|屬)?/u],
  ["綠", /綠(?:色|屬性|屬)?/u],
  ["紅", /紅(?:色|屬性|屬)?/u],
  ["藍", /藍(?:色|屬性|屬)?/u],
  ["黃", /黃(?:色|屬性|屬)?/u],
  ["紫", /紫(?:色|屬性|屬)?/u],
]);

function skillColor(text) {
  return SKILL_COLOR_WORDS.find(([, pattern]) => pattern.test(String(text || "")))?.[0] || "";
}

function oshiPowerCost(skill, cardNumber = "", kind = "oshi") {
  if (cardNumber) {
    const officialCost = oshiSkillPowerCost(cardNumber, kind);
    if (typeof officialCost === "number") return officialCost;
    if (officialCost === "X") return 0;
  }
  const text = `${skill?.timing || ""} ${skill?.effect || ""}`;
  const match = text.match(/Holo\s*Power\s*[-−]\s*(\d+)/iu);
  if (match) return Number(match[1]);
  return 0;
}

function canPayReactiveOshi(state, playerIndex, kind, map) {
  const player = state.players[playerIndex];
  const card = map.get(player?.oshi?.number);
  const sp = kind === "sp";
  if (!card || (sp ? player.spOshiSkillUsed : Number(player.oshiSkillTurn || 0) === state.turn)) return false;
  const skill = sp ? card.spOshiSkill : card.oshiSkill;
  return player.holoPower.length >= oshiPowerCost(skill, card.number, sp ? "sp" : "oshi");
}

function payReactiveOshi(state, playerIndex, kind, map) {
  assert(canPayReactiveOshi(state, playerIndex, kind, map), "Holo Power 不足或本次推し技能已使用。 ");
  const player = state.players[playerIndex];
  const card = map.get(player.oshi.number);
  const skillKind = kind === "sp" ? "sp" : "oshi";
  const skill = kind === "sp" ? card.spOshiSkill : card.oshiSkill;
  const cost = oshiPowerCost(skill, card.number, skillKind);
  if (cost > 0) player.archive.push(...player.holoPower.splice(-cost).reverse());
  if (kind === "sp") player.spOshiSkillUsed = true;
  else player.oshiSkillTurn = state.turn;
  queueGiftOshiSkillEffects(state, playerIndex, skill, skillKind, map);
  appendLog(state, `${player.name} 支付 ${cost} Holo Power 使用反應式推し技能。`);
}

function stageHasAnyCheerColor(player, color, map) {
  return stageEntries(player).some(({ unit: stageUnit }) => stageUnit.cheer.some((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes(color)));
}

function addMatchingStageModifiers(state, playerIndex, map, rule, amount, sourceNumber, kind = "arts", expiresTurn = state.turn) {
  const player = state.players[playerIndex];
  const options = stageOptionsMatching(player, map, rule);
  options.forEach((zone) => addStageModifier(player.zones[zone], kind, amount, expiresTurn, sourceNumber));
  return options.length;
}

function queueDeckAttachmentToStage(state, playerIndex, rule, targetRule, map, random, label, { optional = true } = {}) {
  const player = state.players[playerIndex];
  const candidates = player.mainDeck.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map)
    && stageOptionsMatching(player, map, targetRule).some((zone) => attachmentTargets(player, map.get(instance.number), map).includes(zone)));
  if (candidates.length === 0) {
    player.mainDeck = shuffle(player.mainDeck, random);
    appendLog(state, `${player.name} 的${label}沒有符合條件的附加卡；牌庫已洗牌。`);
    return false;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards: candidates,
    min: optional ? 0 : 1,
    max: 1,
    optional,
    source: "deck",
    effect: "deckSupportToAttach",
    prompt: `${label}：可公開 1 張符合條件的附加卡；之後直接按牌桌上的合法 Holomen。`,
    meta: { targetRule },
  });
  return true;
}

function unitCard(stageUnit, map) {
  const card = map.get(topCard(stageUnit)?.number);
  const state = map.gameState;
  if (!card || !stageUnit || !state) return card;
  const ownerIndex = state.players.findIndex(player => player.zones.center === stageUnit || player.zones.collab === stageUnit);
  const opposingCenter = ownerIndex >= 0 ? state.players[ownerIndex === 0 ? 1 : 0]?.zones.center : null;
  const allColors = (opposingCenter?.attachments || []).some(instance => instance.number === "hBP08-110")
    || activeModifiers(stageUnit, "allColors", state.turn).length > 0;
  return allColors ? { ...card, colors: SKILL_COLOR_WORDS.map(([value]) => value) } : card;
}

function effectiveCheerColors(player, stageUnit, cheer, map) {
  const colors = [...(map.get(cheer?.number)?.colors || [])];
  const source = unitCard(stageUnit, map);
  if (player?.oshi?.number === "hBP08-003"
    && colors.includes("紅")
    && ["フワワ・アビスガード", "モココ・アビスガード"].some((name) => cardHasName(source, name))) colors.push("藍");
  return [...new Set(colors)];
}

function stageCheerColors(player, stageUnit, map) {
  return (stageUnit?.cheer || []).flatMap((instance) => effectiveCheerColors(player, stageUnit, instance, map));
}

function stageMatchesRule(stageUnit, zone, rule, map, player = null) {
  if (!stageUnit) return false;
  const card = unitCard(stageUnit, map);
  if (!card) return false;
  if (rule?.zones && !rule.zones.includes(zone)) return false;
  if (rule?.excludeZones?.includes(zone)) return false;
  if (rule?.rested != null && Boolean(stageUnit.rested) !== Boolean(rule.rested)) return false;
  if (rule?.damaged && Number(stageUnit.damage || 0) <= 0) return false;
  if (rule?.names && !rule.names.some((name) => cardHasName(card, name))) return false;
  if (rule?.excludeNames?.some((name) => cardHasName(card, name))) return false;
  if (rule?.tags && !rule.tags.every((tag) => cardHasTag(card, tag))) return false;
  if (rule?.anyTags && !rule.anyTags.some((tag) => cardHasTag(card, tag))) return false;
  if (rule?.namesOrTags && !rule.namesOrTags.names?.some((name) => cardHasName(card, name)) && !rule.namesOrTags.tags?.some((tag) => cardHasTag(card, tag))) return false;
  if (rule?.colors && !(card.colors || []).some((color) => rule.colors.includes(color))) return false;
  if (rule?.monoColor && (card.colors || []).length !== 1) return false;
  if (rule?.stages && !rule.stages.includes(card.stage)) return false;
  if (rule?.excludeStages?.includes(card.stage)) return false;
  if (rule?.buzz != null && cardIsBuzz(card) !== Boolean(rule.buzz)) return false;
  if (rule?.hasAttachment && (stageUnit.attachments || []).length === 0) return false;
  if (rule?.hasAttachmentType && !(stageUnit.attachments || []).some((instance) => map.get(instance.number)?.typeCode === rule.hasAttachmentType)) return false;
  if (rule?.hasAttachmentNumber && !(stageUnit.attachments || []).some((instance) => instance.number === rule.hasAttachmentNumber)) return false;
  if (rule?.hasCheerColor && !(stageUnit.cheer || []).some((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes(rule.hasCheerColor))) return false;
  if (rule?.hasCheer === false && (stageUnit.cheer || []).length > 0) return false;
  return true;
}

function stageOptionsMatching(player, map, rule = {}) {
  return STAGE_SLOTS.filter((zone) => !player.zones[zone]?.downPending && stageMatchesRule(player.zones[zone], zone, rule, map, player));
}

function activeModifiers(stageUnit, kind, turn) {
  return (stageUnit?.modifiers || []).filter((modifier) => modifier.kind === kind && Number(modifier.expiresTurn || 0) >= turn);
}

function addStageModifier(stageUnit, kind, amount, expiresTurn, sourceNumber, extra = {}) {
  if (!stageUnit) return;
  if (!Array.isArray(stageUnit.modifiers)) stageUnit.modifiers = [];
  stageUnit.modifiers.push({ kind, amount: Number(amount || 0), expiresTurn: Number(expiresTurn || 0), sourceNumber, ...extra });
}

function addPlayerModifier(player, kind, amount, expiresTurn, sourceNumber, rule = {}) {
  if (!Array.isArray(player.modifiers)) player.modifiers = [];
  player.modifiers.push({ kind, amount: Number(amount || 0), expiresTurn: Number(expiresTurn || 0), sourceNumber, rule: clone(rule) });
}

function matchingPlayerModifierBonus(player, kind, stageUnit, zone, map, turn) {
  return (player.modifiers || []).reduce((total, modifier) => {
    if (modifier.kind !== kind || modifier.waitingForOwnerTurn || Number(modifier.expiresTurn || 0) < turn) return total;
    return stageMatchesRule(stageUnit, zone, modifier.rule || {}, map, player) ? total + Number(modifier.amount || 0) : total;
  }, 0);
}

function usedNamedThisTurn(player, key, turn) {
  return Number(player.namedUsageTurns?.[key] || 0) === turn;
}

function markNamedUsage(player, key, turn) {
  if (!player.namedUsageTurns || typeof player.namedUsageTurns !== "object") player.namedUsageTurns = {};
  player.namedUsageTurns[key] = turn;
}

function currentTurnEvents(player, turn) {
  if (!player.turnEvents || Number(player.turnEvents.turn || 0) !== turn) player.turnEvents = { turn, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 };
  return player.turnEvents;
}

function wasKnockedOutDuringPreviousOpponentTurn(state, ownerIndex, name = "") {
  const previousTurn = Number(state.turn || 0) - 1;
  return (state.knockouts || []).some((entry) => entry.turn === previousTurn
    && entry.ownerIndex === ownerIndex
    && entry.sourcePlayerIndex !== ownerIndex
    && (!name || cardHasName(entry.card, name)));
}

function isKoyoriCard(card) {
  return cardAliases(card).some((name) => name.includes("博衣こより"));
}

function cardCodes(cards) {
  return cards.map((instance) => instance.number).join("、") || "沒有牌";
}

function stageEntries(player) {
  return STAGE_SLOTS.flatMap((zone) => player.zones[zone] ? [{ zone, unit: player.zones[zone] }] : []);
}

function assistantCount(player) {
  return stageEntries(player).reduce((total, { unit: stageUnit }) => total + (stageUnit.attachments || []).filter((card) => card.number === ASSISTANT_CARD).length, 0);
}

function totalCheer(player) {
  return stageEntries(player).reduce((total, { unit: stageUnit }) => total + stageUnit.cheer.length, 0);
}

function stageZoneByTopId(player, cardId) {
  return stageEntries(player).find(({ unit: stageUnit }) => topCard(stageUnit)?.id === cardId)?.zone || "";
}

function stageMaximumHp(player, zone, map) {
  const stageUnit = player?.zones?.[zone];
  return Number(unitCard(stageUnit, map)?.hp || 0) + attachmentHpBonus(stageUnit, map, zone, player) + holomemHpBonus(stageUnit, map, zone, player);
}

function stageRemainingHp(player, zone, map) {
  return Math.max(0, stageMaximumHp(player, zone, map) - Number(player?.zones?.[zone]?.damage || 0));
}

function revealCount(player) {
  return totalCheer(player) + (player.oshi?.number === KOYORI_OSHI ? assistantCount(player) : 0);
}

function stageHasTag(player, tag, map) {
  return stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(map.get(topCard(stageUnit)?.number), tag));
}

function drawCards(state, playerIndex, amount) {
  const player = state.players[playerIndex];
  let drawn = 0;
  for (let index = 0; index < amount; index += 1) {
    if (player.mainDeck.length === 0) break;
    player.hand.push(player.mainDeck.shift());
    drawn += 1;
  }
  return drawn;
}

function healStageUnit(state, playerIndex, zone, amount, map, sourceIsOwn = true) {
  const player = state.players[playerIndex];
  const stageUnit = player?.zones?.[zone];
  if (!stageUnit) return 0;
  const healed = Math.min(Math.max(0, Number(amount || 0)), Number(stageUnit.damage || 0));
  stageUnit.damage -= healed;
  const card = unitCard(stageUnit, map);
  if (healed > 0 && sourceIsOwn && stageUnit.attachments.some((instance) => instance.number === "hBP01-114") && ["1st", "2nd"].includes(card?.stage) && cardHasName(card, "アキ・ローゼンタール") && activeModifiers(stageUnit, "trigger:hBP01-114", state.turn).length === 0) {
    addStageModifier(stageUnit, "trigger:hBP01-114", 0, state.turn, "hBP01-114");
    appendLog(state, `${player.name} 因石斧的追加能力抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  }
  return healed;
}

function attachCheerCards(state, stageUnit, cheers) {
  if (cheers.length === 0) return;
  stageUnit.cheer.push(...cheers);
  const playerIndex = state.players.findIndex(player => stageEntries(player).some(entry => entry.unit === stageUnit));
  if (playerIndex < 0) return;
  const fans = (stageUnit.attachments || []).filter(instance => instance.number === "hBP03-113" && instance.risunersUsedTurn !== state.turn);
  if (fans.length === 0) return;
  fans.forEach(instance => { instance.risunersUsedTurn = state.turn; });
  // Automatic abilities wait until the current Art has fully resolved.
  // The bottom stack instance survives Bloom and moving between stage slots.
  state.effectQueue.push({ type: "risunersArtsBonus", playerIndex, recipientId: stageUnit.stack[0]?.id, amount: fans.length * 10, turn: state.turn });
}

function enqueueEffect(state, effect) {
  // A choice made while resolving an Art's ability must finish before its
  // printed damage. Damage-triggered reactions instead wait past the boundary.
  if (state.artsResolution?.phase === "ability" && !state.artsResolution.queuingReactions && !["dealArtsDamage", "completeArtsResolution"].includes(effect.type)) {
    const boundary = state.effectQueue.findIndex((item) => item.type === "dealArtsDamage" || item.type === "completeArtsResolution");
    if (boundary >= 0) { state.effectQueue.splice(boundary, 0, effect); return; }
  }
  const downBoundary = state.effectQueue.findIndex(item => item.type === "finishDownLife");
  if (downBoundary >= 0 && effect.type !== "finishDownLife") state.effectQueue.splice(downBoundary, 0, effect);
  else state.effectQueue.push(effect);
}

function queueDamageTriggers(state, callback) {
  const resolution = state.artsResolution;
  if (resolution) resolution.queuingReactions = true;
  try { callback(); } finally { if (resolution) delete resolution.queuingReactions; }
}

function resolveDamageKnockout(state, ownerIndex, zone, map, sourcePlayerIndex, options, artEvidence = null) {
  const target = state.players[ownerIndex]?.zones?.[zone];
  if (!target) return;
  if (state.artsResolution) {
    const id = topCard(target)?.id;
    if (!state.artsResolution.knockouts.some((entry) => entry.ownerIndex === ownerIndex && entry.targetId === id)) {
      state.artsResolution.knockouts.push({ ownerIndex, zone, targetId: id, sourcePlayerIndex, options: clone(options), artEvidence: clone(artEvidence) });
    }
    return;
  }
  knockOutUnit(state, ownerIndex, zone, map, sourcePlayerIndex, options);
}

function enqueueCardSelection(state, { playerIndex, cards, selectableIds, min = 1, max = 1, prompt, effect, optional = false, source = "", meta = {} }) {
  const choices = clone(cards || []);
  const selectable = selectableIds || choices.map((card) => card.id);
  enqueueEffect(state, { type: "cardSelection", playerIndex, cards: choices, selectableIds: selectable, min, max, prompt, effect, optional, source, meta });
}

function enqueueStageTarget(state, { playerIndex, targetPlayerIndex = playerIndex, options, rule = {}, prompt, effect, optional = false, meta = {} }) {
  enqueueEffect(state, { type: "stageTarget", playerIndex, targetPlayerIndex, options: options ? [...options] : null, rule: clone(rule), prompt, effect, optional, meta: clone(meta) });
}

function stageCheerOptions(player, map, rule = {}) {
  return stageEntries(player).flatMap(({ zone, unit: stageUnit }) => {
    if (!stageMatchesRule(stageUnit, zone, rule.stage || {}, map, player)) return [];
    return (stageUnit.cheer || []).filter((instance) => {
      if (rule.colors && !effectiveCheerColors(player, stageUnit, instance, map).some((color) => rule.colors.includes(color))) return false;
      return true;
    }).map((instance) => ({ id: instance.id, number: instance.number, zone }));
  });
}

function enqueueStageCheerSelection(state, { playerIndex, ownerIndex = playerIndex, options, rule = {}, min = 1, max = 1, prompt, effect, optional = false, meta = {} }) {
  enqueueEffect(state, { type: "stageCheerSelection", playerIndex, ownerIndex, options: options ? clone(options) : null, rule: clone(rule), min, max, prompt, effect, optional, meta: clone(meta) });
}

function stageAttachmentOptions(player, map, predicate = () => true) {
  return stageEntries(player).flatMap(({ zone, unit: stageUnit }) => (stageUnit.attachments || []).filter((instance) => predicate(instance, map.get(instance.number), zone, stageUnit)).map((instance) => ({ id: instance.id, number: instance.number, zone })));
}

function enqueueStageAttachmentSelection(state, { playerIndex, ownerIndex = playerIndex, options, prompt, effect, optional = false, meta = {} }) {
  enqueueEffect(state, { type: "stageAttachmentSelection", playerIndex, ownerIndex, options: clone(options || []), prompt, effect, optional, meta: clone(meta) });
}

function enqueueOptionChoice(state, { playerIndex, options, prompt, effect, optional = false, meta = {} }) {
  enqueueEffect(state, { type: "optionChoice", playerIndex, options: clone(options), prompt, effect, optional, meta: clone(meta) });
}

function enqueueArchiveCheerToTarget(state, playerIndex, { min = 1, max = 1, targetRule = {}, targetZone = "", prompt = "從存檔區選擇要附加的應援。", optional = false, effect = "archiveCheerToStage", meta = {} } = {}, map) {
  const player = state.players[playerIndex];
  const cards = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
  if (cards.length === 0) return false;
  enqueueCardSelection(state, {
    playerIndex,
    cards,
    min: optional ? 0 : Math.min(min, cards.length),
    max: Math.min(max, cards.length),
    prompt,
    effect,
    source: "archive",
    optional,
    meta: { targetRule, targetZone, ...meta },
  });
  return true;
}

function queueFrontierCheer(state, playerIndex, remaining, map) {
  if (remaining <= 0 || !stageOptionsMatching(state.players[playerIndex], map, { names: ["AZKi"] }).length) return;
  enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "frontierCheerPick", meta: { remaining }, targetRule: { names: ["AZKi"] } }, map);
}
function enqueueHandToDestination(state, playerIndex, { min = 1, max = 1, effect = "handToBottom", prompt, optional = false, selectableIds, meta = {} }) {
  const cards = clone(state.players[playerIndex].hand);
  if (cards.length === 0) return false;
  enqueueCardSelection(state, { playerIndex, cards, selectableIds, min: optional ? 0 : Math.min(min, cards.length), max: Math.min(max, cards.length), prompt, effect, source: "hand", optional, meta });
  return true;
}

// Q34/Q35: replacement is one activation for this payment, with a freely
// chosen mix of hand cards and topmost Holo Power. Never expose face-down
// Holo Power as selectable cards, or cap the payment by the hand size.
function canReplaceHandArchive(state, playerIndex, card, map) {
  return card?.group === "holomem" && card.colors?.includes("紅")
    && state.players[playerIndex].oshi?.number === "hBP01-005"
    && state.players[playerIndex].holoPower.length > 0
    && canPayReactiveOshi(state, playerIndex, "oshi", map);
}

function enqueueHolomemHandArchive(state, selection, card, map) {
  const { playerIndex, cards, min = 1, max = 1, optional = false } = selection;
  const player = state.players[playerIndex];
  const power = canReplaceHandArchive(state, playerIndex, card, map) ? player.holoPower.length : 0;
  const available = cards.length + power;
  if (available === 0 || (optional && available < min)) return false;
  const minimum = optional ? min : Math.min(min, available);
  const maximum = Math.min(max, available);
  const saved = { ...selection, min: minimum, max: maximum, source: "hand",
    meta: { ...selection.meta, archiveSourceNumber: card.number } };
  if (power > 0) {
    const options = [];
    if (!optional || cards.length >= minimum) options.push({ id: "hand", label: "只用手牌，唔使用推し技能" });
    for (let total = Math.max(1, minimum); total <= maximum; total += 1) {
      for (let count = 1; count <= Math.min(total, power); count += 1) {
        if (total - count > cards.length) continue;
        options.push({ id: `power:${count}:${total}`, powerCount: count, total,
          label: `存檔 ${count} Holo Power${total > count ? ` ＋ ${total - count} 張手牌` : ""}` });
      }
    }
    enqueueOptionChoice(state, { playerIndex, options, optional, effect: "luiArchivePayment",
      prompt: `女幹部の采配 [hBP01-005]：${selection.prompt}`, meta: { selection: saved } });
  } else enqueueCardSelection(state, { ...saved, min: Math.min(minimum, cards.length), max: Math.min(maximum, cards.length) });
  return true;
}

function payHandArchive(state, playerIndex, pending, selected, skipped, map) {
  if (skipped) return 0;
  const player = state.players[playerIndex];
  const power = Number(pending.meta?.luiPowerCount || 0);
  if (power > 0) assert(selected.length + power === pending.meta?.luiTotalCount, "替代支付的手牌數量已不足。 ");
  assert(selected.every((card) => player.hand.some((current) => current.id === card.id)), "手牌成本已改變。 ");
  if (power > 0) {
    assert(canReplaceHandArchive(state, playerIndex, map.get(pending.meta?.archiveSourceNumber), map)
      && Number.isInteger(power) && player.holoPower.length >= power, "Holo Power 不足或本回合已使用女幹部の采配。 ");
    player.archive.push(...player.holoPower.splice(-power).reverse());
    player.oshiSkillTurn = state.turn;
    const oshi = map.get(player.oshi.number);
    queueGiftOshiSkillEffects(state, playerIndex, oshi.oshiSkill, "oshi", map);
    appendLog(state, `${player.name} 使用女幹部の采配 [hBP01-005]，存檔 ${power} Holo Power 代替同數量手牌。`);
  }
  selected.forEach((card) => player.archive.push(removeById(player.hand, card.id)));
  if (selected.length > 0) {
    const sourceNumber = pending.meta?.archiveSourceNumber || pending.meta?.cardNumber;
    const sourceZone = pending.meta?.sourceZone || pending.meta?.zone;
    const source = player.zones[sourceZone];
    const card = unitCard(source, map);
    const tool = source?.attachments?.find(c => c.number === "hBP05-083");
    if (tool && ["center", "collab"].includes(sourceZone) && card?.number === sourceNumber && card.stage === "2nd" && cardHasName(card, "ネリッサ・レイヴンクロフト") && !usedNamedThisTurn(player, "tool:hBP05-083:" + tool.id, state.turn)) {
      markNamedUsage(player, "tool:hBP05-083:" + tool.id, state.turn);
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: "工具能力：選擇對手中央或合作，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceZone, sourceCardNumber: "hBP05-083", sourceName: map.get("hBP05-083")?.name } });
    }
  }
  return selected.length + power;
}

function rollDieRaw(random, state = null, playerIndex = null, count = 1, sourceCard = null) {
  const modifiers = Number.isInteger(playerIndex) ? state?.players?.[playerIndex]?.modifiers || [] : [];
  const forced = modifiers.find((modifier) => modifier.kind === "dieOverride" && Number(modifier.expiresTurn || 0) >= Number(state?.turn || 0));
  const triple = Number(count || 1) === 3 ? modifiers.find((modifier) => modifier.kind === "threeDiceOverride" && Number(modifier.expiresTurn || 0) >= Number(state?.turn || 0)) : null;
  const namedOverride = cardHasName(sourceCard, "さくらみこ") ? modifiers.find((modifier) => modifier.kind === "mikoDieOverride" && Number(modifier.expiresTurn || 0) >= Number(state?.turn || 0)) : null;
  const multiplier = cardHasName(sourceCard, "ハコス・ベールズ") ? modifiers.find((modifier) => modifier.kind === "baeDieMultiplier" && Number(modifier.expiresTurn || 0) >= Number(state?.turn || 0)) : null;
  const rolled = Number(forced?.amount || triple?.amount || namedOverride?.amount || (Math.floor(random() * 6) + 1));
  const result = rolled * Math.max(1, Number(multiplier?.amount || 1));
  if (state && Number.isInteger(playerIndex) && state.players?.[playerIndex]) {
    const events = currentTurnEvents(state.players[playerIndex], state.turn);
    events.diceRollCount = Number(events.diceRollCount || 0) + 1;
    if (!Array.isArray(events.dice)) events.dice = [];
    events.dice.push({ sourceNumber: sourceCard?.number || "", value: result });
  }
  return result;
}

function interactiveDice(random, state, playerIndex, count, sourceCard) {
  const run = state && diceRuns.get(state);
  const roll = () => Array.from({ length: count }, () => rollDieRaw(random, state, playerIndex, count, sourceCard));
  if (!count || !run || !sourceCard || !['oshi', 'holomem'].includes(sourceCard.group)) return roll();
  const player = state.players[playerIndex];
  const context = run.context || {};
  const zones = [context.sourceZone, context.meta?.sourceZone, context.zone, context.targetZone, sourceCard.keyword?.type === 'collab_effect' ? 'collab' : null];
  const matching = stageEntries(player).filter(({unit}) => unitCard(unit, run.map)?.number === sourceCard.number);
  const source = zones.map(zone => matching.find(entry => entry.zone === zone)).find(Boolean) || (matching.length === 1 ? matching[0] : null);
  const choose = (prompt, options) => diceDecision(state, { type: 'optionChoice', playerIndex, effect: 'interactiveDice', optional: false, prompt, modeOptions: options });
  let declared = null;
  const oshi = run.map.get(player.oshi?.number);
  if (sourceCard.group === 'holomem' && player.oshi?.number === 'hSD01-002' && player.oshiSkillTurn !== state.turn && player.holoPower.length >= oshiPowerCost(oshi.oshiSkill, oshi.number, 'oshi')) {
    const id = choose('擲骰前：可使用 AZKi 推し技能，宣告下一顆骰子的點數。', [{id:'roll',label:'直接擲骰'}, ...Array.from({length:6},(_,i)=>({id:'declare:'+(i+1),label:'支付 3 Holo Power，宣告 '+(i+1)}))]);
    if (id.startsWith('declare:')) { declared = Number(id.slice(8)); payReactiveOshi(state, playerIndex, 'normal', run.map); }
  }
  const events = currentTurnEvents(player, state.turn);
  const start = (events.dice || []).length;
  const priorCount = Number(events.diceRollCount || 0);
  let results = roll();
  if (declared !== null) {
    const multiplier = cardHasName(sourceCard, 'ハコス・ベールズ') ? player.modifiers?.find(m=>m.kind==='baeDieMultiplier' && m.expiresTurn >= state.turn)?.amount || 1 : 1;
    results[0] = declared * multiplier;
    events.dice[start].value = results[0];
  }
  while (true) {
    const fans = sourceCard.group === 'holomem' ? source?.unit.attachments.filter(c=>c.number==='hBP01-123') || [] : [];
    const matsu = sourceCard.group === 'oshi' || cardHasTag(sourceCard, '#1期生') ? stageEntries(player).flatMap(({unit})=>unit.attachments.filter(c=>c.number==='hBP06-103')) : [];
    if (!fans.length && !matsu.length) return results;
    const options = [{id:'accept',label:'接受 '+results.join('、')}, ...fans.map(c=>({id:'reroll:'+c.id,label:'存檔野兔同盟，全部重擲',cardId:c.id})), ...matsu.flatMap(c=>results.map((_,i)=>({id:'four:'+i+':'+c.id,label:'存檔 Matsurisu，將第 '+(i+1)+' 顆視為 4',cardId:c.id})))];
    const id = choose('骰子結果：'+results.join('、'), options);
    if (id === 'accept') return results;
    const reroll = id.startsWith('reroll:');
    const parts = /^four:(\d+):(.*)$/.exec(id);
    const cardId = reroll ? id.slice(7) : parts[2];
    const holder = stageEntries(player).find(({unit})=>unit.attachments.some(c=>c.id===cardId));
    const card = removeById(holder.unit.attachments, cardId);
    player.archive.push(card);
    if (reroll) {
      events.dice.splice(start); events.diceRollCount = priorCount;
      results = roll();
    } else { const index = Number(parts[1]); results[index] = 4; events.dice[start+index].value = 4; }
  }
}

function rollDie(random, state = null, playerIndex = null, count = 1, sourceCard = null) {
  return interactiveDice(random, state, playerIndex, 1, sourceCard)[0];
}

function logDie(state, playerIndex, result, label = "擲骰") {
  appendLog(state, `${state.players[playerIndex].name} ${label}結果為 ${result}。`);
}

function shionRerollUseCount(player, turn) {
  return Number(player?.shionRerollUsesTurn || 0) === turn ? Number(player?.shionRerollUsesCount || 0) : 0;
}

function shionRerollUseLimit(player, map) {
  const center = player?.zones?.center;
  const centerCard = unitCard(center, map);
  const wandActive = center && ["1st", "2nd"].includes(centerCard?.stage)
    && cardHasName(centerCard, "紫咲シオン")
    && (center.attachments || []).some((instance) => instance.number === "hBP02-087");
  return wandActive ? 2 : 1;
}

function canUseShionReroll(state, playerIndex, map) {
  const player = state.players[playerIndex];
  return player?.oshi?.number === "hBP02-005"
    && player.holoPower.length >= 1
    && shionRerollUseCount(player, state.turn) < shionRerollUseLimit(player, map);
}

function payShionReroll(state, playerIndex, map) {
  assert(canUseShionReroll(state, playerIndex, map), "Holo Power 不足或紫咲シオン的重擲次數已用完。 ");
  const player = state.players[playerIndex];
  player.archive.push(player.holoPower.pop());
  const count = shionRerollUseCount(player, state.turn) + 1;
  player.shionRerollUsesTurn = state.turn;
  player.shionRerollUsesCount = count;
  player.oshiSkillTurn = state.turn;
  const oshi = map.get("hBP02-005");
  queueGiftOshiSkillEffects(state, playerIndex, oshi?.oshiSkill, "oshi", map);
  appendLog(state, player.name + " 支付 1 Holo Power 使用推し技能「ねえ゛え゛え゛え゛え゛え゛え゛」。");
}

function resolveShionAbilityDie(state, playerIndex, meta, map, random) {
  const die = Number(meta?.die || 0);
  if (meta?.effect === "collabSearch") {
    if (die >= 4) queueDeckToHand(state, playerIndex, { tags: ["#魔法"] }, map, random, { min: 1, max: 1, optional: true, label: "魔法見せてあげる" });
    return;
  }
  const threshold = meta?.effect === "artMove" ? 5 : 4;
  if (die < threshold) return;
  const ownerIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[ownerIndex];
  const options = stageCheerOptions(opponent, map);
  if (options.length > 0 && stageUnitCount(opponent) >= 2) enqueueStageCheerSelection(state, { playerIndex, ownerIndex, options, effect: "opponentMoveCheerSource", optional: false, prompt: "骰子達到 " + threshold + "：選對手 1 張應援，改附到另一位對手 Holomen。" });
}

function rollShionAbilityDie(state, playerIndex, meta, map, random, allowReroll = true) {
  const card = map.get(meta.sourceNumber);
  const die = rollDie(random, state, playerIndex, 1, card);
  logDie(state, playerIndex, die, allowReroll ? "因紫咲シオン能力擲骰" : "因推し技能重擲");
  const events = currentTurnEvents(state.players[playerIndex], state.turn);
  const resolvedMeta = { ...meta, die, diceEventIndex: (events.dice || []).length - 1 };
  if (allowReroll && canUseShionReroll(state, playerIndex, map)) {
    enqueueOptionChoice(state, {
      playerIndex,
      options: [{ id: "reroll", label: "支付 1 Holo Power，重新擲這顆骰子" }],
      optional: true,
      effect: "shionOshiReroll",
      prompt: "ねえ゛え゛え゛え゛え゛え゛え゛：可支付 1 Holo Power 重擲一次；略過則保留原結果。",
      meta: resolvedMeta,
    });
  } else resolveShionAbilityDie(state, playerIndex, resolvedMeta, map, random);
}

function resolveHaatoDie(state, playerIndex, meta, map) {
  const player = state.players[playerIndex];
  if (meta.mode === "arts") {
    if (meta.die % 2 === 1) queueFixedSpecialDamage(state, playerIndex, meta.sourceZone, ["center", "collab"], 20, meta.label);
    else adjustQueuedArtsDamage(state, playerIndex, meta.sourceZone, 40);
  } else if (meta.die % 2 === 1) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    if (state.players[opponentIndex].zones.center) enqueueEffect(state, {type:"specialDamage", playerIndex, targetPlayerIndex:opponentIndex, targetZone:"center", amount:20, loseLife:true, sourceName:meta.label, sourceZone:meta.sourceZone});
  } else appendLog(state, player.name + " 因骰子為偶數抽 " + drawCards(state, playerIndex, 1) + " 張牌。");
}

function rollHaatoDie(state, playerIndex, meta, map, random) {
  const player = state.players[playerIndex];
  const die = rollDie(random, state, playerIndex, 1, map.get(meta.sourceNumber));
  logDie(state, playerIndex, die);
  const rolled = {...meta, die, diceEventIndex:currentTurnEvents(player,state.turn).dice.length-1};
  const source = player.zones[meta.sourceZone];
  const fans = source && topCard(source)?.id === meta.sourceId ? source.attachments.filter(c=>c.number==="hBP03-108") : [];
  if (!fans.length) { resolveHaatoDie(state,playerIndex,rolled,map); return; }
  const options = [{id:"accept",label:"接受骰點 "+die}, ...fans.map(fan=>({id:"fan:"+fan.id,cardId:fan.id,label:"存檔 1 張 Haato豚，取消骰點 "+die+" 並重擲"}))];
  enqueueOptionChoice(state,{playerIndex,options,effect:"haatoReroll",optional:false,prompt:"擲骰結果："+die+"。選擇接受，或以此發動者的 Haato豚 重擲。",meta:rolled});
}

function rollDice(random, state, playerIndex, count, sourceCard, label = "擲骰") {
  const results = interactiveDice(random, state, playerIndex, Math.max(0, Number(count || 0)), sourceCard);
  appendLog(state, `${state.players[playerIndex].name} ${label}結果為 ${results.join("、")}。`);
  return results;
}

const TEXT_NUMBERS = Object.freeze({ 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 });

function textNumber(value) {
  return Number(value) || TEXT_NUMBERS[value] || 0;
}

const KNOWN_EFFECT_TAGS = Object.freeze([
  "#カエラ'sアームズ", "#秘密結社holoX", "#白上'sキャラクター", "#FLOW GLOW", "#Buzzグッズ", "#ホロウィッチ",
  "#ID1期生", "#ID2期生", "#ID3期生", "#DEV_IS", "#ReGLOSS", "#ゲーマーズ", "#ハーフエルフ",
  "#0期生", "#1期生", "#2期生", "#3期生", "#4期生", "#5期生", "#Advent", "#Justice", "#Promise",
  "#こよラボ", "#ケモミミ", "#シューター", "#サマー", "#ベイビー", "#きのこ", "#お酒", "#トリ", "#Myth",
  "#料理", "#射手", "#獸耳", "#語学", "#語言", "#食べ物", "#食物", "#魔法", "#鳥", "#歌", "#海", "#絵", "#繪", "#EN", "#ID", "#JP",
]);
const EFFECT_TAG_PATTERN = new RegExp(KNOWN_EFFECT_TAGS.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).sort((left, right) => right.length - left.length).join("|"), "gu");

function effectTags(text) {
  const normalized = String(text || "").replaceAll("#白上's角色", "#白上'sキャラクター");
  return [...new Set([...normalized.matchAll(new RegExp(EFFECT_TAG_PATTERN.source, "giu"))].map(match => KNOWN_EFFECT_TAGS.find(tag => tag.toLowerCase() === match[0].toLowerCase())))];
}

function firstEffectTag(text) {
  return effectTags(text)[0] || "";
}

function simpleKeywordCondition(state, playerIndex, zone, text, map, random, sourceCard = null) {
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const stageUnit = player.zones[zone];
  const events = currentTurnEvents(player, state.turn);
  if (!giftZoneApplies(text, zone)) return false;
  if (/從Debut(?:進化成)?Bloom時|從Debut Bloom時/u.test(text) && map.get(stageUnit?.stack?.at(-2)?.number)?.stage !== "Debut") return false;
  if (/生命(?:值)?為?3(?:或以下|以下)/u.test(text) && player.life.length > 3) return false;
  if (/生命(?:值)?不高於對手|生命值小於或等於對手/u.test(text) && player.life.length > opponent.life.length) return false;
  if (/生命值比對手少/u.test(text) && player.life.length >= opponent.life.length) return false;
  if (/(?:後攻|後手).*(?:第一|第1|首)回合/u.test(text) && !(playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1)) return false;
  if (/舞台上有5位(?:或以下|或更少)|舞台上的成員不超過5人/u.test(text) && stageUnitCount(player) > 5) return false;
  const requiredStageCount = text.match(/舞台上有\s*(\d+)\s*位以上(?:擁有|持有)?(#[^的，。\]]+)/u);
  if (requiredStageCount && stageHasTag(player, requiredStageCount[2], map).length < Number(requiredStageCount[1])) return false;
  const restedTagPrefix = text.match(/(?:有|若有)\s*(\d+)\s*(?:名|位)以上(?:持有)?(#[^且，。]+).*休息/u);
  const restedTagSuffix = text.match(/休息中的(#[^成員，。]+)成員有\s*(\d+)\s*人以上/u);
  if (restedTagPrefix || restedTagSuffix) {
    const required = Number(restedTagPrefix?.[1] || restedTagSuffix?.[2] || 0);
    const tag = restedTagPrefix?.[2] || restedTagSuffix?.[1] || "";
    if (stageEntries(player).filter(({ unit: candidate }) => candidate.rested && cardHasTag(unitCard(candidate, map), tag)).length < required) return false;
  }
  const requiredCheer = text.match(/舞台上有\s*(\d+)\s*張以上的?([白綠紅藍黃紫])色應援/u);
  if (requiredCheer) {
    const count = stageEntries(player).reduce((sum, { unit }) => sum + unit.cheer.filter((instance) => effectiveCheerColors(player, unit, instance, map).includes(requiredCheer[2])).length, 0);
    if (count < Number(requiredCheer[1])) return false;
  }
  const requiredTotalCheer = text.match(/舞台上有\s*(\d+)\s*張以上的?應援/u);
  if (requiredTotalCheer && totalCheer(player) < Number(requiredTotalCheer[1])) return false;
  const sourceCheerColor = text.match(/(?:這位|此)(?:Holomen|Holo成員|成員)(?:已)?附有([白綠紅藍黃紫])色應援/u)?.[1];
  if (sourceCheerColor && !(stageUnit?.cheer || []).some((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes(sourceCheerColor))) return false;
  if (/舞台上的應援(?:卡)?數量多於對手/u.test(text) && totalCheer(player) <= totalCheer(opponent)) return false;
  if (/舞台上的應援(?:卡)?數量不多於對手/u.test(text) && totalCheer(player) > totalCheer(opponent)) return false;
  if (/對手沒有(?:合作|Collab)Holomen|對手沒有合作位置/u.test(text) && opponent.zones.collab) return false;
  if (/(?:這位|此)Holomen(?:有攜帶|裝備有|已附有|帶有)吉祥物/u.test(text) && !(stageUnit?.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) return false;
  const requiredAttachment = text.match(/(?:這位|此)(?:Holomen|Holo成員|ホロメン)(?:上)?(?:有攜帶|裝備有|已附有|附有|附著|帶有)[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (requiredAttachment && !stageHasNamedAttachment(stageUnit, map, [requiredAttachment])) return false;
  const oshiName = text.match(/(?:推し|主推|喜推|所支持|本命|應援)(?:Holomen|Holo成員|ホロメン|成員).*?[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (oshiName && !cardHasName(map.get(player.oshi?.number), oshiName)) return false;
  const oshiColor = text.match(/(?:推し|主推|喜推|所支持|本命|應援)(?:Holomen|Holo成員|ホロメン|成員)(?:是|為)?([白綠紅藍黃紫])色/u)?.[1];
  if (oshiColor && !(map.get(player.oshi?.number)?.colors || []).includes(oshiColor)) return false;
  const centerTag = /中央|中心/u.test(text) ? firstEffectTag(text) : "";
  if (centerTag && /當自己的(?:中央|中心)|若自己的(?:中央|中心)|自己的(?:中央|中心).*(?:擁有|具有|持有)/u.test(text) && !cardHasTag(unitCard(player.zones.center, map), centerTag)) return false;
  const centerName = text.match(/(?:當|若|如果)(?:自己的|你的|我方)(?:中央|中心|中衛)(?:Holomen|Holomem|Holo成員|成員)?(?:是|為)?[〈「]([^〉」]+)[〉」]/u)?.[1]
    || text.match(/(?:自己的|你的|我方)(?:中央|中心|中衛)(?:Holomen|Holomem|Holo成員|成員)?(?:是|為)[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (centerName && !cardHasName(unitCard(player.zones.center, map), centerName)) return false;
  const stageName = text.match(/(?:當|若|如果)?(?:自己的|你的|我方)?舞台上有[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (stageName && !stageEntries(player).some(({ unit: candidate }) => cardHasName(unitCard(candidate, map), stageName))) return false;
  const namedStageAttachment = text.match(/(?:場上|舞台上)有附有[〈「]([^〉」]+)[〉」]的Holomen/u)?.[1];
  if (namedStageAttachment && !stageEntries(player).some(({ unit: candidate }) => stageHasNamedAttachment(candidate, map, [namedStageAttachment]))) return false;
  const attachedToNamed = text.match(/[〈「]([^〉」]+)[〉」](?:已)?附著在[〈「]([^〉」]+)[〉」]身上/u);
  if (attachedToNamed && !stageEntries(player).some(({ unit: candidate }) => cardHasName(unitCard(candidate, map), attachedToNamed[2]) && stageHasNamedAttachment(candidate, map, [attachedToNamed[1]]))) return false;
  const absentAttachmentOnNamed = text.match(/沒有附有[〈「]([^〉」]+)[〉」]的[〈「]([^〉」]+)[〉」]/u);
  if (absentAttachmentOnNamed && stageEntries(player).some(({ unit: candidate }) => cardHasName(unitCard(candidate, map), absentAttachmentOnNamed[2]) && stageHasNamedAttachment(candidate, map, [absentAttachmentOnNamed[1]]))) return false;
  if (/場上有裝備工具的\s*holomen/iu.test(text) && !stageEntries(player).some(({ unit: candidate }) => (candidate.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool"))) return false;
  if (/檔案區域?中有事件卡/u.test(text) && !player.archive.some((instance) => ["supportEvent", "supportEventLimited"].includes(map.get(instance.number)?.typeCode))) return false;
  const archiveHolomemCount = text.match(/檔案區域?中有\s*(\d+)\s*張以上的?Holomen/iu);
  if (archiveHolomemCount && player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length < Number(archiveHolomemCount[1])) return false;
  const archiveNamedCount = text.match(/檔案區域?中有\s*(\d+)\s*張以上的?[〈「]([^〉」]+)[〉」]/u);
  if (archiveNamedCount && player.archive.filter((instance) => cardHasName(map.get(instance.number), archiveNamedCount[2])).length < Number(archiveNamedCount[1])) return false;
  const handAtMost = text.match(/手牌(?:數)?(?:在|為)?\s*(\d+)\s*張?(?:或)?以下/u);
  if (handAtMost && player.hand.length > Number(handAtMost[1])) return false;
  if (/手牌數比對手少/u.test(text) && player.hand.length >= opponent.hand.length) return false;
  const usedEventTag = text.match(/本回合中曾使用過持有(#[^的，。]+)的事件/u)?.[1] || text.match(/本回合中自己若使用過持有(#[^的，。]+)的事件/u)?.[1];
  if (usedEventTag && !events.supports.some((number) => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode) && cardHasTag(map.get(number), usedEventTag))) return false;
  const previousKoTag = text.match(/前一個對手的回合中[^。]*持有(#[^的，。]+)的Holomen曾被擊倒/u)?.[1];
  if (previousKoTag && !(state.knockouts || []).some((entry) => entry.turn === state.turn - 1 && entry.ownerIndex === playerIndex && entry.sourcePlayerIndex !== playerIndex && cardHasTag(entry.card, previousKoTag))) return false;
  const dieText = /擲.*骰/u.test(text);
  if (dieText) {
    const die = rollDie(random, state, playerIndex, 1, sourceCard); logDie(state, playerIndex, die);
    if (/奇數/u.test(text) && die % 2 === 0) return false;
    if (/偶數/u.test(text) && die % 2 === 1) return false;
    const atMost = text.match(/(?:為|結果為)(\d+)(?:或以下|以下)/u);
    if (atMost && die > Number(atMost[1])) return false;
    const atLeast = text.match(/(?:為|結果為)(\d+)(?:或以上|以上)/u);
    if (atLeast && die < Number(atLeast[1])) return false;
    const listed = text.match(/若為((?:\d+[、，或及]?)+)/u)?.[1]?.match(/\d+/gu)?.map(Number) || [];
    if (listed.length > 0 && !listed.includes(die)) return false;
  }
  return true;
}

function simpleSearchRule(text) {
  const rule = {};
  const searchText = String(text || "").slice(Math.max(0, String(text || "").search(/(?:公開|選擇|展示)/u)));
  if (/Holomen|Holomem|Holo成員|成員卡|成員|ホロメン/u.test(searchText)) rule.group = "holomem";
  if (/支援卡|支援牌/u.test(searchText)) rule.group = "support";
  const attachmentTypes = [];
  if (/吉祥物/u.test(searchText)) attachmentTypes.push("supportMascot");
  if (/粉絲/u.test(searchText)) attachmentTypes.push("supportFan");
  if (/工具|道具/u.test(searchText)) attachmentTypes.push("supportTool", "supportItem", "supportItemLimited");
  if (attachmentTypes.length > 0) rule.typeCodes = [...new Set(attachmentTypes)];
  else if (/事件卡|活動卡/u.test(searchText)) rule.typeCodes = ["supportEvent", "supportEventLimited"];
  const tags = effectTags(searchText);
  if (tags.length > 0) rule.tags = [...new Set(tags)];
  const names = [...searchText.matchAll(/[〈「]([^〉」]+)[〉」]/gu)].map((match) => match[1]).filter((name) => !/推し|技能/u.test(name));
  if (names.length > 0) rule.names = [...new Set(names)];
  const stages = ["Debut", "1st", "2nd", "Spot"].filter((stage) => new RegExp(stage, "u").test(searchText));
  if (stages.length > 0) rule.stages = stages;
  const colorText = searchText.replaceAll("#白上's角色", "").replaceAll("#白上'sキャラクター", "");
  const colors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(colorText)).map(([color]) => color);
  if (colors.length > 0) rule.colors = colors;
  if (/不是Buzz|非Buzz|不是 Buzz/u.test(text)) rule.excludeBuzz = true;
  if (/Buzz Holomen|Buzz Holo/u.test(searchText) && !rule.excludeBuzz) rule.buzz = true;
  if (/與自己推しHolomen相同卡名/u.test(searchText)) rule.sameOshiName = true;
  if (/任意張數|不受張數限制/u.test(searchText)) rule.unlimitedDebut = true;
  if (/具有(?:綻放|Bloom)效果|有綻放效果/u.test(searchText)) rule.keywordTypes = ["bloom", "bloom_effect"];
  if (/(?:持有|擁有|同時擁有)(?:合作效果|コラボエフェクト)/u.test(searchText)) rule.keywordTypes = ["collab", "collab_effect"];
  return rule;
}

function simpleTargetRule(text) {
  const rule = {};
  const tag = firstEffectTag(text);
  if (tag) rule.tags = [tag];
  const color = skillColor(text);
  if (color) rule.colors = [color];
  const named = text.match(/(?:送給|送到|附加到|裝備到|選擇|讓)(?:自己的|你的|我方)?[^。；：]{0,30}?[〈「]([^〉」]+)[〉」]/u)?.[1]
    || text.match(/(?:自己的|你的|我方)[^。；：]{0,24}?[〈「]([^〉」]+)[〉」]/u)?.[1]
    || text.match(/(?:1位|一位|一名)[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (named) rule.names = [named];
  const stages = ["Debut", "1st", "2nd", "Spot"].filter((stage) => new RegExp(stage, "u").test(String(text || "")));
  if (stages.length > 0) rule.stages = stages;
  if (/(?:附有|裝備有|帶有|有)粉絲/u.test(text)) rule.hasAttachmentType = "supportFan";
  else if (/(?:附有|裝備有|帶有)(?:工具|道具)/u.test(text)) rule.hasAttachmentType = "supportTool";
  if (/(?:附有|裝備有|帶有)支援卡/u.test(text)) rule.hasAttachment = true;
  return rule;
}

function queueGenericTopLook(state, playerIndex, text, map, required = false, ruleOverride = null) {
  const player = state.players[playerIndex];
  const countMatch = text.match(/(?:牌庫|牌組)(?:頂|上方|最上方)(?:的)?\s*(?:查看|檢視)?\s*(\d+)\s*張/u) || text.match(/(?:查看|檢視)自己(?:的)?牌庫(?:頂|上方)(?:的)?\s*(\d+)\s*張/u);
  if (!countMatch || /應援牌庫|加油牌庫|吶喊牌組/u.test(text)) return false;
  const count = Number(countMatch[1]);
  const revealed = player.mainDeck.splice(0, Math.min(count, player.mainDeck.length));
  if (revealed.length === 0) return true;
  appendLog(state, `${player.name} 查看牌庫上方 ${revealed.length} 張牌。`);
  const rule = /從中(?:選擇|選)1張加入手牌|從中選1張加入手牌/u.test(text) && !/(?:公開|展示)1張/u.test(text) ? {} : simpleSearchRule(text);
  const selectableIds = revealed.filter((instance) => cardMatchesRule(map.get(instance.number), ruleOverride || rule, player, map)).map((instance) => instance.id);
  const arbitrary = /任意數量/u.test(text);
  const max = arbitrary ? selectableIds.length : Math.min(1, selectableIds.length);
  const remainder = /剩(?:下|餘).*(?:存檔|檔案)/u.test(text) ? "archive" : /剩(?:下|餘).*(?:牌庫頂|牌庫上方)/u.test(text) ? "top" : "bottom";
  if (max === 0) {
    if (remainder === "archive") player.archive.push(...revealed);
    else enqueueCardSelection(state, { playerIndex, cards: revealed, min: revealed.length, max: revealed.length, effect: remainder === "top" ? "topOrder" : "bottomOrder", source: "revealed", prompt: `沒有符合條件的卡；按次序放回牌庫${remainder === "top" ? "頂" : "底"}。` });
    return true;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards: revealed,
    selectableIds,
    min: required ? 1 : rule.group || rule.tags || rule.names || rule.colors || rule.typeCodes ? 0 : 1,
    max,
    optional: !required && Boolean(rule.group || rule.tags || rule.names || rule.colors || rule.typeCodes),
    effect: "genericTopLook",
    source: "revealed",
    prompt: arbitrary ? "公開任意數量符合條件的卡加入手牌。" : "從查看的卡中公開 1 張符合條件的卡加入手牌。",
    meta: { remainder },
  });
  return true;
}

function cheerTargetRuleFromText(text, sourceZone = "") {
  if (/這位Holomen|此Holomen|這位Holo成員|此成員|這位ホロメン|此ホロメン/u.test(text) && !/除(?:了)?這位|除此成員|除這位|另一位/u.test(text)) return { zones: [sourceZone] };
  const rule = simpleTargetRule(text);
  const alternative = text.match(/[【\[]([^】\]]+)[】\]]/u)?.[1] || "";
  if (alternative && /(?:或|與)/u.test(alternative)) {
    const names = [...alternative.matchAll(/[〈「]([^〉」]+)[〉」]/gu)].map((match) => match[1]);
    const tags = effectTags(alternative);
    if (names.length > 0 || tags.length > 0) {
      delete rule.names;
      delete rule.tags;
      rule.namesOrTags = { names, tags };
    }
  }
  const inlineAlternative = text.match(/[〈「]([^〉」]+)[〉」](?:或|與)(?:持有|擁有)?(#FLOW GLOW|#[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+)/u);
  if (inlineAlternative) {
    delete rule.names;
    delete rule.tags;
    rule.namesOrTags = { names: [inlineAlternative[1]], tags: [inlineAlternative[2]] };
  }
  const namedAlternative = text.match(/(?:送給|送到|附加到|裝備到)[^。；]*?[〈「]([^〉」]+)[〉」](?:或|與)[〈「]([^〉」]+)[〉」]/u);
  if (namedAlternative) {
    delete rule.names;
    rule.names = [namedAlternative[1], namedAlternative[2]];
  }
  const distributedNames = /(?:分別|各).*送給自己的/u.test(text) ? [...text.matchAll(/[〈「]([^〉」]+)[〉」]/gu)].map((match) => match[1]) : [];
  if (distributedNames.length > 0) rule.names = [...new Set(distributedNames)];
  const excludedName = text.match(/(?:不是|除(?:了)?)[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (excludedName) rule.excludeNames = [excludedName];
  if (/除(?:了)?這位|除此成員|除這位|另一位/u.test(text)) rule.excludeZones = [sourceZone];
  if (/後排|後場|後台|後援/u.test(text)) rule.zones = BACK_SLOTS;
  else if (/(?:中央|中心|中場).*(?:或|與).*合作/u.test(text)) rule.zones = ["center", "collab"];
  else if (/合作/u.test(text) && !/(?:進行合作|合作效果)/u.test(text)) rule.zones = ["collab"];
  else if (/中央|中心|中場|中置/u.test(text)) rule.zones = ["center"];
  const stages = ["Debut", "1st", "2nd", "Spot"].filter((stage) => new RegExp(stage, "u").test(String(text || "")));
  if (stages.length > 0) rule.stages = stages;
  return rule;
}

function queueCheerDeckSearch(state, playerIndex, text, sourceZone, map, random, { topCount = 0, optional = true, targetRuleOverride = null, colorsOverride = null } = {}) {
  const player = state.players[playerIndex];
  const targetRule = targetRuleOverride || cheerTargetRuleFromText(text, sourceZone);
  let colors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(text)).map(([color]) => color);
  if (/同色|相同顏色/u.test(text)) {
    const tag = firstEffectTag(text);
    const matchingUnits = stageEntries(player).filter(({ unit: stageUnit }) => !tag || cardHasTag(unitCard(stageUnit, map), tag));
    colors = [...new Set(matchingUnits.flatMap(({ unit: stageUnit }) => unitCard(stageUnit, map)?.colors || []))];
  }
  if (colorsOverride !== null) colors = colorsOverride;
  const pool = topCount > 0 ? player.cheerDeck.splice(0, Math.min(topCount, player.cheerDeck.length)) : [...player.cheerDeck];
  const selectableIds = pool.filter((instance) => (colorsOverride === null && colors.length === 0 && !/同色|相同顏色/u.test(text)) || (map.get(instance.number)?.colors || []).some((color) => colors.includes(color))).map((instance) => instance.id);
  if (selectableIds.length === 0) {
    if (topCount > 0) player.cheerDeck.push(...pool);
    else player.cheerDeck = shuffle(player.cheerDeck, random);
    return true;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards: pool,
    selectableIds,
    min: optional ? 0 : 1,
    max: 1,
    optional,
    effect: topCount > 0 ? "genericCheerTopPick" : "genericCheerDeckPick",
    source: "cheerDeck",
    prompt: `公開 1 張${colors.length ? ` ${colors.join("／")}色` : ""}應援；之後直接按牌桌上的合法 Holomen。`,
    meta: { targetRule, topCount, drawAfter: textNumber(text.match(/(?:之後|然後)[^。；]*?抽(?:取)?(?:自己牌庫)?\s*([1-9一二三四五])張/u)?.[1] || "0") },
  });
  return true;
}

function queueArchiveSupportAttachment(state, playerIndex, text, sourceZone, map) {
  const player = state.players[playerIndex];
  const rule = simpleSearchRule(text);
  if (!rule.typeCodes) rule.typeCodes = ["supportTool", "supportMascot", "supportFan"];
  const cards = player.archive.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
  if (cards.length === 0) return true;
  enqueueCardSelection(state, { playerIndex, cards, min: 0, max: 1, optional: true, effect: "genericArchiveSupportPick", source: "archive", prompt: "可揀 1 張存檔區附加卡；下一步直接按牌桌上的合法 Holomen。", meta: { targetRule: cheerTargetRuleFromText(text, sourceZone) } });
  return true;
}

function keywordCostRule(text) {
  const moveIndex = String(text || "").search(/(?:可以|可)?將|把/u);
  const ruleText = moveIndex >= 0 ? String(text || "").slice(moveIndex) : String(text || "");
  const rule = {};
  if (/Holomen|Holomem|Holo成員|成員卡|成員|ホロメン/u.test(ruleText)) rule.group = "holomem";
  if (/支援卡|支援牌/u.test(ruleText)) rule.group = "support";
  const attachmentTypes = [];
  if (/吉祥物/u.test(ruleText)) attachmentTypes.push("supportMascot");
  if (/粉絲/u.test(ruleText)) attachmentTypes.push("supportFan");
  if (/工具|道具/u.test(ruleText)) attachmentTypes.push("supportTool", "supportItem", "supportItemLimited");
  if (attachmentTypes.length > 0) rule.typeCodes = [...new Set(attachmentTypes)];
  else if (/事件/u.test(ruleText)) rule.typeCodes = ["supportEvent", "supportEventLimited"];
  const tags = effectTags(ruleText);
  if (tags.length > 0) rule.tags = [...new Set(tags)];
  const names = [...ruleText.matchAll(/[〈「]([^〉」]+)[〉」]/gu)].map((match) => match[1]);
  if (names.length > 0) rule.names = [...new Set(names)];
  const colors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(ruleText)).map(([color]) => color);
  if (colors.length > 0) rule.colors = colors;
  return rule;
}

function resolveGenericKeywordRemainder(state, playerIndex, meta, map, random, paidCount = 1) {
  const player = state.players[playerIndex];
  const source = player.zones[meta?.sourceZone];
  const card = map.get(meta?.cardNumber) || unitCard(source, map);
  if (!card || !source || topCard(source)?.id !== meta?.sourceId) return;
  if (card.number === "hBP08-067" && !meta?.isArt) {
    const ownerIndex = playerIndex === 0 ? 1 : 0;
    const opponent = state.players[ownerIndex];
    const options = stageCheerOptions(opponent, map);
    if (options.length && stageUnitCount(opponent) >= 2) enqueueStageCheerSelection(state, { playerIndex, ownerIndex, options, effect: "opponentMoveCheerSource", optional: false, prompt: "選擇對手舞台的1張應援，改附到對手其他 Holomen。" });
    return;
  }
  if (card.number === "hBP06-081" && !meta?.isArt) { queueDeckToHand(state, playerIndex, { names: ["大空スバル"] }, map, random, { optional: false, label: card.keyword.name }); return; }
  if ((card.number === "hEB01-013" && !meta?.isArt) || (card.number === "hEB01-015" && meta?.isArt)) {
    if (player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: stageOptions(player), optional: false, prompt: "選擇自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
    return;
  }
  if ((card.number === "hSD02-006" && !meta?.isArt) || (card.number === "hSD02-008" && meta?.isArt)) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const options = stageOptionsMatching(state.players[opponentIndex], map, { zones: ["center", "collab"] });
    if (options.length) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", optional: false, meta: { amount: card.number === "hSD02-008" ? 50 : 20, loseLife: true, sourceName: card.keyword?.name || card.arts?.[meta.artIndex]?.name, sourceZone: meta.sourceZone } });
    return;
  }
  if (card.number === "hBP05-056" && meta?.isArt) {
    queueArchiveToHand(state, playerIndex, { group: "holomem", tags: ["#料理"] }, map, { optional: false, label: card.arts[1].name });
    return;
  }
  if (card.number === "hBP03-062" && !meta?.isArt) {
    queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["Debut"], tags: ["#ゲーマーズ"] }, map, random, { optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hSD04-004" && !meta?.isArt) {
    queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#食物"] }, map, random, { optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hSD02-011" && !meta?.isArt) {
    const options = stageOptionsMatching(player, map, { stages: ["Debut"] });
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false });
    return;
  }
  if (card.number === "hBP08-085" && !meta?.isArt) {
    queueArchiveToHand(state, playerIndex, { group: "holomem", stages: ["Debut", "1st", "Spot"] }, map, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP08-089" && !meta?.isArt) {
    queueDeckAttachmentToStage(state, playerIndex, { names: ["Popo"] }, {}, map, random, card.keyword.name, { optional: false });
    return;
  }
  if (card.number === "hBP08-048" && !meta?.isArt) {
    queueDeckToHand(state, playerIndex, { names: ["けはい"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP08-030" && !meta?.isArt) {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS });
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇自己後排 Holomen，附加應援牌庫頂 1 張。" });
    return;
  }
  if (card.number === "hBP06-078" && !meta?.isArt) {
    queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["Debut"], sameOshiName: true }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP06-083" && !meta?.isArt) {
    queueArchiveToHand(state, playerIndex, { names: ["角巻わため", "角卷わため", "大空スバル"] }, map, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP06-038" && !meta?.isArt) {
    queueArchiveToHand(state, playerIndex, { names: ["百鬼あやめ"] }, map, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP08-042") {
    enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: `振翅高飛：直接按自己 1 位 Holomen，本回合 Arts +${paidCount * 10}。`, meta: { kind: "arts", amount: paidCount * 10, sourceNumber: card.number } });
    return;
  }
  if (card.number === "hBP08-065") {
    const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die, "因鷹嶺琉依的 Bloom 效果擲骰");
    appendLog(state, `${player.name} 擲出 ${die}，抽 ${drawCards(state, playerIndex, die === 1 ? 3 : 1)} 張牌。`);
    return;
  }
  if (card.number === "hBP08-062") {
    queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], unlimitedDebut: true }, map, random, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    return;
  }
  if (card.number === "hBP05-027") {
    const candidates = player.mainDeck.filter((instance) => map.get(instance.number)?.group === "holomem" || map.get(instance.number)?.typeCode === "supportTool");
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "deckToHandShuffle", source: "deck", prompt: "公開 1 張 Holomen 或工具加入手牌，然後洗牌。" });
    else player.mainDeck = shuffle(player.mainDeck, random);
    return;
  }
  if (meta?.isArt && card.number === "hBP01-087" && Number(meta.artIndex) === 1) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const amount = BACK_SLOTS.reduce((sum, targetZone) => sum + Number(state.players[opponentIndex].zones[targetZone]?.damage || 0), 0);
    if (state.players[opponentIndex].zones.center) state.effectQueue.unshift({ type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount, loseLife: true, sourceName: card.arts?.[meta.artIndex]?.name || card.name, sourceZone: meta.sourceZone });
    return;
  }
  if (meta?.isArt && card.number === "hBP02-027") {
    const archived = player.archive.at(-1);
    const archivedCard = map.get(archived?.number);
    const bonus = archivedCard?.group === "holomem" ? 20 : archivedCard?.group === "support" ? 50 : 0;
    if (bonus > 0) adjustQueuedArtsDamage(state, playerIndex, meta.sourceZone, bonus);
    appendLog(state, `${player.name} 將牌庫頂 ${archivedCard?.name || archived?.number || "1 張卡"} 放到存檔區，這次 Arts +${bonus}。`);
    return;
  }
  if (meta?.isArt && card.number === "hBP05-035") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const options = stageOptionsMatching(state.players[opponentIndex], map, { zones: ["center", "collab"] });
    if (options.length > 0) state.effectQueue.unshift({ type: "stageTarget", playerIndex, targetPlayerIndex: opponentIndex, options, rule: { zones: ["center", "collab"] }, prompt: "あえんびえん：直接按對手中央或合作，造成 50 點特殊傷害。", effect: "specialDamage", optional: false, meta: { amount: 50, loseLife: true, sourceName: card.arts?.[meta.artIndex]?.name || card.name, sourceZone: meta.sourceZone } });
    if (stageEntries(player).some(({ unit: stageUnit }) => stageUnit.attachments.some((instance) => cardHasName(map.get(instance.number), "35P")))) appendLog(state, `${player.name} 因舞台有 35P 抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return;
  }
  if (meta?.isArt && card.number === "hBP07-069" && Number(meta.artIndex) === 1) {
    const frontierCount = player.archive.filter((instance) => cardHasName(map.get(instance.number), "フロンティアスピリット")).length;
    if (frontierCount >= 4) queueExtraLifeLoss(state, playerIndex === 0 ? 1 : 0, playerIndex, map, card.arts?.[meta.artIndex]?.name || card.name);
    return;
  }
  if (card.number === "hBP07-034") {
    queueHsd11SpOshiTrigger(state, playerIndex, paidCount, map);
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#FLOW GLOW"], stages: ["Debut", "1st", "Spot"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return;
  }
  if (card.number === "hBP02-046" && !meta?.isArt) {
    queueArchiveToHand(state, playerIndex, { tags: ["#魔法"] }, map, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    return;
  }
  if (card.number === "hSD11-004") {
    queueArchiveToHand(state, playerIndex, { group: "holomem", names: ["虎金妃笑虎"] }, map, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    queueHsd11SpOshiTrigger(state, playerIndex, paidCount, map);
    return;
  }
  if (card.number === "hSD12-006") {
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#Advent"], stages: ["Debut", "1st"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    return;
  }
  if (card.number === "hSD10-010") {
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#FLOW GLOW"], keywordTypes: ["collab_effect", "collab"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    return;
  }
  if (meta?.isArt && card.number === "hBP08-074") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    for (let index = 0; index < Math.min(paidCount, stageUnitCount(state.players[opponentIndex])); index += 1) {
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, effect: "addModifier", prompt: `ネクロ・エリミネーション!!（${index + 1}/${paidCount}）：直接按對手 1 位 Holomen，本回合視為所有顏色。`, meta: { kind: "allColors", amount: 1, sourceNumber: card.number } });
    }
    return;
  }
  let effectText = String(meta?.effectText || "");
  if (meta?.isArt) {
    const perPaidBonus = effectText.match(/(?:每(?:放入|放進|存入|存檔|送入)1張|按每張[^。；]*)(?:卡牌?)?[^。；]*?(?:此|這個|這張)?(?:技能|Arts|藝術|招式|戰技|藝能)?[^。；]*?[+＋]\s*(\d+)/iu);
    const fixedBonus = effectText.match(/(?:此|這個|這張)(?:技能|Arts|藝術(?:卡|牌)?|招式|戰技|藝能)(?:的)?(?:力量|威力|數值|攻擊力|傷害|效果)?\s*(?:就|額外|獲得)?\s*[+＋]\s*(\d+)/iu);
    const bonus = perPaidBonus ? paidCount * Number(perPaidBonus[1]) : Number(fixedBonus?.[1] || 0);
    if (bonus > 0 && adjustQueuedArtsDamage(state, playerIndex, meta.sourceZone, bonus)) appendLog(state, `${player.name} 支付成本後，這次 Arts +${bonus}。`);

    const perPaidDamage = effectText.match(/(?:按每張[^。；]*|每(?:放入|放進|存入|存檔|送入)1張[^。；]*)(?:造成|給予)[^。；]*?(\d+)點特殊傷害/u);
    if (perPaidDamage) {
      const amount = paidCount * Number(perPaidDamage[1]);
      effectText = effectText.replace(/(?:按每張[^。；]*|每(?:放入|放進|存入|存檔|送入)1張[^。；]*)(?:造成|給予)[^。；]*?\d+點特殊傷害/u, `造成${amount}點特殊傷害`);
    }
  }
  const fauxCard = { ...card, keyword: { ...(card.keyword || {}), effect: effectText } };
  queueSimpleTriggeredKeyword(state, playerIndex, meta.sourceZone, fauxCard, map, random, { skipBuff: Boolean(meta?.isArt), conditionChecked: true });
}

function queueGenericKeywordCostEffects(state, playerIndex, zone, card, map, context = {}) {
  const text = String(card?.keyword?.effect || "");
  const separator = text.search(/[：:]/u);
  if (separator < 0) return false;
  const costText = text.slice(0, separator);
  const effectText = text.slice(separator + 1).trim();
  if (!effectText || !/(?:放進|放入|放到|放置到|置入|存入|存檔|歸檔|返回|放回)/u.test(costText)) return false;
  const player = state.players[playerIndex];
  const source = player.zones[zone];
  const meta = { sourceZone: zone, sourceId: topCard(source)?.id, cardNumber: card.number, effectText, ...context };
  const range = costText.match(/([1-9一二三四五])\s*(?:至|到|[～~-])\s*([1-9一二三四五])\s*張/u);
  const exact = textNumber(costText.match(/([1-9一二三四五])\s*張/u)?.[1] || "1");
  const min = range ? textNumber(range[1]) : exact;
  const max = range ? textNumber(range[2]) : exact;

  if (/手牌/u.test(costText) && /(?:牌庫|牌組)底/u.test(costText)) {
    const rule = keywordCostRule(costText);
    const cards = player.hand.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
    if (cards.length >= min) enqueueCardSelection(state, { playerIndex, cards, min, max: Math.min(max, cards.length), effect: "genericKeywordHandBottomCost", source: "hand", optional: true, prompt: `${card.keyword?.name || card.name}：可揀 ${min === max ? min : `${min}–${Math.min(max, cards.length)}`} 張符合條件的手牌放到牌庫底以支付成本。`, meta });
    return true;
  }

  if (/手牌/u.test(costText)) {
    const rule = keywordCostRule(costText);
    const cards = player.hand.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
    enqueueHolomemHandArchive(state, { playerIndex, cards, min, max, effect: "genericKeywordHandArchiveCost", source: "hand", optional: true, prompt: `${card.keyword?.name || card.name}：可存檔 ${min === max ? min : `${min}–${max}`} 張符合條件的手牌以支付成本。`, meta }, unitCard(source, map) || card, map);
    return true;
  }

  if (/重疊|下方/u.test(costText) && /Holomen|Holomem|成員|ホロメン/u.test(costText)) {
    const rule = keywordCostRule(costText);
    const cards = (source?.stack || []).slice(0, -1).filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
    if (cards.length >= min) enqueueCardSelection(state, { playerIndex, cards, min, max: Math.min(max, cards.length), effect: "genericKeywordUnderArchiveCost", source: "stack", optional: true, prompt: `${card.keyword?.name || card.name}：可揀下方 ${min === max ? min : `${min}–${Math.min(max, cards.length)}`} 張 Holomen 放到存檔區以支付成本。`, meta });
    return true;
  }

  if (/Holo\s*(?:Power|能量)/iu.test(costText)) {
    if (player.holoPower.length >= min) enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: `將最新 ${min} 張 Holo Power 放到存檔區` }], effect: "genericKeywordPowerCost", optional: true, prompt: `${card.keyword?.name || card.name}：可支付 Holo Power 成本。`, meta: { ...meta, amount: min } });
    return true;
  }

  if (/(?:應援|加油|吶喊)牌庫(?:頂|最上方|上方)/u.test(costText)) {
    const availableMax = Math.min(max, player.cheerDeck.length);
    const options = Array.from({ length: Math.max(0, availableMax - min + 1) }, (_, index) => ({ id: String(min + index), label: `將應援牌庫頂 ${min + index} 張放到存檔區` }));
    if (options.length > 0) enqueueOptionChoice(state, { playerIndex, options, effect: "genericKeywordCheerDeckCost", optional: true, prompt: `${card.keyword?.name || card.name}：可支付應援牌庫成本。`, meta: { ...meta, amount: min, min, max: availableMax } });
    return true;
  }

  if (/(?:牌庫|牌組)(?:頂|上方)/u.test(costText)) {
    if (player.mainDeck.length >= min) enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: `將牌庫頂 ${min} 張放到存檔區` }], effect: "genericKeywordMainDeckCost", optional: true, prompt: `${card.keyword?.name || card.name}：可支付牌庫頂成本。`, meta: { ...meta, amount: min } });
    return true;
  }

  if (/這位Holomen|此Holomen|這位成員|此成員|這位Holo成員|此ホロメン/u.test(costText) && /(?:應援|加油|吶喊)/u.test(costText)) {
    const colors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(costText)).map(([color]) => color);
    const options = (source?.cheer || []).filter((instance) => {
      const cheerColors = effectiveCheerColors(player, source, instance, map);
      if (/非紫色/u.test(costText)) return !cheerColors.includes("紫");
      return colors.length === 0 || cheerColors.some((color) => colors.includes(color));
    }).map((instance) => ({ id: instance.id, number: instance.number, zone }));
    if (cardHasName(card, "猫又おかゆ") && (colors.length === 0 || colors.includes("藍"))) options.push(...(source?.attachments || []).filter(c => c.number === "hSD03-013").map(c => ({ id: c.id, number: c.number, zone, cheerSubstitute: true })));
    if (options.length >= min) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericKeywordCheerCost", optional: !["hSD03-009", "hBP03-062"].includes(card.number), prompt: `${card.keyword?.name || card.name}：直接按來源身上應援支付成本；亦可略過。`, meta: { ...meta, remaining: min, paid: 0, cheerScope: "source" } });
    return true;
  }

  if (/(?:舞台上|場上|後排(?:成員|Holomen)|[〈「][^〉」]+[〉」]的(?:應援|加油|吶喊)|#[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]+[^。；]*?(?:應援|加油|吶喊))/u.test(costText) && /(?:應援|加油|吶喊)/u.test(costText)) {
    const stageRule = /後排/u.test(costText) ? { zones: BACK_SLOTS } : keywordCostRule(costText);
    const options = stageCheerOptions(player, map, { stage: stageRule });
    if (options.length >= min) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericKeywordCheerCost", optional: true, prompt: `${card.keyword?.name || card.name}：直接按舞台應援支付成本；亦可略過。`, meta: { ...meta, remaining: min, paid: 0, cheerScope: "stage" } });
    return true;
  }

  if (/(?:裝備|附著|附加).*(?:工具|吉祥物|粉絲|[〈「][^〉」]+[〉」])/u.test(costText)) {
    const rule = card.number === "hBP05-027" ? { typeCodes: ["supportTool"] } : keywordCostRule(costText);
    const options = stageAttachmentOptions(player, map, (instance, attachment, attachmentZone) => attachmentZone === zone && cardMatchesRule(attachment, rule, player, map));
    if (options.length >= min) enqueueStageAttachmentSelection(state, { playerIndex, options, effect: "genericKeywordAttachmentCost", optional: true, prompt: `${card.keyword?.name || card.name}：直接按來源的附加卡放到存檔區以支付成本。`, meta: { ...meta, remaining: min, paid: 0 } });
    return true;
  }
  return false;
}

function completeGenericCheerMove(state, playerIndex, meta, map) {
  const player = state.players[playerIndex];
  const source = player.zones[meta?.sourceZone];
  const movedCount = (meta?.movedIds || []).length;
  if (movedCount >= Number(meta?.minimumMoved || 1) && Number(meta?.afterArtBonus || 0) > 0) {
    adjustQueuedArtsDamage(state, playerIndex, meta.sourceZone, Number(meta.afterArtBonus));
    appendLog(state, `${player.name} 完成應援改附，這次 Arts +${Number(meta.afterArtBonus)}。`);
  }
  if (movedCount >= Number(meta?.minimumMoved || 1) && Number(meta?.afterSpecialDamage || 0) > 0) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const targetZone = meta?.afterSpecialTarget || "center";
    if (state.players[opponentIndex].zones[targetZone]) state.effectQueue.unshift({ type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone, amount: Number(meta.afterSpecialDamage), loseLife: meta?.afterSpecialLoseLife !== false, sourceName: meta?.sourceName || "Arts 效果", sourceZone: meta.sourceZone });
  }
  if (meta?.cardNumber === "hBP08-057" && source && totalCheer(player) >= 8) {
    addStageModifier(source, "arts", 40, state.turn, meta.cardNumber);
    appendLog(state, `${unitCard(source, map)?.name || "Gift 來源"} 因舞台有 8 張以上應援，本回合 Arts +40。`);
  }
}

function queueGenericStageCheerMove(state, playerIndex, zone, card, text, map) {
  const sourceOnly = /(?:這位|此)(?:Holomen|Holomem|Holo成員|成員|ホロメン)(?:的|所附著的?)?.*(?:應援|加油|吶喊).*(?:改附|轉移|轉換(?:並)?附加|改為附加|重新附加|重新裝備)/iu.test(text);
  if (card.number !== "hBP03-078" && !sourceOnly && !/(?:舞台|場上).*(?:應援|加油|吶喊).*(?:改附|轉移|轉換(?:並)?附加|改為附加|重新附加|重新裝備|分配)/u.test(text)) return false;
  const player = state.players[playerIndex];
  const range = text.match(/([1-9一二兩三四五])\s*[～~-]\s*([1-9一二兩三四五])\s*張/u);
  const arbitrary = /任意(?:張數|數量)/u.test(text);
  const max = arbitrary ? totalCheer(player) : range ? textNumber(range[2]) : textNumber(text.match(/([1-9一二兩三四五])\s*張/u)?.[1] || "1");
  const fixedTarget = /(?:附加|改附|轉移|裝備|改為附加)(?:到|給)這位Holomen|給這位Holomen/u.test(text) ? zone : "";
  const sourceColors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(text)).map(([color]) => color);
  const sourceRule = { ...(sourceColors.length > 0 ? { colors: sourceColors } : {}), ...(card.number === "hBP03-078" ? { stage: { tags: ["#ID1期生"] } } : sourceOnly ? { stage: { zones: [zone] } } : {}) };
  const options = stageCheerOptions(player, map, sourceRule).filter((option) => !fixedTarget || option.zone !== fixedTarget);
  if (options.length === 0 || max <= 0) {
    completeGenericCheerMove(state, playerIndex, { sourceZone: zone, cardNumber: card.number }, map);
    return true;
  }
  const targetRule = card.number === "hBP03-073" ? { names: ["戌神ころね"] } : card.number === "hBP03-044" ? { zones: BACK_SLOTS, names: ["星街すいせい"] } : card.number === "hBP03-078" ? {} : card.number === "hBP03-048" ? { zones: BACK_SLOTS, tags: ["#ReGLOSS"] } : card.number === "hBP08-057" ? { names: ["モココ・アビスガード", "Mococo Abyssgard"] } : fixedTarget ? { zones: [fixedTarget] } : cheerTargetRuleFromText(text, zone);
  if (card.number === "hBP08-057") {
    const targets = stageOptionsMatching(player, map, targetRule);
    if (targets.length > 0) enqueueStageTarget(state, { playerIndex, options: targets, effect: "genericMoveCheerTargetFirst", optional: true, prompt: "木漏れ日のブランコ：先直接按自己 1 位 Mococo Abyssgard；之後按實際應援改附。", meta: { sourceZone: zone, cardNumber: card.number, remaining: Math.min(max, options.length), excludeSourceCard: false } });
    else completeGenericCheerMove(state, playerIndex, { sourceZone: zone, cardNumber: card.number }, map);
    return true;
  }
  enqueueStageCheerSelection(state, {
    playerIndex,
    options,
    effect: "genericMoveCheer",
    optional: true,
    prompt: `${card.keyword?.name || card.name}：直接按舞台上的實際應援改附；可略過完成。`,
    meta: { sourceZone: zone, cardNumber: card.number, remaining: Math.min(max, options.length), targetZone: fixedTarget, targetRule, excludeSourceCard: /除這位|另一位/u.test(text) },
  });
  return true;
}

function queueGenericStageAttachmentMove(state, playerIndex, zone, card, text, map) {
  if (!/(?:舞台|場上).*(?:吉祥物|工具|粉絲).*(?:改附|轉移|轉換裝備|重新附加|重新裝備)/u.test(text)) return false;
  const player = state.players[playerIndex];
  const typeCodes = /吉祥物/u.test(text) ? ["supportMascot"] : /工具/u.test(text) ? ["supportTool"] : /粉絲/u.test(text) ? ["supportFan"] : [];
  const options = stageAttachmentOptions(player, map, (instance, attachment) => typeCodes.length === 0 || typeCodes.includes(attachment?.typeCode));
  if (options.length === 0) return true;
  enqueueStageAttachmentSelection(state, { playerIndex, options, effect: "genericMoveAttachmentSource", optional: true, prompt: `${card.keyword?.name || card.name}：直接按舞台上的實際附加卡；下一步按接收 Holomen。`, meta: { sourceZone: zone, cardNumber: card.number, targetRule: cheerTargetRuleFromText(text, zone), excludeSourceCard: /除這位|另一位/u.test(text) } });
  return true;
}

function queueSimpleTriggeredKeyword(state, playerIndex, zone, card, map, random, { skipBuff = false, conditionChecked = false } = {}) {
  const text = String(card?.keyword?.effect || "");
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  if (!text) return false;
  if (card.number === "hBP03-079") { queueCheerDeckSearch(state,playerIndex,text,zone,map,random,{optional:false,colorsOverride:["黃"],targetRuleOverride:{zones:[zone]}});return true; }
  if (card.number === "hBP04-053") { if(player.cheerDeck.length)enqueueEffect(state,{type:"eventCheerTarget",playerIndex,options:stageOptionsMatching(player,map,{tags:["#EN"]}),optional:false,prompt:"選擇EN Holomen附加應援牌庫頂1張。"});return true; }
  if (card.number === "hBP04-037") return true;
  if (card.number === "hBP04-025") {
    queueDeckToHand(state, playerIndex, { typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#きのこ"] }, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hPR-001") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "promoFlowerRoll", prompt: "可擲一次骰子。" });
    return true;
  }
  if (card.number === "hBP07-083") {
    if (zone === "center") {
      const expiresTurn = state.turn + (state.activePlayer === playerIndex ? 1 : 2);
      state.players.forEach(owner => stageEntries(owner).forEach(({unit}) => addStageModifier(unit, "arts", 40, expiresTurn, card.number)));
      stageEntries(player).filter(({unit}) => unitCard(unit,map)?.stage === "2nd" && cardHasName(unitCard(unit,map), "桃鈴ねね")).forEach(({unit}) => addStageModifier(unit, "arts", 60, expiresTurn, card.number));
    }
    return true;
  }
  if (card.number === "hBP07-081") {
    if (player.holoPower.length >= 4 && !opponent.zones.collab && BACK_SLOTS.some(targetZone => opponent.zones[targetZone])) enqueueEffect(state, { type: "forcedCollab", playerIndex: opponentIndex, prompt: "選擇後排成員移到合作位置（不視為合作）。" });
    return true;
  }
  if (card.number === "hBP07-058") {
    const colors = [...new Set(stageEntries(player).filter(({unit}) => cardHasTag(unitCard(unit,map), "#ID3期生")).flatMap(({unit}) => unitCard(unit,map)?.colors || []))];
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: colors, targetRuleOverride: {} });
    return true;
  }
  if (card.number === "hBP07-076") {
    if (cardHasName(map.get(player.oshi?.number), "ネリッサ・レイヴンクロフト")) {
      drawCards(state, playerIndex, 1);
      if (player.hand.length) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 1, max: 1, optional: false, effect: "giftHandToPower", source: "hand", prompt: "選擇1張手牌變為 Holo Power。" });
    }
    return true;
  }
  if (card.number === "hBP07-021") {
    const candidates = player.archive.filter(instance => ["BAZO", "Zecretary"].some(name => cardHasName(map.get(instance.number), name)) && attachmentTargets(player, map.get(instance.number), map).length);
    if (candidates.length) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "genericArchiveSupportPick", source: "archive", prompt: "選擇1張 BAZO 或 Zecretary 附加。", meta: { targetRule: {} } });
    return true;
  }
  if (card.number === "hBP04-085") {
    const colors = [...new Set(stageEntries(player).filter(({unit}) => cardHasTag(unitCard(unit,map), "#5期生")).flatMap(({unit}) => unitCard(unit,map)?.colors || []))];
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: colors, targetRuleOverride: { tags: ["#5期生"] } });
    return true;
  }
  if (card.number === "hBP06-062") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) {
      const candidates = player.mainDeck.filter(instance => cardHasName(map.get(instance.number), "ろぼさー"));
      const count = Math.min(2, candidates.length);
      if (count) enqueueCardSelection(state, { playerIndex, cards: candidates, min: count, max: count, optional: true, source: "deck", effect: "deckToHandShuffle", prompt: "可公開2張ろぼさー加入手牌，然後洗牌。" });
      else player.mainDeck = shuffle(player.mainDeck, random);
    }
    return true;
  }
  if (card.number === "hBP06-059") {
    if (stageEntries(player).filter(({ unit }) => cardHasTag(unitCard(unit, map), "#EN")).length >= 3) queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: ["藍", "紫"], targetRuleOverride: {} });
    return true;
  }
  if (card.number === "hBP06-021") {
    enqueueStageTarget(state, { playerIndex, options: stageOptionsMatching(player, map, { tags: ["#秘密結社holoX"] }), effect: "koyoriLabBuff", optional: false, prompt: "選擇 holoX Holomen：Arts +30；裝備こよラボ支援則 +50。" });
    return true;
  }
  if (card.number === "hBP06-035") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckAttachmentToStage(state, playerIndex, { typeCodes: ["supportTool", "supportMascot", "supportFan"] }, { names: ["百鬼あやめ"] }, map, random, card.keyword.name, { optional: false });
    return true;
  }
  if (card.number === "hBP06-049") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: ["藍"], targetRuleOverride: { names: ["ムーナ・ホシノヴァ"] } });
    return true;
  }
  if (card.number === "hBP07-061" && /查看/u.test(text)) {
    if (cardHasName(map.get(player.oshi?.number), "シオリ・ノヴェラ")) queueGenericTopLook(state, playerIndex, text.slice(text.indexOf("查看")), map, true);
    return true;
  }
  if (card.number === "hBP07-026") {
    queueDeckToHand(state, playerIndex, { names: ["ハトタウロス", "ミオファ"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP07-015") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ID3期生"], buzz: true }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (["hBP06-076", "hBP06-080"].includes(card.number)) {
    queueDeckToHand(state, playerIndex, { names: card.number === "hBP06-076" ? ["えびふらいおん", "まつりす"] : ["スバルドダック", "スバ友"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-073") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1 && cardHasName(map.get(player.oshi?.number), "夏色まつり")) queueDeckToHand(state, playerIndex, { group: "support", limited: true }, map, random, { min: 1, max: 1, optional: true, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-036") {
    queueDeckToHand(state, playerIndex, { names: ["阿修羅＆羅刹", "鬼神刀「阿修羅」", "ぽよ余"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-032") {
    const options = stageEntries(player).filter(entry => entry.zone !== zone && cardHasTag(unitCard(entry.unit, map), "#Justice")).map(entry => entry.zone);
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇此成員以外的 #Justice 成員，附加應援牌庫頂 1 張。" });
    return true;
  }
  if (card.number === "hBP06-010") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut", "Spot"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-016") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#FLOW GLOW"], keywordTypes: ["collab_effect", "collab"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-011") {
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#Justice"], stages: ["Debut", "1st"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP06-013") {
    queueDeckToHand(state, playerIndex, { names: ["Chattino"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP07-059" && /支援卡/u.test(text)) {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueArchiveToHand(state, playerIndex, { group: "support" }, map, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (["hBP04-019", "hBP03-059", "hBP03-044", "hSD08-002", "hSD09-002", "hBP05-051", "hBP07-070", "hBP07-067", "hBP07-071", "hBP07-078", "hBP08-063"].includes(card.number) && /查看|檢視/u.test(text)) return queueGenericTopLook(state, playerIndex, text, map, true, card.number === "hBP07-071" ? { group: "holomem", stages: ["Debut"], colors: ["紫"] } : null);
  if (["hBP05-062", "hBP05-071"].includes(card.number) && /加入手牌/u.test(text)) {
    const count = card.number === "hBP05-062" ? 2 : 1;
    queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st"], excludeBuzz: true, tags: [card.number === "hBP05-062" ? "#歌" : "#ゲーマーズ"] }, map, random, { min: count, max: count, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP05-060" && /Jailbird/u.test(text)) {
    queueDeckToHand(state, playerIndex, { names: ["ネリッサ・レイヴンクロフトの杖", "Jailbird"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP07-090") {
    const cards = player.archive.filter(instance => map.get(instance.number)?.group === "cheer");
    if (cards.length && stageOptionsMatching(player, map, { tags: ["#FLOW GLOW"] }).length) enqueueCardSelection(state, { playerIndex, cards, min: Math.min(2, cards.length), max: Math.min(2, cards.length), optional: true, effect: "archiveCheerOneRecipient", source: "archive", prompt: "可選擇檔案區 2 張應援，附加到 1 位 #FLOW GLOW 成員。", meta: { targetRule: { tags: ["#FLOW GLOW"] } } });
    return true;
  }
  if (card.number === "hBP08-014") {
    const purple = player.zones[zone].cheer.some(cheer => effectiveCheerColors(player, player.zones[zone], cheer, map).includes("紫"));
    queueFixedSpecialDamage(state, playerIndex, zone, purple ? ["center", "collab"] : ["center"], 30, card.keyword.name);
    return true;
  }
  if (["hBP08-025", "hBP08-026"].includes(card.number)) {
    const rested = stageEntries(player).filter(({ unit }) => unit.rested && cardHasTag(unitCard(unit, map), "#Justice")).length;
    if (rested >= 2) {
      const targets = card.number === "hBP08-025" ? stageEntries(player).map(({ unit }) => unit) : [player.zones[zone]];
      targets.forEach(unit => addStageModifier(unit, "arts", card.number === "hBP08-025" ? 20 : 50, state.turn, card.number));
    }
    return true;
  }
  if (card.number === "hBP08-027") {
    const count = stageEntries(player).filter(({ unit }) => unit.rested && cardHasTag(unitCard(unit, map), "#Justice")).length;
    if (count > 0) enqueueArchiveCheerToTarget(state, playerIndex, { min: count, max: count, optional: false, targetZone: zone, targetRule: { zones: [zone] } }, map);
    return true;
  }
  if (card.number === "hBP08-037") {
    if (stageEntries(player).some(({ unit }) => cardHasName(unitCard(unit, map), "フワワ・アビスガード"))) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: "選擇對手中央或合作 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceName: card.keyword.name, sourceZone: zone } });
    return true;
  }
  if (card.number === "hBP08-055" && /檔案/u.test(text)) {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { tags: ["#Advent"] } }, map);
    return true;
  }
  if (card.number === "hBP08-033") {
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, targetRuleOverride: { tags: ["#ID"] } });
    return true;
  }
  if (card.number === "hBP08-032") {
    enqueueStageTarget(state, { playerIndex, rule: { stages: ["2nd"], names: ["クレイジー・オリー", "アーニャ・メルフィッサ"] }, effect: "artBuffTarget", optional: false, prompt: "選擇 2nd Ollie 或 Anya，本回合 Arts +70。", meta: { amount: 70, sourceZone: zone, sourceNumber: card.number } });
    return true;
  }
  if (card.number === "hBP08-074") {
    if (zone === "center") {
      const colors = map.get(opponent.oshi?.number)?.colors || [];
      const count = stageEntries(opponent).filter(({ unit }) => (unitCard(unit, map)?.colors || []).some(color => !colors.includes(color))).length;
      drawCards(state, playerIndex, count);
    }
    return true;
  }
  if (card.number === "hEB01-017" && /存檔區/u.test(text)) {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { zones: [zone] }, targetZone: zone }, map);
    return true;
  }
  if (card.number === "hEB01-014") {
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
    if (options.length) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, options, effect: "specialDamage", optional: false, meta: { amount: 10, loseLife: true, sourceName: card.keyword.name, sourceZone: zone } });
    return true;
  }
  if (["hSD06-002", "hSD06-007"].includes(card.number)) {
    enqueueStageTarget(state, { playerIndex, rule: card.number === "hSD06-007" ? { tags: ["#秘密結社holoX"] } : {}, effect: "heal", optional: false, meta: { amount: card.number === "hSD06-007" ? 30 : 10 } });
    return true;
  }
  if (card.number === "hSD06-005") {
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { tags: ["#秘密結社holoX"] }, optional: false, prompt: card.keyword.name });
    return true;
  }
  if (["hSD06-006", "hSD07-006", "hSD08-003"].includes(card.number)) {
    const rule = card.number === "hSD06-006" ? { names: ["ﾁｬｷ丸", "ぽこべぇ"] } : card.number === "hSD07-006" ? { names: ["エルフレンド"] } : { group: "holomem", stages: ["Debut"], tags: ["#4期生"] };
    queueDeckToHand(state, playerIndex, rule, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hSD05-009") {
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ReGLOSS"], stages: ["Debut", "1st"] }, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hSD09-006") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { tags: ["#3期生"] }, optional: false, prompt: card.keyword.name });
    return true;
  }
  if (card.number === "hSD08-007") {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { tags: ["#4期生"], stages: ["2nd"] }, prompt: card.keyword.name }, map);
    return true;
  }
  if (card.number === "hSD11-005") {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { tags: ["#FLOW GLOW"], zones: BACK_SLOTS }, prompt: card.keyword.name }, map);
    return true;
  }
  if (card.number === "hBP05-073") {
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { topCount: 3, optional: false, targetRuleOverride: { names: ["アユンダ・リス"] } });
    return true;
  }
  if (card.number === "hBP05-009") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st"], names: ["白銀ノエル"] }, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP04-081") {
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: ["黃"], targetRuleOverride: { zones: [zone] } });
    return true;
  }
  if (card.number === "hBP04-044") {
    const hasAttached = stageEntries(player).some(({ unit }) => cardHasName(unitCard(unit, map), "雪花ラミィ") && stageHasNamedAttachment(unit, map, ["雪民"]));
    if (!hasAttached) queueDeckAttachmentToStage(state, playerIndex, { names: ["雪民"] }, { names: ["雪花ラミィ"] }, map, random, card.keyword.name, { optional: false });
    return true;
  }
  if (card.number === "hBP04-026") {
    if (cardHasName(map.get(player.oshi?.number), "白上フブキ")) queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, colorsOverride: ["白"], targetRuleOverride: { names: ["白上フブキ"] } });
    return true;
  }
  if (card.number === "hBP03-049") {
    const center = unitCard(player.zones.center, map);
    queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { optional: false, targetRuleOverride: { tags: ["#ReGLOSS"] }, colorsOverride: cardHasTag(center, "#ReGLOSS") ? center.colors || [] : [] });
    return true;
  }
  if (card.number === "hSD04-007") {
    queueArchiveToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent"] }, map, { optional: true, label: card.keyword.name });
    return true;
  }
  if (card.number === "hSD04-003") {
    if ((map.get(player.oshi?.number)?.colors || []).includes("紫")) drawCards(state, playerIndex, 1);
    return true;
  }
  if (card.number === "hSD03-010") {
    if (cardHasName(unitCard(player.zones.center, map), "猫又おかゆ")) queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportMascot", "supportFan"] }, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hSD02-004") {
    if (player.zones[zone]?.attachments.some(instance => cardHasName(map.get(instance.number), "ぽよ余")) && player.zones.center) addStageModifier(player.zones.center, "arts", 20, state.turn, card.number);
    return true;
  }
  if (card.number === "hEB01-019") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueGroupedDeckToHand(state, playerIndex, [{ required: true, label: "Debut Holomen", match: { group: "holomem", stages: ["Debut"] } }, { required: true, label: "#こよラボ 支援卡", match: { group: "support", tags: ["#こよラボ"] } }], map, random, card.keyword.name);
    return true;
  }
  if (card.number === "hEB01-012") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { group: "holomem", names: ["宝鐘マリン"], keywordTypes: ["bloom", "bloom_effect"] }, map, random, { optional: false, label: card.keyword.name });
    return true;
  }
  if (["hEB01-008", "hEB01-009"].includes(card.number)) {
    const rule = card.number === "hEB01-008" ? { names: ["STAR STAR☆T"] } : { group: "holomem", stages: ["2nd"], names: ["ときのそら"] };
    queueDeckToHand(state, playerIndex, rule, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-081") {
    const targetRule = { zones: ["center"], names: ["音乃瀬奏"] };
    if (stageOptionsMatching(player, map, targetRule).length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule }, map);
    return true;
  }
  if (card.number === "hBP08-066") {
    const cards = player.archive.filter(instance => map.get(instance.number)?.group === "support");
    if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 0, max: 1, optional: true, effect: "archiveToDeckTop", source: "archive", prompt: "可選擇 1 張支援卡放回牌庫頂。" });
    return true;
  }
  if (["hBP08-070", "hBP08-075"].includes(card.number)) {
    queueDeckToHand(state, playerIndex, { names: [card.number === "hBP08-075" ? "ろぼさー" : "Takodachi"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-056") {
    queueDeckToHand(state, playerIndex, { group: "holomem", names: ["モココ・アビスガード"], stages: ["1st"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-036") {
    queueDeckToHand(state, playerIndex, { names: ["ペロ", "Ruffians", "いたずらなRuffians"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-021") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { names: ["Otomo"] }, map, random, { min: 2, max: 2, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-017") {
    queueDeckToHand(state, playerIndex, { names: ["あん肝"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP08-010") {
    queueDeckToHand(state, playerIndex, { names: ["Bloom＆Gloom", "GuyRyS"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP07-082") {
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#5期生"], stages: ["2nd"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP07-077") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#5期生"], stages: ["2nd"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP05-042") {
    if (playerIndex !== state.firstPlayer && player.turnsTaken === 1) queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ゲーマーズ"], stages: ["2nd"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP05-046") {
    queueDeckToHand(state, playerIndex, { names: ["雪民"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
    return true;
  }
  if (card.number === "hBP05-020") {
    if (playerIndex !== state.firstPlayer && player.turnsTaken === 1 && player.cheerDeck.length) {
      const options = stageOptionsMatching(player, map, { tags: ["#ID1期生"] });
      if (options.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇自己的 #ID1期生 Holomen，附加應援牌庫頂 1 張。" });
    }
    return true;
  }
  if (card.number === "hBP05-030") {
    addMatchingStageModifiers(state, playerIndex, map, { zones: ["center"], hasAttachmentType: "supportFan" }, 10, card.number);
    return true;
  }
  if (card.number === "hBP03-021") {
    const targetRule = { zones: BACK_SLOTS, tags: ["#シューター"] };
    const targets = stageOptionsMatching(player, map, targetRule);
    const cheers = player.archive.filter(c => map.get(c.number)?.group === "cheer" && map.get(c.number).colors.includes("綠"));
    if (targets.length && cheers.length) enqueueCardSelection(state, { playerIndex, cards: cheers, min: 0, max: Math.min(2, targets.length, cheers.length), optional: true, effect: "archiveCheerToStage", source: "archive", prompt: "選最多 2 張綠色應援，分別附加到不同後排 Shooter。", meta: { targetRule, maxCheerFromEffect: 1, effectBatch: card.number + ":" + state.turn } });
    return true;
  }
  if (card.number === "hBP03-024") {
    for (const name of ["風真いろは", "星街すいせい"]) enqueueEffect(state, { type: "irohaNamedArchiveCheer", playerIndex, name });
    return true;
  }
  if (card.number === "hBP03-023") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "pekoraFanSearchRoll", prompt: "あんたたちぃ：可擲骰，偶數時搜尋粉絲。", meta: {} });
    return true;
  }
  if (["hBP01-033", "hBP01-039"].includes(card.number)) {
    if (card.number === "hBP01-039" && !cardHasName(map.get(player.oshi?.number), "兎田ぺこら")) return true;
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "firstSetCollabRoll", prompt: card.keyword.name + "：可以擲一次骰子。", meta: { cardNumber: card.number } });
    return true;
  }
  if (card.number === "hBP04-021") {
    const used = currentTurnEvents(player, state.turn).supports.some(n => ["supportEvent", "supportEventLimited"].includes(map.get(n)?.typeCode) && cardHasTag(map.get(n), "#きのこ"));
    if (used) enqueueStageTarget(state, { playerIndex, rule: { tags: ["#ReGLOSS"] }, effect: "heal", optional: false, prompt: "選擇自己 1 位 #ReGLOSS Holomen，回復 20 HP。", meta: { amount: 20 } });
    return true;
  }
  if (card.number === "hBP01-036") {
    enqueueStageTarget(state, { playerIndex, effect: "heal", optional: false, prompt: "選擇自己一位 Holomen，回復 20 HP。", meta: { amount: 20 } });
    return true;
  }
  if (!conditionChecked && !simpleKeywordCondition(state, playerIndex, zone, text, map, random, card)) return true;
  if (["hBP01-090", "hBP02-026", "hBP03-076"].includes(card.number)) return queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { targetRuleOverride: {} });
  if (["hBP01-041", "hBP01-050", "hBP01-054", "hBP03-020"].includes(card.number)) {
    const options = stageEntries(player).filter(({ zone: targetZone, unit: candidate }) => {
      const targetCard = unitCard(candidate, map);
      if (card.number === "hBP03-020") return BACK_SLOTS.includes(targetZone) && cardHasName(targetCard, "獅白ぼたん");
      if (card.number === "hBP01-041") return ["center", "collab"].includes(targetZone);
      const tag = card.number === "hBP01-050" ? "#秘密結社holoX" : "#ID";
      const excluded = card.number === "hBP01-050" ? "風真いろは" : "アイラニ・イオフィフティーン";
      return cardHasTag(targetCard, tag) && !cardHasName(targetCard, excluded);
    }).map(({ zone: targetZone }) => targetZone);
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇符合條件的 Holomen，附加應援牌庫頂 1 張。" });
    return true;
  }
  if (["hBP01-076", "hBP01-079"].includes(card.number)) {
    const amount = card.number === "hBP01-076" ? 10 : 20;
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手一位後排，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: false, sourceZone: zone, sourceName: card.keyword?.name || card.name, beforeArts: true } });
    return true;
  }
  if (queueGenericKeywordCostEffects(state, playerIndex, zone, card, map)) return true;

  if (card.number === "hSD12-003") {
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", optional: false, prompt: "Angel's Glory：選擇對手 1 位後排 Holomen，造成 10 點特殊傷害。", meta: { amount: 10, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
    return true;
  }

  if (card.number === "hSD12-005") {
    const options = stageOptionsMatching(player, map, { tags: ["#Advent"] });
    const hasCheer = player.archive.some((instance) => map.get(instance.number)?.group === "cheer");
    if (options.length > 0 && hasCheer) enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max: 1, optional: false, targetRule: { tags: ["#Advent"] }, prompt: "Moon Goddess：必須揀 1 張存檔區應援，附加到自己 #Advent Holomen。" }, map);
    return true;
  }

  if (card.number === "hSD10-005") {
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#FLOW GLOW"));
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(3, candidates.length), optional: true, effect: "hSD10FlowGlowArchiveBottom", source: "archive", prompt: "FLOW GLOW的DJ兼司機負責人：可選擇 1～3 張持有 #FLOW GLOW 的 Holomen，按喜歡順序放到牌庫底。" });
    return true;
  }

  let handled = false;

  if (queueGenericStageAttachmentMove(state, playerIndex, zone, card, text, map)) return true;
  if (queueGenericStageCheerMove(state, playerIndex, zone, card, text, map)) return true;

  if (/查看自己的?Holo\s*(?:Power|能量)/iu.test(text) && /加入手牌/u.test(text)) {
    if (/牌庫頂(?:的)?1張.*Holo\s*(?:Power|能量)|牌庫頂(?:的)?1張.*(?:放到|作為)Holo/u.test(text)) {
      const power = player.mainDeck.shift();
      if (power) player.holoPower.push(power);
      if (player.holoPower.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: 1, effect: "giftPowerToHand", source: "holoPower", prompt: `${card.keyword?.name || card.name}：查看 Holo Power，揀 1 張加入手牌。` });
    } else if (player.holoPower.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: 1, effect: "giftRaoraPowerPick", source: "holoPower", prompt: `${card.keyword?.name || card.name}：揀 1 張 Holo Power 加入手牌；之後揀 1 張手牌放回 Holo Power。` });
    return true;
  }

  if (/牌庫(?:頂|上方)(?:的)?1張.*(?:Holo\s*(?:Power|能量)|HoloPower區)/iu.test(text)) {
    const power = player.mainDeck.shift();
    if (power) {
      player.holoPower.push(power);
      appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」將牌庫頂 1 張放到 Holo Power。`);
    }
    return true;
  }

  if (/(?:檔案|存檔)區域?.*應援.*(?:放回|返回)(?:應援|加油)牌庫/u.test(text)) {
    const colors = SKILL_COLOR_WORDS.filter(([, pattern]) => pattern.test(text)).map(([color]) => color);
    const cards = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (colors.length === 0 || (map.get(instance.number)?.colors || []).some((color) => colors.includes(color))));
    const range = text.match(/([1-9一二兩三四五])\s*(?:到|至|[～~-])\s*([1-9一二兩三四五])張/u);
    const exact = textNumber(text.match(/([1-9一二兩三四五])張/u)?.[1] || "1");
    const min = range ? textNumber(range[1]) : exact;
    const max = Math.min(range ? textNumber(range[2]) : exact, cards.length);
    if (cards.length >= min) enqueueCardSelection(state, { playerIndex, cards, min, max, effect: /牌庫底/u.test(text) ? "archiveCheerToCheerBottom" : "archiveCheerToDeck", source: "archive", optional: true, prompt: `${card.keyword?.name || card.name}：可揀 ${min === max ? min : `${min}–${max}`} 張存檔區應援放回應援牌庫。` });
    return true;
  }

  if (/(?:查看|檢視).*(?:牌庫|牌組)(?:頂|上方)|從自己(?:的)?牌庫(?:頂|上方).*查看|從自己(?:的)?牌庫(?:頂|上方)(?:的)?(?:查看|檢視)/u.test(text) && !/(?:應援|加油|吶喊)牌庫/u.test(text)) return queueGenericTopLook(state, playerIndex, text, map);

  const cheerTop = text.match(/(?:應援|加油)牌庫(?:頂|上方)(?:的)?\s*(\d+)\s*張/u);
  if (cheerTop && /查看|檢視/u.test(text)) return queueCheerDeckSearch(state, playerIndex, text, zone, map, random, { topCount: Number(cheerTop[1]) });

  if (/(?:應援|加油|吶喊|艾爾)牌(?:庫|組)(?:中)?[^。；]*?(?:公開|展示|選擇|將|抽)\s*(?:1|一)\s*張/u.test(text)) return queueCheerDeckSearch(state, playerIndex, text, zone, map, random);

  if (/(?:檔案|存檔)區域?(?:中|的)?.*?(?:工具|吉祥物|粉絲|[〈「][^〉」]+[〉」]).*(?:裝備|附加)/u.test(text)) return queueArchiveSupportAttachment(state, playerIndex, text, zone, map);

  if (/(?:牌庫|牌組)中?.*(?:公開|選擇|將).*(?:工具|吉祥物|粉絲|[〈「][^〉」]+[〉」]).*(?:裝備|附加)/u.test(text)) {
    queueDeckAttachmentToStage(state, playerIndex, simpleSearchRule(text), cheerTargetRuleFromText(text, zone), map, random, card.keyword?.name || card.name);
    return true;
  }

  if (/(?:牌庫|牌組).*(?:公開|選擇|將).*(?:Debut|Spot).*(?:放到|登場|出現在|召喚到).*舞台/u.test(text)) {
    const range = text.match(/(\d+)\s*[～~-]\s*(\d+)張/u);
    const exact = Number(text.match(/(?:公開|選擇|將)\s*(\d+)張/u)?.[1] || 1);
    queueDeckCardsToStage(state, playerIndex, simpleSearchRule(text), map, random, { min: range ? Number(range[1]) : exact, max: range ? Number(range[2]) : exact, optional: true, label: card.keyword?.name || card.name });
    return true;
  }

  if (/猜拳|宣告|改由|無視Bloom|只能以|不會因|直接倒下|讓.+倒下/u.test(text)) return false;

  const drawMatch = text.match(/抽(?:取|牌)?(?:自己(?:的)?牌庫(?:上方|頂)?(?:的)?)?\s*([1-9一二兩三四五])\s*張/u);
  if (drawMatch && !/每有[^。；]*抽/u.test(text)) {
    const amount = textNumber(drawMatch[1]);
    appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, amount)} 張牌。`);
    handled = true;
  }

  const damageMatch = text.match(/(?:造成|給予|特殊傷害)\s*(\d+)\s*點?(?:特殊傷害)?/u) || text.match(/(?:造成|給予)(?:特殊傷害)?\s*(\d+)/u) || text.match(/給予[^。；]*?(\d+)點特殊傷害/u);
  if (damageMatch && !/每有[^。；]*(?:造成|特殊傷害)|按每張[^。；]*(?:造成|特殊傷害)/u.test(text)) {
    const amount = Number(damageMatch[1]);
    const loseLife = !/不會.*生命減少|不會減少.*生命|不會讓.*生命減少|生命不會減少/u.test(text);
    const sourceName = card.keyword?.name || card.name;
    const specialMeta = { amount, loseLife, sourceName, sourceZone: zone };
    const centerAndCollab = /(?:中央|中心|中場|前排).*(?:合作|Collab)|(?:合作|Collab).*(?:中央|中心|中場|前排)/iu.test(text);
    const centerAndBack = /(?:中央|中心|中場|前排).*(?:後排|後台|後場)|(?:後排|後台|後場).*(?:中央|中心|中場|前排)/u.test(text);
    const simultaneous = /(?:中央|中心|中場|前排)[^。；]*(?:與|和|及|各)[^。；]*(?:合作|Collab)|(?:合作|Collab)[^。；]*(?:與|和|及|各)[^。；]*(?:中央|中心|中場|前排)/iu.test(text);
    const backTargetCount = textNumber(text.match(/([1-9一二兩三四五])\s*(?:位|名|人)(?:對手的?)?(?:後排|後台|後場)|(?:對手的?)?([1-9一二兩三四五])\s*(?:位|名|人)?(?:後排|後台|後場)|(?:後排|後台|後場)(?:的)?(?:Holomen|Holomem|Holo成員|成員)?\s*([1-9一二兩三四五])\s*(?:位|名|人)/u)?.slice(1).find(Boolean) || "0");
    if (/若對手[^。；]*沒有(?:合作|Collab)[^。；]*改為?對[^。；]*(?:中央|中心)/iu.test(text)) {
      const targetZone = opponent.zones.collab ? "collab" : "center";
      if (opponent.zones[targetZone]) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone, ...specialMeta });
    } else if (/所有後排/u.test(text)) {
      queueFixedSpecialDamage(state, playerIndex, zone, BACK_SLOTS, amount, sourceName, loseLife);
    } else if (centerAndBack && /(?:與|和|及|各)[^。；]*(?:1位|一位|一名)?(?:後排|後台|後場)|(?:後排|後台|後場)[^。；]*(?:與|和|及|各)/u.test(text)) {
      if (opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", ...specialMeta });
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: `${sourceName}：直接按對手 1 位後排，造成 ${amount} 點特殊傷害。`, meta: specialMeta });
    } else if (centerAndCollab && simultaneous) {
      queueFixedSpecialDamage(state, playerIndex, zone, ["center", "collab"], amount, sourceName, loseLife);
    } else if (/合作/u.test(text) && !centerAndCollab) {
      if (opponent.zones.collab) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "collab", amount, loseLife, sourceName: card.keyword?.name || card.name, sourceZone: zone });
    } else if (centerAndCollab) {
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: !["hBP01-061", "hBP03-054", "hBP05-032", "hBP05-060", "hBP06-037", "hBP06-038", "hBP06-043", "hBP06-046", "hBP07-067", "hBP08-064"].includes(card.number), prompt: `${card.keyword?.name || "卡片效果"}：直接按對手中央或合作，造成 ${amount} 點特殊傷害。`, meta: { amount, loseLife, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
    } else if (centerAndBack) {
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", ...BACK_SLOTS] }, effect: "specialDamage", optional: false, prompt: `${sourceName}：直接按對手中央或後排，造成 ${amount} 點特殊傷害。`, meta: specialMeta });
    } else if (backTargetCount > 1) {
      const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "multiSpecialDamage", optional: false, prompt: `${sourceName}：直接按第 1 位後排，造成 ${amount} 點特殊傷害。`, meta: { ...specialMeta, remaining: Math.min(backTargetCount, options.length), selectedZones: [] } });
    } else if (/後排|後台|後場/u.test(text)) {
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: card.number !== "hBP01-091", prompt: `${card.keyword?.name || "卡片效果"}：直接按對手後排，造成 ${amount} 點特殊傷害。`, meta: { amount, loseLife, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
    } else if (/(?:1位|一位|一名|任意1位)(?:非Debut的?)?(?:Holomen|Holomem|成員)/iu.test(text)) {
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: /非Debut/u.test(text) ? { excludeStages: ["Debut"] } : {}, effect: "specialDamage", optional: false, prompt: `${sourceName}：直接按對手 1 位合法 Holomen，造成 ${amount} 點特殊傷害。`, meta: specialMeta });
    } else if (opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount, loseLife, sourceName: card.keyword?.name || card.name, sourceZone: zone });
    handled = true;
  }

  const buffMatch = text.match(/(?:Arts|藝術值|藝術力|藝術|藝能值|藝能力|藝能傷害|藝能|アーツ)\s*[+＋]\s*(\d+)/iu);
  if (buffMatch && !skipBuff && !/每(?:有|1)|每重疊|每減少/u.test(text)) {
    const amount = Number(buffMatch[1]);
    const singleTarget = /(?:1位|一位|一名)|選擇(?:自己的|自己)(?:中央|中心)/u.test(text);
    const targetRule = simpleTargetRule(text);
    if (/中央|中心/u.test(text) && !/(?:中央|中心).*(?:與|和|、|或).*合作/u.test(text)) targetRule.zones = ["center"];
    else if (/(?:中央|中心).*(?:與|和|、|或).*合作/u.test(text)) targetRule.zones = ["center", "collab"];
    else if (/合作/u.test(text) && !/(?:進行合作|合作效果)/u.test(text)) targetRule.zones = ["collab"];
    if (/這位Holomen|此Holomen|這位Holo/u.test(text)) addStageModifier(player.zones[zone], "arts", amount, state.turn, card.number);
    else if (singleTarget) enqueueStageTarget(state, { playerIndex, rule: targetRule, effect: "addModifier", optional: /可以|可選/u.test(text), prompt: `${card.keyword?.name || card.name}：直接按自己 1 位合法 Holomen，本回合 Arts +${amount}。`, meta: { kind: "arts", amount, sourceNumber: card.number } });
    else if (/(?:中央|中心).*(?:與|和|、).*合作|\[(?:中心|中央).*(?:合作|Collab)/u.test(text)) addMatchingStageModifiers(state, playerIndex, map, { zones: ["center", "collab"], ...simpleTargetRule(text) }, amount, card.number);
    else if (/合作/u.test(text)) addMatchingStageModifiers(state, playerIndex, map, { zones: ["collab"], ...simpleTargetRule(text) }, amount, card.number);
    else if (/中央|中心/u.test(text)) addMatchingStageModifiers(state, playerIndex, map, { zones: ["center"], ...simpleTargetRule(text) }, amount, card.number);
    else addMatchingStageModifiers(state, playerIndex, map, simpleTargetRule(text), amount, card.number);
    handled = true;
  }

  const healMatch = text.match(/(?:回復|恢復)(?:該Holomen|這位Holomen|自己的一位[^。]*)?\s*(\d+)\s*(?:點)?HP/u);
  if (healMatch) {
    const amount = Number(healMatch[1]);
    if (/這位Holomen|此Holomen|該Holomen/u.test(text)) healStageUnit(state, playerIndex, zone, amount, map);
    else enqueueStageTarget(state, { playerIndex, rule: { damaged: true, ...simpleTargetRule(text) }, effect: "heal", optional: !["hBP03-017", "hBP05-019"].includes(card.number), prompt: `${card.keyword?.name || "卡片效果"}：直接按自己 1 位受傷 Holomen，回復 ${amount} HP。`, meta: { amount } });
    handled = true;
  }

  if (/(?:從)?(?:自己|你的|我方)(?:的)?(?:牌庫|牌組)(?:中)?(?:公開|展示)\s*(?:1|2|一|二|兩)張/u.test(text) && /加入手牌/u.test(text) && !/牌庫頂/u.test(text)) {
    const amount = textNumber(text.match(/(?:公開|展示)\s*([1-9一二兩三四五])張/u)?.[1] || "1");
    queueDeckToHand(state, playerIndex, simpleSearchRule(text), map, random, { min: amount, max: amount, label: card.keyword?.name || card.name });
    handled = true;
  }

  if (/(?:應援|加油|吶喊|艾爾)牌(?:庫|組)(?:最上方|頂|上方)(?:部|的)?[^。；]*?(?:1|一)\s*張[^。；]*?(?:送|發送|附加|傳送)/u.test(text)) {
    const rule = cheerTargetRuleFromText(text, zone);
    const fixed = /這位Holomen|此Holomen/u.test(text) && !/除(?:了)?這位|除此成員|除這位|另一位/u.test(text) ? [zone] : undefined;
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: fixed, targetRule: fixed ? undefined : rule, optional: card.number !== "hBP01-035", prompt: `${card.keyword?.name || "卡片效果"}：直接按合法 Holomen，附加應援牌庫頂 1 張。` });
    handled = true;
  }

  if (/(?:檔案|存檔)區域?中.*(?:返回|回到|加入)手牌/u.test(text) && !/應援/u.test(text)) {
    const rule = simpleSearchRule(text);
    if (!rule.group && !rule.typeCodes) rule.group = "holomem";
    const range = text.match(/([1-9一二三四五])\s*[～~-]\s*([1-9一二三四五])張/u);
    const exact = textNumber(text.match(/(?:中|的)\s*([1-9一二三四五])張/u)?.[1] || "1");
    queueArchiveToHand(state, playerIndex, rule, map, { min: range ? textNumber(range[1]) : exact, max: range ? textNumber(range[2]) : exact, optional: card.number !== "hBP06-038", label: card.keyword?.name || card.name });
    handled = true;
  }

  if (/(?:檔案|存檔)區域?(?:中|的)?.*應援.*(?:送|附加)/u.test(text)) {
    const range = text.match(/([1-9一二兩三四五])\s*(?:到|至|[～~-])\s*([1-9一二兩三四五])\s*(?:張|位)/u);
    const exact = textNumber(text.match(/(?:中的?|將|把|各送出|送出|選擇)\s*([1-9一二兩三四五])\s*張/u)?.[1] || "1");
    const perRestedJustice = /每有1位.*休息.*#Justice/u.test(text) ? stageOptionsMatching(player, map, { tags: ["#Justice"], rested: true }).length : 0;
    const max = perRestedJustice || (card.number === "hBP01-055" ? 3 : range ? textNumber(range[2]) : exact);
    const oneEach = /(?:各|分別).*1張|各送出1張/u.test(text) || ["hBP01-055", "hBP03-021", "hBP03-024", "hBP08-054"].includes(card.number);
    enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max, targetRule: cheerTargetRuleFromText(text, zone), optional: true, prompt: `${card.keyword?.name || "卡片效果"}：可揀 1–${max} 張存檔區應援；之後逐張直接按合法 Holomen。`, meta: oneEach ? { maxCheerFromEffect: 1, effectBatch: `${card.number}:${state.turn}` } : {} }, map);
    handled = true;
  }
  return handled;
}

function queueBloomEffects(state, playerIndex, zone, card, map, random) {
  const player = state.players[playerIndex];
  if (card.number === "hBP04-052") {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手後排，造成 20 點特殊傷害；因此擊倒不扣生命。", meta: { amount: 20, loseLife: false, sourceName: card.keyword.name, sourceZone: zone } });
    return;
  }
  if (card.number === "hBP04-048") {
    const options = stageEntries(player).filter(({unit}) => cardHasName(unitCard(unit, map), "雪花ラミィ") && unit.attachments.some(c => cardHasName(map.get(c.number), "雪民"))).map(({zone}) => zone);
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇附有雪民的雪花ラミィ，附加應援牌庫頂 1 張。" });
    return;
  }
  if (card.number === "hBP04-027") {
    const options = stageOptionsMatching(player, map, { names: ["クレイジー・オリー", "アーニャ・メルフィッサ"] });
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇自己的クレイジー・オリー或アーニャ・メルフィッサ，附加應援牌庫頂 1 張。" });
    return;
  }
  if (card.number === "hBP03-038") {
    const stack = player.zones[zone]?.stack || [];
    if (map.get(stack.at(-2)?.number)?.stage === "Debut") queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st"], names: ["フワワ・アビスガード"] }, map, random, { label: card.keyword.name });
    return;
  }
  if (card.number === "hBP01-012") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "kanataBloomRoll", prompt: "偶像かなたそを：可擲骰；3 以下時可公開 1 張吉祥物並附加到自己的 Holomen。", meta: {} });
    return;
  }
  if (card.number === "hBP02-038") {
    queueCheerDeckSearch(state, playerIndex, card.keyword.effect, zone, map, random, { topCount: 3, optional: false });
    return;
  }
  if (card.number === "hBP02-063") {
    enqueueStageTarget(state, { playerIndex, rule: { tags: ["#Myth"] }, effect: "heal", optional: false, prompt: "選擇自己 1 位 #Myth Holomen，回復 20 HP。", meta: { amount: 20 } });
    return;
  }
  if (card.number === "hSD12-009") {
    const revealed = player.mainDeck.splice(0, Math.min(3, player.mainDeck.length));
    const selectableIds = revealed.filter((instance) => map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#Advent")).map((instance) => instance.id);
    if (selectableIds.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 1, max: 1, optional: false, effect: "topLookToHand", source: "revealed", prompt: "Ancient One：公開 1 張 #Advent Holomen 加入手牌；其餘按喜歡順序放到牌庫底。" });
    else queueBottomOrder(state, playerIndex, revealed, "Ancient One 沒有公開 #Advent Holomen：按喜歡順序放到牌庫底。");
    return;
  }
  if (card.number === "hSD12-011") {
    appendLog(state, player.name + " 因「" + (card.keyword?.name || card.name) + "」抽 " + drawCards(state, playerIndex, 1) + " 張牌。");
    const options = stageCheerOptions(player, map);
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "hSD12-011-archive", optional: true, prompt: "The Wise One：可將舞台 1 張應援放到存檔區；之後選擇 1 位自己的 Holomen，本回合 Arts +40。", meta: { sourceNumber: card.number } });
    return;
  }
  if (card.number === "hSD13-011") {
    const cards = state.players[playerIndex].zones[zone].stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem" && map.get(instance.number)?.stage === "Debut");
    if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "gigiBloomDebutCost", source: "stack", prompt: "I am Gonathan G.：可存檔來源下方1張Debut，對對手聯動造成20特殊傷害。", meta: { sourceZone: zone } });
    return;
  }
  if (card.number === "hSD14-007") {
    const center = state.players[playerIndex].zones.center;
    if (center) addStageModifier(center, "arts", 10, state.turn, card.number);
    return;
  }
  if (card.number === "hSD15-009") {
    if (zone === "center") addStageModifier(state.players[playerIndex].zones[zone], "arts", 20, state.turn, card.number);
    return;
  }
  if (card.number === "hBP06-042") {
    enqueueHolomemHandArchive(state, { playerIndex, cards: state.players[playerIndex].hand,
      min: 1, max: 1, effect: "handToArchive", optional: false,
      prompt: "Strawberry Princess：先存檔 1 張手牌，再抽 1 張牌。" }, card, map);
    enqueueEffect(state, { type: "drawPlayerCards", playerIndex, amount: 1, label: "Strawberry Princess" });
  }
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  if (card.number === "hBP02-032") {
    const usageKey = "bloom:hBP02-032";
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      queueDeckToHand(state, playerIndex, { group: "holomem", names: ["宝鐘マリン", "寶鐘瑪琳"] }, map, random, { min: 1, max: 1, optional: true, label: card.keyword?.name || card.name });
    }
  } else if (card.number === "hBP05-044") {
    const usageKey = "bloom:hBP05-044";
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      if (opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: 10, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone });
      const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: "お弁当タイム…？：直接按對手 1 位後排 Holomen，造成 10 點特殊傷害。", meta: { amount: 10, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
    }
  } else if (card.number === "hBP06-033") {
    const usageKey = "bloom:hBP06-033";
    const usedMushroomEvent = currentTurnEvents(player, state.turn).supports.some((number) => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode) && cardHasTag(map.get(number), "#きのこ"));
    if (usedMushroomEvent && !usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    }
  } else if (card.number === "hBP06-068") {
    const usageKey = "bloom:hBP06-068";
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      queueDeckToHand(state, playerIndex, { names: ["ゆび"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    }
  } else if (card.number === "hBP07-011") {
    const usageKey = "bloom:hBP07-011";
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st"], names: ["角巻わため", "角卷綿芽"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword?.name || card.name });
    }
  } else if (card.number === "hBP08-072") {
    const usageKey = "bloom:hBP08-072";
    const myth = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#Myth"));
    if (myth.length >= 8 && !usedNamedThisTurn(player, usageKey, state.turn)) queueArchiveToHand(state, playerIndex, { group: "holomem", tags: ["#Myth"] }, map, { min: 1, max: 1, optional: true, label: card.keyword?.name || card.name, meta: { usageKey } });
  } else if (card.number === "hBP06-054") {
    const source = player.zones[zone];
    const snowpeople = (source?.attachments || []).filter((instance) => cardHasName(map.get(instance.number), "雪民")).length;
    if (snowpeople > 0) {
      if (opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: 20, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone });
      enqueueEffect(state, { type: "drawPlayerCards", playerIndex, amount: snowpeople >= 3 ? 2 : 1, label: card.keyword?.name || card.name });
    }
  } else if (card.number === "hBP07-012") {
    const options = stageOptionsMatching(opponent, map, { zones: ["center", "collab"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamageThenOpponentDraw", prompt: "わたビーーーーーーーム！！！！！！：直接按對手中央或合作 Holomen，造成 30 點特殊傷害；之後對手抽 1 張。", meta: { amount: 30, sourceName: card.keyword?.name || card.name, sourceZone: zone, drawPlayerIndex: opponentIndex } });
  } else if (card.number === "hBP07-019") {
    queueDeckAttachmentToStage(state, playerIndex, { names: ["BAZO", "Zecretary"] }, { names: ["ベスティア・ゼータ", "Vestia Zeta"] }, map, random, card.keyword?.name || card.name, { optional: false });
  } else if (card.number === "hBP07-033") {
    const options = stageEntries(player).filter(({ unit: target }) => Number(target.bloomedTurn || 0) === state.turn && cardHasTag(unitCard(target, map), "#FLOW GLOW")).map(({ zone: targetZone }) => targetZone);
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "ティールマーメイド：直接按本回合曾 Bloom 的 1 位 #FLOW GLOW Holomen，本回合 Arts +30。", meta: { kind: "arts", amount: 30, sourceNumber: card.number } });
  } else if (card.number === "hBP07-089") {
    const usageKey = "bloom:hBP07-089";
    const flowGlowKnockedOut = (state.knockouts || []).some((entry) => entry.turn === state.turn - 1 && entry.ownerIndex === playerIndex && entry.sourcePlayerIndex !== playerIndex && cardHasTag(entry.card, "#FLOW GLOW"));
    if (flowGlowKnockedOut && !usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    }
  } else if (card.number === "hBP08-028") {
    const options = stageOptionsMatching(player, map, { names: ["アキ・ローゼンタール", "Aki Rosenthal", "亞綺·羅森塔爾"], hasAttachmentType: "supportTool" });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "akiParfaitBuff", prompt: "ホロナツ大盛りパフェ：直接按自己 1 位裝備工具的 Aki Rosenthal；Buzz／2nd Arts +50，其他 Arts +20。", meta: { sourceNumber: card.number } });
  } else if (card.number === "hEB01-007") {
    appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToBottom", prompt: "ふたりだけの特別ツアー！：揀 1 張手牌放到牌庫底。" });
  } else if (card.number === "hSD18-008") {
    const archived = player.mainDeck.shift();
    if (archived) {
      player.archive.push(archived);
      currentTurnEvents(player, state.turn).deckArchived += 1;
    }
    appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」將牌庫頂 ${archived ? 1 : 0} 張放到存檔區。`);
  } else if (card.number === "hSD19-007") {
    enqueueArchiveCheerToTarget(state, playerIndex, { targetZone: zone, targetRule: { zones: [zone] }, optional: false, prompt: "青春エール：選擇存檔區 1 張應援，附加到此成員。" }, map);
  } else if (card.number === "hSD17-007") {
    if (BACK_SLOTS.includes(zone)) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "Message for You：選擇對手 1 位後排成員，造成 10 特殊傷害。", meta: { amount: 10, loseLife: true, sourceZone: zone, sourceName: card.keyword.name } });
  } else if (card.number === "hBP02-059") {
    if (player.mainDeck.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.mainDeck, min: 1, max: 1, effect: "deckToArchiveShuffle", source: "deck", prompt: "Soul Voice：公開牌庫 1 張卡放到存檔區，之後洗牌。" });
  } else if (card.number === "hBP03-036") {
    const candidates = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "小鳥遊キアラ"));
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(4, candidates.length), optional: false, effect: "kiaraReveal", source: "deck", prompt: "公開1～4張小鳥遊キアラ。" });
    else player.mainDeck = shuffle(player.mainDeck, random);
  } else if (card.number === "hBP01-037") {
    if (player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, afterEffect: "healSource", afterZone: zone, healAmount: 40, prompt: "ゴシックドール：直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
    else if ((player.zones[zone]?.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool")) {
      const healed = healStageUnit(state, playerIndex, zone, 40, map);
      appendLog(state, `${card.name} 因裝備工具回復 ${healed} HP。`);
    }
  } else if (card.number === "hBP02-021") {
    const amount = new Set(stageEntries(player).flatMap(({ unit: stageUnit }) => stageCheerColors(player, stageUnit, map))).size * 10;
    if (amount > 0) enqueueStageTarget(state, { playerIndex, effect: "heal", prompt: `心を込めて歌って、踊ります。：直接按自己 1 位 Holomen，按舞台應援顏色回復 ${amount} HP。`, meta: { amount } });
  } else if (card.number === "hBP03-033") {
    const target = opponent.zones.center;
    const hasTool = (target?.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool");
    if (target) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: hasTool ? 30 : 10, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone });
  } else if (card.number === "hBP08-071") {
    const oshiColors = map.get(opponent.oshi?.number)?.colors || [];
    const options = stageEntries(opponent).filter(({ unit: stageUnit }) => {
      const colors = unitCard(stageUnit, map)?.colors || [];
      return colors.length > 0 && colors.every((color) => !oshiColors.includes(color));
    }).map(({ zone: targetZone }) => targetZone);
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: "TOMORROW!?：直接按 1 位顏色與對手推し Holomen 不同的對手 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
  } else if (card.number === "hSD16-009") {
    const count = stageAttachmentCount(player, map, (attachment) => cardHasName(attachment, "35P"));
    if (count > 0) addStageModifier(player.zones[zone], "arts", count * 10, state.turn, card.number);
  } else if (card.number === "hEB01-010") {
    if (zone === "center") enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "soraSummerRoll", prompt: "可擲一次骰子。", meta: {} });  } else if (card.number === "hSD07-007") {
    if (BACK_SLOTS.includes(zone) && player.zones.collab && stageRemainingHp(player, "collab", map) <= 70) enqueueStageTarget(state, { playerIndex, options: [zone], effect: "swapCollab", optional: true, prompt: "再次成長的我：可直接按此 Holomen，與剩餘 HP 70 以下的合作 Holomen 互換。" });
  } else if (card.number === "hBP07-030") {
    if (cardIsBuzz(map.get(player.zones[zone]?.stack?.at(-2)?.number))) enqueueStageTarget(state, { playerIndex, rule: { damaged: true }, effect: "heal", optional: false, prompt: "holoRêve -いろは-：直接按自己 1 位受傷 Holomen，回復 100 HP。", meta: { amount: 100 } });
  } else if (card.number === "hBP01-047") {
    const healed = healStageUnit(state, playerIndex, zone, 40, map);
    appendLog(state, `${card.name} 回復 ${healed} HP。`);
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "azkiLifeRoll", prompt: "生命的軌跡：回復後可以擲一次骰子。", meta: { sourceZone: zone } });
  } else if (card.number === "hBP01-074") {
    const candidates = player.archive.filter((instance) => ["Debut", "1st"].includes(map.get(instance.number)?.stage));
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "archiveReturnConditionalDamage", source: "archive", prompt: "可揀存檔區 1 張 Debut／1st Holomen 返回手牌；若持有 #EN，對對手合作造成 20 特殊傷害。", meta: { opponentIndex, sourceZone: zone } });
  } else if (card.number === "hBP02-033") {
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem");
    const damageEligible = (player.zones[zone]?.stack || []).slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem").length >= 3;
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "archiveToHandThenStackDamage", source: "archive", prompt: "可揀存檔區 1 張 Holomen 返回手牌；之後按重疊數判定 50 特殊傷害。", meta: { damageEligible, opponentIndex, sourceZone: zone } });
    else if (damageEligible) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "重疊有 3 張以上：直接按對手中央或合作，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: zone } });
  } else if (card.number === "hBP02-057") {
    const candidates = player.hand.filter((instance) => map.get(instance.number)?.group === "holomem");
    const hasPair = candidates.some((left, index) => candidates.slice(index + 1).some((right) => (map.get(left.number)?.tags || []).some((tag) => (map.get(right.number)?.tags || []).includes(tag))));
    if (hasPair) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 2, optional: true, effect: "sameTagHandCost", source: "hand", prompt: "可揀 2 張持有最少 1 個相同標籤的 Holomen 存檔；支付後抽 2 張。" });
  } else if (card.number === "hBP02-060") {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, damaged: true });
    if (options.length > 0 && opponent.zones.center) enqueueStageTarget(state, { playerIndex, options, effect: "healBackThenDamage", optional: true, prompt: "可直接按自己 1 位受傷的後排 Holomen，回復最多 50 HP；對手中央受到相同數值特殊傷害。", meta: { opponentIndex, sourceZone: zone } });
  } else if (card.number === "hBP02-047") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "shionBloomRoll", prompt: "いたずらの魔法：可擲骰；4 以上時改附對手 1 張應援。", meta: {} });
  } else if (card.number === "hBP04-060") {
    const cheers = opponent.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    if (opponent.zones.center && cheers.length > 0) enqueueCardSelection(state, { playerIndex, cards: cheers, min: 0, max: 1, optional: true, effect: "opponentArchiveCheerToStage", source: "opponentArchive", prompt: "可揀對手存檔區 1 張應援；下一步直接按對手中央附加。", meta: { ownerIndex: opponentIndex, targetPlayerIndex: opponentIndex, targetRule: { zones: ["center"] } } });
  } else if (card.number === "hBP04-057") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "holoxGatherRoll", prompt: "可擲一次骰子，按結果回收存檔區 #秘密結社holoX 成員。", meta: {} });
    return;
  } else if (card.number === "hBP04-059") {
    const usageKey = "bloom:hBP04-059";
    if (!usedNamedThisTurn(player, usageKey, state.turn) && player.hand.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 0, max: 1, optional: true, effect: "yesMyDarkCost", source: "hand", prompt: "Yes My Dark！：可揀 1 張手牌存檔；支付後擲 3 次骰，每個奇數抽 1 張。", meta: { usageKey, sourceNumber: card.number } });
    return;
  } else if (card.number === "hBP03-019") {
    queueBotanCheerPayment(state, playerIndex, zone, card, map);
  } else if (card.number === "hBP03-045") {
    const options = stageCheerOptions(player, map, { stage: { tags: ["#ID"] } });
    if (options.length > 0 && BACK_SLOTS.some((targetZone) => opponent.zones[targetZone])) enqueueStageCheerSelection(state, { playerIndex, options, effect: "idCheerCostSplitDamage", optional: true, prompt: "可直接按自己 #ID Holomen 身上 1 張實際應援存檔；支付後分配 3 次 10 點特殊傷害。", meta: { opponentIndex, sourceZone: zone } });
  } else if (card.number === "hBP04-065") {
    const options = stageCheerOptions(player, map, { colors: ["紅"] });
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "archiveCheerThenDrawTwo", optional: true, prompt: "可直接按自己舞台 1 張紅色應援存檔；支付後抽 2 張。" });
    return;
  } else if (card.number === "hBP04-066") {
    const usageKey = "bloom:hBP04-066";
    if (!usedNamedThisTurn(player, usageKey, state.turn) && player.hand.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 0, max: player.hand.length, optional: true, effect: "archiveWholeHandDrawSame", source: "hand", prompt: "可將全部手牌存檔，然後抽相同張數。", meta: { usageKey, handCount: player.hand.length } });
    return;
  } else if (card.number === "hBP05-034") {
    if (zone === "center") {
      // Q449: the payment is not capped by the fans already in archive.
      // Determine return candidates after payment, including newly paid fans.
      const max = player.hand.length + (canReplaceHandArchive(state, playerIndex, card, map) ? player.holoPower.length : 0);
      if (max > 0) enqueueHolomemHandArchive(state, { playerIndex, cards: player.hand, min: 1, max, optional: true, effect: "handArchiveThenNamedReturn", source: "hand", prompt: "おまたせ～！：可存檔任意張數手牌；每支付 1 張，從存檔區返回 1 張座員（不足則盡量返回）。", meta: { names: ["座員"] } }, card, map);
    }
  } else if (card.number === "hBP06-031") {
    if (cardHasName(map.get(player.oshi?.number), "姫森ルーナ")) {
      const options = stageAttachmentOptions(player, map, (instance, attachment) => cardHasName(attachment, "ルーナイト"));
      if (options.length > 0) enqueueStageAttachmentSelection(state, { playerIndex, options, effect: "lunaiteArchiveCost", optional: true, prompt: "可直接按舞台 1 張ルーナイト存檔；每支付 1 張，便送 1 張應援牌庫頂給姫森ルーナ（最多 2 張）。", meta: { remaining: Math.min(2, options.length) } });
    }
  } else if (card.number === "hBP08-012") {
    const options = stageCheerOptions(player, map);
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "cheerBottomToIrys", optional: true, prompt: "可直接按舞台 1 張實際應援放回應援牌庫底；之後送應援牌庫頂 1 張給 IRyS。" });
  } else if (card.number === "hBP04-082") {
    const count = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#1期生")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name)).size;
    if (count) enqueueOptionChoice(state, { playerIndex, options: Array.from({length: count}, (_,i) => ({id: String(i+1), label: "擲 " + (i+1) + " 次骰子"})), optional: true, effect: "matsuriShoppingRoll", prompt: "可按不同名 #1期生 人數選擇擲骰次數。", meta: { sourceZone: zone } });
    return;
  } else if (card.number === "hBP07-038") {
    enqueueEffect(state,{type:"haatoRoll",playerIndex,meta:{mode:"bloom",sourceNumber:card.number,sourceZone:zone,sourceId:topCard(player.zones[zone]).id,label:card.keyword?.name||card.name}});
  } else if (card.number === "hBP07-072") {
    const odd = rollDice(random, state, playerIndex, 3, card, "因 Bloom 效果擲 3 次骰").filter((die) => die % 2 === 1).length;
    const options = stageOptionsMatching(player, map, { tags: ["#秘密結社holoX"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: `直接按自己 1 位 #秘密結社holoX Holomen，本回合 Arts +${odd * 10}。`, meta: { kind: "arts", amount: odd * 10, sourceNumber: card.number } });
  } else if (card.number === "hBP04-037") {
    enqueueOptionChoice(state,{playerIndex,options:[{id:"roll",label:"擲一次骰子"}],optional:true,effect:"ririkaKpgRoll",prompt:"KPG：可以擲一次骰子。"});
  } else if (card.number === "hBP02-051") {
    const usageKey = "bloom:hBP02-051";
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      const candidates = player.archive.filter((instance) => {
        const bloomCard = map.get(instance.number);
        return bloomCard?.stage === "1st" && stageEntries(player).some(({ unit: target }) => cardHasTag(unitCard(target, map), "#ID2期生") && unitCard(target, map)?.stage === "Debut" && talentMatches(bloomCard, unitCard(target, map)) && Number(target.enteredTurn || 0) !== state.turn && Number(target.bloomedTurn || 0) !== state.turn && Number(bloomCard.hp || 0) > Number(target.damage || 0));
      });
      if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "archiveBloomCard", source: "archive", prompt: "限界化！！：可揀存檔區 1 張 1st Holomen；下一步直接按 #ID2期生 Debut 完成 Bloom。", meta: { usageKey } });
    }
  } else if (card.number === "hBP04-061") {
    // Only the SP Oshi skill 「蘇るオリー」 enables this Bloom effect.  That
    // context is carried by the Oshi Bloom resolver below.
  } else if (card.number === "hBP08-023") {
    const source = player.zones[zone];
    if (source && !source.rested) enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: "讓此 Holomen 休息" }], effect: "restSourceThenHeal", optional: true, prompt: "一起相處的時間：可讓此 Holomen 休息；若有 2 位休息中的 #Justice，再回復 50 HP。", meta: { sourceId: topCard(source)?.id || "" } });
  } else if (card.number === "hBP08-039") {
    if (stageCheerColorCount(player, map, "藍") >= 6) {
      const options = stageOptionsMatching(player, map, { names: ["フワワ・アビスガード", "Fuwawa Abyssgard"], rested: true });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "unrest", optional: false, prompt: "來自深淵的信賴：選擇 1 位休息中的 Fuwawa Abyssgard，變為活動狀態。" });
    }
  } else if (card.number === "hSD13-006") {
    const options = stageOptionsMatching(player, map, { tags: ["#Justice"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "Bring It On!：直接按自己 1 位 #Justice Holomen，本回合 Arts +20。", meta: { kind: "arts", amount: 20, sourceNumber: card.number } });
  } else if (card.number === "hBP08-054") {
    const oshiColors = map.get(player.oshi?.number)?.colors || [];
    if (oshiColors.some((color) => ["綠", "藍", "黃"].includes(color))) {
      const blue = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("藍"));
      if (blue.length > 0) enqueueCardSelection(state, { playerIndex, cards: blue, min: 0, max: Math.min(3, blue.length, stageOptionsMatching(player, map, { tags: ["#ID1期生"] }).length), optional: true, effect: "archiveCheerToStage", source: "archive", prompt: "可揀 1–3 張藍色應援；之後逐張直接按不同 #ID1期生 Holomen。", meta: { targetRule: { tags: ["#ID1期生"] }, maxCheerFromEffect: 1, effectBatch: `${card.number}:${state.turn}` } });
    }
  } else if (card.number === "hEB01-022") {
    const candidates = player.archive.filter((instance) => instance.number === ASSISTANT_CARD);
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(2, candidates.length), prompt: "Bloom：可揀 1–2 張「こよりの助手くん」返回手牌。", effect: "archiveAssistants", source: "archive", optional: true });
  } else if (card.number === "hEB01-023") {
    const candidates = player.archive.filter((instance) => isKoyoriCard(map.get(instance.number)));
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(4, candidates.length), prompt: "Bloom：可按次序揀 1–4 張「博衣こより」放到牌庫底。", effect: "koyoriBottom", source: "archive", optional: true, meta: { zone } });
  } else if (card.number === "hBP04-012") {
    const candidates = player.mainDeck.filter((instance) => cardHasTag(map.get(instance.number), "#こよラボ") && map.get(instance.number)?.group === "support");
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, prompt: "Bloom：公開牌庫中 1 張 #こよラボ 支援卡加入手牌。", effect: "deckToHandShuffle", source: "deck", optional: false });
    else player.mainDeck = shuffle(player.mainDeck, random);
  } else if (card.number !== "hBP06-042" && ["bloom", "bloom_effect"].includes(card.keyword?.type)) queueSimpleTriggeredKeyword(state, playerIndex, zone, card, map, random);

  for (const modifier of (player.modifiers || []).filter((item) => item.kind === "flowGlowBloomCheer" && Number(item.expiresTurn || 0) >= state.turn)) {
    if (!cardHasTag(card, "#FLOW GLOW") || player.cheerDeck.length === 0) continue;
    const sourceZone = stageZoneByTopId(player, modifier.rule?.sourceId);
    if (sourceZone) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [sourceZone], prompt: "Give Me Hype!!：直接按效果來源，附加應援牌庫頂 1 張。" });
  }
}

function queueAttachmentBloomEffects(state, playerIndex, zone, map) {
  const player = state.players[playerIndex];
  const stageUnit = player.zones[zone];
  const card = unitCard(stageUnit, map);
  if (!stageUnit || !card) return;
  const has = (number) => stageUnit.attachments.some((instance) => instance.number === number);
  const udinTriggers = has("hBP02-097") && cardHasName(card, "クレイジー・オリー");
  let draws = 0;
  if (has("hBP01-121") && cardHasName(card, "小鳥遊キアラ")) draws += 1;
  if (has("hBP02-095") && zone === "center" && cardHasName(card, "宝鐘マリン")) draws += 1;
  if (udinTriggers) draws += 1;
  if (has("hSD02-014") && cardHasName(card, "百鬼あやめ")) draws += 1;
  if (has("hBP08-104") && cardHasName(card, "水宮枢")) draws += 1;
  if (has("hBP07-110") && cardHasName(card, "桃鈴ねね") && activeModifiers(stageUnit, "trigger:hBP07-110", state.turn).length === 0) {
    draws += 1;
    addStageModifier(stageUnit, "trigger:hBP07-110", 0, state.turn, "hBP07-110");
  }
  if (draws > 0) appendLog(state, `${player.name} 因附加卡的 Bloom 觸發抽 ${drawCards(state, playerIndex, draws)} 張牌。`);
  // Capture the hand after the draw, so the new card is a legal choice even
  // when the hand was empty. Q255 still requires archiving with an empty deck.
  if (udinTriggers) enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: "UDIN：抽牌後揀 1 張手牌放到存檔區。" });
  if (has("hSD04-014") && cardHasName(card, "癒月ちょこ")) {
    const healed = healStageUnit(state, playerIndex, zone, 20, map);
    appendLog(state, `${card.name} 因 Chocola 回復 ${healed} HP。`);
  }
}

function queueBotanCheerPayment(state, playerIndex, sourceZone, card, map) {
  const player = state.players[playerIndex], source = player.zones[sourceZone], number = card.number;
  if (!source) return;
  if (["hBP03-017", "hBP03-021"].includes(number) && !cardHasName(map.get(player.oshi?.number), "獅白ぼたん")) return;
  if (number === "hBP03-019" && usedNamedThisTurn(player, "bloom:hBP03-019", state.turn)) return;
  const options = [];
  if (number === "hBP03-017") {
    if (player.cheerDeck.length) options.push({id:"deck", kind:"deck", cardId:player.cheerDeck[0].id, label:"將應援牌庫頂 1 張存檔"});
  } else {
    const stage = number === "hBP05-028" ? {names:["獅白ぼたん"]} : {zones:BACK_SLOTS};
    for (const cheer of stageCheerOptions(player, map, {stage})) options.push({id:"cheer:"+cheer.id, kind:"stage", cardId:cheer.id, zone:cheer.zone, label:"存檔 "+(unitCard(player.zones[cheer.zone],map)?.name||"Holomen")+" 的 "+(map.get(cheer.number)?.name||"應援")});
  }
  for (const fan of source.attachments.filter(c=>c.number==="hBP03-106")) options.push({id:"ssrb:"+fan.id, kind:"ssrb", cardId:fan.id, label:"存檔此發動者的 SSRB，替代 1 張應援"});
  if (options.length) enqueueOptionChoice(state,{playerIndex,options,effect:"botanCheerPayment",optional:true,prompt:"選擇支付方式；亦可略過此能力。",meta:{number,sourceZone,sourceId:topCard(source).id}});
}

function resolveBotanCheerPayment(state, playerIndex, option, meta, map) {
  const player=state.players[playerIndex], source=player.zones[meta.sourceZone];
  assert(source && topCard(source).id===meta.sourceId,"能力發動者已改變。");
  assert(meta.number!=="hBP03-019" || !usedNamedThisTurn(player,"bloom:hBP03-019",state.turn),"本回合已使用此 Bloom 效果。");
  let paid;
  if (option.kind==="ssrb") {
    const fan=source.attachments.find(c=>c.id===option.cardId && c.number==="hBP03-106");
    assert(fan,"發動者身上的 SSRB 已改變。");
    paid=removeById(source.attachments,fan.id);
  } else if (option.kind==="deck") {
    assert(meta.number==="hBP03-017" && player.cheerDeck[0]?.id===option.cardId,"應援牌庫頂已改變。");
    paid=player.cheerDeck.shift();
  } else {
    const holder=player.zones[option.zone];
    const valid=meta.number==="hBP05-028"?cardHasName(unitCard(holder,map),"獅白ぼたん"):BACK_SLOTS.includes(option.zone);
    assert(holder && valid,"應援支付來源不符。");
    paid=removeById(holder.cheer,option.cardId);
  }
  assert(paid,"支付卡片已改變。");
  player.archive.push(paid);
  appendLog(state,player.name+(option.kind==="ssrb"?" 存檔 SSRB 替代 1 張應援。":" 存檔 1 張應援支付能力。"),[paid]);
  if(option.kind!=="ssrb"){triggerCheerArchivedGift(state,playerIndex,map,1);queueHbp01Oshi008Trigger(state,playerIndex,meta.sourceZone,map);}
  if(meta.number==="hBP03-019")markNamedUsage(player,"bloom:hBP03-019",state.turn);
  if(meta.number==="hBP03-017"){
    enqueueStageTarget(state,{playerIndex,effect:"heal",optional:false,prompt:"選擇自己 1 位 Holomen，回復 10 HP。",meta:{amount:10}});
  }else{
    const amount=meta.number==="hBP03-021"?40:30;
    enqueueStageTarget(state,{playerIndex,targetPlayerIndex:playerIndex===0?1:0,rule:{zones:meta.number==="hBP05-028"?["center"]:["center","collab"]},effect:"specialDamage",optional:false,prompt:"選擇對手合法 Holomen，造成 "+amount+" 點特殊傷害。",meta:{amount,loseLife:true,sourceZone:meta.sourceZone,sourceName:map.get(meta.number)?.name||"獅白ぼたん"}});
  }
}

function queueCollabMoveGift(state, playerIndex, map) {
  const card = unitCard(state.players[playerIndex].zones.collab, map);
  if (state.activePlayer === playerIndex && card?.number === "hBP07-085") queueGenericTopLook(state, playerIndex, card.keyword.effect, map, true, { names: ["不知火フレア"] });
}

function queueCollabEffects(state, playerIndex, card, map, random) {
  if (card.number === "hBP03-017") { queueBotanCheerPayment(state, playerIndex, "collab", card, map); return; }
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  if (card.number === "hBP02-043") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "shionCollabRoll", prompt: "魔法見せてあげる：可擲骰；4 以上時可公開 1 張 #魔法卡加入手牌。", meta: {} });
  } else if (card.number === "hBP02-049") {
    appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: "オリー一直在看著你喔：揀 1 張手牌放到存檔區。" });
  } else if (card.number === "hSD14-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckToHand(state, playerIndex, { typeCodes: ["supportMascot"] }, map, random, { min: 1, max: 1, optional: false, label: card.keyword.name });
  } else if (card.number === "hSD14-005") {
    if (player.zones.center) addStageModifier(player.zones.center, "arts", 10, state.turn, card.number);
  } else if (card.number === "hSD14-008") {
    const cards = player.archive.filter(instance => map.get(instance.number)?.typeCode === "supportMascot" && attachmentTargets(player, map.get(instance.number), map).includes("collab"));
    if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: false, effect: "genericArchiveSupportPick", source: "archive", prompt: "大丈夫ですよ！：選擇存檔區1張吉祥物，附加到這位聯動成員。", meta: { targetRule: { zones: ["collab"] } } });
  } else if (card.number === "hSD15-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { zones: BACK_SLOTS }, optional: false, prompt: "一服朝っぱらでん：選擇自己1位後排，附加應援牌庫頂1張。" });
  } else if (card.number === "hSD16-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckAttachmentToStage(state, playerIndex, { names: ["35P"] }, { zones: ["collab"] }, map, random, card.keyword.name, { optional: false });
  } else if (card.number === "hSD19-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"] }, map, random, { min: 1, max: 1, optional: true, label: "大空スマイル" });
  } else if (card.number === "hSD17-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "ファーストスター：選擇對手 1 位後排成員，造成 20 特殊傷害。", meta: { amount: 20, loseLife: true, sourceZone: "collab", sourceName: card.keyword.name } });
  } else if (card.number === "hBP06-058") {
    appendLog(state, `${player.name} 因「Yes, Chef.」抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
    enqueueHolomemHandArchive(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "handToArchive", optional: false, prompt: "Yes, Chef.：抽牌後存檔 2 張手牌。" }, card, map);
  } else if (card.number === "hBP06-041") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
      enqueueHolomemHandArchive(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "handToArchive", optional: false, prompt: "GYM RAT：存檔 2 張手牌。" }, card, map);
    }
  } else if (card.number === "hBP07-013") {
    const buffed = addMatchingStageModifiers(state, playerIndex, map, { names: ["角巻わため", "角卷綿芽"] }, 20, card.number);
    appendLog(state, `${player.name} 的「${card.keyword?.name || card.name}」令舞台上 ${buffed} 位角巻わため本回合 Arts +20。`);
    if ((player.zones.center?.cheer || []).length >= 6) appendLog(state, `${player.name} 的中央 Holomen 有 6 張以上應援，再抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
  } else if (card.number === "hBP08-008") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const options = stageOptionsMatching(player, map, { tags: ["#Promise"] });
      const hasPurple = stageHasAnyCheerColor(player, "紫", map);
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: `Promise of Spring：直接按自己 1 位 #Promise Holomen，本回合 Arts +30${hasPurple ? "；之後抽 1 張" : ""}。`, meta: { kind: "arts", amount: 30, sourceNumber: card.number, ...(hasPurple ? { after: { type: "drawPlayerCards", amount: 1, label: card.keyword?.name || card.name } } : {}) } });
    }
  } else if (card.number === "hSD01-015") {
    const centerCard = unitCard(player.zones.center, map);
    if (cardHasName(centerCard, "ときのそら")) appendLog(state, `${player.name} 因「${card.keyword?.name || card.name}」與ときのそら合作，抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    if (cardHasName(centerCard, "AZKi") && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: ["center"], optional: false, prompt: "SoAzKo：直接按自己的中央 AZKi，附加應援牌庫頂 1 張。" });
  } else if (card.number === "hEB01-005") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], names: ["ときのそら", "Tokino Sora"], unlimitedDebut: true }, map, random, { min: 1, max: 3, optional: false, label: card.keyword?.name || card.name, afterEffect: "soraSummerBottomIfThree" });
  } else if (card.number === "hBP06-053") {
    const options = stageOptionsMatching(opponent, map, { zones: ["center", "collab"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamageEqualCurrentDamage", prompt: "星の運命：直接按對手中央或合作 Holomen，造成等於其目前受傷數值的特殊傷害。", meta: { loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: "collab" } });
  } else if (card.number === "hBP07-036") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], names: ["赤井はあと", "赤井心"] }, map, random, { min: 2, max: 2, optional: false, label: "AKAI HAATO VS HAACHAMA" });
  } else if (card.number === "hSD13-008") {
    enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max: 1, optional: false, targetRule: { tags: ["#Justice"] }, prompt: "For Justice! -GG-：選擇存檔區1張應援，附加到自己1位#Justice成員。" }, map);
  } else if (card.number === "hSD13-009") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["1st"], tags: ["#Justice"] }, map, random, { min: 1, max: 1, optional: false, label: "イタズラ増殖！" });
  } else if (card.number === "hBP01-010") {
    const center = player.zones.center;
    if (center) addStageModifier(center, "arts", 10 + (cardHasTag(unitCard(center, map), "#4期生") || cardHasTag(unitCard(center, map), "#４期生") ? 20 : 0), state.turn, card.number);
  } else if (card.number === "hBP04-070") {
    enqueueStageTarget(state, { playerIndex, effect: "cheerScaledArts", prompt: "因為我要全力以赴：直接按自己 1 位 Holomen；每張應援令本回合 Arts +10（最多 3 張）。", meta: { maximum: 3, perCheer: 10, sourceNumber: card.number } });
  } else if (card.number === "hBP07-066") {
    enqueueStageTarget(state, { playerIndex, effect: "healThenArtsChoice", prompt: "伴隨虛擬世界同行的歌姬：先直接按自己 1 位 Holomen，回復 30 HP。", meta: { heal: 30, sourceNumber: card.number } });
  } else if (card.number === "hBP07-068") {
    const count = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#0期生")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name).filter(Boolean)).size;
    if (count > 0) addStageModifier(player.zones.collab, "arts", count * 20, state.turn, card.number);
  } else if (card.number === "hBP08-047") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const baton = opponent.zones.center ? effectiveBatonCost(state, opponentIndex, opponent.zones.center, "center", map) : 0;
      const baseDrawn = drawCards(state, playerIndex, 1);
      const bonusDrawn = drawCards(state, playerIndex, baton);
      appendLog(state, `${player.name} 因「嗯，天才！」先抽 ${baseDrawn} 張，再按對手中央接力無色費用 ${baton} 額外抽 ${bonusDrawn} 張（合共 ${baseDrawn + bonusDrawn} 張）。`);
    }
  } else if (card.number === "hSD09-003") {
    const count = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#3期生")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name).filter(Boolean)).size;
    if (count > 0 && opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: count * 10, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: "collab" });
  } else if (card.number === "hSD09-005") {
    const count = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#3期生")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name).filter(Boolean)).size;
    if (unitCard(player.zones.center, map)?.stage === "2nd" && count > 0) addStageModifier(player.zones.center, "arts", count * 10, state.turn, card.number);
  } else if (card.number === "hSD10-008") {
    const names = opponent.hand.map((instance) => map.get(instance.number)?.name || instance.number);
    const hasSupport = opponent.hand.some((instance) => map.get(instance.number)?.group === "support");
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "confirm", label: names.length > 0 ? `確認對手手牌：${names.join("、")}` : "確認對手沒有手牌" }], effect: "handInspection", prompt: "FLOW GLOW 的化妝擔當：只有你可查看以下對手手牌。", meta: { draw: hasSupport ? 1 : 0 } });
  } else if (card.number === "hSD10-009") {
    const revealed = player.mainDeck.splice(0, Math.min(opponent.hand.length, player.mainDeck.length));
    if (revealed.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, min: 1, max: 1, effect: "topPickShuffleRest", source: "revealed", prompt: `美の求道者：查看與對手手牌相同的 ${revealed.length} 張牌，揀 1 張加入手牌；餘下洗回牌庫。` });
  } else if (card.number === "hSD12-008") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const amount = totalCheer(player) + totalCheer(opponent);
      appendLog(state, `${player.name} 因雙方舞台共有 ${amount} 張應援，抽 ${drawCards(state, playerIndex, amount)} 張牌。`);
    }
  } else if (card.number === "hSD18-004") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const archived = player.mainDeck.shift();
      if (archived) {
        player.archive.push(archived);
        currentTurnEvents(player, state.turn).deckArchived += 1;
      }
      appendLog(state, `${player.name} 將牌庫頂 ${archived ? 1 : 0} 張放到存檔區。`);
    }
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1)
    appendLog(state, `${player.name} 因「みーなさんっ」的後段效果抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  } else if (card.number === "hSD08-006") {
    const amount = playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1 ? 20 : 10;
    if (opponent.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: "collab" });
  } else if (card.number === "hBP01-031") {
    if (player.holoPower.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: 1, effect: "powerToHandThenDeckTop", source: "holoPower", prompt: "查看 Holo Power，公開 1 張加入手牌；之後牌庫頂 1 張放入 Holo Power。" });
  } else if (card.number === "hBP01-075") {
    const drawCounts = state.players.map((candidate) => candidate.hand.length);
    const cards = [...player.hand];
    if (cards.length > 0) enqueueCardSelection(state, { playerIndex, cards, min: cards.length, max: cards.length, effect: "chaosShuffleBottom", source: "hand", prompt: "カオスシャッフル：按次序將自己的全部手牌放到牌庫底。", meta: { firstIndex: playerIndex, opponentIndex, drawCounts, step: 1 } });
    else if (opponent.hand.length > 0) enqueueCardSelection(state, { playerIndex: opponentIndex, cards: [...opponent.hand], min: opponent.hand.length, max: opponent.hand.length, effect: "chaosShuffleBottom", source: "hand", prompt: "カオスシャッフル：按次序將自己的全部手牌放到牌庫底。", meta: { firstIndex: playerIndex, opponentIndex, drawCounts, step: 2 } });
  } else if (card.number === "hBP05-063") {
    const options = (player.zones.collab?.cheer || []).map((instance) => ({ id: instance.id, number: instance.number, zone: "collab" }));
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "cheerCostThenDeckSearch", optional: true, prompt: "可直接按此 Holomen 身上 1 張應援存檔；支付後搜尋與舞台所有 Holomen 不同名的 Debut。", meta: { rule: { group: "holomem", stages: ["Debut"], excludeStageNames: true }, label: card.keyword?.name || card.name } });
  } else if (card.number === "hBP05-064") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const candidates = player.mainDeck.filter((instance) => map.get(instance.number)?.stage === "Debut");
      const distinct = candidates.filter((c, i) => !candidates.slice(0, i).some(other => talentMatches(map.get(c.number), map.get(other.number))));
      const count = Math.min(2, distinct.length);
      if (count) enqueueCardSelection(state, { playerIndex, cards: candidates, min: count, max: count, optional: false, effect: "differentNamedDeckToHand", source: "deck", prompt: "公開卡名不同的 Debut Holomen 加入手牌。" });
      else player.mainDeck = shuffle(player.mainDeck, random);
    }
  } else if (card.number === "hBP06-064") {
    if (cardHasName(map.get(player.oshi?.number), "ロボ子さん")) {

      const max = Math.min(2, player.hand.length);
      if (max > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 0, max, optional: true, effect: "handArchiveThenNamedReturn", source: "hand", prompt: `可揀 1–${max} 張手牌存檔；之後返回相同數量的ろぼさー。`, meta: { names: ["ろぼさー"] } });
    }
  } else if (["hBP07-032", "hBP07-046", "hBP08-077"].includes(card.number)) {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const groups = card.number === "hBP07-032"
        ? [{ label: "1st 輪堂千速", match: { group: "holomem", stages: ["1st"], names: ["輪堂千速"] } }, { label: "ふぐ太郎", match: { names: ["ふぐ太郎"] } }]
        : card.number === "hBP07-046"
          ? [{ label: "1st Elizabeth", match: { group: "holomem", stages: ["1st"], names: ["エリザベス・ローズ・ブラッドフレイム", "Elizabeth Rose Bloodflame"] } }, { label: "Thorn", match: { names: ["Thorn"] } }]
          : [{ label: "1st 音乃瀬奏", match: { group: "holomem", stages: ["1st"], names: ["音乃瀬奏"] } }, { label: "リコーダー", match: { names: ["リコーダー"] } }];
      queueGroupedDeckToHand(state, playerIndex, groups.map(group => ({ ...group, required: true })), map, random, card.keyword?.name || card.name);
    }
  } else if (card.number === "hBP07-018") {
    const revealed = player.mainDeck.shift();
    if (revealed) {
      if (map.get(revealed.number)?.group === "support") {
        player.hand.push(revealed);
        appendLog(state, `${player.name} 公開支援卡 ${revealed.number} 並加入手牌。`, [revealed]);
      } else {
        player.mainDeck.unshift(revealed);
        appendLog(state, `${player.name} 公開的牌不是支援卡，已放回牌庫頂。`);
      }
    }
  } else if (card.number === "hBP07-040") {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, stages: ["Debut"], names: ["赤井はあと", "赤井心"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "returnBackDebutThenSearch", prompt: "直接按後排 Debut 赤井はあと放到牌庫底；之後搜尋非 Buzz 1st／2nd Holomen。" });
  } else if (card.number === "hBP07-063") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1 && cardHasName(map.get(player.oshi?.number), "AZKi")) {
      const options = stageCheerOptions(opponent, map);
      if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, ownerIndex: opponentIndex, options, effect: "opponentCheerBottom", optional: true, prompt: "可直接按對手舞台 1 張實際應援，放回其應援牌庫底。" });
    }
  } else if (card.number === "hBP08-009") {
    const candidates = player.holoPower.filter((instance) => map.get(instance.number)?.group === "support");
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "powerSupportToHandThenDeckTop", source: "holoPower", prompt: "可從 Holo Power 公開 1 張支援卡加入手牌；成功時牌庫頂 1 張放入 Holo Power。" });
    else player.holoPower = shuffle(player.holoPower, random);
  } else if (card.number === "hBP08-020") {
    if (player.mainDeck.length > 0) enqueueOptionChoice(state, { playerIndex, options: [{ id: "1", label: "存檔牌庫頂 1 張並抽 1" }, { id: "2", label: "存檔牌庫頂 2 張並抽 2", disabled: player.mainDeck.length < 2 }], effect: "archiveDeckTopDraw", optional: true, prompt: "對新生活的期待：選擇要存檔及抽取的張數。", meta: { cardNumber: card.number } });
  } else if (card.number === "hBP08-061") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1 && cardHasName(map.get(player.oshi?.number), "鷹嶺ルイ")) {
      const moved = opponent.holoPower.pop();
      if (moved) {
        opponent.hand.push(moved);
        appendLog(state, `${opponent.name} 將最新 1 張 Holo Power 加入手牌。`);
      }
    }
  } else if (card.number === "hBP08-076") {
    const revealed = player.mainDeck.splice(0, Math.min(3, player.mainDeck.length));
    queueTopLookGroup(state, playerIndex, revealed, [{ required: true, label: "具有 #料理 的 Holomen", match: { group: "holomem", tags: ["#料理"] } }, { required: true, label: "具有 #食べ物 的事件", match: { group: "support", typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#食べ物"] } }], map);
  } else if (card.number === "hSD03-004") {
    if (player.mainDeck.length) enqueueOptionChoice(state, { playerIndex, options: [{ id: "reveal", label: "公開牌庫頂" }], optional: true, effect: "starterSuiseiReveal" });
  } else if (card.number === "hSD12-013") {
    if (stageEntries(player).every(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#Advent"))) {
      const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, stages: ["Debut"] });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "returnBackDebutDraw", optional: true, prompt: "可直接按自己 1 位後排 Debut 放到牌庫底；支付後抽 2 張牌。" });
    }
  } else if (card.number === "hSD13-015") {
    const options = stageCheerOptions(player, map);
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "cheerBottomThenSearch", optional: true, prompt: "可直接按自己舞台 1 張實際應援放回應援牌庫底；之後搜尋並附加 1 張應援。", meta: { sourceZone: "collab" } });
  } else if (card.number === "hBP01-095") {
    const options = stageEntries(opponent).filter(({ zone, unit: stageUnit }) => BACK_SLOTS.includes(zone) && stageUnit.stack.length > 1 && stageUnit.stack.some((instance) => map.get(instance.number)?.stage === "Debut")).map(({ zone }) => zone);
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "collabDebloom", prompt: "巻き戻し：直接按對手 1 位後排 Bloom Holomen，令其變回 Debut。" });
  } else if (card.number === "hBP01-097") {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, rested: false });
    if (player.zones.center && options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "swapCenter", prompt: "直接按自己 1 位活動中的後排 Holomen，與中央互換。" });
  } else if (card.number === "hBP01-080") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "suiseiKoboCollabRoll", prompt: card.keyword.name + "：可以擲骰。", meta: { cardNumber: card.number } });
  } else if (card.number === "hBP01-081") {
    if (player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { colors: ["藍"] }, optional: false, prompt: "選擇自己的藍色 Holomen，附加應援牌庫頂 1 張。" });
  } else if (card.number === "hBP01-083") {
    if (cardHasTag(unitCard(player.zones.center, map), "#ID")) enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "suiseiKoboCollabRoll", prompt: card.keyword.name + "：可以擲骰。", meta: { cardNumber: card.number } });
  } else if (["hBP02-072", "hBP02-073", "hBP02-074"].includes(card.number)) {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "magicSupportRoll", prompt: "可擲骰：偶數時搜尋指定類型支援卡。", meta: { cardNumber: card.number } });
  } else if (["hBP02-069", "hBP02-070", "hBP02-071"].includes(card.number)) {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "magicPairCheerRoll", prompt: "可擲骰：奇數時搜尋指定顏色應援，附加到自己後排。", meta: { cardNumber: card.number } });
  } else if (card.number === "hBP01-096") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "adventureRoll", prompt: "それは「冒険」：可擲骰；偶數時搜尋 Buzz Holomen。", meta: {} });
  } else if (card.number === "hBP01-099") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "edinburghRoll", prompt: "それは「エジンバラ城」：可擲骰；奇數時互換對手中央與後排。", meta: {} });
  } else if (card.number === "hBP04-055") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "laplusRestRoll", prompt: "可擲 1 次骰子；3 以上使對手 1 位後排休息。", meta: {} });
    return;
  } else if (card.number === "hBP03-026") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "mikoMeetingRoll", prompt: "君と待ち合わせ：可以擲一次骰子。", meta: {} });
  } else if (card.number === "hBP04-058") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 3 次骰子" }], optional: true, effect: "laplusTripleRoll", prompt: "可擲 3 次骰子，每次奇數對對手中央造成 10 點特殊傷害。", meta: {} });
    return;
  } else if (card.number === "hSD01-009") {
    enqueueOptionChoice(state,{playerIndex,options:[{id:"roll",label:"擲一次骰子"}],optional:true,effect:"azkiMapRoll",prompt:"可擲一次骰子。",meta:{sourceId:topCard(player.zones.collab)?.id}});
  } else if (card.number === "hSD16-008") {
    const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die);
    if ([3, 5].includes(die)) queueArchiveToHand(state, playerIndex, { names: ["35P"] }, map, { min: 1, max: 1, optional: false, label: card.keyword.name });
  } else if (card.number === "hSD15-007") {
    const archived = player.mainDeck.shift();
    if (archived) {
      player.archive.push(archived);
      currentTurnEvents(player, state.turn).deckArchived += 1;
      appendLog(state, `${player.name} 將牌庫頂 1 張放到存檔區。`, [archived]);
    }
    queueArchiveCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"] }, map, { min: 1, max: 1, optional: true, label: "旅行的前一天" });
  } else if (card.number === "hBP05-068") {
    if ((player.zones.collab?.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) {
      const top = player.mainDeck.shift();
      if (top) enqueueOptionChoice(state, { playerIndex, options: [{ id: "top", label: "放回牌庫頂" }, { id: "bottom", label: "放到牌庫底" }], effect: "topCardPlacement", prompt: `輕鬆休養日：查看到「${map.get(top.number)?.name || top.number}」，選擇放回牌庫頂或底。`, meta: { card: top } });
    }
  } else if (card.number === "hBP08-034") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1 && emptyBackSlots(player).length >= 1 && stageUnitCount(player) < 6) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], names: ["フワワ・アビスガード", "Fuwawa Abyssgard"] }, map, random, { min: 1, max: 1, optional: false, label: "相信 FUWAMOCO！（Fuwawa）", afterEffect: "fuwamocoMococo" });
  } else if (card.number === "hBP08-040") {
    if ((player.zones.collab?.attachments || []).some((instance) => cardHasName(map.get(instance.number), "鬼神刀「阿修羅」")) && !opponent.zones.collab && BACK_SLOTS.some((targetZone) => opponent.zones[targetZone])) enqueueEffect(state, { type: "forcedCollab", playerIndex: opponentIndex, prompt: "桜の気配に誘われて：直接按自己 1 位後排 Holomen 移到合作位置（不視為合作）。" });
  } else if (card.number === "hSD12-014") {
    if (stageEntries(player).every(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#Advent"))) {
      const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, stages: ["Debut"] });
      if (options.length > 0 && player.cheerDeck.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "returnBackDebutForCheer", optional: true, prompt: "ハッピー☆パピー：可直接按自己 1 位後排 Debut 放到牌庫底；之後按牌桌附加應援牌庫頂 1 張。" });
    }
  } else if (card.number === "hBP06-055") {
    if (cardHasName(map.get(player.oshi?.number), "紫咲シオン")) {
      const cheers = opponent.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
      if (opponent.zones.center && cheers.length > 0) enqueueCardSelection(state, { playerIndex, cards: cheers, min: Math.min(3, cheers.length), max: Math.min(3, cheers.length), effect: "opponentArchiveCheerToStage", source: "opponentArchive", prompt: `揀對手存檔區 ${Math.min(3, cheers.length)} 張應援；之後逐張直接按對手中央附加。`, meta: { ownerIndex: opponentIndex, targetPlayerIndex: opponentIndex, targetRule: { zones: ["center"] }, afterOwnShion: true } });
      else enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { names: ["紫咲シオン"] }, prompt: "可揀自己存檔區 1 張應援；下一步直接按紫咲シオン附加。" }, map);
    }
  } else if (card.number === "hSD07-013") {
    if (cardHasName(unitCard(player.zones.center, map), "不知火フレア")) enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { excludeZones: ["center"] }, prompt: "可揀存檔區 1 張應援；下一步直接按中央以外的自己 Holomen。" }, map);
  } else if (card.number === "hBP07-020") {
    const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die, "因 Ya ya ya ya ya～! 擲骰");
    if (die % 2 === 1 && unitCard(opponent.zones.center, map)?.stage === "2nd") enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options: ["center"], effect: "setRemainingHp", prompt: "骰子為奇數：直接按對手中央 2nd Holomen，令其剩餘 HP 變為 100。", meta: { amount: 100 } });
  } else if (card.number === "hBP05-040") {
    const center = player.zones.center;
    const centerCard = unitCard(center, map);
    if (player.life.length <= 3 && center && Number(center.bloomedTurn || 0) === state.turn && ["さくらみこ", "星街すいせい"].some((name) => cardHasName(centerCard, name)) && centerCard?.stage === "1st") {
      player.bonusBloomTurn = state.turn;
      player.bonusBloomUsedTurn = 0;
      player.bonusBloomTargetId = topCard(center)?.id || "";
      const candidates = player.hand.filter((instance) => bloomTargets(player, map.get(instance.number), map, state.turn).includes("center"));
      if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "bonusBloomCard", source: "hand", prompt: "ビジネスフレンド：可揀手牌 1 張合法 2nd Holomen，再直接按中央完成額外 Bloom。" });
      else {
        player.bonusBloomTurn = 0;
        player.bonusBloomTargetId = "";
      }
    }
  } else if (card.number === "hBP07-050") {
    const center = player.zones.center;
    const centerCard = unitCard(center, map);
    const candidates = player.hand.filter((instance) => map.get(instance.number)?.stage === "1st" && centerCard?.stage === "Debut" && cardHasName(centerCard, "オーロ・クロニー") && talentMatches(map.get(instance.number), centerCard) && Number(map.get(instance.number)?.hp || 0) > Number(center?.damage || 0));
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1 && candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "kroniiFirstTurnBloomCard", source: "hand", prompt: "這一天終於來了！：可揀手牌 1 張 1st Ouro Kronii；下一步直接按中央，無視首回合限制 Bloom。" });
  } else if (card.number === "hBP07-035") {
    addPlayerModifier(player, "flowGlowBloomCheer", 1, state.turn, card.number, { sourceId: topCard(player.zones.collab)?.id || "" });
  } else if (card.number === "hBP07-073") {
    addStageModifier(player.zones.collab, "artCost", -2, state.turn, card.number);
  } else if (card.number === "hBP08-043") {
    if (player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length >= 10) addStageModifier(player.zones.collab, "artCost:red", -2, state.turn, card.number);
  } else if (["hSD11-008", "hSD11-009"].includes(card.number)) {
    if (opponent.zones.center) {
      const amount = card.number === "hSD11-009" ? 3 : 1;
      addStageModifier(opponent.zones.center, "batonCost", amount, state.turn + 1, card.number);
      appendLog(state, `${opponent.name} 的中央 Holomen 到其下個回合結束前接力費用 +${amount}。`);
    }
  } else if (card.number === "hBP06-074") {
    if (player.zones.center) addStageModifier(player.zones.center, "arts", Math.min(3, currentTurnEvents(player, state.turn).supports.length) * 10, state.turn, card.number);
  } else if (card.number === "hBP07-008") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      const options = stageOptionsMatching(player, map, { names: ["角巻わため", "角卷綿芽"] });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "oshiRepeatArts", prompt: "再來一發：直接按自己 1 位角巻わため，本回合可再使用一次相同 Arts。" });
    }
  } else if (card.number === "hBP07-086") {
    const options = stageOptionsMatching(player, map, { names: ["ジジ・ムリン", "Gigi Murin"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "attackDamagedBack", prompt: "執念のチェイサー：直接按自己 1 位 Gigi Murin，本回合可用 Arts 指定已受傷的對手後排。" });
  } else if (card.number === "hBP08-068") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken || 0) === 1) stageEntries(opponent).forEach(({ unit: stageUnit }) => addStageModifier(stageUnit, "allColors", 1, state.turn, card.number));
  } else if (card.number === "hBP08-073") {
    const options = stageOptions(opponent);
    if (options.length >= 2) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "allColorsFirst", prompt: "要乖乖坐好喔？：先按對手第 1 位 Holomen。", meta: { sourceNumber: card.number } });
  } else if (card.number === "hBP07-043") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "3", label: "骰子視為 3" }, { id: "5", label: "骰子視為 5" }], effect: "mikoDieOverride", prompt: "holoRêve -みこ-：選擇本回合さくらみこ能力的骰子點數。" });
  } else if (card.number === "hBP08-045") {
    addPlayerModifier(player, "baeDieMultiplier", 2, state.turn, card.number);
  } else if (card.number === "hEB01-019") {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueGroupedDeckToHand(state, playerIndex, [{ required: true, label: "Debut", match: { group: "holomem", stages: ["Debut"] } }, { required: true, label: "#こよラボ", match: { group: "support", tags: ["#こよラボ"] } }], map, random, card.keyword?.name || card.name);
  } else if (card.number === "hEB01-021") {
    const count = assistantCount(player);
    if (count > 0) enqueueEffect(state, { type: "healDistribution", playerIndex, count, unitAmount: 20, sourceName: card.keyword?.name || card.name, prompt: `合作效果：將 ${count} 個「20 HP 回復」分配到自己舞台上的 Holomen。` });
  } else if (card.number === "hSD06-008") {
    const center = map.get(topCard(player.zones.center)?.number);
    if (cardHasTag(center, "#秘密結社holoX") && player.hand.length <= 5 && drawCards(state, playerIndex, 1) > 0) appendLog(state, `${player.name} 因「腦力爆發！」抽 1 張牌。`);
  } else if (card.number === "hBP08-088") {
    if (!usedNamedThisTurn(player, "gift:hBP08-088", state.turn)) {
      markNamedUsage(player, "gift:hBP08-088", state.turn);
      ["center", "collab"].forEach((targetZone) => {
        if (state.players[opponentIndex].zones[targetZone]) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone, amount: 20, loseLife: true, sourceName: card.keyword?.name || card.name, sourceZone: "collab" });
      });
    }
  } else if (["collab", "collab_effect"].includes(card.keyword?.type)) queueSimpleTriggeredKeyword(state, playerIndex, "collab", card, map, random);
}

function queueStageGiftCollabEffects(state, playerIndex, collabCard, map) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    if (!giftCard || giftUnit === player.zones.collab || !giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    if (giftCard.number === "hBP06-026" && player.hand.length >= 5 && player.cheerDeck.length > 0) {
      enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: ["collab"], optional: true, prompt: "送上元氣！：可按合作 Holomen，附加應援牌庫頂 1 張。" });
    } else if (giftCard.number === "hBP07-017" && cardIsBuzz(collabCard) && cardHasTag(collabCard, "#ID3期生")) {
      enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: "holoh3ro Shopping：直接按自己舞台上 1 位 Holomen，本回合 Arts +30。", meta: { kind: "arts", amount: 30, sourceNumber: giftCard.number } });
    } else if (giftCard.number === "hBP08-051" && cardHasName(collabCard, "水宮枢")) {
      if (opponent.zones.center) {
        addStageModifier(opponent.zones.center, "batonCost", 1, state.turn + 1, giftCard.number);
        appendLog(state, `${opponent.name} 的中央 Holomen 在下一個對手回合結束前接力無色費用 +1。`);
      }
    }
  }
}

function queuePerformanceStartGiftEffects(state, playerIndex, map) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  for (const { zone, unit: giftUnit } of stageEntries(opponent)) {
    const giftCard = unitCard(giftUnit, map);
    if (giftCard?.number !== "hBP03-022" || !giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    enqueueOptionChoice(state, {
      playerIndex: opponentIndex,
      options: [{ id: "use", label: "本回合防止對手能力令生命減少" }],
      prompt: "異國世界的姿態：可在對手表演階段開始時使用。",
      effect: "giftAbilityLifeShield",
      optional: true,
      meta: { sourceId: topCard(giftUnit)?.id },
    });
  }

  const marineCenter = player.zones.center;
  const marineCenterCard = unitCard(marineCenter, map);
  if (player.oshi?.number === "hEB01-002"
    && player.zones.collab
    && marineCenter
    && cardHasName(marineCenterCard, "宝鐘マリン")
    && Number(marineCenter.bloomedTurn || 0) === state.turn) {
    const candidates = player.hand.filter((instance) => {
      const bloomCard = map.get(instance.number);
      const allowedStages = bloomCard?.stage === "1st" ? ["Debut", "1st"] : bloomCard?.stage === "2nd" ? ["1st", "2nd"] : [];
      return bloomCard?.group === "holomem"
        && (bloomCard.colors || []).includes("藍")
        && cardHasName(bloomCard, "宝鐘マリン")
        && allowedStages.includes(marineCenterCard?.stage)
        && talentMatches(bloomCard, marineCenterCard)
        && Number(bloomCard.hp || 0) > Number(marineCenter.damage || 0);
    });
    if (candidates.length > 0) enqueueCardSelection(state, {
      playerIndex,
      cards: candidates,
      min: 0,
      max: 1,
      effect: "oshiMarineStageBloomCard",
      source: "hand",
      optional: true,
      prompt: "魔性の再演：可揀 1 張手牌中的藍色宝鐘マリン；下一步直接按中央完成再次 Bloom。",
    });
  }

  const kronii = player.zones.center;
  if (unitCard(kronii, map)?.number === "hBP07-056") {
    const cards = (kronii.stack || []).slice(0, -1).filter((instance) => {
      const bloomCard = map.get(instance.number);
      return bloomCard?.group === "holomem" && ["1st", "2nd"].includes(bloomCard.stage) && stageEntries(player).some(({ zone, unit: target }) => zone !== "center"
        && talentMatches(bloomCard, unitCard(target, map))
        && Number(target.enteredTurn || 0) !== state.turn
        && Number(target.bloomedTurn || 0) !== state.turn
        && Number(bloomCard.hp || 0) > Number(target.damage || 0));
    });
    if (cards.length > 0) enqueueCardSelection(state, {
      playerIndex,
      cards,
      min: 0,
      max: 1,
      effect: "giftKroniiBloomCard",
      source: "stack",
      optional: true,
      prompt: "時界を統べし者：可揀中央 Ouro Kronii 下方 1 張 Holomen；下一步直接按另一位 Ouro Kronii Bloom。",
      meta: { sourceZone: "center" },
    });
  }

  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    if (giftCard?.number !== "hSD11-006" || !giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    const cards = player.hand.filter((instance) => map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#FLOW GLOW"));
    const hasYellow = player.archive.some((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("黃"));
    const hasTarget = stageOptionsMatching(player, map, { names: ["虎金妃笑虎"] }).length > 0;
    if (cards.length > 0 && hasYellow && hasTarget) enqueueCardSelection(state, {
      playerIndex,
      cards,
      min: 0,
      max: 1,
      effect: "giftFlowGlowPerformanceCost",
      source: "hand",
      optional: true,
      prompt: "戯笑の使者：可揀 1 張手牌 #FLOW GLOW Holomen 放到存檔區；之後揀黃色應援附加到虎金妃笑虎。",
    });
  }
}

function queueStageEntryGiftEffects(state, playerIndex, enteredZone, enteredCard, map) {
  if (!enteredCard || !["Debut", "Spot"].includes(enteredCard.stage) || !cardHasTag(enteredCard, "#Justice")) return;
  const player = state.players[playerIndex];
  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    const usageKey = `gift:hSD13-014:${topCard(giftUnit)?.id || zone}`;
    if (giftCard?.number !== "hSD13-014" || !["center", "collab"].includes(zone) || usedNamedThisTurn(player, usageKey, state.turn)) continue;
    markNamedUsage(player, usageKey, state.turn);
    appendLog(state, `${player.name} 因「正義の旋律」見到 ${enteredCard.name || enteredCard.number} 登上 ${enteredZone}，抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  }
}

function queueGiftOshiSkillEffects(state, playerIndex, skill, kind, map) {
  const player = state.players[playerIndex];
  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    if (!giftCard || !giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    if (giftCard.number === "hBP05-038" && zone === "collab" && kind === "sp" && /BAU\s*BAU/iu.test(String(skill?.name || ""))) {
      const extra = stageEntries(player).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd") ? 50 : 0;
      addStageModifier(giftUnit, "arts", 70 + extra, state.turn, giftCard.number);
      appendLog(state, `${giftCard.name} 因「モココェ」本回合 Arts +${70 + extra}。`);
    }
    if (giftCard.number === "hBP05-050" && zone === "center" && kind === "oshi" && /モコちゃん/u.test(String(skill?.name || "")) && player.cheerDeck.length > 0) {
      enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { tags: ["#Advent"] }, optional: false, prompt: "モゴジャ～～ン！！！：直接按自己 1 位 #Advent Holomen，附加應援牌庫頂 1 張。" });
    }
    if (giftCard.number === "hBP07-045" && kind === "sp" && player.mainDeck.length > 0) {
      player.holoPower.push(player.mainDeck.shift());
      appendLog(state, `${player.name} 因「テンション上がってきた！」將牌庫頂 1 張放到 Holo Power。`);
    }
  }
}

function opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex) {
  if (ownerIndex === sourcePlayerIndex) return false;
  return (state.players[ownerIndex]?.modifiers || []).some((modifier) => modifier.kind === "abilityLifeLossImmune" && Number(modifier.expiresTurn || 0) >= state.turn);
}

function queueFlowGlowArchivedCards(state, playerIndex, sourceCard, archived, map) {
  if (cardHasTag(sourceCard, "#FLOW GLOW")) queueHsd11SpOshiTrigger(state, playerIndex, archived.filter(c => map.get(c.number)?.group === "cheer").length, map);
}
function queueHsd11SpOshiTrigger(state, playerIndex, archivedCount, map) {
  const count = Number(archivedCount || 0);
  if (count <= 0) return;
  const player = state.players[playerIndex];
  if (player?.oshi?.number !== "hSD11-001" || player.spOshiSkillUsed || !canPayReactiveOshi(state, playerIndex, "sp", map)) return;
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const options = stageOptionsMatching(state.players[opponentIndex], map, { zones: ["center", "collab"] });
  if (options.length === 0) return;
  enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: "FLOW GLOW應援存檔：對手中央或合作造成 " + (count * 30) + " 點特殊傷害" }], optional: true, prompt: "Tiger Eye：自己的 #FLOW GLOW Holomen 能力存檔應援後，可使用 SP 推し技能。", effect: "hSD11FlowGlowArchiveSp", meta: { amount: count * 30, opponentIndex } });
}

function queueHbp01Oshi008Trigger(state, playerIndex, sourceZone, map) {
  const player = state.players[playerIndex];
  const source = player?.zones?.[sourceZone];
  const sourceCard = unitCard(source, map);
  if (player?.oshi?.number !== "hBP01-008" || !source || !sourceCard || !(sourceCard.colors || []).includes("藍")) return;
  if (Number(player.oshiSkillTurn || 0) === state.turn || !canPayReactiveOshi(state, playerIndex, "oshi", map)) return;
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const options = stageOptionsMatching(state.players[opponentIndex], map);
  if (options.length === 0) return;
  enqueueOptionChoice(state, {
    playerIndex,
    options: [{ id: "use", label: "雨之薩滿術：對手 1 位 Holomen 造成 20 點特殊傷害" }],
    optional: true,
    prompt: "藍色 Holomen 能力存檔應援後：可使用雨之薩滿術。",
    effect: "hBP01-008CheerArchive",
    meta: { opponentIndex, sourceZone },
  });
}

function triggerCheerArchivedGift(state, playerIndex, map, amount = 1) {
  if (amount <= 0) return;
  const player = state.players[playerIndex];
  currentTurnEvents(player, state.turn).cheerArchived += amount;
  if (state.activePlayer !== playerIndex) return;
  const gift = stageEntries(player).find(({ zone, unit: giftUnit }) => unitCard(giftUnit, map)?.number === "hBP08-031"
    && giftZoneApplies(giftText(giftUnit, map), zone)
    && !usedNamedThisTurn(player, "gift:hBP08-031", state.turn));
  if (!gift) return;
  markNamedUsage(player, "gift:hBP08-031", state.turn);
  appendLog(state, `${player.name} 因「SPY-C1000」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
}

function queueStageReturnGiftEffects(state, playerIndex, returnedCards, map) {
  currentTurnEvents(state.players[playerIndex], state.turn).stageReturned += returnedCards.filter(instance => map.get(instance.number)?.group === "holomem").length;
  const player = state.players[playerIndex];
  if (state.activePlayer !== playerIndex || !returnedCards.some((instance) => cardHasName(map.get(instance.number), "赤井はあと"))) return;
  if (player.oshi?.number === "hBP07-004" && !usedNamedThisTurn(player, "oshi-stage:hBP07-004", state.turn)) {
    markNamedUsage(player, "oshi-stage:hBP07-004", state.turn);
    appendLog(state, `${player.name} 因「はあちゃまなう」抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
  }
  const gift = stageEntries(player).find(({ zone, unit: giftUnit }) => unitCard(giftUnit, map)?.number === "hBP07-039"
    && giftZoneApplies(giftText(giftUnit, map), zone)
    && !usedNamedThisTurn(player, "gift:hBP07-039", state.turn));
  if (!gift) return;
  const hasCheer = player.archive.some((instance) => map.get(instance.number)?.group === "cheer");
  if (!hasCheer) return;
  markNamedUsage(player, "gift:hBP07-039", state.turn);
  enqueueArchiveCheerToTarget(state, playerIndex, { targetZone: gift.zone, targetRule: { zones: [gift.zone] }, optional: true, prompt: "血ゃ舞ってる奴いる！？：可揀存檔區 1 張應援，附加到 Gift 來源。" }, map);
}

function queueAttachmentCollabEffects(state, playerIndex, map) {
  const player = state.players[playerIndex];
  const stageUnit = player.zones.collab;
  const card = unitCard(stageUnit, map);
  if (!stageUnit || !card) return;
  const has = (number) => stageUnit.attachments.some((instance) => instance.number === number);
  let draws = 0;
  if (has("hBP02-089") && cardHasName(card, "白上フブキ")) draws += 1;
  if (has("hBP03-098") && cardHasName(card, "さくらみこ")) draws += 1;
  if (draws > 0) appendLog(state, `${player.name} 因合作位置的附加卡抽 ${drawCards(state, playerIndex, draws)} 張牌。`);
  if (has("hBP02-091") && cardHasName(card, "白上フブキ")) queueArchiveToHand(state, playerIndex, { typeCodes: ["supportMascot"] }, map, { min: 1, max: 1, optional: true, label: "Fubuchun" });
  if (has("hBP03-099") && cardHasName(card, "さくらみこ") && player.zones.center && cardHasName(unitCard(player.zones.center, map), "さくらみこ")) addStageModifier(player.zones.center, "arts", 10, state.turn, "hBP03-099");
  if (has("hBP03-102") && cardHasName(card, "戌神ころね")) {
    const yellow = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("黃"));
    if (yellow.length > 0) enqueueCardSelection(state, { playerIndex, cards: yellow, min: 0, max: 1, effect: "archiveCheerToStage", source: "archive", optional: true, prompt: "胖狗：可揀 1 張存檔區黃色應援附加到合作中的戌神ころね。", meta: { targetZone: "collab", targetRule: { zones: ["collab"] } } });
  }
  if (has("hBP03-104") && cardHasName(card, "アユンダ・リス")) {
    const cheerOptions = stageCheerOptions(player, map).filter((option) => option.zone !== "collab");
    if (cheerOptions.length > 0) enqueueStageCheerSelection(state, { playerIndex, options: cheerOptions, effect: "moveSelectedCheerToZone", optional: true, prompt: "Riscot：可直接按舞台上 1 張應援改附到合作 Holomen。", meta: { targetZone: "collab", remaining: 1 } });
  }
  if (has("hBP06-098") && cardHasName(card, "百鬼あやめ") && player.life.length === 1) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = state.players[opponentIndex];
    if (!opponent.zones.collab && BACK_SLOTS.some((zone) => opponent.zones[zone])) enqueueEffect(state, { type: "forcedCollab", playerIndex: opponentIndex, prompt: "鬼神刀「阿修羅」：直接按自己一位後排 Holomen 移到合作位置（不視為合作）。" });
  }
  if (has("hBP07-106") && cardHasName(card, "大神ミオ")) enqueueOptionChoice(state, { playerIndex, effect: "hatoTaurus", optional: true, options: [{ id: "use", label: "將 HatoTaurus 放回牌庫頂並回收 1 張 Holomen" }], prompt: "HatoTaurus：可使用合作觸發。", meta: { zone: "collab" } });
}

function queueDrawingStreamArchive(state, playerIndex, map) {
  const player = state.players[playerIndex];
  const archiveTargets = player.archive.filter((instance) => cardHasTag(map.get(instance.number), "#絵") && map.get(instance.number)?.group === "holomem");
  if (archiveTargets.length > 0) enqueueCardSelection(state, { playerIndex, cards: archiveTargets, min: 1, max: 1, prompt: "繪畫直播：揀 1 張持有 #絵 的 Holomen 返回手牌。", effect: "archiveToHand", source: "archive" });
}

function attachmentTargets(player, attachment, map) {
  const typeCode = String(attachment.typeCode || "");
  const text = String(attachment.abilityText || "");
  const restrictionSentence = text.split(/[。\n]/u).find((sentence) => /(?:只能|只可|此(?:粉絲|應援|Fan|FAN)).*(?:裝備|附加|附著|附給|附於)/iu.test(sentence)) || "";
  const namedRestrictions = [...restrictionSentence.matchAll(/〈([^〉]+)〉/gu)].map((match) => match[1]);
  return STAGE_SLOTS.filter((slot) => {
    const stageUnit = player.zones[slot];
    if (!stageUnit) return false;
    if (["supportTool", "supportMascot"].includes(typeCode) && stageUnit.attachments.some((instance) => map.get(instance.number)?.typeCode === typeCode)) {
      const top = map.get(topCard(stageUnit)?.number);
      const canHoldTwoMascots = typeCode === "supportMascot" && top?.number === "hBP02-013" && stageUnit.attachments.filter((instance) => map.get(instance.number)?.typeCode === typeCode).length < 2 && !stageUnit.attachments.some((instance) => instance.number === attachment.number);
      if (!canHoldTwoMascots) return false;
    }
    if (namedRestrictions.length === 0) return true;
    return namedRestrictions.some((name) => cardHasName(map.get(topCard(stageUnit)?.number), name));
  });
}

function queueAttachment(state, playerIndex, cardInstance, card, map) {
  const player = state.players[playerIndex];
  const options = attachmentTargets(player, card, map);
  assert(options.length > 0, `舞台上沒有可附加「${card.name}」的合法 Holomen。`);
  state.pendingChoice = { type: "attachSupport", playerIndex, cardId: cardInstance.id, cardNumber: card.number, options };
}

function queueAssistantCheerMove(state, playerIndex, targetZone) {
  const player = state.players[playerIndex];
  const cheerOptions = STAGE_SLOTS.flatMap((zone) => zone === targetZone ? [] : (player.zones[zone]?.cheer || []).map((cheer) => ({ id: cheer.id, number: cheer.number, zone })));
  if (cheerOptions.length === 0) return;
  state.pendingChoice = {
    type: "moveCheer",
    playerIndex,
    targetZone,
    options: cheerOptions.map((option) => option.id),
    cheerOptions,
    optional: true,
    prompt: "「こよりの助手くん」：可按舞台上另一位 Holomen 身上的 1 張應援，移到附加目標。",
  };
  appendLog(state, `${player.name} 可選擇舞台上的 1 張應援，移到附加了「こよりの助手くん」的 Holomen。`);
}

function queueAttachmentEntryEffects(state, playerIndex, targetZone, attachment, map, random, source = "hand") {
  const player = state.players[playerIndex];
  const target = player.zones[targetZone];
  const targetCard = unitCard(target, map);
  if (!target || !attachment) return;
  if (targetCard?.number === "hBP07-024" && cardHasName(attachment, "ミオファ")) {
    const usageKey = `gift:hBP07-024:${topCard(target)?.id || targetZone}`;
    if (!usedNamedThisTurn(player, usageKey, state.turn)) {
      markNamedUsage(player, usageKey, state.turn);
      appendLog(state, `${player.name} 因「我重要的家人」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    }
  }
  if (attachment.number === ASSISTANT_CARD) queueAssistantCheerMove(state, playerIndex, targetZone);
  if (source === "hand" && attachment.number === "hBP02-088" && cardHasName(targetCard, "森カリオペ") && ["1st", "2nd"].includes(targetCard?.stage) && player.mainDeck.length > 0) {
    player.archive.push(player.mainDeck.shift());
    appendLog(state, `${player.name} 因森美聲的鐮刀將牌庫頂 1 張放到存檔區。`);
  }
  if (source === "hand" && attachment.number === "hBP01-125" && player.hand.length > 0) enqueueHandToDestination(state, playerIndex, { min: 0, max: 1, optional: true, effect: "kfpDiscard", prompt: "KFP：可將 1 張手牌放到存檔區；若有支付便抽 1 張。" });
  if (source === "hand" && attachment.number === "hBP05-082") {
    const canDiscardHand = player.hand.length > 0;
    const axeOptions = stageEntries(player).flatMap(({ zone, unit: stageUnit }) => stageUnit.attachments.filter((instance) => instance.number === "hBP01-114").map((instance) => ({ id: instance.id, number: instance.number, zone })));
    assert(canDiscardHand || axeOptions.length > 0, "亞綺·羅森塔爾的斧頭需要存檔 1 張手牌或舞台上的石斧。 ");
    enqueueOptionChoice(state, { playerIndex, effect: "akiAxeCost", options: [{ id: "hand", label: "存檔 1 張手牌", disabled: !canDiscardHand }, { id: "stoneAxe", label: "存檔舞台上的石斧", disabled: axeOptions.length === 0 }], prompt: "支付亞綺·羅森塔爾的斧頭使用成本。", meta: { axeOptions } });
  }
  if (source === "hand" && attachment.number === "hBP06-099") queueArchiveToHand(state, playerIndex, { group: "holomem", names: ["戌神ころね"] }, map, { min: 1, max: 1, optional: true, label: "手指" });
  if (["hand", "archive"].includes(source) && attachment.number === "hBP08-107") enqueueOptionChoice(state, { playerIndex, effect: "otomoState", optional: true, options: [{ id: "active", label: "變為活動狀態" }, { id: "rested", label: "變為休息狀態" }], prompt: "Otomo：選擇附加目標變為活動或休息狀態。", meta: { targetZone } });
  if (source === "hand" && attachment.number === "hSD12-016" && ["1st", "2nd"].includes(targetCard?.stage) && cardHasName(targetCard, "古石ビジュー")) {
    const options = stageCheerOptions(player, map);
    if (options.length > 0 && player.cheerDeck.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "geowCost", optional: true, prompt: "GEOW：可直接按舞台上 1 張實際應援放到存檔區；若支付，從應援牌庫公開 1 張再按牌桌附加。" });
  }
  void random;
}

function isAttachment(card) {
  return ["supportTool", "supportMascot", "supportFan"].includes(String(card?.typeCode || ""));
}

function commitSupport(state, playerIndex, cardInstance, card) {
  const player = state.players[playerIndex];
  const selected = removeById(player.hand, cardInstance.id);
  assert(selected, "手牌已改變，請重新選擇。 ");
  player.archive.push(selected);
  currentTurnEvents(player, state.turn).supports.push(card.number);
  if (String(card.type || "").toUpperCase().includes("LIMITED")) {
    if (Number(player.limitedTurn || 0) !== state.turn) player.limitedUsesCount = 0;
    player.limitedTurn = state.turn;
    player.limitedUsesCount = Number(player.limitedUsesCount || 0) + 1;
  }
  appendLog(state, `${player.name} 使用「${card.name}」。`, [selected]);
  return selected;
}

function cardMatchesRule(card, rule, player, map) {
  if (!card || !rule) return false;
  if (rule.group && card.group !== rule.group) return false;
  if (rule.stages && !rule.stages.includes(card.stage)) return false;
  if (rule.excludeStages?.includes(card.stage)) return false;
  if (rule.tags && !rule.tags.some((tag) => cardHasTag(card, tag))) return false;
  if (rule.allTags && !rule.allTags.every((tag) => cardHasTag(card, tag))) return false;
  if (rule.names) {
    if (!rule.names.some((name) => cardHasName(card, name))) return false;
  }
  if (rule.excludeNames?.some((name) => cardHasName(card, name))) return false;
  if (rule.excludeStageNames && stageEntries(player).some(({ unit: stageUnit }) => talentMatches(card, unitCard(stageUnit, map)))) return false;
  if (rule.colors && !(card.colors || []).some((color) => rule.colors.includes(color))) return false;
  if (rule.typeCodes && !rule.typeCodes.includes(card.typeCode)) return false;
  if (rule.limited && !String(card.type || "").toUpperCase().includes("LIMITED")) return false;
  if (rule.excludeBuzz && String(card.type || "").toUpperCase().includes("BUZZ")) return false;
  if (rule.buzz != null && cardIsBuzz(card) !== Boolean(rule.buzz)) return false;
  if (rule.unlimitedDebut && !cardIsUnlimitedDebut(card)) return false;
  if (rule.keywordTypes && !rule.keywordTypes.includes(card.keyword?.type)) return false;
  if (rule.extraPattern && !new RegExp(rule.extraPattern, "u").test(String(card.extra || ""))) return false;
  if (rule.nameIncludes && !rule.nameIncludes.some((name) => cardAliases(card).some((alias) => alias.includes(String(name).replaceAll(" ", ""))))) return false;
  if (rule.sameOshiColor) {
    const oshiColors = map.get(player.oshi?.number)?.colors || [];
    if (!(card.colors || []).some((color) => oshiColors.includes(color))) return false;
  }
  if (rule.sameOshiName && !talentMatches(card, map.get(player.oshi?.number) || {})) return false;
  return true;
}

function queueBottomOrder(state, playerIndex, cards, prompt = "按次序選擇；第 1 張會最先放到牌庫底。") {
  if (cards.length > 0) enqueueCardSelection(state, { playerIndex, cards, min: cards.length, max: cards.length, prompt, effect: "bottomOrder", source: "revealed" });
}

function queueTopLookGroup(state, playerIndex, cards, groups, map) {
  const [group, ...remainingGroups] = groups || [];
  if (!group) {
    queueBottomOrder(state, playerIndex, cards, "效果餘下卡片：按次序選擇；第 1 張會最先放到牌庫底。");
    return;
  }
  const player = state.players[playerIndex];
  const selectableIds = cards.filter((instance) => cardMatchesRule(map.get(instance.number), group.match, player, map)).map((instance) => instance.id);
  if (selectableIds.length === 0) {
    queueTopLookGroup(state, playerIndex, cards, remainingGroups, map);
    return;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards,
    selectableIds,
    min: group.required ? 1 : 0,
    max: 1,
    prompt: `查看牌庫：${group.required ? "公開" : "可公開"} 1 張${group.label}加入手牌。`,
    effect: "topLookGrouped",
    source: "revealed",
    optional: !group.required,
    meta: { remainingGroups },
  });
}

function playTopLookSupport(state, playerIndex, cardInstance, card, rule, map) {
  const player = state.players[playerIndex];
  if (Number.isInteger(rule.handLimit)) assert(player.hand.length - 1 <= rule.handLimit, `使用「${card.name}」時，除這張卡外的手牌不可多於 ${rule.handLimit} 張。`);
  commitSupport(state, playerIndex, cardInstance, card);
  const revealed = player.mainDeck.splice(0, Number(rule.count || 4));
  appendLog(state, `${player.name} 因「${card.name}」查看牌庫上方 ${revealed.length} 張牌。`);
  if (rule.groups) {
    queueTopLookGroup(state, playerIndex, revealed, rule.groups, map);
    return;
  }
  const selectableIds = revealed.filter((instance) => cardMatchesRule(map.get(instance.number), rule.match, player, map)).map((instance) => instance.id);
  if (selectableIds.length === 0) {
    queueBottomOrder(state, playerIndex, revealed, "沒有符合條件的牌：按次序選擇；第 1 張會最先放到牌庫底。");
    return;
  }
  const max = Math.min(Number(rule.max || selectableIds.length), selectableIds.length);
  enqueueCardSelection(state, {
    playerIndex,
    cards: revealed,
    selectableIds,
    min: rule.required ? 1 : 0,
    max,
    prompt: `可公開最多 ${max} 張符合條件的卡加入手牌；亦可不公開。`,
    effect: "topLookToHand",
    source: "revealed",
    optional: !rule.required,
  });
}

function queueDeckSearch(state, playerIndex, rule, map, random, label) {
  const player = state.players[playerIndex];
  const candidates = player.mainDeck.filter((instance) => cardMatchesRule(map.get(instance.number), rule.match, player, map));
  if (candidates.length > 0) {
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, prompt: `${label}：可從牌庫公開 1 張符合條件的卡加入手牌，亦可不公開。`, effect: "deckToHandShuffle", source: "deck", optional: !rule.required });
  } else player.mainDeck = shuffle(player.mainDeck, random);
}

function queueDeckCardsToStage(state, playerIndex, rule, map, random, { min = 1, max = 1, optional = true, label = "牌庫登場效果", afterEffect = "", afterMeta = {} } = {}) {
  const player = state.players[playerIndex];
  const candidates = player.mainDeck.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
  const availableSlots = Math.min(emptyBackSlots(player).length, Math.max(0, 6 - stageUnitCount(player)));
  const selectableMax = Math.min(max, candidates.length, availableSlots);
  if (selectableMax <= 0) {
    player.mainDeck = shuffle(player.mainDeck, random);
    appendLog(state, candidates.length === 0
      ? `${player.name} 的${label}在目前主牌庫中沒有符合條件的卡；牌庫已洗牌。`
      : `${player.name} 的${label}有符合條件的卡，但舞台已滿 6 位或沒有合法後排空位；牌庫已洗牌。`);
    if (afterEffect === "oshiCheerEveryHolomem") enqueueEffect(state, { type: "finalizeCardsToStage", playerIndex, afterEffect, selectedIds: [], selectedCount: 0 });
    return;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards: candidates,
    min: optional ? 0 : Math.min(min, selectableMax),
    max: selectableMax,
    prompt: `${label}：從牌庫公開 ${min === max ? min : `${min}–${selectableMax}`} 張符合條件的 Debut；之後逐張直接按牌桌空位。`,
    effect: "deckCardsToStage",
    source: "deck",
    optional,
    meta: { afterEffect, afterMeta },
  });
}

function queueArchiveCardsToStage(state, playerIndex, rule, map, { min = 1, max = 1, optional = true, label = "存檔區登場效果", afterEffect = "", afterMeta = {} } = {}) {
  const player = state.players[playerIndex];
  const candidates = player.archive.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
  const selectableMax = Math.min(max, candidates.length, emptyBackSlots(player).length, Math.max(0, 6 - stageUnitCount(player)));
  if (selectableMax <= 0) return;
  enqueueCardSelection(state, {
    playerIndex,
    cards: candidates,
    min: optional ? 0 : Math.min(min, selectableMax),
    max: selectableMax,
    prompt: `${label}：揀選卡片後逐張直接按牌桌空位。`,
    effect: "archiveCardsToStage",
    source: "archive",
    optional,
    meta: { afterEffect, afterMeta },
  });
}

function queueDeckToHand(state, playerIndex, rule, map, random, { min = 1, max = 1, optional = true, label = "牌庫搜尋", effect = "deckToHandShuffle", meta = {} } = {}) {
  const player = state.players[playerIndex];
  const candidates = player.mainDeck.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
  const selectableMax = Math.min(max, candidates.length);
  if (selectableMax <= 0) {
    player.mainDeck = shuffle(player.mainDeck, random);
    appendLog(state, `${player.name} 的${label}沒有符合條件的卡；牌庫已洗牌。`);
    return false;
  }
  enqueueCardSelection(state, {
    playerIndex,
    cards: candidates,
    min: optional ? 0 : Math.min(min, selectableMax),
    max: selectableMax,
    prompt: `${label}：可公開${min === max ? ` ${min} 張` : ` ${min}–${selectableMax} 張`}符合條件的卡加入手牌。`,
    effect,
    source: "deck",
    optional,
    meta,
  });
  return true;
}

function queueGroupedDeckToHand(state, playerIndex, groups, map, random, label = "分組牌庫搜尋") {
  const player = state.players[playerIndex];
  const [group, ...remainingGroups] = groups || [];
  if (!group) {
    player.mainDeck = shuffle(player.mainDeck, random);
    appendLog(state, `${player.name} 完成${label}並洗牌。`);
    return;
  }
  const cards = player.mainDeck.filter((instance) => cardMatchesRule(map.get(instance.number), group.match || {}, player, map));
  if (cards.length === 0) {
    queueGroupedDeckToHand(state, playerIndex, remainingGroups, map, random, label);
    return;
  }
  enqueueCardSelection(state, { playerIndex, cards, min: group.required ? 1 : 0, max: 1, optional: !group.required, effect: "groupedDeckToHand", source: "deck", prompt: `${label}：可公開 1 張${group.label || "符合條件的卡"}加入手牌。`, meta: { remainingGroups, label } });
}

function queueArchiveToHand(state, playerIndex, rule, map, { min = 1, max = 1, optional = true, label = "存檔區回收", effect = "archiveToHand", meta = {} } = {}) {
  const player = state.players[playerIndex];
  const candidates = player.archive.filter((instance) => cardMatchesRule(map.get(instance.number), rule, player, map));
  const selectableMax = Math.min(max, candidates.length);
  if (selectableMax <= 0) return false;
  enqueueCardSelection(state, {
    playerIndex,
    cards: candidates,
    min: optional ? 0 : Math.min(min, selectableMax),
    max: selectableMax,
    prompt: `${label}：揀選要返回手牌的卡。`,
    effect,
    source: "archive",
    optional,
    meta,
  });
  return true;
}

function allStageCardsMatch(player, map, predicate) {
  const entries = stageEntries(player);
  return entries.length > 0 && entries.every(({ unit: stageUnit }) => predicate(unitCard(stageUnit, map)));
}

function commitNamedSupport(state, playerIndex, cardInstance, card, key = card.number) {
  const player = state.players[playerIndex];
  assert(!usedNamedThisTurn(player, key, state.turn), `本回合已使用過「${card.name}」。`);
  const selected = commitSupport(state, playerIndex, cardInstance, card);
  markNamedUsage(player, key, state.turn);
  return selected;
}

function playDeckSearchSupport(state, playerIndex, cardInstance, card, rule, map, random) {
  const player = state.players[playerIndex];
  if (rule.costStageCheer) {
    const cheerOptions = stageEntries(player).flatMap(({ zone, unit: stageUnit }) => stageUnit.cheer.map((cheer) => ({ id: cheer.id, number: cheer.number, zone })));
    assert(cheerOptions.length >= rule.costStageCheer, `使用「${card.name}」需要將舞台上的 ${rule.costStageCheer} 張應援放到存檔區。`);
    state.pendingChoice = {
      type: "payStageCheerForSearch",
      playerIndex,
      cardId: cardInstance.id,
      cardNumber: card.number,
      options: cheerOptions.map((option) => option.id),
      cheerOptions,
      searchRule: clone(rule),
      prompt: `${card.name}：直接按舞台上要支付的實際應援卡。`,
    };
    return;
  }
  if (rule.costHoloPower) {
    assert(player.holoPower.length >= rule.costHoloPower, `使用「${card.name}」需要 ${rule.costHoloPower} Holo Power。`);
    for (let index = 0; index < rule.costHoloPower; index += 1) player.archive.push(player.holoPower.pop());
    appendLog(state, `${player.name} 由最新一張開始支付 ${rule.costHoloPower} Holo Power。`);
  }
  commitSupport(state, playerIndex, cardInstance, card);
  queueDeckSearch(state, playerIndex, rule, map, random, card.name);
}

function playSimpleSupport(state, playerIndex, cardInstance, card, effect, map, random) {
  const player = state.players[playerIndex];
  if (effect === "drawThree") {
    commitSupport(state, playerIndex, cardInstance, card);
    const drawn = drawCards(state, playerIndex, 3);
    appendLog(state, `${player.name} 因「${card.name}」抽 ${drawn} 張牌。`);
  } else if (effect === "resetHandFive") {
    assert(player.hand.length - 1 >= 1, `除「${card.name}」外最少要有 1 張手牌。`);
    commitSupport(state, playerIndex, cardInstance, card);
    const returned = player.hand.splice(0);
    player.mainDeck = shuffle([...player.mainDeck, ...returned], random);
    const drawn = drawCards(state, playerIndex, 5);
    appendLog(state, `${player.name} 將 ${returned.length} 張手牌洗回牌庫，再抽 ${drawn} 張牌。`);
  } else if (effect === "cheerStick") {
    assert(player.holoPower.length >= 1, `使用「${card.name}」需要 1 Holo Power。`);
    player.archive.push(player.holoPower.pop());
    commitSupport(state, playerIndex, cardInstance, card);
    const stageColors = new Set(stageEntries(player).flatMap(({ unit: stageUnit }) => unitCard(stageUnit, map)?.colors || []));
    const candidates = player.cheerDeck.filter((instance) => (map.get(instance.number)?.colors || []).some((color) => stageColors.has(color)));
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, prompt: "應援棒：可公開 1 張與自己 Holomen 同色的應援；下一步直接按牌桌目標。", effect: "cheerStickCheer", source: "cheerDeck", optional: true });
    else player.cheerDeck = shuffle(player.cheerDeck, random);
  } else if (effect === "swapOwnCenter") {
    commitSupport(state, playerIndex, cardInstance, card);
    const options = BACK_SLOTS.filter((zone) => player.zones[zone] && !player.zones[zone].rested);
    if (player.zones.center && options.length > 0 && matchingPlayerModifierBonus(player, "movementLock", player.zones.center, "center", map, state.turn) === 0) state.pendingChoice = { type: "swapOwnCenter", playerIndex, options, prompt: "直接按一位活動中的後排 Holomen，與中央 Holomen 互換。" };
    else appendLog(state, `${player.name} 沒有合法的中央互換；支援卡效果結算完成。`);
  } else if (effect === "archiveCheerReturn") {
    commitSupport(state, playerIndex, cardInstance, card);
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(3, candidates.length), prompt: "安可：按次序揀 1–3 張存檔區應援放回應援牌庫，然後洗牌。", effect: "archiveCheerToDeck", source: "archive" });
    else player.cheerDeck = shuffle(player.cheerDeck, random);
  } else if (effect === "moveStageCheer") {
    commitSupport(state, playerIndex, cardInstance, card);
    const occupied = stageEntries(player).map(({ zone }) => zone);
    const cheerOptions = stageEntries(player).flatMap(({ zone, unit: stageUnit }) => occupied.some((target) => target !== zone) ? stageUnit.cheer.map((cheer) => ({ id: cheer.id, number: cheer.number, zone })) : []);
    if (cheerOptions.length > 0) state.pendingChoice = { type: "moveStageCheerSource", playerIndex, options: cheerOptions.map((option) => option.id), cheerOptions, prompt: "呼喊與回應：先按舞台上要移動的實際應援卡。" };
    else appendLog(state, `${player.name} 沒有可改附到另一位 Holomen 的舞台應援。`);
  }
}

function playAutomatedEvent(state, playerIndex, cardInstance, card, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  if (card.number === "hBP03-088") {
    assert(player.life.length < opponent.life.length, "自己的生命必須少於對手，才可使用「等待來電」。");
  }
  if (card.number === "hBP06-093") {
    const ownStage = stageEntries(player);
    assert(ownStage.length > 0 && ownStage.every(({ unit: stageUnit }) => cardHasTag(map.get(topCard(stageUnit)?.number), "#秘密結社holoX")), "自己舞台上所有 Holomen 都必須持有 #秘密結社holoX。 ");
  }

  commitSupport(state, playerIndex, cardInstance, card);
  if (card.number === "hEB01-030") {
    const drawn = drawCards(state, playerIndex, 2);
    appendLog(state, `${player.name} 因「Hololive Summer」抽 ${drawn} 張牌。`);
    if (stageHasTag(player, "#サマー", map).length >= 3 && player.mainDeck.length > 0) {
      const revealed = player.mainDeck.splice(0, 2);
      enqueueCardSelection(state, { playerIndex, cards: revealed, min: 1, max: 1, prompt: "Hololive Summer：揀 1 張加入手牌；其餘放到存檔區。", effect: "summerPick", source: "revealed" });
    }
  } else if (card.number === "hBP03-088") {
    if (!opponent.zones.collab && BACK_SLOTS.some((zone) => opponent.zones[zone])) {
      enqueueEffect(state, { type: "forcedCollab", playerIndex: opponentIndex, prompt: "「等待來電」：直接按自己一位後排 Holomen，移到合作位置。" });
    } else appendLog(state, `${opponent.name} 的合作位置已有 Holomen 或沒有後排 Holomen，因此「等待來電」不會移動卡片。`);
  } else if (card.number === "hBP06-090") {
    const drawn = drawCards(state, playerIndex, 2);
    appendLog(state, `${player.name} 因「綻放舞台」抽 ${drawn} 張牌。`);
    if (player.life.length <= 4) {
      player.bonusBloomTurn = state.turn;
      player.bonusBloomUsedTurn = 0;
      player.bonusBloomTargetId = "";
      const candidates = player.hand.filter((instance) => {
        const holomem = map.get(instance.number);
        return holomem?.group === "holomem" && ["1st", "2nd"].includes(holomem.stage) && bloomTargets(player, holomem, map, state.turn).length > 0;
      });
      if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, prompt: "綻放舞台：可揀手牌中 1 張 1st／2nd Holomen，再直接按牌桌完成額外 Bloom。", effect: "bonusBloomCard", source: "hand", optional: true });
      else {
        player.bonusBloomUsedTurn = state.turn;
        appendLog(state, `${player.name} 沒有可讓本回合由 Debut Bloom 而成的 1st 再 Bloom 的手牌。`);
      }
    } else appendLog(state, `${player.name} 的生命多於 4，不能使用「綻放舞台」的額外 Bloom。`);
  } else if (card.number === "hBP05-080") {
    const drawn = drawCards(state, playerIndex, 2);
    const revealed = player.mainDeck.splice(0, 5);
    const selectableIds = revealed.filter((instance) => map.get(instance.number)?.stage === "1st").map((instance) => instance.id);
    appendLog(state, `${player.name} 因「SorAZ慶典」抽 ${drawn} 張，並查看牌庫上方 ${revealed.length} 張。`);
    if (selectableIds.length > 0) {
      enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 1, max: 1, prompt: "SorAZ慶典：選擇 1 張 1st Holomen 加入手牌。", effect: "sorazPick", source: "revealed", optional: false });
    } else if (revealed.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, min: revealed.length, max: revealed.length, prompt: "沒有 1st Holomen：按次序選擇；第 1 張會最先放到牌庫底。", effect: "bottomOrder", source: "revealed" });
  } else if (card.number === "hBP06-089") {
    const artTargets = stageHasTag(player, "#絵", map);
    if (artTargets.length > 0 && player.cheerDeck.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.cheerDeck, min: 1, max: 1, prompt: "繪畫直播：從應援牌庫揀 1 張應援公開；下一步直接按 #絵 Holomen。", effect: "drawingStreamCheer", source: "cheerDeck", optional: false });
    else {
      player.cheerDeck = shuffle(player.cheerDeck, random);
      appendLog(state, `${player.name} 沒有 #絵 Holomen 或應援牌庫已空，略過送應援並洗牌。`);
      queueDrawingStreamArchive(state, playerIndex, map);
    }
  } else if (card.number === "hBP06-093") {
    const candidates = player.mainDeck.filter((instance) => cardHasTag(map.get(instance.number), "#秘密結社holoX") && map.get(instance.number)?.group === "holomem");
    if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: Math.min(2, candidates.length), max: Math.min(2, candidates.length), prompt: "山田琉依54世：公開 2 張 #秘密結社holoX Holomen 加入手牌。", effect: "holoXSearch", source: "deck", optional: false, meta: { opponentIndex } });
    else {
      player.mainDeck = shuffle(player.mainDeck, random);
      if (totalCheer(player) < totalCheer(opponent) && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: true, prompt: "自己的應援較少：可以按一位 Holomen，從應援牌庫附加 1 張應援。" });
    }
  }
}

function playExtendedSupport(state, playerIndex, cardInstance, card, effect, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const ownOshi = map.get(player.oshi?.number);

  if (effect === "swapOpponentCenter") {
    assert(opponent.zones.center && BACK_SLOTS.some((zone) => opponent.zones[zone]), "對手沒有可與中央互換的後排 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "swapCenter", prompt: "直接按對手一位後排 Holomen，與其中央 Holomen 互換。" });
  } else if (effect === "bluntWeapon") {
    commitSupport(state, playerIndex, cardInstance, card);
    const isMumei = cardHasName(ownOshi, "七詩ムメイ") || cardHasName(ownOshi, "Nanashi Mumei");
    if (isMumei && !player.namedUsageTurns.bluntWeaponGame) {
      enqueueOptionChoice(state, { playerIndex, effect: "bluntWeaponMode", options: [{ id: "die", label: "擲骰：3 或以下存檔 1 張" }, { id: "mumei", label: "每場 1 次：中央存檔 2 張" }], prompt: "用鈍器揍你！：選擇通常骰子效果，或七詩ムメイ的每場 1 次變更效果。" });
    } else {
      const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
      if (die <= 3) enqueueStageCheerSelection(state, { playerIndex, ownerIndex: opponentIndex, max: 1, effect: "archiveSelectedStageCheer", prompt: "骰子成功：直接按對手 Holomen 身上 1 張實際應援放到存檔區。" });
    }
  } else if (effect === "mischiefDamage") {
    commitSupport(state, playerIndex, cardInstance, card);
    const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
    if (die >= 4) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", prompt: "骰子成功：直接按對手一位後排 Holomen，造成 20 點特殊傷害（倒下不減生命）。", meta: { amount: 20, loseLife: false } });
  } else if (effect === "customComputer") {
    const candidates = player.hand.filter((instance) => instance.id !== cardInstance.id && map.get(instance.number)?.stage === "Debut");
    assert(candidates.length > 0, "手牌沒有可公開並放到牌庫底的 Debut Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, effect: "customComputerDebut", source: "hand", prompt: "客製化電腦：揀 1 張手牌 Debut 公開並放到牌庫底。" });
  } else if (effect === "retroComputer") {
    assert(player.life.length <= 3, "生命必須為 3 或以下。 ");
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem");
    assert(candidates.length > 0, "存檔區沒有 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, effect: "archiveToHand", source: "archive", prompt: "復古電腦：揀 1 張存檔區 Holomen 返回手牌。" });
  } else if (effect === "explosionMagic") {
    assert(!usedNamedThisTurn(player, "magicEvent", state.turn), "本回合已使用過持有 #魔法 的事件卡。 ");
    commitSupport(state, playerIndex, cardInstance, card); markNamedUsage(player, "magicEvent", state.turn);
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "直接按對手中央或合作 Holomen，造成 20 點特殊傷害（倒下不減生命）。", meta: { amount: 20, loseLife: false } });
  } else if (effect === "magicWardrobe") {
    assert(!usedNamedThisTurn(player, "magicEvent", state.turn), "本回合已使用過持有 #魔法 的事件卡。 ");
    assert(player.holoPower.length >= 1, "需要 1 Holo Power。 ");
    const purpleCheer = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("紫"));
    const targets = stageOptionsMatching(player, map, { names: ["紫咲シオン"] });
    assert(purpleCheer.length > 0 && targets.length > 0, "存檔區沒有紫色應援，或舞台沒有紫咲シオン。 ");
    player.archive.push(player.holoPower.pop());
    commitSupport(state, playerIndex, cardInstance, card); markNamedUsage(player, "magicEvent", state.turn);
    enqueueCardSelection(state, { playerIndex, cards: purpleCheer, min: 1, max: 1, effect: "archiveCheerToStage", source: "archive", prompt: "魔法衣櫃：揀 1 張紫色應援；下一步直接按紫咲シオン。", meta: { targetRule: { names: ["紫咲シオン"] } } });
  } else if (effect === "mikkorone24") {
    commitSupport(state, playerIndex, cardInstance, card);
    const drawn = drawCards(state, playerIndex, 2);
    const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
    appendLog(state, `${player.name} 先抽 ${drawn} 張牌。`);
    if ([3, 5, 6].includes(die)) queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["Debut"] }, map, random, { min: 1, max: 1, label: "Mikkorone 24", optional: true });
    else if ([2, 4].includes(die)) appendLog(state, `${player.name} 再抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  } else if (effect === "dualMonitorComputer") {
    commitSupport(state, playerIndex, cardInstance, card);
    queueDeckCardsToStage(state, playerIndex, { unlimitedDebut: true }, map, random, { min: 1, max: 2, optional: false, label: "雙螢幕電腦" });
  } else if (effect === "twoColorComputer") {
    const options = stageOptionsMatching(player, map, { monoColor: true });
    const colors = new Set(options.map((zone) => unitCard(player.zones[zone], map)?.colors?.[0]));
    assert(colors.size >= 2, "舞台上需要最少 2 位各自只有單一且不同顏色的 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options, effect: "twoColorFirst", prompt: "雙色電腦：先按第 1 位單色 Holomen。" });
  } else if (effect === "limitMeal") {
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過「極限飯」。 ");
    const targets = stageOptionsMatching(player, map, { names: ["一条莉々華"] });
    assert(targets.length > 0, "舞台沒有一条莉々華。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "addModifier", prompt: "直接按一位一条莉々華；其 1 個 Arts 本回合無色費用 -1。", meta: { kind: "artCost", amount: -1, uses: 1 } });
  } else if (effect === "maitakeDance") {
    const targets = stageOptionsMatching(player, map, { names: ["儒烏風亭らでん"] });
    assert(targets.length > 0, "舞台沒有儒烏風亭らでん。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "maitakeTarget", prompt: "先按一位儒烏風亭らでん；之後可直接按舞台上的實際應援改附。" });
  } else if (effect === "friendlyComputer") {
    commitSupport(state, playerIndex, cardInstance, card);
    queueDeckCardsToStage(state, playerIndex, { unlimitedDebut: true }, map, random, { min: 1, max: 2, optional: false, label: "友善電腦", afterEffect: "friendlyComputerAfter" });
  } else if (effect === "gyudon") {
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, effect: "healAndModifier", prompt: "直接按自己一位 Holomen：本回合接力所需應援 -2，並回復 20 HP。", meta: { kind: "batonCost", amount: -2, heal: 20 } });
  } else if (effect === "chocoStroganoff") {
    const chocoTargets = stageOptionsMatching(player, map, { names: ["癒月ちょこ"], stages: ["2nd"] });
    assert(stageUnitCount(player) > 0 && chocoTargets.length > 0, "舞台需要最少 1 位 Holomen 及 1 位癒月ちょこ。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: "先按第 1 位 Holomen，本回合 Arts +10。", meta: { kind: "arts", amount: 10, after: { type: "stageTarget", rule: { names: ["癒月ちょこ"], stages: ["2nd"] }, effect: "addModifier", prompt: "再按 1 位 2nd 癒月ちょこ，本回合 Arts +10。", meta: { kind: "arts", amount: 10 } } } });
  } else if (effect === "shyStream") {
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    if (wasKnockedOutDuringPreviousOpponentTurn(state, playerIndex) && player.life.length < opponent.life.length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, prompt: "條件成立：揀 1 張存檔區應援；下一步直接按 Holomen。" }, map);
  } else if (effect === "favoriteComputer") {
    commitSupport(state, playerIndex, cardInstance, card);
    const debuts = player.mainDeck.filter((instance) => map.get(instance.number)?.stage === "Debut");
    assert(debuts.length > 0, "牌庫沒有 Debut Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: debuts, min: 1, max: 1, effect: "favoriteComputerDebut", source: "deck", prompt: "最愛電腦：先公開 1 張 Debut；系統會再找同名 Buzz 與 #Buzzグッズ 支援。" });
  } else if (effect === "madeWithLove") {
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    enqueueStageTarget(state, { playerIndex, effect: "heal", prompt: "直接按自己一位受傷 Holomen，回復最多 100 HP。", rule: { damaged: true }, meta: { amount: 100 } });
  } else if (effect === "realMushroomDance") {
    assert(cardHasName(ownOshi, "儒烏風亭らでん"), "推し Holomen 必須是儒烏風亭らでん。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    if (player.cheerDeck.length > 0) {
      player.archive.push(player.cheerDeck.shift());
      triggerCheerArchivedGift(state, playerIndex, map, 1);
    }
    queueArchiveToHand(state, playerIndex, { group: "holomem", names: ["儒烏風亭らでん"] }, map, { min: 1, max: 1, optional: false, label: "真姬菇之舞" });
  } else if (effect === "surpriseRabbit") {
    assert(wasKnockedOutDuringPreviousOpponentTurn(state, playerIndex) && player.life.length < opponent.life.length, "上一個對手回合須有自己的 Holomen 倒下，且自己生命少於對手。 ");
    assert(BACK_SLOTS.some((zone) => !opponent.zones[zone]), "對手後排沒有空位。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "restMoveBack", prompt: "直接按對手中央或合作 Holomen；系統會移到後排、休息，並略過下次重置。" });
  } else if (effect === "chuchuMayonnaise") {
    const targets = stageOptionsMatching(player, map, { names: ["博衣こより"] });
    assert(targets.length > 0, "舞台沒有博衣こより。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "addModifier", prompt: "直接按一位博衣こより，本回合 Arts +30。", meta: { kind: "arts", amount: 30 } });
  } else if (effect === "fitnessTraining") {
    assert(Boolean(player.zones.collab) || !opponent.zones.collab, "自己須有合作 Holomen，或對手沒有合作 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, effect: "fitnessModifier", prompt: "直接按自己一位 Holomen：一般 +20；Buzz 或 2nd 改為 +50。" });
  } else if (effect === "area15Identity") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#ID1期生")), "自己舞台上所有 Holomen 都必須持有 #ID1期生。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    if (player.cheerDeck.length === 0) addPlayerModifier(player, "extraLifeOnCenterKO", 1, state.turn, card.number, { tags: ["#ID1期生"] });
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ID1期生"] }, map, random, { min: 2, max: 2, optional: false, label: "身分識別－第15區－" });
  } else if (effect === "lambduck") {
    const watame = stageOptionsMatching(player, map, { names: ["角巻わため", "角卷わため"] });
    const subaru = stageOptionsMatching(player, map, { names: ["大空スバル", "大空昴"] });
    assert(watame.length > 0 && subaru.length > 0, "舞台需要角巻わため與大空スバル各 1 位。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: watame, effect: "lambduckFirst", prompt: "先按角巻わため；之後再按大空スバル。" });
  } else {
    playExtendedSupportPartTwo(state, playerIndex, cardInstance, card, effect, map, random);
  }
}

function playExtendedSupportPartTwo(state, playerIndex, cardInstance, card, effect, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const ownOshi = map.get(player.oshi?.number);

  if (effect === "fieldStaff") {
    const stageCheer = stageCheerOptions(player, map);
    const fans = player.archive.filter((instance) => map.get(instance.number)?.typeCode === "supportFan");
    assert(stageCheer.length > 0 && fans.length > 0, "需要支付舞台 1 張應援，且存檔區要有可附加的粉絲。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageCheerSelection(state, { playerIndex, options: stageCheer, effect: "fieldStaffCost", prompt: "現場工作人員：直接按舞台上 1 張實際應援支付成本。" });
  } else if (effect === "archiveComputer") {
    const holomem = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem");
    assert(holomem.length > 0, "存檔區沒有 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueCardSelection(state, { playerIndex, cards: holomem, min: 1, max: Math.min(3, holomem.length), effect: "archiveHolomemToDeckDraw", source: "archive", prompt: "檔案電腦：揀 1–3 張 Holomen 放回牌庫並洗牌，然後抽 2 張。" });
  } else if (effect === "umamy") {
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過「好吃～！」。 ");
    const targets = stageOptionsMatching(player, map, { zones: ["collab"], names: ["ベスティア・ゼータ", "Vestia Zeta"] });
    assert(targets.length > 0, "合作位置沒有 Vestia Zeta。 ");
    const committed = commitNamedSupport(state, playerIndex, cardInstance, card);
    addStageModifier(player.zones.collab, "arts", 40, state.turn, card.number);
    const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
    if (die !== 6) {
      const moved = removeById(player.archive, committed.id);
      if (moved) { player.mainDeck.push(moved); player.mainDeck = shuffle(player.mainDeck, random); }
      appendLog(state, `${player.name} 的骰子不是 6，「${card.name}」已洗回牌庫。`);
    }
  } else if (effect === "badRobot") {
    commitSupport(state, playerIndex, cardInstance, card);
    const indexes = player.life.length <= 3 ? [0, 1] : [playerIndex];
    indexes.forEach((index) => {
      const target = state.players[index];
      const returned = target.hand.splice(0);
      target.mainDeck = shuffle([...target.mainDeck, ...returned], random);
      const drawn = drawCards(state, index, 4);
      appendLog(state, `${target.name} 將 ${returned.length} 張手牌洗回牌庫，再抽 ${drawn} 張。`);
    });
  } else if (effect === "crossImpact") {
    assert(unitCard(player.zones.center, map)?.stage === "2nd" && unitCard(opponent.zones.center, map)?.stage === "2nd", "雙方中央 Holomen 都必須是 2nd。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const ownRoll = rollDie(random, state, playerIndex); const opponentRoll = rollDie(random, state, opponentIndex);
    appendLog(state, `${player.name} 擲出 ${ownRoll}；${opponent.name} 擲出 ${opponentRoll}。`);
    if (ownRoll >= opponentRoll) addStageModifier(player.zones.center, "arts", 100, state.turn, card.number);
    else enqueueEffect(state, { type: "eventCheerTarget", playerIndex, prompt: "交叉衝擊：直接按自己一位 Holomen，附加應援牌庫頂 1 張應援。" });
  } else if (effect === "haachamaTrip") {
    const targets = stageOptionsMatching(player, map, { zones: BACK_SLOTS, names: ["赤井はあと", "赤井心"] });
    assert(targets.length > 0, "後排沒有赤井はあと。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    addPlayerModifier(player, "artCost", -1, state.turn, card.number, { names: ["赤井はあと", "赤井心"] });
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "stackToBottom", prompt: "直接按後排一位赤井はあと；其所有重疊 Holomen 會按次序放到牌庫底。" });
  } else if (effect === "promiseTimeRuler") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#Promise")), "自己舞台上所有 Holomen 都必須持有 #Promise。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const afterEffect = player.life.length < opponent.life.length ? "promiseTimeBuff" : "";
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#Promise"] }, map, random, { min: 2, max: 2, optional: false, label: "時間支配者－Promise－", meta: { afterEffect } });
  } else if (effect === "mioFortune") {
    assert(cardHasName(ownOshi, "大神ミオ") || cardHasName(ownOshi, "大神澪"), "推し Holomen 必須是大神ミオ。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const revealed = player.mainDeck.splice(0, 3);
    const supportCount = revealed.filter((instance) => map.get(instance.number)?.group === "support").length;
    if (supportCount > 0) addPlayerModifier(player, "arts", supportCount * 20, state.turn, card.number, {});
    enqueueCardSelection(state, { playerIndex, cards: revealed, min: revealed.length, max: revealed.length, effect: "topOrder", source: "revealed", prompt: `大神澪的占卜：公開了 ${supportCount} 張支援；按次序放回牌庫頂（第 1 張成為最頂）。` });
  } else if (effect === "puhihi") {
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    if (wasKnockedOutDuringPreviousOpponentTurn(state, playerIndex)) {
      enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: "上一個對手回合有 Holomen 倒下：直接按自己 1 位 Holomen，本回合 Arts +20。", meta: { kind: "arts", amount: 20 } });
      if (wasKnockedOutDuringPreviousOpponentTurn(state, playerIndex, "ラプラス・ダークネス")) appendLog(state, `${player.name} 再抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    }
  } else if (effect === "frontierSpirit") {
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過「開拓精神」。 ");
    const azki = player.archive.filter((instance) => cardHasName(map.get(instance.number), "AZKi") && map.get(instance.number)?.group === "holomem");
    assert(azki.length > 0, "存檔區沒有 AZKi。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    const copies = player.archive.filter((instance) => instance.number === card.number).length;
    enqueueCardSelection(state, { playerIndex, cards: azki, min: 1, max: 1, effect: "frontierReturn", source: "archive", prompt: "開拓精神：揀 1 張 AZKi 返回手牌。", meta: { copies } });
  } else if (effect === "elegantComputer") {
    const candidates = player.archive.filter((instance) => ["supportMascot", "supportFan"].includes(map.get(instance.number)?.typeCode));
    assert(candidates.length > 0, "存檔區沒有吉祥物或粉絲。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(3, candidates.length), effect: "archiveSupportToDeckDraw", source: "archive", prompt: "優雅電腦：揀 1–3 張吉祥物／粉絲放回牌庫並洗牌，然後抽 2 張。" });
  } else if (effect === "creatorComputer") {
    commitSupport(state, playerIndex, cardInstance, card);
    queueDeckCardsToStage(state, playerIndex, { unlimitedDebut: true }, map, random, { min: 1, max: 1, optional: false, label: "創作者電腦", afterEffect: "creatorArchiveDebut" });
  } else if (effect === "donutMemory") {
    commitSupport(state, playerIndex, cardInstance, card);
    const fuwawa = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "フワワ・アビスガード"));
    assert(fuwawa.length > 0, "牌庫沒有フワワ・アビスガード。 ");
    enqueueCardSelection(state, { playerIndex, cards: fuwawa, min: 1, max: 1, effect: "donutFuwawa", source: "deck", prompt: "回憶中的甜甜圈店：先公開 1 張フワワ・アビスガード。", meta: { damageAfter: player.life.length < opponent.life.length } });
  } else if (effect === "chocoEggplant") {
    assert(player.life.length <= 3 && allStageCardsMatch(player, map, (holomem) => cardHasName(holomem, "癒月ちょこ")), "生命須為 3 或以下，且自己舞台所有 Holomen 都是癒月ちょこ。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    addPlayerModifier(player, "arts", 20, state.turn, card.number, { stages: ["Debut", "1st"] });
    addPlayerModifier(player, "arts", 60, state.turn, card.number, { stages: ["2nd"] });
  } else if (effect === "dadIsQuitting") {
    assert(player.zones.collab && player.zones.center, "自己必須有中央及合作 Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    addStageModifier(player.zones.center, "artsDamageReduction", 300, state.turn + 1, card.number, { uses: 1, opponentTurnOnly: true });
    appendLog(state, `${player.name} 的中央 Holomen 在下個對手回合首次受到 Arts 傷害時 -300。`);
  } else if (effect === "destructionSpell") {
    assert(player.life.length <= 3 && allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#EN")), "生命須為 3 或以下，且自己舞台所有 Holomen 都持有 #EN。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const targets = [0, 1].flatMap((ownerIndex) => ["center", "collab"].filter((zone) => state.players[ownerIndex].zones[zone]).map((zone) => ({ ownerIndex, zone })));
    targets.forEach(({ ownerIndex, zone }) => enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: ownerIndex, targetZone: zone, amount: 50, loseLife: false, sourceName: card.name }));
  } else if (effect === "gentleMonster") {
    assert(cardHasName(ownOshi, "一条莉々華") || cardHasName(ownOshi, "一條莉々華"), "推し Holomen 必須是一条莉々華。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const ririka = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "一条莉々華"));
    assert(ririka.length > 0, "牌庫沒有一条莉々華。 ");
    enqueueCardSelection(state, { playerIndex, cards: ririka, min: 1, max: 1, effect: "gentleMonsterRirika", source: "deck", prompt: "溫柔的怪物：先公開 1 張一条莉々華。" });
  } else if (effect === "richChocolaHamburg") {
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, effect: "richChocolaTarget", prompt: "直接按自己 1 位 Holomen，回復 20 HP；若條件成立再附加存檔區應援。" });
  } else if (effect === "hololiveMythology") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#Myth")), "自己舞台上所有 Holomen 都必須持有 #Myth。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    const revealed = player.mainDeck.splice(0, 4);
    enqueueCardSelection(state, { playerIndex, cards: revealed, min: Math.min(2, revealed.length), max: Math.min(2, revealed.length), effect: "mythologyPick", source: "revealed", prompt: "hololive Mythology：從公開卡中揀 2 張加入手牌；其餘放到存檔區。" });
  } else if (effect === "holotori") {
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過 HOLOTORI。 ");
    const stageOption = stageCheerOptions(player, map, { stage: { tags: ["#トリ"] } });
    const archiveCheer = stageOptionsMatching(player, map, { tags: ["#トリ"] }).length > 0 && player.archive.some((instance) => map.get(instance.number)?.group === "cheer");
    assert(stageOption.length > 0 || archiveCheer, "沒有可支付的 #トリ 舞台應援或可附加的存檔區應援。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueOptionChoice(state, { playerIndex, effect: "holotoriMode", options: [{ id: "draw", label: "存檔 #トリ 身上 1 張應援，抽 2 後放 1 張手牌到牌庫底", disabled: stageOption.length === 0 }, { id: "attach", label: "將存檔區 1 張應援附加到 #トリ", disabled: !archiveCheer }], prompt: "HOLOTORI：選擇 1 項能力。" });
  } else if (effect === "weAreRegloss") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#ReGLOSS")), "自己舞台上所有 Holomen 都必須持有 #ReGLOSS。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ReGLOSS"] }, map, random, { min: 2, max: 2, optional: false, label: "我們是 ReGLOSS", meta: { afterEffect: stageUnitCount(player) < stageUnitCount(opponent) ? "reglossDrawDiscard" : "" } });
  } else {
    playExtendedSupportPartThree(state, playerIndex, cardInstance, card, effect, map, random);
  }
}

function playExtendedSupportPartThree(state, playerIndex, cardInstance, card, effect, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const ownOshi = map.get(player.oshi?.number);

  if (effect === "summerComputer") {
    commitSupport(state, playerIndex, cardInstance, card);
    if (player.life.length >= 2) queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], tags: ["#サマー"] }, map, random, { min: 1, max: 1, optional: false, label: "夏日電腦" });
    else queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#サマー"] }, map, random, { min: 1, max: 1, optional: false, label: "夏日電腦" });
  } else if (effect === "kumarine") {
    assert(cardHasName(ownOshi, "宝鐘マリン"), "推し Holomen 必須是宝鐘マリン。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    const marineIds = player.hand.filter((instance) => cardHasName(map.get(instance.number), "宝鐘マリン")).map((instance) => instance.id);
    if (marineIds.length > 0) enqueueHandToDestination(state, playerIndex, { min: 0, max: 1, optional: true, selectableIds: marineIds, effect: "kumarineBottom", prompt: "熊琳：可公開 1 張手牌宝鐘マリン放到牌庫底；若放回便再抽 2 張。" });
  } else if (effect === "summerLive") {
    commitSupport(state, playerIndex, cardInstance, card);
    addPlayerModifier(player, "arts", 30, state.turn, card.number, { tags: ["#サマー"] });
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, prompt: "夏日演唱會：揀 1 張存檔區應援；下一步直接按自己 Holomen。" }, map);
  } else if (effect === "watermelonSmash") {
    const targets = stageOptionsMatching(player, map, { stages: ["2nd"] });
    assert(targets.length > 0, "舞台沒有 2nd Holomen。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "watermelonTarget", prompt: "直接按自己 1 位 2nd Holomen：本回合 Arts +30，Arts 擊倒時抽 2。" });
  } else if (effect === "splashShoot") {
    assert(cardHasTag(unitCard(player.zones.center, map), "#サマー") && cardHasTag(unitCard(player.zones.collab, map), "#サマー"), "自己的中央及合作 Holomen 都必須持有 #サマー。 ");
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過「水花射擊」。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "直接按對手中央或合作 Holomen，造成 30 點特殊傷害。", meta: { amount: 30, loseLife: true } });
  } else if (effect === "waterPlay") {
    commitSupport(state, playerIndex, cardInstance, card);
    assert(enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { tags: ["#サマー"] }, prompt: "戲水：揀 1 張存檔區應援；下一步直接按 #サマー Holomen。" }, map), "存檔區沒有應援。 ");
  } else if (effect === "starStarT") {
    const isSora = cardHasName(ownOshi, "ときのそら");
    if (playerIndex === state.firstPlayer && Number(player.turnsTaken || 0) === 1) assert(isSora, "先攻第 1 回合只有推し Holomen 為ときのそら才可使用。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
    enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToBottom", prompt: "STAR STAR☆T：揀 1 張手牌放到牌庫底。" });
  } else if (effect === "holoFanCircle") {
    commitSupport(state, playerIndex, cardInstance, card);
    const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
    if (die >= 3) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, prompt: "骰子成功：揀 1 張存檔區應援；下一步直接按自己 Holomen。" }, map);
  } else if (effect === "chocoOmelette") {
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, effect: "chocoOmeletteTarget", prompt: "直接按自己 1 位 Holomen，回復 20 HP；若舞台有 #料理，該 Holomen 本回合 Arts +20。" });
  } else if (effect === "keepGrowing") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#FLOW GLOW")), "自己舞台上所有 Holomen 都必須持有 #FLOW GLOW。 ");
    const cheer = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    assert(cheer.length >= 3 && player.zones.center && player.zones.collab, "存檔區需要 3 張應援，且中央及合作位置都要有 Holomen，才能每位最多分配 2 張。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueCardSelection(state, { playerIndex, cards: cheer, min: 3, max: 3, effect: "keepGrowingCheer", source: "archive", prompt: "選擇 3 張存檔區應援；之後逐張直接按中央／合作 Holomen（每位最多 2 張）。" });
  } else if (effect === "successfulEscape") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#Advent")), "自己舞台上所有 Holomen 都必須持有 #Advent。 ");
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過「成功越獄的共犯者們」。 ");
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    assert(player.archive.some((instance) => map.get(instance.number)?.group === "cheer"), "存檔區沒有應援。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: 20, loseLife: true, sourceName: card.name });
    assert(enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max: 1, optional: false, prompt: "成功越獄：揀 1 張存檔區應援；下一步直接按自己 Holomen。" }, map), "存檔區沒有應援。 ");
  } else if (effect === "justiceIsThis") {
    assert(allStageCardsMatch(player, map, (holomem) => cardHasTag(holomem, "#Justice")), "自己舞台上所有 Holomen 都必須持有 #Justice。 ");
    const targets = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.stack.slice(0, -1).some(instance => map.get(instance.number)?.group === "holomem")).map(({ zone }) => zone);
    assert(targets.length > 0, "舞台沒有含重疊 Holomen 的目標。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "justiceTarget", prompt: "直接按自己 1 位有重疊卡的 Holomen；下一步揀 1–2 張下方 Holomen 返回手牌。" });
  } else if (effect === "holoAN") {
    commitSupport(state, playerIndex, cardInstance, card);
    appendLog(state, `${player.name} 因「holoAN」抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
  } else if (effect === "matsutakeDance") {
    const targets = stageOptionsMatching(player, map, { names: ["儒烏風亭らでん"] });
    assert(targets.length > 0, "舞台沒有儒烏風亭らでん。 ");
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "matsutakeTarget", prompt: "直接按一位儒烏風亭らでん：附有 3 張以上應援則 +20，否則 +10。" });
  } else if (effect === "stella") {
    assert(!usedNamedThisTurn(player, card.number, state.turn), "本回合已使用過 Stella。 ");
    const targets = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS, excludeStages: ["Debut"] });
    assert(targets.length > 0, "對手後排沒有非 Debut Holomen。 ");
    commitNamedSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options: targets, effect: "specialDamage", prompt: "直接按對手 1 位非 Debut 後排 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true } });
  } else if (effect === "happyCurry") {
    commitSupport(state, playerIndex, cardInstance, card);
    enqueueStageTarget(state, { playerIndex, rule: { damaged: true }, effect: "heal", optional: false, prompt: "開心咖哩：直接按自己 1 位受傷 Holomen，回復 30 HP。", meta: { amount: 30 } });
  } else {
    throw new Error(`「${card.name}」的共用效果描述 ${effect} 未能載入。`);
  }
}

function playFromHand(state, playerIndex, action, map, random) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段出牌。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];
  const cardInstance = player.hand.find((card) => card.id === action.cardId);
  assert(cardInstance, "手牌中找不到這張卡。 ");
  const card = map.get(cardInstance.number);
  assert(card, "卡片資料不存在。 ");
  if (card.group === "holomem") {
    queuePlay(state, playerIndex, cardInstance, card, map);
    return;
  }
  assert(card.group === "support", "這張卡不能在主要階段直接使用。 ");
  const limited = String(card.type || "").toUpperCase().includes("LIMITED");
  if (limited) {
    assert(!(playerIndex === state.firstPlayer && Number(player.turnsTaken || 0) === 1), "先攻玩家第 1 回合不可使用 LIMITED 支援卡。 ");
    const allowance = Number(player.limitedAllowanceTurn || 0) === state.turn ? Number(player.limitedAllowance || 2) : 1;
    const used = Number(player.limitedTurn || 0) === state.turn ? Number(player.limitedUsesCount || 1) : 0;
    assert(used < allowance, `本回合最多只可使用 ${allowance} 張 LIMITED 支援卡。 `);
  }
  if (isAttachment(card)) {
    queueAttachment(state, playerIndex, cardInstance, card, map);
    return;
  }
  if (TOP_LOOK_EFFECTS[card.number]) {
    playTopLookSupport(state, playerIndex, cardInstance, card, TOP_LOOK_EFFECTS[card.number], map);
    return;
  }
  if (DECK_SEARCH_EFFECTS[card.number]) {
    playDeckSearchSupport(state, playerIndex, cardInstance, card, DECK_SEARCH_EFFECTS[card.number], map, random);
    return;
  }
  if (SIMPLE_SUPPORT_EFFECTS[card.number]) {
    playSimpleSupport(state, playerIndex, cardInstance, card, SIMPLE_SUPPORT_EFFECTS[card.number], map, random);
    return;
  }
  if (EXTENDED_SUPPORT_EFFECTS[card.number]) {
    playExtendedSupport(state, playerIndex, cardInstance, card, EXTENDED_SUPPORT_EFFECTS[card.number], map, random);
    return;
  }
  if (card.number === ORDINARY_COMPUTER) {
    removeById(player.hand, cardInstance.id);
    player.archive.push(cardInstance);
    const options = [...new Set(player.mainDeck.filter((candidate) => map.get(candidate.number)?.stage === "Debut").map((candidate) => candidate.number))];
    const zones = stageUnitCount(player) < 6 ? emptyBackSlots(player) : [];
    if (options.length === 0 || zones.length === 0) {
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 使用普通電腦，但牌庫或舞台沒有可選目標；牌庫已洗牌。`);
      return;
    }
    state.pendingChoice = { type: "ordinaryComputer", playerIndex, sourceNumber: card.number, options, zones, optional: true, prompt: "普通電腦：可先揀 1 張 Debut，再直接按牌桌上的後排空位；亦可不公開卡片並洗牌。" };
    appendLog(state, `${player.name} 使用普通電腦；正在牌庫選擇 Debut Holomen。`);
    return;
  }
  if (AUTOMATED_EVENT_CARDS.has(card.number)) {
    playAutomatedEvent(state, playerIndex, cardInstance, card, map, random);
    return;
  }
  throw new Error(`「${card.name}」的文字效果尚未接入自動效果核心；為免錯誤裁定，本版本不會代為結算。`);
}

function resolveChoice(state, playerIndex, action, map, random) {
  const pending = state.pendingChoice;
  assert(pending && pending.playerIndex === playerIndex, "目前沒有需要你處理的選擇。 ");
  const player = state.players[playerIndex];
  state.pendingChoice = null;
  if (pending.type === "cardSelection") {
    const skipped = Boolean(action.skip && pending.optional);
    const selectedIds = skipped ? [] : [...new Set(Array.isArray(action.cardIds) ? action.cardIds : [])];
    assert(skipped || (selectedIds.length >= Number(pending.min || 0) && selectedIds.length <= Number(pending.max || 0)), `請選擇 ${pending.min === pending.max ? pending.min : `${pending.min}–${pending.max}`} 張卡。`);
    assert(selectedIds.every((id) => pending.selectableIds.includes(id)), "卡片選擇無效。 ");
    const selected = selectedIds.map((id) => pending.cards.find((card) => card.id === id));
    assert(selected.every(Boolean), "所選卡片已改變。 ");
    const unselected = pending.cards.filter((card) => !selectedIds.includes(card.id));
    if (pending.effect === "topLookToHand") {
      player.hand.push(...selected);
      queueBottomOrder(state, playerIndex, unselected, "查看效果餘下卡片：按次序選擇；第 1 張會最先放到牌庫底。");
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌。` : `${player.name} 沒有從查看的卡片中公開卡片。`, selected);
    } else if (pending.effect === "lastCupArchive") {
      player.archive.push(...selected);
      player.mainDeck.unshift(...unselected);
      appendLog(state, player.name + " 將查看的 1 張卡放到存檔區。", selected);
    } else if (pending.effect === "genericTopLook") {
      player.hand.push(...selected);
      const remainder = pending.meta?.remainder || "bottom";
      if (remainder === "archive") player.archive.push(...unselected);
      else if (unselected.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, min: unselected.length, max: unselected.length, effect: remainder === "top" ? "topOrder" : "bottomOrder", source: "revealed", prompt: `按次序將餘下卡放回牌庫${remainder === "top" ? "頂" : "底"}。` });
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌。` : `${player.name} 沒有從查看的卡片中公開卡片。`, selected);
    } else if (pending.effect === "raoraCheerSearch") {
      const cheer = removeById(player.cheerDeck, selected[0]?.id);
      assert(cheer, "公開的應援已改變。");
      enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, optional: false, shuffleAfter: true, prompt: "正義の諧調：選擇自己1位成員附加公開應援，然後洗牌。" });
    } else if (["genericCheerTopPick", "genericCheerDeckPick"].includes(pending.effect)) {
      let cheer = selected[0] || null;
      if (pending.effect === "genericCheerDeckPick") {
        cheer = cheer ? removeById(player.cheerDeck, cheer.id) : null;
        if (!cheer) player.cheerDeck = shuffle(player.cheerDeck, random);
      }
      if (cheer) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, targetRule: pending.meta?.targetRule || {}, shuffleAfter: pending.effect === "genericCheerDeckPick", afterEffect: pending.meta?.drawAfter ? "genericDraw" : "", drawAfter: pending.meta?.drawAfter || 0, prompt: "直接按牌桌上的合法 Holomen，附加公開的應援。" });
      else if (Number(pending.meta?.drawAfter || 0) > 0) appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, Number(pending.meta.drawAfter))} 張牌。`);
      if (pending.effect === "genericCheerTopPick" && unselected.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, min: unselected.length, max: unselected.length, effect: "cheerBottomOrder", source: "revealed", prompt: "按次序將餘下應援放回應援牌庫底。" });
    } else if (pending.effect === "genericArchiveSupportPick") {
      if (selected.length > 0) enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: selected[0].id, genericTarget: true, targetRule: pending.meta?.targetRule || {}, optional: false, prompt: "直接按牌桌上的合法 Holomen 附加所選存檔區卡片。" });
    } else if (pending.effect === "artArchiveAttachmentsDistribute") {
      selected.forEach((card, index) => enqueueEffect(state, {
        type: "attachArchivedSupport",
        playerIndex,
        cardId: card.id,
        genericTarget: true,
        optional: false,
        prompt: `フブキカフェにようこそ（${index + 1}/${selected.length}）：直接按牌桌上的合法 Holomen，附加「${map.get(card.number)?.name || card.number}」。`,
      }));
    } else if (pending.effect === "artArchiveHolomemShuffleDraw") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的 Holomen 已改變。 ");
        player.mainDeck.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 將 ${selected.length} 張存檔區 Holomen 放回牌庫並洗牌，再抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    } else if (pending.effect === "kiaraReveal") {
      appendLog(state, `${player.name} 公開小鳥遊キアラ。`, selected);
      enqueueOptionChoice(state, { playerIndex, options: [{id:"archive",label:"將公開的卡存檔"},{id:"keep",label:"留在牌庫"}], optional:false, effect:"kiaraArchiveDecision", prompt:"是否將公開的卡全部存檔？", meta:{ids:selected.map(card=>card.id)} });
    } else if (pending.effect === "surgingCheerBottom") {
      player.cheerDeck.push(...selected);
      drawCards(state, playerIndex, Math.max(0, selected.length - player.hand.length));
    } else if (pending.effect === "cheerBottomOrder") {
      player.cheerDeck.push(...selected);
      appendLog(state, `${player.name} 已按選擇次序將 ${selected.length} 張應援放到應援牌庫底。`);
    } else if (pending.effect === "topLookGrouped") {
      player.hand.push(...selected);
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌。` : `${player.name} 略過這一類卡片。`, selected);
      queueTopLookGroup(state, playerIndex, unselected, pending.meta?.remainingGroups || [], map);
    } else if (pending.effect === "archiveCheerToDeck") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的應援已改變。 ");
        player.cheerDeck.push(moved);
      });
      player.cheerDeck = shuffle(player.cheerDeck, random);
      appendLog(state, `${player.name} 將 ${selected.length} 張應援放回應援牌庫並洗牌。`);
    } else if (pending.effect === "archiveCheerToCheerBottom") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的應援已改變。 ");
        player.cheerDeck.push(moved);
      });
      appendLog(state, `${player.name} 已按選擇次序將 ${selected.length} 張應援放回應援牌庫底。`);
    } else if (pending.effect === "cheerStickCheer") {
      if (selected.length > 0) {
        const cheer = removeById(player.cheerDeck, selected[0].id);
        assert(cheer, "應援牌庫中的卡片已改變。 ");
        enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, shuffleAfter: true, prompt: "應援棒：直接按自己牌桌上一位 Holomen 附加所選應援。" });
      } else {
        player.cheerDeck = shuffle(player.cheerDeck, random);
        appendLog(state, `${player.name} 沒有用應援棒公開應援；應援牌庫已洗牌。`);
      }
    } else if (pending.effect === "summerPick") {
      player.hand.push(...selected);
      player.archive.push(...unselected);
      appendLog(state, `${player.name} 將 1 張牌加入手牌，其餘放到存檔區。`);
    } else if (pending.effect === "sorazPick") {
      player.hand.push(...selected);
      if (unselected.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, min: unselected.length, max: unselected.length, prompt: "SorAZ慶典：按次序選擇；第 1 張會最先放到牌庫底。", effect: "bottomOrder", source: "revealed" });
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌。` : `${player.name} 沒有從查看的卡片中公開 1st Holomen。`, selected);
    } else if (pending.effect === "topThreeSearch") {
      player.hand.push(...selected);
      if (unselected.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, min: unselected.length, max: unselected.length, prompt: "Arts 效果：按次序選擇；第 1 張會最先放到牌庫底。", effect: "bottomOrder", source: "revealed" });
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌。` : `${player.name} 沒有從查看的卡片中公開符合條件的牌。`, selected);
    } else if (pending.effect === "bottomOrder") {
      assert(selectedIds.length === pending.cards.length, "請為所有牌決定牌庫底次序。 ");
      player.mainDeck.push(...selected);
      appendLog(state, `${player.name} 已按選擇次序將 ${selected.length} 張牌放到牌庫底。`);
    } else if (["archiveToHand", "returnArchivedToHand"].includes(pending.effect)) {
      selected.forEach((card) => {
        const moved = pending.meta?.fromDefeated ? takeDefeatedCard(player, card.id) : removeById(player.archive, card.id);
        assert(moved, "存檔區的卡片已改變。 ");
        player.hand.push(moved);
      });
      if (selected.length > 0 && pending.meta?.usageKey) markNamedUsage(player, pending.meta.usageKey, state.turn);
      appendLog(state, selected.length ? `${player.name} 從存檔區將 ${selected.length} 張牌返回手牌。` : `${player.name} 略過返回手牌的可選效果。`);
    } else if (pending.effect === "kiaraArchiveReturnSix") {
      for (const card of selected) {
        const moved = removeById(player.archive, card.id);
        assert(moved, "要返回牌庫的 Holomen 已改變。");
        player.mainDeck.push(moved);
      }
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, player.name + " 將 " + selected.length + " 張 Holomen 返回牌庫並洗牌。", selected);
    } else if (pending.effect === "archiveToDeckTop") {
      if (selected.length > 0) {
        const moved = removeById(player.archive, selected[0].id);
        assert(moved, "要放到牌庫頂的存檔區卡片已改變。 ");
        player.mainDeck.unshift(moved);
        appendLog(state, `${player.name} 將 1 張存檔區卡片放到牌庫頂。`);
      }
    } else if (pending.effect === "archiveReturnConditionalDamage") {
      if (selected.length > 0) {
        const moved = removeById(player.archive, selected[0].id);
        assert(moved, "要返回手牌的存檔區 Holomen 已改變。 ");
        player.hand.push(moved);
        appendLog(state, `${player.name} 將 ${map.get(moved.number)?.name || moved.number} 返回手牌。`);
        if (cardHasTag(map.get(moved.number), "#EN") && state.players[pending.meta?.opponentIndex]?.zones.collab) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: pending.meta.opponentIndex, targetZone: "collab", amount: 20, loseLife: true, sourceName: "鼠偶像終於登場！", sourceZone: pending.meta?.sourceZone || "" });
      }
    } else if (pending.effect === "archiveToHandThenStackDamage") {
      if (selected.length > 0) {
        const moved = removeById(player.archive, selected[0].id);
        assert(moved, "要返回手牌的存檔區 Holomen 已改變。 ");
        player.hand.push(moved);
      }
      if (pending.meta?.damageEligible) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: pending.meta?.opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "重疊有 3 張以上：直接按對手中央或合作，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: "宝鐘の海賊団", sourceZone: pending.meta?.sourceZone || "" } });
    } else if (pending.effect === "handArchiveThenNamedReturn") {
      const paidCount = payHandArchive(state, playerIndex, pending, selected, skipped, map);

      const candidates = player.archive.filter((instance) => (pending.meta?.names || []).some((name) => cardHasName(map.get(instance.number), name)));
      const amount = Math.min(paidCount, candidates.length);
      if (amount > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: amount, max: amount, effect: "archiveToHand", source: "archive", prompt: `揀 ${amount} 張指定存檔區卡片返回手牌。` });
    } else if (["powerToHandThenDeckTop", "powerSupportToHandThenDeckTop"].includes(pending.effect)) {
      const moved = selected[0] ? removeById(player.holoPower, selected[0].id) : null;
      if (moved) player.hand.push(moved);
      player.holoPower = shuffle(player.holoPower, random);
      if (moved && player.mainDeck.length > 0) player.holoPower.push(player.mainDeck.shift());
      appendLog(state, moved ? `${player.name} 從 Holo Power 將 1 張牌加入手牌，再將牌庫頂 1 張放入 Holo Power。` : `${player.name} 沒有從 Holo Power 公開卡片；Holo Power 已洗牌。`);
    } else if (pending.effect === "chaosShuffleBottom") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "カオスシャッフル的手牌已改變。 ");
        player.mainDeck.push(moved);
      });
      if (Number(pending.meta?.step || 1) === 1) {
        const otherIndex = Number(pending.meta?.opponentIndex);
        const other = state.players[otherIndex];
        const cards = [...other.hand];
        if (cards.length > 0) enqueueCardSelection(state, { playerIndex: otherIndex, cards, min: cards.length, max: cards.length, effect: "chaosShuffleBottom", source: "hand", prompt: "カオスシャッフル：按次序將自己的全部手牌放到牌庫底。", meta: { ...pending.meta, step: 2 } });
        else (pending.meta?.drawCounts || []).forEach((amount, index) => drawCards(state, index, Number(amount || 0)));
      } else {
        (pending.meta?.drawCounts || []).forEach((amount, index) => drawCards(state, index, Number(amount || 0)));
        appendLog(state, "雙方按原本放回的手牌數量完成抽牌。");
      }
    } else if (pending.effect === "differentNamedDeckToHand") {
      assert(selected.every((c, i) => !selected.slice(0, i).some(other => talentMatches(map.get(c.number), map.get(other.number)))), "請選擇卡名不同的 Debut Holomen。 ");
      selected.forEach((card) => {
        const moved = removeById(player.mainDeck, card.id);
        assert(moved, "卡名不同的 Debut 搜尋結果已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
    } else if (pending.effect === "sameTagHandCost") {
      assert(selected.length === 0 || (selected.length === 2 && (map.get(selected[0].number)?.tags || []).some((tag) => (map.get(selected[1].number)?.tags || []).includes(tag))), "請選擇 2 張持有相同標籤的 Holomen，或略過。 ");
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "相同標籤手牌成本已改變。 ");
        player.archive.push(moved);
      });
      if (selected.length === 2) appendLog(state, `${player.name} 支付 2 張手牌並抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    } else if (pending.effect === "archiveWholeHandDrawSame") {
      const handCount = Number(pending.meta?.handCount || 0);
      assert(selected.length === 0 || selected.length === handCount, "此效果只可略過，或選擇全部手牌。 ");
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "要全部存檔的手牌已改變。 ");
        player.archive.push(moved);
      });
      if (selected.length > 0) {
        markNamedUsage(player, pending.meta?.usageKey || "bloom:hBP04-066", state.turn);
        appendLog(state, `${player.name} 將全部 ${selected.length} 張手牌存檔，再抽 ${drawCards(state, playerIndex, selected.length)} 張。`);
      }
    } else if (pending.effect === "yesMyDarkCost") {
      if (selected.length > 0) {
        const moved = removeById(player.hand, selected[0].id);
        assert(moved, "Yes My Dark！的手牌成本已改變。 ");
        player.archive.push(moved);
        markNamedUsage(player, pending.meta?.usageKey || "bloom:hBP04-059", state.turn);
        const sourceCard = map.get(pending.meta?.sourceNumber);
        const odd = rollDice(random, state, playerIndex, 3, sourceCard, "因 Yes My Dark！擲 3 次骰").filter((die) => die % 2 === 1).length;
        appendLog(state, `${player.name} 因 ${odd} 個奇數抽 ${drawCards(state, playerIndex, odd)} 張牌。`);
      }
    } else if (pending.effect === "giftLimitedSave") {
      if (selected.length > 0) {
        const support = removeById(player.archive, selected[0].id);
        assert(support, "要放到牌庫底的 LIMITED 支援卡已改變。 ");
        player.mainDeck.push(support);
        const returned = (pending.meta?.returnIds || []).map((id) => takeDefeatedCard(player, id)).filter(Boolean);
        player.hand.push(...returned);
        appendLog(state, `${player.name} 將 1 張 LIMITED 支援卡放到牌庫底，並將倒下 Holomen 的 ${returned.length} 張重疊卡返回手牌。`);
      } else appendLog(state, `${player.name} 略過倒下 Holomen 的救援 Gift。`);
    } else if (pending.effect === "giftPowerToHand") {
      const moved = selected[0] ? removeById(player.holoPower, selected[0].id) : null;
      assert(moved, "所選 Holo Power 已改變。 ");
      player.hand.push(moved);
      player.holoPower = shuffle(player.holoPower, random);
      appendLog(state, `${player.name} 從 Holo Power 將 1 張牌加入手牌，並將餘下 Holo Power 洗牌。`);
    } else if (pending.effect === "giftDiscardDraw") {
      if (selected.length > 0) {
        const moved = removeById(player.hand, selected[0].id);
        assert(moved, "要存檔的手牌已改變。 ");
        player.archive.push(moved);
        appendLog(state, `${player.name} 因冬之旅存檔 1 張手牌並抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
      }
    } else if (pending.effect === "giftRaoraPowerPick") {
      const moved = selected[0] ? removeById(player.holoPower, selected[0].id) : null;
      assert(moved, "所選 Holo Power 已改變。 ");
      player.hand.push(moved);
      state.effectQueue.unshift({ type: "cardSelection", playerIndex, cards: clone(player.hand), selectableIds: player.hand.map((card) => card.id), min: 1, max: 1, prompt: "夢紡ぎのアトリエ：揀 1 張手牌放入 Holo Power。", effect: "giftHandToPower", source: "hand", optional: false, meta: {} });
    } else if (pending.effect === "giftHandToPower") {
      const moved = selected[0] ? removeById(player.hand, selected[0].id) : null;
      assert(moved, "要放入 Holo Power 的手牌已改變。 ");
      player.holoPower.push(moved);
      player.holoPower = shuffle(player.holoPower, random);
      appendLog(state, `${player.name} 將 1 張手牌放入 Holo Power 並洗牌。`);
    } else if (pending.effect === "deckToArchiveShuffle") {
      const moved = selected[0] ? removeById(player.mainDeck, selected[0].id) : null;
      assert(moved, "要放到存檔區的牌庫卡已改變。 ");
      player.archive.push(moved);
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 公開 ${moved.number} 放到存檔區，並將牌庫洗牌。`, [moved]);
    } else if (pending.effect === "deckMultipleToArchiveShuffle") {
      const moved = selected.map((card) => removeById(player.mainDeck, card.id)).filter(Boolean);
      assert(moved.length === selected.length, "要放到存檔區的牌庫卡已改變。 ");
      player.archive.push(...moved);
      player.mainDeck = shuffle(player.mainDeck, random);
      currentTurnEvents(player, state.turn).deckArchived += moved.length;
      appendLog(state, `${player.name} 公開 ${cardCodes(moved)} 放到存檔區，並將牌庫洗牌。`, moved);
    } else if (pending.effect === "topPickShuffleRest") {
      player.hand.push(...selected);
      player.mainDeck = shuffle([...player.mainDeck, ...unselected], random);
      appendLog(state, `${player.name} 將 ${cardCodes(selected)} 加入手牌，並將餘下查看卡片洗回牌庫。`, selected);
    } else if (pending.effect === "hSD10FlowGlowArchiveBottom") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的 #FLOW GLOW Holomen 已改變。 ");
        player.mainDeck.push(moved);
      });
      appendLog(state, player.name + " 將 " + selected.length + " 張 #FLOW GLOW Holomen 按選擇次序放到牌庫底。", selected);
      if (selected.length === 3 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: true, prompt: "返回 3 張 Holomen：可直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
    } else if (pending.effect === "giftNekkoPick") {
      if (selected.length > 0) enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: selected[0].id, genericTarget: true, targetRule: { zones: [pending.meta?.sourceZone] }, optional: false, prompt: "橙色偶像！：按 Gift 來源附加所選ねっ子。" });
    } else if (pending.effect === "gigiBloomDebutCost") {
      if (selected.length) {
        const source = player.zones[pending.meta.sourceZone];
        const cost = source?.stack.slice(0, -1).find(instance => instance.id === selected[0].id && map.get(instance.number)?.group === "holomem" && map.get(instance.number)?.stage === "Debut");
        assert(cost, "來源下方Debut費用已改變。");
        player.archive.push(removeById(source.stack, cost.id));
        enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, targetZone: "collab", amount: 20, loseLife: true, sourceZone: pending.meta.sourceZone, sourceName: "I am Gonathan G." });
      }
    } else if (pending.effect === "giftGigiUnderCost") {
      if (selected.length) {
        const source = player.zones[pending.meta.sourceZone];
        const payer = stageEntries(player).find(({ unit }) => cardHasName(unitCard(unit, map), "ジジ・ムリン") && unit.stack.slice(0, -1).some(instance => instance.id === selected[0].id && map.get(instance.number)?.group === "holomem"));
        assert(source && topCard(source)?.id === pending.meta.sourceId && payer, "Gigi來源或下方Holomen費用已改變。");
        player.archive.push(removeById(payer.unit.stack, selected[0].id));
        markNamedUsage(player, pending.meta.usageKey, state.turn);
        enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [pending.meta.sourceZone], optional: false, prompt: "再起之 Strength：將應援牌庫頂1張附加到發動者。" });
      }
    } else if (pending.effect === "giftFlowGlowPerformanceCost") {
      if (selected.length > 0) {
        const moved = removeById(player.hand, selected[0].id);
        assert(moved, "戯笑の使者所選手牌已改變。 ");
        player.archive.push(moved);
        const yellow = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("黃"));
        if (yellow.length > 0) enqueueCardSelection(state, { playerIndex, cards: yellow, min: 1, max: 1, effect: "archiveCheerToStage", source: "archive", prompt: "戯笑の使者：揀 1 張存檔區黃色應援；之後直接按虎金妃笑虎。", meta: { targetRule: { names: ["虎金妃笑虎"] } } });
        appendLog(state, `${player.name} 為「戯笑の使者」將 1 張 #FLOW GLOW Holomen 放到存檔區。`);
      }
    } else if (pending.effect === "giftKroniiBloomCard") {
      if (selected.length > 0) {
        const source = player.zones[pending.meta?.sourceZone];
        const bloomCard = map.get(selected[0].number);
        assert(source?.stack.some((instance) => instance.id === selected[0].id), "Ouro Kronii 下方所選 Holomen 已改變。 ");
        const options = stageEntries(player).filter(({ zone, unit: target }) => zone !== pending.meta?.sourceZone
          && talentMatches(bloomCard, unitCard(target, map))
          && Number(target.enteredTurn || 0) !== state.turn
          && Number(target.bloomedTurn || 0) !== state.turn
          && Number(bloomCard?.hp || 0) > Number(target.damage || 0)).map(({ zone }) => zone);
        assert(options.length > 0, "已沒有可由時界を統べし者 Bloom 的 Ouro Kronii。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "giftKroniiBloom", prompt: "時界を統べし者：直接按另一位 Ouro Kronii 完成 Bloom。", meta: { sourceZone: pending.meta?.sourceZone, cardId: selected[0].id } });
      }
    } else if (pending.effect === "oshiMarineStageBloomCard") {
      if (selected.length > 0) enqueueStageTarget(state, {
        playerIndex,
        options: ["center"],
        effect: "oshiMarineStageBloom",
        prompt: "魔性の再演：直接按中央宝鐘マリン完成再次 Bloom。",
        meta: { cardId: selected[0].id },
      });
    } else if (pending.effect === "giftOverwriteCard") {
      const source = player.zones[pending.meta?.sourceZone];
      assert(selected[0] && source && unitCard(source, map)?.number === "hBP01-045", "Overwrite 的來源或手牌已改變。 ");
      enqueueStageTarget(state, { playerIndex, options: [pending.meta.sourceZone], effect: "giftOverwriteBloom", prompt: "Overwrite：直接按牌桌上的 AZKi 完成 2nd Bloom。", meta: { sourceZone: pending.meta.sourceZone, cardId: selected[0].id } });
    } else if (pending.effect === "giftSlotSupportPick") {
      player.hand.push(...selected);
      player.archive.push(...unselected);
      currentTurnEvents(player, state.turn).deckArchived += unselected.length;
      if (selected.length > 0) markNamedUsage(player, pending.meta?.usageKey || "gift:hBP02-039", state.turn);
      appendLog(state, selected.length ? `${player.name} 以「ぷいぷいぷい～」將公開的支援卡加入手牌，其餘 ${unselected.length} 張放到存檔區。` : `${player.name} 略過 Gift，將公開的 ${unselected.length} 張卡放到存檔區。`);
    } else if (["genericKeywordHandArchiveCost", "genericKeywordHandBottomCost", "genericKeywordUnderArchiveCost"].includes(pending.effect)) {
      const paidCount = pending.effect === "genericKeywordHandArchiveCost"
        ? payHandArchive(state, playerIndex, pending, selected, skipped, map) : selected.length;
      if (paidCount > 0) {
        if (pending.effect === "genericKeywordUnderArchiveCost") {
          const source = player.zones[pending.meta?.sourceZone];
          selected.forEach((card) => {
            const moved = source && removeById(source.stack, card.id);
            assert(moved, "關鍵字效果下方成本已改變。 ");
            player.archive.push(moved);
          });
        } else if (pending.effect === "genericKeywordHandBottomCost") {
          selected.forEach((card) => {
            const moved = removeById(player.hand, card.id);
            assert(moved, "關鍵字效果手牌成本已改變。 ");
            if (pending.effect === "genericKeywordHandBottomCost") player.mainDeck.push(moved);
            else player.archive.push(moved);
          });
        }
        appendLog(state, `${player.name} 已支付「${map.get(pending.meta?.cardNumber)?.keyword?.name || "卡牌效果"}」的 ${paidCount} 張卡成本。`);
        resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, paidCount);
      }
    } else if (pending.effect === "koroneDownCheer") {
      enqueueStageTarget(state, { playerIndex, effect: "koroneDownReceive", optional: false, prompt: "選擇另一位成員接收應援。", meta: { cheerId: selected[0].id, stackIds: pending.meta.stackIds } });
    } else if (pending.effect === "towaDownBottom") {
      const opponent = state.players[pending.meta.opponentIndex];
      for (const group of pending.meta.groups) assert(selected.filter(c => group.ids.includes(c.id)).length === group.count, "須從中央與合作各選指定數量的應援。");
      for (const card of selected) {
        const group = pending.meta.groups.find(g => g.ids.includes(card.id));
        const moved = removeById(opponent.zones[group.zone]?.cheer || [], card.id);
        assert(moved, "對手應援已改變。");
        opponent.cheerDeck.push(moved);
      }
    } else if (pending.effect === "fastForwardBloomCard") {
      if (selected.length) enqueueStageTarget(state, { playerIndex, options: fastForwardBloomTargets(player, map.get(selected[0].number), map, state.turn), effect: "fastForwardBloom", optional: false, prompt: "選擇本回合出場的後排 Debut。", meta: { cardId: selected[0].id } });
    } else if (pending.effect === "giftArchiveBloomCard") {
      const selectedCard = selected[0] && map.get(selected[0].number);
      const options = selectedCard ? bloomTargets(player, selectedCard, map, state.turn) : [];
      assert(selected[0] && selectedCard && options.length > 0, "存檔區 Bloom 的卡片或目標已改變。 ");
      enqueueStageTarget(state, { playerIndex, options, effect: "giftArchiveBloom", prompt: "光，再次點亮：直接按牌桌上的合法 Holomen 完成 Bloom。", meta: { cardId: selected[0].id } });
    } else if (pending.effect === "archiveAssistants") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的卡片已改變。 ");
        player.hand.push(moved);
      });
      appendLog(state, selected.length ? `${player.name} 將 ${selected.length} 張「こよりの助手くん」返回手牌。` : `${player.name} 略過 Bloom 的存檔區回收效果。`);
    } else if (pending.effect === "koyoriBottom") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區的卡片已改變。 ");
        player.mainDeck.push(moved);
      });
      appendLog(state, selected.length ? `${player.name} 將 ${selected.length} 張「博衣こより」按選擇次序放到牌庫底。` : `${player.name} 略過 Bloom 的牌庫底回收效果。`);
      if (selected.length === 4) {
        const supports = player.archive.filter((instance) => {
          const support = map.get(instance.number);
          return cardHasTag(support, "#こよラボ")
            && support?.group === "support"
            && attachmentTargets(player, support, map).some((zone) => isKoyoriCard(map.get(topCard(player.zones[zone])?.number)));
        });
        if (supports.length > 0) enqueueCardSelection(state, { playerIndex, cards: supports, min: 1, max: 1, prompt: "已放回 4 張こより：可揀 1 張 #こよラボ 支援卡附加到自己的博衣こより。", effect: "chooseArchiveSupportForAttach", source: "archive", optional: true });
      }
    } else if (pending.effect === "chooseArchiveSupportForAttach") {
      if (selected.length > 0) enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: selected[0].id, optional: false, prompt: "直接按牌桌上一位「博衣こより」附加所選支援卡。" });
      else appendLog(state, `${player.name} 略過附加 #こよラボ 支援卡。`);
    } else if (pending.effect === "chooseArchivedAssistantForAttach") {
      if (selected.length > 0) enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: selected[0].id, optional: false, excludeZone: pending.meta?.excludeZone, prompt: "Arts 效果：直接按牌桌上另一位「博衣こより」附加所選助手君。" });
      else appendLog(state, `${player.name} 略過從存檔區附加「こよりの助手くん」。`);
    } else if (pending.effect === "drawingStreamCheer") {
      if (selected.length > 0) {
        const cheer = removeById(player.cheerDeck, selected[0].id);
        assert(cheer, "應援牌庫中的卡片已改變。 ");
        enqueueEffect(state, { type: "eventCheerTarget", playerIndex, tag: "#絵", cheerCard: cheer, shuffleAfter: true, prompt: "繪畫直播：按一位持有 #絵 的 Holomen 附加所選應援。" });
      } else {
        player.cheerDeck = shuffle(player.cheerDeck, random);
        appendLog(state, `${player.name} 沒有從應援牌庫公開卡片；應援牌庫已洗牌。`);
      }
      queueDrawingStreamArchive(state, playerIndex, map);
    } else if (pending.effect === "irohaGiftBloom") {
      if (selected.length) {
        const candidate = map.get(selected[0].number);
        const options = stageEntries(player).filter(({unit}) => cardHasName(unitCard(unit,map), "風真いろは") && unit.bloomedTurn === state.turn && unitCard(unit,map)?.stage === "1st" && candidate?.stage === "2nd" && talentMatches(candidate,unitCard(unit,map)) && candidate.hp > unit.damage).map(({zone})=>zone);
        if (options.length) enqueueStageTarget(state, { playerIndex, options, effect: "oshiBloom", prompt: "選擇本回合Bloom過的風真いろは。", meta: { cardId: selected[0].id, source: "hand" } });
      }    } else if (pending.effect === "bonusBloomCard") {
      if (selected.length > 0) enqueueEffect(state, { type: "bonusBloomTarget", playerIndex, cardId: selected[0].id, prompt: "綻放舞台：直接按本回合由 Debut Bloom 而成的 1st Holomen。" });
      else {
        player.bonusBloomUsedTurn = state.turn;
        appendLog(state, `${player.name} 略過「綻放舞台」的額外 Bloom。`);
      }
    } else if (pending.effect === "kroniiFirstTurnBloomCard") {
      if (selected.length > 0) enqueueStageTarget(state, { playerIndex, options: ["center"], effect: "kroniiFirstTurnBloom", prompt: "直接按中央 Ouro Kronii，完成首回合特例 Bloom。", meta: { cardId: selected[0].id } });
    } else if (pending.effect === "archiveBloomCard") {
      if (selected.length > 0) {
        const selectedCard = map.get(selected[0].number);
        const options = stageEntries(player).filter(({ unit: target }) => cardHasTag(unitCard(target, map), "#ID2期生") && unitCard(target, map)?.stage === "Debut" && talentMatches(selectedCard, unitCard(target, map)) && Number(target.enteredTurn || 0) !== state.turn && Number(target.bloomedTurn || 0) !== state.turn && Number(selectedCard?.hp || 0) > Number(target.damage || 0)).map(({ zone }) => zone);
        assert(options.length > 0, "限界化！！的 Bloom 目標已改變。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "archiveBloom", prompt: "直接按 #ID2期生 Debut，使用存檔區卡片完成 Bloom。", meta: { cardId: selected[0].id, usageKey: pending.meta?.usageKey || "bloom:hBP02-051" } });
      }
    } else if (pending.effect === "deckSupportToAttach") {
      if (selected.length > 0) {
        const moved = removeById(player.mainDeck, selected[0].id);
        assert(moved, "牌庫中的附加卡已改變。 ");
        player.archive.push(moved);
        enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: moved.id, genericTarget: true, targetRule: pending.meta?.targetRule || {}, optional: false, prompt: "直接按牌桌上的合法 Holomen 附加所選卡。" });
      }
      player.mainDeck = shuffle(player.mainDeck, random);
      if (selected.length === 0) appendLog(state, `${player.name} 沒有公開附加卡；牌庫已洗牌。`);
    } else if (pending.effect === "oshiRemoveArchivedCheer") {
      const moved = removeById(player.archive, selected[0].id);
      assert(moved, "存檔區的綠色應援已改變。 ");
      player.removed.push(moved);
      const cheers = [...player.cheerDeck];
      if (cheers.length > 0) enqueueCardSelection(state, { playerIndex, cards: cheers, min: 0, max: 1, optional: true, effect: "oshiCheerDeckPick", source: "cheerDeck", prompt: "HALU：可公開應援牌庫 1 張實際應援；之後直接按牌桌目標。" });
    } else if (pending.effect === "oshiCheerDeckPick") {
      if (selected.length > 0) {
        const cheer = removeById(player.cheerDeck, selected[0].id);
        assert(cheer, "應援牌庫中的卡片已改變。 ");
        enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, shuffleAfter: true, prompt: "HALU：直接按自己 1 位 Holomen 附加所選應援。" });
      } else player.cheerDeck = shuffle(player.cheerDeck, random);
    } else if (["oshiBonusBloomCard", "oshiBloomFromArchiveCard", "oshiBloomFromDeckCard"].includes(pending.effect)) {
      if (selected.length > 0) {
        const selectedCard = map.get(selected[0].number);
        const allowSameTurn = pending.effect === "oshiBonusBloomCard";
        const rule = pending.meta || {};
        const options = stageEntries(player).filter(({ unit: stageUnit }) => {
          const targetCard = unitCard(stageUnit, map);
          if (rule.tags && !rule.tags.some((tag) => cardHasTag(targetCard, tag))) return false;
          if (rule.names && !rule.names.some((name) => cardHasName(targetCard, name))) return false;
          if (!legalBloomStage(selectedCard, targetCard) || !talentMatches(selectedCard, targetCard) || Number(selectedCard?.hp || 0) <= Number(stageUnit.damage || 0)) return false;
          if (allowSameTurn) return Number(stageUnit.bloomedTurn || 0) === state.turn;
          return Number(stageUnit.enteredTurn || 0) !== state.turn && Number(stageUnit.bloomedTurn || 0) !== state.turn;
        }).map(({ zone }) => zone);
        assert(options.length > 0, "Bloom 的合法目標已改變。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "oshiBloom", prompt: "直接按牌桌上的合法 Holomen 完成 Bloom。", meta: { cardId: selected[0].id, source: pending.source, artCostReduction: pending.meta?.artCostReduction || 0, fullHealOllie: Boolean(pending.meta?.fullHealOllie) } });
      } else if (pending.source === "deck") player.mainDeck = shuffle(player.mainDeck, random);
    } else if (pending.effect === "oshiDiscardForArchiveEn") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.archive.push(moved);
      });
      const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#EN"));
      if (candidates.length >= 2) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 2, max: 2, optional: true, effect: "archiveToHand", source: "archive", prompt: "取樣：可揀 2 張存檔區 #EN Holomen 返回手牌，或略過。" });
    } else if (pending.effect === "oshiTopKeepOne") {
      player.hand.push(...selected);
      player.mainDeck.unshift(...unselected);
      appendLog(state, `${player.name} 將 ${selected.length} 張加入手牌，其餘 ${unselected.length} 張放回牌庫頂。`);
    } else if (pending.effect === "oshiLuiDiscardDamage") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.archive.push(moved);
      });
      for (const targetZone of stageOptionsMatching(state.players[pending.meta.targetPlayerIndex], map, { zones: ["center", "collab"], excludeStages: ["Debut"] })) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: pending.meta.targetPlayerIndex, targetZone, amount: 50, loseLife: true, sourceName: "ホイサホイサ" });
    } else if (pending.effect === "oshiInaPower") {
      selected.forEach((card) => {
        const moved = removeById(player.holoPower, card.id);
        assert(moved, "Holo Power 已改變。 ");
        player.archive.push(moved);
      });
      appendLog(state, `${player.name} 為「Ina'nis的色彩」支付 ${selected.length} Holo Power。`);
      for (let index = 0; index < selected.length; index += 1) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, effect: "oshiAllColors", prompt: `Ina'nis的色彩（${index + 1}/${selected.length}）：直接按對手 1 位 Holomen，本回合視為所有顏色。` });
    } else if (pending.effect === "oshiArchiveCheerDistribute") {
      selected.forEach((cheer) => enqueueEffect(state, { type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: pending.meta?.targetRule || {}, prompt: "直接按一位合法 Holomen 附加所選存檔區應援。" }));
    } else if (pending.effect === "oshiCheerDeckDistribute") {
      selected.forEach((card) => {
        const cheer = removeById(player.cheerDeck, card.id);
        assert(cheer, "應援牌庫中的卡片已改變。 ");
        player.archive.push(cheer);
        enqueueEffect(state, { type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: pending.meta?.targetRule || {}, prompt: "直接按一位合法 Holomen 附加所選應援。" });
      });
      triggerCheerArchivedGift(state, playerIndex, map, selected.length);
      player.cheerDeck = shuffle(player.cheerDeck, random);
    } else if (pending.effect === "deckSupportsToAttach") {
      selected.forEach((card) => {
        const moved = removeById(player.mainDeck, card.id);
        assert(moved, "牌庫中的附加卡已改變。 ");
        player.archive.push(moved);
        enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: moved.id, genericTarget: true, targetRule: pending.meta?.targetRule || {}, optional: false, prompt: "直接按牌桌上的合法 Holomen 附加所選卡。" });
      });
      player.mainDeck = shuffle(player.mainDeck, random);
    } else if (pending.effect === "handToBottomThenDrawFive") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.mainDeck.push(moved);
      });
      appendLog(state, `${player.name} 將 ${selected.length} 張手牌按次序放到牌庫底，再抽 ${drawCards(state, playerIndex, Math.max(0, 5 - player.hand.length))} 張至 5 張手牌。`);
    } else if (pending.effect === "oshiOllieDiscard") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.archive.push(moved);
      });
      const candidates = player.archive.filter((instance) => {
        const card = map.get(instance.number);
        return card?.group === "holomem" && ["1st", "2nd"].includes(card.stage) && stageEntries(player).some(({ unit: stageUnit }) => legalBloomStage(card, unitCard(stageUnit, map)) && talentMatches(card, unitCard(stageUnit, map)) && Number(stageUnit.enteredTurn || 0) !== state.turn && Number(stageUnit.bloomedTurn || 0) !== state.turn && Number(card.hp || 0) > Number(stageUnit.damage || 0));
      });
      if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "oshiBloomFromArchiveCard", source: "archive", prompt: "復甦的オリー：可揀 1 張存檔區 Holomen；下一步直接按合法 Bloom 目標。", meta: { fullHealOllie: true } });
    } else if (pending.effect === "oshiMushroomReturn") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區卡片已改變。 ");
        player.hand.push(moved);
      });
      appendLog(state, `${player.name} 返回 ${selected.length} 張 #きのこ 卡，並抽 ${drawCards(state, playerIndex, Math.floor(selected.length / 2))} 張牌。`);
    } else if (pending.effect === "oshiFoodReturn") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區卡片已改變。 ");
        player.hand.push(moved);
      });
      addMatchingStageModifiers(state, playerIndex, map, { tags: ["#料理"] }, 40, "hBP05-005");
    } else if (pending.effect === "oshiMioTopSix") {
      player.hand.push(...selected);
      stageOptionsMatching(player, map, { damaged: true }).forEach((zone) => healStageUnit(state, playerIndex, zone, 50, map));
      if (unselected.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, min: unselected.length, max: unselected.length, effect: "topOrder", source: "revealed", prompt: "大家的媽媽：按次序將餘下卡放回牌庫頂。" });
    } else if (pending.effect === "oshiPolkaPick") {
      player.hand.push(...selected);
      const selectableIds = unselected.filter((instance) => String(map.get(instance.number)?.typeCode || "").includes("Staff")).map((instance) => instance.id);
      if (selectableIds.length > 0) enqueueCardSelection(state, { playerIndex, cards: unselected, selectableIds, min: 1, max: 1, optional: false, effect: "oshiStaffPick", source: "revealed", prompt: "成功體驗－！！！：再公開 1 張工作人員；餘下卡放到存檔區。" });
      else player.archive.push(...unselected);
    } else if (pending.effect === "oshiStaffPick") {
      player.hand.push(...selected);
      player.archive.push(...unselected);
      appendLog(state, `${player.name} 將公開卡加入手牌，其餘 ${unselected.length} 張放到存檔區。`);
    } else if (pending.effect === "oshiRobocoDiscard") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.archive.push(moved);
      });
      const fans = player.archive.filter((instance) => cardHasName(map.get(instance.number), "ろぼさー"));
      if (fans.length > 0 && stageOptionsMatching(player, map, { names: ["ロボ子さん", "蘿蔔子"] }).length > 0) enqueueCardSelection(state, { playerIndex, cards: fans, min: 0, max: fans.length, optional: true, effect: "oshiRobosaAttach", source: "archive", prompt: "高性能：揀任意張ろぼさー；之後逐張直接按ロボ子さん。" });
    } else if (pending.effect === "oshiRobosaAttach") {
      selected.forEach((card) => enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: card.id, genericTarget: true, targetRule: { names: ["ロボ子さん", "蘿蔔子"] }, prompt: "直接按 1 位ロボ子さん附加所選ろぼさー。" }));
    } else if (pending.effect === "oshiZetaSupports") {
      const target = player.zones[pending.meta?.targetZone];
      assert(target, "#ID3期生 附加目標已離開舞台。 ");
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區附加卡已改變。 ");
        delete moved.risunersUsedTurn;
        target.attachments.push(moved);
        queueAttachmentEntryEffects(state, playerIndex, pending.meta.targetZone, map.get(moved.number), map, random, "archive");
      });
      if (selected.length >= 3) addStageModifier(target, "arts", 100, state.turn, "hBP07-002");
    } else if (pending.effect === "oshiRirikaSearch") {
      selected.forEach((card) => {
        const moved = removeById(player.mainDeck, card.id);
        assert(moved, "牌庫中的一条莉々華已改變。 ");
        player.hand.push(moved);
      });
      queueDeckToHand(state, playerIndex, { nameIncludes: ["限界飯"] }, map, random, { optional: false, label: "かわいい！ ポジティブ！ ジーニアス！" });
    } else if (pending.effect === "giftArchiveUnderForBackShield") {
      const source = player.zones[pending.meta?.sourceZone];
      const chosen = selected[0];
      const cost = source?.stack.slice(0, -1).find(instance => instance.id === chosen?.id && map.get(instance.number)?.group === "holomem");
      assert(cost && topCard(source)?.id === pending.meta.sourceId && unitCard(source, map)?.number === "hSD13-012", "防護來源或下方Holomen已改變。");
      const moved = removeById(source.stack, cost.id);
      player.archive.push(moved);
      addPlayerModifier(player, "backSpecialImmune", 0, state.turn, "hSD13-012");
      state.effectQueue.unshift({ ...pending.meta.queuedEffect, giftReactionChecked: true, giftImmune: true });
      appendLog(state, `${player.name} 將 1 張重疊 Holomen 放到存檔區；本回合後排不受特殊傷害。`);
    } else if (pending.effect === "artHandArchiveCost") {
      const paidCount = payHandArchive(state, playerIndex, pending, selected, skipped, map);
 
      if (paidCount === 2 && pending.meta?.afterEffect === "challengerDraw") appendLog(state, `${player.name} 因 challenger 抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
      const bonus = paidCount > 0 ? Number(pending.meta?.fixedBonus || 0) + paidCount * Number(pending.meta?.perBonus || 0) : 0;
      adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, bonus);
      if (paidCount > 0 && pending.meta?.afterEffect === "buffSong") enqueueStageTarget(state, { playerIndex, rule: { tags: ["#歌"] }, effect: "artBuffTarget", prompt: `Arts 效果：直接按自己 1 位 #歌 Holomen，本回合 Arts +${paidCount * Number(pending.meta?.afterMeta?.perBonus || 0)}。`, meta: { kind: "arts", amount: paidCount * Number(pending.meta?.afterMeta?.perBonus || 0), sourceNumber: "arts", sourceZone: pending.meta?.sourceZone } });
      if (paidCount > 0 && pending.meta?.afterEffect === "buffCenterAyame" && player.zones.center && cardHasName(unitCard(player.zones.center, map), "百鬼あやめ")) addStageModifier(player.zones.center, "arts", Number(pending.meta?.afterMeta?.amount || 0), state.turn, "arts");
      appendLog(state, paidCount ? `${player.name} 已支付 ${paidCount} 張卡成本${bonus ? `，這次 Arts +${bonus}` : ""}。` : `${player.name} 略過 Arts 的可選成本。`);
    } else if (pending.effect === "artUnderCardCost") {
      const source = player.zones[pending.meta?.sourceZone];
      selected.forEach((card) => {
        const moved = source && removeById(source.stack, card.id);
        assert(moved, "Arts 成本所選重疊 Holomen 已改變。 ");
        player.archive.push(moved);
      });
      const bonus = selected.length > 0 ? Number(pending.meta?.fixedBonus || 0) + selected.length * Number(pending.meta?.perBonus || 0) : 0;
      adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, bonus);
      if (selected.length >= 5 && pending.meta?.afterEffect === "marineUnderFive") enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS, excludeStages: ["Debut"] }, effect: "specialDamage", prompt: "Arts 效果：直接按對手 1 位非 Debut 後排，造成 100 點特殊傷害。", meta: { amount: 100, loseLife: true, sourceName: "Arts 效果", sourceZone: pending.meta?.sourceZone } });
      appendLog(state, selected.length ? `${player.name} 將 ${selected.length} 張重疊 Holomen 放到存檔區，這次 Arts +${bonus}。` : `${player.name} 略過 Arts 的可選成本。`);
    } else if (pending.effect === "artArchiveToBottomCost") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "Arts 成本所選存檔區卡片已改變。 ");
        player.mainDeck.push(moved);
      });
      const bonus = selected.length > 0 ? Number(pending.meta?.fixedBonus || 0) + selected.length * Number(pending.meta?.perBonus || 0) : 0;
      adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, bonus);
      appendLog(state, selected.length ? `${player.name} 將 ${selected.length} 張存檔區卡片放到牌庫底，這次 Arts +${bonus}。` : `${player.name} 略過 Arts 的可選成本。`);
    } else if (pending.effect === "artHoloPowerCost") {
      const moved = selected[0] ? removeById(player.holoPower, selected[0].id) : null;
      if (moved) {
        player.archive.push(moved);
        adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, Number(pending.meta?.fixedBonus || 0));
        appendLog(state, `${player.name} 將 1 張 Holo Power 放到存檔區，這次 Arts +${Number(pending.meta?.fixedBonus || 0)}。`);
      }
    } else if (pending.effect === "artArchiveToHandCost") {
      const moved = selected[0] ? removeById(player.archive, selected[0].id) : null;
      if (moved) {
        player.hand.push(moved);
        adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, Number(pending.meta?.fixedBonus || 0));
        appendLog(state, `${player.name} 將 ${map.get(moved.number)?.name || moved.number} 返回手牌，這次 Arts +${Number(pending.meta?.fixedBonus || 0)}。`);
      }
    } else if (pending.effect === "deckToHandShuffle") {
      selected.forEach((card) => {
        const moved = removeById(player.mainDeck, card.id);
        assert(moved, "牌庫中的卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌，並洗牌。` : `${player.name} 沒有從牌庫公開卡片；牌庫已洗牌。`, selected);
      if (pending.meta?.afterEffect === "promiseTimeBuff") enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: "自己的生命較少：直接按自己 1 位 Holomen，本回合 Arts +20。", meta: { kind: "arts", amount: 20 } });
      if (pending.meta?.afterEffect === "reglossDrawDiscard") {
        appendLog(state, `${player.name} 因舞台 Holomen 較少再抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
        enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: "我們是 ReGLOSS：揀 1 張手牌放到存檔區。" });
      }
    } else if (pending.effect === "groupedDeckToHand") {
      if (selected.length > 0) {
        const moved = removeById(player.mainDeck, selected[0].id);
        assert(moved, "分組牌庫搜尋的卡片已改變。 ");
        player.hand.push(moved);
        appendLog(state, `${player.name} 公開 ${moved.number} 加入手牌。`, [moved]);
      }
      queueGroupedDeckToHand(state, playerIndex, pending.meta?.remainingGroups || [], map, random, pending.meta?.label || "分組牌庫搜尋");
    } else if (pending.effect === "collabDebutSearch") {
      if (selected.length > 0) {
        const moved = removeById(player.mainDeck, selected[0].id);
        assert(moved, "牌庫中的 Debut 已改變。 ");
        player.hand.push(moved);
        appendLog(state, `${player.name} 公開 ${moved.number} 加入手牌。`, [moved]);
      } else appendLog(state, `${player.name} 沒有從牌庫公開 Debut Holomen。`);
      const supports = player.mainDeck.filter((instance) => cardHasTag(map.get(instance.number), "#こよラボ") && map.get(instance.number)?.group === "support");
      if (supports.length > 0) enqueueCardSelection(state, { playerIndex, cards: supports, min: 1, max: 1, prompt: "合作效果：可再揀 1 張 #こよラボ 支援卡加入手牌，亦可不公開卡片。", effect: "deckToHandShuffle", source: "deck", optional: true });
      else player.mainDeck = shuffle(player.mainDeck, random);
    } else if (pending.effect === "customComputerDebut") {
      const moved = removeById(player.hand, selected[0].id);
      assert(moved, "手牌中的 Debut 已改變。 ");
      player.mainDeck.push(moved);
      const debutCard = map.get(moved.number);
      appendLog(state, `客製化電腦：公開 ${debutCard?.name || moved.number} 並放到牌庫底。`, [moved]);
      const candidates = player.mainDeck.filter((instance) => {
        const candidate = map.get(instance.number);
        return candidate?.stage === "1st" && !cardIsBuzz(candidate) && talentMatches(candidate, debutCard);
      });
      if (candidates.length > 0) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, effect: "deckToHandShuffle", source: "deck", optional: true, prompt: "客製化電腦：可公開 1 張同名非 Buzz 1st Holomen 加入手牌。" });
      else player.mainDeck = shuffle(player.mainDeck, random);
    } else if (pending.effect === "irohaNamedCheerPick") {
      state.effectQueue.unshift(...selected.map(cheer => ({ type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: pending.meta.targetRule, prompt: "選擇指定名字的 Holomen 附加應援。" })));
    } else if (pending.effect === "frontierCheerPick") {
      enqueueStageTarget(state, { playerIndex, rule: { names: ["AZKi"] }, effect: "frontierCheerAttach", optional: false, prompt: "選擇 AZKi 附加應援。", meta: { cardId: selected[0].id, remaining: pending.meta.remaining } });
    } else if (pending.effect === "archiveCheerOneRecipient") {
      enqueueStageTarget(state, { playerIndex, rule: pending.meta.targetRule, effect: "archiveCheerOneRecipient", optional: false, prompt: "選擇 1 位成員接收全部應援。", meta: { cardIds: selected.map(c => c.id) } });
    } else if (pending.effect === "moonaFanCheer") {
      if (selected.length) {
        markNamedUsage(player, pending.meta.usageKey, state.turn);
        enqueueEffect(state, { type: "attachArchiveCheerCard", playerIndex, cardId: selected[0].id, targetRule: { zones: BACK_SLOTS }, prompt: "選擇後排Holomen附加藍色應援。" });
      }    } else if (pending.effect === "ancientWeaponCheer") {
      const [zone, ...remaining] = pending.meta.targets || [];
      const target = player.zones[zone];
      assert(target, "古代武器持有者已離開舞台。");
      const cheer = removeById(player.archive, selected[0]?.id);
      assert(cheer, "存檔區應援已改變。");
      attachCheerCards(state, target, [cheer]);
      if (remaining.length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "ancientWeaponCheer", meta: { targets: remaining }, prompt: "古代武器：揀 1 張存檔區應援附加到下一位持有者。" }, map);
    } else if (pending.effect === "nepolaboCheer") {
      enqueueStageTarget(state, { playerIndex, options: pending.meta.targets, effect: "nepolaboReceive", optional: false, prompt: "選擇尚未獲得應援的 #5期生 2nd。", meta: { targets: pending.meta.targets, cheerId: selected[0].id } });    } else if (pending.effect === "shioriArchiveCheer") {
      enqueueStageTarget(state, { playerIndex, options: stageOptionsMatching(player, map, { tags: ["#Advent"] }), effect: "shioriReceiveCheer", optional: false, prompt: "選擇 #Advent 成員附加應援。", meta: { cheerId: selected[0].id, sourceZone: pending.meta.sourceZone } });
    } else if (pending.effect === "archiveCheerToStage") {
      selected.forEach((cheer) => enqueueEffect(state, { type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: pending.meta?.targetRule || {}, targetZone: pending.meta?.targetZone || "", maxCheerFromEffect: pending.meta?.maxCheerFromEffect || 0, effectBatch: pending.meta?.effectBatch || "", prompt: "直接按牌桌上的合法 Holomen 附加所選應援。" }));
    } else if (pending.effect === "opponentArchiveCheerToStage") {
      const ownerIndex = Number(pending.meta?.ownerIndex);
      const targetPlayerIndex = Number(pending.meta?.targetPlayerIndex);
      selected.forEach((cheer) => enqueueStageTarget(state, { playerIndex, targetPlayerIndex, rule: pending.meta?.targetRule || {}, effect: "attachOpponentArchiveCheer", prompt: "直接按對手牌桌上的合法 Holomen，附加所選存檔區應援。", meta: { ownerIndex, cheerId: cheer.id } }));
      if (pending.meta?.afterOwnShion) enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { names: ["紫咲シオン"] }, prompt: "之後：可揀自己存檔區 1 張應援；下一步直接按紫咲シオン附加。" }, map);
    } else if (["deckCardsToStage", "archiveCardsToStage"].includes(pending.effect)) {
      const source = pending.effect === "archiveCardsToStage" ? "archive" : "deck";
      selected.forEach((card) => enqueueEffect(state, { type: "placeSelectedCardOnStage", playerIndex, cardId: card.id, source, prompt: `直接按一個後排空位放置 ${map.get(card.number)?.name || card.number}。` }));
      enqueueEffect(state, { type: "finalizeCardsToStage", playerIndex, shuffle: source === "deck", afterEffect: pending.meta?.afterEffect || "", afterMeta: pending.meta?.afterMeta || {}, selectedCount: selected.length, selectedIds: selected.map((card) => card.id) });
      if (selected.length === 0 && source === "deck") player.mainDeck = shuffle(player.mainDeck, random);
    } else if (["handToBottom", "kumarineBottom"].includes(pending.effect)) {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "手牌已改變。 ");
        player.mainDeck.push(moved);
      });
      if (pending.effect === "kumarineBottom" && selected.length > 0) appendLog(state, `${player.name} 公開宝鐘マリン放到牌庫底，再抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
      else appendLog(state, `${player.name} 將 ${selected.length} 張手牌放到牌庫底。`);
    } else if (pending.effect === "handToArchive") {
      const paidCount = payHandArchive(state, playerIndex, pending, selected, skipped, map);
      appendLog(state, `${player.name} 完成 ${paidCount} 張卡的手牌存檔結算。`);
    } else if (pending.effect === "favoriteComputerDebut") {
      const debut = selected[0];
      const debutCard = map.get(debut.number);
      const buzz = player.mainDeck.filter((instance) => {
        const candidate = map.get(instance.number);
        return candidate?.group === "holomem" && cardIsBuzz(candidate) && talentMatches(candidate, debutCard);
      });
      assert(buzz.length > 0, "牌庫沒有與所選 Debut 同名的 Buzz Holomen。 ");
      enqueueCardSelection(state, { playerIndex, cards: buzz, min: 1, max: 1, effect: "favoriteComputerBuzz", source: "deck", prompt: "最愛電腦：公開 1 張同名 Buzz Holomen。", meta: { debutId: debut.id } });
    } else if (pending.effect === "favoriteComputerBuzz") {
      const goods = player.mainDeck.filter((instance) => cardHasTag(map.get(instance.number), "#Buzzグッズ") && map.get(instance.number)?.group === "support");
      assert(goods.length > 0, "牌庫沒有 #Buzzグッズ 支援卡。 ");
      enqueueCardSelection(state, { playerIndex, cards: goods, min: 1, max: 1, effect: "favoriteComputerFinish", source: "deck", prompt: "最愛電腦：公開 1 張 #Buzzグッズ 支援卡。", meta: { debutId: pending.meta?.debutId, buzzId: selected[0].id } });
    } else if (pending.effect === "favoriteComputerFinish") {
      const ids = [pending.meta?.debutId, pending.meta?.buzzId, selected[0]?.id].filter(Boolean);
      ids.forEach((id) => {
        const moved = removeById(player.mainDeck, id);
        assert(moved, "最愛電腦所選卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 以最愛電腦將 Debut、同名 Buzz 及 #Buzzグッズ 各 1 張加入手牌並洗牌。`);
    } else if (pending.effect === "archiveHolomemToDeckDraw") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區 Holomen 已改變。 ");
        player.mainDeck.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 將 ${selected.length} 張 Holomen 洗回牌庫並抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    } else if (pending.effect === "topOrder") {
      assert(selected.length === pending.cards.length, "需要為全部公開卡決定次序。 ");
      player.mainDeck.unshift(...selected);
      appendLog(state, `${player.name} 已按次序將 ${selected.length} 張牌放回牌庫頂。`);
    } else if (pending.effect === "frontierReturn") {
      const moved = removeById(player.archive, selected[0].id);
      assert(moved, "存檔區 AZKi 已改變。 ");
      player.hand.push(moved);
      queueFrontierCheer(state, playerIndex, Number(pending.meta?.copies || 0), map);
    } else if (pending.effect === "archiveSupportToDeckDraw") {
      selected.forEach((card) => {
        const moved = removeById(player.archive, card.id);
        assert(moved, "存檔區支援卡已改變。 ");
        player.mainDeck.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 將 ${selected.length} 張吉祥物／粉絲洗回牌庫並抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    } else if (pending.effect === "donutFuwawa") {
      const mococo = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "モココ・アビスガード"));
      assert(mococo.length > 0, "牌庫沒有モココ・アビスガード。 ");
      enqueueCardSelection(state, { playerIndex, cards: mococo, min: 1, max: 1, effect: "donutFinish", source: "deck", prompt: "回憶中的甜甜圈店：再公開 1 張モココ・アビスガード。", meta: { fuwawaId: selected[0].id, damageAfter: pending.meta?.damageAfter } });
    } else if (pending.effect === "donutFinish") {
      [pending.meta?.fuwawaId, selected[0]?.id].filter(Boolean).forEach((id) => {
        const moved = removeById(player.mainDeck, id);
        assert(moved, "甜甜圈店所選卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      if (pending.meta?.damageAfter) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, effect: "specialDamage", prompt: "自己的生命較少：直接按對手 1 位 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true } });
    } else if (pending.effect === "gentleMonsterRirika") {
      const meals = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "限界飯"));
      assert(meals.length > 0, "牌庫沒有「限界飯」。 ");
      enqueueCardSelection(state, { playerIndex, cards: meals, min: 1, max: 1, effect: "gentleMonsterFinish", source: "deck", prompt: "溫柔的怪物：再公開 1 張限界飯。", meta: { ririkaId: selected[0].id } });
    } else if (pending.effect === "gentleMonsterFinish") {
      [pending.meta?.ririkaId, selected[0]?.id].filter(Boolean).forEach((id) => {
        const moved = removeById(player.mainDeck, id);
        assert(moved, "溫柔的怪物所選卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      if (player.archive.filter((instance) => cardHasName(map.get(instance.number), "限界飯")).length >= 3) addPlayerModifier(player, "arts", 50, state.turn, "hBP08-096", { names: ["一条莉々華", "一條莉々華"] });
    } else if (pending.effect === "mythologyPick") {
      player.hand.push(...selected);
      player.archive.push(...unselected);
      appendLog(state, `${player.name} 將 ${selected.length} 張公開卡加入手牌，其餘 ${unselected.length} 張放到存檔區。`);
    } else if (pending.effect === "keepGrowingCheer") {
      selected.forEach((cheer) => enqueueEffect(state, { type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: { zones: ["center", "collab"] }, maxCheerFromEffect: 2, effectBatch: "keepGrowing", prompt: "直接按中央或合作 Holomen 附加所選應援；每位最多收到 2 張。" }));
    } else if (pending.effect === "justiceUndercards") {
      const stageUnit = player.zones[pending.meta?.zone];
      assert(stageUnit, "所選 Holomen 已離開舞台。 ");
      selected.forEach((card) => {
        const moved = removeById(stageUnit.stack, card.id);
        assert(moved, "下方 Holomen 已改變。 ");
        player.hand.push(moved);
      });
      addStageModifier(stageUnit, "arts", selected.length * 20, state.turn, "hSD13-017");
      appendLog(state, `${player.name} 將 ${selected.length} 張下方 Holomen 返回手牌；所選 Holomen 本回合 Arts +${selected.length * 20}。`);
    } else if (pending.effect === "fieldStaffFan") {
      if (selected.length > 0) enqueueEffect(state, { type: "attachArchivedSupport", playerIndex, cardId: selected[0].id, optional: false, genericTarget: true, prompt: "現場工作人員：直接按自己一位合法 Holomen 附加粉絲。", afterEffect: "fieldStaffHolomem" });
    } else if (pending.effect === "twoColorFirstSearch") {
      const second = player.mainDeck.filter((instance) => {
        const candidate = map.get(instance.number);
        return candidate?.stage === "1st" && !cardIsBuzz(candidate) && (candidate.colors || []).includes(pending.meta?.secondColor) && instance.id !== selected[0].id;
      });
      assert(second.length > 0, `牌庫沒有符合 ${pending.meta?.secondColor} 色的非 Buzz 1st Holomen。`);
      enqueueCardSelection(state, { playerIndex, cards: second, min: 1, max: 1, effect: "twoColorFinish", source: "deck", prompt: `雙色電腦：公開 1 張 ${pending.meta?.secondColor} 色非 Buzz 1st Holomen。`, meta: { firstId: selected[0].id } });
    } else if (pending.effect === "twoColorFinish") {
      [pending.meta?.firstId, selected[0]?.id].filter(Boolean).forEach((id) => {
        const moved = removeById(player.mainDeck, id);
        assert(moved, "雙色電腦所選卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 將兩張不同顏色的 1st Holomen 加入手牌並洗牌。`);
    } else if (pending.effect === "stackBottomOrder") {
      assert(selected.length === pending.cards.length, "需要為全部重疊 Holomen 決定次序。 ");
      player.mainDeck.push(...selected);
      if (pending.meta?.triggerStageReturn) queueStageReturnGiftEffects(state, playerIndex, selected, map);
      appendLog(state, `${player.name} 將 ${selected.length} 張重疊 Holomen 按次序放到牌庫底。`);
    } else if (pending.effect === "kfpDiscard") {
      selected.forEach((card) => {
        const moved = removeById(player.hand, card.id);
        assert(moved, "KFP 要存檔的手牌已改變。 ");
        player.archive.push(moved);
      });
      if (selected.length > 0) appendLog(state, `${player.name} 因 KFP 存檔 1 張手牌並抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    } else if (pending.effect === "archiveStageAttachment") {
      const option = (pending.meta?.attachmentOptions || []).find((candidate) => candidate.id === selected[0]?.id);
      const source = option && player.zones[option.zone];
      const moved = source && removeById(source.attachments, selected[0].id);
      assert(moved, "舞台上的石斧已改變。 ");
      player.archive.push(moved);
      appendLog(state, `${player.name} 將舞台上的石斧放到存檔區。`);
    } else if (pending.effect === "geowCheer") {
      const moved = removeById(player.cheerDeck, selected[0].id);
      assert(moved, "應援牌庫中的卡已改變。 ");
      enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: moved, shuffleAfter: true, prompt: "GEOW：直接按自己 1 位 Holomen 附加所選應援。" });
    } else if (pending.effect === "koFanTransferPick") {
      if (selected.length) state.effectQueue.unshift({type:"stageTarget",playerIndex,targetPlayerIndex:playerIndex,rule:pending.meta.targetRule,effect:"koFanTransferTarget",optional:false,prompt:"選擇同一位合法 Holomen，接收所選應援。",meta:{cardIds:selected.map(c=>c.id),fromDefeated:pending.meta.fromDefeated}});
    } else if (pending.effect === "koTransferCheer") {
      state.effectQueue.unshift(...selected.map((cheer) => ({ type: "attachArchiveCheerCard", playerIndex, cardId: cheer.id, targetRule: pending.meta?.targetRule || {}, fromDefeated: true, prompt: "倒下觸發：直接按自己另一位合法 Holomen 改附所選應援。" })));
    } else if (pending.effect === "ancientWeaponReturn") {
      if (selected.length > 0) {
        const cost = removeById(player.hand, selected[0].id);
        assert(cost, "要支付的手牌已改變。 ");
        player.archive.push(cost);
        const weapon = removeById(player.archive, pending.meta?.attachmentId);
        assert(weapon, "古代武器已離開存檔區。 ");
        player.hand.push(weapon);
        appendLog(state, `${player.name} 存檔 1 張手牌，將古代武器返回手牌。`);
      }
    } else if (pending.effect === "holoXSearch") {
      selected.forEach((card) => {
        const moved = removeById(player.mainDeck, card.id);
        assert(moved, "牌庫中的卡片已改變。 ");
        player.hand.push(moved);
      });
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, selected.length ? `${player.name} 公開 ${cardCodes(selected)} 加入手牌，並洗牌。` : `${player.name} 沒有從牌庫公開 Holomen；牌庫已洗牌。`, selected);
      const opponent = state.players[pending.meta?.opponentIndex ?? (playerIndex === 0 ? 1 : 0)];
      if (totalCheer(player) < totalCheer(opponent) && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: true, prompt: "自己的應援較少：可以按一位 Holomen，從應援牌庫附加 1 張應援。" });
    } else {
      throw new Error("這個卡片選擇效果尚未接入。 ");
    }
  } else if (pending.type === "stageTarget") {
    if (action.skip && pending.optional) {
      if (pending.effect === "genericMoveCheerTargetFirst") completeGenericCheerMove(state, playerIndex, pending.meta, map);
      if (pending.effect === "giftMoveLunaite") player.archive.push(pending.meta.attachment);
      appendLog(state, `${player.name} 略過可選的牌桌目標效果。`);
    } else {
      assert(pending.options.includes(action.zone), "牌桌目標已改變。 ");
      const targetPlayerIndex = Number.isInteger(pending.targetPlayerIndex) ? pending.targetPlayerIndex : playerIndex;
      const targetPlayer = state.players[targetPlayerIndex];
      const target = targetPlayer.zones[action.zone];
      if (pending.effect === "placeCard") {
        assert(!target && BACK_SLOTS.includes(action.zone), "所選後排位置已被佔用。 ");
        const sourceList = pending.meta?.source === "archive" ? player.archive : player.mainDeck;
        const moved = removeById(sourceList, pending.meta?.cardId);
        assert(moved, "要放到舞台的卡已改變。 ");
        player.zones[action.zone] = unit(moved, state.turn);
        appendLog(state, `${player.name} 將 ${map.get(moved.number)?.name || moved.number} 放到 ${action.zone}。`);
        queueStageEntryGiftEffects(state, playerIndex, action.zone, map.get(moved.number), map);
      } else {
        assert(target, "所選 Holomen 已離開舞台。 ");
      }
      if (pending.effect === "hSD10OverkillCheerTarget") {
        assert(targetPlayerIndex === playerIndex && BACK_SLOTS.includes(action.zone) && target, "超額傷害的後排目標已改變。 ");
        const amount = Math.min(Number(pending.meta?.amount || 0), player.cheerDeck.length);
        for (let index = 0; index < amount; index += 1) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [action.zone], optional: false, prompt: "超額傷害應援（" + (index + 1) + "/" + amount + "）：附加應援牌庫頂 1 張到同一位後排 Holomen。" });
      } else if (pending.effect === "erbGiftCheer") {
        assert(unitCard(target, map)?.number === "hSD13-005" && !usedNamedThisTurn(player, "gift:hSD13-005", state.turn), "Gift來源或本回合次數已改變。");
        const cheer = player.cheerDeck.shift();
        if (cheer) {
          attachCheerCards(state, target, [cheer]);
          markNamedUsage(player, "gift:hSD13-005", state.turn);
          appendLog(state, "For Justice! -ERB-：已向選定發動者附加應援。", [cheer]);
        }
      } else if (pending.effect === "swapCenter") {
        assert(targetPlayer.zones.center && BACK_SLOTS.includes(action.zone), "互換位置無效。 ");
        assert(matchingPlayerModifierBonus(targetPlayer, "movementLock", targetPlayer.zones.center, "center", map, state.turn) === 0, "中央 Holomen 目前不能移動或替換。 ");
        const center = targetPlayer.zones.center;
        targetPlayer.zones.center = target;
        targetPlayer.zones[action.zone] = center;
        appendLog(state, `${player.name} 將 ${targetPlayer.name} 的中央與所選後排 Holomen 互換。`);
      } else if (pending.effect === "collabDebloom") {
        assert(targetPlayerIndex !== playerIndex && BACK_SLOTS.includes(action.zone), "巻き戻し的目標無效。 ");
        const debutIndex = target.stack.findIndex((instance) => map.get(instance.number)?.stage === "Debut");
        assert(debutIndex >= 0 && target.stack.length > 1, "所選 Holomen 已不能變回 Debut。 ");
        const debut = target.stack[debutIndex];
        const returned = target.stack.filter((_, index) => index !== debutIndex);
        target.stack = [debut];
        target.damage = 0;
        target.bloomedTurn = 0;
        targetPlayer.hand.push(...returned);
        appendLog(state, `${targetPlayer.name} 的 ${unitCard(target, map)?.name || action.zone} 變回 Debut，${returned.length} 張其他重疊 Holomen 返回手牌。`);
      } else if (pending.effect === "setRemainingHp") {
        const remaining = Math.max(0, Number(pending.meta?.amount || 0));
        if (!jacketProtectsHp(state, target, targetPlayer, player, map)) target.damage = Math.max(0, stageMaximumHp(targetPlayer, action.zone, map) - remaining);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 的剩餘 HP 變為 ${stageRemainingHp(targetPlayer, action.zone, map)}。`);
      } else if (pending.effect === "knockOutNoLife") {
        assert(targetPlayerIndex !== playerIndex && BACK_SLOTS.includes(action.zone), "直接倒下效果的目標無效。 ");
        knockOutUnit(state, targetPlayerIndex, action.zone, map, playerIndex, { loseLife: false, sourceZone: pending.meta?.sourceZone || "" });
      } else if (pending.effect === "rest") {
        assert(!target.rested, "所選 Holomen 已經是休息狀態。 ");
        target.rested = true;
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 變為休息狀態。`);
      } else if (pending.effect === "returnBackDebutForCheer") {
        assert(targetPlayerIndex === playerIndex && BACK_SLOTS.includes(action.zone) && unitCard(target, map)?.stage === "Debut", "要放回牌庫底的後排 Debut 已改變。 ");
        targetPlayer.zones[action.zone] = null;
        const returned = [...target.stack];
        player.mainDeck.push(...returned);
        const archivedCheers = [...target.cheer];
        player.archive.push(...archivedCheers, ...(target.attachments || []));
        triggerCheerArchivedGift(state, playerIndex, map, archivedCheers.length);
        queueStageReturnGiftEffects(state, playerIndex, returned, map);
        appendLog(state, `${player.name} 將後排 Debut 放到牌庫底，應援及附加卡放到存檔區。`);
        if (player.cheerDeck.length > 0 && stageUnitCount(player) > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, prompt: "ハッピー☆パピー：直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
      } else if (["returnBackDebutThenSearch", "returnBackDebutDraw"].includes(pending.effect)) {
        assert(targetPlayerIndex === playerIndex && BACK_SLOTS.includes(action.zone) && unitCard(target, map)?.stage === "Debut", "後排 Debut 成本目標已改變。 ");
        targetPlayer.zones[action.zone] = null;
        const returned = [...target.stack];
        player.mainDeck.push(...returned);
        const archivedCheers = [...target.cheer];
        player.archive.push(...archivedCheers, ...(target.attachments || []));
        triggerCheerArchivedGift(state, playerIndex, map, archivedCheers.length);
        queueStageReturnGiftEffects(state, playerIndex, returned, map);
        if (pending.effect === "returnBackDebutThenSearch") queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st", "2nd"], excludeBuzz: true }, map, random, { min: 1, max: 1, optional: false, label: "Haaton Birthday" });
        else appendLog(state, `${player.name} 支付後抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
      } else if (pending.effect === "kroniiFirstTurnBloom") {
        const moved = removeById(player.hand, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        const targetCard = unitCard(target, map);
        assert(action.zone === "center" && moved && movedCard?.stage === "1st" && targetCard?.stage === "Debut" && cardHasName(targetCard, "オーロ・クロニー") && talentMatches(movedCard, targetCard) && Number(movedCard.hp || 0) > Number(target.damage || 0), "首回合 Ouro Kronii Bloom 的卡片或目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 以「這一天終於來了！」無視首回合限制，讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "koroneDownReceive") {
        const cheer = takeDefeatedCard(player, pending.meta.cheerId);
        assert(cheer, "倒下成員的應援已改變。");
        attachCheerCards(state, target, [cheer]);
        const cards = defeatedCardPool(player).filter(c => pending.meta.stackIds.includes(c.id));
        if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, effect: "archiveToHand", source: "archive", meta: { fromDefeated: true }, prompt: "選擇倒下成員重疊中的 1 張 Holomen 返回手牌。" });
      } else if (pending.effect === "fastForwardBloom") {
        const moved = player.hand.find(c => c.id === pending.meta.cardId);
        const card = moved && map.get(moved.number);
        assert(moved && fastForwardBloomTargets(player, card, map, state.turn).includes(action.zone), "早送り的 Bloom 目標已改變。");
        removeById(player.hand, moved.id);
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 以早送り讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, card, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "archiveBloom") {
        const moved = removeById(player.archive, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        const targetCard = unitCard(target, map);
        assert(moved && movedCard?.stage === "1st" && targetCard?.stage === "Debut" && cardHasTag(targetCard, "#ID2期生") && talentMatches(movedCard, targetCard) && Number(target.enteredTurn || 0) !== state.turn && Number(target.bloomedTurn || 0) !== state.turn && Number(movedCard.hp || 0) > Number(target.damage || 0), "限界化！！的卡片或牌桌目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        markNamedUsage(player, pending.meta?.usageKey || "bloom:hBP02-051", state.turn);
        appendLog(state, `${player.name} 以「限界化！！」從存檔區讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "giftReturnStageStack") {
        assert(targetPlayerIndex === playerIndex && BACK_SLOTS.includes(action.zone), "Gift 返回目標無效。 ");
        targetPlayer.zones[action.zone] = null;
        player.hand.push(...target.stack);
        player.archive.push(...(target.cheer || []), ...(target.attachments || []));
        triggerCheerArchivedGift(state, playerIndex, map, target.cheer?.length || 0);
        appendLog(state, `${player.name} 將 ${target.stack.length} 張 #FLOW GLOW 重疊 Holomen 返回手牌；其應援及附加卡放到存檔區。`);
      } else if (pending.effect === "giftFlareCheerTarget") {
        const source = player.zones[pending.meta?.sourceZone];
        assert(source && source.cheer.length >= 2 && BACK_SLOTS.includes(action.zone), "Colorful Stream 的來源或目標已改變。 ");
        const options = source.cheer.map((cheer) => ({ id: cheer.id, number: cheer.number, zone: pending.meta.sourceZone }));
        state.effectQueue.unshift({ type: "stageCheerSelection", playerIndex, ownerIndex: playerIndex, options: clone(options), rule: {}, min: 1, max: 1, prompt: "Colorful Stream：直接按攻擊者身上第 1 張實際應援。", effect: "giftMoveFlareCheer", optional: false, meta: { sourceZone: pending.meta.sourceZone, targetZone: action.zone, remaining: 2 } });
      } else if (pending.effect === "giftArchiveBloom") {
        const moved = removeById(player.archive, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        assert(moved && movedCard && bloomTargets(player, movedCard, map, state.turn).includes(action.zone), "光，再次點亮的 Bloom 目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 從存檔區讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "giftKroniiBloom") {
        const source = player.zones[pending.meta?.sourceZone];
        const moved = source && removeById(source.stack, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        assert(source && moved && movedCard && legalBloomStage(movedCard, unitCard(target, map)) && talentMatches(movedCard, unitCard(target, map)) && Number(target.enteredTurn || 0) !== state.turn && Number(target.bloomedTurn || 0) !== state.turn && Number(movedCard.hp || 0) > Number(target.damage || 0), "時界を統べし者的 Bloom 來源或目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 以「時界を統べし者」讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "oshiMarineStageBloom") {
        const moved = removeById(player.hand, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        const targetCard = unitCard(target, map);
        const allowedStages = movedCard?.stage === "1st" ? ["Debut", "1st"] : movedCard?.stage === "2nd" ? ["1st", "2nd"] : [];
        assert(targetPlayerIndex === playerIndex
          && action.zone === "center"
          && player.oshi?.number === "hEB01-002"
          && player.zones.collab
          && target
          && Number(target.bloomedTurn || 0) === state.turn
          && moved
          && movedCard?.group === "holomem"
          && (movedCard.colors || []).includes("藍")
          && cardHasName(movedCard, "宝鐘マリン")
          && cardHasName(targetCard, "宝鐘マリン")
          && allowedStages.includes(targetCard?.stage)
          && talentMatches(movedCard, targetCard)
          && Number(movedCard.hp || 0) > Number(target.damage || 0), "魔性の再演的手牌或中央 Bloom 目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 以「魔性の再演」讓 ${moved.number} 再次 Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "giftOverwriteBloom") {
        const source = player.zones[pending.meta?.sourceZone];
        const moved = removeById(player.hand, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        assert(source === target && unitCard(source, map)?.number === "hBP01-045" && moved && movedCard?.stage === "2nd" && cardHasName(movedCard, "AZKi") && Number(source.enteredTurn || 0) !== state.turn && Number(source.bloomedTurn || 0) !== state.turn && Number(movedCard.hp || 0) > Number(source.damage || 0), "Overwrite 的 2nd AZKi 或牌桌目標已改變。 ");
        source.stack.push(moved);
        source.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        appendLog(state, `${player.name} 以「Overwrite」無視 Bloom 等級，讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
      } else if (pending.effect === "giftMoveLunaite") {
        const attachment = pending.meta?.attachment;
        assert(attachment && BACK_SLOTS.includes(action.zone) && cardHasName(unitCard(target, map), "姫森ルーナ"), "ルーナイト的改附目標已改變。 ");
        target.attachments.push(attachment);
        appendLog(state, `${player.name} 以「みんなへ感謝の気持ち」將ルーナイト改附到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "hBP01-008SpecialDamage") {
        state.effectQueue.unshift({ type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount: pending.meta?.amount, loseLife: pending.meta?.loseLife, sourceCardNumber: pending.meta?.sourceCardNumber, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: pending.meta?.sourceZone || "", reactionsChecked: false });
      } else if (pending.effect === "specialDamage") {
        const effect = { type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount: pending.meta?.amount, loseLife: pending.meta?.loseLife, sourceCardNumber: pending.meta?.sourceCardNumber, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: pending.meta?.sourceZone || "", reactionsChecked: false };
        if (pending.meta?.beforeArts) state.effectQueue.unshift(effect);
        else enqueueEffect(state, effect);
      } else if (pending.effect === "oshiMarineSpecialDamage") {
        const remaining = Math.max(0, Number(pending.meta?.remaining || 1) - 1);
        const total = Number(pending.meta?.total || 1);
        const next = remaining > 0 ? {
          type: "stageTarget",
          playerIndex,
          targetPlayerIndex,
          options: null,
          rule: { zones: BACK_SLOTS, excludeStages: ["Debut"] },
          prompt: `Uh～ 刺激的すぎたかナ～？（${total - remaining + 1}/${total}）：直接按對手非 Debut 後排，造成 50 點特殊傷害。`,
          effect: "oshiMarineSpecialDamage",
          optional: false,
          meta: { ...clone(pending.meta), remaining },
        } : null;
        state.effectQueue.unshift(
          { type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount: pending.meta?.amount, loseLife: pending.meta?.loseLife, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: "", reactionsChecked: false },
          ...(next ? [next] : []),
        );
      } else if (pending.effect === "specialDamageEqualCurrentDamage") {
        const amount = Math.max(0, Number(target.damage || 0));
        if (amount > 0) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount, loseLife: pending.meta?.loseLife, sourceCardNumber: pending.meta?.sourceCardNumber, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: pending.meta?.sourceZone || "", reactionsChecked: false });
        else appendLog(state, `${unitCard(target, map)?.name || action.zone} 目前沒有傷害；${pending.meta?.sourceName || "效果"}造成 0 點特殊傷害。`);
      } else if (pending.effect === "cheerScaledArts") {
        const count = Math.min(Number(pending.meta?.maximum || 0), target.cheer.length);
        const amount = count * Number(pending.meta?.perCheer || 0);
        if (amount > 0) addStageModifier(target, "arts", amount, state.turn, pending.meta?.sourceNumber || "keyword");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 有 ${target.cheer.length} 張應援，本回合 Arts +${amount}。`);
      } else if (pending.effect === "healThenArtsChoice") {
        const healed = healStageUnit(state, targetPlayerIndex, action.zone, pending.meta?.heal, map);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP。`);
        enqueueStageTarget(state, { playerIndex, effect: "addModifier", prompt: "伴隨虛擬世界同行的歌姬：再直接按自己 1 位 Holomen，本回合 Arts +10。", meta: { kind: "arts", amount: 10, sourceNumber: pending.meta?.sourceNumber || "hBP07-066" } });
      } else if (pending.effect === "multiSpecialDamage") {
        const selectedZones = [...(pending.meta?.selectedZones || []), action.zone];
        const remaining = Math.max(0, Number(pending.meta?.remaining || 1) - 1);
        if (remaining > 0) {
          const options = stageOptionsMatching(targetPlayer, map, { zones: BACK_SLOTS }).filter((targetStageZone) => !selectedZones.includes(targetStageZone));
          if (options.length > 0) state.effectQueue.unshift({ type: "stageTarget", playerIndex, targetPlayerIndex, options, rule: { zones: BACK_SLOTS }, prompt: `${pending.meta?.sourceName || "卡牌效果"}：直接按下一位不同的後排，造成 ${pending.meta?.amount} 點特殊傷害。`, effect: "multiSpecialDamage", optional: false, meta: { ...clone(pending.meta), remaining: Math.min(remaining, options.length), selectedZones } });
        }
        state.effectQueue.unshift({ type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount: pending.meta?.amount, loseLife: pending.meta?.loseLife, sourceCardNumber: pending.meta?.sourceCardNumber, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: pending.meta?.sourceZone || "", reactionsChecked: false });
      } else if (pending.effect === "specialDamageThenOpponentDraw") {
        state.effectQueue.unshift(
          { type: "specialDamage", playerIndex, targetPlayerIndex, targetZone: action.zone, amount: pending.meta?.amount, loseLife: true, sourceCardNumber: pending.meta?.sourceCardNumber, sourceName: pending.meta?.sourceName || "卡牌效果", sourceZone: pending.meta?.sourceZone || "", reactionsChecked: false },
          { type: "drawPlayerCards", playerIndex: Number(pending.meta?.drawPlayerIndex), amount: 1, label: pending.meta?.sourceName || "卡牌效果" },
        );
      } else if (pending.effect === "akiParfaitBuff") {
        const targetCard = unitCard(target, map);
        assert(cardHasName(targetCard, "アキ・ローゼンタール") && (target.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool"), "ホロナツ大盛りパフェ的目標已改變。 ");
        const amount = cardIsBuzz(targetCard) || targetCard?.stage === "2nd" ? 50 : 20;
        addStageModifier(target, "arts", amount, state.turn, pending.meta?.sourceNumber || "hBP08-028");
        appendLog(state, `${targetCard?.name || action.zone} 因「ホロナツ大盛りパフェ」本回合 Arts +${amount}。`);
      } else if (pending.effect === "addModifier") {
        addStageModifier(target, pending.meta?.kind || "arts", pending.meta?.amount, state.turn, pending.meta?.sourceNumber || "support", { uses: pending.meta?.uses });
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 獲得本回合 ${pending.meta?.kind || "Arts"} ${Number(pending.meta?.amount || 0) >= 0 ? "+" : ""}${pending.meta?.amount} 修正。`);
        if (pending.meta?.after) state.effectQueue.unshift({ playerIndex, targetPlayerIndex: playerIndex, ...clone(pending.meta.after) });
      } else if (pending.effect === "artBuffTarget") {
        const amount = Number(pending.meta?.amount || 0);
        addStageModifier(target, "arts", amount, state.turn, pending.meta?.sourceNumber || "art");
        if (Number(pending.meta?.artCostReduction || 0) > 0) addStageModifier(target, "artCost", -Number(pending.meta.artCostReduction), state.turn, pending.meta?.sourceNumber || "art");
        if (action.zone === pending.meta?.sourceZone && amount > 0) adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, amount);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts +${amount}${pending.meta?.artCostReduction ? `、無色費用 -${pending.meta.artCostReduction}` : ""}。`);
      } else if (pending.effect === "unrest") {
        assert(target.rested, "所選 Holomen 已不是休息狀態。 ");
        if (pending.meta?.infiniteStamina) addStageModifier(target, "infiniteStamina", 1, state.turn, "hBP03-006");
        target.rested = false;
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 變為活動狀態。`);
      } else if (pending.effect === "nepolaboReceive") {
        const cheer = takeDefeatedCard(player, pending.meta.cheerId);
        assert(cheer, "存檔區應援已改變。");
        attachCheerCards(state, target, [cheer]);
        const targets = pending.meta.targets.filter(zone => zone !== action.zone);
        if (targets.length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "nepolaboCheer", meta: { targets }, prompt: "選擇下一張應援。" }, map);
      } else if (pending.effect === "flareParfaitBuff") {
        addStageModifier(target, "arts", target.cheer.length * 20, state.turn, "hBP07-085");
        if (action.zone === pending.meta.sourceZone) adjustQueuedArtsDamage(state, playerIndex, action.zone, target.cheer.length * 20);
      } else if (pending.effect === "shioriReceiveCheer") {
        const cheer = takeDefeatedCard(player, pending.meta.cheerId);
        assert(cheer, "存檔區應援已改變。");
        attachCheerCards(state, target, [cheer]);
        if (target.cheer.length >= 4 && cardHasName(map.get(player.oshi?.number), "シオリ・ノヴェラ")) adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, 100);
      } else if (pending.effect === "noelMuscleCost") {
        const card = unitCard(target, map);
        assert(cardHasTag(card, "#3期生"), "目標必須持有 #3期生。");
        const amount = card.stage === "2nd" && cardHasName(card, "白銀ノエル") ? 2 : 1;
        addStageModifier(target, "artCost", -amount, state.turn, "hBP07-022");
      } else if (pending.effect === "artRestBackRepeat") {
        const source = player.zones[pending.meta?.sourceZone];
        assert(BACK_SLOTS.includes(action.zone) && !target.rested && target.stack.length > 0 && unitCard(target, map)?.stage === "2nd" && cardHasName(unitCard(target, map), "ときのそら"), "休息成本目標已改變。 ");
        assert(source, "可重複使用 Arts 的來源已離開舞台。 ");
        target.rested = true;
        addStageModifier(source, "repeatArts", 1, state.turn, pending.meta?.sourceNumber || "hEB01-010", { uses: 1, artIndex: Number(pending.meta.artIndex) });
        source.rested = false;
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 變為休息狀態；攻擊者可再使用一次相同 Arts。`);
      } else if (pending.effect === "artAttackSecondBack") {
        assert(cardHasName(unitCard(target, map), "ときのそら"), "所選目標已不是ときのそら。 ");
        addStageModifier(target, "attackSecondBack", 1, state.turn, pending.meta?.sourceNumber || "hBP08-018");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合可用 Arts 指定對手後排 2nd Holomen。`);
      } else if (pending.effect === "artFoodCostReduction") {
        const amount = Math.max(0, Number(pending.meta?.amount || 0));
        addStageModifier(target, "artCost", -amount, state.turn, pending.meta?.sourceNumber || "hBP07-070");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts 無色費用 -${amount}。`);
      } else if (pending.effect === "swapCollab") {
        assert(targetPlayer.zones.collab && BACK_SLOTS.includes(action.zone), "合作與後排互換位置無效。 ");
        assert(matchingPlayerModifierBonus(targetPlayer, "movementLock", targetPlayer.zones.collab, "collab", map, state.turn) === 0, "合作 Holomen 目前不能移動或替換。 ");
        const collab = targetPlayer.zones.collab;
        targetPlayer.zones.collab = target;
        targetPlayer.zones[action.zone] = collab;
        queueCollabMoveGift(state, targetPlayerIndex, map);
        appendLog(state, `${targetPlayer.name} 將合作 Holomen 與所選後排 Holomen 互換。`);
      } else if (pending.effect === "oshiZetaBuff") {
        const targetCard = unitCard(target, map);
        const amount = cardIsBuzz(targetCard) && cardHasTag(targetCard, "#ID3期生") ? 80 : 50;
        addStageModifier(target, "arts", amount, state.turn, "hBP07-002");
        appendLog(state, `${targetCard?.name || action.zone} 本回合 Arts +${amount}。`);
      } else if (pending.effect === "oshiIrysBuff") {
        const hasPurple = target.cheer.some((instance) => effectiveCheerColors(targetPlayer, target, instance, map).includes("紫"));
        const amount = hasPurple ? 50 : 20;
        addStageModifier(target, "arts", amount, state.turn, "hBP08-001");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts +${amount}。`);
      } else if (pending.effect === "oshiHaatoBottom") {
        assert(BACK_SLOTS.includes(action.zone) && unitCard(target, map)?.stage === "Debut" && cardHasName(unitCard(target, map), "赤井はあと"), "所選後排已不是 Debut 赤井はあと。 ");
        targetPlayer.zones[action.zone] = null;
        const returned = [...target.stack];
        player.mainDeck.push(...returned);
        player.archive.push(...target.cheer, ...(target.attachments || []));
        triggerCheerArchivedGift(state, playerIndex, map, target.cheer.length);
        queueStageReturnGiftEffects(state, playerIndex, returned, map);
        const options = stageOptionsMatching(player, map, { names: ["赤井はあと", "赤井心"] });
        if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "世界級的最強偶像！：直接按 1 位赤井はあと，本回合 Arts +50。", meta: { kind: "arts", amount: 50, sourceNumber: "hBP07-004" } });
      } else if (pending.effect === "oshiBloom") {
        const sourceList = pending.meta?.source === "archive" ? player.archive : pending.meta?.source === "deck" ? player.mainDeck : player.hand;
        const moved = removeById(sourceList, pending.meta?.cardId);
        const movedCard = moved && map.get(moved.number);
        assert(moved && movedCard && legalBloomStage(movedCard, unitCard(target, map)) && talentMatches(movedCard, unitCard(target, map)) && Number(movedCard.hp || 0) > Number(target.damage || 0), "Bloom 卡片或目標已改變。 ");
        target.stack.push(moved);
        target.bloomedTurn = state.turn;
        currentTurnEvents(player, state.turn).bloomCount += 1;
        if (pending.meta?.artCostReduction) addStageModifier(target, "artCost", -Number(pending.meta.artCostReduction), state.turn, player.oshi?.number || "oshi");
        if (pending.meta?.source === "deck") player.mainDeck = shuffle(player.mainDeck, random);
        appendLog(state, `${player.name} 以推し技能讓 ${moved.number} Bloom。`, [moved]);
        queueBloomEffects(state, playerIndex, action.zone, movedCard, map, random);
        queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
        if (pending.meta?.fullHealOllie && movedCard.number === "hBP04-061") {
          const options = stageOptionsMatching(player, map, { names: ["クレイジー・オリー", "Kureiji Ollie"], damaged: true });
          if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "healFull", prompt: "オリーを見てください！：直接按自己 1 位受傷的 Kureiji Ollie，完全回復 HP。" });
        }
      } else if (pending.effect === "oshiArchiveCheerFixedTarget") {
        const cheers = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
        const max = Math.min(Number(pending.meta?.max || 1), cheers.length);
        if (max > 0) enqueueCardSelection(state, { playerIndex, cards: cheers, min: pending.meta?.min ?? 1, max, effect: "archiveCheerToStage", source: "archive", prompt: `揀 ${pending.meta?.min ?? 1}–${max} 張存檔區應援，會依次附加到已選 Holomen。`, meta: { targetZone: action.zone, targetRule: { zones: [action.zone] } } });
      } else if (pending.effect === "oshiAllColors") {
        addStageModifier(target, "allColors", 1, state.turn, "hBP08-006");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合視為擁有所有顏色。`);
      } else if (pending.effect === "oshiKanataSpBuff") {
        const amount = (unitCard(target, map)?.colors || []).includes("白") ? 100 : 50;
        addStageModifier(target, "arts", amount, state.turn, "hBP01-001");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts +${amount}。`);
      } else if (pending.effect === "oshiRepeatArts") {
        addStageModifier(target, "repeatArts", 1, state.turn, "hBP02-007", { uses: 1 });
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合可再使用一次相同 Arts。`);
      } else if (pending.effect === "oshiAttackBack") {
        addStageModifier(target, "attackBack", 1, state.turn, "hBP03-004");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts 可指定對手後排。`);
      } else if (pending.effect === "attackDamagedBack") {
        addStageModifier(target, "attackDamagedBack", 1, state.turn, "hBP07-086");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts 可指定已受傷的對手後排。`);
      } else if (pending.effect === "allColorsFirst") {
        addStageModifier(target, "allColors", 1, state.turn, pending.meta?.sourceNumber || "hBP08-073");
        const options = stageOptions(targetPlayer).filter((zone) => zone !== action.zone);
        assert(options.length > 0, "第 2 位所有顏色目標已改變。 ");
        enqueueStageTarget(state, { playerIndex, targetPlayerIndex, options, effect: "allColorsSecond", prompt: "再按對手第 2 位 Holomen，本回合視為持有所有顏色。", meta: pending.meta || {} });
      } else if (pending.effect === "allColorsSecond") {
        addStageModifier(target, "allColors", 1, state.turn, pending.meta?.sourceNumber || "hBP08-073");
        appendLog(state, `${targetPlayer.name} 的兩位 Holomen 本回合視為持有所有顏色。`);
      } else if (pending.effect === "oshiLamySp") {
        addStageModifier(target, "specialDamage", 100, state.turn, "hBP04-004");
        addStageModifier(target, "drawOnSpecialKO", 2, state.turn, "hBP04-004");
      } else if (pending.effect === "oshiFreeArts") {
        addStageModifier(target, "freeArts", 1, state.turn, "hBP04-005");
      } else if (pending.effect === "oshiOkayuSwap") {
        assert(BACK_SLOTS.includes(action.zone) && targetPlayer.zones.center, "對手互換目標已改變。 ");
        assert(matchingPlayerModifierBonus(targetPlayer, "movementLock", targetPlayer.zones.center, "center", map, state.turn) === 0, "對手中央 Holomen 目前不能移動或替換。 ");
        const center = targetPlayer.zones.center;
        targetPlayer.zones.center = target;
        targetPlayer.zones[action.zone] = center;
        if (cardHasName(unitCard(player.zones.center, map), "猫又おかゆ")) appendLog(state, `${player.name} 再抽 ${drawCards(state, playerIndex, 3)} 張牌。`);
      } else if (pending.effect === "oshiStarterSwap") {
        assert(BACK_SLOTS.includes(action.zone) && targetPlayer.zones.center, "對手互換目標已改變。 ");
        assert(matchingPlayerModifierBonus(targetPlayer, "movementLock", targetPlayer.zones.center, "center", map, state.turn) === 0, "對手中央 Holomen 目前不能移動或替換。 ");
        [targetPlayer.zones.center, targetPlayer.zones[action.zone]] = [target, targetPlayer.zones.center];
        if (player.zones.center && (unitCard(player.zones.center, map)?.colors || []).includes("白")) addStageModifier(player.zones.center, "arts", 50, state.turn, "hSD01-001");
      } else if (pending.effect === "oshiStarterOwnSwap") {
        assert(BACK_SLOTS.includes(action.zone) && player.zones.center && !target.rested, "自己的互換目標已改變。 ");
        const oldCenter = player.zones.center;
        player.zones.center = target;
        player.zones[action.zone] = oldCenter;
        const healed = healStageUnit(state, playerIndex, action.zone, 30, map);
        appendLog(state, `${unitCard(oldCenter, map)?.name || "原中央 Holomen"} 移到後排並回復 ${healed} HP。`);
      } else if (pending.effect === "oshiFlareCheerTarget") {
        const options = stageCheerOptions(player, map).filter((candidate) => candidate.zone !== action.zone);
        assert(options.length > 0, "其他 Holomen 身上沒有可移到不知火フレア的應援。 ");
        enqueueStageCheerSelection(state, { playerIndex, options, effect: "oshiMoveCheerToFlare", prompt: "直接按要改附到不知火フレア的實際應援；最少 1 張、最多 5 張。", meta: { targetZone: action.zone, remaining: 5, moved: 0 } });
      } else if (pending.effect === "oshiZetaAttachTarget") {
        const supports = player.archive.filter((instance) => ["supportMascot", "supportFan"].includes(map.get(instance.number)?.typeCode));
        if (supports.length > 0) enqueueCardSelection(state, { playerIndex, cards: supports, min: 0, max: supports.length, optional: true, effect: "oshiZetaSupports", source: "archive", prompt: "揀任意張存檔區吉祥物／粉絲附加到已選 #ID3期生。", meta: { targetZone: action.zone } });
      } else if (pending.effect === "oshiFlowGlowBuff") {
        const amount = target.cheer.length * 20;
        addStageModifier(target, "arts", amount, state.turn, "hSD10-001");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 有 ${target.cheer.length} 張應援，本回合 Arts +${amount}。`);
      } else if (pending.effect === "oshiKanadeSwap") {
        assert(BACK_SLOTS.includes(action.zone) && player.zones.center, "奏出的旋律互換目標已改變。 ");
        const center = player.zones.center;
        player.zones.center = target;
        player.zones[action.zone] = center;
        player.oshiSkillTurn = state.turn;
        appendLog(state, `${player.name} 使用「奏出的旋律」互換中央與 #ReGLOSS 後排。`);
      } else if (pending.effect === "oshiMoveCheerTarget") {
        const source = player.zones[pending.meta?.sourceZone];
        const cheer = source && removeById(source.cheer, pending.meta?.cheerId);
        assert(cheer, "要移動的應援已改變。 ");
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將 1 張應援改附到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "healAndModifier") {
        addStageModifier(target, pending.meta?.kind || "batonCost", pending.meta?.amount, state.turn, "support");
        const healed = healStageUnit(state, targetPlayerIndex, action.zone, pending.meta?.heal, map);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP，並獲得接力費用修正。`);
      } else if (pending.effect === "heal") {
        const healed = jacketProtectsHp(state, target, targetPlayer, player, map) ? 0 : healStageUnit(state, targetPlayerIndex, action.zone, pending.meta?.amount, map);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP。`);
      } else if (pending.effect === "healFull") {
        const healed = jacketProtectsHp(state, target, targetPlayer, player, map) ? 0 : Number(target.damage || 0);
        target.damage -= healed;
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 完全回復 ${healed} HP。`);
      } else if (pending.effect === "healBackThenDamage") {
        assert(targetPlayerIndex === playerIndex && BACK_SLOTS.includes(action.zone), "回復的後排目標已改變。 ");
        const healed = healStageUnit(state, playerIndex, action.zone, 50, map);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP。`);
        const opponentIndex = Number(pending.meta?.opponentIndex);
        if (healed > 0 && state.players[opponentIndex]?.zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: healed, loseLife: true, sourceName: "惡魔的護理", sourceZone: pending.meta?.sourceZone || "" });
      } else if (pending.effect === "twoColorFirst") {
        const firstColor = unitCard(target, map)?.colors?.[0];
        const options = stageOptionsMatching(player, map, { monoColor: true }).filter((zone) => zone !== action.zone && unitCard(player.zones[zone], map)?.colors?.[0] !== firstColor);
        assert(options.length > 0, "另一個不同單色的目標已不存在。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "twoColorSecond", prompt: "再按第 2 位不同顏色的單色 Holomen。", meta: { firstColor } });
      } else if (pending.effect === "twoColorSecond") {
        const colors = [pending.meta?.firstColor, unitCard(target, map)?.colors?.[0]].filter(Boolean);
        const first = player.mainDeck.filter((instance) => {
          const candidate = map.get(instance.number);
          return candidate?.stage === "1st" && !cardIsBuzz(candidate) && (candidate.colors || []).includes(colors[0]);
        });
        assert(first.length > 0, `牌庫沒有符合 ${colors[0]} 色的非 Buzz 1st Holomen。`);
        enqueueCardSelection(state, { playerIndex, cards: first, min: 1, max: 1, effect: "twoColorFirstSearch", source: "deck", prompt: `雙色電腦：公開 1 張 ${colors[0]} 色非 Buzz 1st Holomen。`, meta: { secondColor: colors[1] } });
      } else if (pending.effect === "maitakeTarget") {
        const options = stageCheerOptions(player, map).filter((option) => option.zone !== action.zone);
        if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, min: 1, max: 1, effect: "moveSelectedCheerToZone", optional: true, prompt: "可直接按舞台上 1 張實際應援，改附到所選儒烏風亭らでん（最多 2 張）。", meta: { targetZone: action.zone, remaining: 2, after: "maitakeBonus" } });
        else if (target.cheer.length >= 3) addStageModifier(target, "arts", 10, state.turn, "hBP04-094");
      } else if (pending.effect === "restMoveBack") {
        const destination = BACK_SLOTS.find((zone) => !targetPlayer.zones[zone]);
        assert(destination, "對手後排已沒有空位。 ");
        targetPlayer.zones[action.zone] = null;
        targetPlayer.zones[destination] = target;
        target.rested = true;
        target.skipUnrestTurn = state.turn + 1;
        target.returnSlot = null;
        appendLog(state, `${targetPlayer.name} 的 ${unitCard(target, map)?.name || action.zone} 移到後排並休息；下次重置仍保持休息。`);
      } else if (pending.effect === "multilingualCheer") {
        queueCheerDeckSearch(state,playerIndex,"從應援牌庫公開1張應援",action.zone,map,random,{optional:false,colorsOverride:unitCard(target,map)?.colors || [],targetRuleOverride:{zones:[action.zone]}});      } else if (pending.effect === "koyoriLabBuff") {
        const lab = target.attachments.some(instance => map.get(instance.number)?.group === "support" && cardHasTag(map.get(instance.number), "#こよラボ"));
        addStageModifier(target, "arts", lab ? 50 : 30, state.turn, "hBP06-021");      } else if (pending.effect === "fitnessModifier") {
        const amount = cardIsBuzz(unitCard(target, map)) || unitCard(target, map)?.stage === "2nd" ? 50 : 20;
        addStageModifier(target, "arts", amount, state.turn, "hBP06-094");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts +${amount}。`);
      } else if (pending.effect === "lambduckFirst") {
        const options = stageOptionsMatching(player, map, { names: ["大空スバル", "大空昴"] }).filter((zone) => zone !== action.zone);
        assert(options.length > 0, "舞台上的大空スバル已改變。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "lambduckSecond", prompt: "再按 1 位大空スバル。", meta: { firstZone: action.zone } });
      } else if (pending.effect === "lambduckSecond") {
        const zones = [pending.meta?.firstZone, action.zone];
        zones.forEach((zone) => addStageModifier(player.zones[zone], "arts", 20, state.turn, "hBP06-096"));
        zones.forEach((zone, index) => enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetZone: zone, targetRule: { zones: [zone] }, prompt: `兩人合體 Lambduck！（${index + 1}/2）：可揀 1 張存檔區應援；會直接附加到已選 Holomen。` }, map));
      } else if (pending.effect === "stackToBottom") {
        const cards = [...target.stack];
        target.stack = [];
        const archivedCheers = target.cheer.splice(0);
        player.archive.push(...archivedCheers, ...target.attachments.splice(0));
        player.zones[action.zone] = null;
        triggerCheerArchivedGift(state, playerIndex, map, archivedCheers.length);
        enqueueCardSelection(state, { playerIndex, cards, min: cards.length, max: cards.length, effect: "stackBottomOrder", source: "revealed", prompt: "按次序將所選赤井はあと的重疊 Holomen 放到牌庫底。", meta: { triggerStageReturn: true } });
      } else if (pending.effect === "watermelonTarget") {
        addStageModifier(target, "arts", 30, state.turn, "hEB01-028");
        addStageModifier(target, "drawOnArtsKnockout", 2, state.turn, "hEB01-028");
      } else if (pending.effect === "richChocolaTarget") {
        const healed = healStageUnit(state, playerIndex, action.zone, 20, map);
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP。`);
        const foodEvents = player.archive.filter((instance) => map.get(instance.number)?.group === "support" && map.get(instance.number)?.typeCode?.includes("Event") && (cardHasTag(map.get(instance.number), "#食べ物") || cardHasTag(map.get(instance.number), "#食物"))).length;
        if (foodEvents >= 2) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetZone: action.zone, targetRule: { zones: [action.zone] }, prompt: "條件成立：可揀 1 張存檔區應援，附加到剛才的 Holomen。" }, map);
      } else if (pending.effect === "justiceTarget") {
        const cards = target.stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem");
        enqueueCardSelection(state, { playerIndex, cards, min: 1, max: Math.min(2, cards.length), effect: "justiceUndercards", source: "stack", prompt: "揀 1–2 張疊在下方的 Holomen 返回手牌。", meta: { zone: action.zone } });
      } else if (pending.effect === "matsutakeTarget") {
        const amount = target.cheer.length >= 3 ? 20 : 10;
        addStageModifier(target, "arts", amount, state.turn, "hSD15-010");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 本回合 Arts +${amount}。`);
      } else if (pending.effect === "chocoOmeletteTarget") {
        const healed = healStageUnit(state, playerIndex, action.zone, 20, map);
        if (stageEntries(player).some(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#料理"))) addStageModifier(target, "arts", 20, state.turn, "hSD04-013");
        appendLog(state, `${unitCard(target, map)?.name || action.zone} 回復 ${healed} HP${stageEntries(player).some(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#料理")) ? "，本回合 Arts +20" : ""}。`);
      } else if (pending.effect === "moveAttachment") {
        const source = player.zones[pending.meta?.sourceZone];
        const moved = source && removeById(source.attachments, source.attachments.find((instance) => instance.number === pending.meta?.attachmentNumber)?.id);
        assert(moved, "要移動的附加卡已改變。 ");
        target.attachments.push(moved);
        appendLog(state, `${player.name} 將 ${map.get(moved.number)?.name || moved.number} 移到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "boundaryTransferTarget") {
        assert(cardHasName(unitCard(target, map), pending.meta.targetName), "請選擇指定成員。 ");
        const sourceZone = pending.meta.sourceZone;
        const options = stageCheerOptions(player, map, { colors: [pending.meta.color], stage: { zones: [sourceZone] } }).filter(option => option.zone !== action.zone);
        if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "boundaryTransferCheer", optional: true, prompt: `選擇此攻擊者的${pending.meta.color}色應援，改附到已選成員；可略過完成。`, meta: { ...pending.meta, targetZone: action.zone } });
      } else if (pending.effect === "genericReceiveMovedCheer") {
        const cheer = pending.meta?.cheer;
        assert(cheer, "要改附的應援已改變。 ");
        if (pending.meta?.moveMeta?.maxCheerFromEffect) {
          const marker = `cheerMoveBatch:${pending.meta.moveMeta.effectBatch || "generic"}`;
          assert(activeModifiers(target, marker, state.turn).length < Number(pending.meta.moveMeta.maxCheerFromEffect), "這位 Holomen 已收到此效果允許的最多應援。 ");
          addStageModifier(target, marker, 0, state.turn, pending.meta.moveMeta.cardNumber || "art");
        }
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將 1 張應援改附到 ${unitCard(target, map)?.name || action.zone}。`);
        const remaining = Number(pending.meta?.remaining || 0);
        const moveMeta = { ...(pending.meta?.moveMeta || {}), remaining, movedIds: [...(pending.meta?.moveMeta?.movedIds || []), cheer.id] };
        const options = stageCheerOptions(player, map).filter((candidate) => !moveMeta.movedIds.includes(candidate.id) && (!moveMeta.targetZone || candidate.zone !== moveMeta.targetZone) && (!moveMeta.sourceOnlyZone || candidate.zone === moveMeta.sourceOnlyZone));
        if (remaining > 0 && options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericMoveCheer", optional: !(moveMeta.minimumMoved > moveMeta.movedIds.length), prompt: "繼續選擇應援完成轉移。", meta: moveMeta });
        else completeGenericCheerMove(state, playerIndex, moveMeta, map);
      } else if (pending.effect === "genericMoveCheerTargetFirst") {
        const moveMeta = { ...(pending.meta || {}), targetZone: action.zone, targetRule: { zones: [action.zone] } };
        const options = stageCheerOptions(player, map).filter((candidate) => candidate.zone !== action.zone && (!moveMeta.sourceOnlyZone || candidate.zone === moveMeta.sourceOnlyZone));
        if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericMoveCheer", optional: true, prompt: "直接按要改附到已選 Holomen 的實際應援；可略過完成。", meta: { ...moveMeta, remaining: Math.min(Number(moveMeta.remaining || 1), options.length) } });
        else completeGenericCheerMove(state, playerIndex, moveMeta, map);
      } else if (pending.effect === "genericReceiveMovedAttachment") {
        const attachment = pending.meta?.attachment;
        assert(attachment, "要改附的附加卡已改變。 ");
        assert(attachmentTargets(player, map.get(attachment.number), map).includes(action.zone), "所選 Holomen 不能附加此卡。");
        target.attachments.push(attachment);
        appendLog(state, `${player.name} 將 ${map.get(attachment.number)?.name || attachment.number} 改附到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "opponentReceiveMovedCheer") {
        const cheer = pending.meta?.cheer;
        assert(targetPlayerIndex !== playerIndex && cheer, "對手應援的改附目標已改變。 ");
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將對手 1 張應援改附到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "attachOpponentArchiveCheer") {
        const ownerIndex = Number(pending.meta?.ownerIndex);
        const owner = state.players[ownerIndex];
        const cheer = owner && removeById(owner.archive, pending.meta?.cheerId);
        assert(owner && owner === targetPlayer && cheer && map.get(cheer.number)?.group === "cheer", "對手存檔區應援或附加目標已改變。 ");
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將 ${owner.name} 存檔區的 1 張應援附加到 ${unitCard(target, map)?.name || action.zone}。`);
      } else if (pending.effect === "koFanTransferTarget") {
        const cheers=pending.meta.cardIds.map(id=>(pending.meta.fromDefeated ? defeatedCardPool(player) : player.archive).find(c=>c.id===id));
        assert(cheers.every(Boolean),"所選應援已離開存檔區。");
        cheers.forEach(cheer=>pending.meta.fromDefeated ? takeDefeatedCard(player,cheer.id) : removeById(player.archive,cheer.id));
        attachCheerCards(state,target,cheers);
        appendLog(state,player.name+" 將 "+cheers.length+" 張應援改附到同一位 Holomen。",cheers);
      } else if (pending.effect === "frontierCheerAttach") {
        const cheer = removeById(player.archive, pending.meta.cardId);
        assert(cheer, "存檔區應援已改變。");
        attachCheerCards(state, target, [cheer]);
        queueFrontierCheer(state, playerIndex, pending.meta.remaining - 1, map);
      } else if (pending.effect === "archiveCheerOneRecipient") {
        const cheers = pending.meta.cardIds.map(cardId => removeById(player.archive, cardId)); assert(cheers.every(Boolean), "存檔區應援已改變。"); attachCheerCards(state, target, cheers);
      } else if (pending.effect === "attachArchiveCheer") {
        const cheer = pending.meta?.fromDefeated ? takeDefeatedCard(player, pending.meta.cardId) : removeById(player.archive, pending.meta?.cardId);
        assert(cheer, "存檔區應援已改變。 ");
        if (pending.meta?.targetZone) assert(action.zone === pending.meta.targetZone, "應援目標無效。 ");
        if (pending.meta?.maxCheerFromEffect) {
          const marker = `cheerBatch:${pending.meta.effectBatch || "generic"}`;
          const received = activeModifiers(target, marker, state.turn).length;
          assert(received < Number(pending.meta.maxCheerFromEffect), "這位 Holomen 已從此效果收到最多數量的應援。 ");
          addStageModifier(target, marker, 0, state.turn, "support");
        }
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將存檔區的應援附加到 ${unitCard(target, map)?.name || action.zone}。`);
      }
    }
  } else if (pending.type === "stageCheerSelection") {
    if (action.skip && pending.optional) {
      if (pending.meta?.after === "maitakeBonus") {
        const target = player.zones[pending.meta.targetZone];
        if (target?.cheer.length >= 3) addStageModifier(target, "arts", 10, state.turn, "hBP04-094");
      }
      if (pending.effect === "oshiMoveCheerToFlare") {
        const amount = Number(player.zones.center?.cheer.length || 0) * 10;
        addPlayerModifier(player, "arts", amount, state.turn, "hBP05-007", {});
        appendLog(state, `${player.name} 的全舞台 Holomen 本回合 Arts +${amount}。`);
      }
      if (pending.effect === "artArchiveCheerCost" && Number(pending.meta?.paid || 0) > 0) completeArtCheerCost(state, playerIndex, pending.meta, map, random);
      if (pending.effect === "genericMoveCheer") completeGenericCheerMove(state, playerIndex, pending.meta, map);
      appendLog(state, `${player.name} 略過其餘應援選擇。`);
    } else {
      const option = pending.cheerOptions?.find((candidate) => candidate.id === action.cheerId);
      const ownerIndex = Number.isInteger(pending.ownerIndex) ? pending.ownerIndex : playerIndex;
      const owner = state.players[ownerIndex];
      const source = option && owner.zones[option.zone];
      assert(option && source, "所選實際應援已改變。 ");
      const cheer = option.cheerSubstitute && pending.effect === "genericKeywordCheerCost" ? removeById(source.attachments, option.id) : removeById(source.cheer, option.id);
      assert(cheer, "找不到所選應援。 ");
      if (pending.effect === "boundaryTransferCheer") {
        const target = player.zones[pending.meta.targetZone];
        assert(option.zone === pending.meta.sourceZone && target && cardHasName(unitCard(target, map), pending.meta.targetName) && effectiveCheerColors(player, source, cheer, map).includes(pending.meta.color), "應援或接收者已改變。 ");
        attachCheerCards(state, target, [cheer]);
        appendLog(state, `${player.name} 將攻擊者的 1 張${pending.meta.color}色應援改附到 ${pending.meta.targetName}。`);
        const options = stageCheerOptions(player, map, { colors: [pending.meta.color], stage: { zones: [pending.meta.sourceZone] } }).filter(candidate => candidate.zone !== pending.meta.targetZone);
        if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: pending.effect, optional: true, prompt: pending.prompt, meta: pending.meta });
      } else if (pending.effect === "opponentMoveCheerSource") {
        const targetOptions = stageOptions(owner).filter((targetZone) => targetZone !== option.zone);
        if (targetOptions.length === 0) source.cheer.push(cheer);
        else enqueueStageTarget(state, { playerIndex, targetPlayerIndex: ownerIndex, options: targetOptions, effect: "opponentReceiveMovedCheer", prompt: "直接按對手另一位 Holomen，改附所選應援。", meta: { cheer } });
      } else if (pending.effect === "opponentCheerBottom") {
        owner.cheerDeck.push(cheer);
        appendLog(state, `${owner.name} 將所選舞台應援放回應援牌庫底。`);
      } else if (pending.effect === "cheerCostThenDeckSearch") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        queueDeckToHand(state, playerIndex, pending.meta?.rule || {}, map, random, { min: 1, max: 1, optional: false, label: pending.meta?.label || "卡牌效果" });
      } else if (pending.effect === "cheerBottomThenSearch") {
        owner.cheerDeck.push(cheer);
        enqueueCardSelection(state, { playerIndex, cards: player.cheerDeck, min: 1, max: 1, optional: false, effect: "raoraCheerSearch", source: "cheerDeck", prompt: "正義の諧調：公開1張應援，附加到自己成員後洗牌。" });
      } else if (pending.effect === "fuburaCheerCost") {
        const skillSource = owner.zones[pending.meta?.sourceZone];
        const attachment = skillSource?.attachments?.find((instance) => instance.id === pending.meta?.attachmentId && instance.number === "hBP02-092");
        assert(option.zone === pending.meta?.sourceZone && skillSource && topCard(skillSource)?.id === pending.meta?.sourceId && attachment && cardHasName(unitCard(skillSource, map), "白上フブキ"), "Fubura 的發動來源已改變。 ");
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        const remaining = Number(pending.meta?.remaining || 2) - 1;
        appendLog(state, `${owner.name} 將 Fubura 所在 Holomen 的 1 張應援放到存檔區。`);
        if (remaining > 0) {
          const options = stageCheerOptions(owner, map).filter((candidate) => candidate.zone === pending.meta.sourceZone);
          assert(options.length >= remaining, "Fubura 的餘下應援成本不足。 ");
          enqueueStageCheerSelection(state, { playerIndex, ownerIndex, options, effect: pending.effect, optional: false, prompt: `Fubura：再按 ${remaining} 張同一位 Holomen 的應援完成成本。`, meta: { ...pending.meta, remaining } });
        } else {
          markNamedUsage(owner, pending.meta.usageKey, state.turn);
          addStageModifier(skillSource, "arts", 50, state.turn, "hBP02-092");
          appendLog(state, `${owner.name} 支付 2 張應援；該白上フブキ本回合 Arts +50。`);
        }
      } else if (pending.effect === "backCheerCostDamage") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        markNamedUsage(player, pending.meta?.usageKey || "bloom:hBP03-019", state.turn);
        enqueueStageTarget(state, { playerIndex, targetPlayerIndex: pending.meta?.opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "直接按對手中央或合作 Holomen，造成 30 點特殊傷害。", meta: { amount: 30, loseLife: true, sourceName: "歌う事は楽しい事", sourceZone: pending.meta?.sourceZone || "" } });
      } else if (pending.effect === "idCheerCostSplitDamage") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        queueHbp01Oshi008Trigger(state, ownerIndex, pending.meta?.sourceZone, map);
        for (let index = 0; index < 3; index += 1) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: pending.meta?.opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", prompt: `分配特殊傷害（${index + 1}/3）：直接按對手 1 位後排，造成 10 點特殊傷害。`, meta: { amount: 10, loseLife: false, sourceName: "水之藝術", sourceZone: pending.meta?.sourceZone || "" } });
      } else if (pending.effect === "hSD12-011-archive") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        appendLog(state, player.name + " 將舞台 1 張應援放到存檔區。");
        const targets = stageOptions(player);
        if (targets.length > 0) enqueueStageTarget(state, { playerIndex, options: targets, effect: "addModifier", optional: false, prompt: "The Wise One：選擇 1 位自己的 Holomen，本回合 Arts +40。", meta: { kind: "arts", amount: 40, sourceNumber: "hSD12-011" } });
      } else if (pending.effect === "archiveCheerThenDrawTwo") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        appendLog(state, `${player.name} 支付紅色應援並抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
      } else if (pending.effect === "cheerBottomToIrys") {
        owner.cheerDeck.push(cheer);
        const options = stageOptionsMatching(player, map, { names: ["IRyS"] });
        if (options.length > 0 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: "直接按自己 1 位 IRyS，附加應援牌庫頂 1 張。" });
      } else if (pending.effect === "genericMoveCheer") {
        const remaining = Math.max(0, Number(pending.meta?.remaining || 1) - 1);
        const movedIds = [...(pending.meta?.movedIds || []), cheer.id];
        if (pending.meta?.targetZone) {
          const target = player.zones[pending.meta.targetZone];
          assert(target, "應援改附目標已離開舞台。 ");
          attachCheerCards(state, target, [cheer]);
          appendLog(state, `${player.name} 將 1 張應援改附到 ${unitCard(target, map)?.name || pending.meta.targetZone}。`);
          const options = stageCheerOptions(player, map).filter((candidate) => candidate.zone !== pending.meta.targetZone && !movedIds.includes(candidate.id));
          if (remaining > 0 && options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: pending.effect, optional: true, prompt: pending.prompt, meta: { ...pending.meta, remaining, movedIds } });
          else completeGenericCheerMove(state, playerIndex, { ...pending.meta, remaining, movedIds }, map);
        } else {
          const targetOptions = stageOptionsMatching(player, map, pending.meta?.targetRule || {}).filter((targetZone) => {
            if (pending.meta?.excludeSourceCard && targetZone === option.zone) return false;
            if (!pending.meta?.maxCheerFromEffect) return true;
            const marker = `cheerMoveBatch:${pending.meta.effectBatch || "generic"}`;
            return activeModifiers(player.zones[targetZone], marker, state.turn).length < Number(pending.meta.maxCheerFromEffect);
          });
          if (targetOptions.length === 0) {
            source.cheer.push(cheer);
            completeGenericCheerMove(state, playerIndex, { ...pending.meta, remaining, movedIds: pending.meta?.movedIds || [] }, map);
          } else enqueueStageTarget(state, {
            playerIndex,
            options: targetOptions,
            effect: "genericReceiveMovedCheer",
            prompt: "直接按牌桌上的 Holomen，改附所選應援。",
            meta: { cheer, remaining, moveMeta: { ...pending.meta, remaining, movedIds: pending.meta?.movedIds || [] } },
          });
        }
      } else if (pending.effect === "oshiMoveCheerSource") {
        source.cheer.push(cheer);
        const options = stageOptions(player).filter((zone) => zone !== option.zone);
        assert(options.length > 0, "已沒有其他 Holomen 可接收應援。 ");
        enqueueStageTarget(state, { playerIndex, options, effect: "oshiMoveCheerTarget", prompt: "替換：直接按另一位 Holomen，改附所選應援。", meta: { sourceZone: option.zone, cheerId: option.id } });
      } else if (pending.effect === "oshiMoveCheerToFlare") {
        const target = player.zones[pending.meta?.targetZone];
        assert(target, "不知火フレア已離開舞台。 ");
        attachCheerCards(state, target, [cheer]);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        const options = stageCheerOptions(player, map).filter((candidate) => candidate.zone !== pending.meta.targetZone);
        if (remaining > 0 && options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: pending.effect, optional: true, prompt: "可繼續直接按應援改附；或略過完成（最多 5 張）。", meta: { ...pending.meta, remaining, moved: Number(pending.meta?.moved || 0) + 1 } });
        else {
          const amount = Number(player.zones.center?.cheer.length || 0) * 10;
          addPlayerModifier(player, "arts", amount, state.turn, "hBP05-007", {});
          appendLog(state, `${player.name} 的全舞台 Holomen 本回合 Arts +${amount}。`);
        }
      } else if (pending.effect === "giftMoveFlareCheer") {
        const target = player.zones[pending.meta?.targetZone];
        assert(target, "Colorful Stream 的後排目標已離開舞台。 ");
        attachCheerCards(state, target, [cheer]);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        appendLog(state, `${player.name} 將攻擊者的 1 張應援改附到 ${unitCard(target, map)?.name || pending.meta?.targetZone}。`);
        if (remaining > 0) {
          const sourceUnit = player.zones[pending.meta?.sourceZone];
          const options = (sourceUnit?.cheer || []).map((instance) => ({ id: instance.id, number: instance.number, zone: pending.meta.sourceZone }));
          assert(options.length >= remaining, "Colorful Stream 的第 2 張應援已改變。 ");
          state.effectQueue.unshift({ type: "stageCheerSelection", playerIndex, ownerIndex: playerIndex, options: clone(options), rule: {}, min: 1, max: 1, prompt: "Colorful Stream：直接按攻擊者身上第 2 張實際應援。", effect: pending.effect, optional: false, meta: { ...pending.meta, remaining } });
        } else {
          const targetName = unitCard(target, map)?.jpName || unitCard(target, map)?.name;
          const candidates = player.archive.filter((instance) => map.get(instance.number)?.stage === "1st" && cardHasName(map.get(instance.number), targetName));
          if (candidates.length > 0) state.effectQueue.unshift({ type: "cardSelection", playerIndex, cards: clone(candidates), selectableIds: candidates.map((card) => card.id), min: 1, max: 1, prompt: "Colorful Stream：揀存檔區 1 張與接收應援者同名的 1st Holomen 返回手牌。", effect: "archiveToHand", source: "archive", optional: false, meta: {} });
        }
      } else if (pending.effect === "genericKeywordCheerCost") {
        owner.archive.push(cheer);
        if (!option.cheerSubstitute) triggerCheerArchivedGift(state, ownerIndex, map, 1);
        if (!option.cheerSubstitute) queueHbp01Oshi008Trigger(state, ownerIndex, pending.meta?.sourceZone, map);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        const paid = Number(pending.meta?.paid || 0) + 1;
        appendLog(state, `${owner.name} 將舞台 1 張應援放到存檔區，支付卡牌效果成本。`);
        if (remaining > 0) {
          const options = pending.cheerOptions.filter(candidate => (candidate.cheerSubstitute ? owner.zones[candidate.zone]?.attachments : owner.zones[candidate.zone]?.cheer)?.some(c => c.id === candidate.id));
          assert(options.length >= remaining, "卡牌效果餘下應援成本不足。 ");
          enqueueStageCheerSelection(state, { playerIndex, ownerIndex, options, effect: pending.effect, optional: false, prompt: `再按 ${remaining} 張應援完成成本。`, meta: { ...pending.meta, remaining, paid } });
        } else {
          const abilityCard = map.get(pending.meta?.cardNumber);
          if (cardHasTag(abilityCard, "#FLOW GLOW") && !["hBP07-034", "hSD11-004"].includes(abilityCard.number)) queueHsd11SpOshiTrigger(state, playerIndex, paid, map);
          resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, paid);
        }
      } else if (pending.effect === "endKanadeArchive") {
        player.archive.push(cheer);
        triggerCheerArchivedGift(state, playerIndex, map, 1);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        appendLog(state, `${player.name} 將舞台 1 張應援放到存檔區。`);
        if (remaining > 0 && stageCheerOptions(player, map).length > 0) enqueueStageCheerSelection(state, { playerIndex, effect: pending.effect, prompt: `啪啪謝謝你！：再按舞台應援放到存檔區（尚餘 ${remaining} 張）。`, meta: { remaining } });
      } else if (pending.effect === "archiveSelectedStageCheer" || pending.effect === "fieldStaffCost" || pending.effect === "holotoriDrawCost" || pending.effect === "geowCost" || pending.effect === "oshiIofiCheerCost") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        appendLog(state, `${owner.name} 將舞台上的 1 張應援放到存檔區。`);
        if (pending.effect === "fieldStaffCost") {
          const fans = player.archive.filter((instance) => map.get(instance.number)?.typeCode === "supportFan");
          if (fans.length > 0) enqueueCardSelection(state, { playerIndex, cards: fans, min: 1, max: 1, effect: "fieldStaffFan", source: "archive", prompt: "現場工作人員：揀 1 張存檔區粉絲；下一步直接按牌桌附加。" });
        } else if (pending.effect === "holotoriDrawCost") {
          appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
          enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToBottom", prompt: "HOLOTORI：揀 1 張手牌放到牌庫底。" });
        } else if (pending.effect === "geowCost") {
          const cheerCards = [...player.cheerDeck];
          if (cheerCards.length > 0) enqueueCardSelection(state, { playerIndex, cards: cheerCards, min: 1, max: 1, effect: "geowCheer", source: "cheerDeck", prompt: "GEOW：從應援牌庫公開 1 張應援；下一步直接按牌桌附加。" });
        } else if (pending.effect === "oshiIofiCheerCost" && Number(pending.meta?.remaining || 1) <= 1) {
          queueDeckToHand(state, playerIndex, { group: "holomem", tags: ["#ID1期生"] }, map, random, { min: 2, max: 2, optional: false, label: "Kekuatan Iofi" });
        } else if (Number(pending.meta?.remaining || 1) > 1) {
          enqueueStageCheerSelection(state, { playerIndex, ownerIndex, rule: pending.rule || {}, effect: pending.effect, optional: pending.effect === "oshiIofiCheerCost" ? false : Boolean(pending.optional), prompt: pending.prompt, meta: { ...pending.meta, remaining: Number(pending.meta.remaining) - 1 } });
        }
      } else if (pending.effect === "moveSelectedCheerToZone") {
        const target = player.zones[pending.meta?.targetZone];
        assert(target, "應援改附目標已離開舞台。 ");
        attachCheerCards(state, target, [cheer]);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        if (remaining > 0) {
          const options = stageCheerOptions(player, map).filter((candidate) => candidate.zone !== pending.meta.targetZone);
          if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: pending.effect, optional: true, prompt: pending.prompt, meta: { ...pending.meta, remaining } });
          else if (pending.meta?.after === "maitakeBonus" && target.cheer.length >= 3) addStageModifier(target, "arts", 10, state.turn, "hBP04-094");
        } else if (pending.meta?.after === "maitakeBonus" && target.cheer.length >= 3) addStageModifier(target, "arts", 10, state.turn, "hBP04-094");
      } else if (pending.effect === "artArchiveCheerCost") {
        owner.archive.push(cheer);
        triggerCheerArchivedGift(state, ownerIndex, map, 1);
        queueHbp01Oshi008Trigger(state, ownerIndex, pending.meta?.sourceZone, map);
        const paid = Number(pending.meta?.paid || 0) + 1;
        const minimumRemaining = Math.max(0, Number(pending.meta?.minimumRemaining || 1) - 1);
        const remaining = Math.max(0, Number(pending.meta?.remaining || 1) - 1);
        const perBonus = Number(pending.meta?.perBonus || 0);
        if (perBonus) adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, perBonus);
        let fixedApplied = Boolean(pending.meta?.fixedApplied);
        if (!fixedApplied && minimumRemaining === 0 && Number(pending.meta?.fixedBonus || 0) > 0) {
          adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, Number(pending.meta.fixedBonus));
          fixedApplied = true;
        }
        appendLog(state, `${player.name} 將 1 張應援放到存檔區。`);
        const options = stageCheerOptions(player, map).filter((candidate) => pending.cheerOptions.some((original) => original.id === candidate.id));
        if (remaining > 0 && options.length > 0) enqueueStageCheerSelection(state, { playerIndex, options, effect: pending.effect, optional: minimumRemaining === 0, prompt: minimumRemaining > 0 ? `Arts 成本：再按 ${minimumRemaining} 張應援。` : "可繼續按應援支付；或略過完成效果。", meta: { ...pending.meta, paid, remaining, minimumRemaining, fixedApplied } });
        else {
          assert(minimumRemaining === 0, "Arts 成本所需應援不足。 ");
          completeArtCheerCost(state, playerIndex, { ...pending.meta, paid, remaining, minimumRemaining, fixedApplied }, map, random);
        }
      } else if (pending.effect === "artOpponentCheerBottom") {
        owner.cheerDeck.push(cheer);
        appendLog(state, `${owner.name} 將所選舞台應援放回應援牌庫底。`);
      }
    }
  } else if (pending.type === "stageAttachmentSelection") {
    if (action.skip && pending.optional) appendLog(state, `${player.name} 略過可選附加卡效果。`);
    else {
      const option = pending.attachmentOptions?.find((candidate) => candidate.id === action.attachmentId);
      const ownerIndex = Number.isInteger(pending.ownerIndex) ? pending.ownerIndex : playerIndex;
      const owner = state.players[ownerIndex];
      const source = option && owner.zones[option.zone];
      const moved = source && removeById(source.attachments, option.id);
      assert(option && moved, "所選舞台附加卡已改變。 ");
      if (pending.effect === "genericMoveAttachmentSource") {
        const legalTargets = attachmentTargets(player, map.get(moved.number), map);
        const options = stageOptionsMatching(player, map, pending.meta?.targetRule || {}).filter((zone) => legalTargets.includes(zone) && (!pending.meta?.excludeSourceCard || zone !== option.zone));
        if (options.length === 0) {
          source.attachments.push(moved);
          appendLog(state, `${player.name} 沒有合法的附加卡改附目標。`);
        } else enqueueStageTarget(state, { playerIndex, options, effect: "genericReceiveMovedAttachment", prompt: "直接按牌桌上的 Holomen，改附所選卡。", meta: { attachment: moved } });
      } else if (pending.effect === "towaArchiveTool") {
        owner.archive.push(moved);
        appendLog(state, `${owner.name} 將工具「${map.get(moved.number)?.name || moved.number}」放到存檔區。`);
      } else if (pending.effect === "lunaiteArchiveCost") {
        owner.archive.push(moved);
        const lunaOptions = stageOptionsMatching(player, map, { names: ["姫森ルーナ"] });
        if (lunaOptions.length > 0 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: lunaOptions, prompt: "直接按自己 1 位姫森ルーナ，附加應援牌庫頂 1 張。" });
        const remaining = Math.max(0, Number(pending.meta?.remaining || 1) - 1);
        const options = stageAttachmentOptions(player, map, (instance, attachment) => cardHasName(attachment, "ルーナイト"));
        if (remaining > 0 && options.length > 0) enqueueStageAttachmentSelection(state, { playerIndex, options, effect: pending.effect, optional: true, prompt: "可再直接按 1 張舞台上的ルーナイト存檔；或略過完成。", meta: { ...pending.meta, remaining } });
      } else if (pending.effect === "genericKeywordAttachmentCost") {
        owner.archive.push(moved);
        const remaining = Number(pending.meta?.remaining || 1) - 1;
        const paid = Number(pending.meta?.paid || 0) + 1;
        appendLog(state, `${owner.name} 將 ${map.get(moved.number)?.name || moved.number} 放到存檔區，支付卡牌效果成本。`);
        if (remaining > 0) {
          const options = stageAttachmentOptions(owner, map, (instance, attachment, attachmentZone) => attachmentZone === pending.meta?.sourceZone);
          assert(options.length >= remaining, "卡牌效果餘下附加卡成本不足。 ");
          enqueueStageAttachmentSelection(state, { playerIndex, ownerIndex, options, effect: pending.effect, optional: false, prompt: `再按 ${remaining} 張附加卡完成成本。`, meta: { ...pending.meta, remaining, paid } });
        } else {
          const abilityCard = map.get(pending.meta?.cardNumber);
          if (cardHasTag(abilityCard, "#FLOW GLOW") && !["hBP07-034", "hSD11-004"].includes(abilityCard.number)) queueHsd11SpOshiTrigger(state, playerIndex, paid, map);
          resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, paid);
        }
      } else if (pending.effect === "giftYubiCost") {
        owner.mainDeck.push(moved);
        const giftSource = player.zones[pending.meta?.sourceZone];
        assert(giftSource && unitCard(giftSource, map)?.number === "hBP06-070", "Wonder Viking 的 Gift 來源已改變。 ");
        addStageModifier(giftSource, "artCost", -2, state.turn, "hBP06-070");
        markNamedUsage(player, "gift:hBP06-070", state.turn);
        appendLog(state, `${player.name} 將「${map.get(moved.number)?.name || moved.number}」放到牌庫底；Gift 來源本回合 Arts 無色費用 -2。`);
      } else throw new Error("這個舞台附加卡選擇效果尚未接入。 ");
    }
  } else if (pending.type === "optionChoice") {
    if (action.skip && pending.optional) {
      if (["damageReaction", "oshiDamageReaction", "giftDamageReaction"].includes(pending.effect) && pending.meta?.queuedEffect) state.effectQueue.unshift(clone(pending.meta.queuedEffect));
      if (pending.effect === "shionOshiReroll") resolveShionAbilityDie(state, playerIndex, pending.meta, map, random);
      if (pending.effect === "oshiDamageReaction" && player.oshi?.number === "hBP04-006") {
        for (const hit of simultaneousDamageEffects(state, pending.meta.queuedEffect)) hit.oshiReactionChecked = true;
      }
      appendLog(state, `${player.name} 略過可選模式。`);
    }
    else {
      const option = pending.modeOptions.find((candidate) => candidate.id === action.optionId && !candidate.disabled);
      assert(option, "效果模式選擇無效。 ");
      if (pending.effect === "koFanDraw") {
        appendLog(state,player.name+" 因 35P 抽 "+drawCards(state,playerIndex,1)+" 張牌。");
      } else if (pending.effect === "kanataBloomRoll") {
        const card = map.get("hBP01-012");
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die, "因偶像かなたそを擲骰");
        if (die <= 3) queueDeckAttachmentToStage(state, playerIndex, { typeCodes: ["supportMascot"] }, {}, map, random, card?.keyword?.name || card?.name || "偶像かなたそを", { optional: true });
      } else if (pending.effect === "magicSupportRoll") {
        const card = map.get(pending.meta.cardNumber);
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die);
        const typeCodes = card.number === "hBP02-072" ? ["supportEvent", "supportEventLimited"] : card.number === "hBP02-073" ? ["supportFan"] : ["supportTool"];
        if (die % 2 === 0) queueDeckToHand(state, playerIndex, { group: "support", typeCodes }, map, random, { optional: true, label: card.keyword.name });
      } else if (pending.effect === "magicPairCheerRoll") {
        const card = map.get(pending.meta.cardNumber);
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die);
        if (die % 2 === 1) {
          if (stageOptionsMatching(player, map, { zones: BACK_SLOTS }).length) queueCheerDeckSearch(state, playerIndex, card.keyword.effect, "collab", map, random, { targetRuleOverride: { zones: BACK_SLOTS } });
          else player.cheerDeck = shuffle(player.cheerDeck, random);
        }
      } else if (pending.effect === "adventureRoll") {
        const card = map.get("hBP01-096");
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die);
        if (die % 2 === 0) queueDeckToHand(state, playerIndex, { group: "holomem", buzz: true }, map, random, { min: 1, max: 1, optional: true, label: card.keyword.name });
      } else if (pending.effect === "edinburghRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hBP01-099"));
        logDie(state, playerIndex, die);
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        const opponent = state.players[opponentIndex];
        const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
        if (die % 2 === 1 && opponent.zones.center && options.length) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "swapCenter", optional: false, prompt: "骰子為奇數：選擇對手 1 位後排，與中央互換。" });
      } else if (pending.effect === "moonaArtRoll") {
        const die = rollArtDie(state, playerIndex, map.get("hBP01-088"), random);
        if (die % 2 === 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位後排，造成 20 特殊傷害；倒下不減生命。", meta: { amount: 20, loseLife: false, sourceName: pending.meta.sourceName, sourceZone: pending.meta.sourceZone } });
      } else if (["shionCollabRoll", "shionBloomRoll", "shionArtRoll"].includes(pending.effect)) {
        const sourceNumber = pending.effect === "shionCollabRoll" ? "hBP02-043" : pending.effect === "shionArtRoll" ? "hBP02-046" : "hBP02-047";
        const effect = pending.effect === "shionCollabRoll" ? "collabSearch" : pending.effect === "shionArtRoll" ? "artMove" : "bloomMove";
        rollShionAbilityDie(state, playerIndex, { sourceNumber, effect }, map, random);
      } else if (pending.effect === "shionOshiReroll") {
        assert(option.id === "reroll", "紫咲シオン重擲選項無效。 ");
        payShionReroll(state, playerIndex, map);
        const event = currentTurnEvents(player, state.turn).dice?.[pending.meta?.diceEventIndex];
        if (event) event.cancelled = true;
        appendLog(state, player.name + " 取消原本的骰子結果並重新擲骰。");
        rollShionAbilityDie(state, playerIndex, pending.meta, map, random, false);
      } else if (pending.effect === "haatoOptionalRoll") {
        enqueueEffect(state,{type:"haatoRoll",playerIndex,meta:pending.meta});
      } else if (pending.effect === "haatoReroll") {
        if(option.id==="accept") resolveHaatoDie(state,playerIndex,pending.meta,map);
        else {
          const source=player.zones[pending.meta.sourceZone];
          assert(source && topCard(source).id===pending.meta.sourceId,"擲骰發動者已改變。");
          const fan=source.attachments.find(c=>c.id===option.cardId && c.number==="hBP03-108");
          assert(fan,"發動者的 Haato豚 已改變。");
          player.archive.push(removeById(source.attachments,fan.id));
          const event=currentTurnEvents(player,state.turn).dice[pending.meta.diceEventIndex];
          if(event) event.cancelled=true;
          appendLog(state,player.name+" 存檔 Haato豚，取消本次骰子結果並重擲。",[fan]);
          enqueueEffect(state,{type:"haatoRoll",playerIndex,meta:pending.meta});
        }
      } else if (pending.effect === "botanCheerPayment") {
        resolveBotanCheerPayment(state, playerIndex, option, pending.meta, map);
      } else if (pending.effect === "luiArchivePayment") {
        const saved = clone(pending.meta.selection);
        const power = Number(option.powerCount || 0);
        if (power > 0) {
          const handCount = Number(option.total) - power;
          saved.min = handCount;
          saved.max = handCount;
          saved.meta.luiPowerCount = power;
          saved.meta.luiTotalCount = Number(option.total);
          saved.prompt = `女幹部の采配：再揀 ${handCount} 張手牌，連同 ${power} Holo Power 完成支付。`;
          if (handCount === 0) {
            state.pendingChoice = { ...saved, type: "cardSelection", selectableIds: [] };
            resolveChoice(state, playerIndex, { cardIds: [] }, map, random);
          } else enqueueCardSelection(state, saved);
        } else enqueueCardSelection(state, { ...saved, min: Math.min(saved.min, saved.cards.length), max: Math.min(saved.max, saved.cards.length) });
      } else if (pending.effect === "genericKeywordPowerCost") {
        const amount = Math.min(Number(pending.meta?.amount || 1), player.holoPower.length);
        assert(amount === Number(pending.meta?.amount || 1), "Holo Power 成本已不足。 ");
        player.archive.push(...player.holoPower.splice(-amount).reverse());
        appendLog(state, `${player.name} 將最新 ${amount} 張 Holo Power 放到存檔區支付成本。`);
        resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, amount);
      } else if (pending.effect === "genericKeywordCheerDeckCost") {
        const amount = Math.min(Number(option.id || pending.meta?.amount || 1), player.cheerDeck.length);
        assert(amount >= Number(pending.meta?.min || pending.meta?.amount || 1) && amount <= Number(pending.meta?.max || pending.meta?.amount || 1), "應援牌庫成本數量無效。 ");
        player.archive.push(...player.cheerDeck.splice(0, amount));
        triggerCheerArchivedGift(state, playerIndex, map, amount);
        if (pending.meta?.cardNumber === "hBP07-087") queueHsd11SpOshiTrigger(state, playerIndex, amount, map);
        appendLog(state, `${player.name} 將應援牌庫頂 ${amount} 張放到存檔區支付成本。`);
        resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, amount);
      } else if (pending.effect === "genericKeywordMainDeckCost") {
        const amount = Math.min(Number(pending.meta?.amount || 1), player.mainDeck.length);
        assert(amount === Number(pending.meta?.amount || 1), "牌庫頂成本已不足。 ");
        const archived = player.mainDeck.splice(0, amount);
        player.archive.push(...archived);
        queueFlowGlowArchivedCards(state, playerIndex, map.get(pending.meta?.cardNumber), archived, map);
        currentTurnEvents(player, state.turn).deckArchived += amount;
        appendLog(state, `${player.name} 將牌庫頂 ${amount} 張放到存檔區支付成本。`);
        resolveGenericKeywordRemainder(state, playerIndex, pending.meta, map, random, amount);
      } else if (pending.effect === "mikoDieOverride") {
        const amount = Number(option.id);
        assert([3, 5].includes(amount), "さくらみこ的骰子點數選擇無效。 ");
        addPlayerModifier(player, "mikoDieOverride", amount, state.turn, "hBP07-043");
        appendLog(state, `${player.name} 本回合由さくらみこ能力擲出的骰子全部視為 ${amount}。`);
      } else if (pending.effect === "topCardPlacement") {
        const card = pending.meta?.card;
        assert(card, "查看的牌庫頂卡片已改變。 ");
        if (option.id === "top") player.mainDeck.unshift(card);
        else player.mainDeck.push(card);
        appendLog(state, `${player.name} 將查看的卡放到牌庫${option.id === "top" ? "頂" : "底"}。`);
      } else if (pending.effect === "restSourceThenHeal") {
        const sourceZone = stageZoneByTopId(player, pending.meta?.sourceId);
        const source = sourceZone && player.zones[sourceZone];
        assert(source && !source.rested, "要休息的效果來源已改變。 ");
        source.rested = true;
        appendLog(state, `${unitCard(source, map)?.name || sourceZone} 變為休息狀態。`);
        const restedJustice = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.rested && cardHasTag(unitCard(stageUnit, map), "#Justice")).length;
        if (restedJustice >= 2) enqueueStageTarget(state, { playerIndex, rule: { damaged: true }, effect: "heal", optional: false, prompt: "自己有 2 位以上休息中的 #Justice：可直接按 1 位受傷 Holomen，回復 50 HP。", meta: { amount: 50 } });
      } else if (pending.effect === "shioriBookmark") {
        const revealed=player.holoPower.pop();
        if(revealed){player.holoPower.unshift(revealed);const card=map.get(revealed.number);appendLog(state,"公開Holo Power並放回底部。",[revealed]);if(card?.group==="holomem"&&cardHasTag(card,"#EN"))enqueueStageTarget(state,{playerIndex,targetPlayerIndex:playerIndex===0?1:0,effect:"specialDamage",optional:false,prompt:"選擇對手Holomen造成20特殊傷害。",meta:{amount:20,loseLife:true,sourceZone:pending.meta.sourceZone,sourceName:"思い出の栞"}});}      } else if (pending.effect === "ririkaKpgRoll") {
        const die=rollDie(random,state,playerIndex,1,map.get("hBP04-037"));logDie(state,playerIndex,die,"因 KPG 擲骰");
        const opponentIndex=playerIndex===0?1:0;
        if(die>=4&&!state.players[opponentIndex].zones.collab)enqueueEffect(state,{type:"forcedCollab",playerIndex:opponentIndex,prompt:"KPG：選擇後排移到合作位置。"});      } else if (pending.effect === "calliMementoDraw") {
        drawCards(state, playerIndex, 1);
      } else if (pending.effect === "calliBullseye") {
        assert(player.mainDeck.length >= 2, "牌庫不足2張。");
        player.archive.push(...player.mainDeck.splice(0, 2));
        currentTurnEvents(player, state.turn).deckArchived += 2;
        if (player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: false, prompt: "選擇自己Holomen附加應援牌庫頂1張。" });      } else if (pending.effect === "moonaNewMoon") {
        const target = state.players[pending.meta.targetPlayerIndex]?.zones[pending.meta.targetZone];
        if (target) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: pending.meta.targetPlayerIndex, targetZone: pending.meta.targetZone, sourceZone: pending.meta.sourceZone, amount: Number(target.damage || 0), loseLife: true, sourceName: "新月" });      } else if (pending.effect === "artDeckTopArchive") {
        const moved = player.mainDeck.splice(0, Number(option.id));
        player.archive.push(...moved);
        currentTurnEvents(player, state.turn).deckArchived += moved.length;
        queueFlowGlowArchivedCards(state, playerIndex, unitCard(player.zones[pending.meta?.sourceZone], map), moved, map);
        if (pending.meta?.perBonus) adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, moved.length * pending.meta.perBonus);
      } else if (pending.effect === "archiveDeckTopDraw") {
        const amount = Number(option.id);
        assert([1, 2].includes(amount) && player.mainDeck.length >= amount, "牌庫頂存檔張數無效。 ");
        const archived = player.mainDeck.splice(0, amount);
        player.archive.push(...archived);
        queueFlowGlowArchivedCards(state, playerIndex, map.get(pending.meta?.cardNumber), archived, map);
        currentTurnEvents(player, state.turn).deckArchived += amount;
        appendLog(state, `${player.name} 將牌庫頂 ${amount} 張存檔，再抽 ${drawCards(state, playerIndex, amount)} 張。`);
      } else if (pending.effect === "handInspection") {
        const amount = Number(pending.meta?.draw || 0);
        appendLog(state, `${player.name} 查看了對手手牌${amount > 0 ? `，因當中有支援卡抽 ${drawCards(state, playerIndex, amount)} 張牌` : "；當中沒有支援卡"}。`);
      } else if (pending.effect === "bluntWeaponMode") {
        if (option.id === "mumei") {
          player.namedUsageTurns.bluntWeaponGame = 1;
          enqueueStageCheerSelection(state, { playerIndex, ownerIndex: playerIndex === 0 ? 1 : 0, rule: { stage: { zones: ["center"] } }, effect: "archiveSelectedStageCheer", prompt: "七詩ムメイ變更效果：直接按對手中央 Holomen 身上應援，共存檔 2 張。", meta: { remaining: 2 } });
        } else {
          const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die);
          if (die <= 3) enqueueStageCheerSelection(state, { playerIndex, ownerIndex: playerIndex === 0 ? 1 : 0, effect: "archiveSelectedStageCheer", prompt: "骰子成功：直接按對手 Holomen 身上 1 張應援。" });
        }
      } else if (pending.effect === "holotoriMode") {
        if (option.id === "draw") enqueueStageCheerSelection(state, { playerIndex, rule: { stage: { tags: ["#トリ"] } }, effect: "holotoriDrawCost", prompt: "直接按自己 #トリ Holomen 身上 1 張實際應援放到存檔區。" });
        else enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { tags: ["#トリ"] }, prompt: "HOLOTORI：揀 1 張存檔區應援；下一步直接按 #トリ Holomen。" }, map);
      } else if (pending.effect === "akiAxeCost") {
        if (option.id === "hand") enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: "亞綺·羅森塔爾的斧頭：揀 1 張手牌放到存檔區。" });
        else {
          const cards = (pending.meta?.axeOptions || []).map((candidate) => ({ id: candidate.id, number: candidate.number }));
          enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, effect: "archiveStageAttachment", source: "stage", prompt: "亞綺·羅森塔爾的斧頭：揀舞台上的 1 張石斧存檔。", meta: { attachmentOptions: pending.meta?.axeOptions || [] } });
        }
      } else if (pending.effect === "otomoState") {
        const target = player.zones[pending.meta?.targetZone];
        assert(target, "Otomo 的附加目標已離開舞台。 ");
        target.rested = option.id === "rested";
        appendLog(state, `${unitCard(target, map)?.name || pending.meta?.targetZone} 因 Otomo 變為${target.rested ? "休息" : "活動"}狀態。`);
      } else if (pending.effect === "hatoTaurus") {
        const target = player.zones[pending.meta?.zone];
        const index = target?.attachments.findIndex((instance) => instance.number === "hBP07-106") ?? -1;
        assert(target && index >= 0, "HatoTaurus 已離開舞台。 ");
        const [mascot] = target.attachments.splice(index, 1);
        player.mainDeck.unshift(mascot);
        queueArchiveToHand(state, playerIndex, { group: "holomem" }, map, { min: 1, max: 1, optional: false, label: "HatoTaurus" });
      } else if (pending.effect === "slimDogReturn") {
        assert(player.holoPower.length > 0, "Holo Power 已不足。 ");
        player.archive.push(player.holoPower.pop());
        const mascot = player.archive.find((instance) => instance.number === "hBP03-103");
        assert(mascot, "瘦狗已離開存檔區。 ");
        player.hand.push(removeById(player.archive, mascot.id));
        appendLog(state, `${player.name} 支付 1 Holo Power，將瘦狗返回手牌。`);
      } else if (pending.effect === "damageReaction") {
        const target = player.zones[pending.meta?.targetZone];
        const moved = target && removeById(target.attachments, pending.meta?.attachmentId);
        assert(moved, "防禦用附加卡已改變。 ");
        state.effectQueue.unshift({ ...pending.meta.queuedEffect, attachmentReactionChecked: false, reactionReduction: Number(pending.meta.queuedEffect?.reactionReduction || 0) + 30 });
        const replacement = lunaiteArchiveReplacement(state, playerIndex, pending.meta?.targetZone, moved, map);
        if (replacement) state.effectQueue.unshift(replacement);
        else player.archive.push(moved);
        appendLog(state, `${player.name} 使用 ${moved.number} 的存檔減傷效果，這次傷害 -30${replacement ? "；可用 Gift 改附代替存檔" : ""}。`);
      } else if (pending.effect === "hBP01-008CheerArchive") {
        payReactiveOshi(state, playerIndex, "oshi", map);
        const opponentIndex = Number(pending.meta?.opponentIndex ?? (playerIndex === 0 ? 1 : 0));
        const options = stageOptionsMatching(state.players[opponentIndex], map);
        if (options.length > 0) state.effectQueue.unshift({ type: "stageTarget", playerIndex, targetPlayerIndex: opponentIndex, options, effect: "hBP01-008SpecialDamage", optional: false, prompt: "雨之薩滿術：選擇對手 1 位 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceName: "雨之薩滿術", sourceZone: pending.meta?.sourceZone || "" } });
      } else if (pending.effect === "suiseiKoboCollabRoll") {
        const card = map.get(pending.meta.cardNumber);
        const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die);
        if (card.number === "hBP01-080" && die % 2 === 1) {
          const opponentIndex = playerIndex === 0 ? 1 : 0;
          const options = stageEntries(state.players[opponentIndex]).filter(({ zone, unit: target }) => BACK_SLOTS.includes(zone) && target.damage >= 40).map(({ zone }) => zone);
          if (options.length) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "knockOutNoLife", optional: false, prompt: "選擇已受 40 以上傷害的對手後排，使其倒下，生命不減少。", meta: { sourceZone: "collab" } });
        }
        if (card.number === "hBP01-083" && die >= 3 && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: false, prompt: "選擇自己一位 Holomen，附加應援牌庫頂 1 張。" });
      } else if (pending.effect === "azkiLifeRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hBP01-047")); logDie(state, playerIndex, die);
        if (die % 2 === 1) {
          const green = player.archive.filter(instance => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("綠"));
          if (green.length) enqueueCardSelection(state, { playerIndex, cards: green, min: 0, max: Math.min(3, green.length), optional: true, effect: "archiveCheerToStage", source: "archive", prompt: "可選 1–3 張綠色應援附加到此 AZKi。", meta: { targetZone: pending.meta.sourceZone, targetRule: { zones: [pending.meta.sourceZone] } } });
        }
      } else if (pending.effect === "firstSetArtsRoll") {
        const card = map.get(pending.meta.cardNumber);
        const dice = rollDice(random, state, playerIndex, card.number === "hBP01-043" ? 3 : 1, card);
        if (card.number === "hBP01-072") {
          if (dice[0] % 2 === 1) queueFixedSpecialDamage(state, playerIndex, pending.meta.sourceZone, ["collab"], 20, pending.meta.sourceName);
        } else adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, (card.number === "hBP01-043" ? dice.filter(die => die === 1).length : dice[0]) * 10);
      } else if (pending.effect === "firstSetCollabRoll") {
        const card = map.get(pending.meta.cardNumber);
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die);
        if (card.number === "hBP01-033" && die % 2 === 1) enqueueStageTarget(state, { playerIndex, rule: { colors: ["綠"] }, effect: "heal", optional: false, prompt: "選擇自己一位綠色 Holomen，回復 20 HP。", meta: { amount: 20 } });
        if (card.number === "hBP01-039" && die % 2 === 0 && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: false, prompt: "選擇自己一位 Holomen，附加應援牌庫頂 1 張。" });
      } else if (pending.effect === "pekoraCuteRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hBP05-014")); logDie(state, playerIndex, die);
        if (die % 2 === 0) appendLog(state, player.name + " 抽 " + drawCards(state, playerIndex, 1) + " 張牌。");
      } else if (pending.effect === "matsuriShoppingRoll") {
        const successes = rollDice(random, state, playerIndex, Number(action.optionId), map.get("hBP04-082"), "因#1期生人數擲骰").filter(die => die >= 4).length;
        for (let i = 0; i < Math.min(successes, player.cheerDeck.length); i++) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [pending.meta.sourceZone], optional: false, prompt: "附加應援牌庫頂 1 張到效果來源。" });
      } else if (pending.effect === "holoxGatherRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hBP04-057")); logDie(state, playerIndex, die);
        const candidates = player.archive.filter(c => map.get(c.number)?.group === "holomem" && cardHasTag(map.get(c.number), "#秘密結社holoX"));
        if (candidates.length) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: die % 2 ? "archiveToHand" : "archiveToDeckTop", source: "archive", prompt: die % 2 ? "選擇 1 張 holoX 成員返回手牌。" : "選擇 1 張 holoX 成員放回牌庫頂。" });
      } else if (pending.effect === "laplusRestRoll") {
        const card = map.get("hBP04-055");
        const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die);
        if (die >= 3) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "rest", optional: false, prompt: "選擇對手 1 位後排 Holomen，使其休息。" });
      } else if (pending.effect === "laplusTripleRoll") {
        const card = map.get("hBP04-058");
        const odd = rollDice(random, state, playerIndex, 3, card, "因合作效果擲 3 次骰").filter(die => die % 2 === 1).length;
        if (odd) queueFixedSpecialDamage(state, playerIndex, "collab", ["center"], odd * 10, card.keyword.name);
      } else if (pending.effect === "starterSuiseiReveal") {
    const revealed = player.mainDeck.shift();
    if (revealed) {
      const revealedCard = map.get(revealed.number);
      player.mainDeck.push(revealed);
      appendLog(state, `${player.name} 公開 ${revealed.number} 並放到牌庫底。`, [revealed]);
      if (["Debut", "Spot"].includes(revealedCard?.stage) && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: ["collab"], prompt: "公開 Debut／Spot 成功：直接按此合作 Holomen，附加應援牌庫頂 1 張。" });
    }
      } else if (pending.effect === "kiaraArchiveDecision") {
        if (action.optionId === "archive") {
          const moved = pending.meta.ids.map(id => removeById(player.mainDeck,id)).filter(Boolean);
          player.archive.push(...moved);
          currentTurnEvents(player,state.turn).deckArchived += moved.length;
        }
        player.mainDeck = shuffle(player.mainDeck,random);
      } else if (pending.effect === "watameRpsStart") {
        state.privateRps = { ownerIndex: playerIndex, ...pending.meta };
        enqueueOptionChoice(state, { playerIndex, options: [{id:"rock",label:"石頭"},{id:"scissors",label:"剪刀"},{id:"paper",label:"布"}], optional:false, effect:"watameRpsPick", prompt:"秘密選擇出拳。" });
      } else if (pending.effect === "watameRpsPick") {
        const round = state.privateRps;
        assert(round, "猜拳已結束。");
        if (!round.first) {
          round.first = action.optionId;
          enqueueOptionChoice(state, { playerIndex: round.ownerIndex === 0 ? 1 : 0, options: [{id:"rock",label:"石頭"},{id:"scissors",label:"剪刀"},{id:"paper",label:"布"}], optional:false, effect:"watameRpsPick", prompt:"秘密選擇出拳。" });
        } else {
          const second = action.optionId;
          const labels = {rock:"石頭",scissors:"剪刀",paper:"布"};
          appendLog(state, `猜拳：${labels[round.first]} 對 ${labels[second]}。`);
          if (round.first === second) {
            delete round.first;
            enqueueOptionChoice(state, { playerIndex: round.ownerIndex, options: [{id:"rock",label:"石頭"},{id:"scissors",label:"剪刀"},{id:"paper",label:"布"}], optional:false, effect:"watameRpsPick", prompt:"平手，重新秘密出拳。" });
          } else {
            const won = {rock:"scissors",scissors:"paper",paper:"rock"}[round.first] === second;
            const source = state.players[round.ownerIndex].zones[round.sourceZone];
            if (won && source) {
              addStageModifier(source, "specialAttack:red", 30, state.turn, "hBP03-071");
              const target = state.players[round.ownerIndex === 0 ? 1 : 0].zones[round.targetZone];
              if (unitCard(target,map)?.colors?.includes("紅")) adjustQueuedArtsDamage(state, round.ownerIndex, round.sourceZone, 30);
            }
            delete state.privateRps;
          }
        }      } else if (pending.effect === "promoFlowerRoll") {
        const card = map.get("hPR-001");
        const die = rollDie(random, state, playerIndex, 1, card);
        logDie(state, playerIndex, die);
        if (die % 2 === 1) queueCheerDeckSearch(state, playerIndex, card.keyword.effect, "collab", map, random, { optional: false, colorsOverride: ["紅", "藍"], targetRuleOverride: { zones: BACK_SLOTS } });
      } else if (pending.effect === "soraSummerRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hEB01-010"));
        logDie(state, playerIndex, die);
        const targetPlayerIndex = playerIndex === 0 ? 1 : 0;
        const options = stageOptionsMatching(state.players[targetPlayerIndex], map, { zones: BACK_SLOTS });
        if (die % 2 === 1 && options.length && state.players[targetPlayerIndex].zones.center) enqueueStageTarget(state, { playerIndex, targetPlayerIndex, options, effect: "swapCenter", optional: false, prompt: "選擇對手後排，與中心成員替換。" });
      } else if (pending.effect === "pekoraStackBatch") {
        const count = Number(action.optionId);
        if (count > 0) {
          const dice = rollDice(random, state, playerIndex, count, map.get('hBP05-016'));
          const total = dice.reduce((sum, value)=>sum+value,0);
          adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, total*10);
          drawCards(state, playerIndex, total%2===1?1:2);
        }
      } else if (pending.effect === "pekoraStackRoll") {
        const meta = { ...pending.meta, remaining: pending.meta.remaining - 1 };
        if (action.optionId === "roll") {
          meta.total += rollArtDie(state, playerIndex, map.get("hBP05-016"), random);
          meta.rolled += 1;
        }
        if (meta.remaining > 0) enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲骰" }, { id: "decline", label: "不擲這顆骰子" }], optional: false, effect: "pekoraStackRoll", prompt: "可為下一張重疊成員擲一次骰子。", meta });
        else if (meta.rolled > 0) {
          adjustQueuedArtsDamage(state, playerIndex, meta.sourceZone, meta.total * 10);
          drawCards(state, playerIndex, meta.total % 2 === 1 ? 1 : 2);
        }
      } else if (pending.effect === "polkaArchiveRoll") {
        const die = rollArtDie(state, playerIndex, map.get(pending.meta.cardNumber), random);
        const amount = Math.min(die, player.mainDeck.length);
        player.archive.push(...player.mainDeck.splice(0, amount));
        currentTurnEvents(player, state.turn).deckArchived += amount;
        if (player.archive.length >= 10) adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, 10);
      } else if (pending.effect === "flareLifeRoll") {
        const die=rollArtDie(state,playerIndex,map.get(pending.meta.cardNumber),random);
        if(die>=player.life.length)adjustQueuedArtsDamage(state,playerIndex,pending.meta.sourceZone,60);
        if(die<=player.life.length)drawCards(state,playerIndex,1);      } else if (pending.effect === "azkiMapRoll") {
        const die=rollDie(random,state,playerIndex,1,map.get("hSD01-009"));logDie(state,playerIndex,die);
        const options=stageOptionsMatching(player,map,{zones:BACK_SLOTS});
        if(die<=4&&player.cheerDeck.length&&options.length)enqueueEffect(state,{type:"eventCheerTarget",playerIndex,options,optional:false,prompt:"選擇後排附加應援牌庫頂1張。"});
        if(die===1)enqueueOptionChoice(state,{playerIndex,options:[{id:"return",label:"移到後排"}],optional:true,effect:"azkiMapReturn",prompt:"可將AZKi移到後排。",meta:pending.meta});
      } else if (pending.effect === "azkiMapReturn") {
        const source=player.zones.collab;
        const destination=emptyBackSlots(player)[0];
        if(source&&topCard(source)?.id===pending.meta.sourceId&&destination){player.zones.collab=null;player.zones[destination]=source;source.returnSlot=null;}      } else if (pending.effect === "sorazRoll") {
        const die=rollArtDie(state,playerIndex,map.get(pending.meta.cardNumber),random);
        if(die%2===1){if(player.cheerDeck.length)enqueueEffect(state,{type:"eventCheerTarget",playerIndex,options:[pending.meta.sourceZone],optional:false,prompt:"附加應援牌庫頂1張到SorAZ。"});}
        else drawCards(state,playerIndex,1);      } else if (pending.effect === "starterAzkiRoll") {
        const die = rollArtDie(state, playerIndex, map.get(pending.meta.cardNumber), random);
        adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, (die % 2 === 1 ? 50 : 0) + (die === 1 ? 50 : 0));
      } else if (pending.effect === "mikoArtsRoll") {
        const card = map.get("hBP03-028");
        const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die);
        if (die >= 2) queueFixedSpecialDamage(state, playerIndex, pending.meta.sourceZone, [3, 5].includes(die) ? ["center", "collab"] : ["center"], 20, card.arts[1].name);
      } else if (pending.effect === "mikoMeetingRoll") {
        const card = map.get("hBP03-026");
        const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die);
        if ([3, 5].includes(die)) appendLog(state, `${player.name} 因骰子結果抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        if (die >= 2 && state.players[opponentIndex].zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: 10, loseLife: true, sourceName: card.keyword.name, sourceZone: "collab" });
      } else if (pending.effect === "pekoraFanSearchRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get("hBP03-023")); logDie(state, playerIndex, die);
        if (die % 2 === 0) queueDeckToHand(state, playerIndex, { typeCodes: ["supportFan"] }, map, random, { label: "あんたたちぃ" });
      } else if (pending.effect === "miko35pRoll") {
        const die = rollDie(random, state, playerIndex, 1, map.get(player.oshi.number)); logDie(state, playerIndex, die);
        const count = [3, 5].includes(die) ? 2 : 1;
        queueArchiveToHand(state, playerIndex, { names: ["35P"] }, map, { min: count, max: count, optional: false, label: "35P會回來嗎！？って！" });
      } else if (pending.effect === "holoXSlotReveal") {
        const revealed = player.mainDeck.splice(0, Math.min(3, player.mainDeck.length));
        const amount = revealed.filter(c => map.get(c.number)?.group === "holomem").length * 20;
        if (amount) assert(adjustQueuedArtsDamage(state, playerIndex, pending.meta.sourceZone, amount), "Arts 傷害已改變。");
        appendLog(state, `ホロックスロット：公開卡令 Arts +${amount}。`, revealed);
        const source = player.zones[pending.meta.sourceZone];
        const slotNumber = unitCard(source, map)?.number;
        const usageKey = `gift:${slotNumber}:${topCard(source)?.id || pending.meta.sourceZone}`;
        const selectableIds = revealed.filter(c => map.get(c.number)?.group === "support").map(c => c.id);
        if (slotNumber === "hBP02-039" && selectableIds.length && !usedNamedThisTurn(player, usageKey, state.turn)) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 0, max: 1, effect: "giftSlotSupportPick", source: "revealed", optional: true, prompt: "ぷいぷいぷい～：可揀公開的 1 張支援卡加入手牌；其餘存檔。", meta: { usageKey } });
        else { player.archive.push(...revealed); currentTurnEvents(player, state.turn).deckArchived += revealed.length; }
        if (slotNumber === "hBP02-040" && !usedNamedThisTurn(player, usageKey, state.turn)) {
          markNamedUsage(player, usageKey, state.turn);
          const members = revealed.map(c => map.get(c.number)).filter(c => c?.group === "holomem");
          if (members.length === 3 && new Set(members.map(c => c.stage)).size === 1) queueExtraLifeLoss(state, playerIndex === 0 ? 1 : 0, playerIndex, map, "最高に激アツ～");
        }
      } else if (pending.effect === "mioTarotArchive") {
        const moved = player.mainDeck.shift();
        assert(moved, "牌庫頂已改變。");
        player.archive.push(moved);
        currentTurnEvents(player, state.turn).deckArchived += 1;
        const group = map.get(moved.number)?.group;
        const amount = group === "holomem" ? 20 : group === "support" ? 50 : 0;
        if (amount) assert(adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, amount), "Arts 傷害已改變。");
        appendLog(state, `タロットの導き：牌庫頂卡存檔，這次 Arts +${amount}。`, [moved]);
      } else if (pending.effect === "mumeiMemoryFragment") {
        const revealed = player.mainDeck.shift();
        assert(revealed, "七詩ムメイ的牌庫頂已改變。 ");
        const revealedCard = map.get(revealed.number);
        player.hand.push(revealed);
        const bonus = cardHasTag(revealedCard, "#Promise") ? 20 : 0;
        if (bonus > 0) assert(adjustQueuedArtsDamage(state, playerIndex, pending.meta?.sourceZone, bonus), "七詩ムメイ的 Arts 傷害已改變。 ");
        appendLog(state, `${player.name} 公開「${revealedCard?.name || revealed.number}」並加入手牌${bonus > 0 ? "，這次 Arts +20" : ""}。`, [revealed]);
      } else if (pending.effect === "iofiDamagedUse") {
        const source = stageEntries(player).find(({unit}) => topCard(unit)?.id === pending.meta.targetId);
        assert(source, "受傷成員已離開舞台。");
        payReactiveOshi(state, playerIndex, "normal", map);
        enqueueStageCheerSelection(state, { playerIndex, options: stageCheerOptions(player, map, { stage: { zones: [source.zone] } }), effect: "genericMoveCheer", optional: false, prompt: "選擇受傷成員的 1 張應援。", meta: { sourceZone: source.zone, sourceOnlyZone: source.zone, remaining: 1, targetRule: { tags: ["#ID1期生"] }, excludeSourceCard: true } });
      } else if (pending.effect === "oshiDamageReaction") {
        const [kind, rawAmount] = String(option.id).split(":");
        const amount = kind === "erb" ? 0 : Number(rawAmount || 0);
        if (kind === "erb") {
          const card = unitCard(player.zones[rawAmount], map);
          assert(player.oshi?.number === "hSD13-001" && pending.meta.queuedEffect.type === "dealArtsDamage" && (card?.colors || []).includes("紅") && (cardIsBuzz(card) || card?.stage === "2nd"), "藝能傷害替代目標已改變。");
        }
        payReactiveOshi(state, playerIndex, kind, map);
        const currentHit = { ...pending.meta.queuedEffect, oshiReactionChecked: true };
        if (kind === "erb") {
          currentHit.originalTargetZone = currentHit.targetZone;
          currentHit.targetZone = rawAmount;
        } else if (player.oshi?.number === "hBP04-006" && kind === "normal") {
          for (const hit of [currentHit, ...simultaneousDamageEffects(state, currentHit)]) {
            hit.oshiReactionChecked = true;
            if (cardHasName(unitCard(player.zones[hit.targetZone], map), "大空スバル")) hit.reactionReduction = Number(hit.reactionReduction || 0) + amount;
          }
        } else currentHit.reactionReduction = Number(currentHit.reactionReduction || 0) + amount;
        state.effectQueue.unshift(currentHit);
        appendLog(state, kind === "erb" ? `${player.name} 使用秩序の先駆者，由 ${rawAmount} 的成員代受本次藝能傷害。` : `${player.name} 使用${kind === "sp" ? " SP" : ""} 推し技能，這次傷害 -${amount}。`);
      } else if (pending.effect === "giftDamageReaction") {
        const [kind] = String(option.id).split(":");
        const queuedEffect = { ...pending.meta.queuedEffect, giftReactionChecked: true };
        if (kind === "zeta") {
          markNamedUsage(player, "gift:hBP01-027", state.turn);
          const die = rollDie(random, state, playerIndex, 1, map.get("hBP01-027")); logDie(state, playerIndex, die, "因隱密行動擲骰");
          if (die % 2 === 1) queuedEffect.giftImmune = true;
          state.effectQueue.unshift(queuedEffect);
          appendLog(state, `${player.name} 的隱密行動${die % 2 === 1 ? "令這次傷害變成 0" : "沒有阻止傷害"}。`);
        } else if (kind === "flare") {
          markNamedUsage(player, "gift:hBP05-065", state.turn);
          const die = rollDie(random, state, playerIndex, 1, map.get("hBP05-065")); logDie(state, playerIndex, die, "因溫柔守護擲骰");
          const reduction = die % 2 === 1 ? 40 : 20;
          queuedEffect.reactionReduction = Number(queuedEffect.reactionReduction || 0) + reduction;
          state.effectQueue.unshift(queuedEffect);
          appendLog(state, `${player.name} 的溫柔守護令這次傷害 -${reduction}。`);
        } else if (kind === "gigiShield") {
          const sourceZone = String(option.id).split(":")[1];
          const source = player.zones[sourceZone];
          const cards = unitCard(source, map)?.number === "hSD13-012" ? source.stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem") : [];
          if (cards.length > 0) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, effect: "giftArchiveUnderForBackShield", source: "stack", prompt: "革命防線：選擇發動者Gigi下方1張Holomen存檔。", meta: { sourceZone, sourceId: topCard(source).id, queuedEffect } });
          else state.effectQueue.unshift(queuedEffect);
        } else throw new Error("Gift 防禦模式無效。 ");
      } else if (pending.effect === "giftFlowGlowKo") {
        const archived = player.mainDeck.splice(0, Math.min(2, player.mainDeck.length));
        player.archive.push(...archived);
        queueFlowGlowArchivedCards(state, playerIndex, map.get("hBP06-020"), archived, map);
        const names = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#FLOW GLOW")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name).filter(Boolean));
        const drawn = drawCards(state, playerIndex, names.size);
        appendLog(state, `${player.name} 將牌庫頂 ${archived.length} 張放到存檔區，並按舞台上 ${names.size} 個不同名 #FLOW GLOW 抽 ${drawn} 張牌。`);
      } else if (pending.effect === "giftReturnDefeated") {
        const returned = (pending.meta?.returnIds || []).map((id) => takeDefeatedCard(player, id)).filter(Boolean);
        player.hand.push(...returned);
        appendLog(state, `${player.name} 將倒下 Holomen 的 ${returned.length} 張重疊卡返回手牌。`);
      } else if (pending.effect === "giftAbilityLifeShield") {
        const sourceStillPresent = stageEntries(player).some(({ unit: stageUnit }) => topCard(stageUnit)?.id === pending.meta?.sourceId && unitCard(stageUnit, map)?.number === "hBP03-022");
        assert(sourceStillPresent, "異國世界的姿態來源已離開舞台。 ");
        addPlayerModifier(player, "abilityLifeLossImmune", 1, state.turn, "hBP03-022");
        appendLog(state, `${player.name} 本回合不會因對手卡牌能力而減少生命。`);
      } else if (pending.effect === "oshiTopThreeMode") {
        const cards = clone(pending.meta?.cards || []);
        if (option.id === "archive") {
          player.archive.push(...cards);
          appendLog(state, `${player.name} 將查看的 ${cards.length} 張牌全部放到存檔區。`);
        } else if (cards.length > 0) {
          enqueueCardSelection(state, { playerIndex, cards, min: cards.length, max: cards.length, effect: "topOrder", source: "revealed", prompt: "按次序放回牌庫頂；第 1 張會成為最頂。" });
        }
      } else if (pending.effect === "oshiArchiveTopCheer") {
        const amount = Math.min(Number(option.id || 0), player.cheerDeck.length);
        player.archive.push(...player.cheerDeck.splice(0, amount));
        triggerCheerArchivedGift(state, playerIndex, map, amount);
        appendLog(state, `${player.name} 將應援牌庫頂 ${amount} 張放到存檔區，再抽 ${drawCards(state, playerIndex, amount)} 張牌。`);
      } else if (pending.effect === "oshiKnockout") {
        const skillPlayerIndex = Number(pending.meta?.skillPlayerIndex);
        const skillPlayer = state.players[skillPlayerIndex];
        assert(skillPlayer, "推し技能玩家已改變。 ");
        payReactiveOshi(state, skillPlayerIndex, pending.meta?.kind, map);
        if (pending.meta?.trigger === "pekoraCheer") {
          const cards = (pending.meta.cheerIds || []).map((id) => defeatedCardPool(skillPlayer).find((instance) => instance.id === id)).filter(Boolean);
          if (cards.length > 0) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards, min: cards.length, max: cards.length, effect: "koTransferCheer", source: "archive", prompt: "野兎たち～：揀全部綠色應援；之後逐張直接按其他 Holomen。", meta: { targetRule: {} } });
        } else if (pending.meta?.trigger === "koroneDown") {
          const cards = defeatedCardPool(skillPlayer).filter(c => pending.meta.cheerIds.includes(c.id));
          if (cards.length && stageOptionsMatching(skillPlayer, map, {}).length) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards, min: 1, max: 1, effect: "koroneDownCheer", source: "archive", prompt: "選擇倒下成員的 1 張應援。", meta: { stackIds: pending.meta.stackIds } });
          else {
            const stack = defeatedCardPool(skillPlayer).filter(c => pending.meta.stackIds.includes(c.id));
            if (stack.length) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards: stack, min: 1, max: 1, effect: "archiveToHand", source: "archive", meta: { fromDefeated: true }, prompt: "選擇倒下成員重疊中的 1 張 Holomen 返回手牌。" });
          }
        } else if (pending.meta?.trigger === "towaDown") {
          const opponentIndex = skillPlayerIndex === 0 ? 1 : 0;
          const opponent = state.players[opponentIndex];
          const groups = ["center", "collab"].map(zone => ({ zone, ids: (opponent.zones[zone]?.cheer || []).map(c => c.id), count: Math.min(2, opponent.zones[zone]?.cheer.length || 0) }));
          const cards = ["center", "collab"].flatMap(zone => opponent.zones[zone]?.cheer || []);
          const count = groups.reduce((n,g) => n + g.count, 0);
          if (count) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards, min: count, max: count, optional: false, effect: "towaDownBottom", source: "revealed", prompt: "中央與合作各選 2 張應援（不足則全部），按返回牌庫底的次序選擇。", meta: { opponentIndex, groups } });
        } else if (pending.meta?.trigger === "noelDown") {
          queueExtraLifeLoss(state, skillPlayerIndex, skillPlayerIndex, map, "超級搞砸太郎");
          if (pending.meta.drawTwo) drawCards(state, skillPlayerIndex, 2);
        } else if (pending.meta?.trigger === "kiaraReturn") {
          queueExtraLifeLoss(state, skillPlayerIndex, skillPlayerIndex, map, "Rise from the ashes");
          const returned = (pending.meta.returnIds || []).map((id) => takeDefeatedCard(skillPlayer, id)).filter(Boolean);
          skillPlayer.hand.push(...returned);
          appendLog(state, `${skillPlayer.name} 因「Rise from the ashes」將被擊倒的紅色 Holomen 及 ${Math.max(0, returned.length - 1)} 張重疊卡返回手牌。`, returned);
        } else if (pending.meta?.trigger === "risuDraw") {
          appendLog(state, `${skillPlayer.name} 因推し技能抽 ${drawCards(state, skillPlayerIndex, 1)} 張牌。`);
        } else if (pending.meta?.trigger === "lamyFan") {
          const cards = (pending.meta.fanIds || []).map((id) => defeatedCardPool(skillPlayer).find((instance) => instance.id === id)).filter(Boolean);
          if (cards.length > 0) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards, min: 1, max: 1, effect: "archiveToHand", source: "archive", meta: { fromDefeated: true }, prompt: "我愛你：揀 1 張倒下 Holomen 的粉絲返回手牌。" });
        } else if (pending.meta?.trigger === "robocoReturn") {
          skillPlayer.archive.push(...skillPlayer.mainDeck.splice(0, 2));
          queueArchiveToHand(state, skillPlayerIndex, { group: "holomem", names: ["ロボ子さん", "蘿蔔子"] }, map, { min: 1, max: 1, optional: false, label: "我才不是PON呢！！" });
        } else if (pending.meta?.trigger === "noelSearch") {
          queueDeckToHand(state, skillPlayerIndex, { group: "holomem", tags: ["#3期生"] }, map, random, { optional: false, label: "白銀的騎士們" });
        } else if (pending.meta?.trigger === "ririkaSearch") {
          const cards = skillPlayer.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "一条莉々華"));
          if (cards.length > 0) enqueueCardSelection(state, { playerIndex: skillPlayerIndex, cards, min: 1, max: 1, optional: false, effect: "oshiRirikaSearch", source: "deck", prompt: "先公開 1 張一条莉々華；之後公開 1 張限界飯。" });
          else queueDeckToHand(state, skillPlayerIndex, { nameIncludes: ["限界飯"] }, map, random, { optional: false, label: "かわいい！ ポジティブ！ ジーニアス！" });
        } else if (pending.meta?.trigger === "fubukiMascotLife") {
          let success = false;
          for (let index = 0; index < Number(pending.meta?.rolls || 0); index += 1) {
            const die = rollDie(random, state, skillPlayerIndex, 1, map.get(skillPlayer.oshi.number)); logDie(state, skillPlayerIndex, die);
            if (die % 2 === 1) success = true;
          }
          if (success) queueExtraLifeLoss(state, Number(pending.meta?.ownerIndex), skillPlayerIndex, map, "Fubukingdom");
        } else if (pending.meta?.trigger === "flowGlowLife") {
          queueExtraLifeLoss(state, Number(pending.meta?.ownerIndex), skillPlayerIndex, map, "我要努力活下去！");
        }
      } else if (pending.effect === "hSD11FlowGlowArchiveSp") {
        payReactiveOshi(state, playerIndex, "sp", map);
        const opponentIndex = Number(pending.meta?.opponentIndex ?? (playerIndex === 0 ? 1 : 0));
        const options = stageOptionsMatching(state.players[opponentIndex], map, { zones: ["center", "collab"] });
        if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", optional: false, prompt: "Tiger Eye：選擇對手中央或合作 Holomen，造成 " + Number(pending.meta?.amount || 0) + " 點特殊傷害。", meta: { amount: Number(pending.meta?.amount || 0), loseLife: true, sourceName: "Tiger Eye" } });
      } else if (pending.effect === "oshiAfterDamage") {
        payReactiveOshi(state, playerIndex, pending.meta?.kind, map);
        const opponentIndex = playerIndex === 0 ? 1 : 0;
        if (["suiseiBack50", "suiseiMirror"].includes(pending.meta?.trigger)) {
          const amount = pending.meta.trigger === "suiseiMirror" ? Number(pending.meta?.damage || 0) : 50;
          const options = stageOptionsMatching(state.players[opponentIndex], map, { zones: BACK_SLOTS });
          if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: `推し技能：直接按對手 1 位後排，造成 ${amount} 點特殊傷害。`, meta: { amount, loseLife: true, sourceName: map.get(player.oshi?.number)?.name || "推し技能", sourceZone: pending.meta?.sourceZone || "" } });
        } else if (pending.meta?.trigger === "backshot") {
          if (state.players[opponentIndex].zones[pending.meta?.targetZone]) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: pending.meta.targetZone, amount: 50, loseLife: true, sourceName: "後方射擊", sourceZone: pending.meta?.sourceZone || "", oshiReactionChecked: false });
        } else if (pending.meta?.trigger === "shionCenter") {
          if (state.players[opponentIndex].zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount: Number(pending.meta?.amount || 0), loseLife: true, sourceName: "シオンのすごい魔法", sourceZone: pending.meta?.sourceZone || "" });
        } else if (pending.meta?.trigger === "moonaFanout") {
          queueFixedSpecialDamage(state, playerIndex, pending.meta?.sourceZone || "", ["center", "collab"], 20, "滿月的光輝");
        }
      } else {
        throw new Error("這個模式效果尚未接入。 ");
      }
    }
  } else if (pending.type === "payStageCheerForSearch") {
    const selectedOption = pending.cheerOptions?.find((option) => option.id === action.cheerId);
    const source = selectedOption && player.zones[selectedOption.zone];
    assert(selectedOption && source, "要支付的舞台應援已改變。 ");
    const cheer = removeById(source.cheer, selectedOption.id);
    assert(cheer, "找不到要支付的應援。 ");
    player.archive.push(cheer);
    triggerCheerArchivedGift(state, playerIndex, map, 1);
    const supportInstance = player.hand.find((instance) => instance.id === pending.cardId);
    const supportCard = supportInstance && map.get(supportInstance.number);
    assert(supportInstance && supportCard, "要使用的支援卡已改變。 ");
    commitSupport(state, playerIndex, supportInstance, supportCard);
    appendLog(state, `${player.name} 將舞台上的 1 張應援放到存檔區。`);
    queueDeckSearch(state, playerIndex, pending.searchRule, map, random, supportCard.name);
  } else if (pending.type === "swapOwnCenter") {
    assert(matchingPlayerModifierBonus(player, "movementLock", player.zones.center, "center", map, state.turn) === 0, "中央 Holomen 目前不能移動或替換。 ");
    assert(player.zones.center && pending.options.includes(action.zone) && player.zones[action.zone] && !player.zones[action.zone].rested, "互換位置的 Holomen 已改變。 ");
    const center = player.zones.center;
    player.zones.center = player.zones[action.zone];
    player.zones[action.zone] = center;
    appendLog(state, `${player.name} 將中央 Holomen 與所選後排 Holomen 互換位置。`);
  } else if (pending.type === "moveStageCheerSource") {
    const selectedOption = pending.cheerOptions?.find((option) => option.id === action.cheerId);
    const source = selectedOption && player.zones[selectedOption.zone];
    assert(selectedOption && source?.cheer.some((cheer) => cheer.id === selectedOption.id), "要移動的應援已改變。 ");
    const options = stageOptions(player).filter((zone) => zone !== selectedOption.zone);
    assert(options.length > 0, "已沒有其他 Holomen 可接收應援。 ");
    state.pendingChoice = { type: "moveStageCheerTarget", playerIndex, sourceZone: selectedOption.zone, cheerId: selectedOption.id, cardNumber: selectedOption.number, options, prompt: "呼喊與回應：直接按另一位 Holomen，將所選應援改附到該位置。" };
  } else if (pending.type === "moveStageCheerTarget") {
    const source = player.zones[pending.sourceZone];
    const target = player.zones[action.zone];
    assert(source && target && pending.options.includes(action.zone), "應援改附目標已改變。 ");
    const cheer = removeById(source.cheer, pending.cheerId);
    assert(cheer, "要移動的應援已改變。 ");
    attachCheerCards(state, target, [cheer]);
    appendLog(state, `${player.name} 將 1 張應援改附到 ${map.get(topCard(target)?.number)?.name || action.zone}。`);
  } else if (pending.type === "playHolomen") {
    assert(pending.options.includes(action.zone), "這個舞台位置不可使用。 ");
    const selected = removeById(player.hand, pending.cardId);
    assert(selected, "手牌已改變，請重新選擇。 ");
    player.zones[action.zone] = unit(selected, state.turn);
    appendLog(state, `${player.name} 將 ${selected.number} 放到舞台。`, [selected]);
    queueStageEntryGiftEffects(state, playerIndex, action.zone, map.get(selected.number), map);
  } else if (pending.type === "bloom") {
    assert(pending.options.includes(action.zone), "這個 Holomen 不能 Bloom。 ");
    const selected = removeById(player.hand, pending.cardId);
    assert(selected && player.zones[action.zone], "Bloom 對象已改變。 ");
    const usedBonusBloom = Number(player.zones[action.zone].bloomedTurn || 0) === state.turn;
    player.zones[action.zone].stack.push(selected);
    player.zones[action.zone].bloomedTurn = state.turn;
    currentTurnEvents(player, state.turn).bloomCount += 1;
    if (usedBonusBloom) player.bonusBloomUsedTurn = state.turn;
    appendLog(state, `${player.name} 讓 ${selected.number} Bloom。`, [selected]);
    queueBloomEffects(state, playerIndex, action.zone, map.get(selected.number), map, random);
    queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
  } else if (pending.type === "attachSupport") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone], "這個 Holomen 不能附加該支援卡。 ");
    const selected = removeById(player.hand, pending.cardId);
    assert(selected, "手牌已改變，請重新選擇。 ");
    const attachment = map.get(selected.number);
    assert(attachmentTargets(player, attachment, map).includes(action.zone), "附加目標已改變。 ");
    delete selected.risunersUsedTurn;
    player.zones[action.zone].attachments.push(selected);
    const targetCard = topCard(player.zones[action.zone]);
    appendLog(state, `${player.name} 將 ${selected.number} 附加到 ${targetCard.number}。`, [selected, targetCard]);
    queueAttachmentEntryEffects(state, playerIndex, action.zone, attachment, map, random, "hand");
  } else if (pending.type === "moveCheer") {
    if (action.skip) {
      appendLog(state, `${player.name} 略過移動應援的可選效果。`);
    } else {
      const selectedOption = pending.cheerOptions?.find((option) => option.id === action.cheerId);
      const source = selectedOption && player.zones[selectedOption.zone];
      const target = player.zones[pending.targetZone];
      assert(selectedOption && source && target, "應援或目標 Holomen 已改變。 ");
      const cheer = removeById(source.cheer, selectedOption.id);
      assert(cheer, "找不到所選應援。 ");
      attachCheerCards(state, target, [cheer]);
      appendLog(state, `${player.name} 將 ${cheer.number} 移到 ${topCard(target).number}。`, [cheer, topCard(target)]);
    }
  } else if (pending.type === "archiveCheerForSkill") {
    if (action.skip && pending.optional) appendLog(state, `${player.name} 取消使用「綠色試管」的追加技能。`);
    else {
      const selectedOption = pending.cheerOptions?.find((option) => option.id === action.cheerId);
      const source = selectedOption && player.zones[pending.sourceZone];
      assert(selectedOption && source, "所選應援已改變。 ");
      const cheer = removeById(source.cheer, selectedOption.id);
      assert(cheer, "找不到所選應援。 ");
      player.archive.push(cheer);
      triggerCheerArchivedGift(state, playerIndex, map, 1);
      const options = pending.targetOptions.filter((zone) => player.zones[zone]?.rested && cardHasTag(map.get(topCard(player.zones[zone])?.number), "#秘密結社holoX"));
      assert(options.length > 0, "已沒有可轉為活動狀態的目標。 ");
      state.pendingChoice = { type: "unrestTarget", playerIndex, options, prompt: "綠色試管：按 1 位休息中的 #秘密結社holoX Holomen 轉為活動狀態。" };
      appendLog(state, `${player.name} 將「綠色試管」所在 Holomen 的 1 張應援放到存檔區。`);
    }
  } else if (pending.type === "unrestTarget") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone]?.rested, "轉為活動狀態的目標無效。 ");
    player.zones[action.zone].rested = false;
    appendLog(state, `${player.name} 將 ${map.get(topCard(player.zones[action.zone]).number)?.name || action.zone} 轉為活動狀態。`);
  } else if (pending.type === "healTarget") {
    if (action.skip && pending.optional) {
      appendLog(state, `${player.name} 略過 HP 回復。`);
    } else {
      assert(pending.options.includes(action.zone) && player.zones[action.zone], "HP 回復目標無效。 ");
      const amount = healStageUnit(state, playerIndex, action.zone, pending.amount, map);
      appendLog(state, `${player.name} 的 ${map.get(topCard(player.zones[action.zone]).number)?.name || action.zone} 回復 ${amount} HP。`);
    }
  } else if (pending.type === "healDistribution") {
    const allocations = action.allocations && typeof action.allocations === "object" ? action.allocations : {};
    const normalized = Object.entries(allocations).map(([zone, rawCount]) => [zone, Number(rawCount)]);
    assert(normalized.every(([zone, count]) => pending.options.includes(zone) && player.zones[zone] && Number.isInteger(count) && count >= 0), "HP 回復分配無效。 ");
    const assigned = normalized.reduce((sum, [, count]) => sum + count, 0);
    assert(assigned === Number(pending.count || 0), `必須分配全部 ${pending.count || 0} 個回復次數。 `);
    const details = [];
    let totalHealed = 0;
    normalized.filter(([, count]) => count > 0).forEach(([zone, count]) => {
      const requested = count * Number(pending.unitAmount || 20);
      const healed = healStageUnit(state, playerIndex, zone, requested, map);
      totalHealed += healed;
      details.push(`${map.get(topCard(player.zones[zone]).number)?.name || zone} ${pending.unitAmount || 20}×${count}（實際 ${healed}）`);
    });
    appendLog(state, `${player.name} 以「${pending.sourceName || "卡牌效果"}」分配 HP 回復：${details.join("、")}；合共回復 ${totalHealed} HP。`);
  } else if (pending.type === "eventCheerTarget") {
    if (action.skip && pending.optional) {
      appendLog(state, `${player.name} 略過額外附加應援。`);
    } else {
      assert(pending.options.includes(action.zone) && player.zones[action.zone], "應援目標無效。 ");
      const cheer = pending.cheerCard || player.cheerDeck.shift();
      assert(cheer, "應援牌庫已空。 ");
      attachCheerCards(state, player.zones[action.zone], [cheer]);
      if (pending.afterUnrest) player.zones[action.zone].rested = false;
      if (pending.shuffleAfter) player.cheerDeck = shuffle(player.cheerDeck, random);
      const targetCard = topCard(player.zones[action.zone]);
      appendLog(state, `${player.name} 從應援牌庫將 ${cheer.number} 附加到 ${targetCard.number}${pending.shuffleAfter ? "，並洗牌" : ""}。`, [cheer, targetCard]);
      if (pending.afterEffect === "oshiFlowGlowCheerBuff") {
        const options = stageOptionsMatching(player, map, { tags: ["#FLOW GLOW"] });
        if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "oshiFlowGlowBuff", prompt: "再按 1 位 #FLOW GLOW Holomen；本回合每張應援令 Arts +20。" });

      } else if (pending.afterEffect === "genericDraw") {
        appendLog(state, `${player.name} 抽 ${drawCards(state, playerIndex, Number(pending.drawAfter || 0))} 張牌。`);
      } else if (pending.afterEffect === "healSource") {
        const source = player.zones[pending.afterZone];
        if (source && (source.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool")) {
          const healed = healStageUnit(state, playerIndex, pending.afterZone, pending.healAmount, map);
          appendLog(state, `${unitCard(source, map)?.name || pending.afterZone} 因裝備工具回復 ${healed} HP。`);
        }
      } else if (pending.afterEffect === "returnCollabActiveToBack") {
        const sourceZone = stageZoneByTopId(player, pending.sourceId);
        const source = sourceZone && player.zones[sourceZone];
        const destination = sourceZone === "collab" ? (source.returnSlot && !player.zones[source.returnSlot] ? source.returnSlot : emptyBackSlots(player)[0]) : "";
        if (source && destination) {
          player.zones[sourceZone] = null;
          player.zones[destination] = source;
          source.returnSlot = null;
          appendLog(state, `${unitCard(source, map)?.name || "效果來源"} 因骰子為 1 移到後排。`);
        }
      }
    }
  } else if (pending.type === "lifeCheerTarget") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone], "生命應援的附加目標無效。 ");
    assert(pending.cheerCard, "找不到公開的生命應援。 ");
    attachCheerCards(state, player.zones[action.zone], [pending.cheerCard]);
    const targetCard = topCard(player.zones[action.zone]);
    appendLog(state, `${player.name} 將公開的生命應援附加到 ${targetCard.number}。`, [targetCard], { revealRefs: [targetCard] });
    if (pending.winnerAfter) finishGame(state, pending.sourcePlayerIndex);
  } else if (pending.type === "forcedCollab") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone] && !player.zones.collab, "移到合作位置的目標無效。 ");
    player.zones.collab = player.zones[action.zone];
    player.zones[action.zone] = null;
    player.zones.collab.returnSlot = action.zone;
    if (pending.type === "forcedCollab") queueCollabMoveGift(state, playerIndex, map);
    appendLog(state, `${player.name} 因對手的「等待來電」將 1 位後排 Holomen 移到合作位置；這次移動不視為合作。`);
  } else if (pending.type === "attachArchivedSupport") {
    if (action.skip && pending.optional) {
      appendLog(state, `${player.name} 略過從存檔區附加支援卡。`);
    } else {
      assert(pending.options.includes(action.zone) && player.zones[action.zone], "附加目標無效。 ");
      const support = removeById(player.archive, pending.cardId);
      assert(support, "存檔區的支援卡已改變。 ");
      delete support.risunersUsedTurn;
      player.zones[action.zone].attachments.push(support);
      const targetCard = topCard(player.zones[action.zone]);
      appendLog(state, `${player.name} 從存檔區將 ${support.number} 附加到 ${targetCard.number}。`, [support, targetCard]);
      queueAttachmentEntryEffects(state, playerIndex, action.zone, map.get(support.number), map, random, "archive");
      if (pending.afterEffect === "fieldStaffHolomem") queueArchiveToHand(state, playerIndex, { group: "holomem" }, map, { min: 1, max: 1, optional: false, label: "現場工作人員" });
    }
  } else if (pending.type === "bonusBloomTarget") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone], "額外 Bloom 目標無效。 ");
    const selected = removeById(player.hand, pending.cardId);
    const selectedCard = selected && map.get(selected.number);
    assert(selected && selectedCard && bloomTargets(player, selectedCard, map, state.turn).includes(action.zone), "額外 Bloom 的卡片或目標已改變。 ");
    player.zones[action.zone].stack.push(selected);
    player.zones[action.zone].bloomedTurn = state.turn;
    currentTurnEvents(player, state.turn).bloomCount += 1;
    player.bonusBloomUsedTurn = state.turn;
    appendLog(state, `${player.name} 因「綻放舞台」讓 ${selected.number} 額外 Bloom。`, [selected]);
    queueBloomEffects(state, playerIndex, action.zone, selectedCard, map, random);
    queueAttachmentBloomEffects(state, playerIndex, action.zone, map);
  } else if (pending.type === "endToolDamage") {
    if (action.skip) {
      appendLog(state, `${player.name} 略過「萬事爆解！」的表演階段結束效果。`);
    } else {
      assert(pending.options.includes(action.zone) && player.zones[action.zone], "「萬事爆解！」的來源無效。 ");
      const source = player.zones[action.zone];
      const attachmentIndex = source.attachments.findIndex((instance) => instance.number === "hEB01-034");
      assert(attachmentIndex >= 0, "找不到要放到存檔區的「萬事爆解！」。 ");
      const [tool] = source.attachments.splice(attachmentIndex, 1);
      player.archive.push(tool);
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      const opponent = state.players[opponentIndex];
      if (opponent.zones.center) {
        if (!jacketProtectsHp(state, opponent.zones.center, opponent, player, map)) opponent.zones.center.damage += 30;
        appendLog(state, `${player.name} 將「萬事爆解！」放到存檔區，給對手中央 Holomen 30 點特殊傷害。`);
        const centerCard = map.get(topCard(opponent.zones.center)?.number);
        const hp = Number(centerCard?.hp || Infinity) + attachmentHpBonus(opponent.zones.center, map, "center", opponent) + holomemHpBonus(opponent.zones.center, map, "center", opponent);
        if (opponent.zones.center.damage >= hp) knockOutUnit(state, opponentIndex, "center", map, playerIndex);
      } else appendLog(state, `${player.name} 將「萬事爆解！」放到存檔區，但對手中央位置為空。`);
    }
  } else if (pending.type === "ordinaryComputer") {
    if (action.skip && pending.optional) {
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 沒有用普通電腦從牌庫公開 Debut Holomen；牌庫已洗牌。`);
    } else {
      assert(pending.options.includes(action.cardNumber) && pending.zones.includes(action.zone), "普通電腦的選擇無效。 ");
      const deckIndex = player.mainDeck.findIndex((card) => card.number === action.cardNumber);
      assert(deckIndex >= 0 && !player.zones[action.zone], "所選 Debut 或舞台位置已改變。 ");
      const [selected] = player.mainDeck.splice(deckIndex, 1);
      player.zones[action.zone] = unit(selected, state.turn);
      player.mainDeck = shuffle(player.mainDeck, random);
      appendLog(state, `${player.name} 用普通電腦公開 ${selected.number} 並放到舞台；牌庫已洗牌。`, [selected]);
      queueStageEntryGiftEffects(state, playerIndex, action.zone, map.get(selected.number), map);
    }
  } else if (pending.type === "cheerTarget") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone], "應援目標無效。 ");
    const cheer = player.cheerDeck.shift();
    assert(cheer, "應援牌組已空。 ");
    attachCheerCards(state, player.zones[action.zone], [cheer]);
    const targetCard = topCard(player.zones[action.zone]);
    appendLog(state, `${player.name} 將 ${cheer.number} 附加到 ${targetCard.number}。`, [cheer, targetCard]);
    state.phase = "main";
  } else if (pending.type === "centerReplacement") {
    assert(pending.options.includes(action.zone) && player.zones[action.zone] && !player.zones.center, "中央替補選擇無效。 ");
    player.zones.center = player.zones[action.zone];
    player.zones[action.zone] = null;
    appendLog(state, `${player.name} 將 ${map.get(topCard(player.zones.center).number)?.name || "後排 Holomen"} 移到中央位置。`);
    if (pending.after === "draw") drawAndQueueCheer(state, playerIndex);
    else startFollowingTurn(state, playerIndex, map);
  }
}

function stageOptions(player) {
  return STAGE_SLOTS.filter((slot) => Boolean(player.zones[slot]));
}

function drawAndQueueCheer(state, playerIndex) {
  const player = state.players[playerIndex];
  if (player.mainDeck.length === 0) {
    state.status = "finished";
    state.winner = playerIndex === 0 ? 1 : 0;
    state.phase = "finished";
    appendLog(state, `${player.name} 無法抽牌，${state.players[state.winner].name} 勝出。`);
    return;
  }
  player.hand.push(player.mainDeck.shift());
  appendLog(state, `${player.name} 在手牌步驟自動抽 1 張。`);
  const options = stageOptions(player);
  if (player.cheerDeck.length > 0 && options.length > 0) {
    state.phase = "cheer";
    state.pendingChoice = { type: "cheerTarget", playerIndex, cardNumber: player.cheerDeck[0].number, options };
    appendLog(state, `${player.name} 在應援步驟公開 ${player.cheerDeck[0].number}；必須選擇附加對象。`, [player.cheerDeck[0]], { revealRefs: [player.cheerDeck[0]] });
  } else {
    state.phase = "main";
    state.pendingChoice = null;
  }
}

function centerReplacementOptions(player) {
  const active = BACK_SLOTS.filter((slot) => player.zones[slot] && !player.zones[slot].rested);
  return active.length > 0 ? active : BACK_SLOTS.filter((slot) => Boolean(player.zones[slot]));
}

function returnCollabToBack(player, map) {
  const collabUnit = player.zones.collab;
  if (!collabUnit) return;
  const preferred = BACK_SLOTS.includes(collabUnit.returnSlot) && !player.zones[collabUnit.returnSlot] ? collabUnit.returnSlot : null;
  const destination = preferred || BACK_SLOTS.find((slot) => !player.zones[slot]);
  assert(destination, "合作 Holomen 沒有可返回的後排位置。 ");
  player.zones.collab = null;
  player.zones[destination] = collabUnit;
  const staysActive = (unitCard(collabUnit, map)?.number === "hBP03-039" && cardHasName(unitCard(player.zones.center, map), "フワワ・アビスガード")) || ((player.modifiers || []).some(modifier => modifier.kind === "raoraReset") && cardHasName(unitCard(collabUnit, map), "ラオーラ・パンテーラ"));
  collabUnit.rested = !staysActive;
  collabUnit.returnSlot = null;
  return staysActive;
}

function beginTurn(state, playerIndex, map) {
  const player = state.players[playerIndex];
  // Hawkeye lasts for the next turn of the affected player, not the next
  // numerical turn. An extra turn by its caster must not start or expire it.
  for (const modifier of player.modifiers || []) {
    if (modifier.waitingForOwnerTurn) {
      delete modifier.waitingForOwnerTurn;
      modifier.expiresTurn = state.turn;
    }
  }
  player.turnsTaken = Number(player.turnsTaken || 0) + 1;
  state.pendingChoice = null;
  if (player.turnsTaken > 1) {
    state.phase = "reset";
    for (const slot of STAGE_SLOTS) {
      const stageUnit = player.zones[slot];
      if (!stageUnit) continue;
      const ceciliaResetLocked = player.oshi?.number === "hBP08-002" && cardHasName(unitCard(stageUnit, map), "セシリア・イマーグリーン");
      if (ceciliaResetLocked) {
        stageUnit.rested = true;
        appendLog(state, `${player.name} 的 ${unitCard(stageUnit, map)?.name || slot} 因「Justiceの古代自動人形」不會在重置步驟變成活動狀態。`);
      } else if (Number(stageUnit.skipUnrestTurn || 0) === state.turn) {
        stageUnit.rested = true;
        appendLog(state, `${player.name} 的 ${unitCard(stageUnit, map)?.name || slot} 因效果略過本次重置。`);
      } else stageUnit.rested = false;
    }
    const collabLocked = player.zones.collab && matchingPlayerModifierBonus(player, "movementLock", player.zones.collab, "collab", map, state.turn) > 0;
    if (collabLocked) appendLog(state, `${player.name} 完成重置；聯動 Holomen 受ホークアイ [hBP01-005] 限制，留在原位，不會因退回後排而休息。`);
    else {
      const collabStayedActive = returnCollabToBack(player, map);
      appendLog(state, `${player.name} 完成重置；合作 Holomen 返回後排並${collabStayedActive ? "因 Gift 保持活動" : "保持休息"}。`);
    }
    if (!player.zones.center) {
      const options = centerReplacementOptions(player);
      if (options.length > 0) {
        state.pendingChoice = { type: "centerReplacement", playerIndex, options, after: "draw" };
        return;
      }
    }
  }
  drawAndQueueCheer(state, playerIndex);
}

function startNextTurn(state, map) {
  state.activePlayer = state.activePlayer === 0 ? 1 : 0;
  state.turn += 1;
  appendLog(state, `${state.players[state.activePlayer].name} 的第 ${state.turn} 回合開始。`);
  beginTurn(state, state.activePlayer, map);
}

function startFollowingTurn(state, playerIndex, map) {
  const player = state.players[playerIndex];
  if (Number(player.extraTurnPending || 0) > 0) {
    player.extraTurnPending -= 1;
    state.activePlayer = playerIndex;
    state.turn += 1;
    appendLog(state, `${player.name} 因「時間的監牢」開始額外回合。`);
    beginTurn(state, playerIndex, map);
  } else startNextTurn(state, map);
}

function completeEndStep(state, playerIndex, map) {
  const player = state.players[playerIndex];
  if (!player.zones.center) {
    const options = centerReplacementOptions(player);
    if (options.length > 0) {
      state.pendingChoice = { type: "centerReplacement", playerIndex, options, after: "nextTurn" };
      appendLog(state, `${player.name} 的中央位置為空；須先由後排補上。`);
      return;
    }
  }
  startFollowingTurn(state, playerIndex, map);
}

function resolveEndOshiStageSkills(state, playerIndex, map) {
  const player = state.players[playerIndex];
  const usageKey = `oshi-stage:end:${player.oshi?.number}`;
  if (usedNamedThisTurn(player, usageKey, state.turn)) return;

  if (player.oshi?.number === "hEB01-001"
    && cardHasName(unitCard(player.zones.center, map), "ときのそら")
    && cardHasName(unitCard(player.zones.collab, map), "ときのそら")) {
    markNamedUsage(player, usageKey, state.turn);
    const power = player.mainDeck.shift();
    if (power) {
      player.holoPower.push(power);
      appendLog(state, `${player.name} 因「浜辺のヴィーナス」將牌庫頂 1 張放到 Holo Power。`);
    }
    if (stageEntries(player).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd")) {
      appendLog(state, `${player.name} 因舞台上有 2nd Holomen，再抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    }
  }

  if (player.oshi?.number === "hBP08-005"
    && cardHasName(unitCard(player.zones.center, map), "鷹嶺ルイ")
    && player.zones.collab) {
    markNamedUsage(player, usageKey, state.turn);
    const drawn = drawCards(state, playerIndex, Math.max(0, 4 - player.hand.length));
    appendLog(state, `${player.name} 因「もう金曜だねルイ姉」抽 ${drawn} 張，令手牌達到 4 張。`);
  }
}

function finishTurn(state, playerIndex, map) {
  const player = state.players[playerIndex];
  const endedPerformance = state.phase === "performance";
  state.phase = "end";
  resolveEndOshiStageSkills(state, playerIndex, map);
  if (endedPerformance) {
    const defenderIndex = playerIndex === 0 ? 1 : 0;
    const defender = state.players[defenderIndex];
    const kanadeSwapOptions = player.oshi?.number === "hBP08-007" && Number(player.oshiSkillTurn || 0) !== state.turn && player.zones.center && cardHasName(unitCard(player.zones.center, map), "音乃瀬奏") && Number(player.zones.center.lastArtsTurn || 0) === state.turn
      ? stageOptionsMatching(player, map, { zones: BACK_SLOTS, tags: ["#ReGLOSS"] })
      : [];
    const archiveCheerAtEnd = (player.modifiers || []).find((modifier) => modifier.kind === "archiveCheerAtEnd" && Number(modifier.expiresTurn || 0) >= state.turn);
    const pufferTriggers = ["center", "collab"].filter((zone) => {
      const stageUnit = player.zones[zone];
      return stageUnit && Number(stageUnit.lastArtsTurn || 0) === state.turn && cardHasTag(unitCard(stageUnit, map), "#FLOW GLOW") && stageUnit.attachments.some((instance) => instance.number === "hSD10-013");
    });
    const toolTriggers = ["center", "collab"].filter((zone) => {
      const stageUnit = player.zones[zone];
      const card = map.get(topCard(stageUnit)?.number);
      return stageUnit && card?.stage === "2nd" && isKoyoriCard(card) && stageUnit.attachments?.some((instance) => instance.number === "hEB01-034");
    });
    const defenderGiftTriggers = [];
    for (const { zone, unit: giftUnit } of stageEntries(defender)) {
      const giftCard = unitCard(giftUnit, map);
      if (!giftZoneApplies(giftText(giftUnit, map), zone)) continue;
      if (giftCard?.number === "hBP03-083" && (state.lifeLosses || []).some((entry) => entry.turn === state.turn && entry.phase === "performance" && entry.ownerIndex === defenderIndex)) {
        const cheers = defender.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
        if (cheers.length > 0) defenderGiftTriggers.push({ type: "cardSelection", playerIndex: defenderIndex, cards: clone(cheers), selectableIds: cheers.map((card) => card.id), min: 0, max: 1, prompt: "なんちゅーこった：可揀存檔區 1 張應援，附加到 Gift 來源。", effect: "archiveCheerToStage", source: "archive", optional: true, meta: { targetZone: zone, targetRule: { zones: [zone] } } });
      }
      if (giftCard?.number === "hBP05-055" && Number(giftUnit.damage || 0) === 0 && defender.cheerDeck.length > 0) defenderGiftTriggers.push({ type: "eventCheerTarget", playerIndex: defenderIndex, targetRule: { names: ["癒月ちょこ"] }, optional: true, prompt: "睡過頭惡魔：可直接按自己 1 位癒月ちょこ，附加應援牌庫頂 1 張。" });
    }
    if (pufferTriggers.length > 0 || toolTriggers.length > 0 || kanadeSwapOptions.length > 0 || archiveCheerAtEnd || defenderGiftTriggers.length > 0) {
      pufferTriggers.forEach((sourceZone) => enqueueEffect(state, { type: "endPuffer", playerIndex, sourceZone }));
      toolTriggers.forEach((sourceZone) => enqueueEffect(state, { type: "endToolDamage", playerIndex, sourceZone }));
      if (kanadeSwapOptions.length > 0) enqueueStageTarget(state, { playerIndex, options: kanadeSwapOptions, effect: "oshiKanadeSwap", optional: true, prompt: "奏出的旋律：可直接按 1 位 #ReGLOSS 後排，與中央音乃瀬奏互換。" });
      if (archiveCheerAtEnd) enqueueStageCheerSelection(state, { playerIndex, effect: "endKanadeArchive", min: 1, max: 1, prompt: "啪啪謝謝你！：直接按舞台上 1 張應援放到存檔區（共 3 張）。", meta: { remaining: Number(archiveCheerAtEnd.amount || 3) } });
      defenderGiftTriggers.forEach((effect) => enqueueEffect(state, effect));
      enqueueEffect(state, { type: "completeEndStep", playerIndex });
      return;
    }
  }
  completeEndStep(state, playerIndex, map);
}

function advancePhase(state, playerIndex, map) {
  assert(state.status === "playing" && state.activePlayer === playerIndex, "現在不是你的回合。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  if (state.phase === "main") {
    const player = state.players[playerIndex];
    if (playerIndex === state.firstPlayer && Number(player.turnsTaken || 0) === 1) {
      appendLog(state, `${player.name} 是先攻玩家，第 1 回合略過表演階段。`);
      finishTurn(state, playerIndex, map);
      return;
    }
    state.phase = "performance";
    appendLog(state, `${player.name} 進入表演階段。`);
    queuePerformanceStartGiftEffects(state, playerIndex, map);
  } else if (state.phase === "performance") {
    finishTurn(state, playerIndex, map);
  } else {
    throw new Error("目前不能前往下一階段。 ");
  }
}

function collab(state, playerIndex, action, map, random) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段進行合作。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];
  assert(BACK_SLOTS.includes(action.zone) && player.zones[action.zone], "請選擇後排 Holomen。 ");
  assert(!player.zones[action.zone].rested, "休息中的後排 Holomen 不可進行合作。 ");
  assert(!player.zones.collab, "合作位置已被佔用。 ");
  assert(player.collabTurn !== state.turn, "本回合已進行過合作。 ");
  assert(player.mainDeck.length > 0, "主牌庫已空，無法將牌庫頂送到 Holo Power，因此不能合作。 ");
  player.zones.collab = player.zones[action.zone];
  player.zones[action.zone] = null;
  player.zones.collab.returnSlot = action.zone;

  player.zones.collab.rested = false;
  player.zones.collab.collabbedTurn = state.turn;
  const collabCard = map.get(topCard(player.zones.collab)?.number);
  if (isKoyoriCard(collabCard) && player.zones.collab.attachments?.some((instance) => instance.number === "hBP04-100")) player.zones.collab.koyoriMascotBonusTurn = state.turn;
  player.collabTurn = state.turn;
  const power = player.mainDeck.shift();
  if (power) player.holoPower.push(power);
  appendLog(state, `${player.name} 進行合作；該 Holomen 保持活動狀態，牌庫頂 1 張移到 Holo Power。`);
  queueCollabMoveGift(state, playerIndex, map);
  queueCollabEffects(state, playerIndex, collabCard, map, random);
  queueAttachmentCollabEffects(state, playerIndex, map);
  queueStageGiftCollabEffects(state, playerIndex, collabCard, map);
}

function cheerCanPay(attached, cost, map) {
  const sources = attached.map((instance) => map.get(instance.number)?.colors || []);
  const colored = cost.filter((value) => value !== "無色");
  const colorless = cost.length - colored.length;
  const matchColored = (requirementIndex, used) => {
    if (requirementIndex >= colored.length) return sources.length - used.size >= colorless;
    const requirement = colored[requirementIndex];
    for (let index = 0; index < sources.length; index += 1) {
      if (used.has(index) || !sources[index].includes(requirement)) continue;
      used.add(index);
      if (matchColored(requirementIndex + 1, used)) return true;
      used.delete(index);
    }
    return false;
  };
  return matchColored(0, new Set());
}

function attachmentVirtualCheerColors(stageUnit, map, player) {
  const source = unitCard(stageUnit, map);
  return (stageUnit.attachments || []).flatMap((instance) => {
    if (instance.number === "hBP01-118" && cardHasName(source, "ときのそら")) return ["白"];
    if (["hBP01-126", "hBP03-107"].includes(instance.number)) return ["紅"];
    if (instance.number === "hBP03-110") return ["紫"];
    if (instance.number === "hBP07-108" && cardHasName(map.get(player?.oshi?.number), "ベスティア・ゼータ")) return ["白"];
    return [];
  });
}

function cheerCanPayForUnit(stageUnit, cost, map, player) {
  const actual = (stageUnit.cheer || []).map((instance, index) => ({ id: instance.id, number: `effective-${index}-${instance.id}`, virtualColors: effectiveCheerColors(player, stageUnit, instance, map) }));
  const virtual = attachmentVirtualCheerColors(stageUnit, map, player).map((color, index) => ({ id: `virtual-${index}`, number: `virtual-${color}-${index}`, virtualColors: [color] }));
  const proxyMap = new Map(map);
  [...actual, ...virtual].forEach((instance) => proxyMap.set(instance.number, { colors: instance.virtualColors }));
  return cheerCanPay([...actual, ...virtual], cost, proxyMap);
}

function jacketProtectsHp(state, target, owner, sourcePlayer, map) {
  return state?.phase === "main" && owner !== sourcePlayer && state.players[state.activePlayer] === sourcePlayer && cardIsBuzz(unitCard(target, map)) && target.attachments.some(c => c.number === "hBP06-097");
}
function attachmentDamageAdjustment(stageUnit, map, zone, player, opponent, kind = "arts", state = null) {
  // These are passive received-damage effects. Optional archive reactions are
  // resolved by prepareAttachmentDamageReaction and must not apply twice.
  const target = unitCard(stageUnit, map);
  let adjustment = 0;
  let immune = false;
  if (jacketProtectsHp(state, stageUnit, player, opponent, map)) immune = true;
  const opposingSource = player !== opponent;
  for (const instance of stageUnit.attachments || []) {
    const number = instance.number;
    if (["hBP01-121", "hSD03-013"].includes(number) && ["center", "collab"].includes(zone)) adjustment -= 10;
    if (number === "hBP02-100") adjustment -= 10;
    if (number === "hBP01-126") adjustment += 10;
    if (number === "hBP02-086" && !cardHasTag(target, "#お酒")) adjustment += 10;
    if (!opposingSource) continue;
    if (number === "hBP02-093" && BACK_SLOTS.includes(zone) && cardHasName(target, "白上フブキ")) immune = true;
    if (number === "hBP04-102" && BACK_SLOTS.includes(zone) && ["1st", "2nd"].includes(target?.stage) && cardHasTag(target, "#5期生")) immune = true;
    if (number === "hBP03-095" && kind === "special" && ["Debut", "Spot"].includes(target?.stage)) immune = true;
  }
  return { adjustment, immune };
}

function attachmentSpecialDamageBonus(stageUnit, map, zone, targetZone) {
  const source = unitCard(stageUnit, map);
  return (stageUnit?.attachments || []).reduce((total, instance) => {
    if (instance.number === "hBP03-096" && ["1st", "2nd"].includes(source?.stage) && cardHasTag(source, "#シューター")) return total + 10;
    if (instance.number === "hBP03-101" && cardHasName(source, "常闇トワ")) return total + 10;
    if (instance.number === "hBP04-106" && cardHasName(source, "雪花ラミィ") && targetZone === "center") return total + 10;
    return total;
  }, 0);
}

function attachmentBlocks(card) {
  return String(card?.abilityText || "").replaceAll("\r", "").split(/◆/u).map((text) => text.trim()).filter(Boolean);
}

function attachmentBlockApplies(block, stageUnit, zone, map, player, opponent = null) {
  const card = unitCard(stageUnit, map);
  const requiredOshi = block.match(/自己的推しHolomen是〈([^〉]+)〉/u)?.[1];
  if (requiredOshi && !cardHasName(map.get(player?.oshi?.number), requiredOshi)) return false;
  const conditionalLead = block.match(/(?:若|如果|如|當).*?(?:附著|附加|附在|裝備|所在|帶有)[^。\n]*/u)?.[0] || "";
  const directLead = !conditionalLead && /(?:裝備|附著|附加)[^。\n]*〈[^〉]+〉/u.test(block) ? block.split(/[。\n]/u)[0] : "";
  const lead = conditionalLead || directLead;
  const names = [...lead.matchAll(/〈([^〉]+)〉/gu)].map((match) => match[1]);
  if (names.length > 0 && !names.some((name) => cardHasName(card, name))) return false;
  if (/1st以上/u.test(lead) && !["1st", "2nd"].includes(card?.stage)) return false;
  if (/2nd(?:以上|位置)?/u.test(lead) && card?.stage !== "2nd") return false;
  if (/Buzz/u.test(lead) && !cardIsBuzz(card)) return false;
  const knownTags = ["#お酒", "#シューター", "#ID3期生", "#5期生", "#FLOW GLOW", "#サマー"];
  const tags = knownTags.filter((tag) => lead.includes(tag));
  if (tags.length > 0 && !tags.some((tag) => cardHasTag(card, tag))) return false;
  if (/#FLOW GLOW/u.test(block) && /(?:持有|具有|擁有)#FLOW GLOW/u.test(block) && !cardHasTag(card, "#FLOW GLOW")) return false;
  if (/僅限(?:中央|中心|Center)位置/u.test(block) && zone && zone !== "center") return false;
  if (/僅限(?:合作|Collab)位置/u.test(block) && zone && zone !== "collab") return false;
  if (/僅限後排位置/u.test(block) && zone && !BACK_SLOTS.includes(zone)) return false;
  if (/中央位置・合作位置|中心位置・合作位置|Center位置・Collab位置/u.test(block) && zone && !["center", "collab"].includes(zone)) return false;
  if (/3張以上的應援/u.test(block) && stageUnit.cheer.length < 3) return false;
  if (/雙方舞台上的應援卡合計有10張以上/u.test(block) && player && totalCheer(player) + totalCheer(opponent || { zones: {} }) < 10) return false;
  if (/HP減少/u.test(block) && Number(stageUnit.damage || 0) <= 0) return false;
  if (/白應援與紫應援/u.test(block)) {
    const colors = new Set(stageCheerColors(player, stageUnit, map));
    if (!colors.has("白") || !colors.has("紫")) return false;
  }
  if (/下方重疊的Holomen為0張/u.test(block) && stageUnit.stack.slice(0, -1).some(instance => map.get(instance.number)?.group === "holomem")) return false;
  return true;
}

function sumBonuses(text, pattern) {
  return [...text.matchAll(pattern)].reduce((sum, match) => sum + Number(match[1] || 0) * (match[0].includes("-") || match[0].includes("−") ? -1 : 1), 0);
}

function attachmentHpBonus(stageUnit, map, zone = "", player = null) {
  return (stageUnit.attachments || []).reduce((total, instance) => {
    const card = map.get(instance.number);
    if (card?.number === "hBP03-095" && !["Debut", "Spot"].includes(unitCard(stageUnit, map)?.stage)) return total;
    return total + attachmentBlocks(card).reduce((sum, block) => attachmentBlockApplies(block, stageUnit, zone, map, player)
      ? sum + sumBonuses(block, /HP\s*(?:[+＋]|增加)\s*(\d+)/giu)
      : sum, 0);
  }, 0);
}

function giftText(stageUnit, map) {
  const card = unitCard(stageUnit, map);
  return card?.keyword?.type === "gift" ? String(card.keyword.effect || "") : "";
}

function giftZoneApplies(text, zone) {
  if (/僅限(?:合作|Collab|聯動)位置|(?:合作|Collab|聯動)位置限定|限合作位置|限定合作站位|僅能在合作位置/u.test(text)) return zone === "collab";
  if (/僅限(?:中央|中心|中間|Center)位置[・・、與和](?:合作|合體|Collab)位置|僅限(?:中央|中心|中間|Center)位置・(?:合作|合體|Collab)位置/u.test(text)) return ["center", "collab"].includes(zone);
  if (/僅限(?:中央|中心|中間|Center)位置/u.test(text)) return zone === "center";
  if (/僅限(?:後排|後台|後場)(?:位置)?|(?:後排|後台|後場)位置限定|限(?:後排|後台|後場)位置/u.test(text)) return BACK_SLOTS.includes(zone);
  return true;
}

function stageHasNamedAttachment(stageUnit, map, names) {
  return (stageUnit?.attachments || []).some((instance) => names.some((name) => cardHasName(map.get(instance.number), name)));
}

function holomemHpBonus(stageUnit, map, zone = "", player = null) {
  const text = giftText(stageUnit, map);
  if (!text || !giftZoneApplies(text, zone)) return 0;
  let bonus = 0;
  const perStack = text.match(/每有1張重疊在(?:此|這位)Holomen上的Holomen卡[^。]*?HP\s*[+＋]\s*(\d+)/iu);
  if (perStack) bonus += Math.max(0, (stageUnit.stack || []).length - 1) * Number(perStack[1]);
  const perCheer = text.match(/每有1張(?:這位Holomen的|附在(?:此|這位)Holomen上的)?應援[^。]*?HP\s*[+＋]\s*(\d+)/iu);
  if (perCheer) bonus += (stageUnit.cheer || []).length * Number(perCheer[1]);
  const perNamedAttachment = text.match(/每(?:帶有|附有)1張[「〈]([^」〉]+)[」〉][^。]*?HP\s*[+＋]\s*(\d+)/u);
  if (perNamedAttachment) bonus += (stageUnit.attachments || []).filter((instance) => cardHasName(map.get(instance.number), perNamedAttachment[1])).length * Number(perNamedAttachment[2]);
  if (/帶有吉祥物|附有吉祥物|裝備有吉祥物/u.test(text) && (stageUnit.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) {
    bonus += Number(text.match(/HP\s*[+＋]\s*(\d+)/u)?.[1] || 0);
  }
  const namedCondition = text.match(/(?:已|若這位Holomen已)裝備[〈「]([^〉」]+)[〉」][^。]*?HP\s*[+＋]\s*(\d+)/u);
  if (namedCondition && stageHasNamedAttachment(stageUnit, map, [namedCondition[1]])) bonus += Number(namedCondition[2]);
  if (/舞台上有持有#ReGLOSS的2nd/u.test(text) && stageEntries(player || { zones: {} }).some(({ unit: candidate }) => unitCard(candidate, map)?.stage === "2nd" && cardHasTag(unitCard(candidate, map), "#ReGLOSS"))) {
    bonus += Number(text.match(/HP\s*[+＋]\s*(\d+)/u)?.[1] || 0);
  }
  return bonus;
}

function giftArtsBonus(state, playerIndex, sourceZone, map) {
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const source = player.zones[sourceZone];
  const sourceCard = unitCard(source, map);
  let bonus = 0;
  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    const text = giftText(giftUnit, map);
    if (!text || !giftZoneApplies(text, zone)) continue;
    if (giftCard.number === "hBP02-009" && (source.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) bonus += 10;
    if (giftCard.number === "hBP03-013" && sourceZone === "center" && cardHasName(sourceCard, "姫森ルーナ") && (source.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportFan")) bonus += 20;
    if (giftCard.number === "hBP04-031" && giftUnit === source && stageEntries(opponent).some(({ unit: target }) => ["#JP", "#ID"].some((tag) => cardHasTag(unitCard(target, map), tag)))) bonus += 30;
    if (giftCard.number === "hBP04-062" && stageHasNamedAttachment(giftUnit, map, ["森カリオペの鎌", "Death-sensei"]) && sourceZone === "center" && cardHasTag(sourceCard, "#Myth")) bonus += 30;
    if (giftCard.number === "hBP05-013" && cardHasTag(sourceCard, "#0期生")) bonus += 30;
    if (giftCard.number === "hBP06-025" && giftUnit !== source && cardHasTag(sourceCard, "#秘密結社holoX")) bonus += 20;
    if (giftCard.number === "hBP06-046" && giftUnit === source && player.spOshiSkillUsed && map.get(player.oshi?.number)?.spOshiSkill?.name === "Hawk Eye") bonus += 20;
    if (giftCard.number === "hSD03-008" && ["鷹嶺ルイ", "大神ミオ", "白上フブキ", "ラプラス・ダークネス", "戌神ころね"].some((name) => cardHasName(sourceCard, name))) bonus += 20;
    if (giftCard.number === "hSD08-004" && sourceZone === "collab" && sourceCard?.stage === "Debut" && cardHasTag(sourceCard, "#4期生")) bonus += 40;
  }
  return bonus;
}

function giftDamageAdjustment(state, targetPlayerIndex, targetZone, sourcePlayerIndex, sourceZone, kind, map) {
  const owner = state.players[targetPlayerIndex];
  const opponent = state.players[sourcePlayerIndex];
  const target = owner?.zones?.[targetZone];
  const source = opponent?.zones?.[sourceZone];
  const targetCard = unitCard(target, map);
  const sourceCard = unitCard(source, map);
  let adjustment = 0;
  let immune = kind === "special" && BACK_SLOTS.includes(targetZone) && (owner.modifiers || []).some((modifier) => modifier.kind === "backSpecialImmune" && Number(modifier.expiresTurn || 0) >= state.turn);
  for (const { zone, unit: giftUnit } of stageEntries(owner || { zones: {} })) {
    const giftCard = unitCard(giftUnit, map);
    const text = giftText(giftUnit, map);
    if (!text || !giftZoneApplies(text, zone)) continue;
    if (giftCard.number === "hBP03-015" && targetZone === "collab" && cardHasTag(targetCard, "#ReGLOSS")) adjustment -= 20;
    if (giftCard.number === "hBP04-068" && giftUnit === target && sourceCard?.stage === "1st") adjustment -= 20;
    if (giftCard.number === "hBP04-074" && (giftUnit === target || targetZone === "collab")) adjustment -= 10;
    if (giftCard.number === "hBP04-087" && targetZone === "center" && targetCard?.stage === "Debut") adjustment -= 20;
    if (giftCard.number === "hBP05-008" && targetZone === "center" && targetCard?.stage === "Debut" && cardHasTag(targetCard, "#3期生")) adjustment -= 20;
    if (giftCard.number === "hBP05-069" && giftUnit === target && sourcePlayerIndex !== targetPlayerIndex) immune = true;
    if (giftCard.number === "hBP06-009" && targetZone === "collab") adjustment -= 10;
    if (giftCard.number === "hBP06-039" && kind === "arts" && owner.zones.collab && !opponent?.zones?.collab) immune = true;
    if (giftCard.number === "hBP06-072" && giftUnit === target && kind === "arts" && sourceCard?.stage === "1st") adjustment -= 30;
    if (giftCard.number === "hBP06-082" && kind === "arts" && ["center", "collab"].includes(targetZone) && cardHasName(map.get(owner.oshi?.number), "アーニャ・メルフィッサ") && stageHasNamedAttachment(target, map, ["古代武器"])) adjustment -= 30;
    if (giftCard.number === "hBP07-088" && kind === "special" && BACK_SLOTS.includes(targetZone) && targetCard?.stage === "1st" && cardHasTag(targetCard, "#FLOW GLOW")) immune = true;
    if (giftCard.number === "hBP08-015" && giftUnit === target && kind === "arts") adjustment -= 10;
    if (giftCard.number === "hSD07-009" && giftUnit === target) adjustment -= 10;
    if (giftCard.number === "hSD19-005" && giftUnit === target && sourcePlayerIndex !== targetPlayerIndex && source && sourceZone === "center") adjustment -= 10;
    if (kind === "special" && state.activePlayer === sourcePlayerIndex && state.phase === "main") {
      if (giftCard.number === "hBP03-065" && targetZone === "center" && cardHasName(targetCard, "戌神ころね")) immune = true;
      if (giftCard.number === "hBP04-024" && giftUnit === target) immune = true;
      if (giftCard.number === "hBP08-024" && target?.rested && cardHasName(targetCard, "セシリア・イマーグリーン")) immune = true;
    }
  }
  return { adjustment, immune };
}

function giftSpecialDamageBonus(state, playerIndex, sourceZone, targetZone, map, sourceCardNumber = "") {
  if (targetZone !== "center") return 0;
  const player = state.players[playerIndex];
  const sourceCard = sourceCardNumber ? map.get(sourceCardNumber) : unitCard(player?.zones?.[sourceZone], map);
  if (!sourceCard || !cardHasName(sourceCard, "猫又おかゆ")) return 0;
  return stageEntries(player).reduce((bonus, { zone, unit: giftUnit }) => {
    const number = unitCard(giftUnit, map)?.number;
    if (!["hBP02-041", "hBP05-045"].includes(number) || !giftZoneApplies(giftText(giftUnit, map), zone)) return bonus;
    return bonus + 20;
  }, 0);
}

function giftAllowsBackAttack(player, source, target, targetZone, map) {
  const sourceCard = unitCard(source, map);
  if (sourceCard?.number !== "hBP08-059" || !BACK_SLOTS.includes(targetZone) || unitCard(target, map)?.stage === "Debut") return false;
  const redCheer = stageEntries(player).reduce((count, { unit: stageUnit }) => count + stageUnit.cheer.filter((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes("紅")).length, 0);
  return redCheer >= 6;
}

function defenderForcesCollabTarget(player, map) {
  const collab = player.zones.collab;
  const card = unitCard(collab, map);
  if (!collab || !card || card.keyword?.type !== "gift") return false;
  if (card.number === "hBP01-050") return true;
  if (card.number === "hBP05-010") return Boolean(player.zones.center && cardHasTag(unitCard(player.zones.center, map), "#3期生"));
  if (card.number === "hBP05-043") return Boolean(player.zones.center && cardHasTag(unitCard(player.zones.center, map), "#ゲーマーズ"));
  if (card.number === "hBP08-049") return Boolean(player.zones.center && cardHasTag(unitCard(player.zones.center, map), "#FLOW GLOW"));
  return false;
}

function attachmentArtsBonus(stageUnit, map, turn, zone = "", player = null, opponent = null) {
  let total = (stageUnit.attachments || []).reduce((sum, instance) => {
    if (instance.number === "hBP07-107") {
      const oshi = map.get(player?.oshi?.number);
      return sum + (player?.spOshiSkillUsed && cardHasName(oshi, "オーロ・クロニー") && ["時間的典獄", "時間的監牢"].includes(oshi?.spOshiSkill?.name) && cardHasName(unitCard(stageUnit, map), "オーロ・クロニー") ? 20 : 0);
    }
    if (instance.number === "hEB01-033") return sum + (cardHasTag(unitCard(stageUnit, map), "#サマー") ? 10 : 0);
    if (["hBP05-084", "hBP08-110"].includes(instance.number)) return sum + 10;
    if (instance.number === "hBP03-113") return sum; // Triggered bonus, not a continuous bonus.
    if (instance.number === "hBP02-092") return sum; // Paid main-phase skill, not a continuous bonus.
    const card = map.get(instance.number);
    return sum + attachmentBlocks(card).reduce((blockTotal, block) => {
      if (!attachmentBlockApplies(block, stageUnit, zone, map, player, opponent)) return blockTotal;
      return blockTotal + sumBonuses(block, /(?:Arts|藝術值|藝術|藝能值|藝能傷害|藝能|アーツ|術式)\s*(?:傷害)?\s*[+＋\-−]\s*(\d+)/giu);
    }, 0);
  }, 0);
  const ancientWeapons = (stageUnit.attachments || []).filter((instance) => instance.number === "hBP04-099").length;
  if (ancientWeapons > 0 && ["1st", "2nd"].includes(unitCard(stageUnit, map)?.stage) && cardHasName(unitCard(stageUnit, map), "アーニャ・メルフィッサ")) {
    const allAncientWeapons = player ? stageEntries(player).reduce((count, entry) => count + entry.unit.attachments.filter((instance) => instance.number === "hBP04-099").length, 0) : ancientWeapons;
    total += allAncientWeapons * 10;
  }
  if (unitCard(stageUnit, map)?.stage === "2nd" && cardHasName(unitCard(stageUnit, map), "角巻わため") && (stageUnit.attachments || []).some((instance) => instance.number === "hBP05-084") && stageEntries(player || { zones: {} }).some(({ unit: candidate }) => candidate.attachments.some((instance) => cardHasName(map.get(instance.number), "わためいと")))) total += 10;
  if (Number(stageUnit.koyoriMascotBonusTurn || 0) === turn) total += 10;
  total += activeModifiers(stageUnit, "arts", turn).reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);
  return total;
}

function effectiveArtCost(stageUnit, art, state, player, zone, map) {
  if (activeModifiers(stageUnit, "freeArts", state.turn).length > 0) return [];
  const source = unitCard(stageUnit, map);
  if (player.oshi?.number === "hBP08-006" && cardHasName(source, "一伊那尓栖")) {
    const playerIndex = state.players.indexOf(player);
    const opponent = state.players[playerIndex === 0 ? 1 : 0];
    const oshiColors = map.get(opponent?.oshi?.number)?.colors || [];
    const opposingUnits = stageEntries(opponent || { zones: {} });
    const allHaveDifferentColor = opposingUnits.length > 0 && opposingUnits.every(({ unit: opposingUnit }) =>
      (unitCard(opposingUnit, map)?.colors || []).some((color) => !oshiColors.includes(color)));
    if (allHaveDifferentColor) return [];
  }
  let cost = [...(art.cost || [])];
  const allColorless = (stageUnit.attachments || []).some((instance) => (instance.number === "hBP02-098" && cardHasName(source, "森カリオペ")) || (instance.number === "hBP03-100" && ["フワワ・アビスガード", "モココ・アビスガード"].some((name) => cardHasName(source, name))));
  if (allColorless) cost = cost.map(() => "無色");
  const removeRequirement = (color, amount = 1) => {
    for (let count = 0; count < amount; count += 1) {
      const index = cost.indexOf(color);
      if (index < 0) break;
      cost.splice(index, 1);
    }
  };
  if (source?.number === "hBP08-019" && !stageHasNamedAttachment(stageUnit, map, ["Chattino"])) removeRequirement("白", 1);
  if (source?.number === "hBP06-056" && player.spOshiSkillUsed && ["人生リセットボタン", "人生重置按鈕"].includes(map.get(player.oshi?.number)?.spOshiSkill?.name) && /沙花叉と青春しよ/u.test(String(art.name || ""))) removeRequirement("無色", 1);
  if (["hBP03-037", "hBP05-038"].includes(source?.number) && cardHasName(unitCard(player.zones.center, map), "フワワ・アビスガード")) removeRequirement("無色", 1);
  if (source?.number === "hBP05-017" && zone === "collab" && /ぱくぱく/u.test(String(art.name || ""))) {
    const lunaiteCount = (player.zones.center?.attachments || []).filter((instance) => cardHasName(map.get(instance.number), "ルーナイト")).length;
    removeRequirement("無色", lunaiteCount);
  }
  if (source?.number === "hBP05-054") {
    const foodEvents = currentTurnEvents(player, state.turn).supports.filter((number) => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode) && cardHasTag(map.get(number), "#食べ物")).length;
    if (foodEvents >= 2) removeRequirement("無色", 1);
  }
  if (source?.number === "hBP06-083" && zone === "collab") {
    const oshiMatches = ["角巻わため", "大空スバル"].some((name) => cardHasName(map.get(player.oshi?.number), name));
    const centerIsSecondWatame = unitCard(player.zones.center, map)?.stage === "2nd" && cardHasName(unitCard(player.zones.center, map), "角巻わため");
    removeRequirement("黃", centerIsSecondWatame ? 3 : oshiMatches ? 1 : 0);
  }
  if (source?.number === "hBP07-011" && stageUnit.cheer.filter((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes("白")).length >= 2) removeRequirement("無色", 1);
  if (source?.number === "hSD12-011") {
    const archiveColors = new Set(state.players.flatMap((candidate) => candidate.archive.filter((instance) => map.get(instance.number)?.group === "cheer").flatMap((instance) => map.get(instance.number)?.colors || [])));
    removeRequirement("無色", archiveColors.size);
  }
  if (source?.number === "hSD12-012" && player.life.length <= 3) removeRequirement("無色", 2);
  if (source?.number === "hBP06-065") {
    const playerIndex = state.players.indexOf(player);
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const wasKnockedOut = (state.knockouts || []).some((entry) => entry.turn === state.turn - 1 && entry.ownerIndex === playerIndex && entry.sourcePlayerIndex === opponentIndex);
    if (wasKnockedOut) removeRequirement("無色", 1);
  }
  if (zone === "center" && cardHasName(source, "アーニャ・メルフィッサ") && stageHasNamedAttachment(stageUnit, map, ["古代武器"]) && stageEntries(player).some(({ zone: giftZone, unit: giftUnit }) => unitCard(giftUnit, map)?.number === "hBP04-078" && giftZoneApplies(giftText(giftUnit, map), giftZone))) removeRequirement("黃", 1);
  const playerIndex = state.players.indexOf(player);
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const opponentCostGift = zone === "center" && stageEntries(opponent || { zones: {} }).some(({ zone: giftZone, unit: giftUnit }) => unitCard(giftUnit, map)?.number === "hBP08-053" && giftZoneApplies(giftText(giftUnit, map), giftZone));
  if (opponentCostGift && effectiveBatonCost(state, playerIndex, stageUnit, zone, map) >= 5) cost.push("無色", "無色");
  const coloredModifierKinds = { 白: "artCost:white", 綠: "artCost:green", 紅: "artCost:red", 藍: "artCost:blue", 黃: "artCost:yellow", 紫: "artCost:purple" };
  for (const [color, kind] of Object.entries(coloredModifierKinds)) {
    let reduction = -activeModifiers(stageUnit, kind, state.turn).reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);
    while (reduction > 0) {
      const index = cost.indexOf(color);
      if (index < 0) break;
      cost.splice(index, 1);
      reduction -= 1;
    }
  }
  let reductions = topCard(stageUnit)?.number === "hEB01-024" ? (stageUnit.attachments || []).filter((instance) => instance.number === ASSISTANT_CARD).length : 0;
  if ((stageUnit.attachments || []).some((instance) => instance.number === "hBP07-101") && cardIsBuzz(source)) reductions += 1;
  reductions -= activeModifiers(stageUnit, "artCost", state.turn).reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);
  reductions -= matchingPlayerModifierBonus(player, "artCost", stageUnit, zone, map, state.turn);
  while (reductions > 0) {
    const index = cost.indexOf("無色");
    if (index < 0) break;
    cost.splice(index, 1);
    reductions -= 1;
  }
  return cost;
}

function effectiveBatonCost(state, playerIndex, stageUnit, zone, map) {
  const player = state.players[playerIndex];
  const card = unitCard(stageUnit, map);
  const modifier = activeModifiers(stageUnit, "batonCost", state.turn).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    + matchingPlayerModifierBonus(player, "batonCost", stageUnit, zone, map, state.turn);
  const fanReduction = (stageUnit?.attachments || []).filter((instance) => instance.number === "hBP03-111" && cardHasName(card, "戌神ころね")).length;
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const breathIncrease = ["center", "collab"].reduce((sum, opponentZone) => {
    const opponentUnit = opponent?.zones?.[opponentZone];
    return sum + (opponentUnit?.attachments || []).filter((instance) => instance.number === "hBP08-104" && cardHasName(unitCard(opponentUnit, map), "水宮枢")).length;
  }, 0);
  return Math.max(0, Number(card?.baton || 0) + modifier - fanReduction + breathIncrease);
}

function resolveKoyoriArtEffects(state, playerIndex, sourceZone, artIndex, map, random) {
  const player = state.players[playerIndex];
  const source = player.zones[sourceZone];
  const sourceCard = unitCard(source, map);
  let bonus = 0;
  if (sourceCard?.number === "hEB01-018" && source.attachments?.some((instance) => cardHasTag(map.get(instance.number), "#こよラボ"))) bonus += 20;
  if (sourceCard?.number === "hEB01-022" && stageEntries(player).some(({ unit: stageUnit }) => map.get(topCard(stageUnit)?.number)?.stage === "2nd")) bonus += 20;
  if (sourceCard?.number === "hEB01-020" && artIndex === 1) {
    const revealed = player.mainDeck.splice(0, Math.min(totalCheer(player), player.mainDeck.length));
    const holomem = revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length;
    bonus += holomem * 10;
    player.mainDeck = shuffle([...player.mainDeck, ...revealed], random);
    appendLog(state, `${player.name} 展示 ${cardCodes(revealed)}，當中 ${holomem} 張 Holomen；Arts +${holomem * 10}，然後洗牌。`, revealed);
  }
  if (sourceCard?.number === "hEB01-024" && artIndex === 0) {
    const revealed = player.mainDeck.splice(0, Math.min(totalCheer(player), player.mainDeck.length));
    const holomem = revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length;
    bonus += holomem * 20;
    player.mainDeck = shuffle([...player.mainDeck, ...revealed], random);
    if (holomem > 0) enqueueEffect(state, { type: "healDistribution", playerIndex, count: holomem, unitAmount: 20, sourceName: sourceCard.arts?.[artIndex]?.name || sourceCard.name, prompt: `Arts 效果：展示到 ${holomem} 張 Holomen；將 ${holomem} 個「20 HP 回復」分配到自己舞台上的 Holomen。` });
    appendLog(state, `${player.name} 展示 ${cardCodes(revealed)}，當中 ${holomem} 張 Holomen；Arts +${holomem * 20}，然後洗牌。`, revealed);
  }
  if (sourceCard?.number === "hBP04-009" && artIndex === 0) {
    const revealed = player.mainDeck.splice(0, 3);
    const selectableIds = revealed.filter((instance) => {
      const card = map.get(instance.number);
      return (card?.stage === "Debut" && cardHasTag(card, "#秘密結社holoX")) || (card?.group === "support" && cardHasTag(card, "#こよラボ"));
    }).map((instance) => instance.id);
    if (selectableIds.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 1, max: 1, prompt: "Arts 效果：選擇 1 張 #秘密結社holoX Debut 或 #こよラボ 支援卡公開並加入手牌。", effect: "topThreeSearch", source: "revealed", optional: false });
    else if (revealed.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, min: revealed.length, max: revealed.length, prompt: "沒有符合條件的牌：按次序選擇；第 1 張會最先放到牌庫底。", effect: "bottomOrder", source: "revealed" });
  }
  if (sourceCard?.number === "hBP04-011" && artIndex === 0) {
    const assistants = player.archive.filter((instance) => instance.number === ASSISTANT_CARD);
    const hasTarget = stageEntries(player).some(({ zone, unit: stageUnit }) => zone !== sourceZone && isKoyoriCard(map.get(topCard(stageUnit)?.number)));
    if (assistants.length > 0 && hasTarget) enqueueCardSelection(state, { playerIndex, cards: assistants, min: 1, max: 1, prompt: "Arts 效果：可揀存檔區 1 張「こよりの助手くん」；下一步直接按另一位博衣こより。", effect: "chooseArchivedAssistantForAttach", source: "archive", optional: true, meta: { excludeZone: sourceZone } });
  }
  if (sourceCard?.number === "hBP04-012" && artIndex === 0 && source.attachments?.some((instance) => instance.number === ASSISTANT_CARD)) {
    if (drawCards(state, playerIndex, 1) > 0) appendLog(state, `${player.name} 因 Arts 效果抽 1 張牌。`);
  }
  if (sourceCard?.number === "hEB01-023" && artIndex === 0) {
    const amount = Math.max(0, assistantCount(player) - player.hand.length);
    if (amount > 0) {
      const drawn = drawCards(state, playerIndex, amount);
      if (drawn > 0) appendLog(state, `${player.name} 抽 ${drawn} 張牌，盡量令手牌數等於舞台上的「こよりの助手くん」數量。`);
    }
  }
  if (player.koyoriArtsBonusTurn === state.turn && isKoyoriCard(sourceCard)) bonus += 30;
  return bonus;
}

function stageAttachmentCount(player, map, predicate = () => true) {
  return stageEntries(player).reduce((count, { unit: stageUnit }) => count + (stageUnit.attachments || []).filter((instance) => predicate(map.get(instance.number))).length, 0);
}

function stageCheerColorCount(player, map, color = "") {
  return stageEntries(player).reduce((count, { unit: stageUnit }) => count + stageUnit.cheer.filter((instance) => !color || effectiveCheerColors(player, stageUnit, instance, map).includes(color)).length, 0);
}

function artConditionApplies(state, playerIndex, sourceZone, targetZone, text, map) {
  const player = state.players[playerIndex];
  if (unitCard(player.zones[sourceZone], map)?.number === "hBP01-055" && !stageEntries(player).some(({ unit: candidate }) => cardHasTag(unitCard(candidate, map), "#ID") && !cardHasName(unitCard(candidate, map), "アイラニ・イオフィフティーン"))) return false;
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const source = player.zones[sourceZone];
  const sourceCard = unitCard(source, map);
  const target = opponent.zones[targetZone];
  const targetCard = unitCard(target, map);
  const events = currentTurnEvents(player, state.turn);
  if (!giftZoneApplies(text, sourceZone)) return false;
  if (/生命(?:值)?(?:為|在)?3(?:或)?以下/u.test(text) && player.life.length > 3) return false;
  if (/生命(?:值)?(?:為|在)?2(?:或)?以下/u.test(text) && player.life.length > 2) return false;
  if (/生命(?:值)?為4以下/u.test(text) && player.life.length > 4) return false;
  if (/手牌為?2張以下|手牌在2張以下/u.test(text) && player.hand.length > 2) return false;
  if (/手牌數比對手少/u.test(text) && player.hand.length >= opponent.hand.length) return false;
  if (/這位Holomen的HP已減少|此Holomen.*HP減少/u.test(text) && Number(source.damage || 0) <= 0) return false;
  if (/中央Holomen HP減少/u.test(text) && Number(player.zones.center?.damage || 0) <= 0) return false;
  if (/裝備有工具|裝備了工具|附有工具/u.test(text) && !(source.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportTool")) return false;
  if (/裝備有道具或吉祥物/u.test(text) && !(source.attachments || []).some((instance) => ["supportTool", "supportMascot", "supportItem", "supportItemLimited"].includes(map.get(instance.number)?.typeCode))) return false;
  if (/(?:這位|這個|此)(?:Holomen|Holo成員|ホロメン)(?:上)?有吉祥物或粉絲/u.test(text) && !(source.attachments || []).some((instance) => ["supportMascot", "supportFan"].includes(map.get(instance.number)?.typeCode))) return false;
  const namedAttachment = text.match(/(?:這位Holomen|此Holomen|這個Holomen|這個成員|此成員|這張ホロメン)(?:已|有)?(?:裝備|附有|附著|帶著|帶有)(?:了)?\s*(\d+張以上的?)?[▲△]?[〈「]([^〉」]+)[〉」]/u);
  if (namedAttachment) {
    const count = (source.attachments || []).filter((instance) => cardHasName(map.get(instance.number), namedAttachment[2])).length;
    if (count < Number(namedAttachment[1]?.match(/\d+/u)?.[0] || 1)) return false;
  }
  const cheerAtLeast = text.match(/(?:附有|裝備了?|已附加)\s*(\d+)張以上(?:的)?(?:[白綠紅藍黃紫]色)?應援/u);
  if (cheerAtLeast && source.cheer.length < Number(cheerAtLeast[1])) return false;
  for (const [color, pattern] of SKILL_COLOR_WORDS) {
    if (new RegExp(`(?:附有|裝備)(?:了)?[^。；]*${pattern.source}應援`, "u").test(text) && !source.cheer.some((instance) => effectiveCheerColors(player, source, instance, map).includes(color))) return false;
  }
  if (/有非紫色的應援/u.test(text) && !source.cheer.some((instance) => !(map.get(instance.number)?.colors || []).includes("紫"))) return false;
  const noNamedAttachment = text.match(/(?:場上|舞台上)沒有(?:任何)?(?:附著|附有|附加|裝備)(?:了)?[〈「]([^〉」]+)[〉」](?:的)?Holomen/u);
  if (noNamedAttachment && stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).some((instance) => cardHasName(map.get(instance.number), noNamedAttachment[1])))) return false;
  const stackedAtLeast = text.match(/(?:與(?:這個|這位|此)(?:成員|Holomen)重疊的成員|(?:這位|此)Holomen下方的Holomen)(?:有|達)?\s*(\d+)張以上/u);
  if (stackedAtLeast && Math.max(0, source.stack.length - 1) < Number(stackedAtLeast[1])) return false;
  if (/舞台上有兩種或以上顏色的應援/u.test(text)) {
    const colors = new Set(stageEntries(player).flatMap(({ unit: stageUnit }) => stageCheerColors(player, stageUnit, map)));
    if (colors.size < 2) return false;
  }
  const archiveSupportAtLeast = text.match(/檔案區域?中有\s*(\d+)\s*張以上支援卡/u);
  if (archiveSupportAtLeast && player.archive.filter((instance) => map.get(instance.number)?.group === "support").length < Number(archiveSupportAtLeast[1])) return false;
  const stageTagLevelAtLeast = text.match(/舞台上有\s*(\d+)\s*(?:名|位)以上(?:持有|擁有)?(#[^的，。\]]+)的\s*(1st|2nd)\s*Holomen/u);
  if (stageTagLevelAtLeast && stageEntries(player).filter(({ unit: candidate }) => {
    const card = unitCard(candidate, map);
    return cardHasTag(card, stageTagLevelAtLeast[2].trim()) && card?.stage === stageTagLevelAtLeast[3];
  }).length < Number(stageTagLevelAtLeast[1])) return false;
  const stageTagAtLeast = text.match(/舞台上有\s*(\d+)\s*(?:名|位)以上(?:持有|擁有)?(#[^的，。\]]+)/u);
  if (stageTagAtLeast && stageHasTag(player, stageTagAtLeast[2], map).length < Number(stageTagAtLeast[1])) return false;
  const stageTagCount = text.match(/舞台上有\s*(\d+)\s*(?:名|位)(?:持有|擁有)?(#[^的，。\]]+)/u);
  if (stageTagCount && stageHasTag(player, stageTagCount[2], map).length < Number(stageTagCount[1])) return false;
  const stageSecondTag = text.match(/舞台上有(?:持有|擁有)?(#[^的，。\]]+)的2nd以上Holomen/u);
  if (stageSecondTag && !stageEntries(player).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd" && cardHasTag(unitCard(stageUnit, map), stageSecondTag[1]))) return false;
  const stageTag = text.match(/舞台上有(?:持有|擁有)?(#[^且的，。\]]+)/u)?.[1];
  if (stageTag && stageHasTag(player, stageTag, map).length === 0) return false;
  const stageNamed = text.match(/舞台上有(?:Holomen)?[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (stageNamed && !stageEntries(player).some(({ unit: stageUnit }) => cardHasName(unitCard(stageUnit, map), stageNamed))) return false;
  const centerName = text.match(/中央Holomen(?:為|是)[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (centerName && !cardHasName(unitCard(player.zones.center, map), centerName)) return false;
  const centerTag = text.match(/中央Holomen(?:擁有|持有)(#[^，。\]]+)/u)?.[1];
  if (centerTag && !cardHasTag(unitCard(player.zones.center, map), centerTag)) return false;
  const centerColor = skillColor(text.match(/中央Holomen顏色為[白綠紅藍黃紫]色/u)?.[0]);
  if (centerColor && !(unitCard(player.zones.center, map)?.colors || []).includes(centerColor)) return false;
  const oshiCard = map.get(player.oshi?.number);
  const oshiName = text.match(/(?:(?:推し|主推|應援|喜推)Holomen|(?:自己)?所支持的Holomen|本命Holomen)(?:為|是)[〈「]([^〉」]+)[〉」]/u)?.[1];
  const oshiColorClause = text.match(/(?:(?:推し|主推|應援)Holomen(?:的)?顏色|支持的Holo成員顏色)(?:為|是)([白綠紅藍黃紫、，或與及／/]+)/u)?.[1] || "";
  const allowedOshiColors = [...new Set([...oshiColorClause].filter((value) => "白綠紅藍黃紫".includes(value)))];
  const oshiNameMatches = !oshiName || cardHasName(oshiCard, oshiName);
  const oshiColorMatches = allowedOshiColors.length === 0 || (oshiCard?.colors || []).some((color) => allowedOshiColors.includes(color));
  const alternativeOshiCondition = Boolean(oshiName && allowedOshiColors.length > 0 && /[〉」]或(?:推し|主推|應援)Holomen的顏色/u.test(text));
  if (alternativeOshiCondition ? !oshiNameMatches && !oshiColorMatches : !oshiNameMatches || !oshiColorMatches) return false;
  if (/曾使用過支援卡/u.test(text) && events.supports.length === 0) return false;
  if (/曾使用過事件卡|有使用過事件卡/u.test(text) && !events.supports.some((number) => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode))) return false;
  if (/使用過LIMITED(?:的)?支援卡|使用過LIMITED事件/u.test(text) && !events.supports.some((number) => String(map.get(number)?.type || "").toUpperCase().includes("LIMITED"))) return false;
  const usedNamedSupport = text.match(/曾使用過[〈「]([^〉」]+)[〉」]/u)?.[1];
  if (usedNamedSupport && !events.supports.some((number) => cardHasName(map.get(number), usedNamedSupport))) return false;
  if (/Holomen曾經?Bloom過|有Holomen進行過Bloom/u.test(text) && events.bloomCount === 0) return false;
  if (/主要階段中如果使用過自己的SP推し技能/u.test(text) && !player.spOshiSkillUsed) return false;
  if (/對手的後排Holo成員HP減少/u.test(text) && !BACK_SLOTS.some((zone) => Number(opponent.zones[zone]?.damage || 0) > 0)) return false;
  const damagedBackThreshold = Number(text.match(/對手[^。；]*後(?:排|場)[^。；]*HP(?:已)?減少(?:超過|達|合共|總共)?\s*(\d+)/u)?.[1] || 0);
  if (damagedBackThreshold > 0 && !BACK_SLOTS.some((zone) => Number(opponent.zones[zone]?.damage || 0) >= damagedBackThreshold)) return false;
  const damagedBackCount = Number(text.match(/對手[^。；]*後(?:排|場)[^。；]*有\s*(\d+)位以上[^。；]*HP(?:已)?減少/u)?.[1] || 0);
  if (damagedBackCount > 0 && BACK_SLOTS.filter((zone) => Number(opponent.zones[zone]?.damage || 0) > 0).length < damagedBackCount) return false;
  if (/對手舞台上有7張以上的應援/u.test(text) && totalCheer(opponent) < 7) return false;
  if (/此(?:技能|Arts|藝能)的對象是對手1st以上的合作Holomen/u.test(text) && !(targetZone === "collab" && ["1st", "2nd"].includes(targetCard?.stage))) return false;
  if (/(?:此|這個)(?:招式|技能|Arts|藝能)的對象是對手的?合作Holomen/u.test(text) && targetZone !== "collab") return false;
  if (/對1st以上的成員使用/u.test(text) && !["1st", "2nd"].includes(targetCard?.stage)) return false;
  if (/對象是HP已減少的對手Holomen/u.test(text) && Number(target?.damage || 0) <= 0) return false;
  if (/對象是對手的第2位Holomen|對手的2nd Holomen/u.test(text) && targetCard?.stage !== "2nd") return false;
  if (/檔案區域有Holomen/u.test(text) && !player.archive.some((instance) => map.get(instance.number)?.group === "holomem")) return false;
  const archiveTagAtLeast = text.match(/檔案區域中(?:擁有|具有)?(#[^的，。]+)的?(?:Holomen|成員)達(\d+)張以上/u);
  if (archiveTagAtLeast && player.archive.filter((instance) => cardHasTag(map.get(instance.number), archiveTagAtLeast[1]) && map.get(instance.number)?.group === "holomem").length < Number(archiveTagAtLeast[2])) return false;
  if (/舞台上(?:的)?所有應援都是紅色/u.test(text) && (totalCheer(player) === 0 || stageCheerColorCount(player, map, "紅") !== totalCheer(player))) return false;
  void sourceCard;
  return true;
}

function rollArtDie(state, playerIndex, sourceCard, random, label = "因 Arts 擲骰") {
  const die = rollDie(random, state, playerIndex, 1, sourceCard);
  logDie(state, playerIndex, die, label);
  return die;
}

function queueFixedSpecialDamage(state, playerIndex, sourceZone, zones, amount, sourceName, loseLife = true) {
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const damageBatchId = crypto.randomUUID();
  zones.forEach((zone) => {
    if (state.players[opponentIndex].zones[zone]) enqueueEffect(state, { type: "specialDamage", damageBatchId, playerIndex, targetPlayerIndex: opponentIndex, targetZone: zone, amount, loseLife, sourceName, sourceZone });
  });
}

function resolveDiceArtEffects(state, playerIndex, sourceZone, artIndex, card, art, map, random) {
  const key = `${card.number}:${artIndex}`;
  const player = state.players[playerIndex];
  const source = player.zones[sourceZone];
  const roll = () => rollArtDie(state, playerIndex, card, random);
  let bonus = 0;
  if (key === "hBP01-038:0") bonus += roll() % 2 === 0 ? 20 : 0;
  else if (key === "hBP01-023:0") {
    if (roll() % 2 === 1) addStageModifier(source, "repeatArts", 0, state.turn, card.number, { uses: 1, artIndex: null });
  }
  else if (["hBP01-042:1", "hBP01-043:0"].includes(key)) {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲骰" }], optional: true, effect: "firstSetArtsRoll", prompt: art.name + "：可以擲骰。", meta: { sourceZone, cardNumber: card.number, sourceName: art.name } });
  }
  else if (key === "hBP01-072:0") {
    if (source.cheer.some((instance) => (map.get(instance.number)?.colors || []).includes("紅"))) enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲骰" }], optional: true, effect: "firstSetArtsRoll", prompt: art.name + "：可以擲骰。", meta: { sourceZone, cardNumber: card.number, sourceName: art.name } });
  } else if (key === "hBP01-088:0") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "moonaArtRoll", prompt: "可擲骰：偶數時對對手後排造成 20 特殊傷害。", meta: { sourceZone, sourceName: art.name } });
  } else if (key === "hBP02-046:0") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "shionArtRoll", prompt: "チェンジ・ザ・エール：可擲骰；5 以上時改附對手 1 張應援。", meta: {} });
  } else if (key === "hBP03-023:0") {
    const events = currentTurnEvents(player, state.turn);
    if ((events.dice || []).some((entry) => cardHasName(map.get(entry.sourceNumber), "兎田ぺこら"))) bonus += 40;
  } else if (key === "hBP03-028:1") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "mikoArtsRoll", prompt: "みこぴー！：可擲一次骰子。", meta: { sourceZone } });
  } else if (key === "hBP03-034:0") {
    enqueueOptionChoice(state,{playerIndex,options:[{id:"roll",label:"擲 1 次骰子"}],effect:"haatoOptionalRoll",optional:true,prompt:"可擲 1 次骰子；或略過此 Arts 的擲骰效果。",meta:{mode:"arts",sourceNumber:card.number,sourceZone,sourceId:topCard(source).id,label:art.name}});
  } else if (key === "hBP04-059:0") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const amount = Number(currentTurnEvents(player, state.turn).diceRollCount || 0) * 10;
    if (amount > 0 && state.players[opponentIndex].zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount, loseLife: true, sourceName: art.name, sourceZone });
  } else if (key === "hBP05-014:0") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "pekoraCuteRoll", prompt: "可擲一次骰子，偶數時抽 1 張牌。", meta: {} });
  } else if (key === "hBP05-016:0") {
    if (source.stack.length > 1 && source.attachments.some(c=>c.number==='hBP01-123')) enqueueOptionChoice(state, { playerIndex, options: Array.from({length:source.stack.length},(_,i)=>({id:String(i),label:'擲 '+i+' 次骰子'})), optional:false, effect:'pekoraStackBatch', prompt:'選擇這次 Arts 要擲的骰子數量；野兔同盟會重擲整批。', meta:{sourceZone} });
    else if (source.stack.length > 1) enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲骰" }, { id: "decline", label: "不擲這顆骰子" }], optional: false, effect: "pekoraStackRoll", prompt: "可為這張重疊成員擲一次骰子。", meta: { sourceZone, remaining: source.stack.length - 1, total: 0, rolled: 0 } });
  } else if (key === "hBP05-033:0") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲一次骰子" }], optional: true, effect: "polkaArchiveRoll", prompt: "可擲一次骰子，按點數存檔牌庫頂。", meta: { sourceZone, cardNumber: card.number } });
  } else if (key === "hBP05-067:0") {
    enqueueOptionChoice(state,{playerIndex,options:[{id:"roll",label:"擲一次骰子"}],optional:true,effect:"flareLifeRoll",prompt:"可擲一次骰子。",meta:{sourceZone,cardNumber:card.number}});
  } else if (key === "hBP06-040:0") {
    if (roll() % 2 === 1) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], 10, art.name);
  } else if (key === "hBP06-044:0") {
    if (player.spOshiSkillUsed && /🎲|FUN ZONE/iu.test(String(map.get(player.oshi?.number)?.spOshiSkill?.name || ""))) bonus += roll() * 10;
  } else if (key === "hBP06-071:0") bonus += [roll(), roll(), roll()].filter((value) => value % 2 === 1).length * 20;
  else if (key === "hBP06-071:1") {
    const odd = [roll(), roll(), roll(), roll(), roll()].filter((value) => value % 2 === 1).length;
    if (odd > 0) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, odd)} 張牌。`);
    queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], odd * 30, art.name);
  } else if (key === "hBP06-075:1") {
    const count = Math.min(4, stageAttachmentCount(player, map, (attachment) => ["supportMascot", "supportFan"].includes(attachment?.typeCode)));
    bonus += Array.from({ length: count }, roll).filter((value) => value >= 4).length * 10;
  } else if (key === "hBP08-045:0") {
    const amount = roll() * 10;
    enqueueStageTarget(state, { playerIndex, effect: "artBuffTarget", prompt: `${art.name}：直接按自己 1 位 Holomen，本回合 Arts +${amount}。`, meta: { amount, sourceZone, sourceNumber: card.number } });
  } else if (key === "hSD01-011:1") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲骰" }], optional: true, effect: "starterAzkiRoll", meta: { sourceZone, cardNumber: card.number } });
  } else if (key === "hSD01-013:0") {
    enqueueOptionChoice(state,{playerIndex,options:[{id:"roll",label:"擲一次骰子"}],optional:true,effect:"sorazRoll",prompt:"可擲一次骰子。",meta:{sourceZone,cardNumber:card.number}});
  } else if (key === "hSD16-005:0") {
    if ([3, 5].includes(roll())) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  } else if (key === "hSD16-007:0") {
    if (sourceZone === "center") bonus += [3, 5].includes(roll()) ? 10 : 0;
  }
  else return { handled: false, bonus: 0 };
  return { handled: true, bonus };
}

function adjustQueuedArtsDamage(state, playerIndex, sourceZone, amount) {
  const effect = state.effectQueue.find((candidate) => candidate.type === "dealArtsDamage" && candidate.playerIndex === playerIndex && candidate.sourceZone === sourceZone);
  if (!effect || Number(amount || 0) === 0) return false;
  effect.damage = Number(effect.damage || 0) + Number(amount);
  effect.effectBonus = Number(effect.effectBonus || 0) + Number(amount);
  return true;
}

function queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { min = 1, max = 1, fixedBonus = 0, perBonus = 0, prompt, afterEffect = "", afterMeta = {} } = {}) {
  const cards = state.players[playerIndex].hand;
  return enqueueHolomemHandArchive(state, { playerIndex, cards, min, max, optional: true, effect: "artHandArchiveCost", source: "hand", prompt, meta: { sourceZone, fixedBonus, perBonus, afterEffect, afterMeta } }, unitCard(state.players[playerIndex].zones[sourceZone], map) || card, map);
}

function queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { optional = true, min = 1, max = 1, perBonus = 0, fixedBonus = 0, prompt, afterEffect = "", afterMeta = {} } = {}) {
  if (options.length < min) return false;
  enqueueStageCheerSelection(state, { playerIndex, options, min: 1, max: 1, optional, effect: "artArchiveCheerCost", prompt, meta: { sourceZone, remaining: Math.min(max, options.length), minimumRemaining: min, perBonus, fixedBonus, afterEffect, afterMeta, paid: 0 } });
  return true;
}

function queueGenericArtCostEffects(state, playerIndex, sourceZone, artIndex, card, map) {
  const key = `${card.number}:${artIndex}`;
  const player = state.players[playerIndex];
  const source = player.zones[sourceZone];
  if (key === "hBP03-035:0") {
    if (!cardHasName(map.get(player.oshi?.number), "鷹嶺ルイ") || player.hand.length < 2) return false;
    return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { min: 2, max: 2, afterEffect: "challengerDraw", prompt: "可存檔 2 張手牌，然後抽 3 張牌。" });
  }
  if (key === "hBP01-062:0") return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { fixedBonus: 20, prompt: "Arts 效果：可揀 1 張手牌放到存檔區；若支付，這次 Arts +20。" });
  if (key === "hBP06-042:0") return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { min: 2, max: 2, fixedBonus: 20, prompt: "Arts 效果：可揀 2 張手牌放到存檔區；若支付，這次 Arts +20。" });
  if (key === "hBP08-066:0") return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { min: 1, max: 2, perBonus: 20, prompt: "Arts 效果：可揀 1–2 張手牌放到存檔區；每張令這次 Arts +20。" });
  if (key === "hBP05-061:0") return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { min: 1, max: 3, prompt: "Arts 效果：可揀 1–3 張手牌放到存檔區；之後直接按 #歌 Holomen。", afterEffect: "buffSong", afterMeta: { perBonus: 20 } });
  if (key === "hBP06-034:0") return queueArtHandArchiveCost(state, playerIndex, sourceZone, card, map, { fixedBonus: 0, prompt: "Arts 效果：可揀 1 張手牌放到存檔區；若支付，中央百鬼あやめ本回合 Arts +30。", afterEffect: "buffCenterAyame", afterMeta: { amount: 30 } });
  if (key === "hBP01-081:0") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] }, colors: ["藍"] });
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { min: 2, max: 2, fixedBonus: Math.max(0, source.stack.length - 1) * 60, prompt: "Arts 效果：可直接按攻擊者身上 2 張藍色應援放到存檔區。" });
  }
  if (key === "hSD11-006:0") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { min: 1, max: options.length, perBonus: 40, prompt: "Arts 效果：可逐張按攻擊者身上的應援放到存檔區；每張令 Arts +40。", afterMeta: { sourceNumber: card.number } });
  }
  if (key === "hSD12-010:1") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } }).filter((option) => !(map.get(option.number)?.colors || []).includes("紫"));
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { prompt: "Arts 效果：可按攻擊者身上 1 張非紫色應援放到存檔區。", afterEffect: "archiveHolomemToHand" });
  }
  if (key === "hEB01-015:0") {
    if (source.stack.length < 3) return false;
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, stageCheerOptions(player, map), { afterEffect: "marineTopCheer", prompt: "可將自己舞台 1 張應援存檔；支付後附加應援牌庫頂 1 張。" });
  }
  if (key === "hEB01-011:0") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { prompt: "Arts 效果：可按攻擊者身上 1 張應援放到存檔區；若支付，搜尋 #サマー 宝鐘マリン。", afterEffect: "searchSummerMarine" });
  }
  if (key === "hBP03-054:0") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] }, colors: ["紫"] });
    return queueArtCheerArchiveCost(state, playerIndex, sourceZone, options, { min: 4, max: 4, optional: false, prompt: "Arts 效果：按攻擊者身上 4 張紫色應援放到存檔區，再按對手舞台應援放回牌庫底。", afterEffect: "opponentCheerBottom" });
  }
  if (key === "hBP03-066:0") {
    const cards = source.stack.slice(0, -1).filter((instance) => map.get(instance.number)?.stage === "1st");
    if (cards.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "artUnderCardCost", source: "stack", prompt: "Arts 效果：可揀攻擊者下方 1 張 1st Holomen 放到存檔區；若支付，這次 Arts +50。", meta: { sourceZone, fixedBonus: 50 } });
    return true;
  }
  if (key === "hBP06-021:0") {
    const cards = player.archive.filter((instance) => map.get(instance.number)?.group === "support" && cardHasTag(map.get(instance.number), "#こよラボ"));
    if (cards.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "artArchiveToBottomCost", source: "archive", prompt: "Arts 效果：可揀存檔區 1 張 #こよラボ 支援卡放到牌庫底；若支付，Arts +40。", meta: { sourceZone, fixedBonus: 40 } });
    return true;
  }
  if (key === "hBP06-045:0") {
    const cards = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem");
    if (cards.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: Math.min(5, cards.length), optional: true, effect: "artArchiveToBottomCost", source: "archive", prompt: "Arts 效果：可揀 1–5 張存檔區 Holomen 放到牌庫底；每張令 Arts +10。", meta: { sourceZone, perBonus: 10 } });
    return true;
  }
  if (key === "hBP07-076:0") {
    if (player.holoPower.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: 1, optional: true, effect: "artHoloPowerCost", source: "holoPower", prompt: "Arts 效果：可揀 1 張 Holo Power 放到存檔區；若支付，Arts +30。", meta: { sourceZone, fixedBonus: 30 } });
    return true;
  }
  if (key === "hSD04-008:1") {
    const cards = player.archive.filter((instance) => ["supportEvent", "supportEventLimited"].includes(map.get(instance.number)?.typeCode) && cardHasTag(map.get(instance.number), "#食べ物"));
    if (cards.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "artArchiveToHandCost", source: "archive", prompt: "Arts 效果：可揀存檔區 1 張 #食べ物 事件返回手牌；若使用，Arts +20。", meta: { sourceZone, fixedBonus: 20 } });
    return true;
  }
  if (key === "hEB01-017:0" && cardHasName(map.get(player.oshi?.number), "宝鐘マリン")) {
    const cards = source.stack.slice(0, -1);
    if (cards.length === 0) return false;
    enqueueCardSelection(state, { playerIndex, cards, min: cards.length, max: cards.length, optional: true, effect: "artUnderCardCost", source: "stack", prompt: "Arts 效果：可將攻擊者下方全部 Holomen 放到存檔區；1 張以上 Arts +100，5 張以上再造成特殊傷害。", meta: { sourceZone, fixedBonus: 100, afterEffect: "marineUnderFive" } });
    return true;
  }
  if (key === "hBP03-043:1") {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    const targets = stageOptionsMatching(player, map, { names: ["モココ・アビスガード", "Mococo Abyssgard"] });
    if (sourceZone !== "center" || !cardHasName(map.get(player.oshi?.number), "FUWAMOCO") || options.length === 0 || targets.length === 0) return false;
    enqueueStageCheerSelection(state, {
      playerIndex,
      options,
      effect: "genericMoveCheer",
      optional: true,
      prompt: "一緒に食べる？：直接按攻擊者身上 1 張應援；下一步按 Mococo 改附。",
      meta: { sourceZone, sourceOnlyZone: sourceZone, cardNumber: card.number, remaining: 1, targetRule: { names: ["モココ・アビスガード", "Mococo Abyssgard"] }, minimumMoved: 1, afterSpecialDamage: 50, afterSpecialTarget: "center", sourceName: card.arts?.[artIndex]?.name || card.name },
    });
    return true;
  }
  if (key === "hBP04-025:0") {
    if (!cardHasName(map.get(player.oshi?.number), "儒烏風亭らでん")) return true;
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    const targets = stageOptionsMatching(player, map, { zones: BACK_SLOTS });
    if (options.length < 2 || targets.length < 2) return false;
    enqueueStageCheerSelection(state, {
      playerIndex,
      options,
      effect: "genericMoveCheer",
      optional: true,
      prompt: "御後就拜託了：直接按來源身上第 1 張應援；再分別按兩位不同後排改附。",
      meta: { sourceZone, sourceOnlyZone: sourceZone, cardNumber: card.number, remaining: 2, targetRule: { zones: BACK_SLOTS }, minimumMoved: 2, maxCheerFromEffect: 1, effectBatch: `${card.number}:${topCard(source)?.id}:${state.turn}`, afterArtBonus: 30 },
    });
    return true;
  }
  if (key === "hEB01-010:0") {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, stages: ["2nd"], names: ["ときのそら"], rested: false });
    if (options.length === 0) return false;
    enqueueStageTarget(state, { playerIndex, options, effect: "artRestBackRepeat", optional: true, prompt: "振り返れば、いつもあなたが。：可直接按活動狀態的後排 2nd ときのそら休息；支付後這位攻擊者可再用同一 Arts。", meta: { sourceZone, artIndex, sourceNumber: card.number } });
    return true;
  }
  if (key === "hBP05-037:1" && source.cheer.length > 0) {
    const archivedCheers = source.cheer.splice(0);
    player.archive.push(...archivedCheers);
    triggerCheerArchivedGift(state, playerIndex, map, archivedCheers.length);
    queueHbp01Oshi008Trigger(state, playerIndex, sourceZone, map);
    appendLog(state, `${player.name} 將攻擊者的所有應援放到存檔區。`);
    return true;
  }
  const art = card?.arts?.[artIndex];
  if (!art?.effect) return false;
  const fauxCard = { ...card, keyword: { name: art.name, effect: art.effect } };
  return queueGenericKeywordCostEffects(state, playerIndex, sourceZone, fauxCard, map, { isArt: true, artIndex });
}

function completeArtCheerCost(state, playerIndex, meta, map, random) {
  if (meta?.afterEffect === "fuwamocoNonDebutDamage") enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { excludeStages: ["Debut"] }, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位非 Debut 成員。", meta: { amount: 50, loseLife: true, sourceZone: meta.sourceZone, sourceName: "今度はこっちの番だよ！" } });
  if (meta?.afterEffect === "marineTopCheer" && state.players[playerIndex].cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: stageOptions(state.players[playerIndex]), optional: false });
  if (Number(meta?.paid || 0) > 0 && cardHasTag(unitCard(state.players[playerIndex]?.zones?.[meta.sourceZone], map), "#FLOW GLOW")) queueHsd11SpOshiTrigger(state, playerIndex, Number(meta.paid), map);
  if (meta?.afterEffect === "archiveHolomemToHand") queueArchiveToHand(state, playerIndex, { group: "holomem" }, map, { min: 1, max: 1, optional: false, label: "Arts 效果" });
  else if (meta?.afterEffect === "searchSummerMarine") queueDeckToHand(state, playerIndex, { group: "holomem", names: ["宝鐘マリン"], tags: ["#サマー"] }, map, random, { min: 1, max: 1, optional: false, label: "Arts 效果" });
  else if (meta?.afterEffect === "opponentCheerBottom") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const options = stageCheerOptions(state.players[opponentIndex], map);
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, ownerIndex: opponentIndex, options, effect: "artOpponentCheerBottom", prompt: "Arts 效果：直接按對手舞台上 1 張應援放回其應援牌庫底。" });
  }
}

function resolveGenericArtEffects(state, playerIndex, sourceZone, artIndex, targetZone, map, random, artCardOverride = null) {
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const source = player.zones[sourceZone];
  const card = artCardOverride || unitCard(source, map);
  const art = card?.arts?.[artIndex];
  const text = String(art?.effect || "");
  if (!source || !text) return 0;
  if (card.number === "hBP01-095") {
    const cards = player.hand.filter(c => fastForwardBloomTargets(player, map.get(c.number), map, state.turn).length);
    if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "fastForwardBloomCard", source: "hand", prompt: "可選手牌 1st，讓本回合出場的後排 Debut Bloom。" });
    return 0;
  }
  if (card.number === "hBP08-058") {
    if (artIndex === 0) {
      const cards = player.archive.filter(c => map.get(c.number)?.group === "cheer" && map.get(c.number)?.colors?.includes("藍"));
      const targetRule = { tags: ["#Advent"] };
      if (cards.length && stageOptionsMatching(player, map, targetRule).length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: Math.min(2, cards.length), optional: false, effect: "archiveCheerToStage", source: "archive", prompt: "選擇 1–2 張藍色應援分配給 #Advent 成員。", meta: { targetRule } });
    } else if (artIndex === 1) {
      const oshi = map.get(player.oshi?.number);
      if (cardHasName(oshi, "FUWAMOCO") && oshi.colors?.includes("藍")) queueArtCheerArchiveCost(state, playerIndex, sourceZone, stageCheerOptions(player, map, { stage: { zones: [sourceZone] } }), { min: 2, max: 2, afterEffect: "fuwamocoNonDebutDamage", prompt: "可存檔此成員 2 張應援，對非 Debut 成員造成 50 點特殊傷害。" });
    }
    return 0;
  }
  if (card.number === "hBP05-050" && artIndex === 0) {
    const mococoUsed = currentTurnEvents(player, state.turn).arts.some(number => cardHasName(map.get(number), "モココ・アビスガード"));
    const skillUsed = player.oshiSkillTurn === state.turn && map.get(player.oshi?.number)?.oshiSkill?.name === "モコちゃん！";
    return (mococoUsed ? 40 : 0) + (skillUsed ? 30 : 0);
  }
  if (card.number === "hBP05-018" && artIndex === 0) {
    if (stageEntries(player).some(({unit}) => cardHasTag(unitCard(unit,map), "#ID3期生") && cardIsBuzz(unitCard(unit,map)))) drawCards(state, playerIndex, 1);
    return 0;
  }
  if (card.number === "hBP07-085" && artIndex === 0) {
    if (cardHasName(map.get(player.oshi?.number), "不知火フレア")) {
      const options = stageOptionsMatching(player, map, { names: ["不知火フレア"] });
      if (options.length) enqueueStageTarget(state, { playerIndex, options, effect: "flareParfaitBuff", optional: false, meta: { sourceZone }, prompt: "選擇不知火フレア，本回合按其應援數增加 Arts。" });
    }
    return 0;
  }
  if (card.number === "hBP07-062" && artIndex === 0) {
    if (stageOptionsMatching(player, map, { tags: ["#Advent"] }).length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "shioriArchiveCheer", meta: { sourceZone } }, map);
    return 0;
  }
  if (card.number === "hBP07-056" && artIndex === 0) {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    const targets = stageOptionsMatching(player, map, { tags: ["#Promise"], excludeZones: [sourceZone] });
    if (options.length && targets.length) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericMoveCheer", optional: true, prompt: "可將此成員1張應援轉移給其他 #Promise 成員。", meta: { sourceZone, sourceOnlyZone: sourceZone, cardNumber: card.number, remaining: 1, targetRule: { zones: targets }, excludeSourceCard: true, afterArtBonus: cardHasName(map.get(player.oshi?.number), "オーロ・クロニー") ? 100 : 0 } });
    return 0;
  }
  if (card.number === "hBP07-044" && artIndex === 0) {
    const archived = player.mainDeck.splice(0, 2);
    player.archive.push(...archived);
    currentTurnEvents(player, state.turn).deckArchived += archived.length;
    queueArchiveToHand(state, playerIndex, { names: ["スタッフ"] }, map, { min: 0, max: 1, optional: true, label: art.name });
    return 0;
  }
  if (card.number === "hBP07-035" && artIndex === 0) {
    const cheers = player.zones[sourceZone].cheer.splice(0);
    if (cheers.length) enqueueCardSelection(state, { playerIndex, cards: cheers, min: cheers.length, max: cheers.length, optional: false, effect: "surgingCheerBottom", source: "revealed", prompt: "按順序將全部應援放到應援牌庫底。" });
    return 0;
  }
  if (card.number === "hBP07-022" && artIndex === 0) {
    const options = stageOptionsMatching(player, map, { tags: ["#3期生"] });
    if (options.length) enqueueStageTarget(state, { playerIndex, options, effect: "noelMuscleCost", optional: false, prompt: "選擇1位 #3期生，本回合無色 Arts 費用減少。" });
    return 0;
  }
  if (card.number === "hBP04-037" && artIndex === 0) {
    queueFixedSpecialDamage(state,playerIndex,sourceZone,["center"],50,art.name);
    if(currentTurnEvents(player,state.turn).supports.some(n=>cardHasName(map.get(n),"限界飯")))enqueueStageTarget(state,{playerIndex,targetPlayerIndex:playerIndex===0?1:0,options:stageOptionsMatching(opponent,map,{zones:["center","collab"]}),effect:"specialDamage",optional:false,prompt:"選擇中央或合作，造成30特殊傷害。",meta:{amount:30,loseLife:true,sourceZone,sourceName:art.name}});
    return 0;
  }
  if (card.number === "hBP04-015" && artIndex === 0) return Math.min(4, stageEntries(player).filter(({unit}) => cardHasTag(unitCard(unit,map), "#Promise")).length) * 10;
  if (card.number === "hBP04-031" && artIndex === 0) {
    const options = stageOptionsMatching(player,map,{zones:BACK_SLOTS,tags:["#語学"]});
    if (options.length) enqueueStageTarget(state,{playerIndex,options,effect:"multilingualCheer",optional:false,prompt:"選擇後排語学Holomen，再搜尋同色應援。"});
    return 0;
  }
  if (card.number === "hBP06-027" && artIndex === 0) return cardHasName(map.get(player.oshi?.number), "風真いろは") && player.zones.collab ? 40 : 0;
  if (card.number === "hBP06-081" && artIndex === 0) {
    const options = stageOptionsMatching(player, map, { colors: ["黃"] });
    if (player.life.length <= 3 && options.length) for (let i = 0; i < source.cheer.length; i++) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: true, prompt: "可選擇黃色Holomen附加應援牌庫頂1張。" });
    return 0;
  }
  if (card.number === "hBP06-060" && artIndex === 0) {
    if (cardHasName(map.get(player.oshi?.number), "森カリオペ") && player.mainDeck.length >= 2) enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: "存檔牌庫頂2張" }], optional: true, effect: "calliBullseye", prompt: "可存檔牌庫頂2張，再附加應援牌庫頂1張。" });
    return 0;
  }
  if (card.number === "hBP06-069" && artIndex === 0) return activeModifiers(source, "infiniteStamina", state.turn).length ? 50 : 0;
  if (card.number === "hBP06-045" && artIndex === 1) {
    const requiredSkill = text.match(/技能「([^」]+)」/u)?.[1];
    if (player.spOshiSkillUsed && requiredSkill && map.get(player.oshi?.number)?.spOshiSkill?.name === requiredSkill) {
      const options = stageOptionsMatching(opponent, map, { zones: ["center", "collab"] });
      if (options.length) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, options, effect: "specialDamage", optional: false, prompt: "選擇對手中央或合作 Holomen，造成100點特殊傷害。", meta: { amount: 100, loseLife: true, sourceName: art.name, sourceZone } });
    }
    return 0;
  }
  if (card.number === "hBP06-082" && artIndex === 0) {
    if (Number(player.oshiSkillTurn) === state.turn && map.get(player.oshi?.number)?.oshiSkill?.name === "神秘的儀式") queueArchiveToHand(state, playerIndex, { group: "holomem", names: ["アーニャ・メルフィッサ"] }, map, { min: 1, max: 3, optional: true, label: art.name });
    return 0;
  }
  if (card.number === "hEB01-015" && artIndex === 0) { queueGenericArtCostEffects(state, playerIndex, sourceZone, artIndex, card, map); return 0; }
  if (card.number === "hBP05-056" && artIndex === 0) return Math.min(2, currentTurnEvents(player, state.turn).supports.filter(number => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode) && cardHasTag(map.get(number), "#食べ物")).length) * 20;
  if (card.number === "hBP05-037" && artIndex === 0) {
    const source = player.zones[sourceZone];
    const colors = new Set(source.cheer.flatMap(instance => effectiveCheerColors(player, source, instance, map)));
    const count = Number(colors.has("紅")) + Number(colors.has("藍"));
    if (count) enqueueArchiveCheerToTarget(state, playerIndex, { min: count, max: count, optional: true, targetRule: { zones: [sourceZone] }, targetZone: sourceZone }, map);
    return 0;
  }
  if (card.number === "hBP05-031" && artIndex === 0) {
    if (playerIndex !== state.firstPlayer && Number(player.turnsTaken) === 1) queueDeckToHand(state, playerIndex, { names: ["座員"] }, map, random, { optional: false, label: card.arts[0].name });
    return 0;
  }
  if (card.number === "hBP04-014" && artIndex === 0) return stageEntries(player).some(({ unit }) => cardHasTag(unitCard(unit, map), "#ゲーマーズ") && !cardHasName(unitCard(unit, map), "白上フブキ")) ? 50 : 0;
  if (card.number === "hBP04-013" && artIndex === 0) {
    if (player.zones[sourceZone].attachments.some(instance => map.get(instance.number)?.group === "support" && cardHasTag(map.get(instance.number), "#こよラボ"))) queueDeckToHand(state, playerIndex, { group: "support", tags: ["#こよラボ"] }, map, random, { optional: false, label: card.arts[0].name });
    return 0;
  }
  if (card.number === "hBP03-065" && artIndex === 0) {
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { tags: ["#ゲーマーズ"] }, optional: false, prompt: card.arts[0].name });
    return 0;
  }
  if (card.number === "hBP03-050" && artIndex === 0) {
    queueCheerDeckSearch(state, playerIndex, card.arts[0].effect, sourceZone, map, random, { optional: false, targetRuleOverride: { tags: ["#Advent"] } });
    return 0;
  }
  if (card.number === "hSD07-008" && artIndex === 0) {
    const candidates = player.archive.filter(instance => cardHasName(map.get(instance.number), "エルフレンド") && attachmentTargets(player, map.get(instance.number), map).includes(sourceZone));
    if (candidates.length) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 0, max: 1, optional: true, effect: "genericArchiveSupportPick", source: "archive", prompt: "エルフレパーティー：可將存檔區1張エルフレンド附加到這位Holomen。", meta: { targetRule: { zones: [sourceZone] } } });
    return 0;
  }
  if (card.number === "hSD05-006" && artIndex === 1) {
    const names = new Set(stageEntries(player).map(({ unit }) => unitCard(unit, map)).filter(c => cardHasTag(c, "#ReGLOSS")).map(c => c.jpName || c.name));
    return names.size >= 3 ? 20 : 0;
  }
  if (card.number === "hSD05-009" && artIndex === 0) return stageEntries(player).some(({ unit }) => cardHasTag(unitCard(unit, map), "#ReGLOSS") && !cardHasName(unitCard(unit, map), "轟はじめ")) ? 30 : 0;
  if (card.number === "hSD04-009" && artIndex === 1) return currentTurnEvents(player, state.turn).supports.filter(number => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode)).length * 40;
  if (card.number === "hSD04-007" && artIndex === 0) {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS });
    if (options.length) enqueueStageTarget(state, { playerIndex, options, effect: "heal", optional: false, meta: { amount: 20 } });
    return 0;
  }
  if (card.number === "hSD01-011" && artIndex === 0) {
    if (stageOptionsMatching(player, map, { names: ["ときのそら"] }).length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: stageOptions(player), optional: false });
    return 0;
  }
  if (card.number === "hBP08-027" && artIndex === 0) {
    const count = stageEntries(player).filter(({ unit }) => unit.rested && cardHasTag(unitCard(unit, map), "#Justice")).length;
    drawCards(state, playerIndex, count);
    source.rested = true;
    return 0;
  }
  if (card.number === "hBP08-033" && artIndex === 0) {
    if (stageOptionsMatching(player, map, { names: ["パヴォリア・レイネ"] }).length) enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max: 2, optional: false, effect: "archiveCheerOneRecipient", targetRule: { names: ["パヴォリア・レイネ"] } }, map);
    return 0;
  }
  if (card.number === "hBP08-031" && artIndex === 0) {
    const archived = player.cheerDeck.shift();
    if (archived) player.archive.push(archived);
    const colors = new Set(stageEntries(player).flatMap(({ unit }) => unit.cheer.flatMap(cheer => effectiveCheerColors(player, unit, cheer, map))));
    if (colors.size) enqueueStageTarget(state, { playerIndex, effect: "heal", optional: false, prompt: "選擇自己 1 位 Holomen，按舞台應援顏色種類回復 HP。", meta: { amount: colors.size * 10 } });
    return 0;
  }
  if (card.number === "hBP08-089" && artIndex === 0) {
    if (stageOptionsMatching(player, map, { tags: ["#Justice"] }).length) enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { tags: ["#Justice"] } }, map);
    return 0;
  }
  if (card.number === "hBP08-088" && artIndex === 0) {
    return sourceZone === "collab" && cardHasTag(unitCard(player.zones.center, map), "#3期生") ? 30 : 0;
  }
  if (card.number === "hBP08-076" && artIndex === 0) {
    const count = player.archive.filter(instance => {
      const archived = map.get(instance.number);
      return archived?.group === "support" && ["supportEvent", "supportEventLimited"].includes(archived.typeCode) && cardHasTag(archived, "#食べ物");
    }).length;
    if (count >= 3) healStageUnit(state, playerIndex, sourceZone, 100, map);
    return 0;
  }
  if (card.number === "hBP08-068" && artIndex === 0) {
    const colors = map.get(opponent.oshi?.number)?.colors || [];
    const zones = ["center", "collab"].filter(zone => opponent.zones[zone] && (unitCard(opponent.zones[zone], map)?.colors || []).some(color => !colors.includes(color)));
    queueFixedSpecialDamage(state, playerIndex, sourceZone, zones, 20, art.name);
    return 0;
  }
  if (card.number === "hBP08-064" && artIndex === 0) {
    queueDeckAttachmentToStage(state, playerIndex, { names: ["ルイ友"] }, {}, map, random, art.name, { optional: false });
    return 0;
  }
  if (card.number === "hBP08-060" && artIndex === 0) {
    const oshi = map.get(player.oshi?.number);
    if (cardHasName(oshi, "FUWAMOCO") && oshi.colors?.includes("藍") && player.mainDeck.length) player.holoPower.push(player.mainDeck.shift());
    return 0;
  }
  if (card.number === "hBP08-053" && artIndex === 0) {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    if (opponent.zones.center && effectiveBatonCost(state, opponentIndex, opponent.zones.center, "center", map) >= 5) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { excludeStages: ["Debut"] }, effect: "specialDamage", optional: false, prompt: "選擇對手非 Debut Holomen，造成 100 點特殊傷害。", meta: { amount: 100, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP08-051" && artIndex === 0) {
    const options = stageOptionsMatching(player, map, { names: ["水宮枢"] });
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇水宮枢，附加應援牌庫頂 1 張。" });
    return 0;
  }
  if (card.number === "hBP06-020" && artIndex === 0) {
    const max = Math.min(3, player.mainDeck.length);
    if (max) enqueueOptionChoice(state, { playerIndex, effect: "artDeckTopArchive", optional: false, options: Array.from({ length: max }, (_, i) => ({ id: String(i + 1), label: "存檔牌庫頂 " + (i + 1) + " 張" })), prompt: "選擇存檔1～3張；每張這次Arts +20。", meta: { sourceZone, perBonus: 20 } });
    return 0;
  }
  if (card.number === "hBP08-044" && artIndex === 0) {
    const max = Math.min(3, player.mainDeck.length);
    if (max) enqueueOptionChoice(state, { playerIndex, effect: "artDeckTopArchive", optional: false, options: Array.from({ length: max }, (_, i) => ({ id: String(i + 1), label: "將牌庫頂 " + (i + 1) + " 張放入檔案區" })), prompt: "選擇放入檔案區的張數（1～3）。" });
    return 0;
  }
  if (card.number === "hBP08-043" && artIndex === 0) {
    if (stageEntries(player).every(({ unit }) => cardHasTag(unitCard(unit, map), "#Myth")) && player.mainDeck.length) player.holoPower.push(player.mainDeck.shift());
    return 0;
  }
  if (card.number === "hBP08-040" && artIndex === 0) {
    return player.archive.filter(instance => map.get(instance.number)?.group === "cheer" && map.get(instance.number)?.colors?.includes("紅")).length * 10;
  }
  if (card.number === "hBP08-024" && artIndex === 0) {
    source.rested = true;
    return 0;
  }
  if (card.number === "hBP08-019" && artIndex === 0) {
    if (!source.attachments.some(instance => cardHasName(map.get(instance.number), "Chattino"))) queueDeckAttachmentToStage(state, playerIndex, { names: ["Chattino"] }, { zones: [sourceZone] }, map, random, art.name, { optional: false });
    return 0;
  }
  if (card.number === "hBP08-017" && artIndex === 0) {
    return stageEntries(player).some(({ unit }) => unitCard(unit, map)?.stage === "2nd" && cardHasTag(unitCard(unit, map), "#0期生")) ? 20 : 0;
  }
  if (card.number === "hBP08-020" && artIndex === 0) {
    return currentTurnEvents(player, state.turn).deckArchived >= 3 ? 40 : 0;
  }
  if (["hBP07-084", "hBP08-050"].includes(card.number) && artIndex === 0) {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false }, map);
    return 0;
  }
  if (card.number === "hBP07-088" && artIndex === 0) {
    return currentTurnEvents(player, state.turn).cheerArchived > 0 ? 30 : 0;
  }
  if (card.number === "hBP07-079" && artIndex === 0) {
    queueDeckAttachmentToStage(state, playerIndex, { names: ["やめなー"] }, {}, map, random, art.name, { optional: false });
    return 0;
  }
  if (card.number === "hBP07-073" && artIndex === 0) {
    queueDeckToHand(state, playerIndex, { names: ["ラプラス・ダークネス"] }, map, random, { min: 1, max: 1, optional: false, label: art.name });
    return 0;
  }
  if (card.number === "hBP07-064" && artIndex === 0) {
    queueDeckAttachmentToStage(state, playerIndex, { names: ["開拓者"] }, { names: ["AZKi"] }, map, random, art.name, { optional: false });
    return 0;
  }
  if (card.number === "hBP07-061" && artIndex === 0) {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位後排 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP07-057" && artIndex === 0) {
    if (cardHasName(map.get(player.oshi?.number), "猫又おかゆ") && BACK_SLOTS.some(zone => opponent.zones[zone]?.damage > 100)) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: {}, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位 Holomen，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (["hBP07-053", "hBP07-054"].includes(card.number) && artIndex === 0) {
    const options = stageEntries(player).filter(({ unit }) => cardHasTag(unitCard(unit, map), "#Promise") && (card.number !== "hBP07-054" || cardIsBuzz(unitCard(unit, map)))).map(({ zone }) => zone);
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇符合條件的 #Promise 成員，附加應援牌庫頂 1 張。" });
    return 0;
  }
  if (card.number === "hBP07-052" && artIndex === 0) {
    return stageEntries(player).some(({ unit }) => cardHasTag(unitCard(unit, map), "#Promise") && !cardHasName(unitCard(unit, map), "オーロ・クロニー")) ? 10 : 0;
  }
  if (card.number === "hBP07-048" && artIndex === 0) {
    queueArchiveToHand(state, playerIndex, { group: "holomem", tags: ["#EN"] }, map, { min: 1, max: 1, optional: false, label: art.name });
    return 0;
  }
  if (card.number === "hBP07-025" && artIndex === 0) {
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, targetRule: { tags: ["#ゲーマーズ"] } }, map);
    return 0;
  }
  if (card.number === "hBP06-077" && artIndex === 0) {
    return currentTurnEvents(player, state.turn).supports.filter(n => map.get(n)?.group === "support" && String(map.get(n)?.type || "").toUpperCase().includes("LIMITED")).length * 30;
  }
  if (["hBP06-061", "hBP06-066"].includes(card.number) && artIndex === 0) {
    const count = source.attachments.filter(c => cardHasName(map.get(c.number), "ろぼさー")).length;
    if (card.number === "hBP06-061" && count >= 1) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center"], 20, art.name);
    if (card.number === "hBP06-066" && count >= 3) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: "選擇對手中心或合作 Holomen，造成 70 點特殊傷害。", meta: { amount: 70, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP06-053" && artIndex === 0) {
    if (source.cheer.length >= 4) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: "選擇對手中心或合作 Holomen，造成 90 點特殊傷害。", meta: { amount: 90, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (["hBP06-048", "hBP06-050"].includes(card.number) && artIndex === 0) {
    const enabled = card.number === "hBP06-050" || source.cheer.some(c => !effectiveCheerColors(player, source, c, map).includes("藍"));
    if (enabled) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位後排 Holomen，造成 10 點特殊傷害。", meta: { amount: 10, loseLife: card.number !== "hBP06-048", sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP06-031" && artIndex === 0) {
    return source.attachments.filter(c => cardHasName(map.get(c.number), "ルーナイト")).length >= 2 ? 50 : 0;
  }
  if (["hBP06-018", "hBP06-019"].includes(card.number) && artIndex === 0) {
    const archived = player.mainDeck.shift();
    if (archived) {
      player.archive.push(archived);
      currentTurnEvents(player, state.turn).deckArchived += 1;
      queueFlowGlowArchivedCards(state, playerIndex, card, [archived], map);
      appendLog(state, player.name + " 將牌庫頂 1 張放到存檔區。", [archived]);
    }
    return 0;
  }
  if (card.number === "hBP05-049" && artIndex === 0) {
    const damage = BACK_SLOTS.reduce((sum, zone) => sum + Number(opponent.zones[zone]?.damage || 0), 0);
    const cards = player.archive.filter(c => map.get(c.number)?.group === "cheer" && (map.get(c.number)?.colors || []).includes("藍"));
    const targetRule = { names: ["こぼ・かなえる"] };
    if (damage >= 80 && cards.length && stageOptionsMatching(player, map, targetRule).length) enqueueCardSelection(state, { playerIndex, cards, min: 0, max: 1, optional: true, effect: "archiveCheerToStage", source: "archive", prompt: "可以選擇 1 張藍色應援，附加到自己的こぼ・かなえる。", meta: { targetRule } });
    return 0;
  }
  if (card.number === "hBP05-059" && artIndex === 0) {
    if (cardHasName(map.get(player.oshi?.number), "ネリッサ・レイヴンクロフト")) appendLog(state, player.name + " 抽 " + drawCards(state, playerIndex, 1) + " 張牌。");
    return 0;
  }
  if (card.number === "hBP05-039" && artIndex === 0) {
    if (currentTurnEvents(player, state.turn).supports.some(n => cardHasName(map.get(n), "限界飯"))) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], 20, art.name);
    return 0;
  }
  if (card.number === "hBP05-047" && artIndex === 0) {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: "選擇對手 1 位後排 Holomen，造成 10 點特殊傷害。", meta: { amount: 10, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP05-024" && artIndex === 0) {
    const hasPioneer = stageEntries(player).some(({unit}) => unit.attachments.some(c => cardHasName(map.get(c.number), "開拓者")));
    const options = stageOptionsMatching(player, map, { names: ["AZKi"] });
    if (hasPioneer && options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇自己的 AZKi，附加應援牌庫頂 1 張。" });
    return 0;
  }
  if (card.number === "hBP05-029") {
    if (artIndex === 1) return stageEntries(player).some(({unit}) => unitCard(unit, map)?.stage === "2nd" && cardHasTag(unitCard(unit, map), "#ReGLOSS")) ? 40 : 0;
    if (cardHasName(map.get(player.oshi?.number), "儒烏風亭らでん")) queueDeckToHand(state, playerIndex, { typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#きのこ"] }, map, random, { min: 1, max: 1, optional: false, label: art.name });
    return 0;
  }
  if (card.number === "hBP05-023" && artIndex === 0) {
    if (sourceZone !== "center" || !cardHasName(map.get(player.oshi?.number), "アイラニ・イオフィフティーン")) return 0;
    return Math.floor(stageEntries(player).reduce((sum, {unit}) => sum + unit.cheer.length, 0) / 3) * 20;
  }
  if (card.number === "hBP05-015" && artIndex === 0) {
    if (stageEntries(player).filter(({unit}) => cardHasTag(unitCard(unit, map), "#3期生")).length >= 3 && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [sourceZone], optional: false, prompt: "將應援牌庫頂 1 張附加到此 Holomen。" });
    return 0;
  }
  if (card.number === "hBP05-012" && artIndex === 1) {
    return sourceZone === "center" && cardHasTag(unitCard(player.zones.collab, map), "#3期生") ? 30 : 0;
  }
  if (card.number === "hBP04-086" && artIndex === 1) {
    return Math.min(5, player.archive.filter(c => map.get(c.number)?.group === "cheer").length) * 20;
  }
  if (card.number === "hBP04-065" && artIndex === 0) {
    return player.archive.some(c => map.get(c.number)?.group === "cheer" && (map.get(c.number)?.colors || []).includes("紅")) ? 20 : 0;
  }
  if (card.number === "hBP04-071" && artIndex === 0) {
    if (player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [sourceZone], optional: false, prompt: "將應援牌庫頂 1 張附加到這位 Holomen。" });
    return 0;
  }
  if (card.number === "hBP04-062" && artIndex === 0) {
    const cards = player.mainDeck.splice(0, 2);
    if (cards.length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: false, effect: "lastCupArchive", source: "revealed", prompt: "選擇 1 張卡存檔，其餘放回牌庫頂。" });
    return 0;
  }
  if (card.number === "hBP04-060" && artIndex === 0) {
    const amount = (opponent.zones.center?.cheer.length || 0) * 10;
    if (amount) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], amount, art.name);
    return 0;
  }
  if (card.number === "hBP04-061" && artIndex === 0) {
    return stageEntries(player).filter(({zone, unit}) => zone !== sourceZone && unitCard(unit, map)?.stage === "2nd" && cardHasTag(unitCard(unit, map), "#ID2期生")).length * 20;
  }
  if (card.number === "hBP04-033" && artIndex === 1) {
    if (currentTurnEvents(player, state.turn).supports.some(n => cardHasName(map.get(n), "限界飯"))) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["collab"], 20, art.name);
    return 0;
  }
  if (card.number === "hBP04-016" && artIndex === 0 && stageEntries(player).length > 5) return 0;
  if (card.number === "hBP03-078" && artIndex === 0) {
    return ["綠", "藍"].reduce((bonus, color) => bonus + (source.cheer.some(c => effectiveCheerColors(player, source, c, map).includes(color)) ? 50 : 0), 0);
  }
  if (card.number === "hBP03-072" && artIndex === 0) {
    if (sourceZone === "center" && source.cheer.length >= 6) {
      addStageModifier(source, "arts", 100, state.turn, card.number);
      if (player.zones.collab) addStageModifier(player.zones.collab, "arts", 100, state.turn, card.number);
    }
    return 0;
  }
  if (card.number === "hBP03-070" && artIndex === 0) {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, names: ["角巻わため"] });
    if (options.length && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, optional: false, prompt: "選擇後排角巻わため，附加應援牌庫頂 1 張。" });
    return 0;
  }
  if (card.number === "hBP03-074" && artIndex === 0) {
    return ["アイラニ・イオフィフティーン", "ムーナ・ホシノヴァ"].reduce((bonus, name) => bonus + (stageEntries(player).some(({unit}) => cardHasName(unitCard(unit, map), name)) ? 10 : 0), 0);
  }
  if (card.number === "hBP03-068" && artIndex === 0) {
    const active = stageEntries(player).some(({unit}) => (unitCard(unit, map)?.colors || []).includes("黃") && unit.attachments.some(c => cardHasName(map.get(c.number), "わためいと")));
    if (active) enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { colors: ["黃"] }, prompt: "可選存檔區 1 張應援，附加到自己的黃色 Holomen。" }, map);
    return 0;
  }
  if (card.number === "hBP03-055" && artIndex === 1) {
    if (BACK_SLOTS.some(zone => cardHasTag(unitCard(player.zones[zone], map), "#歌"))) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["collab"], 20, art.name);
    return 0;
  }
  if (card.number === "hBP03-056" && artIndex === 0) {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: "選擇對手中央或合作 Holomen，造成 30 點特殊傷害。", meta: { amount: 30, loseLife: true, sourceName: art.name, sourceZone } });
    return 0;
  }
  if (card.number === "hBP03-052" && artIndex === 0) {
    queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center"], 10, art.name);
    if (cardHasName(map.get(player.oshi?.number), "常闇トワ")) {
      const options = stageAttachmentOptions(opponent, map, (instance, attachment, zone) => ["center", "collab"].includes(zone) && attachment?.typeCode === "supportTool");
      if (options.length) enqueueStageAttachmentSelection(state, { playerIndex, ownerIndex: playerIndex === 0 ? 1 : 0, options, effect: "towaArchiveTool", optional: true, prompt: "可將對手中央或合作 Holomen 的 1 張工具存檔。" });
    }
    return 0;
  }
  if (card.number === "hBP02-034" && artIndex === 1) {
    if (source.attachments.some(instance => ["supportTool", "supportMascot"].includes(map.get(instance.number)?.typeCode))) enqueueStageTarget(state, {
      playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false,
      prompt: "オーガニックショット：選對手中央或合作 Holomen，造成 30 特殊傷害。",
      meta: { amount: 30, loseLife: true, sourceName: art.name, sourceZone }
    });
    return 0;
  }
  if (card.number === "hBP01-092" && artIndex === 0) {
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    const targets = stageEntries(player).filter(({ zone, unit: target }) => zone !== sourceZone && cardHasTag(unitCard(target, map), "#Promise")).map(({ zone }) => zone);
    if (options.length && targets.length) enqueueStageCheerSelection(state, { playerIndex, options, effect: "genericMoveCheer", optional: true, prompt: "可選來源一張應援，改附到其他 #Promise Holomen。", meta: { sourceZone, sourceOnlyZone: sourceZone, cardNumber: card.number, remaining: 1, targetRule: { zones: targets, tags: ["#Promise"] }, excludeSourceCard: true } });
    return 0;
  }
  if (card.number === "hBP02-064" && artIndex === 0) {
    const count = player.archive.filter(instance => {
      const archived = map.get(instance.number);
      return archived?.group === "holomem" && cardHasTag(archived, "#Myth");
    }).length;
    const options = stageCheerOptions(player, map, { stage: { zones: [sourceZone] } });
    if (count >= 5 && options.length && stageEntries(player).some(entry => entry.zone !== sourceZone)) enqueueStageCheerSelection(state, {
      playerIndex, options, effect: "genericMoveCheer", optional: true,
      prompt: "可選此攻擊者的 1 張應援，改附到自己的另一位 Holomen。",
      meta: { sourceZone, sourceOnlyZone: sourceZone, cardNumber: card.number, remaining: 1, targetRule: {}, excludeSourceCard: true }
    });
    return count >= 10 ? 50 : 0;
  }
  if (card.number === "hBP01-067" && artIndex === 1) {
    const cards = player.archive.filter(instance => map.get(instance.number)?.group === "holomem");
    const count = cards.length;
    if (count) enqueueCardSelection(state, { playerIndex, cards, min: Math.min(6, count), max: Math.min(6, count), optional: false, source: "archive", effect: "kiaraArchiveReturnSix", prompt: "選擇存檔區 6 張 Holomen 返回牌庫並洗牌；不足時全部返回。" });
    else player.mainDeck = shuffle(player.mainDeck, random);
    return count * 10;
  }
  if (card.number === "hBP02-059" && artIndex === 0) {
    const count = player.archive.filter(instance => {
      const archived = map.get(instance.number);
      return archived?.group === "holomem" && cardHasTag(archived, "#Myth");
    }).length;
    return (count >= 4 ? 40 : 0) + (count >= 8 ? 40 : 0);
  }
  if (card.number === "hBP02-047" && artIndex === 0) {
    const amount = Number(opponent.zones.center?.cheer.length || 0) * 20;
    if (amount > 0) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], amount, art.name);
    return 0;
  }
  if (card.number === "hSD13-015" && artIndex === 0) {
    const center = player.zones.center;
    const collab = player.zones.collab;
    if (!center || !collab || !cardHasTag(unitCard(center, map), "#Justice") || !cardHasTag(unitCard(collab, map), "#Justice")) return 0;
    // Printed-text interpretation: a differently colored cheer on each member.
    // Multi-color pair semantics remain pending authoritative clarification.
    const centerColors = center.cheer.flatMap(cheer => effectiveCheerColors(player, center, cheer, map));
    const collabColors = collab.cheer.flatMap(cheer => effectiveCheerColors(player, collab, cheer, map));
    return centerColors.some(color => collabColors.some(other => other !== color)) ? 20 : 0;
  }
  if (card.number === "hSD13-014" && artIndex === 0) {
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, targetRule: { tags: ["#Justice"] }, optional: false, prompt: "正義の旋律：選擇自己1位#Justice成員，附加應援牌庫頂1張。" });
    return 0;
  }
  if (["hSD13-011", "hSD13-013"].includes(card.number) && artIndex === 0) {
    const hasHolomemUnder = source.stack.slice(0, -1).some(instance => map.get(instance.number)?.group === "holomem");
    return hasHolomemUnder ? 0 : card.number === "hSD13-011" ? 20 : 90;
  }
  if (card.number === "hSD13-007" && artIndex === 0) {
    // The cheer attachment is resolved only by the Art knockout trigger.
    return source.cheer.length * 20;
  }
  if (card.number === "hSD14-008" && artIndex === 0) {
    return sourceZone === "collab" && source.attachments.some(instance => map.get(instance.number)?.typeCode === "supportMascot") ? 20 : 0;
  }
  if (card.number === "hSD15-008" && artIndex === 0) {
    return currentTurnEvents(player, state.turn).supports.some(number => ["supportEvent", "supportEventLimited"].includes(map.get(number)?.typeCode) && cardHasTag(map.get(number), "#きのこ")) ? 10 : 0;
  }
  if (card.number === "hSD11-008" && artIndex === 0) {
    const target = opponent.zones[targetZone];
    if (target && effectiveBatonCost(state, playerIndex === 0 ? 1 : 0, target, targetZone, map) >= 2 && player.cheerDeck.length > 0) {
      const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS });
      if (options.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, targetRule: { zones: BACK_SLOTS }, optional: false, prompt: "愛是時間喔：將應援牌庫頂 1 張附加到自己的 1 位後排 Holomen。" });
    }
    return 0;
  }
  if (card.number === "hSD11-009" && artIndex === 0) {
    const target = opponent.zones[targetZone];
    const batonCost = target ? effectiveBatonCost(state, playerIndex === 0 ? 1 : 0, target, targetZone, map) : 0;
    if (target) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, targetZone, amount: batonCost * 10, loseLife: true, sourceName: art.name, sourceZone });
    return 0;
  }
  if (card.number === "hSD12-004" && artIndex === 1) {
    const options = stageOptionsMatching(player, map, { tags: ["#Advent"] });
    if (player.cheerDeck.length > 0 && options.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, targetRule: { tags: ["#Advent"] }, optional: false, prompt: "Rebellion：公開應援牌庫頂 1 張，附加到自己 1 位 #Advent Holomen。" });
    return 0;
  }
  if (card.number === "hSD12-006" && artIndex === 0) {
    const options = stageOptionsMatching(opponent, map, {});
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, options, effect: "specialDamage", optional: false, prompt: art.name + "：選擇對手 1 位 Holomen，造成 20 點特殊傷害。", meta: { amount: 20, loseLife: true, sourceZone, sourceName: art.name } });
    return 0;
  }
  if (card.number === "hSD12-007" && artIndex === 0) {
    const amount = stageHasTag(player, "#Advent", map).length * 10;
    const options = stageOptionsMatching(opponent, map, { excludeStages: ["Debut"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, options, effect: "specialDamage", optional: false, prompt: art.name + "：選擇對手 1 位非 Debut Holomen，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: true, sourceZone, sourceName: art.name } });
    return 0;
  }
  if (["hSD17-005", "hSD17-008"].includes(card.number) && artIndex === 0) {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: `${art.name}：選擇對手 1 位後排成員，造成 10 特殊傷害。`, meta: { amount: 10, loseLife: true, sourceZone, sourceName: art.name } });
    return 0;
  }
  if (card.number === "hSD18-008" && artIndex === 0) {
    if (sourceZone === "center") queueArchiveToHand(state, playerIndex, { typeCodes: ["supportTool"] }, map, { min: 1, max: 1, optional: false, label: art.name });
    return 0;
  }
  if (["hBP08-059", "hBP08-039"].includes(card.number) && artIndex === 0) {
    // The previous Mococo Art controls only +50. The transfer is independent,
    // takes red cheer only from this attacker, and uses one fixed recipient.
    const fuwawa = card.number === "hBP08-059";
    const color = fuwawa ? "紅" : "藍";
    const targetName = fuwawa ? "モココ・アビスガード" : "フワワ・アビスガード";
    const usedMococo = currentTurnEvents(player, state.turn).arts.some(number => cardHasName(map.get(number), "モココ・アビスガード"));
    const options = stageCheerOptions(player, map, { colors: [color], stage: { zones: [sourceZone] } });
    const targets = stageOptionsMatching(player, map, { names: [targetName] }).filter(zone => zone !== sourceZone);
    if (options.length > 0 && targets.length > 0) enqueueStageTarget(state, { playerIndex, options: targets, effect: "boundaryTransferTarget", optional: true, prompt: `選擇 1 位 ${targetName} 接收此攻擊者的${color}色應援；可略過以選擇 0 張。`, meta: { sourceZone, color, targetName } });
    return fuwawa ? (usedMococo ? 50 : 0) : options.length * 20;
  }
  // Only the draw is conditional; the following deck archive always resolves.
  if (card.number === "hBP06-058" && artIndex === 0) {
    if (stageCheerColors(player, source, map).includes("紫")) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    const amount = Math.min(2, player.mainDeck.length);
    if (amount > 0) {
      player.archive.push(...player.mainDeck.splice(0, amount));
      currentTurnEvents(player, state.turn).deckArchived += amount;
      appendLog(state, `${player.name} 再將牌庫頂 ${amount} 張放到存檔區。`);
    }
    return 0;
  }

  if (["hBP03-021", "hBP05-028"].includes(card.number) && artIndex === 0) {
    queueBotanCheerPayment(state, playerIndex, sourceZone, card, map);
    return 0;
  }
  if (card.number === "hBP04-014" && artIndex === 0) return stageEntries(player).some(({ unit }) => cardHasTag(unitCard(unit, map), "#ゲーマーズ") && !cardHasName(unitCard(unit, map), "白上フブキ")) ? 50 : 0;
  if (card.number === "hBP04-013" && artIndex === 0) {
    const hasLabSupport = (source.attachments || []).some((instance) => {
      const attachment = map.get(instance.number);
      return attachment?.group === "support" && cardHasTag(attachment, "#こよラボ");
    });
    if (hasLabSupport) queueDeckToHand(state, playerIndex, { group: "support", tags: ["#こよラボ"] }, map, random, { label: art.name });
    return 0;
  }
  if (card.number === "hBP04-014" && artIndex === 0) {
    return stageEntries(player).some(({ unit: stageUnit }) => {
      const companion = unitCard(stageUnit, map);
      return cardHasTag(companion, "#ゲーマーズ") && !cardHasName(companion, "白上フブキ");
    }) ? 50 : 0;
  }

  if (card.number === "hBP03-024" && artIndex === 0) {
    return source.cheer.filter(c => !effectiveCheerColors(player, source, c, map).includes("綠")).length >= 2 ? 50 : 0;
  }
  if (card.number === "hBP03-022" && artIndex === 0) {
    if (cardHasName(map.get(player.oshi?.number), "アキ・ローゼンタール")) {
      for (const { zone, unit } of stageEntries(player)) {
        if (unit.attachments.some(c => map.get(c.number)?.typeCode === "supportTool")) healStageUnit(state, playerIndex, zone, 10, map);
      }
    }
    return 0;
  }
  const fauxCard = { ...card, keyword: { name: art.name, effect: text } };
  const dice = resolveDiceArtEffects(state, playerIndex, sourceZone, artIndex, card, art, map, random);
  if (!dice.handled && !artConditionApplies(state, playerIndex, sourceZone, targetZone, text, map)) return 0;
  const costQueued = !(card.number === "hBP02-027" && artIndex === 0) && !dice.handled && queueGenericArtCostEffects(state, playerIndex, sourceZone, artIndex, card, map);
  if (card.number === "hBP03-035" && artIndex === 0) return 0;
  let bonus = dice.bonus;
  const key = `${card.number}:${artIndex}`;
  if (key === "hBP04-043:0") {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, effect: "specialDamage", prompt: "こんらみ～：選對手 1 位成員，造成 10 點特殊傷害；因此擊倒不扣生命。", meta: { amount: 10, loseLife: false, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP02-012:0") {
    ["center", "collab"].forEach((targetStageZone) => {
      const targetUnit = player.zones[targetStageZone];
      if (targetUnit?.attachments.some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) addStageModifier(targetUnit, "arts", 20, state.turn, card.number);
    });
    return bonus;
  }
  if (key === "hBP03-015:0") {
    if (BACK_SLOTS.filter((targetStageZone) => player.zones[targetStageZone] && cardHasTag(unitCard(player.zones[targetStageZone], map), "#ReGLOSS")).length >= 4) bonus += 40;
    return bonus;
  }
  if (key === "hBP03-071:0") {
    enqueueOptionChoice(state, { playerIndex, options: [{id:"play",label:"猜拳"}], optional: true, effect: "watameRpsStart", prompt: "可以進行猜拳。", meta: {sourceZone,targetZone} });
    return bonus;
  }  if (key === "hBP04-026:0") {
    if (stageEntries(player).some(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#ゲーマーズ") && !cardHasName(unitCard(stageUnit, map), "大神ミオ"))) bonus += 50;
    return bonus;
  }
  if (key === "hBP05-071:0") {
    const options = stageOptionsMatching(player, map, { tags: ["#ゲーマーズ"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artBuffTarget", prompt: "YB-2：直接按自己 1 位 #ゲーマーズ Holomen，本回合 Arts +30。", meta: { amount: 30, sourceZone, sourceNumber: card.number } });
    return bonus;
  }
  if (key === "hBP06-014:0") {
    const options = sourceZone === "center" ? stageOptionsMatching(player, map, { zones: ["collab"], tags: ["#絵"] }) : [];
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artBuffTarget", prompt: "色彩的重生：直接按合作位置的 #絵 Holomen；本回合 Arts +50、無色費用 -1。", meta: { amount: 50, artCostReduction: 1, sourceZone, sourceNumber: card.number } });
    return bonus;
  }
  if (key === "hBP06-060:1") {
    const options = stageOptionsMatching(player, map, { tags: ["#Myth"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artBuffTarget", prompt: "Memento Mori.：直接按自己 1 位 #Myth Holomen，本回合 Arts +20。", meta: { amount: 20, sourceZone, sourceNumber: card.number } });
    if (cardHasName(map.get(player.oshi?.number), "森カリオペ") && player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length >= 8) enqueueOptionChoice(state, { playerIndex, options: [{ id: "draw", label: "抽1張牌" }], optional: true, effect: "calliMementoDraw", prompt: "Memento Mori.：可抽1張牌。" });
    return bonus;
  }
  if (key === "hBP06-070:0") {
    if (player.oshi?.number === "hBP03-006" && Number(player.oshiSkillTurn || 0) === state.turn) bonus += 40;
    return bonus;
  }
  if (key === "hBP08-014:0") {
    const amount = source.cheer.filter((instance) => (map.get(instance.number)?.colors || []).includes("紫")).length * 20;
    if (amount > 0) stageEntries(player).forEach(({ unit: stageUnit }) => addStageModifier(stageUnit, "arts", amount, state.turn, card.number));
    return bonus;
  }
  if (key === "hSD05-008:0") {
    const options = stageOptionsMatching(player, map, { stages: ["Debut"], tags: ["#ReGLOSS"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artBuffTarget", prompt: "直接按自己 1 位 #ReGLOSS Debut Holomen，本回合 Arts +40。", meta: { amount: 40, sourceZone, sourceNumber: card.number } });
    return bonus;
  }
  if (key === "hSD11-007:0") {
    if (opponent.zones.center) {
      addStageModifier(opponent.zones.center, "batonCost", 1, state.turn + 1, card.number);
      appendLog(state, `${opponent.name} 的中央 Holomen 到其下個回合結束前接力費用 +1。`);
    }
    return bonus;
  }
  if (["hBP02-039:0", "hBP02-040:0"].includes(key)) {
    if (player.mainDeck.length) enqueueOptionChoice(state, { playerIndex, options: [{ id: "reveal", label: "公開牌庫頂 3 張" }], optional: true, effect: "holoXSlotReveal", prompt: "ホロックスロット：可公開頂三張，或略過。", meta: { sourceZone } });
    return bonus;
  }
  if (key === "hBP03-013:0") {
    const targetRule = { names: ["姫森ルーナ"] };
    const candidates = player.archive.filter(c => cardHasName(map.get(c.number), "ルーナイト"));
    if (candidates.length && stageOptionsMatching(player, map, targetRule).length) enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "genericArchiveSupportPick", source: "archive", prompt: "ムーンギャラクシー：選擇 1 張存檔區ルーナイト，附加到姫森ルーナ。", meta: { targetRule } });
    return bonus;
  }
  if (key === "hBP07-042:1") return bonus + (currentTurnEvents(player, state.turn).stageReturned > 0 ? 50 : 0);
  if (key === "hBP07-021:0") return bonus + (stageEntries(player).some(({unit}) => cardHasTag(unitCard(unit,map), "#ID3期生") && cardIsBuzz(unitCard(unit,map))) ? 40 : 0);
  if (key === "hBP05-033:1") return bonus + source.attachments.filter(instance => cardHasName(map.get(instance.number), "座員")).length * 10;
  if (key === "hBP02-027:0") {
    if (player.mainDeck.length) enqueueOptionChoice(state, { playerIndex, options: [{ id: "archive", label: "存檔牌庫頂 1 張" }], optional: true, effect: "mioTarotArchive", prompt: "タロットの導き：可存檔牌庫頂 1 張，按卡種增加這次 Arts 傷害。", meta: { sourceZone } });
    return bonus;
  }
  if (key === "hBP01-018:0") {
    if (player.mainDeck.length > 0) enqueueOptionChoice(state, { playerIndex, options: [{ id: "reveal", label: "公開牌庫頂 1 張並加入手牌" }], optional: true, effect: "mumeiMemoryFragment", prompt: "思い出の欠片：可公開牌庫頂 1 張；若有 #Promise，這次 Arts +20。", meta: { sourceZone } });
    return bonus;
  }
  if (key === "hBP01-035:0") {
    if (source.attachments.some(instance => map.get(instance.number)?.typeCode === "supportTool") && player.cheerDeck.length) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, optional: false, prompt: "選擇自己一位 Holomen，附加應援牌庫頂 1 張。" });
    return bonus;
  }
  if (key === "hBP01-020:0") {
    const amount = BACK_SLOTS.filter((zone) => player.zones[zone]).length * 10;
    ["center", "collab"].forEach((zone) => {
      if (player.zones[zone] && amount > 0) addStageModifier(player.zones[zone], "arts", amount, state.turn, card.number);
    });
    return bonus;
  }
  if (key === "hBP02-017:1") {
    if (sourceZone === "collab") bonus += Math.min(4, stageEntries(player).filter(({ zone, unit: stageUnit }) => zone !== sourceZone && cardHasTag(unitCard(stageUnit, map), "#3期生")).length) * 20;
    return bonus;
  }
  if (key === "hBP03-030:0") {
    return bonus + source.attachments.filter(c => cardHasName(map.get(c.number), "35P")).length * 20;
  }
  if (key === "hBP01-071:0") {
    bonus += stageEntries(player).reduce((count, { unit: stageUnit }) => count + (stageUnit.attachments || []).filter((instance) => map.get(instance.number)?.typeCode === "supportFan").length, 0) * 20;
    return bonus;
  }
  if (key === "hBP03-049:0") {
    const count = new Set(BACK_SLOTS.map((zone) => unitCard(player.zones[zone], map)).filter((candidate) => cardHasTag(candidate, "#ReGLOSS")).map((candidate) => candidate.jpName || candidate.name)).size;
    if (count > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", ...BACK_SLOTS] }, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手中央或後排，造成 ${count * 10} 點特殊傷害。`, meta: { amount: count * 10, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP03-056:1") {
    const count = Math.min(4, BACK_SLOTS.filter((zone) => cardHasTag(unitCard(player.zones[zone], map), "#歌")).length);
    if (count > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手中央或合作，造成 ${count * 20} 點特殊傷害。`, meta: { amount: count * 20, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP04-036:0") {
    if (targetZone === "collab") appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return bonus;
  }
  if (key === "hBP04-042:0") {
    const hasOther = stageEntries(player).some(({ zone, unit: stageUnit }) => zone !== sourceZone && cardHasTag(unitCard(stageUnit, map), "#ID3期生"));
    if (hasOther) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return bonus;
  }
  if (key === "hBP04-042:1") {
    const armed = stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).some((instance) => cardHasTag(map.get(instance.number), "#カエラ'sアームズ")));
    if (armed && opponent.zones.collab) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, targetZone: "collab", amount: 30, loseLife: true, sourceName: art.name, sourceZone });
    return bonus;
  }
  if (key === "hBP04-046:0") {
    const hasFan = stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportFan"));
    if (hasFan) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手 1 位 Holomen，造成 10 點特殊傷害。`, meta: { amount: 10, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP04-049:1") {
    const sourceColors = card.colors || [];
    if (stageEntries(player).some(({ unit: stageUnit }) => (unitCard(stageUnit, map)?.colors || []).some((color) => !sourceColors.includes(color)))) bonus += 50;
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: BACK_SLOTS }, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手 1 位後排，造成 20 點特殊傷害。`, meta: { amount: 20, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP04-053:0") {
    if(player.holoPower.length)enqueueOptionChoice(state,{playerIndex,options:[{id:"reveal",label:"公開Holo Power頂1張"}],optional:true,effect:"shioriBookmark",prompt:"可公開Holo Power頂1張。",meta:{sourceZone}});
    return bonus;
  }
  if (key === "hBP05-024:0") {
    const hasPioneer = stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).some((instance) => cardHasName(map.get(instance.number), "開拓者")));
    const options = stageOptionsMatching(player, map, { names: ["AZKi"] });
    if (hasPioneer && options.length > 0 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: `${art.name}：直接按自己 1 位 AZKi，附加應援牌庫頂 1 張。` });
    return bonus;
  }
  if (key === "hBP05-046:0") {
    const enabled = stageEntries(player).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd" && cardHasTag(unitCard(stageUnit, map), "#5期生"));
    if (enabled) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手 1 位 Holomen，造成 20 點特殊傷害。`, meta: { amount: 20, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP05-062:0") {
    const count = stageEntries(player).filter(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "1st" && cardHasTag(unitCard(stageUnit, map), "#歌")).length;
    if (count > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: playerIndex === 0 ? 1 : 0, rule: { zones: ["center", "collab"] }, effect: "specialDamage", optional: false, prompt: `${art.name}：直接按對手中央或合作，造成 ${count * 20} 點特殊傷害。`, meta: { amount: count * 20, loseLife: true, sourceName: art.name, sourceZone } });
    return bonus;
  }
  if (key === "hBP05-072:0") {
    if (sourceZone === "center" && source.cheer.length >= 4) ["center", "collab"].forEach((zone) => {
      if (player.zones[zone]) addStageModifier(player.zones[zone], "arts", 50, state.turn, card.number);
    });
    return bonus;
  }
  if (key === "hBP05-073:0") {
    if (cardHasName(map.get(player.oshi?.number), "アユンダ・リス")) {
      const count = Math.min(10, stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#ID1期生")).reduce((total, { unit: stageUnit }) => total + stageUnit.cheer.length, 0));
      bonus += count * 10;
    }
    return bonus;
  }
  if (key === "hBP06-013:0") {
    if (sourceZone === "center") addMatchingStageModifiers(state, playerIndex, map, { zones: ["collab"], tags: ["#絵"] }, 20, card.number);
    return bonus;
  }
  if (key === "hBP06-029:0") {
    const hasFan = stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportFan"));
    if (hasFan && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [sourceZone], optional: true, prompt: `${art.name}：可按攻擊者，附加應援牌庫頂 1 張。` });
    return bonus;
  }
  if (key === "hBP06-057:0" || key === "hBP07-065:0") {
    appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    if (player.hand.length > 0) enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: `${art.name}：揀 1 張手牌放到存檔區。` });
    return bonus;
  }
  if (key === "hBP06-068:0") {
    const enabled = stageEntries(player).some(({ unit: stageUnit }) => (stageUnit.attachments || []).length > 0);
    if (enabled) {
      appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
      if (player.hand.length > 0) enqueueHandToDestination(state, playerIndex, { min: 1, max: 1, effect: "handToArchive", prompt: `${art.name}：揀 1 張手牌放到存檔區。` });
    }
    return bonus;
  }
  if (key === "hBP07-058:0") {
    if (BACK_SLOTS.filter(zone => opponent.zones[zone]).length >= 3 && stageEntries(opponent).some(({unit}) => Number(unit.damage || 0) > 0)) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    return bonus;
  }
  if (key === "hBP07-070:0") {
    const amount = currentTurnEvents(player, state.turn).supports.filter((number) => {
      const support = map.get(number);
      return ["supportEvent", "supportEventLimited"].includes(support?.typeCode) && (cardHasTag(support, "#食べ物") || cardHasTag(support, "#食物"));
    }).length;
    const options = stageOptionsMatching(player, map, { tags: ["#料理"] });
    if (options.length > 0 && amount > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artFoodCostReduction", prompt: `${art.name}：直接按自己 1 位 #料理 Holomen；本回合 Arts 無色費用 -${amount}。`, meta: { amount, sourceNumber: card.number } });
    return bonus;
  }
  if (key === "hBP08-016:0") {
    if (stageEntries(player).filter(({ unit: stageUnit }) => cardHasName(unitCard(stageUnit, map), "ときのそら")).length >= 3) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return bonus;
  }
  if (key === "hBP08-027:0") {
    const amount = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.rested && cardHasTag(unitCard(stageUnit, map), "#Justice")).length;
    if (amount > 0) appendLog(state, `${player.name} 因 ${amount} 位休息中的 #Justice，以「${art.name}」抽 ${drawCards(state, playerIndex, amount)} 張牌。`);
    return bonus;
  }
  if (key === "hBP08-032:0") {
    const enabled = stageEntries(player).some(({ zone, unit: stageUnit }) => zone !== sourceZone && cardHasTag(unitCard(stageUnit, map), "#ID2期生") && stageUnit.cheer.some((instance) => (map.get(instance.number)?.colors || []).some((color) => ["紫", "黃"].includes(color))));
    if (enabled) bonus += 70;
    return bonus;
  }
  if (key === "hBP08-037:0") {
    const blue = source.cheer.filter((instance) => effectiveCheerColors(player, source, instance, map).includes("藍")).length;
    const options = stageOptionsMatching(player, map, { names: ["フワワ・アビスガード", "Fuwawa Abyssgard"] });
    if (blue >= 2 && options.length > 0 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: `${art.name}：直接按自己 1 位 Fuwawa Abyssgard，附加應援牌庫頂 1 張。` });
    return bonus;
  }
  if (key === "hBP08-052:0") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const options = stageOptionsMatching(player, map, { names: ["水宮枢"] });
    if (opponent.zones.center && effectiveBatonCost(state, opponentIndex, opponent.zones.center, "center", map) >= 5 && options.length > 0 && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: `${art.name}：直接按自己 1 位水宮枢，附加應援牌庫頂 1 張。` });
    return bonus;
  }
  if (key === "hBP08-070:0" || key === "hBP08-072:0") {
    const opponentOshiColors = map.get(opponent.oshi?.number)?.colors || [];
    const count = stageEntries(opponent).filter(({ unit: stageUnit }) => !(unitCard(stageUnit, map)?.colors || []).some((color) => opponentOshiColors.includes(color))).length;
    if (key === "hBP08-070:0" && count > 0) stageOptionsMatching(player, map, { tags: ["#Myth"], damaged: true }).forEach((zone) => healStageUnit(state, playerIndex, zone, count * 10, map));
    if (key === "hBP08-072:0") bonus += count * 10;
    return bonus;
  }
  if (key === "hBP08-084:0") {
    if (stageEntries(player).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd" && cardHasTag(unitCard(stageUnit, map), "#1期生"))) bonus += 30;
    return bonus;
  }
  if (key === "hBP08-086:0") {
    if (unitCard(player.zones.center, map)?.stage === "2nd") bonus += 30;
    return bonus;
  }
  if (key === "hEB01-009:0") {
    const cards = player.archive.filter((instance) => map.get(instance.number)?.group === "holomem");
    if (cards.length > 0) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: Math.min(3, cards.length), effect: "artArchiveHolomemShuffleDraw", source: "archive", optional: false, prompt: `${art.name}：揀 1–${Math.min(3, cards.length)} 張存檔區 Holomen 放回牌庫；洗牌後抽 1 張。` });
    else appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return bonus;
  }
  if (key === "hSD09-004:0") {
    if (stageEntries(player).some(({ zone, unit: stageUnit }) => zone !== sourceZone && cardHasTag(unitCard(stageUnit, map), "#3期生") && !cardHasName(unitCard(stageUnit, map), "宝鐘マリン"))) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    return bonus;
  }
  if (key === "hSD09-004:1") {
    const count = new Set(stageEntries(player).filter(({ unit: stageUnit }) => cardHasTag(unitCard(stageUnit, map), "#3期生")).map(({ unit: stageUnit }) => unitCard(stageUnit, map)?.jpName || unitCard(stageUnit, map)?.name)).size;
    if (count > 0) queueFixedSpecialDamage(state, playerIndex, sourceZone, ["center", "collab"], count * 10, art.name);
    return bonus;
  }
  if (key === "hSD10-005:0") {
    if (currentTurnEvents(player, state.turn).bloomCount > 0) {
      const options = stageOptionsMatching(player, map, { names: ["輪堂千速"] });
      if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", optional: false, prompt: "行きます！！！！：直接按自己 1 位輪堂千速，本回合 Arts +20。", meta: { kind: "arts", amount: 20, sourceNumber: card.number } });
    }
    return bonus;
  }
  if (key === "hSD19-008:0") {
    if (stageEntries(opponent).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "2nd")) bonus += 20;
    return bonus;
  }
  if (key === "hBP03-009:0") {
    queueDeckAttachmentToStage(state, playerIndex, { nameIncludes: ["ルーナイト"] }, {}, map, random, art.name);
    return bonus;
  }
  if (key === "hBP05-070:0") {
    const cards = player.archive.filter((instance) => {
      const attachment = map.get(instance.number);
      return ["supportMascot", "supportFan"].includes(attachment?.typeCode)
        && cardHasTag(attachment, "#白上'sキャラクター")
        && attachmentTargets(player, attachment, map).length > 0;
    });
    if (cards.length > 0) enqueueCardSelection(state, {
      playerIndex,
      cards,
      min: 0,
      max: cards.length,
      optional: true,
      effect: "artArchiveAttachmentsDistribute",
      source: "archive",
      prompt: "フブキカフェにようこそ：揀任意張 #白上'sキャラクター 吉祥物／粉絲；之後逐張直接按牌桌 Holomen 分配。",
    });
    return bonus;
  }
  if (key === "hBP05-070:1") {
    const oshi = map.get(player.oshi?.number);
    const oshiMatches = cardHasName(oshi, "白上フブキ") || (oshi?.colors || []).includes("黃");
    const attachmentCount = stageEntries(player).reduce((count, { unit: stageUnit }) => count + (stageUnit.attachments || []).filter((instance) => ["supportTool", "supportMascot", "supportFan"].includes(map.get(instance.number)?.typeCode)).length, 0);
    if (oshiMatches && attachmentCount >= 4) bonus += 100;
    return bonus;
  }
  if (key === "hBP07-083:0") {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const options = stageCheerOptions(opponent, map, { stage: { zones: ["center", "collab"] } });
    if (options.length > 0) enqueueStageCheerSelection(state, { playerIndex, ownerIndex: opponentIndex, options, effect: "artOpponentCheerBottom", optional: false, prompt: "オーバーチアリーディング：直接按對手中央／合作位置的 1 張實際應援，放回其應援牌庫底。" });
    return bonus;
  }
  if (key === "hBP08-018:0") {
    const options = cardHasName(map.get(player.oshi?.number), "ときのそら")
      ? stageOptionsMatching(player, map, { names: ["ときのそら"] }).filter((zone) => zone !== sourceZone)
      : [];
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "artAttackSecondBack", prompt: "如果大家能嗨起來我會很開心！：直接按自己另一位ときのそら；本回合可用 Arts 指定對手後排 2nd Holomen。", meta: { sourceNumber: card.number } });
    return bonus;
  }
  if (key === "hSD03-011:1") {
    const amount = Math.max(0, 3 - player.hand.length);
    if (amount > 0) appendLog(state, `${player.name} 因「${art.name}」抽 ${drawCards(state, playerIndex, amount)} 張牌，直到手牌達 3 張。`);
    return bonus;
  }
  const dynamic = /每(?:有|1|重疊|減少|使用|放入|送入|公開|擲出|出現)|每張|每位|每名|每種|×/u.test(text);
  const fixed = text.match(/(?:此|這個|這張)(?:技能|Arts|藝術(?:卡|牌)?|招式|戰技|藝能)(?:的)?(?:力量|威力|數值|攻擊力|傷害|效果)?\s*(?:就|額外|獲得)?\s*[+＋]\s*(\d+)/iu);
  if (fixed && !dynamic && !dice.handled && !/(?:可以|可)將[^：。]+[：:]|若生命值為2以下，則改為/u.test(text)) bonus += Number(fixed[1]);
  const perCheer = text.match(/每(?:有)?1張(?:這位Holomen的|此Holomen的|附在這位Holomen上的)?應援[^。]*?(?:技能|Arts|藝術|藝能)?\s*[+＋]\s*(\d+)/iu);
  if (perCheer) {
    const maximum = Number(text.match(/最多(?:只)?(?:計算)?\s*(\d+)張/u)?.[1] || source.cheer.length);
    bonus += Math.min(source.cheer.length, maximum) * Number(perCheer[1]);
  }
  const perColoredCheer = text.match(/每有1張(?:這位Holomen的)?([白綠紅藍黃紫])(?:色)?應援[^。]*?[+＋]\s*(\d+)/u);
  if (perColoredCheer) bonus += source.cheer.filter((instance) => effectiveCheerColors(player, source, instance, map).includes(perColoredCheer[1])).length * Number(perColoredCheer[2]);
  const perStack = text.match(/每(?:(?:重疊|疊著|下方有)1張Holomen|有1張重疊在(?:此|這位)Holomen上的Holomen)[^。]*?[+＋]\s*(\d+)/iu);
  if (perStack) bonus += source.stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem").length * Number(perStack[1]);
  const perArchiveHolomem = text.match(/檔案區域?中每有1張Holom(?:en|em)[^。]*?[+＋]\s*(\d+)/iu);
  if (perArchiveHolomem) bonus += player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length * Number(perArchiveHolomem[1]);
  const damagedBack = text.match(/對方每有1位HP減少的後排[^。]*?[+＋]\s*(\d+)/u);
  if (damagedBack) bonus += BACK_SLOTS.filter((zone) => Number(opponent.zones[zone]?.damage || 0) > 0).length * Number(damagedBack[1]);
  const restedOpponent = text.match(/對手每有1位處於休息狀態的Holomen[^。]*?[+＋]\s*(\d+)/u);
  if (restedOpponent) bonus += stageEntries(opponent).filter(({ unit: stageUnit }) => stageUnit.rested).length * Number(restedOpponent[1]);
  const lostLife = text.match(/每減少1點起始生命值[^。]*?[+＋]\s*(\d+)/u);
  if (lostLife) bonus += Math.max(0, Number(player.lifeTarget || map.get(player.oshi?.number)?.life || 5) - player.life.length) * Number(lostLife[1]);
  const totalFans = text.match(/場上每有1張附在自己Holomen身上的粉絲卡[^。]*?[+＋]\s*(\d+)/u);
  if (totalFans) bonus += stageEntries(player).reduce((count, { unit: stageUnit }) => count + stageUnit.attachments.filter((instance) => map.get(instance.number)?.typeCode === "supportFan").length, 0) * Number(totalFans[1]);
  const perBack = text.match(/每有1位在自己後排的Holomen[^。]*?[+＋]\s*(\d+)/u);
  if (perBack) bonus += BACK_SLOTS.filter((zone) => player.zones[zone]).length * Number(perBack[1]);
  const perStageTag = text.match(/舞台上每有1位(?:持有|擁有)(?:不同卡名的)?(#[^的，。\]]+)(?:的)?Holom(?:en|em)[^。]*?[+＋]\s*(\d+)/u);
  if (perStageTag) {
    const cards = stageEntries(player).map(({ unit: stageUnit }) => unitCard(stageUnit, map)).filter((candidate) => cardHasTag(candidate, perStageTag[1]));
    const count = /不同卡名/u.test(text) ? new Set(cards.map((candidate) => candidate.jpName || candidate.enName || candidate.name)).size : cards.length;
    const maximum = Number(text.match(/最多(?:只)?(?:計算)?\s*(\d+)(?:位|人)/u)?.[1] || count);
    bonus += Math.min(count, maximum) * Number(perStageTag[2]);
  }
  const perTaggedUnit = !perStageTag && text.match(/每有1位(?:持有|擁有)(#[^的，。\]]+)(?:的)?Holom(?:en|em)[^。]*?[+＋]\s*(\d+)/u);
  if (perTaggedUnit) {
    const count = stageHasTag(player, perTaggedUnit[1], map).length;
    const maximum = Number(text.match(/最多(?:只)?(?:計算)?\s*(\d+)(?:位|人)/u)?.[1] || count);
    bonus += Math.min(count, maximum) * Number(perTaggedUnit[2]);
  }
  const perNamedAttachment = text.match(/每有1張(?:附著|附在|裝備)?(?:在)?(?:此|這位)Holomen(?:上|身上)?的?[〈「]([^〉」]+)[〉」][^。]*?[+＋]\s*(\d+)/u) || text.match(/每有1張附著的[〈「]([^〉」]+)[〉」][^。]*?[+＋]\s*(\d+)/u);
  if (perNamedAttachment) bonus += source.attachments.filter((instance) => cardHasName(map.get(instance.number), perNamedAttachment[1])).length * Number(perNamedAttachment[2]);
  const perStageMascot = text.match(/舞台上每有1張吉祥物牌[^。]*?[+＋]\s*(\d+)/u);
  if (perStageMascot) bonus += stageAttachmentCount(player, map, (attachment) => attachment?.typeCode === "supportMascot") * Number(perStageMascot[1]);
  const perCheerColor = text.match(/舞台上每有1種顏色的應援[^。]*?[+＋]\s*(\d+)/u);
  if (perCheerColor) {
    const colors = new Set(stageEntries(player).flatMap(({ unit: stageUnit }) => stageCheerColors(player, stageUnit, map)));
    bonus += colors.size * Number(perCheerColor[1]);
  }
  const bothStageCheer = text.match(/雙方舞台上(?:的)?每有1張應援[^。]*?[+＋]\s*(\d+)/u);
  if (bothStageCheer) bonus += Math.min(totalCheer(player) + totalCheer(opponent), Number(text.match(/最多(?:只)?(?:計算)?\s*(\d+)張/u)?.[1] || Infinity)) * Number(bothStageCheer[1]);
  const ownArchiveCheer = text.match(/(?:自己的)?檔案區域中每有1張應援[^。]*?[+＋]\s*(\d+)/u);
  if (ownArchiveCheer) bonus += Math.min(player.archive.filter((instance) => map.get(instance.number)?.group === "cheer").length, Number(text.match(/最多(?:只)?(?:計算)?\s*(\d+)張/u)?.[1] || Infinity)) * Number(ownArchiveCheer[1]);
  const opponentArchiveCheer = text.match(/對手的檔案區域每有1張應援[^。]*?[+＋]\s*(\d+)/u);
  if (opponentArchiveCheer) bonus += opponent.archive.filter((instance) => map.get(instance.number)?.group === "cheer").length * Number(opponentArchiveCheer[1]);
  const perHand = text.match(/每1張手牌[^。]*?[+＋]\s*(\d+)/u) || text.match(/每有1張自己的手牌[^。]*?[+＋]\s*(\d+)/u);
  if (perHand) bonus += player.hand.length * Number(perHand[1]);
  const perOpponentHand = text.match(/對手每有1張手牌[^。]*?[+＋]\s*(\d+)/u);
  if (perOpponentHand) bonus += opponent.hand.length * Number(perOpponentHand[1]);
  const perNonDebut = text.match(/舞台上每有1名Debut以外的Holomen[^。]*?[+＋]\s*(\d+)/u);
  if (perNonDebut) bonus += stageEntries(player).filter(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage !== "Debut").length * Number(perNonDebut[1]);
  const perArchiveTen = text.match(/檔案區域每有10張卡[^。]*?[+＋]\s*(\d+)/u);
  if (perArchiveTen) bonus += Math.floor(player.archive.length / 10) * Number(perArchiveTen[1]);
  const cheerDifference = text.match(/每比對手多1張應援[^。]*?[+＋]\s*(\d+)/u);
  if (cheerDifference) bonus += Math.max(0, totalCheer(player) - totalCheer(opponent)) * Number(cheerDifference[1]);

  if (card.number === "hBP03-074") {
    if (stageEntries(player).some(({ unit: unitValue }) => cardHasName(unitCard(unitValue, map), "アイラニ・イオフィフティーン"))) bonus += 10;
    if (stageEntries(player).some(({ unit: unitValue }) => cardHasName(unitCard(unitValue, map), "ムーナ・ホシノヴァ"))) bonus += 10;
  }
  if (card.number === "hBP03-078") {
    if (source.cheer.some((instance) => effectiveCheerColors(player, source, instance, map).includes("綠"))) bonus += 50;
    if (source.cheer.some((instance) => effectiveCheerColors(player, source, instance, map).includes("藍"))) bonus += 50;
  }
  if (card.number === "hBP07-049") bonus += player.life.length <= 2 ? 60 : player.life.length <= 4 ? 30 : 0;
  if (card.number === "hBP08-067") bonus += player.hand.length === 0 ? 70 : player.hand.length <= 2 ? 50 : 0;
  if (card.number === "hBP08-081") bonus += totalCheer(player) - totalCheer(opponent) >= 2 ? 40 : totalCheer(player) - totalCheer(opponent) === 1 ? 20 : 0;

  if (["hBP02-039", "hBP02-040"].includes(card.number) && /ホロックスロット/u.test(String(art.name || ""))) {
    const revealed = player.mainDeck.splice(0, Math.min(3, player.mainDeck.length));
    const holomemCount = revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length;
    bonus += holomemCount * 20;
    appendLog(state, `${player.name} 以「ホロックスロット」公開 ${cardCodes(revealed)}；${holomemCount} 張 Holomen 令 Arts +${holomemCount * 20}。`, revealed);
    if (card.number === "hBP02-039") {
      const usageKey = `gift:hBP02-039:${topCard(source)?.id || sourceZone}`;
      const selectableIds = revealed.filter((instance) => map.get(instance.number)?.group === "support").map((instance) => instance.id);
      if (selectableIds.length > 0 && !usedNamedThisTurn(player, usageKey, state.turn)) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 0, max: 1, effect: "giftSlotSupportPick", source: "revealed", optional: true, prompt: "ぷいぷいぷい～：可揀公開的 1 張支援卡加入手牌；其餘卡放到存檔區。", meta: { usageKey } });
      else {
        player.archive.push(...revealed);
        currentTurnEvents(player, state.turn).deckArchived += revealed.length;
      }
    } else {
      player.archive.push(...revealed);
      currentTurnEvents(player, state.turn).deckArchived += revealed.length;
      const stages = revealed.map((instance) => map.get(instance.number)).filter((candidate) => candidate?.group === "holomem").map((candidate) => candidate.stage);
      const usageKey = `gift:hBP02-040:${topCard(source)?.id || sourceZone}`;
      if (revealed.length === 3 && stages.length === 3 && new Set(stages).size === 1 && !usedNamedThisTurn(player, usageKey, state.turn)) {
        markNamedUsage(player, usageKey, state.turn);
        queueExtraLifeLoss(state, playerIndex === 0 ? 1 : 0, playerIndex, map, "最高に激アツ～");
      }
    }
    return bonus;
  }

  const topRevealCount = Number(text.match(/公開自己牌庫(?:上方|頂)(?:的)?\s*(\d+)張/u)?.[1] || 0);
  if (!dice.handled && topRevealCount > 0 && /每公開1張(?:ホロメン|Holomen)[^。]*?[+＋]\s*(\d+)/u.test(text)) {
    const revealed = player.mainDeck.splice(0, Math.min(topRevealCount, player.mainDeck.length));
    const amount = Number(text.match(/每公開1張(?:ホロメン|Holomen)[^。]*?[+＋]\s*(\d+)/u)?.[1] || 0);
    bonus += revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length * amount;
    if (/放(?:進|入)(?:檔案|存檔)/u.test(text)) player.archive.push(...revealed);
    else player.mainDeck = shuffle([...player.mainDeck, ...revealed], random);
    if (/其中有事件卡[^。]*抽2張/u.test(text) && revealed.some((instance) => ["supportEvent", "supportEventLimited"].includes(map.get(instance.number)?.typeCode))) appendLog(state, `${player.name} 因公開到事件卡抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    appendLog(state, `${player.name} 公開 ${cardCodes(revealed)}，令「${art.name}」+${revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length * amount}。`, revealed);
  } else if (!dice.handled && /牌庫(?:頂|上方)的?1張.*(?:放進|放到|存入)檔案/u.test(text)) {
    const moved = player.mainDeck.shift();
    if (moved) {
      player.archive.push(moved);
      currentTurnEvents(player, state.turn).deckArchived += 1;
      const movedCard = map.get(moved.number);
      if (/若(?:檔案|放入)的是Holomen/u.test(text) && movedCard?.group === "holomem") bonus += Number(text.match(/Holomen卡[^。]*?[+＋]\s*(\d+)/u)?.[1] || 0);
      if (/若(?:檔案|放入|被放入)的是?支援卡/u.test(text) && movedCard?.group === "support") bonus += Number(text.match(/支援卡[^。]*?[+＋]\s*(\d+)/u)?.[1] || 0);
      if (card.number === "hBP07-029" && movedCard?.group === "holomem") enqueueEffect(state, { type: "eventCheerTarget", playerIndex, prompt: `${art.name}：直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。` });
    }
  }

  const complexCost = costQueued || /(?:可以|可)將[^：。]+[：:]|將自己(?:手牌|舞台|檔案|Holo[Pp]ower)[^：。]+[：:]/u.test(text);
  if (complexCost) bonus = dice.bonus;
  if (!dice.handled && !complexCost) {
    const selfDamageBuff = /(?:此|這個|這張)(?:技能|Arts|藝術|招式|戰技|藝能)/iu.test(text);
    queueSimpleTriggeredKeyword(state, playerIndex, sourceZone, fauxCard, map, random, { skipBuff: selfDamageBuff, conditionChecked: true });
  }
  if (bonus > 0) appendLog(state, `${player.name} 的「${art.name}」由文字效果獲得 +${bonus} 傷害。`);
  return bonus;
}

function queueAttachmentArtEffects(state, playerIndex, sourceZone, map, random) {
  const player = state.players[playerIndex];
  const source = player.zones[sourceZone];
  const card = unitCard(source, map);
  if (!source || !card) return;
  const has = (number) => source.attachments.some((instance) => instance.number === number);
  if (has("hBP01-114")) enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: playerIndex, targetZone: sourceZone, amount: 10, loseLife: true, sourceName: "石斧", sourceZone });
  if (has("hBP01-119") && cardHasName(card, "アキ・ローゼンタール")) enqueueEffect(state, { type: "healTarget", playerIndex, amount: 10, optional: false, prompt: "Jobs：直接按自己 1 位受傷 Holomen，回復 10 HP。" });
  if (has("hBP01-120") && sourceZone === "center" && cardHasName(card, "鷹嶺ルイ")) appendLog(state, `${player.name} 因 Ganmo 抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  if (has("hBP05-084") && card.stage === "2nd" && cardHasName(card, "角巻わため")) enqueueArchiveCheerToTarget(state, playerIndex, { optional: true, targetRule: { names: ["角巻わため"] }, prompt: "角巻わため的豎琴：可揀 1 張存檔區應援；下一步直接按角巻わため。" }, map);
  if (has("hBP07-102") && sourceZone === "center" && card.stage === "2nd" && cardHasName(card, "角巻わため")) {
    const die = rollDie(random, state, playerIndex); logDie(state, playerIndex, die, "因角卷綿芽的槌子擲骰");
    if ([3, 5].includes(die)) enqueueStageTarget(state, { playerIndex, rule: { excludeZones: [sourceZone] }, effect: "specialDamage", prompt: "槌子骰子觸發：直接按自己另一位 Holomen，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: "角卷綿芽的槌子" } });
  }
  if (has("hBP07-105") && cardHasName(card, "ベスティア・ゼータ")) queueArchiveToHand(state, playerIndex, { typeCodes: ["supportFan"] }, map, { min: 1, max: 1, optional: false, label: "BAZO" });
  if (has("hEB01-033") && cardHasTag(card, "#サマー")) {
    const options = stageOptionsMatching(player, map, { zones: ["center", "collab"], tags: ["#サマー"] }).filter((zone) => zone !== sourceZone);
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "moveAttachment", optional: true, prompt: "沙灘球：可直接按另一位 #サマー 中央／合作 Holomen，將沙灘球移過去。", meta: { sourceZone, attachmentNumber: "hEB01-033" } });
  }
}

function archiveUnit(player, stageUnit) {
  player.archive.push(...stageUnit.stack, ...stageUnit.cheer, ...(stageUnit.attachments || []));
}

function lunaiteArchiveReplacement(state, ownerIndex, sourceZone, attachment, map) {
  if (sourceZone !== "center" || state.activePlayer === ownerIndex || !cardHasName(map.get(attachment.number), "ルーナイト")) return null;
  const owner = state.players[ownerIndex];
  // The printed Gift is restricted to the collab position. Do not infer this
  // replacement's eligibility from translated prose.
  const gift = unitCard(owner.zones.collab, map)?.number === "hBP06-030";
  const targetOptions = stageOptionsMatching(owner, map, { zones: BACK_SLOTS, names: ["姫森ルーナ"] });
  if (!gift || targetOptions.length === 0) return null;
  return { type: "stageTarget", playerIndex: ownerIndex, targetPlayerIndex: ownerIndex, options: targetOptions, rule: { zones: BACK_SLOTS, names: ["姫森ルーナ"] }, prompt: "みんなへ感謝の気持ち：可選後備姫森ルーナ改附ルーナイト；略過則照常存檔。", effect: "giftMoveLunaite", optional: true, meta: { attachment: clone(attachment) } };
}

function queueLunaiteArchiveReplacements(state, ownerIndex, defeatedZone, defeated, map, pendingEffects) {
  const lunaite = (defeated.attachments || []).filter((instance) => cardHasName(map.get(instance.number), "ルーナイト"));
  for (const attachment of lunaite) {
    const replacement = lunaiteArchiveReplacement(state, ownerIndex, defeatedZone, attachment, map);
    if (!replacement) continue;
    const moved = removeById(defeated.attachments, attachment.id);
    if (moved) pendingEffects.push(replacement);
  }
}

function queueKnockoutAttachmentEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, options, pendingEffects) {
  const owner = state.players[ownerIndex];
  const sourcePlayer = state.players[sourcePlayerIndex];
  const source = options.sourceZone ? sourcePlayer?.zones?.[options.sourceZone] : null;
  const defeatedAttachments = new Set((defeated.attachments || []).map((instance) => instance.number));
  const sourceAttachments = new Set((source?.attachments || []).map((instance) => instance.number));
  const onOpponentTurn = state.activePlayer !== ownerIndex;
  const cheerCards = defeated.cheer || [];
  const queueTransfer = (rule, max = 1, colors = null, optional = true) => {
    const candidates = cheerCards.filter((instance) => !colors || (map.get(instance.number)?.colors || []).some((color) => colors.includes(color)));
    if (candidates.length > 0 && stageOptionsMatching(owner, map, rule).length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(candidates), selectableIds: candidates.map((card) => card.id), min: optional ? 0 : 1, max: Math.min(max, candidates.length), prompt: optional ? "倒下觸發：可揀實際應援改附到另一位合法 Holomen。" : "倒下觸發：必須揀 1 張實際應援改附到另一位合法 Holomen。", effect: "koTransferCheer", source: "archive", optional, meta: { targetRule: rule } });
  };

  if (onOpponentTurn && defeatedAttachments.has("hBP01-122") && cardHasName(defeatedCard, "アキ・ローゼンタール") && owner.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: ownerIndex, tag: null, targetRule: { names: ["アキ・ローゼンタール"] }, optional: false, prompt: "羅森隊：直接按自己另一位亞綺·羅森塔爾，附加應援牌庫頂 1 張。" });
  if (onOpponentTurn && defeatedAttachments.has("hBP01-124") && cardHasName(defeatedCard, "AZKi")) queueTransfer({}, 1, null, false);
  if (defeatedAttachments.has("hBP02-090") && cardHasName(defeatedCard, "白上フブキ")) queueTransfer({}, 1, null, false);
  if (onOpponentTurn && defeatedAttachments.has("hBP02-101") && cardHasName(defeatedCard, "大神ミオ")) appendLog(state, `${owner.name} 因 MioFa 抽 ${drawCards(state, ownerIndex, 1)} 張牌。`);
  if (defeatedAttachments.has("hBP03-103") && cardHasName(defeatedCard, "戌神ころね") && owner.holoPower.length > 0) pendingEffects.push({ type: "optionChoice", playerIndex: ownerIndex, options: [{ id: "use", label: "支付 1 Holo Power，將瘦狗返回手牌" }], prompt: "瘦狗：可支付成本返回手牌。", effect: "slimDogReturn", optional: true, meta: {} });
  for (const fan of defeated.attachments || []) {
    if (onOpponentTurn && fan.number === "hBP03-109" && ["フワワ・アビスガード", "モココ・アビスガード"].some(name => cardHasName(defeatedCard, name))) {
      pendingEffects.push({type:"koFanTransfer",playerIndex:ownerIndex,max:1,colors:["藍"],targetRule:{names:["フワワ・アビスガード"]},label:"Ruffians"});
    }
    if (onOpponentTurn && fan.number === "hBP03-112" && cardHasName(defeatedCard,"角巻わため")) {
      pendingEffects.push({type:"koFanTransfer",playerIndex:ownerIndex,max:2,colors:["黃"],eligibleIds:cheerCards.map(c=>c.id),targetRule:{names:["角巻わため"]},label:"綿芽粉絲"});
    }
  }
  if (onOpponentTurn && defeatedAttachments.has("hBP04-099") && cardHasName(defeatedCard, "アーニャ・メルフィッサ") && owner.hand.length > 0) {
    const weapon = defeated.attachments.find((instance) => instance.number === "hBP04-099");
    pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(owner.hand), selectableIds: owner.hand.map((card) => card.id), min: 0, max: 1, prompt: "古代武器：可存檔 1 張手牌，將古代武器返回手牌。", effect: "ancientWeaponReturn", source: "hand", optional: true, meta: { attachmentId: weapon?.id } });
  }
  if (onOpponentTurn && defeatedAttachments.has("hBP05-085") && cardHasName(defeatedCard, "さくらみこ") && sourcePlayer.hand.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: sourcePlayerIndex, cards: clone(sourcePlayer.hand), selectableIds: sourcePlayer.hand.map((card) => card.id), min: 1, max: 1, prompt: "MikoDanye：揀自己 1 張手牌放到存檔區。", effect: "handToArchive", source: "hand", optional: false, meta: {} });
  if (onOpponentTurn && defeatedAttachments.has("hBP05-087") && cardHasName(defeatedCard, "ネリッサ・レイヴンクロフト")) queueTransfer({ tags: ["#歌"] });
  if (onOpponentTurn && defeatedAttachments.has("hBP06-102") && cardHasName(defeatedCard, "夏色まつり")) queueTransfer({ names: ["夏色まつり"] }, 1, ["黃"]);
  if (onOpponentTurn && defeatedAttachments.has("hBP06-104") && cardHasName(defeatedCard, "大空スバル") && owner.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: ownerIndex, targetRule: { names: ["大空スバル"] }, optional: true, prompt: "昴友：可直接按自己另一位大空スバル，附加應援牌庫頂 1 張。" });
  if (onOpponentTurn && defeatedAttachments.has("hBP08-106") && cardHasName(defeatedCard, "IRyS")) queueTransfer({}, 1, null, false);
  if (onOpponentTurn && defeatedAttachments.has("hBP08-108") && ["フワワ・アビスガード", "モココ・アビスガード"].some((name) => cardHasName(defeatedCard, name)) && cheerCards.some((instance) => (map.get(instance.number)?.colors || []).includes("紅"))) appendLog(state, `${owner.name} 因淘氣的 Ruffians 抽 ${drawCards(state, ownerIndex, 1)} 張牌。`);
  if (onOpponentTurn && defeatedAttachments.has("hBP08-109") && cardHasName(defeatedCard, "鷹嶺ルイ")) queueTransfer({}, 1, ["紅", "紫"]);
  if (cardHasName(defeatedCard,"さくらみこ")) for (const fan of defeated.attachments || []) {
    if (fan.number === "hBP03-107") pendingEffects.push({type:"optionChoice",playerIndex:ownerIndex===0?1:0,options:[{id:"draw",label:"抽 1 張牌"}],optional:true,effect:"koFanDraw",prompt:"35P：可抽 1 張牌，亦可略過。",meta:{}});
  }
  if (defeatedAttachments.has("hBP08-103") && owner.life.length > 0 && !opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex)) {
    const extraLife = owner.life.pop();
    state.lifeLosses.push({ turn: state.turn, ownerIndex, sourcePlayerIndex, phase: state.phase, sourceName: "hololive 斗篷" });
    state.lifeLosses = state.lifeLosses.slice(-40);
    pendingEffects.push({ type: "lifeCheerTarget", playerIndex: ownerIndex, cheerCard: extraLife, winnerAfter: owner.life.length === 0, sourcePlayerIndex, prompt: `hololive 斗篷令生命額外 -1：直接按自己 Holomen 附加公開應援。` });
    appendLog(state, `${owner.name} 因 hololive 斗篷額外生命 -1。`);
  } else if (defeatedAttachments.has("hBP08-103") && opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex)) {
    appendLog(state, `${owner.name} 的生命減少防護阻止了 hololive 斗篷的額外生命 -1。`);
  }

  if (sourcePlayerIndex !== ownerIndex && sourceAttachments.has("hBP01-115") && ["1st", "2nd"].includes(unitCard(source, map)?.stage) && cardHasName(unitCard(source, map), "星街すいせい") && sourcePlayer.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: sourcePlayerIndex, cheerCard: null, options: [options.sourceZone], optional: false, prompt: "星街彗星的麥克風：按攻擊者，附加應援牌庫頂 1 張。" });
  if (sourcePlayerIndex !== ownerIndex && sourceAttachments.has("hBP03-097") && ["1st","2nd"].includes(unitCard(source,map)?.stage) && cardHasName(unitCard(source,map),"音乃瀬奏")) pendingEffects.push({type:"drawPlayerCards",playerIndex:sourcePlayerIndex,amount:1,label:"直笛"});
  if (sourceAttachments.has("hBP02-096") && cardHasName(unitCard(source, map), "沙花叉クロヱ")) enqueueArchiveCheerToTarget(state, sourcePlayerIndex, { optional: true, targetRule: { tags: ["#秘密結社holoX"] }, prompt: "狗狗：可揀 1 張存檔區應援；下一步按 #秘密結社holoX Holomen。" }, map);
  if (sourceAttachments.has("hBP08-102") && cardIsBuzz(unitCard(source, map)) && activeModifiers(source, "trigger:hBP08-102", state.turn).length === 0) {
    addStageModifier(source, "trigger:hBP08-102", 0, state.turn, "hBP08-102");
    appendLog(state, `${sourcePlayer.name} 因帥氣連帽衫抽 ${drawCards(state, sourcePlayerIndex, 2)} 張牌。`);
  }
  if (sourcePlayerIndex !== ownerIndex && sourceAttachments.has("hSD14-011") && cardHasName(unitCard(source, map), "白上フブキ") && sourcePlayer.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: sourcePlayerIndex, optional: false, prompt: "超級可以的鱷魚：選擇自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
  const cilusOwnerIndex = ownerIndex === 0 ? 1 : 0;
  const cilusOwner = state.players[cilusOwnerIndex];
  const cilus = cilusOwner.zones.center;
  if (BACK_SLOTS.includes(options.targetZone) && cilus?.attachments.some(instance => instance.number === "hBP05-086") && cardHasName(unitCard(cilus,map), "こぼ・かなえる") && activeModifiers(cilus, "trigger:hBP05-086", state.turn).length === 0) {
    addStageModifier(cilus, "trigger:hBP05-086", 0, state.turn, "hBP05-086");
    appendLog(state, `${cilusOwner.name} 因 Cilus 抽 ${drawCards(state, cilusOwnerIndex, 1)} 張牌。`);
  }
}

function queueOshiKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, options, pendingEffects) {
  const owner = state.players[ownerIndex];
  const sourcePlayer = state.players[sourcePlayerIndex];
  const sourceUnit = options.sourceZone ? sourcePlayer?.zones?.[options.sourceZone] : null;
  const sourceCard = unitCard(sourceUnit, map);
  const onOpponentTurn = state.activePlayer !== ownerIndex;
  const push = (skillPlayerIndex, kind, trigger, label, meta = {}) => pendingEffects.push({
    type: "optionChoice",
    playerIndex: skillPlayerIndex,
    options: [{ id: "use", label }],
    optional: true,
    prompt: "Holomen 倒下：可使用推し技能。",
    effect: "oshiKnockout",
    meta: { trigger, kind, skillPlayerIndex, ownerIndex, sourcePlayerIndex, sourceZone: options.sourceZone || "", defeatedNumber: defeatedCard?.number, ...meta },
  });

  if (onOpponentTurn && owner.oshi?.number === "hBP01-004" && Number(owner.oshiSkillTurn || 0) !== state.turn) {
    const cheerIds = defeated.cheer.filter((instance) => (map.get(instance.number)?.colors || []).includes("綠")).map((instance) => instance.id);
    if (cheerIds.length > 0 && stageUnitCount(owner) > 0) push(ownerIndex, "normal", "pekoraCheer", "野兎たち～：分配倒下 Holomen 的全部綠色應援", { cheerIds });
  }
  if (onOpponentTurn && owner.oshi?.number === "hBP01-006" && !owner.spOshiSkillUsed && (defeatedCard?.colors || []).includes("紅")) {
    push(ownerIndex, "sp", "kiaraReturn", "Rise from the ashes：生命 -1，將被擊倒的紅色 Holomen 及其重疊卡返回手牌", { returnIds: (defeated.stack || []).map((instance) => instance.id) });
  }
  if (onOpponentTurn && owner.oshi?.number === "hBP05-001" && !owner.spOshiSkillUsed && cardHasTag(defeatedCard, "#3期生")) push(ownerIndex, "sp", "noelDown", "超級搞砸太郎：生命 -1；Buzz／2nd 倒下時抽 2 張", { drawTwo: cardIsBuzz(defeatedCard) || defeatedCard?.stage === "2nd" });
  if (onOpponentTurn && owner.oshi?.number === "hBP03-005" && !owner.spOshiSkillUsed && cardHasName(defeatedCard, "常闇トワ")) push(ownerIndex, "sp", "towaDown", "惡魔的所作所為：中央與合作各 2 張應援返回牌庫底");
  if (owner.oshi?.number === "hBP03-006" && !owner.spOshiSkillUsed && defeatedCard?.colors?.includes("黃")) push(ownerIndex, "sp", "koroneDown", "ウォウウォウウォウウォウ：轉移應援並回收 1 張重疊成員", { cheerIds: defeated.cheer.map(c => c.id), stackIds: defeated.stack.map(c => c.id) });
  if (owner.oshi?.number === "hBP03-008" && Number(owner.oshiSkillTurn || 0) !== state.turn && cardHasTag(defeatedCard, "#ID1期生")) push(ownerIndex, "normal", "risuDraw", "Hololive ID一家：抽 1 張牌");
  if (onOpponentTurn && owner.oshi?.number === "hBP04-004" && Number(owner.oshiSkillTurn || 0) !== state.turn) {
    const fanIds = defeated.attachments.filter((instance) => map.get(instance.number)?.typeCode === "supportFan").map((instance) => instance.id);
    if (fanIds.length > 0) push(ownerIndex, "normal", "lamyFan", "我愛你：將倒下 Holomen 的 1 張粉絲返回手牌", { fanIds });
  }
  if (onOpponentTurn && owner.oshi?.number === "hBP06-007" && Number(owner.oshiSkillTurn || 0) !== state.turn && cardHasName(defeatedCard, "ロボ子さん")) push(ownerIndex, "normal", "robocoReturn", "我才不是PON呢！！：存檔牌庫頂 2 張並回收ロボ子さん");
  if (onOpponentTurn && owner.oshi?.number === "hBP04-003" && !owner.spOshiSkillUsed && cardHasName(defeatedCard, "一条莉々華")) push(ownerIndex, "sp", "ririkaSearch", "かわいい！ ポジティブ！ ジーニアス！：搜尋莉々華與限界飯");

  if (sourcePlayer.oshi?.number === "hBP05-001" && Number(sourcePlayer.oshiSkillTurn || 0) !== state.turn) push(sourcePlayerIndex, "normal", "noelSearch", "白銀的騎士們：搜尋 1 張 #3期生 Holomen");
  if (sourcePlayerIndex !== ownerIndex && sourcePlayer.oshi?.number === "hBP02-001" && !sourcePlayer.spOshiSkillUsed && (sourceCard?.colors || []).includes("白")) {
    const mascots = stageEntries(sourcePlayer).reduce((count, { unit: stageUnit }) => count + stageUnit.attachments.filter((instance) => map.get(instance.number)?.typeCode === "supportMascot").length, 0);
    if (mascots >= 2) push(sourcePlayerIndex, "sp", "fubukiMascotLife", "Fubukingdom：按舞台吉祥物數擲骰，成功令對手生命 -1", { rolls: Math.floor(mascots / 2) });
  }
  if (sourcePlayerIndex !== ownerIndex && sourcePlayer.oshi?.number === "hBP06-002" && !sourcePlayer.spOshiSkillUsed && options.targetZone === "center" && sourcePlayer.mainDeck.length <= 5 && cardHasTag(sourceCard, "#FLOW GLOW")) push(sourcePlayerIndex, "sp", "flowGlowLife", "我要努力活下去！：對手生命額外 -1");
}

function giftKnockoutLifeReduction(state, ownerIndex, defeatedZone, defeated, defeatedCard, map) {
  const owner = state.players[ownerIndex];
  const opponent = state.players[ownerIndex === 0 ? 1 : 0];
  if (state.activePlayer === ownerIndex) return 0;
  const marineReduction = defeatedCard?.number === "hSD09-007" && defeatedZone === "collab" && owner.life.length < opponent.life.length ? 1 : 0;
  return marineReduction + stageEntries(owner).filter(({ zone, unit: giftUnit }) => {
    const giftCard = unitCard(giftUnit, map);
    return giftCard?.number === "hBP07-044" && ["center", "collab"].includes(zone) && cardHasName(map.get(owner.oshi?.number), "尾丸ポルカ") && cardIsBuzz(defeatedCard) && (defeated.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportFan");
  }).length;
}

function queueGiftKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, options, pendingEffects) {
  const owner = state.players[ownerIndex];
  const sourcePlayer = state.players[sourcePlayerIndex];
  const source = options.sourceZone ? sourcePlayer?.zones?.[options.sourceZone] : null;
  const sourceCard = unitCard(source, map);
  const onOpponentTurn = state.activePlayer !== ownerIndex;
  const archiveIds = (cards) => cards.map((card) => card.id).filter((id) => defeatedCardPool(owner).some((card) => card.id === id));
  const pushArchiveChoice = (cards, effect, prompt, meta = {}) => {
    const ids = archiveIds(cards);
    if (ids.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(cards.filter((card) => ids.includes(card.id))), selectableIds: ids, min: 0, max: 1, prompt, effect, source: "archive", optional: true, meta: { ...meta, fromDefeated: true } });
  };

  if (defeatedCard?.number === "hBP03-066" && owner.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: ownerIndex, targetRule: { names: ["戌神ころね"] }, optional: false, prompt: "Gift：直接按自己 1 位戌神ころね，附加應援牌庫頂 1 張。" });
  if (onOpponentTurn && ["hBP03-072", "hBP04-023", "hBP04-079", "hSD15-005"].includes(defeatedCard?.number)) {
    const names = defeatedCard.number === "hBP03-072" ? ["角巻わため"] : undefined;
    const tags = defeatedCard.number === "hBP04-023" ? ["#ReGLOSS"] : undefined;
    const cheers = defeated.cheer || [];
    if (cheers.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(cheers), selectableIds: cheers.map((card) => card.id), min: 0, max: 1, prompt: "Gift：可揀倒下 Holomen 的 1 張應援；下一步直接按另一位合法 Holomen。", effect: "koTransferCheer", source: "archive", optional: true, meta: { targetRule: names ? { names } : tags ? { tags } : {} } });
  }
  if (onOpponentTurn && ["hBP04-063", "hSD16-007", "hSD17-008"].includes(defeatedCard?.number)) appendLog(state, `${owner.name} 因倒下 Gift 抽 ${drawCards(state, ownerIndex, 1)} 張牌。`);
  if (onOpponentTurn && defeatedCard?.number === "hBP04-077") {
    const cards = [...(defeated.stack || [])];
    if (cards.length) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(cards), selectableIds: cards.map(c => c.id), min: 1, max: 1, optional: false, effect: "archiveToHand", source: "archive", meta: { fromDefeated: true }, prompt: "選擇倒下成員重疊組中的 1 張返回手牌。" });
  }
  if (onOpponentTurn && defeatedCard?.number === "hBP04-088" && owner.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: ownerIndex, optional: false, prompt: "Gift：直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
  if (onOpponentTurn && defeatedCard?.number === "hBP06-020" && owner.mainDeck.length >= 2) pendingEffects.push({ type: "optionChoice", playerIndex: ownerIndex, options: [{ id: "use", label: "存檔牌庫頂 2 張，再按不同名 #FLOW GLOW 數量抽牌" }], prompt: "倒下 Gift：可使用效果。", effect: "giftFlowGlowKo", optional: true, meta: {} });
  if (onOpponentTurn && defeatedCard?.number === "hBP07-084") {
    const limited = owner.archive.filter((instance) => map.get(instance.number)?.group === "support" && String(map.get(instance.number)?.type || "").toUpperCase().includes("LIMITED"));
    if (limited.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(limited), selectableIds: limited.map((card) => card.id), min: 0, max: 1, prompt: "Gift：可揀存檔區 1 張 LIMITED 支援卡放到牌庫底，令倒下 Holomen 返回手牌。", effect: "giftLimitedSave", source: "archive", optional: true, meta: { returnIds: archiveIds(defeated.stack || []) } });
  }
  if (onOpponentTurn && defeatedCard?.number === "hBP08-041") pendingEffects.push({ type: "optionChoice", playerIndex: ownerIndex, options: [{ id: "use", label: "將這位 Holomen 的重疊卡返回手牌" }], prompt: "倒下 Gift：可改為將這位 Holomen 返回手牌。", effect: "giftReturnDefeated", optional: true, meta: { returnIds: archiveIds(defeated.stack || []) } });
  if (onOpponentTurn && defeatedCard?.number === "hBP08-050" && owner.cheerDeck.length > 0) pendingEffects.push({ type: "eventCheerTarget", playerIndex: ownerIndex, targetRule: { zones: BACK_SLOTS }, optional: false, prompt: "Gift：直接按自己 1 位後排 Holomen，附加應援牌庫頂 1 張。" });
  if (onOpponentTurn && defeatedCard?.number === "hEB01-006") pushArchiveChoice(defeated.attachments || [], "archiveToHand", "Gift：可揀倒下 Holomen 的 1 張支援卡返回手牌。");
  if (onOpponentTurn && defeatedCard?.number === "hSD14-009" && (defeated.attachments || []).some((instance) => map.get(instance.number)?.typeCode === "supportMascot")) appendLog(state, `${owner.name} 因附有吉祥物的倒下 Gift 抽 ${drawCards(state, ownerIndex, 1)} 張牌。`);
  if (onOpponentTurn && defeatedCard?.number === "hSD18-007" && owner.mainDeck.length > 0) {
    owner.archive.push(owner.mainDeck.shift());
    currentTurnEvents(owner, state.turn).deckArchived += 1;
    appendLog(state, `${owner.name} 因倒下 Gift 將牌庫頂 1 張放到存檔區。`);
  }

  for (const { zone, unit: giftUnit } of stageEntries(owner)) {
    const giftCard = unitCard(giftUnit, map);
    if (!giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    if (onOpponentTurn && giftCard?.number === "hBP07-022" && zone === "collab" && options.targetZone === "center" && cardHasTag(defeatedCard, "#3期生")) {
      const returned = archiveIds(defeated.stack || []).map((id) => removeById(owner.archive, id)).filter(Boolean);
      owner.hand.push(...returned);
      appendLog(state, `${owner.name} 因「肌肉不會背叛！」將倒下中央 Holomen 的 ${returned.length} 張重疊卡返回手牌。`);
    }
    if (onOpponentTurn && giftCard?.number === "hBP05-035" && cardHasName(defeatedCard, "さくらみこ")) {
      const cards = owner.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "み俺恥"));
      if (cards.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(cards), selectableIds: cards.map((card) => card.id), min: 0, max: 1, prompt: "Gift：可公開 1 張み俺恥加入手牌。", effect: "deckToHandShuffle", source: "deck", optional: true, meta: {} });
    }
    if (onOpponentTurn && giftCard?.number === "hBP08-046" && giftUnit !== defeated && cardHasTag(defeatedCard, "#Justice")) {
      pendingEffects.push({ type: "justiceDownSearch", playerIndex: ownerIndex });
    }
    if (onOpponentTurn && giftCard?.number === "hSD08-005" && owner.life.length <= state.players[sourcePlayerIndex].life.length) {
      const cards = owner.archive.filter((instance) => ["supportItem", "supportItemLimited"].includes(map.get(instance.number)?.typeCode) && cardAliases(map.get(instance.number)).some((name) => /パソコン|電腦/u.test(name)));
      if (cards.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(cards), selectableIds: cards.map((card) => card.id), min: 0, max: 1, prompt: "Gift：可揀存檔區 1 張電腦道具返回手牌。", effect: "archiveToHand", source: "archive", optional: false, meta: {} });
    }

  }

  if (onOpponentTurn && cardHasTag(defeatedCard, "#Justice") && !usedNamedThisTurn(owner, "gift:hSD13-005", state.turn)) {
    const sourceIds = stageEntries(owner).filter(({ unit }) => unitCard(unit, map)?.number === "hSD13-005").map(({ unit }) => topCard(unit).id);
    if (sourceIds.length) pendingEffects.push({ type: "erbKnockoutGift", playerIndex: ownerIndex, sourceIds });
  }
  if (sourceCard?.number === "hBP04-013" && sourcePlayer.mainDeck.length > 0) {
    sourcePlayer.holoPower.push(sourcePlayer.mainDeck.shift());
    pendingEffects.push({ type: "cardSelection", playerIndex: sourcePlayerIndex, cards: clone(sourcePlayer.holoPower), selectableIds: sourcePlayer.holoPower.map((card) => card.id), min: 1, max: 1, prompt: "Gift：查看 Holo Power，揀 1 張加入手牌。", effect: "giftPowerToHand", source: "holoPower", optional: false, meta: {} });
  }
  if (sourceCard?.number === "hBP05-023") {
    const cheers = sourcePlayer.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    if (cheers.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: sourcePlayerIndex, cards: clone(cheers), selectableIds: cheers.map((card) => card.id), min: 0, max: 1, prompt: "Gift：可揀存檔區 1 張應援；下一步直接按 #ID1期生 Holomen。", effect: "archiveCheerToStage", source: "archive", optional: true, meta: { targetRule: { tags: ["#ID1期生"] } } });
  }
  if (sourceCard?.number === "hBP05-061") appendLog(state, `${sourcePlayer.name} 因擊倒 Gift 抽 ${drawCards(state, sourcePlayerIndex, 2)} 張牌。`);
  if (sourceCard?.number === "hBP06-027" && options.targetZone === "center") {
    const eligible = candidate => stageEntries(sourcePlayer).some(({unit}) => cardHasName(unitCard(unit,map), "風真いろは") && unit.bloomedTurn === state.turn && unitCard(unit,map)?.stage === "1st" && candidate?.stage === "2nd" && talentMatches(candidate,unitCard(unit,map)) && candidate.hp > unit.damage);
    const cards = sourcePlayer.hand.filter(instance => eligible(map.get(instance.number)));
    if (cards.length) pendingEffects.push({ type: "cardSelection", playerIndex: sourcePlayerIndex, cards: clone(cards), selectableIds: cards.map(c=>c.id), min: 1, max: 1, optional: true, effect: "irohaGiftBloom", source: "hand", prompt: "可選手牌2nd風真いろは，讓本回合Bloom過的1st再Bloom。" });
  }  if (sourceCard?.number === "hBP07-049") pendingEffects.push({ type: "stageTarget", playerIndex: sourcePlayerIndex, targetPlayerIndex: sourcePlayerIndex, options: null, rule: {}, prompt: "Gift：直接按自己 1 位 Holomen，本回合 Arts 無色費用 -2。", effect: "addModifier", optional: false, meta: { kind: "artCost", amount: -2, sourceNumber: sourceCard.number } });
  if (sourceCard?.number === "hBP08-013" && sourcePlayer.mainDeck.length > 0) {
    sourcePlayer.holoPower.push(sourcePlayer.mainDeck.shift());
    appendLog(state, `${sourcePlayer.name} 因擊倒 Gift 將牌庫頂 1 張放到 Holo Power。`);
  }
  if (sourceCard?.number === "hBP09-037") pendingEffects.push({ type: "stageTarget", playerIndex: sourcePlayerIndex, targetPlayerIndex: sourcePlayerIndex, options: null, rule: { zones: BACK_SLOTS, tags: ["#FLOW GLOW"] }, prompt: "Gift：可直接按自己 1 位 #FLOW GLOW 後排，將整個重疊組返回手牌。", effect: "giftReturnStageStack", optional: true, meta: {} });
  if (sourceCard?.number === "hSD12-007" && !usedNamedThisTurn(sourcePlayer, "gift:hSD12-007", state.turn)) {
    const cards = sourcePlayer.archive.filter((instance) => map.get(instance.number)?.group === "support" && !String(map.get(instance.number)?.type || "").toUpperCase().includes("LIMITED"));
    if (cards.length > 0) {
      markNamedUsage(sourcePlayer, "gift:hSD12-007", state.turn);
      pendingEffects.push({ type: "cardSelection", playerIndex: sourcePlayerIndex, cards: clone(cards), selectableIds: cards.map((card) => card.id), min: 1, max: 1, prompt: "Gift：揀存檔區 1 張非 LIMITED 支援卡返回手牌。", effect: "archiveToHand", source: "archive", optional: false, meta: {} });
    }
  }
  if (sourcePlayerIndex !== ownerIndex && sourceCard?.number === "hSD15-008" && source) {
    const healed = healStageUnit(state, sourcePlayerIndex, options.sourceZone, 20, map);
    appendLog(state, `${sourcePlayer.name} 因擊倒 Gift 回復 ${healed} HP。`);
  }
}

function finishGame(state, winnerIndex) {
  state.status = "finished";
  state.phase = "finished";
  state.winner = winnerIndex;
  state.pendingChoice = null;
  state.effectQueue = [];
  delete state.artsResolution;
  appendLog(state, `${state.players[winnerIndex].name} 勝出！`);
}

function queueExtraLifeLoss(state, ownerIndex, sourcePlayerIndex, map, sourceName) {
  const owner = state.players[ownerIndex];
  if (opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex)) {
    appendLog(state, `${owner?.name || "玩家"} 的生命減少防護阻止了「${sourceName}」。`);
    return false;
  }
  const extra = owner?.life.pop();
  if (!owner || !extra) return false;
  state.lifeLosses.push({ turn: state.turn, ownerIndex, sourcePlayerIndex, phase: state.phase, sourceName });
  state.lifeLosses = state.lifeLosses.slice(-40);
  enqueueEffect(state, { type: "lifeCheerTarget", playerIndex: ownerIndex, cheerCard: extra, winnerAfter: owner.life.length === 0, sourcePlayerIndex, prompt: `${sourceName} 令生命額外 -1：公開 ${extra.number}，直接按自己 Holomen 附加。` });
  appendLog(state, `${owner.name} 因「${sourceName}」生命額外 -1，公開 ${extra.number}。`, [extra], { revealRefs: [extra] });
  return true;
}

function defeatedCardPool(player) {
  return [...player.archive, ...stageEntries(player).filter(({unit}) => unit.downPending).flatMap(({unit}) => [...unit.stack, ...unit.cheer, ...unit.attachments])];
}
function takeDefeatedCard(player, id) {
  for (const {unit} of stageEntries(player)) {
    if (!unit.downPending) continue;
    for (const cards of [unit.stack, unit.cheer, unit.attachments]) {
      const card = removeById(cards, id);
      if (card) return card;
    }
  }
  return removeById(player.archive, id);
}
function knockOutUnit(state, ownerIndex, zone, map, sourcePlayerIndex, options = {}) {
  const owner = state.players[ownerIndex];
  const defeated = owner.zones[zone];
  if (!defeated || defeated.downPending) return;
  const defeatedInstance = topCard(defeated);
  const defeatedCard = unitCard(defeated, map);
  state.knockouts.push({ turn: state.turn, ownerIndex, sourcePlayerIndex, cardNumber: defeatedInstance?.number, cardRef: snapshotCardRefs([defeatedInstance])[0], card: clone(defeatedCard || {}), zone, byArts: Boolean(options.byArts), sourceZone: options.sourceZone || "" });
  state.knockouts = state.knockouts.slice(-40);
  const printedLifeLoss = cardIsBuzz(defeatedCard) ? 2 : 1;
  const lifeCount = Math.max(0, printedLifeLoss - giftKnockoutLifeReduction(state, ownerIndex, zone, defeated, defeatedCard, map));
  const preventedLifeLoss = options.loseLife !== false && lifeCount === 0;
  const returnable = defeatedCard?.number === "hEB01-018" && state.activePlayer !== ownerIndex
    ? (defeated.attachments || []).filter((instance) => cardHasTag(map.get(instance.number), "#こよラボ"))
    : [];
  const pendingEffects = [];
  queueLunaiteArchiveReplacements(state, ownerIndex, zone, defeated, map, pendingEffects);
  defeated.downPending = true;
  queueKnockoutAttachmentEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, { ...options, targetZone: zone }, pendingEffects);
  queueOshiKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, { ...options, targetZone: zone }, pendingEffects);
  queueGiftKnockoutEffects(state, ownerIndex, defeated, defeatedCard, map, sourcePlayerIndex, { ...options, targetZone: zone }, pendingEffects);
  // A damage reaction must retain access to the damaged member's Cheer.
  const damageReactions = state.effectQueue.filter(effect => effect.type === "iofiDamaged" && effect.playerIndex === ownerIndex && effect.targetId === defeatedInstance.id);
  state.effectQueue = state.effectQueue.filter(effect => !damageReactions.includes(effect));
  pendingEffects.unshift(...damageReactions);
  const lifeContext = { defeatedInstance, defeatedCard, lifeCount, preventedLifeLoss, returnable, pendingEffects: [], archivePending: true };
  if (pendingEffects.length) state.effectQueue.unshift(...pendingEffects, { type: "finishDownLife", playerIndex: ownerIndex, ownerIndex, zone, sourcePlayerIndex, options: clone(options), context: lifeContext });
  else finishKnockoutLife(state, ownerIndex, zone, map, sourcePlayerIndex, options, lifeContext);
}

// Kept separate so DOWN abilities can finish before the normal life-loss step.
function finishKnockoutLife(state, ownerIndex, zone, map, sourcePlayerIndex, options, context) {
  const owner = state.players[ownerIndex];
  const { defeatedInstance, defeatedCard, lifeCount, preventedLifeLoss, returnable, pendingEffects } = context;
  if (context.archivePending) {
    const defeated = owner.zones[zone];
    if (defeated?.downPending) {
      const cheerCount = defeated.cheer.length;
      archiveUnit(owner, defeated);
      owner.zones[zone] = null;
      triggerCheerArchivedGift(state, ownerIndex, map, cheerCount);
    }
  }
  if (options.loseLife === false || preventedLifeLoss) {
    appendLog(state, preventedLifeLoss
      ? `${owner.name} 的 ${defeatedInstance.number} 倒下，但 Gift 防止這次生命減少。`
      : `${owner.name} 的 ${defeatedInstance.number} 因特殊傷害倒下；此效果不會令生命減少。`, [defeatedInstance], { reveal: false });
    if (stageUnitCount(owner) === 0) finishGame(state, sourcePlayerIndex);
    else state.effectQueue.unshift(...pendingEffects);
    return;
  }
  // Q196: Buzz replaces the normal knockout life loss with two; it does
  // not add two to the normal one. Only the current top card has this Extra.
  const lostLives = [];
  for (let i = 0; i < lifeCount && owner.life.length > 0; i += 1) {
    lostLives.push(owner.life.pop());
    state.lifeLosses.push({ turn: state.turn, ownerIndex, sourcePlayerIndex, phase: state.phase, sourceName: defeatedCard?.name || defeatedCard?.number || "倒下" });
  }
  state.lifeLosses = state.lifeLosses.slice(-40);
  appendLog(state, `${owner.name} 的 ${defeatedInstance.number} 倒下，生命 -${lostLives.length}。`, [defeatedInstance], { reveal: false });
  if (stageUnitCount(owner) === 0 || lostLives.length === 0) {
    finishGame(state, sourcePlayerIndex);
    return;
  }
  if (returnable.length > 0) pendingEffects.push({ type: "cardSelection", playerIndex: ownerIndex, cards: clone(returnable), selectableIds: returnable.map((card) => card.id), min: 1, max: 1, prompt: "Gift：可揀 1 張 #こよラボ 支援卡由存檔區返回手牌。", effect: "returnArchivedToHand", source: "archive", optional: true, meta: {} });
  lostLives.forEach((lostLife, index) => {
    pendingEffects.push({ type: "lifeCheerTarget", playerIndex: ownerIndex, cheerCard: lostLife, winnerAfter: owner.life.length === 0 && index === lostLives.length - 1, sourcePlayerIndex, prompt: `公開生命 ${lostLife.number}：直接按自己舞台上的 Holomen 附加。` });
    appendLog(state, `${owner.name} 公開生命 ${lostLife.number}，必須附加到自己舞台上的 Holomen。`, [lostLife], { revealRefs: [lostLife] });
  });

  const sourcePlayer = state.players[sourcePlayerIndex];
  const sourceUnit = options.sourceZone ? sourcePlayer?.zones?.[options.sourceZone] : null;
  const drawKind = options.byArts ? "drawOnArtsKnockout" : "drawOnSpecialKO";
  const drawOnKnockout = activeModifiers(sourceUnit, drawKind, state.turn).reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);
  if (drawOnKnockout > 0) {
    const drawn = drawCards(state, sourcePlayerIndex, drawOnKnockout);
    appendLog(state, `${sourcePlayer.name} 因擊倒觸發抽 ${drawn} 張牌。`);
  }
  const extraLife = matchingPlayerModifierBonus(sourcePlayer, "extraLifeOnCenterKO", sourceUnit, options.sourceZone || "", map, state.turn);
  if (sourcePlayerIndex !== ownerIndex && zone === "center" && extraLife > 0 && owner.life.length > 0 && !opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex)) {
    const extra = owner.life.pop();
    if (extra) {
      state.lifeLosses.push({ turn: state.turn, ownerIndex, sourcePlayerIndex, phase: state.phase, sourceName: "卡牌效果" });
      state.lifeLosses = state.lifeLosses.slice(-40);
      pendingEffects.push({ type: "lifeCheerTarget", playerIndex: ownerIndex, cheerCard: extra, winnerAfter: owner.life.length === 0, sourcePlayerIndex, prompt: `額外生命減少：公開 ${map.get(extra.number)?.name || extra.number}，直接按自己 Holomen 附加。` });
      appendLog(state, `${owner.name} 因卡牌效果額外生命 -1。`);
    }
  } else if (sourcePlayerIndex !== ownerIndex && zone === "center" && extraLife > 0 && opponentAbilityLifeLossBlocked(state, ownerIndex, sourcePlayerIndex)) {
    appendLog(state, `${owner.name} 的生命減少防護阻止了卡牌效果的額外生命 -1。`);
  }
  state.effectQueue.unshift(...pendingEffects);
}

function applySpecialDamage(state, playerIndex, targetPlayerIndex, targetZone, amount, map, options = {}) {
  const targetPlayer = state.players[targetPlayerIndex];
  const target = targetPlayer?.zones?.[targetZone];
  if (!target) return 0;
  const sourceUnit = state.players[playerIndex]?.zones?.[options.sourceZone];
  const bonus = matchingPlayerModifierBonus(state.players[playerIndex], "specialDamage", sourceUnit, options.sourceZone || "", map, state.turn)
    + attachmentSpecialDamageBonus(sourceUnit, map, options.sourceZone || "", targetZone)
    + giftSpecialDamageBonus(state, playerIndex, options.sourceZone || "", targetZone, map, options.sourceCardNumber);
  const defense = attachmentDamageAdjustment(target, map, targetZone, targetPlayer, state.players[playerIndex], "special", state);
  const giftDefense = giftDamageAdjustment(state, targetPlayerIndex, targetZone, playerIndex, options.sourceZone || "", "special", map);
  const damage = defense.immune || giftDefense.immune || options.giftImmune ? 0 : Math.max(0, Number(amount || 0) + bonus + defense.adjustment + giftDefense.adjustment - Number(options.reactionReduction || 0));
  archiveShionFansBeforeDamage(state, targetPlayerIndex, target, damage);
  target.damage += damage;
  appendLog(state, `${state.players[playerIndex].name} 的「${options.sourceName || "卡牌效果"}」對 ${targetPlayer.name} 的 ${unitCard(target, map)?.name || targetZone} 造成 ${damage} 點特殊傷害。`);
  queueDamageTriggers(state, () => {
    queueAttachmentDamagedTriggers(state, targetPlayerIndex, targetZone, playerIndex, damage, map);
    queueGiftDamagedTriggers(state, targetPlayerIndex, targetZone, playerIndex, damage, "special", map);
  });
  const hp = Number(unitCard(target, map)?.hp || Infinity) + attachmentHpBonus(target, map, targetZone, targetPlayer) + holomemHpBonus(target, map, targetZone, targetPlayer);
  if (target.damage >= hp) resolveDamageKnockout(state, targetPlayerIndex, targetZone, map, playerIndex, { loseLife: options.loseLife !== false, byArts: false, sourceZone: options.sourceZone });
  return damage;
}

function simultaneousDamageEffects(state, effect) {
  if (!effect?.damageBatchId) return [];
  return state.effectQueue.filter((hit) => hit.damageBatchId === effect.damageBatchId && hit.type === effect.type && hit.playerIndex === effect.playerIndex && hit.targetPlayerIndex === effect.targetPlayerIndex);
}

function prepareOshiDamageReaction(state, effect, map) {
  if (effect.oshiReactionChecked) return false;
  const targetPlayer = state.players[effect.targetPlayerIndex];
  const target = targetPlayer?.zones?.[effect.targetZone];
  const targetCard = unitCard(target, map);
  const oshiNumber = targetPlayer?.oshi?.number;
  if (!target || effect.playerIndex === effect.targetPlayerIndex) return false;
  if (state.activePlayer === effect.targetPlayerIndex && oshiNumber !== "hSD13-001") return false;
  const options = [];
  if (oshiNumber === "hSD13-001" && effect.type === "dealArtsDamage" && Number(targetPlayer.oshiSkillTurn || 0) !== state.turn) {
    for (const { zone, unit } of stageEntries(targetPlayer)) {
      const card = unitCard(unit, map);
      if ((card?.colors || []).includes("紅") && (cardIsBuzz(card) || card?.stage === "2nd")) options.push({ id: "erb:" + zone, label: "秩序の先駆者：由「" + (card.name || card.number) + "」（" + zone + "）代受藝能傷害" });
    }
  }
  if (oshiNumber === "hBP01-002" && Number(targetPlayer.oshiSkillTurn || 0) !== state.turn && cardHasTag(targetCard, "#Promise")) options.push({ id: "normal:50", label: "文明的守護者：這次傷害 -50" });
  if (oshiNumber === "hBP04-006" && Number(targetPlayer.oshiSkillTurn || 0) !== state.turn && [effect, ...simultaneousDamageEffects(state, effect)].some((hit) => cardHasName(unitCard(targetPlayer.zones[hit.targetZone], map), "大空スバル"))) options.push({ id: "normal:30", label: "Mental! Physical! Passion!：同次受傷的全體大空スバル傷害 -30" });
  if (oshiNumber === "hBP04-001" && !targetPlayer.spOshiSkillUsed && cardHasName(targetCard, "博衣こより") && target.attachments.some((instance) => instance.number === ASSISTANT_CARD)) options.push({ id: "sp:100", label: "助手君、嗯—啾！：這次傷害 -100" });
  if (["hSD05-001", "hSD08-001", "hYS01-001"].includes(oshiNumber) && !targetPlayer.spOshiSkillUsed && (targetCard?.colors || []).includes("白")) options.push({ id: "sp:20", label: "快速防禦：這次傷害 -20" });
  const oshiCard = map.get(oshiNumber);
  const affordable = options.filter((option) => {
    const kind = option.id.startsWith("sp:") ? "sp" : "oshi";
    const skill = kind === "sp" ? oshiCard?.spOshiSkill : oshiCard?.oshiSkill;
    return targetPlayer.holoPower.length >= oshiPowerCost(skill, oshiNumber, kind);
  });
  if (affordable.length === 0) return false;
  state.pendingChoice = {
    type: "optionChoice",
    playerIndex: effect.targetPlayerIndex,
    options: [],
    modeOptions: affordable,
    optional: true,
    prompt: "受到對手傷害：可使用一個合法推し技能減少這次傷害。",
    effect: "oshiDamageReaction",
    meta: { queuedEffect: { ...clone(effect), oshiReactionChecked: true } },
  };
  return true;
}

function prepareGiftDamageReaction(state, effect, map) {
  if (effect.giftReactionChecked) return false;
  const ownerIndex = effect.targetPlayerIndex;
  const owner = state.players[ownerIndex];
  const target = owner?.zones?.[effect.targetZone];
  if (!target || state.activePlayer === ownerIndex) return false;
  const options = [];
  for (const { zone, unit: giftUnit } of stageEntries(owner)) {
    const card = unitCard(giftUnit, map);
    const text = giftText(giftUnit, map);
    if (!text || !giftZoneApplies(text, zone) || usedNamedThisTurn(owner, `gift:${card.number}`, state.turn)) continue;
    if (card.number === "hBP01-027") options.push({ id: `zeta:${zone}`, label: "隱密行動：擲骰，奇數時令這次傷害變成 0" });
    if (card.number === "hBP05-065" && giftUnit !== target) options.push({ id: `flare:${zone}`, label: "溫柔守護：擲骰，這次傷害 -20／-40" });
  }
  if (effect.type === "specialDamage" && effect.playerIndex !== ownerIndex && BACK_SLOTS.includes(effect.targetZone) && !(owner.modifiers || []).some((modifier) => modifier.kind === "backSpecialImmune" && Number(modifier.expiresTurn || 0) >= state.turn)) {
    for (const { zone, unit: giftUnit } of stageEntries(owner)) {
      if (unitCard(giftUnit, map)?.number === "hSD13-012" && giftUnit.stack.slice(0, -1).some(instance => map.get(instance.number)?.group === "holomem")) options.push({ id: "gigiShield:" + zone, label: "革命防線（" + zone + "）：存檔這位Gigi下方1張Holomen，後排本回合不受特殊傷害" });
    }
  }
  if (options.length === 0) return false;
  state.pendingChoice = {
    type: "optionChoice",
    playerIndex: ownerIndex,
    options: [],
    modeOptions: options,
    optional: true,
    prompt: "即將受到傷害：可使用一個合法 Gift 防禦效果。",
    effect: "giftDamageReaction",
    meta: { targetZone: effect.targetZone, queuedEffect: { ...clone(effect), giftReactionChecked: true } },
  };
  return true;
}

function archiveShionFansBeforeDamage(state, ownerIndex, target, damage) {
  if (damage <= 0) return;
  const fans = target.attachments.filter(c => c.number === "hBP02-102");
  for (const fan of fans) state.players[ownerIndex].archive.push(removeById(target.attachments, fan.id));
  if (fans.length) appendLog(state, `受傷前將 ${fans.length} 張粉絲存檔。`);
}

function prepareAttachmentDamageReaction(state, effect, map) {
  if (effect.attachmentReactionChecked) return false;
  const targetPlayer = state.players[effect.targetPlayerIndex];
  const target = targetPlayer?.zones?.[effect.targetZone];
  if (!target) return false;
  const card = unitCard(target, map);
  if (state.activePlayer === effect.targetPlayerIndex) return false;
  const reducer = target.attachments.find((instance) => (instance.number === "hBP01-117" && cardHasName(card, "七詩ムメイ")) || (instance.number === "hBP03-105" && cardHasName(card, "姫森ルーナ")));
  if (!reducer) return false;
  state.pendingChoice = {
    type: "optionChoice",
    playerIndex: effect.targetPlayerIndex,
    options: [],
    modeOptions: [{ id: "use", label: `將 ${map.get(reducer.number)?.name || reducer.number} 存檔，這次傷害 -30` }],
    optional: true,
    prompt: "受到傷害：可使用附加卡的防禦效果。",
    effect: "damageReaction",
    meta: { attachmentId: reducer.id, targetZone: effect.targetZone, queuedEffect: { ...clone(effect), attachmentReactionChecked: true } },
  };
  return true;
}

function queueAttachmentDamagedTriggers(state, targetPlayerIndex, targetZone, sourcePlayerIndex, damage, map) {
  if (damage <= 0) return;
  const targetPlayer = state.players[targetPlayerIndex];
  const target = targetPlayer?.zones?.[targetZone];
  if (!target || state.activePlayer === targetPlayerIndex) return;
  const card = unitCard(target, map);
  // Zecretary says "after receiving damage in the opponent's turn".
  // Capture damage triggers before down processing can remove their source.
  for (const instance of [...target.attachments]) {
    if (instance.number !== "hBP07-108") continue;
    const moved = removeById(target.attachments, instance.id);
    if (moved) targetPlayer.archive.push(moved);
  }
  const has = (number) => target.attachments.some((instance) => instance.number === number);
  if (has("hBP01-116") && cardHasName(card, "天音かなた") && activeModifiers(target, "trigger:hBP01-116", state.turn).length === 0) {
    addStageModifier(target, "trigger:hBP01-116", 0, state.turn, "hBP01-116");
    if (state.players[sourcePlayerIndex].zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex: targetPlayerIndex, targetPlayerIndex: sourcePlayerIndex, targetZone: "center", amount: 20, loseLife: true, sourceName: "UPAO", reactionsChecked: false });
  }
  if (has("hSD06-011") && ["1st", "2nd"].includes(card?.stage) && cardHasName(card, "風真いろは") && activeModifiers(target, "trigger:hSD06-011", state.turn).length === 0) {
    addStageModifier(target, "trigger:hSD06-011", 0, state.turn, "hSD06-011");
    if (state.players[sourcePlayerIndex].zones.center) enqueueEffect(state, { type: "specialDamage", playerIndex: targetPlayerIndex, targetPlayerIndex: sourcePlayerIndex, targetZone: "center", amount: 20, loseLife: false, sourceName: "Chaki丸", reactionsChecked: false });
  }
}

function queueGiftDamagedTriggers(state, targetPlayerIndex, targetZone, sourcePlayerIndex, damage, kind, map, sourceCardNumber = "") {
  if (damage <= 0) return;
  const owner = state.players[targetPlayerIndex];
  const target = owner?.zones?.[targetZone];
  if (!target || state.activePlayer === targetPlayerIndex) return;
  const targetCard = unitCard(target, map);
  if (sourcePlayerIndex !== targetPlayerIndex && owner.oshi?.number === "hBP05-002" && cardHasTag(targetCard, "#ID1期生")) enqueueEffect(state, { type: "iofiDamaged", playerIndex: targetPlayerIndex, targetId: topCard(target)?.id });
  const healUsage = `gift:hBP07-029:${topCard(target)?.id}`;
  if (targetCard?.number === "hBP07-029" && target.attachments.some((attachment) => map.get(attachment.number)?.group === "support") && !usedNamedThisTurn(owner, healUsage, state.turn)) {
    markNamedUsage(owner, healUsage, state.turn);
    enqueueEffect(state, { type: "resolveDamagedGiftHeal", playerIndex: targetPlayerIndex, targetId: topCard(target)?.id, amount: 50 });
  }
  if (kind === "arts" && targetZone === "center" && cardHasTag(targetCard, "#秘密結社holoX")) {
    const gift = owner.zones.collab;
    const usage = `gift:hBP08-029:${topCard(gift)?.id}`;
    if (unitCard(gift, map)?.number === "hBP08-029" && !usedNamedThisTurn(owner, usage, state.turn)) {
      markNamedUsage(owner, usage, state.turn);
      enqueueEffect(state, { type: "resolveDamagedGiftPower", playerIndex: targetPlayerIndex });
    }
  }
}

function queueGiftDamageDealtTriggers(state, playerIndex, sourceZone, targetPlayerIndex, targetZone, damage, kind, map, sourceCardNumber = "") {
  if (damage <= 0) return;
  const player = state.players[playerIndex];
  const source = player?.zones?.[sourceZone];
  const sourceCard = sourceCardNumber ? map.get(sourceCardNumber) : unitCard(source, map);
  if (kind === "special" && playerIndex !== targetPlayerIndex && cardHasName(sourceCard, "ムーナ・ホシノヴァ") && source.attachments.some(c => c.number === "hBP06-101") && !usedNamedThisTurn(player, "mascot:hBP06-101:" + topCard(source).id, state.turn)) {
    const cards = player.archive.filter(c => map.get(c.number)?.group === "cheer" && (map.get(c.number)?.colors || []).includes("藍"));
    if (cards.length && stageOptionsMatching(player, map, { zones: BACK_SLOTS }).length) enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "moonaFanCheer", source: "archive", prompt: "Moona粉絲：可選1張藍色應援附加到後排。", meta: { usageKey: "mascot:hBP06-101:" + topCard(source).id } });
  }
  if (kind === "special" && playerIndex !== targetPlayerIndex && damage >= 30 && cardHasName(sourceCard, "獅白ぼたん")) {
    const gift = stageEntries(player).find(({ zone, unit: giftUnit }) => unitCard(giftUnit, map)?.number === "hBP05-028" && giftZoneApplies(giftText(giftUnit, map), zone));
    if (gift && !usedNamedThisTurn(player, "gift:hBP05-028", state.turn)) {
      markNamedUsage(player, "gift:hBP05-028", state.turn);
      appendLog(state, `${player.name} 因獅白牡丹的 Gift 抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    }
  }
  if (kind === "arts" && playerIndex !== targetPlayerIndex && sourceCard?.number === "hBP06-052") {
    const target = state.players[targetPlayerIndex]?.zones?.[targetZone];
    if (target) enqueueOptionChoice(state, { playerIndex, options: [{ id: "use", label: "發動新月" }], optional: true, effect: "moonaNewMoon", prompt: "可發動新月，造成等同對手目前傷害的特殊傷害。", meta: { targetPlayerIndex, targetZone, sourceZone } });
  }
}

function queueOshiAfterArtsDamage(state, sourcePlayerIndex, sourceZone, targetPlayerIndex, targetZone, damage, map) {
  const sourcePlayer = state.players[sourcePlayerIndex];
  const source = sourcePlayer?.zones?.[sourceZone];
  const sourceCard = unitCard(source, map);
  const oshiNumber = sourcePlayer?.oshi?.number;
  const push = (kind, trigger, label, meta = {}) => enqueueOptionChoice(state, { playerIndex: sourcePlayerIndex, options: [{ id: "use", label }], optional: true, prompt: "Arts 已造成傷害：可使用推し技能。", effect: "oshiAfterDamage", meta: { kind, trigger, sourceZone, targetPlayerIndex, targetZone, damage, ...meta } });
  if (oshiNumber === "hBP01-007" && Number(sourcePlayer.oshiSkillTurn || 0) !== state.turn && BACK_SLOTS.includes(targetZone) && (sourceCard?.colors || []).includes("藍")) push("normal", "suiseiBack50", "彗星：對對手 1 位後排造成 50 點特殊傷害");
  if (oshiNumber === "hBP01-007" && !sourcePlayer.spOshiSkillUsed && ["center", "collab"].includes(targetZone) && (sourceCard?.colors || []).includes("藍")) push("sp", "suiseiMirror", "Shooting Star：對對手 1 位後排造成相同數值的特殊傷害");
  if (["hSD03-001", "hYS01-004"].includes(oshiNumber) && !sourcePlayer.spOshiSkillUsed && BACK_SLOTS.includes(targetZone)) push("sp", "backshot", "後方射擊：對該後排 Holomen 造成 50 點特殊傷害");
  if (oshiNumber === "hBP02-005" && !sourcePlayer.spOshiSkillUsed && sourceZone === "center" && (sourceCard?.colors || []).includes("紫") && state.players[targetPlayerIndex].zones.center) {
    const amount = state.players[targetPlayerIndex].zones.center.cheer.length * 50;
    push("sp", "shionCenter", "シオンのすごい魔法：對手中央受到 " + amount + " 點特殊傷害", { amount });
  }
}

function queueOshiAfterSpecialDamage(state, sourcePlayerIndex, sourceZone, targetPlayerIndex, targetZone, damage, map) {
  const player = state.players[sourcePlayerIndex];
  if (player?.oshi?.number === "hSD03-001" && !player.spOshiSkillUsed && sourcePlayerIndex !== targetPlayerIndex && BACK_SLOTS.includes(targetZone) && unitCard(player.zones[sourceZone], map)?.group === "holomem") enqueueOptionChoice(state, { playerIndex: sourcePlayerIndex, options: [{ id: "use", label: "後方射擊：造成 50 點特殊傷害" }], optional: true, effect: "oshiAfterDamage", meta: { kind: "sp", trigger: "backshot", sourceZone, targetPlayerIndex, targetZone, damage } });
  if (player?.oshi?.number !== "hBP06-006" || Number(player.oshiSkillTurn || 0) === state.turn) return;
  enqueueOptionChoice(state, { playerIndex: sourcePlayerIndex, options: [{ id: "use", label: "滿月的光輝：對手中央與合作各造成 20 點特殊傷害" }], optional: true, prompt: "已造成特殊傷害：可使用推し技能。", effect: "oshiAfterDamage", meta: { kind: "normal", trigger: "moonaFanout", sourceZone } });
}

function queueGiftArtUseEffects(state, playerIndex, sourceZone, sourceCard, map) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const source = player.zones[sourceZone];
  if (!source || !sourceCard) return;

  for (const { zone, unit: giftUnit } of stageEntries(player)) {
    const giftCard = unitCard(giftUnit, map);
    if (!giftCard || !giftZoneApplies(giftText(giftUnit, map), zone)) continue;
    if (giftCard.number === "hBP05-066" && zone === "collab" && sourceZone === "center" && cardHasTag(sourceCard, "#3期生") && player.hand.length > 0) {
      enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 0, max: 1, optional: true, effect: "giftDiscardDraw", source: "hand", prompt: "冬之旅：可揀 1 張手牌放到存檔區；若支付，抽 1 張牌。" });
    }
    if (giftCard.number === "hBP06-066" && zone === "center" && sourceZone === "collab" && cardHasTag(sourceCard, "#0期生") && player.mainDeck.length > 0) {
      enqueueCardSelection(state, { playerIndex, cards: player.mainDeck, min: 1, max: 1, effect: "deckToArchiveShuffle", source: "deck", prompt: "どり～む_コネクト.zero：公開牌庫 1 張卡放到存檔區，然後洗牌。" });
    }
  }

  if (sourceCard.number === "hBP05-067" && source.cheer.length >= 2) {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS }).filter((zone) => zone !== sourceZone);
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "giftFlareCheerTarget", optional: true, prompt: "Colorful Stream：可直接按自己 1 位後排 Holomen；下一步按攻擊者身上 2 張實際應援改附。", meta: { sourceZone } });
  }
  if (sourceCard.number === "hBP06-014" && player.holoPower.length > 0) {
    enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: 1, effect: "giftRaoraPowerPick", source: "holoPower", prompt: "夢紡ぎのアトリエ：查看 Holo Power，揀 1 張加入手牌；之後再揀 1 張手牌放回 Holo Power。" });
  }
  if (sourceCard.number === "hBP06-065" && map.get(source.stack.at(-2)?.number)?.stage === "1st") {
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "一言芳恩：直接按對手中央或合作 Holomen，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: sourceCard.keyword?.name || sourceCard.name, sourceZone, beforeArts: true } });
  }
}

function queueArtKnockoutEffects(state, effect, targetCard, damage, remainingHpBefore, map, random) {
  if (state.status === "finished") return;
  const playerIndex = effect.playerIndex;
  const player = state.players[playerIndex];
  const opponentIndex = effect.targetPlayerIndex;
  const source = player.zones[effect.sourceZone];
  const key = `${effect.artSourceNumber || topCard(source)?.number}:${Number(effect.artIndex || 0)}`;
  const excess = Math.max(0, Number(damage || 0) - Math.max(0, Number(remainingHpBefore || 0)));

  if (key === "hBP01-014:0" && excess >= 50) queueExtraLifeLoss(state, opponentIndex, playerIndex, map, effect.artName || effect.sourceName);
  if (key === "hBP05-018:1") queueDeckToHand(state, playerIndex, { group: "holomem", stages: ["1st"], tags: ["#ID3期生"] }, map, random, { min: 1, max: 1, optional: false, label: effect.artName || "Summer Vibes" });
  if (key === "hBP05-027:0") {
    appendLog(state, `${player.name} 因「${effect.artName}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
    if (cardHasName(map.get(player.oshi?.number), "アキ・ローゼンタール")) {
      let healed = 0;
      stageEntries(player).forEach(({ zone }) => { healed += healStageUnit(state, playerIndex, zone, 20, map); });
      appendLog(state, `${player.name} 的全體 Holomen 合共回復 ${healed} HP。`);
    }
  }
  if (key === "hBP07-014:0" && effect.sourceZone === "center" && excess > 0) {
    const options = stageOptionsMatching(state.players[opponentIndex], map, { stages: ["2nd"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: `超額傷害 ${excess}：直接按對手 1 位 2nd Holomen。`, meta: { amount: excess, loseLife: true, sourceName: effect.artName, sourceZone: effect.sourceZone } });
  }
  if (key === "hBP07-027:0" && ["center", "collab"].includes(effect.sourceZone)) appendLog(state, `${player.name} 因「${effect.artName}」抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  if (key === "hSD08-004:0" && effect.targetZone === "center") {
    const usageKey = `art-ko:hSD08-004:${topCard(source)?.id || effect.sourceZone}`;
    const options = stageOptionsMatching(state.players[opponentIndex], map, { stages: ["2nd"] });
    if (!usedNamedThisTurn(player, usageKey, state.turn) && options.length > 0) {
      markNamedUsage(player, usageKey, state.turn);
      enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: "擊倒中央觸發：直接按對手 1 位 2nd Holomen，造成 40 點特殊傷害。", meta: { amount: 40, loseLife: true, sourceName: effect.artName, sourceZone: effect.sourceZone } });
    }
  }
  if (key === "hSD10-006:1" && effect.targetZone === "center" && excess >= 30) {
    const amount = Math.min(Math.floor(excess / 30), player.cheerDeck.length);
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS });
    if (amount > 0 && options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "hSD10OverkillCheerTarget", optional: false, prompt: "超額傷害：選擇 1 位後排 Holomen，將每滿 30 點超額傷害的應援附加到同一位目標。", meta: { amount } });
  }
  if (key === "hSD13-007:0" && source && player.cheerDeck.length > 0) enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options: [effect.sourceZone], optional: false, prompt: "擊倒觸發：按攻擊者，附加應援牌庫頂 1 張。" });
  void targetCard;
}

function attack(state, playerIndex, action, map, random) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "performance", "只能在自己的表演階段使用 Arts。 ");
  assert(!(playerIndex === state.firstPlayer && Number(state.players[playerIndex].turnsTaken || 0) === 1), "先攻玩家的第 1 回合不能使用 Arts。 ");
  assert(["center", "collab"].includes(action.sourceZone), "Arts 的攻擊位置無效。 ");
  const player = state.players[playerIndex];
  const opponent = state.players[playerIndex === 0 ? 1 : 0];
  const source = player.zones[action.sourceZone];
  const target = opponent.zones[action.targetZone];
  const sourceCard = unitCard(source, map);
  const copiedArtCard = action.artSourceNumber ? map.get(action.artSourceNumber) : null;
  if (copiedArtCard) assert(sourceCard?.number === "hBP07-048" && cardHasTag(copiedArtCard, "#EN") && stageEntries(player).some(({ unit: stageUnit }) => topCard(stageUnit)?.number === copiedArtCard.number), "這個模仿 Arts 已不在自己舞台上。 ");
  const artCard = copiedArtCard || sourceCard;
  const intrinsicBackAttack = (artCard?.number === "hBP01-081" && Number(action.artIndex) === 0) || (artCard?.number === "hSD12-004" && Number(action.artIndex) === 0);
  const damagedBackAttack = activeModifiers(source, "attackDamagedBack", state.turn).length > 0 && Number(target?.damage || 0) > 0;
  const secondBackAttack = activeModifiers(source, "attackSecondBack", state.turn).length > 0 && BACK_SLOTS.includes(action.targetZone) && unitCard(target, map)?.stage === "2nd";
  const canAttackBack = intrinsicBackAttack || damagedBackAttack || secondBackAttack || activeModifiers(source, "attackBack", state.turn).length > 0 || giftAllowsBackAttack(player, source, target, action.targetZone, map);
  assert((canAttackBack ? STAGE_SLOTS : ["center", "collab"]).includes(action.targetZone), "Arts 的目標位置無效。 ");
  assert(source && target && !source.rested, "攻擊者或目標不存在，或攻擊者已休息。 ");
  assert(!defenderForcesCollabTarget(opponent, map) || action.targetZone === "collab", "對手的 Gift 令 Arts 只能以合作 Holomen 為對象。 ");
  const art = artCard?.arts?.[Number(action.artIndex)];
  assert(art && Number.isFinite(art.damage), "所選 Arts 無效。 ");
  assert(!/只能以對手的(?:中央|中心)/u.test(String(art.effect || "")) || action.targetZone === "center", "這個 Arts 只能以對手中央 Holomen 為對象。 ");
  const artKey = `${artCard?.number}:${Number(action.artIndex)}`;
  if (artKey === "hBP01-070:0") assert(!(source.attachments || []).some((instance) => cardHasName(map.get(instance.number), "座員")), "這個 Arts 只能在攻擊者沒有座員時使用。 ");
  if (artKey === "hBP07-060:1") assert(player.archive.filter((instance) => map.get(instance.number)?.group === "support").length >= 4, "存檔區最少需要 4 張支援卡先可使用這個 Arts。 ");
  if (artKey === "hBP06-039:0" && action.sourceZone === "collab") assert(player.life.length <= 2, "生命高於 2 時，這個 Arts 不能在合作位置使用。 ");
  const spendingRepeat = activeModifiers(source, "repeatArts", state.turn).find((modifier) => Number(modifier.uses || 0) > 0 && modifier.artIndex != null);
  if (spendingRepeat) assert(Number(spendingRepeat.artIndex) === Number(action.artIndex), "重複 Arts 只可再次使用相同 Arts。 ");
  assert(cheerCanPayForUnit(source, effectiveArtCost(source, art, state, player, action.sourceZone, map), map, player), "附加的應援不足以支付 Arts 費用。 ");
  assert(!state.pendingChoice && !state.artsResolution, "請先完成正在結算的效果。 ");
  // Legacy queued-effect fixtures/actions retain their existing standalone
  // semantics. A normal Art starts with an empty queue and owns one boundary.
  const ownsResolution = state.effectQueue.length === 0;
  if (ownsResolution) state.artsResolution = { phase: "ability", knockouts: [] };
  currentTurnEvents(player, state.turn).arts.push(sourceCard.number);
  const cardEffectBonus =
    resolveKoyoriArtEffects(state, playerIndex, action.sourceZone, Number(action.artIndex), map, random) +
    resolveGenericArtEffects(state, playerIndex, action.sourceZone, Number(action.artIndex), action.targetZone, map, random, artCard);
  if (state.status === "finished") return;
  const attachmentBonus = attachmentArtsBonus(source, map, state.turn, action.sourceZone, player, opponent);
  const giftBonus = giftArtsBonus(state, playerIndex, action.sourceZone, map);
  const playerBonus = matchingPlayerModifierBonus(player, "arts", source, action.sourceZone, map, state.turn);
  const oshiStageBonus = player.oshi?.number === "hBP07-006" && action.sourceZone === "center" && cardHasName(sourceCard, "AZKi")
    ? player.holoPower.length * 20
    : 0;
  const damage = Number(art.damage) + attachmentBonus + cardEffectBonus + giftBonus + playerBonus + oshiStageBonus;
  const splitTargets = artCard?.number === "hBP07-081"
    && Number(action.artIndex) === 0
    && (source.attachments || []).some((instance) => cardHasName(map.get(instance.number), "ギラファノコギリクワガタ"))
    ? ["center", "collab"].filter((zone) => opponent.zones[zone])
    : [action.targetZone];
  source.rested = true;
  source.lastArtsTurn = state.turn;
  source.lastArtsZone = action.sourceZone;
  if (spendingRepeat) spendingRepeat.uses = 0;
  const grantedRepeat = activeModifiers(source, "repeatArts", state.turn).find((modifier) => Number(modifier.uses || 0) > 0 && modifier.artIndex == null);
  if (grantedRepeat) {
    grantedRepeat.artIndex = Number(action.artIndex);
    source.rested = false;
    appendLog(state, `${sourceCard.name} 可再使用一次相同 Arts。`);
  }
  if (player.oshi?.number === "hBP07-001" && cardHasName(sourceCard, "角巻わため") && player.mainDeck.length > 0) {
    player.holoPower.push(player.mainDeck.shift());
    appendLog(state, `${player.name} 因「ドドドライブ」將牌庫頂 1 張放到 Holo Power。`);
  }
  queueAttachmentArtEffects(state, playerIndex, action.sourceZone, map, random);
  queueGiftArtUseEffects(state, playerIndex, action.sourceZone, sourceCard, map);
  const archiveCheerColors = new Set(player.archive.filter((instance) => map.get(instance.number)?.group === "cheer").flatMap((instance) => map.get(instance.number)?.colors || []));
  const damageBatchId = crypto.randomUUID();
  splitTargets.forEach((splitTargetZone) => {
    const splitTarget = opponent.zones[splitTargetZone];
    const splitTargetCard = unitCard(splitTarget, map);
    const takodachiColors = ["center", "collab"].includes(splitTargetZone)
      && (player.zones.center?.attachments || []).some(instance => instance.number === "hBP08-110");
    const targetColors = takodachiColors || activeModifiers(splitTarget, "allColors", state.turn).length > 0 ? SKILL_COLOR_WORDS.map(([value]) => value) : splitTargetCard?.colors || [];
    const specialBonus = (art.specialTargets || []).reduce((total, color, index) => total + (targetColors.includes(color) ? Number(art.specialValues?.[index] || 0) : 0), 0)
      + (targetColors.includes("紅") ? activeModifiers(source, "specialAttack:red", state.turn).reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0) : 0);
    const ignoreArtsReduction = (sourceCard?.number === "hBP06-027" && cardIsBuzz(map.get(source.stack.at(-2)?.number))) || (sourceCard?.number === "hBP07-075" && targetColors.some((color) => archiveCheerColors.has(color)))
      || (cardHasName(sourceCard, "桃鈴ねね") && ["1st", "2nd"].includes(sourceCard?.stage) && source.attachments.some((instance) => instance.number === "hBP07-103"));
    enqueueEffect(state, {
      type: "dealArtsDamage",
      damageBatchId,
      playerIndex,
      targetPlayerIndex: playerIndex === 0 ? 1 : 0,
      targetZone: splitTargetZone,
      sourceName: sourceCard?.name || sourceCard?.number,
      sourceZone: action.sourceZone,
      artSourceNumber: artCard?.number || sourceCard?.number,
      artIndex: Number(action.artIndex),
      artName: art.name,
      damage: damage + specialBonus,
      effectBonus: attachmentBonus + cardEffectBonus + giftBonus + playerBonus + oshiStageBonus,
      ignoreArtsReduction,
      healSourceByArtsDamage: artKey === "hSD04-006:0",
    });
  });
  if (ownsResolution) enqueueEffect(state, { type: "completeArtsResolution", playerIndex });
}

function batonPass(state, playerIndex, action, map) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段接力。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];
  const center = player.zones.center;
  const replacement = player.zones[action.zone];
  assert(center && BACK_SLOTS.includes(action.zone) && replacement, "接力位置無效。 ");
  assert(matchingPlayerModifierBonus(player, "movementLock", center, "center", map, state.turn) === 0, "中央 Holomen 受 SP 推し技能影響，今次不能接力、移動或替換。 ");
  assert(!center.rested && !replacement.rested, "中央及接替的後排 Holomen 都必須是未休息狀態。 ");
  assert(Number(player.batonTurn || 0) !== state.turn, "每回合只可接力 1 次。 ");
  const card = map.get(topCard(center).number);
  const cost = effectiveBatonCost(state, playerIndex, center, "center", map);
  assert(center.cheer.length >= cost, "中央 Holomen 的應援不足以支付接力費用。 ");
  player.archive.push(...center.cheer.splice(0, cost));
  triggerCheerArchivedGift(state, playerIndex, map, cost);
  player.zones.center = replacement;
  player.zones[action.zone] = center;
  player.batonTurn = state.turn;
  appendLog(state, `${player.name} 支付 ${cost} 張應援並完成接力。`);
  if (card?.number === "hBP08-022") {
    center.rested = true;
    appendLog(state, `${card.name} 因「エスケープメント」移到後排後變為休息狀態。`);
  }
  if (card?.number === "hBP06-084") {
    const options = stageOptionsMatching(player, map, { names: ["博衣こより"] });
    if (options.length > 0) enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "「こんこよ」、是不是有點過時了？：直接按自己 1 位博衣こより，本回合 Arts +20。", meta: { kind: "arts", amount: 20, sourceNumber: card.number } });
  }
}

function resolveNormalOshiSkill(state, playerIndex, oshiCard, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const number = oshiCard.number;
  const text = oshiCard.oshiSkill?.effect || "";
  const color = skillColor(text) || oshiCard.colors?.[0] || "";

  if (number.startsWith("hBD24-")) {
    const options = stageOptionsMatching(player, map, { colors: [color] });
    assert(options.length > 0, `舞台上沒有${color}色 Holomen。`);
    enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: `${oshiCard.oshiSkill?.name || "顏色強化"}：直接按 1 位${color}色 Holomen，本回合 Arts +20。`, meta: { kind: "arts", amount: 20, sourceNumber: number } });
    return;
  }

  if (number === KOYORI_OSHI) {
    const amount = Math.min(revealCount(player), player.mainDeck.length);
    const revealed = player.mainDeck.splice(0, amount);
    const holomemCount = revealed.filter((instance) => map.get(instance.number)?.group === "holomem").length;
    if (holomemCount >= 3) player.koyoriArtsBonusTurn = state.turn;
    const toHand = revealed.filter((instance) => map.get(instance.number)?.group === "holomem" && map.get(instance.number)?.stage !== "Debut");
    const toArchive = revealed.filter((instance) => !toHand.some((selected) => selected.id === instance.id));
    player.hand.push(...toHand);
    player.archive.push(...toArchive);
    appendLog(state, `${player.name} 展示 ${cardCodes(revealed)}；${toHand.length} 張非 Debut Holomen 加入手牌${holomemCount >= 3 ? "，本回合所有博衣こより Arts +30" : ""}。`, revealed);
    return;
  }

  if (number === "hBP01-001") {
    const target = opponent.zones.center;
    assert(target, "對手沒有中央 Holomen。 ");
    const hp = Number(unitCard(target, map)?.hp || 0) + attachmentHpBonus(target, map, "center", opponent) + holomemHpBonus(target, map, "center", opponent);
    if (!jacketProtectsHp(state, target, opponent, player, map)) target.damage = Math.max(0, hp - 50);
    appendLog(state, `${opponent.name} 的中央 Holomen 剩餘 HP 變為 50。`);
  } else if (number === "hBP01-003") {
    queueDeckAttachmentToStage(state, playerIndex, { nameIncludes: ["石の斧"] }, { colors: ["綠"] }, map, random, "生存力量", { optional: false });
  } else if (["hBP01-006", "hSD19-001"].includes(number)) {
    queueArchiveToHand(state, playerIndex, { group: "holomem" }, map, { min: 1, max: 1, optional: false, label: oshiCard.oshiSkill?.name || "推し技能" });
  } else if (number === "hBP02-001") {
    queueDeckToHand(state, playerIndex, { typeCodes: ["supportMascot"] }, map, random, { label: "吉祥物創造" });
  } else if (number === "hBP02-002") {
    const greenCheer = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("綠"));
    assert(greenCheer.length > 0 && player.cheerDeck.length > 0 && stageUnitCount(player) > 0, "需要存檔區 1 張綠色應援、非空的應援牌庫及舞台 Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: greenCheer, min: 1, max: 1, effect: "oshiRemoveArchivedCheer", source: "archive", prompt: "HALU：揀 1 張存檔區綠色應援移出遊戲；之後再揀應援牌庫的實際卡片。" });
  } else if (number === "hBP02-003") {
    assert(Number(player.turnsTaken || 0) > 1, "自己的第 1 回合不可 Bloom。 ");
    const targets = stageOptionsMatching(player, map, { tags: ["#3期生"] }).filter((zone) => Number(player.zones[zone]?.bloomedTurn || 0) === state.turn);
    const candidates = player.hand.filter((instance) => {
      const card = map.get(instance.number);
      return card?.group === "holomem" && ["1st", "2nd"].includes(card.stage) && targets.some((zone) => legalBloomStage(card, unitCard(player.zones[zone], map)) && talentMatches(card, unitCard(player.zones[zone], map)) && Number(card.hp || 0) > Number(player.zones[zone].damage || 0));
    });
    assert(candidates.length > 0, "沒有可讓本回合已 Bloom 的 #3期生再次 Bloom 的手牌。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "oshiBonusBloomCard", source: "hand", prompt: "Ahoy!：揀 1 張手牌 Holomen；下一步直接按本回合已 Bloom 的 #3期生。", meta: { tags: ["#3期生"] } });
  } else if (number === "hBP02-004") {
    assert(cardHasName(unitCard(player.zones.center, map), "沙花叉クロヱ"), "中央 Holomen 必須是沙花叉クロヱ。 ");
    const revealed = player.mainDeck.splice(0, 3);
    if (revealed.length > 0) enqueueOptionChoice(state, { playerIndex, effect: "oshiTopThreeMode", options: [{ id: "archive", label: "全部放到存檔區" }, { id: "top", label: "自訂次序放回牌庫頂" }], prompt: "ぽえぽえぽえ～：選擇處理全部 3 張牌的方式。", meta: { cards: revealed } });
  } else if (number === "hBP02-006") {
    assert(Number(player.turnsTaken || 0) > 1, "自己的第 1 回合不可 Bloom。 ");
    const candidates = player.archive.filter((instance) => {
      const card = map.get(instance.number);
      return card?.group === "holomem" && ["1st", "2nd"].includes(card.stage) && stageOptionsMatching(player, map, { tags: ["#ID2期生"] }).some((zone) => legalBloomStage(card, unitCard(player.zones[zone], map)) && talentMatches(card, unitCard(player.zones[zone], map)) && Number(player.zones[zone].enteredTurn || 0) !== state.turn && Number(player.zones[zone].bloomedTurn || 0) !== state.turn && Number(card.hp || 0) > Number(player.zones[zone].damage || 0));
    });
    assert(candidates.length > 0, "存檔區沒有可用來 Bloom #ID2期生 的 Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, optional: false, effect: "oshiBloomFromArchiveCard", source: "archive", prompt: "殭屍戰術：揀 1 張存檔區 Holomen；下一步直接按合法 #ID2期生。", meta: { tags: ["#ID2期生"] } });
  } else if (number === "hBP02-007") {
    assert(player.hand.length >= 2, "需要 2 張手牌。 ");
    enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "oshiDiscardForArchiveEn", source: "hand", prompt: "取樣：揀 2 張手牌放到存檔區；之後可揀 2 張 #EN Holomen 返回手牌。" });
  } else if (number === "hBP03-001") {
    queueDeckToHand(state, playerIndex, { typeCodes: ["supportItem", "supportItemLimited"], nameIncludes: ["パソコン", "電腦"] }, map, random, { label: "如果是電腦的話我懂的啦" });
  } else if (["hBP03-002", "hBP04-002"].includes(number)) {
    const targetRule = number === "hBP03-002" ? { zones: BACK_SLOTS, names: ["獅白ぼたん", "獅白牡丹"] } : { tags: ["#ReGLOSS"] };
    enqueueArchiveCheerToTarget(state, playerIndex, { targetRule, optional: false, prompt: `${oshiCard.oshiSkill?.name}：揀 1 張存檔區應援；下一步直接按合法 Holomen。` }, map);
  } else if (number === "hBP03-003") {
    enqueueOptionChoice(state, { playerIndex, options: [{ id: "roll", label: "擲 1 次骰子" }], optional: true, effect: "miko35pRoll", prompt: "35P會回來嗎！？って！：可擲骰，按結果回收 35P。" });
  } else if (number === "hBP03-004") {
    const options = stageOptionsMatching(player, map, { stages: ["1st"], names: ["モココ・アビスガード", "Mococo Abyssgard"] });
    assert(options.length > 0 && player.cheerDeck.length > 0, "舞台沒有 1st モココ・アビスガード，或應援牌庫已空。 ");
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: "モコちゃん！：直接按 1st モココ・アビスガード，附加應援牌庫頂 1 張。" });
  } else if (["hBP03-005", "hBP05-006"].includes(number)) {
    const amount = number === "hBP03-005" ? 20 : 10;
    addMatchingStageModifiers(state, playerIndex, map, { zones: ["center", "collab"], tags: ["#歌"] }, amount, number);
  } else if (number === "hBP03-006") {
    const options = stageOptionsMatching(player, map, { names: ["戌神ころね", "戌神沁音"], rested: true });
    assert(options.length > 0, "舞台沒有休息中的戌神ころね。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "unrest", prompt: "無限的體力：直接按 1 位休息中的戌神ころね，轉為活動狀態。", meta: { infiniteStamina: true } });
  } else if (number === "hBP03-007") {
    queueDeckToHand(state, playerIndex, { typeCodes: ["supportFan"] }, map, random, { label: "Member sheep 歡迎光臨！" });
  } else if (number === "hBP04-001") {
    const options = stageOptionsMatching(player, map, { names: ["博衣こより"], hasAttachmentType: null }).filter((zone) => player.zones[zone].attachments.some((instance) => cardHasTag(map.get(instance.number), "#こよラボ")));
    assert(options.length > 0, "舞台沒有附加 #こよラボ 支援卡的博衣こより。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "こより實驗中：直接按合法博衣こより，本回合 Arts +30。", meta: { kind: "arts", amount: 30, sourceNumber: number } });
  } else if (number === "hBP04-003") {
    assert(cardHasTag(unitCard(player.zones.center, map), "#ReGLOSS") && opponent.zones.collab, "自己的中央須持有 #ReGLOSS，且對手須有合作 Holomen。 ");
    enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "collab", amount: 50, loseLife: true, sourceName: oshiCard.oshiSkill?.name || oshiCard.name, reactionsChecked: false });
  } else if (number === "hBP04-005") {
    addPlayerModifier(player, "threeDiceOverride", 5, state.turn, number);
    appendLog(state, `${player.name} 本回合一次擲 3 顆骰子時，全部點數視為 5。`);
  } else if (number === "hBP04-007") {
    queueDeckAttachmentToStage(state, playerIndex, { nameIncludes: ["古代武器"] }, {}, map, random, "神秘的儀式", { optional: false });
  } else if (number === "hBP05-003") {
    const seats = stageEntries(player).reduce((total, { unit: stageUnit }) => total + stageUnit.attachments.filter((instance) => cardHasName(map.get(instance.number), "座員")).length, 0);
    const drawn = drawCards(state, playerIndex, Math.min(4, Math.max(0, seats - player.hand.length)));
    appendLog(state, `${player.name} 因舞台有 ${seats} 張座員，抽 ${drawn} 張牌。`);
  } else if (number === "hBP05-004") {
    assert(cardHasName(unitCard(player.zones.center, map), "猫又おかゆ"), "中央 Holomen 必須是猫又おかゆ。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, effect: "specialDamage", prompt: "走囉～：直接按對手 1 位 Holomen，造成 10 點特殊傷害。", meta: { amount: 10, loseLife: true, sourceCardNumber: oshiCard.number, sourceName: oshiCard.oshiSkill?.name || oshiCard.name } });
  } else if (number === "hBP05-005") {
    queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#食べ物"] }, map, random, { optional: false, label: "ちょこまみれになっちゃえっ！" });
  } else if (number === "hBP05-007") {
    assert(player.zones.collab && ["Debut", "1st", "Spot"].includes(unitCard(player.zones.collab, map)?.stage), "合作位置必須是 Debut、1st 或 Spot Holomen。 ");
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, names: ["不知火フレア", "不知火芙蕾雅"] });
    assert(options.length > 0, "後排沒有不知火フレア。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "swapCollab", prompt: "直接按後排的不知火フレア，與合作 Holomen 互換。" });
  } else if (number === "hBP06-001") {
    assert(cardHasName(unitCard(player.zones.center, map), "ラオーラ・パンテーラ") && player.zones.collab, "中央必須是ラオーラ・パンテーラ，並且須有合作 Holomen。 ");
    const collabName = unitCard(player.zones.collab, map)?.jpName || unitCard(player.zones.collab, map)?.name;
    queueDeckToHand(state, playerIndex, { group: "holomem", names: [collabName] }, map, random, { label: "BIG CAT means…" });
  } else if (number === "hBP06-002") {
    player.archive.push(...player.mainDeck.splice(0, 2));
    addMatchingStageModifiers(state, playerIndex, map, { zones: ["center", "collab"], tags: ["#FLOW GLOW"] }, 20, number);
  } else if (number === "hBP06-003") {
    const options = stageEntries(player).filter(({ unit: stageUnit }) => cardIsBuzz(unitCard(stageUnit, map)) || (cardHasName(unitCard(stageUnit, map), "風真いろは") && stageUnit.stack.some((instance) => cardIsBuzz(map.get(instance.number))))).map(({ zone }) => zone);
    assert(options.length > 0 && player.cheerDeck.length > 0, "舞台沒有 Buzz，或由 Buzz Bloom 而成的風真いろは；或應援牌庫已空。 ");
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: "猶豫的話就先行動！：直接按合法 Holomen，附加應援牌庫頂 1 張。" });
  } else if (number === "hBP06-004") {
    assert(player.cheerDeck.length > 0, "應援牌庫已空。 ");
    enqueueOptionChoice(state, { playerIndex, effect: "oshiArchiveTopCheer", options: [{ id: "1", label: "存檔頂部 1 張並抽 1" }, { id: "2", label: "存檔頂部 2 張並抽 2", disabled: player.cheerDeck.length < 2 }], prompt: "鬼閻魔：選擇要從應援牌庫頂放入存檔區的張數。" });
  } else if (number === "hBP06-005") {
    assert(player.spOshiSkillUsed, "本場對局尚未使用自己的 SP 推し技能。 ");
    const die = rollDie(random, state, playerIndex, 1, oshiCard); logDie(state, playerIndex, die);
    const drawn = drawCards(state, playerIndex, Math.max(0, die - player.hand.length));
    appendLog(state, `${player.name} 抽 ${drawn} 張，令手牌盡量達到 ${die} 張。`);
  } else if (number === "hBP06-008") {
    const die = rollDie(random, state, playerIndex, 1, oshiCard); logDie(state, playerIndex, die);
    const life = player.life.length;
    if (die >= life) queueDeckToHand(state, playerIndex, {}, map, random, { min: 1, max: 1, optional: false, label: "おまつりわっしょーい！！！" });
    if (die <= life && player.mainDeck.length > 0) {
      const top = player.mainDeck.shift();
      player.holoPower.push(top);
      appendLog(state, `${player.name} 將牌庫頂 1 張卡放到 Holo Power。`);
    }
  } else if (number === "hBP07-001") {
    addMatchingStageModifiers(state, playerIndex, map, { names: ["角巻わため", "角卷綿芽"] }, 100, number);
  } else if (number === "hBP07-002") {
    enqueueStageTarget(state, { playerIndex, effect: "oshiZetaBuff", prompt: "Good Luck, holoh3ro!：直接按自己 1 位 Holomen；一般 +50，#ID3期生 Buzz 改為 +80。" });
  } else if (number === "hBP07-003") {
    const revealed = player.mainDeck.splice(0, 2);
    if (revealed.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, min: 1, max: 1, effect: "oshiTopKeepOne", source: "revealed", prompt: "神札的引導：揀 1 張加入手牌；其餘放回牌庫頂。" });
  } else if (number === "hBP07-004") {
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, stages: ["Debut"], names: ["赤井はあと", "赤井心"] });
    assert(options.length > 0, "後排沒有 Debut 赤井はあと。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiHaatoBottom", prompt: "世界級的最強偶像！：直接按後排 Debut 赤井はあと放到牌庫底；之後再按 1 位赤井はあと。" });
  } else if (number === "hBP07-005") {
    const drawn = player.mainDeck.splice(Math.max(0, player.mainDeck.length - 2), 2);
    player.hand.push(...drawn);
    appendLog(state, `${player.name} 從牌庫底抽 ${drawn.length} 張牌。`);
    if (player.hand.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 1, max: 1, effect: "handToArchive", source: "hand", prompt: "在遺忘之輪上：揀 1 張手牌放到存檔區。" });
  } else if (number === "hBP07-006") {
    assert(wasKnockedOutDuringPreviousOpponentTurn(state, playerIndex), "前一個對手回合中，自己的 Holomen 沒有被擊倒。 ");
    queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"] }, map, random, { min: 1, max: 1, optional: false, label: "出發吧，開拓者。" });
  } else if (number === "hBP07-007") {
    const targets = stageOptionsMatching(player, map, { stages: ["2nd"], tags: ["#5期生"] });
    assert(targets.length > 0 && player.archive.some((instance) => map.get(instance.number)?.group === "cheer"), "舞台沒有 #5期生 2nd，或存檔區沒有應援。 ");
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "nepolaboCheer", meta: { targets }, prompt: "選擇應援附加到下一位 #5期生 2nd。" }, map);
  } else if (number === "hBP08-001") {
    enqueueStageTarget(state, { playerIndex, effect: "oshiIrysBuff", prompt: "尼菲林的祝福：直接按自己 1 位 Holomen；一般 +20，有紫色應援改為 +50。" });
  } else if (number === "hBP08-002") {
    const options = stageOptionsMatching(player, map, { names: ["セシリア・イマーグリーン", "Cecilia Immergreen"], rested: true });
    assert(options.length > 0 && player.cheerDeck.length > 0, "舞台沒有休息中的 Cecilia Immergreen，或應援牌庫已空。 ");
    const cheers = player.cheerDeck.splice(0, Math.min(2, player.cheerDeck.length));
    cheers.forEach((cheer, index) => enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, options, prompt: `SPIN TO WIN!（${index + 1}/${cheers.length}）：直接按一位休息中的 Cecilia 附加應援。`, afterUnrest: true }));
  } else if (number === "hBP08-003") {
    const hasRed = stageHasAnyCheerColor(player, "紅", map);
    const hasBlue = stageHasAnyCheerColor(player, "藍", map);

    if (hasRed) queueArchiveToHand(state, playerIndex, { group: "holomem", tags: ["#Advent"] }, map, { min: 1, max: 1, optional: false, label: "大家的笑容由Mococo來守護！" });
    if (hasBlue && stageOptionsMatching(player, map, { tags: ["#Advent"] }).length) enqueueArchiveCheerToTarget(state, playerIndex, { targetRule: { tags: ["#Advent"] }, optional: false, prompt: "舞台有藍色應援：可揀 1 張存檔區應援；下一步直接按 #Advent Holomen。" }, map);
  } else if (number === "hBP08-004") {
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    addStageModifier(opponent.zones.center, "batonCost", 3, state.turn + 1, number);
  } else if (number === "hBP08-005") {
    assert(player.hand.length >= 2, "需要將 2 張手牌放到存檔區。 ");
    const options = stageOptionsMatching(opponent, map, { zones: ["center", "collab"], excludeStages: ["Debut"] });
    assert(options.length > 0, "對手中央／合作沒有非 Debut Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "oshiLuiDiscardDamage", source: "hand", prompt: "ホイサホイサ：揀 2 張手牌放到存檔區；之後對對手非 Debut 中央與合作各造成 50 點特殊傷害。", meta: { targetPlayerIndex: opponentIndex, options } });
  } else if (number === "hBP08-006") {
    assert(player.holoPower.length > 0 && stageUnitCount(opponent) > 0, "需要最少 1 張 Holo Power，且對手舞台須有 Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: player.holoPower, min: 1, max: player.holoPower.length, effect: "oshiInaPower", source: "holoPower", prompt: "Ina'nis的色彩：揀要存檔的 Holo Power；之後逐一直接按對手 Holomen。" });
  } else if (number === "hEB01-001") {
    assert(Number(player.turnsTaken || 0) > 1, "自己的第 1 回合不可 Bloom。 ");
    const candidates = player.mainDeck.filter((instance) => {
      const card = map.get(instance.number);
      return card?.group === "holomem" && cardHasName(card, "ときのそら") && ["1st", "2nd"].includes(card.stage)
        && stageOptionsMatching(player, map, { names: ["ときのそら"] }).some((zone) => bloomTargets(player, card, map, state.turn).includes(zone));
    });
    assert(candidates.length > 0, "牌庫沒有可讓舞台ときのそら Bloom 的卡。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, effect: "oshiBloomFromDeckCard", source: "deck", prompt: "ロマンスは突然に：揀 1 張牌庫ときのそら；下一步直接按合法目標。", meta: { names: ["ときのそら"], artCostReduction: 1 } });
  } else if (number === "hEB01-002") {
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS, excludeStages: ["Debut"] });
    assert(options.length > 0, "對手後排沒有非 Debut Holomen。 ");
    const times = player.zones.center?.stack.length >= 3 ? 2 : 1;
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "oshiMarineSpecialDamage", prompt: `Uh～ 刺激的すぎたかナ～？（1/${times}）：直接按對手非 Debut 後排，造成 50 點特殊傷害。`, meta: { remaining: times, total: times, amount: 50, loseLife: true, sourceName: oshiCard.oshiSkill?.name || oshiCard.name } });
  } else if (number === "hSD01-001") {
    const options = stageCheerOptions(player, map).filter(() => stageUnitCount(player) > 1);
    assert(options.length > 0, "舞台沒有可改附到另一位 Holomen 的應援。 ");
    enqueueStageCheerSelection(state, { playerIndex, options, effect: "oshiMoveCheerSource", prompt: "替換：先直接按舞台上要移動的實際應援。" });
  } else if (["hSD02-001", "hSD03-001", "hSD04-001", "hSD05-001", "hSD06-001", "hSD07-001", "hSD08-001", "hSD09-001"].includes(number)) {
    assert(player.zones.center && (unitCard(player.zones.center, map)?.colors || []).includes(color), `中央 Holomen 不是${color}色。`);
    addStageModifier(player.zones.center, "arts", 20, state.turn, number);
  } else if (number === "hSD10-001") {
    assert(stageEntries(player).some(({ unit: stageUnit }) => Number(stageUnit.bloomedTurn || 0) === state.turn), "本回合尚未有自己的 Holomen Bloom。 ");
    const options = stageOptionsMatching(player, map, { tags: ["#FLOW GLOW"] });
    assert(options.length > 0, "舞台沒有 #FLOW GLOW Holomen。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "引擎全開！：直接按 1 位 #FLOW GLOW Holomen，本回合 Arts +30。", meta: { kind: "arts", amount: 30, sourceNumber: number } });
  } else if (number === "hSD11-001") {
    const targets = stageOptionsMatching(player, map, { tags: ["#FLOW GLOW"], hasCheer: false });
    const cheers = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    assert(targets.length > 0 && cheers.length > 0, "舞台沒有無應援的 #FLOW GLOW，或存檔區沒有應援。 ");
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "oshiArchiveCheerFixedTarget", prompt: "虎視眈眈：先按 1 位無應援的 #FLOW GLOW；之後揀 1～2 張存檔區應援。", meta: { max: 2 } });
  } else if (number === "hSD12-001") {
    const revealed = player.mainDeck.splice(0, 3);
    const selectableIds = revealed.filter((instance) => map.get(instance.number)?.group === "support").map((instance) => instance.id);
    if (selectableIds.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 1, max: 1, optional: false, effect: "topLookToHand", source: "revealed", prompt: "收藏家：公開 1 張支援卡加入手牌；其餘按次序放到牌庫底。" });
    else queueBottomOrder(state, playerIndex, revealed, "收藏家沒有公開支援卡：按次序放到牌庫底。");
  } else if (number === "hSD12-002") {
    const archived = [];
    for (const [targetPlayerIndex, targetPlayer] of state.players.entries()) if (targetPlayer.cheerDeck.length > 0) { const cheer = targetPlayer.cheerDeck.shift(); targetPlayer.archive.push(cheer); archived.push(cheer); triggerCheerArchivedGift(state, targetPlayerIndex, map, 1); }
    const colors = new Set(archived.flatMap((instance) => map.get(instance.number)?.colors || []));
    appendLog(state, `${player.name} 因 ${colors.size} 種被存檔的應援顏色抽 ${drawCards(state, playerIndex, colors.size)} 張牌。`);
  } else if (number === "hSD13-002") {
    const canSwap = opponent.zones.center && opponent.zones.collab && ["center", "collab"].every(zone => matchingPlayerModifierBonus(opponent, "movementLock", opponent.zones[zone], zone, map, state.turn) === 0);
    if (canSwap) [opponent.zones.center, opponent.zones.collab] = [opponent.zones.collab, opponent.zones.center];
  } else if (number === "hSD14-001") {
    const options = stageOptionsMatching(player, map, { names: ["白上フブキ", "白上吹雪"] }).filter((zone) => player.zones[zone].attachments.some((instance) => map.get(instance.number)?.typeCode === "supportMascot"));

    enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "大家一起上啦～！：直接按合法白上フブキ，本回合 Arts +20。", meta: { kind: "arts", amount: 20, sourceNumber: number } });
  } else if (number === "hSD15-001") {
    queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#きのこ"] }, map, random, { optional: false, label: "稍等一下松茸～♪" });
  } else if (number === "hSD16-001") {
    if (stageEntries(player).some(({ unit: stageUnit }) => stageUnit.attachments.some((instance) => cardHasName(map.get(instance.number), "35P"))))
    appendLog(state, `${player.name} 因 35P 抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  } else if (number === "hSD17-001") {
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, prompt: "幹勁滿滿地加油囉ーー!!!：直接按自己 1 位 Holomen，附加應援牌庫頂 1 張。" });
  } else if (number === "hSD18-001") {
    const archived = player.mainDeck.splice(0, 2);
    player.archive.push(...archived);
    currentTurnEvents(player, state.turn).deckArchived += archived.length;
    appendLog(state, `${player.name} 將牌庫頂 ${archived.length} 張放到存檔區，再抽 ${drawCards(state, playerIndex, 1)} 張牌。`);
  } else if (["hYS01-001", "hYS01-002", "hYS01-003", "hYS01-004"].includes(number)) {
    assert(player.zones.collab && (unitCard(player.zones.collab, map)?.colors || []).includes(color), `合作 Holomen 不是${color}色。`);
    addStageModifier(player.zones.collab, "arts", 20, state.turn, number);
  } else {
    throw new Error(`「${oshiCard.oshiSkill?.name || oshiCard.name}」尚未接入可主動使用的推し技能結算。`);
  }
}

function resolveSpOshiSkill(state, playerIndex, oshiCard, map, random) {
  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];
  const number = oshiCard.number;
  const text = oshiCard.spOshiSkill?.effect || "";
  const color = skillColor(text) || oshiCard.colors?.[0] || "";

  if (number.startsWith("hBD24-")) {
    queueDeckToHand(state, playerIndex, { group: "holomem", colors: [color] }, map, random, { min: 1, max: 1, optional: false, label: oshiCard.spOshiSkill?.name || "Birthday Gift" });
  } else if (number === "hBP01-001") {
    enqueueStageTarget(state, { playerIndex, effect: "oshiKanataSpBuff", prompt: "握りつぶしちゃうぞ：直接按自己 1 位 Holomen；Arts +50，若為白色再 +50。" });
  } else if (number === "hBP01-002") {
    queueDeckToHand(state, playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"] }, map, random, { min: 1, max: 1, optional: false, label: "Amazin・Drawing" });
  } else if (number === "hBP01-003") {
    const center = player.zones.center;
    assert(center && (unitCard(center, map)?.colors || []).includes("綠"), "自己的中央 Holomen 必須是綠色。 ");
    const healed = healStageUnit(state, playerIndex, "center", Number.MAX_SAFE_INTEGER, map);
    appendLog(state, player.name + " 的綠色中央 Holomen 回復 " + healed + " HP。");
  } else if (number === "hBP01-004") {
    addPlayerModifier(player, "dieOverride", 6, state.turn, number);
  } else if (number === "hBP01-005") {
    addPlayerModifier(opponent, "movementLock", 1, Number.MAX_SAFE_INTEGER, number, { zones: ["center", "collab"] });
    opponent.modifiers.at(-1).waitingForOwnerTurn = true;
  } else if (number === "hBP01-008") {
    const cheers = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    assert(cheers.length > 0 && stageOptionsMatching(player, map, { tags: ["#ID"] }).length > 0, "存檔區沒有應援，或舞台沒有 #ID Holomen。 ");
    enqueueCardSelection(state, { playerIndex, cards: cheers, min: 1, max: Math.min(5, cheers.length), effect: "oshiArchiveCheerDistribute", source: "archive", prompt: "祈雨：揀 1～5 張存檔區應援；之後逐張直接按 #ID Holomen。", meta: { targetRule: { tags: ["#ID"] } } });
  } else if (number === "hBP02-002") {
    stageEntries(player).forEach(({ zone, unit: stageUnit }) => {
      const card = unitCard(stageUnit, map);
      if (!cardHasTag(card, "#ID2期生")) return;
      const colors = new Set(stageCheerColors(player, stageUnit, map));
      addStageModifier(stageUnit, "arts", colors.size * 20, state.turn, number);
      appendLog(state, (card?.name || zone) + " 有 " + colors.size + " 種應援顏色，本回合 Arts +" + (colors.size * 20) + "。");
    });
  } else if (number === "hBP02-003") {
    assert(player.zones.center, "自己沒有中央 Holomen。 ");
    assert(cardHasName(unitCard(player.zones.center, map), "宝鐘マリン"), "中央 Holomen 必須是宝鐘マリン。");
    const amount = player.zones.center.stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem").length * 50;
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "出航～！：直接按對手中央或合作 Holomen，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name } });
  } else if (number === "hBP02-004") {
    const handCount = player.hand.length;
    const returned = [...player.hand, ...player.archive.filter((instance) => map.get(instance.number)?.group === "holomem")];
    player.hand = [];
    player.archive = player.archive.filter((instance) => map.get(instance.number)?.group !== "holomem");
    player.mainDeck = shuffle([...player.mainDeck, ...returned], random);
    appendLog(state, player.name + " 將全部手牌及存檔區 Holomen 共 " + returned.length + " 張洗回牌庫，再抽 " + drawCards(state, playerIndex, handCount) + " 張。");
  } else if (number === "hBP02-006") {
    appendLog(state, player.name + " 先抽 " + drawCards(state, playerIndex, 4) + " 張牌。");
    assert(player.hand.length >= 2, "抽牌後仍不足 2 張手牌可存檔。 ");
    enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "oshiOllieDiscard", source: "hand", prompt: "復甦的オリー：揀 2 張手牌放到存檔區；之後可從存檔區 Bloom。" });
  } else if (number === "hBP02-007") {
    assert(cardHasName(unitCard(player.zones.center, map), "森カリオペ"), "自己的中央 Holomen 必須是森カリオペ。 ");
    enqueueStageTarget(state, { playerIndex, options: stageOptionsMatching(player, map, { names: ["森カリオペ", "Mori Calliope"] }), effect: "oshiRepeatArts", prompt: "死神說唱：直接按 1 位森カリオペ；本回合可再使用一次相同 Arts。" });
  } else if (number === "hBP03-001") {
    assert(cardHasName(unitCard(player.zones.center, map), "姫森ルーナ"), "中央 Holomen 必須是姫森ルーナ。 ");
    const candidates = player.mainDeck.filter((instance) => cardHasName(map.get(instance.number), "ルーナイト"));
    assert(candidates.length > 0, "牌庫沒有ルーナイト。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(4, candidates.length), effect: "deckSupportsToAttach", source: "deck", prompt: "ルーナイト集合：揀 1～4 張ルーナイト；之後逐張直接按合法 Holomen。", meta: { targetRule: {} } });
  } else if (number === "hBP03-002") {
    assert(player.zones.center && (unitCard(player.zones.center, map)?.colors || []).includes("綠"), "自己的中央 Holomen 必須是綠色。 ");
    assert(opponent.zones.center && unitCard(opponent.zones.center, map)?.stage !== "Debut", "對手中央必須是非 Debut Holomen。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options: ["center"], effect: "specialDamage", prompt: "狙撃：直接按對手非 Debut 中央 Holomen，造成 100 點特殊傷害。", meta: { amount: 100, loseLife: true, sourceCardNumber: oshiCard.number, sourceName: oshiCard.spOshiSkill?.name || "狙撃" } });
  } else if (number === "hBP03-003") {
    assert(player.zones.center && (unitCard(player.zones.center, map)?.colors || []).includes("紅"), "中央 Holomen 必須是紅色。 ");
    if (player.hand.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 0, max: player.hand.length, optional: true, effect: "handToBottomThenDrawFive", source: "hand", prompt: "不放棄的心にぇ：揀任意張手牌按選擇次序放到牌庫底，再抽到 5 張。" });
    else appendLog(state, player.name + " 抽 " + drawCards(state, playerIndex, 5) + " 張至 5 張手牌。");
  } else if (number === "hBP03-004") {
    const options = stageOptionsMatching(player, map, { tags: ["#Advent"] });
    assert(options.length > 0, "舞台沒有 #Advent Holomen。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiAttackBack", prompt: "BAU BAU!：直接按 1 位 #Advent Holomen，本回合 Arts 可指定對手後排。" });
  } else if (number === "hBP03-007") {
    const options = stageOptionsMatching(player, map, { names: ["角巻わため", "角卷綿芽"] });
    assert(options.length > 0 && player.cheerDeck.length > 0, "舞台沒有角巻わため，或應援牌庫已空。 ");
    const cheers = player.cheerDeck.splice(0, Math.min(2, player.cheerDeck.length));
    cheers.forEach((cheer, index) => enqueueEffect(state, { type: "eventCheerTarget", playerIndex, cheerCard: cheer, options, prompt: "わため沒有錯對吧？（" + (index + 1) + "/" + cheers.length + "）：直接按角巻わため附加應援。" }));
  } else if (number === "hBP03-008") {
    addMatchingStageModifiers(state, playerIndex, map, { names: ["アユンダ・リス", "Ayunda Risu"] }, 50, number);
  } else if (number === "hBP04-002") {
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "support" && cardHasTag(map.get(instance.number), "#きのこ"));
    assert(candidates.length > 0, "存檔區沒有 #きのこ 活動卡。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(4, candidates.length), effect: "oshiMushroomReturn", source: "archive", prompt: "用剩下的時間轉圈圈：揀 1～4 張 #きのこ 活動卡返回手牌，每 2 張再抽 1。" });
  } else if (number === "hBP04-004") {
    const options = stageOptionsMatching(player, map, { names: ["雪花ラミィ", "雪花菈米"] });
    assert(options.length > 0, "舞台沒有雪花ラミィ。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiLamySp", prompt: "直接按 1 位雪花ラミィ：本回合特殊傷害 +100，特殊傷害擊倒時抽 2。" });
  } else if (number === "hBP04-005") {
    const options = stageOptionsMatching(player, map, { tags: ["#秘密結社holoX"] });
    assert(options.length > 0, "舞台沒有 #秘密結社holoX Holomen。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiFreeArts", prompt: "直接按 1 位 #秘密結社holoX Holomen，本回合 Arts 不需應援。" });
  } else if (number === "hBP04-006") {
    assert(player.life.length <= 3 && player.zones.center && cardHasName(unitCard(player.zones.center, map), "大空スバル"), "生命須為 3 或以下，且中央須是大空スバル。 ");
    addStageModifier(player.zones.center, "arts", 100, state.turn, number);
  } else if (number === "hBP04-007") {
    const targets = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.attachments.some((instance) => cardHasName(map.get(instance.number), "古代武器"))).map(({ zone }) => zone);
    assert(targets.length > 0, "舞台沒有附加古代武器的 Holomen。 ");
    enqueueArchiveCheerToTarget(state, playerIndex, { optional: false, effect: "ancientWeaponCheer", meta: { targets }, prompt: "古代武器：揀 1 張存檔區應援附加到持有者。" }, map);
  } else if (number === "hBP05-002") {
    const cheerOptions = stageCheerOptions(player, map);
    assert(cheerOptions.length >= 2, "舞台上不足 2 張應援可支付。 ");
    enqueueStageCheerSelection(state, { playerIndex, options: cheerOptions, effect: "oshiIofiCheerCost", prompt: "Kekuatan Iofi：直接按第 1 張舞台應援放到存檔區。", meta: { remaining: 2 } });
  } else if (number === "hBP05-003") {
    const revealed = player.mainDeck.splice(0, 7);
    const selectableIds = revealed.filter((instance) => cardHasName(map.get(instance.number), "尾丸ポルカ")).map((instance) => instance.id);
    if (selectableIds.length > 0) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds, min: 1, max: 1, optional: false, effect: "oshiPolkaPick", source: "revealed", prompt: "成功體驗－！！！：公開 1 張尾丸ポルカ；之後公開 1 張工作人員。" });
    else {
      const staffIds = revealed.filter(instance => String(map.get(instance.number)?.typeCode || "").includes("Staff")).map(instance => instance.id);
      if (staffIds.length) enqueueCardSelection(state, { playerIndex, cards: revealed, selectableIds: staffIds, min: 1, max: 1, optional: false, effect: "oshiStaffPick", source: "revealed", prompt: "成功體驗－！！！：公開 1 張工作人員；餘下卡放到存檔區。" });
      else player.archive.push(...revealed);
    }
  } else if (number === "hBP05-004") {
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS, damaged: true });
    assert(options.length > 0, "對手後排沒有已受傷 Holomen。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "oshiOkayuSwap", prompt: "好吃好吃！：直接按對手 1 位已受傷後排，與中央互換。" });
  } else if (number === "hBP05-005") {
    const candidates = player.archive.filter((instance) => map.get(instance.number)?.group === "support" && cardHasTag(map.get(instance.number), "#食べ物"));
    assert(candidates.length > 0, "存檔區沒有 #食べ物 事件卡。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: Math.min(4, candidates.length), effect: "oshiFoodReturn", source: "archive", prompt: "ちょこっとクッキング：揀 1～4 張 #食べ物 事件返回手牌；所有 #料理 本回合 Arts +40。" });
  } else if (number === "hBP05-006") {
    addPlayerModifier(player, "artCost", -1, Number.MAX_SAFE_INTEGER, number, { names: ["ネリッサ・レイヴンクロフト", "Nerissa Ravencroft"] });
  } else if (number === "hBP05-007") {
    const options = stageOptionsMatching(player, map, { names: ["不知火フレア", "不知火芙蕾雅"] });
    assert(options.length > 0 && totalCheer(player) > 0, "舞台沒有不知火フレア，或舞台沒有應援。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiFlareCheerTarget", prompt: "大家一起嗨起來！：先按 1 位不知火フレア；之後直接按 1～5 張舞台應援改附。" });
  } else if (number === "hBP06-001") {
    addPlayerModifier(player, "raoraReset", 1, Number.MAX_SAFE_INTEGER, number);
  } else if (number === "hBP06-003") {
    const amount = totalCheer(player) * 10;
    addMatchingStageModifiers(state, playerIndex, map, { names: ["風真いろは", "風真伊呂波"] }, amount, number);
    if (stageEntries(player).some(({ unit: stageUnit }) => cardIsBuzz(unitCard(stageUnit, map)))) appendLog(state, player.name + " 因舞台有 Buzz 再抽 " + drawCards(state, playerIndex, 3) + " 張牌。");
  } else if (number === "hBP06-004") {
    const amount = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" && (map.get(instance.number)?.colors || []).includes("紅")).length * 20;
    assert(amount > 0, "存檔區沒有紅色應援。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: ["center", "collab"] }, effect: "specialDamage", prompt: "二刀一閃！：直接按對手中央或合作，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name } });
  } else if (number === "hBP06-005") {
    const die = rollDie(random, state, playerIndex, 1, oshiCard); logDie(state, playerIndex, die);
    assert(player.hand.length >= die, "手牌不足 " + die + " 張可存檔。");
    if (die > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: die, max: die, effect: "handToArchive", source: "hand", prompt: "骰子為 " + die + "：揀相同張數手牌放到存檔區。" });
  } else if (number === "hBP06-006") {
    assert(totalCheer(player) + totalCheer(opponent) >= 6, "雙方舞台應援合計不足 6 張。 ");
    const targets = stageOptionsMatching(player, map, { tags: ["#ID1期生"] });
    assert(targets.length > 0 && player.cheerDeck.length > 0, "舞台沒有 #ID1期生，或應援牌庫已空。 ");
    enqueueCardSelection(state, { playerIndex, cards: [...player.cheerDeck], min: 1, max: Math.min(3, player.cheerDeck.length), effect: "oshiCheerDeckDistribute", source: "cheerDeck", prompt: "雙月的齊唱：公開 1～3 張應援；之後逐張直接按 #ID1期生。", meta: { targetRule: { tags: ["#ID1期生"] } } });
  } else if (number === "hBP06-007") {
    appendLog(state, `${player.name} 先抽 ${drawCards(state, playerIndex, 2)} 張牌。`);
    assert(player.hand.length >= 2, "抽牌後仍不足 2 張手牌可存檔。 ");
    enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 2, max: 2, effect: "oshiRobocoDiscard", source: "hand", prompt: "高性能：揀 2 張手牌存檔；之後可揀任意張ろぼさー附加到ロボ子さん。" });
  } else if (number === "hBP06-008") {
    assert(cardHasName(unitCard(player.zones.center, map), "夏色まつり"), "中央 Holomen 必須是夏色まつり。");
    player.limitedAllowanceTurn = state.turn;
    player.limitedAllowance = 2;
  } else if (number === "hBP07-002") {
    const options = stageOptionsMatching(player, map, { tags: ["#ID3期生"] });
    const supports = player.archive.filter((instance) => ["supportMascot", "supportFan"].includes(map.get(instance.number)?.typeCode));
    assert(options.length > 0 && supports.length > 0, "舞台沒有 #ID3期生，或存檔區沒有吉祥物／粉絲。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiZetaAttachTarget", prompt: "沒有什麼是不可能的！：先按 1 位 #ID3期生；之後揀任意張吉祥物／粉絲附加。" });
  } else if (number === "hBP07-003") {
    const revealed = player.mainDeck.splice(0, 6);
    assert(revealed.length >= 3, "牌庫不足 3 張可選。 ");
    enqueueCardSelection(state, { playerIndex, cards: revealed, min: 3, max: 3, effect: "oshiMioTopSix", source: "revealed", prompt: "大家的媽媽：揀 3 張加入手牌；其餘按次序放回牌庫頂。" });
  } else if (number === "hBP07-005") {
    assert(player.zones.center && unitCard(player.zones.center, map)?.stage === "2nd" && cardHasName(unitCard(player.zones.center, map), "オーロ・クロニー"), "中央必須是 2nd オーロ・クロニー。 ");
    player.extraTurnPending = Number(player.extraTurnPending || 0) + 1;
  } else if (number === "hBP07-007") {
    queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["Debut"], names: ["桃鈴ねね", "桃鈴音音"] }, map, random, { min: 1, max: 4, optional: true, label: "ねねち的大・暴・走！" });
  } else if (number === "hBP08-001") {
    const units = stageEntries(player).filter(({ unit: stageUnit }) => cardHasName(unitCard(stageUnit, map), "IRyS")).map(({ unit: stageUnit }) => stageUnit);
    assert(units.length > 0, "舞台沒有 IRyS。 ");
    const cheers = units.reduce((sum, stageUnit) => sum + stageUnit.cheer.length, 0);
    const purple = units.reduce((sum, stageUnit) => sum + stageUnit.cheer.filter((instance) => effectiveCheerColors(player, stageUnit, instance, map).includes("紫")).length, 0);
    appendLog(state, player.name + " 因 IRyS 應援抽 " + drawCards(state, playerIndex, cheers) + " 張牌。");
    for (let index = 0; index < purple && player.mainDeck.length > 0; index += 1) player.holoPower.push(player.mainDeck.shift());
  } else if (number === "hBP08-004") {
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    const amount = Number(opponent.zones.center.damage || 0);
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
    assert(options.length > 0, "對手沒有後排 Holomen。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: "衝啊衝啊！：直接按對手後排，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name } });
  } else if (number === "hBP08-007") {
    assert(player.zones.center && cardHasName(unitCard(player.zones.center, map), "音乃瀬奏"), "中央 Holomen 必須是音乃瀬奏。 ");
    const cheers = player.cheerDeck.splice(0, Math.min(3, player.cheerDeck.length));
    attachCheerCards(state, player.zones.center, cheers);
    addPlayerModifier(player, "archiveCheerAtEnd", 3, state.turn, number);
    appendLog(state, `${player.name} 將應援牌庫頂 ${cheers.length} 張附加到中央音乃瀬奏；回合結束時須存檔舞台 3 張應援。`);
  } else if (number === "hSD01-001") {
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS });
    assert(options.length > 0, "對手沒有後排 Holomen。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "oshiStarterSwap", prompt: "那就是敵人了？：直接按對手後排與中央互換；之後白色中央 Arts +50。" });
  } else if (number === "hSD01-002") {
    const targets = stageOptionsMatching(player, map, { colors: ["綠"] });
    const cheers = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
    assert(targets.length > 0, "舞台沒有綠色 Holomen。 ");
    enqueueStageTarget(state, { playerIndex, options: targets, effect: "oshiArchiveCheerFixedTarget", prompt: "右手握著麥克風：先按 1 位綠色 Holomen；之後揀任意張存檔區應援。", meta: { max: cheers.length, min: 0 } });
  } else if (["hSD02-001", "hSD09-001", "hYS01-003"].includes(number)) {
    queueArchiveToHand(state, playerIndex, { group: "holomem", colors: ["紅"] }, map, { optional: !["hSD02-001", "hSD09-001"].includes(number), label: oshiCard.spOshiSkill?.name || "SP 推し技能" });
  } else if (number === "hSD04-001") {
    appendLog(state, player.name + " 抽 " + drawCards(state, playerIndex, 2) + " 張牌。");
    if (player.hand.length > 0) enqueueCardSelection(state, { playerIndex, cards: player.hand, min: 1, max: 1, effect: "handToArchive", source: "hand", prompt: "卡片更換：揀 1 張手牌放到存檔區。" });
  } else if (["hSD06-001", "hYS01-002"].includes(number)) {
    stageOptionsMatching(player, map, { colors: ["綠"], damaged: true }).forEach((zone) => healStageUnit(state, playerIndex, zone, 20, map));
  } else if (number === "hSD07-001") {
    assert(player.zones.center, "自己沒有中央 Holomen。 ");
    const options = stageOptionsMatching(player, map, { zones: BACK_SLOTS, rested: false });
    assert(options.length > 0, "後排沒有活動狀態 Holomen。 ");
    enqueueStageTarget(state, { playerIndex, options, effect: "oshiStarterOwnSwap", prompt: "後は引き受けた！：直接按活動後排與中央互換；移到後排的 Holomen 回復 30 HP。" });
  } else if (number === "hSD10-001") {
    assert(player.cheerDeck.length > 0 && stageUnitCount(player) > 0, "應援牌庫已空或舞台沒有 Holomen。 ");
    assert(stageOptionsMatching(player, map, { tags: ["#FLOW GLOW"] }).length > 0, "舞台沒有可選擇的 #FLOW GLOW Holomen。");
    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, prompt: "先直接按 1 位 Holomen，附加應援牌庫頂 1 張。", afterEffect: "oshiFlowGlowCheerBuff" });
  } else if (number === "hSD12-001") {
    const amount = player.archive.filter((instance) => map.get(instance.number)?.group === "support").length * 10;
    const options = stageOptionsMatching(opponent, map, { zones: BACK_SLOTS, excludeStages: ["Debut"] });
    assert(options.length > 0, "對手後排沒有非 Debut Holomen。 ");
    enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, options, effect: "specialDamage", prompt: "反叛：直接按對手非 Debut 後排，造成 " + amount + " 點特殊傷害。", meta: { amount, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name } });
  } else if (number === "hSD12-002") {
    assert(opponent.zones.center, "對手沒有中央 Holomen。 ");
    const amount = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer" || (map.get(instance.number)?.group === "holomem" && cardHasTag(map.get(instance.number), "#Advent"))).length * 10;
    enqueueEffect(state, { type: "specialDamage", playerIndex, targetPlayerIndex: opponentIndex, targetZone: "center", amount, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name, reactionsChecked: false });
  } else if (number === "hSD13-001") {

    queueArchiveCardsToStage(state, playerIndex, { group: "holomem", tags: ["#Justice"] }, map, { min: 1, max: 1, optional: false, label: "JUST LIKE THAT", afterEffect: "oshiJusticeCheer" });
  } else if (number === "hSD13-002") {
    queueDeckCardsToStage(state, playerIndex, { group: "holomem", stages: ["2nd"], names: ["ジジ・ムリン", "Gigi Murin"] }, map, random, { min: 2, max: 2, optional: false, label: "自由奔放的『追跡者』", afterEffect: "oshiCheerEveryHolomem" });
  } else if (number === "hSD14-001") {
    queueDeckToHand(state, playerIndex, { typeCodes: ["supportMascot"] }, map, random, { min: 1, max: 2, optional: false, label: "Mascots，集合！！" });
  } else if (number === "hSD15-001") {
    const options = stageOptionsMatching(player, map, { names: ["儒烏風亭らでん", "儒烏風亭螺鈿"] });

    enqueueEffect(state, { type: "eventCheerTarget", playerIndex, options, prompt: "去擴展你的世界吧：直接按儒烏風亭らでん附加應援牌庫頂 1 張。" });
    enqueueEffect(state, { type: "oshiMushroomArchiveReturn", playerIndex });
  } else if (number === "hSD16-001") {
    const options = stageOptionsMatching(player, map, { names: ["さくらみこ", "櫻巫女"] }).filter((zone) => player.zones[zone].attachments.some((instance) => map.get(instance.number)?.typeCode === "supportFan"));

    enqueueStageTarget(state, { playerIndex, options, effect: "addModifier", prompt: "35P出發囉！：直接按合法さくらみこ，本回合 Arts +50。", meta: { kind: "arts", amount: 50, sourceNumber: number } });
  } else if (number === "hSD17-001") {
    if (cardHasName(unitCard(player.zones.center, map), "星街すいせい")) enqueueStageTarget(state, { playerIndex, targetPlayerIndex: opponentIndex, rule: { zones: BACK_SLOTS }, effect: "specialDamage", prompt: "流星：直接按對手後排，造成 50 點特殊傷害。", meta: { amount: 50, loseLife: true, sourceName: oshiCard.spOshiSkill?.name || oshiCard.name } });
  } else if (number === "hSD18-001") {
    if (player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length >= 6) addMatchingStageModifiers(state, playerIndex, map, { names: ["森カリオペ", "Mori Calliope"] }, 30, number);
  } else if (number === "hSD19-001") {
    const targetRule = { names: ["大空スバル", "大空昴"] };
    const targets = stageOptionsMatching(player, map, targetRule);
    if (targets.length > 0) enqueueArchiveCheerToTarget(state, playerIndex, { min: 1, max: Math.min(2, targets.length), targetRule, optional: false, prompt: "散步的Subaru：選擇 1–2 張存檔區應援，分別附加到自己不同的 Subaru。", meta: { maxCheerFromEffect: 1, effectBatch: `${number}:sp:${state.turn}` } }, map);
  } else {
    throw new Error("「" + (oshiCard.spOshiSkill?.name || oshiCard.name) + "」尚未接入可主動使用的 SP 推し技能結算。");
  }
}

function activateOshiSkill(state, playerIndex, map, random, kind = "oshi") {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段使用推し技能。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];
  const oshiCard = map.get(player.oshi?.number);
  const skill = kind === "sp" ? oshiCard?.spOshiSkill : oshiCard?.oshiSkill || (oshiCard?.number === KOYORI_OSHI ? { timing: "Holo Power -2", name: "解析完了！", effect: "展示並解析牌庫頂卡。" } : null);
  assert(skill?.effect, "這張推し Holomen 沒有這個技能。 ");
  assert(!isReactiveOshiSkill(oshiCard.number, kind), "這是反應式推し技能，系統只會在合法觸發時顯示。 ");
  if (kind === "sp") assert(!player.spOshiSkillUsed, "本場對局已使用過 SP 推し技能。 ");
  else assert(Number(player.oshiSkillTurn || 0) !== state.turn, "本回合已使用過推し技能。 ");
  const mocoReduction = kind === "oshi" && /モコちゃん/u.test(String(skill.name || "")) && unitCard(player.zones.collab, map)?.number === "hBP08-060" ? 1 : 0;
  const cost = Math.max(0, oshiPowerCost(skill, oshiCard.number, kind) - mocoReduction);
  assert(player.holoPower.length >= cost, `Holo Power 不足，這個推し技能需要 ${cost}。 `);
  if (cost > 0) player.archive.push(...player.holoPower.splice(-cost).reverse());
  if (kind === "sp") {
    player.spOshiSkillUsed = true;
    resolveSpOshiSkill(state, playerIndex, oshiCard, map, random);
  } else {
    player.oshiSkillTurn = state.turn;
    resolveNormalOshiSkill(state, playerIndex, oshiCard, map, random);
  }
  queueGiftOshiSkillEffects(state, playerIndex, skill, kind, map);
  appendLog(state, `${player.name}${cost ? ` 支付 ${cost} Holo Power` : ""}使用${kind === "sp" ? " SP" : ""} 推し技能「${skill.name || oshiCard.name}」。`);
}

function activateAttachmentSkill(state, playerIndex, action, map) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段使用附加卡技能。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];
  const source = player.zones[action.zone];
  const sourceCard = unitCard(source, map);
  const requestedNumber = action.cardNumber || (source?.attachments?.some((instance) => instance.number === "hBP04-097") ? "hBP04-097" : source?.attachments?.find((instance) => instance.number === "hBP02-092")?.number);
  if (requestedNumber === "hBP02-092") {
    const attachment = source?.attachments?.find((instance) => instance.number === "hBP02-092");
    assert(source && attachment, "所選 Holomen 沒有附加 Fubura。 ");
    assert(cardHasName(sourceCard, "白上フブキ"), "Fubura 的追加技能只可由白上フブキ使用。 ");
    const usageKey = `attachment:hBP02-092:${attachment.id}`;
    assert(!usedNamedThisTurn(player, usageKey, state.turn), "Fubura 的每回合 1 次技能本回合已使用。 ");
    assert(source.cheer.length >= 2, "Fubura 需要將同一位 Holomen 的 2 張應援放到存檔區。 ");
    const options = source.cheer.map((cheer) => ({ id: cheer.id, number: cheer.number, zone: action.zone }));
    enqueueStageCheerSelection(state, { playerIndex, options, effect: "fuburaCheerCost", optional: true, prompt: "Fubura：按這位 Holomen 的第 1 張應援開始支付；亦可略過取消。", meta: { sourceZone: action.zone, sourceId: topCard(source).id, attachmentId: attachment.id, usageKey, remaining: 2 } });
    return;
  }
  assert(source && source.attachments?.some((instance) => instance.number === "hBP04-097"), "所選 Holomen 沒有附加「綠色試管」。 ");
  assert(isKoyoriCard(sourceCard) && ["1st", "2nd"].includes(sourceCard.stage), "「綠色試管」追加技能只可由 1st 以上的博衣こより使用。 ");
  assert(source.cheer.length > 0, "需要將該 Holomen 的 1 張應援放到存檔區。 ");
  const targetOptions = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.rested && cardHasTag(map.get(topCard(stageUnit)?.number), "#秘密結社holoX")).map(({ zone }) => zone);
  assert(targetOptions.length > 0, "舞台上沒有休息中的 #秘密結社holoX Holomen。 ");
  state.pendingChoice = { type: "archiveCheerForSkill", playerIndex, sourceZone: action.zone, options: source.cheer.map((cheer) => cheer.id), cheerOptions: source.cheer.map((cheer) => ({ id: cheer.id, number: cheer.number, zone: action.zone })), targetOptions, optional: true, prompt: "綠色試管：按該 Holomen 身上 1 張應援放到存檔區；亦可略過取消。" };
}

function activateGiftSkill(state, playerIndex, action, map, random) {
  assert(state.status === "playing" && state.activePlayer === playerIndex && state.phase === "main", "只能在自己的主要階段使用 Gift。 ");
  assert(!state.pendingChoice, "請先完成目前的選擇。 ");
  const player = state.players[playerIndex];

  if (action.cardNumber === "hBP08-044" && !action.zone) {
    assert(Number(player.turnsTaken || 0) > 1, "自己的第 1 回合不可 Bloom。 ");
    assert(player.archive.filter((instance) => map.get(instance.number)?.group === "holomem").length >= 10, "存檔區需要最少 10 張 Holomen。 ");
    const candidates = player.archive.filter((instance) => instance.number === "hBP08-044" && bloomTargets(player, map.get(instance.number), map, state.turn).length > 0);
    assert(candidates.length > 0, "存檔區沒有可用此 Gift 進行 Bloom 的小鳥遊キアラ。 ");
    enqueueCardSelection(state, { playerIndex, cards: candidates, min: 1, max: 1, effect: "giftArchiveBloomCard", source: "archive", prompt: "光，再次點亮：揀存檔區 1 張小鳥遊キアラ；下一步直接按牌桌 Bloom 目標。" });
    return;
  }

  const source = player.zones[action.zone];
  const card = unitCard(source, map);
  assert(source && card, "Gift 來源已離開舞台。 ");
  const usageKey = card.number === "hSD13-013" ? `gift:${card.number}:${topCard(source).id}` : `gift:${card.number}`;
  assert(!usedNamedThisTurn(player, usageKey, state.turn), "這個每回合 1 次 Gift 本回合已使用。 ");
  if (card.number === "hSD10-004") {
    assert(cardHasName(map.get(player.oshi?.number), "輪堂千速"), "「有300匹馬力喔！」需要自己的推し Holomen 為輪堂千速。 ");
    assert(stageEntries(state.players[playerIndex === 0 ? 1 : 0]).some(({ unit: stageUnit }) => unitCard(stageUnit, map)?.stage === "1st"), "對手舞台上需要 1 位 1st Holomen。 ");
    assert(card.stage === "1st" && Number(source.bloomedTurn || 0) === state.turn, "只有本回合已 Bloom 的 1st 輪堂千速可使用此 Gift。 ");
    player.bonusBloomTurn = state.turn;
    player.bonusBloomUsedTurn = 0;
    player.bonusBloomTargetId = topCard(source)?.id || "";
    const cards = player.hand.filter((instance) => map.get(instance.number)?.stage === "2nd" && bloomTargets(player, map.get(instance.number), map, state.turn).includes(action.zone));
    assert(cards.length > 0, "手牌沒有可由此 Gift 讓該輪堂千速再 Bloom 的 2nd Holomen。 ");
    markNamedUsage(player, usageKey, state.turn);
    enqueueCardSelection(state, { playerIndex, cards, min: 0, max: 1, optional: true, effect: "bonusBloomCard", source: "hand", prompt: "有300匹馬力喔！：可揀手牌 1 張 2nd Holomen，再直接按這位本回合 Bloom 的輪堂千速完成再次 Bloom。" });
  } else if (card.number === "hBP01-045") {
    assert(player.life.length <= 3, "Overwrite 只可在生命 3 或以下時使用。 ");
    assert(Number(player.turnsTaken || 0) > 1, "自己的第 1 回合不可 Bloom。 ");
    assert(Number(source.enteredTurn || 0) !== state.turn && Number(source.bloomedTurn || 0) !== state.turn, "本回合才登場或已 Bloom 的 AZKi 不可再 Bloom。 ");
    const cards = player.hand.filter((instance) => map.get(instance.number)?.stage === "2nd" && cardHasName(map.get(instance.number), "AZKi") && Number(map.get(instance.number)?.hp || 0) > Number(source.damage || 0));
    assert(cards.length > 0, "手牌沒有可用 Overwrite 的 2nd AZKi。 ");
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, effect: "giftOverwriteCard", source: "hand", prompt: "Overwrite：揀手牌 1 張 2nd AZKi；下一步直接按牌桌上的 Gift 來源。", meta: { sourceZone: action.zone } });
  } else if (card.number === "hBP03-030") {
    assert(action.zone === "center" && source.attachments.some((instance) => cardHasName(map.get(instance.number), "35P")), "精英賭博只可由附有 35P 的中央 Holomen 使用。 ");
    markNamedUsage(player, usageKey, state.turn);
    const die = rollDie(random, state, playerIndex, 1, card); logDie(state, playerIndex, die, "因精英賭博擲骰");
    if ([3, 5].includes(die)) addStageModifier(source, "arts", 50, state.turn, card.number);
    appendLog(state, `${player.name} 的精英賭博${[3, 5].includes(die) ? "成功，本回合 Arts +50" : "未成功"}。`);
  } else if (card.number === "hBP06-070") {
    assert(action.zone === "center", "Wonder Viking 只可在中央位置使用。 ");
    const options = stageAttachmentOptions(player, map, (instance, attachment) => cardHasName(attachment, "ゆび"));
    assert(options.length > 0, "自己舞台上沒有〈ゆび〉可放回牌庫底。 ");
    enqueueStageAttachmentSelection(state, { playerIndex, options, effect: "giftYubiCost", prompt: "Wonder Viking：直接按舞台上的實際〈ゆび〉放回牌庫底。", meta: { sourceZone: action.zone } });
  } else if (card.number === "hBP07-080") {
    assert(cardHasName(map.get(player.oshi?.number), "桃鈴ねね"), "自己的推し Holomen 必須是桃鈴ねね。 ");
    const cards = player.archive.filter((instance) => cardHasName(map.get(instance.number), "ねっ子"));
    assert(cards.length > 0, "存檔區沒有〈ねっ子〉。 ");
    markNamedUsage(player, usageKey, state.turn);
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, effect: "giftNekkoPick", source: "archive", prompt: "橙色偶像！：揀存檔區 1 張ねっ子，系統會附加到 Gift 來源。", meta: { sourceZone: action.zone } });
  } else if (card.number === "hSD13-013") {
    const cards = stageEntries(player).filter(({ unit }) => cardHasName(unitCard(unit, map), "ジジ・ムリン")).flatMap(({ unit }) => unit.stack.slice(0, -1).filter(instance => map.get(instance.number)?.group === "holomem"));
    assert(cards.length > 0, "自己Gigi下方沒有可支付的Holomen。");
    enqueueCardSelection(state, { playerIndex, cards, min: 1, max: 1, optional: true, effect: "giftGigiUnderCost", source: "stack", prompt: "再起之 Strength：可存檔自己任一位Gigi下方1張Holomen。", meta: { sourceZone: action.zone, sourceId: topCard(source).id, usageKey } });
  } else throw new Error("這個主動 Gift 尚未接入。 ");
}

function drainEffectQueue(state, map, random = secureRandom) {
  while (!state.pendingChoice && state.status !== "finished" && state.effectQueue.length > 0) {
    const effect = state.effectQueue.shift();
    if (diceRuns.has(state)) diceRuns.get(state).context = effect;
    const player = state.players[effect.playerIndex];
    if (!player && effect.type !== "startNextTurn") continue;
    if (effect.type === "koFanTransfer") {
      if (!stageOptionsMatching(player,map,effect.targetRule).length) continue;
      const cards=(effect.eligibleIds ? defeatedCardPool(player) : player.archive).filter(c=>map.get(c.number)?.group==="cheer" && (map.get(c.number)?.colors||[]).some(color=>effect.colors.includes(color)) && (!effect.eligibleIds || effect.eligibleIds.includes(c.id)));
      if (!cards.length) continue;
      state.pendingChoice={type:"cardSelection",playerIndex:effect.playerIndex,cards:clone(cards),selectableIds:cards.map(c=>c.id),min:0,max:Math.min(effect.max,cards.length),source:"archive",optional:true,effect:"koFanTransferPick",prompt:effect.label+"：可選應援改附到另一位合法 Holomen。",meta:{targetRule:effect.targetRule,fromDefeated:Boolean(effect.eligibleIds)}};
    } else if (effect.type === "haatoRoll") {
      rollHaatoDie(state,effect.playerIndex,effect.meta,map,random);
    } else if (effect.type === "risunersArtsBonus") {
      const recipient = stageEntries(player).find(entry => entry.unit.stack[0]?.id === effect.recipientId)?.unit;
      if (recipient && effect.turn === state.turn) {
        addStageModifier(recipient, "arts", effect.amount, effect.turn, "hBP03-113");
        appendLog(state, player.name + " 的 Risuners 效果：本回合 Arts +" + effect.amount + "。");
      }
    } else if (effect.type === "erbKnockoutGift") {
      if (usedNamedThisTurn(player, "gift:hSD13-005", state.turn) || player.cheerDeck.length === 0) continue;
      const options = stageEntries(player).filter(({ unit }) => unitCard(unit, map)?.number === "hSD13-005" && effect.sourceIds.includes(topCard(unit).id)).map(({ zone }) => zone);
      if (options.length) state.pendingChoice = { type: "stageTarget", playerIndex: effect.playerIndex, targetPlayerIndex: effect.playerIndex, options, effect: "erbGiftCheer", optional: false, prompt: "For Justice! -ERB-：選擇發動Gift的ERB，附加應援牌庫頂1張。" };
    } else if (effect.type === "oshiMushroomArchiveReturn") {
      queueArchiveToHand(state, effect.playerIndex, { group: "support", typeCodes: ["supportEvent", "supportEventLimited"], tags: ["#きのこ"] }, map, { min: 1, max: 1, optional: false, label: "去擴展你的世界吧" });
    } else if (effect.type === "finishDownLife") {
      finishKnockoutLife(state, effect.ownerIndex, effect.zone, map, effect.sourcePlayerIndex, effect.options, effect.context);
    } else if (effect.type === "completeArtsResolution") {
      const pending = state.artsResolution?.knockouts || [];
      delete state.artsResolution;
      for (const entry of pending) {
        if (state.status === "finished") break;
        const current = state.players[entry.ownerIndex]?.zones?.[entry.zone];
        if (topCard(current)?.id !== entry.targetId || Number(current?.damage || 0) < stageMaximumHp(state.players[entry.ownerIndex], entry.zone, map)) continue;
        knockOutUnit(state, entry.ownerIndex, entry.zone, map, entry.sourcePlayerIndex, entry.options);
        if (entry.artEvidence) queueArtKnockoutEffects(state, entry.artEvidence.effect, entry.artEvidence.targetCard, entry.artEvidence.damage, entry.artEvidence.remainingHpBefore, map, random);
      }
    } else if (effect.type === "resolveDamagedGiftHeal") {
      const target = stageEntries(player).find(({ unit: candidate }) => topCard(candidate)?.id === effect.targetId);
      if (target) {
        const healed = healStageUnit(state, effect.playerIndex, target.zone, effect.amount, map, false);
        appendLog(state, `${player.name} 的 hBP07-029 受傷 Gift 回復 ${healed} HP。`);
      }
    } else if (effect.type === "resolveDamagedGiftPower") {
      if (player.mainDeck.length > 0) {
        player.holoPower.push(player.mainDeck.shift());
        appendLog(state, `${player.name} 因 hBP08-029 將牌庫頂 1 張放到 Holo Power。`);
      }
    } else if (effect.type === "drawPlayerCards") {
      const drawn = drawCards(state, effect.playerIndex, Number(effect.amount || 0));
      appendLog(state, `${player.name} 因「${effect.label || "卡牌效果"}」抽 ${drawn} 張牌。`);
    } else if (effect.type === "cardSelection") {
      const selectableIds = effect.selectableIds.filter((id) => effect.cards.some((card) => card.id === id));
      const max = Math.min(Number(effect.max || 1), selectableIds.length);
      const min = Math.min(Number(effect.min || 0), max);
      if (selectableIds.length === 0) continue;
      state.pendingChoice = { ...effect, type: "cardSelection", selectableIds, min, max };
    } else if (effect.type === "stageTarget") {
      const targetPlayerIndex = Number.isInteger(effect.targetPlayerIndex) ? effect.targetPlayerIndex : effect.playerIndex;
      const targetPlayer = state.players[targetPlayerIndex];
      const swapZone = ["swapCenter", "oshiStarterOwnSwap", "oshiKanadeSwap"].includes(effect.effect) ? "center" : effect.effect === "swapCollab" ? "collab" : null;
      if (swapZone && matchingPlayerModifierBonus(targetPlayer, "movementLock", targetPlayer.zones[swapZone], swapZone, map, state.turn) > 0) {
        appendLog(state, `${targetPlayer.name} 的 ${swapZone === "center" ? "中央" : "聯動"} Holomen 目前不能互換；效果繼續結算。`);
        continue;
      }
      const calculated = effect.effect === "placeCard" ? emptyBackSlots(targetPlayer) : stageOptionsMatching(targetPlayer, map, effect.rule || {});
      const options = Array.isArray(effect.options) ? effect.options.filter((zone) => calculated.includes(zone)) : calculated;
      if (options.length === 0) {
        if (effect.effect === "giftMoveLunaite") player.archive.push(effect.meta.attachment);
        continue;
      }
      state.pendingChoice = { ...effect, type: "stageTarget", targetPlayerIndex, options };
    } else if (effect.type === "stageCheerSelection") {
      const ownerIndex = Number.isInteger(effect.ownerIndex) ? effect.ownerIndex : effect.playerIndex;
      const owner = state.players[ownerIndex];
      const available = stageCheerOptions(owner, map, effect.rule || {});
      const sourceOptions = Array.isArray(effect.options) ? effect.options : available;
      const options = sourceOptions.filter(option => available.some(candidate => candidate.id === option.id) || (effect.effect === "genericKeywordCheerCost" && option.cheerSubstitute && cardHasName(unitCard(owner.zones[option.zone], map), "猫又おかゆ") && owner.zones[option.zone]?.attachments.some(c => c.id === option.id && c.number === "hSD03-013")));
      if (options.length === 0) continue;
      state.pendingChoice = { ...effect, type: "stageCheerSelection", ownerIndex, options: options.map((option) => option.id), cheerOptions: options };
    } else if (effect.type === "stageAttachmentSelection") {
      const ownerIndex = Number.isInteger(effect.ownerIndex) ? effect.ownerIndex : effect.playerIndex;
      const owner = state.players[ownerIndex];
      const available = stageAttachmentOptions(owner, map);
      const sourceOptions = Array.isArray(effect.options) ? effect.options : available;
      const options = sourceOptions.filter((option) => available.some((candidate) => candidate.id === option.id));
      if (options.length === 0) continue;
      state.pendingChoice = { ...effect, type: "stageAttachmentSelection", ownerIndex, options: options.map((option) => option.id), attachmentOptions: options };
    } else if (effect.type === "optionChoice") {
      if (["oshiKnockout", "oshiAfterDamage"].includes(effect.effect)
        && !canPayReactiveOshi(state, effect.playerIndex, effect.meta?.kind, map)) continue;
      const options = (effect.options || []).filter((option) => !option.disabled);
      if (options.length === 0) continue;
      state.pendingChoice = { ...effect, type: "optionChoice", options: [], modeOptions: options };
    } else if (effect.type === "healTarget") {
      const options = stageEntries(player).filter(({ unit: stageUnit }) => stageUnit.damage > 0).map(({ zone }) => zone);
      if (options.length === 0 || Number(effect.amount || 0) <= 0) continue;
      state.pendingChoice = { type: "healTarget", playerIndex: effect.playerIndex, options, amount: effect.amount, prompt: effect.prompt, optional: Boolean(effect.optional) };
    } else if (effect.type === "healDistribution") {
      const options = stageOptions(player);
      const count = Math.max(0, Number(effect.count || 0));
      const unitAmount = Math.max(0, Number(effect.unitAmount || 20));
      if (options.length === 0 || count === 0 || unitAmount === 0) continue;
      state.pendingChoice = { type: "healDistribution", playerIndex: effect.playerIndex, options, count, unitAmount, sourceName: effect.sourceName || "卡牌效果", prompt: effect.prompt };
    } else if (effect.type === "attachArchivedSupport") {
      const cardInstance = player.archive.find((card) => card.id === effect.cardId);
      const card = cardInstance && map.get(cardInstance.number);
      if (!cardInstance || !card) continue;
      const options = attachmentTargets(player, card, map).filter((zone) => zone !== effect.excludeZone && (effect.genericTarget || isKoyoriCard(map.get(topCard(player.zones[zone])?.number))));
      if (options.length === 0) continue;
      const filtered = effect.targetRule ? options.filter((zone) => stageMatchesRule(player.zones[zone], zone, effect.targetRule, map, player)) : options;
      if (filtered.length === 0) continue;
      state.pendingChoice = { type: "attachArchivedSupport", playerIndex: effect.playerIndex, cardId: effect.cardId, cardNumber: cardInstance.number, options: filtered, optional: Boolean(effect.optional), prompt: effect.prompt, afterEffect: effect.afterEffect || "" };
    } else if (effect.type === "eventCheerTarget") {
      const calculated = effect.targetRule ? stageOptionsMatching(player, map, effect.targetRule) : stageEntries(player).filter(({ unit: stageUnit }) => !effect.tag || cardHasTag(map.get(topCard(stageUnit)?.number), effect.tag)).map(({ zone }) => zone);
      const options = Array.isArray(effect.options) ? effect.options.filter((zone) => calculated.includes(zone)) : calculated;
      if ((!effect.cheerCard && player.cheerDeck.length === 0) || options.length === 0) continue;
      state.pendingChoice = { type: "eventCheerTarget", playerIndex: effect.playerIndex, cardNumber: effect.cheerCard?.number || player.cheerDeck[0].number, cheerCard: effect.cheerCard, options, optional: Boolean(effect.optional), shuffleAfter: Boolean(effect.shuffleAfter), afterUnrest: Boolean(effect.afterUnrest), afterEffect: effect.afterEffect || "", afterZone: effect.afterZone || "", healAmount: Number(effect.healAmount || 0), drawAfter: Number(effect.drawAfter || 0), sourceId: effect.sourceId || "", prompt: effect.prompt };
    } else if (effect.type === "lifeCheerTarget") {
      const options = stageOptions(player);
      if (options.length === 0) {
        finishGame(state, effect.sourcePlayerIndex);
        continue;
      }
      state.pendingChoice = { type: "lifeCheerTarget", playerIndex: effect.playerIndex, cardNumber: effect.cheerCard.number, cheerCard: effect.cheerCard, options, winnerAfter: Boolean(effect.winnerAfter), sourcePlayerIndex: effect.sourcePlayerIndex, prompt: effect.prompt };
    } else if (effect.type === "dealArtsDamage") {
      if (state.artsResolution) state.artsResolution.phase = "damage";
      const targetPlayer = state.players[effect.targetPlayerIndex];
      const target = targetPlayer?.zones?.[effect.targetZone];
      if (!target) continue;
      if (prepareOshiDamageReaction(state, effect, map)) continue;
      if (prepareGiftDamageReaction(state, effect, map)) continue;
      if (prepareAttachmentDamageReaction(state, effect, map)) continue;
      let damage = Number(effect.damage || 0);
      const reductions = effect.ignoreArtsReduction ? [] : activeModifiers(target, "artsDamageReduction", state.turn);
      const reduction = reductions.reduce((sum, modifier) => sum + Number(modifier.amount || 0), 0);
      if (reduction > 0) {
        damage -= reduction; // Clamp only after all additive received-damage modifiers.
        reductions.forEach((modifier) => {
          if (Number.isFinite(modifier.uses)) modifier.uses -= 1;
        });
        target.modifiers = target.modifiers.filter((modifier) => modifier.kind !== "artsDamageReduction" || !Number.isFinite(modifier.uses) || modifier.uses > 0);
      }
      const attachmentDefense = attachmentDamageAdjustment(target, map, effect.targetZone, targetPlayer, player, "arts", state);
      const giftDefense = giftDamageAdjustment(state, effect.targetPlayerIndex, effect.targetZone, effect.playerIndex, effect.sourceZone || "", "arts", map);
      const attachmentAdjustment = effect.ignoreArtsReduction ? Math.max(0, attachmentDefense.adjustment) : attachmentDefense.adjustment;
      const giftAdjustment = effect.ignoreArtsReduction ? Math.max(0, giftDefense.adjustment) : giftDefense.adjustment;
      const reactionReduction = effect.ignoreArtsReduction ? 0 : Number(effect.reactionReduction || 0);
      damage = attachmentDefense.immune || giftDefense.immune || effect.giftImmune ? 0 : Math.max(0, damage + attachmentAdjustment + giftAdjustment - reactionReduction);
      const damageBefore = Number(target.damage || 0);
      archiveShionFansBeforeDamage(state, effect.targetPlayerIndex, target, damage);
      target.damage += damage;
      appendLog(state, `${player.name} 的 ${effect.sourceName} 使用「${effect.artName}」，造成 ${damage} 傷害${effect.effectBonus ? `（效果加成 +${effect.effectBonus}）` : ""}${effect.ignoreArtsReduction ? "（Gift：傷害不可減輕）" : reduction ? `（傷害減少 ${reduction}）` : ""}。`);
      if (effect.healSourceByArtsDamage && damage > 0 && player.zones[effect.sourceZone]) {
        const healed = healStageUnit(state, effect.playerIndex, effect.sourceZone, Math.floor(damage / 10) * 10, map);
        appendLog(state, `${effect.sourceName} 因 Arts 效果回復 ${healed} HP。`);
      }
      queueDamageTriggers(state, () => {
      queueAttachmentDamagedTriggers(state, effect.targetPlayerIndex, effect.targetZone, effect.playerIndex, damage, map);
      queueGiftDamagedTriggers(state, effect.targetPlayerIndex, effect.targetZone, effect.playerIndex, damage, "arts", map);
      queueGiftDamageDealtTriggers(state, effect.playerIndex, effect.sourceZone, effect.targetPlayerIndex, effect.targetZone, damage, "arts", map);
      queueOshiAfterArtsDamage(state, effect.playerIndex, effect.sourceZone, effect.targetPlayerIndex, effect.targetZone, damage, map);
      });
      const targetCard = unitCard(target, map);
      const targetHp = Number(targetCard?.hp || Infinity) + attachmentHpBonus(target, map, effect.targetZone, targetPlayer) + holomemHpBonus(target, map, effect.targetZone, targetPlayer);
      if (target.damage >= targetHp) {
        const remainingHpBefore = Math.max(0, targetHp - damageBefore);
        const deferred = Boolean(state.artsResolution);
        resolveDamageKnockout(state, effect.targetPlayerIndex, effect.targetZone, map, effect.playerIndex, { byArts: true, sourceZone: effect.sourceZone }, { effect, targetCard, damage, remainingHpBefore });
        if (!deferred) queueArtKnockoutEffects(state, effect, targetCard, damage, remainingHpBefore, map, random);
      }
    } else if (effect.type === "specialDamage") {
      if (prepareOshiDamageReaction(state, effect, map)) continue;
      if (prepareGiftDamageReaction(state, effect, map)) continue;
      if (prepareAttachmentDamageReaction(state, effect, map)) continue;
      const damage = applySpecialDamage(state, effect.playerIndex, effect.targetPlayerIndex, effect.targetZone, effect.amount, map, { loseLife: effect.loseLife, sourceName: effect.sourceName, sourceZone: effect.sourceZone, sourceCardNumber: effect.sourceCardNumber, reactionReduction: effect.reactionReduction, giftImmune: effect.giftImmune });
      queueDamageTriggers(state, () => {
      queueGiftDamageDealtTriggers(state, effect.playerIndex, effect.sourceZone, effect.targetPlayerIndex, effect.targetZone, damage, "special", map, effect.sourceCardNumber);
      if (damage > 0) queueOshiAfterSpecialDamage(state, effect.playerIndex, effect.sourceZone, effect.targetPlayerIndex, effect.targetZone, damage, map);
      });
    } else if (effect.type === "iofiDamaged") {
      const owner = state.players[effect.playerIndex];
      const source = stageEntries(owner).find(({unit}) => topCard(unit)?.id === effect.targetId);
      const oshi = map.get(owner.oshi?.number);
      if (source?.unit.cheer.length && owner.oshiSkillTurn !== state.turn && owner.holoPower.length >= oshiPowerCost(oshi?.oshiSkill, owner.oshi.number, "oshi") && stageOptionsMatching(owner, map, { tags: ["#ID1期生"] }).some(zone => zone !== source.zone)) enqueueOptionChoice(state, { playerIndex: effect.playerIndex, options: [{ id: "use", label: "IOFORIA~!：轉移 1 張應援" }], optional: true, effect: "iofiDamagedUse", prompt: "受傷後可使用推し技能。", meta: { targetId: effect.targetId } });
    } else if (effect.type === "irohaNamedArchiveCheer") {
      const targetRule = { names: [effect.name] };
      if (stageOptionsMatching(player, map, targetRule).length) {
        const rest = state.effectQueue.splice(0);
        enqueueArchiveCheerToTarget(state, effect.playerIndex, { optional: true, targetRule, effect: "irohaNamedCheerPick", prompt: effect.name + "：可選 1 張存檔應援附加。" }, map);
        state.effectQueue.push(...rest);
      }
    } else if (effect.type === "placeSelectedCardOnStage") {
      const sourcePlayer = state.players[effect.playerIndex];
      const sourceList = effect.source === "archive" ? sourcePlayer.archive : sourcePlayer.mainDeck;
      const cardInstance = sourceList.find((instance) => instance.id === effect.cardId);
      const options = emptyBackSlots(sourcePlayer);
      if (!cardInstance || options.length === 0 || stageUnitCount(sourcePlayer) >= 6) continue;
      state.pendingChoice = { type: "stageTarget", playerIndex: effect.playerIndex, targetPlayerIndex: effect.playerIndex, options, effect: "placeCard", prompt: effect.prompt || "直接按牌桌上的後排空位放置所選 Holomen。", meta: clone(effect) };
    } else if (effect.type === "attachArchiveCheerCard") {
      const cheer = (effect.fromDefeated ? defeatedCardPool(player) : player.archive).find((instance) => instance.id === effect.cardId);
      const options = stageOptionsMatching(player, map, effect.targetRule || {}).filter(zone => {
        if (effect.fromDefeated && player.zones[zone]?.downPending) return false;
        if (effect.targetZone && zone !== effect.targetZone) return false;
        if (!effect.maxCheerFromEffect) return true;
        return activeModifiers(player.zones[zone], `cheerBatch:${effect.effectBatch || "generic"}`, state.turn).length < Number(effect.maxCheerFromEffect);
      });
      if (!cheer || options.length === 0) continue;
      state.pendingChoice = { type: "stageTarget", playerIndex: effect.playerIndex, targetPlayerIndex: effect.playerIndex, options, effect: "attachArchiveCheer", prompt: effect.prompt || "直接按牌桌上一位 Holomen 附加所選應援。", meta: clone(effect) };
    } else if (effect.type === "justiceDownSearch") {
      queueDeckToHand(state, effect.playerIndex, { group: "holomem", stages: ["2nd"] }, map, random, { optional: false, label: "マジェスティック・デヴォーション" });
    } else if (effect.type === "finalizeCardsToStage") {
      if (effect.shuffle) player.mainDeck = shuffle(player.mainDeck, random);
      if (effect.afterEffect === "friendlyComputerAfter" && Number(effect.selectedCount || 0) >= 2) enqueueHandToDestination(state, effect.playerIndex, { min: 1, max: 1, effect: "handToBottom", prompt: "友善電腦放出了 2 位 Debut：揀 1 張手牌放到牌庫底。" });
      if (effect.afterEffect === "soraSummerBottomIfThree" && Number(effect.selectedCount || 0) === 3) enqueueHandToDestination(state, effect.playerIndex, { min: 1, max: 1, effect: "handToBottom", prompt: "うんうん、今度海に行かないって？放出了 3 位 Debut ときのそら：揀 1 張手牌放到牌庫底。" });
      if (effect.afterEffect === "fuwamocoMococo") queueDeckCardsToStage(state, effect.playerIndex, { group: "holomem", stages: ["Debut"], names: ["モココ・アビスガード", "Mococo Abyssgard"] }, map, random, { min: 1, max: 1, optional: false, label: "相信 FUWAMOCO！（Mococo）" });
      if (effect.afterEffect === "creatorArchiveDebut") queueArchiveCardsToStage(state, effect.playerIndex, { group: "holomem", stages: ["Debut"] }, map, { min: 1, max: 1, optional: false, label: "創作者電腦（存檔區）" });
      if (effect.afterEffect === "returnPuffer") {
        const source = player.zones[effect.afterMeta?.sourceZone];
        const tool = source?.attachments.find((instance) => instance.number === "hSD10-013");
        if (tool) player.mainDeck.push(removeById(source.attachments, tool.id));
      } else if (effect.afterEffect === "oshiJusticeCheer") {
        const targetZone = stageEntries(player).find(({ unit: stageUnit }) => effect.selectedIds?.includes(topCard(stageUnit)?.id))?.zone;
        const cheers = player.archive.filter((instance) => map.get(instance.number)?.group === "cheer");
        if (targetZone && cheers.length > 0) enqueueCardSelection(state, { playerIndex: effect.playerIndex, cards: cheers, min: 1, max: Math.min(5, cheers.length), effect: "archiveCheerToStage", source: "archive", prompt: "JUST LIKE THAT：揀 1～5 張存檔區應援，會全部附加到剛登場的 #Justice Holomen。", meta: { targetZone, targetRule: { zones: [targetZone] } } });
      } else if (effect.afterEffect === "oshiCheerEveryHolomem") {
        const targets = stageOptions(player);
        const count = Math.min(targets.length, player.archive.filter(instance => map.get(instance.number)?.group === "cheer").length);
        if (count > 0) enqueueArchiveCheerToTarget(state, effect.playerIndex, { min: count, max: count, optional: false, targetRule: { zones: targets }, prompt: "自由奔放的『追跡者』：選擇存檔應援，分別附加到不同成員，每位1張。", meta: { maxCheerFromEffect: 1, effectBatch: "hSD13-002:sp:" + state.turn } }, map);
      }
    } else if (effect.type === "bonusBloomTarget") {
      const cardInstance = player.hand.find((card) => card.id === effect.cardId);
      const card = cardInstance && map.get(cardInstance.number);
      const options = card ? bloomTargets(player, card, map, state.turn) : [];
      if (!cardInstance || !card || options.length === 0) {
        player.bonusBloomUsedTurn = state.turn;
        continue;
      }
      state.pendingChoice = { type: "bonusBloomTarget", playerIndex: effect.playerIndex, cardId: cardInstance.id, cardNumber: cardInstance.number, options, prompt: effect.prompt };
    } else if (effect.type === "forcedCollab") {
      const options = BACK_SLOTS.filter((zone) => Boolean(player.zones[zone]));
      if (player.zones.collab || options.length === 0) continue;
      state.pendingChoice = { type: "forcedCollab", playerIndex: effect.playerIndex, options, prompt: effect.prompt };
    } else if (effect.type === "endToolDamage") {
      const options = [effect.sourceZone].filter((zone) => {
        const stageUnit = player.zones[zone];
        const card = map.get(topCard(stageUnit)?.number);
        return stageUnit && card?.stage === "2nd" && isKoyoriCard(card) && stageUnit.attachments?.some((instance) => instance.number === "hEB01-034");
      });
      if (options.length === 0) continue;
      state.pendingChoice = { type: "endToolDamage", playerIndex: effect.playerIndex, options, optional: true, prompt: "可將「萬事爆解！」放到存檔區，給對手中央 Holomen 30 點特殊傷害。" };
    } else if (effect.type === "endPuffer") {
      const source = player.zones[effect.sourceZone];
      const tool = source?.attachments.find((instance) => instance.number === "hSD10-013");
      if (!source || !tool || Number(source.lastArtsTurn || 0) !== state.turn) continue;
      const candidates = player.mainDeck.filter((instance) => {
        const card = map.get(instance.number);
        return card?.group === "holomem" && ["Debut", "Spot"].includes(card.stage) && cardHasTag(card, "#FLOW GLOW");
      });
      if (candidates.length > 0 && emptyBackSlots(player).length > 0) enqueueCardSelection(state, { playerIndex: effect.playerIndex, cards: candidates, min: 0, max: 1, effect: "deckCardsToStage", source: "deck", optional: true, prompt: "河豚太郎：可公開 1 張 #FLOW GLOW Debut／Spot 登場；之後直接按牌桌空位。", meta: { afterEffect: "returnPuffer", afterMeta: { sourceZone: effect.sourceZone } } });
      else {
        player.mainDeck = shuffle(player.mainDeck, random);
        player.mainDeck.push(removeById(source.attachments, tool.id));
      }
    } else if (effect.type === "startNextTurn") {
      startNextTurn(state, map);
    } else if (effect.type === "completeEndStep") {
      completeEndStep(state, effect.playerIndex, map);
    }
  }
}

export function applyAction(stateInput, playerIndex, action, cards, random = secureRandom) {
  return runDiceAction(stateInput, playerIndex, action, cards, random, executeAction);
}

function executeAction(stateInput, playerIndex, action, cards, random, diceRun) {
  const state = clone(stateInput);
  normalizeLegacyState(state);
  const map = catalogMap(cards, state);
  diceRun.map = map; diceRuns.set(state, diceRun);
  assert(Number.isInteger(playerIndex) && state.players[playerIndex], "玩家身份無效。 ");
  assert(action && typeof action.type === "string", "操作格式不正確。 ");

  if (action.type === "ready") {
    assert(["waiting", "lobby"].includes(state.status), "對局已經開始。 ");
    state.players[playerIndex].ready = Boolean(action.ready);
    appendLog(state, `${state.players[playerIndex].name}${action.ready ? "已準備" : "取消準備"}。`);
    if (state.players.length === 2 && state.players.every((player) => player.ready)) initializeGame(state, cards, random);
  } else if (action.type === "redraw") {
    assert(state.status === "setup", "目前不是開局設置階段。 ");
    redrawOpeningHand(state, playerIndex, map, random);
  } else if (action.type === "setup") {
    assert(state.status === "setup", "目前不是開局設置階段。 ");
    setupStage(state, playerIndex, action, map, random);
  } else if (action.type === "play") {
    playFromHand(state, playerIndex, action, map, random);
  } else if (action.type === "choose") {
    resolveChoice(state, playerIndex, action, map, random);
  } else if (action.type === "advance") {
    advancePhase(state, playerIndex, map);
  } else if (action.type === "collab") {
    collab(state, playerIndex, action, map, random);
  } else if (action.type === "attack") {
    attack(state, playerIndex, action, map, random);
  } else if (action.type === "baton") {
    batonPass(state, playerIndex, action, map);
  } else if (action.type === "oshiSkill") {
    activateOshiSkill(state, playerIndex, map, random, "oshi");
  } else if (action.type === "spOshiSkill") {
    activateOshiSkill(state, playerIndex, map, random, "sp");
  } else if (action.type === "attachmentSkill") {
    activateAttachmentSkill(state, playerIndex, action, map);
  } else if (action.type === "giftSkill") {
    activateGiftSkill(state, playerIndex, action, map, random);
  } else {
    throw new Error("不支援的操作。 ");
  }
  drainEffectQueue(state, map, random);
  return state;
}

function publicUnit(stageUnit, hidden = false) {
  if (!stageUnit) return null;
  if (hidden) {
    return { stack: [], cheer: [], attachments: [], damage: 0, rested: false, hidden: true };
  }
  return clone(stageUnit);
}

function publicPlayer(player, own, status) {
  if (!player.oshi) return { name: player.name, ready: player.ready };
  const hideOpeningStage = status === "setup" && !own;
  return {
    name: player.name,
    ready: player.ready,
    setupDone: player.setupDone,
    turnsTaken: Number(player.turnsTaken || 0),
    mulliganUsed: Boolean(player.mulliganUsed),
    forcedRedraws: Number(player.forcedRedraws || 0),
    oshi: player.oshi,
    hand: own ? clone(player.hand) : Array.from({ length: player.hand.length }, () => null),
    handCount: player.hand.length,
    mainDeckCount: player.mainDeck.length,
    cheerDeckCount: player.cheerDeck.length,
    lifeCount: player.life.length,
    holoPowerCount: player.holoPower.length,
    archive: clone(player.archive),
    zones: Object.fromEntries(STAGE_SLOTS.map((slot) => [slot, publicUnit(player.zones[slot], hideOpeningStage)])),
    collabTurn: Number(player.collabTurn || 0),
    batonTurn: Number(player.batonTurn || 0),
    limitedTurn: Number(player.limitedTurn || 0),
    oshiSkillTurn: Number(player.oshiSkillTurn || 0),
    spOshiSkillUsed: Boolean(player.spOshiSkillUsed),
    koyoriArtsBonusTurn: Number(player.koyoriArtsBonusTurn || 0),
    bonusBloomTurn: Number(player.bonusBloomTurn || 0),
    bonusBloomUsedTurn: Number(player.bonusBloomUsedTurn || 0),
    namedUsageTurns: clone(player.namedUsageTurns || {}),
  };
}

export function publicRoomState(state, viewerIndex) {
  const result = {
    mode: state.mode || "pvp",
    aiPlayer: Number.isInteger(state.aiPlayer) ? state.aiPlayer : null,
    aiLastStepCount: Number(state.aiLastStepCount || 0),
    status: state.status,
    players: state.players.map((player, index) => publicPlayer(player, index === viewerIndex, state.status)),
    activePlayer: state.activePlayer,
    firstPlayer: state.firstPlayer,
    winner: state.winner,
    turn: state.turn,
    phase: state.phase,
    pendingChoice: state.pendingChoice?.playerIndex === viewerIndex ? clone(state.pendingChoice) : state.pendingChoice ? { type: "opponent", playerIndex: state.pendingChoice.playerIndex } : null,
    log: clone(state.log),
  };
  return result;
}

export { BACK_SLOTS, ORDINARY_COMPUTER, STAGE_SLOTS };
























































































































































































































































































































