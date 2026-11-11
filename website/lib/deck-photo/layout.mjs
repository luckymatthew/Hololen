// A deck sheet either has section dividers and one thumbnail per printing, or
// lays out individual copies on a regular grid. A rectangle is always in the
// pixel space of the decoded photo, with its right/bottom edges exclusive.
const CARD_ASPECT = 400 / 559;

function runs(length, test, gap = 0) {
  const result = [];
  let start = -1, last = -1;
  for (let i = 0; i < length; i++) {
    if (!test(i)) continue;
    if (last >= 0 && i - last > gap + 1) {
      result.push([start, last + 1]);
      start = -1;
    }
    if (start < 0) start = i;
    last = i;
  }
  if (start >= 0) result.push([start, last + 1]);
  return result;
}

function pixelDifference(data, a, b) {
  return Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]);
}

function isInk(data, offset) {
  const r = data[offset], g = data[offset + 1], b = data[offset + 2];
  return Math.min(r, g, b) < 225 && r + g + b < 723;
}

function whiteSheetCards(image, start, end, section) {
  const { width, height, data } = image;
  const margin = Math.max(2, Math.round(width * .0045));
  const stride = width >= 1000 ? 2 : 1;
  const bands = runs(end - start, index => {
    const y = start + index;
    let ink = 0;
    for (let x = margin; x < width - margin; x += stride) {
      if (isInk(data, (y * width + x) * 4)) ink += stride;
    }
    return ink >= width * .039 && ink <= width * .975;
  }, Math.max(0, Math.round(width / 1200) - 1));

  return bands.flatMap(([top, bottom]) => {
    const bandHeight = bottom - top;
    if (bandHeight < width * .039 || bandHeight > width * .31) return [];
    const y = start + top;
    const sampleHeight = Math.round(bandHeight * .84);
    const columns = runs(width, x => {
      let ink = 0;
      for (let dy = 1; dy < sampleHeight; dy += stride) {
        if (isInk(data, ((y + dy) * width + x) * 4)) ink += stride;
      }
      return ink >= sampleHeight * .13;
    }, 1).filter(([left, right]) => right - left >= width * .044 && right - left <= width * .26);
    return columns.flatMap(([left, right]) => {
      const cardWidth = right - left;
      const expectedHeight = Math.round(cardWidth / CARD_ASPECT);
      if (bandHeight < expectedHeight * .62 || bandHeight > expectedHeight * 1.24 || y + expectedHeight > height + 4) return [];
      // A white Support card can disappear into the page halfway through its
      // text box. The visible side edges still give the full card height.
      const cardHeight = Math.min(height - y, expectedHeight);
      return [{ x: left, y, width: cardWidth, height: cardHeight, section, quantityMode: section === 'oshi' ? 'single' : 'badge' }];
    });
  });
}

export function findDividedSheet(image) {
  const { width, height, data } = image;
  const stride = Math.max(1, Math.floor(width / 520));
  const rules = runs(height, y => {
    let blue = 0;
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 95 && g < 120 && b < 180 && b > r + 8 && b > g + 6) blue += stride;
    }
    return blue > width * .70;
  }).filter(([top, bottom]) => bottom - top < height * .02);

  // A thin page frame can look like a divider. Choose a consecutive pair with
  // a single Oshi above, a body of cards between, and Cheer below.
  for (let i = 0; i < rules.length - 1; i++) {
    const [first, second] = [rules[i], rules[i + 1]];
    const oshi = whiteSheetCards(image, Math.max(0, first[0] - Math.round(width * .24), rules[i - 1]?.[1] ?? 0), first[0], 'oshi');
    if (oshi.length !== 1) continue;
    const main = whiteSheetCards(image, first[1], second[0], 'main');
    if (main.length < 3 || main.length > 55) continue;
    const cheer = whiteSheetCards(image, second[1], rules[i + 2]?.[0] ?? height, 'cheer');
    if (cheer.length > 0 && cheer.length <= 20) return [...oshi, ...main, ...cheer];
  }
  return [];
}

// A gutter stays nearly the same colour along its length, even when it lies
// between differently coloured cards. Use that signal across many rows.
function gutterCenters(image, axis, start, end) {
  const { width, height, data } = image;
  const length = axis === 'x' ? width : height;
  const delta = Math.max(2, Math.round(width / 384));
  const along = axis === 'x' ? width * 4 : 4;
  const across = axis === 'x' ? 4 : width * 4;
  const flatness = Float32Array.from({ length }, (_, n) => {
    let flat = 0, samples = 0;
    for (let i = start; i + delta < end; i += 2) {
      const offset = n * across + i * along;
      if (pixelDifference(data, offset, offset + delta * along) < 26) flat++;
      samples++;
    }
    return samples ? flat / samples : 0;
  });
  // Lossy recompression can leave a narrow seam with only a few flat pixels.
  // Take peaks across several thresholds and let their periodicity decide.
  const centers = [];
  for (const threshold of [.83, .73, .64, .55]) {
    for (const [a, b] of runs(length, n => flatness[n] >= threshold)) {
      if (b - a < Math.max(1, width * .001) || b - a > width * .025) continue;
      const center = (a + b) / 2;
      if (centers.every(point => Math.abs(point - center) > Math.max(2, width * .003))) centers.push(center);
    }
  }
  return centers.sort((a, b) => a - b);
}

