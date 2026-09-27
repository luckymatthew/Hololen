import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAction, isActionCandidateLegal } from "../lib/simulator/engine.mjs";

const cards = JSON.parse(readFileSync(new URL("../public/cards.json", import.meta.url), "utf8")).cards;
let sequence = 0;
const instance = number => ({ id: `repeat-arts-${++sequence}`, number });
const unit = (number, cheer = [], damage = 0) => ({
  stack: [instance(number)], cheer, attachments: [], damage, rested: false,
  enteredTurn: 1, bloomedTurn: 0, collabbedTurn: 0, returnSlot: null,
  modifiers: [], skipUnrestTurn: 0,
});
function battle() {
  const player = (name, oshi) => ({
    name, ready: true, setupDone: true, oshi: instance(oshi),
    mainDeck: Array.from({ length: 20 }, () => instance("hBP09-051")), cheerDeck: [], hand: [],
    life: Array.from({ length: 5 }, () => instance("hY01-001")), holoPower: [], archive: [], removed: [],
    zones: { center: null, collab: null, back1: null, back2: null, back3: null, back4: null, back5: null },
    collabTurn: 0, batonTurn: 0, limitedTurn: 0, limitedUsesCount: 0,
    limitedAllowanceTurn: 0, limitedAllowance: 1, turnsTaken: 2, mulliganUsed: false,
    forcedRedraws: 0, oshiSkillTurn: 0, spOshiSkillUsed: false,
    turnEvents: { turn: 3, supports: [], arts: [], bloomCount: 0, cheerArchived: 0, deckArchived: 0, stageReturned: 0 },
    namedUsageTurns: {}, modifiers: [],
  });
  return {
    status: "playing", players: [player("You", "hBP09-005"), player("Rival", "hBP09-001")],
    activePlayer: 0, firstPlayer: 1, winner: null, turn: 3, phase: "performance",
    pendingChoice: null, effectQueue: [], knockouts: [], lifeLosses: [], log: [],
  };
}
const act = (state, player, action, random = () => 0.25) => applyAction(state, player, action, cards, random);
const soraCheers = () => [instance("hY01-001"), instance("hY01-001"), instance("hY01-001")];

test("Q712 hBP01-023 repeated Arts are each counted by Towa's performance-end draw skill", () => {
  let state = battle();
  state.players[0].zones.center = unit("hBP01-023", soraCheers());
  state.players[0].holoPower = [instance("hBP09-051"), instance("hBP09-051")];
  state.players[1].zones.center = unit("hBP06-039");
  state.players[1].zones.collab = unit("hBP09-064");
  const startingHand = state.players[0].hand.length;

  for (let index = 0; index < 10; index++) {
    state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, () => index === 9 ? 0.2 : 0);
    assert.equal(state.players[1].zones.center.damage, 0, "Ayame's official Center Gift keeps each Arts event nonlethal");
    assert.equal(state.players[0].turnEvents.arts.length, index + 1);
    if (index < 9) assert.ok(state.players[0].zones.center.modifiers.some(modifier => modifier.kind === "repeatArts" && modifier.uses > 0));
  }

  assert.equal(state.players[0].zones.center.modifiers.some(modifier => modifier.kind === "repeatArts" && modifier.uses > 0), false);
  state = act(state, 0, { type: "advance" });
  assert.equal(state.pendingChoice?.effect, "hbp09");
  state = act(state, state.pendingChoice.playerIndex, { type: "choose", optionId: "yes" });
  assert.equal(state.players[0].hand.length - startingHand, 10, "the official Q712 first use plus nine repeats produce ten draws");
  assert.equal(state.players[0].holoPower.length, 0);
});

test("hBP01-023 ends its same-target repeat when the target is down", () => {
  let state = battle();
  state.players[0].oshi = instance("hBP09-001");
  state.players[0].zones.center = unit("hBP01-023", soraCheers());
  state.players[0].zones.collab = unit("hBP01-013", soraCheers());
  const defender = cards.find(card => card.number === "hBP09-064");
  assert.ok(defender?.hp);
  state.players[1].zones.center = unit(defender.number, [], defender.hp - 20);
  state.players[1].zones.collab = unit("hBP09-064");

  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, () => 0);

  assert.equal(state.players[0].zones.center.modifiers.some(modifier => modifier.kind === "repeatArts" && modifier.uses > 0), false,
    "the text repeats only until the damaged Holomem is down");
  assert.equal(state.players[0].zones.center.rested, true, "ending the repeat leaves the attacker exhausted");
  assert.equal(state.pendingChoice?.type, "lifeCheerTarget", "the knockout's normal life attachment must resolve first");
  state = act(state, state.pendingChoice.playerIndex, { type: "choose", zone: "collab" });
  const remainingHolomemAttack = { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "collab" };
  assert.equal(isActionCandidateLegal(state, 0, remainingHolomemAttack, cards), true,
    "once the target is down, another ready Holomem may attack a different remaining target");
  state = act(state, 0, remainingHolomemAttack);
  assert.equal(state.players[0].turnEvents.arts.length, 2,
    "clearing the defeated-target repeat lets normal performance actions continue");
});

