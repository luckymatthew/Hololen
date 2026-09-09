import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,attack} from './fixtures/simulator-audit.mjs';
for(const own of [true,false])for(const zone of ['back1','collab'])test('069 damage own '+own+' zone '+zone,()=>{
 const s=state();const owner=own?0:1;s.players[owner].zones[zone]=unit('hBP05-069');
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:zone,sourceZone:'center',amount:10,loseLife:true,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>0);assert.equal(r.players[owner].zones[zone].damage,!own&&zone==='back1'?0:10);
});
