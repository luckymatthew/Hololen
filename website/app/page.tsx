"use client";

import { readImportJson } from "../lib/import-json.mjs";
import { projectLegacyPrintings } from "../lib/printing-compatibility.mjs";
import { appFetch } from "@/lib/backend";
import { draftKey } from "@/lib/firebase/store";
import { content as deckContent } from "@/lib/firebase/merge.mjs";
import { firebaseBuild } from "@/lib/firebase/client";

import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { catalogCardTags, catalogPrintings, catalogTagOptions, filterCatalogPrintings, sortVariantsByRarity, variantLabel } from "@/lib/printing-catalog.mjs";
import { effectAuditPending } from '@/lib/effect-corrections.mjs';
import { catalogCardText, catalogEffectText as effectText, catalogKeywordLabel } from "@/lib/card-terminology.mjs";
import TerminologyNote from "@/app/TerminologyNote";
import OfficialJapaneseText from "@/app/OfficialJapaneseText";
import { officialCardTranslationReady } from "@/lib/official-card-translations.mjs";
import StudioIcon from "@/app/StudioIcon";
import { fromHoloSimDeck, isHoloSimDeck, toHoloSimDeck, toHoloSimFilename } from "@/lib/holosim-deck.mjs";
import { groupMemberOptions } from "@/lib/member-sort.mjs";
import StudioHeader from "@/app/StudioHeader";
import { SlidingTabs, StatusToast, useModalMotion } from "@/app/ui-motion";
import FoilCardImage from "@/app/FoilCardImage";
import ConfirmDialog from "@/app/ConfirmDialog";
import YuyuteiCardLink from "@/app/YuyuteiCardLink";
import { CardEffect, CardFact, CardSymbols } from "@/app/CardDetailRows";
import { printingReleaseStatus } from "@/lib/card-release-status.mjs";
import useJapanDate from "@/app/useJapanDate";
import type { SavedPhotoDeck } from "@/app/DeckPhotoImport";

const DeckPhotoImport = lazy(() => import("@/app/DeckPhotoImport"));

type CardGroup = "oshi" | "holomem" | "support" | "cheer";

type Skill = {
  timing?: string;
  name?: string;
  effect?: string;
};

type Art = {
  name: string;
  effect: string;
  damage: number | null;
  cost: string[];
  specialTargets: string[];
  specialValues: number[];
  damageModifier?: string;
};

type Card = {
  id: string;
  number: string;
  name: string;
  jpName: string;
  enName: string;
  group: CardGroup;
  type: string;
  typeCode: string;
  colors: string[];
  colorCodes: string[];
  stage: string;
  hp: number | null;
  life: number | null;
  rarity: string;
  set: string;
  sets: string[];
  tags: string[];
  illustrator: string;
  baton: number | null;
  image: string;
  variants: { id: string; rarity: string; image: string; sets?: string[]; officialImportSchema?: number; releaseDate?: string; preview?: boolean }[];
  abilityText: string;
  extra: string;
  keyword: (Skill & { type?: string }) | null;
  stageSkill?: Skill | null;
  oshiSkill: Skill | null;
  spOshiSkill: Skill | null;
  arts: Art[];
  qaCount: number;
  maxCopies: number;
  unlimited: boolean;
  restricted: boolean;
  preview: boolean;
  simOnly: boolean;
  releaseDate?: string;
  officialImportSchema?: number;
  effectLanguage?: string;
  translationStatus?: string;
  simulationStatus?: string;
};

type CatalogPrinting = {
  card: Card;
  variant: Card["variants"][number] | undefined;
  id: string;
  label: string;
  tags: { key: string; label: string }[];
  releaseDate: string;
  searchText: string;
};

type CardMeta = {
  snapshotDate: string;
  uniqueCards: number;
  sourceUniqueCards: number;
  printings: number;
  note: string;
  latestRelease?: string;
};

type CardPayload = { meta: CardMeta; cards: Card[] };
type DeckSection = "oshi" | "main" | "cheer";
type PrintingState = Record<string, Record<string, number>>;
type DeckState = Record<DeckSection, Record<string, number>> & { printings?: PrintingState };
type HoloSimCardIndex = Record<string, string[]>;

const emptyDeck = (): DeckState => ({ oshi: {}, main: {}, cheer: {} });
const storageKey = "hololive-ocg-deck-draft-v1";

function defaultVariant(card: Card) {
  return sortVariantsByRarity(card.variants)[0];
}

function cardDeckCount(deck: DeckState, card: Card) {
  return deck[cardSection(card)][card.number] || 0;
}

function normalizedPrintingCounts(deck: DeckState, card: Card) {
  const total = cardDeckCount(deck, card);
  const knownIds = new Set(card.variants.map((variant) => variant.id));
  const result: Record<string, number> = {};
  let allocated = 0;
  for (const [variantId, rawCount] of Object.entries(deck.printings?.[card.number] || {})) {
    const count = Math.max(0, Math.min(total - allocated, Number(rawCount) || 0));
    if (knownIds.has(variantId) && count > 0) {
      result[variantId] = count;
      allocated += count;
    }
  }
  const fallback = defaultVariant(card);
  if (fallback && allocated < total) result[fallback.id] = (result[fallback.id] || 0) + total - allocated;
  return result;
}

const typeOptions: { value: "all" | CardGroup; label: string }[] = [
  { value: "all", label: "全部卡種" },
  { value: "oshi", label: "主推成員" },
  { value: "holomem", label: "成員" },
  { value: "support", label: "支援卡" },
  { value: "cheer", label: "能量" },
];

const colorOptions = [
  ["all", "全部顏色"],
  ["white", "白"],
  ["green", "綠"],
  ["red", "紅"],
  ["blue", "藍"],
  ["purple", "紫"],
  ["yellow", "黃"],
] as const;

const stageOptions = [
  ["all", "全部階級"],
  ["Debut", "Debut"],
  ["1st", "1st"],
  ["2nd", "2nd"],
  ["Spot", "Spot"],
] as const;

function countSection(section: Record<string, number>) {
  return Object.values(section).reduce((sum, count) => sum + count, 0);
}

function cardSection(card: Card): DeckSection {
  if (card.group === "oshi") return "oshi";
  if (card.group === "cheer") return "cheer";
  return "main";
}

