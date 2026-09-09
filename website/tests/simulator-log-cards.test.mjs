import test from "node:test";
import assert from "node:assert/strict";
import { buildCardReferenceIndex, cardReferenceTokens } from "../lib/simulator/log-cards.mjs";

const cards = [
  { number: "hBP01-007", name: "星街彗星", jpName: "星街すいせい" },
  { number: "hEB01-020", name: "博衣小夜璃", jpName: "博衣こより" },
  { number: "hEB01-024", name: "博衣小夜璃", jpName: "博衣こより" },
];

test("battle log never resolves an ambiguous card name to a current board card", () => {
  const index = buildCardReferenceIndex(cards);
  const tokens = cardReferenceTokens("Matthew 讓 博衣小夜璃 Bloom。", index, [
    { id: "second", number: "hEB01-024", variantId: "sec-printing" },
    { id: "first", number: "hEB01-020", variantId: "rare-printing" },
  ]);
  assert.deepEqual(tokens, [
    { type: "text", value: "Matthew 讓 博衣小夜璃 Bloom。" },
  ]);
});

test("battle log resolves only an explicit card code and preserves its event printing", () => {
  const index = buildCardReferenceIndex(cards);
  const tokens = cardReferenceTokens("星街彗星 使用 hBP01-007。", index, [
    { id: "suisei-sr", number: "hBP01-007", variantId: "sr-printing" },
  ]);
  assert.deepEqual(tokens, [
    { type: "text", value: "星街彗星 使用 " },
    { type: "card", matched: "hBP01-007", instance: { id: "suisei-sr", number: "hBP01-007", variantId: "sr-printing" } },
    { type: "text", value: "。" },
  ]);
});

test("battle log never invents artwork for a code without an event snapshot", () => {
  const index = buildCardReferenceIndex(cards);
  assert.deepEqual(cardReferenceTokens("AIこより公開 hEB01-020 加入手牌。", index), [
    { type: "text", value: "AIこより公開 hEB01-020 加入手牌。" },
  ]);
});

test("battle log renders a card-name and card-number pair only once", () => {
  const index = buildCardReferenceIndex(cards);
  const tokens = cardReferenceTokens("Matthew 展示 「博衣小夜璃」（hEB01-020）。", index, [
    { id: "revealed-first", number: "hEB01-020", variantId: "rare-printing" },
  ]);
  assert.deepEqual(tokens, [
    { type: "text", value: "Matthew 展示 " },
    { type: "card", matched: "「博衣小夜璃」（hEB01-020）", instance: { id: "revealed-first", number: "hEB01-020", variantId: "rare-printing" } },
    { type: "text", value: "。" },
  ]);
});

test("battle log preserves repeated copies and their exact printings", () => {
  const index = buildCardReferenceIndex(cards);
  const tokens = cardReferenceTokens("展示 「博衣小夜璃」（hEB01-020）、「博衣小夜璃」（hEB01-020）。", index, [
    { id: "copy-one", number: "hEB01-020", variantId: "printing-one" },
    { id: "copy-two", number: "hEB01-020", variantId: "printing-two" },
  ]);
  const references = tokens.filter((token) => token.type === "card").map((token) => token.instance);
  assert.deepEqual(references, [
    { id: "copy-one", number: "hEB01-020", variantId: "printing-one" },
    { id: "copy-two", number: "hEB01-020", variantId: "printing-two" },
  ]);
});
