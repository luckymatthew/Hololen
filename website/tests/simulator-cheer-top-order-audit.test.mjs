import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const card=cards.find(c=>c.number==='hBP02-038'),base=cards.find(c=>c.jpName===card.jpName&&c.stage==='Debut');
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>.5);
for(const count of [0,1,2,3,5])test('Cheer top3 has '+count+' cards',()=>{
 let s=state(base.number);s.phase='main';s.players[0].zones.back1=unit('AUDIT-DUMMY');
 s.players[0].hand=[inst(card.number,'bloom')];s.players[0].cheerDeck=Array.from({length:count},(_,i)=>inst('hY01-001','cheer'+i));
 s=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 if(!count){assert.equal(s.pendingChoice,null);return;}
 assert.equal(s.pendingChoice?.effect,'genericCheerTopPick');assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',cardIds:['cheer0']});
 assert.equal(s.pendingChoice?.type,'eventCheerTarget');assert.throws(()=>act(s,{type:'choose',skip:true}));
 s=act(s,{type:'choose',zone:'back1'});assert.equal(s.players[0].zones.back1.cheer[0].id,'cheer0');
 const remaining=Array.from({length:Math.min(count,3)-1},(_,i)=>'cheer'+(i+1)).reverse();
 if(remaining.length){assert.equal(s.pendingChoice?.effect,'cheerBottomOrder');s=act(JSON.parse(JSON.stringify(s)),{type:'choose',cardIds:remaining});}
 assert.equal(s.pendingChoice,null);assert.deepEqual(s.players[0].cheerDeck.map(c=>c.id),[...Array.from({length:Math.max(0,count-3)},(_,i)=>'cheer'+(i+3)),...remaining]);
});
