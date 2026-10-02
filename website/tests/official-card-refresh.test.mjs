import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const catalog = JSON.parse(fs.readFileSync(new URL("../public/cards.json", import.meta.url), "utf8"));
const refreshReport = JSON.parse(fs.readFileSync(new URL("../docs/card-refresh-report.json", import.meta.url), "utf8"));
const merger = fileURLToPath(new URL("../scripts/merge-official-card-refresh.mjs", import.meta.url));
const summerSet = "エクストラブースター サマー・ホログラム";
const newNumbers = ["hY03-018", "hY04-015"];
const copyCard = (number) => structuredClone(catalog.cards.find((card) => card.number === number));

function fixture() {
  // This deliberately small, offline test fixture is derived from the checked-in
  // catalog and change report. It is not a fresh capture of the official list.
  const cards = ["hY01-001", "hY01-014", "hBP09-001", "hBP09-090"].map(copyCard);
  const snapshot = {
    capturedAt: refreshReport.capturedAt,
    pages: 1,
    successfulPages: 1,
    errors: [],
    printings: [...cards, ...newNumbers.map(copyCard)].flatMap((card) =>
      card.variants.map((variant) => ({
        number: card.number,
        jpName: card.jpName,
        imageUrl: variant.image,
        sourceUrl: variant.sourceUrl || card.sourceUrl || `https://hololive-official-cardgame.com/cardlist/?id=${card.id}`,
        info: {
          "収録商品": (variant.sets || []).join("\n"),
          "レアリティ": variant.rarity,
          "カードタイプ": card.group === "cheer" ? "エール" : card.typeCode,
          "色": { white: "白", red: "赤", blue: "青" }[card.colorCodes[0]] || "",
        },
      })),
    ),
  };
  // Reintroduce the old wrong S printing while preserving the original card id.
  const regularCheer = cards.find((card) => card.number === "hY01-001");
  regularCheer.variants = regularCheer.variants.filter((variant) => variant.rarity !== "S");
  regularCheer.sets = regularCheer.sets.filter((set) => set !== summerSet);
  const specialCheer = cards.find((card) => card.number === "hY01-014");
  const removed = refreshReport.products.heb01.removed.find((item) => item.number === specialCheer.number);
  specialCheer.variants.unshift({ id: removed.id, rarity: removed.rarity, image: removed.image, sets: [summerSet] });
  specialCheer.image = removed.image;
  specialCheer.rarity = removed.rarity;
  return { catalog: { meta: {}, cards }, snapshot };
}

function workspace(t, input = fixture()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "official-card-refresh-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const catalogPath = path.join(directory, "cards.json");
  const snapshotPath = path.join(directory, "snapshot.json");
  const reportPath = path.join(directory, "report.json");
  fs.writeFileSync(catalogPath, JSON.stringify(input.catalog));
  fs.writeFileSync(snapshotPath, JSON.stringify(input.snapshot));
  return {
    catalogPath,
    reportPath,
    run: () => spawnSync(process.execPath, [merger, snapshotPath, catalogPath, reportPath], {
      // The reviewed name map must resolve relative to the script, not cwd.
      cwd: directory,
      encoding: "utf8",
    }),
    readCatalog: () => JSON.parse(fs.readFileSync(catalogPath, "utf8")),
    readReport: () => JSON.parse(fs.readFileSync(reportPath, "utf8")),
  };
}

