// Loaded only by the separate preparation button. Images stay on the device.
// Pin all runtime assets rather than silently taking future CDN releases.
import { initializeOcr } from "@/lib/ocr-initialization.mjs";
type Progress = { status: string; progress: number };
export type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};
type TesseractAPI = { createWorker: (languages: string[], mode: number, options: Record<string, unknown>) => Promise<OcrWorker> };
declare global { interface Window { Tesseract?: TesseractAPI } }
let library: Promise<TesseractAPI> | null = null;

function loadLibrary() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (library) return library;
  library = new Promise<TesseractAPI>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timer); script.remove(); library = null; reject(new Error("辨識工具載入失敗，請檢查網絡後重試，或使用手動搜尋。")); };
    const timer = window.setTimeout(fail, 30000);
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => { if (!window.Tesseract) { fail(); return; } clearTimeout(timer); resolve(window.Tesseract); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return library;
}

export async function makeOcrWorker(onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<OcrWorker> {
  const api = await loadLibrary();
  return initializeOcr(api.createWorker.bind(api), {
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js",
    corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
    langPath: new URL("/ocr-data/v1", window.location.href).href,
    logger: onProgress,
  }, { signal }) as Promise<OcrWorker>;
}
