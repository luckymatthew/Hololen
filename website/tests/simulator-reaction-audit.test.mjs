import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack } from './fixtures/simulator-audit.mjs';
const find=(predicate)=>{const c=cards.find(predicate);assert.ok(c);return c.number;};
const named=name=>find(c=>c.group==='holomem'&&c.jpName===name&&c.hp>=150&&c.keyword?.type!=='gift');
const zero={...dummy,arts:[{...dummy.arts[0],damage:0}]};
const testPool=[...pool.filter(c=>c.number!==dummy.number),zero];
function queuedHit(target,{kind='arts',amount=40,attachments=[],oshi=null,power=0,source=0,ownTurn=false,damage=0,life=5,reduction=0}={}) {
 const s=state();s.players[1].zones.center=unit(target,{attachments:attachments.map((n,i)=>inst(n,'a'+i)),damage,modifiers:reduction?[{kind:"artsDamageReduction",amount:reduction,expiresTurn:3}]:[]});
 s.players[1].zones.back1=unit(dummy.number);s.players[1].zones.collab=unit(dummy.number);
 s.players[1].life=s.players[1].life.slice(0,life);
 if(oshi)s.players[1].oshi=inst(oshi);
 s.players[1].holoPower=Array.from({length:power},(_,i)=>inst(dummy.number,'power'+i));
 s.effectQueue=[{type:kind==='arts'?'dealArtsDamage':'specialDamage',playerIndex:source,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',damage:amount,amount,sourceName:'Audit',artName:'Audit'}];
 s.activePlayer=ownTurn?1:0;
 return applyAction(s,s.activePlayer,{...attack,sourceZone:ownTurn?'collab':'center',targetZone:ownTurn?'center':'collab'},testPool,()=>0.5);
}
function settle(s){for(let i=0;s.pendingChoice&&i<8;i++){
 assert.equal(s.pendingChoice.type,'lifeCheerTarget');
 s=applyAction(s,s.pendingChoice.playerIndex,{type:'choose',zone:'back1'},testPool,()=>0.5);
}return s;}
const reactions=[
 ['hBP01-002',find(c=>c.group==='holomem'&&c.hp>=150&&c.tags?.includes('#Promise')&&c.keyword?.type!=='gift'),2,'normal:50',50,[]],
 ['hBP04-006',named('大空スバル'),2,'normal:30',30,[]],
 ['hBP04-001',named('博衣こより'),2,'sp:100',100,['hBP04-105']],
 ...['hSD05-001','hSD08-001','hYS01-001'].map(n=>[n,find(c=>c.group==='holomem'&&c.hp>=150&&c.colors?.includes('白')&&c.keyword?.type!=='gift'),1,'sp:20',20,[]])
];
for(const [oshi,target,cost,option,reduce,attachments] of reactions) for(const kind of ['arts','special']) {
 test(`${oshi} ${kind}: insufficient power does not offer defense`,()=>{
  const s=queuedHit(target,{oshi,kind,power:cost-1,attachments});
  assert.notEqual(s.pendingChoice?.effect,'oshiDamageReaction');
 });
 test(`${oshi} ${kind}: defense pays newest power and marks usage`,()=>{
  const start=queuedHit(target,{oshi,kind,power:cost+1,attachments,amount:120});
  assert.equal(start.pendingChoice?.effect,'oshiDamageReaction');
  const end=applyAction(start,1,{type:'choose',optionId:option},testPool);
  assert.deepEqual(end.players[1].holoPower.map(c=>c.id),['power0']);
  assert.deepEqual(end.players[1].archive.filter(c=>c.id.startsWith('power')).map(c=>c.id),Array.from({length:cost},(_,i)=>'power'+(cost-i)));
  assert.equal(end.players[1].zones.center.damage,120-reduce);
  assert.equal(option.startsWith('sp')?end.players[1].spOshiSkillUsed:end.players[1].oshiSkillTurn,option.startsWith('sp')?true:3);
 });
 test(`${oshi} ${kind}: own damage cannot trigger opponent-only defense`,()=>{
  assert.notEqual(queuedHit(target,{oshi,kind,power:cost,attachments,source:1}).pendingChoice?.effect,'oshiDamageReaction');
 });
}
for(const kind of ['arts','special']) {
 test(`Zecretary ${kind} stays attached for zero damage`,()=>{
  const s=queuedHit(named('ベスティア・ゼータ'),{kind,amount:0,attachments:['hBP07-108']});
  assert.equal(s.players[1].zones.center.attachments.length,1);
 });
 test(`Zecretary ${kind} stays attached in own turn`,()=>{
  const s=queuedHit(named('ベスティア・ゼータ'),{kind,ownTurn:true,attachments:['hBP07-108']});
  assert.equal(s.players[1].zones.center.attachments.length,1);
 });
 test(`Zecretary ${kind} archives after opponent-turn damage`,()=>{
  const s=queuedHit(named('ベスティア・ゼータ'),{kind,attachments:['hBP07-108']});
  assert.equal(s.players[1].zones.center.attachments.length,0);
 });
 for(const [attachment,name] of [['hBP01-116','天音かなた'],['hSD06-011','風真いろは']]) {
  test(`${attachment} ${kind} does not counter zero damage`,()=>{
   const s=queuedHit(named(name),{kind,amount:0,attachments:[attachment]});
   assert.equal(s.players[0].zones.center.damage,0);
  });
  test(`${attachment} ${kind} counter survives its source being knocked out`,()=>{
   const target=named(name);const hp=cards.find(c=>c.number===target).hp;
   const s=settle(queuedHit(target,{kind,amount:50,damage:hp-10,attachments:[attachment]}));
   assert.equal(s.players[1].zones.center,null);
   assert.equal(s.players[0].zones.center.damage,20);
  });
  test(`${attachment} ${kind} no counter after losing final life`,()=>{
   const target=named(name);const hp=cards.find(c=>c.number===target).hp;
   const s=settle(queuedHit(target,{kind,amount:50,damage:hp-10,life:1,attachments:[attachment]}));
   assert.equal(s.winner,0);assert.equal(s.players[0].zones.center.damage,0);
  });
 }
}

for(const kind of ['arts','special']) {
 test(`Lunaite ${kind}: three separate fans may pay for one hit`,()=>{
  let s=queuedHit(named('姫森ルーナ'),{kind,amount:100,attachments:Array(3).fill('hBP03-105')});
  for(let i=0;i<3;i++) {
   assert.equal(s.pendingChoice?.effect,'damageReaction');
   s=applyAction(s,1,{type:'choose',optionId:'use'},testPool);
  }
  assert.equal(s.players[1].zones.center.damage,10);
  assert.equal(s.players[1].archive.filter(c=>c.number==='hBP03-105').length,3);
 });
 test(`Lunaite ${kind}: skip after one payment preserves the remaining copies`,()=>{
  let s=queuedHit(named('姫森ルーナ'),{kind,amount:100,attachments:Array(3).fill('hBP03-105')});
  s=applyAction(s,1,{type:'choose',optionId:'use'},testPool);
  assert.equal(s.pendingChoice?.effect,'damageReaction');
  s=applyAction(s,1,{type:'choose',skip:true},testPool);
  assert.equal(s.players[1].zones.center.damage,70);
  assert.equal(s.players[1].zones.center.attachments.length,2);
 });
}
for(const power of [0,2]) test(`Risu knockout reaction requires and pays 2 power: ${power}`,()=>{
 const target=find(c=>c.group==='holomem'&&c.tags?.includes('#ID1期生')&&c.hp>=150&&c.keyword?.type!=='gift');
 const hp=cards.find(c=>c.number===target).hp;
 let s=queuedHit(target,{oshi:'hBP03-008',power,amount:40,damage:hp-10});
 if(s.pendingChoice?.type==='lifeCheerTarget')s=applyAction(s,1,{type:'choose',zone:'back1'},testPool);
 if(!power){assert.notEqual(s.pendingChoice?.effect,'oshiKnockout');return;}
 assert.equal(s.pendingChoice?.effect,'oshiKnockout');
 const hand=s.players[1].hand.length;
 s=applyAction(s,1,{type:'choose',optionId:'use'},testPool);
 assert.equal(s.players[1].holoPower.length,0);
 assert.equal(s.players[1].hand.length,hand+1);
});
for(const power of [0,1]) test(`Moona after-special-damage reaction requires power: ${power}`,()=>{
 const s=state();s.players[0].oshi=inst('hBP06-006');
 s.players[0].holoPower=Array.from({length:power},(_,i)=>inst(dummy.number,'power'+i));
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',amount:10}];
 let end=applyAction(s,0,attack,testPool);
 if(!power){assert.notEqual(end.pendingChoice?.effect,'oshiAfterDamage');return;}
 assert.equal(end.pendingChoice?.effect,'oshiAfterDamage');
 end=applyAction(end,0,{type:'choose',optionId:'use'},testPool);
 assert.equal(end.players[0].holoPower.length,0);
 assert.equal(end.players[1].zones.center.damage,30);
 assert.equal(end.pendingChoice,null);
});

test('all additive Arts damage adjustments are combined before clamping at zero',()=>{
 const s=queuedHit(dummy.number,{amount:30,attachments:['hBP01-126'],reduction:50});
 assert.equal(s.players[1].zones.center.damage,0,'30 - 50 + 10 = -10, then clamp to zero');
});
test('Zecretary is retained when actual damage is reduced to zero',()=>{
 const s=queuedHit(named('ベスティア・ゼータ'),{amount:30,attachments:['hBP07-108'],reduction:50});
 assert.equal(s.players[1].zones.center.damage,0);
 assert.equal(s.players[1].zones.center.attachments.length,1);
});
