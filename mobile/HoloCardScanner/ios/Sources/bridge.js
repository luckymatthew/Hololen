(() => {
  const host = "hololive-ocg-zh-deck-studio.matthewmelia.chatgpt.site";
  const post = (action, extra = {}) => window.webkit.messageHandlers.native.postMessage({ action, ...extra });
  window.HoloNative = Object.freeze({
    startScanner: () => post("scan"),
    importJson: () => post("import"),
    exportJson: (name, json) => post("export", { name, json }),
    openExternal: url => post("external", { url }),
    artUrl: url => {
      try { const u = new URL(url, location.href); if (u.protocol === "https:" && u.hostname === "hololive-official-cardgame.com" && u.pathname.startsWith("/wp-content/images/cardlist/")) return `${location.protocol}//${location.host}/original-art?url=${encodeURIComponent(url)}`; } catch {}
      return url;
    }
  });
  if (globalThis.crypto && !crypto.randomUUID) {
    crypto.randomUUID = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (Number(c) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16));
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.host !== location.host || !url.pathname.startsWith("/api/")) return originalFetch(input, init);
    const signal = init.signal || (input instanceof Request ? input.signal : undefined);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = init.body ?? (input instanceof Request && method !== "GET" ? await input.clone().text() : "");
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      window.webkit.messageHandlers.cloud.postMessage({ path: url.pathname + url.search, method, body: String(body || "") }).then(result => {
        signal?.removeEventListener("abort", abort);
        if (!signal?.aborted) resolve(new Response([204, 205, 304].includes(result.status) ? null : result.body, { status: result.status, headers: { "Content-Type": "application/json" } }));
      }, error => { signal?.removeEventListener("abort", abort); reject(new Error(String(error))); });
    });
  };
})();
