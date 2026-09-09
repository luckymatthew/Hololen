import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const stage of ['Debut','Spot'])test('010 required deployment '+stage,()=>{
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP06-010');
 const target=cards.find(c=>c.group==='holomem'&&c.stage===stage);
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'valid'),inst('hBP05-059','invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.stack[0].id,'valid');assert.equal(s.pendingChoice,null);
});
