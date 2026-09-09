import assert from "node:assert/strict";
import test from "node:test";

test("renders the finished Traditional Chinese site metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /掃卡翻譯/);
  assert.match(html, /每張卡，一目了然/);
  assert.match(html, /效果列表模式/);
  assert.match(html, /id="deck-workbench"[^>]*hidden/);
  assert.doesNotMatch(html, /<section class="intro"/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(html, /<html[^>]*\blang=["']zh-Hant["']/i);
  assert.match(html, /<title[^>]*>[^<]*Hololive OCG 繁中卡庫・牌組工房[^<]*<\/title>/i);
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["'][^"']*Hololive OCG[^"']*["'])[^>]*>/i,
  );
  assert.doesNotMatch(html, /\bname=["']codex-preview["']/i);
});
