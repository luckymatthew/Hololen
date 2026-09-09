import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Flare optional life die '+skip,()=>{
 let s=state('hBP05-067');fund(s.players[0].zones.center,['黃','黃','無色']);s.players[0].life=s.players[0].life.slice(0,3);
 s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>0.4);
 assert.equal(s.players[1].zones.center.damage,skip?120:180);assert.equal(s.players[0].hand.length,skip?0:1);
});

test('Flare Gift two cheer transfer requires named first recovery',()=>{
 const first=cards.find(c=>c.jpName==='不知火フレア'&&c.stage==='1st');let s=state('hBP05-067');fund(s.players[0].zones.center,['黃','黃','無色']);s.players[0].zones.back1=unit(first.number);s.players[0].archive=[inst(first.number,'recover')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(s.pendingChoice.effect==='flareLifeRoll')s=applyAction(s,0,{type:'choose',skip:true},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'giftFlareCheerTarget');s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);
 for(const cheerId of ['cheer0','cheer1'])s=applyAction(s,0,{type:'choose',zone:'center',cheerId},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'archiveToHand');assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);assert.equal(s.players[0].zones.back1.cheer.length,2);assert.ok(s.players[0].hand.some(c=>c.id==='recover'));
});
