import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const timing of ['current','previous','none'])test('033 Limit Over meal condition '+timing,()=>{
 const s=state('hBP04-033');fund(s.players[0].zones.center,['紅','無色']);s.players[1].zones.collab=unit('AUDIT-DUMMY');
 const meal=cards.find(c=>c.name==='限界飯'||c.jpName==='限界飯');s.players[0].turnEvents={turn:timing==='previous'?s.turn-1:s.turn,supports:timing==='none'?[]:[meal.number],arts:[]};
 const next=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(next.players[1].zones.collab.damage,timing==='current'?20:0);assert.equal(next.players[1].zones.center.damage,30);
});
