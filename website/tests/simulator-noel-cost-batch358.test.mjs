import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const special of [true,false])test('Noel colorless reduction '+special,()=>{
 const receiver={number:'RECEIVER',name:'Receiver',jpName:special?'白銀ノエル':'Other third gen',stage:'2nd',group:'holomem',hp:10000,colors:['白'],tags:['#3期生'],arts:[{name:'Cost probe',damage:10,cost:['白','無色','無色'],effect:''}]};const p=[...pool,receiver];let s=state('hBP07-022');fund(s.players[0].zones.center,['白']);s.players[0].zones.collab=unit('RECEIVER');fund(s.players[0].zones.collab,['白']);
 s=applyAction(s,0,attack,p,()=>0);assert.equal(s.pendingChoice.effect,'noelMuscleCost');assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},p,()=>0));s=applyAction(s,0,{type:'choose',zone:'collab'},p,()=>0);
 if(!special){assert.throws(()=>applyAction(s,0,{...attack,sourceZone:'collab'},p,()=>0));fund(s.players[0].zones.collab,['白','無色']);}
 s=applyAction(s,0,{...attack,sourceZone:'collab'},p,()=>0);assert.equal(s.players[1].zones.center.damage,60);
});
