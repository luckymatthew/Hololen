import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [damage,zone,oshi] of [[99,'back1',true],[100,'back1',true],[101,'back1',true],[101,'collab',true],[101,'back1',false]])test('0757 damage threshold '+damage+zone+oshi,()=>{
 let s=state('hBP07-057');fund(s.players[0].zones.center,['藍','藍','無色']);
 if(oshi)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='猫又おかゆ').number);
 s.players[1].zones[zone]=unit('AUDIT-DUMMY',{damage});
 s=applyAction(s,0,attack,pool,()=>0);
 const enabled=damage>100&&zone==='back1'&&oshi;
 if(enabled){
 assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 }
 else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.center.damage,enabled?150:100);
});
