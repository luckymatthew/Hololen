import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [zone,down] of [['center',true],['collab',true],['center',false]])test('Queen front-position Arts '+zone+' down '+down,()=>{let s=state('hBP07-027');if(zone==='collab'){s.players[0].zones.collab=s.players[0].zones.center;s.players[0].zones.center=unit('AUDIT-DUMMY');}fund(s.players[0].zones[zone],['綠','綠']);if(down)s.players[1].zones.center.damage=9990;s.players[1].zones.back1=unit('AUDIT-DUMMY');s=applyAction(s,0,{...attack,sourceZone:zone},pool,()=>0);assert.equal(s.players[0].hand.length,down?1:0);});
