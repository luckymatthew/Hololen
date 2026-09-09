import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state} from './fixtures/simulator-audit.mjs';
for(const count of [1,2,3])test('0854 cap by recipients '+count,()=>{
 const c=cards.find(c=>c.number==='hBP08-054'),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='1st');
 let s=state(prior.number);s.phase='main';s.players[0].oshi=inst('hBP03-004');s.players[0].hand=[inst(c.number,'bloom')];
 for(let i=1;i<count;i++)s.players[0].zones['back'+i]=unit(prior.number);
 s.players[0].archive=Array.from({length:3},(_,i)=>inst('hY04-001','c'+i));
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.max,count);s=applyAction(s,0,{type:'choose',cardIds:Array.from({length:count},(_,i)=>'c'+i)},pool,()=>0);
 for(let i=0;i<count;i++)s=applyAction(s,0,{type:'choose',zone:i?'back'+i:'center'},pool,()=>0);
 assert.equal(s.pendingChoice,null);assert.equal(s.players[0].archive.length,3-count);
});
