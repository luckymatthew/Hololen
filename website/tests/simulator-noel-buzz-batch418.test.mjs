import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,cards,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
test('Noel SP on native Buzz draws two before normal two-life loss',()=>{let s=state('AUDIT-DUMMY','hBP02-017');s.players[1].oshi=inst('hBP05-001');s.players[1].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP02-017').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.meta.trigger,'noelDown');assert.equal(s.players[1].life.length,5);s=applyAction(s,1,{type:'choose',optionId:'use'},pool,()=>0);assert.equal(s.players[1].hand.length,2);assert.equal(s.players[1].life.length,4);s=applyAction(s,1,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].life.length,2);});
