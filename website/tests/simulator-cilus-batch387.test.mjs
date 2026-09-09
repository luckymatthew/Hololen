import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,inst,attack} from './fixtures/simulator-audit.mjs';
for(const center of [true,false])test('Cilus checks center holder independent source '+center,()=>{
 const kobo={...pool.find(c=>c.number==='AUDIT-DUMMY'),number:'KOBO-PROBE',jpName:'こぼ・かなえる'};let s=state(center?'KOBO-PROBE':'AUDIT-DUMMY');if(!center)s.players[0].zones.back1=unit('KOBO-PROBE');s.players[0].zones[center?'center':'back1'].attachments=[inst('hBP05-086','cilus')];s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:9990});s.effectQueue=[{type:'specialDamage',playerIndex:0,targetPlayerIndex:1,targetZone:'back1',amount:10,loseLife:false,sourceName:'Other ability'}];s=applyAction(s,0,attack,[...pool,kobo],()=>0);assert.equal(s.players[0].hand.length,center?1:0);
});
