import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifiedYuyuteiProducts } from './validate-yuyutei-evidence.mjs';
import { yuyuteiLink } from '../lib/yuyutei-links.mjs';

/** Merge a confirmed public subset; never promote rejected metadata-only candidates. */
export function mergeVerifiedYuyuteiManifest(manifest, records, catalog) {
  const incoming = verifiedYuyuteiProducts(records, catalog);
  const existing = manifest.products || [];
  const index = new Map();
  for (const product of existing) {
    const card = catalog.cards.find(card => card.number === product.number);
    const printing = card?.variants.find(printing => printing.id === product.printingId);
    const key = `${product.number}|${product.printingId}`;
    if (!printing || index.has(key) || yuyuteiLink(card, printing, new Map([[key, product]])).kind !== 'product') {
      throw new Error(`Existing product ${key} lacks consistent primary artwork evidence or is duplicated`);
    }
    index.set(key, product);
  }
  for (const product of incoming) {
    const key = `${product.number}|${product.printingId}`, previous = index.get(key);
    if (previous && previous.url !== product.url) throw new Error(`Conflicting retailer URL for ${key}; review the printing before replacing its mapping`);
    index.set(key, product);
  }
  // Revalidate the complete merge, including reused URLs and errata/version evidence.
  const products = verifiedYuyuteiProducts([...index.values()].map(product => ({
    ...product.evidence, url: product.url, number: product.number, rarity: product.rarity,
    printingId: product.printingId, officialImage: product.officialImage,
  })), catalog);
  const latestObservedAt = products.reduce((latest, product) => !latest || Date.parse(product.evidence.observedAt) > Date.parse(latest) ? product.evidence.observedAt : latest, '');
  return {
    ...manifest,
    verification: `${products.length} direct product mappings have primary-browser exact-artwork evidence. Unmapped printings use the verified native card-number search; historical rejected inferences are retained without promotion. Prices and stock are not fetched or stored.`,
    products,
    mappingEvidence: { ...manifest.mappingEvidence, method: 'primary-browser', verifiedProductCount: products.length, latestObservedAt },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , recordsPath, outputPath] = process.argv;
  if (!recordsPath || !outputPath) throw new Error('Usage: node scripts/import-yuyutei-evidence.mjs records.json manifest-preview.json');
  const payload = JSON.parse(readFileSync(recordsPath, 'utf8'));
  const catalog = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../lib/yuyutei-products.json', import.meta.url), 'utf8'));
  const merged = mergeVerifiedYuyuteiManifest(manifest, Array.isArray(payload) ? payload : payload.records, catalog);
  writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n');
}
