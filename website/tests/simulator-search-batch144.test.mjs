import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP06-011','hBP06-013'])test(n+' required search',()=>{
 const card=cards.find(c=>c.number===n),bloom=n==='hBP06-013';
 const prior=cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut');
 const target=cards.find(c=>bloom?(c.jpName==='Chattino'||c.name==='Chattino'):(c.stage==='Debut'&&c.tags.includes('#Justice')));
 let s=state(bloom?prior.number:'AUDIT-DUMMY');s.phase='main';s.players[0].mainDeck=[inst(target.number,'valid'),inst('AUDIT-DUMMY','invalid')];
 if(bloom){s.players[0].hand=[inst(n,'bloom')];s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 else{s.players[0].zones.back1=unit(n);s.players[0].mainDeck.unshift(inst('AUDIT-DUMMY','power'));s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);}
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);s=applyAction(s,0,{type:'choose',cardIds:['valid']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'valid');assert.equal(s.pendingChoice,null);
});
for(const loseLife of [true,false])test('013 Buzz life '+loseLife,()=>{
 const s=state();s.players[1].zones.back1=unit('hBP06-013',{damage:10000});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',amount:10,loseLife,sourceName:'test'}];
 const r=applyAction(s,0,attack,pool,()=>.5);assert.equal(r.players[1].life.length,loseLife?3:5);
});
