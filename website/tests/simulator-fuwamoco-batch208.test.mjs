import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
test('0834 required Fuwawa and Mococo deployment',()=>{
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP08-034');
 const f=cards.find(c=>c.jpName==='フワワ・アビスガード'&&c.stage==='Debut'),m=cards.find(c=>c.jpName==='モココ・アビスガード'&&c.stage==='Debut');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(f.number,'f'),inst(m.number,'m')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['f']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['m']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);
 assert.equal(s.players[0].zones.back1.stack[0].id,'f');assert.equal(s.players[0].zones.back2.stack[0].id,'m');assert.equal(s.pendingChoice,null);
});
