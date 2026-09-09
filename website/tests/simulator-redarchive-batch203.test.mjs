import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const red of [0,1,3])test('0840 red archive only '+red,()=>{
 let s=state('hBP08-040');fund(s.players[0].zones.center,['紅','無色']);
 s.players[0].archive=[inst('hY01-001','white'),inst('hY05-001','purple'),inst('hBP08-040','member'),...Array.from({length:red},(_,i)=>inst('hY03-001','red'+i))];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,30+red*10);
});
test('0840 Buzz loses two life',()=>{
 let s=state('AUDIT-DUMMY','hBP08-040');s.players[1].zones.center.damage=150;
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
