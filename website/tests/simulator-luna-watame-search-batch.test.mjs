import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
function start(n){
 const s=state();s.phase='main';s.players[0].oshi=inst(n);s.players[0].holoPower=[inst('AUDIT-DUMMY','p1'),inst('AUDIT-DUMMY','p2')];
 s.players[0].mainDeck=[inst('hBP02-076','computer'),inst('hBP03-107','fan'),inst('hBP01-119','mascot'),inst('AUDIT-DUMMY','member')];
 return act(s,{type:'oshiSkill'});
}
for(const n of ['hBP03-001','hBP03-007'])test(n+' exact search type and cost',()=>{
 let e=start(n);const id=n==='hBP03-001'?'computer':'fan';assert.deepEqual(e.pendingChoice.selectableIds,[id]);
 assert.throws(()=>act(e,{type:'choose',cardIds:['mascot']}));
 e=act(e,{type:'choose',cardIds:[id]});assert.equal(e.players[0].hand[0].id,id);assert.equal(e.players[0].holoPower.length,0);assert.equal(e.players[0].mainDeck.length,3);
});
for(const n of ['hBP03-001','hBP03-007'])test(n+' hidden search decline still shuffles and pays',()=>{
 const s=start(n),before=s.players[0].mainDeck.map(c=>c.id),e=act(s,{type:'choose',skip:true});
 assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].holoPower.length,0);assert.notDeepEqual(e.players[0].mainDeck.map(c=>c.id),before);
});
