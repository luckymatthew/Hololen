import fs from "node:fs";
import path from "node:path";
import { enrichOshiCardMetadata } from "../lib/simulator/oshi-skill-catalog.mjs";

const cardsPath = path.resolve(process.argv[2] || "public/cards.json");
const payload = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
const cards = Array.isArray(payload) ? payload : payload.cards;

if (!Array.isArray(cards)) throw new Error(`${cardsPath} does not contain a card list.`);

const enrichedCards = cards.map(enrichOshiCardMetadata);
const output = Array.isArray(payload) ? enrichedCards : { ...payload, cards: enrichedCards };
fs.writeFileSync(cardsPath, JSON.stringify(output));

const oshiCards = enrichedCards.filter((card) => card.group === "oshi");
console.log(`Updated ${oshiCards.length} Oshi cards in ${cardsPath}.`);
