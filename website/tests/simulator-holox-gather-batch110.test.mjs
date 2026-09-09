import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state} from './fixtures/simulator-audit.mjs';
for(const die of [0,1,2])test('057 optional roll mandatory recovery '+die,()=>{
 const c=cards.find(c=>c.number==='hBP04-057');let s=state(cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut').number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];s.players[0].archive=[inst(c.number,'valid'),inst('AUDIT-DUMMY','wrong')];const act=a=>{s=applyAction(s,0,a,pool,()=>(die-.5)/6)};
 act({type:'play',cardId:'bloom'});act({type:'choose',zone:'center'});assert.equal(s.players[0].turnEvents.diceRollCount||0,0);act(die?{type:'choose',optionId:'roll'}:{type:'choose',skip:true});
 if(die){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);act({type:'choose',cardIds:['valid']});assert.equal((die===1?s.players[0].hand:s.players[0].mainDeck)[0].id,'valid');}
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].turnEvents.diceRollCount||0,die?1:0);
});
