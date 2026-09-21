export const RELEASE_REPOSITORY = 'luckymatthew/Hololen';
export const APK_FILENAME = 'HoloLens.apk';
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;
export const STABLE_TAG = 'v1.2.4';
export const releaseUrl = tag => `${RELEASES_URL}/tag/${encodeURIComponent(tag)}`;
export const apkUrl = tag => `${RELEASES_URL}/download/${encodeURIComponent(tag)}/${APK_FILENAME}`;
export const APK_URL = apkUrl(STABLE_TAG);
// Verified public release: usable even when GitHub metadata is unavailable.
export const STABLE_METADATA = {"version":"v1.2.4","size":606583989,"date":"2026-09-21T00:00:00Z","preview":false,"name":"Hololens 1.2.4 · AI、對局記錄及掃卡修正","downloads":0,"notes":"修正 hBP06-093 後續選擇令 AI 停止、非法附加候選及重複搜尋。補齊 hBP09 掃卡辨識索引與縮圖，重用每幀影像特徵以減少 OCR 補充時的重複計算。保留原簽章、牌組、原生介面及經讀回校驗的 JSON／ZIP 匯出。複雜 AI 搜尋仍可能需時；參照卡圖測試不代表實體手機即時辨識，詳見版本測試報告。"};
export function releaseMetadata(payload) {
  if (!payload || payload.draft || payload.prerelease || !/^v\d+\.\d+\.\d+$/.test(payload.tag_name) || !Array.isArray(payload.assets)) throw new Error('尚未有正式版本');
  const apk = payload.assets.find(asset => asset.name === APK_FILENAME && asset.state === 'uploaded');
  if (!apk || !Number.isFinite(apk.size) || apk.size <= 0) throw new Error('正式版本尚未附上 APK');
  const parts = payload.tag_name.slice(1).split('.').map(Number), baseline = STABLE_TAG.slice(1).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if (parts[i] < baseline[i]) throw new Error('版本已過期'); if (parts[i] > baseline[i]) break; }
  return { version: payload.tag_name, name: String(payload.name || ''), date: payload.published_at, size: apk.size, downloads: Number(apk.download_count || 0), notes: String(payload.body || '').slice(0, 12000), preview: false };
}
