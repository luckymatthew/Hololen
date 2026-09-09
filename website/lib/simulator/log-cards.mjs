export function buildCardReferenceIndex(cards) {
  return {
    cardByNumber: new Map(cards.map((card) => [card.number, card])),
    numbers: [...new Set(cards.map((card) => card.number).filter(Boolean))]
      .sort((left, right) => right.length - left.length),
  };
}

function matchingSnapshot(number, cardRefs, usedIds) {
  const snapshot = (cardRefs || []).find((instance) => instance?.number === number && !usedIds.has(instance.id));
  return snapshot ? { ...snapshot } : null;
}

export function cardReferenceTokens(message, index, cardRefs = []) {
  if (!message || !index?.cardByNumber) return [{ type: "text", value: String(message || "") }];
  const tokens = [];
  const usedIds = new Set();
  let text = "";
  let position = 0;
  const flushText = () => {
    if (!text) return;
    tokens.push({ type: "text", value: text });
    text = "";
  };
  const pushCard = (number, matched) => {
    const instance = matchingSnapshot(number, cardRefs, usedIds);
    if (!instance) return false;
    flushText();
    usedIds.add(instance.id);
    tokens.push({ type: "card", matched, instance });
    return true;
  };

  while (position < message.length) {
    const compound = message.slice(position).match(/^「([^」]+)」[（(]([^）)]+)[）)]/u);
    if (compound && index.cardByNumber.has(compound[2])) {
      if (!pushCard(compound[2], compound[0])) text += compound[0];
      position += compound[0].length;
      continue;
    }
    const number = index.numbers.find((candidate) => message.startsWith(candidate, position));
    if (!number) {
      text += message[position];
      position += 1;
      continue;
    }
    if (!pushCard(number, number)) text += number;
    position += number.length;
  }
  flushText();
  return tokens.length > 0 ? tokens : [{ type: "text", value: message }];
}
