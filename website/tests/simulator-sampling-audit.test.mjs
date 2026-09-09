import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const en=cards.find(c=>c.group==='holomem'&&c.tags.includes('#EN')).number;
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
function start(count=2){
 const s=state();s.phase='main';s.players[0].oshi=inst('hBP02-007');
 s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].hand=[inst(count>0?en:'AUDIT-DUMMY','a'),inst(count>1?en:'AUDIT-DUMMY','b')];
 return act(s,{type:'oshiSkill'});
}
test('Sampling can recover the two newly paid EN Holomen',()=>{
 let e=start();assert.throws(()=>act(e,{type:'choose',cardIds:['a']}));
 e=act(e,{type:'choose',cardIds:['a','b']});assert.equal(e.pendingChoice.optional,true);
 assert.throws(()=>act(e,{type:'choose',cardIds:['a']}));
 e=act(e,{type:'choose',cardIds:['a','b']});
 assert.deepEqual(e.players[0].hand.map(c=>c.id),['a','b']);assert.equal(e.players[0].holoPower.length,0);
 assert.equal(e.players[0].archive.filter(c=>['a','b'].includes(c.id)).length,0);
});
test('Sampling recovery decline retains hand and Power payments',()=>{
 let e=act(start(),{type:'choose',cardIds:['a','b']});
 e=act(e,{type:'choose',skip:true});assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].holoPower.length,0);
 assert.equal(e.players[0].archive.filter(c=>['a','b'].includes(c.id)).length,2);
});
for(const n of [0,1])test('Sampling completes when fewer than two EN are available: '+n,()=>{
 const e=act(start(n),{type:'choose',cardIds:['a','b']});
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);
 assert.equal(e.players[0].archive.filter(c=>['a','b'].includes(c.id)).length,2);
});
