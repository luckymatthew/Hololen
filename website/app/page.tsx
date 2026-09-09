"use client";

import { appFetch } from "@/lib/backend";
import { draftKey } from "@/lib/firebase/store";
import { content as deckContent } from "@/lib/firebase/merge.mjs";
import { firebaseBuild } from "@/lib/firebase/client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { cardSearchText, matchesSearch } from "@/lib/catalog-search.mjs";
import { effectAuditPending } from '@/lib/effect-corrections.mjs';
import { cardText, effectText, keywordLabel } from "@/lib/card-terminology.mjs";
import TerminologyNote from "@/app/TerminologyNote";
import StudioIcon from "@/app/StudioIcon";
import { fromHoloSimDeck, isHoloSimDeck, toHoloSimDeck, toHoloSimFilename } from "@/lib/holosim-deck.mjs";
import { groupMemberOptions } from "@/lib/member-sort.mjs";
import ThemeToggle from "@/app/ThemeToggle";
import FoilCardImage from "@/app/FoilCardImage";
import CardScanner from "@/app/CardScanner";

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
  variants: { id: string; rarity: string; image: string; sets?: string[] }[];
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

// Present the regular printing first, followed by increasingly special parallel printings.
const rarityOrder = ["C", "U", "R", "RR", "OC", "OSR", "S", "SR", "SY", "UR", "HR", "OUR", "SEC", "P"];
const rarityRank = new Map(rarityOrder.map((rarity, index) => [rarity, index]));

function sortVariantsByRarity(variants: Card["variants"]) {
  return [...variants].sort((left, right) => {
    const leftRank = rarityRank.get(left.rarity) ?? rarityOrder.length;
    const rightRank = rarityRank.get(right.rarity) ?? rarityOrder.length;
    return leftRank - rightRank || left.id.localeCompare(right.id, "en", { numeric: true });
  });
}

function variantLabel(variant: Card["variants"][number], variants: Card["variants"]) {
  const sameRarity = variants.filter((candidate) => candidate.rarity === variant.rarity);
  const position = sameRarity.findIndex((candidate) => candidate.id === variant.id);
  return sameRarity.length > 1 ? `${variant.rarity} ${position + 1}` : variant.rarity;
}

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
  { value: "oshi", label: "推し Holomen" },
  { value: "holomem", label: "Holomen" },
  { value: "support", label: "支援卡" },
  { value: "cheer", label: "應援卡" },
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
    "此卡沒有額外效果文字。"
  ));
}

function CardImage({ card, className = "", rarity }: { card: Card; className?: string; rarity?: string }) {
  const [failedImage, setFailedImage] = useState("");

  if (!card.image || failedImage === card.image) {
    return (
      <div className={`card-image-fallback ${className}`}>
        <span>{card.number}</span>
        <strong>{card.name}</strong>
      </div>
    );
  }

  return (
    <FoilCardImage
      className={className}
      src={card.image}
      alt={`${card.name} ${card.number} 卡圖`}
      rarity={rarity || card.rarity}
      loading="lazy"
      onError={() => setFailedImage(card.image)}
    />
  );
}

