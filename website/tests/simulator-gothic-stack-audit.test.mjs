import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,attack,fund} from './fixtures/simulator-audit.mjs';
const card=cards.find(c=>c.number==='hBP02-033'),base=cards.find(c=>c.jpName===card.jpName&&c.stage==='1st');
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
for(const count of [0,1,2,3])test('Gothic Arts lower Holomen '+count,()=>{
 const s=state(card.number);fund(s.players[0].zones.center,card.arts[0].cost);
 s.players[0].zones.center.stack.unshift(...Array.from({length:count},(_,i)=>inst(base.number,'under'+i)));
 const end=act(s,attack);assert.equal(end.players[1].zones.center.damage,80+20*count);
});
for(const count of [1,2,3])for(const recover of [false,true])test('Gothic Bloom lower cards '+count+' recover '+recover,()=>{
 let s=state(base.number);s.phase='main';s.players[0].zones.center.stack=Array.from({length:count},(_,i)=>inst(base.number,'under'+i));
 s.players[0].hand=[inst(card.number,'bloom')];s.players[0].archive=[inst(base.number,'recover')];
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 s=act(s,recover?{type:'choose',cardIds:['recover']}:{type:'choose',skip:true});
 if(count>=3){assert.equal(s.pendingChoice?.effect,'specialDamage');assert.throws(()=>act(s,{type:'choose',skip:true}));s=act(JSON.parse(JSON.stringify(s)),{type:'choose',zone:'center'});}
 assert.equal(s.players[1].zones.center.damage,count>=3?50:0);assert.equal(s.pendingChoice,null);assert.equal(s.players[0].hand.length,recover?1:0);
});
