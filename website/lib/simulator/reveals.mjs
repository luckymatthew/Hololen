export function revealedCardNumbers(message, cards) {
  if (!/(?:公開|展示)/u.test(message)) return [];

  const explicit = cards.flatMap((card) => {
    const matches = [];
    let start = 0;
    while (card.number && start < message.length) {
      const index = message.indexOf(card.number, start);
      if (index < 0) break;
      matches.push({ number: card.number, index });
      start = index + card.number.length;
    }
    return matches;
  }).sort((left, right) => left.index - right.index);
  return explicit.map((match) => match.number).slice(0, 12);
}
