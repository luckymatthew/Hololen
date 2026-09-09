import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const name of ['阿修羅＆羅刹','鬼神刀「阿修羅」','ぽよ余'])test('036 named search '+name,()=>{
 const c=cards.find(c=>c.jpName===name||c.name===name);assert.ok(c);
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP06-036');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(c.number,'valid'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
 s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');assert.equal(s.pendingChoice,null);
});
