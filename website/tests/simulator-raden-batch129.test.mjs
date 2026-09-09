import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const stage of ['Debut','1st','2nd'])test('Raden requires ReGLOSS 2nd '+stage,()=>{
 let s=state('hBP05-029');fund(s.players[0].zones.center,['綠','無色','無色']);s.players[0].zones.back1=unit(cards.find(c=>c.stage===stage&&c.tags.includes('#ReGLOSS')).number);
 s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[1].zones.center.damage,stage==='2nd'?120:80);
});
for(const match of [true,false])test('Raden mushroom search Oshi '+match,()=>{
 let s=state('hBP05-029');fund(s.players[0].zones.center,['綠','無色']);
 if(match)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='儒烏風亭らでん').number);
 const mushroom=cards.find(c=>['supportEvent','supportEventLimited'].includes(c.typeCode)&&c.tags.includes('#きのこ'));
 s.players[0].mainDeck=[inst(mushroom.number,'mushroom'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(match){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['mushroom']);s=applyAction(s,0,{type:'choose',cardIds:['mushroom']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,match?1:0);assert.equal(s.pendingChoice,null);
});
for(const n of ['hBP05-017','hBP05-029'])for(const loseLife of [true,false])test(n+' Buzz life '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit(n,{damage:10000});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>.5);assert.equal(r.players[1].zones.back1,null);assert.equal(r.players[1].life.length,loseLife?3:5);
});
