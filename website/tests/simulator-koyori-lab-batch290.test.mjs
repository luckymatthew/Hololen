import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const support=cards.find(c=>c.group==='support'&&c.tags?.includes('#こよラボ'));
test('Koyori Bloom mandatory lab support',()=>{const prior=cards.find(c=>c.jpName==='博衣こより'&&c.stage==='Debut');let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hBP04-012','bloom')];s.players[0].mainDeck=[inst(support.number,'yes')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);});
for(const equipped of [true,false])test('Koyori Arts lab support search gate '+equipped,()=>{let s=state('hBP04-013');fund(s.players[0].zones.center,['白','無色','無色']);if(equipped)s.players[0].zones.center.attachments=[inst(support.number,'attached')];s.players[0].mainDeck=[inst(support.number,'yes')];s=applyAction(s,0,attack,pool,()=>0);if(equipped){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'yes');}else assert.equal(s.pendingChoice,null);});
