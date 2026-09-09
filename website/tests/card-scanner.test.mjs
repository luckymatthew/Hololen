import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { normalizeScanText, createScanIndex, matchScanText, cameraCrop } from "../lib/card-scanner.mjs";

const cards = JSON.parse(fs.readFileSync(new URL("../public/cards.json", import.meta.url))).cards;
const japanese = JSON.parse(fs.readFileSync(new URL("../public/scanner-ja.json", import.meta.url))).cards;
const index = createScanIndex(cards, japanese);

test("all existing card numbers round-trip without selecting a parallel printing", () => {
  for (const card of cards) {
    const result = matchScanText(index, card.number);
    assert.equal(result.autoNumber, card.number, card.number);
  }
});

test("normalizes fullwidth characters, spaces, punctuation and kana", () => {
  assert.equal(normalizeScanText("ＨＢＰ０４－００８"), "hbp04008");
  assert.equal(normalizeScanText("パソコン"), normalizeScanText("ぱそこん"));
  assert.equal(matchScanText(index, "ｈＥＢ０１－００３").autoNumber, "hEB01-003");
  assert.equal(matchScanText(index, "h EB 01 - 003").autoNumber, "hEB01-003");
});

test("member plus distinctive skill identifies Koyori without a card number", () => {
  assert.equal(matchScanText(index, "博衣こより\n解析完了！ 二人だけの独占海域").autoNumber, "hEB01-003");
  assert.equal(matchScanText(index, "姫森ルーナ パソコンならわかるのら").autoNumber, "hBP03-001");
});

test("generic text, member alone, missing card, and multiple cards never auto-open", () => {
  for (const value of ["", "!?", "博衣こより", "自分のデッキをシャッフルする", "hEB01-999", "hBP04-008 hBP04-020", "hEB01-003 hEB01-999", "HP 100 Debut"]) {
    assert.equal(matchScanText(index, value).autoNumber, null, value);
  }
  assert.deepEqual(matchScanText(index, "hEB01-999").matches, []);
});

test("skill text and HP rank the correct same-member card", () => {
  assert.equal(matchScanText(index, "博衣こより こんこよ～ HP100 Debut").matches[0].number, "hBP04-008");
});

test("Japanese effect fragments work and the supplemental index cannot invent cards", () => {
  const found = matchScanText(index, "自分のデッキから、カード名に「パソコン」を含むアイテム1枚を公開し");
  assert.ok(found.matches.some(match => match.number === "hBP03-001"));
  assert.equal(found.autoNumber, null);
  const known = new Set(cards.map(card => card.number));
  assert.ok(Object.keys(japanese).length > 1200);
  for (const number of Object.keys(japanese)) assert.ok(known.has(number));
});

test("camera crop maps square guide correctly for portrait and landscape sensors", () => {
  const view = { left: 10, top: 20, width: 300, height: 300 };
  const guide = { left: 70, top: 35, width: 180, height: 270 };
  for (const [width, height] of [[1920, 1080], [1080, 1920]]) {
    const crop = cameraCrop(width, height, view, guide);
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= width && crop.y + crop.height <= height);
    assert.ok(Math.abs(crop.width / crop.height - 180 / 270) < 0.001);
    assert.equal(Math.round(crop.x + crop.width / 2), width / 2);
  }
});
