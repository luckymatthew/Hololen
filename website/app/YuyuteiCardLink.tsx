import { yuyuteiCardLink } from '../lib/yuyutei-links.mjs';

export default function YuyuteiCardLink({ cardNumber, imageUrl }: { cardNumber: string; imageUrl: string }) {
  const link = yuyuteiCardLink(cardNumber, imageUrl);
  if (!link) return null;
  const exact = link.kind === 'product';
  return <section className="modal-source" aria-label="遊々亭卡片連結" data-yuyutei-kind={link.kind} style={{ display: 'grid', gap: 6 }}>
    {link.url ? <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`在新分頁開啟遊々亭 ${link.cardNumber} ${exact ? '已核對卡圖商品' : '卡號搜尋'}`} style={{ color: 'var(--cyan-dark)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: '0.2em', width: 'fit-content' }}>
      {exact ? '遊々亭：此卡圖商品' : '遊々亭：搜尋卡號'} <span aria-hidden="true">↗</span>
    </a> : <strong>此卡圖尚未核實遊々亭商品連結</strong>}
    <span>{exact ? `已按目前所選卡圖配對（App 核對日期：${link.artworkAuditDate}）；價格及庫存請以遊々亭為準。` : '尚未確認此卡圖的商品配對；卡號搜尋可能顯示其他版本，請自行核對卡圖。'}</span>
  </section>;
}
