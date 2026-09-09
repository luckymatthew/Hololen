import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,2])test('064 distinct available '+count,()=>{
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP05-064');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power')];
 if(count)s.players[0].mainDeck.push(inst('hBP05-020','a'),inst('hBP05-020','duplicate'));
 if(count===2)s.players[0].mainDeck.push(inst('hBP05-030','b'));
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(count){assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,count);s=applyAction(s,0,{type:'choose',cardIds:count===2?['a','b']:['a']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,count);assert.equal(s.pendingChoice,null);
});

