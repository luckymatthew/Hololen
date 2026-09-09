import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const [n,names] of [['hBP06-076',['えびふらいおん','まつりす']],['hBP06-080',['スバルドダック','スバ友']]])for(const name of names)test(n+' search '+name,()=>{
 const c=cards.find(c=>c.number===n),prior=cards.find(x=>x.jpName===c.jpName&&x.stage==='Debut'),target=cards.find(c=>c.jpName===name||c.name===name);assert.ok(target);
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst(n,'bloom')];s.players[0].mainDeck=[inst(target.number,'valid'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
 s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');
});
for(const loseLife of [true,false])test('076 Buzz life '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP06-076',{damage:10000});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>.5);assert.equal(r.players[1].life.length,loseLife?3:5);
});
