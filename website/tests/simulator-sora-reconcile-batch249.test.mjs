import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const present of [true,false])test('Starter Sora local text AZKi gate '+present,()=>{
 const card=cards.find(c=>c.number==='hSD01-006');assert.ok(!/骰/.test(card.arts[1].effect));let s=state(card.number);fund(s.players[0].zones.center,card.arts[1].cost);if(present)s.players[0].zones.back1=unit(cards.find(c=>c.jpName==='AZKi'&&c.stage==='Debut').number);s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,present?110:60);
});
