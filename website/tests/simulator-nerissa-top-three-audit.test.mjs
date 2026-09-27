import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';

const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
const lower=cards.find(c=>c.jpName==='ネリッサ・レイヴンクロフト'&&c.stage==='Debut');

test('Nerissa top-three selection is required and remaining cards go to the bottom in chosen order',()=>{
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-067','bloom')];
 s.players[0].mainDeck=[inst('hBP02-067','song'),inst('hBP01-119','support'),inst('AUDIT-DUMMY','other'),inst('AUDIT-DUMMY','tail')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.deepEqual(e.pendingChoice.selectableIds,['song']);
 assert.equal(e.pendingChoice.optional,false);
 assert.equal(e.pendingChoice.min,1);
 assert.throws(()=>act(e,{type:'choose',cardIds:['other']}));
 assert.throws(()=>act(e,{type:'choose',skip:true}));
 e=act(e,{type:'choose',cardIds:['song']});
 assert.equal(e.pendingChoice.effect,'bottomOrder');
 e=act(e,{type:'choose',cardIds:['other','support']});
 assert.deepEqual(e.players[0].mainDeck.map(c=>c.id),['tail','other','support']);
 assert.equal(e.players[0].hand.some(c=>c.id==='song'),true);
 assert.equal(e.players[0].archive.length,0);
});

test('Nerissa bottoms all three viewed cards when no song Holomen is present',()=>{
 const s=state(lower.number);s.phase='main';s.players[0].hand=[inst('hBP02-067','bloom')];
 s.players[0].mainDeck=[inst('hBP01-119','support'),inst('AUDIT-DUMMY','other'),inst('AUDIT-DUMMY','tail'),inst('AUDIT-DUMMY','last')];
 let e=act(act(s,{type:'play',cardId:'bloom'}),{type:'choose',zone:'center'});
 assert.equal(e.pendingChoice.effect,'bottomOrder');
 assert.deepEqual(e.pendingChoice.selectableIds,['support','other','tail']);
 e=act(e,{type:'choose',cardIds:['tail','support','other']});
 assert.deepEqual(e.players[0].mainDeck.map(c=>c.id),['last','tail','support','other']);
 assert.equal(e.pendingChoice,null);
});
