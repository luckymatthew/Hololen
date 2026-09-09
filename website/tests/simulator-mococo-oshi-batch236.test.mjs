import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund} from './fixtures/simulator-audit.mjs';
for(const color of [null,'紅','藍'])test('Mococo conditional required effect '+color,()=>{
 const advent=cards.find(c=>c.group==='holomem'&&c.tags.includes('#Advent'));let s=state(advent.number);s.phase='main';s.players[0].oshi=inst('hBP08-003');s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];s.players[0].archive=[inst(advent.number,'recover'),inst('hY01-001','cheer')];if(color)fund(s.players[0].zones.center,[color]);
 s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.equal(s.players[0].holoPower.length,0);
 if(color){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:[color==='紅'?'recover':'cheer']},pool,()=>0);if(color==='藍')s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(color==='紅'?s.players[0].hand[0].id:s.players[0].zones.center.cheer.at(-1).id,color==='紅'?'recover':'cheer');}else assert.equal(s.pendingChoice,null);
});
