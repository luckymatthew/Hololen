export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.0.0';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const APK_URL = apkUrl(STABLE_TAG);
// Verified public release: usable even when GitHub metadata is unavailable.
export const STABLE_METADATA = { version: STABLE_TAG, size: 577082256, date: '2026-09-09T16:25:00Z', preview: false, name: 'Hololens 1.0.0 正式版', downloads: 0, notes: 'PvP 接入新網站，更新電郵／密碼登入及卡組同步。Android 15 或以上、ARM64。完整真機跨平台對局及端到端雙向同步仍待驗證。' };
export function releaseMetadata(payload) {
  if (!payload || payload.draft || payload.prerelease || !/^v\d+\.\d+\.\d+$/.test(payload.tag_name) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const apk = payload.assets.find(asset => asset.name === APK_FILENAME && asset.state === 'uploaded');
  if (!apk || !Number.isFinite(apk.size) || apk.size <= 0) throw new Error('正式版本尚未附上 APK');
  const parts = payload.tag_name.slice(1).split('.').map(Number), baseline = STABLE_TAG.slice(1).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (parts[i] < baseline[i]) throw new Error('版本已過期'); if (parts[i] > baseline[i]) break; }
  return { version: payload.tag_name, name: String(payload.name || ''), date: payload.published_at, size: apk.size, downloads: Number(apk.download_count || 0), notes: String(payload.body || '').slice(0, 12000), preview: false };
}
