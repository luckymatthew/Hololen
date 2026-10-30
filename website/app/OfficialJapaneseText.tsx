import { officialCardSourceFields, officialSourceFieldLabel } from '../lib/official-card-translations.mjs';

export default function OfficialJapaneseText({ card }: { card: Parameters<typeof officialCardSourceFields>[0] }) {
  return <details className="terminology-note official-japanese-source">
    <summary>官方日文原文（正式效果基準）</summary>
    {officialCardSourceFields(card).map(field => <p key={field.path}><strong>{officialSourceFieldLabel(field.path)}</strong><br />{field.original}</p>)}
    {card.tags?.length > 0 && <p><strong>原始特徵</strong><br />{card.tags.join(' / ')}</p>}
  </details>;
}
