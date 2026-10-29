"use client";

import { firebaseBuild } from '@/lib/firebase/client';
import Link from 'next/link';
import ThemeToggle from './ThemeToggle';
import StudioIcon from './StudioIcon';

type Section = 'library' | 'deck' | 'simulator' | 'account' | 'download';
export default function StudioHeader({ current, draftCount, onWorkspace }: {
  current: Section;
  draftCount?: number;
  onWorkspace?: (workspace: 'library' | 'deck') => void;
}) {
  const workspaceItem = (workspace: 'library' | 'deck', label: string) => onWorkspace
    ? <button type="button" aria-current={current === workspace ? 'page' : undefined} onClick={() => onWorkspace(workspace)}>{label}{workspace === 'deck' && draftCount != null && <>{' '}<span>{draftCount}</span></>}</button>
    : <Link href={workspace === 'library' ? '/' : '/deck'} aria-current={current === workspace ? 'page' : undefined}>{label}</Link>;
  return <header className="topbar library-topbar studio-header">
    <Link className="brand" href="/" aria-label="Hololive OCG 卡庫首頁">
      <span className="brand-mark" aria-hidden="true"><StudioIcon name="cards" /></span>
      <span><strong>HOLOLIVE <em>OCG</em></strong><small>繁中卡庫・牌組工房</small></span>
    </Link>
    <nav className="studio-navigation" aria-label="主要功能">
      {workspaceItem('library', '卡片圖鑑')}
      {workspaceItem('deck', '牌組工房')}
      <Link href="/simulator" aria-current={current === 'simulator' ? 'page' : undefined}>對戰模擬器</Link>
      {firebaseBuild && <Link href="/download" aria-current={current === 'download' ? 'page' : undefined}>App 下載</Link>}
    </nav>
    <div className="topbar-actions"><ThemeToggle /><Link className="account-button" aria-current={current === 'account' ? 'page' : undefined} href="/account">我的牌組</Link></div>
  </header>;
}
