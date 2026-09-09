// Extract Japanese OCR matching evidence without replacing localized cards or
// simulator rules. Source dataset: lichingchester/hololive-ocg-wiki (Apache-2.0).
// Usage: node scripts/build-scanner-index.mjs cards-source.json cards-i18n.json
import fs from "node:fs";
if (!process.argv[2] || !process.argv[3]) throw new Error("Supply source cards.json and cards_i18n.json paths");
const base = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const i18n = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const translate = new Map(i18n.map(r => [r.id, r.translations?.ja]));
const known = new Set(JSON.parse(fs.readFileSync("public/cards.json", "utf8")).cards.map(c => c.number));
const cards = {};
for (const r of base) {
  if (!known.has(r.cardNumber)) continue;
  const ja = { ...translate.get(r.id), ...r.translations?.ja };
  const skills = [ja.keywordAbility, ja.keyword, ja.stageSkill, ja.oshiSkill, ja.spOshiSkill, ...(ja.arts || [])].filter(Boolean);
  const previous = cards[r.cardNumber] || { titles: [], effects: [] };
  cards[r.cardNumber] = {
    titles: [...new Set([...previous.titles, ...skills.map(s => s.name)].filter(Boolean))],
    effects: [...new Set([...previous.effects, ja.abilityText, ja.extra, ...skills.map(s => s.effect)].filter(Boolean))],
  };
}
const payload = { meta: {
  source: "https://github.com/lichingchester/hololive-ocg-wiki",
  note: "Modified extraction: Japanese source text only, grouped by existing card number. Missing records use native names/titles from cards.json. Not used to replace translations or simulator rules.",
}, cards };
fs.writeFileSync("public/scanner-ja.json", JSON.stringify(payload) + "\n");
console.log(`Indexed ${Object.keys(cards).length} existing card numbers.`);
