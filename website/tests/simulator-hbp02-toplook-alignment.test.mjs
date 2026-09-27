import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { cards, pool, state, inst } from "./fixtures/simulator-audit.mjs";

const topLookCases = [
  ["hBP02-078", card => ["天音かなた", "AZKi", "沙花叉クロヱ"].some(name => card.jpName === name || card.name === name)],
  ["hBP02-080", card => card.tags?.includes("#秘密結社holoX")],
  ["hBP02-081", card => card.tags?.includes("#ID2期生")],
  ["hBP02-082", card => card.tags?.includes("#ゲーマーズ")],
  ["hBP02-085", card => card.tags?.includes("#3期生")],
];

for (const [number, matches] of topLookCases) {
  test(`${number} searches the printed group across the top four and allows any matching count`, () => {
    const match = cards.find(card => card.group === "holomem" && matches(card));
    assert.ok(match, `fixture has no matching Holomen for ${number}`);
    const s = state();
    s.phase = "main";
    s.players[0].hand = [inst(number, "event")];
    s.players[0].mainDeck = [
      inst(match.number, "match-1"), inst(match.number, "match-2"),
      inst("AUDIT-DUMMY", "wrong-1"), inst("hBP02-079", "wrong-2"),
    ];

    let next = applyAction(s, 0, { type: "play", cardId: "event" }, pool, () => 0.5);
    assert.equal(next.pendingChoice?.effect, "topLookToHand");
    assert.equal(next.pendingChoice?.optional, true);
    assert.equal(next.pendingChoice?.min, 0);
    assert.equal(next.pendingChoice?.max, 2);
    assert.deepEqual(next.pendingChoice?.selectableIds, ["match-1", "match-2"]);

    next = applyAction(next, 0, { type: "choose", cardIds: ["match-1", "match-2"] }, pool, () => 0.5);
    assert.equal(next.pendingChoice?.effect, "bottomOrder");
    next = applyAction(next, 0, { type: "choose", cardIds: ["wrong-1", "wrong-2"] }, pool, () => 0.5);
    assert.deepEqual(next.players[0].hand.map(card => card.id), ["match-1", "match-2"]);
    assert.deepEqual(next.players[0].mainDeck.map(card => card.id), ["wrong-1", "wrong-2"]);
    assert.equal(next.players[0].limitedUsesCount, 1);
  });

  test(`${number} enforces the six-card hand gate after excluding the played Support`, () => {
    const match = cards.find(card => card.group === "holomem" && matches(card));
    assert.ok(match, `fixture has no matching Holomen for ${number}`);
    const makeState = count => {
      const s = state();
      s.phase = "main";
      s.players[0].hand = [inst(number, "event"), ...Array.from({ length: count }, (_, index) => inst("hBP02-079", `other-${index}`))];
      s.players[0].mainDeck = [inst(match.number, "matching-top"), inst("AUDIT-DUMMY", "bottom-1"), inst("AUDIT-DUMMY", "bottom-2"), inst("AUDIT-DUMMY", "bottom-3")];
      return s;
    };

    const allowed = applyAction(makeState(6), 0, { type: "play", cardId: "event" }, pool, () => 0.5);
    assert.equal(allowed.pendingChoice?.effect, "topLookToHand");
    assert.throws(() => applyAction(makeState(7), 0, { type: "play", cardId: "event" }, pool, () => 0.5), /手牌不可多於 6 張/u);
  });
}
