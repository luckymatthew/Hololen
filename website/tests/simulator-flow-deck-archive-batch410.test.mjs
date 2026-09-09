import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,cards,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const number of ['hBP06-018','hBP06-019','hBP06-020'])test('FLOW GLOW ordinary deck archive does not trigger Cheer SP '+number,()=>{let s=state(number);fund(s.players[0].zones.center,cards.find(c=>c.number===number).arts[0].cost);s.players[0].oshi=inst('hSD11-001');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','p'+i));s=applyAction(s,0,attack,pool,()=>0);if(s.pendingChoice?.effect==='artDeckTopArchive')s=applyAction(s,0,{type:'choose',optionId:'1'},pool,()=>0);assert.ok(s.players[0].archive.some(c=>c.number==='AUDIT-DUMMY'));assert.notEqual(s.pendingChoice?.effect,'hSD11FlowGlowArchiveSp');assert.ok(!s.effectQueue?.some(e=>e.effect==='hSD11FlowGlowArchiveSp'));});
