import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const count of [0,1,2])test('061 other second-stage ID2 count '+count,()=>{
 const s=state('hBP04-061');fund(s.players[0].zones.center,['紫','無色']);const eligible=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&c.tags.includes('#ID2期生'));const lower=cards.find(c=>c.group==='holomem'&&c.stage==='1st'&&c.tags.includes('#ID2期生'));
 for(let i=1;i<=count;i++)s.players[0].zones['back'+i]=unit(eligible.number);s.players[0].zones.back3=unit(lower.number);s.players[0].zones.back4=unit('AUDIT-DUMMY');
 assert.equal(applyAction(s,0,attack,pool,()=>0).players[1].zones.center.damage,80+count*20);
});
