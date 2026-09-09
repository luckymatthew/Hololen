import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const color of ['hY01-001','hY02-001',null])test('Justice coffee pair color '+color,()=>{
 const justice=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#Justice'));let s=state('hSD13-015');s.players[0].zones.collab=unit(justice.number);fund(s.players[0].zones.center,['白']);if(color)s.players[0].zones.collab.cheer=[inst(color,'other')];
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,color==='hY02-001'?50:30);
});
