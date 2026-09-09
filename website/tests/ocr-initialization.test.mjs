import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { initializeOcr } from "../lib/ocr-initialization.mjs";

test("language HTTP failure rejects even when Tesseract never settles createWorker", async () => {
  await assert.rejects(initializeOcr((_langs, _mode, options) => {
    queueMicrotask(() => options.errorHandler("Network error while fetching language. Response code: 404"));
    return new Promise(() => {});
  }, {}), /HTTP 404/);
});

test("successful initialization bypasses worker IndexedDB and keeps same-origin models", async () => {
  const worker = { terminate: async () => {} };
  const ready = await initializeOcr(async (langs, mode, options) => {
    assert.deepEqual(langs, ["jpn", "eng"]);
    assert.equal(mode, 1);
    assert.equal(options.cacheMethod, "none");
    assert.equal(options.langPath, "https://example.com/ocr-data/v1");
    return worker;
  }, { langPath: "https://example.com/ocr-data/v1" });
  assert.equal(ready, worker);
});

test("cancelled initialization rejects and terminates a late worker", async () => {
  const controller = new AbortController();
  let finish, terminated = false;
  const result = initializeOcr(() => new Promise(resolve => { finish = resolve; }), {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  finish({ terminate: async () => { terminated = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(terminated, true);
});

test("stalled initialization times out and abort-before-start does not start a worker", async () => {
  await assert.rejects(initializeOcr(() => new Promise(() => {}), {}, { timeoutMs: 10 }), /逾時/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(initializeOcr(() => assert.fail("must not initialize"), {}, { signal: controller.signal }), { name: "AbortError" });
});

test("both packaged language assets are real gzip models, not an HTML error page", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../public/ocr-data/v1/sources.json", import.meta.url)));
  for (const language of ["jpn", "eng"]) {
    const compressed = fs.readFileSync(new URL(`../public/ocr-data/v1/${language}.traineddata.gz`, import.meta.url));
    assert.equal(compressed[0], 0x1f); assert.equal(compressed[1], 0x8b);
    assert.equal(compressed.length, manifest[language].bytes);
    assert.equal(createHash("sha256").update(compressed).digest("hex"), manifest[language].sha256);
    const model = gunzipSync(compressed);
    assert.ok(model.length > 1000000);
    assert.notEqual(model.subarray(0, 5).toString(), "<html");
  }
});
