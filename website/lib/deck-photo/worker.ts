import { PHOTO_INDEX_PATH, readArtworkIndex } from "./artwork.mjs";
import { recognizeDeckPhoto } from "./recognize.mjs";

self.onmessage = async (event: MessageEvent<ImageData>) => {
  try {
    const response = await fetch(PHOTO_INDEX_PATH);
    if (!response.ok) throw new Error("卡圖索引暫時未能載入，請重試。");
    const index = readArtworkIndex(await response.json());
    self.postMessage({ type: "scanning" });
    const scan = recognizeDeckPhoto(event.data, index);
    self.postMessage({ type: "result", scan });
  } catch {
    self.postMessage({ type: "error", message: "相片辨識暫時未能完成。你可以重試或手動輸入。" });
  }
};
