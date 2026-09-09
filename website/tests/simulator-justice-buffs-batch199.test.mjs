import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,unit,state,attack} from './fixtures/simulator-audit.mjs';
for(const n of ['hBP08-025','hBP08-026'])for(const count of [1,2])test(n+' rested Justice scope '+count,()=>{
 let s=state();s.phase='main';s.players[0].zones.back1=unit(n);
 for(let i=0;i<count;i++)s.players[0].zones['back'+(i+2)]=unit('hBP08-024',{rested:true});
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);
 const mods=u=>(u.modifiers||[]).filter(m=>m.kind==='arts').reduce((a,m)=>a+m.amount,0);
 assert.equal(mods(s.players[0].zones.collab),count===2?(n==='hBP08-025'?20:50):0);
 s.phase='performance';s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.players[1].zones.center.damage,n==='hBP08-025'&&count===2?120:100);
});
