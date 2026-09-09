import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAction} from '../lib/simulator/engine.mjs';
import {cards,pool,state,inst} from './fixtures/simulator-audit.mjs';
const debut=cards.find(c=>c.stage==='Debut'&&c.tags?.includes('#ID2期生')&&cards.some(d=>d.jpName===c.jpName&&d.stage==='2nd'));
for(const stage of ['1st','2nd'])test('Ollie archive Bloom Debut to '+stage,()=>{const next=cards.find(c=>c.jpName===debut.jpName&&c.stage===stage);let s=state(debut.number);s.phase='main';s.players[0].oshi=inst('hBP02-006');s.players[0].holoPower=Array.from({length:5},(_,i)=>inst('AUDIT-DUMMY','hp'+i));s.players[0].archive=[inst(next.number,'bloom')];if(stage==='2nd'){assert.throws(()=>applyAction(s,0,{type:'oshiSkill'},pool,()=>0));return;}s=applyAction(s,0,{type:'oshiSkill'},pool,()=>0);assert.equal(s.pendingChoice.optional,false);s=applyAction(s,0,{type:'choose',cardIds:['bloom']},pool,()=>0);s=applyAction(s,0,{type:'choose',zone:'center'},pool,()=>0);assert.equal(s.players[0].zones.center.stack.at(-1).number,next.number);});
