import fs from "node:fs";
import path from "node:path";

const [snapshotPath, outputPath = "public/cards.json", reportPath] = process.argv.slice(2);
if (!snapshotPath) {
  throw new Error(
    "Usage: node scripts/merge-official-card-refresh.mjs <official-snapshot.json> [cards.json] [report.json]",
  );
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
if (
  !snapshot.pages ||
  snapshot.successfulPages !== snapshot.pages ||
  snapshot.errors?.length ||
  !Array.isArray(snapshot.printings)
) {
  throw new Error("The official snapshot is incomplete; refusing to merge it.");
}

const catalog = JSON.parse(fs.readFileSync(outputPath, "utf8"));
if (!Array.isArray(catalog.cards) || !catalog.meta) {
  throw new Error(`Unexpected card catalog schema: ${outputPath}`);
}
const reviewedNames = JSON.parse(
  fs.readFileSync(new URL("./name-zh.json", import.meta.url), "utf8"),
);

const verifiedArtBonuses = JSON.parse(
  fs.readFileSync(new URL("./verified-art-bonuses.json", import.meta.url), "utf8"),
);
const appliedRuleCorrections = [];

const refreshDate = new Date(snapshot.capturedAt).toISOString().slice(0, 10);
const catalogVersion = `${refreshDate}-official-cardlist`;
const officialImagePrefix =
  "https://hololive-official-cardgame.com/wp-content/images/cardlist/";
const productLabels = {
  pr: "PRカード",
  heb01: "エクストラブースター サマー・ホログラム",
};
const colorMap = {
  "白": ["白", "white"],
  "緑": ["綠", "green"],
  "赤": ["紅", "red"],
  "青": ["藍", "blue"],
  "紫": ["紫", "purple"],
  "黄": ["黃", "yellow"],
};
const officialCardNumber = /^[A-Za-z0-9]+-\d{3}$/;

function sourceId(row) {
  const id = new URL(row.sourceUrl).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    throw new Error(`Missing stable official card-list id for ${row.number}: ${row.sourceUrl}`);
  }
  return id;
}

function isProductRow(row, label) {
  return String(row.info?.["収録商品"] || "")
    .split(/\r?\n/)
    .some((product) => product.trim() === label);
}

function validRows(rows) {
  return rows.filter((row) => {
    if (!officialCardNumber.test(String(row.number || ""))) return false;
    if (!String(row.imageUrl || "").startsWith(officialImagePrefix)) {
      throw new Error(`Invalid official image reference for ${row.number}: ${row.imageUrl}`);
    }
    if (!row.sourceUrl || !row.jpName) {
      throw new Error(`Official record is missing its name or detail URL: ${row.number}`);
    }
    return true;
  });
}

const officialRows = validRows(snapshot.printings);
const officialKeys = new Set(officialRows.map((row) => `${row.number}|${row.imageUrl}`));
const prRows = officialRows.filter((row) => isProductRow(row, productLabels.pr));
const heb01Rows = officialRows.filter((row) =>
  isProductRow(row, productLabels.heb01),
);
const prKeys = new Set(prRows.map((row) => `${row.number}|${row.imageUrl}`));
const heb01Keys = new Set(heb01Rows.map((row) => `${row.number}|${row.imageUrl}`));

if (officialKeys.size !== officialRows.length) {
  throw new Error("Official snapshot has duplicate card-number/image pairs.");
}
if (new Set(prRows.map((row) => `${row.number}|${row.imageUrl}`)).size !== prRows.length) {
  throw new Error("Official PR product has duplicate card-number/image pairs.");
}
if (new Set(heb01Rows.map((row) => `${row.number}|${row.imageUrl}`)).size !== heb01Rows.length) {
  throw new Error("Official hEB01 product has duplicate card-number/image pairs.");
}

