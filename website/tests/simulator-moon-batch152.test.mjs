import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,fund,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP06-048','hBP06-050'])for(const color of ['藍','白'])test(n+' cheer '+color,()=>{
 let s=state(n);fund(s.players[0].zones.center,[color]);s.players[1].zones.back1=unit('AUDIT-DUMMY',{damage:9990});
 s=applyAction(s,0,attack,pool,()=>0);
 const enabled=n==='hBP06-050'||color==='白';
 if(enabled){assert.equal(s.pendingChoice.optional,false);assert.deepEqual(s.pendingChoice.options,['back1']);s=applyAction(s,0,{type:'choose',zone:'back1'},pool,()=>0);assert.equal(s.players[1].zones.back1,null);}
 else assert.equal(s.players[1].zones.back1.damage,9990);
 assert.equal(s.players[1].life.length,enabled&&n==='hBP06-050'?4:5);
});
