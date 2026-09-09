import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const [source,oshi,used] of [['hBP07-052','hBP07-005',false],['hBP07-052','hBP07-005',true],['hBP07-052','hBD24-031',true],['AUDIT-DUMMY','hBP07-005',true]])test('07107 named SP gate '+source+oshi+used,()=>{
 let s=state(source);s.players[0].oshi=inst(oshi);s.players[0].spOshiSkillUsed=used;s.players[0].zones.center.attachments=[inst('hBP07-107')];
 if(source!=='AUDIT-DUMMY')fund(s.players[0].zones.center,['無色']);
 s=applyAction(s,0,attack,pool,()=>0);assert.equal(s.players[1].zones.center.damage,source==='AUDIT-DUMMY'?100:oshi==='hBP07-005'&&used?50:30);
});
