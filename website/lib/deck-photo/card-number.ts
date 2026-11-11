import { makeOcrWorker } from "../scanner-ocr";
import { scanCardNumbers } from "../card-scanner.mjs";
import type { PhotoRect } from "./review";

export async function readPhotoCardNumbers(photo: HTMLCanvasElement, rect: PhotoRect, signal: AbortSignal) {
  const crop = document.createElement("canvas");
  crop.width = 850;
  const strip = rect.height * .22;
  crop.height = Math.round(crop.width * strip / rect.width);
  const context = crop.getContext("2d");
  if (!context) return [];
  // Card numbers are printed along the bottom edge. Enlarging just that strip
  // avoids feeding unrelated names, skill text, and other cards into OCR.
  context.drawImage(photo, rect.x, rect.y + rect.height - strip, rect.width, strip, 0, 0, crop.width, crop.height);
  const worker = await makeOcrWorker(() => {}, signal);
  let timeout = 0;
  let interrupt = () => {};
  const stopped = new Promise<never>((_, reject) => {
    interrupt = () => reject(new DOMException("已取消辨識", "AbortError"));
    signal.addEventListener("abort", interrupt, { once: true });
    timeout = window.setTimeout(() => reject(new Error("辨識逾時，請搜尋卡名或卡號。")), 15000);
  });
  try {
    signal.throwIfAborted();
    const { data } = await Promise.race([stopped, (async () => {
      await worker.setParameters({ tessedit_pageseg_mode: "11", tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-" });
      return worker.recognize(crop);
    })()]);
    return [...new Set(scanCardNumbers(data.text))];
  } finally {
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", interrupt);
    void worker.terminate().catch(() => {});
  }
}
