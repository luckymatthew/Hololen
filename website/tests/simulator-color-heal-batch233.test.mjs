import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const available of [true,false])test('0831 archive then distinct cheer color heal '+available,()=>{
 let s=state('hBP08-031');fund(s.players[0].zones.center,['綠','白']);s.players[0].zones.back1=unit('AUDIT-DUMMY',{damage:100});fund(s.players[0].zones.back1,['白','紅']);s.players[0].cheerDeck=available?[inst('hY05-001','top')]:[];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.equal(s.players[0].archive.some(c=>c.id==='top'),available);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[0].zones.back1.damage,70);
});
test('0831 Buzz loses two life',()=>{
 let s=state('AUDIT-DUMMY','hBP08-031');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP08-031').hp-50;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
