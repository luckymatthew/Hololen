export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.2.8';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const installZipUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/Hololens-${encodeURIComponent(tag.replace(/^v/, ''))}-Install.zip`;
export const FEATURED_TAG = 'v1.3.6';
export const FEATURED_RELEASE_API = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/tags/${FEATURED_TAG}`;
export const STABLE_APK_URL = apkUrl(STABLE_TAG);
export const APK_URL = apkUrl(FEATURED_TAG);
// Public release and all four assets verified anonymously on 2026-10-29.
// Keep this pinned fallback usable even if GitHub metadata is unavailable.
export const STABLE_METADATA = {
  "version": "v1.2.8",
  "size": 615463775,
  "date": "2026-10-29T18:39:19Z",
  "preview": false,
  "name": "Hololens 1.2.8 — 手動卡庫更新",
  "downloads": 0,
  "sha256": "e608ddf50c6eb746e2023a87843e52ef1f01e9a1c6bf6390255f1cc8e16b0a08",
  "installZipAvailable": true,
  "notes": "Hololens 1.2.8 新增從網站更新卡庫的功能，沿用原有套件及簽署憑證。\n\n- 開啟 App 後在背景檢查網站卡庫版本；有新版會提示，按「更新」才下載卡牌資料及所需卡圖，離線仍可使用原卡庫。\n- 下載完成並驗證後可安全重新載入；對局期間保留現有卡庫。更新失敗或中斷時保留原資料，牌組、收藏及設定不會被卡庫更新覆寫。\n- 掃描器同步更新後的卡號、日文辨識資料及候選卡圖；下載卡表不會重新訓練視覺辨識索引。\n- 資料更新不會安裝新卡效程式。未支援效果的新卡可查看及組牌，但不能自動進行單人／PvP 對戰。\n\n下載 `HoloLens.apk`，或下載包含同一 APK 的 `Hololens-1.2.8-Install.zip`。Android 15 或以上、ARM64；版本代碼 27。沿用原簽署憑證及 package，可更新現有 Hololens，毋須先解除安裝。\n\n驗證：原有 253 項 Linux JVM／原生回歸測試通過。Windows 主機測試有已確認的目錄通道同步限制，並非全數通過。Windows release APK 建置、簽署及內容檢查通過；完整 release lint 為 0 errors、39 warnings。5,856 個來源資產及 29 個 OCR 模型通過打包一致性檢查，APK 簽署與 16 KiB 對齊已核實。\n\n此輪未在實體手機安裝；實體鏡頭、Google 登入、跨裝置同步及雙裝置 PvP 未做真機重測。自動測試不代表所有卡效或對戰組合均已完整驗證。\n\nAPK SHA-256：`e608ddf50c6eb746e2023a87843e52ef1f01e9a1c6bf6390255f1cc8e16b0a08`。請以 `SHA256SUMS.txt` 核對完整下載檔案。\n\n[上一版 v1.2.7](https://github.com/luckymatthew/Hololen/releases/tag/v1.2.7)及其下載檔案繼續保留。\n"
};
// Public preview and every asset independently streamed and verified on 2026-10-31.
export const FEATURED_METADATA = {
  "version": "v1.3.6",
  "size": 628857311,
  "date": "2026-10-31T05:52:36Z",
  "preview": true,
  "name": "Hololens 1.3.6 diagnostic preview - ChatGPT token transport and safe errors",
  "downloads": 0,
  "sha256": "f8cafd0142d01de3090f1c8603918ba40cec29ad4297299a39d627bbd3f57219",
  "installZipAvailable": true,
  "notes": "Improves the diagnostic path for the reported ChatGPT authorization-code exchange failure. Token traffic now uses one-shot OkHttp requests with redirects and automatic connection retry disabled. Failures expose only safe HTTP status/allowlisted OAuth codes or fixed DNS/TLS/connect/timeout categories. After a valid first callback fails, only its issued public client ID is retained in memory for an explicit fresh PKCE/state/nonce retry; authorization codes are never replayed. Original offline AI remains the default and usable without sign-in.\n\nThis is a diagnostic preview, not a confirmed phone-login fix. Complete historical Leafweave v114 source was compared with the actual compiled Hololens request paths: the official token endpoint and six form fields already match. The user's real phone exchange failure remains unidentified. A browser consent email or callback page does not prove token exchange, identity verification or storage succeeded. No live OAuth grant, client registration, account token reuse, model request or inference was performed during this work.\n\nPreserves the restored original home layout and holomem standing-art size, Scan/Battle position swap and camera icon, startup fix, card/translation updates, website-aligned filtering, official artwork choices, Yuyutei links and saved user data. New hSD20/hSD21 battle effects remain unsupported; the separate 1.4.0 engine candidate is not included.\n\nInstall this original-signer APK over the existing app. Do not uninstall or clear app data. If sign-in still fails, report only the displayed stage and sanitized error/status. Never share callback URLs, authorization codes, tokens, credentials or unfiltered logs. Model and AI-provider selection stay explicit after a verified connection.\n\nValidation: 95 ChatGPT tests and seven home viewport tests passed. Native/Robolectric suite: 320/327 passed, with seven unchanged documented Windows directory-channel/fsync failures and zero new failures. JavaScript: 690 passed, three existing fixture/device skips, no failures. An additional offline comparison passed 142 assertions across ten scenarios on released 1.3.5 and held 1.3.6, plus two source/class fingerprint guards. Historical Python data/scanner suites (24 cases) could not start because an immutable external fixture is absent; the Linux signing harness retains the same eight Windows-incompatible cases reproduced on unchanged 1.3.5. These are not all-green full-suite results.\n\nRelease assembly, original v3 signer, APK contents and 16 KiB alignment verified. Lint: zero errors / 40 warnings. All 5,943 assets and six native libraries are unchanged. Android instrumentation was compiled, not executed. Actual Android token exchange, account eligibility, camera, QuickJS JNI and dual-device PvP remain unverified. Stable 1.2.8 and earlier previews remain available."
};
const FEATURED_INSTALL_ZIP = {"size": 628860119, "sha256": "202d1e7da105358bbbc4ff0b26c1f6c37f8aaa26d84e813cdf4b52f0de4e5c4e"};
const VERIFIED_INSTALL_ZIP = { size: 615465884, sha256: '894c4acd0fa06956611dec841f34b3e2286570a1e98593c177070f21b87d8950' };
const uploadedAsset = (assets, name) => assets.find(asset => asset?.name === name && asset.state === 'uploaded' && Number.isSafeInteger(asset.size) && asset.size > 0);
const sha256 = digest => typeof digest === 'string' && /^sha256:[a-f0-9]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : '';
export function releaseMetadata(payload) {
  if (!payload || payload.draft || payload.prerelease || !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(payload.tag_name) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const parts = payload.tag_name.slice(1).split('.').map(Number), baseline = STABLE_TAG.slice(1).split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('版本格式無效');
  for (let i = 0; i < 3; i++) { if (parts[i] < baseline[i]) throw new Error('版本已過期'); if (parts[i] > baseline[i]) break; }
  const apk = uploadedAsset(payload.assets, APK_FILENAME);
  if (!apk) throw new Error('正式版本尚未附上 APK');
  const pinned = payload.tag_name === STABLE_TAG, digest = sha256(apk.digest);
  if (pinned && (apk.size !== STABLE_METADATA.size || (apk.digest != null && digest !== STABLE_METADATA.sha256))) throw new Error('APK 與已核實版本不符');
  if (typeof payload.published_at !== 'string' || !Number.isFinite(Date.parse(payload.published_at))) throw new Error('發佈日期無效');
  const zip = uploadedAsset(payload.assets, `Hololens-${payload.tag_name.slice(1)}-Install.zip`);
  const installZipAvailable = Boolean(zip && (!pinned || (zip.size === VERIFIED_INSTALL_ZIP.size && (zip.digest == null || sha256(zip.digest) === VERIFIED_INSTALL_ZIP.sha256))));
  return { version: payload.tag_name, name: String(payload.name || ''), date: payload.published_at, size: apk.size, downloads: Number(apk.download_count || 0), sha256: pinned ? STABLE_METADATA.sha256 : digest, installZipAvailable, notes: String(payload.body || '').slice(0, 12000), preview: false };
}

// Deliberately opt in only to the exact published preview featured by this site.
// The stable parser keeps rejecting arbitrary prereleases and old versions.
export function featuredReleaseMetadata(payload) {
  if (!payload || payload.tag_name !== FEATURED_TAG || payload.prerelease !== true) throw new Error('Featured preview mismatch');
  const value = releaseMetadata({ ...payload, prerelease: false });
  const apk = uploadedAsset(payload.assets, APK_FILENAME);
  if (value.size !== FEATURED_METADATA.size || (apk.digest != null && sha256(apk.digest) !== FEATURED_METADATA.sha256)) throw new Error('Featured APK integrity mismatch');
  const zip = uploadedAsset(payload.assets, `Hololens-${FEATURED_TAG.slice(1)}-Install.zip`);
  const installZipAvailable = Boolean(zip && zip.size === FEATURED_INSTALL_ZIP.size && (zip.digest == null || sha256(zip.digest) === FEATURED_INSTALL_ZIP.sha256));
  return { ...value, sha256: FEATURED_METADATA.sha256, preview: true, installZipAvailable };
}
