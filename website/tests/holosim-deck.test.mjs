import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fromHoloSimDeck, isHoloSimDeck, toHoloSimDeck, toHoloSimFilename } from "../lib/holosim-deck.mjs";

const holoSim113Index = JSON.parse(readFileSync(new URL("../public/holosim-card-index.json", import.meta.url), "utf8"));

test("exports the HoloSim deck schema with repeated card entries", () => {
  const exported = toHoloSimDeck({
    oshi: { "hBP08-004": 1 },
    main: { "hBP08-047": 2, "hSD11-007": 1 },
    cheer: { "hY04-003": 2 },
  }, {
    "hBP08-004": ["hBP08-004_0", "hBP08-004_2"],
    "hBP08-047": ["hBP08-047_0"],
    "hSD11-007": ["hSD11-007_0", "hSD11-007_1"],
    "hY04-003": ["hY04-003_0"],
  });
  assert.deepEqual(exported, {
    deck: {
      oshiCardNumber: "hBP08-004_0",
      mainDeckCardNumbers: ["hBP08-047_0", "hBP08-047_0", "hSD11-007_0"],
      yellDeckCardNumbers: ["hY04-003_0", "hY04-003_0"],
    },
    unsupported: [],
  });
  assert.equal(isHoloSimDeck(exported.deck), true);
});

test("reports card numbers that HoloSim cannot load", () => {
  const exported = toHoloSimDeck({
    oshi: { "hBD24-004": 1 },
    main: { "hBP01-009": 50 },
    cheer: { "hY01-001": 20 },
  }, {
    "hY01-001": ["hY01-001_0"],
  });
  assert.deepEqual(exported.unsupported, ["hBD24-004", "hBP01-009"]);
  assert.equal(exported.deck.oshiCardNumber, "");
  assert.equal(exported.deck.mainDeckCardNumbers.length, 0);
  assert.equal(exported.deck.yellDeckCardNumbers.length, 20);
});

test("exports Summer Hologram cards with the HoloSim 1.13 index", () => {
  const exported = toHoloSimDeck({
    oshi: { "hEB01-002": 1 },
    main: { "hEB01-011": 4, "hEB01-026": 4 },
    cheer: { "hY04-001": 20 },
  }, holoSim113Index);

  assert.deepEqual(exported.unsupported, []);
  assert.equal(exported.deck.oshiCardNumber, "hEB01-002_0");
  assert.deepEqual(exported.deck.mainDeckCardNumbers, [
    "hEB01-011_0", "hEB01-011_0", "hEB01-011_0", "hEB01-011_0",
    "hEB01-026_0", "hEB01-026_0", "hEB01-026_0", "hEB01-026_0",
  ]);
});

test("tracks the complete card filenames bundled with HoloSim 1.13", () => {
  const variants = Object.values(holoSim113Index).flat();
  assert.equal(Object.keys(holoSim113Index).length, 714);
  assert.equal(variants.length, 1052);
  assert.deepEqual(holoSim113Index["hBP03-067"], ["hBP03-067_0", "hBP03-067_1", "hBP03-067_2"]);
  assert.deepEqual(holoSim113Index["hEB01-034"], ["hEB01-034_0"]);
});

test("imports HoloSim variant suffixes as card counts", () => {
  assert.deepEqual(fromHoloSimDeck({
    oshiCardNumber: "hBP08-004_2",
    mainDeckCardNumbers: ["hBP08-047_0", "hBP08-047_0", "hSD11-007_1"],
    yellDeckCardNumbers: ["hY04-003_0", "hY04-003_0"],
  }), {
    oshi: { "hBP08-004": 1 },
    main: { "hBP08-047": 2, "hSD11-007": 1 },
    cheer: { "hY04-003": 2 },
  });
});

test("uses a Unicode HoloSim-compatible deck name as the JSON filename", () => {
  assert.equal(toHoloSimFilename("水宮枢單"), "水宮枢單.json");
  assert.equal(toHoloSimFilename("星街すいせい.json"), "星街すいせい.json");
  assert.equal(toHoloSimFilename("我的/牌組:*?"), "我的 牌組.json");
  assert.equal(toHoloSimFilename("CON"), "_CON.json");
  assert.equal(toHoloSimFilename("   "), "holosim-deck.json");
});
