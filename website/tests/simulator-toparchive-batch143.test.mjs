import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP06-018','hBP06-019'])for(const available of [true,false])test(n+' top archive '+available,()=>{
 let s=state(n);fund(s.players[0].zones.center,['白']);s.players[0].mainDeck=available?[inst('AUDIT-DUMMY','top'),inst('AUDIT-DUMMY','next')]:[];
 s=applyAction(s,0,attack,pool,()=>0);
 assert.deepEqual(s.players[0].archive.map(c=>c.id),available?['top']:[]);assert.deepEqual(s.players[0].mainDeck.map(c=>c.id),available?['next']:[]);
 if(available)assert.equal(s.players[0].turnEvents.deckArchived,1);assert.equal(s.players[1].zones.center.damage,n==='hBP06-018'?30:40);
});
