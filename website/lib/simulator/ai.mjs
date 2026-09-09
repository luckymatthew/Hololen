import { applyAction, BACK_SLOTS, STAGE_SLOTS } from "./engine.mjs";

const MAX_AI_STEPS = 96;

function topNumber(unit) {
  return unit?.stack?.[unit.stack.length - 1]?.number || "";
}

function cardMap(cards) {
  return new Map(cards.map((card) => [card.number, card]));
}

function cardText(card) {
  return [card?.abilityText, card?.keyword?.effect, card?.oshiSkill?.effect, card?.spOshiSkill?.effect, ...(card?.arts || []).map((art) => art.effect)].filter(Boolean).join(" ");
}

function cardValue(card, player, map) {
  if (!card) return 0;
  let value = 4;
  if (card.group === "holomem") {
    value += { Debut: 15, Spot: 13, "1st": 25, "2nd": 38 }[card.stage] || 8;
    value += Number(card.hp || 0) / 15;
    value += Math.max(0, ...(card.arts || []).map((art) => Number(art.damage || 0))) / 8;
    const stageNames = new Set(STAGE_SLOTS.map((zone) => map.get(topNumber(player?.zones?.[zone]))).filter(Boolean).flatMap((candidate) => [candidate.name, candidate.jpName, candidate.enName].filter(Boolean)));
    if ([card.name, card.jpName, card.enName].some((name) => stageNames.has(name))) value += card.stage === "2nd" ? 18 : 10;
  } else if (card.group === "support") {
    value += /抽|加入手牌|搜尋|公開/u.test(cardText(card)) ? 15 : 8;
    if (["supportTool", "supportMascot", "supportFan"].includes(card.typeCode)) value += 5;
  }
  return value;
}

function unitMaxHp(unit, map) {
  const card = map.get(topNumber(unit));
  const attachmentHp = (unit?.attachments || []).reduce((sum, instance) => {
    const text = String(map.get(instance.number)?.abilityText || "").split(/\n\s*\n|◆/u)[0];
    return sum + Number(text.match(/HP\s*[+＋]\s*(\d+)/iu)?.[1] || 0);
  }, 0);
  return Number(card?.hp || 0) + attachmentHp;
}

function artPlan(unit, art, map) {
  const cheer = [...(unit?.cheer || [])];
  const used = new Set();
  let paid = 0;
  const costs = [...(art?.cost || [])];
  for (const cost of costs.filter((value) => !/無色|colorless/i.test(String(value)))) {
    const index = cheer.findIndex((instance, cheerIndex) => !used.has(cheerIndex) && (map.get(instance.number)?.colors || []).includes(cost));
    if (index >= 0) { used.add(index); paid += 1; }
  }
  const colorlessCount = costs.filter((value) => /無色|colorless/i.test(String(value))).length;
  for (let colorlessIndex = 0; colorlessIndex < colorlessCount; colorlessIndex += 1) {
    const index = cheer.findIndex((_, cheerIndex) => !used.has(cheerIndex));
    if (index >= 0) { used.add(index); paid += 1; }
  }
  const missing = Math.max(0, costs.length - paid);
  return { ready: missing === 0, missing, damage: Number(art?.damage || 0), totalCost: costs.length };
}

function bestArtPlan(unit, map) {
  const card = map.get(topNumber(unit));
  const plans = (card?.arts || []).map((art) => artPlan(unit, art, map));
  return {
    readyDamage: Math.max(0, ...plans.filter((plan) => plan.ready).map((plan) => plan.damage)),
    ceiling: Math.max(0, ...plans.map((plan) => plan.damage)),
    closestMissing: Math.min(9, ...plans.map((plan) => plan.missing)),
  };
}

function stageThreat(player, map) {
  return ["center", "collab"].reduce((best, zone) => {
    const unit = player?.zones?.[zone];
    return unit && !unit.rested ? Math.max(best, bestArtPlan(unit, map).readyDamage) : best;
  }, 0);
}

