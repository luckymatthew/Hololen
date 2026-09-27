import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit,attack,fund} from './fixtures/simulator-audit.mjs';
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

test('Q227 hBP02-102 archives through a real Arts action after damage is fixed and before HP is reduced',()=>{
 const s=state('hBP02-044');
 const attacker=unit('hBP02-044');fund(attacker,cards.find(c=>c.number==='hBP02-044').arts[0].cost);
 s.players[0].zones.center=attacker;
 s.players[1].zones.center=unit('hBP02-047',{attachments:[inst('hBP02-102','q227-fan-1'),inst('hBP02-102','q227-fan-2')]});
 const end=applyAction(structuredClone(s),0,attack,pool,()=>.5);
 assert.equal(end.players[1].zones.center.damage,30,'the announced Arts damage is applied after the two Fan abilities resolve');
 assert.deepEqual(end.players[1].zones.center.attachments,[],'each mandatory “when receiving damage” Fan trigger archives its own Fan');
 assert.deepEqual(end.players[1].archive.map(card=>card.id),['q227-fan-1','q227-fan-2']);
 const archiveLog=end.log.findIndex(entry=>entry.message?.includes('受傷前將 2 張粉絲存檔'));
 const damageLog=end.log.findIndex(entry=>entry.message?.includes('造成 30 傷害'));
 assert.ok(archiveLog>=0 && damageLog>=0,'both the mandatory Fan trigger and actual Arts damage are recorded');
 assert.ok(damageLog<archiveLog,'logs are newest-first: the applied-damage entry is newer than the before-damage Fan archive');
});

test('Q227 hBP02-102 remains attached when an Arts is reduced to zero damage',()=>{
 const s=state('hBP02-044');
 const attacker=unit('hBP02-044');fund(attacker,cards.find(c=>c.number==='hBP02-044').arts[0].cost);
 s.players[0].zones.center=attacker;
 s.players[1].zones.center=unit('hBP02-047',{attachments:[inst('hBP02-102','q227-zero-fan')],modifiers:[{kind:'artsDamageReduction',amount:30,uses:1,expiresTurn:s.turn,source:'fixture'}]});
 const end=applyAction(structuredClone(s),0,attack,pool,()=>.5);
 assert.equal(end.players[1].zones.center.damage,0);
 assert.deepEqual(end.players[1].zones.center.attachments.map(card=>card.id),['q227-zero-fan'],
  'a fully reduced Arts does not make the attached Holomem receive damage');
});