test("official refresh reuses reviewed names, preserves Japanese effects, and fixes S/SY ownership", (t) => {
  const input = fixture();
  const files = workspace(t, input);
  const result = files.run();
  assert.equal(result.status, 0, result.stderr);
  const merged = files.readCatalog();
  for (const number of newNumbers) {
    assert.deepEqual(merged.cards.find((card) => card.number === number), copyCard(number));
  }
  for (const original of input.catalog.cards) {
    const card = merged.cards.find((candidate) => candidate.number === original.number);
    assert.equal(card.id, original.id, `${original.number} must keep its stable card id`);
    if (original.number.startsWith("hBP09-")) assert.deepEqual(card, original);
  }
  const regular = merged.cards.find((card) => card.number === "hY01-001");
  const special = merged.cards.find((card) => card.number === "hY01-014");
  assert.deepEqual(regular.variants, copyCard(regular.number).variants);
  assert.deepEqual(special, copyCard(special.number));
  assert.equal(merged.meta.traditionalChineseCards, 5);
  assert.equal(merged.meta.japaneseNameFallbackCards, 1);
  assert.equal(merged.meta.printings, input.snapshot.printings.length);
  const report = files.readReport();
  assert.deepEqual(report.newCardNumbers, newNumbers);
  assert.equal(report.products.pr.added.length, 2);
  assert.equal(report.products.heb01.added.length, 1);
  assert.equal(report.products.heb01.removed.length, 1);
  assert.equal(report.result.traditionalChineseCards, 5);
  assert.equal(report.result.japaneseNameFallbackCards, 1);
});

test("official refresh is byte-idempotent and a second pass reports no additions or removals", (t) => {
  const files = workspace(t);
  let result = files.run();
  assert.equal(result.status, 0, result.stderr);
  const once = fs.readFileSync(files.catalogPath, "utf8");
  result = files.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(files.catalogPath, "utf8"), once);
  const report = files.readReport();
  assert.deepEqual(report.newCardNumbers, []);
  assert.deepEqual(report.products.pr.added, []);
  assert.deepEqual(report.products.heb01.added, []);
  assert.deepEqual(report.products.heb01.removed, []);
});

test("official refresh repairs a previously missed reviewed name without changing effect audit status", (t) => {
  const input = fixture();
  const previous = copyCard("hY03-018");
  previous.name = previous.jpName;
  previous.nameTranslationStatus = "official-japanese-fallback";
  input.catalog.cards.push(previous);
  const files = workspace(t, input);
  const result = files.run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(files.readCatalog().cards.find((card) => card.number === previous.number), copyCard(previous.number));
});

test("official refresh keeps an unmapped new name in Japanese without fabricating a translation", (t) => {
  const input = fixture();
  const row = input.snapshot.printings.find((row) => row.number === "hY03-018");
  row.jpName = "テスト用の未翻訳エール"; // Synthetic input used only in this rejection/fallback fixture.
  const files = workspace(t, input);
  const result = files.run();
  assert.equal(result.status, 0, result.stderr);
  const merged = files.readCatalog();
  const card = merged.cards.find((card) => card.number === row.number);
  assert.equal(card.name, row.jpName);
  assert.equal(card.nameTranslationStatus, "official-japanese-fallback");
  assert.equal(card.translationStatus, "official-japanese-fallback");
  assert.equal(card.effectLanguage, "ja");
  assert.equal(card.simulationStatus, "not-audited");
  assert.equal(merged.meta.traditionalChineseCards, 4);
  assert.equal(merged.meta.japaneseNameFallbackCards, 2);
});

