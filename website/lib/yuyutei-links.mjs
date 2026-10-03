import manifest from './yuyutei-products.json' with { type: 'json' };

const products = new Map(manifest.products.map(product => [`${product.number}|${product.printingId}`, product]));
const productUrl = /^https:\/\/yuyu-tei\.jp\/sell\/hocg\/card\/[a-z0-9-]+\/[0-9]{5}$/;

/** Resolve only the selected, stable printing. Never infer a retailer ID from a card number. */
export function yuyuteiLink(card, printing, productIndex = products) {
  const number = card?.number || '';
  if (!/^h[A-Z]{1,3}\d{0,2}-\d{3}$/.test(number)) {
    return { kind: 'unavailable', href: null, label: '遊遊亭連結暫不可用', note: '缺少有效卡號。' };
  }
  const selected = card.variants?.find(variant => variant.id === printing?.id);
  const rarity = selected?.rarity || '';
  const product = selected && productIndex.get(`${number}|${selected.id}`);
  const evidence = product?.evidence;
  const retailerGroup = typeof product?.url === 'string' ? product.url.match(/\/card\/(hbp\d+)\/[0-9]{5}$/)?.[1] : undefined;
  const errata = typeof evidence?.title === 'string' ? evidence.title.match(/エラッタ(前|後)/)?.[1] : undefined;
  const primaryVerified = product?.number === number && product?.printingId === selected?.id &&
    product?.printingVerified === true && evidence?.method === 'primary-browser' &&
    evidence.sourceUrl === product.url && evidence.number === number && evidence.rarity === rarity &&
    product.officialImage === selected?.image && evidence.officialImage === selected?.image &&
    typeof selected?.image === 'string' && selected.image &&
    (!retailerGroup || selected.image.toLowerCase().includes(`/${retailerGroup}/`)) &&
    evidence.artworkConfirmed === true && typeof evidence.title === 'string' && evidence.title.trim().replace(/\s+/g, ' ').startsWith(`${rarity} `) &&
    (!errata || (evidence.errataConfirmed === true && evidence.errataVersion === (errata === '前' ? 'before' : 'after'))) &&
    typeof evidence.retailerImage === 'string' && evidence.retailerImage.startsWith('https://') &&
    typeof evidence.reference === 'string' && evidence.reference.trim() &&
    typeof evidence.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(evidence.observedAt) && Number.isFinite(Date.parse(evidence.observedAt));
  if (product && primaryVerified && product.rarity === rarity && productUrl.test(product.url)) {
    return { kind: 'product', href: product.url, label: '遊遊亭價格 ↗', note: `${number} · ${rarity} · 開啟外部網站查看現價` };
  }
  // Observed in the parent's primary browser: card-number search returns multiple printings.
  return {
    kind: 'search',
    href: `https://yuyu-tei.jp/sell/hocg/s/search?search_word=${encodeURIComponent(number)}`,
    label: '搜尋遊遊亭 ↗',
    note: `${number}${rarity ? ` · ${rarity}` : ''} · 此版本連結尚未核對；遊遊亭按卡號搜尋，請選擇對應版本並核對稀有度及卡圖。`,
  };
}
