import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
for(const opponentTurn of [true,false])test('IRyS fan mandatory transfer opponent turn '+opponentTurn,()=>{
 const holder=cards.find(c=>c.jpName==='IRyS'&&c.stage==='Debut').number;let s=state();const owner=opponentTurn?1:0;
 s.players[owner].zones.back1=unit(holder,{damage:10000,attachments:[inst('hBP08-106')],cheer:[inst('hY04-001','old')]});s.players[owner].zones.back2=unit('AUDIT-DUMMY');
 s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:owner,targetZone:'back1',sourceZone:'center',amount:10,loseLife:false,sourceName:'ability'}];s=applyAction(s,0,attack,pool,()=>0);
 if(opponentTurn){assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,owner,{type:'choose',skip:true},pool,()=>0));s=applyAction(s,owner,{type:'choose',cardIds:['old']},pool,()=>0);s=applyAction(s,owner,{type:'choose',zone:'back2'},pool,()=>0);assert.equal(s.players[owner].zones.back2.cheer[0].id,'old');}else{assert.equal(s.pendingChoice,null);assert.ok(s.players[owner].archive.some(c=>c.id==='old'));}
});
