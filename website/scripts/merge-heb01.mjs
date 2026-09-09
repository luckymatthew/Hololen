import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cardsPath = path.join(root, "public/cards.json");
const sourcePath = path.join(root, "scripts/heb01-source.json");
const nameMapPath = path.join(root, "scripts/name-zh.json");

const payload = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const chineseNames = JSON.parse(fs.readFileSync(nameMapPath, "utf8"));

const releaseName = "エクストラブースター サマー・ホログラム";
const officialImageRoot = "https://hololive-official-cardgame.com/wp-content/images/cardlist";

// The community translation feed contains all 102 standard cards and most
// parallels, but its 2026-08-20 snapshot predates the final official card-list
// upload. Fill the remaining official printings from the product checklist.
const omittedSourceImages = new Set(["cardListImages/hEB01/hEB01-012_P.png"]);

function parallelRecord(number, rarity) {
  const base = source.find((record) => record.id === number);
  if (!base) throw new Error(`Cannot build ${number}_${rarity}: base card missing`);
  const suffix = number.startsWith("hEB01-") || rarity === "HR" ? "" : "_02";
  return {
    ...base,
    image: `cardListImages/hEB01/${number}_${rarity}${suffix}.png`,
    product: `補充包「${releaseName} (hEB01)」`,
  };
}

const supplementalRecords = [
  ...Array.from({ length: 21 }, (_, index) => parallelRecord(`hEB01-${String(index + 4).padStart(3, "0")}`, "SR")),
  parallelRecord("hBP01-021", "HR"),
  parallelRecord("hBP02-028", "HR"),
  parallelRecord("hBP04-008", "HR"),
  ...[
    ["hY01-014", "白エール", "白"],
    ["hY02-012", "緑エール", "綠"],
    ["hY03-016", "赤エール", "紅"],
    ["hY04-013", "青エール", "藍"],
    ["hY05-011", "紫エール", "紫"],
    ["hY06-011", "黄エール", "黃"],
  ].flatMap(([id, name, color]) => ["S", "SY"].map((rarity) => ({
    id,
    name,
    type: "應援",
    color,
    image: `cardListImages/hEB01/${id}_${rarity}.png`,
    product: `補充包「${releaseName} (hEB01)」`,
    supportEffect: "■當Holomen離開舞台時，將該Holomen的所有應援存入檔案區域。\n■當Holomen進行接力時，將該Holomen指定數量的應援存入檔案區域。",
  }))),
];

const releaseSource = [
  ...source.filter((record) => !omittedSourceImages.has(record.image)),
  ...supplementalRecords,
];
const omittedOfficialImages = new Set([
  ...[...omittedSourceImages].map((image) => imageUrl(image)),
  ...["hBP01-021", "hBP02-028", "hBP04-008"].map((number) => imageUrl(`cardListImages/hEB01/${number}_HR_02.png`)),
]);

const nameOverrides = {
  "サマーパソコン": "夏日電腦",
  "クマリン": "熊琳",
  "サマーライブ": "夏日演唱會",
  "スイカ割り": "打西瓜",
  "スプラッシュシュート": "水花射擊",
  "ホロライブ・サマー": "Hololive Summer",
  "水遊び": "戲水",
  "STAR STAR☆T": "STAR STAR☆T",
  "ビーチボール": "沙灘球",
  "なんでも爆解！": "萬事爆解！",
};

const colorCodes = {
  白: "white",
  綠: "green",
  紅: "red",
  藍: "blue",
  紫: "purple",
  黃: "yellow",
};

const costColors = {
  white: "白",
  green: "綠",
  red: "紅",
  blue: "藍",
  purple: "紫",
  yellow: "黃",
  null: "無色",
};

function productIncludesRelease(product) {
  return JSON.stringify(product || "").includes("hEB01");
}

function rarityFromImage(image) {
  return String(image || "").match(/_(OSR|OUR|SEC|RR|SR|UR|HR|SY|S|R|U|C|P)(?:_[A-Za-z]?\d+)?\.png$/)?.[1] || "";
}

