"use client";

import { appFetch } from "@/lib/backend";
import { firebaseBuild } from "@/lib/firebase/client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/app/ThemeToggle";
import FoilCardImage from "@/app/FoilCardImage";

type User = { id: string; username: string };
type DeckState = Record<"oshi" | "main" | "cheer", Record<string, number>> & { printings?: Record<string, Record<string, number>> };
type SavedDeck = { id: string; name: string; deck: DeckState; createdAt: number; updatedAt: number };
type Card = { number: string; name: string; image: string; type: string; rarity?: string; variants?: { id: string; rarity: string; image: string }[] };
type CardPayload = { cards: Card[] };

function sectionCount(section: Record<string, number>) {
  return Object.values(section).reduce((sum, value) => sum + value, 0);
}

export function DeckPreview({ deck, cardMap }: { deck: SavedDeck; cardMap: Map<string, Card> }) {
  return (
    <div className="saved-deck-sections">
      {(["oshi", "main", "cheer"] as const).map((section) => {
        const rows = Object.entries(deck.deck[section]).flatMap(([number, total]) => {
          const card = cardMap.get(number);
          const variants = card?.variants || [];
          const allocation = deck.deck.printings?.[number] || {};
          let allocated = 0;
          const printingRows = Object.entries(allocation).flatMap(([variantId, rawCount]) => {
            const variant = variants.find((candidate) => candidate.id === variantId);
            const count = Math.max(0, Math.min(total - allocated, Number(rawCount) || 0));
            if (!variant || count <= 0) return [];
            allocated += count;
            return [{ number, count, card, variant: variant as typeof variant | undefined }];
          });
          const missing = Math.max(0, total - allocated);
          if (missing > 0) printingRows.unshift({ number, count: missing, card, variant: undefined });
          return printingRows;
        });
        return (
          <section className="saved-deck-section" key={section}>
            <div className="saved-section-title">
              <b>{section === "oshi" ? "推し Holomen" : section === "main" ? "主牌組" : "應援牌組"}</b>
              <span>{sectionCount(deck.deck[section])}</span>
            </div>
            <div className="saved-card-strip">
              {rows.length === 0 && <p>尚未加入卡片</p>}
              {rows.map(({ number, count, card, variant }, rowIndex) => {
                const image = variant?.image || card?.image;
                return (
                  <div className="saved-card" key={`${number}-${variant?.id || "default"}-${rowIndex}`} title={`${card?.name ?? number} · ${variant?.rarity || "標準版"} ×${count}`}>
                    {image ? <FoilCardImage className="saved-card-art" src={image} alt={`${card?.name || number} ${variant?.rarity || "標準版"}卡圖`} rarity={variant?.rarity || card?.rarity} loading="lazy" /> : <div className="saved-card-fallback">{number}</div>}
                    <span>×{count}</span>
                    <small>{card?.name ?? number}{variant?.rarity ? ` · ${variant.rarity}` : ""}</small>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function AccountClient() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.number, card])), [cards]);

  const loadDecks = async () => {
    setDeckLoading(true);
    const response = await appFetch("/api/decks");
    if (response.ok) setDecks((await response.json()).decks);
    setDeckLoading(false);
  };

  useEffect(() => {
    Promise.all([
      appFetch("/api/auth/session").then((response) => response.json()),
      appFetch("/cards.json").then((response) => response.json() as Promise<CardPayload>),
    ]).then(([session, payload]) => {
      setUser(session.user);
      setCards(payload.cards);
      setChecking(false);
      if (session.user) void loadDecks();
    });
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await appFetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) setAuthError(payload.error || "帳號服務暫時無法使用，請稍後再試。");
      else {
        setUser(payload.user);
        setPassword("");
        await loadDecks();
      }
    } catch (error) {
      setAuthError(error instanceof DOMException && error.name === "AbortError" ? "連線逾時，請重新嘗試。" : "無法連接帳號服務，請重新嘗試。");
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await appFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDecks([]);
  };

  const deleteDeck = async (deck: SavedDeck) => {
    if (!window.confirm(`確定刪除「${deck.name}」嗎？`)) return;
    const response = await appFetch(`/api/decks/${encodeURIComponent(deck.id)}`, { method: "DELETE" });
    if (response.ok) setDecks((current) => current.filter((item) => item.id !== deck.id));
  };

  return (
    <main className="account-page">
      <header className="account-topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">H</span>
          <span><strong>繁中卡庫・牌組工房</strong><small>HOLOLIVE OCG · ACCOUNT</small></span>
        </Link>
        <div className="account-top-actions"><ThemeToggle /><Link className="back-builder" href="/">返回組牌器 →</Link></div>
      </header>

      {checking ? (
        <div className="account-loading"><span /><b>正在讀取帳號…</b></div>
      ) : !user ? (
        <section className="login-layout">
          <div className="login-copy">
            <p className="eyebrow">YOUR DECKS / ANY DEVICE</p>
            <h1>登入後，<br /><em>帶走你的每副牌。</em></h1>
            <p>建立免費帳號，把牌組安全地保存到個人牌組庫。密碼只會保存加鹽雜湊，不會保存明文。</p>
            <div className="login-points"><span>最多 50 副牌組</span><span>卡圖式預覽</span><span>跨裝置讀取</span></div>
          </div>
          <form className="login-card" onSubmit={submitAuth}>
            <div className="auth-tabs">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setAuthError(""); }}>登入</button>
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setAuthError(""); }}>建立帳號</button>
            </div>
            <div><p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "NEW ACCOUNT"}</p><h2>{mode === "login" ? "登入牌組庫" : "建立你的牌組庫"}</h2></div>
            <label><span>使用者名稱</span><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={24} required placeholder="3–24 個英文字母或數字" /></label>
            <label><span>密碼</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required placeholder="至少 8 個字元" /></label>
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <button className="auth-submit" disabled={submitting}>{submitting ? "處理中…" : mode === "login" ? "登入" : "建立帳號並登入"}</button>
            <small>這個帳號只用於保存本站牌組，請不要重複使用重要服務的密碼。</small>
          </form>
        </section>
      ) : (
        <section className="deck-library-page">
          <div className="account-hero">
            <div><p className="eyebrow">PERSONAL DECK LIBRARY</p><h1>{user.username} 的牌組</h1><p>每副牌都以推し、主牌與應援三區完整顯示；點一下即可回到組牌器繼續編輯。</p></div>
            <div className="account-actions"><Link href="/">＋ 建立新牌組</Link><button type="button" onClick={logout}>登出</button></div>
          </div>
          {deckLoading ? <div className="account-loading"><span /><b>讀取牌組中…</b></div> : decks.length === 0 ? (
            <div className="no-saved-decks"><b>還沒有保存的牌組</b><p>回到組牌器建立牌組，再按「雲端儲存」。</p><Link href="/">開始組牌 →</Link></div>
          ) : (
            <div className="saved-deck-grid">
              {decks.map((deck) => (
                <article className="saved-deck-panel" key={deck.id}>
                  <div className="saved-deck-head">
                    <div><p>UPDATED {new Date(deck.updatedAt).toLocaleDateString("zh-Hant")}</p><h2>{deck.name}</h2></div>
                    <span>{sectionCount(deck.deck.oshi) + sectionCount(deck.deck.main) + sectionCount(deck.deck.cheer)}/71</span>
                  </div>
                  <DeckPreview deck={deck} cardMap={cardMap} />
                  <div className="saved-deck-actions"><a href={`/?deck=${encodeURIComponent(deck.id)}`}>載入組牌器</a><button type="button" onClick={() => deleteDeck(deck)}>刪除</button></div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
