import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const use of [true,false])test('0866 optional support to top '+use,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP08-066');const c=cards.find(c=>c.group==='support');
 s.players[0].archive=[inst(c.number,'pick'),inst('AUDIT-DUMMY','member')];
 s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst('AUDIT-DUMMY','next')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,true);
 s=applyAction(s,0,use?{type:'choose',cardIds:['pick']}:{type:'choose',skip:true},pool,()=>0);
 assert.equal(s.players[0].mainDeck[0].id,use?'pick':'next');assert.equal(s.players[0].archive.length,use?1:2);assert.equal(s.players[0].hand.length,0);
});
