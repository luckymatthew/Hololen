export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.2.8';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const installZipUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/Hololens-${encodeURIComponent(tag.replace(/^v/, ''))}-Install.zip`;
export const FEATURED_TAG = 'v1.3.10';
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
// Public preview and every asset independently streamed and verified on 2026-11-01.
export const FEATURED_METADATA = {
  "version": "v1.3.10",
  "size": 628873695,
  "date": "2026-11-01T07:07:30Z",
  "preview": true,
  "name": "Hololens 1.3.10 RS1 diagnostic preview - battle response shape",
  "downloads": 0,
  "sha256": "c15adf14732a6150712574d2bc17a00a40089c4e497b3f51e3e95fd6b2b2c8c1",
  "installZipAvailable": true,
  "notes": "Hololens 1.3.10 RS1 diagnostic preview / build41\n\nAdds a bounded response-shape diagnostic to distinguish different completed responses that contain no accepted final action text. An RS1 line reports fixed structure codes and capped counts only. It does not retain raw replies, tokens, account identifiers, game/card/deck content or unknown field values, and it does not upload telemetry. Request construction, final-answer selection and legal-action validation are unchanged from 1.3.9. This is a diagnostic release, not a confirmed battle fix.\n\nAfter updating, manually try one battle and provide only the RS1 line shown in the error plus the selected model's display name. Do not share credentials, callback URLs, account details, raw replies or game content. Do not repeatedly authorize the account merely to collect this code. No automatic live attempt is performed.\n\nOriginal package/signing identity, exact home layout and character size, artwork, saved-data code, catalog/translation update channel and existing engine are preserved. The held 1.4.0 new-card engine is not included. Build41 deliberately avoids its reserved build40; a future engine release requires a newer version code.\n\nVerification: 385/392 host tests passed with the same seven documented Windows directory-sync failures, no new failures or skips. ChatGPT 160/160, home viewport 7/7, offline AI JavaScript 10/10 and 104 native ICU regex checks passed. Synthetic response fixtures separate six structural failure forms without changing accepted choices or request bytes. Packaged-engine mocked decisions cover rollback, exactly-once application, stale/cancel rejection and resume. Lint: 0 errors/40 unchanged warnings. Official signature, manifest/resource parsers, ZIP alignment/CRC and DEX checks passed. Android instrumentation compiled but did not run.\n\nThe exact phone response, underlying battle cause, real-device installation/runtime and successful ChatGPT battle remain unverified. Camera and dual-device PvP were not tested. Unchanged native dependencies retain the prior documented 16KiB runtime-validation caveat. No live OAuth, subscription inference, new credentials or device installation was performed during verification.\n\nInstallation: open HoloLens.apk, or extract Hololens-1.3.10-Install.zip and open its APK. Do not install or rename the ZIP itself. Use an in-place update with the original signer; do not uninstall or clear app data. Stable 1.2.8 and all previous releases remain available.\n"
};
const FEATURED_INSTALL_ZIP = {"size": 628876629, "sha256": "9f4a162a29bd1270387356e8982640b8999e585f1f8ba1be793e896ee32fce7d"};
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
