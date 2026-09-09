import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { pool, state, dummy, inst, unit, attack } from "./fixtures/simulator-audit.mjs";

const fubuki = { ...dummy, number: "AUDIT-FUBUKI", name: "白上フブキ", jpName: "白上フブキ", hp: 100 };
const other = { ...dummy, number: "AUDIT-OTHER", name: "Other", jpName: "Other", hp: 100 };
const attacker = { ...dummy, number: "AUDIT-110", arts: [{ name: "110 damage", damage: 110, cost: [], effect: "" }] };
const cards = [...pool, fubuki, other, attacker];
const act = (s, action) => applyAction(structuredClone(s), 0, action, cards, () => 0.5);

function setup(holder = fubuki, cheerCount = 2) {
  const s = state(holder.number);
  s.phase = "main";
  s.players[0].zones.center.attachments = [inst("hBP02-092", "fubura")];
  s.players[0].zones.center.cheer = Array.from({ length: cheerCount }, (_, index) => inst("hY01-001", `cost-${index + 1}`));
  s.players[0].zones.back1 = unit(dummy.number, { cheer: [inst("hY01-001", "other-cheer")] });
  return s;
}

test("Fubura does not grant Arts +50 without paying its two-Cheer cost", () => {
  let s = setup();
  s.phase = "performance";
  s = act(s, attack);
  assert.equal(s.players[1].zones.center.damage, 100);
});

test("Fubura archives exactly two Cheer from its holder then grants Arts +50 this turn", () => {
  let s = act(setup(), { type: "attachmentSkill", zone: "center", cardNumber: "hBP02-092" });
  assert.equal(s.pendingChoice.type, "stageCheerSelection");
  assert.equal(s.pendingChoice.optional, true);
  assert.deepEqual(new Set(s.pendingChoice.options), new Set(["cost-1", "cost-2"]));
  assert.equal(s.pendingChoice.options.includes("other-cheer"), false);

  s = act(s, { type: "choose", cheerId: "cost-1" });
  assert.equal(s.pendingChoice.type, "stageCheerSelection");
  assert.equal(s.pendingChoice.optional, false);
  assert.deepEqual(s.pendingChoice.options, ["cost-2"]);
  assert.equal(s.players[0].archive.at(-1).id, "cost-1");

  s = act(JSON.parse(JSON.stringify(s)), { type: "choose", cheerId: "cost-2" });
  assert.equal(s.pendingChoice, null);
  assert.deepEqual(s.players[0].archive.slice(-2).map((card) => card.id), ["cost-1", "cost-2"]);
  assert.equal(s.players[0].namedUsageTurns["attachment:hBP02-092:fubura"], 3);

  assert.throws(() => act(s, { type: "attachmentSkill", zone: "center", cardNumber: "hBP02-092" }), /每回合 1 次/);
  s.phase = "performance";
  s = act(s, attack);
  assert.equal(s.players[1].zones.center.damage, 150);
});

test("Fubura activation may be cancelled before paying any Cheer", () => {
  let s = act(setup(), { type: "attachmentSkill", zone: "center", cardNumber: "hBP02-092" });
  s = act(s, { type: "choose", skip: true });
  assert.equal(s.players[0].zones.center.cheer.length, 2);
  assert.equal(s.players[0].archive.length, 0);
  assert.equal(s.players[0].namedUsageTurns?.["attachment:hBP02-092:fubura"], undefined);
});

test("Fubura requires a Fubuki holder and two Cheer on that same holder", () => {
  assert.throws(() => act(setup(other), { type: "attachmentSkill", zone: "center", cardNumber: "hBP02-092" }), /白上フブキ/);
  assert.throws(() => act(setup(fubuki, 1), { type: "attachmentSkill", zone: "center", cardNumber: "hBP02-092" }), /2 張應援/);
});

test("Fubura retains its unconditional HP +20", () => {
  let s = state(attacker.number, fubuki.number);
  s.players[1].zones.center.attachments = [inst("hBP02-092", "fubura")];
  s = act(s, attack);
  assert.equal(s.players[1].zones.center.damage, 110);
  assert.equal(s.players[1].life.length, 5);
});
