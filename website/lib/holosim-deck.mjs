function baseCardNumber(value) {
  if (typeof value !== "string") throw new Error("Invalid HoloSim card number");
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Invalid HoloSim card number");
  return trimmed.replace(/_\d+$/, "");
}

function countCards(values) {
  if (!Array.isArray(values)) throw new Error("Invalid HoloSim deck list");
  const counts = {};
  for (const value of values) {
    const number = baseCardNumber(value);
    counts[number] = (counts[number] ?? 0) + 1;
  }
  return counts;
}

function resolveVariant(number, variantIndex) {
  const variants = variantIndex?.[number];
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.find((variant) => variant === `${number}_0`) ?? variants[0];
}

function expandCards(section, variantIndex, unsupported) {
  return Object.entries(section)
    .sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))
    .flatMap(([number, count]) => {
      const variant = resolveVariant(number, variantIndex);
      if (!variant) {
        unsupported.add(number);
        return [];
      }
      return Array.from({ length: Math.max(0, Number(count) || 0) }, () => variant);
    });
}

export function toHoloSimFilename(value) {
  const normalized = typeof value === "string" ? value.normalize("NFC").trim() : "";
  const withoutExtension = normalized.replace(/\.json$/i, "");
  let safeName = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 60)
    .trim();
  if (!safeName) safeName = "holosim-deck";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeName)) safeName = `_${safeName}`;
  return `${safeName}.json`;
}

export function fromHoloSimDeck(value) {
  if (!value || typeof value !== "object") throw new Error("Invalid HoloSim deck");
  const oshiNumber = baseCardNumber(value.oshiCardNumber);
  return {
    oshi: { [oshiNumber]: 1 },
    main: countCards(value.mainDeckCardNumbers),
    cheer: countCards(value.yellDeckCardNumbers),
  };
}

export function toHoloSimDeck(deck, variantIndex = {}) {
  const unsupported = new Set();
  const oshiNumber = Object.entries(deck.oshi).find(([, count]) => Number(count) > 0)?.[0] ?? "";
  const oshiVariant = oshiNumber ? resolveVariant(oshiNumber, variantIndex) : "";
  if (oshiNumber && !oshiVariant) unsupported.add(oshiNumber);
  return {
    deck: {
      oshiCardNumber: oshiVariant || "",
      mainDeckCardNumbers: expandCards(deck.main, variantIndex, unsupported),
      yellDeckCardNumbers: expandCards(deck.cheer, variantIndex, unsupported),
    },
    unsupported: [...unsupported],
  };
}

export function isHoloSimDeck(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    "oshiCardNumber" in value &&
    "mainDeckCardNumbers" in value &&
    "yellDeckCardNumbers" in value,
  );
}
