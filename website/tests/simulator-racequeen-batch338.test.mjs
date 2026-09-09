import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [1,5])test('Race Queen Promise count capped '+count,()=>{
 let s=state('hBP04-015');fund(s.players[0].zones.center,['白','無色']);for(let i=1;i<count;i++)s.players[0].zones['back'+i]=unit('hBP04-015',{stack:[inst('hBP04-015','b'+i)]});
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,30+Math.min(4,count)*10);
});
test('Race Queen Buzz knockout loses two life',()=>{
 const c=cards.find(c=>c.number==='hBP04-015');let s=state('AUDIT-DUMMY',c.number);s.players[1].zones.center.damage=c.hp-10;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
