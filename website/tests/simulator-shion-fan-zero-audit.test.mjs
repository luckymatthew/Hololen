import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,attack} from './fixtures/simulator-audit.mjs';
for(const type of ['dealArtsDamage','specialDamage'])for(const amount of [0,10])test('Shion fan raw '+type+' '+amount,()=>{
 const s=state();s.players[1].zones.back1={...structuredClone(s.players[1].zones.center),attachments:[inst('hBP02-102','fan')]};
 s.effectQueue=[{type,playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',damage:amount,amount,loseLife:false,sourceName:'test',artName:'test'}];
 const e=applyAction(s,0,attack,pool,()=>.5);
 assert.equal(e.players[1].zones.back1.attachments.length,amount?0:1);
 assert.equal(e.players[1].archive.some(c=>c.id==='fan'),amount>0);
});
for(const type of ['dealArtsDamage','specialDamage'])for(const prevention of [{reactionReduction:10},{giftImmune:true},{reactionReduction:5}])test('Shion fan final '+type+' '+JSON.stringify(prevention),()=>{
 const s=state();s.players[1].zones.back1={...structuredClone(s.players[1].zones.center),attachments:[inst('hBP02-102','fan1'),inst('hBP02-102','fan2')]};
 s.effectQueue=[{type,playerIndex:0,targetPlayerIndex:1,targetZone:'back1',sourceZone:'center',damage:10,amount:10,loseLife:false,sourceName:'test',artName:'test',...prevention}];
 const e=applyAction(s,0,attack,pool,()=>.5),positive=prevention.reactionReduction===5;
 assert.equal(e.players[1].zones.back1.attachments.length,positive?0:2);
 assert.equal(e.players[1].zones.back1.damage,positive?5:0);
});
