import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const skip of [true,false])test('Polka optional archive roll '+skip,()=>{
 let s=state('hBP05-033');fund(s.players[0].zones.center,['紅','無色','無色']);s.players[0].archive=Array.from({length:8},(_,i)=>inst('AUDIT-DUMMY','a'+i));
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'polkaArchiveRoll');
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>0.4);
 assert.equal(s.players[0].archive.length,skip?8:11);assert.equal(s.players[1].zones.center.damage,skip?40:50);
});
for(const count of [0,1,2])test('Polka counts each attached Zain '+count,()=>{
 let s=state('hBP05-033');fund(s.players[0].zones.center,['紅','無色','無色']);const fan=cards.find(c=>c.jpName==='座員');
 s.players[0].zones.center.attachments=Array.from({length:count},(_,i)=>inst(fan.number,'f'+i));
 s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[1].zones.center.damage,70+count*10);
});
