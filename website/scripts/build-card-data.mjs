import fs from "node:fs";
import path from "node:path";
import { enrichOshiCardMetadata } from "../lib/simulator/oshi-skill-catalog.mjs";

const sourcePath = path.resolve(process.argv[2] || "../../cards_full.json");
const outputPath = path.resolve(process.argv[3] || "public/cards.json");
const nameMapPath = path.resolve(process.argv[4] || "scripts/name-zh.json");

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const chineseNames = fs.existsSync(nameMapPath)
  ? JSON.parse(fs.readFileSync(nameMapPath, "utf8"))
  : {};

const typeMap = {
  character: ["holomem", "Holomen"],
  buzzCharacter: ["holomem", "Buzz Holomen"],
  oshiCharacter: ["oshi", "推し Holomen"],
  supportItemLimited: ["support", "道具・LIMITED"],
  supportItem: ["support", "道具"],
  supportEventLimited: ["support", "事件・LIMITED"],
  supportEvent: ["support", "事件"],
  supportTool: ["support", "工具"],
  supportMascot: ["support", "吉祥物"],
  supportFan: ["support", "粉絲"],
  supportStaffLimited: ["support", "工作人員・LIMITED"],
  supportCheer: ["cheer", "應援"],
  unknown: ["support", "其他"],
};

const colorMap = {
  white: "白",
  green: "綠",
  red: "紅",
  blue: "藍",
  purple: "紫",
  yellow: "黃",
  null: "無色",
};

const stageMap = {
  debut: "Debut",
  first: "1st",
  second: "2nd",
  spot: "Spot",
};

const rarityPriority = [
  "OSR",
  "RR",
  "R",
  "U",
  "C",
  "N",
  "OC",
  "P",
  "S",
  "SY",
  "SR",
  "UR",
  "SEC",
  "OUR",
  "HR",
];

function richness(card) {
  const tc = card.translations?.tc || {};
  return JSON.stringify(tc).length + (card.imageUrl ? 100 : 0);
}

function illustrationScore(card) {
  const rarity = rarityPriority.indexOf(card.rarityCode);
  const rarityScore = rarity === -1 ? 0 : (rarityPriority.length - rarity) * 1000;
  const simpleImage = /_[A-Z0-9]+\.png$/i.test(card.imageUrl || "") ? 250 : 0;
  return rarityScore + simpleImage + richness(card);
}

function cleanQaCount(tc) {
  return Array.isArray(tc.qa_items) ? tc.qa_items.length : 0;
}

function compactSkill(skill, meta) {
  if (!skill && !meta) return null;
  return {
    timing: skill?.timing || "",
    name: skill?.name || "",
    effect: skill?.effect || "",
    timingCode: meta?.timingCode || "",
  };
}

function compactArt(art, meta) {
  return {
    name: art?.name || "",
    effect: art?.effect || "",
    damage: meta?.damage ?? null,
    cost: (meta?.costTypes || []).map((color) => colorMap[color] || color),
    specialTargets: (meta?.specialTargets || []).map((color) => colorMap[color] || color),
    specialValues: meta?.specialValues || [],
  };
}

const grouped = new Map();
for (const record of source) {
  const key = record.cardNumber;
  if (!key) continue;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(record);
}

const restrictedCards = new Map([
  ["hBP01-030", 1],
  ["hBP07-101", 1],
]);

