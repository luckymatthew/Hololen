import { useEffect, useState } from 'react';
import { RELEASES_URL, RELEASE_REPOSITORY, STABLE_METADATA, apkUrl, releaseUrl, releaseMetadata } from '../../lib/releases.mjs';
import ThemeToggle from '../ThemeToggle';
export default function DownloadClient() {
  const [metadata, setMetadata] = useState<ReturnType<typeof releaseMetadata>>(STABLE_METADATA), [status, setStatus] = useState('正在查詢最新版本…');
  useEffect(() => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    // Retire preview caches; metadata refresh never blocks a public APK link.
    try { localStorage.removeItem('holo-apk-release-v2'); } catch {}
    fetch(`https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`, { signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } })
      .then(async response => { if (!response.ok) throw new Error(String(response.status)); return releaseMetadata(await response.json()); })
      .then(value => { setMetadata(value); setStatus(''); })
      .catch(() => setStatus(`目前提供已發佈的 ${STABLE_METADATA.version.slice(1)} 正式版，可直接下載。`))
      .finally(() => clearTimeout(timer));
    return () => { clearTimeout(timer); controller.abort(); };
  }, []);
  return <main className="account-page download-page"><header className="account-topbar"><a className="brand" href="/"><span className="brand-mark">H</span><span><strong>繁中卡庫・牌組工房</strong><small>HOLOLIVE OCG</small></span></a><ThemeToggle /></header><section className="download-card"><div className="download-copy"><p className="eyebrow">ANDROID · HOLOLIVE OCG COMPANION</p><h1>HoloLens</h1><p className="download-lead">卡庫、掃卡、牌組。<br />隨身帶走你的 Hololive OCG 工房。</p><div className="download-badges"><span>Android</span><span>ARM64</span><span>免費下載</span></div><p>Hololens 陪你隨身查卡、掃描與整理牌組。</p><a className="apk-button" href={apkUrl(metadata.version)}>↓ 下載 Android APK（正式版）</a><p className="download-status" role="status">{status || '從 GitHub Releases 安全下載，不需要 GitHub 帳號。'}</p><div className="download-links"><a href="https://github.com/luckymatthew/Hololen/releases/download/v1.2.3/Hololens-1.2.3-Install.zip">安裝 ZIP</a><a href={releaseUrl(metadata.version)} target="_blank" rel="noreferrer">發佈資訊 ↗</a><a href={RELEASES_URL} target="_blank" rel="noreferrer">歷史版本 ↗</a><a href="/">返回卡庫 →</a></div></div><aside className="release-details"><p className="eyebrow">正式版本</p><h2>{metadata.version}</h2><dl><div><dt>更新日期</dt><dd>{metadata?.date ? new Date(metadata.date).toLocaleDateString('zh-Hant') : '以發佈頁為準'}</dd></div><div><dt>檔案大小</dt><dd>{metadata ? `${(metadata.size / 1024 / 1024).toFixed(1)} MiB` : '待確認'}</dd></div><div><dt>最低版本</dt><dd>Android 15</dd></div><div><dt>檔案名稱</dt><dd>HoloLens.apk</dd></div></dl><p>使用相同簽章直接安裝更新，可保留現有牌組與對局；毋須先解除安裝。</p></aside></section>{metadata?.notes && <section className="release-notes"><h2>這次更新</h2><p>{metadata.notes.slice(0, 600).replace(/\*\*|`/g, "")}</p><a href={releaseUrl(metadata.version)} target="_blank" rel="noreferrer">完整更新說明 ↗</a></section>}</main>;
}

