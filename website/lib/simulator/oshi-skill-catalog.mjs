const DEFAULT_OSHI_COST = 2;
const DEFAULT_SP_COST = 2;

// These cards are available to browse and build decks with, but their engine
// resolvers are not implemented by the database import. Never assume 2/2 costs
// or offer an activation that would spend power without resolving an effect.
export const CATALOG_ONLY_OSHI = Object.freeze([]); // hBP09 resolvers installed

// Official Holo Power costs that differ from the common 2 / 2 template.
// Cards without an SP skill simply never ask for the SP value.
const COST_OVERRIDES = Object.freeze({
  "hBP09-002": { oshi: "X" },
  "hBP09-006": { sp: 3 },
  "hBP01-001": { oshi: 3 },
  "hBP01-004": { sp: 3 },
  "hBP01-005": { oshi: "X" },
  "hBP01-008": { oshi: 1, sp: 3 },
  "hBP02-003": { oshi: 3 },
  "hBP02-004": { oshi: 1, sp: 3 },
  "hBP02-005": { oshi: 1 },
  "hBP03-004": { oshi: 3 },
  "hBP03-006": { sp: 3 },
  "hBP04-003": { oshi: 3, sp: 1 },
  "hBP04-004": { oshi: 1, sp: 3 },
  "hBP04-005": { sp: 3 },
  "hBP05-002": { oshi: 1, sp: 3 },
  "hBP05-004": { oshi: 1, sp: 3 },
  "hBP05-005": { oshi: 1 },
  "hBP05-006": { oshi: 1, sp: 4 },
  "hBP06-001": { sp: 1 },
  "hBP06-002": { sp: 1 },
  "hBP06-005": { oshi: 1 },
  "hBP06-006": { oshi: 1 },
  "hBP06-007": { sp: 1 },
  "hBP06-008": { sp: 1 },
  "hBP07-001": { oshi: 6 },
  "hBP07-002": { oshi: 3 },
  "hBP07-003": { oshi: 1 },
  "hBP07-005": { sp: 4 },
  "hBP07-006": { oshi: 1 },
  "hBP07-007": { sp: 1 },
  "hBP08-004": { oshi: 1 },
  "hBP08-006": { oshi: "X" },
  "hBP08-007": { sp: 1 },
  "hSD01-001": { oshi: 1 },
  "hSD01-002": { oshi: 3, sp: 3 },
  "hSD02-001": { sp: 1 },
  "hSD03-001": { sp: 1 },
  "hSD04-001": { sp: 1 },
  "hSD05-001": { sp: 1 },
  "hSD06-001": { sp: 1 },
  "hSD07-001": { sp: 1 },
  "hSD08-001": { sp: 1 },
  "hSD09-001": { sp: 1 },
  "hSD12-001": { oshi: 1, sp: 3 },
  "hSD13-001": { oshi: 3, sp: 3 },
  "hSD13-002": { oshi: 1, sp: 3 },
  "hSD17-001": { oshi: 3 },
  "hSD19-001": { oshi: 3 },
  "hEB01-001": { oshi: 4 },
});

export const REACTIVE_NORMAL_OSHI = Object.freeze([
  "hBP09-005",
  "hBP01-002", "hBP01-004", "hBP01-005", "hBP01-007", "hBP01-008",
  "hBP02-005", "hBP03-008", "hBP04-004", "hBP04-006", "hBP05-001",
  "hBP05-002", "hBP06-006", "hBP06-007", "hBP08-007", "hSD01-002",
  "hSD13-001",
]);

export const REACTIVE_SP_OSHI = Object.freeze([
  "hBP01-006", "hBP01-007", "hBP02-001", "hBP02-005", "hBP03-005", "hBP03-006",
  "hBP04-001", "hBP04-003", "hBP05-001", "hBP06-002", "hSD03-001", "hSD05-001",
  "hSD08-001", "hSD11-001", "hYS01-001", "hYS01-004",
]);

export const ACTIVE_SP_OSHI = Object.freeze([
  "hBP09-006",
  "hBP01-001", "hBP01-002", "hBP01-003", "hBP01-004", "hBP01-005", "hBP01-008",
  "hBP02-002", "hBP02-003", "hBP02-004", "hBP02-006", "hBP02-007",
  "hBP03-001", "hBP03-002", "hBP03-003", "hBP03-004", "hBP03-007", "hBP03-008",
  "hBP04-002", "hBP04-004", "hBP04-005", "hBP04-006", "hBP04-007",
  "hBP05-002", "hBP05-003", "hBP05-004", "hBP05-005", "hBP05-006", "hBP05-007",
  "hBP06-001", "hBP06-003", "hBP06-004", "hBP06-005", "hBP06-006", "hBP06-007", "hBP06-008",
  "hBP07-002", "hBP07-003", "hBP07-005", "hBP07-007",
  "hBP08-001", "hBP08-004", "hBP08-007",
  "hSD01-001", "hSD01-002", "hSD02-001", "hSD04-001", "hSD06-001", "hSD07-001", "hSD09-001",
  "hSD10-001", "hSD12-001", "hSD12-002", "hSD13-001", "hSD13-002", "hSD14-001", "hSD15-001",
  "hSD16-001", "hSD17-001", "hSD18-001", "hSD19-001", "hYS01-002", "hYS01-003",
]);