test("Q226 hBP01-023 resolves each repeated Arts damage separately", () => {
  let state = battle();
  state.players[0].oshi = instance("hBP09-001");
  state.players[0].zones.center = unit("hBP01-023", soraCheers());
  state.players[1].zones.center = unit("hBP02-017");

  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, () => 0);
  assert.equal(state.players[1].zones.center.damage, 80, "first Arts use deals its own printed 80 damage");
  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" }, () => 0.2);
  assert.equal(state.players[1].zones.center.damage, 160, "the even second die stops repetition after a separate 80-damage event");
  assert.equal(state.log.filter(entry => /使用「止まらねえぞ」，造成 80 傷害/u.test(entry.message)).length, 2,
    "the replay record contains two 80-damage events, not one combined 160-damage event");
});

function soraRepeatBattle(withTowa = false) {
  const state = battle();
  const own = state.players[0];
  own.oshi = instance(withTowa ? "hBP09-005" : "hBP09-001");
  own.holoPower = withTowa ? [instance("hBP09-051"), instance("hBP09-051")] : [];
  const redCheer = cards.find(card => card.group === "cheer" && card.colors?.includes("紅"));
  assert.ok(redCheer, "fixture requires a red Cheer for hEB01-010's printed Art cost");
  own.zones.center = unit("hEB01-010", [instance(redCheer.number), instance("hY01-001"), instance("hY02-001")]);
  return state;
}

test("Q695/Q696 hEB01-010 repeats before another attacker but may change targets", () => {
  let state = soraRepeatBattle();
  state.players[0].zones.collab = unit("hBP01-013", soraCheers());
  state.players[0].zones.back1 = unit("hEB01-009");
  state.players[1].zones.center = unit("hBP09-064");
  state.players[1].zones.collab = unit("hBP09-064");

  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(state.pendingChoice?.effect, "artRestBackRepeat");
  state = act(state, state.pendingChoice.playerIndex, { type: "choose", zone: "back1" });
  const collabInterrupt = { type: "attack", sourceZone: "collab", artIndex: 0, targetZone: "center" };
  assert.equal(isActionCandidateLegal(state, 0, collabInterrupt, cards), false,
    "official Q695 forbids another Holomem's Arts before the pending repeat");
  assert.throws(() => act(state, 0, collabInterrupt), /pending repeated Arts|repeat|繰り/u);

  const retargetedRepeat = { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "collab" };
  assert.equal(isActionCandidateLegal(state, 0, retargetedRepeat, cards), true,
    "official Q696 permits the repeated Art to choose a different target Holomem");
  state = act(state, 0, retargetedRepeat);
  assert.equal(state.players[0].turnEvents.arts.length, 2);
  assert.equal(state.players[1].zones.collab.damage, 100);
});

test("Q713 five hEB01-010 repeats count as six Song Arts for Towa's Oshi skill", () => {
  let state = soraRepeatBattle(true);
  ["hBP01-023", "hBP05-013", "hBP08-018", "hEB01-009", "hEB01-010"]
    .forEach((number, index) => { state.players[0].zones[`back${index + 1}`] = unit(number); });
  state.players[1].zones.center = unit("hBP06-039");
  state.players[1].zones.collab = unit("hBP09-064");

  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  let restedSources = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    if (state.pendingChoice?.effect !== "artRestBackRepeat") break;
    const zone = state.pendingChoice.options[0];
    state = act(state, state.pendingChoice.playerIndex, { type: "choose", zone });
    restedSources += 1;
    if (state.players[0].zones.center.modifiers.some(modifier => modifier.kind === "repeatArts" && modifier.uses > 0)) {
      state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
    }
  }

  assert.equal(restedSources, 5, "the five distinct active back 2nd Sora pay for five repeats");
  assert.equal(state.players[0].turnEvents.arts.length, 6, "one initial Arts plus five repeats are six separate uses");
  assert.equal(state.players[1].zones.center.damage, 0, "Ayame's Gift prevents target damage without cancelling Arts uses");
  state = act(state, 0, { type: "advance" });
  assert.equal(state.pendingChoice?.effect, "hbp09");
  state = act(state, state.pendingChoice.playerIndex, { type: "choose", optionId: "yes" });
  assert.equal(state.players[0].hand.length, 6, "Q713 permits drawing once per each of the six #Song Arts uses");
});

test("Q702 hEB01-033 moves after Arts damage and before hEB01-010 repeats", () => {
  let state = soraRepeatBattle();
  state.players[0].zones.center.attachments = [instance("hEB01-033")];
  state.players[0].zones.collab = unit("hEB01-009");
  state.players[0].zones.back1 = unit("hEB01-009");
  state.players[1].zones.center = unit("hBP02-017");
  state.players[1].zones.collab = unit("hBP02-017");

  state = act(state, 0, { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" });
  assert.equal(state.pendingChoice?.effect, "artRestBackRepeat");
  state = act(state, 0, { type: "choose", zone: "back1" });
  assert.equal(state.pendingChoice?.effect, "moveAttachment");
  assert.equal(state.players[1].zones.center.damage, 110,
    "the printed Art damage settles before the Beach Ball movement choice under Q702");
  state = act(state, 0, { type: "choose", zone: "collab" });
  assert.equal(state.players[0].zones.center.attachments.some(card => card.number === "hEB01-033"), false);
  assert.equal(state.players[0].zones.collab.attachments.some(card => card.number === "hEB01-033"), true);
  const repeated = { type: "attack", sourceZone: "center", artIndex: 0, targetZone: "center" };
  assert.equal(isActionCandidateLegal(state, 0, repeated, cards), true,
    "moving the tool after the first Art does not cancel the source's queued identical-Art repeat");
  state = act(state, 0, repeated);
  assert.equal(state.players[0].turnEvents.arts.length, 2);
  assert.equal(state.players[1].zones.center.damage, 210);
});
