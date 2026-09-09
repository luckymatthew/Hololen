import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
for(const zone of ['back1','center'])test('Backshot special damage trigger '+zone,()=>{
 let s=state();s.players[0].oshi=inst('hSD03-001');s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','p'+i));s.players[1].zones.back1=unit('AUDIT-DUMMY');s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,sourceZone:'center',targetZone:zone,amount:10,loseLife:true,sourceName:'Holomen'}];s=applyAction(s,0,attack,pool,()=>0);
 if(zone==='back1'){assert.equal(s.pendingChoice.meta.trigger,'backshot');s=applyAction(s,0,{type:'choose',optionId:'use'},pool,()=>0);assert.equal(s.players[1].zones.back1.damage,60);assert.equal(s.players[0].spOshiSkillUsed,true);}else assert.equal(s.pendingChoice,null);
});
