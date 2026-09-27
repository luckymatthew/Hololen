import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';

const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
const lower=cards.find(c=>c.jpName==='森カリオペ'&&c.stage==='Debut');

function bloomWithNamedSupport() {
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-058','calliope-bloom')];
 s.players[0].archive=[inst('hBP02-088','scythe'),inst('hBP02-098','death-sensei')];
 return act(act(s,{type:'play',cardId:'calliope-bloom'}),{type:'choose',zone:'center'});
}

test('Calliope Bloom can return either named Tool or Mascot from Archive',()=>{
 const stateWithChoice=bloomWithNamedSupport();
 assert.equal(stateWithChoice.pendingChoice?.effect,'archiveToHand');
 assert.equal(stateWithChoice.pendingChoice?.optional,true);
 assert.deepEqual(new Set(stateWithChoice.pendingChoice?.selectableIds),new Set(['scythe','death-sensei']));
 for (const id of ['scythe','death-sensei']) {
  const resolved=act(stateWithChoice,{type:'choose',cardIds:[id]});
  assert.ok(resolved.players[0].hand.some(card=>card.id===id));
  assert.equal(resolved.players[0].archive.some(card=>card.id===id),false);
 }
});

test('Calliope Bloom recovery remains optional and ignores unrelated Archive cards',()=>{
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-058','calliope-bloom')];
 s.players[0].archive=[inst('hBP02-054','unrelated-holomem')];
 const e=act(act(s,{type:'play',cardId:'calliope-bloom'}),{type:'choose',zone:'center'});
 assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].hand.some(card=>card.id==='unrelated-holomem'),false);
});
