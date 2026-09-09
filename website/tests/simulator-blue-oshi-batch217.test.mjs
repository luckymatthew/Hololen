import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const oshi of ['hBP03-004','hBP08-003','AUDIT-OSHI'])test('0860 blue FUWAMOCO gate '+oshi,()=>{
 let s=state('hBP08-060');s.players[0].oshi=inst(oshi);fund(s.players[0].zones.center,['無色','無色']);s.players[0].mainDeck=[inst('AUDIT-DUMMY','top'),inst('AUDIT-DUMMY','next')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].holoPower.length,oshi==='hBP03-004'?1:0);
 assert.equal(s.players[0].mainDeck[0].id,oshi==='hBP03-004'?'next':'top');
});
