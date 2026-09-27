import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, cards, instance, unit, act } from './hbp09-fixtures.mjs';

const kaelaArms = 'hBP04-098';
const redCheer = 'hY03-017';

function attackFixture({ sourceTool = null, otherUnits = [] } = {}) {
  const state = fixture(6, 64);
  state.phase = 'performance';
  state.players[0].zones.center = unit('hBP09-041');
  if (sourceTool) state.players[0].zones.center.attachments.push(instance(sourceTool));
  else state.players[0].zones.center.cheer.push(instance(redCheer));
  for (const [zone, number, tool] of otherUnits) {
    const candidate = unit(number);
    if (tool) candidate.attachments.push(instance(tool));
    state.players[0].zones[zone] = candidate;
  }
  return state;
}

function attack(state) {
  return act(state, { type: 'attack', sourceZone: 'center', artIndex: 0, targetZone: 'center' });
}

test('hBP09-041 official identity, Gift, and Arts text match the current catalog', () => {
  const card = cards.find(entry => entry.number === 'hBP09-041');
  assert.ok(card);
  assert.equal(card.jpName, 'カエラ・コヴァルスキア');
  assert.equal(card.stage, '1st');
  assert.equal(card.hp, 170);
  assert.equal(card.keyword.type, 'gift');
  assert.equal(card.keyword.effect, "このホロメンに#カエラ'sアームズを持つツールが付いているなら、このホロメンのアーツに必要な赤-1。");
  assert.equal(card.arts[0].damage, 30);
  assert.equal(card.arts[0].damageModifier, '+');
  assert.equal(card.arts[0].effect, "自分のBuzzホロメンか2ndホロメンに#カエラ'sアームズを持つツールが付いているなら、このアーツ+20。");
  assert.deepEqual(card.arts[0].cost, ['紅']);
});

test('the Gift removes Kaela-041’s red requirement and stacks with the attached Tool’s printed Arts bonus', () => {
  const state = attackFixture({ sourceTool: kaelaArms });
  const result = attack(state);
  assert.equal(result.players[1].zones.center.damage, 50, 'hBP04-098 grants the printed +20 Arts bonus on this 1st #ID3期生');
  assert.equal(result.players[0].zones.center.rested, true);
  assert.equal(result.players[0].zones.center.cheer.length, 0, 'the attached qualifying Tool removes the sole red cost');
  assert.equal(result.players[0].zones.center.attachments[0].number, kaelaArms);
});

test('a Kaela Arms Tool on a different Holomem does not pay Kaela-041’s red cost', () => {
  const state = attackFixture({ otherUnits: [['back1', 'hBP01-014', kaelaArms]] });
  state.players[0].zones.center.cheer = [];
  assert.throws(() => attack(state), /應援不足|cost|費用/u);
  assert.equal(state.players[0].zones.center.rested, false);
  assert.equal(state.players[0].zones.back1.attachments[0].number, kaelaArms);
});

test('the Arts gains exactly 20 when an own Buzz or 2nd Holomem has a Kaela Arms Tool', () => {
  const cases = [
    [['back1', 'hBP01-014', kaelaArms]],
    [['collab', 'hBP09-042', 'hBP09-106']],
  ];
  for (const otherUnits of cases) {
    const result = attack(attackFixture({ otherUnits }));
    assert.equal(result.players[1].zones.center.damage, 50);
    assert.ok(result.players[0].zones.center.rested);
  }
});

test('having two qualifying own-stage Holomem still grants one flat +20 Arts bonus', () => {
  const result = attack(attackFixture({ otherUnits: [
    ['back1', 'hBP01-014', kaelaArms],
    ['back2', 'hBP01-020', kaelaArms],
  ] }));
  assert.equal(result.players[1].zones.center.damage, 50);
});

test('a tagged Tool on an own Debut or 1st Holomem does not qualify for the Arts bonus', () => {
  for (const number of ['hBP09-038', 'hBP09-040']) {
    const result = attack(attackFixture({ otherUnits: [['back1', number, kaelaArms]] }));
    assert.equal(result.players[1].zones.center.damage, 30, `${number} is below Buzz/2nd, and its Tool bonuses do not apply to Kaela-041's Arts`);
  }
});

test('an opponent Tool or an own untagged Tool does not grant the Arts bonus', () => {
  const opponentTool = attackFixture();
  const rival = unit('hBP01-014');
  rival.attachments.push(instance(kaelaArms));
  opponentTool.players[1].zones.back1 = rival;
  assert.equal(attack(opponentTool).players[1].zones.center.damage, 30);

  const untagged = attackFixture({ otherUnits: [['back1', 'hBP01-014', 'hBP09-108']] });
  assert.equal(cards.find(entry => entry.number === 'hBP09-108').tags.includes("#カエラ'sアームズ"), false);
  assert.equal(attack(untagged).players[1].zones.center.damage, 30);
});
