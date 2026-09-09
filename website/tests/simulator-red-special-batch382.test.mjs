import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,publicRoomState} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [red,turn] of [[true,3],[false,3],[true,4]])test('Red special attack duration '+red+' '+turn,()=>{
 const defender={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'COLOR-DEFENDER',colors:red?['紅']:['藍']};let s=state('AUDIT-DUMMY','COLOR-DEFENDER');s.turn=turn;s.players[0].zones.center.modifiers=[{kind:'specialAttack:red',amount:30,expiresTurn:3,sourceNumber:'hBP03-071'}];s=applyAction(s,0,attack,[...pool,defender],()=>0);assert.equal(s.players[1].zones.center.damage,red&&turn===3?130:100);
});


test('Watame may skip RPS',()=>{let s=state('hBP03-071');fund(s.players[0].zones.center,['黃','無色']);s=applyAction(s,0,attack,pool,()=>{throw Error('must not roll before consent');});assert.equal(s.pendingChoice.effect,'watameRpsStart');s=applyAction(s,0,{type:'choose',skip:true},pool,()=>{throw Error('must not roll on skip');});assert.equal(s.players[1].zones.center.damage,50);});


test('Watame private RPS tie then win',()=>{
 const red={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'RED',colors:['紅']};const p=[...pool,red];let s=state('hBP03-071','RED');fund(s.players[0].zones.center,['黃','無色']);s=applyAction(s,0,attack,p,()=>0);s=applyAction(s,0,{type:'choose',optionId:'play'},p,()=>0);
 s=applyAction(s,0,{type:'choose',optionId:'rock'},p,()=>0);const view=publicRoomState(s,1);assert.equal(view.privateRps,undefined);assert.equal(view.pendingChoice.meta?.first,undefined);assert.ok(!JSON.stringify(view.log).includes('石頭'));
 s=applyAction(s,1,{type:'choose',optionId:'rock'},p,()=>0);assert.equal(s.pendingChoice.playerIndex,0);assert.equal(s.players[1].zones.center.damage,0);s=applyAction(s,0,{type:'choose',optionId:'paper'},p,()=>0);s=applyAction(s,1,{type:'choose',optionId:'rock'},p,()=>0);assert.equal(s.players[1].zones.center.damage,80);assert.equal(s.privateRps,undefined);
});
