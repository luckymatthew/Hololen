import { glossary } from '@/lib/card-terminology.mjs';

export default function TerminologyNote() {
  return <details className="terminology-note">
    <summary>用語對照</summary>
    <dl>{glossary.map(([original, chinese]) => <div key={original}><dt>{original}</dt><dd>{chinese}</dd></div>)}</dl>
  </details>;
}