function unitScore(unit, zone, map) {
  if (!unit) return 0;
  const card = map.get(topNumber(unit));
  const maxHp = unitMaxHp(unit, map);
  const remaining = Math.max(0, maxHp - Number(unit.damage || 0));
  const bestArt = Math.max(0, ...(card?.arts || []).map((art) => Number(art.damage || 0)));
  const plan = bestArtPlan(unit, map);
  let value = remaining * 0.42 + maxHp * 0.13 + bestArt * 0.24;
  value += (unit.stack?.length || 0) * 16 + (unit.cheer?.length || 0) * 13 + (unit.attachments?.length || 0) * 9;
  if (zone === "center") value += 20;
  if (zone === "collab") value += 24;
  if (!unit.rested) value += 7;
  if (card?.stage === "2nd") value += 20;
  else if (card?.stage === "1st") value += 10;
  value += plan.readyDamage * 0.22 + Math.max(0, 3 - plan.closestMissing) * 8;
  if (["center", "collab"].includes(zone) && plan.readyDamage > 0 && !unit.rested) value += 24;
  return value;
}

function playerScore(player, map) {
  if (!player) return -100000;
  let value = (player.life?.length || 0) * 230;
  value += (player.hand?.length || 0) * 14;
  value += (player.holoPower?.length || 0) * 12;
  value += (player.mainDeck?.length || 0) * 0.8;
  value += (player.archive?.length || 0) * 1.5;
  for (const zone of STAGE_SLOTS) value += unitScore(player.zones?.[zone], zone, map);
  value += ["center", "collab"].filter((zone) => player.zones?.[zone] && !player.zones[zone].rested && bestArtPlan(player.zones[zone], map).readyDamage > 0).length * 35;
  const stageNames = new Set(STAGE_SLOTS.map((zone) => map.get(topNumber(player.zones?.[zone]))).filter(Boolean).flatMap((card) => [card.name, card.jpName, card.enName].filter(Boolean)));
  value += (player.hand || []).filter((instance) => {
    const card = map.get(instance.number);
    return ["1st", "2nd"].includes(card?.stage) && [card?.name, card?.jpName, card?.enName].some((name) => name && stageNames.has(name));
  }).length * 11;
  return value;
}

function evaluateState(state, aiIndex, map) {
  if (state.status === "finished") return state.winner === aiIndex ? 1_000_000 : -1_000_000;
  const player = state.players[aiIndex];
  const opponent = state.players[aiIndex === 0 ? 1 : 0];
  let value = playerScore(player, map) - playerScore(opponent, map);
  const center = player?.zones?.center;
  const opponentCenter = opponent?.zones?.center;
  const centerRemaining = center ? unitMaxHp(center, map) - Number(center.damage || 0) : 0;
  const opponentRemaining = opponentCenter ? unitMaxHp(opponentCenter, map) - Number(opponentCenter.damage || 0) : 0;
  if (center && stageThreat(opponent, map) >= centerRemaining) value -= 95;
  if (opponentCenter && stageThreat(player, map) >= opponentRemaining) value += 80;
  return value;
}

function actionPrior(action, before, aiIndex, map) {
  const player = before.players[aiIndex];
  const opponent = before.players[aiIndex === 0 ? 1 : 0];
  if (action.type === "attack") {
    const source = player?.zones?.[action.sourceZone];
    const sourceCard = map.get(action.artSourceNumber || topNumber(source));
    const art = sourceCard?.arts?.[action.artIndex];
    const target = opponent?.zones?.[action.targetZone];
    const remaining = target ? Math.max(1, unitMaxHp(target, map) - Number(target.damage || 0)) : 999;
    const damage = Number(art?.damage || 0);
    return 34 + Math.min(damage, remaining) * 0.18 + (damage >= remaining ? 125 : 0) + (map.get(topNumber(target))?.stage === "2nd" ? 16 : 0);
  }
  if (action.type === "collab") {
    const unit = player?.zones?.[action.zone];
    const card = map.get(topNumber(unit));
    return 22 + (/合作|コラボ/u.test(cardText(card)) ? 18 : 0) + (bestArtPlan(unit, map).readyDamage > 0 ? 24 : 0);
  }
  if (action.type === "oshiSkill") return 4;
  if (action.type === "spOshiSkill") {
    const text = cardText(map.get(player?.oshi?.number));
    return /額外|追加.*回合|ダウン|擊倒|傷害|回復|抽|加入手牌/u.test(text) ? 14 : -8;
  }
  if (action.type === "attachmentSkill" || action.type === "giftSkill") return 12;
  if (action.type === "play") {
    const instance = player?.hand?.find((card) => card.id === action.cardId);
    const card = map.get(instance?.number);
    const text = cardText(card);
    if (card?.stage === "2nd") return 34;
    if (card?.stage === "1st") return 24;
    if (card?.group === "support") return 9 + (/抽|加入手牌|搜尋|公開|應援|エール/u.test(text) ? 9 : 0);
    return 7;
  }
  if (action.type === "baton") {
    const center = player?.zones?.center;
    const replacement = player?.zones?.[action.zone];
    const remaining = center ? unitMaxHp(center, map) - Number(center.damage || 0) : 0;
    const threatened = center && stageThreat(opponent, map) >= remaining;
    return (threatened ? 52 : -14) + (bestArtPlan(replacement, map).readyDamage > 0 ? 14 : 0);
  }
  if (action.type === "advance") return before.phase === "performance" ? -18 : -10;
  return 0;
}

