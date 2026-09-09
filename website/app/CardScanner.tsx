"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cameraCrop, createScanIndex, matchScanText } from "@/lib/card-scanner.mjs";
import { makeOcrWorker, type OcrWorker } from "@/lib/scanner-ocr";

type ScanCard = { number: string; name: string; jpName: string; image: string; stage: string; hp: number | null };
type Match = { number: string; score: number; reasons: string[] };
type JapaneseIndex = Record<string, { titles?: string[]; effects?: string[] }>;

export default function CardScanner({ cards, onPick, onClose }: { cards: ScanCard[]; onPick: (number: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const worker = useRef<OcrWorker | null>(null);
  const pendingWorker = useRef<Promise<OcrWorker> | null>(null);
  const workerGeneration = useRef(0);
  const preparingRef = useRef(false);
  const preparationAbort = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const cameraRequest = useRef(0);
  const running = useRef(false);
  const mounted = useRef(true);
  const photoCanvas = useRef<HTMLCanvasElement | null>(null);
  const [camera, setCamera] = useState(false);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState("");
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [searched, setSearched] = useState(false);
  const [japanese, setJapanese] = useState<JapaneseIndex>({});
  const [indexWarning, setIndexWarning] = useState("");
  const index = useMemo(() => createScanIndex(cards, japanese), [cards, japanese]);
  const cardMap = useMemo(() => new Map(cards.map(card => [card.number, card])), [cards]);

  function stopCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera(false); setReady(false); setOpening(false);
  }

  function cancelScan() {
    generation.current++;
    preparationAbort.current?.abort(); preparationAbort.current = null;
    // Switching camera/photo while idle must keep the preloaded engine ready.
    if (running.current) {
      workerGeneration.current++;
      void worker.current?.terminate().catch(() => {});
      worker.current = null;
      setDataReady(false);
      if (!preparingRef.current) setDownloadProgress("辨識已停止，請按「下載辨識資料」重新載入已快取資料。");
    }
    running.current = false;
    pendingWorker.current = null;
    if (preparingRef.current) setDownloadProgress("下載已取消。可以再按按鈕重新載入。");
    preparingRef.current = false; setPreparing(false); setDownloadPercent(null);
    setBusy(false); setProgress(""); setAuto(false);
  }

  async function prepareData() {
    if (running.current || worker.current) return;
    stopCamera();
    running.current = true; preparingRef.current = true;
    const ticket = generation.current;
    const workerTicket = ++workerGeneration.current;
    preparationAbort.current = new AbortController();
    const current = () => mounted.current && ticket === generation.current;
    setBusy(true); setPreparing(true); setDataReady(false); setError("");
    setDownloadPercent(null); setDownloadProgress("載入辨識工具…");
    const timeout = window.setTimeout(() => {
      if (!current()) return;
      cancelScan(); setDownloadProgress("下載未完成，請重試。");
      setError("下載辨識資料逾時，請檢查網絡後再試。");
    }, 90000);
    try {
      pendingWorker.current = makeOcrWorker(p => {
        if (!mounted.current || workerTicket !== workerGeneration.current) return;
        const percent = Math.max(0, Math.min(100, Math.round(p.progress * 100)));
        if (preparingRef.current) {
          const labels: Record<string, string> = {
            "loading tesseract core": "載入辨識引擎",
            "initializing tesseract": "啟動辨識引擎",
            "loading language traineddata": "下載／解壓日文及英文資料",
            "initializing api": "準備辨識資料",
          };
          const awaitingFiles = p.status === "loading language traineddata" && percent === 0;
          setDownloadProgress(awaitingFiles ? "正在下載日文及英文資料（共約 5 MB）…" : `${labels[p.status] || "準備辨識資料"} ${percent}%`);
          setDownloadPercent(awaitingFiles ? null : percent);
        } else if (running.current && p.status === "recognizing text") setProgress(`辨識文字中 ${percent}%`);
      }, preparationAbort.current.signal);
      const created = await pendingWorker.current;
      if (!current()) { void created.terminate().catch(() => {}); return; }
      worker.current = created; pendingWorker.current = null;
      await created.setParameters({ tessedit_pageseg_mode: "11", user_defined_dpi: "300" });
      if (!current()) return;
      setDataReady(true); setDownloadPercent(100);
      setDownloadProgress("辨識資料已準備好，可以開啟鏡頭或選擇相片。");
    } catch (cause) {
      if (current()) {
        cancelScan(); setDownloadProgress("下載未完成，請重試。");
        setError(cause instanceof Error ? cause.message : "辨識資料載入失敗，請重試。");
      }
    } finally {
      clearTimeout(timeout);
      if (current()) { running.current = false; preparingRef.current = false; setBusy(false); setPreparing(false); }
    }
  }

  function pick(number: string) {
    cancelScan(); stopCamera(); dialog.current?.close(); onPick(number);
  }

  useEffect(() => {
    mounted.current = true;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/scanner-ja.json", { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(data => { if (mounted.current) setJapanese(data.cards); }).catch(() => {
      if (mounted.current) setIndexWarning("日文效果索引暫時未能載入，仍可用卡號、角色名及技能名搜尋。");
    });
    const visibility = () => { if (document.hidden) { cancelScan(); stopCamera(); } };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      mounted.current = false; generation.current++; cameraRequest.current++; workerGeneration.current++;
      preparationAbort.current?.abort();
      controller.abort();
      stream.current?.getTracks().forEach(track => track.stop());
      void worker.current?.terminate().catch(() => {});
      document.removeEventListener("visibilitychange", visibility);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  async function openCamera() {
    if (!worker.current || running.current) return;
    cancelScan(); stopCamera(); setError(""); setPhoto(""); photoCanvas.current = null;
    setMatches([]); setSearched(false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("目前瀏覽器無法開啟鏡頭。請用 HTTPS 網址喺 Chrome／Safari 開啟，或選擇相片。"); return;
    }
    const request = ++cameraRequest.current;
    setOpening(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      if (!mounted.current || request !== cameraRequest.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setCamera(true); setAuto(true);
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
    } catch (cause) {
      if (!mounted.current || request !== cameraRequest.current) return;
      stopCamera();
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" ? "鏡頭權限未開啟。請喺瀏覽器網站設定允許使用鏡頭，或改用相片。" : name === "NotFoundError" ? "搵唔到可用鏡頭，請選擇相片。" : "鏡頭暫時無法使用，可能正被其他程式使用。請重試或選擇相片。");
    } finally { if (mounted.current && request === cameraRequest.current) setOpening(false); }
  }

  function capture() {
    if (photoCanvas.current) return photoCanvas.current;
    if (!video.current?.videoWidth || !guide.current) throw new Error("鏡頭未準備好，請稍等再試。");
    const v = video.current;
    const crop = cameraCrop(v.videoWidth, v.videoHeight, v.getBoundingClientRect(), guide.current.getBoundingClientRect());
    const canvas = document.createElement("canvas");
    canvas.width = 1100; canvas.height = Math.round(1100 * crop.height / crop.width);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("瀏覽器無法處理相片，請改用手動搜尋。");
    context.drawImage(v, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  async function scan() {
    if (running.current) return;
    if (!worker.current) { setError("請先按「下載辨識資料」，準備好之後再辨識。"); return; }
    running.current = true;
    const ticket = generation.current;
    const current = () => mounted.current && ticket === generation.current;
    setBusy(true); setError(""); setProgress("辨識文字中…");
    const timeout = window.setTimeout(() => {
      if (!current()) return;
      cancelScan(); setError("辨識逾時，請檢查網絡或將卡片文字放大再試。亦可手動搜尋。");
    }, 90000);
    try {
      const canvas = capture();
      if (!current()) return;
      const result = await worker.current.recognize(canvas);
      if (!current()) return;
      setText(result.data.text); setSearched(true);
      const found = matchScanText(index, result.data.text);
      setMatches(found.matches);
      if (found.autoNumber) { pick(found.autoNumber); return; }
      if (found.matches.length) setAuto(false);
      setProgress(found.matches.length ? "請核對候選卡，點選查看繁中效果。" : "未能認出卡片，請靠近、避開反光，或選擇相片再試。");
    } catch (cause) {
      if (current()) { cancelScan(); setError(cause instanceof Error ? cause.message : "辨識失敗，請重試。"); }
    } finally {
      clearTimeout(timeout);
      if (current()) { running.current = false; setBusy(false); }
    }
  }

  // One OCR job at a time; allow focusing between frames. Pause on candidates.
  useEffect(() => {
    if (!dataReady || !camera || !ready || !auto || busy || error) return;
    const timer = window.setTimeout(() => { void scan(); }, 1600);
    return () => clearTimeout(timer);
  });

  async function loadPhoto(file?: File) {
    if (!file) return;
    cancelScan(); stopCamera(); setError(""); setMatches([]); setSearched(false);
    if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) { setError("請選擇 20 MB 以內嘅相片（建議 JPG、PNG 或 WebP）。"); return; }
    const ticket = generation.current;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (!mounted.current || ticket !== generation.current) return;
      const canvas = document.createElement("canvas");
      const scale = Math.min(2, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      photoCanvas.current = canvas; setPhoto(canvas.toDataURL("image/jpeg", 0.9));
      setProgress("請確認相片只有一張卡、文字朝上，再按「辨識」。");
    } catch { if (mounted.current && ticket === generation.current) setError("讀唔到呢張相片，請改用 JPG／PNG，或重新拍攝。"); }
    finally { URL.revokeObjectURL(url); }
  }

  function rotatePhoto() {
    const original = photoCanvas.current;
    if (!original) return;
    const rotated = document.createElement("canvas"); rotated.width = original.height; rotated.height = original.width;
    const context = rotated.getContext("2d");
    if (!context) return;
    context.translate(rotated.width, 0); context.rotate(Math.PI / 2); context.drawImage(original, 0, 0);
    photoCanvas.current = rotated; setPhoto(rotated.toDataURL("image/jpeg", 0.9));
  }

  return <dialog ref={dialog} className="scanner-dialog" aria-labelledby="scanner-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="scanner-header"><div><span className="eyebrow">CARD SCANNER</span><h2 id="scanner-title">掃卡・睇繁中效果</h2></div><button type="button" onClick={onClose} aria-label="關閉掃卡">✕</button></header>
    <p className="scanner-help">對準一張日文卡，將角色名、技能名同效果文字放入框內。卡號睇得清會一併核對。</p>
    <section className="scanner-download" aria-label="下載辨識資料" aria-busy={preparing}>
      <strong>1 · 先準備辨識資料</strong>
      <div className="scanner-actions">
        <button type="button" className="scanner-primary" disabled={busy || dataReady} onClick={() => { void prepareData(); }}>{preparing ? "下載／準備中…" : dataReady ? "✓ 辨識資料已準備好" : "下載辨識資料"}</button>
        {preparing && <button type="button" onClick={cancelScan}>取消下載</button>}
      </div>
      {preparing && <progress max={100} value={downloadPercent ?? undefined} aria-label="目前準備步驟進度" />}
      <p className="scanner-status" role="status">{downloadProgress || "先下載日文及英文辨識資料，唔需要開鏡頭。"}</p>
      {error && <p className="scanner-error" role="alert">{error}</p>}
      <p className="scanner-help">已快取嘅語言資料會重用；瀏覽器清除快取後可能需要重新下載。每個準備步驟會分別顯示進度。</p>
    </section>
    <h3 className="scanner-step">2 · 開鏡頭或選擇相片</h3>
    <div className="scanner-layout">
      <div>
        <div className={`scanner-view ${camera ? "camera-on" : ""}`}>
          <video ref={video} muted playsInline autoPlay onLoadedData={() => setReady(true)} aria-label="後置鏡頭預覽" />
          {camera && <div ref={guide} className="scanner-guide"><span>整張卡放入框內</span></div>}
          {!camera && (photo ? <img src={photo} alt="待辨識相片" /> : <div className="scanner-placeholder"><span aria-hidden="true">▣</span><strong>開鏡頭或選擇相片</strong><p>平放卡片・避開反光・文字朝上</p></div>)}
        </div>
        <div className="scanner-actions">
          <button type="button" onClick={() => { void openCamera(); }} disabled={!dataReady || opening || busy}>{opening ? "等候鏡頭權限…" : camera ? "重開鏡頭" : "開啟鏡頭"}</button>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>選擇相片</button>
          <input ref={fileInput} hidden type="file" accept="image/*" onChange={event => { void loadPhoto(event.target.files?.[0]); event.target.value = ""; }} />
          {opening && <button type="button" onClick={stopCamera}>取消開啟</button>}
          {photo && <button type="button" onClick={rotatePhoto} disabled={busy}>旋轉 90°</button>}
          {(photo || camera) && <button type="button" className="scanner-primary" disabled={!dataReady || busy || (camera && !ready)} onClick={() => { setAuto(false); void scan(); }}>辨識</button>}
          {busy && !preparing && <button type="button" onClick={cancelScan}>取消辨識</button>}
        </div>
        {camera && <div className="scanner-camera-controls"><label><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} /> 自動連續掃描</label><button type="button" onClick={() => { cancelScan(); stopCamera(); }}>關閉鏡頭</button></div>}
        <p className="scanner-status" role="status" aria-live="polite">{progress}</p>
        <p className="scanner-privacy">相片只喺你部裝置處理，唔會上傳或保存。</p>
      </div>
      <section className="scanner-results" aria-label="辨識結果">
        <form onSubmit={event => { event.preventDefault(); setAuto(false); const found = matchScanText(index, text); setMatches(found.matches); setSearched(true); if (found.autoNumber) pick(found.autoNumber); }}>
          <label htmlFor="scanner-text">手動輸入／修正辨識文字</label>
          <textarea id="scanner-text" value={text} maxLength={12000} rows={3} placeholder="角色名、Arts／技能名、效果片段或 hEB01-003" onChange={event => setText(event.target.value)} />
          <button type="submit" disabled={busy || text.trim().length < 3}>搜尋卡片</button>
        </form>
        {indexWarning && <p className="scanner-help">{indexWarning}</p>}
        <h3>{matches.length ? "可能係呢張卡" : "辨識結果"}</h3>
        {!matches.length && <p className="scanner-help">{searched ? "未搵到相符卡片。試下只輸入技能名，或重新影近少少。" : "清楚嘅卡號，或足夠明確嘅角色名＋技能名，會直接開啟繁中效果；其餘會列出候選卡。"}</p>}
        <div className="scanner-candidates">{matches.map(match => {
          const card = cardMap.get(match.number);
          return card && <button key={match.number} type="button" className="scanner-candidate" onClick={() => pick(match.number)}>
            <img src={card.image} alt={`${card.number} 卡圖`} loading="lazy" />
            <span><code>{card.number}</code><strong>{card.name}</strong><span>{card.stage}{card.hp != null ? ` · HP ${card.hp}` : ""}</span><small>{match.reasons.join(" · ")}</small></span>
          </button>;
        })}</div>
        <p className="scanner-help">文字辨識唔會分辨稀有度／異圖版本。繁中翻譯僅供參考，請以官方日文卡面及裁定為準。</p>
        <p className="scanner-help">部分新卡未有日文效果全文索引，請優先掃技能名或卡號。日文資料：<a href="https://github.com/lichingchester/hololive-ocg-wiki" target="_blank" rel="noreferrer">Hololive OCG Wiki</a>（<a href="/scanner-data-license.txt" target="_blank" rel="noreferrer">授權</a>）。</p>
      </section>
    </div>
  </dialog>;
}
