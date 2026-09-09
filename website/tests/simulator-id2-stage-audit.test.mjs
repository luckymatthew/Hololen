import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const tagged=stage=>cards.find(c=>c.group==='holomem'&&c.stage===stage&&c.tags.includes('#ID2期生'));
for(const stage of ['Debut','1st','2nd'])test('ID2 bonus counts top stage '+stage,()=>{
 const s=state('hBP02-053');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-053').arts[0].cost);
 s.players[0].zones.back1=unit(tagged(stage).number,{stack:[inst(tagged(stage).number,'other')]});
 const end=applyAction(s,0,attack,pool,()=>.5);assert.equal(end.players[1].zones.center.damage,stage==='2nd'?140:100);
});
test('ID2 2nd under another top does not count as another Holomen',()=>{
 const s=state('hBP02-053');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-053').arts[0].cost);
 s.players[0].zones.center.stack.unshift(inst('hBP02-053','under'));
 const end=applyAction(s,0,attack,pool,()=>.5);assert.equal(end.players[1].zones.center.damage,100);
});
test('unrelated 2nd does not count toward ID2',()=>{
 const s=state('hBP02-053');fund(s.players[0].zones.center,cards.find(c=>c.number==='hBP02-053').arts[0].cost);
 const other=cards.find(c=>c.group==='holomem'&&c.stage==='2nd'&&!c.tags.includes('#ID2期生'));
 s.players[0].zones.back1=unit(other.number);
 const end=applyAction(s,0,attack,pool,()=>.5);assert.equal(end.players[1].zones.center.damage,100);
});