function combinations(items, count, limit = 20) {
  if (count <= 0) return [[]];
  const result = [];
  function walk(start, chosen) {
    if (result.length >= limit) return;
    if (chosen.length === count) {
      result.push([...chosen]);
      return;
    }
    for (let index = start; index < items.length; index += 1) {
      chosen.push(items[index]);
      walk(index + 1, chosen);
      chosen.pop();
      if (result.length >= limit) break;
    }
  }
  walk(0, []);
  return result;
}

function cardSelectionCandidates(state, pending, aiIndex, map) {
  const player = state.players[aiIndex];
  const selectable = (pending.cards || []).filter((card) => (pending.selectableIds || []).includes(card.id));
  const min = Number(pending.min || 0);
  const max = Math.min(Number(pending.max || 0), selectable.length);
  const looksLikeCost = /cost|discard|archive|bottom/i.test(String(pending.effect || "")) || /成本|支付|存檔|牌庫底|放回/u.test(String(pending.prompt || ""));
  const ranked = [...selectable].sort((left, right) => {
    const difference = cardValue(map.get(right.number), player, map) - cardValue(map.get(left.number), player, map);
    return looksLikeCost ? -difference : difference;
  });
  const counts = [...new Set([min, max, Math.min(max, Math.max(min, Math.ceil((min + max) / 2)))])].filter((count) => count >= min && count <= max);
  const actions = [];
  for (const count of counts) {
    const pool = ranked.slice(0, Math.min(ranked.length, Math.max(count + 3, 7)));
    for (const selected of combinations(pool, count, 12)) actions.push({ type: "choose", cardIds: selected.map((card) => card.id) });
    if (count > 1) actions.push({ type: "choose", cardIds: ranked.slice(0, count).reverse().map((card) => card.id) });
  }
  if (pending.optional) actions.push({ type: "choose", skip: true });
  return actions;
}

