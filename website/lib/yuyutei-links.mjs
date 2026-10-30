import productData from './yuyutei-card-products.json' with { type: 'json' };

const officialOrigin = 'https://hololive-official-cardgame.com';
const cardNumberPattern = /^h(?:(?:BP|SD|EB|BD|YS|Y)\d{2}|PR)-\d{3}$/i;

export function canonicalCardNumber(value) {
  if (typeof value !== 'string' || !cardNumberPattern.test(value.trim())) return '';
  return `h${value.trim().slice(1).toUpperCase()}`;
}

// Artwork identity is never inferred from rarity, list order or card number alone.
export function officialArtworkIdentity(value) {
  if (typeof value !== 'string') return '';
  try {
    const url = new URL(value);
    if (url.origin !== officialOrigin || url.username || url.password || !url.pathname.startsWith('/wp-content/images/cardlist/')) return '';
    return url.pathname;
  } catch { return ''; }
}

export function yuyuteiCardLink(cardNumber, imageUrl) {
  const number = canonicalCardNumber(cardNumber), artwork = officialArtworkIdentity(imageUrl);
  if (!number) return null;
  const product = productData.products.find(row => canonicalCardNumber(row.cardNumber) === number && officialArtworkIdentity(row.officialImageUrl) === artwork && artwork);
  if (product) {
    try {
      const url = new URL(product.productUrl);
      if (url.origin === 'https://yuyu-tei.jp' && !url.username && !url.password && !url.search && !url.hash && /^\/sell\/hocg\/card\/h[a-z]+\d{2}\/\d+$/.test(url.pathname)) {
        return { kind: 'product', url: url.href, cardNumber: number, artworkAuditDate: productData.artworkAuditDate };
      }
    } catch { /* An invalid row must never break card details or become a guessed product. */ }
  }
  const searchUrl = yuyuteiSearchUrl(number);
  return { kind: searchUrl ? 'search' : 'unmatched', url: searchUrl, cardNumber: number, artworkAuditDate: '' };
}

// This is the app's verified native search form, not an exact-printing product match.
export function yuyuteiSearchUrl(cardNumber) {
  const number = canonicalCardNumber(cardNumber);
  if (!number || productData.search.url !== 'https://yuyu-tei.jp/sell/hocg/s/search' || productData.search.parameter !== 'search_word') return '';
  const url = new URL(productData.search.url);
  url.searchParams.set(productData.search.parameter, number);
  return url.href;
}
