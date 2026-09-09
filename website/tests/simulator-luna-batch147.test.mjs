import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
const fan=cards.find(c=>c.jpName==='ルーナイト'||c.name==='ルーナイト').number;
for(const count of [1,2,3])test('031 Lunaite threshold '+count,()=>{
 let s=state('hBP06-031');fund(s.players[0].zones.center,['無色','無色','無色','無色']);s.players[0].zones.center.attachments=Array.from({length:count},(_,i)=>inst(fan,'fan'+i));
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,count>=2?210:160);
});
for(const use of [true,false])test('029 optional cheer '+use,()=>{
 let s=state('hBP06-029');fund(s.players[0].zones.center,['無色']);s.players[0].zones.center.attachments=[inst(fan,'fan')];s.players[0].cheerDeck=[inst('hY01-001','top')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,true);s=applyAction(s,0,use?{type:'choose',zone:'center'}:{type:'choose',skip:true},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.length,use?2:1);
});
