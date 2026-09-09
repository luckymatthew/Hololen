import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const cost of [4,5,6])test('0853 baton threshold '+cost,()=>{
 const target={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'BATON-TARGET',baton:cost};
 let s=state('hBP08-053','BATON-TARGET');fund(s.players[0].zones.center,['藍','藍','無色']);s.players[1].zones.back1=unit('hBP08-050');
 const p=[...pool,target];s=applyAction(s,0,attack,p,()=>0);
 if(cost>=5){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},p,()=>0);}
 else assert.equal(s.pendingChoice,null);
 assert.equal(s.players[1].zones.back1.damage,cost>=5?100:0);
});
