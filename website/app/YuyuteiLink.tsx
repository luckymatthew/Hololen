import { yuyuteiLink } from '@/lib/yuyutei-links.mjs';
import './yuyutei.css';

type Printing = { id: string; rarity: string };

export default function YuyuteiLink({ card, printing }: { card: { number: string; variants?: Printing[] }; printing?: Printing }) {
  const link = yuyuteiLink(card, printing);
  return (
    <div className="retailer-action" data-link-kind={link.kind}>
      {link.href ? (
        <a className="retailer-link" href={link.href} target="_blank" rel="noopener noreferrer" title={link.note} aria-label={`${link.label} · ${link.note}`}>
          {link.label}
        </a>
      ) : <span className="retailer-unavailable">{link.label}</span>}
      <small>{link.note}</small>
    </div>
  );
}
