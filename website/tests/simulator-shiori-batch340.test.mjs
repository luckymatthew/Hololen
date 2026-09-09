import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Shiori optional reveal '+skip,()=>{
 let s=state('hBP04-053');fund(s.players[0].zones.center,['藍','無色','無色']);s.players[0].holoPower=[inst('AUDIT-DUMMY','bottom'),inst('hBP04-053','top')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'shioriBookmark');s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'reveal'},pool,()=>0);
 if(!skip)s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,skip?70:90);assert.equal(s.players[0].holoPower[0].id,skip?'bottom':'top');
});
test('Shiori Bloom cheer required',()=>{
 const debut=cards.find(c=>c.jpName==='シオリ・ノヴェラ'&&c.stage==='Debut');let s=state(debut.number);s.phase='main';s.players[0].hand=[inst('hBP04-053','bloom')];s.players[0].cheerDeck=[inst('hY01-001','cheer')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'cheer');
});
test('Shiori Buzz knockout loses two life',()=>{
 const c=cards.find(c=>c.number==='hBP04-053');let s=state('AUDIT-DUMMY',c.number);s.players[1].zones.center.damage=c.hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
