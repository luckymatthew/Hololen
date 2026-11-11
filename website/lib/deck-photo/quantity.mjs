import digitTemplates from './digit-templates.mjs';

const templates = Object.entries(digitTemplates).map(([character, shapes]) => [character,
  shapes.map(([aspect, raster]) => ({ aspect, values: Uint8Array.from(raster, n => parseInt(n, 16)) })),
]);

function crop(image, card, left, top, right, bottom) {
  const x = Math.max(0, Math.round(card.x + card.width * left));
  const y = Math.max(0, Math.round(card.y + card.height * top));
  return {
    x, y,
    width: Math.min(image.width, Math.round(card.x + card.width * right)) - x,
    height: Math.min(image.height, Math.round(card.y + card.height * bottom)) - y,
  };
}

function components({ data, width }, box, matches) {
  const { x, y, width: w, height: h } = box;
  if (w < 1 || h < 1) return [];
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const index = ((y + j) * width + x + i) * 4;
    mask[j * w + i] = Number(matches(data[index], data[index + 1], data[index + 2]));
  }
  const queue = new Int32Array(mask.length);
  const result = [];
  for (let index = 0; index < mask.length; index++) {
    if (mask[index] !== 1) continue;
    let count = 1, minX = w, maxX = 0, minY = h, maxY = 0;
    mask[index] = 2;
    queue[0] = index;
    for (let current = 0; current < count; current++) {
      const i = queue[current];
      const col = i % w, row = Math.floor(i / w);
      minX = Math.min(minX, col); maxX = Math.max(maxX, col);
      minY = Math.min(minY, row); maxY = Math.max(maxY, row);
      for (const neighbor of [col > 0 ? i - 1 : -1, col + 1 < w ? i + 1 : -1, i - w, i + w]) {
        if (mask[neighbor] !== 1) continue;
        mask[neighbor] = 2;
        queue[count++] = neighbor;
      }
    }
    result.push({ x: x + minX, y: y + minY, width: maxX - minX + 1, height: maxY - minY + 1, count });
  }
  return result;
}

const white = (r, g, b) => Math.min(r, g, b) > 158 && Math.max(r, g, b) - Math.min(r, g, b) < 58;

function readGlyph(image, glyph) {
  const shape = new Float32Array(12 * 18);
  for (let j = 0; j < 18; j++) for (let i = 0; i < 12; i++) {
    let level = 0;
    for (const y of [.25, .75]) for (const x of [.25, .75]) {
      const sampleX = glyph.x + Math.floor((i + x) * glyph.width / 12);
      const sampleY = glyph.y + Math.floor((j + y) * glyph.height / 18);
      const offset = (sampleY * image.width + sampleX) * 4;
      const intensity = Math.min(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
      level += Math.max(0, Math.min(15, (intensity - 105) * 15 / 105));
    }
    shape[j * 12 + i] = level / 4;
  }
  const aspect = glyph.width / glyph.height;
  const ranks = templates.map(([character, shapes]) => ({ character, distance: Math.min(...shapes.map(reference => {
    let difference = 0;
    for (let i = 0; i < shape.length; i++) difference += Math.abs(shape[i] - reference.values[i]);
    return difference / (shape.length * 15) + Math.min(.17, Math.abs(Math.log(aspect / reference.aspect)) * .22);
  })) })).sort((a, b) => a.distance - b.distance);
  return { ...ranks[0], margin: ranks[1].distance - ranks[0].distance };
}

function readLine(image, glyphs, overlay) {
  if (glyphs.length === 0 || glyphs.length > (overlay ? 3 : 2)) return null;
  const ordered = [...glyphs].sort((a, b) => a.x - b.x);
  const baseline = Math.max(...ordered.map(g => g.y + g.height));
  const height = Math.max(...ordered.map(g => g.height));
  if (ordered.some(g => g.y + g.height < baseline - height * .24)) return null;
  const reads = ordered.map(glyph => readGlyph(image, glyph));
  if (reads.some(read => read.distance > .32 || read.margin < .018)) return null;
  const text = reads.map(read => read.character).join('');
  if (!(overlay ? /^×[1-9]\d?$/ : /^[1-9]\d?$/).test(text)) return null;
  return { count: Number(text.replace('×', '')), distance: reads.reduce((sum, r) => sum + r.distance, 0) / reads.length };
}

function badgeCount(image, card) {
  const window = crop(image, card, .58, .77, 1.055, 1.065);
  // Dark artwork sometimes touches the black badge. A stricter threshold
  // disconnects those regions without changing how the white glyphs are read.
  for (const threshold of [77, 42, 30]) {
    const badges = components(image, window, (r, g, b) => Math.max(r, g, b) < threshold).filter(box =>
      box.width >= card.width * .16 && box.width <= card.width * .43 && box.height >= card.height * .10
      && box.height <= card.height * .215 && box.x + box.width >= card.x + card.width * .91
      && box.y + box.height >= card.y + card.height * .92 && box.count / (box.width * box.height) >= .49);
    for (const box of badges.sort((a, b) => b.count - a.count)) {
      const glyphs = components(image, box, white).filter(g => g.height >= box.height * .46 && g.height <= box.height * .91
        && g.width >= 3 && g.width <= g.height * .95);
      if (glyphs.some(g => g.x <= box.x || g.x + g.width >= box.x + box.width)) continue;
      const read = readLine(image, glyphs, false);
      if (read) return read;
    }
  }
  return null;
}

function outlinedCount(image, card) {
  const window = crop(image, card, .02, .68, 1.06, 1.05);
  const glyphs = components(image, window, white).filter(g => g.height >= card.height * .073
    && g.height <= card.height * .22 && g.width >= 3 && g.width <= g.height * 1.35);
  const reads = [];
  for (const glyph of glyphs) {
    const baseline = glyph.y + glyph.height;
    const line = glyphs.filter(g => Math.abs(g.y + g.height - baseline) <= glyph.height * .24
      && g.height >= glyph.height * .62 && Math.abs(g.x - glyph.x) <= card.width * .65);
    reads.push(readLine(image, line, true));
  }
  return reads.filter(Boolean).sort((a, b) => a.distance - b.distance)[0] ?? null;
}

export function readQuantity(image, card) {
  if (card.quantityMode === 'single') return 1;
  const read = card.quantityMode === 'badge' ? badgeCount(image, card) : outlinedCount(image, card);
  const limit = card.section === 'cheer' ? 20 : 50;
  return read && read.count <= limit ? read.count : null;
}
