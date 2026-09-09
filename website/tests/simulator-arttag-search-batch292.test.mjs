import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
test('Required art-tag top-three collab search',()=>{const target=cards.find(c=>c.group==='holomem'&&c.tags?.includes('#絵'));let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP04-019');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'yes'),inst('AUDIT-DUMMY','wrong'),inst('AUDIT-DUMMY','wrong2'),inst(target.number,'outside')];s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);assert.ok(!s.pendingChoice.cards.some(c=>c.id==='outside'));s=applyAction(s,0,{type:'choose',cardIds:['yes']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='yes'));});
