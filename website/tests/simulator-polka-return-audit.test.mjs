import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,attack,fund} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(JSON.parse(JSON.stringify(s)),0,a,pool,()=>.5);
const choose=(s,a)=>act(s,{type:'choose',...a});
function bloom({hand=3,fans=1,power=0,lui=false,zone='center',handFan=false}={}) {
  const s=state('hBP01-069');s.phase='main';
  if(zone!=='center'){s.players[0].zones[zone]=s.players[0].zones.center;s.players[0].zones.center=unit('AUDIT-DUMMY');}
  s.players[0].oshi=inst(lui?'hBP01-005':'hBP05-003');
  s.players[0].hand=[inst('hBP05-034','bloom'),...Array.from({length:hand},(_,i)=>inst(handFan?'hBP01-126':'hBP01-062',`hand${i}`))];
  s.players[0].archive=Array.from({length:fans},(_,i)=>inst('hBP01-126',`fan${i}`));
  s.players[0].holoPower=Array.from({length:power},(_,i)=>inst('hBP01-062',`power${i}`));
  return choose(act(s,{type:'play',cardId:'bloom'}),{zone});
}
test('Q449: archive three hand cards despite only one archived fan',()=>{
  const s=bloom();assert.equal(s.pendingChoice?.max,3);
  const paid=choose(s,{cardIds:['hand0','hand1','hand2']});
  assert.equal(paid.pendingChoice?.min,1);
  const end=choose(paid,{cardIds:['fan0']});
  assert.deepEqual(end.players[0].hand.map(c=>c.id),['fan0']);
  assert.equal(end.players[0].archive.length,3);
});
test('Q449: no archived fans does not prevent archiving hand cards',()=>{
  const s=bloom({fans:0});assert.equal(s.pendingChoice?.max,3);
  const end=choose(s,{cardIds:['hand0','hand1','hand2']});
  assert.equal(end.pendingChoice,null);assert.equal(end.players[0].archive.length,3);
});
test('a fan paid from hand can be returned by the same Bloom',()=>{
  const s=bloom({hand:1,fans:0,handFan:true});
  const paid=choose(s,{cardIds:['hand0']});
  assert.equal(paid.pendingChoice?.effect,'archiveToHand');
  const end=choose(paid,{cardIds:['hand0']});
  assert.equal(end.players[0].hand[0].id,'hand0');assert.equal(end.players[0].archive.length,0);
});
test('Q450: paying four must return all four available fans',()=>{
  const paid=choose(bloom({hand:4,fans:4}),{cardIds:['hand0','hand1','hand2','hand3']});
  assert.throws(()=>choose(paid,{skip:true}));assert.throws(()=>choose(paid,{cardIds:['fan0']}));
  const end=choose(paid,{cardIds:['fan0','fan1','fan2','fan3']});
  assert.equal(end.players[0].hand.length,4);assert.equal(end.players[0].archive.length,4);
});
test('optional Bloom can be declined without moving any cards',()=>{
  const end=choose(bloom(),{skip:true});
  assert.equal(end.players[0].hand.length,3);assert.equal(end.players[0].archive.length,1);
});
for(const zone of ['back1','collab'])test(`Bloom is center-only: ${zone}`,()=>{
  const end=bloom({zone,lui:true,power:3});assert.equal(end.pendingChoice,null);
  assert.equal(end.players[0].hand.length,3);assert.equal(end.players[0].holoPower.length,3);
});
test('Lui: empty hand can pay three power, then return two fans',()=>{
  const s=bloom({hand:0,fans:2,lui:true,power:3});
  assert.equal(s.pendingChoice?.effect,'luiArchivePayment');
  const paid=choose(s,{optionId:'power:3:3'});
  assert.equal(paid.pendingChoice?.min,2);assert.equal(paid.players[0].holoPower.length,0);
  const end=choose(paid,{cardIds:['fan0','fan1']});
  assert.equal(end.players[0].archive.length,3);assert.equal(end.players[0].oshiSkillTurn,3);
});
test('Lui: mixed payment counts both regions for mandatory fan return',()=>{
  const mode=choose(bloom({hand:1,fans:3,lui:true,power:2}),{optionId:'power:2:3'});
  const paid=choose(mode,{cardIds:['hand0']});
  assert.equal(paid.pendingChoice?.min,3);
  const end=choose(paid,{cardIds:['fan0','fan1','fan2']});
  assert.deepEqual(end.players[0].archive.map(c=>c.id),['power1','power0','hand0']);
});
for(const n of [0,9,10,19,20,30])for(const oshi of ['hBP05-003','hBP01-005'])test(`Arts: ${n} archived cards, oshi ${oshi}`,()=>{
  const s=state('hBP05-034');s.players[0].oshi=inst(oshi);
  s.players[0].archive=Array.from({length:n},(_,i)=>inst(i%2?'hY03-001':'hBP01-062',`archive${i}`));
  fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP05-034').arts[0].cost);
  const end=act(s,attack);
  assert.equal(end.players[1].zones.center.damage,110+(oshi==='hBP05-003'?Math.floor(n/10)*30:0));
});
