import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
for(const mode of ['skip','odd','even'])test('Promo Flower die '+mode,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hPR-001');s.players[0].zones.back2=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY03-001','red'),inst('hY04-001','blue'),inst('hY01-001','white')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.effect,'promoFlowerRoll');s=applyAction(s,0,mode==='skip'?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>mode==='even'?0.2:0);
 if(mode==='odd'){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.selectableIds,['red','blue']);s=applyAction(s,0,{type:'choose',cardIds:['blue']},pool,()=>0);assert.deepEqual(s.pendingChoice.options,['back2']);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);assert.equal(s.players[0].zones.back2.cheer[0].id,'blue');}else assert.equal(s.pendingChoice,null);
});