const cards = [...grouped.entries()].map(([number, records]) => {
  const chosen = [...records].sort((a, b) => illustrationScore(b) - illustrationScore(a))[0];
  const tc = chosen.translations?.tc || {};
  const ja = chosen.translations?.ja || {};
  const en = chosen.translations?.en || {};
  const [group, typeLabel] = typeMap[chosen.cardTypeCode] || typeMap.unknown;
  const unlimited = /任意張數|任意枚數|何枚でも|any number/i.test(
    `${tc.extra || ""} ${ja.extra || ""} ${en.extra || ""}`,
  );
  const maxCopies =
    group === "oshi"
      ? 1
      : group === "cheer"
        ? 20
        : restrictedCards.get(number) || (unlimited ? 99 : 4);

  const variants = records
    .map((record) => ({
      id: record.id,
      rarity: record.rarityCode || "",
      image: record.imageUrl || "",
    }))
    .filter((variant, index, all) =>
      variant.image && all.findIndex((candidate) => candidate.image === variant.image) === index,
    );

  return enrichOshiCardMetadata({
    id: chosen.id,
    number,
    name: chineseNames[ja.name] || tc.name || ja.name || en.name || number,
    jpName: ja.name || "",
    enName: en.name || "",
    group,
    type: typeLabel,
    typeCode: chosen.cardTypeCode,
    colors: (chosen.colorCodes || []).map((color) => colorMap[color] || color),
    colorCodes: chosen.colorCodes || [],
    stage: stageMap[chosen.bloomLevelCode] || "",
    hp: chosen.hp ?? null,
    life: chosen.life ?? null,
    rarity: chosen.rarityCode || "",
    set: chosen.cardSets?.[0] || "",
    sets: chosen.cardSets || [],
    tags: tc.tags || chosen.tags || [],
    illustrator: chosen.illustrator || "",
    baton: chosen.batonTouchCount ?? null,
    image: chosen.imageUrl || "",
    variants,
    abilityText: tc.abilityText || "",
    extra: tc.extra || "",
    keyword: tc.keyword
      ? {
          type: chosen.keyword?.typeCode || "",
          name: tc.keyword.name || "",
          effect: tc.keyword.effect || "",
        }
      : null,
    oshiSkill: compactSkill(tc.oshiSkill, chosen.oshiSkill),
    spOshiSkill: compactSkill(tc.spOshiSkill, chosen.spOshiSkill),
    arts: (chosen.arts || []).map((meta, index) => compactArt(tc.arts?.[index], meta)),
    qaCount: cleanQaCount(tc),
    maxCopies,
    unlimited,
    restricted: restrictedCards.has(number),
    preview: false,
    simOnly: false,
  });
});

const hbp09Preview = {
  id: "holosim-hBP09-037",
  number: "hBP09-037",
  name: "輪堂千速",
  jpName: "輪堂千速",
  enName: "Rindo Chihaya",
  group: "holomem",
  type: "Holomen",
  typeCode: "character",
  colors: ["綠"],
  colorCodes: ["green"],
  stage: "2nd",
  hp: 200,
  life: null,
  rarity: "先行公開",
  set: "hBP09 Volume Vortex（先行公開）",
  sets: ["hBP09 Volume Vortex（先行公開）"],
  tags: ["#DEV_IS", "#FLOW GLOW"],
  illustrator: "",
  baton: null,
  image: "/hbp09-037-preview.png",
  variants: [],
  abilityText: "",
  extra: "",
  keyword: {
    type: "gift",
    name: "Fantastic Driver",
    effect:
      "當此Holomen使對手的Holomen倒下時，選擇自己1名具有 #FLOW GLOW 的後台Holomen。可以將包含所選Holomen在內、疊放在一起的所有Holomen返回手牌。",
  },
  oshiSkill: null,
  spOshiSkill: null,
  arts: [
    {
      name: "Victory Feast",
      effect:
        "若自己的推しHolomen為〈輪堂千速〉，自己舞台上每有1名Debut以外的Holomen，此Arts +30。",
      damage: 80,
      cost: ["綠", "無色", "無色"],
      specialTargets: ["黃"],
      specialValues: [50],
    },
  ],
  qaCount: 0,
  maxCopies: 4,
  unlimited: false,
  restricted: false,
  preview: true,
  simOnly: true,
};

if (!grouped.has(hbp09Preview.number)) cards.push(hbp09Preview);

const cheerAliases = [
  ["hY01-008", "hY01-001"],
  ["hY01-011", "hY01-001"],
  ["hY02-009", "hY02-001"],
  ["hY03-010", "hY03-001"],
  ["hY04-008", "hY04-001"],
  ["hY05-006", "hY05-001"],
  ["hY06-008", "hY06-001"],
];

for (const [number, baseNumber] of cheerAliases) {
  if (grouped.has(number)) continue;
  const base = cards.find((card) => card.number === baseNumber);
  if (!base) continue;
  cards.push({
    ...base,
    id: `holosim-${number}`,
    number,
    name: `${base.name}（HoloSim 異圖）`,
    image: "",
    variants: [],
    set: "HoloSim 1.05 收錄異圖",
    sets: ["HoloSim 1.05 收錄異圖"],
    preview: false,
    simOnly: true,
  });
}

cards.sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    snapshotDate: "2026-07-18",
    uniqueCards: cards.length,
    sourceUniqueCards: grouped.size,
    printings: source.length,
    traditionalChineseCards: cards.filter((card) => chineseNames[card.jpName]).length,
    note: "卡名採繁中翻譯，EN／ID 成員採官方英文名；技能為非官方繁中閱讀翻譯，正式對戰與裁定以官方日文資料為準。",
  },
  cards,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload));
console.log(`Wrote ${cards.length} cards and ${source.length} printings to ${outputPath}`);
