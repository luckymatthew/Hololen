import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP07-053','hBP07-054'])for(const available of [true,false])test(n+' required Promise cheer '+available,()=>{
 let s=state(n);fund(s.players[0].zones.center,cards.find(c=>c.number===n).arts[0].cost);
 s.players[0].zones.back1=unit('hBP07-052');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 s.players[0].cheerDeck=available?[inst('hY01-001','top')]:[];
 s=applyAction(s,0,attack,pool,()=>0);
 if(available){
 assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,n==='hBP07-054'?['center']:['center','back1']);
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer.at(-1).id,'top');assert.equal(s.players[0].cheerDeck.length,0);
 }else assert.equal(s.pendingChoice,null);
});
test('0754 Buzz DOWN loses two life',()=>{
 let s=state('AUDIT-DUMMY','hBP07-054');s.players[1].zones.center.damage=cards.find(c=>c.number==='hBP07-054').hp-50;
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].life.length,3);
});
