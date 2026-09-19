"use client";
import { downloadReview } from '@/lib/simulator/review-download.mjs';

import { appFetch } from "@/lib/backend";
import { firebaseBuild } from "@/lib/firebase/client";

import { cardText, effectText, keywordLabel } from "@/lib/card-terminology.mjs";
import TerminologyNote from "@/app/TerminologyNote";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/ThemeToggle";
import { fromHoloSimDeck, isHoloSimDeck } from "@/lib/holosim-deck.mjs";
import { AUTOMATED_SUPPORT_CARDS } from "@/lib/simulator/effect-catalog.mjs";
import { displayedBatonCost, suuBatonIncrease } from "@/lib/simulator/display.mjs";
import { buildCardReferenceIndex, cardReferenceTokens } from "@/lib/simulator/log-cards.mjs";
import { isActivatableOshiSkill, oshiSkillPowerCost, oshiSkillMinimumPower } from "@/lib/simulator/oshi-skill-catalog.mjs";
import FoilCardImage from "@/app/FoilCardImage";

type DeckState = { oshi: Record<string, number>; main: Record<string, number>; cheer: Record<string, number>; printings?: Record<string, Record<string, number>> };
type Skill = { name?: string; effect?: string; timing?: string; type?: string };
type CardInfo = {
  number: string;
  name: string;
  jpName?: string;
  group: "oshi" | "holomem" | "support" | "cheer";
  stage: string;
  type: string;
  typeCode?: string;
  image: string;
  rarity?: string;
  variants?: { id: string; rarity: string; image: string }[];
  hp: number | null;
  life: number | null;
  baton: number | null;
  abilityText: string;
  extra?: string;
  tags?: string[];
  keyword?: Skill | null;
  stageSkill?: Skill | null;
  oshiSkill?: Skill | null;
  spOshiSkill?: Skill | null;
  colors: string[];
  colorCodes?: string[];
  arts: { name: string; damage: number | null; cost: string[]; effect: string }[];
};
// Display-only localization; canonical names and card numbers stay in game state.
function translatedCardName(card: CardInfo | null | undefined, fallback = "") {
  return card ? effectText(card, card.name) : fallback;
}

type CardInstance = { id: string; number: string; variantId?: string };
type StageModifier = { kind: string; amount?: number; expiresTurn?: number; uses?: number; artIndex?: number };
type StageUnit = { stack: CardInstance[]; cheer: CardInstance[]; attachments?: CardInstance[]; modifiers?: StageModifier[]; damage: number; rested: boolean; hidden?: boolean; enteredTurn?: number; bloomedTurn?: number; collabbedTurn?: number; koyoriMascotBonusTurn?: number; returnSlot?: string | null };
type LockedCanvas = { width: number; height: number; scale: number };
type PlayerView = {
  name: string;
  ready: boolean;
  setupDone?: boolean;
  turnsTaken?: number;
  mulliganUsed?: boolean;
  forcedRedraws?: number;
  oshi?: CardInstance;
  hand?: (CardInstance | null)[];
  handCount?: number;
  mainDeckCount?: number;
  cheerDeckCount?: number;
  lifeCount?: number;
  holoPowerCount?: number;
  archive?: CardInstance[];
  zones?: Record<string, StageUnit | null>;
  collabTurn?: number;
  batonTurn?: number;
  limitedTurn?: number;
  oshiSkillTurn?: number;
  spOshiSkillUsed?: boolean;
  koyoriArtsBonusTurn?: number;
  bonusBloomTurn?: number;
  bonusBloomUsedTurn?: number;
  namedUsageTurns?: Record<string, number>;
};
type PendingChoice = {
  type: "playHolomen" | "bloom" | "bonusBloomTarget" | "ordinaryComputer" | "cheerTarget" | "lifeCheerTarget" | "centerReplacement" | "attachSupport" | "moveCheer" | "healTarget" | "healDistribution" | "eventCheerTarget" | "forcedCollab" | "attachArchivedSupport" | "archiveCheerForSkill" | "unrestTarget" | "endToolDamage" | "cardSelection" | "payStageCheerForSearch" | "swapOwnCenter" | "moveStageCheerSource" | "moveStageCheerTarget" | "stageTarget" | "stageCheerSelection" | "stageAttachmentSelection" | "optionChoice" | "opponent";
  playerIndex: number;
  cardId?: string;
  cardNumber?: string;
  sourceNumber?: string;
  options?: string[];
  zones?: string[];
  targetZone?: string;
  cheerOptions?: { id: string; number: string; zone: string; cheerSubstitute?: boolean }[];
  attachmentOptions?: { id: string; number: string; zone: string }[];
  cheerCard?: CardInstance;
  optional?: boolean;
  cards?: CardInstance[];
  selectableIds?: string[];
  min?: number;
  max?: number;
  prompt?: string;
  effect?: string;
  sourceZone?: string;
  cheerId?: string;
  targetOptions?: string[];
  searchRule?: unknown;
  amount?: number;
  count?: number;
  unitAmount?: number;
  sourceName?: string;
  winnerAfter?: boolean;
  sourcePlayerIndex?: number;
  targetPlayerIndex?: number;
  ownerIndex?: number;
  optionId?: string;
  optionLabel?: string;
  modeOptions?: { id: string; label: string; disabled?: boolean }[];
  after?: "draw" | "nextTurn";
};
type RoomState = {
  mode?: "pvp" | "solo";
  aiPlayer?: number | null;
  aiLastStepCount?: number;
  status: "waiting" | "lobby" | "setup" | "playing" | "finished";
  players: PlayerView[];
  activePlayer: number | null;
  firstPlayer: number | null;
  winner: number | null;
  turn: number;
  phase: string;
  pendingChoice: PendingChoice | null;
  log: { id: string; at: number; message: string; cardRefs?: CardInstance[]; revealRefs?: CardInstance[] }[];
};
type RoomPayload = { code: string; token?: string; version: number; viewerIndex?: number; state: RoomState };
type SavedDeck = { id: string; name: string; deck: DeckState };
type MotionPlace = "deck" | "cheer" | "life" | "power" | "archive" | "hand" | "zone" | "oshi" | "field";
type MotionLocation = { playerIndex: number; place: MotionPlace; zone?: string };
type MotionEvent = { id: string; kind: "move" | "draw" | "life" | "cheer" | "reveal" | "damage" | "status" | "shuffle"; instanceId?: string; cardNumber?: string; variantId?: string; groupKey?: string; from: MotionLocation; to: MotionLocation; label: string; faceUp?: boolean };
type MotionBatch = { id: string; label: string; events: MotionEvent[] };
type HoveredCardRef = { number: string; variantId?: string; playerIndex?: number; zone?: string; location?: string };
type InspectorLiveState = {
  ownerName?: string;
  location?: string;
  hostName?: string;
  hostNumber?: string;
  totalHp?: number | null;
  damage?: number;
  remainingHp?: number | null;
  rested?: boolean;
  cheerCount?: number;
  attachmentCount?: number;
  stackCount?: number;
  batonCost?: number;
};

const draftKey = "hololive-ocg-deck-draft-v1";
const emptyDeck = (): DeckState => ({ oshi: {}, main: {}, cheer: {} });
const backSlots = ["back1", "back2", "back3", "back4", "back5"];
const slotNames: Record<string, string> = { center: "中央", collab: "合作", back1: "後排 1", back2: "後排 2", back3: "後排 3", back4: "後排 4", back5: "後排 5" };
const phaseNames: Record<string, string> = { lobby: "等候", setup: "開局設置", reset: "重置", cheer: "應援", main: "主要", performance: "表演", end: "結束", finished: "完結" };
const mobileInterfaceQuery = "(max-width: 720px) and (pointer: coarse)";
const automatedSupportCards = new Set(AUTOMATED_SUPPORT_CARDS);
const automatedKoyoriCards = new Set(["hEB01-003", "hEB01-018", "hEB01-019", "hEB01-020", "hEB01-021", "hEB01-022", "hEB01-023", "hEB01-024", "hBP04-009", "hBP04-011", "hBP04-012", "hSD06-008", "hBP04-097", "hBP04-100", "hBP04-105", "hEB01-034"]);
const activeGiftCards = new Set(["hBP01-045", "hBP03-030", "hBP06-070", "hBP07-080", "hSD13-013"]);

function skillPowerCost(skill?: Skill | null, cardNumber = "", kind: "oshi" | "sp" = "oshi") {
  if (cardNumber) return oshiSkillPowerCost(cardNumber, kind);
  const match = `${skill?.timing || ""} ${skill?.effect || ""}`.match(/Holo\s*Power\s*[-−]\s*(\d+)/iu);
  if (match) return Number(match[1]);
  return 0;
}

