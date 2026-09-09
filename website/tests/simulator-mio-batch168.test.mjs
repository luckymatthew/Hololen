import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const name of ['ハトタウロス','ミオファ'])test('0726 search '+name,()=>{
 const card=cards.find(c=>c.number==='hBP07-026'),prior=cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut'),target=cards.find(c=>c.jpName===name||c.name===name);
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom')];s.players[0].mainDeck=[inst(target.number,'valid'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
 s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');assert.equal(s.pendingChoice,null);
});
