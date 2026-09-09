import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, publicRoomState } from '../lib/simulator/engine.mjs';
import { cards, pool, inst, unit, state, attack, fund } from './fixtures/simulator-audit.mjs';

const copy = s => JSON.parse(JSON.stringify(s));
const choose = (s, action) => applyAction(copy(s), 0, {type:'choose', ...action}, pool, () => .5);
function start(number='hBP01-062', {hand=1, power=2, used=false, lui=true}={}) {
  const s=state(number);
  s.players[0].oshi=inst(lui?'hBP01-005':'AUDIT-OSHI');
  s.players[0].oshiSkillTurn=used?s.turn:0;
  s.players[0].hand=Array.from({length:hand},(_,i)=>inst('hBP01-062',`hand${i}`));
  s.players[0].holoPower=Array.from({length:power},(_,i)=>inst('hBP01-062',`power${i}`));
  fund(s.players[0].zones.center,cards.find(c=>c.number===number).arts[0].cost);
  return applyAction(s,0,attack,pool,()=>.5);
}
test('Kiara: skipping archive never receives the conditional +20',()=>{
  const s=start('hBP01-062',{lui:false});
  const end=choose(s,{skip:true});
  assert.equal(end.players[1].zones.center.damage,20);
  assert.equal(end.players[0].hand.length,1);
});
test('Kiara: full Holo Power replacement works with an empty hand',()=>{
  const s=start('hBP01-062',{hand:0});
  assert.equal(s.pendingChoice?.effect,'luiArchivePayment');
  const end=choose(s,{optionId:'power:1:1'});
  assert.equal(end.players[1].zones.center.damage,40);
  assert.equal(end.players[0].holoPower.length,1);
  assert.equal(end.players[0].archive.at(-1).id,'power1');
  assert.equal(end.players[0].oshiSkillTurn,3);
});
test('Q34: two-card Arts cost accepts one hand card and one Holo Power',()=>{
  const s=start('hBP06-042',{hand:1,power:1});
  const pending=choose(s,{optionId:'power:1:2'});
  assert.equal(pending.players[1].zones.center.damage,0);
  assert.equal(pending.players[0].holoPower.length,1);
  const end=choose(pending,{cardIds:['hand0']});
  assert.equal(end.players[0].hand.length,0);
  assert.equal(end.players[0].holoPower.length,0);
  assert.equal(end.players[1].zones.center.damage,60);
});
test('Q35: variable cost can use four Holo Power with only one hand card',()=>{
  const s=start('hBP01-061',{hand:1,power:5});
  assert.ok(s.pendingChoice?.modeOptions.some(o=>o.id==='power:4:4'));
  const pending=choose(s,{optionId:'power:4:4'});
  assert.equal(pending.players[0].hand.length,1);
  assert.equal(pending.players[0].holoPower.length,1);
  assert.equal(pending.players[1].zones.center.damage,0);
  const end=choose(pending,{zone:'center'});
  assert.equal(end.players[1].zones.center.damage,140);
});
for(const reason of ['used','noPower','wrongOshi']) test(`replacement unavailable: ${reason}`,()=>{
  const s=start('hBP01-062',{used:reason==='used',power:reason==='noPower'?0:2,lui:reason!=='wrongOshi'});
  assert.equal(s.pendingChoice?.effect,'artHandArchiveCost');
  const end=choose(s,{cardIds:['hand0']});
  assert.equal(end.players[1].zones.center.damage,40);
  assert.equal(end.players[0].holoPower.length,reason==='noPower'?0:2);
});
test('declining the skill retains normal hand payment without consuming once-per-turn',()=>{
  const s=choose(start(),{optionId:'hand'});
  const end=choose(s,{cardIds:['hand0']});
  assert.equal(end.players[1].zones.center.damage,40);
  assert.equal(end.players[0].holoPower.length,2);
  assert.equal(end.players[0].oshiSkillTurn,0);
});
test('skipping the entire optional cost pays nothing and grants no bonus',()=>{
  const end=choose(start(),{skip:true});
  assert.equal(end.players[1].zones.center.damage,20);
  assert.equal(end.players[0].oshiSkillTurn,0);
  assert.equal(end.players[0].holoPower.length,2);
});
test('insufficient combined resources cannot pay a two-card cost',()=>{
  const end=start('hBP06-042',{hand:0,power:1});
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[1].zones.center.damage,40);
  assert.equal(end.players[0].holoPower.length,1);
});
test('replacement rejects an overpayment mode',()=>{
  const s=start();
  assert.throws(()=>choose(s,{optionId:'power:2:2'}));
});
test('mixed payment rechecks Holo Power at confirmation and does not mutate input',()=>{
  const pending=choose(start('hBP06-042',{hand:1,power:1}),{optionId:'power:1:2'});
  pending.players[0].holoPower=[];
  const before=copy(pending);
  assert.throws(()=>choose(pending,{cardIds:['hand0']}));
  assert.deepEqual(pending,before);
});
test('non-red Holomem cannot use Lui even with a hand archive Art',()=>{
  const s=start('hBP08-066',{hand:1,power:5});
  assert.equal(s.pendingChoice?.effect,'artHandArchiveCost');
  const end=choose(s,{cardIds:['hand0']});
  assert.equal(end.players[0].holoPower.length,5);
  assert.equal(end.players[0].oshiSkillTurn,0);
});
test('opponent receives no hand identities from the replacement prompt',()=>{
  const s=start('hBP01-061',{hand:2,power:4});
  assert.deepEqual(publicRoomState(s,1).pendingChoice,{type:'opponent',playerIndex:0});
  assert.equal(JSON.stringify(publicRoomState(s,1)).includes('hand0'),false);
  assert.equal(JSON.stringify(s.pendingChoice).includes('power0'),false);
});
test('Q34: two hand plus two power gives four-card special damage',()=>{
  const pending=choose(start('hBP01-061',{hand:2,power:3}),{optionId:'power:2:4'});
  const paid=choose(pending,{cardIds:['hand0','hand1']});
  const end=choose(paid,{zone:'center'});
  assert.equal(end.players[1].zones.center.damage,140);
  assert.deepEqual(end.players[0].archive.map(c=>c.id),['power2','power1','hand0','hand1']);
});
test('cancelling mixed payment consumes neither cards nor once-per-turn',()=>{
  const pending=choose(start('hBP06-042',{hand:1,power:1}),{optionId:'power:1:2'});
  const end=choose(pending,{skip:true});
  assert.equal(end.players[0].holoPower.length,1);
  assert.equal(end.players[0].hand.length,1);
  assert.equal(end.players[0].oshiSkillTurn,0);
  assert.equal(end.players[1].zones.center.damage,40);
});
test('same-turn second Art cannot activate Lui again; next-turn window can',()=>{
  const end=choose(start('hBP01-062',{hand:0,power:3}),{optionId:'power:1:1'});
  end.players[0].zones.collab=unit('hBP01-062');
  fund(end.players[0].zones.collab,['無色']);
  const next=applyAction(end,0,{...attack,sourceZone:'collab'},pool);
  assert.equal(next.pendingChoice,null);
  assert.equal(next.players[1].zones.center.damage,60);
  assert.equal(next.players[0].holoPower.length,2);
  const later=copy(end);later.turn+=2;
  const again=applyAction(later,0,{...attack,sourceZone:'collab'},pool);
  assert.equal(again.pendingChoice?.effect,'luiArchivePayment');
});
test('red Bloom cost: Lui power replacement resolves the draw after payment',()=>{
  const s=state('hBP01-056');s.phase='main';
  s.players[0].oshi=inst('hBP01-005');
  s.players[0].hand=[inst('hBP01-060','bloom')];
  s.players[0].holoPower=[inst('hBP01-062','power')];
  const before=s.players[0].mainDeck.length;
  const play=applyAction(s,0,{type:'play',cardId:'bloom'},pool);
  const bloom=choose(play,{zone:'center'});
  assert.equal(bloom.pendingChoice?.effect,'luiArchivePayment');
  assert.equal(bloom.players[0].mainDeck.length,before);
  const end=choose(bloom,{optionId:'power:1:1'});
  assert.equal(end.players[0].hand.length,2);
  assert.equal(end.players[0].mainDeck.length,before-2);
  assert.equal(end.players[0].holoPower.length,0);
});
test('red collab ability uses Lui only when its center-tag condition is met',()=>{
  for(const center of ['hBP01-062','AUDIT-DUMMY']) {
    const s=state(center);s.phase='main';
    s.players[0].oshi=inst('hBP01-005');
    s.players[0].zones.back1=unit('hBP01-063');
    s.players[0].holoPower=[inst('hBP01-062','power')];
    s.players[0].mainDeck=[inst('hBP01-062','collabPower'),inst('hBP01-121','mascot')];
    const end=applyAction(s,0,{type:'collab',zone:'back1'},pool);
    assert.equal(end.pendingChoice?.effect==='luiArchivePayment',center==='hBP01-062');
    if(center==='hBP01-062') {
      const paid=choose(end,{optionId:'power:1:1'});
      assert.equal(paid.pendingChoice?.effect,'deckToHandShuffle');
      const found=choose(paid,{cardIds:['mascot']});
      assert.equal(found.players[0].hand[0].id,'mascot');
      assert.equal(found.players[0].archive.at(-1).id,'collabPower');
    }
  }
});
function strawberry({hand=1,power=0,lui=true}={}) {
  const s=state('hBP06-040');s.phase='main';
  s.players[0].oshi=inst(lui?'hBP01-005':'AUDIT-OSHI');
  s.players[0].hand=[inst('hBP06-042','bloom'),...Array.from({length:hand},(_,i)=>inst('hBP01-062',`hand${i}`))];
  s.players[0].holoPower=Array.from({length:power},(_,i)=>inst('hBP01-062',`power${i}`));
  return choose(applyAction(s,0,{type:'play',cardId:'bloom'},pool),{zone:'center'});
}
test('Strawberry Princess archives the existing hand before drawing',()=>{
  const pending=strawberry({lui:false});
  assert.equal(pending.pendingChoice?.effect,'handToArchive');
  assert.deepEqual(pending.players[0].hand.map(c=>c.id),['hand0']);
  const end=choose(pending,{cardIds:['hand0']});
  assert.equal(end.players[0].hand.length,1);
  assert.equal(end.players[0].archive.at(-1).id,'hand0');
  assert.equal(end.players[0].mainDeck.length,29);
});
test('mandatory archive cannot be skipped when a hand card exists',()=>{
  const pending=strawberry({power:1});
  assert.throws(()=>choose(pending,{skip:true}));
  const hand=choose(pending,{optionId:'hand'});
  assert.throws(()=>choose(hand,{skip:true}));
});
test('Strawberry Princess permits power substitution and then draws',()=>{
  const pending=strawberry({hand:0,power:1});
  assert.equal(pending.pendingChoice?.effect,'luiArchivePayment');
  const end=choose(pending,{optionId:'power:1:1'});
  assert.equal(end.players[0].holoPower.length,0);
  assert.equal(end.players[0].hand.length,1);
  assert.equal(end.players[0].archive.at(-1).id,'power0');
});
test('empty hand never forces activation of Lui for mandatory archive',()=>{
  const pending=strawberry({hand:0,power:1});
  const end=choose(pending,{optionId:'hand'});
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].holoPower.length,1);
  assert.equal(end.players[0].hand.length,1);
  assert.equal(end.players[0].oshiSkillTurn,0);
});
test('mandatory archive with no hand or power still performs the following draw',()=>{
  const end=strawberry({hand:0,power:0});
  assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].hand.length,1);
  assert.equal(end.players[0].archive.length,0);
});
test('GYM RAT draws three first, then permits a mixed mandatory payment',()=>{
  const s=state();s.phase='main';s.firstPlayer=1;
  s.players[0].turnsTaken=1;
  s.players[0].oshi=inst('hBP01-005');
  s.players[0].zones.back1=unit('hBP06-041');
  const pending=applyAction(s,0,{type:'collab',zone:'back1'},pool);
  assert.equal(pending.players[0].hand.length,3);
  assert.equal(pending.players[0].holoPower.length,1);
  const hand=choose(pending,{optionId:'power:1:2'});
  const end=choose(hand,{cardIds:[hand.players[0].hand[0].id]});
  assert.equal(end.players[0].hand.length,2);
  assert.equal(end.players[0].holoPower.length,0);
  assert.equal(end.players[0].oshiSkillTurn,3);
});
