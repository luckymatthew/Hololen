import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const eligible of [true,false])test('073 limited search Oshi '+eligible,()=>{
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP06-073');
 if(eligible)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='夏色まつり').number);
 const limited=cards.find(c=>c.group==='support'&&c.type.toUpperCase().includes('LIMITED')),normal=cards.find(c=>c.group==='support'&&!c.type.toUpperCase().includes('LIMITED'));
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(limited.number,'valid'),inst(normal.number,'invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(eligible){assert.equal(s.pendingChoice.optional,true);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);}
 assert.equal(s.players[0].hand.length,eligible?1:0);assert.equal(s.pendingChoice,null);
});
