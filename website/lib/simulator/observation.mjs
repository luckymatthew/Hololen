import { STAGE_SLOTS } from "./engine.mjs";
const topNumber=u=>u?.stack?.at(-1)?.number||"";

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export function observationSeed(state, aiIndex) {
  // No opponent identities, deck order, random tape, logs, timestamps or names.
  const value = JSON.stringify([state.turn, state.phase, state.activePlayer, aiIndex,
    state.players.map((p, i) => [p.hand?.length, p.mainDeck?.length, p.life?.length,
      i === aiIndex ? p.hand?.map(c => c.number) : [],
      STAGE_SLOTS.map(z => state.status === "setup" && i !== aiIndex ? null :
        [topNumber(p.zones?.[z]), p.zones?.[z]?.damage, p.zones?.[z]?.cheer?.length])]),
    state.pendingChoice?.type]);
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function shuffleCanonical(cards, random) {
  const result = [...cards].sort((a, b) => a.number.localeCompare(b.number) || a.id.localeCompare(b.id));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sampleOwnHidden(player, keys, knownIds, random) {
  // The owner knows their deck composition, but not which cards are face-down
  // in Power/Life or the order of undrawn cards. Sample the whole concealed pool.
  const pool = shuffleCanonical(keys.flatMap(key => player[key] || []).filter(c => !knownIds.has(c.id)), random);
  for (const key of keys) player[key] = (player[key] || []).map(c => knownIds.has(c.id) ? c : pool.shift());
}

export function sampleObservation(input, aiIndex, cards, seed = observationSeed(input, aiIndex), replayDepth = 0, revealed = []) {
  const state = structuredClone(input);
  // An explicit rules-state boundary: diagnostics, UI state, saved decks and
  // arbitrary debug blobs must never enter evaluation or simulation caches.
  const keys=new Set(['status','players','activePlayer','firstPlayer','winner','turn','phase','pendingChoice','effectQueue','knockouts','lifeLosses','mode','aiPlayer','artsResolution','hbp09ResolvingSupport','hbp09DamageSequence','privateRps','privateDiceAction']);
  for(const key of Object.keys(state))if(!keys.has(key))delete state[key];
  for(const p of state.players){delete p.name;delete p.offline;delete p.debug;delete p.diagnostics;}

  const random = seededRandom(seed);
  const map = new Map(cards.map(card => [card.number, card]));
  const known = new Map(revealed.map(c => [c.id, c]));
  for (const player of state.players) {
    for (const card of player.archive || []) known.set(card.id, card);
    for (const zone of STAGE_SLOTS) for (const key of ["stack", "cheer", "attachments"]) {
      for (const card of player.zones?.[zone]?.[key] || []) known.set(card.id, card);
    }
  }
  if (state.pendingChoice?.playerIndex === aiIndex) {
    for (const card of state.pendingChoice.cards || []) known.set(card.id, card);
    const owner = state.players[aiIndex];
    const pending=state.pendingChoice;
    if(pending.effect==='placeCard'){
      const id=pending.cardId||pending.meta?.cardId;
      const selected=owner.mainDeck?.find(c=>c.id===id);if(selected)known.set(id,selected);
    }
    if(pending.effect==='hbp09'){
      for(const card of pending.meta?.hbp09?.context?.vars?.deployCard||[])known.set(card.id,card);
    }
    if (state.pendingChoice.type === "ordinaryComputer") {
      for (const card of owner.mainDeck || []) if (state.pendingChoice.options?.includes(card.number)) known.set(card.id, card);
    }
    // The Cheer step has already revealed this top card before asking a target.
    if (state.pendingChoice.type === "cheerTarget" && owner.cheerDeck?.[0]) known.set(owner.cheerDeck[0].id, owner.cheerDeck[0]);
  }
  for (let index = 0; index < state.players.length; index++) {
    const player = state.players[index];
    delete player.deck;
    if (index === aiIndex) {
      sampleOwnHidden(player, ["mainDeck", "holoPower"], new Set(known.keys()), random);
      sampleOwnHidden(player, ["cheerDeck", "life"], new Set(known.keys()), random);
      continue;
    }
    const oshi = map.get(player.oshi?.number);
    const seen = STAGE_SLOTS.map(z => state.status === "setup" ? null : map.get(topNumber(player.zones?.[z]))).filter(Boolean);
    const names = new Set([oshi, ...seen].flatMap(c => [c?.jpName, c?.name].filter(Boolean)));
    // A public-archetype guess, never the opponent's registered deck or hand.
    const members = cards.filter(c => c.group === "holomem" && (names.has(c.jpName) || names.has(c.name)));
    const generic = cards.filter(c => ["hSD01-016", "hSD01-017", "hBP01-104"].includes(c.number));
    const mainPool = [...new Map([...members, ...generic].map(c => [c.number,c])).values()];
    const fallback = cards.find(c => c.group === "holomem" && c.stage === "Debut");
    if (!mainPool.length && fallback) mainPool.push(fallback);
    const colors = new Set([...(oshi?.colors || []), ...seen.flatMap(c => c.colors || [])]);
    const cheers = cards.filter(c => c.group === "cheer" && c.colors?.some(color => colors.has(color)));
    if (!cheers.length) cheers.push(...cards.filter(c => c.group === "cheer").slice(0, 1));
    // Sample without replacement from finite copy limits. Publicly exposed
    // copies count against the same bag, including lower Bloom-stack cards.
    const exposed=[...(player.archive||[]),...STAGE_SLOTS.flatMap(z=>['stack','attachments'].flatMap(k=>player.zones?.[z]?.[k]||[]))];
    const counts=new Map();for(const c of exposed)counts.set(c.number,(counts.get(c.number)||0)+1);
    const hiddenCount=['hand','mainDeck','holoPower','removed'].reduce((n,k)=>n+(player[k]?.length||0),0);
    const bag=[];const added=new Set();
    function addCard(c){if(added.has(c.number))return;added.add(c.number);for(let i=counts.get(c.number)||0;i<(c.maxCopies||4);i++)bag.push(c.number);}
    mainPool.forEach(addCard);
    if(bag.length<hiddenCount)cards.filter(c=>['holomem','support'].includes(c.group)).sort((a,b)=>a.number.localeCompare(b.number)).forEach(addCard);
    for (const key of ["hand", "mainDeck", "holoPower", "life", "cheerDeck", "removed"]) {
      const isCheer = ["life", "cheerDeck"].includes(key);
      player[key] = (player[key] || []).map((c, i) => {
        // A public card that was just played must survive a dice-action replay.
        if (known.has(c.id)) { const knownCard=known.get(c.id);const at=bag.indexOf(knownCard.number);if(!isCheer&&at>=0)bag.splice(at,1);return structuredClone(knownCard); }
        const number=isCheer?cheers[Math.floor(random()*cheers.length)]?.number:bag.splice(Math.floor(random()*bag.length),1)[0];
        return { id: `belief-${index}-${key}-${i}`, number: number || "UNKNOWN" };
      });
    }
    if (state.status === "setup") player.zones = Object.fromEntries(STAGE_SLOTS.map(z => [z, null]));
  }
  if(state.privateRps?.first && state.privateRps.ownerIndex!==aiIndex)state.privateRps.first=['rock','scissors','paper'][Math.floor(random()*3)];
  state.log = [];
  delete state.aiLastStepCount;
  delete state.aiDecisionHistory;
  if (state.pendingChoice && state.pendingChoice.playerIndex !== aiIndex) {
    state.pendingChoice = { type: "opponent", playerIndex: state.pendingChoice.playerIndex };
  }
  if (state.privateDiceAction) {
    if (replayDepth >= 3) delete state.privateDiceAction;
    else state.privateDiceAction.baseline = sampleObservation(state.privateDiceAction.baseline, aiIndex, cards, seed, replayDepth + 1, [...known.values()]);
  }
  return state;
}
