import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state} from './fixtures/simulator-audit.mjs';
for(const other of [true,false])test('032 other Justice '+other,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP06-032');s.players[0].cheerDeck=[inst('hY01-001','top')];
 if(other)s.players[0].zones.center=unit(cards.find(c=>c.group==='holomem'&&c.tags.includes('#Justice')).number);
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(other){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['center']);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.cheer[0].id,'top');}
 assert.equal(s.players[0].zones.collab.cheer.length,0);assert.equal(s.players[0].cheerDeck.length,other?0:1);assert.equal(s.pendingChoice,null);
});
