import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
const noel=cards.find(c=>c.number==='hBP02-017');
const member=cards.find(c=>c.group==='holomem'&&c.tags.includes('#3期生')&&c.number!==noel.number).number;
for(const zone of ['center','collab'])for(const count of [0,1,4,5])test('Noel '+zone+' counts '+count+' other third-generation members',()=>{
 const s=state();s.players[0].zones[zone]=unit(noel.number);fund(s.players[0].zones[zone],noel.arts[1].cost);
 for(let i=1;i<=count;i++)s.players[0].zones['back'+i]=unit(member);
 const e=applyAction(s,0,{...attack,sourceZone:zone,artIndex:1},pool,()=>.5);
 assert.equal(e.players[1].zones.center.damage,60+(zone==='collab'?Math.min(4,count)*20:0));
});
