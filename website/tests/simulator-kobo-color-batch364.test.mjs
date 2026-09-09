import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
test('Kobo requires same ID3 color Cheer selection',()=>{
 const debut=cards.find(c=>c.jpName==='こぼ・かなえる'&&c.stage==='Debut');let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP07-058','bloom')];s.players[0].cheerDeck=[inst('hY04-001','blue'),inst('hY03-001','red')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['blue']);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'blue');
});
