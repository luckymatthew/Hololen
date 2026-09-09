import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const moona=cards.find(c=>c.group==='holomem'&&c.jpName==='ムーナ・ホシノヴァ');
const custom=[...pool.filter(c=>c.number!==moona.number),{...moona,arts:[{...dummy.arts[0],damage:0}]}];
for(const skip of [true,false])test('Moona fan special trigger skip '+skip,()=>{
 let s=state(moona.number);s.players[0].zones.center.attachments=[inst('hBP06-101')];s.players[0].zones.back1=unit(dummy.number);
 s.players[0].archive=[inst('hY04-001','blue')];s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'center',sourceZone:'center',amount:10}];
 s=applyAction(s,0,attack,custom,()=>0);assert.equal(s.pendingChoice.effect,'moonaFanCheer');
 s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['blue']},custom,()=>0);
 if(!skip){assert.throws(()=>applyAction(s,0,{type:'choose',zone:'center'},custom,()=>0));s=applyAction(s,0,{type:'choose',zone:'back1'},custom,()=>0);}
 assert.equal(s.players[0].zones.back1.cheer.length,skip?0:1);
});
