import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const other of [null,'hBP07-052',cards.find(c=>c.group==='holomem'&&c.tags?.includes('#Promise')&&c.jpName!=='オーロ・クロニー').number]){
 test('0752 Promise excludes Kronii '+other,()=>{
  let s=state('hBP07-052');fund(s.players[0].zones.center,['無色']);
  if(other)s.players[0].zones.back1=unit(other);
  s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,other&&other!=='hBP07-052'?40:30);
 });
}
for(const valid of [false,true])test('0763 requires AZKi oshi '+valid,()=>{
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;
 s.players[0].zones.back1=unit('hBP07-063');s.players[1].zones.center.cheer=[inst('hY01-001','enemy')];
 if(valid)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='AZKi').number);
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(Boolean(s.pendingChoice),valid);
 if(valid){assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,{type:'choose',skip:true},pool,()=>0);}
 assert.equal(s.players[1].zones.center.cheer.length,1);
});