function count(section: Record<string, number> | undefined) {
  return Object.values(section || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function tokenKey(code: string) {
  return `hololive-ocg-room-${code}`;
}

function topNumber(unit: StageUnit | null | undefined) {
  return unit?.stack?.[unit.stack.length - 1]?.number || "";
}

function topInstance(unit: StageUnit | null | undefined) {
  return unit?.stack?.[unit.stack.length - 1];
}

function attachmentHpBonus(card: CardInfo | undefined, unit: StageUnit | null | undefined, cardMap: Map<string, CardInfo>) {
  const attachments = unit?.attachments || [];
  return attachments.reduce((total, instance) => {
    const text = String(cardMap.get(instance.number)?.abilityText || "").split(/\n\s*\n|◆/u)[0];
    return total + Number(text.match(/HP\s*[+＋]\s*(\d+)/iu)?.[1] || 0);
  }, 0) + (card?.number === "hEB01-024" ? attachments.filter((instance) => instance.number === "hBP04-105").length * 10 : 0);
}

function inspectorLiveStateFor(state: RoomState, reference: HoveredCardRef | null, cardMap: Map<string, CardInfo>): InspectorLiveState | undefined {
  if (!reference || reference.playerIndex == null) return undefined;
  const player = state.players[reference.playerIndex];
  if (!player) return undefined;
  const base: InspectorLiveState = { ownerName: player.name, location: reference.location || (reference.zone ? slotNames[reference.zone] || reference.zone : undefined) };
  const unit = reference.zone ? player.zones?.[reference.zone] : undefined;
  if (!unit) return base;
  const hostCard = cardMap.get(topNumber(unit));
  const hpBonus = attachmentHpBonus(hostCard, unit, cardMap);
  const totalHp = hostCard?.hp == null ? null : Number(hostCard.hp) + hpBonus;
  const batonIncrease = reference.zone === "center" ? suuBatonIncrease(state.players[reference.playerIndex === 0 ? 1 : 0], cardMap) : 0;
  return {
    ...base,
    hostName: translatedCardName(hostCard),
    hostNumber: hostCard?.number,
    totalHp,
    damage: Number(unit.damage || 0),
    remainingHp: totalHp == null ? null : Math.max(0, totalHp - Number(unit.damage || 0)),
    rested: Boolean(unit.rested),
    cheerCount: unit.cheer?.length || 0,
    attachmentCount: unit.attachments?.length || 0,
    stackCount: Math.max(0, (unit.stack?.length || 1) - 1),
    batonCost: displayedBatonCost(hostCard, unit, state.turn, batonIncrease),
  };
}

function isAttachment(card?: CardInfo) {
  return ["supportTool", "supportMascot", "supportFan"].includes(card?.typeCode || "");
}

function isKoyoriHolomem(card?: CardInfo) {
  return card?.group === "holomem" && [card.name, card.jpName].filter(Boolean).some((name) => String(name).replaceAll(" ", "").includes("博衣こより"));
}

function isPlayableByCore(card?: CardInfo) {
  return card?.group === "holomem" || isAttachment(card) || automatedSupportCards.has(card?.number || "");
}

function automationLabel(card?: CardInfo) {
  if (!card) return "資料未載入";
  if (card.number.startsWith("hBP09-")) return "hBP09 自動效果 · 整合測試中";
  if (card.group === "oshi") return "主動推し技能自動結算";
  if (automatedSupportCards.has(card.number) || automatedKoyoriCards.has(card.number)) return "文字效果自動結算";
  if (isAttachment(card)) return "附加／基礎加成自動";
  if (card.group === "holomem") return "出場／Bloom／Gift／Arts 自動";
  if (card.group === "cheer") return "應援步驟自動";
  return "文字效果尚未自動";
}

function motionLocationKey(location: MotionLocation) {
  return `${location.playerIndex}:${location.place}:${location.zone || ""}`;
}

function collectVisibleCards(state: RoomState) {
  const result = new Map<string, { instance: CardInstance; location: MotionLocation }>();
  state.players.forEach((player, playerIndex) => {
    if (player.oshi) result.set(player.oshi.id, { instance: player.oshi, location: { playerIndex, place: "oshi" } });
    (player.hand || []).forEach((instance) => { if (instance) result.set(instance.id, { instance, location: { playerIndex, place: "hand" } }); });
    (player.archive || []).forEach((instance) => result.set(instance.id, { instance, location: { playerIndex, place: "archive" } }));
    Object.entries(player.zones || {}).forEach(([zone, unit]) => {
      (unit?.stack || []).forEach((instance) => result.set(instance.id, { instance, location: { playerIndex, place: "zone", zone } }));
      (unit?.cheer || []).forEach((instance) => result.set(instance.id, { instance, location: { playerIndex, place: "zone", zone } }));
      (unit?.attachments || []).forEach((instance) => result.set(instance.id, { instance, location: { playerIndex, place: "zone", zone } }));
    });
  });
  const pending = state.pendingChoice;
  if (pending?.cheerCard && Number.isInteger(pending.playerIndex)) result.set(pending.cheerCard.id, { instance: pending.cheerCard, location: { playerIndex: pending.playerIndex, place: "field" } });
  return result;
}

function buildMotionEvents(previous: RoomState, next: RoomState, cards: CardInfo[], viewerIndex: number) {
  const cardMap = new Map(cards.map((card) => [card.number, card]));
  const before = collectVisibleCards(previous);
  const after = collectVisibleCards(next);
  const motions: MotionEvent[] = [];
  const damageMotions: MotionEvent[] = [];
  const counters = next.players.map((player, playerIndex) => {
    const old = previous.players[playerIndex] || {} as PlayerView;
    return {
      deckDown: Math.max(0, Number(old.mainDeckCount || 0) - Number(player.mainDeckCount || 0)),
      deckUp: Math.max(0, Number(player.mainDeckCount || 0) - Number(old.mainDeckCount || 0)),
      cheerDown: Math.max(0, Number(old.cheerDeckCount || 0) - Number(player.cheerDeckCount || 0)),
      cheerUp: Math.max(0, Number(player.cheerDeckCount || 0) - Number(old.cheerDeckCount || 0)),
      lifeDown: Math.max(0, Number(old.lifeCount || 0) - Number(player.lifeCount || 0)),
      powerDown: Math.max(0, Number(old.holoPowerCount || 0) - Number(player.holoPowerCount || 0)),
      powerUp: Math.max(0, Number(player.holoPowerCount || 0) - Number(old.holoPowerCount || 0)),
      handDown: Math.max(0, Number(old.handCount || 0) - Number(player.handCount || 0)),
    };
  });
  let serial = 0;
  const add = (motion: Omit<MotionEvent, "id">) => motions.push({ ...motion, id: `${next.turn}-${next.phase}-${serial += 1}-${motion.cardNumber || motion.kind}` });

  after.forEach(({ instance, location }, id) => {
    const old = before.get(id);
    if (old && motionLocationKey(old.location) !== motionLocationKey(location)) {
      add({ kind: "move", instanceId: instance.id, cardNumber: instance.number, variantId: instance.variantId, from: old.location, to: location, label: `${translatedCardName(cardMap.get(instance.number)) || instance.number} 移動`, faceUp: true });
      return;
    }
    if (old) return;
    const available = counters[location.playerIndex];
    const group = cardMap.get(instance.number)?.group;
    let source: MotionLocation = { playerIndex: location.playerIndex, place: "field" };
    let kind: MotionEvent["kind"] = "move";
    if (group === "cheer" && available.lifeDown > 0) { source = { playerIndex: location.playerIndex, place: "life" }; available.lifeDown -= 1; kind = "life"; }
    else if (group === "cheer" && available.cheerDown > 0) { source = { playerIndex: location.playerIndex, place: "cheer" }; available.cheerDown -= 1; kind = "cheer"; }
    else if (available.powerDown > 0) { source = { playerIndex: location.playerIndex, place: "power" }; available.powerDown -= 1; }
    else if (available.deckDown > 0) { source = { playerIndex: location.playerIndex, place: "deck" }; available.deckDown -= 1; kind = location.place === "hand" ? "draw" : "move"; }
    else if (available.handDown > 0 || (location.playerIndex !== viewerIndex && ["holomem", "support"].includes(group || "") && ["zone", "archive"].includes(location.place))) { source = { playerIndex: location.playerIndex, place: "hand" }; available.handDown = Math.max(0, available.handDown - 1); }
    add({ kind, instanceId: instance.id, cardNumber: instance.number, variantId: instance.variantId, from: source, to: location, label: kind === "life" ? "生命卡翻開" : kind === "cheer" ? "應援卡翻開" : kind === "draw" ? "抽牌" : source.place === "hand" ? `${translatedCardName(cardMap.get(instance.number)) || instance.number} 出牌` : `${translatedCardName(cardMap.get(instance.number)) || instance.number} 登場`, faceUp: location.playerIndex === viewerIndex || !["hand"].includes(location.place) });
  });

  before.forEach(({ instance, location }, id) => {
    if (after.has(id)) return;
    const available = counters[location.playerIndex];
    let destination: MotionLocation | null = null;
    if (available.powerUp > 0) { destination = { playerIndex: location.playerIndex, place: "power" }; available.powerUp -= 1; }
    else if (available.deckUp > 0) { destination = { playerIndex: location.playerIndex, place: "deck" }; available.deckUp -= 1; }
    else if (available.cheerUp > 0) { destination = { playerIndex: location.playerIndex, place: "cheer" }; available.cheerUp -= 1; }
    if (destination) add({ kind: "move", instanceId: instance.id, cardNumber: instance.number, variantId: instance.variantId, from: location, to: destination, label: `${translatedCardName(cardMap.get(instance.number)) || instance.number} 移動`, faceUp: location.playerIndex === viewerIndex || location.place !== "hand" });
  });

  counters.forEach((available, playerIndex) => {
    while (available.powerUp > 0 && available.deckDown > 0) {
      add({ kind: "move", from: { playerIndex, place: "deck" }, to: { playerIndex, place: "power" }, label: "牌庫頂放入 Holo Power" });
      available.powerUp -= 1; available.deckDown -= 1;
    }
    while (available.lifeDown > 0) {
      add({ kind: "life", from: { playerIndex, place: "life" }, to: { playerIndex, place: "field" }, label: "生命卡翻開", faceUp: true });
      available.lifeDown -= 1;
    }
    while (available.cheerDown > 0) {
      add({ kind: "cheer", from: { playerIndex, place: "cheer" }, to: { playerIndex, place: "field" }, label: "應援牌庫翻開", faceUp: true });
      available.cheerDown -= 1;
    }
    while (available.deckDown > 0) {
      add({ kind: "draw", from: { playerIndex, place: "deck" }, to: { playerIndex, place: "hand" }, label: "抽牌", faceUp: playerIndex === viewerIndex });
      available.deckDown -= 1;
    }
    while (available.powerDown > 0) {
      add({ kind: "move", from: { playerIndex, place: "power" }, to: { playerIndex, place: "archive" }, label: "支付 Holo Power" });
      available.powerDown -= 1;
    }
  });

  next.players.forEach((player, playerIndex) => {
    Object.entries(player.zones || {}).forEach(([zone, unit]) => {
      const oldUnit = previous.players[playerIndex]?.zones?.[zone];
      if (!unit || !oldUnit || topNumber(unit) !== topNumber(oldUnit)) return;
      const cardNumber = topNumber(unit);
      const variantId = topInstance(unit)?.variantId;
      if (Number(unit.damage || 0) > Number(oldUnit.damage || 0)) damageMotions.push({ id: `${next.turn}-${next.phase}-damage-${playerIndex}-${zone}`, kind: "damage", cardNumber, variantId, from: { playerIndex, place: "zone", zone }, to: { playerIndex, place: "zone", zone }, label: `受到 ${Number(unit.damage || 0) - Number(oldUnit.damage || 0)} 傷害`, faceUp: true });
      else if (Boolean(unit.rested) !== Boolean(oldUnit.rested)) damageMotions.push({ id: `${next.turn}-${next.phase}-status-${playerIndex}-${zone}`, kind: "status", cardNumber, variantId, from: { playerIndex, place: "zone", zone }, to: { playerIndex, place: "zone", zone }, label: unit.rested ? "休息" : "轉為活動", faceUp: true });
    });
  });

  const oldLogIds = new Set(previous.log.map((entry) => entry.id));
  [...next.log].reverse().filter((entry) => !oldLogIds.has(entry.id)).forEach((entry) => {
    if (next.pendingChoice?.type === "cheerTarget" && /應援步驟公開/u.test(entry.message)) return;
    const hasStructuredReveal = Array.isArray(entry.revealRefs);
    const revealed = hasStructuredReveal
      ? (entry.revealRefs || [])
      : entry.cardRefs?.length && /(?:公開|展示)/u.test(entry.message)
        ? entry.cardRefs
        : [];
    if (revealed.length && /(?:公開|展示)/u.test(entry.message)) {
      const sourcePlace: MotionPlace = /生命/u.test(entry.message) ? "life" : /應援牌庫|應援卡/u.test(entry.message) ? "cheer" : /Holo Power/u.test(entry.message) ? "power" : "deck";
      const playerIndex = next.players.findIndex((player) => entry.message.startsWith(player.name));
      revealed.forEach((instance) => {
        if (!hasStructuredReveal && motions.some((motion) => (motion.instanceId ? motion.instanceId === instance.id : motion.cardNumber === instance.number) && ["life", "cheer", "draw", "move"].includes(motion.kind))) return;
        add({ kind: "reveal", instanceId: instance.id, cardNumber: instance.number, variantId: instance.variantId, groupKey: `log:${entry.id}`, from: { playerIndex: playerIndex < 0 ? Number(next.activePlayer || 0) : playerIndex, place: sourcePlace }, to: { playerIndex: playerIndex < 0 ? Number(next.activePlayer || 0) : playerIndex, place: "field" }, label: entry.message, faceUp: true });
      });
    } else if (/洗牌/u.test(entry.message) && !motions.some((motion) => motion.kind === "shuffle")) {
      const playerIndex = next.players.findIndex((player) => entry.message.startsWith(player.name));
      add({ kind: "shuffle", from: { playerIndex: playerIndex < 0 ? Number(next.activePlayer || 0) : playerIndex, place: /應援牌庫/u.test(entry.message) ? "cheer" : "deck" }, to: { playerIndex: playerIndex < 0 ? Number(next.activePlayer || 0) : playerIndex, place: /應援牌庫/u.test(entry.message) ? "cheer" : "deck" }, label: "洗牌" });
    }
  });

  return [...damageMotions, ...motions].slice(0, 30);
}

function groupMotionEvents(events: MotionEvent[], version: number) {
  const batches: MotionBatch[] = [];
  const byKey = new Map<string, MotionBatch>();
  events.forEach((event) => {
    const key = [event.groupKey || "", event.kind, event.from.playerIndex, event.from.place, event.to.playerIndex, event.to.place, event.faceUp ? "front" : "back"].join(":");
    let batch = byKey.get(key);
    if (!batch) {
      batch = { id: `${version}-${batches.length}-${event.kind}`, label: event.label, events: [] };
      byKey.set(key, batch);
      batches.push(batch);
    }
    batch.events.push(event);
  });
  batches.forEach((batch) => {
    if (batch.events.length === 1) return;
    const kind = batch.events[0].kind;
    batch.label = kind === "draw" ? `同時抽 ${batch.events.length} 張牌` : kind === "life" ? `同時翻開 ${batch.events.length} 張生命` : kind === "cheer" ? `同時翻開 ${batch.events.length} 張應援` : kind === "damage" ? `${batch.events.length} 位 Holomen 同時受到傷害` : kind === "status" ? `${batch.events.length} 位 Holomen 同時改變狀態` : kind === "reveal" ? `同時展示 ${batch.events.length} 張卡` : `同組 ${batch.events.length} 張卡一齊移動`;
  });
  return batches;
}

function pendingTitle(pending: PendingChoice, pendingCard: string) {
  const titles: Partial<Record<PendingChoice["type"], string>> = {
    cheerTarget: "按牌桌上的 Holomen 附加應援",
    lifeCheerTarget: "按自己牌桌上的 Holomen 附加生命應援",
    bloom: "按要 Bloom 的 Holomen",
    bonusBloomTarget: "按要進行額外 Bloom 的 1st Holomen",
    centerReplacement: "按要移到中央的後排 Holomen",
    attachSupport: "按要附加支援卡的 Holomen",
    attachArchivedSupport: "按要附加存檔區支援卡的 Holomen",
    moveCheer: "按牌桌上閃動的實際應援卡",
    archiveCheerForSkill: "按要放到存檔區的實際應援卡",
    unrestTarget: "按要轉為活動狀態的 Holomen",
    healTarget: "按要回復 HP 的 Holomen",
    healDistribution: "分配每一個 20 HP 回復",
    eventCheerTarget: "按要附加應援的 Holomen",
    forcedCollab: "按要移到合作位置的後排 Holomen",
    endToolDamage: "按要發動「萬事爆解！」的 2nd こより",
    payStageCheerForSearch: "按要支付的實際應援卡",
    swapOwnCenter: "按要與中央互換的後排 Holomen",
    moveStageCheerSource: "按要改附的實際應援卡",
    moveStageCheerTarget: "按要接收應援的 Holomen",
    cardSelection: "按卡片作出效果選擇",
    playHolomen: "按高亮舞台空位",
    stageTarget: "直接按牌桌上高亮的實際 Holomen",
    stageCheerSelection: "直接按高亮的應援或可替代支付的吉祥物",
    stageAttachmentSelection: "直接按牌桌上高亮的實際附加卡",
    optionChoice: "選擇要使用的效果模式",
  };
  if (pending.type === "ordinaryComputer") return pendingCard ? "Debut 已選好；按高亮後排空位" : "先揀 Debut，再按牌桌空位";
  return titles[pending.type] || "完成自動效果選擇";
}

function CardFace({ instance, cardMap, small = false, hidden = false, back = "main" }: { instance?: CardInstance | null; cardMap: Map<string, CardInfo>; small?: boolean; hidden?: boolean; back?: "main" | "cheer" }) {
  if (hidden || !instance) return <div className={`sim-card-back ${back} ${small ? "small" : ""}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={back === "cheer" ? "/card-backs/cheer-oshi.png" : "/card-backs/main.png"} alt={back === "cheer" ? "應援／推し卡背" : "主牌卡背"} />
  </div>;
  const card = cardMap.get(instance.number);
  if (!card) return <div className={`sim-card-back main ${small ? "small" : ""}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/card-backs/main.png" alt="主牌卡背" /><code>{instance.number}</code>
  </div>;
  const selectedVariant = (card.variants || []).find((variant) => variant.id === instance.variantId);
  const backImage = card.group === "cheer" ? "/card-backs/cheer-oshi.png" : "/card-backs/main.png";
  const image = selectedVariant?.image || card.image || backImage;
  const sameColorCheer = card.group === "cheer" ? [...cardMap.values()]
    .filter((candidate) => candidate.group === "cheer" && candidate.number !== card.number && candidate.colorCodes?.some((color) => card.colorCodes?.includes(color)))
    .map((candidate) => candidate.image)
    .filter(Boolean)
    .slice(0, 4) : [];
  const fallbackImages = [...new Set([
    ...(card.variants || []).map((variant) => variant.image),
    card.image,
    ...sameColorCheer,
    backImage,
  ].filter((candidate): candidate is string => Boolean(candidate && candidate !== image)))];
  const rarity = selectedVariant?.rarity || card.rarity;
  return (
    <div className={`sim-card-face ${small ? "small" : ""}`} data-card-number={card.number} data-variant-id={selectedVariant?.id || undefined}>
      <FoilCardImage className="sim-card-art" src={image} fallbackSrc={fallbackImages} alt={`${effectText(card, card.name)} ${card.number}${rarity ? ` ${rarity}` : ""}`} rarity={rarity} loading="lazy" />
      <span><code>{card.number}</code><b>{effectText(card, card.name)}{selectedVariant ? ` · ${selectedVariant.rarity}` : ""}</b></span>
    </div>
  );
}

function ResponsiveZoneLabel({ label, className }: { label: string; className: string }) {
  const mobileLabel = ({
    "合作位置": "合作",
    "中央位置": "中央",
    "推し位置": "推し",
    "應援牌庫": "應援",
    "主牌庫": "牌庫",
    "存檔區": "存檔",
  } as Record<string, string>)[label] || label.replace(/^後排\s+(\d+)$/u, "後排$1");
  return <span className={className}><span className="sim-label-desktop">{label}</span><span className="sim-label-mobile">{mobileLabel}</span></span>;
}

function StageCard({ unit, label, zone, cardMap, copiedArtCards = [], own, compact = false, turn, opponentBatonIncrease = 0, canCollab, canBaton, canUseAttachmentSkill, canUseGiftSkill, giftUsed, selectable, selectedCheerIds = [], selectedAttachmentIds = [], healAllocation, healUnitAmount = 20, canAddHeal = false, onAdjustHeal, onSelect, onSelectCheer, onSelectAttachment, onInspect, onAttachmentSkill, onGiftSkill, onCollab, onBaton, onArt }: {
  unit: StageUnit | null | undefined;
  label: string;
  zone: string;
  cardMap: Map<string, CardInfo>;
  copiedArtCards?: CardInfo[];
  own: boolean;
  compact?: boolean;
  turn: number;
  opponentBatonIncrease?: number;
  canCollab?: boolean;
  canBaton?: boolean;
  canUseAttachmentSkill?: (number: string) => boolean;
  canUseGiftSkill?: boolean;
  giftUsed?: boolean;
  selectable?: boolean;
  selectedCheerIds?: string[];
  selectedAttachmentIds?: string[];
  healAllocation?: number;
  healUnitAmount?: number;
  canAddHeal?: boolean;
  onAdjustHeal?: (difference: number) => void;
  onSelect?: () => void;
  onSelectCheer?: (id: string) => void;
  onSelectAttachment?: (id: string) => void;
  onInspect?: (reference: string | CardInstance) => void;
  onAttachmentSkill?: (number: string) => void;
  onGiftSkill?: () => void;
  onCollab?: () => void;
  onBaton?: () => void;
  onArt?: (index: number, artSourceNumber?: string) => void;
}) {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const card = cardMap.get(topNumber(unit));
  const attachments = unit?.attachments || [];
  const lowerStack = unit?.stack?.slice(0, -1).reverse() || [];
  const hpBonus = attachmentHpBonus(card, unit, cardMap);
  const batonCost = displayedBatonCost(card, unit, turn, zone === "center" ? opponentBatonIncrease : 0);
  const batonDifference = batonCost - Math.max(0, Number(card?.baton || 0));
  const underCards = unit && (lowerStack.length > 0 || attachments.length > 0 || unit.cheer.length > 0) ? <div className="sim-under-cards" aria-label={`${lowerStack.length} 張 Bloom 疊卡、${attachments.length} 張附加卡、${unit.cheer.length} 張應援`}>
    {lowerStack.map((instance) => <button type="button" className="sim-under-card bloom" key={instance.id} title={`Bloom 疊卡：${translatedCardName(cardMap.get(instance.number)) || instance.number}`} aria-label={`查看 Bloom 疊卡 ${translatedCardName(cardMap.get(instance.number)) || instance.number}`} onClick={() => onInspect?.(instance)}><CardFace instance={instance} cardMap={cardMap} small /></button>)}
    {attachments.map((instance) => <span className="sim-under-card-item" key={instance.id}><button type="button" className={`sim-under-card support ${selectedAttachmentIds.includes(instance.id) ? "selectable" : ""}`} title={`附加卡：${translatedCardName(cardMap.get(instance.number)) || instance.number}`} aria-label={selectedAttachmentIds.includes(instance.id) ? `選擇附加卡 ${translatedCardName(cardMap.get(instance.number)) || instance.number}` : `查看附加卡 ${translatedCardName(cardMap.get(instance.number)) || instance.number}效果`} onClick={() => selectedAttachmentIds.includes(instance.id) ? onSelectAttachment?.(instance.id) : onInspect?.(instance)}><CardFace instance={instance} cardMap={cardMap} small /></button>{canUseAttachmentSkill?.(instance.number) && <button type="button" className="sim-under-card-effect" onClick={() => onAttachmentSkill?.(instance.number)} aria-label={`使用${translatedCardName(cardMap.get(instance.number)) || instance.number}技能`}>技</button>}</span>)}
    {unit.cheer.map((instance) => <button type="button" className={`sim-under-card cheer ${selectedCheerIds.includes(instance.id) ? "selectable" : ""}`} key={instance.id} title={`應援：${translatedCardName(cardMap.get(instance.number)) || instance.number}`} aria-label={selectedCheerIds.includes(instance.id) ? `選擇應援 ${translatedCardName(cardMap.get(instance.number)) || instance.number}` : `查看應援 ${translatedCardName(cardMap.get(instance.number)) || instance.number}`} onClick={() => selectedCheerIds.includes(instance.id) ? onSelectCheer?.(instance.id) : onInspect?.(instance)}><CardFace instance={instance} cardMap={cardMap} small /></button>)}
  </div> : null;
  const healControls = healAllocation != null && <div className="sim-heal-allocation" aria-label={`${label}回復分配`}><button type="button" disabled={healAllocation <= 0} onClick={() => onAdjustHeal?.(-1)}>−</button><span>回復 {healUnitAmount} × <b>{healAllocation}</b></span><button type="button" disabled={!canAddHeal} onClick={() => onAdjustHeal?.(1)}>＋</button></div>;
  const unitActions = own && !selectable && selectedCheerIds.length === 0 && card && <div className="sim-unit-actions">
    {canCollab && <button type="button" onClick={() => { setMobileActionsOpen(false); onCollab?.(); }}>合作</button>}
    {canBaton && <button type="button" onClick={() => { setMobileActionsOpen(false); onBaton?.(); }}>接力</button>}
    {canUseGiftSkill && <button type="button" disabled={giftUsed} onClick={() => { setMobileActionsOpen(false); onGiftSkill?.(); }}>{giftUsed ? "Gift 已使用" : "使用 Gift"}</button>}
    {onArt && card.arts.map((art, index) => <button type="button" key={`${art.name}-${index}`} onClick={() => { setMobileActionsOpen(false); onArt(index); }}>{effectText(card, art.name)} · {art.damage ?? 0} · 應援 {art.cost.length}</button>)}
    {onArt && copiedArtCards.flatMap((copied) => copied.arts.map((art, index) => <button type="button" key={`copy-${copied.number}-${art.name}-${index}`} onClick={() => { setMobileActionsOpen(false); onArt(index, copied.number); }}>模仿 {effectText(copied, copied.name)} · {effectText(copied, art.name)} · {art.damage ?? 0} · 應援 {art.cost.length}</button>))}
  </div>;
  const hasMobileActions = Boolean(healControls || unitActions);
  return (
    <article className={`sim-stage-card ${compact ? "compact" : ""} ${unit ? "occupied" : ""} ${unit?.hidden ? "hidden-card" : ""} ${unit?.rested ? "rested" : ""} ${selectable ? "selectable" : ""} ${hasMobileActions ? "has-mobile-actions" : ""}`} data-zone={zone} data-card-number={card?.number}>
      {compact && unit && <ResponsiveZoneLabel className="sim-card-zone-label" label={label} />}
      {unit?.hidden ? <div className={`sim-stage-content ${compact ? "compact" : ""} concealed`}><div className="sim-stage-visual">{!compact && <ResponsiveZoneLabel className="sim-card-zone-label" label={label} />}<CardFace hidden cardMap={cardMap} /></div>{!compact && <div className="sim-stage-side"><ResponsiveZoneLabel className="sim-slot-label" label={label} /><b className="sim-unit-name">未公開</b></div>}</div> : unit && card ? (
        <div className={`sim-stage-content ${compact ? "compact" : ""}`}>
          <div className="sim-stage-visual">
            {!compact && <ResponsiveZoneLabel className="sim-card-zone-label" label={label} />}
            <div className="sim-card-control-frame">
              <button className="sim-stage-card-inspect" type="button" onClick={() => onInspect?.(unit.stack[unit.stack.length - 1])} aria-label={`查看${effectText(card, card.name)}卡牌資料`}><CardFace instance={unit.stack[unit.stack.length - 1]} cardMap={cardMap} /></button>
              <button className="sim-mobile-card-effect" type="button" onClick={() => onInspect?.(unit.stack[unit.stack.length - 1])} aria-label={`查看${effectText(card, card.name)}完整狀態`}>狀態</button>
              {hasMobileActions && <button className="sim-mobile-card-actions" type="button" onClick={() => setMobileActionsOpen(true)} aria-label={`開啟${label}${translatedCardName(card) || "Holomen"}動作`}>動作</button>}
            </div>
            {!compact && underCards && <div className="sim-front-mobile-under">{underCards}</div>}
            {compact && underCards}
          </div>
          {!compact && <div className="sim-stage-side">
            <div className="sim-stage-side-head"><ResponsiveZoneLabel className="sim-slot-label" label={label} /></div>
            <b className="sim-unit-name">{effectText(card, card.name)}</b>
            <div className="sim-unit-stats">
              <span>HP {card.hp == null ? "—" : Number(card.hp) + hpBonus}{hpBonus ? ` (+${hpBonus})` : ""}</span><span>傷害 {unit.damage}</span><span>應援 {unit.cheer.length}</span><span className={batonDifference ? "modified" : ""} title={`卡面接力費 ${card.baton ?? 0}；目前需要 ${batonCost} 張應援`}>接力需 {batonCost}{batonDifference ? ` (${batonDifference > 0 ? "+" : ""}${batonDifference})` : ""}</span>
            </div>
            {underCards}
            {healControls}
            {unitActions}
          </div>}
          {compact && (healControls || unitActions) && <div className="sim-compact-controls">{healControls}{unitActions}</div>}
        </div>
      ) : <><ResponsiveZoneLabel className="sim-slot-label" label={label} /><span className="sim-empty-slot">空位</span></>}
      {mobileActionsOpen && <div className="sim-mobile-action-layer" role="presentation" onClick={() => setMobileActionsOpen(false)}>
        <section className="sim-mobile-action-sheet" role="dialog" aria-modal="true" aria-label={`${label}${translatedCardName(card) || "Holomen"}動作`} onClick={(event) => event.stopPropagation()}>
          <header><div><span>{label}</span><b>{translatedCardName(card)}</b></div><button type="button" onClick={() => setMobileActionsOpen(false)} aria-label="關閉卡片動作">×</button></header>
          {healControls}{unitActions}
        </section>
      </div>}
      {selectable && <button className="sim-table-target" type="button" onClick={onSelect} aria-label={`選擇${label}`}><span>按此選擇</span></button>}
    </article>
  );
}

function TablePile({ area, label, count, horizontal = false, topCard, cardMap, onClick }: {
  area: "life" | "cheer" | "power" | "deck" | "archive";
  label: string;
  count: number;
  horizontal?: boolean;
  topCard?: CardInstance;
  cardMap: Map<string, CardInfo>;
  onClick?: () => void;
}) {
  const empty = count <= 0;
  return (
    <article className={`sim-table-pile ${area} ${horizontal ? "horizontal" : ""} ${empty ? "empty" : ""} ${onClick ? "clickable" : ""}`} data-pile={area} aria-label={`${label}，${count} 張`} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} onKeyDown={onClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } } : undefined}>
      <ResponsiveZoneLabel className="sim-table-label" label={label} />
      <div className={`sim-pile-card ${empty ? "empty" : ""}`}>
        {empty ? <span className="sim-pile-empty">空</span> : topCard ? <CardFace instance={topCard} cardMap={cardMap} /> : <CardFace hidden back={["life", "cheer"].includes(area) ? "cheer" : "main"} cardMap={cardMap} />}
        {!empty && <b className="sim-pile-count">{count}</b>}
      </div>
    </article>
  );
}