export const OSHI_STAGE_SKILLS = Object.freeze({
  "hBP07-001": {
    timing: "自動",
    name: "ドドドライブ",
    effect: "自己的〈角巻わため〉使用藝能時，將自己牌組上方的1張牌放到 Holo Power。",
  },
  "hBP07-004": {
    timing: "每回合1次",
    name: "はあちゃまなう",
    effect: "自己的回合中，自己的〈赤井はあと〉因自己的能力從舞台返回牌組時，抽2張牌。",
  },
  "hBP07-006": {
    timing: "常時",
    name: "ETERNiTY FRONTiER",
    effect: "自己的 Holo Power 每有1張，自己中央〈AZKi〉的藝能傷害+20。",
  },
  "hBP08-002": {
    timing: "常時",
    name: "Justiceの古代自動人形",
    effect: "自己的所有〈セシリア・イマーグリーン〉不會在重置步驟變成活動狀態。",
  },
  "hBP08-003": {
    timing: "常時",
    name: "準備は出来てるよね！",
    effect: "附加在自己的〈フワワ・アビスガード〉與〈モココ・アビスガード〉上的所有紅色應援，也視為藍色應援。",
  },
  "hBP08-005": {
    timing: "自動",
    name: "もう金曜だねルイ姉",
    effect: "自己的回合結束時，如果自己的中央 Holomen 是〈鷹嶺ルイ〉且自己有合作 Holomen，抽牌直到手牌有4張。",
  },
  "hBP08-006": {
    timing: "常時",
    name: "WORLD DOMINATION",
    effect: "如果對手舞台上的所有 Holomen 都持有與對手推し Holomen 不同的顏色，自己所有〈一伊那尓栖〉的藝能不需要應援即可使用。",
  },
  "hEB01-001": {
    timing: "自動",
    name: "浜辺のヴィーナス",
    effect: "自己的回合結束時，如果自己的中央 Holomen 與合作 Holomen都是〈ときのそら〉，將自己牌組上方的1張牌放到 Holo Power。如果自己的舞台上有2nd Holomen，再抽1張牌。",
  },
  "hEB01-002": {
    timing: "自動",
    name: "魔性の再演",
    effect: "自己的表演階段開始時，如果自己有合作 Holomen，可以使用手牌中的藍色〈宝鐘マリン〉，令本回合已 Bloom 的中央〈宝鐘マリン〉再次 Bloom。",
  },
  "hEB01-003": {
    timing: "常時",
    name: "助手くん限定の『こよ色観測』",
    effect: "自己的舞台上每有1張〈こよりの助手くん〉，因自己的推し技能與自己的黃色〈博衣こより〉效果而從牌組上方展示的張數+1。",
  },
});

export function oshiSkillPowerCost(cardNumber, kind = "oshi") {
  // null means not registered in the executable catalog, not a zero-cost skill.
  if (CATALOG_ONLY_OSHI.includes(cardNumber)) return null;
  if (String(cardNumber).startsWith("hYS01-")) return kind === "sp" ? 1 : 2;
  const override = COST_OVERRIDES[cardNumber]?.[kind];
  if (override != null) return override;
  return kind === "sp" ? DEFAULT_SP_COST : DEFAULT_OSHI_COST;
}

// X may be zero for Hajime; other variable costs retain their existing minimum.
export function oshiSkillMinimumPower(cardNumber, kind = "oshi") {
  const cost = oshiSkillPowerCost(cardNumber, kind);
  return cost === "X" ? (cardNumber === "hBP09-002" && kind === "oshi" ? 0 : 1) : cost;
}

export function isReactiveNormalOshi(cardNumber) {
  return isReactiveOshiSkill(cardNumber, "oshi");
}

export function isReactiveOshiSkill(cardNumber, kind = "oshi") {
  return (kind === "sp" ? REACTIVE_SP_OSHI : REACTIVE_NORMAL_OSHI).includes(cardNumber);
}

export function isActivatableOshiSkill(cardNumber, kind = "oshi") {
  if (CATALOG_ONLY_OSHI.includes(cardNumber)) return false;
  if (kind === "oshi") return !isReactiveNormalOshi(cardNumber);
  return String(cardNumber).startsWith("hBD24-") || ACTIVE_SP_OSHI.includes(cardNumber);
}

function costTiming(cost, currentTiming = "") {
  const cadence = String(currentTiming)
    .replace(/Holo\s*Power\s*[-−]\s*(?:\d+|X)/giu, "")
    .replace(/^[\s·・／/|]+|[\s·・／/|]+$/gu, "");
  const label = `Holo Power -${cost}`;
  return cadence ? `${label} · ${cadence}` : label;
}

export function enrichOshiCardMetadata(card) {
  if (!card || card.group !== "oshi") return card;
  // Official imported fields remain visible even before engine support exists.
  if (CATALOG_ONLY_OSHI.includes(card.number)) return card;
  const enriched = { ...card };
  if (card.oshiSkill) enriched.oshiSkill = { ...card.oshiSkill, timing: costTiming(oshiSkillPowerCost(card.number, "oshi"), card.oshiSkill.timing) };
  if (card.spOshiSkill) enriched.spOshiSkill = { ...card.spOshiSkill, timing: costTiming(oshiSkillPowerCost(card.number, "sp"), card.spOshiSkill.timing) };
  if (OSHI_STAGE_SKILLS[card.number]) enriched.stageSkill = { ...OSHI_STAGE_SKILLS[card.number] };
  return enriched;
}
