import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const color of ['紅','白'])test('0741 entire stage color '+color,()=>{
 let s=state('hBP07-041');fund(s.players[0].zones.center,['紅','紅']);s.players[0].zones.back1=unit('AUDIT-DUMMY',{cheer:[inst(color==='紅'?'hY03-001':'hY01-001','back')]});
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,color==='紅'?100:80);
});
