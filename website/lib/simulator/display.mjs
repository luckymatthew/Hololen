function topNumber(unit) {
  return unit?.stack?.[unit.stack.length - 1]?.number || "";
}

function cardNameIncludes(card, names) {
  const value = `${card?.name || ""} ${card?.jpName || ""}`;
  return names.some((name) => value.includes(name));
}

export function suuBatonIncrease(player, cardMap) {
  return ["center", "collab"].reduce((total, zone) => {
    const unit = player?.zones?.[zone];
    const isSuu = cardNameIncludes(cardMap.get(topNumber(unit)), ["水宮樞", "水宮枢"]);
    if (!isSuu) return total;
    return total + (unit?.attachments || []).filter((instance) => instance.number === "hBP08-104").length;
  }, 0);
}

export function displayedBatonCost(card, unit, turn, opponentIncrease = 0) {
  const base = Math.max(0, Number(card?.baton || 0));
  const modifier = (unit?.modifiers || [])
    .filter((item) => item.kind === "batonCost" && Number(item.expiresTurn || 0) >= turn)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
  const isKorone = cardNameIncludes(card, ["戌神沁音", "戌神ころね"]);
  const fanReduction = isKorone ? (unit?.attachments || []).filter((instance) => instance.number === "hBP03-111").length : 0;
  return Math.max(0, base + modifier - fanReduction + Number(opponentIncrease || 0));
}
