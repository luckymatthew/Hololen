import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const zone of ['center','back1'])test('0845 current Arts buff '+zone,()=>{
 let s=state('hBP08-045');fund(s.players[0].zones.center,['紅']);s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',zone},pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,zone==='center'?60:50);
 assert.equal(s.players[0].zones[zone].modifiers.find(m=>m.kind==='arts').amount,10);
});
