import { artworkConfidence, makeArtworkSampler, matchArtwork } from './artwork.mjs';
import { findCopyGrid, findDividedSheet, sideCardRects } from './layout.mjs';
import { readQuantity } from './quantity.mjs';

function inspect(image, rect, sample, references) {
  const matches = matchArtwork(sample(rect), references[rect.section]);
  return { rect, matches, confidence: artworkConfidence(matches), count: readQuantity(image, rect) };
}

function overlaps(a, b) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return width > 0 && height > 0 && width * height > Math.min(a.width * a.height, b.width * b.height) * .58;
}

function findPanelCards(image, grid, main, sample, references) {
  const first = main[0].rect;
  const right = Math.max(...main.map(({ rect }) => rect.x + rect.width));
  const sideRects = [
    ...sideCardRects(image, Math.max(0, Math.round(first.x - 2.65 * grid.step)), first.x - 2, first.y, grid.step),
    ...sideCardRects(image, right + 2, Math.min(image.width, Math.round(right + 2.65 * grid.step)), first.y, grid.step),
  ];
  const matches = [];
  for (const { density, ...box } of sideRects) {
    const signature = sample(box);
    for (const section of ['oshi', 'cheer']) {
      let ranked = matchArtwork(signature, references[section]);
      let rect = { ...box, section, quantityMode: section === 'oshi' ? 'single' : 'outlined' };
      // With overlapping Cheer cards, the bottom edge can be shorter than the
      // card itself. Try a slightly larger crop anchored to that edge.
      if (section === 'cheer' && ranked[0]?.distance > 16 && ranked[0].distance < 28) {
        const extraHeight = Math.round(box.height * .10);
        const expanded = { ...rect, y: box.y - extraHeight, width: Math.round(box.width * 1.10), height: box.height + extraHeight };
        if (expanded.y >= 0 && expanded.x + expanded.width <= image.width) {
          const alternatives = matchArtwork(sample(expanded), references[section]);
          if (alternatives[0].distance < ranked[0].distance) { rect = expanded; ranked = alternatives; }
        }
      }
      const confidence = artworkConfidence(ranked);
      if (!confidence.card || ranked[0].distance > 16) continue;
      const count = readQuantity(image, rect);
      // A readable ×n anchors an overlapping Cheer card more reliably than a
      // lower-edge crop inferred from a horizontal line in the illustration.
      matches.push({ rect, matches: ranked, confidence, count, score: ranked[0].distance - (section === 'cheer' && count !== null ? 2 : 0) });
    }
  }
  const kept = [];
  for (const candidate of matches.sort((a, b) => a.score - b.score)) {
    if (kept.some(row => overlaps(row.rect, candidate.rect))) continue;
    if (candidate.rect.section === 'oshi' && kept.some(row => row.rect.section === 'oshi')) continue;
    kept.push(candidate);
  }
  return kept.sort((a, b) => a.rect.y - b.rect.y).map(({ score, ...row }) => row);
}

export function recognizeDeckPhoto(image, references) {
  const divided = findDividedSheet(image);
  const grid = divided.length ? null : findCopyGrid(image);
  if (!divided.length && !grid) return { layout: 'unknown', rows: [] };
  const sample = makeArtworkSampler(image);
  if (divided.length) return { layout: 'divided', rows: divided.map(rect => inspect(image, rect, sample, references)) };

  const lines = grid.rows.map(row => row.map(rect => inspect(image, rect, sample, references)));
  // Grid edges extrapolated past a gutter may include a title or side panel.
  // Keep weak interior cells in the review instead of losing a possible card.
  const hasCard = row => row.some(cell => cell.confidence.card);
  while (lines.length && !hasCard(lines[0])) lines.shift();
  while (lines.length && !hasCard(lines.at(-1))) lines.pop();
  while (lines[0]?.length && !hasCard(lines.map(row => row[0]))) for (const row of lines) row.shift();
  while (lines[0]?.length && !hasCard(lines.map(row => row.at(-1)))) for (const row of lines) row.pop();
  const main = lines.flat();
  if (!main.length || main.filter(row => row.confidence.card).length < main.length * .6) return { layout: 'unknown', rows: [] };
  const side = findPanelCards(image, grid, main, sample, references);
  return {
    layout: 'copies',
    rows: [...side.filter(row => row.rect.section === 'oshi'), ...main, ...side.filter(row => row.rect.section === 'cheer')],
  };
}
