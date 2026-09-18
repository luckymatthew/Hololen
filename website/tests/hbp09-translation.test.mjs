import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { hbp09Translations, hbp09Translation, hbp09TranslationReview } from "../lib/hbp09-translations.mjs";
import { effectText, cardTagText } from "../lib/card-terminology.mjs";
import { cardSearchText, matchesSearch } from "../lib/catalog-search.mjs";

const raw = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url))).cards;
const byNumber = new Map(raw.map(c => [c.number, c]));
const at = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj);
const rules = card => {
  const values = [];
  for (const key of ["stageSkill", "oshiSkill", "spOshiSkill", "keyword"]) {
    if (card[key]?.effect) values.push([`${key}.effect`, card[key].effect]);
  }
  (card.arts || []).forEach((art, i) => { if (art.effect) values.push([`arts.${i}.effect`, art.effect]); });
  for (const key of ["abilityText", "extra"]) if (card[key]) values.push([key, card[key]]);
  return values;
};

test("111 numbered cards and all 168 nonempty effect fields are explicitly translated", () => {
  const numbers = Array.from({length:111}, (_,i) => `hBP09-${String(i+1).padStart(3,"0")}`);
  assert.deepEqual(Object.keys(hbp09Translations.cards).sort(), numbers);
  let count = 0;
  for (const n of numbers) {
    const c = byNumber.get(n);
    assert.ok(c, n);
    for (const [path, original] of rules(c)) {
      const entries = hbp09Translations.cards[n].fields.filter(f => f.path === path);
      assert.equal(entries.length, 1, `${n} ${path} exactly one translation`);
      assert.equal(entries[0].original, original, `${n} ${path} exact source guard`);
      assert.ok(entries[0].translation.trim().length > 0);
      count++;
    }
  }
  assert.equal(count, 168);
});

for (const [number, entry] of Object.entries(hbp09Translations.cards)) {
  test(`${number}: source fields, rendering and source immutability`, () => {
    const card = byNumber.get(number);
    const before = JSON.stringify(card);
    const seen = new Set();
    for (const field of entry.fields) {
      assert.ok(!seen.has(field.path), `${number} duplicate path ${field.path}`);
      seen.add(field.path);
      assert.equal(at(card, field.path), field.original, `${number} ${field.path}`);
      assert.equal(hbp09Translation(card, field.original, field.path), field.translation);
      // Identical source strings may legitimately appear in more than one field.
      const sameText = entry.fields.filter(f => f.original === field.original);
      assert.ok(sameText.every(f => f.translation === field.translation), `${number} ambiguous text translation`);
      assert.equal(effectText(card, field.original), field.translation);
      assert.equal(hbp09Translation(card, field.original + "\nUPDATED", field.path), null);
      assert.doesNotMatch(field.translation, /[\u3040-\u30ff]/u, `${number} unexpected untranslated kana`);
    }
    assert.equal(JSON.stringify(card), before, "display translation may not change game data");
  });
}

test("unknown cards and changed Japanese rules are not guessed or overwritten", () => {
  const card = byNumber.get("hBP09-006");
  assert.equal(hbp09Translation(null, "anything"), null);
  assert.equal(hbp09Translation({number:"hBP99-999"}, card.oshiSkill.effect), null);
  assert.equal(hbp09Translation(card, "This is a newly revised effect."), null);
  assert.equal(effectText(card, "This is a newly revised effect."), "This is a newly revised effect.");
});

test("Chinese support names, skill names and effects are searchable alongside Japanese", () => {
  assert.ok(matchesSearch(cardSearchText(byNumber.get("hBP09-090")), "聯動電腦"));
  assert.ok(matchesSearch(cardSearchText(byNumber.get("hBP09-090")), "コラボパソコン"));
  assert.ok(matchesSearch(cardSearchText(byNumber.get("hBP09-001")), "維護秩序"));
  assert.ok(matchesSearch(cardSearchText(byNumber.get("hBP09-007")), "菈米的酒"));
});

test("display lookup does not claim implemented effects or official/human approval", () => {
  for (const card of raw.filter(c => c.number.startsWith("hBP09-"))) {
    const status = hbp09TranslationReview(card);
    assert.equal(status.humanReviewStatus, "not-reviewed");
    assert.match(status.gameplay, /does not establish engine support/);
  }
});

test("important replacement, threshold, quantity and mixed-zone clauses survive translation", () => {
  const fields = n => hbp09Translations.cards[n].fields;
  const tr = (n,p) => fields(n).find(f => f.path===p).translation;
  assert.match(tr("hBP09-002", "oshiSkill.effect"), /每有1張.*增加10.*7張或以上.*再增加100/u);
  assert.match(tr("hBP09-006", "spOshiSkill.effect"), /所有手牌.*所有成員卡和支援卡.*抽7張/u);
  assert.match(tr("hBP09-007", "stageSkill.effect"), /增加20.*5張或以上.*改為.*增加50/u);
  assert.match(tr("hBP09-070", "arts.0.effect"), /7張.*增加70.*10張.*改為.*增加100/u);
  assert.match(tr("hBP09-087", "keyword.effect"), /變為2張/u);
  assert.match(tr("hBP09-088", "keyword.effect"), /不會受到一次200點或以上/u);
  assert.match(tr("hBP09-091", "abilityText"), /曾經倒下/u);
  assert.match(tr("hBP09-094", "abilityText"), /曾經倒下/u);
  assert.match(tr("hBP09-099", "abilityText"), /同1位成員/u);
  assert.match(tr("hBP09-104", "abilityText"), /最高的所有成員/u);
});

test("translated tag labels preserve canonical identity and are searchable", () => {
  const card = byNumber.get("hBP09-106");
  const before = JSON.stringify(card.tags);
  assert.equal(cardTagText("#カエラ'sアームズ"), "#Kaela的武器");
  assert.equal(cardTagText("#ラミィのお酒"), "#菈米的酒");
  assert.equal(cardTagText("#FLOW GLOW"), "#FLOW GLOW");
  assert.ok(matchesSearch(cardSearchText(card), "#Kaela的武器"));
  assert.ok(matchesSearch(cardSearchText(card), "#カエラ'sアームズ"));
  assert.equal(JSON.stringify(card.tags), before);
});


test("portable native translation JSON equals the browser translation payload", () => {
  const portable = JSON.parse(readFileSync(new URL("../public/hbp09-zh-Hant.json", import.meta.url), "utf8"));
  assert.deepEqual(portable, hbp09Translations);
});
