import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RELEASES_URL, FEATURED_RELEASE_API, FEATURED_METADATA, STABLE_TAG, STABLE_APK_URL, apkUrl, installZipUrl, releaseUrl, featuredReleaseMetadata } from '../../lib/releases.mjs';
import StudioHeader from '../StudioHeader';
export default function DownloadClient() {
  const [metadata, setMetadata] = useState<ReturnType<typeof featuredReleaseMetadata>>(FEATURED_METADATA), [status, setStatus] = useState('正在查詢最新版本…');
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    // Retire preview caches; metadata refresh never blocks a public APK link.
    try { localStorage.removeItem('holo-apk-release-v2'); } catch {}
    fetch(FEATURED_RELEASE_API, { signal: controller.signal, cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/vnd.github+json' } })
      .then(async response => { if (!response.ok) throw new Error(String(response.status)); return featuredReleaseMetadata(await response.json()); })
      .then(value => { if (active && !controller.signal.aborted) { setMetadata(value); setStatus(''); } })
      .catch(() => { if (active) setStatus(`目前提供已發佈的 ${FEATURED_METADATA.version.slice(1)} 預覽版，可直接下載。`); })
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, []);
  return <main className="account-page download-page"><StudioHeader current="download" /><section className="download-card"><div className="download-copy"><h1>HoloLens</h1><p className="download-lead">卡庫、掃卡、牌組。<br />隨身帶走你的 Hololive OCG 工房。</p><div className="download-badges"><span>Android</span><span>ARM64</span><span>免費下載</span><span>{metadata.preview ? '預覽版' : '正式版'}</span></div><p>Hololens 陪你隨身查卡、掃描與整理牌組。</p><a className="apk-button" href={apkUrl(metadata.version)}>↓ 下載 Android APK（{metadata.preview ? '預覽版' : '正式版'}）</a><p className="download-status" role="status">{status || '從 GitHub Releases 安全下載，不需要 GitHub 帳號。'}</p><div className="download-links">{metadata.preview && <a href={STABLE_APK_URL}>正式版 {STABLE_TAG.slice(1)}</a>}{metadata.installZipAvailable && <a href={installZipUrl(metadata.version)}>安裝 ZIP</a>}<a href={releaseUrl(metadata.version)} target="_blank" rel="noreferrer">發佈資訊 ↗</a><a href={RELEASES_URL} target="_blank" rel="noreferrer">歷史版本 ↗</a><Link href="/">返回卡庫 →</Link></div></div><aside className="release-details"><p className="eyebrow">{metadata.preview ? '預覽版本' : '正式版本'}</p><h2>{metadata.version}</h2><dl><div><dt>更新日期</dt><dd>{metadata?.date ? new Date(metadata.date).toLocaleDateString('zh-Hant') : '以發佈頁為準'}</dd></div><div><dt>檔案大小</dt><dd>{metadata ? `${(metadata.size / 1024 / 1024).toFixed(1)} MiB` : '待確認'}</dd></div><div><dt>最低版本</dt><dd>Android 15</dd></div><div><dt>檔案名稱</dt><dd>HoloLens.apk</dd></div></dl>{metadata.preview && <p role="note">ChatGPT 採用單次交換連線並顯示連線階段與錯誤，包括安全 HTTP 狀態及網絡分類。實際手機登入仍未驗證，授權成功不代表已完成連線。此版恢復原有首頁版面及 holomem 立繪大小，只交換掃描／對戰按鈕並加入相機圖示。包含 Android 啟動修正，仍待真機啟動驗證及版面驗證。請直接更新現有 App，保留資料；請勿解除安裝或清除資料。</p>}{metadata.preview && <p role="note">ChatGPT 官方登入及帳戶使用仍待 Android 真機驗證。此版未啟用 hSD20／hSD21 新增 22 張卡的對戰效果；原有 AI 可繼續使用。</p>}<p>沿用原有套件及簽署憑證，更新前建議先備份牌組。此輪未做真機安裝、鏡頭、Google 登入、跨裝置同步或雙裝置 PvP 重測。</p><p>卡庫更新不會安裝新卡效程式；未支援效果的新卡可查看及組牌，但不能自動進行單人／PvP 對戰。</p>{metadata.sha256 && <p className="download-integrity">APK SHA-256<br /><code style={{ overflowWrap: 'anywhere' }}>{metadata.sha256}</code></p>}</aside></section>{metadata?.notes && <section className="release-notes"><h2>這次更新</h2><p>{metadata.notes.slice(0, 600).replace(/\*\*|`/g, "")}</p><a href={releaseUrl(metadata.version)} target="_blank" rel="noreferrer">完整更新說明 ↗</a></section>}</main>;
}

