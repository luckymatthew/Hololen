import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
for(const pay of [true,false])test('Ayame paid required front damage '+pay,()=>{
 const card=cards.find(c=>c.number==='hSD02-006'),prior=cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut');let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(card.number,'bloom'),inst('AUDIT-DUMMY','pay')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s=applyAction(s,0,pay?{type:'choose',cardIds:['pay']}:{type:'choose',skip:true},pool,()=>0);if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}assert.equal(s.players[1].zones.center.damage,pay?20:0);
});
