export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.2.7';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const installZipUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/Hololens-${encodeURIComponent(tag.replace(/^v/, ''))}-Install.zip`;
export const APK_URL = apkUrl(STABLE_TAG);
// Verified public release: usable even when GitHub metadata is unavailable.
export const STABLE_METADATA = {"version": "v1.2.7", "size": 614779470, "date": "2026-10-03T05:49:31Z", "preview": false, "name": "Hololens 1.2.7 - Card catalog and scanner update", "downloads": 0, "notes": "更新卡庫、卡圖與掃描索引：1,394 張卡、2,981 個版本，新增 75 個 PR 版本、2 張普通 Cheer 及 81 個已核實掃描版本。修正 hEB01 的 S 卡圖參照，保留舊收藏／牌組相容處理。沿用 1.2.6 對戰引擎及原簽署憑證，可直接安裝更新。此輪未做真機安裝、鏡頭、Google 登入、即時多人對戰及跨裝置同步重測；完整驗證結果與 SHA-256 請見發佈資訊。"};
export function releaseMetadata(payload) {
  if (!payload || payload.draft || payload.prerelease || !/^v\d+\.\d+\.\d+$/.test(payload.tag_name) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const apk = payload.assets.find(asset => asset.name === APK_FILENAME && asset.state === 'uploaded');
  if (!apk || !Number.isFinite(apk.size) || apk.size <= 0) throw new Error('正式版本尚未附上 APK');
  const parts = payload.tag_name.slice(1).split('.').map(Number), baseline = STABLE_TAG.slice(1).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (parts[i] < baseline[i]) throw new Error('版本已過期'); if (parts[i] > baseline[i]) break; }
  return { version: payload.tag_name, name: String(payload.name || ''), date: payload.published_at, size: apk.size, downloads: Number(apk.download_count || 0), notes: String(payload.body || '').slice(0, 12000), preview: false };
}
