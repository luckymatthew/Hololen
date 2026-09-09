import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { pool, state, dummy, inst, unit, attack } from "./fixtures/simulator-audit.mjs";

const fubuki = { ...dummy, number: "AUDIT-KO-FUBUKI", name: "白上フブキ", jpName: "白上フブキ", hp: 100 };
const other = { ...dummy, number: "AUDIT-KO-OTHER", name: "Other", jpName: "Other", hp: 100 };
const attacker119 = { ...dummy, number: "AUDIT-119", arts: [{ name: "119 damage", damage: 119, cost: [], effect: "" }] };
const attacker120 = { ...dummy, number: "AUDIT-120", arts: [{ name: "120 damage", damage: 120, cost: [], effect: "" }] };
const cards = [...pool, fubuki, other, attacker119, attacker120];
const act = (s, playerIndex, action) => applyAction(structuredClone(s), playerIndex, action, cards, () => 0.5);

function setup(holder = fubuki, withCheer = true) {
  const s = state(attacker120.number, holder.number);
  s.players[1].zones.center.attachments = [inst("hBP02-090", "fox")];
  s.players[1].zones.center.cheer = withCheer ? [inst("hY01-001", "ko-cheer")] : [];
  s.players[1].zones.back1 = unit(dummy.number);
  return s;
}

test("Wind-up Fox requires one Cheer selection and transfers it to another Holomen", () => {
  let s = act(setup(), 0, attack);
  assert.equal(s.players[1].zones.center.downPending, true);
  assert.equal(s.pendingChoice.type, "cardSelection");
  assert.equal(s.pendingChoice.effect, "koTransferCheer");
  assert.equal(s.pendingChoice.min, 1);
  assert.equal(s.pendingChoice.max, 1);
  assert.equal(s.pendingChoice.optional, false);
  assert.deepEqual(s.pendingChoice.selectableIds, ["ko-cheer"]);
  assert.throws(() => act(s, 1, { type: "choose", skip: true }), /選擇 1 張卡/);
  assert.throws(() => act(s, 1, { type: "choose", cardIds: [] }), /選擇 1 張卡/);

  s = act(JSON.parse(JSON.stringify(s)), 1, { type: "choose", cardIds: ["ko-cheer"] });
  assert.equal(s.pendingChoice.type, "stageTarget");
  assert.deepEqual(s.pendingChoice.options, ["back1"]);
  s = act(s, 1, { type: "choose", zone: "back1" });
  assert.ok(s.players[1].zones.back1.cheer.some((card) => card.id === "ko-cheer"));
  assert.equal(s.pendingChoice.type, "lifeCheerTarget");
});

test("Wind-up Fox does not trigger on a non-Fubuki holder or without Cheer", () => {
  let s = act(setup(other), 0, attack);
  assert.equal(s.pendingChoice.type, "lifeCheerTarget");
  assert.equal(s.pendingChoice.effect, undefined);

  s = act(setup(fubuki, false), 0, attack);
  assert.equal(s.pendingChoice.type, "lifeCheerTarget");
  assert.equal(s.pendingChoice.effect, undefined);
});

test("Wind-up Fox retains its unconditional HP +20", () => {
  const s = setup();
  s.players[0].zones.center = unit(attacker119.number);
  const result = act(s, 0, attack);
  assert.equal(result.players[1].zones.center.damage, 119);
  assert.equal(result.players[1].life.length, 5);
});
