import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,fund,attack} from './fixtures/simulator-audit.mjs';
const limited=cards.find(c=>c.group==='support'&&c.type.toUpperCase().includes('LIMITED')).number,normal=cards.find(c=>c.group==='support'&&!c.type.toUpperCase().includes('LIMITED')).number;
for(const count of [0,1,2,3])test('077 LIMITED count '+count,()=>{
 let s=state('hBP06-077');fund(s.players[0].zones.center,['黃','黃','無色']);s.players[0].turnEvents={turn:s.turn,supports:[normal,...Array(count).fill(limited)],arts:[]};s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,140+30*count);
});
test('077 excludes previous turn',()=>{
 let s=state('hBP06-077');fund(s.players[0].zones.center,['黃','黃','無色']);s.players[0].turnEvents={turn:s.turn-1,supports:[limited],arts:[]};s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,140);
});
