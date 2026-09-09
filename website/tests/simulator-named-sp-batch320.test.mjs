import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst,fund,attack} from './fixtures/simulator-audit.mjs';
const card=cards.find(c=>c.number==='hBP06-045');
const name=card.arts[1].effect.match(/技能「([^」]+)」/u)[1];
const oshi=cards.find(c=>c.spOshiSkill?.name===name);assert.ok(oshi);
for(const [used,correct] of [[true,true],[false,true],[true,false]])test(`named SP damage used ${used} correct ${correct}`,()=>{
 let s=state(card.number);s.players[0].oshi=inst(correct?oshi.number:'AUDIT-OSHI');s.players[0].spOshiSkillUsed=used;
 fund(s.players[0].zones.center,card.arts[1].cost);
 s=applyAction(s,0,{...attack,artIndex:1},pool,()=>0);
 if(!(used&&correct)){assert.equal(s.pendingChoice,null);assert.equal(s.players[1].zones.center.damage,100);return;}
 assert.equal(s.pendingChoice.optional,false);assert.throws(()=>applyAction(s,0,{type:'choose',skip:true},pool,()=>0));
 s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[1].zones.center.damage,200);
});
