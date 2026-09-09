import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
const debut=cards.find(c=>c.jpName==='森カリオペ'&&c.stage==='Debut');
for(const count of [2,3])test('Calli Bloom EN count '+count,()=>{
 let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP06-059','bloom')];
 for(let i=1;i<count;i++)s.players[0].zones['back'+i]=unit(debut.number,{stack:[inst(debut.number,'back'+i)]});
 s.players[0].cheerDeck=[inst('hY04-001','blue'),inst('hY05-001','purple'),inst('hY01-001','white')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 if(count<3){assert.equal(s.pendingChoice,null);return;}
 assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);
 assert.throws(()=>applyAction(s,0,{type:'choose',cardIds:['white']},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['purple']},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.players[0].zones.center.cheer[0].id,'purple');
});
