import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const debut=cards.find(c=>c.jpName==='宝鐘マリン'&&c.stage==='Debut');
test('Marine paid stack required top Cheer',()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hEB01-013',{stack:[inst(debut.number,'under'),inst('hEB01-013','top')]});s.players[0].cheerDeck=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,{type:'choose',cardIds:['under']},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
for(const available of [true,false])test('Marine required back damage '+available,()=>{
 let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hEB01-014','bloom')];if(available)s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);if(available){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.back1.damage,10);}else assert.equal(s.pendingChoice,null);
});
