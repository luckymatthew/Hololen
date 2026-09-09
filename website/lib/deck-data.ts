export type DeckSection = "oshi" | "main" | "cheer";
export type StoredDeckState = Record<DeckSection, Record<string, number>> & {
  printings?: Record<string, Record<string, number>>;
};

export function validateDeckName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length > 0 && name.length <= 60 ? name : null;
}

export function validateDeckState(value: unknown): StoredDeckState | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const result: StoredDeckState = { oshi: {}, main: {}, cheer: {}, printings: {} };
  let distinctCards = 0;
  for (const section of ["oshi", "main", "cheer"] as DeckSection[]) {
    const entries = input[section];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
    for (const [number, rawCount] of Object.entries(entries as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9-]{3,40}$/.test(number)) return null;
      const count = Number(rawCount);
      if (!Number.isInteger(count) || count < 1 || count > 99) return null;
      result[section][number] = count;
      distinctCards += 1;
      if (distinctCards > 200) return null;
    }
  }
  const printings = input.printings;
  if (printings != null) {
    if (typeof printings !== "object" || Array.isArray(printings)) return null;
    let distinctPrintings = 0;
    for (const [number, rawVariants] of Object.entries(printings as Record<string, unknown>)) {
      if (!/^[A-Za-z0-9-]{3,40}$/.test(number) || !rawVariants || typeof rawVariants !== "object" || Array.isArray(rawVariants)) return null;
      const deckCount = result.oshi[number] || result.main[number] || result.cheer[number] || 0;
      if (deckCount <= 0) return null;
      const allocation: Record<string, number> = {};
      let allocated = 0;
      for (const [variantId, rawCount] of Object.entries(rawVariants as Record<string, unknown>)) {
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(variantId)) return null;
        const count = Number(rawCount);
        if (!Number.isInteger(count) || count < 1 || count > 99) return null;
        allocation[variantId] = count;
        allocated += count;
        distinctPrintings += 1;
        if (allocated > deckCount || distinctPrintings > 400) return null;
      }
      if (Object.keys(allocation).length > 0) result.printings![number] = allocation;
    }
  }
  if (Object.keys(result.printings!).length === 0) delete result.printings;
  return result;
}
