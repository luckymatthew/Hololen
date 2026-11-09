import { yuyuteiCardLink } from '../lib/yuyutei-links.mjs';

export default function YuyuteiCardLink({ cardNumber, imageUrl }: { cardNumber: string; imageUrl: string }) {
  const link = yuyuteiCardLink(cardNumber, imageUrl);
  if (!link) return null;
  const exact = link.kind === 'product';
  return <section className="modal-source" aria-label="遊々亭卡片連結" data-yuyutei-kind={link.kind} style={{ display: 'grid', gap: 6 }}>
    {link.url ? <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`在新分頁開啟遊々亭 ${link.cardNumber} ${exact ? '已核對卡圖商品' : '卡號搜尋'}`} style={{ color: 'var(--cyan-dark)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '0.2em', width: 'fit-content' }}>
      {exact ? '遊々亭：此卡圖商品' : '遊々亭：搜尋卡號'} <span aria-hidden="true">↗</span>
    </a> : <strong>遊々亭：未確認此卡圖</strong>}
    {link.kind === 'search' && <span>請核對卡圖版本。</span>}
  </section>;
}
