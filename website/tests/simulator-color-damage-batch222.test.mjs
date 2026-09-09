import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [center,collab] of [['藍','紅'],['紅','藍'],['藍','藍'],['紅','紫']])test('0868 independent color gate '+center+collab,()=>{
 const dummy=pool.find(c=>c.number==='AUDIT-DUMMY');const p=[...pool,{...dummy,number:'C',colors:[center]},{...dummy,number:'B',colors:[collab]}];
 let s=state('hBP08-068','C');fund(s.players[0].zones.center,['紫']);s.players[1].oshi=inst('hBP03-004');s.players[1].zones.collab=unit('B');
 s=applyAction(s,0,attack,p,()=>0);assert.equal(s.players[1].zones.center.damage,center==='藍'?10:30);assert.equal(s.players[1].zones.collab.damage,collab==='藍'?0:20);
});
