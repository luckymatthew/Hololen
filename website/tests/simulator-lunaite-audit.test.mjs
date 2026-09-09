import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../lib/simulator/engine.mjs';
import { cards,pool,inst,unit,dummy,state,attack } from './fixtures/simulator-audit.mjs';

const luna=cards.find(c=>c.jpName==='姫森ルーナ'&&c.hp>=150&&c.keyword?.type!=='gift').number;
const zero={...dummy,arts:[{...dummy.arts[0],damage:0}]};
const testPool=[...pool.filter(c=>![dummy.number,'hBP06-030'].includes(c.number)),zero,{...cards.find(c=>c.number==='hBP06-030'),arts:zero.arts}];
const choose=(s,a)=>applyAction(s,s.pendingChoice.playerIndex,{type:'choose',...a},testPool);
function hit({kind='arts',copies=1,giftZone='collab',targetZone='center',ownTurn=false,ko=false,back=true}={}) {
 const s=state();s.players[0].zones.collab=unit(dummy.number);
 s.players[1].zones.center=unit(luna);
 s.players[1].zones.back1=back?unit(luna):unit(dummy.number);
 s.players[1].zones.collab=unit(dummy.number);
 if(giftZone)s.players[1].zones[giftZone]=unit('hBP06-030');
 const target=s.players[1].zones[targetZone];
 target.attachments=Array.from({length:copies},(_,i)=>inst('hBP03-105','fan'+i));
 if(ko)target.damage=cards.find(c=>c.number===luna).hp-10;
 s.activePlayer=ownTurn?1:0;
 s.effectQueue=[{type:kind==='arts'?'dealArtsDamage':'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone,sourceZone:'center',damage:100,amount:100,sourceName:'Audit',artName:'Audit'}];
 return applyAction(s,s.activePlayer,{...attack,sourceZone:'collab',targetZone:'collab'},testPool,()=>0.5);
}
function finish(s){for(let i=0;s.pendingChoice&&i<12;i++){
 if(s.pendingChoice.type==='lifeCheerTarget')s=choose(s,{zone:'back1'});
 else throw new Error('Unexpected pending '+s.pendingChoice.effect);
}return s;}
function countFan(s,id){return s.players.flatMap(p=>[...p.archive,...Object.values(p.zones).filter(Boolean).flatMap(u=>u.attachments)]).filter(c=>c.id===id).length;}

for(const kind of ['arts','special']) {
 test(`Luna Gift ${kind}: paid fan can move to back and still reduce damage`,()=>{
  let s=choose(hit({kind}),{optionId:'use'});
  assert.equal(s.pendingChoice?.effect,'giftMoveLunaite');
  assert.equal(s.players[1].zones.center.damage,0,'replacement resolves before damage');
  assert.equal(s.players[1].archive.some(c=>c.id==='fan0'),false);
  s=choose(s,{zone:'back1'});
  assert.equal(s.players[1].zones.center.damage,70);
  assert.equal(s.players[1].zones.back1.attachments[0].id,'fan0');
  assert.equal(countFan(s,'fan0'),1);
 });
 test(`Luna Gift ${kind}: decline transfer archives paid fan and retains reduction`,()=>{
  let s=choose(hit({kind}),{optionId:'use'});
  assert.equal(s.pendingChoice?.effect,'giftMoveLunaite');assert.equal(s.pendingChoice.optional,true);
  s=choose(s,{skip:true});
  assert.equal(s.players[1].zones.center.damage,70);
  assert.equal(s.players[1].archive.filter(c=>c.id==='fan0').length,1);
 });
 test(`Luna Gift ${kind}: rejecting the cost preserves the fan without offering transfer`,()=>{
  const s=choose(hit({kind}),{skip:true});
  assert.equal(s.pendingChoice,null);
  assert.equal(s.players[1].zones.center.damage,100);
  assert.equal(s.players[1].zones.center.attachments[0].id,'fan0');
 });
 test(`Luna Gift ${kind}: transfer cannot select central or unrelated Holomen`,()=>{
  const s=choose(hit({kind}),{optionId:'use'});
  assert.equal(s.pendingChoice?.effect,'giftMoveLunaite');
  assert.deepEqual(s.pendingChoice.options,['back1']);
  assert.throws(()=>choose(s,{zone:'center'}));
  assert.equal(s.players[1].zones.center.damage,0);
 });
 test(`Luna Gift ${kind}: each of three fans can replace payment independently`,()=>{
  let s=hit({kind,copies:3});
  for(let i=0;i<3;i++){
   assert.equal(s.pendingChoice?.effect,'damageReaction');s=choose(s,{optionId:'use'});
   assert.equal(s.pendingChoice?.effect,'giftMoveLunaite');s=choose(s,i===1?{skip:true}:{zone:'back1'});
  }
  assert.equal(s.players[1].zones.center.damage,10);
  assert.deepEqual(s.players[1].zones.back1.attachments.map(c=>c.id),['fan0','fan2']);
  for(let i=0;i<3;i++)assert.equal(countFan(s,'fan'+i),1);
 });
 for(const transfer of [true,false])test(`Luna Gift ${kind}: knockout transfer is optional (${transfer})`,()=>{
  let s=choose(hit({kind,ko:true}),{skip:true});
  assert.equal(s.pendingChoice?.effect,'giftMoveLunaite');assert.equal(s.pendingChoice.optional,true);
  s=finish(choose(s,transfer?{zone:'back1'}:{skip:true}));
  assert.equal(s.players[1].zones.center,null);
  assert.equal(s.players[1].zones.back1.attachments.some(c=>c.id==='fan0'),transfer);
  assert.equal(countFan(s,'fan0'),1);
 });
 for(const opts of [{giftZone:null},{giftZone:'back2'},{back:false},{targetZone:'back1'}])test(`Luna Gift ${kind}: excludes invalid replacement ${JSON.stringify(opts)}`,()=>{
  let s=choose(hit({kind,...opts}),{optionId:'use'});
  assert.notEqual(s.pendingChoice?.effect,'giftMoveLunaite');
  assert.equal(s.players[1].archive.filter(c=>c.id==='fan0').length,1);
 });
 test(`Luna Gift ${kind}: own turn knockout does not replace archive`,()=>{
  let s=finish(hit({kind,ko:true,ownTurn:true}));
  assert.equal(s.players[1].zones.center,null);
  assert.equal(s.players[1].archive.filter(c=>c.id==='fan0').length,1);
 });
}
