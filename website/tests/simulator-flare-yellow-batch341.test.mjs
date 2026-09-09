import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
test('Flare Bloom yellow cheer required to self',()=>{
 const debut=cards.find(c=>c.jpName==='不知火フレア'&&c.stage==='Debut');let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP03-079','bloom')];s.players[0].zones.back1=unit('AUDIT-DUMMY');s.players[0].cheerDeck=[inst('hY06-001','yellow')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['yellow']},pool,()=>0);assert.throws(()=>applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0));s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'yellow');
});
test('Flare Buzz knockout loses two life',()=>{
 const c=cards.find(c=>c.number==='hBP03-079');let s=state('AUDIT-DUMMY',c.number);s.players[1].zones.center.damage=c.hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
