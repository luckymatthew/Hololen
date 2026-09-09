import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
const korone=cards.find(c=>c.group==='holomem'&&c.jpName==='戌神ころね').number;
for(const owner of [0,1])test('066 mandatory DOWN Cheer owner '+owner,()=>{
 const s=state();s.players[owner].zones.back1=unit('hBP03-066',{damage:10000});s.players[owner].zones.back2=unit(korone);s.players[owner].cheerDeck=[inst('hY01-001','top'),inst('hY02-001','next')];
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'test'}];
 let e=applyAction(s,0,attack,pool,()=>.5);assert.equal(e.pendingChoice.type,'eventCheerTarget');assert.equal(e.pendingChoice.optional,false);assert.deepEqual(e.pendingChoice.options,['back2']);
 e=applyAction(e,owner,{type:'choose',zone:'back2'},pool,()=>.5);assert.equal(e.players[owner].zones.back2.cheer[0].id,'top');assert.equal(e.players[owner].cheerDeck[0].id,'next');
});
