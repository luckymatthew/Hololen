import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,attack,dummy} from './fixtures/simulator-audit.mjs';
const moona=cards.find(c=>c.number==='hBP06-052');
const custom=[...pool.filter(c=>c.number!==moona.number),{...moona,arts:[{...dummy.arts[0],damage:40}]}];
for(const skip of [true,false])test('Moona New Moon optional '+skip,()=>{
 let s=state(moona.number);s.players[1].zones.center.damage=20;s=applyAction(s,0,attack,custom,()=>0);
 assert.equal(s.pendingChoice.effect,'moonaNewMoon');s=applyAction(s,0,skip?{type:'choose',skip:true}:{type:'choose',optionId:'use'},custom,()=>0);
 assert.equal(s.players[1].zones.center.damage,skip?60:120);
});
test('Moona Buzz knockout already loses two life',()=>{
 let s=state('AUDIT-DUMMY',moona.number);s.players[1].zones.center.damage=moona.hp-10;s.players[1].zones.back1=unit(dummy.number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
