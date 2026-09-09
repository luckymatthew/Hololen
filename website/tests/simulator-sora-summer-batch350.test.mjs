import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const mode of ['skip','odd','even'])test('Summer Sora Bloom '+mode,()=>{
 const first=cards.find(c=>c.jpName==='ときのそら'&&c.stage==='1st');let s=state(first.number);s.phase='main';s.players[0].hand=[inst('hEB01-010','bloom')];s.players[1].zones.back1=unit('AUDIT-DUMMY',{stack:[inst('AUDIT-DUMMY','back')]});
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.effect,'soraSummerRoll');s=applyAction(s,0,mode==='skip'?{type:'choose',skip:true}:{type:'choose',optionId:'roll'},pool,()=>mode==='even'?0.2:0);
 if(mode==='odd'){assert.equal(s.pendingChoice.effect,'swapCenter');assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.center.stack[0].id,'back');}else assert.equal(s.pendingChoice,null);
});
test('Summer Sora repeats without three-card stack',()=>{
 let s=state('hEB01-010');fund(s.players[0].zones.center,['紅','無色','無色']);s.players[0].zones.back1=unit('hEB01-010');
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.effect,'artRestBackRepeat');s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.rested,true);assert.equal(s.players[1].zones.center.damage,100);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,200);
});