const cardsByNumber = new Map();
const cardIds = new Set();
for (const card of catalog.cards) {
  if (!officialCardNumber.test(String(card.number || "")) && !card.simOnly) {
    throw new Error(`Catalog card has an invalid number: ${card.number}`);
  }
  if (cardsByNumber.has(card.number)) {
    throw new Error(`Catalog has duplicate card number ${card.number}.`);
  }
  if (cardIds.has(String(card.id))) {
    throw new Error(`Catalog has duplicate stable card id ${card.id}.`);
  }
  cardIds.add(String(card.id));
  if (!Array.isArray(card.variants)) card.variants = [];
  cardsByNumber.set(card.number, card);
}

const addedVariants = [];
const removedVariants = [];
const newCardNumbers = new Set();

function ensureSet(values, label) {
  const result = Array.isArray(values) ? values : [];
  if (!result.includes(label)) result.push(label);
  return result;
}

function createCard(row, product) {
  const type = String(row.info?.["カードタイプ"] || "");
  if (type !== "エール") {
    throw new Error(
      `No verified catalog mapping exists for the new ${type || "unknown"} card ${row.number}.`,
    );
  }
  const japaneseColor = String(row.info?.["色"] || "");
  const mappedColor = colorMap[japaneseColor];
  if (!mappedColor) {
    throw new Error(`No verified color mapping exists for new card ${row.number}.`);
  }

  const id = sourceId(row);
  if (cardIds.has(id)) {
    throw new Error(`Official stable card id ${id} already belongs to another card.`);
  }
  cardIds.add(id);
  newCardNumbers.add(row.number);
  return {
    id,
    number: row.number,
    name: reviewedNames[row.jpName] || row.jpName,
    jpName: row.jpName,
    enName: "",
    group: "cheer",
    type: "應援",
    typeCode: "supportCheer",
    colors: [mappedColor[0]],
    colorCodes: [mappedColor[1]],
    stage: "",
    hp: null,
    life: null,
    rarity: row.info?.["レアリティ"] || "",
    set: product,
    sets: [product],
    tags: [],
    illustrator: "",
    baton: null,
    image: row.imageUrl,
    variants: [],
    abilityText: "",
    extra: "",
    keyword: null,
    oshiSkill: null,
    spOshiSkill: null,
    arts: [],
    qaCount: 0,
    maxCopies: 20,
    unlimited: false,
    restricted: false,
    preview: false,
    simOnly: false,
    catalogVersion,
    sourceUrl: row.sourceUrl,
    effectLanguage: "ja",
    translationStatus: "official-japanese-fallback",
    nameTranslationStatus: reviewedNames[row.jpName]
      ? "reviewed-mapping"
      : "official-japanese-fallback",
    simulationStatus: "not-audited",
  };
}

function reconcileProduct(rows, product) {
  for (const row of rows) {
    let card = cardsByNumber.get(row.number);
    if (!card) {
      card = createCard(row, product);
      catalog.cards.push(card);
      cardsByNumber.set(row.number, card);
    }

    // A previous refresh may have missed an existing reviewed name. Repair only
    // explicit name fallbacks; effect language and simulation audit stay separate.
    if (
      card.nameTranslationStatus === "official-japanese-fallback" &&
      reviewedNames[card.jpName]
    ) {
      card.name = reviewedNames[card.jpName];
      card.nameTranslationStatus = "reviewed-mapping";
    }

    const matching = card.variants.find((variant) => variant.image === row.imageUrl);
    if (matching) {
      matching.sets = ensureSet(matching.sets, product);
      matching.sourceUrl ||= row.sourceUrl;
    } else {
      const id = `official-${row.number}-${sourceId(row)}`;
      card.variants.push({
        id,
        rarity: row.info?.["レアリティ"] || "",
        image: row.imageUrl,
        sets: [product],
        sourceUrl: row.sourceUrl,
      });
      addedVariants.push({
        number: row.number,
        id,
        rarity: row.info?.["レアリティ"] || "",
        image: row.imageUrl,
        sourceUrl: row.sourceUrl,
        product,
      });
    }

    card.sets = ensureSet(card.sets, product);
  }
}

