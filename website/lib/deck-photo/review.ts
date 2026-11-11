import type { DeckSection, StoredDeckState } from "../deck-data";
import { OFFICIAL_ART_ORIGIN } from "./artwork.mjs";

export const photoSections: { id: DeckSection; label: string; limit: number }[] = [
  { id: "oshi", label: "主推成員", limit: 1 },
  { id: "main", label: "主牌組", limit: 50 },
  { id: "cheer", label: "能量牌組", limit: 20 },
];

export type PhotoRect = { x: number; y: number; width: number; height: number; section: DeckSection };
type ArtworkMatch = { number: string; printingId: string; source: string; distance: number };

export type PhotoScan = {
  layout: "divided" | "copies" | "unknown";
  rows: { rect: PhotoRect; matches: ArtworkMatch[]; confidence: { card: boolean; printing: boolean }; count: number | null }[];
};

export type PhotoPrinting = {
  id: string;
  label: string;
  searchText: string;
  card: { number: string; name: string; group: string; stage: string; maxCopies: number; image: string; simOnly: boolean };
  variant?: { id: string; image: string };
};

export type PhotoChoice = {
  key: string;
  number: string;
  name: string;
  section: DeckSection;
  maxCopies: number;
  printingId?: string;
  image: string;
  label: string;
  stage: string;
  searchText: string;
};

export type PhotoReviewRow = {
  id: number;
  section: DeckSection;
  rects: PhotoRect[];
  selected: string | null;
  suggested: string[];
  count: number | null;
  defaulted: boolean;
};

function choiceKey(number: string, id: string) {
  return `${number}/${id}`;
}

export function photoChoices(printings: PhotoPrinting[]): Map<string, PhotoChoice> {
  return new Map(printings.filter(({ card }) => !card.simOnly).map(({ card, variant, id, label, searchText }) => {
    const key = choiceKey(card.number, id);
    const section = card.group === "oshi" || card.group === "cheer" ? card.group : "main";
    return [key, { key, number: card.number, name: card.name, section, maxCopies: card.maxCopies,
      printingId: variant?.id, image: variant?.image || card.image, label, stage: card.stage, searchText }];
  }));
}

export function makePhotoReview(scan: PhotoScan, choices: Map<string, PhotoChoice>): PhotoReviewRow[] {
  const rows: PhotoReviewRow[] = [];
  const repeat = new Map<string, PhotoReviewRow>();
  // catalogPrintings orders each card's variants the same way as the builder.
  const defaultPrinting = new Map<string, string>();
  for (const choice of choices.values()) if (!defaultPrinting.has(choice.number)) defaultPrinting.set(choice.number, choice.key);
  for (const { rect, matches, confidence, count } of scan.rows) {
    const matchingKeys = matches.flatMap(match => {
      const key = choiceKey(match.number, match.printingId);
      const choice = choices.get(key);
      if (choice?.section !== rect.section) return [];
      const source = choice.image.startsWith(`${OFFICIAL_ART_ORIGIN}/`) ? choice.image.slice(OFFICIAL_ART_ORIGIN.length) : choice.image;
      return source === match.source ? [key] : [];
    });
    const top = matches[0] && choiceKey(matches[0].number, matches[0].printingId);
    const knownNumber = top && matchingKeys[0] === top && confidence.card ? matches[0].number : null;
    const selected = knownNumber ? (confidence.printing ? top : defaultPrinting.get(knownNumber) ?? null) : null;
    const defaulted = selected !== null && !confidence.printing;
    const suggested = knownNumber ? matchingKeys.filter(key => choices.get(key)?.number === knownNumber) : matchingKeys;
    const previous = scan.layout === "copies" && rect.section === "main" && selected && repeat.get(selected);
    if (previous && previous.count !== null && count !== null) {
      previous.rects.push(rect);
      previous.count += count;
      previous.defaulted ||= defaulted;
      continue;
    }
    const row = { id: rows.length, section: rect.section, rects: [rect], selected, suggested, count, defaulted };
    rows.push(row);
    if (selected) repeat.set(selected, row);
  }
  return rows;
}

export function reviewPhotoDeck(rows: PhotoReviewRow[], choices: Map<string, PhotoChoice>) {
  const deck: StoredDeckState = { oshi: {}, main: {}, cheer: {} };
  const printings: NonNullable<StoredDeckState["printings"]> = {};
  const totals = { oshi: 0, main: 0, cheer: 0 };
  const unresolved = new Set<number>();
  const limits = new Map<string, PhotoChoice>();

  for (const row of rows) {
    const count = row.count;
    const quantityValid = count !== null && Number.isInteger(count) && count > 0 && count <= (photoSections.find(section => section.id === row.section)?.limit ?? 0);
    if (quantityValid) totals[row.section] += count;
    const choice = row.selected ? choices.get(row.selected) : undefined;
    if (!choice || choice.section !== row.section || !quantityValid) {
      unresolved.add(row.id);
      continue;
    }
    deck[row.section][choice.number] = (deck[row.section][choice.number] || 0) + count;
    limits.set(choice.number, choice);
    if (choice.printingId) {
      const allocations = printings[choice.number] ??= {};
      allocations[choice.printingId] = (allocations[choice.printingId] || 0) + count;
    }
  }
  if (Object.keys(printings).length) deck.printings = printings;
  const problems = photoSections.filter(({ id, limit }) => totals[id] > limit).map(({ label, limit }) => `${label}最多 ${limit} 張。`);
  for (const { number, section, maxCopies } of limits.values()) {
    if (deck[section][number] > maxCopies) problems.push(`${number} 同卡號最多 ${maxCopies} 張，包含所有版本。`);
  }
  return { deck, totals, unresolved, problems,
    complete: photoSections.every(({ id, limit }) => totals[id] === limit),
    canSave: rows.length > 0 && !unresolved.size && !problems.length,
  };
}
