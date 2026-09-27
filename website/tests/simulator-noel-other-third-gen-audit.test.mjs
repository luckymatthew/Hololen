import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const noel=cards.find(c=>c.number==='hBP02-017');
const member=cards.find(c=>c.group==='holomem'&&c.tags.includes('#3期生')&&c.number!==noel.number).number;
for(const count of [0,1,4,5])test('Noel Collab Arts counts '+count+' other third-generation members, up to four',()=>{
 const s=state();s.players[0].zones.collab=unit(noel.number);fund(s.players[0].zones.collab,noel.arts[1].cost);
 for(let i=1;i<=count;i++)s.players[0].zones['back'+i]=unit(member);
 const e=applyAction(s,0,{...attack,sourceZone:'collab',artIndex:1},pool,()=>.5);
 assert.equal(e.players[1].zones.center.damage,60+Math.min(4,count)*20);
});

test('Noel Collab-only Arts cannot be used from Center',()=>{
 const s=state();s.players[0].zones.center=unit(noel.number);fund(s.players[0].zones.center,noel.arts[1].cost);
 assert.throws(()=>applyAction(s,0,{...attack,artIndex:1},pool,()=>.5),/cannot|不能.*目前位置|位置限定/u);
});
