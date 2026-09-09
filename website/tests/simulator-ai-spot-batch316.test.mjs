import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const spot=cards.find(c=>c.number==='hBP06-084');
const first={...spot,number:'AUDIT-AI-FIRST',stage:'1st',extra:'',hp:150};
const custom=[...pool,first];
test('AI Koyori Spot cannot be normal Bloom base',()=>{
 const s=state(spot.number);s.phase='main';s.players[0].hand=[inst(first.number,'first')];
 assert.throws(()=>applyAction(s,0,{type:'play',cardId:'first'},custom,()=>0));
});
test('Blooming Stage cannot Bloom AI Koyori Spot',()=>{
 let s=state(spot.number);s.phase='main';s.players[0].life=s.players[0].life.slice(0,4);
 s.players[0].hand=[inst('hBP06-090','event'),inst(first.number,'first'),inst(spot.number,'spot')];
 s=applyAction(s,0,{type:'play',cardId:'event'},custom,()=>0);
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].zones.center.stack.length,1);
 assert.ok(s.players[0].hand.some(c=>c.id==='first'));assert.ok(s.players[0].hand.some(c=>c.id==='spot'));
});
