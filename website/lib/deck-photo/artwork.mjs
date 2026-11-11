const GRID_WIDTH = 8;
const GRID_HEIGHT = 10;
const FEATURE_LENGTH = GRID_WIDTH * GRID_HEIGHT * 3;
const MAX_RESULTS = 6;

export const PHOTO_INDEX_PATH = '/deck-photo-index.v1.json';
export const OFFICIAL_ART_ORIGIN = 'https://hololive-official-cardgame.com';

export function readArtworkIndex(index) {
  if (index?.version !== 1 || !Array.isArray(index.rows)) throw new Error('卡圖索引格式不正確。');
  const sections = { oshi: [], main: [], cheer: [] };
  for (const [number, printingId, section, source, encoded] of index.rows) {
    const raw = atob(encoded);
    if (raw.length !== FEATURE_LENGTH || !Object.hasOwn(sections, section)) throw new Error('卡圖索引不完整。');
    sections[section].push({ number, printingId, source, pixels: Uint8Array.from(raw, c => c.charCodeAt(0)) });
  }
  return sections;
}

export function makeArtworkSampler({ width, height, data }) {
  const pitch = width + 1;
  const sums = Array.from({ length: 3 }, () => new Uint32Array(pitch * (height + 1)));
  for (let y = 1; y <= height; y++) {
    const row = [0, 0, 0];
    for (let x = 1; x <= width; x++) {
      const input = ((y - 1) * width + x - 1) * 4;
      const index = y * pitch + x;
      for (let c = 0; c < 3; c++) {
        row[c] += data[input + c];
        sums[c][index] = sums[c][index - pitch] + row[c];
      }
    }
  }
  const edge = (base, size, fraction, limit) => Math.max(0, Math.min(limit, Math.round(base + size * fraction)));
  return rect => {
    const pixels = new Uint8Array(FEATURE_LENGTH);
    let next = 0;
    for (let y = 0; y < GRID_HEIGHT; y++) {
      const top = edge(rect.y, rect.height, .04 + y * .74 / GRID_HEIGHT, height - 1);
      const bottom = Math.max(top + 1, edge(rect.y, rect.height, .04 + (y + 1) * .74 / GRID_HEIGHT, height));
      for (let x = 0; x < GRID_WIDTH; x++) {
        const left = edge(rect.x, rect.width, .04 + x * .92 / GRID_WIDTH, width - 1);
        const right = Math.max(left + 1, edge(rect.x, rect.width, .04 + (x + 1) * .92 / GRID_WIDTH, width));
        const area = (bottom - top) * (right - left);
        for (const sum of sums) {
          pixels[next++] = Math.round((sum[bottom * pitch + right] - sum[bottom * pitch + left]
            - sum[top * pitch + right] + sum[top * pitch + left]) / area);
        }
      }
    }
    return pixels;
  };
}

export function matchArtwork(signature, references, limit = MAX_RESULTS) {
  const best = [];
  let cutoff = Infinity;
  for (const ref of references) {
    let difference = 0;
    for (let i = 0; i < FEATURE_LENGTH && difference <= cutoff; i++) {
      difference += Math.min(85, Math.abs(signature[i] - ref.pixels[i]));
    }
    if (difference > cutoff) continue;
    const position = best.findIndex(row => row.difference > difference);
    if (position < 0) best.push({ ...ref, difference });
    else best.splice(position, 0, { ...ref, difference });
    if (best.length > limit) best.pop();
    if (best.length === limit) cutoff = best.at(-1).difference;
  }
  return best.map(({ number, printingId, source, difference }) => ({ number, printingId, source, distance: difference / FEATURE_LENGTH }));
}

export function artworkConfidence(matches) {
  const best = matches[0];
  if (!best) return { card: false, printing: false };
  const otherCard = matches.find(match => match.number !== best.number);
  const sameCard = matches.find(match => match.number === best.number && match.printingId !== best.printingId);
  const card = best.distance <= 19 && (!otherCard || otherCard.distance - best.distance >= 2.8);
  return { card, printing: card && (!sameCard || sameCard.distance - best.distance >= 1.8) };
}
