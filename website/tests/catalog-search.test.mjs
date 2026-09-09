import test from "node:test";
import assert from "node:assert/strict";
import { cardSearchText, matchesSearch, normalizeSearch } from "../lib/catalog-search.mjs";

const card = {
  number: "hBP04-008", name: "博衣小夜璃", jpName: "博衣こより", enName: "Hakui Koyori",
  type: "Holomen", stage: "Debut", tags: ["#秘密結社holoX"],
  keyword: { name: "實驗", effect: "從牌庫抽取1張卡" },
  stageSkill: { name: "舞台技能", effect: "回復HP" },
  spOshiSkill: { name: "SP研究", effect: "特殊傷害" },
  arts: [{ name: "こよこよ", effect: "對手中央" }],
};

test("fullwidth card codes and alternate dashes normalize", () => {
  assert.equal(normalizeSearch(" ＨＢＰ０４－００８　"), "hbp04-008");
  assert.ok(matchesSearch(cardSearchText(card), "ＨＢＰ０４–００８"));
});
test("multiple terms match across name, language, stage and effects", () => {
  const text = cardSearchText(card);
  assert.ok(matchesSearch(text, "Koyori 抽取"));
  assert.ok(matchesSearch(text, "こより　Debut"));
  assert.ok(matchesSearch(text, "holoX 特殊傷害"));
  assert.ok(matchesSearch(text, "舞台技能 回復HP"));
  assert.ok(matchesSearch(text, "こよこよ 中央"));
  assert.equal(matchesSearch(text, "Koyori 不存在的效果"), false);
});
test("empty input matches without needing optional card fields", () => {
  assert.equal(matchesSearch(cardSearchText({ number: "hY01-001" }), "  "), true);
  assert.equal(matchesSearch(cardSearchText({}), "こより"), false);
});
