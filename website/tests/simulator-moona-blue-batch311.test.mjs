import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
for(const valid of [true,false])test('Moona first-turn mandatory blue cheer '+valid,()=>{
 let s=state('hBP06-049');s.phase='main';s.firstPlayer=valid?1:0;s.players[0].turnsTaken=1;
 s.players[0].zones.back1=unit('hBP06-049');s.players[0].cheerDeck=[inst('hY04-001','blue'),inst('hY01-001','white')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(!valid){assert.equal(s.pendingChoice,null);return;}
 assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);
 assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:['white']},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.cheer[0].id,'blue');
});
