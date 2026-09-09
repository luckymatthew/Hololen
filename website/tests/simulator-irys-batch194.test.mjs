import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const name of ['Bloom＆Gloom','GuyRyS'])test('0810 required named search '+name,()=>{
 const c=cards.find(c=>c.number==='hBP08-010'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 const pick=cards.find(c=>c.jpName===name||c.name===name);
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].mainDeck=[inst(pick.number,'pick'),inst('AUDIT-DUMMY','other')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['pick']},pool,()=>0);
 assert.equal(s.players[0].hand.at(-1).id,'pick');assert.equal(s.players[0].mainDeck.length,1);
});
