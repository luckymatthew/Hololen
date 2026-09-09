// OCR is evidence, not an identifier. Never auto-open on a generic effect or
// a member name alone. Parallel printings intentionally share a result.
export function normalizeScanText(value = "") {
  return String(value).normalize("NFKC").toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function grams(text, size = 3) {
  return new Set(Array.from({ length: Math.max(0, text.length - size + 1) }, (_, i) => text.slice(i, i + size)));
}

export function createScanIndex(cards, japanese = {}) {
  const rows = cards.map(card => {
    const source = japanese[card.number] || {};
    const skills = [card.keyword, card.stageSkill, card.oshiSkill, card.spOshiSkill, ...(card.arts || [])].filter(Boolean);
    const titles = [...new Set([...skills.map(s => s.name), ...(source.titles || [])].map(normalizeScanText).filter(t => t.length >= 3))];
    const effects = [card.abilityText, ...skills.map(s => s.effect), ...(source.effects || [])].filter(Boolean).map(normalizeScanText);
    return { card, number: normalizeScanText(card.number), names: [...new Set([card.name, card.jpName, card.enName].filter(Boolean).map(normalizeScanText))], titles, effectGrams: new Set(effects.flatMap(effect => [...grams(effect, 5)])) };
  });
  const frequency = new Map();
  const effectFrequency = new Map();
  for (const row of rows) for (const title of row.titles) frequency.set(title, (frequency.get(title) || 0) + 1);
  for (const row of rows) for (const part of row.effectGrams) effectFrequency.set(part, (effectFrequency.get(part) || 0) + 1);
  return { rows, frequency, effectFrequency };
}

export function matchScanText(index, rawText) {
  const text = normalizeScanText(String(rawText).slice(0, 12000));
  if (text.length < 3) return { matches: [], autoNumber: null };
  const raw = String(rawText).normalize("NFKC").toLowerCase();
  const codes = [...raw.matchAll(/h\s*(?:bp|bd|sd|eb|pr|ys|y)\s*\d{0,2}\s*[-‐‑–—ー]?\s*\d{3}(?!\d)/gi)].map(m => normalizeScanText(m[0]));
  const hp = raw.match(/hp\s*[:：]?\s*(\d{2,3})/i)?.[1];
  const stage = raw.match(/\b(debut|1st|2nd|spot)\b/i)?.[1]?.toLowerCase();
  const textGrams = grams(text);
  const effectEvidence = [...grams(text, 5)].filter(part => index.effectFrequency.has(part))
    .map(part => [part, Math.log(1 + index.rows.length / index.effectFrequency.get(part))]);
  const matches = [];
  for (const row of index.rows) {
    const reasons = [];
    let score = 0;
    const exactCode = codes.includes(row.number);
    if (exactCode) { score = 200; reasons.push("卡號相符"); }
    const nameMatch = row.names.some(name => name.length >= 3 && text.includes(name));
    if (nameMatch) { score += 25; reasons.push("角色／卡名相符"); }
    let exactTitle = false, uniqueTitle = false;
    let titleScore = 0;
    for (const title of row.titles) {
      if (text.includes(title)) {
        exactTitle = true;
        const unique = index.frequency.get(title) === 1;
        uniqueTitle ||= unique && title.length >= 5;
        titleScore = Math.max(titleScore, unique ? 65 : 40);
      } else if (title.length >= 6) {
        const parts = grams(title);
        const overlap = [...parts].filter(part => textGrams.has(part)).length / parts.size;
        if (overlap >= 0.6) titleScore = Math.max(titleScore, Math.round(overlap * 35));
      }
    }
    if (titleScore) { score += titleScore; reasons.push(exactTitle ? "技能名相符" : "技能名近似"); }
    // Long, consecutive fragments are useful, but generic effect overlap alone
    // is never enough for automatic selection.
    const overlap = effectEvidence.filter(([part]) => row.effectGrams.has(part));
    if (overlap.length >= 3) {
      const weight = overlap.reduce((sum, [, value]) => sum + value, 0);
      if (weight >= 8) { score += Math.min(45, Math.round(weight / 3)); reasons.push("效果片段相符"); }
    }
    if (score === 0) continue;
    if (hp && row.card.hp != null) {
      score += Number(hp) === row.card.hp ? 12 : -20;
      if (Number(hp) === row.card.hp) reasons.push("HP 相符");
    }
    if (stage && row.card.stage) score += stage === row.card.stage.toLowerCase() ? 8 : -15;
    const conflict = (hp && row.card.hp != null && Number(hp) !== row.card.hp) || (stage && row.card.stage && stage !== row.card.stage.toLowerCase());
    if (score > 0) matches.push({ number: row.card.number, score, reasons, exactCode, strongText: uniqueTitle && nameMatch && !conflict });
  }
  matches.sort((a, b) => b.score - a.score || a.number.localeCompare(b.number));
  const best = matches[0], next = matches[1];
  const autoNumber = best && ((best.exactCode && new Set(codes).size === 1 && !next?.exactCode) ||
    (codes.length === 0 && best.strongText && best.score >= 90 && best.score - (next?.score || 0) >= 30)) ? best.number : null;
  return { matches: matches.slice(0, 8), autoNumber };
}

// Map the visible guide through object-fit: cover to the actual camera pixels.
export function cameraCrop(videoWidth, videoHeight, view, guide) {
  const scale = Math.max(view.width / videoWidth, view.height / videoHeight);
  const offsetX = (videoWidth * scale - view.width) / 2;
  const offsetY = (videoHeight * scale - view.height) / 2;
  return { x: (guide.left - view.left + offsetX) / scale, y: (guide.top - view.top + offsetY) / scale, width: guide.width / scale, height: guide.height / scale };
}