const invalidCases = [
  ["incomplete pages", ({ snapshot }) => { snapshot.successfulPages = 0; }, /snapshot is incomplete/],
  ["capture errors", ({ snapshot }) => { snapshot.errors.push("Failed page"); }, /snapshot is incomplete/],
  ["duplicate printing", ({ snapshot }) => { snapshot.printings.push(structuredClone(snapshot.printings[0])); }, /duplicate card-number\/image pairs/],
  ["untrusted image", ({ snapshot }) => { snapshot.printings[0].imageUrl = "https://example.com/card.png"; }, /Invalid official image reference/],
  ["missing name", ({ snapshot }) => { snapshot.printings[0].jpName = ""; }, /missing its name or detail URL/],
  ["missing detail URL", ({ snapshot }) => { snapshot.printings[0].sourceUrl = ""; }, /missing its name or detail URL/],
  ["missing stable source id", ({ snapshot }) => { snapshot.printings.at(-1).sourceUrl = "https://hololive-official-cardgame.com/cardlist/"; }, /Missing stable official card-list id/],
  ["unsupported new card type", ({ snapshot }) => { snapshot.printings.at(-1).info["カードタイプ"] = "ホロメン"; }, /No verified catalog mapping/],
  ["unsupported new color", ({ snapshot }) => { snapshot.printings.at(-1).info["色"] = "unknown"; }, /No verified color mapping/],
  ["duplicate card number", ({ catalog }) => { catalog.cards.push(structuredClone(catalog.cards[0])); }, /duplicate card number/],
  ["duplicate card id", ({ catalog }) => { catalog.cards[1].id = catalog.cards[0].id; }, /duplicate stable card id/],
  ["duplicate variant id", ({ catalog }) => { catalog.cards[2].variants[0].id = catalog.cards[0].variants[0].id; }, /duplicate stable id/],
  ["missing official printing", ({ snapshot }) => { snapshot.printings.shift(); }, /Catalog image is absent/],
];

for (const [name, invalidate, expected] of invalidCases) {
  test(`official refresh rejects ${name} without changing the catalog`, (t) => {
    const input = fixture();
    invalidate(input);
    const files = workspace(t, input);
    const before = fs.readFileSync(files.catalogPath, "utf8");
    const result = files.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
    assert.equal(fs.readFileSync(files.catalogPath, "utf8"), before);
    assert.equal(fs.existsSync(files.reportPath), false);
  });
}

function bonusFixture() {
  const input = fixture();
  for (const number of ['hEB01-016', 'hEB01-017', 'hEB01-023', 'hEB01-024']) {
    const card = copyCard(number);
    input.snapshot.printings.push(...card.variants.map(variant => ({
      number, jpName: card.jpName, imageUrl: variant.image, sourceUrl: variant.sourceUrl,
      info: { '収録商品': variant.sets.join('\n'), 'レアリティ': variant.rarity, 'カードタイプ': 'ホロメン' },
    })));
    card.arts[0].specialTargets = [];
    card.arts[0].specialValues = [];
    input.catalog.cards.push(card);
  }
  return input;
}

test('refresh restores exactly four verified printed bonuses and preserves every other field', t => {
  const files = workspace(t, bonusFixture());
  let result = files.run();
  assert.equal(result.status, 0, result.stderr);
  const numbers = ['hEB01-016', 'hEB01-017', 'hEB01-023', 'hEB01-024'];
  for (const number of numbers) assert.deepEqual(files.readCatalog().cards.find(card => card.number === number), copyCard(number));
  assert.deepEqual(files.readReport().appliedRuleCorrectionNumbers, numbers);
  assert.deepEqual(files.readReport().verifiedRuleCorrections, refreshReport.verifiedRuleCorrections);
  const once = fs.readFileSync(files.catalogPath, 'utf8');
  result = files.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), once);
  assert.deepEqual(files.readReport().appliedRuleCorrectionNumbers, []);
});

for (const [name, mutate, expected] of [
  ['unexpected existing bonus', card => { card.arts[0].specialTargets = ['紫']; card.arts[0].specialValues = [20]; }, /Unexpected color-bonus fields/],
  ['changed Arts identity', card => { card.arts[0].name = 'Unreviewed replacement'; }, /correction identity mismatch/],
]) {
  test(`refresh rejects ${name} instead of overwriting unreviewed rule data`, t => {
    const input = bonusFixture();
    mutate(input.catalog.cards.find(card => card.number === 'hEB01-016'));
    const files = workspace(t, input);
    const before = fs.readFileSync(files.catalogPath, 'utf8');
    const result = files.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expected);
    assert.equal(fs.readFileSync(files.catalogPath, 'utf8'), before);
  });
}
