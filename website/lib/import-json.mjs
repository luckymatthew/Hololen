/** Shared by every file importer; validate before changing a deck or local backup. */
export async function readImportJson(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('JSON 檔案超過 20 MB，請選擇牌組或本機備份。');
  const text = (await file.text()).replace(/^\uFEFF/u, '').trim();
  if (!text) throw new Error('匯入的 JSON 是空白檔案，請更新 Hololens APK 後重新匯出。');
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('JSON 不完整或格式錯誤，請重新匯出完整檔案。'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('請選擇有效的 JSON 牌組或備份物件。');
  if (value.schemaVersion?.startsWith?.('hololens.ai-review') || value.schemaVersion?.startsWith?.('hololens.native-operations')) throw new Error('這是診斷報告；匯入牌組請選擇「匯出牌組 JSON」產生的檔案。');
  return value;
}
