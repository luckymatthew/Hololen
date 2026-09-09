import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const act=(s,a)=>applyAction(structuredClone(s),0,a,pool,()=>0);
const first=cards.find(c=>c.number==='hBP02-032');
const debut=cards.find(c=>c.jpName===first.jpName&&c.stage==='Debut');
for(const skip of [false,true])test('Custom computer paid search skip '+skip,()=>{
 const s=state();s.phase='main';s.players[0].hand=[inst('hBP02-076','computer'),inst(debut.number,'paid'),inst('hBP01-119','wrong')];
 s.players[0].mainDeck=[inst(first.number,'yes'),inst('hBP02-017','buzz'),inst('hBP02-011','otherName')];
 let e=act(s,{type:'play',cardId:'computer'});assert.throws(()=>act(e,{type:'choose',skip:true}));
 assert.deepEqual(e.pendingChoice.selectableIds,['paid']);e=act(e,{type:'choose',cardIds:['paid']});
 assert.deepEqual(e.pendingChoice.selectableIds,['yes']);assert.equal(e.players[0].mainDeck.at(-1).id,'paid');
 e=act(e,skip?{type:'choose',skip:true}:{type:'choose',cardIds:['yes']});
 assert.equal(e.players[0].hand.some(c=>c.id==='yes'),!skip);assert.equal(e.players[0].hand.some(c=>c.id==='paid'),false);
 assert.equal(e.players[0].mainDeck.some(c=>c.id==='paid'),true);
 assert.ok(e.log.some(l=>l.message?.includes('客製化電腦：公開')));
});
