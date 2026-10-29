import { useModalMotion } from './ui-motion';

export default function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: {
  title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void;
}) {
  const { dialog, requestClose } = useModalMotion(onCancel);
  return <dialog ref={dialog} className="deck-confirm-dialog t-modal" aria-labelledby="deck-confirm-title" aria-describedby="deck-confirm-description" onCancel={event => { event.preventDefault(); requestClose(); }}>
    <h2 id="deck-confirm-title">{title}</h2>
    <p id="deck-confirm-description">{description}</p>
    <div><button type="button" autoFocus onClick={requestClose}>取消</button><button type="button" className="danger-button" onClick={onConfirm}>{confirmLabel}</button></div>
  </dialog>;
}