function shortEffect(card: Card) {
  return effectText(card, (
    card.oshiSkill?.effect ||
    card.spOshiSkill?.effect ||
    card.keyword?.effect ||
    card.abilityText ||
    card.arts.find((art) => art.effect)?.effect ||
    card.extra ||
    "無額外效果。"
  ));
}

function CardImage({ card, className = "", rarity }: { card: Card; className?: string; rarity?: string }) {
  const [failedImage, setFailedImage] = useState("");

  if (!card.image || failedImage === card.image) {
    return (
      <div className={`card-image-fallback ${className}`}>
        <span>{card.number}</span>
        <strong>{effectText(card, card.name)}</strong>
      </div>
    );
  }

  return (
    <FoilCardImage
      className={className}
      src={card.image}
      alt={`${effectText(card, card.name)} ${card.number} 卡圖`}
      rarity={rarity || card.rarity}
      loading="lazy"
      onError={() => setFailedImage(card.image)}
    />
  );
}

function CardModal({
  card,
  onClose,
  onTagSelect,
  onAdd,
  onRemove,
  quantity,
  quantityForVariant,
  initialVariantId,
  japanDate,
}: {
  card: Card;
  onClose: () => void;
  onTagSelect?: (tag: string) => void;
  onAdd: (card: Card, variantId?: string) => void;
  onRemove: (card: Card, variantId?: string) => void;
  quantity: number;
  quantityForVariant: (variantId: string) => number;
  initialVariantId?: string;
  japanDate?: string;
}) {
  const translatedOfficial = officialCardTranslationReady(card);
  const officialFallback = card.officialImportSchema === 2 && card.effectLanguage === "ja" && card.translationStatus === "official-japanese-fallback" && !translatedOfficial;
  const aiTranslation = !officialFallback && (translatedOfficial || card.number.startsWith("hBP09-"));
  const auditNote = (effectAuditPending as Record<string, string>)[card.number];
  const displayEffect = (value?: string) => officialFallback ? String(value ?? "") : effectText(card, value);
  const sortedVariants = useMemo(() => sortVariantsByRarity(card.variants), [card.variants]);
  const initialVariant = sortedVariants[0];
  const selectedVariant = sortedVariants.find((variant: Card["variants"][number]) => variant.id === initialVariantId) ?? initialVariant;
  const { officialPreview, preview, releaseDate: previewReleaseDate } = printingReleaseStatus(card, selectedVariant, japanDate);
  const selectedImage = selectedVariant?.image ?? card.image;
  const selectedQuantity = selectedVariant ? quantityForVariant(selectedVariant.id) : quantity;
  const tagOnClose = useRef("");
  const { dialog, requestClose } = useModalMotion(() => {
    if (tagOnClose.current) onTagSelect?.(tagOnClose.current);
    onClose();
  });
  const tags = catalogCardTags(card);
  const name = displayEffect(card.name);
  const type = catalogCardText(card.type);
  const originalName = card.jpName && card.jpName !== name ? card.jpName : card.enName !== name ? card.enName : "";
  const products = selectedVariant?.sets?.length ? selectedVariant.sets : card.sets?.length ? card.sets : card.set ? [card.set] : [];
  const skillRows = [
    { label: "主推舞台技能", skill: card.stageSkill, kind: "skill" },
    { label: "主推技能", skill: card.oshiSkill, kind: "skill" },
    { label: "SP 主推技能", skill: card.spOshiSkill, kind: "sp" },
    { label: catalogKeywordLabel(card.keyword?.type), skill: card.keyword, kind: "keyword" },
  ] as const;

  return (
    <dialog ref={dialog} className="studio-card-dialog t-modal card-reader-dialog" onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => { if (event.target === event.currentTarget) requestClose(); }} data-card-number={card.number} data-printing-id={selectedVariant?.id} aria-label={`${name}${selectedVariant ? ` ${variantLabel(selectedVariant, sortedVariants)} 版本` : ""}卡片詳情`}>
      <div className="card-reader-frame">
        <button className="modal-close" type="button" onClick={requestClose} aria-label="關閉卡片詳情">×</button>
        <section className="card-modal card-reader-panel">
          <div className="card-reader-artwork">
            <CardImage card={{ ...card, image: selectedImage }} className="modal-card-image" rarity={selectedVariant?.rarity || card.rarity} />
          </div>
          <div className="card-reader-info">
            <header className="card-reader-title">
              <h2>{name}</h2>
              {originalName && <p>{originalName}</p>}
              {preview && <span className="preview-badge" role={officialPreview && previewReleaseDate ? "note" : undefined}>
                {officialPreview ? `官方先行公開${previewReleaseDate ? `・${previewReleaseDate} 發售` : ""}` : "HoloSim 先行卡"}
              </span>}
            </header>
            <dl className="card-reader-facts">
              <CardFact label="卡片類型">{card.group === "support" && type !== "支援卡" ? `支援卡・${type}` : type}</CardFact>
              {tags.length > 0 && <CardFact label="標籤"><div className="card-reader-tags">{tags.map(tag => onTagSelect ? (
                <button key={tag.key} type="button" aria-label={`以 ${tag.label} 篩選卡片`} onClick={() => { tagOnClose.current = tag.key; requestClose(); }}>{tag.label}</button>
              ) : <span key={tag.key}>{tag.label}</span>)}</div></CardFact>}
              <CardFact label="稀有度">{selectedVariant?.rarity || card.rarity || "—"}</CardFact>
              {products.length > 0 && <CardFact label="收錄商品">{products.join(" · ")}</CardFact>}
            </dl>
            {(card.colors.length > 0 || card.hp !== null || card.life !== null || card.stage || card.baton !== null) && <dl className="card-reader-stats" aria-label="卡片數值">
              {card.colors.length > 0 && <CardFact label="顏色"><CardSymbols kind="type" values={card.colors} /></CardFact>}
              {card.hp !== null && <CardFact label="HP">{card.hp}</CardFact>}
              {card.life !== null && <CardFact label="Life">{card.life}</CardFact>}
              {card.stage && <CardFact label="Bloom 階級">{card.stage}</CardFact>}
              {card.baton !== null && <CardFact label="接棒">{card.baton ? <span aria-label={`${card.baton} 點能量`} role="img"><CardSymbols values={Array(card.baton).fill("無色")} /></span> : 0}</CardFact>}
            </dl>}
            <div className="card-reader-effects">
              <h3 className={`effect-heading ${officialFallback ? "card-reader-language" : "sr-only"}`}>{officialFallback ? "官方日文效果" : "效果"}</h3>
              {skillRows.map(({ label, skill, kind }) => (skill?.name || skill?.effect) && (
                <CardEffect label={label} kind={kind} key={label} title={skill.name || skill.timing ? <>
                  {skill.timing && <span className="card-reader-timing">{displayEffect(skill.timing)}</span>}
                  {displayEffect(skill.name)}
                </> : undefined}>{displayEffect(skill.effect)}</CardEffect>
              ))}
              {card.abilityText && <CardEffect label="卡片效果">{displayEffect(card.abilityText)}</CardEffect>}
              {card.arts.map((art, index) => <CardEffect label="Arts" kind="art" key={`${art.name}-${index}`} title={<>
                <CardSymbols values={art.cost} />
                <span>{displayEffect(art.name) || `Arts ${index + 1}`}</span>
                {art.damage !== null && <b className="card-reader-damage">{art.damage}{art.damageModifier}</b>}
                {art.specialValues.map((bonus, i) => <span className="card-reader-bonus" title="特攻" key={i}>
                  {art.specialTargets[i] && <CardSymbols values={[art.specialTargets[i]]} />}＋{bonus}
                </span>)}
              </>}>{displayEffect(art.effect)}</CardEffect>)}
              {card.extra && <CardEffect label="Extra" kind="extra">{displayEffect(card.extra)}</CardEffect>}
            </div>
            <div className="card-reader-reference">
              <div className="card-reader-meta">
                <span>卡號：<code>{card.number}</code></span>
                {previewReleaseDate && !officialPreview && <span data-card-release-date>發售日期：{previewReleaseDate}</span>}
                {card.illustrator && <span>繪師：{card.illustrator}</span>}
                {card.qaCount > 0 && <span>官方 Q&amp;A · {card.qaCount} 條</span>}
              </div>
              <YuyuteiCardLink cardNumber={card.number} imageUrl={selectedImage} />
              {(aiTranslation || (card.officialImportSchema === 2 && card.simulationStatus === "not-audited")) && <div className="card-reader-notes">
                {aiTranslation && <p role="note" data-card-translation-note>AI 翻譯，未經人工覆核。</p>}
                {card.officialImportSchema === 2 && card.simulationStatus === "not-audited" && <p role="note" data-card-import-warning>不適用自動對戰。</p>}
              </div>}
              {translatedOfficial && <OfficialJapaneseText card={card} />}
              {auditNote && <details className="terminology-note"><summary>校對說明</summary><p>{auditNote}</p></details>}
              <TerminologyNote />
              {selectedVariant && <details className="terminology-note"><summary>卡圖資訊</summary><p>卡圖 ID：<code>{selectedVariant.id}</code></p></details>}
            </div>
          </div>
        </section>
        <div className="modal-quantity-controls card-reader-actions">
          <button className="remove-large" type="button" disabled={selectedQuantity === 0} onClick={() => onRemove(card, selectedVariant?.id)} aria-label={`減少 ${displayEffect(card.name)} 所選版本`}>− 減少一張</button>
          <output aria-live="polite">此版本 {selectedQuantity} 張 · 合計 {quantity} 張</output>
          <button className="add-large" type="button" onClick={() => onAdd(card, selectedVariant?.id)}>
            {selectedVariant ? `＋ 加入 ${variantLabel(selectedVariant, sortedVariants)} 版本${selectedQuantity ? ` · 此版本 ${selectedQuantity}` : ""}` : quantity > 0 ? `加入牌組 · 現有 ${quantity}` : "＋ 加入牌組"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function Home() {
  const japanDate = useJapanDate();
  const [cards, setCards] = useState<Card[]>([]);
  const [meta, setMeta] = useState<CardMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchInput = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = useState<"library" | "deck">("library");
  const [onlyDeck, setOnlyDeck] = useState(false);
  const [clearRequested, setClearRequested] = useState(false);
  const [photoImportOpen, setPhotoImportOpen] = useState(false);
  const [view, setView] = useState<"gallery" | "list">("gallery");
  const [sort, setSort] = useState("number");
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFiltersOpen(window.matchMedia('(min-width: 901px)').matches));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const [typeFilter, setTypeFilter] = useState<"all" | CardGroup>("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(72);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeVariantId, setActiveVariantId] = useState("");
  const [rawDeck, setRawDeck] = useState<DeckState>(emptyDeck);
  const deck: DeckState = useMemo(() => projectLegacyPrintings(rawDeck), [rawDeck]);
  // Reading an old deck must not rewrite its durable draft. Explicit edits work
  // on the corrected projection; saved records change only when the user saves.
  const setDeck = (next: DeckState | ((previous: DeckState) => DeckState)) =>
    setRawDeck(previous => typeof next === "function" ? next(projectLegacyPrintings(previous)) : next);
  const [deckReady, setDeckReady] = useState(false);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [editorBase, setEditorBase] = useState("");
  const [draftStorageKey] = useState(() => firebaseBuild ? draftKey() : storageKey);
  const [deckName, setDeckName] = useState("未命名牌組");
  const [savedDeckChecked, setSavedDeckChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holoSimIndex, setHoloSimIndex] = useState<HoloSimCardIndex>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([
      appFetch("/cards.json").then((response) => {
        if (!response.ok) throw new Error("卡片資料讀取失敗");
        return response.json() as Promise<CardPayload>;
      }),
      appFetch("/holosim-card-index.json").then((response) => response.ok ? response.json() as Promise<HoloSimCardIndex> : {}),
    ])
      .then(([payload, simIndex]) => {
        setCards(payload.cards);
        setMeta(payload.meta);
        setHoloSimIndex(simIndex);
      })
      .catch(() => setLoadError("暫時無法載入卡庫，請重新整理頁面。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(draftStorageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the browser-only draft after mount
      if (stored) setDeck(JSON.parse(stored) as DeckState);
      if (window.location.pathname === "/deck") setWorkspace("deck");
    } catch {
      setDeck(emptyDeck());
    } finally {
      setDeckReady(true);
    }
  }, []);

  useEffect(() => {
    if (deckReady) { try { window.localStorage.setItem(draftStorageKey, JSON.stringify(rawDeck)); } catch { setNotice("儲存空間不足，請立即匯出牌組備份。"); } }
  }, [rawDeck, deckReady]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination whenever the filter contract changes
    setVisibleCount(72);
  }, [query, typeFilter, colorFilter, stageFilter, setFilter, memberFilter, tagFilter, sort]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !activeCard && !photoImportOpen && !target.closest("input, textarea, select, [contenteditable='true']")) {
        event.preventDefault(); setWorkspace("library");
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard, photoImportOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.number, card])), [cards]);

  useEffect(() => {
    if (!deckReady || cards.length === 0 || savedDeckChecked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guard the one-time URL deck lookup
    setSavedDeckChecked(true);
    const id = new URLSearchParams(window.location.search).get("deck");
    if (!id) return;
    setWorkspace("deck");
    appFetch(`/api/decks/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (response.status === 401) {
          window.location.href = `/account?return_to=${encodeURIComponent(`/?deck=${id}`)}`;
          return null;
        }
        if (!response.ok) throw new Error("load failed");
        return response.json();
      })
      .then((payload) => {
        if (!payload?.deck) return;
        setDeck(payload.deck.deck as DeckState);
        setDeckName(payload.deck.name);
        setActiveDeckId(payload.deck.id);
        setEditorBase(deckContent(payload.deck));
        setNotice(`已載入「${payload.deck.name}」。`);
      })
      .catch(() => setNotice("無法載入這副雲端牌組。"));
  }, [cards.length, deckReady, savedDeckChecked]);

  const setOptions = useMemo(() => {
    const prefixes = new Set(cards.map((card) => card.number.split("-")[0]));
    return [...prefixes].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  }, [cards]);

  const memberGroups = useMemo(() => groupMemberOptions(cards) as { key: string; label: string; options: { value: string; label: string }[] }[], [cards]);

  const printings = useMemo<CatalogPrinting[]>(() => catalogPrintings(cards), [cards]);
  const tagOptions = useMemo(() => catalogTagOptions(printings), [printings]);
  const filteredCards = useMemo<CatalogPrinting[]>(() => filterCatalogPrintings(printings, {
    type: typeFilter, color: colorFilter, stage: stageFilter, set: setFilter,
    member: memberFilter, tag: tagFilter, query: deferredQuery, sort,
  }), [printings, colorFilter, memberFilter, deferredQuery, setFilter, stageFilter, tagFilter, typeFilter, sort]);

  const activeFilters = [
    ...(query ? [{ label: `搜尋：${query}`, clear: () => setQuery("") }] : []),
    ...(memberFilter !== "all" ? [{ label: cards.find(card => card.jpName === memberFilter || card.name === memberFilter)?.name || memberFilter, clear: () => setMemberFilter("all") }] : []),
    ...(typeFilter !== "all" ? [{ label: typeOptions.find(option => option.value === typeFilter)?.label || typeFilter, clear: () => setTypeFilter("all") }] : []),
    ...(colorFilter !== "all" ? [{ label: colorOptions.find(option => option[0] === colorFilter)?.[1] || colorFilter, clear: () => setColorFilter("all") }] : []),
    ...(stageFilter !== "all" ? [{ label: stageFilter, clear: () => setStageFilter("all") }] : []),
    ...(setFilter !== "all" ? [{ label: setFilter, clear: () => setSetFilter("all") }] : []),
    ...(tagFilter ? [{ label: `標籤：${tagOptions.find(tag => tag.key === tagFilter)?.label || tagFilter}`, clear: () => setTagFilter("") }] : []),
  ];
  const resetFilters = () => { setQuery(""); setMemberFilter("all"); setTypeFilter("all"); setColorFilter("all"); setStageFilter("all"); setSetFilter("all"); setTagFilter(""); setOnlyDeck(false); };
  const browseTag = (tag: string) => {
    resetFilters();
    setTagFilter(tag);
    setVisibleCount(72);
    setWorkspace("library");
    requestAnimationFrame(() => document.getElementById("library")?.focus());
  };

  const oshiCount = countSection(deck.oshi);
  const mainCount = countSection(deck.main);
  const cheerCount = countSection(deck.cheer);

  const quantityFor = (card: Card) => cardDeckCount(deck, card);
  const quantityForVariant = (card: Card, variantId: string) => normalizedPrintingCounts(deck, card)[variantId] || 0;
  const catalogCards = filteredCards.filter(({ card, variant }) => !onlyDeck || (variant ? quantityForVariant(card, variant.id) : quantityFor(card)) > 0);
  const artworkCount = catalogCards.filter(({ variant }) => variant).length;
  const imagelessCount = catalogCards.length - artworkCount;

  const addCard = (card: Card, requestedVariantId?: string) => {
    const section = cardSection(card);
    const currentSection = deck[section];
    const currentCount = currentSection[card.number] || 0;
    const selectedVariant = card.variants.find((variant) => variant.id === requestedVariantId) || defaultVariant(card);
    if (section === "main" && mainCount >= 50) {
      setNotice("主牌組已達 50 張，請先移除卡片。");
      return;
    }
    if (section === "cheer" && cheerCount >= 20) {
      setNotice("能量牌組已達 20 張。");
      return;
    }
    if (section !== "oshi" && currentCount >= card.maxCopies) {
      setNotice(card.restricted ? "這是限制卡，牌組最多 1 張。" : `同卡號最多 ${card.maxCopies} 張。`);
      return;
    }
    setDeck((previous) => ({
      ...(() => {
        // Validate the latest state as well as the visible snapshot: rapid adds
        // across different printings still share one card-number/section limit.
        if (section !== "oshi" && ((previous[section][card.number] || 0) >= card.maxCopies
          || (section === "main" && countSection(previous.main) >= 50)
          || (section === "cheer" && countSection(previous.cheer) >= 20))) return previous;
        const printings = { ...(previous.printings || {}) };
        if (section === "oshi") {
          Object.keys(previous.oshi).forEach((number) => delete printings[number]);
          if (selectedVariant) printings[card.number] = { [selectedVariant.id]: 1 };
          return { ...previous, oshi: { [card.number]: 1 }, printings };
        }
        const allocations = normalizedPrintingCounts(previous, card);
        if (selectedVariant) allocations[selectedVariant.id] = (allocations[selectedVariant.id] || 0) + 1;
        if (Object.keys(allocations).length > 0) printings[card.number] = allocations;
        return { ...previous, [section]: { ...previous[section], [card.number]: (previous[section][card.number] || 0) + 1 }, printings };
      })(),
    }));
  };

  const changePrintingQuantity = (section: DeckSection, number: string, variantId: string, delta: number) => {
    const card = cardMap.get(number);
    if (!card) return;
    if (delta > 0) {
      addCard(card, variantId);
      return;
    }
    setDeck((previous) => {
      const current = previous[section][number] || 0;
      if (current <= 0) return previous;
      const allocations = normalizedPrintingCounts(previous, card);
      const removalId = variantId || Object.keys(allocations).find(id => allocations[id] > 0);
      if (removalId && Number(allocations[removalId] || 0) <= 0) return previous;
      const nextSection = { ...previous[section] };
      const next = current - 1;
      if (next <= 0) delete nextSection[number];
      else nextSection[number] = next;
      const printings = { ...(previous.printings || {}) };
      if (removalId && allocations[removalId]) {
        allocations[removalId] -= 1;
        if (allocations[removalId] <= 0) delete allocations[removalId];
      }
      if (next <= 0 || Object.keys(allocations).length === 0) delete printings[number];
      else printings[number] = allocations;
      return { ...previous, [section]: nextSection, printings };
    });
  };

  const removeCard = (card: Card, variantId?: string) => {
    const allocations = normalizedPrintingCounts(deck, card);
    const heldIds = Object.keys(allocations).filter(id => allocations[id] > 0);
    if (!variantId && heldIds.length > 1) {
      setActiveVariantId(heldIds[0]);
      setActiveCard(card);
      return;
    }
    changePrintingQuantity(cardSection(card), card.number, variantId || heldIds[0] || "", -1);
  };

  const openCard = (card: Card, variantId?: string) => {
    setActiveVariantId(variantId || "");
    setActiveCard(card);
  };

  const clearDeck = () => {
    setClearRequested(false);
    setDeck(emptyDeck());
    setActiveDeckId(null);
    setEditorBase("");
    setDeckName("未命名牌組");
    window.history.replaceState({}, "", "/");
    setNotice("牌組已清空。");
  };

  const saveDeck = async () => {
    if (!activeDeckId && oshiCount + mainCount + cheerCount === 0) {
      setNotice("請先加入卡片再保存牌組。");
      return;
    }
    const proposedName = deckName.trim();
    if (!proposedName) {
      setNotice("請先輸入牌組名稱。");
      return;
    }
    setDeckName(proposedName);
    setSaving(true);
    try {
      const response = await appFetch(activeDeckId ? `/api/decks/${encodeURIComponent(activeDeckId)}` : "/api/decks", {
        method: activeDeckId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: proposedName, deck, ...(firebaseBuild && activeDeckId ? { _editorBase: editorBase } : {}) }),
      });
      if (response.status === 401) {
        window.location.href = "/account?return_to=/";
        return;
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失敗");
      setActiveDeckId(payload.deck.id);
      setEditorBase(deckContent(payload.deck));
      setDeckName(payload.deck.name);
      // A successful explicit save commits this projection, unless a newer edit
      // was made while the save was in flight.
      setRawDeck(previous => previous === rawDeck ? deck : previous);
      window.history.replaceState({}, "", `/?deck=${encodeURIComponent(payload.deck.id)}`);
      setNotice(firebaseBuild ? `「${payload.deck.name}」已保存在此裝置；登入後會同步。` : `「${payload.deck.name}」已保存到你的帳號。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "牌組保存失敗，請稍後再試。");
    } finally {
      setSaving(false);
    }
  };

  const exportDeck = () => {
    const proposedName = deckName.trim();
    if (!proposedName) {
      setNotice("請先輸入牌組名稱再匯出。");
      return;
    }
    const result = toHoloSimDeck(deck, holoSimIndex);
    if (result.unsupported.length > 0) {
      setNotice(`HoloSim 1.13 尚未支援：${result.unsupported.join("、")}。請先更換這些卡再匯出。`);
      return;
    }
    // HoloSim reads the canonical number fields; our optional allocation metadata
    // lets a round trip restore the exact artwork without changing those fields.
    const exportedDeck = { ...result.deck, ...(deck.printings && Object.keys(deck.printings).length > 0 ? { printings: deck.printings } : {}) };
    const blob = new Blob([JSON.stringify(exportedDeck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = toHoloSimFilename(proposedName);
    link.click();
    URL.revokeObjectURL(url);
    setNotice(deckValid ? "已匯出。請將檔案放入 HoloSim 1.13 的 decks 資料夾。" : "已匯出；未完成的牌組可能無法在 HoloSim 開啟。");
  };

  const importDeck = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await readImportJson(file);
      const incoming = projectLegacyPrintings(isHoloSimDeck(parsed) ? { ...fromHoloSimDeck(parsed), printings: parsed.printings } : parsed.deck || parsed);
      if (!incoming.oshi || !incoming.main || !incoming.cheer) throw new Error("invalid");
      const next = emptyDeck();
      let skippedCards = 0;
      for (const section of ["oshi", "main", "cheer"] as DeckSection[]) {
        for (const [number, rawCount] of Object.entries(incoming[section] as Record<string, number>)) {
          const card = cardMap.get(number);
          if (!card) {
            skippedCards += Number(rawCount) || 1;
            continue;
          }
          const count = Math.max(0, Math.min(card.maxCopies, Number(rawCount) || 0));
          if (count > 0) next[section][number] = count;
        }
      }
      if (incoming.printings && typeof incoming.printings === "object") {
        const printings: PrintingState = {};
        for (const [number, rawAllocation] of Object.entries(incoming.printings as PrintingState)) {
          const card = cardMap.get(number);
          const total = next.oshi[number] || next.main[number] || next.cheer[number] || 0;
          if (!card || total <= 0 || !rawAllocation || typeof rawAllocation !== "object") continue;
          const knownIds = new Set(card.variants.map((variant) => variant.id));
          const allocation: Record<string, number> = {};
          let allocated = 0;
          for (const [variantId, rawVariantCount] of Object.entries(rawAllocation)) {
            const variantCount = Math.max(0, Math.min(total - allocated, Number(rawVariantCount) || 0));
            if (knownIds.has(variantId) && variantCount > 0) {
              allocation[variantId] = variantCount;
              allocated += variantCount;
            }
          }
          if (Object.keys(allocation).length > 0) printings[number] = allocation;
        }
        if (Object.keys(printings).length > 0) next.printings = printings;
      }
      setDeck(next);
      setActiveDeckId(null);
      setDeckName(file.name.replace(/\.json$/i, "") || "匯入牌組");
      window.history.replaceState({}, "", "/");
      setNotice(skippedCards > 0 ? `HoloSim 牌組已匯入；略過 ${skippedCards} 張卡庫中不存在的卡。` : "HoloSim 牌組已匯入並完成卡號檢查。");
    } catch (error) {
      setNotice(error instanceof Error && error.message !== "invalid" ? error.message : "無法讀取這個牌組檔案。");
    }
  };

  const openPhotoDeck = (saved: SavedPhotoDeck) => {
    setDeck(saved.deck);
    setDeckName(saved.name);
    setActiveDeckId(saved.id);
    setEditorBase(deckContent(saved));
    setWorkspace("deck");
    setPhotoImportOpen(false);
    window.history.replaceState({}, "", `/?deck=${encodeURIComponent(saved.id)}`);
    setNotice(`已開啟「${saved.name}」。`);
  };

  const invalidCopies = (Object.entries(deck.main) as [string, number][]).filter(([number, count]) => {
    const card = cardMap.get(number);
    return card && count > card.maxCopies;
  });
  const deckValid = oshiCount === 1 && mainCount === 50 && cheerCount === 20 && invalidCopies.length === 0;

  const deckRows = (section: DeckSection) =>
    Object.entries(deck[section])
      .flatMap(([number, count]) => {
        const card = cardMap.get(number);
        if (!card) return [];
        const variants = sortVariantsByRarity(card.variants);
        const allocations = normalizedPrintingCounts(deck, card);
        const rows = Object.entries(allocations).map(([variantId, variantCount]) => ({ card, count: variantCount, variant: variants.find((variant) => variant.id === variantId) }));
        return rows.length > 0 ? rows : [{ card, count, variant: undefined }];
      })
      .sort((a, b) => a.card.number.localeCompare(b.card.number, "en", { numeric: true }) || (a.variant?.id || "").localeCompare(b.variant?.id || "", "en", { numeric: true }));

  return (
    <main className="studio-page" id="top">
      <a className="skip-link" href={workspace === "library" ? "#library" : "#deck-workbench"}>跳至主要內容</a>
      <StudioHeader current={workspace} draftCount={oshiCount + mainCount + cheerCount} onWorkspace={setWorkspace} />

      <div className="studio-masthead">
        <h1>{workspace === "library" ? "卡片圖鑑" : "牌組工房"}</h1>
        <div className="studio-masthead-actions">
          {workspace === "library" && <div className="catalog-snapshot"><strong>{meta ? `${meta.uniqueCards.toLocaleString()} 卡號 / ${meta.printings.toLocaleString()} 卡圖` : '正在整理卡庫'}</strong><span>資料快照 {meta?.snapshotDate || '載入中…'}</span></div>}
          <button type="button" className="studio-primary" onClick={() => setWorkspace(workspace === "library" ? "deck" : "library")}><StudioIcon name={workspace === "library" ? "cards" : "search"} />{workspace === "library" ? `編輯牌組 · ${oshiCount + mainCount + cheerCount} 張` : "去卡庫加卡"}</button>
        </div>
      </div>

      <section className="deck-workbench" id="deck-workbench" aria-label="牌組構築器" hidden={workspace !== "deck"} tabIndex={-1}>
        {deck !== rawDeck && <p role="status">舊版應援 S 卡圖已按官方卡號顯示；原始已存牌組未改動，編輯或保存時會使用更正後的卡號。</p>}
        <div className="deck-workbench-head">
          <div>
            <label className="deck-name-field">
              <span>牌組名稱</span>
              <input
                type="text"
                value={deckName}
                maxLength={60}
                onChange={(event) => setDeckName(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="deck-name-help"
              />
            </label>
            <p id="deck-name-help">草稿自動儲存於此裝置。</p>
          </div>
          <span className={deckValid ? "valid" : ""}>{deckValid ? "牌組可用" : `${oshiCount + mainCount + cheerCount}/71`}</span>
        </div>
        <div className="validation-grid">
          <div className={oshiCount === 1 ? "ok" : ""}><span>主推成員</span><b>{oshiCount}/1</b></div>
          <div className={mainCount === 50 ? "ok" : ""}><span>主牌</span><b>{mainCount}/50</b></div>
          <div className={cheerCount === 20 ? "ok" : ""}><span>能量</span><b>{cheerCount}/20</b></div>
        </div>
        <div className={`deck-status ${deckValid ? "ok" : ""}`}>
          <span>{deckValid ? "✓" : "!"}</span>
          <p><b>{deckValid ? "牌組張數完整" : "牌組尚未完成"}</b></p>
        </div>

        <div className="deck-gallery">
          {(["oshi", "main", "cheer"] as DeckSection[]).map((section) => {
            const rows = deckRows(section);
            const title = section === "oshi" ? "主推成員" : section === "main" ? "主牌組" : "能量牌組";
            const count = section === "oshi" ? oshiCount : section === "main" ? mainCount : cheerCount;
            return (
              <section className="deck-section" key={section}>
                <div className="deck-section-title"><h3>{title}</h3><span>{count} 張</span></div>
                {rows.length === 0 ? (
                  <button className="deck-empty" type="button" onClick={() => { resetFilters(); setTypeFilter(section === "oshi" ? "oshi" : section === "cheer" ? "cheer" : "all"); setWorkspace("library"); }}>＋ 到卡庫選擇{title}</button>
                ) : (
                  <div className="deck-card-grid">
                    {rows.map(({ card, count: rowCount, variant }) => (
                      <article className="deck-card-tile" key={`${card.number}-${variant?.id || "default"}`}>
                        <button className="deck-card-open" type="button" onClick={() => openCard(card, variant?.id)} aria-label={`查看 ${effectText(card, card.name)} ${variant?.rarity || ""} 卡牌`}>
                          <span className="deck-card-art"><CardImage card={{ ...card, image: variant?.image || card.image }} className="deck-card-thumb" rarity={variant?.rarity || card.rarity} /><b>×{rowCount}</b>{variant && <em>{variantLabel(variant, sortVariantsByRarity(card.variants))}</em>}</span>
                          <span className="deck-card-copy">
                            <code>{card.number}</code>
                            <strong>{effectText(card, card.name)}</strong>
                            {card.jpName && card.jpName !== effectText(card, card.name) && <span className="deck-card-original">{card.jpName}</span>}
                          </span>
                        </button>
                        <div className="stepper">
                          <button type="button" onClick={() => changePrintingQuantity(section, card.number, variant?.id || "", -1)} aria-label={`減少 ${effectText(card, card.name)} ${variant?.rarity || ""}版本`}>−</button>
                          <b aria-live="polite">{rowCount}</b>
                          <button type="button" onClick={() => changePrintingQuantity(section, card.number, variant?.id || "", 1)} aria-label={`增加 ${effectText(card, card.name)} ${variant?.rarity || ""}版本`}>＋</button>
                          <button className="deck-card-details" type="button" aria-label={`查看 ${effectText(card, card.name)} 詳情`} onClick={() => { setActiveVariantId(variant?.id || ""); setActiveCard(card); }}>詳情</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="deck-actions">
          <button className="save-button" type="button" onClick={() => void saveDeck()} disabled={saving}>{saving ? "保存中…" : activeDeckId ? "更新保存" : firebaseBuild ? "保存牌組" : "雲端儲存"}</button>
          <button className="export-button" type="button" onClick={exportDeck}>匯出 HoloSim 1.13 JSON</button>
          <a className="saved-decks-link simulator-deck-link" href="/simulator">用這副牌組開私人房間 →</a>
          <button className="photo-import-trigger" type="button" aria-haspopup="dialog" onClick={() => setPhotoImportOpen(true)}
            disabled={!deckReady || !cards.length || saving}><StudioIcon name="scan" />從相片匯入</button>
          <label className="import-button">匯入 JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importDeck(event.target.files?.[0]); event.target.value = ""; }} /></label>
          <button className="clear-button" type="button" onClick={() => setClearRequested(true)}>清空</button>
          <a className="saved-decks-link" href="/account">查看已保存牌組 →</a>
        </div>
      </section>

      <section className="catalog-panel" id="library" hidden={workspace !== "library"} tabIndex={-1} aria-label="完整卡庫">

          <div className="search-panel" role="search" aria-label="搜尋及篩選卡片">
            <div className="studio-search-row">
            <label className="searchbox">
              <StudioIcon name="search" />
              <span className="sr-only">搜尋卡片</span>
              <input
                ref={searchInput}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="卡號、成員、標籤或效果…"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
              {!query && <kbd>/</kbd>}
            </label>
            <button className="studio-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="advanced-filters" onClick={() => setFiltersOpen(value => !value)}><StudioIcon name="filter" />篩選{activeFilters.length > 0 && <b>{activeFilters.length}</b>}</button>
            </div>
            <SlidingTabs className="studio-type-tabs" label="卡片種類" selected={typeFilter}>
              {typeOptions.map(option => <button key={option.value} className="t-tab" type="button" aria-pressed={typeFilter === option.value} onClick={() => setTypeFilter(option.value as typeof typeFilter)}>{option.value === "all" ? "全部" : option.label}</button>)}
            </SlidingTabs>

          </div>

          <div className="catalog-layout" data-filters-open={filtersOpen}>
            <aside className="catalog-filter-rail t-acc" data-open={filtersOpen} aria-label="卡片篩選">
              <div className="t-acc-panel" id="advanced-filters" inert={!filtersOpen}><div className="t-acc-panel-inner"><div className="filter-rail-content">
                <div className="filter-rail-heading"><h2>篩選卡片</h2><button type="button" onClick={resetFilters}>重設</button></div>
            <div className="filter-grid">
              <label><span>成員（依分部・世代）</span><select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="all">全部成員</option>{memberGroups.map((group) => <optgroup label={group.label} key={group.key}>{group.options.map((member) => <option value={member.value} key={member.value}>{member.label}</option>)}</optgroup>)}</select></label>
              <label><span>顏色</span><select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)}>{colorOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>階級</span><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>{stageOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>系列</span><select value={setFilter} onChange={(event) => setSetFilter(event.target.value)}><option value="all">全部系列</option>{setOptions.map((set) => <option value={set} key={set}>{set}</option>)}</select></label>
              <label><span>標籤</span><select value={tagFilter} onChange={event => setTagFilter(event.target.value)}><option value="">全部標籤</option>{tagOptions.map(tag => <option key={tag.key} value={tag.key}>{tag.label}</option>)}</select></label>
            </div>
                <label className="deck-only-filter"><input type="checkbox" checked={onlyDeck} onChange={event => { setOnlyDeck(event.target.checked); setVisibleCount(72); }} />只顯示已加入牌組的卡片</label>
              </div></div></div>
            </aside>
            <div className="catalog-content">

          <div className="result-bar">
            <span role="status" aria-live="polite">{loading ? "載入中…" : <><b>{artworkCount.toLocaleString()}</b> 款卡圖{imagelessCount > 0 && ` · ${imagelessCount} 張未有卡圖`}{query !== deferredQuery && " · 搜尋中…"}</>}</span>
            <div className="result-controls">
              <label><span className="sr-only">卡片排序</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="number">卡號順序</option><option value="newest">新卡優先</option><option value="name">名稱順序</option><option value="tag">標籤順序</option></select></label>
              <div className="view-switch" aria-label="卡庫顯示方式"><button type="button" aria-label="大卡圖模式" title="大卡圖模式" aria-pressed={view === "gallery"} onClick={() => setView("gallery")}><StudioIcon name="grid" /></button><button type="button" aria-label="效果列表模式" title="效果列表模式" aria-pressed={view === "list"} onClick={() => setView("list")}><StudioIcon name="list" /></button></div>
            </div>
          </div>
          {activeFilters.length > 0 && <div className="active-filters" aria-label="已套用篩選">{activeFilters.map((filter, index) => <button key={`${filter.label}-${index}`} type="button" onClick={filter.clear} aria-label={`移除篩選：${filter.label}`}>{filter.label}<span aria-hidden="true">×</span></button>)}<button className="reset-filters" type="button" onClick={resetFilters}>全部重設</button></div>}

          {loading && <div className="studio-skeletons" aria-label="正在整理完整卡庫" role="status">{Array.from({ length: 6 }, (_, index) => <div key={index}><span /><i /><i /></div>)}</div>}
          {loadError && <div className="empty-state" role="alert"><strong>{loadError}</strong><button type="button" className="studio-primary" onClick={() => window.location.reload()}>重新載入</button></div>}
          {!loading && !loadError && filteredCards.length === 0 && (
            <div className="empty-state"><StudioIcon name="search" /><strong>找不到符合條件的卡片</strong><p>換個關鍵字或減少篩選條件。</p><button type="button" className="studio-primary" onClick={resetFilters}>顯示全部卡片</button></div>
          )}

          <div className={`card-grid studio-${view}`} aria-busy={query !== deferredQuery}>
            {catalogCards.slice(0, visibleCount).map(({ card, variant, id, label, tags }) => {
              const quantity = variant ? quantityForVariant(card, variant.id) : quantityFor(card);
              const printingName = card.variants.length > 1 ? `${effectText(card, card.name)} ${label} 版本` : effectText(card, card.name);
              const { preview } = printingReleaseStatus(card, variant, japanDate);
              return (
                <article className="card-tile" key={`${card.number}-${id}`} data-card-number={card.number} data-printing-id={variant?.id}>
                  <button className="card-open" type="button" onClick={() => openCard(card, variant?.id)} aria-label={`查看 ${printingName}${card.variants.length > 1 ? "" : " "}詳情`}>
                    <div className="card-art-wrap">
                      <CardImage card={variant ? { ...card, image: variant.image, rarity: variant.rarity } : card} className="card-thumb" />
                      {quantity > 0 && <span className="quantity">×{quantity}</span>}
                      {preview && <span className="preview-ribbon">先行</span>}
                    </div>
                    <div className="card-copy">
                      <div className="card-meta"><code>{card.number}</code><span>{label}</span></div>
                      <h3>{effectText(card, card.name)}</h3>
                      {card.jpName && card.jpName !== effectText(card, card.name) && <span className="card-original-name">{card.jpName}</span>}
                      <div className="card-badges">
                        <span>{catalogCardText(card.type)}</span>
                        {card.stage && <span>{card.stage}</span>}
                        {card.colors.map((color) => <span key={color}>{color}</span>)}
                        {sort === "tag" && tags[0] && <span className="catalog-primary-tag">{tags[0].label}</span>}
                      </div>
                      <p>{shortEffect(card)}</p>
                      <small>詳情 →</small>
                    </div>
                  </button>
                  <div className="catalog-quantity-controls">
                  <button type="button" disabled={quantity === 0} onClick={() => removeCard(card, variant?.id)} aria-label={`從牌組減少 ${printingName}`} title="減少一張">−</button>
                  <output aria-label={`${printingName}${card.variants.length > 1 ? "" : " "}牌組張數`} aria-live="polite">{quantity}</output>
                  <button
                    className="quick-add"
                    type="button"
                    onClick={() => addCard(card, variant?.id)}
                    title={variant ? `加入 ${label} 版本` : "加入牌組"}
                    aria-label={`將 ${printingName}${card.variants.length > 1 ? "" : " "}加入牌組`}
                  >
                    ＋
                  </button>
                  </div>
                </article>
              );
            })}
          </div>

          {onlyDeck && filteredCards.length > 0 && catalogCards.length === 0 && <p className="deck-filter-empty">牌組內沒有符合條件的卡片。</p>}
          {visibleCount < catalogCards.length && (
            <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 72)}>
              顯示更多卡片 <span>{visibleCount} / {catalogCards.length}</span>
            </button>
          )}
            </div>
          </div>
      </section>

      <footer>
        <div><strong>Hololive OCG 繁中卡庫・牌組工房</strong><p>非官方工具。效果以官方日文原文與裁定為準。</p></div>
        <div className="footer-links">
          <a href="/account">我的牌組</a>
          <a href="/simulator">私人 PvP 模擬器</a>
          <a href="https://hololive-official-cardgame.com/cardlist/" target="_blank" rel="noreferrer">官方卡表 ↗</a>
          <a href="https://hololive-official-cardgame.com/rules/deck-building-rule/" target="_blank" rel="noreferrer">構築規則 ↗</a>
          <span>資料快照 {meta?.snapshotDate || "2026-08-22"}</span>
        </div>
      </footer>

      {activeCard && (
        <CardModal
          key={`${activeCard.number}-${activeVariantId || "default"}`}
          card={activeCard}
          initialVariantId={activeVariantId}
          japanDate={japanDate}
          onClose={() => { setActiveCard(null); setActiveVariantId(""); }}
          onTagSelect={browseTag}
          onAdd={addCard}
          onRemove={removeCard}
          quantity={quantityFor(activeCard)}
          quantityForVariant={(variantId) => quantityForVariant(activeCard, variantId)}
        />
      )}
      <StatusToast message={notice} />
      {photoImportOpen && <Suspense fallback={<StatusToast message="正在開啟相片匯入…" />}>
        <DeckPhotoImport printings={printings} hasDeckInEditor={oshiCount + mainCount + cheerCount > 0}
          onClose={() => setPhotoImportOpen(false)} onOpen={openPhotoDeck} />
      </Suspense>}
      {clearRequested && <ConfirmDialog title="清空目前草稿？" description="草稿內所有卡片將會移除。已保存的牌組仍可在「我的牌組」載入；如要刪除已保存牌組，請到該頁操作。" confirmLabel="清空草稿" onConfirm={clearDeck} onCancel={() => setClearRequested(false)} />}
    </main>
  );
}
