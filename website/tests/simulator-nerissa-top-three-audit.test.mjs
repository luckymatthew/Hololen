import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
for(const skip of [false,true])test('Nerissa top-three selection and bottom ordering skip '+skip,()=>{
 const lower=cards.find(c=>c.jpName==='ネリッサ・レイヴンクロフト'&&c.stage==='Debut');
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-067','bloom')];
 s.players[0].mainDeck=[inst('hBP02-067','song'),inst('hBP01-119','support'),inst('AUDIT-DUMMY','other'),inst('AUDIT-DUMMY','tail')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['song']);assert.throws(()=>act(e,{type:'choose',cardIds:['other']}));
 e=act(e,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['song']});
 assert.equal(e.pendingChoice.effect,'bottomOrder');
 const order=skip?['other','song','support']:['other','support'];
 e=act(e,{type:'choose',cardIds:order});
 assert.deepEqual(e.players[0].mainDeck.map(c=>c.id),['tail',...order]);
 assert.equal(e.players[0].hand.length,skip?0:1);assert.equal(e.players[0].archive.length,0);
});