function CardModal({
  card,
  onClose,
  onAdd,
  quantity,
  quantityForVariant,
  initialVariantId,
  scanResult = false,
}: {
  card: Card;
  onClose: () => void;
  onAdd: (card: Card, variantId?: string) => void;
  quantity: number;
  quantityForVariant: (variantId: string) => number;
  initialVariantId?: string;
  scanResult?: boolean;
}) {
  const sortedVariants = useMemo(() => sortVariantsByRarity(card.variants), [card.variants]);
  const initialVariant = sortedVariants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId || initialVariant?.id || "");
  const selectedVariant = sortedVariants.find((variant) => variant.id === selectedVariantId) ?? initialVariant;
  const selectedImage = selectedVariant?.image ?? card.image;
  const selectedQuantity = selectedVariant ? quantityForVariant(selectedVariant.id) : quantity;
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { node?.close(); document.body.style.overflow = overflow; };
  }, []);

  return (
    <dialog ref={dialog} className="studio-card-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-label={`${card.name} 卡片詳情`}>
      <section
        className="card-modal"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="關閉卡片詳情">
          ×
        </button>
        <div className="modal-art-column">
          <CardImage card={{ ...card, image: selectedImage }} className="modal-card-image" rarity={selectedVariant?.rarity || card.rarity} />
          {card.variants.length > 1 && (
            <div className="variant-picker">
              <p>卡圖版本 · 點選後加入牌組</p>
              <div className="variant-strip" aria-label="卡圖版本">
                {sortedVariants.map((variant) => (
                  <button
                    key={variant.id}
                    className={selectedVariant?.id === variant.id ? "active" : ""}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    title={`${variantLabel(variant, sortedVariants)} 卡圖`}
                  >
                    <FoilCardImage className="variant-card-art" src={variant.image} alt={`${card.name} ${variantLabel(variant, sortedVariants)} 卡圖`} rarity={variant.rarity} loading="lazy" />
                    <span>{variantLabel(variant, sortedVariants)}</span>
                    {quantityForVariant(variant.id) > 0 && <b>×{quantityForVariant(variant.id)}</b>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-copy">
          {scanResult && <button className="account-button" type="button" onClick={onClose}>← 繼續掃卡</button>}
          <div className="modal-kicker">
            <code>{card.number}</code>
            <span>{cardText(card.type)}</span>
            {card.preview && <span className="preview-badge">HoloSim 先行卡</span>}
          </div>
          <h2>{card.name}</h2>
          {(card.jpName !== card.name || card.enName) && (
            <p className="foreign-name">
              {card.jpName !== card.name ? card.jpName : card.enName}
            </p>
          )}
          <div className="stat-grid">
            {card.colors.length > 0 && (
              <span><small>顏色</small>{card.colors.join("＋")}</span>
            )}
            {card.stage && <span><small>階級</small>{card.stage}</span>}
            {card.hp !== null && <span><small>HP</small>{card.hp}</span>}
            {card.life !== null && <span><small>Life</small>{card.life}</span>}
            {card.baton !== null && <span><small>接力</small>{card.baton}</span>}
            <span><small>稀有度</small>{selectedVariant?.rarity || card.rarity || "—"}</span>
          </div>
          {card.tags.length > 0 && (
            <div className="tag-row">
              {card.tags.map((tag) => <span key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</span>)}
            </div>
          )}
          <div className="effect-stack">
            <h3 className="effect-heading">繁體中文效果 <span>用語已統一</span></h3>
            <TerminologyNote />
            {(effectAuditPending as Record<string, string>)[card.number] && <p role="note">校對狀態：{(effectAuditPending as Record<string, string>)[card.number]}</p>}
            {card.stageSkill && (card.stageSkill.name || card.stageSkill.effect) && (
              <article className="stage-skill-effect">
                <span>主推舞台技能</span>
                <h3>{card.stageSkill.name || "主推舞台技能"}</h3>
                <p>{effectText(card, card.stageSkill.effect)}</p>
              </article>
            )}
            {card.oshiSkill && (card.oshiSkill.name || card.oshiSkill.effect) && (
              <article>
                <span>主推技能 {card.oshiSkill.timing && `· ${cardText(card.oshiSkill.timing)}`}</span>
                <h3>{card.oshiSkill.name || "主推技能"}</h3>
                <p>{effectText(card, card.oshiSkill.effect)}</p>
              </article>
            )}
            {card.spOshiSkill && (card.spOshiSkill.name || card.spOshiSkill.effect) && (
              <article className="sp-effect">
                <span>SP 主推技能 {card.spOshiSkill.timing && `· ${cardText(card.spOshiSkill.timing)}`}</span>
                <h3>{card.spOshiSkill.name || "SP 主推技能"}</h3>
                <p>{effectText(card, card.spOshiSkill.effect)}</p>
              </article>
            )}
            {card.keyword && (card.keyword.name || card.keyword.effect) && (
              <article>
                <span>{keywordLabel(card.keyword.type)}</span>
                <h3>{card.keyword.name || "技能效果"}</h3>
                <p>{effectText(card, card.keyword.effect)}</p>
              </article>
            )}
            {card.abilityText && (
              <article>
                <span>卡片效果</span>
                <p>{effectText(card, card.abilityText)}</p>
              </article>
            )}
            {card.arts.map((art, index) => (
              <article className="art-effect" key={`${art.name}-${index}`}>
                <span>藝能（Arts） {art.cost.length > 0 && `· ${art.cost.join(" / ")}`}</span>
                <h3>
                  {art.name || `藝能 ${index + 1}`}
                  {art.damage !== null && <b>{art.damage}{art.specialValues[0] ? `＋特攻 ${art.specialValues[0]}` : ""}</b>}
                </h3>
                {art.effect && <p>{effectText(card, art.effect)}</p>}
              </article>
            ))}
            {card.extra && (
              <article className="extra-effect">
                <span>Extra</span>
                <p>{effectText(card, card.extra)}</p>
              </article>
            )}
          </div>
          <div className="modal-source">
            <span>{card.set}</span>
            {card.illustrator && <span>Illustration · {card.illustrator}</span>}
            {card.qaCount > 0 && <span>官方 Q&amp;A · {card.qaCount} 條</span>}
          </div>
          <button className="add-large" type="button" onClick={() => onAdd(card, selectedVariant?.id)}>
            {selectedVariant ? `＋ 加入 ${variantLabel(selectedVariant, sortedVariants)} 版本${selectedQuantity ? ` · 此版本 ${selectedQuantity}` : ""}` : quantity > 0 ? `加入牌組 · 現有 ${quantity}` : "＋ 加入牌組"}
          </button>
        </div>
      </section>
    </dialog>
  );
}

export default function Home() {
  const [cards, setCards] = useState<Card[]>([]);
  const [meta, setMeta] = useState<CardMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchInput = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = useState<"library" | "deck">("library");
  const [view, setView] = useState<"gallery" | "list">("gallery");
  const [sort, setSort] = useState("number");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | CardGroup>("all");
  const [colorFilter, setColorFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [setFilter, setSetFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(72);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [fromScanner, setFromScanner] = useState(false);
  const [activeVariantId, setActiveVariantId] = useState("");
  const [deck, setDeck] = useState<DeckState>(emptyDeck);
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
    if (deckReady) { try { window.localStorage.setItem(draftStorageKey, JSON.stringify(deck)); } catch { setNotice("儲存空間不足，請立即匯出牌組備份。"); } }
  }, [deck, deckReady]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination whenever the filter contract changes
    setVisibleCount(72);
  }, [query, typeFilter, colorFilter, stageFilter, setFilter, memberFilter, sort]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !activeCard && !scannerOpen && !target.closest("input, textarea, select, [contenteditable='true']")) {
        event.preventDefault(); setWorkspace("library");
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeCard, scannerOpen]);

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

  const searchIndex = useMemo(() => new Map(cards.map(card => [card.number, cardSearchText(card)])), [cards]);
  const filteredCards = useMemo(() => {
    const results = cards.filter((card) => {
      if (typeFilter !== "all" && card.group !== typeFilter) return false;
      if (colorFilter !== "all" && !card.colorCodes.includes(colorFilter)) return false;
      if (stageFilter !== "all" && card.stage !== stageFilter) return false;
      if (setFilter !== "all" && !card.number.startsWith(`${setFilter}-`)) return false;
      if (memberFilter !== "all" && card.jpName !== memberFilter && card.name !== memberFilter) return false;
      return matchesSearch(searchIndex.get(card.number) || "", deferredQuery);
    });
    return results.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "zh-Hant") || a.number.localeCompare(b.number, "en", { numeric: true });
      if (sort === "newest") return (b.releaseDate || "").localeCompare(a.releaseDate || "") || b.number.localeCompare(a.number, "en", { numeric: true });
      return a.number.localeCompare(b.number, "en", { numeric: true });
    });
  }, [cards, searchIndex, colorFilter, memberFilter, deferredQuery, setFilter, stageFilter, typeFilter, sort]);

  const activeFilters = [
    ...(query ? [{ label: `搜尋：${query}`, clear: () => setQuery("") }] : []),
    ...(memberFilter !== "all" ? [{ label: cards.find(card => card.jpName === memberFilter || card.name === memberFilter)?.name || memberFilter, clear: () => setMemberFilter("all") }] : []),
    ...(typeFilter !== "all" ? [{ label: typeOptions.find(option => option.value === typeFilter)?.label || typeFilter, clear: () => setTypeFilter("all") }] : []),
    ...(colorFilter !== "all" ? [{ label: colorOptions.find(option => option[0] === colorFilter)?.[1] || colorFilter, clear: () => setColorFilter("all") }] : []),
    ...(stageFilter !== "all" ? [{ label: stageFilter, clear: () => setStageFilter("all") }] : []),
    ...(setFilter !== "all" ? [{ label: setFilter, clear: () => setSetFilter("all") }] : []),
  ];
  const resetFilters = () => { setQuery(""); setMemberFilter("all"); setTypeFilter("all"); setColorFilter("all"); setStageFilter("all"); setSetFilter("all"); };

  const oshiCount = countSection(deck.oshi);
  const mainCount = countSection(deck.main);
  const cheerCount = countSection(deck.cheer);

  const quantityFor = (card: Card) => cardDeckCount(deck, card);
  const quantityForVariant = (card: Card, variantId: string) => normalizedPrintingCounts(deck, card)[variantId] || 0;

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
      setNotice("應援牌組已達 20 張，請先移除卡片。");
      return;
    }
    if (section !== "oshi" && currentCount >= card.maxCopies) {
      setNotice(card.restricted ? "這是限制卡，牌組最多 1 張。" : `同卡號最多 ${card.maxCopies} 張。`);
      return;
    }
    setDeck((previous) => ({
      ...(() => {
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
      if (variantId && Number(allocations[variantId] || 0) <= 0) return previous;
      const nextSection = { ...previous[section] };
      const next = current - 1;
      if (next <= 0) delete nextSection[number];
      else nextSection[number] = next;
      const printings = { ...(previous.printings || {}) };
      if (variantId && allocations[variantId]) {
        allocations[variantId] -= 1;
        if (allocations[variantId] <= 0) delete allocations[variantId];
      }
      if (next <= 0 || Object.keys(allocations).length === 0) delete printings[number];
      else printings[number] = allocations;
      return { ...previous, [section]: nextSection, printings };
    });
  };

  const clearDeck = () => {
    if (!window.confirm("確定要清空目前牌組嗎？")) return;
    setDeck(emptyDeck());
    setActiveDeckId(null);
    setEditorBase("");
    setDeckName("未命名牌組");
    window.history.replaceState({}, "", "/");
    setNotice("牌組已清空。");
  };

  const saveDeck = async () => {
    if (oshiCount + mainCount + cheerCount === 0) {
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
    const blob = new Blob([JSON.stringify(result.deck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = toHoloSimFilename(proposedName);
    link.click();
    URL.revokeObjectURL(url);
    setNotice(deckValid ? `已匯出「${toHoloSimFilename(proposedName)}」；放入 HoloSim 1.13 的 decks 資料夾即可讀取。` : "已匯出 HoloSim 1.13 JSON；未完成牌組可能無法在模擬器開啟。");
  };

  const importDeck = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = isHoloSimDeck(parsed) ? fromHoloSimDeck(parsed) : parsed.deck || parsed;
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
    } catch {
      setNotice("無法讀取這個牌組檔案。");
    }
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
      <header className="topbar library-topbar">
        <a className="brand" href="/" aria-label="Hololive OCG 卡庫首頁">
          <span className="brand-mark">H</span>
          <span><strong>HOLOLIVE <em>OCG</em></strong><small>繁中卡庫・牌組工房</small></span>
        </a>
        <nav className="studio-navigation" aria-label="主要功能">
          <button type="button" aria-current={workspace === "library" ? "page" : undefined} onClick={() => setWorkspace("library")}>卡片圖鑑</button>
          <button type="button" aria-current={workspace === "deck" ? "page" : undefined} onClick={() => setWorkspace("deck")}>牌組工房 <span>{oshiCount + mainCount + cheerCount}</span></button>
          <a href="/simulator">對戰模擬器</a>
          {firebaseBuild && <a href="/download">Android 下載</a>}
        </nav>
        <div className="topbar-actions">
          <ThemeToggle />
          <a className="account-button" href="/account">我的牌組</a>
        </div>
      </header>

      <div className="studio-masthead">
        <div>
          <p className="eyebrow">HOLOLIVE OFFICIAL CARD GAME</p>
          <h1>{workspace === "library" ? "每張卡，一目了然。" : "組出你的下一場勝利。"}</h1>
          <p>{workspace === "library" ? "查卡圖、讀繁中效果，找到適合你牌組的一張。" : "選擇卡圖版本、調整配比，保存後直接開始試牌。"}</p>
        </div>
        <div className="studio-masthead-actions">
          {workspace === "library" ? <button type="button" className="studio-primary" disabled={loading || !cards.length} onClick={() => setScannerOpen(true)}><StudioIcon name="scan" />掃卡翻譯</button> : <button type="button" className="studio-primary" onClick={() => setWorkspace("library")}><StudioIcon name="search" />去卡庫加卡</button>}
          <span>{meta ? `${meta.uniqueCards.toLocaleString()} 個卡號 · ${meta.printings.toLocaleString()} 款卡圖` : "正在載入卡庫…"}</span>
        </div>
      </div>

      <section className="deck-workbench" id="deck-workbench" aria-label="牌組構築器" hidden={workspace !== "deck"} tabIndex={-1}>
        <div className="deck-workbench-head">
          <div>
            <p className="eyebrow">MY DECK</p>
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
            <p id="deck-name-help">草稿自動保留於此裝置；登入後可雲端保存。匯出檔放入 HoloSim 1.13 的 decks 資料夾即可讀取。</p>
          </div>
          <span className={deckValid ? "valid" : ""}>{deckValid ? "牌組可用" : `${oshiCount + mainCount + cheerCount}/71`}</span>
        </div>
        <div className="validation-grid">
          <div className={oshiCount === 1 ? "ok" : ""}><span>推し</span><b>{oshiCount}/1</b></div>
          <div className={mainCount === 50 ? "ok" : ""}><span>主牌</span><b>{mainCount}/50</b></div>
          <div className={cheerCount === 20 ? "ok" : ""}><span>應援</span><b>{cheerCount}/20</b></div>
        </div>
        <div className={`deck-status ${deckValid ? "ok" : ""}`}>
          <span>{deckValid ? "✓" : "!"}</span>
          <p><b>{deckValid ? "牌組張數完整" : "牌組尚未完成"}</b>{deckValid ? "可以保存或匯出到 HoloSim 1.13。" : "補齊三個區域；匯出時也會檢查 HoloSim 1.13 支援的卡號。"}</p>
        </div>

        <div className="deck-gallery">
          {(["oshi", "main", "cheer"] as DeckSection[]).map((section) => {
            const rows = deckRows(section);
            const title = section === "oshi" ? "推し Holomen" : section === "main" ? "主牌組" : "應援牌組";
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
                        <button className="deck-card-open" type="button" onClick={() => { setActiveVariantId(variant?.id || ""); setActiveCard(card); }}>
                          <span className="deck-card-art"><CardImage card={{ ...card, image: variant?.image || card.image }} className="deck-card-thumb" rarity={variant?.rarity || card.rarity} /><b>×{rowCount}</b>{variant && <em>{variantLabel(variant, sortVariantsByRarity(card.variants))}</em>}</span>
                          <span className="deck-card-copy">
                            <code>{card.number}</code>
                            <strong>{card.name}</strong>
                            {card.jpName && card.jpName !== card.name && <span className="deck-card-original">{card.jpName}</span>}
                          </span>
                        </button>
                        <div className="stepper">
                          <button type="button" onClick={() => changePrintingQuantity(section, card.number, variant?.id || "", -1)} aria-label={`減少 ${card.name} ${variant?.rarity || ""}版本`}>−</button>
                          <b>{rowCount}</b>
                          <button type="button" onClick={() => changePrintingQuantity(section, card.number, variant?.id || "", 1)} aria-label={`增加 ${card.name} ${variant?.rarity || ""}版本`}>＋</button>
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
          <label className="import-button">匯入 JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importDeck(event.target.files?.[0]); event.target.value = ""; }} /></label>
          <button className="clear-button" type="button" onClick={clearDeck}>清空</button>
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
                placeholder="卡號、成員、技能或效果關鍵字…"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="清除搜尋">×</button>}
              {!query && <kbd>/</kbd>}
            </label>
            <button className="studio-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="advanced-filters" onClick={() => setFiltersOpen(value => !value)}><StudioIcon name="filter" />篩選{activeFilters.length > 0 && <b>{activeFilters.length}</b>}</button>
            </div>
            <div className="studio-type-tabs" aria-label="卡片種類">
              {typeOptions.map(option => <button key={option.value} type="button" aria-pressed={typeFilter === option.value} onClick={() => setTypeFilter(option.value as typeof typeFilter)}>{option.value === "all" ? "全部" : option.value === "oshi" ? "推し" : option.label}</button>)}
            </div>
            <div className="filter-grid" id="advanced-filters" hidden={!filtersOpen}>
              <label><span>成員（依分部・世代）</span><select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="all">全部成員</option>{memberGroups.map((group) => <optgroup label={group.label} key={group.key}>{group.options.map((member) => <option value={member.value} key={member.value}>{member.label}</option>)}</optgroup>)}</select></label>
              <label><span>顏色</span><select value={colorFilter} onChange={(event) => setColorFilter(event.target.value)}>{colorOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>階級</span><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>{stageOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label><span>系列</span><select value={setFilter} onChange={(event) => setSetFilter(event.target.value)}><option value="all">全部系列</option>{setOptions.map((set) => <option value={set} key={set}>{set}</option>)}</select></label>
            </div>
          </div>

          <div className="result-bar">
            <span role="status" aria-live="polite">{loading ? "載入中…" : <><b>{filteredCards.length.toLocaleString()}</b> 張卡片{query !== deferredQuery && " · 搜尋中…"}</>}</span>
            <div className="result-controls">
              <label><span className="sr-only">卡片排序</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="number">卡號順序</option><option value="newest">新卡優先</option><option value="name">名稱順序</option></select></label>
              <div className="view-switch" aria-label="卡庫顯示方式"><button type="button" aria-label="大卡圖模式" title="大卡圖模式" aria-pressed={view === "gallery"} onClick={() => setView("gallery")}><StudioIcon name="grid" /></button><button type="button" aria-label="效果列表模式" title="效果列表模式" aria-pressed={view === "list"} onClick={() => setView("list")}><StudioIcon name="list" /></button></div>
            </div>
          </div>
          {activeFilters.length > 0 && <div className="active-filters" aria-label="已套用篩選">{activeFilters.map((filter, index) => <button key={`${filter.label}-${index}`} type="button" onClick={filter.clear} aria-label={`移除篩選：${filter.label}`}>{filter.label}<span aria-hidden="true">×</span></button>)}<button className="reset-filters" type="button" onClick={resetFilters}>全部重設</button></div>}

          {loading && <div className="studio-skeletons" aria-label="正在整理完整卡庫" role="status">{Array.from({ length: 6 }, (_, index) => <div key={index}><span /><i /><i /></div>)}</div>}
          {loadError && <div className="empty-state" role="alert"><strong>{loadError}</strong><button type="button" className="studio-primary" onClick={() => window.location.reload()}>重新載入</button></div>}
          {!loading && !loadError && filteredCards.length === 0 && (
            <div className="empty-state"><StudioIcon name="search" /><strong>找不到符合條件的卡片</strong><p>試試較短嘅關鍵字，或者移除部分篩選。</p><button type="button" className="studio-primary" onClick={resetFilters}>顯示全部卡片</button></div>
          )}

          <div className={`card-grid studio-${view}`} aria-busy={query !== deferredQuery}>
            {filteredCards.slice(0, visibleCount).map((card) => {
              const quantity = quantityFor(card);
              return (
                <article className="card-tile" key={card.number}>
                  <button className="card-open" type="button" onClick={() => { setActiveVariantId(""); setActiveCard(card); }} aria-label={`查看 ${card.name} 詳情`}>
                    <div className="card-art-wrap">
                      <CardImage card={card} className="card-thumb" />
                      {quantity > 0 && <span className="quantity">×{quantity}</span>}
                      {card.preview && <span className="preview-ribbon">先行</span>}
                    </div>
                    <div className="card-copy">
                      <div className="card-meta"><code>{card.number}</code><span>{card.rarity}</span></div>
                      <h3>{card.name}</h3>
                      {card.jpName && card.jpName !== card.name && <span className="card-original-name">{card.jpName}</span>}
                      <div className="card-badges">
                        <span>{cardText(card.type)}</span>
                        {card.stage && <span>{card.stage}</span>}
                        {card.colors.map((color) => <span key={color}>{color}</span>)}
                      </div>
                      <p>{shortEffect(card)}</p>
                      <small>查看中文效果 →</small>
                    </div>
                  </button>
                  <button
                    className="quick-add"
                    type="button"
                    onClick={() => {
                      if (card.variants.length > 1) {
                        setActiveVariantId("");
                        setActiveCard(card);
                      } else addCard(card, card.variants[0]?.id);
                    }}
                    title={card.variants.length > 1 ? "選擇卡圖並加入牌組" : "加入牌組"}
                    aria-label={card.variants.length > 1 ? `選擇 ${card.name} 卡圖版本` : `將 ${card.name} 加入牌組`}
                  >
                    ＋
                  </button>
                </article>
              );
            })}
          </div>

          {visibleCount < filteredCards.length && (
            <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 72)}>
              顯示更多卡片 <span>{Math.min(visibleCount, filteredCards.length)} / {filteredCards.length}</span>
            </button>
          )}
      </section>

      <footer>
        <div><strong>Hololive OCG 繁中卡庫・牌組工房</strong><p>非官方 Hololive OCG 閱讀與牌組構築工具。中文內容含社群及 AI 輔助翻譯，請以官方日文卡面及最新裁定為準。</p></div>
        <div className="footer-links">
          <a href="/account">我的牌組</a>
          <a href="/simulator">私人 PvP 模擬器</a>
          <a href="https://hololive-official-cardgame.com/cardlist/" target="_blank" rel="noreferrer">官方卡表 ↗</a>
          <a href="https://hololive-official-cardgame.com/rules/deck-building-rule/" target="_blank" rel="noreferrer">構築規則 ↗</a>
          <span>資料快照 {meta?.snapshotDate || "2026-08-22"}</span>
        </div>
      </footer>

      {scannerOpen && <CardScanner cards={cards} onClose={() => setScannerOpen(false)} onPick={(number) => {
        const card = cardMap.get(number);
        if (!card) return;
        setScannerOpen(false); setFromScanner(true); setActiveVariantId(""); setActiveCard(card);
      }} />}
      {activeCard && (
        <CardModal
          key={`${activeCard.number}-${activeVariantId || "default"}`}
          card={activeCard}
          initialVariantId={activeVariantId}
          scanResult={fromScanner}
          onClose={() => { setActiveCard(null); setActiveVariantId(""); if (fromScanner) { setFromScanner(false); setScannerOpen(true); } }}
          onAdd={addCard}
          quantity={quantityFor(activeCard)}
          quantityForVariant={(variantId) => quantityForVariant(activeCard, variantId)}
        />
      )}
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
