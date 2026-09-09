import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const oshi of ['hBP02-004','hBD24-016'])for(const used of [true,false])test('056 SP '+oshi+' used '+used,()=>{
 const s=state('hBP06-056');s.players[0].oshi=inst(oshi);s.players[0].spOshiSkillUsed=used;fund(s.players[0].zones.center,['藍','藍','無色']);
 const act=()=>applyAction(s,0,attack,pool,()=>0);
 if(oshi==='hBP02-004'&&used){const r=act();assert.ok(r.players[1].zones.center.damage>=120);}else assert.throws(act);
});
