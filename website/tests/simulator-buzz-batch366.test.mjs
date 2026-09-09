import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,attack} from './fixtures/simulator-audit.mjs';
test('hBP07-031 printed Buzz DOWN loses two life',()=>{
 let s=state('AUDIT-DUMMY','hBP07-031');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP07-031').hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);assert.equal(s.players[1].zones.center,null);assert.ok(s.players[1].archive.some(c=>c.number==='hBP07-031'));
});