function ArchiveViewer({ player, cardMap, onClose, onInspect }: { player: PlayerView; cardMap: Map<string, CardInfo>; onClose: () => void; onInspect: (number: string) => void }) {
  const cards = [...(player.archive || [])].reverse();
  return (
    <div className="sim-overlay" role="presentation" onMouseDown={onClose}>
      <section className="sim-archive-viewer" role="dialog" aria-modal="true" aria-label={`${player.name}的存檔區`} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">PUBLIC ARCHIVE</p><h2>{player.name}的存檔區</h2><span>最新放入的卡排在最前 · 共 {cards.length} 張</span></div><button type="button" onClick={onClose} aria-label="關閉存檔區">×</button></header>
        {cards.length ? <div className="sim-archive-grid">{cards.map((instance, index) => <button type="button" key={instance.id} onClick={() => onInspect(instance.number)}><CardFace instance={instance} cardMap={cardMap} /><span>第 {cards.length - index} 張</span></button>)}</div> : <div className="sim-archive-empty">存檔區目前未有卡片。</div>}
      </section>
    </div>
  );
}

function motionPoint(location: MotionLocation) {
  const canvas = document.querySelector<HTMLElement>(".sim-zoom-locked");
  const canvasRect = canvas?.getBoundingClientRect();
  const canvasScale = Math.max(0.1, Number(canvas?.dataset.canvasScale || 1));
  const board = document.querySelector<HTMLElement>(`[data-player-index="${location.playerIndex}"]`);
  let target: HTMLElement | null = null;
  if (location.place === "zone") target = board?.querySelector<HTMLElement>(`[data-zone="${location.zone}"]`) || null;
  else if (["deck", "cheer", "life", "power", "archive"].includes(location.place)) target = board?.querySelector<HTMLElement>(`[data-pile="${location.place}"] .sim-pile-card`) || null;
  else if (location.place === "oshi") target = board?.querySelector<HTMLElement>(".sim-oshi-position") || null;
  else if (location.place === "hand") target = document.querySelector<HTMLElement>(`[data-hand-player-index="${location.playerIndex}"]`) || board?.querySelector<HTMLElement>(".sim-hand-count") || null;
  else target = board?.querySelector<HTMLElement>(".sim-table-layout") || null;
  const rect = (target || board || document.body).getBoundingClientRect();
  const cardWidth = window.matchMedia("(max-width: 760px)").matches ? 94 : 112;
  const cardHeight = cardWidth * 88 / 63;
  return {
    x: (rect.left - (canvasRect?.left || 0) + rect.width / 2) / canvasScale - cardWidth / 2,
    y: (rect.top - (canvasRect?.top || 0) + rect.height / 2) / canvasScale - cardHeight / 2,
  };
}

function motionDuration(event: MotionEvent) {
  if (event.kind === "shuffle") return 1100;
  if (event.kind === "damage" || event.kind === "status") return 850;
  return ["life", "cheer"].includes(event.kind) ? 1150 : 950;
}

