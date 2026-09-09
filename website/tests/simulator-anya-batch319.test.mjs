import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,fund} from './fixtures/simulator-audit.mjs';
test('Anya Gift protects other ancient weapon holders',()=>{
 let s=state();s.players[1].oshi=inst('hBP04-007');s.players[1].zones.collab=unit('hBP06-082');
 const weapon=cards.find(c=>c.jpName==='古代武器');s.players[1].zones.center.attachments=[inst(weapon.number)];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,70);
});
for(const used of [true,false])test('Anya recovery requires current ritual '+used,()=>{
 let s=state('hBP06-082');s.players[0].oshi=inst('hBP04-007');s.players[0].oshiSkillTurn=used?s.turn:s.turn-1;
 s.players[0].archive=[inst('hBP06-082','recover')];fund(s.players[0].zones.center,['黃']);
 s=applyAction(s,0,attack,pool,()=>0);
 if(!used){assert.equal(s.pendingChoice,null);return;}
 assert.equal(s.pendingChoice.effect,'archiveToHand');
 s=applyAction(s,0,{type:'choose',cardIds:['recover']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='recover'));
});
