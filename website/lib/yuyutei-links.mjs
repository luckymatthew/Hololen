import manifest from './yuyutei-products.json' with { type: 'json' };

const products = new Map(manifest.products.map(product => [`${product.number}|${product.printingId}`, product]));
const productUrl = /^https:\/\/yuyu-tei\.jp\/sell\/hocg\/card\/[a-z0-9-]+\/[0-9]{5}$/;

/** Resolve only the selected, stable printing. Never infer a retailer ID from a card number. */
export function yuyuteiLink(card, printing) {
  const number = card?.number || '';
  if (!/^h[A-Z]{1,3}\d{0,2}-\d{3}$/.test(number)) {
    return { kind: 'unavailable', href: null, label: '遊遊亭連結暫不可用', note: '缺少有效卡號。' };
  }
  const selected = card.variants?.find(variant => variant.id === printing?.id);
  const rarity = selected?.rarity || '';
  const product = selected && products.get(`${number}|${selected.id}`);
  if (product && product.rarity === rarity && productUrl.test(product.url)) {
    return { kind: 'product', href: product.url, label: '遊遊亭價格 ↗', note: `${number} · ${rarity} · 開啟外部網站查看現價` };
  }
  // Google's documented site/exact-match operators; this is a search, never a printing price.
  const query = `site:yuyu-tei.jp/sell/hocg/card/ "${number}"${rarity ? ` "${rarity}"` : ''}`;
  return {
    kind: 'search',
    href: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    label: '搜尋遊遊亭 ↗',
    note: `${number}${rarity ? ` · ${rarity}` : ''} · 此版本連結尚未核對；Google 搜尋結果請核對卡號、稀有度及卡圖。`,
  };
}