function CardMotionLayer({ batch, cardMap, onDone }: { batch: MotionBatch; cardMap: Map<string, CardInfo>; onDone: () => void }) {
  const [paths, setPaths] = useState<{ start: { x: number; y: number }; middle: { x: number; y: number }; end: { x: number; y: number } }[]>([]);
  const doneRef = useRef(onDone);
  const duration = Math.max(...batch.events.map(motionDuration));

  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    const nextPaths = batch.events.map((event, index) => {
      const start = motionPoint(event.from);
      const end = motionPoint(event.to);
      const spread = (index - (batch.events.length - 1) / 2) * Math.min(22, 80 / Math.max(1, batch.events.length - 1));
      const middle = event.kind === "damage" || event.kind === "status" || event.kind === "shuffle"
        ? { x: start.x + spread, y: start.y - 12 }
        : { x: start.x + (end.x - start.x) * 0.52 + spread, y: start.y + (end.y - start.y) * 0.52 - Math.abs(spread) * 0.08 };
      return { start, middle, end };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM geometry is available only after the updated table renders
    setPaths(nextPaths);
    const timer = window.setTimeout(() => doneRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [batch, duration]);

  if (paths.length !== batch.events.length) return null;
  return (
    <div className="sim-card-motion-layer" role="status" aria-live="polite">
      {batch.events.map((event, index) => {
        const path = paths[index];
        const back = ["life", "cheer"].includes(event.from.place) || event.kind === "cheer" || event.kind === "life" ? "cheer" : "main";
        const showFront = Boolean(event.faceUp && event.cardNumber && cardMap.has(event.cardNumber));
        const style = {
          "--motion-x0": `${path.start.x}px`, "--motion-y0": `${path.start.y}px`,
          "--motion-x1": `${path.middle.x}px`, "--motion-y1": `${path.middle.y}px`,
          "--motion-x2": `${path.end.x}px`, "--motion-y2": `${path.end.y}px`,
          "--motion-duration": `${duration}ms`,
        } as CSSProperties;
        return <div className={`sim-card-motion ${event.kind} ${showFront ? "show-front" : "keep-back"}`} style={style} key={event.id}>
          <div className="sim-motion-card-shell">
            <div className="sim-motion-card-side back"><CardFace hidden back={back} cardMap={cardMap} /></div>
            {showFront && <div className="sim-motion-card-side front"><CardFace instance={{ id: `motion-${event.id}`, number: event.cardNumber || "", variantId: event.variantId }} cardMap={cardMap} /></div>}
          </div>
        </div>;
      })}
    </div>
  );
}

function RevealConfirmation({ batch, cardMap, onConfirm }: { batch: MotionBatch; cardMap: Map<string, CardInfo>; onConfirm: () => void }) {
  const cards = batch.events.filter((event) => event.cardNumber && cardMap.has(event.cardNumber));
  return (
    <div className="sim-reveal-layer" role="status" aria-live="polite">
      <section className="sim-reveal-confirmation" aria-label="展示卡片確認">
        <div className="sim-reveal-copy"><span>REVEAL TO BOTH PLAYERS</span><b>{cards.length > 1 ? `向雙方同時展示 ${cards.length} 張卡` : "向雙方展示卡片"}</b><p>{batch.label}</p></div>
        <div className="sim-reveal-cards">{cards.map((event) => <CardFace key={event.id} instance={{ id: `reveal-${event.id}`, number: event.cardNumber || "", variantId: event.variantId }} cardMap={cardMap} />)}</div>
        <button type="button" onClick={onConfirm}>確認已查看</button>
        <small>確認前卡片會留在中央；對局及 AI 行動不會暫停。</small>
      </section>
    </div>
  );
}

function OshiPosition({ player, cardMap, canActivate = false, turn, onInspect, onUseSkill, onUseSpSkill }: { player: PlayerView; cardMap: Map<string, CardInfo>; canActivate?: boolean; turn: number; onInspect?: (number: string) => void; onUseSkill?: () => void; onUseSpSkill?: () => void }) {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const card = player.oshi ? cardMap.get(player.oshi.number) : undefined;
  const mocoReduction = card?.number === "hBP03-004" && topNumber(player.zones?.collab) === "hBP08-060" ? 1 : 0;
  const normalBaseCost = skillPowerCost(card?.oshiSkill, card?.number, "oshi");
  const normalCost = normalBaseCost === "X" ? "X" : Math.max(0, normalBaseCost - mocoReduction);
  const spCost = skillPowerCost(card?.spOshiSkill, card?.number, "sp");
  const normalMinimumCost = normalCost === "X" ? oshiSkillMinimumPower(card?.number || "") : normalCost;
  const spMinimumCost = spCost === "X" ? oshiSkillMinimumPower(card?.number || "", "sp") : spCost;
  const normalActive = Boolean(card?.oshiSkill?.effect) && isActivatableOshiSkill(card?.number || "", "oshi");
  const spActive = Boolean(card?.spOshiSkill?.effect) && isActivatableOshiSkill(card?.number || "", "sp");
  const skillButtons = <>
    {normalActive && <button className="sim-oshi-skill" type="button" disabled={!canActivate || player.oshiSkillTurn === turn || Number(player.holoPowerCount || 0) < normalMinimumCost} onClick={() => { setMobileActionsOpen(false); onUseSkill?.(); }}>推し技能 · Power −{normalCost}</button>}
    {spActive && <button className="sim-oshi-skill" type="button" disabled={!canActivate || player.spOshiSkillUsed || Number(player.holoPowerCount || 0) < spMinimumCost} onClick={() => { setMobileActionsOpen(false); onUseSpSkill?.(); }}>SP 推し技能 · Power −{spCost}</button>}
  </>;
  return (
    <article className="sim-oshi-position">
      <ResponsiveZoneLabel className="sim-table-label" label="推し位置" />
      {player.oshi ? <div className="sim-card-control-frame sim-oshi-control-frame"><button className="sim-oshi-card-inspect" type="button" onClick={() => onInspect?.(player.oshi?.number || "")} aria-label={`查看${translatedCardName(card) || "推し"}卡牌資料`}><CardFace instance={player.oshi} cardMap={cardMap} /></button><button className="sim-mobile-card-effect sim-mobile-oshi-effect" type="button" onClick={() => onInspect?.(player.oshi?.number || "")} aria-label={`查看${translatedCardName(card) || "推し"}效果`}>效果</button>{(normalActive || spActive) && <button className="sim-mobile-card-actions sim-mobile-oshi-actions" type="button" onClick={() => setMobileActionsOpen(true)} aria-label={`開啟${translatedCardName(card) || "推し"}技能`}>動作</button>}</div> : <CardFace hidden back="cheer" cardMap={cardMap} />}
      {card && <small>{card.life ?? 0} LIFE · {effectText(card, card.name)}</small>}
      <div className={`sim-oshi-attached-power ${Number(player.holoPowerCount || 0) > 0 ? "" : "empty"}`} data-pile="power" aria-label={`Holo Power，${player.holoPowerCount || 0} 張`}>{Number(player.holoPowerCount || 0) > 0 ? <><span>Holo Power</span><div className="sim-pile-card"><CardFace hidden back="main" cardMap={cardMap} /><b className="sim-pile-count">{player.holoPowerCount}</b></div></> : <div className="sim-pile-card empty" aria-hidden="true" />}</div>
      {skillButtons}
      {mobileActionsOpen && <div className="sim-mobile-action-layer" role="presentation" onClick={() => setMobileActionsOpen(false)}>
        <section className="sim-mobile-action-sheet" role="dialog" aria-modal="true" aria-label={`${translatedCardName(card) || "推し"}技能`} onClick={(event) => event.stopPropagation()}>
          <header><div><span>推し位置</span><b>{translatedCardName(card)}</b></div><button type="button" onClick={() => setMobileActionsOpen(false)} aria-label="關閉推し技能">×</button></header>
          <div className="sim-unit-actions">{skillButtons}</div>
        </section>
      </div>}
    </article>
  );
}

function Board({ player, playerIndex, own, cardMap, active, phase, turn, opponentBatonIncrease = 0, actionsEnabled = true, mobileStatus = false, selectableZones = [], selectableCheerIds = [], selectableAttachmentIds = [], healAllocations, healUnitAmount = 20, healAssigned = 0, healRequired = 0, onAdjustHeal, onSelectZone, onSelectCheer, onSelectAttachment, onInspect, onOpenArchive, onAction, onAttack }: {
  player: PlayerView;
  playerIndex: number;
  own: boolean;
  cardMap: Map<string, CardInfo>;
  active: boolean;
  phase: string;
  turn: number;
  opponentBatonIncrease?: number;
  actionsEnabled?: boolean;
  mobileStatus?: boolean;
  selectableZones?: string[];
  selectableCheerIds?: string[];
  selectableAttachmentIds?: string[];
  healAllocations?: Record<string, number>;
  healUnitAmount?: number;
  healAssigned?: number;
  healRequired?: number;
  onAdjustHeal?: (zone: string, difference: number) => void;
  onSelectZone?: (zone: string) => void;
  onSelectCheer?: (id: string) => void;
  onSelectAttachment?: (id: string) => void;
  onInspect?: (reference: string | HoveredCardRef) => void;
  onOpenArchive?: () => void;
  onAction: (action: Record<string, unknown>) => void;
  onAttack: (sourceZone: string, artIndex: number, artSourceNumber?: string) => void;
}) {
  const zoneMap = player.zones || {};
  const archiveTop = player.archive?.[player.archive.length - 1];
  const hasRestedHoloX = Object.values(zoneMap).some((stageUnit) => stageUnit?.rested && (cardMap.get(topNumber(stageUnit))?.tags || []).includes("#秘密結社holoX"));
  const canUseGreenTube = (stageUnit: StageUnit | null | undefined) => {
    const card = cardMap.get(topNumber(stageUnit));
    return isKoyoriHolomem(card) && ["1st", "2nd"].includes(card?.stage || "") && Boolean(stageUnit?.cheer.length);
  };
  const canUseAttachmentSkill = (stageUnit: StageUnit | null | undefined, number: string) => {
    if (number === "hBP04-097") return hasRestedHoloX && canUseGreenTube(stageUnit);
    if (number !== "hBP02-092") return false;
    const holder = cardMap.get(topNumber(stageUnit));
    const attachment = stageUnit?.attachments?.find((instance) => instance.number === number);
    const isFubuki = holder?.group === "holomem" && [holder.name, holder.jpName].filter(Boolean).some((name) => String(name).replaceAll(" ", "").includes("白上フブキ"));
    return Boolean(attachment && isFubuki && (stageUnit?.cheer.length || 0) >= 2 && player.namedUsageTurns?.[`attachment:hBP02-092:${attachment.id}`] !== turn);
  };
  const canUseGift = (stageUnit: StageUnit | null | undefined) => activeGiftCards.has(topNumber(stageUnit));
  const giftUsed = (stageUnit: StageUnit | null | undefined) => player.namedUsageTurns?.[`gift:${topNumber(stageUnit)}`] === turn;
  const inspectAt = (reference: string | CardInstance, zone?: string, location?: string) => {
    const cardReference = typeof reference === "string" ? { number: reference } : reference;
    onInspect?.(mobileStatus ? { ...cardReference, playerIndex, zone, location } : cardReference);
  };
  const copiedArtsFor = (stageUnit: StageUnit | null | undefined) => topNumber(stageUnit) === "hBP07-048" ? [...new Map(Object.values(zoneMap).flatMap((candidate) => {
    const candidateCard = cardMap.get(topNumber(candidate));
    return candidateCard && candidateCard.number !== "hBP07-048" && (candidateCard.tags || []).includes("#EN") ? [[candidateCard.number, candidateCard] as const] : [];
  })).values()] : [];
  return (
    <section className={`sim-board ${own ? "own" : "opponent"}`} data-player-index={playerIndex}>
      <div className="sim-player-line">
        <div><b>{player.name}</b>{active && <span>行動中</span>}</div>
        <span className="sim-hand-count">手牌 {player.handCount ?? 0} 張</span>
      </div>
      <div className="sim-table-scroll">
        <div className="sim-table-layout">
          <TablePile area="life" label="生命" count={player.lifeCount ?? 0} cardMap={cardMap} />
          <div className="sim-front-zone collab-zone">
            <StageCard
              unit={zoneMap.collab}
              label="合作位置"
              zone="collab"
              cardMap={cardMap}
              copiedArtCards={copiedArtsFor(zoneMap.collab)}
              own={own}
              turn={turn}
              opponentBatonIncrease={opponentBatonIncrease}
              selectable={selectableZones.includes("collab")}
              selectedCheerIds={selectableCheerIds}
              selectedAttachmentIds={selectableAttachmentIds}
              healAllocation={healAllocations ? Number(healAllocations.collab || 0) : undefined}
              healUnitAmount={healUnitAmount}
              canAddHeal={healAssigned < healRequired}
              onAdjustHeal={(difference) => onAdjustHeal?.("collab", difference)}
              onSelect={() => onSelectZone?.("collab")}
              onSelectCheer={onSelectCheer}
              onSelectAttachment={onSelectAttachment}
              onInspect={(number) => inspectAt(number, "collab", "合作位置")}
              canUseAttachmentSkill={actionsEnabled && own && active && phase === "main" ? (number) => canUseAttachmentSkill(zoneMap.collab, number) : undefined}
              onAttachmentSkill={(cardNumber) => onAction({ type: "attachmentSkill", zone: "collab", cardNumber })}
              canUseGiftSkill={actionsEnabled && own && active && phase === "main" && canUseGift(zoneMap.collab)}
              giftUsed={giftUsed(zoneMap.collab)}
              onGiftSkill={() => onAction({ type: "giftSkill", zone: "collab" })}
              onArt={actionsEnabled && own && active && phase === "performance" && turn > 1 && zoneMap.collab && !zoneMap.collab.rested ? (index, artSourceNumber) => onAttack("collab", index, artSourceNumber) : undefined}
            />
          </div>
          <div className="sim-front-zone center-zone">
            <StageCard
              unit={zoneMap.center}
              label="中央位置"
              zone="center"
              cardMap={cardMap}
              copiedArtCards={copiedArtsFor(zoneMap.center)}
              own={own}
              turn={turn}
              opponentBatonIncrease={opponentBatonIncrease}
              selectable={selectableZones.includes("center")}
              selectedCheerIds={selectableCheerIds}
              selectedAttachmentIds={selectableAttachmentIds}
              healAllocation={healAllocations ? Number(healAllocations.center || 0) : undefined}
              healUnitAmount={healUnitAmount}
              canAddHeal={healAssigned < healRequired}
              onAdjustHeal={(difference) => onAdjustHeal?.("center", difference)}
              onSelect={() => onSelectZone?.("center")}
              onSelectCheer={onSelectCheer}
              onSelectAttachment={onSelectAttachment}
              onInspect={(number) => inspectAt(number, "center", "中央位置")}
              canUseAttachmentSkill={actionsEnabled && own && active && phase === "main" ? (number) => canUseAttachmentSkill(zoneMap.center, number) : undefined}
              onAttachmentSkill={(cardNumber) => onAction({ type: "attachmentSkill", zone: "center", cardNumber })}
              canUseGiftSkill={actionsEnabled && own && active && phase === "main" && canUseGift(zoneMap.center)}
              giftUsed={giftUsed(zoneMap.center)}
              onGiftSkill={() => onAction({ type: "giftSkill", zone: "center" })}
              onArt={actionsEnabled && own && active && phase === "performance" && turn > 1 && zoneMap.center && !zoneMap.center.rested ? (index, artSourceNumber) => onAttack("center", index, artSourceNumber) : undefined}
            />
          </div>
          <div className="sim-oshi-power-zone" aria-label="推し與 Holo Power 區域">
            <OshiPosition player={player} cardMap={cardMap} canActivate={actionsEnabled && own && active && phase === "main"} turn={turn} onInspect={(number) => inspectAt(number, undefined, "推し位置")} onUseSkill={() => onAction({ type: "oshiSkill" })} onUseSpSkill={() => onAction({ type: "spOshiSkill" })} />
          </div>
          <TablePile area="cheer" label="應援牌庫" count={player.cheerDeckCount ?? 0} cardMap={cardMap} />
          <section className="sim-back-stage" aria-label="後排位置">
            <div className="sim-stage-divider"><span>舞台</span><b>後排位置</b></div>
            <div className="sim-back-grid">
              {backSlots.map((slot) => (
                <StageCard
                  key={slot}
                  unit={zoneMap[slot]}
                  label={slotNames[slot]}
                  zone={slot}
                  cardMap={cardMap}
                  own={own}
                  compact
                  turn={turn}
                  opponentBatonIncrease={opponentBatonIncrease}
                  selectable={selectableZones.includes(slot)}
                  selectedCheerIds={selectableCheerIds}
                  selectedAttachmentIds={selectableAttachmentIds}
                  healAllocation={healAllocations ? Number(healAllocations[slot] || 0) : undefined}
                  healUnitAmount={healUnitAmount}
                  canAddHeal={healAssigned < healRequired}
                  onAdjustHeal={(difference) => onAdjustHeal?.(slot, difference)}
                  onSelect={() => onSelectZone?.(slot)}
                  onSelectCheer={onSelectCheer}
                  onSelectAttachment={onSelectAttachment}
                  onInspect={(number) => inspectAt(number, slot, slotNames[slot])}
                  canUseAttachmentSkill={actionsEnabled && own && active && phase === "main" ? (number) => canUseAttachmentSkill(zoneMap[slot], number) : undefined}
                  onAttachmentSkill={(cardNumber) => onAction({ type: "attachmentSkill", zone: slot, cardNumber })}
                  canUseGiftSkill={actionsEnabled && own && active && phase === "main" && canUseGift(zoneMap[slot])}
                  giftUsed={giftUsed(zoneMap[slot])}
                  onGiftSkill={() => onAction({ type: "giftSkill", zone: slot })}
                  canCollab={actionsEnabled && own && active && phase === "main" && !zoneMap.collab && !zoneMap[slot]?.rested && player.collabTurn !== turn}
                  canBaton={actionsEnabled && own && active && phase === "main" && Boolean(zoneMap.center) && !zoneMap[slot]?.rested && player.batonTurn !== turn}
                  onCollab={() => onAction({ type: "collab", zone: slot })}
                  onBaton={() => onAction({ type: "baton", zone: slot })}
                />
              ))}
            </div>
          </section>
          <TablePile area="deck" label="主牌庫" count={player.mainDeckCount ?? 0} cardMap={cardMap} />
          <TablePile area="archive" label="存檔區" count={player.archive?.length ?? 0} topCard={archiveTop} cardMap={cardMap} onClick={onOpenArchive} />
          {actionsEnabled && own && active && phase === "main" && player.archive?.some((instance) => instance.number === "hBP08-044") && <button className="sim-archive-gift" type="button" onClick={() => onAction({ type: "giftSkill", cardNumber: "hBP08-044" })}>從存檔區使用「光，再次點亮」</button>}
        </div>
      </div>
    </section>
  );
}

function cardPrintingLabel(instance: CardInstance, cardMap: Map<string, CardInfo>) {
  const card = cardMap.get(instance.number);
  const printing = card?.variants?.find((variant) => variant.id === instance.variantId);
  const rarity = printing?.rarity || card?.rarity || "";
  return `${instance.number}${rarity ? ` ${rarity}` : ""}`;
}

function LogMessage({ message, referenceIndex, cardRefs = [], cardMap, onInspect }: {
  message: string;
  referenceIndex: ReturnType<typeof buildCardReferenceIndex>;
  cardRefs?: CardInstance[];
  cardMap: Map<string, CardInfo>;
  onInspect: (instance: CardInstance) => void;
}) {
  const tokens = cardReferenceTokens(message, referenceIndex, cardRefs) as ({ type: "text"; value: string } | { type: "card"; matched: string; instance: CardInstance })[];
  const renderedIds = new Set(tokens.filter((token): token is { type: "card"; matched: string; instance: CardInstance } => token.type === "card").map((token) => token.instance.id));
  const unmentionedRefs = cardRefs.filter((instance) => !renderedIds.has(instance.id));
  const cardButton = (instance: CardInstance, key: string, matched = instance.number) => <button className="sim-log-card" type="button" key={key} onClick={() => onInspect(instance)} aria-label={`查看 ${cardPrintingLabel(instance, cardMap)} ${translatedCardName(cardMap.get(instance.number)) || matched} 效果`}><CardFace instance={instance} cardMap={cardMap} small /><span className="sim-log-card-code">{cardPrintingLabel(instance, cardMap)}</span></button>;
  return <span className="sim-log-message">{tokens.map((token, index) => token.type === "text" ? <span key={`text-${index}`}>{token.value}</span> : cardButton(token.instance, `card-${index}-${token.instance.id}`, token.matched))}{unmentionedRefs.map((instance, index) => cardButton(instance, `ref-${index}-${instance.id}`))}</span>;
}

function CardInspector({ card, cardMap, variantId, liveState, onClose, hover = false }: { card: CardInfo; cardMap: Map<string, CardInfo>; variantId?: string; liveState?: InspectorLiveState; onClose?: () => void; hover?: boolean }) {
  const skills = [
    card.stageSkill && { label: "舞台技能", ...card.stageSkill },
    card.oshiSkill && { label: "主推技能", ...card.oshiSkill },
    card.spOshiSkill && { label: "SP 主推技能", ...card.spOshiSkill },
    card.keyword && { label: keywordLabel(card.keyword.type), ...card.keyword },
  ].filter(Boolean) as ({ label: string } & Skill)[];
  const selectedVariant = (card.variants || []).find((variant) => variant.id === variantId);
  const backImage = card.group === "cheer" ? "/card-backs/cheer-oshi.png" : "/card-backs/main.png";
  const image = selectedVariant?.image || card.image || backImage;
  const fallbackImages = [...new Set([
    ...(card.variants || []).map((variant) => variant.image),
    card.image,
    ...(card.group === "cheer" ? [...cardMap.values()]
      .filter((candidate) => candidate.group === "cheer" && candidate.number !== card.number && candidate.colorCodes?.some((color) => card.colorCodes?.includes(color)))
      .map((candidate) => candidate.image)
      .filter(Boolean)
      .slice(0, 4) : []),
    backImage,
  ].filter((candidate): candidate is string => Boolean(candidate && candidate !== image)))];
  const rarity = selectedVariant?.rarity || card.rarity;
  const inspectingLiveHolomem = Boolean(liveState?.hostNumber && liveState.hostNumber === card.number);
  const inspectorMode = inspectingLiveHolomem ? "HOLOMEM STATUS" : liveState?.hostName ? "ATTACHED CARD" : "CARD EFFECT";
  return (
    <aside className={`sim-card-inspector ${hover ? "hover-preview" : ""}`} aria-live="polite">
      {!hover && <button className="sim-inspector-close" type="button" onClick={onClose} aria-label="關閉卡片效果">×</button>}
      <div className="sim-inspector-head">
        <FoilCardImage className="sim-inspector-art" src={image} fallbackSrc={fallbackImages} alt={`${effectText(card, card.name)} ${card.number}`} rarity={rarity} loading="eager" />
        <div><p className="eyebrow">{inspectorMode}</p><h2>{effectText(card, card.name)}</h2><code>{card.number}{selectedVariant ? ` · ${selectedVariant.rarity}` : ""}</code><span className={!card.number.startsWith("hBP09-") && (isPlayableByCore(card) || card.group === "cheer") ? "automated" : "pending"}>{automationLabel(card)}</span></div>
      </div>
      {liveState && <section className="sim-inspector-live">
        <div><b>{inspectingLiveHolomem ? "目前狀態" : "所在 Holomen"}</b><span>{[liveState.ownerName, liveState.location].filter(Boolean).join(" · ")}</span></div>
        {liveState.hostName && liveState.hostName !== card.name && <p>附屬／疊放於：<strong>{liveState.hostName}</strong></p>}
        <div className="sim-inspector-live-grid">
          {typeof liveState.totalHp === "number" && <span>HP <b>{liveState.totalHp}</b></span>}
          {typeof liveState.remainingHp === "number" && <span>剩餘 HP <b>{liveState.remainingHp}</b></span>}
          {typeof liveState.damage === "number" && <span>傷害 <b>{liveState.damage}</b></span>}
          {typeof liveState.cheerCount === "number" && <span>已附聲援 <b>{liveState.cheerCount}</b></span>}
          {typeof liveState.batonCost === "number" && <span>目前接棒費 <b>{liveState.batonCost}</b></span>}
          {typeof liveState.stackCount === "number" && <span>開花疊卡 <b>{liveState.stackCount}</b></span>}
          {typeof liveState.attachmentCount === "number" && <span>附加卡 <b>{liveState.attachmentCount}</b></span>}
          {typeof liveState.rested === "boolean" && <span>狀態 <b>{liveState.rested ? "休息" : "活動"}</b></span>}
        </div>
      </section>}
      <div className="sim-inspector-copy">
        <TerminologyNote />
        {skills.map((skill, index) => <section key={`${skill.label}-${index}`}><b>{skill.label}{skill.timing ? ` · ${effectText(card, skill.timing)}` : ""}</b>{skill.name && <strong>{effectText(card, skill.name)}</strong>}<p>{effectText(card, skill.effect)}</p></section>)}
        {card.abilityText && <section><b>卡片效果</b><p>{effectText(card, card.abilityText)}</p></section>}
        {card.number.startsWith("hBP09-") && <p role="note">繁中譯文屬 AI 翻譯，未經人工覆核；跨系列規則互動仍在驗證中。</p>}
        {card.arts.map((art, index) => {
          const required = art.cost.length;
          const attached = liveState?.cheerCount;
          const shortfall = attached == null ? null : Math.max(0, required - attached);
          return <section key={`${art.name}-${index}`}><b>藝能（Arts）· 所需聲援 {art.cost.join(" / ") || "0"}</b><strong>{effectText(card, art.name)} · {art.damage ?? 0}</strong>{attached != null && <small className={shortfall === 0 ? "ready" : "short"}>目前 {attached} 張／需要 {required} 張 · {shortfall === 0 ? "數量足夠（仍須符合顏色）" : `尚欠 ${shortfall} 張`}</small>}{art.effect && <p>{effectText(card, art.effect)}</p>}</section>;
        })}
        {card.extra && <section><b>補充</b><p>{effectText(card, card.extra)}</p></section>}
        {!skills.length && !card.abilityText && !card.arts.length && !card.extra && <p>這張卡沒有額外文字效果。</p>}
      </div>
    </aside>
  );
}

export default function SimulatorClient() {
  const [cards, setCards] = useState<CardInfo[]>([]);
  const [deck, setDeck] = useState<DeckState>(emptyDeck);
  const [aiDeck, setAiDeck] = useState<DeckState | null>(null);
  const [aiDeckLabel, setAiDeckLabel] = useState("與我相同牌組（鏡像）");
  const [aiDeckChoice, setAiDeckChoice] = useState("__mirror");
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [setupOrder, setSetupOrder] = useState<string[]>([]);
  const [setupBottom, setSetupBottom] = useState<string[]>([]);
  const [pendingCard, setPendingCard] = useState("");
  const [cardChoice, setCardChoice] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const [attackSource, setAttackSource] = useState<{ zone: string; artIndex: number; artSourceNumber?: string } | null>(null);
  const [inspectedCardRef, setInspectedCardRef] = useState<HoveredCardRef | null>(null);
  const [hoveredCardRef, setHoveredCardRef] = useState<HoveredCardRef | null>(null);
  const [mobileInterface, setMobileInterface] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [handOpen, setHandOpen] = useState(true);
  const [hiddenChoiceKey, setHiddenChoiceKey] = useState("");
  const [archiveViewerIndex, setArchiveViewerIndex] = useState<number | null>(null);
  const [motionQueue, setMotionQueue] = useState<MotionBatch[]>([]);
  const [activeMotion, setActiveMotion] = useState<MotionBatch | null>(null);
  const [revealQueue, setRevealQueue] = useState<MotionBatch[]>([]);
  const [healChoice, setHealChoice] = useState<{ key: string; allocations: Record<string, number> }>({ key: "", allocations: {} });
  const [lockedCanvas, setLockedCanvas] = useState<LockedCanvas | null>(null);
  const roomRef = useRef<RoomPayload | null>(null);
  const previousRoomRef = useRef<{ code: string; version: number; state: RoomState } | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);

  function inspectCard(reference: string | CardInstance | HoveredCardRef) {
    const instance = typeof reference === "string" ? { number: reference } : reference;
    const liveReference = instance as Partial<HoveredCardRef>;
    setInspectedCardRef({
      number: instance.number,
      variantId: instance.variantId,
      playerIndex: liveReference.playerIndex,
      zone: liveReference.zone,
      location: liveReference.location,
    });
  }

  function closeInspector() {
    setInspectedCardRef(null);
  }

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.number, card])), [cards]);
  const logCardIndex = useMemo(() => buildCardReferenceIndex(cards), [cards]);
  const deckCounts = { oshi: count(deck.oshi), main: count(deck.main), cheer: count(deck.cheer) };
  const deckReady = deckCounts.oshi === 1 && deckCounts.main === 50 && deckCounts.cheer === 20;
  const selectedAiDeck = aiDeck || deck;
  const aiDeckCounts = { oshi: count(selectedAiDeck.oshi), main: count(selectedAiDeck.main), cheer: count(selectedAiDeck.cheer) };
  const aiDeckReady = aiDeckCounts.oshi === 1 && aiDeckCounts.main === 50 && aiDeckCounts.cheer === 20;
  const own = room?.state.players[viewerIndex];
  const opponent = room?.state.players[viewerIndex === 0 ? 1 : 0];
  const myTurn = room?.state.activePlayer === viewerIndex;
  const pending = room?.state.pendingChoice?.type !== "opponent" ? room?.state.pendingChoice : null;
  const choicePanelKey = attackSource
    ? `attack:${attackSource.zone}:${attackSource.artIndex}:${attackSource.artSourceNumber || ""}`
    : pending ? JSON.stringify(pending) : "";
  const choicePanelHidden = Boolean(choicePanelKey && choicePanelKey === hiddenChoiceKey);
  const aiPlayerIndex = Number.isInteger(room?.state.aiPlayer) ? Number(room?.state.aiPlayer) : -1;
  const aiPlayer = aiPlayerIndex >= 0 ? room?.state.players[aiPlayerIndex] : undefined;
  const aiNeedsStep = room?.state.mode === "solo" && aiPlayerIndex >= 0 && room.state.status !== "finished" && (room.state.pendingChoice?.playerIndex === aiPlayerIndex || (room.state.status === "setup" ? !aiPlayer?.setupDone : room.state.status === "playing" && room.state.activePlayer === aiPlayerIndex));
  const animationBusy = Boolean(activeMotion) || motionQueue.length > 0;
  const logLength = room?.state.log.length ?? 0;
  const latestLogId = room?.state.log[0]?.id ?? "";
  const matchActive = ["setup", "playing", "finished"].includes(room?.state.status || "");

  useEffect(() => { roomRef.current = room; }, [room]);

  useEffect(() => {
    let frame = 0;
    const updateCanvas = () => {
      const viewportWidth = Math.max(1, window.visualViewport?.width || window.innerWidth);
      const viewportHeight = Math.max(1, window.visualViewport?.height || window.innerHeight);
      const referenceWidth = Math.max(320, window.outerWidth || window.screen.availWidth || viewportWidth);
      const scale = Math.max(0.1, viewportWidth / referenceWidth);
      const next = { width: referenceWidth, height: viewportHeight / scale, scale };
      setLockedCanvas((current) => current && Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5 && Math.abs(current.scale - next.scale) < 0.001 ? current : next);
    };
    const scheduleCanvasUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateCanvas);
    };
    updateCanvas();
    window.addEventListener("resize", scheduleCanvasUpdate);
    window.visualViewport?.addEventListener("resize", scheduleCanvasUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleCanvasUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleCanvasUpdate);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the existing deck-builder draft once on mount
      if (stored) setDeck(JSON.parse(stored));
    } catch { /* start with an empty deck */ }
    void appFetch("/cards.json").then((response) => response.json()).then((payload) => setCards(payload.cards || [])).catch(() => setNotice("卡庫讀取失敗。"));
    void appFetch("/api/decks").then(async (response) => response.ok ? response.json() : null).then((payload) => payload?.decks && setSavedDecks(payload.decks)).catch(() => undefined);

    const code = new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "";
    const token = code ? window.localStorage.getItem(tokenKey(code)) : "";
    if (code && token) void loadRoom(code, token, true);
  }, []);

  useEffect(() => {
    if (!room?.code) return;
    if (firebaseBuild) {
      let disposed = false;
      let stop: (() => void) | undefined;
      void import('@/lib/firebase/pvp').then(pvp => {
        if (disposed) return;
        stop = pvp.watchRoom(room.code, payload => {
          setRoom((current) => !current || payload.version >= current.version ? payload : current);
          setViewerIndex(payload.viewerIndex ?? 0);
        }, setNotice);
      });
      return () => { disposed = true; stop?.(); };
    }
    const timer = window.setInterval(() => {
      const token = window.localStorage.getItem(tokenKey(room.code));
      if (token) void loadRoom(room.code, token, false);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [room?.code]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const media = window.matchMedia(mobileInterfaceQuery);
    const sync = () => {
      setMobileInterface(media.matches);
      if (media.matches) setHoveredCardRef(null);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      if (window.matchMedia(mobileInterfaceQuery).matches) return;
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-number]");
      if (!element?.dataset.cardNumber) return;
      const board = element.closest<HTMLElement>("[data-player-index]");
      const hand = element.closest<HTMLElement>("[data-hand-player-index]");
      const stage = element.closest<HTMLElement>(".sim-stage-card[data-zone]");
      const pile = element.closest<HTMLElement>("[data-pile]");
      const oshi = element.closest<HTMLElement>(".sim-oshi-position");
      const playerIndexText = board?.dataset.playerIndex || hand?.dataset.handPlayerIndex;
      const pileNames: Record<string, string> = { life: "生命", cheer: "應援牌庫", power: "Holo Power", deck: "主牌庫", archive: "存檔區" };
      const next: HoveredCardRef = {
        number: element.dataset.cardNumber,
        variantId: element.dataset.variantId,
        playerIndex: playerIndexText == null ? undefined : Number(playerIndexText),
        zone: stage?.dataset.zone,
        location: stage?.dataset.zone ? slotNames[stage.dataset.zone] || stage.dataset.zone : oshi ? "推し位置" : pile?.dataset.pile ? pileNames[pile.dataset.pile] || pile.dataset.pile : hand ? "手牌" : element.closest(".sim-log") ? "對局紀錄" : undefined,
      };
      setHoveredCardRef((current) => current?.number === next.number && current.variantId === next.variantId && current.playerIndex === next.playerIndex && current.zone === next.zone && current.location === next.location ? current : next);
    };
    const handlePointerOut = (event: PointerEvent) => {
      if (window.matchMedia(mobileInterfaceQuery).matches) return;
      const current = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-card-number]");
      const next = (event.relatedTarget as HTMLElement | null)?.closest?.<HTMLElement>("[data-card-number]");
      if (current && current.dataset.cardNumber !== next?.dataset.cardNumber) setHoveredCardRef(null);
    };
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    return () => {
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);

  useEffect(() => {
    if (!room?.code || cards.length === 0) return;
    const previous = previousRoomRef.current;
    if (!previous || previous.code !== room.code || previous.version >= room.version) {
      previousRoomRef.current = { code: room.code, version: room.version, state: room.state };
      return;
    }
    const events = buildMotionEvents(previous.state, room.state, cards, viewerIndex);
    const batches = groupMotionEvents(events, room.version);
    previousRoomRef.current = { code: room.code, version: room.version, state: room.state };
    const revealBatches = batches.filter((batch) => batch.events.every((event) => event.kind === "reveal"));
    const movementBatches = batches.filter((batch) => !batch.events.every((event) => event.kind === "reveal"));
    if (movementBatches.length) setMotionQueue((current) => [...current, ...movementBatches]);
    if (revealBatches.length) setRevealQueue((current) => [...current, ...revealBatches]);
  }, [room?.code, room?.version, room?.state, cards, viewerIndex]);

  useEffect(() => {
    if (activeMotion || motionQueue.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- play each logical motion batch sequentially
    setActiveMotion(motionQueue[0]);
    setMotionQueue((current) => current.slice(1));
  }, [activeMotion, motionQueue]);

  useEffect(() => {
    const element = logScrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [logLength, latestLogId]);

  useEffect(() => {
    if (!aiNeedsStep || busy || animationBusy || cards.length === 0) return;
    const timer = window.setTimeout(() => { void sendAction({ type: "aiStep" }); }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedule exactly once for each immutable room version
  }, [aiNeedsStep, busy, animationBusy, cards.length, room?.version]);

  async function loadRoom(code: string, token: string, announce: boolean) {
    const response = await appFetch(`/api/simulator/rooms/${encodeURIComponent(code)}`, { headers: { "x-room-token": token }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (announce) setNotice(payload.error || "未能重新連接房間。");
      return;
    }
    setRoom(payload);
    setViewerIndex(payload.viewerIndex ?? 0);
  }

  async function enterRoom(kind: "create" | "solo" | "join") {
    if (!deckReady) return setNotice("請先選擇完整的 1／50／20 牌組。 ");
    if (kind === "solo" && !aiDeckReady) return setNotice("請先選擇完整的 AI 牌組。 ");
    if (!name.trim()) return setNotice("請輸入玩家名稱。 ");
    setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const url = kind === "join" ? `/api/simulator/rooms/${encodeURIComponent(code)}/join` : "/api/simulator/rooms";
      const response = await appFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, deck, singlePlayer: kind === "solo", opponentDeck: kind === "solo" ? selectedAiDeck : undefined }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "房間操作失敗。 ");
      window.localStorage.setItem(tokenKey(payload.code), payload.token);
      window.history.replaceState({}, "", `/simulator?room=${encodeURIComponent(payload.code)}`);
      setRoom(payload);
      setViewerIndex(kind === "join" ? 1 : 0);
      setNotice(kind === "solo" ? `單人對戰已開始；AI 使用「${aiDeckLabel}」。` : kind === "create" ? "私人房間已建立，將房間碼傳給朋友吧！" : "已加入私人房間。 ");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "房間操作失敗。 ");
    } finally { setBusy(false); }
  }

  async function sendAction(action: Record<string, unknown>) {
    const current = roomRef.current;
    if (!current || busy || animationBusy) return;
    const token = window.localStorage.getItem(tokenKey(current.code));
    if (!token) return setNotice("房間憑證遺失，請重新加入。 ");
    setBusy(true);
    try {
      const response = await appFetch(`/api/simulator/rooms/${encodeURIComponent(current.code)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-room-token": token },
        body: JSON.stringify({ expectedVersion: current.version, action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) await loadRoom(current.code, token, false);
        throw new Error(payload.error || "操作失敗。 ");
      }
      setRoom(payload);
      setViewerIndex(payload.viewerIndex ?? viewerIndex);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "操作失敗。 ");
    } finally { setBusy(false); }
  }

  async function importDeck(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      let incoming = parsed.deck || parsed;
      if (isHoloSimDeck(parsed)) {
        incoming = fromHoloSimDeck(parsed);
      }
      if (!incoming?.oshi || !incoming?.main || !incoming?.cheer) throw new Error();
      setDeck(incoming);
      setNotice("牌組已匯入，入房前會再核對卡號及限制。 ");
    } catch { setNotice("無法讀取這個牌組檔案。 "); }
  }

  async function importAiDeck(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      let incoming = parsed.deck || parsed;
      if (isHoloSimDeck(parsed)) incoming = fromHoloSimDeck(parsed);
      if (!incoming?.oshi || !incoming?.main || !incoming?.cheer) throw new Error();
      setAiDeck(incoming);
      setAiDeckLabel(file.name.replace(/\.json$/iu, ""));
      setAiDeckChoice("__imported");
      setNotice("AI 牌組已匯入。 ");
    } catch { setNotice("無法讀取 AI 牌組檔案。 "); }
  }

  function exportReview(format: string) {
    if(!room?.code?.startsWith('AI-'))return setNotice('只可匯出此裝置嘅離線 AI 對局。');
    try{const saved=JSON.parse(localStorage.getItem('holo-solo-v1:'+room.code)||'null');downloadReview(saved,format);setNotice('已準備 AI Review 下載，包含離線雙方手牌及牌庫。');}
    catch(error){setNotice(error instanceof Error?error.message:'匯出失敗，對局已保留。');}
  }
  async function copyRoomCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setNotice(`房間碼 ${room.code} 已複製。`);
    } catch { setNotice(`房間碼：${room.code}`); }
  }

  function chooseSetupCard(id: string) {
    const stage = cardMap.get(own?.hand?.find((card) => card?.id === id)?.number || "")?.stage;
    setSetupOrder((current) => {
      const selectedIndex = current.indexOf(id);
      if (selectedIndex === 0) return [];
      if (selectedIndex > 0) return current.filter((value) => value !== id);
      if (current.length === 0 && stage !== "Debut") return current;
      if (current.length > 0 && !["Debut", "Spot"].includes(stage || "")) return current;
      return current.length < 6 ? [...current, id] : current;
    });
    setSetupBottom((current) => current.filter((value) => value !== id));
  }

  function toggleSetupBottom(id: string) {
    const required = Number(own?.forcedRedraws || 0);
    if (setupOrder.includes(id)) return;
    setSetupBottom((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < required ? [...current, id] : current);
  }

  function redrawOpening() {
    setSetupOrder([]);
    setSetupBottom([]);
    void sendAction({ type: "redraw" });
  }

  function submitSetup() {
    if (!setupOrder[0]) return setNotice("請先按 1 張 Debut；第一張會成為中央 Holomen。 ");
    const required = Number(own?.forcedRedraws || 0);
    if (setupBottom.length !== required) return setNotice(`請選擇 ${required} 張剩餘手牌放到主牌庫底。`);
    void sendAction({ type: "setup", centerId: setupOrder[0], backIds: setupOrder.slice(1), bottomIds: setupBottom });
  }

  function playHandCard(instance: CardInstance) {
    const card = cardMap.get(instance.number);
    if (!isPlayableByCore(card)) {
      inspectCard(instance);
      return setNotice(`「${translatedCardName(card) || instance.number}」的完整文字效果仍未接入；效果窗已打開，避免系統作出錯誤裁定。`);
    }
    setPendingCard("");
    void sendAction({ type: "play", cardId: instance.id });
  }

  function selectOwnTableZone(zone: string) {
    if (!pending) return;
    if (pending.type === "ordinaryComputer") {
      if (!pendingCard) return setNotice("先在效果列揀 1 張 Debut，再直接按牌桌高亮空位。 ");
      void sendAction({ type: "choose", cardNumber: pendingCard, zone });
      setPendingCard("");
      return;
    }
    void sendAction({ type: "choose", zone });
  }

  function selectAttachedCheer(cheerId: string) {
    if (!pending || !["moveCheer", "archiveCheerForSkill", "payStageCheerForSearch", "moveStageCheerSource", "stageCheerSelection"].includes(pending.type)) return;
    void sendAction({ type: "choose", cheerId });
  }

  function selectAttachedSupport(attachmentId: string) {
    if (pending?.type !== "stageAttachmentSelection") return;
    void sendAction({ type: "choose", attachmentId });
  }

  function toggleCardChoice(id: string, key: string, max: number) {
    setCardChoice((current) => {
      const ids = current.key === key ? current.ids : [];
      if (ids.includes(id)) return { key, ids: ids.filter((value) => value !== id) };
      return ids.length < max ? { key, ids: [...ids, id] } : current;
    });
  }

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("sim-match-viewport-lock", matchActive);
    document.body.classList.toggle("sim-match-viewport-lock", matchActive);
    return () => {
      document.documentElement.classList.remove("sim-match-viewport-lock");
      document.body.classList.remove("sim-match-viewport-lock");
    };
  }, [matchActive]);

  if (!room) {
    return (
      <main className="simulator-page">
        <header className="topbar">
          <Link className="brand" href="/"><span className="brand-mark">H</span><span><strong>私人 PvP 模擬器</strong><small>HOLOLIVE OCG · AUTO CORE</small></span></Link>
          <div className="topbar-actions"><ThemeToggle /><Link className="account-button" href="/">返回卡庫</Link></div>
        </header>
        <section className="sim-landing">
          <div className="sim-hero-copy">
            <p className="eyebrow">PRIVATE ROOM / DECK TEST</p>
            <h1>同朋友對戰，<br />或者挑戰智能 AI。</h1>
            <p>單人模式會按 AI 實際牌組、卡牌效果、Bloom 路線、應援費用、擊倒機會及場面資源逐步評分。私人房間亦繼續支援朋友用房間碼加入。</p>
            <div className="sim-coverage">
              <span><b>AI</b>牌面感知決策與合法行動模擬</span>
              <span><b>自動</b>私人同步與隱藏資訊</span>
              <span><b>自動</b>共用支援牌、Holomen、Gift、Arts 與推し效果</span>
              <span><b>清楚</b>每張卡可即時查看效果／接入狀態</span>
            </div>
          </div>
          <section className="sim-room-card">
            <p className="eyebrow">ENTER THE TABLE</p>
            <h2>準備牌組</h2>
            <label><span>玩家名稱</span><input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="例如：こより助手" /></label>
            {savedDecks.length > 0 && <label><span>已保存牌組</span><select defaultValue="" onChange={(event) => { const selected = savedDecks.find((item) => item.id === event.target.value); if (selected) setDeck(selected.deck); }}><option value="" disabled>選擇牌組…</option>{savedDecks.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
            <label className="sim-import">匯入網站／HoloSim JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importDeck(event.target.files?.[0]); event.target.value = ""; }} /></label>
            <div className={`sim-deck-count ${deckReady ? "ok" : ""}`}><span>推し <b>{deckCounts.oshi}/1</b></span><span>主牌 <b>{deckCounts.main}/50</b></span><span>應援 <b>{deckCounts.cheer}/20</b></span></div>
            <section className="sim-ai-deck-picker">
              <div><span>AI 使用牌組</span><b>{aiDeckLabel}</b></div>
              <select value={aiDeckChoice} onChange={(event) => {
                setAiDeckChoice(event.target.value);
                if (event.target.value === "__mirror") { setAiDeck(null); setAiDeckLabel("與我相同牌組（鏡像）"); return; }
                const selected = savedDecks.find((item) => item.id === event.target.value);
                if (selected) { setAiDeck(selected.deck); setAiDeckLabel(`已保存：${selected.name}`); }
              }}>
                <option value="__mirror">與我相同牌組（鏡像）</option>
                {aiDeck && !aiDeckLabel.startsWith("已保存：") && <option value="__imported">已匯入：{aiDeckLabel}</option>}
                {savedDecks.map((item) => <option value={item.id} key={`ai-${item.id}`}>已保存：{item.name}</option>)}
              </select>
              <label className="sim-import">另行匯入 AI 牌組<input type="file" accept="application/json,.json" onChange={(event) => { void importAiDeck(event.target.files?.[0]); event.target.value = ""; }} /></label>
              <div className={`sim-deck-count ${aiDeckReady ? "ok" : ""}`}><span>推し <b>{aiDeckCounts.oshi}/1</b></span><span>主牌 <b>{aiDeckCounts.main}/50</b></span><span>應援 <b>{aiDeckCounts.cheer}/20</b></span></div>
            </section>
            <button className="sim-primary sim-ai-start" type="button" disabled={busy || !deckReady || !aiDeckReady} onClick={() => void enterRoom("solo")}>{busy ? "AI 正在準備…" : "開始單人對戰 · 智能 AI"}</button>
            <button className="sim-secondary" type="button" disabled={busy || !deckReady} onClick={() => void enterRoom("create")}>建立私人房間</button>
            <div className="sim-or"><span>或用房間碼加入</span></div>
            <div className="sim-join-row"><input value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC234" /><button type="button" disabled={busy || joinCode.trim().length !== 6 || !deckReady} onClick={() => void enterRoom("join")}>加入</button></div>
            <small>房間約 36 小時後自動失效；房間憑證只保存在這部裝置。</small>
          </section>
        </section>
        <section className="sim-reference-note"><b>效果自動化狀態</b><p>已按官方流程接入開局、回合、Bloom、合作、接力，以及共用支援牌、Holomen 關鍵字／Gift、Arts 與推し效果。牌庫頂查看、條件搜尋、抽牌、回收、特殊傷害、位置互換、應援改附與舞台成本均會自動處理；涉及舞台位置、Holomen、應援或附加卡的目標，會直接高亮實際牌桌卡片。</p></section>
        {notice && <div className="toast" role="status">{notice}</div>}
      </main>
    );
  }

  const state = room.state;
  const openingCards = (own?.hand || []).filter((instance): instance is CardInstance => Boolean(instance));
  const forcedRedraws = Number(own?.forcedRedraws || 0);
  const targetPlayer = state.players[viewerIndex === 0 ? 1 : 0];
  const attackSourceUnit = attackSource ? own?.zones?.[attackSource.zone] : null;
  const attackSourceCard = cardMap.get(attackSource?.artSourceNumber || topNumber(attackSourceUnit));
  const intrinsicBackAttack = Boolean(attackSource && ((attackSourceCard?.number === "hBP01-081" && attackSource.artIndex === 0) || (attackSourceCard?.number === "hSD12-004" && attackSource.artIndex === 0)));
  const fuwawaBackAttack = topNumber(attackSourceUnit) === "hBP08-059" && Object.values(own?.zones || {}).reduce((count, stageUnit) => count + (stageUnit?.cheer || []).filter((instance) => (cardMap.get(instance.number)?.colors || []).includes("紅")).length, 0) >= 6;
  const damagedBackAttack = Boolean(attackSourceUnit?.modifiers?.some((modifier) => modifier.kind === "attackDamagedBack" && Number(modifier.expiresTurn || 0) >= state.turn));
  const secondBackAttack = Boolean(attackSourceUnit?.modifiers?.some((modifier) => modifier.kind === "attackSecondBack" && Number(modifier.expiresTurn || 0) >= state.turn));
  const unrestrictedBackAttack = intrinsicBackAttack || Boolean(attackSourceUnit?.modifiers?.some((modifier) => modifier.kind === "attackBack" && Number(modifier.expiresTurn || 0) >= state.turn));
  const canAttackBack = unrestrictedBackAttack || fuwawaBackAttack || damagedBackAttack || secondBackAttack;
  const attackTargets = (canAttackBack ? ["center", "collab", ...backSlots] : ["center", "collab"]).filter((zone) => {
    const target = targetPlayer?.zones?.[zone];
    if (!target) return false;
    if (!backSlots.includes(zone) || unrestrictedBackAttack) return true;
    const targetCard = cardMap.get(topNumber(target));
    return (fuwawaBackAttack && targetCard?.stage !== "Debut")
      || (damagedBackAttack && Number(target.damage || 0) > 0)
      || (secondBackAttack && targetCard?.stage === "2nd");
  });
  const setupPreviewZones = { ...(own?.zones || {}) };
  if (state.status === "setup" && own && !own.setupDone) {
    setupOrder.forEach((id, index) => {
      const selected = openingCards.find((instance) => instance.id === id);
      const zone = index === 0 ? "center" : backSlots[index - 1];
      if (selected && zone) setupPreviewZones[zone] = { stack: [selected], cheer: [], attachments: [], damage: 0, rested: false };
    });
  }
  const displayedOwn = own ? { ...own, zones: setupPreviewZones } : undefined;
  const zonePendingTypes = new Set(["playHolomen", "bloom", "bonusBloomTarget", "cheerTarget", "lifeCheerTarget", "centerReplacement", "attachSupport", "healTarget", "eventCheerTarget", "forcedCollab", "attachArchivedSupport", "unrestTarget", "endToolDamage", "swapOwnCenter", "moveStageCheerTarget", "stageTarget"]);
  const pendingTargetsOpponent = pending?.type === "stageTarget" && pending.targetPlayerIndex === (viewerIndex === 0 ? 1 : 0);
  const pendingTargetsOwn = pending?.type !== "stageTarget" || pending.targetPlayerIndex == null || pending.targetPlayerIndex === viewerIndex;
  const ownSelectableZones = pending?.type === "ordinaryComputer" ? pendingCard ? (pending.zones || []) : [] : pending && pendingTargetsOwn && zonePendingTypes.has(pending.type) ? (pending.options || []) : [];
  const ownSelectableCheerIds = pending && ["moveCheer", "archiveCheerForSkill", "payStageCheerForSearch", "moveStageCheerSource", "stageCheerSelection"].includes(pending.type) && (pending.type !== "stageCheerSelection" || pending.ownerIndex == null || pending.ownerIndex === viewerIndex) ? (pending.options || []) : [];
  const opponentSelectableCheerIds = pending?.type === "stageCheerSelection" && pending.ownerIndex === (viewerIndex === 0 ? 1 : 0) ? (pending.options || []) : [];
  const ownSelectableAttachmentIds = pending?.type === "stageCheerSelection" && (pending.ownerIndex == null || pending.ownerIndex === viewerIndex) ? (pending.cheerOptions || []).filter(option => option.cheerSubstitute).map(option => option.id) : pending?.type === "stageAttachmentSelection" && (pending.ownerIndex == null || pending.ownerIndex === viewerIndex) ? (pending.options || []) : [];
  const opponentSelectableAttachmentIds = pending?.type === "stageAttachmentSelection" && pending.ownerIndex === (viewerIndex === 0 ? 1 : 0) ? (pending.options || []) : [];
  const cardChoiceKey = pending?.type === "cardSelection" ? `${pending.effect || "cards"}:${(pending.cards || []).map((card) => card.id).join(",")}` : "";
  const selectedCardIds = cardChoice.key === cardChoiceKey ? cardChoice.ids : [];
  const healChoiceKey = pending?.type === "healDistribution" ? `${room.version}:${pending.sourceName || "heal"}:${pending.count || 0}` : "";
  const healAllocations = healChoice.key === healChoiceKey ? healChoice.allocations : {};
  const healAssigned = Object.values(healAllocations).reduce((sum, value) => sum + Number(value || 0), 0);
  const healRequired = pending?.type === "healDistribution" ? Number(pending.count || 0) : 0;
  const adjustHeal = (zone: string, difference: number) => {
    setHealChoice((current) => {
      const allocations = current.key === healChoiceKey ? { ...current.allocations } : {};
      const assigned = Object.values(allocations).reduce((sum, value) => sum + Number(value || 0), 0);
      const next = Math.max(0, Number(allocations[zone] || 0) + difference);
      if (difference > 0 && assigned >= healRequired) return { key: healChoiceKey, allocations };
      if (next === 0) delete allocations[zone];
      else allocations[zone] = next;
      return { key: healChoiceKey, allocations };
    });
  };
  const opponentSelectableZones = attackSource ? attackTargets : pendingTargetsOpponent ? (pending?.options || []) : [];
  const inspectedCard = cardMap.get(inspectedCardRef?.number || "");
  const inspectedLiveState = inspectorLiveStateFor(state, inspectedCardRef, cardMap);
  const hoveredCard = mobileInterface ? undefined : cardMap.get(hoveredCardRef?.number || "");
  const hoveredLiveState = mobileInterface ? undefined : inspectorLiveStateFor(state, hoveredCardRef, cardMap);
  const archivedPlayer = archiveViewerIndex == null ? undefined : state.players[archiveViewerIndex];
  const ownBatonIncrease = suuBatonIncrease(opponent, cardMap);
  const opponentBatonIncrease = suuBatonIncrease(displayedOwn, cardMap);
  const lockedHeight = lockedCanvas?.height || 900;
  const lockedWidth = lockedCanvas?.width || 1600;

  const bounded = (minimum: number, value: number, maximum: number) => Math.max(minimum, Math.min(value, maximum));
  const matchCanvasStyle = matchActive && lockedCanvas ? {
    width: `${lockedCanvas.width}px`,
    height: `${lockedCanvas.height}px`,
    transform: `scale(${lockedCanvas.scale})`,
    "--sim-locked-canvas-width": `${lockedCanvas.width}px`,
    "--sim-locked-canvas-height": `${lockedCanvas.height}px`,
    "--sim-locked-label-size": `${bounded(12, Math.min(lockedWidth * 0.0072, lockedHeight * 0.0125), 15)}px`,
    "--sim-locked-detail-size": `${bounded(11, Math.min(lockedWidth * 0.0066, lockedHeight * 0.0112), 14)}px`,
    "--sim-locked-player-size": `${bounded(14, Math.min(lockedWidth * 0.0084, lockedHeight * 0.015), 18)}px`,
    "--sim-locked-unit-size": `${bounded(13, Math.min(lockedWidth * 0.0076, lockedHeight * 0.0142), 16)}px`,
    "--sim-locked-stage-card-width": `${bounded(76, lockedHeight * 0.108, 108)}px`,
    "--sim-locked-pile-card-width": `${bounded(62, lockedHeight * 0.082, 82)}px`,
    "--sim-locked-stage-side-width": `${bounded(126, lockedWidth * 0.085, 174)}px`,
    "--sim-locked-hand-card-width": `${bounded(50, lockedHeight * 0.06, 72)}px`,
    "--sim-locked-opening-card-width": `${bounded(76, lockedWidth * 0.063, 98)}px`,
    "--sim-locked-hand-panel-height": `${bounded(92, lockedHeight * 0.13, 136)}px`,
    "--sim-locked-setup-height": `${bounded(420, lockedHeight * 0.72, 680)}px`,
  } as CSSProperties : undefined;

  return (
    <main style={matchCanvasStyle} data-canvas-scale={lockedCanvas?.scale} className={`simulator-page sim-table-page sim-status-${state.status} ${matchActive ? `sim-match-active sim-zoom-locked ${lockedHeight < 620 ? "sim-short-canvas" : ""}` : ""}`}>
      <header className="topbar">
        <Link className="brand" href="/simulator"><span className="brand-mark">H</span><span><strong>{state.mode === "solo" ? "單人 AI 模擬器" : "私人 PvP 模擬器"}</strong><small>{state.mode === "solo" ? "CARD-AWARE EXPERT" : `ROOM ${room.code}`}</small></span></Link>
        <div className="topbar-actions">{state.mode === 'solo' && firebaseBuild && <><button className="account-button" onClick={()=>exportReview('zip')}>AI Review ZIP</button><button className="account-button" onClick={()=>exportReview('json')}>AI Review JSON</button></>}{state.mode !== "solo" && <button className="sim-code-button" type="button" onClick={() => void copyRoomCode()}><span>房間碼</span><b>{room.code}</b></button>}<ThemeToggle /><Link className="account-button" href="/">卡庫</Link></div>
      </header>

      {state.status === "waiting" || state.status === "lobby" ? (
        <section className="sim-lobby-panel">
          <p className="eyebrow">PRIVATE LOBBY</p><h1>{state.status === "waiting" ? "等朋友輸入房間碼…" : "雙方到齊，準備開始。"}</h1>
          <button className="sim-share-code" type="button" onClick={() => void copyRoomCode()}>{room.code}<span>點擊複製</span></button>
          <div className="sim-seats">{[0, 1].map((index) => <div className={state.players[index]?.ready ? "ready" : ""} key={index}><span>{index === 0 ? "房主" : "朋友"}</span><b>{state.players[index]?.name || "等待加入"}</b><small>{state.players[index]?.ready ? "已準備" : "未準備"}</small></div>)}</div>
          {state.players.length === 2 && <button className="sim-primary" disabled={busy} type="button" onClick={() => void sendAction({ type: "ready", ready: !own?.ready })}>{own?.ready ? "取消準備" : "我已準備"}</button>}
        </section>
      ) : (
        <section className={`sim-game-shell ${handOpen ? "hand-open" : "hand-collapsed"} ${animationBusy ? "animation-playing" : ""}`} aria-busy={animationBusy}>
          {opponent && <Board player={opponent} playerIndex={viewerIndex === 0 ? 1 : 0} own={false} cardMap={cardMap} active={state.status === "playing" && state.activePlayer !== viewerIndex} phase={state.phase} turn={state.turn} opponentBatonIncrease={opponentBatonIncrease} actionsEnabled={false} mobileStatus={mobileInterface} selectableZones={opponentSelectableZones} selectableCheerIds={opponentSelectableCheerIds} selectableAttachmentIds={opponentSelectableAttachmentIds} onSelectCheer={selectAttachedCheer} onSelectAttachment={selectAttachedSupport} onSelectZone={(zone) => { if (attackSource) { void sendAction({ type: "attack", sourceZone: attackSource.zone, artIndex: attackSource.artIndex, artSourceNumber: attackSource.artSourceNumber, targetZone: zone }); setAttackSource(null); } else if (pendingTargetsOpponent) void sendAction({ type: "choose", zone }); }} onInspect={inspectCard} onOpenArchive={() => setArchiveViewerIndex(viewerIndex === 0 ? 1 : 0)} onAction={() => undefined} onAttack={() => undefined} />}
          {attackSource && !choicePanelHidden && <section className="sim-action-dock opponent-target"><button className="sim-panel-minimize" type="button" aria-label="暫時收起攻擊目標提示" onClick={() => setHiddenChoiceKey(choicePanelKey)}>−</button><div><p className="eyebrow">ARTS TARGET · TABLE CLICK</p><h2>直接按對手牌桌上高亮的 Holomen</h2><p>中央或合作位置會閃動；你按下的實際卡片就是 Arts 目標。</p></div><button className="sim-cancel" type="button" onClick={() => setAttackSource(null)}>取消攻擊</button></section>}
          <div className="sim-turn-bar"><span>{state.status === "setup" ? "開局" : `第 ${state.turn} 回合`}</span><div className="sim-turn-phase"><b>{state.status === "finished" ? `${state.players[state.winner ?? 0]?.name} 勝出` : state.status === "setup" ? "開局設置" : `${phaseNames[state.phase] || state.phase}階段`}</b>{state.status === "playing" && myTurn && ["main", "performance"].includes(state.phase) && <button className="sim-turn-advance" type="button" disabled={busy || animationBusy || Boolean(state.pendingChoice)} onClick={() => void sendAction({ type: "advance" })}>{state.phase === "main" ? state.firstPlayer === viewerIndex && own?.turnsTaken === 1 ? "結束主要（首回合）" : "前往表演" : "結束回合"}</button>}</div><span>{state.status === "setup" ? own?.setupDone ? state.mode === "solo" ? aiPlayer?.setupDone ? "AI 已完成設置" : "AIこより準備中 · 每步 3 秒" : "等待對手" : "在手牌按次序選擇" : myTurn ? "你的回合" : state.mode === "solo" ? "AIこより思考中 · 每步 3 秒" : "對手回合"}</span></div>
          {pending && !choicePanelHidden && <section className="sim-action-dock">
            <button className="sim-panel-minimize" type="button" aria-label="暫時收起自動效果選擇" onClick={() => setHiddenChoiceKey(choicePanelKey)}>−</button>
            <div><p className="eyebrow">AUTOMATIC EFFECT</p><h2>{pendingTitle(pending, pendingCard)}</h2><p>{pending.prompt || `${pending.cardNumber ? `處理中：${translatedCardName(cardMap.get(pending.cardNumber)) || pending.cardNumber}。` : ""} 合法位置已直接標示在牌桌上。`}</p></div>
            {["cheerTarget", "lifeCheerTarget", "eventCheerTarget"].includes(pending.type) && pending.cardNumber && <CardFace instance={{ id: `revealed-${pending.cardNumber}`, number: pending.cardNumber }} cardMap={cardMap} small />}
            {pending.type === "ordinaryComputer" && <div className="sim-debut-options">{(pending.options || []).map((number) => <button type="button" className={pendingCard === number ? "selected" : ""} onClick={() => setPendingCard(number)} key={number}><CardFace instance={{ id: number, number }} cardMap={cardMap} /><span>{translatedCardName(cardMap.get(number))}</span></button>)}</div>}
            {pending.type === "cardSelection" && <div className="sim-effect-card-choice">{(pending.cards || []).map((instance) => {
              const selectable = (pending.selectableIds || []).includes(instance.id);
              const order = selectedCardIds.indexOf(instance.id);
              return <button type="button" disabled={!selectable} className={order >= 0 ? "selected" : ""} onClick={() => toggleCardChoice(instance.id, cardChoiceKey, Number(pending.max || 1))} key={instance.id}><CardFace instance={instance} cardMap={cardMap} /><span>{order >= 0 ? `選擇次序 ${order + 1}` : selectable ? "按此選擇" : "不符合條件"}</span></button>;
            })}<div className="sim-effect-choice-actions"><span>已選 {selectedCardIds.length}/{pending.min === pending.max ? pending.max : `${pending.min}–${pending.max}`}</span><button className="sim-primary" type="button" disabled={selectedCardIds.length < Number(pending.min || 0) || selectedCardIds.length > Number(pending.max || 0)} onClick={() => { void sendAction({ type: "choose", cardIds: selectedCardIds }); setCardChoice({ key: "", ids: [] }); }}>確認卡片選擇</button></div></div>}
            {pending.type === "healDistribution" && <div className="sim-heal-confirm"><span>已分配 <b>{healAssigned}</b> / {healRequired} 個「{pending.unitAmount || 20} HP」</span><small>直接喺下方每位 Holomen 卡上按 −／＋；同一位可以獲分配多次。</small><button className="sim-primary" type="button" disabled={healAssigned !== healRequired} onClick={() => { void sendAction({ type: "choose", allocations: healAllocations }); setHealChoice({ key: "", allocations: {} }); }}>確認全部回血分配</button></div>}
            {pending.type === "optionChoice" && <div className="sim-effect-choice-actions">{(pending.modeOptions || []).map((option) => <button className="sim-primary" type="button" disabled={option.disabled} key={option.id} onClick={() => void sendAction({ type: "choose", optionId: option.id })}>{option.label}</button>)}</div>}
            {pending.optional && <button type="button" className="sim-cancel" onClick={() => { void sendAction({ type: "choose", skip: true }); setCardChoice({ key: "", ids: [] }); }}>略過可選效果</button>}
          </section>}
          {choicePanelHidden && <button className="sim-choice-reopen" type="button" onClick={() => setHiddenChoiceKey("")}><span aria-hidden="true">⌃</span>{attackSource ? "攻擊目標" : "繼續卡牌選擇"}</button>}
          {displayedOwn && <Board player={displayedOwn} playerIndex={viewerIndex} own cardMap={cardMap} active={state.status === "playing" && Boolean(myTurn)} phase={state.phase} turn={state.turn} opponentBatonIncrease={ownBatonIncrease} actionsEnabled={state.status === "playing" && !Boolean(pending) && !Boolean(attackSource) && !busy && !animationBusy} mobileStatus={mobileInterface} selectableZones={ownSelectableZones} selectableCheerIds={ownSelectableCheerIds} selectableAttachmentIds={ownSelectableAttachmentIds} healAllocations={pending?.type === "healDistribution" ? healAllocations : undefined} healUnitAmount={Number(pending?.unitAmount || 20)} healAssigned={healAssigned} healRequired={healRequired} onAdjustHeal={adjustHeal} onSelectZone={selectOwnTableZone} onSelectCheer={selectAttachedCheer} onSelectAttachment={selectAttachedSupport} onInspect={inspectCard} onOpenArchive={() => setArchiveViewerIndex(viewerIndex)} onAction={(action) => void sendAction(action)} onAttack={(zone, artIndex, artSourceNumber) => setAttackSource({ zone, artIndex, artSourceNumber })} />}
          {handOpen ? <section className="sim-hand-panel" data-hand-player-index={viewerIndex}>
            <div className="sim-hand-header"><h2>你的手牌</h2><span>{own?.handCount || 0} 張</span><button className="sim-hand-toggle" type="button" aria-label="收起手牌" onClick={() => setHandOpen(false)}>⌄</button></div>
            {state.status === "setup" ? own?.setupDone ? <div className="sim-setup-wait"><b>你的舞台已鎖定</b><span>對手完成後，雙方舞台會同時公開並自動開始第 1 回合。</span></div> : <>
              <div className="sim-opening-guide"><div><b>第 1 張 → 中央；之後 → 後排</b><span>直接按下方手牌，卡片會即時出現在上面牌桌的正確位置。</span></div><button type="button" disabled={busy || animationBusy || own?.mulliganUsed} onClick={redrawOpening}>{own?.mulliganUsed ? "已使用重抽" : "洗回重抽 7 張（每場 1 次）"}</button></div>
              <div className="sim-opening-order"><span>目前次序</span><b>{setupOrder.length === 0 ? "先按 1 張 Debut" : setupOrder.map((_, index) => index === 0 ? "中央" : `後排 ${index}`).join(" → ")}</b></div>
              <div className="sim-opening-hand">{openingCards.map((instance) => {
                const stage = cardMap.get(instance.number)?.stage || "";
                const selectedIndex = setupOrder.indexOf(instance.id);
                const canAdd = setupOrder.length === 0 ? stage === "Debut" : ["Debut", "Spot"].includes(stage) && setupOrder.length < 6;
                const label = selectedIndex === 0 ? "中央 · 第 1 張" : selectedIndex > 0 ? `後排 ${selectedIndex}` : setupOrder.length === 0 ? stage === "Debut" ? "按此設為中央" : "第一張必須 Debut" : canAdd ? `按此設為後排 ${setupOrder.length}` : "留在手牌";
                return <div className="sim-mobile-hand-option" key={instance.id}><button type="button" disabled={selectedIndex < 0 && !canAdd} className={selectedIndex >= 0 ? "selected" : ""} onClick={() => chooseSetupCard(instance.id)}><CardFace instance={instance} cardMap={cardMap} /><span>{label}</span></button><button className="sim-mobile-card-effect" type="button" onClick={() => inspectCard(instance)} aria-label={`查看${translatedCardName(cardMap.get(instance.number)) || instance.number}效果`}>效果</button></div>;
              })}</div>
              {forcedRedraws > 0 && <section className="sim-opening-penalty"><div><b>強制重抽補正</b><span>揀 {forcedRedraws} 張未放舞台的手牌置於主牌庫底（{setupBottom.length}/{forcedRedraws}）。</span></div><div className="sim-opening-hand">{openingCards.filter((instance) => !setupOrder.includes(instance.id)).map((instance) => <button type="button" className={setupBottom.includes(instance.id) ? "selected" : ""} disabled={!setupBottom.includes(instance.id) && setupBottom.length >= forcedRedraws} onClick={() => toggleSetupBottom(instance.id)} key={`bottom-${instance.id}`}><CardFace instance={instance} cardMap={cardMap} /><span>{setupBottom.includes(instance.id) ? `牌庫底 ${setupBottom.indexOf(instance.id) + 1}` : "放到牌庫底"}</span></button>)}</div></section>}
              <button className="sim-primary sim-setup-confirm" type="button" disabled={!setupOrder[0] || setupBottom.length !== forcedRedraws || busy || animationBusy} onClick={submitSetup}>確認舞台設置</button>
            </> : <div className="sim-hand-row">{(own?.hand || []).map((instance, index) => instance ? <article className="sim-hand-card" key={instance.id}><button className="sim-hand-play" type="button" disabled={!myTurn || state.phase !== "main" || busy || animationBusy || Boolean(state.pendingChoice)} onClick={() => playHandCard(instance)}><CardFace instance={instance} cardMap={cardMap} /><span>{isPlayableByCore(cardMap.get(instance.number)) ? "使用" : "查看未接入效果"}</span></button><button className="sim-mobile-card-effect sim-mobile-hand-effect" type="button" onClick={() => inspectCard(instance)} aria-label={`查看${translatedCardName(cardMap.get(instance.number)) || instance.number}效果`}>效果</button></article> : <CardFace key={index} hidden cardMap={cardMap} />)}</div>}
          </section> : <button className="sim-hand-reopen" type="button" aria-label="展開手牌" onClick={() => setHandOpen(true)}><span aria-hidden="true">⌃</span>手牌 {own?.handCount || 0}</button>}
        </section>
      )}

      <aside className={`sim-log ${logOpen ? "open" : "collapsed"}`} aria-label="可收合對局紀錄">
        <button className="sim-log-toggle" type="button" aria-expanded={logOpen} aria-label={logOpen ? "收起對局紀錄" : "展開對局紀錄"} onClick={() => setLogOpen((current) => !current)}><span aria-hidden="true">{logOpen ? "›" : "‹"}</span><b>紀錄</b></button>
        <header><div><h2>對局紀錄</h2><span>完整記錄 · {state.log.length} 項</span></div><small>由開局至最新行動 · 實際卡號＋稀有度</small></header>
        <div className="sim-log-scroll" ref={logScrollRef}>{[...state.log].reverse().map((entry, index) => <p key={entry.id}><time>{String(index + 1).padStart(3, "0")} · {new Date(entry.at).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><LogMessage message={entry.message} referenceIndex={logCardIndex} cardRefs={entry.cardRefs} cardMap={cardMap} onInspect={(instance) => { inspectCard(instance); setLogOpen(false); }} /></p>)}</div>
      </aside>

      {archivedPlayer && <ArchiveViewer player={archivedPlayer} cardMap={cardMap} onClose={() => setArchiveViewerIndex(null)} onInspect={(number) => { inspectCard(number); setArchiveViewerIndex(null); }} />}
      {activeMotion && <CardMotionLayer batch={activeMotion} cardMap={cardMap} onDone={() => setActiveMotion(null)} />}
      {revealQueue[0] && <RevealConfirmation batch={revealQueue[0]} cardMap={cardMap} onConfirm={() => setRevealQueue((current) => current.slice(1))} />}
      {hoveredCard ? <CardInspector card={hoveredCard} cardMap={cardMap} variantId={hoveredCardRef?.variantId} liveState={hoveredLiveState} hover /> : inspectedCard && <CardInspector card={inspectedCard} cardMap={cardMap} variantId={inspectedCardRef?.variantId} liveState={inspectedLiveState} onClose={closeInspector} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
