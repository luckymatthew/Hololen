import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund} from './fixtures/simulator-audit.mjs';
test('0734 required paid FLOW GLOW search',()=>{
 const c=cards.find(c=>c.number==='hBP07-034'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut'),target=cards.find(c=>c.stage==='Debut'&&c.tags.includes('#FLOW GLOW')),invalid=cards.find(c=>c.stage==='2nd'&&c.tags.includes('#FLOW GLOW'));
 let s=state(prior.number);s.phase='main';fund(s.players[0].zones.center,['白']);s.players[0].hand=[inst(c.number,'bloom')];s.players[0].mainDeck=[inst(target.number,'valid'),inst(invalid.number,'invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);s=applyAction(s,0,{type:'choose',cheerId:'cheer0'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');
});


