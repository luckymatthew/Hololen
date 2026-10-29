import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useModalMotion } from './ui-motion';

type UpdateCard = {
  kind: 'new-card' | 'new-printing';
  number: string; name: string; jpName: string; rarity: string;
  image: string; printingId: string; products: string[];
  preview?: boolean; releaseDate?: string;
};
type UpdateEntry = {
  id: string; date: string; title: string; summary: string[];
  counts: { newCards: number; newPrintings: number; newPrintingsForExistingCards: number };
  cards: UpdateCard[];
};
type UpdatePayload = { schemaVersion: 1; entries: UpdateEntry[] };

function isUpdatePayload(value: unknown): value is UpdatePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as UpdatePayload;
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.entries)) return false;
  const ids = new Set<string>();
  return payload.entries.every(entry => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || typeof entry.title !== 'string' || !Array.isArray(entry.summary) || !entry.summary.every(line => typeof line === 'string') || !entry.counts || !Array.isArray(entry.cards)) return false;
    ids.add(entry.id);
    if (![entry.counts.newCards, entry.counts.newPrintings, entry.counts.newPrintingsForExistingCards].every(count => Number.isInteger(count) && count >= 0)) return false;
    const printingIds = new Set<string>();
    if (!entry.cards.every(card => {
      if (!card || !['new-card', 'new-printing'].includes(card.kind) || typeof card.number !== 'string' || typeof card.name !== 'string' || typeof card.jpName !== 'string' || typeof card.rarity !== 'string' || typeof card.printingId !== 'string' || !card.printingId || printingIds.has(card.printingId) || !Array.isArray(card.products) || !card.products.every(product => typeof product === 'string')) return false;
      if (card.preview != null && typeof card.preview !== 'boolean') return false;
      if (card.releaseDate != null && (typeof card.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(card.releaseDate))) return false;
      printingIds.add(card.printingId);
      try {
        const image = new URL(card.image);
        return image.origin === 'https://hololive-official-cardgame.com' && image.pathname.startsWith('/wp-content/images/cardlist/') && !image.username && !image.password;
      } catch { return false; }
    })) return false;
    return entry.counts.newPrintings === entry.cards.length && entry.counts.newCards === new Set(entry.cards.filter(card => card.kind === 'new-card').map(card => card.number)).size && entry.counts.newPrintingsForExistingCards === entry.cards.filter(card => card.kind === 'new-printing').length;
  });
}

export default function WebsiteUpdateLog() {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<UpdatePayload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId(), descriptionId = useId();
  const close = useCallback(() => setOpen(false), []);
  const { dialog, requestClose } = useModalMotion(close, open);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    window.addEventListener('popstate', requestClose);
    window.addEventListener('hashchange', requestClose);
    return () => {
      window.removeEventListener('popstate', requestClose);
      window.removeEventListener('hashchange', requestClose);
    };
  }, [open, requestClose]);

  useEffect(() => {
    if (!open || payload) return;
    const controller = new AbortController();
    let current = true;
    fetch('/website-updates.json', { signal: controller.signal, cache: 'no-cache' })
      .then(response => { if (!response.ok) throw new Error('Update log unavailable'); return response.json(); })
      .then(value => {
        if (!isUpdatePayload(value)) throw new Error('Invalid update log');
        if (current) { setPayload(value); setStatus('ready'); }
      })
      .catch(error => { if (current && (error as { name?: string }).name !== 'AbortError') setStatus('error'); });
    return () => { current = false; controller.abort(); };
  }, [open, payload, attempt]);

  function keepFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')].filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
    const first = controls[0], last = controls.at(-1);
    if (!first || !last) { event.preventDefault(); dialog.current?.focus(); return; }
    if (!event.currentTarget.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <footer className="website-update-footer">
    <button ref={trigger} className="website-update-trigger" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { if (!payload) setStatus('loading'); setOpen(true); }}>更新紀錄</button>
    {open && <dialog ref={dialog} className="website-update-dialog t-modal" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1} onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); requestClose(); }} onClose={close} onClick={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <header className="website-update-header">
        <div><h2 id={titleId}>網站更新紀錄</h2></div>
        <button ref={closeButton} type="button" className="website-update-close" onClick={requestClose} aria-label="關閉更新紀錄">×</button>
      </header>
      <div className="website-update-content">
        <p id={descriptionId} className="website-update-description">只顯示已核實的網站更新及新增卡圖；正式效果請以官方日文卡面及最新裁定為準。</p>
        {!payload && status === 'loading' && <p role="status">正在載入更新紀錄…</p>}
        {!payload && status === 'error' && <div role="alert"><p>暫時無法載入更新紀錄。</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1); }}>重新載入</button></div>}
        {payload?.entries.length === 0 && <p>尚未有已核實的更新紀錄。</p>}
        {payload?.entries.map(entry => <article className="website-update-entry" key={entry.id}>
          <time dateTime={entry.date}>{entry.date}</time>
          <h3>{entry.title}</h3>
          <ul>{entry.summary.map((line, index) => <li key={`${entry.id}-${index}`}>{line}</li>)}</ul>
          <p className="website-update-counts">新增卡號 <b>{entry.counts.newCards}</b> 張 · 新增卡圖／版本 <b>{entry.counts.newPrintings}</b> 款（其中 <b>{entry.counts.newPrintingsForExistingCards}</b> 款屬既有卡號）</p>
          <div className="website-update-table-scroll" tabIndex={0} role="region" aria-label={`${entry.date} 新增卡圖表，可左右捲動`}>
            <table className="website-update-table">
              <caption>{entry.date} 新增卡圖明細</caption>
              <thead><tr><th scope="col">分類</th><th scope="col">卡圖</th><th scope="col">卡號／卡名</th><th scope="col">稀有度</th><th scope="col">收錄商品</th></tr></thead>
              <tbody>{entry.cards.map(card => <tr key={card.printingId}>
                <td><span className={`website-update-kind ${card.kind}`}>{card.kind === 'new-card' ? '新卡號' : '既有卡新卡圖／版本'}</span>{card.preview && card.releaseDate && <small>先行公開<br />{card.releaseDate} 發售</small>}</td>
                <td><a href={card.image} target="_blank" rel="noopener noreferrer" aria-label={`查看 ${card.number} ${card.name} ${card.rarity} 原始卡圖`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Firebase SPA has no Next image optimizer; official remote PNGs are intentionally lazy. */}
                  <img src={card.image} alt={`${card.number} ${card.name} ${card.rarity} 卡圖`} width={56} height={78} loading="lazy" decoding="async" />
                </a></td>
                <td><code>{card.number}</code><strong>{card.name}</strong>{card.jpName !== card.name && <small>{card.jpName}</small>}</td>
                <td>{card.rarity || '—'}</td>
                <td>{card.products.length ? card.products.join('／') : '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </article>)}
      </div>
      <div className="website-update-actions"><button type="button" onClick={requestClose}>關閉</button></div>
    </dialog>}
  </footer>;
}
