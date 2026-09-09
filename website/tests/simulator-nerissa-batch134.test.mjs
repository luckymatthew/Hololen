import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const match of [true,false])test('Nerissa Oshi draw '+match,()=>{
 let s=state('hBP05-059');fund(s.players[0].zones.center,['紫']);if(match)s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName==='ネリッサ・レイヴンクロフト').number);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[0].hand.length,match?1:0);
});
for(const pay of [true,false])test('Nerissa paid damage '+pay,()=>{
 let s=state('hBP05-060');fund(s.players[0].zones.center,['紫','無色']);s.players[0].hand=[inst('AUDIT-DUMMY','cost')];s=applyAction(s,0,attack,pool,()=>0);
 s=applyAction(s,0,pay?{type:'choose',cardIds:['cost']}:{type:'choose',skip:true},pool,()=>0);
 if(pay){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,pay?60:40);assert.equal(s.pendingChoice,null);
});
test('Nerissa required support search',()=>{
 const prior=cards.find(c=>c.jpName==='ネリッサ・レイヴンクロフト'&&c.stage==='Debut');const fan=cards.find(c=>c.jpName==='Jailbird'||c.name==='Jailbird');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hBP05-060','bloom')];s.players[0].mainDeck=[inst(fan.number,'fan'),inst('AUDIT-DUMMY','invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['fan']);s=applyAction(s,0,{type:'choose',cardIds:['fan']},pool,()=>0);assert.equal(s.players[0].hand[0].id,'fan');
});
