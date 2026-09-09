import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
for(const life of [3,4])test('Subaru Arts cheer repeats at life '+life,()=>{
 let s=state('hBP06-081');s.players[0].life=s.players[0].life.slice(0,life);fund(s.players[0].zones.center,['黃','無色']);s.players[0].cheerDeck=[inst('hY01-001','c1'),inst('hY02-001','c2')];
 s=applyAction(s,0,attack,pool,()=>0);
 if(life===4){assert.equal(s.pendingChoice,null);return;}
 for(let i=0;i<2;i++){assert.equal(s.pendingChoice.type,'eventCheerTarget');s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[0].zones.center.cheer.length,4);assert.equal(s.pendingChoice,null);
});

test('Subaru paid Bloom search mandatory',()=>{
 const target=cards.find(c=>c.number==='hBP06-081');const prior=cards.find(c=>c.jpName===target.jpName&&c.stage===(target.stage==='2nd'?'1st':'Debut'));
 let s=state(prior.number);s.phase='main';s.players[0].oshi=inst(cards.find(c=>c.group==='oshi'&&c.jpName===target.jpName).number);fund(s.players[0].zones.center,['黃']);s.players[0].hand=[inst(target.number,'bloom')];s.players[0].mainDeck=[inst(prior.number,'search')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);
 s=applyAction(s,0,{type:'choose',zone:'center',cheerId:'cheer0'},pool,()=>0);
 assert.equal(s.pendingChoice.min,1);assert.equal(s.pendingChoice.optional,false);
 s=applyAction(s,0,{type:'choose',cardIds:['search']},pool,()=>0);assert.ok(s.players[0].hand.some(c=>c.id==='search'));
});
