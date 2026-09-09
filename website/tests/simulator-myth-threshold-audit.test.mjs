import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const myth=cards.find(c=>c.group==='holomem'&&c.tags.includes('#Myth'));
for(const count of [0,3,4,7,8,9])test('Featuring Myth archive threshold '+count,()=>{
 const s=state('hBP02-059');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-059').arts[0].cost);
 s.players[0].archive=Array.from({length:count},(_,i)=>inst(myth.number,'myth'+i));
 const end=applyAction(s,0,attack,pool,()=>.5);assert.equal(end.players[1].zones.center.damage,80+(count>=4?40:0)+(count>=8?40:0));assert.equal(end.players[0].archive.length,count);
});
test('Featuring Myth excludes non-Myth Holomen and tagged support',()=>{
 const s=state('hBP02-059');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-059').arts[0].cost);
 s.players[0].archive=[...Array.from({length:3},(_,i)=>inst(myth.number,'myth'+i)),inst('AUDIT-DUMMY','nonMyth'),inst('MYTH-SUPPORT','support')];
 const end=applyAction(s,0,attack,[...pool,{number:'MYTH-SUPPORT',group:'support',tags:['#Myth']}],()=>.5);assert.equal(end.players[1].zones.center.damage,80);
});
