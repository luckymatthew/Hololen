import { useState, type ReactNode } from 'react';

const colorIcons: Record<string, [code: string, label: string]> = {
  白: ['white', '白'], 綠: ['green', '綠'], 紅: ['red', '紅'], 藍: ['blue', '藍'], 紫: ['purple', '紫'], 黃: ['yellow', '黃'], 無色: ['null', '無色'],
};
const iconRoot = 'https://hololive-official-cardgame.com/wp-content/images/texticon';

function CardSymbol({ value, kind }: { value: string; kind: 'type' | 'arts' }) {
  const [failed, setFailed] = useState(false);
  const icon = colorIcons[value];
  if (!icon || failed) return <span className="card-reader-symbol-text">{value}</span>;
  const [code, label] = icon;
  // The official icons are served alongside the card artwork. Keep the label if an icon fails to load.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={`card-reader-symbol card-reader-symbol-${kind}`} src={`${iconRoot}/${kind}_${code}.png`} alt={label} title={label} width={24} height={24} onError={() => setFailed(true)} />;
}

export function CardSymbols({ values, kind = 'arts' }: { values: string[]; kind?: 'type' | 'arts' }) {
  const colors = values.flatMap(value => value === 'blue_red' ? ['藍', '紅'] : value === 'white_green' ? ['白', '綠'] : [value]);
  if (!colors.length) return null;
  return <span className="card-reader-symbols">{colors.map((value, index) => <CardSymbol key={`${value}-${index}`} value={value} kind={kind} />)}</span>;
}

export function CardFact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="card-reader-fact"><dt className="card-reader-pill">{label}</dt><dd>{children}</dd></div>;
}

export function CardEffect({ label, title, children, kind }: { label: string; title?: ReactNode; children?: ReactNode; kind?: 'art' | 'extra' | 'skill' | 'sp' | 'keyword' }) {
  return <article className="card-reader-effect" data-effect-kind={kind}>
    <span className="card-reader-pill">{label}</span>
    <div className="card-reader-effect-body">
      {title && <h4>{title}</h4>}
      {children && <p>{children}</p>}
    </div>
  </article>;
}
