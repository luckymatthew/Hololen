import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack } from './fixtures/simulator-audit.mjs';

const buzz=cards.filter(c=>c.typeCode==='buzzCharacter');
// Isolate the printed Extra life replacement, not the other skills of each card.
const isolated=pool.map(c=>({...c,keyword:null,arts:c.number===dummy.number?[{...dummy.arts[0],damage:0}]:c.arts}));
function knockout(card,kind,{life=5,loseLife=true,underBuzz=false,targetZone='center',polkaZone=null,polkaOshi=true,fan=true,ownTurn=false}={}) {
 const s=state();s.players[0].zones.collab=unit(dummy.number);
 s.players[1].zones.center=unit(dummy.number);
 s.players[1].zones[targetZone]=unit(card.number,{damage:card.hp-10,stack:underBuzz?[inst(buzz[0].number,'under'),inst(card.number,'top')]:[inst(card.number,'target')]});
 s.players[1].zones.back1=unit(dummy.number);s.players[1].life=s.players[1].life.slice(0,life);
 if(polkaZone){
  s.players[1].zones[polkaZone]=unit('hBP07-044');
  if(polkaOshi)s.players[1].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='尾丸ポルカ').number);
  if(fan)s.players[1].zones[targetZone].attachments=[inst('hBP01-123','fan')];
 }
 s.activePlayer=ownTurn?1:0;
 s.effectQueue=[{type:kind==='arts'?'dealArtsDamage':'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone,sourceZone:'center',damage:50,amount:50,loseLife,sourceName:'Audit',artName:'Audit'}];
 let end=applyAction(s,s.activePlayer,{...attack,sourceZone:ownTurn?'center':'collab'},isolated);
 const revealed=[];
 for(let i=0;end.pendingChoice&&i<8;i++){
  assert.equal(end.pendingChoice.type,'lifeCheerTarget');
  revealed.push(end.pendingChoice.cheerCard.id);
  end=applyAction(end,1,{type:'choose',zone:'back1'},isolated);
 }
 return {end,revealed};
}
for(const card of buzz) for(const kind of ['arts','special'])test(`${card.number} ${kind}: Buzz knockout loses exactly two life`,()=>{
 const {end,revealed}=knockout(card,kind);
 assert.equal(end.players[1].zones.center,null);
 assert.equal(end.players[1].life.length,3);
 assert.deepEqual(revealed,['AUDIT-DUMMYlife4','AUDIT-DUMMYlife3']);
 assert.equal(end.players[1].zones.back1.cheer.length,2);
 assert.equal(end.winner,null);
});
for(const life of [1,2,3])for(const kind of ['arts','special'])test(`Buzz ${kind}: remaining ${life} life resolves every revealed cheer once`,()=>{
 const {end,revealed}=knockout(buzz[0],kind,{life});
 assert.equal(end.players[1].life.length,Math.max(0,life-2));
 assert.equal(revealed.length,Math.min(life,2));
 assert.equal(new Set(revealed).size,revealed.length);
 assert.equal(end.winner,life<=2?0:null);
});
for(const card of buzz)test(`${card.number}: special damage with no life loss overrides Buzz`,()=>{
 const {end,revealed}=knockout(card,'special',{loseLife:false});
 assert.equal(end.players[1].zones.center,null);
 assert.equal(end.players[1].life.length,5);assert.equal(revealed.length,0);
});
for(const kind of ['arts','special'])test(`Non-Buzz top card above Buzz ${kind}: only one life`,()=>{
 const card=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&c.typeCode!=='buzzCharacter');
 const {end,revealed}=knockout(card,kind,{underBuzz:true});
 assert.equal(end.players[1].life.length,4);assert.equal(revealed.length,1);
});
for(const kind of ['arts','special']){
 test(`Polka Gift ${kind}: own turn cannot reduce Buzz life loss`,()=>{
  const {end,revealed}=knockout(buzz[0],kind,{targetZone:'back2',polkaZone:'collab',ownTurn:true});
  assert.equal(end.players[1].life.length,3);assert.equal(revealed.length,2);
 });
 test(`Marine hSD09-007 ${kind}: own turn cannot reduce life loss`,()=>{
  const {end,revealed}=knockout(cards.find(c=>c.number==='hSD09-007'),kind,{targetZone:'collab',life:4,ownTurn:true});
  assert.equal(end.players[1].life.length,3);assert.equal(revealed.length,1);
 });
 for(const opts of [{polkaZone:'collab',expected:1},{polkaZone:'back2',expected:2},{polkaZone:'collab',polkaOshi:false,expected:2},{polkaZone:'collab',fan:false,expected:2}])test(`Polka Gift ${kind}: numeric life reduction ${JSON.stringify(opts)}`,()=>{
  const {end,revealed}=knockout(buzz[0],kind,opts);
  assert.equal(end.players[1].life.length,5-opts.expected);assert.equal(revealed.length,opts.expected);
 });
 for(const zone of ['center','collab'])for(const life of [4,5])test(`Marine hSD09-007 ${kind}: ${zone}, life ${life} against 5`,()=>{
  const {end,revealed}=knockout(cards.find(c=>c.number==='hSD09-007'),kind,{targetZone:zone,life});
  const loss=zone==='collab'&&life<5?0:1;
  assert.equal(end.players[1].life.length,life-loss);assert.equal(revealed.length,loss);
 });
}
