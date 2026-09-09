import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,cards,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
test('FLOW GLOW batch counts only actual Cheer in mixed archived cards',()=>{let s=state('hBP06-020');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP06-020').arts[0].cost);s.players[0].oshi=inst('hSD11-001');s.players[0].holoPower=Array.from({length:10},(_,i)=>inst('AUDIT-DUMMY','p'+i));s.players[0].mainDeck=[inst('AUDIT-DUMMY','ordinary'),inst('hY01-001','cheer'),...s.players[0].mainDeck];s=applyAction(s,0,attack,pool,()=>0);s=applyAction(s,0,{type:'choose',optionId:'2'},pool,()=>0);assert.equal(s.pendingChoice.effect,'hSD11FlowGlowArchiveSp');assert.equal(s.pendingChoice.meta.amount,30);});
