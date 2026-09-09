import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
test('0711 required Watame first search',()=>{
 const prior=cards.find(c=>c.jpName==='角巻わため'&&c.stage==='Debut'),target=cards.find(c=>c.jpName==='角巻わため'&&c.stage==='1st');
 let s=state(prior.number);s.phase='main';s.players[0].hand=[inst('hBP07-011','bloom')];s.players[0].mainDeck=[inst(target.number,'valid'),inst(prior.number,'invalid')];
 s=applyAction(s,0,{type:'play',cardId:'bloom'},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
});
test('0715 required ID3 Buzz search',()=>{
 const target=cards.find(c=>c.tags.includes('#ID3期生')&&c.type.toUpperCase().includes('BUZZ')),invalid=cards.find(c=>c.group==='holomem'&&c.tags.includes('#ID3期生')&&!c.type.toUpperCase().includes('BUZZ'));
 let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit('hBP07-015');s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(target.number,'valid'),inst(invalid.number,'invalid')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.cards.map(c=>c.id),['valid']);
});
