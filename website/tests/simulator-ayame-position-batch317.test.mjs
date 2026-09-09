import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [zone,life,allowed] of [['center',5,true],['collab',5,false],['collab',2,true]])test(`Ayame Arts position ${zone} life ${life}`,()=>{
 const s=state();s.players[0].zones[zone]=unit('hBP06-039');s.players[0].life=s.players[0].life.slice(0,life);
 fund(s.players[0].zones[zone],['紅','紅']);
 if(!allowed){assert.throws(()=>applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0));return;}
 const end=applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0);
 assert.equal(end.players[1].zones.center.damage,80);
});
