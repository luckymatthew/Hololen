import test from 'node:test';
import assert from 'node:assert/strict';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const {applyAction}=await import(process.env.HOLO_ENGINE_TEST_TARGET||'../lib/simulator/engine.mjs');
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
test('Miko Bloom must add a matching 35P when one is available',()=>{
 const lower=cards.find(c=>c.jpName==='さくらみこ'&&c.stage==='Debut'),s=state(lower.number);s.phase='main';
 s.players[0].hand=[inst('hBP03-029','bloom')];s.players[0].mainDeck=[inst('hBP03-107','fan'),inst('hBP01-122','wrongFan'),inst('AUDIT-DUMMY','tail')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['fan']);assert.throws(()=>act(e,{type:'choose',cardIds:['wrongFan']}));
 assert.equal(e.pendingChoice.optional,false);assert.equal(e.pendingChoice.nonEmptyMin,1);
 assert.match(e.pendingChoice.prompt,/^にぇ：公開 /);
 assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',cardIds:['fan']});
 assert.equal(e.players[0].hand.length,1);assert.equal(e.players[0].hand[0].id,'fan');assert.equal(e.players[0].mainDeck.length,2);
});
test('Miko Bloom with no matching 35P still completes and shuffles',()=>{
 const lower=cards.find(c=>c.jpName==='さくらみこ'&&c.stage==='Debut'),s=state(lower.number);s.phase='main';
 s.players[0].hand=[inst('hBP03-029','bloom')];s.players[0].mainDeck=[inst('hBP01-122','wrongFan'),inst('AUDIT-DUMMY','tail')];
 const e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.equal(e.pendingChoice,null);assert.equal(e.players[0].hand.length,0);assert.equal(e.players[0].mainDeck.length,2);
});
