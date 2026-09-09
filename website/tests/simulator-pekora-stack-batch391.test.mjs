import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [choices,damage,draw] of [[['decline','decline'],120,0],[['roll','decline'],130,1],[['roll','roll'],140,2]]) test('Pekora stack dice '+choices,()=>{
 let s=state('hBP05-016');s.players[0].zones.center.stack.unshift(inst('hBP05-014','under1'),inst('hBP05-014','under2'));fund(s.players[0].zones.center,['無色','無色','無色','無色']);let rolled=0;const random=()=>{rolled++;return 0;};s=applyAction(s,0,attack,pool,random);assert.equal(s.pendingChoice.effect,'pekoraStackRoll');assert.equal(rolled,0);for(const optionId of choices)s=applyAction(s,0,{type:'choose',optionId},pool,random);assert.equal(s.players[1].zones.center.damage,damage);assert.equal(s.players[0].hand.length,draw);assert.equal(rolled,choices.filter(c=>c==='roll').length);
});
