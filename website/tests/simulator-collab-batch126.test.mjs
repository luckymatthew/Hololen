import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,unit,inst,state,attack} from './fixtures/simulator-audit.mjs';
for(const first of [0,1])for(const turns of [1,2])test('Iofi collab first player '+first+' turn '+turns,()=>{
 let s=state();s.phase='main';s.firstPlayer=first;s.players[0].turnsTaken=turns;s.players[0].zones.back1=unit('hBP05-020');s.players[0].cheerDeck=[inst('hY01-001','top')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(first===1&&turns===1){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['collab']);s=applyAction(s,0,{type:'choose',zone:'collab'},pool,()=>0);assert.equal(s.players[0].zones.collab.cheer[0].id,'top');}
 else assert.equal(s.players[0].cheerDeck.length,1);
 assert.equal(s.pendingChoice,null);
});
for(const fan of [true,false])for(const sourceZone of ['center','back2'])test('Polka fan '+fan+' zone '+sourceZone,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit('hBP05-030');s.players[0].zones.back2=unit('AUDIT-DUMMY');
 const fanNumber=cards.find(c=>c.typeCode==='supportFan').number;
 for(const z of ['center','back2'])if(fan)s.players[0].zones[z].attachments=[inst(fanNumber,z+'fan')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 if(sourceZone==='back2'){s.players[0].zones.center=s.players[0].zones.back2;s.players[0].zones.back2=null;}
 s.phase='performance';s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,fan&&sourceZone==='center'?110:100);
});
