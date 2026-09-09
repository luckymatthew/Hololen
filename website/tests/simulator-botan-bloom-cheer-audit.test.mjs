import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,unit,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const available of [false,true])test('Botan Bloom back recipient '+available,()=>{
 const lower=cards.find(c=>c.jpName==='獅白ぼたん'&&c.stage==='Debut'),s=state(lower.number);s.phase='main';
 s.players[0].hand=[inst('hBP03-020','bloom')];s.players[0].zones.back1=unit(available?lower.number:'AUDIT-DUMMY');
 s.players[0].cheerDeck=[inst('hY01-001','top')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 if(available){assert.equal(e.pendingChoice.optional,false);assert.deepEqual(e.pendingChoice.options,['back1']);
 assert.throws(()=>act(e,{type:'choose',skip:true}));assert.throws(()=>act(e,{type:'choose',zone:'center'}));
 e=act(e,{type:'choose',zone:'back1'});assert.equal(e.players[0].zones.back1.cheer[0].id,'top');}
 else assert.equal(e.pendingChoice,null);
 assert.equal(e.players[0].cheerDeck.length,available?0:1);
});
