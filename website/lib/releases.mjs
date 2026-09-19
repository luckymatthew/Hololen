export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.2.2';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const APK_URL = apkUrl(STABLE_TAG);
// Verified public release: usable even when GitHub metadata is unavailable.
export const STABLE_METADATA = {"version":"v1.2.2","size":599919797,"date":"2026-09-19T00:00:00Z","preview":false,"name":"Hololens 1.2.2 · Export repair and hand count","downloads":0,"notes":"修正對手手牌張數被按鈕遮住，以及 Android 匯出期間畫面重建導致空檔。牌組、備份、效能與 AI Review JSON／ZIP 均先暫存並於寫入後讀回校驗。AI Review 改為分段讀取已保存對局；保留原簽章及現有功能。Android 15+、ARM64；模擬器升級及六種匯出測試通過。實機與原本第 4 回合停住的存檔尚未驗證，詳見發布說明。"};
export function releaseMetadata(payload) {
  if (!payload || payload.draft || payload.prerelease || !/^v\d+\.\d+\.\d+$/.test(payload.tag_name) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const apk = payload.assets.find(asset => asset.name === APK_FILENAME && asset.state === 'uploaded');
  if (!apk || !Number.isFinite(apk.size) || apk.size <= 0) throw new Error('正式版本尚未附上 APK');
  const parts = payload.tag_name.slice(1).split('.').map(Number), baseline = STABLE_TAG.slice(1).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (parts[i] < baseline[i]) throw new Error('版本已過期'); if (parts[i] > baseline[i]) break; }
  return { version: payload.tag_name, name: String(payload.name || ''), date: payload.published_at, size: apk.size, downloads: Number(apk.download_count || 0), notes: String(payload.body || '').slice(0, 12000), preview: false };
}
