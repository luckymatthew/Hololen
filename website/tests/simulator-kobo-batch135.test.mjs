import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const damage of [70,80,90])test('Kobo total back damage '+damage,()=>{
 let s=state('hBP05-049');fund(s.players[0].zones.center,['藍']);s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:40});s.players[1].zones.back2=unit('AUDIT-DUMMY',{damage:damage-40});s.players[1].zones.center.damage=100;
 s.players[0].archive=[inst('hY04-001','blue'),inst('hY01-001','white')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(damage>=80){assert.equal(s.pendingChoice.optional,true);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['blue']);s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[0].zones.center.cheer.length,damage>=80?2:1);assert.equal(s.pendingChoice,null);
});
