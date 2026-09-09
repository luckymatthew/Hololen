// Tesseract 6's createWorker promise can stay pending when loadLanguage fails.
// Bridge its error callback as well as its promise; don't wait for the UI timer.
/** @param {{signal?: AbortSignal, timeoutMs?: number}} [control] */
export function initializeOcr(createWorker, options, control = {}) {
  const { signal, timeoutMs = 60000 } = control;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); };
    const fail = reason => {
      if (settled) return;
      settled = true; cleanup();
      const raw = String(reason?.message || reason);
      const status = raw.match(/(?:Response code:|HTTP)\s*(\d{3})/i)?.[1];
      reject(reason?.name === "AbortError" ? reason : new Error(status
        ? `下載辨識資料失敗（HTTP ${status}），請重試。`
        : `辨識資料載入失敗：${raw.slice(0, 180)}`));
    };
    const abort = () => fail(new DOMException("已取消下載辨識資料", "AbortError"));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => fail(new Error("準備逾時，請重新載入；手動搜尋仍然可用。")), timeoutMs);
    try {
      Promise.resolve(createWorker(["jpn", "eng"], 1, {
        ...options,
        // Do not block on IndexedDB inside a blob worker on iOS. Versioned
        // same-origin model files can use the normal HTTP cache instead.
        cacheMethod: "none",
        errorHandler: fail,
      })).then(worker => {
        if (settled) { void worker.terminate().catch(() => {}); return; }
        settled = true; cleanup(); resolve(worker);
      }, fail);
    } catch (error) { fail(error); }
  });
}
