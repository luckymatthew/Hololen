"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import StudioIcon from "@/app/StudioIcon";
import { useModalMotion } from "@/app/ui-motion";
import { appFetch } from "@/lib/backend";
import { matchesSearch } from "@/lib/catalog-search.mjs";
import { normalizeScanText } from "@/lib/card-scanner.mjs";
import { validateDeckName, type DeckSection, type StoredDeckState } from "@/lib/deck-data";
import { makePhotoReview, photoChoices, photoSections, reviewPhotoDeck,
  type PhotoChoice, type PhotoPrinting, type PhotoRect, type PhotoReviewRow, type PhotoScan } from "@/lib/deck-photo/review";

export type SavedPhotoDeck = { id: string; name: string; deck: StoredDeckState };
type Photo = { url: string; name: string; width: number; height: number };
type ScanMessage = { type: "scanning" } | { type: "result"; scan: PhotoScan } | { type: "error"; message: string };

function regionPosition(rect: PhotoRect, photo: Photo): CSSProperties {
  return { left: `${rect.x / photo.width * 100}%`, top: `${rect.y / photo.height * 100}%`,
    width: `${rect.width / photo.width * 100}%`, height: `${rect.height / photo.height * 100}%` };
}

function ChoiceArt({ choice }: { choice?: PhotoChoice }) {
  return <span className="photo-import-art">{choice?.image
    ? <img src={choice.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    : <StudioIcon name="cards" />}</span>;
}

export default function DeckPhotoImport({ printings, hasDeckInEditor, onOpen, onClose }: {
  printings: PhotoPrinting[];
  hasDeckInEditor: boolean;
  onOpen: (saved: SavedPhotoDeck) => void;
  onClose: () => void;
}) {
  const { dialog, requestClose } = useModalMotion(onClose);
  const choices = useMemo(() => photoChoices(printings), [printings]);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const scanTask = useRef<{ worker: Worker; timer: number } | null>(null);
  const scanGeneration = useRef(0);
  const codeTask = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const nextRow = useRef(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [rows, setRows] = useState<PhotoReviewRow[]>([]);
  const [status, setStatus] = useState("");
  const [scanError, setScanError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [codeStatus, setCodeStatus] = useState("");
  const [readingCode, setReadingCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedPhotoDeck | null>(null);

  const stopScan = useCallback(() => {
    const task = scanTask.current;
    if (!task) return;
    window.clearTimeout(task.timer);
    task.worker.terminate();
    scanTask.current = null;
  }, []);

  const releasePhoto = useCallback(() => {
    scanGeneration.current++;
    stopScan();
    codeTask.current?.abort();
    codeTask.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    canvas.current = null;
  }, [stopScan]);

  useEffect(() => releasePhoto, [releasePhoto]);

  const edit = (id: number | null) => {
    codeTask.current?.abort();
    codeTask.current = null;
    setReadingCode(false);
    setCodeStatus("");
    setQuery("");
    setEditing(id);
  };

  const scan = (source: HTMLCanvasElement, generation: number) => {
    stopScan();
    setStatus("正在準備卡圖索引…");
    setScanError("");
    const fail = (message: string) => {
      if (generation !== scanGeneration.current) return;
      stopScan();
      setStatus("");
      setScanError(message);
    };
    try {
      const context = source.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas unavailable");
      const data = context.getImageData(0, 0, source.width, source.height);
      const worker = new Worker(new URL("../lib/deck-photo/worker.ts", import.meta.url), { type: "module" });
      scanTask.current = { worker, timer: window.setTimeout(() => fail("辨識逾時，請重試或手動新增卡牌。"), 30000) };
      worker.onerror = () => fail("未能啟動辨識。你可以重試或手動新增卡牌。");
      worker.onmessageerror = () => fail("未能讀取辨識結果，請重試。");
      worker.onmessage = (event: MessageEvent<ScanMessage>) => {
        if (generation !== scanGeneration.current || scanTask.current?.worker !== worker) return;
        const message = event.data;
        if (message.type === "scanning") { setStatus("正在辨識卡圖及張數…"); return; }
        if (message.type === "error") { fail(message.message); return; }
        const review = makePhotoReview(message.scan, choices);
        nextRow.current = review.length;
        setRows(review);
        setStatus("");
        if (!review.length) setScanError("未找到清晰的牌組排版。可以試用完整截圖，或手動新增卡牌。");
        stopScan();
      };
      worker.postMessage(data, [data.data.buffer]);
    } catch {
      fail("未能讀取相片像素。請試用另一張相片或手動新增卡牌。");
    }
  };

  const loadPhoto = async (file?: File) => {
    if (!file || savingRef.current || saved) return;
    const imageFile = /^(image\/(jpeg|png|webp))$/.test(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!imageFile || !file.size || file.size > 20 * 1024 * 1024) {
      setScanError("請選擇最多 20 MB 的 JPG、PNG 或 WebP 相片。");
      return;
    }
    releasePhoto();
    const generation = scanGeneration.current;
    setPhoto(null);
    setRows([]);
    edit(null);
    setScanError("");
    setSaveError("");
    setStatus("正在讀取相片…");
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (generation !== scanGeneration.current) return;
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const surface = document.createElement("canvas");
      surface.width = Math.max(1, Math.round(image.naturalWidth * scale));
      surface.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = surface.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("canvas unavailable");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, surface.width, surface.height);
      context.drawImage(image, 0, 0, surface.width, surface.height);
      canvas.current = surface;
      setPhoto({ url, name: file.name, width: surface.width, height: surface.height });
      setName(file.name.replace(/\.[^.]+$/, "").trim().slice(0, 60) || "相片匯入牌組");
      scan(surface, generation);
    } catch {
      if (generation !== scanGeneration.current) return;
      releasePhoto();
      setStatus("");
      setScanError("這張相片無法開啟，請重新選擇檔案。");
    }
  };

  const review = useMemo(() => reviewPhotoDeck(rows, choices), [rows, choices]);
  const editedRow = rows.find(row => row.id === editing);
  const suggestedChoices = useMemo(() => {
    if (!editedRow) return [];
    if (!query.trim()) return [...new Set([editedRow.selected, ...editedRow.suggested])]
      .flatMap(key => key && choices.has(key) ? [choices.get(key)!] : []);
    return [...choices.values()].filter(choice => choice.section === editedRow.section && matchesSearch(choice.searchText, query)).slice(0, 12);
  }, [editedRow, choices, query]);

  const changeRow = (id: number, updates: Partial<PhotoReviewRow>) => {
    setRows(previous => previous.map(row => row.id === id ? { ...row, ...updates } : row));
    setSaveError("");
  };

  const addRow = (section: DeckSection) => {
    const id = nextRow.current++;
    setRows(previous => [...previous, { id, section, rects: [], selected: null, suggested: [], count: 1, defaulted: false }]);
    edit(id);
  };

  const recognizeCode = async (row: PhotoReviewRow) => {
    if (!canvas.current || !row.rects.length || codeTask.current) return;
    const source = canvas.current;
    const controller = new AbortController();
    codeTask.current = controller;
    setReadingCode(true);
    setCodeStatus("正在讀取卡號…");
    try {
      const { readPhotoCardNumbers } = await import("@/lib/deck-photo/card-number");
      const codes = await readPhotoCardNumbers(source, row.rects[0], controller.signal);
      if (controller.signal.aborted) return;
      const known = [...new Set([...choices.values()].filter(choice => choice.section === row.section && codes.includes(normalizeScanText(choice.number))).map(choice => choice.number))];
      if (known.length === 1) { setQuery(known[0]); setCodeStatus(`讀到 ${known[0]}，請選擇版本。`); }
      else setCodeStatus(known.length ? `讀到多個卡號。請核對相片後搜尋。` : "未讀到完整卡號。可以用卡名或卡號搜尋。");
    } catch {
      if (!controller.signal.aborted) setCodeStatus("文字辨識暫時未能完成。可以用卡名或卡號搜尋。");
    } finally {
      if (codeTask.current === controller) { codeTask.current = null; setReadingCode(false); }
    }
  };

  const save = async () => {
    const title = validateDeckName(name);
    if (!title || !review.canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await appFetch("/api/decks", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, deck: review.deck }) });
      if (response.status === 401) throw new Error("請先登入帳號，再匯入牌組。");
      const payload = await response.json();
      if (!response.ok || !payload.deck?.id) throw new Error(payload.error || "未能保存牌組，請重試。");
      setSaved(payload.deck);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "未能保存牌組，請重試。");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <dialog ref={dialog} className="deck-photo-dialog t-modal" data-review={Boolean(photo && !saved)} aria-labelledby="deck-photo-heading"
    onCancel={event => { event.preventDefault(); if (!savingRef.current) requestClose(); }}
    onPaste={event => {
      const file = [...event.clipboardData.files].find(item => item.type.startsWith("image/"));
      if (file && !saved) { event.preventDefault(); void loadPhoto(file); }
    }}>
    <div className="photo-import-shell">
      <header className="photo-import-header">
        <span className="photo-import-icon"><StudioIcon name="scan" /></span>
        <h2 id="deck-photo-heading">從相片匯入牌組</h2>
        <button type="button" className="photo-import-close" aria-label="關閉相片匯入" onClick={requestClose} disabled={saving}>×</button>
      </header>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="牌組相片" hidden
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void loadPhoto(file); }} />
      <div className="photo-import-content">
        {saved ? <div className="photo-import-result" role="status">
          <strong>已匯入「{saved.name}」</strong>
          <p>你可以喺「已保存牌組」搵返呢副牌。</p>
          {hasDeckInEditor && <p>如有未保存的改動，可先按「完成」返回目前的牌組。</p>}
        </div> : !photo ? <div className="photo-import-upload" data-dragging={isDragging}
          onDragOver={event => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
          onDrop={event => { event.preventDefault(); setIsDragging(false); void loadPhoto(event.dataTransfer.files[0]); }}>
          <StudioIcon name="cards" />
          <strong>上傳一張完整牌組圖</strong>
          <p>可拖放或貼上 JPG、PNG、WebP。相片會喺瀏覽器內辨識。</p>
          <button className="studio-primary" type="button" onClick={() => fileInput.current?.click()}>選擇相片</button>
          {status && <p role="status">{status}</p>}
          {scanError && <p className="photo-import-error" role="alert">{scanError}</p>}
        </div> : <div className="photo-import-workspace">
          <aside className="photo-import-source" aria-label="原相片">
            <div className="photo-import-preview">
              <img src={photo.url} alt="上傳的牌組相片" />
              {editedRow?.rects.map((rect, index) => <span key={index} className="photo-import-highlight" style={regionPosition(rect, photo)} aria-hidden="true" />)}
            </div>
            <div className="photo-import-file">
              <span title={photo.name}>{photo.name}</span>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={saving}>更換相片</button>
            </div>
          </aside>
          <div className="photo-import-review" aria-label="核對辨識結果">
            {status ? <p className="photo-import-progress" role="status"><span />{status}</p> : <>
              {scanError && <div className="photo-import-message" role="status"><p>{scanError}</p>
                {rows.length === 0 && <button type="button" onClick={() => canvas.current && scan(canvas.current, scanGeneration.current)}>重試辨識</button>}
              </div>}
              <label className="photo-import-name">牌組名稱<input value={name} maxLength={60} onChange={event => setName(event.target.value)} disabled={saving} /></label>
              <div className="photo-import-totals" aria-label="牌組張數">
                {photoSections.map(({ id, label, limit }) => <div key={id} data-over={review.totals[id] > limit}>
                  <span>{label}</span><strong>{review.totals[id]} <small>/ {limit}</small></strong>
                </div>)}
              </div>
              {review.unresolved.size > 0 && <p className="photo-import-message" role="status">{review.unresolved.size} 項卡牌或張數待確認。</p>}
              {review.problems.length > 0 && <ul className="photo-import-message" role="alert">{review.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
              {photoSections.map(({ id, label, limit }) => <section className="photo-import-section" key={id} aria-label={label}>
                <div className="photo-import-section-head"><h3>{label}</h3>
                  <button type="button" onClick={() => addRow(id)} disabled={saving} aria-label={`新增${label}卡牌`}>＋ 新增</button>
                </div>
                {rows.filter(row => row.section === id).map(row => {
                  const selected = row.selected ? choices.get(row.selected) : undefined;
                  const candidate = selected || (row.suggested[0] ? choices.get(row.suggested[0]) : undefined);
                  const isEditing = editing === row.id;
                  return <div className="photo-import-entry" key={row.id} data-active={isEditing} data-pending={review.unresolved.has(row.id)}>
                    <div className="photo-import-row">
                      <button className="photo-import-card" type="button" aria-expanded={isEditing} disabled={saving}
                        onClick={() => edit(isEditing ? null : row.id)}>
                        <ChoiceArt choice={candidate} />
                        <span className="photo-import-card-text">
                          <strong>{selected?.name || "選擇卡牌"}</strong>
                          <small>{selected ? [selected.number, selected.stage, selected.label].filter(Boolean).join(" · ") : candidate ? `可能是 ${candidate.number}` : "搜尋卡號或卡名"}</small>
                          {row.defaulted && <small className="photo-import-default">採用預設版本</small>}
                        </span>
                        <span aria-hidden="true" className="photo-import-edit">{isEditing ? "⌃" : "›"}</span>
                      </button>
                      <label className="photo-import-quantity"><span className="sr-only">{selected?.number || label} 張數</span>
                        <input aria-invalid={row.count === null || !Number.isInteger(row.count) || row.count < 1 || row.count > limit} type="number" min="1" max={limit} step="1" inputMode="numeric"
                          placeholder="?" value={row.count ?? ""} disabled={saving} onChange={event => changeRow(row.id, { count: event.target.value === "" ? null : event.target.valueAsNumber })} />
                      </label>
                    </div>
                    {isEditing && <div className="photo-import-edit-panel">
                      <label className="photo-import-search"><StudioIcon name="search" />
                        <span className="sr-only">搜尋卡牌</span><input placeholder="搜尋卡號或卡名" value={query} onChange={event => setQuery(event.target.value)} disabled={saving} />
                      </label>
                      <div className="photo-import-edit-actions">
                        {row.rects.length > 0 && <button type="button" onClick={() => void recognizeCode(row)} disabled={readingCode || saving}>從相片讀取卡號</button>}
                        <button type="button" className="photo-import-remove" disabled={saving} onClick={() => { setRows(previous => previous.filter(item => item.id !== row.id)); edit(null); }}>移除此項</button>
                      </div>
                      {codeStatus && <p className="photo-import-code-status" role="status">{codeStatus}</p>}
                      <div className="photo-import-choices">
                        {suggestedChoices.map(choice => <button type="button" key={choice.key} aria-pressed={row.selected === choice.key} disabled={saving}
                          onClick={() => { changeRow(row.id, { selected: choice.key, defaulted: false }); edit(null); }}>
                          <ChoiceArt choice={choice} /><span><strong>{choice.name}</strong><small>{choice.number} · {choice.label}</small></span>
                        </button>)}
                      </div>
                      {query.trim() && !suggestedChoices.length && <p className="photo-import-code-status">找不到相符卡牌。</p>}
                    </div>}
                  </div>;
                })}
              </section>)}
            </>}
          </div>
        </div>}
      </div>
      <div className="photo-import-footer">
        {saveError && <p className="photo-import-error" role="alert">{saveError}</p>}
        <button type="button" onClick={requestClose} disabled={saving}>{saved ? "完成" : "取消"}</button>
        {saved ? <button className="studio-primary" type="button" onClick={() => onOpen(saved)}>開啟新牌組</button>
          : photo && <button className="studio-primary" type="button" onClick={() => void save()}
            disabled={Boolean(status) || !review.canSave || !validateDeckName(name) || saving}>{saving ? "匯入中…" : review.complete || !review.canSave ? "匯入新牌組" : "另存為牌組草稿"}</button>}
      </div>
    </div>
  </dialog>;
}
