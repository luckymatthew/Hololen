import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const payload = JSON.parse(
  fs.readFileSync(new URL("../public/cards.json", import.meta.url), "utf8"),
);
const nameMap = JSON.parse(
  fs.readFileSync(new URL("../scripts/name-zh.json", import.meta.url), "utf8"),
);

test("existing localized names remain reviewed and new untranslated names are explicit Japanese fallbacks", () => {
  let localized = 0;
  let fallbacks = 0;
  for (const card of payload.cards) {
    assert.ok(card.name, `${card.number} is missing its displayed name`);
    assert.ok(card.jpName, `${card.number} is missing its Japanese source name`);
    const expected = nameMap[card.jpName];
    if (expected) {
      assert.ok(
        card.name === expected || card.name === `${expected}（HoloSim 異圖）`,
        `${card.number} should use ${expected}, received ${card.name}`,
      );
      assert.notEqual(card.nameTranslationStatus, "official-japanese-fallback");
      localized += 1;
    } else {
      // No previous localized name may disappear. A new name without a reviewed
      // mapping must remain the official original, not a fabricated translation.
      assert.match(card.number, /^hBP09-\d{3}$/);
      assert.equal(card.nameTranslationStatus, "official-japanese-fallback");
      assert.equal(card.name, card.jpName);
      assert.equal(card.catalogVersion, "2026-09-17-hBP09");
      fallbacks += 1;
    }
  }
  assert.equal(payload.meta.traditionalChineseCards, localized);
  assert.equal(payload.meta.japaneseNameFallbackCards || 0, fallbacks);
  assert.equal(localized + fallbacks, payload.cards.length);
  assert.ok(localized >= 1276, "Previously reviewed name coverage must not shrink");
});

test("representative member and support cards use their reviewed Chinese names", () => {
  const expectedCards = new Map([
    ["hSD01-001", ["時乃空", "ときのそら"]],
    ["hBP01-104", ["普通電腦", "ふつうのパソコン"]],
    ["hBP08-004", ["水宮樞", "水宮枢"]],
  ]);

  for (const [number, [chineseName, japaneseName]] of expectedCards) {
    const card = payload.cards.find((candidate) => candidate.number === number);
    assert.ok(card, `${number} should exist`);
    assert.equal(card.name, chineseName);
    assert.equal(card.jpName, japaneseName);
  }
});

test("Summer Hologram contains all 214 official printings and keeps new Koyori mechanics", () => {
  const releaseName = "エクストラブースター サマー・ホログラム";
  const releaseCards = payload.cards.filter((card) => card.number.startsWith("hEB01-"));
  assert.equal(releaseCards.length, 34);
  assert.equal(releaseCards[0].number, "hEB01-001");
  assert.equal(releaseCards.at(-1).number, "hEB01-034");

  const koyoriOshi = releaseCards.find((card) => card.number === "hEB01-003");
  assert.ok(koyoriOshi);
  assert.equal(koyoriOshi.name, "博衣小夜璃");
  assert.equal(koyoriOshi.colors[0], "黃");
  assert.match(koyoriOshi.stageSkill?.name || "", /助手くん/);
  assert.match(koyoriOshi.oshiSkill?.effect || "", /藝能傷害\+30/);

  const releaseVariants = payload.cards
    .flatMap((card) => card.variants)
    .filter((variant) => variant.sets?.includes(releaseName));
  assert.equal(releaseVariants.length, 214);
  assert.equal(new Set(releaseVariants.map((variant) => variant.image)).size, 214);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(releaseVariants.map((variant) => variant.rarity))]
        .sort()
        .map((rarity) => [rarity, releaseVariants.filter((variant) => variant.rarity === rarity).length]),
    ),
    { C: 25, HR: 3, OSR: 3, OUR: 3, R: 22, RR: 15, S: 6, SEC: 3, SR: 76, SY: 6, U: 37, UR: 15 },
  );

  const releaseSetCards = payload.cards.filter((card) => card.sets.includes(releaseName));
  assert.equal(releaseSetCards.length, 108);
  for (const number of ["hY01-014", "hY02-012", "hY03-016", "hY04-013", "hY05-011", "hY06-011"]) {
    const cheer = releaseSetCards.find((card) => card.number === number);
    assert.equal(cheer?.group, "cheer");
    assert.deepEqual(cheer?.variants.map((variant) => variant.rarity), ["S", "SY"]);
  }

  const reprint = payload.cards.find((card) => card.number === "hBP01-021");
  assert.ok(reprint?.sets.includes("エクストラブースター サマー・ホログラム"));
  assert.ok(reprint.variants.some((variant) => variant.image.includes("/hEB01/")));
});

test("EN and ID members use official English names", () => {
  const expectedMembers = new Map([
    ["FUWAMOCO", "FUWAMOCO"],
    ["IRyS", "IRyS"],
    ["アーニャ・メルフィッサ", "Anya Melfissa"],
    ["アイラニ・イオフィフティーン", "Airani Iofifteen"],
    ["アユンダ・リス", "Ayunda Risu"],
    ["エリザベス・ローズ・ブラッドフレイム", "Elizabeth Rose Bloodflame"],
    ["オーロ・クロニー", "Ouro Kronii"],
    ["カエラ・コヴァルスキア", "Kaela Kovalskia"],
    ["クレイジー・オリー", "Kureiji Ollie"],
    ["こぼ・かなえる", "Kobo Kanaeru"],
    ["シオリ・ノヴェラ", "Shiori Novella"],
    ["ジジ・ムリン", "Gigi Murin"],
    ["セシリア・イマーグリーン", "Cecilia Immergreen"],
    ["ネリッサ・レイヴンクロフト", "Nerissa Ravencroft"],
    ["ハコス・ベールズ", "Hakos Baelz"],
    ["パヴォリア・レイネ", "Pavolia Reine"],
    ["フワワ・アビスガード", "Fuwawa Abyssguard"],
    ["ベスティア・ゼータ", "Vestia Zeta"],
    ["ムーナ・ホシノヴァ", "Moona Hoshinova"],
    ["モココ・アビスガード", "Mococo Abyssguard"],
    ["ラオーラ・パンテーラ", "Raora Panthera"],
    ["ワトソン・アメリア", "Watson Amelia"],
    ["一伊那尓栖", "Ninomae Ina'nis"],
    ["七詩ムメイ", "Nanashi Mumei"],
    ["古石ビジュー", "Koseki Bijou"],
    ["小鳥遊キアラ", "Takanashi Kiara"],
    ["森カリオペ", "Mori Calliope"],
  ]);

  for (const [japaneseName, englishName] of expectedMembers) {
    const memberCards = payload.cards.filter((card) => card.jpName === japaneseName);
    assert.ok(memberCards.length > 0, `${japaneseName} should exist`);
    assert.ok(
      memberCards.every((card) => card.name === englishName),
      `${japaneseName} should display as ${englishName}`,
    );
  }
});
