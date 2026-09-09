export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const APK_URL = `${RELEASES_URL}/latest/download/${APK_FILENAME}`;
// Owner-supplied, signature-verified preview. Never label it as a stable release.
export const PREVIEW_TAG = 'v0.7.2-native-preview';
export const PREVIEW_URL = `${RELEASES_URL}/download/${PREVIEW_TAG}/${APK_FILENAME}`;
export const PREVIEW_METADATA = { version: PREVIEW_TAG, size: 576750232, date: null, preview: true, notes: '', name: 'Hololens 0.7.2 預覽版', downloads: 0 };
export function releaseMetadata(payload, allowPreview = false) {
  if (!payload || payload.draft || (payload.prerelease && (!allowPreview || payload.tag_name !== PREVIEW_TAG)) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const apk = payload.assets.find(asset => asset.name === APK_FILENAME);
  if (!apk) throw new Error('正式版本尚未附上 APK');
  return { version: String(payload.tag_name || ''), name: String(payload.name || ''), date: payload.published_at, size: Number(apk.size || 0), downloads: Number(apk.download_count || 0), notes: String(payload.body || '').slice(0, 12000), preview: Boolean(payload.prerelease) };
}
