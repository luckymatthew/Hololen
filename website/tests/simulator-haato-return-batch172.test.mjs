import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('0740 required search after stage return',()=>{
 const debut=cards.find(c=>c.jpName==='赤井はあと'&&c.stage==='Debut'),target=cards.find(c=>c.stage==='1st'&&!c.type.toUpperCase().includes('BUZZ')),buzz=cards.find(c=>c.type.toUpperCase().includes('BUZZ'));
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP07-040');s.players[0].zones.back2=unit(debut.number,{stack:[inst(debut.number,'returned')]});s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'valid'),inst(buzz.number,'invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'back2'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
 s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');assert.equal(s.players[0].zones.back2,null);assert.ok(s.players[0].mainDeck.some(c=>c.id==='returned'));
});
