import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const myth of [true,false])test('0843 all stage Myth '+myth,()=>{
 let s=state('hBP08-043');fund(s.players[0].zones.center,['紅','紅']);s.players[0].zones.back1=unit(myth?'hBP08-043':'AUDIT-DUMMY');
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','top'),inst('AUDIT-DUMMY','next')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].holoPower.length,myth?1:0);
 assert.equal(s.players[0].mainDeck[0].id,myth?'next':'top');
});
test('0843 Buzz two life',()=>{
 let s=state('AUDIT-DUMMY','hBP08-043');s.players[1].zones.center.damage=180;
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
