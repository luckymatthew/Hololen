import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "../lib/simulator/engine.mjs";
import { cards, pool, state, dummy, inst, unit, attack, fund } from "./fixtures/simulator-audit.mjs";

const act = (s, playerIndex, action, map = pool) => applyAction(structuredClone(s), playerIndex, action, map, () => 0.5);
const named = (name, stage) => cards.find(card => card.group === "holomem" && card.jpName === name && (!stage || card.stage === stage));

test("hBP02-079 deals 20 special damage to Center/Collab, causes no Life loss on KO, and shares the #Magic event limit", () => {
  const weak = { ...dummy, number: "AUDIT-WEAK-CENTER", name: "Weak Center", jpName: "Weak Center", hp: 100 };
  const map = [...pool, weak];
  let s = state(dummy.number, weak.number);
  s.phase = "main";
  s.players[0].hand = [inst("hBP02-079", "explosion"), inst("hBP02-083", "wardrobe")];
  s.players[1].zones.center = unit(weak.number, { damage: 90 });
  s.players[1].zones.back1 = unit(dummy.number);
  const lifeBefore = s.players[1].life.length;

  s = act(s, 0, { type: "play", cardId: "explosion" }, map);
  assert.equal(s.pendingChoice?.type, "stageTarget");
  assert.deepEqual(s.pendingChoice?.rule?.zones, ["center", "collab"]);
  s = act(s, 0, { type: "choose", zone: "center" }, map);
  assert.equal(s.players[1].zones.center, null);
  assert.equal(s.players[1].life.length, lifeBefore);
  assert.throws(() => act(s, 0, { type: "play", cardId: "wardrobe" }, map), /#魔法/u);
});

test("hBP02-083 pays one Holo Power, attaches a purple Archive Cheer to own Shion, and records the shared Magic limit", () => {
  const shion = named("紫咲シオン", "Debut");
  const purple = cards.find(card => card.group === "cheer" && card.colors?.includes("紫"));
  assert.ok(shion && purple);
  let s = state();
  s.phase = "main";
  s.players[0].zones.center = unit(shion.number);
  s.players[0].hand = [inst("hBP02-083", "wardrobe")];
  s.players[0].holoPower = [inst("hY01-001", "paid-power")];
  s.players[0].archive = [inst(purple.number, "purple-cheer")];

  s = act(s, 0, { type: "play", cardId: "wardrobe" });
  assert.equal(s.players[0].holoPower.length, 0);
  assert.ok(s.players[0].archive.some(card => card.id === "paid-power"));
  assert.deepEqual(s.pendingChoice?.selectableIds, ["purple-cheer"]);
  s = act(s, 0, { type: "choose", cardIds: ["purple-cheer"] });
  assert.equal(s.pendingChoice?.type, "stageTarget");
  assert.deepEqual(s.pendingChoice?.options, ["center"]);
  s = act(s, 0, { type: "choose", zone: "center" });
  assert.ok(s.players[0].zones.center.cheer.some(card => card.id === "purple-cheer"));
  assert.equal(s.players[0].namedUsageTurns.magicEvent, s.turn);
});

test("hBP02-086 adds its printed +20 to Arts damage", () => {
  const source = { ...dummy, number: "AUDIT-TOOL-ARTS", arts: [{ name: "Audit Arts", damage: 100, cost: [], effect: "" }] };
  const map = [...pool, source];
  let s = state(source.number);
  s.phase = "performance";
  s.players[0].zones.center.attachments = [inst("hBP02-086", "sparkling")];
  s = act(s, 0, attack, map);
  assert.equal(s.players[1].zones.center.damage, 120);
});

test("hBP02-089 draws on Fubuki Collab after the Collab card moves to Holo Power", () => {
  const fubuki = named("白上フブキ", "Debut");
  assert.ok(fubuki);
  let s = state();
  s.phase = "main";
  s.players[0].zones.back1 = unit(fubuki.number, { attachments: [inst("hBP02-089", "mascot")] });
  s.players[0].mainDeck = [inst("AUDIT-POWER", "collab-power"), inst("AUDIT-DRAW", "collab-draw"), ...s.players[0].mainDeck.slice(2)];
  s = act(s, 0, { type: "collab", zone: "back1" });
  assert.deepEqual(s.players[0].holoPower.map(card => card.id), ["collab-power"]);
  assert.ok(s.players[0].hand.some(card => card.id === "collab-draw"));
});

test("hBP02-091 may return one Archive Mascot to hand on Fubuki Collab", () => {
  const fubuki = named("白上フブキ", "Debut");
  assert.ok(fubuki);
  let s = state();
  s.phase = "main";
  s.players[0].zones.back1 = unit(fubuki.number, { attachments: [inst("hBP02-091", "mascot")] });
  s.players[0].archive = [inst("hBP02-089", "archive-mascot")];
  s = act(s, 0, { type: "collab", zone: "back1" });
  assert.equal(s.pendingChoice?.effect, "archiveToHand");
  assert.equal(s.pendingChoice?.optional, true);
  s = act(s, 0, { type: "choose", cardIds: ["archive-mascot"] });
  assert.ok(s.players[0].hand.some(card => card.id === "archive-mascot"));
  assert.ok(!s.players[0].archive.some(card => card.id === "archive-mascot"));
});

test("hBP02-094 grants Reine +10 Arts and its conditional +30 HP", () => {
  const reine = named("パヴォリア・レイネ");
  assert.ok(reine);
  const artSource = { ...reine, number: "AUDIT-REINE-ARTS", arts: [{ name: "Audit Arts", damage: 100, cost: [], effect: "" }] };
  let s = state(artSource.number);
  s.phase = "performance";
  s.players[0].zones.center.attachments = [inst("hBP02-094", "tatang")];
  s = act(s, 0, attack, [...pool, artSource]);
  assert.equal(s.players[1].zones.center.damage, 110);

  const holder = { ...reine, number: "AUDIT-REINE-HP", hp: 100 };
  const attacker = { ...dummy, number: "AUDIT-HP-TEST", arts: [{ name: "120 Arts", damage: 120, cost: [], effect: "" }] };
  const map = [...pool, holder, attacker];
  s = state(attacker.number, holder.number);
  s.phase = "performance";
  s.players[1].zones.center.attachments = [inst("hBP02-094", "tatang")];
  s = act(s, 0, attack, map);
  assert.equal(s.players[1].zones.center.damage, 120);
  assert.equal(s.players[1].zones.center.stack.at(-1).number, holder.number);
});

test("hBP02-095 draws only when center Marine Blooms", () => {
  const marineDebut = named("宝鐘マリン", "Debut");
  const marineFirst = named("宝鐘マリン", "1st");
  assert.ok(marineDebut && marineFirst);
  let s = state();
  s.phase = "main";
  s.players[0].zones.center = unit(marineDebut.number, { attachments: [inst("hBP02-095", "mascot")] });
  s.players[0].hand = [inst(marineFirst.number, "marine-bloom")];
  s.players[0].mainDeck = [inst("AUDIT-DRAW", "marine-draw"), ...s.players[0].mainDeck.slice(1)];
  s = act(s, 0, { type: "play", cardId: "marine-bloom" });
  assert.equal(s.pendingChoice?.type, "bloom");
  s = act(s, 0, { type: "choose", zone: "center" });
  assert.ok(s.players[0].hand.some(card => card.id === "marine-draw"));
});

function chloeKnockoutState(hasHoloXTarget) {
  const chloe = { ...dummy, number: "AUDIT-CHLOE-KO", name: "沙花叉クロヱ", jpName: "沙花叉クロヱ", stage: "1st", arts: [{ name: "120 Arts", damage: 120, cost: [], effect: "" }] };
  const target = { ...dummy, number: "AUDIT-KO-TARGET", hp: 100 };
  const holoX = { ...dummy, number: "AUDIT-HOLOX", name: "HoloX target", jpName: "HoloX target", tags: ["#秘密結社holoX"] };
  const map = [...pool, chloe, target, holoX];
  let s = state(chloe.number, target.number);
  s.phase = "performance";
  s.players[0].zones.center.attachments = [inst("hBP02-096", "dog")];
  s.players[0].archive = [inst("hY01-001", "archive-cheer")];
  s.players[0].zones.back1 = hasHoloXTarget ? unit(holoX.number) : null;
  s.players[1].zones.back1 = unit(dummy.number);
  return { s, map };
}

test("hBP02-096 offers the Archive Cheer only when a legal own HoloX recipient exists", () => {
  let { s, map } = chloeKnockoutState(true);
  s = act(s, 0, attack, map);
  assert.equal(s.pendingChoice?.type, "lifeCheerTarget");
  s = act(s, 1, { type: "choose", zone: "back1" }, map);
  assert.equal(s.pendingChoice?.effect, "archiveCheerToStage");
  s = act(s, 0, { type: "choose", cardIds: ["archive-cheer"] }, map);
  assert.equal(s.pendingChoice?.type, "stageTarget");
  assert.deepEqual(s.pendingChoice?.options, ["back1"]);
  s = act(s, 0, { type: "choose", zone: "back1" }, map);
  assert.ok(s.players[0].zones.back1.cheer.some(card => card.id === "archive-cheer"));

  ({ s, map } = chloeKnockoutState(false));
  s = act(s, 0, attack, map);
  assert.equal(s.pendingChoice?.type, "lifeCheerTarget");
  assert.equal(s.effectQueue.some(effect => effect.type === "cardSelection" && effect.effect === "archiveCheerToStage"), false);
  assert.ok(s.players[0].archive.some(card => card.id === "archive-cheer"));
});
