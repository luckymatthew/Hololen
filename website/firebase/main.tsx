import { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { startSync, currentOwner } from '../lib/firebase/store';
import { firebaseConfigured, getFirebase } from '../lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import '../app/globals.css';
import '../app/studio.css';
import '../app/firebase.css';
const Home = lazy(() => import('../app/page'));
const Simulator = lazy(() => import('../app/simulator/SimulatorClient'));
const Account = lazy(() => import('../app/account/FirebaseAccount'));
const Download = lazy(() => import('../app/download/DownloadClient'));
try { const theme = localStorage.getItem('hololive-ocg-theme'); if (theme) document.documentElement.dataset.theme = theme; } catch {}
startSync();
function Shell() {
  const [updated, setUpdated] = useState(false);
  const [owner, setOwner] = useState(currentOwner());
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  useEffect(() => {
    const changed = () => setOwner(currentOwner());
    window.addEventListener('holo-owner-changed', changed);
    const stop = firebaseConfigured ? onAuthStateChanged(getFirebase().auth, () => { changed(); setAuthReady(true); }) : () => {};
    return () => { stop(); window.removeEventListener('holo-owner-changed', changed); };
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    // Never reload during a match or an edit. New releases activate on the user's
    // next complete navigation / after all old tabs close.
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      void registration.update();
      registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => {
        if (registration.waiting && navigator.serviceWorker.controller) setUpdated(true);
      }));
    }).catch(() => {});
  }, []);
  const path = location.pathname.replace(/\/$/, '') || '/';
  const page = ['/simulator', '/pvp', '/play'].includes(path) ? <Simulator /> : ['/account', '/profile', '/settings'].includes(path) ? <Account /> : path === '/download' ? <Download /> : ['/', '/cards', '/deck'].includes(path) ? authReady ? <Home key={owner || 'guest'} /> : <main className="account-loading">正在載入本機牌組…</main> : <main className="account-page"><h1>找不到這個頁面</h1><a href="/">返回卡庫</a></main>;
  return <>{updated && <div className="sync-banner" role="status">新版本已準備好；完成對局及保存牌組後，關閉本站所有分頁再重新開啟。</div>}<Suspense fallback={<main className="account-loading">正在載入…</main>}>{page}</Suspense></>;
}
createRoot(document.getElementById('root')!).render(<Shell />);
