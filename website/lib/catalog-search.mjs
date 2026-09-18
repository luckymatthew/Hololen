import { cardText, cardTagText, effectText, keywordLabel } from "./card-terminology.mjs";

export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[‐‑‒–—−]/g, "-").replace(/\s+/g, " ").trim();
}

export function cardSearchText(card) {
  const skills = [card.keyword, card.stageSkill, card.oshiSkill, card.spOshiSkill];
  const raw = [
    card.number, card.name, card.jpName, card.enName, card.type, card.stage,
    card.set, ...(card.sets || []), ...(card.tags || []), card.abilityText, card.extra,
    keywordLabel(card.keyword?.type),
    ...skills.flatMap(skill => [skill?.name, skill?.effect]),
    ...(card.arts || []).flatMap(art => [art.name, art.effect]),
  ].filter(Boolean).join(" ");
  const reviewed = [card.name, card.abilityText, card.extra, ...skills.flatMap(skill => [skill?.name, skill?.effect]),
    ...(card.arts || []).flatMap(art => [art.name, art.effect])].filter(Boolean).map(value => effectText(card, value)).join(' ');
  return normalizeSearch(`${raw} ${cardText(raw)} ${reviewed} ${(card.tags || []).map(cardTagText).join(" ")}`);
}

export function matchesSearch(text, query) {
  const original = normalizeSearch(text);
  const canonical = normalizeSearch(cardText(text));
  return [normalizeSearch(query), normalizeSearch(cardText(query))].some(candidate =>
    candidate.split(" ").filter(Boolean).every(term => original.includes(term) || canonical.includes(term))
  );
}