reconcileProduct(prRows, productLabels.pr);
reconcileProduct(heb01Rows, productLabels.heb01);

for (const card of catalog.cards) {
  const retained = [];
  for (const variant of card.variants) {
    const key = `${card.number}|${variant.image}`;
    const productSets = Array.isArray(variant.sets) ? variant.sets : [];
    const isOldHeb01 = productSets.includes(productLabels.heb01) && !heb01Keys.has(key);
    if (isOldHeb01 && !officialKeys.has(key)) {
      removedVariants.push({
        number: card.number,
        id: variant.id,
        rarity: variant.rarity,
        image: variant.image,
        product: productLabels.heb01,
      });
      continue;
    }
    if (isOldHeb01 && officialKeys.has(key)) {
      variant.sets = productSets.filter((product) => product !== productLabels.heb01);
    }
    retained.push(variant);
  }
  card.variants = retained;

  if (card.image && !card.variants.some((variant) => variant.image === card.image)) {
    const replacement = card.variants.find((variant) => variant.image);
    card.image = replacement?.image || "";
    if (replacement?.rarity) card.rarity = replacement.rarity;
  }

  for (const product of Object.values(productLabels)) {
    if (card.variants.some((variant) => variant.sets?.includes(product))) {
      card.sets = ensureSet(card.sets, product);
    } else if (Array.isArray(card.sets)) {
      card.sets = card.sets.filter((set) => set !== product);
    }
  }
}

// Printed color icons are independent of Arts effect prose. Apply only the
// four independently verified corrections; reject unrelated schema/data drift.
for (const correction of verifiedArtBonuses.corrections) {
  const card = cardsByNumber.get(correction.number);
  if (!card) continue;
  const art = card.arts?.[correction.artIndex];
  if (!art || card.arts.length !== 1 || art.name !== correction.artName || art.damage !== correction.damage) {
    throw new Error(`Verified Arts correction identity mismatch: ${correction.number}`);
  }
  const current = { specialTargets: art.specialTargets, specialValues: art.specialValues };
  if (JSON.stringify(current) === JSON.stringify(correction.after)) continue;
  if (JSON.stringify(current) !== JSON.stringify(correction.before)) {
    throw new Error(`Unexpected color-bonus fields; refusing to overwrite ${correction.number}`);
  }
  art.specialTargets = [...correction.after.specialTargets];
  art.specialValues = [...correction.after.specialValues];
  appliedRuleCorrections.push(correction.number);
}

catalog.cards.sort((left, right) =>
  left.number.localeCompare(right.number, "en", { numeric: true }),
);

const seenVariantIds = new Set();
const seenImagesByCard = new Set();
for (const card of catalog.cards) {
  for (const variant of card.variants) {
    const id = String(variant.id || "");
    const imageKey = `${card.number}|${variant.image}`;
    if (!id || seenVariantIds.has(id)) {
      throw new Error(`Variant has a missing or duplicate stable id: ${id || card.number}`);
    }
    if (!variant.image || seenImagesByCard.has(imageKey)) {
      throw new Error(`Variant has a missing or duplicate image for ${card.number}.`);
    }
    if (!officialKeys.has(imageKey)) {
      throw new Error(`Catalog image is absent from the captured official list: ${imageKey}`);
    }
    seenVariantIds.add(id);
    seenImagesByCard.add(imageKey);
  }
}

for (const [label, rows] of [
  [productLabels.pr, prRows],
  [productLabels.heb01, heb01Rows],
]) {
  const expected = new Set(rows.map((row) => `${row.number}|${row.imageUrl}`));
  const actual = new Set(
    catalog.cards.flatMap((card) =>
      card.variants
        .filter((variant) => variant.sets?.includes(label))
        .map((variant) => `${card.number}|${variant.image}`),
    ),
  );
  if (expected.size !== actual.size || [...expected].some((key) => !actual.has(key))) {
    throw new Error(`Product variants do not exactly match the official ${label} list.`);
  }
}

