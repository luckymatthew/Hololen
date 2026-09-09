import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,3])test('Choco event Arts count '+count,()=>{
 const c=cards.find(c=>c.number==='hSD04-009'),event=cards.find(c=>c.typeCode==='supportEvent'),item=cards.find(c=>c.typeCode==='supportItem');let s=state(c.number);fund(s.players[0].zones.center,c.arts[1].cost);s.players[0].turnEvents={turn:s.turn,arts:[],supports:[...Array(count).fill(event.number),item.number]};s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.players[1].zones.center.damage,60+count*40);
});

