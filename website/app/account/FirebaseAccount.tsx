import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseConfigured, getFirebase, googleLogin, emailLogin, logout, friendlyError } from '../../lib/firebase/client';
import { listLocalDecks, archiveDeck, importGuestDecks, importDecks, syncNow, syncStatus, backupLocalData, getUserData, saveUserData } from '../../lib/firebase/store';
import { DeckPreview } from './AccountClient';
import ThemeToggle from '../ThemeToggle';
import ConfirmDialog from '../ConfirmDialog';
export default function FirebaseAccount() {
  const [user, setUser] = useState<User | null>(null), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [register, setRegister] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [decks, setDecks] = useState(() => listLocalDecks(true)), [status, setStatus] = useState(syncStatus), [cards, setCards] = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState(false), [deckSearch, setDeckSearch] = useState(''), [deckSort, setDeckSort] = useState('date');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null), [lastDeleted, setLastDeleted] = useState<string | null>(null);
  const targetDeck = decks.find(deck => deck.id === deleteTarget);
  const visibleDecks = decks.filter(deck => Boolean(deck.archived) === showDeleted && deck.name.toLocaleLowerCase().includes(deckSearch.trim().toLocaleLowerCase())).sort((a, b) => deckSort === 'name' ? a.name.localeCompare(b.name, 'zh-Hant') : b.updatedAt - a.updatedAt);
  function changeArchived(id: string, archived: boolean) {
    try { archiveDeck(id, archived); setDeleteTarget(null); setLastDeleted(archived ? id : null); setMessage(archived ? '牌組已刪除，可在「已刪除」還原。' : '牌組已還原。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作失敗，請重試。'); }
  }
  const cardMap = useMemo(() => new Map(cards.map(c => [c.number, c])), [cards]);
  useEffect(() => {
    const refresh = () => { setDecks(listLocalDecks(true)); setStatus(syncStatus); const theme = getUserData('settings')?.theme; if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; };
    window.addEventListener('holo-data-changed', refresh);
    fetch('/cards.json').then(r => r.json()).then(p => setCards(p.cards)).catch(() => setMessage('卡圖預覽暫時無法載入；牌組資料仍然可用。'));
    const stop = firebaseConfigured ? onAuthStateChanged(getFirebase().auth, u => { setUser(u?.isAnonymous ? null : u); refresh(); }) : () => {};
    return () => { stop(); window.removeEventListener('holo-data-changed', refresh); };
  }, []);
  async function attempt(action: () => Promise<unknown>) { setBusy(true); setMessage(''); try { await action(); } catch (e) { setMessage(friendlyError(e)); } finally { setBusy(false); } }
  function downloadBackup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(backupLocalData(), null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `HoloOCG-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="account-page">
    <header className="account-topbar"><a className="brand" href="/"><span className="brand-mark">H</span><span><strong>繁中卡庫・牌組工房</strong><small>HOLOLIVE OCG · ACCOUNT</small></span></a><div className="account-top-actions"><ThemeToggle /><a className="back-builder" href="/">返回組牌器 →</a></div></header>
    <section className="account-hero"><div><p className="eyebrow">YOUR DECKS / ANY DEVICE</p><h1>{user ? `${user.displayName || user.email} 的牌組` : '你的每副牌，都留在身邊。'}</h1><p>離線也能組牌。登入後，在不同裝置繼續編輯。</p></div>{user?.photoURL && <img className="account-avatar" src={user.photoURL} alt="帳號頭像" referrerPolicy="no-referrer" />}</section>
    <p className="sync-banner" role="status">{status}</p>
    {message && <p className="auth-error" role="alert">{message}</p>}
    {lastDeleted && <button type="button" className="undo-deck-delete" onClick={() => changeArchived(lastDeleted, false)}>復原剛才刪除的牌組</button>}
    {!user ? <section className="firebase-login-grid"><div className="login-copy"><h2>同步到你的帳號</h2><p>使用 Google 或電郵登入，在不同裝置繼續組牌。手機 App 的相同帳號同步將於後續版本提供。</p><p>原有網站帳號請先在舊站匯出牌組，再在下方匯入備份。</p>{!firebaseConfigured && <p>雲端服務尚未設定，本機保存及匯出仍可使用。</p>}</div><form className="login-card" onSubmit={(e: FormEvent) => { e.preventDefault(); void attempt(() => emailLogin(email, password, register)); }}>
      <button className="google-signin" type="button" disabled={busy || !firebaseConfigured} onClick={() => void attempt(googleLogin)}>使用 Google 登入</button><span className="auth-divider">或使用電郵</span>
      <label>電郵<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label>密碼<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={register ? 'new-password' : 'current-password'} minLength={8} required /></label>
      <button className="auth-submit" disabled={busy || !firebaseConfigured}>{busy ? '處理中…' : register ? '建立帳號' : '登入'}</button><button type="button" onClick={() => setRegister(!register)}>{register ? '已有帳號？登入' : '使用電郵建立帳號'}</button>
    </form></section> : <div className="account-actions"><button onClick={() => void attempt(() => syncNow(true))} disabled={busy}>立即同步</button><button onClick={() => { importGuestDecks(); setMessage('已匯入此裝置的未登入牌組；原始版本仍然保留。'); }}>匯入此裝置牌組</button><button onClick={() => void attempt(logout)}>登出</button></div>}
    <div className="account-actions account-tools"><a href="/deck">＋ 建立新牌組</a><button onClick={downloadBackup}>匯出完整備份</button><label className="file-button">匯入牌組備份<input type="file" accept="application/json,.json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { importDecks(JSON.parse(await file.text())); setMessage('備份已匯入。'); } catch (error) { setMessage(error instanceof Error ? error.message : '無法讀取備份。'); } e.target.value = ''; }} /></label><a href="/download">下載 Android App →</a></div>
    <div className="saved-deck-filters">
      <div className="deck-edit-modes" role="group" aria-label="牌組列表"><button type="button" aria-pressed={!showDeleted} onClick={() => setShowDeleted(false)}>我的牌組 · {decks.filter(deck => !deck.archived).length}</button><button type="button" aria-pressed={showDeleted} onClick={() => setShowDeleted(true)}>已刪除 · {decks.filter(deck => deck.archived).length}</button></div>
      <label>搜尋牌組<input type="search" value={deckSearch} onChange={event => setDeckSearch(event.target.value)} placeholder="輸入牌組名稱" /></label>
      <label>排序<select value={deckSort} onChange={event => setDeckSort(event.target.value)}><option value="date">最近更新</option><option value="name">牌組名稱</option></select></label>
    </div>
    <div className="saved-deck-grid">{visibleDecks.map(deck => <article className="saved-deck-panel" key={deck.id}><div className="saved-deck-head"><div><p>{deck.archived ? '已刪除 · 可隨時還原' : `UPDATED ${new Date(deck.updatedAt).toLocaleDateString('zh-Hant')}`}</p><h2>{deck.name}</h2></div></div><DeckPreview deck={deck} cardMap={cardMap} /><div className="saved-deck-actions">{!deck.archived && <a href={`/?deck=${encodeURIComponent(deck.id)}`}>載入組牌器</a>}<button type="button" onClick={() => deck.archived ? changeArchived(deck.id, false) : setDeleteTarget(deck.id)}>{deck.archived ? '還原牌組' : '刪除牌組'}</button></div></article>)}</div>
    {!visibleDecks.length && <div className="no-saved-decks"><h2>{deckSearch ? '找不到符合的牌組' : showDeleted ? '沒有已刪除的牌組' : '還沒有保存的牌組'}</h2><p>{deckSearch ? '試試另一個牌組名稱。' : showDeleted ? '刪除後的牌組會放在這裡，方便還原。' : '在組牌器按「保存牌組」，未登入也能保存。'}</p></div>}
    {targetDeck && <ConfirmDialog title={`刪除「${targetDeck.name}」？`} description="牌組會移到「已刪除」，並在登入後同步。你可以隨時還原。" confirmLabel="刪除牌組" onConfirm={() => changeArchived(targetDeck.id, true)} onCancel={() => setDeleteTarget(null)} />}
    {location.pathname === '/settings' && <section className="login-card"><h2>帳號設定</h2><button onClick={() => { saveUserData('settings', { ...getUserData('settings'), theme: localStorage.getItem('hololive-ocg-theme') || 'system' }); setMessage('外觀偏好已保存。'); }}>同步目前外觀偏好</button></section>}
  </main>;
}