function repeatingGutters(centers, min, max, required) {
  let best = null;
  for (let i = 0; i < centers.length; i++) for (let j = i + 1; j < centers.length; j++) {
    const step = centers[j] - centers[i];
    if (step < min) continue;
    if (step > max) break;
    const matched = [centers[i], centers[j]];
    for (let k = j + 1; k < centers.length; k++) {
      const average = (matched.at(-1) - matched[0]) / (matched.length - 1);
      const error = centers[k] - matched.at(-1) - average;
      if (error < -average * .10) continue;
      if (error > average * .10) break;
      if (Math.abs(centers[k + 1] - matched.at(-1) - average) < Math.abs(error)) continue;
      matched.push(centers[k]);
    }
    if (matched.length >= required) {
      const average = (matched.at(-1) - matched[0]) / (matched.length - 1);
      const error = matched.slice(1).reduce((sum, point, i) => sum + Math.abs(point - matched[i] - average), 0) / average;
      if (!best || matched.length - error > best.score) best = { points: matched, step: average, score: matched.length - error };
    }
  }
  return best;
}

function gridCells(axis, limit, inset) {
  const gaps = axis.points.slice(1).map((point, i) => point - axis.points[i]).sort((a, b) => a - b);
  const step = gaps[Math.floor(gaps.length / 2)];
  const origins = axis.points.map((point, i) => point - step * i).sort((a, b) => a - b);
  const origin = origins[Math.floor(origins.length / 2)];
  const points = axis.points.map((_, i) => origin + step * i);
  const before = [points[0] - step * 2, points[0] - step];
  const after = [points.at(-1) + step, points.at(-1) + step * 2];
  const edges = [
    ...before.filter(edge => edge >= -step * .04).map(edge => Math.max(0, edge)),
    ...points,
    ...after.filter(edge => edge <= limit + step * .04).map(edge => Math.min(limit, edge)),
  ];
  return edges.slice(1).map((end, i) => ({ start: Math.round(edges[i] + inset), end: Math.round(end - inset) }));
}

export function findCopyGrid(image) {
  const { width, height } = image;
  const xs = gutterCenters(image, 'x', Math.round(height * .15), Math.round(height * .98));
  const horizontal = repeatingGutters(xs, width * .045, width * .16, 4);
  if (!horizontal) return null;
  const columns = gridCells(horizontal, width, horizontal.step * .032);
  const ys = gutterCenters(image, 'y', Math.round(horizontal.points[0]), Math.round(horizontal.points.at(-1)));
  const expectedHeight = horizontal.step / CARD_ASPECT;
  const vertical = repeatingGutters(ys, expectedHeight * .87, expectedHeight * 1.12, 3);
  if (!vertical) return null;
  const rows = gridCells(vertical, height, vertical.step * .022);
  if (rows.length * columns.length > 120) return null;
  return {
    step: horizontal.step,
    rows: rows.map(({ start: y, end: bottom }) => columns.map(({ start: x, end: right }) => ({
      x, y, width: right - x, height: bottom - y, section: 'main', quantityMode: 'single',
    }))),
  };
}

export function sideCardRects(image, left, right, top, cardStep) {
  const { width, height, data } = image;
  if (right - left < cardStep * .55) return [];
  const delta = Math.max(2, Math.round(cardStep * .025));
  const stride = Math.max(2, Math.round(cardStep * .020));
  const candidates = new Map();
  for (let y = Math.max(delta, top); y < height - delta; y += stride) {
    const edges = new Uint8Array(right - left);
    for (let i = 0; i < edges.length; i++) {
      const index = (y * width + left + i) * 4;
      edges[i] = Number(pixelDifference(data, index - delta * width * 4, index + delta * width * 4) > 84);
    }
    for (const [start, end] of runs(edges.length, i => edges[i], Math.round(cardStep * .22))) {
      const cardWidth = end - start;
      if (cardWidth < cardStep * .58 || cardWidth > cardStep * 2.7) continue;
      const density = edges.subarray(start, end).reduce((a, b) => a + b, 0) / cardWidth;
      if (density < .67) continue;
      const cardHeight = Math.round(cardWidth / CARD_ASPECT);
      for (const cardY of [y, y - cardHeight]) {
        if (cardY < 0 || cardY + cardHeight > height + 2) continue;
        const x = left + start;
        const key = [x, cardY, cardWidth].map(n => Math.round(n / (stride * 2))).join('/');
        const previous = candidates.get(key);
        if (!previous || previous.density < density) candidates.set(key, { x, y: cardY, width: cardWidth, height: cardHeight, density });
      }
    }
  }
  return [...candidates.values()].sort((a, b) => b.density - a.density).slice(0, 850);
}
