import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,inst,state,fund,attack} from './fixtures/simulator-audit.mjs';
const fan=cards.find(c=>c.jpName==='ろぼさー'||c.name==='ろぼさー').number;
for(const n of ['hBP06-061','hBP06-066'])for(const count of [0,1,2,3])test(n+' fans '+count,()=>{
 let s=state(n);fund(s.players[0].zones.center,n==='hBP06-061'?['無色']:['紫','紫','無色']);s.players[0].zones.center.attachments=Array.from({length:count},(_,i)=>inst(fan,'fan'+i));
 s=applyAction(s,0,attack,pool,()=>0);
 if(n==='hBP06-066'&&count>=3){assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);}
 assert.equal(s.players[1].zones.center.damage,n==='hBP06-061'?Math.max(0,20-count*10)+(count?20:0):160-count*10+(count>=3?70:0));assert.equal(s.pendingChoice,null);
});