const totalVariants = catalog.cards.reduce((total, card) => total + card.variants.length, 0);
const officialNumbers = new Set(officialRows.map((row) => row.number));
if (totalVariants !== officialKeys.size) {
  throw new Error(
    `Catalog contains ${totalVariants} printings, but the official snapshot contains ${officialKeys.size}.`,
  );
}
const countSetForProduct = (product) =>
  catalog.cards.reduce(
    (count, card) =>
      count + card.variants.filter((variant) => variant.sets?.includes(product)).length,
    0,
  );
catalog.meta.generatedAt = snapshot.capturedAt;
catalog.meta.snapshotDate = refreshDate;
catalog.meta.catalogVersion = catalogVersion;
catalog.meta.uniqueCards = catalog.cards.length;
catalog.meta.sourceUniqueCards = officialNumbers.size;
catalog.meta.printings = totalVariants;
catalog.meta.officialSourceUrl = "https://hololive-official-cardgame.com/cardlist/";
catalog.meta.officialSourcePrintings = snapshot.printings.length;
catalog.meta.traditionalChineseCards = catalog.cards.filter(
  (card) => reviewedNames[card.jpName],
).length;
catalog.meta.japaneseNameFallbackCards =
  catalog.cards.length - catalog.meta.traditionalChineseCards;

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(catalog));

const report = {
  capturedAt: snapshot.capturedAt,
  catalogVersion,
  officialSource: {
    url: catalog.meta.officialSourceUrl,
    pages: snapshot.pages,
    successfulPages: snapshot.successfulPages,
    listingRows: snapshot.printings.length,
    numberedPrintings: officialRows.length,
    uniqueCardNumbers: officialNumbers.size,
  },
  products: {
    pr: {
      officialPrintings: prRows.length,
      catalogPrintings: countSetForProduct(productLabels.pr),
      added: addedVariants.filter((item) => item.product === productLabels.pr),
    },
    heb01: {
      officialPrintings: heb01Rows.length,
      catalogPrintings: countSetForProduct(productLabels.heb01),
      added: addedVariants.filter((item) => item.product === productLabels.heb01),
      removed: removedVariants,
    },
  },
  newCardNumbers: [...newCardNumbers].sort(),
  result: {
    cards: catalog.meta.uniqueCards,
    printings: catalog.meta.printings,
    sourceUniqueCards: catalog.meta.sourceUniqueCards,
    traditionalChineseCards: catalog.meta.traditionalChineseCards,
    japaneseNameFallbackCards: catalog.meta.japaneseNameFallbackCards,
  },
  verifiedRuleCorrections: verifiedArtBonuses,
  appliedRuleCorrectionNumbers: appliedRuleCorrections,
  translationNote:
    "Card names reuse reviewed name mappings where available; unmapped names and new effects remain in official Japanese. New cards retain not-audited simulation status.",
};

if (reportPath) {
  fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(
  JSON.stringify(
    {
      capturedAt: report.capturedAt,
      catalogVersion,
      officialSource: report.officialSource,
      products: {
        pr: {
          officialPrintings: prRows.length,
          catalogPrintings: countSetForProduct(productLabels.pr),
          added: addedVariants.filter((item) => item.product === productLabels.pr).length,
        },
        heb01: {
          officialPrintings: heb01Rows.length,
          catalogPrintings: countSetForProduct(productLabels.heb01),
          added: addedVariants.filter((item) => item.product === productLabels.heb01).length,
          removed: removedVariants.length,
        },
      },
      newCardNumbers: [...newCardNumbers].sort(),
      result: report.result,
    },
    null,
    2,
  ),
);
