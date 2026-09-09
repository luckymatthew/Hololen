import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('068 required finger search once per turn',()=>{
 const prior=cards.find(c=>c.jpName==='戌神ころね'&&c.stage==='Debut'),finger=cards.find(c=>c.jpName==='ゆび'||c.name==='ゆび');
 let s=state(prior.number);s.phase='main';s.players[0].zones.back1=unit(prior.number,{stack:[inst(prior.number,'secondBase')]});s.players[0].hand=[inst('hBP06-068','one'),inst('hBP06-068','two')];s.players[0].mainDeck=[inst(finger.number,'finger'),inst(finger.number,'remaining'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'one'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['finger']},pool,()=>0);
 s=applyAction(s,0,{type:'play',cardId:'two'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,1);assert.ok(s.players[0].mainDeck.some(c=>c.id==='remaining'));
});
