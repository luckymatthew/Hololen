import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,unit,fund,attack} from './fixtures/simulator-audit.mjs';
for(const targetZone of ['center','collab'])test('Niko Arts center-only baton effect while attacking '+targetZone,()=>{let s=state('hSD11-007');s.players[1].zones.collab=unit('AUDIT-DUMMY');fund(s.players[0].zones.center,['無色']);s=applyAction(s,0,{...attack,targetZone},pool,()=>0);assert.equal(s.players[1].zones[targetZone].damage,20);const mods=s.players[1].zones.center.modifiers||[];assert.ok(mods.some(m=>m.kind==='batonCost'&&m.amount===1&&m.expiresTurn===4));assert.ok(!(s.players[1].zones.collab.modifiers||[]).some(m=>m.kind==='batonCost'));});
