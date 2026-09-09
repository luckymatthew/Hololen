import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const returned of [true,false])test('Journey Arts actual stage return '+returned,()=>{
 let s=state('hBP07-042');fund(s.players[0].zones.center,['紅','無色','無色']);if(returned){s.players[0].zones.back1=unit('AUDIT-DUMMY');s.pendingChoice={type:'stageTarget',effect:'returnBackDebutForCheer',playerIndex:0,targetPlayerIndex:0,options:['back1'],optional:false,meta:{}};s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].turnEvents.stageReturned,1);}
 s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[1].zones.center.damage,returned?190:140);
});
