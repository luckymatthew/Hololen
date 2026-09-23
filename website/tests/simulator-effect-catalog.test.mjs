import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTOMATED_SUPPORT_CARDS,
  DECK_SEARCH_EFFECTS,
  SIMPLE_SUPPORT_EFFECTS,
  TOP_LOOK_EFFECTS,
} from "../lib/simulator/effect-catalog.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
const cardMap = new Map(cards.map((card) => [card.number, card]));

test("every declarative effect points to a real support card", () => {
  const declarativeIds = [
    ...Object.keys(TOP_LOOK_EFFECTS),
    ...Object.keys(DECK_SEARCH_EFFECTS),
    ...Object.keys(SIMPLE_SUPPORT_EFFECTS),
  ];
  assert.equal(new Set(declarativeIds).size, declarativeIds.length, "effect families must not overlap");
  for (const number of declarativeIds) {
    assert.equal(cardMap.get(number)?.group, "support", `${number} must exist as a support card`);
  }
});

test("the automated support list is unique and covers every effect family", () => {
  assert.equal(new Set(AUTOMATED_SUPPORT_CARDS).size, AUTOMATED_SUPPORT_CARDS.length);
  assert.equal(AUTOMATED_SUPPORT_CARDS.filter(n => !n.startsWith('hBP09-')).length, 112);
  assert.deepEqual(AUTOMATED_SUPPORT_CARDS.filter(n => n.startsWith('hBP09-')).sort(), Array.from({length:16},(_,i)=>`hBP09-${String(90+i).padStart(3,'0')}`));
  assert.equal(AUTOMATED_SUPPORT_CARDS.length, 128);
  for (const number of [
    ...Object.keys(TOP_LOOK_EFFECTS),
    ...Object.keys(DECK_SEARCH_EFFECTS),
    ...Object.keys(SIMPLE_SUPPORT_EFFECTS),
  ]) assert.ok(AUTOMATED_SUPPORT_CARDS.includes(number), `${number} must be exposed to the simulator UI`);
});
