import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack,fund } from './fixtures/simulator-audit.mjs';
const subaru='hBP06-081';
const zeroPool=pool.map(c=>c.number===dummy.number?{...c,arts:[{...c.arts[0],damage:0}]}:c);
const choose=(s,action,p=zeroPool)=>applyAction(s,s.pendingChoice.playerIndex,{type:'choose',...action},p);
function setup(source=dummy.number,{power=2,firstSubaru=true,secondSubaru=true}={}){
 const s=state(source);
 s.players[1].oshi=inst('hBP04-006');s.players[1].holoPower=Array.from({length:power},(_,i)=>inst(dummy.number,'power'+i));
 for(const [zone,yes]of [['center',firstSubaru],['collab',secondSubaru]])s.players[1].zones[zone]=unit(yes?subaru:dummy.number,{stack:[inst(yes?subaru:dummy.number,zone)]});
 s.players[1].zones.back1=unit(dummy.number);return s;
}
function queued({kind='special',power=2,firstSubaru=true,secondSubaru=true,separate=false,ignore=false}={}){
 const s=setup(dummy.number,{power,firstSubaru,secondSubaru});
 s.effectQueue=['center','collab'].map((targetZone,i)=>({type:kind==='special'?'specialDamage':'dealArtsDamage',damageBatchId:separate?'event'+i:'same-event',playerIndex:0,targetPlayerIndex:1,targetZone,sourceZone:'center',amount:50,damage:50,ignoreArtsReduction:ignore,sourceName:'Audit',artName:'Audit'}));
 s.pendingChoice={type:'lifeCheerTarget',playerIndex:0,options:['center'],cheerCard:inst('hY01-001','launchCheer')};
 return applyAction(s,0,{type:'choose',zone:'center'},zeroPool);
}
for(const kind of ['arts','special']){
 test(`Subaru ${kind}: one payment reduces both simultaneous targets`,()=>{
  const s=choose(queued({kind}),{optionId:'normal:30'});
  assert.equal(s.players[1].zones.center.damage,20);assert.equal(s.players[1].zones.collab.damage,20);
  assert.equal(s.players[1].holoPower.length,0);assert.equal(s.players[1].oshiSkillTurn,3);assert.equal(s.pendingChoice,null);
 });
 test(`Subaru ${kind}: window opens before non-Subaru first target and reduces only Subaru`,()=>{
  const start=queued({kind,firstSubaru:false});assert.equal(start.players[1].zones.center.damage,0);
  const s=choose(start,{optionId:'normal:30'});
  assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.players[1].zones.collab.damage,20);
 });
 test(`Subaru ${kind}: other member second target is not reduced`,()=>{
  const s=choose(queued({kind,secondSubaru:false}),{optionId:'normal:30'});
  assert.equal(s.players[1].zones.center.damage,20);assert.equal(s.players[1].zones.collab.damage,50);
 });
 test(`Subaru ${kind}: declining closes the whole simultaneous window without spending`,()=>{
  const s=choose(queued({kind}),{skip:true});assert.equal(s.pendingChoice,null);
  assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.players[1].zones.collab.damage,50);assert.equal(s.players[1].holoPower.length,2);
 });
 test(`Subaru ${kind}: insufficient power does not offer reduction`,()=>{
  const s=queued({kind,power:1});assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.collab.damage,50);
 });
 test(`Subaru ${kind}: separate damage events cannot share reduction`,()=>{
  const s=choose(queued({kind,separate:true}),{optionId:'normal:30'});
  assert.equal(s.players[1].zones.center.damage,20);assert.equal(s.players[1].zones.collab.damage,50);
 });
 test(`Subaru ${kind}: may decline first event and use on later separate event`,()=>{
  let s=choose(queued({kind,separate:true}),{skip:true});assert.equal(s.pendingChoice?.effect,'oshiDamageReaction');
  s=choose(s,{optionId:'normal:30'});assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.players[1].zones.collab.damage,20);
 });
 test(`Subaru ${kind}: grouping survives serialization`,()=>{
  const s=choose(JSON.parse(JSON.stringify(queued({kind}))),{optionId:'normal:30'});
  assert.equal(s.players[1].zones.collab.damage,20);
 });
}
test('Subaru Arts: damage that cannot be reduced stays unchanged for both targets',()=>{
 const s=choose(queued({kind:'arts',ignore:true}),{optionId:'normal:30'});
 assert.equal(s.players[1].zones.center.damage,50);assert.equal(s.players[1].zones.collab.damage,50);
});
test('native Marine hSD09-004: same special event reduced, subsequent Arts unreduced',()=>{
 const s=setup('hSD09-004');fund(s.players[0].zones.center,cards.find(c=>c.number==='hSD09-004').arts[1].cost);
 let end=applyAction(s,0,{...attack,artIndex:1},pool);assert.equal(end.pendingChoice?.effect,'oshiDamageReaction');
 end=choose(end,{optionId:'normal:30'},pool);
 assert.equal(end.players[1].zones.center.damage,170);assert.equal(end.players[1].zones.collab.damage,0);
 assert.equal(end.players[1].holoPower.length,0);
});
test('native Marine hSD09-004: skip special event then reduce only subsequent Arts',()=>{
 const s=setup('hSD09-004');fund(s.players[0].zones.center,cards.find(c=>c.number==='hSD09-004').arts[1].cost);
 let end=choose(applyAction(s,0,{...attack,artIndex:1},pool),{skip:true},pool);
 assert.equal(end.pendingChoice?.effect,'oshiDamageReaction');assert.equal(end.players[1].zones.collab.damage,10);
 end=choose(end,{optionId:'normal:30'},pool);
 assert.equal(end.players[1].zones.center.damage,150);assert.equal(end.players[1].zones.collab.damage,10);
});
test('Moona hBP06-006: reactive two-target damage is one Subaru window',()=>{
 const s=setup();s.players[0].oshi=inst('hBP06-006');s.players[0].holoPower=[inst(dummy.number,'moonaPower')];
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10}];
 s.pendingChoice={type:'lifeCheerTarget',playerIndex:0,options:['center'],cheerCard:inst('hY01-001','launch')};
 let end=applyAction(s,0,{type:'choose',zone:'center'},pool);
 assert.equal(end.pendingChoice?.effect,'oshiAfterDamage');end=choose(end,{optionId:'use'},pool);
 assert.equal(end.pendingChoice?.effect,'oshiDamageReaction');end=choose(end,{optionId:'normal:30'},pool);
 assert.equal(end.players[1].zones.center.damage,0);assert.equal(end.players[1].zones.collab.damage,0);
 assert.equal(end.players[0].holoPower.length,0);assert.equal(end.players[1].holoPower.length,0);assert.equal(end.pendingChoice,null);
});
test('Nene hBP07-081: split Arts keeps a common event and ignores reduction with hBP07-103',()=>{
 const s=setup('hBP07-081');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP07-081').arts[0].cost);
 s.players[0].zones.center.attachments=[inst('hBP07-103','beetle')];
 const start=applyAction(s,0,attack,pool);const hit=start.pendingChoice.meta.queuedEffect;
 assert.ok(hit.damageBatchId);assert.equal(start.effectQueue.find(e=>e.type==='dealArtsDamage')?.damageBatchId,hit.damageBatchId);
 const used=choose(start,{optionId:'normal:30'},pool),skipped=choose(start,{skip:true},pool);
 for(const zone of ['center','collab'])assert.equal(used.players[1].zones[zone].damage,skipped.players[1].zones[zone].damage);
});
