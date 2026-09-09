import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit} from './fixtures/simulator-audit.mjs';
test('starter Marine targets center and counts distinct generation names',()=>{
 const marine=cards.find(c=>c.number==='hSD09-003');const other=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#3期生')&&c.jpName!==marine.jpName);
 let s=state(marine.number);s.phase='main';s.players[0].zones.back1=unit(marine.number);s.players[0].zones.back2=unit(other.number);s.players[1].zones.collab=unit('AUDIT-DUMMY');
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,20);assert.equal(s.players[1].zones.collab.damage,0);
});
