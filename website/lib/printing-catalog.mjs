import { cardSearchText, matchesSearch } from './catalog-search.mjs';
import { cardTagText } from './card-terminology.mjs';

// A printing is a presentation choice; the parent remains the deck/game identity.
const rarityOrder = ['C', 'U', 'R', 'RR', 'OC', 'OSR', 'S', 'SR', 'SY', 'UR', 'HR', 'OUR', 'SEC', 'P'];
const rarityRank = new Map(rarityOrder.map((rarity, index) => [rarity, index]));
const tagOrder = new Intl.Collator('zh-Hant', { numeric: true, sensitivity: 'base' });

export function catalogCardTags(card) {
  const tags = new Map();
  for (const raw of card.tags ?? []) {
    const name = String(raw ?? '').trim().replace(/^[#＃]+/, '').trim();
    if (!name) continue;
    const label = cardTagText(`#${name}`);
    const key = label.normalize('NFKC').toLowerCase();
    if (!tags.has(key)) tags.set(key, { key, label });
  }
  return [...tags.values()];
}

export function catalogTagOptions(entries) {
  const tags = new Map();
  for (const entry of entries) for (const tag of entry.tags) {
    if (!tags.has(tag.key)) tags.set(tag.key, tag);
  }
  return [...tags.values()].sort((a, b) => tagOrder.compare(a.label, b.label));
}

export function sortVariantsByRarity(variants) {
  return [...variants].sort((left, right) =>
    (rarityRank.get(left.rarity) ?? rarityOrder.length) - (rarityRank.get(right.rarity) ?? rarityOrder.length)
    || left.id.localeCompare(right.id, 'en', { numeric: true }));
}

export function variantLabel(variant, variants) {
  const sameRarity = variants.filter(candidate => candidate.rarity === variant.rarity);
  const position = sameRarity.findIndex(candidate => candidate.id === variant.id);
  return sameRarity.length > 1 ? `${variant.rarity} ${position + 1}` : variant.rarity;
}

export function catalogPrintings(cards) {
  return cards.flatMap(card => {
    const variants = sortVariantsByRarity(card.variants);
    const tags = catalogCardTags(card);
    const tagText = tags.map(tag => tag.label).join(' ');
    // Keep simulator-only cards available without fabricating a printing or artwork.
    return (variants.length ? variants : [undefined]).map(variant => {
      const id = variant?.id || card.id;
      const sets = variant?.sets?.length ? variant.sets : card.sets;
      return {
        card, variant, id, tags,
        label: variant ? variantLabel(variant, variants) : card.rarity,
        releaseDate: variant?.releaseDate || card.releaseDate || '',
        searchText: `${cardSearchText({ ...card, set: sets?.[0] || card.set, sets })} ${id} ${variant?.rarity || card.rarity} ${tagText}`,
      };
    });
  });
}

export function filterCatalogPrintings(entries, filters) {
  const { type = 'all', color = 'all', stage = 'all', set = 'all', member = 'all', tag = '', query = '', sort = 'number' } = filters;
  return entries.filter(({ card, searchText, tags }) =>
    (type === 'all' || card.group === type)
    && (color === 'all' || card.colorCodes.includes(color))
    && (stage === 'all' || card.stage === stage)
    && (set === 'all' || card.number.startsWith(`${set}-`))
    && (member === 'all' || card.jpName === member || card.name === member)
    && (!tag || tags.some(item => item.key === tag))
    && matchesSearch(searchText, query)
  ).sort((left, right) => {
    const byNumber = left.card.number.localeCompare(right.card.number, 'en', { numeric: true });
    if (sort === 'tag') {
      const a = left.tags[0]?.label, b = right.tags[0]?.label;
      const byTag = a && b ? tagOrder.compare(a, b) : a ? -1 : b ? 1 : 0;
      if (byTag) return byTag;
    }
    if (sort === 'name') {
      const byName = left.card.name.localeCompare(right.card.name, 'zh-Hant');
      if (byName || byNumber) return byName || byNumber;
    }
    if (sort === 'newest') {
      const byRelease = right.releaseDate.localeCompare(left.releaseDate);
      if (byRelease || byNumber) return byRelease || -byNumber;
    }
    if (byNumber) return byNumber;
    return (rarityRank.get(left.variant?.rarity || left.card.rarity) ?? rarityOrder.length)
      - (rarityRank.get(right.variant?.rarity || right.card.rarity) ?? rarityOrder.length)
      || left.id.localeCompare(right.id, 'en', { numeric: true });
  });
}
