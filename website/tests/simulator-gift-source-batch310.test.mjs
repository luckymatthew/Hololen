import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const custom=[...pool.filter(c=>c.number!==dummy.number),{...dummy,arts:[{...dummy.arts[0],damage:0}]}];
for(const source of [0,1])test('hBP06-009 damage reduction source '+source,()=>{
 let s=state();s.players[1].zones.center=unit('hBP06-009');s.players[1].zones.collab=unit(dummy.number);
 s.effectQueue=[{type:'specialDamage',playerIndex:source,targetPlayerIndex:1,targetZone:'collab',sourceZone:'center',amount:40}];
 s=applyAction(s,0,attack,custom,()=>0);
 assert.equal(s.players[1].zones.collab.damage,30);
});

