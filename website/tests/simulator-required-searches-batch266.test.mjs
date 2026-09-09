import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,unit} from './fixtures/simulator-audit.mjs';
const mascot=cards.find(c=>c.typeCode==='supportMascot');
for(const [number,candidate] of [
 ['hSD14-004',mascot],
 ['hSD16-004',cards.find(c=>c.jpName==='35P')],
 ['hSD13-009',cards.find(c=>c.stage==='1st'&&c.tags?.includes('#Justice'))]
])test(number+' mandatory collab selection',()=>{
 assert.ok(candidate);let s=state();s.phase='main';s.firstPlayer=1;s.players[0].turnsTaken=1;s.players[0].zones.back1=unit(number);s.players[0].mainDeck=[inst('AUDIT-DUMMY','power'),inst(candidate.number,'pick')];
 s=applyAction(s,0,{type:'collab',zone:'back1'},pool,()=>0);assert.ok(s.pendingChoice);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,1);
});
for(const [number,type,candidate,min] of [
 ['hSD14-001','spOshiSkill',mascot,1],
 ['hSD15-001','oshiSkill',cards.find(c=>c.typeCode?.startsWith('supportEvent')&&c.tags?.includes('#きのこ')),1],
 ['hSD13-002','spOshiSkill',cards.find(c=>c.stage==='2nd'&&c.jpName==='ジジ・ムリン'),2]
])test(number+' mandatory oshi selection',()=>{
 assert.ok(candidate);let s=state();s.phase='main';s.players[0].oshi=inst(number);s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','hp'+i));s.players[0].mainDeck=[inst(candidate.number,'pick1'),inst(candidate.number,'pick2')];
 s=applyAction(s,0,{type},pool,()=>0);assert.ok(s.pendingChoice);assert.equal(s.pendingChoice.optional,false);assert.equal(s.pendingChoice.min,min);
});
