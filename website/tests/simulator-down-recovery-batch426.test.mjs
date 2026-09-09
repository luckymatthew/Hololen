import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {pool,state,inst,unit,attack} from './fixtures/simulator-audit.mjs';
for(const number of ['hBP07-084','hBP08-041','hEB01-006']) test('DOWN recovery before archive '+number,()=>{
 let s=state('AUDIT-DUMMY',number); const p=s.players[1]; p.zones.center.damage=9990;p.zones.back1=unit('AUDIT-DUMMY');
 p.zones.center.stack.unshift(inst('AUDIT-DUMMY','under'));p.zones.center.attachments=[inst('hSD03-013','attached')];
 const limited=pool.find(c=>c.group==='support'&&String(c.type).toUpperCase().includes('LIMITED'));
 p.archive=[inst(limited.number,'limited')];
 s=applyAction(s,0,attack,pool,()=>0);
 assert.equal(s.players[1].zones.center.downPending,true);
 const choice=number==='hBP08-041'?{optionId:'use'}:{cardIds:[number==='hBP07-084'?'limited':'attached']};
 s=applyAction(s,1,{type:'choose',...choice},pool,()=>0);
 const ids=number==='hEB01-006'?['attached']:[number,'under'];
 for(const id of ids){assert.ok(s.players[1].hand.some(c=>c.id===id),id);assert.ok(!s.players[1].archive.some(c=>c.id===id),id);}
 assert.equal(s.players[1].zones.center,null);
});
