import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
test('0824 Arts rests source',()=>{
 let s=state('hBP08-024');fund(s.players[0].zones.center,['綠']);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].zones.center.rested,true);assert.equal(s.players[1].zones.center.damage,60);
});
for(const use of [true,false])test('0823 optional rest required heal '+use,()=>{
 const c=cards.find(c=>c.number==='hBP08-023'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(c.number,'bloom')];
 s.players[0].zones.back1=unit('hBP08-024',{rested:true,damage:60});
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,use?{type:'choose',optionId:'use'}:{type:'choose',skip:true},pool,()=>0);
 if(use){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);}
 assert.equal(s.players[0].zones.back1.damage,use?10:60);
});
