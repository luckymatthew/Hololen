import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className="deck-confirm-dialog" aria-labelledby="deck-confirm-title" aria-describedby="deck-confirm-description" onCancel={event => { event.preventDefault(); onCancel(); }}>
    <h2 id="deck-confirm-title">{title}</h2>
    <p id="deck-confirm-description">{description}</p>
    <div><button type="button" autoFocus onClick={onCancel}>取消</button><button type="button" className="danger-button" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
