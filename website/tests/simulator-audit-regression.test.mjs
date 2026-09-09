import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack,fund } from './fixtures/simulator-audit.mjs';
import { oshiSkillPowerCost } from '../lib/simulator/oshi-skill-catalog.mjs';
const card=n=>cards.find(c=>c.number===n);
function hit(target,attachment,{kind='arts',zone='center',sourceOwner=0}={}) {
 const s=state();s.players[1].zones.center=null;s.players[1].zones[zone]=unit(target,{attachments:[inst(attachment)]});
 s.effectQueue=[kind==='arts'?{type:'dealArtsDamage',playerIndex:sourceOwner,targetPlayerIndex:1,targetZone:zone,sourceZone:'center',damage:100,sourceName:'Audit',artName:'Audit'}:{type:'specialDamage',playerIndex:sourceOwner,targetPlayerIndex:1,targetZone:zone,sourceZone:'center',amount:100,sourceName:'Audit',loseLife:false}];
 // A zero-damage neutral Arts starts the public action loop; target a separate unit.
 s.players[1].zones.collab=unit(dummy.number);
 const zero={...dummy,arts:[{...dummy.arts[0],damage:0}]};
 return applyAction(s,0,{...attack,targetZone:'collab'},[...pool.filter(c=>c.number!==dummy.number),zero],()=>0.5);
}
test('hBP01-070 local text requires absence of Za-in',()=>{
 const s=state('hBP01-070');fund(s.players[0].zones.center,card('hBP01-070').arts[0].cost);
 const result=applyAction(structuredClone(s),0,attack,pool);assert.ok(result.players[1].zones.center.damage>0);
 s.players[0].zones.center.attachments=[inst('hBP01-126')];
 assert.throws(()=>applyAction(s,0,attack,pool),/座員/);
});
test('hBP01-005 uses variable Holo Power metadata',()=>assert.equal(oshiSkillPowerCost('hBP01-005','oshi'),'X'));
for(const kind of ['arts','special']) {
 test(`hBP02-093 immunity requires Fubuki, ${kind}`,()=>{
  const wrong=hit('hBP01-083','hBP02-093',{kind,zone:'back1'});assert.equal(wrong.players[1].zones.back1?.damage ?? 100,100);
  const right=hit(cards.find(c=>c.group==='holomem'&&c.jpName==='白上フブキ'&&c.stage==='Debut').number,'hBP02-093',{kind,zone:'back1'});assert.equal(right.players[1].zones.back1.damage,0);
 });
 test(`hBP04-102 immunity requires both fifth generation and 1st+, ${kind}`,()=>{
  for(const n of ['hBP01-083','hBP01-064']) {
   const r=hit(n,'hBP04-102',{kind,zone:'back1'});assert.equal(r.players[1].zones.back1?.damage ?? 100,100,n);
  }
  const good=cards.find(c=>c.stage==='1st'&&c.tags?.includes('#5期生'));
  assert.equal(hit(good.number,'hBP04-102',{kind,zone:'back1'}).players[1].zones.back1.damage,0);
 });
 test(`hBP01-126 adds exactly 10 received damage, ${kind}`,()=>{
  const result=hit(dummy.number,'hBP01-126',{kind});assert.equal(result.players[1].zones.center.damage,110);
 });
 test(`hBP02-100 passive Noel armor subtracts exactly 10, ${kind}`,()=>{
  const result=hit(dummy.number,'hBP02-100',{kind});assert.equal(result.players[1].zones.center.damage,90);
 });
}
test('hBP07-103 Nene 1st+ ignores Arts reduction',()=>{
 const n=cards.find(c=>c.jpName==='桃鈴ねね'&&c.stage==='1st'&&!c.keyword&&c.arts.some(a=>!a.effect));assert.ok(n);
 const i=n.arts.findIndex(a=>!a.effect);const s=state(n.number);fund(s.players[0].zones.center,n.arts[i].cost);s.players[0].zones.center.attachments=[inst('hBP07-103')];
 s.players[1].zones.center.modifiers=[{kind:'artsDamageReduction',amount:300,expiresTurn:3}];
 assert.equal(applyAction(s,0,{...attack,artIndex:i},pool).players[1].zones.center.damage,n.arts[i].damage+20);
});

for (const [attachment,name] of [['hBP01-117','七詩ムメイ'],['hBP03-105','姫森ルーナ']]) {
 for (const kind of ['arts','special']) for (const pay of [false,true]) {
  test(`${attachment} ${kind}: optional archive ${pay?'paid':'skipped'} reduces only when paid`,()=>{
   const target=cards.find(c=>c.group==='holomem'&&c.jpName===name&&c.hp>=150&&c.keyword?.type!=='gift');
   assert.ok(target);
   const start=hit(target.number,attachment,{kind});
   assert.equal(start.pendingChoice?.effect,'damageReaction');
   const end=applyAction(start,1,{type:'choose',...(pay?{optionId:'use'}:{skip:true})},pool);
   assert.equal(end.players[1].zones.center.damage,pay?70:100);
   assert.equal(end.players[1].archive.some(c=>c.number===attachment),pay);
   assert.equal(end.players[1].zones.center.attachments.length,pay?0:1);
  });
 }
}
for (const kind of ['arts','special']) {
 for(const attachment of ['hBP01-121','hSD03-013']) for(const zone of ['center','back1']) {
  test(`${attachment} ${kind} passive defense is restricted to center/collab: ${zone}`,()=>{
   assert.equal(hit(dummy.number,attachment,{kind,zone}).players[1].zones[zone].damage,zone==='center'?90:100);
  });
 }
 test(`hBP02-086 ${kind} penalty requires absence of alcohol tag`,()=>{
  assert.equal(hit(dummy.number,'hBP02-086',{kind}).players[1].zones.center.damage,110);
  const target=cards.find(c=>c.group==='holomem'&&c.hp>=150&&c.tags?.includes('#お酒')&&!c.keyword);
  assert.equal(hit(target.number,'hBP02-086',{kind}).players[1].zones.center.damage,100);
 });
}
for(const stage of ['Debut','Spot','1st']) for(const kind of ['arts','special']) {
 test(`hBP03-095 ${stage} ${kind} immunity boundaries`,()=>{
  const target=cards.find(c=>c.group==='holomem'&&c.stage===stage&&c.hp>=100&&!c.keyword);
  assert.ok(target);
  const end=hit(target.number,'hBP03-095',{kind});
  assert.equal(end.players[1].zones.center?.damage ?? 100,kind==='special'&&stage!=='1st'?0:100);
 });
}