function pendingCandidates(state, aiIndex, map) {
  const pending = state.pendingChoice;
  if (!pending || pending.playerIndex !== aiIndex) return [];
  if (pending.type === "cardSelection") return cardSelectionCandidates(state, pending, aiIndex, map);
  if (pending.type === "optionChoice") {
    const actions = (pending.modeOptions || []).filter((option) => !option.disabled).map((option) => ({ type: "choose", optionId: option.id }));
    if (pending.optional) actions.push({ type: "choose", skip: true });
    return actions;
  }
  if (pending.type === "ordinaryComputer") {
    const actions = [];
    for (const number of pending.options || []) for (const zone of pending.zones || []) actions.push({ type: "choose", cardNumber: number, zone });
    if (pending.optional) actions.push({ type: "choose", skip: true });
    return actions;
  }
  if (pending.type === "healDistribution") {
    const count = Math.max(0, Number(pending.count || 0));
    const unitAmount = Math.max(1, Number(pending.unitAmount || 20));
    const zones = (pending.options || []).filter((zone) => state.players[aiIndex]?.zones?.[zone]);
    if (count === 0 || zones.length === 0) return [];
    const ranked = [...zones].sort((left, right) => {
      const leftUnit = state.players[aiIndex].zones[left];
      const rightUnit = state.players[aiIndex].zones[right];
      const leftPriority = Number(leftUnit?.damage || 0) * 3 + unitScore(leftUnit, left, map) + (left === "center" ? 35 : 0);
      const rightPriority = Number(rightUnit?.damage || 0) * 3 + unitScore(rightUnit, right, map) + (right === "center" ? 35 : 0);
      return rightPriority - leftPriority;
    });
    const greedy = {};
    let remaining = count;
    for (const zone of ranked) {
      const useful = Math.ceil(Number(state.players[aiIndex].zones[zone]?.damage || 0) / unitAmount);
      const assigned = Math.min(remaining, useful);
      if (assigned > 0) greedy[zone] = assigned;
      remaining -= assigned;
    }
    if (remaining > 0) greedy[ranked[0]] = Number(greedy[ranked[0]] || 0) + remaining;
    const focused = { [ranked[0]]: count };
    const spread = {};
    for (let index = 0; index < count; index += 1) spread[ranked[index % ranked.length]] = Number(spread[ranked[index % ranked.length]] || 0) + 1;
    return [...new Map([greedy, focused, spread].map((allocations) => [JSON.stringify(allocations), { type: "choose", allocations }])).values()];
  }
  const cheerTypes = new Set(["moveCheer", "archiveCheerForSkill", "payStageCheerForSearch", "moveStageCheerSource", "stageCheerSelection"]);
  if (cheerTypes.has(pending.type)) {
    const actions = (pending.options || []).map((cheerId) => ({ type: "choose", cheerId }));
    if (pending.optional) actions.push({ type: "choose", skip: true });
    return actions;
  }
  if (pending.type === "stageAttachmentSelection") {
    const actions = (pending.options || []).map((attachmentId) => ({ type: "choose", attachmentId }));
    if (pending.optional) actions.push({ type: "choose", skip: true });
    return actions;
  }
  const actions = (pending.options || []).map((zone) => ({ type: "choose", zone }));
  if (pending.optional) actions.push({ type: "choose", skip: true });
  return actions;
}

function setupCandidate(state, aiIndex, map) {
  const player = state.players[aiIndex];
  const debut = player.hand.filter((instance) => map.get(instance.number)?.stage === "Debut").sort((left, right) => cardValue(map.get(right.number), player, map) - cardValue(map.get(left.number), player, map));
  if (debut.length === 0) return { type: "redraw" };
  const center = debut[0];
  const back = player.hand.filter((instance) => instance.id !== center.id && ["Debut", "Spot"].includes(map.get(instance.number)?.stage)).sort((left, right) => cardValue(map.get(right.number), player, map) - cardValue(map.get(left.number), player, map)).slice(0, 5);
  const staged = new Set([center.id, ...back.map((card) => card.id)]);
  const bottomIds = player.hand.filter((card) => !staged.has(card.id)).sort((left, right) => cardValue(map.get(left.number), player, map) - cardValue(map.get(right.number), player, map)).slice(0, Number(player.forcedRedraws || 0)).map((card) => card.id);
  return { type: "setup", centerId: center.id, backIds: back.map((card) => card.id), bottomIds };
}

function regularCandidates(state, aiIndex, map) {
  const player = state.players[aiIndex];
  if (state.status === "setup" && !player.setupDone) return [setupCandidate(state, aiIndex, map)];
  if (state.status !== "playing" || state.activePlayer !== aiIndex) return [];
  if (state.phase === "main") {
    const actions = player.hand.map((card) => ({ type: "play", cardId: card.id }));
    for (const zone of BACK_SLOTS) if (player.zones[zone]) actions.push({ type: "collab", zone }, { type: "baton", zone });
    for (const zone of STAGE_SLOTS) if (player.zones[zone]) actions.push({ type: "attachmentSkill", zone }, { type: "giftSkill", zone });
    for (const card of player.archive || []) actions.push({ type: "giftSkill", cardNumber: card.number });
    actions.push({ type: "oshiSkill" }, { type: "spOshiSkill" }, { type: "advance" });
    return actions;
  }
  if (state.phase === "performance") {
    const opponent = state.players[aiIndex === 0 ? 1 : 0];
    const actions = [];
    for (const sourceZone of ["center", "collab", ...BACK_SLOTS]) {
      const source = player.zones[sourceZone];
      if (!source || source.rested) continue;
      const sourceCard = map.get(topNumber(source));
      for (let artIndex = 0; artIndex < (sourceCard?.arts || []).length; artIndex += 1) for (const targetZone of STAGE_SLOTS) if (opponent.zones[targetZone]) actions.push({ type: "attack", sourceZone, artIndex, targetZone });
      if (sourceCard?.number === "hBP07-048") {
        const copied = [...new Set(STAGE_SLOTS.map((zone) => map.get(topNumber(player.zones[zone]))).filter((card) => card && card.number !== sourceCard.number && (card.tags || []).includes("#EN")).map((card) => card.number))];
        for (const artSourceNumber of copied) for (let artIndex = 0; artIndex < (map.get(artSourceNumber)?.arts || []).length; artIndex += 1) for (const targetZone of STAGE_SLOTS) if (opponent.zones[targetZone]) actions.push({ type: "attack", sourceZone, artIndex, artSourceNumber, targetZone });
      }
    }
    actions.push({ type: "advance" });
    return actions;
  }
  return [];
}

