// The first hEB01 import attached these six S printings to the SY card number.
// Resolve the complete (card number, printing ID) pair, never the stable card.id.
// Stored decks, drafts, collection records and sync hashes remain authoritative:
// callers use this non-mutating projection only for their working/display deck.
export const LEGACY_CHEER_PRINTINGS = Object.freeze([
  ['hY01-014', 'hY01-001', '2670'],
  ['hY02-012', 'hY02-001', '2671'],
  ['hY03-016', 'hY03-001', '2672'],
  ['hY04-013', 'hY04-001', '2673'],
  ['hY05-011', 'hY05-001', '2674'],
  ['hY06-011', 'hY06-001', '2675'],
].map(([number, targetNumber, officialId]) => Object.freeze({
  number, variantId: `heb01-${number}-S-1`,
  targetNumber, targetVariantId: `official-${targetNumber}-${officialId}`,
})));

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

// Existing battles retain their original instance IDs and serialized state.
// Their artwork/labels can use the same exact correction without migrating play.
export function projectLegacyCardReference(reference) {
  if (!isRecord(reference)) return reference;
  const mapping = LEGACY_CHEER_PRINTINGS.find(item => item.number === reference.number && item.variantId === reference.variantId);
  return mapping ? { ...reference, number: mapping.targetNumber, variantId: mapping.targetVariantId } : reference;
}

function validAllocation(allocation, total) {
  if (!isRecord(allocation)) return false;
  const counts = Object.values(allocation).map(Number);
  return counts.every(count => Number.isInteger(count) && count > 0)
    && counts.reduce((sum, count) => sum + count, 0) <= total;
}

export function projectLegacyPrintings(deck) {
  if (!isRecord(deck) || !isRecord(deck.cheer) || !isRecord(deck.printings)) return deck;
  let projected = deck;
  for (const { number, variantId, targetNumber, targetVariantId } of LEGACY_CHEER_PRINTINGS) {
    const allocation = projected.printings[number];
    if (!isRecord(allocation) || !Object.hasOwn(allocation, variantId)) continue;
    const total = Number(projected.cheer[number]);
    const count = Number(allocation[variantId]);
    const targetTotal = Number(projected.cheer[targetNumber] ?? 0);
    const targetAllocation = projected.printings[targetNumber] ?? {};
    // Do not repair malformed decks or mask validation errors while resolving IDs.
    if (!Number.isInteger(total) || total < 1 || total > 99
      || !Number.isInteger(targetTotal) || targetTotal < 0 || targetTotal > 99
      || targetTotal + count > 99
      || !validAllocation(allocation, total) || !validAllocation(targetAllocation, targetTotal)) continue;
    if (projected === deck) projected = { ...deck, cheer: { ...deck.cheer }, printings: { ...deck.printings } };
    const remaining = { ...allocation };
    delete remaining[variantId];
    if (Object.keys(remaining).length) projected.printings[number] = remaining;
    else delete projected.printings[number];
    if (total > count) projected.cheer[number] = total - count;
    else delete projected.cheer[number];
    projected.cheer[targetNumber] = targetTotal + count;
    projected.printings[targetNumber] = {
      ...targetAllocation,
      [targetVariantId]: Number(targetAllocation[targetVariantId] || 0) + count,
    };
  }
  return projected;
}