function imageUrl(image) {
  const relativePath = String(image || "").replace(/^.*?cardListImages\//, "");
  return `${officialImageRoot}/${relativePath}`;
}

function variantsFor(number, records) {
  const seen = new Set();
  return records
    .filter((record) => productIncludesRelease(record.product) || String(record.image || "").includes("/hEB01/"))
    .map((record, index) => ({
      id: `heb01-${number}-${rarityFromImage(record.image) || "card"}-${index + 1}`,
      rarity: rarityFromImage(record.image),
      image: imageUrl(record.image),
      sets: [releaseName],
    }))
    .filter((variant) => variant.image && !seen.has(variant.image) && seen.add(variant.image));
}

function skill(skill) {
  if (!skill) return null;
  const timing = Number.isFinite(skill.holoPower) ? `Holo Power ${skill.holoPower}` : "";
  return { timing, name: skill.name || "", effect: skill.effect || "" };
}

function stageSkill(skillData) {
  if (!skillData) return null;
  return { timing: "", name: skillData.name || "", effect: skillData.effect || "" };
}

function parseTags(tag) {
  return String(tag || "")
    .split("/")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCost(images) {
  return (images || []).map((image) => {
    const code = String(image).match(/arts_([a-z]+)\.png$/)?.[1];
    return costColors[code] || code || "無色";
  });
}

function parseSpecial(image) {
  const match = String(image || "").match(/tokkou_(\d+)_([a-z]+)\.png$/);
  if (!match) return { targets: [], values: [] };
  return { targets: [costColors[match[2]] || match[2]], values: [Number(match[1])] };
}

function convertArt(art) {
  if (!art) return null;
  const special = parseSpecial(art.specialAttackImage);
  const damage = Number.parseInt(String(art.damage ?? ""), 10);
  return {
    name: art.name || "",
    effect: art.effect || "",
    damage: Number.isFinite(damage) ? damage : null,
    cost: parseCost(art.image),
    specialTargets: special.targets,
    specialValues: special.values,
  };
}

function cardShape(record, records) {
  const number = record.id;
  const isOshi = record.type === "主推";
  const isHolomem = record.type === "成員";
  const isCheer = record.type === "應援";
  const isBuzz = String(record.bloom || "").includes("Buzz");
  const isLimited = String(record.supportEffect || "").includes("LIMITED");
  const isEvent = String(record.type || "").includes("活動");
  const isTool = String(record.type || "").includes("道具");
  const group = isOshi ? "oshi" : isHolomem ? "holomem" : isCheer ? "cheer" : "support";
  const typeCode = isOshi
    ? "oshiCharacter"
    : isBuzz
      ? "buzzCharacter"
      : isHolomem
        ? "character"
        : isCheer
          ? "supportCheer"
        : isEvent
          ? isLimited ? "supportEventLimited" : "supportEvent"
          : isTool
            ? "supportTool"
            : "supportItem";
  const typeLabel = isOshi
    ? "推し Holomen"
    : isBuzz
      ? "Buzz Holomen"
      : isHolomem
        ? "Holomen"
        : isCheer
          ? "應援"
        : isEvent
          ? isLimited ? "事件・LIMITED" : "事件"
          : isTool
            ? "工具"
            : "道具";
  const effectEntries = [
    ["collab", record.effectC],
    ["bloom", record.effectB],
    ["gift", record.effectG],
  ].filter(([, value]) => value);
  const [keywordType, keywordValue] = effectEntries[0] || [];
  const variants = variantsFor(number, records);
  const baseVariant = variants.find((variant) => ["OSR", "RR", "R", "U", "C"].includes(variant.rarity)) || variants[0];
  const unlimited = /任意張數|任意枚數|任意數量|何枚でも|any number/i.test(record.extra || "");

  return {
    id: baseVariant?.id || `heb01-${number}`,
    number,
    name: nameOverrides[record.name] || chineseNames[record.name] || record.name || number,
    jpName: record.name || "",
    enName: "",
    group,
    type: typeLabel,
    typeCode,
    colors: record.color ? [record.color] : [],
    colorCodes: record.color ? [colorCodes[record.color]].filter(Boolean) : [],
    stage: String(record.bloom || "").replace(" Buzz", ""),
    hp: record.hp ?? null,
    life: record.life ?? null,
    rarity: baseVariant?.rarity || rarityFromImage(record.image),
    set: releaseName,
    sets: [releaseName],
    tags: parseTags(record.tag),
    illustrator: "",
    baton: Array.isArray(record.batonImage) ? record.batonImage.length : null,
    image: baseVariant?.image || imageUrl(record.image),
    variants,
    abilityText: record.supportEffect || "",
    extra: record.extra || "",
    keyword: keywordValue
      ? { type: keywordType, name: keywordValue.name || "", effect: keywordValue.effect || "" }
      : null,
    stageSkill: stageSkill(record.stageSkill),
    oshiSkill: skill(record.oshiSkill),
    spOshiSkill: skill(record.spSkill),
    arts: [convertArt(record.art1), convertArt(record.art2)].filter(Boolean),
    qaCount: 0,
    maxCopies: isOshi ? 1 : isCheer ? 20 : unlimited ? 99 : 4,
    unlimited,
    restricted: false,
    preview: false,
    simOnly: false,
    releaseDate: "2026-08-21",
  };
}

const grouped = new Map();
for (const record of releaseSource) {
  if (!record.id || (!productIncludesRelease(record.product) && !String(record.image || "").includes("/hEB01/"))) continue;
  if (!grouped.has(record.id)) grouped.set(record.id, []);
  grouped.get(record.id).push(record);
}

const existing = new Map(payload.cards.map((card) => [card.number, card]));
let addedCards = 0;
let addedVariants = 0;

for (const [number, records] of grouped) {
  const current = existing.get(number);
  const releaseVariants = variantsFor(number, records);
  if (current) {
    current.sets = [...new Set([...(current.sets || [current.set]), releaseName])];
    current.variants = (current.variants || []).filter((variant) => !omittedOfficialImages.has(variant.image));
    const knownImages = new Set(current.variants.map((variant) => variant.image));
    for (const variant of releaseVariants) {
      const existingVariant = current.variants.find((candidate) => candidate.image === variant.image);
      if (existingVariant) {
        existingVariant.rarity = variant.rarity || existingVariant.rarity;
        existingVariant.sets = [...new Set([...(existingVariant.sets || []), releaseName])];
      } else if (!knownImages.has(variant.image)) {
        current.variants.push(variant);
        knownImages.add(variant.image);
        addedVariants += 1;
      }
    }
    continue;
  }

  const baseRecord = records.find((record) => productIncludesRelease(record.product) && ["OSR", "RR", "R", "U", "C"].includes(rarityFromImage(record.image)))
    || records.find((record) => productIncludesRelease(record.product))
    || records[0];
  const card = cardShape(baseRecord, records);
  payload.cards.push(card);
  existing.set(number, card);
  addedCards += 1;
  addedVariants += card.variants.length;
}

payload.cards.sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));
payload.meta = {
  ...payload.meta,
  generatedAt: new Date().toISOString(),
  snapshotDate: "2026-08-22",
  uniqueCards: payload.cards.length,
  sourceUniqueCards: payload.cards.filter((card) => !card.simOnly).length,
  printings: payload.cards.reduce((sum, card) => sum + (card.variants?.length || 0), 0),
  traditionalChineseCards: payload.cards.length,
  latestRelease: `${releaseName}（2026-08-21）`,
  latestReleasePrintings: 214,
  latestReleaseBaseCards: 102,
  latestReleaseParallels: 112,
  note: "卡名採繁中翻譯，EN／ID 成員採官方英文名；技能為非官方繁中閱讀翻譯，正式對戰與裁定以官方日文資料為準。已收錄 2026-08-21 發售的《サマー・ホログラム》。",
};

fs.writeFileSync(cardsPath, JSON.stringify(payload));
console.log(JSON.stringify({ addedCards, addedVariants, totalCards: payload.cards.length, meta: payload.meta }, null, 2));