function continuationScore(state, aiIndex, cards, map, depth) {
  const base = evaluateState(state, aiIndex, map);
  if (depth <= 0 || !state.pendingChoice || state.pendingChoice.playerIndex !== aiIndex) return base;
  const candidates = pendingCandidates(state, aiIndex, map).slice(0, 28);
  let best = -Infinity;
  for (const action of candidates) {
    try {
      const simulated = applyAction(state, aiIndex, action, cards, () => 0.5);
      const score = continuationScore(simulated, aiIndex, cards, map, depth - 1) + actionPrior(action, state, aiIndex, map) * 0.35;
      if (score > best) best = score;
    } catch { /* keep exploring legal continuations */ }
  }
  return Number.isFinite(best) ? best : base;
}

function chooseAiAction(state, aiIndex, cards, excluded = new Set()) {
  const map = cardMap(cards);
  const candidates = state.pendingChoice ? pendingCandidates(state, aiIndex, map) : regularCandidates(state, aiIndex, map);
  let best = null;
  for (const action of candidates) {
    if (excluded.has(JSON.stringify(action))) continue;
    try {
      const simulated = applyAction(state, aiIndex, action, cards, () => 0.5);
      const score = continuationScore(simulated, aiIndex, cards, map, 2) + actionPrior(action, state, aiIndex, map);
      if (!best || score > best.score) best = { action, score };
    } catch { /* use the live rules engine as the legality oracle */ }
  }
  return best?.action || null;
}

function decisionFingerprint(state) {
  const copy = structuredClone(state);
  delete copy.log;
  delete copy.aiLastStepCount;
  return JSON.stringify(copy);
}

function aiNeedsToAct(state, aiIndex) {
  if (state.status === "finished") return false;
  if (state.pendingChoice) return state.pendingChoice.playerIndex === aiIndex;
  if (state.status === "setup") return !state.players[aiIndex]?.setupDone;
  return state.status === "playing" && state.activePlayer === aiIndex;
}

export function runAiStep(stateInput, cards, aiIndex = 1, random) {
  let state = structuredClone(stateInput);
  if (!aiNeedsToAct(state, aiIndex)) {
    state.aiLastStepCount = 0;
    return state;
  }
  const action = chooseAiAction(state, aiIndex, cards);
  if (!action) {
    state.aiLastStepCount = 0;
    return state;
  }
  state = applyAction(state, aiIndex, action, cards, random);
  state.aiLastStepCount = 1;
  return state;
}

export function runAiUntilHuman(stateInput, cards, aiIndex = 1, random) {
  let state = structuredClone(stateInput);
  let steps = 0;
  const attempted = new Map();
  while (aiNeedsToAct(state, aiIndex) && steps < MAX_AI_STEPS) {
    const fingerprint = decisionFingerprint(state);
    const excluded = attempted.get(fingerprint) || new Set();
    const action = chooseAiAction(state, aiIndex, cards, excluded);
    if (!action) break;
    excluded.add(JSON.stringify(action));
    attempted.set(fingerprint, excluded);
    state = applyAction(state, aiIndex, action, cards, random);
    steps += 1;
  }
  state.aiLastStepCount = steps;
  return state;
}

export { chooseAiAction, evaluateState };
