import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const zone of ['center','back1'])test('0874 center-only color count '+zone,()=>{
 let s=state(zone==='center'?'hBP08-070':'AUDIT-DUMMY');s.phase='main';if(zone==='back1')s.players[0].zones.back1=unit('hBP08-070');
 s.players[0].hand=[inst('hBP08-074','bloom')];s.players[1].oshi=inst('hBP03-004');
 s.players[1].zones.center=unit('hBP08-050');s.players[1].zones.back1=unit('hBP08-040');s.players[1].zones.back2=unit('hBP08-068');
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone},pool,()=>0);
 assert.equal(s.players[0].hand.length,zone==='center'?2:0);
});
